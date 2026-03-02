# Frontend Context — Table Rendering
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `static\js\table-render.js`
```js
function getFilteredTrades() {
  return state.trades.filter(trade => {
    const colMatch = state.columns.every(col => {
      const fv = (state.filterValues[col] || '').toLowerCase().trim();
      if (!fv) return true;
      const isImageTags = String(col || '').toLowerCase() === 'image tags';
      const tv = isImageTags
        ? getMergedImageTagsForTradeRow(trade).join(',').toLowerCase()
        : String(trade[col] ?? '').toLowerCase();
      if (!isImageTags) return tv.includes(fv);

      const terms = fv.split(',').map(x => x.trim()).filter(Boolean);
      if (!terms.length) return true;
      return terms.every(term => tv.includes(term));
    });
    if (!colMatch) return false;
    if (!tradeMatchesBrokerFilter(trade)) return false;
    if (!tradeMatchesTagFilter(trade)) return false;
    if (state.dateRange.from || state.dateRange.to) {
      const dk = normalizeDate(extractDateFromTrade(trade));
      if (state.dateRange.from && dk < state.dateRange.from) return false;
      if (state.dateRange.to && dk > state.dateRange.to) return false;
    }
    return true;
  });
}

function tradeMatchesBrokerFilter(trade) {
  const broker = String(trade?.[BROKER_COLUMN] || '').trim().toLowerCase();
  if (state.brokerFilter === 'zerodha') return broker === 'zerodha';
  if (state.brokerFilter === 'dhan') return broker === 'dhan';
  return true;
}

function renderTable() {
  syncAllTradeDates();
  syncImageTagColumnValues();
  const headRow = document.getElementById('table-head-row');
  const filterRow = document.getElementById('filter-row');
  const body = document.getElementById('table-body');
  const footRow = document.getElementById('table-foot-row');
  const empty = document.getElementById('table-empty');
  const colgroup = document.getElementById('table-colgroup');

  headRow.innerHTML = '';
  filterRow.innerHTML = '';
  body.innerHTML = '';
  footRow.innerHTML = '';
  colgroup.innerHTML = '';

  if (!state.columns.length && !state.trades.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  const allCols = [...state.columns];
  if (!allCols.some(c => c.toLowerCase() === 'images')) allCols.push('Images');
  const visibleCols = allCols.filter(col => state.tableShowCols[col] !== false);

  const cgDrag = document.createElement('col'); cgDrag.style.width = '36px'; colgroup.appendChild(cgDrag);
  visibleCols.forEach(col => {
    const cg = document.createElement('col');
    cg.style.width = (state.colWidths[col] || getDefaultColWidth(col)) + 'px';
    colgroup.appendChild(cg);
  });

  const thDrag = document.createElement('th'); thDrag.className = 'row-drag-th'; headRow.appendChild(thDrag);

  visibleCols.forEach((col, idx) => {
    const th = document.createElement('th');
    th.className = 'sortable-th';
    th.dataset.col = col;

    const label = document.createElement('span');
    label.textContent = col;
    th.appendChild(label);

    const sort = document.createElement('span');
    sort.className = 'sort-ind';
    if (state.tableSort.col === col) sort.textContent = state.tableSort.dir === 'asc' ? '▲' : '▼';
    th.appendChild(sort);

    th.addEventListener('click', e => {
      if (e.target.classList.contains('col-resizer')) return;
      if (state.tableSort.col === col) {
        state.tableSort.dir = state.tableSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        state.tableSort.col = col;
        state.tableSort.dir = 'asc';
      }
      renderTable();
    });
    if (state.columns.includes(col)) {
      th.title = 'Double-click to rename column';
      th.addEventListener('dblclick', e => {
        e.preventDefault();
        e.stopPropagation();
        openEditColumnModal(col);
      });
    }

    const rz = document.createElement('div');
    rz.className = 'col-resizer';
    bindColumnResizer(rz, col, idx);
    th.appendChild(rz);

    if (state.columns.includes(col) && canDeleteColumn(col)) {
      const del = document.createElement('button');
      del.className = 'col-del-btn';
      del.title = 'Delete column';
      del.type = 'button';
      del.textContent = '×';
      del.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm(`Delete column "${col}"? This will remove data from all rows.`)) {
          deleteColumn(col);
        }
      });
      th.appendChild(del);
    }

    th.addEventListener('dblclick', e => {
      e.stopPropagation();
      openEditColumnModal(col);
    });

    th.draggable = true;
    th.addEventListener('dragstart', e => {
      if (e.target.classList.contains('col-resizer') || e.target.classList.contains('col-del-btn')) {
        e.preventDefault(); return;
      }
      e.dataTransfer.setData('text/plain', col);
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => th.classList.add('col-th-dragging'), 0);
    });
    th.addEventListener('dragend', () => {
      th.classList.remove('col-th-dragging');
      document.querySelectorAll('.col-th-drag-over').forEach(el => el.classList.remove('col-th-drag-over'));
    });
    th.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.col-th-drag-over').forEach(el => el.classList.remove('col-th-drag-over'));
      th.classList.add('col-th-drag-over');
    });
    th.addEventListener('dragleave', () => th.classList.remove('col-th-drag-over'));
    th.addEventListener('drop', e => {
      e.preventDefault();
      th.classList.remove('col-th-drag-over');
      const fromCol = e.dataTransfer.getData('text/plain');
      if (!fromCol || fromCol === col) return;
      const order = [...state.columns];
      const fromIdx = order.indexOf(fromCol);
      const toIdx = order.indexOf(col);
      if (fromIdx === -1 || toIdx === -1) return;
      order.splice(fromIdx, 1);
      order.splice(toIdx, 0, fromCol);
      state.columns = order;
      saveTrades();
      renderColVisPanel();
      renderTable();
    });

    headRow.appendChild(th);
  });

  filterRow.classList.toggle('hidden', !state.filterVisible);
  filterRow.appendChild(document.createElement('td')); // drag handle column
  visibleCols.forEach(col => {
    const td = document.createElement('td');
    if (isTagColumn(col) || col.toLowerCase() === 'images' || col.toLowerCase() === 'thumbnail') {
      filterRow.appendChild(td); return;
    }
    const inp = document.createElement('input'); inp.className = 'filter-input';
    inp.placeholder = 'Search'; inp.value = state.filterValues[col] || '';
    inp.addEventListener('input', () => { state.filterValues[col] = inp.value; renderTableBody(visibleCols, allCols, body, footRow); });
    td.appendChild(inp); filterRow.appendChild(td);
  });

  renderTableBody(visibleCols, allCols, body, footRow);
  applyFrozenColumns(visibleCols);
  renderColVisPanel();
}

function getFrozenCols() {
  try {
    const raw = localStorage.getItem('frozenCols');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        if (!arr.includes(TOTAL_TRADES_COLUMN) && state.columns.includes(TOTAL_TRADES_COLUMN)) {
          arr.splice(1, 0, TOTAL_TRADES_COLUMN);
          localStorage.setItem('frozenCols', JSON.stringify(arr));
        }
        return arr.filter(c => state.columns.includes(c));
      }
    }
  } catch (e) { }
  return ['trade_date', TOTAL_TRADES_COLUMN, 'Images', 'Tags', NOTE_COLUMN, 'Net P/L'].filter(c => state.columns.includes(c));
}

function saveFrozenCols(cols) {
  try { localStorage.setItem('frozenCols', JSON.stringify(cols || [])); } catch (e) { }
}

function applyFrozenColumns(visibleCols) {
  const frozen = getFrozenCols().filter(c => visibleCols.includes(c));
  const table = document.getElementById('trade-table');
  if (!table) return;

  const DRAG_W = 36;
  const ths = Array.from(table.querySelectorAll('thead tr#table-head-row th'));
  const rows = Array.from(table.querySelectorAll('thead tr, tbody tr, tfoot tr'));

  rows.forEach(row => {
    const first = row.children[0];
    if (first) { first.classList.add('frozen-col'); first.style.left = '0px'; }
  });

  if (!frozen.length) return;

  const leftMap = new Map(); // visibleCols index → left px
  let left = DRAG_W; // start right after the drag-handle column
  frozen.forEach(col => {
    const idx = visibleCols.indexOf(col);
    if (idx === -1) return;
    const th = ths[idx + 1]; // +1 because drag-th is ths[0]
    const width = th ? th.getBoundingClientRect().width : (state.colWidths[col] || 120);
    leftMap.set(idx, left);
    left += width;
  });

  rows.forEach(row => {
    const cells = Array.from(row.children);
    leftMap.forEach((l, idx) => {
      const cell = cells[idx + 1]; // +1 for drag-handle cell
      if (!cell) return;
      cell.classList.add('frozen-col');
      cell.style.left = `${l}px`;
    });
  });
}

function renderTableBody(visibleCols, allCols, body, footRow) {
  body.innerHTML = ''; footRow.innerHTML = '';
  const filtered = sortTrades(getFilteredTrades());

  if (state.calendarMode === 'consolidated') {
    renderTableBodyConsolidated(visibleCols, filtered, body, footRow);
    return;
  }

  let lastDateKey = null;
  let band = 0;
  let daySeq = 0;

  filtered.forEach((trade, displayIdx) => {
    const rowIdx = state.trades.indexOf(trade);
    const tr = document.createElement('tr');
    const rowDateKey = normalizeDate(trade['trade_date'] || trade['Date'] || trade.date || '');
    if (rowDateKey !== lastDateKey) {
      band = band === 0 ? 1 : 0;
      if (lastDateKey !== null) tr.classList.add('date-group-start');
      lastDateKey = rowDateKey;
      daySeq = 1;
    } else {
      daySeq++;
    }
    tr.classList.add(band === 1 ? 'date-group-a' : 'date-group-b');

    const tdHandle = document.createElement('td'); tdHandle.className = 'row-drag-td';
    const delMini = document.createElement('button'); delMini.className = 'del-row-mini';
    delMini.textContent = '✕'; delMini.title = 'Delete row';
    delMini.addEventListener('click', () => { state.trades.splice(rowIdx, 1); saveTrades(); render(); });
    const handle = document.createElement('span'); handle.className = 'row-drag-handle';
    handle.textContent = '⠿'; handle.title = 'Drag to reorder';
    handle.addEventListener('mousedown', () => { _rowDragFromHandle = true; });
    tdHandle.appendChild(delMini);
    tdHandle.appendChild(handle);
    tr.appendChild(tdHandle);

    visibleCols.forEach(col => {
      const td = document.createElement('td');
      if (col.toLowerCase() === 'images' || col.toLowerCase() === 'thumbnail') {
        renderImagesCell(td, rowIdx, trade.images || []);
      } else if (col.toLowerCase() === 'image tags') {
        renderImageTagsCell(td, trade);
      } else if (col === NOTE_COLUMN) {
        const noteDiv = document.createElement('div');
        noteDiv.className = 'note-cell';
        noteDiv.setAttribute('data-note-row', rowIdx);
        _refreshNoteCellDisplay(noteDiv, trade[NOTE_COLUMN] || '');
        noteDiv.addEventListener('click', e => { e.stopPropagation(); openNotePopup(td, rowIdx); });
        td.appendChild(noteDiv);
      } else if (col === TOTAL_TRADES_COLUMN) {
        const inp = document.createElement('input'); inp.className = 'cell-input'; inp.readOnly = true;
        inp.value = daySeq;
        inp.style.textAlign = 'center';
        inp.style.fontWeight = 'bold';
        td.appendChild(inp);
      } else if (isTagColumn(col)) {
        renderTagCell(td, rowIdx, col);
      } else if (col === VIDEO_COLUMN) {
        const curUrl = trade[col] || '';
        const vwrap = document.createElement('div'); vwrap.className = 'video-cell';
        if (curUrl) {
          const link = document.createElement('a'); link.href = curUrl; link.target = '_blank';
          link.rel = 'noopener'; link.className = 'video-link-btn'; link.textContent = '▶';
          link.title = 'Open video'; link.addEventListener('click', e => e.stopPropagation());
          vwrap.appendChild(link);
        }
        const vinp = document.createElement('input'); vinp.type = 'url'; vinp.className = 'cell-input video-url-inp';
        vinp.value = curUrl; vinp.placeholder = 'Video URL…';
        vinp.addEventListener('change', () => {
          state.trades[rowIdx][col] = vinp.value.trim();
          saveTrades(); renderTable();
        });
        vwrap.appendChild(vinp);
        td.appendChild(vwrap);
      } else {
        const inp = document.createElement('input'); inp.className = 'cell-input';
        inp.value = trade[col] !== undefined ? trade[col] : '';
        if (col.toLowerCase().includes('profit') || col.toLowerCase() === 'rs') {
          applyProfitColor(inp, inp.value);
          inp.addEventListener('input', () => applyProfitColor(inp, inp.value));
        }
        inp.addEventListener('input', () => {
          if (col.toLowerCase().includes('date')) {
            state.trades[rowIdx][col] = inp.value;
            syncTradeDateField(state.trades[rowIdx]);
          }
        });
        inp.addEventListener('change', () => {
          state.trades[rowIdx][col] = inp.value;
          if (col.toLowerCase().includes('date')) syncTradeDateField(state.trades[rowIdx]);
          saveTrades(); renderCalendar();
        });
        td.appendChild(inp);
      }
      tr.appendChild(td);
    });

    bindRowImageDrop(tr, rowIdx);
    bindTableRowDrag(tr, rowIdx, body);
    body.appendChild(tr);
  });

  footRow.appendChild(document.createElement('td')); // drag-handle column spacer
  visibleCols.forEach(col => {
    const td = document.createElement('td');
    if (col.toLowerCase() === 'date' || col.toLowerCase() === 'trade_date') { td.textContent = `Total (${filtered.length})`; td.style.color = 'var(--text2)'; }
    else if (!isTagColumn(col) && col.toLowerCase() !== 'images' && col.toLowerCase() !== 'thumbnail' && col.toLowerCase() !== 'image tags') {
      const nums = filtered.map(t => parseFloat(t[col])).filter(n => !isNaN(n));
      if (nums.length) {
        const total = nums.reduce((a, b) => a + b, 0);
        td.textContent = total % 1 === 0 ? total : total.toFixed(2);
        if (col.toLowerCase().includes('profit') || col.toLowerCase() === 'rs') td.style.color = total >= 0 ? 'var(--green)' : 'var(--red)';
      }
    }
    footRow.appendChild(td);
  });
}

function renderTableBodyConsolidated(visibleCols, filtered, body, footRow) {
  const sortedByDate = [...filtered].sort((a, b) => {
    const da = normalizeDate(a['trade_date'] || a['Date'] || a.date || '');
    const db = normalizeDate(b['trade_date'] || b['Date'] || b.date || '');
    return da < db ? -1 : da > db ? 1 : 0;
  });

  const dateOrder = [];
  const dateGroups = new Map();
  sortedByDate.forEach(trade => {
    const dk = normalizeDate(trade['trade_date'] || trade['Date'] || trade.date || '');
    if (!dateGroups.has(dk)) { dateGroups.set(dk, []); dateOrder.push(dk); }
    dateGroups.get(dk).push(trade);
  });

  dateOrder.forEach((dateKey, groupIdx) => {
    const dayTrades = dateGroups.get(dateKey);
    const tr = document.createElement('tr');
    tr.classList.add(groupIdx % 2 === 0 ? 'date-group-a' : 'date-group-b');
    tr.appendChild(document.createElement('td')); // spacer for drag-handle column

    visibleCols.forEach(col => {
      const td = document.createElement('td');
      const colLower = col.toLowerCase();

      if (colLower === 'images' || colLower === 'thumbnail') {
        const dayImages = state.dayData[dateKey]?.images || [];
        const tradeImages = dayTrades.reduce((arr, t) => arr.concat(t.images || []), []);
        const allImages = [...dayImages, ...tradeImages];
        const w = document.createElement('div'); w.className = 'img-cell img-cell-grid';
        const maxConsShow = 6;
        allImages.slice(0, maxConsShow).forEach((url) => {
          const item = document.createElement('div'); item.className = 'img-thumb-wrap';
          const img = document.createElement('img'); img.className = 'img-thumb'; img.src = url;
          img.addEventListener('click', e => { e.stopPropagation(); openGalleryForDate(dateKey); });
          item.appendChild(img);
          w.appendChild(item);
        });
        if (allImages.length > maxConsShow) {
          const b = document.createElement('span'); b.className = 'img-count-badge';
          b.textContent = `+${allImages.length - maxConsShow}`;
          b.addEventListener('click', () => openGalleryForDate(dateKey));
          w.appendChild(b);
        }
        const uploadBtn = document.createElement('button');
        uploadBtn.className = 'btn btn-outline day-img-upload-btn';
        uploadBtn.title = 'Add image for this day';
        uploadBtn.textContent = '+ IMG';
        uploadBtn.addEventListener('click', e => {
          e.stopPropagation();
          openDayUploadModal(dateKey);
        });
        w.appendChild(uploadBtn);
        td.appendChild(w);

      } else if (colLower === 'image tags') {
        const allImgTags = getMergedImageTagsForDate(dateKey);
        if (allImgTags.length) {
          const wrap = document.createElement('div'); wrap.className = 'tag-cell';
          allImgTags.forEach(tag => {
            const c = tagColor(tag);
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'tag-chip';
            chip.textContent = tag;
            chip.style.cssText = `color:${c};background:${hexToRgba(c, 0.15)};border-color:${hexToRgba(c, 0.45)}`;
            chip.title = 'Open gallery filtered by this tag';
            chip.addEventListener('click', e => {
              e.stopPropagation();
              openGalleryForDateWithTagFilter(dateKey, [tag]);
            });
            wrap.appendChild(chip);
          });
          td.appendChild(wrap);
        }

      } else if (col === VIDEO_COLUMN) {
        if (!state.dayData[dateKey]) state.dayData[dateKey] = {};
        const curUrl = state.dayData[dateKey].video || '';
        const vwrap = document.createElement('div'); vwrap.className = 'video-cell';
        if (curUrl) {
          const link = document.createElement('a'); link.href = curUrl; link.target = '_blank';
          link.rel = 'noopener'; link.className = 'video-link-btn'; link.textContent = '▶';
          link.title = 'Open video'; link.addEventListener('click', e => e.stopPropagation());
          vwrap.appendChild(link);
        }
        const vinp = document.createElement('input'); vinp.type = 'url'; vinp.className = 'cell-input video-url-inp';
        vinp.value = curUrl; vinp.placeholder = 'Video URL…';
        vinp.addEventListener('change', () => {
          if (!state.dayData[dateKey]) state.dayData[dateKey] = {};
          state.dayData[dateKey].video = vinp.value.trim();
          saveTrades(); renderTable();
        });
        vwrap.appendChild(vinp);
        td.appendChild(vwrap);

      } else if (col === NOTE_COLUMN) {
        const instrCol = state.columns.find(c => /instrument|symbol|scrip|stock/i.test(c));
        const parts = dayTrades
          .filter(t => t[NOTE_COLUMN] && stripHtml(String(t[NOTE_COLUMN])).trim())
          .map(t => {
            const instr = instrCol && t[instrCol] ? `[${t[instrCol]}] ` : '';
            return instr + stripHtml(String(t[NOTE_COLUMN])).trim();
          });
        if (parts.length) {
          const noteDiv = document.createElement('div');
          noteDiv.className = 'note-cell note-cell-merged';
          const joined = parts.join(' | ');
          noteDiv.textContent = joined.length > 80 ? joined.slice(0, 80) + '…' : joined;
          noteDiv.title = parts.join('\n');
          td.appendChild(noteDiv);
        }

      } else if (col === TOTAL_TRADES_COLUMN) {
        const inp = document.createElement('input'); inp.className = 'cell-input'; inp.readOnly = true;
        inp.value = dayTrades.length;
        inp.style.textAlign = 'center';
        inp.style.fontWeight = 'bold';
        td.appendChild(inp);

      } else if (isTagColumn(col)) {
        const wrap = document.createElement('div'); wrap.className = 'tag-cell';
        const seen = new Set();
        dayTrades.forEach(t => getTradeTagsForColumn(t, col).forEach(tag => {
          if (!seen.has(tag)) {
            seen.add(tag);
            const c = tagColor(tag);
            const chip = document.createElement('span'); chip.className = 'tag-chip';
            chip.textContent = tag;
            chip.style.cssText = `color:${c};background:${hexToRgba(c, 0.15)};border-color:${hexToRgba(c, 0.45)}`;
            wrap.appendChild(chip);
          }
        }));
        _getDayLevelTags(dateKey, col).forEach(tag => {
          if (!seen.has(tag)) {
            seen.add(tag);
            const c = tagColor(tag);
            const chip = document.createElement('span'); chip.className = 'tag-chip tag-chip-day';
            chip.textContent = tag;
            chip.style.cssText = `color:${c};background:${hexToRgba(c, 0.15)};border-color:${hexToRgba(c, 0.45)}`;
            chip.title = 'Day tag — click to remove';
            chip.addEventListener('click', e => {
              e.stopPropagation();
              _setDayLevelTag(dateKey, col, tag, false);
              saveTrades(); renderTable();
            });
            wrap.appendChild(chip);
          }
        });
        const addBtn = document.createElement('button'); addBtn.className = 'tag-add-btn';
        addBtn.textContent = '+ Day Tag';
        addBtn.title = 'Add a tag for this whole day';
        addBtn.addEventListener('click', e => { e.stopPropagation(); openTagPickerForDay(dateKey, col); });
        wrap.appendChild(addBtn);
        td.appendChild(wrap);

      } else {
        if (colLower === 'date' || colLower === 'trade_date') {
          const inp = document.createElement('input'); inp.className = 'cell-input'; inp.readOnly = true;
          inp.value = dateKey;
          td.appendChild(inp);
        } else {
          const vals = dayTrades.map(t => t[col]).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
          if (vals.length) {
            const nums = vals.map(v => parseFloat(v));
            const allNumeric = nums.every(n => !isNaN(n));
            if (allNumeric) {
              const inp = document.createElement('input'); inp.className = 'cell-input'; inp.readOnly = true;
              const sum = nums.reduce((a, b) => a + b, 0);
              inp.value = sum % 1 === 0 ? String(sum) : sum.toFixed(2);
              if (colLower.includes('profit') || colLower === 'rs' || col === 'Gross P/L' || col === 'Net P/L') {
                applyProfitColor(inp, inp.value);
              }
              td.appendChild(inp);
            } else {
              const unique = [...new Set(vals.map(v => String(v).trim()).filter(Boolean))];
              const wrap = document.createElement('div'); wrap.className = 'cons-text-cell';
              wrap.textContent = unique.join(' / ');
              td.appendChild(wrap);
            }
          }
        }
      }

      tr.appendChild(td);
    });
    body.appendChild(tr);
  });

  footRow.appendChild(document.createElement('td')); // drag-handle column spacer
  visibleCols.forEach(col => {
    const td = document.createElement('td');
    const colLower = col.toLowerCase();
    if (colLower === 'date' || colLower === 'trade_date') {
      td.textContent = `Total (${filtered.length} trades, ${dateOrder.length} days)`;
      td.style.color = 'var(--text2)';
    } else if (!isTagColumn(col) && colLower !== 'images' && colLower !== 'thumbnail' && colLower !== 'image tags') {
      const nums = filtered.map(t => parseFloat(t[col])).filter(n => !isNaN(n));
      if (nums.length) {
        const total = nums.reduce((a, b) => a + b, 0);
        td.textContent = total % 1 === 0 ? total : total.toFixed(2);
        if (colLower.includes('profit') || colLower === 'rs') td.style.color = total >= 0 ? 'var(--green)' : 'var(--red)';
      }
    }
    footRow.appendChild(td);
  });
}


```

