# JS - Events (init, keys, ui, settings)
Consolidated code context for AI assistants.


## File: `static/js/events.js`
```js
/**
 * @fileoverview events.js
 * @description Main event bootstrapper: calls all sub-binders + handles gallery paste-to-upload.
 * @exports bindEvents, syncSelects, showGalleryExitConfirm
 * @reads state.gallery.{date,selectedSeparator,images,currentIndex}, state.dayData, state.trades
 * @writes state.dayData[].{images,closeImages}, state.trades[].images (paste routing)
 * @calls _bindUIEvents, _bindGalleryEvents, _bindSettingsEvents, _bindKeyboardEvents,
 *        saveTrades, render, showToast, fetch /api/upload-image
 */

function bindEvents() {
  _bindUIEvents();
  _bindGalleryEvents();
  _bindSettingsEvents();
  _bindKeyboardEvents();

  document.addEventListener('paste', async e => {
    const galleryOpen = document.getElementById('gallery-modal').classList.contains('open');
    if (!galleryOpen) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

    const items = e.clipboardData?.items;
    if (!items) return;
    const imgFiles = Array.from(items).filter(it => it.type.startsWith('image/')).map(it => it.getAsFile()).filter(Boolean);
    if (!imgFiles.length) return;

    e.preventDefault();
    const ctx = getCurrentGalleryPreserveContext();
    const targetDate = state.gallery.date || ctx.date;

    if (!targetDate) {
      showToast('Need a date context to paste image here', 'error');
      return;
    }

    showToast('Uploading pasted image...', '');
    let added = 0;

    if (!state.dayData[targetDate]) state.dayData[targetDate] = {};
    if (!state.dayData[targetDate].images) state.dayData[targetDate].images = [];

    for (const file of imgFiles) {
      try {
        const data = await imageService.uploadImage(file);
        if (data.url) {
          let addedToGroup = false;

          let targetDictToInsert = null;
          let insertArr = null;

          if (state.gallery.selectedSeparator !== undefined && state.gallery.selectedSeparator !== null) {
            const sel = state.gallery.selectedSeparator;
            if (sel === 'CLOSE') {
              if (!state.dayData[targetDate]) state.dayData[targetDate] = {};
              if (!state.dayData[targetDate].closeImages) state.dayData[targetDate].closeImages = [];
              state.dayData[targetDate].closeImages.push(data.url);
              addedToGroup = true;
            } else if (sel === 'CLOSE_GLOBAL') {
              if (!state.dayData[targetDate]) state.dayData[targetDate] = {};
              if (!state.dayData[targetDate].closeGlobalImages) state.dayData[targetDate].closeGlobalImages = [];
              state.dayData[targetDate].closeGlobalImages.push(data.url);
              addedToGroup = true;
            } else if (sel === 'OPEN') {
              if (!state.dayData[targetDate]) state.dayData[targetDate] = {};
              if (!state.dayData[targetDate].images) state.dayData[targetDate].images = [];
              state.dayData[targetDate].images.push(data.url);
              addedToGroup = true;
            } else if (typeof sel === 'number') {
              const tr = getTradesForDate(targetDate)[sel];
              if (tr) {
                tr.images = tr.images || [];
                tr.images.push(data.url);
                addedToGroup = true;
              }
            }
          }

          // currUrl must be declared here (outside nested blocks) to avoid ReferenceError
          const currUrl = (state.gallery.images || [])[state.gallery.currentIndex];

          if (!addedToGroup) {
            if (currUrl) {
              const ownerTrade = getOwnerTradeForImageUrl(currUrl);
              const ownerDay = state.dayData[targetDate];
              const findParent = (trade, d, targetUrl) => {
                if (trade?.subImages?.[targetUrl]) return { targetDict: trade.subImages, url: targetUrl, isParent: true };
                if (d?.subImages?.[targetUrl]) return { targetDict: d.subImages, url: targetUrl, isParent: true };
                for (const [p, subs] of Object.entries(trade?.subImages || {})) if (subs.includes(targetUrl)) return { targetDict: trade.subImages, url: p, isParent: false };
                for (const [p, subs] of Object.entries(d?.subImages || {})) if (subs.includes(targetUrl)) return { targetDict: d.subImages, url: p, isParent: false };
                return null;
              };
              const pInfo = findParent(ownerTrade, ownerDay, currUrl);
              if (pInfo) {
                pInfo.targetDict[pInfo.url].push(data.url);
                addedToGroup = true;
              } else if (ownerTrade) {
                ownerTrade.images = ownerTrade.images || [];
                ownerTrade.images.push(data.url);
                addedToGroup = true;
              }
            }
          }

          if (!addedToGroup) {
            if (!state.dayData[targetDate]) state.dayData[targetDate] = {};
            if (!state.dayData[targetDate].images) state.dayData[targetDate].images = [];
            state.dayData[targetDate].images.push(data.url);
          }

          added++;
          if (!state.gallery.images) state.gallery.images = [];

          if (addedToGroup) {
            const insertPos = state.gallery.images.indexOf(currUrl) + 1;
            if (insertPos > 0) {
              state.gallery.images.splice(insertPos, 0, data.url);
              state.gallery.currentIndex = insertPos;
            } else {
              state.gallery.images.push(data.url);
              state.gallery.currentIndex = state.gallery.images.length - 1;
            }
          } else {
            state.gallery.images.push(data.url);
            state.gallery.currentIndex = state.gallery.images.length - 1;
          }
          if (state.gallery._baseImages) state.gallery._baseImages.push(data.url);
        }
      } catch (err) { }
    }

    if (added > 0) {
      await saveTrades();
      render();
      renderGallery();
      updateGalleryDateArrows();
      showToast(`${added} image(s) pasted directly to ${targetDate}`, 'success');
    }
  });

  // Click outside thumbnail area → deselect all thumbnails
  document.addEventListener('mousedown', e => {
    const galleryOpen = document.getElementById('gallery-modal').classList.contains('open');
    if (!galleryOpen) return;
    if (document.getElementById('gv2-context-menu')?.contains(e.target)) return;
    const thumbs = document.getElementById('gallery-thumbs');
    if (thumbs && !thumbs.contains(e.target) && !e.target.closest('.gv2-thumb-wrap')) {
      if (state.gallery.selectedIndices?.size > 0) {
        state.gallery.selectedIndices.clear();
        thumbs.querySelectorAll('.selected-thumb').forEach(el => el.classList.remove('selected-thumb'));
      }
    }
  });

  // Track mouse position: viewport vs thumbnail dock (for paste routing)
  const _gvCenter = document.querySelector('.gv2-center');
  if (_gvCenter) {
    _gvCenter.addEventListener('mouseenter', () => { state._mouseInViewport = true; });
    _gvCenter.addEventListener('mouseleave', () => { state._mouseInViewport = false; });
  }

  bindZoomPan();
  bindAnnotationCanvas();
}

function syncSelects() {
  const m = document.getElementById('glob-month');
  if (m) m.value = state.month;
  const y = document.getElementById('glob-year');
  if (y) y.value = state.year;
  const v = document.getElementById('glob-view');
  if (v) v.value = state.calendarView;
  if (m && v) m.disabled = state.calendarView === 'year';
}

init();

function showGalleryExitConfirm() {
  if (document.getElementById('gallery-exit-confirm')) return;
  const overlay = document.createElement('div');
  overlay.id = 'gallery-exit-confirm';
  overlay.style.position = 'fixed';
  overlay.style.top = '0'; overlay.style.left = '0';
  overlay.style.width = '100%'; overlay.style.height = '100%';
  overlay.style.background = 'rgba(0,0,0,0.7)';
  overlay.style.zIndex = '999999';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center';

  const box = document.createElement('div');
  box.style.background = 'var(--bg2)';
  box.style.padding = '25px 30px';
  box.style.borderRadius = '8px';
  box.style.border = '1px solid var(--border)';
  box.style.textAlign = 'center';
  box.style.minWidth = '250px';
  box.innerHTML = '<p style="margin: 0 0 20px 0; font-size: 1.15rem; color: #fff;">Exit Gallery View?</p>';

  const btnYes = document.createElement('button');
  btnYes.className = 'btn btn-outline'; btnYes.textContent = 'Yes';
  btnYes.style.marginRight = '12px'; btnYes.style.outline = 'none';
  btnYes.style.minWidth = '75px';

  const btnNo = document.createElement('button');
  btnNo.className = 'btn btn-outline'; btnNo.textContent = 'No';
  btnNo.style.outline = 'none';
  btnNo.style.minWidth = '75px';

  box.appendChild(btnYes);
  box.appendChild(btnNo);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  let focusedIndex = 0; // 0 for Yes, 1 for No
  const btns = [btnYes, btnNo];

  const updateFocus = () => {
    btns.forEach((b, i) => {
      if (i === focusedIndex) {
        b.style.borderColor = '#58a6ff';
        b.style.boxShadow = '0 0 0 2px rgba(88,166,255,0.3)';
        b.style.color = '#58a6ff';
        b.focus();
      } else {
        b.style.borderColor = 'var(--border)';
        b.style.boxShadow = 'none';
        b.style.color = '';
      }
    });
  };

  const cleanup = () => {
    document.removeEventListener('keydown', keyHandler, true);
    overlay.remove();
    const gm = document.getElementById('gallery-modal');
    if (gm) gm.focus();
  };

  const closeGallery = () => {
    cleanup();
    document.getElementById('gallery-modal').classList.remove('open');
    unlockBodyScroll();
  };

  const keyHandler = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); focusedIndex = 0; updateFocus(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); focusedIndex = 1; updateFocus(); }
    else if (e.key === 'Enter') {
      e.preventDefault(); e.stopPropagation();
      if (focusedIndex === 0) closeGallery(); else cleanup();
    }
    else if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation(); cleanup();
    }
  };

  btnYes.addEventListener('click', closeGallery);
  btnNo.addEventListener('click', cleanup);

  document.addEventListener('keydown', keyHandler, true);
  setTimeout(updateFocus, 10);
}

```

