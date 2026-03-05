// Visual Dashboard state
const vdState = {
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    view: 'month' // 'month' or 'year'
};

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

function renderVisualDashboard() {
    updateVdRangeLabel();

    const trades = getVdTrades();

    // Basic metrics
    let totalWin = 0;
    let totalLoss = 0;
    let winCount = 0;
    let totalTradesCount = 0;

    // Data for charts
    const dailyPnlMap = new Map(); // Date -> Net P/L
    const strategyPnlMap = new Map(); // Setup -> Net P/L
    const strategyCountMap = new Map(); // Setup -> count

    // New metrics maps
    const dailyTradeCountMap = new Map();
    const dailyQtyMap = new Map();
    const dailyPointsMap = new Map();
    const dailyFcMap = new Map();
    const dailyBuyPriceSumMap = new Map();
    const dailyBuyPriceCountMap = new Map();
    const pointsPerTradeData = [];

    let longPnl = 0;
    let shortPnl = 0;
    let longCount = 0;
    let shortCount = 0;

    trades.forEach(t => {
        const pnl = getTradePnl(t) || 0; // Using existing helper if available
        const isWin = pnl > 0;

        // Stats
        totalTradesCount++;
        if (isWin) {
            totalWin += pnl;
            winCount++;
        } else {
            totalLoss += Math.abs(pnl);
        }

        // Other stats
        const qty = parseFloat(t['Qty'] || t['quantity'] || t['Qty.']) || 0;
        const pt = parseFloat(t['Pt'] || t['Points']) || 0;
        const fc = parseFloat(t['fill_count'] || t['FC']) || 0;
        const buyPrice = parseFloat(t['Buy Price (Avg)'] || t['Buy Price']) || 0;

        let d = normalizeDate(extractDateFromTrade(t));

        // Push full data for tooltip formatting
        pointsPerTradeData.push({
            x: `T${totalTradesCount}`,
            y: pt,
            date: d || 'Unknown',
            amt: pnl
        });

        // Daily map
        const mode = typeof state !== 'undefined' ? state.calendarMode : 'consolidated';
        if (mode === 'individual') {
            d = `T${totalTradesCount} (${d})`;
        }
        if (d) {
            dailyPnlMap.set(d, (dailyPnlMap.get(d) || 0) + pnl);
            dailyTradeCountMap.set(d, (dailyTradeCountMap.get(d) || 0) + 1);
            dailyQtyMap.set(d, (dailyQtyMap.get(d) || 0) + qty);
            dailyPointsMap.set(d, (dailyPointsMap.get(d) || 0) + pt);
            dailyFcMap.set(d, (dailyFcMap.get(d) || 0) + fc);
            if (buyPrice > 0) {
                dailyBuyPriceSumMap.set(d, (dailyBuyPriceSumMap.get(d) || 0) + buyPrice);
                dailyBuyPriceCountMap.set(d, (dailyBuyPriceCountMap.get(d) || 0) + 1);
            }
        }

        // Strategy Map (Use 'Setup' or 'Tags' column)
        const setupStr = typeof getTradeTagsForColumn === 'function' && state && state.tagColumns && state.tagColumns.length > 0
            ? getTradeTagsForColumn(t, state.tagColumns[0]).join(', ') || 'No Strategy'
            : t['Setup'] || t['Strategy'] || 'No Strategy';

        // Split comma separated setups if multiple tags
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

    // Process daily results and cumulative
    const sortedDates = Array.from(dailyPnlMap.keys()).sort();

    const dailyPlData = [];
    const cumulativeData = [];
    const dailyTradeCountData = [];
    const dailyQtyData = [];
    const dailyPointsData = [];
    const dailyFcData = [];
    const avgBuyPriceData = [];

    let runningTotal = 0;
    const chartDates = [];

    sortedDates.forEach(date => {
        const val = dailyPnlMap.get(date) || 0;
        dailyPlData.push(val.toFixed(2));
        runningTotal += val;
        cumulativeData.push(runningTotal.toFixed(2));

        dailyTradeCountData.push(dailyTradeCountMap.get(date) || 0);
        dailyQtyData.push(dailyQtyMap.get(date) || 0);
        dailyPointsData.push((dailyPointsMap.get(date) || 0).toFixed(2));
        dailyFcData.push(dailyFcMap.get(date) || 0);

        const bpSum = dailyBuyPriceSumMap.get(date) || 0;
        const bpCount = dailyBuyPriceCountMap.get(date) || 0;
        avgBuyPriceData.push(bpCount > 0 ? (bpSum / bpCount).toFixed(2) : "0.00");

        // Formatting date
        let displayStr = '';
        if (date.startsWith('T')) {
            const match = date.match(/(T\d+) \((.*)\)/);
            if (match) {
                const dateObj = new Date(match[2]);
                displayStr = `${match[1]} - ${dateObj.getDate()} ${dateObj.toLocaleString('default', { month: 'short' })}`;
            } else {
                displayStr = date;
            }
        } else {
            const dateObj = new Date(date);
            displayStr = `${dateObj.getDate()} ${dateObj.toLocaleString('default', { month: 'short' })}`;
        }
        chartDates.push(displayStr);
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
        }
    };

    // Re-create charts instead of trying to update dynamically, to avoid issues

    // 1. Cumulative Performance (Area Chart)
    if (vdCharts.cumulative) vdCharts.cumulative.destroy();
    const optionsCumulative = {
        ...commonOptions,
        series: [{ name: 'Cumulative P/L (₹)', data: cumulativeData.length ? cumulativeData : [0] }],
        chart: { ...commonOptions.chart, type: 'area', height: 300 },
        colors: ['#00e396'],
        fill: {
            type: 'gradient',
            gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] }
        },
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 2 },
        xaxis: { categories: chartDates.length ? chartDates : ['No Data'], tooltip: { enabled: false } },
        yaxis: { labels: { formatter: (val) => "₹ " + Number(val).toLocaleString() } }
    };
    vdCharts.cumulative = new ApexCharts(document.querySelector("#chart-cumulative"), optionsCumulative);
    vdCharts.cumulative.render();

    // 2. Daily Net P/L (Bar Chart)
    if (vdCharts.daily) vdCharts.daily.destroy();
    const optionsDaily = {
        ...commonOptions,
        series: [{ name: 'Net P/L', data: dailyPlData.length ? dailyPlData : [0] }],
        chart: { ...commonOptions.chart, type: 'bar', height: 250 },
        plotOptions: {
            bar: {
                colors: {
                    ranges: [
                        { from: -10000000, to: -0.01, color: '#f85149' },
                        { from: 0, to: 10000000, color: '#3fb950' }
                    ]
                },
                columnWidth: chartDates.length > 20 ? '80%' : '60%',
                borderRadius: 2
            }
        },
        dataLabels: { enabled: false },
        xaxis: { categories: chartDates.length ? chartDates : ['No Data'] },
        yaxis: { labels: { formatter: (val) => "₹ " + Number(val).toLocaleString() } }
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
    let profitData = sortedStrats.map(e => e[1].toFixed(2));

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
    vdCharts.dailyQty = new ApexCharts(document.querySelector("#chart-daily-qty"), {
        ...commonOptions,
        series: [
            { name: 'Trade Count', type: 'column', data: dailyTradeCountData.length ? dailyTradeCountData : [0] },
            { name: 'Quantity sum', type: 'line', data: dailyQtyData.length ? dailyQtyData : [0] }
        ],
        chart: { ...commonOptions.chart, height: 250 },
        stroke: { width: [0, 3], curve: 'smooth' },
        colors: ['#58a6ff', '#f85149'],
        xaxis: { categories: chartDates.length ? chartDates : ['No Data'] },
        yaxis: [
            { title: { text: 'Count' }, labels: { formatter: (val) => Math.floor(val) } },
            { opposite: true, title: { text: 'Quantity' }, labels: { formatter: (val) => Number(val).toLocaleString() } }
        ]
    });
    vdCharts.dailyQty.render();

    // 7. PAT (SUM) -> Area chart of Net PL but non-cumulative (daily sum)
    if (vdCharts.patSum) vdCharts.patSum.destroy();
    vdCharts.patSum = new ApexCharts(document.querySelector("#chart-pat-sum"), {
        ...commonOptions,
        series: [{ name: 'PAT Sum (₹)', data: dailyPlData.length ? dailyPlData : [0] }],
        chart: { ...commonOptions.chart, type: 'area', height: 250 },
        colors: ['#d29922'],
        fill: {
            type: 'gradient',
            gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] }
        },
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 2 },
        xaxis: { categories: chartDates.length ? chartDates : ['No Data'] },
        yaxis: { labels: { formatter: (val) => "₹ " + Number(val).toLocaleString() } }
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
                return `
                  <div style="padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 4px;">
                    <div><strong>Date:</strong> ${data.date}</div>
                    <div><strong>Trade:</strong> ${data.x}</div>
                    <div><strong>PT:</strong> ${data.y}</div>
                    <div><strong>AMT:</strong> ₹ ${data.amt.toFixed(2)}</div>
                  </div>
                `;
            }
        }
    });
    vdCharts.pointsPerTrade.render();

    // 9. Points - Sum
    if (vdCharts.pointsSum) vdCharts.pointsSum.destroy();
    let rPoints = 0;
    const pointsCumulData = dailyPointsData.map(p => { rPoints += parseFloat(p); return rPoints.toFixed(2); });
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
        xaxis: { categories: chartDates.length ? chartDates : ['No Data'] },
        yaxis: { labels: { formatter: (val) => Number(val).toLocaleString() } }
    });
    vdCharts.pointsSum.render();

    // 10. Daily FC
    if (vdCharts.dailyFc) vdCharts.dailyFc.destroy();
    vdCharts.dailyFc = new ApexCharts(document.querySelector("#chart-daily-fc"), {
        ...commonOptions,
        series: [{ name: 'Daily FC', data: dailyFcData.length ? dailyFcData : [0] }],
        chart: { ...commonOptions.chart, type: 'bar', height: 250 },
        colors: ['#8b949e'],
        xaxis: { categories: chartDates.length ? chartDates : ['No Data'] },
        yaxis: { labels: { formatter: (val) => Math.floor(val) } }
    });
    vdCharts.dailyFc.render();

    // 11. Avg Buy Price
    if (vdCharts.avgBuyPrice) vdCharts.avgBuyPrice.destroy();
    vdCharts.avgBuyPrice = new ApexCharts(document.querySelector("#chart-avg-buy-price"), {
        ...commonOptions,
        series: [{ name: 'Avg Buy Price', data: avgBuyPriceData.length ? avgBuyPriceData : [0] }],
        chart: { ...commonOptions.chart, type: 'line', height: 250 },
        stroke: { width: 3, curve: 'smooth' },
        colors: ['#58a6ff'],
        xaxis: { categories: chartDates.length ? chartDates : ['No Data'] },
        yaxis: { labels: { formatter: (val) => "₹ " + Number(val).toLocaleString() } }
    });
    vdCharts.avgBuyPrice.render();

    applyVdStatVisibility();
    applyVdStatOrder();
    applyVdCardWidths();
}

