/**
 * @fileoverview events-gallery.js
 * @description Gallery specific interaction panels, tags tray events.
 */

// events-gallery.js — Gallery tools, nav, upload, tags tray, tag cloud event bindings

function _bindGalleryEvents() {
  setupDropdown('gallery-tools-btn', 'gallery-tools-panel');
  const galleryToolsPanel = document.getElementById('gallery-tools-panel');
  if (galleryToolsPanel) galleryToolsPanel.addEventListener('click', e => e.stopPropagation());

  setupDropdown('gallery-show-heads-btn', 'gallery-show-heads-panel');
  const galleryHeadsPanel = document.getElementById('gallery-show-heads-panel');
  if (galleryHeadsPanel) galleryHeadsPanel.addEventListener('click', e => e.stopPropagation());

  setupDropdown('gallery-img-tag-filter-btn', 'gallery-img-tag-filter-panel');
  const galleryFilterPanel = document.getElementById('gallery-img-tag-filter-panel');
  if (galleryFilterPanel) galleryFilterPanel.addEventListener('click', e => e.stopPropagation());

  // Layer panel toggle
  const layerBtn = document.getElementById('gv2-layer-btn');
  if (layerBtn) layerBtn.addEventListener('click', () => {
    if (typeof toggleLayerPanel === 'function') toggleLayerPanel();
  });
  const timeBtn = document.getElementById('gv2-time-btn');
  if (timeBtn) timeBtn.addEventListener('click', () => {
    state.gallery.showTime = !state.gallery.showTime;
    timeBtn.classList.toggle('active', state.gallery.showTime);
    if (state.gallery.showTime) {
      fetchImageTimesForGallery();
    } else {
      renderGallery();
    }
  });
  const lpCloseBtn = document.getElementById('gv2-lp-close-btn');
  if (lpCloseBtn) lpCloseBtn.addEventListener('click', () => {
    if (typeof toggleLayerPanel === 'function') toggleLayerPanel();
  });

  // Layer panel selection controls
  document.getElementById('gv2-lp-sel-all')?.addEventListener('click', () => {
    const images = state.gallery.images || [];
    state.gallery.selectedIndices = new Set(images.map((_, i) => i));
    renderGallery();
  });
  document.getElementById('gv2-lp-sel-none')?.addEventListener('click', () => {
    state.gallery.selectedIndices = new Set();
    renderGallery();
  });
  document.getElementById('gv2-lp-sel-inv')?.addEventListener('click', () => {
    const images = state.gallery.images || [];
    const cur = state.gallery.selectedIndices || new Set();
    state.gallery.selectedIndices = new Set(images.map((_, i) => i).filter(i => !cur.has(i)));
    renderGallery();
  });

  // Layer panel resize handle
  (function () {
    const lpHandle = document.getElementById('gv2-lp-resize-handle');
    const lpPanel = document.getElementById('gv2-layer-panel');
    if (!lpHandle || !lpPanel) return;
    const LP_W_KEY = 'tj_layerPanelW';
    const savedW = parseInt(localStorage.getItem(LP_W_KEY) || '200', 10);
    const _lpSetWidth = (w) => {
      lpPanel.style.width = w + 'px';
      lpPanel.style.setProperty('--lp-thumb-w', Math.max(24, Math.min(80, Math.floor(w * 0.22))) + 'px');
    };
    _lpSetWidth(Math.max(140, Math.min(400, savedW)));
    let _lpResizing = false;
    lpHandle.addEventListener('mousedown', e => {
      _lpResizing = true; lpHandle.classList.add('dragging'); e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!_lpResizing) return;
      const panelRect = lpPanel.getBoundingClientRect();
      _lpSetWidth(Math.max(140, Math.min(400, e.clientX - panelRect.left)));
    });
    document.addEventListener('mouseup', () => {
      if (!_lpResizing) return;
      _lpResizing = false; lpHandle.classList.remove('dragging');
      localStorage.setItem(LP_W_KEY, String(parseInt(lpPanel.style.width, 10) || 200));
    });
  })();

  // Gallery modal: prevent browser native context menu (ContextMenu key shows custom menu instead)
  const _galleryModal = document.getElementById('gallery-modal');
  if (_galleryModal) {
    _galleryModal.addEventListener('contextmenu', e => {
      if (!_galleryModal.classList.contains('open')) return;
      e.preventDefault();
    });
  }

  // Ctrl+drag to select thumbnails, Ctrl+Alt+drag to deselect
  let _ctrlDragPending = false, _ctrlDragActive = false, _ctrlDragMode = 'select';
  let _ctrlDragStartPos = null;
  document.addEventListener('mousedown', e => {
    if (!document.getElementById('gallery-modal')?.classList.contains('open')) return;
    if (!e.ctrlKey || e.button !== 0) return;
    const wrap = e.target.closest('.gv2-thumb-wrap');
    if (!wrap || wrap.dataset.globalIdx === undefined) return;
    _ctrlDragPending = true;
    _ctrlDragMode = e.altKey ? 'deselect' : 'select';
    _ctrlDragStartPos = { x: e.clientX, y: e.clientY };
  });
  document.addEventListener('mousemove', e => {
    if (!_ctrlDragPending && !_ctrlDragActive) return;
    if (_ctrlDragPending) {
      const dx = e.clientX - _ctrlDragStartPos.x, dy = e.clientY - _ctrlDragStartPos.y;
      if (Math.sqrt(dx * dx + dy * dy) < 5) return;
      _ctrlDragActive = true; _ctrlDragPending = false;
    }
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const wrap = el?.closest('.gv2-thumb-wrap');
    if (!wrap || wrap.dataset.globalIdx === undefined) return;
    const idx = parseInt(wrap.dataset.globalIdx);
    if (!state.gallery.selectedIndices) state.gallery.selectedIndices = new Set();
    if (_ctrlDragMode === 'select') {
      if (!state.gallery.selectedIndices.has(idx)) {
        state.gallery.selectedIndices.add(idx);
        wrap.querySelector('.gv2-thumb')?.classList.add('selected-thumb');
      }
    } else {
      if (state.gallery.selectedIndices.has(idx)) {
        state.gallery.selectedIndices.delete(idx);
        wrap.querySelector('.gv2-thumb')?.classList.remove('selected-thumb');
      }
    }
  });
  document.addEventListener('mouseup', () => { _ctrlDragPending = false; _ctrlDragActive = false; });

  // Shortcuts popover toggle
  const scBtn = document.getElementById('gv2-shortcuts-btn');
  const scPop = document.getElementById('gv2-shortcuts-popover');
  if (scBtn && scPop) {
    scBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = scPop.style.display !== 'none';
      if (!isOpen && typeof renderShortcutsPopover === 'function') renderShortcutsPopover();
      scPop.style.display = isOpen ? 'none' : 'block';
    });
    document.addEventListener('mousedown', (e) => {
      if (!scBtn.contains(e.target) && !scPop.contains(e.target)) scPop.style.display = 'none';
    });
  }

  document.getElementById('gallery-prev').addEventListener('click', () => navigateGallery(-1));
  document.getElementById('gallery-next').addEventListener('click', () => navigateGallery(1));
  document.getElementById('gallery-date-prev').addEventListener('click', () => navigateGalleryDate(-1));
  document.getElementById('gallery-date-next').addEventListener('click', () => navigateGalleryDate(1));
  document.getElementById('gallery-date-picker').addEventListener('change', e => {
    const dateStr = e.target.value;
    const images = getImagesForDate(dateStr);
    if (images.length) {
      state.gallery.images = images; state.gallery.currentIndex = 0; state.gallery.date = dateStr; state.gallery.sourceRow = null;
      state.gallery._baseImages = [...images];
      state.gallery._baseDate = dateStr;
      state.gallery._baseSourceRow = null;
      if (state.gallery.tagFilter?.length) applyGalleryImageScopeByTagFilter(images[0] || '');
      renderGallery(); updateGalleryDateArrows();
    } else { showToast('No images for this date', ''); }
  });
  document.getElementById('gallery-upload-btn').addEventListener('click', () => {
    if (!state.gallery.date) return;
    let rowIdx = state.trades.findIndex(t => normalizeDate(extractDateFromTrade(t)) === state.gallery.date);
    if (rowIdx === -1) {
      const trade = getOrCreateTrade(state.gallery.date);
      rowIdx = state.trades.indexOf(trade);
      saveTrades();
    }
    state._galleryUploadCallback = () => {
      state.gallery.images = getImagesForDate(state.gallery.date);
      renderGallery();
      updateGalleryDateArrows();
    };
    openUploadModal(rowIdx);
  });
  const gtBtn = document.getElementById('gallery-tag-btn');
  if (gtBtn) gtBtn.addEventListener('click', openGalleryImageTagManager);
  const imgTagAddBtn = document.getElementById('img-tag-add-btn');
  if (imgTagAddBtn) imgTagAddBtn.addEventListener('click', addImageTagFromModal);
  const imgTagInp = document.getElementById('img-tag-new-name');
  if (imgTagInp) imgTagInp.addEventListener('keydown', e => {
    if (e.key === 'Enter') addImageTagFromModal();
  });
  ['img-tag-close-btn', 'img-tag-close-x'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', closeGalleryImageTagManager);
  });
  const imgTagModal = document.getElementById('img-tag-modal');
  if (imgTagModal) imgTagModal.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeGalleryImageTagManager();
  });

  document.getElementById('gallery-close').addEventListener('click', () => {
    if (annotState.active) stopAnnotation();
    closeGalleryImageTagManager();
    document.getElementById('gallery-modal').classList.remove('open');
    unlockBodyScroll();
  });

  document.getElementById('gv2-tags-btn').addEventListener('click', () => {
    const tray = document.getElementById('gv2-tags-tray');
    const btn = document.getElementById('gv2-tags-btn');
    const open = tray.style.display === 'none' || !tray.style.display;
    tray.style.display = open ? 'flex' : 'none';
    btn.classList.toggle('active', open);
    if (open) {
      if (typeof renderGalleryTagsTray === 'function') renderGalleryTagsTray();
      if (typeof renderGalleryVideoUrls === 'function') renderGalleryVideoUrls();
    }
  });

  // gv2-text-btn click is handled by bindAnnotationCanvas() in annotate-fabric.js

  document.getElementById('gv2-tc-mode-btn').addEventListener('click', () => {
    state.gallery.filterMode = state.gallery.filterMode === 'or' ? 'and' : 'or';
    applyGalleryImageScopeByTagFilter((state.gallery.images || [])[state.gallery.currentIndex] || '');
    renderGalleryTagCloud(); renderGallery();
  });

  document.getElementById('gv2-grp-filter-btn')?.addEventListener('click', () => {
    state.gallery.filterGroupMode = state.gallery.filterGroupMode === 'image' ? 'group' : 'image';
    const btn = document.getElementById('gv2-grp-filter-btn');
    const isGrp = state.gallery.filterGroupMode !== 'image';
    if (btn) { btn.textContent = isGrp ? 'Grp' : 'Img'; btn.classList.toggle('active', isGrp); }
    // Img mode mein expand state saaf karo
    if (!isGrp && state.gallery.expandedGroups) state.gallery.expandedGroups.clear();
    if (Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length) renderGallery();
  });

  document.getElementById('gv2-tc-clear-btn').addEventListener('click', () => {
    state.gallery.tagFilter = [];
    applyGalleryImageScopeByTagFilter((state.gallery.images || [])[state.gallery.currentIndex] || '');
    renderGalleryTagCloud(); renderGallery();
  });

  document.getElementById('gv2-obs-btn').addEventListener('click', () => {
    const d = state.gallery.date;
    if (d) {
      document.getElementById('gallery-modal').classList.remove('open');
      unlockBodyScroll();
      openObsModal(d);
    }
  });

  document.getElementById('gv2-add-grp-btn').addEventListener('click', () => {
    const name = prompt('New group name:');
    if (!name || !name.trim()) return;
    const g = name.trim();
    if (!state.tagGroups[g]) state.tagGroups[g] = [];
    saveTagGroups(); renderGalleryTagsTray();
  });
  const delTagBtn = document.getElementById('gv2-del-tag-btn');
  if (delTagBtn) delTagBtn.addEventListener('click', () => {
    state.tagDeleteMode = !state.tagDeleteMode;
    renderGalleryTagsTray();
  });
}
