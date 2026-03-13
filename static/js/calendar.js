/**
 * @fileoverview calendar.js
 * @description Monthly/yearly calendar grid, trade-to-date mapping, observation modal, date utils.
 * @exports renderCalendar, renderYearlyView, getTradesForDate, getTradeForDate,
 *          getOrCreateTrade, syncTradeDateField, syncAllTradeDates, formatDisplayDate,
 *          formatDate, normalizeDate, openObsModal, saveObservation, getMarketHoliday,
 *          extractDateFromTrade, updateRangeLabel, navigateObsDate, bindObsToolbar
 * @reads state.trades, state.dayData, state.year, state.month, state.dateRange
 * @writes state.trades (getOrCreateTrade), state.dayData (observation save)
 * @calls renderTable, saveTrades, openGalleryForDate
 */

// ── NSE/BSE Market Holidays ──────────────────────────────────────────────────
// Format: 'YYYY-MM-DD': 'Holiday Name'
const MARKET_HOLIDAYS = {
  // 2025
  '2025-02-26': 'Mahashivratri',
  '2025-03-14': 'Holi',
  '2025-03-31': 'Id-Ul-Fitr (Ramadan Eid)',
  '2025-04-10': 'Shri Ram Navami',
  '2025-04-14': 'Dr. Baba Saheb Ambedkar Jayanti',
  '2025-04-18': 'Good Friday',
  '2025-05-01': 'Maharashtra Day',
  '2025-08-15': 'Independence Day',
  '2025-08-27': 'Ganesh Chaturthi',
  '2025-10-02': 'Mahatma Gandhi Jayanti / Dussehra',
  '2025-10-20': 'Diwali-Laxmi Puja',
  '2025-10-21': 'Diwali-Balipratipada',
  '2025-11-05': 'Prakash Gurpurb Sri Guru Nanak Dev',
  '2025-12-25': 'Christmas',
  // 2026 (NSE circular)
  '2026-01-15': 'Municipal Corp. Election – Maharashtra',
  '2026-01-26': 'Republic Day',
  '2026-03-03': 'Holi',
  '2026-03-26': 'Shri Ram Navami',
  '2026-03-31': 'Shri Mahavir Jayanti',
  '2026-04-03': 'Good Friday',
  '2026-04-14': 'Dr. Baba Saheb Ambedkar Jayanti',
  '2026-05-01': 'Maharashtra Day',
  '2026-05-28': 'Bakri Id',
  '2026-06-26': 'Muharram',
  '2026-09-14': 'Ganesh Chaturthi',
  '2026-10-02': 'Mahatma Gandhi Jayanti',
  '2026-10-20': 'Dussehra',
  '2026-11-10': 'Diwali-Balipratipada',
  '2026-11-24': 'Prakash Gurpurb Sri Guru Nanak Dev',
  '2026-12-25': 'Christmas',
};

// Muhurat Trading days — market opens for 1 special evening session
const MUHURAT_TRADING = {
  '2025-10-20': 'Muhurat Trading',
  '2026-11-08': 'Muhurat Trading (Diwali Laxmi Pujan)',
};

function getMarketHoliday(dateStr) {
  return MARKET_HOLIDAYS[dateStr] || null;
}

function getMuhuratDay(dateStr) {
  return MUHURAT_TRADING[dateStr] || null;
}
// ─────────────────────────────────────────────────────────────────────────────

