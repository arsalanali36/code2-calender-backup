# JS - Gallery Tags + Image Tags
Consolidated code context for AI assistants.


## File: `static/js/gallery-tags.js`
```js
/**
 * @fileoverview gallery-tags.js
 * @description Tag cloud (click-to-filter) and tags tray (drag-to-resize) for gallery.
 * @exports renderGalleryTagCloud, renderGalleryTagsTray
 * @reads state.gallery.{images,tagFilter,filterMode}, state.tagGroups, state.trades, state.dayData
 * @writes state.gallery.tagFilter, state.gallery.filterMode (on tag click)
 * @calls applyGalleryImageScopeByTagFilter, renderGallery, saveTagGroups
 */

function renderGalleryTagCloud() {
  const chips = document.getElementById('gv2-tag-cloud-chips');
  const modeBtn = document.getElementById('gv2-tc-mode-btn');
  const clearBtn = document.getElementById('gv2-tc-clear-btn');
  if (!chips) return;
  chips.innerHTML = '';

  const info = getCurrentGalleryImageTagInfo();
  const availableSet = new Set(info.all);
  const allTagNames = info.all;
  // Do NOT clear active filters just because current image doesn't have them —
  // user may be viewing a trade-filtered result where other images hold the tag
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
  const fixed = document.getElementById('gv2-tags-tray-fixed');
  if (!body) return;
  body.innerHTML = '';
  if (fixed) fixed.innerHTML = '';

  // 1. Assign model toggle (Image vs Trade)
  const assignRow = document.createElement('div');
  assignRow.style.cssText = 'display:flex; gap:6px; padding:6px 8px 6px; border-bottom:1px solid var(--border); align-items:center;';
  const assignLbl = document.createElement('span');
  assignLbl.textContent = 'Assign to:';
  assignLbl.style.cssText = 'color:var(--text3); font-size:0.75rem; white-space:nowrap;';
  const isTradeMode = state.gallery.tagAssignMode === 'trade';
  const assignImgBtn = document.createElement('button');
  assignImgBtn.className = 'panel-act-btn';
  assignImgBtn.style.cssText = 'flex:1; font-size:0.75rem; padding:3px 6px;' + (!isTradeMode ? 'color:var(--blue);border-color:var(--blue);' : '');
  assignImgBtn.textContent = 'Image';
  assignImgBtn.addEventListener('click', () => { state.gallery.tagAssignMode = 'image'; renderGalleryTagsTray(); });
  const assignTradeBtn = document.createElement('button');
  assignTradeBtn.className = 'panel-act-btn';
  assignTradeBtn.style.cssText = 'flex:1; font-size:0.75rem; padding:3px 6px;' + (isTradeMode ? 'color:var(--green);border-color:var(--green);' : '');
  assignTradeBtn.textContent = 'Trade';
  assignTradeBtn.addEventListener('click', () => { state.gallery.tagAssignMode = 'trade'; renderGalleryTagsTray(); });
  assignRow.appendChild(assignLbl);
  assignRow.appendChild(assignImgBtn);
  assignRow.appendChild(assignTradeBtn);
  if (fixed) fixed.appendChild(assignRow);
  else body.appendChild(assignRow);

  // Search input
  const searchRow = document.createElement('div');
  searchRow.style.cssText = 'padding:5px 8px 6px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:5px;';
  const searchInp = document.createElement('input');
  searchInp.id = 'gv2-tag-tray-search-inp';
  searchInp.className = 'panel-search';
  searchInp.placeholder = 'Search tags...';
  searchInp.value = state.gallery._tagTraySearch || '';
  searchInp.style.cssText = 'flex:1; box-sizing:border-box; min-width:0; height:32px; font-size:0.9rem; padding:0 8px;';
  const searchClear = document.createElement('button');
  searchClear.textContent = '×';
  searchClear.title = 'Clear search';
  searchClear.style.cssText = 'flex-shrink:0; width:28px; height:32px; background:transparent; border:1px solid rgba(255,255,255,0.15); border-radius:5px; color:#aaa; font-size:1.2rem; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:color 0.15s;';
  searchClear.style.display = (state.gallery._tagTraySearch || '') ? 'flex' : 'none';
  searchClear.addEventListener('mouseenter', () => searchClear.style.color = '#fff');
  searchClear.addEventListener('mouseleave', () => searchClear.style.color = '#aaa');
  searchClear.addEventListener('click', () => {
    searchInp.value = '';
    state.gallery._tagTraySearch = '';
    searchClear.style.display = 'none';
    _applyTagFilter('');
    searchInp.focus();
  });
  searchInp.addEventListener('input', e => {
    const cursorPos = e.target.selectionStart;
    state.gallery._tagTraySearch = e.target.value.toLowerCase();
    searchClear.style.display = e.target.value ? 'flex' : 'none';
    renderGalleryTagsTray();
    // Re-render destroys this input — restore focus on the new element
    const newInp = document.getElementById('gv2-tag-tray-search-inp');
    if (newInp) {
      newInp.focus();
      try { newInp.setSelectionRange(cursorPos, cursorPos); } catch (_) {}
    }
  });
  searchInp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const firstChip = document.querySelector('.gv2-tt-tag-chip');
      if (firstChip) {
        firstChip.setAttribute('tabindex', '0');
        firstChip.focus();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const firstChip = document.querySelector('.gv2-tt-tag-chip');
      if (firstChip) firstChip.click();
    }
  });

  searchRow.appendChild(searchInp);
  searchRow.appendChild(searchClear);
  if (fixed) fixed.appendChild(searchRow);
  else body.appendChild(searchRow);

  if (!state.allTags) state.allTags = [];
  const allTags = state.allTags;
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
  const tagUsageCount = calculateGalleryTagCounts();

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

    const imgUrl = state.tagImages[tag];
    if (imgUrl) {
      const img = document.createElement('img');
      img.src = resolveImageUrl(imgUrl);
      img.style.cssText = 'height:60px; width:100%; object-fit:contain; border-radius:6px; margin-bottom:6px; background:#000; border:1px solid rgba(255,255,255,0.1);';
      chip.prepend(img);
      chip.style.flexDirection = 'column';
      chip.style.alignItems = 'center';
      chip.style.padding = '8px 10px';
      chip.style.width = '84px'; // fixed width for card look
      chip.style.minHeight = '100px'; 
      chip.style.justifyContent = 'flex-start';
      chip.style.textAlign = 'center';
      
      lbl.style.fontSize = '0.78rem';
      lbl.style.fontWeight = '600';
      lbl.style.marginBottom = '4px';
      lbl.style.display = 'block';
      lbl.style.width = '100%';
      lbl.style.overflow = 'hidden';
      lbl.style.textOverflow = 'ellipsis';
      lbl.style.whiteSpace = 'nowrap';
      
      cnt.style.fontSize = '0.7rem';
      cnt.style.background = 'rgba(255,255,255,0.1)';
      cnt.style.padding = '1px 6px';
      cnt.style.borderRadius = '10px';
      cnt.style.marginTop = 'auto';
      
      chip.appendChild(lbl);
      chip.appendChild(cnt);
    } else {
      chip.appendChild(lbl);
      chip.appendChild(cnt);
    }

    chip.setAttribute('tabindex', '0');
    chip.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = chip.nextElementSibling || chip.parentElement.nextElementSibling?.querySelector('.gv2-tt-tag-chip');
        if (next) next.focus();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = chip.previousElementSibling || chip.parentElement.previousElementSibling?.querySelector('.gv2-tt-tag-chip:last-child');
        if (prev) prev.focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        chip.click();
      } else if (e.key === 'Escape') {
        document.getElementById('gv2-tag-tray-search-inp')?.focus();
      }
    });

    const currentTradeTags = imgInfo.trade ? getTradeTagsForTrade(imgInfo.trade) : [];
    if (state.tagDeleteMode) {
      const x = document.createElement('span');
      x.textContent = '✕';
      x.style.cssText = 'margin-left:6px; color:var(--red); font-weight:bold; cursor:pointer; opacity:0.8; transition:opacity 0.2s;';
      x.onmouseover = () => x.style.opacity = '1';
      x.onmouseout = () => x.style.opacity = '0.8';
      chip.appendChild(x);
      chip.style.borderColor = 'rgba(255, 107, 107, 0.4)';
      chip.style.boxShadow = '0 0 5px rgba(255, 107, 107, 0.2)';
      chip.classList.add('delete-mode');
      chip.title = 'Click to DELETE GLOBALLY';
    } else {
      if (currentImageTagSet.has(tag)) chip.classList.add('selected-on-image');
      if (currentTradeTags.includes(tag)) chip.classList.add('selected-on-trade');
      if (marqueeMode) {
        if (currentImageTagSet.has(tag)) chip.title = 'Tag on selected marquee';
        else chip.title = 'Add to selected marquee';
      } else if (state.gallery.tagAssignMode === 'trade') {
        chip.title = currentTradeTags.includes(tag) ? 'Trade tag — click to remove' : 'Assign to current trade';
      } else if (imageAssignedSet.has(tag)) chip.title = 'Image tag assigned';
      else if (currentImageTagSet.has(tag)) chip.title = 'Marquee tag present on this image';
    }
    // Note display below chip label
    if (state.tagNotes && state.tagNotes[tag]) {
      const noteLbl = document.createElement('div');
      noteLbl.className = 'gv2-tag-note';
      noteLbl.textContent = state.tagNotes[tag];
      noteLbl.style.cssText = 'font-size:0.65rem; color:rgba(255,220,100,0.75); font-style:italic; margin-top:2px; white-space:pre-wrap; word-break:break-word; pointer-events:none; line-height:1.3; max-width:100%;';
      chip.appendChild(noteLbl);
    }
    chip.setAttribute('draggable', 'true');
    chip.addEventListener('click', async () => {
      if (state.tagDeleteMode) {
        if (!confirm(`Kya aap is tag "${tag}" ko poora (globally) delete karna chahte hain?`)) return;
        deleteImageTagGlobal(tag);
        state.allTags = (state.allTags || []).filter(t => t !== tag);
        Object.keys(state.tagGroups).forEach(g => {
          state.tagGroups[g] = (state.tagGroups[g] || []).filter(t => t !== tag);
        });
        saveTagGroups();
        await saveTrades();
        renderGalleryTagCloud();
        renderGalleryTagsTray();
        if (typeof renderGalleryTagFilterPanel === 'function') renderGalleryTagFilterPanel();
        renderTable();
        renderCalendar();
        showToast(`Tag "${tag}" globally delete ho gaya`, 'success');
        return;
      }
      if (marqueeMode) {
        if (!toggleTagOnSelectedMarquees(tag)) return;
        renderGalleryImageTags();
        renderGalleryTagCloud();
        renderGalleryTagsTray();
        if (typeof renderGalleryTagFilterPanel === 'function') renderGalleryTagFilterPanel();
        return;
      }
      // Re-read fresh at click time (avoids stale closure pointing to wrong image)
      const liveInfo = getCurrentGalleryImageTagInfo();
      const liveAssignedSet = new Set(liveInfo.imageTags);
      // Trade assign mode
      if (state.gallery.tagAssignMode === 'trade') {
        if (!liveInfo.trade) {
          showToast('No trade found for current image', 'error');
          return;
        }
        const tradeTags = getTradeTagsForTrade(liveInfo.trade);
        const hasTag = tradeTags.includes(tag);
        setTradeTagsForTrade(liveInfo.trade, hasTag ? tradeTags.filter(t => t !== tag) : [...tradeTags, tag]);
        normalizeAllTagsFromTrades();
        await saveTrades();
        renderGalleryImageTags();
        renderGalleryTagCloud();
        renderGalleryTagsTray();
        if (typeof renderGalleryTagFilterPanel === 'function') renderGalleryTagFilterPanel();
        renderTable();
        renderCalendar();
        return;
      }
      if (!liveInfo.imgUrl) {
        showToast('No image row found to assign tag', 'error');
        return;
      }
      const isRemoving = liveAssignedSet.has(tag);

      // If removing, also clean up pins for this tag on current image
      if (isRemoving && typeof getTagPinsForUrl === 'function') {
        const imgUrl = liveInfo.imgUrl;
        const existingPins = getTagPinsForUrl(imgUrl);
        const pinsForTag = existingPins.filter(p => p.tag === tag);
        if (pinsForTag.length > 0) {
          const hasNotes = pinsForTag.some(p => p.note);
          if (hasNotes) {
            if (!confirm(`"${tag}" tag ke ${pinsForTag.length} pin(s) hain jinme note bhi hai. Pin bhi hata dein?`)) return;
          }
          const remainingPins = existingPins.filter(p => p.tag !== tag);
          if (typeof setTagPinsForUrl === 'function') setTagPinsForUrl(imgUrl, remainingPins);
          if (typeof renderTagPins === 'function') renderTagPins();
        }
      }

      const next = isRemoving
        ? liveInfo.imageTags.filter(t => t !== tag)
        : [...liveInfo.imageTags, tag];
      if (liveInfo.ownerType === 'trade' && liveInfo.trade) setImageTagsForUrl(liveInfo.trade, liveInfo.imgUrl, next);
      else if (liveInfo.ownerType === 'day' && liveInfo.dateKey) setDayImageTagsForUrl(liveInfo.dateKey, liveInfo.imgUrl, next);
      else if (liveInfo.ownerType === 'pdf') {
        setPdfPageTags(liveInfo.pdfId, liveInfo.pageNo, next);
      }
      else {
        showToast('No image row found to assign tag', 'error');
        return;
      }
      // Push to undo stack on removal
      if (isRemoving) {
        window._tagUndoStack = window._tagUndoStack || [];
        window._tagUndoStack.push({
          tag,
          imgUrl:    liveInfo.imgUrl,
          ownerType: liveInfo.ownerType,
          trade:     liveInfo.trade || null,
          dateKey:   liveInfo.dateKey || '',
          pdfId:     liveInfo.pdfId  || null,
          pageNo:    liveInfo.pageNo ?? null,
        });
      }
      normalizeAllTagsFromTrades();
      await saveTrades();
      renderGalleryImageTags();
      renderGalleryTagCloud();
      renderGalleryTagsTray();
      if (typeof renderGalleryTagFilterPanel === 'function') renderGalleryTagFilterPanel();
      renderGallery();
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
          label: (state.tagNotes && state.tagNotes[tag]) ? '📝 Edit note' : '📝 Add note',
          action: () => openTagNoteEditor(tag, chip)
        },
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
                if (typeof renderGalleryTagFilterPanel === 'function') renderGalleryTagFilterPanel();
                renderTable();
                renderCalendar();
              }
            }
          }
        },
        {
          label: (state.gallery.managerTags || []).includes(tag) ? '❌ Hide from manager' : '📊 Show in manager', 
          action: () => {
            if (!state.gallery.managerTags) state.gallery.managerTags = [];
            const idx = state.gallery.managerTags.indexOf(tag);
            if (idx === -1) state.gallery.managerTags.push(tag);
            else state.gallery.managerTags.splice(idx, 1);
            saveTagGroups(); // Persist manager tags choice too
            showToast(tag + (idx === -1 ? ' added to' : ' removed from') + ' manager', 'success');
            if (document.getElementById('img-manager-modal')?.style.display === 'flex') {
              renderImageManagerTable();
            }
          }
        }
      ];
      if (availableGroups.length) {
        items.push('sep');
        items.push({ header: 'MOVE TO GROUP:' });
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
    wrap.className = 'gv2-tt-grp-tags';
    topTags.forEach(t => wrap.appendChild(createTagChip(t, '')));
    grpF.appendChild(wrap);
    body.appendChild(grpF);
  }

  // Toggle button state sync
  const viewToggle = document.getElementById('gv2-tag-view-btn');
  if (viewToggle) viewToggle.textContent = state.gallery.tagViewMode === 'grouped' ? 'Grp' : 'All';

  const freqTagsSet = new Set(topTags);

  if (state.gallery.tagViewMode === 'flat') {
    // --- Flattened Tags View ---
    const remainingTags = allTags.filter(t => !freqTagsSet.has(t)).sort((a, b) => a.localeCompare(b));

    if (remainingTags.length > 0) {
      const sec = document.createElement('div');
      sec.className = 'gv2-tt-group';
      const hdr = document.createElement('div');
      hdr.className = 'gv2-tt-grp-hdr';
      const lbl = document.createElement('span');
      lbl.textContent = 'ALL TAGS';
      lbl.style.color = 'var(--text3)';
      lbl.style.fontWeight = 'bold';
      hdr.appendChild(lbl);
      sec.appendChild(hdr);

      const wrap = document.createElement('div');
      wrap.className = 'gv2-tt-grp-tags';
      remainingTags.forEach(tag => wrap.appendChild(createTagChip(tag)));
      sec.appendChild(wrap);
      body.appendChild(sec);
    }
  } else {
    // --- Original Grouped View ---
    groupNames.forEach(grpName => {
      const grp = document.createElement('div');
      grp.className = 'gv2-tt-group';

      const hdr = document.createElement('div');
      hdr.className = 'gv2-tt-grp-hdr';
      const lbl = document.createElement('span');
      lbl.textContent = grpName;
      lbl.title = 'Right-click to rename';
      lbl.style.cursor = 'pointer';
      lbl.style.color = 'var(--blue)';
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
    const ungroupedTags = allTags.filter(t => !groupedTags.has(t) && !freqTagsSet.has(t));
    if (ungroupedTags.length > 0) {
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
      sec.appendChild(lbl);
      sec.appendChild(wrap);
      body.appendChild(sec);
    }
  }

  if (!allTags.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--text3);font-size:0.78rem;padding:8px';
    empty.textContent = 'No tags created yet.';
    body.appendChild(empty);
  }

  // Live filter: show/hide chips and collapse empty groups
  const _applyTagFilter = (q) => {
    const ql = (q || '').toLowerCase().trim();
    body.querySelectorAll('.gv2-tt-tag-chip').forEach(chip => {
      const label = chip.querySelector('span')?.textContent || '';
      chip.style.display = (!ql || label.toLowerCase().includes(ql)) ? '' : 'none';
    });
    body.querySelectorAll('.gv2-tt-group, .gv2-tt-unassigned').forEach(grp => {
      const anyVisible = Array.from(grp.querySelectorAll('.gv2-tt-tag-chip')).some(c => c.style.display !== 'none');
      grp.style.display = anyVisible ? '' : 'none';
    });
  };
  _applyTagFilter(searchInp.value);
  searchInp.addEventListener('input', () => {
    state.gallery._tagTraySearch = searchInp.value;
    searchClear.style.display = searchInp.value ? 'flex' : 'none';
    _applyTagFilter(searchInp.value);
  });
  searchInp.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      searchInp.value = '';
      state.gallery._tagTraySearch = '';
      searchClear.style.display = 'none';
      _applyTagFilter('');
    }
  });
}

/**
 * REUSABLE: Opens a modal to create a tag + group assignment
 */
window.openCreateTagModal = () => {
  const overlay = document.getElementById('gv2-tag-create-overlay');
  const nameInp = document.getElementById('gv2-tag-modal-name');
  const grpSel  = document.getElementById('gv2-tag-modal-group-sel');
  const newGrInp = document.getElementById('gv2-tag-modal-new-grp');
  const cancelBtn = document.getElementById('gv2-tag-modal-cancel');
  const createBtn = document.getElementById('gv2-tag-modal-create');
  if (!overlay || !nameInp || !grpSel || !newGrInp) return;

  // Reset fields
  nameInp.value = '';
  newGrInp.value = '';
  overlay.style.display = 'flex';
  nameInp.focus();

  // Draw Logic
  const drawContainer = document.getElementById('gv2-tag-draw-container');
  const drawToggle = document.getElementById('gv2-tag-draw-toggle');
  const canvas = document.getElementById('gv2-tag-draw-canvas');
  const clearBtn = document.getElementById('gv2-tag-draw-clear');
  let isDrawing = false;
  let ctx = null;

  if (canvas) {
    ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw Listeners
    const getPos = e => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
    };
    const start = e => { isDrawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault(); };
    const move = e => { if (!isDrawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); };
    const stop = () => { isDrawing = false; };
    
    canvas.onmousedown = start; canvas.onmousemove = move; window.onmouseup = stop;
    canvas.ontouchstart = start; canvas.ontouchmove = move; canvas.ontouchend = stop;
    
    if (clearBtn) clearBtn.onclick = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  if (drawToggle) {
    drawToggle.style.display = '';
    drawToggle.onclick = () => {
      const isHidden = drawContainer.style.display === 'none';
      drawContainer.style.display = isHidden ? 'block' : 'none';
      drawToggle.textContent = isHidden ? '- Text Only' : '+ Draw Pattern Tag';
    };
    drawContainer.style.display = 'none'; // reset
    drawToggle.textContent = '+ Draw Pattern Tag';
  }

  const uploadBtn = document.getElementById('gv2-tag-upload-btn');
  const uploadInp = document.getElementById('gv2-tag-upload-input');
  if (uploadBtn && uploadInp) {
    uploadBtn.onclick = () => uploadInp.click();
    uploadInp.onchange = () => {
      if (uploadInp.files.length) {
        uploadBtn.textContent = `Attached: ${uploadInp.files[0].name.slice(0, 10)}...`;
        uploadBtn.style.color = 'var(--blue)';
        // Hide draw container if it was open
        if (drawContainer) drawContainer.style.display = 'none';
        if (drawToggle) drawToggle.textContent = '+ Draw Pattern Tag';
      }
    };
    uploadBtn.textContent = '+ Upload Image Tag';
    uploadBtn.style.color = '';
    uploadInp.value = '';
  }

  // Populate dropdown
  const groups = Object.keys(state.tagGroups || {}).sort();
  grpSel.innerHTML = '<option value="">-- No Group / Ungrouped --</option>';
  groups.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    opt.style.background = '#1e1e23';
    opt.style.color = '#fff';
    grpSel.appendChild(opt);
  });

  // Cleanup listeners
  cancelBtn.onclick = () => { overlay.style.display = 'none'; };

  createBtn.onclick = async () => {
    const t = nameInp.value.trim();
    if (!t) { showToast('Tag name zaroori hai', 'error'); return; }

    let g = newGrInp.value.trim();
    if (!g) g = grpSel.value; // Fallback to selected dropdown item

    // 1. Ensure tag exists in state.allTags
    if (!state.allTags.includes(t)) state.allTags.push(t);

    // 1.5 Handle Image Pattern (Draw or Upload)
    const drawContainer = document.getElementById('gv2-tag-draw-container');
    const canvas = document.getElementById('gv2-tag-draw-canvas');
    const uploadInp = document.getElementById('gv2-tag-upload-input');
    
    let blobToUpload = null;
    if (uploadInp && uploadInp.files.length) {
      blobToUpload = uploadInp.files[0];
    } else if (drawContainer && drawContainer.style.display !== 'none' && canvas) {
      if (typeof canvasHasVisibleInk === 'function' && canvasHasVisibleInk(canvas)) {
        blobToUpload = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      }
    }

    if (blobToUpload) {
      const fd = new FormData();
      fd.append('image', blobToUpload, 'tag_pattern.png');
      fd.append('tag_name', t);
      try {
        const res = await fetch('/api/upload-tag-image', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.url) {
          state.tagImages[t] = data.url;
          saveTagGroups();
        }
      } catch (e) { console.error('Tag image upload failed', e); }
    }

    // 2. Assign to group if specified
    if (g) {
      if (!state.tagGroups[g]) state.tagGroups[g] = [];
      if (!state.tagGroups[g].includes(t)) state.tagGroups[g].push(t);
      saveTagGroups();
    }

    // 3. Assign to current image if one is open
    const info = typeof getCurrentGalleryImageTagInfo === 'function' ? getCurrentGalleryImageTagInfo() : null;
    if (info && info.imgUrl) {
      const existing = Array.isArray(info.imageTags) ? [...info.imageTags] : [];
      if (!existing.includes(t)) {
        existing.push(t);
        if (info.ownerType === 'trade' && info.trade) setImageTagsForUrl(info.trade, info.imgUrl, existing);
        else if (info.ownerType === 'day' && info.dateKey) setDayImageTagsForUrl(info.dateKey, info.imgUrl, existing);
        if (typeof normalizeAllTagsFromTrades === 'function') normalizeAllTagsFromTrades();
        if (typeof saveTrades === 'function') await saveTrades();
        if (typeof renderGalleryImageTags === 'function') renderGalleryImageTags();
        if (typeof renderTable === 'function') renderTable();
        if (typeof renderCalendar === 'function') renderCalendar();
      }
    }

    overlay.style.display = 'none';
    renderGalleryTagsTray();
    showToast(`Tag "${t}" created ${g ? `in group "${g}"` : ''}`, 'success');
  };
};

/**
 * Inline note editor for a tag chip
 */
function openTagNoteEditor(tag, anchorEl) {
  // Remove any existing popover
  const existing = document.getElementById('tag-note-popover');
  if (existing) existing.remove();

  const pop = document.createElement('div');
  pop.id = 'tag-note-popover';
  pop.style.cssText = 'position:fixed; z-index:9999; background:#1e2130; border:1px solid #ffd700; border-radius:8px; padding:10px; box-shadow:0 4px 20px rgba(0,0,0,0.6); min-width:220px; max-width:300px;';

  const title = document.createElement('div');
  title.textContent = `Note for "${tag}"`;
  title.style.cssText = 'font-size:0.75rem; color:#ffd700; font-weight:700; margin-bottom:6px;';
  pop.appendChild(title);

  const ta = document.createElement('textarea');
  ta.value = (state.tagNotes && state.tagNotes[tag]) || '';
  ta.placeholder = 'Type note here...';
  ta.rows = 4;
  ta.style.cssText = 'width:100%; box-sizing:border-box; background:#111420; color:#e0e0e0; border:1px solid rgba(255,255,255,0.15); border-radius:5px; padding:6px 8px; font-size:0.8rem; resize:vertical; outline:none; font-family:inherit;';
  pop.appendChild(ta);

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex; gap:6px; margin-top:7px; justify-content:flex-end;';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.style.cssText = 'background:#ffd700; color:#111; border:none; border-radius:5px; padding:4px 14px; cursor:pointer; font-weight:700; font-size:0.78rem;';

  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear';
  clearBtn.style.cssText = 'background:transparent; color:rgba(255,100,100,0.8); border:1px solid rgba(255,100,100,0.4); border-radius:5px; padding:4px 10px; cursor:pointer; font-size:0.78rem;';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'background:transparent; color:#aaa; border:1px solid rgba(255,255,255,0.15); border-radius:5px; padding:4px 10px; cursor:pointer; font-size:0.78rem;';

  const doSave = (text) => {
    if (!state.tagNotes) state.tagNotes = {};
    if (text) state.tagNotes[tag] = text;
    else delete state.tagNotes[tag];
    saveTagGroups();
    pop.remove();
    renderGalleryTagsTray();
  };

  saveBtn.addEventListener('click', () => doSave(ta.value.trim()));
  clearBtn.addEventListener('click', () => doSave(''));
  cancelBtn.addEventListener('click', () => pop.remove());

  // Ctrl+Enter to save
  ta.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.ctrlKey) { ev.preventDefault(); doSave(ta.value.trim()); }
    if (ev.key === 'Escape') pop.remove();
  });

  btnRow.appendChild(clearBtn);
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
  pop.appendChild(btnRow);
  document.body.appendChild(pop);

  // Position near anchor
  const rect = anchorEl.getBoundingClientRect();
  const pw = 300, ph = 160;
  let top = rect.bottom + 6;
  let left = rect.left;
  if (top + ph > window.innerHeight) top = rect.top - ph - 6;
  if (left + pw > window.innerWidth) left = window.innerWidth - pw - 10;
  pop.style.top = top + 'px';
  pop.style.left = left + 'px';

  ta.focus();

  // Close on outside click
  setTimeout(() => {
    const onOut = (ev) => { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('mousedown', onOut); } };
    document.addEventListener('mousedown', onOut);
  }, 50);
}

/**
 * Undo last image-tag removal (Ctrl+Z in gallery)
 */
async function restoreLastDeletedImageTag() {
  const stack = window._tagUndoStack;
  if (!stack || !stack.length) return;
  const entry = stack.pop();
  const { tag, imgUrl, ownerType, trade, dateKey, pdfId, pageNo } = entry;

  if (ownerType === 'trade' && trade) {
    const current = getImageTagsForUrl(trade, imgUrl);
    if (!current.includes(tag)) setImageTagsForUrl(trade, imgUrl, [...current, tag]);
  } else if (ownerType === 'day' && dateKey) {
    const current = getDayImageTagsForUrl(dateKey, imgUrl);
    if (!current.includes(tag)) setDayImageTagsForUrl(dateKey, imgUrl, [...current, tag]);
  } else if (ownerType === 'pdf' && pdfId !== null && typeof setPdfPageTags === 'function') {
    // getPdfPageTags not available — restore by setting tag directly
    setPdfPageTags(pdfId, pageNo, [tag]);
  } else {
    showToast('Undo failed — image no longer found', 'error');
    return;
  }

  normalizeAllTagsFromTrades();
  await saveTrades();
  renderGalleryImageTags();
  renderGalleryTagCloud();
  renderGalleryTagsTray();
  if (typeof renderGalleryTagFilterPanel === 'function') renderGalleryTagFilterPanel();
  renderGallery();
  renderTable();
  renderCalendar();
  showToast(`Tag "${tag}" restored`, 'success');
}

```

