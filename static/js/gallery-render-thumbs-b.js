// gallery-render-thumbs-b.js
// Split from gallery-render-thumbs.js (30KB limit)
// Contains: _renderThumbsFooter (PREMIUM + blank + scroll) + _renderPdfModeThumbs

// ── PDF mode: render pages as regular img thumbnails ─────────────────────────
function _renderPdfModeThumbs(thumbs) {
  const images  = state.gallery.images || [];
  const current = state.gallery.currentIndex;
  const pdf     = state.gallery.pdf || {};

  // PDF name header
  if (pdf.name) {
    const hdr = document.createElement('div');
    hdr.style.cssText = 'padding:6px 8px; font-size:0.72rem; font-weight:700; color:#58a6ff; text-transform:uppercase; letter-spacing:0.5px; opacity:0.8;';
    hdr.textContent = pdf.name.length > 28 ? pdf.name.slice(0, 25) + '...' : pdf.name;
    thumbs.appendChild(hdr);
  }

  images.forEach((url, idx) => {
    const isActive   = idx === current;
    const wrap       = document.createElement('div');
    wrap.className   = 'gv2-thumb-wrap';
    wrap.dataset.globalIdx = idx;

    const img        = document.createElement('img');
    img.src          = resolveImageUrl(url);
    img.className    = 'gv2-thumb' + (isActive ? ' active' : '');
    img.draggable    = false;

    // Page number badge
    const badge      = document.createElement('div');
    badge.style.cssText = 'position:absolute;bottom:2px;left:2px;font-size:9px;background:rgba(0,0,0,0.75);color:#fff;padding:1px 4px;border-radius:3px;z-index:10;font-family:monospace;pointer-events:none;';
    badge.textContent = 'P' + (idx + 1);

    // Delete page button
    const del        = document.createElement('button');
    del.className    = 'gv2-thumb-del';
    del.textContent  = '\u00d7';
    del.title        = 'Delete this page';
    del.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm('Delete page ' + (idx + 1) + ' from this PDF?')) return;
      const newPages = images.filter((_, i) => i !== idx);
      try {
        await imageService.updatePdfPages(pdf.filename, newPages);
        state.gallery.images = newPages;
        state.gallery.currentIndex = Math.min(current, newPages.length - 1);
        renderGallery();
        showToast('Page deleted', 'success');
      } catch (err) {
        console.error('[PDF] page delete failed', err);
        showToast('Delete failed', 'error');
      }
    };

    wrap.appendChild(img);
    wrap.appendChild(badge);
    wrap.appendChild(del);

    wrap.addEventListener('click', () => {
      state.gallery.currentIndex = idx;
      renderGallery();
    });

    thumbs.appendChild(wrap);
  });
}

