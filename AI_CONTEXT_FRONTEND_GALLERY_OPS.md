# Frontend Context — Gallery Ops (image-ops / context-menu / tags)
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

## File: `static\js\gallery-ops.js`
```js
// gallery-ops.js — Context menu, image replace, group/ungroup/tile ops,
//   showGalleryGroupDeleteConfirm, toggleGalleryGroupExpand, moveSelectedToTrade.

function showGalleryContextMenu(x, y) {
    const existing = document.getElementById('gv2-context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'gv2-context-menu';
    menu.style.position = 'fixed';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.background = 'var(--surface2)';
    menu.style.border = '1px solid var(--border)';
    menu.style.zIndex = '99999';
    menu.style.padding = '4px 0';
    menu.style.minWidth = '160px';
    menu.style.borderRadius = 'var(--radius)';
    menu.style.boxShadow = 'var(--shadow)';
    menu.style.outline = 'none';

    const ctx = getCurrentGalleryPreserveContext();
    const dateToUse = state.gallery.date || ctx.date;
    const dayTrades = dateToUse ? getTradesForDate(dateToUse) : [];

    const menuItems = [];
    let focusedItem = -1;

    const setFocusItem = (i) => {
        menuItems.forEach((it, j) => { it.style.background = j === i ? 'var(--hover)' : ''; });
        focusedItem = i;
    };

    const cleanup = () => {
        menu.remove();
        document.removeEventListener('keydown', keyHandler, true);
        document.removeEventListener('mousedown', closeMenu);
    };

    const createOpt = (text, onClick) => {
        const opt = document.createElement('div');
        opt.textContent = text;
        opt.style.cursor = 'pointer';
        opt.style.padding = '7px 16px';
        opt.style.fontSize = '0.85rem';
        opt.style.borderRadius = '2px';
        opt.onmouseenter = () => setFocusItem(menuItems.length - 1 + menuItems.indexOf(opt) - menuItems.length + 1);
        opt.onmouseleave = () => { opt.style.background = ''; };
        opt.onclick = () => { cleanup(); onClick(); };
        menuItems.push(opt);
        // Fix hover index since we push before returning
        const itemIdx = menuItems.length - 1;
        opt.onmouseenter = () => setFocusItem(itemIdx);
        return opt;
    };

    const addSep = () => {
        const s = document.createElement('div');
        s.style.height = '1px'; s.style.background = 'var(--border)'; s.style.margin = '3px 0';
        menu.appendChild(s);
    };

    const selectedIdxArr = Array.from(state.gallery.selectedIndices || []);
    if (selectedIdxArr.length === 1) {
        const selIdx = selectedIdxArr[0];
        const url = (state.gallery.images || [])[selIdx];
        const ownerTrade = getOwnerTradeForImageUrl(url);
        let isParent = false;
        let pRef = null;
        if (ownerTrade && ownerTrade.subImages && ownerTrade.subImages[url]) {
            isParent = true; pRef = ownerTrade;
        } else if (state.gallery.date && state.dayData[state.gallery.date]?.subImages?.[url]) {
            isParent = true; pRef = state.dayData[state.gallery.date];
        }

        if (isParent) {
            menu.appendChild(createOpt('Rename Group', async () => {
                const currentName = pRef.groupNames?.[url] || '';
                const newName = prompt('Enter group name:', currentName);
                if (newName !== null) {
                    pRef.groupNames = pRef.groupNames || {};
                    if (newName.trim() === '') delete pRef.groupNames[url];
                    else pRef.groupNames[url] = newName.trim();
                    saveTrades(); renderGallery();
                }
            }));
            menu.appendChild(createOpt('Ungroup', async () => {
                await removeGalleryImageAt(selIdx, false);
            }));
            menu.appendChild(createOpt('Delete Group', async () => {
                const subCount = (pRef.subImages?.[url] || []).length;
                showGalleryGroupDeleteConfirm(selIdx, subCount);
            }));
            addSep();
        }

        menu.appendChild(createOpt('Replace Image', () => {
            const inp = document.createElement('input');
            inp.type = 'file'; inp.accept = 'image/*';
            inp.onchange = async () => {
                if (!inp.files[0]) return;
                const fd = new FormData();
                fd.append('image', inp.files[0]);
                try {
                    const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
                    if (!res.ok) throw new Error();
                    const rv = await res.json();
                    if (!rv.url) throw new Error();
                    await replaceGalleryImageUrl(url, rv.url);
                    showToast('Image replaced', 'success');
                } catch (e) { showToast('Replace failed', 'error'); }
            };
            inp.click();
        }));
        addSep();
    }

    menu.appendChild(createOpt('Global (Consolidate)', () => moveSelectedToTrade(dateToUse, null)));
    dayTrades.forEach((tr, i) => {
        menu.appendChild(createOpt(`Trade ${i + 1}`, () => moveSelectedToTrade(dateToUse, tr)));
    });

    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    if (rect.bottom > window.innerHeight) menu.style.top = Math.max(0, y - rect.height) + 'px';
    if (rect.right > window.innerWidth) menu.style.left = Math.max(0, x - rect.width) + 'px';

    const keyHandler = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault(); e.stopPropagation();
            setFocusItem((focusedItem + 1) % menuItems.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault(); e.stopPropagation();
            setFocusItem((focusedItem - 1 + menuItems.length) % menuItems.length);
        } else if (e.key === 'Enter') {
            e.preventDefault(); e.stopPropagation();
            if (focusedItem >= 0 && menuItems[focusedItem]) menuItems[focusedItem].click();
        } else if (e.key === 'Escape') {
            e.preventDefault(); e.stopPropagation(); cleanup();
        }
    };
    document.addEventListener('keydown', keyHandler, true);

    const closeMenu = (e) => { if (!menu.contains(e.target)) cleanup(); };
    setTimeout(() => document.addEventListener('mousedown', closeMenu), 0);
}

async function replaceGalleryImageUrl(oldUrl, newUrl) {
    const repIn = (obj, key) => { if (obj && obj[key] !== undefined) { obj[newUrl] = obj[key]; delete obj[key]; } };
    state.trades.forEach(t => {
        t.images = (t.images || []).map(u => u === oldUrl ? newUrl : u);
        if (t.subImages) {
            const ns = {};
            for (const [p, s] of Object.entries(t.subImages)) ns[p === oldUrl ? newUrl : p] = s.map(u => u === oldUrl ? newUrl : u);
            t.subImages = ns;
        }
        if (t.groupNames) {
            const ng = {};
            for (const [p, n] of Object.entries(t.groupNames)) ng[p === oldUrl ? newUrl : p] = n;
            t.groupNames = ng;
        }
        repIn(t.overlays, oldUrl); repIn(t.marqueeBoxes, oldUrl);
        if (t._imageTags) repIn(t._imageTags, oldUrl);
    });
    for (const dd of Object.values(state.dayData || {})) {
        dd.images = (dd.images || []).map(u => u === oldUrl ? newUrl : u);
        if (dd.subImages) {
            const ns = {};
            for (const [p, s] of Object.entries(dd.subImages)) ns[p === oldUrl ? newUrl : p] = s.map(u => u === oldUrl ? newUrl : u);
            dd.subImages = ns;
        }
        if (dd.groupNames) {
            const ng = {};
            for (const [p, n] of Object.entries(dd.groupNames)) ng[p === oldUrl ? newUrl : p] = n;
            dd.groupNames = ng;
        }
        repIn(dd.overlays, oldUrl); repIn(dd.marqueeBoxes, oldUrl);
    }
    state.gallery.images = (state.gallery.images || []).map(u => u === oldUrl ? newUrl : u);
    if (state.gallery.expandedGroups?.has(oldUrl)) { state.gallery.expandedGroups.delete(oldUrl); state.gallery.expandedGroups.add(newUrl); }
    if (state._localOverlays?.[oldUrl]) { state._localOverlays[newUrl] = state._localOverlays[oldUrl]; delete state._localOverlays[oldUrl]; }
    syncGalleryImageOrderToTrades();
    await saveTrades();
    renderGallery(); renderTable();
}

async function groupAllGalleryImages() {
    const arr = state.gallery.images || [];
    const sel = state.gallery.selectedIndices;
    if (sel && sel.size >= 2) {
        // Group selected images: lowest-index selected = parent, rest = sub-images
        const sortedIndices = Array.from(sel).sort((a, b) => a - b);
        const parentIdx = sortedIndices[0];
        const childIndices = sortedIndices.slice(1);
        await handleDropAsSubImage(childIndices, parentIdx);
    } else {
        if (arr.length < 2) { showToast('Need at least 2 images to group', 'info'); return; }
        const indices = arr.slice(1).map((_, i) => i + 1);
        await handleDropAsSubImage(indices, 0);
    }
}

async function ungroupAllGalleryImages() {
    const sel = state.gallery.selectedIndices;
    const arr = state.gallery.images || [];

    // If exactly 1 image selected and it's a group parent → ungroup only that group
    if (sel && sel.size === 1) {
        const selIdx = Array.from(sel)[0];
        const url = arr[selIdx];
        const ownerTrade = getOwnerTradeForImageUrl(url);
        const dayDate = state.gallery.date;
        const isParent = (ownerTrade?.subImages?.[url]?.length > 0)
            || (dayDate && state.dayData[dayDate]?.subImages?.[url]?.length > 0);
        if (isParent) {
            await removeGalleryImageAt(selIdx, false); // promote sub-images to top-level
            return;
        }
    }

    // Otherwise flatten all groups
    const dateKey = state.gallery.date;
    if (!dateKey) { showToast('No date context', 'info'); return; }
    let changed = false;
    const flatten = (obj) => {
        if (!obj?.subImages) return;
        for (const [pUrl, subs] of Object.entries({ ...obj.subImages })) {
            obj.images = (obj.images || []).concat(subs);
            delete obj.subImages[pUrl];
            if (state.gallery.expandedGroups) state.gallery.expandedGroups.delete(pUrl);
            changed = true;
        }
        if (obj.subImages && Object.keys(obj.subImages).length === 0) delete obj.subImages;
    };
    getTradesForDate(dateKey).forEach(flatten);
    if (state.dayData[dateKey]) flatten(state.dayData[dateKey]);
    if (!changed) { showToast('No groups to ungroup', 'info'); return; }
    state.gallery.images = getImagesForDate(dateKey);
    state.gallery.currentIndex = 0;
    syncGalleryImageOrderToTrades();
    await saveTrades();
    renderGallery(); renderTable();
    showToast('All groups ungrouped', 'success');
}

async function moveGalleryTile(dir) {
    const arr = state.gallery.images || [];
    if (arr.length < 2) return;
    const indices = (state.gallery.selectedIndices?.size > 0)
        ? Array.from(state.gallery.selectedIndices).sort((a, b) => a - b)
        : [state.gallery.currentIndex];
    if (dir < 0) {
        if (indices[0] <= 0) return;
        for (const i of indices) { const t = arr[i - 1]; arr[i - 1] = arr[i]; arr[i] = t; }
        state.gallery.selectedIndices = new Set(indices.map(i => i - 1));
        state.gallery.currentIndex = Math.max(0, state.gallery.currentIndex - 1);
    } else {
        if (indices[indices.length - 1] >= arr.length - 1) return;
        for (let i = indices.length - 1; i >= 0; i--) {
            const idx = indices[i]; const t = arr[idx + 1]; arr[idx + 1] = arr[idx]; arr[idx] = t;
        }
        state.gallery.selectedIndices = new Set(indices.map(i => i + 1));
        state.gallery.currentIndex = Math.min(arr.length - 1, state.gallery.currentIndex + 1);
    }
    syncGalleryImageOrderToTrades();
    await saveTrades();
    renderGallery(); renderTable();
}

function showGalleryGroupDeleteConfirm(idx, subCount) {
    if (document.getElementById('gallery-grp-del-confirm')) return;
    const overlay = document.createElement('div');
    overlay.id = 'gallery-grp-del-confirm';
    overlay.style.position = 'fixed';
    overlay.style.top = '0'; overlay.style.left = '0';
    overlay.style.width = '100%'; overlay.style.height = '100%';
    overlay.style.background = 'rgba(0,0,0,0.7)';
    overlay.style.zIndex = '999999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center';

    const box = document.createElement('div');
    box.style.background = 'var(--bg2)';
    box.style.padding = '25px 30px';
    box.style.borderRadius = '8px';
    box.style.border = '1px solid var(--border)';
    box.style.textAlign = 'center';
    box.style.minWidth = '250px';
    box.innerHTML = `<p style="margin: 0 0 20px 0; font-size: 1.15rem; color: #fff;">Delete group + ${subCount} sub-images?</p>`;

    const btnYes = document.createElement('button');
    btnYes.className = 'btn btn-outline'; btnYes.textContent = 'Yes';
    btnYes.style.marginRight = '12px'; btnYes.style.outline = 'none';
    btnYes.style.minWidth = '75px';

    const btnNo = document.createElement('button');
    btnNo.className = 'btn btn-outline'; btnNo.textContent = 'No';
    btnNo.style.outline = 'none';
    btnNo.style.minWidth = '75px';

    box.appendChild(btnYes);
    box.appendChild(btnNo);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    let focusedIndex = 1; // 1 for No default
    const btns = [btnYes, btnNo];

    const updateFocus = () => {
        btns.forEach((b, i) => {
            if (i === focusedIndex) {
                b.style.borderColor = 'var(--red)';
                b.style.boxShadow = '0 0 0 2px rgba(255,100,100,0.3)';
                b.style.color = 'var(--red)';
                b.focus();
            } else {
                b.style.borderColor = 'var(--border)';
                b.style.boxShadow = 'none';
                b.style.color = '';
            }
        });
    };

    const cleanup = () => {
        document.removeEventListener('keydown', keyHandler, true);
        overlay.remove();
        const gm = document.getElementById('gallery-modal');
        if (gm) gm.focus();
    };

    const runDelete = () => {
        cleanup();
        removeGalleryImageAt(idx, true);
    };

    const keyHandler = (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); focusedIndex = 0; updateFocus(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); focusedIndex = 1; updateFocus(); }
        else if (e.key === 'Enter') {
            e.preventDefault(); e.stopPropagation();
            if (focusedIndex === 0) runDelete(); else cleanup();
        }
        else if (e.key === 'Escape') {
            e.preventDefault(); e.stopPropagation(); cleanup();
        }
    };

    btnYes.addEventListener('click', runDelete);
    btnNo.addEventListener('click', cleanup);

    document.addEventListener('keydown', keyHandler, true);
    setTimeout(updateFocus, 10);
}

function toggleGalleryGroupExpand(url) {
    if (!state.gallery.expandedGroups) state.gallery.expandedGroups = new Set();
    const arr = state.gallery.images || [];
    let isExpanded = state.gallery.expandedGroups.has(url);

    // fetch sub-images — search ownerTrade first, then all dayData
    const ownerTrade = getOwnerTradeForImageUrl(url);
    let subImages = [];
    if (ownerTrade?.subImages?.[url]?.length) {
        subImages = ownerTrade.subImages[url];
    } else {
        for (const [, v] of Object.entries(state.dayData || {})) {
            if (v?.subImages?.[url]?.length) { subImages = v.subImages[url]; break; }
        }
    }

    if (!subImages.length) {
        // Maybe the user clicked a sub-image — find its parent
        let parentUrl = null;
        for (const [pUrl, imgs] of Object.entries(ownerTrade?.subImages || {})) {
            if (imgs.includes(url)) { parentUrl = pUrl; break; }
        }
        if (!parentUrl) {
            for (const [, v] of Object.entries(state.dayData || {})) {
                for (const [pUrl, imgs] of Object.entries(v?.subImages || {})) {
                    if (imgs.includes(url)) { parentUrl = pUrl; break; }
                }
                if (parentUrl) break;
            }
        }
        if (parentUrl && state.gallery.expandedGroups.has(parentUrl)) {
            return toggleGalleryGroupExpand(parentUrl);
        }
        if (state.gallery.expandedGroups.has(url)) state.gallery.expandedGroups.delete(url);
        return false;
    }

    const filterActive = Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length > 0;
    if (filterActive) {
        // Filter mode: just toggle expandedGroups, applyGalleryImageScopeByTagFilter handles the rest
        if (isExpanded) state.gallery.expandedGroups.delete(url);
        else state.gallery.expandedGroups.add(url);
        renderGallery(); renderTable();
        return true;
    }

    const idx = arr.indexOf(url);
    if (isExpanded) {
        state.gallery.expandedGroups.delete(url);
        const toRemove = new Set(subImages);
        const currUrl = arr[state.gallery.currentIndex];
        const newArr = arr.filter(u => !toRemove.has(u));
        state.gallery.images = newArr;

        let targetCurr = newArr.indexOf(currUrl);
        if (targetCurr === -1) targetCurr = newArr.indexOf(url);
        state.gallery.currentIndex = Math.max(0, targetCurr);
    } else {
        if (idx === -1) return false;
        state.gallery.expandedGroups.add(url);
        const currUrl = arr[state.gallery.currentIndex];
        state.gallery.images.splice(idx + 1, 0, ...subImages);
        state.gallery.currentIndex = Math.max(0, state.gallery.images.indexOf(currUrl));
    }

    renderGallery();
    renderTable();
    return true;
}

async function moveSelectedToTrade(dateToUse, targetTrade) {
    if (!state.gallery.selectedIndices || state.gallery.selectedIndices.size === 0) return;
    const arr = state.gallery.images || [];
    const indices = Array.from(state.gallery.selectedIndices).sort((a, b) => b - a); // descending to splice safely

    let targetTradeObj = targetTrade;
    if (!targetTradeObj && dateToUse) {
        // If it's global, we move it out of trades to dayData
        if (!state.dayData[dateToUse]) state.dayData[dateToUse] = {};
        if (!state.dayData[dateToUse].images) state.dayData[dateToUse].images = [];
    }

    let movedCount = 0;

    for (let idx of indices) {
        if (idx < 0 || idx >= arr.length) continue;
        const imageUrl = arr[idx];
        const ownerTrade = getOwnerTradeForImageUrl(imageUrl);

        // Remove from current location
        if (ownerTrade) {
            ownerTrade.images = (ownerTrade.images || []).filter(u => u !== imageUrl);
        } else if (state.gallery.date && state.dayData[state.gallery.date]?.images) {
            state.dayData[state.gallery.date].images = state.dayData[state.gallery.date].images.filter(u => u !== imageUrl);
        }

        // Add to target location
        if (targetTradeObj) {
            if (!targetTradeObj.images) targetTradeObj.images = [];
            targetTradeObj.images.push(imageUrl);
        } else if (dateToUse) {
            state.dayData[dateToUse].images.push(imageUrl);
        }
        movedCount++;
    }

    state.gallery.selectedIndices.clear();
    syncGalleryImageOrderToTrades();
    await saveTrades();
    renderGallery();
    renderTable();
    renderCalendar();
    showToast(`Moved ${movedCount} image(s)`, 'success');
}


```

