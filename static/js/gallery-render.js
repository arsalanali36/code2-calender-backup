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
  document.getElementById('gallery-date').textContent = date ? formatDisplayDate(date) : `${images.length} image(s)`;
  if (date) document.getElementById('gallery-date-picker').value = date;

  const uploadBtn = document.getElementById('gallery-upload-btn');
  if (uploadBtn) uploadBtn.style.display = date ? '' : 'none';

  const obsBtn = document.getElementById('gv2-obs-btn');
  if (obsBtn) obsBtn.style.display = date ? '' : 'none';

  const img = document.getElementById('gallery-img');
  if (!annotState.active) document.getElementById('annot-canvas').style.display = 'none';
  const curUrl = images[currentIndex] || '';
  img.src = curUrl; img.classList.remove('zoomed', 'dragging'); resetZoom();
  img.onerror = () => {
    if (!curUrl) return;
    const idx = state.gallery.images.indexOf(curUrl);
    if (idx < 0) return;
    state.gallery.images.splice(idx, 1);
    state.gallery.currentIndex = Math.min(state.gallery.currentIndex, Math.max(0, state.gallery.images.length - 1));
    renderGallery();
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

  // Visual clue: filter-active state on tray + filter bar
  const _filterActive = Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length > 0;
  document.getElementById('gallery-thumbs')?.classList.toggle('filter-active', _filterActive);
  document.getElementById('gv2-tag-cloud')?.classList.toggle('filter-active', _filterActive);

  const thumbs = document.getElementById('gallery-thumbs'); thumbs.innerHTML = '';
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
    sep.textContent = `${idx + 1}`;

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
    sep.addEventListener('click', () => {
      document.querySelectorAll('.gv2-thumb-separator').forEach(el => el.classList.remove('selected-separator'));
      sep.classList.add('selected-separator');
      state.gallery.selectedSeparator = idx; // zero-indexed trade index
      showToast(`Selected Trade ${idx + 1} separator`, 'success');
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
    sep.title = `${label} (Drop to move)`;
    sep.textContent = label;

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
    sep.addEventListener('click', () => {
      document.querySelectorAll('.gv2-thumb-separator').forEach(el => el.classList.remove('selected-separator'));
      sep.classList.add('selected-separator');
      state.gallery.selectedSeparator = isClose ? 'CLOSE' : 'OPEN';
      showToast(`Selected ${label} separator`, 'success');
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

    if (isCurrentDate && dayTrades.length > 0 && !isCloseImg) {
      let targetTradeIdx = -1;
      if (ownerTrade) {
        targetTradeIdx = dayTrades.indexOf(ownerTrade);
      }

      // Add missing separators for any intervening or current trades
      while (lastTradeIdxRendered < targetTradeIdx) {
        thumbs.appendChild(createTradeSeparator(lastTradeIdxRendered + 1));
        lastTradeIdxRendered++;
      }
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
    t.src = url;
    t.className = 'gv2-thumb' + (globalIdx === currentIndex ? ' active' : '') + (state.gallery.selectedIndices?.has(globalIdx) ? ' selected-thumb' : '');
    t.onerror = () => {
      const idx = state.gallery.images.indexOf(url);
      if (idx < 0) { wrap.style.display = 'none'; return; }
      state.gallery.images.splice(idx, 1);
      state.gallery.currentIndex = Math.min(state.gallery.currentIndex, Math.max(0, state.gallery.images.length - 1));
      clearTimeout(renderGallery._brokenTimer);
      renderGallery._brokenTimer = setTimeout(() => renderGallery(), 30);
    };
    t.addEventListener('click', (e) => {
      if (e.shiftKey) {
        if (!state.gallery.selectedIndices) state.gallery.selectedIndices = new Set();
        if (state.gallery.selectedIndices.has(globalIdx)) state.gallery.selectedIndices.delete(globalIdx);
        else state.gallery.selectedIndices.add(globalIdx);
        renderGallery();
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        if (typeof toggleGalleryGroupExpand === 'function') {
          if (toggleGalleryGroupExpand(url)) return;
        }
      }
      state.gallery.selectedIndices = new Set([globalIdx]);
      state.gallery.currentIndex = globalIdx;
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
  btnWrap.onclick = () => {
    try {
      const cvs = document.createElement('canvas');
      cvs.width = 1920; cvs.height = 1080;
      const c = cvs.getContext('2d');
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, 1920, 1080);

      cvs.toBlob(async (blob) => {
        if (!blob) return;
        try {
          const file = new File([blob], 'blank_page_' + Date.now() + '.png', { type: 'image/png' });
          const fd = new FormData();
          fd.append('image', file);
          const uploadRes = await fetch('/api/upload-image', { method: 'POST', body: fd });
          if (!uploadRes.ok) throw new Error('Upload failed');
          const rv = await uploadRes.json();
          if (rv.url) {
            const newUrl = rv.url;
            const oT = getOwnerTradeForGalleryImage() || (state.gallery.sourceRow !== null ? state.trades[state.gallery.sourceRow] : null);
            if (oT) {
              oT.images = oT.images || []; oT.images.push(newUrl);
            } else if (state.gallery.date) {
              const d = state.dayData[state.gallery.date];
              if (d) { d.images = d.images || []; d.images.push(newUrl); }
            }
            state.gallery.images = state.gallery.images || [];
            state.gallery.images.push(newUrl);
            state.gallery.currentIndex = state.gallery.images.length - 1;
            saveTrades();
            renderGallery();
          }
        } catch (err) { console.error('Failed blank page upload', err); }
      }, 'image/png');
    } catch (e) { console.error('Failed blank page generation', e); }
  };
  thumbs.appendChild(btnWrap);

  if (thumbs.children.length > 0) {
    const activeThumb = thumbs.querySelector('.gv2-thumb.active');
    if (activeThumb) {
      setTimeout(() => {
        activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }, 50);
    }
  }

  // Rubber-band drag-select on empty thumb dock area
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
    const dockRect = thumbs.getBoundingClientRect();
    _rbStart = { x: e.clientX - dockRect.left + thumbs.scrollLeft, y: e.clientY - dockRect.top + thumbs.scrollTop };
    _rbEl.style.display = 'block';
    _rbEl.style.left = _rbStart.x + 'px'; _rbEl.style.top = _rbStart.y + 'px';
    _rbEl.style.width = '0'; _rbEl.style.height = '0';
    const _rbMove = (me) => {
      const dr = thumbs.getBoundingClientRect();
      const cx = me.clientX - dr.left + thumbs.scrollLeft;
      const cy = me.clientY - dr.top + thumbs.scrollTop;
      const x = Math.min(cx, _rbStart.x), y = Math.min(cy, _rbStart.y);
      _rbEl.style.left = x + 'px'; _rbEl.style.top = y + 'px';
      _rbEl.style.width = Math.abs(cx - _rbStart.x) + 'px';
      _rbEl.style.height = Math.abs(cy - _rbStart.y) + 'px';
    };
    const _rbUp = () => {
      const rbRect = _rbEl.getBoundingClientRect(); // must get BEFORE hiding
      _rbEl.style.display = 'none';
      if (rbRect.width > 4 || rbRect.height > 4) {
        if (!state.gallery.selectedIndices) state.gallery.selectedIndices = new Set();
        thumbs.querySelectorAll('.gv2-thumb-wrap').forEach(wrap => {
          if (wrap.dataset.globalIdx === undefined) return;
          const wRect = wrap.getBoundingClientRect();
          const overlaps = !(rbRect.right < wRect.left || rbRect.left > wRect.right || rbRect.bottom < wRect.top || rbRect.top > wRect.bottom);
          if (overlaps) state.gallery.selectedIndices.add(parseInt(wrap.dataset.globalIdx));
        });
        renderGallery();
      } else {
        // Plain click on empty area → deselect all
        if (state.gallery.selectedIndices?.size > 0) {
          state.gallery.selectedIndices.clear();
          thumbs.querySelectorAll('.selected-thumb').forEach(el => el.classList.remove('selected-thumb'));
        }
      }
      _rbStart = null;
      document.removeEventListener('mousemove', _rbMove);
      document.removeEventListener('mouseup', _rbUp);
    };
    document.addEventListener('mousemove', _rbMove);
    document.addEventListener('mouseup', _rbUp);
  };
  thumbs._rbHandler = _rbMousedown;
  thumbs.addEventListener('mousedown', _rbMousedown);
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
