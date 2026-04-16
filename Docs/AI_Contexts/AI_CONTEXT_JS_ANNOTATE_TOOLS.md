# JS - Annotation Tools (marquee, tools, ctx-menu, lifecycle)
Consolidated code context for AI assistants.


## File: `static/js/annotate-marquee.js`
```js
/**
 * @fileoverview annotate-marquee.js
 * @description Draws marquee selection boxes on overlay canvas; hit testing; tag assignment.
 * @exports drawMarqueeBox, hitTestMarquee, hitTestMarqueeResizeHandle, hitTestMarqueeDeleteHandle,
 *          getSelectedMarqueeIndexes, getSelectedMarqueeTagSet, isMarqueeSelectionActive,
 *          syncMarqueeBoxesShadow, toggleTagOnSelectedMarquees, setSingleMarqueeSelection,
 *          renderMarqueeScene, rebindCurrentImageOverlayToMarquee,
 *          refreshMarqueeTagSuggestions, addTagToSelectedMarqueeBox, refreshGalleryTagsTrayIfVisible
 * @reads annotState.marqueeBoxes, annotState.imageUrl, state.gallery, state.tagGroups
 * @writes annotState.marqueeBoxes (add/resize/move/delete), trade.marqueeBoxes via setMarqueeBoxesForImage
 * @calls renderGalleryTagCloud, renderGalleryTagsTray, saveTrades
 */

// annot-marquee.js — Marquee box draw, hit-test, selection, tag helpers.

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
    fabricCanvas.clear();
    fabricCanvas.setBackgroundImage(null, () => { });
    const jsonData = state._fabricObjectsConfig?.[annotState.imageUrl];
    if (jsonData) {
      fabricCanvas.loadFromJSON(jsonData, () => {
        fabricCanvas.requestRenderAll();
      }, (o, obj) => { if (o.data) obj.data = o.data; });
    } else if (penOnlyUrl) {
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


```

## File: `static/js/annotate-tools.js`
```js
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


```

## File: `static/js/annotate-ctx-menu.js`
```js
/**
 * @fileoverview annotate-ctx-menu.js
 * @description Right-click context menu for marquee boxes (rename tag, delete box, tag ops).
 * @exports _ensureMarqueeContextMenu, _showMarqueeContextMenu, _hideMarqueeContextMenu
 * @reads annotState.marqueeBoxes, state.tagGroups
 * @calls toggleTagOnSelectedMarquees, saveTrades, renderGallery
 */

// annotate-ctx-menu.js — Marquee context menu

// annotate-fabric.js (core) — Marquee context menu, startAnnotation,
//   stopAnnotation, _savePenOnlyRasterToState, _buildFabricSessionForAutoSave,
//   bindAnnotationCanvas. Depends on the 4 preceding annotate-*.js files.


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

```

## File: `static/js/annotate-lifecycle.js`
```js
/**
 * @fileoverview annotate-lifecycle.js
 * @description Start/stop annotation sessions; Fabric.js canvas init + teardown; auto-save raster.
 * @exports startAnnotation, stopAnnotation, _buildFabricSessionForAutoSave
 * @reads annotState.imageUrl, annotState.tool, state.gallery, state._localOverlays
 * @writes annotState.{active,tool,dirty,imageUrl}, fabricCanvas (init via new fabric.Canvas())
 * @calls bindAnnotationCanvas, bindZoomPan, renderGallery, autoSaveAnnotationSession
 */

// annotate-lifecycle.js — startAnnotation, stopAnnotation, save helpers

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
  const dpr = window.devicePixelRatio || 1;
  fabricCanvas = new fabric.Canvas('annot-canvas', {
    width: w, height: h,
    selection: false, isDrawingMode: false,
    enableRetinaScaling: true
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

  // 1. Try to load native Fabric JSON for fully editable vectors
  let jsonData = state._fabricObjectsConfig?.[imgUrl];
  if (!jsonData) {
    const trade = getOwnerTradeForGalleryImage();
    if (trade && trade.fabricData && trade.fabricData[imgUrl]) {
      jsonData = trade.fabricData[imgUrl];
    } else if (annotState.date && state.dayData[annotState.date]?.fabricData?.[imgUrl]) {
      jsonData = state.dayData[annotState.date].fabricData[imgUrl];
    }
  }

  if (jsonData) {
    fabricCanvas.loadFromJSON(jsonData, () => {
      if (!fabricCanvas) return;
      fabricCanvas.requestRenderAll();
      _pushFabricHistorySnapshot();
    }, (o, obj) => { if (o.data) obj.data = o.data; });
  } else {
    // 2. Legacy fallback to raster overlay
    const overlayUrl = state._localOverlays?.[imgUrl] || getOverlayUrlForImage(imgUrl, annotState.date);
    if (overlayUrl) {
      fabric.Image.fromURL(resolveImageUrl(overlayUrl), ovImg => {
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
    // Reset viewport transform so the generated raster isn't offset/zoomed
    const origVpt = fabricCanvas.viewportTransform.slice();
    fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

    // Save pen-only raster PRE-dispose
    _savePenOnlyRasterToState();

    // Build session for auto-save (this creates the PNG that gets uploaded)
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

    // Restore just in case, though we dispose immediately after
    fabricCanvas.setViewportTransform(origVpt);
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
  try {
    const dataUrl = fabricCanvas.toDataURL({ format: 'png', multiplier: 1 / (fabric.devicePixelRatio || 1) });
    if (!state._penOnlyOverlays) state._penOnlyOverlays = {};
    state._penOnlyOverlays[annotState.imageUrl] = dataUrl;

    const fabricJson = fabricCanvas.toJSON(['data', 'selectable', 'evented', 'listType', 'listCounter', 'hoverCursor']);
    if (!state._fabricObjectsConfig) state._fabricObjectsConfig = {};
    state._fabricObjectsConfig[annotState.imageUrl] = fabricJson;

    // Persist JSON to trades store for editability later
    const trade = getOwnerTradeForGalleryImage();
    if (trade) {
      if (!trade.fabricData) trade.fabricData = {};
      trade.fabricData[annotState.imageUrl] = fabricJson;
    } else {
      if (annotState.date && state.dayData[annotState.date]) {
        if (!state.dayData[annotState.date].fabricData) state.dayData[annotState.date].fabricData = {};
        state.dayData[annotState.date].fabricData[annotState.imageUrl] = fabricJson;
      }
    }
  } catch (_e) { }
}

function _buildFabricSessionForAutoSave() {
  if (!fabricCanvas) return { canvas: document.createElement('canvas'), imageUrl: annotState.imageUrl, date: annotState.date, sourceRow: annotState.sourceRow, dirty: false };

  // Create off-screen canvas with logical pixels
  const offCanvas = document.createElement('canvas');
  offCanvas.width = fabricCanvas.width;
  offCanvas.height = fabricCanvas.height;
  const ctx = offCanvas.getContext('2d');
  ctx.drawImage(fabricCanvas.lowerCanvasEl, 0, 0, fabricCanvas.lowerCanvasEl.width, fabricCanvas.lowerCanvasEl.height, 0, 0, offCanvas.width, offCanvas.height);

  return {
    canvas: offCanvas,
    imageUrl: annotState.imageUrl,
    date: annotState.date,
    sourceRow: annotState.sourceRow,
    dirty: !!annotState.dirty
  };
}

```
