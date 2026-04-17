# JS - Gallery Core + Nav + Render + Open
Consolidated code context for AI assistants.


## File: `static/js/gallery-core.js`
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
  if (!item || !item.url) return [];
  const filterScope = state.gallery.filterTagScope || 'image';
  if (filterScope === 'trade') {
    // Aggregate ALL tags from ALL images of this trade
    // so that if ANY image has the tag, ALL images of that trade match the filter
    if (item.sourceRow !== null && item.sourceRow !== undefined && state.trades[item.sourceRow]) {
      const trade = state.trades[item.sourceRow];
      const tags = new Set();
      (trade.images || []).forEach(url => {
        getImageTagsForUrl(trade, url).forEach(t => tags.add(t));
        const boxes = trade.marqueeBoxes?.[url];
        (Array.isArray(boxes) ? boxes : []).forEach(b =>
          (Array.isArray(b?.tags) ? b.tags : []).forEach(t => tags.add(t))
        );
      });
      // Also include explicitly set trade-level tags
      getTradeTagsForTrade(trade).forEach(t => tags.add(t));
      
      // Virtual Tag: HAS NOTES (Trade Scope)
      const pins = getTagPinsForUrl ? getTagPinsForUrl(item.url) : [];
      if (pins.some(p => p.note && p.note.trim().length > 0)) tags.add('📝 HAS NOTES');

      return Array.from(tags);
    }
    return [];
  }
  // Image scope (default): only this image's tags
  const tags = new Set();
  if (item.sourceRow !== null && state.trades[item.sourceRow]) {
    getImageTagsForUrl(state.trades[item.sourceRow], item.url).forEach(t => tags.add(t));
  } else if (item.date) {
    const day = state.dayData[item.date];
    if (day?.newsImages?.includes(item.url)) tags.add('News');
    getDayImageTagsForUrl(item.date, item.url).forEach(t => tags.add(t));
  }
  getMarqueeTagsForImage(item.url, item.date || '', item.sourceRow).forEach(t => tags.add(t));

  // Virtual Tag: HAS NOTES (Image Scope)
  const pins = typeof getTagPinsForUrl === 'function' ? getTagPinsForUrl(item.url, item.date) : [];
  if (pins.some(p => p.note && p.note.trim().length > 0)) tags.add('📝 HAS NOTES');

  return Array.from(tags);
}

