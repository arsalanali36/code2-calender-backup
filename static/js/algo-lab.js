/* algo-lab.js — Algo Lab frontend */
'use strict';

let _tickInterval = null;
let _countdown    = 0;
let _countTimer   = null;
let _running      = false;
const TICK_SECS   = 60;

// ── Init ─────────────────────────────────────────────────────────────────────

async function algoInit() {
  await loadStatus();
  await loadOhlcStatus();
}

// ── Status / Config ──────────────────────────────────────────────────────────

async function loadStatus() {
  try {
    const r = await fetch('/api/algo/status');
    const d = await r.json();
    applyConfig(d.config);
    renderOrders(d.orders || []);
    updateBotUI(d.config.running);
    updateStats(d.orders || []);
  } catch(e) { console.error(e); }

  // Load watchlist tags
  try {
    const r = await fetch('/api/algo/watchlist');
    const wl = await r.json();
    renderWlTags(wl);
    const textarea = document.getElementById('wl-textarea');
    if (wl.length && !textarea.value.trim()) {
      textarea.value = wl.map(w => w.symbol).join('\n');
    }
  } catch(e) {}
}

function applyConfig(cfg) {
  if (!cfg) return;
  document.getElementById('cfg-ema-fast').value   = cfg.ema_fast   ?? 9;
  document.getElementById('cfg-ema-slow').value   = cfg.ema_slow   ?? 20;
  document.getElementById('cfg-tf').value         = cfg.timeframe  ?? 1;
  document.getElementById('cfg-entry').value      = cfg.entry_mode ?? 'candle_close';
  document.getElementById('cfg-sl').value         = cfg.sl_type    ?? 'crossover';
  document.getElementById('cfg-loss-limit').value = cfg.daily_loss_limit ?? 100;
  document.getElementById('cfg-qty').value        = cfg.qty        ?? 1;
}

// ── Config Save ───────────────────────────────────────────────────────────────

async function saveConfig() {
  const cfg = {
    ema_fast:         parseInt(document.getElementById('cfg-ema-fast').value) || 9,
    ema_slow:         parseInt(document.getElementById('cfg-ema-slow').value) || 20,
    timeframe:        parseInt(document.getElementById('cfg-tf').value)       || 1,
    entry_mode:       document.getElementById('cfg-entry').value,
    sl_type:          document.getElementById('cfg-sl').value,
    daily_loss_limit: parseFloat(document.getElementById('cfg-loss-limit').value) || 100,
    qty:              parseInt(document.getElementById('cfg-qty').value) || 1,
  };
  const r = await fetch('/api/algo/config', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(cfg),
  });
  const d = await r.json();
  if (d.ok) showAlert('Config saved.', 'warning');
}

// ── Bot Toggle ────────────────────────────────────────────────────────────────

async function toggleBot() {
  const endpoint = _running ? '/api/algo/stop' : '/api/algo/start';
  const r = await fetch(endpoint, { method: 'POST' });
  const d = await r.json();
  _running = d.running;
  updateBotUI(_running);
  if (_running) startCountdown();
  else           stopCountdown();
}

function updateBotUI(running) {
  _running = running;
  const btn   = document.getElementById('bot-toggle-btn');
  const dot   = document.getElementById('status-dot');
  const label = document.getElementById('bot-toggle-label');
  if (running) {
    btn.className   = 'bot-toggle running';
    dot.className   = 'status-dot on';
    label.textContent = 'BOT: ON';
    startCountdown();
  } else {
    btn.className   = 'bot-toggle stopped';
    dot.className   = 'status-dot off';
    label.textContent = 'BOT: OFF';
    stopCountdown();
    document.getElementById('countdown').textContent = '--';
  }
}

// ── Watchlist ─────────────────────────────────────────────────────────────────

async function saveWatchlist() {
  const raw = document.getElementById('wl-textarea').value.trim();
  if (!raw) return;
  const r = await fetch('/api/algo/watchlist', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ symbols: raw }),
  });
  const d = await r.json();
  renderWlTags(d.watchlist || []);
  if (d.failed && d.failed.length) {
    showAlert('Could not resolve: ' + d.failed.join(', ') + '. Check symbol spelling or download scrip master from Strategy Lab.', 'danger');
  } else {
    showAlert(`${(d.watchlist||[]).length} symbol(s) resolved and saved.`, 'warning');
  }
}

