# JS - UI (calendar, dashboard, settings)
Consolidated code context for AI assistants.


## File: `static/js/calendar.js`
```js
/**
 * @fileoverview calendar.js
 * @description Monthly/yearly calendar grid, trade-to-date mapping, date utils.
 *   Observation modal split into calendar-obs.js.
 * @exports renderCalendar, renderYearlyView, getTradesForDate, getTradeForDate,
 *          getOrCreateTrade, syncTradeDateField, syncAllTradeDates, formatDisplayDate,
 *          formatDate, normalizeDate, getMarketHoliday, extractDateFromTrade, updateRangeLabel
 * @reads state.trades, state.dayData, state.year, state.month, state.dateRange
 * @writes state.trades (getOrCreateTrade)
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

// Returns the trading day index (1-based) for a given date within its month.
// Trading days = Mon-Fri that are not market holidays.
function getTradingDayOfMonth(year, month, day) {
  let count = 0;
  for (let d = 1; d <= day; d++) {
    const cellDate = new Date(year, month, d);
    const dow = cellDate.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends
    const ds = formatDate(cellDate);
    if (MARKET_HOLIDAYS[ds]) continue; // skip holidays
    count++;
  }
  return count;
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
    numDiv.textContent = d;
    if (window._showTradingDay && !isWeekend && !getMarketHoliday(dateStr)) {
      const tdNum = getTradingDayOfMonth(state.year, state.month, d);
      const tdBadge = document.createElement('span');
      tdBadge.className = 'cal-trading-day-badge';
      tdBadge.textContent = `TD${tdNum}`;
      numDiv.appendChild(tdBadge);
    }
    cell.appendChild(numDiv);

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
      if (window._showTradeCount) {
        const tcDiv = document.createElement('div'); tcDiv.className = 'day-data-item day-trade-count';
        tcDiv.textContent = `${dayTrades.length} trade${dayTrades.length !== 1 ? 's' : ''}`;
        dataDiv.appendChild(tcDiv);
      }
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

      const allHeads = ['Total Trades', ...state.columns.filter(c => c !== 'Total Trades')];
      const cols = allHeads.filter(col => getActiveShowHeads()[col] && col.toLowerCase() !== 'date' && !isTagColumn(col));
      if (state.calendarMode === 'individual') {
        dayTrades.forEach((tr, i) => {
          cols.forEach(col => {
            if (col.toLowerCase() === 'thumbnail') return;
            let val;
            if (col === 'Total Trades') {
                val = dayTrades.length;
            } else {
                val = tr[col];
            }
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
          if (col === 'Total Trades') {
            const item = document.createElement('div'); item.className = 'day-data-item';
            item.textContent = showLabels ? `${_abbr(col)}: ${dayTrades.length}` : `${dayTrades.length}`;
            dataDiv.appendChild(item);
            return;
          }
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

      const imgs = [...(state.dayData[dateStr]?.images || []), ...dayTrades.flatMap(t => t.images || [])];

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
          
          timg.addEventListener('click', e => {
            e.stopPropagation();
            openFullscreenFromAppContext(imgs, thumbnailImg);
          });
          
          cell.appendChild(timg);
        }
      }

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
          openGalleryForDateWithPicker(dateStr);
        }
      } else {
        openGalleryForDateWithPicker(dateStr);
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

function getTradesForDate(dateStr, includeEmpty = false) {
  return state.trades.filter(t => {
    if (normalizeDate(extractDateFromTrade(t)) !== dateStr) return false;
    if (includeEmpty) return true;
    
    // Check if the trade has any actual data OR images
    const hasData = (
      (t['Time'] && String(t['Time']).trim() !== '') ||
      (t['Ex Time'] && String(t['Ex Time']).trim() !== '') ||
      (t['Buy Time'] && String(t['Buy Time']).trim() !== '') ||
      (t['Sell Time'] && String(t['Sell Time']).trim() !== '') ||
      (t['Gross P/L'] && String(t['Gross P/L']).trim() !== '') ||
      (t['Net P/L'] && String(t['Net P/L']).trim() !== '') ||
      (t['Rs'] && String(t['Rs']).trim() !== '') ||
      (t['Qty'] && String(t['Qty']).trim() !== '') ||
      (Array.isArray(t.images) && t.images.length > 0)
    );

    return hasData;
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

// Observation modal: openObsModal, renderObsTradeNotes, saveObservation, navigateObsDate, bindObsToolbar
// → moved to calendar-obs.js


```

## File: `static/js/calendar-obs.js`
```js
/**
 * @fileoverview calendar-obs.js
 * @description Observation modal: open, render per-trade notes, save, navigate, toolbar.
 *   Extracted from calendar.js to keep that file under 30 KB.
 * @exports openObsModal, renderObsTradeNotes, saveObservation, navigateObsDate, bindObsToolbar
 * @reads state.trades, state.dayData, state.obsDate, state.year, state.month
 * @calls getTradeForDate, getTradesForDate, getOrCreateTrade, formatDisplayDate, formatDate,
 *        renderCalendar, renderTable, saveTrades, showToast
 */

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

```

