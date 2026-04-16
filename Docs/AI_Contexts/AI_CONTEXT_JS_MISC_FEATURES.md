# JS - Misc (quick-stats, quotes, ohlc-manager)
Consolidated code context for AI assistants.


## File: `static/js/quick-stats.js`
```js
/* ── quick-stats.js ──────────────────────────────────────────────────────── */
/* Builds per-day aggregations from state.trades and renders Quick Stats modal */

(function () {

  /* ── local state ── */
  let activeFilter = 'both';
  let _drillChart = null;

  /* ── helpers ── */
  function fmtRs(n) {
    const abs = Math.abs(n);
    const str = abs >= 1000 ? '₹' + (abs / 1000).toFixed(1) + 'k' : '₹' + Math.round(abs);
    return n < 0 ? '-' + str : str;
  }
  function fmtDate(d) { return d.replace(/-/g, '/'); }

  /* ── aggregate trades → per-day data ── */
  function buildDayMap(trades) {
    const map = {};
    trades.forEach(t => {
      const d = t.trade_date || t.date || '';
      if (!d) return;
      const netVal = t['Net P/L'] || t['Rs'];
      if (netVal === null || netVal === undefined || netVal === '') return;
      if (!map[d]) map[d] = { date: d, trades: [], netPL: 0, grossPL: 0 };
      map[d].trades.push(t);
      map[d].netPL   += Number(netVal || 0);
      map[d].grossPL += Number(t['Gross P/L'] || 0);
    });
    return map;
  }

  function streaks(days) {
    let maxW = 0, maxL = 0, curW = 0, curL = 0;
    days.forEach(d => {
      if (d.netPL > 0) { curW++; curL = 0; maxW = Math.max(maxW, curW); }
      else             { curL++; curW = 0; maxL = Math.max(maxL, curL); }
    });
    return { maxWin: maxW, maxLoss: maxL };
  }

  function computeStats(trades) {
    const dayMap = buildDayMap(trades);
    const days = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
    if (!days.length) return null;

    const winDays  = days.filter(d => d.netPL > 0);
    const lossDays = days.filter(d => d.netPL <= 0);
    const single3k = days.filter(d => d.trades.some(t => Number(t['Net P/L'] || 0) >= 3000));
    const single5k = days.filter(d => d.trades.some(t => Number(t['Net P/L'] || 0) >= 5000));
    const overLoss = days.filter(d => d.trades.length >= 3 && d.netPL < 0);
    
    const dist1 = days.filter(d => d.trades.length === 1).length;
    const dist2 = days.filter(d => d.trades.length === 2).length;
    const dist3p = days.filter(d => d.trades.length >= 3).length;

    const bestDay  = days.reduce((a, b) => a.netPL > b.netPL ? a : b);
    const worstDay = days.reduce((a, b) => a.netPL < b.netPL ? a : b);
    const avgPL = days.reduce((s, d) => s + d.netPL, 0) / days.length;

    let bestTrade = null;
    trades.forEach(t => {
      const v = Number(t['Net P/L'] || t['Rs'] || 0);
      if (!bestTrade || v > Number(bestTrade['Net P/L'] || bestTrade['Rs'] || 0)) bestTrade = t;
    });

    const { maxWin, maxLoss } = streaks(days);
    const wRate1 = days.filter(d => d.trades.length === 1 && d.netPL > 0).length;
    const wRate3p = days.filter(d => d.trades.length >= 3 && d.netPL > 0).length;

    return {
      totalDays: days.length, winDays: winDays.length, lossDays: lossDays.length,
      single3k, single5k, overLoss,
      dist1, dist2, dist3p,
      bestDay, worstDay, avgPL, bestTrade,
      maxWin, maxLoss,
      wRate1, wRate1Total: dist1, wRate3p, wRate3pTotal: dist3p,
      days
    };
  }

  /* ── premium grouped stat block builder ── */
  function statBlock(title, items) {
    const row = (label, val, clr, statKey) => `
    <div class="qs-stat-row" data-stat="${statKey||''}" 
         style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; 
                cursor:${statKey?'pointer':'default'}; padding:6px 10px; border-radius:8px; 
                background:rgba(255,255,255,0.02); border-left:3px solid ${statKey?clr||'#30363d50':'transparent'}; 
                transition:all 0.2s;" 
         onmouseover="if('${statKey}') {this.style.background='rgba(88,166,255,0.1)'; this.style.transform='translateX(4px)';}" 
         onmouseout="this.style.background='rgba(255,255,255,0.02)'; this.style.transform='none';">
      <span style="font-size:0.8rem; color:#8b949e; font-weight:500;">${label}</span>
      <span style="font-size:1.15rem; font-weight:800; color:${clr||'#f0f6fc'}">${val}</span>
    </div>`;

    return `<div style="background:#1c2128; border:1px solid #30363d; border-radius:12px; padding:16px; min-width:0; box-shadow:0 4px 12px rgba(0,0,0,0.2);">
      <div style="font-size:0.75rem; color:#58a6ff; font-weight:800; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:14px; opacity:0.8;">${title}</div>
      ${items.map(i => row(i.l, i.v, i.c, i.k)).join('')}
    </div>`;
  }

  function _notableMiniMtmSvg(trades) {
    const W = 80, H = 32, pad = 2;
    if (!trades || !trades.length) return '';
    // Build MTM curve: cumulative PnL after each trade
    let run = 0;
    const pts = [0, ...trades.map(t => {
      run += (typeof getTradePnl === 'function' ? (getTradePnl(t) || 0) : 0);
      return run;
    })];
    const min = Math.min(...pts), max = Math.max(...pts);
    const range = (max - min) || 1;
    const isGreen = pts[pts.length - 1] >= 0;
    const color = isGreen ? '#3fb950' : '#f85149';
    const toX = i => pad + (i / (pts.length - 1)) * (W - pad * 2);
    const toY = v => (H - pad) - ((v - min) / range) * (H - pad * 2);
    const path = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
    return `<svg width="${W}" height="${H}" style="display:block;overflow:visible;"><path d="${path}" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${toX(pts.length-1).toFixed(1)}" cy="${toY(pts[pts.length-1]).toFixed(1)}" r="2.5" fill="${color}"/></svg>`;
  }

  function notableTable(rows) {
    if (!rows.length) return '<div style="color:#556070;font-size:0.82rem;padding:20px;">None in current filter range.</div>';
    const th = s => `<th style="padding:10px 14px;text-align:left;font-size:0.72rem;color:#8892a4;font-weight:700;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #2e3347;">${s}</th>`;
    const td = (s, c) => `<td style="padding:10px 14px;font-size:0.85rem;color:${c||'#e8eaf0'};">${s}</td>`;
    const body = rows.map(r => {
      const pl = r.netPL;
      const clr = pl >= 0 ? '#4caf7d' : '#e05c5c';
      const miniSvg = _notableMiniMtmSvg(r.trades);
      return `<tr style="border-bottom:1px solid #2e334710; transition:background 0.2s;" onmouseover="this.style.background='#ffffff05'" onmouseout="this.style.background='transparent'">
        ${td(fmtDate(r.date))}
        ${td(r.trades.length + ' trades')}
        ${td(fmtRs(pl), clr)}
        <td style="padding:6px 14px;">${miniSvg}</td>
        ${td(r.label||'', '#8b949e')}
      </tr>`;
    }).join('');
    return `<table style="width:100%;border-collapse:collapse;"><thead><tr>${th('Date')}${th('Volume')}${th('Net P/L')}${th('MTM')}${th('Tag')}</tr></thead><tbody>${body}</tbody></table>`;
  }

  /* ── bucket helpers ── */
  function parseDurMin(t) {
    const bt = t['Buy Time'] || '', st = t['Sell Time'] || '';
    if (!bt || !st) return null;
    const toSec = s => { const [h,m,sec] = s.split(':').map(Number); return h*3600+m*60+(sec||0); };
    return Math.abs(toSec(st) - toSec(bt)) / 60;
  }
  function bucketPt(pt) {
    if (pt < 0)  return 'Loss (< 0)';
    if (pt < 5)  return '0 – 5 pts';
    if (pt < 15) return '5 – 15 pts';
    if (pt < 30) return '15 – 30 pts';
    return '30+ pts';
  }
  function bucketDur(min) {
    if (min < 5)  return '< 5 min';
    if (min < 15) return '5 – 15 min';
    if (min < 30) return '15 – 30 min';
    if (min < 60) return '30 – 60 min';
    return '60+ min';
  }
  function countBuckets(items, bucketFn, order) {
    const counts = {};
    order.forEach(k => counts[k] = 0);
    items.forEach(v => { const b = bucketFn(v); if (b in counts) counts[b]++; });
    return { labels: order, series: order.map(k => counts[k]) };
  }

  /* ── drilldown bar chart ── */
  function renderDrilldown(filteredTrades, sliceLabel, sliceColor, aggregateByDay) {
    const wrap = document.getElementById('qs-drilldown-wrap');
    const titleEl = document.getElementById('qs-drilldown-title');
    const chartEl = document.getElementById('qs-drilldown-chart');
    if (!wrap || !chartEl) return;
    if (_drillChart) { try { _drillChart.destroy(); } catch(e){} _drillChart = null; }
    if (!filteredTrades.length) { wrap.style.display = 'none'; return; }

    let labels = [], values = [], sorted = [], dayKeys = [], hasImgFlags = [];
    const baseColor = sliceColor || '#58a6ff';
    const noImgColor = '#3a3f4a';

    if (aggregateByDay) {
      const dMap = {};
      filteredTrades.forEach(t => {
        const d = t.trade_date || t.date || '';
        if (d) { dMap[d] = (dMap[d]||0) + parseFloat(t['Net P/L'] || t['Rs'] || 0); }
      });
      dayKeys = Object.keys(dMap).sort();
      labels = dayKeys.map(k => k.replace(/20\d\d-/, ''));
      values = dayKeys.map(k => dMap[k]);
      hasImgFlags = dayKeys.map(dk => filteredTrades.filter(t => (t.trade_date||t.date||'') === dk).some(t => (t.images||[]).length > 0));
    } else {
      sorted = [...filteredTrades].sort((a, b) => (a.date||'').localeCompare(b.date||'') || (a['Buy Time']||'').localeCompare(b['Buy Time']||''));
      labels = sorted.map(t => (t.trade_date || t.date || '').replace(/20\d\d-/, ''));
      values = sorted.map(t => parseFloat(t['Net P/L'] || t['Rs'] || 0));
      hasImgFlags = sorted.map(t => (t.images||[]).length > 0);
    }

    const barColors = hasImgFlags.map(hasImg => hasImg ? baseColor : noImgColor);

    titleEl.textContent = `Drilldown — ${sliceLabel} (${filteredTrades.length} trades)`;
    if (document.getElementById('qs-drilldown-close')) document.getElementById('qs-drilldown-close').style.visibility = 'visible';
    chartEl.innerHTML = '';

    _drillChart = new ApexCharts(chartEl, {
      chart: {
        type: 'bar', height: 400, background: 'transparent', toolbar: { show: false }, animations: { enabled: true, speed: 400 },
        events: {
          dataPointSelection: (e, chart, opts) => {
            if (typeof openTradeSidebar !== 'function') return;
            const idx = opts.dataPointIndex;
            if (aggregateByDay) {
              const dk = dayKeys[idx];
              const dayTrades = filteredTrades.filter(t => (t.trade_date || t.date || '') === dk);
              const allImages = dayTrades.reduce((arr, t) => arr.concat(t.images || []), []);
              openTradeSidebar({ trade_date: dk, images: allImages, Instrument: dk, _dayTrades: dayTrades });
            } else {
              openTradeSidebar(sorted[idx]);
            }
          }
        }
      },
      series: [{ name: 'Net P/L', data: values }],
      xaxis: {
        categories: labels,
        labels: { show: false },
        axisBorder: { show: false }, axisTicks: { show: false }
      },
      yaxis: { labels: { style: { colors: '#666' }, formatter: v => v >= 1000 || v <= -1000 ? (v/1000).toFixed(1)+'k' : Math.round(v) } },
      colors: barColors,
      plotOptions: { bar: { distributed: true, borderRadius: 4, columnWidth: '70%' } },
      dataLabels: { enabled: false },
      legend: { show: false },
      grid: { borderColor: '#ffffff08' }, // Light grid lines
      tooltip: {
        theme: 'dark',
        custom: ({ dataPointIndex }) => {
          const v = values[dataPointIndex];
          const clr = v >= 0 ? '#4caf7d' : '#e05c5c';
          const noImg = !hasImgFlags[dataPointIndex] ? '<br/><span style="color:#555;font-size:10px;">📷 no images</span>' : '';
          if (aggregateByDay) return `<div style="padding:10px;font-size:12px;background:#161c2e;">Date: ${labels[dataPointIndex]}<br/><b style="color:${clr};font-size:14px;">Net: ₹${v.toFixed(0)}</b>${noImg}</div>`;
          const t = sorted[dataPointIndex];
          return `<div style="padding:10px;font-size:12px;background:#161c2e;">${t.trade_date || t.date}<br/>${t.Instrument || 'Trade'}<br/><b style="color:${clr};font-size:14px;">₹${v.toFixed(0)}</b>${noImg}</div>`;
        }
      }
    });
    _drillChart.render();
  }

  function renderCharts(s, trades) {
    const donut = (el, series, labels, colors, getFilterFn) => {
      if (!el) return;
      el.innerHTML = '';
      const filtered = series.map((v, i) => ({ v, l: labels[i], c: colors[i] })).filter(x => x.v > 0);
      if (!filtered.length) { el.innerHTML = '<div style="color:#556070;font-size:0.85rem;text-align:center;padding:40px;">No data for current filter</div>'; return; }
      new ApexCharts(el, {
        chart: {
          type: 'donut', height: '100%', background: 'transparent',
          events: {
            dataPointSelection: (e, chart, opts) => {
              const slice = filtered[opts.dataPointIndex];
              if (slice) renderDrilldown(getFilterFn(slice.l), slice.l, slice.c, el.id === 'qs-chart-winloss');
            }
          }
        },
        series: filtered.map(x => x.v),
        labels: filtered.map(x => x.l),
        colors: filtered.map(x => x.c),
        legend: { show: false },
        stroke: { width: 0 },
        plotOptions: { pie: { donut: { labels: { show: true, value: { fontSize: '22px', fontWeight: 700, color: '#fff', formatter: v => v } } } } }
      }).render();
    };

    donut(document.getElementById('qs-chart-winloss'), [s.winDays, s.lossDays], ['Win Days', 'Loss Days'], ['#4caf7d', '#e05c5c'], l => {
        const isWin = l === 'Win Days';
        return trades.filter(t => { const d = s.days.find(x => x.date === (t.trade_date || t.date)); return d && (isWin ? d.netPL > 0 : d.netPL <= 0); });
    });
    donut(document.getElementById('qs-chart-tpd'), [s.dist1, s.dist2, s.dist3p], ['1 trade', '2 trades', '3+ trades'], ['#5b8ef0', '#f0a45b', '#9b7cf0'], l => {
        const count = l === '1 trade' ? 1 : l === '2 trades' ? 2 : 3;
        return trades.filter(t => { const d = s.days.find(x => x.date === (t.trade_date || t.date)); return d && (count === 3 ? d.trades.length >= 3 : d.trades.length === count); });
    });
    const ptOrder = ['Loss (< 0)', '0 – 5 pts', '5 – 15 pts', '15 – 30 pts', '30+ pts'];
    const ptTrades = trades.filter(t => t['Pt'] !== undefined);
    const ptBuckets = countBuckets(ptTrades.map(t => Number(t['Pt'])), bucketPt, ptOrder);
    donut(document.getElementById('qs-chart-points'), ptBuckets.series, ptBuckets.labels, ['#e05c5c', '#8892a4', '#5b8ef0', '#f0a45b', '#4caf7d'], l => ptTrades.filter(t => bucketPt(Number(t['Pt'])) === l));

    const durOrder = ['< 5 min', '5 – 15 min', '15 – 30 min', '30 – 60 min', '60+ min'];
    const durTrades = trades.filter(t => parseDurMin(t) !== null);
    const durBuckets = countBuckets(durTrades.map(t => parseDurMin(t)), bucketDur, durOrder);
    donut(document.getElementById('qs-chart-duration'), durBuckets.series, durBuckets.labels, ['#a78bfa', '#5b8ef0', '#4caf7d', '#f0a45b', '#e05c5c'], l => durTrades.filter(t => bucketDur(parseDurMin(t)) === l));
  }

  let qsActiveMonthFilter = 'all';

  window.setQsMonthFilter = function(val) {
      qsActiveMonthFilter = val;
      openQuickStats();
  };

  function openQuickStats() {
    // Use getVdTrades() so the trade set matches the cumulative chart exactly
    // (same date range filter, same broker filter, same normalization)
    let initialTrades = typeof getVdTrades === 'function'
      ? getVdTrades()
      : (state.trades || []).filter(t => {
          const from = state.dateRange?.from, to = state.dateRange?.to;
          const d = t.trade_date || t.date || '';
          return d && (!from || d >= from) && (!to || d <= to);
        });

    const availableMonths = new Set();
    initialTrades.forEach(t => {
      const d = t.trade_date || t.date || '';
      if(d) availableMonths.add(parseInt(d.split('-')[1], 10) - 1);
    });

    const tabsCont = document.getElementById('qs-month-tabs-container');
    if (tabsCont) {
        const _mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        let html = `<div class="vd-month-tab ${qsActiveMonthFilter === 'all' ? 'active' : ''}" onclick="setQsMonthFilter('all')" style="font-size:11px;padding:2px 7px;">ALL</div>`;
        _mo.forEach((mName, idx) => {
            const hasData = availableMonths.has(idx);
            const isActive = qsActiveMonthFilter === idx;
            html += `<div class="vd-month-tab ${isActive ? 'active' : ''} ${hasData ? 'has-data' : 'no-data'}" 
                onclick="${hasData ? `setQsMonthFilter(${idx})` : ''}" style="font-size:11px;padding:2px 7px;">${mName}</div>`;
        });
        tabsCont.innerHTML = html;
        
        // Hide the subtitle date range if we are using the detailed month filter inside the custom range
        const subtitle = document.getElementById('qs-monthly-subtitle');
        if (subtitle) {
            if (qsActiveMonthFilter !== 'all') subtitle.style.display = 'none';
            else subtitle.style.display = 'inline';
        }
    }

    if (qsActiveMonthFilter !== 'all') {
        initialTrades = initialTrades.filter(t => {
           const d = t.trade_date || t.date || '';
           if(!d) return false;
           return parseInt(d.split('-')[1], 10) - 1 === qsActiveMonthFilter;
        });
    }

    // Safely update the Dashboard Grid locally
    if (typeof renderDashboard === 'function') {
        renderDashboard(initialTrades);
    }

    /* ── DUAL LAYER FILTER (By Day P/L + Individual Trade P/L) ── */
    let trades = initialTrades;
    if (activeFilter !== 'both') {
        const dm = buildDayMap(initialTrades);
        trades = initialTrades.filter(t => {
            const dNet = dm[t.trade_date || t.date]?.netPL;
            const tPL  = parseFloat(t['Net P/L'] || t['Rs'] || 0);
            
            const isDayMatch = activeFilter === 'gain' ? dNet > 0 : dNet <= 0;
            const isTradeMatch = activeFilter === 'gain' ? tPL > 0 : tPL <= 0;
            
            return isDayMatch && isTradeMatch;
        });
    }

    const s = computeStats(trades);
    const contentWrap = document.getElementById('quick-stats-tab-content');
    if (!contentWrap) return;

    if (!s) {
        document.getElementById('qs-stats-groups').innerHTML = '<div style="color:#556070;padding:40px;text-align:center;width:100%;">No data available for current filter selection.</div>';
        return;
    }

    const totalNet = s.days.reduce((a, b) => a + b.netPL, 0);
    const winRate = s.totalDays ? Math.round(s.winDays / s.totalDays * 100) + '%' : '0%';

    document.getElementById('qs-stats-groups').innerHTML = [
        statBlock('Activity Summary', [
            { l: 'Total Days', v: s.totalDays },
            { l: 'Win Days', v: s.winDays, c: '#3fb950', k: 'win' },
            { l: 'Loss Days', v: s.lossDays, c: '#f85149', k: 'loss' },
            { l: 'Win Rate', v: winRate, c: '#58a6ff' }
        ]),
        statBlock('P&L Statistics', [
            { l: 'Net P&L', v: fmtRs(totalNet), c: totalNet >= 0 ? '#3fb950' : '#f85149' },
            { l: 'Avg / Day', v: fmtRs(s.avgPL), c: s.avgPL >= 0 ? '#3fb950' : '#f85149' },
            { l: '1-Trade Win', v: s.wRate1Total ? Math.round(s.wRate1 / s.wRate1Total * 100) + '%' : 'N/A', k: 'rate1' },
            { l: '3+ Trade Win', v: s.wRate3pTotal ? Math.round(s.wRate3p / s.wRate3pTotal * 100) + '%' : 'N/A', k: 'rate3p' }
        ]),
        statBlock('Streaks & Extreme', [
            { l: 'Best Streak', v: s.maxWin + 'd', c: '#f0c45b' },
            { l: 'Worst Streak', v: s.maxLoss + 'd', c: '#f85149' },
            { l: 'Best Day', v: fmtRs(s.bestDay.netPL), c: '#3fb950', k: 'bestDay' },
            { l: 'Worst Day', v: fmtRs(s.worstDay.netPL), c: '#f85149', k: 'worstDay' }
        ]),
        statBlock('Notable Outliers', [
            { l: 'Days ≥ ₹3k', v: s.single3k.length, c: '#f0c45b', k: 'single3k' },
            { l: 'Days ≥ ₹5k', v: s.single5k.length, c: '#bc8cff', k: 'single5k' },
            { l: 'Best Trade', v: fmtRs(Number(s.bestTrade['Net P/L'] || s.bestTrade['Rs'] || 0)), c: '#3fb950', k: 'bestTrade' },
            { l: 'OT Loss Days', v: s.overLoss.length, c: '#f85149', k: 'overLoss' }
        ])
    ].join('');

    document.querySelectorAll('.qs-stat-row').forEach(row => {
        const k = row.getAttribute('data-stat');
        if (!k) return;
        row.onclick = () => {
            let filtered = [], lbl = '', clr = '#58a6ff', isDay = false;
            switch(k) {
                case 'win': filtered = trades.filter(t => { const d = s.days.find(x => x.date === (t.trade_date || t.date)); return d && d.netPL > 0; }); lbl = 'Win Days'; clr = '#3fb950'; isDay = true; break;
                case 'loss': filtered = trades.filter(t => { const d = s.days.find(x => x.date === (t.trade_date || t.date)); return d && d.netPL <= 0; }); lbl = 'Loss Days'; clr = '#f85149'; isDay = true; break;
                case 'rate1': filtered = trades.filter(t => { const d = s.days.find(x => x.date === (t.trade_date || t.date)); return d && d.trades.length === 1 && d.netPL > 0; }); lbl = '1-Trd Day Wins'; isDay = true; break;
                case 'rate3p': filtered = trades.filter(t => { const d = s.days.find(x => x.date === (t.trade_date || t.date)); return d && d.trades.length >= 3 && d.netPL > 0; }); lbl = '3+ Trd Day Wins'; isDay = true; break;
                case 'bestDay': filtered = s.bestDay.trades; lbl = 'Best Day: ' + s.bestDay.date; clr = '#3fb950'; isDay = false; break;
                case 'worstDay': filtered = s.worstDay.trades; lbl = 'Worst Day: ' + s.worstDay.date; clr = '#f85149'; isDay = false; break;
                case 'single3k': filtered = s.single3k.flatMap(d => d.trades); lbl = 'Days ≥ ₹3k Trade'; isDay = true; break;
                case 'single5k': filtered = s.single5k.flatMap(d => d.trades); lbl = 'Days ≥ ₹5k Trade'; isDay = true; break;
                case 'overLoss': filtered = s.overLoss.flatMap(d => d.trades); lbl = 'OT Loss Days'; isDay = true; break;
                case 'bestTrade': filtered = [s.bestTrade]; lbl = 'Best Trade'; isDay = false; break;
            }
            if (filtered.length) renderDrilldown(filtered, lbl, clr, isDay);
        };
    });

    const notable = []; const seen = new Set();
    s.single5k.forEach(d => { if (!seen.has(d.date)) { seen.add(d.date); notable.push({ ...d, label: '🚀 Trade ≥ ₹5k' }); } });
    s.single3k.forEach(d => { if (!seen.has(d.date)) { seen.add(d.date); notable.push({ ...d, label: '🎯 Trade ≥ ₹3k' }); } });
    s.overLoss.forEach(d => { if (!seen.has(d.date)) { seen.add(d.date); notable.push({ ...d, label: '⚠️ Over-traded & lost' }); } });
    notable.sort((a,b) => b.date.localeCompare(a.date));
    document.getElementById('qs-notable-table').innerHTML = notableTable(notable.slice(0, 30));

    const titleEl = document.getElementById('qs-drilldown-title'), chartEl = document.getElementById('qs-drilldown-chart');
    if (titleEl) titleEl.textContent = 'Analysis — Select a chart slice to drill down';
    if (chartEl) chartEl.innerHTML = '<div style="height:100%; display:flex; align-items:center; justify-content:center; color:#444; font-size:0.9rem; border:2px dashed #222; border-radius:8px;">Pie charts click karo drill-down dekhne ke liye</div>';
    if (document.getElementById('qs-drilldown-close')) document.getElementById('qs-drilldown-close').style.visibility = 'hidden';
    if (_drillChart) { try { _drillChart.destroy(); } catch(e){} _drillChart = null; }

    renderCharts(s, trades);
  }

  function initQuickStats() {
    // Top-Level Tab Switching for Visual Dashboard
    const dashTabs = document.querySelectorAll('.main-dash-tab');
    if (dashTabs.length) {
      dashTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          dashTabs.forEach(t => {
            t.classList.remove('active');
            t.style.background = 'transparent';
            t.style.color = '#8b949e';
            t.style.borderBottom = '1px solid var(--border2, #30363d)';
            t.style.zIndex = '1';
            t.style.bottom = '0';
          });
          tab.classList.add('active');
          tab.style.background = 'var(--surface, #161b22)';
          tab.style.color = '#fff';
          tab.style.borderBottom = 'none';
          tab.style.zIndex = '2';
          tab.style.bottom = '-1px';

          const target = tab.getAttribute('data-tab');
          const vGrid = document.getElementById('vd-charts-grid');
          const qContent = document.getElementById('quick-stats-tab-content');
          const pBento = document.getElementById('premium-bento-tab-content');
          const qFilters = document.getElementById('quick-stats-filters');
          const vStatsBtn = document.getElementById('vd-stats-btn');

          if (target === 'visual') {
            if (vGrid) vGrid.style.display = 'grid';
            if (qContent) qContent.style.display = 'none';
            if (pBento) pBento.style.display = 'none';
            if (qFilters) qFilters.style.display = 'none';
            if (vStatsBtn) vStatsBtn.style.display = 'inline-block';
            window.dispatchEvent(new Event('resize'));
          } else if (target === 'quick') {
            if (vGrid) vGrid.style.display = 'none';
            if (qContent) qContent.style.display = 'block';
            if (pBento) pBento.style.display = 'none';
            if (qFilters) qFilters.style.display = 'flex';
            if (vStatsBtn) vStatsBtn.style.display = 'none';
            openQuickStats();
            setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
          } else if (target === 'premium_bento') {
            if (vGrid) vGrid.style.display = 'none';
            if (qContent) qContent.style.display = 'none';
            if (pBento) pBento.style.display = 'block';
            if (qFilters) qFilters.style.display = 'none';
            if (vStatsBtn) vStatsBtn.style.display = 'none';
          }
        });
      });
    }

    const btn = document.getElementById('quick-stats-btn');
    if (btn) btn.onclick = () => {
      const qTab = document.querySelector('.main-dash-tab[data-tab="quick"]');
      if (qTab) {
        qTab.click();
        qTab.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        openQuickStats();
      }
    };

    const drillCloseBtn = document.getElementById('qs-drilldown-close');
    if (drillCloseBtn) {
      drillCloseBtn.onclick = () => {
        if (_drillChart) _drillChart.destroy(); _drillChart = null;
        document.getElementById('qs-drilldown-title').textContent = 'Analysis — Select a chart slice to drill down';
        document.getElementById('qs-drilldown-chart').innerHTML = '<div style="height:100%; display:flex; align-items:center; justify-content:center; color:#444; font-size:0.9rem; border:2px dashed #222; border-radius:8px;">Pie charts click karo drill-down dekhne ke liye</div>';
        document.getElementById('qs-drilldown-close').style.visibility = 'hidden';
      };
    }

    document.querySelectorAll('.qs-tab').forEach(tab => {
        tab.onclick = () => {
            const target = tab.getAttribute('data-tab');
            document.querySelectorAll('.qs-tab').forEach(t => { 
                t.classList.remove('active'); t.style.borderBottomColor = 'transparent'; t.style.color = '#8b949e'; t.style.background = 'transparent'; 
            });
            tab.classList.add('active'); tab.style.borderBottomColor = '#58a6ff'; tab.style.color = '#fff'; tab.style.background = '#161b22';
            
            document.querySelectorAll('.qs-tab-content').forEach(c => {
                const isTarget = c.id === 'qs-chart-' + target;
                c.style.opacity = isTarget ? '1' : '0';
                c.style.pointerEvents = isTarget ? 'all' : 'none';
                c.style.position = isTarget ? 'relative' : 'absolute';
            });
            window.dispatchEvent(new Event('resize'));
        };
    });

    document.querySelectorAll('.qs-filter-btn').forEach(btn => {
        btn.onclick = () => {
            activeFilter = btn.getAttribute('data-filter');
            document.querySelectorAll('.qs-filter-btn').forEach(b => { 
                b.classList.remove('active'); b.style.background = 'transparent'; b.style.color = '#8b949e'; 
            });
            btn.classList.add('active'); btn.style.background = '#58a6ff'; btn.style.color = '#fff';
            openQuickStats();
        };
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initQuickStats);
  else initQuickStats();

})();

