/**
 * @fileoverview tag-pins.js
 * @description Tag Pin system — drop a tag chip onto the image to place a colored dot.
 *   Pins live inside #gallery-zoom-layer → they zoom/pan with the image automatically.
 *   Coordinates stored as % of zoom-layer's LOGICAL size (pre-transform).
 *   DOMMatrix inversion used so drop + drag work correctly at any zoom level.
 *
 *   Desktop: drag-drop tag chip → image | drag existing pin to move it
 *   iPad:    long-press chip (500ms) → tap image | drag pin to move
 *   Delete:  header 🗑 button → click/tap any pin
 */

// ── Color palette ─────────────────────────────────────────────────────────────

const TAG_PIN_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#ff6b9d', '#00d2ff', '#ffd700'
];

function getTagPinColor(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = ((h << 5) - h + tag.charCodeAt(i)) >>> 0;
  return TAG_PIN_COLORS[h % TAG_PIN_COLORS.length];
}

// ── Coordinate helper — screen → zoom-layer logical % ──────────────────────────
// gallery-zoom-layer has transform-origin: top left.
// So: screen_point = wrapper_origin + T * logical_point
// Therefore: logical_point = T_inv * (screen_point - wrapper_origin)

function _screenToLogical(sx, sy) {
  const zl = document.getElementById('gallery-zoom-layer');
  if (!zl) return null;

  // wrapper is zoom-layer's parent; it has no transform of its own
  const wrapper = zl.parentElement;
  if (!wrapper) return null;
  const wRect = wrapper.getBoundingClientRect();

  // Point in zoom-layer's parent coordinate space
  const relX = sx - wRect.left;
  const relY = sy - wRect.top;

  const transformStr = window.getComputedStyle(zl).transform;
  let lx = relX, ly = relY;

  if (transformStr && transformStr !== 'none') {
    try {
      const inv = new DOMMatrix(transformStr).inverse();
      const pt  = inv.transformPoint(new DOMPoint(relX, relY));
      lx = pt.x;
      ly = pt.y;
    } catch (_) { /* no transform or unsupported */ }
  }

  const w = zl.offsetWidth  || 1;
  const h = zl.offsetHeight || 1;
  return {
    x: Math.max(1, Math.min(99, (lx / w) * 100)),
    y: Math.max(1, Math.min(99, (ly / h) * 100))
  };
}

// ── Data access ───────────────────────────────────────────────────────────────

function getTagPinsForUrl(imgUrl, dateHint) {
  if (!imgUrl) return [];
  const trade = typeof getOwnerTradeForImageUrl === 'function'
    ? getOwnerTradeForImageUrl(imgUrl) : null;
  if (trade) return (trade.tagPins || {})[imgUrl] || [];
  const d = dateHint || (state.gallery && state.gallery.date) || '';
  if (d && state.dayData && state.dayData[d])
    return (state.dayData[d].tagPins || {})[imgUrl] || [];
  return [];
}

function setTagPinsForUrl(imgUrl, pins, dateHint) {
  if (!imgUrl) return;
  const trade = typeof getOwnerTradeForImageUrl === 'function'
    ? getOwnerTradeForImageUrl(imgUrl) : null;
  if (trade) {
    if (!trade.tagPins) trade.tagPins = {};
    if (pins.length === 0) delete trade.tagPins[imgUrl];
    else trade.tagPins[imgUrl] = pins;
    return;
  }
  const d = dateHint || (state.gallery && state.gallery.date) || '';
  if (!d) return;
  if (!state.dayData[d]) state.dayData[d] = {};
  if (!state.dayData[d].tagPins) state.dayData[d].tagPins = {};
  if (pins.length === 0) delete state.dayData[d].tagPins[imgUrl];
  else state.dayData[d].tagPins[imgUrl] = pins;
}

function _currentPinImgUrl() {
  return ((state.gallery && state.gallery.images) || [])[state.gallery.currentIndex] || '';
}

// ── Mutations ─────────────────────────────────────────────────────────────────

