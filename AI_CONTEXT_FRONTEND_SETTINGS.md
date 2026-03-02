# Frontend Context — Settings / Dashboard / Calendar
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `static\js\settings.js`
```js
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

function populateShortcutPanel() {
  document.getElementById('sc-pen').value = state.shortcuts.pen;
  document.getElementById('sc-image').value = state.shortcuts.imageImport;
  document.getElementById('sc-eraser').value = state.shortcuts.eraser;
  document.getElementById('sc-date').value = state.shortcuts.datePicker;
  document.getElementById('sc-merge').value = state.shortcuts.mergeSave;
  document.getElementById('sc-overlay').value = state.shortcuts.overlaySave;
}

function readShortcutsFromPanel() {
  return {
    pen: document.getElementById('sc-pen').value.trim() || DEFAULT_SHORTCUTS.pen,
    imageImport: document.getElementById('sc-image').value.trim() || DEFAULT_SHORTCUTS.imageImport,
    eraser: document.getElementById('sc-eraser').value.trim() || DEFAULT_SHORTCUTS.eraser,
    datePicker: document.getElementById('sc-date').value.trim() || DEFAULT_SHORTCUTS.datePicker,
    mergeSave: document.getElementById('sc-merge').value.trim() || DEFAULT_SHORTCUTS.mergeSave,
    overlaySave: document.getElementById('sc-overlay').value.trim() || DEFAULT_SHORTCUTS.overlaySave
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
  state.columns.forEach(col => {
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
    const cols = state.columns.filter(c => c.toLowerCase() !== 'date');
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

  const searchRow = document.createElement('div'); searchRow.className = 'panel-search-row';
  const searchInp = document.createElement('input'); searchInp.className = 'panel-search'; searchInp.placeholder = 'Search...';
  searchRow.appendChild(searchInp); panel.appendChild(searchRow);

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
  actRow.appendChild(btnAll); actRow.appendChild(btnNone); panel.appendChild(actRow);

  const list = document.createElement('div'); list.className = 'panel-list'; panel.appendChild(list);

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
        handle.textContent = '⋮⋮';
        handle.style.opacity = '0.6';
        handle.style.marginRight = '8px';
        row.appendChild(handle);
        row.setAttribute('draggable', 'true');
      }

      const chk = document.createElement('input'); chk.type = 'checkbox';
      chk.checked = isPermanent ? true : (state.tableShowCols[col] !== false);
      chk.disabled = isPermanent;
      chk.addEventListener('change', () => {
        if (isPermanent) return;
        state.tableShowCols[col] = chk.checked;
        renderTable();
      });
      row.appendChild(chk);
      row.appendChild(document.createTextNode(col));

      if (draggable) {
        row.addEventListener('dragstart', e => {
          e.dataTransfer.setData('text/plain', col);
          row.style.opacity = '0.5';
        });
        row.addEventListener('dragend', () => { row.style.opacity = '1'; });
        row.addEventListener('dragover', e => { e.preventDefault(); row.style.borderTop = '1px dashed var(--border2)'; });
        row.addEventListener('dragleave', () => { row.style.borderTop = ''; });
        row.addEventListener('drop', e => {
          e.preventDefault();
          row.style.borderTop = '';
          const from = e.dataTransfer.getData('text/plain');
          const to = col;
          if (!from || from === to) return;
          const order = state.columns.filter(c => c !== from);
          const idx = order.indexOf(to);
          order.splice(idx, 0, from);
          state.columns = order;
          saveTrades();
          renderColVisPanel();
          renderTable();
        });
      }

      list.appendChild(row);
    };

    orderedCols.forEach(col => {
      const lowerCol = String(col).toLowerCase();
      const isPermanent =
        lowerCol === String(IMAGE_TAG_COLUMN).toLowerCase() ||
        lowerCol === String(BROKER_COLUMN).toLowerCase();
      buildRow(col, true, isPermanent);
    });

    if (includeImages) {
      buildRow('Images', false, false);
    }
  };
  renderList('');
  searchInp.addEventListener('input', () => renderList(searchInp.value));

  const freezeWrap = document.createElement('div');
  freezeWrap.style.padding = '6px 10px 10px';
  freezeWrap.style.borderTop = '1px solid var(--border)';
  const freezeLabel = document.createElement('div');
  freezeLabel.className = 'panel-manage-label';
  freezeLabel.textContent = 'Freeze Columns';
  freezeLabel.style.marginBottom = '6px';
  freezeWrap.appendChild(freezeLabel);

  const freezeList = document.createElement('div');
  freezeList.className = 'panel-list';
  freezeList.style.maxHeight = '180px';
  const frozen = getFrozenCols();
  state.columns.forEach(col => {
    const row = document.createElement('label');
    row.className = 'head-checkbox';
    row.style.padding = '3px 0';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = frozen.includes(col);
    chk.addEventListener('change', () => {
      const next = new Set(getFrozenCols());
      if (chk.checked) next.add(col);
      else next.delete(col);
      saveFrozenCols(Array.from(next));
      renderTable();
    });
    row.appendChild(chk);
    row.appendChild(document.createTextNode(col));
    freezeList.appendChild(row);
  });
  freezeWrap.appendChild(freezeList);
  panel.appendChild(freezeWrap);
}


```

