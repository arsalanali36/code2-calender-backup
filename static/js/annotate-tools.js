/**
 * @fileoverview annotate-tools.js
 * @description Tool toggles (pen/highlighter/eraser/text/arrow/shape/marquee), cursor, size adjust.
 * @exports toggleAnnotation, toggleMarquee, setAnnotTool, adjustAnnotSize,
 *          updateAnnotToolIcons, commitActiveCanvasTextEditor,
 *          toggleMarqueeGroupSelect, updateMarqueeMultiSelectButton
 * @reads annotState.{tool,active,marqueeMode}, fabricCanvas
 * @writes annotState.tool, annotState.marqueeMode
 * @calls startAnnotation, stopAnnotation, _applyFabricToolMode, _setCursor
 */

// annot-tools.js — Tool toggles, setAnnotTool, _applyFabricToolMode, _setCursor.

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
    bindAnnotBarDrag();
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
      fabricCanvas.selection = false;
      // Allow selecting existing text
      fabricCanvas.getObjects().forEach(obj => {
        if (obj.type === 'i-text') {
          obj.selectable = true;
          obj.evented = true;
        } else if (!obj.data?.isOverlayBase && !obj.data?.isBaked) {
          obj.selectable = true;
          obj.evented = true;
          obj.hoverCursor = 'move';
        }
      });
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

// ── Annotation bar drag (GPU-accelerated translate3d) ───────────────────────
function bindAnnotBarDrag() {
  const bar = document.getElementById('gv2-annot-bar');
  if (!bar || bar._dragBound) return;
  bar._dragBound = true;

  const LS_KEY = 'tj_annotBarPos';
  let dragging = false, startX, startY, curTx = 0, curTy = 0;
  let _touchPending = false, _touchStartX = 0, _touchStartY = 0, _touchId = null;
  const THRESHOLD = 6;

  // Restore saved position
  const saved = (() => { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; } })();
  if (saved) {
    curTx = saved.tx || 0; curTy = saved.ty || 0;
    // Combine with existing translateY(-50%)
    bar.style.transform = `translateY(-50%) translate3d(${curTx}px,${curTy}px,0)`;
  }

  const _apply = () => {
    bar.style.transform = `translateY(-50%) translate3d(${curTx}px,${curTy}px,0)`;
  };

  const _startDrag = (cx, cy) => {
    dragging = true; startX = cx; startY = cy;
    bar.style.willChange = 'transform';
    document.body.style.userSelect = 'none';
  };

  const _doDrag = (cx, cy) => {
    if (!dragging) return;
    curTx += cx - startX; curTy += cy - startY;
    startX = cx; startY = cy;
    _apply();
  };

  const _endDrag = () => {
    if (!dragging) return;
    dragging = false;
    bar.style.willChange = '';
    document.body.style.userSelect = '';
    localStorage.setItem(LS_KEY, JSON.stringify({ tx: curTx, ty: curTy }));
  };

  // Mouse (desktop)
  bar.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest('button, input, select')) return;
    e.preventDefault(); _startDrag(e.clientX, e.clientY);
  });
  document.addEventListener('mousemove', e => _doDrag(e.clientX, e.clientY));
  document.addEventListener('mouseup', _endDrag);

  // Touch (iPad) — capture phase + threshold
  document.addEventListener('touchstart', e => {
    if (!bar.contains(e.target)) return;
    const t = e.touches[0];
    _touchId = t.identifier; _touchPending = true;
    _touchStartX = t.clientX; _touchStartY = t.clientY;
  }, { passive: true, capture: true });

  document.addEventListener('touchmove', e => {
    if (!_touchPending && !dragging) return;
    let t = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === _touchId) { t = e.touches[i]; break; }
    }
    if (!t) return;
    if (_touchPending) {
      const dx = Math.abs(t.clientX - _touchStartX);
      const dy = Math.abs(t.clientY - _touchStartY);
      if (dx > THRESHOLD || dy > THRESHOLD) {
        _touchPending = false;
        _startDrag(t.clientX, t.clientY);
      } else return;
    }
    if (e.cancelable) e.preventDefault();
    _doDrag(t.clientX, t.clientY);
  }, { passive: false });

  document.addEventListener('touchend', () => { _touchPending = false; _touchId = null; _endDrag(); });
}

