/**
 * @fileoverview settings.js
 * @description Settings panel: column visibility, keyboard shortcuts, saved views, show-heads.
 * @exports loadSettingsFromStorage, applySettingsToDOM, saveSettings, readSettingsFromPanel,
 *          loadShortcutsFromStorage, shortcutMatches, eventToShortcut, populateShortcutPanel,
 *          getActiveShowHeads, initShowHeads, renderShowHeads, initTableShowCols,
 *          getSavedViews, loadColWidths, loadTagGroups, saveTagGroups
 * @reads state.columns, state.showHeadsConsolidated, state.showHeadsIndividual
 * @writes state.tableShowCols, state.tagGroups, state.colWidths, state.shortcuts
 * @storage tj_settings, tj_shortcuts, tj_tagGroups, tj_colWidths, tj_tblFontSize, tj_rowHeight
 */

function loadSettingsFromStorage() {
  try {
    const s = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('tj_settings') || '{}') };
    applySettingsToDOM(s);
    populateSettingsPanel(s);
  } catch (e) { applySettingsToDOM(DEFAULT_SETTINGS); }
}

function readSettingsFromPanel() {
  return {
    daySize: document.getElementById('s-day-size').value,
    dayBold: document.getElementById('s-day-bold').checked,
    dayPos: document.getElementById('s-day-pos').value,
    dataSize: document.getElementById('s-data-size').value,
    dataBold: document.getElementById('s-data-bold').checked,
    showLabels: document.getElementById('s-show-labels').checked,
    cellHeight: document.getElementById('s-cell-height').value,
    satSunOff: document.getElementById('s-sat-sun-off').checked,
    showCalTags: document.getElementById('s-show-cal-tags').checked,
    showTradeCount: !!(document.getElementById('s-show-trade-count')?.checked),
    showTradingDay: !!(document.getElementById('s-show-trading-day')?.checked),
    tableRows: Math.max(3, Math.min(25, parseInt(document.getElementById('s-table-rows').value, 10) || 5)),
    groupAColor: document.getElementById('s-group-a-color').value || '#58a6ff',
    groupBColor: document.getElementById('s-group-b-color').value || '#ffffff',
    groupSepColor: document.getElementById('s-group-sep-color').value || '#58a6ff'
  };
}

function populateSettingsPanel(s) {
  document.getElementById('s-day-size').value = s.daySize;
  document.getElementById('s-day-bold').checked = s.dayBold;
  document.getElementById('s-day-pos').value = s.dayPos;
  document.getElementById('s-data-size').value = s.dataSize;
  document.getElementById('s-data-bold').checked = s.dataBold;
  document.getElementById('s-show-labels').checked = s.showLabels;
  document.getElementById('s-cell-height').value = s.cellHeight;
  document.getElementById('s-sat-sun-off').checked = !!s.satSunOff;
  document.getElementById('s-show-cal-tags').checked = !!s.showCalTags;
  const _tc = document.getElementById('s-show-trade-count'); if (_tc) _tc.checked = !!s.showTradeCount;
  const _td = document.getElementById('s-show-trading-day'); if (_td) _td.checked = !!s.showTradingDay;
  document.getElementById('s-table-rows').value = String(s.tableRows || 5);
  document.getElementById('s-group-a-color').value = s.groupAColor || '#58a6ff';
  document.getElementById('s-group-b-color').value = s.groupBColor || '#ffffff';
  document.getElementById('s-group-sep-color').value = s.groupSepColor || '#58a6ff';
}

