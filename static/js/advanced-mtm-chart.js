/**
 * @fileoverview advanced-mtm-chart.js
 * @description Advanced MTM Analytics with Month/Week toggles, Avg/Total aggregation, and multi-series Heads panel.
 */

const AdvMtmState = {
    timeframe: 'day', // 'month' | 'week' | 'day'
    viewType: 'bar',    // 'line' | 'bar' | 'pie'
    aggType: 'total',   // 'total' | 'avg'
    visibleHeads: {
        amt: true,
        pt: true,
        brokerage: false,
        tax: false,
        total_charges: false,
        trades: false
    },
    chart: null
};

/**
 * Initialize the Advanced MTM Chart
 */
function initAdvancedMtmChart() {
    renderAdvMtmToolbar();
    updateAdvMtmChart();
}

/**
 * Render the toolbar and sidebar controls
 */
function renderAdvMtmToolbar() {
    const container = document.getElementById('adv-mtm-controls-container');
    if (!container) return;

    container.innerHTML = `
        <div class="adv-mtm-toolbar">
            <div class="adv-mtm-group">
                <button class="adv-btn ${AdvMtmState.aggType === 'total' ? 'active' : ''}" onclick="setAdvMtmAgg('total')">Net</button>
                <button class="adv-btn ${AdvMtmState.aggType === 'avg' ? 'active' : ''}" onclick="setAdvMtmAgg('avg')">Avg</button>
            </div>
            
            <div class="adv-mtm-group">
                <button class="adv-btn ${AdvMtmState.viewType === 'line' ? 'active' : ''}" onclick="setAdvMtmView('line')">Line</button>
                <button class="adv-btn ${AdvMtmState.viewType === 'bar' ? 'active' : ''}" onclick="setAdvMtmView('bar')">Bar</button>
                <button class="adv-btn ${AdvMtmState.viewType === 'pie' ? 'active' : ''}" onclick="setAdvMtmView('pie')">Pie</button>
            </div>

            <div class="adv-mtm-group">
                <button class="adv-btn ${AdvMtmState.timeframe === 'month' ? 'active' : ''}" onclick="setAdvMtmTimeframe('month')">Month</button>
                <button class="adv-btn ${AdvMtmState.timeframe === 'week' ? 'active' : ''}" onclick="setAdvMtmTimeframe('week')">Week</button>
                <button class="adv-btn ${AdvMtmState.timeframe === 'day' ? 'active' : ''}" onclick="setAdvMtmTimeframe('day')">Day</button>
            </div>

            <button class="adv-btn-icon" onclick="toggleAdvMtmHeadsPanel()" title="Toggle Heads Sidebar">
                ⚙️
            </button>
        </div>
    `;
}

function toggleAdvMtmHeadsPanel() {
    const panel = document.getElementById('adv-mtm-heads-panel');
    if (!panel) return;
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
}

function setAdvMtmAgg(val) { AdvMtmState.aggType = val; renderAdvMtmToolbar(); updateAdvMtmChart(); }
function setAdvMtmView(val) { AdvMtmState.viewType = val; renderAdvMtmToolbar(); updateAdvMtmChart(); }
function setAdvMtmTimeframe(val) { AdvMtmState.timeframe = val; renderAdvMtmToolbar(); updateAdvMtmChart(); }

function toggleAdvMtmHead(head) {
    AdvMtmState.visibleHeads[head] = !AdvMtmState.visibleHeads[head];
    renderAdvMtmHeadsPanel();
    updateAdvMtmChart();
}

function renderAdvMtmHeadsPanel(seriesTotals = {}) {
    const panel = document.getElementById('adv-mtm-heads-panel');
    if (!panel) return;

    const heads = [
        { id: 'pt', label: 'Pt' },
        { id: 'amt', label: 'Amt' },
        { id: 'brokerage', label: 'Brokerage' },
        { id: 'tax', label: 'Charges' },
        { id: 'total_charges', label: 'Total Fees' },
        { id: 'trades', label: 'Trades' }
    ];

    panel.innerHTML = heads.map(h => {
        const isActive = AdvMtmState.visibleHeads[h.id];
        const total = seriesTotals[h.id] || 0;
        const totalStr = h.id === 'trades' ? Math.round(total) : 
                        '₹' + Math.round(total).toLocaleString('en-IN');
        
        return `
            <div class="head-item ${isActive ? 'active' : ''}" onclick="toggleAdvMtmHead('${h.id}')">
                <span class="head-dot" style="background: ${getHeadColor(h.id)}"></span>
                <div class="head-info">
                    <span class="head-label">${h.label}</span>
                    <span class="head-total">${totalStr}</span>
                </div>
            </div>
        `;
    }).join('');
}

