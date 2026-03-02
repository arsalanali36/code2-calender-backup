# Frontend Context — IO & Events
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `static\js\io.js`
```js

function openUploadModal(rowIdx) {
  syncTradeDateField(state.trades[rowIdx]);
  state.uploadRow = rowIdx;
  state._dayUploadKey = null;
  state.pendingFiles = []; // Start empty instead of existing images
  document.getElementById('upload-modal-title').textContent = `Images â€” ${state.trades[rowIdx].date || `Row ${rowIdx + 1}`}`;
  renderUploadPreview();
  document.getElementById('upload-modal').classList.add('open');
}

function openDayUploadModal(dateKey) {
  state.uploadRow = null;
  state._dayUploadKey = dateKey;
  state.pendingFiles = []; // Start empty instead of existing images
  document.getElementById('upload-modal-title').textContent = `Images â€” ${dateKey}`;
  renderUploadPreview();
  document.getElementById('upload-modal').classList.add('open');
}

function renderUploadPreview() {
  const c = document.getElementById('upload-preview'); c.innerHTML = '';
  state.pendingFiles.forEach((url, i) => {
    const item = document.createElement('div'); item.className = 'preview-item';
    const img = document.createElement('img'); img.src = url;
    const del = document.createElement('button'); del.className = 'remove-preview'; del.textContent = 'âœ•';
    del.addEventListener('click', () => { state.pendingFiles.splice(i, 1); renderUploadPreview(); });
    item.appendChild(img); item.appendChild(del); c.appendChild(item);
  });
}

async function handleImageFiles(files) {
  for (const file of files) {
    try {
      const fd = new FormData(); fd.append('image', file);
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.url) { state.pendingFiles.push(data.url); renderUploadPreview(); }
    } catch (e) { showToast('Image upload failed', 'error'); }
  }
}

async function uploadImagesToRow(rowIdx, files) {
  if (!Array.isArray(files) || !files.length) return;
  const trade = state.trades[rowIdx];
  if (!trade) return;
  if (!trade.images) trade.images = [];
  syncTradeDateField(trade);
  let added = 0;
  for (const file of files) {
    if (!file || !String(file.type || '').startsWith('image/')) continue;
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.url) {
        trade.images.push(data.url);
        added++;
      }
    } catch (e) { }
  }
  if (added > 0) {
    await saveTrades();
    render();
    showToast(`${added} image added to row`, 'success');
  }
}

async function uploadImagesToDayData(dateKey, files) {
  if (!Array.isArray(files) || !files.length) return;
  if (!state.dayData[dateKey]) state.dayData[dateKey] = {};
  if (!state.dayData[dateKey].images) state.dayData[dateKey].images = [];
  let added = 0;
  for (const file of files) {
    if (!file || !String(file.type || '').startsWith('image/')) continue;
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.url) { state.dayData[dateKey].images.push(data.url); added++; }
    } catch (e) { }
  }
  if (added > 0) { await saveTrades(); render(); showToast(`${added} image added`, 'success'); }
}

function bindRowImageDrop(rowEl, rowIdx) {
  rowEl.addEventListener('dragover', e => {
    const hasFiles = e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    const hasImg = e.dataTransfer && e.dataTransfer.types.includes('tj-img');
    if (!hasFiles && !hasImg) return;
    e.preventDefault();
    rowEl.classList.add('row-drop-target');
  });
  rowEl.addEventListener('dragleave', () => rowEl.classList.remove('row-drop-target'));
  rowEl.addEventListener('drop', async e => {
    rowEl.classList.remove('row-drop-target');
    const internal = e.dataTransfer.getData('tj-img');
    if (internal) {
      e.preventDefault();
      try {
        const { rowIdx: srcIdx, url } = JSON.parse(internal);
        if (srcIdx !== rowIdx) {
          if (!state.trades[rowIdx].images) state.trades[rowIdx].images = [];
          state.trades[rowIdx].images.push(url);
          if (e.dataTransfer.effectAllowed !== 'copy')
            state.trades[srcIdx].images = (state.trades[srcIdx].images || []).filter(u => u !== url);
          await saveTrades(); render();
          showToast(e.dataTransfer.effectAllowed === 'copy' ? 'Image copied' : 'Image moved', 'success');
        }
      } catch (err) { }
      return;
    }
    const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
    if (!files.length) return;
    e.preventDefault();
    await uploadImagesToRow(rowIdx, files);
  });
}

let _rowDragSrcIdx = null;
let _rowDropTarget = null;
let _rowDropPos = null; // 'before' | 'after'
let _rowDragFromHandle = false; // true only when drag started from the ⠿ handle
document.addEventListener('mouseup', () => { _rowDragFromHandle = false; }, true);

function bindTableRowDrag(tr, rowIdx, body) {
  tr.setAttribute('draggable', 'true');
  tr.addEventListener('dragstart', e => {
    if (!_rowDragFromHandle) { e.preventDefault(); return; }
    _rowDragFromHandle = false;
    _rowDragSrcIdx = rowIdx;
    setTimeout(() => tr.classList.add('dragging'), 0);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('tj-row', String(rowIdx));
  });
  tr.addEventListener('dragend', () => {
    tr.classList.remove('dragging');
    body.querySelectorAll('.row-drop-before, .row-drop-after').forEach(r => r.classList.remove('row-drop-before', 'row-drop-after'));
    if (_rowDragSrcIdx !== null && _rowDropTarget !== null) {
      const srcTrade = state.trades[_rowDragSrcIdx];
      const tgtTrade = _rowDropTarget.__tradeRef;
      if (srcTrade && tgtTrade && srcTrade !== tgtTrade) {
        const srcI = state.trades.indexOf(srcTrade);
        let tgtI = state.trades.indexOf(tgtTrade);
        if (srcI !== -1 && tgtI !== -1) {
          state.trades.splice(srcI, 1);
          tgtI = state.trades.indexOf(tgtTrade);
          if (_rowDropPos === 'after') tgtI += 1;
          state.trades.splice(tgtI, 0, srcTrade);
          saveTrades(); render();
        }
      }
    }
    _rowDragSrcIdx = null; _rowDropTarget = null; _rowDropPos = null;
  });
  tr.__tradeRef = state.trades[rowIdx];
  tr.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('tj-row')) return;
    e.preventDefault();
    body.querySelectorAll('.row-drop-before, .row-drop-after').forEach(r => r.classList.remove('row-drop-before', 'row-drop-after'));
    const rect = tr.getBoundingClientRect();
    _rowDropPos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    _rowDropTarget = tr;
    tr.classList.add(_rowDropPos === 'before' ? 'row-drop-before' : 'row-drop-after');
  });
  tr.addEventListener('drop', e => { e.preventDefault(); });
}

async function importExcel(file) {
  const fd = new FormData(); fd.append('file', file);
  try {
    showToast('Importing Excel...', '');
    const res = await fetch('/api/import-excel', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.error) { showToast(data.error, 'error'); return; }
    state.trades = data.trades;
    state.columns = data.columns;
    state.allTags = data.allTags || state.allTags || [];
    state.tagColumns = Array.isArray(data.tagColumns) ? data.tagColumns : state.tagColumns;
    state.userColumns = Array.isArray(data.userColumns) ? data.userColumns : [];
    ensurePermanentColumns();
    syncTagColumnRegistry();
    syncImageTagColumnValues();
    state.userColumns = state.userColumns.filter(c => state.columns.includes(c));
    migrateLegacyTagsData();
    initShowHeads(); initTableShowCols();
    await saveTrades(); render();
    showToast('Excel imported!', 'success');
  } catch (e) { showToast('Import failed', 'error'); }
}

async function importRawCsv(file) {
  const fd = new FormData();
  fd.append('file', file);
  try {
    showToast('Consolidating Zerodha today CSV...', '');
    const res = await fetch('/api/import-raw-csv', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.error) { showToast(data.error, 'error'); return; }
    const imported = (data.trades || []).map(t => {
      const row = normalizeStructuredTradeRow(t);
      row[BROKER_COLUMN] = 'zerodha';
      return row;
    });
    const mergedResult = mergeStructuredTrades(state.trades, imported);
    state.trades = mergedResult.merged;
    state.columns = Array.from(new Set([...(state.columns || []), ...UNIFIED_STRUCTURED_COLUMNS]));
    state.allTags = data.allTags || state.allTags || [];
    state.tagColumns = Array.isArray(data.tagColumns) ? data.tagColumns : state.tagColumns;
    state.userColumns = Array.isArray(state.userColumns) ? state.userColumns : [];
    ensurePermanentColumns();
    syncTagColumnRegistry();
    syncImageTagColumnValues();
    state.userColumns = state.userColumns.filter(c => state.columns.includes(c));
    normalizeStructuredDateColumns();
    migrateLegacyTagsData();
    initShowHeads();
    initTableShowCols();
    await saveTrades();
    render();
    showToast(`Zerodha Today CSV merged: ${mergedResult.added} new trade(s)`, 'success');
  } catch (e) {
    showToast('Zerodha Today CSV import failed', 'error');
  }
}

async function importHistoricalCsv(file) {
  const fd = new FormData();
  fd.append('file', file);
  try {
    showToast('Consolidating Zerodha historical CSV...', '');
    const res = await fetch('/api/import-historical-csv', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.error) { showToast(data.error, 'error'); return; }
    const imported = (data.trades || []).map(t => {
      const row = normalizeStructuredTradeRow(t);
      row[BROKER_COLUMN] = 'zerodha';
      return row;
    });
    const mergedResult = mergeStructuredTrades(state.trades, imported);
    state.trades = mergedResult.merged;
    state.columns = Array.from(new Set([...(state.columns || []), ...UNIFIED_STRUCTURED_COLUMNS]));
    state.allTags = data.allTags || state.allTags || [];
    state.tagColumns = Array.isArray(data.tagColumns) ? data.tagColumns : state.tagColumns;
    state.userColumns = Array.isArray(state.userColumns) ? state.userColumns : [];
    ensurePermanentColumns();
    syncTagColumnRegistry();
    syncImageTagColumnValues();
    state.userColumns = state.userColumns.filter(c => state.columns.includes(c));
    migrateLegacyTagsData();
    initShowHeads();
    initTableShowCols();
    await saveTrades();
    render();
    showToast(`Historical CSV merged: ${mergedResult.added} new trade(s)`, 'success');
  } catch (e) {
    showToast('Historical CSV import failed', 'error');
  }
}

async function importDhanCsv(file) {
  const fd = new FormData();
  fd.append('file', file);
  try {
    showToast('Consolidating Dhan CSV...', '');
    const res = await fetch('/api/import-dhan-csv', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.error) { showToast(data.error, 'error'); return; }
    const imported = (data.trades || []).map(t => {
      const row = normalizeStructuredTradeRow(t);
      row[BROKER_COLUMN] = 'dhan';
      return row;
    });
    const mergedResult = mergeStructuredTrades(state.trades, imported);
    state.trades = mergedResult.merged;
    state.columns = Array.from(new Set([...(state.columns || []), ...UNIFIED_STRUCTURED_COLUMNS]));
    state.allTags = data.allTags || state.allTags || [];
    state.tagColumns = Array.isArray(data.tagColumns) ? data.tagColumns : state.tagColumns;
    state.userColumns = Array.isArray(state.userColumns) ? state.userColumns : [];
    ensurePermanentColumns();
    syncTagColumnRegistry();
    syncImageTagColumnValues();
    state.userColumns = state.userColumns.filter(c => state.columns.includes(c));
    migrateLegacyTagsData();
    initShowHeads();
    initTableShowCols();
    await saveTrades();
    render();
    showToast(`Dhan CSV merged: ${mergedResult.added} new trade(s)`, 'success');
  } catch (e) {
    showToast('Dhan CSV import failed', 'error');
  }
}

async function importJson(file) {
  const fd = new FormData(); fd.append('file', file);
  try {
    showToast('Restoring backup...', '');
    const res = await fetch('/api/import-json', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.error) { showToast(data.error, 'error'); return; }
    state.trades = data.trades;
    state.columns = data.columns;
    state.allTags = data.allTags || state.allTags || [];
    state.tagColumns = Array.isArray(data.tagColumns) ? data.tagColumns : state.tagColumns;
    state.userColumns = Array.isArray(data.userColumns) ? data.userColumns : [];
    ensurePermanentColumns();
    syncTagColumnRegistry();
    syncImageTagColumnValues();
    state.userColumns = state.userColumns.filter(c => state.columns.includes(c));
    normalizeStructuredDateColumns();
    migrateLegacyTagsData();
    initShowHeads(); initTableShowCols();
    render();
    showToast('Backup restored!', 'success');
  } catch (e) { showToast('Restore failed', 'error'); }
}

function backupJson() {
  const name = prompt('Backup name (optional):');
  let url = '/api/backup';
  if (name && String(name).trim()) {
    url += `?name=${encodeURIComponent(String(name).trim())}`;
  }
  window.location.href = url;
}

async function exportExcel() {
  if (!state.trades.length) { showToast('No data to export', 'error'); return; }
  try {
    showToast('Preparing export...', '');
    const res = await fetch('/api/export-excel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trades: state.trades, columns: state.columns })
    });
    if (!res.ok) { showToast('Export failed', 'error'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `trading_journal_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click(); URL.revokeObjectURL(url);
    showToast('Excel exported!', 'success');
  } catch (e) { showToast('Export failed', 'error'); }
}

