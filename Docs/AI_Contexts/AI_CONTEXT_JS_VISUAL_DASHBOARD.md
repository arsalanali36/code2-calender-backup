# JS - Visual Dashboard
Consolidated code context for AI assistants.


## File: `static/js/visual-dashboard.js`
```js
/**
 * @fileoverview visual-dashboard.js
 * @description ApexCharts visual dashboard: P&L charts, customizable stat cards, drag-drop, widths.
 * @exports initVisualDashboard, renderVisualDashboard, updateVdChartMode, updateVdChartType,
 *          updateVdChartWidth, bindVdEvents, bindVdDragDrop, renderVdStatsMenu,
 *          getVdStatsOrder, saveVdStatsOrder, getVdStatsState, saveVdStatsState,
 *          applyVdStatVisibility, applyVdStatOrder, syncVdSelects
 * @reads state.trades, state.dateRange
 * @calls ApexCharts (external lib), getTradePnl (local copy), formatCurrency
 * @storage vd_statsState, vd_statsOrder, vd_cardWidths
 */

const vdState = {
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    view: 'month', // 'month' or 'year'
    chartModes: {},
    mtmMonthFilter: 'all', // New: for local MTM filter
    mtmValueType: 'net', // New: for MTM curve value type (net, gross, pt)
    pptMonthFilter: 'all', // Points-Per-Trade month filter
    pptHideNoImg: false    // Points-Per-Trade: hide trades with no images
};

function updateVdChartMode(chartKey, mode) {
    vdState.chartModes[chartKey] = mode;
    // Persist to server so all devices see the same mode
    if (typeof _vdUiSet === 'function') _vdUiSet('vdChartModes', vdState.chartModes);
    renderVisualDashboard();
}

// Called after trades load — restores saved chart modes into vdState and updates DOM selects
function applyVdChartModes() {
    if (typeof _vdUiGet !== 'function') return;
    const saved = _vdUiGet('vdChartModes', null);
    if (!saved || typeof saved !== 'object') return;
    Object.assign(vdState.chartModes, saved);
    // Sync the mode <select> elements in the DOM
    document.querySelectorAll('.vd-mode-select').forEach(sel => {
        const card = sel.closest('.dash-card[data-vd-stat]');
        if (!card) return;
        const key = card.getAttribute('data-vd-stat');
        if (key && saved[key]) sel.value = saved[key];
    });
}

function updateVdMtmValueType(type) {
    vdState.mtmValueType = type;
    renderVdMtmThumbs(getVdTrades());
}

function getVdTradeValue(t, type) {
    const tp = type || vdState.mtmValueType || 'net';
    if (tp === 'gross') return parseFloat(t['Gross P/L'] || t['Gross']) || 0;
    if (tp === 'pt') return parseFloat(t['Pt'] || t['Points']) || 0;
    // Default: Net
    return typeof getTradePnl === 'function' ? getTradePnl(t) : (parseFloat(t['Net P/L'] || t['Net']) || 0);
}

let vdCharts = {};

function getVdTrades() {
    // Use state.trades assuming it's loaded in app state (data.js/state.js)
    // Fall back to empty array if state doesn't exist yet
    const allTrades = typeof state !== 'undefined' && Array.isArray(state.trades) ? state.trades : [];
    return allTrades.filter(t => {
        // Exclude manual empty rows without actual trade data
        if (!t['Time'] && !t['Ex Time'] && !t['Buy Time'] && !t['Sell Time'] && !t['Gross P/L'] && !t['Net P/L'] && !t['Rs'] && !t['Qty'] && !t['Qty.'] && !t['quantity'] && !t['Points'] && !t['Pt']) {
            return false;
        }

        // Check if the trade matches the broker filter if it's there
        if (typeof tradeMatchesBrokerFilter === 'function' && !tradeMatchesBrokerFilter(t)) return false;
        if (typeof tradeMatchesDateRange === 'function' && !tradeMatchesDateRange(t)) return false;
        if (typeof state !== 'undefined' && (state.dateRange.from || state.dateRange.to)) return true;

        // Parse Date
        let ds = extractDateFromTrade(t);
        let d = normalizeDate(ds);
        if (!d) return false;

        const parts = d.split('-');
        if (parts.length < 3) return false;
        const ty = parseInt(parts[0], 10);
        const tm = parseInt(parts[1], 10) - 1;

        if (vdState.view === 'year') {
            return ty === vdState.year;
        } else {
            return ty === vdState.year && tm === vdState.month;
        }
    });
}

function vdFmtDateLabel(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return dateStr;
    return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}, ${d.toLocaleString('default', { weekday: 'short' })}`;
}

