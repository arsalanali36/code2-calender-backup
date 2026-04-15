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
      // Arrow nav — must run BEFORE typingInField check because upper-canvas focus
      // triggers typingInField=true even when not typing. Guard: annotation must be off.
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
      if (shortcutMatches(e, state.shortcuts.fullscreen)) {
        if (annotState.active) return;
        e.preventDefault();
        const _fsImages = state.gallery.images || [];
        const _fsCur = _fsImages[state.gallery.currentIndex];
        if (_fsCur && typeof openFullscreenFromAppContext === 'function') openFullscreenFromAppContext(_fsImages, _fsCur, true);
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
        if (_clBackdrop) return;   // CSVLog modal open — let it handle 'i'
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
