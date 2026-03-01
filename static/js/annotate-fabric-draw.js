// ─── annotate-fabric-draw.js ─────────────────────────────────────────────────
// H. Fabric shape / text drawing handlers + eraser.
// ─────────────────────────────────────────────────────────────────────────────

let _shapeStartPoint = null, _activeShape = null, _isShapeDrawing = false;

function _bindFabricShapeEvents() {
  if (!fabricCanvas) return;

  fabricCanvas.on('mouse:down', e => {
    if (!annotState.active) return;
    const tool = annotState.tool;
    const pointer = fabricCanvas.getPointer(e.e);

    if (_eraserActive && tool === 'eraser') {
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

    const brushEl = document.getElementById('annot-brush-cursor');
    if (brushEl && shouldUseBrushCursor()) {
      const wr = document.getElementById('gallery-img-wrapper').getBoundingClientRect();
      const src = e.e.touches ? e.e.touches[0] : e.e;
      brushEl.style.left = (src.clientX - wr.left) + 'px';
      brushEl.style.top = (src.clientY - wr.top) + 'px';
      brushEl.style.display = 'block';
    }

    if (_eraserActive && tool === 'eraser' && e.e.buttons === 1 && _eraserLastPos) {
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

  fabricCanvas.on('path:created', () => { annotState.dirty = true; _pushFabricHistorySnapshot(); });
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