## File: `static\js\dashboard.js`
```js
function render() {
  const sx = window.scrollX, sy = window.scrollY;
  renderCalendar();
  renderDashboard();
  renderTable();
  renderTagFilterPanel();
  updateCalendarModeButton();
  updateBrokerFilterButton();
  requestAnimationFrame(() => window.scrollTo(sx, sy));
}

function updateCalendarModeButton() {
  const btn = document.getElementById('calendar-mode-btn');
  if (!btn) return;
  const consolidated = state.calendarMode === 'consolidated';
  btn.textContent = consolidated ? 'Consolidated' : 'Individual';
  btn.style.borderColor = consolidated ? 'var(--blue)' : '';
  btn.style.color = consolidated ? 'var(--blue)' : '';
}

function updateBrokerFilterButton() {
  const map = { both: 'Both', zerodha: 'Zerodha', dhan: 'Dhan' };
  const key = String(state.brokerFilter || 'both').toLowerCase();
  const labels = `Broker: ${map[key] || 'Both'} ▼`;
  ['broker-filter-btn-top'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.textContent = labels;
    btn.style.borderColor = key === 'both' ? '' : 'var(--blue)';
    btn.style.color = key === 'both' ? '' : 'var(--blue)';
  });
}

function parseNumber(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number' && !isNaN(val)) return val;
  const s = String(val).replace(/,/g, '').trim();
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function sumByKeys(trades, keys) {
  let sum = 0;
  let found = false;
  trades.forEach(t => {
    for (const k of keys) {
      if (!(k in t)) continue;
      const n = parseNumber(t[k]);
      if (n !== null) {
        sum += n;
        found = true;
        return;
      }
    }
  });
  return found ? sum : null;
}

function getTradePnl(trade) {
  const keys = ['Rs', 'rs', 'Profit', 'profit', 'P&L', 'Pnl', 'PnL', 'PL', 'pl'];
  for (const k of keys) {
    if (!(k in trade)) continue;
    const n = parseNumber(trade[k]);
    if (n !== null) return n;
  }
  return null;
}

function getTradesForMonth(year, monthIndex) {
  return state.trades.filter(t => {
    if (!tradeMatchesBrokerFilter(t)) return false;
    const ds = normalizeDate(extractDateFromTrade(t));
    if (!ds || !/^\d{4}-\d{2}-\d{2}$/.test(ds)) return false;
    const d = new Date(ds + 'T00:00:00');
    if (isNaN(d)) return false;
    return d.getFullYear() === year && d.getMonth() === monthIndex;
  });
}

function formatCurrency(n) {
  if (n === null || n === undefined || isNaN(n)) return '₹ 0.00';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const out = abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}₹ ${out}`;
}

function setDashValue(el, n, colorize = true) {
  if (!el) return;
  el.textContent = formatCurrency(n);
  el.classList.remove('positive', 'negative');
  if (colorize) {
    if (n > 0) el.classList.add('positive');
    if (n < 0) el.classList.add('negative');
  }
}

function formatPercent(n) {
  if (n === null || n === undefined || isNaN(n)) return '0%';
  return `${n.toFixed(1)}%`;
}

function formatShortDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
}

