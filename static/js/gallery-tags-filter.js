/**
 * @fileoverview gallery-tags-filter.js
 * @description Logic hiding thumbnails in Gallery by selected tag conditions.
 */

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
