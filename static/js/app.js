/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Trading Journal â€” app.js
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

// â”€â”€ STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    tagFilter: [], filterMode: 'or'
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

// â”€â”€ ANNOTATION STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  satSunOff: false, tableRows: 5,
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
const IMAGE_PERMANENT_TAGS = ['thumbnail'];
const PERMANENT_COLUMNS = [BROKER_COLUMN, IMAGE_TAG_COLUMN, NOTE_COLUMN, VIDEO_COLUMN];
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

// â”€â”€ INIT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getSectionOrder() {
  try { const o = JSON.parse(localStorage.getItem('sectionOrder')); if (Array.isArray(o) && o.length === 3) return o; } catch (e) { }
  return ['calendar', 'dashboard', 'table'];
}
function saveSectionOrder(order) { try { localStorage.setItem('sectionOrder', JSON.stringify(order)); } catch (e) { } }
function applySectionOrder() {
  const order = getSectionOrder();
  const main = document.querySelector('.app-main');
  const map = { calendar: '.calendar-section', dashboard: '.dashboard-section', table: '.table-section' };
  order.forEach(key => { const el = main.querySelector(map[key]); if (el) main.appendChild(el); });
  // Sync settings list order
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

async function init() {
  loadSettingsFromStorage();
  loadShortcutsFromStorage();
  loadColWidths();
  loadTagGroups();
  applySectionOrder();
  bindSectionOrderDrag();
  populateSelects();
  renderDashboardStatsMenu();
  bindEvents();
  await loadTrades();
  setInterval(() => {
    if (!document.hidden) syncFromServerIfChanged(false);
  }, state.syncIntervalMs);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncFromServerIfChanged(true);
  });
  window.addEventListener('focus', () => syncFromServerIfChanged(true));
}


function populateSelects() {
  const ms = document.getElementById('month-select');
  const ys = document.getElementById('year-select');
  const vs = document.getElementById('view-select');
  MONTHS.forEach((m, i) => {
    const o = document.createElement('option');
    o.value = i; o.textContent = m; if (i === state.month) o.selected = true;
    ms.appendChild(o);
  });
  const cy = new Date().getFullYear();
  for (let y = cy - 5; y <= cy + 2; y++) {
    const o = document.createElement('option');
    o.value = y; o.textContent = y; if (y === state.year) o.selected = true;
    ys.appendChild(o);
  }
  if (vs) vs.value = state.calendarView;
}

// â”€â”€ LOAD / SAVE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function loadTrades() {
  try {
    const res = await fetch('/api/trades');
    const data = await res.json();
    state.trades = data.trades || [];
    state.columns = data.columns || [];
    state.allTags = data.allTags || [];
    IMAGE_PERMANENT_TAGS.forEach(t => { if (!state.allTags.includes(t)) state.allTags.push(t); });
    state.tagColumns = Array.isArray(data.tagColumns) ? data.tagColumns : [];
    state.userColumns = Array.isArray(data.userColumns) ? data.userColumns : [];
    state.dayData = (data.dayData && typeof data.dayData === 'object') ? data.dayData : {};
    state.tagGroups = (data.tagGroups && typeof data.tagGroups === 'object') ? data.tagGroups : (state.tagGroups || {});
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
    render();
  } catch (e) { showToast('Failed to load data', 'error'); }
}

function syncImageTagColumnValues() {
  state.trades.forEach(t => {
    t[IMAGE_TAG_COLUMN] = getMergedImageTagsForTradeRow(t).join(', ');
  });
}

async function saveTrades() {
  try {
    const payload = {
      trades: state.trades,
      columns: state.columns,
      allTags: state.allTags,
      tagColumns: state.tagColumns,
      userColumns: state.userColumns,
      dayData: state.dayData,
      tagGroups: state.tagGroups
    };
    await fetch('/api/trades', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    state.serverStateHash = hashServerState(payload);
  } catch (e) { showToast('Save failed', 'error'); }
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
      tagGroups: data?.tagGroups || {}
    });
  } catch (e) {
    return '';
  }
}

function isUiBusyForSync() {
  const ae = document.activeElement;
  const typing = !!(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable));
  if (typing) return true;
  if (annotState.active) return true;
  if (document.getElementById('obs-modal')?.classList.contains('open')) return true;
  if (document.getElementById('upload-modal')?.classList.contains('open')) return true;
  if (document.getElementById('tag-modal')?.classList.contains('open')) return true;
  if (document.getElementById('img-tag-modal')?.classList.contains('open')) return true;
  return false;
}

async function syncFromServerIfChanged(force = false) {
  if (!force && isUiBusyForSync()) return;
  try {
    const res = await fetch('/api/trades');
    if (!res.ok) return;
    const data = await res.json();
    const incomingHash = hashServerState(data);
    if (!incomingHash || incomingHash === state.serverStateHash) return;

    state.trades = data.trades || [];
    state.columns = data.columns || [];
    state.allTags = data.allTags || [];
    IMAGE_PERMANENT_TAGS.forEach(t => { if (!state.allTags.includes(t)) state.allTags.push(t); });
    state.tagColumns = Array.isArray(data.tagColumns) ? data.tagColumns : [];
    state.userColumns = Array.isArray(data.userColumns) ? data.userColumns : [];
    state.tagGroups = (data.tagGroups && typeof data.tagGroups === 'object') ? data.tagGroups : (state.tagGroups || {});
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
  // Legacy fallback: allow deleting non-system columns even if they were created
  // before userColumns tracking was introduced.
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
  // Preserve tag columns if present
  getTagColumns().forEach(col => { out[col] = Array.isArray(trade?.[col]) ? [...trade[col]] : []; });
  // Preserve fill_count so computeTradeCharges can use it for accurate brokerage
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

  // ── Common statutory charges (NSE Options) ────────────────────────
  const stt = sellTurn * 0.001;      // 0.1% on sell side (on premium)
  const exch = total * 0.0003503;  // 0.03503% NSE options (on premium)
  const sebi = total * 0.000001;   // ₹10 per crore
  const stamp = buyTurn * 0.00003;   // 0.003% on buy side

  // fill_count = actual order executions tracked during CSV import (₹20 per fill)
  const fillCount = Math.max(parseInt(trade['fill_count']) || 0, 2);

  let brokerage, gst, otherCharges;

  if (broker === 'dhan') {
    brokerage = fillCount * 20;
    const ipft = total * 0.000001;   // IPFT 0.0001% of total turnover
    gst = (brokerage + exch + sebi + ipft) * 0.18;
    otherCharges = stt + exch + sebi + ipft + stamp + gst;
  } else {
    // Zerodha: ₹20 per fill (min 2 fills per round-trip)
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
  // Use a Map so we can update existing trades by key
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
      // Duplicate: update fill_count so brokerage stays accurate on re-import
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
      // Backward compatibility for old plain-tag filters
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

// â”€â”€ SETTINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  // Apply position class to grid
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

// â”€â”€ SHOW HEADS (calendar) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  const panel = document.getElementById('show-heads-panel');
  panel.innerHTML = '';
  const cols = state.columns.filter(c => c.toLowerCase() !== 'date');
  if (!cols.length) { panel.innerHTML = '<p class="panel-hint">Import Excel to see columns</p>'; return; }

  // Mode badge
  const badge = document.createElement('div');
  const isConsolidated = state.calendarMode === 'consolidated';
  badge.style.cssText = 'font-size:0.72rem;font-weight:600;padding:4px 2px 6px 2px;color:' + (isConsolidated ? 'var(--blue)' : 'var(--green)');
  badge.textContent = isConsolidated ? 'Consolidated Heads' : 'Individual Heads';
  panel.appendChild(badge);

  // Search + Select All/None/P/L
  const searchRow = document.createElement('div'); searchRow.className = 'panel-search-row';
  const searchInp = document.createElement('input'); searchInp.className = 'panel-search'; searchInp.placeholder = 'Search...';
  searchRow.appendChild(searchInp); panel.appendChild(searchRow);

  const actRow = document.createElement('div'); actRow.className = 'panel-act-row';
  const btnAll = document.createElement('button'); btnAll.className = 'panel-act-btn'; btnAll.textContent = 'All';
  const btnNone = document.createElement('button'); btnNone.className = 'panel-act-btn'; btnNone.textContent = 'None';
  const btnPL = document.createElement('button'); btnPL.className = 'panel-act-btn'; btnPL.textContent = 'P/L Only';
  const heads = getActiveShowHeads();
  btnAll.addEventListener('click', () => { cols.forEach(c => { heads[c] = true; }); saveShowHeads(); renderShowHeads(); renderCalendar(); });
  btnNone.addEventListener('click', () => { cols.forEach(c => { heads[c] = false; }); saveShowHeads(); renderShowHeads(); renderCalendar(); });
  btnPL.addEventListener('click', () => { cols.forEach(c => { heads[c] = isDefaultShowHeadCol(c); }); saveShowHeads(); renderShowHeads(); renderCalendar(); });
  actRow.appendChild(btnAll); actRow.appendChild(btnNone); actRow.appendChild(btnPL); panel.appendChild(actRow);

  const list = document.createElement('div'); list.className = 'panel-list'; panel.appendChild(list);

  const renderList = (q) => {
    list.innerHTML = '';
    const activeHeads = getActiveShowHeads();
    cols.filter(c => !q || c.toLowerCase().includes(q.toLowerCase())).forEach(col => {
      const lbl = document.createElement('label'); lbl.className = 'head-checkbox';
      const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = !!activeHeads[col];
      chk.addEventListener('change', () => { getActiveShowHeads()[col] = chk.checked; saveShowHeads(); renderCalendar(); });
      lbl.appendChild(chk); lbl.appendChild(document.createTextNode(col));
      list.appendChild(lbl);
    });
  };
  renderList('');
  searchInp.addEventListener('input', () => renderList(searchInp.value));
}

// â”€â”€ TABLE COLUMN VISIBILITY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  // Keep permanent columns visible
  state.tableShowCols[BROKER_COLUMN] = true;
  state.tableShowCols[IMAGE_TAG_COLUMN] = true;
  renderColVisPanel();
}

function renderColVisPanel() {
  const panel = document.getElementById('col-vis-panel');
  panel.innerHTML = '';
  const allCols = [...state.columns, 'Images'];
  if (!allCols.length || (allCols.length === 1 && allCols[0] === 'Images')) {
    panel.innerHTML = '<p class="panel-hint" style="margin:8px">Import Excel first</p>'; return;
  }

  // Search + Select All/None
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

  // Freeze columns section
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

// â”€â”€ RENDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// ── DASHBOARD SUMMARY ──────────────────────────
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

  // Daily P&L aggregation for best/worst day + drawdown
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

  // Max drawdown (month)
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
      // Commit insertion at the last indicated position
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

// â”€â”€ CALENDAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // Tag filter
    if (state.tagFilter.length > 0 && !dayTrades.some(tradeMatchesTagFilter)) {
      cell.classList.add('tag-filtered-out');
    }
    if (state.calendarTagFocus) {
      const focus = parseTagFilterKey(state.calendarTagFocus);
      const dayMatchesFocus = dayTrades.some(t => getTradeTagsForColumn(t, focus.col).includes(focus.tag));
      cell.classList.add(dayMatchesFocus ? 'calendar-tag-match' : 'calendar-tag-dim');
    }

    // Day number
    const numDiv = document.createElement('div'); numDiv.className = 'day-num';
    numDiv.textContent = d; cell.appendChild(numDiv);

    // Data
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

      // Observation indicator only (no long text)
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

    // Pencil button
    const pencil = document.createElement('button'); pencil.className = 'day-pencil';
    pencil.title = 'Add observation'; pencil.textContent = 'Note';
    pencil.addEventListener('click', e => { e.stopPropagation(); openObsModal(dateStr); });
    cell.appendChild(pencil);

    // Cell click -> gallery
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

// â”€â”€ DATE HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ OBSERVATION MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // Drag handle
    const handle = document.createElement('span');
    handle.className = 'obs-note-drag-handle';
    handle.textContent = '⠿';
    handle.title = 'Drag to move note to another trade';
    handle.addEventListener('mousedown', () => { _noteItemDragFromHandle = true; });

    const lbl = document.createElement('div');
    lbl.className = 'obs-trade-note-label';
    lbl.textContent = label;

    // Mini toolbar for formatting
    const tb = document.createElement('div'); tb.className = 'obs-trade-note-toolbar';
    [['B', 'bold'], ['I', 'italic'], ['U', 'underline']].forEach(([lbl2, cmd]) => {
      const btn = document.createElement('button'); btn.className = 'note-popup-tool';
      btn.innerHTML = `<${lbl2.toLowerCase()}>${lbl2}</${lbl2.toLowerCase()}>`;
      btn.addEventListener('mousedown', e => { e.preventDefault(); document.execCommand(cmd); });
      tb.appendChild(btn);
    });

    // Contenteditable editor
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

    // Click on label → focus this trade's note editor
    lbl.style.cursor = 'pointer';
    lbl.title = 'Click to focus note';
    lbl.addEventListener('click', ev => { ev.preventDefault(); editor.focus(); });

    // Drag: only from handle
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
      // Move: paste into dest, clear source
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
  // Also persist any unsaved per-trade note editor values
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
  // Save current before navigating
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
  // Standard commands
  document.querySelectorAll('.obs-tool[data-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      document.getElementById('obs-editor').focus();
      document.execCommand(btn.dataset.cmd, false, btn.dataset.val || null);
    });
  });

  // Custom font size â€” works with selection OR just cursor (Google-Sheets style)
  document.getElementById('obs-apply-size').addEventListener('mousedown', e => {
    e.preventDefault();
    const size = document.getElementById('obs-custom-size').value;
    if (!size) return;
    const editor = document.getElementById('obs-editor');
    editor.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (sel.isCollapsed) {
      // No selection â€” insert a sized span with zero-width-space, place cursor inside
      // New typing inherits the font size automatically
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

  // Image insert (base64)
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

  // Link insert
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

  // Tab key â†' 4 spaces (no focus jump)
  document.getElementById('obs-editor').addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault(); e.stopPropagation();
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
    }
  });
}

// â”€â”€ TRADE TABLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getFilteredTrades() {
  return state.trades.filter(trade => {
    const colMatch = state.columns.every(col => {
      const fv = (state.filterValues[col] || '').toLowerCase().trim();
      if (!fv) return true;
      const isImageTags = String(col || '').toLowerCase() === 'image tags';
      const tv = isImageTags
        ? getMergedImageTagsForTradeRow(trade).join(',').toLowerCase()
        : String(trade[col] ?? '').toLowerCase();
      if (!isImageTags) return tv.includes(fv);

      // Multi-tag filter for IMAGE TAGS:
      // "panic,random" => row must contain BOTH tags
      const terms = fv.split(',').map(x => x.trim()).filter(Boolean);
      if (!terms.length) return true;
      return terms.every(term => tv.includes(term));
    });
    if (!colMatch) return false;
    if (!tradeMatchesBrokerFilter(trade)) return false;
    if (!tradeMatchesTagFilter(trade)) return false;
    // Date range filter
    if (state.dateRange.from || state.dateRange.to) {
      const dk = normalizeDate(extractDateFromTrade(trade));
      if (state.dateRange.from && dk < state.dateRange.from) return false;
      if (state.dateRange.to && dk > state.dateRange.to) return false;
    }
    return true;
  });
}

function tradeMatchesBrokerFilter(trade) {
  const broker = String(trade?.[BROKER_COLUMN] || '').trim().toLowerCase();
  if (state.brokerFilter === 'zerodha') return broker === 'zerodha';
  if (state.brokerFilter === 'dhan') return broker === 'dhan';
  return true;
}

function renderTable() {
  syncAllTradeDates();
  syncImageTagColumnValues();
  const headRow = document.getElementById('table-head-row');
  const filterRow = document.getElementById('filter-row');
  const body = document.getElementById('table-body');
  const footRow = document.getElementById('table-foot-row');
  const empty = document.getElementById('table-empty');
  const colgroup = document.getElementById('table-colgroup');

  headRow.innerHTML = '';
  filterRow.innerHTML = '';
  body.innerHTML = '';
  footRow.innerHTML = '';
  colgroup.innerHTML = '';

  if (!state.columns.length && !state.trades.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  const allCols = [...state.columns];
  if (!allCols.some(c => c.toLowerCase() === 'images')) allCols.push('Images');
  const visibleCols = allCols.filter(col => state.tableShowCols[col] !== false);

  // COLGROUP (for column resize widths)
  // Drag-handle + delete column (slightly wider)
  const cgDrag = document.createElement('col'); cgDrag.style.width = '36px'; colgroup.appendChild(cgDrag);
  visibleCols.forEach(col => {
    const cg = document.createElement('col');
    cg.style.width = (state.colWidths[col] || getDefaultColWidth(col)) + 'px';
    colgroup.appendChild(cg);
  });

  // HEADER — drag handle th (leftmost)
  const thDrag = document.createElement('th'); thDrag.className = 'row-drag-th'; headRow.appendChild(thDrag);

  visibleCols.forEach((col, idx) => {
    const th = document.createElement('th');
    th.className = 'sortable-th';
    th.dataset.col = col;

    const label = document.createElement('span');
    label.textContent = col;
    th.appendChild(label);

    const sort = document.createElement('span');
    sort.className = 'sort-ind';
    if (state.tableSort.col === col) sort.textContent = state.tableSort.dir === 'asc' ? '▲' : '▼';
    th.appendChild(sort);

    th.addEventListener('click', e => {
      if (e.target.classList.contains('col-resizer')) return;
      if (state.tableSort.col === col) {
        state.tableSort.dir = state.tableSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        state.tableSort.col = col;
        state.tableSort.dir = 'asc';
      }
      renderTable();
    });
    if (state.columns.includes(col)) {
      th.title = 'Double-click to rename column';
      th.addEventListener('dblclick', e => {
        e.preventDefault();
        e.stopPropagation();
        openEditColumnModal(col);
      });
    }

    const rz = document.createElement('div');
    rz.className = 'col-resizer';
    bindColumnResizer(rz, col, idx);
    th.appendChild(rz);

    // Hover delete button (only for deletable columns)
    if (state.columns.includes(col) && canDeleteColumn(col)) {
      const del = document.createElement('button');
      del.className = 'col-del-btn';
      del.title = 'Delete column';
      del.type = 'button';
      del.textContent = '×';
      del.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm(`Delete column "${col}"? This will remove data from all rows.`)) {
          deleteColumn(col);
        }
      });
      th.appendChild(del);
    }

    // Double-click header to rename column
    th.addEventListener('dblclick', e => {
      e.stopPropagation();
      openEditColumnModal(col);
    });

    headRow.appendChild(th);
  });

  // FILTER ROW
  filterRow.classList.toggle('hidden', !state.filterVisible);
  filterRow.appendChild(document.createElement('td')); // drag handle column
  visibleCols.forEach(col => {
    const td = document.createElement('td');
    if (isTagColumn(col) || col.toLowerCase() === 'images' || col.toLowerCase() === 'thumbnail') {
      filterRow.appendChild(td); return;
    }
    const inp = document.createElement('input'); inp.className = 'filter-input';
    inp.placeholder = 'Search'; inp.value = state.filterValues[col] || '';
    inp.addEventListener('input', () => { state.filterValues[col] = inp.value; renderTableBody(visibleCols, allCols, body, footRow); });
    td.appendChild(inp); filterRow.appendChild(td);
  });

  renderTableBody(visibleCols, allCols, body, footRow);
  applyFrozenColumns(visibleCols);
  renderColVisPanel();
}

function getFrozenCols() {
  try {
    const raw = localStorage.getItem('frozenCols');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.filter(c => state.columns.includes(c));
    }
  } catch (e) { }
  // Default freeze order: trade_date → Images → Tags → Note → Net P/L
  return ['trade_date', 'Images', 'Tags', NOTE_COLUMN, 'Net P/L'].filter(c => state.columns.includes(c));
}

function saveFrozenCols(cols) {
  try { localStorage.setItem('frozenCols', JSON.stringify(cols || [])); } catch (e) { }
}

function applyFrozenColumns(visibleCols) {
  const frozen = getFrozenCols().filter(c => visibleCols.includes(c));
  const table = document.getElementById('trade-table');
  if (!table) return;

  // Each row now has a 36px drag+delete column at index 0 before the visible columns.
  // visibleCols[i] → DOM cell index (i + 1); ths[0] = drag-th, ths[i+1] = visibleCols[i].
  const DRAG_W = 36;
  const ths = Array.from(table.querySelectorAll('thead tr#table-head-row th'));
  const rows = Array.from(table.querySelectorAll('thead tr, tbody tr, tfoot tr'));

  // Always freeze the drag-handle column at left=0
  rows.forEach(row => {
    const first = row.children[0];
    if (first) { first.classList.add('frozen-col'); first.style.left = '0px'; }
  });

  if (!frozen.length) return;

  const leftMap = new Map(); // visibleCols index → left px
  let left = DRAG_W; // start right after the drag-handle column
  frozen.forEach(col => {
    const idx = visibleCols.indexOf(col);
    if (idx === -1) return;
    const th = ths[idx + 1]; // +1 because drag-th is ths[0]
    const width = th ? th.getBoundingClientRect().width : (state.colWidths[col] || 120);
    leftMap.set(idx, left);
    left += width;
  });

  rows.forEach(row => {
    const cells = Array.from(row.children);
    leftMap.forEach((l, idx) => {
      const cell = cells[idx + 1]; // +1 for drag-handle cell
      if (!cell) return;
      cell.classList.add('frozen-col');
      cell.style.left = `${l}px`;
    });
  });
}