function renderDashboard() {
  const subtitle = document.getElementById('dashboard-subtitle');
  if (subtitle) subtitle.textContent = `for ${MONTHS[state.month]} ${state.year}`;
  applyDashboardStatVisibility();
  applyDashboardStatOrder();

  const trades = getTradesForMonth(state.year, state.month);
  const pnlList = trades.map(getTradePnl).filter(n => n !== null);
  const overall = pnlList.reduce((a, b) => a + b, 0);
  const charges = sumByKeys(trades, ['Other Charges', 'Charges', 'Charge', 'charges', 'charge', 'Transaction Charges', 'Charges (Total)', 'Total Charges']) || 0;
  const brokerage = sumByKeys(trades, ['Brokerage', 'brokerage', 'Brokerage Charges', 'Brokerage (Total)']) || 0;
  let net = sumByKeys(trades, ['Net P/L', 'Net P&L', 'Net Pnl', 'Net P&L (Total)', 'Net Profit', 'Net Profit/Loss']);
  if (net === null) net = overall - charges - brokerage;

  const wins = pnlList.filter(n => n > 0);
  const losses = pnlList.filter(n => n < 0);
  const winRate = pnlList.length ? (wins.length / pnlList.length) * 100 : 0;
  const avg = pnlList.length ? (overall / pnlList.length) : 0;
  const avgWin = wins.length ? (wins.reduce((a, b) => a + b, 0) / wins.length) : 0;
  const avgLoss = losses.length ? (losses.reduce((a, b) => a + b, 0) / losses.length) : 0;

  const dailyMap = new Map();
  trades.forEach(t => {
    const ds = normalizeDate(extractDateFromTrade(t));
    const pnl = getTradePnl(t);
    if (!ds || pnl === null) return;
    dailyMap.set(ds, (dailyMap.get(ds) || 0) + pnl);
  });
  const dailyEntries = Array.from(dailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  let best = { date: '', value: 0 };
  let worst = { date: '', value: 0 };
  if (dailyEntries.length) {
    best = dailyEntries.reduce((acc, cur) => cur[1] > acc.value ? { date: cur[0], value: cur[1] } : acc, { date: dailyEntries[0][0], value: dailyEntries[0][1] });
    worst = dailyEntries.reduce((acc, cur) => cur[1] < acc.value ? { date: cur[0], value: cur[1] } : acc, { date: dailyEntries[0][0], value: dailyEntries[0][1] });
  }

  let equity = 0;
  let peak = 0;
  let maxDD = 0;
  dailyEntries.forEach(([, v]) => {
    equity += v;
    if (equity > peak) peak = equity;
    const dd = equity - peak;
    if (dd < maxDD) maxDD = dd;
  });

  setDashValue(document.getElementById('dash-overall'), overall, true);
  setDashValue(document.getElementById('dash-net'), net, true);
  setDashValue(document.getElementById('dash-charges'), charges, false);
  setDashValue(document.getElementById('dash-brokerage'), brokerage, false);
  setDashValue(document.getElementById('dash-totalfees'), brokerage + charges, false);
  const tradeCount = document.getElementById('dash-trades');
  if (tradeCount) {
    const totalFills = trades.reduce((sum, t) => sum + (Math.max(parseInt(t['fill_count']) || 0, 2)), 0);
    tradeCount.textContent = (totalFills || trades.length).toLocaleString('en-IN');
  }

  const winEl = document.getElementById('dash-winrate');
  if (winEl) winEl.textContent = formatPercent(winRate);
  setDashValue(document.getElementById('dash-avg'), avg, true);
  setDashValue(document.getElementById('dash-avgwin'), avgWin, true);
  setDashValue(document.getElementById('dash-avgloss'), avgLoss, true);
  setDashValue(document.getElementById('dash-best'), best.value || 0, true);
  setDashValue(document.getElementById('dash-worst'), worst.value || 0, true);
  setDashValue(document.getElementById('dash-dd'), maxDD || 0, true);
  const bestDate = document.getElementById('dash-best-date');
  const worstDate = document.getElementById('dash-worst-date');
  if (bestDate) bestDate.textContent = best.date ? formatShortDate(best.date) : '-';
  if (worstDate) worstDate.textContent = worst.date ? formatShortDate(worst.date) : '-';
}

function getDashboardStatsState() {
  try {
    const raw = localStorage.getItem('dashboardStats');
    if (raw) return JSON.parse(raw);
  } catch (e) { }
  const all = {};
  DASHBOARD_STATS.forEach(s => { all[s.key] = true; });
  return all;
}

function getDashboardStatsOrder() {
  try {
    const raw = localStorage.getItem('dashboardStatsOrder');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) {
        const valid = arr.filter(k => DASHBOARD_STATS.some(s => s.key === k));
        const missing = DASHBOARD_STATS.map(s => s.key).filter(k => !valid.includes(k));
        return [...valid, ...missing];
      }
    }
  } catch (e) { }
  return DASHBOARD_STATS.map(s => s.key);
}

function saveDashboardStatsOrder(order) {
  try { localStorage.setItem('dashboardStatsOrder', JSON.stringify(order)); } catch (e) { }
}

function saveDashboardStatsState(stateMap) {
  try { localStorage.setItem('dashboardStats', JSON.stringify(stateMap)); } catch (e) { }
}

function applyDashboardStatVisibility() {
  const map = getDashboardStatsState();
  document.querySelectorAll('.dash-card[data-stat]').forEach(card => {
    const key = card.getAttribute('data-stat');
    card.style.display = map[key] === false ? 'none' : '';
  });
}

function applyDashboardStatOrder() {
  const grid = document.querySelector('.dashboard-grid');
  if (!grid) return;
  const order = getDashboardStatsOrder();
  const cards = Array.from(grid.querySelectorAll('.dash-card[data-stat]'));
  const byKey = new Map(cards.map(c => [c.getAttribute('data-stat'), c]));
  order.forEach(k => {
    const el = byKey.get(k);
    if (el) grid.appendChild(el);
  });
  bindDashboardDragDrop();
}

function bindDashboardDragDrop() {
  const grid = document.querySelector('.dashboard-grid');
  if (!grid) return;
  let dragSrc = null;
  let dropTarget = null;
  let dropPos = null; // 'before' | 'after'

  const clearIndicators = () => {
    grid.querySelectorAll('.drop-before, .drop-after')
      .forEach(c => c.classList.remove('drop-before', 'drop-after'));
  };

  grid.querySelectorAll('.dash-card[data-stat]').forEach(card => {
    card.setAttribute('draggable', 'true');

    card.addEventListener('dragstart', e => {
      dragSrc = card;
      setTimeout(() => card.classList.add('dragging'), 0);
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      clearIndicators();
      if (dragSrc && dropTarget && dropTarget !== dragSrc) {
        if (dropPos === 'before') grid.insertBefore(dragSrc, dropTarget);
        else grid.insertBefore(dragSrc, dropTarget.nextSibling);
        const newOrder = Array.from(grid.querySelectorAll('.dash-card[data-stat]'))
          .map(c => c.getAttribute('data-stat'));
        saveDashboardStatsOrder(newOrder);
      }
      dragSrc = null; dropTarget = null; dropPos = null;
    });

    card.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!dragSrc || card === dragSrc) return;
      clearIndicators();
      const rect = card.getBoundingClientRect();
      dropPos = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
      dropTarget = card;
      card.classList.add(dropPos === 'before' ? 'drop-before' : 'drop-after');
    });

    card.addEventListener('drop', e => { e.preventDefault(); });
  });
}

