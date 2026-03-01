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

  const thumbs = document.getElementById('gallery-thumbs'); thumbs.innerHTML = '';
  const thumbImages = _getGalleryThumbImages();
  let dragFromIndex = -1;
  thumbImages.forEach(({ url, globalIdx, isCurrentDate }) => {
    const wrap = document.createElement('div'); wrap.className = 'gv2-thumb-wrap'; wrap.draggable = !IS_TOUCH_DEVICE;
    const t = document.createElement('img');
    t.src = url;
    t.className = 'gv2-thumb' + (globalIdx === currentIndex ? ' active' : '');
    t.addEventListener('click', () => { state.gallery.currentIndex = globalIdx; renderGallery(); });
    t.addEventListener('contextmenu', async e => {
      e.preventDefault();
      const dateInp = document.createElement('input');
      dateInp.type = 'date';
      dateInp.style.position = 'absolute';
      dateInp.style.opacity = '0';
      dateInp.style.pointerEvents = 'none';
      dateInp.style.left = e.clientX + 'px';
      dateInp.style.top = e.clientY + 'px';

      const onPickerChange = async () => {
        const rawDate = dateInp.value;
        if (document.body.contains(dateInp)) document.body.removeChild(dateInp);
        if (!rawDate) return;
        const targetDate = normalizeDate(rawDate);
        if (confirm(`Move image to ${targetDate}?`)) {
          await moveGalleryImageToDate(globalIdx, targetDate);
        }
      };

      dateInp.addEventListener('change', onPickerChange);

      const removeInp = () => { if (document.body.contains(dateInp)) document.body.removeChild(dateInp); };
      dateInp.addEventListener('blur', removeInp);

      document.body.appendChild(dateInp);

      try {
        dateInp.showPicker();
      } catch (err) {
        removeInp();
        const rawDate = prompt('Enter date (YYYY-MM-DD) to move this image to its consolidated row:');
        if (!rawDate) return;
        const targetDate = normalizeDate(rawDate);
        if (!targetDate || !targetDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          showToast('Invalid date format', 'error'); return;
        }
        if (confirm(`Move image to ${targetDate}?`)) {
          await moveGalleryImageToDate(globalIdx, targetDate);
        }
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

  if (thumbs.children.length > 0) {
    const activeThumb = thumbs.querySelector('.gv2-thumb.active');
    if (activeThumb) {
      setTimeout(() => {
        activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }, 50);
    }
  }
}

function renderGalleryStats() {
  const display = document.getElementById('gallery-heads-display');
  if (!display) return;
  const heads = getActiveShowHeads();
  const cols = state.columns.filter(col => heads[col] && col.toLowerCase() !== 'date' && !isTagColumn(col));
  if (cols.length === 0) {
    display.style.display = 'none';
    return;
  }

  const activeUrl = (state.gallery.images || [])[state.gallery.currentIndex] || '';
  const ctx = getCurrentGalleryPreserveContext();
  let dateToUse = state.gallery.date || ctx.date;

  let trades = [];
  if (state.calendarMode === 'consolidated') {
    if (dateToUse) {
      trades = getTradesForDate(dateToUse);
    } else {
      const owner = getOwnerTradeForImageUrl(activeUrl);
      if (owner) trades = [owner];
    }
  } else {
    const owner = getOwnerTradeForImageUrl(activeUrl);
    if (owner) trades = [owner];
  }

  if (trades.length === 0) {
    display.style.display = 'none';
    return;
  }

  display.style.display = 'flex';
  display.innerHTML = '';

  const isConsolidated = state.calendarMode === 'consolidated' && trades.length > 1;

  if (isConsolidated) {
    const title = document.createElement('div');
    title.style.fontWeight = 'bold';
    title.style.borderBottom = '1px solid rgba(255,255,255,0.2)';
    title.style.marginBottom = '2px';
    title.style.paddingBottom = '2px';
    title.textContent = 'Consolidated Stats';
    display.appendChild(title);

    cols.forEach(col => {
      const lower = col.toLowerCase();
      if (lower === 'thumbnail' || lower === 'sell time' || lower === 'buy time') return;
      const vals = trades.map(t => t[col]).filter(v => v !== '' && v != null);
      if (!vals.length) return;
      const item = document.createElement('div');
      const nums = vals.map(v => parseFloat(v)).filter(v => !isNaN(v));
      if (nums.length === vals.length) {
        let outNum;
        if (lower === 'sell price' || lower === 'buy price') outNum = nums.reduce((a, b) => a + b, 0) / nums.length;
        else outNum = nums.reduce((a, b) => a + b, 0);
        const out = outNum % 1 === 0 ? outNum : outNum.toFixed(2);
        item.textContent = `${col}: ${out}`;
        if (lower.includes('profit') || lower === 'rs') item.style.color = outNum >= 0 ? 'var(--green)' : 'var(--red)';
      } else {
        const first = String(vals[0]);
        const same = vals.every(v => String(v) === first);
        item.textContent = same ? `${col}: ${first}` : `${col}: ${vals.length} entries`;
      }
      display.appendChild(item);
    });
  } else {
    trades.forEach((tr, i) => {
      const title = document.createElement('div');
      title.style.fontWeight = 'bold';
      title.style.borderBottom = '1px solid rgba(255,255,255,0.2)';
      title.style.marginBottom = '2px';
      title.style.paddingBottom = '2px';
      title.textContent = document.getElementById('gallery-date-picker')?.value === dateToUse && trades.length === 1 ? 'Trade Stats' : 'Individual Stats';
      display.appendChild(title);

      cols.forEach(col => {
        if (col.toLowerCase() === 'thumbnail') return;
        const val = tr[col];
        if (val === '' || val == null) return;
        const item = document.createElement('div');
        const isProfit = col.toLowerCase().includes('profit') || col.toLowerCase() === 'rs';
        if (isProfit) {
          const num = parseFloat(val);
          if (!isNaN(num)) {
            item.textContent = `${col}: ${num > 0 ? '+' : ''}${num}`;
            item.style.color = num >= 0 ? 'var(--green)' : 'var(--red)';
          } else { item.textContent = `${col}: ${val}`; }
        } else {
          item.textContent = `${col}: ${val}`;
        }
        display.appendChild(item);
      });
    });
  }
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
    const arr = getImageTagsForGalleryItem(item).map(t => typeof t === 'string' ? t.toLowerCase().trim() : String(t).toLowerCase().trim());
    return mode === 'and'
      ? tagFilter.every(t => arr.includes(typeof t === 'string' ? t.toLowerCase().trim() : String(t).toLowerCase().trim()))
      : tagFilter.some(t => arr.includes(typeof t === 'string' ? t.toLowerCase().trim() : String(t).toLowerCase().trim()));
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

async function moveGalleryImageToDate(globalIdx, targetDate) {
  const arr = state.gallery.images || [];
  if (globalIdx < 0 || globalIdx >= arr.length) return;
  const imageUrl = arr[globalIdx];

  const ownerTrade = getOwnerTradeForImageUrl(imageUrl);
  if (ownerTrade) {
    ownerTrade.images = (ownerTrade.images || []).filter(u => u !== imageUrl);
  } else if (state.gallery.date && state.dayData[state.gallery.date]?.images) {
    state.dayData[state.gallery.date].images = state.dayData[state.gallery.date].images.filter(u => u !== imageUrl);
  }

  let targetTrade = getTradeForDate(targetDate);
  if (!targetTrade) {
    targetTrade = getOrCreateTrade(targetDate);
  }
  if (!targetTrade.images) targetTrade.images = [];
  targetTrade.images.push(imageUrl);

  arr.splice(globalIdx, 1);
  if (state.gallery.currentIndex >= arr.length) state.gallery.currentIndex = Math.max(0, arr.length - 1);

  if (!arr.length) {
    await saveTrades();
    renderTable();
    renderCalendar();
    document.getElementById('gallery-modal').classList.remove('open');
    unlockBodyScroll();
    showToast(`Image moved to ${targetDate}`, 'success');
    return;
  }
  syncGalleryImageOrderToTrades();
  await saveTrades();
  renderGallery();
  renderTable();
  renderCalendar();
  showToast(`Image moved to ${targetDate}`, 'success');
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

function renderGalleryVideoUrls() {
  const container = document.getElementById('gv2-video-url-list');
  const trayElem = document.getElementById('gv2-video-url-tray');
  if (!container || !trayElem) return;

  const ctx = getCurrentGalleryPreserveContext();
  const dateToUse = state.gallery.date || ctx.date;

  if (!dateToUse) {
    trayElem.style.display = 'none';
    return;
  }

  const dayTrades = getTradesForDate(dateToUse);
  if (!dayTrades || dayTrades.length === 0) {
    trayElem.style.display = 'none';
    return;
  }

  trayElem.style.display = 'block';
  container.innerHTML = '';

  container.style.display = 'flex';
  container.style.flexWrap = 'wrap';
  container.style.gap = '8px';
  container.style.padding = '4px 0';
  container.style.marginBottom = '12px';

  dayTrades.forEach((trade, idx) => {
    const hasVideo = !!(trade[VIDEO_COLUMN] && trade[VIDEO_COLUMN].trim());

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '4px';

    const circleBtn = document.createElement('div');
    circleBtn.style.width = '28px';
    circleBtn.style.height = '28px';
    circleBtn.style.borderRadius = '50%';
    circleBtn.style.display = 'flex';
    circleBtn.style.alignItems = 'center';
    circleBtn.style.justifyContent = 'center';
    circleBtn.style.fontSize = '12px';
    circleBtn.style.fontWeight = '600';
    circleBtn.style.cursor = 'pointer';
    circleBtn.style.transition = 'all 0.2s';
    circleBtn.textContent = String(idx + 1);

    if (hasVideo) {
      circleBtn.style.background = 'var(--blue)';
      circleBtn.style.color = '#fff';
      circleBtn.style.boxShadow = '0 0 6px rgba(41, 121, 255, 0.4)';
      circleBtn.title = `Trade ${idx + 1} Video\nClick to open link\nRight-click to edit URL`;
    } else {
      circleBtn.style.background = 'transparent';
      circleBtn.style.border = '1.5px dashed var(--text2)';
      circleBtn.style.color = 'var(--text2)';
      circleBtn.title = `Trade ${idx + 1}\nClick to add video URL`;
    }

    circleBtn.addEventListener('mouseenter', () => {
      if (!hasVideo) {
        circleBtn.style.border = '1.5px dashed var(--text)';
        circleBtn.style.color = 'var(--text)';
      } else {
        circleBtn.style.filter = 'brightness(1.1)';
      }
    });

    circleBtn.addEventListener('mouseleave', () => {
      if (!hasVideo) {
        circleBtn.style.border = '1.5px dashed var(--text2)';
        circleBtn.style.color = 'var(--text2)';
      } else {
        circleBtn.style.filter = '';
      }
    });

    circleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentUrl = trade[VIDEO_COLUMN] || '';
      if (hasVideo) {
        window.open(currentUrl, '_blank');
      } else {
        const inputUrl = prompt(`Enter Video URL for Trade ${idx + 1} (or paste and hit Enter):`, currentUrl);
        if (inputUrl !== null) {
          trade[VIDEO_COLUMN] = inputUrl.trim();
          saveTrades();
          renderGalleryVideoUrls();
          if (typeof renderTable === 'function') renderTable();
        }
      }
    });

    circleBtn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const currentUrl = trade[VIDEO_COLUMN] || '';
      const inputUrl = prompt(`Edit Video URL for Trade ${idx + 1}:`, currentUrl);
      if (inputUrl !== null) {
        trade[VIDEO_COLUMN] = inputUrl.trim();
        saveTrades();
        renderGalleryVideoUrls();
        if (typeof renderTable === 'function') renderTable();
      }
    });

    const netPLNum = parseFloat(trade['Net P/L']);
    const plLabel = document.createElement('div');
    plLabel.style.fontSize = '0.65rem';
    plLabel.style.fontWeight = '600';
    if (!isNaN(netPLNum)) {
      plLabel.textContent = Math.round(Math.abs(netPLNum));
      plLabel.style.color = netPLNum >= 0 ? 'var(--green)' : 'var(--red)';
    } else {
      plLabel.textContent = '0';
      plLabel.style.color = 'var(--text2)';
    }

    wrapper.appendChild(circleBtn);
    wrapper.appendChild(plLabel);

    container.appendChild(wrapper);
  });
}

