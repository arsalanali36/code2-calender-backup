/**
 * gallery-chart.js
 * Lightweight TradingView chart panel inside the gallery — opens when
 * clicking the chart icon on a trade card in the All-Trades panel.
 * Uses the same /api/whatif/ohlc-data endpoint as the What-If page.
 * All private identifiers are prefixed _gc_ to avoid conflicts.
 */

// ── State ────────────────────────────────────────────────────────
let _gc_chart      = null;
let _gc_series     = null;
let _gc_rawCandles = [];
let _gc_meta       = {};
let _gc_tf         = 1;
let _gc_lockCb     = null;

// ── Candle aggregation (identical to whatif-ui) ──────────────────
function _gc_aggregate(candles, tf) {
  if (tf <= 1) return candles;
  const buckets = {}, order = [];
  for (const c of candles) {
    const t = (c.time || (c.datetime || '').slice(11));
    const [hh, mm] = t.split(':').map(Number);
    const off  = hh * 60 + mm - (9 * 60 + 15);
    const bOff = Math.floor(off / tf) * tf;
    const bMin = 9 * 60 + 15 + bOff;
    const key  = `${String(Math.floor(bMin / 60)).padStart(2, '0')}:${String(bMin % 60).padStart(2, '0')}`;
    if (!buckets[key]) { buckets[key] = []; order.push(key); }
    buckets[key].push(c);
  }
  return order.map(key => {
    const sl = buckets[key];
    const dt = (sl[0].datetime || '').slice(0, 11);
    return {
      datetime: dt + key + ':00',
      time:     key + ':00',
      open:     sl[0].open,
      high:     Math.max(...sl.map(c => +c.high)),
      low:      Math.min(...sl.map(c => +c.low)),
      close:    sl[sl.length - 1].close,
      volume:   sl.reduce((s, c) => s + (+c.volume || 0), 0),
    };
  });
}

// ── Open chart modal ─────────────────────────────────────────────
async function openGalleryChart(symbol, date, entry, direction, entryTime, exitTime, actualExitPrice, actualExitTime) {
  if (typeof LightweightCharts === 'undefined') {
    alert('Chart library not loaded — refresh the page and try again.');
    return;
  }
  const modal = document.getElementById('gc-chart-modal');
  const title = document.getElementById('gc-chart-title');
  if (!modal || !title) return;

  title.textContent = `${symbol}  ·  ${date}  ·  Loading…`;
  modal.style.display = 'flex';

  // Stop click-through to gallery underneath
  modal.onclick = e => { if (e.target === modal) closeGalleryChart(); };

  _gc_tf = 1;
  document.querySelectorAll('.gc-tf-btn').forEach(b =>
    b.classList.toggle('gc-tf-active', +b.dataset.tf === 1));

  try {
    const r = await fetch(`/api/whatif/ohlc-data?symbol=${encodeURIComponent(symbol)}&date=${encodeURIComponent(date)}`);
    const d = await r.json();
    if (d.error) {
      title.textContent = `${symbol}  ·  ${date}  —  ${d.error}`;
      return;
    }
    _gc_rawCandles = d.candles;

    if (entry != null) {
      const isShort = (direction || '').toUpperCase() === 'SHORT';
      const sl  = parseFloat(document.getElementById('gc-sl-input').value)  || 15;
      const tgt = parseFloat(document.getElementById('gc-tgt-input').value) || 30;
      const slLevel  = isShort ? entry + sl  : entry - sl;
      const tgtLevel = isShort ? entry - tgt : entry + tgt;
      _gc_meta = { entry, slLevel, tgtLevel, entryTime: entryTime || '', exitTime: exitTime || '',
                   actualExitPrice: actualExitPrice || null, actualExitTime: actualExitTime || '',
                   direction: isShort ? 'SHORT' : 'LONG', symbol, date };
      title.textContent = `${symbol}  ·  ${date}  ·  Entry ${entry}  ·  ${isShort ? 'SHORT' : 'LONG'}  ·  SL ${sl}  ·  Tgt ${tgt}`;
      document.getElementById('gc-sim-bar').style.display = 'flex';
      document.getElementById('gc-sl-input').value  = sl;
      document.getElementById('gc-tgt-input').value = tgt;
    } else {
      _gc_meta = { symbol, date };
      title.textContent = `${symbol}  ·  ${date}`;
      document.getElementById('gc-sim-bar').style.display = 'none';
    }

    _gc_drawChart(_gc_aggregate(_gc_rawCandles, 1));
  } catch (e) {
    title.textContent = `${symbol}  ·  ${date}  —  Error: ${e.message}`;
  }
}

