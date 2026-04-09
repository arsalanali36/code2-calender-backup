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
