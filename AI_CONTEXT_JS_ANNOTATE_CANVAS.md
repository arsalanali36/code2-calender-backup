# JS — Annotation Canvas
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `static\js\annotate-canvas.js`
```js
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
