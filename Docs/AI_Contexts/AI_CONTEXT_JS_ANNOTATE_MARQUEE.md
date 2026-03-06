# JS — Annotation Marquee & Tools
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `static\js\annotate-marquee.js`
```js
/**
 * @fileoverview annotate-marquee.js
 * @description Marquee selection overlay, tags and grouped dragging.
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

## File: `static\js\annotate-tools.js`
```js
/**
 * @fileoverview annotate-tools.js
 * @description UI Toolbar bindings (Pen, Eraser, Text, Marquee tools).
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


```
