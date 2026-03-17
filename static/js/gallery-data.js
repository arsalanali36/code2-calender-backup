/**
 * @fileoverview gallery-data.js
 * @description Low-level get/set for overlays, marquee boxes, sub-images; image times fetch.
 * @exports getImagesForDate, fetchImageTimesForGallery, getOwnerTradeForGalleryImage,
 *          getMarqueeTagsForImage, getCurrentGalleryImageTagInfo,
 *          getOverlayUrlForImage, setOverlayUrlForCurrentGalleryImage,
 *          setOverlayUrlForImage, getMarqueeBoxesForImage, setMarqueeBoxesForImage,
 *          packMarqueeBoxes, unpackMarqueeBoxes, removeOverlayForImage,
 *          canvasHasVisibleInk, autoSaveAnnotationSession
 * @reads state.trades, state.dayData, state.gallery, state._localOverlays
 * @writes state._localOverlays, trade.overlays, trade.marqueeBoxes, state.gallery.imageTimes
 * @calls saveTrades, renderGallery, fetch /api/image-times
 */

function getImagesForDate(dateStr) {
  const out = [];
  (state.dayData[dateStr]?.images || []).forEach(url => out.push(url));

  // Migrate old dayData.videos dict entries into the array (after their associated image)
  const dayVideos = state.dayData[dateStr]?.videos;
  if (dayVideos) {
    Object.entries(dayVideos).forEach(([imgUrl, videoUrl]) => {
      if (!videoUrl || out.includes(videoUrl)) return;
      const idx = out.indexOf(imgUrl);
      if (idx >= 0) out.splice(idx + 1, 0, videoUrl);
      else out.push(videoUrl);
    });
  }

  getTradesForDate(dateStr).forEach(t => {
    if (
      (t['Time'] === '' || t['Time'] === undefined) &&
      (t['Ex Time'] === '' || t['Ex Time'] === undefined) &&
      (t['Buy Time'] === '' || t['Buy Time'] === undefined) &&
      (t['Sell Time'] === '' || t['Sell Time'] === undefined) &&
      (t['Gross P/L'] === '' || t['Gross P/L'] === undefined) &&
      (t['Net P/L'] === '' || t['Net P/L'] === undefined) &&
      (t['Rs'] === '' || t['Rs'] === undefined) &&
      (t['Qty'] === '' || t['Qty'] === undefined)
    ) {
      return;
    }
    (t.images || []).forEach(url => out.push(url));

    // Migrate old trade.videos dict entries into the array (after their associated image)
    if (t.videos) {
      Object.entries(t.videos).forEach(([imgUrl, videoUrl]) => {
        if (!videoUrl || out.includes(videoUrl)) return;
        const idx = out.indexOf(imgUrl);
        if (idx >= 0) out.splice(idx + 1, 0, videoUrl);
        else out.push(videoUrl);
      });
    }
  });

  (state.dayData[dateStr]?.closeImages || []).forEach(url => out.push(url));
  return out;
}

async function fetchImageTimesForGallery() {
  const urlSet = new Set(state.gallery._baseImages || state.gallery.images || []);
  // Also include sub-images (groups) for the current date
  const dayDate = state.gallery.date;
  if (dayDate) {
    const addSubs = (obj) => {
      if (!obj?.subImages) return;
      Object.values(obj.subImages).forEach(subs => subs.forEach(u => urlSet.add(u)));
    };
    getTradesForDate(dayDate).forEach(addSubs);
    if (state.dayData[dayDate]) addSubs(state.dayData[dayDate]);
  }
  const urls = Array.from(urlSet);
  if (!urls.length) return;
  try {
    const times = await imageService.getImageTimes(urls);
    state.gallery.imageTimes = times;
    renderGallery();
  } catch (err) {
    console.error('Failed to fetch image times', err);
  }
}

function getTradeForDateByImage(dateStr, imageUrl) {
  return getTradesForDate(dateStr).find(t => t?.overlays && t.overlays[imageUrl]) || getTradeForDate(dateStr);
}

function getDatesWithImages() {
  const tradeDates = state.trades
    .filter(t => (t.images || []).length > 0)
    .map(t => normalizeDate(extractDateFromTrade(t)))
    .filter(Boolean);
  const dayDates = Object.entries(state.dayData)
    .filter(([, v]) => v?.images?.length > 0)
    .map(([k]) => k);
  return Array.from(new Set([...tradeDates, ...dayDates])).sort();
}

