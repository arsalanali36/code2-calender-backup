/**
 * @fileoverview whatif-ui-b.js
 * @description OHLC status, fetch, simulation run, summary cards, results table, helpers.
 */

function _strategyDateParams() {
  const from = document.getElementById('date-from').value;
  const to   = document.getElementById('date-to').value;
  const p    = new URLSearchParams();
  if (from) p.set('date_from', from);
  if (to)   p.set('date_to',   to);
  return p.toString();
}

async function checkOhlcStatus() {
  const qs = _strategyDateParams();
  const r = await fetch('/api/whatif/ohlc-status' + (qs ? '?' + qs : ''));
  const d = await r.json();
  renderOhlcStatus(d);
  document.getElementById('ohlc-status-section').classList.remove('hidden');
}

function renderOhlcStatus(items) {
  const grid = document.getElementById('ohlc-status-grid');
  if (!items.length) { grid.innerHTML = '<p class="hint">No mapped instruments found in trades.</p>'; return; }
  grid.innerHTML = items.map(item => {
    const isExpired = item.type === 'expired_opt';
    const cls = item.status === 'complete'    ? 'badge-green'
              : item.status === 'partial'     ? 'badge-orange'
              : item.status === 'missing' && isExpired ? 'badge-orange'
              : item.status === 'missing'     ? 'badge-red'
              : 'badge-gray';
    const label = isExpired && item.status === 'missing' ? 'Expired (fetch needed)'
                : isExpired && item.status === 'complete' ? 'Expired ✓'
                : item.status;
    return `<div class="ohlc-item">
      <div class="oi-sym">${item.symbol}</div>
      <div class="oi-meta">${item.date}</div>
      <div style="margin-top:4px;">
        <span class="badge ${cls}">${label}</span>
        ${item.candles  ? `<span class="hint" style="margin-left:6px;">${item.candles} candles</span>` : ''}
        ${item.last_candle ? `<span class="hint" style="display:block;margin-top:2px;">Last: ${item.last_candle.slice(11,16)}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ── Fetch OHLC ────────────────────────────────────────────────
async function fetchAllOhlc() {
  const btn = document.getElementById('btn-fetch-ohlc');
  btn.disabled = true;
  setStatus('run-status', '⏳ Fetching OHLC…', 'var(--text2)');
  try {
    const qs = _strategyDateParams();
    const r = await fetch('/api/whatif/ohlc-status' + (qs ? '?' + qs : ''));
    const items = await r.json();
    const toFetch = items.filter(i => i.status !== 'complete' && i.status !== 'not_mapped');
    if (!toFetch.length) {
      setStatus('run-status', '✓ All OHLC already complete', 'var(--green)'); return;
    }
    const fr = await fetch('/api/whatif/fetch-ohlc', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ items: toFetch.map(i => ({ symbol: i.symbol, date: i.date, type: i.type || '', entry_time: i.entry_time || '' })) })
    });
    const fd = await fr.json();
    const ok      = fd.results.filter(x => x.ok).length;
    const errList = fd.results.filter(x => x.error);
    const firstErr = errList[0] ? `— ${errList[0].symbol}: ${errList[0].error}` : '';
    setStatus('run-status',
      `Fetched ${ok}/${fd.results.length}${errList.length ? ` (${errList.length} errors) ${firstErr}` : ' ✓'}`,
      ok > 0 ? 'var(--green)' : 'var(--red)');
    checkOhlcStatus();
  } finally {
    btn.disabled = false;
  }
}

// ── Run Simulation ────────────────────────────────────────────
async function runSimulation() {
  const btn = document.getElementById('btn-run');
  btn.disabled = true;
  setStatus('run-status', '⏳ Running simulation…', 'var(--text2)');
  try {
    const r = await fetch('/api/whatif/run', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        date_from:         document.getElementById('date-from').value,
        date_to:           document.getElementById('date-to').value,
        target_pts:        parseFloat(document.getElementById('target-pts').value) || 30,
        sl_pts:            parseFloat(document.getElementById('sl-pts').value)     || 15,
        trail_trigger_pts: parseFloat(document.getElementById('trail-pts').value)  || 0,
        timeframe:         parseInt(document.getElementById('timeframe').value)    || 1,
        direction:         document.getElementById('direction-override').value,
      })
    });
    const d = await r.json();
    if (d.error) { setStatus('run-status', d.error, 'var(--red)'); return; }
    renderSummary(d.summary);
    renderResults(d.trades);
    setStatus('run-status', `✓ ${d.summary.total_trades} trades simulated`, 'var(--green)');
    document.getElementById('summary-section').classList.remove('hidden');
    document.getElementById('results-section').classList.remove('hidden');
  } catch(e) {
    setStatus('run-status', 'Error: ' + e.message, 'var(--red)');
  } finally {
    btn.disabled = false;
  }
}

