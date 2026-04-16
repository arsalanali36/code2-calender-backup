# JS - Core State + Data
Consolidated code context for AI assistants.


## File: `static/js/state.js`
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
    tagFilter: [], filterMode: 'or', tagViewMode: 'grouped',
    filterTagScope: 'image', tagAssignMode: 'image',
    hiddenImages: new Set(), layerPanelOpen: false,
    expandedFilterTrades: new Set(),
    managerTags: [],
    managerSortDir: 'desc',
    imgTypeFilter: 'both',  // 'both' | 'index' | 'premium'
    activePdfs: []          // [{id, name, url}]
  },
  imgTypes: {},  // { [imgUrl]: 'index' | 'premium' } — persisted with trades  // V2: tagFilter = selected tag names
  tagGroups: {},  // { groupName: [tagName, ...] } — user-defined groups
  tagDeleteMode: false,
  uploadRow: null,
  pendingFiles: [],
  tagImages: {},   // { tagName: imageURL } — for image-based tags
  tagNotes: {},    // { tagName: noteText } — user notes per tag
  tagTemplates: {}, // { templateName: [tags...] } — saved filter presets
  quotes: [],
  quoteIndex: 0,
  quoteRatings: {},
  quoteAutoPopup: { enabled: true, minMinutes: 15, timerId: null },
  obsDate: '',
  allTags: [],   // all defined tag names
  tagFilter: [],   // selected filters in form "Column::Tag"
  calendarTagFocus: '', // selected calendar tag bubble in form "Column::Tag"
  tagColumns: [],   // explicit list of tag columns (rename-safe)
  userColumns: [],   // only these columns are deletable
  addTagColumnMode: false,
  brokerFilter: 'zerodha', // both | zerodha | dhan
  calendarView: 'month', // month | year
  shortcuts: {},
  dayData: {},   // keyed by YYYY-MM-DD: { images: [], tags: { ColName: [tag,...] } }
  importedPdfs: [], // List of imported PDF records: { name, date, images: [], timestamp }
  _localOverlays: {}, // temporary per-image overlay cache until upload completes
  uiSettings: {},    // dashboard layout prefs (visibility, order, widths, modes) — synced to server
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
  groupSepColor: '#58a6ff',
  showCalTags: false
};