function renderCalendar() {
  syncAllTradeDates();
  if (state.calendarTagFocus && !getAllColumnTagKeys().includes(state.calendarTagFocus)) {
    state.calendarTagFocus = '';
  }
  updateRangeLabel();
  if (state.calendarView === 'year') {
    renderYearlyView();
    return;
  }
  const monthWrap = document.getElementById('calendar-month-view');
  const yearWrap = document.getElementById('calendar-year-view');
  if (monthWrap) monthWrap.classList.remove('hidden');
  if (yearWrap) yearWrap.classList.add('hidden');
  const grid = document.getElementById('calendar-grid');
  const weekdays = document.querySelector('.calendar-weekdays');
  const pos = window._dayPos || 'top-left';
  const satSunOff = window._satSunOff === true;
  const visibleDayCount = satSunOff ? 5 : 7;
  grid.className = `calendar-grid cal-pos-${pos}`;
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(${visibleDayCount}, 1fr)`;
  if (weekdays) {
    weekdays.style.gridTemplateColumns = `repeat(${visibleDayCount}, 1fr)`;
    weekdays.innerHTML = satSunOff
      ? '<div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div>'
      : '<div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div class="weekend">Sat</div><div class="weekend">Sun</div>';
  }

  const firstDay = new Date(state.year, state.month, 1).getDay();
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
  const today = new Date();
  const showLabels = window._showLabels !== false;
  const toMonIndex = dow => (dow === 0 ? 6 : dow - 1);

  let startOffset;
  if (!satSunOff) {
    startOffset = toMonIndex(firstDay);
  } else {
    let firstVisibleDay = 1;
    while (firstVisibleDay <= daysInMonth) {
      const d0 = new Date(state.year, state.month, firstVisibleDay).getDay();
      if (d0 !== 0 && d0 !== 6) break;
      firstVisibleDay++;
    }
    startOffset = firstVisibleDay <= daysInMonth
      ? toMonIndex(new Date(state.year, state.month, firstVisibleDay).getDay())
      : 0;
  }

  for (let i = 0; i < startOffset; i++) {
    const e = document.createElement('div'); e.className = 'day-cell empty';
    grid.appendChild(e);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(state.year, state.month, d);
    const dow = cellDate.getDay();
    const isWeekend = dow === 0 || dow === 6;
    if (satSunOff && isWeekend) continue;
    const dateStr = formatDate(cellDate);
    const dayTrades = getTradesForDate(dateStr).filter(tradeMatchesBrokerFilter);
    const trade = dayTrades[0] || null;
    const isToday = cellDate.toDateString() === today.toDateString();

    const cell = document.createElement('div'); cell.className = 'day-cell';
    if (isWeekend) cell.classList.add('weekend-day');
    if (isToday) cell.classList.add('today');

    const holidayName = getMarketHoliday(dateStr);
    const muhuratName = getMuhuratDay(dateStr);
    if (muhuratName) {
      cell.classList.add('muhurat-day');
    } else if (holidayName) {
      cell.classList.add('market-holiday');
    }

    const hasObs = dayTrades.some(t => t && t.observation);
    if (hasObs) cell.classList.add('has-obs');

    if (trade) {
      const p = parseFloat(trade['Profit'] ?? trade['profit'] ?? '');
      if (!isNaN(p) && p !== 0) cell.classList.add(p > 0 ? 'has-profit' : 'has-loss');
    }

    if (state.tagFilter.length > 0 && !dayTrades.some(tradeMatchesTagFilter)) {
      cell.classList.add('tag-filtered-out');
    }
    if (state.calendarTagFocus) {
      const focus = parseTagFilterKey(state.calendarTagFocus);
      const dayMatchesFocus = dayTrades.some(t => getTradeTagsForColumn(t, focus.col).includes(focus.tag));
      cell.classList.add(dayMatchesFocus ? 'calendar-tag-match' : 'calendar-tag-dim');
    }

    const numDiv = document.createElement('div'); numDiv.className = 'day-num';
    numDiv.textContent = d; cell.appendChild(numDiv);

    const hlabel = holidayName || muhuratName;
    if (hlabel) {
      const hl = document.createElement('div');
      hl.className = muhuratName ? 'holiday-label muhurat-label' : 'holiday-label';
      hl.textContent = hlabel;
      hl.title = hlabel;
      cell.appendChild(hl);
    }

    if (dayTrades.length) {
      const dataDiv = document.createElement('div'); dataDiv.className = 'day-data';
      // Abbreviation map for calendar cell labels (keeps cells compact)
      const _CAL_ABBR = {
        'gross p&l':'G','gross p/l':'G','gross':'G',
        'net p&l':'N','net p/l':'N','net':'N',
        'total trades':'T#','trade count':'T#','trades':'T#',
        'charges':'Ch','brokerage':'Br','total fees':'Fee',
        'win %':'W%','win rate':'W%','winrate':'W%',
        'avg win':'AW','avg loss':'AL',
        'avg / trade':'Avg','avg per trade':'Avg',
        'points':'Pt','rs':'₹','p/l':'P/L',
        'drawdown':'DD','max drawdown':'DD',
        'profit':'P','loss':'L','qty':'Q','quantity':'Q',
        'instrument':'Ins','strategy':'Stg','setup':'Stg',
        'entry':'En','exit':'Ex','time':'T',
        'buy price':'BP','sell price':'SP',
      };
      const _abbr = col => _CAL_ABBR[col.toLowerCase()] || col;

      const cols = state.columns.filter(col => getActiveShowHeads()[col] && col.toLowerCase() !== 'date' && !isTagColumn(col));
      if (state.calendarMode === 'individual') {
        dayTrades.forEach((tr, i) => {
          cols.forEach(col => {
            if (col.toLowerCase() === 'thumbnail') return;
            const val = tr[col];
            if (val === '' || val == null) return;
            const item = document.createElement('div'); item.className = 'day-data-item';
            const isProfit = col.toLowerCase().includes('profit') || col.toLowerCase() === 'rs';
            const prefix = dayTrades.length > 1 ? `#${i + 1} ` : '';
            if (isProfit) {
              const num = parseFloat(val);
              if (!isNaN(num)) {
                const fv = getShowDecimals() ? num : Math.round(num);
                item.textContent = showLabels ? `${prefix}${_abbr(col)}: ${num > 0 ? '+' : ''}${fv}` : `${prefix}${num > 0 ? '+' : ''}${fv}`;
                item.classList.add(num >= 0 ? 'profit-pos' : 'profit-neg');
              } else { item.textContent = showLabels ? `${prefix}${_abbr(col)}: ${val}` : `${prefix}${val}`; }
            } else {
              item.textContent = showLabels ? `${prefix}${_abbr(col)}: ${val}` : `${prefix}${val}`;
            }
            dataDiv.appendChild(item);
          });
        });
      } else {
        cols.forEach(col => {
          if (col.toLowerCase() === 'thumbnail') return;
          const lower = col.toLowerCase();
          if (lower === 'sell time' || lower === 'buy time') return;
          const vals = dayTrades.map(t => t[col]).filter(v => v !== '' && v != null);
          if (!vals.length) return;
          const item = document.createElement('div'); item.className = 'day-data-item';
          const nums = vals.map(v => parseFloat(v)).filter(v => !isNaN(v));
          if (nums.length === vals.length) {
            let outNum;
            if (lower === 'sell price' || lower === 'buy price') {
              outNum = nums.reduce((a, b) => a + b, 0) / nums.length;
            } else {
              outNum = nums.reduce((a, b) => a + b, 0);
            }
            const out = getShowDecimals() ? (outNum % 1 === 0 ? outNum : outNum.toFixed(2)) : Math.round(outNum);
            item.textContent = showLabels ? `${_abbr(col)}: ${out}` : `${out}`;
            if (lower.includes('profit') || lower === 'rs') item.classList.add(outNum >= 0 ? 'profit-pos' : 'profit-neg');
          } else {
            const first = String(vals[0]);
            const same = vals.every(v => String(v) === first);
            item.textContent = same ? (showLabels ? `${_abbr(col)}: ${first}` : first) : (showLabels ? `${_abbr(col)}: ${vals.length}x` : `${vals.length}x`);
          }
          dataDiv.appendChild(item);
        });
      }

      const dayTagKeys = [];
      getTagColumns().forEach(col => {
        const tags = Array.from(new Set(dayTrades.flatMap(t => getTradeTagsForColumn(t, col))));
        tags.forEach(tag => dayTagKeys.push(makeTagFilterKey(col, tag)));
      });
      if (window._showCalTags && dayTagKeys.length) {
        const tagWrap = document.createElement('div');
        tagWrap.className = 'day-tag-bubbles';
        dayTagKeys.forEach(key => {
          const parsed = parseTagFilterKey(key);
          const bubble = document.createElement('button');
          bubble.type = 'button';
          bubble.className = 'day-tag-bubble';
          if (state.calendarTagFocus === key) bubble.classList.add('active');
          bubble.textContent = `${parsed.col}: ${parsed.tag}`;
          const c = tagColor(parsed.tag);
          bubble.style.color = c;
          bubble.style.borderColor = hexToRgba(c, 0.55);
          bubble.style.background = hexToRgba(c, 0.14);
          bubble.addEventListener('click', e => {
            e.stopPropagation();
            state.calendarTagFocus = (state.calendarTagFocus === key) ? '' : key;
            renderCalendar();
          });
          tagWrap.appendChild(bubble);
        });
        dataDiv.appendChild(tagWrap);
      }

      if (hasObs) {
        const note = document.createElement('span');
        note.className = 'day-note-indicator';
        note.title = 'Observation available';
        note.textContent = 'N';
        dataDiv.appendChild(note);
      }

      cell.appendChild(dataDiv);

      if (state.calendarMode === 'consolidated') {
        const thumbnailImg = getThumbnailTaggedImageForTrades(dayTrades);
        if (thumbnailImg) {
          const timg = document.createElement('img');
          timg.className = 'day-thumb-image';
          timg.src = resolveImageUrl(thumbnailImg);
          timg.alt = 'thumbnail';
          timg.title = 'Thumbnail tagged image';
          cell.appendChild(timg);
        }
      }

      const imgs = [...(state.dayData[dateStr]?.images || []), ...dayTrades.flatMap(t => t.images || [])];
      if (imgs.length > 0) {
        const badge = document.createElement('div'); badge.className = 'day-img-badge';
        badge.textContent = `Img ${imgs.length}`; cell.appendChild(badge);
      }
    }

    const pencil = document.createElement('button'); pencil.className = 'day-pencil';
    pencil.title = 'Add observation'; pencil.textContent = 'Note';
    pencil.addEventListener('click', e => { e.stopPropagation(); openObsModal(dateStr); });
    cell.appendChild(pencil);

    cell.addEventListener('click', () => {
      if (dayTrades.length === 0) {
        if (confirm(`Want to create "temp place holder row" for ${dateStr}?`)) {
          getOrCreateTrade(dateStr);
          if (typeof saveTrades === 'function') saveTrades();
          if (typeof renderTable === 'function') renderTable();
          renderCalendar();
          openGalleryForDate(dateStr);
        }
      } else {
        openGalleryForDate(dateStr);
      }
    });
    grid.appendChild(cell);
  }
}