// ── Summary Cards ─────────────────────────────────────────────
function renderSummary(s) {
  const cards = document.getElementById('wi-summary-cards');
  if (!s.total_trades) {
    cards.innerHTML = `<div style="padding:16px;background:var(--surface2);border-radius:var(--radius);border:1px solid var(--border2);">
      <p style="margin:0 0 8px;color:var(--text);">⚠️ No OHLC data found for any trade in this range.</p>
      <p style="margin:0;color:var(--text2);font-size:.85rem;">
        Steps: <strong>1.</strong> Map instruments (Instrument Mapper above) &nbsp;→&nbsp;
        <strong>2.</strong> Click <em>Check OHLC Status</em> &nbsp;→&nbsp;
        <strong>3.</strong> Click <em>Fetch / Complete OHLC</em> &nbsp;→&nbsp;
        <strong>4.</strong> Run Simulation again.
      </p>
    </div>`;
    return;
  }
  const ap = s.actual_pnl  || 0;
  const pp = s.planned_pnl || 0;
  const mp = s.missed_pnl  || 0;
  cards.innerHTML = [
    card('Trades',        s.total_trades, 'neu'),
    card('Actual ₹',      fmt(ap),  ap >= 0 ? 'pos' : 'neg'),
    card('Planned ₹',     fmt(pp),  pp >= 0 ? 'pos' : 'neg'),
    card('Missed ₹',      fmt(mp),  mp > 0  ? 'neg' : mp < 0 ? 'pos' : 'neu'),
    card('Avg Efficiency',s.avg_efficiency != null ? s.avg_efficiency + '%' : '—', 'neu'),
    card('Target Hits',   s.target_hits   ?? '—', 'pos'),
    card('SL Hits',       s.sl_hits       ?? '—', 'neg'),
    card('No OHLC',       s.no_ohlc_count ?? 0,   'neu'),
  ].join('');
}
function card(label, val, cls) {
  return `<div class="wi-stat"><div class="s-label">${label}</div><div class="s-val ${cls}">${val}</div></div>`;
}

// ── Results Table ─────────────────────────────────────────────
function renderResults(trades) {
  _chartTrades = trades || [];   // store for arrow-key nav
  const tbody = document.getElementById('wi-results-body');
  if (!trades || !trades.length) {
    tbody.innerHTML = '<tr><td colspan="18" style="text-align:center;color:var(--text2);padding:20px;">No results</td></tr>';
    return;
  }
  tbody.innerHTML = trades.map((t, idx) => {
    const hasData = t.exit_reason !== 'no_ohlc';
    return `<tr data-idx="${idx}">
      <td>${t.date || ''}</td>
      <td class="dim" style="font-weight:600;color:var(--accent)">${t.t_num || ''}</td>
      <td class="dim">${(t.time || '').slice(0,5)}</td>
      <td class="dim">${t.exit_time || '—'}</td>
      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;" title="${t.instrument}"><span class="wi-inst-link" onclick="openOhlcChart('${t.instrument}','${t.date}',${t.entry||0},'${t.direction||'SHORT'}','${(t.time||'').slice(0,5)}','${t.exit_time||''}',${t.exit_actual||0},'${(t.actual_exit_time||'').slice(0,5)}',${idx})">${t.instrument}</span></td>
      <td><span class="badge ${t.direction==='SHORT'?'badge-red':'badge-green'}">${t.direction||''}</span></td>
      <td>${fmt2(t.entry)}</td>
      <td>${fmt2(t.exit_actual)}</td>
      <td class="${pnlCls(t.actual_pts)}">${hasData?fmt2(t.actual_pts):'—'}</td>
      <td class="${pnlCls(t.actual_net??t.actual_pnl)}">${hasData?fmt(t.actual_net??t.actual_pnl):'—'}</td>
      <td class="${pnlCls(t.planned_pts)}">${hasData?fmt2(t.planned_pts):'—'}</td>
      <td class="${pnlCls(t.planned_net??t.planned_pnl)}">${hasData?fmt(t.planned_net??t.planned_pnl):'—'}</td>
      <td class="${pnlCls(t.missed_pts!=null?-t.missed_pts:null)}">${hasData&&t.missed_pts!=null?fmt2(t.missed_pts):'—'}</td>
      <td class="dim">${hasData?fmt2(t.mfe):'—'}</td>
      <td class="dim">${hasData?fmt2(t.mae):'—'}</td>
      <td class="${effCls(t.efficiency)}">${hasData&&t.efficiency!=null?t.efficiency+'%':'—'}</td>
      <td><span class="exit-badge ${exitClass(t.exit_reason)}">${exitLabel(t.exit_reason)}</span></td>
      <td>${t.trail_triggered?'<span class="badge badge-orange">BE</span>':''}</td>
    </tr>`;
  }).join('');
}