function renderDashboardStatsMenu() {
  const menu = document.getElementById('dashboard-stats-menu');
  if (!menu) return;
  menu.innerHTML = '';

  const map = getDashboardStatsState();
  const order = getDashboardStatsOrder();

  const searchRow = document.createElement('div');
  searchRow.className = 'panel-search-row';
  searchRow.style.padding = '8px 10px 0';
  const searchInp = document.createElement('input');
  searchInp.className = 'panel-search';
  searchInp.placeholder = 'Search stats...';
  searchRow.appendChild(searchInp);
  menu.appendChild(searchRow);

  const actRow = document.createElement('div');
  actRow.className = 'panel-act-row';
  actRow.style.padding = '8px 10px 6px';
  const btnAll = document.createElement('button');
  btnAll.className = 'panel-act-btn';
  btnAll.textContent = 'All';
  const btnNone = document.createElement('button');
  btnNone.className = 'panel-act-btn';
  btnNone.textContent = 'None';
  btnAll.addEventListener('click', () => {
    DASHBOARD_STATS.forEach(s => { map[s.key] = true; });
    saveDashboardStatsState(map);
    renderDashboardStatsMenu();
    applyDashboardStatVisibility();
  });
  btnNone.addEventListener('click', () => {
    DASHBOARD_STATS.forEach(s => { map[s.key] = false; });
    saveDashboardStatsState(map);
    renderDashboardStatsMenu();
    applyDashboardStatVisibility();
  });
  actRow.appendChild(btnAll);
  actRow.appendChild(btnNone);
  menu.appendChild(actRow);

  const list = document.createElement('div');
  list.className = 'panel-list';
  list.style.padding = '0 10px 8px';
  menu.appendChild(list);

  const renderList = (q) => {
    list.innerHTML = '';
    const ql = (q || '').toLowerCase();
    const items = order
      .map(k => DASHBOARD_STATS.find(s => s.key === k))
      .filter(Boolean)
      .filter(s => !ql || s.label.toLowerCase().includes(ql));

    items.forEach(s => {
      const row = document.createElement('div');
      row.className = 'head-checkbox';
      row.setAttribute('draggable', 'true');
      row.dataset.stat = s.key;
      row.style.padding = '4px 0';
      row.style.cursor = 'grab';

      const handle = document.createElement('span');
      handle.textContent = '⋮⋮';
      handle.style.marginRight = '8px';
      handle.style.opacity = '0.6';
      handle.style.userSelect = 'none';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = map[s.key] !== false;
      chk.addEventListener('change', () => {
        map[s.key] = chk.checked;
        saveDashboardStatsState(map);
        applyDashboardStatVisibility();
      });

      const label = document.createElement('span');
      label.textContent = s.label;

      row.appendChild(handle);
      row.appendChild(chk);
      row.appendChild(label);

      row.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', s.key);
        row.style.opacity = '0.5';
      });
      row.addEventListener('dragend', () => { row.style.opacity = '1'; });
      row.addEventListener('dragover', e => { e.preventDefault(); row.style.borderTop = '1px dashed var(--border2)'; });
      row.addEventListener('dragleave', () => { row.style.borderTop = ''; });
      row.addEventListener('drop', e => {
        e.preventDefault();
        row.style.borderTop = '';
        const from = e.dataTransfer.getData('text/plain');
        const to = s.key;
        if (!from || from === to) return;
        const newOrder = order.filter(k => k !== from);
        const toIdx = newOrder.indexOf(to);
        newOrder.splice(toIdx, 0, from);
        saveDashboardStatsOrder(newOrder);
        renderList(searchInp.value);
        applyDashboardStatOrder();
      });

      list.appendChild(row);
    });
  };

  renderList('');
  searchInp.addEventListener('input', () => renderList(searchInp.value));
}