function applySettingsToDOM(s) {
  const root = document.documentElement;
  root.style.setProperty('--cal-day-size', SIZE_MAP[s.daySize] || SIZE_MAP.H3);
  root.style.setProperty('--cal-day-weight', s.dayBold ? '700' : '400');
  root.style.setProperty('--cal-data-size', SIZE_MAP[s.dataSize] || SIZE_MAP.H4);
  root.style.setProperty('--cal-data-weight', s.dataBold ? '700' : '400');
  root.style.setProperty('--cal-cell-height', HEIGHT_MAP[s.cellHeight] || HEIGHT_MAP.normal);
  root.style.setProperty('--table-visible-rows', String(Math.max(3, Math.min(25, parseInt(s.tableRows, 10) || 5))));
  root.style.setProperty('--date-group-a-bg', hexToRgba(s.groupAColor || '#58a6ff', 0.10));
  root.style.setProperty('--date-group-b-bg', hexToRgba(s.groupBColor || '#ffffff', 0.05));
  root.style.setProperty('--date-group-sep', hexToRgba(s.groupSepColor || '#58a6ff', 0.35));
  window._showLabels = s.showLabels !== false;
  window._dayPos = s.dayPos || 'top-left';
  window._satSunOff = !!s.satSunOff;
  window._showCalTags = !!s.showCalTags;
  window._showTradeCount = !!s.showTradeCount;
  window._showTradingDay = !!s.showTradingDay;
  const grid = document.getElementById('calendar-grid');
  if (grid) {
    grid.className = `calendar-grid cal-pos-${window._dayPos}`;
  }
}

function saveSettings(s) {
  localStorage.setItem('tj_settings', JSON.stringify(s));
  applySettingsToDOM(s);
  renderCalendar();
  showToast('Settings applied!', 'success');
}

function normalizeShortcutString(s) {
  return String(s || '').trim().replace(/\s+/g, '').toLowerCase();
}

function loadShortcutsFromStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem('tj_shortcuts') || '{}');
    state.shortcuts = { ...DEFAULT_SHORTCUTS, ...saved };
  } catch (e) {
    state.shortcuts = { ...DEFAULT_SHORTCUTS };
  }
  populateShortcutPanel();
}

function _scVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function _scSet(id, val) { const el = document.getElementById(id); if (el) el.value = val || ''; }

function populateShortcutPanel() {
  _scSet('sc-pen',          state.shortcuts.pen);
  _scSet('sc-image',        state.shortcuts.imageImport);
  _scSet('sc-eraser',       state.shortcuts.eraser);
  _scSet('sc-date',         state.shortcuts.datePicker);
  _scSet('sc-merge',        state.shortcuts.mergeSave);
  _scSet('sc-overlay',      state.shortcuts.overlaySave);
  _scSet('sc-select-tool',  state.shortcuts.selectTool);
  _scSet('sc-text-tool',    state.shortcuts.textTool);
  _scSet('sc-marquee',      state.shortcuts.marquee);
  _scSet('sc-annot-toggle', state.shortcuts.annotToggle);
  _scSet('sc-reset-zoom',   state.shortcuts.resetZoom);
  _scSet('sc-show-heads',   state.shortcuts.showHeads);
  _scSet('sc-layer-panel',  state.shortcuts.layerPanel);
  _scSet('sc-left-panel',      state.shortcuts.leftPanel);
  _scSet('sc-fullscreen',      state.shortcuts.fullscreen);
  _scSet('sc-delete-image',    state.shortcuts.deleteImage);
  _scSet('sc-img-tag-manager', state.shortcuts.imageTagManager);
}

function readShortcutsFromPanel() {
  return {
    pen:          _scVal('sc-pen').trim()          || DEFAULT_SHORTCUTS.pen,
    imageImport:  _scVal('sc-image').trim()        || DEFAULT_SHORTCUTS.imageImport,
    eraser:       _scVal('sc-eraser').trim()       || DEFAULT_SHORTCUTS.eraser,
    datePicker:   _scVal('sc-date').trim()         || DEFAULT_SHORTCUTS.datePicker,
    mergeSave:    _scVal('sc-merge').trim()        || DEFAULT_SHORTCUTS.mergeSave,
    overlaySave:  _scVal('sc-overlay').trim()      || DEFAULT_SHORTCUTS.overlaySave,
    selectTool:   _scVal('sc-select-tool').trim()  || DEFAULT_SHORTCUTS.selectTool,
    textTool:     _scVal('sc-text-tool').trim()    || DEFAULT_SHORTCUTS.textTool,
    marquee:      _scVal('sc-marquee').trim()      || DEFAULT_SHORTCUTS.marquee,
    annotToggle:  _scVal('sc-annot-toggle').trim() || DEFAULT_SHORTCUTS.annotToggle,
    resetZoom:    _scVal('sc-reset-zoom').trim()   || DEFAULT_SHORTCUTS.resetZoom,
    showHeads:    _scVal('sc-show-heads').trim()   || DEFAULT_SHORTCUTS.showHeads,
    layerPanel:   _scVal('sc-layer-panel').trim()  || DEFAULT_SHORTCUTS.layerPanel,
    leftPanel:    _scVal('sc-left-panel').trim()   || DEFAULT_SHORTCUTS.leftPanel,
    fullscreen:   _scVal('sc-fullscreen').trim()   || DEFAULT_SHORTCUTS.fullscreen,
    deleteImage:  _scVal('sc-delete-image').trim() || DEFAULT_SHORTCUTS.deleteImage
  };
}

