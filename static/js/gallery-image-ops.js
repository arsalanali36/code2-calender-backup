/**
 * @fileoverview gallery-image-ops.js
 * @description Image reordering, cross-date move, deletion, sub-image drag-drop in gallery.
 * @exports getOwnerTradeForImageUrl, syncGalleryImageOrderToTrades,
 *          reorderGalleryImages, moveGalleryImageToDate, removeGalleryImageAt,
 *          handleReorderGalleryImagesBatch, handleDropAsSubImage
 * @reads state.trades, state.dayData, state.gallery
 * @writes state.trades[].images, state.dayData[].images, trade.subImages (move/delete/group)
 * @calls saveTrades, renderGallery, showToast
 */

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
    const filterActive = Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length > 0;
    if (filterActive) {
        console.warn('syncGalleryImageOrderToTrades skipped because a filter is active. Persistent reordering is disabled in filter mode.');
        return;
    }

    const ordered = state.gallery.images || [];

    const getSubSet = (t) => {
        const s = new Set();
        if (t && t.subImages) {
            Object.values(t.subImages).forEach(arr => arr.forEach(u => s.add(u)));
        }
        return s;
    };

    // Helper to sync sub-image order within a trade/dayData object
    const syncSubOrder = (obj) => {
        if (!obj || !obj.subImages) return;
        for (const parentUrl in obj.subImages) {
            const currentSubs = obj.subImages[parentUrl];
            // Filter all sub-images that belong to this parent from the ordered gallery list
            const inTray = ordered.filter(u => currentSubs.includes(u));
            // If the count matches, it means they are all expanded/visible or we have the full set
            // Even if not all are visible, we update the ones we found in the order they appeared
            if (inTray.length > 1) {
                // We only update if we found multiple, to avoid messing up if some are filtered out
                // Actually, if we are in filter mode, we should be careful.
                const filterActive = Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length > 0;
                if (!filterActive) {
                    obj.subImages[parentUrl] = inTray;
                }
            }
        }
    };

    if (state.gallery.sourceRow !== null && state.trades[state.gallery.sourceRow]) {
        const t = state.trades[state.gallery.sourceRow];
        syncSubOrder(t);
        const subs = getSubSet(t);
        t.images = ordered.filter(u => !subs.has(u));
        return;
    }

    if (state.gallery.date) {
        const dk = state.gallery.date;
        const dayTrades = getTradesForDate(dk);
        const currentDayData = state.dayData[dk];

        dayTrades.forEach(syncSubOrder);
        syncSubOrder(currentDayData);

        if (currentDayData) {
            const daySubs = getSubSet(currentDayData);
            const newDayImages = [];
            const newCloseImages = [];
            const newTradeImages = new Map();
            dayTrades.forEach(t => newTradeImages.set(t, []));

            let seenAnyTrade = false;
            ordered.forEach(u => {
                const owner = getOwnerTradeForImageUrl(u);
                if (owner && newTradeImages.has(owner)) {
                    seenAnyTrade = true;
                    const subs = getSubSet(owner);
                    if (!subs.has(u)) newTradeImages.get(owner).push(u);
                } else {
                    const subs = getSubSet(currentDayData);
                    if (!subs.has(u)) {
                        if (dayTrades.length > 0) {
                            if (seenAnyTrade) newCloseImages.push(u);
                            else newDayImages.push(u);
                        } else {
                            if (currentDayData.closeImages?.includes(u)) newCloseImages.push(u);
                            else newDayImages.push(u);
                        }
                    }
                }
            });

            currentDayData.images = newDayImages;
            currentDayData.closeImages = newCloseImages;
            dayTrades.forEach(t => { t.images = newTradeImages.get(t); });
        }
        return;
    }

    // Fallback: Global iteration
    state.trades.forEach(syncSubOrder);
    Object.values(state.dayData || {}).forEach(syncSubOrder);
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
window.galleryUndoStack = [];

