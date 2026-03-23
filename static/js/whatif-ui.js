
// ── State ────────────────────────────────────────────────────
let _scripTimeout = null;
let _fixingSymbol = null;   // which symbol is being manually fixed

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadDhanConfig();
  loadSymbolMap();

  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('date-from').value = '2026-01-01';
  document.getElementById('date-to').value   = today;

  document.addEventListener('click', e => {
    if (!e.target.closest('.scrip-search-wrap'))
      document.querySelectorAll('.scrip-results').forEach(el => el.classList.add('hidden'));
  });
});

// ── Accordion ────────────────────────────────────────────────
function toggleCard(id) {
  document.getElementById(id).classList.toggle('open');
}

// ── Dhan Config ───────────────────────────────────────────────
async function loadDhanConfig() {
  const r = await fetch('/api/whatif/config');
  const d = await r.json();
  if (d.configured) {
    document.getElementById('dhan-client-id').value   = d.client_id;
    document.getElementById('dhan-token').placeholder = d.access_token_masked;
    if (d.hours_ago != null) {
      const h     = d.hours_ago;
      const stale = h >= 20;
      const label = h < 1 ? 'just now' : `${h}h ago`;
      const msg   = stale ? `⚠ Token ${label} — update soon` : `✓ Token saved ${label}`;
      setStatus('cfg-status', msg, stale ? 'var(--red)' : 'var(--green)');
    } else {
      setStatus('cfg-status', '✓ Credentials saved', 'var(--green)');
    }
  }
}

async function saveDhanConfig() {
  const client_id    = document.getElementById('dhan-client-id').value.trim();
  const access_token = document.getElementById('dhan-token').value.trim();
  if (!client_id || !access_token) {
    setStatus('cfg-status', 'Both fields required', 'var(--red)'); return;
  }
  const r = await fetch('/api/whatif/config', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ client_id, access_token })
  });
  const d = await r.json();
  setStatus('cfg-status', d.ok ? '✓ Saved' : d.error, d.ok ? 'var(--green)' : 'var(--red)');
}

// ── Auto Map ──────────────────────────────────────────────────
function clearMapDates() {
  document.getElementById('map-date-from').value = '';
  document.getElementById('map-date-to').value   = '';
}