function _updateThumbBadge(imgUrl) {
  if (!imgUrl) return;
  const idx = (state.gallery && state.gallery.images) ? state.gallery.images.indexOf(imgUrl) : -1;
  if (idx < 0) return;
  const wrap = document.querySelector('#gallery-thumbs [data-global-idx="' + idx + '"]');
  if (!wrap) return;
  wrap.querySelectorAll('.tag-pin-thumb-badge').forEach(el => el.remove());
  const count = getTagPinsForUrl(imgUrl).length;
  if (count > 0) {
    const badge = document.createElement('div');
    badge.className = 'tag-pin-thumb-badge';
    badge.textContent = count;
    badge.title = count + ' tag pin' + (count > 1 ? 's' : '');
    wrap.appendChild(badge);
  }
}

function addTagPin(tag, xPct, yPct) {
  const imgUrl = _currentPinImgUrl();
  if (!imgUrl) return;
  const pins = [...getTagPinsForUrl(imgUrl)];
  pins.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    tag,
    x: Math.round(xPct * 10) / 10,
    y: Math.round(yPct * 10) / 10,
    color: getTagPinColor(tag)
  });
  setTagPinsForUrl(imgUrl, pins);

  // Also assign the tag to the image (like chip-click does) if not already assigned
  if (typeof getCurrentGalleryImageTagInfo === 'function') {
    const info = getCurrentGalleryImageTagInfo();
    if (info && !info.imageTags.includes(tag)) {
      const next = [...info.imageTags, tag];
      if (info.ownerType === 'trade' && info.trade && typeof setImageTagsForUrl === 'function')
        setImageTagsForUrl(info.trade, imgUrl, next);
      else if (info.ownerType === 'day' && info.dateKey && typeof setDayImageTagsForUrl === 'function')
        setDayImageTagsForUrl(info.dateKey, imgUrl, next);
      if (typeof normalizeAllTagsFromTrades === 'function') normalizeAllTagsFromTrades();
      if (typeof renderGalleryImageTags    === 'function') renderGalleryImageTags();
      if (typeof renderGalleryTagCloud     === 'function') renderGalleryTagCloud();
      if (typeof renderGalleryTagsTray     === 'function') renderGalleryTagsTray();
      if (typeof renderGalleryTagFilterPanel === 'function') renderGalleryTagFilterPanel();
    }
  }

  renderTagPins();
  _updateThumbBadge(imgUrl);
  if (typeof saveTrades === 'function') saveTrades();
  if (typeof showToast === 'function') showToast('📍 ' + tag, 'success');
}

function removeTagPin(pinId) {
  const imgUrl = _currentPinImgUrl();
  if (!imgUrl) return;
  const pins = getTagPinsForUrl(imgUrl).filter(p => p.id !== pinId);
  setTagPinsForUrl(imgUrl, pins);
  renderTagPins();
  _updateThumbBadge(imgUrl);
  if (typeof saveTrades === 'function') saveTrades();
}

function _movePinInData(pinId, newX, newY) {
  const imgUrl = _currentPinImgUrl();
  if (!imgUrl) return;
  const pins = getTagPinsForUrl(imgUrl);
  const pin  = pins.find(p => p.id === pinId);
  if (!pin) return;
  pin.x = Math.round(newX * 10) / 10;
  pin.y = Math.round(newY * 10) / 10;
  setTagPinsForUrl(imgUrl, pins);
  if (typeof saveTrades === 'function') saveTrades();
}

// ── Render ─────────────────────────────────────────────────────────────────────