function renderTableBody(visibleCols, allCols, body, footRow) {
  body.innerHTML = ''; footRow.innerHTML = '';
  const filtered = sortTrades(getFilteredTrades());

  if (state.calendarMode === 'consolidated') {
    renderTableBodyConsolidated(visibleCols, filtered, body, footRow);
    return;
  }

  let lastDateKey = null;
  let band = 0;

  filtered.forEach((trade, displayIdx) => {
    const rowIdx = state.trades.indexOf(trade);
    const tr = document.createElement('tr');
    const rowDateKey = normalizeDate(trade['trade_date'] || trade['Date'] || trade.date || '');
    if (rowDateKey !== lastDateKey) {
      band = band === 0 ? 1 : 0;
      if (lastDateKey !== null) tr.classList.add('date-group-start');
      lastDateKey = rowDateKey;
    }
    tr.classList.add(band === 1 ? 'date-group-a' : 'date-group-b');

    // Drag handle + delete button — leftmost column
    const tdHandle = document.createElement('td'); tdHandle.className = 'row-drag-td';
    const delMini = document.createElement('button'); delMini.className = 'del-row-mini';
    delMini.textContent = '✕'; delMini.title = 'Delete row';
    delMini.addEventListener('click', () => { state.trades.splice(rowIdx, 1); saveTrades(); render(); });
    const handle = document.createElement('span'); handle.className = 'row-drag-handle';
    handle.textContent = '⠿'; handle.title = 'Drag to reorder';
    handle.addEventListener('mousedown', () => { _rowDragFromHandle = true; });
    tdHandle.appendChild(delMini);
    tdHandle.appendChild(handle);
    tr.appendChild(tdHandle);

    visibleCols.forEach(col => {
      const td = document.createElement('td');
      if (col.toLowerCase() === 'images' || col.toLowerCase() === 'thumbnail') {
        renderImagesCell(td, rowIdx, trade.images || []);
      } else if (col.toLowerCase() === 'image tags') {
        renderImageTagsCell(td, trade);
      } else if (col === NOTE_COLUMN) {
        const noteDiv = document.createElement('div');
        noteDiv.className = 'note-cell';
        noteDiv.setAttribute('data-note-row', rowIdx);
        _refreshNoteCellDisplay(noteDiv, trade[NOTE_COLUMN] || '');
        noteDiv.addEventListener('click', e => { e.stopPropagation(); openNotePopup(td, rowIdx); });
        td.appendChild(noteDiv);
      } else if (isTagColumn(col)) {
        renderTagCell(td, rowIdx, col);
      } else {
        const inp = document.createElement('input'); inp.className = 'cell-input';
        inp.value = trade[col] !== undefined ? trade[col] : '';
        if (col.toLowerCase().includes('profit') || col.toLowerCase() === 'rs') {
          applyProfitColor(inp, inp.value);
          inp.addEventListener('input', () => applyProfitColor(inp, inp.value));
        }
        inp.addEventListener('input', () => {
          if (col.toLowerCase().includes('date')) {
            state.trades[rowIdx][col] = inp.value;
            syncTradeDateField(state.trades[rowIdx]);
          }
        });
        inp.addEventListener('change', () => {
          state.trades[rowIdx][col] = inp.value;
          if (col.toLowerCase().includes('date')) syncTradeDateField(state.trades[rowIdx]);
          saveTrades(); renderCalendar();
        });
        td.appendChild(inp);
      }
      tr.appendChild(td);
    });

    bindRowImageDrop(tr, rowIdx);
    bindTableRowDrag(tr, rowIdx, body);
    body.appendChild(tr);
  });

  // FOOTER totals
  footRow.appendChild(document.createElement('td')); // drag-handle column spacer
  visibleCols.forEach(col => {
    const td = document.createElement('td');
    if (col.toLowerCase() === 'date' || col.toLowerCase() === 'trade_date') { td.textContent = `Total (${filtered.length})`; td.style.color = 'var(--text2)'; }
    else if (!isTagColumn(col) && col.toLowerCase() !== 'images' && col.toLowerCase() !== 'thumbnail' && col.toLowerCase() !== 'image tags') {
      const nums = filtered.map(t => parseFloat(t[col])).filter(n => !isNaN(n));
      if (nums.length) {
        const total = nums.reduce((a, b) => a + b, 0);
        td.textContent = total % 1 === 0 ? total : total.toFixed(2);
        if (col.toLowerCase().includes('profit') || col.toLowerCase() === 'rs') td.style.color = total >= 0 ? 'var(--green)' : 'var(--red)';
      }
    }
    footRow.appendChild(td);
  });
}

function renderTableBodyConsolidated(visibleCols, filtered, body, footRow) {
  // Sort by date for grouping
  const sortedByDate = [...filtered].sort((a, b) => {
    const da = normalizeDate(a['trade_date'] || a['Date'] || a.date || '');
    const db = normalizeDate(b['trade_date'] || b['Date'] || b.date || '');
    return da < db ? -1 : da > db ? 1 : 0;
  });

  // Group by date
  const dateOrder = [];
  const dateGroups = new Map();
  sortedByDate.forEach(trade => {
    const dk = normalizeDate(trade['trade_date'] || trade['Date'] || trade.date || '');
    if (!dateGroups.has(dk)) { dateGroups.set(dk, []); dateOrder.push(dk); }
    dateGroups.get(dk).push(trade);
  });

  dateOrder.forEach((dateKey, groupIdx) => {
    const dayTrades = dateGroups.get(dateKey);
    const tr = document.createElement('tr');
    tr.classList.add(groupIdx % 2 === 0 ? 'date-group-a' : 'date-group-b');
    tr.appendChild(document.createElement('td')); // spacer for drag-handle column

    visibleCols.forEach(col => {
      const td = document.createElement('td');
      const colLower = col.toLowerCase();

      if (colLower === 'images' || colLower === 'thumbnail') {
        // Day-level images first, then trade images
        const dayImages = state.dayData[dateKey]?.images || [];
        const tradeImages = dayTrades.reduce((arr, t) => arr.concat(t.images || []), []);
        const allImages = [...dayImages, ...tradeImages];
        const w = document.createElement('div'); w.className = 'img-cell img-cell-grid';
        const maxConsShow = 6;
        allImages.slice(0, maxConsShow).forEach((url) => {
          const item = document.createElement('div'); item.className = 'img-thumb-wrap';
          const img = document.createElement('img'); img.className = 'img-thumb'; img.src = url;
          img.addEventListener('click', e => { e.stopPropagation(); openGalleryForDate(dateKey); });
          item.appendChild(img);
          w.appendChild(item);
        });
        if (allImages.length > maxConsShow) {
          const b = document.createElement('span'); b.className = 'img-count-badge';
          b.textContent = `+${allImages.length - maxConsShow}`;
          b.addEventListener('click', () => openGalleryForDate(dateKey));
          w.appendChild(b);
        }
        // Upload button for day-level images
        const uploadBtn = document.createElement('button');
        uploadBtn.className = 'btn btn-outline day-img-upload-btn';
        uploadBtn.title = 'Add image for this day';
        uploadBtn.textContent = '+ IMG';
        uploadBtn.addEventListener('click', e => {
          e.stopPropagation();
          openDayUploadModal(dateKey);
        });
        w.appendChild(uploadBtn);
        td.appendChild(w);

      } else if (colLower === 'image tags') {
        const allImgTags = getMergedImageTagsForDate(dateKey);
        if (allImgTags.length) {
          const wrap = document.createElement('div'); wrap.className = 'tag-cell';
          allImgTags.forEach(tag => {
            const c = tagColor(tag);
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'tag-chip';
            chip.textContent = tag;
            chip.style.cssText = `color:${c};background:${hexToRgba(c, 0.15)};border-color:${hexToRgba(c, 0.45)}`;
            chip.title = 'Open gallery filtered by this tag';
            chip.addEventListener('click', e => {
              e.stopPropagation();
              openGalleryForDateWithTagFilter(dateKey, [tag]);
            });
            wrap.appendChild(chip);
          });
          td.appendChild(wrap);
        }

      } else if (col === VIDEO_COLUMN) {
        // Day-level video URL — stored in state.dayData[dateKey].video
        if (!state.dayData[dateKey]) state.dayData[dateKey] = {};
        const curUrl = state.dayData[dateKey].video || '';
        const vwrap = document.createElement('div'); vwrap.className = 'video-cell';
        if (curUrl) {
          const link = document.createElement('a'); link.href = curUrl; link.target = '_blank';
          link.rel = 'noopener'; link.className = 'video-link-btn'; link.textContent = '▶';
          link.title = 'Open video'; link.addEventListener('click', e => e.stopPropagation());
          vwrap.appendChild(link);
        }
        const vinp = document.createElement('input'); vinp.type = 'url'; vinp.className = 'cell-input video-url-inp';
        vinp.value = curUrl; vinp.placeholder = 'Video URL…';
        vinp.addEventListener('change', () => {
          if (!state.dayData[dateKey]) state.dayData[dateKey] = {};
          state.dayData[dateKey].video = vinp.value.trim();
          saveTrades(); renderTable();
        });
        vwrap.appendChild(vinp);
        td.appendChild(vwrap);

      } else if (col === NOTE_COLUMN) {
        // Merge per-trade notes: "[Instrument]: note | ..."
        const instrCol = state.columns.find(c => /instrument|symbol|scrip|stock/i.test(c));
        const parts = dayTrades
          .filter(t => t[NOTE_COLUMN] && stripHtml(String(t[NOTE_COLUMN])).trim())
          .map(t => {
            const instr = instrCol && t[instrCol] ? `[${t[instrCol]}] ` : '';
            return instr + stripHtml(String(t[NOTE_COLUMN])).trim();
          });
        if (parts.length) {
          const noteDiv = document.createElement('div');
          noteDiv.className = 'note-cell note-cell-merged';
          const joined = parts.join(' | ');
          noteDiv.textContent = joined.length > 80 ? joined.slice(0, 80) + '…' : joined;
          noteDiv.title = parts.join('\n');
          td.appendChild(noteDiv);
        }

      } else if (isTagColumn(col)) {
        const wrap = document.createElement('div'); wrap.className = 'tag-cell';
        // Trade-level merged tags (read-only chips)
        const seen = new Set();
        dayTrades.forEach(t => getTradeTagsForColumn(t, col).forEach(tag => {
          if (!seen.has(tag)) {
            seen.add(tag);
            const c = tagColor(tag);
            const chip = document.createElement('span'); chip.className = 'tag-chip';
            chip.textContent = tag;
            chip.style.cssText = `color:${c};background:${hexToRgba(c, 0.15)};border-color:${hexToRgba(c, 0.45)}`;
            wrap.appendChild(chip);
          }
        }));
        // Day-level tags (with remove button)
        _getDayLevelTags(dateKey, col).forEach(tag => {
          if (!seen.has(tag)) {
            seen.add(tag);
            const c = tagColor(tag);
            const chip = document.createElement('span'); chip.className = 'tag-chip tag-chip-day';
            chip.textContent = tag;
            chip.style.cssText = `color:${c};background:${hexToRgba(c, 0.15)};border-color:${hexToRgba(c, 0.45)}`;
            chip.title = 'Day tag — click to remove';
            chip.addEventListener('click', e => {
              e.stopPropagation();
              _setDayLevelTag(dateKey, col, tag, false);
              saveTrades(); renderTable();
            });
            wrap.appendChild(chip);
          }
        });
        // "+ Day Tag" button
        const addBtn = document.createElement('button'); addBtn.className = 'tag-add-btn';
        addBtn.textContent = '+ Day Tag';
        addBtn.title = 'Add a tag for this whole day';
        addBtn.addEventListener('click', e => { e.stopPropagation(); openTagPickerForDay(dateKey, col); });
        wrap.appendChild(addBtn);
        td.appendChild(wrap);

      } else {
        if (colLower === 'date' || colLower === 'trade_date') {
          const inp = document.createElement('input'); inp.className = 'cell-input'; inp.readOnly = true;
          inp.value = dateKey;
          td.appendChild(inp);
        } else {
          // Detect numeric vs text column: numeric only if every non-empty value parses as float
          const vals = dayTrades.map(t => t[col]).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
          if (vals.length) {
            const nums = vals.map(v => parseFloat(v));
            const allNumeric = nums.every(n => !isNaN(n));
            if (allNumeric) {
              const inp = document.createElement('input'); inp.className = 'cell-input'; inp.readOnly = true;
              const sum = nums.reduce((a, b) => a + b, 0);
              inp.value = sum % 1 === 0 ? String(sum) : sum.toFixed(2);
              if (colLower.includes('profit') || colLower === 'rs' || col === 'Gross P/L' || col === 'Net P/L') {
                applyProfitColor(inp, inp.value);
              }
              td.appendChild(inp);
            } else {
              // Text column — use a wrapping div so instrument names etc. can wrap
              const unique = [...new Set(vals.map(v => String(v).trim()).filter(Boolean))];
              const wrap = document.createElement('div'); wrap.className = 'cons-text-cell';
              wrap.textContent = unique.join(' / ');
              td.appendChild(wrap);
            }
          }
        }
      }

      tr.appendChild(td);
    });
    body.appendChild(tr);
  });

  // Footer totals
  footRow.appendChild(document.createElement('td')); // drag-handle column spacer
  visibleCols.forEach(col => {
    const td = document.createElement('td');
    const colLower = col.toLowerCase();
    if (colLower === 'date' || colLower === 'trade_date') {
      td.textContent = `Total (${filtered.length} trades, ${dateOrder.length} days)`;
      td.style.color = 'var(--text2)';
    } else if (!isTagColumn(col) && colLower !== 'images' && colLower !== 'thumbnail' && colLower !== 'image tags') {
      const nums = filtered.map(t => parseFloat(t[col])).filter(n => !isNaN(n));
      if (nums.length) {
        const total = nums.reduce((a, b) => a + b, 0);
        td.textContent = total % 1 === 0 ? total : total.toFixed(2);
        if (colLower.includes('profit') || colLower === 'rs') td.style.color = total >= 0 ? 'var(--green)' : 'var(--red)';
      }
    }
    footRow.appendChild(td);
  });
}

// ── NOTE HELPERS ──────────────────────────────────────────────────
function stripHtml(html) {
  if (!html) return '';
  const d = document.createElement('div'); d.innerHTML = html;
  return d.textContent || d.innerText || '';
}

// ── NOTE POPUP ────────────────────────────────────────────────────
let _notePop = null, _notePopRowIdx = null, _notePopBackdrop = null;

function openNotePopup(td, rowIdx) {
  closeNotePopup(true); // save any open popup first
  _notePopRowIdx = rowIdx;

  // Backdrop
  _notePopBackdrop = document.createElement('div');
  _notePopBackdrop.className = 'note-popup-backdrop';
  document.body.appendChild(_notePopBackdrop);

  const pop = document.createElement('div');
  pop.className = 'note-popup';

  // Mini toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'note-popup-toolbar';
  [['B', 'bold'], ['I', 'italic'], ['U', 'underline']].forEach(([label, cmd]) => {
    const btn = document.createElement('button');
    btn.className = 'note-popup-tool';
    btn.innerHTML = `<${label.toLowerCase()}>${label}</${label.toLowerCase()}>`;
    btn.title = cmd;
    btn.addEventListener('mousedown', e => { e.preventDefault(); document.execCommand(cmd); editor.focus(); });
    toolbar.appendChild(btn);
  });
  pop.appendChild(toolbar);

  // Contenteditable editor
  const editor = document.createElement('div');
  editor.className = 'note-popup-editor';
  editor.contentEditable = 'true';
  editor.spellcheck = false;
  editor.innerHTML = state.trades[rowIdx][NOTE_COLUMN] || '';
  if (!editor.innerHTML) editor.innerHTML = '<br>';
  pop.appendChild(editor);

  document.body.appendChild(pop);

  // Center on screen using fixed positioning
  pop.style.position = 'fixed';
  pop.style.top = '50%';
  pop.style.left = '50%';
  pop.style.transform = 'translate(-50%, -50%)';

  editor.focus();
  // Place cursor at end
  const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
  _notePop = pop;

  editor.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeNotePopup(false); }
  });

  setTimeout(() => {
    document.addEventListener('mousedown', _notePopOutsideHandler, { capture: true });
  }, 0);
}

function _notePopOutsideHandler(e) {
  if (_notePop && !_notePop.contains(e.target)) {
    _saveNotePopupValue();
  }
}

function _saveNotePopupValue() {
  if (_notePopRowIdx === null || !_notePop) return;
  const editor = _notePop.querySelector('.note-popup-editor');
  const raw = editor ? editor.innerHTML : '';
  const val = stripHtml(raw).trim() ? raw : '';
  state.trades[_notePopRowIdx][NOTE_COLUMN] = val;
  saveTrades();
  const idx = _notePopRowIdx;
  closeNotePopup(false);
  document.querySelectorAll(`[data-note-row="${idx}"]`).forEach(el => {
    _refreshNoteCellDisplay(el, val);
  });
}

function _refreshNoteCellDisplay(noteDiv, val) {
  noteDiv.innerHTML = '';
  const plain = stripHtml(val).trim();
  if (plain) {
    // Show rendered HTML — CSS handles overflow/truncation
    noteDiv.innerHTML = val;
    noteDiv.title = plain;
  } else {
    const ph = document.createElement('span');
    ph.className = 'note-cell-ph';
    ph.textContent = '+ note';
    noteDiv.appendChild(ph);
    noteDiv.title = 'Click to add note';
  }
}

function closeNotePopup(save = false) {
  document.removeEventListener('mousedown', _notePopOutsideHandler, { capture: true });
  if (_notePopBackdrop) { _notePopBackdrop.remove(); _notePopBackdrop = null; }
  if (save && _notePop) _saveNotePopupValue();
  else {
    if (_notePop) { _notePop.remove(); _notePop = null; }
    _notePopRowIdx = null;
  }
}

function normalizeSortVal(v) {
  const s = String(v ?? '').trim();
  if (!s) return { t: 3, v: '' };
  const n = parseFloat(s);
  if (!isNaN(n) && /^[-+]?\d+(\.\d+)?$/.test(s)) return { t: 0, v: n };
  const d = Date.parse(s);
  if (!isNaN(d)) return { t: 1, v: d };
  return { t: 2, v: s.toLowerCase() };
}

function sortTrades(rows) {
  const col = state.tableSort.col;
  if (!col) return rows;
  const dir = state.tableSort.dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = isTagColumn(col)
      ? getTradeTagsForColumn(a, col).join(',')
      : (col.toLowerCase() === 'images'
        ? (a.images || []).length
        : (col.toLowerCase() === 'image tags' ? getMergedImageTagsForTradeRow(a).join(',') : (a[col] ?? '')));
    const bv = isTagColumn(col)
      ? getTradeTagsForColumn(b, col).join(',')
      : (col.toLowerCase() === 'images'
        ? (b.images || []).length
        : (col.toLowerCase() === 'image tags' ? getMergedImageTagsForTradeRow(b).join(',') : (b[col] ?? '')));
    const na = normalizeSortVal(av);
    const nb = normalizeSortVal(bv);
    if (na.t !== nb.t) return (na.t - nb.t) * dir;
    if (na.v < nb.v) return -1 * dir;
    if (na.v > nb.v) return 1 * dir;
    return 0;
  });
}

function getDefaultColWidth(col) {
  if (col === 'Images') return 160;
  if (col === NOTE_COLUMN) return 130;
  if (col === VIDEO_COLUMN) return 180;
  if (col === IMAGE_TAG_COLUMN) return 150;
  if (col === BROKER_COLUMN) return 110;
  if (/net\s*p\/l|gross\s*p\/l|total\s*fees|brokerage|charges?/i.test(col)) return 95;
  if (/date|time/i.test(col)) return 105;
  if (/price|qty|quantity|lot|volume/i.test(col)) return 100;
  return 110;
}

