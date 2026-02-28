function openGalleryForDate(dateStr) {
  const images = getImagesForDate(dateStr);
  if (!images.length) return;
  state.gallery.images = images; state.gallery.currentIndex = 0;
  state.gallery.date = dateStr; state.gallery.sourceRow = null;
  state.gallery._baseImages = [...images];
  state.gallery._baseDate = dateStr;
  state.gallery._baseSourceRow = null;
  lockBodyScroll();
  document.getElementById('gallery-modal').classList.add('open');
  renderGallery(); updateGalleryDateArrows();
  renderGalleryTagCloud(); renderGalleryTagsTray();
}

function openGalleryDirect(images, startIndex, sourceRow = null) {
  state.gallery.images = images; state.gallery.currentIndex = startIndex;
  state.gallery.date = ''; state.gallery.sourceRow = sourceRow;
  state.gallery._baseImages = [...images];
  state.gallery._baseDate = '';
  state.gallery._baseSourceRow = sourceRow;
  lockBodyScroll();
  document.getElementById('gallery-modal').classList.add('open');
  renderGallery(); updateGalleryDateArrows();
  renderGalleryTagCloud(); renderGalleryTagsTray();
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
  img.src = images[currentIndex] || ''; img.classList.remove('zoomed', 'dragging'); resetZoom();
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
  document.getElementById('gallery-prev').disabled = currentIndex === 0;
  document.getElementById('gallery-next').disabled = currentIndex === images.length - 1;
  renderGalleryImageTags();
  renderGalleryTagCloud();
  const tray = document.getElementById('gv2-tags-tray');
  if (tray && tray.style.display !== 'none') renderGalleryTagsTray();
  if (document.getElementById('img-tag-modal')?.classList.contains('open')) renderImageTagModal();

  const thumbs = document.getElementById('gallery-thumbs'); thumbs.innerHTML = '';
  const thumbImages = _getGalleryThumbImages();
  let dragFromIndex = -1;
  thumbImages.forEach(({ url, globalIdx, isCurrentDate }) => {
    const wrap = document.createElement('div'); wrap.className = 'gv2-thumb-wrap'; wrap.draggable = !IS_TOUCH_DEVICE;
    const t = document.createElement('img');
    t.src = url;
    t.className = 'gv2-thumb' + (globalIdx === currentIndex ? ' active' : '');
    t.addEventListener('click', () => { state.gallery.currentIndex = globalIdx; renderGallery(); });
    t.addEventListener('touchend', e => {
      if (IS_TOUCH_DEVICE) {
        e.preventDefault();
        state.gallery.currentIndex = globalIdx;
        renderGallery();
      }
    }, { passive: false });

    if (isCurrentDate) {
      wrap.addEventListener('dragstart', e => {
        dragFromIndex = globalIdx; wrap.classList.add('dragging');
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      });
      wrap.addEventListener('dragend', () => {
        dragFromIndex = -1; wrap.classList.remove('dragging');
        thumbs.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      });
      wrap.addEventListener('dragover', e => {
        e.preventDefault();
        if (dragFromIndex !== globalIdx) wrap.classList.add('drag-over');
      });
      wrap.addEventListener('dragleave', () => wrap.classList.remove('drag-over'));
      wrap.addEventListener('drop', async e => {
        e.preventDefault(); wrap.classList.remove('drag-over');
        if (dragFromIndex < 0 || dragFromIndex === globalIdx) return;
        await reorderGalleryImages(dragFromIndex, globalIdx);
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

    wrap.appendChild(t); wrap.appendChild(del); thumbs.appendChild(wrap);
  });
}

function _getGalleryThumbImages() {
  const { images, tagFilter } = state.gallery;
  const filteredMode = Array.isArray(tagFilter) && tagFilter.length > 0;
  return (images || []).map((url, i) => ({
    url,
    globalIdx: i,
    isCurrentDate: !filteredMode,
    date: filteredMode ? '' : state.gallery.date
  }));
}

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

function getFilteredGalleryImagesByTagSelection() {
  const tagFilter = Array.isArray(state.gallery.tagFilter) ? state.gallery.tagFilter : [];
  if (!tagFilter.length) return [];
  const mode = state.gallery.filterMode === 'and' ? 'and' : 'or';
  return getAllGalleryImagesAcrossDates().filter(item => {
    const arr = getImageTagsForGalleryItem(item);
    return mode === 'and'
      ? tagFilter.every(t => arr.includes(t))
      : tagFilter.some(t => arr.includes(t));
  });
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

function getOwnerTradeForImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (state.gallery.sourceRow !== null && state.trades[state.gallery.sourceRow]?.images?.includes(imageUrl)) {
    return state.trades[state.gallery.sourceRow];
  }
  if (state.gallery.date) {
    const row = getTradesForDate(state.gallery.date).find(t => (t.images || []).includes(imageUrl));
    if (row) return row;
    return null;
  }
  return state.trades.find(t => (t.images || []).includes(imageUrl)) || null;
}

function syncGalleryImageOrderToTrades() {
  const ordered = state.gallery.images || [];
  if (state.gallery.sourceRow !== null && state.trades[state.gallery.sourceRow]) {
    const t = state.trades[state.gallery.sourceRow];
    const own = new Set(t.images || []);
    t.images = ordered.filter(u => own.has(u));
    return;
  }
  if (state.gallery.date) {
    const dk = state.gallery.date;
    if (state.dayData[dk]?.images) {
      const dayOwn = new Set(state.dayData[dk].images);
      state.dayData[dk].images = ordered.filter(u => dayOwn.has(u));
    }
    const dayTrades = getTradesForDate(dk);
    dayTrades.forEach(t => {
      const own = new Set(t.images || []);
      t.images = ordered.filter(u => own.has(u));
    });
    return;
  }
  const trade = getOwnerTradeForGalleryImage();
  if (trade) {
    const own = new Set(trade.images || []);
    trade.images = ordered.filter(u => own.has(u));
  }
}

async function reorderGalleryImages(fromIdx, toIdx) {
  const arr = state.gallery.images || [];
  if (fromIdx < 0 || toIdx < 0 || fromIdx >= arr.length || toIdx >= arr.length) return;
  const currentUrl = arr[state.gallery.currentIndex];
  const [moved] = arr.splice(fromIdx, 1);
  arr.splice(toIdx, 0, moved);
  state.gallery.currentIndex = Math.max(0, arr.indexOf(currentUrl));
  syncGalleryImageOrderToTrades();
  await saveTrades();
  renderGallery();
  renderTable();
}

async function removeGalleryImageAt(idx) {
  const arr = state.gallery.images || [];
  if (idx < 0 || idx >= arr.length) return;
  const imageUrl = arr[idx];
  if (state._localOverlays?.[imageUrl]) delete state._localOverlays[imageUrl];
  const ownerTrade = getOwnerTradeForImageUrl(imageUrl);
  if (ownerTrade) {
    ownerTrade.images = (ownerTrade.images || []).filter(u => u !== imageUrl);
    if (ownerTrade.overlays && ownerTrade.overlays[imageUrl]) delete ownerTrade.overlays[imageUrl];
    if (ownerTrade.marqueeBoxes && ownerTrade.marqueeBoxes[imageUrl]) delete ownerTrade.marqueeBoxes[imageUrl];
    const store = ensureImageTagStore(ownerTrade);
    if (store[imageUrl]) delete store[imageUrl];
    cleanupImageTagStore(ownerTrade);
  } else if (state.gallery.date && state.dayData[state.gallery.date]?.images) {
    state.dayData[state.gallery.date].images = state.dayData[state.gallery.date].images.filter(u => u !== imageUrl);
    if (state.dayData[state.gallery.date]?.overlays?.[imageUrl]) {
      delete state.dayData[state.gallery.date].overlays[imageUrl];
    }
    if (state.dayData[state.gallery.date]?.marqueeBoxes?.[imageUrl]) {
      delete state.dayData[state.gallery.date].marqueeBoxes[imageUrl];
    }
  }
  arr.splice(idx, 1);
  if (state.gallery.currentIndex >= arr.length) state.gallery.currentIndex = Math.max(0, arr.length - 1);
  try {
    const filename = String(imageUrl || '').split('/').pop();
    await fetch('/api/delete-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
  } catch (e) { }
  if (!arr.length) {
    await saveTrades();
    renderTable();
    renderCalendar();
    document.getElementById('gallery-modal').classList.remove('open');
    unlockBodyScroll();
    showToast('Image removed', 'success');
    return;
  }
  syncGalleryImageOrderToTrades();
  await saveTrades();
  renderGallery();
  renderTable();
  renderCalendar();
  showToast('Image removed', 'success');
}

function loadOverlayForCurrentImage() {
  if (annotState.active) return; // annotation mode handles its own canvas
  const imgs = state.gallery.images || [];
  const imgUrl = imgs[state.gallery.currentIndex];
  const overlayUrl = state._localOverlays?.[imgUrl] || getOverlayUrlForImage(imgUrl, state.gallery.date || '');
  const packedBoxes = getMarqueeBoxesForImage(imgUrl, state.gallery.date || '', state.gallery.sourceRow);
  const canvas = document.getElementById('annot-canvas');
  const ctx = canvas.getContext('2d');
  const img = document.getElementById('gallery-img');
  const wrapper = document.getElementById('gallery-img-wrapper');
  if (!wrapper) return;

  const left = img.offsetLeft;
  const top = img.offsetTop;
  const w = Math.round(img.clientWidth || img.naturalWidth || 0);
  const h = Math.round(img.clientHeight || img.naturalHeight || 0);
  if (w <= 0 || h <= 0) {
    requestAnimationFrame(() => {
      if (!annotState.active) loadOverlayForCurrentImage();
    });
    return;
  }

  canvas.style.left = left + 'px';
  canvas.style.top = top + 'px';
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  canvas.style.pointerEvents = 'none'; // view-only, no drawing
  canvas.style.display = 'block';

  const boxes = unpackMarqueeBoxes(packedBoxes, w, h);
  const drawBoxes = () => {
    boxes.forEach(b => drawMarqueeBox(ctx, b, false));
  };

  if (!overlayUrl && !boxes.length) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.display = 'none';
    return;
  }

  if (overlayUrl) {
    const ovImg = new Image();
    ovImg.onload = () => {
      const activeUrl = (state.gallery.images || [])[state.gallery.currentIndex];
      if (activeUrl !== imgUrl || annotState.active) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(ovImg, 0, 0, canvas.width, canvas.height);
      drawBoxes();
    };
    ovImg.onerror = () => {
      const activeUrl = (state.gallery.images || [])[state.gallery.currentIndex];
      if (activeUrl !== imgUrl || annotState.active) return;
      const localUrl = state._localOverlays?.[imgUrl];
      if (localUrl && localUrl !== overlayUrl) {
        const retryImg = new Image();
        retryImg.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(retryImg, 0, 0, canvas.width, canvas.height);
          drawBoxes();
        };
        retryImg.src = localUrl;
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (boxes.length) drawBoxes();
    };
    ovImg.src = overlayUrl;
  } else {
    ctx.clearRect(0, 0, w, h);
    drawBoxes();
  }

  applyZoom();
}

function navigateGallery(dir) {
  const { images, currentIndex, date } = state.gallery;
  const next = currentIndex + dir;
  if (next >= 0 && next < images.length) {
    state.gallery.currentIndex = next; renderGallery();
  } else if (date) {
    navigateGalleryDate(dir);
  }
}

function getGalleryDateScopeForFilter() {
  const imageDates = (state.gallery.images || []).map((url, idx) => {
    const meta = state.gallery._filteredMeta && state.gallery._filteredMeta[idx];
    if (meta && meta.url === url) return normalizeDate(meta.date || '');
    const ctx = findGalleryContextByImageUrl(url);
    return normalizeDate(ctx.date || '');
  });
  const byDate = new Map();
  imageDates.forEach((d, idx) => {
    if (!d) return;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(idx);
  });
  const dates = Array.from(byDate.keys()).sort();
  const curIdx = Math.max(0, Math.min((state.gallery.images || []).length - 1, state.gallery.currentIndex || 0));
  let currentDate = imageDates[curIdx] || '';
  if (!currentDate && dates.includes(state.gallery.date)) currentDate = state.gallery.date;
  if (!currentDate) currentDate = dates[0] || '';
  return { dates, byDate, currentDate, imageDates, currentIndex: curIdx };
}

function navigateGalleryDate(dir) {
  const filterActive = Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length > 0;
  if (filterActive) {
    const scope = getGalleryDateScopeForFilter();
    const total = (state.gallery.images || []).length;
    if (!total) return;
    let targetIndex = -1;
    for (let i = scope.currentIndex + dir; i >= 0 && i < total; i += dir) {
      const d = scope.imageDates[i] || '';
      if (d && d !== scope.currentDate) { targetIndex = i; break; }
    }
    if (targetIndex < 0) {
      const fallback = scope.currentIndex + dir;
      if (fallback >= 0 && fallback < total) targetIndex = fallback;
    }
    if (targetIndex >= 0) {
      state.gallery.currentIndex = targetIndex;
      const targetUrl = state.gallery.images[targetIndex] || '';
      const meta = state.gallery._filteredMeta && state.gallery._filteredMeta[targetIndex];
      if (meta && meta.url === targetUrl) {
        state.gallery.date = normalizeDate(meta.date || '');
        state.gallery.sourceRow = meta.sourceRow ?? null;
      } else {
        const ctx = findGalleryContextByImageUrl(targetUrl);
        state.gallery.date = normalizeDate(ctx.date || '');
        state.gallery.sourceRow = ctx.sourceRow ?? null;
      }
      state.gallery._skipFilterRescopeOnce = true;
      renderGallery(); updateGalleryDateArrows();
    }
    return;
  }

  const datesWithImages = getDatesWithImages();
  if (!datesWithImages.length) {
    const idxOnly = (state.gallery.currentIndex || 0) + dir;
    if (idxOnly >= 0 && idxOnly < (state.gallery.images || []).length) {
      state.gallery.currentIndex = idxOnly;
      renderGallery();
    }
    return;
  }

  const curDate = state.gallery.date;
  let idx = datesWithImages.indexOf(curDate);
  if (idx === -1) idx = dir > 0 ? -1 : datesWithImages.length;
  const nextIdx = idx + dir;
  if (nextIdx < 0 || nextIdx >= datesWithImages.length) {
    const nextImageIdx = (state.gallery.currentIndex || 0) + dir;
    if (nextImageIdx >= 0 && nextImageIdx < (state.gallery.images || []).length) {
      state.gallery.currentIndex = nextImageIdx;
      renderGallery();
    }
    return;
  }

  const nextDate = datesWithImages[nextIdx];
  const images = getImagesForDate(nextDate);
  if (images.length) {
    state.gallery.images = images;
    state.gallery.currentIndex = 0;
    state.gallery.date = nextDate;
    state.gallery.sourceRow = null;
    renderGallery(); updateGalleryDateArrows();
  }
}

function updateGalleryDateArrows() {
  const filterActive = Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length > 0;
  if (filterActive) {
    const total = (state.gallery.images || []).length;
    const idx = Math.max(0, Math.min(total - 1, state.gallery.currentIndex || 0));
    document.getElementById('gallery-date-prev').disabled = total <= 1 || idx <= 0;
    document.getElementById('gallery-date-next').disabled = total <= 1 || idx >= total - 1;
    return;
  }
  const datesWithImages = getDatesWithImages();
  const idx = datesWithImages.indexOf(state.gallery.date);
  const imgTotal = (state.gallery.images || []).length;
  const imgIdx = Math.max(0, Math.min(imgTotal - 1, state.gallery.currentIndex || 0));
  const hasPrevImage = imgTotal > 1 && imgIdx > 0;
  const hasNextImage = imgTotal > 1 && imgIdx < imgTotal - 1;
  const hasPrevDate = idx > 0;
  const hasNextDate = idx !== -1 && idx < datesWithImages.length - 1;
  document.getElementById('gallery-date-prev').disabled = !(hasPrevDate || hasPrevImage);
  document.getElementById('gallery-date-next').disabled = !(hasNextDate || hasNextImage);
}

