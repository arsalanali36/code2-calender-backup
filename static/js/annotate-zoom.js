// ─── annotate-zoom.js ────────────────────────────────────────────────────────
// Zoom / pan state and handlers for the gallery image + annotation canvas.
// ─────────────────────────────────────────────────────────────────────────────

const zoom = { scale: 1, x: 0, y: 0 };
const drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 };

function resetZoom() { zoom.scale = 1; zoom.x = 0; zoom.y = 0; applyZoom(); }

function applyZoom() {
  const img = document.getElementById('gallery-img');
  const tf = `translate3d(${zoom.x}px, ${zoom.y}px, 0) scale(${zoom.scale})`;
  img.style.transform = tf;
  img.style.transformOrigin = 'top left';
  // Fabric wrapper OR plain canvas
  if (typeof fabricCanvas !== 'undefined' && fabricCanvas && fabricCanvas.wrapperEl) {
    fabricCanvas.wrapperEl.style.transform = tf;
    fabricCanvas.wrapperEl.style.transformOrigin = 'top left';
    fabricCanvas.wrapperEl.classList.toggle('dragging', !!drag.active);
  } else {
    const canvas = document.getElementById('annot-canvas');
    if (canvas) {
      canvas.style.transform = tf;
      canvas.style.transformOrigin = 'top left';
      canvas.classList.toggle('dragging', !!drag.active);
    }
  }
  // MQ overlay canvas follows same transform
  if (typeof _mqCanvas !== 'undefined' && _mqCanvas) {
    _mqCanvas.style.transform = tf;
    _mqCanvas.style.transformOrigin = 'top left';
  }
  if (zoom.scale > 1) { img.classList.add('zoomed'); img.classList.remove('dragging'); }
  else { img.classList.remove('zoomed', 'dragging'); }
}

function bindZoomPan() {
  const wrapper = document.getElementById('gallery-img-wrapper');
  const img = document.getElementById('gallery-img');

  wrapper.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newScale = Math.min(Math.max(zoom.scale * factor, 1), 8);
    if (newScale <= 1) {
      zoom.scale = 1; zoom.x = 0; zoom.y = 0;
    } else {
      const wRect = wrapper.getBoundingClientRect();
      const mouseX = e.clientX - wRect.left;
      const mouseY = e.clientY - wRect.top;
      const imgX = (mouseX - zoom.x) / zoom.scale;
      const imgY = (mouseY - zoom.y) / zoom.scale;
      zoom.x = mouseX - imgX * newScale;
      zoom.y = mouseY - imgY * newScale;
      zoom.scale = newScale;
    }
    applyZoom();
  }, { passive: false });

  wrapper.addEventListener('dblclick', () => resetZoom());

  wrapper.addEventListener('mousedown', e => {
    if (zoom.scale <= 1) return;
    if (annotState.active) return;
    const t = e.target;
    const validTarget = t && (
      t.id === 'gallery-img' || t.id === 'annot-canvas' ||
      t.id === 'gallery-img-wrapper' ||
      (t.classList && (t.classList.contains('lower-canvas') || t.classList.contains('upper-canvas')))
    );
    if (!validTarget) return;
    drag.active = true; drag.startX = e.clientX; drag.startY = e.clientY;
    drag.originX = zoom.x; drag.originY = zoom.y;
    img.classList.add('dragging');
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!drag.active) return;
    zoom.x = drag.originX + (e.clientX - drag.startX);
    zoom.y = drag.originY + (e.clientY - drag.startY);
    applyZoom();
  });
  document.addEventListener('mouseup', () => {
    if (drag.active) {
      drag.active = false;
      document.getElementById('gallery-img').classList.remove('dragging');
      applyZoom();
    }
  });

  let lastDist = 0, swipeTracking = false;
  let swipeStartX = 0, swipeStartY = 0, swipeLastX = 0, swipeLastY = 0;
  wrapper.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      swipeTracking = false; return;
    }
    if (e.touches.length === 1 && zoom.scale <= 1 && !annotState.active) {
      swipeTracking = true;
      swipeStartX = swipeLastX = e.touches[0].clientX;
      swipeStartY = swipeLastY = e.touches[0].clientY;
      return;
    }
    swipeTracking = false;
  }, { passive: true });
  wrapper.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      zoom.scale = Math.min(Math.max(zoom.scale * (dist / lastDist), 1), 8);
      lastDist = dist; applyZoom(); return;
    }
    if (swipeTracking && e.touches.length === 1) {
      swipeLastX = e.touches[0].clientX; swipeLastY = e.touches[0].clientY;
      const dx = swipeLastX - swipeStartX, dy = swipeLastY - swipeStartY;
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) e.preventDefault();
    }
  }, { passive: false });
  wrapper.addEventListener('touchend', () => {
    if (!swipeTracking) return;
    const dx = swipeLastX - swipeStartX, dy = swipeLastY - swipeStartY;
    swipeTracking = false;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
    navigateGallery(dx < 0 ? 1 : -1);
  }, { passive: true });
}