async function exportStructuredCsv() {
  if (!state.trades.length) { showToast('No data to export', 'error'); return; }
  try {
    normalizeStructuredDateColumns();
    showToast('Preparing structured CSV...', '');
    const res = await fetch('/api/export-structured-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trades: state.trades, columns: state.columns })
    });
    if (!res.ok) { showToast('Structured export failed', 'error'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'structured_trades.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Structured CSV exported!', 'success');
  } catch (e) {
    showToast('Structured export failed', 'error');
  }
}

let toastTimer = null;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast'); t.textContent = msg; t.className = `toast ${type} show`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = 'toast'; }, 3000);
}

function setupDropdown(btnId, menuId) {
  const btn = document.getElementById(btnId);
  const menu = document.getElementById(menuId);
  if (!btn || !menu) return;
  btn.addEventListener('click', e => { e.stopPropagation(); closeAllDropdowns(menuId); menu.classList.toggle('open'); });
}

function closeAllDropdowns(except) {
  document.querySelectorAll('.dropdown-menu.open').forEach(m => { if (m.id !== except) m.classList.remove('open'); });
}


```

## File: `static\js\events-keys.js`
```js
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
      if (e.shiftKey && !e.ctrlKey && !e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); navigateGalleryDate(-1); return; }
      if (e.shiftKey && !e.ctrlKey && !e.altKey && e.key === 'ArrowRight') { e.preventDefault(); navigateGalleryDate(1); return; }

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