const DEFAULT_SHORTCUTS = {
  pen: 'B',
  imageImport: 'I',
  eraser: 'E',
  datePicker: 'D',
  mergeSave: 'Ctrl+Shift+S',
  overlaySave: 'Ctrl+S',
  selectTool: 'V',
  textTool: 'Alt+T',
  marquee: 'M',
  annotToggle: 'A',
  resetZoom: 'Alt+R',
  showHeads: 'H',
  layerPanel: 'L',
  leftPanel: 'F',
  fullscreen: 'Shift+F',
  deleteImage: 'Delete',
  imageTagManager: 'Alt+Shift+T'
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
const IS_TOUCH_DEVICE = ('ontouchstart' in window) || 
                       (navigator.maxTouchPoints > 0) || 
                       (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

if (IS_TOUCH_DEVICE) {
  document.documentElement.classList.add('is-touch');
  // Also add to body when it exists
  window.addEventListener('DOMContentLoaded', () => document.body.classList.add('is-touch'));
}

function getSectionOrder() {
  const preferred = ['calendar', 'dashboard', 'table', 'visual-dashboard'];
  try {
    const o = JSON.parse(localStorage.getItem('sectionOrder'));
    if (Array.isArray(o) && o.length === 4) {
      // Migrate old default order to new expected order.
      if (JSON.stringify(o) === JSON.stringify(['calendar', 'dashboard', 'visual-dashboard', 'table'])) {
        return preferred;
      }
      return o;
    }
  } catch (e) { }
  return preferred;
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

/**
 * Resolves an image path to a full URL.
 * Handles both local filenames (needs /uploads/) and Cloudinary/external links (http/https).
 * @param {string} url
 * @returns {string}
 */
function resolveImageUrl(url) {
  if (!url) return '';
  let s = '';
  if (typeof url === 'object') {
    // Check common properties for image objects
    s = url.url || url.path || url.secure_url || String(url);
  } else {
    s = String(url);
  }
  s = (s || '').trim();
  if (!s || s === '[object Object]') return '';

  // Return as-is if it's a full URL, protocol-relative, or a base64/blob
  if (s.startsWith('http') || s.startsWith('//') || s.startsWith('blob:') || s.startsWith('data:')) {
    return s;
  }

  // If it already has the correct root-relative prefix, return it
  if (s.startsWith('/uploads/')) return s;

  // Otherwise, ensure it starts with /uploads/ and remove any duplicate "uploads/" segment
  const clean = s.replace(/^(\/)?uploads\//i, '');
  return '/uploads/' + clean;
}

```

## File: `static/js/data.js`
```js
/**
 * @fileoverview data.js
 * @description Bootstraps app, loads/saves trades to server, CSV/JSON normalization, sync.
 * @exports init, loadTrades, saveTrades, syncFromServerIfChanged, normalizeStructuredTradeRow,
 *          computeTradeCharges, mergeStructuredTrades, ensurePermanentColumns,
 *          syncTagColumnRegistry, isProtectedSystemColumn, canDeleteColumn,
 *          splitDateTime, pickTradeField, formatDate, normalizeDate, syncImageTagColumnValues
 * @reads state.trades, state.columns, state.dayData
 * @writes state.trades, state.columns, state.dayData, state.tagGroups
 * @calls render, fetch /api/trades (GET + POST)
 */

// ── BroadcastChannel tab sync ─────────────────────────────────────────────────
// Lets a new tab receive state from an already-loaded tab instantly,
// skipping the server fetch when opened via a deep link (e.g. PDF View Source).
const _TJ_CHANNEL = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('tj_tab_sync') : null;

if (_TJ_CHANNEL) {
  _TJ_CHANNEL.addEventListener('message', ev => {
    if (ev.data?.type === 'REQUEST_DATA' && state.trades?.length) {
      _TJ_CHANNEL.postMessage({
        type: 'DATA_RESPONSE',
        trades:      state.trades,
        columns:     state.columns,
        allTags:     state.allTags,
        tagColumns:  state.tagColumns,
        userColumns: state.userColumns,
        dayData:     state.dayData,
        tagGroups:   state.tagGroups,
        pdfPageTags: state.pdfPageTags,
        uiSettings:  state.uiSettings,
      });
    }
  });
}

function _tryGetDataFromBroadcast() {
  return new Promise(resolve => {
    if (!_TJ_CHANNEL) { resolve(null); return; }
    let done = false;
    function handler(ev) {
      if (ev.data?.type === 'DATA_RESPONSE' && !done) {
        done = true;
        _TJ_CHANNEL.removeEventListener('message', handler);
        resolve(ev.data);
      }
    }
    _TJ_CHANNEL.addEventListener('message', handler);
    _TJ_CHANNEL.postMessage({ type: 'REQUEST_DATA' });
    setTimeout(() => {
      if (!done) {
        done = true;
        _TJ_CHANNEL.removeEventListener('message', handler);
        resolve(null);
      }
    }, 350);
  });
}

function _applyBroadcastData(data) {
  state.trades      = data.trades      || [];
  state.columns     = data.columns     || [];
  state.allTags     = data.allTags     || [];
  IMAGE_PERMANENT_TAGS.forEach(t => { if (!state.allTags.includes(t)) state.allTags.push(t); });
  state.tagColumns  = Array.isArray(data.tagColumns)  ? data.tagColumns  : [];
  state.userColumns = Array.isArray(data.userColumns) ? data.userColumns : [];
  state.dayData     = (data.dayData && typeof data.dayData === 'object') ? data.dayData : {};
  state.importedPdfs = Array.isArray(data.importedPdfs) ? data.importedPdfs : [];
  state.tagGroups   = (data.tagGroups && typeof data.tagGroups === 'object') ? data.tagGroups : (state.tagGroups || {});
  state.tagTemplates = (data.tagTemplates && typeof data.tagTemplates === 'object') ? data.tagTemplates : (state.tagTemplates || {});
  state.pdfPageTags  = (data.pdfPageTags && typeof data.pdfPageTags === 'object') ? data.pdfPageTags : {};
  state.imgTypes    = (data.imgTypes && typeof data.imgTypes === 'object') ? data.imgTypes : {};
  state.uiSettings  = (data.uiSettings && typeof data.uiSettings === 'object') ? data.uiSettings : {};
  syncTagColumnRegistry();
  state.userColumns = state.userColumns.filter(c => state.columns.includes(c));
  syncImageTagColumnValues();
  saveTagGroups();
  syncAllTradeDates();
  state.serverStateHash = hashServerState(data);
  initShowHeads();
  initTableShowCols();
  if (typeof applyVdChartModes === 'function') applyVdChartModes();
  render();
  _dismissLoadingOverlay();
}

function _dismissLoadingOverlay() {
  const el = document.getElementById('app-loading-overlay');
  if (!el) return;
  el.classList.add('alo-hidden');
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 350);
}
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  loadSettingsFromStorage();
  loadShortcutsFromStorage();
  loadColWidths();
  loadTagGroups();
  applySectionOrder();
  bindSectionOrderDrag();
  populateSelects();
  renderDashboardStatsMenu();
  if (typeof initTradeSidebar === 'function') initTradeSidebar();
  bindEvents();

  // Deep-link tab (opened from PDF/external link): try sibling tab first
  const hasDeepLink = new URLSearchParams(window.location.search).has('galleryDate');
  let loadedFromBroadcast = false;
  if (hasDeepLink) {
    const cached = await _tryGetDataFromBroadcast();
    if (cached) { _applyBroadcastData(cached); loadedFromBroadcast = true; }
  }
  if (!loadedFromBroadcast) await loadTrades();

  _openGalleryFromUrlParamsOnce();
  setInterval(() => {
    if (!document.hidden) syncFromServerIfChanged(false);
  }, state.syncIntervalMs);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncFromServerIfChanged(true);
  });
  window.addEventListener('focus', () => syncFromServerIfChanged(true));
}

