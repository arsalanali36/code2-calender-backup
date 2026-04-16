// gallery-ref-cards.js — Trade Reference Cards (dual-panel index/premium snapshots)
// Each trade separator gets a ref card: two image slots (Index | Premium)
// Data: state.dayData[date].tradeRefCards[tradeIdx] = { index, premium, indexLocked, premiumLocked }
// Click on loaded image → opens fullscreen lightbox viewer

/**
 * Build and return the ref card DOM element for a given trade separator.
 * Returns null if ref cards are hidden.
 */
function createRefCardElement(tradeIdx, tradeObj, date) {
  if (state.gallery.showRefCards === false) return null;

  const dData = state.dayData[date] = state.dayData[date] || {};
  dData.tradeRefCards = dData.tradeRefCards || {};
  const card = dData.tradeRefCards[tradeIdx] || {};

  const el = document.createElement('div');
  el.className = 'gv2-ref-card';
  el.dataset.tradeIdx = tradeIdx;
  el.dataset.date = date;

  el.appendChild(_buildRefHalf('index',   'INDEX',   card.index,   !!card.indexLocked,   tradeIdx, date));

  const divider = document.createElement('div');
  divider.className = 'gv2-ref-divider';
  el.appendChild(divider);

  el.appendChild(_buildRefHalf('premium', 'PREMIUM', card.premium, !!card.premiumLocked, tradeIdx, date));

  return el;
}