function renderVisualDashboard() {
    updateVdRangeLabel();

    const trades = getVdTrades();
    
    // Advanced MTM Chart Integration
    if (typeof updateAdvMtmChart === 'function') {
        if (!document.getElementById('adv-mtm-controls-container').innerHTML) {
            initAdvancedMtmChart();
        } else {
            updateAdvMtmChart();
        }
    }

    renderVdMtmThumbs(trades);

    // Basic metrics
    let totalWin = 0;
    let totalLoss = 0;
    let winCount = 0;
    let totalTradesCount = 0;

    // Data for charts
    const strategyPnlMap = new Map(); // Setup -> Net P/L
    const strategyCountMap = new Map(); // Setup -> count
    const pointsPerTradeData = [];

    let longPnl = 0;
    let shortPnl = 0;
    let longCount = 0;
    let shortCount = 0;

    // Helper to build daily aggregated datamaps for a given mode
    const buildMapForMode = (mode) => {
        const pMap = new Map(), cMap = new Map(), qMap = new Map(), ptMap = new Map(), fMap = new Map(), bpSMap = new Map(), bpCMap = new Map();
        let ltc = 0;
        trades.forEach(t => {
            const pnl = getTradePnl(t) || 0;
            ltc++;
            const qty = parseFloat(t['Qty'] || t['quantity'] || t['Qty.']) || 0;
            const pt = parseFloat(t['Pt'] || t['Points']) || 0;
            const fc = parseFloat(t['fill_count'] || t['FC']) || 0;
            const buyPrice = parseFloat(t['Buy Price (Avg)'] || t['Buy Price']) || 0;

            let d = normalizeDate(extractDateFromTrade(t));
            if (mode === 'individual') d = `T${ltc} (${d})`;
            if (d && d !== `T${ltc} (undefined)`) {
                pMap.set(d, (pMap.get(d) || 0) + pnl);
                cMap.set(d, (cMap.get(d) || 0) + 1);
                qMap.set(d, (qMap.get(d) || 0) + qty);
                ptMap.set(d, (ptMap.get(d) || 0) + pt);
                fMap.set(d, (fMap.get(d) || 0) + fc);
                if (buyPrice > 0) {
                    bpSMap.set(d, (bpSMap.get(d) || 0) + buyPrice);
                    bpCMap.set(d, (bpCMap.get(d) || 0) + 1);
                }
            }
        });

        const sorted = Array.from(pMap.keys()).sort();
        const res = { dailyPlData: [], cumulativeData: [], dailyTradeCountData: [], dailyQtyData: [], dailyPointsData: [], dailyFcData: [], avgBuyPriceData: [], chartDates: [], rawDates: [] };
        let run = 0;
        sorted.forEach(d => {
            const v = pMap.get(d) || 0;
            res.dailyPlData.push(Math.round(v));
            run += v;
            res.cumulativeData.push(Math.round(run));
            res.dailyTradeCountData.push(cMap.get(d) || 0);
            res.dailyQtyData.push(qMap.get(d) || 0);
            res.dailyPointsData.push(Math.round(ptMap.get(d) || 0));
            res.dailyFcData.push(fMap.get(d) || 0);
            const bps = bpSMap.get(d) || 0, bpc = bpCMap.get(d) || 0;
            res.avgBuyPriceData.push(bpc > 0 ? Math.round(bps / bpc) : 0);

            let ds = d;
            if (ds.startsWith('T')) {
                const m = ds.match(/(T\d+) \((.*)\)/);
                if (m) {
                    const dobj = new Date(m[2] + 'T00:00:00');
                    if (!isNaN(dobj)) ds = `${m[1]} - ${dobj.toLocaleString('default', { month: 'short' })} ${dobj.getDate()}`;
                }
            } else {
                const dobj = new Date(ds + 'T00:00:00');
                if (!isNaN(dobj)) {
                    const mon = dobj.toLocaleString('default', { month: 'short' });
                    const day = dobj.getDate();
                    const dow = dobj.toLocaleString('default', { weekday: 'short' });
                    ds = [mon + ' ' + day, dow];
                }
            }
            res.chartDates.push(ds);
            res.rawDates.push(d);
        });
        return res;
    };

    const dataC = buildMapForMode('consolidated');
    const dataI = buildMapForMode('individual');

    const getDat = (key) => {
        const m = vdState.chartModes[key] || (typeof state !== 'undefined' ? state.calendarMode : 'consolidated');
        return m === 'individual' ? dataI : dataC;
    };

    trades.forEach(t => {
        const pnl = getTradePnl(t) || 0;
        const isWin = pnl > 0;

        totalTradesCount++;
        if (isWin) {
            totalWin += pnl;
            winCount++;
        } else {
            totalLoss += Math.abs(pnl);
        }

        const pt = parseFloat(t['Pt'] || t['Points']) || 0;
        const lot = parseFloat(t['Qty'] || t['quantity'] || t['Qty.']) || 0;
        let d = normalizeDate(extractDateFromTrade(t));
        pointsPerTradeData.push({ x: `T${totalTradesCount}`, y: pt, date: d || 'Unknown', amt: pnl, lot, trade: t });

        // Strategy Map (Use 'Setup' or 'Tags' column)
        const setupStr = typeof getTradeTagsForColumn === 'function' && state && state.tagColumns && state.tagColumns.length > 0
            ? getTradeTagsForColumn(t, state.tagColumns[0]).join(', ') || 'No Strategy'
            : t['Setup'] || t['Strategy'] || 'No Strategy';

        const setups = setupStr.split(',').map(s => s.trim()).filter(s => s);
        if (setups.length === 0) setups.push('No Strategy');

        setups.forEach(setup => {
            strategyPnlMap.set(setup, (strategyPnlMap.get(setup) || 0) + (pnl / setups.length));
            strategyCountMap.set(setup, (strategyCountMap.get(setup) || 0) + 1);
        });

        // Long vs Short
        const typeStr = (t['TradeType'] || t['Type'] || '').toLowerCase();
        if (typeStr.includes('buy') || typeStr.includes('long')) {
            longPnl += pnl;
            longCount++;
        } else if (typeStr.includes('sell') || typeStr.includes('short')) {
            shortPnl += pnl;
            shortCount++;
        }
    });

    // Calculate Metrics
    const winRate = totalTradesCount > 0 ? ((winCount / totalTradesCount) * 100).toFixed(1) + '%' : '0%';
    const profitFactor = totalLoss > 0 ? (totalWin / totalLoss).toFixed(2) : (totalWin > 0 ? 'âˆž' : '0.00');
    const avgPnl = totalTradesCount > 0 ? '₹ ' + ((totalWin - totalLoss) / totalTradesCount).toFixed(2) : '₹ 0.00';

    // Subtitle
    const subtitle = document.querySelector('.visual-dashboard-section .dashboard-subtitle');
    if (subtitle) {
        subtitle.textContent = totalTradesCount === 0 ? 'No Data Available' : 'Filtered Data';
    }

    // Common Options
    const themeMode = 'dark';
    const background = 'transparent';
    const textColor = '#8b949e'; // var(--text2)
    const fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

    const commonOptions = {
        chart: {
            background: background,
            foreColor: textColor,
            fontFamily: fontFamily,
            toolbar: { show: false },
            zoom: { enabled: false }
        },
        theme: { mode: themeMode },
        tooltip: { theme: 'dark' },
        grid: {
            borderColor: '#30363d',
            strokeDashArray: 4,
            padding: { top: 0, right: 10, bottom: 0, left: 10 }
        },
        dataLabels: { formatter: (val) => Math.round(val) },
        responsive: [{
            breakpoint: 769,
            options: {
                xaxis: { tickAmount: 5, labels: { rotate: -45, rotateAlways: true, style: { fontSize: '10px' } } },
                yaxis: { labels: { style: { fontSize: '10px' } } },
                chart: { toolbar: { show: false }, height: 200 },
                grid: { padding: { left: 0, right: 0, top: 0, bottom: 0 } },
                dataLabels: { style: { fontSize: '9px' } },
                legend: { fontSize: '11px', itemMargin: { horizontal: 4 } }
            }
        }]
    };

    // Re-create charts instead of trying to update dynamically, to avoid issues

    // 1. Cumulative Performance (Area Chart)
    if (vdCharts.cumulative) vdCharts.cumulative.destroy();
    const datCumul = getDat('cumulative');
    const _vdMakeDateTooltip = (rawDates, values, label, prefix='₹') => ({
        custom: function({ dataPointIndex }) {
            const raw = rawDates[dataPointIndex];
            const dateLbl = Array.isArray(raw) ? raw.join(', ') : vdFmtDateLabel(raw) || raw;
            const val = values[dataPointIndex];
            return `<div style="padding:8px 10px;background:var(--surface);border:1px solid var(--border);border-radius:6px;font-size:12px;line-height:1.8;">`
                + `<div><strong>Date:</strong> ${dateLbl}</div>`
                + `<div><strong>${label}:</strong> ${prefix}${Math.round(val).toLocaleString('en-IN')}</div></div>`;
        }
    });

    // Build smart tick labels: show only Tuesdays (NSE weekly expiry day)
    // Show at most ~12 ticks regardless; always show first and last
    const _smartCumulLabels = (() => {
        const raw = datCumul.rawDates || [];
        if (!raw.length) return [];
        // Find which indices are Tuesdays (day=2)
        const tuesdayIdx = raw.map((d, i) => {
            const dobj = new Date(d + 'T00:00:00');
            return dobj.getDay() === 2 ? i : -1;
        }).filter(i => i >= 0);

        // Build the label array — show label only for chosen indices
        const showSet = new Set(tuesdayIdx);
        // Always show first and last
        showSet.add(0);
        showSet.add(raw.length - 1);
        // If no Tuesdays, fall back to ~every 10 points
        if (tuesdayIdx.length === 0) {
            const step = Math.max(1, Math.floor(raw.length / 10));
            for (let i = 0; i < raw.length; i += step) showSet.add(i);
        }

        return (datCumul.chartDates || []).map((label, i) => showSet.has(i) ? label : '');
    })();

    const optionsCumulative = {
        ...commonOptions,
        series: [{ name: 'Cumulative P/L (₹)', data: datCumul.cumulativeData.length ? datCumul.cumulativeData : [0] }],
        chart: { ...commonOptions.chart, type: 'area', height: 300 },
        colors: ['#00e396'],
        fill: {
            type: 'gradient',
            gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] }
        },
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 2 },
        xaxis: {
            categories: (_smartCumulLabels.length ? _smartCumulLabels : (datCumul.chartDates.length ? datCumul.chartDates : ['No Data'])),
            tooltip: { enabled: false },
            labels: { rotate: -30, style: { fontSize: '10px' } }
        },
        yaxis: { labels: { formatter: (val) => "₹ " + Number(val).toLocaleString() } },
        tooltip: _vdMakeDateTooltip(datCumul.chartDates, datCumul.cumulativeData, 'Cumulative P/L')
    };
    vdCharts.cumulative = new ApexCharts(document.querySelector("#chart-cumulative"), optionsCumulative);
    vdCharts.cumulative.render();

    // 2. Daily Net P/L (Bar Chart)
    if (vdCharts.daily) vdCharts.daily.destroy();
    const datDaily = getDat('daily');
    const optionsDaily = {
        ...commonOptions,
        series: [{ name: 'Net P/L', data: datDaily.dailyPlData.length ? datDaily.dailyPlData : [0] }],
        chart: {
            ...commonOptions.chart, type: 'bar', height: 250,
            events: {
                dataPointSelection: function(event, chartContext, config) {
                    const rawDate = datDaily.rawDates[config.dataPointIndex];
                    if (!rawDate) return;
                    const allTrades = (typeof state !== 'undefined' && state.trades) ? state.trades : [];
                    const dayTrades = allTrades.filter(t => {
                        const td = typeof normalizeDate === 'function' ? normalizeDate(typeof extractDateFromTrade === 'function' ? extractDateFromTrade(t) : t.Date) : t.Date;
                        return td === rawDate;
                    });
                    // Show drilldown panel
                    renderVdDrilldown(rawDate, dayTrades);
                    // Also open gallery if images exist
                    const hasImg = dayTrades.some(t => t.images && t.images.length > 0);
                    if (hasImg && typeof openGalleryForDate === 'function') openGalleryForDate(rawDate);
                }
            }
        },
        plotOptions: {
            bar: {
                colors: {
                    ranges: [
                        { from: -10000000, to: -0.01, color: '#f85149' },
                        { from: 0, to: 10000000, color: '#3fb950' }
                    ]
                },
                columnWidth: datDaily.chartDates.length > 20 ? '80%' : '60%',
                borderRadius: 2
            }
        },
        dataLabels: { enabled: false },
        xaxis: { categories: datDaily.chartDates.length ? datDaily.chartDates : ['No Data'] },
        yaxis: { labels: { formatter: (val) => "₹ " + Number(val).toLocaleString() } },
        tooltip: _vdMakeDateTooltip(datDaily.chartDates, datDaily.dailyPlData, 'Net P/L'),
        states: { active: { filter: { type: 'none' } } }
    };
    vdCharts.daily = new ApexCharts(document.querySelector("#chart-daily-pl"), optionsDaily);
    vdCharts.daily.render();

    // 3. Strategy Distribution (Donut Chart)
    if (vdCharts.dist) vdCharts.dist.destroy();

    let distLabels = Array.from(strategyCountMap.keys());
    let distData = Array.from(strategyCountMap.values());
    if (distData.length === 0) {
        distLabels = ['No Data'];
        distData = [1];
    }

    const optionsDist = {
        ...commonOptions,
        series: distData,
        labels: distLabels,
        chart: { ...commonOptions.chart, type: 'donut', height: 280 },
        colors: ['#58a6ff', '#bc8cff', '#00e396', '#d29922', '#f85149', '#0d1117'],
        stroke: { colors: ['#161b22'], width: 1 },
        plotOptions: { pie: { donut: { size: '65%' } } },
        dataLabels: { enabled: false },
        legend: { position: 'bottom' }
    };
    vdCharts.dist = new ApexCharts(document.querySelector("#chart-strategy-dist"), optionsDist);
    vdCharts.dist.render();

    // 4. Strategy Profitability (Bar Chart)
    if (vdCharts.profit) vdCharts.profit.destroy();

    // Sort strategies by profitability
    const sortedStrats = Array.from(strategyPnlMap.entries()).sort((a, b) => b[1] - a[1]);
    let profitLabels = sortedStrats.map(e => e[0]);
    let profitData = sortedStrats.map(e => Math.round(e[1]));

    if (profitData.length === 0) {
        profitLabels = ['No Data'];
        profitData = [0];
    }

    const optionsProfit = {
        ...commonOptions,
        series: [{ name: 'Net P/L (₹)', data: profitData }],
        chart: { ...commonOptions.chart, type: 'bar', height: 280 },
        plotOptions: {
            bar: {
                horizontal: true,
                barHeight: '50%',
                borderRadius: 4,
                colors: {
                    ranges: [
                        { from: -10000000, to: -0.01, color: '#f85149' },
                        { from: 0, to: 10000000, color: '#3fb950' }
                    ]
                }
            }
        },
        dataLabels: { enabled: false },
        xaxis: {
            categories: profitLabels,
            labels: { formatter: (val) => "₹ " + Number(val).toLocaleString() }
        },
        yaxis: { labels: { style: { fontWeight: 600 } } }
    };
    vdCharts.profit = new ApexCharts(document.querySelector("#chart-strategy-profit"), optionsProfit);
    vdCharts.profit.render();

    // 5. Long vs Short Performance (Donut Chart)
    if (vdCharts.longShort) vdCharts.longShort.destroy();

    let lsLabels = ['Long (Buying)', 'Short (Selling)'];
    let lsData = [longCount, shortCount];
    if (longCount === 0 && shortCount === 0) {
        lsLabels = ['No Data'];
        lsData = [1];
    }

    const optionsLongShort = {
        ...commonOptions,
        series: lsData,
        labels: lsLabels,
        chart: { ...commonOptions.chart, type: 'donut', height: 250 },
        colors: ['#3fb950', '#f85149', '#30363d'],
        stroke: { colors: ['#161b22'], width: 1 },
        plotOptions: { pie: { donut: { size: '65%' } } },
        dataLabels: { enabled: false },
        tooltip: {
            y: {
                formatter: function (value, { series, seriesIndex, dataPointIndex, w }) {
                    if (w.globals.labels[seriesIndex] === 'Long (Buying)') {
                        return `${value} trades (P/L: ₹${longPnl.toFixed(2)})`;
                    } else if (w.globals.labels[seriesIndex] === 'Short (Selling)') {
                        return `${value} trades (P/L: ₹${shortPnl.toFixed(2)})`;
                    }
                    return value;
                }
            }
        },
        legend: { position: 'bottom' }
    };
    vdCharts.longShort = new ApexCharts(document.querySelector("#chart-long-short"), optionsLongShort);
    vdCharts.longShort.render();

    // 6. Daily Trade Count & Qty
    if (vdCharts.dailyQty) vdCharts.dailyQty.destroy();
    const datQty = getDat('daily_qty');
    vdCharts.dailyQty = new ApexCharts(document.querySelector("#chart-daily-qty"), {
        ...commonOptions,
        series: [
            { name: 'Trade Count', type: 'column', data: datQty.dailyTradeCountData.length ? datQty.dailyTradeCountData : [0] },
            { name: 'Quantity sum', type: 'line', data: datQty.dailyQtyData.length ? datQty.dailyQtyData : [0] }
        ],
        chart: { ...commonOptions.chart, height: 250 },
        stroke: { width: [0, 3], curve: 'smooth' },
        colors: ['#58a6ff', '#f85149'],
        xaxis: { categories: datQty.chartDates.length ? datQty.chartDates : ['No Data'] },
        yaxis: [
            { title: { text: 'Count' }, labels: { formatter: (val) => Math.floor(val) } },
            { opposite: true, title: { text: 'Quantity' }, labels: { formatter: (val) => Number(val).toLocaleString() } }
        ],
        tooltip: {
            custom: function({ dataPointIndex }) {
                const raw = datQty.chartDates[dataPointIndex];
                const dateLbl = Array.isArray(raw) ? raw.join(', ') : (vdFmtDateLabel(raw) || raw);
                const count = datQty.dailyTradeCountData[dataPointIndex] || 0;
                const qty = datQty.dailyQtyData[dataPointIndex] || 0;
                return `<div style="padding:8px 10px;background:var(--surface);border:1px solid var(--border);border-radius:6px;font-size:12px;line-height:1.8;">`
                    + `<div><strong>Date:</strong> ${dateLbl}</div>`
                    + `<div><strong>Trades:</strong> ${count}</div>`
                    + `<div><strong>Lot:</strong> ${qty}</div></div>`;
            }
        }
    });
    vdCharts.dailyQty.render();

    // 7. PAT (SUM) -> Area chart of Net PL but non-cumulative (daily sum)
    if (vdCharts.patSum) vdCharts.patSum.destroy();
    const datPat = getDat('pat_sum');
    vdCharts.patSum = new ApexCharts(document.querySelector("#chart-pat-sum"), {
        ...commonOptions,
        series: [{ name: 'PAT Sum (₹)', data: datPat.dailyPlData.length ? datPat.dailyPlData : [0] }],
        chart: { ...commonOptions.chart, type: 'area', height: 250 },
        colors: ['#d29922'],
        fill: {
            type: 'gradient',
            gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] }
        },
        dataLabels: {
            enabled: true,
            formatter: (val) => Math.round(val).toLocaleString('en-IN'),
            style: { fontSize: '10px', colors: ['#d29922'] },
            background: { enabled: true, foreColor: '#fff', borderRadius: 3, borderWidth: 0, opacity: 0.6 }
        },
        stroke: { curve: 'smooth', width: 2 },
        xaxis: { categories: datPat.chartDates.length ? datPat.chartDates : ['No Data'] },
        yaxis: { labels: { formatter: (val) => "₹ " + Number(val).toLocaleString() } },
        tooltip: _vdMakeDateTooltip(datPat.chartDates, datPat.dailyPlData, 'PAT Sum')
    });
    vdCharts.patSum.render();

    // 8. Points - Per Trade
    // Store full unfiltered data for month tab availability
    window._vdPptAllData = pointsPerTradeData;

    // Apply month filter
    let pptFiltered = pointsPerTradeData;
    if (vdState.pptMonthFilter !== 'all') {
        pptFiltered = pptFiltered.filter(p => {
            if (!p.date || p.date === 'Unknown') return false;
            return (parseInt(p.date.split('-')[1], 10) - 1) === vdState.pptMonthFilter;
        });
    }
    // Apply hide-no-image filter
    if (vdState.pptHideNoImg) {
        pptFiltered = pptFiltered.filter(p => p.trade?.images?.length > 0);
    }

    // Render controls (month tabs + toggle button)
    _renderVdPptControls();

    if (vdCharts.pointsPerTrade) vdCharts.pointsPerTrade.destroy();
    vdCharts.pointsPerTrade = new ApexCharts(document.querySelector("#chart-points-per-trade"), {
        ...commonOptions,
        series: [{ name: 'Points', data: pptFiltered.length ? pptFiltered.map(p => p.y) : [0] }],
        chart: {
            ...commonOptions.chart, type: 'bar', height: 250,
            events: {
                dataPointSelection: function (event, chartContext, config) {
                    const data = pptFiltered[config.dataPointIndex];
                    if (!data || !data.trade) return;
                    if (typeof openTradeSidebar === 'function') {
                        openTradeSidebar(data.trade);
                    }
                }
            }
        },
        colors: [function({ value, dataPointIndex }) {
            const p = pptFiltered[dataPointIndex];
            const hasImg = p && p.trade && p.trade.images && p.trade.images.length > 0;
            if (value >= 0) return hasImg ? '#3fb950' : 'rgba(63,185,80,0.35)';
            return hasImg ? '#f85149' : 'rgba(248,81,73,0.35)';
        }],
        plotOptions: {
            bar: {
                cursor: 'pointer',
                borderRadius: 2
            }
        },
        xaxis: {
            categories: pptFiltered.length ? pptFiltered.map(p => p.x) : ['No Data'],
            labels: { show: false },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: { labels: { formatter: (val) => Number(val).toLocaleString() } },
        dataLabels: { enabled: false },
        tooltip: {
            theme: 'dark',
            custom: function ({ series, seriesIndex, dataPointIndex, w }) {
                const data = pptFiltered[dataPointIndex];
                if (!data) return '';
                const t = data.trade || {};
                const isLoss = data.amt < 0;
                const resultColor = isLoss ? '#f85149' : '#3fb950';
                const resultLabel = isLoss ? 'LOSS' : 'WIN';
                const datePart = (data.date || '').slice(5); // MM-DD
                const pt = data.y;
                const ptStr = (pt >= 0 ? '' : '') + Number(pt).toFixed(2);
                const ptColor = pt >= 0 ? '#3fb950' : '#f85149';
                const amtAbs = Math.abs(Math.round(data.amt)).toLocaleString('en-IN');
                const amtStr = (data.amt < 0 ? '-' : '') + '₹' + amtAbs;

                const instrument = t['Instrument'] || t['instrument'] || t['Symbol'] || t['symbol'] || '';
                const observation = t['Notes'] || t['notes'] || t['Observation'] || t['observation'] || t['label'] || '';

                // Tags
                let tagsHtml = '';
                if (typeof getTradeTagsForColumn === 'function' && typeof state !== 'undefined' && state.tagColumns && state.tagColumns.length > 0) {
                    const tags = state.tagColumns.flatMap(col => getTradeTagsForColumn(t, col));
                    if (tags.length) {
                        tagsHtml = `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:5px;">${
                            tags.map(tag => `<span style="background:rgba(99,102,241,.25);color:#a5b4fc;border:1px solid rgba(99,102,241,.4);border-radius:4px;padding:1px 6px;font-size:10px;">${tag}</span>`).join('')
                        }</div>`;
                    }
                }

                // Images: prefer trade.images; fallback → video player stamps matched by date + observation timestamp
                const images = Array.isArray(t.images) ? t.images.map(u => typeof resolveImageUrl === 'function' ? resolveImageUrl(u) : u).filter(Boolean) : [];
                let vpImgUrls = [];
                if (!images.length && window._vpImgCache && data.date && data.date !== 'Unknown') {
                    const dayStamps = window._vpImgCache[data.date] || [];
                    // Parse [MM:SS] or [H:MM:SS] timestamps from observation text
                    const tsMatches = observation.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g) || [];
                    const targetSecs = tsMatches.map(m => {
                        const parts = m.replace(/[\[\]]/g, '').split(':').map(Number);
                        return parts.length === 3 ? parts[0]*3600+parts[1]*60+parts[2] : parts[0]*60+parts[1];
                    });
                    if (targetSecs.length) {
                        // Match stamps within ±60s of any referenced timestamp
                        vpImgUrls = dayStamps
                            .filter(s => targetSecs.some(ts => Math.abs(s.from - ts) <= 60))
                            .map(s => `http://localhost:5001/screenshot/${s.imageId}`);
                    }
                    // If no timestamp in observation, show all image stamps for that date (max 3)
                    if (!vpImgUrls.length && dayStamps.length) {
                        vpImgUrls = dayStamps.slice(0, 3).map(s => `http://localhost:5001/screenshot/${s.imageId}`);
                    }
                }
                const allImgs = images.length ? images : vpImgUrls;
                let imgsHtml = '';
                if (allImgs.length) {
                    imgsHtml = `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px;">${
                        allImgs.map(url => `<img src="${url}" style="width:110px;height:70px;object-fit:cover;border-radius:4px;border:1px solid #30363d;">`).join('')
                    }</div>`;
                }

                const obsHtml = observation
                    ? `<div style="margin-top:5px;font-size:11px;color:#8b949e;line-height:1.5;max-width:220px;">${observation.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>`
                    : '';

                return `
                  <div style="padding:10px 12px;background:#161b22;border:1px solid #30363d;border-radius:8px;font-family:var(--font-mono,'JetBrains Mono',monospace);min-width:200px;max-width:260px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                      <span style="font-weight:700;font-size:12px;color:#e6edf3;">${data.x} · ${datePart}</span>
                      <span style="font-size:10px;font-weight:700;color:${resultColor};background:${resultColor}22;border:1px solid ${resultColor}55;border-radius:4px;padding:1px 6px;">${resultLabel}</span>
                    </div>
                    <div style="display:flex;gap:16px;margin-bottom:2px;">
                      <div><div style="font-size:9px;color:#8b949e;">POINTS</div><div style="font-size:13px;font-weight:700;color:${ptColor};">${ptStr}</div></div>
                      <div><div style="font-size:9px;color:#8b949e;">AMT</div><div style="font-size:13px;font-weight:700;color:${ptColor};">${amtStr}</div></div>
                    </div>
                    ${instrument ? `<div style="font-size:10px;color:#8b949e;margin-top:2px;">${instrument}</div>` : ''}
                    ${tagsHtml}
                    ${imgsHtml}
                    ${obsHtml}
                  </div>
                `;
            }
        }
    });
    vdCharts.pointsPerTrade.render();

    // 9. Points - Sum
    if (vdCharts.pointsSum) vdCharts.pointsSum.destroy();
    const datPoints = getDat('points_sum');
    let rPoints = 0;
    const pointsCumulData = datPoints.dailyPointsData.map(p => { rPoints += parseFloat(p); return Math.round(rPoints); });
    vdCharts.pointsSum = new ApexCharts(document.querySelector("#chart-points-sum"), {
        ...commonOptions,
        series: [{ name: 'Cumulative Points Sum', data: pointsCumulData.length ? pointsCumulData : [0] }],
        chart: { ...commonOptions.chart, type: 'area', height: 250 },
        stroke: { width: 2, curve: 'smooth' },
        colors: ['#bc8cff'],
        fill: {
            type: 'gradient',
            gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] }
        },
        xaxis: { categories: datPoints.chartDates.length ? datPoints.chartDates : ['No Data'] },
        yaxis: { labels: { formatter: (val) => Number(val).toLocaleString() } }
    });
    vdCharts.pointsSum.render();

    // 10. Daily FC
    if (vdCharts.dailyFc) vdCharts.dailyFc.destroy();
    const datFc = getDat('daily_fc');
    vdCharts.dailyFc = new ApexCharts(document.querySelector("#chart-daily-fc"), {
        ...commonOptions,
        series: [{ name: 'Daily FC', data: datFc.dailyFcData.length ? datFc.dailyFcData : [0] }],
        chart: { ...commonOptions.chart, type: 'bar', height: 250 },
        colors: ['#8b949e'],
        xaxis: { categories: datFc.chartDates.length ? datFc.chartDates : ['No Data'] },
        yaxis: { labels: { formatter: (val) => Math.floor(val) } }
    });
    vdCharts.dailyFc.render();

    // 11. Avg Buy Price
    if (vdCharts.avgBuyPrice) vdCharts.avgBuyPrice.destroy();
    const datBuy = getDat('avg_buy_price');
    vdCharts.avgBuyPrice = new ApexCharts(document.querySelector("#chart-avg-buy-price"), {
        ...commonOptions,
        series: [{ name: 'Avg Buy Price', data: datBuy.avgBuyPriceData.length ? datBuy.avgBuyPriceData : [0] }],
        chart: { ...commonOptions.chart, type: 'line', height: 250 },
        stroke: { width: 3, curve: 'smooth' },
        colors: ['#58a6ff'],
        xaxis: { categories: datBuy.chartDates.length ? datBuy.chartDates : ['No Data'] },
        yaxis: { labels: { formatter: (val) => "₹ " + Number(val).toLocaleString() } }
    });
    vdCharts.avgBuyPrice.render();

    applyVdStatVisibility();
    applyVdStatOrder();
    applyVdCardWidths(true);
    // Deferred re-apply in case ApexCharts async rendering resets card display
    setTimeout(() => applyVdStatVisibility(), 400);
}