function renderYearlyView() {
  const monthWrap = document.getElementById('calendar-month-view');
  const yearWrap = document.getElementById('calendar-year-view');
  if (monthWrap) monthWrap.classList.add('hidden');
  if (!yearWrap) return;
  yearWrap.classList.remove('hidden');
  yearWrap.innerHTML = '';

  const year = state.year;
  const pnlByDate = new Map();
  state.trades.forEach(t => {
    if (!tradeMatchesBrokerFilter(t)) return;
    const ds = normalizeDate(extractDateFromTrade(t));
    const pnl = getTradePnl(t);
    if (!ds || pnl === null) return;
    pnlByDate.set(ds, (pnlByDate.get(ds) || 0) + pnl);
  });

  for (let m = 0; m < 12; m++) {
    const monthBox = document.createElement('div');
    monthBox.className = 'year-month';
    const title = document.createElement('div');
    title.className = 'year-month-title';
    title.textContent = MONTHS[m].slice(0, 3);
    monthBox.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'year-grid';
    const firstDay = new Date(year, m, 1).getDay();
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const toMonIndex = dow => (dow === 0 ? 6 : dow - 1);
    const startOffset = toMonIndex(firstDay);

    for (let i = 0; i < startOffset; i++) {
      const blank = document.createElement('div');
      blank.className = 'year-cell';
      blank.style.opacity = '0.25';
      grid.appendChild(blank);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const val = pnlByDate.get(dateStr) || 0;
      const cell = document.createElement('div');
      cell.className = 'year-cell';
      if (val > 0) cell.classList.add('pos');
      else if (val < 0) cell.classList.add('neg');
      else cell.classList.add('zero');
      const yHoliday = getMarketHoliday(dateStr);
      const yMuhurat = getMuhuratDay(dateStr);
      if (yMuhurat) cell.classList.add('muhurat-day');
      else if (yHoliday) cell.classList.add('market-holiday');
      const titlePnl = val !== 0 ? ` • ${formatCurrency(val)}` : '';
      cell.title = yMuhurat ? `${dateStr} — ${yMuhurat}${titlePnl}` :
        yHoliday ? `${dateStr} — ${yHoliday}${titlePnl}` :
          `${dateStr}${titlePnl}`;
      grid.appendChild(cell);
    }

    monthBox.appendChild(grid);
    yearWrap.appendChild(monthBox);
  }
}