## File: `static/js/dashboard.js`
```js
/**
 * @fileoverview dashboard.js
 * @description Top-level render() orchestrator + dashboard P&L stats, drag-drop stat ordering.
 * @exports render, renderDashboard, updateCalendarModeButton, updateBrokerFilterButton,
 *          getTradePnl, getTradesForMonth, formatCurrency, parseNumber, setDashValue,
 *          formatShortDate, getDashboardStatsOrder, saveDashboardStatsOrder,
 *          bindDashboardDragDrop, renderDashboardStatsMenu, applyDashboardStatVisibility
 * @reads state.trades, state.dateRange, state.calendarMode
 * @calls renderCalendar, renderTable, renderVisualDashboard
 */

function render() {
  const sx = window.scrollX, sy = window.scrollY;
  renderCalendar();
  renderDashboard();
  renderTable();
  renderTagFilterPanel();
  updateCalendarModeButton();
  updateBrokerFilterButton();
  requestAnimationFrame(() => window.scrollTo(sx, sy));
}

function updateCalendarModeButton() {
  const btn = document.getElementById('calendar-mode-btn');
  if (btn) btn.textContent = state.calendarMode === 'consolidated' ? 'Consolidated' : 'Individual';
  const badge = document.getElementById('profile-view-badge');
  if (badge) {
    const consolidated = state.calendarMode === 'consolidated';
    badge.textContent = consolidated ? 'Consolidated' : 'Individual';
    badge.style.background = consolidated ? 'rgba(88,166,255,0.12)' : 'rgba(255,166,88,0.12)';
    badge.style.color = consolidated ? 'var(--blue)' : 'var(--orange, #f0883e)';
  }
  document.querySelectorAll('.profile-view-item').forEach(b => {
    b.classList.toggle('active', b.dataset.view === state.calendarMode);
  });
}

function updateBrokerFilterButton() {
  const map = { both: 'Both', zerodha: 'Zerodha', dhan: 'Dhan' };
  const key = String(state.brokerFilter || 'both').toLowerCase();
  const label = map[key] || 'Both';
  const btn = document.getElementById('broker-filter-btn-top');
  if (btn) btn.textContent = `Broker: ${label}`;
  const badge = document.getElementById('profile-broker-badge');
  if (badge) {
    badge.textContent = label;
    badge.style.background = key === 'both' ? 'rgba(88,166,255,0.12)' : 'rgba(88,255,166,0.12)';
    badge.style.color = key === 'both' ? 'var(--blue)' : 'var(--green)';
  }
  document.querySelectorAll('.broker-filter-item').forEach(b => {
    b.classList.toggle('active', b.dataset.broker === key);
  });
}

function parseNumber(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number' && !isNaN(val)) return val;
  const s = String(val).replace(/,/g, '').trim();
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function sumByKeys(trades, keys) {
  let sum = 0;
  let found = false;
  trades.forEach(t => {
    for (const k of keys) {
      if (!(k in t)) continue;
      const n = parseNumber(t[k]);
      if (n !== null) {
        sum += n;
        found = true;
        return;
      }
    }
  });
  return found ? sum : null;
}

function getTradePnl(trade) {
  const keys = ['Rs', 'rs', 'Profit', 'profit', 'P&L', 'Pnl', 'PnL', 'PL', 'pl'];
  for (const k of keys) {
    if (!(k in trade)) continue;
    const n = parseNumber(trade[k]);
    if (n !== null) return n;
  }
  return null;
}

function getTradesForMonth(year, monthIndex) {
  return state.trades.filter(t => {
    if (!tradeMatchesBrokerFilter(t)) return false;
    if (!tradeMatchesDateRange(t)) return false;
    if (state.dateRange.from || state.dateRange.to) return true;
    const ds = normalizeDate(extractDateFromTrade(t));
    if (!ds || !/^\d{4}-\d{2}-\d{2}$/.test(ds)) return false;
    const d = new Date(ds + 'T00:00:00');
    if (isNaN(d)) return false;
    return d.getFullYear() === year && d.getMonth() === monthIndex;
  });
}

function getShowDecimals() {
  return localStorage.getItem('tj_show_decimals') !== 'false';
}

function formatCurrency(n) {
  if (n === null || n === undefined || isNaN(n)) return '\u20B9 0';
  const dec = getShowDecimals();
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const out = abs.toLocaleString('en-IN', {
    minimumFractionDigits: dec ? 2 : 0,
    maximumFractionDigits: dec ? 2 : 0
  });
  return `${sign}\u20B9 ${out}`;
}

function setDashValue(el, n, colorize = true) {
  if (!el) return;
  el.textContent = formatCurrency(n);
  el.classList.remove('positive', 'negative');
  if (colorize) {
    if (n > 0) el.classList.add('positive');
    if (n < 0) el.classList.add('negative');
  }
}

function formatPercent(n) {
  if (n === null || n === undefined || isNaN(n)) return '0%';
  const dec = getShowDecimals();
  return `${dec ? n.toFixed(1) : Math.round(n)}%`;
}

function formatShortDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
}

let _qsMonthFilter = 'all'; // 'all' or 0-11

function setQsMonthFilter(m) {
  _qsMonthFilter = m;
  _renderQsMonthTabs();
  const trades = m === 'all'
    ? getTradesForMonth(state.year, state.month)
    : state.trades.filter(t => {
        if (!tradeMatchesBrokerFilter(t)) return false;
        const ds = normalizeDate(extractDateFromTrade(t));
        if (!ds) return false;
        const d = new Date(ds + 'T00:00:00');
        return d.getFullYear() === state.year && d.getMonth() === m;
      });
  const subtitle = document.getElementById('qs-monthly-subtitle');
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (subtitle) subtitle.textContent = m === 'all'
    ? `for ${MONTHS[state.month]} ${state.year}`
    : `for ${MONTHS_SHORT[m]} ${state.year}`;
  renderDashboard(trades);
}

function _renderQsMonthTabs() {
  const cont = document.getElementById('qs-month-tabs');
  if (!cont) return;
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  // Find which months have trades this year
  const monthsWithData = new Set(
    state.trades
      .map(t => normalizeDate(extractDateFromTrade(t)))
      .filter(d => d && d.startsWith(state.year + '-'))
      .map(d => parseInt(d.split('-')[1], 10) - 1)
  );
  let html = `<div class="vd-month-tabs-container">`;
  html += `<div class="vd-month-tab ${_qsMonthFilter === 'all' ? 'active' : ''}" onclick="setQsMonthFilter('all')">ALL</div>`;
  MONTHS_SHORT.forEach((name, idx) => {
    const has = monthsWithData.has(idx);
    const active = _qsMonthFilter === idx;
    html += `<div class="vd-month-tab ${active ? 'active' : ''} ${has ? 'has-data' : 'no-data'}"
      ${has ? `onclick="setQsMonthFilter(${idx})"` : ''}>${name}</div>`;
  });
  html += `</div>`;
  cont.innerHTML = html;
}

function renderDashboard(customTrades = null) {
  const subtitle = document.getElementById('qs-monthly-subtitle');
  if (subtitle) {
    if (state.dateRange.from || state.dateRange.to) {
      subtitle.textContent = `for ${state.dateRange.from || '...'} to ${state.dateRange.to || '...'}`;
    } else {
      subtitle.textContent = `for ${MONTHS[state.month]} ${state.year}`;
    }
  }
  applyDashboardStatVisibility();
  applyDashboardStatOrder();
  // Reset month filter when calendar month changes (no custom trades = fresh render)
  if (customTrades === null) _qsMonthFilter = 'all';
  _renderQsMonthTabs();

  const trades = customTrades !== null ? customTrades : getTradesForMonth(state.year, state.month);

  let overall = 0;
  let net = 0;
  let hasGrossAndNetCols = false;

  // overall = sum of Gross P/L (shown as "OVERALL PAL")
  // net     = sum of getTradePnl() — identical formula to the cumulative equity chart
  trades.forEach(t => {
    const gPl = parseNumber(t['Gross P/L']);
    const nPl = parseNumber(t['Net P/L']);
    if (gPl !== null) { overall += gPl; hasGrossAndNetCols = true; }
    if (nPl !== null) hasGrossAndNetCols = true;
  });

  // net uses the same getTradePnl() formula as the cumulative chart so both show same value
  if (typeof getTradePnl === 'function') {
    net = trades.reduce((sum, t) => {
      const v = getTradePnl(t);
      return (v !== null && v !== undefined) ? sum + v : sum;
    }, 0);
    if (net !== 0) hasGrossAndNetCols = true;
  }

  const charges = sumByKeys(trades, ['Other Charges', 'Charges', 'Charge', 'charges', 'charge', 'Transaction Charges', 'Charges (Total)', 'Total Charges']) || 0;
  const brokerage = sumByKeys(trades, ['Brokerage', 'brokerage', 'Brokerage Charges', 'Brokerage (Total)']) || 0;
  const totalFees = charges + brokerage;

  if (!hasGrossAndNetCols) {
    // No recognised P/L columns at all — last-resort fallback
    const pnlList = trades.map(getTradePnl).filter(n => n !== null);
    overall = pnlList.reduce((a, b) => a + b, 0);
    net = overall - totalFees;
  }

  // If no Gross P/L column exists, overall = net (same value)
  if (overall === 0 && net !== 0) overall = net;

  // Use net for win/loss stats if available, otherwise fallback to what we use for overall
  const pnlListForStats = trades.map(t => {
    if (hasGrossAndNetCols) return parseNumber(t['Net P/L']);
    const pl = getTradePnl(t);
    if (pl !== null) return pl - (parseNumber(t['Brokerage']) || 0) - (parseNumber(t['Other Charges']) || 0); // approx
    return null;
  }).filter(n => n !== null);

  const wins = pnlListForStats.filter(n => n > 0);
  const losses = pnlListForStats.filter(n => n < 0);
  const winRate = pnlListForStats.length ? (wins.length / pnlListForStats.length) * 100 : 0;
  const avg = pnlListForStats.length ? (net / pnlListForStats.length) : 0;
  const avgWin = wins.length ? (wins.reduce((a, b) => a + b, 0) / wins.length) : 0;
  const avgLoss = losses.length ? (losses.reduce((a, b) => a + b, 0) / losses.length) : 0;

  const dailyMap = new Map();
  trades.forEach(t => {
    const ds = normalizeDate(extractDateFromTrade(t));
    let pnl = null;
    if (hasGrossAndNetCols) pnl = parseNumber(t['Net P/L']);
    else pnl = getTradePnl(t);

    if (!ds || pnl === null) return;
    dailyMap.set(ds, (dailyMap.get(ds) || 0) + pnl);
  });
  const dailyEntries = Array.from(dailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  let best = { date: '', value: 0 };
  let worst = { date: '', value: 0 };
  if (dailyEntries.length) {
    best = dailyEntries.reduce((acc, cur) => cur[1] > acc.value ? { date: cur[0], value: cur[1] } : acc, { date: dailyEntries[0][0], value: dailyEntries[0][1] });
    worst = dailyEntries.reduce((acc, cur) => cur[1] < acc.value ? { date: cur[0], value: cur[1] } : acc, { date: dailyEntries[0][0], value: dailyEntries[0][1] });
  }

  let equity = 0;
  let peak = 0;
  let maxDD = 0;
  dailyEntries.forEach(([, v]) => {
    equity += v;
    if (equity > peak) peak = equity;
    const dd = equity - peak;
    if (dd < maxDD) maxDD = dd;
  });

  setDashValue(document.getElementById('dash-overall'), overall, true);
  setDashValue(document.getElementById('dash-net'), net, true);
  setDashValue(document.getElementById('dash-charges'), charges, false);
  setDashValue(document.getElementById('dash-brokerage'), brokerage, false);
  setDashValue(document.getElementById('dash-totalfees'), brokerage + charges, false);
  const tradeCount = document.getElementById('dash-trades');
  if (tradeCount) {
    const validTrades = trades.filter(t => {
      const instr = t.Instrument || t.Symbol || t.Scrip || t.Name || t.instrument;
      return instr && String(instr).trim() !== '';
    });
    const vWins = validTrades.filter(t => {
      const p = hasGrossAndNetCols ? parseNumber(t['Net P/L']) : getTradePnl(t);
      return p !== null && p > 0;
    }).length;
    const vLosses = validTrades.filter(t => {
      const p = hasGrossAndNetCols ? parseNumber(t['Net P/L']) : getTradePnl(t);
      return p !== null && p < 0;
    }).length;
    const total = validTrades.length;
    tradeCount.innerHTML = `${total.toLocaleString('en-IN')} <span class="dash-wl"><span class="positive">${vWins}W</span> · <span class="negative">${vLosses}L</span></span>`;
  }

  const winEl = document.getElementById('dash-winrate');
  if (winEl) winEl.textContent = formatPercent(winRate);
  setDashValue(document.getElementById('dash-avg'), avg, true);
  setDashValue(document.getElementById('dash-avgwin'), avgWin, true);
  setDashValue(document.getElementById('dash-avgloss'), avgLoss, true);
  setDashValue(document.getElementById('dash-best'), best.value || 0, true);
  setDashValue(document.getElementById('dash-worst'), worst.value || 0, true);
  setDashValue(document.getElementById('dash-dd'), maxDD || 0, true);
  const bestDate = document.getElementById('dash-best-date');
  const worstDate = document.getElementById('dash-worst-date');
  if (bestDate) bestDate.textContent = best.date ? formatShortDate(best.date) : '-';
  if (worstDate) worstDate.textContent = worst.date ? formatShortDate(worst.date) : '-';
  if (typeof renderVisualDashboard === 'function') renderVisualDashboard();
}

function getDashboardStatsState() {
  try {
    const raw = localStorage.getItem('dashboardStats');
    if (raw) return JSON.parse(raw);
  } catch (e) { }
  const all = {};
  DASHBOARD_STATS.forEach(s => { all[s.key] = true; });
  return all;
}

function getDashboardStatsOrder() {
  try {
    const raw = localStorage.getItem('dashboardStatsOrder');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) {
        const valid = arr.filter(k => DASHBOARD_STATS.some(s => s.key === k));
        const missing = DASHBOARD_STATS.map(s => s.key).filter(k => !valid.includes(k));
        return [...valid, ...missing];
      }
    }
  } catch (e) { }
  return DASHBOARD_STATS.map(s => s.key);
}

function saveDashboardStatsOrder(order) {
  try { localStorage.setItem('dashboardStatsOrder', JSON.stringify(order)); } catch (e) { }
}

function saveDashboardStatsState(stateMap) {
  try { localStorage.setItem('dashboardStats', JSON.stringify(stateMap)); } catch (e) { }
}

function applyDashboardStatVisibility() {
  const map = getDashboardStatsState();
  document.querySelectorAll('.dash-card[data-stat]').forEach(card => {
    const key = card.getAttribute('data-stat');
    card.style.display = map[key] === false ? 'none' : '';
  });
}

function applyDashboardStatOrder() {
  const grid = document.querySelector('.dashboard-grid');
  if (!grid) return;
  const order = getDashboardStatsOrder();
  const cards = Array.from(grid.querySelectorAll('.dash-card[data-stat]'));
  const byKey = new Map(cards.map(c => [c.getAttribute('data-stat'), c]));
  order.forEach(k => {
    const el = byKey.get(k);
    if (el) grid.appendChild(el);
  });
  bindDashboardDragDrop();
}

function bindDashboardDragDrop() {
  const grid = document.querySelector('.dashboard-grid');
  if (!grid) return;
  let dragSrc = null;
  let dropTarget = null;
  let dropPos = null; // 'before' | 'after'

  const clearIndicators = () => {
    grid.querySelectorAll('.drop-before, .drop-after')
      .forEach(c => c.classList.remove('drop-before', 'drop-after'));
  };

  grid.querySelectorAll('.dash-card[data-stat]').forEach(card => {
    card.setAttribute('draggable', 'true');

    card.addEventListener('dragstart', e => {
      dragSrc = card;
      setTimeout(() => card.classList.add('dragging'), 0);
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      clearIndicators();
      if (dragSrc && dropTarget && dropTarget !== dragSrc) {
        if (dropPos === 'before') grid.insertBefore(dragSrc, dropTarget);
        else grid.insertBefore(dragSrc, dropTarget.nextSibling);
        const newOrder = Array.from(grid.querySelectorAll('.dash-card[data-stat]'))
          .map(c => c.getAttribute('data-stat'));
        saveDashboardStatsOrder(newOrder);
      }
      dragSrc = null; dropTarget = null; dropPos = null;
    });

    card.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!dragSrc || card === dragSrc) return;
      clearIndicators();
      const rect = card.getBoundingClientRect();
      dropPos = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
      dropTarget = card;
      card.classList.add(dropPos === 'before' ? 'drop-before' : 'drop-after');
    });

    card.addEventListener('drop', e => { e.preventDefault(); });
  });
}

function renderDashboardStatsMenu() {
  // no-op: stats now rendered in modal via openStatsConfigModal()
}

function openStatsConfigModal() {
  const modal = document.getElementById('stats-config-modal');
  if (!modal) return;

  // work on a temp copy — only saved on Apply
  const tempMap = Object.assign({}, getDashboardStatsState());
  let tempOrder = [...getDashboardStatsOrder()];

  const list = document.getElementById('stats-config-list');
  const searchInp = document.getElementById('stats-config-search');
  if (searchInp) searchInp.value = '';

  const renderList = (q) => {
    list.innerHTML = '';
    const ql = (q || '').toLowerCase();
    const items = tempOrder
      .map(k => DASHBOARD_STATS.find(s => s.key === k))
      .filter(Boolean)
      .filter(s => !ql || s.label.toLowerCase().includes(ql));

    items.forEach(s => {
      const row = document.createElement('div');
      row.className = 'head-checkbox';
      row.setAttribute('draggable', 'true');
      row.dataset.stat = s.key;

      const handle = document.createElement('span');
      handle.textContent = '::';
      handle.className = 'stats-drag-handle';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = tempMap[s.key] !== false;
      chk.addEventListener('change', () => { tempMap[s.key] = chk.checked; });

      const label = document.createElement('span');
      label.textContent = s.label;

      row.appendChild(handle);
      row.appendChild(chk);
      row.appendChild(label);

      row.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', s.key);
        row.style.opacity = '0.5';
      });
      row.addEventListener('dragend', () => { row.style.opacity = '1'; });
      row.addEventListener('dragover', e => { e.preventDefault(); row.style.borderTop = '2px solid var(--blue)'; });
      row.addEventListener('dragleave', () => { row.style.borderTop = ''; });
      row.addEventListener('drop', e => {
        e.preventDefault();
        row.style.borderTop = '';
        const from = e.dataTransfer.getData('text/plain');
        const to = s.key;
        if (!from || from === to) return;
        const newOrder = tempOrder.filter(k => k !== from);
        const toIdx = newOrder.indexOf(to);
        newOrder.splice(toIdx, 0, from);
        tempOrder = newOrder;
        renderList(searchInp ? searchInp.value : '');
      });

      list.appendChild(row);
    });
  };

  renderList('');
  if (searchInp) searchInp.addEventListener('input', () => renderList(searchInp.value));

  document.getElementById('stats-config-all').onclick = () => {
    DASHBOARD_STATS.forEach(s => { tempMap[s.key] = true; });
    renderList(searchInp ? searchInp.value : '');
  };
  document.getElementById('stats-config-none').onclick = () => {
    DASHBOARD_STATS.forEach(s => { tempMap[s.key] = false; });
    renderList(searchInp ? searchInp.value : '');
  };
  const decChk = document.getElementById('stats-decimals-chk');
  if (decChk) decChk.checked = getShowDecimals();

  document.getElementById('stats-config-apply').onclick = () => {
    if (decChk) localStorage.setItem('tj_show_decimals', decChk.checked ? 'true' : 'false');
    saveDashboardStatsState(tempMap);
    saveDashboardStatsOrder(tempOrder);
    applyDashboardStatVisibility();
    applyDashboardStatOrder();
    renderDashboard();
    renderCalendar();
    modal.classList.remove('open');
  };
  document.getElementById('stats-config-cancel').onclick = () => modal.classList.remove('open');
  document.getElementById('stats-config-close').onclick  = () => modal.classList.remove('open');

  modal.classList.add('open');
}



```

