function toggleAnnotation() {
  if (annotState.active && annotState.tool === 'text') {
    commitActiveCanvasTextEditor();
    const textBar = document.getElementById('gv2-text-bar');
    if (textBar) textBar.style.display = 'none';
    document.getElementById('gv2-text-btn').classList.remove('active');
    const annotBar = document.getElementById('gv2-annot-bar');
    if (annotBar) annotBar.style.display = 'flex';
    document.getElementById('gv2-annotate-btn').classList.add('active');
    setAnnotTool('pen');
    return;
  }

  if (annotState.active) {
    if (annotState.tool === 'marquee') {
      const mqBar = document.getElementById('gv2-marquee-bar');
      if (mqBar) mqBar.style.display = 'none';
      document.getElementById('gv2-marquee-btn').classList.remove('active');
    }
    stopAnnotation();
  } else {
    annotState.tool = 'pen';
    startAnnotation();
  }
}

function toggleMarquee() {
  if (annotState.active && annotState.tool === 'marquee') {
    stopAnnotation();
    return;
  }

  if (!annotState.active) {
    annotState.tool = 'marquee';
    startAnnotation();
  } else {
    setAnnotTool('marquee');
  }

  const mqBar = document.getElementById('gv2-marquee-bar');
  if (mqBar) mqBar.style.display = 'flex';
  const annotBar = document.getElementById('gv2-annot-bar');
  if (annotBar) annotBar.style.display = 'none';
  const tb = document.getElementById('gv2-text-bar');
  if (tb) tb.style.display = 'none';

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
    annotState.multiSelectMode = false;
    annotState.selectedMarquees = [];
    annotState.marqueeSelectRect = null;
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
  const canvas = document.getElementById('annot-canvas');
  const brushCursor = ensureAnnotBrushCursor();
  if (canvas) canvas.style.cursor = shouldUseBrushCursor() ? 'none' : 'crosshair';
  if (brushCursor) brushCursor.style.display = shouldUseBrushCursor() ? 'block' : 'none';
  updateAnnotBrushCursorVisual();
  if (tool === 'marquee') {
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (_prevTool !== 'marquee') {
        // Switching FROM pen/eraser/text TO marquee — always re-capture current canvas.
        // This preserves any pen strokes drawn while in the other tool mode.
        annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } else if (!annotState.marqueeRasterBase) {
        // Already in marquee mode but rasterBase was cleared — capture fresh.
        annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
      // If _prevTool === 'marquee' and rasterBase exists: keep it (no re-capture).
      renderMarqueeScene(ctx);
    }
  }
  updateMarqueeMultiSelectButton();
}

function updateMarqueeMultiSelectButton() {
  const btn = document.getElementById('annot-vselect');
  if (!btn) return;
  const active = annotState.tool === 'marquee' && annotState.multiSelectMode;
  btn.classList.toggle('active', active);
}

function toggleMarqueeGroupSelect(forceState = null) {
  if (!annotState.active) startAnnotation();
  setAnnotTool('marquee');
  annotState.multiSelectMode = typeof forceState === 'boolean' ? forceState : !annotState.multiSelectMode;
  if (!annotState.multiSelectMode) annotState.marqueeSelectRect = null;
  updateMarqueeMultiSelectButton();
  const canvas = document.getElementById('annot-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx && annotState.active && annotState.tool === 'marquee') renderMarqueeScene(ctx);
  }
  showToast(annotState.multiSelectMode ? 'Marquee group select ON (drag to select)' : 'Marquee group select OFF', 'success');
}

function updateAnnotToolIcons() {
  const marker = document.getElementById('annot-highlight');
  if (marker) marker.innerHTML = '&#9670;';
}

function adjustAnnotSize(delta) {
  const inp = document.getElementById('annot-size');
  if (!inp) return;
  const min = parseInt(inp.min || '1', 10);
  const max = parseInt(inp.max || '30', 10);
  const next = Math.max(min, Math.min(max, (parseInt(inp.value, 10) || annotState.size || 3) + delta));
  inp.value = String(next);
  annotState.size = next;
  const lbl = document.getElementById('annot-size-label');
  if (lbl) lbl.textContent = next + 'px';
  updateAnnotToolIcons();
  updateAnnotBrushCursorVisual();
}

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
  return annotState.active && (annotState.tool === 'pen' || annotState.tool === 'eraser');
}