window.performGalleryUndo = function () {
    if (!window.galleryUndoStack || window.galleryUndoStack.length === 0) {
        showToast('Nothing to undo', 'info');
        return;
    }
    const backup = window.galleryUndoStack.pop();
    if (backup.deleteTimer) clearTimeout(backup.deleteTimer);

    if (backup.backupAllTrades) {
        state.trades = JSON.parse(backup.backupAllTrades);
        if (backup.backupAllDayData) state.dayData = JSON.parse(backup.backupAllDayData);
    } else {
        if (backup.backupTradeIdx >= 0) state.trades[backup.backupTradeIdx] = JSON.parse(JSON.stringify(backup.backupTradeClone));
        if (backup.dayDate && backup.backupDay) state.dayData[backup.dayDate] = JSON.parse(JSON.stringify(backup.backupDay));
    }
    state.gallery.images = [...backup.backupArr];
    state.gallery.currentIndex = backup.backupCurrentIndex;
    if (backup.backupExpanded) state.gallery.expandedGroups = new Set(backup.backupExpanded);

    syncGalleryImageOrderToTrades();
    renderGallery();
    saveTrades();
    renderTable();
    renderCalendar();

    // clear the toast if it was an undo toast
    const t = document.getElementById('toast');
    if (t.classList.contains('show') && t.innerText.includes('Undo')) {
        t.innerText = "Restored.";
        setTimeout(() => { t.className = 'toast'; }, 2000);
    } else {
        showToast('Undo successful', 'success');
    }
};

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

        const actionBackup = {
            backupTradeIdx: backupTradeIdx2, backupTradeClone: backupTradeClone2,
            dayDate, backupDay: backupDay2, backupArr: backupArr2, backupCurrentIndex: backupCurrentIndex2,
            backupExpanded: backupExpanded2, urlsToDelete: [imageUrl]
        };

        const timerId = setTimeout(async () => {
            const idx = window.galleryUndoStack.indexOf(actionBackup);
            if (idx > -1) window.galleryUndoStack.splice(idx, 1); // remove from stack once permanent
            try {
                const fn = String(imageUrl || '').split('/').pop();
                await imageService.deleteImage('/' + fn);
            } catch (e) { }
        }, 5000);
        actionBackup.deleteTimer = timerId;
        window.galleryUndoStack.push(actionBackup);

        const t2 = document.getElementById('toast');
        t2.innerHTML = `Parent removed, ${subImages.length} image(s) ungrouped. <button id="undo-del-btn" style="margin-left:10px;padding:2px 8px;background:var(--blue);color:#fff;border:none;border-radius:4px;cursor:pointer;" onclick="performGalleryUndo()">Undo</button>`;
        t2.className = 'toast success show';
        setTimeout(() => { t2.className = 'toast'; }, 4000);
        if (!state.gallery.images.length) { document.getElementById('gallery-modal').classList.remove('open'); unlockBodyScroll(); }
        await tradeService.saveTrades({ trades: state.trades, columns: state.columns, allTags: state.allTags, tagColumns: state.tagColumns, userColumns: state.userColumns, dayData: state.dayData, tagGroups: state.tagGroups });
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

    const actionBackup = {
        backupTradeIdx, backupTradeClone,
        dayDate, backupDay, backupArr, backupCurrentIndex,
        backupExpanded, urlsToDelete
    };

    const timerId = setTimeout(async () => {
        const idx = window.galleryUndoStack.indexOf(actionBackup);
        if (idx > -1) window.galleryUndoStack.splice(idx, 1);
        for (const dictUrl of urlsToDelete) {
            try {
                const filename = String(dictUrl || '').split('/').pop();
                await imageService.deleteImage('/uploads/' + filename);
            } catch (e) { }
        }
    }, 5000);
    actionBackup.deleteTimer = timerId;
    window.galleryUndoStack.push(actionBackup);

    // Create custom undo toast
    const t = document.getElementById('toast');
    t.innerHTML = `Image removed. <button id="undo-del-btn" style="margin-left:10px; padding:2px 8px; background:var(--blue); color:#fff; border:none; border-radius:4px; cursor:pointer;" onclick="performGalleryUndo()">Undo</button>`;
    t.className = `toast success show`;

    setTimeout(() => {
        t.className = 'toast';
    }, 4000);

    if (!arr.length) {
        document.getElementById('gallery-modal').classList.remove('open');
        unlockBodyScroll();
    }

    await tradeService.saveTrades({ trades: state.trades, columns: state.columns, allTags: state.allTags, tagColumns: state.tagColumns, userColumns: state.userColumns, dayData: state.dayData, tagGroups: state.tagGroups });
}

