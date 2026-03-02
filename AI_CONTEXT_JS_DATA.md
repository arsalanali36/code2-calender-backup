# JS — Data (data.js: loadTrades / saveTrades / sync)
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `static\js\data.js`
```js
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
  if (document.getElementById('gallery-modal')?.classList.contains('open')) return true;
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

  const stt = sellTurn * 0.001;      // 0.1% on sell side (on premium)
  const exch = total * 0.0003503;  // 0.03503% NSE options (on premium)
  const sebi = total * 0.000001;   // ₹10 per crore
  const stamp = buyTurn * 0.00003;   // 0.003% on buy side

  const fillCount = Math.max(parseInt(trade['fill_count']) || 0, 2);

  let brokerage, gst, otherCharges;

  if (broker === 'dhan') {
    brokerage = fillCount * 20;
    const ipft = total * 0.000001;   // IPFT 0.0001% of total turnover
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


```