function commitActiveCanvasTextEditor() {
  const editor = document.querySelector('#gallery-img-wrapper .canvas-text-editor');
  if (editor) editor.blur();
}

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
    const dx = x + w - 2;
    const dy = y - 2;
    ctx.fillStyle = 'rgba(190,26,48,0.95)';
    ctx.beginPath();
    ctx.arc(dx, dy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(dx - 4, dy - 4);
    ctx.lineTo(dx + 4, dy + 4);
    ctx.moveTo(dx + 4, dy - 4);
    ctx.lineTo(dx - 4, dy + 4);
    ctx.stroke();
  }
  ctx.restore();

  const tags = Array.isArray(box.tags) ? box.tags : [];
  if (!tags.length) return;
  const label = tags.join(', ');
  ctx.save();
  ctx.font = '12px Arial';
  ctx.textBaseline = 'top';
  const padX = 6, padY = 3, lineH = 14;
  const maxW = Math.max(64, Math.min(ctx.canvas.width - x - 4, w));
  const words = label.split(',').map(s => s.trim()).filter(Boolean);
  const lines = [];
  let cur = '';
  words.forEach(part => {
    const candidate = cur ? `${cur}, ${part}` : part;
    if (ctx.measureText(candidate).width + padX * 2 <= maxW) cur = candidate;
    else {
      if (cur) lines.push(cur);
      cur = part;
    }
  });
  if (cur) lines.push(cur);
  const safeLines = lines.slice(0, 3);
  if (lines.length > 3) safeLines[2] = safeLines[2] + '...';
  const tw = safeLines.length ? Math.max(...safeLines.map(s => Math.ceil(ctx.measureText(s).width))) : 0;
  const lw = Math.min(maxW, tw + padX * 2);
  const lh = safeLines.length * lineH + padY * 2;
  const lx = Math.max(2, Math.min(x, ctx.canvas.width - lw - 2));
  let ly = y + h + 4;
  if (ly + lh > ctx.canvas.height - 2) ly = Math.max(2, y - lh - 4);
  ctx.fillStyle = 'rgba(15,23,35,0.88)';
  ctx.fillRect(lx, ly, lw, lh);
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
  const hs = 12;
  const hx = box.x + box.w;
  const hy = box.y + box.h;
  return Math.abs(x - hx) <= hs && Math.abs(y - hy) <= hs;
}

function hitTestMarqueeDeleteHandle(box, x, y) {
  if (!box) return false;
  const dx = box.x + box.w - 2;
  const dy = box.y - 2;
  return ((x - dx) * (x - dx) + (y - dy) * (y - dy)) <= 11 * 11;
}

function getSelectedMarqueeIndexes() {
  const len = annotState.marqueeBoxes.length;
  const set = new Set((annotState.selectedMarquees || []).filter(i => Number.isInteger(i) && i >= 0 && i < len));
  if (annotState.selectedMarquee >= 0 && annotState.selectedMarquee < len) set.add(annotState.selectedMarquee);
  return Array.from(set).sort((a, b) => a - b);
}

function getSelectedMarqueeTagSet() {
  const tags = new Set();
  const idxs = getSelectedMarqueeIndexes();
  idxs.forEach(i => {
    const box = annotState.marqueeBoxes[i];
    (Array.isArray(box?.tags) ? box.tags : []).forEach(t => {
      const x = String(t || '').trim();
      if (x) tags.add(x);
    });
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
    const arr = Array.isArray(box.tags) ? box.tags.slice() : [];
    const set = new Set(arr.map(x => String(x || '').trim()).filter(Boolean));
    if (shouldAdd) set.add(t); else set.delete(t);
    box.tags = Array.from(set);
  });
  annotState.dirty = true;
  syncMarqueeBoxesShadow();
  const canvas = document.getElementById('annot-canvas');
  const ctx = canvas?.getContext('2d');
  if (ctx && annotState.active && annotState.tool === 'marquee') renderMarqueeScene(ctx);
  refreshMarqueeTagSuggestions();
  return true;
}