// ── Helpers ───────────────────────────────────────────────────
function fmt(n)    { if (n==null) return '—'; return (n>=0?'+':'')+Number(n).toLocaleString('en-IN',{maximumFractionDigits:2}); }
function fmt2(n)   { if (n==null) return '—'; return Number(n).toFixed(2); }
function pnlCls(n) { if (n==null) return 'dim'; return n>0?'pos':n<0?'neg':'dim'; }
function effCls(e) { if (e==null) return 'dim'; return e>=80?'pos':e>=40?'':'neg'; }
function _esc(s)   { return (s||'').replace(/[^a-zA-Z0-9_]/g,'_'); }

function exitClass(r) {
  return r==='target'?'exit-target':r==='sl'?'exit-sl':r==='trail_sl'?'exit-trail':r==='eod'?'exit-eod':'exit-miss';
}
function exitLabel(r) {
  return r==='target'?'Target':r==='sl'?'SL':r==='trail_sl'?'Trail BE':r==='eod'?'EOD':r==='no_ohlc'?'No Data':r==='no_candles'?'No Candles':r==='ohlc_mismatch'?'⚠ Bad OHLC':r||'—';
}

function setStatus(id, msg, color) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.color = color || '';
}

// ── OHLC Chart Modal (TradingView Lightweight Charts) ─────────
let _ohlcChart     = null;
let _ohlcSeries    = null;   // kept for lock-ratio updates
let _lockRatioCb   = null;   // subscribed callback reference
let _rawCandles    = [];
let _chartMeta     = {};
let _currentTf     = 1;
let _chartTrades   = [];
let _chartTradeIdx = -1;