function _buildRefHalf(side, label, data, locked, tradeIdx, date) {
  const half = document.createElement('div');
  half.className = 'gv2-ref-half';
  half.style.overflow = 'hidden'; // Important for zoomed images

    const url = (typeof data === 'object' && data !== null) ? data.url : data;
    
    // Self-Correction: Fix stripped/broken Cloudinary paths
    let targetU = url;
    if (url && !url.includes('/') && url.includes('.')) {
        // Old-format: bare filename
        const images = state.gallery.images || [];
        const full = images.find(img => img.includes(url));
        if (full) targetU = full;
    } else if (url && url.startsWith('/') && !url.startsWith('/uploads/') && !url.startsWith('/static/')) {
        // Broken Cloudinary URL: stripped to pathname only
        const filename = url.split('/').pop();
        const images = state.gallery.images || [];
        const full = images.find(img => img.endsWith('/' + filename) || img.includes(filename));
        if (full) targetU = full;
    }

    if (url) {
      // ── Loaded image ──────────────────────────────────────────────────────
      const imgCont = document.createElement('div');
      imgCont.style.cssText = 'width:100%; height:100%; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center;';
      
      const img = document.createElement('img');
      img.className = 'gv2-ref-img';
      img.src = resolveImageUrl ? resolveImageUrl(targetU) : targetU;
      img.alt = label;

    
    // Apply transform if stored as object
    if (typeof data === 'object' && data !== null) {
        const { scale, tx, ty } = data;
        img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
        img.style.transformOrigin = 'center';
    }

    // Broken image state (404 etc.)
    img.onerror = () => {
      imgCont.style.display = 'none';
      half.classList.add('gv2-ref-broken');
      const brk = document.createElement('div');
      brk.className = 'gv2-ref-empty';
      brk.innerHTML = `<span class="gv2-ref-lbl" style="color:#f87171">${label}</span><span class="gv2-ref-add" style="color:#f87171;font-size:1rem;">⚠</span>`;
      half.insertBefore(brk, imgCont);
    };
    imgCont.appendChild(img);
    half.appendChild(imgCont);

    // ── Overlay (visible on hover) ────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.className = 'gv2-ref-overlay';

    const lbl = document.createElement('span');
    lbl.className = 'gv2-ref-lbl';
    lbl.textContent = label;
    overlay.appendChild(lbl);

    const actions = document.createElement('div');
    actions.className = 'gv2-ref-actions';

    // 🔍 View fullscreen (always available)
    const viewBtn = document.createElement('button');
    viewBtn.className = 'gv2-ref-view-btn';
    viewBtn.title = 'View fullscreen';
    viewBtn.textContent = '🔍';
    viewBtn.addEventListener('click', e => {
      e.stopPropagation();
      _openRefCardLightbox(resolveImageUrl ? resolveImageUrl(url) : url, label);
    });
    actions.appendChild(viewBtn);

    // 🔒 Lock toggle
    const lockBtn = document.createElement('button');
    lockBtn.className = 'gv2-ref-lock-btn' + (locked ? ' locked' : '');
    lockBtn.title = locked ? 'Unlock' : 'Lock image';
    lockBtn.textContent = locked ? '🔒' : '🔓';
    lockBtn.addEventListener('click', e => { e.stopPropagation(); _refCardToggleLock(tradeIdx, side, date); });
    actions.appendChild(lockBtn);

    if (!locked) {
      // 📷 Replace image
      const replBtn = document.createElement('button');
      replBtn.className = 'gv2-ref-repl-btn';
      replBtn.title = 'Replace image';
      replBtn.textContent = '📷';
      replBtn.addEventListener('click', e => { e.stopPropagation(); _refCardPickImage(tradeIdx, side, date); });
      actions.appendChild(replBtn);

      // ✕ Remove
      const clearBtn = document.createElement('button');
      clearBtn.className = 'gv2-ref-clear-btn';
      clearBtn.title = 'Remove image';
      clearBtn.textContent = '✕';
      clearBtn.addEventListener('click', e => { e.stopPropagation(); _refCardClearImage(tradeIdx, side, date); });
      actions.appendChild(clearBtn);
    }

    overlay.appendChild(actions);
    half.appendChild(overlay);

    // Click on image → fullscreen lightbox
    half.style.cursor = 'zoom-in';
    half.addEventListener('click', e => {
      if (e.target.closest('.gv2-ref-actions')) return;
      _openRefCardLightbox(resolveImageUrl ? resolveImageUrl(url) : url, label);
    });

  } else {
    // ── Empty slot — show upload prompt ──────────────────────────────────
    const empty = document.createElement('div');
    empty.className = 'gv2-ref-empty';
    empty.innerHTML = `<span class="gv2-ref-lbl">${label}</span><span class="gv2-ref-add">+</span>`;
    half.appendChild(empty);

    half.style.cursor = 'pointer';
    half.addEventListener('click', () => _refCardPickImage(tradeIdx, side, date));
  }

  return half;
}

// ── Fullscreen lightbox ───────────────────────────────────────────────────────

function _openRefCardLightbox(url, label) {
  // Remove existing lightbox if any
  const existing = document.getElementById('gv2-ref-lightbox');
  if (existing) existing.remove();

  const lb = document.createElement('div');
  lb.id = 'gv2-ref-lightbox';
  lb.innerHTML = `
    <div class="gv2-rlb-inner">
      <div class="gv2-rlb-header">
        <span class="gv2-rlb-label">${label}</span>
        <button class="gv2-rlb-close" id="gv2-rlb-close">✕</button>
      </div>
      <div class="gv2-rlb-body">
        <img src="${url}" alt="${label}" class="gv2-rlb-img" id="gv2-rlb-img">
      </div>
    </div>`;

  document.body.appendChild(lb);

  // Close handlers
  const close = () => lb.remove();
  document.getElementById('gv2-rlb-close').addEventListener('click', close);
  lb.addEventListener('click', e => { if (e.target === lb) close(); });

  const onKey = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
}

// ── Upload / data helpers ─────────────────────────────────────────────────────

