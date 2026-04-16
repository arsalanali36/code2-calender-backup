# JS - Gallery Render (tray, thumbs, grid)
Consolidated code context for AI assistants.


## File: `static/js/gallery-render-tray.js`
```js
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
      sourceBtn.className = 'close-global-nav-btn';
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

      // Right-click: Mini Action Panel
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
              min-width: 165px; backdrop-filter: blur(15px); animation: gv2-scale-in 0.15s ease-out;
          `;

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


```

## File: `static/js/gallery-render-thumbs.js`
```js
// gallery-render-thumbs.js — Thumbnail strip rendering (separators, drag-drop, thumb items)
// Called by renderGallery() in gallery-render.js

function renderGalleryThumbs() {
  const thumbs = document.getElementById('gallery-thumbs');
  if (!thumbs) return;

  const savedScrollTop = thumbs.scrollTop;
  const savedScrollLeft = thumbs.scrollLeft;
  thumbs.innerHTML = '';

  const _filterActive3 = Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length > 0;

  if (state.gallery.mode === 'pdf' && !_filterActive3) {
    if (typeof _renderPdfModeThumbs === 'function') _renderPdfModeThumbs(thumbs);
    return;
  }

  const thumbImages = _getGalleryThumbImages();
  const date = state.gallery.date;
  const currentIndex = state.gallery.currentIndex;
  const dayTrades = date ? getTradesForDate(date) : [];
  
  const _perDateLastIdx = new Map();
  const _perDateRenderedSeps = new Set();

  // Expanded group highlights
  let dragFromIndex = -1;
  const highlightSubImages = new Set();
  const highlightParents = new Set();
  const subImageToParentMap = new Map();
  if (state.gallery.expandedGroups) {
    for (const pUrl of state.gallery.expandedGroups) {
      const ownerTrade = getOwnerTradeForImageUrl(pUrl);
      const subArr = (ownerTrade && ownerTrade.subImages?.[pUrl]?.length > 0 && ownerTrade.subImages[pUrl])
        || (date && state.dayData[date]?.subImages?.[pUrl]?.length > 0 && state.dayData[date].subImages[pUrl]);
      if (!subArr) continue;
      highlightParents.add(pUrl);
      subArr.forEach(u => { highlightSubImages.add(u); subImageToParentMap.set(u, pUrl); });
    }
  }

  // Pre-compute filter trade indices per date
  const _filteredTradeIdxPerDate = new Map();
  if (_filterActive3 && state.gallery._filteredMeta) {
    state.gallery._filteredMeta.forEach(meta => {
      const d = meta.date || '';
      if (!d || meta.sourceRow === null || meta.sourceRow === undefined) return;
      
      const trade = state.trades[meta.sourceRow];
      if (!trade) return;
      const trades = (d !== date) ? getTradesForDate(d) : dayTrades;
      const idx = trades.indexOf(trade);
      if (idx < 0) return;
      if (!_filteredTradeIdxPerDate.has(d)) _filteredTradeIdxPerDate.set(d, new Set());
      _filteredTradeIdxPerDate.get(d).add(idx);
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
    sep.setAttribute('data-trade-idx', idx);
    sep.title = `Trade ${idx + 1} (Drop to move. Click to collapse)`;
    const sepKey = 'T' + idx;
    const isCollapsed = state.gallery.collapsedSeparators?.has(sepKey);
    const arrow = isCollapsed ? '▸' : '▾';
    const tr = tradeObj !== undefined ? tradeObj : dayTrades[idx];
    const pnl = parseFloat(tr?.['Net P/L'] || tr?.net_pnl || 0) || 0;
    const pt  = parseFloat(tr?.['Pt'] || tr?.pt || 0) || 0;
    const pnlStr   = pnl !== 0 ? (pnl > 0 ? '+₹' : '-₹') + Math.abs(Math.round(pnl)) : '';
    const ptStr    = pt  !== 0 ? (pt  > 0 ? '+' : '') + Math.round(pt) + 'Pt' : '';
    const pnlColor = pnl > 0 ? 'var(--green,#2ecc71)' : (pnl < 0 ? 'var(--red,#e74c3c)' : '#ffd700');
    const lotNum   = parseFloat(tr?.Qty || tr?.qty || tr?.QTY || 0) || 0;
    const bTime    = (tr?.['Buy Time']  || tr?.buy_time  || '').slice(0, 5);
    const sTime    = (tr?.['Sell Time'] || tr?.sell_time || '').slice(0, 5);
    const tt       = String(tr?.TradeType || tr?.tradetype || tr?.['Trade Type'] || '').toLowerCase();
    const isShort  = tt.includes('sell') || tt.includes('short');
    const eTime    = isShort ? sTime : bTime;
    let dur = '';
    if (bTime && sTime) {
      try {
        const [h1, m1] = bTime.split(':').map(Number);
        const [h2, m2] = sTime.split(':').map(Number);
        const d1 = new Date(2000, 0, 1, h1, m1), d2 = new Date(2000, 0, 1, h2, m2);
        const mins = Math.round(Math.abs(d2 - d1) / 60000);
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
            await handleReorderGalleryImagesBatch(draggedIndices, state.gallery.images.indexOf(tr.images[0]), tr.images[0]);
          } else { await moveSelectedToTrade(date, tr); }
        }
      } catch (err) { console.error(err); }
    });
    if (state.gallery.selectedSeparator === idx) sep.classList.add('selected-separator');

    sep.addEventListener('click', (e) => {
      e.stopPropagation();
      state.gallery.collapsedSeparators = state.gallery.collapsedSeparators || new Set();
      const key = 'T' + idx;
      if (state.gallery.collapsedSeparators.has(key)) state.gallery.collapsedSeparators.delete(key);
      else state.gallery.collapsedSeparators.add(key);
      state.gallery.selectedSeparator = (state.gallery.selectedSeparator === idx) ? null : idx;
      state.gallery._skipScrollIntoView = true;
      renderGallery();
    });
    return sep;
  };

  const createSpecialSeparator = (label, type) => {
    const sep = document.createElement('div');
    sep.className = 'gv2-thumb-separator';
    const isClose       = type === true;
    const isCloseGlobal = type === 'CLOSE_GLOBAL';
    const isPremium     = type === 'PREMIUM';
    const isNews        = type === 'NEWS';
    const isPdf         = type === 'DOCUMENTS';
    const sepKey = isNews ? 'NEWS' : (isCloseGlobal ? 'CLOSE_GLOBAL' : (isPremium ? 'PREMIUM' : (isPdf ? 'DOCUMENTS' : (isClose ? 'CLOSE' : 'OPEN'))));
    const isCollapsed = state.gallery.collapsedSeparators?.has(sepKey);
    const arrow = isCollapsed ? '▸' : '▾';
    sep.innerHTML = `<span class="gv2-sep-label">${arrow} ${label}</span>`;
    sep.title = `${label} images section`;
    
    let color = '#ffd700'; // Default gold
    if (isNews) color = '#ffa500';
    else if (isPdf) color = '#a55eea'; // Purple for PDF
    
    sep.style.color = color;
    sep.style.borderColor = color;

    sep.addEventListener('dragover', e => { e.preventDefault(); sep.classList.add('drag-active'); });
    sep.addEventListener('dragleave', () => sep.classList.remove('drag-active'));
    sep.addEventListener('drop', async e => {
      e.preventDefault(); sep.classList.remove('drag-active');
      try {
        const draggedIndices = JSON.parse(e.dataTransfer.getData('application/json'));
        if (!draggedIndices || draggedIndices.length === 0) return;
        if (typeof moveSelectedToDayData === 'function') {
          const dData = state.dayData[date];
          let arrToUse = isNews ? dData?.newsImages : (isCloseGlobal ? dData?.closeGlobalImages : (isClose ? dData?.closeImages : dData?.images));
          if (!arrToUse) {
            if (isNews) dData.newsImages = [];
            else if (isCloseGlobal) dData.closeGlobalImages = [];
            else if (isClose) dData.closeImages = [];
            else dData.images = [];
          }
          if (isCloseGlobal) {
            const curLen = (dData.closeGlobalImages || []).length;
            if (curLen >= 1 && state.gallery.selectedIndices?.size > 0) {
              showToast('CLOSE GLOBAL can only hold 1 image.', 'error'); return;
            }
          }
          await moveSelectedToDayData(date, isNews ? 'NEWS' : (isCloseGlobal ? 'CLOSE_GLOBAL' : isClose));
        }
      } catch (err) { console.error(err); }
    });
    if (state.gallery.selectedSeparator === sepKey) sep.classList.add('selected-separator');

    sep.addEventListener('click', (e) => {
      e.stopPropagation();
      state.gallery.collapsedSeparators = state.gallery.collapsedSeparators || new Set();
      if (state.gallery.collapsedSeparators.has(sepKey)) state.gallery.collapsedSeparators.delete(sepKey);
      else state.gallery.collapsedSeparators.add(sepKey);
      state.gallery.selectedSeparator = (state.gallery.selectedSeparator === sepKey) ? null : sepKey;
      state.gallery._skipScrollIntoView = true;
      renderGallery();
    });
    return sep;
  };

  // Initial separators (When not filtering)
  let newsGrid = null;
  if (date && !_filterActive3) {
    thumbs.appendChild(createSpecialSeparator('NEWS', 'NEWS'));
    _perDateRenderedSeps.add(date + ':NEWS');
    if (!state.gallery.collapsedSeparators?.has('NEWS')) {
      newsGrid = document.createElement('div');
      newsGrid.className = 'gv2-news-thumbnail-grid';
      thumbs.appendChild(newsGrid);
    }
    thumbs.appendChild(createSpecialSeparator('OPEN', false));
    _perDateRenderedSeps.add(date + ':OPEN');
  }

  let lastTradeIdxRendered = -1;

  const premiumObj = date ? (state.dayData[date]?.premiumImages || {}) : {};
  const premiumUrls = new Set(Object.values(premiumObj));
  const uniqueInsts = Array.from(new Set(dayTrades.map(t => {
      const raw = t.Instrument || t.instrument || t.Symbol || t.symbol || '';
      return raw.toUpperCase();
  }))).filter(Boolean).sort();

  const activeUrl = (state.gallery.images || [])[currentIndex] || '';
  const activeTradeContext = typeof getOwnerTradeForImageUrl === 'function' ? getOwnerTradeForImageUrl(activeUrl) : null;

  // ── Thumbnail loop ────────────────────────────────────────────────────────
  thumbImages.forEach(({ url, globalIdx, isCurrentDate, date: itemDate, sourceRow: itemSourceRow, isNews }) => {
    const isVidThumb = typeof isVideoUrl === 'function' && isVideoUrl(url);
    const isPdfThumb = false; // PDF pages are now real image URLs
    const isSelected = !!state.gallery.selectedIndices?.has(globalIdx);
    const isActive = globalIdx === currentIndex;

    const _effDate   = (_filterActive3 && itemDate) ? itemDate : (date || '');
    const _effTrades = (_filterActive3 && itemDate && itemDate !== date) ? getTradesForDate(itemDate) : dayTrades;
    const dData      = state.dayData[_effDate] || {};

    // Detect Category
    const _isNews           = isNews;
    const _isOpen           = dData.images?.includes(url);
    const _isClose          = dData.closeImages?.includes(url);
    const _isCloseGlobal    = dData.closeGlobalImages?.includes(url);
    const _isPremium        = dData.premiumImages && Object.values(dData.premiumImages).some(v => Array.isArray(v) ? v.includes(url) : v === url);

    // Filter Optimization: Matched premium images should be shown in main list when filtering
    if (_isPremium && !_filterActive3) return;

    const ownerTrade = (_filterActive3 && itemSourceRow !== null && itemSourceRow !== undefined)
      ? (state.trades[itemSourceRow] || null)
      : getOwnerTradeForImageUrl(url);

    // 1. NEWS Separator
    if (_isNews && !_filterActive3) {
      if (!_perDateRenderedSeps.has(_effDate + ':NEWS')) {
        thumbs.appendChild(createSpecialSeparator('NEWS', 'NEWS'));
        _perDateRenderedSeps.add(_effDate + ':NEWS');
        if (!state.gallery.collapsedSeparators?.has('NEWS')) {
          newsGrid = document.createElement('div');
          newsGrid.className = 'gv2-news-thumbnail-grid';
          thumbs.appendChild(newsGrid);
        }
      }
      if (state.gallery.collapsedSeparators?.has('NEWS')) return;
    }

    // 2. OPEN Separator
    if (_isOpen && !_filterActive3 && !_perDateRenderedSeps.has(_effDate + ':OPEN')) {
      thumbs.appendChild(createSpecialSeparator('OPEN', false));
      _perDateRenderedSeps.add(_effDate + ':OPEN');
    }
    if (_isOpen && state.gallery.collapsedSeparators?.has('OPEN')) return;

    // 3. TRADE Separators
    if (_effTrades.length > 0 && ownerTrade && !_isClose && !_isCloseGlobal && !_isPremium && !_filterActive3) {
      const targetTradeIdx = _effTrades.indexOf(ownerTrade);
      if (targetTradeIdx >= 0) {
        let _lastIdx = lastTradeIdxRendered;
        while (_lastIdx < targetTradeIdx) {
          const _sepIdx = _lastIdx + 1;
          thumbs.appendChild(createTradeSeparator(_sepIdx, _effTrades[_sepIdx]));
          if (typeof createRefCardElement === 'function') {
            const _rc = createRefCardElement(_sepIdx, _effTrades[_sepIdx], _effDate);
            if (_rc) thumbs.appendChild(_rc);
          }
          _lastIdx++;
        }
        lastTradeIdxRendered = _lastIdx;
      }
      if (state.gallery.collapsedSeparators?.has('T' + targetTradeIdx)) return;
    } else if (_effDate && !ownerTrade && !_isNews && !_isClose && !_isCloseGlobal && !_isPremium && !isPdfThumb) {
      // Catch-all for basic day images that aren't Open/Close (rare)
      if (state.gallery.collapsedSeparators?.has('OPEN')) return;
    }

    // 4. CLOSE Separator
    const _closeSepKey = _effDate + ':CLOSE';
    if (_isClose && !_filterActive3 && !_perDateRenderedSeps.has(_closeSepKey)) {
      thumbs.appendChild(createSpecialSeparator('CLOSE', true));
      _perDateRenderedSeps.add(_effDate + ':CLOSE');
    }
    if (_isClose && state.gallery.collapsedSeparators?.has('CLOSE')) return;

    // 5. CLOSE GLOBAL Separator
    const _closeGlobalSepKey = _effDate + ':CLOSE_GLOBAL';
    if (_isCloseGlobal && !_filterActive3 && !_perDateRenderedSeps.has(_closeGlobalSepKey)) {
      thumbs.appendChild(createSpecialSeparator('CLOSE GLOBAL', 'CLOSE_GLOBAL'));
      _perDateRenderedSeps.add(_closeGlobalSepKey);
    }
    if (_isCloseGlobal && state.gallery.collapsedSeparators?.has('CLOSE_GLOBAL')) return;

    // 6. PREMIUM Separator 
    const _premiumSepKey = _effDate + ':PREMIUM';
    if (_isPremium && !_filterActive3 && !_perDateRenderedSeps.has(_premiumSepKey)) {
      thumbs.appendChild(createSpecialSeparator('PREMIUM', 'PREMIUM'));
      _perDateRenderedSeps.add(_premiumSepKey);
    }
    if (_isPremium && state.gallery.collapsedSeparators?.has('PREMIUM')) return;


    // ── Build thumbnail element ───────────────────────────────────────────
    const wrap = document.createElement('div');
    wrap.className = 'gv2-thumb-wrap';
    wrap.draggable = !IS_TOUCH_DEVICE;
    if (activeTradeContext && ownerTrade === activeTradeContext) wrap.classList.add('trade-active');
    wrap.dataset.globalIdx = globalIdx;

    if (highlightParents.has(url)) {
      wrap.classList.add('grp-parent');
    } else if (highlightSubImages.has(url)) {
      wrap.classList.add('grp-child');
      const parentUrl = subImageToParentMap.get(url);
      let siblings = [];
      const ownerT = getOwnerTradeForImageUrl(parentUrl);
      if (ownerT?.subImages?.[parentUrl]) siblings = ownerT.subImages[parentUrl];
      else if (date && state.dayData[date]?.subImages?.[parentUrl]) siblings = state.dayData[date].subImages[parentUrl];
      if (siblings.length > 0 && siblings[siblings.length - 1] === url) wrap.classList.add('grp-child-last');
    }

    let t;
    if (isVidThumb) {
      t = document.createElement('video');
      t.src = resolveImageUrl(url); t.preload = 'metadata'; t.muted = true; t.loop = true; t.playsInline = true;
      t.style.objectFit = 'cover';
      t.className = 'gv2-thumb gv2-thumb-video' + (isActive ? ' active' : '') + (isSelected ? ' selected-thumb' : '');
      if (isSelected) t.style.borderColor = '#ff9800'; 
      t.title = 'Video recording';
      t.addEventListener('mouseenter', () => { t.play().catch(()=>{}); });
      t.addEventListener('mouseleave', () => { t.pause(); });
      const vIcon = document.createElement('span');
      vIcon.className = 'gv2-thumb-video-icon';
      vIcon.innerHTML = '&#9654;';
      vIcon.style.cssText = 'position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:#fff; font-size:1.2rem; text-shadow:0 0 8px rgba(0,0,0,0.8); pointer-events:none; z-index:2;';
      wrap.appendChild(vIcon);
    } else {
      t = document.createElement('img');
      t.src = resolveImageUrl(url);
      t.className = 'gv2-thumb' + (isActive ? ' active' : '') + (isSelected ? ' selected-thumb' : '');
      // Ensure the orange border is visible even if active
      if (isSelected) t.style.borderColor = '#ff9800'; 
      t.onerror = () => {
        if (state.gallery.images.indexOf(url) < 0) { wrap.style.display = 'none'; return; }
        t.style.opacity = '0.3'; t.title = 'Image could not be loaded';
      };
    }

    if (_filterActive3) {
      const tradeKey = (_effDate || '') + ':' + (ownerTrade ? itemSourceRow : 'OPENCLOSE');
      if (state.gallery.expandedFilterTrades?.has(tradeKey)) wrap.classList.add('expanded-trade');
      else if (state.gallery._filteredMeta?.[globalIdx]?.isCollapsedTrade) wrap.classList.add('collapsed-trade-preview');
    }

    // Selection Handler (Combined Click)
    t.addEventListener('click', (e) => {
      if (!state.gallery.selectedIndices) state.gallery.selectedIndices = new Set();
      
      // Use currentIndex as fallback if lastClickedIdx is -1/null
      let lastIdx = state.gallery.lastClickedIdx;
      if (lastIdx === null || lastIdx === undefined || lastIdx < 0) lastIdx = currentIndex;

      if (e.shiftKey) {
        e.preventDefault();
        const start = Math.min(lastIdx, globalIdx);
        const end = Math.max(lastIdx, globalIdx);
        for (let i = start; i <= end; i++) {
          if (i >= 0 && i < state.gallery.images.length) state.gallery.selectedIndices.add(i);
        }
        state.gallery.lastClickedIdx = globalIdx;
        state.gallery._skipScrollIntoView = true;
        renderGallery();
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (state.gallery.selectedIndices.has(globalIdx)) state.gallery.selectedIndices.delete(globalIdx);
        else state.gallery.selectedIndices.add(globalIdx);
        state.gallery.lastClickedIdx = globalIdx;
        state.gallery._skipScrollIntoView = true;
        renderGallery();
        return;
      }

      // Default: select individual
      state.gallery.selectedIndices = new Set([globalIdx]);
      state.gallery.currentIndex = globalIdx;
      state.gallery.lastClickedIdx = globalIdx;
      state.gallery._skipScrollIntoView = true;
      renderGallery();
    });

    t.addEventListener('contextmenu', async e => {
      e.preventDefault();
      if (!state.gallery.selectedIndices) state.gallery.selectedIndices = new Set();
      if (!state.gallery.selectedIndices.has(globalIdx)) { state.gallery.selectedIndices = new Set([globalIdx]); renderGallery(); }
      if (typeof showGalleryContextMenu === 'function') showGalleryContextMenu(e.clientX, e.clientY);
    });

    // Track touch start position to distinguish tap vs scroll
    let _tStartY = 0;
    t.addEventListener('touchstart', e => { _tStartY = e.touches[0].clientY; }, { passive: true });
    t.addEventListener('touchend', e => {
      if (!IS_TOUCH_DEVICE) return;
      // If finger moved more than 10px vertically = scroll gesture, ignore
      if (Math.abs(e.changedTouches[0].clientY - _tStartY) > 10) return;
      e.preventDefault();
      state.gallery.currentIndex = globalIdx;
      state.gallery._skipScrollIntoView = true;
      renderGallery();
    }, { passive: false });

    if (isCurrentDate) {
      wrap.addEventListener('dragstart', e => {
        dragFromIndex = globalIdx;
        if (!state.gallery.selectedIndices) state.gallery.selectedIndices = new Set();
        if (!state.gallery.selectedIndices.has(globalIdx)) { state.gallery.selectedIndices = new Set([globalIdx]); renderGallery(); }
        wrap.classList.add('dragging');
        if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/json', JSON.stringify(Array.from(state.gallery.selectedIndices))); }
      });
      wrap.addEventListener('dragend', () => {
        dragFromIndex = -1; wrap.classList.remove('dragging');
        thumbs.querySelectorAll('.drag-over, .drag-over-left, .drag-over-right').forEach(el => el.classList.remove('drag-over', 'drag-over-left', 'drag-over-right'));
      });
      wrap.addEventListener('dragover', e => {
        e.preventDefault();
        if (state.gallery.selectedIndices?.has(globalIdx)) return;
        const rect = wrap.getBoundingClientRect(), third = rect.width / 3, x = e.clientX - rect.left;
        wrap.classList.remove('drag-over', 'drag-over-left', 'drag-over-right');
        if (x < third) wrap.classList.add('drag-over-left');
        else if (x > 2 * third) wrap.classList.add('drag-over-right');
        else wrap.classList.add('drag-over');
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
            if (typeof handleDropAsSubImage === 'function') await handleDropAsSubImage(draggedIndices, globalIdx);
          } else {
            let insertAt = globalIdx;
            if (isRight) insertAt += 1;
            if (typeof handleReorderGalleryImagesBatch === 'function') await handleReorderGalleryImagesBatch(draggedIndices, insertAt, url);
          }
        } catch (err) { console.error(err); }
      });
    }

    const del = document.createElement('button');
    del.type = 'button'; del.className = 'gv2-thumb-del'; del.textContent = '×'; del.title = 'Remove image';
    del.style.pointerEvents = 'auto'; // Ensure it captures clicks
    del.addEventListener('click', async e => { 
      e.stopPropagation(); 
      e.preventDefault();
      await removeGalleryImageAt(globalIdx); 
    });

    if (globalIdx === 0 && date) {
      const videoUrl = state.dayData[date]?.video;
      if (videoUrl) {
        const vi = document.createElement('span'); vi.className = 'gv2-thumb-video-icon'; vi.textContent = '▶';
        vi.style.pointerEvents = 'auto'; vi.style.cursor = 'pointer';
        vi.addEventListener('click', e => { e.stopPropagation(); window.open(videoUrl, '_blank'); });
        wrap.appendChild(vi);
      }
    }

    let subCount = 0, groupName = null;
    if (ownerTrade?.subImages?.[url]?.length) {
      subCount = ownerTrade.subImages[url].length; groupName = ownerTrade.groupNames?.[url];
    } else {
      const grpDate = itemDate || date;
      if (grpDate && state.dayData[grpDate]?.subImages?.[url]?.length) {
        subCount = state.dayData[grpDate].subImages[url].length; groupName = state.dayData[grpDate].groupNames?.[url];
      }
    }

    wrap.appendChild(t); wrap.appendChild(del);

    // Tag pin count badge
    if (typeof getTagPinsForUrl === 'function') {
      const _pinCount = getTagPinsForUrl(url, itemDate || date).length;
      if (_pinCount > 0) {
        const _pinBadge = document.createElement('div');
        _pinBadge.className = 'tag-pin-thumb-badge';
        _pinBadge.textContent = _pinCount;
        _pinBadge.title = _pinCount + ' tag pin' + (_pinCount > 1 ? 's' : '');
        wrap.appendChild(_pinBadge);
      }
    }

    if (typeof getAudioForImage === 'function' && getAudioForImage(url, itemDate || date || '')) {
      const ai = document.createElement('span'); ai.className = 'gv2-thumb-audio-icon'; ai.textContent = '▶'; ai.title = 'Audio note attached';
      wrap.appendChild(ai);
    }
    if (typeof getVideoForImage === 'function' && getVideoForImage(url, itemDate || date || '')) {
      const vi = document.createElement('span'); vi.className = 'gv2-thumb-video-icon'; vi.textContent = '📹'; vi.title = 'Video recording attached';
      wrap.appendChild(vi);
    }
    if (state.gallery.showTime && state.gallery.imageTimes?.[url]) {
      const timeLbl = document.createElement('div');
      timeLbl.textContent = state.gallery.imageTimes[url];
      timeLbl.style.cssText = 'position:absolute; bottom:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.7); color:#fff; font-size:0.65rem; padding:1px 3px; border-radius:3px; pointer-events:none; white-space:nowrap; z-index:10;';
      wrap.appendChild(timeLbl);
    }
    if (groupName) {
      const nameLbl = document.createElement('div');
      nameLbl.textContent = groupName;
      nameLbl.style.cssText = 'position:absolute; top:-18px; left:50%; transform:translateX(-50%); background:transparent; color:#ff9800; font-size:0.7rem; font-weight:bold; white-space:nowrap; pointer-events:none; z-index:10;';
      wrap.appendChild(nameLbl);
    }

    const _filterActive2 = _filterActive3;
    if (itemDate && (_filterActive2 || !date)) {
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
      badge.style.cssText = `position:absolute; bottom:4px; right:4px; background:${isExpanded ? 'var(--green,#4caf50)' : 'var(--blue)'}; color:#fff; font-size:0.7rem; padding:2px 6px; border-radius:10px; font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.5); cursor:pointer; z-index:10;`;
      badge.addEventListener('click', e => { e.stopPropagation(); if (typeof toggleGalleryGroupExpand === 'function') toggleGalleryGroupExpand(url); });
      wrap.appendChild(badge);
    }

    if (isNews && newsGrid) newsGrid.appendChild(wrap);
    else thumbs.appendChild(wrap);
  });

  // Trailing trade separators
  if (!_filterActive3 && dayTrades.length > 0) {
    while (lastTradeIdxRendered < dayTrades.length - 1) {
      thumbs.appendChild(createTradeSeparator(lastTradeIdxRendered + 1));
      lastTradeIdxRendered++;
    }
  }
  if (!_filterActive3 && !_perDateRenderedSeps.has(date + ':CLOSE') && date) thumbs.appendChild(createSpecialSeparator('CLOSE', true));
  if (!_filterActive3 && !_perDateRenderedSeps.has(date + ':CLOSE_GLOBAL') && date) thumbs.appendChild(createSpecialSeparator('CLOSE GLOBAL', 'CLOSE_GLOBAL'));

  // ── Footer: PREMIUM + blank button + scroll (in gallery-render-thumbs-b.js)
  _renderThumbsFooter(thumbs, date, dayTrades, uniqueInsts, premiumObj,
                      savedScrollTop, savedScrollLeft, _filterActive3, createSpecialSeparator);
}