function getAllGalleryImagesAcrossDates() {
  const out = [];
  getDatesWithImages().forEach(d => {
    // 1. News
    (state.dayData[d]?.newsImages || []).forEach(url => out.push({ url, date: d, sourceRow: null }));

    // 2. Day Images (Charts)
    (state.dayData[d]?.images || []).forEach(url => out.push({ url, date: d, sourceRow: null }));

    // 3. Trade Images
    for (let i = 0; i < state.trades.length; i++) {
      const t = state.trades[i];
      if (normalizeDate(extractDateFromTrade(t)) !== d) continue;
      (t.images || []).forEach(url => out.push({ url, date: d, sourceRow: i }));
    }

    // 4. Close Images
    (state.dayData[d]?.closeImages || []).forEach(url => out.push({ url, date: d, sourceRow: null }));
    (state.dayData[d]?.closeGlobalImages || []).forEach(url => out.push({ url, date: d, sourceRow: null }));

    // 5. Premium Images
    const premiumObj = state.dayData[d]?.premiumImages;
    if (premiumObj) {
        Object.keys(premiumObj).sort().forEach(inst => {
            const val = premiumObj[inst];
            if (Array.isArray(val)) {
                val.forEach(url => { if (url) out.push({ url, date: d, sourceRow: null }); });
            } else if (val) {
                out.push({ url: val, date: d, sourceRow: null });
            }
        });
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
    if ((v?.closeImages || []).includes(imageUrl)) return { date: d, sourceRow: null };
    if ((v?.closeGlobalImages || []).includes(imageUrl)) return { date: d, sourceRow: null };
  }
  return { date: '', sourceRow: null };
}

function applyGalleryImageScopeByTagFilter(preserveUrl = null) {
  // When called with no args, auto-capture current context so currentIndex is preserved
  const preserve = (preserveUrl === null || preserveUrl === undefined)
    ? (typeof getCurrentGalleryPreserveContext === 'function' ? getCurrentGalleryPreserveContext() : { url: '' })
    : (typeof preserveUrl === 'object' && preserveUrl)
      ? preserveUrl
      : { url: preserveUrl || '' };
  const filterActive = Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length > 0;
  let nextImages;
  let nextMeta = null;
  if (filterActive) {
    const tagFilter = Array.isArray(state.gallery.tagFilter) ? state.gallery.tagFilter : [];
    const mode = state.gallery.filterMode === 'and' ? 'and' : 'or';
    const norm = t => (typeof t === 'string' ? t : String(t)).toLowerCase().trim();
    const normFilter = tagFilter.map(norm);
    const matchesFilter = (item) => {
      const arr = getImageTagsForGalleryItem(item).map(norm);
      return mode === 'and' ? normFilter.every(t => arr.includes(t)) : normFilter.some(t => arr.includes(t));
    };

    const rawMatches = getFilteredGalleryImagesByTagSelection();
    const groupedMatches = new Map();
    for (const item of rawMatches) {
      const tradeKey = (item.date || '') + ':' + (item.sourceRow !== null ? item.sourceRow : 'OPENCLOSE');
      if (!groupedMatches.has(tradeKey)) {
        groupedMatches.set(tradeKey, []);
      }
      groupedMatches.get(tradeKey).push(item);
    }

    // Auto-expand all discovered trade groups on NEW filter application 
    // to ensure the gallery unit count matches the individual image tag counts.
    const filterKey = JSON.stringify(tagFilter) + ':' + mode + ':' + (state.gallery.filterTagScope || 'image') + ':' + (state.gallery.filterGroupMode || 'group');
    if (state.gallery._lastExpandFilterKey !== filterKey) {
        state.gallery.expandedFilterTrades = new Set(groupedMatches.keys());
        state.gallery._lastExpandFilterKey = filterKey;
    }

    const expanded = [];
    for (const [tradeKey, items] of groupedMatches.entries()) {
      const isExpanded = state.gallery.expandedFilterTrades?.has(tradeKey);
      if (isExpanded) {
        items.forEach(item => expanded.push(item));
      } else {
        const item = items[0];
        if (items.length > 1) {
          expanded.push({ ...item, isCollapsedTrade: true });
        } else {
          expanded.push(item);
        }
      }
    }
    nextMeta = expanded;

    // In Grp mode: if any group parents are expanded, insert their matching sub-images after the parent
    if (state.gallery.filterGroupMode !== 'image' && state.gallery.expandedGroups?.size) {
      const groupExpanded = [];
      for (const item of nextMeta) {
        groupExpanded.push(item);
        if (state.gallery.expandedGroups.has(item.url)) {
          const subs = _getSubImagesForParent(item.url, item.date, item.sourceRow);
          subs.forEach(subUrl => {
            const subItem = { url: subUrl, date: item.date, sourceRow: item.sourceRow };
            if (matchesFilter(subItem)) {
              groupExpanded.push(subItem);
            }
          });
        }
      }
      nextMeta = groupExpanded;
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
    const isNews = date && state.dayData[date]?.newsImages?.includes(url);
    return { url, globalIdx: i, isCurrentDate: !filteredMode, date, sourceRow, isNews };
  }).filter(item => !!item.url);
}

function calculateGalleryTagCounts() {
  const counts = new Map();
  const allItems = getAllGalleryImagesAcrossDates();
  const seenUrls = new Set();
  
  // Normalized tag map to consolidate case-insensitive matches
  const normCounts = new Map();

  allItems.forEach(item => {
    if (seenUrls.has(item.url)) return;
    seenUrls.add(item.url);
    
    // getImageTagsForGalleryItem respects the current state.gallery.filterTagScope (Image vs Trade)
    const rawTags = getImageTagsForGalleryItem(item);
    const tags = new Set(rawTags);
    
    // In Group Mode, if a sub-image has the tag, the parent matches.
    const groupMode = state.gallery.filterGroupMode !== 'image';
    if (groupMode) {
       const subs = _getSubImagesForParent(item.url, item.date, item.sourceRow);
       subs.forEach(subUrl => {
         const subItem = { url: subUrl, date: item.date, sourceRow: item.sourceRow };
         getImageTagsForGalleryItem(subItem).forEach(t => tags.add(t));
       });
    }
    
    tags.forEach(t => {
      const tag = String(t || '').trim();
      if (!tag) return;
      const lower = tag.toLowerCase();
      normCounts.set(lower, (normCounts.get(lower) || 0) + 1);
    });
  });

  // Map normalized counts back to the casing present in allTags or the first found casing
  const allTags = state.allTags || [];
  allTags.forEach(t => {
      const lower = t.toLowerCase().trim();
      if (normCounts.has(lower)) {
          counts.set(t, normCounts.get(lower));
      }
  });
  
  // Catch any tags that might not be in allTags yet
  normCounts.forEach((cnt, lower) => {
      const alreadyInCounts = Array.from(counts.keys()).some(k => k.toLowerCase().trim() === lower);
      if (!alreadyInCounts) {
          // Find original casing from the loop? 
          // For simplicity, just use the lowercase version if not found elsewhere
          counts.set(lower, cnt);
      }
  });
  
  return counts;
}

```

## File: `static/js/gallery-nav.js`
```js
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
  // Always land on first image of the target block
  const targetImg = nextBlock.images[0];
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
    
    state.gallery.images = images;
    state.gallery._baseImages = [...images];
    state.gallery.date = nextDate;
    state.gallery.sourceRow = null;
    state.gallery.imageTimes = {};
    
    state.gallery.currentIndex = getInitialIndexForDate(nextDate, images);

    renderGallery(); updateGalleryDateArrows();
    if (state.gallery.showTime) fetchImageTimesForGallery();
}

function updateGalleryDateArrows() {
  const filterActive = Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length > 0;
  if (filterActive) {
    const total = (state.gallery.images || []).length;
    const idx = Math.max(0, Math.min(total - 1, state.gallery.currentIndex || 0));
    const prev = document.getElementById('gallery-date-prev');
    const next = document.getElementById('gallery-date-next');
    if (prev) prev.disabled = total <= 1 || idx <= 0;
    if (next) next.disabled = total <= 1 || idx >= total - 1;
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
  const prevBtn = document.getElementById('gallery-date-prev');
  const nextBtn = document.getElementById('gallery-date-next');
  if (prevBtn) prevBtn.disabled = !(hasPrevDate || hasPrevImage);
  if (nextBtn) nextBtn.disabled = !(hasNextDate || hasNextImage);
}


```

## File: `static/js/gallery-render.js`
```js
// gallery-render.js — renderGallery orchestrator
// Tray logic → gallery-render-tray.js | Thumbnail strip → gallery-render-thumbs.js

function renderGallery() {
  if (typeof initTagPinDropZone      === 'function') initTagPinDropZone();
  if (typeof initTagPinHeaderButtons === 'function') initTagPinHeaderButtons();

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

  // ── Date label ───────────────────────────────────────────────────────────
  const dateEl = document.getElementById('gallery-date');
  if (dateEl) {
    let dateToDisplay = date;
    if (!dateToDisplay && currentImageUrl) {
        const ctx = typeof findGalleryContextByImageUrl === 'function' ? findGalleryContextByImageUrl(currentImageUrl) : null;
        if (ctx && ctx.date) dateToDisplay = ctx.date;
    }

    dateEl.style.display = '';
    const _fmtTrayDate = (s) => {
      const d = new Date(s + 'T00:00:00');
      if (isNaN(d)) return s;
      return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    };
    dateEl.textContent = dateToDisplay
      ? _fmtTrayDate(dateToDisplay)
      : (images.length > 0 ? `${images.length} image(s)` : 'No images');
  }
  if (date) {
    const picker = document.getElementById('gallery-date-picker');
    if (picker) picker.value = date;
  }

  const uploadBtn = document.getElementById('gallery-upload-btn');
  if (uploadBtn) uploadBtn.style.display = date ? '' : 'none';
  const obsBtn = document.getElementById('gv2-obs-btn');
  if (obsBtn) obsBtn.style.display = date ? '' : 'none';

  // ── Main image / video ────────────────────────────────────────────────────
  const img   = document.getElementById('gallery-img');
  const vidEl = document.getElementById('gallery-video');
  const curUrl = images[currentIndex] || '';
  const isVid  = typeof isVideoUrl === 'function' && isVideoUrl(curUrl);

  if (!annotState.active) document.getElementById('annot-canvas').style.display = 'none';

  if (isVid) {
    img.style.display = 'none';
    if (vidEl) {
      vidEl.style.display = '';
      const resolvedVidUrl = resolveImageUrl(curUrl);
      const doPlay = () => {
        const p = vidEl.play();
        if (p !== undefined) p.catch(err => { console.warn('Autoplay blocked:', err); vidEl.controls = true; });
      };
      const applyVideoSrc = (srcToUse) => {
        const currentSrcPath = vidEl.src ? new URL(vidEl.src, location.href).pathname : '';
        const wantedPath = srcToUse.startsWith('blob:')
          ? (vidEl.src === srcToUse ? vidEl.src : '')
          : new URL(srcToUse, location.href).pathname;
        const srcChanged = srcToUse.startsWith('blob:') ? vidEl.src !== srcToUse : currentSrcPath !== wantedPath;
        if (srcChanged) { vidEl.src = srcToUse; vidEl.load(); vidEl.addEventListener('canplay', doPlay, { once: true }); }
        else { doPlay(); }
      };
      vidEl.muted = true;
      vidEl.classList.add('active-video');
      const cached = _videoBlobCache.get(resolvedVidUrl);
      if (cached) { applyVideoSrc(cached); }
      else { applyVideoSrc(resolvedVidUrl); _cacheVideo(resolvedVidUrl); }
      _preloadAdjacentVideos();
      vidEl.onclick = e => e.stopPropagation();
    }
    img.classList.remove('zoomed', 'dragging');
    resetZoom();
  } else {
    if (vidEl) { vidEl.style.display = 'none'; vidEl.pause && vidEl.pause(); }
    const pdfCanvas = document.getElementById('pdf-main-canvas');
    if (pdfCanvas) pdfCanvas.style.display = 'none';

    img.style.display = '';
    img.src = resolveImageUrl(curUrl);
    img.classList.remove('zoomed', 'dragging'); resetZoom();
    if (state.gallery.splitView && typeof updateSplitRight === 'function') updateSplitRight(curUrl);
    img.onerror = () => {
      if (!curUrl) return;
      img.style.opacity = '0.3'; img.style.filter = 'grayscale(1) contrast(0.5)';
      img.title = 'Image could not be loaded.';
    };
    const afterImageReady = () => {
      loadOverlayForCurrentImage();
      if (typeof renderTagPins === 'function') renderTagPins();
      if (state._carryAnnotTool) {
        annotState.tool = state._carryAnnotTool; state._carryAnnotTool = '';
        startAnnotation();
      }
    };
    img.addEventListener('load', afterImageReady, { once: true });
    if (img.complete && img.naturalWidth) afterImageReady();
    img.onclick = null;
  }

  // ── Close-Global-Tray ────────────────────────────────────────────────────
  renderCloseGlobalTray(curUrl);

  // ── Counter + tags + filter bar ──────────────────────────────────────────
  document.getElementById('gallery-counter').textContent = `${currentIndex + 1} / ${images.length}`;
  document.getElementById('gallery-prev').disabled = images.length <= 1;
  document.getElementById('gallery-next').disabled = images.length <= 1;
  renderGalleryImageTags();
  renderGalleryTagCloud();
  const tagsTray = document.getElementById('gv2-tags-tray');
  if (tagsTray && tagsTray.style.display !== 'none') { renderGalleryTagsTray(); renderGalleryVideoUrls(); }
  if (document.getElementById('img-tag-modal')?.classList.contains('open')) renderImageTagModal();

  if (typeof renderGalleryStats      === 'function') renderGalleryStats();
  if (typeof renderLayerPanel        === 'function' && state.gallery.layerPanelOpen) renderLayerPanel();
  if (typeof renderAudioBar          === 'function') renderAudioBar();
  if (typeof renderVideoBar          === 'function') renderVideoBar();
  if (typeof renderGalleryTrayState  === 'function') renderGalleryTrayState();

  const _filterActive = Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length > 0;
  document.getElementById('gallery-thumbs')?.classList.toggle('filter-active', _filterActive);
  document.getElementById('gv2-tag-cloud')?.classList.toggle('filter-active', _filterActive);

  const filterBar = document.getElementById('gallery-filter-active-bar');
  const countBar  = document.getElementById('gallery-filter-count-bar');
  if (filterBar) {
    if (_filterActive) {
      const modeText = state.gallery.filterMode === 'and' ? 'ALL of' : 'ANY of';
      filterBar.innerHTML = 
        `<div style="display:flex; align-items:center;">` +
          `<span>FILTER ACTIVE (${modeText}):</span> ` +
          `<span style="background:rgba(0,0,0,0.8); color:#fff; padding:3px 12px; border-radius:20px; margin-left:8px; font-weight:600; border:1px solid rgba(255,255,255,0.1);">${state.gallery.tagFilter.join(', ')}</span>` +
        `</div>` +
        `<button id="gv2-clear-filter-btn" style="background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.8); border:none; border-radius:50%; width:24px; height:24px; margin-left:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:14px; transition:all 0.2s; pointer-events:auto;" title="Clear filter">×</button>`;
      
      const clearBtn = document.getElementById('gv2-clear-filter-btn');
      if (clearBtn) {
        clearBtn.onmouseenter = () => { clearBtn.style.background = 'rgba(248,81,73,0.3)'; clearBtn.style.color = '#fff'; };
        clearBtn.onmouseleave = () => { clearBtn.style.background = 'rgba(255,255,255,0.1)'; clearBtn.style.color = 'rgba(255,255,255,0.8)'; };
        clearBtn.onclick = (e) => {
          e.stopPropagation();
          state.gallery.tagFilter = [];
          if (typeof renderGalleryTagFilterPanel === 'function') renderGalleryTagFilterPanel(); // Sync panel
          renderGallery();
        };
      }
      
      filterBar.style.display = 'flex';
      filterBar.style.alignItems = 'center';
      filterBar.style.justifyContent = 'center';
      filterBar.style.pointerEvents = 'auto'; // Enable interaction

      if (countBar) { 
        document.getElementById('gallery-filter-count-text').textContent = images.length; 
        countBar.style.display = 'block'; 
      }
    } else {
      filterBar.style.display = 'none';
      filterBar.style.pointerEvents = 'none';
      if (countBar) countBar.style.display = 'none';
    }
  }

  // ── Thumbnail strip ───────────────────────────────────────────────────────
  renderGalleryThumbs();

  // ── Sync + panels ─────────────────────────────────────────────────────────
  if (!state._isSyncUpdate && typeof syncGalleryToOthers === 'function') syncGalleryToOthers();

  if (typeof isGridViewOpen === 'function' && isGridViewOpen() && typeof renderGridContent === 'function') {
    renderGridContent();
  }

  const mtmPanel = document.getElementById('gv2-mtm-panel');
  if (mtmPanel && mtmPanel.style.display !== 'none') {
    if (typeof renderGalleryMtmPanel === 'function') renderGalleryMtmPanel(mtmPanel);
  }

  renderPdfTabsBar();
}

/**
 * Renders the top bubble bar for pinned/active PDFs
 */
function renderPdfTabsBar() {
  const container = document.getElementById('gv2-pdf-workspace-bar');
  if (!container) return;

  const activePdfs = state.gallery.activePdfs || [];
  if (activePdfs.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = '';

  // Get current PDF ID to highlight the active tab
  const curUrl = state.gallery.images[state.gallery.currentIndex] || '';
  const currentPdfId = state.gallery.mode === 'pdf' ? state.gallery.pdf?.filename : null;

  activePdfs.forEach(pdf => {
    const chip = document.createElement('div');
    chip.className = 'gv2-pdf-chip';
    if (pdf.id === currentPdfId) chip.classList.add('active');
    
    // Safety check for name length
    const displayName = pdf.name.length > 25 ? pdf.name.substring(0, 22) + '...' : pdf.name;

    chip.innerHTML = `
      <span class="gv2-pdf-chip-icon">📄</span>
      <span class="gv2-pdf-chip-name">${displayName}</span>
      <span class="gv2-pdf-chip-close" title="Remove from workspace">×</span>
    `;

    chip.onclick = () => {
      if (pdf.id === currentPdfId) return; // Already on it
      if (typeof PdfHandler !== 'undefined' && PdfHandler.openPdfInGallery) {
          PdfHandler.openPdfInGallery(pdf.id);
      }
    };

    const closeBtn = chip.querySelector('.gv2-pdf-chip-close');
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      if (typeof PdfHandler !== 'undefined' && PdfHandler.unregisterActivePdf) {
          PdfHandler.unregisterActivePdf(pdf.id);
      }
    };

    container.appendChild(chip);
  });
}

```

## File: `static/js/gallery-open.js`
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

function openGalleryForDate(dateStr, targetImgUrl = null) {
  const images = getImagesForDate(dateStr);
  if (!images.length) return;
  state.gallery.currentIndex = 0;
  state.gallery.tagFilter = [];
  state.gallery.date = dateStr;
  state.gallery.sourceRow = null;
  state.gallery._baseImages = [...images];
  state.gallery._baseDate = dateStr;
  state.gallery._baseSourceRow = null;

  // Apply index/premium filter (sets state.gallery.images from _baseImages)
  if (typeof applyImgTypeFilter === 'function') applyImgTypeFilter();
  else state.gallery.images = [...images];

  // Sync pill UI
  ['both','index','premium'].forEach(t => {
    const btn = document.getElementById('gv2-imgtype-' + t);
    if (btn) btn.classList.toggle('active', t === (state.gallery.imgTypeFilter || 'both'));
  });

  // Resolve targetImgUrl in the (possibly filtered) images list
  // Resolve targetImgUrl in the (possibly filtered) images list
  if (targetImgUrl) {
    const raw = String(targetImgUrl).trim();
    const idx = state.gallery.images.findIndex(u => String(u) === raw || String(u).endsWith(raw) || raw.endsWith(String(u)));
    if (idx >= 0) state.gallery.currentIndex = idx;
    state.gallery.selectedIndices = new Set([state.gallery.currentIndex]);
  } else {
    // If no specific image targeted, try to find Close Global image first
    const dayData = state.dayData[dateStr] || {};
    if (dayData.closeGlobalImages && dayData.closeGlobalImages.length > 0) {
        const firstGlobal = dayData.closeGlobalImages[0];
        const gIdx = state.gallery.images.indexOf(firstGlobal);
        if (gIdx >= 0) state.gallery.currentIndex = gIdx;
    }
    state.gallery.selectedIndices = state.gallery.selectedIndices || new Set();
  }
  
  lockBodyScroll();
  document.getElementById('gallery-modal').classList.add('open');
  if (typeof toggleGridView === 'function') toggleGridView(false);
  renderGallery(); 
  updateGalleryDateArrows();
  renderGalleryTagCloud(); renderGalleryTagsTray(); renderGalleryTagFilterPanel();
  const wasTagsOpen = localStorage.getItem('tj_tagsTrayOpen') === '1';
  const tray1 = document.getElementById('gv2-tags-tray');
  const btn1 = document.getElementById('gv2-tags-btn');
  if (tray1) tray1.style.display = wasTagsOpen ? 'flex' : 'none';
  if (btn1) btn1.classList.toggle('active', wasTagsOpen);
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
  const wasTagsOpen = localStorage.getItem('tj_tagsTrayOpen') === '1';
  const tray2 = document.getElementById('gv2-tags-tray');
  const btn2 = document.getElementById('gv2-tags-btn');
  if (tray2) tray2.style.display = wasTagsOpen ? 'flex' : 'none';
  if (btn2) btn2.classList.toggle('active', wasTagsOpen);
  if (state.gallery.showTime) fetchImageTimesForGallery();
}

// ── Gallery Layout Toggle (classic ↔ new) ──────────────────────────────────
const _VP_KEY = 'tj_galleryLayout'; // 'classic' | 'new'

function openGalleryForDateWithPicker(dateStr) {
  const pref = localStorage.getItem(_VP_KEY);
  if (pref === 'classic') { window.open(`/gallery-classic?galleryDate=${dateStr}`, '_blank'); return; }
  if (pref === 'new')     { openGalleryForDate(dateStr); return; }
  _showViewerPicker(dateStr);
}


function _showViewerPicker(dateStr) {
  document.getElementById('gv2-viewer-picker')?.remove();

  const el = document.createElement('div');
  el.id = 'gv2-viewer-picker';
  el.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99999',
    'display:flex', 'align-items:center', 'justify-content:center',
    'background:rgba(0,0,0,0.45)', 'backdrop-filter:blur(3px)'
  ].join(';');

  el.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border2);border-radius:10px;
                padding:20px 24px;min-width:260px;box-shadow:0 8px 32px rgba(0,0,0,0.7);
                display:flex;flex-direction:column;gap:12px;text-align:center;">
      <div style="font-size:0.8rem;color:var(--text2);letter-spacing:0.04em;">Open ${dateStr} with</div>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button id="gvp-old" style="flex:1;padding:10px 0;border-radius:7px;
          border:1px solid var(--border2);background:var(--surface2);
          color:var(--text);font-size:0.88rem;cursor:pointer;">
          🖥 Old Gallery
        </button>
        <button id="gvp-new" style="flex:1;padding:10px 0;border-radius:7px;
          border:none;background:var(--blue);
          color:#fff;font-size:0.88rem;cursor:pointer;font-weight:600;">
          ✨ New Gallery
        </button>
      </div>
      <label style="display:flex;align-items:center;justify-content:center;gap:6px;
                    font-size:0.72rem;color:var(--text3);cursor:pointer;">
        <input type="checkbox" id="gvp-remember" style="cursor:pointer;accent-color:var(--blue);" />
        Remember my choice
      </label>
    </div>`;

  document.body.appendChild(el);

  const choose = (mode) => {
    if (document.getElementById('gvp-remember')?.checked)
      localStorage.setItem(_VP_KEY, mode);
    el.remove();
    if (mode === 'classic') {
      window.open(`/gallery-classic?galleryDate=${dateStr}`, '_blank');
    } else {
      openGalleryForDate(dateStr);
    }
  };

  document.getElementById('gvp-old').addEventListener('click', () => choose('classic'));
  document.getElementById('gvp-new').addEventListener('click', () => choose('new'));
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
}

// Reset gallery layout preference (browser console: resetViewerPref())
function resetViewerPref() { localStorage.removeItem(_VP_KEY); }

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

## File: `static/js/gallery-sync.js`
```js
/**
 * @fileoverview gallery-sync.js
 * @description Synchronizes gallery state across multiple windows/tabs using BroadcastChannel.
 */

const gallerySyncChannel = new BroadcastChannel('gallery_sync');

/**
 * Sends the current gallery state to other windows.
 */
function syncGalleryToOthers() {
  const modal = document.getElementById('gallery-modal');
  if (!modal || !modal.classList.contains('open')) return;

  const payload = {
    type: 'GALLERY_SYNC',
    date: state.gallery.date,
    index: state.gallery.currentIndex,
    images: state.gallery.images,
    sourceRow: state.gallery.sourceRow,
    _baseImages: state.gallery._baseImages,
    _baseDate: state.gallery._baseDate,
    _baseSourceRow: state.gallery._baseSourceRow,
    tagFilter: state.gallery.tagFilter || [],
    filterMode: state.gallery.filterMode || 'or'
  };
  gallerySyncChannel.postMessage(payload);
}

// Receive state changes from other windows
gallerySyncChannel.onmessage = (event) => {
  const data = event.data;
  if (data.type === 'GALLERY_SYNC') {
    const modal = document.getElementById('gallery-modal');
    // Only apply sync if our gallery is also open
    if (!modal || !modal.classList.contains('open')) return;

    // Update local state
    state.gallery.date = data.date;
    state.gallery.currentIndex = data.index;
    state.gallery.images = data.images;
    state.gallery.sourceRow = data.sourceRow;
    state.gallery._baseImages = data._baseImages;
    state.gallery._baseDate = data._baseDate;
    state.gallery._baseSourceRow = data._baseSourceRow;
    state.gallery.tagFilter = data.tagFilter;
    state.gallery.filterMode = data.filterMode;

    // Use a flag to prevent this render from triggering a sync back
    state._isSyncUpdate = true;
    state.gallery._skipFilterRescopeOnce = true;
    renderGallery();
    state._isSyncUpdate = false;
  }
};

```
