# JS — Events UI & Gallery handlers
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `static\js\events-ui.js`
```js
/**
 * @fileoverview events-ui.js
 * @description Calendar navigation inputs, month/year pickers, view toggle, broker filter buttons.
 * @exports _bindUIEvents
 * @reads state.year, state.month, state.calendarMode, state.dateRange
 * @writes state.year, state.month, state.calendarMode, state.dateRange
 * @calls render, renderCalendar
 */

// events-ui.js — Calendar, table, column ops, date range event bindings

function _bindUIEvents() {
  const gm = document.getElementById('glob-month');
  if (gm) gm.addEventListener('change', e => {
    state.month = parseInt(e.target.value);
    render();
  });
  const gv = document.getElementById('glob-view');
  if (gv) gv.addEventListener('change', e => {
    state.calendarView = String(e.target.value || 'month');
    render();
  });
  const gy = document.getElementById('glob-year');
  if (gy) gy.addEventListener('change', e => {
    state.year = parseInt(e.target.value);
    render();
  });
  const gp = document.getElementById('glob-prev');
  if (gp) gp.addEventListener('click', () => {
    if (state.calendarView === 'year') {
      state.year--;
    } else {
      state.month--;
      if (state.month < 0) { state.month = 11; state.year--; }
    }
    syncSelects();
    render();
  });
  const gn = document.getElementById('glob-next');
  if (gn) gn.addEventListener('click', () => {
    if (state.calendarView === 'year') {
      state.year++;
    } else {
      state.month++;
      if (state.month > 11) { state.month = 0; state.year++; }
    }
    syncSelects();
    render();
  });
  const gt = document.getElementById('glob-today');
  if (gt) gt.addEventListener('click', () => {
    const now = new Date();
    state.month = now.getMonth();
    state.year = now.getFullYear();
    syncSelects();
    render();
  });
  document.getElementById('calendar-mode-btn').addEventListener('click', () => {
    state.calendarMode = state.calendarMode === 'consolidated' ? 'individual' : 'consolidated';
    updateCalendarModeButton();
    renderShowHeads();
    renderCalendar();
    renderTable();
    if (typeof renderVisualDashboard === 'function') renderVisualDashboard();
  });

  document.getElementById('show-heads-btn').addEventListener('click', e => {
    e.stopPropagation(); document.getElementById('show-heads-panel').classList.toggle('open');
  });

  setupDropdown('file-dropdown-btn', 'file-dropdown-menu');
  setupDropdown('add-dropdown-btn', 'add-dropdown-menu');
  setupDropdown('col-vis-btn', 'col-vis-panel');
  setupDropdown('view-preset-btn', 'view-preset-panel');
  setupDropdown('broker-filter-btn-top', 'broker-filter-menu-top');
  setupDropdown('dashboard-stats-btn', 'dashboard-stats-menu');

  document.addEventListener('click', () => {
    closeAllDropdowns('__none__');
    document.getElementById('show-heads-panel').classList.remove('open');
  });
  document.getElementById('show-heads-panel').addEventListener('click', e => e.stopPropagation());
  document.getElementById('col-vis-panel').addEventListener('click', e => e.stopPropagation());
  document.getElementById('view-preset-panel').addEventListener('click', e => e.stopPropagation());
  const brokerMenuTop = document.getElementById('broker-filter-menu-top');
  if (brokerMenuTop) brokerMenuTop.addEventListener('click', e => e.stopPropagation());
  const dashStatsMenu = document.getElementById('dashboard-stats-menu');
  if (dashStatsMenu) dashStatsMenu.addEventListener('click', e => e.stopPropagation());

  setupDropdown('tag-filter-btn', 'tag-filter-panel');
  document.querySelectorAll('.broker-filter-item').forEach(btn => {
    btn.addEventListener('click', () => {
      state.brokerFilter = String(btn.dataset.broker || 'both').toLowerCase();
      updateBrokerFilterButton();
      renderTable();
      renderCalendar();
      renderDashboard();
      closeAllDropdowns('__none__');
    });
  });
  document.getElementById('tag-filter-panel').addEventListener('click', e => e.stopPropagation());
  document.getElementById('tag-picker-inp').addEventListener('input', e => updateTagPickerList(e.target.value));
  document.getElementById('tag-picker-inp').addEventListener('keydown', e => {
    if (e.key === 'Escape') closeTagPicker();
    if (e.key === 'Enter') {
      const q = e.target.value.trim();
      if (q) {
        if (!state.allTags.some(t => t.toLowerCase() === q.toLowerCase())) state.allTags.push(q);
        if (_tagPickerRow !== null) {
          const arr = ensureTagArray(state.trades[_tagPickerRow], _tagPickerCol);
          if (!arr.includes(q)) arr.push(q);
          if (_tagPickerCol === 'Tags') state.trades[_tagPickerRow].tags = [...arr];
          saveTrades(); renderTable(); renderTagFilterPanel();
        }
        e.target.value = ''; updateTagPickerList('');
      }
    }
  });
  document.getElementById('tag-picker-close-btn').addEventListener('click', closeTagPicker);
  document.getElementById('tag-picker-close-x').addEventListener('click', closeTagPicker);
  document.getElementById('tag-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeTagPicker();
  });

  document.getElementById('import-btn').addEventListener('click', () => document.getElementById('excel-input').click());
  document.getElementById('excel-input').addEventListener('change', e => { if (e.target.files[0]) importExcel(e.target.files[0]); e.target.value = ''; });
  document.getElementById('import-raw-csv-btn').addEventListener('click', () => document.getElementById('raw-csv-input').click());
  document.getElementById('raw-csv-input').addEventListener('change', e => { if (e.target.files[0]) importRawCsv(e.target.files[0]); e.target.value = ''; });
  document.getElementById('import-historical-csv-btn').addEventListener('click', () => document.getElementById('historical-csv-input').click());
  document.getElementById('historical-csv-input').addEventListener('change', e => { if (e.target.files[0]) importHistoricalCsv(e.target.files[0]); e.target.value = ''; });
  document.getElementById('import-dhan-csv-btn').addEventListener('click', () => document.getElementById('dhan-csv-input').click());
  document.getElementById('dhan-csv-input').addEventListener('change', e => { if (e.target.files[0]) importDhanCsv(e.target.files[0]); e.target.value = ''; });
  document.getElementById('export-btn').addEventListener('click', exportExcel);
  document.getElementById('export-structured-csv-btn').addEventListener('click', exportStructuredCsv);
  document.getElementById('backup-btn').addEventListener('click', backupJson);
  document.getElementById('restore-btn').addEventListener('click', () => document.getElementById('json-input').click());
  document.getElementById('json-input').addEventListener('change', e => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; });

  document.getElementById('save-view-btn').addEventListener('click', () => {
    const name = prompt('View ka naam likhein:');
    if (name && name.trim()) {
      saveCurrentView(name.trim());
      showToast(`View "${name.trim()}" saved`, 'success');
    }
  });
  renderViewsPanel();

  document.getElementById('add-row-btn').addEventListener('click', () => {
    const today = new Date().toISOString().slice(0, 10);
    const row = { date: today, trade_date: today, images: [] };
    state.columns.forEach(col => { row[col] = ''; });
    row[BROKER_COLUMN] = row[BROKER_COLUMN] || 'zerodha';
    row.observation = '';
    state.trades.push(row); render(); saveTrades();
    closeAllDropdowns('__none__');
  });

  document.getElementById('add-tag-col-btn').addEventListener('click', () => {
    state.addTagColumnMode = true;
    document.getElementById('add-col-modal').classList.add('open');
    document.getElementById('new-col-name').value = getNextTagColumnName();
    document.getElementById('new-col-name').focus();
    document.getElementById('new-col-name').select();
    closeAllDropdowns('__none__');
  });

  document.getElementById('add-col-btn').addEventListener('click', () => {
    state.addTagColumnMode = false;
    document.getElementById('add-col-modal').classList.add('open');
    document.getElementById('new-col-name').value = '';
    document.getElementById('new-col-name').focus();
    closeAllDropdowns('__none__');
  });
  document.getElementById('add-col-confirm').addEventListener('click', () => {
    addColumn(document.getElementById('new-col-name').value);
    document.getElementById('add-col-modal').classList.remove('open');
  });
  document.getElementById('new-col-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') { addColumn(e.target.value); document.getElementById('add-col-modal').classList.remove('open'); }
  });
  ['add-col-close', 'add-col-cancel'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => {
      state.addTagColumnMode = false;
      document.getElementById('add-col-modal').classList.remove('open');
    });
  });

  document.getElementById('edit-col-btn').addEventListener('click', () => {
    openEditColumnModal();
    closeAllDropdowns('__none__');
  });
  document.getElementById('edit-col-select').addEventListener('change', e => {
    document.getElementById('edit-col-name').value = e.target.value;
    const canDelete = canDeleteColumn(e.target.value);
    const delBtn = document.getElementById('edit-col-delete');
    delBtn.disabled = !canDelete;
    delBtn.title = canDelete ? 'Delete this column' : 'System/import column cannot be deleted';
  });
  document.getElementById('edit-col-delete').addEventListener('click', () => {
    const col = document.getElementById('edit-col-select').value;
    deleteColumn(col);
    document.getElementById('edit-col-modal').classList.remove('open');
  });
  document.getElementById('edit-col-confirm').addEventListener('click', () => {
    const oldName = document.getElementById('edit-col-select').value;
    const newName = document.getElementById('edit-col-name').value;
    renameColumn(oldName, newName);
    document.getElementById('edit-col-modal').classList.remove('open');
  });
  document.getElementById('edit-col-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      renameColumn(document.getElementById('edit-col-select').value, e.target.value);
      document.getElementById('edit-col-modal').classList.remove('open');
    }
  });
  ['edit-col-close', 'edit-col-cancel'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => document.getElementById('edit-col-modal').classList.remove('open'));
  });

  document.getElementById('filter-toggle-btn').addEventListener('click', () => {
    state.filterVisible = !state.filterVisible;
    const btn = document.getElementById('filter-toggle-btn');
    btn.style.borderColor = state.filterVisible ? 'var(--blue)' : '';
    btn.style.color = state.filterVisible ? 'var(--blue)' : '';
    renderTable();
  });

  const _noteToggleBtn = document.getElementById('note-col-toggle-btn');
  function _updateNoteToggleBtn() {
    if (!_noteToggleBtn) return;
    const on = state.tableShowCols[NOTE_COLUMN] !== false;
    _noteToggleBtn.style.borderColor = on ? 'var(--blue)' : '';
    _noteToggleBtn.style.color = on ? 'var(--blue)' : '';
  }
  if (_noteToggleBtn) {
    _noteToggleBtn.addEventListener('click', () => {
      const wasOn = state.tableShowCols[NOTE_COLUMN] !== false;
      state.tableShowCols[NOTE_COLUMN] = !wasOn;
      try { localStorage.setItem('tj_tableShowCols', JSON.stringify(state.tableShowCols)); } catch (e) { }
      _updateNoteToggleBtn();
      renderTable();
    });
    _updateNoteToggleBtn();
  }

  const _trToolbarBtn = document.getElementById('trade-review-toolbar-btn');
  if (_trToolbarBtn) {
    _trToolbarBtn.addEventListener('click', () => openTradeReviewFromToolbar());
  }

  const _tlToolbarBtn = document.getElementById('trade-logger-toolbar-btn');
  if (_tlToolbarBtn) {
    _tlToolbarBtn.addEventListener('click', () => openTradeLoggerFromToolbar());
  }

  const _drFrom = document.getElementById('glob-date-from');
  const _drTo = document.getElementById('glob-date-to');
  const _drClear = document.getElementById('glob-date-clear');
  const _loadDateRange = () => {
    try { const r = JSON.parse(localStorage.getItem('tj_dateRange') || '{}'); state.dateRange = { from: r.from || '', to: r.to || '' }; } catch (e) { }
    if (_drFrom) _drFrom.value = state.dateRange.from;
    if (_drTo) _drTo.value = state.dateRange.to;
    _updateDateRangeUI();
  };
  const _saveDateRange = () => { try { localStorage.setItem('tj_dateRange', JSON.stringify(state.dateRange)); } catch (e) { } };
  const _updateDateRangeUI = () => {
    const active = !!(state.dateRange.from || state.dateRange.to);
    if (_drFrom) _drFrom.style.borderColor = active ? 'var(--blue)' : '';
    if (_drTo) _drTo.style.borderColor = active ? 'var(--blue)' : '';
    if (_drClear) _drClear.style.display = active ? '' : 'none';
  };
  if (_drFrom) _drFrom.addEventListener('change', () => { state.dateRange.from = _drFrom.value; _saveDateRange(); _updateDateRangeUI(); render(); });
  if (_drTo) _drTo.addEventListener('change', () => { state.dateRange.to = _drTo.value; _saveDateRange(); _updateDateRangeUI(); render(); });
  if (_drClear) _drClear.addEventListener('click', () => {
    state.dateRange = { from: '', to: '' };
    if (_drFrom) _drFrom.value = '';
    if (_drTo) _drTo.value = '';
    _saveDateRange(); _updateDateRangeUI(); render();
  });
  _loadDateRange();
}

```

