/**
 * @fileoverview annotate-fabric.js
 * @description Export Fabric canvas to PNG overlay; merge annotation onto base image; canvas bind helper.
 * @exports saveAnnotOverlay, saveAnnotMerge, bindAnnotationCanvas
 * @reads fabricCanvas, annotState.imageUrl, state.gallery
 * @writes state._localOverlays, trade.overlays via setOverlayUrlForCurrentGalleryImage
 * @calls saveTrades, stopAnnotation, fetch /api/upload-image, fetch /api/overlay
 */

// annotate-fabric.js — saveAnnotOverlay, saveAnnotMerge, bindAnnotationCanvas

// ─── L. Overlay export ────────────────────────────────────────────────────────

async function saveAnnotOverlay() {
  if (!fabricCanvas) { showToast('Not in annotation mode', 'error'); return; }
  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  if (!imgUrl) { showToast('No image selected', 'error'); return; }

  const origVpt = fabricCanvas.viewportTransform.slice();
  fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

  fabricCanvas.lowerCanvasEl.toBlob(async blob => {
    fabricCanvas.setViewportTransform(origVpt);
    try {
      const data = await imageService.uploadImage(new File([blob], 'overlay.png', { type: 'image/png' }));
      if (!data.url) throw new Error();
      if (!setOverlayUrlForCurrentGalleryImage(data.url)) { showToast('Unable to map overlay', 'error'); return; }
      await saveTrades();
      annotState.dirty = false;
      stopAnnotation();
      showToast('Overlay saved!', 'success');
    } catch (e) { showToast('Overlay save failed', 'error'); }
  }, 'image/png');
}

async function saveAnnotMerge() {
  if (!fabricCanvas) { showToast('Not in annotation mode', 'error'); return; }
  const img = document.getElementById('gallery-img');
  const trade = getOwnerTradeForGalleryImage();
  const out = document.createElement('canvas');
  out.width = img.naturalWidth; out.height = img.naturalHeight;
  const ctx = out.getContext('2d');

  const origVpt = fabricCanvas.viewportTransform.slice();
  fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

  ctx.drawImage(img, 0, 0, out.width, out.height);
  ctx.drawImage(fabricCanvas.lowerCanvasEl, 0, 0, fabricCanvas.width, fabricCanvas.height, 0, 0, out.width, out.height);

  fabricCanvas.setViewportTransform(origVpt);

  out.toBlob(async blob => {
    try {
      const data = await imageService.uploadImage(new File([blob], 'merged.png', { type: 'image/png' }));
      if (!data.url) throw new Error();
      const imgs = state.gallery.images;
      imgs.push(data.url);
      if (trade) { if (!Array.isArray(trade.images)) trade.images = []; if (trade.images !== imgs) trade.images.push(data.url); }
      state.gallery.currentIndex = imgs.length - 1;
      await saveTrades();
      renderGallery();
      annotState.dirty = false;
      stopAnnotation();
      showToast('Merged image added to gallery!', 'success');
    } catch (e) { showToast('Merge save failed', 'error'); }
  }, 'image/png');
}

// ─── M. Init ─────────────────────────────────────────────────────────────────