## File: `static/js/settings.js`
```js
/**
 * @fileoverview settings.js
 * @description Settings panel: column visibility, keyboard shortcuts, saved views, show-heads.
 * @exports loadSettingsFromStorage, applySettingsToDOM, saveSettings, readSettingsFromPanel,
 *          loadShortcutsFromStorage, shortcutMatches, eventToShortcut, populateShortcutPanel,
 *          getActiveShowHeads, initShowHeads, renderShowHeads, initTableShowCols,
 *          getSavedViews, loadColWidths, loadTagGroups, saveTagGroups
 * @reads state.columns, state.showHeadsConsolidated, state.showHeadsIndividual
 * @writes state.tableShowCols, state.tagGroups, state.colWidths, state.shortcuts
 * @storage tj_settings, tj_shortcuts, tj_tagGroups, tj_colWidths, tj_tblFontSize, tj_rowHeight
 */

function loadSettingsFromStorage() {
  try {
    const s = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('tj_settings') || '{}') };
    applySettingsToDOM(s);
    populateSettingsPanel(s);
  } catch (e) { applySettingsToDOM(DEFAULT_SETTINGS); }
}

function readSettingsFromPanel() {
  return {
    daySize: document.getElementById('s-day-size').value,
    dayBold: document.getElementById('s-day-bold').checked,
    dayPos: document.getElementById('s-day-pos').value,
    dataSize: document.getElementById('s-data-size').value,
    dataBold: document.getElementById('s-data-bold').checked,
    showLabels: document.getElementById('s-show-labels').checked,
    cellHeight: document.getElementById('s-cell-height').value,
    satSunOff: document.getElementById('s-sat-sun-off').checked,
    showCalTags: document.getElementById('s-show-cal-tags').checked,
    showTradeCount: !!(document.getElementById('s-show-trade-count')?.checked),
    showTradingDay: !!(document.getElementById('s-show-trading-day')?.checked),
    tableRows: Math.max(3, Math.min(25, parseInt(document.getElementById('s-table-rows').value, 10) || 5)),
    groupAColor: document.getElementById('s-group-a-color').value || '#58a6ff',
    groupBColor: document.getElementById('s-group-b-color').value || '#ffffff',
    groupSepColor: document.getElementById('s-group-sep-color').value || '#58a6ff'
  };
}

function populateSettingsPanel(s) {
  document.getElementById('s-day-size').value = s.daySize;
  document.getElementById('s-day-bold').checked = s.dayBold;
  document.getElementById('s-day-pos').value = s.dayPos;
  document.getElementById('s-data-size').value = s.dataSize;
  document.getElementById('s-data-bold').checked = s.dataBold;
  document.getElementById('s-show-labels').checked = s.showLabels;
  document.getElementById('s-cell-height').value = s.cellHeight;
  document.getElementById('s-sat-sun-off').checked = !!s.satSunOff;
  document.getElementById('s-show-cal-tags').checked = !!s.showCalTags;
  const _tc = document.getElementById('s-show-trade-count'); if (_tc) _tc.checked = !!s.showTradeCount;
  const _td = document.getElementById('s-show-trading-day'); if (_td) _td.checked = !!s.showTradingDay;
  document.getElementById('s-table-rows').value = String(s.tableRows || 5);
  document.getElementById('s-group-a-color').value = s.groupAColor || '#58a6ff';
  document.getElementById('s-group-b-color').value = s.groupBColor || '#ffffff';
  document.getElementById('s-group-sep-color').value = s.groupSepColor || '#58a6ff';
}

function applySettingsToDOM(s) {
  const root = document.documentElement;
  root.style.setProperty('--cal-day-size', SIZE_MAP[s.daySize] || SIZE_MAP.H3);
  root.style.setProperty('--cal-day-weight', s.dayBold ? '700' : '400');
  root.style.setProperty('--cal-data-size', SIZE_MAP[s.dataSize] || SIZE_MAP.H4);
  root.style.setProperty('--cal-data-weight', s.dataBold ? '700' : '400');
  root.style.setProperty('--cal-cell-height', HEIGHT_MAP[s.cellHeight] || HEIGHT_MAP.normal);
  root.style.setProperty('--table-visible-rows', String(Math.max(3, Math.min(25, parseInt(s.tableRows, 10) || 5))));
  root.style.setProperty('--date-group-a-bg', hexToRgba(s.groupAColor || '#58a6ff', 0.10));
  root.style.setProperty('--date-group-b-bg', hexToRgba(s.groupBColor || '#ffffff', 0.05));
  root.style.setProperty('--date-group-sep', hexToRgba(s.groupSepColor || '#58a6ff', 0.35));
  window._showLabels = s.showLabels !== false;
  window._dayPos = s.dayPos || 'top-left';
  window._satSunOff = !!s.satSunOff;
  window._showCalTags = !!s.showCalTags;
  window._showTradeCount = !!s.showTradeCount;
  window._showTradingDay = !!s.showTradingDay;
  const grid = document.getElementById('calendar-grid');
  if (grid) {
    grid.className = `calendar-grid cal-pos-${window._dayPos}`;
  }
}

function saveSettings(s) {
  localStorage.setItem('tj_settings', JSON.stringify(s));
  applySettingsToDOM(s);
  renderCalendar();
  showToast('Settings applied!', 'success');
}

function normalizeShortcutString(s) {
  return String(s || '').trim().replace(/\s+/g, '').toLowerCase();
}

function loadShortcutsFromStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem('tj_shortcuts') || '{}');
    state.shortcuts = { ...DEFAULT_SHORTCUTS, ...saved };
  } catch (e) {
    state.shortcuts = { ...DEFAULT_SHORTCUTS };
  }
  populateShortcutPanel();
}

function _scVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function _scSet(id, val) { const el = document.getElementById(id); if (el) el.value = val || ''; }

function populateShortcutPanel() {
  _scSet('sc-pen',          state.shortcuts.pen);
  _scSet('sc-image',        state.shortcuts.imageImport);
  _scSet('sc-eraser',       state.shortcuts.eraser);
  _scSet('sc-date',         state.shortcuts.datePicker);
  _scSet('sc-merge',        state.shortcuts.mergeSave);
  _scSet('sc-overlay',      state.shortcuts.overlaySave);
  _scSet('sc-select-tool',  state.shortcuts.selectTool);
  _scSet('sc-text-tool',    state.shortcuts.textTool);
  _scSet('sc-marquee',      state.shortcuts.marquee);
  _scSet('sc-annot-toggle', state.shortcuts.annotToggle);
  _scSet('sc-reset-zoom',   state.shortcuts.resetZoom);
  _scSet('sc-show-heads',   state.shortcuts.showHeads);
  _scSet('sc-layer-panel',  state.shortcuts.layerPanel);
  _scSet('sc-left-panel',      state.shortcuts.leftPanel);
  _scSet('sc-fullscreen',      state.shortcuts.fullscreen);
  _scSet('sc-delete-image',    state.shortcuts.deleteImage);
  _scSet('sc-img-tag-manager', state.shortcuts.imageTagManager);
}

function readShortcutsFromPanel() {
  return {
    pen:          _scVal('sc-pen').trim()          || DEFAULT_SHORTCUTS.pen,
    imageImport:  _scVal('sc-image').trim()        || DEFAULT_SHORTCUTS.imageImport,
    eraser:       _scVal('sc-eraser').trim()       || DEFAULT_SHORTCUTS.eraser,
    datePicker:   _scVal('sc-date').trim()         || DEFAULT_SHORTCUTS.datePicker,
    mergeSave:    _scVal('sc-merge').trim()        || DEFAULT_SHORTCUTS.mergeSave,
    overlaySave:  _scVal('sc-overlay').trim()      || DEFAULT_SHORTCUTS.overlaySave,
    selectTool:   _scVal('sc-select-tool').trim()  || DEFAULT_SHORTCUTS.selectTool,
    textTool:     _scVal('sc-text-tool').trim()    || DEFAULT_SHORTCUTS.textTool,
    marquee:      _scVal('sc-marquee').trim()      || DEFAULT_SHORTCUTS.marquee,
    annotToggle:  _scVal('sc-annot-toggle').trim() || DEFAULT_SHORTCUTS.annotToggle,
    resetZoom:    _scVal('sc-reset-zoom').trim()   || DEFAULT_SHORTCUTS.resetZoom,
    showHeads:    _scVal('sc-show-heads').trim()   || DEFAULT_SHORTCUTS.showHeads,
    layerPanel:   _scVal('sc-layer-panel').trim()  || DEFAULT_SHORTCUTS.layerPanel,
    leftPanel:    _scVal('sc-left-panel').trim()   || DEFAULT_SHORTCUTS.leftPanel,
    fullscreen:   _scVal('sc-fullscreen').trim()   || DEFAULT_SHORTCUTS.fullscreen,
    deleteImage:  _scVal('sc-delete-image').trim() || DEFAULT_SHORTCUTS.deleteImage
  };
}

function saveShortcuts(shortcuts) {
  state.shortcuts = { ...DEFAULT_SHORTCUTS, ...shortcuts };
  localStorage.setItem('tj_shortcuts', JSON.stringify(state.shortcuts));
  populateShortcutPanel();
}

function eventToShortcut(e) {
  const parts = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  const key = String(e.key || '').toLowerCase();
  if (!['control', 'shift', 'alt', 'meta'].includes(key)) parts.push(key);
  return parts.join('+');
}

function shortcutMatches(e, configured) {
  const rhs = normalizeShortcutString(configured);
  if (!rhs) return false;
  return eventToShortcut(e) === rhs;
}

/** Returns the showHeads object for the currently active calendar mode. */
function getActiveShowHeads() {
  return state.calendarMode === 'consolidated'
    ? state.showHeadsConsolidated
    : state.showHeadsIndividual;
}

/** True if a column should be on by default (P/L, RS type). */
function isDefaultShowHeadCol(col) {
  const l = col.toLowerCase();
  return l === 'rs' || l === 'net p/l' || l === 'gross p/l' ||
    l.includes('profit') || l.includes('p/l') || l.includes('p&l');
}

function saveShowHeads() {
  try {
    localStorage.setItem('tj_heads_consolidated', JSON.stringify(state.showHeadsConsolidated));
    localStorage.setItem('tj_heads_individual', JSON.stringify(state.showHeadsIndividual));
  } catch (e) { }
}

function loadShowHeads() {
  try {
    const c = localStorage.getItem('tj_heads_consolidated');
    const i = localStorage.getItem('tj_heads_individual');
    if (c) state.showHeadsConsolidated = JSON.parse(c);
    if (i) state.showHeadsIndividual = JSON.parse(i);
  } catch (e) { }
}

function initShowHeads() {
  loadShowHeads();
  const allHeads = ['Total Trades', ...state.columns.filter(c => c !== 'Total Trades')];
  allHeads.forEach(col => {
    if (col.toLowerCase() === 'date') return;
    const def = isDefaultShowHeadCol(col);
    if (!(col in state.showHeadsConsolidated)) state.showHeadsConsolidated[col] = def;
    if (!(col in state.showHeadsIndividual)) state.showHeadsIndividual[col] = def;
  });
  renderShowHeads();
}

function renderShowHeads() {
  ['show-heads-panel', 'gallery-show-heads-panel'].forEach(panelId => {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.innerHTML = '';
    const cols = ['Total Trades', ...state.columns.filter(c => c !== 'Total Trades')].filter(c => c.toLowerCase() !== 'date');
    if (!cols.length) { panel.innerHTML = '<p class="panel-hint">Import Excel to see columns</p>'; return; }

    const badge = document.createElement('div');
    const isConsolidated = state.calendarMode === 'consolidated';
    badge.style.cssText = 'font-size:0.72rem;font-weight:600;padding:4px 2px 6px 2px;color:' + (isConsolidated ? 'var(--blue)' : 'var(--green)');
    badge.textContent = isConsolidated ? 'Consolidated Heads' : 'Individual Heads';
    panel.appendChild(badge);

    const searchRow = document.createElement('div'); searchRow.className = 'panel-search-row';
    const searchInp = document.createElement('input'); searchInp.className = 'panel-search'; searchInp.placeholder = 'Search...';
    searchRow.appendChild(searchInp); panel.appendChild(searchRow);

    const actRow = document.createElement('div'); actRow.className = 'panel-act-row';
    const btnAll = document.createElement('button'); btnAll.className = 'panel-act-btn'; btnAll.textContent = 'All';
    const btnNone = document.createElement('button'); btnNone.className = 'panel-act-btn'; btnNone.textContent = 'None';
    const btnPL = document.createElement('button'); btnPL.className = 'panel-act-btn'; btnPL.textContent = 'P/L Only';
    const heads = getActiveShowHeads();
    btnAll.addEventListener('click', () => { cols.forEach(c => { heads[c] = true; }); saveShowHeads(); renderShowHeads(); renderCalendar(); if (typeof renderGalleryStats === 'function') renderGalleryStats(); });
    btnNone.addEventListener('click', () => { cols.forEach(c => { heads[c] = false; }); saveShowHeads(); renderShowHeads(); renderCalendar(); if (typeof renderGalleryStats === 'function') renderGalleryStats(); });
    btnPL.addEventListener('click', () => { cols.forEach(c => { heads[c] = isDefaultShowHeadCol(c); }); saveShowHeads(); renderShowHeads(); renderCalendar(); if (typeof renderGalleryStats === 'function') renderGalleryStats(); });
    actRow.appendChild(btnAll); actRow.appendChild(btnNone); actRow.appendChild(btnPL); panel.appendChild(actRow);

    const list = document.createElement('div'); list.className = 'panel-list'; panel.appendChild(list);

    const renderList = (q) => {
      list.innerHTML = '';
      const activeHeads = getActiveShowHeads();
      cols.filter(c => !q || c.toLowerCase().includes(q.toLowerCase())).forEach(col => {
        const lbl = document.createElement('label'); lbl.className = 'head-checkbox';
        const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = !!activeHeads[col];
        chk.addEventListener('change', () => { getActiveShowHeads()[col] = chk.checked; saveShowHeads(); renderCalendar(); if (typeof renderGalleryStats === 'function') renderGalleryStats(); });
        lbl.appendChild(chk); lbl.appendChild(document.createTextNode(col));
        list.appendChild(lbl);
      });
    };
    renderList('');
    searchInp.addEventListener('input', () => renderList(searchInp.value));
  });
}

function openShowHeadsModal() {
  const modal = document.getElementById('show-heads-modal');
  if (!modal) return;

  const cols = ['Total Trades', ...state.columns.filter(c => c !== 'Total Trades')].filter(c => c.toLowerCase() !== 'date');
  const isConsolidated = state.calendarMode === 'consolidated';

  // title badge
  const title = document.getElementById('show-heads-modal-title');
  if (title) {
    title.textContent = isConsolidated ? 'Show Heads — Consolidated' : 'Show Heads — Individual';
    title.style.color = isConsolidated ? 'var(--blue)' : 'var(--green)';
  }

  // work on a temp copy
  const src = getActiveShowHeads();
  const tempHeads = Object.assign({}, src);

  const list = document.getElementById('show-heads-modal-list');
  const searchInp = document.getElementById('show-heads-modal-search');
  if (searchInp) searchInp.value = '';

  const renderList = (q) => {
    list.innerHTML = '';
    const ql = (q || '').toLowerCase();
    cols.filter(c => !ql || c.toLowerCase().includes(ql)).forEach(col => {
      const lbl = document.createElement('label');
      lbl.className = 'head-checkbox';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = !!tempHeads[col];
      chk.addEventListener('change', () => { tempHeads[col] = chk.checked; });
      lbl.appendChild(chk);
      lbl.appendChild(document.createTextNode(col));
      list.appendChild(lbl);
    });
  };

  if (!cols.length) {
    list.innerHTML = '<p class="panel-hint">Import Excel to see columns</p>';
  } else {
    renderList('');
    if (searchInp) searchInp.addEventListener('input', () => renderList(searchInp.value));
  }

  document.getElementById('show-heads-modal-all').onclick = () => {
    cols.forEach(c => { tempHeads[c] = true; });
    renderList(searchInp ? searchInp.value : '');
  };
  document.getElementById('show-heads-modal-none').onclick = () => {
    cols.forEach(c => { tempHeads[c] = false; });
    renderList(searchInp ? searchInp.value : '');
  };
  document.getElementById('show-heads-modal-pl').onclick = () => {
    cols.forEach(c => { tempHeads[c] = isDefaultShowHeadCol(c); });
    renderList(searchInp ? searchInp.value : '');
  };
  const decChk = document.getElementById('show-heads-decimals-chk');
  if (decChk) decChk.checked = getShowDecimals();

  document.getElementById('show-heads-modal-apply').onclick = () => {
    if (decChk) localStorage.setItem('tj_show_decimals', decChk.checked ? 'true' : 'false');
    Object.assign(src, tempHeads);
    saveShowHeads();
    renderShowHeads();
    renderCalendar();
    renderDashboard();
    if (typeof renderGalleryStats === 'function') renderGalleryStats();
    modal.classList.remove('open');
  };
  document.getElementById('show-heads-modal-cancel').onclick = () => modal.classList.remove('open');
  document.getElementById('show-heads-modal-close').onclick  = () => modal.classList.remove('open');

  modal.classList.add('open');
}

function initTableShowCols() {
  const allCols = [...state.columns];
  if (!allCols.some(c => c.toLowerCase() === 'thumbnail') && !allCols.some(c => c.toLowerCase() === 'images')) {
    allCols.push('Images');
  }
  allCols.forEach(col => {
    if (!(col in state.tableShowCols)) state.tableShowCols[col] = true;
  });
  getTagColumns().forEach(col => {
    if (!(col in state.tableShowCols)) state.tableShowCols[col] = true;
  });
  state.tableShowCols[BROKER_COLUMN] = true;
  state.tableShowCols[IMAGE_TAG_COLUMN] = true;
  renderColVisPanel();
}

const VIEWS_KEY = 'tj_savedViews';

function getSavedViews() {
  try { return JSON.parse(localStorage.getItem(VIEWS_KEY) || '{}'); }
  catch { return {}; }
}

function saveCurrentView(name) {
  const views = getSavedViews();
  views[name] = JSON.parse(JSON.stringify(state.tableShowCols));
  localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
  renderViewsPanel();
}

function loadView(name) {
  const views = getSavedViews();
  if (!views[name]) return;
  state.tableShowCols = Object.assign({}, views[name]);
  renderColVisPanel();
  render();
  showToast(`View "${name}" loaded`, 'success');
}

function deleteView(name) {
  const views = getSavedViews();
  delete views[name];
  localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
  renderViewsPanel();
}

function renameView(oldName, newName) {
  newName = newName.trim();
  if (!newName || newName === oldName) { renderViewsPanel(); return; }
  const views = getSavedViews();
  if (!views[oldName]) return;
  if (views[newName]) { showToast(`"${newName}" already exists`, 'error'); renderViewsPanel(); return; }
  views[newName] = views[oldName];
  delete views[oldName];
  localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
  renderViewsPanel();
  showToast(`Renamed to "${newName}"`, 'success');
}

function startViewRename(name, loadBtn, row) {
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = name;
  inp.style.cssText = 'flex:1;font-size:inherit;padding:2px 6px;border:1px solid #555;background:#1e2330;color:#ddd;border-radius:3px;outline:none;';
  row.replaceChild(inp, loadBtn);
  inp.focus();
  inp.select();
  let done = false;
  const commit = () => { if (done) return; done = true; renameView(name, inp.value); };
  const cancel = () => { if (done) return; done = true; renderViewsPanel(); };
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
  inp.addEventListener('blur', commit);
}

function renderViewsPanel() {
  const list = document.getElementById('saved-views-list');
  if (!list) return;
  const views = getSavedViews();
  const names = Object.keys(views);
  list.innerHTML = '';
  if (!names.length) {
    const hint = document.createElement('p');
    hint.className = 'panel-hint';
    hint.style.margin = '8px';
    hint.textContent = 'No saved views yet';
    list.appendChild(hint);
    return;
  }
  names.forEach(name => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:4px;padding:2px 8px;';
    const loadBtn = document.createElement('button');
    loadBtn.className = 'dropdown-item';
    loadBtn.style.cssText = 'flex:1;text-align:left;';
    loadBtn.textContent = name;
    loadBtn.title = 'Load this view (right-click to rename)';
    loadBtn.addEventListener('click', () => { loadView(name); closeAllDropdowns('__none__'); });
    loadBtn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('.view-ctx-menu').forEach(el => el.remove());
      const menu = document.createElement('div');
      menu.className = 'view-ctx-menu';
      menu.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;background:#252836;border:1px solid #444;border-radius:4px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,.5);`;
      const renameItem = document.createElement('div');
      renameItem.textContent = '✏ Rename';
      renameItem.style.cssText = 'padding:6px 14px;cursor:pointer;color:#ddd;font-size:0.85em;white-space:nowrap;';
      renameItem.addEventListener('mouseenter', () => renameItem.style.background = '#333a4d');
      renameItem.addEventListener('mouseleave', () => renameItem.style.background = '');
      menu.appendChild(renameItem);
      document.body.appendChild(menu);
      const dismiss = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', dismiss); } };
      renameItem.addEventListener('click', (ev) => {
        ev.stopPropagation();
        menu.remove();
        document.removeEventListener('mousedown', dismiss);
        startViewRename(name, loadBtn, row);
      });
      setTimeout(() => document.addEventListener('mousedown', dismiss), 0);
    });
    const delBtn = document.createElement('button');
    delBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:#c00;font-size:1em;padding:2px 4px;';
    delBtn.textContent = '✕';
    delBtn.title = 'Delete view';
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteView(name); });
    row.appendChild(loadBtn);
    row.appendChild(delBtn);
    list.appendChild(row);
  });
}