function saveShortcuts(shortcuts) {
  state.shortcuts = { ...DEFAULT_SHORTCUTS, ...shortcuts };
  localStorage.setItem('tj_shortcuts', JSON.stringify(state.shortcuts));
  populateShortcutPanel();
}

function eventToShortcut(e) {
  const parts = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  const key = String(e.key || '').toLowerCase();
  if (!['control', 'shift', 'alt', 'meta'].includes(key)) parts.push(key);
  return parts.join('+');
}

function shortcutMatches(e, configured) {
  const rhs = normalizeShortcutString(configured);
  if (!rhs) return false;
  return eventToShortcut(e) === rhs;
}

/** Returns the showHeads object for the currently active calendar mode. */
function getActiveShowHeads() {
  return state.calendarMode === 'consolidated'
    ? state.showHeadsConsolidated
    : state.showHeadsIndividual;
}

/** True if a column should be on by default (P/L, RS type). */
function isDefaultShowHeadCol(col) {
  const l = col.toLowerCase();
  return l === 'rs' || l === 'net p/l' || l === 'gross p/l' ||
    l.includes('profit') || l.includes('p/l') || l.includes('p&l');
}

function saveShowHeads() {
  try {
    localStorage.setItem('tj_heads_consolidated', JSON.stringify(state.showHeadsConsolidated));
    localStorage.setItem('tj_heads_individual', JSON.stringify(state.showHeadsIndividual));
  } catch (e) { }
}

function loadShowHeads() {
  try {
    const c = localStorage.getItem('tj_heads_consolidated');
    const i = localStorage.getItem('tj_heads_individual');
    if (c) state.showHeadsConsolidated = JSON.parse(c);
    if (i) state.showHeadsIndividual = JSON.parse(i);
  } catch (e) { }
}

function initShowHeads() {
  loadShowHeads();
  const allHeads = ['Total Trades', ...state.columns.filter(c => c !== 'Total Trades')];
  allHeads.forEach(col => {
    if (col.toLowerCase() === 'date') return;
    const def = isDefaultShowHeadCol(col);
    if (!(col in state.showHeadsConsolidated)) state.showHeadsConsolidated[col] = def;
    if (!(col in state.showHeadsIndividual)) state.showHeadsIndividual[col] = def;
  });
  renderShowHeads();
}