// ── Close chart modal ────────────────────────────────────────────
function closeGalleryChart() {
  const modal = document.getElementById('gc-chart-modal');
  if (modal) modal.style.display = 'none';
  if (_gc_lockCb && _gc_chart) {
    try { _gc_chart.timeScale().unsubscribeVisibleLogicalRangeChange(_gc_lockCb); } catch (_) {}
    _gc_lockCb = null;
  }
  if (_gc_chart) { _gc_chart.remove(); _gc_chart = null; }
  _gc_series = null;
  _gc_rawCandles = [];
  _gc_meta = {};
  const chk = document.getElementById('gc-lock-chk');
  if (chk) chk.checked = false;
}

// ── Draw / redraw chart ──────────────────────────────────────────
function _gc_drawChart(candles) {
  const container = document.getElementById('gc-chart-container');
  if (!container) return;

  if (_gc_chart) { _gc_chart.remove(); _gc_chart = null; }

  const labels = [];
  const data = candles.map((c, i) => {
    labels[i] = (c.datetime || c.time || '').slice(11, 16);
    return { time: i, open: +c.open, high: +c.high, low: +c.low, close: +c.close };
  }).filter(c => !isNaN(c.open));

  _gc_chart = LightweightCharts.createChart(container, {
    width:  container.clientWidth,
    height: 440,
    layout: { background: { color: '#131722' }, textColor: '#d1d4dc' },
    grid:   { vertLines: { color: '#1e2130' }, horzLines: { color: '#1e2130' } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: '#2a2a3e' },
    timeScale: {
      borderColor: '#2a2a3e', timeVisible: true, secondsVisible: false,
      tickMarkFormatter: i => labels[i] || '',
    },
    localization: { timeFormatter: i => labels[i] || '' },
  });

  if (_gc_lockCb && _gc_chart) {
    try { _gc_chart.timeScale().unsubscribeVisibleLogicalRangeChange(_gc_lockCb); } catch (_) {}
    _gc_lockCb = null;
  }

  const series = _gc_chart.addCandlestickSeries({
    upColor: '#26a69a', downColor: '#ef5350',
    borderUpColor: '#26a69a', borderDownColor: '#ef5350',
    wickUpColor: '#26a69a', wickDownColor: '#ef5350',
  });
  series.setData(data);
  _gc_series = series;

  const { entry, slLevel, tgtLevel, entryTime, exitTime, actualExitPrice, actualExitTime } = _gc_meta;

  if (entry != null)      series.createPriceLine({ price: entry,            color: '#5599ff', lineWidth: 2, lineStyle: LightweightCharts.LineStyle.Solid,  axisLabelVisible: true, title: 'Entry' });
  if (slLevel != null)    series.createPriceLine({ price: slLevel,          color: '#ff5555', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: 'SL' });
  if (tgtLevel != null)   series.createPriceLine({ price: tgtLevel,         color: '#44dd88', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: 'Target' });
  if (actualExitPrice > 0) series.createPriceLine({ price: actualExitPrice, color: '#ffaa33', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Solid,  axisLabelVisible: true, title: 'Exit' });

  const markers = [];
  if (entryTime) {
    const idx = labels.indexOf(entryTime);
    if (idx >= 0) markers.push({ time: idx, position: 'belowBar', color: '#5599ff', shape: 'arrowUp',   text: 'Entry' });
  }
  if (actualExitTime) {
    const idx = labels.indexOf(actualExitTime);
    if (idx >= 0) markers.push({ time: idx, position: 'aboveBar', color: '#ffaa33', shape: 'arrowDown', text: 'Exit' });
  }
  if (markers.length) series.setMarkers(markers.sort((a, b) => a.time - b.time));

  // Auto-zoom around trade window
  const entryIdx = entryTime ? labels.indexOf(entryTime) : -1;
  const exitIdx  = exitTime  ? labels.indexOf(exitTime)  : -1;
  if (entryIdx >= 0) {
    const pad  = 30;
    const from = Math.max(0, entryIdx - pad);
    const to   = Math.min(data.length - 1, (exitIdx >= 0 ? exitIdx : entryIdx) + pad);
    _gc_chart.timeScale().setVisibleLogicalRange({ from, to });
  } else {
    _gc_chart.timeScale().fitContent();
  }

  const chk = document.getElementById('gc-lock-chk');
  if (chk && chk.checked) setTimeout(_gc_applyLockRatio, 50);
}

