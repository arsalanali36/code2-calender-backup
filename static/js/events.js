/**
 * @fileoverview events.js
 * @description Main event bootstrapper: calls all sub-binders + handles gallery paste-to-upload.
 * @exports bindEvents, syncSelects, showGalleryExitConfirm
 * @reads state.gallery.{date,selectedSeparator,images,currentIndex}, state.dayData, state.trades
 * @writes state.dayData[].{images,closeImages}, state.trades[].images (paste routing)
 * @calls _bindUIEvents, _bindGalleryEvents, _bindSettingsEvents, _bindKeyboardEvents,
 *        saveTrades, render, showToast, fetch /api/upload-image
 */

function bindEvents() {
  _bindUIEvents();
  _bindGalleryEvents();
  _bindSettingsEvents();
  _bindKeyboardEvents();

  document.addEventListener('paste', async e => {
    const galleryOpen = document.getElementById('gallery-modal').classList.contains('open');
    if (!galleryOpen) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

    const items = e.clipboardData?.items;
    if (!items) return;
    const imgFiles = Array.from(items).filter(it => it.type.startsWith('image/')).map(it => it.getAsFile()).filter(Boolean);
    if (!imgFiles.length) return;

    e.preventDefault();
    const ctx = getCurrentGalleryPreserveContext();
    const targetDate = state.gallery.date || ctx.date;

    if (!targetDate) {
      showToast('Need a date context to paste image here', 'error');
      return;
    }

    showToast('Uploading pasted image...', '');
    let added = 0;

    if (!state.dayData[targetDate]) state.dayData[targetDate] = {};
    if (!state.dayData[targetDate].images) state.dayData[targetDate].images = [];

    for (const file of imgFiles) {
      try {
        const data = await imageService.uploadImage(file);
        if (data.url) {
          let addedToGroup = false;

          let targetDictToInsert = null;
          let insertArr = null;

          if (state.gallery.selectedSeparator !== undefined && state.gallery.selectedSeparator !== null) {
            const sel = state.gallery.selectedSeparator;
            if (sel === 'CLOSE') {
              if (!state.dayData[targetDate]) state.dayData[targetDate] = {};
              if (!state.dayData[targetDate].closeImages) state.dayData[targetDate].closeImages = [];
              state.dayData[targetDate].closeImages.push(data.url);
              addedToGroup = true;
            } else if (sel === 'OPEN') {
              if (!state.dayData[targetDate]) state.dayData[targetDate] = {};
              if (!state.dayData[targetDate].images) state.dayData[targetDate].images = [];
              state.dayData[targetDate].images.push(data.url);
              addedToGroup = true;
            } else if (typeof sel === 'number') {
              const tr = getTradesForDate(targetDate)[sel];
              if (tr) {
                tr.images = tr.images || [];
                tr.images.push(data.url);
                addedToGroup = true;
              }
            }
          }

          // currUrl must be declared here (outside nested blocks) to avoid ReferenceError
          const currUrl = (state.gallery.images || [])[state.gallery.currentIndex];

          if (!addedToGroup) {
            if (currUrl) {
              const ownerTrade = getOwnerTradeForImageUrl(currUrl);
              const ownerDay = state.dayData[targetDate];
              const findParent = (trade, d, targetUrl) => {
                if (trade?.subImages?.[targetUrl]) return { targetDict: trade.subImages, url: targetUrl, isParent: true };
                if (d?.subImages?.[targetUrl]) return { targetDict: d.subImages, url: targetUrl, isParent: true };
                for (const [p, subs] of Object.entries(trade?.subImages || {})) if (subs.includes(targetUrl)) return { targetDict: trade.subImages, url: p, isParent: false };
                for (const [p, subs] of Object.entries(d?.subImages || {})) if (subs.includes(targetUrl)) return { targetDict: d.subImages, url: p, isParent: false };
                return null;
              };
              const pInfo = findParent(ownerTrade, ownerDay, currUrl);
              if (pInfo) {
                pInfo.targetDict[pInfo.url].push(data.url);
                addedToGroup = true;
              } else if (ownerTrade) {
                ownerTrade.images = ownerTrade.images || [];
                ownerTrade.images.push(data.url);
                addedToGroup = true;
              }
            }
          }

          if (!addedToGroup) {
            if (!state.dayData[targetDate]) state.dayData[targetDate] = {};
            if (!state.dayData[targetDate].images) state.dayData[targetDate].images = [];
            state.dayData[targetDate].images.push(data.url);
          }

          added++;
          if (!state.gallery.images) state.gallery.images = [];

          if (addedToGroup) {
            const insertPos = state.gallery.images.indexOf(currUrl) + 1;
            if (insertPos > 0) {
              state.gallery.images.splice(insertPos, 0, data.url);
              state.gallery.currentIndex = insertPos;
            } else {
              state.gallery.images.push(data.url);
              state.gallery.currentIndex = state.gallery.images.length - 1;
            }
          } else {
            state.gallery.images.push(data.url);
            state.gallery.currentIndex = state.gallery.images.length - 1;
          }
          if (state.gallery._baseImages) state.gallery._baseImages.push(data.url);
        }
      } catch (err) { }
    }

    if (added > 0) {
      await saveTrades();
      render();
      renderGallery();
      updateGalleryDateArrows();
      showToast(`${added} image(s) pasted directly to ${targetDate}`, 'success');
    }
  });

  // Click outside thumbnail area → deselect all thumbnails
  document.addEventListener('mousedown', e => {
    const galleryOpen = document.getElementById('gallery-modal').classList.contains('open');
    if (!galleryOpen) return;
    if (document.getElementById('gv2-context-menu')?.contains(e.target)) return;
    const thumbs = document.getElementById('gallery-thumbs');
    if (thumbs && !thumbs.contains(e.target) && !e.target.closest('.gv2-thumb-wrap')) {
      if (state.gallery.selectedIndices?.size > 0) {
        state.gallery.selectedIndices.clear();
        thumbs.querySelectorAll('.selected-thumb').forEach(el => el.classList.remove('selected-thumb'));
      }
    }
  });

  // Track mouse position: viewport vs thumbnail dock (for paste routing)
  const _gvCenter = document.querySelector('.gv2-center');
  if (_gvCenter) {
    _gvCenter.addEventListener('mouseenter', () => { state._mouseInViewport = true; });
    _gvCenter.addEventListener('mouseleave', () => { state._mouseInViewport = false; });
  }

  bindZoomPan();
  bindAnnotationCanvas();
}