async function _refCardPickImage(tradeIdx, side, date) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      showToast('Uploading ref image…', 'info');
      const result = await imageService.uploadImage(file);
      if (!result || !result.url) { showToast('Upload failed', 'error'); return; }
      const dData = state.dayData[date] = state.dayData[date] || {};
      dData.tradeRefCards = dData.tradeRefCards || {};
      dData.tradeRefCards[tradeIdx] = dData.tradeRefCards[tradeIdx] || {};
      if (side === 'index') dData.tradeRefCards[tradeIdx].index = result.url;
      else                  dData.tradeRefCards[tradeIdx].premium = result.url;
      await saveTrades();
      state.gallery._skipScrollIntoView = true;
      renderGallery();
      showToast('Ref image saved', 'success');
    } catch (err) {
      showToast('Upload error: ' + err.message, 'error');
    }
  };
  inp.click();
}

function _refCardToggleLock(tradeIdx, side, date) {
  const dData = state.dayData[date] = state.dayData[date] || {};
  dData.tradeRefCards = dData.tradeRefCards || {};
  dData.tradeRefCards[tradeIdx] = dData.tradeRefCards[tradeIdx] || {};
  const key = side === 'index' ? 'indexLocked' : 'premiumLocked';
  dData.tradeRefCards[tradeIdx][key] = !dData.tradeRefCards[tradeIdx][key];
  saveTrades();
  state.gallery._skipScrollIntoView = true;
  renderGallery();
}

function _refCardClearImage(tradeIdx, side, date) {
  const dData = state.dayData[date] = state.dayData[date] || {};
  dData.tradeRefCards = dData.tradeRefCards || {};
  dData.tradeRefCards[tradeIdx] = dData.tradeRefCards[tradeIdx] || {};
  if (side === 'index') dData.tradeRefCards[tradeIdx].index = null;
  else                  dData.tradeRefCards[tradeIdx].premium = null;
  saveTrades();
  state.gallery._skipScrollIntoView = true;
  renderGallery();
}

// ── Gallery Settings Modal ────────────────────────────────────────────────────

