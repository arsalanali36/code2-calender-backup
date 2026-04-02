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

function openGalleryForDate(dateStr, targetImgUrl = null) {
  const images = getImagesForDate(dateStr);
  if (!images.length) return;
  state.gallery.images = images; 
  state.gallery.currentIndex = 0; 
  state.gallery.tagFilter = [];
  
  if (targetImgUrl) {
    const raw = String(targetImgUrl || '').trim();
    const idx = images.findIndex(u => String(u) === raw || String(u).endsWith(raw) || raw.endsWith(String(u)));
    if (idx >= 0) state.gallery.currentIndex = idx;
    state.gallery.selectedIndices = new Set([state.gallery.currentIndex]);
  } else {
    state.gallery.selectedIndices = state.gallery.selectedIndices || new Set();
  }

  state.gallery.date = dateStr; 
  state.gallery.sourceRow = null;
  state.gallery._baseImages = [...images];
  state.gallery._baseDate = dateStr;
  state.gallery._baseSourceRow = null;
  
  lockBodyScroll();
  document.getElementById('gallery-modal').classList.add('open');
  renderGallery(); 
  updateGalleryDateArrows();
  renderGalleryTagCloud(); renderGalleryTagsTray(); renderGalleryTagFilterPanel();
  const wasTagsOpen = localStorage.getItem('tj_tagsTrayOpen') === '1';
  const tray1 = document.getElementById('gv2-tags-tray');
  const btn1 = document.getElementById('gv2-tags-btn');
  if (tray1) tray1.style.display = wasTagsOpen ? 'flex' : 'none';
  if (btn1) btn1.classList.toggle('active', wasTagsOpen);
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
  const wasTagsOpen = localStorage.getItem('tj_tagsTrayOpen') === '1';
  const tray2 = document.getElementById('gv2-tags-tray');
  const btn2 = document.getElementById('gv2-tags-btn');
  if (tray2) tray2.style.display = wasTagsOpen ? 'flex' : 'none';
  if (btn2) btn2.classList.toggle('active', wasTagsOpen);
  if (state.gallery.showTime) fetchImageTimesForGallery();
}

// ── Gallery Layout Toggle (classic ↔ new) ──────────────────────────────────
const _VP_KEY = 'tj_galleryLayout'; // 'classic' | 'new'

function openGalleryForDateWithPicker(dateStr) {
  const pref = localStorage.getItem(_VP_KEY);
  if (pref === 'classic') { window.open(`/gallery-classic?galleryDate=${dateStr}`, '_blank'); return; }
  if (pref === 'new')     { openGalleryForDate(dateStr); return; }
  _showViewerPicker(dateStr);
}


function _showViewerPicker(dateStr) {
  document.getElementById('gv2-viewer-picker')?.remove();

  const el = document.createElement('div');
  el.id = 'gv2-viewer-picker';
  el.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99999',
    'display:flex', 'align-items:center', 'justify-content:center',
    'background:rgba(0,0,0,0.45)', 'backdrop-filter:blur(3px)'
  ].join(';');

  el.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border2);border-radius:10px;
                padding:20px 24px;min-width:260px;box-shadow:0 8px 32px rgba(0,0,0,0.7);
                display:flex;flex-direction:column;gap:12px;text-align:center;">
      <div style="font-size:0.8rem;color:var(--text2);letter-spacing:0.04em;">Open ${dateStr} with</div>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button id="gvp-old" style="flex:1;padding:10px 0;border-radius:7px;
          border:1px solid var(--border2);background:var(--surface2);
          color:var(--text);font-size:0.88rem;cursor:pointer;">
          🖥 Old Gallery
        </button>
        <button id="gvp-new" style="flex:1;padding:10px 0;border-radius:7px;
          border:none;background:var(--blue);
          color:#fff;font-size:0.88rem;cursor:pointer;font-weight:600;">
          ✨ New Gallery
        </button>
      </div>
      <label style="display:flex;align-items:center;justify-content:center;gap:6px;
                    font-size:0.72rem;color:var(--text3);cursor:pointer;">
        <input type="checkbox" id="gvp-remember" style="cursor:pointer;accent-color:var(--blue);" />
        Remember my choice
      </label>
    </div>`;

  document.body.appendChild(el);

  const choose = (mode) => {
    if (document.getElementById('gvp-remember')?.checked)
      localStorage.setItem(_VP_KEY, mode);
    el.remove();
    if (mode === 'classic') {
      window.open(`/gallery-classic?galleryDate=${dateStr}`, '_blank');
    } else {
      openGalleryForDate(dateStr);
    }
  };

  document.getElementById('gvp-old').addEventListener('click', () => choose('classic'));
  document.getElementById('gvp-new').addEventListener('click', () => choose('new'));
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
}

// Reset gallery layout preference (browser console: resetViewerPref())
function resetViewerPref() { localStorage.removeItem(_VP_KEY); }

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
