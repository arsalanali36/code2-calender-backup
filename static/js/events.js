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

    // If mouse is in viewport → Fabric.js canvas layer (coming soon)
    if (state._mouseInViewport) {
      showToast('Viewport paste: canvas layer will be available after Fabric.js integration', 'info');
      return;
    }
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
        const fd = new FormData();
        fd.append('image', file);
        const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.url) {
          state.dayData[targetDate].images.push(data.url);
          added++;
          // Add to current gallery view directly so it shows up instantly
          if (!state.gallery.images) state.gallery.images = [];
          state.gallery.images.push(data.url);
          if (state.gallery._baseImages) state.gallery._baseImages.push(data.url);
          state.gallery.currentIndex = state.gallery.images.length - 1;
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
  document.getElementById('month-select').value = state.month;
  document.getElementById('year-select').value = state.year;
  const vs = document.getElementById('view-select');
  if (vs) vs.value = state.calendarView;
  const ms = document.getElementById('month-select');
  if (ms) ms.disabled = state.calendarView === 'year';
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
