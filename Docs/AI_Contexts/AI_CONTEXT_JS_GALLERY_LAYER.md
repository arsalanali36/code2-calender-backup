# JS — Gallery Layer Panel (gallery-layer.js)
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `static\js\gallery-layer.js`
```js
/**
 * @fileoverview gallery-layer.js
 * @description Layer panel (sub-images list), keyboard shortcuts popover, video URL panel.
 * @exports renderLayerPanel, toggleLayerPanel, renderShortcutsPopover, renderGalleryVideoUrls
 * @reads state.gallery.{images,currentIndex,date,layerPanelOpen}, state.trades, state.dayData
 * @writes state.gallery.layerPanelOpen
 * @calls renderGallery, openGalleryDirect
 */

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