function getHeadColor(id) {
    const colors = {
        amt: '#3fb950',
        pt: '#58a6ff',
        brokerage: '#f0883e',
        tax: '#f85149',
        total_charges: '#ff7b72',
        trades: '#bc8cff'
    };
    return colors[id] || '#8b949e';
}

/**
 * Process data for the chart
 */
function getAdvMtmChartData() {
    const trades = typeof getVdTrades === 'function' ? getVdTrades() : [];
    if (!trades.length) return { categories: [], series: [] };

    // Grouping
    const groups = {};
    trades.forEach(t => {
        const dateStr = typeof extractDateFromTrade === 'function' ? extractDateFromTrade(t) : (t.date || t.Date || '');
        if (!dateStr) return;
        
        const date = new Date(dateStr + 'T00:00:00');
        if (isNaN(date)) return;
        
        let key = '';
        
        if (AdvMtmState.timeframe === 'month') {
            key = date.toLocaleString('default', { month: 'short' });
        } else if (AdvMtmState.timeframe === 'week') {
            // Week grouping (approximate week of month)
            const weekOfMonth = Math.ceil(date.getDate() / 7);
            const monthName = date.toLocaleString('default', { month: 'short' });
            key = `${monthName} W${weekOfMonth}`;
        } else {
            // Day grouping
            key = date.toLocaleString('default', { month: 'short', day: 'numeric' });
        }

        if (!groups[key]) groups[key] = { trades: [], amt: 0, pt: 0, brok: 0, tax: 0, total_charges: 0, count: 0 };
        
        groups[key].trades.push(t);
        groups[key].amt += (typeof getTradePnl === 'function' ? getTradePnl(t) : (t.net_pnl || t.Net_PL || t.net_pl || 0));
        groups[key].pt += parseFloat(t.Pt || t.Points || t.pt || 0);
        
        // Charges breakdown matching dashboard.js logic
        const brKeys = ['Brokerage', 'brokerage', 'Brokerage Charges', 'Brokerage (Total)'];
        const ocKeys = ['Other Charges', 'Charges', 'Charge', 'charges', 'charge', 'Transaction Charges', 'Charges (Total)', 'Total Charges'];
        const tfKeys = ['Total Fees', 'total_fees', 'Total Fees (Total)'];

        const getVal = (keys) => {
            for (const k of keys) {
                const v = parseFloat(t[k]);
                if (!isNaN(v)) return v;
            }
            return 0;
        };

        const br = getVal(brKeys);
        const oc = getVal(ocKeys);
        let tf = getVal(tfKeys);
        if (tf === 0) tf = br + oc;
        
        groups[key].brok += br;
        groups[key].tax += oc;
        groups[key].total_charges += tf;

        groups[key].count += 1;
    });

    const categories = Object.keys(groups);
    const series = [];
    const seriesTotals = { pt: 0, amt: 0, brokerage: 0, tax: 0, total_charges: 0, trades: 0 };

    const heads = [
        { id: 'amt', label: 'Amt (P/L)', key: 'amt' },
        { id: 'pt', label: 'Points', key: 'pt' },
        { id: 'brokerage', label: 'Brokerage', key: 'brok' },
        { id: 'tax', label: 'Tax/Charges', key: 'tax' },
        { id: 'total_charges', label: 'Total Charges', key: 'total_charges' },
        { id: 'trades', label: 'Trades', key: 'count' }
    ];

    heads.forEach(h => {
        // Always calculate totals for the sidebar even if hidden
        categories.forEach(cat => {
            seriesTotals[h.id] += groups[cat][h.key];
        });

        if (AdvMtmState.visibleHeads[h.id]) {
            const data = categories.map(cat => {
                const val = groups[cat][h.key];
                return AdvMtmState.aggType === 'avg' ? val / groups[cat].count : val;
            });
            
            series.push({ 
                name: h.label, 
                data: data.map(v => ({
                    x: categories[data.indexOf(v)], // Ensure X is set
                    y: Math.abs(v),
                    originalY: v,
                    fillColor: v >= 0 ? (h.id === 'amt' ? '#3fb950' : getHeadColor(h.id)) : '#f85149'
                })), 
                color: getHeadColor(h.id),
                type: AdvMtmState.viewType === 'pie' ? 'donut' : AdvMtmState.viewType
            });
        }
    });

    return { categories, series, seriesTotals };
}