function renderShowHeads() {
  ['show-heads-panel', 'gallery-show-heads-panel'].forEach(panelId => {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.innerHTML = '';
    const cols = ['Total Trades', ...state.columns.filter(c => c !== 'Total Trades')].filter(c => c.toLowerCase() !== 'date');
    if (!cols.length) { panel.innerHTML = '<p class="panel-hint">Import Excel to see columns</p>'; return; }

    const badge = document.createElement('div');
    const isConsolidated = state.calendarMode === 'consolidated';
    badge.style.cssText = 'font-size:0.72rem;font-weight:600;padding:4px 2px 6px 2px;color:' + (isConsolidated ? 'var(--blue)' : 'var(--green)');
    badge.textContent = isConsolidated ? 'Consolidated Heads' : 'Individual Heads';
    panel.appendChild(badge);

    const searchRow = document.createElement('div'); searchRow.className = 'panel-search-row';
    const searchInp = document.createElement('input'); searchInp.className = 'panel-search'; searchInp.placeholder = 'Search...';
    searchRow.appendChild(searchInp); panel.appendChild(searchRow);

    const actRow = document.createElement('div'); actRow.className = 'panel-act-row';
    const btnAll = document.createElement('button'); btnAll.className = 'panel-act-btn'; btnAll.textContent = 'All';
    const btnNone = document.createElement('button'); btnNone.className = 'panel-act-btn'; btnNone.textContent = 'None';
    const btnPL = document.createElement('button'); btnPL.className = 'panel-act-btn'; btnPL.textContent = 'P/L Only';
    const heads = getActiveShowHeads();
    btnAll.addEventListener('click', () => { cols.forEach(c => { heads[c] = true; }); saveShowHeads(); renderShowHeads(); renderCalendar(); if (typeof renderGalleryStats === 'function') renderGalleryStats(); });
    btnNone.addEventListener('click', () => { cols.forEach(c => { heads[c] = false; }); saveShowHeads(); renderShowHeads(); renderCalendar(); if (typeof renderGalleryStats === 'function') renderGalleryStats(); });
    btnPL.addEventListener('click', () => { cols.forEach(c => { heads[c] = isDefaultShowHeadCol(c); }); saveShowHeads(); renderShowHeads(); renderCalendar(); if (typeof renderGalleryStats === 'function') renderGalleryStats(); });
    actRow.appendChild(btnAll); actRow.appendChild(btnNone); actRow.appendChild(btnPL); panel.appendChild(actRow);

    const list = document.createElement('div'); list.className = 'panel-list'; panel.appendChild(list);

    const renderList = (q) => {
      list.innerHTML = '';
      const activeHeads = getActiveShowHeads();
      cols.filter(c => !q || c.toLowerCase().includes(q.toLowerCase())).forEach(col => {
        const lbl = document.createElement('label'); lbl.className = 'head-checkbox';
        const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = !!activeHeads[col];
        chk.addEventListener('change', () => { getActiveShowHeads()[col] = chk.checked; saveShowHeads(); renderCalendar(); if (typeof renderGalleryStats === 'function') renderGalleryStats(); });
        lbl.appendChild(chk); lbl.appendChild(document.createTextNode(col));
        list.appendChild(lbl);
      });
    };
    renderList('');
    searchInp.addEventListener('input', () => renderList(searchInp.value));
  });
}