## File: `static/js/events-keys.js`
```js
/**
 * @fileoverview events-keys.js
 * @description Global keyboard shortcut handler: ESC, Ctrl+Z/Y undo-redo, gallery nav keys.
 * @exports _bindKeyboardEvents
 * @reads annotState.active, state.gallery, shortcuts from settings
 * @calls fabricUndo, fabricRedo, navigateGallery, stopAnnotation, shortcutMatches, adjustAnnotSize
 */

// events-keys.js — Global keyboard handler (gallery hotkeys, annotation shortcuts,
//   calendar navigation, view toggles). Called by bindEvents() in events.js.

function _scrollGalleryContent(delta) {
  const gridView = document.getElementById('gv2-grid-view');
  if (gridView && gridView.style.display !== 'none') {
    const body = document.getElementById('gv2-grid-body');
    if (body) { body.scrollTop += delta; return; }
  }
  const thumbs = document.getElementById('gallery-thumbs');
  if (thumbs) thumbs.scrollTop += delta;
}

function _bindKeyboardEvents() {
  document.addEventListener('keydown', e => {
    const galleryOpen = document.getElementById('gallery-modal').classList.contains('open');
    const imgTagModalOpen = document.getElementById('img-tag-modal')?.classList.contains('open');
    const t = e.target;
    const typingInField = !!(
      t &&
      (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable || t.classList?.contains('upper-canvas'))
    );

    if (imgTagModalOpen) {
      if (e.key === 'Escape') closeGalleryImageTagManager();
      return;
    }

    // BLOCK ALL shortcuts if typing in any field, unless it's Escape
    if (typingInField && e.key !== 'Escape') {
        return;
    }

    if ((e.key === 'z' || e.key === 'Z') && e.ctrlKey && !e.shiftKey && !e.altKey) {
      if (typeof performGalleryUndo === 'function' && window.galleryUndoStack?.length > 0) {
        e.preventDefault();
        performGalleryUndo();
        return;
      }
        const undoBtn = document.getElementById('undo-del-btn');
        if (undoBtn) {
            e.preventDefault();
            undoBtn.click();
            return;
        }

        if (window._tagUndoStack && window._tagUndoStack.length > 0) {
            e.preventDefault();
            if (typeof restoreLastDeletedImageTag === 'function') {
                restoreLastDeletedImageTag();
                return;
            }
        }
    }

    const obsModalOpen = document.getElementById('obs-modal').classList.contains('open');
    if (obsModalOpen && !galleryOpen && !typingInField && (e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const dp = document.getElementById('obs-date-picker');
      dp.focus(); if (typeof dp.showPicker === 'function') dp.showPicker();
    }

    if (galleryOpen) {
      if (!e.ctrlKey && !e.altKey && !e.shiftKey && !typingInField) {
        if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          const tagsBtn = document.getElementById('gv2-tags-btn');
          if (tagsBtn) tagsBtn.click();
          return;
        }
        if (e.key === 'f' || e.key === 'F') {
          e.preventDefault();
          const filterBtn = document.getElementById('gallery-img-tag-filter-btn');
          if (filterBtn) filterBtn.click();
          return;
        }
        if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          const tray = document.getElementById('close-global-tray');
          if (tray) {
            const activeBtn = tray.querySelector('.cg-tray-btn.active') || tray.querySelector('.cg-tray-btn');
            if (activeBtn) activeBtn.focus();
          }
          return;
        }
        if (e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          const burger = document.getElementById('gv2-hamburger-btn');
          if (burger) burger.click();
          return;
        }
      }

      // If typing in a true input/textarea, block remaining shortcuts
      const isTrueInput = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (isTrueInput && e.key !== 'Escape') return;

      // Special case: upper-canvas (Fabric.js) is "typingInField" but needs arrow keys for gallery nav
      // when not editing text.
      if (typingInField && !isTrueInput && e.key !== 'Escape') {
          // Allow it to proceed to arrow handlers below
      } else if (typingInField && e.key !== 'Escape') {
          return;
      }

      // Arrow nav — must run AFTER true input check to allow text cursor movement
      if (!annotState.active && !e.ctrlKey && !e.altKey) {
        const fsEl = document.getElementById('fullscreen-viewer');
        if (fsEl && fsEl.style.display === 'flex' && typeof FullscreenViewer !== 'undefined') {
          if (e.shiftKey) {
            // Shift + Arrows -> Date navigation
            if (e.key === 'ArrowLeft')  { e.preventDefault(); FullscreenViewer.prevDay(); return; }
            if (e.key === 'ArrowRight') { e.preventDefault(); FullscreenViewer.nextDay(); return; }
          } else {
            // Regular Arrows -> Image navigation
            if (e.key === 'ArrowLeft')  { e.preventDefault(); FullscreenViewer.prevImg(); return; }
            if (e.key === 'ArrowRight') { e.preventDefault(); FullscreenViewer.nextImg(); return; }
            // ArrowUp/Down functionalities removed per user request
          }
          return; // Stop if FS is handled
        }

        if (e.shiftKey) {
          // Shift + Arrow → date navigation
          if (e.key === 'ArrowLeft')  { e.preventDefault(); navigateGalleryDate(-1); return; }
          if (e.key === 'ArrowRight') { e.preventDefault(); navigateGalleryDate(1);  return; }
        } else {
          // Regular Arrow → image navigation
          if (e.key === 'ArrowLeft')  { e.preventDefault(); navigateGallery(-1); return; }
          if (e.key === 'ArrowRight') { e.preventDefault(); navigateGallery(1);  return; }
          // ArrowUp/Down functionalities removed per user request
        }
      }

      if (typingInField && e.key === 'Escape') {
        // Agar text edit mode me escape dabaya, toh annotate-fabric apna select/exitEditing handle karega.
        // Hum gallery exit ye tools exit nahi karenge.
        return;
      }
      if (!e.ctrlKey && !e.altKey && (e.key === '<' || (e.key === ',' && e.shiftKey))) { e.preventDefault(); navigateGalleryDate(-1); return; }
      if (!e.ctrlKey && !e.altKey && (e.key === '>' || (e.key === '.' && e.shiftKey))) { e.preventDefault(); navigateGalleryDate(1); return; }

      if (shortcutMatches(e, state.shortcuts.mergeSave)) {
        e.preventDefault();
        if (annotState.active) saveAnnotMerge();
        return;
      }
      if (shortcutMatches(e, state.shortcuts.overlaySave)) {
        e.preventDefault();
        if (annotState.active) saveAnnotOverlay();
        return;
      }
      if (shortcutMatches(e, state.shortcuts.selectTool)) {
        e.preventDefault();
        if (e.repeat) return;
        if (annotState.active && annotState.tool === 'marquee') {
          toggleMarqueeGroupSelect();
        } else {
          if (!annotState.active) startAnnotation();
          setAnnotTool('select');
        }
        return;
      }
      if (shortcutMatches(e, state.shortcuts.pen)) {
        e.preventDefault();
        if (!annotState.active) startAnnotation();
        setAnnotTool('pen');
        return;
      }
      // 'b' is kept as a legacy alias for pen — not configurable separately
      if (!e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        if (!annotState.active) startAnnotation();
        setAnnotTool('pen');
        return;
      }
      if (shortcutMatches(e, state.shortcuts.eraser)) {
        e.preventDefault();
        if (!annotState.active) startAnnotation();
        setAnnotTool('eraser');
        return;
      }
      // Shortcuts moved to top of block
      // Explicitly empty Shift + F to prevent any other legacy behavior
      if (!e.ctrlKey && !e.altKey && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        return;
      }
      if (shortcutMatches(e, state.shortcuts.imageImport)) {
        e.preventDefault();
        if (state.gallery.date) document.getElementById('gallery-upload-btn').click();
        else showToast('Open date-based gallery first', '');
        return;
      }
      if (shortcutMatches(e, state.shortcuts.datePicker) || (!e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'd' || e.key === 'D'))) {
        e.preventDefault();
        const dp = document.getElementById('gallery-date-picker');
        dp.focus();
        if (typeof dp.showPicker === 'function') dp.showPicker();
        return;
      }
      if (shortcutMatches(e, state.shortcuts.imageTagManager)) {
        e.preventDefault();
        openGalleryImageTagManager();
        return;
      }
      if (shortcutMatches(e, state.shortcuts.deleteImage) && !annotState.active) {
        e.preventDefault();
        if (typeof removeGalleryImageAt === 'function')
          removeGalleryImageAt(state.gallery.currentIndex);
        return;
      }
      if (!e.ctrlKey && !e.altKey && !typingInField && e.key === ']') {
        e.preventDefault();
        if (annotState.active && ['pen', 'eraser'].includes(annotState.tool)) adjustAnnotSize(+1);
        return;
      }
      if (!e.ctrlKey && !e.altKey && !typingInField && e.key === '[') {
        e.preventDefault();
        if (annotState.active && ['pen', 'eraser'].includes(annotState.tool)) adjustAnnotSize(-1);
        return;
      }

      // --- Arrow Key Navigation for focused Remote Tray ---
      if (document.activeElement && document.activeElement.classList.contains('cg-tray-btn')) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          const tray = document.getElementById('close-global-tray');
          const btns = Array.from(tray.querySelectorAll('.cg-tray-btn'));
          const curIdx = btns.indexOf(document.activeElement);
          let nextIdx = curIdx;
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIdx = (curIdx + 1) % btns.length;
          else nextIdx = (curIdx - 1 + btns.length) % btns.length;
          
          if (btns[nextIdx]) {
            btns[nextIdx].focus();
            btns[nextIdx].click();
          }
          return;
        }
      }


      if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        if (typeof toggleGalleryGroupExpand === 'function' && state.gallery.images) {
          const currentImageUrl = state.gallery.images[state.gallery.currentIndex];
          if (currentImageUrl) toggleGalleryGroupExpand(currentImageUrl);
        }
        return;
      }

      // Ctrl+Up/Down — navigate between trade blocks (trade remote)
      if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        if (typeof navigateGalleryBlock === 'function')
          navigateGalleryBlock(e.key === 'ArrowDown' ? 1 : -1);
        return;
      }

      // Ctrl+Shift+L/R — move selected/current tile
      if (e.ctrlKey && e.shiftKey && !e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        if (typeof moveGalleryTile === 'function') moveGalleryTile(e.key === 'ArrowLeft' ? -1 : 1);
        return;
      }

      // Shift+Alt+L/R — select/deselect adjacent tile
      if (e.shiftKey && e.altKey && !e.ctrlKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const arr = state.gallery.images || [];
        const dir = e.key === 'ArrowLeft' ? -1 : 1;
        const newIdx = Math.max(0, Math.min(arr.length - 1, state.gallery.currentIndex + dir));
        if (!state.gallery.selectedIndices) state.gallery.selectedIndices = new Set();
        if (state.gallery.selectedIndices.has(newIdx)) state.gallery.selectedIndices.delete(newIdx);
        else state.gallery.selectedIndices.add(newIdx);
        state.gallery.currentIndex = newIdx;
        renderGallery();
        return;
      }

      // Alt+G — group all images
      if (e.altKey && !e.ctrlKey && !e.shiftKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        if (typeof groupAllGalleryImages === 'function') groupAllGalleryImages();
        return;
      }

      // Shift+G — ungroup all
      if (e.shiftKey && !e.ctrlKey && !e.altKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        if (typeof ungroupAllGalleryImages === 'function') ungroupAllGalleryImages();
        return;
      }

      // ContextMenu key — open context menu for current thumbnail
      if (e.key === 'ContextMenu') {
        e.preventDefault();
        const thumbs = document.getElementById('gallery-thumbs');
        if (!thumbs) return;
        const arr = state.gallery.images || [];
        if (!arr.length) return;
        if (!state.gallery.selectedIndices) state.gallery.selectedIndices = new Set();
        state.gallery.selectedIndices = new Set([state.gallery.currentIndex]);
        const activeThumb = thumbs.querySelector('.gv2-thumb.active');
        if (activeThumb) {
          const rect = activeThumb.getBoundingClientRect();
          if (typeof showGalleryContextMenu === 'function') showGalleryContextMenu(rect.left + rect.width / 2, rect.top);
        }
        return;
      }

      // Arrow keys handled at top of galleryOpen block (before typingInField guard)
      if (shortcutMatches(e, state.shortcuts.resetZoom)) { e.preventDefault(); resetZoom(); return; }
      if (shortcutMatches(e, state.shortcuts.annotToggle)) { e.preventDefault(); toggleAnnotation(); return; }

      if (shortcutMatches(e, state.shortcuts.eraser)) {
        e.preventDefault();
        if (!annotState.active) startAnnotation();
        setAnnotTool('eraser');
        return;
      }
      if (shortcutMatches(e, state.shortcuts.textTool)) {
        e.preventDefault();
        if (!annotState.active) {
          annotState.tool = 'text';
          startAnnotation();
        } else {
          setAnnotTool('text');
        }
        document.getElementById('gv2-annot-bar')?.style.setProperty('display', 'none');
        document.getElementById('gv2-marquee-bar')?.style.setProperty('display', 'none');
        document.getElementById('gv2-text-bar')?.style.setProperty('display', 'flex');
        document.getElementById('gv2-text-btn')?.classList.add('active');
        document.getElementById('gv2-annotate-btn')?.classList.remove('active');
        document.getElementById('gv2-marquee-btn')?.classList.remove('active');
        return;
      }
      if (shortcutMatches(e, state.shortcuts.marquee)) {
        e.preventDefault();
        e.stopPropagation();
        const mqBtn = document.getElementById('gv2-marquee-btn');
        if (mqBtn) mqBtn.click();
        return;
      }

      if (annotState.active) {
        if (annotState.tool === 'marquee' && !typingInField && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          // Let the marquee typing handler in annotate.js process this.
          return;
        }
      }

      if (shortcutMatches(e, state.shortcuts.layerPanel)) {
        if (annotState.active) return;
        e.preventDefault();
        if (typeof toggleLayerPanel === 'function') toggleLayerPanel();
        return;
      }
      if (shortcutMatches(e, state.shortcuts.showHeads)) {
        if (annotState.active) return;
        e.preventDefault();
        const toggleBtn = document.getElementById('gallery-show-heads-btn');
        if (toggleBtn) toggleBtn.click();
        return;
      }
      if (shortcutMatches(e, state.shortcuts.imageImport)) {
        if (annotState.active) return;
        e.preventDefault();
        const btn = document.getElementById('gallery-upload-btn');
        if (btn && btn.style.display !== 'none') btn.click();
        return;
      }
      if (shortcutMatches(e, state.shortcuts.leftPanel)) {
        if (annotState.active) return;
        e.preventDefault();
        const ulpPanel = document.getElementById('gv2-ulp-panel');
        if (ulpPanel) {
          ulpPanel.classList.contains('open')
            ? (typeof window._closeULP === 'function' && window._closeULP())
            : (typeof window._openULP  === 'function' && window._openULP());
        }
        return;
      }
      // Fullscreen (f) mapping removed to keep key free for Tag Filter

      if (e.key === 'c' && !e.shiftKey) {
        if (annotState.active) return;
        e.preventDefault();
        state.calendarMode = 'consolidated';
        updateCalendarModeButton(); renderShowHeads(); renderCalendar(); renderTable();
        if (typeof renderGalleryStats === 'function') renderGalleryStats();
        showToast('Consolidated Mode', 'success');
        return;
      }
      if ((e.key === 'C' || e.key === 'c') && e.shiftKey) {
        e.preventDefault();
        state.calendarMode = 'individual';
        updateCalendarModeButton(); renderShowHeads(); renderCalendar(); renderTable();
        if (typeof renderGalleryStats === 'function') renderGalleryStats();
        showToast('Individual Mode', 'success');
        return;
      }
      if (e.key === 'Escape') {
        const filterPanel = document.getElementById('gallery-img-tag-filter-panel');
        if (filterPanel && filterPanel.classList.contains('open')) {
          e.preventDefault();
          const btn = document.getElementById('gallery-img-tag-filter-btn');
          if (btn) btn.click();
          return;
        }
        if (state.gallery.tagFilter?.length) {
          e.preventDefault();
          state.gallery.tagFilter = [];
          applyGalleryImageScopeByTagFilter((state.gallery.images || [])[state.gallery.currentIndex] || '');
          renderGalleryTagCloud();
          renderGallery();
          return;
        }
        if (annotState.active) {
          if (typeof fabricCanvas !== 'undefined' && fabricCanvas) {
            const obj = fabricCanvas.getActiveObject();
            if (obj) { // If an object is selected (whether editing or not), pressing escape should just deselect it.
              if (obj.type === 'i-text' && obj.isEditing) {
                obj.exitEditing();
              }
              fabricCanvas.discardActiveObject();
              fabricCanvas.requestRenderAll();
              return; // Drop selection first, then return.
            }
          }
          stopAnnotation(); // If nothing is selected, pressing escape stops annotation.
          return;
        }
        if (document.getElementById('upload-modal')?.classList.contains('open')) {
          document.getElementById('upload-modal').classList.remove('open');
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        // Close FS viewer first if open, otherwise show exit confirm for gallery
        if (typeof FullscreenViewer !== 'undefined' && FullscreenViewer.isOpen) {
          FullscreenViewer.close();
        } else {
          showGalleryExitConfirm();
        }
      }
    }
    const anyModalOpen = ['obs-modal', 'add-col-modal', 'edit-col-modal', 'tag-modal', 'img-tag-modal', 'upload-modal', 'quote-modal']
      .some(id => document.getElementById(id)?.classList.contains('open'));
    const chartsModalOpen = !!document.querySelector('.clc-backdrop');
    if (!typingInField && !galleryOpen && !anyModalOpen && !chartsModalOpen && !e.ctrlKey && !e.altKey) {
      if (e.key === 'c' && !e.shiftKey) {
        e.preventDefault();
        state.calendarMode = 'consolidated';
        updateCalendarModeButton(); renderShowHeads(); renderCalendar(); renderTable();
      } else if ((e.key === 'C' || e.key === 'c') && e.shiftKey) {
        e.preventDefault();
        state.calendarMode = 'individual';
        updateCalendarModeButton(); renderShowHeads(); renderCalendar(); renderTable();
      } else if (e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        const tradeDates = state.trades
          .map(t => normalizeDate(extractDateFromTrade(t)))
          .filter(Boolean).sort();
        const target = tradeDates.length
          ? tradeDates[tradeDates.length - 1]
          : new Date().toISOString().slice(0, 10);
        openObsModal(target);
      } else if (e.key === 'i' && !e.shiftKey) {
        if (_clBackdrop) return;   // CSVLog modal open — let it handle 'i'
        e.preventDefault();
        const datesWImg = getDatesWithImages();
        if (datesWImg.length) openGalleryForDate(datesWImg[datesWImg.length - 1]);
      } else if (e.key === 'h' && !e.shiftKey) {
        e.preventDefault();
        // Toggle gallery hamburger if open, else toggle settings or sidebar if possible
        const burger = document.getElementById('gv2-hamburger-btn') || document.getElementById('sidebar-toggle');
        if (burger) burger.click();
      }
    }

    if (e.key === 'Escape') {
      document.body.classList.remove('calendar-full', 'table-full');
      document.getElementById('settings-overlay').classList.remove('open');
      if (document.getElementById('obs-modal').classList.contains('open')) saveObservation(true);
      state.addTagColumnMode = false;
      document.getElementById('add-col-modal').classList.remove('open');
      document.getElementById('edit-col-modal').classList.remove('open');
      if (document.getElementById('tag-modal').classList.contains('open')) closeTagPicker();
      if (document.getElementById('img-tag-modal').classList.contains('open')) closeGalleryImageTagManager();
      if (_notePop) closeNotePopup(true);
      document.getElementById('show-heads-panel').classList.remove('open');
      closeAllDropdowns('__none__');
      const pd = document.getElementById('profile-dropdown');
      if (pd) pd.classList.remove('open');
      document.querySelectorAll('.profile-inline-group').forEach(g => g.classList.remove('open'));
      const scm = document.getElementById('stats-config-modal');
      if (scm) scm.classList.remove('open');
      const shm = document.getElementById('show-heads-modal');
      if (shm) shm.classList.remove('open');
      const qm = document.getElementById('quote-modal');
      if (qm) qm.classList.remove('open');
      if (typeof closeCsvLogChartsModal === 'function' && document.querySelector('.clc-backdrop')) closeCsvLogChartsModal();
    }
  });
}

```

