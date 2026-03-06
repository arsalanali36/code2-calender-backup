/**
 * @fileoverview annotate-ctx-menu.js
 * @description Right-click context menu for marquee boxes (rename tag, delete box, tag ops).
 * @exports _ensureMarqueeContextMenu, _showMarqueeContextMenu, _hideMarqueeContextMenu
 * @reads annotState.marqueeBoxes, state.tagGroups
 * @calls toggleTagOnSelectedMarquees, saveTrades, renderGallery
 */

// annotate-ctx-menu.js — Marquee context menu

// annotate-fabric.js (core) — Marquee context menu, startAnnotation,
//   stopAnnotation, _savePenOnlyRasterToState, _buildFabricSessionForAutoSave,
//   bindAnnotationCanvas. Depends on the 4 preceding annotate-*.js files.


// ─── J. Marquee context menu ──────────────────────────────────────────────────

let _mqCtxMenu = null, _mqCtxIdx = -1;

function _hideMarqueeContextMenu() {
  if (_mqCtxMenu) _mqCtxMenu.style.display = 'none';
  _mqCtxIdx = -1;
}

function _ensureMarqueeContextMenu() {
  if (_mqCtxMenu) return _mqCtxMenu;
  _mqCtxMenu = document.createElement('div');
  _mqCtxMenu.id = 'mq-context-menu';
  Object.assign(_mqCtxMenu.style, {
    position: 'fixed', zIndex: '99999', minWidth: '160px',
    background: 'var(--surface)', border: '1px solid var(--border2)',
    borderRadius: '8px', boxShadow: '0 8px 30px rgba(0,0,0,0.45)', padding: '8px', display: 'none'
  });
  _mqCtxMenu.innerHTML = `
    <button type="button" id="mq-ctx-del" class="gv2-ab-btn" style="width:100%;justify-content:flex-start">Delete Marquee</button>
    <button type="button" id="mq-ctx-dup" class="gv2-ab-btn" style="width:100%;justify-content:flex-start">Duplicate</button>
    <button type="button" id="mq-ctx-rebind" class="gv2-ab-btn" style="width:100%;justify-content:flex-start">Rebind</button>
    <div style="font-size:0.68rem;color:var(--text3);margin:8px 2px 4px">Marquee Color</div>
    <div style="display:flex;gap:6px;margin-bottom:8px">
      <button type="button" class="mq-ctx-color" data-color="#2ea043" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border2);background:#2ea043;cursor:pointer"></button>
      <button type="button" class="mq-ctx-color" data-color="#58a6ff" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border2);background:#58a6ff;cursor:pointer"></button>
      <button type="button" class="mq-ctx-color" data-color="#f85149" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border2);background:#f85149;cursor:pointer"></button>
    </div>
    <div style="font-size:0.68rem;color:var(--text3);margin:8px 2px 4px">Add Tag (Enter to apply)</div>
    <input type="text" id="mq-ctx-tag-inp" autocomplete="off" style="width:100%;box-sizing:border-box;padding:6px;font-size:12px;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:4px;margin-bottom:8px;" placeholder="Type tag..." />
    <button type="button" id="mq-ctx-close-tool" class="gv2-ab-btn" style="width:100%;justify-content:flex-start">Close Tool</button>
  `;
  document.body.appendChild(_mqCtxMenu);

  _mqCtxMenu.querySelector('#mq-ctx-del').addEventListener('click', () => {
    const targets = getSelectedMarqueeIndexes().includes(_mqCtxIdx) ? getSelectedMarqueeIndexes() : [_mqCtxIdx];
    [...targets].sort((a, b) => b - a).forEach(i => { if (i >= 0 && i < annotState.marqueeBoxes.length) annotState.marqueeBoxes.splice(i, 1); });
    annotState.selectedMarquees = []; annotState.selectedMarquee = Math.min(_mqCtxIdx, annotState.marqueeBoxes.length - 1);
    _renderMarqueeOnOverlayCanvas(); annotState.dirty = true; syncMarqueeBoxesShadow(); _hideMarqueeContextMenu();
  });

  _mqCtxMenu.querySelector('#mq-ctx-dup').addEventListener('click', () => {
    const targets = getSelectedMarqueeIndexes().includes(_mqCtxIdx) ? getSelectedMarqueeIndexes() : [_mqCtxIdx];
    const newIdxs = [];
    targets.forEach(i => {
      const src = annotState.marqueeBoxes[i]; if (!src) return;
      const mqC = _mqCanvas;
      const copy = { ...JSON.parse(JSON.stringify(src)), x: Math.max(0, Math.min((mqC?.width || 9999) - src.w, src.x + 16)), y: Math.max(0, Math.min((mqC?.height || 9999) - src.h, src.y + 16)) };
      annotState.marqueeBoxes.push(copy); newIdxs.push(annotState.marqueeBoxes.length - 1);
    });
    annotState.selectedMarquees = newIdxs; annotState.selectedMarquee = newIdxs.length ? newIdxs[newIdxs.length - 1] : -1;
    _renderMarqueeOnOverlayCanvas(); annotState.dirty = true; syncMarqueeBoxesShadow(); _hideMarqueeContextMenu();
  });

  _mqCtxMenu.querySelector('#mq-ctx-rebind').addEventListener('click', async () => {
    const mqC = _mqCanvas || document.createElement('canvas');
    const ctx = mqC.getContext('2d');
    await rebindCurrentImageOverlayToMarquee(ctx, mqC);
    _hideMarqueeContextMenu();
  });

  _mqCtxMenu.querySelectorAll('.mq-ctx-color').forEach(btn => {
    btn.addEventListener('click', () => {
      const targets = getSelectedMarqueeIndexes().includes(_mqCtxIdx) ? getSelectedMarqueeIndexes() : [_mqCtxIdx];
      targets.forEach(i => { if (i >= 0 && i < annotState.marqueeBoxes.length) annotState.marqueeBoxes[i].color = btn.dataset.color; });
      _renderMarqueeOnOverlayCanvas(); annotState.dirty = true; syncMarqueeBoxesShadow(); _hideMarqueeContextMenu();
    });
  });

  _mqCtxMenu.querySelector('#mq-ctx-close-tool').addEventListener('click', () => { setAnnotTool('pen'); _hideMarqueeContextMenu(); });

  document.addEventListener('click', e => {
    if (!_mqCtxMenu || _mqCtxMenu.style.display === 'none') return;
    if (!_mqCtxMenu.contains(e.target)) _hideMarqueeContextMenu();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') _hideMarqueeContextMenu(); });

  const mqInp = _mqCtxMenu.querySelector('#mq-ctx-tag-inp');
  mqInp.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = mqInp.value.trim();
      if (val) {
        const targets = getSelectedMarqueeIndexes().includes(_mqCtxIdx) ? getSelectedMarqueeIndexes() : [_mqCtxIdx];
        targets.forEach(i => { const b = annotState.marqueeBoxes[i]; if (b) { b.tags = b.tags || []; if (!b.tags.includes(val)) b.tags.push(val); } });
        if (!state.allTags.includes(val)) state.allTags.push(val);
        annotState.dirty = true; syncMarqueeBoxesShadow();
        _renderMarqueeOnOverlayCanvas();
        if (typeof renderGalleryImageTags === 'function') renderGalleryImageTags();
        if (typeof renderGalleryTagCloud === 'function') renderGalleryTagCloud();
        if (typeof renderGalleryTagsTray === 'function') renderGalleryTagsTray();
        if (typeof renderTable === 'function') renderTable();
      }
      mqInp.value = ''; _hideMarqueeContextMenu();
    } else if (e.key === 'Escape') { mqInp.value = ''; _hideMarqueeContextMenu(); }
  });
  return _mqCtxMenu;
}

function _showMarqueeContextMenu(clientX, clientY, idx) {
  const menu = _ensureMarqueeContextMenu();
  _mqCtxIdx = idx;
  menu.style.display = 'block';
  const inp = menu.querySelector('#mq-ctx-tag-inp'); if (inp) inp.value = '';
  const vw = window.innerWidth, vh = window.innerHeight;
  const rect = menu.getBoundingClientRect();
  menu.style.left = Math.max(6, Math.min(clientX, vw - rect.width - 6)) + 'px';
  menu.style.top = Math.max(6, Math.min(clientY, vh - rect.height - 6)) + 'px';
}