function getOwnerTradeForGalleryImage() {
  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  if (!imgUrl) return null;

  if (state.gallery.date) {
    const idx = state.trades.findIndex(t =>
      normalizeDate(extractDateFromTrade(t)) === state.gallery.date &&
      Array.isArray(t.images) &&
      t.images.includes(imgUrl)
    );
    if (idx >= 0) return state.trades[idx];
    return null; // day-level image
  }

  if (state.gallery.sourceRow !== null && state.trades[state.gallery.sourceRow]) {
    return state.trades[state.gallery.sourceRow];
  }

  return state.trades.find(t => Array.isArray(t.images) && t.images.includes(imgUrl)) || null;
}

function getMarqueeTagsForImage(imageUrl, dateHint = '', sourceRow = null) {
  if (!imageUrl) return [];
  const boxes = getMarqueeBoxesForImage(imageUrl, dateHint, sourceRow);
  const tags = new Set();
  (Array.isArray(boxes) ? boxes : []).forEach(b => {
    (Array.isArray(b?.tags) ? b.tags : []).forEach(t => {
      const x = String(t || '').trim();
      if (x) tags.add(x);
    });
  });
  return Array.from(tags);
}

function getCurrentGalleryImageTagInfo() {
  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  const trade = getOwnerTradeForGalleryImage();
  let ownerType = 'trade';
  let dateKey = '';
  let imageTags = getImageTagsForUrl(trade, imgUrl);
  if (!trade && imgUrl) {
    dateKey = normalizeDate(state.gallery.date || '');
    if (!dateKey || !(state.dayData[dateKey]?.images || []).includes(imgUrl)) {
      const fromMeta = state.gallery._filteredMeta && state.gallery._filteredMeta[state.gallery.currentIndex];
      dateKey = normalizeDate(fromMeta?.date || dateKey || '');
    }
    if (!dateKey) {
      for (const [d, v] of Object.entries(state.dayData || {})) {
        if ((v?.images || []).includes(imgUrl)) { dateKey = d; break; }
      }
    }
    if (dateKey) {
      ownerType = 'day';
      imageTags = getDayImageTagsForUrl(dateKey, imgUrl);
    }
  }
  const marqueeTags = getMarqueeTagsForImage(imgUrl, state.gallery.date || '', state.gallery.sourceRow);
  const all = Array.from(new Set([...imageTags, ...marqueeTags]));
  return { imgUrl, trade, ownerType, dateKey, imageTags, marqueeTags, all };
}

function getOverlayUrlForImage(imageUrl, dateHint = '') {
  if (!imageUrl) return '';
  if (dateHint) {
    const dayTrades = getTradesForDate(dateHint);
    for (const t of dayTrades) {
      if (t?.overlays && t.overlays[imageUrl]) return t.overlays[imageUrl];
    }
    const dayOverlays = state.dayData[dateHint]?.overlays;
    if (dayOverlays && dayOverlays[imageUrl]) return dayOverlays[imageUrl];
  }
  for (const t of state.trades) {
    if (t?.overlays && t.overlays[imageUrl]) return t.overlays[imageUrl];
  }
  for (const d of Object.values(state.dayData || {})) {
    if (d?.overlays && d.overlays[imageUrl]) return d.overlays[imageUrl];
  }
  return '';
}

function setOverlayUrlForCurrentGalleryImage(overlayUrl) {
  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  if (!imgUrl || !overlayUrl) return false;

  const trade = getOwnerTradeForGalleryImage();
  if (trade) {
    if (!trade.overlays) trade.overlays = {};
    trade.overlays[imgUrl] = overlayUrl;
    return true;
  }

  if (state.gallery.date) {
    if (!state.dayData[state.gallery.date]) state.dayData[state.gallery.date] = {};
    if (!state.dayData[state.gallery.date].overlays) state.dayData[state.gallery.date].overlays = {};
    state.dayData[state.gallery.date].overlays[imgUrl] = overlayUrl;
    return true;
  }

  return false;
}