```

## File: `static/js/gallery-render-thumbs-b.js`
```js
// gallery-render-thumbs-b.js
// Split from gallery-render-thumbs.js (30KB limit)
// Contains: _renderThumbsFooter (PREMIUM + blank + scroll) + _renderPdfModeThumbs

// ── PDF mode: render pages as regular img thumbnails ─────────────────────────
function _renderPdfModeThumbs(thumbs) {
  const images  = state.gallery.images || [];
  const current = state.gallery.currentIndex;
  const pdf     = state.gallery.pdf || {};

  // PDF name header
  if (pdf.name) {
    const hdr = document.createElement('div');
    hdr.style.cssText = 'padding:6px 8px; font-size:0.72rem; font-weight:700; color:#58a6ff; text-transform:uppercase; letter-spacing:0.5px; opacity:0.8;';
    hdr.textContent = pdf.name.length > 28 ? pdf.name.slice(0, 25) + '...' : pdf.name;
    thumbs.appendChild(hdr);
  }

  images.forEach((url, idx) => {
    const isActive   = idx === current;
    const wrap       = document.createElement('div');
    wrap.className   = 'gv2-thumb-wrap';
    wrap.dataset.globalIdx = idx;

    const img        = document.createElement('img');
    img.src          = resolveImageUrl(url);
    img.className    = 'gv2-thumb' + (isActive ? ' active' : '');
    img.draggable    = false;

    // Page number badge
    const badge      = document.createElement('div');
    badge.style.cssText = 'position:absolute;bottom:2px;left:2px;font-size:9px;background:rgba(0,0,0,0.75);color:#fff;padding:1px 4px;border-radius:3px;z-index:10;font-family:monospace;pointer-events:none;';
    badge.textContent = 'P' + (idx + 1);

    // Delete page button
    const del        = document.createElement('button');
    del.className    = 'gv2-thumb-del';
    del.textContent  = '\u00d7';
    del.title        = 'Delete this page';
    del.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm('Delete page ' + (idx + 1) + ' from this PDF?')) return;
      const newPages = images.filter((_, i) => i !== idx);
      try {
        await imageService.updatePdfPages(pdf.filename, newPages);
        state.gallery.images = newPages;
        state.gallery.currentIndex = Math.min(current, newPages.length - 1);
        renderGallery();
        showToast('Page deleted', 'success');
      } catch (err) {
        console.error('[PDF] page delete failed', err);
        showToast('Delete failed', 'error');
      }
    };

    wrap.appendChild(img);
    wrap.appendChild(badge);
    wrap.appendChild(del);

    wrap.addEventListener('click', () => {
      state.gallery.currentIndex = idx;
      renderGallery();
    });

    thumbs.appendChild(wrap);
  });
}