function _openGalleryFromUrlParamsOnce() {
  try {
    const q = new URLSearchParams(window.location.search);
    const dateKey = normalizeDate(q.get('galleryDate') || '');
    const imgUrl = q.get('galleryImg') || '';
    if (!dateKey) return;
    if (typeof openGalleryForDate !== 'function') return;

    const layout = q.get('galleryLayout') || 'new';
    if (typeof _applyGalleryLayout === 'function') _applyGalleryLayout(layout);
    openGalleryForDate(dateKey, imgUrl);

    // Keep URL clean so refresh doesn't keep reopening from stale params.
    q.delete('galleryDate');
    q.delete('galleryImg');
    q.delete('galleryLayout');
    const clean = `${window.location.pathname}${q.toString() ? `?${q.toString()}` : ''}${window.location.hash || ''}`;
    window.history.replaceState({}, '', clean);
  } catch (e) { }
}

function populateSelects() {
  const ms = document.getElementById('glob-month');
  const ys = document.getElementById('glob-year');
  const vs = document.getElementById('glob-view');

  if (ms) {
    MONTHS.forEach((m, i) => {
      const o = document.createElement('option');
      o.value = i; o.textContent = m.slice(0, 3); if (i === state.month) o.selected = true;
      ms.appendChild(o);
    });
  }

  if (ys) {
    const cy = new Date().getFullYear();
    for (let y = cy - 5; y <= cy + 2; y++) {
      const o = document.createElement('option');
      o.value = y; o.textContent = y; if (y === state.year) o.selected = true;
      ys.appendChild(o);
    }
  }
  if (vs) vs.value = state.calendarView;
}

async function loadTrades() {
  try {
    // Use data embedded in HTML (no round-trip) — falls back to API if missing
    let data;
    if (window.__INITIAL_DATA__ && Object.keys(window.__INITIAL_DATA__).length) {
      data = window.__INITIAL_DATA__;
      window.__INITIAL_DATA__ = null; // free memory
    } else {
      data = await tradeService.loadTrades();
    }
    state.trades = data.trades || [];
    state.columns = data.columns || [];
    state.allTags = data.allTags || [];
    IMAGE_PERMANENT_TAGS.forEach(t => { if (!state.allTags.includes(t)) state.allTags.push(t); });
    state.tagColumns = Array.isArray(data.tagColumns) ? data.tagColumns : [];
    state.userColumns = Array.isArray(data.userColumns) ? data.userColumns : [];
    state.dayData = (data.dayData && typeof data.dayData === 'object') ? data.dayData : {};
    state.importedPdfs = Array.isArray(data.importedPdfs) ? data.importedPdfs : [];
    state.tagGroups = (data.tagGroups && typeof data.tagGroups === 'object') ? data.tagGroups : (state.tagGroups || {});
    state.pdfPageTags = (data.pdfPageTags && typeof data.pdfPageTags === 'object') ? data.pdfPageTags : {};
    state.tagTemplates = (data.tagTemplates && typeof data.tagTemplates === 'object') ? data.tagTemplates : (state.tagTemplates || {});
    state.imgTypes  = (data.imgTypes && typeof data.imgTypes === 'object') ? data.imgTypes : {};
    state.uiSettings = (data.uiSettings && typeof data.uiSettings === 'object') ? data.uiSettings : {};
    const ensuredChanged = ensurePermanentColumns();
    normalizeStructuredDateColumns();
    syncTagColumnRegistry();
    state.userColumns = state.userColumns.filter(c => state.columns.includes(c));
    const migrated = migrateLegacyTagsData();
    syncImageTagColumnValues();
    if (ensuredChanged || migrated) saveTrades();
    saveTagGroups();
    syncAllTradeDates();
    state.serverStateHash = hashServerState(data);
    initShowHeads();
    initTableShowCols();
    if (typeof applyVdChartModes === 'function') applyVdChartModes();
    // Render errors (e.g. table/calendar JS bug) should not mask a successful data load
    try { render(); } catch (re) { console.error('[render] error after loadTrades:', re); }
    _dismissLoadingOverlay();
  } catch (e) {
    console.error('[loadTrades] error:', e);
    _dismissLoadingOverlay();
    showToast('Failed to load data', 'error');
  }
}

function syncImageTagColumnValues() {
  state.trades.forEach(t => {
    t[IMAGE_TAG_COLUMN] = getMergedImageTagsForTradeRow(t).join(', ');
  });
}

