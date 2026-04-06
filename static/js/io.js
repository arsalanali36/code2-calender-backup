/**
 * @fileoverview io.js
 * @description Upload modal, image drag-drop on table rows, CSV/JSON import, export, backup, toast.
 * @exports openUploadModal, openDayUploadModal, renderUploadPreview, handleImageFiles,
 *          uploadImagesToRow, uploadImagesToDayData, bindRowImageDrop, bindTableRowDrag,
 *          importExcel, importRawCsv, importHistoricalCsv, importDhanCsv, importJson,
 *          backupJson, exportExcel, exportStructuredCsv,
 *          showToast, setupDropdown, closeAllDropdowns
 * @reads state.trades, state.dayData, state.uploadRow, state.pendingFiles, state._dayUploadKey
 * @writes state.pendingFiles, state.trades[].images, state.dayData[].images
 * @calls saveTrades, render, fetch /api/upload, /api/backup, /api/import-json
 */


function _resetUploadProgress() {
  const el = document.getElementById('upload-progress');
  const bar = document.getElementById('upload-progress-bar');
  const txt = document.getElementById('upload-progress-text');
  if (el) el.style.display = 'none';
  if (bar) bar.style.width = '0%';
  if (txt) txt.textContent = '';
}

function openUploadModal(rowIdx) {
  syncTradeDateField(state.trades[rowIdx]);
  const isNews = (state.gallery?.selectedSeparator === 'NEWS');
  state.uploadRow = rowIdx;
  state._dayUploadKey = null;
  state.pendingFiles = []; // Start empty instead of existing images
  document.getElementById('upload-modal-title').textContent = `Images — ${state.trades[rowIdx].date || `Row ${rowIdx + 1}`} ${isNews ? '(NEWS MODE)' : ''}`;
  _resetUploadProgress();
  renderUploadPreview();
  document.getElementById('upload-modal').classList.add('open');
}

function openDayUploadModal(dateKey) {
  const isNews = (state.gallery?.selectedSeparator === 'NEWS');
  state.uploadRow = null;
  state._dayUploadKey = dateKey;
  state.pendingFiles = []; // Start empty instead of existing images
  document.getElementById('upload-modal-title').textContent = `Images — ${dateKey} ${isNews ? '(NEWS MODE)' : ''}`;
  _resetUploadProgress();
  renderUploadPreview();
  document.getElementById('upload-modal').classList.add('open');
}

function renderUploadPreview() {
  const c = document.getElementById('upload-preview'); c.innerHTML = '';
  state.pendingFiles.forEach((url, i) => {
    const item = document.createElement('div'); item.className = 'preview-item';
    const img = document.createElement('img'); img.src = resolveImageUrl(url);
    const del = document.createElement('button'); del.className = 'remove-preview'; del.textContent = 'âœ•';
    del.addEventListener('click', () => { state.pendingFiles.splice(i, 1); renderUploadPreview(); });
    item.appendChild(img); item.appendChild(del); c.appendChild(item);
  });
}

async function handleImageFiles(files) {
  const sorted = [...files].sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, {numeric: true, sensitivity: 'base'}));

  // Show local thumbnails immediately — no waiting for server
  const localUrls = sorted.map(f => URL.createObjectURL(f));
  state.pendingFiles.push(...localUrls);
  renderUploadPreview();

  const total = sorted.length;
  let done = 0, failed = 0;

  const progressWrap = document.getElementById('upload-progress');
  const progressBar = document.getElementById('upload-progress-bar');
  const progressText = document.getElementById('upload-progress-text');
  const updateProgress = () => {
    if (!progressWrap) return;
    const pct = Math.round((done / total) * 100);
    progressWrap.style.display = '';
    if (progressBar) progressBar.style.width = pct + '%';
    if (progressText) {
      if (done < total) {
        progressText.textContent = `Uploading... ${done} / ${total} (${pct}%)`;
        progressText.style.color = 'var(--text2)';
      } else {
        progressText.textContent = failed ? `${total - failed} / ${total} uploaded (${failed} failed)` : `${total} / ${total} uploaded ✓`;
        progressText.style.color = failed ? 'var(--red,#e74c3c)' : 'var(--green,#2ecc71)';
      }
    }
  };
  updateProgress();

  // Upload all in parallel, replace blob URL with server URL as each finishes
  let totalOrig = 0, totalComp = 0;
  const isNewsUpload = (state.gallery?.selectedSeparator === 'NEWS');
  
  await Promise.all(sorted.map(async (file, i) => {
    try {
      const q = isNewsUpload ? 0.25 : null;
      if (isNewsUpload) console.log(`[Upload] News mode active, applying 0.25 quality to ${file.name}`);
      
      const data = await imageService.uploadImage(file, q);
      totalOrig += data.originalSize || 0;
      totalComp += data.compressedSize || 0;
      const idx = state.pendingFiles.indexOf(localUrls[i]);
      if (data.url && idx >= 0) {
        state.pendingFiles[idx] = data.url;
        URL.revokeObjectURL(localUrls[i]);
        renderUploadPreview();
      }
    } catch (e) {
      failed++;
      const idx = state.pendingFiles.indexOf(localUrls[i]);
      if (idx >= 0) state.pendingFiles.splice(idx, 1);
      URL.revokeObjectURL(localUrls[i]);
      renderUploadPreview();
    }
    done++;
    updateProgress();
  }));

  if (isNewsUpload) {
     if (totalComp < totalOrig) {
        const saved = ((totalOrig - totalComp) / 1024).toFixed(0);
        const pct = ((1 - totalComp / totalOrig) * 100).toFixed(0);
        showToast(`NEWS COMPRESSED: Saved ${saved} KB (${pct}%)`, 'success');
     } else {
        showToast(`News upload: but no size change matched.`, 'info');
     }
  }

  if (failed) showToast(`${failed} image(s) failed to upload`, 'error');
}