## File: `static\js\events-ui.js`
```js
// events-ui.js — Calendar, table, column ops, date range event bindings

function _bindUIEvents() {
  document.getElementById('month-select').addEventListener('change', e => {
    state.month = parseInt(e.target.value);
    renderCalendar();
    renderDashboard();
  });
  document.getElementById('view-select').addEventListener('change', e => {
    state.calendarView = String(e.target.value || 'month');
    renderCalendar();
  });
  document.getElementById('year-select').addEventListener('change', e => {
    state.year = parseInt(e.target.value);
    renderCalendar();
    renderDashboard();
  });
  document.getElementById('prev-month').addEventListener('click', () => {
    if (state.calendarView === 'year') {
      state.year--;
    } else {
      state.month--;
      if (state.month < 0) { state.month = 11; state.year--; }
    }
    syncSelects();
    renderCalendar();
    renderDashboard();
  });
  document.getElementById('next-month').addEventListener('click', () => {
    if (state.calendarView === 'year') {
      state.year++;
    } else {
      state.month++;
      if (state.month > 11) { state.month = 0; state.year++; }
    }
    syncSelects();
    renderCalendar();
    renderDashboard();
  });
  document.getElementById('today-btn').addEventListener('click', () => {
    const now = new Date();
    state.month = now.getMonth();
    state.year = now.getFullYear();
    syncSelects();
    renderCalendar();
    renderDashboard();
  });
  document.getElementById('calendar-mode-btn').addEventListener('click', () => {
    state.calendarMode = state.calendarMode === 'consolidated' ? 'individual' : 'consolidated';
    updateCalendarModeButton();
    renderShowHeads();
    renderCalendar();
    renderTable();
  });

  document.getElementById('show-heads-btn').addEventListener('click', e => {
    e.stopPropagation(); document.getElementById('show-heads-panel').classList.toggle('open');
  });

  setupDropdown('file-dropdown-btn', 'file-dropdown-menu');
  setupDropdown('add-dropdown-btn', 'add-dropdown-menu');
  setupDropdown('col-vis-btn', 'col-vis-panel');
  setupDropdown('view-preset-btn', 'view-preset-panel');
  setupDropdown('broker-filter-btn-top', 'broker-filter-menu-top');
  setupDropdown('dashboard-stats-btn', 'dashboard-stats-menu');

  document.addEventListener('click', () => {
    closeAllDropdowns('__none__');
    document.getElementById('show-heads-panel').classList.remove('open');
  });
  document.getElementById('show-heads-panel').addEventListener('click', e => e.stopPropagation());
  document.getElementById('col-vis-panel').addEventListener('click', e => e.stopPropagation());
  document.getElementById('view-preset-panel').addEventListener('click', e => e.stopPropagation());
  const brokerMenuTop = document.getElementById('broker-filter-menu-top');
  if (brokerMenuTop) brokerMenuTop.addEventListener('click', e => e.stopPropagation());
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
  document.getElementById('backup-btn').addEventListener('click', backupJson);
  document.getElementById('restore-btn').addEventListener('click', () => document.getElementById('json-input').click());
  document.getElementById('json-input').addEventListener('change', e => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; });

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

  const _drFrom = document.getElementById('date-range-from');
  const _drTo = document.getElementById('date-range-to');
  const _drClear = document.getElementById('date-range-clear');
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
    if (_drClear) _drClear.style.display = active ? '' : 'none';
  };
  if (_drFrom) _drFrom.addEventListener('change', () => { state.dateRange.from = _drFrom.value; _saveDateRange(); _updateDateRangeUI(); renderTable(); });
  if (_drTo) _drTo.addEventListener('change', () => { state.dateRange.to = _drTo.value; _saveDateRange(); _updateDateRangeUI(); renderTable(); });
  if (_drClear) _drClear.addEventListener('click', () => {
    state.dateRange = { from: '', to: '' };
    if (_drFrom) _drFrom.value = '';
    if (_drTo) _drTo.value = '';
    _saveDateRange(); _updateDateRangeUI(); renderTable();
  });
  _loadDateRange();
}

```

