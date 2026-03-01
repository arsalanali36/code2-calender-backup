// ─── annotate-fabric.js ─────────────────────────────────────────────────────
// Fabric.js-powered annotation engine.
// Replaces annotate-canvas.js + annotate-tools.js.
// Marquee boxes live on a separate plain canvas (#mq-overlay-canvas).
// ────────────────────────────────────────────────────────────────────────────

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

  // Zoom-layer mein sab kuch (img + canvas) ek saath transform hota hai
  const zoomLayer = document.getElementById('gallery-zoom-layer');
  if (zoomLayer) {
    zoomLayer.style.transform = tf;
    zoomLayer.style.transformOrigin = 'top left';
    // img ko alag se transform karne ki zaroorat nahi — zoom-layer handle karta hai
    img.style.transform = '';
  } else {
    // Fallback: zoom-layer nahi mila (purana HTML) — seedha img pe
    img.style.transform = tf;
    img.style.transformOrigin = 'top left';
    if (fabricCanvas && fabricCanvas.wrapperEl) {
      fabricCanvas.wrapperEl.style.transform = tf;
      fabricCanvas.wrapperEl.style.transformOrigin = 'top left';
    }
    if (_mqCanvas) { _mqCanvas.style.transform = tf; _mqCanvas.style.transformOrigin = 'top left'; }
  }

  if (zoom.scale > 1) { img.classList.add('zoomed'); img.classList.remove('dragging'); }
  else { img.classList.remove('zoomed', 'dragging'); }
}