// ── PREMIUM section + blank button + scroll ───────────────────────────────────
function _renderThumbsFooter(thumbs, date, dayTrades, uniqueInsts, premiumObj,
                              savedScrollTop, savedScrollLeft, _filterActive3, createSpecialSeparator) {
  // ── PREMIUM SECTION ───────────────────────────────────────────────────────
  if (!_filterActive3 && date && uniqueInsts.length > 0) {
    thumbs.appendChild(createSpecialSeparator('PREMIUM', 'PREMIUM'));
    if (!state.gallery.collapsedSeparators?.has('PREMIUM')) {
      uniqueInsts.forEach(inst => {
        const instWrap = document.createElement('div');
        instWrap.style.cssText = 'margin:12px 6px; padding:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,215,0,0.2); border-radius:8px;';

        const label = document.createElement('div');
        const m = inst.match(/(\d{5})(CE|PE)$/i);
        const cleanLabel = m ? `${m[1]} ${m[2].toUpperCase()}` : inst;
        label.textContent = cleanLabel;
        label.style.cssText = 'font-size:0.95rem; font-weight:800; color:#ffd700; text-align:center; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;';
        instWrap.appendChild(label);

        const val = premiumObj[inst];
        const urls = Array.isArray(val) ? val : (val ? [val] : []);

        const imgContainer = document.createElement('div');
        imgContainer.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px; justify-content:center;';
        instWrap.appendChild(imgContainer);

        urls.forEach((url, uIdx) => {
          const gIdx = state.gallery.images.indexOf(url);
          const thumb = document.createElement('div');
          thumb.className = 'gv2-thumb-wrap';

          const img = document.createElement('img');
          img.src = resolveImageUrl(url);
          img.className = 'gv2-thumb' + (gIdx === state.gallery.currentIndex ? ' active' : '');
          img.style.height = '60px';
          img.onclick = () => { state.gallery.currentIndex = gIdx; renderGallery(); };

          const del = document.createElement('button');
          del.className = 'gv2-thumb-del'; del.textContent = '\u00d7';
          del.onclick = async (e) => {
            e.stopPropagation();
            if (Array.isArray(state.dayData[date].premiumImages[inst])) {
              state.dayData[date].premiumImages[inst].splice(uIdx, 1);
            } else {
              delete state.dayData[date].premiumImages[inst];
            }
            const idx = state.gallery.images.indexOf(url);
            if (idx >= 0) state.gallery.images.splice(idx, 1);
            await saveTrades();
            state.gallery._skipScrollIntoView = true;
            renderGallery();
          };

          thumb.appendChild(img); thumb.appendChild(del);
          imgContainer.appendChild(thumb);
        });

        const plus = document.createElement('div');
        plus.style.cssText = 'width:40px; height:60px; border:2px dashed rgba(255,215,0,0.15); border-radius:6px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#ffd700; font-size:1.2rem; opacity:0.6; flex-shrink:0;';
        plus.textContent = '+';
        plus.onclick = () => {
          state.gallery.selectedSeparator = `PREMIUM:${inst}`;
          state._galleryUploadCallback = () => {
            state.gallery.images = getImagesForDate(date);
            renderGallery();
          };
          if (typeof openDayUploadModal === 'function') openDayUploadModal(date);
        };
        imgContainer.appendChild(plus);
        thumbs.appendChild(instWrap);
      });
    }
  }

  // ── + Add blank image button ──────────────────────────────────────────────
  const btnWrap = document.createElement('div');
  btnWrap.className = 'gv2-thumb-wrap';
  btnWrap.style.cssText = 'display:flex; align-items:center; justify-content:center; background:var(--surface2); border:2px dashed var(--border2); border-radius:5px; width:calc(var(--thumb-panel-w,74px) - 60px); height:calc((var(--thumb-panel-w,74px) - 18px) * 0.62); cursor:pointer; font-size:1.5rem; color:var(--text2);';
  btnWrap.textContent = '+'; btnWrap.title = 'Add blank image';
  btnWrap.onclick = async () => {
    try {
      const cvs = document.createElement('canvas'); cvs.width = 1920; cvs.height = 1080;
      const c = cvs.getContext('2d'); c.fillStyle = '#ffffff'; c.fillRect(0, 0, 1920, 1080);
      cvs.toBlob(async (blob) => {
        if (!blob) return;
        try {
          const file = new File([blob], 'blank_page_' + Date.now() + '.png', { type: 'image/png' });
          const q = (state.gallery.selectedSeparator === 'NEWS') ? 0.25 : null;
          const rv = await imageService.uploadImage(file, q);
          if (rv.url) {
            const newUrl = rv.url;
            const selSep = state.gallery.selectedSeparator;
            const dayKey = date;
            if (dayKey && state.dayData[dayKey]) {
              const dData = state.dayData[dayKey];
              if (selSep === 'NEWS') { dData.newsImages = dData.newsImages || []; dData.newsImages.push(newUrl); }
              else if (selSep === 'CLOSE') { dData.closeImages = dData.closeImages || []; dData.closeImages.push(newUrl); }
              else if (selSep === 'CLOSE_GLOBAL') { dData.closeGlobalImages = dData.closeGlobalImages || []; dData.closeGlobalImages.push(newUrl); }
              else if (typeof selSep === 'number') {
                const selTrade = dayTrades[selSep];
                if (selTrade) { selTrade.images = selTrade.images || []; selTrade.images.push(newUrl); }
                else { dData.images = dData.images || []; dData.images.push(newUrl); }
              } else { dData.images = dData.images || []; dData.images.push(newUrl); }
            }
            state.gallery.images = state.gallery.images || [];
            state.gallery.images.push(newUrl);
            state.gallery.currentIndex = state.gallery.images.length - 1;
            await saveTrades();
            renderGallery();
            showToast('Blank image added at selected location', 'success');
          }
        } catch (err) { console.error('Failed blank page upload', err); }
      }, 'image/png');
    } catch (e) { console.error('Failed blank page generation', e); }
  };
  thumbs.appendChild(btnWrap);

  // ── Scroll restoration / auto-scroll to active ───────────────────────────
  if (state.gallery._skipScrollIntoView) {
    setTimeout(() => { if (thumbs) { thumbs.scrollTop = savedScrollTop; thumbs.scrollLeft = savedScrollLeft; } }, 0);
  } else {
    const doScroll = () => {
      if (!thumbs) return;
      const activeUrl  = state.gallery.images[state.gallery.currentIndex];
      const ownerTrade = typeof getOwnerTradeForImageUrl === 'function' ? getOwnerTradeForImageUrl(activeUrl) : null;
      const trades     = state.gallery.date ? getTradesForDate(state.gallery.date) : [];
      const tIdx       = ownerTrade ? trades.indexOf(ownerTrade) : -1;
      let targetEl     = null;
      if (tIdx !== -1 || state.gallery.selectedSeparator !== null) {
        const selIdx = typeof state.gallery.selectedSeparator === 'number' ? state.gallery.selectedSeparator : -1;
        if (selIdx !== -1 && (selIdx !== tIdx || state.gallery._forceScrollToSeparator))
          targetEl = thumbs.querySelector(`.gv2-thumb-separator[data-trade-idx="${selIdx}"]`);
        if (!targetEl && tIdx !== -1)
          targetEl = thumbs.querySelector(`.gv2-thumb-separator[data-trade-idx="${tIdx}"]`);
        if (!targetEl && tIdx !== -1) {
          const seps = thumbs.querySelectorAll('.gv2-thumb-separator');
          for (const s of seps) { if (s.textContent.includes('T' + (tIdx + 1))) { targetEl = s; break; } }
        }
      }
      if (!targetEl) {
        const activeThumb = thumbs.querySelector('.gv2-thumb.active');
        targetEl = activeThumb?.closest('.gv2-thumb-wrap');
      }
      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        const cr   = thumbs.getBoundingClientRect();
        if (cr.height > 0) thumbs.scrollTo({ top: thumbs.scrollTop + rect.top - cr.top - 10, behavior: 'smooth' });
      }
    };
    setTimeout(doScroll, 80);
    setTimeout(() => { doScroll(); state.gallery._forceScrollToSeparator = false; }, 250);
  }
  state.gallery._skipScrollIntoView = false;
  bindGalleryRubberbandAndPan(thumbs);
}
