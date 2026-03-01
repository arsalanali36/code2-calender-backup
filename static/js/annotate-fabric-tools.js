// ─── annotate-fabric-tools.js ────────────────────────────────────────────────
// E. Tool state (toggle, set, update UI)
// F. Fabric tool mode application
// G. Fabric undo/redo history
// ─────────────────────────────────────────────────────────────────────────────

let _fabricHistory = [], _fabricFuture = [], _historyLocked = false;
let _eraserActive = false, _eraserLastPos = null;

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
  annotState.tool = tool;
  if (tool !== 'marquee') {
    annotState.multiSelectMode = false; annotState.selectedMarquees = []; annotState.marqueeSelectRect = null;
  }
  document.querySelectorAll('.annot-tool').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('annot-' + tool);
  if (btn) btn.classList.add('active');
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
  if (fabricCanvas && fabricCanvas.isDrawingMode && fabricCanvas.freeDrawingBrush) {
    if (annotState.tool === 'pen') fabricCanvas.freeDrawingBrush.width = next;
    else if (annotState.tool === 'highlight') fabricCanvas.freeDrawingBrush.width = next * 5;
    else if (annotState.tool === 'eraser') fabricCanvas.freeDrawingBrush.width = next * 4;
  }
}

function commitActiveCanvasTextEditor() {
  if (fabricCanvas) {
    const obj = fabricCanvas.getActiveObject();
    if (obj && obj.type === 'i-text' && obj.isEditing) obj.exitEditing();
    fabricCanvas.discardActiveObject();
    fabricCanvas.requestRenderAll();
  }
  const editor = document.querySelector('#gallery-img-wrapper .canvas-text-editor');
  if (editor) editor.blur();
}

// ─── F. Fabric tool mode ──────────────────────────────────────────────────────

function _applyFabricToolMode(tool) {
  if (!fabricCanvas) return;
  _eraserActive = false;
  _isShapeDrawing = false;
  _activeShape = null;

  fabricCanvas.isDrawingMode = false;
  fabricCanvas.selection = false;
  fabricCanvas.discardActiveObject();

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
      _setCursor('crosshair', true);
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