function openShowHeadsModal() {
  const modal = document.getElementById('show-heads-modal');
  if (!modal) return;

  const cols = ['Total Trades', ...state.columns.filter(c => c !== 'Total Trades')].filter(c => c.toLowerCase() !== 'date');
  const isConsolidated = state.calendarMode === 'consolidated';

  // title badge
  const title = document.getElementById('show-heads-modal-title');
  if (title) {
    title.textContent = isConsolidated ? 'Show Heads — Consolidated' : 'Show Heads — Individual';
    title.style.color = isConsolidated ? 'var(--blue)' : 'var(--green)';
  }

  // work on a temp copy
  const src = getActiveShowHeads();
  const tempHeads = Object.assign({}, src);

  const list = document.getElementById('show-heads-modal-list');
  const searchInp = document.getElementById('show-heads-modal-search');
  if (searchInp) searchInp.value = '';

  const renderList = (q) => {
    list.innerHTML = '';
    const ql = (q || '').toLowerCase();
    cols.filter(c => !ql || c.toLowerCase().includes(ql)).forEach(col => {
      const lbl = document.createElement('label');
      lbl.className = 'head-checkbox';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = !!tempHeads[col];
      chk.addEventListener('change', () => { tempHeads[col] = chk.checked; });
      lbl.appendChild(chk);
      lbl.appendChild(document.createTextNode(col));
      list.appendChild(lbl);
    });
  };

  if (!cols.length) {
    list.innerHTML = '<p class="panel-hint">Import Excel to see columns</p>';
  } else {
    renderList('');
    if (searchInp) searchInp.addEventListener('input', () => renderList(searchInp.value));
  }

  document.getElementById('show-heads-modal-all').onclick = () => {
    cols.forEach(c => { tempHeads[c] = true; });
    renderList(searchInp ? searchInp.value : '');
  };
  document.getElementById('show-heads-modal-none').onclick = () => {
    cols.forEach(c => { tempHeads[c] = false; });
    renderList(searchInp ? searchInp.value : '');
  };
  document.getElementById('show-heads-modal-pl').onclick = () => {
    cols.forEach(c => { tempHeads[c] = isDefaultShowHeadCol(c); });
    renderList(searchInp ? searchInp.value : '');
  };
  const decChk = document.getElementById('show-heads-decimals-chk');
  if (decChk) decChk.checked = getShowDecimals();

  document.getElementById('show-heads-modal-apply').onclick = () => {
    if (decChk) localStorage.setItem('tj_show_decimals', decChk.checked ? 'true' : 'false');
    Object.assign(src, tempHeads);
    saveShowHeads();
    renderShowHeads();
    renderCalendar();
    renderDashboard();
    if (typeof renderGalleryStats === 'function') renderGalleryStats();
    modal.classList.remove('open');
  };
  document.getElementById('show-heads-modal-cancel').onclick = () => modal.classList.remove('open');
  document.getElementById('show-heads-modal-close').onclick  = () => modal.classList.remove('open');

  modal.classList.add('open');
}

function initTableShowCols() {
  const allCols = [...state.columns];
  if (!allCols.some(c => c.toLowerCase() === 'thumbnail') && !allCols.some(c => c.toLowerCase() === 'images')) {
    allCols.push('Images');
  }
  allCols.forEach(col => {
    if (!(col in state.tableShowCols)) state.tableShowCols[col] = true;
  });
  getTagColumns().forEach(col => {
    if (!(col in state.tableShowCols)) state.tableShowCols[col] = true;
  });
  state.tableShowCols[BROKER_COLUMN] = true;
  state.tableShowCols[IMAGE_TAG_COLUMN] = true;
  renderColVisPanel();
}

const VIEWS_KEY = 'tj_savedViews';

function getSavedViews() {
  try { return JSON.parse(localStorage.getItem(VIEWS_KEY) || '{}'); }
  catch { return {}; }
}

function saveCurrentView(name) {
  const views = getSavedViews();
  views[name] = JSON.parse(JSON.stringify(state.tableShowCols));
  localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
  renderViewsPanel();
}

function loadView(name) {
  const views = getSavedViews();
  if (!views[name]) return;
  state.tableShowCols = Object.assign({}, views[name]);
  renderColVisPanel();
  render();
  showToast(`View "${name}" loaded`, 'success');
}

function deleteView(name) {
  const views = getSavedViews();
  delete views[name];
  localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
  renderViewsPanel();
}

function renameView(oldName, newName) {
  newName = newName.trim();
  if (!newName || newName === oldName) { renderViewsPanel(); return; }
  const views = getSavedViews();
  if (!views[oldName]) return;
  if (views[newName]) { showToast(`"${newName}" already exists`, 'error'); renderViewsPanel(); return; }
  views[newName] = views[oldName];
  delete views[oldName];
  localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
  renderViewsPanel();
  showToast(`Renamed to "${newName}"`, 'success');
}

function startViewRename(name, loadBtn, row) {
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = name;
  inp.style.cssText = 'flex:1;font-size:inherit;padding:2px 6px;border:1px solid #555;background:#1e2330;color:#ddd;border-radius:3px;outline:none;';
  row.replaceChild(inp, loadBtn);
  inp.focus();
  inp.select();
  let done = false;
  const commit = () => { if (done) return; done = true; renameView(name, inp.value); };
  const cancel = () => { if (done) return; done = true; renderViewsPanel(); };
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
  inp.addEventListener('blur', commit);
}

