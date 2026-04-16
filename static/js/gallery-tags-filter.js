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
    searchRow.style.cssText = 'padding: 8px; position: relative;';
    
    const searchInp = document.createElement('input');
    searchInp.id = 'gv2-tag-filter-search-inp';
    searchInp.className = 'panel-search';
    searchInp.placeholder = 'Search tags...';
    searchInp.style.cssText = 'width: 100%; padding-right: 30px;'; // make room for x
    
    const clearInpBtn = document.createElement('button');
    clearInpBtn.innerHTML = '&#10005;';
    clearInpBtn.style.cssText = 'position: absolute; right: 16px; top: 18px; background: transparent; border: none; color: var(--text3); cursor: pointer; display: none; font-size: 14px; padding: 4px;';
    
    searchInp.addEventListener('input', () => {
        clearInpBtn.style.display = searchInp.value ? 'block' : 'none';
        renderFilterList(searchInp.value);
    });

    clearInpBtn.onclick = () => {
        searchInp.value = '';
        clearInpBtn.style.display = 'none';
        renderFilterList('');
        searchInp.focus();
    };

    searchRow.appendChild(searchInp);
    searchRow.appendChild(clearInpBtn);
    if (header) header.appendChild(searchRow);

    const tagUsageCount = calculateGalleryTagCounts();
    window._tagCountMap = tagUsageCount;

    const actRow = document.createElement('div');
    actRow.className = 'panel-act-row';
    actRow.style.cssText = 'display:flex; gap:6px; padding:0 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.05);';

    const btnClear = document.createElement('button');
    btnClear.className = 'panel-act-btn';
    btnClear.style.cssText = 'flex:1; font-weight:700; color:var(--text);';
    btnClear.textContent = 'Clear Filter';
    btnClear.onclick = () => {
        state.gallery.tagFilter = [];
        applyGalleryImageScopeByTagFilter();
        if (typeof renderGalleryTagCloud === 'function') renderGalleryTagCloud();
        renderGallery();
        renderGalleryTagFilterPanel();
    };

    const optModal = document.getElementById('gv2-filter-opts-modal');
    const optModalContent = document.getElementById('gv2-filter-opts-modal-content');

    const btnOpt = document.createElement('button');
    btnOpt.className = 'panel-act-btn';
    btnOpt.style.cssText = 'flex:1; justify-content:space-between; padding:0 10px; color:var(--blue);';
    btnOpt.innerHTML = '<span>Filter Options...</span><span style="opacity:0.6">▾</span>';

    const renderOptMenu = () => {
        if (!optModalContent) return;
        optModalContent.innerHTML = '';
        
        // Match Mode section
        const mmWrap = document.createElement('div');
        mmWrap.style.padding = '12px 14px';
        mmWrap.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        const mmLbl = document.createElement('div');
        mmLbl.style.fontSize = '10px'; mmLbl.style.color = 'var(--text3)'; mmLbl.style.marginBottom = '6px';
        mmLbl.textContent = 'MATCH MODE';
        mmWrap.appendChild(mmLbl);
        const mmBtn = document.createElement('button');
        mmBtn.className = 'panel-act-btn';
        mmBtn.style.width = '100%'; mmBtn.style.height = '34px';
        const isAnd = state.gallery.filterMode === 'and';
        mmBtn.textContent = isAnd ? 'Match: ALL (AND)' : 'Match: ANY (OR)';
        mmBtn.style.color = isAnd ? 'var(--blue)' : 'var(--orange)';
        mmBtn.onclick = () => {
            state.gallery.filterMode = state.gallery.filterMode === 'and' ? 'or' : 'and';
            applyGalleryImageScopeByTagFilter();
            renderGallery();
            renderOptMenu();
        };
        mmWrap.appendChild(mmBtn);
        optModalContent.appendChild(mmWrap);

        // Scope section
        const scWrap = document.createElement('div');
        scWrap.style.padding = '12px 14px';
        scWrap.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        const scLbl = document.createElement('div');
        scLbl.style.fontSize = '10px'; scLbl.style.color = 'var(--text3)'; scLbl.style.marginBottom = '8px';
        scLbl.textContent = 'FILTER SCOPE';
        scWrap.appendChild(scLbl);
        const scBtns = document.createElement('div');
        scBtns.style.display = 'flex'; scBtns.style.gap = '8px';
        const isTrade = state.gallery.filterTagScope === 'trade';
        ['Image','Trade'].forEach(sc => {
            const b = document.createElement('button');
            b.className = 'panel-act-btn'; b.style.flex = '1'; b.textContent = sc; b.style.height = '32px';
            const active = (sc === 'Image' && !isTrade) || (sc === 'Trade' && isTrade);
            if(active) { b.style.color = sc==='Image' ? 'var(--blue)' : 'var(--green)'; b.style.borderColor = b.style.color; }
            b.onclick = () => {
                state.gallery.filterTagScope = sc.toLowerCase();
                applyGalleryImageScopeByTagFilter();
                renderGallery();
                renderOptMenu();
            };
            scBtns.appendChild(b);
        });
        scWrap.appendChild(scBtns);
        optModalContent.appendChild(scWrap);

        // Recall Template
        const tplWrap = document.createElement('div');
        tplWrap.style.padding = '12px 14px';
        tplWrap.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        const tplLbl = document.createElement('div');
        tplLbl.style.fontSize = '10px'; tplLbl.style.color = 'var(--text3)'; tplLbl.style.marginBottom = '8px';
        tplLbl.textContent = 'RECALL TEMPLATE';
        tplWrap.appendChild(tplLbl);
        const tplList = document.createElement('div');
        tplList.style.display = 'flex'; tplList.style.flexDirection = 'column'; tplList.style.gap = '8px';
        const templates = state.tagTemplates || {};
        const keys = Object.keys(templates).sort();
        if(!keys.length) {
            tplList.innerHTML = '<div style="font-size:11px; opacity:0.4; text-align:center;">No templates</div>';
        } else {
            keys.forEach(name => {
                const b = document.createElement('div');
                b.style.cssText = 'display:flex; align-items:center; gap:8px; cursor:pointer; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.03);';
                const n = document.createElement('span'); n.textContent = name;
                n.style.cssText = 'flex:1; font-size:12px; font-weight:500;';
                n.onclick = () => {
                    state.gallery.tagFilter = [...templates[name]];
                    applyGalleryImageScopeByTagFilter();
                    renderGallery();
                    renderGalleryTagFilterPanel();
                    if(optModal) optModal.style.display = 'none';
                };
                const del = document.createElement('span'); del.innerHTML = '×';
                del.style.cssText = 'opacity:0.3; cursor:pointer; padding:0 8px; font-size:18px;';
                del.onclick = (e) => {
                    e.stopPropagation();
                    if(!confirm(`Delete "${name}"?`)) return;
                    delete state.tagTemplates[name];
                    if(typeof saveTrades === 'function') saveTrades();
                    renderOptMenu();
                };
                b.appendChild(n); b.appendChild(del);
                tplList.appendChild(b);
            });
        }
        const saveNew = document.createElement('button');
        saveNew.className = 'panel-act-btn'; saveNew.style.width = '100%'; saveNew.style.marginTop='10px';
        saveNew.style.fontSize='11px'; saveNew.textContent = '+ SAVE AS NEW TEMPLATE';
        saveNew.onclick = () => {
            if(!state.gallery.tagFilter?.length) { showToast('Select tags first!','info'); return; }
            const name = prompt('Template name:', state.gallery.tagFilter.join(', '));
            if(!name) return;
            state.tagTemplates[name] = [...state.gallery.tagFilter];
            if(typeof saveTrades === 'function') saveTrades();
            renderOptMenu();
        }
        tplWrap.appendChild(tplList); tplWrap.appendChild(saveNew);
        optModalContent.appendChild(tplWrap);

        // PDF Export
        const pdfWrap = document.createElement('div');
        pdfWrap.style.padding = '14px';
        const pdfBtn = document.createElement('button');
        pdfBtn.className = 'panel-act-btn'; pdfBtn.style.width = '100%'; pdfBtn.style.height = '36px';
        pdfBtn.style.borderColor='var(--red)'; pdfBtn.style.color='var(--red)';
        pdfBtn.innerHTML = '&#128196; Export Filtered to PDF';
        pdfBtn.onclick = async () => {
            const meta = state.gallery._filteredMeta || (state.gallery.images || []).map(url => ({ url, date: state.gallery.date, sourceRow: state.gallery.sourceRow }));
            if(!meta.length) return;
            const filter = Array.isArray(state.gallery.tagFilter) ? state.gallery.tagFilter : [];
            await exportService.exportImagesToPdf(meta, `export.pdf`, filter);
            if(optModal) optModal.style.display = 'none';
        };
        pdfWrap.appendChild(pdfBtn);
        optModalContent.appendChild(pdfWrap);
    };

    btnOpt.onclick = (e) => {
        e.stopPropagation();
        if(optModal) {
            renderOptMenu();
            optModal.style.display = 'flex';
        }
    };

    actRow.appendChild(btnClear);
    actRow.appendChild(btnOpt);
    if (header) header.appendChild(actRow);
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

        // ── Special Filters (Virtual Tags) ───────────────────────────────────
        const specialTags = ['📝 HAS NOTES'];
        const filteredSpec = ql ? specialTags.filter(t => t.toLowerCase().includes(ql)) : specialTags;
        if (filteredSpec.length) {
            const gLbl = document.createElement('div');
            gLbl.className = 'panel-manage-label';
            gLbl.style.marginTop = '6px';
            gLbl.style.color = 'var(--blue)';
            gLbl.textContent = '✧ SPECIAL FILTERS';
            list.appendChild(gLbl);
            filteredSpec.forEach(tag => {
                // Manually inject count if needed, but renderListTag will handle it if count exists
                renderListTag(tag);
            });
        }

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
