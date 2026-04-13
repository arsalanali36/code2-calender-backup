/**
 * @fileoverview events-gallery-d.js
 * @description Gallery panel resizers, ULP state restore, and ctrl+drag thumbnail selection.
 *   Extracted from events-gallery.js to keep that file under 30 KB.
 * @exports setupPanelResizer, _bindGalleryPanelResizers, _bindGalleryULPState, _bindGalleryCtrlDrag
 * @reads state.gallery.selectedIndices
 * @calls switchULPTab, renderGallery, renderGalleryTagFilterPanel
 */

// ── Panel Resizer (Mouse + Touch) ────────────────────────────────────────────
function setupPanelResizer(handleId, panelId, localStorageKey, direction, minW = 140, maxW = 480) {
  const handle = document.getElementById(handleId);
  const panel = document.getElementById(panelId);
  if (!handle || !panel) return;

  const _setWidth = (w) => {
    const finalW = Math.max(minW, Math.min(maxW, w));
    if (panelId === 'gv2-unified-left-panel') {
      panel.style.setProperty('--ulp-panel-w', finalW + 'px');
    } else if (panelId === 'gv2-thumb-panel') {
      panel.style.setProperty('--thumb-panel-w', finalW + 'px');
    } else {
      panel.style.width = finalW + 'px';
    }
    if (panelId === 'gv2-layer-panel') {
      panel.style.setProperty('--lp-thumb-w', Math.max(24, Math.min(80, Math.floor(finalW * 0.22))) + 'px');
    }
    if (localStorageKey) localStorage.setItem(localStorageKey, finalW);
  };

  let _startX = 0, _startW = 0;

  const _onMove = (clientX) => {
    const dx = clientX - _startX;
    const newW = (direction === 'right') ? (_startW + dx) : (_startW - dx);
    _setWidth(newW);
  };

  // ── Mouse ──────────────────────────────────────────────
  const onMouseMove = (e) => _onMove(e.clientX);
  const onMouseUp = () => {
    handle.classList.remove('dragging');
    panel.classList.remove('is-resizing');
    panel.style.transition = '';
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();
    _startX = e.clientX;
    _startW = panel.offsetWidth;
    handle.classList.add('dragging');
    panel.classList.add('is-resizing');
    panel.style.transition = 'none';
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  // ── Touch (same pattern as split-view _bindDivider) ────
  const onTouchMove = (e) => {
    if (e.touches.length !== 1) return;
    _onMove(e.touches[0].clientX);
    if (e.cancelable) e.preventDefault();
  };
  const onTouchEnd = () => {
    handle.classList.remove('dragging');
    panel.classList.remove('is-resizing');
    panel.style.transition = '';
    document.body.style.userSelect = '';
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);
  };

  handle.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    e.stopPropagation();
    _startX = e.touches[0].clientX;
    _startW = panel.offsetWidth;
    handle.classList.add('dragging');
    panel.classList.add('is-resizing');
    panel.style.transition = 'none';
    document.body.style.userSelect = 'none';
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
  }, { passive: true });

  // Initial check for touch class
  if (navigator.maxTouchPoints > 0) {
    document.documentElement.classList.add('is-touch');
    document.body.classList.add('is-touch');
  }

  // Restore saved width on init
  if (localStorageKey) {
    const saved = parseInt(localStorage.getItem(localStorageKey), 10);
    if (saved) _setWidth(saved);
  }
}

function _bindGalleryPanelResizers() {
  setupPanelResizer('gv2-ulp-resize-handle', 'gv2-unified-left-panel', 'tj_ulpPanelW', 'right', 180, 800);
  setupPanelResizer('gv2-lp-resize-handle', 'gv2-layer-panel', 'tj_layerPanelW', 'right', 140, 480);
  setupPanelResizer('gv2-tray-resize-handle', 'gv2-tags-tray', 'tj_trayPanelW', 'left', 160, 520);
  setupPanelResizer('gv2-trades-resize-handle', 'gv2-trades-panel', 'tj_tradesPanelW', 'right', 180, 520);
}