function renderViewsPanel() {
  const list = document.getElementById('saved-views-list');
  if (!list) return;
  const views = getSavedViews();
  const names = Object.keys(views);
  list.innerHTML = '';
  if (!names.length) {
    const hint = document.createElement('p');
    hint.className = 'panel-hint';
    hint.style.margin = '8px';
    hint.textContent = 'No saved views yet';
    list.appendChild(hint);
    return;
  }
  names.forEach(name => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:4px;padding:2px 8px;';
    const loadBtn = document.createElement('button');
    loadBtn.className = 'dropdown-item';
    loadBtn.style.cssText = 'flex:1;text-align:left;';
    loadBtn.textContent = name;
    loadBtn.title = 'Load this view (right-click to rename)';
    loadBtn.addEventListener('click', () => { loadView(name); closeAllDropdowns('__none__'); });
    loadBtn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('.view-ctx-menu').forEach(el => el.remove());
      const menu = document.createElement('div');
      menu.className = 'view-ctx-menu';
      menu.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;background:#252836;border:1px solid #444;border-radius:4px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,.5);`;
      const renameItem = document.createElement('div');
      renameItem.textContent = '✏ Rename';
      renameItem.style.cssText = 'padding:6px 14px;cursor:pointer;color:#ddd;font-size:0.85em;white-space:nowrap;';
      renameItem.addEventListener('mouseenter', () => renameItem.style.background = '#333a4d');
      renameItem.addEventListener('mouseleave', () => renameItem.style.background = '');
      menu.appendChild(renameItem);
      document.body.appendChild(menu);
      const dismiss = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', dismiss); } };
      renameItem.addEventListener('click', (ev) => {
        ev.stopPropagation();
        menu.remove();
        document.removeEventListener('mousedown', dismiss);
        startViewRename(name, loadBtn, row);
      });
      setTimeout(() => document.addEventListener('mousedown', dismiss), 0);
    });
    const delBtn = document.createElement('button');
    delBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:#c00;font-size:1em;padding:2px 4px;';
    delBtn.textContent = '✕';
    delBtn.title = 'Delete view';
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteView(name); });
    row.appendChild(loadBtn);
    row.appendChild(delBtn);
    list.appendChild(row);
  });
}

