/**
 * @fileoverview annotate-zoom.js
 * @description Declares fabricCanvas, zoom, drag globals; zoom/pan bindings; brush cursor.
 * @exports fabricCanvas (null until startAnnotation sets it), zoom{scale,x,y}, drag{active,...},
 *          resetZoom, applyZoom, bindZoomPan, ensureAnnotBrushCursor, updateAnnotBrushCursorVisual
 * @note MUST load BEFORE all other annotate-*.js — these globals are referenced by all annotate files.
 * @reads annotState.tool, annotState.active
 * @writes zoom.scale, zoom.x, zoom.y, fabricCanvas (assigned externally by startAnnotation)
 */

// annot-zoom.js — Shared annotation state, zoom/pan, brush cursor.
// Loaded FIRST. All module-level vars (fabricCanvas, zoom, drag, etc.) live here.

// ─── A. Module-level state ───────────────────────────────────────────────────
let fabricCanvas = null;
let _fabricHistory = [], _fabricFuture = [], _historyLocked = false;
let _mqCanvas = null;
let _shapeStartPoint = null, _activeShape = null, _isShapeDrawing = false;
let _eraserActive = false, _eraserLastPos = null;

const zoom = { scale: 1, x: 0, y: 0 };
const drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 };
let preferredTool = 'pen';

function _brushCursorMove(e) {
  if (!shouldUseBrushCursor()) return;
  const brushEl = document.getElementById('annot-brush-cursor');
  if (!brushEl) return;
  const wr = document.getElementById('gallery-img-wrapper').getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  brushEl.style.left = (src.clientX - wr.left) + 'px';
  brushEl.style.top = (src.clientY - wr.top) + 'px';
  brushEl.style.display = 'block';
}
function _brushCursorLeave() {
  const brushEl = document.getElementById('annot-brush-cursor');
  if (brushEl) brushEl.style.display = 'none';
}

// ─── B. Zoom / Pan ───────────────────────────────────────────────────────────

function resetZoom() { zoom.scale = 1; zoom.x = 0; zoom.y = 0; drag.active = false; applyZoom(); }

function applyZoom() {
  const img = document.getElementById('gallery-img');
  const tf = `translate3d(${zoom.x}px, ${zoom.y}px, 0) scale(${zoom.scale})`;

  const zoomLayer = document.getElementById('gallery-zoom-layer');
  if (zoomLayer) {
    zoomLayer.style.transform = 'none'; // Un-scale the parent so canvas isn't stretched
  }

  img.style.transform = tf;
  img.style.transformOrigin = 'top left';

  if (_mqCanvas) {
    _mqCanvas.style.transform = tf;
    _mqCanvas.style.transformOrigin = 'top left';
  }

  const navCont = document.getElementById('close-global-nav-container');
  if (navCont) {
    navCont.style.transform = tf;
    navCont.style.transformOrigin = 'top left';
  }

  if (fabricCanvas) {
    if (fabricCanvas.wrapperEl) {
      fabricCanvas.wrapperEl.style.transform = tf; // Apple CSS scaling correctly
      fabricCanvas.wrapperEl.style.transformOrigin = 'top left';
    }
    // We do NOT use setViewportTransform and manual dpr scaling anymore
    // CSS scaling handles the viewport and prevents edge clipping natively.
    const vpt = fabricCanvas.viewportTransform;
    vpt[0] = 1;
    vpt[3] = 1;
    vpt[4] = 0;
    vpt[5] = 0;
    fabricCanvas.setViewportTransform(vpt);
    fabricCanvas.calcOffset();
    fabricCanvas.requestRenderAll();
  }

  if (zoom.scale > 1) { img.classList.add('zoomed'); img.classList.remove('dragging'); }
  else { img.classList.remove('zoomed', 'dragging'); }

  if (typeof updateAnnotBrushCursorVisual === 'function') {
    updateAnnotBrushCursorVisual();
  }
}