function renderWlTags(wl) {
  const el = document.getElementById('wl-tags');
  el.innerHTML = wl.map(w =>
    `<span class="wl-tag ${w.security_id ? 'ok' : 'fail'}">${w.symbol}${w.security_id ? '' : ' ✗'}</span>`
  ).join('');
}

// ── Tick ──────────────────────────────────────────────────────────────────────

async function manualTick() {
  const btn = document.getElementById('manual-tick-btn');
  btn.textContent = 'Running…';
  btn.disabled = true;
  await runTick();
  btn.textContent = 'Run Tick Now';
  btn.disabled = false;
}

async function runTick() {
  try {
    const r = await fetch('/api/algo/tick', { method: 'POST' });
    const d = await r.json();
    if (d.error) { showAlert(d.error, 'danger'); return; }
    document.getElementById('last-tick-time').textContent = 'Last tick: ' + (d.tick_time || '--');
    renderSignals(d.signals || []);
    renderOrders(d.orders || []);
    updateStatsFromTick(d);
    loadOhlcStatus();  // refresh saved files after each tick
    if (d.stopped) {
      showAlert('Daily loss limit reached. Bot has been paused for today.', 'danger');
      updateBotUI(false);
    }
  } catch(e) {
    showAlert('Tick failed: ' + e.message, 'danger');
  }
}

// ── Countdown ─────────────────────────────────────────────────────────────────

function startCountdown() {
  stopCountdown();
  _countdown = TICK_SECS;
  _updateCountEl();
  // immediate first tick
  runTick();
  _tickInterval = setInterval(runTick, TICK_SECS * 1000);
  _countTimer   = setInterval(() => {
    _countdown = Math.max(0, _countdown - 1);
    if (_countdown === 0) _countdown = TICK_SECS;
    _updateCountEl();
  }, 1000);
}

function stopCountdown() {
  if (_tickInterval)  clearInterval(_tickInterval);
  if (_countTimer)    clearInterval(_countTimer);
  _tickInterval = null;
  _countTimer   = null;
}