function renderColVisPanel() {
  const panel = document.getElementById('col-vis-panel');
  panel.innerHTML = '';
  const allCols = [...state.columns, 'Images'];
  if (!allCols.length || (allCols.length === 1 && allCols[0] === 'Images')) {
    panel.innerHTML = '<p class="panel-hint" style="margin:8px">Import Excel first</p>'; return;
  }

  // ── Tabs ──
  const tabsRow = document.createElement('div'); tabsRow.className = 'panel-tabs';
  const tabVis = document.createElement('button'); tabVis.className = 'panel-tab active'; tabVis.textContent = 'Columns';
  const tabFreeze = document.createElement('button'); tabFreeze.className = 'panel-tab'; tabFreeze.textContent = 'Freeze';
  tabsRow.appendChild(tabVis); tabsRow.appendChild(tabFreeze);
  panel.appendChild(tabsRow);

  // ── Tab 1: Column visibility ──
  const paneVis = document.createElement('div'); paneVis.className = 'panel-tab-pane';

  const searchRow = document.createElement('div'); searchRow.className = 'panel-search-row';
  const searchInp = document.createElement('input'); searchInp.className = 'panel-search'; searchInp.placeholder = 'Search...';
  searchRow.appendChild(searchInp); paneVis.appendChild(searchRow);

  const actRow = document.createElement('div'); actRow.className = 'panel-act-row';
  const btnAll = document.createElement('button'); btnAll.className = 'panel-act-btn'; btnAll.textContent = 'All';
  const btnNone = document.createElement('button'); btnNone.className = 'panel-act-btn'; btnNone.textContent = 'None';
  btnAll.addEventListener('click', () => { allCols.forEach(c => { state.tableShowCols[c] = true; }); renderColVisPanel(); renderTable(); });
  btnNone.addEventListener('click', () => {
    allCols.forEach(c => { state.tableShowCols[c] = false; });
    state.tableShowCols[BROKER_COLUMN] = true;
    state.tableShowCols[IMAGE_TAG_COLUMN] = true;
    renderColVisPanel();
    renderTable();
  });
  actRow.appendChild(btnAll); actRow.appendChild(btnNone); paneVis.appendChild(actRow);

  const list = document.createElement('div'); list.className = 'panel-list'; paneVis.appendChild(list);

  const renderList = (q) => {
    list.innerHTML = '';
    const ql = (q || '').toLowerCase();
    const orderedCols = state.columns.filter(c => !ql || c.toLowerCase().includes(ql));
    const includeImages = !ql || 'images'.includes(ql);

    const buildRow = (col, draggable, isPermanent) => {
      const row = document.createElement('div');
      row.className = 'head-checkbox' + (draggable ? ' drag-row' : '');
      row.style.padding = '3px 0';
      row.dataset.col = col;
      if (draggable) {
        const handle = document.createElement('span');
        handle.textContent = '⋮⋮'; handle.style.opacity = '0.6'; handle.style.marginRight = '8px';
        row.appendChild(handle);
        row.setAttribute('draggable', 'true');
      }
      const chk = document.createElement('input'); chk.type = 'checkbox';
      chk.checked = isPermanent ? true : (state.tableShowCols[col] !== false);
      chk.disabled = isPermanent;
      chk.addEventListener('change', () => { if (isPermanent) return; state.tableShowCols[col] = chk.checked; renderTable(); });
      row.appendChild(chk);
      row.appendChild(document.createTextNode(col));
      if (draggable) {
        row.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', col); row.style.opacity = '0.5'; });
        row.addEventListener('dragend', () => { row.style.opacity = '1'; });
        row.addEventListener('dragover', e => { e.preventDefault(); row.style.borderTop = '1px dashed var(--border2)'; });
        row.addEventListener('dragleave', () => { row.style.borderTop = ''; });
        row.addEventListener('drop', e => {
          e.preventDefault(); row.style.borderTop = '';
          const from = e.dataTransfer.getData('text/plain'); const to = col;
          if (!from || from === to) return;
          const order = state.columns.filter(c => c !== from);
          order.splice(order.indexOf(to), 0, from);
          state.columns = order; saveTrades(); renderColVisPanel(); renderTable();
        });
      }
      list.appendChild(row);
    };

    orderedCols.forEach(col => {
      const lc = String(col).toLowerCase();
      buildRow(col, true, lc === String(IMAGE_TAG_COLUMN).toLowerCase() || lc === String(BROKER_COLUMN).toLowerCase());
    });
    if (includeImages) buildRow('Images', false, false);
  };
  renderList('');
  searchInp.addEventListener('input', () => renderList(searchInp.value));
  panel.appendChild(paneVis);

  // ── Tab 2: Freeze ──
  const paneFreeze = document.createElement('div'); paneFreeze.className = 'panel-tab-pane panel-two-col'; paneFreeze.style.display = 'none';
  const frozen = getFrozenCols();
  state.columns.forEach(col => {
    const row = document.createElement('label'); row.className = 'head-checkbox'; row.style.padding = '3px 0';
    const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = frozen.includes(col);
    chk.addEventListener('change', () => {
      const next = new Set(getFrozenCols());
      if (chk.checked) next.add(col); else next.delete(col);
      saveFrozenCols(Array.from(next)); renderTable();
    });
    row.appendChild(chk); row.appendChild(document.createTextNode(col));
    paneFreeze.appendChild(row);
  });
  panel.appendChild(paneFreeze);

  // ── Tab switching ──
  tabVis.addEventListener('click', () => {
    tabVis.classList.add('active'); tabFreeze.classList.remove('active');
    paneVis.style.display = ''; paneFreeze.style.display = 'none';
  });
  tabFreeze.addEventListener('click', () => {
    tabFreeze.classList.add('active'); tabVis.classList.remove('active');
    paneFreeze.style.display = ''; paneVis.style.display = 'none';
  });
}