## File: `static/js/events-ui.js`
```js
/**
 * @fileoverview events-ui.js
 * @description Calendar navigation inputs, month/year pickers, view toggle, broker filter buttons.
 * @exports _bindUIEvents
 * @reads state.year, state.month, state.calendarMode, state.dateRange
 * @writes state.year, state.month, state.calendarMode, state.dateRange
 * @calls render, renderCalendar
 */

// events-ui.js — Calendar, table, column ops, date range event bindings

function _bindUIEvents() {
  const gm = document.getElementById('glob-month');
  if (gm) gm.addEventListener('change', e => {
    state.month = parseInt(e.target.value);
    render();
  });
  const gv = document.getElementById('glob-view');
  if (gv) gv.addEventListener('change', e => {
    state.calendarView = String(e.target.value || 'month');
    render();
  });
  const gy = document.getElementById('glob-year');
  if (gy) gy.addEventListener('change', e => {
    state.year = parseInt(e.target.value);
    render();
  });
  const gp = document.getElementById('glob-prev');
  if (gp) gp.addEventListener('click', () => {
    if (state.calendarView === 'year') {
      state.year--;
    } else {
      state.month--;
      if (state.month < 0) { state.month = 11; state.year--; }
    }
    syncSelects();
    render();
  });
  const gn = document.getElementById('glob-next');
  if (gn) gn.addEventListener('click', () => {
    if (state.calendarView === 'year') {
      state.year++;
    } else {
      state.month++;
      if (state.month > 11) { state.month = 0; state.year++; }
    }
    syncSelects();
    render();
  });
  const gt = document.getElementById('glob-today');
  if (gt) gt.addEventListener('click', () => {
    const now = new Date();
    state.month = now.getMonth();
    state.year = now.getFullYear();
    syncSelects();
    render();
  });
  document.getElementById('calendar-mode-btn').addEventListener('click', () => {
    state.calendarMode = state.calendarMode === 'consolidated' ? 'individual' : 'consolidated';
    updateCalendarModeButton();
    renderShowHeads();
    renderCalendar();
    renderTable();
    if (typeof renderVisualDashboard === 'function') renderVisualDashboard();
  });

  // Profile avatar dropdown
  const profileAvatarBtn = document.getElementById('profile-avatar-btn');
  const profileDropdown = document.getElementById('profile-dropdown');
  if (profileAvatarBtn && profileDropdown) {
    profileAvatarBtn.addEventListener('click', e => {
      e.stopPropagation();
      profileDropdown.classList.toggle('open');
    });
    profileDropdown.addEventListener('click', e => e.stopPropagation());
  }

  // Profile: Settings
  const profileSettingsBtn = document.getElementById('profile-settings-btn');
  if (profileSettingsBtn) profileSettingsBtn.addEventListener('click', () => {
    document.getElementById('settings-overlay').classList.add('open');
    if (profileDropdown) profileDropdown.classList.remove('open');
  });

  const profileQuoteBtn = document.getElementById('profile-quote-btn');
  if (profileQuoteBtn) profileQuoteBtn.addEventListener('click', () => {
    if (typeof openQuoteModal === 'function') openQuoteModal();
    if (profileDropdown) profileDropdown.classList.remove('open');
  });

  // Profile: Broker inline dropdown
  const brokerGroup = document.getElementById('profile-broker-group');
  const brokerTrigger = document.getElementById('profile-broker-trigger');
  if (brokerTrigger && brokerGroup) {
    brokerTrigger.addEventListener('click', e => {
      e.stopPropagation();
      const viewGroup = document.getElementById('profile-view-group');
      if (viewGroup) viewGroup.classList.remove('open');
      brokerGroup.classList.toggle('open');
    });
  }

  // Profile: View inline dropdown
  const viewGroup = document.getElementById('profile-view-group');
  const viewTrigger = document.getElementById('profile-view-trigger');
  if (viewTrigger && viewGroup) {
    viewTrigger.addEventListener('click', e => {
      e.stopPropagation();
      if (brokerGroup) brokerGroup.classList.remove('open');
      viewGroup.classList.toggle('open');
    });
  }

  // Profile: View items
  document.querySelectorAll('.profile-view-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.view;
      if (state.calendarMode !== v) {
        state.calendarMode = v;
        updateCalendarModeButton();
        renderShowHeads();
        renderCalendar();
        renderTable();
        if (typeof renderVisualDashboard === 'function') renderVisualDashboard();
      }
      if (viewGroup) viewGroup.classList.remove('open');
    });
  });

  document.getElementById('show-heads-btn').addEventListener('click', e => {
    e.stopPropagation(); openShowHeadsModal();
  });

  setupDropdown('file-dropdown-btn', 'file-dropdown-menu');
  setupDropdown('add-dropdown-btn', 'add-dropdown-menu');
  setupDropdown('col-vis-btn', 'col-vis-panel');
  setupDropdown('view-preset-btn', 'view-preset-panel');
  const statsBtn = document.getElementById('dashboard-stats-btn');
  if (statsBtn) statsBtn.addEventListener('click', e => { e.stopPropagation(); openStatsConfigModal(); });

  document.addEventListener('click', () => {
    closeAllDropdowns('__none__');
    document.getElementById('show-heads-panel').classList.remove('open');
    if (profileDropdown) profileDropdown.classList.remove('open');
    document.querySelectorAll('.profile-inline-group').forEach(g => g.classList.remove('open'));
  });
  document.getElementById('show-heads-panel').addEventListener('click', e => e.stopPropagation());
  document.getElementById('col-vis-panel').addEventListener('click', e => e.stopPropagation());
  document.getElementById('view-preset-panel').addEventListener('click', e => e.stopPropagation());
  const dashStatsMenu = document.getElementById('dashboard-stats-menu');
  if (dashStatsMenu) dashStatsMenu.addEventListener('click', e => e.stopPropagation());

  setupDropdown('tag-filter-btn', 'tag-filter-panel');
  document.querySelectorAll('.broker-filter-item').forEach(btn => {
    btn.addEventListener('click', () => {
      state.brokerFilter = String(btn.dataset.broker || 'both').toLowerCase();
      updateBrokerFilterButton();
      renderTable();
      renderCalendar();
      renderDashboard();
      closeAllDropdowns('__none__');
      document.querySelectorAll('.profile-inline-group').forEach(g => g.classList.remove('open'));
    });
  });
  document.getElementById('tag-filter-panel').addEventListener('click', e => e.stopPropagation());
  document.getElementById('tag-picker-inp').addEventListener('input', e => updateTagPickerList(e.target.value));
  document.getElementById('tag-picker-inp').addEventListener('keydown', e => {
    if (e.key === 'Escape') closeTagPicker();
    if (e.key === 'Enter') {
      const q = e.target.value.trim();
      if (q) {
        if (!state.allTags.some(t => t.toLowerCase() === q.toLowerCase())) state.allTags.push(q);
        if (_tagPickerRow !== null) {
          const arr = ensureTagArray(state.trades[_tagPickerRow], _tagPickerCol);
          if (!arr.includes(q)) arr.push(q);
          if (_tagPickerCol === 'Tags') state.trades[_tagPickerRow].tags = [...arr];
          saveTrades(); renderTable(); renderTagFilterPanel();
        }
        e.target.value = ''; updateTagPickerList('');
      }
    }
  });
  document.getElementById('tag-picker-close-btn').addEventListener('click', closeTagPicker);
  document.getElementById('tag-picker-close-x').addEventListener('click', closeTagPicker);
  document.getElementById('tag-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeTagPicker();
  });

  document.getElementById('import-btn').addEventListener('click', () => document.getElementById('excel-input').click());
  document.getElementById('excel-input').addEventListener('change', e => { if (e.target.files[0]) importExcel(e.target.files[0]); e.target.value = ''; });
  document.getElementById('import-raw-csv-btn').addEventListener('click', () => document.getElementById('raw-csv-input').click());
  document.getElementById('raw-csv-input').addEventListener('change', e => { if (e.target.files[0]) importRawCsv(e.target.files[0]); e.target.value = ''; });
  document.getElementById('import-historical-csv-btn').addEventListener('click', () => document.getElementById('historical-csv-input').click());
  document.getElementById('historical-csv-input').addEventListener('change', e => { if (e.target.files[0]) importHistoricalCsv(e.target.files[0]); e.target.value = ''; });
  document.getElementById('import-dhan-csv-btn').addEventListener('click', () => document.getElementById('dhan-csv-input').click());
  document.getElementById('dhan-csv-input').addEventListener('change', e => { if (e.target.files[0]) importDhanCsv(e.target.files[0]); e.target.value = ''; });
  document.getElementById('export-btn').addEventListener('click', exportExcel);
  document.getElementById('export-structured-csv-btn').addEventListener('click', exportStructuredCsv);
  document.getElementById('export-logger-excel-btn').addEventListener('click', exportLoggerExcel);
  document.getElementById('backup-btn').addEventListener('click', backupJson);
  document.getElementById('restore-btn').addEventListener('click', () => document.getElementById('json-input').click());
  document.getElementById('json-input').addEventListener('change', e => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; });

  // Sync buttons — only visible on localhost/127.0.0.1
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    const pullLiveBtn = document.getElementById('pull-from-live-btn');
    if (pullLiveBtn) { pullLiveBtn.style.display = ''; pullLiveBtn.addEventListener('click', pullFromLive); }
    const pushLiveBtn = document.getElementById('push-to-live-btn');
    if (pushLiveBtn) { pushLiveBtn.style.display = ''; pushLiveBtn.addEventListener('click', pushToLive); }
  }

  document.getElementById('save-view-btn').addEventListener('click', () => {
    const name = prompt('View ka naam likhein:');
    if (name && name.trim()) {
      saveCurrentView(name.trim());
      showToast(`View "${name.trim()}" saved`, 'success');
    }
  });
  renderViewsPanel();

  document.getElementById('add-row-btn').addEventListener('click', () => {
    const today = new Date().toISOString().slice(0, 10);
    const row = { date: today, trade_date: today, images: [] };
    state.columns.forEach(col => { row[col] = ''; });
    row[BROKER_COLUMN] = row[BROKER_COLUMN] || 'zerodha';
    row.observation = '';
    state.trades.push(row); render(); saveTrades();
    closeAllDropdowns('__none__');
  });

  document.getElementById('add-tag-col-btn').addEventListener('click', () => {
    state.addTagColumnMode = true;
    document.getElementById('add-col-modal').classList.add('open');
    document.getElementById('new-col-name').value = getNextTagColumnName();
    document.getElementById('new-col-name').focus();
    document.getElementById('new-col-name').select();
    closeAllDropdowns('__none__');
  });

  document.getElementById('add-col-btn').addEventListener('click', () => {
    state.addTagColumnMode = false;
    document.getElementById('add-col-modal').classList.add('open');
    document.getElementById('new-col-name').value = '';
    document.getElementById('new-col-name').focus();
    closeAllDropdowns('__none__');
  });
  document.getElementById('add-col-confirm').addEventListener('click', () => {
    addColumn(document.getElementById('new-col-name').value);
    document.getElementById('add-col-modal').classList.remove('open');
  });
  document.getElementById('new-col-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') { addColumn(e.target.value); document.getElementById('add-col-modal').classList.remove('open'); }
  });
  ['add-col-close', 'add-col-cancel'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => {
      state.addTagColumnMode = false;
      document.getElementById('add-col-modal').classList.remove('open');
    });
  });

  document.getElementById('edit-col-btn').addEventListener('click', () => {
    openEditColumnModal();
    closeAllDropdowns('__none__');
  });
  document.getElementById('edit-col-select').addEventListener('change', e => {
    document.getElementById('edit-col-name').value = e.target.value;
    const canDelete = canDeleteColumn(e.target.value);
    const delBtn = document.getElementById('edit-col-delete');
    delBtn.disabled = !canDelete;
    delBtn.title = canDelete ? 'Delete this column' : 'System/import column cannot be deleted';
  });
  document.getElementById('edit-col-delete').addEventListener('click', () => {
    const col = document.getElementById('edit-col-select').value;
    deleteColumn(col);
    document.getElementById('edit-col-modal').classList.remove('open');
  });
  document.getElementById('edit-col-confirm').addEventListener('click', () => {
    const oldName = document.getElementById('edit-col-select').value;
    const newName = document.getElementById('edit-col-name').value;
    renameColumn(oldName, newName);
    document.getElementById('edit-col-modal').classList.remove('open');
  });
  document.getElementById('edit-col-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      renameColumn(document.getElementById('edit-col-select').value, e.target.value);
      document.getElementById('edit-col-modal').classList.remove('open');
    }
  });
  ['edit-col-close', 'edit-col-cancel'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => document.getElementById('edit-col-modal').classList.remove('open'));
  });

  document.getElementById('filter-toggle-btn').addEventListener('click', () => {
    state.filterVisible = !state.filterVisible;
    const btn = document.getElementById('filter-toggle-btn');
    btn.style.borderColor = state.filterVisible ? 'var(--blue)' : '';
    btn.style.color = state.filterVisible ? 'var(--blue)' : '';
    renderTable();
  });

  const _noteToggleBtn = document.getElementById('note-col-toggle-btn');
  function _updateNoteToggleBtn() {
    if (!_noteToggleBtn) return;
    const on = state.tableShowCols[NOTE_COLUMN] !== false;
    _noteToggleBtn.style.borderColor = on ? 'var(--blue)' : '';
    _noteToggleBtn.style.color = on ? 'var(--blue)' : '';
  }
  if (_noteToggleBtn) {
    _noteToggleBtn.addEventListener('click', () => {
      const wasOn = state.tableShowCols[NOTE_COLUMN] !== false;
      state.tableShowCols[NOTE_COLUMN] = !wasOn;
      try { localStorage.setItem('tj_tableShowCols', JSON.stringify(state.tableShowCols)); } catch (e) { }
      _updateNoteToggleBtn();
      renderTable();
    });
    _updateNoteToggleBtn();
  }

  const _clToolbarBtn = document.getElementById('csvlog-toolbar-btn');
  if (_clToolbarBtn) {
    _clToolbarBtn.addEventListener('click', () => openCsvLogModal());
  }
  const _clChartsToolbarBtn = document.getElementById('csvlog-charts-toolbar-btn');
  if (_clChartsToolbarBtn) {
    _clChartsToolbarBtn.addEventListener('click', () => openCsvLogChartsModal());
  }

  const _trToolbarBtn = document.getElementById('trade-review-toolbar-btn');
  if (_trToolbarBtn) {
    _trToolbarBtn.addEventListener('click', () => openTradeReviewFromToolbar());
  }

  const _tlToolbarBtn = document.getElementById('trade-logger-toolbar-btn');
  if (_tlToolbarBtn) {
    _tlToolbarBtn.addEventListener('click', () => openTradeLoggerFromToolbar());
  }

  const _drFrom = document.getElementById('glob-date-from');
  const _drTo = document.getElementById('glob-date-to');
  const _drClear = document.getElementById('glob-date-clear');
  const _loadDateRange = () => {
    try { const r = JSON.parse(localStorage.getItem('tj_dateRange') || '{}'); state.dateRange = { from: r.from || '', to: r.to || '' }; } catch (e) { }
    if (_drFrom) _drFrom.value = state.dateRange.from;
    if (_drTo) _drTo.value = state.dateRange.to;
    _updateDateRangeUI();
  };
  const _saveDateRange = () => { try { localStorage.setItem('tj_dateRange', JSON.stringify(state.dateRange)); } catch (e) { } };
  const _updateDateRangeUI = () => {
    const active = !!(state.dateRange.from || state.dateRange.to);
    if (_drFrom) _drFrom.style.borderColor = active ? 'var(--blue)' : '';
    if (_drTo) _drTo.style.borderColor = active ? 'var(--blue)' : '';
    if (_drClear) _drClear.style.display = active ? 'inline-flex' : 'none';
  };
  const _applyDateFromInput = () => {
    state.dateRange.from = _drFrom ? _drFrom.value : '';
    state.dateRange.to = _drTo ? _drTo.value : '';
    _saveDateRange();
    _updateDateRangeUI();
    render();
  };
  if (_drFrom) {
    _drFrom.addEventListener('change', _applyDateFromInput);
    _drFrom.addEventListener('input', _applyDateFromInput);
    _drFrom.addEventListener('keydown', e => { if (e.key === 'Enter') _applyDateFromInput(); });
  }
  if (_drTo) {
    _drTo.addEventListener('change', _applyDateFromInput);
    _drTo.addEventListener('input', _applyDateFromInput);
    _drTo.addEventListener('keydown', e => { if (e.key === 'Enter') _applyDateFromInput(); });
  }
  if (_drClear) _drClear.addEventListener('click', () => {
    state.dateRange = { from: '', to: '' };
    if (_drFrom) _drFrom.value = '';
    if (_drTo) _drTo.value = '';
    _saveDateRange(); _updateDateRangeUI(); render();
  });
  _loadDateRange();

  // ── Mobile View Toggle ──────────────────────────────────────────────────────
  const mobileBtn = document.getElementById('mobile-view-toggle-btn');
  if (mobileBtn) {
    mobileBtn.addEventListener('click', () => {
      window.location.href = '/mobile/';
    });
  }

  const strategyLabBtn = document.getElementById('strategy-lab-btn');
  if (strategyLabBtn) {
    strategyLabBtn.addEventListener('click', () => {
      window.location.href = '/strategy-lab';
    });
  }

  // Fullscreen button — hides browser chrome on iPad/mobile
  const fsBtn = document.getElementById('fullscreen-btn');
  if (fsBtn) {
    const updateIcon = () => {
      fsBtn.textContent = document.fullscreenElement ? '✕' : '⛶';
      fsBtn.title = document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen';
    };
    fsBtn.addEventListener('click', () => {
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      } else {
        (document.documentElement.requestFullscreen
          || document.documentElement.webkitRequestFullscreen)
          ?.call(document.documentElement);
      }
    });
    document.addEventListener('fullscreenchange', updateIcon);
    document.addEventListener('webkitfullscreenchange', updateIcon);
  }
}

```

