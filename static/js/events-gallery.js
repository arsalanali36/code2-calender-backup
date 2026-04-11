/**
 * @fileoverview events-gallery.js
 * @description Gallery toolbar buttons: layer panel toggle, time display toggle, tags tray events.
 * @exports _bindGalleryEvents
 * @reads state.gallery.{showTime,layerPanelOpen}
 * @writes state.gallery.showTime, state.gallery.selectedSeparator
 * @calls toggleLayerPanel, fetchImageTimesForGallery, renderGallery
 */

// events-gallery.js — Gallery tools, nav, upload, tags tray, tag cloud event bindings
if (typeof IS_TOUCH_DEVICE !== 'undefined' && IS_TOUCH_DEVICE) {
  document.body.classList.add('is-touch');
}

function _bindGalleryEvents() {
  setupDropdown('gallery-tools-btn', 'gallery-tools-panel');
  const galleryToolsPanel = document.getElementById('gallery-tools-panel');
  if (galleryToolsPanel) galleryToolsPanel.addEventListener('click', e => e.stopPropagation());

  setupDropdown('gallery-show-heads-btn', 'gallery-show-heads-panel');
  const galleryHeadsPanel = document.getElementById('gallery-show-heads-panel');
  if (galleryHeadsPanel) galleryHeadsPanel.addEventListener('click', e => e.stopPropagation());

  // 21. Tag Filter Panel Toggle (now a tab in unified panel)
  const filterBtn = document.getElementById('gallery-img-tag-filter-btn');
  const ulpPanel = document.getElementById('gv2-unified-left-panel');
  const ulpClose = document.getElementById('gv2-ulp-close-btn');

  const switchULPTab = (tabName) => {
    if (!ulpPanel) return;
    const tabs = ulpPanel.querySelectorAll('.gv2-ulp-tab');
    const panes = ulpPanel.querySelectorAll('.gv2-ulp-pane');
    
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    panes.forEach(p => {
      const isMatch = p.id === `gv2-pane-${tabName}`;
      p.style.display = isMatch ? 'flex' : 'none';
      if (isMatch) p.classList.add('active');
      else p.classList.remove('active');
    });
    
    localStorage.setItem('tj_ulpActiveTab', tabName);

    // If switching to filter tab, render it
    if (tabName === 'filter' && typeof renderGalleryTagFilterPanel === 'function') {
      renderGalleryTagFilterPanel();
    }
    
    // Update sidebar button active states
    const thumbToggleBtn = document.getElementById('gv2-thumb-toggle-btn');
    const tagFilterBtn = document.getElementById('gallery-img-tag-filter-btn');
    if (thumbToggleBtn) thumbToggleBtn.classList.toggle('active', ulpPanel.classList.contains('open') && tabName === 'thumbs');
    if (tagFilterBtn) tagFilterBtn.classList.toggle('active', ulpPanel.classList.contains('open') && tabName === 'filter');
  };
  window.switchULPTab = switchULPTab;


  if (filterBtn && ulpPanel) {
    filterBtn.addEventListener('click', () => {
      const isOpen = ulpPanel.classList.contains('open');
      const currentTab = localStorage.getItem('tj_ulpActiveTab') || 'thumbs';
      if (isOpen && currentTab === 'filter') {
        if (typeof window._closeULP === 'function') window._closeULP();
        else { ulpPanel.classList.remove('open'); filterBtn.classList.remove('active'); localStorage.setItem('tj_ulpPanelOpen', '0'); }
      } else {
        if (typeof window._openULP === 'function') window._openULP('filter');
        else { ulpPanel.classList.add('open'); switchULPTab('filter'); localStorage.setItem('tj_ulpPanelOpen', '1'); }
      }
    });

    if (ulpClose) {
      ulpClose.addEventListener('click', () => {
        if (typeof window._closeULP === 'function') { window._closeULP(); return; }
        ulpPanel.classList.remove('open');
        document.getElementById('gv2-thumb-toggle-btn')?.classList.remove('active');
        document.getElementById('gv2-hamburger-btn')?.classList.remove('active');
        filterBtn?.classList.remove('active');
        localStorage.setItem('tj_ulpPanelOpen', '0');
      });
    }

    // Track mouse hover for context-aware arrow navigation
    ulpPanel.addEventListener('mouseenter', () => { 
        if (state.gallery) state.gallery.isMouseOverThumbs = true; 
    });
    ulpPanel.addEventListener('mouseleave', () => { 
        if (state.gallery) state.gallery.isMouseOverThumbs = false; 
    });
  }

  // Bind individual tab clicks
  document.querySelectorAll('.gv2-ulp-tab').forEach(btn => {
    btn.addEventListener('click', () => switchULPTab(btn.dataset.tab));
  });

  document.getElementById('gv2-ulp-expand-all')?.addEventListener('click', () => {
    if (typeof galleryExpandAll === 'function') galleryExpandAll();
  });
  document.getElementById('gv2-ulp-collapse-all')?.addEventListener('click', () => {
    if (typeof galleryCollapseAll === 'function') galleryCollapseAll();
  });

  // ── Unified Resizing (Touch + Mouse) ──────────────────────────────────
  const setupPanelResizer = (handleId, panelId, localStorageKey, direction, minW = 140, maxW = 480) => {
    const handle = document.getElementById(handleId);
    const panel = document.getElementById(panelId);
    if (!handle || !panel) return;

    const _setWidth = (w) => {
      const finalW = Math.max(minW, Math.min(maxW, w));
    if (panelId === 'gv2-unified-left-panel') {
      panel.style.setProperty('--ulp-panel-w', finalW + 'px');
    } else if (panelId === 'gv2-thumb-panel') {
      panel.style.setProperty('--thumb-panel-w', finalW + 'px');
    } else {
      panel.style.width = finalW + 'px';
    }
      if (panelId === 'gv2-layer-panel') {
        panel.style.setProperty('--lp-thumb-w', Math.max(24, Math.min(80, Math.floor(finalW * 0.22))) + 'px');
      }
      if (localStorageKey) localStorage.setItem(localStorageKey, finalW);
    };

    let _resizing = false, _startX = 0, _startW = 0;
    const _onMove = (e) => {
      if (!_resizing) return;
      if (e.cancelable) e.preventDefault(); // prevent page scroll during resize
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const dx = cx - _startX;
      _setWidth(direction === 'right' ? _startW + dx : _startW - dx);
    };
    const _onUp = () => {
      if (!_resizing) return;
      _resizing = false; handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Remove touch listener only when dragging ends — keeps scroll smooth
      document.removeEventListener('touchmove', _onMove);
    };
    const _onDown = (e) => {
      _resizing = true; handle.classList.add('dragging');
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      _startX = cx;
      _startW = panel.offsetWidth;
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      // Add touch listener only when drag starts — avoids blocking scroll at all other times
      document.addEventListener('touchmove', _onMove, { passive: false });
      e.stopPropagation();
    };

    handle.addEventListener('mousedown', _onDown);
    handle.addEventListener('touchstart', _onDown, { passive: false });
    document.addEventListener('mousemove', _onMove);
    document.addEventListener('mouseup', _onUp);
    document.addEventListener('touchend', _onUp);

    // Support smooth horizontal touch resizing for iPad (matches split-view logic)
    const _isTouch = (typeof IS_TOUCH_DEVICE !== 'undefined' && IS_TOUCH_DEVICE) || (navigator.maxTouchPoints > 0) || (window.innerWidth < 1100 && navigator.maxTouchPoints > 0);
    if (_isTouch) {
      document.documentElement.classList.add('is-touch');
      document.body.classList.add('is-touch');
      
      if (!panel.dataset.hasResizer) {
        let vResizer = document.createElement('div');
        vResizer.className = 'gv2-touch-resizer';
        vResizer.style.cssText = `
            position: absolute; top: 0; bottom: 0; width: 30px; z-index: 500;
            background: transparent; display: flex; align-items: center; justify-content: center;
            cursor: col-resize; touch-action: none;
        `;
        
        // Position on the dragging edge
        if (direction === 'right') {
          vResizer.style.right = '-15px';
        } else {
          vResizer.style.left = '-15px';
        }

        vResizer.innerHTML = `
            <div class="gv2-touch-resizer-handle" style="width: 4px; height: 40px; border-radius: 2px; background: var(--blue); opacity: 0.6; transition: opacity 0.2s;"></div>
            <div class="gv2-touch-resizer-label" style="position: absolute; top: -30px; left: 50%; transform: translateX(-50%); background: var(--blue); color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 10px; opacity: 0; pointer-events: none; white-space: nowrap;">Width: 0px</div>
        `;
        panel.appendChild(vResizer);
        panel.dataset.hasResizer = 'true';
        
        const label = vResizer.querySelector('.gv2-touch-resizer-label');
        const visualHandle = vResizer.querySelector('.gv2-touch-resizer-handle');
        let _tResizing = false, _startX_T = 0, _startW_T = 0;

        vResizer.addEventListener('touchstart', (e) => {
          if (e.touches.length !== 1) return;
          _tResizing = true;
          _startX_T = e.touches[0].clientX;
          _startW_T = panel.offsetWidth;
          
          vResizer.classList.add('active');
          if (visualHandle) visualHandle.style.opacity = '1';
          if (label) label.style.opacity = '1';
          
          e.stopPropagation();
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
          if (!_tResizing || e.touches.length !== 1) return;
          const dx = e.touches[0].clientX - _startX_T;
          
          // If panel is on the left (direction='right'), positive dx increases width
          // If panel is on the right (direction='left'), negative dx increases width
          const newW = (direction === 'right') ? (_startW_T + dx) : (_startW_T - dx);
          
          _setWidth(newW);
          if (label) {
              label.textContent = `Width: ${Math.round(panel.offsetWidth)}px`;
              label.style.opacity = '1';
          }
          if (e.cancelable) e.preventDefault();
        }, { passive: false });

        window.addEventListener('touchend', () => {
          if (_tResizing) {
            _tResizing = false;
            vResizer.classList.remove('active');
            if (visualHandle) visualHandle.style.opacity = '0.6';
            if (label) label.style.opacity = '0';
          }
        });
        vResizer.style.display = 'flex';
      }
    }

    // Restore saved width on init
    if (localStorageKey) {
      const saved = parseInt(localStorage.getItem(localStorageKey), 10);
      if (saved) _setWidth(saved);
    }
  };

  setupPanelResizer('gv2-ulp-resize-handle', 'gv2-unified-left-panel', 'tj_ulpPanelW', 'right', 180, 800);
  setupPanelResizer('gv2-lp-resize-handle', 'gv2-layer-panel', 'tj_layerPanelW', 'right', 140, 480);
  setupPanelResizer('gv2-tray-resize-handle', 'gv2-tags-tray', 'tj_trayPanelW', 'left', 160, 520);
  setupPanelResizer('gv2-trades-resize-handle', 'gv2-trades-panel', 'tj_tradesPanelW', 'right', 180, 520);

  // Unified Left Panel open state restore + hamburger ribbon button
  (function () {
    const thumbToggleBtn = document.getElementById('gv2-thumb-toggle-btn');
    const hamburgerBtn   = document.getElementById('gv2-hamburger-btn');
    const ulpPanel = document.getElementById('gv2-unified-left-panel');
    if (!ulpPanel) return;

    const _openULP = (tab) => {
      ulpPanel.classList.add('open');
      switchULPTab(tab || localStorage.getItem('tj_ulpActiveTab') || 'thumbs');
      localStorage.setItem('tj_ulpPanelOpen', '1');
      hamburgerBtn && hamburgerBtn.classList.add('active');
      thumbToggleBtn && thumbToggleBtn.classList.add('active');
    };
    const _closeULP = () => {
      ulpPanel.classList.remove('open');
      localStorage.setItem('tj_ulpPanelOpen', '0');
      hamburgerBtn && hamburgerBtn.classList.remove('active');
      thumbToggleBtn && thumbToggleBtn.classList.remove('active');
    };
    window._openULP  = _openULP;
    window._closeULP = _closeULP;

    const wasOpen = localStorage.getItem('tj_ulpPanelOpen') === '1';
    const lastTab = localStorage.getItem('tj_ulpActiveTab') || 'thumbs';

    if (wasOpen) {
      ulpPanel.classList.add('open');
      switchULPTab(lastTab);
      hamburgerBtn && hamburgerBtn.classList.add('active');
    }

    // Hamburger (ribbon) — simple toggle
    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', () => {
        ulpPanel.classList.contains('open') ? _closeULP() : _openULP();
      });
    }

    if (thumbToggleBtn) {
      thumbToggleBtn.addEventListener('click', () => {
        const isOpen = ulpPanel.classList.contains('open');
        const currentTab = localStorage.getItem('tj_ulpActiveTab') || 'thumbs';
        if (isOpen && currentTab === 'thumbs') {
          _closeULP();
        } else {
          _openULP('thumbs');
        }
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
      if (typeof fetchImageTimesForGallery === 'function') fetchImageTimesForGallery();
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
  let _ctrlDragScrollRaf = null;
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
    if (wrap && wrap.dataset.globalIdx !== undefined) {
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
    }
    // Auto-scroll thumb panel when dragging near top/bottom edges
    const thumbs = document.getElementById('gallery-thumbs');
    if (!thumbs) return;
    const rect = thumbs.getBoundingClientRect();
    const ZONE = 50, SPEED = 8;
    if (_ctrlDragScrollRaf) cancelAnimationFrame(_ctrlDragScrollRaf);
    if (e.clientY < rect.top + ZONE) {
      const scroll = () => { thumbs.scrollTop -= SPEED; if (_ctrlDragActive) _ctrlDragScrollRaf = requestAnimationFrame(scroll); };
      _ctrlDragScrollRaf = requestAnimationFrame(scroll);
    } else if (e.clientY > rect.bottom - ZONE) {
      const scroll = () => { thumbs.scrollTop += SPEED; if (_ctrlDragActive) _ctrlDragScrollRaf = requestAnimationFrame(scroll); };
      _ctrlDragScrollRaf = requestAnimationFrame(scroll);
    }
  });
  document.addEventListener('mouseup', () => {
    _ctrlDragPending = false; _ctrlDragActive = false;
    if (_ctrlDragScrollRaf) { cancelAnimationFrame(_ctrlDragScrollRaf); _ctrlDragScrollRaf = null; }
  });

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
    const modal = document.getElementById('gallery-modal');
    if (modal) {
      if (!document.fullscreenElement) {
        modal.requestFullscreen?.().catch(err => {
          console.warn(`Error attempting to enable fullscreen: ${err.message}`);
        });
      } else {
        document.exitFullscreen?.();
      }
    }
    const images = state.gallery.images || [];
    const cur = images[state.gallery.currentIndex];
    if (cur && typeof openFullscreenFromAppContext === 'function') openFullscreenFromAppContext(images, cur);
  });

  // Popout Button: opens current image in a new window using existing Share Link logic
  document.getElementById('gv2-popout-btn')?.addEventListener('click', () => {
    const images = state.gallery.images || [];
    const cur = images[state.gallery.currentIndex];
    const date = state.gallery.date;
    if (!date || !cur) return;

    const params = new URLSearchParams({ galleryDate: date, galleryImg: cur });
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    window.open(url, 'gallery_popout', 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no');
  });

  document.getElementById('gallery-prev').addEventListener('click', () => navigateGallery(-1));
  document.getElementById('gallery-next').addEventListener('click', () => navigateGallery(1));
  document.getElementById('gallery-date-prev')?.addEventListener('click', () => navigateGalleryDate(-1));
  document.getElementById('gallery-date-next')?.addEventListener('click', () => navigateGalleryDate(1));
  document.getElementById('gallery-date-picker').addEventListener('change', e => {
    const dateStr = e.target.value;
    const images = getImagesForDate(dateStr);
    if (images.length) {
      state.gallery.images = images; 
      state.gallery.date = dateStr; 
      state.gallery.sourceRow = null;
      state.gallery._baseImages = [...images];
      state.gallery._baseDate = dateStr;
      state.gallery._baseSourceRow = null;
      
      // Jump to Close Global if available (same as arrow navigation)
      state.gallery.currentIndex = typeof getInitialIndexForDate === 'function' ? getInitialIndexForDate(dateStr, images) : 0;
      
      if (state.gallery.tagFilter?.length) applyGalleryImageScopeByTagFilter(images[state.gallery.currentIndex] || '');
      renderGallery(); updateGalleryDateArrows();
    } else { showToast('No images for this date', ''); }
  });
  document.getElementById('gallery-upload-btn').addEventListener('click', () => {
    if (!state.gallery.date) return;
    const sel = state.gallery.selectedSeparator;
    const dayDate = state.gallery.date;

    // If a separator is selected (OPEN/CLOSE/trade index), route via _galleryUploadCallback
    if (sel !== undefined && sel !== null) {
      state._galleryUploadCallback = () => {
        state.gallery.images = getImagesForDate(dayDate);
        renderGallery(); updateGalleryDateArrows();
      };
      // openUploadModal with a dummy rowIdx; done-handler will use selectedSeparator routing
      const firstRowIdx = state.trades.findIndex(t => normalizeDate(extractDateFromTrade(t)) === dayDate);
      openUploadModal(firstRowIdx >= 0 ? firstRowIdx : 0);
      return;
    }

    // Otherwise use current image's owner trade
    const curUrl = (state.gallery.images || [])[state.gallery.currentIndex];
    const ownerTrade = curUrl ? getOwnerTradeForImageUrl(curUrl) : null;
    let rowIdx = ownerTrade ? state.trades.indexOf(ownerTrade) : -1;
    if (rowIdx === -1) rowIdx = state.trades.findIndex(t => normalizeDate(extractDateFromTrade(t)) === dayDate);
    if (rowIdx === -1) {
      const trade = getOrCreateTrade(dayDate);
      rowIdx = state.trades.indexOf(trade);
      saveTrades();
    }
    state._galleryUploadCallback = () => {
      state.gallery.images = getImagesForDate(dayDate);
      renderGallery(); updateGalleryDateArrows();
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

  ['gallery-close', 'gv2-exit-btn'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      if (annotState.active) stopAnnotation();
      closeGalleryImageTagManager();
      document.getElementById('gallery-modal').classList.remove('open');
      unlockBodyScroll();
    });
  });

  document.getElementById('gv2-tags-btn').addEventListener('click', () => {
    document.getElementById('gallery-tools-panel')?.classList.remove('open');
    const tray = document.getElementById('gv2-tags-tray');
    const btn = document.getElementById('gv2-tags-btn');
    const open = tray.style.display === 'none' || !tray.style.display;
    tray.style.display = open ? 'flex' : 'none';
    btn.classList.toggle('active', open);
    localStorage.setItem('tj_tagsTrayOpen', open ? '1' : '0');
    if (open) {
      if (typeof renderGalleryTagsTray === 'function') renderGalleryTagsTray();
      if (typeof renderGalleryVideoUrls === 'function') renderGalleryVideoUrls();
    }
  });

  // Vid button — toggle Video URLs tray
  const vidUrlBtn = document.getElementById('gv2-video-url-btn');
  if (vidUrlBtn) {
    vidUrlBtn.addEventListener('click', () => {
      const tray = document.getElementById('gv2-video-url-tray');
      if (!tray) return;
      const isOpen = tray.style.display !== 'none';
      tray.style.display = isOpen ? 'none' : 'block';
      vidUrlBtn.classList.toggle('active', !isOpen);
      if (!isOpen && typeof renderGalleryVideoUrls === 'function') renderGalleryVideoUrls();
    });
  }

  // gv2-text-btn click is handled by bindAnnotationCanvas() in annotate-fabric.js

  document.getElementById('gv2-tc-mode-btn')?.addEventListener('click', () => {
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

  document.getElementById('gv2-tc-clear-btn')?.addEventListener('click', () => {
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

  document.getElementById('gv2-tag-view-btn')?.addEventListener('click', e => {
    const btn = e.currentTarget;
    state.gallery.tagViewMode = state.gallery.tagViewMode === 'grouped' ? 'flat' : 'grouped';
    if (btn) btn.textContent = state.gallery.tagViewMode === 'grouped' ? 'Grp' : 'All';
    renderGalleryTagsTray();
  });
  document.getElementById('gv2-add-tag-btn')?.addEventListener('click', () => {
    if (typeof window.openCreateTagModal === 'function') {
      window.openCreateTagModal();
    }
  });
  document.getElementById('gv2-add-grp-btn')?.addEventListener('click', () => {
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

  // P&L pill dropdown — move to body so no parent clips it
  const pnlPill = document.getElementById('gv2-pnl-pill');
  const pnlDrop = document.getElementById('gv2-pnl-dropdown');
  if (pnlDrop && pnlDrop.parentElement !== document.body) {
    document.body.appendChild(pnlDrop);
  }

  function _togglePnlDrop(anchorEl) {
    const drop = document.getElementById('gv2-pnl-dropdown');
    if (!drop) return;
    const isOpen = drop.classList.contains('open');
    if (isOpen) { drop.classList.remove('open'); return; }
    // Position below the anchor pill
    const r = anchorEl.getBoundingClientRect();
    drop.style.position = 'fixed';
    drop.style.left = 'auto';
    drop.style.transform = 'none';
    drop.style.zIndex = '99999';
    // Align right edge of dropdown to right edge of anchor, clamped to viewport
    let left = r.right - parseFloat(drop.style.width || 520);
    if (left < 8) left = 8;
    if (left + 520 > window.innerWidth - 8) left = window.innerWidth - 528;
    drop.style.left = left + 'px';
    drop.style.top = (r.bottom + 8) + 'px';
    drop.classList.add('open');
  }

  if (pnlPill) {
    pnlPill.addEventListener('click', (e) => {
      e.stopPropagation();
      _togglePnlDrop(pnlPill);
    });
  }

  // ── Trade pill → opens the shared P&L dropdown ──
  const tradePill = document.getElementById('gv2-trade-pill');
  if (tradePill) {
    tradePill.addEventListener('click', (e) => {
      e.stopPropagation();
      _togglePnlDrop(tradePill);
    });
  }



  // ── MTM (Equity Curve) toggle ──────────────────────────────────────────
  const mtmBtn = document.getElementById('gv2-mtm-btn');
  const mtmPanel = document.getElementById('gv2-mtm-panel');
  // Move panel to body to avoid stacking context clipping from gallery modal
  if (mtmPanel && mtmPanel.parentElement !== document.body) {
    document.body.appendChild(mtmPanel);
  }
  if (mtmBtn && mtmPanel) {
    // Shared function so grid-view button can also open the panel correctly
    window._openGalleryMtmPanel = function(triggerEl) {
      document.querySelectorAll('.dropdown-menu.open').forEach(d => d.classList.remove('open'));
      const panelW = 600, panelH = 420;
      const r = triggerEl ? triggerEl.getBoundingClientRect() : { bottom: 0, right: 0, width: 0, height: 0 };
      let top, right;
      if (r.width === 0 && r.height === 0) {
        // button is hidden — center the panel
        top = Math.max((window.innerHeight - panelH) / 2, 10);
        right = Math.max((window.innerWidth - panelW) / 2, 10);
      } else {
        top = Math.min(r.bottom + 6, window.innerHeight - panelH - 10);
        right = Math.max(window.innerWidth - r.right, 10);
      }
      mtmPanel.style.top = top + 'px';
      mtmPanel.style.right = right + 'px';
      mtmPanel.style.zIndex = '99999';
      mtmPanel.style.display = 'block';
      if (typeof renderGalleryMtmPanel === 'function') renderGalleryMtmPanel(mtmPanel);
    };

    mtmBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = mtmPanel.style.display !== 'none';
      if (isOpen) {
        mtmPanel.style.display = 'none';
      } else {
        window._openGalleryMtmPanel(mtmBtn);
      }
    });
  }

  // Close MTM panel when clicking outside
  document.addEventListener('mousedown', (e) => {
    const _mp = document.getElementById('gv2-mtm-panel');
    const _mb = document.getElementById('gv2-mtm-btn');
    if (_mp && _mp.style.display !== 'none') {
      if (!_mb?.contains(e.target) && !_mp.contains(e.target)) {
        _mp.style.display = 'none';
      }
    }
  }, true);

  // Close P&L dropdown on outside click
  document.addEventListener('mousedown', (e) => {
    const _pnlDrop = document.getElementById('gv2-pnl-dropdown');
    if (_pnlDrop && _pnlDrop.classList.contains('open')) {
      const _pnlPill  = document.getElementById('gv2-pnl-pill');
      const _tradePill = document.getElementById('gv2-trade-pill');
      if (!_pnlPill?.contains(e.target) && !_tradePill?.contains(e.target) && !_pnlDrop.contains(e.target)) {
        _pnlDrop.classList.remove('open');
      }
    }
    // MTM Panel: Persistent by default
    // if (mtmBtn && !mtmBtn.closest('#gv2-mtm-btn-wrap')?.contains(e.target)) mtmPanel?.classList.remove('open');
  });

  _bindGalleryDropdownEvents();
  // ── Trades Panel Toggle & Render → events-gallery-b.js ───────────────────
  _bindGalleryTradesPanelEvents();

  // ── Draggable gallery tray pill ───────────────────────────────────────────
  _bindGalleryTrayDrag();
  
  // Initialize Other Options dropdown (from gallery-ref-cards.js)
  if (typeof initOtherDropdown === 'function') initOtherDropdown();
}

function _bindGalleryTrayDrag() {
  const handle = document.getElementById('gv2-tray-drag-handle');
  const pill   = document.getElementById('gv2-tray-center');
  if (!handle || !pill) return;

  const LS_KEY = 'tj_trayPillPos';
  let dragging = false, startX, startY, curTx = 0, curTy = 0;

  // Use translate3d for GPU-accelerated movement (no reflow)
  const _applyTranslate = (tx, ty) => {
    pill.style.transform = `translate3d(${tx}px,${ty}px,0)`;
  };

  // Restore saved offset
  const saved = (() => { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; } })();
  if (saved) { curTx = saved.tx || 0; curTy = saved.ty || 0; _applyTranslate(curTx, curTy); }

  const startDrag = (cx, cy, target) => {
    if (target.closest('button, input, select, .dropdown-menu, .gv2-pnl-pill, .gv2-trade-pill')) return false;
    dragging = true;
    startX = cx; startY = cy;
    pill.style.willChange = 'transform';
    document.body.style.userSelect = 'none';
    return true;
  };

  const doDrag = (cx, cy) => {
    if (!dragging) return;
    curTx += cx - startX;
    curTy += cy - startY;
    startX = cx;
    startY = cy;
    _applyTranslate(curTx, curTy);
  };

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    pill.style.willChange = '';
    document.body.style.userSelect = '';
    localStorage.setItem(LS_KEY, JSON.stringify({ tx: curTx, ty: curTy }));
  };

  // ── Mouse drag (desktop) ──────────────────────────────────────────────────
  pill.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (startDrag(e.clientX, e.clientY, e.target)) {
      e.preventDefault();
      e.stopPropagation();
    }
  });
  document.addEventListener('mousemove', e => doDrag(e.clientX, e.clientY));
  document.addEventListener('mouseup', endDrag);

  // ── Touch drag (iPad/mobile) — capture phase so iOS button-touch works ─────
  let _touchPending = false, _touchStartX = 0, _touchStartY = 0, _touchId = null;
  const DRAG_THRESHOLD = 8;

  // Use capture:true so we get the event even when a child button handles it
  document.addEventListener('touchstart', e => {
    if (!pill.contains(e.target)) return;
    const t = e.touches[0];
    _touchId      = t.identifier;
    _touchPending = true;
    _touchStartX  = t.clientX;
    _touchStartY  = t.clientY;
    _initDragPos(t.clientX, t.clientY);
  }, { passive: true, capture: true });

  document.addEventListener('touchmove', e => {
    if (!_touchPending && !dragging) return;
    // Find our tracked touch
    let t = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === _touchId) { t = e.touches[i]; break; }
    }
    if (!t) return;

    if (_touchPending) {
      const dx = Math.abs(t.clientX - _touchStartX);
      const dy = Math.abs(t.clientY - _touchStartY);
      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
        _touchPending = false;
        dragging = true;
        document.body.style.userSelect = 'none';
        startX = t.clientX;
        startY = t.clientY;
      } else {
        return;
      }
    }
    if (e.cancelable) e.preventDefault(); // prevent scroll competing with drag
    doDrag(t.clientX, t.clientY);
  }, { passive: false });

  document.addEventListener('touchend', e => {
    _touchPending = false;
    _touchId = null;
    endDrag();
  });

  // Double-click handle to reset position
  handle.addEventListener('dblclick', () => {
    curTx = 0; curTy = 0;
    pill.style.transform = '';
    pill.style.willChange = '';
    localStorage.removeItem(LS_KEY);
  });
}