function renderTagPins() {
  const zoomLayer = document.getElementById('gallery-zoom-layer');
  if (!zoomLayer) return;
  zoomLayer.querySelectorAll('.tag-pin-dot').forEach(el => el.remove());

  if (!state.gallery || !state.gallery._tagPinsVisible) return;

  const imgUrl = _currentPinImgUrl();
  if (!imgUrl) return;
  const pins = getTagPinsForUrl(imgUrl);
  if (!pins.length) return;

  const deleteMode = !!state.gallery._tagPinDeleteMode;

  pins.forEach(pin => {
    const dot = document.createElement('div');
    dot.className = 'tag-pin-dot' + (deleteMode ? ' tag-pin-delete-mode' : '');
    dot.style.left       = pin.x + '%';
    dot.style.top        = pin.y + '%';
    dot.style.background = pin.color;
    dot.style.boxShadow  = '0 0 0 2px #fff, 0 0 0 3px ' + pin.color + ', 0 4px 14px rgba(0,0,0,0.55)';
    dot.dataset.pinId    = pin.id;

    const tt = document.createElement('span');
    tt.className      = 'tag-pin-tooltip';
    tt.textContent    = pin.tag;
    tt.style.borderColor = pin.color;
    dot.appendChild(tt);

    if (deleteMode) {
      // Click → remove pin
      dot.addEventListener('click', e => {
        e.stopPropagation();
        removeTagPin(pin.id);
      });
    } else {
      // Drag → move pin (mouse + touch)
      _bindPinDrag(dot, pin);
    }

    zoomLayer.appendChild(dot);
  });
}

// ── Drag-to-move ──────────────────────────────────────────────────────────────

function _bindPinDrag(dot, pin) {
  let dragging  = false;
  let hasMoved  = false;

  const _clientXY = (e) => {
    if (e.touches     && e.touches.length)        return [e.touches[0].clientX,        e.touches[0].clientY];
    if (e.changedTouches && e.changedTouches.length) return [e.changedTouches[0].clientX, e.changedTouches[0].clientY];
    return [e.clientX, e.clientY];
  };

  const onStart = (e) => {
    if (e.button !== undefined && e.button !== 0) return; // left-click only
    e.stopPropagation();
    e.preventDefault();
    dragging = true;
    hasMoved = false;
    dot.classList.add('tag-pin-dragging');
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend',  onEnd);
  };

  const onMove = (e) => {
    if (!dragging) return;
    if (e.cancelable) e.preventDefault();
    hasMoved = true;
    const [cx, cy] = _clientXY(e);
    const coords = _screenToLogical(cx, cy);
    if (!coords) return;
    dot.style.left = coords.x + '%';
    dot.style.top  = coords.y + '%';
  };

  const onEnd = (e) => {
    if (!dragging) return;
    dragging = false;
    dot.classList.remove('tag-pin-dragging');
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup',   onEnd);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend',  onEnd);

    if (!hasMoved) return; // just a click, not a drag

    const [cx, cy] = _clientXY(e);
    const coords = _screenToLogical(cx, cy);
    if (coords) _movePinInData(pin.id, coords.x, coords.y);
  };

  dot.addEventListener('mousedown',  onStart);
  dot.addEventListener('touchstart', onStart, { passive: false });
}

// ── Drop zone (new tag chip → image) ─────────────────────────────────────────

function initTagPinDropZone() {
  const wrapper = document.getElementById('gallery-img-wrapper');
  if (!wrapper || wrapper._tagPinDropBound) return;
  wrapper._tagPinDropBound = true;

  const _getImg = () => document.getElementById('gallery-img');

  wrapper.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('text/plain')) return;
    e.preventDefault();
    _getImg()?.classList.add('tag-pin-drop-hover');
  });

  wrapper.addEventListener('dragleave', e => {
    if (!wrapper.contains(e.relatedTarget))
      _getImg()?.classList.remove('tag-pin-drop-hover');
  });

  wrapper.addEventListener('drop', e => {
    _getImg()?.classList.remove('tag-pin-drop-hover');
    const tag = e.dataTransfer.getData('text/plain');
    if (!tag || !tag.trim()) return;
    e.preventDefault();
    e.stopPropagation();
    const coords = _screenToLogical(e.clientX, e.clientY);
    if (coords) addTagPin(tag.trim(), coords.x, coords.y);
  });

  // Touch/iPad: click image when _pendingPinTag is set
  wrapper.addEventListener('click', e => {
    const pending = state.gallery && state.gallery._pendingPinTag;
    if (!pending) return;
    if (e.target.closest('.tag-pin-dot')) return;
    // Validate click is within the image element bounds
    const img = _getImg();
    if (!img) return;
    const r = img.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right ||
        e.clientY < r.top  || e.clientY > r.bottom) return;
    const coords = _screenToLogical(e.clientX, e.clientY);
    if (coords) addTagPin(pending, coords.x, coords.y);
    _clearPendingPinTag();
  });

  _initTagChipLongPress();
}