```

## File: `static\js\calendar.js`
```js
function renderCalendar() {
  syncAllTradeDates();
  if (state.calendarTagFocus && !getAllColumnTagKeys().includes(state.calendarTagFocus)) {
    state.calendarTagFocus = '';
  }
  updateRangeLabel();
  if (state.calendarView === 'year') {
    renderYearlyView();
    return;
  }
  const monthWrap = document.getElementById('calendar-month-view');
  const yearWrap = document.getElementById('calendar-year-view');
  if (monthWrap) monthWrap.classList.remove('hidden');
  if (yearWrap) yearWrap.classList.add('hidden');
  const grid = document.getElementById('calendar-grid');
  const weekdays = document.querySelector('.calendar-weekdays');
  const pos = window._dayPos || 'top-left';
  const satSunOff = window._satSunOff === true;
  const visibleDayCount = satSunOff ? 5 : 7;
  grid.className = `calendar-grid cal-pos-${pos}`;
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(${visibleDayCount}, 1fr)`;
  if (weekdays) {
    weekdays.style.gridTemplateColumns = `repeat(${visibleDayCount}, 1fr)`;
    weekdays.innerHTML = satSunOff
      ? '<div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div>'
      : '<div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div class="weekend">Sat</div><div class="weekend">Sun</div>';
  }

  const firstDay = new Date(state.year, state.month, 1).getDay();
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
  const today = new Date();
  const showLabels = window._showLabels !== false;
  const toMonIndex = dow => (dow === 0 ? 6 : dow - 1);

  let startOffset;
  if (!satSunOff) {
    startOffset = toMonIndex(firstDay);
  } else {
    let firstVisibleDay = 1;
    while (firstVisibleDay <= daysInMonth) {
      const d0 = new Date(state.year, state.month, firstVisibleDay).getDay();
      if (d0 !== 0 && d0 !== 6) break;
      firstVisibleDay++;
    }
    startOffset = firstVisibleDay <= daysInMonth
      ? toMonIndex(new Date(state.year, state.month, firstVisibleDay).getDay())
      : 0;
  }

  for (let i = 0; i < startOffset; i++) {
    const e = document.createElement('div'); e.className = 'day-cell empty';
    grid.appendChild(e);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(state.year, state.month, d);
    const dow = cellDate.getDay();
    const isWeekend = dow === 0 || dow === 6;
    if (satSunOff && isWeekend) continue;
    const dateStr = formatDate(cellDate);
    const dayTrades = getTradesForDate(dateStr).filter(tradeMatchesBrokerFilter);
    const trade = dayTrades[0] || null;
    const isToday = cellDate.toDateString() === today.toDateString();

    const cell = document.createElement('div'); cell.className = 'day-cell';
    if (isWeekend) cell.classList.add('weekend-day');
    if (isToday) cell.classList.add('today');

    const hasObs = dayTrades.some(t => t && t.observation);
    if (hasObs) cell.classList.add('has-obs');

    if (trade) {
      const p = parseFloat(trade['Profit'] ?? trade['profit'] ?? '');
      if (!isNaN(p) && p !== 0) cell.classList.add(p > 0 ? 'has-profit' : 'has-loss');
    }

    if (state.tagFilter.length > 0 && !dayTrades.some(tradeMatchesTagFilter)) {
      cell.classList.add('tag-filtered-out');
    }
    if (state.calendarTagFocus) {
      const focus = parseTagFilterKey(state.calendarTagFocus);
      const dayMatchesFocus = dayTrades.some(t => getTradeTagsForColumn(t, focus.col).includes(focus.tag));
      cell.classList.add(dayMatchesFocus ? 'calendar-tag-match' : 'calendar-tag-dim');
    }

    const numDiv = document.createElement('div'); numDiv.className = 'day-num';
    numDiv.textContent = d; cell.appendChild(numDiv);

    if (dayTrades.length) {
      const dataDiv = document.createElement('div'); dataDiv.className = 'day-data';
      const cols = state.columns.filter(col => getActiveShowHeads()[col] && col.toLowerCase() !== 'date' && !isTagColumn(col));
      if (state.calendarMode === 'individual') {
        dayTrades.forEach((tr, i) => {
          cols.forEach(col => {
            if (col.toLowerCase() === 'thumbnail') return;
            const val = tr[col];
            if (val === '' || val == null) return;
            const item = document.createElement('div'); item.className = 'day-data-item';
            const isProfit = col.toLowerCase().includes('profit') || col.toLowerCase() === 'rs';
            const prefix = dayTrades.length > 1 ? `#${i + 1} ` : '';
            if (isProfit) {
              const num = parseFloat(val);
              if (!isNaN(num)) {
                item.textContent = showLabels ? `${prefix}${col}: ${num > 0 ? '+' : ''}${num}` : `${prefix}${num > 0 ? '+' : ''}${num}`;
                item.classList.add(num >= 0 ? 'profit-pos' : 'profit-neg');
              } else { item.textContent = showLabels ? `${prefix}${col}: ${val}` : `${prefix}${val}`; }
            } else {
              item.textContent = showLabels ? `${prefix}${col}: ${val}` : `${prefix}${val}`;
            }
            dataDiv.appendChild(item);
          });
        });
      } else {
        cols.forEach(col => {
          if (col.toLowerCase() === 'thumbnail') return;
          const lower = col.toLowerCase();
          if (lower === 'sell time' || lower === 'buy time') return;
          const vals = dayTrades.map(t => t[col]).filter(v => v !== '' && v != null);
          if (!vals.length) return;
          const item = document.createElement('div'); item.className = 'day-data-item';
          const nums = vals.map(v => parseFloat(v)).filter(v => !isNaN(v));
          if (nums.length === vals.length) {
            let outNum;
            if (lower === 'sell price' || lower === 'buy price') {
              outNum = nums.reduce((a, b) => a + b, 0) / nums.length;
            } else {
              outNum = nums.reduce((a, b) => a + b, 0);
            }
            const out = outNum % 1 === 0 ? outNum : outNum.toFixed(2);
            item.textContent = showLabels ? `${col}: ${out}` : `${out}`;
            if (lower.includes('profit') || lower === 'rs') item.classList.add(outNum >= 0 ? 'profit-pos' : 'profit-neg');
          } else {
            const first = String(vals[0]);
            const same = vals.every(v => String(v) === first);
            item.textContent = same ? (showLabels ? `${col}: ${first}` : first) : (showLabels ? `${col}: ${vals.length} entries` : `${vals.length}`);
          }
          dataDiv.appendChild(item);
        });
      }

      const dayTagKeys = [];
      getTagColumns().forEach(col => {
        const tags = Array.from(new Set(dayTrades.flatMap(t => getTradeTagsForColumn(t, col))));
        tags.forEach(tag => dayTagKeys.push(makeTagFilterKey(col, tag)));
      });
      if (dayTagKeys.length) {
        const tagWrap = document.createElement('div');
        tagWrap.className = 'day-tag-bubbles';
        dayTagKeys.forEach(key => {
          const parsed = parseTagFilterKey(key);
          const bubble = document.createElement('button');
          bubble.type = 'button';
          bubble.className = 'day-tag-bubble';
          if (state.calendarTagFocus === key) bubble.classList.add('active');
          bubble.textContent = `${parsed.col}: ${parsed.tag}`;
          const c = tagColor(parsed.tag);
          bubble.style.color = c;
          bubble.style.borderColor = hexToRgba(c, 0.55);
          bubble.style.background = hexToRgba(c, 0.14);
          bubble.addEventListener('click', e => {
            e.stopPropagation();
            state.calendarTagFocus = (state.calendarTagFocus === key) ? '' : key;
            renderCalendar();
          });
          tagWrap.appendChild(bubble);
        });
        dataDiv.appendChild(tagWrap);
      }

      if (hasObs) {
        const note = document.createElement('span');
        note.className = 'day-note-indicator';
        note.title = 'Observation available';
        note.textContent = 'N';
        dataDiv.appendChild(note);
      }

      cell.appendChild(dataDiv);

      if (state.calendarMode === 'consolidated') {
        const thumbnailImg = getThumbnailTaggedImageForTrades(dayTrades);
        if (thumbnailImg) {
          const timg = document.createElement('img');
          timg.className = 'day-thumb-image';
          timg.src = thumbnailImg;
          timg.alt = 'thumbnail';
          timg.title = 'Thumbnail tagged image';
          cell.appendChild(timg);
        }
      }

      const imgs = [...(state.dayData[dateStr]?.images || []), ...dayTrades.flatMap(t => t.images || [])];
      if (imgs.length > 0) {
        const badge = document.createElement('div'); badge.className = 'day-img-badge';
        badge.textContent = `Img ${imgs.length}`; cell.appendChild(badge);
      }
    }

    const pencil = document.createElement('button'); pencil.className = 'day-pencil';
    pencil.title = 'Add observation'; pencil.textContent = 'Note';
    pencil.addEventListener('click', e => { e.stopPropagation(); openObsModal(dateStr); });
    cell.appendChild(pencil);

    cell.addEventListener('click', () => openGalleryForDate(dateStr));
    grid.appendChild(cell);
  }
}

