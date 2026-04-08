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

  function notableTable(rows) {
    if (!rows.length) return '<div style="color:#556070;font-size:0.82rem;padding:20px;">None in current filter range.</div>';
    const th = s => `<th style="padding:10px 14px;text-align:left;font-size:0.72rem;color:#8892a4;font-weight:700;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #2e3347;">${s}</th>`;
    const td = (s, c) => `<td style="padding:10px 14px;font-size:0.85rem;color:${c||'#e8eaf0'};">${s}</td>`;
    const body = rows.map(r => {
      const pl = r.netPL;
      const clr = pl >= 0 ? '#4caf7d' : '#e05c5c';
      return `<tr style="border-bottom:1px solid #2e334710; transition:background 0.2s;" onmouseover="this.style.background='#ffffff05'" onmouseout="this.style.background='transparent'">
        ${td(fmtDate(r.date))}
        ${td(r.trades.length + ' trades')}
        ${td(fmtRs(pl), clr)}
        ${td(r.label||'', '#8b949e')}
      </tr>`;
    }).join('');
    return `<table style="width:100%;border-collapse:collapse;"><thead><tr>${th('Date')}${th('Volume')}${th('Net P/L')}${th('Tag')}</tr></thead><tbody>${body}</tbody></table>`;
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

    let labels = [], values = [], sorted = [];
    if (aggregateByDay) {
      const dMap = {};
      filteredTrades.forEach(t => {
        const d = t.trade_date || t.date || '';
        if (d) { dMap[d] = (dMap[d]||0) + parseFloat(t['Net P/L'] || t['Rs'] || 0); }
      });
      const dayKeys = Object.keys(dMap).sort();
      labels = dayKeys.map(k => k.replace(/20\d\d-/, ''));
      values = dayKeys.map(k => dMap[k]);
    } else {
      sorted = [...filteredTrades].sort((a, b) => (a.date||'').localeCompare(b.date||'') || (a['Buy Time']||'').localeCompare(b['Buy Time']||''));
      labels = sorted.map(t => (t.trade_date || t.date || '').replace(/20\d\d-/, ''));
      values = sorted.map(t => parseFloat(t['Net P/L'] || t['Rs'] || 0));
    }

    titleEl.textContent = `Drilldown — ${sliceLabel} (${filteredTrades.length} trades)`;
    if (document.getElementById('qs-drilldown-close')) document.getElementById('qs-drilldown-close').style.visibility = 'visible';
    chartEl.innerHTML = '';

    _drillChart = new ApexCharts(chartEl, {
      chart: { type: 'bar', height: 400, background: 'transparent', toolbar: { show: false }, animations: { enabled: true, speed: 400 } },
      series: [{ name: 'Net P/L', data: values }],
      xaxis: { 
        categories: labels, 
        labels: { show: false }, // Hide irrelevant numbers/dates on X
        axisBorder: { show: false }, axisTicks: { show: false } 
      },
      yaxis: { labels: { style: { colors: '#666' }, formatter: v => v >= 1000 || v <= -1000 ? (v/1000).toFixed(1)+'k' : Math.round(v) } },
      colors: [sliceColor || '#58a6ff'],
      plotOptions: { bar: { distributed: true, borderRadius: 4, columnWidth: '70%' } },
      dataLabels: { enabled: false },
      legend: { show: false },
      grid: { borderColor: '#ffffff08' }, // Light grid lines
      tooltip: {
        theme: 'dark',
        custom: ({ dataPointIndex }) => {
          const v = values[dataPointIndex];
          const clr = v >= 0 ? '#4caf7d' : '#e05c5c';
          if (aggregateByDay) return `<div style="padding:10px;font-size:12px;background:#161c2e;">Date: ${labels[dataPointIndex]}<br/><b style="color:${clr};font-size:14px;">Net: ₹${v.toFixed(0)}</b></div>`;
          const t = sorted[dataPointIndex];
          return `<div style="padding:10px;font-size:12px;background:#161c2e;">${t.trade_date || t.date}<br/>${t.Instrument || 'Trade'}<br/><b style="color:${clr};font-size:14px;">₹${v.toFixed(0)}</b></div>`;
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

  function openQuickStats() {
    const from = state.dateRange?.from, to = state.dateRange?.to;
    let initialTrades = (state.trades || []).filter(t => {
      const d = t.trade_date || t.date || '';
      return d && (!from || d >= from) && (!to || d <= to);
    });

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
          const qFilters = document.getElementById('quick-stats-filters');
          const vStatsBtn = document.getElementById('vd-stats-btn');

          if (target === 'visual') {
            if (vGrid) vGrid.style.display = 'grid';
            if (qContent) qContent.style.display = 'none';
            if (qFilters) qFilters.style.display = 'none';
            if (vStatsBtn) vStatsBtn.style.display = 'inline-block';
            window.dispatchEvent(new Event('resize'));
          } else if (target === 'quick') {
            if (vGrid) vGrid.style.display = 'none';
            if (qContent) qContent.style.display = 'block';
            if (qFilters) qFilters.style.display = 'flex';
            if (vStatsBtn) vStatsBtn.style.display = 'none';
            openQuickStats();
            setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
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
