/**
 * @fileoverview table-cols.js
 * @description Cell rendering, note popup, column sort, resize handles, tag picker, image cell.
 * @exports sortTrades, renderImagesCell, renderImageTagsCell, openNotePopup, closeNotePopup,
 *          bindColumnResizer, loadColWidths, tagColor, renameTagEverywhere,
 *          showCtxMenu, loadTagGroups, saveTagGroups, applyProfitColor, stripHtml
 * @reads state.trades, state.columns, state.tableSort, state.tagGroups, state.colWidths
 * @writes state.tableSort, state.tagGroups, state.colWidths
 * @calls saveTrades, renderTable, openGalleryForDate
 */

function stripHtml(html) {
  if (!html) return '';
  const d = document.createElement('div'); d.innerHTML = html;
  return d.textContent || d.innerText || '';
}

let _notePop = null, _notePopRowIdx = null, _notePopBackdrop = null;

function openNotePopup(td, rowIdx) {
  closeNotePopup(true); // save any open popup first
  _notePopRowIdx = rowIdx;

  _notePopBackdrop = document.createElement('div');
  _notePopBackdrop.className = 'note-popup-backdrop';
  document.body.appendChild(_notePopBackdrop);

  const pop = document.createElement('div');
  pop.className = 'note-popup';

  const toolbar = document.createElement('div');
  toolbar.className = 'note-popup-toolbar';
  [['B', 'bold'], ['I', 'italic'], ['U', 'underline']].forEach(([label, cmd]) => {
    const btn = document.createElement('button');
    btn.className = 'note-popup-tool';
    btn.innerHTML = `<${label.toLowerCase()}>${label}</${label.toLowerCase()}>`;
    btn.title = cmd;
    btn.addEventListener('mousedown', e => { e.preventDefault(); document.execCommand(cmd); editor.focus(); });
    toolbar.appendChild(btn);
  });
  pop.appendChild(toolbar);

  const editor = document.createElement('div');
  editor.className = 'note-popup-editor';
  editor.contentEditable = 'true';
  editor.spellcheck = false;
  editor.innerHTML = state.trades[rowIdx][NOTE_COLUMN] || '';
  if (!editor.innerHTML) editor.innerHTML = '<br>';
  pop.appendChild(editor);

  document.body.appendChild(pop);

  pop.style.position = 'fixed';
  pop.style.top = '50%';
  pop.style.left = '50%';
  pop.style.transform = 'translate(-50%, -50%)';

  editor.focus();
  const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
  _notePop = pop;

  editor.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeNotePopup(false); }
  });

  setTimeout(() => {
    document.addEventListener('mousedown', _notePopOutsideHandler, { capture: true });
  }, 0);
}

function _notePopOutsideHandler(e) {
  if (_notePop && !_notePop.contains(e.target)) {
    _saveNotePopupValue();
  }
}

function _saveNotePopupValue() {
  if (_notePopRowIdx === null || !_notePop) return;
  const editor = _notePop.querySelector('.note-popup-editor');
  const raw = editor ? editor.innerHTML : '';
  const val = stripHtml(raw).trim() ? raw : '';
  state.trades[_notePopRowIdx][NOTE_COLUMN] = val;
  saveTrades();
  const idx = _notePopRowIdx;
  closeNotePopup(false);
  document.querySelectorAll(`[data-note-row="${idx}"]`).forEach(el => {
    _refreshNoteCellDisplay(el, val);
  });
}

function _refreshNoteCellDisplay(noteDiv, val) {
  noteDiv.innerHTML = '';
  const plain = stripHtml(val).trim();
  if (plain) {
    noteDiv.innerHTML = val;
    noteDiv.title = plain;
  } else {
    const ph = document.createElement('span');
    ph.className = 'note-cell-ph';
    ph.textContent = '+ note';
    noteDiv.appendChild(ph);
    noteDiv.title = 'Click to add note';
  }
}

