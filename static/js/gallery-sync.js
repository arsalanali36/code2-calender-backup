/**
 * @fileoverview gallery-sync.js
 * @description Synchronizes gallery state across multiple windows/tabs using BroadcastChannel.
 */

const gallerySyncChannel = new BroadcastChannel('gallery_sync');

/**
 * Sends the current gallery state to other windows.
 */
function syncGalleryToOthers() {
  const modal = document.getElementById('gallery-modal');
  if (!modal || !modal.classList.contains('open')) return;

  const payload = {
    type: 'GALLERY_SYNC',
    date: state.gallery.date,
    index: state.gallery.currentIndex,
    images: state.gallery.images,
    sourceRow: state.gallery.sourceRow,
    _baseImages: state.gallery._baseImages,
    _baseDate: state.gallery._baseDate,
    _baseSourceRow: state.gallery._baseSourceRow,
    tagFilter: state.gallery.tagFilter || [],
    filterMode: state.gallery.filterMode || 'or'
  };
  gallerySyncChannel.postMessage(payload);
}

// Receive state changes from other windows
gallerySyncChannel.onmessage = (event) => {
  const data = event.data;
  if (data.type === 'GALLERY_SYNC') {
    const modal = document.getElementById('gallery-modal');
    // Only apply sync if our gallery is also open
    if (!modal || !modal.classList.contains('open')) return;

    // Update local state
    state.gallery.date = data.date;
    state.gallery.currentIndex = data.index;
    state.gallery.images = data.images;
    state.gallery.sourceRow = data.sourceRow;
    state.gallery._baseImages = data._baseImages;
    state.gallery._baseDate = data._baseDate;
    state.gallery._baseSourceRow = data._baseSourceRow;
    state.gallery.tagFilter = data.tagFilter;
    state.gallery.filterMode = data.filterMode;

    // Use a flag to prevent this render from triggering a sync back
    state._isSyncUpdate = true;
    state.gallery._skipFilterRescopeOnce = true;
    renderGallery();
    state._isSyncUpdate = false;
  }
};