## File: `static\js\gallery-layer.js`
```js
// gallery-layer.js — renderLayerPanel, toggleLayerPanel, shortcuts list,
//   renderShortcutsPopover, renderGalleryVideoUrls.

function renderLayerPanel() {
    const list = document.getElementById('gv2-layer-list');
    if (!list) return;
    const images = state.gallery.images || [];
    if (!state.gallery.hiddenImages) state.gallery.hiddenImages = new Set();
    const dayDate = state.gallery.date;
    list.innerHTML = '';

    const makeEye = (url) => {
        const isHidden = state.gallery.hiddenImages.has(url);
        const eye = document.createElement('button');
        eye.className = 'gv2-layer-eye';
        eye.title = isHidden ? 'Show' : 'Hide';
        eye.textContent = isHidden ? '🚫' : '👁';
        eye.onclick = (e) => {
            e.stopPropagation();
            if (state.gallery.hiddenImages.has(url)) state.gallery.hiddenImages.delete(url);
            else state.gallery.hiddenImages.add(url);
            renderLayerPanel();
            if (state.gallery.hiddenImages.has((state.gallery.images || [])[state.gallery.currentIndex])) {
                const nxt = (state.gallery.images || []).findIndex(u => !state.gallery.hiddenImages.has(u));
                if (nxt >= 0) { state.gallery.currentIndex = nxt; renderGallery(); }
            }
        };
        return eye;
    };

    // Forward order: first image at top
    images.forEach((url, globalIdx) => {
        const isHidden = state.gallery.hiddenImages.has(url);
        const isActive = globalIdx === state.gallery.currentIndex;
        const posNum = globalIdx + 1; // 1-based

        // Check if group parent
        const ownerTrade = getOwnerTradeForImageUrl(url);
        let subImages = [];
        let groupName = null;
        if (ownerTrade?.subImages?.[url]?.length > 0) {
            subImages = ownerTrade.subImages[url];
            groupName = ownerTrade.groupNames?.[url] || null;
        } else if (dayDate && state.dayData[dayDate]?.subImages?.[url]?.length > 0) {
            subImages = state.dayData[dayDate].subImages[url];
            groupName = state.dayData[dayDate].groupNames?.[url] || null;
        }

        const item = document.createElement('div');
        item.className = 'gv2-layer-item' + (isActive ? ' active-layer' : '') + (isHidden ? ' hidden-layer' : '');
        item.draggable = true;
        item.dataset.globalIdx = globalIdx;

        const handle = document.createElement('span');
        handle.className = 'gv2-layer-drag-handle';
        handle.textContent = '⠿';

        const thumb = document.createElement('img');
        thumb.className = 'gv2-layer-thumb';
        thumb.src = url; thumb.loading = 'lazy';

        const name = document.createElement('span');
        name.className = 'gv2-layer-name';
        name.title = url.split('/').pop().split('?')[0];
        if (subImages.length > 0) {
            name.textContent = groupName ? `${posNum}. ${groupName}` : `${posNum}. Group`;
            name.style.color = 'var(--orange, #ff9800)';
            name.style.fontWeight = 'bold';
        } else {
            name.textContent = String(posNum);
        }

        const del = document.createElement('button');
        del.className = 'gv2-layer-del';
        del.title = 'Delete image'; del.textContent = '🗑';
        del.onclick = async (e) => { e.stopPropagation(); await removeGalleryImageAt(globalIdx); };

        item.appendChild(handle);
        item.appendChild(makeEye(url));
        item.appendChild(thumb);
        item.appendChild(name);
        item.appendChild(del);

        item.addEventListener('click', () => {
            state.gallery.currentIndex = globalIdx;
            renderGallery(); renderLayerPanel();
        });
        // Double-click to rename group (or show info for regular images)
        name.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            if (subImages.length > 0) {
                // Rename group
                const ownerRef = ownerTrade || (dayDate && state.dayData[dayDate]) || null;
                if (!ownerRef) return;
                const currentName = groupName || '';
                const newName = prompt('Rename group:', currentName);
                if (newName !== null) {
                    ownerRef.groupNames = ownerRef.groupNames || {};
                    if (newName.trim() === '') delete ownerRef.groupNames[url];
                    else ownerRef.groupNames[url] = newName.trim();
                    saveTrades(); renderGallery(); renderLayerPanel();
                }
            }
        });
        item.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', String(globalIdx)); item.style.opacity = '0.5'; });
        item.addEventListener('dragend', () => { item.style.opacity = ''; item.classList.remove('drop-above', 'drop-below'); });
        item.addEventListener('dragover', e => {
            e.preventDefault();
            const rect = item.getBoundingClientRect();
            item.classList.toggle('drop-above', e.clientY - rect.top < rect.height / 2);
            item.classList.toggle('drop-below', e.clientY - rect.top >= rect.height / 2);
            item.dataset._dropBefore = (e.clientY - rect.top < rect.height / 2) ? '1' : '0';
        });
        item.addEventListener('dragleave', () => { item.classList.remove('drop-above', 'drop-below'); });
        item.addEventListener('drop', async e => {
            e.preventDefault();
            item.classList.remove('drop-above', 'drop-below');
            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
            const dropBefore = item.dataset._dropBefore === '1';
            if (!isNaN(fromIdx) && fromIdx !== globalIdx) {
                // Calculate where to insert
                const toIdx = dropBefore
                    ? (fromIdx > globalIdx ? globalIdx : Math.max(0, globalIdx - 1))
                    : (fromIdx < globalIdx ? globalIdx : Math.min((state.gallery.images || []).length - 1, globalIdx + 1));
                await reorderGalleryImages(fromIdx, toIdx); renderLayerPanel();
            }
        });

        list.appendChild(item);

        // Sub-images under this group (forward order)
        if (subImages.length > 0) {
            subImages.forEach((subUrl, subIdx) => {
                const subNum = `${posNum}.${subIdx + 1}`;
                const subHidden = state.gallery.hiddenImages.has(subUrl);

                const subItem = document.createElement('div');
                subItem.className = 'gv2-layer-item gv2-layer-subitem' + (subHidden ? ' hidden-layer' : '');

                const subIndent = document.createElement('span');
                subIndent.style.width = '12px'; subIndent.style.display = 'inline-block'; subIndent.style.flexShrink = '0';

                const subThumb = document.createElement('img');
                subThumb.className = 'gv2-layer-thumb';
                subThumb.src = subUrl; subThumb.loading = 'lazy';

                const subName = document.createElement('span');
                subName.className = 'gv2-layer-name';
                subName.textContent = subNum;
                subName.title = subUrl.split('/').pop().split('?')[0];

                const subDel = document.createElement('button');
                subDel.className = 'gv2-layer-del'; subDel.title = 'Remove from group'; subDel.textContent = '🗑';
                subDel.onclick = async (e) => {
                    e.stopPropagation();
                    const ot = getOwnerTradeForImageUrl(subUrl);
                    const removeFromSubs = (obj) => {
                        if (!obj?.subImages) return false;
                        for (const [pUrl, subs] of Object.entries(obj.subImages)) {
                            if (subs.includes(subUrl)) {
                                obj.subImages[pUrl] = subs.filter(u => u !== subUrl);
                                if (obj.subImages[pUrl].length === 0) delete obj.subImages[pUrl];
                                return true;
                            }
                        }
                        return false;
                    };
                    if (ot) removeFromSubs(ot); else if (dayDate && state.dayData[dayDate]) removeFromSubs(state.dayData[dayDate]);
                    // Also remove from gallery.images (if group was expanded)
                    state.gallery.images = (state.gallery.images || []).filter(u => u !== subUrl);
                    if (state.gallery.currentIndex >= state.gallery.images.length)
                        state.gallery.currentIndex = Math.max(0, state.gallery.images.length - 1);
                    await saveTrades(); renderLayerPanel(); renderGallery();
                };

                subItem.appendChild(subIndent);
                subItem.appendChild(makeEye(subUrl));
                subItem.appendChild(subThumb);
                subItem.appendChild(subName);
                subItem.appendChild(subDel);

                subItem.addEventListener('click', () => {
                    // Expand parent group and navigate to sub-image
                    if (!state.gallery.expandedGroups?.has(url)) toggleGalleryGroupExpand(url);
                    const newIdx = (state.gallery.images || []).indexOf(subUrl);
                    if (newIdx >= 0) { state.gallery.currentIndex = newIdx; renderGallery(); renderLayerPanel(); }
                });

                list.appendChild(subItem);
            });
        }
    });
}

function toggleLayerPanel() {
    const panel = document.getElementById('gv2-layer-panel');
    const btn = document.getElementById('gv2-layer-btn');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'flex';
    if (btn) btn.classList.toggle('active', !isOpen);
    if (!isOpen) renderLayerPanel();
    state.gallery.layerPanelOpen = !isOpen;
}

const GV2_SHORTCUTS_LIST = [
    { key: 'L / R', desc: 'Previous / next image' },
    { key: 'Shift+L/R', desc: 'Previous / next day' },
    { key: 'Esc', desc: 'Close gallery' },
    { key: 'Ctrl+L/R', desc: 'Expand / collapse group' },
    { key: 'Alt+G', desc: 'Group selected images (or all)' },
    { key: 'Shift+G', desc: 'Ungroup selected group (or all)' },
    { key: 'Shift+Click', desc: 'Multi-select thumbnail' },
    { key: 'Shift+Alt+L/R', desc: 'Select prev/next tile' },
    { key: 'Ctrl+Shift+L/R', desc: 'Move tile left/right' },
    { key: 'ContextMenu', desc: 'Open context menu' },
    { key: 'L', desc: 'Toggle layers panel' },
    { key: 'A', desc: 'Toggle annotation' },
    { key: 'M', desc: 'Marquee mode' },
    { key: 'F', desc: 'Tag filter' },
    { key: 'D', desc: 'Date picker' },
    { key: 'H', desc: 'Show heads' },
    { key: 'I', desc: 'Import image' },
    { key: 'R', desc: 'Reset zoom' },
    { key: 'Alt+T', desc: 'Image tag manager' },
];

function renderShortcutsPopover() {
    const pop = document.getElementById('gv2-shortcuts-popover');
    if (!pop) return;
    pop.innerHTML = '';
    GV2_SHORTCUTS_LIST.forEach(({ key, desc }) => {
        const row = document.createElement('div');
        row.className = 'sc-row';
        row.innerHTML = `<span class="sc-desc">${desc}</span><span class="sc-key">${key}</span>`;
        pop.appendChild(row);
    });
    // Footer: link to settings
    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top:8px;padding-top:6px;border-top:1px solid var(--border);text-align:right;';
    const editBtn = document.createElement('button');
    editBtn.textContent = '⚙ Edit in Settings';
    editBtn.style.cssText = 'background:none;border:none;color:var(--blue,#4a9eff);cursor:pointer;font-size:0.78rem;padding:0;';
    editBtn.onclick = () => {
        pop.style.display = 'none';
        const settingsOverlay = document.getElementById('settings-overlay');
        if (settingsOverlay) {
            settingsOverlay.classList.add('open');
            // Scroll to shortcuts section
            setTimeout(() => {
                const sc = settingsOverlay.querySelector('[data-section="shortcuts"], #shortcuts-section, .shortcuts-section');
                if (sc) sc.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    };
    footer.appendChild(editBtn);
    pop.appendChild(footer);
}

function renderGalleryVideoUrls() {
    const container = document.getElementById('gv2-video-url-list');
    const trayElem = document.getElementById('gv2-video-url-tray');
    if (!container || !trayElem) return;

    const ctx = getCurrentGalleryPreserveContext();
    const dateToUse = state.gallery.date || ctx.date;

    if (!dateToUse) {
        trayElem.style.display = 'none';
        return;
    }

    const dayTrades = getTradesForDate(dateToUse);
    if (!dayTrades || dayTrades.length === 0) {
        trayElem.style.display = 'none';
        return;
    }

    trayElem.style.display = 'block';
    container.innerHTML = '';

    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '8px';
    container.style.padding = '4px 0';
    container.style.marginBottom = '12px';

    dayTrades.forEach((trade, idx) => {
        const hasVideo = !!(trade[VIDEO_COLUMN] && trade[VIDEO_COLUMN].trim());

        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '4px';

        const circleBtn = document.createElement('div');
        circleBtn.style.width = '28px';
        circleBtn.style.height = '28px';
        circleBtn.style.borderRadius = '50%';
        circleBtn.style.display = 'flex';
        circleBtn.style.alignItems = 'center';
        circleBtn.style.justifyContent = 'center';
        circleBtn.style.fontSize = '12px';
        circleBtn.style.fontWeight = '600';
        circleBtn.style.cursor = 'pointer';
        circleBtn.style.transition = 'all 0.2s';
        circleBtn.textContent = String(idx + 1);

        if (hasVideo) {
            circleBtn.style.background = 'var(--blue)';
            circleBtn.style.color = '#fff';
            circleBtn.style.boxShadow = '0 0 6px rgba(41, 121, 255, 0.4)';
            circleBtn.title = `Trade ${idx + 1} Video\nClick to open link\nRight-click to edit URL`;
        } else {
            circleBtn.style.background = 'transparent';
            circleBtn.style.border = '1.5px dashed var(--text2)';
            circleBtn.style.color = 'var(--text2)';
            circleBtn.title = `Trade ${idx + 1}\nClick to add video URL`;
        }

        circleBtn.addEventListener('mouseenter', () => {
            if (!hasVideo) {
                circleBtn.style.border = '1.5px dashed var(--text)';
                circleBtn.style.color = 'var(--text)';
            } else {
                circleBtn.style.filter = 'brightness(1.1)';
            }
        });

        circleBtn.addEventListener('mouseleave', () => {
            if (!hasVideo) {
                circleBtn.style.border = '1.5px dashed var(--text2)';
                circleBtn.style.color = 'var(--text2)';
            } else {
                circleBtn.style.filter = '';
            }
        });

        circleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentUrl = trade[VIDEO_COLUMN] || '';
            if (hasVideo) {
                window.open(currentUrl, '_blank');
            } else {
                const inputUrl = prompt(`Enter Video URL for Trade ${idx + 1} (or paste and hit Enter):`, currentUrl);
                if (inputUrl !== null) {
                    trade[VIDEO_COLUMN] = inputUrl.trim();
                    saveTrades();
                    renderGalleryVideoUrls();
                    if (typeof renderTable === 'function') renderTable();
                }
            }
        });

        circleBtn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const currentUrl = trade[VIDEO_COLUMN] || '';
            const inputUrl = prompt(`Edit Video URL for Trade ${idx + 1}:`, currentUrl);
            if (inputUrl !== null) {
                trade[VIDEO_COLUMN] = inputUrl.trim();
                saveTrades();
                renderGalleryVideoUrls();
                if (typeof renderTable === 'function') renderTable();
            }
        });

        const netPLNum = parseFloat(trade['Net P/L']);
        const plLabel = document.createElement('div');
        plLabel.style.fontSize = '0.65rem';
        plLabel.style.fontWeight = '600';
        if (!isNaN(netPLNum)) {
            plLabel.textContent = Math.round(Math.abs(netPLNum));
            plLabel.style.color = netPLNum >= 0 ? 'var(--green)' : 'var(--red)';
        } else {
            plLabel.textContent = '0';
            plLabel.style.color = 'var(--text2)';
        }

        wrapper.appendChild(circleBtn);
        wrapper.appendChild(plLabel);

        container.appendChild(wrapper);
    });
}

```

