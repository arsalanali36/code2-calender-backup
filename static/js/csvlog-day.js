/**
 * @fileoverview csvlog-day.js
 * @description Day summary tab rendering for CSVLog modal.
 *   Split from csvlog-fields.js to stay under 30 KB file-size limit.
 *   All functions are global scope — called from csvlog.js.
 */

/* ── Bell-shape chart arrangement ────────────────────────────────────────── */
// Gains ascending (smallest at top → largest toward middle)
// then Losses ascending by value (most negative at middle → smallest loss at bottom)
// Result: bars shortest at top & bottom, longest in the middle — bell silhouette.
function _bellArrange(rows) {
  const gains  = rows.filter(r => r.pnlNum >= 0).sort((a, b) => a.pnlNum - b.pnlNum);
  const losses = rows.filter(r => r.pnlNum <  0).sort((a, b) => a.pnlNum - b.pnlNum);
  return [...gains, ...losses];
}

/* ── Lot size lookup (qty ÷ lotSize = lots) ──────────────────────────────── */
const _CL_LOT_SIZES = { NIFTY: 65, BANKNIFTY: 35, FINNIFTY: 65, MIDCPNIFTY: 75, SENSEX: 10, BANKEX: 15 };
function _clLots(instr, qty) {
  if (!qty) return null;
  const base = String(instr || '').toUpperCase().split(/\s|\d/)[0];
  const ls = _CL_LOT_SIZES[base];
  if (!ls) return null;
  return Math.round(qty / ls);
}

/* ── Horizontal bell chart (for All tab) ─────────────────────────────────── */
// Gains ascending left→center, losses ascending (most-negative) center→right
// → bars grow tall toward the middle, short at edges = horizontal bell silhouette
function _buildBellChart(rows) {
  const gains  = rows.filter(r => r.pnlNum !== null && r.pnlNum >= 0).sort((a, b) => a.pnlNum - b.pnlNum);
  const losses = rows.filter(r => r.pnlNum !== null && r.pnlNum <  0).sort((a, b) => a.pnlNum - b.pnlNum);
  const bellRows = [...gains, ...losses];
  if (!bellRows.length) return null;

  const maxAbs = Math.max(...bellRows.map(r => Math.abs(r.pnlNum)), 1);
  const HALF_H = 100; // px per half

  const wrap = document.createElement('div');
  wrap.className = 'cl-bell-wrap';

  const chart = document.createElement('div');
  chart.className = 'cl-bell-chart';
  wrap.appendChild(chart);

  // Shared tooltip — fixed position, appended to body
  document.body.querySelectorAll('.cl-bell-tip').forEach(el => el.remove());
  const tip = document.createElement('div');
  tip.className = 'cl-bell-tip';
  document.body.appendChild(tip);

  bellRows.forEach(r => {
    const pct    = Math.abs(r.pnlNum) / maxAbs;
    const barH   = Math.max(3, Math.round(pct * HALF_H));
    const isPos  = r.pnlNum >= 0;
    const color  = isPos ? 'var(--green)' : 'var(--red)';
    const colorBg = isPos ? 'rgba(63,185,80,0.4)' : 'rgba(248,81,73,0.4)';

    const col = document.createElement('div');
    col.className = 'cl-bell-col';

    const topH = document.createElement('div'); topH.className = 'cl-bell-top';
    const botH = document.createElement('div'); botH.className = 'cl-bell-bot';

    const bar = document.createElement('div');
    bar.className = 'cl-bell-bar ' + (isPos ? 'cl-bell-bar-pos' : 'cl-bell-bar-neg');
    bar.style.cssText = 'height:' + barH + 'px;background:' + colorBg + ';border-color:' + color;

    if (isPos) topH.appendChild(bar); else botH.appendChild(bar);
    col.appendChild(topH);
    col.appendChild(botH);
    chart.appendChild(col);

    // Hover tooltip
    const pnlStr = (r.pnlNum > 0 ? '+' : '') + Math.trunc(r.pnlNum);
    const lots   = _clLots(r.instr, r.qty);
    col.addEventListener('mouseenter', () => {
      const rect = col.getBoundingClientRect();
      tip.innerHTML =
        (r.date ? '<div class="cl-tip-date">' + r.date + '</div>' : '') +
        '<div class="cl-tip-instr">T' + (r.dayIdx || (r.idx + 1)) + (lots !== null ? ' &bull; ' + lots + ' lot' + (lots !== 1 ? 's' : '') : '') + '</div>' +
        '<div class="cl-tip-pnl" style="color:' + color + '">' + pnlStr + ' Rs</div>' +
        (r.ptsNum !== null ? '<div class="cl-tip-pts">Pts: ' + Math.trunc(r.ptsNum) + '</div>' : '');
      const TW = 148;
      let left = rect.left + rect.width / 2 - TW / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - TW - 8));
      let top = rect.top - 100;
      if (top < 8) top = rect.bottom + 8;
      tip.style.cssText = 'display:block;left:' + left + 'px;top:' + top + 'px;';
    });
    col.addEventListener('mouseleave', () => { tip.style.display = 'none'; });

    // Click → navigate to that date's Day view in the logger
    col.addEventListener('click', () => {
      tip.style.display = 'none';
      if (r.date) {
        _loadDateIntoModal(r.date);
      } else {
        _clTab = r.idx;
        _renderTradeTabs(); _renderGroupTabs(); _renderContent();
      }
    });
  });

  return wrap;
}