// ── PREMIUM section + blank button + scroll ───────────────────────────────────
function _renderThumbsFooter(thumbs, date, dayTrades, uniqueInsts, premiumObj,
                              savedScrollTop, savedScrollLeft, _filterActive3, createSpecialSeparator) {
  // ── PREMIUM SECTION ───────────────────────────────────────────────────────
  if (!_filterActive3 && date && uniqueInsts.length > 0) {
    thumbs.appendChild(createSpecialSeparator('PREMIUM', 'PREMIUM'));
    if (!state.gallery.collapsedSeparators?.has('PREMIUM')) {
      uniqueInsts.forEach(inst => {
        const instWrap = document.createElement('div');
        instWrap.style.cssText = 'margin:12px 6px; padding:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,215,0,0.2); border-radius:8px;';

        const label = document.createElement('div');
        const m = inst.match(/(\d{5})(CE|PE)$/i);
        const cleanLabel = m ? `${m[1]} ${m[2].toUpperCase()}` : inst;
        label.textContent = cleanLabel;
        label.style.cssText = 'font-size:0.95rem; font-weight:800; color:#ffd700; text-align:center; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;';
        instWrap.appendChild(label);

        const val = premiumObj[inst];
        const urls = Array.isArray(val) ? val : (val ? [val] : []);

        const imgContainer = document.createElement('div');
        imgContainer.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px; justify-content:center;';
        instWrap.appendChild(imgContainer);

        urls.forEach((url, uIdx) => {
          const gIdx = state.gallery.images.indexOf(url);
          const thumb = document.createElement('div');
          thumb.className = 'gv2-thumb-wrap';

          const img = document.createElement('img');
          img.src = resolveImageUrl(url);
          img.className = 'gv2-thumb' + (gIdx === state.gallery.currentIndex ? ' active' : '');
          img.style.height = '60px';
          img.onclick = () => { state.gallery.currentIndex = gIdx; renderGallery(); };

          const del = document.createElement('button');
          del.className = 'gv2-thumb-del'; del.textContent = '\u00d7';
          del.onclick = async (e) => {
            e.stopPropagation();
            if (Array.isArray(state.dayData[date].premiumImages[inst])) {
              state.dayData[date].premiumImages[inst].splice(uIdx, 1);
            } else {
              delete state.dayData[date].premiumImages[inst];
            }
            const idx = state.gallery.images.indexOf(url);
            if (idx >= 0) state.gallery.images.splice(idx, 1);
            await saveTrades();
            state.gallery._skipScrollIntoView = true;
            renderGallery();
          };

          thumb.appendChild(img); thumb.appendChild(del);
          imgContainer.appendChild(thumb);
        });

        const plus = document.createElement('div');
        plus.style.cssText = 'width:40px; height:60px; border:2px dashed rgba(255,215,0,0.15); border-radius:6px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#ffd700; font-size:1.2rem; opacity:0.6; flex-shrink:0;';
        plus.textContent = '+';
        plus.onclick = () => {
          state.gallery.selectedSeparator = `PREMIUM:${inst}`;
          state._galleryUploadCallback = () => {
            state.gallery.images = getImagesForDate(date);
            renderGallery();
          };
          if (typeof openDayUploadModal === 'function') openDayUploadModal(date);
        };
        imgContainer.appendChild(plus);
        thumbs.appendChild(instWrap);
      });
    }
  }

  // ── + Add blank image button ──────────────────────────────────────────────
  const btnWrap = document.createElement('div');
  btnWrap.className = 'gv2-thumb-wrap';
  btnWrap.style.cssText = 'display:flex; align-items:center; justify-content:center; background:var(--surface2); border:2px dashed var(--border2); border-radius:5px; width:calc(var(--thumb-panel-w,74px) - 60px); height:calc((var(--thumb-panel-w,74px) - 18px) * 0.62); cursor:pointer; font-size:1.5rem; color:var(--text2);';
  btnWrap.textContent = '+'; btnWrap.title = 'Add blank image';
  btnWrap.onclick = async () => {
    try {
      const cvs = document.createElement('canvas'); cvs.width = 1920; cvs.height = 1080;
      const c = cvs.getContext('2d'); c.fillStyle = '#ffffff'; c.fillRect(0, 0, 1920, 1080);
      cvs.toBlob(async (blob) => {
        if (!blob) return;
        try {
          const file = new File([blob], 'blank_page_' + Date.now() + '.png', { type: 'image/png' });
          const q = (state.gallery.selectedSeparator === 'NEWS') ? 0.25 : null;
          const rv = await imageService.uploadImage(file, q);
          if (rv.url) {
            const newUrl = rv.url;
            const selSep = state.gallery.selectedSeparator;
            const dayKey = date;
            if (dayKey) {
              if (!state.dayData[dayKey]) state.dayData[dayKey] = {};
              const dData = state.dayData[dayKey];
              if (selSep === 'NEWS') { dData.newsImages = dData.newsImages || []; dData.newsImages.push(newUrl); }
              else if (selSep === 'CLOSE') { dData.closeImages = dData.closeImages || []; dData.closeImages.push(newUrl); }
              else if (selSep === 'CLOSE_GLOBAL') { dData.closeGlobalImages = dData.closeGlobalImages || []; dData.closeGlobalImages.push(newUrl); }
              else if (typeof selSep === 'number') {
                const selTrade = dayTrades[selSep];
                if (selTrade) { selTrade.images = selTrade.images || []; selTrade.images.push(newUrl); }
                else { dData.images = dData.images || []; dData.images.push(newUrl); }
              } else { dData.images = dData.images || []; dData.images.push(newUrl); }
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

  // ── Scroll restoration / auto-scroll to active ───────────────────────────
  if (state.gallery._skipScrollIntoView) {
    setTimeout(() => { if (thumbs) { thumbs.scrollTop = savedScrollTop; thumbs.scrollLeft = savedScrollLeft; } }, 0);
  } else {
    const doScroll = () => {
      if (!thumbs) return;
      // Separator scroll only when explicitly forced (block navigation)
      if (state.gallery._forceScrollToSeparator) {
        const activeUrl  = state.gallery.images[state.gallery.currentIndex];
        const ownerTrade = typeof getOwnerTradeForImageUrl === 'function' ? getOwnerTradeForImageUrl(activeUrl) : null;
        const trades     = state.gallery.date ? getTradesForDate(state.gallery.date) : [];
        const tIdx       = ownerTrade ? trades.indexOf(ownerTrade) : -1;
        let sepEl = null;
        if (tIdx !== -1) {
          sepEl = thumbs.querySelector(`.gv2-thumb-separator[data-trade-idx="${tIdx}"]`);
          if (!sepEl) {
            const seps = thumbs.querySelectorAll('.gv2-thumb-separator');
            for (const s of seps) { if (s.textContent.includes('T' + (tIdx + 1))) { sepEl = s; break; } }
          }
        }
        if (sepEl) {
          const rect = sepEl.getBoundingClientRect();
          const cr   = thumbs.getBoundingClientRect();
          if (cr.height > 0) thumbs.scrollTo({ top: thumbs.scrollTop + rect.top - cr.top - 10, behavior: 'smooth' });
          return;
        }
      }
      // Default: scroll active thumb into view only if off-screen
      const activeThumb = thumbs.querySelector('.gv2-thumb.active');
      const targetEl = activeThumb?.closest('.gv2-thumb-wrap');
      if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    setTimeout(doScroll, 80);
    setTimeout(() => { doScroll(); state.gallery._forceScrollToSeparator = false; }, 250);
  }
  state.gallery._skipScrollIntoView = false;
  bindGalleryRubberbandAndPan(thumbs);
}

```

## File: `static/js/gallery-grid.js`
```js
// gallery-grid.js — Full Page / Grid View for organized images grouped by trade

(function() {
  const gv = {
    btn: null,
    overlay: null,
    closer: null,
    slider: null,
    body: null,
    isOpen: false,
    currentSize: 280
  };

  function _syncGridRefs() {
    gv.btn     = document.getElementById('gv2-grid-btn');
    gv.overlay = document.getElementById('gv2-grid-view');
    gv.closer  = document.getElementById('gv2-grid-close-btn-tray');
    gv.slider     = document.getElementById('gv2-grid-size-slider-tray');
    gv.sliderMain = document.getElementById('gv2-grid-size-slider-main');
    gv.body       = document.getElementById('gv2-grid-body');
    gv.modal      = document.getElementById('gallery-modal');
  }

  function initGrid() {
    _syncGridRefs();
    if (!gv.btn || !gv.overlay) return;

    // Load wrap setting
    if (state.gallery.gridWrap === undefined) {
      state.gallery.gridWrap = localStorage.getItem('tj_gridWrap') !== '0';
    }
    const wrapChk = document.getElementById('gv2-grid-wrap-chk');
    if (wrapChk) wrapChk.checked = state.gallery.gridWrap;

    // Use our global dropdown helper for the new menu
    if (typeof setupDropdown === 'function') {
      setupDropdown('gv2-grid-options-btn', 'gv2-grid-options-menu');
      const menu = document.getElementById('gv2-grid-options-menu');
      if (menu) menu.addEventListener('click', e => e.stopPropagation());
    }

    gv.btn.onclick = () => {
      toggleGridView(!gv.isOpen);
    };

    if (gv.closer) {
      gv.closer.onclick = () => {
        toggleGridView(false);
      };
    }

    const _onSliderInput = (e) => {
      gv.currentSize = parseInt(e.target.value, 10);
      if (gv.slider) gv.slider.value = gv.currentSize;
      if (gv.sliderMain) gv.sliderMain.value = gv.currentSize;

      const main = document.querySelector('.gv2-grid-main');
      if (main) main.style.setProperty('--grid-img-size', gv.currentSize + 'px');

      localStorage.setItem('tj_gridSz', String(gv.currentSize));

      // Also scale the thumb strip proportionally (no upper limit)
      const thumbSz = Math.round(gv.currentSize / 2.8);
      document.documentElement.style.setProperty('--thumb-size', thumbSz + 'px');
      localStorage.setItem('tj_thumbSz', String(thumbSz));
    };

    if (gv.slider) gv.slider.addEventListener('input', _onSliderInput);
    if (gv.sliderMain) gv.sliderMain.addEventListener('input', _onSliderInput);

    // Load saved size or use default (no upper limit)
    const savedGridSz = parseInt(localStorage.getItem('tj_gridSz') || String(gv.currentSize), 10);
    gv.currentSize = Math.max(80, savedGridSz);

    // Initial sync
    const main = document.querySelector('.gv2-grid-main');
    if (main) main.style.setProperty('--grid-img-size', gv.currentSize + 'px');
    if (gv.slider) gv.slider.value = gv.currentSize;
    if (gv.sliderMain) gv.sliderMain.value = gv.currentSize;

    // Sync thumb strip to saved size (no upper limit)
    const initThumbSz = Math.round(gv.currentSize / 2.8);
    document.documentElement.style.setProperty('--thumb-size', initThumbSz + 'px');
  }

  function toggleGridView(show) {
    _syncGridRefs(); // Always get fresh refs before rendering
    gv.isOpen = show;
    if (gv.overlay) {
      gv.overlay.style.display = show ? 'flex' : 'none';
      gv.btn.classList.toggle('active', show);
      if (gv.modal) gv.modal.classList.toggle('grid-open', show);
      
      // Move recording bars into sidebar for Grid View, or back to tray for Normal View
      const recBars = document.getElementById('gv2-tray-record-bars');
      if (recBars) {
        if (show) {
          const sidebarRecord = document.getElementById('gv2-sidebar-record');
          if (sidebarRecord) sidebarRecord.after(recBars);
        } else {
          const trayRecWrap = document.getElementById('gv2-tray-record-wrap');
          if (trayRecWrap) trayRecWrap.appendChild(recBars);
        }
      }

      // Toggle tray options visibility
      document.querySelectorAll('.gv2-grid-only').forEach(el => {
        el.style.display = show ? 'flex' : 'none';
      });

      if (show) {
        renderGridContent();
      }
    }
  }

  function gridMenuNavigateDate(dir) {
    if (typeof navigateGalleryDate === 'function') {
      navigateGalleryDate(dir);
      renderGridContent();
    }
  }
  window.gridMenuNavigateDate = gridMenuNavigateDate;

  function toggleGridWrap(e) {
    if (e) e.stopPropagation();
    state.gallery.gridWrap = !state.gallery.gridWrap;
    localStorage.setItem('tj_gridWrap', state.gallery.gridWrap ? '1' : '0');
    const chk = document.getElementById('gv2-grid-wrap-chk');
    if (chk) chk.checked = state.gallery.gridWrap;
    renderGridContent();
  }
  window.toggleGridWrap = toggleGridWrap;

  function _filterByImgType(imgs) {
    const f = state.gallery.imgTypeFilter || 'both';
    if (f === 'both') return imgs;
    return imgs.filter(u => (state.imgTypes || {})[u] === f);
  }

  function renderGridContent() {
    if (!gv.body) return;

    try {
      // Sync Sidebar & Main Content Labels
      const sidebarDate = document.getElementById('gv2-sidebar-date-pill');
      const mainCounter = document.getElementById('gv2-grid-main-counter');
      const sidebarRec = document.getElementById('gv2-sidebar-record');
      
      if (sidebarDate) sidebarDate.textContent = state.gallery.date || 'No Date';
      if (mainCounter) {
        const total = (state.gallery.images || []).length;
        const cur = (state.gallery.currentIndex || 0) + 1;
        mainCounter.textContent = total > 0 ? `${cur} / ${total} images` : 'No images';
      }
      if (sidebarRec) {
        const mainRec = document.getElementById('gv2-record-toggle-btn');
        if (mainRec) {
          const isActive = mainRec.classList.contains('active');
          sidebarRec.classList.toggle('active', isActive);
          const iconEl = sidebarRec.querySelector('.gv2-si-icon');
          if (iconEl) iconEl.textContent = isActive ? '⏹' : '⏺';
          const labelEl = sidebarRec.querySelector('.gv2-si-label');
          if (labelEl) labelEl.textContent = isActive ? 'Stop Rec' : 'Record';
        }
      }

      // Sync Sidebar Filters active state
      const curFilter = state.gallery.imgTypeFilter || 'both';
      ['both', 'index', 'premium'].forEach(t => {
        const el = document.getElementById('gv2-sidebar-filter-' + t);
        if (el) el.classList.toggle('active', curFilter === t);
      });
    } catch (err) {
      console.error('Grid Sidebar sync failed:', err);
    }

    gv.body.innerHTML = '';
    const date = state.gallery.date;
    const images = state.gallery.images || [];

    if (!date) {
      if (images.length > 0) {
        renderGroup('Gallery Images', _filterByImgType(images), null);
      }
      return;
    }

    const dayData = state.dayData[date];
    const trades = getTradesForDate(date);

    // 1. NEWS Group (Contextual market news / reports)
    if (dayData && dayData.newsImages && dayData.newsImages.length > 0) {
      const filtered = _filterByImgType(dayData.newsImages);
      if (filtered.length) renderGroup('NEWS (Context)', filtered, null);
    }

    // 2. OPEN Group (Initial trade analysis)
    if (dayData && dayData.images && dayData.images.length > 0) {
      const filtered = _filterByImgType(dayData.images);
      if (filtered.length) renderGroup('OPEN (Analysis)', filtered, null);
    }

    // 2. Trade Groups
    let cumPnl = 0;
    trades.forEach((tr, i) => {
      const pnl = (typeof getTradePnl === 'function' ? getTradePnl(tr) : 0) || 0;
      cumPnl += pnl;
      const filtered = _filterByImgType(tr.images || []);
      renderGroup(null, filtered, null, pnl, tr, i, cumPnl);
    });

    // 3. CLOSE Group
    if (dayData && dayData.closeImages && dayData.closeImages.length > 0) {
      const filtered = _filterByImgType(dayData.closeImages);
      if (filtered.length) renderGroup('CLOSE (Post-Market)', filtered, null);
    }

    // 4. CLOSE GLOBAL Group
    if (dayData && dayData.closeGlobalImages && dayData.closeGlobalImages.length > 0) {
      const filtered = _filterByImgType(dayData.closeGlobalImages);
      if (filtered.length) renderGroup('CLOSE GLOBAL', filtered, null);
    }
  }

  function renderGroup(title, images, statsHtml, pnl, tradeRef, tradeIdx, cumPnl) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'gv2-grid-group';
    if (!images || images.length === 0) groupDiv.classList.add('gv2-grid-group--no-img');
    if (title === 'OPEN (Analysis)') groupDiv.id = 'grid-group-open';
    else if (title === 'NEWS (Context)') {
      groupDiv.id = 'grid-group-news';
      groupDiv.classList.add('gv2-grid-group--portrait');
    }
    else if (title === 'CLOSE (Post-Market)') groupDiv.id = 'grid-group-close';
    else if (title === 'CLOSE GLOBAL') groupDiv.id = 'grid-group-close-global';
    else if (tradeIdx !== undefined) groupDiv.id = 'grid-group-trade-' + tradeIdx;

    const hdr = document.createElement('div');
    hdr.className = 'gv2-grid-group-hdr';

    if (tradeRef && tradeIdx !== undefined) {
      // ── Structured trade header row ──────────────────────────────────
      const rawInst = (tradeRef.Instrument || tradeRef.instrument || '').toUpperCase();
      const m = rawInst.match(/^([A-Z]+)(\d{2})([1-9OND])(\d{2})(\d+)(CE|PE)$/);
      const instText = m ? `${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]} ${m[6]}` : rawInst;
      const instColor = rawInst.endsWith('CE') ? '#c084fc' : rawInst.endsWith('PE') ? 'var(--text3,#8b949e)' : '#ffd700';

      const buyTime  = (tradeRef['Buy Time']  || tradeRef.buy_time  || '').slice(0, 5);
      const sellTime = (tradeRef['Sell Time'] || tradeRef.sell_time || '').slice(0, 5);
      const type = String(tradeRef['TradeType'] || tradeRef.tradetype || '').toLowerCase();
      const entryTime = (type.includes('sell') || type.includes('short')) ? sellTime : buyTime;

      let dur = '';
      if (buyTime && sellTime) {
        try {
          const [h1,m1] = buyTime.split(':').map(Number);
          const [h2,m2] = sellTime.split(':').map(Number);
          const mins = Math.round(Math.abs(new Date(2000,0,1,h2,m2) - new Date(2000,0,1,h1,m1)) / 60000);
          dur = mins < 60 ? mins + 'm' : Math.floor(mins/60) + 'h' + (mins%60 > 0 ? ' '+mins%60+'m' : '');
        } catch(e) {}
      }

      const qty = parseFloat(tradeRef['Qty'] || tradeRef.qty || 0) || 0;
      const pt  = parseFloat(tradeRef['Pt']  || tradeRef.pt  || 0) || 0;
      const fmtPnl = v => (v >= 0 ? '+₹' : '-₹') + Math.abs(Math.round(v)).toLocaleString('en-IN');

      hdr.className += ' gv2-grid-group-hdr--trade';
      hdr.innerHTML = `
        <div class="ggr-trade-row">
          <span class="ggr-idx">T${tradeIdx + 1}</span>
          <span class="ggr-inst" style="color:${instColor}">${instText || '—'}</span>
          <div class="ggr-stats-group">
            <span class="ggr-time">${entryTime || '—'}</span>
            <span class="ggr-dur">${dur ? `[${dur}]` : ''}</span>
            <span class="ggr-qty">${qty || '—'}</span>
          </div>
          <div class="ggr-pnl-group">
            <span class="ggr-pt" style="color:${pt >= 0 ? 'var(--green,#2ecc71)' : 'var(--red,#e74c3c)'}">${Math.abs(Math.round(pt))} Pt</span>
            <span class="ggr-pnl" style="color:${pnl > 0 ? 'var(--green,#2ecc71)' : pnl < 0 ? 'var(--red,#e74c3c)' : 'var(--text2)'}">${fmtPnl(pnl)}</span>
            <span class="ggr-cum" style="color:${cumPnl >= 0 ? 'var(--green,#2ecc71)' : 'var(--red,#e74c3c)'}">${fmtPnl(cumPnl)}</span>
          </div>
        </div>
      `;
    } else {
      // ── Simple header (OPEN / CLOSE / fallback) ───────────────────────
      const titleEl = document.createElement('span');
      titleEl.className = 'gv2-grid-group-title';
      titleEl.textContent = title || '';
      hdr.appendChild(titleEl);
      if (statsHtml) {
        const statsEl = document.createElement('span');
        statsEl.className = 'gv2-grid-group-pnl';
        statsEl.textContent = statsHtml;
        statsEl.style.color = pnl > 0 ? 'var(--green)' : (pnl < 0 ? 'var(--red)' : 'var(--orange)');
        hdr.appendChild(statsEl);
      }
    }

    groupDiv.appendChild(hdr);

    const container = document.createElement('div');
    container.className = 'gv2-grid-container';

      // Native scrolling is preferred now for broader compatibility. 
      // If we need custom grab-scrolling, we should do it at the body level or with a single instance.
      if (state.gallery.gridWrap === false) {
        container.classList.add('gv2-grid-container--nowrap');
        // Let CSS handle smooth scroll and native wheel events
      }

    if (images.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'gv2-grid-empty';
      empty.innerHTML = `<span class="gv2-grid-empty-icon">＋</span> No images &nbsp;<span class="gv2-grid-empty-hint">click to add</span>`;
      if (tradeRef) {
        empty.style.cursor = 'pointer';
        empty.onclick = () => {
          const inp = document.createElement('input');
          inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
          inp.onchange = async () => {
            if (!inp.files.length) return;
            try {
              for (const file of Array.from(inp.files)) {
                const rv = await imageService.uploadImage(file);
                if (!rv.url) throw new Error('upload failed');
                if (!tradeRef.images) tradeRef.images = [];
                tradeRef.images.push(rv.url);
              }
              await saveTrades();
              renderGridContent();
              if (typeof showToast === 'function') showToast(`${inp.files.length} image(s) added`, 'success');
            } catch(e) {
              if (typeof showToast === 'function') showToast('Upload failed', 'error');
            }
          };
          inp.click();
        };
      }
      container.appendChild(empty);
      groupDiv.appendChild(container);
      gv.body.appendChild(groupDiv);
      return;
    }

    images.forEach(url => {
      const item = document.createElement('div');
      item.className = 'gv2-grid-item';

      const img = document.createElement('img');
      img.className = 'gv2-grid-img';
      img.src = resolveImageUrl(url);
      img.loading = 'lazy';

      item.appendChild(img);
      
      // Inline Delete Button (X)
      const delBtn = document.createElement('button');
      delBtn.className = 'gv2-grid-item-del';
      delBtn.innerHTML = '✕';
      delBtn.title = 'Delete image';
      delBtn.onclick = async (e) => {
          e.stopPropagation();
          const itemIdx = parseInt(item.dataset.globalIdx);
          if (isNaN(itemIdx)) return;
          if (confirm('Delete this image?')) {
              if (typeof removeGalleryImageAt === 'function') {
                  await removeGalleryImageAt(itemIdx, false);
                  renderGridContent(); // Refresh grid
              }
          }
      };
      item.appendChild(delBtn);

      // Meta: Time label if exists
      if (state.gallery.imageTimes && state.gallery.imageTimes[url]) {
          const meta = document.createElement('div');
          meta.className = 'gv2-grid-item-meta';
          const time = document.createElement('span');
          time.className = 'gv2-grid-time';
          time.textContent = state.gallery.imageTimes[url];
          meta.appendChild(time);
          item.appendChild(meta);
      }

      const idx = state.gallery.images.indexOf(url);
      if (idx >= 0) {
        item.dataset.globalIdx = idx;
        // Show selected state immediately on render
        if (state.gallery.selectedIndices?.has(idx)) {
          item.classList.add('gv2-grid-item--selected');
        }
      }

      item.onclick = (e) => {
        const itemIdx = parseInt(item.dataset.globalIdx);
        if (isNaN(itemIdx) || itemIdx < 0) return;

        if (!state.gallery.selectedIndices) state.gallery.selectedIndices = new Set();

        if (e.shiftKey) {
          // Range select
          // Safety: find the actual index of the last clicked URL in case the array changed
          let last = state.gallery.lastClickedIdx ?? itemIdx;
          
          const start = Math.min(last, itemIdx);
          const end = Math.max(last, itemIdx);
          for (let i = start; i <= end; i++) state.gallery.selectedIndices.add(i);
          state.gallery.lastClickedIdx = itemIdx;
          _gridRefreshSelection();
          return;
        }

        if (e.ctrlKey || e.metaKey) {
          // Toggle individual
          if (state.gallery.selectedIndices.has(itemIdx)) state.gallery.selectedIndices.delete(itemIdx);
          else state.gallery.selectedIndices.add(itemIdx);
          state.gallery.lastClickedIdx = itemIdx;
          _gridRefreshSelection();
          return;
        }

        // Normal click → update state and selection
        state.gallery.currentIndex = itemIdx; 
        state.gallery.selectedIndices = new Set([itemIdx]);
        state.gallery.lastClickedIdx = itemIdx;
        _gridRefreshSelection();
      };

      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const itemIdx = parseInt(item.dataset.globalIdx);
        if (isNaN(itemIdx) || itemIdx < 0) return;
        if (!state.gallery.selectedIndices) state.gallery.selectedIndices = new Set();
        if (!state.gallery.selectedIndices.has(itemIdx)) {
          state.gallery.selectedIndices = new Set([itemIdx]);
          state.gallery.lastClickedIdx = itemIdx;
          _gridRefreshSelection();
        }
        if (typeof showGalleryContextMenu === 'function') {
          showGalleryContextMenu(e.clientX, e.clientY);
        }
      });

      container.appendChild(item);
    });

    groupDiv.appendChild(container);
    gv.body.appendChild(groupDiv);
  }

  // Refresh selected-state CSS on all grid items without full re-render
  function _gridRefreshSelection() {
    if (!gv.body) return;
    const sel = state.gallery.selectedIndices || new Set();
    gv.body.querySelectorAll('.gv2-grid-item[data-global-idx]').forEach(el => {
      const i = parseInt(el.dataset.globalIdx);
      el.classList.toggle('gv2-grid-item--selected', sel.has(i));
    });
  }

  // Click on grid backdrop (not on an item) clears selection
  function _initGridBodyClickToClear() {
    if (!gv.body) return;
    gv.body.addEventListener('click', (e) => {
      if (!e.target.closest('.gv2-grid-item') && !e.target.closest('#gv2-context-menu')) {
        if (state.gallery.selectedIndices?.size > 0) {
          state.gallery.selectedIndices.clear();
          _gridRefreshSelection();
        }
      }
    });
  }

  // Highlight whichever trade header is currently stuck at the top
  function _initStickyActiveDetection() {
    if (!gv.body) return;
    gv.body.addEventListener('scroll', () => {
      const bodyTop = gv.body.getBoundingClientRect().top;
      let stuckHdr = null;
      gv.body.querySelectorAll('.gv2-grid-group-hdr').forEach(hdr => {
        const top = hdr.getBoundingClientRect().top;
        // Header is "stuck" when its top ≈ the body top (within 2px)
        if (top <= bodyTop + 2) stuckHdr = hdr;
      });
      gv.body.querySelectorAll('.gv2-grid-group-hdr').forEach(hdr => {
        hdr.classList.toggle('ggr-is-stuck', hdr === stuckHdr);
      });
    }, { passive: true });
  }

  // Hook into modal opening
  window.addEventListener('load', () => {
    initGrid();
    _initGridBodyClickToClear();
    _initStickyActiveDetection();
  });

  // Re-hook if needed or just handle ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && gv.isOpen) {
      toggleGridView(false);
      e.stopPropagation();
    }
  });

  // Ctrl + mouse wheel → adjust SIZE
  document.addEventListener('wheel', (e) => {
    const galleryOpen = document.getElementById('gallery-modal')?.classList.contains('open');
    if (!galleryOpen || !e.ctrlKey) return;
    e.preventDefault();
    const step = e.deltaY < 0 ? 20 : -20;
    gv.currentSize = Math.max(80, gv.currentSize + step);
    const main = document.querySelector('.gv2-grid-main');
    if (main) main.style.setProperty('--grid-img-size', gv.currentSize + 'px');
    if (gv.slider) gv.slider.value = gv.currentSize;
    if (gv.sliderMain) gv.sliderMain.value = gv.currentSize;
    localStorage.setItem('tj_gridSz', String(gv.currentSize));
    const thumbSz = Math.round(gv.currentSize / 2.8);
    document.documentElement.style.setProperty('--thumb-size', thumbSz + 'px');
    localStorage.setItem('tj_thumbSz', String(thumbSz));
  }, { passive: false });

  // External access
  window.toggleGridView = toggleGridView;
  window.isGridViewOpen = () => gv.isOpen;
  window.renderGridContent = renderGridContent;
  window.initGalleryGridUI = initGrid;
  window.refreshGridSelection = _gridRefreshSelection;

})();

```