// ── Timeframe switch ─────────────────────────────────────────────
function setGalleryChartTf(tf) {
  _gc_tf = tf;
  document.querySelectorAll('.gc-tf-btn').forEach(b =>
    b.classList.toggle('gc-tf-active', +b.dataset.tf === tf));
  if (_gc_rawCandles.length) _gc_drawChart(_gc_aggregate(_gc_rawCandles, tf));
}

// ── Re-run sim from chart modal ──────────────────────────────────
function gc_reSimChart() {
  if (_gc_meta.entry == null || !_gc_rawCandles.length) return;
  const sl  = parseFloat(document.getElementById('gc-sl-input').value)  || 15;
  const tgt = parseFloat(document.getElementById('gc-tgt-input').value) || 30;
  const isShort = _gc_meta.direction === 'SHORT';
  _gc_meta.slLevel  = isShort ? _gc_meta.entry + sl  : _gc_meta.entry - sl;
  _gc_meta.tgtLevel = isShort ? _gc_meta.entry - tgt : _gc_meta.entry + tgt;
  document.getElementById('gc-chart-title').textContent =
    `${_gc_meta.symbol}  ·  ${_gc_meta.date}  ·  Entry ${_gc_meta.entry}  ·  ${_gc_meta.direction}  ·  SL ${sl}  ·  Tgt ${tgt}`;
  _gc_drawChart(_gc_aggregate(_gc_rawCandles, _gc_tf));
}

// ── Lock price-to-bar ratio ──────────────────────────────────────
function _gc_applyLockRatio() {
  if (!_gc_chart || !_gc_series || !_gc_rawCandles.length) return;
  const ratio = parseFloat(document.getElementById('gc-lock-val')?.value) || 6;
  const range = _gc_chart.timeScale().getVisibleLogicalRange();
  if (!range) return;
  const barCount  = Math.max(1, range.to - range.from);
  const priceSpan = ratio * barCount;
  const agg = _gc_aggregate(_gc_rawCandles, _gc_tf);
  const f   = Math.max(0, Math.round(range.from));
  const t   = Math.min(agg.length - 1, Math.round(range.to));
  const vis = agg.slice(f, t + 1);
  if (!vis.length) return;
  const hi  = Math.max(...vis.map(c => +c.high));
  const lo  = Math.min(...vis.map(c => +c.low));
  const mid = (hi + lo) / 2;
  _gc_series.applyOptions({
    autoscaleInfoProvider: () => ({
      priceRange: { minValue: mid - priceSpan / 2, maxValue: mid + priceSpan / 2 },
      margins: { above: 0.05, below: 0.05 },
    }),
  });
}

function gc_setLockRatio(locked) {
  if (!_gc_chart) return;
  if (locked) {
    _gc_applyLockRatio();
    _gc_lockCb = _gc_applyLockRatio;
    _gc_chart.timeScale().subscribeVisibleLogicalRangeChange(_gc_lockCb);
  } else {
    if (_gc_lockCb) {
      _gc_chart.timeScale().unsubscribeVisibleLogicalRangeChange(_gc_lockCb);
      _gc_lockCb = null;
    }
    if (_gc_series) _gc_series.applyOptions({ autoscaleInfoProvider: undefined });
    if (_gc_chart)  _gc_chart.priceScale('right').applyOptions({ autoScale: true });
  }
}

// ── Keyboard: Escape closes chart or sync panel ──────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const syncPanel = document.getElementById('gc-sync-panel');
    if (syncPanel && syncPanel.style.display !== 'none') {
      gcCloseSyncPanel();
      e.stopImmediatePropagation();
      return;
    }
    const modal = document.getElementById('gc-chart-modal');
    if (modal && modal.style.display !== 'none') {
      closeGalleryChart();
      e.stopImmediatePropagation();
    }
  }
}, true);

// ── Sync All OHLC ────────────────────────────────────────────────
let _gc_syncEventSource = null;