function _updateCountEl() {
  document.getElementById('countdown').textContent = _countdown + 's';
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderSignals(signals) {
  const el = document.getElementById('signal-row');
  if (!signals.length) return;
  el.innerHTML = signals.map(s => {
    let cls = '', label = '';
    if (s.signal === 'BUY')     { cls = 'buy';  label = `<span class="buy-label">▲ BUY ${s.price ? '@ ₹' + s.price : ''}</span>`; }
    else if (s.signal === 'SELL')  { cls = 'sell'; label = `<span class="sell-label">▼ SELL ${s.price ? '@ ₹' + s.price : ''} P&L: ₹${s.pnl??0}</span>`; }
    else if (s.signal === 'HOLD')  { label = `<span class="hold-label">— HOLD</span>`; }
    else if (s.signal === 'ERROR')      { label = `<span class="err-label">⚠ ${s.message||'Error'}</span>`; }
    else if (s.signal === 'RATE_LIMIT') { label = `<span class="err-label">⏳ Rate limit</span>`; }
    else                                { label = `<span class="hold-label">${s.signal}</span>`; }
    return `<div class="signal-pill ${cls}"><span class="sym">${s.symbol}</span>${label}</div>`;
  }).join('');
}

function renderOrders(orders) {
  const tb = document.getElementById('order-tbody');
  if (!orders.length) {
    tb.innerHTML = '<tr><td colspan="10" class="empty-msg">No orders yet.</td></tr>';
    updateStats(orders);
    return;
  }
  const rows = [...orders].reverse().map((o, i) => {
    const pnl     = o.pnl !== null && o.pnl !== undefined ? o.pnl : null;
    const pnlCls  = pnl === null ? '' : (pnl >= 0 ? 'td-pos' : 'td-neg');
    const pnlStr  = pnl === null ? '—' : `₹${pnl.toFixed(2)}`;
    const unrealPnl = (o.status === 'OPEN' && o.cmp)
      ? ((o.cmp - o.entry_price) * o.qty).toFixed(2)
      : null;
    const cmpStr  = o.cmp ? `₹${o.cmp}` : '—';
    const statusCls = o.status === 'OPEN' ? 'td-open' : 'td-closed';
    return `<tr class="clickable" onclick='openChart(${JSON.stringify(o)})'>
      <td style="color:#64748b">${orders.length - i}</td>
      <td class="td-sym">${o.symbol}</td>
      <td class="${o.side === 'BUY' ? 'td-buy' : 'td-sell'}">${o.side}</td>
      <td>₹${o.entry_price}</td>
      <td style="color:#94a3b8; font-size:11px">${o.entry_time}</td>
      <td>${cmpStr}${unrealPnl !== null ? `<br><span class="${parseFloat(unrealPnl)>=0?'td-pos':'td-neg'}" style="font-size:10px">₹${unrealPnl}</span>` : ''}</td>
      <td>${o.exit_price ? '₹'+o.exit_price : '—'}</td>
      <td style="color:#94a3b8; font-size:11px">${o.exit_time || '—'}</td>
      <td class="${pnlCls}">${pnlStr}</td>
      <td class="${statusCls}">${o.status}</td>
    </tr>`;
  }).join('');
  tb.innerHTML = rows;
  updateStats(orders);
}

function updateStats(orders) {
  const closed   = orders.filter(o => o.status === 'CLOSED');
  const realized = closed.reduce((s, o) => s + (o.pnl || 0), 0);
  const openPos  = orders.filter(o => o.status === 'OPEN');
  const unrealized = openPos.reduce((s, o) => {
    if (o.cmp == null) return s;
    return s + (o.cmp - o.entry_price) * o.qty;
  }, 0);
  const total = realized + unrealized;

  _setStatVal('stat-realized',   realized,   true);
  _setStatVal('stat-unrealized', unrealized, true);
  _setStatVal('stat-total',      total,      true);
  document.getElementById('stat-open').textContent = openPos.length;
  document.getElementById('stat-open').className   = 'value' + (openPos.length ? ' green' : '');
}

function updateStatsFromTick(d) {
  if (d.orders) renderOrders(d.orders);
}

function _setStatVal(id, val, currency) {
  const el  = document.getElementById(id);
  const str = currency ? `₹${Math.abs(val).toFixed(2)}` : val;
  el.textContent = (val < 0 ? '-' : '') + str;
  el.className   = 'value' + (val > 0 ? ' green' : val < 0 ? ' red' : '');
}

// ── Clear Orders ──────────────────────────────────────────────────────────────

async function clearOrders() {
  if (!confirm('Clear all paper orders and reset daily P&L?')) return;
  await fetch('/api/algo/orders/clear', { method: 'POST' });
  renderOrders([]);
  renderSignals([]);
  showAlert('Orders cleared.', 'warning');
}

// ── Alert ─────────────────────────────────────────────────────────────────────

let _alertTimer = null;
function showAlert(msg, type) {
  const el = document.getElementById('algo-alert');
  el.textContent = msg;
  el.className = `algo-alert ${type}`;
  if (_alertTimer) clearTimeout(_alertTimer);
  _alertTimer = setTimeout(() => { el.className = 'algo-alert'; }, 5000);
}

// ── Chart Modal (LightweightCharts) ──────────────────────────────────────────

let _lwChart = null;   // chart instance — destroyed on each open

async function openChart(order) {
  document.getElementById('chart-modal-title').textContent = `${order.symbol} — 1-min`;
  document.getElementById('chart-modal-meta').textContent =
    `Entry ₹${order.entry_price}` + (order.exit_price ? `  |  Exit ₹${order.exit_price}` : '  |  OPEN');
  document.getElementById('chart-modal-overlay').classList.add('open');

  const container = document.getElementById('algo-chart-container');
  container.innerHTML = '<div style="color:#64748b;font-size:13px;padding:180px 0;text-align:center">Loading chart…</div>';

  try {
    const r = await fetch(`/api/algo/chart/${order.security_id}`);
    const d = await r.json();
    if (d.error) {
      container.innerHTML = `<div style="color:#ef4444;font-size:13px;padding:180px 0;text-align:center">⚠ ${d.error}</div>`;
      return;
    }
    _buildLWChart(container, d, order);
  } catch(e) {
    container.innerHTML = `<div style="color:#ef4444;font-size:13px;padding:180px 0;text-align:center">Failed: ${e.message}</div>`;
  }
}

function _buildLWChart(container, data, order) {
  container.innerHTML = '';
  if (_lwChart) { try { _lwChart.remove(); } catch(_) {} _lwChart = null; }

  const chart = LightweightCharts.createChart(container, {
    width:  container.offsetWidth,
    height: 420,
    layout: { background: { color: '#0f172a' }, textColor: '#94a3b8' },
    grid:   { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: '#334155' },
    timeScale: { borderColor: '#334155', timeVisible: true, secondsVisible: false },
  });
  _lwChart = chart;

  // Candlestick series
  const cSeries = chart.addCandlestickSeries({
    upColor: '#10b981', downColor: '#ef4444',
    borderUpColor: '#10b981', borderDownColor: '#ef4444',
    wickUpColor: '#10b981', wickDownColor: '#ef4444',
  });

  // EMA series
  const emaFastSeries = chart.addLineSeries({ color: '#10b981', lineWidth: 1.5, title: `EMA${data.ema_fast_period}`, priceLineVisible: false, lastValueVisible: false });
  const emaSlowSeries = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1.5, title: `EMA${data.ema_slow_period}`, priceLineVisible: false, lastValueVisible: false });

  // Convert "HH:MM" to Unix timestamp (IST = UTC+5:30)
  const todayStr = data.date;
  function toUnix(hhmm) {
    const [hh, mm] = hhmm.split(':').map(Number);
    const d = new Date(`${todayStr}T00:00:00+05:30`);
    d.setHours(hh); d.setMinutes(mm);
    return Math.floor(d.getTime() / 1000);
  }

  const candleData = data.candles.map(c => ({
    time: toUnix(c.time), open: c.open, high: c.high, low: c.low, close: c.close,
  }));
  cSeries.setData(candleData);

  const emaFastData = data.ema_fast
    .map((v, i) => v != null ? { time: toUnix(data.candles[i].time), value: v } : null)
    .filter(Boolean);
  const emaSlowData = data.ema_slow
    .map((v, i) => v != null ? { time: toUnix(data.candles[i].time), value: v } : null)
    .filter(Boolean);
  emaFastSeries.setData(emaFastData);
  emaSlowSeries.setData(emaSlowData);

  // Entry price line
  if (order.entry_price) {
    cSeries.createPriceLine({ price: order.entry_price, color: '#6366f1', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: 'Entry' });
  }
  // Exit price line
  if (order.exit_price) {
    cSeries.createPriceLine({ price: order.exit_price, color: '#ef4444', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: 'Exit' });
  }

  chart.timeScale().fitContent();

  // Resize on window resize
  const ro = new ResizeObserver(() => chart.applyOptions({ width: container.offsetWidth }));
  ro.observe(container);
}