function closeNotePopup(save = false) {
  document.removeEventListener('mousedown', _notePopOutsideHandler, { capture: true });
  if (_notePopBackdrop) { _notePopBackdrop.remove(); _notePopBackdrop = null; }
  if (save && _notePop) _saveNotePopupValue();
  else {
    if (_notePop) { _notePop.remove(); _notePop = null; }
    _notePopRowIdx = null;
  }
}

function normalizeSortVal(v) {
  const s = String(v ?? '').trim();
  if (!s) return { t: 3, v: '' };
  const n = parseFloat(s);
  if (!isNaN(n) && /^[-+]?\d+(\.\d+)?$/.test(s)) return { t: 0, v: n };
  const d = Date.parse(s);
  if (!isNaN(d)) return { t: 1, v: d };
  return { t: 2, v: s.toLowerCase() };
}

function sortTrades(rows) {
  const col = state.tableSort.col;
  if (!col) return rows;
  const dir = state.tableSort.dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = isTagColumn(col)
      ? getTradeTagsForColumn(a, col).join(',')
      : (col.toLowerCase() === 'images'
        ? (a.images || []).length
        : (col.toLowerCase() === 'image tags' ? getMergedImageTagsForTradeRow(a).join(',') : (a[col] ?? '')));
    const bv = isTagColumn(col)
      ? getTradeTagsForColumn(b, col).join(',')
      : (col.toLowerCase() === 'images'
        ? (b.images || []).length
        : (col.toLowerCase() === 'image tags' ? getMergedImageTagsForTradeRow(b).join(',') : (b[col] ?? '')));
    const na = normalizeSortVal(av);
    const nb = normalizeSortVal(bv);
    if (na.t !== nb.t) return (na.t - nb.t) * dir;
    if (na.v < nb.v) return -1 * dir;
    if (na.v > nb.v) return 1 * dir;
    return 0;
  });
}

function getDefaultColWidth(col) {
  if (col === 'Images') return 160;
  if (col === NOTE_COLUMN) return 130;
  if (col === VIDEO_COLUMN) return 180;
  if (col === TOTAL_TRADES_COLUMN) return 80;
  if (col === IMAGE_TAG_COLUMN) return 150;
  if (col === BROKER_COLUMN) return 110;
  if (/net\s*p\/l|gross\s*p\/l|total\s*fees|brokerage|charges?/i.test(col)) return 95;
  if (/date|time/i.test(col)) return 105;
  if (/price|qty|quantity|lot|volume/i.test(col)) return 100;
  return 110;
}

function bindColumnResizer(handle, colName, colIdx) {
  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();
    const th = handle.parentElement;
    const startX = e.clientX;
    const startW = th.getBoundingClientRect().width;
    const onMove = ev => {
      const w = Math.max(50, Math.round(startW + (ev.clientX - startX)));
      state.colWidths[colName] = w;
      const colEls = document.querySelectorAll('#table-colgroup col');
      if (colEls[colIdx + 1]) colEls[colIdx + 1].style.width = w + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      try { localStorage.setItem('tj_colWidths', JSON.stringify(state.colWidths)); } catch (e) { }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
  handle.addEventListener('dblclick', e => {
    e.preventDefault(); e.stopPropagation();
    delete state.colWidths[colName];
    try { localStorage.setItem('tj_colWidths', JSON.stringify(state.colWidths)); } catch (e2) { }
    renderTable();
  });
}

function loadColWidths() {
  try {
    const saved = JSON.parse(localStorage.getItem('tj_colWidths') || '{}');
    if (saved && typeof saved === 'object') {
      Object.assign(state.colWidths, saved);
    }
  } catch (e) { }
}

function loadTagGroups() {
  try {
    const saved = JSON.parse(localStorage.getItem('tj_tagGroups') || '{}');
    if (saved && typeof saved === 'object') state.tagGroups = saved;
    const imgs = JSON.parse(localStorage.getItem('tj_tagImages') || '{}');
    if (imgs && typeof imgs === 'object') state.tagImages = imgs;
  } catch (e) { }
}
function saveTagGroups() {
  try { 
    localStorage.setItem('tj_tagGroups', JSON.stringify(state.tagGroups)); 
    localStorage.setItem('tj_tagImages', JSON.stringify(state.tagImages));
  } catch (e) { }
}

function showCtxMenu(e, items) {
  e.preventDefault();
  e.stopPropagation();
  const existing = document.getElementById('gv2-ctx-menu');
  if (existing) existing.remove();
  const menu = document.createElement('div');
  menu.id = 'gv2-ctx-menu';
  menu.className = 'gv2-ctx-menu';
  items.forEach(item => {
    if (item === 'sep') {
      const sep = document.createElement('div');
      sep.className = 'gv2-ctx-sep';
      menu.appendChild(sep);
    } else if (item.header) {
      const h = document.createElement('div');
      h.className = 'gv2-ctx-header';
      h.textContent = item.header;
      menu.appendChild(h);
    } else {
      const btn = document.createElement('div');
      btn.className = 'gv2-ctx-item';
      btn.textContent = item.label;
      btn.addEventListener('mousedown', ev => { ev.stopPropagation(); });
      btn.addEventListener('click', () => { menu.remove(); item.action(); });
      menu.appendChild(btn);
    }
  });
  document.body.appendChild(menu);
  const x = Math.min(e.clientX, window.innerWidth - menu.offsetWidth - 6);
  const y = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 6);
  menu.style.left = Math.max(4, x) + 'px';
  menu.style.top = Math.max(4, y) + 'px';
  const close = ev => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', close); } };
  setTimeout(() => document.addEventListener('mousedown', close), 0);
}