## File: `static\js\events-gallery.js`
```js
// events-gallery.js — Gallery tools, nav, upload, tags tray, tag cloud event bindings

function _bindGalleryEvents() {
  setupDropdown('gallery-tools-btn', 'gallery-tools-panel');
  const galleryToolsPanel = document.getElementById('gallery-tools-panel');
  if (galleryToolsPanel) galleryToolsPanel.addEventListener('click', e => e.stopPropagation());

  setupDropdown('gallery-show-heads-btn', 'gallery-show-heads-panel');
  const galleryHeadsPanel = document.getElementById('gallery-show-heads-panel');
  if (galleryHeadsPanel) galleryHeadsPanel.addEventListener('click', e => e.stopPropagation());

  setupDropdown('gallery-img-tag-filter-btn', 'gallery-img-tag-filter-panel');
  const galleryFilterPanel = document.getElementById('gallery-img-tag-filter-panel');
  if (galleryFilterPanel) galleryFilterPanel.addEventListener('click', e => e.stopPropagation());

  // Layer panel toggle
  const layerBtn = document.getElementById('gv2-layer-btn');
  if (layerBtn) layerBtn.addEventListener('click', () => {
    if (typeof toggleLayerPanel === 'function') toggleLayerPanel();
  });
  const lpCloseBtn = document.getElementById('gv2-lp-close-btn');
  if (lpCloseBtn) lpCloseBtn.addEventListener('click', () => {
    if (typeof toggleLayerPanel === 'function') toggleLayerPanel();
  });

  // Layer panel selection controls
  document.getElementById('gv2-lp-sel-all')?.addEventListener('click', () => {
    const images = state.gallery.images || [];
    state.gallery.selectedIndices = new Set(images.map((_, i) => i));
    renderGallery();
  });
  document.getElementById('gv2-lp-sel-none')?.addEventListener('click', () => {
    state.gallery.selectedIndices = new Set();
    renderGallery();
  });
  document.getElementById('gv2-lp-sel-inv')?.addEventListener('click', () => {
    const images = state.gallery.images || [];
    const cur = state.gallery.selectedIndices || new Set();
    state.gallery.selectedIndices = new Set(images.map((_, i) => i).filter(i => !cur.has(i)));
    renderGallery();
  });

  // Layer panel resize handle
  (function () {
    const lpHandle = document.getElementById('gv2-lp-resize-handle');
    const lpPanel = document.getElementById('gv2-layer-panel');
    if (!lpHandle || !lpPanel) return;
    const LP_W_KEY = 'tj_layerPanelW';
    const savedW = parseInt(localStorage.getItem(LP_W_KEY) || '200', 10);
    const _lpSetWidth = (w) => {
      lpPanel.style.width = w + 'px';
      lpPanel.style.setProperty('--lp-thumb-w', Math.max(24, Math.min(80, Math.floor(w * 0.22))) + 'px');
    };
    _lpSetWidth(Math.max(140, Math.min(400, savedW)));
    let _lpResizing = false;
    lpHandle.addEventListener('mousedown', e => {
      _lpResizing = true; lpHandle.classList.add('dragging'); e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!_lpResizing) return;
      const panelRect = lpPanel.getBoundingClientRect();
      _lpSetWidth(Math.max(140, Math.min(400, e.clientX - panelRect.left)));
    });
    document.addEventListener('mouseup', () => {
      if (!_lpResizing) return;
      _lpResizing = false; lpHandle.classList.remove('dragging');
      localStorage.setItem(LP_W_KEY, String(parseInt(lpPanel.style.width, 10) || 200));
    });
  })();

  // Gallery modal: prevent browser native context menu (ContextMenu key shows custom menu instead)
  const _galleryModal = document.getElementById('gallery-modal');
  if (_galleryModal) {
    _galleryModal.addEventListener('contextmenu', e => {
      if (!_galleryModal.classList.contains('open')) return;
      e.preventDefault();
    });
  }

  // Ctrl+drag to select thumbnails, Ctrl+Alt+drag to deselect
  let _ctrlDragPending = false, _ctrlDragActive = false, _ctrlDragMode = 'select';
  let _ctrlDragStartPos = null;
  document.addEventListener('mousedown', e => {
    if (!document.getElementById('gallery-modal')?.classList.contains('open')) return;
    if (!e.ctrlKey || e.button !== 0) return;
    const wrap = e.target.closest('.gv2-thumb-wrap');
    if (!wrap || wrap.dataset.globalIdx === undefined) return;
    _ctrlDragPending = true;
    _ctrlDragMode = e.altKey ? 'deselect' : 'select';
    _ctrlDragStartPos = { x: e.clientX, y: e.clientY };
  });
  document.addEventListener('mousemove', e => {
    if (!_ctrlDragPending && !_ctrlDragActive) return;
    if (_ctrlDragPending) {
      const dx = e.clientX - _ctrlDragStartPos.x, dy = e.clientY - _ctrlDragStartPos.y;
      if (Math.sqrt(dx * dx + dy * dy) < 5) return;
      _ctrlDragActive = true; _ctrlDragPending = false;
    }
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const wrap = el?.closest('.gv2-thumb-wrap');
    if (!wrap || wrap.dataset.globalIdx === undefined) return;
    const idx = parseInt(wrap.dataset.globalIdx);
    if (!state.gallery.selectedIndices) state.gallery.selectedIndices = new Set();
    if (_ctrlDragMode === 'select') {
      if (!state.gallery.selectedIndices.has(idx)) {
        state.gallery.selectedIndices.add(idx);
        wrap.querySelector('.gv2-thumb')?.classList.add('selected-thumb');
      }
    } else {
      if (state.gallery.selectedIndices.has(idx)) {
        state.gallery.selectedIndices.delete(idx);
        wrap.querySelector('.gv2-thumb')?.classList.remove('selected-thumb');
      }
    }
  });
  document.addEventListener('mouseup', () => { _ctrlDragPending = false; _ctrlDragActive = false; });

  // Shortcuts popover toggle
  const scBtn = document.getElementById('gv2-shortcuts-btn');
  const scPop = document.getElementById('gv2-shortcuts-popover');
  if (scBtn && scPop) {
    scBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = scPop.style.display !== 'none';
      if (!isOpen && typeof renderShortcutsPopover === 'function') renderShortcutsPopover();
      scPop.style.display = isOpen ? 'none' : 'block';
    });
    document.addEventListener('mousedown', (e) => {
      if (!scBtn.contains(e.target) && !scPop.contains(e.target)) scPop.style.display = 'none';
    });
  }

  document.getElementById('gallery-prev').addEventListener('click', () => navigateGallery(-1));
  document.getElementById('gallery-next').addEventListener('click', () => navigateGallery(1));
  document.getElementById('gallery-date-prev').addEventListener('click', () => navigateGalleryDate(-1));
  document.getElementById('gallery-date-next').addEventListener('click', () => navigateGalleryDate(1));
  document.getElementById('gallery-date-picker').addEventListener('change', e => {
    const dateStr = e.target.value;
    const images = getImagesForDate(dateStr);
    if (images.length) {
      state.gallery.images = images; state.gallery.currentIndex = 0; state.gallery.date = dateStr; state.gallery.sourceRow = null;
      state.gallery._baseImages = [...images];
      state.gallery._baseDate = dateStr;
      state.gallery._baseSourceRow = null;
      if (state.gallery.tagFilter?.length) applyGalleryImageScopeByTagFilter(images[0] || '');
      renderGallery(); updateGalleryDateArrows();
    } else { showToast('No images for this date', ''); }
  });
  document.getElementById('gallery-upload-btn').addEventListener('click', () => {
    if (!state.gallery.date) return;
    let rowIdx = state.trades.findIndex(t => normalizeDate(extractDateFromTrade(t)) === state.gallery.date);
    if (rowIdx === -1) {
      const trade = getOrCreateTrade(state.gallery.date);
      rowIdx = state.trades.indexOf(trade);
      saveTrades();
    }
    state._galleryUploadCallback = () => {
      state.gallery.images = getImagesForDate(state.gallery.date);
      renderGallery();
      updateGalleryDateArrows();
    };
    openUploadModal(rowIdx);
  });
  const gtBtn = document.getElementById('gallery-tag-btn');
  if (gtBtn) gtBtn.addEventListener('click', openGalleryImageTagManager);
  const imgTagAddBtn = document.getElementById('img-tag-add-btn');
  if (imgTagAddBtn) imgTagAddBtn.addEventListener('click', addImageTagFromModal);
  const imgTagInp = document.getElementById('img-tag-new-name');
  if (imgTagInp) imgTagInp.addEventListener('keydown', e => {
    if (e.key === 'Enter') addImageTagFromModal();
  });
  ['img-tag-close-btn', 'img-tag-close-x'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', closeGalleryImageTagManager);
  });
  const imgTagModal = document.getElementById('img-tag-modal');
  if (imgTagModal) imgTagModal.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeGalleryImageTagManager();
  });

  document.getElementById('gallery-close').addEventListener('click', () => {
    if (annotState.active) stopAnnotation();
    closeGalleryImageTagManager();
    document.getElementById('gallery-modal').classList.remove('open');
    unlockBodyScroll();
  });

  document.getElementById('gv2-tags-btn').addEventListener('click', () => {
    const tray = document.getElementById('gv2-tags-tray');
    const btn = document.getElementById('gv2-tags-btn');
    const open = tray.style.display === 'none' || !tray.style.display;
    tray.style.display = open ? 'flex' : 'none';
    btn.classList.toggle('active', open);
    if (open) {
      if (typeof renderGalleryTagsTray === 'function') renderGalleryTagsTray();
      if (typeof renderGalleryVideoUrls === 'function') renderGalleryVideoUrls();
    }
  });

  // gv2-text-btn click is handled by bindAnnotationCanvas() in annotate-fabric.js

  document.getElementById('gv2-tc-mode-btn').addEventListener('click', () => {
    state.gallery.filterMode = state.gallery.filterMode === 'or' ? 'and' : 'or';
    applyGalleryImageScopeByTagFilter((state.gallery.images || [])[state.gallery.currentIndex] || '');
    renderGalleryTagCloud(); renderGallery();
  });

  document.getElementById('gv2-grp-filter-btn')?.addEventListener('click', () => {
    state.gallery.filterGroupMode = state.gallery.filterGroupMode === 'image' ? 'group' : 'image';
    const btn = document.getElementById('gv2-grp-filter-btn');
    const isGrp = state.gallery.filterGroupMode !== 'image';
    if (btn) { btn.textContent = isGrp ? 'Grp' : 'Img'; btn.classList.toggle('active', isGrp); }
    // Img mode mein expand state saaf karo
    if (!isGrp && state.gallery.expandedGroups) state.gallery.expandedGroups.clear();
    if (Array.isArray(state.gallery.tagFilter) && state.gallery.tagFilter.length) renderGallery();
  });

  document.getElementById('gv2-tc-clear-btn').addEventListener('click', () => {
    state.gallery.tagFilter = [];
    applyGalleryImageScopeByTagFilter((state.gallery.images || [])[state.gallery.currentIndex] || '');
    renderGalleryTagCloud(); renderGallery();
  });

  document.getElementById('gv2-obs-btn').addEventListener('click', () => {
    const d = state.gallery.date;
    if (d) {
      document.getElementById('gallery-modal').classList.remove('open');
      unlockBodyScroll();
      openObsModal(d);
    }
  });

  document.getElementById('gv2-add-grp-btn').addEventListener('click', () => {
    const name = prompt('New group name:');
    if (!name || !name.trim()) return;
    const g = name.trim();
    if (!state.tagGroups[g]) state.tagGroups[g] = [];
    saveTagGroups(); renderGalleryTagsTray();
  });
  const delTagBtn = document.getElementById('gv2-del-tag-btn');
  if (delTagBtn) delTagBtn.addEventListener('click', () => {
    state.tagDeleteMode = !state.tagDeleteMode;
    renderGalleryTagsTray();
  });
}

```