/**
 * Update/Render the ApexChart
 */
function updateAdvMtmChart() {
    const { categories, series, seriesTotals } = getAdvMtmChartData();
    const chartCont = document.getElementById('adv-mtm-chart-area');
    if (!chartCont) return;

    renderAdvMtmHeadsPanel(seriesTotals);

    const options = {
        series: series,
        chart: {
            type: AdvMtmState.viewType === 'pie' ? 'donut' : AdvMtmState.viewType,
            height: 350,
            background: 'transparent',
            foreColor: '#8b949e',
            toolbar: { show: false },
            zoom: { enabled: false }
        },
        plotOptions: {
            bar: { 
                borderRadius: 4, 
                columnWidth: '60%',
                distributed: false
            },
            pie: { donut: { size: '70%' } }
        },
        dataLabels: { enabled: false },
        stroke: {
            curve: 'smooth',
            width: AdvMtmState.viewType === 'line' ? 4 : 0,
            lineCap: 'round'
        },
        markers: {
            size: AdvMtmState.viewType === 'line' ? 5 : 0,
            strokeWidth: 2,
            strokeColors: '#fff',
            hover: { size: 7 }
        },
        xaxis: {
            categories: categories,
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: {
                rotate: -45,
                rotateAlways: categories.length > 10,
                hideOverlappingLabels: true,
                style: { fontSize: '10px', colors: '#8b949e' }
            }
        },
        yaxis: {
            labels: {
                formatter: (val) => Math.abs(val) >= 1000 ? (val/1000).toFixed(1) + 'k' : val.toFixed(0),
                style: { colors: '#8b949e' }
            }
        },
        grid: {
            borderColor: 'rgba(255,255,255,0.05)',
            strokeDashArray: 4,
            padding: {
                left: 20,
                right: 20,
                bottom: 10
            }
        },
        tooltip: {
            theme: 'dark',
            y: {
                formatter: function(val, { series, seriesIndex, dataPointIndex, w }) {
                    const dataObj = w.config.series[seriesIndex].data[dataPointIndex];
                    if (!dataObj || dataObj.originalY === undefined) return val;
                    const orig = dataObj.originalY;
                    const isCurrency = !w.config.series[seriesIndex].name.toLowerCase().includes('trades') && !w.config.series[seriesIndex].name.toLowerCase().includes('pts');
                    const sign = orig < 0 ? '-' : '';
                    const absVal = Math.abs(orig);
                    const formatted = absVal >= 1000 ? (absVal/1000).toFixed(1) + 'k' : Math.round(absVal);
                    return sign + (isCurrency ? '₹' : '') + formatted;
                }
            }
        },
        legend: { show: false }
    };

    if (AdvMtmState.viewType === 'pie') {
        // Pie chart logic: simplified for absolute values
        const activeHeadKey = Object.keys(AdvMtmState.visibleHeads).find(k => AdvMtmState.visibleHeads[k]);
        if (series.length > 0) {
            options.series = series[0].data.map(d => d.y);
            options.labels = categories;
        }
    }

    if (AdvMtmState.chart) {
        AdvMtmState.chart.updateOptions(options);
    } else {
        AdvMtmState.chart = new ApexCharts(chartCont, options);
        AdvMtmState.chart.render();
    }
}