## File: `static\js\gallery-tags.js`
```js
function renderGalleryTagCloud() {
  const chips = document.getElementById('gv2-tag-cloud-chips');
  const modeBtn = document.getElementById('gv2-tc-mode-btn');
  const clearBtn = document.getElementById('gv2-tc-clear-btn');
  if (!chips) return;
  chips.innerHTML = '';

  const info = getCurrentGalleryImageTagInfo();
  const availableSet = new Set(info.all);
  const allTagNames = info.all;
  const selected = state.gallery.tagFilter || [];
  state.gallery.tagFilter = selected.filter(t => availableSet.has(t));
  const grouped = state.tagGroups || {};

  const renderChip = (tag) => {
    const chip = document.createElement('span');
    chip.className = 'gv2-tc-chip' + (state.gallery.tagFilter.includes(tag) ? ' selected' : '');
    chip.textContent = tag;
    chip.addEventListener('click', () => {
      const idx = state.gallery.tagFilter.indexOf(tag);
      if (idx === -1) state.gallery.tagFilter.push(tag);
      else state.gallery.tagFilter.splice(idx, 1);
      renderGalleryTagCloud();
      renderGallery();
    });
    chips.appendChild(chip);
  };

  Object.keys(grouped).forEach(g => {
    const tags = (grouped[g] || []).filter(t => availableSet.has(t));
    if (!tags.length) return;
    const lbl = document.createElement('span');
    lbl.className = 'gv2-tc-group';
    lbl.textContent = g;
    chips.appendChild(lbl);
    tags.forEach(renderChip);
  });
  const groupedTags = new Set(Object.values(grouped).flat());
  const ungrouped = allTagNames.filter(t => !groupedTags.has(t));
  if (ungrouped.length) {
    const lbl = document.createElement('span');
    lbl.className = 'gv2-tc-group';
    lbl.textContent = 'Ungrouped';
    chips.appendChild(lbl);
    ungrouped.forEach(renderChip);
  }
  if (!allTagNames.length) {
    const hint = document.createElement('span');
    hint.className = 'gv2-tc-group';
    hint.textContent = 'No tags on this image';
    chips.appendChild(hint);
  }

  const hasFilter = (state.gallery.tagFilter || []).length > 0;
  if (modeBtn) {
    const isAnd = state.gallery.filterMode === 'and';
    modeBtn.textContent = isAnd ? 'AND' : 'OR';
    modeBtn.classList.toggle('and-mode', isAnd);
  }
  if (clearBtn) clearBtn.style.display = hasFilter ? '' : 'none';
}

function renderGalleryTagsTray() {
  const body = document.getElementById('gv2-tags-tray-body');
  if (!body) return;
  body.innerHTML = '';

  const allTags = state.allTags || [];
  const imgInfo = getCurrentGalleryImageTagInfo();
  const imageAssignedSet = new Set(imgInfo.imageTags);
  const selectedMarqueeTagSet = getSelectedMarqueeTagSet();
  const marqueeMode = isMarqueeSelectionActive();
  const currentImageTagSet = marqueeMode ? selectedMarqueeTagSet : new Set(imgInfo.all);
  refreshMarqueeTagSuggestions();
  const groups = state.tagGroups || {};
  const groupNames = Object.keys(groups);
  const deleteMode = !!state.tagDeleteMode;
  const delBtn = document.getElementById('gv2-del-tag-btn');
  if (delBtn) delBtn.classList.toggle('active', deleteMode);
  let draggingTag = '';
  const tagUsageCount = new Map();
  const bumpTagCount = (tag) => {
    const t = String(tag || '').trim();
    if (!t) return;
    tagUsageCount.set(t, (tagUsageCount.get(t) || 0) + 1);
  };
  state.trades.forEach((tr, rowIdx) => {
    const dateKey = normalizeDate(extractDateFromTrade(tr));
    (tr.images || []).forEach(url => {
      getImageTagsForUrl(tr, url).forEach(bumpTagCount);
      const boxes = tr?.marqueeBoxes?.[url];
      (Array.isArray(boxes) ? boxes : []).forEach(b => (Array.isArray(b?.tags) ? b.tags : []).forEach(bumpTagCount));
      if (!boxes) getMarqueeTagsForImage(url, dateKey, rowIdx).forEach(bumpTagCount);
    });
  });
  Object.entries(state.dayData || {}).forEach(([dateKey, day]) => {
    (day?.images || []).forEach(url => {
      getDayImageTagsForUrl(dateKey, url).forEach(bumpTagCount);
      const boxes = day?.marqueeBoxes?.[url];
      (Array.isArray(boxes) ? boxes : []).forEach(b => (Array.isArray(b?.tags) ? b.tags : []).forEach(bumpTagCount));
      if (!boxes) getMarqueeTagsForImage(url, dateKey, null).forEach(bumpTagCount);
    });
  });

  Array.from(tagUsageCount.keys()).forEach(t => {
    if (!state.allTags.includes(t)) state.allTags.push(t);
  });

  const normalizeGroups = () => {
    const valid = new Set(allTags);
    Object.keys(state.tagGroups).forEach(g => {
      state.tagGroups[g] = Array.from(new Set((state.tagGroups[g] || []).filter(t => valid.has(t))));
    });
  };

  const toggleTagFilter = (tag) => {
    const idx = state.gallery.tagFilter.indexOf(tag);
    if (idx === -1) state.gallery.tagFilter.push(tag);
    else state.gallery.tagFilter.splice(idx, 1);
    renderGalleryTagCloud();
    renderGallery();
  };

  const moveTagToGroup = (tag, targetGroup = '') => {
    Object.keys(state.tagGroups).forEach(g => {
      state.tagGroups[g] = (state.tagGroups[g] || []).filter(t => t !== tag);
    });
    if (targetGroup) {
      if (!state.tagGroups[targetGroup]) state.tagGroups[targetGroup] = [];
      if (!state.tagGroups[targetGroup].includes(tag)) state.tagGroups[targetGroup].push(tag);
    }
    saveTagGroups();
    renderGalleryTagsTray();
  };

  const createTagChip = (tag, grpName = '') => {
    const chip = document.createElement('span');
    chip.className = 'gv2-tt-tag-chip';
    const countVal = tagUsageCount.get(tag) || 0;
    const isFreq = countVal > 5;
    const lbl = document.createElement('span');
    lbl.textContent = tag;
    if (isFreq) lbl.style.color = '#ff6b6b';
    const cnt = document.createElement('span');
    cnt.className = 'gv2-tt-tag-count';
    cnt.textContent = String(countVal);
    if (isFreq) cnt.style.color = '#ff6b6b';
    chip.appendChild(lbl);
    chip.appendChild(cnt);
    if (currentImageTagSet.has(tag)) chip.classList.add('selected-on-image');
    if (marqueeMode) {
      if (currentImageTagSet.has(tag)) chip.title = 'Tag on selected marquee';
      else chip.title = 'Add to selected marquee';
    } else if (imageAssignedSet.has(tag)) chip.title = 'Image tag assigned';
    else if (currentImageTagSet.has(tag)) chip.title = 'Marquee tag present on this image';
    chip.setAttribute('draggable', 'true');
    chip.addEventListener('click', async () => {
      if (state.tagDeleteMode) {
        deleteImageTagGlobal(tag);
        state.allTags = (state.allTags || []).filter(t => t !== tag);
        Object.keys(state.tagGroups).forEach(g => {
          state.tagGroups[g] = (state.tagGroups[g] || []).filter(t => t !== tag);
        });
        saveTagGroups();
        await saveTrades();
        renderGalleryTagCloud();
        renderGalleryTagsTray();
        renderTable();
        renderCalendar();
        return;
      }
      if (marqueeMode) {
        if (!toggleTagOnSelectedMarquees(tag)) return;
        renderGalleryImageTags();
        renderGalleryTagCloud();
        renderGalleryTagsTray();
        return;
      }
      if (!imgInfo.imgUrl) {
        showToast('No image row found to assign tag', 'error');
        return;
      }
      const next = imageAssignedSet.has(tag)
        ? imgInfo.imageTags.filter(t => t !== tag)
        : [...imgInfo.imageTags, tag];
      if (imgInfo.ownerType === 'trade' && imgInfo.trade) setImageTagsForUrl(imgInfo.trade, imgInfo.imgUrl, next);
      else if (imgInfo.ownerType === 'day' && imgInfo.dateKey) setDayImageTagsForUrl(imgInfo.dateKey, imgInfo.imgUrl, next);
      else {
        showToast('No image row found to assign tag', 'error');
        return;
      }
      normalizeAllTagsFromTrades();
      await saveTrades();
      renderGalleryImageTags();
      renderGalleryTagCloud();
      renderGalleryTagsTray();
      renderTable();
      renderCalendar();
    });
    chip.addEventListener('dragstart', e => {
      draggingTag = tag;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', tag);
      chip.classList.add('dragging');
    });
    chip.addEventListener('dragend', () => {
      draggingTag = '';
      chip.classList.remove('dragging');
    });
    chip.addEventListener('contextmenu', e => {
      const availableGroups = Object.keys(state.tagGroups).filter(g => !(state.tagGroups[g] || []).includes(tag));
      const inGroups = Object.keys(state.tagGroups).filter(g => (state.tagGroups[g] || []).includes(tag));
      const items = [
        {
          label: '✏ Rename tag', action: () => {
            const newTag = prompt('Rename tag:', tag);
            if (newTag && newTag.trim() && newTag.trim() !== tag) renameTagEverywhere(tag, newTag.trim());
          }
        },
        {
          label: '🗑 Delete globally', action: async () => {
            if (confirm(`Delete tag "${tag}" globally from all images and records?`)) {
              if (typeof deleteImageTagGlobal === 'function') {
                deleteImageTagGlobal(tag);
                state.allTags = (state.allTags || []).filter(t => t !== tag);
                Object.keys(state.tagGroups).forEach(g => {
                  state.tagGroups[g] = (state.tagGroups[g] || []).filter(t => t !== tag);
                });
                saveTagGroups();
                await saveTrades();
                renderGalleryTagCloud();
                renderGalleryTagsTray();
                renderTable();
                renderCalendar();
              }
            }
          }
        }
      ];
      if (availableGroups.length) {
        items.push('sep');
        items.push({ header: 'Move to group:' });
        availableGroups.forEach(g => items.push({ label: '→ ' + g, action: () => moveTagToGroup(tag, g) }));
      }
      if (inGroups.length) {
        items.push('sep');
        items.push({ label: '✕ Remove from group', action: () => moveTagToGroup(tag, '') });
      }
      showCtxMenu(e, items);
    });
    return chip;
  };

  const bindDropTarget = (el, targetGroup = '') => {
    el.addEventListener('dragover', e => {
      e.preventDefault();
      el.classList.add('drop-hover');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drop-hover'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('drop-hover');
      const tag = draggingTag || e.dataTransfer.getData('text/plain');
      if (!tag || !allTags.includes(tag)) return;
      moveTagToGroup(tag, targetGroup);
    });
  };

  normalizeGroups();

  const topTags = Array.from(tagUsageCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0])
    .slice(0, 8);

  if (topTags.length > 0) {
    const grpF = document.createElement('div');
    grpF.className = 'gv2-tt-group';
    const hdr = document.createElement('div');
    hdr.className = 'gv2-tt-grp-hdr';
    const lbl = document.createElement('span');
    lbl.textContent = '★ FREQUENT TAGS';
    lbl.style.color = '#ffb347';
    lbl.style.fontWeight = 'bold';
    hdr.appendChild(lbl);
    grpF.appendChild(hdr);
    const wrap = document.createElement('div');
    wrap.className = 'gv2-tt-wrap';
    topTags.forEach(t => wrap.appendChild(createTagChip(t, '')));
    grpF.appendChild(wrap);
    body.appendChild(grpF);
  }

  groupNames.forEach(grpName => {
    const grp = document.createElement('div');
    grp.className = 'gv2-tt-group';

    const hdr = document.createElement('div');
    hdr.className = 'gv2-tt-grp-hdr';
    const lbl = document.createElement('span');
    lbl.textContent = grpName;
    lbl.title = 'Right-click to rename';
    lbl.style.cursor = 'pointer';
    lbl.style.color = '#58a6ff';
    lbl.style.fontWeight = 'bold';
    lbl.addEventListener('contextmenu', e => {
      showCtxMenu(e, [{
        label: '✏ Rename group', action: () => {
          const newName = prompt('Rename group:', grpName);
          if (!newName || !newName.trim() || newName.trim() === grpName) return;
          const n = newName.trim();
          if (state.tagGroups[n] && n !== grpName) { showToast('Group already exists', 'error'); return; }
          state.tagGroups[n] = state.tagGroups[grpName] || [];
          if (n !== grpName) delete state.tagGroups[grpName];
          saveTagGroups();
          renderGalleryTagsTray();
        }
      }]);
    });
    const delBtn = document.createElement('button');
    delBtn.className = 'gv2-tt-grp-del';
    delBtn.textContent = '✕';
    delBtn.title = 'Delete group';
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm(`Delete group "${grpName}"? Tags will become ungrouped.`)) {
        delete state.tagGroups[grpName];
        saveTagGroups();
        renderGalleryTagsTray();
      }
    });
    hdr.appendChild(lbl);
    hdr.appendChild(delBtn);

    const tagWrap = document.createElement('div');
    tagWrap.className = 'gv2-tt-grp-tags';
    bindDropTarget(grp, grpName);
    bindDropTarget(tagWrap, grpName);

    const tags = (groups[grpName] || []).filter(t => allTags.includes(t));
    tags.forEach(tag => tagWrap.appendChild(createTagChip(tag, grpName)));
    if (!tags.length) {
      const hint = document.createElement('div');
      hint.className = 'gv2-tt-drop-hint';
      hint.textContent = 'Drop tags here';
      tagWrap.appendChild(hint);
    }

    grp.appendChild(hdr);
    grp.appendChild(tagWrap);
    body.appendChild(grp);
  });

  const groupedTags = new Set(Object.values(state.tagGroups).flat());
  const ungroupedTags = allTags.filter(t => !groupedTags.has(t));
  const sec = document.createElement('div');
  sec.className = 'gv2-tt-unassigned';
  const lbl = document.createElement('div');
  lbl.className = 'gv2-tt-unassigned-lbl';
  lbl.textContent = 'Ungrouped';
  const wrap = document.createElement('div');
  wrap.className = 'gv2-tt-grp-tags';
  bindDropTarget(sec, '');
  bindDropTarget(wrap, '');
  ungroupedTags.forEach(tag => wrap.appendChild(createTagChip(tag)));
  if (!ungroupedTags.length) {
    const hint = document.createElement('div');
    hint.className = 'gv2-tt-drop-hint';
    hint.textContent = 'Drop tags here';
    wrap.appendChild(hint);
  }
  sec.appendChild(lbl);
  sec.appendChild(wrap);
  body.appendChild(sec);

  if (!allTags.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--text3);font-size:0.78rem;padding:8px';
    empty.textContent = 'No tags created yet.';
    body.appendChild(empty);
  }
}



```

