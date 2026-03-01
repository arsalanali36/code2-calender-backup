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

function bindAnnotationCanvas() {
  const canvas = document.getElementById('annot-canvas');
  const wrapper = document.getElementById('gallery-img-wrapper');
  let mqCtxMenu = null;
  let mqCtxIdx = -1;

  function persistMarqueeBoxesToState() {
    if (!state._marqueeBoxes) state._marqueeBoxes = {};
    state._marqueeBoxes[annotState.imageUrl] = JSON.parse(JSON.stringify(annotState.marqueeBoxes || []));
  }

  function hideMarqueeContextMenu() {
    if (mqCtxMenu) mqCtxMenu.style.display = 'none';
    mqCtxIdx = -1;
  }

  function ensureMarqueeContextMenu() {
    if (mqCtxMenu) return mqCtxMenu;
    mqCtxMenu = document.createElement('div');
    mqCtxMenu.id = 'mq-context-menu';
    mqCtxMenu.style.position = 'fixed';
    mqCtxMenu.style.zIndex = '99999';
    mqCtxMenu.style.minWidth = '160px';
    mqCtxMenu.style.background = 'var(--surface)';
    mqCtxMenu.style.border = '1px solid var(--border2)';
    mqCtxMenu.style.borderRadius = '8px';
    mqCtxMenu.style.boxShadow = '0 8px 30px rgba(0,0,0,0.45)';
    mqCtxMenu.style.padding = '8px';
    mqCtxMenu.style.display = 'none';
    mqCtxMenu.innerHTML = `
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
    document.body.appendChild(mqCtxMenu);

    mqCtxMenu.querySelector('#mq-ctx-del').addEventListener('click', () => {
      const targets = getSelectedMarqueeIndexes().includes(mqCtxIdx) ? getSelectedMarqueeIndexes() : [mqCtxIdx];
      if (!targets.length) return;
      [...targets].sort((a, b) => b - a).forEach(i => {
        if (i >= 0 && i < annotState.marqueeBoxes.length) annotState.marqueeBoxes.splice(i, 1);
      });
      annotState.selectedMarquees = [];
      annotState.selectedMarquee = Math.min(mqCtxIdx, annotState.marqueeBoxes.length - 1);
      const ctx = canvas.getContext('2d');
      if (!annotState.marqueeRasterBase) annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
      renderMarqueeScene(ctx);
      annotState.dirty = true;
      persistMarqueeBoxesToState();
      hideMarqueeContextMenu();
    });

    mqCtxMenu.querySelector('#mq-ctx-dup').addEventListener('click', () => {
      const targets = getSelectedMarqueeIndexes().includes(mqCtxIdx) ? getSelectedMarqueeIndexes() : [mqCtxIdx];
      if (!targets.length) return;
      const newIndexes = [];
      targets.forEach(i => {
        const src = annotState.marqueeBoxes[i];
        if (!src) return;
        const copy = {
          ...JSON.parse(JSON.stringify(src)),
          x: Math.max(0, Math.min(canvas.width - src.w, src.x + 16)),
          y: Math.max(0, Math.min(canvas.height - src.h, src.y + 16))
        };
        annotState.marqueeBoxes.push(copy);
        newIndexes.push(annotState.marqueeBoxes.length - 1);
      });
      annotState.selectedMarquees = newIndexes;
      annotState.selectedMarquee = newIndexes.length ? newIndexes[newIndexes.length - 1] : -1;
      const ctx = canvas.getContext('2d');
      if (!annotState.marqueeRasterBase) annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
      renderMarqueeScene(ctx);
      annotState.dirty = true;
      persistMarqueeBoxesToState();
      hideMarqueeContextMenu();
    });

    mqCtxMenu.querySelector('#mq-ctx-rebind').addEventListener('click', async () => {
      const ctx = canvas.getContext('2d');
      await rebindCurrentImageOverlayToMarquee(ctx, canvas);
      hideMarqueeContextMenu();
    });

    mqCtxMenu.querySelectorAll('.mq-ctx-color').forEach(btn => {
      btn.addEventListener('click', () => {
        const targets = getSelectedMarqueeIndexes().includes(mqCtxIdx) ? getSelectedMarqueeIndexes() : [mqCtxIdx];
        if (!targets.length) return;
        targets.forEach(i => {
          if (i >= 0 && i < annotState.marqueeBoxes.length) annotState.marqueeBoxes[i].color = btn.dataset.color;
        });
        const ctx = canvas.getContext('2d');
        if (!annotState.marqueeRasterBase) annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
        renderMarqueeScene(ctx);
        annotState.dirty = true;
        persistMarqueeBoxesToState();
        hideMarqueeContextMenu();
      });
    });

    mqCtxMenu.querySelector('#mq-ctx-close-tool').addEventListener('click', () => {
      setAnnotTool('pen');
      hideMarqueeContextMenu();
    });

    document.addEventListener('click', e => {
      if (!mqCtxMenu || mqCtxMenu.style.display === 'none') return;
      if (!mqCtxMenu.contains(e.target)) hideMarqueeContextMenu();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') hideMarqueeContextMenu();
    });

    const mqInp = mqCtxMenu.querySelector('#mq-ctx-tag-inp');
    mqInp.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = mqInp.value.trim();
        if (val) {
          const targets = getSelectedMarqueeIndexes().includes(mqCtxIdx) ? getSelectedMarqueeIndexes() : [mqCtxIdx];
          targets.forEach(i => {
            const b = annotState.marqueeBoxes[i];
            if (b) {
              b.tags = b.tags || [];
              if (!b.tags.includes(val)) b.tags.push(val);
            }
          });
          if (!state.allTags.includes(val)) state.allTags.push(val);
          if (typeof normalizeAllTagsFromTrades === 'function') normalizeAllTagsFromTrades();
          annotState.dirty = true;
          persistMarqueeBoxesToState();
          const ctx = canvas.getContext('2d');
          renderMarqueeScene(ctx);
          if (typeof renderGalleryImageTags === 'function') renderGalleryImageTags();
          if (typeof renderGalleryTagCloud === 'function') renderGalleryTagCloud();
          if (typeof renderGalleryTagsTray === 'function') renderGalleryTagsTray();
          if (typeof renderTable === 'function') renderTable();
        }
        mqInp.value = '';
        hideMarqueeContextMenu();
        canvas.focus();
      } else if (e.key === 'Escape') {
        mqInp.value = '';
        hideMarqueeContextMenu();
        canvas.focus();
      }
    });

    return mqCtxMenu;
  }

  function showMarqueeContextMenu(clientX, clientY, idx) {
    const menu = ensureMarqueeContextMenu();
    mqCtxIdx = idx;
    menu.style.display = 'block';

    const inp = menu.querySelector('#mq-ctx-tag-inp');
    if (inp) inp.value = '';

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = menu.getBoundingClientRect();
    menu.style.left = Math.max(6, Math.min(clientX, vw - rect.width - 6)) + 'px';
    menu.style.top = Math.max(6, Math.min(clientY, vh - rect.height - 6)) + 'px';
  }

  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    const sx = canvas.width / Math.max(1, r.width);
    const sy = canvas.height / Math.max(1, r.height);
    return {
      x: (src.clientX - r.left) * sx,
      y: (src.clientY - r.top) * sy
    };
  }

  function createTextEditor(e) {
    if (annotState.textEditorActive) return;
    annotState.textEditorActive = true;

    const ctx = canvas.getContext('2d');
    annotState.history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (annotState.history.length > 40) annotState.history.shift();

    const pos = getPos(e);
    const textarea = document.createElement('textarea');
    textarea.className = 'canvas-text-editor';
    const alignBtn = document.getElementById('gv2-tb-align');
    let align = 'left';
    if (alignBtn.classList.contains('align-center')) align = 'center';
    else if (alignBtn.classList.contains('align-right')) align = 'right';

    const scale = zoom.scale || 1;

    textarea.style.position = 'absolute';
    textarea.style.left = pos.x + 'px';
    textarea.style.top = pos.y + 'px';
    textarea.style.color = document.getElementById('gv2-tb-color').value;
    textarea.style.fontSize = document.getElementById('gv2-tb-size').value + 'px';
    textarea.style.fontFamily = document.getElementById('gv2-tb-font').value;
    textarea.style.fontWeight = document.getElementById('gv2-tb-bold').classList.contains('active') ? 'bold' : 'normal';
    textarea.style.fontStyle = document.getElementById('gv2-tb-italic').classList.contains('active') ? 'italic' : 'normal';
    textarea.style.textAlign = align;
    textarea.style.background = 'transparent';
    textarea.style.border = '1px dashed #ccc';
    textarea.style.outline = 'none';
    textarea.style.padding = '0';
    textarea.style.margin = '0';
    textarea.style.overflow = 'hidden';
    textarea.style.resize = 'none';
    textarea.style.zIndex = '1000';
    textarea.rows = 1;
    textarea.style.minWidth = '50px';
    textarea.style.lineHeight = '1.2';
    textarea.style.transform = `scale(${1 / scale})`;
    textarea.style.transformOrigin = 'top left';

    textarea.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
      this.style.width = Math.max(50, this.scrollWidth) + 'px';
    });

    textarea.addEventListener('blur', function () {
      const text = this.value;
      if (text.trim()) {
        annotState.dirty = true;
        ctx.textBaseline = 'top';
        ctx.textAlign = align;
        ctx.fillStyle = this.style.color;
        ctx.font = `${this.style.fontStyle} ${this.style.fontWeight} ${this.style.fontSize} ${this.style.fontFamily}`;

        const lines = text.split('\n');
        const lineHeight = parseInt(this.style.fontSize) * 1.2;
        let startX = pos.x;
        if (align === 'center') startX += this.clientWidth / 2;
        else if (align === 'right') startX += this.clientWidth;

        lines.forEach((line, i) => {
          ctx.fillText(line, startX, pos.y + (i * lineHeight));
        });
      } else {
        annotState.history.pop();
      }
      this.remove();
      setTimeout(() => annotState.textEditorActive = false, 100);
    });

    textarea.addEventListener('keydown', function (evt) {
      if (evt.key === 'Escape') this.blur();
    });

    document.getElementById('gallery-img-wrapper').appendChild(textarea);
    setTimeout(() => { textarea.focus(); }, 10);
  }

  function startDraw(e) {
    if (!annotState.active) return;
    if (e.target.tagName !== 'CANVAS') return;
    e.preventDefault();

    if (annotState.tool === 'text') {
      createTextEditor(e);
      return;
    }

    if (annotState.tool === 'marquee') {
      const ctx = canvas.getContext('2d');
      const pos = getPos(e);
      if (!annotState.marqueeRasterBase) annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const picked = hitTestMarquee(pos.x, pos.y);
      const selectedBefore = getSelectedMarqueeIndexes();

      if (annotState.multiSelectMode) {
        if (picked >= 0 && selectedBefore.includes(picked)) {
          annotState.drawing = true;
          annotState.marqueeDragStartX = pos.x;
          annotState.marqueeDragStartY = pos.y;
          annotState.marqueeDragMode = 'move-group';
          annotState.marqueeDragGroupOrig = selectedBefore.map(i => ({ i, x: annotState.marqueeBoxes[i].x, y: annotState.marqueeBoxes[i].y }));
          annotState.marqueeDragOrig = null;
          canvas.style.cursor = 'grabbing';
          renderMarqueeScene(ctx);
          return;
        }
        annotState.drawing = true;
        annotState.marqueeDragMode = 'select';
        annotState.marqueeSelectStartX = pos.x;
        annotState.marqueeSelectStartY = pos.y;
        annotState.marqueeSelectRect = { x: pos.x, y: pos.y, w: 0, h: 0 };
        renderMarqueeScene(ctx, null, annotState.marqueeSelectRect);
        return;
      }

      if (picked >= 0) {
        setSingleMarqueeSelection(picked);
        const pickedBox = annotState.marqueeBoxes[picked];
        if (hitTestMarqueeDeleteHandle(pickedBox, pos.x, pos.y)) {
          annotState.marqueeBoxes.splice(picked, 1);
          setSingleMarqueeSelection(Math.min(picked, annotState.marqueeBoxes.length - 1));
          renderMarqueeScene(ctx);
          annotState.dirty = true;
          if (!state._marqueeBoxes) state._marqueeBoxes = {};
          state._marqueeBoxes[annotState.imageUrl] = JSON.parse(JSON.stringify(annotState.marqueeBoxes));
          return;
        }
        annotState.drawing = true;
        annotState.marqueeDragStartX = pos.x;
        annotState.marqueeDragStartY = pos.y;
        if (!hitTestMarqueeResizeHandle(pickedBox, pos.x, pos.y) && getSelectedMarqueeIndexes().length > 1) {
          annotState.marqueeDragMode = 'move-group';
          annotState.marqueeDragGroupOrig = getSelectedMarqueeIndexes().map(i => ({ i, x: annotState.marqueeBoxes[i].x, y: annotState.marqueeBoxes[i].y }));
          annotState.marqueeDragOrig = null;
        } else {
          annotState.marqueeDragOrig = { ...pickedBox };
          annotState.marqueeDragMode = hitTestMarqueeResizeHandle(pickedBox, pos.x, pos.y) ? 'resize' : 'move';
          annotState.marqueeDragGroupOrig = [];
        }
        canvas.style.cursor = (annotState.marqueeDragMode === 'move' || annotState.marqueeDragMode === 'move-group') ? 'grabbing' : 'nwse-resize';
        renderMarqueeScene(ctx);
        return;
      }
      annotState.history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (annotState.history.length > 40) annotState.history.shift();
      annotState.drawing = true;
      annotState.marqueeDragMode = 'create';
      canvas.style.cursor = 'crosshair';
      annotState.marqueeStartX = pos.x;
      annotState.marqueeStartY = pos.y;
      renderMarqueeScene(ctx);
      return;
    }

    const ctx = canvas.getContext('2d');
    annotState.history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (annotState.history.length > 40) annotState.history.shift();

    const pos = getPos(e);
    annotState.drawing = true;
    annotState.lastX = pos.x;
    annotState.lastY = pos.y;

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function doDraw(e) {
    if (!annotState.active || !annotState.drawing) return;
    e.preventDefault();
    const ctx = canvas.getContext('2d');
    const pos = getPos(e);

    if (annotState.tool === 'marquee') {
      const mode = annotState.marqueeDragMode || 'create';
      if (mode === 'move-group' && annotState.marqueeDragGroupOrig.length) {
        const dx = pos.x - annotState.marqueeDragStartX;
        const dy = pos.y - annotState.marqueeDragStartY;
        annotState.marqueeDragGroupOrig.forEach(({ i, x, y }) => {
          const box = annotState.marqueeBoxes[i];
          if (!box) return;
          box.x = Math.max(0, Math.min(canvas.width - box.w, x + dx));
          box.y = Math.max(0, Math.min(canvas.height - box.h, y + dy));
        });
        renderMarqueeScene(ctx);
        return;
      }
      if (mode === 'move' && annotState.selectedMarquee >= 0 && annotState.marqueeDragOrig) {
        const box = annotState.marqueeBoxes[annotState.selectedMarquee];
        const dx = pos.x - annotState.marqueeDragStartX;
        const dy = pos.y - annotState.marqueeDragStartY;
        box.x = Math.max(0, Math.min(canvas.width - box.w, annotState.marqueeDragOrig.x + dx));
        box.y = Math.max(0, Math.min(canvas.height - box.h, annotState.marqueeDragOrig.y + dy));
        renderMarqueeScene(ctx);
        return;
      }
      if (mode === 'resize' && annotState.selectedMarquee >= 0 && annotState.marqueeDragOrig) {
        const box = annotState.marqueeBoxes[annotState.selectedMarquee];
        box.w = Math.max(8, Math.min(canvas.width - box.x, annotState.marqueeDragOrig.w + (pos.x - annotState.marqueeDragStartX)));
        box.h = Math.max(8, Math.min(canvas.height - box.y, annotState.marqueeDragOrig.h + (pos.y - annotState.marqueeDragStartY)));
        renderMarqueeScene(ctx);
        return;
      }
      if (mode === 'select') {
        const x = Math.min(annotState.marqueeSelectStartX, pos.x);
        const y = Math.min(annotState.marqueeSelectStartY, pos.y);
        const w = Math.abs(pos.x - annotState.marqueeSelectStartX);
        const h = Math.abs(pos.y - annotState.marqueeSelectStartY);
        annotState.marqueeSelectRect = { x, y, w, h };
        renderMarqueeScene(ctx, null, annotState.marqueeSelectRect);
        return;
      }
      const x = Math.min(annotState.marqueeStartX, pos.x);
      const y = Math.min(annotState.marqueeStartY, pos.y);
      const w = Math.abs(pos.x - annotState.marqueeStartX);
      const h = Math.abs(pos.y - annotState.marqueeStartY);
      renderMarqueeScene(ctx, { x, y, w, h, tags: [] });
      return;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (annotState.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = annotState.size * 4;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else if (annotState.tool === 'highlight') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = annotState.size * 5;
      const hex = annotState.color;
      ctx.strokeStyle = hex + '55'; // ~33% opacity
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = annotState.size;
      ctx.strokeStyle = annotState.color;
    }

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    annotState.dirty = true;

    annotState.lastX = pos.x;
    annotState.lastY = pos.y;
  }

  function endDraw(e) {
    if (!annotState.drawing) return;
    if (annotState.tool === 'marquee') {
      const ctx = canvas.getContext('2d');
      const pos = getPos(e);
      const mode = annotState.marqueeDragMode || 'create';
      annotState.drawing = false;
      annotState.marqueePreview = null;
      annotState.marqueeDragMode = '';
      annotState.marqueeDragOrig = null;
      annotState.marqueeDragGroupOrig = [];
      if (mode === 'create') {
        const x = Math.min(annotState.marqueeStartX, pos.x);
        const y = Math.min(annotState.marqueeStartY, pos.y);
        const w = Math.abs(pos.x - annotState.marqueeStartX);
        const h = Math.abs(pos.y - annotState.marqueeStartY);
        if (w >= 8 && h >= 8) {
          const box = { x, y, w, h, tags: [] };
          annotState.marqueeBoxes.push(box);
          setSingleMarqueeSelection(annotState.marqueeBoxes.length - 1);
          annotState.dirty = true;
        }
      } else if (mode === 'select') {
        const sel = annotState.marqueeSelectRect;
        annotState.marqueeSelectRect = null;
        if (sel && sel.w >= 4 && sel.h >= 4) {
          const selected = [];
          annotState.marqueeBoxes.forEach((b, i) => {
            if (rectsIntersect(sel, b)) selected.push(i);
          });
          annotState.selectedMarquees = selected;
          annotState.selectedMarquee = selected.length ? selected[selected.length - 1] : -1;
          refreshGalleryTagsTrayIfVisible();
        }
      } else if (mode === 'move' || mode === 'resize') {
        annotState.dirty = true;
      } else if (mode === 'move-group') {
        annotState.dirty = true;
      }
      renderMarqueeScene(ctx);
      if (!state._marqueeBoxes) state._marqueeBoxes = {};
      state._marqueeBoxes[annotState.imageUrl] = JSON.parse(JSON.stringify(annotState.marqueeBoxes));
      canvas.style.cursor = 'crosshair';
      return;
    }
    annotState.drawing = false;
    canvas.getContext('2d').globalCompositeOperation = 'source-over';
  }

  function updateMarqueeCursor(e) {
    if (!annotState.active || annotState.tool !== 'marquee' || annotState.drawing) return;
    if (annotState.multiSelectMode) { canvas.style.cursor = 'crosshair'; return; }
    const pos = getPos(e);
    const idx = hitTestMarquee(pos.x, pos.y);
    if (idx >= 0) {
      const b = annotState.marqueeBoxes[idx];
      if (hitTestMarqueeDeleteHandle(b, pos.x, pos.y)) canvas.style.cursor = 'pointer';
      else if (hitTestMarqueeResizeHandle(b, pos.x, pos.y)) canvas.style.cursor = 'nwse-resize';
      else canvas.style.cursor = 'grab';
      return;
    }
    canvas.style.cursor = 'crosshair';
  }

  function updateBrushCursorPos(e) {
    const el = document.getElementById('annot-brush-cursor');
    if (!el) return;
    if (!shouldUseBrushCursor()) { el.style.display = 'none'; return; }
    const src = e.touches ? e.touches[0] : e;
    const wr = wrapper.getBoundingClientRect();
    el.style.left = (src.clientX - wr.left) + 'px';
    el.style.top = (src.clientY - wr.top) + 'px';
    el.style.display = 'block';
  }

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', doDraw);
  canvas.addEventListener('mousemove', updateBrushCursorPos);
  canvas.addEventListener('mousemove', updateMarqueeCursor);
  canvas.addEventListener('contextmenu', e => {
    if (!annotState.active || annotState.tool !== 'marquee') return;
    const pos = getPos(e);
    const idx = hitTestMarquee(pos.x, pos.y);
    if (idx < 0) { hideMarqueeContextMenu(); return; }
    e.preventDefault();
    const ctx = canvas.getContext('2d');
    const selected = getSelectedMarqueeIndexes();
    if (!selected.includes(idx)) setSingleMarqueeSelection(idx);
    if (!annotState.marqueeRasterBase) annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
    renderMarqueeScene(ctx);
    showMarqueeContextMenu(e.clientX, e.clientY, idx);
  });
  canvas.addEventListener('mouseup', endDraw);
  canvas.addEventListener('mouseleave', endDraw);
  canvas.addEventListener('mouseleave', () => {
    const el = document.getElementById('annot-brush-cursor');
    if (el) el.style.display = 'none';
  });
  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', doDraw, { passive: false });
  canvas.addEventListener('touchend', endDraw);

  document.getElementById('gv2-annotate-btn').addEventListener('click', toggleAnnotation);
  const mqTopBtn = document.getElementById('gv2-marquee-btn');
  if (mqTopBtn) mqTopBtn.addEventListener('click', toggleMarquee);

  ['pen', 'highlight', 'eraser'].forEach(tool => {
    document.getElementById('annot-' + tool).addEventListener('click', () => {
      setAnnotTool(tool);
    });
  });
  const vBtn = document.getElementById('annot-vselect');
  if (vBtn) vBtn.addEventListener('click', () => toggleMarqueeGroupSelect());

  document.getElementById('annot-color').addEventListener('input', e => {
    annotState.color = e.target.value;
  });

  document.getElementById('annot-size').addEventListener('input', e => {
    annotState.size = parseInt(e.target.value);
    document.getElementById('annot-size-label').textContent = e.target.value + 'px';
    updateAnnotToolIcons();
  });

  document.getElementById('annot-undo').addEventListener('click', () => {
    const ctx = canvas.getContext('2d');
    if (!annotState.history.length) return;
    ctx.putImageData(annotState.history.pop(), 0, 0);
    annotState.dirty = true;
  });

  document.getElementById('annot-clear').addEventListener('click', () => {
    const ctx = canvas.getContext('2d');
    annotState.history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    annotState.marqueeBoxes = [];
    annotState.selectedMarquee = -1;
    annotState.selectedMarquees = [];
    annotState.marqueeRasterBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (!state._marqueeBoxes) state._marqueeBoxes = {};
    state._marqueeBoxes[annotState.imageUrl] = [];
    if (state._penOnlyOverlays) delete state._penOnlyOverlays[annotState.imageUrl];
    annotState.dirty = true;
  });

  document.getElementById('annot-save-overlay').addEventListener('click', saveAnnotOverlay);
  document.getElementById('annot-save-merge').addEventListener('click', saveAnnotMerge);

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
  if (mqInp) mqInp.addEventListener('keydown', e => {
    if (e.key === 'Enter') addTagFromInput();
  });
  if (mqRebind) mqRebind.addEventListener('click', async () => {
    const ctx = canvas.getContext('2d');
    await rebindCurrentImageOverlayToMarquee(ctx, canvas);
  });
  if (mqDel) mqDel.addEventListener('click', () => {
    if (!annotState.active) return;
    toggleMarquee();
  });

  updateAnnotToolIcons();

  const tbBold = document.getElementById('gv2-tb-bold');
  if (tbBold) tbBold.addEventListener('click', () => tbBold.classList.toggle('active'));

  const tbItalic = document.getElementById('gv2-tb-italic');
  if (tbItalic) tbItalic.addEventListener('click', () => tbItalic.classList.toggle('active'));

  const tbAlign = document.getElementById('gv2-tb-align');
  if (tbAlign) {
    tbAlign.addEventListener('click', () => {
      if (tbAlign.classList.contains('align-center')) {
        tbAlign.classList.remove('align-center');
        tbAlign.classList.add('align-right');
        tbAlign.innerHTML = '&#8649;'; // Right indent
      } else if (tbAlign.classList.contains('align-right')) {
        tbAlign.classList.remove('align-right');
        tbAlign.innerHTML = '&#8801;'; // Left indent (default)
      } else {
        tbAlign.classList.add('align-center');
        tbAlign.innerHTML = '&#8644;'; // Center indent
      }
    });
  }
}

async function saveAnnotOverlay() {
  const canvas = document.getElementById('annot-canvas');
  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  if (!imgUrl) { showToast('No image selected', 'error'); return; }

  canvas.toBlob(async blob => {
    const fd = new FormData();
    fd.append('image', blob, 'overlay.png');
    try {
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.url) throw new Error();
      if (!setOverlayUrlForCurrentGalleryImage(data.url)) {
        showToast('Unable to map overlay to this image', 'error');
        return;
      }
      await saveTrades();
      annotState.dirty = false;
      stopAnnotation();
      showToast('Overlay saved!', 'success');
    } catch (e) { showToast('Overlay save failed', 'error'); }
  }, 'image/png');
}

async function saveAnnotMerge() {
  const canvas = document.getElementById('annot-canvas');
  const img = document.getElementById('gallery-img');
  const trade = getOwnerTradeForGalleryImage();

  const out = document.createElement('canvas');
  out.width = img.naturalWidth;
  out.height = img.naturalHeight;
  const ctx = out.getContext('2d');

  ctx.drawImage(img, 0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0, out.width, out.height);

  out.toBlob(async blob => {
    const fd = new FormData();
    fd.append('image', blob, 'merged.png');
    try {
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.url) throw new Error();
      const imgs = state.gallery.images;
      imgs.push(data.url);
      if (trade) {
        if (!Array.isArray(trade.images)) trade.images = [];
        if (trade.images !== imgs) trade.images.push(data.url);
      }
      state.gallery.currentIndex = imgs.length - 1; // jump to the new image
      await saveTrades();
      renderGallery();
      annotState.dirty = false;
      stopAnnotation();
      showToast('Merged image added to gallery!', 'success');
    } catch (e) { showToast('Merge save failed', 'error'); }
  }, 'image/png');
}

const zoom = { scale: 1, x: 0, y: 0 };
const drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 };

function resetZoom() { zoom.scale = 1; zoom.x = 0; zoom.y = 0; applyZoom(); }

function applyZoom() {
  const img = document.getElementById('gallery-img');
  const tf = `translate3d(${zoom.x}px, ${zoom.y}px, 0) scale(${zoom.scale})`;
  img.style.transform = tf;
  img.style.transformOrigin = 'top left';
  const canvas = document.getElementById('annot-canvas');
  if (canvas) {
    canvas.style.transform = tf;
    canvas.style.transformOrigin = 'top left';
    canvas.classList.toggle('dragging', !!drag.active);
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
    if (annotState.active) return; // annotation mode handles its own drag interactions
    const t = e.target;
    if (!(t && (t.id === 'gallery-img' || t.id === 'annot-canvas' || t.id === 'gallery-img-wrapper'))) return;
    drag.active = true; drag.startX = e.clientX; drag.startY = e.clientY;
    drag.originX = zoom.x; drag.originY = zoom.y;
    img.classList.add('dragging');
    const canvas = document.getElementById('annot-canvas');
    if (canvas) canvas.classList.add('dragging');
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
      const canvas = document.getElementById('annot-canvas');
      if (canvas) canvas.classList.remove('dragging');
      applyZoom();
    }
  });

  let lastDist = 0;
  let swipeTracking = false;
  let swipeStartX = 0;
  let swipeStartY = 0;
  let swipeLastX = 0;
  let swipeLastY = 0;
  wrapper.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      swipeTracking = false;
      return;
    }
    if (e.touches.length === 1 && zoom.scale <= 1 && !annotState.active) {
      swipeTracking = true;
      swipeStartX = e.touches[0].clientX;
      swipeStartY = e.touches[0].clientY;
      swipeLastX = swipeStartX;
      swipeLastY = swipeStartY;
      return;
    }
    swipeTracking = false;
  }, { passive: true });
  wrapper.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      zoom.scale = Math.min(Math.max(zoom.scale * (dist / lastDist), 1), 8);
      lastDist = dist; applyZoom();
      return;
    }
    if (swipeTracking && e.touches.length === 1) {
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      swipeLastX = x;
      swipeLastY = y;
      const dx = x - swipeStartX;
      const dy = y - swipeStartY;
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        e.preventDefault();
      }
    }
  }, { passive: false });
  wrapper.addEventListener('touchend', () => {
    if (!swipeTracking) return;
    const dx = swipeLastX - swipeStartX;
    const dy = swipeLastY - swipeStartY;
    swipeTracking = false;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
    navigateGallery(dx < 0 ? 1 : -1);
  }, { passive: true });
}
