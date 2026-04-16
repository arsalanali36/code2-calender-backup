# JS - Classic Gallery (legacy /gallery-classic page)
Consolidated code context for AI assistants.


## File: `static/js/gallery-render-classic.js`
```js
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

```

## File: `static/js/gallery-ops-classic.js`
```js
/**
 * @fileoverview gallery-ops.js
 * @description Gallery context menu (right-click), group/ungroup images, move to trade/dayData.
 * @exports showGalleryContextMenu, replaceGalleryImageUrl, groupAllGalleryImages,
 *          ungroupAllGalleryImages, moveGalleryTile, showGalleryGroupDeleteConfirm,
 *          toggleGalleryGroupExpand, moveSelectedToTrade, moveSelectedToDayData
 * @reads state.gallery, state.trades, state.dayData
 * @writes trade.subImages, dayData.subImages, state.gallery (context updates)
 * @calls saveTrades, renderGallery, showToast
 */

// gallery-ops.js — Context menu, image replace, group/ungroup/tile ops,
//   showGalleryGroupDeleteConfirm, toggleGalleryGroupExpand, moveSelectedToTrade.

function showGalleryContextMenu(x, y) {
    const existing = document.getElementById('gv2-context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'gv2-context-menu';
    menu.style.position = 'fixed';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.background = 'var(--surface2)';
    menu.style.border = '1px solid var(--border)';
    menu.style.zIndex = '99999';
    menu.style.padding = '4px 0';
    menu.style.minWidth = '160px';
    menu.style.borderRadius = 'var(--radius)';
    menu.style.boxShadow = 'var(--shadow)';
    menu.style.outline = 'none';

    const ctx = getCurrentGalleryPreserveContext();
    const dateToUse = state.gallery.date || ctx.date;
    const dayTrades = dateToUse ? getTradesForDate(dateToUse) : [];

    const menuItems = [];
    let focusedItem = -1;

    const setFocusItem = (i) => {
        menuItems.forEach((it, j) => { it.style.background = j === i ? 'var(--hover)' : ''; });
        focusedItem = i;
    };

    const cleanup = () => {
        menu.remove();
        document.removeEventListener('keydown', keyHandler, true);
        document.removeEventListener('mousedown', closeMenu);
    };

    const createOpt = (text, onClick) => {
        const opt = document.createElement('div');
        opt.textContent = text;
        opt.style.cursor = 'pointer';
        opt.style.padding = '7px 16px';
        opt.style.fontSize = '0.85rem';
        opt.style.borderRadius = '2px';
        opt.onmouseenter = () => setFocusItem(menuItems.length - 1 + menuItems.indexOf(opt) - menuItems.length + 1);
        opt.onmouseleave = () => { opt.style.background = ''; };
        opt.onclick = () => { cleanup(); onClick(); };
        menuItems.push(opt);
        // Fix hover index since we push before returning
        const itemIdx = menuItems.length - 1;
        opt.onmouseenter = () => setFocusItem(itemIdx);
        return opt;
    };

    const addSep = () => {
        const s = document.createElement('div');
        s.style.height = '1px'; s.style.background = 'var(--border)'; s.style.margin = '3px 0';
        menu.appendChild(s);
    };

    const selectedIdxArr = Array.from(state.gallery.selectedIndices || []);
    if (selectedIdxArr.length === 1) {
        const selIdx = selectedIdxArr[0];
        const url = (state.gallery.images || [])[selIdx];
        const ownerTrade = getOwnerTradeForImageUrl(url);
        let isParent = false;
        let pRef = null;
        if (ownerTrade && ownerTrade.subImages && ownerTrade.subImages[url]) {
            isParent = true; pRef = ownerTrade;
        } else if (state.gallery.date && state.dayData[state.gallery.date]?.subImages?.[url]) {
            isParent = true; pRef = state.dayData[state.gallery.date];
        }

        if (isParent) {
            menu.appendChild(createOpt('Rename Group', async () => {
                const currentName = pRef.groupNames?.[url] || '';
                const newName = prompt('Enter group name:', currentName);
                if (newName !== null) {
                    pRef.groupNames = pRef.groupNames || {};
                    if (newName.trim() === '') delete pRef.groupNames[url];
                    else pRef.groupNames[url] = newName.trim();
                    saveTrades(); renderGallery();
                }
            }));
            menu.appendChild(createOpt('Ungroup', async () => {
                await removeGalleryImageAt(selIdx, false);
            }));
            menu.appendChild(createOpt('Delete Group', async () => {
                const subCount = (pRef.subImages?.[url] || []).length;
                showGalleryGroupDeleteConfirm(selIdx, subCount);
            }));
            addSep();
        }

        menu.appendChild(createOpt('Copy Image', async () => {
            try {
                const _clipRes = await imageService.copyToClipboard(url);
                if (_clipRes.success) {
                    showToast('Image copied to clipboard (System)', 'success');
                } else {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    const item = new ClipboardItem({ [blob.type]: blob });
                    await navigator.clipboard.write([item]);
                    showToast('Image copied to clipboard (Browser)', 'success');
                }
            } catch (err) {
                console.error(err);
                showToast('Failed to copy image', 'error');
            }
        }));

        menu.appendChild(createOpt('Replace Image', () => {
            const inp = document.createElement('input');
            inp.type = 'file'; inp.accept = 'image/*';
            inp.onchange = async () => {
                if (!inp.files[0]) return;
                try {
                    const rv = await imageService.uploadImage(inp.files[0]);
                    if (!rv.url) throw new Error();
                    await replaceGalleryImageUrl(url, rv.url);
                    showToast('Image replaced', 'success');
                } catch (e) { showToast('Replace failed', 'error'); }
            };
            inp.click();
        }));

        menu.appendChild(createOpt('Set as Hero', async () => {
            if (ownerTrade) {
                ownerTrade.heroImage = url;
                await saveTrades();
                showToast('Hero image updated', 'success');
            } else {
                showToast('Image does not belong to a specific trade', 'info');
            }
        }));
        addSep();
    }

    // ── Group Selected (2+ images) ──────────────────────────────────────
    if (selectedIdxArr.length >= 2) {
        menu.appendChild(createOpt('Group Selected', async () => {
            await groupAllGalleryImages();
        }));
    }

    // ── Delete Selected ─────────────────────────────────────────────────
    if (selectedIdxArr.length >= 1) {
        menu.appendChild(createOpt('Delete Selected', async () => {
            const arr = state.gallery.images || [];
            const dayDate = state.gallery.date;

            // Collect URLs to delete (including sub-images of group parents)
            const toDelete = new Set();
            selectedIdxArr.forEach(i => {
                const url = arr[i];
                if (!url) return;
                toDelete.add(url);
                const ot = getOwnerTradeForImageUrl(url);
                const subs = (ot?.subImages?.[url]) || (dayDate && state.dayData[dayDate]?.subImages?.[url]) || [];
                subs.forEach(s => toDelete.add(s));
            });

            // Backup for undo
            const backupAllTrades = JSON.stringify(state.trades);
            const backupAllDayData = JSON.stringify(state.dayData);
            const backupArr = [...arr];
            const backupCurrentIndex = state.gallery.currentIndex;
            const backupExpanded = state.gallery.expandedGroups ? new Set(state.gallery.expandedGroups) : null;

            const cleanupObj = (obj) => {
                if (!obj) return;
                obj.images = (obj.images || []).filter(u => !toDelete.has(u));
                if (obj.closeImages) obj.closeImages = obj.closeImages.filter(u => !toDelete.has(u));
                if (obj.subImages) {
                    for (const [p, subs] of Object.entries({ ...obj.subImages })) {
                        if (toDelete.has(p)) { delete obj.subImages[p]; continue; }
                        obj.subImages[p] = subs.filter(u => !toDelete.has(u));
                        if (obj.subImages[p].length === 0) delete obj.subImages[p];
                    }
                    if (Object.keys(obj.subImages).length === 0) delete obj.subImages;
                }
            };

            if (dayDate) {
                getTradesForDate(dayDate).forEach(cleanupObj);
                if (state.dayData[dayDate]) cleanupObj(state.dayData[dayDate]);
            }

            state.gallery.images = arr.filter(u => !toDelete.has(u));
            state.gallery.selectedIndices = new Set();
            if (state.gallery.currentIndex >= state.gallery.images.length)
                state.gallery.currentIndex = Math.max(0, state.gallery.images.length - 1);
            if (state.gallery.expandedGroups) toDelete.forEach(u => state.gallery.expandedGroups.delete(u));

            const thumbsEl = document.getElementById('gallery-thumbs');
            const savedScroll = thumbsEl ? thumbsEl.scrollLeft : 0;

            syncGalleryImageOrderToTrades();
            state.gallery._skipScrollIntoView = true;
            renderGallery(); renderTable(); renderCalendar();
            await saveTrades();

            window.galleryUndoStack = window.galleryUndoStack || [];
            window.galleryUndoStack.push({ backupAllTrades, backupAllDayData, backupArr, backupCurrentIndex, backupExpanded, dayDate });
            const t = document.getElementById('toast');
            t.innerHTML = `Deleted ${toDelete.size} image(s). <button id="undo-del-btn" style="margin-left:10px;padding:2px 8px;background:var(--blue);color:#fff;border:none;border-radius:4px;cursor:pointer;" onclick="performGalleryUndo()">Undo</button>`;
            t.className = 'toast success show';
            setTimeout(() => { t.className = 'toast'; }, 4000);
        }));
    }

    addSep();

    const parentOpItem = createOpt('Consolidate \u25B6', () => { });
    parentOpItem.style.position = 'relative';
    const subMenu = document.createElement('div');
    subMenu.style.display = 'none';
    subMenu.style.position = 'absolute';
    subMenu.style.left = '100%';
    subMenu.style.top = '0';
    subMenu.style.background = 'var(--surface2)';
    subMenu.style.border = '1px solid var(--border)';
    subMenu.style.zIndex = '100000';
    subMenu.style.padding = '4px 0';
    subMenu.style.minWidth = '160px';
    subMenu.style.borderRadius = 'var(--radius)';
    subMenu.style.boxShadow = 'var(--shadow)';

    parentOpItem.appendChild(subMenu);

    const createSubOpt = (text, onClick) => {
        const opt = document.createElement('div');
        opt.textContent = text;
        opt.style.cursor = 'pointer';
        opt.style.padding = '7px 16px';
        opt.style.fontSize = '0.85rem';
        opt.style.whiteSpace = 'nowrap';
        opt.onmouseenter = () => { opt.style.background = 'var(--hover)'; };
        opt.onmouseleave = () => { opt.style.background = ''; };
        opt.onclick = (e) => { e.stopPropagation(); cleanup(); onClick(); };
        return opt;
    };

    subMenu.appendChild(createSubOpt('Open', () => moveSelectedToDayData(dateToUse, false)));
    dayTrades.forEach((tr, i) => {
        subMenu.appendChild(createSubOpt(`Trade ${i + 1}`, () => moveSelectedToTrade(dateToUse, tr)));
    });
    subMenu.appendChild(createSubOpt('Close', () => moveSelectedToDayData(dateToUse, true)));

    parentOpItem.onmouseenter = () => {
        parentOpItem.style.background = 'var(--hover)';
        subMenu.style.display = 'block';

        // Recalculate layout based on absolute positioning from viewport
        requestAnimationFrame(() => {
            const menuRect = menu.getBoundingClientRect();
            const subMenuRect = subMenu.getBoundingClientRect();

            // Re-adjust horizontal alignment
            if (menuRect.right + subMenuRect.width > window.innerWidth) {
                subMenu.style.left = 'auto';
                subMenu.style.right = '100%';
            } else {
                subMenu.style.right = 'auto';
                subMenu.style.left = '100%';
            }

            // Re-adjust vertical alignment (if it goes off screen on bottom)
            const parentRect = parentOpItem.getBoundingClientRect();
            if (parentRect.top + subMenuRect.height > window.innerHeight) {
                subMenu.style.top = 'auto';
                subMenu.style.bottom = '0';
            } else {
                subMenu.style.bottom = 'auto';
                subMenu.style.top = '0';
            }
        });
    };
    parentOpItem.onmouseleave = () => {
        parentOpItem.style.background = '';
        subMenu.style.display = 'none';
        subMenu.style.top = '0';
        subMenu.style.bottom = 'auto';
        subMenu.style.left = '100%';
        subMenu.style.right = 'auto';
    };
    menu.appendChild(parentOpItem);

    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    if (rect.bottom > window.innerHeight) menu.style.top = Math.max(0, y - rect.height) + 'px';
    if (rect.right > window.innerWidth) menu.style.left = Math.max(0, x - rect.width) + 'px';

    const keyHandler = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault(); e.stopPropagation();
            setFocusItem((focusedItem + 1) % menuItems.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault(); e.stopPropagation();
            setFocusItem((focusedItem - 1 + menuItems.length) % menuItems.length);
        } else if (e.key === 'Enter') {
            e.preventDefault(); e.stopPropagation();
            if (focusedItem >= 0 && menuItems[focusedItem]) menuItems[focusedItem].click();
        } else if (e.key === 'Escape') {
            e.preventDefault(); e.stopPropagation(); cleanup();
        }
    };
    document.addEventListener('keydown', keyHandler, true);

    const closeMenu = (e) => { if (!menu.contains(e.target)) cleanup(); };
    setTimeout(() => document.addEventListener('mousedown', closeMenu), 0);
}

async function replaceGalleryImageUrl(oldUrl, newUrl) {
    const repIn = (obj, key) => { if (obj && obj[key] !== undefined) { obj[newUrl] = obj[key]; delete obj[key]; } };
    state.trades.forEach(t => {
        t.images = (t.images || []).map(u => u === oldUrl ? newUrl : u);
        if (t.subImages) {
            const ns = {};
            for (const [p, s] of Object.entries(t.subImages)) ns[p === oldUrl ? newUrl : p] = s.map(u => u === oldUrl ? newUrl : u);
            t.subImages = ns;
        }
        if (t.groupNames) {
            const ng = {};
            for (const [p, n] of Object.entries(t.groupNames)) ng[p === oldUrl ? newUrl : p] = n;
            t.groupNames = ng;
        }
        repIn(t.overlays, oldUrl); repIn(t.marqueeBoxes, oldUrl);
        if (t._imageTags) repIn(t._imageTags, oldUrl);
    });
    for (const dd of Object.values(state.dayData || {})) {
        dd.images = (dd.images || []).map(u => u === oldUrl ? newUrl : u);
        if (dd.subImages) {
            const ns = {};
            for (const [p, s] of Object.entries(dd.subImages)) ns[p === oldUrl ? newUrl : p] = s.map(u => u === oldUrl ? newUrl : u);
            dd.subImages = ns;
        }
        if (dd.groupNames) {
            const ng = {};
            for (const [p, n] of Object.entries(dd.groupNames)) ng[p === oldUrl ? newUrl : p] = n;
            dd.groupNames = ng;
        }
        repIn(dd.overlays, oldUrl); repIn(dd.marqueeBoxes, oldUrl);
    }
    state.gallery.images = (state.gallery.images || []).map(u => u === oldUrl ? newUrl : u);
    if (state.gallery.expandedGroups?.has(oldUrl)) { state.gallery.expandedGroups.delete(oldUrl); state.gallery.expandedGroups.add(newUrl); }
    if (state._localOverlays?.[oldUrl]) { state._localOverlays[newUrl] = state._localOverlays[oldUrl]; delete state._localOverlays[oldUrl]; }
    syncGalleryImageOrderToTrades();
    await saveTrades();
    renderGallery(); renderTable();
}

async function groupAllGalleryImages() {
    const arr = state.gallery.images || [];
    const sel = state.gallery.selectedIndices;
    if (sel && sel.size >= 2) {
        // Group selected images: lowest-index selected = parent, rest = sub-images
        const sortedIndices = Array.from(sel).sort((a, b) => a - b);
        const parentIdx = sortedIndices[0];
        const childIndices = sortedIndices.slice(1);
        await handleDropAsSubImage(childIndices, parentIdx);
    } else {
        if (arr.length < 2) { showToast('Need at least 2 images to group', 'info'); return; }
        const indices = arr.slice(1).map((_, i) => i + 1);
        await handleDropAsSubImage(indices, 0);
    }
}

async function ungroupAllGalleryImages() {
    const sel = state.gallery.selectedIndices;
    const arr = state.gallery.images || [];

    // If exactly 1 image selected and it's a group parent → ungroup only that group
    if (sel && sel.size === 1) {
        const selIdx = Array.from(sel)[0];
        const url = arr[selIdx];
        const ownerTrade = getOwnerTradeForImageUrl(url);
        const dayDate = state.gallery.date;
        const isParent = (ownerTrade?.subImages?.[url]?.length > 0)
            || (dayDate && state.dayData[dayDate]?.subImages?.[url]?.length > 0);
        if (isParent) {
            await removeGalleryImageAt(selIdx, false); // promote sub-images to top-level
            return;
        }
    }

    // Otherwise flatten all groups
    const dateKey = state.gallery.date;
    if (!dateKey) { showToast('No date context', 'info'); return; }
    let changed = false;
    const flatten = (obj) => {
        if (!obj?.subImages) return;
        for (const [pUrl, subs] of Object.entries({ ...obj.subImages })) {
            obj.images = (obj.images || []).concat(subs);
            delete obj.subImages[pUrl];
            if (state.gallery.expandedGroups) state.gallery.expandedGroups.delete(pUrl);
            changed = true;
        }
        if (obj.subImages && Object.keys(obj.subImages).length === 0) delete obj.subImages;
    };
    getTradesForDate(dateKey).forEach(flatten);
    if (state.dayData[dateKey]) flatten(state.dayData[dateKey]);
    if (!changed) { showToast('No groups to ungroup', 'info'); return; }
    state.gallery.images = getImagesForDate(dateKey);
    state.gallery.currentIndex = 0;
    syncGalleryImageOrderToTrades();
    await saveTrades();
    renderGallery(); renderTable();
    showToast('All groups ungrouped', 'success');
}

async function moveGalleryTile(dir) {
    const arr = state.gallery.images || [];
    if (arr.length < 2) return;
    const indices = (state.gallery.selectedIndices?.size > 0)
        ? Array.from(state.gallery.selectedIndices).sort((a, b) => a - b)
        : [state.gallery.currentIndex];
    if (dir < 0) {
        if (indices[0] <= 0) return;
        for (const i of indices) { const t = arr[i - 1]; arr[i - 1] = arr[i]; arr[i] = t; }
        state.gallery.selectedIndices = new Set(indices.map(i => i - 1));
        state.gallery.currentIndex = Math.max(0, state.gallery.currentIndex - 1);
    } else {
        if (indices[indices.length - 1] >= arr.length - 1) return;
        for (let i = indices.length - 1; i >= 0; i--) {
            const idx = indices[i]; const t = arr[idx + 1]; arr[idx + 1] = arr[idx]; arr[idx] = t;
        }
        state.gallery.selectedIndices = new Set(indices.map(i => i + 1));
        state.gallery.currentIndex = Math.min(arr.length - 1, state.gallery.currentIndex + 1);
    }
    syncGalleryImageOrderToTrades();
    await saveTrades();
    renderGallery(); renderTable();
}


```