```

## File: `static/js/quotes.js`
```js
/**
 * @fileoverview Quote modal: local quote carousel, CSV import/export, per-quote rating slider.
 * @exports openQuoteModal, closeQuoteModal, navigateQuote
 * @reads/writes state.quotes, state.quoteIndex, state.quoteRatings
 */

const QUOTE_STORAGE_KEY = 'tj_quotes';
const QUOTE_INDEX_KEY = 'tj_quote_index';
const QUOTE_RATINGS_KEY = 'tj_quote_ratings';
const QUOTE_FONT_SIZE_KEY = 'tj_quote_font_size';
const QUOTE_AUTO_POPUP_KEY = 'tj_quote_auto_popup';
const DEFAULT_QUOTES = [
  {
    Quote: 'Market me sabse bada edge discipline hai, indicator nahi.',
    Source: 'Trading Journal',
    Tags: 'discipline,mindset',
    Date: '2026-03-12'
  },
  {
    Quote: 'Small loss ko accept karna easy hai, bada loss ko justify karna mehenga hai.',
    Source: 'Risk Rules',
    Tags: 'risk,loss-control',
    Date: '2026-03-12'
  },
  {
    Quote: 'Jo setup likh nahi sakte, us setup ko consistently trade bhi nahi kar sakte.',
    Source: 'Process First',
    Tags: 'setup,process',
    Date: '2026-03-12'
  }
];

