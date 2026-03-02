// events-settings.js — Tag/font/row-height size controls, resize handles, obs modal, upload modal, settings panel

function _bindSettingsEvents() {
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

  (function () {
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

  (function () {
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

  (function () {
    const handleH = document.getElementById('gv2-tray-resize-handle-horiz');
    if (!handleH) return;
    const THUMB_SZ_KEY = 'tj_thumbSz';
    const savedSz = parseInt(localStorage.getItem(THUMB_SZ_KEY) || '54', 10);
    document.documentElement.style.setProperty('--thumb-size', Math.max(24, Math.min(250, savedSz)) + 'px');

    let _resizingH = false;
    let _startThumbSz = 54;
    let _startY = 0;

    handleH.addEventListener('mousedown', e => {
      _resizingH = true;
      _startY = e.clientY;
      const currentCSSVar = document.documentElement.style.getPropertyValue('--thumb-size');
      _startThumbSz = parseInt(currentCSSVar || 54, 10);
      handleH.classList.add('dragging');
      document.body.style.cursor = 'ns-resize';
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!_resizingH) return;
      // move UP (smaller Y) means LARGER tray
      const diff = _startY - e.clientY;
      const newSz = Math.max(36, Math.min(250, _startThumbSz + diff));
      document.documentElement.style.setProperty('--thumb-size', newSz + 'px');
    });

    document.addEventListener('mouseup', () => {
      if (!_resizingH) return;
      _resizingH = false;
      document.body.style.cursor = '';
      handleH.classList.remove('dragging');
      localStorage.setItem(THUMB_SZ_KEY, String(parseInt(document.documentElement.style.getPropertyValue('--thumb-size'), 10) || 54));
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
      if (!state.dayData[state._dayUploadKey].images) state.dayData[state._dayUploadKey].images = [];
      state.dayData[state._dayUploadKey].images.push(...state.pendingFiles);
      await saveTrades(); render();
      showToast('Images saved!', 'success');
      state._dayUploadKey = null;
    } else if (state.uploadRow !== null) {
      if (!state.trades[state.uploadRow].images) state.trades[state.uploadRow].images = [];
      state.trades[state.uploadRow].images.push(...state.pendingFiles);
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
}