/* ── Day summary tab ─────────────────────────────────────────────────────── */
function _renderDayContent(body) {
  body.style.padding = '16px 20px';
  body.style.overflow = 'auto';
  body.style.display = 'block';   // override flex so children stack + scroll works

  // Restore actual date in header (may have been set to "Full Range" by All tab)
  const _curDate = _clDayTrades[0]
    ? (_clDayTrades[0].trade['trade_date'] || _clDayTrades[0].trade['Date'] || _clDayTrades[0].trade.date || '')
    : '';
  if (_curDate) { const _d = document.getElementById('cl-date-display'); if (_d) _d.textContent = _curDate; }

  const toSec = s => {
    if (!s) return null;
    const p = String(s).split(':');
    return parseInt(p[0]||0)*3600 + parseInt(p[1]||0)*60 + parseInt(p[2]||0);
  };
  const fmtDur = d => {
    if (!d && d !== 0) return '—';
    const h = Math.floor(d/3600), m = Math.floor((d%3600)/60), s = d%60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
    return `${s}s`;
  };
  // HH:MM only — strip seconds
  const fmtTime = t => {
    if (!t) return '—';
    const parts = String(t).split(':');
    return parts.length >= 2 ? parts[0].padStart(2,'0') + ':' + parts[1].padStart(2,'0') : t;
  };
  // Truncate to integer (no rounding — just drop decimals)
  const fmtNum = n => n === null ? '—' : String(Math.trunc(n));

  // Compute per-trade rows
  let totalPnl = 0, totalPts = 0, totalFee = 0, pnlCount = 0, ptsCount = 0;
  const allRows = _clDayTrades.map(({ trade }, i) => {
    const buyT  = trade['Buy Time']  || trade['buy_time']  || trade['BUY TIME']  || '';
    const sellT = trade['Sell Time'] || trade['sell_time'] || trade['SELL TIME'] || '';
    const s1 = toSec(buyT), s2 = toSec(sellT);
    const entryT = (s1 !== null && s2 !== null && s1 <= s2) ? buyT  : (s2 !== null && s1 !== null ? sellT : buyT || sellT);
    const exitT  = (s1 !== null && s2 !== null && s1 <= s2) ? sellT : (s2 !== null && s1 !== null ? buyT  : sellT || buyT);
    const durSec = (s1 !== null && s2 !== null) ? Math.abs(s2 - s1) : null;
    const pnlRaw = trade['Net P/L'] || trade['Gross P/L'] || trade['Rs'] || trade['rs'] || trade['RS'] || '';
    const pnlNum = parseFloat(String(pnlRaw).replace(/,/g, ''));
    const ptsRaw = trade['Pt'] || trade['pt'] || '';
    const ptsNum = parseFloat(String(ptsRaw).replace(/,/g, ''));
    const feeRaw = trade['Brokerage'] || trade['brokerage'] || trade['Broker'] || trade['broker'] || trade['BROKER'] || trade['Fee'] || trade['fee'] || '';
    const feeNum = parseFloat(String(feeRaw).replace(/,/g, ''));
    if (!isNaN(pnlNum)) { totalPnl += pnlNum; pnlCount++; }
    if (!isNaN(ptsNum)) { totalPts += ptsNum; ptsCount++; }
    if (!isNaN(feeNum)) totalFee += feeNum;
    const instr = trade['Instrument'] || trade['instrument'] || '';
    const qtyRaw = trade['Qty'] || trade['qty'] || trade['Quantity'] || trade['quantity'] || trade['QTY'] || '';
    const qtyNum = parseInt(String(qtyRaw).replace(/,/g, ''), 10);
    return {
      idx: i,
      instr,
      qty: isNaN(qtyNum) ? null : qtyNum,
      ttype:  trade['TradeType'] || trade['tradetype'] || '',
      entryT: entryT || '',
      exitT:  exitT  || '',
      durSec,
      pnlNum: isNaN(pnlNum) ? null : pnlNum,
      ptsNum: isNaN(ptsNum) ? null : ptsNum,
    };
  });

  // Filter out blank rows (no instrument and no time and no P/L)
  const rows = allRows.filter(r => r.instr || r.entryT || r.pnlNum !== null);

  // ── Apply sort to rows ─────────────────────────────────────────────────────
  let displayRows = [...rows];
  if (_clDaySortField === 'pnl') {
    displayRows.sort((a, b) => (b.pnlNum ?? -Infinity) - (a.pnlNum ?? -Infinity));
  } else if (_clDaySortField === 'pts') {
    displayRows.sort((a, b) => (b.ptsNum ?? -Infinity) - (a.ptsNum ?? -Infinity));
  }

  // ── Stats bar ──────────────────────────────────────────────────────────────
  const stats = document.createElement('div');
  stats.className = 'cl-day-stats';

  const sortableStatEls = [];

  const mkStat = (label, value, color, sortField) => {
    const el = document.createElement('div');
    el.className = 'cl-day-stat';
    if (sortField) {
      el.tabIndex = 0;
      el.dataset.sortField = sortField;
      if (_clDaySortField === sortField) el.classList.add('cl-day-stat-sorted');
      el.title = 'Space / click: sort by ' + label + ' (high to low)';
      sortableStatEls.push(el);
    }
    const lbl = document.createElement('div');
    lbl.className = 'cl-day-stat-label';
    lbl.textContent = label;
    const val = document.createElement('div');
    val.className = 'cl-day-stat-value';
    val.textContent = value;
    if (color) { val.style.color = color; }
    el.appendChild(lbl);
    el.appendChild(val);
    return el;
  };

  const pnlColor = pnlCount > 0 ? (totalPnl > 0 ? 'var(--green)' : totalPnl < 0 ? 'var(--red)' : '') : '';
  const ptsColor = ptsCount > 0 ? (totalPts > 0 ? 'var(--green)' : totalPts < 0 ? 'var(--red)' : '') : '';
  stats.appendChild(mkStat('Total P/L (Rs)', pnlCount > 0 ? fmtNum(totalPnl) : '—', pnlColor, 'pnl'));
  stats.appendChild(mkStat('Total Points',   ptsCount > 0 ? fmtNum(totalPts) : '—', ptsColor, 'pts'));
  stats.appendChild(mkStat('Trades',         rows.length.toString(), ''));
  if (totalFee > 0) stats.appendChild(mkStat('T. Fee', fmtNum(totalFee), 'var(--text-muted)'));
  body.appendChild(stats);

  // Stat card keyboard nav — wired after tableRowEls is built
  const _wireStatKeys = tableRowEls => {
    sortableStatEls.forEach((el, i) => {
      el.addEventListener('click', () => {
        const sf = el.dataset.sortField;
        _clDaySortField = _clDaySortField === sf ? null : sf;
        _renderContent();
        setTimeout(() => document.querySelector('#cl-body .cl-day-stat[data-sort-field="' + sf + '"]')?.focus(), 0);
      });
      el.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          sortableStatEls[(i + 1) % sortableStatEls.length].focus();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          sortableStatEls[(i - 1 + sortableStatEls.length) % sortableStatEls.length].focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          document.querySelector('#cl-trade-tabs .cl-day-tab')?.focus();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          tableRowEls[0]?.focus();
        } else if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          el.click();
        }
      });
    });
  };

  // ── P/L bar chart (bell shape: gains ascending → losses descending by magnitude) ──
  const chartRows = _bellArrange(displayRows.filter(r => r.pnlNum !== null));
  if (chartRows.length > 0) {
    const maxAbs = Math.max(...chartRows.map(r => Math.abs(r.pnlNum)), 1);
    const chart = document.createElement('div');
    chart.className = 'cl-day-chart';

    chartRows.forEach(r => {
      const pct = Math.round(Math.abs(r.pnlNum) / maxAbs * 100);
      const isPos = r.pnlNum >= 0;
      const color = isPos ? 'var(--green)' : 'var(--red)';
      const colorAlpha = isPos ? 'rgba(63,185,80,0.18)' : 'rgba(248,81,73,0.18)';

      const row = document.createElement('div');
      row.className = 'cl-day-chart-row';
      row.title = 'Trade ' + (r.idx + 1) + ' — click to open';
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        _clTab = r.idx;
        _renderTradeTabs();
        _renderGroupTabs();
        _renderContent();
      });

      row.innerHTML =
        '<span class="cl-day-chart-lbl">' + (r.idx + 1) + '</span>' +
        '<div class="cl-day-chart-track">' +
          '<div class="cl-day-chart-fill" style="width:' + pct + '%;background:' + colorAlpha + ';border-left:3px solid ' + color + '"></div>' +
        '</div>' +
        '<span class="cl-day-chart-val" style="color:' + color + '">' + fmtNum(r.pnlNum) + '</span>';
      chart.appendChild(row);
    });
    body.appendChild(chart);
  }

  // ── Summary table (sorted order) ───────────────────────────────────────────
  const tableWrap = document.createElement('div');
  tableWrap.className = 'cl-day-table-wrap';

  const table = document.createElement('table');
  table.className = 'cl-day-table';

  // Column headers — clicking P/L or Pts header also sorts
  const thead = document.createElement('thead');
  const mkTh = (txt, sf) => {
    const th = document.createElement('th');
    th.textContent = txt + (sf && _clDaySortField === sf ? ' \u2193' : '');
    if (sf) {
      th.style.cursor = 'pointer';
      th.title = 'Sort by ' + txt;
      th.addEventListener('click', () => {
        _clDaySortField = _clDaySortField === sf ? null : sf;
        _renderContent();
      });
    }
    return th;
  };
  const hr = document.createElement('tr');
  [['#'], ['Instrument'], ['Lots'], ['Entry'], ['Exit'], ['Dur'], ['P/L (Rs)', 'pnl'], ['Pts', 'pts']]
    .forEach(([t, sf]) => hr.appendChild(mkTh(t, sf)));
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const tableRowEls = [];
  displayRows.forEach((r, displayIdx) => {
    const tr = document.createElement('tr');
    tr.title = 'Go to Trade ' + (r.idx + 1);
    tr.style.cursor = 'pointer';
    tr.tabIndex = 0;
    const goToTrade = () => {
      _clTab = r.idx;
      _renderTradeTabs();
      _renderGroupTabs();
      _renderContent();
    };
    tr.addEventListener('click', goToTrade);
    tr.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToTrade(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); tableRowEls[displayIdx + 1]?.focus(); }
      else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (displayIdx === 0) sortableStatEls[0]?.focus();
        else tableRowEls[displayIdx - 1]?.focus();
      }
    });

    const rc = r.pnlNum !== null ? (r.pnlNum > 0 ? 'var(--green)' : r.pnlNum < 0 ? 'var(--red)' : '') : '';
    const pc = r.ptsNum !== null ? (r.ptsNum > 0 ? 'var(--green)' : r.ptsNum < 0 ? 'var(--red)' : '') : '';
    if (r.pnlNum !== null && r.pnlNum < 0) tr.classList.add('cl-day-row-loss');
    const lots = _clLots(r.instr, r.qty);

    tr.innerHTML =
      '<td>' + (r.idx + 1) + '</td>' +
      '<td>' + (r.instr || '—') + (r.ttype ? ' <span class="cl-day-ttype">' + r.ttype + '</span>' : '') + '</td>' +
      '<td style="color:var(--text-muted)">' + (lots !== null ? lots : '—') + '</td>' +
      '<td>' + fmtTime(r.entryT) + '</td>' +
      '<td>' + fmtTime(r.exitT) + '</td>' +
      '<td>' + (r.durSec !== null ? fmtDur(r.durSec) : '—') + '</td>' +
      '<td style="color:' + rc + ';font-weight:' + (rc ? '700' : '400') + '">' + (r.pnlNum !== null ? fmtNum(r.pnlNum) : '—') + '</td>' +
      '<td style="color:' + pc + '">' + (r.ptsNum !== null ? fmtNum(r.ptsNum) : '—') + '</td>';
    tableRowEls.push(tr);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  body.appendChild(tableWrap);

  // Wire stat card keyboard/click handlers (needs tableRowEls to be populated)
  _wireStatKeys(tableRowEls);
}

