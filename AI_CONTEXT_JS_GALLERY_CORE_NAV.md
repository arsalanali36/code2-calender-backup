# JS — Gallery Core & Nav (open / core / nav)
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `static\js\gallery-open.js`
```js
// gallery-open.js — openGalleryForDate, openGalleryDirect, openGalleryForDateWithTagFilter, lock/unlockBodyScroll

function openGalleryForDate(dateStr) {
  const images = getImagesForDate(dateStr);
  if (!images.length) return;
  state.gallery.images = images; state.gallery.currentIndex = 0;
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
}

function openGalleryDirect(images, startIndex, sourceRow = null) {
  state.gallery.images = images; state.gallery.currentIndex = startIndex;
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

## File: `static\js\gallery-core.js`
```js
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

## File: `static\js\gallery-nav.js`
```js
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
  const { images, currentIndex } = state.gallery;
  if (!images || !images.length) return;
  let next = currentIndex + dir;
  if (next >= images.length) next = images.length - 1;
  else if (next < 0) next = 0;
  if (next === currentIndex) return;
  state.gallery.currentIndex = next;
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


```