function initializeQuotesFeature() {
  if (window.__quotesFeatureBound) return;
  window.__quotesFeatureBound = true;

  loadQuotesFromStorage();

  const modal = document.getElementById('quote-modal');
  const closeBtn = document.getElementById('quote-modal-close');
  const prevBtn = document.getElementById('quote-prev-btn');
  const nextBtn = document.getElementById('quote-next-btn');
  const slider = document.getElementById('quote-rating-slider');
  const uploadBtn = document.getElementById('quote-upload-btn');
  const downloadBtn = document.getElementById('quote-download-btn');
  const csvInput = document.getElementById('quote-csv-input');
  const fontMinusBtn = document.getElementById('quote-font-minus');
  const fontPlusBtn = document.getElementById('quote-font-plus');
  const toolsBtn = document.getElementById('quote-tools-btn');
  const toolsMenu = document.getElementById('quote-tools-menu');
  const randomLaunchBtn = document.getElementById('quote-random-launch-btn');
  const randomPanel = document.getElementById('quote-random-panel');
  const randomEnabled = document.getElementById('quote-random-enabled');
  const randomMinutes = document.getElementById('quote-random-minutes');
  const schedulerInlineBtn = document.getElementById('quote-scheduler-inline-btn');

  if (!modal) return;

  applyQuoteFontSize(loadQuoteFontSize());
  if (closeBtn) closeBtn.addEventListener('click', closeQuoteModal);
  if (prevBtn) prevBtn.addEventListener('click', () => navigateQuote(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => navigateQuote(1));
  if (slider) {
    slider.addEventListener('input', () => {
      const current = getCurrentQuote();
      if (!current) return;
      state.quoteRatings[getQuoteKey(current)] = String(slider.value);
      saveQuoteRatings();
      updateQuoteRatingLabel();
    });
  }
  if (uploadBtn && csvInput) {
    uploadBtn.addEventListener('click', () => csvInput.click());
    csvInput.addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0];
      if (file) await importQuotesCsv(file);
      e.target.value = '';
    });
  }
  if (downloadBtn) downloadBtn.addEventListener('click', downloadQuotesCsv);
  if (fontMinusBtn) fontMinusBtn.addEventListener('click', () => adjustQuoteFontSize(-0.08));
  if (fontPlusBtn) fontPlusBtn.addEventListener('click', () => adjustQuoteFontSize(0.08));
  if (toolsBtn && toolsMenu) {
    toolsBtn.addEventListener('click', e => {
      e.stopPropagation();
      toolsMenu.classList.toggle('open');
    });
    toolsMenu.addEventListener('click', e => e.stopPropagation());
  }
  if (randomLaunchBtn && randomPanel) {
    randomLaunchBtn.addEventListener('click', e => {
      e.stopPropagation();
      randomPanel.classList.toggle('open');
    });
    randomPanel.addEventListener('click', e => e.stopPropagation());
  }
  if (schedulerInlineBtn && randomPanel) {
    schedulerInlineBtn.addEventListener('click', e => {
      e.stopPropagation();
      toggleQuoteAutoPopupFromButton();
    });
  }
  if (randomEnabled) {
    randomEnabled.checked = !!state.quoteAutoPopup.enabled;
    randomEnabled.addEventListener('change', () => {
      state.quoteAutoPopup.enabled = !!randomEnabled.checked;
      saveQuoteAutoPopup();
      syncQuoteAutoPopup();
    });
  }
  if (randomMinutes) {
    randomMinutes.value = String(state.quoteAutoPopup.minMinutes || 15);
    randomMinutes.addEventListener('change', () => {
      const nextMinutes = Math.max(1, Math.min(180, parseInt(randomMinutes.value || '15', 10) || 15));
      state.quoteAutoPopup.minMinutes = nextMinutes;
      randomMinutes.value = String(nextMinutes);
      saveQuoteAutoPopup();
      if (state.quoteAutoPopup.enabled) syncQuoteAutoPopup(true);
    });
  }
  modal.addEventListener('click', e => {
    if (e.target === modal) closeQuoteModal();
  });

  document.addEventListener('keydown', e => {
    if (!modal.classList.contains('open')) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateQuote(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      navigateQuote(1);
    }
  });
  document.addEventListener('click', () => {
    if (randomPanel) randomPanel.classList.remove('open');
    if (toolsMenu) toolsMenu.classList.remove('open');
  });

  renderQuoteModal();
  syncQuoteAutoPopup();
}