// ── Unified Left Panel: open-state restore + hamburger + thumb-toggle ────────
function _bindGalleryULPState() {
  const thumbToggleBtn = document.getElementById('gv2-thumb-toggle-btn');
  const hamburgerBtn   = document.getElementById('gv2-hamburger-btn');
  const ulpPanel = document.getElementById('gv2-unified-left-panel');
  if (!ulpPanel) return;

  const _openULP = (tab) => {
    ulpPanel.classList.add('open');
    if (typeof switchULPTab === 'function') switchULPTab(tab || localStorage.getItem('tj_ulpActiveTab') || 'thumbs');
    localStorage.setItem('tj_ulpPanelOpen', '1');
    hamburgerBtn && hamburgerBtn.classList.add('active');
    thumbToggleBtn && thumbToggleBtn.classList.add('active');
  };
  const _closeULP = () => {
    ulpPanel.classList.remove('open');
    localStorage.setItem('tj_ulpPanelOpen', '0');
    hamburgerBtn && hamburgerBtn.classList.remove('active');
    thumbToggleBtn && thumbToggleBtn.classList.remove('active');
  };
  window._openULP  = _openULP;
  window._closeULP = _closeULP;

  const wasOpen = localStorage.getItem('tj_ulpPanelOpen') === '1';
  const lastTab = localStorage.getItem('tj_ulpActiveTab') || 'thumbs';

  if (wasOpen) {
    ulpPanel.classList.add('open');
    if (typeof switchULPTab === 'function') switchULPTab(lastTab);
    hamburgerBtn && hamburgerBtn.classList.add('active');
  }

  // Hamburger (ribbon) — simple toggle
  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', () => {
      ulpPanel.classList.contains('open') ? _closeULP() : _openULP();
    });
  }

  if (thumbToggleBtn) {
    thumbToggleBtn.addEventListener('click', () => {
      const isOpen = ulpPanel.classList.contains('open');
      const currentTab = localStorage.getItem('tj_ulpActiveTab') || 'thumbs';
      if (isOpen && currentTab === 'thumbs') {
        _closeULP();
      } else {
        _openULP('thumbs');
      }
    });
  }
}

// ── Ctrl+drag to select thumbnails, Ctrl+Alt+drag to deselect ───────────────
function _bindGalleryCtrlDrag() {
  let _ctrlDragPending = false, _ctrlDragActive = false, _ctrlDragMode = 'select';
  let _ctrlDragStartPos = null;
  let _ctrlDragScrollRaf = null;

  document.addEventListener('mousedown', e => {
    if (!document.getElementById('gallery-modal')?.classList.contains('open')) return;
    if (!e.ctrlKey || e.button !== 0) return;
    const wrap = e.target.closest('.gv2-thumb-wrap');
    if (!wrap || wrap.dataset.globalIdx === undefined) return;
    _ctrlDragPending = true;
    _ctrlDragMode = e.altKey ? 'deselect' : 'select';
    _ctrlDragStartPos = { x: e.clientX, y: e.clientY };
  });

  document.addEventListener('mousemove', e => {
    if (!_ctrlDragPending && !_ctrlDragActive) return;
    if (_ctrlDragPending) {
      const dx = e.clientX - _ctrlDragStartPos.x, dy = e.clientY - _ctrlDragStartPos.y;
      if (Math.sqrt(dx * dx + dy * dy) < 5) return;
      _ctrlDragActive = true; _ctrlDragPending = false;
    }
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const wrap = el?.closest('.gv2-thumb-wrap');
    if (wrap && wrap.dataset.globalIdx !== undefined) {
      const idx = parseInt(wrap.dataset.globalIdx);
      if (!state.gallery.selectedIndices) state.gallery.selectedIndices = new Set();
      if (_ctrlDragMode === 'select') {
        if (!state.gallery.selectedIndices.has(idx)) {
          state.gallery.selectedIndices.add(idx);
          wrap.querySelector('.gv2-thumb')?.classList.add('selected-thumb');
        }
      } else {
        if (state.gallery.selectedIndices.has(idx)) {
          state.gallery.selectedIndices.delete(idx);
          wrap.querySelector('.gv2-thumb')?.classList.remove('selected-thumb');
        }
      }
    }
    // Auto-scroll thumb panel when dragging near top/bottom edges
    const thumbs = document.getElementById('gallery-thumbs');
    if (!thumbs) return;
    const rect = thumbs.getBoundingClientRect();
    const ZONE = 50, SPEED = 8;
    if (_ctrlDragScrollRaf) cancelAnimationFrame(_ctrlDragScrollRaf);
    if (e.clientY < rect.top + ZONE) {
      const scroll = () => { thumbs.scrollTop -= SPEED; if (_ctrlDragActive) _ctrlDragScrollRaf = requestAnimationFrame(scroll); };
      _ctrlDragScrollRaf = requestAnimationFrame(scroll);
    } else if (e.clientY > rect.bottom - ZONE) {
      const scroll = () => { thumbs.scrollTop += SPEED; if (_ctrlDragActive) _ctrlDragScrollRaf = requestAnimationFrame(scroll); };
      _ctrlDragScrollRaf = requestAnimationFrame(scroll);
    }
  });

  document.addEventListener('mouseup', () => {
    _ctrlDragPending = false; _ctrlDragActive = false;
    if (_ctrlDragScrollRaf) { cancelAnimationFrame(_ctrlDragScrollRaf); _ctrlDragScrollRaf = null; }
  });
}