```

## File: `static/js/visual-dashboard-init.js`
```js
/**
 * @fileoverview visual-dashboard-init.js
 * @description Dashboard initialization, event binding, and select sync helpers.
 *              Split from visual-dashboard.js — load AFTER visual-dashboard.js.
 * @exports initVisualDashboard, bindVdEvents, syncVdSelects, updateVdRangeLabel
 */

// Cache for video player stamp data (keyed by date "YYYY-MM-DD" → array of image stamps)
window._vpImgCache = null;

function _fetchVpImgData() {
    fetch('http://localhost:5001/api/data')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
            if (!data || !data.dates) return;
            const cache = {};
            data.dates.forEach(d => {
                (d.videos || []).forEach(v => {
                    (v.stamps || []).filter(s => s.result === 'image' && s.imageId).forEach(s => {
                        const key = d.label; // "YYYY-MM-DD"
                        if (!cache[key]) cache[key] = [];
                        cache[key].push({ imageId: s.imageId, from: s.from, label: s.label || '' });
                    });
                });
            });
            window._vpImgCache = cache;
        })
        .catch(() => {}); // video player may not be running — silent fail
}

function initVisualDashboard() {
    _fetchVpImgData(); // pre-load video player screenshot data
    bindVdEvents();
    renderVisualDashboard();
}

