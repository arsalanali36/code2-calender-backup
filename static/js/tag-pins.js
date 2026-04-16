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
      else if (info.ownerType === 'pdf' && typeof setPdfPageTags === 'function')
        setPdfPageTags(info.pdfId, info.pageNo, next);
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
    tt.className      = 'tag-pin-tooltip' + (state.gallery._tagNotesAlwaysVisible ? ' always-visible' : '');
    tt.style.borderColor = pin.color;
    if (pin.note) {
      const tagLine = document.createElement('div');
      tagLine.style.cssText = 'font-weight:700; margin-bottom:4px;';
      tagLine.textContent = pin.tag;
      const noteLine = document.createElement('div');
      noteLine.style.cssText = 'color:rgba(255,220,100,0.9); font-size:0.78rem; max-width:200px; line-height:1.4;';
      noteLine.innerHTML = pin.note; // stored as HTML
      tt.appendChild(tagLine);
      tt.appendChild(noteLine);
    } else {
      tt.textContent = pin.tag;
    }
    dot.appendChild(tt);

    if (deleteMode) {
      // Click → remove pin
      dot.addEventListener('click', e => {
        e.stopPropagation();
        removeTagPin(pin.id);
      });
    } else {
      // Right-click → note editor
      dot.addEventListener('contextmenu', e => {
        e.preventDefault();
        e.stopPropagation();
        _openPinNoteEditor(pin, dot);
      });
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
  if (state.gallery._tagPinsVisible         === undefined) state.gallery._tagPinsVisible         = true;
  if (state.gallery._tagPinDeleteMode       === undefined) state.gallery._tagPinDeleteMode       = false;
  if (state.gallery._tagNotesAlwaysVisible  === undefined) state.gallery._tagNotesAlwaysVisible  = false;

  const mainBtn = document.getElementById('tag-pin-options-btn');
  const list    = document.getElementById('tag-pin-options-list');

  if (mainBtn && !mainBtn._bound) {
    mainBtn._bound = true;
    mainBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = list.style.display === 'block';
        document.querySelectorAll('.dropdown-menu').forEach(d => d.style.display = 'none');
        list.style.display = isOpen ? 'none' : 'block';
        _updatePinHeaderBtns();
    });
    document.addEventListener('click', () => { if(list) list.style.display = 'none'; });
    list?.addEventListener('click', e => e.stopPropagation());
  }

  const visItem   = document.getElementById('tag-pin-vis-toggle');
  const delItem   = document.getElementById('tag-pin-del-toggle');
  const notesItem = document.getElementById('tag-pin-notes-toggle');

  if (visItem && !visItem._bound) {
    visItem._bound = true;
    visItem.addEventListener('click', () => {
      state.gallery._tagPinsVisible = !state.gallery._tagPinsVisible;
      if (!state.gallery._tagPinsVisible) {
          state.gallery._tagPinDeleteMode = false;
          state.gallery._tagNotesAlwaysVisible = false;
      }
      _updatePinHeaderBtns();
      renderTagPins();
    });
  }

  if (delItem && !delItem._bound) {
    delItem._bound = true;
    delItem.addEventListener('click', () => {
      if (!state.gallery._tagPinsVisible) return;
      state.gallery._tagPinDeleteMode = !state.gallery._tagPinDeleteMode;
      _updatePinHeaderBtns();
      renderTagPins();
    });
  }

  if (notesItem && !notesItem._bound) {
    notesItem._bound = true;
    notesItem.addEventListener('click', () => {
        if (!state.gallery._tagPinsVisible) return;
        state.gallery._tagNotesAlwaysVisible = !state.gallery._tagNotesAlwaysVisible;
        _updatePinHeaderBtns();
        renderTagPins();
    });
  }

  _updatePinHeaderBtns();
}

// ── Pin note editor ───────────────────────────────────────────────────────────