async function uploadImagesToRow(rowIdx, files) {
  if (!Array.isArray(files) || !files.length) return;
  const trade = state.trades[rowIdx];
  if (!trade) return;
  if (!trade.images) trade.images = [];
  syncTradeDateField(trade);
  const sorted = [...files]
    .filter(f => f && String(f.type || '').startsWith('image/'))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, {numeric: true, sensitivity: 'base'}));
  if (!sorted.length) return;
  const results = await Promise.allSettled(sorted.map(f => imageService.uploadImage(f)));
  const urls = results.filter(r => r.status === 'fulfilled' && r.value?.url).map(r => r.value.url);
  if (urls.length) {
    trade.images.push(...urls);
    await saveTrades();
    render();
    showToast(`${urls.length} image${urls.length > 1 ? 's' : ''} added to row`, 'success');
  }
}

async function uploadImagesToDayData(dateKey, files) {
  if (!Array.isArray(files) || !files.length) return;
  if (!state.dayData[dateKey]) state.dayData[dateKey] = {};
  if (!state.dayData[dateKey].images) state.dayData[dateKey].images = [];
  const sorted = [...files]
    .filter(f => f && String(f.type || '').startsWith('image/'))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, {numeric: true, sensitivity: 'base'}));
  if (!sorted.length) return;
  const results = await Promise.allSettled(sorted.map(f => imageService.uploadImage(f)));
  const urls = results.filter(r => r.status === 'fulfilled' && r.value?.url).map(r => r.value.url);
  if (urls.length) {
    state.dayData[dateKey].images.push(...urls);
    await saveTrades();
    render();
    showToast(`${urls.length} image${urls.length > 1 ? 's' : ''} added`, 'success');
  }
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
  try {
    showToast('Importing Excel...', '');
    const data = await importService.importExcel(file);
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
  try {
    showToast('Consolidating Zerodha today CSV...', '');
    const data = await importService.importRawCsv(file);
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
    setTimeout(() => {
      if (typeof showTargetTrackerModal === 'function') showTargetTrackerModal(imported);
    }, 500);
  } catch (e) {
    showToast('Zerodha Today CSV import failed', 'error');
  }
}

async function importHistoricalCsv(file) {
  try {
    showToast('Consolidating Zerodha historical CSV...', '');
    const data = await importService.importHistoricalCsv(file);
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
  try {
    showToast('Consolidating Dhan CSV...', '');
    const data = await importService.importDhanCsv(file);
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
  try {
    showToast('Restoring backup...', '');
    const data = await importService.importJsonOrZip(file);
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
  const name = prompt('Backup name (optional):') || '';
  exportService.downloadBackup(String(name).trim());
}

async function exportExcel() {
  if (!state.trades.length) { showToast('No data to export', 'error'); return; }
  try {
    showToast('Preparing export...', '');
    await exportService.exportExcel({ trades: state.trades, columns: state.columns });
    showToast('Excel exported!', 'success');
  } catch (e) { showToast('Export failed', 'error'); }
}

async function exportStructuredCsv() {
  if (!state.trades.length) { showToast('No data to export', 'error'); return; }
  try {
    normalizeStructuredDateColumns();
    showToast('Preparing structured CSV...', '');
    await exportService.exportStructuredCsv({ trades: state.trades, columns: state.columns });
    showToast('Structured CSV exported!', 'success');
  } catch (e) { showToast('Structured export failed', 'error'); }
}

async function exportLoggerExcel() {
  if (!state.trades.length) { showToast('No data to export', 'error'); return; }
  try {
    showToast('Preparing logger Excel...', '');
    await exportService.exportLoggerExcel({ trades: state.trades, columns: state.columns });
    showToast('Logger Excel exported!', 'success');
  } catch (e) { showToast('Logger export failed', 'error'); }
}

let toastTimer = null;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast'); t.textContent = msg; t.className = `toast ${type} show`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = 'toast'; }, 3000);
}

function _getMobileBackdrop() {
  let bd = document.getElementById('_mob-dd-backdrop');
  if (!bd) {
    bd = document.createElement('div');
    bd.id = '_mob-dd-backdrop';
    bd.style.cssText = 'display:none;position:fixed;inset:0;z-index:7999;background:rgba(0,0,0,0.45);';
    bd.addEventListener('click', () => closeAllDropdowns('__none__'));
    document.body.appendChild(bd);
  }
  return bd;
}

function setupDropdown(btnId, menuId) {
  const btn = document.getElementById(btnId);
  const menu = document.getElementById(menuId);
  if (!btn || !menu) return;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const wasOpen = menu.classList.contains('open');
    closeAllDropdowns(menuId);
    if (!wasOpen) {
      menu.classList.add('open');
      if (window.innerWidth <= 768) _getMobileBackdrop().style.display = 'block';
    }
  });
}

function closeAllDropdowns(except) {
  document.querySelectorAll('.dropdown-menu.open').forEach(m => { 
    if (m.id !== except && !m.classList.contains('mtm-panel')) m.classList.remove('open'); 
  });
  const bd = document.getElementById('_mob-dd-backdrop');
  if (bd) bd.style.display = 'none';
}

