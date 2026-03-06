# JS — State & IO (state.js / io.js)
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `static\js\state.js`
```js
/**
 * @fileoverview state.js
 * @description Defines the two global singletons used everywhere: state and annotState.
 * @exports state, annotState
 * @keyfields state.trades[], state.dayData{}, state.columns[], state.gallery{},
 *            state.tagGroups{}, state.dateRange{from,to}, state.uploadRow,
 *            state._localOverlays{}, state._galleryUploadCallback,
 *            state.gallery.selectedSeparator, state.gallery.showTime, state.gallery.imageTimes
 *            annotState.active, annotState.tool, annotState.imageUrl, annotState.dirty
 * @note MUST be the first script loaded. All other modules read/write these objects directly.
 */

/* ================================================
   Trading Journal - state.js
   ================================================ */

const state = {
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  trades: [],
  columns: [],
  showHeads: {},           // deprecated alias – do not use directly
  showHeadsConsolidated: {},
  showHeadsIndividual: {},
  dateRange: { from: '', to: '' },
  tableShowCols: {},
  tableSort: { col: null, dir: 'asc' },
  colWidths: {},
  filterValues: {},
  filterVisible: false,
  calendarMode: 'consolidated',
  gallery: {
    images: [], currentIndex: 0, date: '', sourceRow: null,
    tagFilter: [], filterMode: 'or',
    hiddenImages: new Set(), layerPanelOpen: false
  },  // V2: tagFilter = selected tag names
  tagGroups: {},  // { groupName: [tagName, ...] } — user-defined groups
  tagDeleteMode: false,
  uploadRow: null,
  pendingFiles: [],
  obsDate: '',
  allTags: [],   // all defined tag names
  tagFilter: [],   // selected filters in form "Column::Tag"
  calendarTagFocus: '', // selected calendar tag bubble in form "Column::Tag"
  tagColumns: [],   // explicit list of tag columns (rename-safe)
  userColumns: [],   // only these columns are deletable
  addTagColumnMode: false,
  brokerFilter: 'both', // both | zerodha | dhan
  calendarView: 'month', // month | year
  shortcuts: {},
  dayData: {},   // keyed by YYYY-MM-DD: { images: [], tags: { ColName: [tag,...] } }
  _localOverlays: {}, // temporary per-image overlay cache until upload completes
  serverStateHash: '',
  syncIntervalMs: 10000
};

const annotState = {
  active: false,
  tool: 'pen',    // 'pen' | 'highlight' | 'eraser' | 'text' | 'marquee'
  color: '#f85149',
  size: 3,
  imageUrl: '',
  date: '',
  sourceRow: null,
  dirty: false,
  saving: false,
  history: [],       // ImageData snapshots for undo
  drawing: false,
  textEditorActive: false,
  marqueeBoxes: [],
  selectedMarquee: -1,
  marqueeStartX: 0,
  marqueeStartY: 0,
  marqueePreview: null,
  marqueeRasterBase: null,
  marqueeDragMode: '',
  marqueeDragStartX: 0,
  marqueeDragStartY: 0,
  marqueeDragOrig: null,
  multiSelectMode: false,
  selectedMarquees: [],
  marqueeSelectStartX: 0,
  marqueeSelectStartY: 0,
  marqueeSelectRect: null,
  marqueeDragGroupOrig: [],
  lastX: 0, lastY: 0
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const SIZE_MAP = { H1: '1.4rem', H2: '1.1rem', H3: '0.9rem', H4: '0.75rem', H5: '0.62rem' };
const HEIGHT_MAP = { compact: '70px', normal: '100px', spacious: '140px', roomy: '180px' };

const DEFAULT_SETTINGS = {
  daySize: 'H3', dayBold: true, dayPos: 'top-left',
  dataSize: 'H4', dataBold: false, showLabels: true, cellHeight: 'normal',
  satSunOff: true, tableRows: 5,
  groupAColor: '#58a6ff',
  groupBColor: '#ffffff',
  groupSepColor: '#58a6ff'
};

const DEFAULT_SHORTCUTS = {
  pen: 'B',
  imageImport: 'I',
  eraser: 'E',
  datePicker: 'D',
  mergeSave: 'Ctrl+Shift+S',
  overlaySave: 'Ctrl+S'
};
const DASHBOARD_STATS = [
  { key: 'overall', label: 'Overall P&L' },
  { key: 'net', label: 'Net P&L' },
  { key: 'trades', label: 'Total Trades' },
  { key: 'charges', label: 'Charges' },
  { key: 'brokerage', label: 'Brokerage' },
  { key: 'totalfees', label: 'Total Fees' },
  { key: 'winrate', label: 'Win %' },
  { key: 'avg', label: 'Avg / Trade' },
  { key: 'avgwin', label: 'Avg Win' },
  { key: 'avgloss', label: 'Avg Loss' },
  { key: 'best', label: 'Best Day' },
  { key: 'worst', label: 'Worst Day' },
  { key: 'dd', label: 'Max Drawdown' }
];
const IMAGE_TAG_COLUMN = 'Image Tags';
const BROKER_COLUMN = 'Broker';
const NOTE_COLUMN = 'Note';
const VIDEO_COLUMN = 'Video';
const TOTAL_FEES_COLUMN = 'Total Fees';
const TOTAL_TRADES_COLUMN = 'Total Trades';
const IMAGE_PERMANENT_TAGS = ['thumbnail'];
const PERMANENT_COLUMNS = [BROKER_COLUMN, IMAGE_TAG_COLUMN, NOTE_COLUMN, VIDEO_COLUMN, TOTAL_TRADES_COLUMN];
const COMPUTED_COLUMNS = ['Brokerage', 'Other Charges', 'Gross P/L', 'Net P/L', TOTAL_FEES_COLUMN];
const UNIFIED_STRUCTURED_COLUMNS = [
  'Instrument',
  BROKER_COLUMN,
  'TradeType',
  'Qty',
  'Sell Time',
  'Sell Price (Avg)',
  'Buy Time',
  'Buy Price (Avg)',
  'Pt',
  'Rs',
  'trade_date'
];
const IS_TOUCH_DEVICE = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

function getSectionOrder() {
  try { const o = JSON.parse(localStorage.getItem('sectionOrder')); if (Array.isArray(o) && o.length === 4) return o; } catch (e) { }
  return ['calendar', 'dashboard', 'visual-dashboard', 'table'];
}
function saveSectionOrder(order) { try { localStorage.setItem('sectionOrder', JSON.stringify(order)); } catch (e) { } }
function applySectionOrder() {
  const order = getSectionOrder();
  const main = document.querySelector('.app-main');
  const map = { calendar: '.calendar-section', dashboard: '.dashboard-section', 'visual-dashboard': '.visual-dashboard-section', table: '.table-section' };
  order.forEach(key => { const el = main.querySelector(map[key]); if (el) main.appendChild(el); });
  const list = document.getElementById('section-order-list');
  if (!list) return;
  order.forEach(key => {
    const item = list.querySelector(`[data-section="${key}"]`);
    if (item) list.appendChild(item);
  });
}
function bindSectionOrderDrag() {
  const list = document.getElementById('section-order-list');
  if (!list) return;
  let srcItem = null, dropTarget2 = null, dropPos2 = null;
  const clearInd = () => list.querySelectorAll('.so-drop-before,.so-drop-after').forEach(el => el.classList.remove('so-drop-before', 'so-drop-after'));
  list.querySelectorAll('.section-order-item').forEach(item => {
    item.addEventListener('dragstart', e => { srcItem = item; setTimeout(() => item.classList.add('so-dragging'), 0); e.dataTransfer.effectAllowed = 'move'; });
    item.addEventListener('dragend', () => {
      item.classList.remove('so-dragging'); clearInd();
      if (srcItem && dropTarget2 && dropTarget2 !== srcItem) {
        if (dropPos2 === 'before') list.insertBefore(srcItem, dropTarget2);
        else list.insertBefore(srcItem, dropTarget2.nextSibling);
        const newOrder = Array.from(list.querySelectorAll('.section-order-item')).map(el => el.dataset.section);
        saveSectionOrder(newOrder); applySectionOrder();
      }
      srcItem = null; dropTarget2 = null; dropPos2 = null;
    });
    item.addEventListener('dragover', e => {
      e.preventDefault(); if (!srcItem || item === srcItem) return;
      clearInd();
      const rect = item.getBoundingClientRect();
      dropPos2 = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      dropTarget2 = item;
      item.classList.add(dropPos2 === 'before' ? 'so-drop-before' : 'so-drop-after');
    });
    item.addEventListener('drop', e => { e.preventDefault(); });
  });
}


```

