function bindEvents() {
  document.getElementById('month-select').addEventListener('change', e => {
    state.month = parseInt(e.target.value);
    renderCalendar();
    renderDashboard();
  });
  document.getElementById('view-select').addEventListener('change', e => {
    state.calendarView = String(e.target.value || 'month');
    renderCalendar();
  });
  document.getElementById('year-select').addEventListener('change', e => {
    state.year = parseInt(e.target.value);
    renderCalendar();
    renderDashboard();
  });
  document.getElementById('prev-month').addEventListener('click', () => {
    if (state.calendarView === 'year') {
      state.year--;
    } else {
      state.month--;
      if (state.month < 0) { state.month = 11; state.year--; }
    }
    syncSelects();
    renderCalendar();
    renderDashboard();
  });
  document.getElementById('next-month').addEventListener('click', () => {
    if (state.calendarView === 'year') {
      state.year++;
    } else {
      state.month++;
      if (state.month > 11) { state.month = 0; state.year++; }
    }
    syncSelects();
    renderCalendar();
    renderDashboard();
  });
  document.getElementById('today-btn').addEventListener('click', () => {
    const now = new Date();
    state.month = now.getMonth();
    state.year = now.getFullYear();
    syncSelects();
    renderCalendar();
    renderDashboard();
  });
  document.getElementById('calendar-mode-btn').addEventListener('click', () => {
    state.calendarMode = state.calendarMode === 'consolidated' ? 'individual' : 'consolidated';
    updateCalendarModeButton();
    renderShowHeads();
    renderCalendar();
    renderTable();
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

  const _drFrom = document.getElementById('date-range-from');
  const _drTo = document.getElementById('date-range-to');
  const _drClear = document.getElementById('date-range-clear');
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
  if (_drFrom) _drFrom.addEventListener('change', () => { state.dateRange.from = _drFrom.value; _saveDateRange(); _updateDateRangeUI(); renderTable(); });
  if (_drTo) _drTo.addEventListener('change', () => { state.dateRange.to = _drTo.value; _saveDateRange(); _updateDateRangeUI(); renderTable(); });
  if (_drClear) _drClear.addEventListener('click', () => {
    state.dateRange = { from: '', to: '' };
    if (_drFrom) _drFrom.value = '';
    if (_drTo) _drTo.value = '';
    _saveDateRange(); _updateDateRangeUI(); renderTable();
  });
  _loadDateRange();

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
    const tray = document.getElementById('gv2-tags-tray');
    const btn = document.getElementById('gv2-tags-btn');
    const open = tray.style.display === 'none' || !tray.style.display;
    tray.style.display = open ? 'flex' : 'none';
    btn.classList.toggle('active', open);
    if (open) renderGalleryTagsTray();
  });

  document.getElementById('gv2-text-btn').addEventListener('click', () => {
    const bar = document.getElementById('gv2-text-bar');
    const mqBar = document.getElementById('gv2-marquee-bar');
    const btn = document.getElementById('gv2-text-btn');
    const isTextModeOpen = annotState.active && annotState.tool === 'text' && bar.style.display === 'flex';

    if (!isTextModeOpen) {
      commitActiveCanvasTextEditor();
      if (annotState.active && annotState.tool !== 'text') {
        const annotBar = document.getElementById('gv2-annot-bar');
        if (annotBar) annotBar.style.display = 'none';
        document.getElementById('gv2-annotate-btn').classList.remove('active');
        annotState.tool = 'text';
      } else if (!annotState.active) {
        annotState.tool = 'text';
        startAnnotation();
      }
      if (mqBar) mqBar.style.display = 'none';
      bar.style.display = 'flex';
      btn.classList.add('active');
    } else {
      if (annotState.tool === 'text') {
        stopAnnotation();
      }
      bar.style.display = 'none';
      btn.classList.remove('active');
    }
  });

  document.getElementById('gv2-tc-mode-btn').addEventListener('click', () => {
    state.gallery.filterMode = state.gallery.filterMode === 'or' ? 'and' : 'or';
    applyGalleryImageScopeByTagFilter((state.gallery.images || [])[state.gallery.currentIndex] || '');
    renderGalleryTagCloud(); renderGallery();
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

  const TAG_SZ_KEY = 'tj_tagChipSize';
  const TAG_SZ_MIN = 0.55, TAG_SZ_MAX = 1.2, TAG_SZ_STEP = 0.07;
  function applyTagChipSize(sz) {
    sz = Math.min(TAG_SZ_MAX, Math.max(TAG_SZ_MIN, sz));
    localStorage.setItem(TAG_SZ_KEY, String(sz));
    const root = document.documentElement;
    root.style.setProperty('--tag-chip-size', sz + 'rem');
    root.style.setProperty('--tag-chip-count-size', (sz * 0.86) + 'rem');
  }
  function getTagChipSize() {
    return parseFloat(localStorage.getItem(TAG_SZ_KEY) || '0.72');
  }
  applyTagChipSize(getTagChipSize());
  const szPlus = document.getElementById('gv2-tag-sz-plus');
  const szMinus = document.getElementById('gv2-tag-sz-minus');
  if (szPlus) szPlus.addEventListener('click', () => applyTagChipSize(getTagChipSize() + TAG_SZ_STEP));
  if (szMinus) szMinus.addEventListener('click', () => applyTagChipSize(getTagChipSize() - TAG_SZ_STEP));

  const TBL_FONT_KEY = 'tj_tblFontSize';
  const TBL_FONT_OPTS = [0.72, 0.78, 0.85, 0.95, 1.05];
  function applyTblFontSize(sz) {
    sz = parseFloat(sz) || 0.85;
    localStorage.setItem(TBL_FONT_KEY, String(sz));
    document.documentElement.style.setProperty('--table-font-size', sz + 'rem');
    const sel = document.getElementById('s-tbl-font-size');
    if (sel) {
      const nearest = TBL_FONT_OPTS.reduce((a, b) => Math.abs(b - sz) < Math.abs(a - sz) ? b : a);
      sel.value = String(nearest);
    }
  }
  function getTblFontSize() { return parseFloat(localStorage.getItem(TBL_FONT_KEY) || '0.85'); }
  applyTblFontSize(getTblFontSize());
  const tblFontSel = document.getElementById('s-tbl-font-size');
  if (tblFontSel) tblFontSel.addEventListener('change', () => applyTblFontSize(parseFloat(tblFontSel.value)));

  const ROW_H_KEY = 'tj_rowHeight';
  const ROW_H_MIN = 24, ROW_H_MAX = 80, ROW_H_STEP = 4;
  function applyRowHeight(h) {
    h = Math.min(ROW_H_MAX, Math.max(ROW_H_MIN, parseInt(h, 10) || 40));
    localStorage.setItem(ROW_H_KEY, String(h));
    document.documentElement.style.setProperty('--table-row-height', h + 'px');
    const el = document.getElementById('s-row-h-val');
    if (el) el.textContent = h;
  }
  function getRowHeight() { return parseInt(localStorage.getItem(ROW_H_KEY) || '40', 10); }
  applyRowHeight(getRowHeight());
  const rowHPlus = document.getElementById('s-row-h-plus');
  const rowHMinus = document.getElementById('s-row-h-minus');
  if (rowHPlus) rowHPlus.addEventListener('click', () => applyRowHeight(getRowHeight() + ROW_H_STEP));
  if (rowHMinus) rowHMinus.addEventListener('click', () => applyRowHeight(getRowHeight() - ROW_H_STEP));

  (function() {
    const handle = document.getElementById('settings-resize-handle');
    const panel = document.querySelector('.settings-panel');
    if (!handle || !panel) return;
    const PANEL_W_KEY = 'tj_settingsPanelW';
    const savedW = parseInt(localStorage.getItem(PANEL_W_KEY) || '310', 10);
    panel.style.width = Math.max(220, Math.min(580, savedW)) + 'px';
    let _resizing = false;
    handle.addEventListener('mousedown', e => {
      _resizing = true;
      handle.classList.add('dragging');
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!_resizing) return;
      const newW = Math.max(220, Math.min(580, window.innerWidth - e.clientX));
      panel.style.width = newW + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (!_resizing) return;
      _resizing = false;
      handle.classList.remove('dragging');
      localStorage.setItem(PANEL_W_KEY, String(parseInt(panel.style.width, 10) || 310));
    });
  })();

  (function() {
    const handle = document.getElementById('gv2-tray-resize-handle');
    const tray = document.getElementById('gv2-tags-tray');
    if (!handle || !tray) return;
    const TRAY_W_KEY = 'tj_tagsTrayW';
    const savedW = parseInt(localStorage.getItem(TRAY_W_KEY) || '220', 10);
    tray.style.width = Math.max(150, Math.min(480, savedW)) + 'px';
    let _resizing = false;
    handle.addEventListener('mousedown', e => {
      _resizing = true;
      handle.classList.add('dragging');
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!_resizing) return;
      const trayRect = tray.getBoundingClientRect();
      const newW = Math.max(150, Math.min(480, trayRect.right - e.clientX));
      tray.style.width = newW + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (!_resizing) return;
      _resizing = false;
      handle.classList.remove('dragging');
      localStorage.setItem(TRAY_W_KEY, String(parseInt(tray.style.width, 10) || 220));
      requestAnimationFrame(() => {
        if (typeof loadOverlayForCurrentImage === 'function') loadOverlayForCurrentImage();
      });
    });
  })();

  bindObsToolbar();
  document.getElementById('obs-save').addEventListener('click', () => saveObservation(true));
  document.getElementById('obs-cancel').addEventListener('click', () => {
    document.getElementById('obs-modal').classList.remove('open');
  });
  document.getElementById('obs-close').addEventListener('click', () => saveObservation(true));
  let _obsMousedownOnBg = false;
  document.getElementById('obs-modal').addEventListener('mousedown', e => {
    _obsMousedownOnBg = e.target === e.currentTarget;
  });
  document.getElementById('obs-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget && _obsMousedownOnBg) saveObservation(true);
    _obsMousedownOnBg = false;
  });
  document.getElementById('obs-date-prev').addEventListener('click', () => navigateObsDate(-1));
  document.getElementById('obs-date-next').addEventListener('click', () => navigateObsDate(1));
  document.getElementById('obs-date-picker').addEventListener('change', e => {
    if (e.target.value) { saveObservation(false); openObsModal(e.target.value); }
  });

  document.getElementById('image-file-input').addEventListener('change', async e => { await handleImageFiles(Array.from(e.target.files)); e.target.value = ''; });
  const dz = document.getElementById('upload-drop-zone');
  dz.addEventListener('click', e => {
    if (e.target.id === 'upload-browse-label') return; // label handles it directly
    document.getElementById('image-file-input').click();
  });
  document.getElementById('upload-browse-label').addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('image-file-input').click();
  });
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
  dz.addEventListener('drop', async e => { e.preventDefault(); dz.classList.remove('drag-over'); await handleImageFiles(Array.from(e.dataTransfer.files)); });
  document.getElementById('upload-done-btn').addEventListener('click', async () => {
    if (state._dayUploadKey) {
      if (!state.dayData[state._dayUploadKey]) state.dayData[state._dayUploadKey] = {};
      state.dayData[state._dayUploadKey].images = [...state.pendingFiles];
      await saveTrades(); render();
      showToast('Images saved!', 'success');
      state._dayUploadKey = null;
    } else if (state.uploadRow !== null) {
      state.trades[state.uploadRow].images = [...state.pendingFiles];
      cleanupImageTagStore(state.trades[state.uploadRow]);
      syncTradeDateField(state.trades[state.uploadRow]);
      saveTrades();
      render();
      showToast('Images saved!', 'success');
    }
    document.getElementById('upload-modal').classList.remove('open');
    if (state._galleryUploadCallback) { state._galleryUploadCallback(); state._galleryUploadCallback = null; }
  });
  ['upload-cancel-btn', 'upload-close'].forEach(id => document.getElementById(id).addEventListener('click', () => document.getElementById('upload-modal').classList.remove('open')));
  document.getElementById('upload-modal').addEventListener('click', e => { if (e.target === e.currentTarget) document.getElementById('upload-modal').classList.remove('open'); });
  document.getElementById('upload-modal').addEventListener('paste', async e => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imgFiles = Array.from(items).filter(it => it.type.startsWith('image/')).map(it => it.getAsFile()).filter(Boolean);
    if (imgFiles.length) { e.preventDefault(); await handleImageFiles(imgFiles); showToast('Image pasted from clipboard', 'success'); }
  });

  document.getElementById('settings-btn').addEventListener('click', () => document.getElementById('settings-overlay').classList.toggle('open'));
  document.getElementById('settings-close').addEventListener('click', () => document.getElementById('settings-overlay').classList.remove('open'));
  document.querySelectorAll('.shortcut-input').forEach(inp => {
    inp.addEventListener('keydown', e => {
      if (e.key === 'Tab') return;
      e.preventDefault();
      if (e.key === 'Escape') return;
      const combo = eventToShortcut(e);
      if (combo) {
        inp.value = combo.replace(/\b\w/g, c => c.toUpperCase());
        saveShortcuts(readShortcutsFromPanel());
      }
    });
  });
  ['s-day-size', 's-day-bold', 's-day-pos', 's-data-size', 's-data-bold', 's-show-labels', 's-cell-height', 's-sat-sun-off', 's-table-rows', 's-group-a-color', 's-group-b-color', 's-group-sep-color'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      const s = readSettingsFromPanel();
      applySettingsToDOM(s);
      renderCalendar();
    });
  });
  document.getElementById('s-apply').addEventListener('click', () => {
    saveSettings(readSettingsFromPanel());
    saveShortcuts(readShortcutsFromPanel());
    document.getElementById('settings-overlay').classList.remove('open');
  });
  document.getElementById('s-reset').addEventListener('click', () => {
    populateSettingsPanel(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
    saveShortcuts(DEFAULT_SHORTCUTS);
    document.getElementById('settings-overlay').classList.remove('open');
  });

  const _applyHeadsPreset = (mode, preset) => {
    const obj = mode === 'consolidated' ? state.showHeadsConsolidated : state.showHeadsIndividual;
    state.columns.filter(c => c.toLowerCase() !== 'date').forEach(col => {
      obj[col] = preset === 'plonly' ? isDefaultShowHeadCol(col) : (preset === 'all');
    });
    saveShowHeads();
    renderShowHeads();
    renderCalendar();
    showToast(`${mode === 'consolidated' ? 'Consolidated' : 'Individual'} heads updated`, 'success');
  };
  document.getElementById('s-heads-c-plonly').addEventListener('click', () => _applyHeadsPreset('consolidated', 'plonly'));
  document.getElementById('s-heads-c-all').addEventListener('click', () => _applyHeadsPreset('consolidated', 'all'));
  document.getElementById('s-heads-c-none').addEventListener('click', () => _applyHeadsPreset('consolidated', 'none'));
  document.getElementById('s-heads-i-plonly').addEventListener('click', () => _applyHeadsPreset('individual', 'plonly'));
  document.getElementById('s-heads-i-all').addEventListener('click', () => _applyHeadsPreset('individual', 'all'));
  document.getElementById('s-heads-i-none').addEventListener('click', () => _applyHeadsPreset('individual', 'none'));

  document.addEventListener('keydown', e => {
    const galleryOpen = document.getElementById('gallery-modal').classList.contains('open');
    const imgTagModalOpen = document.getElementById('img-tag-modal')?.classList.contains('open');
    const t = e.target;
    const typingInField = !!(
      t &&
      (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
    );

    if (imgTagModalOpen) {
      if (e.key === 'Escape') closeGalleryImageTagManager();
      return;
    }

    const obsModalOpen = document.getElementById('obs-modal').classList.contains('open');
    if (obsModalOpen && !galleryOpen && !typingInField && (e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const dp = document.getElementById('obs-date-picker');
      dp.focus(); if (typeof dp.showPicker === 'function') dp.showPicker();
    }

    if (galleryOpen) {
      if (typingInField && e.key !== 'Escape') return;
      if (e.shiftKey && !e.ctrlKey && !e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); navigateGalleryDate(-1); return; }
      if (e.shiftKey && !e.ctrlKey && !e.altKey && e.key === 'ArrowRight') { e.preventDefault(); navigateGalleryDate(1); return; }

      if (shortcutMatches(e, state.shortcuts.mergeSave)) {
        e.preventDefault();
        if (annotState.active) saveAnnotMerge();
        return;
      }
      if (shortcutMatches(e, state.shortcuts.overlaySave)) {
        e.preventDefault();
        if (annotState.active) saveAnnotOverlay();
        return;
      }
      if (!e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        if (e.repeat) return;
        toggleMarqueeGroupSelect();
        return;
      }
      if (shortcutMatches(e, state.shortcuts.pen)) {
        e.preventDefault();
        if (!annotState.active) startAnnotation();
        setAnnotTool('pen');
        return;
      }
      if (!e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        if (!annotState.active) startAnnotation();
        setAnnotTool('pen');
        return;
      }
      if (shortcutMatches(e, state.shortcuts.eraser)) {
        e.preventDefault();
        if (!annotState.active) startAnnotation();
        setAnnotTool('eraser');
        return;
      }
      if (shortcutMatches(e, state.shortcuts.imageImport)) {
        e.preventDefault();
        if (state.gallery.date) document.getElementById('gallery-upload-btn').click();
        else showToast('Open date-based gallery first', '');
        return;
      }
      if (shortcutMatches(e, state.shortcuts.datePicker) || (!e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'd' || e.key === 'D'))) {
        e.preventDefault();
        const dp = document.getElementById('gallery-date-picker');
        dp.focus();
        if (typeof dp.showPicker === 'function') dp.showPicker();
        return;
      }
      if (e.altKey && !e.ctrlKey && !e.shiftKey && String(e.key || '').toLowerCase() === 't') {
        e.preventDefault();
        openGalleryImageTagManager();
        return;
      }
      if (!e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        if (!annotState.active) startAnnotation();
        setAnnotTool('marquee');
        return;
      }
      if (!e.ctrlKey && !e.altKey && !typingInField && e.key === ']') {
        e.preventDefault();
        if (annotState.active && ['pen', 'eraser'].includes(annotState.tool)) adjustAnnotSize(+1);
        return;
      }
      if (!e.ctrlKey && !e.altKey && !typingInField && e.key === '[') {
        e.preventDefault();
        if (annotState.active && ['pen', 'eraser'].includes(annotState.tool)) adjustAnnotSize(-1);
        return;
      }

      if (e.key === 'ArrowLeft') navigateGallery(-1);
      if (e.key === 'ArrowRight') navigateGallery(1);
      if (e.key === 'r' || e.key === 'R') resetZoom();
      if (e.key === 'a' || e.key === 'A') { e.preventDefault(); toggleAnnotation(); }
      if ((e.key === 't' || e.key === 'T') && !e.altKey) {
        e.preventDefault();
        document.getElementById('gv2-tags-btn').click();
        return;
      }
      if (e.key === 'Escape') {
        if (state.gallery.tagFilter?.length) {
          e.preventDefault();
          state.gallery.tagFilter = [];
          applyGalleryImageScopeByTagFilter((state.gallery.images || [])[state.gallery.currentIndex] || '');
          renderGalleryTagCloud();
          renderGallery();
          return;
        }
        if (annotState.active) { stopAnnotation(); return; }
        document.getElementById('gallery-modal').classList.remove('open');
        unlockBodyScroll();
      }
    }
    const anyModalOpen = ['obs-modal', 'add-col-modal', 'edit-col-modal', 'tag-modal', 'img-tag-modal', 'upload-modal']
      .some(id => document.getElementById(id)?.classList.contains('open'));
    if (!typingInField && !galleryOpen && !anyModalOpen && !e.ctrlKey && !e.altKey) {
      if (e.key === 'f' && !e.shiftKey) {
        e.preventDefault();
        document.body.classList.toggle('calendar-full');
        document.body.classList.remove('table-full');
      } else if ((e.key === 'F' || (e.key === 'f' && e.shiftKey)) && !e.ctrlKey) {
        e.preventDefault();
        const _enteringFull = !document.body.classList.contains('table-full');
        document.body.classList.toggle('table-full');
        document.body.classList.remove('calendar-full');
        if (_enteringFull) {
          document.documentElement.style.setProperty('--table-visible-rows', '20');
        } else {
          const _saved = JSON.parse(localStorage.getItem('tj_settings') || '{}');
          const _rows = Math.max(3, Math.min(25, parseInt(_saved.tableRows, 10) || 5));
          document.documentElement.style.setProperty('--table-visible-rows', String(_rows));
        }
      } else if (e.key === 'c' && !e.shiftKey) {
        e.preventDefault();
        state.calendarMode = 'consolidated';
        updateCalendarModeButton(); renderShowHeads(); renderCalendar(); renderTable();
      } else if ((e.key === 'C' || e.key === 'c') && e.shiftKey) {
        e.preventDefault();
        state.calendarMode = 'individual';
        updateCalendarModeButton(); renderShowHeads(); renderCalendar(); renderTable();
      } else if (e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        const tradeDates = state.trades
          .map(t => normalizeDate(extractDateFromTrade(t)))
          .filter(Boolean).sort();
        const target = tradeDates.length
          ? tradeDates[tradeDates.length - 1]
          : new Date().toISOString().slice(0, 10);
        openObsModal(target);
      } else if (e.key === 'i' && !e.shiftKey) {
        e.preventDefault();
        const datesWImg = getDatesWithImages();
        if (datesWImg.length) openGalleryForDate(datesWImg[datesWImg.length - 1]);
      }
    }

    if (e.key === 'Escape') {
      document.body.classList.remove('calendar-full', 'table-full');
      document.getElementById('settings-overlay').classList.remove('open');
      if (document.getElementById('obs-modal').classList.contains('open')) saveObservation(true);
      state.addTagColumnMode = false;
      document.getElementById('add-col-modal').classList.remove('open');
      document.getElementById('edit-col-modal').classList.remove('open');
      if (document.getElementById('tag-modal').classList.contains('open')) closeTagPicker();
      if (document.getElementById('img-tag-modal').classList.contains('open')) closeGalleryImageTagManager();
      if (_notePop) closeNotePopup(true);
    }
  });

  bindZoomPan();
  bindAnnotationCanvas();
}

function syncSelects() {
  document.getElementById('month-select').value = state.month;
  document.getElementById('year-select').value = state.year;
  const vs = document.getElementById('view-select');
  if (vs) vs.value = state.calendarView;
  const ms = document.getElementById('month-select');
  if (ms) ms.disabled = state.calendarView === 'year';
}

init();
