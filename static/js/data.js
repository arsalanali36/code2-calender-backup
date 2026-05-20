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
  const vs = document.getElementById('glob-view');
  if (vs) vs.value = state.calendarView;
  repopulateYearSelect();
}

function repopulateYearSelect() {
  const sel = document.getElementById('glob-month-year');
  if (!sel) return;
  const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const seen = new Set();
  const MIN_YEAR = 2010;
  state.trades.forEach(t => {
    if (t.date) {
      const d = new Date(t.date);
      if (!isNaN(d) && d.getFullYear() >= MIN_YEAR)
        seen.add(`${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`);
    }
  });
  // always include current month
  const now = new Date();
  seen.add(`${now.getFullYear()}-${String(now.getMonth()).padStart(2,'0')}`);
  const sorted = [...seen].sort();
  const current = `${state.year}-${String(state.month).padStart(2,'0')}`;
  sel.innerHTML = '';
  sorted.forEach(key => {
    const [y, m] = key.split('-');
    const o = document.createElement('option');
    o.value = key;
    o.textContent = `${MN[parseInt(m)]} ${y}`;
    if (key === current) o.selected = true;
    sel.appendChild(o);
  });
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
    state.demoMode = !!data.demo_mode;
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
    repopulateYearSelect();
    // Render errors (e.g. table/calendar JS bug) should not mask a successful data load
    try { render(); } catch (re) { console.error('[render] error after loadTrades:', re); }
    _updateDemoUI();
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
      window.dispatchEvent(new CustomEvent('tradesaved'));
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

// ── Demo mode UI helpers ──────────────────────────────────────────────────
function _updateDemoUI() {
  const banner  = document.getElementById('demo-banner');
  const hdrBtn  = document.getElementById('demo-mode-toggle-btn');
  const clearBtn = document.getElementById('demo-clear-btn');

  if (banner) {
    banner.style.display = state.demoMode ? 'flex' : 'none';
    // Sticky: sit right below the sticky header
    const hdr = document.querySelector('.app-header');
    if (hdr) banner.style.top = hdr.offsetHeight + 'px';
  }
  if (hdrBtn) {
    hdrBtn.style.display = '';
    hdrBtn.disabled = false;
    if (state.demoMode) {
      hdrBtn.textContent = '🎭 Clear Demo Data';
      hdrBtn.style.color = '#fbbf24';
    } else {
      hdrBtn.textContent = '🎭 Restore Demo Data';
      hdrBtn.style.color = '';
    }
  }
  if (clearBtn) {
    clearBtn.disabled = false;
    clearBtn.textContent = 'Clear & Start Fresh →';
  }
}

async function _demoAction(endpoint, loadingText, successMsg, errorMsg) {
  const clearBtn = document.getElementById('demo-clear-btn');
  const hdrBtn   = document.getElementById('demo-mode-toggle-btn');
  [clearBtn, hdrBtn].forEach(b => { if (b) { b.disabled = true; b.textContent = loadingText; } });
  try {
    const res = await fetch(endpoint, { method: 'POST' });
    if (!res.ok) throw new Error('server error');
    const json = await res.json().catch(() => ({}));
    await loadTrades();
    if (endpoint === '/api/trades/restore-demo' && json.has_backup) {
      _showUndoToast();
    } else if (typeof showToast === 'function') {
      showToast(successMsg, 'success');
    }
  } catch (_e) {
    _updateDemoUI();
    if (typeof showToast === 'function') showToast(errorMsg, 'error');
  }
}

function _showUndoToast() {
  const existing = document.getElementById('demo-restore-undo-toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.id = 'demo-restore-undo-toast';
  Object.assign(t.style, {
    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
    background: '#1e293b', border: '1px solid #334155', borderRadius: '10px',
    padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
    zIndex: '999999', boxShadow: '0 8px 32px rgba(0,0,0,.5)',
    fontSize: '0.875rem', color: '#f1f5f9', whiteSpace: 'nowrap'
  });
  t.innerHTML = `
    <span>&#10003; Demo restore ho gaya.</span>
    <button id="dru-undo-btn" style="padding:5px 12px;background:#f59e0b;color:#000;border:none;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.82rem;">&#8617; Undo — Data Wapas Lao</button>
    <button id="dru-close-btn" style="background:transparent;border:none;color:#64748b;cursor:pointer;font-size:1.1rem;line-height:1;">&#x2715;</button>`;
  document.body.appendChild(t);

  document.getElementById('dru-close-btn').addEventListener('click', () => t.remove());

  document.getElementById('dru-undo-btn').addEventListener('click', async () => {
    const btn = document.getElementById('dru-undo-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Restoring…'; }
    try {
      const res = await fetch('/api/trades/undo-demo-restore', { method: 'POST' });
      if (!res.ok) throw new Error();
      t.remove();
      await loadTrades();
      if (typeof showToast === 'function') showToast('Data recover ho gaya! ✅', 'success');
    } catch (_) {
      if (typeof showToast === 'function') showToast('Recovery fail ho gayi — backup se try karein', 'error');
      _updateDemoUI();
    }
  });
}

function _showDemoRestoreConfirm() {
  const overlay = document.getElementById('demo-restore-confirm-overlay');
  if (overlay) overlay.style.display = 'flex';
}

document.addEventListener('DOMContentLoaded', function () {
  // Clear demo button (banner)
  const clearBtn = document.getElementById('demo-clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () =>
      _demoAction('/api/trades/clear-demo', 'Clearing…',
        'Demo cleared — add your first trade! 🚀', 'Failed to clear demo data'));
  }

  // Header toggle button (profile dropdown)
  const hdrBtn = document.getElementById('demo-mode-toggle-btn');
  if (hdrBtn) {
    hdrBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (state.demoMode) {
        _demoAction('/api/trades/clear-demo', 'Clearing…',
          'Demo cleared — add your first trade! 🚀', 'Failed to clear demo data');
      } else {
        _showDemoRestoreConfirm();
      }
    });
  }

  // Demo restore confirm modal buttons (static HTML in index.html)
  const drcOverlay = document.getElementById('demo-restore-confirm-overlay');
  if (drcOverlay) {
    const hide = () => { drcOverlay.style.display = 'none'; };

    drcOverlay.addEventListener('click', e => {
      e.stopPropagation();
      if (e.target === drcOverlay) hide();
    });

    document.getElementById('drc-cancel-btn').addEventListener('click', hide);

    document.getElementById('drc-skip-btn').addEventListener('click', () => {
      hide();
      _demoAction('/api/trades/restore-demo', 'Restoring…',
        'Demo data restored! 🎭', 'Failed to restore demo data');
    });

    document.getElementById('drc-backup-btn').addEventListener('click', async () => {
      hide();
      try {
        if (typeof handleBackupWithProgress === 'function') {
          await handleBackupWithProgress('pre-demo-restore');
        }
      } catch (_) {}
      _demoAction('/api/trades/restore-demo', 'Restoring…',
        'Demo data restored! 🎭', 'Failed to restore demo data');
    });
  }
});

