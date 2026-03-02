# JS — Gallery Tags (tag cloud / filter)
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `static\js\gallery-tags.js`
```js
function renderGalleryTagCloud() {
  const chips = document.getElementById('gv2-tag-cloud-chips');
  const modeBtn = document.getElementById('gv2-tc-mode-btn');
  const clearBtn = document.getElementById('gv2-tc-clear-btn');
  if (!chips) return;
  chips.innerHTML = '';

  const info = getCurrentGalleryImageTagInfo();
  const availableSet = new Set(info.all);
  const allTagNames = info.all;
  const selected = state.gallery.tagFilter || [];
  state.gallery.tagFilter = selected.filter(t => availableSet.has(t));
  const grouped = state.tagGroups || {};

  const renderChip = (tag) => {
    const chip = document.createElement('span');
    chip.className = 'gv2-tc-chip' + (state.gallery.tagFilter.includes(tag) ? ' selected' : '');
    chip.textContent = tag;
    chip.addEventListener('click', () => {
      const idx = state.gallery.tagFilter.indexOf(tag);
      if (idx === -1) state.gallery.tagFilter.push(tag);
      else state.gallery.tagFilter.splice(idx, 1);
      renderGalleryTagCloud();
      renderGallery();
    });
    chips.appendChild(chip);
  };

  Object.keys(grouped).forEach(g => {
    const tags = (grouped[g] || []).filter(t => availableSet.has(t));
    if (!tags.length) return;
    const lbl = document.createElement('span');
    lbl.className = 'gv2-tc-group';
    lbl.textContent = g;
    chips.appendChild(lbl);
    tags.forEach(renderChip);
  });
  const groupedTags = new Set(Object.values(grouped).flat());
  const ungrouped = allTagNames.filter(t => !groupedTags.has(t));
  if (ungrouped.length) {
    const lbl = document.createElement('span');
    lbl.className = 'gv2-tc-group';
    lbl.textContent = 'Ungrouped';
    chips.appendChild(lbl);
    ungrouped.forEach(renderChip);
  }
  if (!allTagNames.length) {
    const hint = document.createElement('span');
    hint.className = 'gv2-tc-group';
    hint.textContent = 'No tags on this image';
    chips.appendChild(hint);
  }

  const hasFilter = (state.gallery.tagFilter || []).length > 0;
  if (modeBtn) {
    const isAnd = state.gallery.filterMode === 'and';
    modeBtn.textContent = isAnd ? 'AND' : 'OR';
    modeBtn.classList.toggle('and-mode', isAnd);
  }
  if (clearBtn) clearBtn.style.display = hasFilter ? '' : 'none';
}

function renderGalleryTagsTray() {
  const body = document.getElementById('gv2-tags-tray-body');
  if (!body) return;
  body.innerHTML = '';

  const allTags = state.allTags || [];
  const imgInfo = getCurrentGalleryImageTagInfo();
  const imageAssignedSet = new Set(imgInfo.imageTags);
  const selectedMarqueeTagSet = getSelectedMarqueeTagSet();
  const marqueeMode = isMarqueeSelectionActive();
  const currentImageTagSet = marqueeMode ? selectedMarqueeTagSet : new Set(imgInfo.all);
  refreshMarqueeTagSuggestions();
  const groups = state.tagGroups || {};
  const groupNames = Object.keys(groups);
  const deleteMode = !!state.tagDeleteMode;
  const delBtn = document.getElementById('gv2-del-tag-btn');
  if (delBtn) delBtn.classList.toggle('active', deleteMode);
  let draggingTag = '';
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

  Array.from(tagUsageCount.keys()).forEach(t => {
    if (!state.allTags.includes(t)) state.allTags.push(t);
  });

  const normalizeGroups = () => {
    const valid = new Set(allTags);
    Object.keys(state.tagGroups).forEach(g => {
      state.tagGroups[g] = Array.from(new Set((state.tagGroups[g] || []).filter(t => valid.has(t))));
    });
  };

  const toggleTagFilter = (tag) => {
    const idx = state.gallery.tagFilter.indexOf(tag);
    if (idx === -1) state.gallery.tagFilter.push(tag);
    else state.gallery.tagFilter.splice(idx, 1);
    renderGalleryTagCloud();
    renderGallery();
  };

  const moveTagToGroup = (tag, targetGroup = '') => {
    Object.keys(state.tagGroups).forEach(g => {
      state.tagGroups[g] = (state.tagGroups[g] || []).filter(t => t !== tag);
    });
    if (targetGroup) {
      if (!state.tagGroups[targetGroup]) state.tagGroups[targetGroup] = [];
      if (!state.tagGroups[targetGroup].includes(tag)) state.tagGroups[targetGroup].push(tag);
    }
    saveTagGroups();
    renderGalleryTagsTray();
  };

  const createTagChip = (tag, grpName = '') => {
    const chip = document.createElement('span');
    chip.className = 'gv2-tt-tag-chip';
    const countVal = tagUsageCount.get(tag) || 0;
    const isFreq = countVal > 5;
    const lbl = document.createElement('span');
    lbl.textContent = tag;
    if (isFreq) lbl.style.color = '#ff6b6b';
    const cnt = document.createElement('span');
    cnt.className = 'gv2-tt-tag-count';
    cnt.textContent = String(countVal);
    if (isFreq) cnt.style.color = '#ff6b6b';
    chip.appendChild(lbl);
    chip.appendChild(cnt);
    if (currentImageTagSet.has(tag)) chip.classList.add('selected-on-image');
    if (marqueeMode) {
      if (currentImageTagSet.has(tag)) chip.title = 'Tag on selected marquee';
      else chip.title = 'Add to selected marquee';
    } else if (imageAssignedSet.has(tag)) chip.title = 'Image tag assigned';
    else if (currentImageTagSet.has(tag)) chip.title = 'Marquee tag present on this image';
    chip.setAttribute('draggable', 'true');
    chip.addEventListener('click', async () => {
      if (state.tagDeleteMode) {
        deleteImageTagGlobal(tag);
        state.allTags = (state.allTags || []).filter(t => t !== tag);
        Object.keys(state.tagGroups).forEach(g => {
          state.tagGroups[g] = (state.tagGroups[g] || []).filter(t => t !== tag);
        });
        saveTagGroups();
        await saveTrades();
        renderGalleryTagCloud();
        renderGalleryTagsTray();
        renderTable();
        renderCalendar();
        return;
      }
      if (marqueeMode) {
        if (!toggleTagOnSelectedMarquees(tag)) return;
        renderGalleryImageTags();
        renderGalleryTagCloud();
        renderGalleryTagsTray();
        return;
      }
      if (!imgInfo.imgUrl) {
        showToast('No image row found to assign tag', 'error');
        return;
      }
      const next = imageAssignedSet.has(tag)
        ? imgInfo.imageTags.filter(t => t !== tag)
        : [...imgInfo.imageTags, tag];
      if (imgInfo.ownerType === 'trade' && imgInfo.trade) setImageTagsForUrl(imgInfo.trade, imgInfo.imgUrl, next);
      else if (imgInfo.ownerType === 'day' && imgInfo.dateKey) setDayImageTagsForUrl(imgInfo.dateKey, imgInfo.imgUrl, next);
      else {
        showToast('No image row found to assign tag', 'error');
        return;
      }
      normalizeAllTagsFromTrades();
      await saveTrades();
      renderGalleryImageTags();
      renderGalleryTagCloud();
      renderGalleryTagsTray();
      renderTable();
      renderCalendar();
    });
    chip.addEventListener('dragstart', e => {
      draggingTag = tag;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', tag);
      chip.classList.add('dragging');
    });
    chip.addEventListener('dragend', () => {
      draggingTag = '';
      chip.classList.remove('dragging');
    });
    chip.addEventListener('contextmenu', e => {
      const availableGroups = Object.keys(state.tagGroups).filter(g => !(state.tagGroups[g] || []).includes(tag));
      const inGroups = Object.keys(state.tagGroups).filter(g => (state.tagGroups[g] || []).includes(tag));
      const items = [
        {
          label: '✏ Rename tag', action: () => {
            const newTag = prompt('Rename tag:', tag);
            if (newTag && newTag.trim() && newTag.trim() !== tag) renameTagEverywhere(tag, newTag.trim());
          }
        },
        {
          label: '🗑 Delete globally', action: async () => {
            if (confirm(`Delete tag "${tag}" globally from all images and records?`)) {
              if (typeof deleteImageTagGlobal === 'function') {
                deleteImageTagGlobal(tag);
                state.allTags = (state.allTags || []).filter(t => t !== tag);
                Object.keys(state.tagGroups).forEach(g => {
                  state.tagGroups[g] = (state.tagGroups[g] || []).filter(t => t !== tag);
                });
                saveTagGroups();
                await saveTrades();
                renderGalleryTagCloud();
                renderGalleryTagsTray();
                renderTable();
                renderCalendar();
              }
            }
          }
        }
      ];
      if (availableGroups.length) {
        items.push('sep');
        items.push({ header: 'Move to group:' });
        availableGroups.forEach(g => items.push({ label: '→ ' + g, action: () => moveTagToGroup(tag, g) }));
      }
      if (inGroups.length) {
        items.push('sep');
        items.push({ label: '✕ Remove from group', action: () => moveTagToGroup(tag, '') });
      }
      showCtxMenu(e, items);
    });
    return chip;
  };

  const bindDropTarget = (el, targetGroup = '') => {
    el.addEventListener('dragover', e => {
      e.preventDefault();
      el.classList.add('drop-hover');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drop-hover'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('drop-hover');
      const tag = draggingTag || e.dataTransfer.getData('text/plain');
      if (!tag || !allTags.includes(tag)) return;
      moveTagToGroup(tag, targetGroup);
    });
  };

  normalizeGroups();

  const topTags = Array.from(tagUsageCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0])
    .slice(0, 8);

  if (topTags.length > 0) {
    const grpF = document.createElement('div');
    grpF.className = 'gv2-tt-group';
    const hdr = document.createElement('div');
    hdr.className = 'gv2-tt-grp-hdr';
    const lbl = document.createElement('span');
    lbl.textContent = '★ FREQUENT TAGS';
    lbl.style.color = '#ffb347';
    lbl.style.fontWeight = 'bold';
    hdr.appendChild(lbl);
    grpF.appendChild(hdr);
    const wrap = document.createElement('div');
    wrap.className = 'gv2-tt-wrap';
    topTags.forEach(t => wrap.appendChild(createTagChip(t, '')));
    grpF.appendChild(wrap);
    body.appendChild(grpF);
  }

  groupNames.forEach(grpName => {
    const grp = document.createElement('div');
    grp.className = 'gv2-tt-group';

    const hdr = document.createElement('div');
    hdr.className = 'gv2-tt-grp-hdr';
    const lbl = document.createElement('span');
    lbl.textContent = grpName;
    lbl.title = 'Right-click to rename';
    lbl.style.cursor = 'pointer';
    lbl.style.color = '#58a6ff';
    lbl.style.fontWeight = 'bold';
    lbl.addEventListener('contextmenu', e => {
      showCtxMenu(e, [{
        label: '✏ Rename group', action: () => {
          const newName = prompt('Rename group:', grpName);
          if (!newName || !newName.trim() || newName.trim() === grpName) return;
          const n = newName.trim();
          if (state.tagGroups[n] && n !== grpName) { showToast('Group already exists', 'error'); return; }
          state.tagGroups[n] = state.tagGroups[grpName] || [];
          if (n !== grpName) delete state.tagGroups[grpName];
          saveTagGroups();
          renderGalleryTagsTray();
        }
      }]);
    });
    const delBtn = document.createElement('button');
    delBtn.className = 'gv2-tt-grp-del';
    delBtn.textContent = '✕';
    delBtn.title = 'Delete group';
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm(`Delete group "${grpName}"? Tags will become ungrouped.`)) {
        delete state.tagGroups[grpName];
        saveTagGroups();
        renderGalleryTagsTray();
      }
    });
    hdr.appendChild(lbl);
    hdr.appendChild(delBtn);

    const tagWrap = document.createElement('div');
    tagWrap.className = 'gv2-tt-grp-tags';
    bindDropTarget(grp, grpName);
    bindDropTarget(tagWrap, grpName);

    const tags = (groups[grpName] || []).filter(t => allTags.includes(t));
    tags.forEach(tag => tagWrap.appendChild(createTagChip(tag, grpName)));
    if (!tags.length) {
      const hint = document.createElement('div');
      hint.className = 'gv2-tt-drop-hint';
      hint.textContent = 'Drop tags here';
      tagWrap.appendChild(hint);
    }

    grp.appendChild(hdr);
    grp.appendChild(tagWrap);
    body.appendChild(grp);
  });

  const groupedTags = new Set(Object.values(state.tagGroups).flat());
  const ungroupedTags = allTags.filter(t => !groupedTags.has(t));
  const sec = document.createElement('div');
  sec.className = 'gv2-tt-unassigned';
  const lbl = document.createElement('div');
  lbl.className = 'gv2-tt-unassigned-lbl';
  lbl.textContent = 'Ungrouped';
  const wrap = document.createElement('div');
  wrap.className = 'gv2-tt-grp-tags';
  bindDropTarget(sec, '');
  bindDropTarget(wrap, '');
  ungroupedTags.forEach(tag => wrap.appendChild(createTagChip(tag)));
  if (!ungroupedTags.length) {
    const hint = document.createElement('div');
    hint.className = 'gv2-tt-drop-hint';
    hint.textContent = 'Drop tags here';
    wrap.appendChild(hint);
  }
  sec.appendChild(lbl);
  sec.appendChild(wrap);
  body.appendChild(sec);

  if (!allTags.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--text3);font-size:0.78rem;padding:8px';
    empty.textContent = 'No tags created yet.';
    body.appendChild(empty);
  }
}



```

## File: `static\js\gallery-tags-filter.js`
```js
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

```
