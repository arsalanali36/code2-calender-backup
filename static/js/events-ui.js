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

  // Profile avatar dropdown
  const profileAvatarBtn = document.getElementById('profile-avatar-btn');
  const profileDropdown = document.getElementById('profile-dropdown');
  if (profileAvatarBtn && profileDropdown) {
    profileAvatarBtn.addEventListener('click', e => {
      e.stopPropagation();
      profileDropdown.classList.toggle('open');
    });
    profileDropdown.addEventListener('click', e => e.stopPropagation());
  }

  // Profile: Settings
  const profileSettingsBtn = document.getElementById('profile-settings-btn');
  if (profileSettingsBtn) profileSettingsBtn.addEventListener('click', () => {
    document.getElementById('settings-overlay').classList.add('open');
    if (profileDropdown) profileDropdown.classList.remove('open');
  });

  const profileQuoteBtn = document.getElementById('profile-quote-btn');
  if (profileQuoteBtn) profileQuoteBtn.addEventListener('click', () => {
    if (typeof openQuoteModal === 'function') openQuoteModal();
    if (profileDropdown) profileDropdown.classList.remove('open');
  });

  // Profile: Broker inline dropdown
  const brokerGroup = document.getElementById('profile-broker-group');
  const brokerTrigger = document.getElementById('profile-broker-trigger');
  if (brokerTrigger && brokerGroup) {
    brokerTrigger.addEventListener('click', e => {
      e.stopPropagation();
      const viewGroup = document.getElementById('profile-view-group');
      if (viewGroup) viewGroup.classList.remove('open');
      brokerGroup.classList.toggle('open');
    });
  }

  // Profile: View inline dropdown
  const viewGroup = document.getElementById('profile-view-group');
  const viewTrigger = document.getElementById('profile-view-trigger');
  if (viewTrigger && viewGroup) {
    viewTrigger.addEventListener('click', e => {
      e.stopPropagation();
      if (brokerGroup) brokerGroup.classList.remove('open');
      viewGroup.classList.toggle('open');
    });
  }

  // Profile: View items
  document.querySelectorAll('.profile-view-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.view;
      if (state.calendarMode !== v) {
        state.calendarMode = v;
        updateCalendarModeButton();
        renderShowHeads();
        renderCalendar();
        renderTable();
        if (typeof renderVisualDashboard === 'function') renderVisualDashboard();
      }
      if (viewGroup) viewGroup.classList.remove('open');
    });
  });

  document.getElementById('show-heads-btn').addEventListener('click', e => {
    e.stopPropagation(); openShowHeadsModal();
  });

  setupDropdown('file-dropdown-btn', 'file-dropdown-menu');
  setupDropdown('add-dropdown-btn', 'add-dropdown-menu');
  setupDropdown('col-vis-btn', 'col-vis-panel');
  setupDropdown('view-preset-btn', 'view-preset-panel');
  const statsBtn = document.getElementById('dashboard-stats-btn');
  if (statsBtn) statsBtn.addEventListener('click', e => { e.stopPropagation(); openStatsConfigModal(); });

  document.addEventListener('click', () => {
    closeAllDropdowns('__none__');
    document.getElementById('show-heads-panel').classList.remove('open');
    if (profileDropdown) profileDropdown.classList.remove('open');
    document.querySelectorAll('.profile-inline-group').forEach(g => g.classList.remove('open'));
  });
  document.getElementById('show-heads-panel').addEventListener('click', e => e.stopPropagation());
  document.getElementById('col-vis-panel').addEventListener('click', e => e.stopPropagation());
  document.getElementById('view-preset-panel').addEventListener('click', e => e.stopPropagation());
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
      document.querySelectorAll('.profile-inline-group').forEach(g => g.classList.remove('open'));
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
  document.getElementById('export-logger-excel-btn').addEventListener('click', exportLoggerExcel);
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

  const _clToolbarBtn = document.getElementById('csvlog-toolbar-btn');
  if (_clToolbarBtn) {
    _clToolbarBtn.addEventListener('click', () => openCsvLogModal());
  }
  const _clChartsToolbarBtn = document.getElementById('csvlog-charts-toolbar-btn');
  if (_clChartsToolbarBtn) {
    _clChartsToolbarBtn.addEventListener('click', () => openCsvLogChartsModal());
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
    if (_drClear) _drClear.style.display = active ? 'inline-flex' : 'none';
  };
  const _applyDateFromInput = () => {
    state.dateRange.from = _drFrom ? _drFrom.value : '';
    state.dateRange.to = _drTo ? _drTo.value : '';
    _saveDateRange();
    _updateDateRangeUI();
    render();
  };
  if (_drFrom) {
    _drFrom.addEventListener('change', _applyDateFromInput);
    _drFrom.addEventListener('input', _applyDateFromInput);
    _drFrom.addEventListener('keydown', e => { if (e.key === 'Enter') _applyDateFromInput(); });
  }
  if (_drTo) {
    _drTo.addEventListener('change', _applyDateFromInput);
    _drTo.addEventListener('input', _applyDateFromInput);
    _drTo.addEventListener('keydown', e => { if (e.key === 'Enter') _applyDateFromInput(); });
  }
  if (_drClear) _drClear.addEventListener('click', () => {
    state.dateRange = { from: '', to: '' };
    if (_drFrom) _drFrom.value = '';
    if (_drTo) _drTo.value = '';
    _saveDateRange(); _updateDateRangeUI(); render();
  });
  _loadDateRange();

  // ── Mobile View Toggle ──────────────────────────────────────────────────────
  const mobileBtn = document.getElementById('mobile-view-toggle-btn');
  if (mobileBtn) {
    mobileBtn.addEventListener('click', () => {
      window.location.href = '/mobile/';
    });
  }
}