function bindColumnResizer(handle, colName, colIdx) {
  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();
    const th = handle.parentElement;
    const startX = e.clientX;
    const startW = th.getBoundingClientRect().width;
    const onMove = ev => {
      const w = Math.max(50, Math.round(startW + (ev.clientX - startX)));
      state.colWidths[colName] = w;
      // colEls[0] = drag-handle col, so visible cols start at index 1
      const colEls = document.querySelectorAll('#table-colgroup col');
      if (colEls[colIdx + 1]) colEls[colIdx + 1].style.width = w + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      try { localStorage.setItem('tj_colWidths', JSON.stringify(state.colWidths)); } catch (e) { }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
  // Double-click resizer → reset to default width
  handle.addEventListener('dblclick', e => {
    e.preventDefault(); e.stopPropagation();
    delete state.colWidths[colName];
    try { localStorage.setItem('tj_colWidths', JSON.stringify(state.colWidths)); } catch (e2) { }
    renderTable();
  });
}

function loadColWidths() {
  try {
    const saved = JSON.parse(localStorage.getItem('tj_colWidths') || '{}');
    if (saved && typeof saved === 'object') {
      Object.assign(state.colWidths, saved);
    }
  } catch (e) { }
}

function loadTagGroups() {
  try {
    const saved = JSON.parse(localStorage.getItem('tj_tagGroups') || '{}');
    if (saved && typeof saved === 'object') state.tagGroups = saved;
  } catch (e) { }
}
function saveTagGroups() {
  try { localStorage.setItem('tj_tagGroups', JSON.stringify(state.tagGroups)); } catch (e) { }
}

function applyProfitColor(inp, val) {
  const n = parseFloat(val);
  inp.style.color = !isNaN(n) ? (n >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text)';
}

function renderImagesCell(td, rowIdx, images) {
  const w = document.createElement('div'); w.className = 'img-cell img-cell-grid';
  const maxShow = 6;
  images.slice(0, maxShow).forEach((url, i) => {
    const item = document.createElement('div'); item.className = 'img-thumb-wrap';
    const img = document.createElement('img'); img.className = 'img-thumb'; img.src = url;
    img.setAttribute('draggable', 'true');
    img.addEventListener('click', e => { e.stopPropagation(); openGalleryDirect(images, i, rowIdx); });
    img.addEventListener('dragstart', e => {
      e.stopPropagation();
      e.dataTransfer.setData('tj-img', JSON.stringify({ rowIdx, url }));
      e.dataTransfer.effectAllowed = e.ctrlKey ? 'copy' : 'move';
    });
    const del = document.createElement('button'); del.className = 'img-thumb-del'; del.textContent = '×'; del.title = 'Delete image';
    del.addEventListener('click', async e => {
      e.stopPropagation();
      await deleteImageFromRow(rowIdx, url);
    });
    item.appendChild(img);
    item.appendChild(del);
    w.appendChild(item);
  });
  if (images.length > maxShow) {
    const b = document.createElement('span'); b.className = 'img-count-badge'; b.textContent = `+${images.length - maxShow}`;
    b.addEventListener('click', () => openGalleryDirect(images, maxShow, rowIdx)); w.appendChild(b);
  }
  const ub = document.createElement('button'); ub.className = 'img-upload-btn'; ub.textContent = '+ Upload';
  ub.addEventListener('click', e => { e.stopPropagation(); openUploadModal(rowIdx); });
  w.appendChild(ub); td.appendChild(w);
}

function renderImageTagsCell(td, trade) {
  const wrap = document.createElement('div');
  wrap.className = 'tag-cell';
  const tags = getMergedImageTagsForTradeRow(trade);
  const dateKey = normalizeDate(extractDateFromTrade(trade));
  if (!tags.length) {
    const empty = document.createElement('span');
    empty.style.color = 'var(--text2)';
    empty.textContent = '-';
    wrap.appendChild(empty);
    td.appendChild(wrap);
    return;
  }
  tags.forEach(tag => {
    const c = tagColor(tag);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tag-chip';
    chip.textContent = tag;
    chip.style.color = c;
    chip.style.background = hexToRgba(c, 0.15);
    chip.style.borderColor = hexToRgba(c, 0.45);
    chip.title = 'Open gallery filtered by this tag';
    chip.addEventListener('click', e => {
      e.stopPropagation();
      if (!dateKey) return;
      openGalleryForDateWithTagFilter(dateKey, [tag]);
    });
    wrap.appendChild(chip);
  });
  td.appendChild(wrap);
}

async function deleteImageFromRow(rowIdx, imageUrl) {
  const trade = state.trades[rowIdx];
  if (!trade) return;
  trade.images = (trade.images || []).filter(u => u !== imageUrl);
  cleanupImageTagStore(trade);
  if (trade.overlays && trade.overlays[imageUrl]) delete trade.overlays[imageUrl];

  try {
    const filename = String(imageUrl || '').split('/').pop();
    await fetch('/api/delete-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
  } catch (e) { }

  await saveTrades();
  render();
  showToast('Image deleted', 'success');
}

// â”€â”€ TAGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TAG_PALETTE = ['#3fb950', '#58a6ff', '#d29922', '#bc8cff', '#f85149', '#79b8ff', '#56d364', '#ffa657'];
function tagColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h) + name.charCodeAt(i);
  return TAG_PALETTE[Math.abs(h) % TAG_PALETTE.length];
}
function hexToRgba(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function renderTagCell(td, rowIdx, colName) {
  const trade = state.trades[rowIdx];
  const wrap = document.createElement('div'); wrap.className = 'tag-cell';
  getTradeTagsForColumn(trade, colName).forEach(tag => {
    const c = tagColor(tag);
    const chip = document.createElement('span'); chip.className = 'tag-chip';
    chip.textContent = tag;
    chip.style.color = c;
    chip.style.background = hexToRgba(c, 0.15);
    chip.style.borderColor = hexToRgba(c, 0.45);
    chip.title = 'Click to remove \u2022 Drag to move \u2022 Ctrl+Drag to copy';
    chip.setAttribute('draggable', 'true');
    chip.addEventListener('dragstart', e => {
      _tagDragIsCopy = e.ctrlKey;
      e.dataTransfer.effectAllowed = e.ctrlKey ? 'copy' : 'move';
      e.dataTransfer.setData('tj-tag', JSON.stringify({ rowIdx, tag, colName }));
      e.stopPropagation(); // prevent row-drag from triggering
    });
    chip.addEventListener('click', e => {
      e.stopPropagation();
      trade[colName] = getTradeTagsForColumn(trade, colName).filter(t => t !== tag);
      if (colName === 'Tags') trade.tags = [...trade[colName]];
      saveTrades(); renderTable(); renderTagFilterPanel();
    });
    wrap.appendChild(chip);
  });
  const addBtn = document.createElement('button'); addBtn.className = 'tag-add-btn'; addBtn.textContent = '+ Tag';
  addBtn.addEventListener('click', e => { e.stopPropagation(); openTagPicker(rowIdx, colName); });
  wrap.appendChild(addBtn);

  // Drop zone — accept tj-tag drops on same column
  td.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('tj-tag')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = _tagDragIsCopy ? 'copy' : 'move';
    td.classList.add('tag-drop-hover');
  });
  td.addEventListener('dragleave', () => td.classList.remove('tag-drop-hover'));
  td.addEventListener('drop', e => {
    td.classList.remove('tag-drop-hover');
    if (!e.dataTransfer.types.includes('tj-tag')) return;
    e.preventDefault(); e.stopPropagation();
    let payload; try { payload = JSON.parse(e.dataTransfer.getData('tj-tag')); } catch { return; }
    const { rowIdx: srcRowIdx, tag: srcTag, colName: srcCol } = payload;
    if (srcCol !== colName) return; // only same column
    if (srcRowIdx === rowIdx) return; // same row — no-op
    const tgtTrade = state.trades[rowIdx];
    const tgtTags = getTradeTagsForColumn(tgtTrade, colName);
    if (!tgtTags.includes(srcTag)) {
      tgtTrade[colName] = [...tgtTags, srcTag];
      if (colName === 'Tags') tgtTrade.tags = [...tgtTrade[colName]];
    }
    if (!_tagDragIsCopy) {
      const srcTrade = state.trades[srcRowIdx];
      srcTrade[colName] = getTradeTagsForColumn(srcTrade, colName).filter(t => t !== srcTag);
      if (colName === 'Tags') srcTrade.tags = [...srcTrade[colName]];
    }
    saveTrades(); renderTable(); renderTagFilterPanel();
  });

  td.appendChild(wrap);
}

let _tagPickerRow = null;
let _tagPickerCol = 'Tags';
let _tagPickerDate = null; // non-null when editing day-level tags
let _tagDragIsCopy = false; // true when Ctrl held during tag chip dragstart

function openTagPicker(rowIdx, colName = 'Tags') {
  _tagPickerRow = rowIdx;
  _tagPickerDate = null;
  _tagPickerCol = colName;
  const modal = document.getElementById('tag-modal');
  const inp = document.getElementById('tag-picker-inp');
  const trade = state.trades[rowIdx] || {};
  const label = trade.date || trade['Date'] || `Row ${rowIdx + 1}`;
  document.getElementById('tag-modal-title').textContent = `${colName} - ${label}`;
  inp.value = ''; updateTagPickerList('');
  modal.classList.add('open');
  inp.focus();
}

function openTagPickerForDay(dateKey, colName = 'Tags') {
  _tagPickerRow = null;
  _tagPickerDate = dateKey;
  _tagPickerCol = colName;
  const modal = document.getElementById('tag-modal');
  const inp = document.getElementById('tag-picker-inp');
  document.getElementById('tag-modal-title').textContent = `${colName} - ${dateKey} (day)`;
  inp.value = ''; updateTagPickerList('');
  modal.classList.add('open');
  inp.focus();
}

function closeTagPicker() {
  document.getElementById('tag-modal').classList.remove('open');
  _tagPickerRow = null;
  _tagPickerDate = null;
  _tagPickerCol = 'Tags';
}

function _getDayLevelTags(dateKey, colName) {
  return (state.dayData[dateKey]?.tags?.[colName]) || [];
}
function _setDayLevelTag(dateKey, colName, tag, add) {
  if (!state.dayData[dateKey]) state.dayData[dateKey] = {};
  if (!state.dayData[dateKey].tags) state.dayData[dateKey].tags = {};
  const arr = Array.isArray(state.dayData[dateKey].tags[colName]) ? state.dayData[dateKey].tags[colName] : [];
  if (add) { if (!arr.includes(tag)) arr.push(tag); }
  else { state.dayData[dateKey].tags[colName] = arr.filter(t => t !== tag); return; }
  state.dayData[dateKey].tags[colName] = arr;
}

function updateTagPickerList(q) {
  if (_tagPickerRow === null && _tagPickerDate === null) return;
  const isDayMode = _tagPickerDate !== null;

  // Get currently selected tags
  let currentTags;
  if (isDayMode) {
    currentTags = _getDayLevelTags(_tagPickerDate, _tagPickerCol);
  } else {
    const trade = state.trades[_tagPickerRow];
    currentTags = trade ? getTradeTagsForColumn(trade, _tagPickerCol) : [];
  }

  const list = document.getElementById('tag-picker-list');
  list.innerHTML = '';

  const columnTags = getUniqueTagsForColumn(_tagPickerCol);
  const filtered = q ? columnTags.filter(t => t.toLowerCase().includes(q.toLowerCase())) : columnTags;
  filtered.forEach(tag => {
    const item = document.createElement('label'); item.className = 'tag-picker-item';
    const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = currentTags.includes(tag);
    const dot = document.createElement('span'); dot.className = 'tag-dot'; dot.style.background = tagColor(tag);
    const nameSpan = document.createElement('span'); nameSpan.textContent = tag; nameSpan.style.color = tagColor(tag);
    chk.addEventListener('change', () => {
      if (isDayMode) {
        _setDayLevelTag(_tagPickerDate, _tagPickerCol, tag, chk.checked);
        saveTrades(); renderTable();
      } else {
        const trade = state.trades[_tagPickerRow];
        const arr = ensureTagArray(trade, _tagPickerCol);
        if (chk.checked) { if (!arr.includes(tag)) arr.push(tag); }
        else trade[_tagPickerCol] = arr.filter(t => t !== tag);
        if (_tagPickerCol === 'Tags') trade.tags = [...ensureTagArray(trade, _tagPickerCol)];
        saveTrades(); renderTable(); renderTagFilterPanel();
      }
    });
    item.appendChild(chk); item.appendChild(dot); item.appendChild(nameSpan);
    list.appendChild(item);
  });

  // "Create new" option if search string is new
  const trimQ = q.trim();
  if (trimQ && !columnTags.some(t => t.toLowerCase() === trimQ.toLowerCase())) {
    const createItem = document.createElement('div'); createItem.className = 'tag-picker-create';
    createItem.textContent = `+ Create "${trimQ}"`;
    createItem.addEventListener('click', () => {
      if (!state.allTags.some(t => t.toLowerCase() === trimQ.toLowerCase())) state.allTags.push(trimQ);
      if (isDayMode) {
        _setDayLevelTag(_tagPickerDate, _tagPickerCol, trimQ, true);
        saveTrades(); renderTable();
      } else {
        const arr = ensureTagArray(state.trades[_tagPickerRow], _tagPickerCol);
        if (!arr.includes(trimQ)) arr.push(trimQ);
        if (_tagPickerCol === 'Tags') state.trades[_tagPickerRow].tags = [...arr];
        saveTrades(); renderTable(); renderTagFilterPanel();
      }
      document.getElementById('tag-picker-inp').value = ''; updateTagPickerList('');
    });
    list.appendChild(createItem);
  }

  if (!filtered.length && !trimQ) {
    const hint = document.createElement('p'); hint.className = 'panel-hint'; hint.style.padding = '8px';
    hint.textContent = 'Type to create a tag'; list.appendChild(hint);
  }
}

function renderTagFilterPanel() {
  const panel = document.getElementById('tag-filter-panel');
  normalizeAllTagsFromTrades();
  panel.innerHTML = '';
  const keys = getAllColumnTagKeys();
  if (!keys.length) {
    panel.innerHTML = '<p class="panel-hint" style="padding:10px 8px">No tags yet.<br>Add via tag columns.</p>';
    return;
  }

  const actRow = document.createElement('div'); actRow.className = 'panel-act-row';
  const btnAll = document.createElement('button'); btnAll.className = 'panel-act-btn'; btnAll.textContent = 'All';
  const btnNone = document.createElement('button'); btnNone.className = 'panel-act-btn'; btnNone.textContent = 'None';
  btnAll.addEventListener('click', () => { state.tagFilter = [...keys]; renderTagFilterPanel(); applyTagFilter(); });
  btnNone.addEventListener('click', () => { state.tagFilter = []; renderTagFilterPanel(); applyTagFilter(); });
  actRow.appendChild(btnAll); actRow.appendChild(btnNone); panel.appendChild(actRow);

  getTagColumns().forEach(col => {
    const tags = getUniqueTagsForColumn(col);
    if (!tags.length) return;

    const colLabel = document.createElement('div');
    colLabel.className = 'panel-manage-label';
    colLabel.style.marginTop = '6px';
    colLabel.textContent = col;
    panel.appendChild(colLabel);

    const list = document.createElement('div');
    list.className = 'panel-list';
    tags.forEach(tag => {
      const key = makeTagFilterKey(col, tag);
      const lbl = document.createElement('label'); lbl.className = 'head-checkbox';
      const dot = document.createElement('span'); dot.className = 'tag-dot'; dot.style.background = tagColor(tag);
      const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = state.tagFilter.includes(key);
      chk.addEventListener('change', () => {
        if (chk.checked) { if (!state.tagFilter.includes(key)) state.tagFilter.push(key); }
        else state.tagFilter = state.tagFilter.filter(t => t !== key);
        applyTagFilter();
      });
      lbl.appendChild(chk); lbl.appendChild(dot); lbl.appendChild(document.createTextNode(tag));
      list.appendChild(lbl);
    });
    panel.appendChild(list);
  });

  // Manage section — delete tags per column
  const sep = document.createElement('div'); sep.style.cssText = 'height:1px;background:var(--border);margin:8px 0';
  panel.appendChild(sep);
  const mLabel = document.createElement('div'); mLabel.className = 'panel-manage-label'; mLabel.textContent = 'Delete Tags (Column-wise)';
  panel.appendChild(mLabel);
  getTagColumns().forEach(col => {
    const tags = getUniqueTagsForColumn(col);
    tags.forEach(tag => {
      const key = makeTagFilterKey(col, tag);
      const row = document.createElement('div'); row.className = 'tag-manage-row';
      const dot = document.createElement('span'); dot.className = 'tag-dot'; dot.style.background = tagColor(tag);
      const name = document.createElement('span'); name.textContent = `${col}: ${tag}`; name.style.flex = '1';
      const del = document.createElement('button'); del.className = 'tag-del-btn'; del.textContent = 'x'; del.title = 'Delete in this column only';
      del.addEventListener('click', () => {
        state.tagFilter = state.tagFilter.filter(t => t !== key);
        state.trades.forEach(t => {
          if (Array.isArray(t[col])) t[col] = t[col].filter(x => x !== tag);
          if (col === 'Tags' && Array.isArray(t.tags)) t.tags = t.tags.filter(x => x !== tag);
        });
        saveTrades(); renderTable(); renderTagFilterPanel(); applyTagFilter();
      });
      row.appendChild(dot); row.appendChild(name); row.appendChild(del);
      panel.appendChild(row);
    });
  });
}

function applyTagFilter() {
  renderTable(); renderCalendar();
  const btn = document.getElementById('tag-filter-btn');
  btn.style.borderColor = state.tagFilter.length ? 'var(--blue)' : '';
  btn.style.color = state.tagFilter.length ? 'var(--blue)' : '';
}

// â”€â”€ ADD COLUMN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function addColumn(colName) {
  if (!colName || !colName.trim()) { state.addTagColumnMode = false; return; }
  const name = colName.trim();
  if (PERMANENT_COLUMNS.map(x => x.toLowerCase()).includes(name.toLowerCase())) {
    state.addTagColumnMode = false;
    showToast('This is a permanent column', 'error');
    return;
  }
  if (state.columns.includes(name)) { state.addTagColumnMode = false; showToast('Column already exists', 'error'); return; }
  const asTagColumn = state.addTagColumnMode || isTagColumn(name);
  state.columns.push(name);
  if (!state.userColumns.includes(name)) state.userColumns.push(name);
  if (asTagColumn) {
    if (!state.tagColumns.includes(name)) state.tagColumns.push(name);
    state.trades.forEach(t => { if (!Array.isArray(t[name])) t[name] = []; });
    state.tableShowCols[name] = true;
    normalizeAllTagsFromTrades();
  } else {
    state.trades.forEach(t => { t[name] = ''; });
    state.tableShowCols[name] = true;
  }
  const defHead = !asTagColumn && isDefaultShowHeadCol(name);
  state.showHeadsConsolidated[name] = defHead;
  state.showHeadsIndividual[name] = defHead;
  saveShowHeads();
  state.addTagColumnMode = false;
  saveTrades(); render(); renderShowHeads();
  showToast(`Column "${name}" added!`, 'success');
}

function renameColumn(oldName, newName) {
  const from = String(oldName || '').trim();
  const to = String(newName || '').trim();
  if (!from || !to) return;
  if (from === to) return;
  if (!state.columns.includes(from)) { showToast('Column not found', 'error'); return; }
  if (state.columns.includes(to)) { showToast('Target column already exists', 'error'); return; }
  const wasTagColumn = isTagColumn(from);

  const idx = state.columns.indexOf(from);
  state.columns[idx] = to;
  if (wasTagColumn) {
    state.tagColumns = state.tagColumns.filter(c => c !== from);
    if (!state.tagColumns.includes(to)) state.tagColumns.push(to);
  }
  if (state.userColumns.includes(from)) {
    state.userColumns = state.userColumns.filter(c => c !== from);
    if (!state.userColumns.includes(to)) state.userColumns.push(to);
  }

  state.trades.forEach(t => {
    const oldVal = t[from];
    if (wasTagColumn) {
      t[to] = Array.isArray(oldVal) ? [...oldVal] : (oldVal ? [String(oldVal)] : []);
    } else {
      t[to] = Array.isArray(oldVal) ? oldVal.join(', ') : oldVal;
    }
    delete t[from];
    if (to === 'Tags') t.tags = Array.isArray(t[to]) ? [...t[to]] : [];
  });

  if (from in state.showHeadsConsolidated) { state.showHeadsConsolidated[to] = state.showHeadsConsolidated[from]; delete state.showHeadsConsolidated[from]; }
  if (from in state.showHeadsIndividual) { state.showHeadsIndividual[to] = state.showHeadsIndividual[from]; delete state.showHeadsIndividual[from]; }
  saveShowHeads();
  if (from in state.tableShowCols) {
    state.tableShowCols[to] = state.tableShowCols[from];
    delete state.tableShowCols[from];
  }
  if (from in state.filterValues) {
    state.filterValues[to] = state.filterValues[from];
    delete state.filterValues[from];
  }
  if (from in state.colWidths) {
    state.colWidths[to] = state.colWidths[from];
    delete state.colWidths[from];
  }
  if (state.tableSort.col === from) state.tableSort.col = to;

  saveTrades();
  render();
  renderShowHeads();
  renderColVisPanel();
  showToast(`Renamed "${from}" to "${to}"`, 'success');
}

function deleteColumn(colName) {
  const name = String(colName || '').trim();
  if (!name) return;
  if (!state.columns.includes(name)) { showToast('Column not found', 'error'); return; }
  if (!canDeleteColumn(name)) {
    showToast('System/import column cannot be deleted', 'error');
    return;
  }

  state.columns = state.columns.filter(c => c !== name);
  state.userColumns = state.userColumns.filter(c => c !== name);
  state.tagColumns = state.tagColumns.filter(c => c !== name);
  state.tagFilter = state.tagFilter.filter(k => parseTagFilterKey(k).col !== name);

  state.trades.forEach(t => {
    delete t[name];
    if (name === 'Tags') delete t.tags;
  });

  delete state.showHeadsConsolidated[name]; delete state.showHeadsIndividual[name]; saveShowHeads();
  delete state.tableShowCols[name];
  delete state.filterValues[name];
  delete state.colWidths[name];
  if (state.tableSort.col === name) state.tableSort.col = null;

  saveTrades();
  render();
  renderShowHeads();
  renderColVisPanel();
  renderTagFilterPanel();
  showToast(`Column "${name}" deleted`, 'success');
}

function openEditColumnModal(defaultCol = '') {
  const sel = document.getElementById('edit-col-select');
  const inp = document.getElementById('edit-col-name');
  const delBtn = document.getElementById('edit-col-delete');
  sel.innerHTML = '';

  if (!state.columns.length) {
    showToast('No editable columns yet', '');
    return;
  }

  state.columns.forEach(c => {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = c;
    if (defaultCol && c === defaultCol) o.selected = true;
    sel.appendChild(o);
  });

  const selected = defaultCol && state.columns.includes(defaultCol) ? defaultCol : state.columns[0];
  sel.value = selected;
  inp.value = selected;
  const canDelete = canDeleteColumn(selected);
  delBtn.disabled = !canDelete;
  delBtn.title = canDelete ? 'Delete this column' : 'System/import column cannot be deleted';
  document.getElementById('edit-col-modal').classList.add('open');
  setTimeout(() => inp.focus(), 20);
}