## File: `static\js\events-settings.js`
```js
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
      const newW = Math.max(150, Math.min(480, trayRect.right - e.clientX));
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
    const savedSz = parseInt(localStorage.getItem(THUMB_SZ_KEY) || '54', 10);
    document.documentElement.style.setProperty('--thumb-size', Math.max(24, Math.min(250, savedSz)) + 'px');

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
      const newSz = Math.max(36, Math.min(250, _startThumbSz + diff));
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
    if (state._dayUploadKey) {
      if (!state.dayData[state._dayUploadKey]) state.dayData[state._dayUploadKey] = {};
      if (!state.dayData[state._dayUploadKey].images) state.dayData[state._dayUploadKey].images = [];
      state.dayData[state._dayUploadKey].images.push(...state.pendingFiles);
      await saveTrades(); render();
      showToast('Images saved!', 'success');
      state._dayUploadKey = null;
    } else if (state.uploadRow !== null) {
      if (!state.trades[state.uploadRow].images) state.trades[state.uploadRow].images = [];
      state.trades[state.uploadRow].images.push(...state.pendingFiles);
      cleanupImageTagStore(state.trades[state.uploadRow]);
      syncTradeDateField(state.trades[state.uploadRow]);
      saveTrades();
      render();
      showToast('Images saved!', 'success');
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
    if (imgFiles.length) { e.preventDefault(); await handleImageFiles(imgFiles); showToast('Image pasted from clipboard', 'success'); }
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

## File: `static\js\events.js`
```js
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

    // If mouse is in viewport → Fabric.js canvas layer (coming soon)
    if (state._mouseInViewport) {
      showToast('Viewport paste: canvas layer will be available after Fabric.js integration', 'info');
      return;
    }
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
          state.dayData[targetDate].images.push(data.url);
          added++;
          // Add to current gallery view directly so it shows up instantly
          if (!state.gallery.images) state.gallery.images = [];
          state.gallery.images.push(data.url);
          if (state.gallery._baseImages) state.gallery._baseImages.push(data.url);
          state.gallery.currentIndex = state.gallery.images.length - 1;
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
}

function syncSelects() {
  document.getElementById('month-select').value = state.month;
  document.getElementById('year-select').value = state.year;
  const vs = document.getElementById('view-select');
  if (vs) vs.value = state.calendarView;
  const ms = document.getElementById('month-select');
  if (ms) ms.disabled = state.calendarView === 'year';
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