async function handleReorderGalleryImagesBatch(draggedIndicesStr, insertAtGlobalIdx, targetUrl = null) {
    const arr = state.gallery.images || [];
    const indices = draggedIndicesStr.sort((a, b) => a - b);
    if (!indices.length) return;

    // Backup for undo (cross-separator moves only)
    const backupArr = [...arr];
    const backupCurrentIndex = state.gallery.currentIndex;
    const backupExpanded = state.gallery.expandedGroups ? new Set(state.gallery.expandedGroups) : null;
    const backupAllTrades = targetUrl ? JSON.stringify(state.trades) : null;
    const backupAllDayData = targetUrl ? JSON.stringify(state.dayData) : null;
    const dayDate = state.gallery.date;

    // gather items
    const items = indices.map(i => arr[i]);
    const currentUrl = arr[state.gallery.currentIndex];

    // First, detach moving items from their current groups (if they're sub-images of some parent)
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

    let anyDetached = false;
    items.forEach(u => {
        const P = removeFromGroup(u);
        if (P) anyDetached = true;
    });

    if (targetUrl) {
        const targetOwner = getOwnerTradeForImageUrl(targetUrl);
        const isTargetClose = !targetOwner && state.dayData[state.gallery.date]?.closeImages?.includes(targetUrl);
        const dayKey = state.gallery.date;

        items.forEach(u => {
            const owner = getOwnerTradeForImageUrl(u);

            // Collect & detach subImages if this item is a group parent
            let ownedSubs = null;
            if (owner && owner.subImages?.[u]) {
                ownedSubs = [...owner.subImages[u]];
                delete owner.subImages[u];
                if (Object.keys(owner.subImages).length === 0) delete owner.subImages;
            } else if (!owner && dayKey && state.dayData[dayKey]?.subImages?.[u]) {
                ownedSubs = [...state.dayData[dayKey].subImages[u]];
                delete state.dayData[dayKey].subImages[u];
                if (Object.keys(state.dayData[dayKey].subImages).length === 0) delete state.dayData[dayKey].subImages;
            }

            if (owner) owner.images = (owner.images || []).filter(x => x !== u);
            else if (dayKey && state.dayData[dayKey]) {
                if (state.dayData[dayKey].images) state.dayData[dayKey].images = state.dayData[dayKey].images.filter(x => x !== u);
                if (state.dayData[dayKey].closeImages) state.dayData[dayKey].closeImages = state.dayData[dayKey].closeImages.filter(x => x !== u);
            }

            if (targetOwner) {
                if (!targetOwner.images) targetOwner.images = [];
                targetOwner.images.push(u);
                if (ownedSubs?.length) {
                    targetOwner.subImages = targetOwner.subImages || {};
                    targetOwner.subImages[u] = ownedSubs;
                }
            } else if (dayKey) {
                if (!state.dayData[dayKey]) state.dayData[dayKey] = {};
                if (isTargetClose) {
                    if (!state.dayData[dayKey].closeImages) state.dayData[dayKey].closeImages = [];
                    state.dayData[dayKey].closeImages.push(u);
                } else {
                    if (!state.dayData[dayKey].images) state.dayData[dayKey].images = [];
                    state.dayData[dayKey].images.push(u);
                }
                if (ownedSubs?.length) {
                    state.dayData[dayKey].subImages = state.dayData[dayKey].subImages || {};
                    state.dayData[dayKey].subImages[u] = ownedSubs;
                }
            }
        });
    }

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
    }

    state.gallery.currentIndex = Math.max(0, arr.indexOf(currentUrl));
    state.gallery.selectedIndices = new Set();
    syncGalleryImageOrderToTrades();
    await saveTrades();
    renderGallery();
    renderTable();

    // Push undo entry for cross-separator moves
    if (targetUrl) {
        window.galleryUndoStack = window.galleryUndoStack || [];
        window.galleryUndoStack.push({ backupAllTrades, backupAllDayData, backupArr, backupCurrentIndex, backupExpanded, dayDate });
        const t = document.getElementById('toast');
        t.innerHTML = `Image(s) moved. <button id="undo-del-btn" style="margin-left:10px;padding:2px 8px;background:var(--blue);color:#fff;border:none;border-radius:4px;cursor:pointer;" onclick="performGalleryUndo()">Undo</button>`;
        t.className = 'toast success show';
        setTimeout(() => { t.className = 'toast'; }, 4000);
    }
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