// Ensure parsing PNL dynamically works safely
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

function getVdStatsState() {
    try {
        const raw = localStorage.getItem('vdStats');
        if (raw) return JSON.parse(raw);
    } catch (e) { }
    const all = {};
    VD_STATS.forEach(s => { all[s.key] = true; });
    return all;
}

function saveVdStatsState(stateMap) {
    try { localStorage.setItem('vdStats', JSON.stringify(stateMap)); } catch (e) { }
}

function getVdStatsOrder() {
    try {
        const raw = localStorage.getItem('vdStatsOrder');
        if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr) && arr.length) {
                const valid = arr.filter(k => VD_STATS.some(s => s.key === k));
                const missing = VD_STATS.map(s => s.key).filter(k => !valid.includes(k));
                return [...valid, ...missing];
            }
        }
    } catch (e) { }
    return VD_STATS.map(s => s.key);
}

function saveVdStatsOrder(order) {
    try { localStorage.setItem('vdStatsOrder', JSON.stringify(order)); } catch (e) { }
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

function renderVdStatsMenu() {
    const menu = document.getElementById('vd-stats-menu');
    if (!menu) return;
    menu.innerHTML = '';

    const map = getVdStatsState();
    const order = getVdStatsOrder();

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
        saveVdStatsState(map);
        renderVdStatsMenu();
        applyVdStatVisibility();
    });
    btnNone.addEventListener('click', () => {
        VD_STATS.forEach(s => { map[s.key] = false; });
        saveVdStatsState(map);
        renderVdStatsMenu();
        applyVdStatVisibility();
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
        const items = order
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
                saveVdStatsState(map);
                applyVdStatVisibility();
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
                const newOrder = order.filter(k => k !== from);
                const toIdx = newOrder.indexOf(to);
                newOrder.splice(toIdx, 0, from);
                saveVdStatsOrder(newOrder);
                renderList(searchInp.value);
                applyVdStatOrder();
                applyVdCardWidths();
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

    // Bind dropdown click behavior
    const statBtn = document.getElementById('vd-stats-btn');
    if (statBtn) {
        statBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = document.getElementById('vd-stats-menu');
            if (menu) menu.classList.toggle('open');
        });
    }

    // Close on click outside
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('vd-stats-menu');
        const btn = document.getElementById('vd-stats-btn');
        if (menu && menu.classList.contains('open') && !menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
            menu.classList.remove('open');
        }
    });
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
    try {
        const raw = localStorage.getItem('vdCardWidths');
        if (raw) return JSON.parse(raw);
    } catch (e) { }
    return {}; // Default
}

function saveVdCardWidths(w) {
    try { localStorage.setItem('vdCardWidths', JSON.stringify(w)); } catch (e) { }
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

function applyVdCardWidths() {
    const widths = getVdCardWidths();
    document.querySelectorAll('.visual-dash-grid .dash-card[data-vd-stat]').forEach(card => {
        const key = card.getAttribute('data-vd-stat');
        const cols = widths[key] || card.getAttribute('data-vd-default-width') || 6;
        card.style.gridColumn = `span ${cols}`;

        // update select
        const sel = card.querySelector('.vd-width-select');
        if (sel) sel.value = cols;
    });
}
