# JS - Gallery Ops (ops, ops-group, image-ops)
Consolidated code context for AI assistants.


## File: `static/js/gallery-ops.js`
```js
/**
 * @fileoverview gallery-ops.js
 * @description Gallery context menu (right-click), group/ungroup images, move to trade/dayData.
 * @exports showGalleryContextMenu, replaceGalleryImageUrl, groupAllGalleryImages,
 *          ungroupAllGalleryImages, moveGalleryTile, showGalleryGroupDeleteConfirm,
 *          toggleGalleryGroupExpand, moveSelectedToTrade, moveSelectedToDayData,
 *          galleryCollapseAll, galleryExpandAll
 * @reads state.gallery, state.trades, state.dayData
 * @writes trade.subImages, dayData.subImages, state.gallery (context updates)
 * @calls saveTrades, renderGallery, showToast
 */

// gallery-ops.js — Context menu, image replace, group/ungroup/tile ops,
//   showGalleryGroupDeleteConfirm, toggleGalleryGroupExpand, moveSelectedToTrade,
//   galleryCollapseAll, galleryExpandAll.

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

    // ── Mark as Index / Premium (single or multi-select) ──────────────────
    if (selectedIdxArr.length >= 1) {
        const selUrls = selectedIdxArr.map(i => (state.gallery.images || [])[i]).filter(Boolean);
        // For single: show ✓ on current type; for multi: show type if all same
        const allSameType = selUrls.every(u => getImgType(u) === getImgType(selUrls[0])) ? getImgType(selUrls[0]) : null;

        const markMenu = createOpt('Mark as \u25B6', () => {});
        markMenu.style.position = 'relative';
        const markSub = document.createElement('div');
        markSub.style.cssText = 'display:none;position:absolute;left:100%;top:0;background:var(--surface2);border:1px solid var(--border);z-index:100001;padding:4px 0;min-width:130px;border-radius:var(--radius);box-shadow:var(--shadow);';
        const mkOpt = (label, val, color) => {
            const o = document.createElement('div');
            o.textContent = (allSameType === val ? '✓ ' : '') + label;
            o.style.cssText = `cursor:pointer;padding:7px 16px;font-size:0.85rem;white-space:nowrap;color:${color};`;
            o.onmouseenter = () => { o.style.background = 'var(--hover)'; };
            o.onmouseleave = () => { o.style.background = ''; };
            o.onclick = async (e) => {
                e.stopPropagation();
                cleanup();
                const newType = allSameType === val ? null : val;
                if (!state.imgTypes) state.imgTypes = {};
                selUrls.forEach(u => { if (newType) state.imgTypes[u] = newType; else delete state.imgTypes[u]; });
                await saveTrades();
                if (typeof applyImgTypeFilter === 'function') applyImgTypeFilter();
                renderGallery();
                showToast(newType ? `${selUrls.length} image(s) marked as ${label}` : `Type cleared (${selUrls.length})`, 'success');
            };
            return o;
        };
        markSub.appendChild(mkOpt('Index',   'index',   '#58a6ff'));
        markSub.appendChild(mkOpt('Premium', 'premium', '#d29922'));
        markMenu.appendChild(markSub);
        markMenu.onmouseenter = () => { markSub.style.display = 'block'; };
        markMenu.onmouseleave = () => { markSub.style.display = 'none'; };
        menu.appendChild(markMenu);
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
                if (obj.newsImages) obj.newsImages = obj.newsImages.filter(u => !toDelete.has(u));
                if (obj.closeImages) obj.closeImages = obj.closeImages.filter(u => !toDelete.has(u));
                if (obj.closeGlobalImages) obj.closeGlobalImages = obj.closeGlobalImages.filter(u => !toDelete.has(u));
                if (obj.subImages) {
                    for (const [p, subs] of Object.entries({ ...obj.subImages })) {
                        if (toDelete.has(p)) { delete obj.subImages[p]; continue; }
                        obj.subImages[p] = subs.filter(u => !toDelete.has(u));
                        if (obj.subImages[p].length === 0) delete obj.subImages[p];
                    }
                    if (Object.keys(obj.subImages).length === 0) delete obj.subImages;
                }
            };

            state.trades.forEach(cleanupObj);
            Object.values(state.dayData || {}).forEach(cleanupObj);

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

            const timerId = setTimeout(async () => {
                const idx = window.galleryUndoStack.indexOf(actionBackup);
                if (idx > -1) window.galleryUndoStack.splice(idx, 1);
                for (const dictUrl of toDelete) {
                    try {
                        if (typeof isVideoUrl === 'function' && isVideoUrl(dictUrl)) {
                            await imageService.deleteVideo(dictUrl);
                        } else if (dictUrl.endsWith('.webm') || dictUrl.endsWith('.mp3')) {
                            await imageService.deleteAudio(dictUrl);
                        } else {
                            const filename = String(dictUrl || '').split('/').pop();
                            await imageService.deleteImage('/uploads/' + filename);
                        }
                    } catch (e) { }
                }
            }, 5000);

            const actionBackup = { backupAllTrades, backupAllDayData, backupArr, backupCurrentIndex, backupExpanded, dayDate, deleteTimer: timerId };
            window.galleryUndoStack = window.galleryUndoStack || [];
            window.galleryUndoStack.push(actionBackup);
            
            const t = document.getElementById('toast');
            t.innerHTML = `Deleted ${toDelete.size} image(s). <button id="undo-del-btn" style="margin-left:10px;padding:2px 8px;background:var(--blue);color:#fff;border:none;border-radius:4px;cursor:pointer;" onclick="performGalleryUndo()">Undo</button>`;
            t.className = 'toast success show';
            setTimeout(() => { t.className = 'toast'; }, 4000);
        }));
    }

    // ── Collapse All / Expand All ────────────────────────────────────────
    addSep();
    menu.appendChild(createOpt('Collapse All', galleryCollapseAll));
    menu.appendChild(createOpt('Expand All', galleryExpandAll));

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

    if (state.dayData[dateToUse]) {
        subMenu.appendChild(createSubOpt('News', () => moveSelectedToDayData(dateToUse, 'NEWS')));
    }
    subMenu.appendChild(createSubOpt('Open', () => moveSelectedToDayData(dateToUse, false)));
    dayTrades.forEach((tr, i) => {
        subMenu.appendChild(createSubOpt(`Trade ${i + 1}`, () => moveSelectedToTrade(dateToUse, tr)));
    });
    subMenu.appendChild(createSubOpt('Close', () => moveSelectedToDayData(dateToUse, true)));
    subMenu.appendChild(createSubOpt('Close Global', () => moveSelectedToDayData(dateToUse, 'CLOSE_GLOBAL')));

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


function galleryCollapseAll() {
    state.gallery.collapsedSeparators = state.gallery.collapsedSeparators || new Set();
    const dayDate = state.gallery.date;
    const trades = dayDate ? getTradesForDate(dayDate) : [];
    state.gallery.collapsedSeparators.add('OPEN');
    state.gallery.collapsedSeparators.add('CLOSE');
    trades.forEach((_, i) => state.gallery.collapsedSeparators.add('T' + i));
    state.gallery._skipScrollIntoView = true;
    renderGallery();
}

function galleryExpandAll() {
    if (state.gallery.collapsedSeparators) state.gallery.collapsedSeparators.clear();
    state.gallery._skipScrollIntoView = true;
    renderGallery();
}

```

