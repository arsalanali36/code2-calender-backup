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

  function initGrid() {
    gv.btn     = document.getElementById('gv2-grid-btn');
    gv.overlay = document.getElementById('gv2-grid-view');
    gv.closer  = document.getElementById('gv2-grid-close-btn-tray');
    gv.slider  = document.getElementById('gv2-grid-size-slider-tray');
    gv.body    = document.getElementById('gv2-grid-body');
    gv.modal   = document.getElementById('gallery-modal');

    if (!gv.btn || !gv.overlay) return;

    gv.btn.onclick = () => {
      toggleGridView(!gv.isOpen);
    };

    if (gv.closer) {
      gv.closer.onclick = () => {
        toggleGridView(false);
      };
    }

    if (gv.slider) {
      gv.slider.addEventListener('input', (e) => {
        gv.currentSize = e.target.value;
        gv.body.style.setProperty('--grid-img-size', gv.currentSize + 'px');
      });
      // Set initial
      gv.body.style.setProperty('--grid-img-size', gv.currentSize + 'px');
      gv.slider.value = gv.currentSize;
    }
  }

  function toggleGridView(show) {
    gv.isOpen = show;
    if (gv.overlay) {
      gv.overlay.style.display = show ? 'flex' : 'none';
      gv.btn.classList.toggle('active', show);
      if (gv.modal) gv.modal.classList.toggle('grid-open', show);
      
      if (show) {
        renderGridContent();
      }
    }
  }

  function renderGridContent() {
    if (!gv.body) return;
    gv.body.innerHTML = '';
    const date = state.gallery.date;
    const images = state.gallery.images || [];

    if (!date) {
      if (images.length > 0) {
        renderGroup('Gallery Images', images, null);
      }
      return;
    }

    const dayData = state.dayData[date];
    const trades = getTradesForDate(date);

    // 1. OPEN Group
    if (dayData && dayData.images && dayData.images.length > 0) {
      renderGroup('OPEN (Analysis)', dayData.images, null);
    }

    // 2. Trade Groups
    let cumPnl = 0;
    trades.forEach((tr, i) => {
      const pnl = (typeof getTradePnl === 'function' ? getTradePnl(tr) : 0) || 0;
      cumPnl += pnl;
      const imgs = tr.images || [];
      renderGroup(null, imgs, null, pnl, tr, i, cumPnl);
    });

    // 3. CLOSE Group
    if (dayData && dayData.closeImages && dayData.closeImages.length > 0) {
      renderGroup('CLOSE (Post-Market)', dayData.closeImages, null);
    }
  }

  function renderGroup(title, images, statsHtml, pnl, tradeRef, tradeIdx, cumPnl) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'gv2-grid-group';

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

        // Normal click → navigate to image
        state.gallery.currentIndex = itemIdx;
        state.gallery.selectedIndices = new Set([itemIdx]);
        state.gallery.lastClickedIdx = itemIdx;
        toggleGridView(false);
        renderGallery();
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
