/**
 * sync-live.js
 * Auto 2-way sync between localhost and live server.
 * Only active when running on localhost / 127.0.0.1.
 *
 * On page load  → if live is newer, auto-pull + reload
 * After save    → auto-push to live (15s debounce)
 * Manual        → Pull/Push buttons still work independently
 * Toggle        → localStorage key "liveAutoSync" (default: true)
 */
(function () {
  const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!IS_LOCAL) return;

  const PUSH_DEBOUNCE_MS = 15000;
  let _pushTimer = null;
  let _busy = false;

  // ── Indicator ──────────────────────────────────────────────────────────────

  const STATES = {
    idle:    { color: '#555',    label: 'Sync',         title: 'Live sync idle' },
    waking:  { color: '#f0c040', label: 'Waking up…',  title: 'Live server so raha tha, jaag raha hai (30-60s)…' },
    checking:{ color: '#f0c040', label: 'Checking…',   title: 'Checking live server…' },
    pulling: { color: '#58a6ff', label: 'Pulling…',    title: 'Pulling from live…' },
    pushing: { color: '#f0a500', label: 'Pushing…',    title: 'Pushing to live…' },
    synced:  { color: '#3fb950', label: 'Synced ✓',    title: 'Synced with live ✓' },
    error:   { color: '#f85149', label: 'Sync Error',  title: 'Sync error — check console' },
    offline: { color: '#555',    label: 'Offline',     title: 'Live server unreachable' },
  };

  function setStatus(key) {
    const s = STATES[key] || STATES.idle;
    const circle = document.getElementById('live-sync-circle');
    const label  = document.getElementById('live-sync-label');
    const wrap   = document.getElementById('live-sync-dot');
    if (circle) circle.style.background = s.color;
    if (label)  label.textContent = s.label;
    if (wrap)   wrap.title = s.title;
  }

  // ── Auto-sync enabled toggle ───────────────────────────────────────────────

  function isEnabled() { return localStorage.getItem('liveAutoSync') !== 'false'; }

  function _updateToggleLabel() {
    const btn = document.getElementById('auto-sync-toggle-btn');
    if (btn) btn.textContent = isEnabled() ? '⏸ Auto Sync: ON' : '▶ Auto Sync: OFF';
  }

  window.toggleAutoSync = function () {
    localStorage.setItem('liveAutoSync', isEnabled() ? 'false' : 'true');
    _updateToggleLabel();
    setStatus(isEnabled() ? 'idle' : 'idle');
    if (isEnabled()) checkAndAutoPull();
  };

  // ── Core helpers ───────────────────────────────────────────────────────────

  async function _fetchStatus() {
    const res = await fetch('/api/sync/status');
    if (!res.ok) throw new Error(`status ${res.status}`);
    return res.json();
  }

  async function _doPull(email, password) {
    const body = (email && password) ? JSON.stringify({ email, password }) : '{}';
    const res = await fetch('/api/pull-from-live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    return res.json();
  }

  function _promptCredentials() {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center';
      overlay.innerHTML = `
        <div style="background:#1e1e2e;border:1px solid #444;border-radius:10px;padding:28px 32px;min-width:320px;color:#e0e0e0;font-family:monospace">
          <div style="font-size:15px;margin-bottom:16px;font-weight:600">🔐 Live Server Login</div>
          <div style="font-size:12px;color:#aaa;margin-bottom:14px">API key mismatch — apna live server login use karein</div>
          <input id="_pull_email" type="email" placeholder="Email" style="width:100%;padding:8px 10px;margin-bottom:10px;background:#111;border:1px solid #555;border-radius:6px;color:#fff;box-sizing:border-box;font-size:13px">
          <input id="_pull_pass" type="password" placeholder="Password" style="width:100%;padding:8px 10px;background:#111;border:1px solid #555;border-radius:6px;color:#fff;box-sizing:border-box;font-size:13px">
          <div style="display:flex;gap:10px;margin-top:18px">
            <button id="_pull_ok" style="flex:1;padding:9px;background:#238636;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:13px">Pull Data</button>
            <button id="_pull_cancel" style="flex:1;padding:9px;background:#333;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:13px">Cancel</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#_pull_ok').onclick = () => {
        const e = overlay.querySelector('#_pull_email').value.trim();
        const p = overlay.querySelector('#_pull_pass').value;
        document.body.removeChild(overlay);
        resolve(e && p ? { email: e, password: p } : null);
      };
      overlay.querySelector('#_pull_cancel').onclick = () => {
        document.body.removeChild(overlay);
        resolve(null);
      };
      overlay.querySelector('#_pull_pass').addEventListener('keydown', ev => {
        if (ev.key === 'Enter') overlay.querySelector('#_pull_ok').click();
      });
      setTimeout(() => overlay.querySelector('#_pull_email').focus(), 50);
    });
  }

  async function _doPush() {
    const res = await fetch('/api/push-to-live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    return res.json();
  }

  // ── On page load: auto-pull if live is newer ───────────────────────────────

  async function checkAndAutoPull() {
    if (!isEnabled() || _busy) return;
    _busy = true;
    setStatus('waking');
    try {
      const status = await _fetchStatus();
      setStatus('checking');
      if (!status.ok) { setStatus('offline'); return; }

      if (status.direction === 'pull') {
        setStatus('pulling');
        if (typeof showToast === 'function') showToast('Live data is newer — pulling…', '');
        let result = await _doPull();
        if (result.needs_credentials) {
          setStatus('idle');
          const creds = await _promptCredentials();
          if (!creds) { setStatus('idle'); return; }
          setStatus('pulling');
          result = await _doPull(creds.email, creds.password);
        }
        if (result.ok) {
          setStatus('synced');
          if (typeof showToast === 'function') showToast(`Pulled from live (${result.trades} trades) — reloading…`, 'success');
          setTimeout(() => location.reload(), 1400);
        } else {
          setStatus('error');
          if (typeof showToast === 'function') showToast(`Pull failed: ${result.error}`, 'error');
          console.error('[sync-live] pull failed:', result.error);
        }
      } else if (status.direction === 'safe_skip') {
        // Live has significantly fewer trades — likely bootstrap/corrupt data, skip auto-pull
        console.warn(`[sync-live] auto-pull skipped: live=${status.live_trades} trades < local=${status.local_trades} trades`);
        if (typeof showToast === 'function') showToast(`Sync skipped: live has ${status.live_trades} trades vs local ${status.local_trades} — use manual Push to fix`, 'warning');
        setStatus('synced');
      } else {
        setStatus('synced');
      }
    } catch (e) {
      setStatus('offline');
      console.warn('[sync-live] could not reach live server:', e.message);
    } finally {
      _busy = false;
    }
  }

  // ── After save: debounced auto-push ───────────────────────────────────────

  function scheduleAutoPush() {
    if (!isEnabled()) return;
    clearTimeout(_pushTimer);
    setStatus('checking');
    _pushTimer = setTimeout(async () => {
      if (_busy) return;
      _busy = true;
      setStatus('pushing');
      try {
        const result = await _doPush();
        setStatus(result.ok ? 'synced' : 'error');
        if (!result.ok) console.error('[sync-live] push failed:', result.error);
      } catch (e) {
        setStatus('error');
        console.error('[sync-live] push error:', e.message);
      } finally {
        _busy = false;
      }
    }, PUSH_DEBOUNCE_MS);
  }

  // ── Keep live server awake (ping every 10 min) ────────────────────────────

  function _pingLive() {
    fetch('/api/sync/status').catch(() => {});
  }
  setInterval(_pingLive, 10 * 60 * 1000);

  // ── Init ──────────────────────────────────────────────────────────────────

  window.addEventListener('tradesaved', scheduleAutoPush);

  window.addEventListener('load', () => {
    _updateToggleLabel();
    setTimeout(checkAndAutoPull, 1800);
  });
})();