function loadQuotesFromStorage() {
  try {
    const storedQuotes = JSON.parse(localStorage.getItem(QUOTE_STORAGE_KEY) || 'null');
    state.quotes = Array.isArray(storedQuotes) && storedQuotes.length
      ? storedQuotes.map(normalizeQuoteRow).filter(Boolean)
      : DEFAULT_QUOTES.map(normalizeQuoteRow).filter(Boolean);
  } catch (e) {
    state.quotes = DEFAULT_QUOTES.map(normalizeQuoteRow).filter(Boolean);
  }
  if (!state.quotes.length) state.quotes = DEFAULT_QUOTES.map(normalizeQuoteRow).filter(Boolean);

  try {
    state.quoteRatings = JSON.parse(localStorage.getItem(QUOTE_RATINGS_KEY) || '{}') || {};
  } catch (e) {
    state.quoteRatings = {};
  }
  try {
    const popupCfg = JSON.parse(localStorage.getItem(QUOTE_AUTO_POPUP_KEY) || 'null');
    state.quoteAutoPopup.enabled = popupCfg?.enabled !== false;
    state.quoteAutoPopup.minMinutes = Math.max(1, Math.min(180, parseInt(popupCfg?.minMinutes || 15, 10) || 15));
  } catch (e) {
    state.quoteAutoPopup.enabled = true;
    state.quoteAutoPopup.minMinutes = 15;
  }

  const maxIndex = Math.max(0, state.quotes.length - 1);
  const savedIndex = parseInt(localStorage.getItem(QUOTE_INDEX_KEY) || '0', 10);
  state.quoteIndex = Number.isFinite(savedIndex) ? Math.min(maxIndex, Math.max(0, savedIndex)) : 0;
  saveQuotesToStorage();
}

