/**
 * @fileoverview csvlog-img.js
 * @description Image viewer, fullscreen zoom, drag-drop and clipboard paste for CSVLog modal.
 *   Split from csvlog.js to stay under 30 KB file-size limit.
 *   All functions are global scope — called from csvlog.js.
 */

/* ── Shared upload-to-trade helper ───────────────────────────────────────── */
// Used by viewer buttons, drag-drop and paste
async function _clUploadToTrade(files, trade, container) {
  const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (!arr.length) return;
  showToast('Uploading...', 'info');
  let added = 0;
  for (const file of arr) {
    try {
      const data = await imageService.uploadImage(file);
      if (data.url) { if (!trade.images) trade.images = []; trade.images.push(data.url); added++; }
    } catch (e) { showToast('Upload failed', 'error'); }
  }
  if (added) {
    _clImgIdx[_clTab] = trade.images.length - 1;
    await _clPersistNow();
    _renderImageViewer(container, trade);
    showToast(added + ' image' + (added > 1 ? 's' : '') + ' added', 'success');
  }
}

/* ── Drag-drop binding (called once per container) ───────────────────────── */
function _clBindImgDrop(container) {
  if (container._clDragBound) return;
  container._clDragBound = true;

  container.addEventListener('dragover', e => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    container.classList.add('cl-img-drop-target');
  });
  container.addEventListener('dragleave', e => {
    // Only remove if leaving the container itself (not a child)
    if (!container.contains(e.relatedTarget)) container.classList.remove('cl-img-drop-target');
  });
  container.addEventListener('drop', async e => {
    container.classList.remove('cl-img-drop-target');
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    e.preventDefault();
    if (_clTab < 0) return;
    const entry = _clDayTrades[_clTab];
    if (!entry) return;
    await _clUploadToTrade(files, entry.trade, container);
  });
}

/* ── Clipboard paste handler (registered on document while modal is open) ── */
async function _clImgPasteHandler(e) {
  if (!_clBackdrop || _clTab < 0) return;
  const t = e.target;
  if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName || '')) return;
  const items = e.clipboardData?.items;
  if (!items) return;
  const imgFiles = Array.from(items)
    .filter(it => it.type.startsWith('image/'))
    .map(it => it.getAsFile())
    .filter(Boolean);
  if (!imgFiles.length) return;
  e.preventDefault();
  const entry = _clDayTrades[_clTab];
  if (!entry) return;
  const container = document.querySelector('#cl-body .cl-img-col');
  if (!container) return;
  await _clUploadToTrade(imgFiles, entry.trade, container);
}

/* ── Image viewer (right column) ─────────────────────────────────────────── */
function _renderImageViewer(container, trade) {
  const images = trade.images || [];
  container.innerHTML = '';

  // Bind drag-drop once per container instance
  _clBindImgDrop(container);

  // Upload button (reused in both empty + nav states)
  const _mkUploadBtn = () => {
    const label = document.createElement('label');
    label.className = 'cl-img-upload-btn';
    label.title = 'Upload image(s)';
    label.innerHTML = '&#128247;';
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.style.display = 'none';
    inp.addEventListener('change', e => {
      if (e.target.files.length) _clUploadToTrade(e.target.files, trade, container);
      inp.value = '';
    });
    label.appendChild(inp);
    return label;
  };

  if (!images.length) {
    const empty = document.createElement('div');
    empty.className = 'cl-img-empty';
    empty.innerHTML = '<div>No images</div><div style="font-size:0.75rem;color:var(--text-muted)">Drop, paste, or</div>';
    empty.appendChild(_mkUploadBtn());
    container.appendChild(empty);
    return;
  }

  if (_clImgIdx[_clTab] === undefined) _clImgIdx[_clTab] = 0;
  const idx = Math.max(0, Math.min(_clImgIdx[_clTab], images.length - 1));
  _clImgIdx[_clTab] = idx;

  const src = images[idx];

  const viewer = document.createElement('div');
}

