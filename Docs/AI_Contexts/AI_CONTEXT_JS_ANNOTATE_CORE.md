# JS - Annotation Core (canvas, zoom, fabric)
Consolidated code context for AI assistants.


## File: `static/js/annotate-canvas.js`
```js
/**
 * @fileoverview annotate-canvas.js
 * @description Fabric.js history (undo/redo), shape/text/arrow event bindings, raster baking.
 * @exports fabricUndo, fabricRedo, _bindFabricShapeEvents, _addArrowGroup, _createFabricIText,
 *          _bakeRasterToBackground, _ensureMarqueeOverlayCanvas, _destroyMarqueeOverlayCanvas,
 *          _renderMarqueeOnOverlayCanvas, _bindMarqueeCanvasEvents
 * @reads fabricCanvas, annotState.{tool,active}
 * @writes fabricCanvas objects (add/remove), annotState.dirty
 * @calls _pushFabricHistorySnapshot, updateAnnotBrushCursorVisual, _renderMarqueeOnOverlayCanvas
 */

// annot-canvas.js — Fabric history, shape/text events, marquee overlay canvas.

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

  const wrapperEl = fabricCanvas.wrapperEl;
  if (wrapperEl && !wrapperEl._hasContextMenuBound) {
    wrapperEl.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (!annotState.active) return;
      if (annotState.tool === 'select' || annotState.tool === 'text') {
        const pointer = fabricCanvas.getPointer(e);
        const hitObj = fabricCanvas.findTarget(e, false);
        if (hitObj && !hitObj.data?.isOverlayBase && !hitObj.data?.isBaked) {
          fabricCanvas.remove(hitObj);
          fabricCanvas.discardActiveObject();
          fabricCanvas.requestRenderAll();
          _pushFabricHistorySnapshot();
          annotState.dirty = true;
        }
      }
    });
    wrapperEl._hasContextMenuBound = true;
  }

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

  fabricCanvas.on('mouse:dblclick', (e) => {
    if (!annotState.active) return;
    const tool = annotState.tool;
    if (tool === 'text') {
      if (e.target && e.target.type === 'i-text') return; // let Fabric handled dbclick edit mode natively
      const pointer = fabricCanvas.getPointer(e.e);
      _createFabricIText(pointer);
    }
  });
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
  const color = document.getElementById('gv2-tb-color')?.value || '#000000';
  const size = parseInt(document.getElementById('gv2-tb-size')?.value || '24', 10);
  const font = document.getElementById('gv2-tb-font')?.value || 'Arial';
  const bold = document.getElementById('gv2-tb-bold')?.classList.contains('active') ? 'bold' : 'normal';
  const italic = document.getElementById('gv2-tb-italic')?.classList.contains('active') ? 'italic' : 'normal';
  const alignBtn = document.getElementById('gv2-tb-align');
  let align = 'left';
  if (alignBtn?.classList.contains('align-center')) align = 'center';
  else if (alignBtn?.classList.contains('align-right')) align = 'right';

  let startText = '';
  if (annotState.listType === 'bullet') startText = '- ';
  else if (annotState.listType === 'number') startText = '1. ';

  const itext = new fabric.IText(startText, {
    left: pointer.x, top: pointer.y,
    fill: color, fontSize: size, fontFamily: font,
    fontWeight: bold, fontStyle: italic, textAlign: align,
    backgroundColor: 'transparent',
    editable: true, selectable: true,
    data: { isText: true, listType: annotState.listType || 'none', listCounter: 1 }
  });

  itext.on('editing:entered', () => {
    itext.hiddenTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        itext.exitEditing();
        fabricCanvas.discardActiveObject();
        fabricCanvas.requestRenderAll();
        return;
      }
      // Simple list handling check
      if (e.key === 'Enter') {
        const textStr = itext.text || '';
        const cursorIdx = itext.selectionStart !== null ? itext.selectionStart : textStr.length;
        const textBeforeCursor = textStr.substring(0, cursorIdx);
        const lines = textBeforeCursor.split('\n');
        const curLine = lines[lines.length - 1];

        const bulletRegex = /^(\s*)-\s?/;
        const numberRegex = /^(\s*)(\d+)\.\s?/;

        if (bulletRegex.test(curLine)) {
          if (curLine.replace(bulletRegex, '').trim() === '') {
            e.preventDefault();
            itext.removeChars(cursorIdx - curLine.length, cursorIdx);
          } else {
            e.preventDefault();
            const match = curLine.match(bulletRegex);
            itext.insertChars(`\n${match[1]}- `);
          }
        } else if (numberRegex.test(curLine)) {
          if (curLine.replace(numberRegex, '').trim() === '') {
            e.preventDefault();
            itext.removeChars(cursorIdx - curLine.length, cursorIdx);
          } else {
            e.preventDefault();
            const match = curLine.match(numberRegex);
            const nextNum = parseInt(match[2], 10) + 1;
            itext.insertChars(`\n${match[1]}${nextNum}. `);
          }
        }
      }
    });
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
  const dataUrl = fabricCanvas.toDataURL({ format: 'png', multiplier: 1 / (fabric.devicePixelRatio || 1) });
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

```