function bindZoomPan() {
  const wrapper = document.getElementById('gallery-img-wrapper');
  const img = document.getElementById('gallery-img');

  wrapper.addEventListener('wheel', e => {
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

  wrapper.addEventListener('dblclick', () => resetZoom());

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
  const s = Math.max(10, Math.min(80, (annotState.size || 3) * 4));
  el.style.width = s + 'px';
  el.style.height = s + 'px';
}

function shouldUseBrushCursor() {
  return annotState.active && (annotState.tool === 'pen' || annotState.tool === 'eraser' || annotState.tool === 'highlight');
}

// ─── D. Marquee helpers ───────────────────────────────────────────────────────

function drawMarqueeBox(ctx, box, selected = false) {
  if (!box) return;
  const x = Math.round(box.x), y = Math.round(box.y), w = Math.round(box.w), h = Math.round(box.h);
  if (w < 4 || h < 4) return;
  const baseColor = box.color || '#2ea043';
  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = selected ? 2.5 : 2;
  ctx.strokeStyle = baseColor;
  ctx.fillStyle = selected ? (baseColor + '33') : (baseColor + '1A');
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  if (selected) {
    const hs = 8;
    ctx.fillStyle = '#58a6ff';
    ctx.fillRect(x + w - hs / 2, y + h - hs / 2, hs, hs);
    const dx = x + w - 2, dy = y - 2;
    ctx.fillStyle = 'rgba(190,26,48,0.95)';
    ctx.beginPath(); ctx.arc(dx, dy, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(dx - 4, dy - 4); ctx.lineTo(dx + 4, dy + 4);
    ctx.moveTo(dx + 4, dy - 4); ctx.lineTo(dx - 4, dy + 4); ctx.stroke();
  }
  ctx.restore();
  const tags = Array.isArray(box.tags) ? box.tags : [];
  if (!tags.length) return;
  const label = tags.join(', ');
  ctx.save();
  ctx.font = '12px Arial'; ctx.textBaseline = 'top';
  const padX = 6, padY = 3, lineH = 14;
  const maxW = Math.max(64, Math.min(ctx.canvas.width - x - 4, w));
  const words = label.split(',').map(s => s.trim()).filter(Boolean);
  const lines = []; let cur = '';
  words.forEach(part => {
    const candidate = cur ? `${cur}, ${part}` : part;
    if (ctx.measureText(candidate).width + padX * 2 <= maxW) cur = candidate;
    else { if (cur) lines.push(cur); cur = part; }
  });
  if (cur) lines.push(cur);
  const safeLines = lines.slice(0, 3);
  if (lines.length > 3) safeLines[2] += '...';
  const tw = safeLines.length ? Math.max(...safeLines.map(s => Math.ceil(ctx.measureText(s).width))) : 0;
  const lw = Math.min(maxW, tw + padX * 2);
  const lh = safeLines.length * lineH + padY * 2;
  const lx = Math.max(2, Math.min(x, ctx.canvas.width - lw - 2));
  let ly = y + h + 4;
  if (ly + lh > ctx.canvas.height - 2) ly = Math.max(2, y - lh - 4);
  ctx.fillStyle = 'rgba(15,23,35,0.88)'; ctx.fillRect(lx, ly, lw, lh);
  ctx.fillStyle = '#dbe7ff';
  safeLines.forEach((line, i) => ctx.fillText(line, lx + padX, ly + padY + i * lineH));
  ctx.restore();
}

function hitTestMarquee(x, y) {
  for (let i = annotState.marqueeBoxes.length - 1; i >= 0; i--) {
    const b = annotState.marqueeBoxes[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return i;
  }
  return -1;
}
function hitTestMarqueeResizeHandle(box, x, y) {
  if (!box) return false;
  return Math.abs(x - (box.x + box.w)) <= 12 && Math.abs(y - (box.y + box.h)) <= 12;
}
function hitTestMarqueeDeleteHandle(box, x, y) {
  if (!box) return false;
  const dx = box.x + box.w - 2, dy = box.y - 2;
  return (x - dx) * (x - dx) + (y - dy) * (y - dy) <= 121;
}
function getSelectedMarqueeIndexes() {
  const len = annotState.marqueeBoxes.length;
  const set = new Set((annotState.selectedMarquees || []).filter(i => Number.isInteger(i) && i >= 0 && i < len));
  if (annotState.selectedMarquee >= 0 && annotState.selectedMarquee < len) set.add(annotState.selectedMarquee);
  return Array.from(set).sort((a, b) => a - b);
}
function getSelectedMarqueeTagSet() {
  const tags = new Set();
  getSelectedMarqueeIndexes().forEach(i => {
    const box = annotState.marqueeBoxes[i];
    (Array.isArray(box?.tags) ? box.tags : []).forEach(t => { const x = String(t || '').trim(); if (x) tags.add(x); });
  });
  return tags;
}
function isMarqueeSelectionActive() {
  return !!(annotState.active && annotState.tool === 'marquee' && getSelectedMarqueeIndexes().length);
}
function syncMarqueeBoxesShadow() {
  if (!state._marqueeBoxes) state._marqueeBoxes = {};
  state._marqueeBoxes[annotState.imageUrl] = JSON.parse(JSON.stringify(annotState.marqueeBoxes || []));
}
function refreshGalleryTagsTrayIfVisible() {
  const tray = document.getElementById('gv2-tags-tray');
  if (tray && tray.style.display !== 'none') renderGalleryTagsTray();
}
function toggleTagOnSelectedMarquees(tag) {
  const t = String(tag || '').trim();
  if (!t || !isMarqueeSelectionActive()) return false;
  const idxs = getSelectedMarqueeIndexes();
  const selectedTagSet = getSelectedMarqueeTagSet();
  const shouldAdd = !selectedTagSet.has(t);
  idxs.forEach(i => {
    const box = annotState.marqueeBoxes[i];
    if (!box) return;
    const set = new Set((Array.isArray(box.tags) ? box.tags : []).map(x => String(x || '').trim()).filter(Boolean));
    if (shouldAdd) set.add(t); else set.delete(t);
    box.tags = Array.from(set);
  });
  annotState.dirty = true;
  syncMarqueeBoxesShadow();
  _renderMarqueeOnOverlayCanvas();
  refreshMarqueeTagSuggestions();
  return true;
}
function setSingleMarqueeSelection(idx) {
  if (idx < 0 || idx >= annotState.marqueeBoxes.length) {
    annotState.selectedMarquee = -1; annotState.selectedMarquees = [];
    refreshGalleryTagsTrayIfVisible(); return;
  }
  annotState.selectedMarquee = idx; annotState.selectedMarquees = [idx];
  refreshGalleryTagsTrayIfVisible();
}
function rectsIntersect(a, b) {
  return a.x < (b.x + b.w) && (a.x + a.w) > b.x && a.y < (b.y + b.h) && (a.y + a.h) > b.y;
}

function renderMarqueeScene(ctx, previewBox = null, selectRect = null) {
  // In Fabric mode: ctx is the MQ overlay canvas ctx, just clear + redraw
  // In legacy/view mode: restore rasterBase first
  if (fabricCanvas) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  } else if (annotState.marqueeRasterBase) {
    ctx.putImageData(annotState.marqueeRasterBase, 0, 0);
  }
  const selectedSet = new Set(getSelectedMarqueeIndexes());
  annotState.marqueeBoxes.forEach((b, i) => drawMarqueeBox(ctx, b, selectedSet.has(i)));
  if (previewBox) drawMarqueeBox(ctx, previewBox, true);
  if (selectRect && selectRect.w >= 2 && selectRect.h >= 2) {
    ctx.save();
    ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = '#58a6ff';
    ctx.fillStyle = 'rgba(88,166,255,0.12)';
    ctx.fillRect(selectRect.x, selectRect.y, selectRect.w, selectRect.h);
    ctx.strokeRect(selectRect.x, selectRect.y, selectRect.w, selectRect.h);
    ctx.restore();
  }
}

async function rebindCurrentImageOverlayToMarquee(ctx, canvas) {
  if (!annotState.active || !annotState.imageUrl || !ctx || !canvas) return false;
  const hadLocalOverlay = !!(state._localOverlays?.[annotState.imageUrl]);
  const penOnlyUrl = state._penOnlyOverlays?.[annotState.imageUrl];
  const removed = removeOverlayForImage(annotState.imageUrl, annotState.date, annotState.sourceRow);
  if (state._localOverlays?.[annotState.imageUrl]) delete state._localOverlays[annotState.imageUrl];

  if (fabricCanvas) {
    // In Fabric mode: clear the canvas and reload pen-only layer
    fabricCanvas.clear();
    fabricCanvas.setBackgroundImage(null, () => { });
    if (penOnlyUrl) {
      await new Promise(resolve => {
        fabric.Image.fromURL(penOnlyUrl, img => {
          img.set({ selectable: false, evented: false, left: 0, top: 0 });
          fabricCanvas.setBackgroundImage(img, () => { fabricCanvas.requestRenderAll(); resolve(); },
            { originX: 'left', originY: 'top' });
        });
      });
    } else {
      fabricCanvas.requestRenderAll();
    }
    _renderMarqueeOnOverlayCanvas();
  } else {
    // Legacy plain canvas mode
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!removed && !hadLocalOverlay && annotState.marqueeRasterBase) {
      ctx.putImageData(annotState.marqueeRasterBase, 0, 0);
      annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
      renderMarqueeScene(ctx);
    } else if (penOnlyUrl) {
      await new Promise(resolve => {
        const pi = new Image();
        pi.onload = () => {
          ctx.drawImage(pi, 0, 0, canvas.width, canvas.height);
          annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
          renderMarqueeScene(ctx); resolve();
        };
        pi.onerror = () => { annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height); renderMarqueeScene(ctx); resolve(); };
        pi.src = penOnlyUrl;
      });
    } else {
      annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
      renderMarqueeScene(ctx);
    }
  }

  annotState.dirty = true;
  if (removed) { await saveTrades(); showToast('Overlay rebind complete: editable marquee active', 'success'); }
  else { showToast('No frozen overlay found. Marquee is already editable', 'success'); }
  return removed;
}

function refreshMarqueeTagSuggestions() {
  const dl = document.getElementById('gv2-mq-tag-suggestions');
  if (!dl) return;
  const tags = Array.from(new Set((state.allTags || []).map(t => String(t || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  dl.innerHTML = '';
  tags.forEach(tag => { const o = document.createElement('option'); o.value = tag; dl.appendChild(o); });
}

function addTagToSelectedMarqueeBox(rawTag) {
  const idx = annotState.selectedMarquee;
  const tag = String(rawTag || '').trim();
  if (!annotState.active || annotState.tool !== 'marquee' || idx < 0 || !tag) return false;
  const box = annotState.marqueeBoxes[idx];
  if (!box) return false;
  if (!box.tags) box.tags = [];
  if (!box.tags.includes(tag)) box.tags.push(tag);
  _renderMarqueeOnOverlayCanvas();
  annotState.dirty = true;
  if (!state._marqueeBoxes) state._marqueeBoxes = {};
  state._marqueeBoxes[annotState.imageUrl] = JSON.parse(JSON.stringify(annotState.marqueeBoxes));
  if (!state.allTags.includes(tag)) { state.allTags.push(tag); refreshMarqueeTagSuggestions(); }
  renderGalleryTagCloud();
  return true;
}

// ─── E. Tool state ───────────────────────────────────────────────────────────

function toggleAnnotation() {
  if (annotState.active && annotState.tool === 'text') {
    commitActiveCanvasTextEditor();
    document.getElementById('gv2-text-bar')?.style.setProperty('display', 'none');
    document.getElementById('gv2-text-btn').classList.remove('active');
    document.getElementById('gv2-annot-bar')?.style.setProperty('display', 'flex');
    document.getElementById('gv2-annotate-btn').classList.add('active');
    setAnnotTool('pen'); return;
  }
  if (annotState.active) {
    if (annotState.tool === 'marquee') {
      document.getElementById('gv2-marquee-bar')?.style.setProperty('display', 'none');
      document.getElementById('gv2-marquee-btn').classList.remove('active');
    }
    stopAnnotation();
  } else {
    annotState.tool = 'pen';
    startAnnotation();
  }
}

function toggleMarquee() {
  if (annotState.active && annotState.tool === 'marquee') { stopAnnotation(); return; }
  if (!annotState.active) { annotState.tool = 'marquee'; startAnnotation(); }
  else { setAnnotTool('marquee'); }
  document.getElementById('gv2-marquee-bar')?.style.setProperty('display', 'flex');
  document.getElementById('gv2-annot-bar')?.style.setProperty('display', 'none');
  document.getElementById('gv2-text-bar')?.style.setProperty('display', 'none');
  document.getElementById('gv2-marquee-btn').classList.add('active');
  document.getElementById('gv2-annotate-btn').classList.remove('active');
  document.getElementById('gv2-text-btn').classList.remove('active');
  const inp = document.getElementById('gv2-mq-tag-input');
  if (inp) setTimeout(() => inp.focus(), 50);
}

function setAnnotTool(tool) {
  const _prevTool = annotState.tool;
  annotState.tool = tool;
  if (tool !== 'marquee') {
    annotState.multiSelectMode = false; annotState.selectedMarquees = []; annotState.marqueeSelectRect = null;
  }
  document.querySelectorAll('.annot-tool').forEach(b => b.classList.remove('active'));
  // Shape group button handle karo (arrow/rect/circle ek grouped btn hai)
  const shapeTools = ['arrow', 'rect', 'circle'];
  const shapeBtn = document.getElementById('annot-shape');
  if (shapeTools.includes(tool) && shapeBtn) {
    const icons = { arrow: '&#8599;', rect: '&#9645;', circle: '&#11096;' };
    shapeBtn.innerHTML = icons[tool];
    shapeBtn.dataset.shape = tool;
    shapeBtn.classList.add('active');
    // Context menu mein active mark karo
    document.querySelectorAll('.annot-shape-opt').forEach(o => {
      o.classList.toggle('active-shape', o.dataset.tool === tool);
    });
  } else {
    const btn = document.getElementById('annot-' + tool);
    if (btn) btn.classList.add('active');
  }
  const mqBtn = document.getElementById('gv2-marquee-btn');
  if (mqBtn) mqBtn.classList.toggle('active', tool === 'marquee');
  if (!annotState.active) return;
  const textBar = document.getElementById('gv2-text-bar');
  const mqBar = document.getElementById('gv2-marquee-bar');
  if (textBar) textBar.style.display = tool === 'text' ? 'flex' : 'none';
  if (mqBar) mqBar.style.display = tool === 'marquee' ? 'flex' : 'none';
  const brushCursor = ensureAnnotBrushCursor();
  if (brushCursor) brushCursor.style.display = shouldUseBrushCursor() ? 'block' : 'none';
  updateAnnotBrushCursorVisual();
  updateMarqueeMultiSelectButton();
  if (fabricCanvas) _applyFabricToolMode(tool);
}

function updateMarqueeMultiSelectButton() {
  const btn = document.getElementById('annot-vselect');
  if (!btn) return;
  btn.classList.toggle('active', annotState.tool === 'marquee' && annotState.multiSelectMode);
}

function toggleMarqueeGroupSelect(forceState = null) {
  if (!annotState.active) startAnnotation();
  setAnnotTool('marquee');
  annotState.multiSelectMode = typeof forceState === 'boolean' ? forceState : !annotState.multiSelectMode;
  if (!annotState.multiSelectMode) annotState.marqueeSelectRect = null;
  updateMarqueeMultiSelectButton();
  _renderMarqueeOnOverlayCanvas();
  showToast(annotState.multiSelectMode ? 'Marquee group select ON' : 'Marquee group select OFF', 'success');
}

function updateAnnotToolIcons() {
  const marker = document.getElementById('annot-highlight');
  if (marker) marker.innerHTML = '&#9670;';
}

function adjustAnnotSize(delta) {
  const inp = document.getElementById('annot-size');
  if (!inp) return;
  const min = parseInt(inp.min || '1', 10), max = parseInt(inp.max || '30', 10);
  const next = Math.max(min, Math.min(max, (parseInt(inp.value, 10) || annotState.size || 3) + delta));
  inp.value = String(next);
  annotState.size = next;
  const lbl = document.getElementById('annot-size-label');
  if (lbl) lbl.textContent = next + 'px';
  updateAnnotToolIcons();
  updateAnnotBrushCursorVisual();
  // Update active Fabric brush size
  if (fabricCanvas && fabricCanvas.isDrawingMode && fabricCanvas.freeDrawingBrush) {
    if (annotState.tool === 'pen') fabricCanvas.freeDrawingBrush.width = next;
    else if (annotState.tool === 'highlight') fabricCanvas.freeDrawingBrush.width = next * 5;
    else if (annotState.tool === 'eraser') fabricCanvas.freeDrawingBrush.width = next * 4;
  }
}

function commitActiveCanvasTextEditor() {
  // Fabric IText editing mode
  if (fabricCanvas) {
    const obj = fabricCanvas.getActiveObject();
    if (obj && obj.type === 'i-text' && obj.isEditing) obj.exitEditing();
    fabricCanvas.discardActiveObject();
    fabricCanvas.requestRenderAll();
  }
  // Legacy textarea fallback
  const editor = document.querySelector('#gallery-img-wrapper .canvas-text-editor');
  if (editor) editor.blur();
}

// ─── F. Fabric tool mode ──────────────────────────────────────────────────────

function _applyFabricToolMode(tool) {
  if (!fabricCanvas) return;
  _eraserActive = false;
  _isShapeDrawing = false;
  _activeShape = null;

  // Reset Fabric state
  fabricCanvas.isDrawingMode = false;
  fabricCanvas.selection = false;
  fabricCanvas.discardActiveObject();

  // MQ canvas routing
  const mqC = _mqCanvas;
  if (mqC) mqC.style.pointerEvents = (tool === 'marquee') ? 'auto' : 'none';
  if (fabricCanvas.wrapperEl) fabricCanvas.wrapperEl.style.pointerEvents = (tool === 'marquee') ? 'none' : '';

  switch (tool) {
    case 'pen': {
      fabricCanvas.freeDrawingCursor = 'none';
      fabricCanvas.isDrawingMode = true;
      const b = new fabric.PencilBrush(fabricCanvas);
      b.width = annotState.size; b.color = annotState.color;
      fabricCanvas.freeDrawingBrush = b;
      _setCursor('none');
      break;
    }
    case 'highlight': {
      fabricCanvas.freeDrawingCursor = 'none';
      fabricCanvas.isDrawingMode = true;
      const b = new fabric.PencilBrush(fabricCanvas);
      b.width = annotState.size * 5;
      b.color = annotState.color + '55';
      fabricCanvas.freeDrawingBrush = b;
      _setCursor('none');
      break;
    }
    case 'eraser': {
      fabricCanvas.defaultCursor = 'none';
      _eraserActive = true;
      _setCursor('none');
      break;
    }
    case 'select': {
      fabricCanvas.selection = true;
      fabricCanvas.defaultCursor = 'default';
      fabricCanvas.hoverCursor = 'move';
      _setCursor('default');
      // Sab existing objects ko selectable/evented karo (base/baked ko chodo)
      fabricCanvas.getObjects().forEach(obj => {
        if (!obj.data?.isOverlayBase && !obj.data?.isBaked) {
          obj.selectable = true;
          obj.evented = true;
        }
      });
      break;
    }
    case 'text': {
      fabricCanvas.defaultCursor = 'text';
      _setCursor('text');
      break;
    }
    case 'arrow':
    case 'rect':
    case 'circle': {
      fabricCanvas.defaultCursor = 'crosshair';
      _setCursor('crosshair');
      break;
    }
    case 'marquee': {
      _setCursor('crosshair', true); // set on mq canvas
      break;
    }
  }

  const brushCursor = document.getElementById('annot-brush-cursor');
  if (brushCursor) brushCursor.style.display = shouldUseBrushCursor() ? 'block' : 'none';
}

function _setCursor(cur, onMqCanvas = false) {
  if (onMqCanvas) {
    if (_mqCanvas) _mqCanvas.style.cursor = cur;
    return;
  }
  if (fabricCanvas && fabricCanvas.upperCanvasEl) fabricCanvas.upperCanvasEl.style.cursor = cur;
  if (fabricCanvas && fabricCanvas.wrapperEl) fabricCanvas.wrapperEl.style.cursor = cur;
}

// ─── G. Fabric history ────────────────────────────────────────────────────────

function _initFabricHistory() {
  _fabricHistory = []; _fabricFuture = []; _historyLocked = false;
  _pushFabricHistorySnapshot();
}

function _pushFabricHistorySnapshot() {
  if (_historyLocked || !fabricCanvas) return;
  const snap = JSON.stringify(fabricCanvas.toJSON(['data', 'selectable', 'evented']));
  _fabricHistory.push(snap);
  if (_fabricHistory.length > 40) _fabricHistory.shift();
  _fabricFuture = [];
}

function fabricUndo() {
  if (!fabricCanvas || _fabricHistory.length <= 1) return;
  const current = _fabricHistory.pop();
  _fabricFuture.push(current);
  _restoreFabricSnapshot(_fabricHistory[_fabricHistory.length - 1]);
}

function fabricRedo() {
  if (!fabricCanvas || !_fabricFuture.length) return;
  const next = _fabricFuture.pop();
  _fabricHistory.push(next);
  _restoreFabricSnapshot(next);
}

function _restoreFabricSnapshot(snap) {
  _historyLocked = true;
  fabricCanvas.loadFromJSON(snap, () => {
    fabricCanvas.requestRenderAll();
    annotState.dirty = true;
    _historyLocked = false;
  }, (o, obj) => { if (o.data) obj.data = o.data; });
}

// ─── H. Fabric shape / text drawing ──────────────────────────────────────────

function _bindFabricShapeEvents() {
  if (!fabricCanvas) return;

  fabricCanvas.on('mouse:down', e => {
    if (!annotState.active) return;
    const tool = annotState.tool;
    console.log('[Fabric] mouse:down tool:', tool, 'isDrawingMode:', fabricCanvas.isDrawingMode);
    const pointer = fabricCanvas.getPointer(e.e);

    // Eraser: pehle Fabric object check, fir pixel erase
    if (_eraserActive && tool === 'eraser') {
      // Agar koi shape/path object hai wahan, use poora remove karo
      const hitObj = fabricCanvas.findTarget(e.e);
      if (hitObj && !hitObj.data?.isOverlayBase && !hitObj.data?.isBaked) {
        fabricCanvas.remove(hitObj);
        fabricCanvas.discardActiveObject();
        fabricCanvas.requestRenderAll();
        _pushFabricHistorySnapshot();
        annotState.dirty = true;
        return;
      }
      // Koi object nahi mila — pixel-level erase (pen strokes bake ho chuke hain)
      _eraserLastPos = pointer;
      const ctx = fabricCanvas.lowerCanvasEl.getContext('2d');
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, annotState.size * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (tool === 'text') { _createFabricIText(pointer); return; }
    if (['arrow', 'rect', 'circle'].includes(tool)) {
      // Agar existing Fabric object pe click hua toh naya shape mat banao
      if (e.target) return;
      _shapeStartPoint = pointer;
      _isShapeDrawing = true;
      _historyLocked = true;

      if (tool === 'rect') {
        _activeShape = new fabric.Rect({
          left: pointer.x, top: pointer.y, width: 0, height: 0,
          fill: 'transparent', stroke: annotState.color, strokeWidth: annotState.size,
          selectable: false
        });
      } else if (tool === 'circle') {
        _activeShape = new fabric.Ellipse({
          left: pointer.x, top: pointer.y, rx: 0, ry: 0,
          fill: 'transparent', stroke: annotState.color, strokeWidth: annotState.size,
          selectable: false
        });
      } else if (tool === 'arrow') {
        _activeShape = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: annotState.color, strokeWidth: annotState.size,
          selectable: false
        });
      }
      if (_activeShape) fabricCanvas.add(_activeShape);
    }
  });

  fabricCanvas.on('mouse:move', e => {
    if (!annotState.active) return;
    const tool = annotState.tool;
    const pointer = fabricCanvas.getPointer(e.e);

    // Update brush cursor pos
    const brushEl = document.getElementById('annot-brush-cursor');
    if (brushEl && shouldUseBrushCursor()) {
      const wr = document.getElementById('gallery-img-wrapper').getBoundingClientRect();
      const src = e.e.touches ? e.e.touches[0] : e.e;
      brushEl.style.left = (src.clientX - wr.left) + 'px';
      brushEl.style.top = (src.clientY - wr.top) + 'px';
      brushEl.style.display = 'block';
    }

    // Eraser
    if (_eraserActive && tool === 'eraser' && e.e.buttons === 1) {
      // Drag karte waqt bhi Fabric object check — shape pe se guzre toh remove karo
      const hitObj = fabricCanvas.findTarget(e.e);
      if (hitObj && !hitObj.data?.isOverlayBase && !hitObj.data?.isBaked) {
        fabricCanvas.remove(hitObj);
        fabricCanvas.discardActiveObject();
        fabricCanvas.requestRenderAll();
        annotState.dirty = true;
        _eraserLastPos = null; // pixel stroke reset
        return;
      }
      if (!_eraserLastPos) { _eraserLastPos = pointer; return; }
      const ctx = fabricCanvas.lowerCanvasEl.getContext('2d');
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineWidth = annotState.size * 4;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.beginPath();
      ctx.moveTo(_eraserLastPos.x, _eraserLastPos.y);
      ctx.lineTo(pointer.x, pointer.y);
      ctx.stroke();
      ctx.restore();
      _eraserLastPos = pointer;
      return;
    }

    if (!_isShapeDrawing || !_activeShape || !_shapeStartPoint) return;
    const dx = pointer.x - _shapeStartPoint.x;
    const dy = pointer.y - _shapeStartPoint.y;

    if (tool === 'rect') {
      _activeShape.set({
        left: Math.min(_shapeStartPoint.x, pointer.x),
        top: Math.min(_shapeStartPoint.y, pointer.y),
        width: Math.abs(dx), height: Math.abs(dy)
      });
    } else if (tool === 'circle') {
      _activeShape.set({
        left: Math.min(_shapeStartPoint.x, pointer.x),
        top: Math.min(_shapeStartPoint.y, pointer.y),
        rx: Math.abs(dx) / 2, ry: Math.abs(dy) / 2
      });
    } else if (tool === 'arrow') {
      _activeShape.set({ x2: pointer.x, y2: pointer.y });
    }
    fabricCanvas.requestRenderAll();
  });

  fabricCanvas.on('mouse:up', e => {
    if (!annotState.active) return;
    const tool = annotState.tool;

    // Eraser: after stroke, bake everything to preserve destination-out pixels
    if (_eraserActive && tool === 'eraser') {
      _eraserLastPos = null;
      _bakeRasterToBackground().then(() => _pushFabricHistorySnapshot());
      annotState.dirty = true;
      return;
    }

    if (!_isShapeDrawing || !_activeShape) return;
    _isShapeDrawing = false;
    _historyLocked = false;

    const pointer = fabricCanvas.getPointer(e.e);
    const dx = Math.abs(pointer.x - _shapeStartPoint.x);
    const dy = Math.abs(pointer.y - _shapeStartPoint.y);

    if (tool === 'arrow') {
      const dist = Math.hypot(dx, dy);
      if (dist < 10) { fabricCanvas.remove(_activeShape); _activeShape = null; return; }
      // Replace line with arrow group
      const x1 = _shapeStartPoint.x, y1 = _shapeStartPoint.y;
      const x2 = pointer.x, y2 = pointer.y;
      fabricCanvas.remove(_activeShape);
      _addArrowGroup(x1, y1, x2, y2);
    } else {
      if (dx < 8 || dy < 8) { fabricCanvas.remove(_activeShape); _activeShape = null; return; }
      _activeShape.set({ selectable: true });
      fabricCanvas.setActiveObject(_activeShape);
      fabricCanvas.requestRenderAll();
    }
    _activeShape = null;
    _pushFabricHistorySnapshot();
    annotState.dirty = true;
  });

  fabricCanvas.on('mouse:out', () => {
    const brushEl = document.getElementById('annot-brush-cursor');
    if (brushEl) brushEl.style.display = 'none';
  });

  // History hooks for non-drawing operations
  fabricCanvas.on('path:created', (e) => {
    console.log('[Fabric] path:created ✓ color:', e.path?.stroke, 'width:', e.path?.strokeWidth);
    annotState.dirty = true; _pushFabricHistorySnapshot();
  });
  fabricCanvas.on('object:modified', () => { annotState.dirty = true; _pushFabricHistorySnapshot(); });
  fabricCanvas.on('object:removed', () => { annotState.dirty = true; _pushFabricHistorySnapshot(); });
}

function _addArrowGroup(x1, y1, x2, y2) {
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  const size = annotState.size;
  const line = new fabric.Line([x1, y1, x2, y2], {
    stroke: annotState.color, strokeWidth: size, selectable: false, evented: false
  });
  const arrowHead = new fabric.Triangle({
    left: x2, top: y2, width: size * 5, height: size * 5,
    fill: annotState.color, angle: angle + 90,
    originX: 'center', originY: 'center', selectable: false, evented: false
  });
  const group = new fabric.Group([line, arrowHead], {
    selectable: true, data: { isArrow: true }
  });
  fabricCanvas.add(group);
  fabricCanvas.setActiveObject(group);
  fabricCanvas.requestRenderAll();
}

function _createFabricIText(pointer) {
  const color = document.getElementById('gv2-tb-color')?.value || '#ffffff';
  const size = parseInt(document.getElementById('gv2-tb-size')?.value || '24', 10);
  const font = document.getElementById('gv2-tb-font')?.value || 'Arial';
  const bold = document.getElementById('gv2-tb-bold')?.classList.contains('active') ? 'bold' : 'normal';
  const italic = document.getElementById('gv2-tb-italic')?.classList.contains('active') ? 'italic' : 'normal';
  const alignBtn = document.getElementById('gv2-tb-align');
  let align = 'left';
  if (alignBtn?.classList.contains('align-center')) align = 'center';
  else if (alignBtn?.classList.contains('align-right')) align = 'right';

  const itext = new fabric.IText('', {
    left: pointer.x, top: pointer.y,
    fill: color, fontSize: size, fontFamily: font,
    fontWeight: bold, fontStyle: italic, textAlign: align,
    editable: true, selectable: true,
    data: { isText: true }
  });
  fabricCanvas.add(itext);
  fabricCanvas.setActiveObject(itext);
  itext.enterEditing();
  itext.on('editing:exited', () => {
    if (!itext.text || !itext.text.trim()) {
      fabricCanvas.remove(itext);
    } else {
      _pushFabricHistorySnapshot();
      annotState.dirty = true;
    }
    fabricCanvas.requestRenderAll();
  });
}

async function _bakeRasterToBackground() {
  if (!fabricCanvas) return;
  const dataUrl = fabricCanvas.lowerCanvasEl.toDataURL('image/png');
  await new Promise(resolve => {
    fabric.Image.fromURL(dataUrl, img => {
      img.set({ selectable: false, evented: false, left: 0, top: 0, data: { isBaked: true } });
      fabricCanvas.clear();
      fabricCanvas.setBackgroundImage(img, () => { fabricCanvas.requestRenderAll(); resolve(); },
        { originX: 'left', originY: 'top' });
    });
  });
}

// ─── I. Marquee overlay canvas ────────────────────────────────────────────────

function _ensureMarqueeOverlayCanvas() {
  if (_mqCanvas && _mqCanvas.isConnected) return _mqCanvas;
  // zoom-layer ke andar append karo taaki zoom ke saath saath move kare
  const wrapper = document.getElementById('gallery-zoom-layer') || document.getElementById('gallery-img-wrapper');
  if (!wrapper) return null;
  let c = document.getElementById('mq-overlay-canvas');
  if (!c) {
    c = document.createElement('canvas');
    c.id = 'mq-overlay-canvas';
    c.style.position = 'absolute';
    c.style.pointerEvents = 'none';
    c.style.zIndex = '200';
    c.style.imageRendering = 'pixelated';
    wrapper.appendChild(c);
  }
  // Match annotation canvas dimensions
  const img = document.getElementById('gallery-img');
  c.width = Math.round(img.clientWidth || img.naturalWidth || 1);
  c.height = Math.round(img.clientHeight || img.naturalHeight || 1);
  c.style.margin = 'auto';
  c.style.inset = '0';
  c.style.width = c.width + 'px';
  c.style.height = c.height + 'px';
  c.style.display = 'block';
  _mqCanvas = c;
  return c;
}

function _destroyMarqueeOverlayCanvas() {
  if (_mqCanvas) { _mqCanvas.remove(); _mqCanvas = null; }
}

function _renderMarqueeOnOverlayCanvas() {
  if (!_mqCanvas) return;
  const ctx = _mqCanvas.getContext('2d');
  renderMarqueeScene(ctx);
}

function _bindMarqueeCanvasEvents(mqCanvas) {
  // Reuse marquee mouse logic from old system, adapted to mqCanvas
  function getMqPos(e) {
    const r = mqCanvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    const sx = mqCanvas.width / Math.max(1, r.width);
    const sy = mqCanvas.height / Math.max(1, r.height);
    return { x: (src.clientX - r.left) * sx, y: (src.clientY - r.top) * sy };
  }

  function persistMq() {
    if (!state._marqueeBoxes) state._marqueeBoxes = {};
    state._marqueeBoxes[annotState.imageUrl] = JSON.parse(JSON.stringify(annotState.marqueeBoxes || []));
  }

  mqCanvas.addEventListener('mousedown', e => {
    if (!annotState.active || annotState.tool !== 'marquee') return;
    e.preventDefault();
    const ctx = mqCanvas.getContext('2d');
    const pos = getMqPos(e);
    const picked = hitTestMarquee(pos.x, pos.y);

    if (annotState.multiSelectMode) {
      if (picked >= 0 && getSelectedMarqueeIndexes().includes(picked)) {
        annotState.drawing = true; annotState.marqueeDragStartX = pos.x; annotState.marqueeDragStartY = pos.y;
        annotState.marqueeDragMode = 'move-group';
        annotState.marqueeDragGroupOrig = getSelectedMarqueeIndexes().map(i => ({ i, x: annotState.marqueeBoxes[i].x, y: annotState.marqueeBoxes[i].y }));
        annotState.marqueeDragOrig = null; mqCanvas.style.cursor = 'grabbing';
        renderMarqueeScene(ctx); return;
      }
      annotState.drawing = true; annotState.marqueeDragMode = 'select';
      annotState.marqueeSelectStartX = pos.x; annotState.marqueeSelectStartY = pos.y;
      annotState.marqueeSelectRect = { x: pos.x, y: pos.y, w: 0, h: 0 };
      renderMarqueeScene(ctx, null, annotState.marqueeSelectRect); return;
    }

    if (picked >= 0) {
      setSingleMarqueeSelection(picked);
      const pickedBox = annotState.marqueeBoxes[picked];
      if (hitTestMarqueeDeleteHandle(pickedBox, pos.x, pos.y)) {
        annotState.marqueeBoxes.splice(picked, 1);
        setSingleMarqueeSelection(Math.min(picked, annotState.marqueeBoxes.length - 1));
        renderMarqueeScene(ctx); annotState.dirty = true; persistMq(); return;
      }
      annotState.drawing = true; annotState.marqueeDragStartX = pos.x; annotState.marqueeDragStartY = pos.y;
      if (!hitTestMarqueeResizeHandle(pickedBox, pos.x, pos.y) && getSelectedMarqueeIndexes().length > 1) {
        annotState.marqueeDragMode = 'move-group';
        annotState.marqueeDragGroupOrig = getSelectedMarqueeIndexes().map(i => ({ i, x: annotState.marqueeBoxes[i].x, y: annotState.marqueeBoxes[i].y }));
        annotState.marqueeDragOrig = null;
      } else {
        annotState.marqueeDragOrig = { ...pickedBox };
        annotState.marqueeDragMode = hitTestMarqueeResizeHandle(pickedBox, pos.x, pos.y) ? 'resize' : 'move';
        annotState.marqueeDragGroupOrig = [];
      }
      mqCanvas.style.cursor = (annotState.marqueeDragMode === 'move' || annotState.marqueeDragMode === 'move-group') ? 'grabbing' : 'nwse-resize';
      renderMarqueeScene(ctx); return;
    }

    annotState.drawing = true; annotState.marqueeDragMode = 'create';
    mqCanvas.style.cursor = 'crosshair';
    annotState.marqueeStartX = pos.x; annotState.marqueeStartY = pos.y;
    renderMarqueeScene(ctx);
  });

  mqCanvas.addEventListener('mousemove', e => {
    if (!annotState.active || annotState.tool !== 'marquee') return;
    const ctx = mqCanvas.getContext('2d');
    const pos = getMqPos(e);

    // Cursor update
    if (!annotState.drawing) {
      if (annotState.multiSelectMode) { mqCanvas.style.cursor = 'crosshair'; }
      else {
        const idx = hitTestMarquee(pos.x, pos.y);
        if (idx >= 0) {
          const b = annotState.marqueeBoxes[idx];
          if (hitTestMarqueeDeleteHandle(b, pos.x, pos.y)) mqCanvas.style.cursor = 'pointer';
          else if (hitTestMarqueeResizeHandle(b, pos.x, pos.y)) mqCanvas.style.cursor = 'nwse-resize';
          else mqCanvas.style.cursor = 'grab';
        } else { mqCanvas.style.cursor = 'crosshair'; }
      }
      return;
    }

    e.preventDefault();
    const mode = annotState.marqueeDragMode || 'create';
    if (mode === 'move-group' && annotState.marqueeDragGroupOrig.length) {
      const dx = pos.x - annotState.marqueeDragStartX, dy = pos.y - annotState.marqueeDragStartY;
      annotState.marqueeDragGroupOrig.forEach(({ i, x, y }) => {
        const box = annotState.marqueeBoxes[i]; if (!box) return;
        box.x = Math.max(0, Math.min(mqCanvas.width - box.w, x + dx));
        box.y = Math.max(0, Math.min(mqCanvas.height - box.h, y + dy));
      });
      renderMarqueeScene(ctx); return;
    }
    if (mode === 'move' && annotState.selectedMarquee >= 0 && annotState.marqueeDragOrig) {
      const box = annotState.marqueeBoxes[annotState.selectedMarquee];
      const dx = pos.x - annotState.marqueeDragStartX, dy = pos.y - annotState.marqueeDragStartY;
      box.x = Math.max(0, Math.min(mqCanvas.width - box.w, annotState.marqueeDragOrig.x + dx));
      box.y = Math.max(0, Math.min(mqCanvas.height - box.h, annotState.marqueeDragOrig.y + dy));
      renderMarqueeScene(ctx); return;
    }
    if (mode === 'resize' && annotState.selectedMarquee >= 0 && annotState.marqueeDragOrig) {
      const box = annotState.marqueeBoxes[annotState.selectedMarquee];
      box.w = Math.max(8, Math.min(mqCanvas.width - box.x, annotState.marqueeDragOrig.w + (pos.x - annotState.marqueeDragStartX)));
      box.h = Math.max(8, Math.min(mqCanvas.height - box.y, annotState.marqueeDragOrig.h + (pos.y - annotState.marqueeDragStartY)));
      renderMarqueeScene(ctx); return;
    }
    if (mode === 'select') {
      const x = Math.min(annotState.marqueeSelectStartX, pos.x), y = Math.min(annotState.marqueeSelectStartY, pos.y);
      annotState.marqueeSelectRect = { x, y, w: Math.abs(pos.x - annotState.marqueeSelectStartX), h: Math.abs(pos.y - annotState.marqueeSelectStartY) };
      renderMarqueeScene(ctx, null, annotState.marqueeSelectRect); return;
    }
    const x = Math.min(annotState.marqueeStartX, pos.x), y = Math.min(annotState.marqueeStartY, pos.y);
    renderMarqueeScene(ctx, { x, y, w: Math.abs(pos.x - annotState.marqueeStartX), h: Math.abs(pos.y - annotState.marqueeStartY), tags: [] });
  });

  function mqMouseUp(e) {
    if (!annotState.active || !annotState.drawing) return;
    const ctx = mqCanvas.getContext('2d');
    const pos = getMqPos(e);
    const mode = annotState.marqueeDragMode || 'create';
    annotState.drawing = false; annotState.marqueeDragMode = '';
    annotState.marqueeDragOrig = null; annotState.marqueeDragGroupOrig = [];
    if (mode === 'create') {
      const x = Math.min(annotState.marqueeStartX, pos.x), y = Math.min(annotState.marqueeStartY, pos.y);
      const w = Math.abs(pos.x - annotState.marqueeStartX), h = Math.abs(pos.y - annotState.marqueeStartY);
      if (w >= 8 && h >= 8) {
        annotState.marqueeBoxes.push({ x, y, w, h, tags: [] });
        setSingleMarqueeSelection(annotState.marqueeBoxes.length - 1);
        annotState.dirty = true;
      }
    } else if (mode === 'select') {
      const sel = annotState.marqueeSelectRect;
      annotState.marqueeSelectRect = null;
      if (sel && sel.w >= 4 && sel.h >= 4) {
        const selected = [];
        annotState.marqueeBoxes.forEach((b, i) => { if (rectsIntersect(sel, b)) selected.push(i); });
        annotState.selectedMarquees = selected;
        annotState.selectedMarquee = selected.length ? selected[selected.length - 1] : -1;
        refreshGalleryTagsTrayIfVisible();
      }
    } else if (['move', 'resize', 'move-group'].includes(mode)) {
      annotState.dirty = true;
    }
    renderMarqueeScene(ctx);
    persistMq();
    mqCanvas.style.cursor = 'crosshair';
  }

  mqCanvas.addEventListener('mouseup', mqMouseUp);
  mqCanvas.addEventListener('mouseleave', mqMouseUp);

  mqCanvas.addEventListener('contextmenu', e => {
    if (!annotState.active || annotState.tool !== 'marquee') return;
    const pos = getMqPos(e);
    const idx = hitTestMarquee(pos.x, pos.y);
    if (idx < 0) { const m = document.getElementById('mq-context-menu'); if (m) m.style.display = 'none'; return; }
    e.preventDefault();
    if (!getSelectedMarqueeIndexes().includes(idx)) setSingleMarqueeSelection(idx);
    _renderMarqueeOnOverlayCanvas();
    _showMarqueeContextMenu(e.clientX, e.clientY, idx);
  });
}

// ─── J. Marquee context menu ──────────────────────────────────────────────────

let _mqCtxMenu = null, _mqCtxIdx = -1;

function _hideMarqueeContextMenu() {
  if (_mqCtxMenu) _mqCtxMenu.style.display = 'none';
  _mqCtxIdx = -1;
}

function _ensureMarqueeContextMenu() {
  if (_mqCtxMenu) return _mqCtxMenu;
  _mqCtxMenu = document.createElement('div');
  _mqCtxMenu.id = 'mq-context-menu';
  Object.assign(_mqCtxMenu.style, {
    position: 'fixed', zIndex: '99999', minWidth: '160px',
    background: 'var(--surface)', border: '1px solid var(--border2)',
    borderRadius: '8px', boxShadow: '0 8px 30px rgba(0,0,0,0.45)', padding: '8px', display: 'none'
  });
  _mqCtxMenu.innerHTML = `
    <button type="button" id="mq-ctx-del" class="gv2-ab-btn" style="width:100%;justify-content:flex-start">Delete Marquee</button>
    <button type="button" id="mq-ctx-dup" class="gv2-ab-btn" style="width:100%;justify-content:flex-start">Duplicate</button>
    <button type="button" id="mq-ctx-rebind" class="gv2-ab-btn" style="width:100%;justify-content:flex-start">Rebind</button>
    <div style="font-size:0.68rem;color:var(--text3);margin:8px 2px 4px">Marquee Color</div>
    <div style="display:flex;gap:6px;margin-bottom:8px">
      <button type="button" class="mq-ctx-color" data-color="#2ea043" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border2);background:#2ea043;cursor:pointer"></button>
      <button type="button" class="mq-ctx-color" data-color="#58a6ff" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border2);background:#58a6ff;cursor:pointer"></button>
      <button type="button" class="mq-ctx-color" data-color="#f85149" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border2);background:#f85149;cursor:pointer"></button>
    </div>
    <div style="font-size:0.68rem;color:var(--text3);margin:8px 2px 4px">Add Tag (Enter to apply)</div>
    <input type="text" id="mq-ctx-tag-inp" autocomplete="off" style="width:100%;box-sizing:border-box;padding:6px;font-size:12px;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:4px;margin-bottom:8px;" placeholder="Type tag..." />
    <button type="button" id="mq-ctx-close-tool" class="gv2-ab-btn" style="width:100%;justify-content:flex-start">Close Tool</button>
  `;
  document.body.appendChild(_mqCtxMenu);

  _mqCtxMenu.querySelector('#mq-ctx-del').addEventListener('click', () => {
    const targets = getSelectedMarqueeIndexes().includes(_mqCtxIdx) ? getSelectedMarqueeIndexes() : [_mqCtxIdx];
    [...targets].sort((a, b) => b - a).forEach(i => { if (i >= 0 && i < annotState.marqueeBoxes.length) annotState.marqueeBoxes.splice(i, 1); });
    annotState.selectedMarquees = []; annotState.selectedMarquee = Math.min(_mqCtxIdx, annotState.marqueeBoxes.length - 1);
    _renderMarqueeOnOverlayCanvas(); annotState.dirty = true; syncMarqueeBoxesShadow(); _hideMarqueeContextMenu();
  });

  _mqCtxMenu.querySelector('#mq-ctx-dup').addEventListener('click', () => {
    const targets = getSelectedMarqueeIndexes().includes(_mqCtxIdx) ? getSelectedMarqueeIndexes() : [_mqCtxIdx];
    const newIdxs = [];
    targets.forEach(i => {
      const src = annotState.marqueeBoxes[i]; if (!src) return;
      const mqC = _mqCanvas;
      const copy = { ...JSON.parse(JSON.stringify(src)), x: Math.max(0, Math.min((mqC?.width || 9999) - src.w, src.x + 16)), y: Math.max(0, Math.min((mqC?.height || 9999) - src.h, src.y + 16)) };
      annotState.marqueeBoxes.push(copy); newIdxs.push(annotState.marqueeBoxes.length - 1);
    });
    annotState.selectedMarquees = newIdxs; annotState.selectedMarquee = newIdxs.length ? newIdxs[newIdxs.length - 1] : -1;
    _renderMarqueeOnOverlayCanvas(); annotState.dirty = true; syncMarqueeBoxesShadow(); _hideMarqueeContextMenu();
  });

  _mqCtxMenu.querySelector('#mq-ctx-rebind').addEventListener('click', async () => {
    const mqC = _mqCanvas || document.createElement('canvas');
    const ctx = mqC.getContext('2d');
    await rebindCurrentImageOverlayToMarquee(ctx, mqC);
    _hideMarqueeContextMenu();
  });

  _mqCtxMenu.querySelectorAll('.mq-ctx-color').forEach(btn => {
    btn.addEventListener('click', () => {
      const targets = getSelectedMarqueeIndexes().includes(_mqCtxIdx) ? getSelectedMarqueeIndexes() : [_mqCtxIdx];
      targets.forEach(i => { if (i >= 0 && i < annotState.marqueeBoxes.length) annotState.marqueeBoxes[i].color = btn.dataset.color; });
      _renderMarqueeOnOverlayCanvas(); annotState.dirty = true; syncMarqueeBoxesShadow(); _hideMarqueeContextMenu();
    });
  });

  _mqCtxMenu.querySelector('#mq-ctx-close-tool').addEventListener('click', () => { setAnnotTool('pen'); _hideMarqueeContextMenu(); });

  document.addEventListener('click', e => {
    if (!_mqCtxMenu || _mqCtxMenu.style.display === 'none') return;
    if (!_mqCtxMenu.contains(e.target)) _hideMarqueeContextMenu();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') _hideMarqueeContextMenu(); });

  const mqInp = _mqCtxMenu.querySelector('#mq-ctx-tag-inp');
  mqInp.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = mqInp.value.trim();
      if (val) {
        const targets = getSelectedMarqueeIndexes().includes(_mqCtxIdx) ? getSelectedMarqueeIndexes() : [_mqCtxIdx];
        targets.forEach(i => { const b = annotState.marqueeBoxes[i]; if (b) { b.tags = b.tags || []; if (!b.tags.includes(val)) b.tags.push(val); } });
        if (!state.allTags.includes(val)) state.allTags.push(val);
        annotState.dirty = true; syncMarqueeBoxesShadow();
        _renderMarqueeOnOverlayCanvas();
        if (typeof renderGalleryImageTags === 'function') renderGalleryImageTags();
        if (typeof renderGalleryTagCloud === 'function') renderGalleryTagCloud();
        if (typeof renderGalleryTagsTray === 'function') renderGalleryTagsTray();
        if (typeof renderTable === 'function') renderTable();
      }
      mqInp.value = ''; _hideMarqueeContextMenu();
    } else if (e.key === 'Escape') { mqInp.value = ''; _hideMarqueeContextMenu(); }
  });
  return _mqCtxMenu;
}

function _showMarqueeContextMenu(clientX, clientY, idx) {
  const menu = _ensureMarqueeContextMenu();
  _mqCtxIdx = idx;
  menu.style.display = 'block';
  const inp = menu.querySelector('#mq-ctx-tag-inp'); if (inp) inp.value = '';
  const vw = window.innerWidth, vh = window.innerHeight;
  const rect = menu.getBoundingClientRect();
  menu.style.left = Math.max(6, Math.min(clientX, vw - rect.width - 6)) + 'px';
  menu.style.top = Math.max(6, Math.min(clientY, vh - rect.height - 6)) + 'px';
}

// ─── K. Annotation lifecycle ──────────────────────────────────────────────────

function startAnnotation() {
  if (annotState.active) return; // prevent double-init
  const img = document.getElementById('gallery-img');
  const w = Math.round(img.clientWidth || img.naturalWidth || 0);
  const h = Math.round(img.clientHeight || img.naturalHeight || 0);
  if (w <= 0 || h <= 0) return;

  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  annotState.imageUrl = imgUrl || '';
  annotState.date = state.gallery.date || '';
  annotState.sourceRow = state.gallery.sourceRow;
  annotState.dirty = false;
  annotState.active = false; // will be set true after Fabric init

  // Load marquee boxes
  if (!state._marqueeBoxes) state._marqueeBoxes = {};
  const persistedBoxes = getMarqueeBoxesForImage(annotState.imageUrl, annotState.date, annotState.sourceRow);
  annotState.marqueeBoxes = persistedBoxes.length
    ? unpackMarqueeBoxes(persistedBoxes, w, h)
    : (Array.isArray(state._marqueeBoxes[annotState.imageUrl]) ? JSON.parse(JSON.stringify(state._marqueeBoxes[annotState.imageUrl])) : []);
  annotState.selectedMarquee = -1; annotState.selectedMarquees = []; annotState.multiSelectMode = false;
  annotState.marqueePreview = null; annotState.marqueeRasterBase = null; annotState.marqueeDragMode = '';
  annotState.marqueeDragOrig = null; annotState.marqueeSelectRect = null; annotState.marqueeDragGroupOrig = [];

  // Fix legacy absolute coords
  const hasLegacy = persistedBoxes.some(b => !(b && typeof b === 'object' && 'rx' in b));
  if (hasLegacy && annotState.imageUrl) {
    setMarqueeBoxesForImage(annotState.imageUrl, packMarqueeBoxes(annotState.marqueeBoxes, w, h), annotState.date, annotState.sourceRow);
    saveTrades();
  }

  // Position and show #annot-canvas, then initialize Fabric on it
  const plainCanvas = document.getElementById('annot-canvas');
  plainCanvas.style.margin = 'auto';
  plainCanvas.style.inset = '0';
  plainCanvas.style.width = w + 'px';
  plainCanvas.style.height = h + 'px';
  plainCanvas.style.display = 'block';
  plainCanvas.width = w;
  plainCanvas.height = h;

  // Initialize Fabric.js
  fabricCanvas = new fabric.Canvas('annot-canvas', {
    width: w, height: h,
    selection: false, isDrawingMode: false,
    enableRetinaScaling: false
  });

  // Fabric wraps #annot-canvas — position the wrapper correctly
  if (fabricCanvas.wrapperEl) {
    Object.assign(fabricCanvas.wrapperEl.style, {
      position: 'absolute',
      margin: 'auto',
      inset: '0',
      zIndex: '100'
    });
  }

  // The lower-canvas inherits .annot-canvas CSS which has will-change:transform and
  // a CSS transition. These create a separate GPU compositing layer that prevents
  // Fabric's 2D canvas drawing from being visible. Reset them inline.
  if (fabricCanvas.lowerCanvasEl) {
    fabricCanvas.lowerCanvasEl.style.willChange = 'auto';
    fabricCanvas.lowerCanvasEl.style.transition = 'none';
    fabricCanvas.lowerCanvasEl.style.transform = 'none';
  }
  // Ensure upper-canvas explicitly receives pointer events
  if (fabricCanvas.upperCanvasEl) {
    fabricCanvas.upperCanvasEl.style.pointerEvents = 'auto';
  }

  annotState.active = true;
  annotState.history = [];
  _initFabricHistory();
  _bindFabricShapeEvents();

  // Load existing overlay as Fabric background image
  const overlayUrl = state._localOverlays?.[imgUrl] || getOverlayUrlForImage(imgUrl, annotState.date);
  if (overlayUrl) {
    fabric.Image.fromURL(overlayUrl, ovImg => {
      if (!fabricCanvas) return; // annotation may have stopped before async loaded
      ovImg.set({
        left: 0, top: 0, selectable: false, evented: false,
        scaleX: w / ovImg.width, scaleY: h / ovImg.height,
        data: { isOverlayBase: true }
      });
      fabricCanvas.setBackgroundImage(ovImg, () => {
        if (!fabricCanvas) return;
        fabricCanvas.requestRenderAll();
        _pushFabricHistorySnapshot(); // snapshot with background
      }, { originX: 'left', originY: 'top' });
    }, { crossOrigin: 'anonymous' });
  }

  // Create MQ overlay canvas and bind events
  const mqC = _ensureMarqueeOverlayCanvas();
  if (mqC) {
    _bindMarqueeCanvasEvents(mqC);
    _renderMarqueeOnOverlayCanvas();
  }

  // Show correct toolbar
  if (annotState.tool === 'text') {
    document.getElementById('gv2-annot-bar')?.style.setProperty('display', 'none');
    document.getElementById('gv2-annotate-btn').classList.remove('active');
    document.getElementById('gv2-text-bar')?.style.setProperty('display', 'flex');
    document.getElementById('gv2-text-btn').classList.add('active');
  } else if (annotState.tool === 'marquee') {
    document.getElementById('gv2-annot-bar')?.style.setProperty('display', 'none');
    document.getElementById('gv2-text-bar')?.style.setProperty('display', 'none');
    document.getElementById('gv2-marquee-bar')?.style.setProperty('display', 'flex');
    document.getElementById('gv2-annotate-btn').classList.remove('active');
    document.getElementById('gv2-text-btn').classList.remove('active');
    document.getElementById('gv2-marquee-btn').classList.add('active');
  } else {
    document.getElementById('gv2-text-bar')?.style.setProperty('display', 'none');
    document.getElementById('gv2-text-btn').classList.remove('active');
    document.getElementById('gv2-annot-bar')?.style.setProperty('display', 'flex');
    document.getElementById('gv2-annotate-btn').classList.add('active');
    setAnnotTool(preferredTool);
  }

  updateMarqueeMultiSelectButton();
  document.getElementById('gallery-img').style.pointerEvents = 'none';
  _applyFabricToolMode(annotState.tool);
  applyZoom();

  const brushCursor = ensureAnnotBrushCursor();
  if (brushCursor) brushCursor.style.display = 'none'; // hidden until mouse enters
  updateAnnotBrushCursorVisual();
  const _wr = document.getElementById('gallery-img-wrapper');
  if (_wr) { _wr.addEventListener('mousemove', _brushCursorMove); _wr.addEventListener('mouseleave', _brushCursorLeave); }
}

function stopAnnotation() {
  const brushCursor = document.getElementById('annot-brush-cursor');
  if (brushCursor) brushCursor.style.display = 'none';
  const _wr = document.getElementById('gallery-img-wrapper');
  if (_wr) { _wr.removeEventListener('mousemove', _brushCursorMove); _wr.removeEventListener('mouseleave', _brushCursorLeave); }
  _hideMarqueeContextMenu();
  commitActiveCanvasTextEditor();

  if (fabricCanvas && annotState.imageUrl) {
    // Save pen-only raster BEFORE dispose
    _savePenOnlyRasterToState();

    // Build session for auto-save
    const session = _buildFabricSessionForAutoSave();
    autoSaveAnnotationSession(session);

    // Pack and save marquees
    const mqW = _mqCanvas?.width || fabricCanvas.width || 1;
    const mqH = _mqCanvas?.height || fabricCanvas.height || 1;
    const packed = packMarqueeBoxes(annotState.marqueeBoxes || [], mqW, mqH);
    setMarqueeBoxesForImage(annotState.imageUrl, packed, annotState.date, annotState.sourceRow);
    if (!state._marqueeBoxes) state._marqueeBoxes = {};
    state._marqueeBoxes[annotState.imageUrl] = JSON.parse(JSON.stringify(annotState.marqueeBoxes || []));
    if (session.dirty) saveTrades();
  }

  // Destroy Fabric canvas — restores original #annot-canvas element
  if (fabricCanvas) { fabricCanvas.dispose(); fabricCanvas = null; }
  _destroyMarqueeOverlayCanvas();

  // Hide toolbars and reset UI
  ['gv2-annot-bar', 'gv2-text-bar', 'gv2-marquee-bar'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  document.getElementById('gv2-annotate-btn').classList.remove('active');
  document.getElementById('gv2-text-btn').classList.remove('active');
  document.getElementById('gv2-marquee-btn').classList.remove('active');
  document.getElementById('gallery-img').style.pointerEvents = '';

  // Hide #annot-canvas (now restored as plain element)
  const plainCanvas = document.getElementById('annot-canvas');
  if (plainCanvas) plainCanvas.style.display = 'none';

  // Reset annotState
  annotState.active = false; annotState.textEditorActive = false;
  annotState.imageUrl = ''; annotState.date = ''; annotState.sourceRow = null;
  annotState.dirty = false; annotState.marqueeBoxes = []; annotState.selectedMarquee = -1;
  annotState.selectedMarquees = []; annotState.multiSelectMode = false; annotState.marqueePreview = null;
  annotState.marqueeRasterBase = null; annotState.marqueeDragMode = ''; annotState.marqueeDragOrig = null;
  annotState.marqueeSelectRect = null; annotState.marqueeDragGroupOrig = []; annotState.history = [];
  _fabricHistory = []; _fabricFuture = []; _historyLocked = false;
  _eraserActive = false; _isShapeDrawing = false; _activeShape = null;

  updateMarqueeMultiSelectButton();
  loadOverlayForCurrentImage();
}

function _savePenOnlyRasterToState() {
  if (!fabricCanvas || !annotState.imageUrl) return;
  if (!annotState.marqueeBoxes.length) return;
  try {
    const dataUrl = fabricCanvas.lowerCanvasEl.toDataURL('image/png');
    if (!state._penOnlyOverlays) state._penOnlyOverlays = {};
    state._penOnlyOverlays[annotState.imageUrl] = dataUrl;
  } catch (_e) { }
}

function _buildFabricSessionForAutoSave() {
  if (!fabricCanvas) return { canvas: document.createElement('canvas'), imageUrl: annotState.imageUrl, date: annotState.date, sourceRow: annotState.sourceRow, dirty: false };

  // Create off-screen canvas with same pixels as Fabric's lower canvas
  const offCanvas = document.createElement('canvas');
  offCanvas.width = fabricCanvas.width;
  offCanvas.height = fabricCanvas.height;
  const ctx = offCanvas.getContext('2d');
  ctx.drawImage(fabricCanvas.lowerCanvasEl, 0, 0);

  return {
    canvas: offCanvas,
    imageUrl: annotState.imageUrl,
    date: annotState.date,
    sourceRow: annotState.sourceRow,
    dirty: !!annotState.dirty
  };
}

// ─── L. Overlay export ────────────────────────────────────────────────────────

async function saveAnnotOverlay() {
  if (!fabricCanvas) { showToast('Not in annotation mode', 'error'); return; }
  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  if (!imgUrl) { showToast('No image selected', 'error'); return; }

  fabricCanvas.lowerCanvasEl.toBlob(async blob => {
    const fd = new FormData();
    fd.append('image', blob, 'overlay.png');
    try {
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.url) throw new Error();
      if (!setOverlayUrlForCurrentGalleryImage(data.url)) { showToast('Unable to map overlay', 'error'); return; }
      await saveTrades();
      annotState.dirty = false;
      stopAnnotation();
      showToast('Overlay saved!', 'success');
    } catch (e) { showToast('Overlay save failed', 'error'); }
  }, 'image/png');
}

async function saveAnnotMerge() {
  if (!fabricCanvas) { showToast('Not in annotation mode', 'error'); return; }
  const img = document.getElementById('gallery-img');
  const trade = getOwnerTradeForGalleryImage();
  const out = document.createElement('canvas');
  out.width = img.naturalWidth; out.height = img.naturalHeight;
  const ctx = out.getContext('2d');
  ctx.drawImage(img, 0, 0, out.width, out.height);
  ctx.drawImage(fabricCanvas.lowerCanvasEl, 0, 0, out.width, out.height);

  out.toBlob(async blob => {
    const fd = new FormData();
    fd.append('image', blob, 'merged.png');
    try {
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.url) throw new Error();
      const imgs = state.gallery.images;
      imgs.push(data.url);
      if (trade) { if (!Array.isArray(trade.images)) trade.images = []; if (trade.images !== imgs) trade.images.push(data.url); }
      state.gallery.currentIndex = imgs.length - 1;
      await saveTrades();
      renderGallery();
      annotState.dirty = false;
      stopAnnotation();
      showToast('Merged image added to gallery!', 'success');
    } catch (e) { showToast('Merge save failed', 'error'); }
  }, 'image/png');
}

// ─── M. Init ─────────────────────────────────────────────────────────────────

function bindAnnotationCanvas() {
  // Ensure marquee context menu is created
  _ensureMarqueeContextMenu();

  // Main toolbar button listeners
  document.getElementById('gv2-annotate-btn').addEventListener('click', toggleAnnotation);
  const mqTopBtn = document.getElementById('gv2-marquee-btn');
  if (mqTopBtn) mqTopBtn.addEventListener('click', toggleMarquee);
  const textTopBtn = document.getElementById('gv2-text-btn');
  if (textTopBtn) textTopBtn.addEventListener('click', () => {
    if (annotState.active && annotState.tool === 'text') { toggleAnnotation(); return; }
    if (!annotState.active) { annotState.tool = 'text'; startAnnotation(); }
    else { setAnnotTool('text'); }
    document.getElementById('gv2-annot-bar')?.style.setProperty('display', 'none');
    document.getElementById('gv2-text-bar')?.style.setProperty('display', 'flex');
    document.getElementById('gv2-text-btn').classList.add('active');
    document.getElementById('gv2-annotate-btn').classList.remove('active');
    document.getElementById('gv2-marquee-btn').classList.remove('active');
  });

  // Annot bar tool buttons (arrow/rect/circle ab grouped button mein hain)
  ['pen', 'highlight', 'eraser', 'select'].forEach(tool => {
    const btn = document.getElementById('annot-' + tool);
    if (btn) btn.addEventListener('click', () => {
      preferredTool = tool;
      setAnnotTool(tool);
    });
  });

  // Shape group button: click = current shape use karo, right-click = picker kholo
  const shapeBtn = document.getElementById('annot-shape');
  const shapeMenu = document.getElementById('annot-shape-menu');
  if (shapeBtn && shapeMenu) {
    shapeBtn.addEventListener('click', () => {
      const tool = shapeBtn.dataset.shape || 'rect';
      preferredTool = tool;
      setAnnotTool(tool);
    });
    shapeBtn.addEventListener('contextmenu', e => {
      e.preventDefault();
      shapeMenu.classList.toggle('open');
    });
    shapeMenu.querySelectorAll('.annot-shape-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        const tool = opt.dataset.tool;
        preferredTool = tool;
        setAnnotTool(tool);
        shapeMenu.classList.remove('open');
      });
    });
    // Menu bahar click karne pe band karo
    document.addEventListener('click', e => {
      if (!shapeBtn.contains(e.target) && !shapeMenu.contains(e.target)) {
        shapeMenu.classList.remove('open');
      }
    });
  }

  // V (group select) button
  const vBtn = document.getElementById('annot-vselect');
  if (vBtn) vBtn.addEventListener('click', () => toggleMarqueeGroupSelect());

  // Color input
  document.getElementById('annot-color').addEventListener('input', e => {
    annotState.color = e.target.value;
    if (fabricCanvas && fabricCanvas.isDrawingMode && fabricCanvas.freeDrawingBrush) {
      if (annotState.tool === 'pen') fabricCanvas.freeDrawingBrush.color = e.target.value;
      else if (annotState.tool === 'highlight') fabricCanvas.freeDrawingBrush.color = e.target.value + '55';
    }
  });

  // Size slider
  document.getElementById('annot-size').addEventListener('input', e => {
    annotState.size = parseInt(e.target.value);
    document.getElementById('annot-size-label').textContent = e.target.value + 'px';
    updateAnnotBrushCursorVisual();
    if (fabricCanvas && fabricCanvas.isDrawingMode && fabricCanvas.freeDrawingBrush) {
      if (annotState.tool === 'pen') fabricCanvas.freeDrawingBrush.width = annotState.size;
      else if (annotState.tool === 'highlight') fabricCanvas.freeDrawingBrush.width = annotState.size * 5;
      else if (annotState.tool === 'eraser') fabricCanvas.freeDrawingBrush.width = annotState.size * 4;
    }
  });

  // Undo / Redo buttons
  document.getElementById('annot-undo').addEventListener('click', fabricUndo);
  const redoBtn = document.getElementById('annot-redo');
  if (redoBtn) redoBtn.addEventListener('click', fabricRedo);

  // Clear button
  document.getElementById('annot-clear').addEventListener('click', () => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    annotState.marqueeBoxes = []; annotState.selectedMarquee = -1; annotState.selectedMarquees = [];
    if (!state._marqueeBoxes) state._marqueeBoxes = {};
    state._marqueeBoxes[annotState.imageUrl] = [];
    if (state._penOnlyOverlays) delete state._penOnlyOverlays[annotState.imageUrl];
    _renderMarqueeOnOverlayCanvas();
    _pushFabricHistorySnapshot();
    annotState.dirty = true;
  });

  // Save buttons
  document.getElementById('annot-save-overlay').addEventListener('click', saveAnnotOverlay);
  document.getElementById('annot-save-merge').addEventListener('click', saveAnnotMerge);

  // Marquee bar
  const mqInp = document.getElementById('gv2-mq-tag-input');
  const mqAdd = document.getElementById('gv2-mq-add');
  const mqRebind = document.getElementById('gv2-mq-rebind');
  const mqDel = document.getElementById('gv2-mq-del');
  const addTagFromInput = () => {
    const tag = String(mqInp?.value || '').trim();
    if (!addTagToSelectedMarqueeBox(tag)) return;
    if (mqInp) mqInp.value = '';
    renderGalleryTagsTray();
  };
  if (mqAdd) mqAdd.addEventListener('click', addTagFromInput);
  if (mqInp) mqInp.addEventListener('keydown', e => { if (e.key === 'Enter') addTagFromInput(); });
  if (mqRebind) mqRebind.addEventListener('click', async () => {
    const mqC = _mqCanvas || document.createElement('canvas');
    await rebindCurrentImageOverlayToMarquee(mqC.getContext('2d'), mqC);
  });
  if (mqDel) mqDel.addEventListener('click', () => { if (annotState.active) toggleMarquee(); });

  // Text bar
  const tbBold = document.getElementById('gv2-tb-bold');
  if (tbBold) tbBold.addEventListener('click', () => tbBold.classList.toggle('active'));
  const tbItalic = document.getElementById('gv2-tb-italic');
  if (tbItalic) tbItalic.addEventListener('click', () => tbItalic.classList.toggle('active'));
  const tbAlign = document.getElementById('gv2-tb-align');
  if (tbAlign) {
    tbAlign.addEventListener('click', () => {
      if (tbAlign.classList.contains('align-center')) {
        tbAlign.classList.remove('align-center'); tbAlign.classList.add('align-right'); tbAlign.innerHTML = '&#8649;';
      } else if (tbAlign.classList.contains('align-right')) {
        tbAlign.classList.remove('align-right'); tbAlign.innerHTML = '&#8801;';
      } else {
        tbAlign.classList.add('align-center'); tbAlign.innerHTML = '&#8644;';
      }
    });
  }

  // Delete key for selected Fabric objects
  document.addEventListener('keydown', e => {
    if (!annotState.active || !fabricCanvas) return;
    if (!document.getElementById('gallery-modal')?.classList.contains('open')) return;
    if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); fabricUndo(); return; }
    if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); fabricRedo(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const obj = fabricCanvas.getActiveObject();
      if (obj && !obj.data?.isOverlayBase && !obj.data?.isBaked) {
        e.preventDefault();
        fabricCanvas.remove(obj);
        fabricCanvas.discardActiveObject();
        fabricCanvas.requestRenderAll();
        _pushFabricHistorySnapshot();
        annotState.dirty = true;
      }
    }
  });

  updateAnnotToolIcons();
}
