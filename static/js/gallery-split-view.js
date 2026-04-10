// gallery-split-view.js — TradingView-style split canvas for gallery
// Left panel: user pins any image (📌) → auto-saved to trade's ref card INDEX
// Right panel: always shows current gallery image (navigates normally)
// Both panels: independent zoom/pan (wheel + drag, double-click to reset)

const _splitState = {
  left:  { scale: 1, tx: 0, ty: 0, url: null },
  right: { scale: 1, tx: 0, ty: 0 }
};

// ── Public API ────────────────────────────────────────────────────────────────

function initSplitView() {
  const btn = document.getElementById('gv2-split-toggle-btn');
  if (!btn) return;
  btn.addEventListener('click', () => toggleSplitView());

  // Split panel nav arrows
  const spPrev = document.getElementById('gv2-split-nav-prev');
  const spNext = document.getElementById('gv2-split-nav-next');
  if (spPrev) spPrev.addEventListener('click', e => { e.stopPropagation(); if (typeof navigateGallery === 'function') navigateGallery(-1); });
  if (spNext) spNext.addEventListener('click', e => { e.stopPropagation(); if (typeof navigateGallery === 'function') navigateGallery(1); });

  // Delegated button clicks
  document.addEventListener('click', e => {
    if (!state.gallery.splitView) return;
    if (e.target.closest('#gv2-split-pin-btn')) {
      const rightImg = document.getElementById('gv2-split-right-img');
      if (rightImg && rightImg.src && !rightImg.src.endsWith('/')) {
        pinToLeft(rightImg.src, true); // true = save to ref card
      }
    }
    if (e.target.closest('#gv2-split-left-reset'))  _resetPanel('left');
    if (e.target.closest('#gv2-split-right-reset')) _resetPanel('right');
  });

  _bindPanelZoomPan('left');
  _bindPanelZoomPan('right');
  _bindDivider();
}

function toggleSplitView() {
  state.gallery.splitView = !state.gallery.splitView;
  _applySplitMode();
}

/** Called from gallery-render.js whenever the main image changes.
 *  ONLY updates right panel — left panel is never touched during navigation. */
function updateSplitRight(url) {
  if (!state.gallery.splitView) return;
  const img = document.getElementById('gv2-split-right-img');
  if (!img) return;
  img.src = resolveImageUrl ? resolveImageUrl(url) : url;
}

/** Pin url to left panel. If save=true, also persist to dayData ref card. */
function pinToLeft(url, save = false) {
  const resolved = resolveImageUrl ? resolveImageUrl(url) : url;
  _splitState.left.url = resolved;

  const img   = document.getElementById('gv2-split-left-img');
  const empty = document.getElementById('gv2-split-left-empty');
  if (!img) return;
  img.src = resolved;
  img.style.display = '';
  if (empty) empty.style.display = 'none';
  _resetPanel('left');

  if (save) _saveLeftToRefCard(resolved);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _applySplitMode() {
  const on = !!state.gallery.splitView;
  const container = document.getElementById('gv2-split-container');
  const zoomLayer = document.getElementById('gallery-zoom-layer');
  const navPrev   = document.getElementById('gallery-prev');
  const navNext   = document.getElementById('gallery-next');
  const btn       = document.getElementById('gv2-split-toggle-btn');

  if (container) container.style.display = on ? 'flex' : 'none';
  if (zoomLayer) zoomLayer.style.display = on ? 'none' : '';
  if (navPrev)   navPrev.style.display   = on ? 'none' : '';
  if (navNext)   navNext.style.display   = on ? 'none' : '';
  if (btn) {
    btn.style.background  = on ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)';
    btn.style.borderColor = on ? 'rgba(99,102,241,0.6)'  : 'rgba(255,255,255,0.1)';
    btn.style.color       = on ? '#818cf8' : '';
  }

  if (on) {
    // Populate right panel with current image
    const curUrl = (state.gallery.images || [])[state.gallery.currentIndex] || '';
    if (curUrl) {
      const rImg = document.getElementById('gv2-split-right-img');
      if (rImg) rImg.src = resolveImageUrl ? resolveImageUrl(curUrl) : curUrl;
    }
    // Left panel: only auto-load once when split opens (from saved ref card)
    // After that, only 📌 button can change it
    if (!_splitState.left.url) _autoLoadRefCardLeft();
  }
}

/** Auto-load ref card INDEX for current trade into left panel.
 *  Called ONCE when split view opens (if left panel is empty).
 *  Never called during navigation — left panel only changes via 📌 button. */
function _autoLoadRefCardLeft() {
  const date   = state.gallery.date;
  const curUrl = (state.gallery.images || [])[state.gallery.currentIndex] || '';
  if (!date || !curUrl) return;

  const ownerTrade = typeof getOwnerTradeForImageUrl === 'function' ? getOwnerTradeForImageUrl(curUrl) : null;
  if (!ownerTrade) return;

  const dayTrades = typeof getTradesForDate === 'function' ? getTradesForDate(date) : [];
  const idx = dayTrades.indexOf(ownerTrade);
  if (idx < 0) return;

  const refCard = state.dayData[date]?.tradeRefCards?.[idx];
  if (refCard?.index) pinToLeft(refCard.index, false);
}

