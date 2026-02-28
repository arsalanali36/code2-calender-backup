/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Trading Journal â€” app.js
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

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