async function autoMapAll() {
  const btn      = document.getElementById('btn-auto-map');
  const dateFrom = document.getElementById('map-date-from').value;
  const dateTo   = document.getElementById('map-date-to').value;
  btn.disabled   = true;

  const rangeLabel = dateFrom || dateTo
    ? ` (${dateFrom || '…'} → ${dateTo || '…'})`
    : ' (all trades)';
  setStatus('auto-map-status', `⏳ Matching${rangeLabel}…`, 'var(--text2)');

  try {
    const body = {};
    if (dateFrom) body.date_from = dateFrom;
    if (dateTo)   body.date_to   = dateTo;

    const r = await fetch('/api/whatif/auto-map', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    const d = await r.json();
    if (d.error) { setStatus('auto-map-status', d.error, 'var(--red)'); return; }

    setStatus('auto-map-status',
      `✓ Auto-saved ${d.saved} instruments. Review below.`,
      'var(--green)');

    renderAutoMapResults(d.results);
    loadSymbolMap();   // refresh the saved-mappings table
  } catch(e) {
    setStatus('auto-map-status', 'Error: ' + e.message, 'var(--red)');
  } finally {
    btn.disabled = false;
  }
}

function renderAutoMapResults(results) {
  const wrap = document.getElementById('auto-map-results');
  const syms = Object.keys(results);
  if (!syms.length) { wrap.innerHTML = '<p class="hint">No instruments found in trades.</p>'; return; }

  wrap.innerHTML = `
    <table class="map-table" style="margin-top:14px;">
      <thead><tr>
        <th>Your Instrument</th>
        <th>Trade Date</th>
        <th>Matched Scrip</th>
        <th>Expiry Date</th>
        <th>Security ID</th>
        <th>Segment</th>
        <th>Confidence</th>
        <th>Action</th>
      </tr></thead>
      <tbody>
        ${syms.map(sym => {
          const res = results[sym];
          const conf = res.confidence || 0;

          // Expired option — handled by rollingoption, no security_id needed
          if (res.expired_opt) {
            return `<tr id="amrow-${_esc(sym)}">
              <td><strong>${sym}</strong></td>
              <td class="dim">${res.trade_date || '—'}</td>
              <td class="dim">—</td>
              <td style="color:var(--blue);font-weight:600;">${res.expiry || '—'}</td>
              <td class="dim">—</td>
              <td class="dim">NSE_FNO</td>
              <td><span class="badge badge-blue" title="Expired — OHLC via rollingoption, no security ID needed">Expired ✓</span></td>
              <td><span class="hint" style="font-size:.75rem;">auto via rollingoption</span></td>
            </tr>
            <tr id="fixrow-${_esc(sym)}" style="display:none;"><td colspan="8"></td></tr>`;
          }

          const confCls = conf >= 90 ? 'badge-green' : conf >= 70 ? 'badge-orange' : 'badge-red';
          const confTxt = conf >= 90 ? 'High' : conf >= 70 ? 'Medium' : conf > 0 ? 'Low' : 'No match';
          const savedLabel = conf >= 70
            ? '<span class="badge badge-green" style="font-size:.7rem;">Auto-saved</span>'
            : '<span class="badge badge-red"   style="font-size:.7rem;">Not saved</span>';
          return `<tr id="amrow-${_esc(sym)}">
            <td><strong>${sym}</strong></td>
            <td class="dim">${res.trade_date || '—'}</td>
            <td class="dim">${res.matched_symbol || '—'}</td>
            <td class="${res.expiry ? '' : 'dim'}" style="font-weight:${res.expiry?'600':'normal'};color:${res.expiry?'var(--orange)':''};">${res.expiry || '—'}</td>
            <td>${res.security_id || '—'}</td>
            <td>${res.exchange_segment || '—'}</td>
            <td><span class="badge ${confCls}">${confTxt} (${conf}%)</span></td>
            <td style="display:flex;gap:6px;align-items:center;">
              ${savedLabel}
              <button class="btn-wi btn-outline btn-sm" onclick="openManualFix('${_esc(sym)}')">Fix</button>
            </td>
          </tr>
          <tr id="fixrow-${_esc(sym)}" style="display:none;">
            <td colspan="8">
              <div style="padding:8px 0;display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">
                <div style="position:relative;flex:1;min-width:200px;">
                  <input type="text" id="fix-search-${_esc(sym)}"
                    class="fix-search" placeholder="Search scrip master…"
                    data-sym="${_esc(sym)}"
                    oninput="onFixSearch(this)"
                    autocomplete="off"
                    style="width:100%;background:var(--surface2);border:1px solid var(--border2);
                           color:var(--text);padding:7px 10px;border-radius:var(--radius);font-size:.82rem;"/>
                  <div id="fix-results-${_esc(sym)}" class="scrip-results hidden"></div>
                </div>
                <input type="text" id="fix-secid-${_esc(sym)}" placeholder="Security ID"
                  style="width:110px;background:var(--surface2);border:1px solid var(--border2);
                         color:var(--text);padding:7px 10px;border-radius:var(--radius);font-size:.82rem;"/>
                <select id="fix-seg-${_esc(sym)}"
                  style="background:var(--surface2);border:1px solid var(--border2);color:var(--text);
                         padding:7px 10px;border-radius:var(--radius);font-size:.82rem;">
                  <option value="NSE_FNO">NSE_FNO</option>
                  <option value="NSE_EQ">NSE_EQ</option>
                  <option value="MCX_COMM">MCX_COMM</option>
                </select>
                <select id="fix-inst-${_esc(sym)}"
                  style="background:var(--surface2);border:1px solid var(--border2);color:var(--text);
                         padding:7px 10px;border-radius:var(--radius);font-size:.82rem;">
                  <option value="OPTIDX">OPTIDX</option>
                  <option value="OPTSTK">OPTSTK</option>
                  <option value="EQUITY">EQUITY</option>
                  <option value="FUTIDX">FUTIDX</option>
                </select>
                <button class="btn-wi btn-success btn-sm" onclick="saveFixedMapping('${_esc(sym)}')">Save</button>
                <button class="btn-wi btn-outline btn-sm" onclick="closeManualFix('${_esc(sym)}')">Cancel</button>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function openManualFix(sym) {
  document.getElementById(`fixrow-${sym}`).style.display = '';
  document.getElementById(`fix-search-${sym}`).focus();
}

function closeManualFix(sym) {
  document.getElementById(`fixrow-${sym}`).style.display = 'none';
}

function onFixSearch(input) {
  const sym = input.dataset.sym;
  clearTimeout(_scripTimeout);
  if (input.value.length < 2) {
    document.getElementById(`fix-results-${sym}`).classList.add('hidden'); return;
  }
  _scripTimeout = setTimeout(() => doFixSearch(sym, input.value), 350);
}

async function doFixSearch(sym, q) {
  const r = await fetch(`/api/whatif/scrip/search?q=${encodeURIComponent(q)}`);
  const d = await r.json();
  const box = document.getElementById(`fix-results-${sym}`);
  if (!d.results || !d.results.length) { box.classList.add('hidden'); return; }

  box.innerHTML = d.results.map(item => `
    <div class="scrip-item"
      onclick="selectFixResult('${sym}',${JSON.stringify(item).replace(/"/g,'&quot;')})">
      <span class="s-sym">${item.symbol || item.security_id}</span>
      <span class="s-meta">ID:${item.security_id} | ${item.exchange_segment} | ${item.instrument}
        ${item.strike ? '| K:'+item.strike : ''} ${item.option_type || ''}</span>
    </div>`).join('');
  box.classList.remove('hidden');
}

function selectFixResult(sym, item) {
  document.getElementById(`fix-search-${sym}`).value = item.symbol || item.security_id;
  document.getElementById(`fix-secid-${sym}`).value  = item.security_id;
  if (item.exchange_segment)
    document.getElementById(`fix-seg-${sym}`).value  = item.exchange_segment;
  if (item.instrument)
    document.getElementById(`fix-inst-${sym}`).value = item.instrument;
  document.getElementById(`fix-results-${sym}`).classList.add('hidden');
}

async function saveFixedMapping(sym) {
  const security_id      = document.getElementById(`fix-secid-${sym}`).value.trim();
  const exchange_segment = document.getElementById(`fix-seg-${sym}`).value;
  const instrument       = document.getElementById(`fix-inst-${sym}`).value;
  if (!security_id) { alert('Enter or search a Security ID first'); return; }

  await fetch('/api/whatif/symbol-map', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ symbol: sym, security_id, exchange_segment, instrument })
  });
  closeManualFix(sym);
  loadSymbolMap();
}

