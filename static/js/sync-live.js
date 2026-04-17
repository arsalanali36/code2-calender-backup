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

  function _indicator() { return document.getElementById('live-sync-dot'); }

  const STATES = {
    idle:     { color: '#555',    title: 'Live sync idle' },
    checking: { color: '#f0c040', title: 'Checking live...' },
    pulling:  { color: '#58a6ff', title: 'Pulling from live...' },
    pushing:  { color: '#f0a500', title: 'Pushing to live...' },
    synced:   { color: '#3fb950', title: 'Synced with live ✓' },
    error:    { color: '#f85149', title: 'Sync error — check console' },
    offline:  { color: '#555',    title: 'Live server unreachable' },
  };

  function setStatus(key) {
    const dot = _indicator();
    if (!dot) return;
    const s = STATES[key] || STATES.idle;
    dot.style.background = s.color;
    dot.title = s.title;
    dot.dataset.state = key;
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

  async function _doPull() {
    const res = await fetch('/api/pull-from-live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    return res.json();
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
    setStatus('checking');
    try {
      const status = await _fetchStatus();
      if (!status.ok) { setStatus('offline'); return; }

      if (status.direction === 'pull') {
        setStatus('pulling');
        if (typeof showToast === 'function') showToast('Live data is newer — auto-pulling…', '');
        const result = await _doPull();
        if (result.ok) {
          setStatus('synced');
          if (typeof showToast === 'function') showToast(`Auto-pulled from live (${result.trades} trades) — reloading…`, 'success');
          setTimeout(() => location.reload(), 1400);
        } else {
          setStatus('error');
          console.error('[sync-live] pull failed:', result.error);
        }
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

  // ── Init ──────────────────────────────────────────────────────────────────

  window.addEventListener('tradesaved', scheduleAutoPush);

  window.addEventListener('load', () => {
    _updateToggleLabel();
    setTimeout(checkAndAutoPull, 1800); // wait for page to settle
  });
})();