function renderYearlyView() {
  const monthWrap = document.getElementById('calendar-month-view');
  const yearWrap = document.getElementById('calendar-year-view');
  if (monthWrap) monthWrap.classList.add('hidden');
  if (!yearWrap) return;
  yearWrap.classList.remove('hidden');
  yearWrap.innerHTML = '';

  const year = state.year;
  const pnlByDate = new Map();
  state.trades.forEach(t => {
    if (!tradeMatchesBrokerFilter(t)) return;
    const ds = normalizeDate(extractDateFromTrade(t));
    const pnl = getTradePnl(t);
    if (!ds || pnl === null) return;
    pnlByDate.set(ds, (pnlByDate.get(ds) || 0) + pnl);
  });

  for (let m = 0; m < 12; m++) {
    const monthBox = document.createElement('div');
    monthBox.className = 'year-month';
    const title = document.createElement('div');
    title.className = 'year-month-title';
    title.textContent = MONTHS[m].slice(0, 3);
    monthBox.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'year-grid';
    const firstDay = new Date(year, m, 1).getDay();
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const toMonIndex = dow => (dow === 0 ? 6 : dow - 1);
    const startOffset = toMonIndex(firstDay);

    for (let i = 0; i < startOffset; i++) {
      const blank = document.createElement('div');
      blank.className = 'year-cell';
      blank.style.opacity = '0.25';
      grid.appendChild(blank);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const val = pnlByDate.get(dateStr) || 0;
      const cell = document.createElement('div');
      cell.className = 'year-cell';
      if (val > 0) cell.classList.add('pos');
      else if (val < 0) cell.classList.add('neg');
      else cell.classList.add('zero');
      cell.title = `${dateStr} • ${formatCurrency(val)}`;
      grid.appendChild(cell);
    }

    monthBox.appendChild(grid);
    yearWrap.appendChild(monthBox);
  }
}

function updateRangeLabel() {
  const label = document.getElementById('month-range-label');
  if (!label) return;
  if (state.calendarView === 'year') {
    label.textContent = `From ${MONTHS[0].slice(0, 3)} ${state.year} to ${MONTHS[11].slice(0, 3)} ${state.year}`;
  } else {
    const first = new Date(state.year, state.month, 1);
    const last = new Date(state.year, state.month + 1, 0);
    label.textContent = `${formatDate(first)} to ${formatDate(last)}`;
  }
}