function bindAnnotationCanvas() {
  // Ensure marquee context menu is created
  _ensureMarqueeContextMenu();

  // Main toolbar button listeners
  document.getElementById('gv2-annotate-btn').addEventListener('click', toggleAnnotation);
  const mqTopBtn = document.getElementById('gv2-marquee-btn');
  if (mqTopBtn) mqTopBtn.addEventListener('click', toggleMarquee);
  const textTopBtn = document.getElementById('gv2-text-btn');
  if (textTopBtn) textTopBtn.addEventListener('click', () => {
    if (annotState.active && annotState.tool === 'text') { toggleAnnotation(); return; }
    if (!annotState.active) { annotState.tool = 'text'; startAnnotation(); }
    else { setAnnotTool('text'); }
    document.getElementById('gv2-annot-bar')?.style.setProperty('display', 'none');
    document.getElementById('gv2-text-bar')?.style.setProperty('display', 'flex');
    document.getElementById('gv2-text-btn').classList.add('active');
    document.getElementById('gv2-annotate-btn').classList.remove('active');
    document.getElementById('gv2-marquee-btn').classList.remove('active');
  });

  // Annot bar tool buttons (arrow/rect/circle ab grouped button mein hain)
  ['pen', 'highlight', 'eraser', 'select'].forEach(tool => {
    const btn = document.getElementById('annot-' + tool);
    if (btn) btn.addEventListener('click', () => {
      preferredTool = tool;
      setAnnotTool(tool);
    });
  });

  // Shape group button: click = current shape use karo, right-click = picker kholo
  const shapeBtn = document.getElementById('annot-shape');
  const shapeMenu = document.getElementById('annot-shape-menu');
  if (shapeBtn && shapeMenu) {
    shapeBtn.addEventListener('click', () => {
      const tool = shapeBtn.dataset.shape || 'rect';
      preferredTool = tool;
      setAnnotTool(tool);
    });
    shapeBtn.addEventListener('contextmenu', e => {
      e.preventDefault();
      shapeMenu.classList.toggle('open');
    });
    shapeMenu.querySelectorAll('.annot-shape-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        const tool = opt.dataset.tool;
        preferredTool = tool;
        setAnnotTool(tool);
        shapeMenu.classList.remove('open');
      });
    });
    // Menu bahar click karne pe band karo
    document.addEventListener('click', e => {
      if (!shapeBtn.contains(e.target) && !shapeMenu.contains(e.target)) {
        shapeMenu.classList.remove('open');
      }
    });
  }

  // V (group select) button
  const vBtn = document.getElementById('annot-vselect');
  if (vBtn) vBtn.addEventListener('click', () => toggleMarqueeGroupSelect());

  // Color input
  document.getElementById('annot-color').addEventListener('input', e => {
    annotState.color = e.target.value;
    if (fabricCanvas && fabricCanvas.isDrawingMode && fabricCanvas.freeDrawingBrush) {
      if (annotState.tool === 'pen') fabricCanvas.freeDrawingBrush.color = e.target.value;
      else if (annotState.tool === 'highlight') fabricCanvas.freeDrawingBrush.color = e.target.value + '55';
    }
  });

  // Size slider
  document.getElementById('annot-size').addEventListener('input', e => {
    annotState.size = parseInt(e.target.value);
    document.getElementById('annot-size-label').textContent = e.target.value + 'px';
    updateAnnotBrushCursorVisual();
    if (fabricCanvas && fabricCanvas.isDrawingMode && fabricCanvas.freeDrawingBrush) {
      if (annotState.tool === 'pen') fabricCanvas.freeDrawingBrush.width = annotState.size;
      else if (annotState.tool === 'highlight') fabricCanvas.freeDrawingBrush.width = annotState.size * 5;
      else if (annotState.tool === 'eraser') fabricCanvas.freeDrawingBrush.width = annotState.size * 4;
    }
  });

  // Undo / Redo buttons
  document.getElementById('annot-undo').addEventListener('click', fabricUndo);
  const redoBtn = document.getElementById('annot-redo');
  if (redoBtn) redoBtn.addEventListener('click', fabricRedo);

  // Clear button
  document.getElementById('annot-clear').addEventListener('click', () => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    annotState.marqueeBoxes = []; annotState.selectedMarquee = -1; annotState.selectedMarquees = [];
    if (!state._marqueeBoxes) state._marqueeBoxes = {};
    state._marqueeBoxes[annotState.imageUrl] = [];
    if (state._penOnlyOverlays) delete state._penOnlyOverlays[annotState.imageUrl];
    _renderMarqueeOnOverlayCanvas();
    _pushFabricHistorySnapshot();
    annotState.dirty = true;
  });

  // Save buttons
  document.getElementById('annot-save-overlay').addEventListener('click', saveAnnotOverlay);
  document.getElementById('annot-save-merge').addEventListener('click', saveAnnotMerge);

  // Marquee bar
  const mqInp = document.getElementById('gv2-mq-tag-input');
  const mqAdd = document.getElementById('gv2-mq-add');
  const mqRebind = document.getElementById('gv2-mq-rebind');
  const mqDel = document.getElementById('gv2-mq-del');
  const addTagFromInput = () => {
    const tag = String(mqInp?.value || '').trim();
    if (!addTagToSelectedMarqueeBox(tag)) return;
    if (mqInp) mqInp.value = '';
    renderGalleryTagsTray();
  };
  if (mqAdd) mqAdd.addEventListener('click', addTagFromInput);
  if (mqInp) mqInp.addEventListener('keydown', e => { if (e.key === 'Enter') addTagFromInput(); });
  if (mqRebind) mqRebind.addEventListener('click', async () => {
    const mqC = _mqCanvas || document.createElement('canvas');
    await rebindCurrentImageOverlayToMarquee(mqC.getContext('2d'), mqC);
  });
  if (mqDel) mqDel.addEventListener('click', () => { if (annotState.active) toggleMarquee(); });

  // Text bar
  const updateActiveTextProps = (props) => {
    if (fabricCanvas) {
      const obj = fabricCanvas.getActiveObject();
      if (obj && obj.type === 'i-text') {
        if (obj.isEditing && obj.selectionStart !== obj.selectionEnd) {
          obj.setSelectionStyles(props);
        } else {
          obj.set(props);
        }
        fabricCanvas.requestRenderAll();
        _pushFabricHistorySnapshot();
        annotState.dirty = true;
      }
    }
  };

  const tbBold = document.getElementById('gv2-tb-bold');
  if (tbBold) tbBold.addEventListener('click', () => {
    tbBold.classList.toggle('active');
    updateActiveTextProps({ fontWeight: tbBold.classList.contains('active') ? 'bold' : 'normal' });
  });
  const tbItalic = document.getElementById('gv2-tb-italic');
  if (tbItalic) tbItalic.addEventListener('click', () => {
    tbItalic.classList.toggle('active');
    updateActiveTextProps({ fontStyle: tbItalic.classList.contains('active') ? 'italic' : 'normal' });
  });
  const tbAlign = document.getElementById('gv2-tb-align');
  if (tbAlign) {
    tbAlign.addEventListener('click', () => {
      let alignMode = 'left';
      if (tbAlign.classList.contains('align-center')) {
        tbAlign.classList.remove('align-center'); tbAlign.classList.add('align-right'); tbAlign.innerHTML = '&#8649;';
        alignMode = 'right';
      } else if (tbAlign.classList.contains('align-right')) {
        tbAlign.classList.remove('align-right'); tbAlign.innerHTML = '&#8801;';
        alignMode = 'left';
      } else {
        tbAlign.classList.add('align-center'); tbAlign.innerHTML = '&#8644;';
        alignMode = 'center';
      }
      updateActiveTextProps({ textAlign: alignMode });
    });
  }

  const tbSize = document.getElementById('gv2-tb-size');
  if (tbSize) {
    tbSize.addEventListener('change', () => updateActiveTextProps({ fontSize: parseInt(tbSize.value, 10) || 24 }));
    tbSize.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const val = parseInt(tbSize.value, 10) || 24;
      const nextVal = e.deltaY < 0 ? val + 1 : Math.max(1, val - 1);
      tbSize.value = nextVal;
      updateActiveTextProps({ fontSize: nextVal });
    }, { passive: false });
  }

  const tbList = document.getElementById('gv2-tb-list');
  if (tbList) {
    tbList.addEventListener('click', () => {
      const obj = fabricCanvas?.getActiveObject();
      if (obj && obj.type === 'i-text') {
        const textStr = obj.text || '';
        const lines = textStr.split('\n');
        let startLineIdx = 0;
        let endLineIdx = lines.length - 1;

        if (obj.isEditing) {
          const s = Math.min(obj.selectionStart || 0, obj.selectionEnd || 0);
          const e = Math.max(obj.selectionStart || 0, obj.selectionEnd || 0);
          startLineIdx = textStr.substring(0, s).split('\n').length - 1;
          endLineIdx = textStr.substring(0, e).split('\n').length - 1;
        }

        let hasBullet = true, hasNumber = true;
        for (let i = startLineIdx; i <= endLineIdx; i++) {
          if (!lines[i].startsWith('- ')) hasBullet = false;
          if (!lines[i].match(/^\d+\.\s/)) hasNumber = false;
        }

        let mode = 'bullet';
        if (hasBullet) mode = 'number';
        else if (hasNumber) mode = 'none';

        for (let i = startLineIdx; i <= endLineIdx; i++) {
          lines[i] = lines[i].replace(/^- /, '').replace(/^\d+\.\s/, '');
          if (mode === 'bullet') lines[i] = '- ' + lines[i];
          else if (mode === 'number') lines[i] = (i - startLineIdx + 1) + '. ' + lines[i];
        }

        obj.set({ text: lines.join('\n') });
        fabricCanvas.requestRenderAll();
        _pushFabricHistorySnapshot();
        annotState.dirty = true;
      } else {
        const curType = annotState.listType || 'none';
        annotState.listType = curType === 'none' ? 'bullet' : curType === 'bullet' ? 'number' : 'none';
        tbList.style.color = annotState.listType === 'none' ? '' : 'var(--blue)';
      }
    });
  }

  const tbColor = document.getElementById('gv2-tb-color');
  if (tbColor) {
    tbColor.value = '#000000'; // Default text color to black
    tbColor.addEventListener('input', () => updateActiveTextProps({ fill: tbColor.value }));
  }

  const tbFont = document.getElementById('gv2-tb-font');
  if (tbFont) tbFont.addEventListener('change', () => updateActiveTextProps({ fontFamily: tbFont.value }));

  // Delete key for selected Fabric objects
  document.addEventListener('keydown', e => {
    if (!annotState.active || !fabricCanvas) return;
    if (e.key === 'Escape') {
      const obj = fabricCanvas.getActiveObject();
      if (obj) {
        if (obj.type === 'i-text' && obj.isEditing) {
          obj.exitEditing();
        }
        fabricCanvas.discardActiveObject();
        fabricCanvas.requestRenderAll();
        return;
      }
      stopAnnotation();
      return;
    }
    if (!document.getElementById('gallery-modal')?.classList.contains('open')) return;
    if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); fabricUndo(); return; }
    if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); fabricRedo(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const obj = fabricCanvas.getActiveObject();
      if (obj && !obj.data?.isOverlayBase && !obj.data?.isBaked) {
        if (obj.type === 'i-text' && obj.isEditing) return; // Allow normal type/delete
        e.preventDefault();
        fabricCanvas.remove(obj);
        fabricCanvas.discardActiveObject();
        fabricCanvas.requestRenderAll();
        _pushFabricHistorySnapshot();
        annotState.dirty = true;
      }
    }
  });

  updateAnnotToolIcons();
}
