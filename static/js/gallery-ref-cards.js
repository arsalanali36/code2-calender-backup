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
    
    // Self-Correction: Fix stripped Cloudinary paths
    let targetU = url;
    if (url && !url.includes('/') && url.includes('.')) {
        const images = state.gallery.images || [];
        const full = images.find(img => img.includes(url));
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

// ── "Other" dropdown in the gallery top tray ─────────────────────────────────

function initOtherDropdown() {
  const btn = document.getElementById('gv2-other-btn');
  const dd  = document.getElementById('gv2-other-dropdown');
  if (!btn || !dd) return;

  btn.addEventListener('click', e => {
    e.stopPropagation();
    dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#gv2-other-btn-wrap')) dd.style.display = 'none';
  });

  const rcToggle = document.getElementById('gv2-refcards-toggle');
  if (rcToggle) {
    if (state.gallery.showRefCards === undefined) state.gallery.showRefCards = true;
    _syncRefCardsBtn();
    rcToggle.addEventListener('click', () => {
      state.gallery.showRefCards = !state.gallery.showRefCards;
      _syncRefCardsBtn();
      dd.style.display = 'none';
      state.gallery._skipScrollIntoView = true;
      renderGallery();
    });
  }

  const tsToggle = document.getElementById('gv2-tradesidebar-toggle');
  if (tsToggle) {
    if (window._tradeSidebarDisabled === undefined) window._tradeSidebarDisabled = true;
    _syncTradeSidebarBtn();
    tsToggle.addEventListener('click', () => {
      window._tradeSidebarDisabled = !window._tradeSidebarDisabled;
      if (window._tradeSidebarDisabled && typeof toggleTradeSidebar === 'function') {
        toggleTradeSidebar(false);
      }
      _syncTradeSidebarBtn();
      dd.style.display = 'none';
    });
  }

  const pdfBtn = document.getElementById('gv2-export-refpdf-btn');
  if (pdfBtn) {
    pdfBtn.disabled = false;
    pdfBtn.onclick = (e) => {
        e.stopPropagation();
        dd.style.display = 'none';
        exportRefCardsToPDF();
    };
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
  
  dayTrades.forEach((tr, i) => {
    const cardData = refCards[i];
    if (!cardData) return;
    // Include both split-view snapshots (isSnapshot:true) and simple pinned URLs (string)
    const hasContent = cardData.index || cardData.premium;
    if (!hasContent) return;

    const tradeRow = document.createElement('div');
    tradeRow.className = 'gv2-pdf-trade-row';
    tradeRow.style.cssText = 'margin-bottom:40px; break-inside:avoid; page-break-inside:avoid;';

    const pnl = typeof getTradePnl === 'function' ? (getTradePnl(tr) || 0) : 0;
    const pnlColor = pnl >= 0 ? '#10b981' : '#ef4444';
    const pnlStr = (pnl >= 0 ? '+' : '') + '₹' + Math.abs(Math.round(pnl)).toLocaleString('en-IN');
    
    const _renderImg = (data, lbl) => {
        const url = (typeof data === 'object' && data !== null) ? data.url : data;
        if (!url) return `<div style="display:flex; flex-direction:column; gap:6px;"><div style="font-size:0.75rem; font-weight:700; color:#666; text-transform:uppercase;">${lbl}</div><div style="border:1px solid #ddd; border-radius:4px; background:#eee; min-height:180px; display:flex; align-items:center; justify-content:center; color:#999; font-style:italic; font-size:0.75rem;">Not Saved</div></div>`;
        
        let targetU = url;
        if (url && !url.includes('/') && url.includes('.')) {
            const images = state.gallery?.images || [];
            const full = images.find(img => img === url || img.endsWith('/' + url));
            if (full) targetU = full;
        }
        let style = 'width:100%; height:auto; display:block;';
        if (typeof data === 'object' && data !== null) {
            style = `transform: translate(${data.tx}px, ${data.ty}px) scale(${data.scale}); transform-origin: center; width:100%; height:auto; display:block;`;
        }
        return `
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="font-size:0.75rem; font-weight:700; color:#666; text-transform:uppercase; letter-spacing:0.5px;">${lbl}</div>
            <div style="border:1px solid #ddd; border-radius:4px; overflow:hidden; background:#eee; height:240px; display:flex; align-items:center; justify-content:center; position:relative;">
               <img src="${resolveImageUrl(targetU)}" style="${style}">
            </div>
          </div>
        `;
    };

    tradeRow.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px; background:#f8f9fa; padding:8px 12px; border-radius:6px; border-left:4px solid ${pnlColor}">
        <div style="background:#333; color:#fff; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.8rem;">${i + 1}</div>
        <div style="font-weight:700; font-size:1rem; color:#111; flex:1;">${(tr.Instrument || tr.instrument || 'Trade').toUpperCase()}</div>
        <div style="color:${pnlColor}; font-weight:800; font-size:1rem;">${pnlStr}</div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
        ${_renderImg(cardData.index, 'Index / Context')}
        ${_renderImg(cardData.premium, 'Premium / Execution')}
      </div>
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
      window.removeEventListener('focus', cleanup);
  };
  window.addEventListener('focus', cleanup);
}

document.addEventListener('DOMContentLoaded', initOtherDropdown);

function _syncRefCardsBtn() {
  const btn = document.getElementById('gv2-refcards-toggle');
  if (!btn) return;
  const on = state.gallery.showRefCards !== false;
  btn.innerHTML = '📋 Ref Cards' + (on ? ' <span style="color:#4ade80">✓</span>' : '');
}

function _syncTradeSidebarBtn() {
  const btn = document.getElementById('gv2-tradesidebar-toggle');
  if (!btn) return;
  const enabled = !window._tradeSidebarDisabled;
  btn.innerHTML = '🖼 Trade Sidebar' + (enabled ? ' <span style="color:#4ade80">✓</span>' : ' <span style="color:#f87171">✗</span>');
}