## File: `static/js/gallery-core-classic.js`
```js
/**
 * @fileoverview gallery-core.js
 * @description Tag-scope helpers: resolve image tags, filter/scope gallery by tag selection.
 * @exports _getTagsForImageUrl, getAllGalleryImagesAcrossDates, _getSubImagesForParent,
 *          getFilteredGalleryImagesByTagSelection, applyGalleryImageScopeByTagFilter,
 *          getCurrentGalleryPreserveContext, findGalleryContextByImageUrl,
 *          getImageTagsForGalleryItem
 * @reads state.gallery, state.trades, state.dayData, state.tagGroups
 * @writes state.gallery.images, state.gallery.currentIndex (on scope change)
 * @calls renderGallery
 */

// gallery-core.js — tag helpers, scope/filter functions, applyGalleryImageScopeByTagFilter

function _getTagsForImageUrl(url) {
  const tags = new Set();
  state.trades.forEach(trade => {
    if (!(trade.images || []).includes(url)) return;
    getImageTagsForUrl(trade, url).forEach(t => tags.add(t));
  });
  getMarqueeTagsForImage(url, '', null).forEach(t => tags.add(t));
  return Array.from(tags);
}

function getImageTagsForGalleryItem(item) {
  const tags = new Set();
  if (!item || !item.url) return [];
  if (item.sourceRow !== null && state.trades[item.sourceRow]) {
    getImageTagsForUrl(state.trades[item.sourceRow], item.url).forEach(t => tags.add(t));
  } else if (item.date) {
    getDayImageTagsForUrl(item.date, item.url).forEach(t => tags.add(t));
  }
  getMarqueeTagsForImage(item.url, item.date || '', item.sourceRow).forEach(t => tags.add(t));
  return Array.from(tags);
}

function getAllGalleryImagesAcrossDates() {
  const out = [];
  getDatesWithImages().forEach(d => {
    (state.dayData[d]?.images || []).forEach(url => {
      out.push({ url, date: d, sourceRow: null });
    });
    for (let i = 0; i < state.trades.length; i++) {
      const t = state.trades[i];
      if (normalizeDate(extractDateFromTrade(t)) !== d) continue;
      (t.images || []).forEach(url => out.push({ url, date: d, sourceRow: i }));
    }
  });
  return out;
}

function _getSubImagesForParent(parentUrl, date, sourceRow) {
  if (sourceRow !== null && sourceRow !== undefined && state.trades[sourceRow]?.subImages?.[parentUrl]?.length) {
    return state.trades[sourceRow].subImages[parentUrl];
  }
  if (date && state.dayData[date]?.subImages?.[parentUrl]?.length) {
    return state.dayData[date].subImages[parentUrl];
  }
  for (const [, v] of Object.entries(state.dayData || {})) {
    if (v?.subImages?.[parentUrl]?.length) return v.subImages[parentUrl];
  }
  for (const t of state.trades || []) {
    if (t.subImages?.[parentUrl]?.length) return t.subImages[parentUrl];
  }
  return [];
}

function getFilteredGalleryImagesByTagSelection() {
  const tagFilter = Array.isArray(state.gallery.tagFilter) ? state.gallery.tagFilter : [];
  if (!tagFilter.length) return [];
  const mode = state.gallery.filterMode === 'and' ? 'and' : 'or';
  const groupMode = state.gallery.filterGroupMode !== 'image'; // default: group
  const norm = t => (typeof t === 'string' ? t : String(t)).toLowerCase().trim();
  const normFilter = tagFilter.map(norm);
  const matchesFilter = (item) => {
    const arr = getImageTagsForGalleryItem(item).map(norm);
    return mode === 'and' ? normFilter.every(t => arr.includes(t)) : normFilter.some(t => arr.includes(t));
  };
  const allItems = getAllGalleryImagesAcrossDates();
  if (!groupMode) {
    // Image mode: only directly matching top-level images
    return allItems.filter(item => matchesFilter(item));
  } else {
    // Group mode: if parent OR any sub-image matches → include parent
    const result = []; const added = new Set();
    allItems.forEach(item => {
      if (added.has(item.url)) return;
      if (matchesFilter(item)) {
        result.push(item); added.add(item.url);
      } else {
        const subs = _getSubImagesForParent(item.url, item.date, item.sourceRow);
        if (subs.some(subUrl => matchesFilter({ url: subUrl, date: item.date, sourceRow: item.sourceRow }))) {
          result.push(item); added.add(item.url);
        }
      }
    });
    return result;
  }
}

function findGalleryContextByImageUrl(imageUrl) {
  if (!imageUrl) return { date: '', sourceRow: null };
  if (state.gallery._baseDate) {
    const baseRowIdx = state.trades.findIndex(t =>
      normalizeDate(extractDateFromTrade(t)) === state.gallery._baseDate &&
      Array.isArray(t.images) &&
      t.images.includes(imageUrl)
    );
    if (baseRowIdx >= 0) return { date: state.gallery._baseDate, sourceRow: baseRowIdx };
  }
  for (let i = 0; i < state.trades.length; i++) {
    const t = state.trades[i];
    if (Array.isArray(t.images) && t.images.includes(imageUrl)) {
      return { date: normalizeDate(extractDateFromTrade(t)), sourceRow: i };
    }
  }
  for (const [d, v] of Object.entries(state.dayData || {})) {
    if ((v?.images || []).includes(imageUrl)) return { date: d, sourceRow: null };
  }
  return { date: '', sourceRow: null };
}

function applyGalleryImageScopeByTagFilter(preserveUrl = '') {
  const preserve = (typeof preserveUrl === 'object' && preserveUrl)
    ? preserveUrl
    : { url: preserveUrl || '' };
  const filterActive = Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length > 0;
  let nextImages;
  let nextMeta = null;
  if (filterActive) {
    nextMeta = getFilteredGalleryImagesByTagSelection();
    // In Grp mode: if any group parents are expanded, insert their sub-images after the parent
    if (state.gallery.filterGroupMode !== 'image' && state.gallery.expandedGroups?.size) {
      const expanded = [];
      for (const item of nextMeta) {
        expanded.push(item);
        if (state.gallery.expandedGroups.has(item.url)) {
          const subs = _getSubImagesForParent(item.url, item.date, item.sourceRow);
          subs.forEach(subUrl => expanded.push({ url: subUrl, date: item.date, sourceRow: item.sourceRow }));
        }
      }
      nextMeta = expanded;
    }
    nextImages = nextMeta.map(x => x.url);
  } else if (Array.isArray(state.gallery._baseImages) && state.gallery._baseImages.length) {
    nextImages = [...state.gallery._baseImages];
    state.gallery.date = state.gallery._baseDate || '';
    state.gallery.sourceRow = state.gallery._baseSourceRow ?? null;
  } else {
    nextImages = [...(state.gallery.images || [])];
  }

  state.gallery.images = nextImages;
  state.gallery._filteredMeta = nextMeta;
  if (!nextImages.length) {
    state.gallery.currentIndex = 0;
    return;
  }

  const keepUrl = preserve.url || '';
  let idx = -1;
  if (keepUrl && nextMeta && (preserve.date || preserve.sourceRow !== undefined)) {
    idx = nextMeta.findIndex(m =>
      m.url === keepUrl &&
      normalizeDate(m.date || '') === normalizeDate(preserve.date || '') &&
      (m.sourceRow ?? null) === (preserve.sourceRow ?? null)
    );
  }
  if (idx < 0 && keepUrl) idx = nextImages.indexOf(keepUrl);
  state.gallery.currentIndex = idx >= 0 ? idx : 0;

  const currentUrl = nextImages[state.gallery.currentIndex] || '';
  const ctx = (state.gallery._filteredMeta && state.gallery._filteredMeta[state.gallery.currentIndex])
    ? {
      date: state.gallery._filteredMeta[state.gallery.currentIndex].date || '',
      sourceRow: state.gallery._filteredMeta[state.gallery.currentIndex].sourceRow ?? null
    }
    : findGalleryContextByImageUrl(currentUrl);
  state.gallery.date = ctx.date || '';
  state.gallery.sourceRow = ctx.sourceRow;
}

function getCurrentGalleryPreserveContext() {
  const idx = Math.max(0, Math.min((state.gallery.images || []).length - 1, state.gallery.currentIndex || 0));
  const url = (state.gallery.images || [])[idx] || '';
  if (!url) return { url: '' };
  const meta = state.gallery._filteredMeta && state.gallery._filteredMeta[idx];
  if (meta && meta.url === url) {
    return {
      url,
      date: normalizeDate(meta.date || ''),
      sourceRow: meta.sourceRow ?? null
    };
  }
  const ctx = findGalleryContextByImageUrl(url);
  return { url, date: normalizeDate(ctx.date || ''), sourceRow: ctx.sourceRow ?? null };
}


```

