# JS — Gallery Image Ops
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `static\js\gallery-image-ops.js`
```js
// gallery-image-ops.js — getOwnerTrade, syncOrder, reorder, move, remove,
//   handleReorderBatch, handleDropAsSubImage (lines 1-494).

function getOwnerTradeForImageUrl(imageUrl) {
    if (!imageUrl) return null;
    const isSub = (t, url) => {
        if (!t.subImages) return false;
        for (const p in t.subImages) {
            if (t.subImages[p].includes(url)) return true;
        }
        return false;
    };
    if (state.gallery.sourceRow !== null && state.trades[state.gallery.sourceRow]) {
        const t = state.trades[state.gallery.sourceRow];
        if (t.images?.includes(imageUrl) || isSub(t, imageUrl)) return t;
    }
    if (state.gallery.date) {
        const row = getTradesForDate(state.gallery.date).find(t => (t.images || []).includes(imageUrl) || isSub(t, imageUrl));
        if (row) return row;
        return null;
    }
    return state.trades.find(t => (t.images || []).includes(imageUrl) || isSub(t, imageUrl)) || null;
}

function syncGalleryImageOrderToTrades() {
    const ordered = state.gallery.images || [];

    const getSubSet = (t) => {
        const s = new Set();
        if (t && t.subImages) {
            Object.values(t.subImages).forEach(arr => arr.forEach(u => s.add(u)));
        }
        return s;
    };

    if (state.gallery.sourceRow !== null && state.trades[state.gallery.sourceRow]) {
        const t = state.trades[state.gallery.sourceRow];
        const subs = getSubSet(t);
        t.images = ordered.filter(u => !subs.has(u));
        return;
    }
    if (state.gallery.date) {
        const dk = state.gallery.date;
        if (state.dayData[dk]) {
            const daySubs = getSubSet(state.dayData[dk]);
            // For dayData, we want only the ordered items that belong to dayData originally.
            // Wait, dayData images are those NOT owned by any trade.
            // If it's owned by a trade, we update the trade.
            const dayTrades = getTradesForDate(dk);

            // Re-assign images based on owner.
            const newDayImages = [];
            const newTradeImages = new Map();
            dayTrades.forEach(t => newTradeImages.set(t, []));

            ordered.forEach(u => {
                const owner = getOwnerTradeForImageUrl(u);
                if (owner && newTradeImages.has(owner)) {
                    const subs = getSubSet(owner);
                    if (!subs.has(u)) newTradeImages.get(owner).push(u);
                } else {
                    if (!daySubs.has(u)) newDayImages.push(u);
                }
            });

            state.dayData[dk].images = newDayImages;
            dayTrades.forEach(t => { t.images = newTradeImages.get(t); });
        }
        return;
    }

    // Fallback: Global iteration
    ordered.forEach(u => {
        const owner = getOwnerTradeForImageUrl(u);
        if (owner) {
            const subs = getSubSet(owner);
            if (!subs.has(u)) {
                // Push if not present (this part is trickier without a grouped loop, but fallback rarely used)
                owner.images = owner.images || [];
                if (!owner.images.includes(u)) owner.images.push(u); // rudimentary sync for fallback
            }
        }
    });
}

async function reorderGalleryImages(fromIdx, toIdx) {
    const arr = state.gallery.images || [];
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= arr.length || toIdx >= arr.length) return;
    const currentUrl = arr[state.gallery.currentIndex];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    state.gallery.currentIndex = Math.max(0, arr.indexOf(currentUrl));
    syncGalleryImageOrderToTrades();
    await saveTrades();
    renderGallery();
    renderTable();
}

async function moveGalleryImageToDate(globalIdx, targetDate) {
    const arr = state.gallery.images || [];
    if (globalIdx < 0 || globalIdx >= arr.length) return;
    const imageUrl = arr[globalIdx];

    const ownerTrade = getOwnerTradeForImageUrl(imageUrl);
    if (ownerTrade) {
        ownerTrade.images = (ownerTrade.images || []).filter(u => u !== imageUrl);
    } else if (state.gallery.date && state.dayData[state.gallery.date]?.images) {
        state.dayData[state.gallery.date].images = state.dayData[state.gallery.date].images.filter(u => u !== imageUrl);
    }

    let targetTrade = getTradeForDate(targetDate);
    if (!targetTrade) {
        targetTrade = getOrCreateTrade(targetDate);
    }
    if (!targetTrade.images) targetTrade.images = [];
    targetTrade.images.push(imageUrl);

    arr.splice(globalIdx, 1);
    if (state.gallery.currentIndex >= arr.length) state.gallery.currentIndex = Math.max(0, arr.length - 1);

    if (!arr.length) {
        await saveTrades();
        renderTable();
        renderCalendar();
        document.getElementById('gallery-modal').classList.remove('open');
        unlockBodyScroll();
        showToast(`Image moved to ${targetDate}`, 'success');
        return;
    }
    syncGalleryImageOrderToTrades();
    await saveTrades();
    renderGallery();
    renderTable();
    renderCalendar();
    showToast(`Image moved to ${targetDate}`, 'success');
}

let undoGalleryDeletes = {};

async function removeGalleryImageAt(idx, force = false) {
    const arr = state.gallery.images || [];
    if (idx < 0 || idx >= arr.length) return;
    const imageUrl = arr[idx];

    const ownerTrade = getOwnerTradeForImageUrl(imageUrl);
    const dayDate = state.gallery.date;

    let subImages = [];
    if (ownerTrade && ownerTrade.subImages && ownerTrade.subImages[imageUrl]) {
        subImages = ownerTrade.subImages[imageUrl];
    } else if (dayDate && state.dayData[dayDate]?.subImages?.[imageUrl]) {
        subImages = state.dayData[dayDate].subImages[imageUrl];
    }

    if (subImages.length > 0 && !force) {
        // Promote sub-images to top-level; delete only the parent image
        const backupTradeIdx2 = ownerTrade ? state.trades.indexOf(ownerTrade) : -1;
        const backupTradeClone2 = ownerTrade ? JSON.parse(JSON.stringify(ownerTrade)) : null;
        const backupDay2 = dayDate && state.dayData[dayDate] ? JSON.parse(JSON.stringify(state.dayData[dayDate])) : null;
        const backupArr2 = [...arr];
        const backupCurrentIndex2 = state.gallery.currentIndex;
        const backupExpanded2 = state.gallery.expandedGroups ? new Set(state.gallery.expandedGroups) : null;

        const isExpanded = state.gallery.expandedGroups && state.gallery.expandedGroups.has(imageUrl);
        if (state._localOverlays?.[imageUrl]) delete state._localOverlays[imageUrl];

        if (ownerTrade) {
            ownerTrade.images = (ownerTrade.images || []).filter(u => u !== imageUrl);
            if (!isExpanded) ownerTrade.images.push(...subImages);
            if (ownerTrade.overlays?.[imageUrl]) delete ownerTrade.overlays[imageUrl];
            if (ownerTrade.marqueeBoxes?.[imageUrl]) delete ownerTrade.marqueeBoxes[imageUrl];
            const store2 = ensureImageTagStore(ownerTrade);
            if (store2[imageUrl]) delete store2[imageUrl];
            delete ownerTrade.subImages[imageUrl];
            cleanupImageTagStore(ownerTrade);
        } else if (dayDate && state.dayData[dayDate]) {
            state.dayData[dayDate].images = (state.dayData[dayDate].images || []).filter(u => u !== imageUrl);
            if (!isExpanded) state.dayData[dayDate].images.push(...subImages);
            if (state.dayData[dayDate].overlays?.[imageUrl]) delete state.dayData[dayDate].overlays[imageUrl];
            if (state.dayData[dayDate].marqueeBoxes?.[imageUrl]) delete state.dayData[dayDate].marqueeBoxes[imageUrl];
            if (state.dayData[dayDate].subImages?.[imageUrl]) delete state.dayData[dayDate].subImages[imageUrl];
        }

        if (state.gallery.expandedGroups) state.gallery.expandedGroups.delete(imageUrl);

        if (isExpanded) {
            state.gallery.images = arr.filter(u => u !== imageUrl);
        } else {
            const pIdx = arr.indexOf(imageUrl);
            if (pIdx >= 0) arr.splice(pIdx, 1, ...subImages);
            else state.gallery.images = arr.filter(u => u !== imageUrl);
        }
        if (state.gallery.currentIndex >= state.gallery.images.length)
            state.gallery.currentIndex = Math.max(0, state.gallery.images.length - 1);

        syncGalleryImageOrderToTrades();
        renderGallery(); renderTable(); renderCalendar();

        const t2 = document.getElementById('toast');
        t2.innerHTML = `Parent removed, ${subImages.length} image(s) ungrouped. <button id="undo-del-btn" style="margin-left:10px;padding:2px 8px;background:var(--blue);color:#fff;border:none;border-radius:4px;cursor:pointer;">Undo</button>`;
        t2.className = 'toast success show';
        let isUndone2 = false;
        document.getElementById('undo-del-btn').addEventListener('click', () => {
            isUndone2 = true;
            if (backupTradeIdx2 >= 0) state.trades[backupTradeIdx2] = backupTradeClone2;
            if (dayDate && backupDay2) state.dayData[dayDate] = backupDay2;
            state.gallery.images = backupArr2; state.gallery.currentIndex = backupCurrentIndex2;
            if (backupExpanded2) state.gallery.expandedGroups = backupExpanded2;
            t2.innerText = 'Restored.'; setTimeout(() => { t2.className = 'toast'; }, 2000);
            syncGalleryImageOrderToTrades(); renderGallery(); saveTrades(); renderTable(); renderCalendar();
        });
        setTimeout(() => { if (!isUndone2) t2.className = 'toast'; }, 4000);
        setTimeout(async () => {
            if (!isUndone2) {
                try {
                    const fn = String(imageUrl || '').split('/').pop();
                    await fetch('/api/delete-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: fn }) });
                } catch (e) { }
            }
        }, 5000);
        if (!state.gallery.images.length) { document.getElementById('gallery-modal').classList.remove('open'); unlockBodyScroll(); }
        await fetch('/api/trades', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trades: state.trades, columns: state.columns, allTags: state.allTags, tagColumns: state.tagColumns, userColumns: state.userColumns, dayData: state.dayData, tagGroups: state.tagGroups })
        });
        return;
    }

    const urlsToDelete = [imageUrl, ...subImages];

    // Backup for undo
    const backupTradeIdx = ownerTrade ? state.trades.indexOf(ownerTrade) : -1;
    const backupTradeClone = ownerTrade ? JSON.parse(JSON.stringify(ownerTrade)) : null;
    const backupDay = dayDate && state.dayData[dayDate] ? JSON.parse(JSON.stringify(state.dayData[dayDate])) : null;
    const backupArr = [...arr];
    const backupCurrentIndex = state.gallery.currentIndex;
    const backupExpanded = state.gallery.expandedGroups ? new Set(state.gallery.expandedGroups) : null;

    // Execute local state deletion
    urlsToDelete.forEach(u => {
        if (state._localOverlays?.[u]) delete state._localOverlays[u];
    });

    if (ownerTrade) {
        ownerTrade.images = (ownerTrade.images || []).filter(u => !urlsToDelete.includes(u));
        urlsToDelete.forEach(u => {
            if (ownerTrade.overlays && ownerTrade.overlays[u]) delete ownerTrade.overlays[u];
            if (ownerTrade.marqueeBoxes && ownerTrade.marqueeBoxes[u]) delete ownerTrade.marqueeBoxes[u];
            const store = ensureImageTagStore(ownerTrade);
            if (store[u]) delete store[u];
        });
        if (ownerTrade.subImages && ownerTrade.subImages[imageUrl]) delete ownerTrade.subImages[imageUrl];
        // Remove deleted URLs from any parent's subImages (handles sub-image deletion)
        if (ownerTrade.subImages) {
            for (const [pUrl, subs] of Object.entries(ownerTrade.subImages)) {
                const filtered = subs.filter(u => !urlsToDelete.includes(u));
                if (filtered.length === 0) {
                    delete ownerTrade.subImages[pUrl];
                    if (state.gallery.expandedGroups) state.gallery.expandedGroups.delete(pUrl);
                } else if (filtered.length < subs.length) {
                    ownerTrade.subImages[pUrl] = filtered;
                }
            }
            if (Object.keys(ownerTrade.subImages).length === 0) delete ownerTrade.subImages;
        }
        cleanupImageTagStore(ownerTrade);
    } else if (dayDate && state.dayData[dayDate]) {
        state.dayData[dayDate].images = (state.dayData[dayDate].images || []).filter(u => !urlsToDelete.includes(u));
        urlsToDelete.forEach(u => {
            if (state.dayData[dayDate].overlays?.[u]) delete state.dayData[dayDate].overlays[u];
            if (state.dayData[dayDate].marqueeBoxes?.[u]) delete state.dayData[dayDate].marqueeBoxes[u];
        });
        if (state.dayData[dayDate].subImages && state.dayData[dayDate].subImages[imageUrl]) delete state.dayData[dayDate].subImages[imageUrl];
        // Remove deleted URLs from any parent's subImages (handles sub-image deletion)
        if (state.dayData[dayDate].subImages) {
            for (const [pUrl, subs] of Object.entries(state.dayData[dayDate].subImages)) {
                const filtered = subs.filter(u => !urlsToDelete.includes(u));
                if (filtered.length === 0) {
                    delete state.dayData[dayDate].subImages[pUrl];
                    if (state.gallery.expandedGroups) state.gallery.expandedGroups.delete(pUrl);
                } else if (filtered.length < subs.length) {
                    state.dayData[dayDate].subImages[pUrl] = filtered;
                }
            }
            if (Object.keys(state.dayData[dayDate].subImages).length === 0) delete state.dayData[dayDate].subImages;
        }
    }

    if (state.gallery.expandedGroups && state.gallery.expandedGroups.has(imageUrl)) {
        state.gallery.expandedGroups.delete(imageUrl);
    }

    const updatedArr = arr.filter(u => !urlsToDelete.includes(u));
    state.gallery.images = updatedArr;
    if (state.gallery.currentIndex >= updatedArr.length) state.gallery.currentIndex = Math.max(0, updatedArr.length - 1);

    // UI update FIRST
    syncGalleryImageOrderToTrades();
    renderGallery();
    renderTable();
    renderCalendar();

    // Create custom undo toast OVERRIDING whatever might happen next (though we won't call saveTrades until 100ms or manually)
    const t = document.getElementById('toast');
    t.innerHTML = `Image removed. <button id="undo-del-btn" style="margin-left:10px; padding:2px 8px; background:var(--blue); color:#fff; border:none; border-radius:4px; cursor:pointer;">Undo</button>`;
    t.className = `toast success show`;

    let isUndone = false;
    document.getElementById('undo-del-btn').addEventListener('click', () => {
        isUndone = true;
        // Restore
        if (backupTradeIdx >= 0) {
            state.trades[backupTradeIdx] = backupTradeClone;
        }
        if (dayDate && backupDay) {
            state.dayData[dayDate] = backupDay;
        }
        state.gallery.images = backupArr;
        state.gallery.currentIndex = backupCurrentIndex;
        if (backupExpanded) state.gallery.expandedGroups = backupExpanded;
        undoGalleryDeletes[imageUrl] = true;

        t.innerText = "Restored.";
        setTimeout(() => { t.className = 'toast'; }, 2000);

        syncGalleryImageOrderToTrades();
        renderGallery();
        saveTrades();
        renderTable();
        renderCalendar();
    });

    setTimeout(() => {
        if (!isUndone) t.className = 'toast';
    }, 4000);

    setTimeout(async () => {
        if (!isUndone) {
            for (const dictUrl of urlsToDelete) {
                try {
                    const filename = String(dictUrl || '').split('/').pop();
                    await fetch('/api/delete-image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filename })
                    });
                } catch (e) { }
                delete undoGalleryDeletes[dictUrl];
            }
        }
    }, 5000);

    if (!arr.length) {
        document.getElementById('gallery-modal').classList.remove('open');
        unlockBodyScroll();
    }

    await fetch('/api/trades', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            trades: state.trades, columns: state.columns, allTags: state.allTags,
            tagColumns: state.tagColumns, userColumns: state.userColumns,
            dayData: state.dayData, tagGroups: state.tagGroups
        })
    });
}

async function handleReorderGalleryImagesBatch(draggedIndicesStr, insertAtGlobalIdx) {
    const arr = state.gallery.images || [];
    const indices = draggedIndicesStr.sort((a, b) => a - b);
    if (!indices.length) return;

    // gather items
    const items = indices.map(i => arr[i]);
    const currentUrl = arr[state.gallery.currentIndex];

    // First, detach moving items from their current groups
    const removeFromGroup = (u) => {
        let p = null;
        for (const trade of state.trades) {
            if (trade.subImages) {
                for (const [parentUrl, subs] of Object.entries(trade.subImages)) {
                    if (subs.includes(u)) { trade.subImages[parentUrl] = subs.filter(x => x !== u); p = parentUrl; }
                    if (trade.subImages[parentUrl].length === 0) delete trade.subImages[parentUrl];
                }
                if (trade.subImages && Object.keys(trade.subImages).length === 0) delete trade.subImages;
            }
        }
        if (state.gallery.date && state.dayData[state.gallery.date]?.subImages) {
            const d = state.dayData[state.gallery.date];
            for (const [parentUrl, subs] of Object.entries(d.subImages)) {
                if (subs.includes(u)) { d.subImages[parentUrl] = subs.filter(x => x !== u); p = parentUrl; }
                if (d.subImages[parentUrl].length === 0) delete d.subImages[parentUrl];
            }
            if (Object.keys(d.subImages).length === 0) delete d.subImages;
        }
        return p;
    };

    // If the items being dragged ARE currently sub-images, detach them.
    // If they were grouped with something, they will now be independent.
    // NOTE: This happens for ALL dragged items, including parents. If a parent is dragged natively (which shouldn't happen unless inside its group wrapper), its subimages stay in its map. But dragging subimages outside is what matters.
    let anyDetached = false;
    items.forEach(u => {
        const P = removeFromGroup(u);
        if (P) anyDetached = true;
    });

    // adjust insertAt index based on items being removed before it
    let adjustedInsertAt = insertAtGlobalIdx;
    let removedBeforeInsert = indices.filter(i => i < insertAtGlobalIdx).length;
    adjustedInsertAt -= removedBeforeInsert;

    // remove items
    for (let i = indices.length - 1; i >= 0; i--) {
        arr.splice(indices[i], 1);
    }
    // insert items
    arr.splice(adjustedInsertAt, 0, ...items);

    if (anyDetached) {
        state.gallery.expandedGroups = state.gallery.expandedGroups || new Set();
        // Since it's detached, it becomes a regular item in `arr`, and syncGalleryImageOrderToTrades will naturally put it back into its owner's `images` array because it's no longer in `subImages`.
    }

    state.gallery.currentIndex = Math.max(0, arr.indexOf(currentUrl));
    state.gallery.selectedIndices = new Set();
    syncGalleryImageOrderToTrades();
    await saveTrades();
    renderGallery();
    renderTable();
}

async function handleDropAsSubImage(draggedIndicesStr, targetGlobalIdx) {
    const arr = state.gallery.images || [];
    const indices = draggedIndicesStr.sort((a, b) => a - b);
    if (!indices.length) return;

    let targetThumbUrl = arr[targetGlobalIdx];
    const items = indices.map(i => arr[i]);
    const currentUrl = arr[state.gallery.currentIndex];
    const ownerTrade = getOwnerTradeForImageUrl(targetThumbUrl);
    const dayDate = state.gallery.date;

    // Backup for undo
    const backupTradeIdx = ownerTrade ? state.trades.indexOf(ownerTrade) : -1;
    const backupTradeClone = ownerTrade ? JSON.parse(JSON.stringify(ownerTrade)) : null;
    const backupDay = dayDate && state.dayData[dayDate] ? JSON.parse(JSON.stringify(state.dayData[dayDate])) : null;
    const backupArr = [...arr];
    const backupCurrentIndex = state.gallery.currentIndex;
    const backupExpanded = state.gallery.expandedGroups ? new Set(state.gallery.expandedGroups) : null;

    // Remove items from main view
    for (let i = indices.length - 1; i >= 0; i--) {
        arr.splice(indices[i], 1);
    }

    if (ownerTrade) {
        ownerTrade.subImages = ownerTrade.subImages || {};
        ownerTrade.subImages[targetThumbUrl] = ownerTrade.subImages[targetThumbUrl] || [];
        for (const it of items) {
            ownerTrade.subImages[targetThumbUrl].push(it);
            ownerTrade.images = (ownerTrade.images || []).filter(u => u !== it);
        }
    } else if (dayDate) {
        state.dayData[dayDate].subImages = state.dayData[dayDate].subImages || {};
        state.dayData[dayDate].subImages[targetThumbUrl] = state.dayData[dayDate].subImages[targetThumbUrl] || [];
        for (const it of items) {
            state.dayData[dayDate].subImages[targetThumbUrl].push(it);
            state.dayData[dayDate].images = (state.dayData[dayDate].images || []).filter(u => u !== it);
        }
    }

    state.gallery.currentIndex = Math.max(0, arr.indexOf(currentUrl) >= 0 ? arr.indexOf(currentUrl) : targetGlobalIdx);
    state.gallery.selectedIndices = new Set();
    syncGalleryImageOrderToTrades();
    renderGallery();
    renderTable();
    await saveTrades();

    // Undo toast
    const t = document.getElementById('toast');
    t.innerHTML = `${items.length} image(s) grouped. <button id="undo-del-btn" style="margin-left:10px;padding:2px 8px;background:var(--blue);color:#fff;border:none;border-radius:4px;cursor:pointer;">Undo</button>`;
    t.className = 'toast success show';
    let isUndone = false;
    document.getElementById('undo-del-btn').addEventListener('click', () => {
        isUndone = true;
        if (backupTradeIdx >= 0) state.trades[backupTradeIdx] = backupTradeClone;
        if (dayDate && backupDay) state.dayData[dayDate] = backupDay;
        state.gallery.images = backupArr; state.gallery.currentIndex = backupCurrentIndex;
        if (backupExpanded) state.gallery.expandedGroups = backupExpanded;
        t.innerText = 'Restored.'; setTimeout(() => { t.className = 'toast'; }, 2000);
        syncGalleryImageOrderToTrades(); renderGallery(); saveTrades(); renderTable(); renderCalendar();
    });
    setTimeout(() => { if (!isUndone) t.className = 'toast'; }, 4000);
}


```