async function renameTagEverywhere(oldTag, newTag) {
  const n = newTag.trim();
  if (!n || n === oldTag) return;
  const renameInArr = arr => {
    if (!Array.isArray(arr)) return;
    for (let i = 0; i < arr.length; i++) if (arr[i] === oldTag) arr[i] = n;
  };
  renameInArr(state.allTags);
  Object.values(state.tagGroups).forEach(renameInArr);
  if (state.tagImages && state.tagImages[oldTag]) {
    state.tagImages[n] = state.tagImages[oldTag];
    delete state.tagImages[oldTag];
  }
  state.trades.forEach(tr => {
    if (tr.imageTags) Object.values(tr.imageTags).forEach(renameInArr);
    if (tr.marqueeBoxes) Object.values(tr.marqueeBoxes).forEach(boxes =>
      (boxes || []).forEach(b => renameInArr(b.tags)));
  });
  Object.values(state.dayData).forEach(day => {
    if (day.imageTags) Object.values(day.imageTags).forEach(renameInArr);
    if (day.marqueeBoxes) Object.values(day.marqueeBoxes).forEach(boxes =>
      (boxes || []).forEach(b => renameInArr(b.tags)));
  });
  renameInArr(annotState.marqueeBoxes ? annotState.marqueeBoxes.flatMap(b => b.tags || []) : []);
  (annotState.marqueeBoxes || []).forEach(b => renameInArr(b.tags));
  if (state._marqueeBoxes) Object.values(state._marqueeBoxes).forEach(boxes =>
    (boxes || []).forEach(b => renameInArr(b.tags)));
  saveTagGroups();
  await saveTrades();
  normalizeAllTagsFromTrades();
  renderGalleryTagCloud();
  renderGalleryTagsTray();
  renderTable();
  renderCalendar();
  showToast(`Tag renamed: "${oldTag}" → "${n}"`, 'success');
}

function applyProfitColor(inp, val) {
  const n = parseFloat(val);
  inp.style.color = !isNaN(n) ? (n >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text)';
}