## File: `static\js\gallery-tags-filter.js`
```js
function renderGalleryTagFilterPanel() {
    const panel = document.getElementById('gallery-img-tag-filter-panel');
    if (!panel) return;
    panel.innerHTML = '';

    const allTags = state.allTags || [];
    if (!allTags.length) {
        panel.innerHTML = '<p class="panel-hint" style="padding:10px 8px">No tags yet.</p>';
        const btn = document.getElementById('gallery-img-tag-filter-btn');
        if (btn) {
            btn.style.borderColor = '';
            btn.style.color = '';
        }
        return;
    }

    const searchRow = document.createElement('div');
    searchRow.className = 'panel-search-row';
    const searchInp = document.createElement('input');
    searchInp.className = 'panel-search';
    searchInp.placeholder = 'Search tags...';
    searchRow.appendChild(searchInp);
    panel.appendChild(searchRow);

    const tagUsageCount = new Map();
    const bumpTagCount = (tag) => {
        const t = String(tag || '').trim();
        if (!t) return;
        tagUsageCount.set(t, (tagUsageCount.get(t) || 0) + 1);
    };
    state.trades.forEach((tr, rowIdx) => {
        const dateKey = normalizeDate(extractDateFromTrade(tr));
        (tr.images || []).forEach(url => {
            getImageTagsForUrl(tr, url).forEach(bumpTagCount);
            const boxes = tr?.marqueeBoxes?.[url];
            (Array.isArray(boxes) ? boxes : []).forEach(b => (Array.isArray(b?.tags) ? b.tags : []).forEach(bumpTagCount));
            if (!boxes) getMarqueeTagsForImage(url, dateKey, rowIdx).forEach(bumpTagCount);
        });
    });
    Object.entries(state.dayData || {}).forEach(([dateKey, day]) => {
        (day?.images || []).forEach(url => {
            getDayImageTagsForUrl(dateKey, url).forEach(bumpTagCount);
            const boxes = day?.marqueeBoxes?.[url];
            (Array.isArray(boxes) ? boxes : []).forEach(b => (Array.isArray(b?.tags) ? b.tags : []).forEach(bumpTagCount));
            if (!boxes) getMarqueeTagsForImage(url, dateKey, null).forEach(bumpTagCount);
        });
    });
    window._tagCountMap = tagUsageCount;

    const actRow = document.createElement('div');
    actRow.className = 'panel-act-row';
    const btnNone = document.createElement('button');
    btnNone.className = 'panel-act-btn';
    btnNone.textContent = 'Clear Filter';
    btnNone.addEventListener('click', () => {
        state.gallery.tagFilter = [];
        applyGalleryImageScopeByTagFilter();
        renderGallery();
        renderGalleryTagCloud();
        renderGalleryTagFilterPanel(); // Re-render to clear checkboxes
    });
    actRow.appendChild(btnNone);
    panel.appendChild(actRow);

    const list = document.createElement('div');
    list.className = 'panel-list';

    // Extract render logic to handle searching
    const renderFilterList = (query) => {
        list.innerHTML = '';
        const ql = (query || '').toLowerCase();

        const groups = state.tagGroups || {};
        const groupNames = Object.keys(groups);
        const renderedTags = new Set();

        const renderListTag = (tag) => {
            if (ql && !tag.toLowerCase().includes(ql)) return;
            if (renderedTags.has(tag)) return;
            renderedTags.add(tag);
            const lbl = document.createElement('label');
            lbl.className = 'head-checkbox';

            function _tagColor(name) {
                const TAG_PALETTE = ['#3fb950', '#58a6ff', '#d29922', '#bc8cff', '#f85149', '#79b8ff', '#56d364', '#ffa657'];
                let h = 0;
                for (let i = 0; i < name.length; i++) h = ((h << 5) - h) + name.charCodeAt(i);
                return TAG_PALETTE[Math.abs(h) % TAG_PALETTE.length];
            }

            const dot = document.createElement('span');
            dot.className = 'tag-dot';
            dot.style.background = _tagColor(tag);

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.includes(tag);
            chk.addEventListener('change', () => {
                let filter = Array.isArray(state.gallery.tagFilter) ? state.gallery.tagFilter : [];
                if (chk.checked) {
                    if (!filter.includes(tag)) filter.push(tag);
                } else {
                    filter = filter.filter(t => t !== tag);
                }
                state.gallery.tagFilter = filter;
                applyGalleryImageScopeByTagFilter();
                renderGallery();
                renderGalleryTagCloud();
                _updateFilterBtnColor();
            });

            lbl.appendChild(chk);
            lbl.appendChild(dot);

            const tl = document.createElement('span');
            tl.textContent = tag;
            tl.style.flex = 1;
            lbl.appendChild(tl);

            if (window._tagCountMap && window._tagCountMap.has(tag)) {
                const cnt = document.createElement('span');
                cnt.className = 'gv2-tt-tag-count';
                cnt.textContent = String(window._tagCountMap.get(tag));
                cnt.style.marginLeft = '8px';
                lbl.appendChild(cnt);
            }

            list.appendChild(lbl);
        };

        const topTags = Array.from(window._tagCountMap.entries())
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0])
            .slice(0, 8);

        if (topTags.length > 0) {
            const filteredTop = ql ? topTags.filter(t => t.toLowerCase().includes(ql)) : topTags;
            if (filteredTop.length) {
                const gLbl = document.createElement('div');
                gLbl.className = 'panel-manage-label';
                gLbl.style.marginTop = '6px';
                gLbl.style.color = '#ffb347';
                gLbl.textContent = '★ FREQUENT TAGS';
                list.appendChild(gLbl);
                filteredTop.forEach(renderListTag);
            }
        }

        groupNames.forEach(grpName => {
            const tags = (groups[grpName] || []).filter(t => allTags.includes(t));
            const filteredTags = ql ? tags.filter(t => t.toLowerCase().includes(ql)) : tags;
            if (filteredTags.length && filteredTags.some(t => !renderedTags.has(t))) {
                const gLbl = document.createElement('div');
                gLbl.className = 'panel-manage-label';
                gLbl.style.marginTop = '6px';
                gLbl.textContent = grpName;
                list.appendChild(gLbl);
                filteredTags.forEach(renderListTag);
            }
        });

        const ungroupedTags = allTags.filter(t => !renderedTags.has(t));
        const filteredUngrouped = ql ? ungroupedTags.filter(t => t.toLowerCase().includes(ql)) : ungroupedTags;
        if (filteredUngrouped.length) {
            if (groupNames.length || topTags.length) {
                const gLbl = document.createElement('div');
                gLbl.className = 'panel-manage-label';
                gLbl.style.marginTop = '6px';
                gLbl.textContent = 'Ungrouped';
                list.appendChild(gLbl);
            }
            filteredUngrouped.forEach(renderListTag);
        }
    };

    renderFilterList('');
    searchInp.addEventListener('input', () => {
        renderFilterList(searchInp.value);
    });

    searchInp.addEventListener('keydown', e => {
        const items = Array.from(list.querySelectorAll('.head-checkbox'));
        if (!items.length) return;

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            let activeIdx = items.findIndex(item => item.classList.contains('active-filter-item'));

            if (activeIdx >= 0) items[activeIdx].classList.remove('active-filter-item');

            if (e.key === 'ArrowDown') {
                activeIdx = activeIdx < items.length - 1 ? activeIdx + 1 : 0;
            } else {
                activeIdx = activeIdx > 0 ? activeIdx - 1 : items.length - 1;
            }

            items[activeIdx].classList.add('active-filter-item');
            items[activeIdx].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const activeItem = list.querySelector('.head-checkbox.active-filter-item') || items[0];
            if (activeItem) {
                const chk = activeItem.querySelector('input[type="checkbox"]');
                if (chk) {
                    chk.checked = !chk.checked;
                    chk.dispatchEvent(new Event('change'));
                }
            }
        }
    });

    panel.appendChild(list);
    _updateFilterBtnColor();

    function _updateFilterBtnColor() {
        const btn = document.getElementById('gallery-img-tag-filter-btn');
        if (btn) {
            const hasFilter = Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length > 0;
            btn.style.borderColor = hasFilter ? 'var(--blue)' : 'var(--border)';
            btn.style.color = hasFilter ? 'var(--blue)' : '';
        }
    }
}

```