function bindVdEvents() {
    const ms = document.getElementById('vd-month-select');
    const ys = document.getElementById('vd-year-select');
    const vs = document.getElementById('vd-view-select');
    const prevBtn = document.getElementById('vd-prev-month');
    const nextBtn = document.getElementById('vd-next-month');
    const todayBtn = document.getElementById('vd-today-btn');

    if (ms) {
        ms.addEventListener('change', e => {
            vdState.month = parseInt(e.target.value, 10);
            renderVisualDashboard();
        });
    }
    if (ys) {
        ys.addEventListener('change', e => {
            vdState.year = parseInt(e.target.value, 10);
            renderVisualDashboard();
        });
    }
    if (vs) {
        vs.addEventListener('change', e => {
            vdState.view = e.target.value;
            renderVisualDashboard();
        });
    }
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (vdState.view === 'year') {
                vdState.year--;
            } else {
                if (vdState.month === 0) { vdState.month = 11; vdState.year--; }
                else { vdState.month--; }
            }
            syncVdSelects();
            renderVisualDashboard();
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (vdState.view === 'year') {
                vdState.year++;
            } else {
                if (vdState.month === 11) { vdState.month = 0; vdState.year++; }
                else { vdState.month++; }
            }
            syncVdSelects();
            renderVisualDashboard();
        });
    }
    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            const d = new Date();
            vdState.month = d.getMonth();
            vdState.year = d.getFullYear();
            vdState.view = 'month';
            syncVdSelects();
            renderVisualDashboard();
        });
    }
}