## File: `static/js/gallery-ops-group.js`
```js
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
    state.gallery.lastClickedIdx = -1; // Reset shift-selection anchor to -1
    
    if (state.gallery.date === dateToUse) {
        state.gallery.images = getImagesForDate(dateToUse);
        state.gallery._baseImages = [...state.gallery.images];
    }
    await saveTrades();
    renderGallery();
    renderTable();
    renderCalendar();
    
    // Crucial: Refresh Grid View if it's currently open
    if (typeof renderGridContent === 'function' && typeof isGridViewOpen === 'function' && isGridViewOpen()) {
        renderGridContent();
    }

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


```

## File: `static/js/gallery-image-ops.js`
```js
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
    const isTradeItem = (t, url) => {
        if (t.images?.includes(url)) return true;
        if (t.videos) {
            if (Object.values(t.videos).includes(url)) return true;
            // Also check if it's one of the video URLs directly (if they are stored as an array in some versions)
            if (Array.isArray(t.videos) && t.videos.includes(url)) return true;
        }
        return isSub(t, url);
    };

    if (state.gallery.sourceRow !== null && state.trades[state.gallery.sourceRow]) {
        const t = state.trades[state.gallery.sourceRow];
        if (isTradeItem(t, imageUrl)) return t;
    }
    if (state.gallery.date) {
        const row = getTradesForDate(state.gallery.date).find(t => isTradeItem(t, imageUrl));
        if (row) return row;
        return null;
    }
    return state.trades.find(t => isTradeItem(t, imageUrl)) || null;
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
            const newNewsImages = [];
            const newDayImages = [];
            const newCloseImages = [];
            const newCloseGlobalImages = [];
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
                        // Priority: News -> Open -> Close -> CloseGlobal
                        const isNews = currentDayData.newsImages?.includes(u);
                        const isCloseGlobal = currentDayData.closeGlobalImages?.includes(u);
                        if (isNews && !seenAnyTrade) {
                            newNewsImages.push(u);
                        } else if (isCloseGlobal) {
                            newCloseGlobalImages.push(u);
                        } else if (dayTrades.length > 0) {
                            if (seenAnyTrade) newCloseImages.push(u);
                            else newDayImages.push(u);
                        } else {
                            if (currentDayData.closeImages?.includes(u)) newCloseImages.push(u);
                            else newDayImages.push(u);
                        }
                    }
                }
            });

            currentDayData.newsImages = newNewsImages;
            currentDayData.images = newDayImages;
            currentDayData.closeImages = newCloseImages;
            currentDayData.closeGlobalImages = newCloseGlobalImages;
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
            if (ownerTrade.videos?.[imageUrl]) delete ownerTrade.videos[imageUrl];
            if (ownerTrade.audios?.[imageUrl]) delete ownerTrade.audios[imageUrl];
            const store2 = ensureImageTagStore(ownerTrade);
            if (store2[imageUrl]) delete store2[imageUrl];
            delete ownerTrade.subImages[imageUrl];
            cleanupImageTagStore(ownerTrade);
        } else if (dayDate && state.dayData[dayDate]) {
            const d = state.dayData[dayDate];
            d.images = (d.images || []).filter(u => u !== imageUrl);
            d.newsImages = (d.newsImages || []).filter(u => u !== imageUrl);
            d.closeImages = (d.closeImages || []).filter(u => u !== imageUrl);
            d.closeGlobalImages = (d.closeGlobalImages || []).filter(u => u !== imageUrl);
            if (!isExpanded) d.images.push(...subImages);
            if (state.dayData[dayDate].overlays?.[imageUrl]) delete state.dayData[dayDate].overlays[imageUrl];
            if (state.dayData[dayDate].marqueeBoxes?.[imageUrl]) delete state.dayData[dayDate].marqueeBoxes[imageUrl];
            if (state.dayData[dayDate].videos?.[imageUrl]) delete state.dayData[dayDate].videos[imageUrl];
            if (state.dayData[dayDate].audios?.[imageUrl]) delete state.dayData[dayDate].audios[imageUrl];
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
        state.gallery._skipScrollIntoView = true;
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
            if (ownerTrade.videos) {
                if (ownerTrade.videos[u]) delete ownerTrade.videos[u];
                const key = Object.keys(ownerTrade.videos).find(k => ownerTrade.videos[k] === u);
                if (key) delete ownerTrade.videos[key];
            }
            if (ownerTrade.audios) {
                if (ownerTrade.audios[u]) delete ownerTrade.audios[u];
                const key = Object.keys(ownerTrade.audios).find(k => ownerTrade.audios[k] === u);
                if (key) delete ownerTrade.audios[key];
            }
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
        const d = state.dayData[dayDate];
        d.images = (d.images || []).filter(u => !urlsToDelete.includes(u));
        d.newsImages = (d.newsImages || []).filter(u => !urlsToDelete.includes(u));
        d.closeImages = (d.closeImages || []).filter(u => !urlsToDelete.includes(u));
        d.closeGlobalImages = (d.closeGlobalImages || []).filter(u => !urlsToDelete.includes(u));
        urlsToDelete.forEach(u => {
            if (state.dayData[dayDate].overlays?.[u]) delete state.dayData[dayDate].overlays[u];
            if (state.dayData[dayDate].marqueeBoxes?.[u]) delete state.dayData[dayDate].marqueeBoxes[u];
            if (state.dayData[dayDate].videos) {
                if (state.dayData[dayDate].videos[u]) delete state.dayData[dayDate].videos[u];
                const key = Object.keys(state.dayData[dayDate].videos).find(k => state.dayData[dayDate].videos[k] === u);
                if (key) delete state.dayData[dayDate].videos[key];
            }
            if (state.dayData[dayDate].audios) {
                if (state.dayData[dayDate].audios[u]) delete state.dayData[dayDate].audios[u];
                const key = Object.keys(state.dayData[dayDate].audios).find(k => state.dayData[dayDate].audios[k] === u);
                if (key) delete state.dayData[dayDate].audios[key];
            }
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
    state.gallery._skipScrollIntoView = true;
    renderGallery();
    renderTable();
    renderCalendar();
    
    // Refresh Grid if open
    if (typeof renderGridContent === 'function' && typeof isGridViewOpen === 'function' && isGridViewOpen()) {
        renderGridContent();
    }

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
                if (typeof isVideoUrl === 'function' && isVideoUrl(dictUrl)) {
                    await imageService.deleteVideo(dictUrl);
                } else if (dictUrl.endsWith('.webm') || dictUrl.endsWith('.mp3')) {
                    await imageService.deleteAudio(dictUrl);
                } else {
                    const filename = String(dictUrl || '').split('/').pop();
                    await imageService.deleteImage('/uploads/' + filename);
                }
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


```
