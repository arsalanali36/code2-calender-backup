# JS - Dashboard and Table Column Ops
Consolidated code context for AI assistants.


## File: `static/js/dashboard.js`
```js
﻿/**
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

function renderDashboard() {
  const subtitle = document.getElementById('dashboard-subtitle');
  if (subtitle) {
    if (state.dateRange.from || state.dateRange.to) {
      subtitle.textContent = `for ${state.dateRange.from || '...'} to ${state.dateRange.to || '...'}`;
    } else {
      subtitle.textContent = `for ${MONTHS[state.month]} ${state.year}`;
    }
  }
  applyDashboardStatVisibility();
  applyDashboardStatOrder();

  const trades = getTradesForMonth(state.year, state.month);

  let overall = 0;
  let net = 0;
  let hasGrossAndNetCols = false;

  // Let's compute PNL accurately, preferring Gross P/L and Net P/L if available
  trades.forEach(t => {
    const gPl = parseNumber(t['Gross P/L']);
    const nPl = parseNumber(t['Net P/L']);
    if (gPl !== null && nPl !== null) {
      overall += gPl;
      net += nPl;
      hasGrossAndNetCols = true;
    }
  });

  const charges = sumByKeys(trades, ['Other Charges', 'Charges', 'Charge', 'charges', 'charge', 'Transaction Charges', 'Charges (Total)', 'Total Charges']) || 0;
  const brokerage = sumByKeys(trades, ['Brokerage', 'brokerage', 'Brokerage Charges', 'Brokerage (Total)']) || 0;
  const totalFees = charges + brokerage;

  if (!hasGrossAndNetCols) {
    const pnlList = trades.map(getTradePnl).filter(n => n !== null);
    overall = pnlList.reduce((a, b) => a + b, 0);
    net = overall - totalFees;
  }

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

## File: `static/js/table-colops.js`
```js
/**
 * @fileoverview table-colops.js
 * @description Tag filter panel, add/rename/delete columns, edit column modal.
 * @exports renderTagFilterPanel, applyTagFilter, addColumn, renameColumn,
 *          deleteColumn, openEditColumnModal
 * @reads state.columns, state.trades, state.filterValues
 * @writes state.columns, state.trades (tag cells on rename/delete)
 * @calls saveTrades, renderTable
 */

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

  // Update active tag filter banner
  const banner = document.getElementById('active-tag-filter-banner');
  const textEl = document.getElementById('active-tag-filter-text');
  const clearBtn = document.getElementById('clear-tag-filter-btn');

  if (banner && textEl) {
    if (state.tagFilter.length > 0) {
      // Extract just the tag names (strip the column info for display context)
      const displayTags = state.tagFilter.map(k => {
        const parsed = parseTagFilterKey(k);
        return parsed.tag;
      }).join(', ');

      textEl.textContent = displayTags;
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }
  }

  // Bind clear button if not already bound
  if (clearBtn && !clearBtn.dataset.bound) {
    clearBtn.addEventListener('click', () => {
      state.tagFilter = [];
      renderTagFilterPanel();
      applyTagFilter();
    });
    clearBtn.dataset.bound = 'true';
  }
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
