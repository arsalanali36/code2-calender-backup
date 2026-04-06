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
    trades.forEach((tr, i) => {
      const pnl   = parseFloat(tr?.['Net P/L'] || tr?.net_pnl || 0) || 0;
      const pt    = parseFloat(tr?.['Pt'] || tr?.pt || 0) || 0;
      const pnlStr = (pnl !== 0 || pt !== 0) 
        ? `${pnl > 0 ? '+₹' : '-₹'}${Math.abs(Math.round(pnl))} · ${pt > 0 ? '+' : ''}${Math.round(pt)}Pt`
        : '';
        
      const instrument = tr?.Instrument || tr?.instrument || '';
      const bTime = (tr?.['Buy Time'] || tr?.buy_time || '').slice(0, 5);
      const sTime = (tr?.['Sell Time'] || tr?.sell_time || '').slice(0, 5);
      const timeStr = bTime && sTime ? `${bTime}-${sTime}` : (bTime || sTime || '');
      
      const title = `T${i+1} : ${instrument}${timeStr ? ' ('+timeStr+')' : ''}`;
      
      const imgs = tr.images || [];
      if (imgs.length > 0) {
        renderGroup(title, imgs, pnlStr, pnl);
      }
    });

    // 3. CLOSE Group
    if (dayData && dayData.closeImages && dayData.closeImages.length > 0) {
      renderGroup('CLOSE (Post-Market)', dayData.closeImages, null);
    }
  }

  function renderGroup(title, images, statsHtml, pnl) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'gv2-grid-group';

    const hdr = document.createElement('div');
    hdr.className = 'gv2-grid-group-hdr';
    
    const titleEl = document.createElement('span');
    titleEl.className = 'gv2-grid-group-title';
    titleEl.textContent = title;
    hdr.appendChild(titleEl);

    if (statsHtml) {
      const statsEl = document.createElement('span');
      statsEl.className = 'gv2-grid-group-pnl';
      statsEl.textContent = statsHtml;
      statsEl.style.color = pnl > 0 ? 'var(--green)' : (pnl < 0 ? 'var(--red)' : 'var(--orange)');
      hdr.appendChild(statsEl);
    }

    groupDiv.appendChild(hdr);

    const container = document.createElement('div');
    container.className = 'gv2-grid-container';
    
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

      item.onclick = () => {
        // Find index of this image in the main images array
        const idx = state.gallery.images.indexOf(url);
        if (idx >= 0) {
          state.gallery.currentIndex = idx;
          state.gallery.selectedIndices = new Set([idx]);
          toggleGridView(false);
          renderGallery();
        }
      };

      container.appendChild(item);
    });

    groupDiv.appendChild(container);
    gv.body.appendChild(groupDiv);
  }

  // Hook into modal opening
  window.addEventListener('load', () => {
    // Initial hook
    initGrid();
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