## File: `static/js/events-settings.js`
```js
/**
 * @fileoverview events-settings.js
 * @description Settings modal events, upload-done handler routing via selectedSeparator, drag-drop zone.
 * @exports _bindSettingsEvents
 * @reads state.{uploadRow,_dayUploadKey,pendingFiles,_galleryUploadCallback},
 *        state.gallery.{selectedSeparator,date}
 * @writes state.trades[].images, state.dayData[].{images,closeImages} (via upload routing)
 * @calls saveTrades, render, applySettingsToDOM, showToast, getTradesForDate
 */

// events-settings.js — Tag/font/row-height size controls, resize handles, obs modal, upload modal, settings panel

function _bindSettingsEvents() {
  const TAG_SZ_KEY = 'tj_tagChipSize';
  const TAG_SZ_MIN = 0.55, TAG_SZ_MAX = 1.2, TAG_SZ_STEP = 0.07;
  function applyTagChipSize(sz) {
    sz = Math.min(TAG_SZ_MAX, Math.max(TAG_SZ_MIN, sz));
    localStorage.setItem(TAG_SZ_KEY, String(sz));
    const root = document.documentElement;
    root.style.setProperty('--tag-chip-size', sz + 'rem');
    root.style.setProperty('--tag-chip-count-size', (sz * 0.86) + 'rem');
  }
  function getTagChipSize() {
    return parseFloat(localStorage.getItem(TAG_SZ_KEY) || '0.72');
  }
  applyTagChipSize(getTagChipSize());
  const szPlus = document.getElementById('gv2-tag-sz-plus');
  const szMinus = document.getElementById('gv2-tag-sz-minus');
  if (szPlus) szPlus.addEventListener('click', () => applyTagChipSize(getTagChipSize() + TAG_SZ_STEP));
  if (szMinus) szMinus.addEventListener('click', () => applyTagChipSize(getTagChipSize() - TAG_SZ_STEP));

  const TBL_FONT_KEY = 'tj_tblFontSize';
  const TBL_FONT_OPTS = [0.72, 0.78, 0.85, 0.95, 1.05];
  function applyTblFontSize(sz) {
    sz = parseFloat(sz) || 0.85;
    localStorage.setItem(TBL_FONT_KEY, String(sz));
    document.documentElement.style.setProperty('--table-font-size', sz + 'rem');
    const sel = document.getElementById('s-tbl-font-size');
    if (sel) {
      const nearest = TBL_FONT_OPTS.reduce((a, b) => Math.abs(b - sz) < Math.abs(a - sz) ? b : a);
      sel.value = String(nearest);
    }
  }
  function getTblFontSize() { return parseFloat(localStorage.getItem(TBL_FONT_KEY) || '0.85'); }
  applyTblFontSize(getTblFontSize());
  const tblFontSel = document.getElementById('s-tbl-font-size');
  if (tblFontSel) tblFontSel.addEventListener('change', () => applyTblFontSize(parseFloat(tblFontSel.value)));

  const ROW_H_KEY = 'tj_rowHeight';
  const ROW_H_MIN = 24, ROW_H_MAX = 80, ROW_H_STEP = 4;
  function applyRowHeight(h) {
    h = Math.min(ROW_H_MAX, Math.max(ROW_H_MIN, parseInt(h, 10) || 40));
    localStorage.setItem(ROW_H_KEY, String(h));
    document.documentElement.style.setProperty('--table-row-height', h + 'px');
    const el = document.getElementById('s-row-h-val');
    if (el) el.textContent = h;
  }
  function getRowHeight() { return parseInt(localStorage.getItem(ROW_H_KEY) || '40', 10); }
  applyRowHeight(getRowHeight());
  const rowHPlus = document.getElementById('s-row-h-plus');
  const rowHMinus = document.getElementById('s-row-h-minus');
  if (rowHPlus) rowHPlus.addEventListener('click', () => applyRowHeight(getRowHeight() + ROW_H_STEP));
  if (rowHMinus) rowHMinus.addEventListener('click', () => applyRowHeight(getRowHeight() - ROW_H_STEP));

  (function () {
    const handle = document.getElementById('settings-resize-handle');
    const panel = document.querySelector('.settings-panel');
    if (!handle || !panel) return;
    const PANEL_W_KEY = 'tj_settingsPanelW';
    const savedW = parseInt(localStorage.getItem(PANEL_W_KEY) || '310', 10);
    panel.style.width = Math.max(220, Math.min(580, savedW)) + 'px';
    let _resizing = false;
    handle.addEventListener('mousedown', e => {
      _resizing = true;
      handle.classList.add('dragging');
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!_resizing) return;
      const newW = Math.max(220, Math.min(580, window.innerWidth - e.clientX));
      panel.style.width = newW + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (!_resizing) return;
      _resizing = false;
      handle.classList.remove('dragging');
      localStorage.setItem(PANEL_W_KEY, String(parseInt(panel.style.width, 10) || 310));
    });
  })();

  (function () {
    const handle = document.getElementById('gv2-tray-resize-handle');
    const tray = document.getElementById('gv2-tags-tray');
    if (!handle || !tray) return;
    const TRAY_W_KEY = 'tj_tagsTrayW';
    const savedW = parseInt(localStorage.getItem(TRAY_W_KEY) || '220', 10);
    tray.style.width = Math.max(150, Math.min(480, savedW)) + 'px';
    let _resizing = false;
    handle.addEventListener('mousedown', e => {
      _resizing = true;
      handle.classList.add('dragging');
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!_resizing) return;
      const trayRect = tray.getBoundingClientRect();
      const maxW = Math.min(480, window.innerWidth * 0.45);
      const newW = Math.max(150, Math.min(maxW, trayRect.right - e.clientX));
      tray.style.width = newW + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (!_resizing) return;
      _resizing = false;
      handle.classList.remove('dragging');
      localStorage.setItem(TRAY_W_KEY, String(parseInt(tray.style.width, 10) || 220));
      requestAnimationFrame(() => {
        if (typeof loadOverlayForCurrentImage === 'function') loadOverlayForCurrentImage();
      });
    });
  })();

  (function () {
    const handleH = document.getElementById('gv2-tray-resize-handle-horiz');
    if (!handleH) return;
    const THUMB_SZ_KEY = 'tj_thumbSz';
    const savedSz = parseInt(localStorage.getItem(THUMB_SZ_KEY) || '100', 10);
    document.documentElement.style.setProperty('--thumb-size', Math.max(24, savedSz) + 'px');

    let _resizingH = false;
    let _startThumbSz = 54;
    let _startY = 0;

    handleH.addEventListener('mousedown', e => {
      _resizingH = true;
      _startY = e.clientY;
      const currentCSSVar = document.documentElement.style.getPropertyValue('--thumb-size');
      _startThumbSz = parseInt(currentCSSVar || 54, 10);
      handleH.classList.add('dragging');
      document.body.style.cursor = 'ns-resize';
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!_resizingH) return;
      // move UP (smaller Y) means LARGER tray
      const diff = _startY - e.clientY;
      const newSz = Math.max(24, _startThumbSz + diff);
      document.documentElement.style.setProperty('--thumb-size', newSz + 'px');
    });

    document.addEventListener('mouseup', () => {
      if (!_resizingH) return;
      _resizingH = false;
      document.body.style.cursor = '';
      handleH.classList.remove('dragging');
      localStorage.setItem(THUMB_SZ_KEY, String(parseInt(document.documentElement.style.getPropertyValue('--thumb-size'), 10) || 54));
    });
  })();
  bindObsToolbar();
  document.getElementById('obs-save').addEventListener('click', () => saveObservation(true));
  document.getElementById('obs-cancel').addEventListener('click', () => {
    document.getElementById('obs-modal').classList.remove('open');
  });
  document.getElementById('obs-close').addEventListener('click', () => saveObservation(true));
  let _obsMousedownOnBg = false;
  document.getElementById('obs-modal').addEventListener('mousedown', e => {
    _obsMousedownOnBg = e.target === e.currentTarget;
  });
  document.getElementById('obs-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget && _obsMousedownOnBg) saveObservation(true);
    _obsMousedownOnBg = false;
  });
  document.getElementById('obs-date-prev').addEventListener('click', () => navigateObsDate(-1));
  document.getElementById('obs-date-next').addEventListener('click', () => navigateObsDate(1));
  document.getElementById('obs-date-picker').addEventListener('change', e => {
    if (e.target.value) { saveObservation(false); openObsModal(e.target.value); }
  });

  document.getElementById('image-file-input').addEventListener('change', async e => { await handleImageFiles(Array.from(e.target.files)); e.target.value = ''; });
  const dz = document.getElementById('upload-drop-zone');
  dz.addEventListener('click', e => {
    if (e.target.id === 'upload-browse-label') return; // label handles it directly
    document.getElementById('image-file-input').click();
  });
  document.getElementById('upload-browse-label').addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('image-file-input').click();
  });
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
  dz.addEventListener('drop', async e => { e.preventDefault(); dz.classList.remove('drag-over'); await handleImageFiles(Array.from(e.dataTransfer.files)); });
  document.getElementById('upload-done-btn').addEventListener('click', async () => {
    let savedViaGallerySeparator = false;
    // Only save server-confirmed URLs — blob: URLs are temporary and expire on reload
    const readyFiles = state.pendingFiles.filter(u => !String(u).startsWith('blob:'));
    const pendingCount = state.pendingFiles.length - readyFiles.length;
    if (pendingCount > 0) showToast(`${pendingCount} image(s) still uploading — wait and try again`, 'error');
    if (!readyFiles.length && !state.pendingFiles.length) {
      document.getElementById('upload-modal').classList.remove('open');
      if (state._galleryUploadCallback) { state._galleryUploadCallback(); state._galleryUploadCallback = null; }
      return;
    }

    const _galleryOpen = document.getElementById('gallery-modal')?.classList.contains('open');
    if (_galleryOpen && state.gallery.selectedSeparator !== undefined && state.gallery.selectedSeparator !== null) {
      const targetDate = state.gallery.date;
      const sel = state.gallery.selectedSeparator;
      if (sel === 'NEWS') {
        if (!state.dayData[targetDate]) state.dayData[targetDate] = {};
        if (!state.dayData[targetDate].newsImages) state.dayData[targetDate].newsImages = [];
        state.dayData[targetDate].newsImages.push(...readyFiles);
        savedViaGallerySeparator = true;
      } else if (sel === 'CLOSE') {
        if (!state.dayData[targetDate]) state.dayData[targetDate] = {};
        if (!state.dayData[targetDate].closeImages) state.dayData[targetDate].closeImages = [];
        state.dayData[targetDate].closeImages.push(...readyFiles);
        savedViaGallerySeparator = true;
      } else if (sel === 'CLOSE_GLOBAL') {
        if (!state.dayData[targetDate]) state.dayData[targetDate] = {};
        if (!state.dayData[targetDate].closeGlobalImages) state.dayData[targetDate].closeGlobalImages = [];
        state.dayData[targetDate].closeGlobalImages.push(...readyFiles);
        savedViaGallerySeparator = true;
      } else if (sel === 'OPEN') {
        if (!state.dayData[targetDate]) state.dayData[targetDate] = {};
        if (!state.dayData[targetDate].images) state.dayData[targetDate].images = [];
        state.dayData[targetDate].images.push(...readyFiles);
        savedViaGallerySeparator = true;
      } else if (typeof sel === 'string' && sel.startsWith('PREMIUM:')) {
        const instNum = sel.replace('PREMIUM:', '');
        if (!state.dayData[targetDate]) state.dayData[targetDate] = {};
        if (!state.dayData[targetDate].premiumImages) state.dayData[targetDate].premiumImages = {};
        if (!Array.isArray(state.dayData[targetDate].premiumImages[instNum])) {
          const old = state.dayData[targetDate].premiumImages[instNum];
          state.dayData[targetDate].premiumImages[instNum] = old ? [old] : [];
        }
        state.dayData[targetDate].premiumImages[instNum].push(...readyFiles);
        
        // Also push to ALL matching trades of this instrument on this day
        const dayTrades = getTradesForDate(targetDate);
        dayTrades.forEach(t => {
            const raw = (t.Instrument || t.instrument || t.Symbol || t.symbol || '');
            const tInst = String(raw).trim().toUpperCase();
            if (tInst === String(instNum).trim().toUpperCase()) {
                t.images = t.images || [];
                // Add images that aren't already there (avoiding easy duplicates)
                readyFiles.forEach(url => {
                    if (!t.images.includes(url)) t.images.push(url);
                });
            }
        });
        
        savedViaGallerySeparator = true;
      } else if (typeof sel === 'number') {
        const tr = getTradesForDate(targetDate)[sel];
        if (tr) {
          tr.images = tr.images || [];
          tr.images.push(...readyFiles);
          savedViaGallerySeparator = true;
        }
      }
      if (savedViaGallerySeparator) {
        await saveTrades(); render();
        showToast('Images stored via separator!', 'success');
      }
    }

    if (!savedViaGallerySeparator) {
      if (state._dayUploadKey) {
        if (!state.dayData[state._dayUploadKey]) state.dayData[state._dayUploadKey] = {};
        if (!state.dayData[state._dayUploadKey].images) state.dayData[state._dayUploadKey].images = [];
        state.dayData[state._dayUploadKey].images.push(...readyFiles);
        await saveTrades(); render();
        showToast('Images saved!', 'success');
        state._dayUploadKey = null;
      } else if (state.uploadRow !== null) {
        if (!state.trades[state.uploadRow].images) state.trades[state.uploadRow].images = [];
        state.trades[state.uploadRow].images.push(...readyFiles);
        cleanupImageTagStore(state.trades[state.uploadRow]);
        syncTradeDateField(state.trades[state.uploadRow]);
        saveTrades();
        render();
        showToast('Images saved!', 'success');
      }
    }
    document.getElementById('upload-modal').classList.remove('open');
    if (state._galleryUploadCallback) { state._galleryUploadCallback(); state._galleryUploadCallback = null; }
  });
  ['upload-cancel-btn', 'upload-close'].forEach(id => document.getElementById(id).addEventListener('click', () => document.getElementById('upload-modal').classList.remove('open')));
  document.getElementById('upload-modal').addEventListener('click', e => { if (e.target === e.currentTarget) document.getElementById('upload-modal').classList.remove('open'); });
  document.getElementById('upload-modal').addEventListener('paste', async e => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imgFiles = Array.from(items).filter(it => it.type.startsWith('image/')).map(it => it.getAsFile()).filter(Boolean);
    if (imgFiles.length) { e.preventDefault(); e.stopPropagation(); await handleImageFiles(imgFiles); showToast('Image pasted from clipboard', 'success'); }
  });

  document.getElementById('settings-btn').addEventListener('click', () => document.getElementById('settings-overlay').classList.toggle('open'));
  document.getElementById('settings-close').addEventListener('click', () => document.getElementById('settings-overlay').classList.remove('open'));
  document.querySelectorAll('.shortcut-input').forEach(inp => {
    inp.addEventListener('keydown', e => {
      if (e.key === 'Tab') return;
      e.preventDefault();
      if (e.key === 'Escape') return;
      const combo = eventToShortcut(e);
      if (combo) {
        inp.value = combo.replace(/\b\w/g, c => c.toUpperCase());
        saveShortcuts(readShortcutsFromPanel());
      }
    });
  });
  ['s-day-size', 's-day-bold', 's-day-pos', 's-data-size', 's-data-bold', 's-show-labels', 's-cell-height', 's-sat-sun-off', 's-table-rows', 's-group-a-color', 's-group-b-color', 's-group-sep-color'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      const s = readSettingsFromPanel();
      applySettingsToDOM(s);
      renderCalendar();
    });
  });
  document.getElementById('s-apply').addEventListener('click', () => {
    saveSettings(readSettingsFromPanel());
    saveShortcuts(readShortcutsFromPanel());
    document.getElementById('settings-overlay').classList.remove('open');
  });
  document.getElementById('s-reset').addEventListener('click', () => {
    populateSettingsPanel(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
    saveShortcuts(DEFAULT_SHORTCUTS);
    document.getElementById('settings-overlay').classList.remove('open');
  });

  const _applyHeadsPreset = (mode, preset) => {
    const obj = mode === 'consolidated' ? state.showHeadsConsolidated : state.showHeadsIndividual;
    state.columns.filter(c => c.toLowerCase() !== 'date').forEach(col => {
      obj[col] = preset === 'plonly' ? isDefaultShowHeadCol(col) : (preset === 'all');
    });
    saveShowHeads();
    renderShowHeads();
    renderCalendar();
    showToast(`${mode === 'consolidated' ? 'Consolidated' : 'Individual'} heads updated`, 'success');
  };
  document.getElementById('s-heads-c-plonly').addEventListener('click', () => _applyHeadsPreset('consolidated', 'plonly'));
  document.getElementById('s-heads-c-all').addEventListener('click', () => _applyHeadsPreset('consolidated', 'all'));
  document.getElementById('s-heads-c-none').addEventListener('click', () => _applyHeadsPreset('consolidated', 'none'));
  document.getElementById('s-heads-i-plonly').addEventListener('click', () => _applyHeadsPreset('individual', 'plonly'));
  document.getElementById('s-heads-i-all').addEventListener('click', () => _applyHeadsPreset('individual', 'all'));
  document.getElementById('s-heads-i-none').addEventListener('click', () => _applyHeadsPreset('individual', 'none'));
}

```