function renderImagesCell(td, rowIdx, images) {
  const w = document.createElement('div'); w.className = 'img-cell img-cell-grid';
  const maxShow = 6;
  images.slice(0, maxShow).forEach((url, i) => {
    const item = document.createElement('div'); item.className = 'img-thumb-wrap';
    const img = document.createElement('img'); img.className = 'img-thumb'; img.src = resolveImageUrl(url);
    img.onerror = () => { img.style.opacity = '0.2'; img.style.filter = 'grayscale(1)'; img.title = 'Image not found on server'; };
    img.setAttribute('draggable', 'true');
    img.addEventListener('click', e => { e.stopPropagation(); openGalleryDirect(images, i, rowIdx); });
    img.addEventListener('dragstart', e => {
      e.stopPropagation();
      e.dataTransfer.setData('tj-img', JSON.stringify({ rowIdx, url }));
      e.dataTransfer.effectAllowed = e.ctrlKey ? 'copy' : 'move';
    });
    const del = document.createElement('button'); del.className = 'img-thumb-del'; del.textContent = '×'; del.title = 'Delete image';
    del.addEventListener('click', async e => {
      e.stopPropagation();
      await deleteImageFromRow(rowIdx, url);
    });
    item.appendChild(img);
    item.appendChild(del);
    w.appendChild(item);
  });
  if (images.length > maxShow) {
    const b = document.createElement('span'); b.className = 'img-count-badge'; b.textContent = `+${images.length - maxShow}`;
    b.addEventListener('click', () => openGalleryDirect(images, maxShow, rowIdx)); w.appendChild(b);
  }
  const ub = document.createElement('button'); ub.className = 'img-upload-btn'; ub.textContent = '+ Upload';
  ub.addEventListener('click', e => { e.stopPropagation(); openUploadModal(rowIdx); });
  w.appendChild(ub); td.appendChild(w);
}

function renderImageTagsCell(td, trade) {
  const wrap = document.createElement('div');
  wrap.className = 'tag-cell';
  const tags = getMergedImageTagsForTradeRow(trade);
  const dateKey = normalizeDate(extractDateFromTrade(trade));
  if (!tags.length) {
    const empty = document.createElement('span');
    empty.style.color = 'var(--text2)';
    empty.textContent = '-';
    wrap.appendChild(empty);
    td.appendChild(wrap);
    return;
  }
  const isRed = tags.length > 5;
  tags.forEach(tag => {
    const c = isRed ? '#ff6b6b' : tagColor(tag);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tag-chip';
    chip.textContent = tag;
    chip.style.color = c;
    chip.style.background = isRed ? 'rgba(255, 107, 107, 0.15)' : hexToRgba(c, 0.15);
    chip.style.borderColor = isRed ? 'rgba(255, 107, 107, 0.45)' : hexToRgba(c, 0.45);
    chip.title = 'Open gallery filtered by this tag';
    chip.addEventListener('click', e => {
      e.stopPropagation();
      if (!dateKey) return;
      openGalleryForDateWithTagFilter(dateKey, [tag]);
    });
    wrap.appendChild(chip);
  });
  td.appendChild(wrap);
}

async function deleteImageFromRow(rowIdx, imageUrl) {
  const trade = state.trades[rowIdx];
  if (!trade) return;
  trade.images = (trade.images || []).filter(u => u !== imageUrl);
  cleanupImageTagStore(trade);
  if (trade.overlays && trade.overlays[imageUrl]) delete trade.overlays[imageUrl];

  try {
    const filename = String(imageUrl || '').split('/').pop();
    await imageService.deleteImage('/uploads/' + filename);
  } catch (e) { }

  await saveTrades();
  render();
  showToast('Image deleted', 'success');
}