function saveQuotesToStorage() {
  localStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(state.quotes));
  localStorage.setItem(QUOTE_INDEX_KEY, String(state.quoteIndex || 0));
}

function saveQuoteRatings() {
  localStorage.setItem(QUOTE_RATINGS_KEY, JSON.stringify(state.quoteRatings || {}));
}

function saveQuoteAutoPopup() {
  localStorage.setItem(QUOTE_AUTO_POPUP_KEY, JSON.stringify({
    enabled: !!state.quoteAutoPopup.enabled,
    minMinutes: Math.max(1, Math.min(180, parseInt(state.quoteAutoPopup.minMinutes || 15, 10) || 15))
  }));
}

function normalizeQuoteRow(row) {
  if (!row || typeof row !== 'object') return null;
  const quote = String(row.Quote ?? row.quote ?? '').trim();
  if (!quote) return null;
  return {
    Quote: quote,
    Source: String(row.Source ?? row.source ?? '').trim() || 'Unknown',
    Tags: String(row.Tags ?? row.tags ?? '').trim() || '-',
    Date: String(row.Date ?? row.date ?? '').trim() || new Date().toISOString().slice(0, 10)
  };
}

function getQuoteKey(quote) {
  return `${quote.Date}|${quote.Source}|${quote.Quote}`;
}

