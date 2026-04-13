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
  syncTagColumnRegistry();
  state.userColumns = state.userColumns.filter(c => state.columns.includes(c));
  syncImageTagColumnValues();
  saveTagGroups();
  syncAllTradeDates();
  state.serverStateHash = hashServerState(data);
  initShowHeads();
  initTableShowCols();
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

async function saveTrades() {
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
      imgTypes: state.imgTypes
    };
    await tradeService.saveTrades(payload);
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
      importedPdfs: data?.importedPdfs || [],
      tagGroups: data?.tagGroups || {},
      tagTemplates: data?.tagTemplates || {},
      pdfPageTags: data?.pdfPageTags || {}
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