function setPdfPageTags(pdfId, pageNo, tags) {
  if (!pdfId || !pageNo) return;
  if (!state.pdfPageTags) state.pdfPageTags = {};
  if (!state.pdfPageTags[pdfId]) state.pdfPageTags[pdfId] = {};
  if (tags && tags.length > 0) {
    state.pdfPageTags[pdfId][pageNo] = tags;
  } else {
    delete state.pdfPageTags[pdfId][pageNo];
  }
}

let _saveTradesQueue = Promise.resolve();
async function saveTrades() {
  const previous = _saveTradesQueue;
  _saveTradesQueue = (async () => {
    try { await previous; } catch (e) {}
    try {
      const payload = {
        trades: state.trades,
        columns: state.columns,
        allTags: state.allTags,
        tagColumns: state.tagColumns,
        userColumns: state.userColumns,
        dayData: state.dayData,
        importedPdfs: state.importedPdfs,
        tagGroups: state.tagGroups,
        tagTemplates: state.tagTemplates,
        pdfPageTags: state.pdfPageTags,
        imgTypes: state.imgTypes,
        uiSettings: state.uiSettings || {}
      };
      await tradeService.saveTrades(payload);
      state.serverStateHash = hashServerState(payload);
    } catch (e) { showToast('Save failed', 'error'); }
  })();
  await _saveTradesQueue;
}

function hashServerState(data) {
  try {
    return JSON.stringify({
      trades: data?.trades || [],
      columns: data?.columns || [],
      allTags: data?.allTags || [],
      tagColumns: data?.tagColumns || [],
      userColumns: data?.userColumns || [],
      dayData: data?.dayData || {},
      importedPdfs: data?.importedPdfs || [],
      tagGroups: data?.tagGroups || {},
      tagTemplates: data?.tagTemplates || {},
      pdfPageTags: data?.pdfPageTags || {},
      uiSettings: data?.uiSettings || {}
    });
  } catch (e) {
    return '';
  }
}

function isUiBusyForSync() {
  if (window.__csvlogPersisting) return true;
  const ae = document.activeElement;
  const typing = !!(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable));
  if (typing) return true;
  if (annotState.active) return true;
  if (document.getElementById('obs-modal')?.classList.contains('open')) return true;
  if (document.getElementById('upload-modal')?.classList.contains('open')) return true;
  if (document.getElementById('quote-modal')?.classList.contains('open')) return true;
  if (document.querySelector('.clc-backdrop')) return true;
  if (document.getElementById('tag-modal')?.classList.contains('open')) return true;
  if (document.getElementById('img-tag-modal')?.classList.contains('open')) return true;
  if (document.getElementById('gallery-modal')?.classList.contains('open')) return true;
  return false;
}

async function syncFromServerIfChanged(force = false) {
  if (!force && isUiBusyForSync()) return;
  try {
    const data = await tradeService.loadTrades();
    const incomingHash = hashServerState(data);
    if (!incomingHash || incomingHash === state.serverStateHash) return;

    state.trades = data.trades || [];
    state.columns = data.columns || [];
    state.allTags = data.allTags || [];
    IMAGE_PERMANENT_TAGS.forEach(t => { if (!state.allTags.includes(t)) state.allTags.push(t); });
    state.tagColumns = Array.isArray(data.tagColumns) ? data.tagColumns : [];
    state.userColumns = Array.isArray(data.userColumns) ? data.userColumns : [];
    state.importedPdfs = Array.isArray(data.importedPdfs) ? data.importedPdfs : [];
    state.tagGroups = (data.tagGroups && typeof data.tagGroups === 'object') ? data.tagGroups : (state.tagGroups || {});
    state.tagTemplates = (data.tagTemplates && typeof data.tagTemplates === 'object') ? data.tagTemplates : (state.tagTemplates || {});
    ensurePermanentColumns();
    normalizeStructuredDateColumns();
    syncTagColumnRegistry();
    syncImageTagColumnValues();
    state.userColumns = state.userColumns.filter(c => state.columns.includes(c));
    migrateLegacyTagsData();
    saveTagGroups();
    syncAllTradeDates();
    initShowHeads();
    initTableShowCols();
    state.serverStateHash = incomingHash;
    render();
  } catch (e) { }
}

// syncTagColumnRegistry and all utility/normalization functions are in data-utils.js


```

## File: `static/js/data-utils.js`
```js
/**
 * @fileoverview data-utils.js
 * @description Pure utility/helper functions split from data.js:
 *   trade normalization, column helpers, tag utilities, image-tag helpers.
 * @reads state.trades, state.columns, state.tagColumns, state.dayData, state.allTags
 * @writes state.trades, state.columns, state.tagColumns, state.allTags
 */

function syncTagColumnRegistry() {
  const set = new Set(
    (state.tagColumns || [])
      .map(c => String(c))
      .filter(c => state.columns.includes(c))
  );
  state.columns.forEach(c => {
    if (/^tags(\d+)?$/i.test(String(c))) set.add(String(c));
    if (state.trades.some(t => Array.isArray(t[c]))) set.add(String(c));
  });
  state.tagColumns = state.columns.filter(c => set.has(c));
}

