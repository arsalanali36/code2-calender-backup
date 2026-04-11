/**
 * @fileoverview gallery-render.js
 * @description Renders gallery thumbnail strip: OPEN/Trade/CLOSE separators, drag-drop, time labels.
 * @exports renderGallery, _getGalleryThumbImages
 * @reads state.gallery.{images,currentIndex,date,tagFilter,showTime,imageTimes,selectedSeparator},
 *        state.dayData, state.trades, annotState.active
 * @calls loadOverlayForCurrentImage, applyGalleryImageScopeByTagFilter,
 *        renderGalleryStats, resetZoom, stopAnnotation
 */

// gallery-render.js — renderGallery (thumbnails), renderGalleryStats, _getGalleryThumbImages

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
  document.getElementById('gallery-date').textContent = date
    ? (() => { const d = new Date(date + 'T00:00:00'); return isNaN(d) ? date : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); })()
    : `${images.length} image(s)`;
  if (date) document.getElementById('gallery-date-picker').value = date;

  const uploadBtn = document.getElementById('gallery-upload-btn');
  if (uploadBtn) uploadBtn.style.display = date ? '' : 'none';

  const obsBtn = document.getElementById('gv2-obs-btn');
  if (obsBtn) obsBtn.style.display = date ? '' : 'none';

  const img = document.getElementById('gallery-img');
  if (!annotState.active) document.getElementById('annot-canvas').style.display = 'none';
  const curUrl = images[currentIndex] || '';
  img.src = resolveImageUrl(curUrl); img.classList.remove('zoomed', 'dragging'); resetZoom();
  img.onerror = () => {
    if (!curUrl) return;
    console.error('Failed to load image:', curUrl);
    // Visual feedback instead of deletion
    img.style.opacity = '0.3';
    img.style.filter = 'grayscale(1) contrast(0.5)';
    img.title = 'Image could not be loaded. Please check your connection or link.';
    
    // We only remove if absolutely sure and it helps (e.g. broken thumbnail in filtered view)
    // But for now, let's play it safe and NOT delete anything automatically to avoid data loss.
    // if (state.gallery.tagFilter?.length) { ... }
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
  img.onclick = () => {
    openFullscreenFromAppContext(state.gallery.images, images[currentIndex]);
  };

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

  // Visual clue: filter-active state on tray + filter bar
  const _filterActive = Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length > 0;
  document.getElementById('gallery-thumbs')?.classList.toggle('filter-active', _filterActive);
  document.getElementById('gv2-tag-cloud')?.classList.toggle('filter-active', _filterActive);

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
    sep.style.minWidth = '22px';
    sep.style.height = 'calc(var(--thumb-size, 54px) * 0.85)';
    sep.style.background = 'var(--surface2)';
    sep.style.border = '1px dashed var(--border2)';
    sep.style.margin = '0 6px';
    sep.style.alignSelf = 'center';
    sep.style.borderRadius = '3px';
    sep.style.flexShrink = '0';
    sep.style.display = 'flex';
    sep.style.alignItems = 'center';
    sep.style.justifyContent = 'center';
    sep.style.fontSize = '0.75rem';
    sep.style.color = 'var(--text2)';
    sep.style.fontWeight = 'bold';
    sep.style.cursor = 'pointer';
    sep.title = `Trade ${idx + 1} (Drop to move)`;
    const isCollapsed = state.gallery.collapsedSeparators?.has('T' + idx);
    const arrow = isCollapsed ? '▸' : '▾';
    const tr = dayTrades[idx];
    const pnl = parseFloat(tr?.['Net P/L'] || tr?.net_pnl || 0) || 0;
    const pt = parseFloat(tr?.['Pt'] || tr?.pt || 0) || 0;
    const pnlStr = pnl !== 0 ? (pnl > 0 ? '+₹' : '-₹') + Math.abs(Math.round(pnl)) : '';
    const ptStr = pt !== 0 ? (pt > 0 ? '+' : '') + Math.round(pt) + 'P' : '';
    sep.textContent = `${arrow} T${idx + 1} ${pnlStr} ${ptStr}`;
    if (pnl !== 0) sep.style.color = pnl > 0 ? 'var(--green,#2ecc71)' : 'var(--red,#e74c3c)';

    sep.addEventListener('dragover', e => {
      e.preventDefault();
      sep.style.background = 'var(--hover)';
      sep.style.borderColor = '#58a6ff';
      sep.style.color = '#fff';
    });
    sep.addEventListener('dragleave', () => {
      sep.style.background = 'var(--surface2)';
      sep.style.borderColor = 'var(--border2)';
      sep.style.color = 'var(--text2)';
    });
    sep.addEventListener('drop', async e => {
      e.preventDefault();
      sep.style.background = 'var(--surface2)';
      sep.style.borderColor = 'var(--border2)';
      sep.style.color = 'var(--text2)';
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
          } else {
            await moveSelectedToTrade(state.gallery.date, tr);
          }
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
      state.gallery._skipScrollIntoView = true;
      renderGallery();
    });

    return sep;
  };

  const createSpecialSeparator = (label, isClose) => {
    const sep = document.createElement('div');
    sep.className = 'gv2-thumb-separator';
    sep.style.minWidth = '22px';
    sep.style.height = 'calc(var(--thumb-size, 54px) * 0.85)';
    sep.style.background = 'var(--surface2)';
    sep.style.border = '1px dashed var(--border2)';
    sep.style.margin = '0 6px';
    sep.style.alignSelf = 'center';
    sep.style.borderRadius = '3px';
    sep.style.flexShrink = '0';
    sep.style.display = 'flex';
    sep.style.alignItems = 'center';
    sep.style.justifyContent = 'center';
    sep.style.fontSize = '0.75rem';
    sep.style.color = 'var(--text2)';
    sep.style.fontWeight = 'bold';
    sep.style.cursor = 'pointer';
    sep.title = `${label} (Drop to move. Click to collapse)`;
    const isCollapsed = state.gallery.collapsedSeparators?.has(sepKey);
    const arrow = isCollapsed ? '▸' : '▾';
    sep.textContent = `${arrow} ${label}`;

    sep.addEventListener('dragover', e => {
      e.preventDefault();
      sep.style.background = 'var(--hover)';
      sep.style.borderColor = '#58a6ff';
      sep.style.color = '#fff';
    });
    sep.addEventListener('dragleave', () => {
      sep.style.background = 'var(--surface2)';
      sep.style.borderColor = 'var(--border2)';
      sep.style.color = 'var(--text2)';
    });
    sep.addEventListener('drop', async e => {
      e.preventDefault();
      sep.style.background = 'var(--surface2)';
      sep.style.borderColor = 'var(--border2)';
      sep.style.color = 'var(--text2)';
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
          } else {
            await moveSelectedToDayData(state.gallery.date, isClose);
          }
        }
      } catch (err) { console.error(err); }
    });
    const sepKey = isClose ? 'CLOSE' : 'OPEN';
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

      const key = 'T' + targetTradeIdx;
      if (state.gallery.collapsedSeparators?.has(key)) return;
    } else if (isCurrentDate && !ownerTrade && !isCloseImg) {
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

    const t = document.createElement('img');
    t.src = resolveImageUrl(url);
    t.className = 'gv2-thumb' + (globalIdx === currentIndex ? ' active' : '') + (state.gallery.selectedIndices?.has(globalIdx) ? ' selected-thumb' : '');
    t.onerror = () => {
      const idx = state.gallery.images.indexOf(url);
      if (idx < 0) { wrap.style.display = 'none'; return; }
      
      // Visual feedback instead of deletion
      t.style.opacity = '0.3';
      t.title = 'Image could not be loaded';
      
      /* 
      // Former aggressive deletion logic removed to prevent data loss 
      if (!state.gallery.tagFilter?.length) {
          removeGalleryImageAt(globalIdx, true).then(() => {
              console.warn('Broken thumbnail removed:', url);
          });
      } else {
          state.gallery.images.splice(idx, 1);
          state.gallery.currentIndex = Math.min(state.gallery.currentIndex, Math.max(0, state.gallery.images.length - 1));
          clearTimeout(renderGallery._brokenTimer);
          renderGallery._brokenTimer = setTimeout(() => renderGallery(), 30);
      }
      */
    };
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
  btnWrap.style.width = 'var(--thumb-size, 54px)';
  btnWrap.style.height = 'var(--thumb-size, 54px)';
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



function _getGalleryThumbImages() {
  const { images, tagFilter, _filteredMeta } = state.gallery;
  const filteredMode = Array.isArray(tagFilter) && tagFilter.length > 0;
  return (images || []).map((url, i) => {
    let date = state.gallery.date;
    let sourceRow = state.gallery.sourceRow;
    if (filteredMode && _filteredMeta) {
      const meta = _filteredMeta[i];
      if (meta && meta.url === url) { date = meta.date || ''; sourceRow = meta.sourceRow ?? null; }
    }
    return { url, globalIdx: i, isCurrentDate: !filteredMode, date, sourceRow };
  }).filter(item => !!item.url);
}