## File: `static\js\table-cols.js`
```js
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
  } catch (e) { }
}
function saveTagGroups() {
  try { localStorage.setItem('tj_tagGroups', JSON.stringify(state.tagGroups)); } catch (e) { }
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
    const img = document.createElement('img'); img.className = 'img-thumb'; img.src = url;
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
    await fetch('/api/delete-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
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
    chip.title = 'Click to remove \u2022 Drag to move \u2022 Ctrl+Drag to copy';
    chip.setAttribute('draggable', 'true');
    chip.addEventListener('dragstart', e => {
      _tagDragIsCopy = e.ctrlKey;
      e.dataTransfer.effectAllowed = e.ctrlKey ? 'copy' : 'move';
      e.dataTransfer.setData('tj-tag', JSON.stringify({ rowIdx, tag, colName }));
      e.stopPropagation(); // prevent row-drag from triggering
    });
    chip.addEventListener('click', e => {
      e.stopPropagation();
      trade[colName] = getTradeTagsForColumn(trade, colName).filter(t => t !== tag);
      if (colName === 'Tags') trade.tags = [...trade[colName]];
      saveTrades(); renderTable(); renderTagFilterPanel();
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


```

## File: `static\js\table-colops.js`
```js
function renderTagFilterPanel() {
  const panel = document.getElementById('tag-filter-panel');
  normalizeAllTagsFromTrades();
  panel.innerHTML = '';
  const keys = getAllColumnTagKeys();
  if (!keys.length) {
    panel.innerHTML = '<p class="panel-hint" style="padding:10px 8px">No tags yet.<br>Add via tag columns.</p>';
    return;
  }

  const actRow = document.createElement('div'); actRow.className = 'panel-act-row';
  const btnAll = document.createElement('button'); btnAll.className = 'panel-act-btn'; btnAll.textContent = 'All';
  const btnNone = document.createElement('button'); btnNone.className = 'panel-act-btn'; btnNone.textContent = 'None';
  btnAll.addEventListener('click', () => { state.tagFilter = [...keys]; renderTagFilterPanel(); applyTagFilter(); });
  btnNone.addEventListener('click', () => { state.tagFilter = []; renderTagFilterPanel(); applyTagFilter(); });
  actRow.appendChild(btnAll); actRow.appendChild(btnNone); panel.appendChild(actRow);

  getTagColumns().forEach(col => {
    const tags = getUniqueTagsForColumn(col);
    if (!tags.length) return;

    const colLabel = document.createElement('div');
    colLabel.className = 'panel-manage-label';
    colLabel.style.marginTop = '6px';
    colLabel.textContent = col;
    panel.appendChild(colLabel);

    const list = document.createElement('div');
    list.className = 'panel-list';
    tags.forEach(tag => {
      const key = makeTagFilterKey(col, tag);
      const lbl = document.createElement('label'); lbl.className = 'head-checkbox';
      const dot = document.createElement('span'); dot.className = 'tag-dot'; dot.style.background = tagColor(tag);
      const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = state.tagFilter.includes(key);
      chk.addEventListener('change', () => {
        if (chk.checked) { if (!state.tagFilter.includes(key)) state.tagFilter.push(key); }
        else state.tagFilter = state.tagFilter.filter(t => t !== key);
        applyTagFilter();
      });
      lbl.appendChild(chk); lbl.appendChild(dot); lbl.appendChild(document.createTextNode(tag));
      list.appendChild(lbl);
    });
    panel.appendChild(list);
  });

  const sep = document.createElement('div'); sep.style.cssText = 'height:1px;background:var(--border);margin:8px 0';
  panel.appendChild(sep);
  const mLabel = document.createElement('div'); mLabel.className = 'panel-manage-label'; mLabel.textContent = 'Delete Tags (Column-wise)';
  panel.appendChild(mLabel);
  getTagColumns().forEach(col => {
    const tags = getUniqueTagsForColumn(col);
    tags.forEach(tag => {
      const key = makeTagFilterKey(col, tag);
      const row = document.createElement('div'); row.className = 'tag-manage-row';
      const dot = document.createElement('span'); dot.className = 'tag-dot'; dot.style.background = tagColor(tag);
      const name = document.createElement('span'); name.textContent = `${col}: ${tag}`; name.style.flex = '1';
      const del = document.createElement('button'); del.className = 'tag-del-btn'; del.textContent = 'x'; del.title = 'Delete in this column only';
      del.addEventListener('click', () => {
        state.tagFilter = state.tagFilter.filter(t => t !== key);
        state.trades.forEach(t => {
          if (Array.isArray(t[col])) t[col] = t[col].filter(x => x !== tag);
          if (col === 'Tags' && Array.isArray(t.tags)) t.tags = t.tags.filter(x => x !== tag);
        });
        saveTrades(); renderTable(); renderTagFilterPanel(); applyTagFilter();
      });
      row.appendChild(dot); row.appendChild(name); row.appendChild(del);
      panel.appendChild(row);
    });
  });
}

function applyTagFilter() {
  renderTable(); renderCalendar();
  const btn = document.getElementById('tag-filter-btn');
  btn.style.borderColor = state.tagFilter.length ? 'var(--blue)' : '';
  btn.style.color = state.tagFilter.length ? 'var(--blue)' : '';
}

function addColumn(colName) {
  if (!colName || !colName.trim()) { state.addTagColumnMode = false; return; }
  const name = colName.trim();
  if (PERMANENT_COLUMNS.map(x => x.toLowerCase()).includes(name.toLowerCase())) {
    state.addTagColumnMode = false;
    showToast('This is a permanent column', 'error');
    return;
  }
  if (state.columns.includes(name)) { state.addTagColumnMode = false; showToast('Column already exists', 'error'); return; }
  const asTagColumn = state.addTagColumnMode || isTagColumn(name);
  state.columns.push(name);
  if (!state.userColumns.includes(name)) state.userColumns.push(name);
  if (asTagColumn) {
    if (!state.tagColumns.includes(name)) state.tagColumns.push(name);
    state.trades.forEach(t => { if (!Array.isArray(t[name])) t[name] = []; });
    state.tableShowCols[name] = true;
    normalizeAllTagsFromTrades();
  } else {
    state.trades.forEach(t => { t[name] = ''; });
    state.tableShowCols[name] = true;
  }
  const defHead = !asTagColumn && isDefaultShowHeadCol(name);
  state.showHeadsConsolidated[name] = defHead;
  state.showHeadsIndividual[name] = defHead;
  saveShowHeads();
  state.addTagColumnMode = false;
  saveTrades(); render(); renderShowHeads();
  showToast(`Column "${name}" added!`, 'success');
}

function renameColumn(oldName, newName) {
  const from = String(oldName || '').trim();
  const to = String(newName || '').trim();
  if (!from || !to) return;
  if (from === to) return;
  if (!state.columns.includes(from)) { showToast('Column not found', 'error'); return; }
  if (state.columns.includes(to)) { showToast('Target column already exists', 'error'); return; }
  const wasTagColumn = isTagColumn(from);

  const idx = state.columns.indexOf(from);
  state.columns[idx] = to;
  if (wasTagColumn) {
    state.tagColumns = state.tagColumns.filter(c => c !== from);
    if (!state.tagColumns.includes(to)) state.tagColumns.push(to);
  }
  if (state.userColumns.includes(from)) {
    state.userColumns = state.userColumns.filter(c => c !== from);
    if (!state.userColumns.includes(to)) state.userColumns.push(to);
  }

  state.trades.forEach(t => {
    const oldVal = t[from];
    if (wasTagColumn) {
      t[to] = Array.isArray(oldVal) ? [...oldVal] : (oldVal ? [String(oldVal)] : []);
    } else {
      t[to] = Array.isArray(oldVal) ? oldVal.join(', ') : oldVal;
    }
    delete t[from];
    if (to === 'Tags') t.tags = Array.isArray(t[to]) ? [...t[to]] : [];
  });

  if (from in state.showHeadsConsolidated) { state.showHeadsConsolidated[to] = state.showHeadsConsolidated[from]; delete state.showHeadsConsolidated[from]; }
  if (from in state.showHeadsIndividual) { state.showHeadsIndividual[to] = state.showHeadsIndividual[from]; delete state.showHeadsIndividual[from]; }
  saveShowHeads();
  if (from in state.tableShowCols) {
    state.tableShowCols[to] = state.tableShowCols[from];
    delete state.tableShowCols[from];
  }
  if (from in state.filterValues) {
    state.filterValues[to] = state.filterValues[from];
    delete state.filterValues[from];
  }
  if (from in state.colWidths) {
    state.colWidths[to] = state.colWidths[from];
    delete state.colWidths[from];
  }
  if (state.tableSort.col === from) state.tableSort.col = to;

  saveTrades();
  render();
  renderShowHeads();
  renderColVisPanel();
  showToast(`Renamed "${from}" to "${to}"`, 'success');
}

function deleteColumn(colName) {
  const name = String(colName || '').trim();
  if (!name) return;
  if (!state.columns.includes(name)) { showToast('Column not found', 'error'); return; }
  if (!canDeleteColumn(name)) {
    showToast('System/import column cannot be deleted', 'error');
    return;
  }

  state.columns = state.columns.filter(c => c !== name);
  state.userColumns = state.userColumns.filter(c => c !== name);
  state.tagColumns = state.tagColumns.filter(c => c !== name);
  state.tagFilter = state.tagFilter.filter(k => parseTagFilterKey(k).col !== name);

  state.trades.forEach(t => {
    delete t[name];
    if (name === 'Tags') delete t.tags;
  });

  delete state.showHeadsConsolidated[name]; delete state.showHeadsIndividual[name]; saveShowHeads();
  delete state.tableShowCols[name];
  delete state.filterValues[name];
  delete state.colWidths[name];
  if (state.tableSort.col === name) state.tableSort.col = null;

  saveTrades();
  render();
  renderShowHeads();
  renderColVisPanel();
  renderTagFilterPanel();
  showToast(`Column "${name}" deleted`, 'success');
}

function openEditColumnModal(defaultCol = '') {
  const sel = document.getElementById('edit-col-select');
  const inp = document.getElementById('edit-col-name');
  const delBtn = document.getElementById('edit-col-delete');
  sel.innerHTML = '';

  if (!state.columns.length) {
    showToast('No editable columns yet', '');
    return;
  }

  state.columns.forEach(c => {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = c;
    if (defaultCol && c === defaultCol) o.selected = true;
    sel.appendChild(o);
  });

  const selected = defaultCol && state.columns.includes(defaultCol) ? defaultCol : state.columns[0];
  sel.value = selected;
  inp.value = selected;
  const canDelete = canDeleteColumn(selected);
  delBtn.disabled = !canDelete;
  delBtn.title = canDelete ? 'Delete this column' : 'System/import column cannot be deleted';
  document.getElementById('edit-col-modal').classList.add('open');
  setTimeout(() => inp.focus(), 20);
}


```