function setSingleMarqueeSelection(idx) {
  if (idx < 0 || idx >= annotState.marqueeBoxes.length) {
    annotState.selectedMarquee = -1;
    annotState.selectedMarquees = [];
    refreshGalleryTagsTrayIfVisible();
    return;
  }
  annotState.selectedMarquee = idx;
  annotState.selectedMarquees = [idx];
  refreshGalleryTagsTrayIfVisible();
}

function rectsIntersect(a, b) {
  return a.x < (b.x + b.w) && (a.x + a.w) > b.x && a.y < (b.y + b.h) && (a.y + a.h) > b.y;
}

function renderMarqueeScene(ctx, previewBox = null, selectRect = null) {
  if (annotState.marqueeRasterBase) ctx.putImageData(annotState.marqueeRasterBase, 0, 0);
  const selectedSet = new Set(getSelectedMarqueeIndexes());
  annotState.marqueeBoxes.forEach((b, i) => drawMarqueeBox(ctx, b, selectedSet.has(i)));
  if (previewBox) drawMarqueeBox(ctx, previewBox, true);
  if (selectRect && selectRect.w >= 2 && selectRect.h >= 2) {
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#58a6ff';
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

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!removed && !hadLocalOverlay && annotState.marqueeRasterBase) {
    // No overlay existed — restore in-memory pen strokes directly
    ctx.putImageData(annotState.marqueeRasterBase, 0, 0);
    annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
    renderMarqueeScene(ctx);
  } else if (penOnlyUrl) {
    // Overlay existed (flat baked image) — restore pen-only layer saved at stopAnnotation
    await new Promise(resolve => {
      const _pi = new Image();
      _pi.onload = () => {
        ctx.drawImage(_pi, 0, 0, canvas.width, canvas.height);
        annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
        renderMarqueeScene(ctx);
        resolve();
      };
      _pi.onerror = () => {
        annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
        renderMarqueeScene(ctx);
        resolve();
      };
      _pi.src = penOnlyUrl;
    });
  } else {
    // No pen strokes to restore — just show clean editable boxes
    annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
    renderMarqueeScene(ctx);
  }

  annotState.dirty = canvasHasVisibleInk(canvas) || annotState.marqueeBoxes.length > 0;

  if (removed) {
    await saveTrades();
    showToast('Overlay rebind complete: editable marquee active', 'success');
  } else {
    showToast('No frozen overlay found. Marquee is already editable', 'success');
  }
  return removed;
}