function setOverlayUrlForImage(imageUrl, overlayUrl, dateHint = '', sourceRow = null) {
  if (!imageUrl || !overlayUrl) return false;
  if (sourceRow !== null && state.trades[sourceRow] && (state.trades[sourceRow].images || []).includes(imageUrl)) {
    const t = state.trades[sourceRow];
    if (!t.overlays) t.overlays = {};
    t.overlays[imageUrl] = overlayUrl;
    return true;
  }
  if (dateHint) {
    const row = getTradesForDate(dateHint).find(t => (t.images || []).includes(imageUrl));
    if (row) {
      if (!row.overlays) row.overlays = {};
      row.overlays[imageUrl] = overlayUrl;
      return true;
    }
    if (!state.dayData[dateHint]) state.dayData[dateHint] = {};
    if (!state.dayData[dateHint].overlays) state.dayData[dateHint].overlays = {};
    state.dayData[dateHint].overlays[imageUrl] = overlayUrl;
    return true;
  }
  const owner = state.trades.find(t => (t.images || []).includes(imageUrl));
  if (owner) {
    if (!owner.overlays) owner.overlays = {};
    owner.overlays[imageUrl] = overlayUrl;
    return true;
  }
  return false;
}

function getMarqueeBoxesForImage(imageUrl, dateHint = '', sourceRow = null) {
  if (!imageUrl) return [];
  if (sourceRow !== null && state.trades[sourceRow]?.marqueeBoxes?.[imageUrl]) {
    return JSON.parse(JSON.stringify(state.trades[sourceRow].marqueeBoxes[imageUrl]));
  }
  if (dateHint) {
    const row = getTradesForDate(dateHint).find(t => (t.images || []).includes(imageUrl) && t?.marqueeBoxes?.[imageUrl]);
    if (row?.marqueeBoxes?.[imageUrl]) return JSON.parse(JSON.stringify(row.marqueeBoxes[imageUrl]));
    const day = state.dayData[dateHint];
    if (day?.marqueeBoxes?.[imageUrl]) return JSON.parse(JSON.stringify(day.marqueeBoxes[imageUrl]));
  }
  const owner = state.trades.find(t => (t.images || []).includes(imageUrl) && t?.marqueeBoxes?.[imageUrl]);
  if (owner?.marqueeBoxes?.[imageUrl]) return JSON.parse(JSON.stringify(owner.marqueeBoxes[imageUrl]));
  return [];
}

function setMarqueeBoxesForImage(imageUrl, boxes, dateHint = '', sourceRow = null) {
  if (!imageUrl) return false;
  const safe = Array.isArray(boxes) ? JSON.parse(JSON.stringify(boxes)) : [];
  if (sourceRow !== null && state.trades[sourceRow] && (state.trades[sourceRow].images || []).includes(imageUrl)) {
    const t = state.trades[sourceRow];
    if (!t.marqueeBoxes) t.marqueeBoxes = {};
    t.marqueeBoxes[imageUrl] = safe;
    return true;
  }
  if (dateHint) {
    const row = getTradesForDate(dateHint).find(t => (t.images || []).includes(imageUrl));
    if (row) {
      if (!row.marqueeBoxes) row.marqueeBoxes = {};
      row.marqueeBoxes[imageUrl] = safe;
      return true;
    }
    if (!state.dayData[dateHint]) state.dayData[dateHint] = {};
    if (!state.dayData[dateHint].marqueeBoxes) state.dayData[dateHint].marqueeBoxes = {};
    state.dayData[dateHint].marqueeBoxes[imageUrl] = safe;
    return true;
  }
  const owner = state.trades.find(t => (t.images || []).includes(imageUrl));
  if (owner) {
    if (!owner.marqueeBoxes) owner.marqueeBoxes = {};
    owner.marqueeBoxes[imageUrl] = safe;
    return true;
  }
  return false;
}

function packMarqueeBoxes(boxes, canvasW, canvasH) {
  const w = Math.max(1, Number(canvasW) || 1);
  const h = Math.max(1, Number(canvasH) || 1);
  return (Array.isArray(boxes) ? boxes : []).map(b => ({
    rx: Math.max(0, Math.min(1, (Number(b.x) || 0) / w)),
    ry: Math.max(0, Math.min(1, (Number(b.y) || 0) / h)),
    rw: Math.max(0, Math.min(1, (Number(b.w) || 0) / w)),
    rh: Math.max(0, Math.min(1, (Number(b.h) || 0) / h)),
    tags: Array.isArray(b.tags) ? [...b.tags] : []
  }));
}