## File: `static/js/gallery-open-classic.js`
```js
/**
 * @fileoverview gallery-open.js
 * @description Opens gallery modal for a date or arbitrary image list; body scroll lock.
 * @exports openGalleryForDate, openGalleryDirect, openGalleryForDateWithTagFilter,
 *          lockBodyScroll, unlockBodyScroll
 * @reads state.trades, state.dayData
 * @writes state.gallery (images, date, currentIndex, sourceRow, tagFilter, selectedSeparator)
 * @calls renderGallery, lockBodyScroll
 */

// gallery-open.js — openGalleryForDate, openGalleryDirect, openGalleryForDateWithTagFilter, lock/unlockBodyScroll

function openGalleryForDate(dateStr) {
  const images = getImagesForDate(dateStr);
  if (!images.length) return;
  state.gallery.images = images; state.gallery.currentIndex = 0; state.gallery.tagFilter = [];
  state.gallery.date = dateStr; state.gallery.sourceRow = null;
  state.gallery._baseImages = [...images];
  state.gallery.selectedIndices = state.gallery.selectedIndices || new Set();
  state.gallery._baseDate = dateStr;
  state.gallery._baseSourceRow = null;
  lockBodyScroll();
  document.getElementById('gallery-modal').classList.add('open');
  renderGallery(); updateGalleryDateArrows();
  renderGalleryTagCloud(); renderGalleryTagsTray(); renderGalleryTagFilterPanel();
  const tray1 = document.getElementById('gv2-tags-tray');
  const btn1 = document.getElementById('gv2-tags-btn');
  if (tray1) tray1.style.display = 'flex';
  if (btn1) btn1.classList.add('active');
  if (state.gallery.showTime) fetchImageTimesForGallery();
}

function openGalleryDirect(images, startIndex, sourceRow = null) {
  state.gallery.images = images; state.gallery.currentIndex = startIndex; state.gallery.tagFilter = [];
  state.gallery.date = ''; state.gallery.sourceRow = sourceRow;
  state.gallery._baseImages = [...images];
  state.gallery.selectedIndices = state.gallery.selectedIndices || new Set();
  state.gallery._baseDate = '';
  state.gallery._baseSourceRow = sourceRow;
  lockBodyScroll();
  document.getElementById('gallery-modal').classList.add('open');
  renderGallery(); updateGalleryDateArrows();
  renderGalleryTagCloud(); renderGalleryTagsTray(); renderGalleryTagFilterPanel();
  const tray2 = document.getElementById('gv2-tags-tray');
  const btn2 = document.getElementById('gv2-tags-btn');
  if (tray2) tray2.style.display = 'flex';
  if (btn2) btn2.classList.add('active');
  if (state.gallery.showTime) fetchImageTimesForGallery();
}

function lockBodyScroll() {
  document.body.classList.add('modal-open');
}

function unlockBodyScroll() {
  if (document.querySelector('.modal-overlay.open')) return;
  document.body.classList.remove('modal-open');
}

function openGalleryForDateWithTagFilter(dateStr, tags = []) {
  const cleanTags = Array.from(new Set((tags || []).map(t => String(t || '').trim()).filter(Boolean)));
  openGalleryForDate(dateStr);
  state.gallery.tagFilter = cleanTags;
  const keep = {
    url: (state.gallery.images || [])[state.gallery.currentIndex] || '',
    date: normalizeDate(dateStr || ''),
    sourceRow: null
  };
  if (cleanTags.length) applyGalleryImageScopeByTagFilter(keep);
  renderGalleryTagCloud();
  renderGallery();
  updateGalleryDateArrows();
}

```