// ── Saved Mappings table ──────────────────────────────────────
async function loadSymbolMap() {
  const r = await fetch('/api/whatif/symbol-map');
  const d = await r.json();
  renderSavedMappings(d);
  const count = Object.keys(d).length;
  document.getElementById('mapper-count').textContent = count + ' mapped';
}

function renderSavedMappings(mapping) {
  const keys = Object.keys(mapping);
  const wrap = document.getElementById('saved-mappings-wrap');
  if (!keys.length) {
    wrap.innerHTML = '<p class="hint" style="margin-top:12px;">No mappings saved yet. Click Auto Map to start.</p>';
    return;
  }
  wrap.innerHTML = `
    <table class="map-table" style="margin-top:14px;">
      <thead><tr>
        <th>Instrument</th><th>Security ID</th><th>Segment</th><th>Type</th><th></th>
      </tr></thead>
      <tbody>
        ${keys.map(sym => {
          const info = mapping[sym];
          return `<tr>
            <td><strong>${sym}</strong></td>
            <td>${info.security_id}</td>
            <td>${info.exchange_segment}</td>
            <td>${info.instrument}</td>
            <td>
              <button class="btn-wi btn-outline btn-sm" onclick="deleteMapping('${_esc(sym)}')">&#10005;</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

async function deleteMapping(symbol) {
  if (!confirm(`Remove mapping for ${symbol}?`)) return;
  await fetch('/api/whatif/symbol-map', {
    method: 'DELETE', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ symbol })
  });
  loadSymbolMap();
}

