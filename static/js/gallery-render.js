// gallery-render.js — renderGallery orchestrator
// Tray logic → gallery-render-tray.js | Thumbnail strip → gallery-render-thumbs.js

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

  // ── Date label ───────────────────────────────────────────────────────────
  const dateEl = document.getElementById('gallery-date');
  if (dateEl) {
    dateEl.style.display = '';
    dateEl.textContent = date
      ? (typeof formatDisplayDate === 'function' ? formatDisplayDate(date) : date)
      : `${images.length} image(s)`;
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
    img.style.display = ''; img.style.opacity = ''; img.style.filter = ''; img.title = '';
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
      filterBar.innerHTML = `<span>FILTER ACTIVE (${modeText}):</span> <span style="background:#000;color:#fff;padding:2px 8px;border-radius:20px;margin-left:6px">${state.gallery.tagFilter.join(', ')}</span>`;
      filterBar.style.display = 'flex';
      if (countBar) { document.getElementById('gallery-filter-count-text').textContent = images.length; countBar.style.display = 'block'; }
    } else {
      filterBar.style.display = 'none';
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
}