function getCurrentQuote() {
  if (!Array.isArray(state.quotes) || !state.quotes.length) return null;
  state.quoteIndex = Math.max(0, Math.min(state.quoteIndex || 0, state.quotes.length - 1));
  return state.quotes[state.quoteIndex];
}

function openQuoteModal(randomize = false) {
  initializeQuotesFeature();
  const modal = document.getElementById('quote-modal');
  if (!modal) return;
  if (randomize && state.quotes.length > 1) {
    state.quoteIndex = Math.floor(Math.random() * state.quotes.length);
    saveQuotesToStorage();
  }
  renderQuoteModal();
  modal.classList.add('open');
}

function closeQuoteModal() {
  const modal = document.getElementById('quote-modal');
  if (modal) modal.classList.remove('open');
}

function navigateQuote(direction) {
  if (!state.quotes.length) return;
  const len = state.quotes.length;
  state.quoteIndex = (state.quoteIndex + direction + len) % len;
  saveQuotesToStorage();
  renderQuoteModal();
}

function renderQuoteModal() {
  const quote = getCurrentQuote();
  const textEl = document.getElementById('quote-text');
  const counterEl = document.getElementById('quote-modal-counter');
  const sliderEl = document.getElementById('quote-rating-slider');
  const prevBtn = document.getElementById('quote-prev-btn');
  const nextBtn = document.getElementById('quote-next-btn');
  const schedulerInlineBtn = document.getElementById('quote-scheduler-inline-btn');

  if (!textEl || !counterEl || !sliderEl) return;

  if (!quote) {
    textEl.textContent = 'No quotes available.';
    counterEl.textContent = '0 / 0';
    sliderEl.value = '5';
    updateQuoteRatingLabel();
    if (schedulerInlineBtn) schedulerInlineBtn.classList.toggle('active', !!state.quoteAutoPopup.enabled);
    return;
  }

  textEl.innerHTML = formatQuoteText(quote.Quote);
  counterEl.textContent = `${state.quoteIndex + 1} / ${state.quotes.length}`;
  sliderEl.value = state.quoteRatings[getQuoteKey(quote)] || '5';
  if (prevBtn) prevBtn.disabled = state.quotes.length <= 1;
  if (nextBtn) nextBtn.disabled = state.quotes.length <= 1;
  if (schedulerInlineBtn) {
    schedulerInlineBtn.classList.toggle('active', !!state.quoteAutoPopup.enabled);
    schedulerInlineBtn.textContent = state.quoteAutoPopup.enabled
      ? `Auto Popup On (${state.quoteAutoPopup.minMinutes}m+)`
      : 'Auto Popup';
  }
  updateQuoteRatingLabel();
}

function loadQuoteFontSize() {
  return parseFloat(localStorage.getItem(QUOTE_FONT_SIZE_KEY) || '1.42');
}

function applyQuoteFontSize(size) {
  const safe = Math.max(0.92, Math.min(2.4, parseFloat(size) || 1.42));
  document.documentElement.style.setProperty('--quote-font-size', `${safe}rem`);
  localStorage.setItem(QUOTE_FONT_SIZE_KEY, String(safe));
}

function adjustQuoteFontSize(step) {
  applyQuoteFontSize(loadQuoteFontSize() + step);
}

function updateQuoteRatingLabel() {
  const label = document.getElementById('quote-rating-value');
  const slider = document.getElementById('quote-rating-slider');
  if (label && slider) label.textContent = `${slider.value} / 10`;
}

async function importQuotesCsv(file) {
  const raw = await file.text();
  const rows = parseDelimitedRows(raw);
  if (rows.length < 2) {
    showToast('CSV me data nahi mila', 'error');
    return;
  }

  const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
  const quoteIdx = headers.indexOf('quote');
  const sourceIdx = headers.indexOf('source');
  const tagsIdx = headers.indexOf('tags');
  const dateIdx = headers.indexOf('date');

  if (quoteIdx === -1 || sourceIdx === -1 || tagsIdx === -1 || dateIdx === -1) {
    showToast('CSV headers: Quote, Source, Tags, Date hone chahiye', 'error');
    return;
  }

  const parsed = rows.slice(1)
    .map(cols => normalizeQuoteRow({
      Quote: cols[quoteIdx],
      Source: cols[sourceIdx],
      Tags: cols[tagsIdx],
      Date: cols[dateIdx]
    }))
    .filter(Boolean);

  if (!parsed.length) {
    showToast('Valid quote rows nahi mile', 'error');
    return;
  }

  const merged = [...state.quotes];
  let added = 0;
  parsed.forEach(item => {
    const key = getQuoteKey(item);
    if (!merged.some(existing => getQuoteKey(existing) === key)) {
      merged.push(item);
      added++;
    }
  });
  if (!added) {
    showToast('CSV se koi naya quote add nahi hua', 'error');
    return;
  }

  state.quotes = merged;
  state.quoteIndex = state.quotes.length - 1;
  saveQuotesToStorage();
  renderQuoteModal();
  showToast(`${added} naye quote add hue`, 'success');
}

