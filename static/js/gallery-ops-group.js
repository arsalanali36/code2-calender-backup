/**
 * @fileoverview gallery-ops-group.js
 * @description Gallery group delete confirm, group expand/collapse, move selected images
 *              to trade or dayData. Split from gallery-ops.js.
 * @exports showGalleryGroupDeleteConfirm, toggleGalleryGroupExpand,
 *          moveSelectedToTrade, moveSelectedToDayData
 * @reads state.gallery, state.trades, state.dayData
 * @writes trade.subImages, dayData.subImages
 * @calls saveTrades, renderGallery, showToast
 */

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

async function moveSelectedToTrade(dateToUse, targetTrade, isClose = false) {
    if (!state.gallery.selectedIndices || state.gallery.selectedIndices.size === 0) return;
    const arr = state.gallery.images || [];

    // Ascending order = original visual order (used when adding to target)
    const indicesAsc = Array.from(state.gallery.selectedIndices).sort((a, b) => a - b);
    // Descending order = safe for removal from source
    const indicesDesc = [...indicesAsc].reverse();

    // Backup for undo
    const backupAllTrades = JSON.stringify(state.trades);
    const backupAllDayData = JSON.stringify(state.dayData);
    const backupArr = [...arr];
    const backupCurrentIndex = state.gallery.currentIndex;
    const backupExpanded = state.gallery.expandedGroups ? new Set(state.gallery.expandedGroups) : null;
    const dayDate = state.gallery.date;

    let targetTradeObj = targetTrade;
    if (!targetTradeObj && dateToUse) {
    // If it's global, we move it out of trades to dayData
        if (!state.dayData[dateToUse]) state.dayData[dateToUse] = {};
        if (isClose === 'NEWS') {
            if (!state.dayData[dateToUse].newsImages) state.dayData[dateToUse].newsImages = [];
        } else if (isClose === 'CLOSE_GLOBAL') {
            if (!state.dayData[dateToUse].closeGlobalImages) state.dayData[dateToUse].closeGlobalImages = [];
        } else if (isClose) {
            if (!state.dayData[dateToUse].closeImages) state.dayData[dateToUse].closeImages = [];
        } else {
            if (!state.dayData[dateToUse].images) state.dayData[dateToUse].images = [];
        }
    }

    // Pass 1: collect subs & remove from source (descending so indices stay valid)
    const movedItems = []; // { imageUrl, ownedSubs } in descending index order
    for (let idx of indicesDesc) {
        if (idx < 0 || idx >= arr.length) continue;
        const imageUrl = arr[idx];
        const ownerTrade = getOwnerTradeForImageUrl(imageUrl);

        // Collect & detach subImages if this item is a group parent
        let ownedSubs = null;
        if (ownerTrade && ownerTrade.subImages?.[imageUrl]) {
            ownedSubs = [...ownerTrade.subImages[imageUrl]];
            delete ownerTrade.subImages[imageUrl];
            if (Object.keys(ownerTrade.subImages).length === 0) delete ownerTrade.subImages;
        } else if (!ownerTrade && state.gallery.date && state.dayData[state.gallery.date]?.subImages?.[imageUrl]) {
            const dd = state.dayData[state.gallery.date];
            ownedSubs = [...dd.subImages[imageUrl]];
            delete dd.subImages[imageUrl];
            if (Object.keys(dd.subImages).length === 0) delete dd.subImages;
        }

        // Remove from current location
        if (ownerTrade) {
            ownerTrade.images = (ownerTrade.images || []).filter(u => u !== imageUrl);
        } else if (state.gallery.date && state.dayData[state.gallery.date]) {
            const dd = state.dayData[state.gallery.date];
            if (dd.newsImages) dd.newsImages = dd.newsImages.filter(u => u !== imageUrl);
            if (dd.images) dd.images = dd.images.filter(u => u !== imageUrl);
            if (dd.closeImages) dd.closeImages = dd.closeImages.filter(u => u !== imageUrl);
            if (dd.closeGlobalImages) dd.closeGlobalImages = dd.closeGlobalImages.filter(u => u !== imageUrl);
        }

        movedItems.push({ imageUrl, ownedSubs });
    }

    // Pass 2: add to target in original visual order (reverse of descending = ascending)
    movedItems.reverse();
    let movedCount = 0;
    for (const { imageUrl, ownedSubs } of movedItems) {
        // Add to target location (with subImages)
        if (targetTradeObj) {
            if (!targetTradeObj.images) targetTradeObj.images = [];
            targetTradeObj.images.push(imageUrl);
            if (ownedSubs?.length) {
                targetTradeObj.subImages = targetTradeObj.subImages || {};
                targetTradeObj.subImages[imageUrl] = ownedSubs;
            }
        } else if (dateToUse) {
            if (isClose === 'NEWS') {
                state.dayData[dateToUse].newsImages.push(imageUrl);
            } else if (isClose === 'CLOSE_GLOBAL') {
                state.dayData[dateToUse].closeGlobalImages.push(imageUrl);
                if (state.dayData[dateToUse].closeGlobalImages.length > 1) {
                    showToast('CLOSE GLOBAL allowed 1 image max.', 'error');
                }
            } else if (isClose) {
                state.dayData[dateToUse].closeImages.push(imageUrl);
            } else {
                state.dayData[dateToUse].images.push(imageUrl);
            }
            if (ownedSubs?.length) {
                state.dayData[dateToUse].subImages = state.dayData[dateToUse].subImages || {};
                state.dayData[dateToUse].subImages[imageUrl] = ownedSubs;
            }
        }
        movedCount++;
    }

    state.gallery.selectedIndices.clear();
    if (state.gallery.date === dateToUse) {
        state.gallery.images = getImagesForDate(dateToUse);
        state.gallery._baseImages = [...state.gallery.images];
    }
    await saveTrades();
    renderGallery();
    renderTable();
    renderCalendar();

    // Push undo entry
    window.galleryUndoStack = window.galleryUndoStack || [];
    window.galleryUndoStack.push({ backupAllTrades, backupAllDayData, backupArr, backupCurrentIndex, backupExpanded, dayDate });
    const t = document.getElementById('toast');
    t.innerHTML = `Moved ${movedCount} image(s). <button id="undo-del-btn" style="margin-left:10px;padding:2px 8px;background:var(--blue);color:#fff;border:none;border-radius:4px;cursor:pointer;" onclick="performGalleryUndo()">Undo</button>`;
    t.className = 'toast success show';
    setTimeout(() => { t.className = 'toast'; }, 4000);
}

async function moveSelectedToDayData(dateToUse, isClose = false) {
    return moveSelectedToTrade(dateToUse, null, isClose);
}