// â”€â”€ GALLERY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openGalleryForDate(dateStr) {
  const images = getImagesForDate(dateStr);
  if (!images.length) return;
  state.gallery.images = images; state.gallery.currentIndex = 0;
  state.gallery.date = dateStr; state.gallery.sourceRow = null;
  state.gallery._baseImages = [...images];
  state.gallery._baseDate = dateStr;
  state.gallery._baseSourceRow = null;
  lockBodyScroll();
  document.getElementById('gallery-modal').classList.add('open');
  renderGallery(); updateGalleryDateArrows();
  renderGalleryTagCloud(); renderGalleryTagsTray();
}

function openGalleryDirect(images, startIndex, sourceRow = null) {
  state.gallery.images = images; state.gallery.currentIndex = startIndex;
  state.gallery.date = ''; state.gallery.sourceRow = sourceRow;
  state.gallery._baseImages = [...images];
  state.gallery._baseDate = '';
  state.gallery._baseSourceRow = sourceRow;
  lockBodyScroll();
  document.getElementById('gallery-modal').classList.add('open');
  renderGallery(); updateGalleryDateArrows();
  renderGalleryTagCloud(); renderGalleryTagsTray();
}

function lockBodyScroll() {
  document.body.classList.add('modal-open');
}

function unlockBodyScroll() {
  if (document.querySelector('.modal-overlay.open')) return;
  document.body.classList.remove('modal-open');
}

function openGalleryForDateWithTagFilter(dateStr, tags = []) {
  const cleanTags = Array.from(new Set((tags || []).map(t => String(t || '').trim()).filter(Boolean)));
  openGalleryForDate(dateStr);
  state.gallery.tagFilter = cleanTags;
  const keep = {
    url: (state.gallery.images || [])[state.gallery.currentIndex] || '',
    date: normalizeDate(dateStr || ''),
    sourceRow: null
  };
  if (cleanTags.length) applyGalleryImageScopeByTagFilter(keep);
  renderGalleryTagCloud();
  renderGallery();
  updateGalleryDateArrows();
}

function renderGallery() {
  if (state.gallery._skipFilterRescopeOnce) {
    state.gallery._skipFilterRescopeOnce = false;
  } else if (state.gallery.tagFilter?.length) {
    const before = getCurrentGalleryPreserveContext();
    applyGalleryImageScopeByTagFilter(before);
  }
  const { images, currentIndex, date } = state.gallery;
  const currentImageUrl = images[currentIndex] || '';
  if (annotState.active && annotState.imageUrl && annotState.imageUrl !== currentImageUrl) {
    // Carry annotation mode/tool across image switches.
    state._carryAnnotTool = annotState.tool;
    stopAnnotation();
  }
  document.getElementById('gallery-date').textContent = date ? formatDisplayDate(date) : `${images.length} image(s)`;
  if (date) document.getElementById('gallery-date-picker').value = date;

  // Upload button — show only when date available
  const uploadBtn = document.getElementById('gallery-upload-btn');
  if (uploadBtn) uploadBtn.style.display = date ? '' : 'none';

  // Obs button
  const obsBtn = document.getElementById('gv2-obs-btn');
  if (obsBtn) obsBtn.style.display = date ? '' : 'none';

  const img = document.getElementById('gallery-img');
  if (!annotState.active) document.getElementById('annot-canvas').style.display = 'none';
  img.src = images[currentIndex] || ''; img.classList.remove('zoomed', 'dragging'); resetZoom();
  const afterImageReady = () => {
    loadOverlayForCurrentImage();
    if (state._carryAnnotTool) {
      annotState.tool = state._carryAnnotTool;
      state._carryAnnotTool = '';
      startAnnotation();
    }
  };
  img.addEventListener('load', afterImageReady, { once: true });
  if (img.complete && img.naturalWidth) afterImageReady();

  document.getElementById('gallery-counter').textContent = `${currentIndex + 1} / ${images.length}`;
  document.getElementById('gallery-prev').disabled = currentIndex === 0;
  document.getElementById('gallery-next').disabled = currentIndex === images.length - 1;
  renderGalleryImageTags();
  renderGalleryTagCloud();
  const tray = document.getElementById('gv2-tags-tray');
  if (tray && tray.style.display !== 'none') renderGalleryTagsTray();
  if (document.getElementById('img-tag-modal')?.classList.contains('open')) renderImageTagModal();

  // ── Thumbnail Tray ──
  const thumbs = document.getElementById('gallery-thumbs'); thumbs.innerHTML = '';
  // When tag filter active, show filtered images from all dates; else current date/images
  const thumbImages = _getGalleryThumbImages();
  let dragFromIndex = -1;
  thumbImages.forEach(({ url, globalIdx, isCurrentDate }) => {
    const wrap = document.createElement('div'); wrap.className = 'gv2-thumb-wrap'; wrap.draggable = !IS_TOUCH_DEVICE;
    const t = document.createElement('img');
    t.src = url;
    t.className = 'gv2-thumb' + (globalIdx === currentIndex ? ' active' : '');
    t.addEventListener('click', () => { state.gallery.currentIndex = globalIdx; renderGallery(); });
    t.addEventListener('touchend', e => {
      if (IS_TOUCH_DEVICE) {
        e.preventDefault();
        state.gallery.currentIndex = globalIdx;
        renderGallery();
      }
    }, { passive: false });

    // Drag reorder (only within current date's images)
    if (isCurrentDate) {
      wrap.addEventListener('dragstart', e => {
        dragFromIndex = globalIdx; wrap.classList.add('dragging');
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      });
      wrap.addEventListener('dragend', () => {
        dragFromIndex = -1; wrap.classList.remove('dragging');
        thumbs.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      });
      wrap.addEventListener('dragover', e => {
        e.preventDefault();
        if (dragFromIndex !== globalIdx) wrap.classList.add('drag-over');
      });
      wrap.addEventListener('dragleave', () => wrap.classList.remove('drag-over'));
      wrap.addEventListener('drop', async e => {
        e.preventDefault(); wrap.classList.remove('drag-over');
        if (dragFromIndex < 0 || dragFromIndex === globalIdx) return;
        await reorderGalleryImages(dragFromIndex, globalIdx);
      });
    }

    const del = document.createElement('button'); del.type = 'button';
    del.className = 'gv2-thumb-del'; del.textContent = '×'; del.title = 'Remove image';
    del.addEventListener('click', async e => { e.stopPropagation(); await removeGalleryImageAt(globalIdx); });

    // Video icon on first thumb if day has video
    if (globalIdx === 0 && date) {
      const videoUrl = state.dayData[date]?.video;
      if (videoUrl) {
        const vi = document.createElement('span'); vi.className = 'gv2-thumb-video-icon'; vi.textContent = '▶';
        vi.style.pointerEvents = 'auto'; vi.style.cursor = 'pointer';
        vi.addEventListener('click', e => { e.stopPropagation(); window.open(videoUrl, '_blank'); });
        wrap.appendChild(vi);
      }
    }

    wrap.appendChild(t); wrap.appendChild(del); thumbs.appendChild(wrap);
  });
}

// Returns items for thumbnail tray: filtered or current date
function _getGalleryThumbImages() {
  const { images, tagFilter } = state.gallery;
  const filteredMode = Array.isArray(tagFilter) && tagFilter.length > 0;
  return (images || []).map((url, i) => ({
    url,
    globalIdx: i,
    isCurrentDate: !filteredMode,
    date: filteredMode ? '' : state.gallery.date
  }));
}

// Get tags assigned to a specific image URL
function _getTagsForImageUrl(url) {
  const tags = new Set();
  state.trades.forEach(trade => {
    if (!(trade.images || []).includes(url)) return;
    getImageTagsForUrl(trade, url).forEach(t => tags.add(t));
  });
  getMarqueeTagsForImage(url, '', null).forEach(t => tags.add(t));
  return Array.from(tags);
}

function getImageTagsForGalleryItem(item) {
  const tags = new Set();
  if (!item || !item.url) return [];
  if (item.sourceRow !== null && state.trades[item.sourceRow]) {
    getImageTagsForUrl(state.trades[item.sourceRow], item.url).forEach(t => tags.add(t));
  } else if (item.date) {
    getDayImageTagsForUrl(item.date, item.url).forEach(t => tags.add(t));
  }
  getMarqueeTagsForImage(item.url, item.date || '', item.sourceRow).forEach(t => tags.add(t));
  return Array.from(tags);
}

function getAllGalleryImagesAcrossDates() {
  const out = [];
  getDatesWithImages().forEach(d => {
    (state.dayData[d]?.images || []).forEach(url => {
      out.push({ url, date: d, sourceRow: null });
    });
    for (let i = 0; i < state.trades.length; i++) {
      const t = state.trades[i];
      if (normalizeDate(extractDateFromTrade(t)) !== d) continue;
      (t.images || []).forEach(url => out.push({ url, date: d, sourceRow: i }));
    }
  });
  return out;
}

function getFilteredGalleryImagesByTagSelection() {
  const tagFilter = Array.isArray(state.gallery.tagFilter) ? state.gallery.tagFilter : [];
  if (!tagFilter.length) return [];
  const mode = state.gallery.filterMode === 'and' ? 'and' : 'or';
  return getAllGalleryImagesAcrossDates().filter(item => {
    const arr = getImageTagsForGalleryItem(item);
    return mode === 'and'
      ? tagFilter.every(t => arr.includes(t))
      : tagFilter.some(t => arr.includes(t));
  });
}

function findGalleryContextByImageUrl(imageUrl) {
  if (!imageUrl) return { date: '', sourceRow: null };
  if (state.gallery._baseDate) {
    const baseRowIdx = state.trades.findIndex(t =>
      normalizeDate(extractDateFromTrade(t)) === state.gallery._baseDate &&
      Array.isArray(t.images) &&
      t.images.includes(imageUrl)
    );
    if (baseRowIdx >= 0) return { date: state.gallery._baseDate, sourceRow: baseRowIdx };
  }
  for (let i = 0; i < state.trades.length; i++) {
    const t = state.trades[i];
    if (Array.isArray(t.images) && t.images.includes(imageUrl)) {
      return { date: normalizeDate(extractDateFromTrade(t)), sourceRow: i };
    }
  }
  for (const [d, v] of Object.entries(state.dayData || {})) {
    if ((v?.images || []).includes(imageUrl)) return { date: d, sourceRow: null };
  }
  return { date: '', sourceRow: null };
}

function applyGalleryImageScopeByTagFilter(preserveUrl = '') {
  const preserve = (typeof preserveUrl === 'object' && preserveUrl)
    ? preserveUrl
    : { url: preserveUrl || '' };
  const filterActive = Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length > 0;
  let nextImages;
  let nextMeta = null;
  if (filterActive) {
    nextMeta = getFilteredGalleryImagesByTagSelection();
    nextImages = nextMeta.map(x => x.url);
  } else if (Array.isArray(state.gallery._baseImages) && state.gallery._baseImages.length) {
    nextImages = [...state.gallery._baseImages];
    state.gallery.date = state.gallery._baseDate || '';
    state.gallery.sourceRow = state.gallery._baseSourceRow ?? null;
  } else {
    nextImages = [...(state.gallery.images || [])];
  }

  state.gallery.images = nextImages;
  state.gallery._filteredMeta = nextMeta;
  if (!nextImages.length) {
    state.gallery.currentIndex = 0;
    return;
  }

  const keepUrl = preserve.url || '';
  let idx = -1;
  if (keepUrl && nextMeta && (preserve.date || preserve.sourceRow !== undefined)) {
    idx = nextMeta.findIndex(m =>
      m.url === keepUrl &&
      normalizeDate(m.date || '') === normalizeDate(preserve.date || '') &&
      (m.sourceRow ?? null) === (preserve.sourceRow ?? null)
    );
  }
  if (idx < 0 && keepUrl) idx = nextImages.indexOf(keepUrl);
  state.gallery.currentIndex = idx >= 0 ? idx : 0;

  const currentUrl = nextImages[state.gallery.currentIndex] || '';
  const ctx = (state.gallery._filteredMeta && state.gallery._filteredMeta[state.gallery.currentIndex])
    ? {
      date: state.gallery._filteredMeta[state.gallery.currentIndex].date || '',
      sourceRow: state.gallery._filteredMeta[state.gallery.currentIndex].sourceRow ?? null
    }
    : findGalleryContextByImageUrl(currentUrl);
  state.gallery.date = ctx.date || '';
  state.gallery.sourceRow = ctx.sourceRow;
}

function getCurrentGalleryPreserveContext() {
  const idx = Math.max(0, Math.min((state.gallery.images || []).length - 1, state.gallery.currentIndex || 0));
  const url = (state.gallery.images || [])[idx] || '';
  if (!url) return { url: '' };
  const meta = state.gallery._filteredMeta && state.gallery._filteredMeta[idx];
  if (meta && meta.url === url) {
    return {
      url,
      date: normalizeDate(meta.date || ''),
      sourceRow: meta.sourceRow ?? null
    };
  }
  const ctx = findGalleryContextByImageUrl(url);
  return { url, date: normalizeDate(ctx.date || ''), sourceRow: ctx.sourceRow ?? null };
}

function getOwnerTradeForImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (state.gallery.sourceRow !== null && state.trades[state.gallery.sourceRow]?.images?.includes(imageUrl)) {
    return state.trades[state.gallery.sourceRow];
  }
  if (state.gallery.date) {
    const row = getTradesForDate(state.gallery.date).find(t => (t.images || []).includes(imageUrl));
    if (row) return row;
    // Not in any trade — might be a day-level image; return null (handled separately)
    return null;
  }
  return state.trades.find(t => (t.images || []).includes(imageUrl)) || null;
}

function syncGalleryImageOrderToTrades() {
  const ordered = state.gallery.images || [];
  if (state.gallery.sourceRow !== null && state.trades[state.gallery.sourceRow]) {
    const t = state.trades[state.gallery.sourceRow];
    const own = new Set(t.images || []);
    t.images = ordered.filter(u => own.has(u));
    return;
  }
  if (state.gallery.date) {
    // Sync day-level images
    const dk = state.gallery.date;
    if (state.dayData[dk]?.images) {
      const dayOwn = new Set(state.dayData[dk].images);
      state.dayData[dk].images = ordered.filter(u => dayOwn.has(u));
    }
    // Sync trade-level images for this date
    const dayTrades = getTradesForDate(dk);
    dayTrades.forEach(t => {
      const own = new Set(t.images || []);
      t.images = ordered.filter(u => own.has(u));
    });
    return;
  }
  const trade = getOwnerTradeForGalleryImage();
  if (trade) {
    const own = new Set(trade.images || []);
    trade.images = ordered.filter(u => own.has(u));
  }
}

async function reorderGalleryImages(fromIdx, toIdx) {
  const arr = state.gallery.images || [];
  if (fromIdx < 0 || toIdx < 0 || fromIdx >= arr.length || toIdx >= arr.length) return;
  const currentUrl = arr[state.gallery.currentIndex];
  const [moved] = arr.splice(fromIdx, 1);
  arr.splice(toIdx, 0, moved);
  state.gallery.currentIndex = Math.max(0, arr.indexOf(currentUrl));
  syncGalleryImageOrderToTrades();
  await saveTrades();
  renderGallery();
  renderTable();
}

async function removeGalleryImageAt(idx) {
  const arr = state.gallery.images || [];
  if (idx < 0 || idx >= arr.length) return;
  const imageUrl = arr[idx];
  if (state._localOverlays?.[imageUrl]) delete state._localOverlays[imageUrl];
  const ownerTrade = getOwnerTradeForImageUrl(imageUrl);
  if (ownerTrade) {
    ownerTrade.images = (ownerTrade.images || []).filter(u => u !== imageUrl);
    if (ownerTrade.overlays && ownerTrade.overlays[imageUrl]) delete ownerTrade.overlays[imageUrl];
    if (ownerTrade.marqueeBoxes && ownerTrade.marqueeBoxes[imageUrl]) delete ownerTrade.marqueeBoxes[imageUrl];
    const store = ensureImageTagStore(ownerTrade);
    if (store[imageUrl]) delete store[imageUrl];
    cleanupImageTagStore(ownerTrade);
  } else if (state.gallery.date && state.dayData[state.gallery.date]?.images) {
    // Day-level image
    state.dayData[state.gallery.date].images = state.dayData[state.gallery.date].images.filter(u => u !== imageUrl);
    if (state.dayData[state.gallery.date]?.overlays?.[imageUrl]) {
      delete state.dayData[state.gallery.date].overlays[imageUrl];
    }
    if (state.dayData[state.gallery.date]?.marqueeBoxes?.[imageUrl]) {
      delete state.dayData[state.gallery.date].marqueeBoxes[imageUrl];
    }
  }
  arr.splice(idx, 1);
  if (state.gallery.currentIndex >= arr.length) state.gallery.currentIndex = Math.max(0, arr.length - 1);
  try {
    const filename = String(imageUrl || '').split('/').pop();
    await fetch('/api/delete-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
  } catch (e) { }
  if (!arr.length) {
    await saveTrades();
    renderTable();
    renderCalendar();
    document.getElementById('gallery-modal').classList.remove('open');
    unlockBodyScroll();
    showToast('Image removed', 'success');
    return;
  }
  syncGalleryImageOrderToTrades();
  await saveTrades();
  renderGallery();
  renderTable();
  renderCalendar();
  showToast('Image removed', 'success');
}

function loadOverlayForCurrentImage() {
  if (annotState.active) return; // annotation mode handles its own canvas
  const imgs = state.gallery.images || [];
  const imgUrl = imgs[state.gallery.currentIndex];
  const overlayUrl = state._localOverlays?.[imgUrl] || getOverlayUrlForImage(imgUrl, state.gallery.date || '');
  const packedBoxes = getMarqueeBoxesForImage(imgUrl, state.gallery.date || '', state.gallery.sourceRow);
  const canvas = document.getElementById('annot-canvas');
  const ctx = canvas.getContext('2d');
  const img = document.getElementById('gallery-img');
  const wrapper = document.getElementById('gallery-img-wrapper');
  if (!wrapper) return;

  // Position canvas exactly over the rendered image
  const left = img.offsetLeft;
  const top = img.offsetTop;
  const w = Math.round(img.clientWidth || img.naturalWidth || 0);
  const h = Math.round(img.clientHeight || img.naturalHeight || 0);
  if (w <= 0 || h <= 0) {
    canvas.style.display = 'none';
    return;
  }

  canvas.style.left = left + 'px';
  canvas.style.top = top + 'px';
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = w;
  canvas.height = h;
  canvas.style.pointerEvents = 'none'; // view-only, no drawing
  canvas.style.display = 'block';

  const boxes = unpackMarqueeBoxes(packedBoxes, w, h);
  const drawBoxes = () => {
    boxes.forEach(b => drawMarqueeBox(ctx, b, false));
  };

  // If nothing to show, hide canvas.
  if (!overlayUrl && !boxes.length) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.display = 'none';
    return;
  }

  if (overlayUrl) {
    const ovImg = new Image();
    ovImg.onload = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(ovImg, 0, 0, w, h);
      drawBoxes();
    };
    ovImg.onerror = () => {
      ctx.clearRect(0, 0, w, h);
      if (boxes.length) drawBoxes();
      else canvas.style.display = 'none';
    };
    ovImg.src = overlayUrl;
  } else {
    ctx.clearRect(0, 0, w, h);
    drawBoxes();
  }

  applyZoom();
}

function navigateGallery(dir) {
  const { images, currentIndex, date } = state.gallery;
  const next = currentIndex + dir;
  if (next >= 0 && next < images.length) {
    state.gallery.currentIndex = next; renderGallery();
  } else if (date) {
    // At boundary — auto-jump to adjacent date
    navigateGalleryDate(dir);
  }
}

function getGalleryDateScopeForFilter() {
  const imageDates = (state.gallery.images || []).map((url, idx) => {
    const meta = state.gallery._filteredMeta && state.gallery._filteredMeta[idx];
    if (meta && meta.url === url) return normalizeDate(meta.date || '');
    const ctx = findGalleryContextByImageUrl(url);
    return normalizeDate(ctx.date || '');
  });
  const byDate = new Map();
  imageDates.forEach((d, idx) => {
    if (!d) return;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(idx);
  });
  const dates = Array.from(byDate.keys()).sort();
  const curIdx = Math.max(0, Math.min((state.gallery.images || []).length - 1, state.gallery.currentIndex || 0));
  let currentDate = imageDates[curIdx] || '';
  if (!currentDate && dates.includes(state.gallery.date)) currentDate = state.gallery.date;
  if (!currentDate) currentDate = dates[0] || '';
  return { dates, byDate, currentDate, imageDates, currentIndex: curIdx };
}

