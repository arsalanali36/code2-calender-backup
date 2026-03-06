# JS — Events Init & Keyboard (events.js / events-keys.js)
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `static\js\events.js`
```js
/**
 * @fileoverview events.js
 * @description Main bootstrapper mapping all app hotkeys and interactions.
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
        const fd = new FormData();
        fd.append('image', file);
        const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
        const data = await res.json();
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

          if (!addedToGroup) {
            const currUrl = (state.gallery.images || [])[state.gallery.currentIndex];
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
            // For groups/trades we will let sync logic handle insertion, but we need it locally first
            const insertPos = state.gallery.images.indexOf(currUrl) + 1;
            state.gallery.images.splice(insertPos, 0, data.url);
            state.gallery.currentIndex = insertPos;
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

## File: `static\js\events-keys.js`
```js
/**
 * @fileoverview events-keys.js
 * @description Global keyboard shortcuts (undo, navigation).
 */

// events-keys.js — Global keyboard handler (gallery hotkeys, annotation shortcuts,
//   calendar navigation, view toggles). Called by bindEvents() in events.js.

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

    if ((e.key === 'z' || e.key === 'Z') && e.ctrlKey && !e.shiftKey && !e.altKey && !typingInField) {
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
    }

    const obsModalOpen = document.getElementById('obs-modal').classList.contains('open');
    if (obsModalOpen && !galleryOpen && !typingInField && (e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const dp = document.getElementById('obs-date-picker');
      dp.focus(); if (typeof dp.showPicker === 'function') dp.showPicker();
    }

    if (galleryOpen) {
      if (typingInField && e.key !== 'Escape') return;
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
      if (!e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'v' || e.key === 'V')) {
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
      if (e.altKey && !e.ctrlKey && !e.shiftKey && String(e.key || '').toLowerCase() === 't') {
        e.preventDefault();
        openGalleryImageTagManager();
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

      if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        if (typeof toggleGalleryGroupExpand === 'function' && state.gallery.images) {
          const currentImageUrl = state.gallery.images[state.gallery.currentIndex];
          if (currentImageUrl) toggleGalleryGroupExpand(currentImageUrl);
        }
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

      if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); navigateGallery(-1); }
      if (e.key === 'ArrowRight' && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); navigateGallery(1); }
      if (e.key === 'ArrowUp' && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); navigateGallery(1); }
      if (e.key === 'ArrowDown' && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); navigateGallery(-1); }
      if (e.key === 'r' || e.key === 'R') resetZoom();
      if (e.key === 'a' || e.key === 'A') { e.preventDefault(); toggleAnnotation(); }

      if ((e.key === 'e' || e.key === 'E') && !e.altKey && !e.ctrlKey) {
        e.preventDefault();
        if (!annotState.active) startAnnotation();
        setAnnotTool('eraser');
        return;
      }
      if ((e.key === 't' || e.key === 'T') && !e.altKey && !e.ctrlKey) {
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
      if ((e.key === 'm' || e.key === 'M') && !e.altKey && !e.ctrlKey) {
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

      if ((e.key === 'l' || e.key === 'L') && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        if (annotState.active) return;
        e.preventDefault();
        if (typeof toggleLayerPanel === 'function') toggleLayerPanel();
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        if (annotState.active) return;
        e.preventDefault();
        const toggleBtn = document.getElementById('gallery-show-heads-btn');
        if (toggleBtn) toggleBtn.click();
        return;
      }
      if ((e.key === 'i' || e.key === 'I') && !e.altKey && !e.ctrlKey) {
        if (annotState.active) return;
        e.preventDefault();
        const btn = document.getElementById('gallery-upload-btn');
        if (btn && btn.style.display !== 'none') btn.click();
        return;
      }
      if ((e.key === 'f' || e.key === 'F') && !e.altKey && !e.ctrlKey) {
        if (annotState.active) return;
        e.preventDefault();
        const toggleBtn = document.getElementById('gallery-img-tag-filter-btn');
        if (toggleBtn) {
          toggleBtn.click();
          setTimeout(() => {
            const panel = document.getElementById('gallery-img-tag-filter-panel');
            if (panel && panel.classList.contains('open')) {
              const inp = panel.querySelector('.panel-search');
              if (inp) {
                inp.focus();
                inp.select();
              }
            }
          }, 100);
        }
        return;
      }

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
        showGalleryExitConfirm();
      }
    }
    const anyModalOpen = ['obs-modal', 'add-col-modal', 'edit-col-modal', 'tag-modal', 'img-tag-modal', 'upload-modal']
      .some(id => document.getElementById(id)?.classList.contains('open'));
    if (!typingInField && !galleryOpen && !anyModalOpen && !e.ctrlKey && !e.altKey) {
      if (e.key === 'f' && !e.shiftKey) {
        e.preventDefault();
        document.body.classList.toggle('calendar-full');
        document.body.classList.remove('table-full');
      } else if ((e.key === 'F' || (e.key === 'f' && e.shiftKey)) && !e.ctrlKey) {
        e.preventDefault();
        const _enteringFull = !document.body.classList.contains('table-full');
        document.body.classList.toggle('table-full');
        document.body.classList.remove('calendar-full');
        if (_enteringFull) {
          document.documentElement.style.setProperty('--table-visible-rows', '20');
        } else {
          const _saved = JSON.parse(localStorage.getItem('tj_settings') || '{}');
          const _rows = Math.max(3, Math.min(25, parseInt(_saved.tableRows, 10) || 5));
          document.documentElement.style.setProperty('--table-visible-rows', String(_rows));
        }
      } else if (e.key === 'c' && !e.shiftKey) {
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
        e.preventDefault();
        const datesWImg = getDatesWithImages();
        if (datesWImg.length) openGalleryForDate(datesWImg[datesWImg.length - 1]);
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
    }
  });
}

```