## File: `static/js/gallery-tags-b.js`
- Missing from workspace

## File: `static/js/gallery-tags-filter.js`
```js
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

```

## File: `static/js/gallery-img-tags.js`
```js
/**
 * @fileoverview gallery-img-tags.js
 * @description Image-level tag rendering, global rename/delete across all data, tag manager modal.
 * @exports renderGalleryImageTags, getAllImageTagsGlobal, isPermanentImageTag,
 *          renameImageTagGlobal, deleteImageTagGlobal,
 *          openGalleryImageTagManager, closeGalleryImageTagManager,
 *          renderImageTagModal, addImageTagFromModal
 * @reads state.gallery, state.trades, state.dayData, state.tagGroups
 * @writes trade.imageTags, dayData.imageTags (rename/delete propagated everywhere)
 * @calls saveTrades, renderGallery, renameTagEverywhere
 */

function renderGalleryImageTags() {
  const box = document.getElementById('gallery-image-tags');
  if (!box) return;
  box.innerHTML = '';

  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  const info = getCurrentGalleryImageTagInfo();
  const tags = info.imageTags || [];
  const marqueeTags = info.marqueeTags || [];

  const tradeTags = info.tradeTags || [];
  if (!tags.length && !marqueeTags.length && !tradeTags.length) {
    box.style.display = 'none';
    return;
  }
  box.style.display = 'flex';

  if (tags.length) {
    const imgLbl = document.createElement('span');
    imgLbl.className = 'gallery-tag-empty';
    imgLbl.textContent = 'Image:';
    box.appendChild(imgLbl);
    tags.forEach(tag => {
      const isRed = tags.length > 5;
      const c = isRed ? '#ff6b6b' : tagColor(tag);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'gallery-img-tag-chip';
      const imgUrlMap = (state.tagImages || {})[tag];
      if (imgUrlMap) {
        const img = document.createElement('img');
        img.src = resolveImageUrl(imgUrlMap);
        img.style.cssText = 'height:28px; width:auto; vertical-align:middle; border-radius:3px; margin-right:6px; border:1px solid rgba(255,255,255,0.15); background:#000;';
        chip.appendChild(img);
      }
      const txt = document.createElement('span');
      txt.textContent = `${tag} x`;
      chip.appendChild(txt);
      chip.style.color = c;
      chip.style.borderColor = hexToRgba(c, 0.45);
      chip.style.background = isRed ? 'rgba(255, 107, 107, 0.16)' : hexToRgba(c, 0.16);
      chip.title = 'Remove tag from this image';
      chip.addEventListener('click', async () => {
        window._tagUndoStack = window._tagUndoStack || [];
        window._tagUndoStack.push({ tag, imgUrl, ownerType: info.ownerType, trade: info.trade, dateKey: info.dateKey, origTags: [...tags] });
        if (window._tagUndoStack.length > 20) window._tagUndoStack.shift();

        const next = tags.filter(t => t !== tag);
        if (info.ownerType === 'trade' && info.trade) setImageTagsForUrl(info.trade, imgUrl, next);
        else if (info.ownerType === 'day' && info.dateKey) setDayImageTagsForUrl(info.dateKey, imgUrl, next);
        else if (info.ownerType === 'pdf') setPdfPageTags(info.pdfId, info.pageNo, next);
        await saveTrades();
        renderGalleryImageTags();
        if (typeof renderGalleryTagFilterPanel === 'function') renderGalleryTagFilterPanel();
        renderGallery();
        renderTable();
        renderCalendar();
      });
      box.appendChild(chip);
    });
  }

  if (tradeTags.length) {
    if (tags.length || marqueeTags.length) box.appendChild(document.createTextNode(' '));
    const tradeLbl = document.createElement('span');
    tradeLbl.className = 'gallery-tag-empty';
    tradeLbl.textContent = 'Trade:';
    box.appendChild(tradeLbl);
    tradeTags.forEach(tag => {
      const c = '#3fb950';
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'gallery-img-tag-chip';
      const imgUrlMap = (state.tagImages || {})[tag];
      if (imgUrlMap) {
        const img = document.createElement('img');
        img.src = resolveImageUrl(imgUrlMap);
        img.style.cssText = 'height:28px; width:auto; vertical-align:middle; border-radius:3px; margin-right:6px; border:1px solid rgba(255,255,255,0.15); background:#000;';
        chip.appendChild(img);
      }
      const txt = document.createElement('span');
      txt.textContent = `${tag} x`;
      chip.appendChild(txt);
      chip.style.color = c;
      chip.style.borderColor = hexToRgba(c, 0.45);
      chip.style.background = hexToRgba(c, 0.14);
      chip.title = 'Remove tag from this trade';
      chip.addEventListener('click', async () => {
        if (!info.trade) return;
        const next = tradeTags.filter(t => t !== tag);
        setTradeTagsForTrade(info.trade, next);
        await saveTrades();
        renderGalleryImageTags();
        renderGalleryTagsTray();
        renderGallery();
        renderTable();
        renderCalendar();
      });
      box.appendChild(chip);
    });
  }

  if (marqueeTags.length) {
    if (tags.length) box.appendChild(document.createTextNode(' '));
    const mqLbl = document.createElement('span');
    mqLbl.className = 'gallery-tag-empty';
    mqLbl.textContent = 'Marquee:';
    box.appendChild(mqLbl);
    marqueeTags.forEach(tag => {
      const c = tagColor(tag);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'gallery-img-tag-chip';
      const imgUrlMap = (state.tagImages || {})[tag];
      if (imgUrlMap) {
        const img = document.createElement('img');
        img.src = resolveImageUrl(imgUrlMap);
        img.style.cssText = 'height:28px; width:auto; vertical-align:middle; border-radius:3px; margin-right:6px; border:1px solid rgba(255,255,255,0.15); background:#000;';
        chip.appendChild(img);
      }
      const txt = document.createElement('span');
      txt.textContent = `${tag} x`;
      chip.appendChild(txt);
      chip.style.color = c;
      chip.style.borderColor = hexToRgba(c, 0.45);
      chip.style.background = hexToRgba(c, 0.12);
      chip.style.opacity = '0.9';
      chip.title = 'Remove this tag from all marquee boxes on this image';
      chip.addEventListener('click', async () => {
        let modified = false;
        if (info.ownerType === 'trade' && info.trade && info.trade.marqueeBoxes && info.trade.marqueeBoxes[imgUrl]) {
          info.trade.marqueeBoxes[imgUrl].forEach(b => {
            if (b.tags && b.tags.includes(tag)) {
              b.tags = b.tags.filter(t => t !== tag);
              modified = true;
            }
          });
        } else if (info.ownerType === 'day' && info.dateKey && state.dayData[info.dateKey]?.marqueeBoxes?.[imgUrl]) {
          state.dayData[info.dateKey].marqueeBoxes[imgUrl].forEach(b => {
            if (b.tags && b.tags.includes(tag)) {
              b.tags = b.tags.filter(t => t !== tag);
              modified = true;
            }
          });
        }

        if (modified) {
          if (typeof syncMarqueeBoxesShadow === 'function') syncMarqueeBoxesShadow();
          await saveTrades();
          renderGalleryImageTags();
          renderTable();
          renderCalendar();
          if (typeof renderGalleryTagsTray === 'function') renderGalleryTagsTray();
          if (typeof _renderMarqueeOnOverlayCanvas === 'function') _renderMarqueeOnOverlayCanvas();
        }
      });
      box.appendChild(chip);
    });
  }
}

function getAllImageTagsGlobal() {
  const set = new Set();
  state.trades.forEach(t => getAllImageTagsForTrade(t).forEach(tag => set.add(tag)));
  Object.keys(state.dayData || {}).forEach(d => getAllImageTagsForDay(d).forEach(tag => set.add(tag)));
  
  if (state.pdfPageTags) {
     Object.values(state.pdfPageTags).forEach(pdfObj => {
         Object.values(pdfObj).forEach(tags => {
             tags.forEach(t => set.add(t));
         });
     });
  }

  IMAGE_PERMANENT_TAGS.forEach(t => set.add(t));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function isPermanentImageTag(tag) {
  const s = String(tag || '').trim().toLowerCase();
  return IMAGE_PERMANENT_TAGS.some(t => t.toLowerCase() === s);
}

function renameImageTagGlobal(oldTag, newTag) {
  const oTagLow = String(oldTag).toLowerCase();
  state.trades.forEach(t => {
    const store = ensureImageTagStore(t);
    Object.keys(store).forEach(url => {
      const arr = Array.isArray(store[url]) ? store[url] : [];
      const next = arr.map(x => (String(x).toLowerCase() === oTagLow ? newTag : x));
      store[url] = Array.from(new Set(next.filter(Boolean)));
      if (!store[url].length) delete store[url];
    });
    t[IMAGE_TAG_COLUMN] = getAllImageTagsForTrade(t).join(', ');

    state.tagColumns.forEach(c => {
      if (typeof t[c] === 'string') {
        let arr = t[c].split(',').map(x => x.trim()).filter(Boolean);
        if (arr.some(x => x.toLowerCase() === oTagLow)) {
          t[c] = arr.map(x => x.toLowerCase() === oTagLow ? newTag : x).join(',');
        }
      } else if (Array.isArray(t[c])) {
        t[c] = t[c].map(x => String(x).toLowerCase() === oTagLow ? newTag : x);
      }
    });

  });
  Object.keys(state.dayData || {}).forEach(d => {
    const store = ensureDayImageTagStore(d);
    Object.keys(store).forEach(url => {
      const arr = Array.isArray(store[url]) ? store[url] : [];
      const next = arr.map(x => (String(x).toLowerCase() === oTagLow ? newTag : x));
      store[url] = Array.from(new Set(next.filter(Boolean)));
      if (!store[url].length) delete store[url];
    });

    const day = state.dayData[d];
    if (day && day.tags) {
      Object.keys(day.tags).forEach(c => {
        if (typeof day.tags[c] === 'string') {
          let arr = day.tags[c].split(',').map(x => x.trim()).filter(Boolean);
          if (arr.some(x => x.toLowerCase() === oTagLow)) {
            day.tags[c] = arr.map(x => x.toLowerCase() === oTagLow ? newTag : x).join(',');
          }
        } else if (Array.isArray(day.tags[c])) {
          day.tags[c] = day.tags[c].map(x => String(x).toLowerCase() === oTagLow ? newTag : x);
        }
      });
    }

  });
}

function deleteImageTagGlobal(tagToDelete) {
  const tLow = String(tagToDelete).toLowerCase();
  window._lastDeletedGlobalTag = {
    tag: tagToDelete,
    trades: JSON.parse(JSON.stringify(state.trades)),
    dayData: JSON.parse(JSON.stringify(state.dayData || {})),
    allTags: [...state.allTags],
    tagGroups: JSON.parse(JSON.stringify(state.tagGroups || {}))
  };
  state.trades.forEach(t => {
    const store = ensureImageTagStore(t);
    Object.keys(store).forEach(url => {
      const arr = Array.isArray(store[url]) ? store[url] : [];
      const next = arr.filter(x => String(x).toLowerCase() !== tLow);
      if (next.length) store[url] = next;
      else delete store[url];
    });
    if (t.marqueeBoxes) {
      Object.keys(t.marqueeBoxes).forEach(url => {
        t.marqueeBoxes[url].forEach(box => {
          if (box.tags && box.tags.some(x => String(x).toLowerCase() === tLow)) {
            box.tags = box.tags.filter(x => String(x).toLowerCase() !== tLow);
          }
        });
      });
    }

    state.tagColumns.forEach(c => {
      if (typeof t[c] === 'string') {
        const arr = t[c].split(',').map(x => x.trim()).filter(Boolean);
        if (arr.some(x => String(x).toLowerCase() === tLow)) {
          t[c] = arr.filter(x => String(x).toLowerCase() !== tLow).join(',');
        }
      } else if (Array.isArray(t[c])) {
        t[c] = t[c].filter(x => String(x).toLowerCase() !== tLow);
      }
    });

    t[IMAGE_TAG_COLUMN] = getAllImageTagsForTrade(t).join(', ');
  });
  Object.keys(state.dayData || {}).forEach(d => {
    const day = state.dayData[d];
    const store = ensureDayImageTagStore(d);
    Object.keys(store).forEach(url => {
      const arr = Array.isArray(store[url]) ? store[url] : [];
      const next = arr.filter(x => String(x).toLowerCase() !== tLow);
      if (next.length) store[url] = next;
      else delete store[url];
    });
    if (day && day.marqueeBoxes) {
      Object.keys(day.marqueeBoxes).forEach(url => {
        if (day.marqueeBoxes[url]) {
          day.marqueeBoxes[url].forEach(box => {
            if (box.tags && box.tags.some(x => String(x).toLowerCase() === tLow)) {
              box.tags = box.tags.filter(x => String(x).toLowerCase() !== tLow);
            }
          });
        }
      });
    }

    if (day && day.tags) {
      Object.keys(day.tags).forEach(c => {
        if (typeof day.tags[c] === 'string') {
          const arr = day.tags[c].split(',').map(x => x.trim()).filter(Boolean);
          if (arr.some(x => String(x).toLowerCase() === tLow)) {
            day.tags[c] = arr.filter(x => String(x).toLowerCase() !== tLow).join(',');
          }
        } else if (Array.isArray(day.tags[c])) {
          day.tags[c] = day.tags[c].filter(x => String(x).toLowerCase() !== tLow);
        }
      });
    }
  });

  state.allTags = (state.allTags || []).filter(x => String(x).toLowerCase() !== tLow);
  if (state.tagGroups) {
    Object.keys(state.tagGroups).forEach(g => {
      state.tagGroups[g] = (state.tagGroups[g] || []).filter(x => String(x).toLowerCase() !== tLow);
    });
  }
  // Remove image association
  Object.keys(state.tagImages || {}).forEach(k => {
    if (k.toLowerCase() === tLow) delete state.tagImages[k];
  });
  saveTagGroups();
}

function openGalleryImageTagManager() {
  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  const info = getCurrentGalleryImageTagInfo();
  if (!imgUrl || (info.ownerType === 'trade' && !info.trade) || (info.ownerType === 'day' && !info.dateKey && !info.trade)) {
    showToast('Open an image first', 'error');
    return;
  }
  renderImageTagModal();
  document.getElementById('img-tag-modal').classList.add('open');
}

function closeGalleryImageTagManager() {
  const modal = document.getElementById('img-tag-modal');
  if (modal) modal.classList.remove('open');
}

function renderImageTagModal() {
  const currentWrap = document.getElementById('img-tag-current-list');
  const manageWrap = document.getElementById('img-tag-manage-list');
  if (!currentWrap || !manageWrap) return;
  currentWrap.innerHTML = '';
  manageWrap.innerHTML = '';

  const info = getCurrentGalleryImageTagInfo();
  const trade = info.trade;
  const imgUrl = info.imgUrl;
  const all = getAllImageTagsGlobal();
  const assigned = info.imageTags || [];

  all.forEach(tag => {
    const row = document.createElement('label');
    row.className = 'head-checkbox';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = assigned.includes(tag);
    const dot = document.createElement('span');
    dot.className = 'tag-dot';
    dot.style.background = tagColor(tag);
    
    const imgUrlMap = (state.tagImages || {})[tag];
    if (imgUrlMap) {
      const img = document.createElement('img');
      img.src = resolveImageUrl(imgUrlMap);
      img.style.cssText = 'height:16px; width:auto; vertical-align:middle; border-radius:2px; margin-right:6px; border:1px solid rgba(255,255,255,0.1); background:#000;';
      row.appendChild(img);
    }
    
    const txt = document.createTextNode(tag);
    chk.addEventListener('change', async () => {
      const next = chk.checked ? [...assigned, tag] : assigned.filter(t => t !== tag);
      if (info.ownerType === 'trade' && trade) setImageTagsForUrl(trade, imgUrl, next);
      else if (info.ownerType === 'day' && info.dateKey) setDayImageTagsForUrl(info.dateKey, imgUrl, next);
      else if (info.ownerType === 'pdf') setPdfPageTags(info.pdfId, info.pageNo, next);
      normalizeAllTagsFromTrades();
      await saveTrades();
      renderGalleryImageTags();
      renderTagFilterPanel();
      if (typeof renderGalleryTagFilterPanel === 'function') renderGalleryTagFilterPanel();
      renderTable();
      renderCalendar();
      renderImageTagModal();
    });
    row.appendChild(chk);
    row.appendChild(dot);
    row.appendChild(txt);
    currentWrap.appendChild(row);
  });

  if (!all.length) {
    const hint = document.createElement('p');
    hint.className = 'panel-hint';
    hint.textContent = 'No tags yet';
    currentWrap.appendChild(hint);
  }

  all.forEach(tag => {
    const row = document.createElement('div');
    row.className = 'tag-manage-row';
    const dot = document.createElement('span');
    dot.className = 'tag-dot';
    dot.style.background = tagColor(tag);
    const name = document.createElement('span');
    name.textContent = tag;
    name.style.flex = '1';

    const renameBtn = document.createElement('button');
    renameBtn.className = 'tag-del-btn';
    renameBtn.textContent = 'edit';
    renameBtn.disabled = isPermanentImageTag(tag);
    renameBtn.title = isPermanentImageTag(tag) ? 'Permanent tag' : 'Rename tag';
    renameBtn.addEventListener('click', async () => {
      const next = String(prompt('New tag name:', tag) || '').trim();
      if (!next || next === tag) return;
      renameImageTagGlobal(tag, next);
      normalizeAllTagsFromTrades();
      await saveTrades();
      renderGalleryImageTags();
      renderTagFilterPanel();
      if (typeof renderGalleryTagFilterPanel === 'function') renderGalleryTagFilterPanel();
      renderTable();
      renderCalendar();
      renderImageTagModal();
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'tag-del-btn';
    delBtn.textContent = 'x';
    delBtn.disabled = isPermanentImageTag(tag);
    delBtn.title = isPermanentImageTag(tag) ? 'Permanent tag' : 'Delete tag globally';
    delBtn.addEventListener('click', async () => {
      deleteImageTagGlobal(tag);
      normalizeAllTagsFromTrades();
      await saveTrades();
      renderGalleryImageTags();
      renderTagFilterPanel();
      if (typeof renderGalleryTagFilterPanel === 'function') renderGalleryTagFilterPanel();
      renderTable();
      renderCalendar();
      renderImageTagModal();
    });

    row.appendChild(dot);
    row.appendChild(name);
    row.appendChild(renameBtn);
    row.appendChild(delBtn);
    manageWrap.appendChild(row);
  });
}

async function addImageTagFromModal() {
  const inp = document.getElementById('img-tag-new-name');
  const tag = String(inp?.value || '').trim();
  if (!tag) return;
  const info = getCurrentGalleryImageTagInfo();
  const trade = info.trade;
  const imgUrl = info.imgUrl;
  if (!imgUrl) return;
  const existing = Array.isArray(info.imageTags) ? [...info.imageTags] : [];
  if (!existing.includes(tag)) existing.push(tag);
  if (info.ownerType === 'trade' && trade) setImageTagsForUrl(trade, imgUrl, existing);
  else if (info.ownerType === 'day' && info.dateKey) setDayImageTagsForUrl(info.dateKey, imgUrl, existing);
  else if (info.ownerType === 'pdf') setPdfPageTags(info.pdfId, info.pageNo, existing);
  else return;
  if (!state.allTags.includes(tag)) state.allTags.push(tag);
  normalizeAllTagsFromTrades();
  await saveTrades();
  renderGalleryImageTags();
  if (typeof renderTagFilterPanel === 'function') renderTagFilterPanel();
  if (typeof renderGalleryTagFilterPanel === 'function') renderGalleryTagFilterPanel();
  renderGallery();
  renderTable();
  renderCalendar();
  inp.value = '';
  renderImageTagModal();
}

document.addEventListener('keydown', e => {
  const isTyping = document.activeElement &&
    (document.activeElement.tagName === 'INPUT' ||
      document.activeElement.tagName === 'TEXTAREA' ||
      document.activeElement.isContentEditable);

  // Global Ctrl+Z to undo deleted image tags
  if (!isTyping && (e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
    if (!annotState.active) {
      if (window._lastDeletedImageTag) {
        e.preventDefault();
        const p = window._lastDeletedImageTag;
        if (p.ownerType === 'trade' && p.trade) setImageTagsForUrl(p.trade, p.imgUrl, p.origTags);
        else if (p.ownerType === 'day' && p.dateKey) setDayImageTagsForUrl(p.dateKey, p.imgUrl, p.origTags);
        if (!state.allTags.includes(p.tag)) state.allTags.push(p.tag);
        normalizeAllTagsFromTrades();
        window._lastDeletedImageTag = null;
        saveTrades().then(() => {
          if (typeof renderGalleryImageTags === 'function') renderGalleryImageTags();
          if (typeof renderTagFilterPanel === 'function') renderTagFilterPanel();
          if (typeof renderGalleryTagFilterPanel === 'function') renderGalleryTagFilterPanel();
          if (typeof renderGalleryTagsTray === 'function') renderGalleryTagsTray();
          renderTable();
          renderCalendar();
          showToast(`Tag '${p.tag}' restored on image`, 'success');
        });
        return;
      } else if (window._lastDeletedGlobalTag) {
        e.preventDefault();
        const g = window._lastDeletedGlobalTag;
        state.trades = g.trades;
        state.dayData = g.dayData;
        state.allTags = g.allTags;
        state.tagGroups = g.tagGroups;
        window._lastDeletedGlobalTag = null;
        saveTrades().then(() => {
          if (typeof renderGalleryImageTags === 'function') renderGalleryImageTags();
          if (typeof renderTagFilterPanel === 'function') renderTagFilterPanel();
          if (typeof renderGalleryTagFilterPanel === 'function') renderGalleryTagFilterPanel();
          if (typeof renderGalleryTagsTray === 'function') renderGalleryTagsTray();
          if (typeof renderImageTagModal === 'function') {
            const modal = document.getElementById('img-tag-modal');
            if (modal && modal.classList.contains('open')) renderImageTagModal();
          }
          renderTable();
          renderCalendar();
          showToast(`Global tag '${g.tag}' restored`, 'success');
        });
        return;
      }
    }
  }
});

/**
 * Restore most recently deleted image tag (Undo)
 */
async function restoreLastDeletedImageTag() {
    if (!window._tagUndoStack || !window._tagUndoStack.length) return false;
    const item = window._tagUndoStack.pop();
    if (!item) return false;

    const { tag, imgUrl, ownerType, trade, dateKey } = item;
    
    // Determine current tags
    let currentTags = [];
    if (ownerType === 'trade' && trade) {
        currentTags = getImageTagsForUrl(trade, imgUrl);
    } else if (ownerType === 'day' && dateKey) {
        currentTags = getDayImageTagsForUrl(dateKey, imgUrl);
    }

    if (!currentTags.includes(tag)) {
        const next = [...currentTags, tag];
        if (ownerType === 'trade' && trade) setImageTagsForUrl(trade, imgUrl, next);
        else if (ownerType === 'day' && dateKey) setDayImageTagsForUrl(dateKey, imgUrl, next);
        
        if (typeof normalizeAllTagsFromTrades === 'function') normalizeAllTagsFromTrades();
        await saveTrades();
        renderGalleryImageTags();
        if (typeof renderGalleryTagFilterPanel === 'function') renderGalleryTagFilterPanel();
        renderGallery();
        renderTable();
        renderCalendar();
        if (typeof showToast === 'function') showToast(`Restored tag: ${tag}`, 'success');
        return true;
    }
    return false;
}

window.restoreLastDeletedImageTag = restoreLastDeletedImageTag;
```