function refreshMarqueeTagSuggestions() {
  const dl = document.getElementById('gv2-mq-tag-suggestions');
  if (!dl) return;
  const tags = Array.from(new Set((state.allTags || []).map(t => String(t || '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b));
  dl.innerHTML = '';
  tags.forEach(tag => {
    const o = document.createElement('option');
    o.value = tag;
    dl.appendChild(o);
  });
}

function addTagToSelectedMarqueeBox(rawTag) {
  const idx = annotState.selectedMarquee;
  const tag = String(rawTag || '').trim();
  if (!annotState.active || annotState.tool !== 'marquee' || idx < 0 || !tag) return false;
  const canvas = document.getElementById('annot-canvas');
  if (!canvas) return false;
  const box = annotState.marqueeBoxes[idx];
  if (!box) return false;
  if (!box.tags) box.tags = [];
  if (!box.tags.includes(tag)) box.tags.push(tag);
  const ctx = canvas.getContext('2d');
  if (!annotState.marqueeRasterBase) annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
  renderMarqueeScene(ctx);
  annotState.dirty = true;
  if (!state._marqueeBoxes) state._marqueeBoxes = {};
  state._marqueeBoxes[annotState.imageUrl] = JSON.parse(JSON.stringify(annotState.marqueeBoxes));
  if (!state.allTags.includes(tag)) {
    state.allTags.push(tag);
    refreshMarqueeTagSuggestions();
  }
  renderGalleryTagCloud();
  return true;
}

function startAnnotation() {
  const img = document.getElementById('gallery-img');
  const wrapper = document.getElementById('gallery-img-wrapper');
  const canvas = document.getElementById('annot-canvas');
  const toolbar = document.getElementById('gv2-annot-bar'); // V2: floating bar

  const w = Math.round(img.clientWidth || img.naturalWidth || 0);
  const h = Math.round(img.clientHeight || img.naturalHeight || 0);
  if (w <= 0 || h <= 0) return;

  canvas.style.margin = 'auto';
  canvas.style.inset = '0';
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = w;
  canvas.height = h;
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  annotState.imageUrl = imgUrl || '';
  annotState.date = state.gallery.date || '';
  annotState.sourceRow = state.gallery.sourceRow;
  annotState.dirty = false;
  if (!state._marqueeBoxes) state._marqueeBoxes = {};
  const persistedBoxes = getMarqueeBoxesForImage(annotState.imageUrl, annotState.date, annotState.sourceRow);
  annotState.marqueeBoxes = persistedBoxes.length
    ? unpackMarqueeBoxes(persistedBoxes, canvas.width, canvas.height)
    : (Array.isArray(state._marqueeBoxes[annotState.imageUrl])
      ? JSON.parse(JSON.stringify(state._marqueeBoxes[annotState.imageUrl]))
      : []);
  annotState.selectedMarquee = -1;
  annotState.selectedMarquees = [];
  annotState.multiSelectMode = false;
  annotState.marqueePreview = null;
  annotState.marqueeRasterBase = null;
  annotState.marqueeDragMode = '';
  annotState.marqueeDragOrig = null;
  annotState.marqueeSelectRect = null;
  annotState.marqueeDragGroupOrig = [];
  const hasLegacy = persistedBoxes.some(b => !(b && typeof b === 'object' && 'rx' in b && 'ry' in b && 'rw' in b && 'rh' in b));
  if (hasLegacy && annotState.imageUrl) {
    const packedNow = packMarqueeBoxes(annotState.marqueeBoxes, canvas.width, canvas.height);
    setMarqueeBoxesForImage(annotState.imageUrl, packedNow, annotState.date, annotState.sourceRow);
    saveTrades();
  }
  const overlayUrl = state._localOverlays?.[imgUrl] || getOverlayUrlForImage(imgUrl, state.gallery.date || '');
  if (overlayUrl) {
    const ovImg = new Image();
    ovImg.onload = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(ovImg, 0, 0, w, h);
      if (annotState.marqueeBoxes.length) {
        const _penUrl = state._penOnlyOverlays?.[imgUrl];
        if (_penUrl) {
          const _penImg = new Image();
          _penImg.onload = () => {
            const _tc = document.createElement('canvas');
            _tc.width = canvas.width; _tc.height = canvas.height;
            _tc.getContext('2d').drawImage(_penImg, 0, 0, _tc.width, _tc.height);
            annotState.marqueeRasterBase = _tc.getContext('2d').getImageData(0, 0, _tc.width, _tc.height);
            renderMarqueeScene(ctx);
          };
          _penImg.onerror = () => {
            annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
            renderMarqueeScene(ctx);
          };
          _penImg.src = _penUrl;
        } else {
          annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
          renderMarqueeScene(ctx);
        }
      }
    };
    ovImg.src = overlayUrl;
  } else if (annotState.marqueeBoxes.length) {
    annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
    renderMarqueeScene(ctx);
  }

  annotState.active = true;
  annotState.history = [];

  if (annotState.tool === 'text') {
    const annotBar = document.getElementById('gv2-annot-bar');
    if (annotBar) annotBar.style.display = 'none';
    document.getElementById('gv2-annotate-btn').classList.remove('active');
    const textBar = document.getElementById('gv2-text-bar');
    if (textBar) textBar.style.display = 'flex';
    document.getElementById('gv2-text-btn').classList.add('active');
  } else if (annotState.tool === 'marquee') {
    const annotBar = document.getElementById('gv2-annot-bar');
    if (annotBar) annotBar.style.display = 'none';
    document.getElementById('gv2-annotate-btn').classList.remove('active');
    const textBar = document.getElementById('gv2-text-bar');
    if (textBar) textBar.style.display = 'none';
    document.getElementById('gv2-text-btn').classList.remove('active');
    const jqBar = document.getElementById('gv2-marquee-bar');
    if (jqBar) jqBar.style.display = 'flex';
    document.getElementById('gv2-marquee-btn').classList.add('active');
  } else {
    const textBar = document.getElementById('gv2-text-bar');
    if (textBar) textBar.style.display = 'none';
    document.getElementById('gv2-text-btn').classList.remove('active');
    const annotBar = document.getElementById('gv2-annot-bar');
    if (annotBar) annotBar.style.display = 'flex';
    document.getElementById('gv2-annotate-btn').classList.add('active');
    setAnnotTool(preferredTool);
  }
  updateMarqueeMultiSelectButton();

  canvas.style.pointerEvents = 'auto';
  canvas.style.cursor = shouldUseBrushCursor() ? 'none' : 'crosshair';
  applyZoom();
  const brushCursor = ensureAnnotBrushCursor();
  if (brushCursor) brushCursor.style.display = shouldUseBrushCursor() ? 'block' : 'none';
  updateAnnotBrushCursorVisual();
  document.getElementById('gallery-img').style.pointerEvents = 'none';
}

function stopAnnotation() {
  const _bc = document.getElementById('annot-brush-cursor');
  if (_bc) _bc.style.display = 'none';
  const _m = document.getElementById('mq-context-menu');
  if (_m) _m.style.display = 'none';
  commitActiveCanvasTextEditor();
  const canvas = document.getElementById('annot-canvas');
  const session = {
    canvas,
    imageUrl: annotState.imageUrl,
    date: annotState.date,
    sourceRow: annotState.sourceRow,
    dirty: !!annotState.dirty
  };
  autoSaveAnnotationSession(session);
  const annotBar = document.getElementById('gv2-annot-bar');
  if (annotBar) annotBar.style.display = 'none';
  const textBar = document.getElementById('gv2-text-bar');
  if (textBar) textBar.style.display = 'none';
  const mqBar = document.getElementById('gv2-marquee-bar');
  if (mqBar) mqBar.style.display = 'none';

  document.getElementById('gv2-annotate-btn').classList.remove('active');
  document.getElementById('gv2-text-btn').classList.remove('active');
  document.getElementById('gv2-marquee-btn').classList.remove('active');
  document.getElementById('gallery-img').style.pointerEvents = '';
  annotState.textEditorActive = false;
  if (!state._marqueeBoxes) state._marqueeBoxes = {};
  if (annotState.imageUrl) {
    state._marqueeBoxes[annotState.imageUrl] = JSON.parse(JSON.stringify(annotState.marqueeBoxes || []));
    const packed = packMarqueeBoxes(annotState.marqueeBoxes || [], canvas?.width || 1, canvas?.height || 1);
    setMarqueeBoxesForImage(annotState.imageUrl, packed, annotState.date, annotState.sourceRow);
    if (session.dirty) saveTrades();
    // Save pen-only raster (before box renders) so Rebind can restore it after navigation
    if (annotState.marqueeBoxes.length && annotState.marqueeRasterBase) {
      try {
        const _poc = document.createElement('canvas');
        _poc.width = canvas?.width || 1;
        _poc.height = canvas?.height || 1;
        _poc.getContext('2d').putImageData(annotState.marqueeRasterBase, 0, 0);
        if (!state._penOnlyOverlays) state._penOnlyOverlays = {};
        state._penOnlyOverlays[annotState.imageUrl] = _poc.toDataURL('image/png');
      } catch (_e) { }
    }
  }
  annotState.imageUrl = '';
  annotState.date = '';
  annotState.sourceRow = null;
  annotState.dirty = false;
  annotState.marqueeBoxes = [];
  annotState.selectedMarquee = -1;
  annotState.selectedMarquees = [];
  annotState.multiSelectMode = false;
  annotState.marqueePreview = null;
  annotState.marqueeRasterBase = null;
  annotState.marqueeDragMode = '';
  annotState.marqueeDragOrig = null;
  annotState.marqueeSelectRect = null;
  annotState.marqueeDragGroupOrig = [];
  annotState.active = false;
  annotState.history = [];
  updateMarqueeMultiSelectButton();
  loadOverlayForCurrentImage();
}

