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
    chartModes: {}
};

function updateVdChartMode(chartKey, mode) {
    vdState.chartModes[chartKey] = mode;
    renderVisualDashboard();
}

let vdCharts = {};

function initVisualDashboard() {
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
        // Add padded dates
        const mm = String(vdState.month + 1).padStart(2, '0');
        const lastDay = new Date(vdState.year, vdState.month + 1, 0).getDate();
        label.textContent = `${vdState.year}-${mm}-01 to ${vdState.year}-${mm}-${String(lastDay).padStart(2, '0')}`;
    }
}

function getVdTrades() {
    // Use state.trades assuming it's loaded in app state (data.js/state.js)
    // Fall back to empty array if state doesn't exist yet
    const allTrades = typeof state !== 'undefined' && Array.isArray(state.trades) ? state.trades : [];
    return allTrades.filter(t => {
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

function vdMakeTooltip(label, value) {
    return `<div style="padding:8px 10px;background:var(--surface);border:1px solid var(--border);border-radius:6px;font-size:12px;">`
        + `<div><strong>${label}:</strong> ${value}</div></div>`;
}

function renderVisualDashboard() {
    updateVdRangeLabel();

    const trades = getVdTrades();
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
        const res = { dailyPlData: [], cumulativeData: [], dailyTradeCountData: [], dailyQtyData: [], dailyPointsData: [], dailyFcData: [], avgBuyPriceData: [], chartDates: [] };
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
        pointsPerTradeData.push({ x: `T${totalTradesCount}`, y: pt, date: d || 'Unknown', amt: pnl, lot });

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
        xaxis: { categories: datCumul.chartDates.length ? datCumul.chartDates : ['No Data'], tooltip: { enabled: false } },
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
        chart: { ...commonOptions.chart, type: 'bar', height: 250 },
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
        tooltip: _vdMakeDateTooltip(datDaily.chartDates, datDaily.dailyPlData, 'Net P/L')
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
    if (vdCharts.pointsPerTrade) vdCharts.pointsPerTrade.destroy();
    vdCharts.pointsPerTrade = new ApexCharts(document.querySelector("#chart-points-per-trade"), {
        ...commonOptions,
        series: [{ name: 'Points', data: pointsPerTradeData.map(p => p.y).length ? pointsPerTradeData.map(p => p.y) : [0] }],
        chart: { ...commonOptions.chart, type: 'bar', height: 250 },
        plotOptions: {
            bar: {
                colors: {
                    ranges: [
                        { from: -10000000, to: -0.01, color: '#f85149' },
                        { from: 0, to: 10000000, color: '#3fb950' }
                    ]
                }
            }
        },
        xaxis: { categories: pointsPerTradeData.map(p => p.x).length ? pointsPerTradeData.map(p => p.x) : ['No Data'], labels: { show: false } }, // hides large number of trade labels
        yaxis: { labels: { formatter: (val) => Number(val).toLocaleString() } },
        dataLabels: { enabled: false },
        tooltip: {
            theme: 'dark',
            custom: function ({ series, seriesIndex, dataPointIndex, w }) {
                const data = pointsPerTradeData[dataPointIndex];
                if (!data) return '';
                const dobj = data.date && data.date !== 'Unknown' ? new Date(data.date + 'T00:00:00') : null;
                const dateLbl = dobj && !isNaN(dobj)
                    ? `${dobj.toLocaleString('default', { month: 'short' })} ${dobj.getDate()}, ${dobj.toLocaleString('default', { weekday: 'short' })}`
                    : data.date;
                return `
                  <div style="padding:8px 10px;background:var(--surface);border:1px solid var(--border);border-radius:6px;font-size:12px;line-height:1.8;">
                    <div><strong>Date:</strong> ${dateLbl}</div>
                    <div><strong>Trade:</strong> ${data.x}</div>
                    <div><strong>PT:</strong> ${Math.round(data.y)}</div>
                    <div><strong>Amt:</strong> ₹${Math.round(data.amt).toLocaleString('en-IN')}</div>
                    <div><strong>Lot:</strong> ${data.lot}</div>
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
}

// ── DAILY MTM THUMBS (GRID OF MINI SVG CHARTS) ───────────────────────────
function renderVdMtmThumbs(trades) {
    const grid = document.getElementById('vd-mtm-thumbs-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!trades || trades.length === 0) {
        grid.innerHTML = '<div style="color:var(--text3); font-size:12px; padding:10px;">No trades to display</div>';
        return;
    }

    // Group by Date
    const dateMap = new Map();
    trades.forEach(t => {
        const d = normalizeDate(extractDateFromTrade(t));
        if (d) {
            if (!dateMap.has(d)) dateMap.set(d, []);
            dateMap.get(d).push(t);
        }
    });

    const dates = Array.from(dateMap.keys()).sort().reverse();

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
        
        let totalPnl = 0;
        dateTrades.forEach(t => totalPnl += (getTradePnl(t) || 0));
        const color = totalPnl >= 0 ? '#3fb950' : '#f85149';
        
        const dobj = new Date(date + 'T00:00:00');
        const dateStr = !isNaN(dobj) ? `${dobj.toLocaleString('default', { month: 'short' })} ${dobj.getDate()}` : date;
        const pnlStr = '₹' + Math.abs(Math.round(totalPnl)).toLocaleString('en-IN');
        
        thumbWrap.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-size:10px; font-weight:700;">
                <span style="color:var(--text3);">${dateStr}</span>
                <span class="mini-pnl-val" data-orig="${totalPnl < 0 ? '-' : ''}${pnlStr}" style="color:${color};">${totalPnl < 0 ? '-' : ''}${pnlStr}</span>
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

        thumbWrap.onclick = () => {
             if (typeof state !== 'undefined') {
                state.gallery.date = date;
                if (typeof window.openUnifiedGallery === 'function') window.openUnifiedGallery(date);
                else if (typeof renderGallery === 'function') renderGallery();
            }
        };

        grid.appendChild(thumbWrap);

        const container = thumbWrap.querySelector('.mini-mtm-svg-container');
        renderVdMiniMtmChart(container, dateTrades, color, date);
    });
}

function renderVdMiniMtmChart(container, trades, color, date) {
    if (!container) return;
    const w = container.clientWidth || 130;
    const h = 80;
    
    let run = 0;
    const trajData = [{ val: 0, inst: 'Start', trade: null }];
    trades.forEach(t => {
        run += (getTradePnl(t) || 0);
        trajData.push({ val: run, inst: t.Symbol || t.Instrument || '', trade: t });
    });

    const trajArr = trajData.map(d => d.val);
    const min = Math.min(...trajArr);
    const max = Math.max(...trajArr);
    const range = (max - min) || 1;
    const pad = 10;

    const pts = trajData.map((d, i) => {
        const x = (i / (trajData.length - 1)) * w;
        const y = h - pad - ((d.val - min) / range) * (h - (pad * 2));
        return { x, y, ...d };
    });

    const pathData = pts.map((p, i) => (i === 0 ? 'M' : 'L') + `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const zeroY = h - pad - ((0 - min) / range) * (h - (pad * 2));
    const gradId = 'mini-grad-' + Math.random().toString(36).substr(2, 9);
    
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
        
        // Final scale adjustment if viewBox is used
        const sx = mx * (w / rect.width);
        
        let closest = pts[0];
        let minDist = Math.abs(sx - pts[0].x);
        for(let i=1; i < pts.length; i++) {
            const d = Math.abs(sx - pts[i].x);
            if (d < minDist) { minDist = d; closest = pts[i]; }
        }

        if (trackLine && trackDot) {
            trackLine.setAttribute('x1', closest.x);
            trackLine.setAttribute('x2', closest.x);
            trackLine.style.display = 'block';
            trackDot.setAttribute('cx', closest.x);
            trackDot.setAttribute('cy', closest.y);
            trackDot.style.display = 'block';
        }

        if (pnlVal) {
            const val = Math.round(closest.val);
            pnlVal.textContent = '₹' + (val < 0 ? '-' : '') + Math.abs(val).toLocaleString('en-IN');
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
            const img = (closest.trade.images && closest.trade.images.length > 0) ? closest.trade.images[0] : null;
            if (typeof openGalleryForDate === 'function') {
                openGalleryForDate(date, img);
            }
        } else {
            if (typeof openGalleryForDate === 'function') {
                openGalleryForDate(date);
            }
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
