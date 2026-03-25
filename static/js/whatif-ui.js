
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
