// gallery-render-tray.js — Close-Global-Tray rendering (draggable tray + zoomable markers)
// Called by renderGallery() in gallery-render.js

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
  const zoomOverlay = document.getElementById('gallery-zoom-layer');
  if (!imgContainer || !zoomOverlay) return;

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
      tray.style.flexDirection = (nearLeft || nearRight) ? 'column' : 'row';
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

  if (!dayDataObj.navPositions) dayDataObj.navPositions = {};
  if (!dayDataObj.navPositions[curUrl]) dayDataObj.navPositions[curUrl] = {};
  const posData = dayDataObj.navPositions[curUrl];

  // Trade buttons + markers
  tradesForDay.forEach((tr, idx) => {
      const pnl = parseFloat(tr['Net P/L'] || tr.net_pnl || 0);
      const timeStr = tr['Entry Time'] || tr['entry_time'] || tr['entryTime'] || tr['Buy Time'] || tr['Time'] || tr['time'] || 'N/A';
      const pnlRounded = Math.round(pnl);
      const pnlDisplay = (pnlRounded >= 0 ? '+' : '') + pnlRounded.toLocaleString('en-IN');
      const tooltip = `Trade #${idx + 1}\nTime: ${timeStr}\nP&L: ₹${pnlDisplay}`;
      const markerColor = pnl > 0 ? '#2ecc71' : (pnl < 0 ? '#e74c3c' : '#58a6ff');

      // Marker (on image)
      const marker = document.createElement('button');
      marker.className = 'close-global-marker';
      marker.textContent = String(idx + 1);
      marker.style.cssText = `position:absolute; z-index:9999; pointer-events:auto;
          background:${markerColor}; color:#fff; border:1px solid rgba(255,255,255,0.4);
          border-radius:50%; width:24px; height:24px; font-size:0.75rem; font-weight:900;
          cursor:pointer; opacity:1; box-shadow:0 4px 12px rgba(0,0,0,0.4);`;
      marker.title = tooltip + '\n(Right-click to remove)';
      marker.oncontextmenu = (e) => { e.preventDefault(); delete posData[idx]; if (typeof saveTrades === 'function') saveTrades(); marker.style.display = 'none'; };
      if (posData[idx]) { marker.style.left = posData[idx].left; marker.style.top = posData[idx].top; marker.style.display = 'block'; }
      else { marker.style.display = 'none'; }

      // Tray button (source)
      const sourceBtn = document.createElement('button');
      sourceBtn.className = 'close-global-nav-btn';
      if (!tr.images || tr.images.length === 0) sourceBtn.classList.add('no-img');
      sourceBtn.textContent = String(idx + 1);
      sourceBtn.style.cssText = `background:${markerColor}; color:#fff; border:none;
          border-radius:50%; width:32px; height:32px; font-size:0.9rem; font-weight:900;
          cursor:grab; box-shadow:0 4px 10px rgba(0,0,0,0.3);`;
      sourceBtn.title = tooltip;
      tray.appendChild(sourceBtn);

      // Drag logic
      let isDragging = false, startX, startY, initialLeft, initialTop;
      let clickStartTime = 0, movedDuringClick = false;

      const onMouseMove = (e) => {
          if (!isDragging) return;
          movedDuringClick = true;
          const rect = zoomOverlay.getBoundingClientRect();
          const scale = rect.width / zoomOverlay.offsetWidth || 1;
          const dx = (e.clientX - startX) / scale, dy = (e.clientY - startY) / scale;
          marker.style.display = 'block';
          marker.style.left = (((initialLeft + dx) / zoomOverlay.offsetWidth) * 100) + '%';
          marker.style.top  = (((initialTop  + dy) / zoomOverlay.offsetHeight) * 100) + '%';
      };

      const onMouseUp = () => {
          if (!isDragging) return;
          isDragging = false;
          sourceBtn.style.cursor = 'grab'; marker.style.cursor = 'pointer';
          posData[idx] = { left: marker.style.left, top: marker.style.top };
          if (typeof saveTrades === 'function') saveTrades();
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
      };

      const bindDrag = (el, isSource) => {
          el.addEventListener('mousedown', (e) => {
              if (e.button !== 0) return;
              isDragging = true; clickStartTime = Date.now(); movedDuringClick = false;
              el.style.cursor = 'grabbing';
              if (isSource) {
                  const rect = zoomOverlay.getBoundingClientRect();
                  const scale = rect.width / zoomOverlay.offsetWidth || 1;
                  initialLeft = (e.clientX - rect.left) / scale;
                  initialTop  = (e.clientY - rect.top)  / scale;
              } else {
                  initialLeft = marker.offsetLeft; initialTop = marker.offsetTop;
              }
              startX = e.clientX; startY = e.clientY;
              document.addEventListener('mousemove', onMouseMove);
              document.addEventListener('mouseup', onMouseUp);
              e.preventDefault(); e.stopPropagation();
          });
      };

      bindDrag(sourceBtn, true);
      bindDrag(marker, false);

      const onClickTrade = (e) => {
          e.stopPropagation();
          if (!movedDuringClick && Date.now() - clickStartTime < 300) {
              if (typeof openTradeSidebar === 'function') openTradeSidebar(tr);
          }
      };
      marker.onclick = onClickTrade;
      sourceBtn.onclick = onClickTrade;

      navCont.appendChild(marker);
  });
}
