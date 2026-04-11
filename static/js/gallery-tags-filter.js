/**
 * @fileoverview gallery-tags-filter.js
 * @description Renders the compact tag filter panel inside the gallery toolbar.
 * @exports renderGalleryTagFilterPanel
 * @reads state.gallery.tagFilter, state.gallery.images, state.tagGroups
 * @calls applyGalleryImageScopeByTagFilter, renderGallery
 */

function renderGalleryTagFilterPanel() {
    const listContainer = document.getElementById('gallery-img-tag-filter-panel');
    const header = document.getElementById('gallery-img-tag-filter-header');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    if (header) header.innerHTML = '';

    // Sanitize tags: ignore empty or symbol-only tags that might cause UI bugs
    const allTags = (state.allTags || []).filter(t => {
        const clean = String(t || '').trim();
        return clean.length > 0 && !['.', '-', '_'].includes(clean);
    });

    if (!allTags.length) {
        listContainer.innerHTML = '<p class="panel-hint" style="padding:10px 8px">No tags yet.</p>';
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
    if (header) header.appendChild(searchRow);

    const tagUsageCount = calculateGalleryTagCounts();
    window._tagCountMap = tagUsageCount;

    const actRow = document.createElement('div');
    actRow.className = 'panel-act-row';
    actRow.style.cssText = 'display:flex; gap:6px; padding:0 8px 8px;';

    const btnMode = document.createElement('button');
    btnMode.className = 'panel-act-btn';
    btnMode.style.flex = '1';
    const isAnd = state.gallery.filterMode === 'and';
    btnMode.textContent = isAnd ? 'Match: ALL (AND)' : 'Match: ANY (OR)';
    btnMode.style.color = isAnd ? 'var(--blue)' : 'var(--orange)';
    btnMode.addEventListener('click', () => {
        state.gallery.filterMode = state.gallery.filterMode === 'and' ? 'or' : 'and';
        applyGalleryImageScopeByTagFilter();
        state.gallery._skipFilterRescopeOnce = true;
        renderGallery();
        renderGalleryTagFilterPanel();
    });

    const btnNone = document.createElement('button');
    btnNone.className = 'panel-act-btn';
    btnNone.style.flex = '1';
    btnNone.textContent = 'Clear All';
    btnNone.addEventListener('click', () => {
        state.gallery.tagFilter = [];
        applyGalleryImageScopeByTagFilter();
        if (typeof renderGalleryTagCloud === 'function') renderGalleryTagCloud();
        renderGallery();
        renderGalleryTagFilterPanel();
        // Force the dropdown back to default if it exists
        const tpl = document.getElementById('gv2-tpl-select');
        if (tpl) tpl.value = '';
    });
    actRow.appendChild(btnMode);
    actRow.appendChild(btnNone);
    if (header) header.appendChild(actRow);

    // ── PREMIUM TEMPLATE MENU ──────────────────────────────────────────────
    const tplRow = document.createElement('div');
    tplRow.style.cssText = 'padding: 0 8px 10px; display: flex; align-items: center; gap: 4px; border-bottom: 1px solid rgba(255,255,255,0.05); position:relative;';

    const tplBtn = document.createElement('button');
    tplBtn.className = 'panel-act-btn';
    tplBtn.style.cssText = 'flex:1; justify-content: space-between; padding: 0 10px; height: 28px; font-size:12px; background: var(--surface2);';
    tplBtn.innerHTML = `<span>Recall Template...</span><span style="opacity:0.6">▾</span>`;
    
    const menu = document.createElement('div');
    menu.id = 'gv2-tpl-custom-menu';
    menu.style.cssText = 'display:none; position:absolute; top:32px; left:8px; right:8px; background: #1a1b1e; border: 1px solid var(--border); border-radius: 6px; z-index: 1000; box-shadow: 0 10px 25px rgba(0,0,0,0.5); overflow:hidden;';

    const updateMenu = () => {
        menu.innerHTML = '';
        const templates = state.tagTemplates || {};
        const keys = Object.keys(templates).sort();
        
        if (keys.length === 0) {
            menu.innerHTML = '<div style="padding:10px; font-size:11px; color:#666; text-align:center;">No templates saved.</div>';
        }

        keys.forEach(name => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; padding:6px 10px; border-bottom:1px solid rgba(255,255,255,0.03); cursor:pointer; transition:background 0.2s;';
            row.onmouseenter = () => { row.style.background = 'rgba(255,255,255,0.05)'; };
            row.onmouseleave = () => { row.style.background = ''; };

            const label = document.createElement('span');
            label.textContent = name;
            label.style.cssText = 'flex:1; font-size:12px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
            label.onclick = (e) => {
                e.stopPropagation();
                state.gallery.tagFilter = [...templates[name]];
                applyGalleryImageScopeByTagFilter();
                state.gallery._skipFilterRescopeOnce = true;
                renderGallery();
                renderGalleryTagFilterPanel();
                menu.style.display = 'none';
                showToast(`Applied: ${name}`, 'success');
            };

            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.gap = '8px';

            const editBtn = document.createElement('span');
            editBtn.innerHTML = '✎';
            editBtn.title = 'Rename';
            editBtn.style.cssText = 'font-size:12px; opacity:0.5; transition:opacity 0.2s;';
            editBtn.onmouseenter = () => { editBtn.style.opacity = '1'; editBtn.style.color = 'var(--blue)'; };
            editBtn.onmouseleave = () => { editBtn.style.opacity = '0.5'; editBtn.style.color = ''; };
            editBtn.onclick = (e) => {
                e.stopPropagation();
                const newName = prompt(`Rename template "${name}" to:`, name);
                if (!newName || newName === name) return;
                state.tagTemplates[newName] = state.tagTemplates[name];
                delete state.tagTemplates[name];
                if (typeof saveTrades === 'function') saveTrades();
                updateMenu();
                showToast('Renamed successfully', 'success');
            };

            const delBtn = document.createElement('span');
            delBtn.innerHTML = '×';
            delBtn.title = 'Delete';
            delBtn.style.cssText = 'font-size:16px; opacity:0.5; transition:opacity 0.2s; line-height:14px;';
            delBtn.onmouseenter = () => { delBtn.style.opacity = '1'; delBtn.style.color = 'var(--red)'; };
            delBtn.onmouseleave = () => { delBtn.style.opacity = '0.5'; delBtn.style.color = ''; };
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if (!confirm(`Delete template "${name}"?`)) return;
                delete state.tagTemplates[name];
                if (typeof saveTrades === 'function') saveTrades();
                updateMenu();
                showToast('Deleted template', 'success');
            };

            row.appendChild(label);
            actions.appendChild(editBtn);
            actions.appendChild(delBtn);
            row.appendChild(actions);
            menu.appendChild(row);
        });

        // Add "Save New" at the bottom
        const saveRow = document.createElement('div');
        saveRow.style.cssText = 'padding:8px 10px; border-top:1px solid var(--border); background:rgba(255,255,255,0.02); text-align:center; cursor:pointer; font-size:11px; color:var(--blue); font-weight:600;';
        saveRow.textContent = '+ SAVE NEW TEMPLATE';
        saveRow.onclick = (e) => {
            e.stopPropagation();
            if (!state.gallery.tagFilter?.length) { showToast('Select some tags first!', 'info'); return; }
            const defaultName = state.gallery.tagFilter.join(', ');
            const name = prompt('Enter template name:', defaultName);
            if (!name) return;
            state.tagTemplates[name] = [...state.gallery.tagFilter];
            if (typeof saveTrades === 'function') saveTrades();
            updateMenu();
            showToast(`Saved "${name}"`, 'success');
        };
        menu.appendChild(saveRow);
    };

    tplBtn.onclick = (e) => {
        e.stopPropagation();
        const isOpen = menu.style.display === 'block';
        // Close all other instances if any
        document.querySelectorAll('#gv2-tpl-custom-menu').forEach(m => m.style.display = 'none');
        if (!isOpen) {
            updateMenu();
            menu.style.display = 'block';
        }
    };

    // Close menu when clicking outside
    const hideMenu = (e) => { if (!menu.contains(e.target) && e.target !== tplBtn) menu.style.display = 'none'; };
    document.addEventListener('mousedown', hideMenu);

    tplRow.appendChild(tplBtn);
    tplRow.appendChild(menu);
    if (header) header.appendChild(tplRow);

    // Scope toggle: Image vs Trade
    const scopeRow = document.createElement('div');
    scopeRow.style.cssText = 'display:flex; gap:6px; padding:0 8px 8px; align-items:center;';
    const scopeLbl = document.createElement('span');
    scopeLbl.textContent = 'Scope:';
    scopeLbl.style.cssText = 'color:var(--text3); font-size:0.75rem; white-space:nowrap;';
    const isTradeScope = state.gallery.filterTagScope === 'trade';
    const btnScopeImg = document.createElement('button');
    btnScopeImg.className = 'panel-act-btn';
    btnScopeImg.style.flex = '1';
    btnScopeImg.textContent = 'Image';
    btnScopeImg.style.color = !isTradeScope ? 'var(--blue)' : '';
    btnScopeImg.style.borderColor = !isTradeScope ? 'var(--blue)' : '';
    btnScopeImg.addEventListener('click', () => {
        state.gallery.filterTagScope = 'image';
        applyGalleryImageScopeByTagFilter();
        state.gallery._skipFilterRescopeOnce = true;
        renderGallery();
        renderGalleryTagFilterPanel();
    });
    const btnScopeTrade = document.createElement('button');
    btnScopeTrade.className = 'panel-act-btn';
    btnScopeTrade.style.flex = '1';
    btnScopeTrade.textContent = 'Trade';
    btnScopeTrade.style.color = isTradeScope ? 'var(--green)' : '';
    btnScopeTrade.style.borderColor = isTradeScope ? 'var(--green)' : '';
    btnScopeTrade.addEventListener('click', () => {
        state.gallery.filterTagScope = 'trade';
        applyGalleryImageScopeByTagFilter();
        state.gallery._skipFilterRescopeOnce = true;
        renderGallery();
        renderGalleryTagFilterPanel();
    });
    scopeRow.appendChild(scopeLbl);
    scopeRow.appendChild(btnScopeImg);
    scopeRow.appendChild(btnScopeTrade);
    if (header) header.appendChild(scopeRow);

    // Export PDF Button
    const pdfRow = document.createElement('div');
    pdfRow.style.cssText = 'padding: 0 8px 8px;';
    const btnExportPdf = document.createElement('button');
    btnExportPdf.className = 'panel-act-btn';
    btnExportPdf.style.cssText = 'width:100%; border-color:var(--red,#f85149); color:var(--red,#f85149); font-weight:700; background:rgba(248,81,73,0.05);';
    btnExportPdf.innerHTML = '&#128196; Export Filtered to PDF';
    btnExportPdf.addEventListener('click', async () => {
        const metaToExport = state.gallery._filteredMeta || (state.gallery.images || []).map(url => ({ url, date: state.gallery.date, sourceRow: state.gallery.sourceRow }));
        if (!metaToExport.length) {
            if (typeof showToast === 'function') showToast('No images to export.', 'error');
            return;
        }
        
        const tagFilter = Array.isArray(state.gallery.tagFilter) ? state.gallery.tagFilter : [];
        if (tagFilter.length) {
            filename = `filtered_${tagFilter.join('_')}`.slice(0, 50);
        }
        
        await exportService.exportImagesToPdf(metaToExport, `${filename}.pdf`, tagFilter);
    });
    pdfRow.appendChild(btnExportPdf);
    if (header) header.appendChild(pdfRow);

    const list = document.createElement('div');
    list.className = 'panel-list';
    list.style.flex = '1';

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

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.some(t => String(t).toLowerCase().trim() === tag.toLowerCase().trim());
            chk.addEventListener('change', () => {
                let filter = Array.isArray(state.gallery.tagFilter) ? state.gallery.tagFilter : [];
                const tagLower = tag.toLowerCase().trim();
                if (chk.checked) {
                    if (!filter.some(t => String(t).toLowerCase().trim() === tagLower)) filter.push(tag);
                } else {
                    filter = filter.filter(t => String(t).toLowerCase().trim() !== tagLower);
                }
                state.gallery.tagFilter = filter;
                applyGalleryImageScopeByTagFilter();
                state.gallery._skipFilterRescopeOnce = true;
                renderGallery();
                renderGalleryTagCloud();
                _updateFilterBtnColor();
            });

            lbl.appendChild(chk);

            const tl = document.createElement('span');
            tl.textContent = tag;
            tl.style.flex = 1;

            const imgUrl = state.tagImages[tag];
            if (imgUrl) {
                const img = document.createElement('img');
                img.src = resolveImageUrl(imgUrl);
                img.style.cssText = 'height:60px; width:100%; object-fit:contain; border-radius:4px; margin:4px 0; border:1px solid rgba(255,255,255,0.1); background:#000; display:block;';
                lbl.appendChild(img);
                lbl.style.flexDirection = 'column';
                lbl.style.alignItems = 'flex-start';
                lbl.style.padding = '8px';
                lbl.style.background = 'rgba(255,255,255,0.03)';
                lbl.style.borderRadius = '8px';
                lbl.style.border = '1px solid rgba(255,255,255,0.1)';
                lbl.style.width = '120px'; // larger card for filter
                tl.style.fontSize = '0.78rem';
                tl.style.fontWeight = '600';
                tl.style.marginTop = '4px';
                chk.style.alignSelf = 'flex-end'; // put checkbox at top right?
            }

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

    listContainer.appendChild(list);
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