## File: `static\js\io.js`
```js
/**
 * @fileoverview io.js
 * @description Upload modal, image drag-drop on table rows, CSV/JSON import, export, backup, toast.
 * @exports openUploadModal, openDayUploadModal, renderUploadPreview, handleImageFiles,
 *          uploadImagesToRow, uploadImagesToDayData, bindRowImageDrop, bindTableRowDrag,
 *          importExcel, importRawCsv, importHistoricalCsv, importDhanCsv, importJson,
 *          backupJson, exportExcel, exportStructuredCsv,
 *          showToast, setupDropdown, closeAllDropdowns
 * @reads state.trades, state.dayData, state.uploadRow, state.pendingFiles, state._dayUploadKey
 * @writes state.pendingFiles, state.trades[].images, state.dayData[].images
 * @calls saveTrades, render, fetch /api/upload, /api/backup, /api/import-json
 */


function openUploadModal(rowIdx) {
  syncTradeDateField(state.trades[rowIdx]);
  state.uploadRow = rowIdx;
  state._dayUploadKey = null;
  state.pendingFiles = []; // Start empty instead of existing images
  document.getElementById('upload-modal-title').textContent = `Images â€” ${state.trades[rowIdx].date || `Row ${rowIdx + 1}`}`;
  renderUploadPreview();
  document.getElementById('upload-modal').classList.add('open');
}

function openDayUploadModal(dateKey) {
  state.uploadRow = null;
  state._dayUploadKey = dateKey;
  state.pendingFiles = []; // Start empty instead of existing images
  document.getElementById('upload-modal-title').textContent = `Images â€” ${dateKey}`;
  renderUploadPreview();
  document.getElementById('upload-modal').classList.add('open');
}

function renderUploadPreview() {
  const c = document.getElementById('upload-preview'); c.innerHTML = '';
  state.pendingFiles.forEach((url, i) => {
    const item = document.createElement('div'); item.className = 'preview-item';
    const img = document.createElement('img'); img.src = url;
    const del = document.createElement('button'); del.className = 'remove-preview'; del.textContent = 'âœ•';
    del.addEventListener('click', () => { state.pendingFiles.splice(i, 1); renderUploadPreview(); });
    item.appendChild(img); item.appendChild(del); c.appendChild(item);
  });
}

async function handleImageFiles(files) {
  for (const file of files) {
    try {
      const fd = new FormData(); fd.append('image', file);
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.url) { state.pendingFiles.push(data.url); renderUploadPreview(); }
    } catch (e) { showToast('Image upload failed', 'error'); }
  }
}

async function uploadImagesToRow(rowIdx, files) {
  if (!Array.isArray(files) || !files.length) return;
  const trade = state.trades[rowIdx];
  if (!trade) return;
  if (!trade.images) trade.images = [];
  syncTradeDateField(trade);
  let added = 0;
  for (const file of files) {
    if (!file || !String(file.type || '').startsWith('image/')) continue;
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.url) {
        trade.images.push(data.url);
        added++;
      }
    } catch (e) { }
  }
  if (added > 0) {
    await saveTrades();
    render();
    showToast(`${added} image added to row`, 'success');
  }
}

async function uploadImagesToDayData(dateKey, files) {
  if (!Array.isArray(files) || !files.length) return;
  if (!state.dayData[dateKey]) state.dayData[dateKey] = {};
  if (!state.dayData[dateKey].images) state.dayData[dateKey].images = [];
  let added = 0;
  for (const file of files) {
    if (!file || !String(file.type || '').startsWith('image/')) continue;
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.url) { state.dayData[dateKey].images.push(data.url); added++; }
    } catch (e) { }
  }
  if (added > 0) { await saveTrades(); render(); showToast(`${added} image added`, 'success'); }
}

function bindRowImageDrop(rowEl, rowIdx) {
  rowEl.addEventListener('dragover', e => {
    const hasFiles = e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    const hasImg = e.dataTransfer && e.dataTransfer.types.includes('tj-img');
    if (!hasFiles && !hasImg) return;
    e.preventDefault();
    rowEl.classList.add('row-drop-target');
  });
  rowEl.addEventListener('dragleave', () => rowEl.classList.remove('row-drop-target'));
  rowEl.addEventListener('drop', async e => {
    rowEl.classList.remove('row-drop-target');
    const internal = e.dataTransfer.getData('tj-img');
    if (internal) {
      e.preventDefault();
      try {
        const { rowIdx: srcIdx, url } = JSON.parse(internal);
        if (srcIdx !== rowIdx) {
          if (!state.trades[rowIdx].images) state.trades[rowIdx].images = [];
          state.trades[rowIdx].images.push(url);
          if (e.dataTransfer.effectAllowed !== 'copy')
            state.trades[srcIdx].images = (state.trades[srcIdx].images || []).filter(u => u !== url);
          await saveTrades(); render();
          showToast(e.dataTransfer.effectAllowed === 'copy' ? 'Image copied' : 'Image moved', 'success');
        }
      } catch (err) { }
      return;
    }
    const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
    if (!files.length) return;
    e.preventDefault();
    await uploadImagesToRow(rowIdx, files);
  });
}

let _rowDragSrcIdx = null;
let _rowDropTarget = null;
let _rowDropPos = null; // 'before' | 'after'
let _rowDragFromHandle = false; // true only when drag started from the ⠿ handle
document.addEventListener('mouseup', () => { _rowDragFromHandle = false; }, true);

function bindTableRowDrag(tr, rowIdx, body) {
  tr.setAttribute('draggable', 'true');
  tr.addEventListener('dragstart', e => {
    if (!_rowDragFromHandle) { e.preventDefault(); return; }
    _rowDragFromHandle = false;
    _rowDragSrcIdx = rowIdx;
    setTimeout(() => tr.classList.add('dragging'), 0);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('tj-row', String(rowIdx));
  });
  tr.addEventListener('dragend', () => {
    tr.classList.remove('dragging');
    body.querySelectorAll('.row-drop-before, .row-drop-after').forEach(r => r.classList.remove('row-drop-before', 'row-drop-after'));
    if (_rowDragSrcIdx !== null && _rowDropTarget !== null) {
      const srcTrade = state.trades[_rowDragSrcIdx];
      const tgtTrade = _rowDropTarget.__tradeRef;
      if (srcTrade && tgtTrade && srcTrade !== tgtTrade) {
        const srcI = state.trades.indexOf(srcTrade);
        let tgtI = state.trades.indexOf(tgtTrade);
        if (srcI !== -1 && tgtI !== -1) {
          state.trades.splice(srcI, 1);
          tgtI = state.trades.indexOf(tgtTrade);
          if (_rowDropPos === 'after') tgtI += 1;
          state.trades.splice(tgtI, 0, srcTrade);
          saveTrades(); render();
        }
      }
    }
    _rowDragSrcIdx = null; _rowDropTarget = null; _rowDropPos = null;
  });
  tr.__tradeRef = state.trades[rowIdx];
  tr.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('tj-row')) return;
    e.preventDefault();
    body.querySelectorAll('.row-drop-before, .row-drop-after').forEach(r => r.classList.remove('row-drop-before', 'row-drop-after'));
    const rect = tr.getBoundingClientRect();
    _rowDropPos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    _rowDropTarget = tr;
    tr.classList.add(_rowDropPos === 'before' ? 'row-drop-before' : 'row-drop-after');
  });
  tr.addEventListener('drop', e => { e.preventDefault(); });
}

async function importExcel(file) {
  const fd = new FormData(); fd.append('file', file);
  try {
    showToast('Importing Excel...', '');
    const res = await fetch('/api/import-excel', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.error) { showToast(data.error, 'error'); return; }
    state.trades = data.trades;
    state.columns = data.columns;
    state.allTags = data.allTags || state.allTags || [];
    state.tagColumns = Array.isArray(data.tagColumns) ? data.tagColumns : state.tagColumns;
    state.userColumns = Array.isArray(data.userColumns) ? data.userColumns : [];
    ensurePermanentColumns();
    syncTagColumnRegistry();
    syncImageTagColumnValues();
    state.userColumns = state.userColumns.filter(c => state.columns.includes(c));
    migrateLegacyTagsData();
    initShowHeads(); initTableShowCols();
    await saveTrades(); render();
    showToast('Excel imported!', 'success');
  } catch (e) { showToast('Import failed', 'error'); }
}

async function importRawCsv(file) {
  const fd = new FormData();
  fd.append('file', file);
  try {
    showToast('Consolidating Zerodha today CSV...', '');
    const res = await fetch('/api/import-raw-csv', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.error) { showToast(data.error, 'error'); return; }
    const imported = (data.trades || []).map(t => {
      const row = normalizeStructuredTradeRow(t);
      row[BROKER_COLUMN] = 'zerodha';
      return row;
    });
    const mergedResult = mergeStructuredTrades(state.trades, imported);
    state.trades = mergedResult.merged;
    state.columns = Array.from(new Set([...(state.columns || []), ...UNIFIED_STRUCTURED_COLUMNS]));
    state.allTags = data.allTags || state.allTags || [];
    state.tagColumns = Array.isArray(data.tagColumns) ? data.tagColumns : state.tagColumns;
    state.userColumns = Array.isArray(state.userColumns) ? state.userColumns : [];
    ensurePermanentColumns();
    syncTagColumnRegistry();
    syncImageTagColumnValues();
    state.userColumns = state.userColumns.filter(c => state.columns.includes(c));
    normalizeStructuredDateColumns();
    migrateLegacyTagsData();
    initShowHeads();
    initTableShowCols();
    await saveTrades();
    render();
    showToast(`Zerodha Today CSV merged: ${mergedResult.added} new trade(s)`, 'success');
  } catch (e) {
    showToast('Zerodha Today CSV import failed', 'error');
  }
}

async function importHistoricalCsv(file) {
  const fd = new FormData();
  fd.append('file', file);
  try {
    showToast('Consolidating Zerodha historical CSV...', '');
    const res = await fetch('/api/import-historical-csv', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.error) { showToast(data.error, 'error'); return; }
    const imported = (data.trades || []).map(t => {
      const row = normalizeStructuredTradeRow(t);
      row[BROKER_COLUMN] = 'zerodha';
      return row;
    });
    const mergedResult = mergeStructuredTrades(state.trades, imported);
    state.trades = mergedResult.merged;
    state.columns = Array.from(new Set([...(state.columns || []), ...UNIFIED_STRUCTURED_COLUMNS]));
    state.allTags = data.allTags || state.allTags || [];
    state.tagColumns = Array.isArray(data.tagColumns) ? data.tagColumns : state.tagColumns;
    state.userColumns = Array.isArray(state.userColumns) ? state.userColumns : [];
    ensurePermanentColumns();
    syncTagColumnRegistry();
    syncImageTagColumnValues();
    state.userColumns = state.userColumns.filter(c => state.columns.includes(c));
    migrateLegacyTagsData();
    initShowHeads();
    initTableShowCols();
    await saveTrades();
    render();
    showToast(`Historical CSV merged: ${mergedResult.added} new trade(s)`, 'success');
  } catch (e) {
    showToast('Historical CSV import failed', 'error');
  }
}

async function importDhanCsv(file) {
  const fd = new FormData();
  fd.append('file', file);
  try {
    showToast('Consolidating Dhan CSV...', '');
    const res = await fetch('/api/import-dhan-csv', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.error) { showToast(data.error, 'error'); return; }
    const imported = (data.trades || []).map(t => {
      const row = normalizeStructuredTradeRow(t);
      row[BROKER_COLUMN] = 'dhan';
      return row;
    });
    const mergedResult = mergeStructuredTrades(state.trades, imported);
    state.trades = mergedResult.merged;
    state.columns = Array.from(new Set([...(state.columns || []), ...UNIFIED_STRUCTURED_COLUMNS]));
    state.allTags = data.allTags || state.allTags || [];
    state.tagColumns = Array.isArray(data.tagColumns) ? data.tagColumns : state.tagColumns;
    state.userColumns = Array.isArray(state.userColumns) ? state.userColumns : [];
    ensurePermanentColumns();
    syncTagColumnRegistry();
    syncImageTagColumnValues();
    state.userColumns = state.userColumns.filter(c => state.columns.includes(c));
    migrateLegacyTagsData();
    initShowHeads();
    initTableShowCols();
    await saveTrades();
    render();
    showToast(`Dhan CSV merged: ${mergedResult.added} new trade(s)`, 'success');
  } catch (e) {
    showToast('Dhan CSV import failed', 'error');
  }
}

async function importJson(file) {
  const fd = new FormData(); fd.append('file', file);
  try {
    showToast('Restoring backup...', '');
    const res = await fetch('/api/import-json', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.error) { showToast(data.error, 'error'); return; }
    state.trades = data.trades;
    state.columns = data.columns;
    state.allTags = data.allTags || state.allTags || [];
    state.tagColumns = Array.isArray(data.tagColumns) ? data.tagColumns : state.tagColumns;
    state.userColumns = Array.isArray(data.userColumns) ? data.userColumns : [];
    ensurePermanentColumns();
    syncTagColumnRegistry();
    syncImageTagColumnValues();
    state.userColumns = state.userColumns.filter(c => state.columns.includes(c));
    normalizeStructuredDateColumns();
    migrateLegacyTagsData();
    initShowHeads(); initTableShowCols();
    render();
    showToast('Backup restored!', 'success');
  } catch (e) { showToast('Restore failed', 'error'); }
}

function backupJson() {
  const name = prompt('Backup name (optional):');
  let url = '/api/backup';
  if (name && String(name).trim()) {
    url += `?name=${encodeURIComponent(String(name).trim())}`;
  }
  window.location.href = url;
}

async function exportExcel() {
  if (!state.trades.length) { showToast('No data to export', 'error'); return; }
  try {
    showToast('Preparing export...', '');
    const res = await fetch('/api/export-excel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trades: state.trades, columns: state.columns })
    });
    if (!res.ok) { showToast('Export failed', 'error'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `trading_journal_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click(); URL.revokeObjectURL(url);
    showToast('Excel exported!', 'success');
  } catch (e) { showToast('Export failed', 'error'); }
}

async function exportStructuredCsv() {
  if (!state.trades.length) { showToast('No data to export', 'error'); return; }
  try {
    normalizeStructuredDateColumns();
    showToast('Preparing structured CSV...', '');
    const res = await fetch('/api/export-structured-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trades: state.trades, columns: state.columns })
    });
    if (!res.ok) { showToast('Structured export failed', 'error'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'structured_trades.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Structured CSV exported!', 'success');
  } catch (e) {
    showToast('Structured export failed', 'error');
  }
}

let toastTimer = null;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast'); t.textContent = msg; t.className = `toast ${type} show`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = 'toast'; }, 3000);
}

function setupDropdown(btnId, menuId) {
  const btn = document.getElementById(btnId);
  const menu = document.getElementById(menuId);
  if (!btn || !menu) return;
  btn.addEventListener('click', e => { e.stopPropagation(); closeAllDropdowns(menuId); menu.classList.toggle('open'); });
}

function closeAllDropdowns(except) {
  document.querySelectorAll('.dropdown-menu.open').forEach(m => { if (m.id !== except) m.classList.remove('open'); });
}


```
