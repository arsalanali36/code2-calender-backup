/**
 * @fileoverview events-gallery-c.js
 * @description Gallery dropdown + recording toolbar event bindings.
 */

function _bindGalleryDropdownEvents() {
  // ── Dropdown: Delete Image ────────────────────────────────────────────────
  document.getElementById('gv2-delete-img-btn')?.addEventListener('click', () => {
    document.getElementById('gallery-tools-panel')?.classList.remove('open');
    removeGalleryImageAt(state.gallery.currentIndex);
  });

  // ── Dropdown: Download Image ──────────────────────────────────────────────
  document.getElementById('gv2-download-btn')?.addEventListener('click', () => {
    document.getElementById('gallery-tools-panel')?.classList.remove('open');
    const url = (state.gallery.images || [])[state.gallery.currentIndex];
    if (!url) return;
    const a = document.createElement('a');
    a.href = resolveImageUrl(url);
    a.download = url.split('/').pop() || 'image';
    a.click();
  });

  // ── Dropdown: Upload & Replace current image ──────────────────────────────
  document.getElementById('gv2-replace-btn')?.addEventListener('click', () => {
    document.getElementById('gallery-tools-panel')?.classList.remove('open');
    const curIdx = state.gallery.currentIndex;
    const oldUrl = (state.gallery.images || [])[curIdx];
    if (!oldUrl) return;
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const file = inp.files[0];
      if (!file) return;
      try {
        const result = await imageService.uploadImage(file);
        if (!result || !result.url) return;
        const newUrl = result.url;
        state.gallery.images[curIdx] = newUrl;
        const owner = getOwnerTradeForImageUrl(oldUrl);
        if (owner) {
          const idx = (owner.images || []).indexOf(oldUrl);
          if (idx >= 0) owner.images[idx] = newUrl;
          if (owner.overlays?.[oldUrl]) { owner.overlays[newUrl] = owner.overlays[oldUrl]; delete owner.overlays[oldUrl]; }
          if (owner.marqueeBoxes?.[oldUrl]) { owner.marqueeBoxes[newUrl] = owner.marqueeBoxes[oldUrl]; delete owner.marqueeBoxes[oldUrl]; }
        } else if (state.gallery.date && state.dayData[state.gallery.date]) {
          const dd = state.dayData[state.gallery.date];
          const idx = (dd.images || []).indexOf(oldUrl);
          if (idx >= 0) dd.images[idx] = newUrl;
          if (dd.overlays?.[oldUrl]) { dd.overlays[newUrl] = dd.overlays[oldUrl]; delete dd.overlays[oldUrl]; }
        }
        await saveTrades();
        renderGallery();
        showToast('Image replaced', 'success');
      } catch (err) { console.error(err); showToast('Upload failed', 'error'); }
    };
    inp.click();
  });

  // ── Dropdown: Add Image After current ─────────────────────────────────────
  document.getElementById('gv2-add-after-btn')?.addEventListener('click', () => {
    document.getElementById('gallery-tools-panel')?.classList.remove('open');
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const file = inp.files[0];
      if (!file) return;
      try {
        const result = await imageService.uploadImage(file);
        if (!result || !result.url) return;
        const newUrl = result.url;
        const curIdx = state.gallery.currentIndex;
        const curUrl = (state.gallery.images || [])[curIdx];
        state.gallery.images.splice(curIdx + 1, 0, newUrl);
        const owner = getOwnerTradeForImageUrl(curUrl);
        if (owner) {
          if (!owner.images) owner.images = [];
          const idx = owner.images.indexOf(curUrl);
          if (idx >= 0) owner.images.splice(idx + 1, 0, newUrl);
          else owner.images.push(newUrl);
        } else if (state.gallery.date) {
          const dd = state.dayData[state.gallery.date] || {};
          state.dayData[state.gallery.date] = dd;
          if (!dd.images) dd.images = [];
          const idx = dd.images.indexOf(curUrl);
          if (idx >= 0) dd.images.splice(idx + 1, 0, newUrl);
          else dd.images.push(newUrl);
        }
        state.gallery.currentIndex = curIdx + 1;
        await saveTrades();
        renderGallery();
        showToast('Image added', 'success');
      } catch (err) { console.error(err); showToast('Upload failed', 'error'); }
    };
    inp.click();
  });

  // ── Dropdown: Copy Image to clipboard ────────────────────────────────────
  document.getElementById('gv2-copy-img-btn')?.addEventListener('click', async () => {
    document.getElementById('gallery-tools-panel')?.classList.remove('open');
    const url = (state.gallery.images || [])[state.gallery.currentIndex];
    if (!url) return;
    try {
      const resp = await fetch(resolveImageUrl(url));
      const blob = await resp.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      showToast('Image copied to clipboard', 'success');
    } catch (_) {
      try { await navigator.clipboard.writeText(resolveImageUrl(url)); showToast('Image URL copied', 'info'); }
      catch (__) { showToast('Copy not supported in this browser', ''); }
    }
  });

  // ── Dropdown: Share Link ──────────────────────────────────────────────────
  document.getElementById('gv2-share-link-btn')?.addEventListener('click', async () => {
    document.getElementById('gallery-tools-panel')?.classList.remove('open');
    const date = state.gallery.date;
    const url = (state.gallery.images || [])[state.gallery.currentIndex];
    if (!date || !url) return;
    const params = new URLSearchParams({ galleryDate: date, galleryImg: url });
    const link = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast('Link copied to clipboard', 'success');
    } catch (_) { showToast('Copy failed', ''); }
  });

  // ── Dropdown: Mark for Review ─────────────────────────────────────────────
  (function () {
    const REVIEW_TAG = '⚑ Review';
    const btn = document.getElementById('gv2-mark-review-btn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      document.getElementById('gallery-tools-panel')?.classList.remove('open');
      const curUrl = (state.gallery.images || [])[state.gallery.currentIndex];
      if (!curUrl) return;
      const owner = getOwnerTradeForImageUrl(curUrl);
      let wasMarked;
      if (owner) {
        const tags = getImageTagsForUrl(owner, curUrl) || [];
        wasMarked = tags.includes(REVIEW_TAG);
        setImageTagsForUrl(owner, curUrl, wasMarked ? tags.filter(t => t !== REVIEW_TAG) : [...tags, REVIEW_TAG]);
      } else if (state.gallery.date) {
        const tags = getDayImageTagsForUrl(state.gallery.date, curUrl) || [];
        wasMarked = tags.includes(REVIEW_TAG);
        setDayImageTagsForUrl(state.gallery.date, curUrl, wasMarked ? tags.filter(t => t !== REVIEW_TAG) : [...tags, REVIEW_TAG]);
      } else return;
      await saveTrades();
      renderGallery();
      showToast(wasMarked ? 'Review mark removed' : 'Marked for review', 'success');
    });
  })();


  // ── Recording Tools Toggle (Relocated to Tray) ──────────────────────────
  const recToggleBtn = document.getElementById('gv2-record-toggle-btn');
  const recBars = document.getElementById('gv2-tray-record-bars');
  const recSep = document.querySelector('.recording-sep');
  
  if (recToggleBtn && recBars) {
    const wasOpen = localStorage.getItem('tj_gv2RecOpen') === '1';
    const setRecState = (open) => {
      recBars.style.display = open ? 'flex' : 'none';
      if (recSep) recSep.style.display = open ? 'block' : 'none';
      recToggleBtn.classList.toggle('active', open);
      localStorage.setItem('tj_gv2RecOpen', open ? '1' : '0');
      if (open) {
        if (typeof renderAudioBar === 'function') renderAudioBar();
        if (typeof renderVideoBar === 'function') renderVideoBar();
      }
    };

    recToggleBtn.addEventListener('click', () => {
      const isOpen = recBars.style.display !== 'none';
      setRecState(!isOpen);
    });

    if (wasOpen) setRecState(true);
  }

}