// ── Dhan credentials helpers ─────────────────────────────────────
async function gcLoadDhanConfig() {
  try {
    const r = await fetch('/api/whatif/config');
    const d = await r.json();
    const label  = document.getElementById('gc-creds-summary-label');
    const status = document.getElementById('gc-creds-status');
    if (d.configured) {
      document.getElementById('gc-dhan-client-id').value   = d.client_id || '';
      document.getElementById('gc-dhan-token').placeholder = d.access_token_masked || '••••';
      const h = d.hours_ago;
      const stale = h != null && h >= 20;
      const age   = h == null ? '' : (h < 1 ? ' (just now)' : ` (${h}h ago)`);
      if (label)  label.textContent = `Dhan API Credentials — ✓ saved${age}${stale ? ' ⚠ update soon' : ''}`;
      if (status) { status.textContent = stale ? '⚠ Token may be expired' : '✓ Credentials saved'; status.style.color = stale ? '#fbbf24' : '#4ade80'; }
    } else {
      if (label) label.textContent = 'Dhan API Credentials — not configured';
      // Auto-open so user sees the form
      const details = document.getElementById('gc-creds-details');
      if (details) details.open = true;
    }
  } catch (_) {}
}

async function gcSaveDhanConfig() {
  const client_id    = (document.getElementById('gc-dhan-client-id').value || '').trim();
  const access_token = (document.getElementById('gc-dhan-token').value     || '').trim();
  const status = document.getElementById('gc-creds-status');
  if (!client_id || !access_token) {
    status.textContent = 'Both fields required'; status.style.color = '#f87171'; return;
  }
  try {
    const r = await fetch('/api/whatif/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id, access_token }),
    });
    const d = await r.json();
    if (d.ok) {
      status.textContent = '✓ Saved'; status.style.color = '#4ade80';
      document.getElementById('gc-dhan-token').value = '';
      document.getElementById('gc-dhan-token').placeholder = access_token.slice(0,6) + '••••' + access_token.slice(-4);
      const label = document.getElementById('gc-creds-summary-label');
      if (label) label.textContent = 'Dhan API Credentials — ✓ saved (just now)';
      // Collapse after save
      setTimeout(() => { const det = document.getElementById('gc-creds-details'); if (det) det.open = false; }, 800);
    } else {
      status.textContent = d.error || 'Error saving'; status.style.color = '#f87171';
    }
  } catch (e) {
    status.textContent = 'Error: ' + e.message; status.style.color = '#f87171';
  }
}

function gcOpenSyncPanel() {
  const panel = document.getElementById('gc-sync-panel');
  if (!panel) return;
  panel.style.display = 'flex';
  document.getElementById('gc-sync-log').innerHTML = '';
  document.getElementById('gc-sync-status').textContent = '';
  document.getElementById('gc-sync-btn').style.display = 'inline-block';
  document.getElementById('gc-sync-stop-btn').style.display = 'none';
  gcLoadDhanConfig();   // auto-load/show credential status
}

function gcCloseSyncPanel() {
  if (_gc_syncEventSource) { _gc_syncEventSource.close(); _gc_syncEventSource = null; }
  if (_gc_tradebookES)    { _gc_tradebookES.close();     _gc_tradebookES = null; }
  const panel = document.getElementById('gc-sync-panel');
  if (panel) panel.style.display = 'none';
}

let _gc_tradebookES = null;