function getTradeForDate(dateStr) {
  return state.trades.find(t => normalizeDate(extractDateFromTrade(t)) === dateStr) || null;
}

function getTradesForDate(dateStr) {
  return state.trades.filter(t => normalizeDate(extractDateFromTrade(t)) === dateStr);
}

function getThumbnailTaggedImageForTrades(trades) {
  const rows = Array.isArray(trades) ? trades : [];
  for (const t of rows) {
    const imgs = Array.isArray(t.images) ? t.images : [];
    for (const url of imgs) {
      const tags = getImageTagsForUrl(t, url).map(x => x.toLowerCase());
      if (tags.includes('thumbnail')) return url;
    }
  }
  return '';
}

function getOrCreateTrade(dateStr) {
  let trade = getTradeForDate(dateStr);
  if (!trade) {
    trade = { date: dateStr, images: [] };
    state.columns.forEach(col => { trade[col] = ''; });
    state.trades.push(trade);
  } else {
    syncTradeDateField(trade);
  }
  return trade;
}

function extractDateFromTrade(trade) {
  if (!trade) return '';
  if (trade.date) return trade.date;
  if (trade.Date) return trade.Date;
  for (const k of Object.keys(trade)) {
    if (k.toLowerCase().includes('date') && trade[k]) return trade[k];
  }
  return '';
}

function syncTradeDateField(trade) {
  if (!trade) return;
  trade.date = normalizeDate(extractDateFromTrade(trade));
}

function syncAllTradeDates() {
  state.trades.forEach(syncTradeDateField);
}

