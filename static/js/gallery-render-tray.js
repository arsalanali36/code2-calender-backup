// gallery-render-tray.js — Close-Global-Tray rendering (draggable tray + zoomable markers)
// Called by renderGallery() in gallery-render.js

/**
 * Capture the currently visible area of a split-view panel as a JPEG data URL.
 * Loads a fresh CORS-anonymous copy of the image so canvas.toDataURL() works
 * even for cross-origin images (Cloudinary etc.).
 * Returns data URL string, or null on failure.
 */
async function _captureSplitPanel(panelId, imgId) {
  const panel = document.getElementById(panelId);
  const img   = document.getElementById(imgId);
  if (!panel || !img || !img.naturalWidth || !img.src || img.src.endsWith('/')) return null;
  try {
    const panelRect = panel.getBoundingClientRect();
    const imgRect   = img.getBoundingClientRect();
    const W = Math.round(panelRect.width);
    const H = Math.round(panelRect.height);
    if (W < 1 || H < 1) return null;

    // Load a fresh CORS-enabled copy so canvas stays untainted
    const corsImg = new Image();
    corsImg.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      corsImg.onload  = resolve;
      corsImg.onerror = reject;
      const sep = img.src.includes('?') ? '&' : '?';
      corsImg.src = img.src + sep + '_cb=' + Date.now();
    });

    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    ctx.drawImage(corsImg,
      imgRect.left - panelRect.left,
      imgRect.top  - panelRect.top,
      imgRect.width,
      imgRect.height
    );
    ctx.restore();
    return canvas.toDataURL('image/jpeg', 0.92);
  } catch(e) {
    console.warn('[_captureSplitPanel] CORS capture failed:', e);
    return null;
  }
}