// ── OHLC Status ───────────────────────────────────────────────
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
  const tbody = document.getElementById('wi-results-body');
  if (!trades || !trades.length) {
    tbody.innerHTML = '<tr><td colspan="18" style="text-align:center;color:var(--text2);padding:20px;">No results</td></tr>';
    return;
  }
  tbody.innerHTML = trades.map(t => {
    const hasData = t.exit_reason !== 'no_ohlc';
    return `<tr>
      <td>${t.date || ''}</td>
      <td class="dim" style="font-weight:600;color:var(--accent)">${t.t_num || ''}</td>
      <td class="dim">${(t.time || '').slice(0,5)}</td>
      <td class="dim">${t.exit_time || '—'}</td>
      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;" title="${t.instrument}"><span class="wi-inst-link" onclick="openOhlcChart('${t.instrument}','${t.date}',${t.entry||0},'${t.direction||'SHORT'}','${(t.time||'').slice(0,5)}','${t.exit_time||''}')">${t.instrument}</span></td>
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
let _ohlcChart = null;

async function openOhlcChart(symbol, date, entry, direction, entryTime, exitTime) {
  const modal = document.getElementById('ohlc-chart-modal');
  const title = document.getElementById('ohlc-chart-title');
  title.textContent = `${symbol}  ·  ${date}  ·  Loading…`;
  modal.style.display = 'flex';

  try {
    const r = await fetch(`/api/whatif/ohlc-data?symbol=${encodeURIComponent(symbol)}&date=${encodeURIComponent(date)}`);
    const d = await r.json();
    if (d.error) { title.textContent = `${symbol} — ${d.error}`; return; }

    const sl  = parseFloat(document.getElementById('sl-pts').value)     || 15;
    const tgt = parseFloat(document.getElementById('target-pts').value) || 30;
    const isShort  = direction === 'SHORT';
    const slLevel  = isShort ? entry + sl  : entry - sl;
    const tgtLevel = isShort ? entry - tgt : entry + tgt;

    title.textContent = `${symbol}  ·  ${date}  ·  Entry ${entry}  ·  ${isShort?'SHORT':'LONG'}  ·  SL ${sl}  ·  Target ${tgt}`;
    drawOhlcChart(d.candles, entry, slLevel, tgtLevel, entryTime, exitTime);
  } catch(e) {
    title.textContent = `${symbol} — Error: ${e.message}`;
  }
}

function closeOhlcChart() {
  document.getElementById('ohlc-chart-modal').style.display = 'none';
  if (_ohlcChart) { _ohlcChart.remove(); _ohlcChart = null; }
}

function drawOhlcChart(candles, entry, slLevel, tgtLevel, entryTime, exitTime) {
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

  const series = _ohlcChart.addCandlestickSeries({
    upColor:          '#26a69a', downColor:       '#ef5350',
    borderUpColor:    '#26a69a', borderDownColor: '#ef5350',
    wickUpColor:      '#26a69a', wickDownColor:   '#ef5350',
  });

  series.setData(data);

  // Entry / SL / Target price lines
  series.createPriceLine({ price: entry,    color: '#5599ff', lineWidth: 2, lineStyle: LightweightCharts.LineStyle.Solid,  axisLabelVisible: true, title: 'Entry' });
  series.createPriceLine({ price: slLevel,  color: '#ff5555', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: 'SL' });
  series.createPriceLine({ price: tgtLevel, color: '#44dd88', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: 'Target' });

  // Entry / exit markers — match by HH:MM label
  const markers = [];
  if (entryTime) {
    const idx = _timeLabels.indexOf(entryTime);
    if (idx >= 0) markers.push({ time: idx, position: 'belowBar', color: '#5599ff', shape: 'arrowUp',   text: 'Entry' });
  }
  if (exitTime) {
    const idx = _timeLabels.indexOf(exitTime);
    if (idx >= 0) markers.push({ time: idx, position: 'aboveBar', color: '#ffaa33', shape: 'arrowDown', text: 'Exit' });
  }
  if (markers.length) series.setMarkers(markers.sort((a,b) => a.time - b.time));

  _ohlcChart.timeScale().fitContent();
}

// Close modal on backdrop click
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ohlc-chart-modal').addEventListener('click', function(e) {
    if (e.target === this) closeOhlcChart();
  });
});
