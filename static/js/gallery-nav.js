/**
 * @fileoverview gallery-nav.js
 * @description Loads overlay+marquee for current image; navigate gallery by index or date.
 * @exports loadOverlayForCurrentImage, navigateGallery, navigateGalleryDate,
 *          updateGalleryDateArrows, getGalleryDateScopeForFilter
 * @reads state.gallery.{images,currentIndex,date,tagFilter}, state._localOverlays
 * @writes state.gallery.currentIndex, state.gallery.date (date navigation)
 * @calls renderGallery, getOverlayUrlForImage, getMarqueeBoxesForImage, renderMarqueeScene
 */

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

  const w = Math.round(img.clientWidth || img.naturalWidth || 0);
  const h = Math.round(img.clientHeight || img.naturalHeight || 0);
  if (w <= 0 || h <= 0) {
    requestAnimationFrame(() => {
      if (!annotState.active) loadOverlayForCurrentImage();
    });
    return;
  }

  canvas.style.margin = 'auto';
  canvas.style.inset = '0';
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  canvas.style.pointerEvents = 'none'; // view-only, no drawing
  canvas.style.cursor = 'default'; // prevent crosshair from .annot-canvas CSS showing over image
  // Keep canvas hidden until we're ready to draw — prevents flash of stale content
  canvas.style.display = 'none';

  const boxes = unpackMarqueeBoxes(packedBoxes, w, h);
  const drawBoxes = () => {
    boxes.forEach(b => drawMarqueeBox(ctx, b, false));
  };

  if (!overlayUrl && !boxes.length) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
      canvas.style.display = 'block';
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
          canvas.style.display = 'block';
        };
        retryImg.src = resolveImageUrl(localUrl);
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (boxes.length) { drawBoxes(); canvas.style.display = 'block'; }
    };
    ovImg.src = resolveImageUrl(overlayUrl);
  } else {
    ctx.clearRect(0, 0, w, h);
    drawBoxes();
    canvas.style.display = 'block';
  }

  applyZoom();
}

// Returns ordered array of {label, images} blocks for the current date
function getGalleryBlocks() {
  const date = state.gallery.date;
  const images = state.gallery.images || [];
  if (!date || !images.length) return [{ label: 'All', images }];

  const dayData = state.dayData[date] || {};
  const trades = typeof getTradesForDate === 'function' ? getTradesForDate(date) : [];
  const blocks = [];

  if (dayData.newsImages  && dayData.newsImages.length)  blocks.push({ label: 'NEWS',  images: dayData.newsImages });
  if (dayData.images      && dayData.images.length)      blocks.push({ label: 'OPEN',  images: dayData.images });
  trades.forEach((tr, i) => {
    if (tr.images && tr.images.length) blocks.push({ label: 'T' + (i + 1), images: tr.images });
  });
  if (dayData.closeImages && dayData.closeImages.length) blocks.push({ label: 'CLOSE', images: dayData.closeImages });

  return blocks.length ? blocks : [{ label: 'All', images }];
}

// Up/Down in grid view: jump to prev/next block's first image
function navigateGalleryBlock(dir) {
  const blocks = getGalleryBlocks();
  if (blocks.length <= 1) { _scrollGalleryContent(dir * 200); return; }

  const images = state.gallery.images || [];
  const curUrl = images[state.gallery.currentIndex] || '';
  let curBlockIdx = 0;
  for (let b = 0; b < blocks.length; b++) {
    if (blocks[b].images.includes(curUrl)) { curBlockIdx = b; break; }
  }

  const nextBlockIdx = curBlockIdx + dir;
  if (nextBlockIdx < 0 || nextBlockIdx >= blocks.length) return;

  const nextBlock = blocks[nextBlockIdx];
  // Going back (Up) → land on last image of prev block; going forward (Down) → first image
  const targetImg = dir < 0 ? nextBlock.images[nextBlock.images.length - 1] : nextBlock.images[0];
  const globalIdx = images.indexOf(targetImg);
  if (globalIdx < 0) return;

  state.gallery.currentIndex = globalIdx;
  state.gallery.selectedIndices = new Set([globalIdx]);

  if (typeof isGridViewOpen === 'function' && isGridViewOpen()) {
    if (typeof refreshGridSelection === 'function') refreshGridSelection();
    // Scroll the block group header into view
    const body = document.getElementById('gv2-grid-body');
    if (body) {
      const el = body.querySelector(`[data-global-idx="${globalIdx}"]`);
      const group = el && el.closest('.gv2-grid-group');
      if (group) group.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } else {
    renderGallery();
  }
}

function navigateGallery(dir) {
  const { images, currentIndex } = state.gallery;
  if (!images || !images.length) return;

  if (typeof isGridViewOpen === 'function' && isGridViewOpen()) {
    // Grid view: navigate within current block only, stop at block edges
    const blocks = getGalleryBlocks();
    const curUrl = images[currentIndex] || '';
    let curBlock = blocks[0];
    for (const block of blocks) {
      if (block.images.includes(curUrl)) { curBlock = block; break; }
    }
    const posInBlock = curBlock.images.indexOf(curUrl);
    const nextPos = posInBlock + dir;
    if (nextPos < 0 || nextPos >= curBlock.images.length) return; // stop at edge
    const nextUrl = curBlock.images[nextPos];
    const nextGlobalIdx = images.indexOf(nextUrl);
    if (nextGlobalIdx < 0) return;

    state.gallery.currentIndex = nextGlobalIdx;
    state.gallery.selectedIndices = new Set([nextGlobalIdx]);
    if (typeof refreshGridSelection === 'function') refreshGridSelection();
    const body = document.getElementById('gv2-grid-body');
    if (body) {
      const el = body.querySelector(`[data-global-idx="${nextGlobalIdx}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return;
  }

  // Classic view: sequential nav through all images
  let next = currentIndex + dir;
  if (next >= images.length) next = images.length - 1;
  else if (next < 0) next = 0;
  if (next === currentIndex) return;
  state.gallery.currentIndex = next;
  state.gallery.selectedIndices = new Set([next]);
  renderGallery();
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

// Helper to find the best image to start with for a given date
function getInitialIndexForDate(date, images = null) {
  if (!images) images = getImagesForDate(date);
  if (!images.length) return 0;

  // 1. Priority: Close Global Image
  const dayData = state.dayData[date] || {};
  if (dayData.closeGlobalImages && dayData.closeGlobalImages.length > 0) {
    const firstGlobal = dayData.closeGlobalImages[0];
    const gIdx = images.indexOf(firstGlobal);
    if (gIdx >= 0) return gIdx;
  }

  // 2. Priority: T1 Images
  const dayTrades = typeof getTradesForDate === 'function' ? getTradesForDate(date) : [];
  if (dayTrades.length > 0 && dayTrades[0].images && dayTrades[0].images.length > 0) {
    const t1FirstImg = dayTrades[0].images[0];
    const t1Idx = images.indexOf(t1FirstImg);
    if (t1Idx >= 0) return t1Idx;
  }

  return 0;
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
      state.gallery.imageTimes = {};
      renderGallery(); updateGalleryDateArrows();
      if (state.gallery.showTime) fetchImageTimesForGallery();
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
      state.gallery._baseImages = [...images];
      state.gallery.date = nextDate;
      state.gallery.sourceRow = null;
      state.gallery.imageTimes = {};
      
      state.gallery.currentIndex = getInitialIndexForDate(nextDate, images);

      renderGallery(); updateGalleryDateArrows();
      if (state.gallery.showTime) fetchImageTimesForGallery();
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

