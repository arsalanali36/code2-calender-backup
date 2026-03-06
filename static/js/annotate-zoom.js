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

function resetZoom() { zoom.scale = 1; zoom.x = 0; zoom.y = 0; applyZoom(); }

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

  let lastDist = 0, swipeTracking = false;
  let swipeStartX = 0, swipeStartY = 0, swipeLastX = 0, swipeLastY = 0;
  wrapper.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      swipeTracking = false; return;
    }
    if (e.touches.length === 1 && zoom.scale <= 1 && !annotState.active) {
      swipeTracking = true;
      swipeStartX = swipeLastX = e.touches[0].clientX;
      swipeStartY = swipeLastY = e.touches[0].clientY;
      return;
    }
    swipeTracking = false;
  }, { passive: true });
  wrapper.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      zoom.scale = Math.min(Math.max(zoom.scale * (dist / lastDist), 1), 8);
      lastDist = dist; applyZoom(); return;
    }
    if (swipeTracking && e.touches.length === 1) {
      swipeLastX = e.touches[0].clientX; swipeLastY = e.touches[0].clientY;
      const dx = swipeLastX - swipeStartX, dy = swipeLastY - swipeStartY;
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) e.preventDefault();
    }
  }, { passive: false });
  wrapper.addEventListener('touchend', () => {
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