const TAG_PALETTE = ['#3fb950', '#58a6ff', '#d29922', '#bc8cff', '#f85149', '#79b8ff', '#56d364', '#ffa657'];
function tagColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h) + name.charCodeAt(i);
  return TAG_PALETTE[Math.abs(h) % TAG_PALETTE.length];
}
function hexToRgba(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function renderTagCell(td, rowIdx, colName) {
  const trade = state.trades[rowIdx];
  const wrap = document.createElement('div'); wrap.className = 'tag-cell';
  getTradeTagsForColumn(trade, colName).forEach(tag => {
    const c = tagColor(tag);
    const chip = document.createElement('span'); chip.className = 'tag-chip';
    chip.textContent = tag;
    chip.style.color = c;
    chip.style.background = hexToRgba(c, 0.15);
    chip.style.borderColor = hexToRgba(c, 0.45);
    chip.title = 'Click to filter \u2022 Drag to move \u2022 Ctrl+Drag to copy';
    chip.setAttribute('draggable', 'true');
    chip.addEventListener('dragstart', e => {
      _tagDragIsCopy = e.ctrlKey;
      e.dataTransfer.effectAllowed = e.ctrlKey ? 'copy' : 'move';
      e.dataTransfer.setData('tj-tag', JSON.stringify({ rowIdx, tag, colName }));
      e.stopPropagation(); // prevent row-drag from triggering
    });
    chip.addEventListener('click', e => {
      e.stopPropagation();
      const fk = makeTagFilterKey(colName, tag);
      if (state.tagFilter.length === 1 && state.tagFilter[0] === fk) {
        state.tagFilter = []; // Toggle off if clicking the only active filter
      } else {
        state.tagFilter = [fk]; // Replace filters with this one tag
      }
      if (typeof renderTagFilterPanel === 'function') renderTagFilterPanel();
      if (typeof applyTagFilter === 'function') applyTagFilter();
    });
    wrap.appendChild(chip);
  });
  const addBtn = document.createElement('button'); addBtn.className = 'tag-add-btn'; addBtn.textContent = '+ Tag';
  addBtn.addEventListener('click', e => { e.stopPropagation(); openTagPicker(rowIdx, colName); });
  wrap.appendChild(addBtn);

  td.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('tj-tag')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = _tagDragIsCopy ? 'copy' : 'move';
    td.classList.add('tag-drop-hover');
  });
  td.addEventListener('dragleave', () => td.classList.remove('tag-drop-hover'));
  td.addEventListener('drop', e => {
    td.classList.remove('tag-drop-hover');
    if (!e.dataTransfer.types.includes('tj-tag')) return;
    e.preventDefault(); e.stopPropagation();
    let payload; try { payload = JSON.parse(e.dataTransfer.getData('tj-tag')); } catch { return; }
    const { rowIdx: srcRowIdx, tag: srcTag, colName: srcCol } = payload;
    if (srcCol !== colName) return; // only same column
    if (srcRowIdx === rowIdx) return; // same row — no-op
    const tgtTrade = state.trades[rowIdx];
    const tgtTags = getTradeTagsForColumn(tgtTrade, colName);
    if (!tgtTags.includes(srcTag)) {
      tgtTrade[colName] = [...tgtTags, srcTag];
      if (colName === 'Tags') tgtTrade.tags = [...tgtTrade[colName]];
    }
    if (!_tagDragIsCopy) {
      const srcTrade = state.trades[srcRowIdx];
      srcTrade[colName] = getTradeTagsForColumn(srcTrade, colName).filter(t => t !== srcTag);
      if (colName === 'Tags') srcTrade.tags = [...srcTrade[colName]];
    }
    saveTrades(); renderTable(); renderTagFilterPanel();
  });

  td.appendChild(wrap);
}

let _tagPickerRow = null;
let _tagPickerCol = 'Tags';
let _tagPickerDate = null; // non-null when editing day-level tags
let _tagDragIsCopy = false; // true when Ctrl held during tag chip dragstart

function openTagPicker(rowIdx, colName = 'Tags') {
  _tagPickerRow = rowIdx;
  _tagPickerDate = null;
  _tagPickerCol = colName;
  const modal = document.getElementById('tag-modal');
  const inp = document.getElementById('tag-picker-inp');
  const trade = state.trades[rowIdx] || {};
  const label = trade.date || trade['Date'] || `Row ${rowIdx + 1}`;
  document.getElementById('tag-modal-title').textContent = `${colName} - ${label}`;
  inp.value = ''; updateTagPickerList('');
  modal.classList.add('open');
  inp.focus();
}

function openTagPickerForDay(dateKey, colName = 'Tags') {
  _tagPickerRow = null;
  _tagPickerDate = dateKey;
  _tagPickerCol = colName;
  const modal = document.getElementById('tag-modal');
  const inp = document.getElementById('tag-picker-inp');
  document.getElementById('tag-modal-title').textContent = `${colName} - ${dateKey} (day)`;
  inp.value = ''; updateTagPickerList('');
  modal.classList.add('open');
  inp.focus();
}