function navigateGalleryDate(dir) {
  const filterActive = Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length > 0;
  if (filterActive) {
    const scope = getGalleryDateScopeForFilter();
    const total = (state.gallery.images || []).length;
    if (!total) return;
    let targetIndex = -1;
    // Prefer next image that belongs to a different date block.
    for (let i = scope.currentIndex + dir; i >= 0 && i < total; i += dir) {
      const d = scope.imageDates[i] || '';
      if (d && d !== scope.currentDate) { targetIndex = i; break; }
    }
    // If no different-date image exists, still move to next/prev image.
    if (targetIndex < 0) {
      const fallback = scope.currentIndex + dir;
      if (fallback >= 0 && fallback < total) targetIndex = fallback;
    }
    if (targetIndex >= 0) {
      state.gallery.currentIndex = targetIndex;
      const targetUrl = state.gallery.images[targetIndex] || '';
      const meta = state.gallery._filteredMeta && state.gallery._filteredMeta[targetIndex];
      if (meta && meta.url === targetUrl) {
        state.gallery.date = normalizeDate(meta.date || '');
        state.gallery.sourceRow = meta.sourceRow ?? null;
      } else {
        const ctx = findGalleryContextByImageUrl(targetUrl);
        state.gallery.date = normalizeDate(ctx.date || '');
        state.gallery.sourceRow = ctx.sourceRow ?? null;
      }
      state.gallery._skipFilterRescopeOnce = true;
      renderGallery(); updateGalleryDateArrows();
    }
    return;
  }

  const datesWithImages = getDatesWithImages();
  if (!datesWithImages.length) {
    const idxOnly = (state.gallery.currentIndex || 0) + dir;
    if (idxOnly >= 0 && idxOnly < (state.gallery.images || []).length) {
      state.gallery.currentIndex = idxOnly;
      renderGallery();
    }
    return;
  }

  const curDate = state.gallery.date;
  let idx = datesWithImages.indexOf(curDate);
  if (idx === -1) idx = dir > 0 ? -1 : datesWithImages.length;
  const nextIdx = idx + dir;
  if (nextIdx < 0 || nextIdx >= datesWithImages.length) {
    // No adjacent date: fallback to image movement within same date/gallery list.
    const nextImageIdx = (state.gallery.currentIndex || 0) + dir;
    if (nextImageIdx >= 0 && nextImageIdx < (state.gallery.images || []).length) {
      state.gallery.currentIndex = nextImageIdx;
      renderGallery();
    }
    return;
  }

  const nextDate = datesWithImages[nextIdx];
  const images = getImagesForDate(nextDate);
  if (images.length) {
    state.gallery.images = images;
    state.gallery.currentIndex = 0;
    state.gallery.date = nextDate;
    state.gallery.sourceRow = null;
    renderGallery(); updateGalleryDateArrows();
  }
}

function updateGalleryDateArrows() {
  const filterActive = Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length > 0;
  if (filterActive) {
    const total = (state.gallery.images || []).length;
    const idx = Math.max(0, Math.min(total - 1, state.gallery.currentIndex || 0));
    document.getElementById('gallery-date-prev').disabled = total <= 1 || idx <= 0;
    document.getElementById('gallery-date-next').disabled = total <= 1 || idx >= total - 1;
    return;
  }
  const datesWithImages = getDatesWithImages();
  const idx = datesWithImages.indexOf(state.gallery.date);
  const imgTotal = (state.gallery.images || []).length;
  const imgIdx = Math.max(0, Math.min(imgTotal - 1, state.gallery.currentIndex || 0));
  const hasPrevImage = imgTotal > 1 && imgIdx > 0;
  const hasNextImage = imgTotal > 1 && imgIdx < imgTotal - 1;
  const hasPrevDate = idx > 0;
  const hasNextDate = idx !== -1 && idx < datesWithImages.length - 1;
  document.getElementById('gallery-date-prev').disabled = !(hasPrevDate || hasPrevImage);
  document.getElementById('gallery-date-next').disabled = !(hasNextDate || hasNextImage);
}

// ── GALLERY V2: TAG CLOUD ────────────────────────────────────
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