function unpackMarqueeBoxes(stored, canvasW, canvasH) {
  const w = Math.max(1, Number(canvasW) || 1);
  const h = Math.max(1, Number(canvasH) || 1);
  const out = (Array.isArray(stored) ? stored : []).map(b => {
    if (b && typeof b === 'object' && 'rx' in b && 'ry' in b && 'rw' in b && 'rh' in b) {
      return {
        x: Math.max(0, (Number(b.rx) || 0) * w),
        y: Math.max(0, (Number(b.ry) || 0) * h),
        w: Math.max(8, (Number(b.rw) || 0) * w),
        h: Math.max(8, (Number(b.rh) || 0) * h),
        tags: Array.isArray(b.tags) ? [...b.tags] : []
      };
    }
    return {
      x: Math.max(0, Number(b?.x) || 0),
      y: Math.max(0, Number(b?.y) || 0),
      w: Math.max(8, Number(b?.w) || 8),
      h: Math.max(8, Number(b?.h) || 8),
      tags: Array.isArray(b?.tags) ? [...b.tags] : []
    };
  });

  if (out.length) {
    const maxX = Math.max(...out.map(b => b.x + b.w));
    const maxY = Math.max(...out.map(b => b.y + b.h));
    if (maxX > w * 1.08 || maxY > h * 1.08) {
      const sx = w / Math.max(maxX, 1);
      const sy = h / Math.max(maxY, 1);
      out.forEach(b => {
        b.x *= sx; b.w *= sx;
        b.y *= sy; b.h *= sy;
        b.w = Math.max(8, b.w);
        b.h = Math.max(8, b.h);
      });
    }
  }
  return out;
}

function removeOverlayForImage(imageUrl, dateHint = '', sourceRow = null) {
  if (!imageUrl) return false;
  let changed = false;
  if (sourceRow !== null && state.trades[sourceRow]?.overlays?.[imageUrl]) {
    delete state.trades[sourceRow].overlays[imageUrl];
    changed = true;
  }
  if (dateHint) {
    getTradesForDate(dateHint).forEach(t => {
      if (t?.overlays?.[imageUrl]) {
        delete t.overlays[imageUrl];
        changed = true;
      }
    });
    if (state.dayData[dateHint]?.overlays?.[imageUrl]) {
      delete state.dayData[dateHint].overlays[imageUrl];
      changed = true;
    }
  } else {
    state.trades.forEach(t => {
      if (t?.overlays?.[imageUrl]) {
        delete t.overlays[imageUrl];
        changed = true;
      }
    });
    Object.values(state.dayData || {}).forEach(d => {
      if (d?.overlays?.[imageUrl]) {
        delete d.overlays[imageUrl];
        changed = true;
      }
    });
  }
  return changed;
}

// ── Audio per-image ───────────────────────────────────────────────────────────

function getAudioForImage(imageUrl, dateHint = '') {
  if (!imageUrl) return '';
  if (dateHint) {
    for (const t of getTradesForDate(dateHint)) {
      if (t?.audios?.[imageUrl]) return t.audios[imageUrl];
    }
    const dayAudios = state.dayData[dateHint]?.audios;
    if (dayAudios?.[imageUrl]) return dayAudios[imageUrl];
  }
  for (const t of state.trades) {
    if (t?.audios?.[imageUrl]) return t.audios[imageUrl];
  }
  for (const d of Object.values(state.dayData || {})) {
    if (d?.audios?.[imageUrl]) return d.audios[imageUrl];
  }
  return '';
}

function setAudioForCurrentGalleryImage(audioUrl) {
  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  if (!imgUrl || !audioUrl) return false;
  const trade = getOwnerTradeForGalleryImage();
  if (trade) {
    if (!trade.audios) trade.audios = {};
    trade.audios[imgUrl] = audioUrl;
    return true;
  }
  if (state.gallery.date) {
    if (!state.dayData[state.gallery.date]) state.dayData[state.gallery.date] = {};
    if (!state.dayData[state.gallery.date].audios) state.dayData[state.gallery.date].audios = {};
    state.dayData[state.gallery.date].audios[imgUrl] = audioUrl;
    return true;
  }
  return false;
}

function deleteAudioForCurrentGalleryImage() {
  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  if (!imgUrl) return;
  const trade = getOwnerTradeForGalleryImage();
  if (trade?.audios) {
    delete trade.audios[imgUrl];
  } else if (state.gallery.date && state.dayData[state.gallery.date]?.audios) {
    delete state.dayData[state.gallery.date].audios[imgUrl];
  }
}

// ── isVideoUrl helper ────────────────────────────────────────────────────────
function isVideoUrl(url) {
  return /\.(webm|mp4|mov|avi)(\?|$)/i.test(url || '');
}