function renderColVisPanel() {
  const panel = document.getElementById('col-vis-panel');
  panel.innerHTML = '';
  const allCols = [...state.columns, 'Images'];
  if (!allCols.length || (allCols.length === 1 && allCols[0] === 'Images')) {
    panel.innerHTML = '<p class="panel-hint" style="margin:8px">Import Excel first</p>'; return;
  }

  // ── Tabs ──
  const tabsRow = document.createElement('div'); tabsRow.className = 'panel-tabs';
  const tabVis = document.createElement('button'); tabVis.className = 'panel-tab active'; tabVis.textContent = 'Columns';
  const tabFreeze = document.createElement('button'); tabFreeze.className = 'panel-tab'; tabFreeze.textContent = 'Freeze';
  tabsRow.appendChild(tabVis); tabsRow.appendChild(tabFreeze);
  panel.appendChild(tabsRow);

  // ── Tab 1: Column visibility ──
  const paneVis = document.createElement('div'); paneVis.className = 'panel-tab-pane';

  const searchRow = document.createElement('div'); searchRow.className = 'panel-search-row';
  const searchInp = document.createElement('input'); searchInp.className = 'panel-search'; searchInp.placeholder = 'Search...';
  searchRow.appendChild(searchInp); paneVis.appendChild(searchRow);

  const actRow = document.createElement('div'); actRow.className = 'panel-act-row';
  const btnAll = document.createElement('button'); btnAll.className = 'panel-act-btn'; btnAll.textContent = 'All';
  const btnNone = document.createElement('button'); btnNone.className = 'panel-act-btn'; btnNone.textContent = 'None';
  btnAll.addEventListener('click', () => { allCols.forEach(c => { state.tableShowCols[c] = true; }); renderColVisPanel(); renderTable(); });
  btnNone.addEventListener('click', () => {
    allCols.forEach(c => { state.tableShowCols[c] = false; });
    state.tableShowCols[BROKER_COLUMN] = true;
    state.tableShowCols[IMAGE_TAG_COLUMN] = true;
    renderColVisPanel();
    renderTable();
  });
  actRow.appendChild(btnAll); actRow.appendChild(btnNone); paneVis.appendChild(actRow);

  const list = document.createElement('div'); list.className = 'panel-list'; paneVis.appendChild(list);

  const renderList = (q) => {
    list.innerHTML = '';
    const ql = (q || '').toLowerCase();
    const orderedCols = state.columns.filter(c => !ql || c.toLowerCase().includes(ql));
    const includeImages = !ql || 'images'.includes(ql);

    const buildRow = (col, draggable, isPermanent) => {
      const row = document.createElement('div');
      row.className = 'head-checkbox' + (draggable ? ' drag-row' : '');
      row.style.padding = '3px 0';
      row.dataset.col = col;
      if (draggable) {
        const handle = document.createElement('span');
        handle.textContent = '⋮⋮'; handle.style.opacity = '0.6'; handle.style.marginRight = '8px';
        row.appendChild(handle);
        row.setAttribute('draggable', 'true');
      }
      const chk = document.createElement('input'); chk.type = 'checkbox';
      chk.checked = isPermanent ? true : (state.tableShowCols[col] !== false);
      chk.disabled = isPermanent;
      chk.addEventListener('change', () => { if (isPermanent) return; state.tableShowCols[col] = chk.checked; renderTable(); });
      row.appendChild(chk);
      row.appendChild(document.createTextNode(col));
      if (draggable) {
        row.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', col); row.style.opacity = '0.5'; });
        row.addEventListener('dragend', () => { row.style.opacity = '1'; });
        row.addEventListener('dragover', e => { e.preventDefault(); row.style.borderTop = '1px dashed var(--border2)'; });
        row.addEventListener('dragleave', () => { row.style.borderTop = ''; });
        row.addEventListener('drop', e => {
          e.preventDefault(); row.style.borderTop = '';
          const from = e.dataTransfer.getData('text/plain'); const to = col;
          if (!from || from === to) return;
          const order = state.columns.filter(c => c !== from);
          order.splice(order.indexOf(to), 0, from);
          state.columns = order; saveTrades(); renderColVisPanel(); renderTable();
        });
      }
      list.appendChild(row);
    };

    orderedCols.forEach(col => {
      const lc = String(col).toLowerCase();
      buildRow(col, true, lc === String(IMAGE_TAG_COLUMN).toLowerCase() || lc === String(BROKER_COLUMN).toLowerCase());
    });
    if (includeImages) buildRow('Images', false, false);
  };
  renderList('');
  searchInp.addEventListener('input', () => renderList(searchInp.value));
  panel.appendChild(paneVis);

  // ── Tab 2: Freeze ──
  const paneFreeze = document.createElement('div'); paneFreeze.className = 'panel-tab-pane panel-two-col'; paneFreeze.style.display = 'none';
  const frozen = getFrozenCols();
  state.columns.forEach(col => {
    const row = document.createElement('label'); row.className = 'head-checkbox'; row.style.padding = '3px 0';
    const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = frozen.includes(col);
    chk.addEventListener('change', () => {
      const next = new Set(getFrozenCols());
      if (chk.checked) next.add(col); else next.delete(col);
      saveFrozenCols(Array.from(next)); renderTable();
    });
    row.appendChild(chk); row.appendChild(document.createTextNode(col));
    paneFreeze.appendChild(row);
  });
  panel.appendChild(paneFreeze);

  // ── Tab switching ──
  tabVis.addEventListener('click', () => {
    tabVis.classList.add('active'); tabFreeze.classList.remove('active');
    paneVis.style.display = ''; paneFreeze.style.display = 'none';
  });
  tabFreeze.addEventListener('click', () => {
    tabFreeze.classList.add('active'); tabVis.classList.remove('active');
    paneFreeze.style.display = ''; paneVis.style.display = 'none';
  });
}


```