/* ── Drag-drop binding (called once per container) ───────────────────────── */
function _clBindImgDrop(container) {
  if (container._clDragBound) return;
  container._clDragBound = true;

  container.addEventListener('dragover', e => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    container.classList.add('cl-img-drop-target');
  });
  container.addEventListener('dragleave', e => {
    // Only remove if leaving the container itself (not a child)
    if (!container.contains(e.relatedTarget)) container.classList.remove('cl-img-drop-target');
  });
  container.addEventListener('drop', async e => {
    container.classList.remove('cl-img-drop-target');
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    e.preventDefault();
    if (_clTab < 0) return;
    const entry = _clDayTrades[_clTab];
    if (!entry) return;
    await _clUploadToTrade(files, entry.trade, container);
  });
}

/* ── Clipboard paste handler (registered on document while modal is open) ── */
async function _clImgPasteHandler(e) {
  if (!_clBackdrop || _clTab < 0) return;
  const t = e.target;
  if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName || '')) return;
  const items = e.clipboardData?.items;
  if (!items) return;
  const imgFiles = Array.from(items)
    .filter(it => it.type.startsWith('image/'))
    .map(it => it.getAsFile())
    .filter(Boolean);
  if (!imgFiles.length) return;
  e.preventDefault();
  const entry = _clDayTrades[_clTab];
  if (!entry) return;
  const container = document.querySelector('#cl-body .cl-img-col');
  if (!container) return;
  await _clUploadToTrade(imgFiles, entry.trade, container);
}

/* ── Image viewer (right column) ─────────────────────────────────────────── */
function _renderImageViewer(container, trade) {
  const images = trade.images || [];
  container.innerHTML = '';

  // Bind drag-drop once per container instance
  _clBindImgDrop(container);

  // Upload button (reused in both empty + nav states)
  const _mkUploadBtn = () => {
    const label = document.createElement('label');
    label.className = 'cl-img-upload-btn';
    label.title = 'Upload image(s)';
    label.innerHTML = '&#128247;';
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.style.display = 'none';
    inp.addEventListener('change', e => {
      if (e.target.files.length) _clUploadToTrade(e.target.files, trade, container);
      inp.value = '';
    });
    label.appendChild(inp);
    return label;
  };

  if (!images.length) {
    const empty = document.createElement('div');
    empty.className = 'cl-img-empty';
    empty.innerHTML = '<div>No images</div><div style="font-size:0.75rem;color:var(--text-muted)">Drop, paste, or</div>';
    empty.appendChild(_mkUploadBtn());
    container.appendChild(empty);
    return;
  }

  if (_clImgIdx[_clTab] === undefined) _clImgIdx[_clTab] = 0;
  const idx = Math.max(0, Math.min(_clImgIdx[_clTab], images.length - 1));
  _clImgIdx[_clTab] = idx;

  const src = images[idx];

  const viewer = document.createElement('div');
  viewer.className = 'cl-img-viewer';

  // Main image with zoom button overlay
  const imgWrap = document.createElement('div');
  imgWrap.className = 'cl-img-wrap';

  const img = document.createElement('img');
  img.className = 'cl-hero-img';
  img.src = resolveImageUrl(src);
  img.alt = 'Trade image';
  img.style.cursor = 'zoom-in';
  img.addEventListener('click', () => _openImgZoom(images, idx));

  const zoomBtn = document.createElement('button');
  zoomBtn.className = 'cl-zoom-btn';
  zoomBtn.title = 'Zoom image';
  zoomBtn.textContent = '\u2295';
  zoomBtn.addEventListener('click', e => { e.stopPropagation(); _openImgZoom(images, idx); });

  imgWrap.appendChild(img);
  imgWrap.appendChild(zoomBtn);
  viewer.appendChild(imgWrap);

  // Navigation row (always shown — has upload button)
  const nav = document.createElement('div');
  nav.className = 'cl-img-nav';

  const prev = document.createElement('button');
  prev.className = 'cl-nav-btn';
  prev.textContent = '\u2039';
  prev.disabled = idx === 0;
  prev.style.visibility = images.length > 1 ? '' : 'hidden';
  prev.addEventListener('click', () => {
    _clImgIdx[_clTab] = Math.max(0, idx - 1);
    _renderImageViewer(container, trade);
  });

  const counter = document.createElement('span');
  counter.className = 'cl-img-counter';
  counter.textContent = images.length > 1 ? (idx + 1) + ' / ' + images.length : '';

  const next = document.createElement('button');
  next.className = 'cl-nav-btn';
  next.textContent = '\u203a';
  next.disabled = idx >= images.length - 1;
  next.style.visibility = images.length > 1 ? '' : 'hidden';
  next.addEventListener('click', () => {
    _clImgIdx[_clTab] = Math.min(images.length - 1, idx + 1);
    _renderImageViewer(container, trade);
  });

  nav.appendChild(prev);
  nav.appendChild(counter);
  nav.appendChild(next);
  nav.appendChild(_mkUploadBtn());
  viewer.appendChild(nav);

  container.appendChild(viewer);
}

