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
  if (filterBar) {
    if (_filterActive) {
      const modeText = state.gallery.filterMode === 'and' ? 'ALL of' : 'ANY of';
      filterBar.innerHTML = `<span>FILTER ACTIVE (${modeText}):</span> <span style="background:#000; color:#fff; padding:2px 8px; border-radius:20px; margin-left:6px">${state.gallery.tagFilter.join(', ')}</span>`;
      filterBar.style.display = 'flex';
    } else {
      filterBar.style.display = 'none';
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
  const dayTrades = (state.gallery.date && (!Array.isArray(state.gallery.tagFilter) || state.gallery.tagFilter.length === 0))
    ? getTradesForDate(state.gallery.date)
    : [];

  const createTradeSeparator = (idx) => {
    const sep = document.createElement('div');
    sep.className = 'gv2-thumb-separator';
    sep.title = `Trade ${idx + 1} (Drop to move. Click to collapse)`;
    const sepKey = 'T' + idx;
    const isCollapsed = state.gallery.collapsedSeparators?.has(sepKey);
    const arrow = isCollapsed ? '▸' : '▾';
    const tr = dayTrades[idx];
    const pnl = parseFloat(tr?.['Net P/L'] || tr?.net_pnl || 0) || 0;
    const pt = parseFloat(tr?.['Pt'] || tr?.pt || 0) || 0;
    const pnlStr = pnl !== 0 ? (pnl > 0 ? '+₹' : '-₹') + Math.abs(Math.round(pnl)) : '';
    const ptStr = pt !== 0 ? (pt > 0 ? '+' : '') + Math.round(pt) + 'Pt' : '';
    const pnlColor = pnl > 0 ? 'var(--green,#2ecc71)' : (pnl < 0 ? 'var(--red,#e74c3c)' : '#ffd700');
    sep.innerHTML =
      `<span class="gv2-sep-label" style="color:${pnlColor}">${arrow} T${idx + 1}</span>` +
      ((pnlStr || ptStr) ? `<span class="gv2-sep-stats" style="color:${pnlColor}">${[pnlStr, ptStr].filter(Boolean).join(' · ')}</span>` : '');
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
        if (typeof moveSelectedToTrade === 'function' && dayTrades[idx]) {
          const tr = dayTrades[idx];
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

  const createSpecialSeparator = (label, isClose) => {
    const sep = document.createElement('div');
    sep.className = 'gv2-thumb-separator';
    sep.title = `${label} (Drop to move. Click to collapse)`;
    const sepKey = isClose ? 'CLOSE' : 'OPEN';
    const isCollapsed = state.gallery.collapsedSeparators?.has(sepKey);
    const arrow = isCollapsed ? '▸' : '▾';
    sep.innerHTML = `<span class="gv2-sep-label">${arrow} ${label}</span>`;
    sep.style.color = '#ffd700';
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
        if (typeof moveSelectedToDayData === 'function') {
          const dData = state.dayData[state.gallery.date];
          let arrToUse = isClose ? dData?.closeImages : dData?.images;
          if (arrToUse && arrToUse.length > 0 && typeof handleReorderGalleryImagesBatch === 'function') {
            const firstUrl = arrToUse[0];
            const insertAt = state.gallery.images.indexOf(firstUrl);
            await handleReorderGalleryImagesBatch(draggedIndices, insertAt, firstUrl);
          } else { await moveSelectedToDayData(state.gallery.date, isClose); }
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
      // Select this separator so upload button targets OPEN/CLOSE
      state.gallery.selectedSeparator = (state.gallery.selectedSeparator === sepKey) ? null : sepKey;
      state.gallery._skipScrollIntoView = true;
      renderGallery();
    });

    return sep;
  };

  if (state.gallery.date && (!Array.isArray(state.gallery.tagFilter) || state.gallery.tagFilter.length === 0)) {
    thumbs.appendChild(createSpecialSeparator('OPEN', false));
  }

  let renderedCloseSep = false;

  thumbImages.forEach(({ url, globalIdx, isCurrentDate, date: itemDate }, currentIterIdx) => {

    const ownerTrade = getOwnerTradeForImageUrl(url);
    const isCloseImg = state.gallery.date && state.dayData[state.gallery.date]?.closeImages?.includes(url);

    if (isCurrentDate && dayTrades.length > 0 && ownerTrade && !isCloseImg) {
      let targetTradeIdx = -1;
      if (ownerTrade) {
        targetTradeIdx = dayTrades.indexOf(ownerTrade);
      }

      // Add missing separators for any intervening or current trades
      while (lastTradeIdxRendered < targetTradeIdx) {
        thumbs.appendChild(createTradeSeparator(lastTradeIdxRendered + 1));
        lastTradeIdxRendered++;
      }
      
      if (state.gallery.collapsedSeparators?.has('T' + targetTradeIdx)) return;
    } else if (isCurrentDate && !ownerTrade && !isCloseImg) {
      // It's an OPEN image
      if (state.gallery.collapsedSeparators?.has('OPEN')) return;
    }

    if (isCurrentDate && isCloseImg && !renderedCloseSep && (!Array.isArray(state.gallery.tagFilter) || state.gallery.tagFilter.length === 0)) {
      // Catch up any remaining trade separators before switching to CLOSE
      if (dayTrades.length > 0) {
        while (lastTradeIdxRendered < dayTrades.length - 1) {
          thumbs.appendChild(createTradeSeparator(lastTradeIdxRendered + 1));
          lastTradeIdxRendered++;
        }
      }
      thumbs.appendChild(createSpecialSeparator('CLOSE', true));
      renderedCloseSep = true;
    }
    
    if (isCurrentDate && isCloseImg) {
      if (state.gallery.collapsedSeparators?.has('CLOSE')) return;
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
    t.addEventListener('click', (e) => {
      // Initialize if needed
      if (!state.gallery.selectedIndices) state.gallery.selectedIndices = new Set();
      
      const lastIdx = state.gallery.lastClickedIdx ?? currentIndex;

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
          // Individual toggle
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

    thumbs.appendChild(wrap);
  });

  // Append any remaining separators for trailing empty trades if CLOSE hasn't triggered it
  if (dayTrades.length > 0) {
    while (lastTradeIdxRendered < dayTrades.length - 1) {
      thumbs.appendChild(createTradeSeparator(lastTradeIdxRendered + 1));
      lastTradeIdxRendered++;
    }
  }

  if (!renderedCloseSep && state.gallery.date && (!Array.isArray(state.gallery.tagFilter) || state.gallery.tagFilter.length === 0)) {
    thumbs.appendChild(createSpecialSeparator('CLOSE', true));
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
          const rv = await imageService.uploadImage(file);
          if (rv.url) {
            const newUrl = rv.url;
            
            // Placement logic based on selected separator
            const selSep = state.gallery.selectedSeparator;
            const dayKey = state.gallery.date;
            let targetObj = null;
            let targetArray = 'images';

            if (selSep === 'OPEN') {
                targetObj = state.dayData[dayKey];
                targetArray = 'images';
            } else if (selSep === 'CLOSE') {
                targetObj = state.dayData[dayKey];
                targetArray = 'closeImages';
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
          activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }, 50);
      }
    }
  }
  state.gallery._skipScrollIntoView = false;

  // Rubber-band selection + pan — delegated to gallery-rubberband.js
  bindGalleryRubberbandAndPan(thumbs);
}