function aggregateCandles(candles, tf) {
  if (tf <= 1) return candles;
  // Time-bucket based aggregation anchored to 09:15 — gaps in data don't shift boundaries
  const buckets = {}, order = [];
  for (const c of candles) {
    const t = (c.time || (c.datetime || '').slice(11));
    const [hh, mm] = t.split(':').map(Number);
    const off    = hh * 60 + mm - (9 * 60 + 15);
    const bOff   = Math.floor(off / tf) * tf;
    const bMin   = 9 * 60 + 15 + bOff;
    const key    = `${String(Math.floor(bMin/60)).padStart(2,'0')}:${String(bMin%60).padStart(2,'0')}`;
    if (!buckets[key]) { buckets[key] = []; order.push(key); }
    buckets[key].push(c);
  }
  return order.map(key => {
    const sl  = buckets[key];
    const dt  = (sl[0].datetime || '').slice(0, 11);
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

function setChartTf(tf) {
  _currentTf = tf;
  document.querySelectorAll('.tf-btn').forEach(b =>
    b.classList.toggle('tf-active', +b.dataset.tf === tf));
  if (_rawCandles.length)
    drawOhlcChart(aggregateCandles(_rawCandles, tf),
      _chartMeta.entry, _chartMeta.slLevel, _chartMeta.tgtLevel,
      _chartMeta.entryTime, _chartMeta.exitTime,
      _chartMeta.actualExitPrice, _chartMeta.actualExitTime);
}

async function openOhlcChart(symbol, date, entry, direction, entryTime, exitTime, actualExitPrice, actualExitTime, tradeIdx) {
  const modal = document.getElementById('ohlc-chart-modal');
  const title = document.getElementById('ohlc-chart-title');
  title.textContent = `${symbol}  ·  ${date}  ·  Loading…`;
  modal.style.display = 'flex';
  _chartTradeIdx = (tradeIdx !== undefined && tradeIdx >= 0) ? tradeIdx : -1;

  // Show/hide sim-bar and pre-fill SL/Target inputs
  const simBar = document.getElementById('ohlc-sim-bar');
  const sl  = parseFloat(document.getElementById('sl-pts').value)  || 15;
  const tgt = parseFloat(document.getElementById('target-pts').value) || 30;
  if (entry != null) {
    simBar.style.display = 'flex';
    document.getElementById('chart-sl').value  = sl;
    document.getElementById('chart-tgt').value = tgt;
  } else {
    simBar.style.display = 'none';
  }

  try {
    const r = await fetch(`/api/whatif/ohlc-data?symbol=${encodeURIComponent(symbol)}&date=${encodeURIComponent(date)}`);
    const d = await r.json();
    if (d.error) { title.textContent = `${symbol} — ${d.error}`; return; }

    // Default TF = strategy candle timeframe selector
    _rawCandles = d.candles;
    _currentTf  = entry != null ? (parseInt(document.getElementById('timeframe').value) || 1) : 1;
    document.querySelectorAll('.tf-btn').forEach(b =>
      b.classList.toggle('tf-active', +b.dataset.tf === _currentTf));

    let slLevel = null, tgtLevel = null;
    if (entry == null) {
      title.textContent = `${symbol}  ·  ${date}`;
    } else {
      const sl  = parseFloat(document.getElementById('sl-pts').value)     || 15;
      const tgt = parseFloat(document.getElementById('target-pts').value) || 30;
      const isShort = direction === 'SHORT';
      slLevel  = isShort ? entry + sl  : entry - sl;
      tgtLevel = isShort ? entry - tgt : entry + tgt;
      title.textContent = `${symbol}  ·  ${date}  ·  Entry ${entry}  ·  ${isShort?'SHORT':'LONG'}  ·  SL ${sl}  ·  Target ${tgt}`;
    }
    _chartMeta = { entry, slLevel, tgtLevel, entryTime, exitTime, actualExitPrice: actualExitPrice||null, actualExitTime: actualExitTime||'', direction, symbol, date, actualExitPrice2: actualExitPrice||null };
    drawOhlcChart(aggregateCandles(d.candles, _currentTf), entry, slLevel, tgtLevel, entryTime, exitTime, actualExitPrice||null, actualExitTime||'');
  } catch(e) {
    title.textContent = `${symbol} — Error: ${e.message}`;
  }
}

function closeOhlcChart() {
  document.getElementById('ohlc-chart-modal').style.display = 'none';
  if (_lockRatioCb && _ohlcChart) {
    try { _ohlcChart.timeScale().unsubscribeVisibleLogicalRangeChange(_lockRatioCb); } catch(_){}
    _lockRatioCb = null;
  }
  if (_ohlcChart) { _ohlcChart.remove(); _ohlcChart = null; }
  _ohlcSeries = null;
  _rawCandles = []; _chartMeta = {};
  const chk = document.getElementById('lock-ratio-chk');
  if (chk) chk.checked = false;
}

// ── Quick Chart Lookup ─────────────────────────────────────────
async function quickChartOpen() {
  const sym  = (document.getElementById('qc-symbol').value || '').trim().toUpperCase();
  const date = (document.getElementById('qc-date').value   || '').trim();
  const st   = document.getElementById('qc-status');
  const btn  = document.getElementById('btn-qc-open');

  if (!sym)  { st.textContent = 'Enter a symbol'; st.style.color = '#f66'; return; }
  if (!date) { st.textContent = 'Pick a date';    st.style.color = '#f66'; return; }

  st.textContent = 'Fetching…'; st.style.color = '#aaa';
  btn.disabled = true;

  try {
    // 1. Fetch/cache OHLC (no-op if already cached)
    const fr = await fetch('/api/whatif/fetch-ohlc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ symbol: sym, date }] })
    });
    const fd = await fr.json();
    const res = (fd.results || [])[0] || {};
    if (res.error) {
      st.textContent = res.error; st.style.color = '#f66';
      btn.disabled = false; return;
    }
    st.textContent = `${res.candles || 0} candles — opening…`; st.style.color = '#5f5';

    // 2. Open chart (no entry/direction — just raw candles)
    await openOhlcChart(sym, date, null, null, '', '');
    st.textContent = '';
  } catch(e) {
    st.textContent = e.message; st.style.color = '#f66';
  }
  btn.disabled = false;
}

function drawOhlcChart(candles, entry, slLevel, tgtLevel, entryTime, exitTime, actualExitPrice, actualExitTime) {
  const container = document.getElementById('ohlc-chart-container');

  // Destroy previous chart instance
  if (_ohlcChart) { _ohlcChart.remove(); _ohlcChart = null; }

  // Build data array with sequential integer indices to avoid gaps.
  // Store the actual IST time string per index for the axis label.
  const _timeLabels = [];
  const data = candles.map((c, i) => {
    _timeLabels[i] = (c.datetime || c.time || '').slice(11, 16); // "HH:MM"
    return { time: i, open: +c.open, high: +c.high, low: +c.low, close: +c.close };
  }).filter(c => !isNaN(c.open));

  _ohlcChart = LightweightCharts.createChart(container, {
    width:  container.clientWidth,
    height: 460,
    layout: { background: { color: '#131722' }, textColor: '#d1d4dc' },
    grid: { vertLines: { color: '#1e2130' }, horzLines: { color: '#1e2130' } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: '#2a2a3e' },
    timeScale: { borderColor: '#2a2a3e', timeVisible: true, secondsVisible: false,
                 tickMarkFormatter: i => _timeLabels[i] || '' },
    localization: { timeFormatter: i => _timeLabels[i] || '' },
  });

  // Detach any existing lock-ratio listener before rebuilding
  if (_lockRatioCb && _ohlcChart) {
    try { _ohlcChart.timeScale().unsubscribeVisibleLogicalRangeChange(_lockRatioCb); } catch(_){}
    _lockRatioCb = null;
  }
  const series = _ohlcChart.addCandlestickSeries({
    upColor:          '#26a69a', downColor:       '#ef5350',
    borderUpColor:    '#26a69a', borderDownColor: '#ef5350',
    wickUpColor:      '#26a69a', wickDownColor:   '#ef5350',
  });

  series.setData(data);
  _ohlcSeries = series;

  // Re-apply lock-ratio if checkbox is still checked (e.g. after TF switch)
  if (document.getElementById('lock-ratio-chk')?.checked) {
    setTimeout(applyLockRatio, 50);
  }

  // Price lines
  if (entry != null)           series.createPriceLine({ price: entry,           color: '#5599ff', lineWidth: 2, lineStyle: LightweightCharts.LineStyle.Solid,  axisLabelVisible: true, title: 'Entry' });
  if (slLevel != null)         series.createPriceLine({ price: slLevel,         color: '#ff5555', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: 'SL' });
  if (tgtLevel != null)        series.createPriceLine({ price: tgtLevel,        color: '#44dd88', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: 'Target' });
  if (actualExitPrice != null && actualExitPrice > 0)
                               series.createPriceLine({ price: actualExitPrice, color: '#ffaa33', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Solid,  axisLabelVisible: true, title: 'Actual Exit' });

  // Markers — match candle by HH:MM label
  const markers = [];
  if (entryTime) {
    const idx = _timeLabels.indexOf(entryTime);
    if (idx >= 0) markers.push({ time: idx, position: 'belowBar', color: '#5599ff', shape: 'arrowUp',   text: 'Entry' });
  }
  if (actualExitTime) {
    const idx = _timeLabels.indexOf(actualExitTime);
    if (idx >= 0) markers.push({ time: idx, position: 'aboveBar', color: '#ffaa33', shape: 'arrowDown', text: 'Actual Exit' });
  }
  if (exitTime && exitTime !== actualExitTime) {
    const idx = _timeLabels.indexOf(exitTime);
    if (idx >= 0) markers.push({ time: idx, position: 'aboveBar', color: '#aaaaaa', shape: 'arrowDown', text: 'Sim Exit' });
  }
  if (markers.length) series.setMarkers(markers.sort((a,b) => a.time - b.time));

  // Auto-zoom: if entry+exit known, show trade window ±30 candles padding
  // Otherwise show full day
  const entryIdx = entryTime ? _timeLabels.indexOf(entryTime) : -1;
  const exitIdx  = exitTime  ? _timeLabels.indexOf(exitTime)  : -1;
  if (entryIdx >= 0) {
    const pad  = 30;
    const from = Math.max(0, entryIdx - pad);
    const to   = Math.min(data.length - 1, (exitIdx >= 0 ? exitIdx : entryIdx) + pad);
    _ohlcChart.timeScale().setVisibleLogicalRange({ from, to });
  } else {
    _ohlcChart.timeScale().fitContent();
  }
}

// ── Lock price-to-bar ratio ────────────────────────────────────
function applyLockRatio() {
  if (!_ohlcChart || !_ohlcSeries || !_rawCandles.length) return;
  const ratio = parseFloat(document.getElementById('lock-ratio-val')?.value) || 6;
  const range = _ohlcChart.timeScale().getVisibleLogicalRange();
  if (!range) return;
  const barCount = Math.max(1, range.to - range.from);
  const priceSpan = ratio * barCount;
  const agg = aggregateCandles(_rawCandles, _currentTf);
  const f = Math.max(0, Math.round(range.from));
  const t = Math.min(agg.length - 1, Math.round(range.to));
  const vis = agg.slice(f, t + 1);
  if (!vis.length) return;
  const hi  = Math.max(...vis.map(c => +c.high));
  const lo  = Math.min(...vis.map(c => +c.low));
  const mid = (hi + lo) / 2;
  _ohlcSeries.applyOptions({
    autoscaleInfoProvider: () => ({
      priceRange: { minValue: mid - priceSpan / 2, maxValue: mid + priceSpan / 2 },
      margins: { above: 0.05, below: 0.05 },
    }),
  });
}

function setLockRatio(locked) {
  if (!_ohlcChart) return;
  if (locked) {
    applyLockRatio();
    _lockRatioCb = applyLockRatio;
    _ohlcChart.timeScale().subscribeVisibleLogicalRangeChange(_lockRatioCb);
  } else {
    if (_lockRatioCb) {
      _ohlcChart.timeScale().unsubscribeVisibleLogicalRangeChange(_lockRatioCb);
      _lockRatioCb = null;
    }
    _ohlcSeries.applyOptions({ autoscaleInfoProvider: undefined });
    _ohlcChart.priceScale('right').applyOptions({ autoScale: true });
  }
}

// Re-run simulation with new SL/Target from chart modal inputs
function reSimChart() {
  if (!_chartMeta.entry || _rawCandles.length === 0) return;
  const sl  = parseFloat(document.getElementById('chart-sl').value)  || 15;
  const tgt = parseFloat(document.getElementById('chart-tgt').value) || 30;
  const isShort  = _chartMeta.direction === 'SHORT';
  const slLevel  = isShort ? _chartMeta.entry + sl  : _chartMeta.entry - sl;
  const tgtLevel = isShort ? _chartMeta.entry - tgt : _chartMeta.entry + tgt;
  _chartMeta.slLevel  = slLevel;
  _chartMeta.tgtLevel = tgtLevel;
  document.getElementById('ohlc-chart-title').textContent =
    `${_chartMeta.symbol}  ·  ${_chartMeta.date}  ·  Entry ${_chartMeta.entry}  ·  ${_chartMeta.direction}  ·  SL ${sl}  ·  Target ${tgt}`;
  drawOhlcChart(aggregateCandles(_rawCandles, _currentTf),
    _chartMeta.entry, slLevel, tgtLevel,
    _chartMeta.entryTime, _chartMeta.exitTime,
    _chartMeta.actualExitPrice, _chartMeta.actualExitTime);
}

// Arrow-key navigation between trade charts
function navigateChart(delta) {
  if (_chartTradeIdx < 0 || !_chartTrades.length) return;
  const next = _chartTradeIdx + delta;
  if (next < 0 || next >= _chartTrades.length) return;
  const t = _chartTrades[next];
  openOhlcChart(t.instrument, t.date, t.entry||0, t.direction||'SHORT',
    (t.time||'').slice(0,5), t.exit_time||'',
    t.exit_actual||0, (t.actual_exit_time||'').slice(0,5), next);
}

// Close modal on backdrop click + arrow-key navigation
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ohlc-chart-modal').addEventListener('click', function(e) {
    if (e.target === this) closeOhlcChart();
  });
  document.addEventListener('keydown', e => {
    if (document.getElementById('ohlc-chart-modal').style.display === 'none') return;
    if (e.target.tagName === 'INPUT') return;  // don't intercept when typing in inputs
    if (e.key === 'ArrowRight') { e.preventDefault(); navigateChart(1); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); navigateChart(-1); }
    if (e.key === 'Escape')     closeOhlcChart();
  });
});