function normalizeDate(val) {
  if (!val) return '';
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const dd = parseInt(dmy[1], 10);
    const mm = parseInt(dmy[2], 10);
    const yy = parseInt(dmy[3], 10);
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
      return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return formatDate(d);
  return String(val);
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function openObsModal(dateStr) {
  state.obsDate = dateStr;
  document.getElementById('obs-modal-date').textContent = formatDisplayDate(dateStr);
  document.getElementById('obs-date-picker').value = dateStr;
  const trade = getTradeForDate(dateStr);
  document.getElementById('obs-editor').innerHTML = (trade && trade.observation) ? trade.observation : '';
  renderObsTradeNotes(dateStr);
  document.getElementById('obs-modal').classList.add('open');
  setTimeout(() => document.getElementById('obs-editor').focus(), 50);
}

function renderObsTradeNotes(dateStr) {
  const container = document.getElementById('obs-trade-notes');
  if (!container) return;
  container.innerHTML = '';

  const trades = getTradesForDate(dateStr);
  if (!trades.length) return;

  const instrCol = state.columns.find(c => /instrument|symbol|scrip|stock/i.test(c)) || state.columns[0];

  const hdr = document.createElement('div');
  hdr.className = 'obs-trade-notes-hdr';
  hdr.textContent = 'Per-Trade Notes';
  container.appendChild(hdr);

  let _noteItemDragFromHandle = false;

  trades.forEach((trade, i) => {
    const rowIdx = state.trades.indexOf(trade);
    const label = (instrCol && trade[instrCol]) ? trade[instrCol] : `Trade ${i + 1}`;

    const item = document.createElement('div');
    item.className = 'obs-trade-note-item';
    item.dataset.rowIdx = rowIdx;

    const handle = document.createElement('span');
    handle.className = 'obs-note-drag-handle';
    handle.textContent = '⠿';
    handle.title = 'Drag to move note to another trade';
    handle.addEventListener('mousedown', () => { _noteItemDragFromHandle = true; });

    const lbl = document.createElement('div');
    lbl.className = 'obs-trade-note-label';
    lbl.textContent = label;

    const tb = document.createElement('div'); tb.className = 'obs-trade-note-toolbar';
    [['B', 'bold'], ['I', 'italic'], ['U', 'underline']].forEach(([lbl2, cmd]) => {
      const btn = document.createElement('button'); btn.className = 'note-popup-tool';
      btn.innerHTML = `<${lbl2.toLowerCase()}>${lbl2}</${lbl2.toLowerCase()}>`;
      btn.addEventListener('mousedown', e => { e.preventDefault(); document.execCommand(cmd); });
      tb.appendChild(btn);
    });

    const editor = document.createElement('div');
    editor.className = 'obs-trade-note-editor';
    editor.contentEditable = 'true';
    editor.spellcheck = false;
    editor.dataset.rowIdx = rowIdx;
    const stored = (rowIdx >= 0 && state.trades[rowIdx]) ? (state.trades[rowIdx][NOTE_COLUMN] || '') : '';
    editor.innerHTML = stored || '<br>';

    editor.addEventListener('blur', () => {
      const ri = parseInt(editor.dataset.rowIdx, 10);
      if (!isNaN(ri) && state.trades[ri]) {
        const val = stripHtml(editor.innerHTML).trim() ? editor.innerHTML : '';
        state.trades[ri][NOTE_COLUMN] = val;
        saveTrades();
        document.querySelectorAll(`[data-note-row="${ri}"]`).forEach(el => _refreshNoteCellDisplay(el, val));
      }
    });

    lbl.style.cursor = 'pointer';
    lbl.title = 'Click to focus note';
    lbl.addEventListener('click', ev => { ev.preventDefault(); editor.focus(); });

    item.setAttribute('draggable', 'true');
    item.addEventListener('dragstart', e => {
      if (!_noteItemDragFromHandle) { e.preventDefault(); return; }
      _noteItemDragFromHandle = false;
      const srcHtml = stripHtml(editor.innerHTML).trim() ? editor.innerHTML : '';
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('tj-note', JSON.stringify({ rowIdx, html: srcHtml }));
      item.classList.add('obs-note-dragging');
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('obs-note-dragging');
      container.querySelectorAll('.obs-note-drop-target').forEach(el => el.classList.remove('obs-note-drop-target'));
    });
    item.addEventListener('dragover', e => {
      if (!e.dataTransfer.types.includes('tj-note')) return;
      e.preventDefault();
      container.querySelectorAll('.obs-note-drop-target').forEach(el => el.classList.remove('obs-note-drop-target'));
      item.classList.add('obs-note-drop-target');
    });
    item.addEventListener('dragleave', () => item.classList.remove('obs-note-drop-target'));
    item.addEventListener('drop', e => {
      e.preventDefault();
      item.classList.remove('obs-note-drop-target');
      const raw = e.dataTransfer.getData('tj-note');
      if (!raw) return;
      const { rowIdx: srcIdx, html: srcHtml } = JSON.parse(raw);
      const destIdx = parseInt(item.dataset.rowIdx, 10);
      if (srcIdx === destIdx || isNaN(destIdx)) return;
      state.trades[destIdx][NOTE_COLUMN] = srcHtml;
      state.trades[srcIdx][NOTE_COLUMN] = '';
      saveTrades();
      renderObsTradeNotes(state.obsDate);
    });

    item.appendChild(handle);
    item.appendChild(lbl);
    item.appendChild(tb);
    item.appendChild(editor);
    container.appendChild(item);
  });
}

function saveObservation(andClose = true) {
  const html = document.getElementById('obs-editor').innerHTML;
  const trade = getOrCreateTrade(state.obsDate);
  trade.observation = html;
  document.querySelectorAll('#obs-trade-notes .obs-trade-note-editor').forEach(ed => {
    const ri = parseInt(ed.dataset.rowIdx, 10);
    if (!isNaN(ri) && state.trades[ri]) {
      state.trades[ri][NOTE_COLUMN] = stripHtml(ed.innerHTML).trim() ? ed.innerHTML : '';
    }
  });
  saveTrades();
  renderCalendar();
  renderTable();
  if (andClose) {
    document.getElementById('obs-modal').classList.remove('open');
    showToast('Observation saved!', 'success');
  }
}

function navigateObsDate(dir) {
  saveObservation(false);

  const dataOnly = document.getElementById('obs-data-only').checked;
  let dates;
  if (dataOnly) {
    dates = state.trades.filter(t => t.date).map(t => t.date).sort();
  } else {
    const dim = new Date(state.year, state.month + 1, 0).getDate();
    dates = Array.from({ length: dim }, (_, i) => formatDate(new Date(state.year, state.month, i + 1)));
  }

  let idx = dates.indexOf(state.obsDate);
  if (idx === -1) idx = dir > 0 ? -1 : dates.length;
  const next = idx + dir;
  if (next < 0 || next >= dates.length) return;
  openObsModal(dates[next]);
}

function bindObsToolbar() {
  document.querySelectorAll('.obs-tool[data-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      document.getElementById('obs-editor').focus();
      document.execCommand(btn.dataset.cmd, false, btn.dataset.val || null);
    });
  });

  document.getElementById('obs-apply-size').addEventListener('mousedown', e => {
    e.preventDefault();
    const size = document.getElementById('obs-custom-size').value;
    if (!size) return;
    const editor = document.getElementById('obs-editor');
    editor.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const span = document.createElement('span');
      span.style.fontSize = size + 'px';
      const zws = document.createTextNode('\u200B'); // zero-width space as placeholder
      span.appendChild(zws);
      range.insertNode(span);
      const nr = document.createRange();
      nr.setStart(zws, 1); nr.collapse(true);
      sel.removeAllRanges(); sel.addRange(nr);
    } else {
      const range = sel.getRangeAt(0);
      const span = document.createElement('span');
      span.style.fontSize = size + 'px';
      try { range.surroundContents(span); }
      catch (ex) { document.execCommand('insertHTML', false, `<span style="font-size:${size}px">${range.toString()}</span>`); }
    }
  });

  document.getElementById('obs-insert-img').addEventListener('click', () => {
    document.getElementById('obs-img-input').click();
  });
  document.getElementById('obs-img-input').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      document.getElementById('obs-editor').focus();
      document.execCommand('insertHTML', false,
        `<img src="${ev.target.result}" style="max-width:100%;border-radius:6px;margin:6px 0" />`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  document.getElementById('obs-insert-link').addEventListener('click', () => {
    const url = prompt('Enter URL (e.g. https://example.com):');
    if (!url) return;
    document.getElementById('obs-editor').focus();
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      document.execCommand('createLink', false, url);
    } else {
      document.execCommand('insertHTML', false, `<a href="${url}" target="_blank">${url}</a>`);
    }
  });

  document.getElementById('obs-editor').addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault(); e.stopPropagation();
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
    }
  });
}


```
