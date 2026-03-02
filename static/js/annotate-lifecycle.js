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