// ── Long-press on tag chips (iPad) ────────────────────────────────────────────

function _initTagChipLongPress() {
  const body = document.getElementById('gv2-tags-tray-body');
  if (!body || body._tagPinLongPressBound) return;
  body._tagPinLongPressBound = true;

  let _lpt = null;
  body.addEventListener('touchstart', e => {
    const chip = e.target.closest('.gv2-tt-tag-chip');
    if (!chip) return;
    const lbl = chip.querySelector('span');
    const tag = lbl ? lbl.textContent.trim() : '';
    if (!tag) return;
    _lpt = setTimeout(() => { _lpt = null; _togglePendingPinTag(tag); }, 480);
  }, { passive: true });
  body.addEventListener('touchend',  () => { clearTimeout(_lpt); _lpt = null; });
  body.addEventListener('touchmove', () => { clearTimeout(_lpt); _lpt = null; });
}

function _togglePendingPinTag(tag) {
  if (state.gallery._pendingPinTag === tag) {
    _clearPendingPinTag();
  } else {
    state.gallery._pendingPinTag = tag;
    document.querySelectorAll('.gv2-tt-tag-chip').forEach(c => {
      const lbl = c.querySelector('span');
      c.classList.toggle('tag-pin-pending', !!(lbl && lbl.textContent.trim() === tag));
    });
    _updatePinHeaderBtns();
    if (typeof showToast === 'function') showToast('📍 ' + tag + ' — tap image to place pin', 'info');
  }
}

function _clearPendingPinTag() {
  if (!state.gallery) return;
  state.gallery._pendingPinTag = null;
  document.querySelectorAll('.tag-pin-pending').forEach(c => c.classList.remove('tag-pin-pending'));
  _updatePinHeaderBtns();
}

// ── Header buttons ────────────────────────────────────────────────────────────

function initTagPinHeaderButtons() {
  if (!state.gallery) return;
  if (state.gallery._tagPinsVisible   === undefined) state.gallery._tagPinsVisible   = true;
  if (state.gallery._tagPinDeleteMode === undefined) state.gallery._tagPinDeleteMode = false;

  const visBtn = document.getElementById('tag-pin-vis-btn');
  const delBtn = document.getElementById('tag-pin-del-btn');

  if (visBtn && !visBtn._bound) {
    visBtn._bound = true;
    visBtn.addEventListener('click', () => {
      state.gallery._tagPinsVisible = !state.gallery._tagPinsVisible;
      if (!state.gallery._tagPinsVisible) state.gallery._tagPinDeleteMode = false;
      _updatePinHeaderBtns();
      renderTagPins();
    });
  }

  if (delBtn && !delBtn._bound) {
    delBtn._bound = true;
    delBtn.addEventListener('click', () => {
      if (!state.gallery._tagPinsVisible) return;
      state.gallery._tagPinDeleteMode = !state.gallery._tagPinDeleteMode;
      _updatePinHeaderBtns();
      renderTagPins();
    });
  }

  _updatePinHeaderBtns();
}

function _updatePinHeaderBtns() {
  if (!state.gallery) return;
  const v = state.gallery._tagPinsVisible;
  const d = state.gallery._tagPinDeleteMode;

  const visBtn = document.getElementById('tag-pin-vis-btn');
  const delBtn = document.getElementById('tag-pin-del-btn');

  if (visBtn) {
    visBtn.classList.toggle('tag-pin-btn-active', !!v);
    visBtn.title         = v ? 'Hide tag pins' : 'Show tag pins';
    visBtn.style.opacity = v ? '' : '0.45';
  }
  if (delBtn) {
    delBtn.classList.toggle('tag-pin-btn-active', !!d);
    delBtn.title             = d ? 'Exit delete mode' : 'Delete pins (click/tap to remove)';
    delBtn.style.color       = d ? '#e74c3c' : '';
    delBtn.style.borderColor = d ? 'rgba(231,76,60,0.6)' : '';
    delBtn.style.background  = d ? 'rgba(231,76,60,0.12)' : '';
    delBtn.style.opacity     = v ? '' : '0.45';
  }
}
