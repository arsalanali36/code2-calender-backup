// gallery-grid.js — Full Page / Grid View for organized images grouped by trade

(function() {
  const gv = {
    btn: null,
    overlay: null,
    closer: null,
    slider: null,
    body: null,
    isOpen: false,
    currentSize: 220
  };

  function _syncGridRefs() {
    gv.btn     = document.getElementById('gv2-grid-btn');
    gv.overlay = document.getElementById('gv2-grid-view');
    gv.closer  = document.getElementById('gv2-grid-close-btn-tray');
    gv.slider     = document.getElementById('gv2-grid-size-slider-tray');
    gv.sliderMain = document.getElementById('gv2-grid-size-slider-main');
    gv.body       = document.getElementById('gv2-grid-body');
    gv.modal      = document.getElementById('gallery-modal');
  }

  function initGrid() {
    _syncGridRefs();
    if (!gv.btn || !gv.overlay) return;

    // Load wrap setting
    if (state.gallery.gridWrap === undefined) {
      state.gallery.gridWrap = localStorage.getItem('tj_gridWrap') !== '0';
    }
    const wrapChk = document.getElementById('gv2-grid-wrap-chk');
    if (wrapChk) wrapChk.checked = state.gallery.gridWrap;

    // Use our global dropdown helper for the new menu
    if (typeof setupDropdown === 'function') {
      setupDropdown('gv2-grid-options-btn', 'gv2-grid-options-menu');
      const menu = document.getElementById('gv2-grid-options-menu');
      if (menu) menu.addEventListener('click', e => e.stopPropagation());
    }

    gv.btn.onclick = () => {
      toggleGridView(!gv.isOpen);
    };

    if (gv.closer) {
      gv.closer.onclick = () => {
        toggleGridView(false);
      };
    }

    const _onSliderInput = (e) => {
      gv.currentSize = e.target.value;
      if (gv.slider) gv.slider.value = gv.currentSize;
      if (gv.sliderMain) gv.sliderMain.value = gv.currentSize;
      
      const main = document.querySelector('.gv2-grid-main');
      if (main) main.style.setProperty('--grid-img-size', gv.currentSize + 'px');
    };

    if (gv.slider) gv.slider.addEventListener('input', _onSliderInput);
    if (gv.sliderMain) gv.sliderMain.addEventListener('input', _onSliderInput);

    // Initial sync
    const main = document.querySelector('.gv2-grid-main');
    if (main) main.style.setProperty('--grid-img-size', gv.currentSize + 'px');
    if (gv.slider) gv.slider.value = gv.currentSize;
    if (gv.sliderMain) gv.sliderMain.value = gv.currentSize;
  }

  function toggleGridView(show) {
    _syncGridRefs(); // Always get fresh refs before rendering
    gv.isOpen = show;
    if (gv.overlay) {
      gv.overlay.style.display = show ? 'flex' : 'none';
      gv.btn.classList.toggle('active', show);
      if (gv.modal) gv.modal.classList.toggle('grid-open', show);
      
      // Move recording bars into sidebar for Grid View, or back to tray for Normal View
      const recBars = document.getElementById('gv2-tray-record-bars');
      if (recBars) {
        if (show) {
          const sidebarRecord = document.getElementById('gv2-sidebar-record');
          if (sidebarRecord) sidebarRecord.after(recBars);
        } else {
          const trayRecWrap = document.getElementById('gv2-tray-record-wrap');
          if (trayRecWrap) trayRecWrap.appendChild(recBars);
        }
      }

      // Toggle tray options visibility
      document.querySelectorAll('.gv2-grid-only').forEach(el => {
        el.style.display = show ? 'flex' : 'none';
      });

      if (show) {
        renderGridContent();
      }
    }
  }

  function gridMenuNavigateDate(dir) {
    if (typeof navigateGalleryDate === 'function') {
      navigateGalleryDate(dir);
      renderGridContent();
    }
  }
  window.gridMenuNavigateDate = gridMenuNavigateDate;

  function toggleGridWrap(e) {
    if (e) e.stopPropagation();
    state.gallery.gridWrap = !state.gallery.gridWrap;
    localStorage.setItem('tj_gridWrap', state.gallery.gridWrap ? '1' : '0');
    const chk = document.getElementById('gv2-grid-wrap-chk');
    if (chk) chk.checked = state.gallery.gridWrap;
    renderGridContent();
  }
  window.toggleGridWrap = toggleGridWrap;

  function _filterByImgType(imgs) {
    const f = state.gallery.imgTypeFilter || 'both';
    if (f === 'both') return imgs;
    return imgs.filter(u => (state.imgTypes || {})[u] === f);
  }

  function renderGridContent() {
    if (!gv.body) return;

    try {
      // Sync Sidebar & Main Content Labels
      const sidebarDate = document.getElementById('gv2-sidebar-date-pill');
      const mainCounter = document.getElementById('gv2-grid-main-counter');
      const sidebarRec = document.getElementById('gv2-sidebar-record');
      
      if (sidebarDate) sidebarDate.textContent = state.gallery.date || 'No Date';
      if (mainCounter) {
        const total = (state.gallery.images || []).length;
        const cur = (state.gallery.currentIndex || 0) + 1;
        mainCounter.textContent = total > 0 ? `${cur} / ${total} images` : 'No images';
      }
      if (sidebarRec) {
        const mainRec = document.getElementById('gv2-record-toggle-btn');
        if (mainRec) {
          const isActive = mainRec.classList.contains('active');
          sidebarRec.classList.toggle('active', isActive);
          const iconEl = sidebarRec.querySelector('.gv2-si-icon');
          if (iconEl) iconEl.textContent = isActive ? '⏹' : '⏺';
          const labelEl = sidebarRec.querySelector('.gv2-si-label');
          if (labelEl) labelEl.textContent = isActive ? 'Stop Rec' : 'Record';
        }
      }

      // Sync Sidebar Filters active state
      const curFilter = state.gallery.imgTypeFilter || 'both';
      ['both', 'index', 'premium'].forEach(t => {
        const el = document.getElementById('gv2-sidebar-filter-' + t);
        if (el) el.classList.toggle('active', curFilter === t);
      });
    } catch (err) {
      console.error('Grid Sidebar sync failed:', err);
    }

    gv.body.innerHTML = '';
    const date = state.gallery.date;
    const images = state.gallery.images || [];

    if (!date) {
      if (images.length > 0) {
        renderGroup('Gallery Images', _filterByImgType(images), null);
      }
      return;
    }

    const dayData = state.dayData[date];
    const trades = getTradesForDate(date);

    // 1. NEWS Group (Contextual market news / reports)
    if (dayData && dayData.newsImages && dayData.newsImages.length > 0) {
      const filtered = _filterByImgType(dayData.newsImages);
      if (filtered.length) renderGroup('NEWS (Context)', filtered, null);
    }

    // 2. OPEN Group (Initial trade analysis)
    if (dayData && dayData.images && dayData.images.length > 0) {
      const filtered = _filterByImgType(dayData.images);
      if (filtered.length) renderGroup('OPEN (Analysis)', filtered, null);
    }

    // 2. Trade Groups
    let cumPnl = 0;
    trades.forEach((tr, i) => {
      const pnl = (typeof getTradePnl === 'function' ? getTradePnl(tr) : 0) || 0;
      cumPnl += pnl;
      const filtered = _filterByImgType(tr.images || []);
      renderGroup(null, filtered, null, pnl, tr, i, cumPnl);
    });

    // 3. CLOSE Group
    if (dayData && dayData.closeImages && dayData.closeImages.length > 0) {
      const filtered = _filterByImgType(dayData.closeImages);
      if (filtered.length) renderGroup('CLOSE (Post-Market)', filtered, null);
    }
  }

  function renderGroup(title, images, statsHtml, pnl, tradeRef, tradeIdx, cumPnl) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'gv2-grid-group';
    if (title === 'OPEN (Analysis)') groupDiv.id = 'grid-group-open';
    else if (title === 'NEWS (Context)') {
      groupDiv.id = 'grid-group-news';
      groupDiv.classList.add('gv2-grid-group--portrait');
    }
    else if (title === 'CLOSE (Post-Market)') groupDiv.id = 'grid-group-close';
    else if (tradeIdx !== undefined) groupDiv.id = 'grid-group-trade-' + tradeIdx;

    const hdr = document.createElement('div');
    hdr.className = 'gv2-grid-group-hdr';

    if (tradeRef && tradeIdx !== undefined) {
      // ── Structured trade header row ──────────────────────────────────
      const rawInst = (tradeRef.Instrument || tradeRef.instrument || '').toUpperCase();
      const m = rawInst.match(/^([A-Z]+)(\d{2})([1-9OND])(\d{2})(\d+)(CE|PE)$/);
      const instText = m ? `${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]} ${m[6]}` : rawInst;
      const instColor = rawInst.endsWith('CE') ? '#c084fc' : rawInst.endsWith('PE') ? 'var(--text3,#8b949e)' : '#ffd700';

      const buyTime  = (tradeRef['Buy Time']  || tradeRef.buy_time  || '').slice(0, 5);
      const sellTime = (tradeRef['Sell Time'] || tradeRef.sell_time || '').slice(0, 5);
      const type = String(tradeRef['TradeType'] || tradeRef.tradetype || '').toLowerCase();
      const entryTime = (type.includes('sell') || type.includes('short')) ? sellTime : buyTime;

      let dur = '';
      if (buyTime && sellTime) {
        try {
          const [h1,m1] = buyTime.split(':').map(Number);
          const [h2,m2] = sellTime.split(':').map(Number);
          const mins = Math.round(Math.abs(new Date(2000,0,1,h2,m2) - new Date(2000,0,1,h1,m1)) / 60000);
          dur = mins < 60 ? mins + 'm' : Math.floor(mins/60) + 'h' + (mins%60 > 0 ? ' '+mins%60+'m' : '');
        } catch(e) {}
      }

      const qty = parseFloat(tradeRef['Qty'] || tradeRef.qty || 0) || 0;
      const pt  = parseFloat(tradeRef['Pt']  || tradeRef.pt  || 0) || 0;
      const fmtPnl = v => (v >= 0 ? '+₹' : '-₹') + Math.abs(Math.round(v)).toLocaleString('en-IN');

      hdr.className += ' gv2-grid-group-hdr--trade';
      hdr.innerHTML = `
        <span class="ggr-idx">T${tradeIdx + 1}</span>
        <span class="ggr-inst" style="color:${instColor}">${instText || '—'}</span>
        <span class="ggr-time">${entryTime}${dur ? ` <b>[${dur}]</b>` : ''}${qty ? ` <span class="ggr-qty">${qty}</span>` : ''}</span>
        <span class="ggr-pt" style="color:${pt >= 0 ? 'var(--green,#2ecc71)' : 'var(--red,#e74c3c)'}">${Math.abs(Math.round(pt))} Pt</span>
        <span class="ggr-pnl" style="color:${pnl > 0 ? 'var(--green,#2ecc71)' : pnl < 0 ? 'var(--red,#e74c3c)' : 'var(--text2)'}">${fmtPnl(pnl)}</span>
        <span class="ggr-cum" style="color:${cumPnl >= 0 ? 'var(--green,#2ecc71)' : 'var(--red,#e74c3c)'}">${fmtPnl(cumPnl)}</span>
      `;
    } else {
      // ── Simple header (OPEN / CLOSE / fallback) ───────────────────────
      const titleEl = document.createElement('span');
      titleEl.className = 'gv2-grid-group-title';
      titleEl.textContent = title || '';
      hdr.appendChild(titleEl);
      if (statsHtml) {
        const statsEl = document.createElement('span');
        statsEl.className = 'gv2-grid-group-pnl';
        statsEl.textContent = statsHtml;
        statsEl.style.color = pnl > 0 ? 'var(--green)' : (pnl < 0 ? 'var(--red)' : 'var(--orange)');
        hdr.appendChild(statsEl);
      }
    }

    groupDiv.appendChild(hdr);

    const container = document.createElement('div');
    container.className = 'gv2-grid-container';

    // APPLY WRAP SETTING
    if (state.gallery.gridWrap === false) {
      container.classList.add('gv2-grid-container--nowrap');
      
      // Mouse drag scrolling helper for PC
      let _isDown = false, _startX, _scrollLeft, _hasMoved = false;
      const _onDown = (e) => {
        _isDown = true;
        _hasMoved = false;
        container.classList.add('dragging');
        _startX = (e.pageX || e.touches?.[0]?.pageX) - container.offsetLeft;
        _scrollLeft = container.scrollLeft;
      };
      const _onMove = (e) => {
        if (!_isDown) return;
        const x = (e.pageX || e.touches?.[0]?.pageX) - container.offsetLeft;
        const walk = (x - _startX);
        if (Math.abs(walk) > 5) _hasMoved = true;
        if (_hasMoved) {
          e.preventDefault();
          container.scrollLeft = _scrollLeft - walk * 1.5;
        }
      };
      const _onUp = () => {
        _isDown = false;
        container.classList.remove('dragging');
      };

      container.addEventListener('mousedown', _onDown);
      window.addEventListener('mousemove', _onMove);
      window.addEventListener('mouseup', _onUp);
      
      // Touch support
      container.addEventListener('touchstart', _onDown, {passive: true});
      container.addEventListener('touchmove', _onMove, {passive: false});
      container.addEventListener('touchend', _onUp);

      // Prevent click if dragged
      container.addEventListener('click', (e) => {
        if (_hasMoved) {
          e.preventDefault();
          e.stopPropagation();
        }
      }, true);
    }

    if (images.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'gv2-grid-empty';
      empty.innerHTML = `<span class="gv2-grid-empty-icon">＋</span> No images &nbsp;<span class="gv2-grid-empty-hint">click to add</span>`;
      if (tradeRef) {
        empty.style.cursor = 'pointer';
        empty.onclick = () => {
          const inp = document.createElement('input');
          inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
          inp.onchange = async () => {
            if (!inp.files.length) return;
            try {
              for (const file of Array.from(inp.files)) {
                const rv = await imageService.uploadImage(file);
                if (!rv.url) throw new Error('upload failed');
                if (!tradeRef.images) tradeRef.images = [];
                tradeRef.images.push(rv.url);
              }
              await saveTrades();
              renderGridContent();
              if (typeof showToast === 'function') showToast(`${inp.files.length} image(s) added`, 'success');
            } catch(e) {
              if (typeof showToast === 'function') showToast('Upload failed', 'error');
            }
          };
          inp.click();
        };
      }
      container.appendChild(empty);
      groupDiv.appendChild(container);
      gv.body.appendChild(groupDiv);
      return;
    }

    images.forEach(url => {
      const item = document.createElement('div');
      item.className = 'gv2-grid-item';

      const img = document.createElement('img');
      img.className = 'gv2-grid-img';
      img.src = resolveImageUrl(url);
      img.loading = 'lazy';

      item.appendChild(img);

      // Meta: Time label if exists
      if (state.gallery.imageTimes && state.gallery.imageTimes[url]) {
          const meta = document.createElement('div');
          meta.className = 'gv2-grid-item-meta';
          const time = document.createElement('span');
          time.className = 'gv2-grid-time';
          time.textContent = state.gallery.imageTimes[url];
          meta.appendChild(time);
          item.appendChild(meta);
      }

      const idx = state.gallery.images.indexOf(url);
      if (idx >= 0) {
        item.dataset.globalIdx = idx;
        // Show selected state immediately on render
        if (state.gallery.selectedIndices?.has(idx)) {
          item.classList.add('gv2-grid-item--selected');
        }
      }

      item.onclick = (e) => {
        const itemIdx = parseInt(item.dataset.globalIdx);
        if (isNaN(itemIdx) || itemIdx < 0) return;

        if (!state.gallery.selectedIndices) state.gallery.selectedIndices = new Set();

        if (e.shiftKey) {
          // Range select
          const last = state.gallery.lastClickedIdx ?? itemIdx;
          const start = Math.min(last, itemIdx);
          const end = Math.max(last, itemIdx);
          for (let i = start; i <= end; i++) state.gallery.selectedIndices.add(i);
          state.gallery.lastClickedIdx = itemIdx;
          _gridRefreshSelection();
          return;
        }

        if (e.ctrlKey || e.metaKey) {
          // Toggle individual
          if (state.gallery.selectedIndices.has(itemIdx)) state.gallery.selectedIndices.delete(itemIdx);
          else state.gallery.selectedIndices.add(itemIdx);
          state.gallery.lastClickedIdx = itemIdx;
          _gridRefreshSelection();
          return;
        }

        // Normal click → update state and selection but DO NOT close grid (user requested)
        state.gallery.currentIndex = itemIdx; // Needed for tray tools (delete/share/etc.)
        state.gallery.selectedIndices = new Set([itemIdx]);
        state.gallery.lastClickedIdx = itemIdx;
        _gridRefreshSelection();
        // toggleGridView(false); // Grid stays open
        // renderGallery();       // Don't shift focus to underlying viewer
      };

      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const itemIdx = parseInt(item.dataset.globalIdx);
        if (isNaN(itemIdx) || itemIdx < 0) return;
        if (!state.gallery.selectedIndices) state.gallery.selectedIndices = new Set();
        if (!state.gallery.selectedIndices.has(itemIdx)) {
          state.gallery.selectedIndices = new Set([itemIdx]);
          state.gallery.lastClickedIdx = itemIdx;
          _gridRefreshSelection();
        }
        if (typeof showGalleryContextMenu === 'function') {
          showGalleryContextMenu(e.clientX, e.clientY);
        }
      });

      container.appendChild(item);
    });

    groupDiv.appendChild(container);
    gv.body.appendChild(groupDiv);
  }

  // Refresh selected-state CSS on all grid items without full re-render
  function _gridRefreshSelection() {
    if (!gv.body) return;
    const sel = state.gallery.selectedIndices || new Set();
    gv.body.querySelectorAll('.gv2-grid-item[data-global-idx]').forEach(el => {
      const i = parseInt(el.dataset.globalIdx);
      el.classList.toggle('gv2-grid-item--selected', sel.has(i));
    });
  }

  // Click on grid backdrop (not on an item) clears selection
  function _initGridBodyClickToClear() {
    if (!gv.body) return;
    gv.body.addEventListener('click', (e) => {
      if (!e.target.closest('.gv2-grid-item') && !e.target.closest('#gv2-context-menu')) {
        if (state.gallery.selectedIndices?.size > 0) {
          state.gallery.selectedIndices.clear();
          _gridRefreshSelection();
        }
      }
    });
  }

  // Highlight whichever trade header is currently stuck at the top
  function _initStickyActiveDetection() {
    if (!gv.body) return;
    gv.body.addEventListener('scroll', () => {
      const bodyTop = gv.body.getBoundingClientRect().top;
      let stuckHdr = null;
      gv.body.querySelectorAll('.gv2-grid-group-hdr').forEach(hdr => {
        const top = hdr.getBoundingClientRect().top;
        // Header is "stuck" when its top ≈ the body top (within 2px)
        if (top <= bodyTop + 2) stuckHdr = hdr;
      });
      gv.body.querySelectorAll('.gv2-grid-group-hdr').forEach(hdr => {
        hdr.classList.toggle('ggr-is-stuck', hdr === stuckHdr);
      });
    }, { passive: true });
  }

  // Hook into modal opening
  window.addEventListener('load', () => {
    initGrid();
    _initGridBodyClickToClear();
    _initStickyActiveDetection();
  });

  // Re-hook if needed or just handle ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && gv.isOpen) {
      toggleGridView(false);
      e.stopPropagation();
    }
  });

  // External access
  window.toggleGridView = toggleGridView;
  window.isGridViewOpen = () => gv.isOpen;
  window.renderGridContent = renderGridContent;
  window.initGalleryGridUI = initGrid;

})();