/* ── All trades summary tab ──────────────────────────────────────────────── */
function _renderAllContent(body) {
  body.style.padding = '16px 20px';
  body.style.overflow = 'auto';
  body.style.display = 'block';

  const toSec = s => {
    if (!s) return null;
    const p = String(s).split(':');
    return parseInt(p[0]||0)*3600 + parseInt(p[1]||0)*60 + parseInt(p[2]||0);
  };
  const fmtDur = d => {
    if (!d && d !== 0) return '—';
    const h = Math.floor(d/3600), m = Math.floor((d%3600)/60), s = d%60;
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return s > 0 ? m + 'm ' + s + 's' : m + 'm';
    return s + 's';
  };
  const fmtTime = t => {
    if (!t) return '—';
    const parts = String(t).split(':');
    return parts.length >= 2 ? parts[0].padStart(2,'0') + ':' + parts[1].padStart(2,'0') : t;
  };
  const fmtNum = n => n === null ? '—' : String(Math.trunc(n));
  const normDate = d => {
    if (!d) return '';
    const s = String(d).trim();
    const m = s.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/);
    return m ? m[1] + '-' + m[2] + '-' + m[3] : s;
  };

  // Show "Full Range" in date header when All tab is active
  const _dispEl = document.getElementById('cl-date-display');
  if (_dispEl) _dispEl.textContent = 'Full Range';

  // Build rows from all trades
  let totalPnl = 0, totalPts = 0, totalFee = 0, pnlCount = 0, ptsCount = 0;
  const _dateCounter = {};   // per-day running count → dayIdx
  const allRows = (state.trades || []).map((trade, i) => {
    const buyT  = trade['Buy Time']  || trade['buy_time']  || trade['BUY TIME']  || '';
    const sellT = trade['Sell Time'] || trade['sell_time'] || trade['SELL TIME'] || '';
    const s1 = toSec(buyT), s2 = toSec(sellT);
    const entryT = (s1 !== null && s2 !== null && s1 <= s2) ? buyT  : (s2 !== null && s1 !== null ? sellT : buyT || sellT);
    const exitT  = (s1 !== null && s2 !== null && s1 <= s2) ? sellT : (s2 !== null && s1 !== null ? buyT  : sellT || buyT);
    const durSec = (s1 !== null && s2 !== null) ? Math.abs(s2 - s1) : null;
    const pnlRaw = trade['Net P/L'] || trade['Gross P/L'] || trade['Rs'] || trade['rs'] || trade['RS'] || '';
    const pnlNum = parseFloat(String(pnlRaw).replace(/,/g, ''));
    const ptsRaw = trade['Pt'] || trade['pt'] || '';
    const ptsNum = parseFloat(String(ptsRaw).replace(/,/g, ''));
    const feeRaw = trade['Brokerage'] || trade['brokerage'] || trade['Broker'] || trade['broker'] || trade['BROKER'] || trade['Fee'] || trade['fee'] || '';
    const feeNum = parseFloat(String(feeRaw).replace(/,/g, ''));
    if (!isNaN(pnlNum)) { totalPnl += pnlNum; pnlCount++; }
    if (!isNaN(ptsNum)) { totalPts += ptsNum; ptsCount++; }
    if (!isNaN(feeNum)) totalFee += feeNum;
    const instr = trade['Instrument'] || trade['instrument'] || '';
    const date  = normDate(trade['trade_date'] || trade['Date'] || trade['date'] || '');
    const qtyRaw = trade['Qty'] || trade['qty'] || trade['Quantity'] || trade['quantity'] || trade['QTY'] || '';
    const qtyNum = parseInt(String(qtyRaw).replace(/,/g, ''), 10);
    _dateCounter[date] = (_dateCounter[date] || 0) + 1;
    const dayIdx = _dateCounter[date];   // 1-based trade number within that date
    return {
      idx: i,
      dayIdx,
      date,
      instr,
      qty: isNaN(qtyNum) ? null : qtyNum,
      ttype:  trade['TradeType'] || trade['tradetype'] || '',
      entryT: entryT || '',
      exitT:  exitT  || '',
      durSec,
      pnlNum: isNaN(pnlNum) ? null : pnlNum,
      ptsNum: isNaN(ptsNum) ? null : ptsNum,
    };
  }).filter(r => r.instr || r.entryT || r.pnlNum !== null);

  // Apply sort
  let displayRows = [...allRows];
  if (_clAllSortField === 'pnl') {
    displayRows.sort((a, b) => (b.pnlNum ?? -Infinity) - (a.pnlNum ?? -Infinity));
  } else if (_clAllSortField === 'pts') {
    displayRows.sort((a, b) => (b.ptsNum ?? -Infinity) - (a.ptsNum ?? -Infinity));
  }

  // ── Stats bar ──────────────────────────────────────────────────────────────
  const stats = document.createElement('div');
  stats.className = 'cl-day-stats';

  const sortableStatEls = [];
  const mkStat = (label, value, color, sortField) => {
    const el = document.createElement('div');
    el.className = 'cl-day-stat';
    if (sortField) {
      el.tabIndex = 0;
      el.dataset.sortField = sortField;
      if (_clAllSortField === sortField) el.classList.add('cl-day-stat-sorted');
      el.title = 'Space / click: sort by ' + label + ' (high to low)';
      sortableStatEls.push(el);
    }
    const lbl = document.createElement('div');
    lbl.className = 'cl-day-stat-label';
    lbl.textContent = label;
    const val = document.createElement('div');
    val.className = 'cl-day-stat-value';
    val.textContent = value;
    if (color) val.style.color = color;
    el.appendChild(lbl);
    el.appendChild(val);
    return el;
  };

  const pnlColor = pnlCount > 0 ? (totalPnl > 0 ? 'var(--green)' : totalPnl < 0 ? 'var(--red)' : '') : '';
  const ptsColor = ptsCount > 0 ? (totalPts > 0 ? 'var(--green)' : totalPts < 0 ? 'var(--red)' : '') : '';
  stats.appendChild(mkStat('Total P/L (Rs)', pnlCount > 0 ? fmtNum(totalPnl) : '—', pnlColor, 'pnl'));
  stats.appendChild(mkStat('Total Points',   ptsCount > 0 ? fmtNum(totalPts) : '—', ptsColor, 'pts'));
  stats.appendChild(mkStat('Trades',         allRows.length.toString(), ''));
  if (totalFee > 0) stats.appendChild(mkStat('T. Fee', fmtNum(totalFee), 'var(--text-muted)'));
  body.appendChild(stats);

  const _wireStatKeys = tableRowEls => {
    sortableStatEls.forEach((el, i) => {
      el.addEventListener('click', () => {
        const sf = el.dataset.sortField;
        _clAllSortField = _clAllSortField === sf ? null : sf;
        _renderContent();
        setTimeout(() => document.querySelector('#cl-body .cl-day-stat[data-sort-field="' + sf + '"]')?.focus(), 0);
      });
      el.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          sortableStatEls[(i + 1) % sortableStatEls.length].focus();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          sortableStatEls[(i - 1 + sortableStatEls.length) % sortableStatEls.length].focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          document.querySelector('#cl-trade-tabs .cl-all-tab')?.focus();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          tableRowEls[0]?.focus();
        } else if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          el.click();
        }
      });
    });
  };

  // ── Horizontal bell chart ──────────────────────────────────────────────────
  const bellChart = _buildBellChart(allRows);
  if (bellChart) body.appendChild(bellChart);

  // ── Summary table ──────────────────────────────────────────────────────────
  const tableWrap = document.createElement('div');
  tableWrap.className = 'cl-day-table-wrap';

  const table = document.createElement('table');
  table.className = 'cl-day-table';

  const thead = document.createElement('thead');
  const mkTh = (txt, sf) => {
    const th = document.createElement('th');
    th.textContent = txt + (sf && _clAllSortField === sf ? ' \u2193' : '');
    if (sf) {
      th.style.cursor = 'pointer';
      th.title = 'Sort by ' + txt;
      th.addEventListener('click', () => {
        _clAllSortField = _clAllSortField === sf ? null : sf;
        _renderContent();
      });
    }
    return th;
  };
  const hr = document.createElement('tr');
  [['#'], ['Date'], ['Instrument'], ['Lots'], ['Entry'], ['Exit'], ['Dur'], ['P/L (Rs)', 'pnl'], ['Pts', 'pts']]
    .forEach(([t, sf]) => hr.appendChild(mkTh(t, sf)));
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const tableRowEls = [];
  displayRows.forEach((r, displayIdx) => {
    const tr = document.createElement('tr');
    tr.title = 'Go to Trade ' + (r.idx + 1);
    tr.style.cursor = 'pointer';
    tr.tabIndex = 0;
    const goToTrade = () => {
      _clTab = r.idx;
      _renderTradeTabs();
      _renderGroupTabs();
      _renderContent();
    };
    tr.addEventListener('click', goToTrade);
    tr.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToTrade(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); tableRowEls[displayIdx + 1]?.focus(); }
      else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (displayIdx === 0) sortableStatEls[0]?.focus();
        else tableRowEls[displayIdx - 1]?.focus();
      }
    });

    const rc = r.pnlNum !== null ? (r.pnlNum > 0 ? 'var(--green)' : r.pnlNum < 0 ? 'var(--red)' : '') : '';
    const pc = r.ptsNum !== null ? (r.ptsNum > 0 ? 'var(--green)' : r.ptsNum < 0 ? 'var(--red)' : '') : '';
    if (r.pnlNum !== null && r.pnlNum < 0) tr.classList.add('cl-day-row-loss');
    const lots = _clLots(r.instr, r.qty);

    tr.innerHTML =
      '<td>' + (r.idx + 1) + '</td>' +
      '<td style="color:var(--text-muted);font-size:0.75rem">' + (r.date || '—') + '</td>' +
      '<td>' + (r.instr || '—') + (r.ttype ? ' <span class="cl-day-ttype">' + r.ttype + '</span>' : '') + '</td>' +
      '<td style="color:var(--text-muted)">' + (lots !== null ? lots : '—') + '</td>' +
      '<td>' + fmtTime(r.entryT) + '</td>' +
      '<td>' + fmtTime(r.exitT) + '</td>' +
      '<td>' + (r.durSec !== null ? fmtDur(r.durSec) : '—') + '</td>' +
      '<td style="color:' + rc + ';font-weight:' + (rc ? '700' : '400') + '">' + (r.pnlNum !== null ? fmtNum(r.pnlNum) : '—') + '</td>' +
      '<td style="color:' + pc + '">' + (r.ptsNum !== null ? fmtNum(r.ptsNum) : '—') + '</td>';
    tableRowEls.push(tr);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  body.appendChild(tableWrap);

  _wireStatKeys(tableRowEls);
}