async function gcImportAndSync() {
  const fileInput = document.getElementById('gc-tradebook-file');
  const statusEl  = document.getElementById('gc-tradebook-status');
  const btn       = document.getElementById('gc-tradebook-btn');
  const stopBtn   = document.getElementById('gc-tradebook-stop-btn');
  const log       = document.getElementById('gc-sync-log');

  if (!fileInput || !fileInput.files.length) {
    if (statusEl) statusEl.textContent = 'Please select a CSV file first.';
    return;
  }

  // Step 1: Upload & parse tradebook
  if (statusEl) { statusEl.textContent = 'Parsing tradebook CSV…'; statusEl.style.color = '#aaa'; }
  if (btn) btn.disabled = true;

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  let parsed;
  try {
    const r = await fetch('/api/whatif/import-tradebook', { method: 'POST', body: formData });
    parsed = await r.json();
  } catch (e) {
    if (statusEl) { statusEl.textContent = `Upload error: ${e.message}`; statusEl.style.color = '#ef9a9a'; }
    if (btn) btn.disabled = false;
    return;
  }

  if (!parsed.ok) {
    if (statusEl) { statusEl.textContent = parsed.error || 'Import failed.'; statusEl.style.color = '#ef9a9a'; }
    if (btn) btn.disabled = false;
    return;
  }

  if (statusEl) {
    statusEl.textContent = `Parsed ${parsed.imported} symbols, ${parsed.pairs} trade days — starting download…`;
    statusEl.style.color = '#81c784';
  }
  if (stopBtn) stopBtn.style.display = 'inline-block';

  // Step 2: Stream OHLC downloads — log into the existing sync log panel
  if (log) log.innerHTML = '';
  if (_gc_tradebookES) { _gc_tradebookES.close(); _gc_tradebookES = null; }

  _gc_tradebookES = new EventSource('/api/whatif/sync-tradebook-ohlc');

  function _tbLog(msg, ok) {
    if (!log) return;
    const line = document.createElement('div');
    line.style.cssText = `color:${ok === false ? '#ef9a9a' : (msg.includes('✓') ? '#81c784' : '#d1d4dc')};padding:1px 0;`;
    line.textContent = msg;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  _gc_tradebookES.onmessage = e => {
    try {
      const d = JSON.parse(e.data);
      _tbLog(d.msg, d.ok);
      if (d.done) {
        _gc_tradebookES.close(); _gc_tradebookES = null;
        if (stopBtn) stopBtn.style.display = 'none';
        if (btn) btn.disabled = false;
        if (statusEl) { statusEl.textContent = 'Sync complete!'; statusEl.style.color = '#81c784'; }
      }
    } catch (_) {}
  };

  _gc_tradebookES.onerror = () => {
    _gc_tradebookES.close(); _gc_tradebookES = null;
    if (stopBtn) stopBtn.style.display = 'none';
    if (btn) btn.disabled = false;
    _tbLog('Connection lost — sync may have finished.', false);
  };
}

function gcStopTradebookSync() {
  if (_gc_tradebookES) { _gc_tradebookES.close(); _gc_tradebookES = null; }
  const stopBtn = document.getElementById('gc-tradebook-stop-btn');
  const btn     = document.getElementById('gc-tradebook-btn');
  if (stopBtn) stopBtn.style.display = 'none';
  if (btn) btn.disabled = false;
  const statusEl = document.getElementById('gc-tradebook-status');
  if (statusEl) statusEl.textContent = 'Stopped.';
}

function gcStartSync() {
  const log    = document.getElementById('gc-sync-log');
  const status = document.getElementById('gc-sync-status');
  const startBtn = document.getElementById('gc-sync-btn');
  const stopBtn  = document.getElementById('gc-sync-stop-btn');

  if (_gc_syncEventSource) { _gc_syncEventSource.close(); _gc_syncEventSource = null; }
  log.innerHTML = '';
  status.textContent = 'Connecting…';
  status.style.color = '#aaa';
  startBtn.style.display = 'none';
  stopBtn.style.display  = 'inline-block';

  _gc_syncEventSource = new EventSource('/api/whatif/sync-all-ohlc');

  _gc_syncEventSource.onmessage = e => {
    let d;
    try { d = JSON.parse(e.data); } catch (_) { return; }

    const line = document.createElement('div');
    line.style.cssText = `font-size:0.8rem; padding:1px 0; color:${d.ok === false ? '#f87171' : '#d1d4dc'};`;
    line.textContent = d.msg;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;

    if (d.done) {
      status.textContent = d.msg;
      status.style.color = d.ok === false ? '#f87171' : '#4ade80';
      _gc_syncEventSource.close();
      _gc_syncEventSource = null;
      startBtn.style.display = 'inline-block';
      startBtn.textContent   = '↺ Run Again';
      stopBtn.style.display  = 'none';
    }
  };

  _gc_syncEventSource.onerror = () => {
    status.textContent = 'Connection error — server may have closed the stream.';
    status.style.color = '#fbbf24';
    _gc_syncEventSource.close();
    _gc_syncEventSource = null;
    startBtn.style.display = 'inline-block';
    stopBtn.style.display  = 'none';
  };
}

function gcStopSync() {
  if (_gc_syncEventSource) { _gc_syncEventSource.close(); _gc_syncEventSource = null; }
  const status   = document.getElementById('gc-sync-status');
  const startBtn = document.getElementById('gc-sync-btn');
  const stopBtn  = document.getElementById('gc-sync-stop-btn');
  status.textContent = 'Stopped by user.';
  status.style.color = '#fbbf24';
  startBtn.style.display = 'inline-block';
  startBtn.textContent   = '▶ Start Sync';
  stopBtn.style.display  = 'none';
}