function closeTagPicker() {
  document.getElementById('tag-modal').classList.remove('open');
  _tagPickerRow = null;
  _tagPickerDate = null;
  _tagPickerCol = 'Tags';
}

function _getDayLevelTags(dateKey, colName) {
  return (state.dayData[dateKey]?.tags?.[colName]) || [];
}
function _setDayLevelTag(dateKey, colName, tag, add) {
  if (!state.dayData[dateKey]) state.dayData[dateKey] = {};
  if (!state.dayData[dateKey].tags) state.dayData[dateKey].tags = {};
  const arr = Array.isArray(state.dayData[dateKey].tags[colName]) ? state.dayData[dateKey].tags[colName] : [];
  if (add) { if (!arr.includes(tag)) arr.push(tag); }
  else { state.dayData[dateKey].tags[colName] = arr.filter(t => t !== tag); return; }
  state.dayData[dateKey].tags[colName] = arr;
}

function updateTagPickerList(q) {
  if (_tagPickerRow === null && _tagPickerDate === null) return;
  const isDayMode = _tagPickerDate !== null;

  let currentTags;
  if (isDayMode) {
    currentTags = _getDayLevelTags(_tagPickerDate, _tagPickerCol);
  } else {
    const trade = state.trades[_tagPickerRow];
    currentTags = trade ? getTradeTagsForColumn(trade, _tagPickerCol) : [];
  }

  const list = document.getElementById('tag-picker-list');
  list.innerHTML = '';

  const columnTags = getUniqueTagsForColumn(_tagPickerCol);
  const filtered = q ? columnTags.filter(t => t.toLowerCase().includes(q.toLowerCase())) : columnTags;
  filtered.forEach(tag => {
    const item = document.createElement('label'); item.className = 'tag-picker-item';
    const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = currentTags.includes(tag);
    const dot = document.createElement('span'); dot.className = 'tag-dot'; dot.style.background = tagColor(tag);
    const nameSpan = document.createElement('span'); nameSpan.textContent = tag; nameSpan.style.color = tagColor(tag);
    chk.addEventListener('change', () => {
      if (isDayMode) {
        _setDayLevelTag(_tagPickerDate, _tagPickerCol, tag, chk.checked);
        saveTrades(); renderTable();
      } else {
        const trade = state.trades[_tagPickerRow];
        const arr = ensureTagArray(trade, _tagPickerCol);
        if (chk.checked) { if (!arr.includes(tag)) arr.push(tag); }
        else trade[_tagPickerCol] = arr.filter(t => t !== tag);
        if (_tagPickerCol === 'Tags') trade.tags = [...ensureTagArray(trade, _tagPickerCol)];
        saveTrades(); renderTable(); renderTagFilterPanel();
      }
    });
    item.appendChild(chk); item.appendChild(dot); item.appendChild(nameSpan);
    list.appendChild(item);
  });

  const trimQ = q.trim();
  if (trimQ && !columnTags.some(t => t.toLowerCase() === trimQ.toLowerCase())) {
    const createItem = document.createElement('div'); createItem.className = 'tag-picker-create';
    createItem.textContent = `+ Create "${trimQ}"`;
    createItem.addEventListener('click', () => {
      if (!state.allTags.some(t => t.toLowerCase() === trimQ.toLowerCase())) state.allTags.push(trimQ);
      if (isDayMode) {
        _setDayLevelTag(_tagPickerDate, _tagPickerCol, trimQ, true);
        saveTrades(); renderTable();
      } else {
        const arr = ensureTagArray(state.trades[_tagPickerRow], _tagPickerCol);
        if (!arr.includes(trimQ)) arr.push(trimQ);
        if (_tagPickerCol === 'Tags') state.trades[_tagPickerRow].tags = [...arr];
        saveTrades(); renderTable(); renderTagFilterPanel();
      }
      document.getElementById('tag-picker-inp').value = ''; updateTagPickerList('');
    });
    list.appendChild(createItem);
  }

  if (!filtered.length && !trimQ) {
    const hint = document.createElement('p'); hint.className = 'panel-hint'; hint.style.padding = '8px';
    hint.textContent = 'Type to create a tag'; list.appendChild(hint);
  }
}

