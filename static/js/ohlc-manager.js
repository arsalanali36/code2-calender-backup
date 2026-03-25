/**
 * ohlc-manager.js
 * ---------------
 * OHLC Data Manager modal — accessible from the profile dropdown.
 * Reuses existing /api/whatif/* endpoints (Dhan credentials, scrip master,
 * tradebook import, OHLC status, SSE sync).
 */

(function () {

  // ── State ───────────────────────────────────────────────────────────────────
  let _syncEs = null;

  // ── Open / Close ────────────────────────────────────────────────────────────

  function openOhlcManager() {
    const modal = document.getElementById('ohlc-mgr-modal');
    if (!modal) return;
    modal.classList.add('open');
    // Close profile dropdown
    const pd = document.getElementById('profile-dropdown');
    if (pd) pd.classList.remove('open');
    loadCredentials();
  }

  function closeOhlcManager() {
    const modal = document.getElementById('ohlc-mgr-modal');
    if (modal) modal.classList.remove('open');
    if (_syncEs) { _syncEs.close(); _syncEs = null; }
  }

  // ── Credentials ─────────────────────────────────────────────────────────────

  async function loadCredentials() {
    const el = document.getElementById('ohlc-cred-status');
    if (!el) return;
    el.innerHTML = '<span style="opacity:0.4">Loading...</span>';
    try {
      const r = await fetch('/api/whatif/config');
      const d = await r.json();
      if (d.configured) {
        const age = d.hours_ago != null
          ? `<span class="ohlc-cred-age">${d.hours_ago}h ago</span>` : '';
        el.innerHTML = `
          <span class="ohlc-cred-ok">&#10003; Configured</span>
          ${age}
          <span style="opacity:0.45;font-size:0.78rem;margin-left:6px;">ID: ${d.client_id}</span>
          <button class="btn btn-outline btn-sm" id="ohlc-cred-edit-btn" style="margin-left:8px;">Edit</button>
        `;
        document.getElementById('ohlc-cred-edit-btn').onclick = showCredForm;
      } else {
        el.innerHTML = `
          <span style="color:var(--red)">Not configured</span>
          <button class="btn btn-outline btn-sm" id="ohlc-cred-edit-btn" style="margin-left:8px;">Configure</button>
        `;
        document.getElementById('ohlc-cred-edit-btn').onclick = showCredForm;
        showCredForm();
      }
    } catch (e) {
      el.innerHTML = '<span style="color:var(--red)">Failed to load credentials</span>';
    }
  }

  function showCredForm() {
    const form = document.getElementById('ohlc-cred-form');
    if (form) {
      form.style.display = 'flex';
      document.getElementById('ohlc-client-id').focus();
    }
  }

  async function saveCredentials() {
    const clientId    = (document.getElementById('ohlc-client-id').value || '').trim();
    const accessToken = (document.getElementById('ohlc-access-token').value || '').trim();
    if (!clientId || !accessToken) {
      showToast('Client ID and Access Token are required', 'error');
      return;
    }
    try {
      const r = await fetch('/api/whatif/config', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ client_id: clientId, access_token: accessToken }),
      });
      const d = await r.json();
      if (d.ok) {
        document.getElementById('ohlc-cred-form').style.display = 'none';
        document.getElementById('ohlc-client-id').value    = '';
        document.getElementById('ohlc-access-token').value = '';
        await loadCredentials();
        showToast('Credentials saved');
      } else {
        showToast(d.error || 'Save failed', 'error');
      }
    } catch (e) {
      showToast('Save failed: ' + e.message, 'error');
    }
  }

  // ── Tradebook CSV Import ─────────────────────────────────────────────────────

  function bindTradebook() {
    const input  = document.getElementById('ohlc-tradebook-input');
    const btn    = document.getElementById('ohlc-tradebook-btn');
    const fname  = document.getElementById('ohlc-tradebook-fname');
    const impBtn = document.getElementById('ohlc-tradebook-import');

    btn.onclick    = () => input.click();
    input.onchange = () => {
      const f = input.files[0];
      if (f) {
        fname.textContent  = f.name;
        impBtn.disabled    = false;
      }
    };

    impBtn.onclick = async () => {
      const f = input.files[0];
      if (!f) return;
      impBtn.disabled    = true;
      impBtn.textContent = 'Importing...';
      const fd = new FormData();
      fd.append('file', f);
      try {
        const r = await fetch('/api/whatif/import-tradebook', { method: 'POST', body: fd });
        const d = await r.json();
        if (d.ok) {
          showToast(`Imported: ${d.imported} symbols, ${d.pairs} trade pairs`);
          appendLog(`Tradebook imported — ${d.imported} symbols, ${d.pairs} (symbol, date) pairs`);
          await loadStatus();
        } else {
          showToast(d.error || 'Import failed', 'error');
          appendLog('Tradebook import failed: ' + (d.error || ''), false);
        }
      } catch (e) {
        showToast('Import error: ' + e.message, 'error');
      } finally {
        impBtn.disabled    = false;
        impBtn.textContent = 'Import';
      }
    };
  }

  // ── Instruments Status Table ─────────────────────────────────────────────────

  async function loadStatus() {
    const tbody = document.getElementById('ohlc-instruments-tbody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;opacity:0.4;padding:14px;">Loading...</td></tr>';
    try {
      const r     = await fetch('/api/whatif/ohlc-status');
      const items = await r.json();
      renderStatusTable(items);
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" style="color:var(--red);padding:14px;">Error: ${e.message}</td></tr>`;
    }
  }

  function renderStatusTable(items) {
    const tbody = document.getElementById('ohlc-instruments-tbody');

    // Aggregate per symbol
    const bySymbol = {};
    for (const item of items) {
      const sym = item.symbol;
      if (!bySymbol[sym]) {
        bySymbol[sym] = { symbol: sym, total: 0, fetched: 0, mapped: false };
      }
      const s  = bySymbol[sym];
      const st = item.status || '';
      s.total++;
      if (st === 'complete')   s.fetched++;
      if (st !== 'not_mapped') s.mapped = true;
    }

    const rows = Object.values(bySymbol).sort((a, b) => a.symbol.localeCompare(b.symbol));

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;opacity:0.4;padding:14px;">No trades found in journal</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(row => {
      const pct = row.total > 0 ? row.fetched / row.total : 0;
      let statusHtml;
      if (!row.mapped) {
        statusHtml = '<span class="ohlc-status-dot ohlc-status-unmapped" title="Not mapped to Dhan security ID">?</span>';
      } else if (pct >= 1) {
        statusHtml = '<span class="ohlc-status-dot ohlc-status-ok" title="All dates fetched">&#10003;</span>';
      } else if (pct > 0) {
        statusHtml = `<span class="ohlc-status-dot ohlc-status-partial" title="${row.fetched}/${row.total} dates fetched">&#9651;</span>`;
      } else {
        statusHtml = '<span class="ohlc-status-dot ohlc-status-missing" title="No OHLC data yet">&#10007;</span>';
      }

      const mappedHtml = row.mapped
        ? '<span style="color:var(--green)">&#10003;</span>'
        : '<span style="opacity:0.3">&#8212;</span>';

      const ohlcHtml = row.fetched + '<span style="opacity:0.4">/' + row.total + '</span>';

      return `<tr>
        <td class="ohlc-sym-cell" title="${row.symbol}">${row.symbol}</td>
        <td style="text-align:center">${row.total}</td>
        <td style="text-align:center">${mappedHtml}</td>
        <td style="text-align:center">${ohlcHtml}</td>
        <td style="text-align:center">${statusHtml}</td>
      </tr>`;
    }).join('');
  }

  // ── Scrip Master Download ────────────────────────────────────────────────────

  async function downloadScripMaster() {
    const btn = document.getElementById('ohlc-scrip-dl-btn');
    btn.disabled    = true;
    btn.textContent = 'Downloading...';
    appendLog('Downloading Dhan scrip master from images.dhan.co...');
    try {
      const r = await fetch('/api/whatif/scrip/download', { method: 'POST' });
      const d = await r.json();
      if (d.ok) {
        appendLog('Scrip master downloaded and cached successfully.');
        showToast('Scrip master downloaded');
      } else {
        appendLog('Download failed: ' + (d.error || ''), false);
        showToast(d.error || 'Download failed', 'error');
      }
    } catch (e) {
      appendLog('Download error: ' + e.message, false);
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Download Scrip Master';
    }
  }

  // ── SSE Sync All ─────────────────────────────────────────────────────────────

  function startSyncAll() {
    if (_syncEs) { _syncEs.close(); _syncEs = null; }

    const syncBtn         = document.getElementById('ohlc-sync-all-btn');
    syncBtn.disabled      = true;
    syncBtn.innerHTML     = 'Syncing...';
    appendLog('─── Starting full OHLC sync ───');

    _syncEs = new EventSource('/api/whatif/sync-all-ohlc');

    _syncEs.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        appendLog(d.msg, d.ok !== false);
        if (d.done) {
          _syncEs.close();
          _syncEs = null;
          syncBtn.disabled    = false;
          syncBtn.innerHTML = '&#9654; Sync All OHLC';
          loadStatus();
        }
      } catch (_) {}
    };

    _syncEs.onerror = () => {
      appendLog('SSE connection closed — sync may have completed.', false);
      if (_syncEs) { _syncEs.close(); _syncEs = null; }
      syncBtn.disabled    = false;
      syncBtn.textContent = '&#9654; Sync All OHLC';
      loadStatus();
    };
  }

  // ── Log ──────────────────────────────────────────────────────────────────────

  function appendLog(msg, ok = true) {
    const log  = document.getElementById('ohlc-sync-log');
    if (!log) return;
    const line = document.createElement('div');
    line.className   = 'ohlc-log-line' + (ok ? '' : ' ohlc-log-err');
    line.textContent = msg;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  // ── Bind events ──────────────────────────────────────────────────────────────

  function bindEvents() {
    document.getElementById('ohlc-mgr-close').onclick     = closeOhlcManager;
    document.getElementById('ohlc-mgr-close-btn').onclick = closeOhlcManager;
    document.getElementById('ohlc-cred-save').onclick     = saveCredentials;
    document.getElementById('ohlc-cred-cancel').onclick   = () => {
      document.getElementById('ohlc-cred-form').style.display = 'none';
    };
    document.getElementById('ohlc-status-refresh-btn').onclick = loadStatus;
    document.getElementById('ohlc-scrip-dl-btn').onclick        = downloadScripMaster;
    document.getElementById('ohlc-sync-all-btn').onclick        = startSyncAll;
    document.getElementById('ohlc-log-clear-btn').onclick       = () => {
      document.getElementById('ohlc-sync-log').innerHTML = '';
    };

    // Profile dropdown button
    const ohlcBtn = document.getElementById('profile-ohlc-btn');
    if (ohlcBtn) ohlcBtn.onclick = openOhlcManager;

    // Close on overlay backdrop click
    document.getElementById('ohlc-mgr-modal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('ohlc-mgr-modal')) closeOhlcManager();
    });

    bindTradebook();
  }

  // ── Public ───────────────────────────────────────────────────────────────────
  window.openOhlcManager  = openOhlcManager;
  window.closeOhlcManager = closeOhlcManager;

  // Auto-bind when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

})();