## File: `static\js\gallery-img-tags.js`
```js
function renderGalleryImageTags() {
  const box = document.getElementById('gallery-image-tags');
  if (!box) return;
  box.innerHTML = '';

  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  const info = getCurrentGalleryImageTagInfo();
  const tags = info.imageTags || [];
  const marqueeTags = info.marqueeTags || [];

  if (!tags.length && !marqueeTags.length) {
    const hint = document.createElement('span');
    hint.className = 'gallery-tag-empty';
    hint.textContent = 'No image/marquee tags';
    box.appendChild(hint);
    return;
  }

  if (tags.length) {
    const imgLbl = document.createElement('span');
    imgLbl.className = 'gallery-tag-empty';
    imgLbl.textContent = 'Image:';
    box.appendChild(imgLbl);
    tags.forEach(tag => {
      const isRed = tags.length > 5;
      const c = isRed ? '#ff6b6b' : tagColor(tag);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'gallery-img-tag-chip';
      chip.textContent = `${tag} x`;
      chip.style.color = c;
      chip.style.borderColor = hexToRgba(c, 0.45);
      chip.style.background = isRed ? 'rgba(255, 107, 107, 0.16)' : hexToRgba(c, 0.16);
      chip.title = 'Remove tag from this image';
      chip.addEventListener('click', async () => {
        window._lastDeletedImageTag = { tag, imgUrl, ownerType: info.ownerType, trade: info.trade, dateKey: info.dateKey, origTags: [...tags] };
        const next = tags.filter(t => t !== tag);
        if (info.ownerType === 'trade' && info.trade) setImageTagsForUrl(info.trade, imgUrl, next);
        else if (info.ownerType === 'day' && info.dateKey) setDayImageTagsForUrl(info.dateKey, imgUrl, next);
        await saveTrades();
        renderGalleryImageTags();
        renderTable();
        renderCalendar();
      });
      box.appendChild(chip);
    });
  }

  if (marqueeTags.length) {
    if (tags.length) box.appendChild(document.createTextNode(' '));
    const mqLbl = document.createElement('span');
    mqLbl.className = 'gallery-tag-empty';
    mqLbl.textContent = 'Marquee:';
    box.appendChild(mqLbl);
    marqueeTags.forEach(tag => {
      const c = tagColor(tag);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'gallery-img-tag-chip';
      chip.textContent = `${tag} x`;
      chip.style.color = c;
      chip.style.borderColor = hexToRgba(c, 0.45);
      chip.style.background = hexToRgba(c, 0.12);
      chip.style.opacity = '0.9';
      chip.title = 'Remove this tag from all marquee boxes on this image';
      chip.addEventListener('click', async () => {
        let modified = false;
        if (info.ownerType === 'trade' && info.trade && info.trade.marqueeBoxes && info.trade.marqueeBoxes[imgUrl]) {
          info.trade.marqueeBoxes[imgUrl].forEach(b => {
            if (b.tags && b.tags.includes(tag)) {
              b.tags = b.tags.filter(t => t !== tag);
              modified = true;
            }
          });
        } else if (info.ownerType === 'day' && info.dateKey && state.dayData[info.dateKey]?.marqueeBoxes?.[imgUrl]) {
          state.dayData[info.dateKey].marqueeBoxes[imgUrl].forEach(b => {
            if (b.tags && b.tags.includes(tag)) {
              b.tags = b.tags.filter(t => t !== tag);
              modified = true;
            }
          });
        }

        if (modified) {
          if (typeof syncMarqueeBoxesShadow === 'function') syncMarqueeBoxesShadow();
          await saveTrades();
          renderGalleryImageTags();
          renderTable();
          renderCalendar();
          if (typeof renderGalleryTagsTray === 'function') renderGalleryTagsTray();
          if (typeof _renderMarqueeOnOverlayCanvas === 'function') _renderMarqueeOnOverlayCanvas();
        }
      });
      box.appendChild(chip);
    });
  }
}

function getAllImageTagsGlobal() {
  const set = new Set();
  state.trades.forEach(t => getAllImageTagsForTrade(t).forEach(tag => set.add(tag)));
  Object.keys(state.dayData || {}).forEach(d => getAllImageTagsForDay(d).forEach(tag => set.add(tag)));
  IMAGE_PERMANENT_TAGS.forEach(t => set.add(t));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function isPermanentImageTag(tag) {
  const s = String(tag || '').trim().toLowerCase();
  return IMAGE_PERMANENT_TAGS.some(t => t.toLowerCase() === s);
}

function renameImageTagGlobal(oldTag, newTag) {
  const oTagLow = String(oldTag).toLowerCase();
  state.trades.forEach(t => {
    const store = ensureImageTagStore(t);
    Object.keys(store).forEach(url => {
      const arr = Array.isArray(store[url]) ? store[url] : [];
      const next = arr.map(x => (String(x).toLowerCase() === oTagLow ? newTag : x));
      store[url] = Array.from(new Set(next.filter(Boolean)));
      if (!store[url].length) delete store[url];
    });
    t[IMAGE_TAG_COLUMN] = getAllImageTagsForTrade(t).join(', ');

    state.tagColumns.forEach(c => {
      if (typeof t[c] === 'string') {
        let arr = t[c].split(',').map(x => x.trim()).filter(Boolean);
        if (arr.some(x => x.toLowerCase() === oTagLow)) {
          t[c] = arr.map(x => x.toLowerCase() === oTagLow ? newTag : x).join(',');
        }
      } else if (Array.isArray(t[c])) {
        t[c] = t[c].map(x => String(x).toLowerCase() === oTagLow ? newTag : x);
      }
    });

  });
  Object.keys(state.dayData || {}).forEach(d => {
    const store = ensureDayImageTagStore(d);
    Object.keys(store).forEach(url => {
      const arr = Array.isArray(store[url]) ? store[url] : [];
      const next = arr.map(x => (String(x).toLowerCase() === oTagLow ? newTag : x));
      store[url] = Array.from(new Set(next.filter(Boolean)));
      if (!store[url].length) delete store[url];
    });

    const day = state.dayData[d];
    if (day && day.tags) {
      Object.keys(day.tags).forEach(c => {
        if (typeof day.tags[c] === 'string') {
          let arr = day.tags[c].split(',').map(x => x.trim()).filter(Boolean);
          if (arr.some(x => x.toLowerCase() === oTagLow)) {
            day.tags[c] = arr.map(x => x.toLowerCase() === oTagLow ? newTag : x).join(',');
          }
        } else if (Array.isArray(day.tags[c])) {
          day.tags[c] = day.tags[c].map(x => String(x).toLowerCase() === oTagLow ? newTag : x);
        }
      });
    }

  });
}

function deleteImageTagGlobal(tagToDelete) {
  const tLow = String(tagToDelete).toLowerCase();
  window._lastDeletedGlobalTag = {
    tag: tagToDelete,
    trades: JSON.parse(JSON.stringify(state.trades)),
    dayData: JSON.parse(JSON.stringify(state.dayData || {})),
    allTags: [...state.allTags],
    tagGroups: JSON.parse(JSON.stringify(state.tagGroups || {}))
  };
  state.trades.forEach(t => {
    const store = ensureImageTagStore(t);
    Object.keys(store).forEach(url => {
      const arr = Array.isArray(store[url]) ? store[url] : [];
      const next = arr.filter(x => String(x).toLowerCase() !== tLow);
      if (next.length) store[url] = next;
      else delete store[url];
    });
    if (t.marqueeBoxes) {
      Object.keys(t.marqueeBoxes).forEach(url => {
        t.marqueeBoxes[url].forEach(box => {
          if (box.tags && box.tags.some(x => String(x).toLowerCase() === tLow)) {
            box.tags = box.tags.filter(x => String(x).toLowerCase() !== tLow);
          }
        });
      });
    }

    state.tagColumns.forEach(c => {
      if (typeof t[c] === 'string') {
        const arr = t[c].split(',').map(x => x.trim()).filter(Boolean);
        if (arr.some(x => String(x).toLowerCase() === tLow)) {
          t[c] = arr.filter(x => String(x).toLowerCase() !== tLow).join(',');
        }
      } else if (Array.isArray(t[c])) {
        t[c] = t[c].filter(x => String(x).toLowerCase() !== tLow);
      }
    });

    t[IMAGE_TAG_COLUMN] = getAllImageTagsForTrade(t).join(', ');
  });
  Object.keys(state.dayData || {}).forEach(d => {
    const store = ensureDayImageTagStore(d);
    Object.keys(store).forEach(url => {
      const arr = Array.isArray(store[url]) ? store[url] : [];
      const next = arr.filter(x => String(x).toLowerCase() !== tLow);
      if (next.length) store[url] = next;
      else delete store[url];
    });
    if (day && day.marqueeBoxes) {
      Object.keys(day.marqueeBoxes).forEach(url => {
        day.marqueeBoxes[url].forEach(box => {
          if (box.tags && box.tags.some(x => String(x).toLowerCase() === tLow)) {
            box.tags = box.tags.filter(x => String(x).toLowerCase() !== tLow);
          }
        });
      });
    }

    const day = state.dayData[d];
    if (day && day.tags) {
      Object.keys(day.tags).forEach(c => {
        if (typeof day.tags[c] === 'string') {
          const arr = day.tags[c].split(',').map(x => x.trim()).filter(Boolean);
          if (arr.some(x => String(x).toLowerCase() === tLow)) {
            day.tags[c] = arr.filter(x => String(x).toLowerCase() !== tLow).join(',');
          }
        } else if (Array.isArray(day.tags[c])) {
          day.tags[c] = day.tags[c].filter(x => String(x).toLowerCase() !== tLow);
        }
      });
    }
  });

  state.allTags = (state.allTags || []).filter(x => String(x).toLowerCase() !== tLow);
  if (state.tagGroups) {
    Object.keys(state.tagGroups).forEach(g => {
      state.tagGroups[g] = (state.tagGroups[g] || []).filter(x => String(x).toLowerCase() !== tLow);
    });
  }
}

function openGalleryImageTagManager() {
  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  const info = getCurrentGalleryImageTagInfo();
  if (!imgUrl || (info.ownerType === 'trade' && !info.trade) || (info.ownerType === 'day' && !info.dateKey && !info.trade)) {
    showToast('Open an image first', 'error');
    return;
  }
  renderImageTagModal();
  document.getElementById('img-tag-modal').classList.add('open');
}

function closeGalleryImageTagManager() {
  const modal = document.getElementById('img-tag-modal');
  if (modal) modal.classList.remove('open');
}

function renderImageTagModal() {
  const currentWrap = document.getElementById('img-tag-current-list');
  const manageWrap = document.getElementById('img-tag-manage-list');
  if (!currentWrap || !manageWrap) return;
  currentWrap.innerHTML = '';
  manageWrap.innerHTML = '';

  const info = getCurrentGalleryImageTagInfo();
  const trade = info.trade;
  const imgUrl = info.imgUrl;
  const all = getAllImageTagsGlobal();
  const assigned = info.imageTags || [];

  all.forEach(tag => {
    const row = document.createElement('label');
    row.className = 'head-checkbox';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = assigned.includes(tag);
    const dot = document.createElement('span');
    dot.className = 'tag-dot';
    dot.style.background = tagColor(tag);
    const txt = document.createTextNode(tag);
    chk.addEventListener('change', async () => {
      const next = chk.checked ? [...assigned, tag] : assigned.filter(t => t !== tag);
      if (info.ownerType === 'trade' && trade) setImageTagsForUrl(trade, imgUrl, next);
      else if (info.ownerType === 'day' && info.dateKey) setDayImageTagsForUrl(info.dateKey, imgUrl, next);
      normalizeAllTagsFromTrades();
      await saveTrades();
      renderGalleryImageTags();
      renderTagFilterPanel();
      renderTable();
      renderCalendar();
      renderImageTagModal();
    });
    row.appendChild(chk);
    row.appendChild(dot);
    row.appendChild(txt);
    currentWrap.appendChild(row);
  });

  if (!all.length) {
    const hint = document.createElement('p');
    hint.className = 'panel-hint';
    hint.textContent = 'No tags yet';
    currentWrap.appendChild(hint);
  }



  all.forEach(tag => {
    const row = document.createElement('div');
    row.className = 'tag-manage-row';
    const dot = document.createElement('span');
    dot.className = 'tag-dot';
    dot.style.background = tagColor(tag);
    const name = document.createElement('span');
    name.textContent = tag;
    name.style.flex = '1';

    const renameBtn = document.createElement('button');
    renameBtn.className = 'tag-del-btn';
    renameBtn.textContent = 'edit';
    renameBtn.disabled = isPermanentImageTag(tag);
    renameBtn.title = isPermanentImageTag(tag) ? 'Permanent tag' : 'Rename tag';
    renameBtn.addEventListener('click', async () => {
      const next = String(prompt('New tag name:', tag) || '').trim();
      if (!next || next === tag) return;
      renameImageTagGlobal(tag, next);
      normalizeAllTagsFromTrades();
      await saveTrades();
      renderGalleryImageTags();
      renderTagFilterPanel();
      renderTable();
      renderCalendar();
      renderImageTagModal();
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'tag-del-btn';
    delBtn.textContent = 'x';
    delBtn.disabled = isPermanentImageTag(tag);
    delBtn.title = isPermanentImageTag(tag) ? 'Permanent tag' : 'Delete tag globally';
    delBtn.addEventListener('click', async () => {
      deleteImageTagGlobal(tag);
      normalizeAllTagsFromTrades();
      await saveTrades();
      renderGalleryImageTags();
      renderTagFilterPanel();
      renderTable();
      renderCalendar();
      renderImageTagModal();
    });

    row.appendChild(dot);
    row.appendChild(name);
    row.appendChild(renameBtn);
    row.appendChild(delBtn);
    manageWrap.appendChild(row);
  });
}

async function addImageTagFromModal() {
  const inp = document.getElementById('img-tag-new-name');
  const tag = String(inp?.value || '').trim();
  if (!tag) return;
  const info = getCurrentGalleryImageTagInfo();
  const trade = info.trade;
  const imgUrl = info.imgUrl;
  if (!imgUrl) return;
  const existing = Array.isArray(info.imageTags) ? [...info.imageTags] : [];
  if (!existing.includes(tag)) existing.push(tag);
  if (info.ownerType === 'trade' && trade) setImageTagsForUrl(trade, imgUrl, existing);
  else if (info.ownerType === 'day' && info.dateKey) setDayImageTagsForUrl(info.dateKey, imgUrl, existing);
  else return;
  if (!state.allTags.includes(tag)) state.allTags.push(tag);
  normalizeAllTagsFromTrades();
  await saveTrades();
  renderGalleryImageTags();
  renderTagFilterPanel();
  renderTable();
  renderCalendar();
  inp.value = '';
  renderImageTagModal();
}

document.addEventListener('keydown', e => {
  const isTyping = document.activeElement &&
    (document.activeElement.tagName === 'INPUT' ||
      document.activeElement.tagName === 'TEXTAREA' ||
      document.activeElement.isContentEditable);

  // Global Ctrl+Z to undo deleted image tags
  if (!isTyping && (e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
    if (!annotState.active) {
      if (window._lastDeletedImageTag) {
        e.preventDefault();
        const p = window._lastDeletedImageTag;
        if (p.ownerType === 'trade' && p.trade) setImageTagsForUrl(p.trade, p.imgUrl, p.origTags);
        else if (p.ownerType === 'day' && p.dateKey) setDayImageTagsForUrl(p.dateKey, p.imgUrl, p.origTags);
        if (!state.allTags.includes(p.tag)) state.allTags.push(p.tag);
        normalizeAllTagsFromTrades();
        window._lastDeletedImageTag = null;
        saveTrades().then(() => {
          if (typeof renderGalleryImageTags === 'function') renderGalleryImageTags();
          if (typeof renderTagFilterPanel === 'function') renderTagFilterPanel();
          if (typeof renderGalleryTagsTray === 'function') renderGalleryTagsTray();
          renderTable();
          renderCalendar();
          showToast(`Tag '${p.tag}' restored on image`, 'success');
        });
        return;
      } else if (window._lastDeletedGlobalTag) {
        e.preventDefault();
        const g = window._lastDeletedGlobalTag;
        state.trades = g.trades;
        state.dayData = g.dayData;
        state.allTags = g.allTags;
        state.tagGroups = g.tagGroups;
        window._lastDeletedGlobalTag = null;
        saveTrades().then(() => {
          if (typeof renderGalleryImageTags === 'function') renderGalleryImageTags();
          if (typeof renderTagFilterPanel === 'function') renderTagFilterPanel();
          if (typeof renderGalleryTagsTray === 'function') renderGalleryTagsTray();
          if (typeof renderImageTagModal === 'function') {
            const modal = document.getElementById('img-tag-modal');
            if (modal && modal.classList.contains('open')) renderImageTagModal();
          }
          renderTable();
          renderCalendar();
          showToast(`Global tag '${g.tag}' restored`, 'success');
        });
        return;
      }
    }
  }
});


```