function parseDelimitedRows(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];
  const firstLine = normalized.split('\n')[0] || '';
  if (!firstLine) return [];
  const delimiter = firstLine.includes('|') && !firstLine.includes(',') ? '|' : ',';
  if (normalized.includes('"') && normalized.includes('\n')) {
    return parseCsvText(normalized, delimiter);
  }
  const lines = normalized.split('\n').filter(line => line.trim());
  if (!lines.length) return [];
  return lines.map(line => parseDelimitedLine(line, delimiter));
}

function parseDelimitedLine(line, delimiter) {
  const out = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
}

function downloadQuotesCsv() {
  const header = ['Quote', 'Source', 'Tags', 'Date'];
  const rows = state.quotes.map(quote => header.map(key => escapeCsvCell(quote[key] || '')));
  const csv = [header.join(','), ...rows.map(row => row.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `quotes_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('Quotes CSV download ready', 'success');
}

function escapeCsvCell(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function formatQuoteText(text) {
  const safe = escapeHtml(String(text ?? ''));
  return safe.replace(/,\s*/g, ',<br>');
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseCsvText(text, delimiter) {
  const rows = [];
  let row = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if (ch === '\n' && !inQuotes) {
      row.push(current.trim());
      rows.push(row);
      row = [];
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.length || row.length) {
    row.push(current.trim());
    rows.push(row);
  }
  return rows.filter(cols => cols.some(col => String(col || '').trim()));
}

function toggleQuoteAutoPopupFromButton() {
  const enabled = !state.quoteAutoPopup.enabled;
  if (enabled) {
    const current = state.quoteAutoPopup.minMinutes || 15;
    const answer = window.prompt('Minimum kitne minute baad random quote popup aaye?', String(current));
    if (answer === null) return;
    const nextMinutes = Math.max(1, Math.min(180, parseInt(answer || String(current), 10) || current));
    state.quoteAutoPopup.minMinutes = nextMinutes;
    state.quoteAutoPopup.enabled = true;
    saveQuoteAutoPopup();
    showToast(`Auto popup on: minimum ${nextMinutes} min`, 'success');
  } else {
    state.quoteAutoPopup.enabled = false;
    saveQuoteAutoPopup();
    showToast('Auto popup off', 'success');
  }
  syncQuoteAutoPopup(true);
  renderQuoteModal();
}

function syncQuoteAutoPopup(reset = false) {
  if (state.quoteAutoPopup.timerId) {
    clearTimeout(state.quoteAutoPopup.timerId);
    state.quoteAutoPopup.timerId = null;
  }
  const enabledInput = document.getElementById('quote-random-enabled');
  const minInput = document.getElementById('quote-random-minutes');
  if (enabledInput) enabledInput.checked = !!state.quoteAutoPopup.enabled;
  if (minInput) minInput.value = String(state.quoteAutoPopup.minMinutes || 15);
  if (!state.quoteAutoPopup.enabled || !state.quotes.length) return;
  scheduleNextQuotePopup(reset);
}

function scheduleNextQuotePopup() {
  const baseMinutes = Math.max(1, parseInt(state.quoteAutoPopup.minMinutes || 15, 10));
  const delayMinutes = baseMinutes + Math.random() * baseMinutes;
  const delayMs = Math.round(delayMinutes * 60 * 1000);
  state.quoteAutoPopup.timerId = window.setTimeout(() => {
    if (!document.getElementById('quote-modal')?.classList.contains('open')) {
      state.quoteIndex = Math.floor(Math.random() * state.quotes.length);
      saveQuotesToStorage();
      openQuoteModal(true);
      showToast(`Random quote popped after ${baseMinutes}+ min window`, 'success');
    }
    scheduleNextQuotePopup();
  }, delayMs);
}

initializeQuotesFeature();

```

## File: `static/js/ohlc-manager.js`
```js
/**
 * ohlc-manager.js
 * ---------------
 * OHLC Data Manager modal — accessible from the profile dropdown.
 * Reuses existing /api/whatif/* endpoints (Dhan credentials, scrip master,
 * tradebook import, OHLC status, SSE sync).
 */

(function () {

  // ── State ───────────────────────────────────────────────────────────────────
  let _syncEs = null;

  // ── Open / Close ────────────────────────────────────────────────────────────

  function openOhlcManager() {
    const modal = document.getElementById('ohlc-mgr-modal');
    if (!modal) return;
    modal.classList.add('open');
    // Close profile dropdown
    const pd = document.getElementById('profile-dropdown');
    if (pd) pd.classList.remove('open');
    loadCredentials();
  }

  function closeOhlcManager() {
    const modal = document.getElementById('ohlc-mgr-modal');
    if (modal) modal.classList.remove('open');
    if (_syncEs) { _syncEs.close(); _syncEs = null; }
  }

  // ── Credentials ─────────────────────────────────────────────────────────────

  async function loadCredentials() {
    const el = document.getElementById('ohlc-cred-status');
    if (!el) return;
    el.innerHTML = '<span style="opacity:0.4">Loading...</span>';
    try {
      const r = await fetch('/api/whatif/config');
      const d = await r.json();
      if (d.configured) {
        const age = d.hours_ago != null
          ? `<span class="ohlc-cred-age">${d.hours_ago}h ago</span>` : '';
        el.innerHTML = `
          <span class="ohlc-cred-ok">&#10003; Configured</span>
          ${age}
          <span style="opacity:0.45;font-size:0.78rem;margin-left:6px;">ID: ${d.client_id}</span>
          <button class="btn btn-outline btn-sm" id="ohlc-cred-edit-btn" style="margin-left:8px;">Edit</button>
        `;
        document.getElementById('ohlc-cred-edit-btn').onclick = showCredForm;
      } else {
        el.innerHTML = `
          <span style="color:var(--red)">Not configured</span>
          <button class="btn btn-outline btn-sm" id="ohlc-cred-edit-btn" style="margin-left:8px;">Configure</button>
        `;
        document.getElementById('ohlc-cred-edit-btn').onclick = showCredForm;
        showCredForm();
      }
    } catch (e) {
      el.innerHTML = '<span style="color:var(--red)">Failed to load credentials</span>';
    }
  }

  function showCredForm() {
    const form = document.getElementById('ohlc-cred-form');
    if (form) {
      form.style.display = 'flex';
      document.getElementById('ohlc-client-id').focus();
    }
  }

  async function saveCredentials() {
    const clientId    = (document.getElementById('ohlc-client-id').value || '').trim();
    const accessToken = (document.getElementById('ohlc-access-token').value || '').trim();
    if (!clientId || !accessToken) {
      showToast('Client ID and Access Token are required', 'error');
      return;
    }
    try {
      const r = await fetch('/api/whatif/config', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ client_id: clientId, access_token: accessToken }),
      });
      const d = await r.json();
      if (d.ok) {
        document.getElementById('ohlc-cred-form').style.display = 'none';
        document.getElementById('ohlc-client-id').value    = '';
        document.getElementById('ohlc-access-token').value = '';
        await loadCredentials();
        showToast('Credentials saved');
      } else {
        showToast(d.error || 'Save failed', 'error');
      }
    } catch (e) {
      showToast('Save failed: ' + e.message, 'error');
    }
  }

  // ── Tradebook CSV Import ─────────────────────────────────────────────────────

  function bindTradebook() {
    const input  = document.getElementById('ohlc-tradebook-input');
    const btn    = document.getElementById('ohlc-tradebook-btn');
    const fname  = document.getElementById('ohlc-tradebook-fname');
    const impBtn = document.getElementById('ohlc-tradebook-import');

    btn.onclick    = () => input.click();
    input.onchange = () => {
      const f = input.files[0];
      if (f) {
        fname.textContent  = f.name;
        impBtn.disabled    = false;
      }
    };

    impBtn.onclick = async () => {
      const f = input.files[0];
      if (!f) return;
      impBtn.disabled    = true;
      impBtn.textContent = 'Importing...';
      const fd = new FormData();
      fd.append('file', f);
      try {
        const r = await fetch('/api/whatif/import-tradebook', { method: 'POST', body: fd });
        const d = await r.json();
        if (d.ok) {
          showToast(`Imported: ${d.imported} symbols, ${d.pairs} trade pairs`);
          appendLog(`Tradebook imported — ${d.imported} symbols, ${d.pairs} (symbol, date) pairs`);
          await loadStatus();
        } else {
          showToast(d.error || 'Import failed', 'error');
          appendLog('Tradebook import failed: ' + (d.error || ''), false);
        }
      } catch (e) {
        showToast('Import error: ' + e.message, 'error');
      } finally {
        impBtn.disabled    = false;
        impBtn.textContent = 'Import';
      }
    };
  }

  // ── Instruments Status Table ─────────────────────────────────────────────────

  async function loadStatus() {
    const tbody = document.getElementById('ohlc-instruments-tbody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;opacity:0.4;padding:14px;">Loading...</td></tr>';
    try {
      const r     = await fetch('/api/whatif/ohlc-status');
      const items = await r.json();
      renderStatusTable(items);
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" style="color:var(--red);padding:14px;">Error: ${e.message}</td></tr>`;
    }
  }

  function renderStatusTable(items) {
    const tbody = document.getElementById('ohlc-instruments-tbody');

    // Aggregate per symbol
    const bySymbol = {};
    for (const item of items) {
      const sym = item.symbol;
      if (!bySymbol[sym]) {
        bySymbol[sym] = { symbol: sym, total: 0, fetched: 0, mapped: false };
      }
      const s  = bySymbol[sym];
      const st = item.status || '';
      s.total++;
      if (st === 'complete')   s.fetched++;
      if (st !== 'not_mapped') s.mapped = true;
    }

    const rows = Object.values(bySymbol).sort((a, b) => a.symbol.localeCompare(b.symbol));

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;opacity:0.4;padding:14px;">No trades found in journal</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(row => {
      const pct = row.total > 0 ? row.fetched / row.total : 0;
      let statusHtml;
      if (!row.mapped) {
        statusHtml = '<span class="ohlc-status-dot ohlc-status-unmapped" title="Not mapped to Dhan security ID">?</span>';
      } else if (pct >= 1) {
        statusHtml = '<span class="ohlc-status-dot ohlc-status-ok" title="All dates fetched">&#10003;</span>';
      } else if (pct > 0) {
        statusHtml = `<span class="ohlc-status-dot ohlc-status-partial" title="${row.fetched}/${row.total} dates fetched">&#9651;</span>`;
      } else {
        statusHtml = '<span class="ohlc-status-dot ohlc-status-missing" title="No OHLC data yet">&#10007;</span>';
      }

      const mappedHtml = row.mapped
        ? '<span style="color:var(--green)">&#10003;</span>'
        : '<span style="opacity:0.3">&#8212;</span>';

      const ohlcHtml = row.fetched + '<span style="opacity:0.4">/' + row.total + '</span>';

      return `<tr>
        <td class="ohlc-sym-cell" title="${row.symbol}">${row.symbol}</td>
        <td style="text-align:center">${row.total}</td>
        <td style="text-align:center">${mappedHtml}</td>
        <td style="text-align:center">${ohlcHtml}</td>
        <td style="text-align:center">${statusHtml}</td>
      </tr>`;
    }).join('');
  }

  // ── Scrip Master Download ────────────────────────────────────────────────────

  async function downloadScripMaster() {
    const btn = document.getElementById('ohlc-scrip-dl-btn');
    btn.disabled    = true;
    btn.textContent = 'Downloading...';
    appendLog('Downloading Dhan scrip master from images.dhan.co...');
    try {
      const r = await fetch('/api/whatif/scrip/download', { method: 'POST' });
      const d = await r.json();
      if (d.ok) {
        appendLog('Scrip master downloaded and cached successfully.');
        showToast('Scrip master downloaded');
      } else {
        appendLog('Download failed: ' + (d.error || ''), false);
        showToast(d.error || 'Download failed', 'error');
      }
    } catch (e) {
      appendLog('Download error: ' + e.message, false);
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Download Scrip Master';
    }
  }

  // ── SSE Sync All ─────────────────────────────────────────────────────────────

  function startSyncAll() {
    if (_syncEs) { _syncEs.close(); _syncEs = null; }

    const syncBtn         = document.getElementById('ohlc-sync-all-btn');
    syncBtn.disabled      = true;
    syncBtn.innerHTML     = 'Syncing...';
    appendLog('─── Starting full OHLC sync ───');

    _syncEs = new EventSource('/api/whatif/sync-all-ohlc');

    _syncEs.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        appendLog(d.msg, d.ok !== false);
        if (d.done) {
          _syncEs.close();
          _syncEs = null;
          syncBtn.disabled    = false;
          syncBtn.innerHTML = '&#9654; Sync All OHLC';
          loadStatus();
        }
      } catch (_) {}
    };

    _syncEs.onerror = () => {
      appendLog('SSE connection closed — sync may have completed.', false);
      if (_syncEs) { _syncEs.close(); _syncEs = null; }
      syncBtn.disabled    = false;
      syncBtn.textContent = '&#9654; Sync All OHLC';
      loadStatus();
    };
  }

  // ── Log ──────────────────────────────────────────────────────────────────────

  function appendLog(msg, ok = true) {
    const log  = document.getElementById('ohlc-sync-log');
    if (!log) return;
    const line = document.createElement('div');
    line.className   = 'ohlc-log-line' + (ok ? '' : ' ohlc-log-err');
    line.textContent = msg;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  // ── Bind events ──────────────────────────────────────────────────────────────

  function bindEvents() {
    document.getElementById('ohlc-mgr-close').onclick     = closeOhlcManager;
    document.getElementById('ohlc-mgr-close-btn').onclick = closeOhlcManager;
    document.getElementById('ohlc-cred-save').onclick     = saveCredentials;
    document.getElementById('ohlc-cred-cancel').onclick   = () => {
      document.getElementById('ohlc-cred-form').style.display = 'none';
    };
    document.getElementById('ohlc-status-refresh-btn').onclick = loadStatus;
    document.getElementById('ohlc-scrip-dl-btn').onclick        = downloadScripMaster;
    document.getElementById('ohlc-sync-all-btn').onclick        = startSyncAll;
    document.getElementById('ohlc-log-clear-btn').onclick       = () => {
      document.getElementById('ohlc-sync-log').innerHTML = '';
    };

    // Profile dropdown button
    const ohlcBtn = document.getElementById('profile-ohlc-btn');
    if (ohlcBtn) ohlcBtn.onclick = openOhlcManager;

    // Close on overlay backdrop click
    document.getElementById('ohlc-mgr-modal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('ohlc-mgr-modal')) closeOhlcManager();
    });

    bindTradebook();
  }

  // ── Public ───────────────────────────────────────────────────────────────────
  window.openOhlcManager  = openOhlcManager;
  window.closeOhlcManager = closeOhlcManager;

  // Auto-bind when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

})();

```
