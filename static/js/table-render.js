/**
 * @fileoverview table-render.js
 * @description Renders the trade table (header + body), frozen columns, consolidated view.
 * @exports renderTable, renderTableBody, renderTableBodyConsolidated,
 *          getFilteredTrades, getFrozenCols, saveFrozenCols, applyFrozenColumns
 * @reads state.trades, state.columns, state.tableSort, state.filterValues,
 *        state.tableShowCols, state.dateRange, state.calendarMode
 * @calls renderTableBody, applyFrozenColumns, getActiveShowHeads, getFilteredTrades
 */

function getFilteredTrades() {
  return state.trades.filter(trade => {
    // Exclude manual empty rows without actual data (e.g., added manually, empty fields)
    const t = trade;
    if (!t['Time'] && !t['Ex Time'] && !t['Buy Time'] && !t['Sell Time'] && !t['Gross P/L'] && !t['Net P/L'] && !t['Rs'] && !t['Qty']) {
      return false;
    }

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
    if (!tradeMatchesDateRange(trade)) return false;
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
    const thumbBtn = document.createElement('span'); thumbBtn.className = 'row-thumb-btn';
    thumbBtn.textContent = '📷'; thumbBtn.title = 'View trade images';
    thumbBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof openTradeSidebar === 'function') openTradeSidebar(trade);
    });
    tdHandle.appendChild(delMini);
    tdHandle.appendChild(handle);
    tdHandle.appendChild(thumbBtn);
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
          const img = document.createElement('img'); img.className = 'img-thumb'; img.src = resolveImageUrl(url);
          img.onerror = () => { img.style.opacity = '0.2'; img.style.filter = 'grayscale(1)'; img.title = 'Image not found on server'; };
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
            chip.title = 'Click to filter (exclusive)';
            chip.addEventListener('click', e => {
              e.stopPropagation();
              const fk = typeof makeTagFilterKey === 'function' ? makeTagFilterKey(col, tag) : `${col}::${tag}`;
              if (state.tagFilter.length === 1 && state.tagFilter[0] === fk) {
                state.tagFilter = [];
              } else {
                state.tagFilter = [fk];
              }
              if (typeof renderTagFilterPanel === 'function') renderTagFilterPanel();
              if (typeof applyTagFilter === 'function') applyTagFilter();
            });
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
            chip.title = 'Day tag — click to filter (exclusive)';
            chip.addEventListener('click', e => {
              e.stopPropagation();
              const fk = typeof makeTagFilterKey === 'function' ? makeTagFilterKey(col, tag) : `${col}::${tag}`;
              if (state.tagFilter.length === 1 && state.tagFilter[0] === fk) {
                state.tagFilter = [];
              } else {
                state.tagFilter = [fk];
              }
              if (typeof renderTagFilterPanel === 'function') renderTagFilterPanel();
              if (typeof applyTagFilter === 'function') applyTagFilter();
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

