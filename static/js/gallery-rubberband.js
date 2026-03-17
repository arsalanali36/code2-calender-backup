// gallery-rubberband.js — thumb dock rubber-band selection + pan
// Called from renderGallery() after the thumb strip is built.

function bindGalleryRubberbandAndPan(thumbs) {
  if (!thumbs) return;

  // Remove previous listener to prevent accumulation across re-renders
  if (thumbs._rbHandler) thumbs.removeEventListener('mousedown', thumbs._rbHandler);

  let _rbStart = null;
  let _rbEl = thumbs.querySelector('.gv2-rubberband');
  if (!_rbEl) {
    _rbEl = document.createElement('div');
    _rbEl.className = 'gv2-rubberband';
    thumbs.style.position = 'relative';
    thumbs.appendChild(_rbEl);
  }

  const _rbMousedown = (e) => {
    if (e.button !== 0 || e.target.closest('.gv2-thumb-wrap')) return;
    e.preventDefault();

    // ── Ctrl+click on empty area → rubber-band selection ──
    if (e.ctrlKey || e.metaKey) {
      const dockRect = thumbs.getBoundingClientRect();
      _rbStart = { x: e.clientX - dockRect.left, y: e.clientY - dockRect.top + thumbs.scrollTop };
      _rbEl.style.display = 'block';
      _rbEl.style.left = _rbStart.x + 'px'; _rbEl.style.top = _rbStart.y + 'px';
      _rbEl.style.width = '0'; _rbEl.style.height = '0';
      const _rbMove = (me) => {
        const dr = thumbs.getBoundingClientRect();
        const EDGE = 50, SPEED = 12;
        if (me.clientY < dr.top + EDGE) thumbs.scrollTop -= SPEED;
        else if (me.clientY > dr.bottom - EDGE) thumbs.scrollTop += SPEED;
        const cx = me.clientX - dr.left;
        const cy = me.clientY - dr.top + thumbs.scrollTop;
        const x = Math.min(cx, _rbStart.x), y = Math.min(cy, _rbStart.y);
        _rbEl.style.left = x + 'px'; _rbEl.style.top = y + 'px';
        _rbEl.style.width = Math.abs(cx - _rbStart.x) + 'px';
        _rbEl.style.height = Math.abs(cy - _rbStart.y) + 'px';
      };
      const _rbUp = (ue) => {
        const rbRect = _rbEl.getBoundingClientRect();
        _rbEl.style.display = 'none';
        if (rbRect.width > 4 || rbRect.height > 4) {
          const savedScroll = thumbs.scrollTop;
          if (!ue.shiftKey && !ue.ctrlKey && !ue.metaKey) {
            if (state.gallery.selectedIndices) state.gallery.selectedIndices.clear();
            else state.gallery.selectedIndices = new Set();
          } else if (!state.gallery.selectedIndices) {
            state.gallery.selectedIndices = new Set();
          }
          thumbs.querySelectorAll('.gv2-thumb-wrap').forEach(wrap => {
            if (wrap.dataset.globalIdx === undefined) return;
            const wRect = wrap.getBoundingClientRect();
            const overlaps = !(rbRect.right < wRect.left || rbRect.left > wRect.right || rbRect.bottom < wRect.top || rbRect.top > wRect.bottom);
            if (overlaps) state.gallery.selectedIndices.add(parseInt(wrap.dataset.globalIdx));
          });
          renderGallery();
          setTimeout(() => { thumbs.scrollTop = savedScroll; }, 60);
        } else {
          if (!ue.shiftKey && !ue.ctrlKey && !ue.metaKey) {
            if (state.gallery.selectedIndices?.size > 0) { state.gallery.selectedIndices.clear(); renderGallery(); }
          }
        }
        _rbStart = null;
        document.removeEventListener('mousemove', _rbMove);
        document.removeEventListener('mouseup', _rbUp);
      };
      document.addEventListener('mousemove', _rbMove);
      document.addEventListener('mouseup', _rbUp);
      return;
    }

    // ── Plain left-click on empty area → hand-cursor pan (scroll) ──
    thumbs.style.cursor = 'grabbing';
    const panStartY = e.clientY;
    const panStartScroll = thumbs.scrollTop;
    const _panMove = (me) => {
      thumbs.scrollTop = panStartScroll - (me.clientY - panStartY);
    };
    const _panUp = () => {
      thumbs.style.cursor = '';
      document.removeEventListener('mousemove', _panMove);
      document.removeEventListener('mouseup', _panUp);
    };
    document.addEventListener('mousemove', _panMove);
    document.addEventListener('mouseup', _panUp);
  };

  // Show hand cursor when hovering empty area (no thumb under mouse)
  if (!thumbs._hoverHandler) {
    thumbs._hoverHandler = (e) => {
      if (!e.target.closest('.gv2-thumb-wrap')) thumbs.style.cursor = 'grab';
      else thumbs.style.cursor = '';
    };
    thumbs._hoverLeave = () => { thumbs.style.cursor = ''; };
    thumbs.addEventListener('mousemove', thumbs._hoverHandler);
    thumbs.addEventListener('mouseleave', thumbs._hoverLeave);
  }

  thumbs._rbHandler = _rbMousedown;
  thumbs.addEventListener('mousedown', _rbMousedown);
}