/* ── Image zoom overlay (fullscreen with left/right nav) ─────────────────── */
function _openImgZoom(images, startIdx) {
  document.getElementById('cl-zoom-overlay')?.remove();

  // Accept single src string for convenience
  if (typeof images === 'string') { images = [images]; startIdx = 0; }
  let cur = Math.max(0, Math.min(startIdx || 0, images.length - 1));

  const overlay = document.createElement('div');
  overlay.id = 'cl-zoom-overlay';
  overlay.className = 'cl-zoom-overlay';

  const img = document.createElement('img');
  img.className = 'cl-zoom-img';
  img.src = resolveImageUrl(images[cur]);
  img.addEventListener('click', e => e.stopPropagation());

  // Close button (top-right)
  const closeBtn = document.createElement('button');
  closeBtn.className = 'cl-zoom-close';
  closeBtn.textContent = '\u2715';
  closeBtn.addEventListener('click', () => overlay.remove());

  // Left / right arrows
  const prevBtn = document.createElement('button');
  prevBtn.className = 'cl-zoom-arrow cl-zoom-arrow-left';
  prevBtn.innerHTML = '&#8249;';
  prevBtn.addEventListener('click', e => { e.stopPropagation(); cur = Math.max(0, cur - 1); img.src = resolveImageUrl(images[cur]); _updateZoomState(); });

  const nextBtn = document.createElement('button');
  nextBtn.className = 'cl-zoom-arrow cl-zoom-arrow-right';
  nextBtn.innerHTML = '&#8250;';
  nextBtn.addEventListener('click', e => { e.stopPropagation(); cur = Math.min(images.length - 1, cur + 1); img.src = resolveImageUrl(images[cur]); _updateZoomState(); });

  const counter = document.createElement('div');
  counter.className = 'cl-zoom-counter';

  function _updateZoomState() {
    counter.textContent = images.length > 1 ? (cur + 1) + ' / ' + images.length : '';
    prevBtn.style.display = (images.length > 1 && cur > 0) ? 'flex' : 'none';
    nextBtn.style.display = (images.length > 1 && cur < images.length - 1) ? 'flex' : 'none';
  }
  _updateZoomState();

  overlay.appendChild(prevBtn);
  overlay.appendChild(img);
  overlay.appendChild(nextBtn);
  overlay.appendChild(closeBtn);
  overlay.appendChild(counter);
  overlay.addEventListener('click', () => overlay.remove());

  // Keyboard: ESC, arrow keys
  const onKey = e => {
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); }
    if (e.key === 'ArrowLeft'  && cur > 0) { cur--; img.src = resolveImageUrl(images[cur]); _updateZoomState(); }
    if (e.key === 'ArrowRight' && cur < images.length - 1) { cur++; img.src = resolveImageUrl(images[cur]); _updateZoomState(); }
  };
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('remove', () => document.removeEventListener('keydown', onKey));

  document.body.appendChild(overlay);
}