function updateRangeLabel() {
  const label = document.getElementById('month-range-label');
  if (!label) return;
  if (state.calendarView === 'year') {
    label.textContent = `From ${MONTHS[0].slice(0, 3)} ${state.year} to ${MONTHS[11].slice(0, 3)} ${state.year}`;
  } else {
    const first = new Date(state.year, state.month, 1);
    const last = new Date(state.year, state.month + 1, 0);
    label.textContent = `${formatDate(first)} to ${formatDate(last)}`;
  }
}

function getTradeForDate(dateStr) {
  return state.trades.find(t => normalizeDate(extractDateFromTrade(t)) === dateStr) || null;
}

function getTradesForDate(dateStr) {
  return state.trades.filter(t => {
    if (normalizeDate(extractDateFromTrade(t)) !== dateStr) return false;
    if (!tradeMatchesDateRange(t)) return false;
    // Exclude manual empty rows without actual data
    if (
      (t['Time'] === '' || t['Time'] === undefined) &&
      (t['Ex Time'] === '' || t['Ex Time'] === undefined) &&
      (t['Buy Time'] === '' || t['Buy Time'] === undefined) &&
      (t['Sell Time'] === '' || t['Sell Time'] === undefined) &&
      (t['Gross P/L'] === '' || t['Gross P/L'] === undefined) &&
      (t['Net P/L'] === '' || t['Net P/L'] === undefined) &&
      (t['Rs'] === '' || t['Rs'] === undefined) &&
      (t['Qty'] === '' || t['Qty'] === undefined)
    ) {
      return false;
    }
    return true;
  });
}