// ── GALLERY V2: TAGS TRAY ─────────────────────────────────────
function renderGalleryTagsTray() {
  const body = document.getElementById('gv2-tags-tray-body');
  if (!body) return;
  body.innerHTML = '';

  const allTags = state.allTags || [];
  const imgInfo = getCurrentGalleryImageTagInfo();
  const imageAssignedSet = new Set(imgInfo.imageTags);
  const selectedMarqueeTagSet = getSelectedMarqueeTagSet();
  const marqueeMode = isMarqueeSelectionActive() && selectedMarqueeTagSet.size > 0;
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
      // Defensive fallback for legacy placements.
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

  const groupColor = (grpName) => {
    if (!grpName) return '';
    const palette = ['#58a6ff', '#2ea043', '#e3a22a', '#f78166', '#a371f7', '#ff7b72', '#56d4dd'];
    const h = String(grpName).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return palette[h % palette.length];
  };

  const createTagChip = (tag, grpName = '') => {
    const chip = document.createElement('span');
    chip.className = 'gv2-tt-tag-chip';
    const lbl = document.createElement('span');
    lbl.textContent = tag;
    const cnt = document.createElement('span');
    cnt.className = 'gv2-tt-tag-count';
    cnt.textContent = String(tagUsageCount.get(tag) || 0);
    chip.appendChild(lbl);
    chip.appendChild(cnt);
    const gc = groupColor(grpName);
    if (gc) {
      chip.style.borderColor = gc + '88';
      chip.style.color = gc;
      chip.style.background = gc + '1A';
    }
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

  // Grouped sections
  groupNames.forEach(grpName => {
    const grp = document.createElement('div');
    grp.className = 'gv2-tt-group';

    const hdr = document.createElement('div');
    hdr.className = 'gv2-tt-grp-hdr';
    const lbl = document.createElement('span');
    lbl.textContent = grpName;
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

  // Ungrouped section (always visible)
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

function getImagesForDate(dateStr) {
  const out = [];
  // Day-level images first
  (state.dayData[dateStr]?.images || []).forEach(url => out.push(url));
  getTradesForDate(dateStr).forEach(t => {
    (t.images || []).forEach(url => out.push(url));
  });
  return out;
}

function getTradeForDateByImage(dateStr, imageUrl) {
  return getTradesForDate(dateStr).find(t => t?.overlays && t.overlays[imageUrl]) || getTradeForDate(dateStr);
}

function getDatesWithImages() {
  const tradeDates = state.trades
    .filter(t => (t.images || []).length > 0)
    .map(t => normalizeDate(extractDateFromTrade(t)))
    .filter(Boolean);
  const dayDates = Object.entries(state.dayData)
    .filter(([, v]) => v?.images?.length > 0)
    .map(([k]) => k);
  return Array.from(new Set([...tradeDates, ...dayDates])).sort();
}

function getOwnerTradeForGalleryImage() {
  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  if (!imgUrl) return null;

  if (state.gallery.date) {
    const idx = state.trades.findIndex(t =>
      normalizeDate(extractDateFromTrade(t)) === state.gallery.date &&
      Array.isArray(t.images) &&
      t.images.includes(imgUrl)
    );
    if (idx >= 0) return state.trades[idx];
    return null; // day-level image
  }

  if (state.gallery.sourceRow !== null && state.trades[state.gallery.sourceRow]) {
    return state.trades[state.gallery.sourceRow];
  }

  return state.trades.find(t => Array.isArray(t.images) && t.images.includes(imgUrl)) || null;
}

function getMarqueeTagsForImage(imageUrl, dateHint = '', sourceRow = null) {
  if (!imageUrl) return [];
  const boxes = getMarqueeBoxesForImage(imageUrl, dateHint, sourceRow);
  const tags = new Set();
  (Array.isArray(boxes) ? boxes : []).forEach(b => {
    (Array.isArray(b?.tags) ? b.tags : []).forEach(t => {
      const x = String(t || '').trim();
      if (x) tags.add(x);
    });
  });
  return Array.from(tags);
}

function getCurrentGalleryImageTagInfo() {
  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  const trade = getOwnerTradeForGalleryImage();
  let ownerType = 'trade';
  let dateKey = '';
  let imageTags = getImageTagsForUrl(trade, imgUrl);
  if (!trade && imgUrl) {
    dateKey = normalizeDate(state.gallery.date || '');
    if (!dateKey || !(state.dayData[dateKey]?.images || []).includes(imgUrl)) {
      const fromMeta = state.gallery._filteredMeta && state.gallery._filteredMeta[state.gallery.currentIndex];
      dateKey = normalizeDate(fromMeta?.date || dateKey || '');
    }
    if (!dateKey) {
      for (const [d, v] of Object.entries(state.dayData || {})) {
        if ((v?.images || []).includes(imgUrl)) { dateKey = d; break; }
      }
    }
    if (dateKey) {
      ownerType = 'day';
      imageTags = getDayImageTagsForUrl(dateKey, imgUrl);
    }
  }
  const marqueeTags = getMarqueeTagsForImage(imgUrl, state.gallery.date || '', state.gallery.sourceRow);
  const all = Array.from(new Set([...imageTags, ...marqueeTags]));
  return { imgUrl, trade, ownerType, dateKey, imageTags, marqueeTags, all };
}

function getOverlayUrlForImage(imageUrl, dateHint = '') {
  if (!imageUrl) return '';
  if (dateHint) {
    const dayTrades = getTradesForDate(dateHint);
    for (const t of dayTrades) {
      if (t?.overlays && t.overlays[imageUrl]) return t.overlays[imageUrl];
    }
    const dayOverlays = state.dayData[dateHint]?.overlays;
    if (dayOverlays && dayOverlays[imageUrl]) return dayOverlays[imageUrl];
  }
  for (const t of state.trades) {
    if (t?.overlays && t.overlays[imageUrl]) return t.overlays[imageUrl];
  }
  for (const d of Object.values(state.dayData || {})) {
    if (d?.overlays && d.overlays[imageUrl]) return d.overlays[imageUrl];
  }
  return '';
}

function setOverlayUrlForCurrentGalleryImage(overlayUrl) {
  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  if (!imgUrl || !overlayUrl) return false;

  const trade = getOwnerTradeForGalleryImage();
  if (trade) {
    if (!trade.overlays) trade.overlays = {};
    trade.overlays[imgUrl] = overlayUrl;
    return true;
  }

  if (state.gallery.date) {
    if (!state.dayData[state.gallery.date]) state.dayData[state.gallery.date] = {};
    if (!state.dayData[state.gallery.date].overlays) state.dayData[state.gallery.date].overlays = {};
    state.dayData[state.gallery.date].overlays[imgUrl] = overlayUrl;
    return true;
  }

  return false;
}

function setOverlayUrlForImage(imageUrl, overlayUrl, dateHint = '', sourceRow = null) {
  if (!imageUrl || !overlayUrl) return false;
  if (sourceRow !== null && state.trades[sourceRow] && (state.trades[sourceRow].images || []).includes(imageUrl)) {
    const t = state.trades[sourceRow];
    if (!t.overlays) t.overlays = {};
    t.overlays[imageUrl] = overlayUrl;
    return true;
  }
  if (dateHint) {
    const row = getTradesForDate(dateHint).find(t => (t.images || []).includes(imageUrl));
    if (row) {
      if (!row.overlays) row.overlays = {};
      row.overlays[imageUrl] = overlayUrl;
      return true;
    }
    if (!state.dayData[dateHint]) state.dayData[dateHint] = {};
    if (!state.dayData[dateHint].overlays) state.dayData[dateHint].overlays = {};
    state.dayData[dateHint].overlays[imageUrl] = overlayUrl;
    return true;
  }
  const owner = state.trades.find(t => (t.images || []).includes(imageUrl));
  if (owner) {
    if (!owner.overlays) owner.overlays = {};
    owner.overlays[imageUrl] = overlayUrl;
    return true;
  }
  return false;
}

function getMarqueeBoxesForImage(imageUrl, dateHint = '', sourceRow = null) {
  if (!imageUrl) return [];
  if (sourceRow !== null && state.trades[sourceRow]?.marqueeBoxes?.[imageUrl]) {
    return JSON.parse(JSON.stringify(state.trades[sourceRow].marqueeBoxes[imageUrl]));
  }
  if (dateHint) {
    const row = getTradesForDate(dateHint).find(t => (t.images || []).includes(imageUrl) && t?.marqueeBoxes?.[imageUrl]);
    if (row?.marqueeBoxes?.[imageUrl]) return JSON.parse(JSON.stringify(row.marqueeBoxes[imageUrl]));
    const day = state.dayData[dateHint];
    if (day?.marqueeBoxes?.[imageUrl]) return JSON.parse(JSON.stringify(day.marqueeBoxes[imageUrl]));
  }
  const owner = state.trades.find(t => (t.images || []).includes(imageUrl) && t?.marqueeBoxes?.[imageUrl]);
  if (owner?.marqueeBoxes?.[imageUrl]) return JSON.parse(JSON.stringify(owner.marqueeBoxes[imageUrl]));
  return [];
}

function setMarqueeBoxesForImage(imageUrl, boxes, dateHint = '', sourceRow = null) {
  if (!imageUrl) return false;
  const safe = Array.isArray(boxes) ? JSON.parse(JSON.stringify(boxes)) : [];
  if (sourceRow !== null && state.trades[sourceRow] && (state.trades[sourceRow].images || []).includes(imageUrl)) {
    const t = state.trades[sourceRow];
    if (!t.marqueeBoxes) t.marqueeBoxes = {};
    t.marqueeBoxes[imageUrl] = safe;
    return true;
  }
  if (dateHint) {
    const row = getTradesForDate(dateHint).find(t => (t.images || []).includes(imageUrl));
    if (row) {
      if (!row.marqueeBoxes) row.marqueeBoxes = {};
      row.marqueeBoxes[imageUrl] = safe;
      return true;
    }
    if (!state.dayData[dateHint]) state.dayData[dateHint] = {};
    if (!state.dayData[dateHint].marqueeBoxes) state.dayData[dateHint].marqueeBoxes = {};
    state.dayData[dateHint].marqueeBoxes[imageUrl] = safe;
    return true;
  }
  const owner = state.trades.find(t => (t.images || []).includes(imageUrl));
  if (owner) {
    if (!owner.marqueeBoxes) owner.marqueeBoxes = {};
    owner.marqueeBoxes[imageUrl] = safe;
    return true;
  }
  return false;
}

function packMarqueeBoxes(boxes, canvasW, canvasH) {
  const w = Math.max(1, Number(canvasW) || 1);
  const h = Math.max(1, Number(canvasH) || 1);
  return (Array.isArray(boxes) ? boxes : []).map(b => ({
    rx: Math.max(0, Math.min(1, (Number(b.x) || 0) / w)),
    ry: Math.max(0, Math.min(1, (Number(b.y) || 0) / h)),
    rw: Math.max(0, Math.min(1, (Number(b.w) || 0) / w)),
    rh: Math.max(0, Math.min(1, (Number(b.h) || 0) / h)),
    tags: Array.isArray(b.tags) ? [...b.tags] : []
  }));
}

function unpackMarqueeBoxes(stored, canvasW, canvasH) {
  const w = Math.max(1, Number(canvasW) || 1);
  const h = Math.max(1, Number(canvasH) || 1);
  const out = (Array.isArray(stored) ? stored : []).map(b => {
    if (b && typeof b === 'object' && 'rx' in b && 'ry' in b && 'rw' in b && 'rh' in b) {
      return {
        x: Math.max(0, (Number(b.rx) || 0) * w),
        y: Math.max(0, (Number(b.ry) || 0) * h),
        w: Math.max(8, (Number(b.rw) || 0) * w),
        h: Math.max(8, (Number(b.rh) || 0) * h),
        tags: Array.isArray(b.tags) ? [...b.tags] : []
      };
    }
    // Backward compatibility: previously stored as absolute px
    return {
      x: Math.max(0, Number(b?.x) || 0),
      y: Math.max(0, Number(b?.y) || 0),
      w: Math.max(8, Number(b?.w) || 8),
      h: Math.max(8, Number(b?.h) || 8),
      tags: Array.isArray(b?.tags) ? [...b.tags] : []
    };
  });

  // Legacy absolute px migration: if boxes overflow current canvas a lot, scale them in.
  if (out.length) {
    const maxX = Math.max(...out.map(b => b.x + b.w));
    const maxY = Math.max(...out.map(b => b.y + b.h));
    if (maxX > w * 1.08 || maxY > h * 1.08) {
      const sx = w / Math.max(maxX, 1);
      const sy = h / Math.max(maxY, 1);
      out.forEach(b => {
        b.x *= sx; b.w *= sx;
        b.y *= sy; b.h *= sy;
        b.w = Math.max(8, b.w);
        b.h = Math.max(8, b.h);
      });
    }
  }
  return out;
}

function removeOverlayForImage(imageUrl, dateHint = '', sourceRow = null) {
  if (!imageUrl) return false;
  let changed = false;
  if (sourceRow !== null && state.trades[sourceRow]?.overlays?.[imageUrl]) {
    delete state.trades[sourceRow].overlays[imageUrl];
    changed = true;
  }
  if (dateHint) {
    getTradesForDate(dateHint).forEach(t => {
      if (t?.overlays?.[imageUrl]) {
        delete t.overlays[imageUrl];
        changed = true;
      }
    });
    if (state.dayData[dateHint]?.overlays?.[imageUrl]) {
      delete state.dayData[dateHint].overlays[imageUrl];
      changed = true;
    }
  } else {
    state.trades.forEach(t => {
      if (t?.overlays?.[imageUrl]) {
        delete t.overlays[imageUrl];
        changed = true;
      }
    });
    Object.values(state.dayData || {}).forEach(d => {
      if (d?.overlays?.[imageUrl]) {
        delete d.overlays[imageUrl];
        changed = true;
      }
    });
  }
  return changed;
}

function canvasHasVisibleInk(canvas) {
  if (!canvas || !canvas.width || !canvas.height) return false;
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) return true;
  }
  return false;
}

function autoSaveAnnotationSession(session) {
  if (!session || !session.imageUrl || !session.dirty || annotState.saving) return;
  annotState.saving = true;
  const { canvas, imageUrl, date, sourceRow } = session;
  const hasInk = canvasHasVisibleInk(canvas);

  if (!hasInk) {
    if (state._localOverlays?.[imageUrl]) delete state._localOverlays[imageUrl];
    const removed = removeOverlayForImage(imageUrl, date, sourceRow);
    if (removed) saveTrades();
    annotState.saving = false;
    return;
  }

  state._localOverlays[imageUrl] = canvas.toDataURL('image/png');

  canvas.toBlob(async blob => {
    if (!blob) { annotState.saving = false; return; }
    const fd = new FormData();
    fd.append('image', blob, 'overlay.png');
    try {
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.url) throw new Error();
      if (setOverlayUrlForImage(imageUrl, data.url, date, sourceRow)) {
        if (state._localOverlays?.[imageUrl]) delete state._localOverlays[imageUrl];
        await saveTrades();
      }
    } catch (e) { }
    annotState.saving = false;
  }, 'image/png');
}

function renderGalleryImageTags() {
  const box = document.getElementById('gallery-image-tags');
  if (!box) return;
  box.innerHTML = '';

  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  const info = getCurrentGalleryImageTagInfo();
  const tags = info.imageTags || [];
  const marqueeTags = info.marqueeTags || [];

  if (!tags.length && !marqueeTags.length) {
    const hint = document.createElement('span');
    hint.className = 'gallery-tag-empty';
    hint.textContent = 'No image/marquee tags';
    box.appendChild(hint);
    return;
  }

  if (tags.length) {
    const imgLbl = document.createElement('span');
    imgLbl.className = 'gallery-tag-empty';
    imgLbl.textContent = 'Image:';
    box.appendChild(imgLbl);
    tags.forEach(tag => {
      const c = tagColor(tag);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'gallery-img-tag-chip';
      chip.textContent = `${tag} x`;
      chip.style.color = c;
      chip.style.borderColor = hexToRgba(c, 0.45);
      chip.style.background = hexToRgba(c, 0.16);
      chip.title = 'Remove tag from this image';
      chip.addEventListener('click', async () => {
        const next = tags.filter(t => t !== tag);
        if (info.ownerType === 'trade' && info.trade) setImageTagsForUrl(info.trade, imgUrl, next);
        else if (info.ownerType === 'day' && info.dateKey) setDayImageTagsForUrl(info.dateKey, imgUrl, next);
        await saveTrades();
        renderGalleryImageTags();
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
      const chip = document.createElement('span');
      chip.className = 'gallery-img-tag-chip';
      chip.textContent = tag;
      chip.style.color = c;
      chip.style.borderColor = hexToRgba(c, 0.45);
      chip.style.background = hexToRgba(c, 0.12);
      chip.style.opacity = '0.9';
      box.appendChild(chip);
    });
  }
}

function getAllImageTagsGlobal() {
  const set = new Set();
  state.trades.forEach(t => getAllImageTagsForTrade(t).forEach(tag => set.add(tag)));
  Object.keys(state.dayData || {}).forEach(d => getAllImageTagsForDay(d).forEach(tag => set.add(tag)));
  IMAGE_PERMANENT_TAGS.forEach(t => set.add(t));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function isPermanentImageTag(tag) {
  const s = String(tag || '').trim().toLowerCase();
  return IMAGE_PERMANENT_TAGS.some(t => t.toLowerCase() === s);
}

function renameImageTagGlobal(oldTag, newTag) {
  state.trades.forEach(t => {
    const store = ensureImageTagStore(t);
    Object.keys(store).forEach(url => {
      const arr = Array.isArray(store[url]) ? store[url] : [];
      const next = arr.map(x => (x === oldTag ? newTag : x));
      store[url] = Array.from(new Set(next.filter(Boolean)));
      if (!store[url].length) delete store[url];
    });
    t[IMAGE_TAG_COLUMN] = getAllImageTagsForTrade(t).join(', ');
  });
  Object.keys(state.dayData || {}).forEach(d => {
    const store = ensureDayImageTagStore(d);
    Object.keys(store).forEach(url => {
      const arr = Array.isArray(store[url]) ? store[url] : [];
      const next = arr.map(x => (x === oldTag ? newTag : x));
      store[url] = Array.from(new Set(next.filter(Boolean)));
      if (!store[url].length) delete store[url];
    });
  });
}

function deleteImageTagGlobal(tagToDelete) {
  state.trades.forEach(t => {
    const store = ensureImageTagStore(t);
    Object.keys(store).forEach(url => {
      const arr = Array.isArray(store[url]) ? store[url] : [];
      const next = arr.filter(x => x !== tagToDelete);
      if (next.length) store[url] = next;
      else delete store[url];
    });
    t[IMAGE_TAG_COLUMN] = getAllImageTagsForTrade(t).join(', ');
  });
  Object.keys(state.dayData || {}).forEach(d => {
    const store = ensureDayImageTagStore(d);
    Object.keys(store).forEach(url => {
      const arr = Array.isArray(store[url]) ? store[url] : [];
      const next = arr.filter(x => x !== tagToDelete);
      if (next.length) store[url] = next;
      else delete store[url];
    });
  });
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
    const txt = document.createTextNode(tag);
    chk.addEventListener('change', async () => {
      const next = chk.checked ? [...assigned, tag] : assigned.filter(t => t !== tag);
      if (info.ownerType === 'trade' && trade) setImageTagsForUrl(trade, imgUrl, next);
      else if (info.ownerType === 'day' && info.dateKey) setDayImageTagsForUrl(info.dateKey, imgUrl, next);
      normalizeAllTagsFromTrades();
      await saveTrades();
      renderGalleryImageTags();
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
  else return;
  if (!state.allTags.includes(tag)) state.allTags.push(tag);
  normalizeAllTagsFromTrades();
  await saveTrades();
  renderGalleryImageTags();
  renderTagFilterPanel();
  renderTable();
  renderCalendar();
  inp.value = '';
  renderImageTagModal();
}

// â”€â”€ IMAGE ANNOTATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function toggleAnnotation() {
  // If currently in text mode, one click should switch back to drawing tools.
  if (annotState.active && annotState.tool === 'text') {
    commitActiveCanvasTextEditor();
    const textBar = document.getElementById('gv2-text-bar');
    if (textBar) textBar.style.display = 'none';
    document.getElementById('gv2-text-btn').classList.remove('active');
    const annotBar = document.getElementById('gv2-annot-bar');
    if (annotBar) annotBar.style.display = 'flex';
    document.getElementById('gv2-annotate-btn').classList.add('active');
    setAnnotTool('pen');
    return;
  }

  if (annotState.active) stopAnnotation();
  else {
    annotState.tool = 'pen';
    startAnnotation();
  }
}

function setAnnotTool(tool) {
  annotState.tool = tool;
  if (tool !== 'marquee') {
    annotState.multiSelectMode = false;
    annotState.selectedMarquees = [];
    annotState.marqueeSelectRect = null;
  }
  document.querySelectorAll('.annot-tool').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('annot-' + tool);
  if (btn) btn.classList.add('active');
  if (!annotState.active) return;
  const textBar = document.getElementById('gv2-text-bar');
  const mqBar = document.getElementById('gv2-marquee-bar');
  if (textBar) textBar.style.display = tool === 'text' ? 'flex' : 'none';
  if (mqBar) mqBar.style.display = tool === 'marquee' ? 'flex' : 'none';
  const canvas = document.getElementById('annot-canvas');
  const brushCursor = ensureAnnotBrushCursor();
  if (canvas) canvas.style.cursor = shouldUseBrushCursor() ? 'none' : 'crosshair';
  if (brushCursor) brushCursor.style.display = shouldUseBrushCursor() ? 'block' : 'none';
  updateAnnotBrushCursorVisual();
  if (tool === 'marquee') {
    if (canvas) {
      const ctx = canvas.getContext('2d');
      // Always refresh base from current canvas so switching from brush preserves latest strokes.
      annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
      renderMarqueeScene(ctx);
    }
  }
  updateMarqueeMultiSelectButton();
}

function updateMarqueeMultiSelectButton() {
  const btn = document.getElementById('annot-vselect');
  if (!btn) return;
  const active = annotState.tool === 'marquee' && annotState.multiSelectMode;
  btn.classList.toggle('active', active);
}

function toggleMarqueeGroupSelect(forceState = null) {
  if (!annotState.active) startAnnotation();
  setAnnotTool('marquee');
  annotState.multiSelectMode = typeof forceState === 'boolean' ? forceState : !annotState.multiSelectMode;
  if (!annotState.multiSelectMode) annotState.marqueeSelectRect = null;
  updateMarqueeMultiSelectButton();
  const canvas = document.getElementById('annot-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx && annotState.active && annotState.tool === 'marquee') renderMarqueeScene(ctx);
  }
  showToast(annotState.multiSelectMode ? 'Marquee group select ON (drag to select)' : 'Marquee group select OFF', 'success');
}

function updateAnnotToolIcons() {
  const marker = document.getElementById('annot-highlight');
  if (marker) marker.innerHTML = '&#9670;';
}

function adjustAnnotSize(delta) {
  const inp = document.getElementById('annot-size');
  if (!inp) return;
  const min = parseInt(inp.min || '1', 10);
  const max = parseInt(inp.max || '30', 10);
  const next = Math.max(min, Math.min(max, (parseInt(inp.value, 10) || annotState.size || 3) + delta));
  inp.value = String(next);
  annotState.size = next;
  const lbl = document.getElementById('annot-size-label');
  if (lbl) lbl.textContent = next + 'px';
  updateAnnotToolIcons();
  updateAnnotBrushCursorVisual();
}

function ensureAnnotBrushCursor() {
  const wrapper = document.getElementById('gallery-img-wrapper');
  if (!wrapper) return null;
  let el = document.getElementById('annot-brush-cursor');
  if (!el) {
    el = document.createElement('div');
    el.id = 'annot-brush-cursor';
    el.className = 'annot-brush-cursor';
    wrapper.appendChild(el);
  }
  return el;
}

function updateAnnotBrushCursorVisual() {
  const el = ensureAnnotBrushCursor();
  if (!el) return;
  const s = Math.max(10, Math.min(80, (annotState.size || 3) * 4));
  el.style.width = s + 'px';
  el.style.height = s + 'px';
}

function shouldUseBrushCursor() {
  return annotState.active && (annotState.tool === 'pen' || annotState.tool === 'eraser');
}

function commitActiveCanvasTextEditor() {
  const editor = document.querySelector('#gallery-img-wrapper .canvas-text-editor');
  if (editor) editor.blur();
}

function drawMarqueeBox(ctx, box, selected = false) {
  if (!box) return;
  const x = Math.round(box.x), y = Math.round(box.y), w = Math.round(box.w), h = Math.round(box.h);
  if (w < 4 || h < 4) return;
  const baseColor = box.color || '#2ea043';
  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = selected ? 2.5 : 2;
  ctx.strokeStyle = baseColor;
  ctx.fillStyle = selected ? (baseColor + '33') : (baseColor + '1A');
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  if (selected) {
    const hs = 8;
    ctx.fillStyle = '#58a6ff';
    ctx.fillRect(x + w - hs / 2, y + h - hs / 2, hs, hs);
    const dx = x + w - 2;
    const dy = y - 2;
    ctx.fillStyle = 'rgba(190,26,48,0.95)';
    ctx.beginPath();
    ctx.arc(dx, dy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(dx - 4, dy - 4);
    ctx.lineTo(dx + 4, dy + 4);
    ctx.moveTo(dx + 4, dy - 4);
    ctx.lineTo(dx - 4, dy + 4);
    ctx.stroke();
  }
  ctx.restore();

  const tags = Array.isArray(box.tags) ? box.tags : [];
  if (!tags.length) return;
  const label = tags.join(', ');
  ctx.save();
  ctx.font = '12px Arial';
  ctx.textBaseline = 'top';
  const padX = 6, padY = 3, lineH = 14;
  const maxW = Math.max(64, Math.min(ctx.canvas.width - x - 4, w));
  const words = label.split(',').map(s => s.trim()).filter(Boolean);
  const lines = [];
  let cur = '';
  words.forEach(part => {
    const candidate = cur ? `${cur}, ${part}` : part;
    if (ctx.measureText(candidate).width + padX * 2 <= maxW) cur = candidate;
    else {
      if (cur) lines.push(cur);
      cur = part;
    }
  });
  if (cur) lines.push(cur);
  const safeLines = lines.slice(0, 3);
  if (lines.length > 3) safeLines[2] = safeLines[2] + '...';
  const tw = safeLines.length ? Math.max(...safeLines.map(s => Math.ceil(ctx.measureText(s).width))) : 0;
  const lw = Math.min(maxW, tw + padX * 2);
  const lh = safeLines.length * lineH + padY * 2;
  const lx = Math.max(2, Math.min(x, ctx.canvas.width - lw - 2));
  let ly = y + h + 4;
  if (ly + lh > ctx.canvas.height - 2) ly = Math.max(2, y - lh - 4);
  ctx.fillStyle = 'rgba(15,23,35,0.88)';
  ctx.fillRect(lx, ly, lw, lh);
  ctx.fillStyle = '#dbe7ff';
  safeLines.forEach((line, i) => ctx.fillText(line, lx + padX, ly + padY + i * lineH));
  ctx.restore();
}

function hitTestMarquee(x, y) {
  for (let i = annotState.marqueeBoxes.length - 1; i >= 0; i--) {
    const b = annotState.marqueeBoxes[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return i;
  }
  return -1;
}

function hitTestMarqueeResizeHandle(box, x, y) {
  if (!box) return false;
  const hs = 12;
  const hx = box.x + box.w;
  const hy = box.y + box.h;
  return Math.abs(x - hx) <= hs && Math.abs(y - hy) <= hs;
}

function hitTestMarqueeDeleteHandle(box, x, y) {
  if (!box) return false;
  const dx = box.x + box.w - 2;
  const dy = box.y - 2;
  return ((x - dx) * (x - dx) + (y - dy) * (y - dy)) <= 11 * 11;
}

function getSelectedMarqueeIndexes() {
  const len = annotState.marqueeBoxes.length;
  const set = new Set((annotState.selectedMarquees || []).filter(i => Number.isInteger(i) && i >= 0 && i < len));
  if (annotState.selectedMarquee >= 0 && annotState.selectedMarquee < len) set.add(annotState.selectedMarquee);
  return Array.from(set).sort((a, b) => a - b);
}

function getSelectedMarqueeTagSet() {
  const tags = new Set();
  const idxs = getSelectedMarqueeIndexes();
  idxs.forEach(i => {
    const box = annotState.marqueeBoxes[i];
    (Array.isArray(box?.tags) ? box.tags : []).forEach(t => {
      const x = String(t || '').trim();
      if (x) tags.add(x);
    });
  });
  return tags;
}

function isMarqueeSelectionActive() {
  return !!(annotState.active && annotState.tool === 'marquee' && getSelectedMarqueeIndexes().length);
}

function syncMarqueeBoxesShadow() {
  if (!state._marqueeBoxes) state._marqueeBoxes = {};
  state._marqueeBoxes[annotState.imageUrl] = JSON.parse(JSON.stringify(annotState.marqueeBoxes || []));
}

function refreshGalleryTagsTrayIfVisible() {
  const tray = document.getElementById('gv2-tags-tray');
  if (tray && tray.style.display !== 'none') renderGalleryTagsTray();
}

function toggleTagOnSelectedMarquees(tag) {
  const t = String(tag || '').trim();
  if (!t || !isMarqueeSelectionActive()) return false;
  const idxs = getSelectedMarqueeIndexes();
  const selectedTagSet = getSelectedMarqueeTagSet();
  const shouldAdd = !selectedTagSet.has(t);
  idxs.forEach(i => {
    const box = annotState.marqueeBoxes[i];
    if (!box) return;
    const arr = Array.isArray(box.tags) ? box.tags.slice() : [];
    const set = new Set(arr.map(x => String(x || '').trim()).filter(Boolean));
    if (shouldAdd) set.add(t); else set.delete(t);
    box.tags = Array.from(set);
  });
  annotState.dirty = true;
  syncMarqueeBoxesShadow();
  const canvas = document.getElementById('annot-canvas');
  const ctx = canvas?.getContext('2d');
  if (ctx && annotState.active && annotState.tool === 'marquee') renderMarqueeScene(ctx);
  refreshMarqueeTagSuggestions();
  return true;
}

function setSingleMarqueeSelection(idx) {
  if (idx < 0 || idx >= annotState.marqueeBoxes.length) {
    annotState.selectedMarquee = -1;
    annotState.selectedMarquees = [];
    refreshGalleryTagsTrayIfVisible();
    return;
  }
  annotState.selectedMarquee = idx;
  annotState.selectedMarquees = [idx];
  refreshGalleryTagsTrayIfVisible();
}

function rectsIntersect(a, b) {
  return a.x < (b.x + b.w) && (a.x + a.w) > b.x && a.y < (b.y + b.h) && (a.y + a.h) > b.y;
}

function renderMarqueeScene(ctx, previewBox = null, selectRect = null) {
  if (annotState.marqueeRasterBase) ctx.putImageData(annotState.marqueeRasterBase, 0, 0);
  const selectedSet = new Set(getSelectedMarqueeIndexes());
  annotState.marqueeBoxes.forEach((b, i) => drawMarqueeBox(ctx, b, selectedSet.has(i)));
  if (previewBox) drawMarqueeBox(ctx, previewBox, true);
  if (selectRect && selectRect.w >= 2 && selectRect.h >= 2) {
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#58a6ff';
    ctx.fillStyle = 'rgba(88,166,255,0.12)';
    ctx.fillRect(selectRect.x, selectRect.y, selectRect.w, selectRect.h);
    ctx.strokeRect(selectRect.x, selectRect.y, selectRect.w, selectRect.h);
    ctx.restore();
  }
}

async function rebindCurrentImageOverlayToMarquee(ctx, canvas) {
  if (!annotState.active || !annotState.imageUrl || !ctx || !canvas) return false;

  const removed = removeOverlayForImage(annotState.imageUrl, annotState.date, annotState.sourceRow);
  if (state._localOverlays?.[annotState.imageUrl]) delete state._localOverlays[annotState.imageUrl];

  // Detach flattened overlay and keep only editable marquee layer.
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
  renderMarqueeScene(ctx);

  // Prevent old flattened pixels from autosaving back.
  annotState.dirty = false;

  if (removed) {
    await saveTrades();
    showToast('Overlay rebind complete: editable marquee active', 'success');
  } else {
    showToast('No frozen overlay found. Marquee is already editable', 'success');
  }
  return removed;
}

function refreshMarqueeTagSuggestions() {
  const dl = document.getElementById('gv2-mq-tag-suggestions');
  if (!dl) return;
  const tags = Array.from(new Set((state.allTags || []).map(t => String(t || '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b));
  dl.innerHTML = '';
  tags.forEach(tag => {
    const o = document.createElement('option');
    o.value = tag;
    dl.appendChild(o);
  });
}

function addTagToSelectedMarqueeBox(rawTag) {
  const idx = annotState.selectedMarquee;
  const tag = String(rawTag || '').trim();
  if (!annotState.active || annotState.tool !== 'marquee' || idx < 0 || !tag) return false;
  const canvas = document.getElementById('annot-canvas');
  if (!canvas) return false;
  const box = annotState.marqueeBoxes[idx];
  if (!box) return false;
  if (!box.tags) box.tags = [];
  if (!box.tags.includes(tag)) box.tags.push(tag);
  const ctx = canvas.getContext('2d');
  if (!annotState.marqueeRasterBase) annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
  renderMarqueeScene(ctx);
  annotState.dirty = true;
  if (!state._marqueeBoxes) state._marqueeBoxes = {};
  state._marqueeBoxes[annotState.imageUrl] = JSON.parse(JSON.stringify(annotState.marqueeBoxes));
  if (!state.allTags.includes(tag)) {
    state.allTags.push(tag);
    refreshMarqueeTagSuggestions();
  }
  renderGalleryTagCloud();
  return true;
}

function startAnnotation() {
  const img = document.getElementById('gallery-img');
  const wrapper = document.getElementById('gallery-img-wrapper');
  const canvas = document.getElementById('annot-canvas');
  const toolbar = document.getElementById('gv2-annot-bar'); // V2: floating bar

  // Size canvas to match current rendered image
  const left = img.offsetLeft;
  const top = img.offsetTop;
  const w = Math.round(img.clientWidth || img.naturalWidth || 0);
  const h = Math.round(img.clientHeight || img.naturalHeight || 0);
  if (w <= 0 || h <= 0) return;

  canvas.style.left = left + 'px';
  canvas.style.top = top + 'px';
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = w;
  canvas.height = h;
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  // Load existing overlay for this image if any
  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  annotState.imageUrl = imgUrl || '';
  annotState.date = state.gallery.date || '';
  annotState.sourceRow = state.gallery.sourceRow;
  annotState.dirty = false;
  if (!state._marqueeBoxes) state._marqueeBoxes = {};
  const persistedBoxes = getMarqueeBoxesForImage(annotState.imageUrl, annotState.date, annotState.sourceRow);
  annotState.marqueeBoxes = persistedBoxes.length
    ? unpackMarqueeBoxes(persistedBoxes, canvas.width, canvas.height)
    : (Array.isArray(state._marqueeBoxes[annotState.imageUrl])
      ? JSON.parse(JSON.stringify(state._marqueeBoxes[annotState.imageUrl]))
      : []);
  annotState.selectedMarquee = -1;
  annotState.selectedMarquees = [];
  annotState.multiSelectMode = false;
  annotState.marqueePreview = null;
  annotState.marqueeRasterBase = null;
  annotState.marqueeDragMode = '';
  annotState.marqueeDragOrig = null;
  annotState.marqueeSelectRect = null;
  annotState.marqueeDragGroupOrig = [];
  const hasLegacy = persistedBoxes.some(b => !(b && typeof b === 'object' && 'rx' in b && 'ry' in b && 'rw' in b && 'rh' in b));
  if (hasLegacy && annotState.imageUrl) {
    const packedNow = packMarqueeBoxes(annotState.marqueeBoxes, canvas.width, canvas.height);
    setMarqueeBoxesForImage(annotState.imageUrl, packedNow, annotState.date, annotState.sourceRow);
    saveTrades();
  }
  const overlayUrl = getOverlayUrlForImage(imgUrl, state.gallery.date || '');
  if (overlayUrl) {
    const ovImg = new Image();
    ovImg.onload = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(ovImg, 0, 0, w, h);
      if (annotState.marqueeBoxes.length) {
        annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
        renderMarqueeScene(ctx);
      }
    };
    ovImg.src = overlayUrl;
  } else if (annotState.marqueeBoxes.length) {
    annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
    renderMarqueeScene(ctx);
  }

  annotState.active = true;
  annotState.history = [];

  // Show annotation bar or text bar based on tool
  if (annotState.tool === 'text') {
    const annotBar = document.getElementById('gv2-annot-bar');
    if (annotBar) annotBar.style.display = 'none';
    document.getElementById('gv2-annotate-btn').classList.remove('active');
    const textBar = document.getElementById('gv2-text-bar');
    if (textBar) textBar.style.display = 'flex';
    document.getElementById('gv2-text-btn').classList.add('active');
  } else {
    const textBar = document.getElementById('gv2-text-bar');
    if (textBar) textBar.style.display = 'none';
    document.getElementById('gv2-text-btn').classList.remove('active');
    // Show annotation bar (new V2 floating bar)
    const annotBar = document.getElementById('gv2-annot-bar');
    if (annotBar) annotBar.style.display = 'flex';
    document.getElementById('gv2-annotate-btn').classList.add('active');
    // Preserve active tool after reopen; prefer marquee when marquee boxes exist.
    const preferredTool = annotState.marqueeBoxes.length ? 'marquee' : (annotState.tool || 'pen');
    setAnnotTool(preferredTool);
  }
  const mqBar = document.getElementById('gv2-marquee-bar');
  if (mqBar) mqBar.style.display = annotState.tool === 'marquee' ? 'flex' : 'none';
  updateMarqueeMultiSelectButton();

  // Enable drawing on canvas, disable zoom/pan on image
  canvas.style.pointerEvents = 'auto';
  canvas.style.cursor = shouldUseBrushCursor() ? 'none' : 'crosshair';
  applyZoom();
  const brushCursor = ensureAnnotBrushCursor();
  if (brushCursor) brushCursor.style.display = shouldUseBrushCursor() ? 'block' : 'none';
  updateAnnotBrushCursorVisual();
  document.getElementById('gallery-img').style.pointerEvents = 'none';
}

function stopAnnotation() {
  const _bc = document.getElementById('annot-brush-cursor');
  if (_bc) _bc.style.display = 'none';
  const _m = document.getElementById('mq-context-menu');
  if (_m) _m.style.display = 'none';
  commitActiveCanvasTextEditor();
  const canvas = document.getElementById('annot-canvas');
  const session = {
    canvas,
    imageUrl: annotState.imageUrl,
    date: annotState.date,
    sourceRow: annotState.sourceRow,
    dirty: !!annotState.dirty
  };
  autoSaveAnnotationSession(session);
  const annotBar = document.getElementById('gv2-annot-bar');
  if (annotBar) annotBar.style.display = 'none';
  const textBar = document.getElementById('gv2-text-bar');
  if (textBar) textBar.style.display = 'none';
  const mqBar = document.getElementById('gv2-marquee-bar');
  if (mqBar) mqBar.style.display = 'none';

  document.getElementById('gv2-annotate-btn').classList.remove('active');
  document.getElementById('gv2-text-btn').classList.remove('active');
  document.getElementById('gallery-img').style.pointerEvents = '';
  annotState.textEditorActive = false;
  if (!state._marqueeBoxes) state._marqueeBoxes = {};
  if (annotState.imageUrl) {
    state._marqueeBoxes[annotState.imageUrl] = JSON.parse(JSON.stringify(annotState.marqueeBoxes || []));
    const packed = packMarqueeBoxes(annotState.marqueeBoxes || [], canvas?.width || 1, canvas?.height || 1);
    setMarqueeBoxesForImage(annotState.imageUrl, packed, annotState.date, annotState.sourceRow);
    if (session.dirty) saveTrades();
  }
  annotState.imageUrl = '';
  annotState.date = '';
  annotState.sourceRow = null;
  annotState.dirty = false;
  annotState.marqueeBoxes = [];
  annotState.selectedMarquee = -1;
  annotState.selectedMarquees = [];
  annotState.multiSelectMode = false;
  annotState.marqueePreview = null;
  annotState.marqueeRasterBase = null;
  annotState.marqueeDragMode = '';
  annotState.marqueeDragOrig = null;
  annotState.marqueeSelectRect = null;
  annotState.marqueeDragGroupOrig = [];
  annotState.active = false;
  annotState.history = [];
  updateMarqueeMultiSelectButton();
  loadOverlayForCurrentImage();
}

function bindAnnotationCanvas() {
  const canvas = document.getElementById('annot-canvas');
  const wrapper = document.getElementById('gallery-img-wrapper');
  let mqCtxMenu = null;
  let mqCtxIdx = -1;

  function persistMarqueeBoxesToState() {
    if (!state._marqueeBoxes) state._marqueeBoxes = {};
    state._marqueeBoxes[annotState.imageUrl] = JSON.parse(JSON.stringify(annotState.marqueeBoxes || []));
  }

  function hideMarqueeContextMenu() {
    if (mqCtxMenu) mqCtxMenu.style.display = 'none';
    mqCtxIdx = -1;
  }

  function ensureMarqueeContextMenu() {
    if (mqCtxMenu) return mqCtxMenu;
    mqCtxMenu = document.createElement('div');
    mqCtxMenu.id = 'mq-context-menu';
    mqCtxMenu.style.position = 'fixed';
    mqCtxMenu.style.zIndex = '99999';
    mqCtxMenu.style.minWidth = '160px';
    mqCtxMenu.style.background = 'var(--surface)';
    mqCtxMenu.style.border = '1px solid var(--border2)';
    mqCtxMenu.style.borderRadius = '8px';
    mqCtxMenu.style.boxShadow = '0 8px 30px rgba(0,0,0,0.45)';
    mqCtxMenu.style.padding = '8px';
    mqCtxMenu.style.display = 'none';
    mqCtxMenu.innerHTML = `
      <button type="button" id="mq-ctx-del" class="gv2-ab-btn" style="width:100%;justify-content:flex-start">Delete Marquee</button>
      <button type="button" id="mq-ctx-dup" class="gv2-ab-btn" style="width:100%;justify-content:flex-start">Duplicate</button>
      <button type="button" id="mq-ctx-rebind" class="gv2-ab-btn" style="width:100%;justify-content:flex-start">Rebind</button>
      <div style="font-size:0.68rem;color:var(--text3);margin:8px 2px 4px">Marquee Color</div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button type="button" class="mq-ctx-color" data-color="#2ea043" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border2);background:#2ea043;cursor:pointer"></button>
        <button type="button" class="mq-ctx-color" data-color="#58a6ff" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border2);background:#58a6ff;cursor:pointer"></button>
        <button type="button" class="mq-ctx-color" data-color="#f85149" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border2);background:#f85149;cursor:pointer"></button>
      </div>
      <button type="button" id="mq-ctx-close-tool" class="gv2-ab-btn" style="width:100%;justify-content:flex-start">Close Tool</button>
    `;
    document.body.appendChild(mqCtxMenu);

    mqCtxMenu.querySelector('#mq-ctx-del').addEventListener('click', () => {
      const targets = getSelectedMarqueeIndexes().includes(mqCtxIdx) ? getSelectedMarqueeIndexes() : [mqCtxIdx];
      if (!targets.length) return;
      [...targets].sort((a, b) => b - a).forEach(i => {
        if (i >= 0 && i < annotState.marqueeBoxes.length) annotState.marqueeBoxes.splice(i, 1);
      });
      annotState.selectedMarquees = [];
      annotState.selectedMarquee = Math.min(mqCtxIdx, annotState.marqueeBoxes.length - 1);
      const ctx = canvas.getContext('2d');
      if (!annotState.marqueeRasterBase) annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
      renderMarqueeScene(ctx);
      annotState.dirty = true;
      persistMarqueeBoxesToState();
      hideMarqueeContextMenu();
    });

    mqCtxMenu.querySelector('#mq-ctx-dup').addEventListener('click', () => {
      const targets = getSelectedMarqueeIndexes().includes(mqCtxIdx) ? getSelectedMarqueeIndexes() : [mqCtxIdx];
      if (!targets.length) return;
      const newIndexes = [];
      targets.forEach(i => {
        const src = annotState.marqueeBoxes[i];
        if (!src) return;
        const copy = {
          ...JSON.parse(JSON.stringify(src)),
          x: Math.max(0, Math.min(canvas.width - src.w, src.x + 16)),
          y: Math.max(0, Math.min(canvas.height - src.h, src.y + 16))
        };
        annotState.marqueeBoxes.push(copy);
        newIndexes.push(annotState.marqueeBoxes.length - 1);
      });
      annotState.selectedMarquees = newIndexes;
      annotState.selectedMarquee = newIndexes.length ? newIndexes[newIndexes.length - 1] : -1;
      const ctx = canvas.getContext('2d');
      if (!annotState.marqueeRasterBase) annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
      renderMarqueeScene(ctx);
      annotState.dirty = true;
      persistMarqueeBoxesToState();
      hideMarqueeContextMenu();
    });

    mqCtxMenu.querySelector('#mq-ctx-rebind').addEventListener('click', async () => {
      const ctx = canvas.getContext('2d');
      await rebindCurrentImageOverlayToMarquee(ctx, canvas);
      hideMarqueeContextMenu();
    });

    mqCtxMenu.querySelectorAll('.mq-ctx-color').forEach(btn => {
      btn.addEventListener('click', () => {
        const targets = getSelectedMarqueeIndexes().includes(mqCtxIdx) ? getSelectedMarqueeIndexes() : [mqCtxIdx];
        if (!targets.length) return;
        targets.forEach(i => {
          if (i >= 0 && i < annotState.marqueeBoxes.length) annotState.marqueeBoxes[i].color = btn.dataset.color;
        });
        const ctx = canvas.getContext('2d');
        if (!annotState.marqueeRasterBase) annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
        renderMarqueeScene(ctx);
        annotState.dirty = true;
        persistMarqueeBoxesToState();
        hideMarqueeContextMenu();
      });
    });

    mqCtxMenu.querySelector('#mq-ctx-close-tool').addEventListener('click', () => {
      setAnnotTool('pen');
      hideMarqueeContextMenu();
    });

    document.addEventListener('click', e => {
      if (!mqCtxMenu || mqCtxMenu.style.display === 'none') return;
      if (!mqCtxMenu.contains(e.target)) hideMarqueeContextMenu();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') hideMarqueeContextMenu();
    });

    return mqCtxMenu;
  }

  function showMarqueeContextMenu(clientX, clientY, idx) {
    const menu = ensureMarqueeContextMenu();
    mqCtxIdx = idx;
    menu.style.display = 'block';
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = menu.getBoundingClientRect();
    menu.style.left = Math.max(6, Math.min(clientX, vw - rect.width - 6)) + 'px';
    menu.style.top = Math.max(6, Math.min(clientY, vh - rect.height - 6)) + 'px';
  }

  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    const sx = canvas.width / Math.max(1, r.width);
    const sy = canvas.height / Math.max(1, r.height);
    return {
      x: (src.clientX - r.left) * sx,
      y: (src.clientY - r.top) * sy
    };
  }

  function createTextEditor(e) {
    if (annotState.textEditorActive) return;
    annotState.textEditorActive = true;

    const ctx = canvas.getContext('2d');
    annotState.history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (annotState.history.length > 40) annotState.history.shift();

    const pos = getPos(e);
    const textarea = document.createElement('textarea');
    textarea.className = 'canvas-text-editor';
    const alignBtn = document.getElementById('gv2-tb-align');
    let align = 'left';
    if (alignBtn.classList.contains('align-center')) align = 'center';
    else if (alignBtn.classList.contains('align-right')) align = 'right';

    // Remove zoom so sizing works exactly as expected
    const scale = zoom.scale || 1;

    textarea.style.position = 'absolute';
    textarea.style.left = pos.x + 'px';
    textarea.style.top = pos.y + 'px';
    textarea.style.color = document.getElementById('gv2-tb-color').value;
    textarea.style.fontSize = document.getElementById('gv2-tb-size').value + 'px';
    textarea.style.fontFamily = document.getElementById('gv2-tb-font').value;
    textarea.style.fontWeight = document.getElementById('gv2-tb-bold').classList.contains('active') ? 'bold' : 'normal';
    textarea.style.fontStyle = document.getElementById('gv2-tb-italic').classList.contains('active') ? 'italic' : 'normal';
    textarea.style.textAlign = align;
    textarea.style.background = 'transparent';
    textarea.style.border = '1px dashed #ccc';
    textarea.style.outline = 'none';
    textarea.style.padding = '0';
    textarea.style.margin = '0';
    textarea.style.overflow = 'hidden';
    textarea.style.resize = 'none';
    textarea.style.zIndex = '1000';
    textarea.rows = 1;
    textarea.style.minWidth = '50px';
    textarea.style.lineHeight = '1.2';
    // Match transform origin and scale if image is zoomed
    textarea.style.transform = `scale(${1 / scale})`;
    textarea.style.transformOrigin = 'top left';

    textarea.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
      this.style.width = Math.max(50, this.scrollWidth) + 'px';
    });

    textarea.addEventListener('blur', function () {
      const text = this.value;
      if (text.trim()) {
        annotState.dirty = true;
        ctx.textBaseline = 'top';
        ctx.textAlign = align;
        ctx.fillStyle = this.style.color;
        ctx.font = `${this.style.fontStyle} ${this.style.fontWeight} ${this.style.fontSize} ${this.style.fontFamily}`;

        const lines = text.split('\n');
        const lineHeight = parseInt(this.style.fontSize) * 1.2;
        let startX = pos.x;
        if (align === 'center') startX += this.clientWidth / 2;
        else if (align === 'right') startX += this.clientWidth;

        lines.forEach((line, i) => {
          ctx.fillText(line, startX, pos.y + (i * lineHeight));
        });
      } else {
        annotState.history.pop();
      }
      this.remove();
      setTimeout(() => annotState.textEditorActive = false, 100);
    });

    textarea.addEventListener('keydown', function (evt) {
      if (evt.key === 'Escape') this.blur();
    });

    document.getElementById('gallery-img-wrapper').appendChild(textarea);
    setTimeout(() => { textarea.focus(); }, 10);
  }

  function startDraw(e) {
    if (!annotState.active) return;
    if (e.target.tagName !== 'CANVAS') return;
    e.preventDefault();

    if (annotState.tool === 'text') {
      createTextEditor(e);
      return;
    }

    if (annotState.tool === 'marquee') {
      const ctx = canvas.getContext('2d');
      const pos = getPos(e);
      if (!annotState.marqueeRasterBase) annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const picked = hitTestMarquee(pos.x, pos.y);
      const selectedBefore = getSelectedMarqueeIndexes();

      if (annotState.multiSelectMode) {
        // In V mode: drag-select by default. Only move when clicking inside already selected group.
        if (picked >= 0 && selectedBefore.includes(picked)) {
          annotState.drawing = true;
          annotState.marqueeDragStartX = pos.x;
          annotState.marqueeDragStartY = pos.y;
          annotState.marqueeDragMode = 'move-group';
          annotState.marqueeDragGroupOrig = selectedBefore.map(i => ({ i, x: annotState.marqueeBoxes[i].x, y: annotState.marqueeBoxes[i].y }));
          annotState.marqueeDragOrig = null;
          canvas.style.cursor = 'grabbing';
          renderMarqueeScene(ctx);
          return;
        }
        annotState.drawing = true;
        annotState.marqueeDragMode = 'select';
        annotState.marqueeSelectStartX = pos.x;
        annotState.marqueeSelectStartY = pos.y;
        annotState.marqueeSelectRect = { x: pos.x, y: pos.y, w: 0, h: 0 };
        renderMarqueeScene(ctx, null, annotState.marqueeSelectRect);
        return;
      }

      if (picked >= 0) {
        setSingleMarqueeSelection(picked);
        const pickedBox = annotState.marqueeBoxes[picked];
        if (hitTestMarqueeDeleteHandle(pickedBox, pos.x, pos.y)) {
          annotState.marqueeBoxes.splice(picked, 1);
          setSingleMarqueeSelection(Math.min(picked, annotState.marqueeBoxes.length - 1));
          renderMarqueeScene(ctx);
          annotState.dirty = true;
          if (!state._marqueeBoxes) state._marqueeBoxes = {};
          state._marqueeBoxes[annotState.imageUrl] = JSON.parse(JSON.stringify(annotState.marqueeBoxes));
          return;
        }
        annotState.drawing = true;
        annotState.marqueeDragStartX = pos.x;
        annotState.marqueeDragStartY = pos.y;
        if (!hitTestMarqueeResizeHandle(pickedBox, pos.x, pos.y) && getSelectedMarqueeIndexes().length > 1) {
          annotState.marqueeDragMode = 'move-group';
          annotState.marqueeDragGroupOrig = getSelectedMarqueeIndexes().map(i => ({ i, x: annotState.marqueeBoxes[i].x, y: annotState.marqueeBoxes[i].y }));
          annotState.marqueeDragOrig = null;
        } else {
          annotState.marqueeDragOrig = { ...pickedBox };
          annotState.marqueeDragMode = hitTestMarqueeResizeHandle(pickedBox, pos.x, pos.y) ? 'resize' : 'move';
          annotState.marqueeDragGroupOrig = [];
        }
        canvas.style.cursor = (annotState.marqueeDragMode === 'move' || annotState.marqueeDragMode === 'move-group') ? 'grabbing' : 'nwse-resize';
        renderMarqueeScene(ctx);
        return;
      }
      annotState.history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (annotState.history.length > 40) annotState.history.shift();
      annotState.drawing = true;
      annotState.marqueeDragMode = 'create';
      canvas.style.cursor = 'crosshair';
      annotState.marqueeStartX = pos.x;
      annotState.marqueeStartY = pos.y;
      renderMarqueeScene(ctx);
      return;
    }

    const ctx = canvas.getContext('2d');
    // Save undo snapshot
    annotState.history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (annotState.history.length > 40) annotState.history.shift();

    const pos = getPos(e);
    annotState.drawing = true;
    annotState.lastX = pos.x;
    annotState.lastY = pos.y;

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function doDraw(e) {
    if (!annotState.active || !annotState.drawing) return;
    e.preventDefault();
    const ctx = canvas.getContext('2d');
    const pos = getPos(e);

    if (annotState.tool === 'marquee') {
      const mode = annotState.marqueeDragMode || 'create';
      if (mode === 'move-group' && annotState.marqueeDragGroupOrig.length) {
        const dx = pos.x - annotState.marqueeDragStartX;
        const dy = pos.y - annotState.marqueeDragStartY;
        annotState.marqueeDragGroupOrig.forEach(({ i, x, y }) => {
          const box = annotState.marqueeBoxes[i];
          if (!box) return;
          box.x = Math.max(0, Math.min(canvas.width - box.w, x + dx));
          box.y = Math.max(0, Math.min(canvas.height - box.h, y + dy));
        });
        renderMarqueeScene(ctx);
        return;
      }
      if (mode === 'move' && annotState.selectedMarquee >= 0 && annotState.marqueeDragOrig) {
        const box = annotState.marqueeBoxes[annotState.selectedMarquee];
        const dx = pos.x - annotState.marqueeDragStartX;
        const dy = pos.y - annotState.marqueeDragStartY;
        box.x = Math.max(0, Math.min(canvas.width - box.w, annotState.marqueeDragOrig.x + dx));
        box.y = Math.max(0, Math.min(canvas.height - box.h, annotState.marqueeDragOrig.y + dy));
        renderMarqueeScene(ctx);
        return;
      }
      if (mode === 'resize' && annotState.selectedMarquee >= 0 && annotState.marqueeDragOrig) {
        const box = annotState.marqueeBoxes[annotState.selectedMarquee];
        box.w = Math.max(8, Math.min(canvas.width - box.x, annotState.marqueeDragOrig.w + (pos.x - annotState.marqueeDragStartX)));
        box.h = Math.max(8, Math.min(canvas.height - box.y, annotState.marqueeDragOrig.h + (pos.y - annotState.marqueeDragStartY)));
        renderMarqueeScene(ctx);
        return;
      }
      if (mode === 'select') {
        const x = Math.min(annotState.marqueeSelectStartX, pos.x);
        const y = Math.min(annotState.marqueeSelectStartY, pos.y);
        const w = Math.abs(pos.x - annotState.marqueeSelectStartX);
        const h = Math.abs(pos.y - annotState.marqueeSelectStartY);
        annotState.marqueeSelectRect = { x, y, w, h };
        renderMarqueeScene(ctx, null, annotState.marqueeSelectRect);
        return;
      }
      const x = Math.min(annotState.marqueeStartX, pos.x);
      const y = Math.min(annotState.marqueeStartY, pos.y);
      const w = Math.abs(pos.x - annotState.marqueeStartX);
      const h = Math.abs(pos.y - annotState.marqueeStartY);
      renderMarqueeScene(ctx, { x, y, w, h, tags: [] });
      return;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (annotState.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = annotState.size * 4;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else if (annotState.tool === 'highlight') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = annotState.size * 5;
      const hex = annotState.color;
      ctx.strokeStyle = hex + '55'; // ~33% opacity
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = annotState.size;
      ctx.strokeStyle = annotState.color;
    }

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    annotState.dirty = true;

    annotState.lastX = pos.x;
    annotState.lastY = pos.y;
  }

  function endDraw(e) {
    if (!annotState.drawing) return;
    if (annotState.tool === 'marquee') {
      const ctx = canvas.getContext('2d');
      const pos = getPos(e);
      const mode = annotState.marqueeDragMode || 'create';
      annotState.drawing = false;
      annotState.marqueePreview = null;
      annotState.marqueeDragMode = '';
      annotState.marqueeDragOrig = null;
      annotState.marqueeDragGroupOrig = [];
      if (mode === 'create') {
        const x = Math.min(annotState.marqueeStartX, pos.x);
        const y = Math.min(annotState.marqueeStartY, pos.y);
        const w = Math.abs(pos.x - annotState.marqueeStartX);
        const h = Math.abs(pos.y - annotState.marqueeStartY);
        if (w >= 8 && h >= 8) {
          const box = { x, y, w, h, tags: [] };
          annotState.marqueeBoxes.push(box);
          setSingleMarqueeSelection(annotState.marqueeBoxes.length - 1);
          annotState.dirty = true;
        }
      } else if (mode === 'select') {
        const sel = annotState.marqueeSelectRect;
        annotState.marqueeSelectRect = null;
        if (sel && sel.w >= 4 && sel.h >= 4) {
          const selected = [];
          annotState.marqueeBoxes.forEach((b, i) => {
            if (rectsIntersect(sel, b)) selected.push(i);
          });
          annotState.selectedMarquees = selected;
          annotState.selectedMarquee = selected.length ? selected[selected.length - 1] : -1;
          refreshGalleryTagsTrayIfVisible();
        }
      } else if (mode === 'move' || mode === 'resize') {
        annotState.dirty = true;
      } else if (mode === 'move-group') {
        annotState.dirty = true;
      }
      renderMarqueeScene(ctx);
      if (!state._marqueeBoxes) state._marqueeBoxes = {};
      state._marqueeBoxes[annotState.imageUrl] = JSON.parse(JSON.stringify(annotState.marqueeBoxes));
      canvas.style.cursor = 'crosshair';
      return;
    }
    annotState.drawing = false;
    canvas.getContext('2d').globalCompositeOperation = 'source-over';
  }

  function updateMarqueeCursor(e) {
    if (!annotState.active || annotState.tool !== 'marquee' || annotState.drawing) return;
    if (annotState.multiSelectMode) { canvas.style.cursor = 'crosshair'; return; }
    const pos = getPos(e);
    const idx = hitTestMarquee(pos.x, pos.y);
    if (idx >= 0) {
      const b = annotState.marqueeBoxes[idx];
      if (hitTestMarqueeDeleteHandle(b, pos.x, pos.y)) canvas.style.cursor = 'pointer';
      else if (hitTestMarqueeResizeHandle(b, pos.x, pos.y)) canvas.style.cursor = 'nwse-resize';
      else canvas.style.cursor = 'grab';
      return;
    }
    canvas.style.cursor = 'crosshair';
  }

  function updateBrushCursorPos(e) {
    const el = document.getElementById('annot-brush-cursor');
    if (!el) return;
    if (!shouldUseBrushCursor()) { el.style.display = 'none'; return; }
    const src = e.touches ? e.touches[0] : e;
    const wr = wrapper.getBoundingClientRect();
    el.style.left = (src.clientX - wr.left) + 'px';
    el.style.top = (src.clientY - wr.top) + 'px';
    el.style.display = 'block';
  }

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', doDraw);
  canvas.addEventListener('mousemove', updateBrushCursorPos);
  canvas.addEventListener('mousemove', updateMarqueeCursor);
  canvas.addEventListener('contextmenu', e => {
    if (!annotState.active || annotState.tool !== 'marquee') return;
    const pos = getPos(e);
    const idx = hitTestMarquee(pos.x, pos.y);
    if (idx < 0) { hideMarqueeContextMenu(); return; }
    e.preventDefault();
    const ctx = canvas.getContext('2d');
    const selected = getSelectedMarqueeIndexes();
    if (!selected.includes(idx)) setSingleMarqueeSelection(idx);
    if (!annotState.marqueeRasterBase) annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
    renderMarqueeScene(ctx);
    showMarqueeContextMenu(e.clientX, e.clientY, idx);
  });
  canvas.addEventListener('mouseup', endDraw);
  canvas.addEventListener('mouseleave', endDraw);
  canvas.addEventListener('mouseleave', () => {
    const el = document.getElementById('annot-brush-cursor');
    if (el) el.style.display = 'none';
  });
  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', doDraw, { passive: false });
  canvas.addEventListener('touchend', endDraw);

  // Annotation toolbar controls
  document.getElementById('gv2-annotate-btn').addEventListener('click', toggleAnnotation);

  ['pen', 'highlight', 'eraser', 'marquee'].forEach(tool => {
    document.getElementById('annot-' + tool).addEventListener('click', () => {
      setAnnotTool(tool);
    });
  });
  const vBtn = document.getElementById('annot-vselect');
  if (vBtn) vBtn.addEventListener('click', () => toggleMarqueeGroupSelect());

  document.getElementById('annot-color').addEventListener('input', e => {
    annotState.color = e.target.value;
  });

  document.getElementById('annot-size').addEventListener('input', e => {
    annotState.size = parseInt(e.target.value);
    document.getElementById('annot-size-label').textContent = e.target.value + 'px';
    updateAnnotToolIcons();
  });

  document.getElementById('annot-undo').addEventListener('click', () => {
    const ctx = canvas.getContext('2d');
    if (!annotState.history.length) return;
    ctx.putImageData(annotState.history.pop(), 0, 0);
    annotState.dirty = true;
  });

  document.getElementById('annot-clear').addEventListener('click', () => {
    const ctx = canvas.getContext('2d');
    annotState.history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    annotState.marqueeBoxes = [];
    annotState.selectedMarquee = -1;
    annotState.selectedMarquees = [];
    annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (!state._marqueeBoxes) state._marqueeBoxes = {};
    state._marqueeBoxes[annotState.imageUrl] = [];
    annotState.dirty = true;
  });

  document.getElementById('annot-save-overlay').addEventListener('click', saveAnnotOverlay);
  document.getElementById('annot-save-merge').addEventListener('click', saveAnnotMerge);

  const mqInp = document.getElementById('gv2-mq-tag-input');
  const mqAdd = document.getElementById('gv2-mq-add');
  const mqRebind = document.getElementById('gv2-mq-rebind');
  const mqDel = document.getElementById('gv2-mq-del');
  const addTagFromInput = () => {
    const tag = String(mqInp?.value || '').trim();
    if (!addTagToSelectedMarqueeBox(tag)) return;
    if (mqInp) mqInp.value = '';
    renderGalleryTagsTray();
  };
  if (mqAdd) mqAdd.addEventListener('click', addTagFromInput);
  if (mqInp) mqInp.addEventListener('keydown', e => {
    if (e.key === 'Enter') addTagFromInput();
  });
  if (mqRebind) mqRebind.addEventListener('click', async () => {
    const ctx = canvas.getContext('2d');
    await rebindCurrentImageOverlayToMarquee(ctx, canvas);
  });
  if (mqDel) mqDel.addEventListener('click', () => {
    // Close marquee sub-mode (top delete icon on selected box handles deletion)
    if (!annotState.active) return;
    setAnnotTool('pen');
  });

  updateAnnotToolIcons();

  // Text Bar Events
  const tbBold = document.getElementById('gv2-tb-bold');
  if (tbBold) tbBold.addEventListener('click', () => tbBold.classList.toggle('active'));

  const tbItalic = document.getElementById('gv2-tb-italic');
  if (tbItalic) tbItalic.addEventListener('click', () => tbItalic.classList.toggle('active'));

  const tbAlign = document.getElementById('gv2-tb-align');
  if (tbAlign) {
    tbAlign.addEventListener('click', () => {
      if (tbAlign.classList.contains('align-center')) {
        tbAlign.classList.remove('align-center');
        tbAlign.classList.add('align-right');
        tbAlign.innerHTML = '&#8649;'; // Right indent
      } else if (tbAlign.classList.contains('align-right')) {
        tbAlign.classList.remove('align-right');
        tbAlign.innerHTML = '&#8801;'; // Left indent (default)
      } else {
        tbAlign.classList.add('align-center');
        tbAlign.innerHTML = '&#8644;'; // Center indent
      }
    });
  }
}

async function saveAnnotOverlay() {
  const canvas = document.getElementById('annot-canvas');
  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  if (!imgUrl) { showToast('No image selected', 'error'); return; }

  // Upload overlay PNG to server
  canvas.toBlob(async blob => {
    const fd = new FormData();
    fd.append('image', blob, 'overlay.png');
    try {
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.url) throw new Error();
      if (!setOverlayUrlForCurrentGalleryImage(data.url)) {
        showToast('Unable to map overlay to this image', 'error');
        return;
      }
      await saveTrades();
      annotState.dirty = false;
      stopAnnotation();
      showToast('Overlay saved!', 'success');
    } catch (e) { showToast('Overlay save failed', 'error'); }
  }, 'image/png');
}

async function saveAnnotMerge() {
  const canvas = document.getElementById('annot-canvas');
  const img = document.getElementById('gallery-img');
  const trade = getOwnerTradeForGalleryImage();

  // Merge annotation onto original image at full resolution
  const out = document.createElement('canvas');
  out.width = img.naturalWidth;
  out.height = img.naturalHeight;
  const ctx = out.getContext('2d');

  ctx.drawImage(img, 0, 0, out.width, out.height);
  // Scale annotation canvas to original resolution
  ctx.drawImage(canvas, 0, 0, out.width, out.height);

  out.toBlob(async blob => {
    const fd = new FormData();
    fd.append('image', blob, 'merged.png');
    try {
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.url) throw new Error();
      // Add merged image as NEW entry (keep original intact)
      const imgs = state.gallery.images;
      imgs.push(data.url);
      if (trade) {
        if (!Array.isArray(trade.images)) trade.images = [];
        if (trade.images !== imgs) trade.images.push(data.url);
      }
      state.gallery.currentIndex = imgs.length - 1; // jump to the new image
      await saveTrades();
      renderGallery();
      annotState.dirty = false;
      stopAnnotation();
      showToast('Merged image added to gallery!', 'success');
    } catch (e) { showToast('Merge save failed', 'error'); }
  }, 'image/png');
}

// â”€â”€ ZOOM / PAN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const zoom = { scale: 1, x: 0, y: 0 };
const drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 };

function resetZoom() { zoom.scale = 1; zoom.x = 0; zoom.y = 0; applyZoom(); }

function applyZoom() {
  const img = document.getElementById('gallery-img');
  const tf = `translate3d(${zoom.x}px, ${zoom.y}px, 0) scale(${zoom.scale})`;
  img.style.transform = tf;
  img.style.transformOrigin = 'top left';
  const canvas = document.getElementById('annot-canvas');
  if (canvas) {
    canvas.style.transform = tf;
    canvas.style.transformOrigin = 'top left';
    canvas.classList.toggle('dragging', !!drag.active);
  }
  if (zoom.scale > 1) { img.classList.add('zoomed'); img.classList.remove('dragging'); }
  else { img.classList.remove('zoomed', 'dragging'); }
}

function bindZoomPan() {
  const wrapper = document.getElementById('gallery-img-wrapper');
  const img = document.getElementById('gallery-img');

  wrapper.addEventListener('wheel', e => {
    e.preventDefault();
    zoom.scale = Math.min(Math.max(zoom.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1), 8);
    if (zoom.scale <= 1) { zoom.scale = 1; zoom.x = 0; zoom.y = 0; }
    applyZoom();
  }, { passive: false });

  wrapper.addEventListener('dblclick', () => resetZoom());

  wrapper.addEventListener('mousedown', e => {
    if (zoom.scale <= 1) return;
    if (annotState.active) return; // annotation mode handles its own drag interactions
    const t = e.target;
    if (!(t && (t.id === 'gallery-img' || t.id === 'annot-canvas' || t.id === 'gallery-img-wrapper'))) return;
    drag.active = true; drag.startX = e.clientX; drag.startY = e.clientY;
    drag.originX = zoom.x; drag.originY = zoom.y;
    img.classList.add('dragging');
    const canvas = document.getElementById('annot-canvas');
    if (canvas) canvas.classList.add('dragging');
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!drag.active) return;
    zoom.x = drag.originX + (e.clientX - drag.startX);
    zoom.y = drag.originY + (e.clientY - drag.startY);
    applyZoom();
  });
  document.addEventListener('mouseup', () => {
    if (drag.active) {
      drag.active = false;
      document.getElementById('gallery-img').classList.remove('dragging');
      const canvas = document.getElementById('annot-canvas');
      if (canvas) canvas.classList.remove('dragging');
      applyZoom();
    }
  });

  let lastDist = 0;
  let swipeTracking = false;
  let swipeStartX = 0;
  let swipeStartY = 0;
  let swipeLastX = 0;
  let swipeLastY = 0;
  wrapper.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      swipeTracking = false;
      return;
    }
    if (e.touches.length === 1 && zoom.scale <= 1 && !annotState.active) {
      swipeTracking = true;
      swipeStartX = e.touches[0].clientX;
      swipeStartY = e.touches[0].clientY;
      swipeLastX = swipeStartX;
      swipeLastY = swipeStartY;
      return;
    }
    swipeTracking = false;
  }, { passive: true });
  wrapper.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      zoom.scale = Math.min(Math.max(zoom.scale * (dist / lastDist), 1), 8);
      lastDist = dist; applyZoom();
      return;
    }
    if (swipeTracking && e.touches.length === 1) {
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      swipeLastX = x;
      swipeLastY = y;
      const dx = x - swipeStartX;
      const dy = y - swipeStartY;
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        e.preventDefault();
      }
    }
  }, { passive: false });
  wrapper.addEventListener('touchend', () => {
    if (!swipeTracking) return;
    const dx = swipeLastX - swipeStartX;
    const dy = swipeLastY - swipeStartY;
    swipeTracking = false;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
    navigateGallery(dx < 0 ? 1 : -1);
  }, { passive: true });
}