function syncSelects() {
  const m = document.getElementById('glob-month');
  if (m) m.value = state.month;
  const y = document.getElementById('glob-year');
  if (y) y.value = state.year;
  const v = document.getElementById('glob-view');
  if (v) v.value = state.calendarView;
  if (m && v) m.disabled = state.calendarView === 'year';
}

init();

function showGalleryExitConfirm() {
  if (document.getElementById('gallery-exit-confirm')) return;
  const overlay = document.createElement('div');
  overlay.id = 'gallery-exit-confirm';
  overlay.style.position = 'fixed';
  overlay.style.top = '0'; overlay.style.left = '0';
  overlay.style.width = '100%'; overlay.style.height = '100%';
  overlay.style.background = 'rgba(0,0,0,0.7)';
  overlay.style.zIndex = '999999';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center';

  const box = document.createElement('div');
  box.style.background = 'var(--bg2)';
  box.style.padding = '25px 30px';
  box.style.borderRadius = '8px';
  box.style.border = '1px solid var(--border)';
  box.style.textAlign = 'center';
  box.style.minWidth = '250px';
  box.innerHTML = '<p style="margin: 0 0 20px 0; font-size: 1.15rem; color: #fff;">Exit Gallery View?</p>';

  const btnYes = document.createElement('button');
  btnYes.className = 'btn btn-outline'; btnYes.textContent = 'Yes';
  btnYes.style.marginRight = '12px'; btnYes.style.outline = 'none';
  btnYes.style.minWidth = '75px';

  const btnNo = document.createElement('button');
  btnNo.className = 'btn btn-outline'; btnNo.textContent = 'No';
  btnNo.style.outline = 'none';
  btnNo.style.minWidth = '75px';

  box.appendChild(btnYes);
  box.appendChild(btnNo);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  let focusedIndex = 0; // 0 for Yes, 1 for No
  const btns = [btnYes, btnNo];

  const updateFocus = () => {
    btns.forEach((b, i) => {
      if (i === focusedIndex) {
        b.style.borderColor = '#58a6ff';
        b.style.boxShadow = '0 0 0 2px rgba(88,166,255,0.3)';
        b.style.color = '#58a6ff';
        b.focus();
      } else {
        b.style.borderColor = 'var(--border)';
        b.style.boxShadow = 'none';
        b.style.color = '';
      }
    });
  };

  const cleanup = () => {
    document.removeEventListener('keydown', keyHandler, true);
    overlay.remove();
    const gm = document.getElementById('gallery-modal');
    if (gm) gm.focus();
  };

  const closeGallery = () => {
    cleanup();
    document.getElementById('gallery-modal').classList.remove('open');
    unlockBodyScroll();
  };

  const keyHandler = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); focusedIndex = 0; updateFocus(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); focusedIndex = 1; updateFocus(); }
    else if (e.key === 'Enter') {
      e.preventDefault(); e.stopPropagation();
      if (focusedIndex === 0) closeGallery(); else cleanup();
    }
    else if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation(); cleanup();
    }
  };

  btnYes.addEventListener('click', closeGallery);
  btnNo.addEventListener('click', cleanup);

  document.addEventListener('keydown', keyHandler, true);
  setTimeout(updateFocus, 10);
}
