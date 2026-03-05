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

        menu.appendChild(createOpt('Copy Image', async () => {
            try {
                // If it's a local app, we can ask the backend to copy it to system clipboard
                const filename = url.split('/').pop();
                const res = await fetch('/api/copy-image-to-clipboard', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename })
                });
                if (res.ok) {
                    showToast('Image copied to clipboard (System)', 'success');
                } else {
                    // Fallback to browser clipboard if backend isn't supporting it
                    const response = await fetch(url);
                    const blob = await response.blob();
                    const item = new ClipboardItem({ [blob.type]: blob });
                    await navigator.clipboard.write([item]);
                    showToast('Image copied to clipboard (Browser)', 'success');
                }
            } catch (err) {
                console.error(err);
                showToast('Failed to copy image', 'error');
            }
        }));

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

    const parentOpItem = createOpt('Consolidate \u25B6', () => { });
    parentOpItem.style.position = 'relative';
    const subMenu = document.createElement('div');
    subMenu.style.display = 'none';
    subMenu.style.position = 'absolute';
    subMenu.style.left = '100%';
    subMenu.style.top = '0';
    subMenu.style.background = 'var(--surface2)';
    subMenu.style.border = '1px solid var(--border)';
    subMenu.style.zIndex = '100000';
    subMenu.style.padding = '4px 0';
    subMenu.style.minWidth = '160px';
    subMenu.style.borderRadius = 'var(--radius)';
    subMenu.style.boxShadow = 'var(--shadow)';

    parentOpItem.appendChild(subMenu);

    const createSubOpt = (text, onClick) => {
        const opt = document.createElement('div');
        opt.textContent = text;
        opt.style.cursor = 'pointer';
        opt.style.padding = '7px 16px';
        opt.style.fontSize = '0.85rem';
        opt.style.whiteSpace = 'nowrap';
        opt.onmouseenter = () => { opt.style.background = 'var(--hover)'; };
        opt.onmouseleave = () => { opt.style.background = ''; };
        opt.onclick = (e) => { e.stopPropagation(); cleanup(); onClick(); };
        return opt;
    };

    subMenu.appendChild(createSubOpt('Global (Consolidate)', () => moveSelectedToTrade(dateToUse, null)));
    dayTrades.forEach((tr, i) => {
        subMenu.appendChild(createSubOpt(`Trade ${i + 1}`, () => moveSelectedToTrade(dateToUse, tr)));
    });

    parentOpItem.onmouseenter = () => {
        parentOpItem.style.background = 'var(--hover)';
        subMenu.style.display = 'block';

        // Recalculate layout based on absolute positioning from viewport
        requestAnimationFrame(() => {
            const menuRect = menu.getBoundingClientRect();
            const subMenuRect = subMenu.getBoundingClientRect();

            // Re-adjust horizontal alignment
            if (menuRect.right + subMenuRect.width > window.innerWidth) {
                subMenu.style.left = 'auto';
                subMenu.style.right = '100%';
            } else {
                subMenu.style.right = 'auto';
                subMenu.style.left = '100%';
            }

            // Re-adjust vertical alignment (if it goes off screen on bottom)
            const parentRect = parentOpItem.getBoundingClientRect();
            if (parentRect.top + subMenuRect.height > window.innerHeight) {
                subMenu.style.top = 'auto';
                subMenu.style.bottom = '0';
            } else {
                subMenu.style.bottom = 'auto';
                subMenu.style.top = '0';
            }
        });
    };
    parentOpItem.onmouseleave = () => {
        parentOpItem.style.background = '';
        subMenu.style.display = 'none';
        subMenu.style.top = '0';
        subMenu.style.bottom = 'auto';
        subMenu.style.left = '100%';
        subMenu.style.right = 'auto';
    };
    menu.appendChild(parentOpItem);

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
        } else if (state.gallery.date && state.dayData[state.gallery.date]) {
            if (state.dayData[state.gallery.date].images) {
                state.dayData[state.gallery.date].images = state.dayData[state.gallery.date].images.filter(u => u !== imageUrl);
            }
            if (state.dayData[state.gallery.date].closeImages) {
                state.dayData[state.gallery.date].closeImages = state.dayData[state.gallery.date].closeImages.filter(u => u !== imageUrl);
            }
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
    if (state.gallery.date === dateToUse) {
        state.gallery.images = getImagesForDate(dateToUse);
        state.gallery._baseImages = [...state.gallery.images];
    }
    await saveTrades();
    renderGallery();
    renderTable();
    renderCalendar();
    showToast(`Moved ${movedCount} image(s)`, 'success');
}

async function moveSelectedToDayData(dateToUse, isClose = false) {
    if (!state.gallery.selectedIndices || state.gallery.selectedIndices.size === 0) return;
    const arr = state.gallery.images || [];
    const indices = Array.from(state.gallery.selectedIndices).sort((a, b) => b - a);
    let movedCount = 0;

    if (!state.dayData[dateToUse]) state.dayData[dateToUse] = {};
    if (!state.dayData[dateToUse].images) state.dayData[dateToUse].images = [];
    if (!state.dayData[dateToUse].closeImages) state.dayData[dateToUse].closeImages = [];

    for (let idx of indices) {
        if (idx < 0 || idx >= arr.length) continue;
        const imageUrl = arr[idx];
        const ownerTrade = getOwnerTradeForImageUrl(imageUrl);

        // Remove from current location
        if (ownerTrade) {
            ownerTrade.images = (ownerTrade.images || []).filter(u => u !== imageUrl);
        } else if (state.gallery.date && state.dayData[state.gallery.date]) {
            if (state.dayData[state.gallery.date].images) {
                state.dayData[state.gallery.date].images = state.dayData[state.gallery.date].images.filter(u => u !== imageUrl);
            }
            if (state.dayData[state.gallery.date].closeImages) {
                state.dayData[state.gallery.date].closeImages = state.dayData[state.gallery.date].closeImages.filter(u => u !== imageUrl);
            }
        }

        // Add to target location
        if (isClose) {
            state.dayData[dateToUse].closeImages.push(imageUrl);
        } else {
            state.dayData[dateToUse].images.push(imageUrl);
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
    showToast(`Moved ${movedCount} image(s) to ${isClose ? 'CLOSE' : 'OPEN'}`, 'success');
}

