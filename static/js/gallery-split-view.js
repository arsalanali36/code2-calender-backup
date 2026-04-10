// gallery-split-view.js — TradingView-style split canvas for gallery
// Left panel: user pins any image (📌) → auto-saved to trade's ref card INDEX
// Right panel: always shows current gallery image (navigates normally)
// Both panels: independent zoom/pan (wheel + drag, double-click to reset)

const _splitState = {
  left:  { scale: 1, tx: 0, ty: 0, url: null, rawUrl: null },
  right: { scale: 1, tx: 0, ty: 0 }
};

function getSplitViewState() {
  return {
    left:  { ..._splitState.left, url: _splitState.left.rawUrl || _splitState.left.url },
    right: {
      ..._splitState.right,
      url: (state.gallery.images || [])[state.gallery.currentIndex] || null
    }
  };
}

/** Reconstructs a saved view (URLs + transforms) in both panels. */
function applySplitViewState(data) {
  if (!data) return;
  if (!state.gallery.splitView) toggleSplitView(); // Turn on split mode

  const _res = (u) => {
    if (!u) return '';
    if (u.startsWith('http') || u.startsWith('blob:') || u.startsWith('data:')) return u;
    
    // Self-Correction: Fix stripped paths
    let target = u;
    if (!u.includes('/') && u.includes('.')) {
        const images = state.gallery.images || [];
        const full = images.find(img => img === u || img.endsWith('/' + u));
        if (full) target = full;
        else console.warn('Trade Review: Old corrupted path detected for:', u, '. Please re-pin and save this view.');
    }

    let final = target;
    if (!final.startsWith('/uploads/') && !final.startsWith('/static/')) {
        final = typeof resolveImageUrl === 'function' ? resolveImageUrl(target) : target;
    }
    return final.replace(/\/+/g, '/').replace(':/', '://');
  };

  // 1. Left Panel (Stored as 'index' in Ref Card)
  const lData = (typeof data.index === 'object' && data.index !== null) ? data.index : (data.index ? { url: data.index } : null);
  if (lData && lData.url) {
    const finalUrl = _res(lData.url);
    _splitState.left.url = finalUrl;
    _splitState.left.rawUrl = lData.url;
    
    const lImg = document.getElementById('gv2-split-left-img');
    const lEmp = document.getElementById('gv2-split-left-empty');
    if (lImg) {
      // Define handlers BEFORE setting src
      lImg.onload = () => { 
        lImg.style.display = ''; 
        if (lEmp) lEmp.style.display = 'none'; 
        _fitPanel('left');
      };
      lImg.onerror = () => { 
        console.error('Split Left Load Fail:', finalUrl);
        lImg.style.display = 'none';
        if (lEmp) lEmp.style.display = '';
      };

      
      lImg.src = finalUrl;
      
      _splitState.left.scale = lData.scale || 1;
      _splitState.left.tx    = lData.tx || 0;
      _splitState.left.ty    = lData.ty || 0;
      _applyTransform('left');
    }
  }



  // 2. Right Panel (Stored as 'premium' in Ref Card)
  const rData = (typeof data.premium === 'object' && data.premium !== null) ? data.premium : (data.premium ? { url: data.premium } : null);
  if (rData && rData.url) {
    // Navigate main gallery to this image
    const images = state.gallery.images || [];
    const targetUrl = rData.url; 
    
    let idx = images.indexOf(targetUrl);
    if (idx === -1) {
        const cleaned = targetUrl.split('?')[0];
        idx = images.findIndex(u => u === targetUrl || u.includes(cleaned));
    }
    
    if (idx !== -1) {
      state.gallery.currentIndex = idx;
      if (typeof renderGallery === 'function') renderGallery();
      
      _splitState.right.scale = rData.scale || 1;
      _splitState.right.tx    = rData.tx || 0;
      _splitState.right.ty    = rData.ty || 0;
      setTimeout(() => _applyTransform('right'), 50);
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

function initSplitView() {
  const btn = document.getElementById('gv2-split-toggle-btn');
  if (btn) {
    btn.addEventListener('click', () => toggleSplitView());
  }

  // Split panel nav arrows (Right side — main gallery nav)
  const spPrev = document.getElementById('gv2-split-nav-prev');
  const spNext = document.getElementById('gv2-split-nav-next');
  if (spPrev) spPrev.addEventListener('click', e => { e.stopPropagation(); if (typeof navigateGallery === 'function') navigateGallery(-1); });
  if (spNext) spNext.addEventListener('click', e => { e.stopPropagation(); if (typeof navigateGallery === 'function') navigateGallery(1); });

  // Split panel nav arrows (Left side — independent reference nav)
  const splPrev = document.getElementById('gv2-split-left-nav-prev');
  const splNext = document.getElementById('gv2-split-left-nav-next');
  if (splPrev) splPrev.addEventListener('click', e => { e.stopPropagation(); navigateSplitLeft(-1); });
  if (splNext) splNext.addEventListener('click', e => { e.stopPropagation(); navigateSplitLeft(1); });

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

/** Navigates the pinned image in the left panel independently. */
function navigateSplitLeft(dir) {
    if (!state.gallery.splitView) return;
    const url = _splitState.left.rawUrl || _splitState.left.url;
    if (!url) {
        // If empty, start from first image
        const images = state.gallery.images || [];
        if (images.length) pinToLeft(images[0], true);
        return;
    }
    const images = state.gallery.images || [];
    let idx = images.indexOf(url);
    if (idx === -1) {
        const cleaned = url.split('?')[0];
        idx = images.findIndex(u => u === url || u.includes(cleaned));
    }
    if (idx === -1) return;
    let nextIdx = idx + dir;
    if (nextIdx < 0) nextIdx = 0;
    if (nextIdx >= images.length) nextIdx = images.length - 1;
    if (nextIdx === idx) return;
    
    pinToLeft(images[nextIdx], true);
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
  img.onload = () => _fitPanel('right');
  img.src = resolveImageUrl ? resolveImageUrl(url) : url;
}

/** Pin url to left panel. If save=true, also persist to dayData ref card. */
function pinToLeft(url, save = false) {
  if (!url) return;
  const resolved = typeof resolveImageUrl === 'function' ? resolveImageUrl(url) : url;
  _splitState.left.url = resolved;
  _splitState.left.rawUrl = url;

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
  const syncBtn = (b) => {
    if (!b) return;
    b.style.background  = on ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)';
    b.style.borderColor = on ? 'rgba(99,102,241,0.6)'  : 'rgba(255,255,255,0.1)';
    b.style.color       = on ? '#818cf8' : '';
    // Special handle for tray button if it has different brand color (purple/violet)
    if (b.classList.contains('split-toggle-btn') && b.closest('#close-global-tray')) {
      b.style.background  = on ? 'rgba(139, 92, 246, 0.25)' : 'rgba(139, 92, 246, 0.12)';
      b.style.borderColor = on ? 'rgba(139, 92, 246, 0.6)'  : 'rgba(139, 92, 246, 0.3)';
      b.style.color       = on ? '#a78bfa' : '#a78bfa';
    }
  };

  const btn = document.getElementById('gv2-split-toggle-btn');
  if (btn) syncBtn(btn);
  const trayBtn = document.querySelector('#close-global-tray .split-toggle-btn');
  if (trayBtn) syncBtn(trayBtn);

  if (container) container.style.display = on ? 'flex' : 'none';
  if (zoomLayer) zoomLayer.style.display = on ? 'none' : '';
  if (navPrev)   navPrev.style.display   = on ? 'none' : '';
  if (navNext)   navNext.style.display   = on ? 'none' : '';

  if (on) {
    // Populate right panel with current image
    const curUrl = (state.gallery.images || [])[state.gallery.currentIndex] || '';
    if (curUrl) {
      const rImg = document.getElementById('gv2-split-right-img');
      if (rImg) rImg.src = resolveImageUrl ? resolveImageUrl(curUrl) : curUrl;
    }
    // Left panel: only auto-load once when split opens (from saved ref card)
    if (!_splitState.left.url) _autoLoadRefCardLeft();

    // Ensure initial fit after container is shown/resized
    setTimeout(() => {
        _fitPanel('left');
        _fitPanel('right');
    }, 50);
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

/** 
 * Automatically fits the image to the panel at its highest resolution.
 * Replaces 'object-fit: contain' to avoid iPad pixelation.
 */
function _fitPanel(side) {
  const imgId = side === 'left' ? 'gv2-split-left-img' : 'gv2-split-right-img';
  const panelId = side === 'left' ? 'gv2-split-left' : 'gv2-split-right';
  const img = document.getElementById(imgId);
  const panel = document.getElementById(panelId);
  if (!img || !panel || !img.naturalWidth) return;
  
  const pw = panel.offsetWidth;
  const ph = panel.offsetHeight;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!pw || !ph || !iw || !ih) return;

  const scale = Math.min(pw / iw, ph / ih);
  const st = _splitState[side];
  st.scale = scale;
  // Center it initially
  st.tx = (pw - iw * scale) / 2;
  st.ty = (ph - ih * scale) / 2;
  _applyTransform(side);
}

function _resetPanel(side) {
  _fitPanel(side);
}

function _applyTransform(side) {
  const imgId = side === 'left' ? 'gv2-split-left-img' : 'gv2-split-right-img';
  const el = document.getElementById(imgId);
  if (!el) return;
  const { scale, tx, ty } = _splitState[side];
  // Apply transform with translate3d for GPU optimization
  el.style.transform = `translate3d(${tx}px,${ty}px,0) scale(${scale})`;
}

function _bindPanelZoomPan(side) {
  const panelId = side === 'left' ? 'gv2-split-left' : 'gv2-split-right';
  const panel   = document.getElementById(panelId);
  if (!panel) return;

  // Per-panel drag state (closure, not shared)
  let dragging = false, lastX = 0, lastY = 0;

  panel.addEventListener('wheel', e => {
    if (!state.gallery.splitView) return;
    e.preventDefault();
    const st     = _splitState[side];
    const rect   = panel.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const factor   = e.deltaY < 0 ? 1.12 : (1 / 1.12);
    const newScale = Math.max(0.2, Math.min(20, st.scale * factor));
    st.tx    = cx - (cx - st.tx) * (newScale / st.scale);
    st.ty    = cy - (cy - st.ty) * (newScale / st.scale);
    st.scale = newScale;
    _applyTransform(side);
  }, { passive: false });

  panel.addEventListener('mousedown', e => {
    if (!state.gallery.splitView) return;
    if (e.target.closest('button') || e.target.id === 'gv2-split-divider') return;
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    panel.style.cursor = 'grabbing';
    e.preventDefault();
  });

  const onMove = e => {
    if (!dragging || !state.gallery.splitView) return;
    const st = _splitState[side];
    st.tx += e.clientX - lastX;
    st.ty += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    _applyTransform(side);
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    panel.style.cursor = 'grab';
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);

  panel.addEventListener('mouseup', onUp);

  // ── Touch Zoom & Pan (iPad) ────────────────────────────────────────────────
  let tDist = 0, tMidX = 0, tMidY = 0;

  panel.addEventListener('touchstart', e => {
    if (!state.gallery.splitView || e.target.closest('button')) return;
    e.stopPropagation(); // Prevent parent wrapper from seeing this touch
    if (e.touches.length === 1) {
      dragging = true;
      lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      dragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      tDist = Math.sqrt(dx*dx + dy*dy);
      const rect = panel.getBoundingClientRect();
      tMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      tMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
    }
  }, { passive: false });

  panel.addEventListener('touchmove', e => {
    if (!state.gallery.splitView) return;
    e.stopPropagation(); // Prevent parent wrapper from seeing this move
    e.preventDefault();
    const st = _splitState[side];

    if (e.touches.length === 1 && dragging) {
      st.tx += e.touches[0].clientX - lastX;
      st.ty += e.touches[0].clientY - lastY;
      lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
      _applyTransform(side);
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newD = Math.sqrt(dx*dx + dy*dy);
      if (newD > 5 && tDist > 0) {
        const factor = newD / tDist;
        const nScale = Math.max(0.2, Math.min(20, st.scale * factor));
        st.tx = tMidX - (tMidX - st.tx) * (nScale / st.scale);
        st.ty = tMidY - (tMidY - st.ty) * (nScale / st.scale);
        st.scale = nScale;
        tDist = newD;
        _applyTransform(side);
      }
    }
  }, { passive: false });

  panel.addEventListener('touchend', e => { 
    if (state.gallery.splitView) e.stopPropagation();
    dragging = false; tDist = 0; 
  });
  panel.addEventListener('touchcancel', e => { 
    if (state.gallery.splitView) e.stopPropagation();
    dragging = false; tDist = 0; 
  });

  // ── Double Tap Reset (iPad) ────────────────────────────────────────────────
  let lastTap = 0;
  panel.addEventListener('touchstart', e => {
      if (e.touches.length > 1) return;
      const now = Date.now();
      if (now - lastTap < 300) {
          e.preventDefault();
          _resetPanel(side);
          lastTap = 0;
      } else {
          lastTap = now;
      }
  }, { passive: false });

  document.addEventListener('dblclick', e => {
    if (!state.gallery.splitView) return;
    const panel = document.getElementById(panelId);
    if (!panel || !panel.contains(e.target) || e.target.closest('button')) return;
    _resetPanel(side);
  });
}

function _bindDivider() {
  const container = document.getElementById('gv2-split-container');
  const divider   = document.getElementById('gv2-split-divider');
  const leftPanel = document.getElementById('gv2-split-left');

  if (!divider || !container || !leftPanel) return;

  let startX = 0;
  let startW = 0;

  const onMove = (clientX) => {
    const totalW = container.getBoundingClientRect().width;
    if (!totalW) return;
    const newW = startW + clientX - startX;
    const pct  = Math.max(15, Math.min(85, (newW / totalW) * 100));
    leftPanel.style.flex = `0 0 ${pct}%`;
  };

  // Mouse handlers
  const onMouseMove = (e) => onMove(e.clientX);
  const onMouseUp = () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  // Touch handlers
  const onTouchMove = (e) => {
    if (e.touches.length !== 1) return;
    onMove(e.touches[0].clientX);
    if (e.cancelable) e.preventDefault();
  };
  const onTouchEnd = () => {
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);
    document.body.style.userSelect = '';
  };

  // Start dragging (Mouse)
  divider.addEventListener('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();
    const lRect = leftPanel.getBoundingClientRect();
    startX = e.clientX;
    startW = lRect.width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  // Start dragging (Touch/iPad)
  divider.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    e.stopPropagation();
    const lRect = leftPanel.getBoundingClientRect();
    startX = e.touches[0].clientX;
    startW = lRect.width;
    document.body.style.userSelect = 'none';
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
  }, { passive: true });
}

document.addEventListener('DOMContentLoaded', initSplitView);