function renderCloseGlobalTray(curUrl) {
  // Cleanup old tray / markers
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

  if (!closeGlobalDateKey || !curUrl) return;

  const tradesForDay = getTradesForDate(closeGlobalDateKey);
  if (tradesForDay.length === 0) return;

  const imgContainer = document.getElementById('gallery-img-wrapper') || document.querySelector('.gv2-img-area');
  if (!imgContainer) return;

  if (getComputedStyle(imgContainer).position === 'static') imgContainer.style.position = 'relative';

  // 2. Fixed Source Tray
  const tray = document.createElement('div');
  tray.id = 'close-global-tray';
  tray.style.position = 'absolute';

  const savedTray = JSON.parse(localStorage.getItem('tj_gv2_cg_tray') || '{"bottom":"20px","left":"50%","dir":"row"}');
  tray.style.bottom = savedTray.bottom;
  tray.style.left = savedTray.left;
  tray.style.top = savedTray.top || 'auto';
  tray.style.right = savedTray.right || 'auto';
  tray.style.flexDirection = savedTray.dir;
  const isMulti = tradesForDay.length > 10;
  tray.style.display = isMulti ? 'grid' : 'flex';
  if (isMulti) {
      if (tray.style.flexDirection === 'column') {
          tray.style.gridTemplateColumns = 'repeat(2, 1fr)';
      } else {
          tray.style.gridTemplateRows = 'repeat(2, 1fr)';
          tray.style.gridAutoFlow = 'column';
      }
  }

  tray.style.gap = '8px';
  tray.style.padding = '8px 12px';
  tray.style.background = 'rgba(15,15,20,0.85)';
  tray.style.backdropFilter = 'blur(10px)';
  tray.style.borderRadius = '24px';
  tray.style.border = '1px solid rgba(255,255,255,0.1)';
  tray.style.zIndex = '20000';
  tray.style.cursor = 'move';
  if (savedTray.left === '50%') tray.style.transform = 'translateX(-50%)';

  // Tray drag — GPU translate3d, mouse + touch
  let trayDragging = false, tStartX, tStartY, tCurTx = 0, tCurTy = 0;
  let _tTouchId = null, _tTouchPending = false, _tTouchSX = 0, _tTouchSY = 0;
  const T_THRESH = 6;

  const _savedTx = savedTray.tx || 0, _savedTy = savedTray.ty || 0;
  tCurTx = _savedTx; tCurTy = _savedTy;
  tray.style.transform = savedTray.left === '50%'
      ? `translateX(-50%) translate3d(${tCurTx}px,${tCurTy}px,0)`
      : `translate3d(${tCurTx}px,${tCurTy}px,0)`;

  const _applyTray = (cx, cy) => {
      const SNAP = 120;
      const ulp = document.getElementById('gv2-unified-left-panel');
      const ulpRight = ulp ? ulp.getBoundingClientRect().right : 0;
      const tr = tray.getBoundingClientRect();
      const tMidX = tr.left + tr.width / 2;
      const nearLeft  = tMidX < ulpRight + SNAP || cx < ulpRight + SNAP;
      const nearRight = tMidX > window.innerWidth - SNAP || cx > window.innerWidth - SNAP;
      const isVertical = (nearLeft || nearRight);
      tray.style.flexDirection = isVertical ? 'column' : 'row';

      if (tradesForDay.length > 10) {
          tray.style.display = 'grid';
          if (isVertical) {
              tray.style.gridTemplateColumns = 'repeat(2, 1fr)';
              tray.style.gridTemplateRows = '';
              tray.style.gridAutoFlow = 'row';
          } else {
              tray.style.gridTemplateRows = 'repeat(2, 1fr)';
              tray.style.gridTemplateColumns = '';
              tray.style.gridAutoFlow = 'column';
          }
      } else {
          tray.style.display = 'flex';
      }
  };

  const _tApplyTranslate = () => {
      tray.style.transform = `translate3d(${tCurTx}px,${tCurTy}px,0)`;
  };

  const _tStartDrag = (cx, cy, target) => {
      if (target !== tray && !target.classList.contains('cg-tray-drag-handle')) return false;
      trayDragging = true;
      tStartX = cx; tStartY = cy;
      tray.style.willChange = 'transform';
      tray.style.bottom = 'auto'; tray.style.right = 'auto';
      tray.style.left = tray.getBoundingClientRect().left + 'px';
      tray.style.top  = tray.getBoundingClientRect().top  + 'px';
      tCurTx = 0; tCurTy = 0;
      tray.style.transform = 'translate3d(0,0,0)';
      document.body.style.userSelect = 'none';
      return true;
  };

  const _tDoDrag = (cx, cy) => {
      if (!trayDragging) return;
      tCurTx += cx - tStartX; tCurTy += cy - tStartY;
      tStartX = cx; tStartY = cy;
      _tApplyTranslate();
      _applyTray(cx, cy);
  };

  const _tEndDrag = () => {
      if (!trayDragging) return;
      trayDragging = false;
      tray.style.willChange = '';
      document.body.style.userSelect = '';
      const finalRect = tray.getBoundingClientRect();
      tray.style.left = finalRect.left + 'px';
      tray.style.top  = finalRect.top  + 'px';
      tray.style.transform = 'translate3d(0,0,0)';
      tCurTx = 0; tCurTy = 0;
      localStorage.setItem('tj_gv2_cg_tray', JSON.stringify({
          top: finalRect.top + 'px', left: finalRect.left + 'px',
          bottom: 'auto', right: 'auto',
          dir: tray.style.flexDirection, tx: 0, ty: 0
      }));
  };

  // Mouse
  tray.addEventListener('mousedown', (e) => {
      if (_tStartDrag(e.clientX, e.clientY, e.target)) e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => _tDoDrag(e.clientX, e.clientY));
  document.addEventListener('mouseup', _tEndDrag);

  // Touch (iPad)
  document.addEventListener('touchstart', (e) => {
      if (!tray.contains(e.target)) return;
      const t = e.touches[0];
      _tTouchId = t.identifier; _tTouchPending = true;
      _tTouchSX = t.clientX; _tTouchSY = t.clientY;
  }, { passive: true, capture: true });

  document.addEventListener('touchmove', (e) => {
      if (!_tTouchPending && !trayDragging) return;
      let t = null;
      for (let i = 0; i < e.touches.length; i++) {
          if (e.touches[i].identifier === _tTouchId) { t = e.touches[i]; break; }
      }
      if (!t) return;
      if (_tTouchPending) {
          const dx = Math.abs(t.clientX - _tTouchSX), dy = Math.abs(t.clientY - _tTouchSY);
          if (dx > T_THRESH || dy > T_THRESH) {
              _tTouchPending = false;
              _tStartDrag(t.clientX, t.clientY, tray);
              tStartX = t.clientX; tStartY = t.clientY;
          } else return;
      }
      if (e.cancelable) e.preventDefault();
      _tDoDrag(t.clientX, t.clientY);
  }, { passive: false });

  document.addEventListener('touchend', () => { _tTouchPending = false; _tTouchId = null; _tEndDrag(); });

  // Keep tray in bounds on panel resize
  const ensureTrayInBounds = () => {
      const cRect = imgContainer.getBoundingClientRect();
      const tRect = tray.getBoundingClientRect();
      let nudge = false, newL = tray.offsetLeft, newT = tray.offsetTop;
      if (tRect.right  > cRect.right  - 10) { newL = cRect.width  - tRect.width  - 20; nudge = true; }
      if (tRect.bottom > cRect.bottom - 10) { newT = cRect.height - tRect.height - 20; nudge = true; }
      if (tRect.left   < cRect.left   + 10) { newL = 20; nudge = true; }
      if (tRect.top    < cRect.top    + 10) { newT = 20; nudge = true; }
      if (nudge) {
          tray.style.left = newL + 'px'; tray.style.top = newT + 'px';
          tray.style.bottom = 'auto'; tray.style.right = 'auto';
      }
  };
  const trayObserver = new ResizeObserver(() => ensureTrayInBounds());
  trayObserver.observe(imgContainer);

  imgContainer.appendChild(tray);

  // Close Global Jump Button
  const cgJumpBtn = document.createElement('button');
  cgJumpBtn.className = 'close-global-nav-btn cg-jump';
  cgJumpBtn.innerHTML = '🌐';
  cgJumpBtn.style.cssText = `
      background:rgba(99,102,241,0.12); color:#818cf8;
      border:1px solid rgba(99,102,241,0.3); backdrop-filter:blur(4px);
      border-radius:50%; width:34px; height:34px; font-size:1.2rem;
      cursor:pointer; display:flex; align-items:center; justify-content:center;
      transition:all 0.2s ease; box-shadow:0 4px 12px rgba(0,0,0,0.25),inset 0 0 8px rgba(99,102,241,0.05);
  `;
  cgJumpBtn.title = 'Jump to Close Global Summary';
  cgJumpBtn.onmouseenter = () => { cgJumpBtn.style.background = 'rgba(99,102,241,0.25)'; cgJumpBtn.style.borderColor = 'rgba(99,102,241,0.5)'; cgJumpBtn.style.transform = 'scale(1.08)'; };
  cgJumpBtn.onmouseleave = () => { cgJumpBtn.style.background = 'rgba(99,102,241,0.12)'; cgJumpBtn.style.borderColor = 'rgba(99,102,241,0.3)'; cgJumpBtn.style.transform = 'scale(1)'; };

  const dayDataObj = state.dayData[closeGlobalDateKey];
  const hasCg = dayDataObj?.closeGlobalImages?.length > 0;

  if (!hasCg) {
      cgJumpBtn.style.opacity = '0.35';
      cgJumpBtn.style.filter = 'grayscale(1) brightness(0.7)';
      cgJumpBtn.style.cursor = 'default';
      cgJumpBtn.title = 'No Close Global summary available for this day';
  }

  cgJumpBtn.onclick = (e) => {
      e.stopPropagation();
      if (!hasCg) { if (typeof showToast === 'function') showToast('Is din koi Close Global summary images nahi hain', 'info'); return; }
      const firstUrl = dayDataObj.closeGlobalImages[0];
      const idx = (state.gallery.images || []).indexOf(firstUrl);
      if (idx !== -1) { state.gallery.currentIndex = idx; renderGallery(); }
  };
  tray.appendChild(cgJumpBtn);

  // Split View Toggle Button in Tray
  const splitBtn = document.createElement('button');
  splitBtn.className = 'close-global-nav-btn split-toggle-btn';
  splitBtn.innerHTML = '⊞';
  splitBtn.style.cssText = `
      background:rgba(139, 92, 246, 0.12); color:#a78bfa;
      border:1px solid rgba(139, 92, 246, 0.3); backdrop-filter:blur(4px);
      border-radius:50%; width:34px; height:34px; font-size:1.1rem;
      cursor:pointer; display:flex; align-items:center; justify-content:center;
      transition:all 0.2s ease; box-shadow:0 4px 12px rgba(0,0,0,0.25);
  `;
  splitBtn.title = 'Toggle Split View';
  splitBtn.onclick = (e) => {
      e.stopPropagation();
      if (typeof toggleSplitView === 'function') toggleSplitView();
  };
  tray.appendChild(splitBtn);

  // Trade buttons
  const allAbsPnls = tradesForDay.map(tr => Math.abs(parseFloat(tr['Net P/L'] || tr.net_pnl || 0)));
  const maxAbsPnl = Math.max(...allAbsPnls, 1);

  tradesForDay.forEach((tr, idx) => {
      const pnl = parseFloat(tr['Net P/L'] || tr.net_pnl || 0);
      const absPnl = Math.abs(pnl);
      const timeStr = tr['Entry Time'] || tr['entry_time'] || tr['entryTime'] || tr['Buy Time'] || tr['Time'] || tr['time'] || 'N/A';
      const pnlRounded = Math.round(pnl);
      const pnlDisplay = (pnlRounded >= 0 ? '+' : '') + pnlRounded.toLocaleString('en-IN');
      const tooltip = `Trade #${idx + 1}\nTime: ${timeStr}\nP&L: ₹${pnlDisplay}`;
      const markerColor = pnl > 0 ? '#2ecc71' : (pnl < 0 ? '#e74c3c' : '#58a6ff');

      // Proportional Sizing
      const minS = 20, maxS = 32;
      const scaleFactor = maxAbsPnl > 0 ? Math.pow(absPnl / maxAbsPnl, 0.5) : 0;
      const size = minS + (maxS - minS) * scaleFactor;
      const fontSize = 0.65 + (0.25 * scaleFactor);

      // Tray button (source)
      const activeTrade = typeof getOwnerTradeForImageUrl === 'function' ? getOwnerTradeForImageUrl(curUrl) : null;
      const isActive = (tr === activeTrade);

      // --- Progress Indicator (Ref Card check) ---
      const dData = state.dayData[closeGlobalDateKey] || {};
      const refCard = dData.tradeRefCards?.[idx];
      const isRefReady = !!(refCard && refCard.index);

      const sourceBtn = document.createElement('button');
      sourceBtn.className = 'close-global-nav-btn cg-tray-btn';
      if (isActive) sourceBtn.classList.add('active');
      if (!tr.images || tr.images.length === 0) sourceBtn.classList.add('no-img');
      sourceBtn.textContent = String(idx + 1);
      
      let styleStr = `background:${markerColor}; color:#fff; border:none;
          border-radius:50%; width:${size}px; height:${size}px; font-size:${fontSize}rem; font-weight:900;
          cursor:pointer; box-shadow:0 4px 10px rgba(0,0,0,0.3); transition: all 0.2s ease;
          display: flex; align-items: center; justify-content: center; position:relative;`;
      
      if (isActive) {
          styleStr += `outline: 3px solid #fff; outline-offset: 2px; box-shadow: 0 0 15px ${markerColor}, 0 4px 10px rgba(0,0,0,0.6); transform: scale(1.1);`;
      }
      
      sourceBtn.style.cssText = styleStr;
      sourceBtn.title = tooltip + (isActive ? ' (ACTIVE)' : '') + (isRefReady ? ' [REF READY]' : '');

      // Dot for Ref Ready
      if (isRefReady) {
          const dot = document.createElement('div');
          dot.className = 'ref-dot'; // Standardized class name for real-time removal
          dot.style.cssText = `position:absolute; bottom:-1px; right:-1px; width:8px; height:8px; 
              background:#4ade80; border:1px solid #000; border-radius:50%; box-shadow: 0 0 5px #4ade80; pointer-events:none;`;
          sourceBtn.appendChild(dot);
      }

      tray.appendChild(sourceBtn);

      sourceBtn.onclick = (e) => {
          e.stopPropagation();
          
          // Ensure the separator is selected and trade is expanded for auto-scroll
          state.gallery.selectedSeparator = idx;
          state.gallery._forceScrollToSeparator = true; 
          if (state.gallery.collapsedSeparators) {
              state.gallery.collapsedSeparators.delete('T' + idx);
          }

          // Jump to trade in gallery if images exist
          if (tr.images && tr.images.length > 0) {
              const galleryImages = state.gallery.images || [];
              const firstVisibleImg = tr.images.find(url => galleryImages.includes(url));
              if (firstVisibleImg) {
                  const gIdx = galleryImages.indexOf(firstVisibleImg);
                  if (gIdx !== -1) {
                      state.gallery.currentIndex = gIdx;
                  }
              } else if (state.gallery.tagFilter?.length) {
                  showToast('This trade has no images matching the current filter', 'info');
              }
          }
          
          // Always re-render to trigger thumb panel auto-scroll
          renderGallery();

          if (typeof openTradeSidebar === 'function') openTradeSidebar(tr);
      };

      // Right-click: Mini Action Panel (including new Strategy Lab option)
      sourceBtn.oncontextmenu = (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const oldMenu = document.getElementById('gv2-tray-ctx-menu');
          if (oldMenu) oldMenu.remove();

          const menu = document.createElement('div');
          menu.id = 'gv2-tray-ctx-menu';
          menu.style.cssText = `
              position: fixed; left: ${e.clientX}px; top: ${e.clientY}px;
              background: rgba(22, 22, 28, 0.95); border: 1px solid rgba(255,255,255,0.12);
              border-radius: 10px; padding: 5px; z-index: 10000;
              box-shadow: 0 15px 40px rgba(0,0,0,0.7); display: flex; flex-direction: column; gap: 2px;
              min-width: 175px; backdrop-filter: blur(15px); animation: gv2-scale-in 0.15s ease-out;
          `;

          const inst = tr.instrument || tr.Symbol || tr.symbol || 'Nifty 50 (^NSEI)';
          const dayDate = typeof extractDateFromTrade === 'function' ? normalizeDate(extractDateFromTrade(tr)) : (tr.Date || '');
          const entryT = tr.entry_time || (tr['Entry Time'] ? Math.floor(new Date(tr['Entry Time']).getTime() / 1000) : null);

          const createItem = (text, icon, color, onClick) => {
              const item = document.createElement('div');
              item.style.cssText = `
                  padding: 8px 12px; cursor: pointer; border-radius: 6px;
                  color: ${color}; font-size: 0.85rem; display: flex; align-items: center; gap: 10px;
                  transition: all 0.2s; font-weight: 500;
              `;
              item.innerHTML = `<span style="font-size:1.1rem">${icon}</span> <span>${text}</span>`;
              item.onmouseenter = () => { item.style.background = 'rgba(255,255,255,0.08)'; };
              item.onmouseleave = () => { item.style.background = 'transparent'; };
              item.onclick = (ev) => {
                  ev.stopPropagation();
                  onClick();
                  menu.remove();
              };
              return item;
          };

          // 1. New Strategy Lab Option
          menu.appendChild(createItem('Strategy Lab', '🧪', '#8b5cf6', () => {
              if (!dayDate) { showToast('No date found', 'error'); return; }
              const params = new URLSearchParams({ symbol: inst, date: dayDate, jumpTime: entryT || '' });
              window.open(`/strategy-lab?${params.toString()}`, '_blank');
              showToast('Opening Strategy Lab...', 'success');
          }));

          
          // Separator
          const hr = document.createElement('div');
          hr.style.cssText = 'height:1px; background:rgba(255,255,255,0.08); margin:4px 8px;';
          menu.appendChild(hr);

           // existing items continue...


          const dDate = state.gallery.date;
          if (!dDate) return;
          const dayData = state.dayData[dDate] || {};
          const cardData = dayData.tradeRefCards?.[idx];
          const hasSavedView = !!(cardData?.index || cardData?.premium);

          // Show View (Recall Snapshot)
          if (hasSavedView) {
              menu.appendChild(createItem('Show Saved View', '👁', '#a78bfa', () => {
                  // First, jump to the trade itself to load right panel context properly
                  if (tr.images && tr.images.length > 0) {
                      const firstUrl = tr.images[0];
                      const gIdx = (state.gallery.images || []).indexOf(firstUrl);
                      if (gIdx !== -1) { state.gallery.currentIndex = gIdx; renderGallery(); }
                  }
                  
                  // Now apply the specific saved snapshot (zoom/pan/urls)
                  if (typeof applySplitViewState === 'function') {
                      setTimeout(() => {
                        applySplitViewState(cardData);
                        if (typeof showToast === 'function') showToast(`T${idx+1} view restored`, 'info');
                      }, 50);
                  }
              }));
          }

          // Export This View (PDF)
          menu.appendChild(createItem('Export This View', '📄', '#f59e0b', () => {
              if (typeof exportCurrentViewToPDF === 'function') exportCurrentViewToPDF();
          }));

          // Store Current View
          menu.appendChild(createItem('Store Current View', '📌', '#eee', async () => {
              const dDate = state.gallery.date;
              if (!dDate) return;
              const dayData = state.dayData[dDate] = state.dayData[dDate] || {};
              dayData.tradeRefCards = dayData.tradeRefCards || {};
              dayData.tradeRefCards[idx] = dayData.tradeRefCards[idx] || {};

              const _strip = (u) => {
                  if (!u) return null;
                  // Only strip localhost URLs to save as relative paths.
                  // Cloudinary / external URLs must stay intact.
                  if (u.startsWith('http://localhost') || u.startsWith('http://127.0.0.1')) {
                      try { return new URL(u).pathname; } catch(e) { return u; }
                  }
                  return u;
              };

              if (state.gallery.splitView && typeof getSplitViewState === 'function') {
                  const sState = getSplitViewState();

                  if (typeof showToast === 'function') showToast('Capturing views…', 'info');

                  // Pixel-perfect canvas capture → data URLs (temp memory only, no upload)
                  const [leftDataUrl, rightDataUrl] = await Promise.all([
                      _captureSplitPanel('gv2-split-left',  'gv2-split-left-img'),
                      _captureSplitPanel('gv2-split-right', 'gv2-split-right-img')
                  ]);

                  // Store captures in temp window variable — used by exportRefCardsToPDF, cleared after print
                  window._refCardCaptures = window._refCardCaptures || {};
                  window._refCardCaptures[dDate] = window._refCardCaptures[dDate] || {};
                  window._refCardCaptures[dDate][idx] = { index: leftDataUrl, premium: rightDataUrl };

                  // Also persist URL + transform in state for "Show Saved View" restore
                  const panelL = document.getElementById('gv2-split-left');
                  const panelR = document.getElementById('gv2-split-right');
                  
                  if (sState.left.url) {
                      dayData.tradeRefCards[idx].index = {
                          url: sState.left.rawUrl || _strip(sState.left.url),
                          scale: sState.left.scale, tx: sState.left.tx, ty: sState.left.ty,
                          panelW: panelL?.offsetWidth || 0, panelH: panelL?.offsetHeight || 0,
                          isSnapshot: true
                      };
                  } else {
                      const curImgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
                      if (curImgUrl) dayData.tradeRefCards[idx].index = _strip(curImgUrl) || curImgUrl;
                  }

                  if (sState.right.url) {
                      dayData.tradeRefCards[idx].premium = {
                          url: _strip(sState.right.url) || sState.right.url,
                          scale: sState.right.scale, tx: sState.right.tx, ty: sState.right.ty,
                          panelW: panelR?.offsetWidth || 0, panelH: panelR?.offsetHeight || 0,
                          isSnapshot: true
                      };
                  }

                  if (typeof showToast === 'function') showToast(`T${idx+1} Split View stored`, 'success');
              } else {
                  // Single view — also capture temporary high-fi snapshot for PDF
                  const curImgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
                  if (!curImgUrl) { if (typeof showToast === 'function') showToast('No image to store', 'error'); return; }
                  
                  if (typeof showToast === 'function') showToast('Capturing view…', 'info');
                  const singleDataUrl = await _captureSplitPanel('gallery-zoom-layer', 'gallery-img');
                  
                  window._refCardCaptures = window._refCardCaptures || {};
                  window._refCardCaptures[dDate] = window._refCardCaptures[dDate] || {};
                  window._refCardCaptures[dDate][idx] = { index: singleDataUrl };

                  dayData.tradeRefCards[idx].index = _strip(curImgUrl) || curImgUrl;
                  if (typeof showToast === 'function') showToast(`T${idx+1} view stored`, 'success');
              }

              if (typeof saveTrades === 'function') saveTrades();
              // Rebuild tray so green dot reflects actual stored data
              state.gallery._skipScrollIntoView = true;
              if (typeof renderGallery === 'function') renderGallery();
          }));

          // Remove View
          menu.appendChild(createItem('Remove View', '🗑', '#f87171', () => {
              const dDate = state.gallery.date;
              if (!dDate || !state.dayData[dDate]?.tradeRefCards?.[idx]) return;
              state.dayData[dDate].tradeRefCards[idx].index = null;
              if (typeof saveTrades === 'function') saveTrades();
              if (typeof showToast === 'function') showToast(`T${idx+1} view removed`, 'info');
              const dot = sourceBtn.querySelector('.ref-dot');
              if (dot) dot.remove();
              // If split view is on and this is the active trade, clear left panel? 
              // Better not to disrupt current view, just remove the persistent data.
          }));

          document.body.appendChild(menu);

          const closeMenu = () => { menu.remove(); document.removeEventListener('click', closeMenu); };
          setTimeout(() => document.addEventListener('mousedown', (ev) => { if (!menu.contains(ev.target)) closeMenu(); }, {once:true}), 10);
      };
  });

  // Export PDF Button in Tray (only if splitView or refCards visible)
  const pdfBtn = document.createElement('button');
  pdfBtn.className = 'close-global-nav-btn pdf-export-btn';
  pdfBtn.innerHTML = '📄';
  pdfBtn.style.cssText = `
      background:rgba(239, 68, 68, 0.12); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.3);
      backdrop-filter:blur(4px); border-radius:50%; width:34px; height:34px; font-size:1rem;
      cursor:pointer; display:flex; align-items:center; justify-content:center;
      transition:all 0.2s ease; box-shadow:0 4px 12px rgba(0,0,0,0.25);
  `;
  pdfBtn.title = 'Export Ref Cards to PDF';
  pdfBtn.onclick = (e) => {
      e.stopPropagation();
      if (typeof exportRefCardsToPDF === 'function') exportRefCardsToPDF();
  };
  tray.appendChild(pdfBtn);

  // 3 Dots "More" Button
  const moreBtn = document.createElement('button');
  moreBtn.className = 'close-global-nav-btn tray-more-btn';
  moreBtn.innerHTML = '•••';
  moreBtn.style.cssText = `
      background:rgba(255, 255, 255, 0.08); color:rgba(255, 255, 255, 0.7); border:1px solid rgba(255,255,255,0.12);
      backdrop-filter:blur(4px); border-radius:50%; width:34px; height:34px; font-size:1.1rem;
      cursor:pointer; display:flex; align-items:center; justify-content:center;
      transition:all 0.2s ease; box-shadow:0 4px 12px rgba(0,0,0,0.25);
  `;
  moreBtn.title = 'More Tray Options';
  moreBtn.onclick = (e) => {
      e.stopPropagation();
      const oldMenu = document.getElementById('gv2-tray-more-menu');
      if (oldMenu) { oldMenu.remove(); return; }

      const menu = document.createElement('div');
      menu.id = 'gv2-tray-more-menu';
      menu.style.cssText = `
          position: fixed; left: ${e.clientX}px; top: ${e.clientY - 90}px;
          background: rgba(22, 22, 28, 0.95); border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px; padding: 5px; z-index: 30000;
          box-shadow: 0 15px 40px rgba(0,0,0,0.7); display: flex; flex-direction: column; gap: 2px;
          min-width: 170px; backdrop-filter: blur(15px); animation: gv2-scale-in 0.15s ease-out;
      `;
      
      const createItem = (text, icon, color, onClick) => {
          const item = document.createElement('div');
          item.style.cssText = `padding: 8px 12px; cursor: pointer; border-radius: 6px; color: ${color}; font-size: 0.85rem; display: flex; align-items: center; gap: 10px; transition: all 0.2s;`;
          item.innerHTML = `<span>${icon}</span> <span>${text}</span>`;
          item.onmouseenter = () => { item.style.background = 'rgba(255,255,255,0.08)'; };
          item.onmouseleave = () => { item.style.background = 'transparent'; };
          item.onclick = (ev) => { ev.stopPropagation(); onClick(); menu.remove(); };
          return item;
      };

      menu.appendChild(createItem('Export Current View', '📄', '#f59e0b', () => {
          if (typeof exportCurrentViewToPDF === 'function') exportCurrentViewToPDF();
      }));
      menu.appendChild(createItem('Reset Tray Pos', '🎯', '#eee', () => {
          localStorage.removeItem('tj_gv2_cg_tray');
          renderCloseGlobalTray(curUrl);
      }));
      menu.appendChild(createItem('Clear Progress', '🧹', '#f87171', () => {
          if (confirm('Clear all green reference dots?')) {
              const dKey = state.gallery.date;
              if (state.dayData[dKey]) state.dayData[dKey].tradeRefCards = {};
              if (typeof saveTrades === 'function') saveTrades();
              renderGallery();
          }
      }));

      document.body.appendChild(menu);
      const closeMenu = () => { menu.remove(); document.removeEventListener('mousedown', checkClose); };
      const checkClose = (ev) => { if (!menu.contains(ev.target)) closeMenu(); };
      setTimeout(() => document.addEventListener('mousedown', checkClose), 10);
  };
  tray.appendChild(moreBtn);
}