function isProtectedSystemColumn(colName) {
  const c = String(colName || '').trim().toLowerCase();
  const protectedSet = new Set([
    'instrument', 'tradetype', 'date', 'qty',
    'sell time', 'sell price', 'buy time', 'buy price', 'pt', 'rs',
    'image tags', 'broker',
    'brokerage', 'other charges', 'gross p/l', 'net p/l'
  ]);
  return protectedSet.has(c);
}

function canDeleteColumn(colName) {
  if (!state.columns.includes(colName)) return false;
  if (state.userColumns.includes(colName)) return true;
  return !isProtectedSystemColumn(colName);
}

function splitDateTime(value) {
  const s = String(value || '').trim();
  if (!s) return { date: '', time: '' };
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
  if (m) return { date: m[1], time: m[2] };
  const d = Date.parse(s);
  if (!isNaN(d)) {
    const dt = new Date(d);
    const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const time = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}:${String(dt.getSeconds()).padStart(2, '0')}`;
    return { date, time };
  }
  return { date: '', time: s };
}

function pickTradeField(trade, keys) {
  for (const k of keys) {
    if (trade && trade[k] !== undefined && trade[k] !== null && String(trade[k]).trim() !== '') return trade[k];
  }
  return '';
}

function normalizeStructuredTradeRow(trade) {
  const out = {
    'Instrument': pickTradeField(trade, ['Instrument', 'instrument', 'symbol']),
    [BROKER_COLUMN]: String(pickTradeField(trade, [BROKER_COLUMN, 'broker', 'Source'])).toLowerCase(),
    'TradeType': String(pickTradeField(trade, ['TradeType', 'trade_type', 'Type'])).toLowerCase(),
    'Qty': pickTradeField(trade, ['Qty', 'quantity', 'Qty.']),
    'Sell Time': pickTradeField(trade, ['Sell Time']),
    'Sell Price (Avg)': pickTradeField(trade, ['Sell Price (Avg)', 'Sell Price']),
    'Buy Time': pickTradeField(trade, ['Buy Time']),
    'Buy Price (Avg)': pickTradeField(trade, ['Buy Price (Avg)', 'Buy Price']),
    'Pt': pickTradeField(trade, ['Pt']),
    'Rs': pickTradeField(trade, ['Rs']),
    'trade_date': pickTradeField(trade, ['trade_date', 'Date', 'date'])
  };
  out.date = normalizeDate(out.trade_date || pickTradeField(trade, ['date']));
  out.images = Array.isArray(trade?.images) ? [...trade.images] : [];
  out.observation = typeof trade?.observation === 'string' ? trade.observation : '';
  out.imageTags = (trade && typeof trade.imageTags === 'object' && !Array.isArray(trade.imageTags)) ? { ...trade.imageTags } : {};
  getTagColumns().forEach(col => { out[col] = Array.isArray(trade?.[col]) ? [...trade[col]] : []; });
  if (trade && trade['fill_count']) out['fill_count'] = parseInt(trade['fill_count']) || 0;
  computeTradeCharges(out);
  return out;
}

function computeTradeCharges(trade) {
  const buy = parseFloat(trade['Buy Price (Avg)'] ?? trade['Buy Price'] ?? '');
  const sell = parseFloat(trade['Sell Price (Avg)'] ?? trade['Sell Price'] ?? '');
  const qty = parseFloat(trade['Qty'] ?? '');
  const broker = String(trade['Broker'] ?? '').toLowerCase().trim();
  if (isNaN(buy) || isNaN(sell) || isNaN(qty) || qty === 0) return;

  const buyTurn = buy * qty;
  const sellTurn = sell * qty;
  const total = buyTurn + sellTurn;

  const stt = sellTurn * 0.001;
  const exch = total * 0.0003503;
  const sebi = total * 0.000001;
  const stamp = buyTurn * 0.00003;

  const fillCount = Math.max(parseInt(trade['fill_count']) || 0, 2);

  let brokerage, gst, otherCharges;

  if (broker === 'dhan') {
    brokerage = fillCount * 20;
    const ipft = total * 0.000001;
    gst = (brokerage + exch + sebi + ipft) * 0.18;
    otherCharges = stt + exch + sebi + ipft + stamp + gst;
  } else {
    brokerage = fillCount * 20;
    gst = (brokerage + exch + sebi) * 0.18;
    otherCharges = stt + exch + sebi + stamp + gst;
  }

  const grossPL = (sell - buy) * qty;
  const netPL = grossPL - (brokerage + otherCharges);

  trade['Brokerage'] = Math.round(brokerage * 100) / 100;
  trade['Other Charges'] = Math.round(otherCharges * 100) / 100;
  trade['Gross P/L'] = Math.round(grossPL * 100) / 100;
  trade['Net P/L'] = Math.round(netPL * 100) / 100;
  trade[TOTAL_FEES_COLUMN] = Math.round((brokerage + otherCharges) * 100) / 100;
}

function normalizeNumForKey(v) {
  const n = parseFloat(v);
  if (isNaN(n)) return String(v ?? '').trim();
  return Number(n.toFixed(6)).toString();
}

function structuredTradeDedupKey(trade) {
  const t = normalizeStructuredTradeRow(trade);
  return [
    String(t['Instrument']).trim(),
    String(t[BROKER_COLUMN]).trim().toLowerCase(),
    String(t['TradeType']).trim().toLowerCase(),
    normalizeNumForKey(t['Qty']),
    String(t['trade_date']).trim(),
    String(t['Sell Time']).trim(),
    normalizeNumForKey(t['Sell Price (Avg)']),
    String(t['Buy Time']).trim(),
    normalizeNumForKey(t['Buy Price (Avg)'])
  ].join('|');
}

function mergeStructuredTrades(existingTrades, importedTrades) {
  const existing = Array.isArray(existingTrades) ? [...existingTrades] : [];
  const imported = Array.isArray(importedTrades) ? importedTrades : [];
  const keyMap = new Map(existing.map((t, i) => [structuredTradeDedupKey(t), i]));
  let added = 0;
  imported.forEach(row => {
    const normalized = normalizeStructuredTradeRow(row);
    const key = structuredTradeDedupKey(normalized);
    if (!keyMap.has(key)) {
      existing.push(normalized);
      keyMap.set(key, existing.length - 1);
      added += 1;
    } else {
      const idx = keyMap.get(key);
      if (normalized['fill_count']) {
        existing[idx]['fill_count'] = normalized['fill_count'];
        computeTradeCharges(existing[idx]);
      }
    }
  });
  return { merged: existing, added };
}

function ensurePermanentColumns() {
  let changed = false;
  if (state.columns.includes('Thumbnail')) {
    state.columns = state.columns.filter(c => c !== 'Thumbnail');
    changed = true;
  }
  delete state.showHeadsConsolidated.Thumbnail; delete state.showHeadsIndividual.Thumbnail;
  delete state.tableShowCols.Thumbnail;
  delete state.filterValues.Thumbnail;
  delete state.colWidths.Thumbnail;
  if (state.tableSort.col === 'Thumbnail') state.tableSort.col = null;
  if (state.columns.includes('Observation')) {
    state.columns = state.columns.filter(c => c !== 'Observation');
    changed = true;
  }
  delete state.showHeadsConsolidated.Observation; delete state.showHeadsIndividual.Observation;
  delete state.tableShowCols.Observation;
  delete state.filterValues.Observation;
  delete state.colWidths.Observation;
  if (state.tableSort.col === 'Observation') state.tableSort.col = null;
  PERMANENT_COLUMNS.forEach(col => {
    if (!state.columns.includes(col)) { state.columns.push(col); changed = true; }
  });
  COMPUTED_COLUMNS.forEach(col => {
    if (!state.columns.includes(col)) { state.columns.push(col); changed = true; }
  });
  state.trades.forEach(t => { computeTradeCharges(t); });
  state.userColumns = (state.userColumns || []).filter(c => !PERMANENT_COLUMNS.includes(c));
  state.trades.forEach(t => {
    if (typeof t.observation !== 'string' && typeof t['Observation'] === 'string') {
      t.observation = t['Observation'];
      changed = true;
    }
    if ('Observation' in t) { delete t['Observation']; changed = true; }
    PERMANENT_COLUMNS.forEach(col => {
      if (!(col in t)) { t[col] = ''; changed = true; }
    });
    if (!t[BROKER_COLUMN]) t[BROKER_COLUMN] = 'zerodha';
    if (!t.imageTags || typeof t.imageTags !== 'object' || Array.isArray(t.imageTags)) {
      t.imageTags = {};
      changed = true;
    }
  });

  const tdIdx = state.columns.indexOf('trade_date') !== -1 ? state.columns.indexOf('trade_date') : 0;
  const ttIdx = state.columns.indexOf(TOTAL_TRADES_COLUMN);
  if (ttIdx > -1 && ttIdx > tdIdx + 1) {
    state.columns.splice(ttIdx, 1);
    state.columns.splice(tdIdx + 1, 0, TOTAL_TRADES_COLUMN);
    changed = true;
  }

  return changed;
}

function normalizeStructuredDateColumns() {
  const hasSellTime = state.columns.includes('Sell Time');
  const hasBuyTime = state.columns.includes('Buy Time');
  if (!hasSellTime && !hasBuyTime) return;

  let changed = false;

  if (!state.columns.includes('trade_date')) {
    const rsIdx = state.columns.indexOf('Rs');
    if (rsIdx >= 0) state.columns.splice(rsIdx + 1, 0, 'trade_date');
    else state.columns.push('trade_date');
    changed = true;
  }

  ['Date', 'date'].forEach(col => {
    const idx = state.columns.indexOf(col);
    if (idx >= 0) {
      state.columns.splice(idx, 1);
      changed = true;
    }
    delete state.showHeadsConsolidated[col]; delete state.showHeadsIndividual[col];
    delete state.tableShowCols[col];
    delete state.filterValues[col];
    delete state.colWidths[col];
    if (state.tableSort.col === col) state.tableSort.col = null;
  });

  state.trades.forEach(t => {
    const sell = splitDateTime(t['Sell Time']);
    const buy = splitDateTime(t['Buy Time']);
    const derivedDate = normalizeDate(t['trade_date'] || t['Date'] || t.date || sell.date || buy.date);

    if (derivedDate && t['trade_date'] !== derivedDate) { t['trade_date'] = derivedDate; changed = true; }
    if (derivedDate && t.date !== derivedDate) { t.date = derivedDate; changed = true; }
    if ('Date' in t) { delete t['Date']; changed = true; }

    if (sell.time && sell.time !== t['Sell Time']) { t['Sell Time'] = sell.time; changed = true; }
    if (buy.time && buy.time !== t['Buy Time']) { t['Buy Time'] = buy.time; changed = true; }
  });

  if (changed) saveTrades();
}

function isTagColumn(col) {
  const name = String(col || '').trim();
  return state.tagColumns.includes(name) || /^tags(\d+)?$/i.test(name);
}

function getTagColumns() {
  syncTagColumnRegistry();
  return state.columns.filter(c => state.tagColumns.includes(c));
}

function getNextTagColumnName() {
  const existing = new Set(state.columns.map(c => String(c).toLowerCase()));
  if (!existing.has('tags')) return 'Tags';
  let i = 2;
  while (existing.has(`tags${i}`)) i += 1;
  return `Tags${i}`;
}

function getTradeTagsForColumn(trade, colName) {
  if (!trade) return [];
  const v = trade[colName];
  if (Array.isArray(v)) return v;
  if (colName === 'Tags' && Array.isArray(trade.tags)) return trade.tags;
  return [];
}

function makeTagFilterKey(colName, tag) {
  return `${colName}::${tag}`;
}

function parseTagFilterKey(key) {
  const s = String(key || '');
  const idx = s.indexOf('::');
  if (idx === -1) return { col: '', tag: s };
  return { col: s.slice(0, idx), tag: s.slice(idx + 2) };
}

function getUniqueTagsForColumn(colName) {
  const set = new Set();
  state.trades.forEach(t => getTradeTagsForColumn(t, colName).forEach(tag => set.add(String(tag))));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function getAllColumnTagKeys() {
  const keys = [];
  getTagColumns().forEach(col => {
    getUniqueTagsForColumn(col).forEach(tag => keys.push(makeTagFilterKey(col, tag)));
  });
  return keys;
}

function tradeMatchesTagFilter(trade) {
  if (!state.tagFilter.length) return true;
  return state.tagFilter.some(k => {
    const parsed = parseTagFilterKey(k);
    if (!parsed.col) {
      return getAllTradeTags(trade).includes(parsed.tag);
    }
    return getTradeTagsForColumn(trade, parsed.col).includes(parsed.tag);
  });
}

function ensureTagArray(trade, colName) {
  if (!trade) return [];
  if (!Array.isArray(trade[colName])) trade[colName] = [];
  return trade[colName];
}

function getAllTradeTags(trade) {
  const out = [];
  getTagColumns().forEach(c => out.push(...getTradeTagsForColumn(trade, c)));
  if (Array.isArray(trade.tags)) out.push(...trade.tags);
  return Array.from(new Set(out));
}

function ensureImageTagStore(trade) {
  if (!trade) return {};
  if (!trade.imageTags || typeof trade.imageTags !== 'object' || Array.isArray(trade.imageTags)) {
    trade.imageTags = {};
  }
  return trade.imageTags;
}

function getImageTagsForUrl(trade, imageUrl) {
  if (!trade || !imageUrl) return [];
  const store = ensureImageTagStore(trade);
  const v = store[imageUrl];
  return Array.isArray(v) ? Array.from(new Set(v.map(x => String(x).trim()).filter(Boolean))) : [];
}

function setImageTagsForUrl(trade, imageUrl, tags) {
  if (!trade || !imageUrl) return;
  const store = ensureImageTagStore(trade);
  const clean = Array.from(new Set((tags || []).map(x => String(x).trim()).filter(Boolean)));
  if (clean.length) store[imageUrl] = clean;
  else delete store[imageUrl];
  trade[IMAGE_TAG_COLUMN] = getAllImageTagsForTrade(trade).join(', ');
}

function cleanupImageTagStore(trade) {
  if (!trade || !trade.imageTags || typeof trade.imageTags !== 'object') return;
  const allowed = new Set(Array.isArray(trade.images) ? trade.images : []);
  Object.keys(trade.imageTags).forEach(url => {
    if (!allowed.has(url)) delete trade.imageTags[url];
  });
  trade[IMAGE_TAG_COLUMN] = getAllImageTagsForTrade(trade).join(', ');
}

function getAllImageTagsForTrade(trade) {
  if (!trade) return [];
  const tags = new Set();
  const imgs = Array.isArray(trade.images) ? trade.images : [];
  imgs.forEach(url => getImageTagsForUrl(trade, url).forEach(t => tags.add(t)));
  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}

function ensureDayImageTagStore(dateKey) {
  if (!dateKey) return {};
  if (!state.dayData[dateKey]) state.dayData[dateKey] = {};
  if (!state.dayData[dateKey].imageTags || typeof state.dayData[dateKey].imageTags !== 'object' || Array.isArray(state.dayData[dateKey].imageTags)) {
    state.dayData[dateKey].imageTags = {};
  }
  return state.dayData[dateKey].imageTags;
}

function getDayImageTagsForUrl(dateKey, imageUrl) {
  if (!dateKey || !imageUrl) return [];
  const store = ensureDayImageTagStore(dateKey);
  const v = store[imageUrl];
  return Array.isArray(v) ? Array.from(new Set(v.map(x => String(x).trim()).filter(Boolean))) : [];
}

function setDayImageTagsForUrl(dateKey, imageUrl, tags) {
  if (!dateKey || !imageUrl) return;
  const store = ensureDayImageTagStore(dateKey);
  const clean = Array.from(new Set((tags || []).map(x => String(x).trim()).filter(Boolean)));
  if (clean.length) store[imageUrl] = clean;
  else delete store[imageUrl];
}

function getAllImageTagsForDay(dateKey) {
  if (!dateKey || !state.dayData[dateKey]) return [];
  const tags = new Set();
  const imgs = Array.isArray(state.dayData[dateKey].images) ? state.dayData[dateKey].images : [];
  imgs.forEach(url => getDayImageTagsForUrl(dateKey, url).forEach(t => tags.add(t)));
  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}

function getMergedImageTagsForDate(dateKey) {
  const dk = normalizeDate(dateKey || '');
  if (!dk) return [];
  const tags = new Set();
  getAllImageTagsForDay(dk).forEach(t => tags.add(t));
  getTradesForDate(dk).forEach(t => getAllImageTagsForTrade(t).forEach(tag => tags.add(tag)));
  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}

function getMergedImageTagsForTradeRow(trade) {
  if (!trade) return [];
  const dk = normalizeDate(extractDateFromTrade(trade));
  const tags = new Set(getAllImageTagsForTrade(trade));
  getAllImageTagsForDay(dk).forEach(t => tags.add(t));
  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}

function normalizeAllTagsFromTrades() {
  const set = new Set((state.allTags || []).map(t => String(t)));
  IMAGE_PERMANENT_TAGS.forEach(t => set.add(t));
  state.trades.forEach(t => {
    getAllTradeTags(t).forEach(tag => set.add(String(tag)));
    getAllImageTagsForTrade(t).forEach(tag => set.add(String(tag)));
  });
  Object.keys(state.dayData || {}).forEach(d => {
    getAllImageTagsForDay(d).forEach(tag => set.add(String(tag)));
  });
  if (state.pdfPageTags) {
    Object.values(state.pdfPageTags).forEach(pdfObj => {
      Object.values(pdfObj).forEach(val => {
        if (Array.isArray(val)) val.forEach(tag => set.add(String(tag)));
      });
    });
  }
  state.allTags = Array.from(set);
}

function migrateLegacyTagsData() {
  let changed = false;
  const hasLegacy = state.trades.some(t => Array.isArray(t.tags) && t.tags.length > 0);
  if (hasLegacy && !state.columns.includes('Tags')) {
    state.columns.push('Tags');
    changed = true;
  }
  if (state.columns.includes('Tags') && !state.tagColumns.includes('Tags')) {
    state.tagColumns.push('Tags');
    changed = true;
  }
  if (state.columns.includes('Tags')) {
    state.trades.forEach(t => {
      if (Array.isArray(t.tags) && !Array.isArray(t['Tags'])) {
        t['Tags'] = [...t.tags];
        changed = true;
      }
      if (Array.isArray(t['Tags'])) t.tags = [...t['Tags']];
    });
  }
  normalizeAllTagsFromTrades();
  return changed;
}

function tradeMatchesDateRange(trade) {
  if (!state.dateRange.from && !state.dateRange.to) return true;
  const dk = normalizeDate(extractDateFromTrade(trade));
  if (!dk) return false;
  if (state.dateRange.from && dk < state.dateRange.from) return false;
  if (state.dateRange.to && dk > state.dateRange.to) return false;
  return true;
}

```