function bindZoomPan() {
  const wrapper = document.getElementById('gallery-img-wrapper');
  const img = document.getElementById('gallery-img');

  wrapper.addEventListener('wheel', e => {
    // Top-bar/properties panels (inputs, UI controls) pe scroll karne se canvas zoom na ho
    if (e.target.closest('#gv2-annot-bar') || e.target.closest('#gv2-text-bar') || e.target.closest('#gv2-marquee-bar')) return;

    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newScale = Math.min(Math.max(zoom.scale * factor, 1), 8);
    if (newScale <= 1) {
      zoom.scale = 1; zoom.x = 0; zoom.y = 0;
    } else {
      const wRect = wrapper.getBoundingClientRect();
      const mouseX = e.clientX - wRect.left;
      const mouseY = e.clientY - wRect.top;
      const imgX = (mouseX - zoom.x) / zoom.scale;
      const imgY = (mouseY - zoom.y) / zoom.scale;
      zoom.x = mouseX - imgX * newScale;
      zoom.y = mouseY - imgY * newScale;
      zoom.scale = newScale;
    }
    applyZoom();
  }, { passive: false });

  wrapper.addEventListener('dblclick', (e) => {
    if (typeof annotState !== 'undefined' && annotState.active && annotState.tool === 'text') return;
    resetZoom();
  });

  wrapper.addEventListener('mousedown', e => {
    if (zoom.scale <= 1) return;
    if (annotState.active) return;
    const t = e.target;
    const validTarget = t && (
      t.id === 'gallery-img' || t.id === 'annot-canvas' ||
      t.id === 'gallery-img-wrapper' || t.id === 'gallery-zoom-layer' ||
      (t.classList && (t.classList.contains('lower-canvas') || t.classList.contains('upper-canvas')))
    );
    if (!validTarget) return;
    drag.active = true; drag.startX = e.clientX; drag.startY = e.clientY;
    drag.originX = zoom.x; drag.originY = zoom.y;
    img.classList.add('dragging');
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!drag.active) return;
    zoom.x = drag.originX + (e.clientX - drag.startX);
    zoom.y = drag.originY + (e.clientY - drag.startY);
    applyZoom();
  });
  document.addEventListener('mouseup', () => {
    if (drag.active) {
      drag.active = false;
      document.getElementById('gallery-img').classList.remove('dragging');
      applyZoom();
    }
  });
  // Safety: if window loses focus while dragging, release the drag
  window.addEventListener('blur', () => {
    if (drag.active) { drag.active = false; document.getElementById('gallery-img')?.classList.remove('dragging'); }
  });

  // ─── Touch: pinch-to-zoom (toward center) + touch-pan + swipe-nav + double-tap ───
  let lastDist = 0, lastMidX = 0, lastMidY = 0;
  let swipeTracking = false, touchPanActive = false;
  let swipeStartX = 0, swipeStartY = 0, swipeLastX = 0, swipeLastY = 0;
  let touchPanStartX = 0, touchPanStartY = 0;
  let _lastTapTime = 0, _lastTapX = 0, _lastTapY = 0;

  wrapper.addEventListener('touchstart', e => {
    if (state.gallery.splitView) return; // Don't interfere with split view pan/zoom
    if (e.touches.length === 2) {
      swipeTracking = false; touchPanActive = false;
      lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      lastMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      lastMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      return;
    }
    if (e.touches.length === 1) {
      const tx = e.touches[0].clientX, ty = e.touches[0].clientY;
      if (zoom.scale > 1 && !annotState.active) {
        // Single-finger pan when zoomed in
        touchPanActive = true; swipeTracking = false;
        touchPanStartX = tx - zoom.x;
        touchPanStartY = ty - zoom.y;
        return;
      }
      if (!annotState.active) {
        // Swipe navigation + double-tap detection
        swipeTracking = true; touchPanActive = false;
        swipeStartX = swipeLastX = tx;
        swipeStartY = swipeLastY = ty;
        // Double-tap: zoom in toward tap point, or reset if already zoomed
        const now = Date.now();
        if (now - _lastTapTime < 300 && Math.abs(tx - _lastTapX) < 35 && Math.abs(ty - _lastTapY) < 35) {
          if (zoom.scale > 1) {
            resetZoom();
          } else {
            const wRect = wrapper.getBoundingClientRect();
            const pX = tx - wRect.left, pY = ty - wRect.top;
            const newScale = 2.5;
            zoom.x = pX - (pX / zoom.scale) * newScale;
            zoom.y = pY - (pY / zoom.scale) * newScale;
            zoom.scale = newScale;
            applyZoom();
          }
          _lastTapTime = 0; swipeTracking = false;
          return;
        }
        _lastTapTime = now; _lastTapX = tx; _lastTapY = ty;
      }
    }
  }, { passive: true });

  wrapper.addEventListener('touchmove', e => {
    if (state.gallery.splitView) return;
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      // Zoom toward pinch midpoint (same math as wheel zoom toward cursor)
      const wRect = wrapper.getBoundingClientRect();
      const pX = midX - wRect.left, pY = midY - wRect.top;
      const newScale = Math.min(Math.max(zoom.scale * (dist / lastDist), 1), 8);
      if (newScale <= 1) {
        zoom.scale = 1; zoom.x = 0; zoom.y = 0;
      } else {
        const imgX = (pX - zoom.x) / zoom.scale;
        const imgY = (pY - zoom.y) / zoom.scale;
        zoom.x = pX - imgX * newScale + (midX - lastMidX);
        zoom.y = pY - imgY * newScale + (midY - lastMidY);
        zoom.scale = newScale;
      }
      lastDist = dist; lastMidX = midX; lastMidY = midY;
      applyZoom(); return;
    }
    if (touchPanActive && e.touches.length === 1) {
      e.preventDefault();
      zoom.x = e.touches[0].clientX - touchPanStartX;
      zoom.y = e.touches[0].clientY - touchPanStartY;
      applyZoom(); return;
    }
    if (swipeTracking && e.touches.length === 1) {
      swipeLastX = e.touches[0].clientX; swipeLastY = e.touches[0].clientY;
      const dx = swipeLastX - swipeStartX, dy = swipeLastY - swipeStartY;
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) e.preventDefault();
    }
  }, { passive: false });

  wrapper.addEventListener('touchend', () => {
    if (state.gallery.splitView) {
      touchPanActive = false;
      swipeTracking = false;
      return;
    }
    touchPanActive = false;
    if (!swipeTracking) return;
    const dx = swipeLastX - swipeStartX, dy = swipeLastY - swipeStartY;
    swipeTracking = false;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
    navigateGallery(dx < 0 ? 1 : -1);
  }, { passive: true });
}

// ─── C. Brush cursor ─────────────────────────────────────────────────────────

function ensureAnnotBrushCursor() {
  const wrapper = document.getElementById('gallery-img-wrapper');
  if (!wrapper) return null;
  let el = document.getElementById('annot-brush-cursor');
  if (!el) {
    el = document.createElement('div');
    el.id = 'annot-brush-cursor';
    el.className = 'annot-brush-cursor';
    wrapper.appendChild(el);
  }
  return el;
}

function updateAnnotBrushCursorVisual() {
  const el = ensureAnnotBrushCursor();
  if (!el) return;
  const s = Math.max(10, Math.min(80, (annotState.size || 3) * 4)) * (typeof zoom !== 'undefined' ? zoom.scale : 1);
  el.style.width = s + 'px';
  el.style.height = s + 'px';
}

function shouldUseBrushCursor() {
  return annotState.active && (annotState.tool === 'pen' || annotState.tool === 'eraser' || annotState.tool === 'highlight');
}

