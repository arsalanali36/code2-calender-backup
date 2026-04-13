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
