/**
 * @fileoverview events-gallery.js
 * @description Gallery toolbar buttons: layer panel toggle, time display toggle, tags tray events.
 * @exports _bindGalleryEvents
 * @reads state.gallery.{showTime,layerPanelOpen}
 * @writes state.gallery.showTime, state.gallery.selectedSeparator
 * @calls toggleLayerPanel, fetchImageTimesForGallery, renderGallery
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
  if (galleryFilterPanel) {
    galleryFilterPanel.addEventListener('click', e => e.stopPropagation());
    // Populate when opened
    const _filterBtnEl = document.getElementById('gallery-img-tag-filter-btn');
    if (_filterBtnEl) _filterBtnEl.addEventListener('click', () => {
      if (typeof renderGalleryTagFilterPanel === 'function') renderGalleryTagFilterPanel();
    });
  }

  // Thumbnail panel toggle
  (function () {
    const thumbToggleBtn = document.getElementById('gv2-thumb-toggle-btn');
    const thumbPanel = document.getElementById('gv2-thumb-panel');
    if (!thumbToggleBtn || !thumbPanel) return;
    const TP_W_KEY = 'tj_thumbPanelW';
    const savedW = parseInt(localStorage.getItem(TP_W_KEY) || '74', 10);
    thumbPanel.style.setProperty('--thumb-panel-w', Math.max(54, Math.min(160, savedW)) + 'px');
    // Restore open state
    const wasOpen = localStorage.getItem('tj_thumbPanelOpen') === '1';
    if (wasOpen) { thumbPanel.classList.add('open'); thumbToggleBtn.classList.add('active'); }
    thumbToggleBtn.addEventListener('click', () => {
      const isOpen = thumbPanel.classList.toggle('open');
      thumbToggleBtn.classList.toggle('active', isOpen);
      localStorage.setItem('tj_thumbPanelOpen', isOpen ? '1' : '0');
    });
    // Resize handle for thumb panel
    const tpHandle = document.getElementById('gv2-thumb-panel-resize');
    if (tpHandle) {
      let _tpResizing = false;
      tpHandle.addEventListener('mousedown', e => {
        _tpResizing = true;
        tpHandle.classList.add('dragging');
        const startX = e.clientX;
        const startW = thumbPanel.offsetWidth;
        const _move = (me) => {
          if (!_tpResizing) return;
          const w = Math.max(54, Math.min(160, startW + (me.clientX - startX)));
          thumbPanel.style.setProperty('--thumb-panel-w', w + 'px');
          localStorage.setItem(TP_W_KEY, w);
        };
        const _up = () => {
          _tpResizing = false;
          tpHandle.classList.remove('dragging');
          document.removeEventListener('mousemove', _move);
          document.removeEventListener('mouseup', _up);
        };
        document.addEventListener('mousemove', _move);
        document.addEventListener('mouseup', _up);
      });
    }
  })();

  // Layer panel toggle
  const layerBtn = document.getElementById('gv2-layer-btn');
  if (layerBtn) layerBtn.addEventListener('click', () => {
    if (typeof toggleLayerPanel === 'function') toggleLayerPanel();
  });
  const timeBtn = document.getElementById('gv2-time-btn');
  // Restore persisted showTime preference
  state.gallery.showTime = localStorage.getItem('tj_showTime') === '1';
  if (timeBtn) timeBtn.classList.toggle('active', state.gallery.showTime);
  if (timeBtn) timeBtn.addEventListener('click', () => {
    state.gallery.showTime = !state.gallery.showTime;
    localStorage.setItem('tj_showTime', state.gallery.showTime ? '1' : '0');
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

  // Fullscreen button
  document.getElementById('gv2-fullscreen-btn')?.addEventListener('click', () => {
    const images = state.gallery.images || [];
    const cur = images[state.gallery.currentIndex];
    if (cur && typeof openFullscreenFromAppContext === 'function') openFullscreenFromAppContext(images, cur);
  });

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
    document.getElementById('gallery-tools-panel')?.classList.remove('open');
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

  // ── P&L pill dropdown toggle ──────────────────────────────────────────────
  const pnlPill = document.getElementById('gv2-pnl-pill');
  const pnlDrop = document.getElementById('gv2-pnl-dropdown');
  if (pnlPill && pnlDrop) {
    pnlPill.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('gv2-trade-dropdown')?.classList.remove('open');
      pnlDrop.classList.toggle('open');
    });
  }

  // ── Trade pill dropdown toggle ────────────────────────────────────────────
  const tradePill = document.getElementById('gv2-trade-pill');
  const tradeDrop = document.getElementById('gv2-trade-dropdown');
  if (tradePill && tradeDrop) {
    tradePill.addEventListener('click', (e) => {
      e.stopPropagation();
      pnlDrop?.classList.remove('open');
      tradeDrop.classList.toggle('open');
    });
  }

  // Close both dropdowns on outside click
  document.addEventListener('mousedown', (e) => {
    if (pnlPill && !pnlPill.closest('#gv2-pnl-wrap')?.contains(e.target)) pnlDrop?.classList.remove('open');
    if (tradePill && !tradePill.closest('#gv2-trade-pill-wrap')?.contains(e.target)) tradeDrop?.classList.remove('open');
  });

  // ── Dropdown: Delete Image ────────────────────────────────────────────────
  document.getElementById('gv2-delete-img-btn')?.addEventListener('click', () => {
    document.getElementById('gallery-tools-panel')?.classList.remove('open');
    removeGalleryImageAt(state.gallery.currentIndex);
  });

  // ── Dropdown: Download Image ──────────────────────────────────────────────
  document.getElementById('gv2-download-btn')?.addEventListener('click', () => {
    document.getElementById('gallery-tools-panel')?.classList.remove('open');
    const url = (state.gallery.images || [])[state.gallery.currentIndex];
    if (!url) return;
    const a = document.createElement('a');
    a.href = resolveImageUrl(url);
    a.download = url.split('/').pop() || 'image';
    a.click();
  });

  // ── Dropdown: Upload & Replace current image ──────────────────────────────
  document.getElementById('gv2-replace-btn')?.addEventListener('click', () => {
    document.getElementById('gallery-tools-panel')?.classList.remove('open');
    const curIdx = state.gallery.currentIndex;
    const oldUrl = (state.gallery.images || [])[curIdx];
    if (!oldUrl) return;
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const file = inp.files[0];
      if (!file) return;
      try {
        const result = await imageService.uploadImage(file);
        if (!result || !result.url) return;
        const newUrl = result.url;
        state.gallery.images[curIdx] = newUrl;
        const owner = getOwnerTradeForImageUrl(oldUrl);
        if (owner) {
          const idx = (owner.images || []).indexOf(oldUrl);
          if (idx >= 0) owner.images[idx] = newUrl;
          if (owner.overlays?.[oldUrl]) { owner.overlays[newUrl] = owner.overlays[oldUrl]; delete owner.overlays[oldUrl]; }
          if (owner.marqueeBoxes?.[oldUrl]) { owner.marqueeBoxes[newUrl] = owner.marqueeBoxes[oldUrl]; delete owner.marqueeBoxes[oldUrl]; }
        } else if (state.gallery.date && state.dayData[state.gallery.date]) {
          const dd = state.dayData[state.gallery.date];
          const idx = (dd.images || []).indexOf(oldUrl);
          if (idx >= 0) dd.images[idx] = newUrl;
          if (dd.overlays?.[oldUrl]) { dd.overlays[newUrl] = dd.overlays[oldUrl]; delete dd.overlays[oldUrl]; }
        }
        await saveTrades();
        renderGallery();
        showToast('Image replaced', 'success');
      } catch (err) { console.error(err); showToast('Upload failed', 'error'); }
    };
    inp.click();
  });

  // ── Dropdown: Add Image After current ─────────────────────────────────────
  document.getElementById('gv2-add-after-btn')?.addEventListener('click', () => {
    document.getElementById('gallery-tools-panel')?.classList.remove('open');
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const file = inp.files[0];
      if (!file) return;
      try {
        const result = await imageService.uploadImage(file);
        if (!result || !result.url) return;
        const newUrl = result.url;
        const curIdx = state.gallery.currentIndex;
        const curUrl = (state.gallery.images || [])[curIdx];
        state.gallery.images.splice(curIdx + 1, 0, newUrl);
        const owner = getOwnerTradeForImageUrl(curUrl);
        if (owner) {
          if (!owner.images) owner.images = [];
          const idx = owner.images.indexOf(curUrl);
          if (idx >= 0) owner.images.splice(idx + 1, 0, newUrl);
          else owner.images.push(newUrl);
        } else if (state.gallery.date) {
          const dd = state.dayData[state.gallery.date] || {};
          state.dayData[state.gallery.date] = dd;
          if (!dd.images) dd.images = [];
          const idx = dd.images.indexOf(curUrl);
          if (idx >= 0) dd.images.splice(idx + 1, 0, newUrl);
          else dd.images.push(newUrl);
        }
        state.gallery.currentIndex = curIdx + 1;
        await saveTrades();
        renderGallery();
        showToast('Image added', 'success');
      } catch (err) { console.error(err); showToast('Upload failed', 'error'); }
    };
    inp.click();
  });

  // ── Dropdown: Copy Image to clipboard ────────────────────────────────────
  document.getElementById('gv2-copy-img-btn')?.addEventListener('click', async () => {
    document.getElementById('gallery-tools-panel')?.classList.remove('open');
    const url = (state.gallery.images || [])[state.gallery.currentIndex];
    if (!url) return;
    try {
      const resp = await fetch(resolveImageUrl(url));
      const blob = await resp.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      showToast('Image copied to clipboard', 'success');
    } catch (_) {
      try { await navigator.clipboard.writeText(resolveImageUrl(url)); showToast('Image URL copied', 'info'); }
      catch (__) { showToast('Copy not supported in this browser', ''); }
    }
  });

  // ── Dropdown: Share Link ──────────────────────────────────────────────────
  document.getElementById('gv2-share-link-btn')?.addEventListener('click', async () => {
    document.getElementById('gallery-tools-panel')?.classList.remove('open');
    const date = state.gallery.date;
    const url = (state.gallery.images || [])[state.gallery.currentIndex];
    if (!date || !url) return;
    const params = new URLSearchParams({ galleryDate: date, galleryImg: url });
    const link = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast('Link copied to clipboard', 'success');
    } catch (_) { showToast('Copy failed', ''); }
  });

  // ── Dropdown: Mark for Review ─────────────────────────────────────────────
  (function () {
    const REVIEW_TAG = '⚑ Review';
    const btn = document.getElementById('gv2-mark-review-btn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      document.getElementById('gallery-tools-panel')?.classList.remove('open');
      const curUrl = (state.gallery.images || [])[state.gallery.currentIndex];
      if (!curUrl) return;
      const owner = getOwnerTradeForImageUrl(curUrl);
      let wasMarked;
      if (owner) {
        const tags = getImageTagsForUrl(owner, curUrl) || [];
        wasMarked = tags.includes(REVIEW_TAG);
        setImageTagsForUrl(owner, curUrl, wasMarked ? tags.filter(t => t !== REVIEW_TAG) : [...tags, REVIEW_TAG]);
      } else if (state.gallery.date) {
        const tags = getDayImageTagsForUrl(state.gallery.date, curUrl) || [];
        wasMarked = tags.includes(REVIEW_TAG);
        setDayImageTagsForUrl(state.gallery.date, curUrl, wasMarked ? tags.filter(t => t !== REVIEW_TAG) : [...tags, REVIEW_TAG]);
      } else return;
      await saveTrades();
      renderGallery();
      showToast(wasMarked ? 'Review mark removed' : 'Marked for review', 'success');
    });
  })();
}
