/**
 * @fileoverview gallery-open.js
 * @description Opens gallery modal for a date or arbitrary image list; body scroll lock.
 * @exports openGalleryForDate, openGalleryDirect, openGalleryForDateWithTagFilter,
 *          lockBodyScroll, unlockBodyScroll
 * @reads state.trades, state.dayData
 * @writes state.gallery (images, date, currentIndex, sourceRow, tagFilter, selectedSeparator)
 * @calls renderGallery, lockBodyScroll
 */

// gallery-open.js — openGalleryForDate, openGalleryDirect, openGalleryForDateWithTagFilter, lock/unlockBodyScroll

function openGalleryForDate(dateStr) {
  const images = getImagesForDate(dateStr);
  if (!images.length) return;
  state.gallery.images = images; state.gallery.currentIndex = 0; state.gallery.tagFilter = [];
  state.gallery.date = dateStr; state.gallery.sourceRow = null;
  state.gallery._baseImages = [...images];
  state.gallery.selectedIndices = state.gallery.selectedIndices || new Set();
  state.gallery._baseDate = dateStr;
  state.gallery._baseSourceRow = null;
  lockBodyScroll();
  document.getElementById('gallery-modal').classList.add('open');
  renderGallery(); updateGalleryDateArrows();
  renderGalleryTagCloud(); renderGalleryTagsTray(); renderGalleryTagFilterPanel();
  const tray1 = document.getElementById('gv2-tags-tray');
  const btn1 = document.getElementById('gv2-tags-btn');
  if (tray1) tray1.style.display = 'flex';
  if (btn1) btn1.classList.add('active');
  if (state.gallery.showTime) fetchImageTimesForGallery();
}

function openGalleryDirect(images, startIndex, sourceRow = null) {
  state.gallery.images = images; state.gallery.currentIndex = startIndex; state.gallery.tagFilter = [];
  state.gallery.date = ''; state.gallery.sourceRow = sourceRow;
  state.gallery._baseImages = [...images];
  state.gallery.selectedIndices = state.gallery.selectedIndices || new Set();
  state.gallery._baseDate = '';
  state.gallery._baseSourceRow = sourceRow;
  lockBodyScroll();
  document.getElementById('gallery-modal').classList.add('open');
  renderGallery(); updateGalleryDateArrows();
  renderGalleryTagCloud(); renderGalleryTagsTray(); renderGalleryTagFilterPanel();
  const tray2 = document.getElementById('gv2-tags-tray');
  const btn2 = document.getElementById('gv2-tags-btn');
  if (tray2) tray2.style.display = 'flex';
  if (btn2) btn2.classList.add('active');
  if (state.gallery.showTime) fetchImageTimesForGallery();
}

function lockBodyScroll() {
  document.body.classList.add('modal-open');
}

function unlockBodyScroll() {
  if (document.querySelector('.modal-overlay.open')) return;
  document.body.classList.remove('modal-open');
}

function openGalleryForDateWithTagFilter(dateStr, tags = []) {
  const cleanTags = Array.from(new Set((tags || []).map(t => String(t || '').trim()).filter(Boolean)));
  openGalleryForDate(dateStr);
  state.gallery.tagFilter = cleanTags;
  const keep = {
    url: (state.gallery.images || [])[state.gallery.currentIndex] || '',
    date: normalizeDate(dateStr || ''),
    sourceRow: null
  };
  if (cleanTags.length) applyGalleryImageScopeByTagFilter(keep);
  renderGalleryTagCloud();
  renderGallery();
  updateGalleryDateArrows();
}
