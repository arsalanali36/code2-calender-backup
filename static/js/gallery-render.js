// gallery-render.js — renderGallery + thumbnail strip (OPEN/Trade/CLOSE separators, drag-drop, time labels)
// Video blob cache → gallery-render-b.js

function renderGallery() {
  if (state.gallery._skipFilterRescopeOnce) {
    state.gallery._skipFilterRescopeOnce = false;
  } else if (state.gallery.tagFilter?.length) {
    const before = getCurrentGalleryPreserveContext();
    applyGalleryImageScopeByTagFilter(before);
  }
  const { images, currentIndex, date } = state.gallery;
  const currentImageUrl = images[currentIndex] || '';
  if (annotState.active && annotState.imageUrl && annotState.imageUrl !== currentImageUrl) {
    state._carryAnnotTool = annotState.tool;
    stopAnnotation();
  }
  const dateEl = document.getElementById('gallery-date');
  if (dateEl) {
    if (date) {
      dateEl.style.display = 'none';
    } else {
      dateEl.style.display = '';
      dateEl.textContent = `${images.length} image(s)`;
    }
  }
  if (date) {
    const picker = document.getElementById('gallery-date-picker');
    if (picker) picker.value = date;
  }

  const uploadBtn = document.getElementById('gallery-upload-btn');
  if (uploadBtn) uploadBtn.style.display = date ? '' : 'none';

  const obsBtn = document.getElementById('gv2-obs-btn');
  if (obsBtn) obsBtn.style.display = date ? '' : 'none';

  const img     = document.getElementById('gallery-img');
  const vidEl   = document.getElementById('gallery-video');
  const curUrl  = images[currentIndex] || '';
  const isVid   = typeof isVideoUrl === 'function' && isVideoUrl(curUrl);

  if (!annotState.active) document.getElementById('annot-canvas').style.display = 'none';

  if (isVid) {
    // ── Show video, hide image ──
    img.style.display   = 'none';
      if (vidEl) {
        vidEl.style.display = '';
        const resolvedVidUrl = resolveImageUrl(curUrl);
        const doPlay = () => {
          const p = vidEl.play();
          if (p !== undefined) p.catch(err => {
            console.warn("Autoplay blocked:", err);
            vidEl.controls = true;
          });
        };
        const applyVideoSrc = (srcToUse) => {
          const currentSrcPath = vidEl.src ? new URL(vidEl.src, location.href).pathname : '';
          const wantedPath = srcToUse.startsWith('blob:')
            ? (vidEl.src === srcToUse ? vidEl.src : '')
            : new URL(srcToUse, location.href).pathname;
          const srcChanged = srcToUse.startsWith('blob:')
            ? vidEl.src !== srcToUse
            : currentSrcPath !== wantedPath;
          if (srcChanged) {
            vidEl.src = srcToUse;
            vidEl.load();
            vidEl.addEventListener('canplay', doPlay, { once: true });
          } else {
            doPlay();
          }
        };
        vidEl.muted = true;
        vidEl.classList.add('active-video');
        // Use blob cache if available, otherwise fetch+cache in background
        const cached = _videoBlobCache.get(resolvedVidUrl);
        if (cached) {
          applyVideoSrc(cached);
        } else {
          // Show immediately from server URL, cache in background for next time
          applyVideoSrc(resolvedVidUrl);
          _cacheVideo(resolvedVidUrl); // background fetch for next navigation
        }
        // Preload adjacent videos in background
        _preloadAdjacentVideos();
        vidEl.onclick = e => e.stopPropagation();
      }
    img.classList.remove('zoomed', 'dragging');
    resetZoom();
  } else {
    // ── Show image, hide video ──
    if (vidEl) { 
      vidEl.style.display = 'none'; 
      vidEl.pause && vidEl.pause(); 
      // Do not clear src here to avoid "flicker" or loading issues when switching back
    }
    img.style.display = '';
    img.style.opacity = '';
    img.style.filter  = '';
    img.title = '';
    img.src = resolveImageUrl(curUrl);
    img.classList.remove('zoomed', 'dragging'); resetZoom();
    img.onerror = () => {
      if (!curUrl) return;
      img.style.opacity = '0.3';
      img.style.filter  = 'grayscale(1) contrast(0.5)';
      img.title = 'Image could not be loaded.';
    };
    const afterImageReady = () => {
      loadOverlayForCurrentImage();
      if (state._carryAnnotTool) {
        annotState.tool = state._carryAnnotTool;
        state._carryAnnotTool = '';
        startAnnotation();
      }
    };
    img.addEventListener('load', afterImageReady, { once: true });
    if (img.complete && img.naturalWidth) afterImageReady();
    // Fullscreen Viewer trigger
    img.onclick = null; // fullscreen moved to F key / fullscreen button
  }

  // ====== CLOSE GLOBAL Source Tray & Markers ======
  document.querySelectorAll('.close-global-nav-btn, .close-global-marker').forEach(b => b.remove());
  const oldCont = document.getElementById('close-global-nav-container');
  if (oldCont) oldCont.style.display = 'none';
  const oldTray = document.getElementById('close-global-tray');
  if (oldTray) oldTray.remove();

  let closeGlobalDateKey = state.gallery.date;
  if (!closeGlobalDateKey && curUrl) {
      const gctx = findGalleryContextByImageUrl(curUrl);
      if (gctx && gctx.date && state.dayData[gctx.date]?.closeGlobalImages?.includes(curUrl)) {
          closeGlobalDateKey = gctx.date;
      }
  }

  if (closeGlobalDateKey && curUrl && state.dayData[closeGlobalDateKey]?.closeGlobalImages?.includes(curUrl)) {
      const tradesForDay = getTradesForDate(closeGlobalDateKey);
      if (tradesForDay.length > 0) {
          const imgContainer = document.getElementById('gallery-img-wrapper') || document.querySelector('.gv2-img-area');
          const zoomOverlay = document.getElementById('gallery-zoom-layer');
          
          if (imgContainer && zoomOverlay) {
              if (getComputedStyle(imgContainer).position === 'static') imgContainer.style.position = 'relative';
              
              // 1. Zoomable Marker Container
              let navCont = document.getElementById('close-global-nav-container');
              if (!navCont) {
                  navCont = document.createElement('div');
                  navCont.id = 'close-global-nav-container';
                  navCont.style.position = 'absolute';
                  navCont.style.top = '0'; navCont.style.left = '0';
                  navCont.style.width = '100%'; navCont.style.height = '100%';
                  navCont.style.pointerEvents = 'none'; navCont.style.zIndex = '9998';
                  zoomOverlay.appendChild(navCont);
              }
              navCont.style.display = 'block';
              if (typeof zoom !== 'undefined') {
                  navCont.style.transform = `translate3d(${zoom.x}px, ${zoom.y}px, 0) scale(${zoom.scale})`;
                  navCont.style.transformOrigin = 'top left';
              }

              // 2. Fixed Source Tray
              const tray = document.createElement('div');
              tray.id = 'close-global-tray';
              tray.style.position = 'absolute';
              
              // Load saved tray position/orientation
              const savedTray = JSON.parse(localStorage.getItem('tj_gv2_cg_tray') || '{"bottom":"20px","left":"50%","dir":"row"}');
              tray.style.bottom = savedTray.bottom;
              tray.style.left = savedTray.left;
              tray.style.top = savedTray.top || 'auto';
              tray.style.right = savedTray.right || 'auto';
              tray.style.flexDirection = savedTray.dir;
              tray.style.display = 'flex';
              tray.style.gap = '8px';
              tray.style.padding = '8px 12px';
              tray.style.background = 'rgba(15,15,20,0.85)';
              tray.style.backdropFilter = 'blur(10px)';
              tray.style.borderRadius = '24px';
              tray.style.border = '1px solid rgba(255,255,255,0.1)';
              tray.style.zIndex = '20000'; // Higher than sidebar and panels
              tray.style.cursor = 'move';
              if (savedTray.left === '50%') tray.style.transform = 'translateX(-50%)';

              // Tray dragging logic
              let trayDragging = false, tStartX, tStartY, tInitL, tInitT;
              tray.addEventListener('mousedown', (e) => {
                  if (e.target !== tray) return; // Only drag by background
                  trayDragging = true;
                  tStartX = e.clientX; tStartY = e.clientY;
                  tInitL = tray.offsetLeft; tInitT = tray.offsetTop;
                  tray.style.transform = 'none'; // clear centering
                  e.preventDefault();
              });

              document.addEventListener('mousemove', (e) => {
                  if (!trayDragging) return;
                  const dx = e.clientX - tStartX;
                  const dy = e.clientY - tStartY;
                  const newL = tInitL + dx;
                  const newT = tInitT + dy;
                  tray.style.left = newL + 'px';
                  tray.style.top = newT + 'px';
                  tray.style.bottom = 'auto'; tray.style.right = 'auto';

                  // Context awareness: Side edges -> Vertical, Top/Bottom -> Horizontal
                  const rect = imgContainer.getBoundingClientRect();
                  const distL = e.clientX - rect.left;
                  const distR = rect.right - e.clientX;
                  const distT = e.clientY - rect.top;
                  const distB = rect.bottom - e.clientY;

                  if (Math.min(distL, distR) < Math.min(distT, distB)) {
                      tray.style.flexDirection = 'column';
                  } else {
                      tray.style.flexDirection = 'row';
                  }
              });

              document.addEventListener('mouseup', () => {
                  if (!trayDragging) return;
                  trayDragging = false;
                  // Persist
                  const config = {
                      top: tray.style.top,
                      left: tray.style.left,
                      bottom: 'auto',
                      right: 'auto',
                      dir: tray.style.flexDirection
                  };
                  localStorage.setItem('tj_gv2_cg_tray', JSON.stringify(config));
              });

              // --- Keep tray in bounds if panel resizes ---
              const ensureTrayInBounds = () => {
                  const cRect = imgContainer.getBoundingClientRect();
                  const tRect = tray.getBoundingClientRect();
                  
                  let nudge = false;
                  let newL = tray.offsetLeft;
                  let newT = tray.offsetTop;

                  if (tRect.right > cRect.right - 10) {
                      newL = cRect.width - tRect.width - 20;
                      nudge = true;
                  }
                  if (tRect.bottom > cRect.bottom - 10) {
                      newT = cRect.height - tRect.height - 20;
                      nudge = true;
                  }
                  if (tRect.left < cRect.left + 10) {
                      newL = 20;
                      nudge = true;
                  }
                  if (tRect.top < cRect.top + 10) {
                      newT = 20;
                      nudge = true;
                  }

                  if (nudge) {
                      tray.style.left = newL + 'px';
                      tray.style.top = newT + 'px';
                      tray.style.bottom = 'auto'; tray.style.right = 'auto';
                  }
              };

              const trayObserver = new ResizeObserver(() => {
                  ensureTrayInBounds();
              });
              trayObserver.observe(imgContainer);

              imgContainer.appendChild(tray);

              const dayDataObj = state.dayData[closeGlobalDateKey];
              if (!dayDataObj.navPositions) dayDataObj.navPositions = {};
              if (!dayDataObj.navPositions[curUrl]) dayDataObj.navPositions[curUrl] = {};
              const posData = dayDataObj.navPositions[curUrl];

              tradesForDay.forEach((tr, idx) => {
                  const pnl = parseFloat(tr['Net P/L'] || tr.net_pnl || 0);
                  const color = pnl > 0 ? 'var(--green)' : (pnl < 0 ? 'var(--red)' : 'var(--blue)');
                  const timeStr = tr['Entry Time'] || tr['entry_time'] || tr['entryTime'] || tr['Buy Time'] || tr['Time'] || tr['time'] || 'N/A';
                  const pnlRounded = Math.round(pnl);
                  const pnlDisplay = (pnlRounded >= 0 ? '+' : '') + pnlRounded.toLocaleString('en-IN');
                  const tooltip = `Trade #${idx + 1}\nTime: ${timeStr}\nP&L: ₹${pnlDisplay}`;

                  // --- Create Marker (The duplicate on image) ---
                  const marker = document.createElement('button');
                  marker.className = 'close-global-marker';
                  marker.textContent = String(idx + 1);
                  marker.style.position = 'absolute';
                  marker.style.zIndex = '9999';
                  marker.style.pointerEvents = 'auto';
                  marker.style.background = color;
                  marker.style.color = '#fff';
                  marker.style.border = '1px solid rgba(255,255,255,0.4)';
                  marker.style.borderRadius = '50%';
                  marker.style.width = '26px';
                  marker.style.height = '26px';
                  marker.style.fontSize = '0.85rem';
                  marker.style.fontWeight = 'bold';
                  marker.style.cursor = 'pointer';
                  marker.style.opacity = '0.7';
                  marker.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
                  marker.title = tooltip + "\n(Right-click to remove)";
                  
                  marker.oncontextmenu = (e) => {
                      e.preventDefault();
                      delete posData[idx];
                      if (typeof saveTrades === 'function') saveTrades();
                      marker.style.display = 'none';
                  };
                  
                  if (posData[idx]) {
                      marker.style.left = posData[idx].left;
                      marker.style.top = posData[idx].top;
                      marker.style.display = 'block';
                  } else {
                      marker.style.display = 'none'; // Hidden until placed
                  }

                  // --- Create Tray Button (The source) ---
                  const sourceBtn = document.createElement('button');
                  sourceBtn.className = 'close-global-nav-btn';
                  sourceBtn.textContent = String(idx + 1);
                  sourceBtn.style.background = color;
                  sourceBtn.style.color = '#fff';
                  sourceBtn.style.border = 'none';
                  sourceBtn.style.borderRadius = '50%';
                  sourceBtn.style.width = '34px';
                  sourceBtn.style.height = '34px';
                  sourceBtn.style.fontSize = '1rem';
                  sourceBtn.style.fontWeight = 'bold';
                  sourceBtn.style.cursor = 'grab';
                  sourceBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.4)';
                  sourceBtn.title = tooltip;
                  tray.appendChild(sourceBtn);

                  // Shared drag logic
                  let isDragging = false;
                  let startX, startY, initialLeft, initialTop;
                  let clickStartTime = 0;
                  let movedDuringClick = false;

                  const onMouseMove = (e) => {
                      if (!isDragging) return;
                      movedDuringClick = true;
                      const rect = zoomOverlay.getBoundingClientRect();
                      const scale = rect.width / zoomOverlay.offsetWidth || 1;
                      const dx = (e.clientX - startX) / scale;
                      const dy = (e.clientY - startY) / scale;
                      
                      marker.style.display = 'block'; // Ensure visible when dragging source
                      marker.style.left = (((initialLeft + dx) / zoomOverlay.offsetWidth) * 100) + '%';
                      marker.style.top = (((initialTop + dy) / zoomOverlay.offsetHeight) * 100) + '%';
                  };

                  const onMouseUp = () => {
                      if (!isDragging) return;
                      isDragging = false;
                      sourceBtn.style.cursor = 'grab';
                      marker.style.cursor = 'pointer';
                      
                      posData[idx] = {
                          left: marker.style.left,
                          top: marker.style.top
                      };
                      if (typeof saveTrades === 'function') saveTrades();

                      document.removeEventListener('mousemove', onMouseMove);
                      document.removeEventListener('mouseup', onMouseUp);
                  };

                  const bindDrag = (el, isSource) => {
                      el.addEventListener('mousedown', (e) => {
                          if (e.button !== 0) return;
                          isDragging = true;
                          clickStartTime = Date.now();
                          movedDuringClick = false;
                          el.style.cursor = 'grabbing';
                          
                          if (isSource) {
                              const rect = zoomOverlay.getBoundingClientRect();
                              const scale = rect.width / zoomOverlay.offsetWidth || 1;
                              // Approximate initial position for marker near the tray button
                              initialLeft = (e.clientX - rect.left) / scale;
                              initialTop = (e.clientY - rect.top) / scale;
                          } else {
                              initialLeft = marker.offsetLeft;
                              initialTop = marker.offsetTop;
                          }
                          
                          startX = e.clientX;
                          startY = e.clientY;
                          
                          document.addEventListener('mousemove', onMouseMove);
                          document.addEventListener('mouseup', onMouseUp);
                          e.preventDefault(); e.stopPropagation();
                      });
                  };

                  bindDrag(sourceBtn, true);
                  bindDrag(marker, false);

                  marker.onclick = (e) => {
                      e.stopPropagation();
                      if (!movedDuringClick && Date.now() - clickStartTime < 300) {
                          if (typeof openTradeSidebar === 'function') openTradeSidebar(tr);
                      }
                  };
                  sourceBtn.onclick = marker.onclick;

                  navCont.appendChild(marker);
              });
          }
      }
  }
  // ===================================================

  document.getElementById('gallery-counter').textContent = `${currentIndex + 1} / ${images.length}`;
  document.getElementById('gallery-prev').disabled = images.length <= 1;
  document.getElementById('gallery-next').disabled = images.length <= 1;
  renderGalleryImageTags();
  renderGalleryTagCloud();
  const tray = document.getElementById('gv2-tags-tray');
  if (tray && tray.style.display !== 'none') {
    renderGalleryTagsTray();
    renderGalleryVideoUrls();
  }
  if (document.getElementById('img-tag-modal')?.classList.contains('open')) renderImageTagModal();

  if (typeof renderGalleryStats === 'function') renderGalleryStats();
  if (typeof renderLayerPanel === 'function' && state.gallery.layerPanelOpen) renderLayerPanel();
  if (typeof renderAudioBar === 'function') renderAudioBar();
  if (typeof renderVideoBar === 'function') renderVideoBar();
  if (typeof renderGalleryTrayState === 'function') renderGalleryTrayState();

  // Visual clue: filter-active state on tray + filter bar
  const _filterActive = Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length > 0;
  document.getElementById('gallery-thumbs')?.classList.toggle('filter-active', _filterActive);
  document.getElementById('gv2-tag-cloud')?.classList.toggle('filter-active', _filterActive);

  const filterBar = document.getElementById('gallery-filter-active-bar');
  const countBar = document.getElementById('gallery-filter-count-bar');
  if (filterBar) {
    if (_filterActive) {
      const modeText = state.gallery.filterMode === 'and' ? 'ALL of' : 'ANY of';
      filterBar.innerHTML = `<span>FILTER ACTIVE (${modeText}):</span> <span style="background:#000; color:#fff; padding:2px 8px; border-radius:20px; margin-left:6px">${state.gallery.tagFilter.join(', ')}</span>`;
      filterBar.style.display = 'flex';
      
      if (countBar) {
        document.getElementById('gallery-filter-count-text').textContent = images.length;
        countBar.style.display = 'block';
      }
    } else {
      filterBar.style.display = 'none';
      if (countBar) countBar.style.display = 'none';
    }
  }

  const thumbs = document.getElementById('gallery-thumbs');
  const savedScrollTop = thumbs ? thumbs.scrollTop : 0;
  const savedScrollLeft = thumbs ? thumbs.scrollLeft : 0;
  if (thumbs) thumbs.innerHTML = '';
  const thumbImages = _getGalleryThumbImages();
  let dragFromIndex = -1;
  const highlightSubImages = new Set();
  const highlightParents = new Set();
  const subImageToParentMap = new Map();
  if (state.gallery.expandedGroups) {
    for (const pUrl of state.gallery.expandedGroups) {
      const ownerTrade = getOwnerTradeForImageUrl(pUrl);
      const subArr = (ownerTrade && ownerTrade.subImages?.[pUrl]?.length > 0 && ownerTrade.subImages[pUrl])
        || (state.gallery.date && state.dayData[state.gallery.date]?.subImages?.[pUrl]?.length > 0 && state.dayData[state.gallery.date].subImages[pUrl]);
      if (!subArr) continue; // skip stale / empty groups
      highlightParents.add(pUrl);
      subArr.forEach(u => { highlightSubImages.add(u); subImageToParentMap.set(u, pUrl); });
    }
  }

  let lastTradeIdxRendered = -1;
  const dayTrades = state.gallery.date ? getTradesForDate(state.gallery.date) : [];
  const _filterActive3 = Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length > 0;
  const _perDateLastIdx = new Map();   // filter mode: per-date lastTradeIdxRendered
  const _perDateRenderedSeps = new Set(); // filter mode: "date:OPEN" / "date:CLOSE" rendered flags

  // Pre-compute which trade indices (0-based) per date have matching filter images,
  // and which dates have OPEN (dayData) images — so we skip empty separators.
  const _filteredTradeIdxPerDate = new Map(); // date → Set of 0-based trade indices
  const _filteredOpenDates = new Set();       // dates that have a non-close dayData image in filter
  if (_filterActive3 && state.gallery._filteredMeta) {
    state.gallery._filteredMeta.forEach(meta => {
      const d = meta.date || '';
      if (!d) return;
      if (meta.sourceRow !== null && meta.sourceRow !== undefined) {
        const trade = state.trades[meta.sourceRow];
        if (!trade) return;
        const trades = (d !== state.gallery.date) ? getTradesForDate(d) : dayTrades;
        const idx = trades.indexOf(trade);
        if (idx < 0) return;
        if (!_filteredTradeIdxPerDate.has(d)) _filteredTradeIdxPerDate.set(d, new Set());
        _filteredTradeIdxPerDate.get(d).add(idx);
      } else if (!state.dayData[d]?.closeImages?.includes(meta.url)) {
        _filteredOpenDates.add(d);
      }
    });
  }

  const _fmtSepDate = (d) => {
    if (!d) return '';
    const _mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const _dy = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const _dt = new Date(d + 'T00:00:00');
    return _mo[_dt.getMonth()] + ' ' + String(_dt.getDate()).padStart(2,'0') + ' ' + _dy[_dt.getDay()];
  };

  const createTradeSeparator = (idx, tradeObj, dateLabel) => {
    const sep = document.createElement('div');
    sep.className = 'gv2-thumb-separator';
    sep.title = `Trade ${idx + 1} (Drop to move. Click to collapse)`;
    const sepKey = 'T' + idx;
    const isCollapsed = state.gallery.collapsedSeparators?.has(sepKey);
    const arrow = isCollapsed ? '▸' : '▾';
    const tr = tradeObj !== undefined ? tradeObj : dayTrades[idx];
    const pnl = parseFloat(tr?.['Net P/L'] || tr?.net_pnl || 0) || 0;
    const pt = parseFloat(tr?.['Pt'] || tr?.pt || 0) || 0;
    const pnlStr = pnl !== 0 ? (pnl > 0 ? '+₹' : '-₹') + Math.abs(Math.round(pnl)) : '';
    const ptStr = pt !== 0 ? (pt > 0 ? '+' : '') + Math.round(pt) + 'Pt' : '';
    const pnlColor = pnl > 0 ? 'var(--green,#2ecc71)' : (pnl < 0 ? 'var(--red,#e74c3c)' : '#ffd700');
    
    const lotNum = parseFloat(tr?.Qty || tr?.qty || tr?.QTY || 0) || 0;
    const bTime = (tr?.['Buy Time'] || tr?.buy_time || '').slice(0, 5);
    const sTime = (tr?.['Sell Time'] || tr?.sell_time || '').slice(0, 5);
    const tt = String(tr?.TradeType || tr?.tradetype || tr?.['Trade Type'] || '').toLowerCase();
    const isShort = tt.includes('sell') || tt.includes('short');
    const eTime = isShort ? sTime : bTime;
    let dur = '';
    if (bTime && sTime) {
      try {
        const [h1, m1] = bTime.split(':').map(Number);
        const [h2, m2] = sTime.split(':').map(Number);
        const d1 = new Date(2000, 0, 1, h1, m1);
        const d2 = new Date(2000, 0, 1, h2, m2);
        const diff = Math.abs(d2 - d1);
        const mins = Math.round(diff / 60000);
        dur = mins < 60 ? mins + 'm' : Math.floor(mins / 60) + 'h' + (mins % 60 > 0 ? ' ' + (mins % 60) + 'm' : '');
      } catch(e) {}
    }

    sep.innerHTML =
      `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;">` +
        `<span class="gv2-sep-label" style="color:${pnlColor}">${arrow} T${idx + 1}${dateLabel ? ' ('+dateLabel+')' : ''}</span>` +
        ((pnlStr || ptStr) ? `<span class="gv2-sep-stats" style="color:${pnlColor}">${[pnlStr, ptStr].filter(Boolean).join(' · ')}</span>` : '') +
      `</div>` +
      (eTime ? `<div style="font-size:0.8rem; color:rgba(255,255,255,0.5); margin-top:2px; font-weight:500;">${eTime}${dur ? ' <span style="font-size:1.1em; font-weight:700; color:#fff; margin:0 2px;">['+dur+']</span>' : ''} <span style="color:var(--text2); margin-left:4px;">${lotNum}</span></div>` : '');
    sep.style.borderColor = '#ffd700';

    sep.addEventListener('dragover', e => { e.preventDefault(); sep.classList.add('drag-active'); });
    sep.addEventListener('dragleave', () => sep.classList.remove('drag-active'));
    sep.addEventListener('drop', async e => {
      e.preventDefault(); sep.classList.remove('drag-active');
      try {
        const draggedIndices = JSON.parse(e.dataTransfer.getData('application/json'));
        if (!draggedIndices || draggedIndices.length === 0) return;
        if (!state.gallery.selectedIndices) state.gallery.selectedIndices = new Set();
        draggedIndices.forEach(id => state.gallery.selectedIndices.add(id));
        if (typeof moveSelectedToTrade === 'function' && tr) {
          if (tr.images && tr.images.length > 0 && typeof handleReorderGalleryImagesBatch === 'function') {
            const firstUrl = tr.images[0];
            const insertAt = state.gallery.images.indexOf(firstUrl);
            await handleReorderGalleryImagesBatch(draggedIndices, insertAt, firstUrl);
          } else { await moveSelectedToTrade(state.gallery.date, tr); }
        }
      } catch (err) { console.error(err); }
    });
    if (state.gallery.selectedSeparator === idx) {
        sep.classList.add('selected-separator');
    }

    sep.addEventListener('click', (e) => {
      e.stopPropagation();
      state.gallery.collapsedSeparators = state.gallery.collapsedSeparators || new Set();
      const key = 'T' + idx;
      if (state.gallery.collapsedSeparators.has(key)) {
        state.gallery.collapsedSeparators.delete(key);
      } else {
        state.gallery.collapsedSeparators.add(key);
      }
      // Select this separator so upload button targets this trade
      state.gallery.selectedSeparator = (state.gallery.selectedSeparator === idx) ? null : idx;
      state.gallery._skipScrollIntoView = true;
      renderGallery();
    });

    return sep;
  };

  const createSpecialSeparator = (label, type) => {
    const sep = document.createElement('div');
    sep.className = 'gv2-thumb-separator';
    const isClose = type === true;
    const isCloseGlobal = type === 'CLOSE_GLOBAL';
    const isNews = type === 'NEWS';
    const sepKey = isNews ? 'NEWS' : (isCloseGlobal ? 'CLOSE_GLOBAL' : (isClose ? 'CLOSE' : 'OPEN'));
    const isCollapsed = state.gallery.collapsedSeparators?.has(sepKey);
    const arrow = isCollapsed ? '▸' : '▾';
    sep.innerHTML = `<span class="gv2-sep-label">${arrow} ${label}</span>`;
    sep.title = `${label} images section`;
    sep.style.color = isNews ? '#ffa500' : '#ffd700';
    sep.style.borderColor = isNews ? '#ffa500' : '#ffd700';

    sep.addEventListener('dragover', e => { e.preventDefault(); sep.classList.add('drag-active'); });
    sep.addEventListener('dragleave', () => sep.classList.remove('drag-active'));
    sep.addEventListener('drop', async e => {
      e.preventDefault(); sep.classList.remove('drag-active');
      try {
        const draggedIndices = JSON.parse(e.dataTransfer.getData('application/json'));
        if (!draggedIndices || draggedIndices.length === 0) return;
        if (typeof moveSelectedToDayData === 'function') {
           const dData = state.dayData[state.gallery.date];
           let arrToUse = isNews ? dData?.newsImages : (isCloseGlobal ? dData?.closeGlobalImages : (isClose ? dData?.closeImages : dData?.images));
           if (!arrToUse) {
             if (isNews) dData.newsImages = [];
             else if (isCloseGlobal) dData.closeGlobalImages = [];
             else if (isClose) dData.closeImages = [];
             else dData.images = [];
           }
           if (isCloseGlobal) {
               const curLen = (dData.closeGlobalImages || []).length;
               if (curLen >= 1 && state.gallery.selectedIndices && state.gallery.selectedIndices.size > 0) {
                   showToast('CLOSE GLOBAL can only hold 1 image.', 'error');
                   return;
               }
           }
           await moveSelectedToDayData(state.gallery.date, isNews ? 'NEWS' : (isCloseGlobal ? 'CLOSE_GLOBAL' : isClose));
        }
      } catch (err) { console.error(err); }
    });
    if (state.gallery.selectedSeparator === sepKey) {
        sep.classList.add('selected-separator');
    }

    sep.addEventListener('click', (e) => {
      e.stopPropagation();
      state.gallery.collapsedSeparators = state.gallery.collapsedSeparators || new Set();
      if (state.gallery.collapsedSeparators.has(sepKey)) {
        state.gallery.collapsedSeparators.delete(sepKey);
      } else {
        state.gallery.collapsedSeparators.add(sepKey);
      }
      state.gallery.selectedSeparator = (state.gallery.selectedSeparator === sepKey) ? null : sepKey;
      state.gallery._skipScrollIntoView = true;
      renderGallery();
    });

    return sep;
  };

  let newsGrid = null;
  if (state.gallery.date && !_filterActive3) {
    thumbs.appendChild(createSpecialSeparator('NEWS', 'NEWS'));
    if (!state.gallery.collapsedSeparators?.has('NEWS')) {
      newsGrid = document.createElement('div');
      newsGrid.className = 'gv2-news-thumbnail-grid';
      thumbs.appendChild(newsGrid);
    }
    thumbs.appendChild(createSpecialSeparator('OPEN', false));
  }

  let renderedCloseSep = false;
  let renderedCloseGlobalSep = false;

  thumbImages.forEach(({ url, globalIdx, isCurrentDate, date: itemDate, sourceRow: itemSourceRow, isNews }, currentIterIdx) => {

    // In filter mode use per-image date; in normal mode use gallery date
    const _effDate = (_filterActive3 && itemDate) ? itemDate : (state.gallery.date || '');
    const _effTrades = (_filterActive3 && itemDate && itemDate !== state.gallery.date)
      ? getTradesForDate(itemDate) : dayTrades;

    // In filter mode, use sourceRow from _filteredMeta to bypass getOwnerTradeForImageUrl's
    // single-date limitation (it only searches state.gallery.date's trades, returning null for
    // images from other dates — which incorrectly places them under OPEN).
    const ownerTrade = (_filterActive3 && itemSourceRow !== null && itemSourceRow !== undefined)
      ? (state.trades[itemSourceRow] || null)
      : getOwnerTradeForImageUrl(url);

    if (isNews && state.gallery.collapsedSeparators?.has('NEWS')) return;
    if (isNews && _filterActive3) {
      // Filter mode: handle per-date NEWS separator if it doesn't exist
      if (!_perDateRenderedSeps.has(_effDate + ':NEWS')) {
        thumbs.appendChild(createSpecialSeparator('NEWS', 'NEWS'));
        _perDateRenderedSeps.add(_effDate + ':NEWS');
        if (!state.gallery.collapsedSeparators?.has('NEWS')) {
          newsGrid = document.createElement('div');
          newsGrid.className = 'gv2-news-thumbnail-grid';
          thumbs.appendChild(newsGrid);
        }
      }
    }

    const isCloseImg = _effDate && state.dayData[_effDate]?.closeImages?.includes(url);

    // In filter mode: render OPEN separator once per date, only if that date has OPEN images
    if (_filterActive3 && _effDate && !_perDateRenderedSeps.has(_effDate + ':OPEN')) {
      if (_filteredOpenDates.has(_effDate)) {
        thumbs.appendChild(createSpecialSeparator('OPEN', false));
      }
      _perDateRenderedSeps.add(_effDate + ':OPEN'); // mark as processed regardless
    }

    if (_effTrades.length > 0 && ownerTrade && !isCloseImg) {
      const targetTradeIdx = _effTrades.indexOf(ownerTrade);
      if (targetTradeIdx >= 0) {
        let _lastIdx = _filterActive3 ? (_perDateLastIdx.get(_effDate) ?? -1) : lastTradeIdxRendered;
        while (_lastIdx < targetTradeIdx) {
          const _sepIdx = _lastIdx + 1;
          // In filter mode, only render separator if that trade has matching images
          if (!_filterActive3 || _filteredTradeIdxPerDate.get(_effDate)?.has(_sepIdx)) {
            thumbs.appendChild(createTradeSeparator(_sepIdx, _effTrades[_sepIdx], _filterActive3 ? _fmtSepDate(_effDate) : ''));
          }
          _lastIdx++;
        }
        if (_filterActive3) { _perDateLastIdx.set(_effDate, _lastIdx); }
        else { lastTradeIdxRendered = _lastIdx; }
      }
      if (state.gallery.collapsedSeparators?.has('T' + _effTrades.indexOf(ownerTrade))) return;
    } else if (_effDate && !ownerTrade && !isNews && !isCloseImg) {
      // It's an OPEN image
      if (state.gallery.collapsedSeparators?.has('OPEN')) return;
    }

    const _closeSepKey = _effDate + ':CLOSE';
    const _closeSepAlreadyDone = _filterActive3 ? _perDateRenderedSeps.has(_closeSepKey) : renderedCloseSep;
    if (isCloseImg && !_closeSepAlreadyDone) {
      // Catch up any remaining trade separators before switching to CLOSE
      let _lastIdx = _filterActive3 ? (_perDateLastIdx.get(_effDate) ?? -1) : lastTradeIdxRendered;
      if (_effTrades.length > 0) {
        while (_lastIdx < _effTrades.length - 1) {
          const _sepIdx = _lastIdx + 1;
          if (!_filterActive3 || _filteredTradeIdxPerDate.get(_effDate)?.has(_sepIdx)) {
            thumbs.appendChild(createTradeSeparator(_sepIdx, _effTrades[_sepIdx], _filterActive3 ? _fmtSepDate(_effDate) : ''));
          }
          _lastIdx++;
        }
        if (_filterActive3) { _perDateLastIdx.set(_effDate, _lastIdx); }
        else { lastTradeIdxRendered = _lastIdx; }
      }
      thumbs.appendChild(createSpecialSeparator('CLOSE', true));
      if (_filterActive3) { _perDateRenderedSeps.add(_closeSepKey); }
      else { renderedCloseSep = true; }
    }

    if (isCloseImg) {
      if (state.gallery.collapsedSeparators?.has('CLOSE')) return;
    }

    const isCloseGlobalImg = _effDate && state.dayData[_effDate]?.closeGlobalImages?.includes(url);
    const _closeGlobalSepKey = _effDate + ':CLOSE_GLOBAL';
    const _closeGlobalSepAlreadyDone = _filterActive3 ? _perDateRenderedSeps.has(_closeGlobalSepKey) : renderedCloseGlobalSep;

    if (isCloseGlobalImg && !_closeGlobalSepAlreadyDone) {
      if (!_closeSepAlreadyDone) {
        // Just in case no closeImage existed to trigger the CLOSE separator
        thumbs.appendChild(createSpecialSeparator('CLOSE', true));
        if (_filterActive3) { _perDateRenderedSeps.add(_closeSepKey); }
        else { renderedCloseSep = true; }
      }
      thumbs.appendChild(createSpecialSeparator('CLOSE GLOBAL', 'CLOSE_GLOBAL'));
      if (_filterActive3) { _perDateRenderedSeps.add(_closeGlobalSepKey); }
      else { renderedCloseGlobalSep = true; }
    }

    if (isCloseGlobalImg) {
        if (state.gallery.collapsedSeparators?.has('CLOSE_GLOBAL')) return;
    }

    const wrap = document.createElement('div'); wrap.className = 'gv2-thumb-wrap'; wrap.draggable = !IS_TOUCH_DEVICE;
    wrap.dataset.globalIdx = globalIdx;

    if (highlightParents.has(url)) {
      wrap.classList.add('grp-parent');
    } else if (highlightSubImages.has(url)) {
      wrap.classList.add('grp-child');
      const parentUrl = subImageToParentMap.get(url);
      let siblings = [];
      const ownerT = getOwnerTradeForImageUrl(parentUrl);
      if (ownerT && ownerT.subImages && ownerT.subImages[parentUrl]) siblings = ownerT.subImages[parentUrl];
      else if (state.gallery.date && state.dayData[state.gallery.date]?.subImages?.[parentUrl]) siblings = state.dayData[state.gallery.date].subImages[parentUrl];

      if (siblings.length > 0 && siblings[siblings.length - 1] === url) {
        wrap.classList.add('grp-child-last');
      }
    }

    const isVidThumb = typeof isVideoUrl === 'function' && isVideoUrl(url);
    let t;
    if (isVidThumb) {
      t = document.createElement('video');
      t.src = resolveImageUrl(url);
      t.preload = 'metadata';
      t.muted = true;
      t.loop = true;
      t.playsInline = true;
      t.style.objectFit = 'cover';
      t.className = 'gv2-thumb gv2-thumb-video' + (globalIdx === currentIndex ? ' active' : '') + (state.gallery.selectedIndices?.has(globalIdx) ? ' selected-thumb' : '');
      t.title = 'Video recording';
      t.addEventListener('mouseenter', () => { t.play().catch(()=>{}); });
      t.addEventListener('mouseleave', () => { t.pause(); });
      
      const vIcon = document.createElement('span');
      vIcon.className = 'gv2-thumb-video-icon';
      vIcon.innerHTML = '&#9654;'; // Play symbol
      vIcon.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:#fff; font-size:1.2rem; text-shadow:0 0 8px rgba(0,0,0,0.8); pointer-events:none; z-index:2;';
      wrap.appendChild(vIcon);
    } else {
      t = document.createElement('img');
      t.src = resolveImageUrl(url);
      t.className = 'gv2-thumb' + (globalIdx === currentIndex ? ' active' : '') + (state.gallery.selectedIndices?.has(globalIdx) ? ' selected-thumb' : '');
      t.onerror = () => {
        const idx = state.gallery.images.indexOf(url);
        if (idx < 0) { wrap.style.display = 'none'; return; }
        t.style.opacity = '0.3';
        t.title = 'Image could not be loaded';
      };
    }
    // Add visual distinction for expanded/collapsed trade in filter mode
    if (Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length > 0) {
      const tradeKey = (_effDate || '') + ':' + (ownerTrade ? itemSourceRow : 'OPENCLOSE');
      if (state.gallery.expandedFilterTrades?.has(tradeKey)) {
        wrap.classList.add('expanded-trade');
      } else {
        // Find if this is a singleton representant of a trade
        const meta = state.gallery._filteredMeta?.[globalIdx];
        if (meta?.isCollapsedTrade) wrap.classList.add('collapsed-trade-preview');
      }
    }

    t.addEventListener('click', (e) => {
      // Initialize if needed
      if (!state.gallery.selectedIndices) state.gallery.selectedIndices = new Set();
      
      const lastIdx = state.gallery.lastClickedIdx ?? currentIndex;

      // TRADE EXPANSION TOGGLE (Ctrl+Click in Filter Mode)
      if ((e.ctrlKey || e.metaKey) && Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        const tradeKey = (_effDate || '') + ':' + (ownerTrade ? itemSourceRow : 'OPENCLOSE');
        state.gallery.expandedFilterTrades = state.gallery.expandedFilterTrades || new Set();
        if (state.gallery.expandedFilterTrades.has(tradeKey)) {
          state.gallery.expandedFilterTrades.delete(tradeKey);
        } else {
          state.gallery.expandedFilterTrades.add(tradeKey);
        }
        applyGalleryImageScopeByTagFilter();
        renderGallery();
        return;
      }

      if (e.shiftKey) {
          // Range selection
          const start = Math.min(lastIdx, globalIdx);
          const end = Math.max(lastIdx, globalIdx);
          for (let i = start; i <= end; i++) {
              state.gallery.selectedIndices.add(i);
          }
          state.gallery.lastClickedIdx = globalIdx;
          renderGallery();
          return;
      }
      
      if (e.ctrlKey || e.metaKey) {
          // Individual toggle (Standard behavior)
          if (state.gallery.selectedIndices.has(globalIdx)) state.gallery.selectedIndices.delete(globalIdx);
          else state.gallery.selectedIndices.add(globalIdx);
          state.gallery.lastClickedIdx = globalIdx;
          renderGallery();
          return;
      }

      // Normal click: select only this
      state.gallery.selectedIndices = new Set([globalIdx]);
      state.gallery.currentIndex = globalIdx;
      state.gallery.lastClickedIdx = globalIdx;
      
      // If double click or secondary action? We'll just stick to single click for navigation
      renderGallery();
    });
    t.addEventListener('contextmenu', async e => {
      e.preventDefault();
      if (!state.gallery.selectedIndices) state.gallery.selectedIndices = new Set();
      if (!state.gallery.selectedIndices.has(globalIdx)) {
        state.gallery.selectedIndices = new Set([globalIdx]);
        renderGallery();
      }
      if (typeof showGalleryContextMenu === 'function') {
        showGalleryContextMenu(e.clientX, e.clientY);
      }
    });

    t.addEventListener('touchend', e => {
      if (IS_TOUCH_DEVICE) {
        e.preventDefault();
        state.gallery.currentIndex = globalIdx;
        renderGallery();
      }
    }, { passive: false });

    if (isCurrentDate) {
      wrap.addEventListener('dragstart', e => {
        dragFromIndex = globalIdx;
        if (!state.gallery.selectedIndices) state.gallery.selectedIndices = new Set();
        if (!state.gallery.selectedIndices.has(globalIdx)) {
          state.gallery.selectedIndices = new Set([globalIdx]);
          renderGallery();
        }
        wrap.classList.add('dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('application/json', JSON.stringify(Array.from(state.gallery.selectedIndices)));
        }
      });
      wrap.addEventListener('dragend', () => {
        dragFromIndex = -1; wrap.classList.remove('dragging');
        thumbs.querySelectorAll('.drag-over, .drag-over-left, .drag-over-right').forEach(el => el.classList.remove('drag-over', 'drag-over-left', 'drag-over-right'));
      });
      wrap.addEventListener('dragover', e => {
        e.preventDefault();
        if (state.gallery.selectedIndices?.has(globalIdx)) return;

        const rect = wrap.getBoundingClientRect();
        const third = rect.width / 3;
        const x = e.clientX - rect.left;

        wrap.classList.remove('drag-over', 'drag-over-left', 'drag-over-right');
        if (x < third) {
          wrap.classList.add('drag-over-left');
        } else if (x > 2 * third) {
          wrap.classList.add('drag-over-right');
        } else {
          wrap.classList.add('drag-over'); // middle means sub-image
        }
      });
      wrap.addEventListener('dragleave', () => wrap.classList.remove('drag-over', 'drag-over-left', 'drag-over-right'));
      wrap.addEventListener('drop', async e => {
        e.preventDefault();
        const isLeft = wrap.classList.contains('drag-over-left');
        const isRight = wrap.classList.contains('drag-over-right');
        const isMiddle = wrap.classList.contains('drag-over');
        wrap.classList.remove('drag-over', 'drag-over-left', 'drag-over-right');

        if (state.gallery.selectedIndices?.has(globalIdx)) return;

        try {
          const draggedIndices = JSON.parse(e.dataTransfer.getData('application/json'));
          if (!draggedIndices || draggedIndices.length === 0) return;

          if (isMiddle) {
            if (typeof handleDropAsSubImage === 'function') {
              await handleDropAsSubImage(draggedIndices, globalIdx);
            }
          } else {
            let insertAt = globalIdx;
            if (isRight) insertAt += 1;
            if (typeof handleReorderGalleryImagesBatch === 'function') {
              await handleReorderGalleryImagesBatch(draggedIndices, insertAt, url);
            }
          }
        } catch (err) {
          console.error(err);
        }
      });
    }

    const del = document.createElement('button'); del.type = 'button';
    del.className = 'gv2-thumb-del'; del.textContent = '×'; del.title = 'Remove image';
    del.addEventListener('click', async e => { e.stopPropagation(); await removeGalleryImageAt(globalIdx); });

    if (globalIdx === 0 && date) {
      const videoUrl = state.dayData[date]?.video;
      if (videoUrl) {
        const vi = document.createElement('span'); vi.className = 'gv2-thumb-video-icon'; vi.textContent = '▶';
        vi.style.pointerEvents = 'auto'; vi.style.cursor = 'pointer';
        vi.addEventListener('click', e => { e.stopPropagation(); window.open(videoUrl, '_blank'); });
        wrap.appendChild(vi);
      }
    }

    // ownerTrade already defined at the start of loop for separators
    let subCount = 0;
    let groupName = null;
    if (ownerTrade?.subImages?.[url]?.length) {
      subCount = ownerTrade.subImages[url].length;
      groupName = ownerTrade.groupNames?.[url];
    } else {
      const grpDate = itemDate || state.gallery.date;
      if (grpDate && state.dayData[grpDate]?.subImages?.[url]?.length) {
        subCount = state.dayData[grpDate].subImages[url].length;
        groupName = state.dayData[grpDate].groupNames?.[url];
      }
    }

    wrap.appendChild(t); wrap.appendChild(del);

    // Audio indicator badge
    if (typeof getAudioForImage === 'function' && getAudioForImage(url, itemDate || state.gallery.date || '')) {
      const ai = document.createElement('span');
      ai.className = 'gv2-thumb-audio-icon';
      ai.textContent = '▶';
      ai.title = 'Audio note attached';
      wrap.appendChild(ai);
    }

    // Video indicator badge
    if (typeof getVideoForImage === 'function' && getVideoForImage(url, itemDate || state.gallery.date || '')) {
      const vi = document.createElement('span');
      vi.className = 'gv2-thumb-video-icon';
      vi.textContent = '📹';
      vi.title = 'Video recording attached';
      wrap.appendChild(vi);
    }

    if (state.gallery.showTime && state.gallery.imageTimes && state.gallery.imageTimes[url]) {
      const timeLbl = document.createElement('div');
      timeLbl.textContent = state.gallery.imageTimes[url];
      timeLbl.style.position = 'absolute';
      timeLbl.style.bottom = '20px';
      timeLbl.style.left = '50%';
      timeLbl.style.transform = 'translateX(-50%)';
      timeLbl.style.background = 'rgba(0,0,0,0.7)';
      timeLbl.style.color = '#fff';
      timeLbl.style.fontSize = '0.65rem';
      timeLbl.style.padding = '1px 3px';
      timeLbl.style.borderRadius = '3px';
      timeLbl.style.pointerEvents = 'none';
      timeLbl.style.whiteSpace = 'nowrap';
      timeLbl.style.zIndex = '10';
      wrap.appendChild(timeLbl);
    }

    if (groupName) {
      const nameLbl = document.createElement('div');
      nameLbl.textContent = groupName;
      nameLbl.style.position = 'absolute';
      nameLbl.style.top = '-18px';
      nameLbl.style.left = '50%';
      nameLbl.style.transform = 'translateX(-50%)';
      nameLbl.style.background = 'transparent';
      nameLbl.style.color = '#ff9800';
      nameLbl.style.fontSize = '0.7rem';
      nameLbl.style.fontWeight = 'bold';
      nameLbl.style.whiteSpace = 'nowrap';
      nameLbl.style.pointerEvents = 'none';
      nameLbl.style.zIndex = '10';
      wrap.appendChild(nameLbl);
    }

    // Date badge — lower-right of thumbnail, shown in filter mode or all-images mode
    const _filterActive2 = Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length > 0;
    if (itemDate && (_filterActive2 || !state.gallery.date)) {
      const _d = new Date(itemDate + 'T00:00:00');
      const _months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const _days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const dateBadge = document.createElement('div');
      dateBadge.textContent = _months[_d.getMonth()] + ' ' + String(_d.getDate()).padStart(2,'0') + ' ' + _days[_d.getDay()];
      dateBadge.style.cssText = 'position:absolute; bottom:3px; right:3px; background:rgba(0,0,0,0.72); color:#ddd; font-size:0.58rem; padding:1px 4px; border-radius:3px; pointer-events:none; white-space:nowrap; z-index:11; letter-spacing:0.01em;';
      wrap.appendChild(dateBadge);
    }

    if (subCount > 0) {
      const isExpanded = state.gallery.expandedGroups?.has(url);
      const badge = document.createElement('div');
      badge.textContent = (isExpanded ? '▾' : '+') + subCount;
      badge.style.position = 'absolute';
      badge.style.bottom = '4px';
      badge.style.right = '4px';
      badge.style.background = isExpanded ? 'var(--green, #4caf50)' : 'var(--blue)';
      badge.style.color = '#fff';
      badge.style.fontSize = '0.7rem';
      badge.style.padding = '2px 6px';
      badge.style.borderRadius = '10px';
      badge.style.fontWeight = 'bold';
      badge.style.boxShadow = '0 2px 4px rgba(0,0,0,0.5)';
      badge.style.cursor = 'pointer';
      badge.style.zIndex = '10';
      badge.addEventListener('click', e => {
        e.stopPropagation();
        if (typeof toggleGalleryGroupExpand === 'function') toggleGalleryGroupExpand(url);
      });
      wrap.appendChild(badge);
    }

    if (isNews && newsGrid) {
      newsGrid.appendChild(wrap);
    } else {
      thumbs.appendChild(wrap);
    }
  });

  // Append any remaining separators for trailing empty trades if CLOSE hasn't triggered it
  if (!_filterActive3 && dayTrades.length > 0) {
    while (lastTradeIdxRendered < dayTrades.length - 1) {
      thumbs.appendChild(createTradeSeparator(lastTradeIdxRendered + 1));
      lastTradeIdxRendered++;
    }
  }

  if (!_filterActive3 && !renderedCloseSep && state.gallery.date) {
    thumbs.appendChild(createSpecialSeparator('CLOSE', true));
  }
  if (!_filterActive3 && !renderedCloseGlobalSep && state.gallery.date) {
    thumbs.appendChild(createSpecialSeparator('CLOSE GLOBAL', 'CLOSE_GLOBAL'));
  }

  const btnWrap = document.createElement('div');
  btnWrap.className = 'gv2-thumb-wrap';
  btnWrap.style.display = 'flex';
  btnWrap.style.alignItems = 'center';
  btnWrap.style.justifyContent = 'center';
  btnWrap.style.background = 'var(--surface2)';
  btnWrap.style.border = '2px dashed var(--border2)';
  btnWrap.style.borderRadius = '5px';
  btnWrap.style.width = 'calc(var(--thumb-panel-w, 74px) - 60px)';
  btnWrap.style.height = 'calc((var(--thumb-panel-w, 74px) - 18px) * 0.62)';
  btnWrap.style.cursor = 'pointer';
  btnWrap.style.fontSize = '1.5rem';
  btnWrap.style.color = 'var(--text2)';
  btnWrap.textContent = '+';
  btnWrap.title = 'Add blank image';
  btnWrap.onclick = async () => {
    try {
      const cvs = document.createElement('canvas');
      cvs.width = 1920; cvs.height = 1080;
      const c = cvs.getContext('2d');
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, 1920, 1080);

      cvs.toBlob(async (blob) => {
        if (!blob) return;
        try {
          const file = new File([blob], 'blank_page_' + Date.now() + '.png', { type: 'image/png' });
          const q = (state.gallery.selectedSeparator === 'NEWS') ? 0.25 : null;
          const rv = await imageService.uploadImage(file, q);
          if (rv.url) {
            const newUrl = rv.url;
            
            // Placement logic based on selected separator
            const selSep = state.gallery.selectedSeparator;
            const dayKey = state.gallery.date;
            let targetObj = null;
            let targetArray = 'images';

            if (selSep === 'NEWS') {
                targetObj = state.dayData[dayKey];
                targetArray = 'newsImages';
            } else if (selSep === 'OPEN') {
                targetObj = state.dayData[dayKey];
                targetArray = 'images';
            } else if (selSep === 'CLOSE') {
                targetObj = state.dayData[dayKey];
                targetArray = 'closeImages';
            } else if (selSep === 'CLOSE_GLOBAL') {
                targetObj = state.dayData[dayKey];
                targetArray = 'closeGlobalImages';
            } else if (typeof selSep === 'number') {
                const dayTrades = getTradesForDate(dayKey);
                targetObj = dayTrades[selSep];
                targetArray = 'images';
            }

            if (!targetObj && dayKey) {
                // Fallback to day level or current trade
                targetObj = getOwnerTradeForGalleryImage() || state.dayData[dayKey];
            }

            if (targetObj) {
                targetObj[targetArray] = targetObj[targetArray] || [];
                targetObj[targetArray].push(newUrl);
            }

            state.gallery.images = state.gallery.images || [];
            state.gallery.images.push(newUrl);
            state.gallery.currentIndex = state.gallery.images.length - 1;
            
            await saveTrades();
            renderGallery();
            showToast('Blank image added at selected location', 'success');
          }
        } catch (err) { console.error('Failed blank page upload', err); }
      }, 'image/png');
    } catch (e) { console.error('Failed blank page generation', e); }
  };
  thumbs.appendChild(btnWrap);

  if (thumbs.children.length > 0) {
    if (state.gallery._skipScrollIntoView) {
      setTimeout(() => {
        if (thumbs) {
          thumbs.scrollTop = savedScrollTop;
          thumbs.scrollLeft = savedScrollLeft;
        }
      }, 0);
    } else {
      const activeThumb = thumbs.querySelector('.gv2-thumb.active');
      if (activeThumb) {
        setTimeout(() => {
          activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'center' });
        }, 50);
      }

    }
  }
  state.gallery._skipScrollIntoView = false;

  // Rubber-band selection + pan — delegated to gallery-rubberband.js
  bindGalleryRubberbandAndPan(thumbs);

  if (!state._isSyncUpdate && typeof syncGalleryToOthers === 'function') {
    syncGalleryToOthers();
  }

  // REFRESH GRID VIEW IF OPEN
  if (typeof isGridViewOpen === 'function' && isGridViewOpen() && typeof renderGridContent === 'function') {
    renderGridContent();
  }

  // ── REFRESH MTM PANEL IF OPEN ──────────────────────────────────────────
  const mtmPanel = document.getElementById('gv2-mtm-panel');
  if (mtmPanel && mtmPanel.style.display !== 'none') {
    if (typeof renderGalleryMtmPanel === 'function') renderGalleryMtmPanel(mtmPanel);
  }
}