function syncVdSelects() {
    const ms = document.getElementById('vd-month-select');
    const ys = document.getElementById('vd-year-select');
    const vs = document.getElementById('vd-view-select');
    if (ms) ms.value = vdState.month;
    if (ys) ys.value = vdState.year;
    if (vs) vs.value = vdState.view;
}

function updateVdRangeLabel() {
    const label = document.getElementById('vd-range-label');
    if (!label) return;
    const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (vdState.view === 'year') {
        label.textContent = `From Jan ${vdState.year} to Dec ${vdState.year}`;
    } else {
        const mm = String(vdState.month + 1).padStart(2, '0');
        const lastDay = new Date(vdState.year, vdState.month + 1, 0).getDate();
        label.textContent = `${vdState.year}-${mm}-01 to ${vdState.year}-${mm}-${String(lastDay).padStart(2, '0')}`;
    }
}

```

## File: `static/js/visual-dashboard-mtm.js`
```js
/**
 * @fileoverview visual-dashboard-mtm.js
 * @description MTM thumb grid, mini SVG chart renderer, PPT controls, month filters.
 *              Split from visual-dashboard.js — load AFTER visual-dashboard.js.
 * @exports setVdMtmSummaryType, renderVdMtmThumbs, renderVdMiniMtmChart,
 *          setVdPptMonthFilter, toggleVdPptHideNoImg, setVdMtmMonthFilter
 */

function setVdMtmSummaryType(type) {
    vdState.mtmSummaryType = type;
    renderVdMtmThumbs(getVdTrades());
}

function _vdDayDuration(trades) {
    if (typeof parseTimeToMinutes !== 'function') return '';
    let minT = Infinity, maxT = -Infinity;
    trades.forEach(t => {
        const times = [
            t['Buy Time'] || t['buy_time'] || t['buyTime'] || t['Time'] || t['Entry Time'] || t['entry_time'] || t['entryTime'],
            t['Sell Time'] || t['sell_time'] || t['sellTime'] || t['Ex Time'] || t['Exit Time'] || t['exit_time'] || t['exitTime']
        ];
        times.forEach(ts => {
            const m = parseTimeToMinutes(ts);
            if (m !== null) { if (m < minT) minT = m; if (m > maxT) maxT = m; }
        });
    });
    if (!isFinite(minT) || !isFinite(maxT) || maxT <= minT) return '';
    const diff = maxT - minT;
    const h = Math.floor(diff / 60), m = diff % 60;
    const dur = h > 0 ? `${h}h ${m}m` : `${m}m`;
    return ` · ${dur}`;
}

