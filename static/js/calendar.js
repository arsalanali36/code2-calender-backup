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