## File: `static/js/annotate-zoom.js`
```js
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

  const pdfCanvas = document.getElementById('pdf-main-canvas');
  if (pdfCanvas) {
    pdfCanvas.style.transform = tf;
    pdfCanvas.style.transformOrigin = 'top left';
  }

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
      t.id === 'gallery-img' || t.id === 'annot-canvas' || t.id === 'pdf-main-canvas' ||
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


```

## File: `static/js/annotate-fabric.js`
```js
/**
 * @fileoverview annotate-fabric.js
 * @description Export Fabric canvas to PNG overlay; merge annotation onto base image; canvas bind helper.
 * @exports saveAnnotOverlay, saveAnnotMerge, bindAnnotationCanvas
 * @reads fabricCanvas, annotState.imageUrl, state.gallery
 * @writes state._localOverlays, trade.overlays via setOverlayUrlForCurrentGalleryImage
 * @calls saveTrades, stopAnnotation, fetch /api/upload-image, fetch /api/overlay
 */

// annotate-fabric.js — saveAnnotOverlay, saveAnnotMerge, bindAnnotationCanvas

// ─── L. Overlay export ────────────────────────────────────────────────────────

async function saveAnnotOverlay() {
  if (!fabricCanvas) { showToast('Not in annotation mode', 'error'); return; }
  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  if (!imgUrl) { showToast('No image selected', 'error'); return; }

  const origVpt = fabricCanvas.viewportTransform.slice();
  fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

  fabricCanvas.lowerCanvasEl.toBlob(async blob => {
    fabricCanvas.setViewportTransform(origVpt);
    try {
      const data = await imageService.uploadImage(new File([blob], 'overlay.png', { type: 'image/png' }));
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

  const origVpt = fabricCanvas.viewportTransform.slice();
  fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

  ctx.drawImage(img, 0, 0, out.width, out.height);
  ctx.drawImage(fabricCanvas.lowerCanvasEl, 0, 0, fabricCanvas.width, fabricCanvas.height, 0, 0, out.width, out.height);

  fabricCanvas.setViewportTransform(origVpt);

  out.toBlob(async blob => {
    try {
      const data = await imageService.uploadImage(new File([blob], 'merged.png', { type: 'image/png' }));
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
  const updateActiveTextProps = (props) => {
    if (fabricCanvas) {
      const obj = fabricCanvas.getActiveObject();
      if (obj && obj.type === 'i-text') {
        if (obj.isEditing && obj.selectionStart !== obj.selectionEnd) {
          obj.setSelectionStyles(props);
        } else {
          obj.set(props);
        }
        fabricCanvas.requestRenderAll();
        _pushFabricHistorySnapshot();
        annotState.dirty = true;
      }
    }
  };

  const tbBold = document.getElementById('gv2-tb-bold');
  if (tbBold) tbBold.addEventListener('click', () => {
    tbBold.classList.toggle('active');
    updateActiveTextProps({ fontWeight: tbBold.classList.contains('active') ? 'bold' : 'normal' });
  });
  const tbItalic = document.getElementById('gv2-tb-italic');
  if (tbItalic) tbItalic.addEventListener('click', () => {
    tbItalic.classList.toggle('active');
    updateActiveTextProps({ fontStyle: tbItalic.classList.contains('active') ? 'italic' : 'normal' });
  });
  const tbAlign = document.getElementById('gv2-tb-align');
  if (tbAlign) {
    tbAlign.addEventListener('click', () => {
      let alignMode = 'left';
      if (tbAlign.classList.contains('align-center')) {
        tbAlign.classList.remove('align-center'); tbAlign.classList.add('align-right'); tbAlign.innerHTML = '&#8649;';
        alignMode = 'right';
      } else if (tbAlign.classList.contains('align-right')) {
        tbAlign.classList.remove('align-right'); tbAlign.innerHTML = '&#8801;';
        alignMode = 'left';
      } else {
        tbAlign.classList.add('align-center'); tbAlign.innerHTML = '&#8644;';
        alignMode = 'center';
      }
      updateActiveTextProps({ textAlign: alignMode });
    });
  }

  const tbSize = document.getElementById('gv2-tb-size');
  if (tbSize) {
    tbSize.addEventListener('change', () => updateActiveTextProps({ fontSize: parseInt(tbSize.value, 10) || 24 }));
    tbSize.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const val = parseInt(tbSize.value, 10) || 24;
      const nextVal = e.deltaY < 0 ? val + 1 : Math.max(1, val - 1);
      tbSize.value = nextVal;
      updateActiveTextProps({ fontSize: nextVal });
    }, { passive: false });
  }

  const tbList = document.getElementById('gv2-tb-list');
  if (tbList) {
    tbList.addEventListener('click', () => {
      const obj = fabricCanvas?.getActiveObject();
      if (obj && obj.type === 'i-text') {
        const textStr = obj.text || '';
        const lines = textStr.split('\n');
        let startLineIdx = 0;
        let endLineIdx = lines.length - 1;

        if (obj.isEditing) {
          const s = Math.min(obj.selectionStart || 0, obj.selectionEnd || 0);
          const e = Math.max(obj.selectionStart || 0, obj.selectionEnd || 0);
          startLineIdx = textStr.substring(0, s).split('\n').length - 1;
          endLineIdx = textStr.substring(0, e).split('\n').length - 1;
        }

        let hasBullet = true, hasNumber = true;
        for (let i = startLineIdx; i <= endLineIdx; i++) {
          if (!lines[i].startsWith('- ')) hasBullet = false;
          if (!lines[i].match(/^\d+\.\s/)) hasNumber = false;
        }

        let mode = 'bullet';
        if (hasBullet) mode = 'number';
        else if (hasNumber) mode = 'none';

        for (let i = startLineIdx; i <= endLineIdx; i++) {
          lines[i] = lines[i].replace(/^- /, '').replace(/^\d+\.\s/, '');
          if (mode === 'bullet') lines[i] = '- ' + lines[i];
          else if (mode === 'number') lines[i] = (i - startLineIdx + 1) + '. ' + lines[i];
        }

        obj.set({ text: lines.join('\n') });
        fabricCanvas.requestRenderAll();
        _pushFabricHistorySnapshot();
        annotState.dirty = true;
      } else {
        const curType = annotState.listType || 'none';
        annotState.listType = curType === 'none' ? 'bullet' : curType === 'bullet' ? 'number' : 'none';
        tbList.style.color = annotState.listType === 'none' ? '' : 'var(--blue)';
      }
    });
  }

  const tbColor = document.getElementById('gv2-tb-color');
  if (tbColor) {
    tbColor.value = '#000000'; // Default text color to black
    tbColor.addEventListener('input', () => updateActiveTextProps({ fill: tbColor.value }));
  }

  const tbFont = document.getElementById('gv2-tb-font');
  if (tbFont) tbFont.addEventListener('change', () => updateActiveTextProps({ fontFamily: tbFont.value }));

  // Delete key for selected Fabric objects
  document.addEventListener('keydown', e => {
    if (!annotState.active || !fabricCanvas) return;
    if (e.key === 'Escape') {
      const obj = fabricCanvas.getActiveObject();
      if (obj) {
        if (obj.type === 'i-text' && obj.isEditing) {
          obj.exitEditing();
        }
        fabricCanvas.discardActiveObject();
        fabricCanvas.requestRenderAll();
        return;
      }
      stopAnnotation();
      return;
    }
    if (!document.getElementById('gallery-modal')?.classList.contains('open')) return;
    if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); fabricUndo(); return; }
    if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); fabricRedo(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const obj = fabricCanvas.getActiveObject();
      if (obj && !obj.data?.isOverlayBase && !obj.data?.isBaked) {
        if (obj.type === 'i-text' && obj.isEditing) return; // Allow normal type/delete
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

```