// ── DAILY MTM THUMBS (GRID OF MINI SVG CHARTS) ───────────────────────────
function renderVdMtmThumbs(allFilteredTrades) {
    const grid = document.getElementById('vd-mtm-thumbs-grid');
    if (!grid) return;

    // Group all available trades by month for the year (to show available months)
    const yearTrades = typeof state !== 'undefined' && Array.isArray(state.trades)
        ? state.trades.filter(t => {
            const d = normalizeDate(extractDateFromTrade(t));
            if (!d) return false;
            return parseInt(d.split('-')[0], 10) === vdState.year;
        })
        : [];

    const monthDataMap = new Map();
    yearTrades.forEach(t => {
        const d = normalizeDate(extractDateFromTrade(t));
        const m = parseInt(d.split('-')[1], 10) - 1;
        if (!monthDataMap.has(m)) monthDataMap.set(m, []);
        monthDataMap.get(m).push(t);
    });

    // Render Tabs
    let tabsHtml = `<div class="vd-month-tabs-container">`;
    tabsHtml += `<div class="vd-month-tab ${vdState.mtmMonthFilter === 'all' ? 'active' : ''}" onclick="setVdMtmMonthFilter('all')">ALL</div>`;

    const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    MONTHS_SHORT.forEach((mName, idx) => {
        const hasData = monthDataMap.has(idx);
        const isActive = vdState.mtmMonthFilter === idx;
        tabsHtml += `<div class="vd-month-tab ${isActive ? 'active' : ''} ${hasData ? 'has-data' : 'no-data'}"
                          onclick="${hasData ? `setVdMtmMonthFilter(${idx})` : ''}">${mName}</div>`;
    });
    tabsHtml += `</div>`;

    let tabsCont = document.getElementById('vd-mtm-tabs');
    if (!tabsCont) {
        tabsCont = document.createElement('div');
        tabsCont.id = 'vd-mtm-tabs';
        grid.parentNode.insertBefore(tabsCont, grid);
    }
    tabsCont.innerHTML = tabsHtml;

    let displayTrades = allFilteredTrades;
    if (vdState.mtmMonthFilter !== 'all') {
        displayTrades = allFilteredTrades.filter(t => {
            const d = normalizeDate(extractDateFromTrade(t));
            return d && (parseInt(d.split('-')[1], 10) - 1) === vdState.mtmMonthFilter;
        });
        if (vdState.view === 'year') {
             displayTrades = yearTrades.filter(t => {
                const d = normalizeDate(extractDateFromTrade(t));
                return d && (parseInt(d.split('-')[1], 10) - 1) === vdState.mtmMonthFilter;
            });
        }
    }

    grid.innerHTML = '';

    if (!displayTrades || displayTrades.length === 0) {
        grid.innerHTML = '<div style="color:var(--text3); font-size:12px; padding:10px;">No trades for this period</div>';
        return;
    }

    const dateMap = new Map();
    displayTrades.forEach(t => {
        const d = normalizeDate(extractDateFromTrade(t));
        if (d) {
            if (!dateMap.has(d)) dateMap.set(d, []);
            dateMap.get(d).push(t);
        }
    });

    const dates = Array.from(dateMap.keys()).sort();

    dates.forEach(date => {
        const dateTrades = dateMap.get(date);
        const thumbWrap = document.createElement('div');
        thumbWrap.classList.add('vd-mini-mtm-thumb');
        thumbWrap.style.cssText = `
            background: rgba(0,0,0,0.25);
            border: 1px solid var(--border2, #30363d);
            border-radius: 8px;
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 5px;
            cursor: pointer;
            position: relative;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        `;

        let totalVol = 0;
        dateTrades.forEach(t => totalVol += getVdTradeValue(t));
        const color = totalVol >= 0 ? '#3fb950' : '#f85149';

        const dobj = new Date(date + 'T00:00:00');
        const dateStr = !isNaN(dobj) ? `${dobj.toLocaleString('default', { month: 'short' })} ${dobj.getDate()}` : date;
        const prefix = vdState.mtmValueType === 'pt' ? '' : '₹';
        const formattedVal = Math.abs(Math.round(totalVol)).toLocaleString('en-IN');
        const displayVal = `${totalVol < 0 ? '-' : ''}${prefix}${formattedVal}`;

        thumbWrap.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-size:10px; font-weight:700;">
                <span style="color:var(--text3);">${dateStr}</span>
                <span class="mini-pnl-val" data-orig="${displayVal}" style="color:${color};">${displayVal}</span>
            </div>
            <div class="mini-mtm-svg-container" style="width:100%; height:80px; position:relative; overflow:hidden;"></div>
            <div class="mini-mtm-info" style="font-size:8px; color:var(--text3); opacity:0.6; margin-top:-2px;">${dateTrades.length} Trades</div>
        `;

        thumbWrap.addEventListener('mouseenter', () => {
            thumbWrap.style.transform = 'translateY(-3px)';
            thumbWrap.style.background = 'rgba(255,255,255,0.06)';
            thumbWrap.style.borderColor = 'var(--blue, #58a6ff)';
            thumbWrap.style.boxShadow = '0 4px 15px rgba(0,0,0,0.4)';
        });
        thumbWrap.addEventListener('mouseleave', () => {
            thumbWrap.style.transform = 'translateY(0)';
            thumbWrap.style.background = 'rgba(0,0,0,0.25)';
            thumbWrap.style.borderColor = 'var(--border2, #30363d)';
            thumbWrap.style.boxShadow = 'none';
        });

        const _hasImages = dateTrades.some(t => t.images && t.images.length > 0);
        if (_hasImages) {
            thumbWrap.style.cursor = 'pointer';
        } else {
            thumbWrap.style.cursor = 'default';
            thumbWrap.title = 'No images for this day';
        }
        thumbWrap.onclick = () => {
            if (!_hasImages) return;
            if (typeof openGalleryForDate === 'function') openGalleryForDate(date);
        };

        grid.appendChild(thumbWrap);

        const container = thumbWrap.querySelector('.mini-mtm-svg-container');
        renderVdMiniMtmChart(container, dateTrades, color, date, vdState.mtmSummaryType || 'curve');
    });
}

function renderVdMiniMtmChart(container, trades, color, date, chartType = 'curve') {
    if (!container) return;
    const w = container.clientWidth || 130;
    const h = 80;
    const pad = 10;
    const gradId = 'mini-grad-' + Math.random().toString(36).substr(2, 9);

    if (chartType === 'bar') {
        const barVals = trades.map(t => getVdTradeValue(t));
        const absMax = Math.max(...barVals.map(v => Math.abs(v)), 1);
        const zeroY = h / 2;
        const bw = Math.max(2, (w / (trades.length || 1)) * 0.7);
        const gap = w / (trades.length || 1);
        let barsHtml = '';
        barVals.forEach((v, i) => {
            const bColor = v >= 0 ? '#3fb950' : '#f85149';
            const barH = Math.max(2, (Math.abs(v) / absMax) * (h / 2 - pad));
            const bx = gap * i + (gap - bw) / 2;
            const by = v >= 0 ? zeroY - barH : zeroY;
            barsHtml += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${barH.toFixed(1)}" fill="${bColor}" rx="1"/>`;
        });
        container.innerHTML = `
            <svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="display:block;">
                <line x1="0" y1="${zeroY}" x2="${w}" y2="${zeroY}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
                ${barsHtml}
                <line id="mini-track-line" x1="0" y1="0" x2="0" y2="${h}" stroke="rgba(255,255,255,0.3)" stroke-width="1" style="display:none;"/>
            </svg>`;

        const thumbWrap = container.closest('.vd-mini-mtm-thumb');
        const pnlVal = thumbWrap?.querySelector('.mini-pnl-val');
        const trackLine = container.querySelector('#mini-track-line');
        container.onmousemove = (e) => {
            const rect = container.getBoundingClientRect();
            const mx = (e.clientX - rect.left) * (w / rect.width);
            const idx = Math.min(trades.length - 1, Math.max(0, Math.floor(mx / gap)));
            if (trackLine) { trackLine.setAttribute('x1', (gap * idx + gap / 2).toFixed(1)); trackLine.setAttribute('x2', (gap * idx + gap / 2).toFixed(1)); trackLine.style.display = ''; }
            if (pnlVal) { const v = barVals[idx]; pnlVal.textContent = `₹${Math.round(v).toLocaleString('en-IN')}`; pnlVal.style.color = v >= 0 ? '#3fb950' : '#f85149'; }
        };
        container.onmouseleave = () => {
            if (trackLine) trackLine.style.display = 'none';
            if (pnlVal) { pnlVal.textContent = pnlVal.dataset.orig; pnlVal.style.color = color; }
        };
        return;
    }

    // Curve mode
    let run = 0;
    const trajData = [{ val: 0, inst: 'Start', trade: null }];
    trades.forEach(t => {
        run += getVdTradeValue(t);
        trajData.push({ val: run, inst: t.Symbol || t.Instrument || '', trade: t });
    });

    const trajArr = trajData.map(d => d.val);
    const min = Math.min(...trajArr);
    const max = Math.max(...trajArr);
    const range = (max - min) || 1;

    const pts = trajData.map((d, i) => {
        const x = (i / (trajData.length - 1)) * w;
        const y = h - pad - ((d.val - min) / range) * (h - (pad * 2));
        return { x, y, ...d };
    });

    const pathData = pts.map((p, i) => (i === 0 ? 'M' : 'L') + `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const zeroY = h - pad - ((0 - min) / range) * (h - (pad * 2));

    container.innerHTML = `
        <svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="display:block;">
            <defs>
                <linearGradient id="${gradId}" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:${color}; stop-opacity:0.2" />
                    <stop offset="100%" style="stop-color:${color}; stop-opacity:0" />
                </linearGradient>
                <filter id="mini-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="1" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
            </defs>
            <line x1="0" y1="${zeroY}" x2="${w}" y2="${zeroY}" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
            <path d="${pathData} L${w},${h} L0,${h} Z" fill="url(#${gradId})" />
            <path d="${pathData}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#mini-glow)" />
            <line id="mini-track-line" x1="0" y1="0" x2="0" y2="${h}" stroke="rgba(255,255,255,0.3)" stroke-width="1" style="display:none;" />
            <circle id="mini-track-dot" r="3" fill="#fff" stroke="${color}" stroke-width="1.5" style="display:none;" />
        </svg>
    `;

    const thumbWrap = container.closest('.vd-mini-mtm-thumb');
    const trackLine = container.querySelector('#mini-track-line');
    const trackDot = container.querySelector('#mini-track-dot');
    const pnlVal = thumbWrap.querySelector('.mini-pnl-val');

    container.onmousemove = (e) => {
        const rect = container.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const sx = mx * (w / rect.width);
        let closest = pts[0];
        let minDist = Math.abs(sx - pts[0].x);
        for(let i=1; i < pts.length; i++) {
            const d = Math.abs(sx - pts[i].x);
            if (d < minDist) { minDist = d; closest = pts[i]; }
        }
        if (trackLine && trackDot) {
            trackLine.setAttribute('x1', closest.x); trackLine.setAttribute('x2', closest.x); trackLine.style.display = 'block';
            trackDot.setAttribute('cx', closest.x); trackDot.setAttribute('cy', closest.y); trackDot.style.display = 'block';
        }
        if (pnlVal) {
            const val = Math.round(closest.val);
            const prefix = vdState.mtmValueType === 'pt' ? '' : '₹';
            pnlVal.textContent = (val < 0 ? '-' : '') + prefix + Math.abs(val).toLocaleString('en-IN');
            pnlVal.style.color = val >= 0 ? '#3fb950' : '#f85149';
        }
    };

    container.onclick = (e) => {
        e.stopPropagation();
        const rect = container.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const sx = mx * (w / rect.width);
        let closest = pts[0];
        let minDist = Math.abs(sx - pts[0].x);
        for(let i=1; i < pts.length; i++) {
            const d = Math.abs(sx - pts[i].x);
            if (d < minDist) { minDist = d; closest = pts[i]; }
        }
        if (closest && closest.trade) {
            if (typeof openTradeSidebar === 'function') openTradeSidebar(closest.trade);
        } else {
            if (typeof openGalleryForDate === 'function') openGalleryForDate(date);
        }
    };

    container.onmouseleave = () => {
        if (trackLine) trackLine.style.display = 'none';
        if (trackDot) trackDot.style.display = 'none';
        if (pnlVal) {
            pnlVal.textContent = pnlVal.dataset.orig;
            const isNeg = pnlVal.textContent.startsWith('-');
            pnlVal.style.color = isNeg ? '#f85149' : '#3fb950';
        }
    };
}

function setVdPptMonthFilter(m) {
    vdState.pptMonthFilter = m;
    _renderVdPptControls();
    _applyVdPptFiltersAndRender();
}

function toggleVdPptHideNoImg() {
    vdState.pptHideNoImg = !vdState.pptHideNoImg;
    _renderVdPptControls();
    _applyVdPptFiltersAndRender();
}

function _applyVdPptFiltersAndRender() {
    if (typeof renderVisualDashboard === 'function') renderVisualDashboard();
}

function _renderVdPptControls() {
    const chartDiv = document.getElementById('chart-points-per-trade');
    if (!chartDiv) return;
    const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    let cont = document.getElementById('vd-ppt-controls');
    if (!cont) {
        cont = document.createElement('div');
        cont.id = 'vd-ppt-controls';
        chartDiv.parentNode.insertBefore(cont, chartDiv);
    }

    const availableMonths = new Set();
    if (window._vdPptAllData) {
        window._vdPptAllData.forEach(p => {
            if (p.date && p.date !== 'Unknown') {
                const m = parseInt(p.date.split('-')[1], 10) - 1;
                availableMonths.add(m);
            }
        });
    }

    let html = `<div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:8px;">`;
    html += `<div class="vd-month-tab ${vdState.pptMonthFilter === 'all' ? 'active' : ''}" onclick="setVdPptMonthFilter('all')" style="font-size:11px;padding:2px 7px;">ALL</div>`;
    MONTHS_SHORT.forEach((mName, idx) => {
        const hasData = availableMonths.has(idx);
        const isActive = vdState.pptMonthFilter === idx;
        html += `<div class="vd-month-tab ${isActive ? 'active' : ''} ${hasData ? 'has-data' : 'no-data'}"
            onclick="${hasData ? `setVdPptMonthFilter(${idx})` : ''}"
            style="font-size:11px;padding:2px 7px;">${mName}</div>`;
    });
    const btnStyle = vdState.pptHideNoImg
        ? 'background:var(--accent);color:#fff;border-color:var(--accent);'
        : 'background:transparent;color:var(--text2);';
    html += `<button onclick="toggleVdPptHideNoImg()" title="Hide trades with no image"
        style="margin-left:auto;font-size:11px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;cursor:pointer;${btnStyle}">
        No-Img Hide</button>`;
    html += `</div>`;
    cont.innerHTML = html;
}

