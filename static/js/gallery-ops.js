/**
 * @fileoverview gallery-ops.js
 * @description Gallery context menu (right-click), group/ungroup images, move to trade/dayData.
 * @exports showGalleryContextMenu, replaceGalleryImageUrl, groupAllGalleryImages,
 *          ungroupAllGalleryImages, moveGalleryTile, showGalleryGroupDeleteConfirm,
 *          toggleGalleryGroupExpand, moveSelectedToTrade, moveSelectedToDayData
 * @reads state.gallery, state.trades, state.dayData
 * @writes trade.subImages, dayData.subImages, state.gallery (context updates)
 * @calls saveTrades, renderGallery, showToast
 */

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
                const _clipRes = await imageService.copyToClipboard(url);
                if (_clipRes.success) {
                    showToast('Image copied to clipboard (System)', 'success');
                } else {
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
                try {
                    const rv = await imageService.uploadImage(inp.files[0]);
                    if (!rv.url) throw new Error();
                    await replaceGalleryImageUrl(url, rv.url);
                    showToast('Image replaced', 'success');
                } catch (e) { showToast('Replace failed', 'error'); }
            };
            inp.click();
        }));

        menu.appendChild(createOpt('Add Image After', () => {
            const inp = document.createElement('input');
            inp.type = 'file'; inp.accept = 'image/*';
            inp.onchange = async () => {
                if (!inp.files[0]) return;
                try {
                    const rv = await imageService.uploadImage(inp.files[0]);
                    if (!rv.url) throw new Error();
                    // Insert new URL right after the right-clicked image in gallery
                    const imgs = state.gallery.images || [];
                    const insertAt = selIdx + 1;
                    imgs.splice(insertAt, 0, rv.url);
                    state.gallery.images = imgs;
                    if (state.gallery._baseImages) state.gallery._baseImages.splice(insertAt, 0, rv.url);
                    // Also insert in the owning trade or dayData
                    if (ownerTrade) {
                        const ti = (ownerTrade.images || []).indexOf(url);
                        if (ti >= 0) ownerTrade.images.splice(ti + 1, 0, rv.url);
                        else { if (!ownerTrade.images) ownerTrade.images = []; ownerTrade.images.push(rv.url); }
                    } else if (state.gallery.date && state.dayData[state.gallery.date]) {
                        const dd = state.dayData[state.gallery.date];
                        const di = (dd.images || []).indexOf(url);
                        if (di >= 0) dd.images.splice(di + 1, 0, rv.url);
                        else { if (!dd.images) dd.images = []; dd.images.push(rv.url); }
                    }
                    state.gallery.currentIndex = insertAt;
                    await saveTrades();
                    renderGallery();
                    showToast('Image added', 'success');
                } catch (e) { showToast('Upload failed', 'error'); }
            };
            inp.click();
        }));

        menu.appendChild(createOpt('Set as Hero', async () => {
            if (ownerTrade) {
                ownerTrade.heroImage = url;
                await saveTrades();
                showToast('Hero image updated', 'success');
            } else {
                showToast('Image does not belong to a specific trade', 'info');
            }
        }));
        addSep();
    }

    // ── Group Selected (2+ images) ──────────────────────────────────────
    if (selectedIdxArr.length >= 2) {
        menu.appendChild(createOpt('Group Selected', async () => {
            await groupAllGalleryImages();
        }));
    }

    // ── Delete Selected ─────────────────────────────────────────────────
    if (selectedIdxArr.length >= 1) {
        menu.appendChild(createOpt('Delete Selected', async () => {
            const arr = state.gallery.images || [];
            const dayDate = state.gallery.date;

            // Collect URLs to delete (including sub-images of group parents)
            const toDelete = new Set();
            selectedIdxArr.forEach(i => {
                const url = arr[i];
                if (!url) return;
                toDelete.add(url);
                const ot = getOwnerTradeForImageUrl(url);
                const subs = (ot?.subImages?.[url]) || (dayDate && state.dayData[dayDate]?.subImages?.[url]) || [];
                subs.forEach(s => toDelete.add(s));
            });

            // Backup for undo
            const backupAllTrades = JSON.stringify(state.trades);
            const backupAllDayData = JSON.stringify(state.dayData);
            const backupArr = [...arr];
            const backupCurrentIndex = state.gallery.currentIndex;
            const backupExpanded = state.gallery.expandedGroups ? new Set(state.gallery.expandedGroups) : null;

            const cleanupObj = (obj) => {
                if (!obj) return;
                obj.images = (obj.images || []).filter(u => !toDelete.has(u));
                if (obj.closeImages) obj.closeImages = obj.closeImages.filter(u => !toDelete.has(u));
                if (obj.subImages) {
                    for (const [p, subs] of Object.entries({ ...obj.subImages })) {
                        if (toDelete.has(p)) { delete obj.subImages[p]; continue; }
                        obj.subImages[p] = subs.filter(u => !toDelete.has(u));
                        if (obj.subImages[p].length === 0) delete obj.subImages[p];
                    }
                    if (Object.keys(obj.subImages).length === 0) delete obj.subImages;
                }
            };

            if (dayDate) {
                getTradesForDate(dayDate).forEach(cleanupObj);
                if (state.dayData[dayDate]) cleanupObj(state.dayData[dayDate]);
            }

            state.gallery.images = arr.filter(u => !toDelete.has(u));
            state.gallery.selectedIndices = new Set();
            if (state.gallery.currentIndex >= state.gallery.images.length)
                state.gallery.currentIndex = Math.max(0, state.gallery.images.length - 1);
            if (state.gallery.expandedGroups) toDelete.forEach(u => state.gallery.expandedGroups.delete(u));

            const thumbsEl = document.getElementById('gallery-thumbs');
            const savedScroll = thumbsEl ? thumbsEl.scrollTop : 0;

            syncGalleryImageOrderToTrades();
            state.gallery._skipScrollIntoView = true;
            renderGallery(); renderTable(); renderCalendar();
            await saveTrades();

            window.galleryUndoStack = window.galleryUndoStack || [];
            window.galleryUndoStack.push({ backupAllTrades, backupAllDayData, backupArr, backupCurrentIndex, backupExpanded, dayDate });
            const t = document.getElementById('toast');
            t.innerHTML = `Deleted ${toDelete.size} image(s). <button id="undo-del-btn" style="margin-left:10px;padding:2px 8px;background:var(--blue);color:#fff;border:none;border-radius:4px;cursor:pointer;" onclick="performGalleryUndo()">Undo</button>`;
            t.className = 'toast success show';
            setTimeout(() => { t.className = 'toast'; }, 4000);
        }));
    }

    // ── Collapse All / Expand All ────────────────────────────────────────
    addSep();
    menu.appendChild(createOpt('Collapse All', () => {
        state.gallery.collapsedSeparators = state.gallery.collapsedSeparators || new Set();
        const dayDate = state.gallery.date;
        const trades = dayDate ? getTradesForDate(dayDate) : [];
        state.gallery.collapsedSeparators.add('OPEN');
        state.gallery.collapsedSeparators.add('CLOSE');
        trades.forEach((_, i) => state.gallery.collapsedSeparators.add('T' + i));
        state.gallery._skipScrollIntoView = true;
        renderGallery();
    }));
    menu.appendChild(createOpt('Expand All', () => {
        if (state.gallery.collapsedSeparators) state.gallery.collapsedSeparators.clear();
        state.gallery._skipScrollIntoView = true;
        renderGallery();
    }));

    addSep();

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

    subMenu.appendChild(createSubOpt('Open', () => moveSelectedToDayData(dateToUse, false)));
    dayTrades.forEach((tr, i) => {
        subMenu.appendChild(createSubOpt(`Trade ${i + 1}`, () => moveSelectedToTrade(dateToUse, tr)));
    });
    subMenu.appendChild(createSubOpt('Close', () => moveSelectedToDayData(dateToUse, true)));

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
    if (state.gallery._baseImages) state.gallery._baseImages = state.gallery._baseImages.map(u => u === oldUrl ? newUrl : u);
    if (state.gallery.expandedGroups?.has(oldUrl)) { state.gallery.expandedGroups.delete(oldUrl); state.gallery.expandedGroups.add(newUrl); }
    if (state._localOverlays?.[oldUrl]) { state._localOverlays[newUrl] = state._localOverlays[oldUrl]; delete state._localOverlays[oldUrl]; }
    // Navigate main viewer to show the replaced image
    const newIdx = state.gallery.images.indexOf(newUrl);
    if (newIdx >= 0) state.gallery.currentIndex = newIdx;
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

