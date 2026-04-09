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


  // ── DROPDOWN: Image Type Filter ───────────────────────────────────────────
  const filterTrigger = document.getElementById('gv2-filter-type-trigger');
  const filterMenu    = document.getElementById('gv2-filter-type-menu');
  if (filterTrigger && filterMenu) {
    filterTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = filterMenu.classList.contains('open');
      _closeAllTrayDropdowns();
      if (!isOpen) { 
        filterMenu.classList.add('open'); 
        filterTrigger.classList.add('active');
      }
    });
    filterMenu.addEventListener('click', e => e.stopPropagation());
  }

  // ── DROPDOWN: Recording Tools ─────────────────────────────────────────────
  const recTrigger = document.getElementById('gv2-record-toggle-btn');
  const recMenu    = document.getElementById('gv2-record-menu');
  if (recTrigger && recMenu) {
    recTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = recMenu.classList.contains('open');
      _closeAllTrayDropdowns();
      if (!isOpen) {
        recMenu.classList.add('open');
        recTrigger.classList.add('active');
      }
    });

    document.getElementById('gv2-menu-rec-video')?.addEventListener('click', () => {
      _closeAllTrayDropdowns();
      if (typeof startVideoRecording === 'function') startVideoRecording();
    });
    document.getElementById('gv2-menu-rec-audio')?.addEventListener('click', () => {
      _closeAllTrayDropdowns();
      if (typeof startAudioRecording === 'function') startAudioRecording();
    });
  }

  // Global click outside to close
  document.addEventListener('click', () => {
    _closeAllTrayDropdowns();
  });

  function _closeAllTrayDropdowns() {
    document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.gv2-record-trigger.active, .gv2-filter-trigger.active').forEach(b => b.classList.remove('active'));
    // Also handle traditional tools panel if needed
    document.getElementById('gallery-tools-panel')?.classList.remove('open');
  }

  // ── Date Picker Manual Trigger ─────────────────────────────────────────────
  const dateTrigger = document.getElementById('gv2-date-display-trigger');
  const dateInput   = document.getElementById('gallery-date-picker');
  if (dateTrigger && dateInput) {
    dateTrigger.addEventListener('click', () => {
      // Chrome/Edge/Safari support showPicker()
      if (typeof dateInput.showPicker === 'function') {
        dateInput.showPicker();
      } else {
        dateInput.focus();
        dateInput.click();
      }
    });
  }

  // ── Recording Progress Bars (Visible only during recording) ───────────────
  const recBars = document.getElementById('gv2-tray-record-bars');
  const recSep  = document.querySelector('.recording-sep');
  
  // Sync logic for when recording IS active (the progress bars)
  window.updateRecordingUISync = function() {
    const isVidRec = typeof _videoRecorder !== 'undefined' && _videoRecorder && _videoRecorder.state === 'recording';
    const isAudRec = typeof _audioRecorder !== 'undefined' && _audioRecorder && _audioRecorder.state === 'recording';
    const active = isVidRec || isAudRec;
    
    if (recBars) recBars.style.display = active ? 'flex' : 'none';
    if (recSep)  recSep.style.display = active ? 'block' : 'none';
  };
}