function getThumbnailTaggedImageForTrades(trades) {
  const rows = Array.isArray(trades) ? trades : [];
  for (const t of rows) {
    const imgs = Array.isArray(t.images) ? t.images : [];
    for (const url of imgs) {
      const tags = getImageTagsForUrl(t, url).map(x => x.toLowerCase());
      if (tags.includes('thumbnail')) return url;
    }
  }
  return '';
}

function getOrCreateTrade(dateStr) {
  let trade = getTradeForDate(dateStr);
  if (!trade) {
    trade = { date: dateStr, images: [] };
    state.columns.forEach(col => { trade[col] = ''; });
    state.trades.push(trade);
  } else {
    syncTradeDateField(trade);
  }
  return trade;
}

function extractDateFromTrade(trade) {
  if (!trade) return '';
  if (trade.date) return trade.date;
  if (trade.Date) return trade.Date;
  for (const k of Object.keys(trade)) {
    if (k.toLowerCase().includes('date') && trade[k]) return trade[k];
  }
  return '';
}

function syncTradeDateField(trade) {
  if (!trade) return;
  trade.date = normalizeDate(extractDateFromTrade(trade));
}

function syncAllTradeDates() {
  state.trades.forEach(syncTradeDateField);
}

function normalizeDate(val) {
  if (!val) return '';
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const dd = parseInt(dmy[1], 10);
    const mm = parseInt(dmy[2], 10);
    const yy = parseInt(dmy[3], 10);
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
      return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return formatDate(d);
  return String(val);
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function openObsModal(dateStr) {
  state.obsDate = dateStr;
  document.getElementById('obs-modal-date').textContent = formatDisplayDate(dateStr);
  document.getElementById('obs-date-picker').value = dateStr;
  const trade = getTradeForDate(dateStr);
  document.getElementById('obs-editor').innerHTML = (trade && trade.observation) ? trade.observation : '';
  renderObsTradeNotes(dateStr);
  document.getElementById('obs-modal').classList.add('open');
  setTimeout(() => document.getElementById('obs-editor').focus(), 50);
}

function renderObsTradeNotes(dateStr) {
  const container = document.getElementById('obs-trade-notes');
  if (!container) return;
  container.innerHTML = '';

  const trades = getTradesForDate(dateStr);
  if (!trades.length) return;

  const instrCol = state.columns.find(c => /instrument|symbol|scrip|stock/i.test(c)) || state.columns[0];

  const hdr = document.createElement('div');
  hdr.className = 'obs-trade-notes-hdr';
  hdr.textContent = 'Per-Trade Notes';
  container.appendChild(hdr);

  let _noteItemDragFromHandle = false;

  trades.forEach((trade, i) => {
    const rowIdx = state.trades.indexOf(trade);
    const label = (instrCol && trade[instrCol]) ? trade[instrCol] : `Trade ${i + 1}`;

    const item = document.createElement('div');
    item.className = 'obs-trade-note-item';
    item.dataset.rowIdx = rowIdx;

    const handle = document.createElement('span');
    handle.className = 'obs-note-drag-handle';
    handle.textContent = '⠿';
    handle.title = 'Drag to move note to another trade';
    handle.addEventListener('mousedown', () => { _noteItemDragFromHandle = true; });

    const lbl = document.createElement('div');
    lbl.className = 'obs-trade-note-label';
    lbl.textContent = label;

    const tb = document.createElement('div'); tb.className = 'obs-trade-note-toolbar';
    [['B', 'bold'], ['I', 'italic'], ['U', 'underline']].forEach(([lbl2, cmd]) => {
      const btn = document.createElement('button'); btn.className = 'note-popup-tool';
      btn.innerHTML = `<${lbl2.toLowerCase()}>${lbl2}</${lbl2.toLowerCase()}>`;
      btn.addEventListener('mousedown', e => { e.preventDefault(); document.execCommand(cmd); });
      tb.appendChild(btn);
    });

    const editor = document.createElement('div');
    editor.className = 'obs-trade-note-editor';
    editor.contentEditable = 'true';
    editor.spellcheck = false;
    editor.dataset.rowIdx = rowIdx;
    const stored = (rowIdx >= 0 && state.trades[rowIdx]) ? (state.trades[rowIdx][NOTE_COLUMN] || '') : '';
    editor.innerHTML = stored || '<br>';

    editor.addEventListener('blur', () => {
      const ri = parseInt(editor.dataset.rowIdx, 10);
      if (!isNaN(ri) && state.trades[ri]) {
        const val = stripHtml(editor.innerHTML).trim() ? editor.innerHTML : '';
        state.trades[ri][NOTE_COLUMN] = val;
        saveTrades();
        document.querySelectorAll(`[data-note-row="${ri}"]`).forEach(el => _refreshNoteCellDisplay(el, val));
      }
    });

    lbl.style.cursor = 'pointer';
    lbl.title = 'Click to focus note';
    lbl.addEventListener('click', ev => { ev.preventDefault(); editor.focus(); });

    item.setAttribute('draggable', 'true');
    item.addEventListener('dragstart', e => {
      if (!_noteItemDragFromHandle) { e.preventDefault(); return; }
      _noteItemDragFromHandle = false;
      const srcHtml = stripHtml(editor.innerHTML).trim() ? editor.innerHTML : '';
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('tj-note', JSON.stringify({ rowIdx, html: srcHtml }));
      item.classList.add('obs-note-dragging');
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('obs-note-dragging');
      container.querySelectorAll('.obs-note-drop-target').forEach(el => el.classList.remove('obs-note-drop-target'));
    });
    item.addEventListener('dragover', e => {
      if (!e.dataTransfer.types.includes('tj-note')) return;
      e.preventDefault();
      container.querySelectorAll('.obs-note-drop-target').forEach(el => el.classList.remove('obs-note-drop-target'));
      item.classList.add('obs-note-drop-target');
    });
    item.addEventListener('dragleave', () => item.classList.remove('obs-note-drop-target'));
    item.addEventListener('drop', e => {
      e.preventDefault();
      item.classList.remove('obs-note-drop-target');
      const raw = e.dataTransfer.getData('tj-note');
      if (!raw) return;
      const { rowIdx: srcIdx, html: srcHtml } = JSON.parse(raw);
      const destIdx = parseInt(item.dataset.rowIdx, 10);
      if (srcIdx === destIdx || isNaN(destIdx)) return;
      state.trades[destIdx][NOTE_COLUMN] = srcHtml;
      state.trades[srcIdx][NOTE_COLUMN] = '';
      saveTrades();
      renderObsTradeNotes(state.obsDate);
    });

    item.appendChild(handle);
    item.appendChild(lbl);
    item.appendChild(tb);
    item.appendChild(editor);
    container.appendChild(item);
  });
}

function saveObservation(andClose = true) {
  const html = document.getElementById('obs-editor').innerHTML;
  const trade = getOrCreateTrade(state.obsDate);
  trade.observation = html;
  document.querySelectorAll('#obs-trade-notes .obs-trade-note-editor').forEach(ed => {
    const ri = parseInt(ed.dataset.rowIdx, 10);
    if (!isNaN(ri) && state.trades[ri]) {
      state.trades[ri][NOTE_COLUMN] = stripHtml(ed.innerHTML).trim() ? ed.innerHTML : '';
    }
  });
  saveTrades();
  renderCalendar();
  renderTable();
  if (andClose) {
    document.getElementById('obs-modal').classList.remove('open');
    showToast('Observation saved!', 'success');
  }
}

function navigateObsDate(dir) {
  saveObservation(false);

  const dataOnly = document.getElementById('obs-data-only').checked;
  let dates;
  if (dataOnly) {
    dates = state.trades.filter(t => t.date).map(t => t.date).sort();
  } else {
    const dim = new Date(state.year, state.month + 1, 0).getDate();
    dates = Array.from({ length: dim }, (_, i) => formatDate(new Date(state.year, state.month, i + 1)));
  }

  let idx = dates.indexOf(state.obsDate);
  if (idx === -1) idx = dir > 0 ? -1 : dates.length;
  const next = idx + dir;
  if (next < 0 || next >= dates.length) return;
  openObsModal(dates[next]);
}

function bindObsToolbar() {
  document.querySelectorAll('.obs-tool[data-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      document.getElementById('obs-editor').focus();
      document.execCommand(btn.dataset.cmd, false, btn.dataset.val || null);
    });
  });

  document.getElementById('obs-apply-size').addEventListener('mousedown', e => {
    e.preventDefault();
    const size = document.getElementById('obs-custom-size').value;
    if (!size) return;
    const editor = document.getElementById('obs-editor');
    editor.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const span = document.createElement('span');
      span.style.fontSize = size + 'px';
      const zws = document.createTextNode('\u200B'); // zero-width space as placeholder
      span.appendChild(zws);
      range.insertNode(span);
      const nr = document.createRange();
      nr.setStart(zws, 1); nr.collapse(true);
      sel.removeAllRanges(); sel.addRange(nr);
    } else {
      const range = sel.getRangeAt(0);
      const span = document.createElement('span');
      span.style.fontSize = size + 'px';
      try { range.surroundContents(span); }
      catch (ex) { document.execCommand('insertHTML', false, `<span style="font-size:${size}px">${range.toString()}</span>`); }
    }
  });

  document.getElementById('obs-insert-img').addEventListener('click', () => {
    document.getElementById('obs-img-input').click();
  });
  document.getElementById('obs-img-input').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      document.getElementById('obs-editor').focus();
      document.execCommand('insertHTML', false,
        `<img src="${ev.target.result}" style="max-width:100%;border-radius:6px;margin:6px 0" />`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  document.getElementById('obs-insert-link').addEventListener('click', () => {
    const url = prompt('Enter URL (e.g. https://example.com):');
    if (!url) return;
    document.getElementById('obs-editor').focus();
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      document.execCommand('createLink', false, url);
    } else {
      document.execCommand('insertHTML', false, `<a href="${url}" target="_blank">${url}</a>`);
    }
  });

  document.getElementById('obs-editor').addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault(); e.stopPropagation();
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
    }
  });
}

