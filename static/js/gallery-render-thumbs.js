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
        renderGallery(); 
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (state.gallery.selectedIndices.has(globalIdx)) state.gallery.selectedIndices.delete(globalIdx);
        else state.gallery.selectedIndices.add(globalIdx);
        state.gallery.lastClickedIdx = globalIdx;
        renderGallery();
        return;
      }

      // Default: select individual
      state.gallery.selectedIndices = new Set([globalIdx]);
      state.gallery.currentIndex = globalIdx;
      state.gallery.lastClickedIdx = globalIdx;
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
  if (!_filterActive3 && !renderedCloseSep && date) thumbs.appendChild(createSpecialSeparator('CLOSE', true));
  if (!_filterActive3 && !renderedCloseGlobalSep && date) thumbs.appendChild(createSpecialSeparator('CLOSE GLOBAL', 'CLOSE_GLOBAL'));

  // ── Footer: PREMIUM + blank button + scroll (in gallery-render-thumbs-b.js)
  _renderThumbsFooter(thumbs, date, dayTrades, uniqueInsts, premiumObj,
                      savedScrollTop, savedScrollLeft, _filterActive3);
}