function initOtherDropdown() {
  const btn     = document.getElementById('gv2-other-btn');
  const overlay = document.getElementById('gv2-settings-overlay');
  const closeBtn = document.getElementById('gv2-settings-close');
  const saveBtn  = document.getElementById('gv2-settings-save-btn');
  if (!btn || !overlay) return;

  if (btn.dataset.initialized) return;
  btn.dataset.initialized = 'true';

  // Local staging variables (only save to state/localStorage on "Save Settings" click)
  let stagedShowRefCards = true;
  let stagedSidebarDisabled = true;
  let stagedPillFontSize = '0.82rem';

  const openModal = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    
    // 1. Initial Load of current state into staging
    if (state.gallery.showRefCards === undefined) {
      try {
        const stored = localStorage.getItem('tj_gv2_showRefCards');
        state.gallery.showRefCards = (stored !== null) ? (stored === 'true') : true;
      } catch(e) { state.gallery.showRefCards = true; }
    }
    if (window._tradeSidebarDisabled === undefined) {
      try {
        const stored = localStorage.getItem('tj_gv2_sidebarDisabled');
        window._tradeSidebarDisabled = (stored !== null) ? (stored === 'true') : true;
      } catch(e) { window._tradeSidebarDisabled = true; }
    }

    if (state.gallery.pillFontSize === undefined) {
      try {
        const stored = localStorage.getItem('tj_gv2_pillFontSize');
        state.gallery.pillFontSize = stored || '0.82rem';
      } catch(e) { state.gallery.pillFontSize = '0.82rem'; }
    }

    stagedShowRefCards = state.gallery.showRefCards;
    stagedSidebarDisabled = window._tradeSidebarDisabled;
    stagedPillFontSize = state.gallery.pillFontSize;

    _updateStagedUI();
    overlay.classList.add('open');
    btn.classList.add('active');
  };

  const _updateStagedUI = () => {
    const rcBadge = document.getElementById('gv2-refcards-badge');
    if (rcBadge) {
      rcBadge.textContent = stagedShowRefCards ? 'ON' : 'OFF';
      document.getElementById('gv2-refcards-toggle').classList.toggle('active', stagedShowRefCards);
    }
    const tsBadge = document.getElementById('gv2-tradesidebar-badge');
    if (tsBadge) {
      tsBadge.textContent = !stagedSidebarDisabled ? 'ON' : 'OFF';
      document.getElementById('gv2-tradesidebar-toggle').classList.toggle('active', !stagedSidebarDisabled);
    }
    const fsSelect = document.getElementById('gv2-pill-font-size');
    const fsVal    = document.getElementById('gv2-pill-font-size-val');
    if (fsSelect) {
      const numericVal = stagedPillFontSize.replace('rem', '');
      fsSelect.value = numericVal;
      if (fsVal) fsVal.textContent = stagedPillFontSize;
    }
  };

  const closeModal = () => {
    overlay.classList.remove('open');
    btn.classList.remove('active');
  };

  const handleSave = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    console.log("[GallerySettings] Saving staged values...", { stagedShowRefCards, stagedSidebarDisabled });
    
    // Persist staging variables
    state.gallery.showRefCards = stagedShowRefCards;
    window._tradeSidebarDisabled = stagedSidebarDisabled;
    state.gallery.pillFontSize = stagedPillFontSize;

    try {
      localStorage.setItem('tj_gv2_showRefCards', state.gallery.showRefCards);
      localStorage.setItem('tj_gv2_sidebarDisabled', window._tradeSidebarDisabled);
      localStorage.setItem('tj_gv2_pillFontSize', state.gallery.pillFontSize);
    } catch(err) { console.error("LocalStorage Save Error:", err); }

    // Apply CSS scale
    document.documentElement.style.setProperty('--pill-font-size', state.gallery.pillFontSize);

    // Apply UI changes immediately
    if (window._tradeSidebarDisabled && typeof toggleTradeSidebar === 'function') {
      toggleTradeSidebar(false);
    }
    
    state.gallery._skipScrollIntoView = true;
    if (typeof renderGallery === 'function') renderGallery();
    
    // Visual Confirmation
    if (typeof showToast === 'function') {
        showToast('✅ Gallery Settings Saved & Applied!', 'success');
    } else {
        alert('Settings Saved!');
    }
    
    closeModal();
  };

  btn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  
  // Re-fetch button to be absolutely sure it's in DOM
  const finalBtn = document.getElementById('gv2-settings-save-btn');
  if (finalBtn) {
      finalBtn.addEventListener('click', handleSave);
      console.log("[GallerySettings] Save button listener attached successfully.");
  }

  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  // Staging Toggles
  const rcToggle = document.getElementById('gv2-refcards-toggle');
  if (rcToggle) {
    rcToggle.addEventListener('click', () => { stagedShowRefCards = !stagedShowRefCards; _updateStagedUI(); });
  }
  const tsToggle = document.getElementById('gv2-tradesidebar-toggle');
  if (tsToggle) {
    tsToggle.addEventListener('click', () => { stagedSidebarDisabled = !stagedSidebarDisabled; _updateStagedUI(); });
  }

  const fsSelect = document.getElementById('gv2-pill-font-size');
  const fsVal    = document.getElementById('gv2-pill-font-size-val');
  if (fsSelect) {
    fsSelect.addEventListener('input', (e) => { 
      stagedPillFontSize = e.target.value + 'rem'; 
      if (fsVal) fsVal.textContent = stagedPillFontSize;
      // Optional: Apply live preview?
      // document.documentElement.style.setProperty('--pill-font-size', stagedPillFontSize);
    });
  }

  // Export Current View PDF
  const pdfBtn = document.getElementById('gv2-export-current-pdf-btn');
  if (pdfBtn) pdfBtn.addEventListener('click', () => { closeModal(); if (typeof exportCurrentViewToPDF === 'function') exportCurrentViewToPDF(); });

  // Export Ref Cards PDF Summary
  const allPdfBtn = document.getElementById('gv2-export-refpdf-btn');
  if (allPdfBtn) allPdfBtn.addEventListener('click', () => { closeModal(); if (typeof exportRefCardsToPDF === 'function') exportRefCardsToPDF(); });

  // 📦 Full Backup (Data + Images)
  const fullBackupBtn = document.getElementById('gv2-full-backup-btn');
  if (fullBackupBtn) {
    fullBackupBtn.addEventListener('click', () => {
      closeModal();
      if (typeof backupJson === 'function') {
        backupJson();
      } else {
        // Fallback if backupJson is not in scope
        exportService.downloadBackup();
      }
    });
  }

  // 📤 Restore Backup (ZIP / JSON)
  const restoreBtn = document.getElementById('gv2-restore-backup-btn');
  if (restoreBtn) {
    restoreBtn.addEventListener('click', () => {
      closeModal();
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.zip,.json';
      inp.onchange = e => {
        const file = e.target.files[0];
        if (file && typeof importJson === 'function') {
          importJson(file);
        }
      };
      inp.click();
    });
  }
}

