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

function _buildRefHalf(side, label, url, locked, tradeIdx, date) {
  const half = document.createElement('div');
  half.className = 'gv2-ref-half';

  if (url) {
    // ── Loaded image ──────────────────────────────────────────────────────
    const img = document.createElement('img');
    img.className = 'gv2-ref-img';
    img.src = resolveImageUrl ? resolveImageUrl(url) : url;
    img.alt = label;

    // Broken image state (404 etc.)
    img.onerror = () => {
      img.style.display = 'none';
      half.classList.add('gv2-ref-broken');
      const brk = document.createElement('div');
      brk.className = 'gv2-ref-empty';
      brk.innerHTML = `<span class="gv2-ref-lbl" style="color:#f87171">${label}</span><span class="gv2-ref-add" style="color:#f87171;font-size:1rem;">⚠</span>`;
      half.insertBefore(brk, img);
    };
    half.appendChild(img);

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
}

function _syncRefCardsBtn() {
  const btn = document.getElementById('gv2-refcards-toggle');
  if (!btn) return;
  const on = state.gallery.showRefCards !== false;
  btn.innerHTML = '📋 Ref Cards' + (on ? ' <span style="color:#4ade80">✓</span>' : '');
}

document.addEventListener('DOMContentLoaded', initOtherDropdown);