function _openPinNoteEditor(pin, anchorEl) {
  const existing = document.getElementById('pin-note-popover');
  if (existing) existing.remove();

  const pop = document.createElement('div');
  pop.id = 'pin-note-popover';
  pop.style.cssText = 'position:fixed; z-index:9999; background:#1e2130; border:1px solid ' + pin.color + '; border-radius:8px; padding:10px; box-shadow:0 4px 24px rgba(0,0,0,0.7); width:300px;';

  // Title row
  const title = document.createElement('div');
  title.style.cssText = 'font-size:0.75rem; font-weight:700; margin-bottom:7px; display:flex; align-items:center; gap:6px;';
  const colorDot = document.createElement('span');
  colorDot.style.cssText = 'display:inline-block; width:10px; height:10px; border-radius:50%; flex-shrink:0; background:' + pin.color + ';';
  title.appendChild(colorDot);
  title.appendChild(document.createTextNode(pin.tag));
  pop.appendChild(title);

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'display:flex; gap:4px; margin-bottom:5px; flex-wrap:wrap;';
  const toolBtnStyle = 'background:#111420; color:#ccc; border:1px solid rgba(255,255,255,0.15); border-radius:4px; width:30px; height:28px; cursor:pointer; font-size:0.85rem; display:flex; align-items:center; justify-content:center; font-family:serif;';
  const tools = [
    { label: 'B',  title: 'Bold',      cmd: 'bold',        style: 'font-weight:900;' },
    { label: 'I',  title: 'Italic',    cmd: 'italic',      style: 'font-style:italic;' },
    { label: 'U',  title: 'Underline', cmd: 'underline',   style: 'text-decoration:underline;' },
    { label: '≡',  title: 'Bullets',   cmd: 'insertUnorderedList', style: '' },
    { label: '1.', title: 'Numbered',  cmd: 'insertOrderedList',   style: 'font-size:0.7rem; font-weight:700; font-family:monospace;' },
  ];
  tools.forEach(t => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = t.title;
    btn.innerHTML = `<span style="${t.style}">${t.label}</span>`;
    btn.style.cssText = toolBtnStyle;
    btn.addEventListener('mousedown', ev => {
      ev.preventDefault(); // don't blur editor
      document.execCommand(t.cmd, false, null);
      editor.focus();
    });
    toolbar.appendChild(btn);
  });

  // Divider
  const div1 = document.createElement('span');
  div1.style.cssText = 'width:1px; height:28px; background:rgba(255,255,255,0.1); margin:0 2px;';
  toolbar.appendChild(div1);

  // Font size buttons
  ['-', '+'].forEach(sym => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = sym === '+' ? 'Increase font size' : 'Decrease font size';
    btn.textContent = sym;
    btn.style.cssText = toolBtnStyle + 'font-weight:700; font-size:1rem;';
    btn.addEventListener('mousedown', ev => {
      ev.preventDefault();
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (range.collapsed) return;
      const span = document.createElement('span');
      const cur = parseFloat(window.getComputedStyle(editor).fontSize) || 13;
      span.style.fontSize = (cur + (sym === '+' ? 2 : -2)) + 'px';
      range.surroundContents(span);
      editor.focus();
    });
    toolbar.appendChild(btn);
  });

  pop.appendChild(toolbar);

  // Contenteditable editor
  const editor = document.createElement('div');
  editor.contentEditable = 'true';
  editor.style.cssText = 'min-height:100px; max-height:220px; overflow-y:auto; background:#111420; color:#e0e0e0; border:1px solid rgba(255,255,255,0.15); border-radius:5px; padding:9px 11px; font-size:1rem; outline:none; line-height:1.6; word-break:break-word;';
  editor.innerHTML = pin.note || '';
  if (!pin.note) editor.setAttribute('data-placeholder', 'Note likhein...');
  editor.addEventListener('keydown', ev => {
    // Stop all keys from bubbling to gallery handlers
    ev.stopPropagation();
    if (ev.key === 'Escape') { ev.preventDefault(); pop.remove(); }
  });
  editor.addEventListener('keyup',    ev => ev.stopPropagation());
  editor.addEventListener('keypress', ev => ev.stopPropagation());
  // Placeholder style via CSS injection (once)
  if (!document.getElementById('pin-editor-css')) {
    const s = document.createElement('style');
    s.id = 'pin-editor-css';
    s.textContent = '[contenteditable][data-placeholder]:empty::before{content:attr(data-placeholder);color:rgba(255,255,255,0.25);pointer-events:none;} #pin-note-popover ul,#pin-note-popover ol{margin:4px 0 4px 18px;padding:0;} #pin-note-popover li{margin:2px 0;}';
    document.head.appendChild(s);
  }
  pop.appendChild(editor);

  // Action buttons
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex; gap:6px; margin-top:8px; justify-content:flex-end;';

  const makeBtn = (text, css) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = text; b.style.cssText = css;
    return b;
  };
  const saveBtn   = makeBtn('Save',   'background:' + pin.color + '; color:#111; border:none; border-radius:5px; padding:5px 16px; cursor:pointer; font-weight:700; font-size:0.8rem;');
  const clearBtn  = makeBtn('Clear',  'background:transparent; color:rgba(255,100,100,0.8); border:1px solid rgba(255,100,100,0.4); border-radius:5px; padding:5px 10px; cursor:pointer; font-size:0.8rem;');
  const cancelBtn = makeBtn('Cancel', 'background:transparent; color:#aaa; border:1px solid rgba(255,255,255,0.15); border-radius:5px; padding:5px 10px; cursor:pointer; font-size:0.8rem;');

  const doSave = (html) => {
    const imgUrl = _currentPinImgUrl();
    if (!imgUrl) return;
    const pins = getTagPinsForUrl(imgUrl);
    const p = pins.find(p => p.id === pin.id);
    if (p) {
      const clean = html.replace(/<br\s*\/?>\s*$/i, '').trim();
      if (clean) p.note = clean; else delete p.note;
      setTagPinsForUrl(imgUrl, pins);
      if (typeof saveTrades === 'function') saveTrades();
      renderTagPins();
    }
    pop.remove();
  };

  const deleteBtn = makeBtn('🗑 Pin hatao', 'background:transparent; color:rgba(255,80,80,0.85); border:1px solid rgba(255,80,80,0.35); border-radius:5px; padding:5px 10px; cursor:pointer; font-size:0.78rem; margin-right:auto;');
  deleteBtn.addEventListener('click', () => {
    pop.remove();
    removeTagPin(pin.id);
    const imgUrl = _currentPinImgUrl();
    if (imgUrl) _updateThumbBadge(imgUrl);
  });

  saveBtn.addEventListener('click',   () => doSave(editor.innerHTML));
  clearBtn.addEventListener('click',  () => doSave(''));
  cancelBtn.addEventListener('click', () => pop.remove());

  btnRow.appendChild(deleteBtn);
  btnRow.appendChild(clearBtn);
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
  pop.appendChild(btnRow);
  document.body.appendChild(pop);

  // Position near the dot
  const rect = anchorEl.getBoundingClientRect();
  const pw = 300, ph = 220;
  let top  = rect.bottom + 8;
  let left = rect.left - pw / 2 + rect.width / 2;
  if (top  + ph > window.innerHeight) top  = rect.top - ph - 8;
  if (left + pw > window.innerWidth)  left = window.innerWidth - pw - 10;
  if (left < 6) left = 6;
  pop.style.top  = top  + 'px';
  pop.style.left = left + 'px';

  // Focus at end of content
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  setTimeout(() => {
    const onOut = ev => {
      if (!pop.contains(ev.target)) {
        // Auto-save on click-out
        doSave(editor.innerHTML);
        document.removeEventListener('mousedown', onOut);
      }
    };
    document.addEventListener('mousedown', onOut);
    
    // Also clean up listener if manually saved/cancelled/deleted
    const originalDoSave = doSave;
    doSave = (html) => {
      document.removeEventListener('mousedown', onOut);
      originalDoSave(html);
    };
    const originalCancel = cancelBtn.onclick; // wait, let's just add it
    cancelBtn.addEventListener('click', () => document.removeEventListener('mousedown', onOut));
    deleteBtn.addEventListener('click', () => document.removeEventListener('mousedown', onOut));
  }, 50);
}

function _updatePinHeaderBtns() {
  if (!state.gallery) return;
  const v = state.gallery._tagPinsVisible;
  const d = state.gallery._tagPinDeleteMode;
  const n = state.gallery._tagNotesAlwaysVisible;

  const mainBtn = document.getElementById('tag-pin-options-btn');
  if (mainBtn) {
    mainBtn.style.color = v ? '#ffd700' : 'rgba(255,255,255,0.4)';
    mainBtn.style.borderColor = v ? '#ffd700' : 'rgba(255,255,255,0.1)';
    if (d) { mainBtn.style.color = '#e74c3c'; mainBtn.style.borderColor = '#e74c3c'; }
  }

  const vInd = document.getElementById('pin-vis-indicator');
  const dInd = document.getElementById('pin-del-indicator');
  const nInd = document.getElementById('pin-notes-indicator');

  if (vInd) vInd.style.background = v ? 'var(--blue)' : '#444';
  if (dInd) dInd.style.background = d ? 'var(--red)'  : '#444';
  if (nInd) nInd.style.background = n ? 'var(--orange)' : '#444';
}
