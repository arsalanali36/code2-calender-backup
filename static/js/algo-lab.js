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
    else if (s.signal === 'ERROR') { label = `<span class="err-label">⚠ ${s.message||'Error'}</span>`; }
    else                           { label = `<span class="hold-label">${s.signal}</span>`; }
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
    return `<tr>
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

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', algoInit);