function setVdMtmMonthFilter(m) {
    vdState.mtmMonthFilter = m;
    if (m !== 'all') {
        vdState.month = m;
        vdState.view = 'month';
        syncVdSelects();
        renderVisualDashboard();
    } else {
        vdState.view = 'year';
        syncVdSelects();
        renderVisualDashboard();
    }
}

// ── DAILY DRILLDOWN PANEL ─────────────────────────────────────────────────
let _vdDdState = { date: null, trades: [], mode: 'rs', chart: null };

function setVdDrilldownMode(mode) {
    _vdDdState.mode = mode;
    const rsBtn = document.getElementById('vd-dd-rs-btn');
    const ptBtn = document.getElementById('vd-dd-pt-btn');
    if (rsBtn) rsBtn.classList.toggle('active', mode === 'rs');
    if (ptBtn) ptBtn.classList.toggle('active', mode === 'pt');
    _renderVdDdContent();
}

function renderVdDrilldown(date, trades) {
    _vdDdState.date = date;
    _vdDdState.trades = trades;

    const panel = document.getElementById('vd-daily-drilldown');
    if (!panel) return;

    const lbl = document.getElementById('vd-dd-date-label');
    if (lbl) {
        const dobj = new Date(date + 'T00:00:00');
        lbl.textContent = isNaN(dobj) ? date
            : dobj.toLocaleDateString('default', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    panel.style.display = 'block';
    _renderVdDdContent();
}

function _renderVdDdContent() {
    const { trades, mode } = _vdDdState;
    if (!trades || !trades.length) return;

    const getVal = (t) => {
        if (mode === 'pt') return parseFloat(t['Pt'] || t['Points'] || 0);
        return typeof getTradePnl === 'function' ? getTradePnl(t) : 0;
    };
    const fmt = (v) => mode === 'pt'
        ? v.toFixed(1) + ' pt'
        : '₹' + Math.round(v).toLocaleString('en-IN');

    // ── Donut chart ──
    const pieEl = document.getElementById('vd-dd-pie');
    if (pieEl) {
        if (_vdDdState.chart) { try { _vdDdState.chart.destroy(); } catch(e){} _vdDdState.chart = null; }
        pieEl.innerHTML = '';

        const labels = trades.map((t, i) => (t['Instrument'] || t['instrument'] || `T${i+1}`).slice(0, 12));
        const vals = trades.map(t => Math.abs(getVal(t)));
        const colors = trades.map(t => getVal(t) >= 0 ? '#3fb950' : '#f85149');

        if (vals.some(v => v > 0)) {
            _vdDdState.chart = new ApexCharts(pieEl, {
                chart: { type: 'donut', height: 200, background: 'transparent', toolbar: { show: false } },
                series: vals,
                labels,
                colors,
                legend: { show: false },
                dataLabels: { enabled: vals.length <= 5 },
                plotOptions: { pie: { donut: { size: '55%' } } },
                tooltip: {
                    theme: 'dark',
                    y: { formatter: (v, { seriesIndex }) => {
                        const raw = getVal(trades[seriesIndex]);
                        return (raw >= 0 ? '+' : '') + fmt(raw);
                    }}
                },
                theme: { mode: 'dark' }
            });
            _vdDdState.chart.render();
        }
    }

    // ── Breakdown table ──
    const tblEl = document.getElementById('vd-dd-table');
    if (!tblEl) return;

    const totalVal = trades.reduce((s, t) => s + getVal(t), 0);
    const totalCls = totalVal >= 0 ? 'pnl-win' : 'pnl-loss';
    const colHeader = mode === 'pt' ? 'Pts' : 'P&amp;L';

    const rows = trades.map(t => {
        const val = getVal(t);
        const cls = val >= 0 ? 'pnl-win' : 'pnl-loss';
        const inst = (t['Instrument'] || t['instrument'] || '—').slice(0, 16);
        const side = t['Side'] || t['Type'] || t['type'] || '—';
        const entry = t['Entry'] || t['Buy Price'] || t['Avg Buy'] || '—';
        const exit  = t['Exit']  || t['Sell Price'] || t['Avg Sell'] || '—';
        const qty   = t['Qty']   || t['quantity'] || '—';
        const pt    = parseFloat(t['Pt'] || t['Points'] || 0).toFixed(1);
        return `<tr><td>${inst}</td><td>${side}</td><td>${entry}</td><td>${exit}</td><td>${qty}</td><td>${pt}</td><td class="${cls}">${fmt(val)}</td></tr>`;
    }).join('');

    tblEl.innerHTML = `<table>
        <thead><tr><th>Instrument</th><th>Side</th><th>Entry</th><th>Exit</th><th>Qty</th><th>Pt</th><th>${colHeader}</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="border-top:1px solid rgba(255,255,255,0.1);">
            <td colspan="6" style="color:#8b949e;font-size:0.75rem;">${trades.length} trade${trades.length !== 1 ? 's' : ''}</td>
            <td class="${totalCls}">${fmt(totalVal)}</td>
        </tr></tfoot>
    </table>`;
}

```

## File: `static/js/visual-dashboard-stats.js`
```js
/**
 * @fileoverview visual-dashboard-stats.js
 * @description VD Stats cards drag/drop, stats menu, chart type & width controls.
 *              Split from visual-dashboard.js — load BEFORE visual-dashboard.js.
 * @exports getTradePnl, VD_STATS, getVdStatsState, saveVdStatsState, getVdStatsOrder,
 *          saveVdStatsOrder, applyVdStatVisibility, applyVdStatOrder, bindVdDragDrop,
 *          renderVdStatsMenu, updateVdChartType, getVdCardWidths, saveVdCardWidths,
 *          updateVdChartWidth, applyVdCardWidths
 * @reads localStorage (vd_stats_state, vd_stats_order, vd_card_widths)
 * @writes localStorage
 */

function getTradePnl(t) {
    if (t['Net P/L']) return parseFloat(t['Net P/L']);
    if (t['Gross P/L']) return parseFloat(t['Gross P/L']);
    if (t['Profit']) return parseFloat(t['Profit']);
    if (t['profit']) return parseFloat(t['profit']);
    if (t['Rs']) return parseFloat(t['Rs']);
    return 0;
}

// ──────────────────────────────────────────────
// DRAG, DROP, AND STATS MENU LOGIC
// ──────────────────────────────────────────────
const VD_STATS = [
    { key: 'cumulative', label: 'Cumulative Performance' },
    { key: 'mtm_thumbs', label: 'Daily MTM Curves' },
    { key: 'daily', label: 'Daily Net P/L' },
    { key: 'distribution', label: 'Strategy Distribution' },
    { key: 'profitability', label: 'Strategy Profitability' },
    { key: 'long_short', label: 'Long vs Short Performance' },
    { key: 'daily_qty', label: 'Daily Trade Count & Qty' },
    { key: 'pat_sum', label: 'PAT (SUM)' },
    { key: 'points_per_trade', label: 'Points - Per Trade' },
    { key: 'points_sum', label: 'Points - Sum' },
    { key: 'daily_fc', label: 'Daily FC' },
    { key: 'avg_buy_price', label: 'Avg Buy Price' }
];

// ── uiSettings helpers ─────────────────────────────────────────────────────
// Reads a key from state.uiSettings (server-persisted), falling back to
// localStorage for backwards-compat on first load, then migrates to server.
function _vdUiGet(key, def) {
    if (typeof state !== 'undefined' && state.uiSettings && state.uiSettings[key] !== undefined)
        return state.uiSettings[key];
    // One-time migration: pull old value from localStorage if present
    try {
        const raw = localStorage.getItem(key);
        if (raw !== null) return JSON.parse(raw);
    } catch (e) { }
    return def;
}

function _vdUiSet(key, val) {
    if (typeof state === 'undefined') return;
    if (!state.uiSettings) state.uiSettings = {};
    state.uiSettings[key] = val;
    // Remove migrated localStorage key so we don't read stale data again
    try { localStorage.removeItem(key); } catch (e) { }
    if (typeof saveTrades === 'function') saveTrades();
}
// ─────────────────────────────────────────────────────────────────────────────

function getVdStatsState() {
    const saved = _vdUiGet('vdStats', null);
    if (saved && typeof saved === 'object') return saved;
    const all = {};
    VD_STATS.forEach(s => { all[s.key] = true; });
    return all;
}

function saveVdStatsState(stateMap) {
    _vdUiSet('vdStats', stateMap);
}

function getVdStatsOrder() {
    const arr = _vdUiGet('vdStatsOrder', null);
    if (Array.isArray(arr) && arr.length) {
        const valid = arr.filter(k => VD_STATS.some(s => s.key === k));
        const missing = VD_STATS.map(s => s.key).filter(k => !valid.includes(k));
        return [...valid, ...missing];
    }
    return VD_STATS.map(s => s.key);
}

function saveVdStatsOrder(order) {
    _vdUiSet('vdStatsOrder', order);
}

function applyVdStatVisibility() {
    const map = getVdStatsState();
    document.querySelectorAll('.visual-dash-grid .dash-card[data-vd-stat]').forEach(card => {
        const key = card.getAttribute('data-vd-stat');
        card.style.display = map[key] === false ? 'none' : '';
    });
}

function applyVdStatOrder() {
    const grid = document.getElementById('vd-charts-grid');
    if (!grid) return;
    const order = getVdStatsOrder();
    const cards = Array.from(grid.querySelectorAll('.dash-card[data-vd-stat]'));
    const byKey = new Map(cards.map(c => [c.getAttribute('data-vd-stat'), c]));
    order.forEach(k => {
        const el = byKey.get(k);
        if (el) grid.appendChild(el);
    });
    bindVdDragDrop();
}

function bindVdDragDrop() {
    const grid = document.getElementById('vd-charts-grid');
    if (!grid) return;
    let dragSrc = null;
    let dropTarget = null;
    let dropPos = null;

    const clearIndicators = () => {
        grid.querySelectorAll('.drop-before, .drop-after').forEach(c => c.classList.remove('drop-before', 'drop-after'));
    };

    grid.querySelectorAll('.dash-card[data-vd-stat]').forEach(card => {
        const handle = card.querySelector('.vd-drag-handle');
        if (handle) {
            handle.addEventListener('mousedown', () => card.setAttribute('draggable', 'true'));
            handle.addEventListener('mouseup', () => card.setAttribute('draggable', 'false'));
            handle.addEventListener('mouseleave', () => card.setAttribute('draggable', 'false'));
        }

        card.addEventListener('dragstart', e => {
            if (card.getAttribute('draggable') !== 'true') {
                e.preventDefault();
                return;
            }
            dragSrc = card;
            setTimeout(() => card.classList.add('dragging'), 0);
            e.dataTransfer.effectAllowed = 'move';
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            card.setAttribute('draggable', 'false');
            clearIndicators();
            if (dragSrc && dropTarget && dropTarget !== dragSrc) {
                if (dropPos === 'before') grid.insertBefore(dragSrc, dropTarget);
                else grid.insertBefore(dragSrc, dropTarget.nextSibling);
                const newOrder = Array.from(grid.querySelectorAll('.dash-card[data-vd-stat]'))
                    .map(c => c.getAttribute('data-vd-stat'));
                saveVdStatsOrder(newOrder);
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

let tempVdStatsMap = null;
let tempVdStatsOrder = null;

function renderVdStatsMenu() {
    const menu = document.getElementById('vd-stats-menu-container');
    if (!menu) return;
    menu.innerHTML = '';

    if (!tempVdStatsMap) tempVdStatsMap = getVdStatsState();
    if (!tempVdStatsOrder) tempVdStatsOrder = getVdStatsOrder();

    const map = tempVdStatsMap;

    const searchRow = document.createElement('div');
    searchRow.className = 'panel-search-row';
    searchRow.style.padding = '8px 10px 0';
    const searchInp = document.createElement('input');
    searchInp.className = 'panel-search';
    searchInp.placeholder = 'Search stats...';
    searchRow.appendChild(searchInp);
    menu.appendChild(searchRow);

    const actRow = document.createElement('div');
    actRow.className = 'panel-act-row';
    actRow.style.padding = '8px 10px 6px';
    const btnAll = document.createElement('button');
    btnAll.className = 'panel-act-btn';
    btnAll.textContent = 'All';
    const btnNone = document.createElement('button');
    btnNone.className = 'panel-act-btn';
    btnNone.textContent = 'None';
    btnAll.addEventListener('click', () => {
        VD_STATS.forEach(s => { map[s.key] = true; });
        renderVdStatsMenu();
    });
    btnNone.addEventListener('click', () => {
        VD_STATS.forEach(s => { map[s.key] = false; });
        renderVdStatsMenu();
    });
    actRow.appendChild(btnAll);
    actRow.appendChild(btnNone);
    menu.appendChild(actRow);

    const list = document.createElement('div');
    list.className = 'panel-list';
    list.style.padding = '0 10px 8px';
    menu.appendChild(list);

    const renderList = (q) => {
        list.innerHTML = '';
        const ql = (q || '').toLowerCase();
        const items = tempVdStatsOrder
            .map(k => VD_STATS.find(s => s.key === k))
            .filter(Boolean)
            .filter(s => !ql || s.label.toLowerCase().includes(ql));

        items.forEach(s => {
            const row = document.createElement('div');
            row.className = 'head-checkbox';
            row.setAttribute('draggable', 'true');
            row.dataset.stat = s.key;
            row.style.padding = '4px 0';
            row.style.cursor = 'grab';

            const handle = document.createElement('span');
            handle.textContent = '⋮⋮';
            handle.style.marginRight = '8px';
            handle.style.opacity = '0.6';
            handle.style.userSelect = 'none';

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = map[s.key] !== false;
            chk.addEventListener('change', () => {
                map[s.key] = chk.checked;
            });

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
            row.addEventListener('dragover', e => { e.preventDefault(); row.style.borderTop = '1px dashed var(--border2)'; });
            row.addEventListener('dragleave', () => { row.style.borderTop = ''; });
            row.addEventListener('drop', e => {
                e.preventDefault();
                row.style.borderTop = '';
                const from = e.dataTransfer.getData('text/plain');
                const to = s.key;
                if (!from || from === to) return;
                const newOrder = tempVdStatsOrder.filter(k => k !== from);
                const toIdx = newOrder.indexOf(to);
                newOrder.splice(toIdx, 0, from);
                tempVdStatsOrder = newOrder;
                renderList(searchInp.value);
            });

            list.appendChild(row);
        });
    };

    renderList('');
    searchInp.addEventListener('input', () => renderList(searchInp.value));
}

// Run on load but with a tiny delay to ensure global state exists
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => {
        initVisualDashboard();
        renderVdStatsMenu(); // render dropdown content
    }, 200);

    const statBtn = document.getElementById('vd-stats-btn');
    const modal = document.getElementById('vd-stats-modal');
    const closeBtn = document.getElementById('vd-stats-close-btn');
    const applyBtn = document.getElementById('vd-stats-apply-btn');

    if (statBtn && modal) {
        statBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            tempVdStatsMap = getVdStatsState();
            tempVdStatsOrder = getVdStatsOrder();
            renderVdStatsMenu();
            modal.style.display = 'flex';
        });
    }

    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    if (applyBtn && modal) {
        applyBtn.addEventListener('click', () => {
            saveVdStatsState(tempVdStatsMap);
            saveVdStatsOrder(tempVdStatsOrder);
            applyVdStatVisibility();
            applyVdStatOrder();
            applyVdCardWidths();
            modal.style.display = 'none';
        });
    }

    // Close on click outside modal content
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
});


function updateVdChartType(chartKey, newType) {
    if (vdCharts[chartKey]) {
        vdCharts[chartKey].updateOptions({
            chart: { type: newType }
        });
    }
}
window.updateVdChartType = updateVdChartType;


function getVdCardWidths() {
    return _vdUiGet('vdCardWidths', {});
}

function saveVdCardWidths(w) {
    _vdUiSet('vdCardWidths', w);
}

function updateVdChartWidth(chartKey, cols) {
    const widths = getVdCardWidths();
    widths[chartKey] = cols;
    saveVdCardWidths(widths);
    applyVdCardWidths();
    // Re-render chart to fit new width
    setTimeout(() => { if (vdCharts[chartKey]) vdCharts[chartKey].render(); }, 300);
}
window.updateVdChartWidth = updateVdChartWidth;

function applyVdCardWidths(triggerResize) {
    const widths = getVdCardWidths();
    document.querySelectorAll('.visual-dash-grid .dash-card[data-vd-stat]').forEach(card => {
        const key = card.getAttribute('data-vd-stat');
        const cols = widths[key] || card.getAttribute('data-vd-default-width') || 6;
        card.style.gridColumn = `span ${cols}`;

        // update select
        const sel = card.querySelector('.vd-width-select');
        if (sel) sel.value = cols;
    });
    // After initial render, charts need a resize signal to fill their new container width
    if (triggerResize) {
        setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
    }
}

```