/** Save the left panel URL to current trade's ref card INDEX. */
function _saveLeftToRefCard(url) {
  const date   = state.gallery.date;
  const curUrl = (state.gallery.images || [])[state.gallery.currentIndex] || '';
  if (!date || !curUrl) return;

  const ownerTrade = typeof getOwnerTradeForImageUrl === 'function' ? getOwnerTradeForImageUrl(curUrl) : null;
  if (!ownerTrade) return;

  const dayTrades = typeof getTradesForDate === 'function' ? getTradesForDate(date) : [];
  const idx = dayTrades.indexOf(ownerTrade);
  if (idx < 0) return;

  // Store the pathname (strip origin so it's portable)
  const storedUrl = _pathOnly(url);

  const dData = state.dayData[date] = state.dayData[date] || {};
  dData.tradeRefCards = dData.tradeRefCards || {};
  dData.tradeRefCards[idx] = dData.tradeRefCards[idx] || {};
  dData.tradeRefCards[idx].index = storedUrl;
  saveTrades();
  showToast('Saved to T' + (idx + 1) + ' ref card', 'success');
}

function _pathOnly(src) {
  try { return new URL(src).pathname; } catch { return src; }
}

function _resetPanel(side) {
  _splitState[side].scale = 1;
  _splitState[side].tx    = 0;
  _splitState[side].ty    = 0;
  // Reset to "no transform" — the flex centering inside handles default position
  _applyTransform(side);
}

function _applyTransform(side) {
  const id = side === 'left' ? 'gv2-split-left-inner' : 'gv2-split-right-inner';
  const el = document.getElementById(id);
  if (!el) return;
  const { scale, tx, ty } = _splitState[side];
  el.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
}

function _bindPanelZoomPan(side) {
  const panelId = side === 'left' ? 'gv2-split-left' : 'gv2-split-right';
  // Per-panel drag state (closure, not shared)
  let dragging = false, lastX = 0, lastY = 0;

  document.addEventListener('wheel', e => {
    if (!state.gallery.splitView) return;
    const panel = document.getElementById(panelId);
    if (!panel || !panel.contains(e.target)) return;
    e.preventDefault();
    const st     = _splitState[side];
    const rect   = panel.getBoundingClientRect();
    // cx/cy relative to panel top-left, but image is centered so effective origin
    // at scale=1,tx=0,ty=0 is (rect.width/2, rect.height/2).
    // We treat the inner div transform as translate(tx,ty)scale(s) from top-left,
    // with the flex-centered image inside. Zoom toward mouse cursor:
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const factor   = e.deltaY < 0 ? 1.12 : (1 / 1.12);
    const newScale = Math.max(0.2, Math.min(20, st.scale * factor));
    // Adjust tx/ty so the point under the cursor stays fixed
    st.tx    = cx - (cx - st.tx) * (newScale / st.scale);
    st.ty    = cy - (cy - st.ty) * (newScale / st.scale);
    st.scale = newScale;
    _applyTransform(side);
  }, { passive: false });

  document.addEventListener('mousedown', e => {
    if (!state.gallery.splitView) return;
    const panel = document.getElementById(panelId);
    if (!panel || !panel.contains(e.target)) return;
    if (e.target.closest('button') || e.target.id === 'gv2-split-divider') return;
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    panel.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging || !state.gallery.splitView) return;
    const st = _splitState[side];
    st.tx += e.clientX - lastX;
    st.ty += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    _applyTransform(side);
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    const panel = document.getElementById(panelId);
    if (panel) panel.style.cursor = 'grab';
  });

  document.addEventListener('dblclick', e => {
    if (!state.gallery.splitView) return;
    const panel = document.getElementById(panelId);
    if (!panel || !panel.contains(e.target) || e.target.closest('button')) return;
    _resetPanel(side);
  });
}

function _bindDivider() {
  document.addEventListener('mousedown', e => {
    if (e.target.id !== 'gv2-split-divider') return;
    e.preventDefault();
    e.stopPropagation();

    const container = document.getElementById('gv2-split-container');
    const leftPanel = document.getElementById('gv2-split-left');
    if (!container || !leftPanel) return;

    // Use getBoundingClientRect for reliable measurements
    const cRect = container.getBoundingClientRect();
    const lRect = leftPanel.getBoundingClientRect();
    const startX = e.clientX;
    const startW = lRect.width;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = mv => {
      const totalW = container.getBoundingClientRect().width;
      if (!totalW) return;
      const newW = startW + mv.clientX - startX;
      const pct  = Math.max(15, Math.min(85, newW / totalW * 100));
      // Override flex with explicit sizing
      leftPanel.style.flex = `0 0 ${pct}%`;
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

document.addEventListener('DOMContentLoaded', initSplitView);
