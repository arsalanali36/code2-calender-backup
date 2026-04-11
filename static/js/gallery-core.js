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

  // 6. Global PDF Pages (if tagged)
  if (state.pdfPageTags) {
     Object.keys(state.pdfPageTags).forEach(pdfId => {
         const pages = state.pdfPageTags[pdfId];
         Object.keys(pages).forEach(pageNo => {
             const tags = pages[pageNo];
             if (tags && tags.length > 0) {
                 out.push({ 
                    url: `pdf://${pdfId}/${pageNo}`, 
                    date: '', 
                    sourceRow: null, 
                    type: 'pdf',
                    pdfId: pdfId,
                    pageNo: pageNo
                 });
             }
         });
     });
  }

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
