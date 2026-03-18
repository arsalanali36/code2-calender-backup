/**
 * @fileoverview gallery-image-ops-b.js
 * @description Batch reorder and sub-image drag-drop operations for gallery.
 * @exports handleReorderGalleryImagesBatch, handleDropAsSubImage
 * @reads state.trades, state.dayData, state.gallery
 * @writes trade.images, trade.subImages, dayData images/subImages
 * @calls syncGalleryImageOrderToTrades, saveTrades, renderGallery, renderTable, renderCalendar
 */

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