// â”€â”€ UPLOAD MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openUploadModal(rowIdx) {
  syncTradeDateField(state.trades[rowIdx]);
  state.uploadRow = rowIdx;
  state._dayUploadKey = null;
  state.pendingFiles = [...(state.trades[rowIdx].images || [])];
  document.getElementById('upload-modal-title').textContent = `Images â€” ${state.trades[rowIdx].date || `Row ${rowIdx + 1}`}`;
  renderUploadPreview();
  document.getElementById('upload-modal').classList.add('open');
}

function openDayUploadModal(dateKey) {
  state.uploadRow = null;
  state._dayUploadKey = dateKey;
  state.pendingFiles = [...((state.dayData[dateKey] || {}).images || [])];
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
    // Internal image drag (move/copy between rows)
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
    // External file drop
    const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
    if (!files.length) return;
    e.preventDefault();
    await uploadImagesToRow(rowIdx, files);
  });
}

// Row drag handles: reorder state.trades
let _rowDragSrcIdx = null;
let _rowDropTarget = null;
let _rowDropPos = null; // 'before' | 'after'
let _rowDragFromHandle = false; // true only when drag started from the ⠿ handle
document.addEventListener('mouseup', () => { _rowDragFromHandle = false; }, true);

function bindTableRowDrag(tr, rowIdx, body) {
  tr.setAttribute('draggable', 'true');
  tr.addEventListener('dragstart', e => {
    // Only proceed if the drag originated from the handle span
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
      // Find actual current indices
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

// â”€â”€ EXCEL IMPORT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ JSON IMPORT (Restore) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ EXCEL EXPORT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ TOAST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let toastTimer = null;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast'); t.textContent = msg; t.className = `toast ${type} show`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = 'toast'; }, 3000);
}

// â”€â”€ DROPDOWN HELPER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function setupDropdown(btnId, menuId) {
  const btn = document.getElementById(btnId);
  const menu = document.getElementById(menuId);
  if (!btn || !menu) return;
  btn.addEventListener('click', e => { e.stopPropagation(); closeAllDropdowns(menuId); menu.classList.toggle('open'); });
}

function closeAllDropdowns(except) {
  document.querySelectorAll('.dropdown-menu.open').forEach(m => { if (m.id !== except) m.classList.remove('open'); });
}

// â”€â”€ EVENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function bindEvents() {
  // Calendar nav
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

  // Show heads
  document.getElementById('show-heads-btn').addEventListener('click', e => {
    e.stopPropagation(); document.getElementById('show-heads-panel').classList.toggle('open');
  });

  // Dropdowns
  setupDropdown('file-dropdown-btn', 'file-dropdown-menu');
  setupDropdown('add-dropdown-btn', 'add-dropdown-menu');
  setupDropdown('col-vis-btn', 'col-vis-panel');
  setupDropdown('broker-filter-btn-top', 'broker-filter-menu-top');
  setupDropdown('dashboard-stats-btn', 'dashboard-stats-menu');

  // Close all on outside click
  document.addEventListener('click', () => {
    closeAllDropdowns('__none__');
    document.getElementById('show-heads-panel').classList.remove('open');
  });
  document.getElementById('show-heads-panel').addEventListener('click', e => e.stopPropagation());
  document.getElementById('col-vis-panel').addEventListener('click', e => e.stopPropagation());
  const brokerMenuTop = document.getElementById('broker-filter-menu-top');
  if (brokerMenuTop) brokerMenuTop.addEventListener('click', e => e.stopPropagation());
  const dashStatsMenu = document.getElementById('dashboard-stats-menu');
  if (dashStatsMenu) dashStatsMenu.addEventListener('click', e => e.stopPropagation());

  // Tag filter dropdown + tag picker
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

  // File actions
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

  // Add row
  document.getElementById('add-row-btn').addEventListener('click', () => {
    const today = new Date().toISOString().slice(0, 10);
    const row = { date: today, trade_date: today, images: [] };
    state.columns.forEach(col => { row[col] = ''; });
    row[BROKER_COLUMN] = row[BROKER_COLUMN] || 'zerodha';
    row.observation = '';
    state.trades.push(row); render(); saveTrades();
    closeAllDropdowns('__none__');
  });

  // Add tag column (same popup flow as Add Column, prefilled as "Tags")
  document.getElementById('add-tag-col-btn').addEventListener('click', () => {
    state.addTagColumnMode = true;
    document.getElementById('add-col-modal').classList.add('open');
    document.getElementById('new-col-name').value = getNextTagColumnName();
    document.getElementById('new-col-name').focus();
    document.getElementById('new-col-name').select();
    closeAllDropdowns('__none__');
  });

  // Add column modal
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

  // Edit column modal
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

  // Filter toggle
  document.getElementById('filter-toggle-btn').addEventListener('click', () => {
    state.filterVisible = !state.filterVisible;
    const btn = document.getElementById('filter-toggle-btn');
    btn.style.borderColor = state.filterVisible ? 'var(--blue)' : '';
    btn.style.color = state.filterVisible ? 'var(--blue)' : '';
    renderTable();
  });

  // Note column quick toggle
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

  // Date range filter
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

  // Gallery nav
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
  // Gallery upload button â€” opens upload modal for current gallery date
  document.getElementById('gallery-upload-btn').addEventListener('click', () => {
    if (!state.gallery.date) return;
    let rowIdx = state.trades.findIndex(t => normalizeDate(extractDateFromTrade(t)) === state.gallery.date);
    if (rowIdx === -1) {
      const trade = getOrCreateTrade(state.gallery.date);
      rowIdx = state.trades.indexOf(trade);
      saveTrades();
    }
    // After upload-done, refresh gallery
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
  // V2: no click-on-overlay-to-close (it's fullscreen now)

  // V2: Tags tray toggle (T key also handled in keydown)
  document.getElementById('gv2-tags-btn').addEventListener('click', () => {
    const tray = document.getElementById('gv2-tags-tray');
    const btn = document.getElementById('gv2-tags-btn');
    const open = tray.style.display === 'none' || !tray.style.display;
    tray.style.display = open ? 'flex' : 'none';
    btn.classList.toggle('active', open);
    if (open) renderGalleryTagsTray();
  });

  // V2: Text bar toggle
  document.getElementById('gv2-text-btn').addEventListener('click', () => {
    const bar = document.getElementById('gv2-text-bar');
    const mqBar = document.getElementById('gv2-marquee-bar');
    const btn = document.getElementById('gv2-text-btn');
    const isTextModeOpen = annotState.active && annotState.tool === 'text' && bar.style.display === 'flex';

    if (!isTextModeOpen) {
      commitActiveCanvasTextEditor();
      if (annotState.active && annotState.tool !== 'text') {
        // Switch active annotation session from drawing -> text
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

  // V2: Tag cloud filter mode toggle (OR / AND)
  document.getElementById('gv2-tc-mode-btn').addEventListener('click', () => {
    state.gallery.filterMode = state.gallery.filterMode === 'or' ? 'and' : 'or';
    applyGalleryImageScopeByTagFilter((state.gallery.images || [])[state.gallery.currentIndex] || '');
    renderGalleryTagCloud(); renderGallery();
  });

  // V2: Clear tag filter
  document.getElementById('gv2-tc-clear-btn').addEventListener('click', () => {
    state.gallery.tagFilter = [];
    applyGalleryImageScopeByTagFilter((state.gallery.images || [])[state.gallery.currentIndex] || '');
    renderGalleryTagCloud(); renderGallery();
  });

  // V2: Observation button
  document.getElementById('gv2-obs-btn').addEventListener('click', () => {
    const d = state.gallery.date;
    if (d) {
      document.getElementById('gallery-modal').classList.remove('open');
      unlockBodyScroll();
      openObsModal(d);
    }
  });

  // V2: Add tag group
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

  // Observation modal
  bindObsToolbar();
  document.getElementById('obs-save').addEventListener('click', () => saveObservation(true));
  // Cancel = discard (explicit user action), everything else auto-saves
  document.getElementById('obs-cancel').addEventListener('click', () => {
    document.getElementById('obs-modal').classList.remove('open');
  });
  document.getElementById('obs-close').addEventListener('click', () => saveObservation(true));
  // Only close when BOTH mousedown and click land on the backdrop (not when text-select drags outside)
  let _obsMousedownOnBg = false;
  document.getElementById('obs-modal').addEventListener('mousedown', e => {
    _obsMousedownOnBg = e.target === e.currentTarget;
  });
  document.getElementById('obs-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget && _obsMousedownOnBg) saveObservation(true);
    _obsMousedownOnBg = false;
  });
  // Obs date navigation
  document.getElementById('obs-date-prev').addEventListener('click', () => navigateObsDate(-1));
  document.getElementById('obs-date-next').addEventListener('click', () => navigateObsDate(1));
  document.getElementById('obs-date-picker').addEventListener('change', e => {
    if (e.target.value) { saveObservation(false); openObsModal(e.target.value); }
  });

  // Upload modal â€” browse button fix (prevent double-trigger)
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
    // Refresh gallery if it was opened from there
    if (state._galleryUploadCallback) { state._galleryUploadCallback(); state._galleryUploadCallback = null; }
  });
  ['upload-cancel-btn', 'upload-close'].forEach(id => document.getElementById(id).addEventListener('click', () => document.getElementById('upload-modal').classList.remove('open')));
  document.getElementById('upload-modal').addEventListener('click', e => { if (e.target === e.currentTarget) document.getElementById('upload-modal').classList.remove('open'); });
  // Clipboard paste support in upload modal
  document.getElementById('upload-modal').addEventListener('paste', async e => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imgFiles = Array.from(items).filter(it => it.type.startsWith('image/')).map(it => it.getAsFile()).filter(Boolean);
    if (imgFiles.length) { e.preventDefault(); await handleImageFiles(imgFiles); showToast('Image pasted from clipboard', 'success'); }
  });

  // Settings
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
        // Live-save: update state immediately so new shortcut works right away
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

  // Show Heads defaults buttons in Settings
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

  // Keyboard
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

    // D — date picker: obs-modal gets obs-date-picker, gallery gets gallery-date-picker
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
    // C = Consolidated, Shift+C = Individual (only when not typing, no modal open)
    const anyModalOpen = ['obs-modal', 'add-col-modal', 'edit-col-modal', 'tag-modal', 'img-tag-modal', 'upload-modal']
      .some(id => document.getElementById(id)?.classList.contains('open'));
    if (!typingInField && !galleryOpen && !anyModalOpen && !e.ctrlKey && !e.altKey) {
      if (e.key === 'f' && !e.shiftKey) {
        // F — toggle calendar full-screen view
        e.preventDefault();
        document.body.classList.toggle('calendar-full');
        document.body.classList.remove('table-full');
      } else if ((e.key === 'F' || (e.key === 'f' && e.shiftKey)) && !e.ctrlKey) {
        // Shift+F — toggle table full-screen view
        e.preventDefault();
        const _enteringFull = !document.body.classList.contains('table-full');
        document.body.classList.toggle('table-full');
        document.body.classList.remove('calendar-full');
        // Expand rows to 20 when entering full-screen; restore on exit
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
        // N — open observation modal for the most recent trade date
        e.preventDefault();
        const tradeDates = state.trades
          .map(t => normalizeDate(extractDateFromTrade(t)))
          .filter(Boolean).sort();
        const target = tradeDates.length
          ? tradeDates[tradeDates.length - 1]
          : new Date().toISOString().slice(0, 10);
        openObsModal(target);
      } else if (e.key === 'i' && !e.shiftKey) {
        // I — open image gallery for the latest date that has images
        e.preventDefault();
        const datesWImg = getDatesWithImages();
        if (datesWImg.length) openGalleryForDate(datesWImg[datesWImg.length - 1]);
      }
    }

    if (e.key === 'Escape') {
      document.body.classList.remove('calendar-full', 'table-full');
      document.getElementById('settings-overlay').classList.remove('open');
      // Escape on obs modal â†' auto-save (same as clicking X)
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

// â”€â”€ START â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
init();