## File: `static\js\events-gallery.js`
```js
/**
 * @fileoverview events-gallery.js
 * @description Gallery toolbar buttons: layer panel toggle, time display toggle, tags tray events.
 * @exports _bindGalleryEvents
 * @reads state.gallery.{showTime,layerPanelOpen}
 * @writes state.gallery.showTime, state.gallery.selectedSeparator
 * @calls toggleLayerPanel, fetchImageTimesForGallery, renderGallery
 */

// events-gallery.js — Gallery tools, nav, upload, tags tray, tag cloud event bindings

function _bindGalleryEvents() {
  setupDropdown('gallery-tools-btn', 'gallery-tools-panel');
  const galleryToolsPanel = document.getElementById('gallery-tools-panel');
  if (galleryToolsPanel) galleryToolsPanel.addEventListener('click', e => e.stopPropagation());

  setupDropdown('gallery-show-heads-btn', 'gallery-show-heads-panel');
  const galleryHeadsPanel = document.getElementById('gallery-show-heads-panel');
  if (galleryHeadsPanel) galleryHeadsPanel.addEventListener('click', e => e.stopPropagation());

  setupDropdown('gallery-img-tag-filter-btn', 'gallery-img-tag-filter-panel');
  const galleryFilterPanel = document.getElementById('gallery-img-tag-filter-panel');
  if (galleryFilterPanel) galleryFilterPanel.addEventListener('click', e => e.stopPropagation());

  // Layer panel toggle
  const layerBtn = document.getElementById('gv2-layer-btn');
  if (layerBtn) layerBtn.addEventListener('click', () => {
    if (typeof toggleLayerPanel === 'function') toggleLayerPanel();
  });
  const timeBtn = document.getElementById('gv2-time-btn');
  if (timeBtn) timeBtn.addEventListener('click', () => {
    state.gallery.showTime = !state.gallery.showTime;
    timeBtn.classList.toggle('active', state.gallery.showTime);
    if (state.gallery.showTime) {
      fetchImageTimesForGallery();
    } else {
      renderGallery();
    }
  });
  const lpCloseBtn = document.getElementById('gv2-lp-close-btn');
  if (lpCloseBtn) lpCloseBtn.addEventListener('click', () => {
    if (typeof toggleLayerPanel === 'function') toggleLayerPanel();
  });

  // Layer panel selection controls
  document.getElementById('gv2-lp-sel-all')?.addEventListener('click', () => {
    const images = state.gallery.images || [];
    state.gallery.selectedIndices = new Set(images.map((_, i) => i));
    renderGallery();
  });
  document.getElementById('gv2-lp-sel-none')?.addEventListener('click', () => {
    state.gallery.selectedIndices = new Set();
    renderGallery();
  });
  document.getElementById('gv2-lp-sel-inv')?.addEventListener('click', () => {
    const images = state.gallery.images || [];
    const cur = state.gallery.selectedIndices || new Set();
    state.gallery.selectedIndices = new Set(images.map((_, i) => i).filter(i => !cur.has(i)));
    renderGallery();
  });

  // Layer panel resize handle
  (function () {
    const lpHandle = document.getElementById('gv2-lp-resize-handle');
    const lpPanel = document.getElementById('gv2-layer-panel');
    if (!lpHandle || !lpPanel) return;
    const LP_W_KEY = 'tj_layerPanelW';
    const savedW = parseInt(localStorage.getItem(LP_W_KEY) || '200', 10);
    const _lpSetWidth = (w) => {
      lpPanel.style.width = w + 'px';
      lpPanel.style.setProperty('--lp-thumb-w', Math.max(24, Math.min(80, Math.floor(w * 0.22))) + 'px');
    };
    _lpSetWidth(Math.max(140, Math.min(400, savedW)));
    let _lpResizing = false;
    lpHandle.addEventListener('mousedown', e => {
      _lpResizing = true; lpHandle.classList.add('dragging'); e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!_lpResizing) return;
      const panelRect = lpPanel.getBoundingClientRect();
      _lpSetWidth(Math.max(140, Math.min(400, e.clientX - panelRect.left)));
    });
    document.addEventListener('mouseup', () => {
      if (!_lpResizing) return;
      _lpResizing = false; lpHandle.classList.remove('dragging');
      localStorage.setItem(LP_W_KEY, String(parseInt(lpPanel.style.width, 10) || 200));
    });
  })();

  // Gallery modal: prevent browser native context menu (ContextMenu key shows custom menu instead)
  const _galleryModal = document.getElementById('gallery-modal');
  if (_galleryModal) {
    _galleryModal.addEventListener('contextmenu', e => {
      if (!_galleryModal.classList.contains('open')) return;
      e.preventDefault();
    });
  }

  // Ctrl+drag to select thumbnails, Ctrl+Alt+drag to deselect
  let _ctrlDragPending = false, _ctrlDragActive = false, _ctrlDragMode = 'select';
  let _ctrlDragStartPos = null;
  document.addEventListener('mousedown', e => {
    if (!document.getElementById('gallery-modal')?.classList.contains('open')) return;
    if (!e.ctrlKey || e.button !== 0) return;
    const wrap = e.target.closest('.gv2-thumb-wrap');
    if (!wrap || wrap.dataset.globalIdx === undefined) return;
    _ctrlDragPending = true;
    _ctrlDragMode = e.altKey ? 'deselect' : 'select';
    _ctrlDragStartPos = { x: e.clientX, y: e.clientY };
  });
  document.addEventListener('mousemove', e => {
    if (!_ctrlDragPending && !_ctrlDragActive) return;
    if (_ctrlDragPending) {
      const dx = e.clientX - _ctrlDragStartPos.x, dy = e.clientY - _ctrlDragStartPos.y;
      if (Math.sqrt(dx * dx + dy * dy) < 5) return;
      _ctrlDragActive = true; _ctrlDragPending = false;
    }
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const wrap = el?.closest('.gv2-thumb-wrap');
    if (!wrap || wrap.dataset.globalIdx === undefined) return;
    const idx = parseInt(wrap.dataset.globalIdx);
    if (!state.gallery.selectedIndices) state.gallery.selectedIndices = new Set();
    if (_ctrlDragMode === 'select') {
      if (!state.gallery.selectedIndices.has(idx)) {
        state.gallery.selectedIndices.add(idx);
        wrap.querySelector('.gv2-thumb')?.classList.add('selected-thumb');
      }
    } else {
      if (state.gallery.selectedIndices.has(idx)) {
        state.gallery.selectedIndices.delete(idx);
        wrap.querySelector('.gv2-thumb')?.classList.remove('selected-thumb');
      }
    }
  });
  document.addEventListener('mouseup', () => { _ctrlDragPending = false; _ctrlDragActive = false; });

  // Shortcuts popover toggle
  const scBtn = document.getElementById('gv2-shortcuts-btn');
  const scPop = document.getElementById('gv2-shortcuts-popover');
  if (scBtn && scPop) {
    scBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = scPop.style.display !== 'none';
      if (!isOpen && typeof renderShortcutsPopover === 'function') renderShortcutsPopover();
      scPop.style.display = isOpen ? 'none' : 'block';
    });
    document.addEventListener('mousedown', (e) => {
      if (!scBtn.contains(e.target) && !scPop.contains(e.target)) scPop.style.display = 'none';
    });
  }

  document.getElementById('gallery-prev').addEventListener('click', () => navigateGallery(-1));
  document.getElementById('gallery-next').addEventListener('click', () => navigateGallery(1));
  document.getElementById('gallery-date-prev').addEventListener('click', () => navigateGalleryDate(-1));
  document.getElementById('gallery-date-next').addEventListener('click', () => navigateGalleryDate(1));
  document.getElementById('gallery-date-picker').addEventListener('change', e => {
    const dateStr = e.target.value;
    const images = getImagesForDate(dateStr);
    if (images.length) {
      state.gallery.images = images; state.gallery.currentIndex = 0; state.gallery.date = dateStr; state.gallery.sourceRow = null;
      state.gallery._baseImages = [...images];
      state.gallery._baseDate = dateStr;
      state.gallery._baseSourceRow = null;
      if (state.gallery.tagFilter?.length) applyGalleryImageScopeByTagFilter(images[0] || '');
      renderGallery(); updateGalleryDateArrows();
    } else { showToast('No images for this date', ''); }
  });
  document.getElementById('gallery-upload-btn').addEventListener('click', () => {
    if (!state.gallery.date) return;
    let rowIdx = state.trades.findIndex(t => normalizeDate(extractDateFromTrade(t)) === state.gallery.date);
    if (rowIdx === -1) {
      const trade = getOrCreateTrade(state.gallery.date);
      rowIdx = state.trades.indexOf(trade);
      saveTrades();
    }
    state._galleryUploadCallback = () => {
      state.gallery.images = getImagesForDate(state.gallery.date);
      renderGallery();
      updateGalleryDateArrows();
    };
    openUploadModal(rowIdx);
  });
  const gtBtn = document.getElementById('gallery-tag-btn');
  if (gtBtn) gtBtn.addEventListener('click', openGalleryImageTagManager);
  const imgTagAddBtn = document.getElementById('img-tag-add-btn');
  if (imgTagAddBtn) imgTagAddBtn.addEventListener('click', addImageTagFromModal);
  const imgTagInp = document.getElementById('img-tag-new-name');
  if (imgTagInp) imgTagInp.addEventListener('keydown', e => {
    if (e.key === 'Enter') addImageTagFromModal();
  });
  ['img-tag-close-btn', 'img-tag-close-x'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', closeGalleryImageTagManager);
  });
  const imgTagModal = document.getElementById('img-tag-modal');
  if (imgTagModal) imgTagModal.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeGalleryImageTagManager();
  });

  document.getElementById('gallery-close').addEventListener('click', () => {
    if (annotState.active) stopAnnotation();
    closeGalleryImageTagManager();
    document.getElementById('gallery-modal').classList.remove('open');
    unlockBodyScroll();
  });

  document.getElementById('gv2-tags-btn').addEventListener('click', () => {
    document.getElementById('gallery-tools-panel')?.classList.remove('open');
    const tray = document.getElementById('gv2-tags-tray');
    const btn = document.getElementById('gv2-tags-btn');
    const open = tray.style.display === 'none' || !tray.style.display;
    tray.style.display = open ? 'flex' : 'none';
    btn.classList.toggle('active', open);
    if (open) {
      if (typeof renderGalleryTagsTray === 'function') renderGalleryTagsTray();
      if (typeof renderGalleryVideoUrls === 'function') renderGalleryVideoUrls();
    }
  });

  // gv2-text-btn click is handled by bindAnnotationCanvas() in annotate-fabric.js

  document.getElementById('gv2-tc-mode-btn').addEventListener('click', () => {
    state.gallery.filterMode = state.gallery.filterMode === 'or' ? 'and' : 'or';
    applyGalleryImageScopeByTagFilter((state.gallery.images || [])[state.gallery.currentIndex] || '');
    renderGalleryTagCloud(); renderGallery();
  });

  document.getElementById('gv2-grp-filter-btn')?.addEventListener('click', () => {
    state.gallery.filterGroupMode = state.gallery.filterGroupMode === 'image' ? 'group' : 'image';
    const btn = document.getElementById('gv2-grp-filter-btn');
    const isGrp = state.gallery.filterGroupMode !== 'image';
    if (btn) { btn.textContent = isGrp ? 'Grp' : 'Img'; btn.classList.toggle('active', isGrp); }
    // Img mode mein expand state saaf karo
    if (!isGrp && state.gallery.expandedGroups) state.gallery.expandedGroups.clear();
    if (Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length) renderGallery();
  });

  document.getElementById('gv2-tc-clear-btn').addEventListener('click', () => {
    state.gallery.tagFilter = [];
    applyGalleryImageScopeByTagFilter((state.gallery.images || [])[state.gallery.currentIndex] || '');
    renderGalleryTagCloud(); renderGallery();
  });

  document.getElementById('gv2-obs-btn').addEventListener('click', () => {
    const d = state.gallery.date;
    if (d) {
      document.getElementById('gallery-modal').classList.remove('open');
      unlockBodyScroll();
      openObsModal(d);
    }
  });

  document.getElementById('gv2-add-grp-btn').addEventListener('click', () => {
    const name = prompt('New group name:');
    if (!name || !name.trim()) return;
    const g = name.trim();
    if (!state.tagGroups[g]) state.tagGroups[g] = [];
    saveTagGroups(); renderGalleryTagsTray();
  });
  const delTagBtn = document.getElementById('gv2-del-tag-btn');
  if (delTagBtn) delTagBtn.addEventListener('click', () => {
    state.tagDeleteMode = !state.tagDeleteMode;
    renderGalleryTagsTray();
  });
}

```