/**
 * 📄 PDF Export Logic for Ref Cards
 */
function renderRefCardsForPrint(container, date) {
  const dayData = state.dayData[date];
  const refCards = dayData?.tradeRefCards;
  if (!refCards || Object.keys(refCards).length === 0) return;

  const header = document.createElement('div');
  header.className = 'gv2-pdf-header';
  header.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #333; padding-bottom:10px; margin-bottom:20px;">
      <div>
        <h1 style="margin:0; font-size:1.8rem; color:#222;">TRADING JOURNAL</h1>
        <div style="color:#666; font-size:0.9rem; margin-top:4px;">Reference Summary Report</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:1.2rem; font-weight:700; color:#333;">${date}</div>
        <div style="font-size:0.8rem; color:#999; margin-top:2px;">Generated: ${new Date().toLocaleDateString()}</div>
      </div>
    </div>
  `;
  container.appendChild(header);

  const dayTrades = typeof getTradesForDate === 'function' ? getTradesForDate(date) : [];
  
  // Temp in-memory captures (data URLs) stored by "Store Current View" — cleared after print
  const tempCaptures = window._refCardCaptures?.[date] || {};

  // Iterate over stored cards rather than all trades to ensure we catch everything with a 'green dot'
  Object.keys(refCards).forEach(tradeIdxKey => {
    const tradeIdx = parseInt(tradeIdxKey);
    const tr = dayTrades[tradeIdx];
    if (!tr) return;

    const cardData = refCards[tradeIdxKey];
    if (!cardData) return;

    // Use temp data URL captures if available, else fall back to stored URL
    const cap = tempCaptures[tradeIdxKey] || {};
    const indexData  = cap.index   || cardData.index;
    const premiumData = cap.premium || cardData.premium;

    const hasIndex   = !!(indexData   && ((typeof indexData   === 'string') ? indexData   : indexData.url));
    const hasPremium = !!(premiumData && ((typeof premiumData === 'string') ? premiumData : premiumData.url));
    
    // Only show trades that actually have at least one image stored (green dot trades)
    if (!hasIndex && !hasPremium) return;

    const tradeRow = document.createElement('div');
    tradeRow.className = 'gv2-pdf-trade-row';
    tradeRow.style.cssText = 'margin-bottom:60px; break-inside:avoid; page-break-inside:avoid;';

    const pnl = typeof getTradePnl === 'function' ? (getTradePnl(tr) || 0) : 0;
    const pnlColor = pnl >= 0 ? '#10b981' : '#ef4444';
    const pnlStr = (pnl >= 0 ? '+' : '') + '₹' + Math.abs(Math.round(pnl)).toLocaleString('en-IN');

    const _renderImgHtml = (data, lbl, imgH = 260) => {
        if (!data) return '';
        
        let src = '';
        let style = 'width:100%; height:100%; object-fit:contain; display:block;';
        
        if (typeof data === 'string' && data.startsWith('data:')) {
            src = data;
        } else {
            const url = (typeof data === 'object' && data !== null) ? data.url : data;
            if (!url) return '';
            
            let targetU = url;
            // URL cleanup
            if (url && !url.includes('/') && url.includes('.')) {
                const images = state.gallery?.images || [];
                const full = images.find(img => img === url || img.endsWith('/' + url));
                if (full) targetU = full;
            }
            src = resolveImageUrl(targetU);
            
            if (typeof data === 'object' && data.scale && data.panelW) {
                const scaleRatio = imgH / (data.panelH || 400);
                const sx = (data.tx || 0) * scaleRatio;
                const sy = (data.ty || 0) * scaleRatio;
                style = `position:absolute; top:50%; left:50%; transform:translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px)) scale(${data.scale}); transform-origin:center; max-width:none; width:${data.panelW * scaleRatio}px;`;
            }
        }

        return `
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="font-size:0.75rem; font-weight:700; color:#666; text-transform:uppercase; letter-spacing:0.5px;">${lbl}</div>
            <div style="border:1px solid #ddd; border-radius:4px; overflow:hidden; background:#eee; height:${imgH}px; position:relative;">
               <img src="${src}" style="${style}" onerror="this.parentElement.style.background='#f3f4f6'; this.style.display='none';">
            </div>
          </div>
        `;
    };

    // Layout Logic
    let imageBlocks = '';
    if (hasIndex && hasPremium) {
        imageBlocks = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
            ${_renderImgHtml(indexData, 'Index / Context', 260)}
            ${_renderImgHtml(premiumData, 'Premium / Execution', 260)}
        </div>`;
    } else if (hasIndex) {
        imageBlocks = `<div>${_renderImgHtml(indexData, 'Index / Context', 450)}</div>`;
    } else {
        imageBlocks = `<div>${_renderImgHtml(premiumData, 'Premium / Execution', 450)}</div>`;
    }

    tradeRow.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px; background:#f8f9fa; padding:10px 15px; border-radius:8px; border-left:5px solid ${pnlColor}">
        <div style="background:#333; color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.9rem;">${tradeIdx + 1}</div>
        <div style="font-weight:700; font-size:1.1rem; color:#111; flex:1;">${(tr.Instrument || tr.instrument || 'Trade').toUpperCase()}</div>
        <div style="color:${pnlColor}; font-weight:800; font-size:1.1rem;">${pnlStr}</div>
      </div>
      ${imageBlocks}
    `;
    container.appendChild(tradeRow);
  });
}

async function exportRefCardsToPDF() {
  const date = state.gallery.date;
  if (!date) { if (typeof showToast === 'function') showToast('Pehle date select karein', 'error'); return; }

  const printLayer = document.createElement('div');
  printLayer.id = 'gv2-pdf-print-layer';
  renderRefCardsForPrint(printLayer, date);
  document.body.appendChild(printLayer);

  if (typeof showToast === 'function') showToast('Preparing PDF Report...', 'info');

  // Wait for all images in print layer to load before printing
  const imgs = Array.from(printLayer.querySelectorAll('img'));
  if (imgs.length > 0) {
    await Promise.all(imgs.map(img => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve; // don't block if one fails
      });
    }));
  }

  // Small buffer for layout
  await new Promise(r => setTimeout(r, 200));

  window.print();
  const cleanup = () => {
      if (document.body.contains(printLayer)) document.body.removeChild(printLayer);
      // Clear temp captures — data URLs no longer needed after print
      if (window._refCardCaptures) delete window._refCardCaptures[date];
      window.removeEventListener('focus', cleanup);
  };
  window.addEventListener('focus', cleanup);
}

/**
 * 📄 Export only the CURRENT visible gallery view to PDF
 */
async function exportCurrentViewToPDF() {
  const date = state.gallery.date;
  if (!date) return;
  
  if (typeof showToast === 'function') showToast('Capturing current view...', 'info');

  let leftCap = null, rightCap = null;
  if (state.gallery.splitView && typeof _captureSplitPanel === 'function') {
      [leftCap, rightCap] = await Promise.all([
          _captureSplitPanel('gv2-split-left',  'gv2-split-left-img'),
          _captureSplitPanel('gv2-split-right', 'gv2-split-right-img')
      ]);
  } else if (typeof _captureSplitPanel === 'function') {
      // Single view: capture just the main image area
      leftCap = await _captureSplitPanel('gallery-zoom-layer', 'gallery-img');
  }

  const printLayer = document.createElement('div');
  printLayer.id = 'gv2-pdf-print-layer';
  
  const header = document.createElement('div');
  header.className = 'gv2-pdf-header';
  header.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #333; padding-bottom:10px; margin-bottom:20px;">
      <div>
        <h1 style="margin:0; font-size:1.8rem; color:#222;">GALLERY SNAPSHOT</h1>
        <div style="color:#666; font-size:0.9rem; margin-top:4px;">Current Custom View</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:1.2rem; font-weight:700; color:#333;">${date}</div>
        <div style="font-size:0.8rem; color:#999; margin-top:2px;">Generated: ${new Date().toLocaleDateString()}</div>
      </div>
    </div>
  `;
  printLayer.appendChild(header);

  const row = document.createElement('div');
  row.style.cssText = 'margin-bottom:20px;';
  
  if (leftCap && rightCap) {
      row.innerHTML = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
        <div style="border:1px solid #ddd; background:#111; height:400px;"><img src="${leftCap}" style="width:100%; height:100%; object-fit:contain;"></div>
        <div style="border:1px solid #ddd; background:#111; height:400px;"><img src="${rightCap}" style="width:100%; height:100%; object-fit:contain;"></div>
      </div>`;
  } else if (leftCap) {
      row.innerHTML = `<div style="border:1px solid #ddd; background:#111; height:600px;"><img src="${leftCap}" style="width:100%; height:100%; object-fit:contain;"></div>`;
  } else {
      // Fallback: Just the current image
      const curImg = (state.gallery.images || [])[state.gallery.currentIndex];
      if (curImg) {
          row.innerHTML = `<div style="border:1px solid #ddd; background:#eee; height:600px;"><img src="${resolveImageUrl(curImg)}" style="width:100%; height:100%; object-fit:contain;"></div>`;
      }
  }
  printLayer.appendChild(row);
  document.body.appendChild(printLayer);

  // Buffer for image content
  await new Promise(r => setTimeout(r, 1000));
  window.print();
  setTimeout(() => printLayer.remove(), 2000);
}

document.addEventListener('DOMContentLoaded', initOtherDropdown);

function _syncRefCardsBtn() {
  const row   = document.getElementById('gv2-refcards-toggle');
  const badge = document.getElementById('gv2-refcards-badge');
  if (!row || !badge) return;
  const on = state.gallery.showRefCards !== false;
  badge.textContent = on ? 'ON' : 'OFF';
  row.classList.toggle('active', on);
}

function _syncTradeSidebarBtn() {
  const row   = document.getElementById('gv2-tradesidebar-toggle');
  const badge = document.getElementById('gv2-tradesidebar-badge');
  if (!row || !badge) return;
  const enabled = !window._tradeSidebarDisabled;
  badge.textContent = enabled ? 'ON' : 'OFF';
  row.classList.toggle('active', enabled);
}

// Initialize Saved Font Size on Load
(function() {
  try {
    const storedFs = localStorage.getItem('tj_gv2_pillFontSize');
    if (storedFs) document.documentElement.style.setProperty('--pill-font-size', storedFs);
  } catch(e) {}
})();