// ── Insert video URL after current gallery image (in images array) ────────────
function insertVideoAfterCurrentGalleryImage(videoUrl) {
  const curIdx = state.gallery.currentIndex;
  const imgUrl = (state.gallery.images || [])[curIdx];
  if (!imgUrl || !videoUrl) return false;

  const trade = getOwnerTradeForGalleryImage();
  if (trade) {
    if (!Array.isArray(trade.images)) trade.images = [];
    const idx = trade.images.indexOf(imgUrl);
    if (idx >= 0) trade.images.splice(idx + 1, 0, videoUrl);
    else trade.images.push(videoUrl);
  } else if (state.gallery.date) {
    const dd = state.dayData[state.gallery.date] || {};
    state.dayData[state.gallery.date] = dd;
    if (!Array.isArray(dd.images)) dd.images = [];
    const idx = dd.images.indexOf(imgUrl);
    if (idx >= 0) dd.images.splice(idx + 1, 0, videoUrl);
    else dd.images.push(videoUrl);
  } else {
    return false;
  }

  // Also update state.gallery.images so the gallery reflects immediately
  if (!Array.isArray(state.gallery.images)) state.gallery.images = [];
  state.gallery.images.splice(curIdx + 1, 0, videoUrl);
  state.gallery.currentIndex = curIdx + 1;   // navigate to the new video
  return true;
}

// ── Video per-image ───────────────────────────────────────────────────────────

function getVideoForImage(imageUrl, dateHint = '') {
  if (!imageUrl) return '';
  if (dateHint) {
    for (const t of getTradesForDate(dateHint)) {
      if (t?.videos?.[imageUrl]) return t.videos[imageUrl];
    }
    const dayVideos = state.dayData[dateHint]?.videos;
    if (dayVideos?.[imageUrl]) return dayVideos[imageUrl];
  }
  for (const t of state.trades) {
    if (t?.videos?.[imageUrl]) return t.videos[imageUrl];
  }
  for (const d of Object.values(state.dayData || {})) {
    if (d?.videos?.[imageUrl]) return d.videos[imageUrl];
  }
  return '';
}

function setVideoForCurrentGalleryImage(videoUrl) {
  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  if (!imgUrl || !videoUrl) return false;
  const trade = getOwnerTradeForGalleryImage();
  if (trade) {
    if (!trade.videos) trade.videos = {};
    trade.videos[imgUrl] = videoUrl;
    return true;
  }
  if (state.gallery.date) {
    if (!state.dayData[state.gallery.date]) state.dayData[state.gallery.date] = {};
    if (!state.dayData[state.gallery.date].videos) state.dayData[state.gallery.date].videos = {};
    state.dayData[state.gallery.date].videos[imgUrl] = videoUrl;
    return true;
  }
  return false;
}

function deleteVideoForCurrentGalleryImage() {
  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  if (!imgUrl) return;
  const trade = getOwnerTradeForGalleryImage();
  if (trade?.videos) {
    delete trade.videos[imgUrl];
  } else if (state.gallery.date && state.dayData[state.gallery.date]?.videos) {
    delete state.dayData[state.gallery.date].videos[imgUrl];
  }
}

function canvasHasVisibleInk(canvas) {
  if (!canvas || !canvas.width || !canvas.height) return false;
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) return true;
  }
  return false;
}

function autoSaveAnnotationSession(session) {
  if (!session || !session.imageUrl || !session.dirty || annotState.saving) return;
  annotState.saving = true;
  const { canvas, imageUrl, date, sourceRow } = session;
  const hasInk = canvasHasVisibleInk(canvas);

  if (!hasInk) {
    if (state._localOverlays?.[imageUrl]) delete state._localOverlays[imageUrl];
    const removed = removeOverlayForImage(imageUrl, date, sourceRow);
    if (removed) saveTrades();
    annotState.saving = false;
    return;
  }

  state._localOverlays[imageUrl] = canvas.toDataURL('image/png');

  canvas.toBlob(async blob => {
    if (!blob) { annotState.saving = false; return; }
    const fd = new FormData();
    fd.append('image', blob, 'overlay.png');
    try {
      const data = await imageService.uploadImage(fd.get('image'));
      if (!data.url) throw new Error();
      if (setOverlayUrlForImage(imageUrl, data.url, date, sourceRow)) {
        if (state._localOverlays?.[imageUrl]) delete state._localOverlays[imageUrl];
        await saveTrades();
      }
    } catch (e) { }
    annotState.saving = false;
  }, 'image/png');
}