function closeChartModal(e) {
  if (e && e.target !== document.getElementById('chart-modal-overlay')) return;
  document.getElementById('chart-modal-overlay').classList.remove('open');
  if (_lwChart) { try { _lwChart.remove(); } catch(_) {} _lwChart = null; }
}

// ── OHLC Saved Status ────────────────────────────────────────────────────────

async function loadOhlcStatus() {
  const el = document.getElementById('ohlc-status-body');
  el.innerHTML = '<span style="color:#64748b">Loading…</span>';
  try {
    const r = await fetch('/api/algo/ohlc-saved');
    const files = await r.json();
    if (!files.length) {
      el.innerHTML = '<span style="color:#64748b">No saved files yet. Run a tick first.</span>';
      return;
    }
    // group by date
    const today = new Date().toISOString().split('T')[0];
    const todayFiles = files.filter(f => f.date === today);
    const otherFiles = files.filter(f => f.date !== today);

    let html = '';
    if (todayFiles.length) {
      html += `<div style="color:#10b981;font-weight:700;margin-bottom:6px;">Today (${today}) — ${todayFiles.length} symbols</div>`;
      html += todayFiles.map(f =>
        `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #1e293b;">
          <span style="color:#f1f5f9;font-weight:600">${f.symbol}</span>
          <span style="color:#64748b">${f.candle_count} candles · ${f.size_kb}KB · ${f.saved_at.slice(11,16)}</span>
        </div>`
      ).join('');
    }
    if (otherFiles.length) {
      html += `<div style="color:#94a3b8;margin-top:10px;margin-bottom:4px;">Older dates — ${otherFiles.length} files</div>`;
      // group by date
      const byDate = {};
      otherFiles.forEach(f => { (byDate[f.date] = byDate[f.date]||[]).push(f.symbol); });
      html += Object.entries(byDate).map(([d, syms]) =>
        `<div style="color:#64748b;padding:2px 0">${d}: ${syms.join(', ')}</div>`
      ).join('');
    }
    el.innerHTML = html;
  } catch(e) {
    el.innerHTML = `<span style="color:#ef4444">Error: ${e.message}</span>`;
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', algoInit);