## File: `static/js/gallery-rubberband-classic.js`
```js
// gallery-rubberband.js — thumb dock rubber-band selection + pan
// Called from renderGallery() after the thumb strip is built.

function bindGalleryRubberbandAndPan(thumbs) {
  if (!thumbs || (typeof IS_TOUCH_DEVICE !== 'undefined' && IS_TOUCH_DEVICE)) return;

  // Remove previous listener to prevent accumulation across re-renders
  if (thumbs._rbHandler) thumbs.removeEventListener('mousedown', thumbs._rbHandler);

  let _rbStart = null;
  let _rbEl = thumbs.querySelector('.gv2-rubberband');
  if (!_rbEl) {
    _rbEl = document.createElement('div');
    _rbEl.className = 'gv2-rubberband';
    thumbs.style.position = 'relative';
    thumbs.appendChild(_rbEl);
  }

  const _rbMousedown = (e) => {
    if (e.button !== 0 || e.target.closest('.gv2-thumb-wrap')) return;
    e.preventDefault();

    // ── Ctrl+click on empty area → rubber-band selection ──
    if (e.ctrlKey || e.metaKey) {
      const dockRect = thumbs.getBoundingClientRect();
      _rbStart = { x: e.clientX - dockRect.left + thumbs.scrollLeft, y: e.clientY - dockRect.top + thumbs.scrollTop };
      _rbEl.style.display = 'block';
      _rbEl.style.left = _rbStart.x + 'px'; _rbEl.style.top = _rbStart.y + 'px';
      _rbEl.style.width = '0'; _rbEl.style.height = '0';
      const _rbMove = (me) => {
        const dr = thumbs.getBoundingClientRect();
        const EDGE = 50, SPEED = 12;
        if (me.clientX < dr.left + EDGE) thumbs.scrollLeft -= SPEED;
        else if (me.clientX > dr.right - EDGE) thumbs.scrollLeft += SPEED;
        const cx = me.clientX - dr.left + thumbs.scrollLeft;
        const cy = me.clientY - dr.top + thumbs.scrollTop;
        const x = Math.min(cx, _rbStart.x), y = Math.min(cy, _rbStart.y);
        _rbEl.style.left = x + 'px'; _rbEl.style.top = y + 'px';
        _rbEl.style.width = Math.abs(cx - _rbStart.x) + 'px';
        _rbEl.style.height = Math.abs(cy - _rbStart.y) + 'px';
      };
      const _rbUp = (ue) => {
        const rbRect = _rbEl.getBoundingClientRect();
        _rbEl.style.display = 'none';
        if (rbRect.width > 4 || rbRect.height > 4) {
          const savedScroll = thumbs.scrollLeft;
          if (!ue.shiftKey && !ue.ctrlKey && !ue.metaKey) {
            if (state.gallery.selectedIndices) state.gallery.selectedIndices.clear();
            else state.gallery.selectedIndices = new Set();
          } else if (!state.gallery.selectedIndices) {
            state.gallery.selectedIndices = new Set();
          }
          thumbs.querySelectorAll('.gv2-thumb-wrap').forEach(wrap => {
            if (wrap.dataset.globalIdx === undefined) return;
            const wRect = wrap.getBoundingClientRect();
            const overlaps = !(rbRect.right < wRect.left || rbRect.left > wRect.right || rbRect.bottom < wRect.top || rbRect.top > wRect.bottom);
            if (overlaps) state.gallery.selectedIndices.add(parseInt(wrap.dataset.globalIdx));
          });
          renderGallery();
          setTimeout(() => { thumbs.scrollLeft = savedScroll; }, 60);
        } else {
          if (!ue.shiftKey && !ue.ctrlKey && !ue.metaKey) {
            if (state.gallery.selectedIndices?.size > 0) { state.gallery.selectedIndices.clear(); renderGallery(); }
          }
        }
        _rbStart = null;
        document.removeEventListener('mousemove', _rbMove);
        document.removeEventListener('mouseup', _rbUp);
      };
      document.addEventListener('mousemove', _rbMove);
      document.addEventListener('mouseup', _rbUp);
      return;
    }

    // ── Plain left-click on empty area → hand-cursor pan (scroll) ──
    thumbs.style.cursor = 'grabbing';
    const panStartX = e.clientX;
    const panStartScroll = thumbs.scrollLeft;
    const _panMove = (me) => {
      thumbs.scrollLeft = panStartScroll - (me.clientX - panStartX);
    };
    const _panUp = () => {
      thumbs.style.cursor = '';
      document.removeEventListener('mousemove', _panMove);
      document.removeEventListener('mouseup', _panUp);
    };
    document.addEventListener('mousemove', _panMove);
    document.addEventListener('mouseup', _panUp);
  };

  // Show hand cursor when hovering empty area (no thumb under mouse)
  if (!thumbs._hoverHandler) {
    thumbs._hoverHandler = (e) => {
      if (!e.target.closest('.gv2-thumb-wrap')) thumbs.style.cursor = 'grab';
      else thumbs.style.cursor = '';
    };
    thumbs._hoverLeave = () => { thumbs.style.cursor = ''; };
    thumbs.addEventListener('mousemove', thumbs._hoverHandler);
    thumbs.addEventListener('mouseleave', thumbs._hoverLeave);
  }

  thumbs._rbHandler = _rbMousedown;
  thumbs.addEventListener('mousedown', _rbMousedown);
}

```
