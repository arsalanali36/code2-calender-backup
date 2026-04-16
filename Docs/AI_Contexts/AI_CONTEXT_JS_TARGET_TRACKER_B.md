# JS - Target Tracker B (weekly, data, init)
Consolidated code context for AI assistants.


## File: `static/js/target-tracker-weekly.js`
```js
/**
 * @fileoverview target-tracker-weekly.js
 * @description Weekly tab rendering, bell-curve chart, comparison chart, and tooltip helpers.
 * Requires: target-tracker-data.js
 */

function renderTtWeeklyView() {
    const lotSize = parseInt(_targetConfig.lotSizeStr) || 65;
    const maxMult = parseInt(_targetConfig.maxMultStr) || 3;
    const maxPts = parseFloat(_targetConfig.maxPtsStr) || 30;

    // UPDATE WEEKLY VIEW
    const weeklyListEl = document.getElementById('tt-weekly-list');
    const weeklyMonthLbl = document.getElementById('tt-weekly-month-label');
    if (weeklyListEl && _ttCurrentDate) {
        const parts = _ttCurrentDate.split('-');
        if (parts.length >= 2) {
            const y = parseInt(parts[0], 10);
            const mOff = parseInt(parts[1], 10) - 1;
            const perf = getMonthlyPerformance(y, mOff);

            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            if (weeklyMonthLbl) weeklyMonthLbl.textContent = `${monthNames[mOff]} ${y}`;

            // Group into weeks
            const weeks = [];
            let currentWeek = null;

            // Calculate dailyExpectedGain (same formula as in Monthly logic)
            const goal = lotSize * maxMult * maxPts;
            const maxLoss = lotSize * maxMult * maxPts;
            const expWin = parseFloat(_targetConfig.expWinStr) || 15;
            const expLoss = parseFloat(_targetConfig.expLossStr) || 5;
            const totalExpDays = expWin + expLoss;
            const dailyExpectedGain = totalExpDays > 0 ? ((goal * expWin) - (maxLoss * expLoss)) / totalExpDays : goal;

            perf.dailyPls.forEach((dp, i) => {
                const d = new Date(dp.dateStr + "T00:00:00");
                const dayOfWeek = d.getDay(); // 0 (Sun) to 6 (Sat)

                // Start new week on Monday (1) or if it's the first day
                if (dayOfWeek === 1 || !currentWeek) {
                    if (currentWeek) weeks.push(currentWeek);
                    currentWeek = {
                        days: [],
                        start: dp.dateStr,
                        actual: 0,
                        target: 0,
                        passedCount: 0,
                        tradeCount: 0,
                        points: 0,
                        fees: 0,
                        duration: 0
                    };
                }
                currentWeek.days.push(dp);
                currentWeek.actual += dp.dailyPnl;
                currentWeek.target += dailyExpectedGain;
                if (dp.passed) {
                    currentWeek.passedCount++;
                    currentWeek.tradeCount += (dp.tradeCount || 0);
                    currentWeek.points += (dp.points || 0);
                    currentWeek.fees += (dp.fees || 0);
                    currentWeek.duration += (dp.duration || 0);
                }
                currentWeek.end = dp.dateStr;
            });
            if (currentWeek) weeks.push(currentWeek);

            let html = '';
            let totalActualMonth = 0;
            let totalTargetMonth = 0;
            let monthMetrics = { tradeCount: 0, points: 0, fees: 0, duration: 0 };

            weeks.forEach((w, idx) => {
                totalActualMonth += w.actual;
                totalTargetMonth += w.target;
                monthMetrics.tradeCount += w.tradeCount;
                monthMetrics.points += w.points;
                monthMetrics.fees += w.fees;
                monthMetrics.duration += w.duration;

                let pct = 0;
                if (w.target > 0) pct = (w.actual / w.target) * 100;
                const displayPct = Math.min(Math.max(pct, 0), 100);

                let color = 'var(--blue)';
                if (pct >= 100) color = 'var(--green)';
                else if (pct < 0) color = 'var(--red)';
                else if (pct < 50) color = 'var(--orange, #f39c12)';

                const startD = new Date(w.start + "T00:00:00").getDate();
                const endD = new Date(w.end + "T00:00:00").getDate();
                const weekRange = `${startD} - ${endD}`;

                html += `
                    <div class="tt-weekly-row"
                         style="display:flex; flex-direction:column; gap:8px; cursor:pointer;"
                         onmousemove="window.showTtWeeklyTooltip(event, ${idx}, ${w.actual}, ${w.target}, '${weekRange}', ${JSON.stringify({tradeCount: w.tradeCount, points: w.points, fees: w.fees, duration: w.duration}).replace(/"/g, '&quot;')})"
                         onmouseleave="window.hideTtWeeklyTooltip()">
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:var(--text); align-items:center;">
                            <span style="font-weight:bold;">Week ${idx + 1} <span style="font-weight:normal; opacity:0.6; font-size:0.75rem; margin-left:6px;">(${weekRange})</span></span>
                            <span style="font-family:monospace; font-weight:bold; color:${w.actual >= 0 ? 'var(--green)' : 'var(--red)'};">\u20B9 ${Math.round(w.actual).toLocaleString('en-IN')} / \u20B9 ${Math.round(w.target).toLocaleString('en-IN')}</span>
                        </div>
                        <div style="width:100%; height:24px; background:var(--bg3); border-radius:12px; overflow:hidden; position:relative; border:1px solid rgba(255,255,255,0.05);">
                            <div style="width:${displayPct}%; height:100%; background:${color}; border-radius:12px; transition:width 0.4s ease;"></div>
                            <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:bold; color:#fff; text-shadow:1px 1px 2px rgba(0,0,0,0.5); pointer-events:none;">${Math.round(pct)}%</div>
                        </div>
                    </div>
                `;
            });

            // ADD TOTAL/AVERAGE BAR
            if (totalTargetMonth > 0) {
               const totalPct = (totalActualMonth / totalTargetMonth) * 100;
               const displayPct = Math.min(Math.max(totalPct, 0), 100);
               let totalColor = 'var(--blue)';
               if (totalPct >= 100) totalColor = 'var(--green)';
               else if (totalPct < 0) totalColor = 'var(--red)';

               html += `
                <div style="margin-top:16px; padding-top:16px; border-top:2px dashed var(--border); display:flex; flex-direction:column; gap:10px; cursor:pointer;"
                     onmousemove="window.showTtWeeklyTooltip(event, 'Total', ${totalActualMonth}, ${totalTargetMonth}, 'Full Month', ${JSON.stringify(monthMetrics).replace(/"/g, '&quot;')})"
                     onmouseleave="window.hideTtWeeklyTooltip()">
                    <div style="display:flex; justify-content:space-between; font-size:0.95rem; color:var(--text); align-items:center;">
                        <span style="font-weight:bold; color:var(--blue);">MONTHLY TOTAL (Avg.)</span>
                        <span style="font-family:monospace; font-weight:bold; color:${totalActualMonth >= 0 ? 'var(--green)' : 'var(--red)'};">\u20B9 ${Math.round(totalActualMonth).toLocaleString('en-IN')} / \u20B9 ${Math.round(totalTargetMonth).toLocaleString('en-IN')}</span>
                    </div>
                    <div style="width:100%; height:32px; background:var(--bg3); border-radius:16px; overflow:hidden; position:relative; border:1px solid rgba(52,152,219,0.3); box-shadow:0 0 15px rgba(52,152,219,0.1);">
                        <div style="width:${displayPct}%; height:100%; background:linear-gradient(90deg, ${totalColor}, var(--blue)); border-radius:16px; transition:width 0.6s ease;"></div>
                        <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:0.9rem; font-weight:bold; color:#fff; text-shadow:1px 1px 3px rgba(0,0,0,0.6); pointer-events:none;">Total Pacing: ${Math.round(totalPct)}%</div>
                    </div>
                </div>
               `;
            }

            weeklyListEl.innerHTML = html;

            // Sync metric buttons
            document.querySelectorAll('.tt-metric-btn').forEach(btn => {
                if (btn.dataset.metric === _ttWeeklyChartMetric) {
                    btn.classList.add('active');
                    btn.style.background = 'var(--blue)';
                    btn.style.color = '#fff';
                } else {
                    btn.classList.remove('active');
                    btn.style.background = 'transparent';
                    btn.style.color = 'var(--text2)';
                }
            });

            // RENDER COMPARISON CHART
            const metricWrap = document.getElementById('tt-weekly-metric-wrap');
            if (_ttWeeklyChartType === 'bell') {
                renderTtWeeklyBellCurve(weeks);
            } else {
                renderTtWeeklyComparisonChart(weeks);
            }
            if (metricWrap) metricWrap.style.display = 'flex';
        }
    }
}

function renderTtWeeklyBellCurve(weeks) {
    const chartEl = document.getElementById('tt-weekly-comparison-chart');
    if (!chartEl) return;
    chartEl.innerHTML = '';

    const w = chartEl.clientWidth || 400;
    const h = chartEl.clientHeight || 300;

    // Extract all individual trades for the current visible month
    if (!window.state || !window.state.trades) {
        chartEl.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; opacity:0.5;">No data available</div>';
        return;
    }

    // Helper to parse date within bell curve
    const _parse = (dStr) => {
        if (!dStr) return null;
        if (dStr.includes("-")) return new Date(dStr + "T00:00:00");
        const parts = dStr.split("/");
        if (parts.length === 3) {
            let y = parseInt(parts[2]);
            if (y < 100) y += 2000;
            return new Date(y, parseInt(parts[1])-1, parseInt(parts[0]));
        }
        return new Date(dStr);
    };

    // We need to filter trades for the same month/year as _ttCurrentDate
    const curDate = _parse(_ttCurrentDate) || new Date();
    const month = curDate.getMonth();
    const year = curDate.getFullYear();

    const monthTrades = window.state.trades.filter(t => {
        const dStr = t.Date || t.date || (typeof extractDateFromTrade === 'function' ? extractDateFromTrade(t) : '');
        const d = _parse(dStr);
        return d && d.getMonth() === month && d.getFullYear() === year && t.Result !== undefined;
    });

    if (monthTrades.length === 0) {
        chartEl.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; opacity:0.5;">No trades found for this month</div>';
        return;
    }

    const metricType = _ttWeeklyChartMetric;
    const isAvgMode = _ttWeeklyAggMode === 'avg';

    // Extract individual trades and their target metric
    const results = monthTrades.map(t => {
        let val = 0;
        if (metricType === 'points') val = parseFloat(t.Result) || 0;
        else if (metricType === 'duration') {
             const durStr = t.Duration || t.duration || "0";
             val = parseInt(durStr) || 0;
        } else if (metricType === 'fees') val = parseFloat(t.Fees || t.fees || t.Tax || 0) || 0;
        else if (metricType === 'tradeCount') val = 1;
        else val = parseFloat(t.Result) || 0;
        return val;
    });

    const min = Math.min(...results, 0);
    const max = Math.max(...results, 1);
    const range = max - min;

    // Create bins
    const binCount = 15;
    const binSize = range / binCount;
    const bins = Array(binCount).fill(0);

    results.forEach(val => {
        let idx = Math.floor((val - min) / binSize);
        if (idx >= binCount) idx = binCount - 1;
        if (idx < 0) idx = 0;
        bins[idx]++;
    });

    const maxBin = Math.max(...bins, 1);
    const bW = w / binCount;

    let svg = `<svg width="100%" height="100%" style="overflow:visible;">`;

    let metricLabel = metricType.toUpperCase();
    let unit = '';
    if (metricType === 'points') unit = 'pt';
    else if (metricType === 'duration') unit = 'm';
    else if (metricType === 'fees') unit = '\u20B9';

    svg += `<text x="0" y="-10" fill="var(--text2)" style="font-size:0.75rem; text-transform:uppercase; font-weight:bold; opacity:0.5;">Trade Distribution (${metricLabel})</text>`;

    // Y-Axis labels
    for(let i=0; i<=4; i++) {
        const y = h - (i/4)*h;
        svg += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="rgba(255,255,255,0.05)" />`;
    }

    // Bars & Curve Points
    let curvePath = '';

    bins.forEach((count, i) => {
        const bH = (count / maxBin) * (h * 0.8);
        const x = i * bW;
        const y = h - bH;

        const binCenter = min + (i + 0.5) * binSize;
        let color = 'rgba(52, 152, 219, 0.2)';
        if (metricType === 'points') {
            color = binCenter >= 0 ? 'rgba(46, 204, 113, 0.25)' : 'rgba(231, 76, 60, 0.25)';
        }

        svg += `<rect x="${x + 2}" y="${y}" width="${bW - 4}" height="${bH}" fill="${color}" rx="2" />`;

        const tradesInBin = monthTrades.filter((t, idx) => {
            const val = results[idx];
            return val >= (min + i*binSize) && val < (min + (i+1)*binSize);
        });

        tradesInBin.forEach((t, j) => {
            const dotX = x + Math.random() * (bW - 8) + 4;
            const dotY = h - (j * 8) - 4;
            if (h - dotY < bH + (h*0.1)) {
                let dotColor = 'var(--blue)';
                if (metricType === 'points') dotColor = parseFloat(t.Result) >= 0 ? 'var(--green)' : 'var(--red)';
                else if (metricType === 'fees') dotColor = 'var(--red)';
                svg += `<circle cx="${dotX}" cy="${dotY}" r="3" fill="${dotColor}" style="opacity:0.6;"><title>${metricLabel}: ${results[monthTrades.indexOf(t)]}${unit}</title></circle>`;
            }
        });

        const midX = x + bW/2;
        if (i === 0) curvePath += `M ${midX} ${y}`;
        else curvePath += ` L ${midX} ${y}`;
    });

    // Draw Curve
    svg += `<path d="${curvePath}" fill="none" stroke="var(--blue)" stroke-width="2" style="opacity:0.5;" />`;

    // X-Axis labels
    for(let i=0; i<=5; i++) {
        const val = min + (i/5)*range;
        const x = (i/5)*w;
        svg += `<text x="${x}" y="${h + 15}" text-anchor="middle" fill="var(--text2)" style="font-size:0.6rem; opacity:0.6;">${Math.round(val)}</text>`;
    }

    svg += `</svg>`;
    chartEl.innerHTML = svg;
}

function renderTtWeeklyComparisonChart(weeks) {
    const chartEl = document.getElementById('tt-weekly-comparison-chart');
    if (!chartEl) return;
    chartEl.innerHTML = '';

    const w = chartEl.clientWidth || 400;
    const h = chartEl.clientHeight || 180;
    const metricType = _ttWeeklyChartMetric;
    const isAvgMode = _ttWeeklyAggMode === 'avg';

    let maxVal = 0;
    weeks.forEach(week => {
        let val = 0;
        const count = week.tradeCount || 1;

        if (metricType === 'avgPt') val = week.tradeCount > 0 ? Math.abs(week.points / week.tradeCount) : 0;
        else if (metricType === 'avgDur') val = week.tradeCount > 0 ? Math.abs(week.duration / week.tradeCount) : 0;
        else {
            val = Math.abs(week[metricType] || 0);
            if (isAvgMode && metricType !== 'tradeCount') val = val / count;
        }

        if (val > maxVal) maxVal = val;
    });
    if (maxVal === 0) maxVal = 1;

    const barWidth = Math.floor(w / weeks.length) - 15;

    let svg = `<svg width="100%" height="100%" filter="drop-shadow(0 0 10px rgba(0,0,0,0.5))" style="overflow:visible;">`;
    svg += `<text x="0" y="-10" fill="var(--text2)" style="font-size:0.65rem; font-weight:bold; opacity:0.5; text-transform:uppercase;">Mode: ${isAvgMode ? 'Averages' : 'Totals'}</text>`;

    weeks.forEach((week, i) => {
        let valRaw = 0;
        let suffix = '';
        const count = week.tradeCount || 1;

        if (metricType === 'avgPt') {
            valRaw = week.tradeCount > 0 ? (week.points / week.tradeCount) : 0;
            suffix = 'pt';
        } else if (metricType === 'avgDur') {
            valRaw = week.tradeCount > 0 ? (week.duration / week.tradeCount) : 0;
            suffix = 'm';
        } else {
            valRaw = week[metricType] || 0;
            if (isAvgMode && metricType !== 'tradeCount') valRaw = valRaw / count;

            if (metricType === 'points') suffix = 'pt';
            else if (metricType === 'fees') suffix = '';
        }

        let valAbs = Math.abs(valRaw);
        const barH = (valAbs / maxVal) * h;
        const x = i * (w / weeks.length) + (w / weeks.length - barWidth) / 2;
        const y = h - barH;

        let color = 'var(--blue)';
        if (metricType === 'fees') color = 'var(--red)';
        else if (metricType === 'points' || metricType === 'avgPt') {
            color = valRaw >= 0 ? 'var(--green)' : 'var(--red)';
        }

        const displayVal = metricType === 'avgPt' ? valRaw.toFixed(1) : Math.round(valRaw);

        svg += `
            <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="${color}" style="opacity:0.8; transition: all 0.3s;">
                <title>Week ${i+1}: ${displayVal}${suffix}</title>
            </rect>
            <text x="${x + barWidth/2}" y="${h + 15}" text-anchor="middle" fill="var(--text2)" style="font-size:0.7rem;">W${i+1}</text>
            <text x="${x + barWidth/2}" y="${y - 8}" text-anchor="middle" fill="${color}" style="font-size:0.65rem; font-weight:bold; opacity:0.9;">${displayVal}${suffix}</text>
        `;
    });

    svg += `</svg>`;
    chartEl.innerHTML = svg;
}

// Global scope helpers for interactivity
window.showTtWeeklyTooltip = (e, weekIdx, actual, target, range, metrics = null) => {
    const tooltipEl = document.getElementById('tt-chart-tooltip');
    if (!tooltipEl) return;

    const pct = target > 0 ? (actual / target) * 100 : 0;
    const diff = actual - target;
    const weekTitle = weekIdx === 'Total' ? 'Monthly Summary' : `Week ${weekIdx + 1}`;
    const isAvg = _ttWeeklyAggMode === 'avg';
    const count = (metrics ? metrics.tradeCount : 0) || 1;

    let metricsHtml = '';
    if (metrics) {
        const displayTrades = metrics.tradeCount || 0;
        const displayDur = Math.round(metrics.duration / count);

        let displayTax = metrics.fees;
        let displayPt = metrics.points;
        let avgPtVal = (metrics.points / count).toFixed(1);

        if (isAvg) {
            displayTax = metrics.fees / count;
            displayPt = metrics.points / count;
        }

        metricsHtml = `
            <div style="margin-top:15px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.1); display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:0.75rem;">
                <div>
                   <div style="opacity:0.6; margin-bottom:2px;">${isAvg ? 'Avg Trades' : 'Total Trades'}</div>
                   <div style="font-weight:bold; color:var(--text);">${displayTrades}</div>
                </div>
                <div>
                   <div style="opacity:0.6; margin-bottom:2px;">Avg Dur</div>
                   <div style="font-weight:bold; color:var(--text);">${displayDur} m</div>
                </div>
                <div>
                   <div style="opacity:0.6; margin-bottom:2px;">${isAvg ? 'Avg Tax' : 'Total Tax'}</div>
                   <div style="font-weight:bold; color:var(--red);">\u20B9 ${Math.round(displayTax).toLocaleString('en-IN')}</div>
                </div>
                <div>
                   <div style="opacity:0.6; margin-bottom:2px;">Avg Pt</div>
                   <div style="font-weight:bold; color:var(--blue);">${avgPtVal} pts</div>
                </div>
                <div style="grid-column: span 2;">
                   <div style="opacity:0.6; margin-bottom:2px;">${isAvg ? 'Avg Pt (Trade)' : 'Total Pt'}</div>
                   <div style="font-weight:bold; color:var(--blue); font-size:0.8rem;">${isAvg ? parseFloat(displayPt).toFixed(1) : Math.round(displayPt)} pts</div>
                </div>
            </div>
        `;
    }

    tooltipEl.innerHTML = `
        <div style="font-weight:bold; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:6px; color:var(--blue); display:flex; justify-content:space-between;">
            <span>${weekTitle}</span>
            <span style="font-weight:normal; opacity:0.6; font-size:0.7rem;">${range}</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; justify-content:space-between; gap:20px;">
                <span style="opacity:0.7;">Weekly Target:</span>
                <span style="font-family:monospace; font-weight:bold;">\u20B9 ${Math.round(target).toLocaleString('en-IN')}</span>
            </div>
            <div style="display:flex; justify-content:space-between; gap:20px;">
                <span style="opacity:0.7;">Weekly Actual:</span>
                <span style="font-family:monospace; font-weight:bold; color:${actual >= 0 ? 'var(--green)' : 'var(--red)'};">\u20B9 ${Math.round(actual).toLocaleString('en-IN')}</span>
            </div>
            <div style="display:flex; justify-content:space-between; gap:20px; border-top:1px dashed rgba(255,255,255,0.05); padding-top:6px; margin-top:4px;">
                <span style="opacity:0.7;">Performance:</span>
                <span style="font-weight:bold; color:${pct >= 100 ? 'var(--green)' : 'var(--orange, #f39c12)'};">${Math.round(pct)}%</span>
            </div>
            <div style="display:flex; justify-content:space-between; gap:20px;">
                <span style="opacity:0.7;">Variance:</span>
                <span style="font-family:monospace; color:${diff >= 0 ? 'var(--green)' : 'var(--red)'};">${diff >= 0 ? '+' : ''}\u20B9 ${Math.round(diff).toLocaleString('en-IN')}</span>
            </div>
        </div>
        ${metricsHtml}
    `;
    tooltipEl.style.display = 'block';

    // Position relative to the modal window parent
    const mContent = document.getElementById('tt-modal-content');
    const mRect = mContent.getBoundingClientRect();

    let tx = e.clientX - mRect.left + 20;
    let ty = e.clientY - mRect.top - 40;

    // Boundary check within the modal content
    const tooltipRect = tooltipEl.getBoundingClientRect();
    if (tx + tooltipRect.width > mRect.width) tx = e.clientX - mRect.left - tooltipRect.width - 20;
    if (ty + tooltipRect.height > mRect.height) ty = e.clientY - mRect.top - tooltipRect.height - 10;
    if (ty < 0) ty = 10;

    tooltipEl.style.left = `${tx}px`;
    tooltipEl.style.top = `${ty}px`;
};

window.hideTtWeeklyTooltip = () => {
    const tooltipEl = document.getElementById('tt-chart-tooltip');
    if (tooltipEl) tooltipEl.style.display = 'none';
};

```

## File: `static/js/target-tracker-data.js`
```js
/**
 * @fileoverview target-tracker-data.js
 * @description State vars, config, and pure data/calculation functions for Target Tracker.
 * Must load before all other target-tracker-*.js files.
 */

let _targetConfig = {
    goalStr: window.localStorage.getItem('tt_goal') || '5000',
    lotSizeStr: window.localStorage.getItem('tt_lotSize') || '65',
    maxMultStr: localStorage.getItem('tt_maxmult') || '3',
    maxPtsStr: localStorage.getItem('tt_maxpts') || '30',
    maxLossStr: localStorage.getItem('tt_maxloss') || '6000',
    expWinStr: localStorage.getItem('tt_expwin') || '15',
    expLossStr: localStorage.getItem('tt_exploss') || '5',
    avgTradesStr: localStorage.getItem('tt_avgtrades') || '3'
};

let _lastImportedTrades = null;
let _ttCurrentDate = null;
let _ttMonthlyChartType = 'line'; // default to line chart
let _ttWeeklyChartMetric = 'points'; // default comparison
let _ttWeeklyAggMode = 'total'; // 'total' or 'avg'
let _ttWeeklyChartType = 'bar'; // 'bar' or 'bell'

function getAvailableDates() {
    if (!window.state || !window.state.trades) return [];
    const ds = new Set();
    const safeNormalize = (d) => (typeof normalizeDate === 'function' ? normalizeDate(d) : d);
    const safeExtract = (t) => (typeof extractDateFromTrade === 'function' ? extractDateFromTrade(t) : (t.date || t.trade_date || t.Date || ''));

    window.state.trades.forEach(t => {
        const dStr = safeExtract(t);
        if (dStr) {
            const normalized = safeNormalize(dStr);
            if (normalized) ds.add(normalized);
        }
    });

    // Add today
    const todayStr = typeof getLocalIsoDate === 'function' ? getLocalIsoDate() : new Date().toISOString().slice(0, 10);
    ds.add(safeNormalize(todayStr));

    // Also include common dates from dayData if any
    if (window.state.dayData) {
        Object.keys(window.state.dayData).forEach(d => ds.add(safeNormalize(d)));
    }

    return Array.from(ds).sort();
}

function initTtCurrentDate() {
    if (_ttCurrentDate) return;
    const dates = getAvailableDates();
    if (dates.length > 0) {
        _ttCurrentDate = dates[dates.length - 1];
    } else {
        _ttCurrentDate = typeof getLocalIsoDate === 'function' ? getLocalIsoDate() : new Date().toISOString().slice(0, 10);
    }
}

function formatDisplayDate(dateStr) {
    if (!dateStr) return "Today";
    const todayStr = new Date().toISOString().slice(0, 10);
    if (dateStr === todayStr) return "Today";
    const d = new Date(dateStr + "T00:00:00");
    if (isNaN(d)) return dateStr;
    const m = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate();
    return `${day} ${m}`;
}

const getLocalIsoDate = () => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 10);
};

function getTodayTrades(importedTrades = null) {
    const todayStr = getLocalIsoDate();
    initTtCurrentDate();

    let possibleImported = importedTrades || _lastImportedTrades;
    let importedDate = todayStr;
    const safeNormalize = (d) => (typeof normalizeDate === 'function' ? normalizeDate(d) : d);

    // Determine the date for the imported data so we only show it on its respective day
    if (possibleImported && possibleImported.length > 0) {
        let firstTrade = possibleImported[0];
        let dTmp = firstTrade.date || firstTrade.trade_date || (typeof extractDateFromTrade === 'function' ? extractDateFromTrade(firstTrade) : '');
        if (dTmp) importedDate = safeNormalize(dTmp);
    }

    // 1. If we're looking at the date matching our imported trades, show the imported data
    if (possibleImported && possibleImported.length > 0 && _ttCurrentDate === importedDate) {
        return possibleImported;
    }

    // 2. Otherwise, leverage the central calendar logic to extract the exact day's validated data
    if (typeof getTradesForDate === 'function') {
        const result = getTradesForDate(_ttCurrentDate);
        if (result && result.length > 0) return result;
    } else if (window.state && window.state.trades && window.state.trades.length > 0) {
        const result = window.state.trades.filter(t => {
            const dStr = t.date || t.trade_date;
            return safeNormalize(dStr) === _ttCurrentDate;
        });
        if (result.length > 0) return result;
    }

    return [];
}

function getTodayNetPl(importedTrades = null) {
    let total = 0;
    const trades = getTodayTrades(importedTrades);
    trades.forEach(t => {
        let plKeyName = 'P/L';
        if (typeof PL_COLUMN !== 'undefined') plKeyName = PL_COLUMN;

        let val = t[plKeyName] || t['P/L'] || t['Gross P/L'] || t['Net P/L'] || t['Net P&L'] || t['net_pl'] || t['NetP/L'] || t['P&L'];
        if (typeof val === 'string') val = val.replace(/,/g, '');
        const pl = parseFloat(val) || 0;
        total += pl;
    });
    return total;
}

function getMonthlyPerformance(year, month) {
    let pl = 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let tradingDaysFound = 0;

    const todayStr = typeof getLocalIsoDate === 'function' ? getLocalIsoDate() : new Date().toISOString().slice(0, 10);
    const todayParsed = new Date(todayStr + "T00:00:00");
    const isCurrentMonth = (todayParsed.getFullYear() === year && todayParsed.getMonth() === month);

    let passedTradingDays = 0;
    const dailyPls = [];

    for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(year, month, d);
        const dow = dt.getDay();
        if (dow === 0 || dow === 6) continue;

        const dStr = typeof formatDate === 'function' ? formatDate(dt) : dt.toISOString().slice(0, 10);
        if (typeof getMarketHoliday === 'function' && getMarketHoliday(dStr)) continue;

        tradingDaysFound++;

        let isPassed = false;
        if (isCurrentMonth) {
            if (d <= todayParsed.getDate()) isPassed = true;
        } else {
            const lookDt = new Date(year, month, d);
            if (lookDt <= todayParsed) isPassed = true;
        }
        if (isPassed) passedTradingDays++;

        let trades = [];
        if (typeof getTradesForDate === 'function') {
             trades = getTradesForDate(dStr) || [];
        } else if (window.state && window.state.trades) {
             const safeNormalize = (x) => (typeof normalizeDate === 'function' ? normalizeDate(x) : x);
             trades = window.state.trades.filter(t => safeNormalize(t.date || t.trade_date) === dStr);
        }

        if (dStr === todayStr && _lastImportedTrades && _lastImportedTrades.length > 0) {
            trades = _lastImportedTrades;
        }

        let dailyPnl = 0;
        let dailyTradeCount = trades.length;
        let dailyPoints = 0;
        let dailyFees = 0;
        let dailyDuration = 0;

        trades.forEach(t => {
            let plKeyName = 'P/L';
            if (typeof PL_COLUMN !== 'undefined') plKeyName = PL_COLUMN;
            let val = t[plKeyName] || t['P/L'] || t['Gross P/L'] || t['Net P/L'] || t['Net P&L'] || t['net_pl'] || t['P&L'];
            if (typeof val === 'string') val = val.replace(/,/g, '');
            dailyPnl += parseFloat(val) || 0;

            const ptVal = parseFloat(String(t['Pt'] || t['Points'] || 0).replace(/,/g, '')) || 0;
            dailyPoints += ptVal;

            const feeVal = parseFloat(String(t['Brokerage'] || t['Total Fees'] || 0).replace(/,/g, '')) || 0;
            const otherVal = parseFloat(String(t['Other Charges'] || 0).replace(/,/g, '')) || 0;
            dailyFees += (feeVal + otherVal);

            // Duration calculation if available (Sell Time - Buy Time)
            if (t['Buy Time'] && t['Sell Time']) {
                try {
                    const bStr = t['Buy Time'].includes(':') ? t['Buy Time'] : '00:00:00';
                    const sStr = t['Sell Time'].includes(':') ? t['Sell Time'] : '00:00:00';
                    const b = new Date(`1970-01-01T${bStr}`);
                    const s = new Date(`1970-01-01T${sStr}`);
                    if (!isNaN(b) && !isNaN(s)) {
                        dailyDuration += (s - b) / 60000; // in minutes
                    }
                } catch(e) {}
            }
        });

        pl += dailyPnl;
        dailyPls.push({
            dateStr: dStr,
            dayNum: d,
            dailyPnl: dailyPnl,
            passed: isPassed,
            tradeCount: dailyTradeCount,
            points: dailyPoints,
            fees: dailyFees,
            duration: dailyDuration
        });
    }

    return { monthlyPnl: pl, totalTradingDays: tradingDaysFound, passedTradingDays: passedTradingDays, dailyPls: dailyPls };
}

```

## File: `static/js/target-tracker-init.js`
```js
/**
 * @fileoverview target-tracker-init.js
 * @description showTargetTrackerModal and DOMContentLoaded event bindings for Target Tracker.
 * Requires: target-tracker-data.js, target-tracker-monthly.js, target-tracker-weekly.js, target-tracker.js
 */

function showTargetTrackerModal(importedTrades = null) {
    if (importedTrades && Array.isArray(importedTrades)) {
        _lastImportedTrades = importedTrades;
    }
    const modal = document.getElementById('target-tracker-modal');
    if (!modal) return;

    // Set inputs
    const goalInp = document.getElementById('tt-goal-inp');
    const lotInp = document.getElementById('tt-lot-inp');
    const multInp = document.getElementById('tt-max-mult-inp');
    const ptsInp = document.getElementById('tt-max-pts-inp');
    const lossInp = document.getElementById('tt-max-loss-inp');
    const expWinInp = document.getElementById('tt-exp-win-inp');

    if (goalInp) goalInp.value = _targetConfig.goalStr;
    if (lotInp) lotInp.value = _targetConfig.lotSizeStr;
    if (multInp) multInp.value = _targetConfig.maxMultStr;
    if (ptsInp) ptsInp.value = _targetConfig.maxPtsStr;
    if (lossInp) lossInp.value = _targetConfig.maxLossStr;
    if (expWinInp) expWinInp.value = _targetConfig.expWinStr;
    const avgTrInp = document.getElementById('tt-avg-trades-inp');
    if (avgTrInp) avgTrInp.value = _targetConfig.avgTradesStr;

    const numBtn = document.getElementById('tt-tab-numbers');
    if (numBtn) numBtn.click();

    renderTargetTracker();
    modal.classList.add('open');
}

document.addEventListener('DOMContentLoaded', () => {
    // Input bindings
    const goalInp = document.getElementById('tt-goal-inp');
    const lotInp = document.getElementById('tt-lot-inp');
    const multInp = document.getElementById('tt-max-mult-inp');
    const ptsInp = document.getElementById('tt-max-pts-inp');
    const lossInp = document.getElementById('tt-max-loss-inp');
    const expWinInp = document.getElementById('tt-exp-win-inp');

    function switchTab(tab) {
        const numBtn = document.getElementById('tt-tab-numbers');
        const dailyBtn = document.getElementById('tt-tab-daily');
        const weeklyBtn = document.getElementById('tt-tab-weekly');
        const monthlyBtn = document.getElementById('tt-tab-monthly');
        const numView = document.getElementById('tt-numbers-view');
        const dailyView = document.getElementById('tt-daily-view');
        const weeklyView = document.getElementById('tt-weekly-view');
        const monthlyView = document.getElementById('tt-monthly-view');
        const ttModalContent = document.getElementById('tt-modal-content');

        if (numBtn) { numBtn.style.borderBottomColor = 'transparent'; numBtn.style.color = 'var(--text2)'; }
        if (dailyBtn) { dailyBtn.style.borderBottomColor = 'transparent'; dailyBtn.style.color = 'var(--text2)'; }
        if (weeklyBtn) { weeklyBtn.style.borderBottomColor = 'transparent'; weeklyBtn.style.color = 'var(--text2)'; }
        if (monthlyBtn) { monthlyBtn.style.borderBottomColor = 'transparent'; monthlyBtn.style.color = 'var(--text2)'; }

        if (numView) numView.style.display = 'none';
        if (dailyView) dailyView.style.display = 'none';
        if (weeklyView) weeklyView.style.display = 'none';
        if (monthlyView) monthlyView.style.display = 'none';

        if (tab === 'numbers') {
            if (ttModalContent) ttModalContent.style.maxWidth = '900px';
            if (numBtn) { numBtn.style.borderBottomColor = 'var(--blue)'; numBtn.style.color = 'var(--text)'; }
            if (numView) numView.style.display = 'flex';
        } else if (tab === 'daily') {
            if (ttModalContent) ttModalContent.style.maxWidth = '900px';
            if (dailyBtn) { dailyBtn.style.borderBottomColor = 'var(--blue)'; dailyBtn.style.color = 'var(--text)'; }
            if (dailyView) dailyView.style.display = 'flex';
        } else if (tab === 'weekly') {
            if (ttModalContent) ttModalContent.style.maxWidth = '900px';
            if (weeklyBtn) { weeklyBtn.style.borderBottomColor = 'var(--blue)'; weeklyBtn.style.color = 'var(--text)'; }
            if (weeklyView) weeklyView.style.display = 'flex';
            setTimeout(renderTargetTracker, 10);
        } else {
            if (ttModalContent) ttModalContent.style.maxWidth = '900px';
            if (monthlyBtn) { monthlyBtn.style.borderBottomColor = 'var(--blue)'; monthlyBtn.style.color = 'var(--text)'; }
            if (monthlyView) monthlyView.style.display = 'flex';
            setTimeout(renderTargetTracker, 10);
        }
    }

    const nBtn = document.getElementById('tt-tab-numbers');
    const dBtn = document.getElementById('tt-tab-daily');
    const wBtn = document.getElementById('tt-tab-weekly');
    const mBtn = document.getElementById('tt-tab-monthly');
    if (nBtn) nBtn.addEventListener('click', () => switchTab('numbers'));
    if (dBtn) dBtn.addEventListener('click', () => switchTab('daily'));
    if (wBtn) wBtn.addEventListener('click', () => switchTab('weekly'));
    if (mBtn) mBtn.addEventListener('click', () => switchTab('monthly'));

    // Weekly Metric Toggles
    document.querySelectorAll('.tt-metric-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tt-metric-btn').forEach(b => {
                b.classList.remove('active');
                b.style.background = 'transparent';
                b.style.color = 'var(--text2)';
            });
            e.target.classList.add('active');
            e.target.style.background = 'var(--blue)';
            e.target.style.color = '#fff';

            _ttWeeklyChartMetric = e.target.dataset.metric;
            renderTargetTracker();
        });
    });

    // Avg/Total Aggregation Toggles
    const avgToggle = document.getElementById('tt-weekly-agg-avg');
    const totalToggle = document.getElementById('tt-weekly-agg-total');

    function setAggMode(mode) {
        _ttWeeklyAggMode = mode;
        if (mode === 'avg') {
            avgToggle.classList.add('active');
            avgToggle.style.background = 'var(--blue)';
            avgToggle.style.color = '#fff';
            totalToggle.classList.remove('active');
            totalToggle.style.background = 'transparent';
            totalToggle.style.color = 'var(--text2)';
        } else {
            totalToggle.classList.add('active');
            totalToggle.style.background = 'var(--blue)';
            totalToggle.style.color = '#fff';
            avgToggle.classList.remove('active');
            avgToggle.style.background = 'transparent';
            avgToggle.style.color = 'var(--text2)';
        }
        renderTargetTracker();
    }

    if (avgToggle) avgToggle.addEventListener('click', () => setAggMode('avg'));
    if (totalToggle) totalToggle.addEventListener('click', () => setAggMode('total'));

    // Chart Type Toggles (Bar / Bell)
    const barBtn = document.getElementById('tt-weekly-type-bar');
    const bellBtn = document.getElementById('tt-weekly-type-bell');

    function setChartType(type) {
        _ttWeeklyChartType = type;
        if (type === 'bar') {
            barBtn.classList.add('active');
            barBtn.style.background = 'var(--blue)';
            barBtn.style.color = '#fff';
            bellBtn.classList.remove('active');
            bellBtn.style.background = 'transparent';
            bellBtn.style.color = 'var(--text2)';
        } else {
            bellBtn.classList.add('active');
            bellBtn.style.background = 'var(--blue)';
            bellBtn.style.color = '#fff';
            barBtn.classList.remove('active');
            barBtn.style.background = 'transparent';
            barBtn.style.color = 'var(--text2)';
        }
        renderTargetTracker();
    }

    if (barBtn) barBtn.addEventListener('click', () => setChartType('bar'));
    if (bellBtn) bellBtn.addEventListener('click', () => setChartType('bell'));

    // Simplified Sync Logic: Components drive everything
    function syncAll() {
        renderTargetTracker();
    }

    if (lotInp) {
        lotInp.addEventListener('input', (e) => {
            _targetConfig.lotSizeStr = e.target.value;
            syncAll();
        });
    }
    if (multInp) {
        multInp.addEventListener('input', (e) => {
            _targetConfig.maxMultStr = e.target.value;
            syncAll();
        });
    }
    if (ptsInp) {
        ptsInp.addEventListener('input', (e) => {
            _targetConfig.maxPtsStr = e.target.value;
            syncAll();
        });
    }
    if (lossInp) {
        lossInp.addEventListener('input', (e) => {
            _targetConfig.maxLossStr = e.target.value;
            syncAll();
        });
    }
    if (expWinInp) {
        expWinInp.addEventListener('input', (e) => {
            _targetConfig.expWinStr = e.target.value;
            renderTargetTracker();
        });
    }
    const avgTrInp = document.getElementById('tt-avg-trades-inp');
    if (avgTrInp) {
        avgTrInp.addEventListener('input', (e) => {
            _targetConfig.avgTradesStr = e.target.value;
            renderTargetTracker();
        });
    }

    // Save Button Logic
    const saveBtn = document.getElementById('tt-save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            localStorage.setItem('tt_goal', _targetConfig.goalStr);
            localStorage.setItem('tt_lotSize', _targetConfig.lotSizeStr);
            localStorage.setItem('tt_maxmult', _targetConfig.maxMultStr);
            localStorage.setItem('tt_maxpts', _targetConfig.maxPtsStr);
            localStorage.setItem('tt_maxloss', _targetConfig.maxLossStr);
            localStorage.setItem('tt_expwin', _targetConfig.expWinStr);
            localStorage.setItem('tt_avgtrades', _targetConfig.avgTradesStr);

            const oldHtml = saveBtn.innerHTML;
            saveBtn.innerHTML = '<span>\u2705</span> Saved Successfully!';
            saveBtn.style.background = '#27ae60';
            setTimeout(() => {
                saveBtn.innerHTML = oldHtml;
                saveBtn.style.background = 'var(--green)';
            }, 2000);
        });
    }

    // Stability Score Explanation Click
    const perfStatsBox = document.getElementById('tt-perf-stats-box');
    if (perfStatsBox) {
        perfStatsBox.addEventListener('click', () => {
            const msg = `Stability (P/L Strike Rate) Breakdown:\n\n` +
                `\u2022 1.00+: Superb (Over-performing)\n` +
                `\u2022 0.80 - 1.00: Steady (On Track)\n` +
                `\u2022 0.00 - 0.80: Under Pace (Catch up)\n` +
                `\u2022 Negative: Critical (Drawdown)\n\n` +
                `Strike Rate = Actual Net / Expected Target`;
            alert(msg);
        });
    }

    const closeBtn = document.getElementById('tt-close-btn');
    const btnLine = document.getElementById('tt-view-line-btn');
    const btnBar = document.getElementById('tt-view-bar-btn');

    if (btnLine) {
        btnLine.addEventListener('click', () => {
            _ttMonthlyChartType = 'line';
            btnLine.style.background = 'var(--blue)'; btnLine.style.color = '#fff';
            if (btnBar) { btnBar.style.background = 'transparent'; btnBar.style.color = 'var(--text2)'; }
            renderTargetTracker();
        });
    }
    if (btnBar) {
        btnBar.addEventListener('click', () => {
            _ttMonthlyChartType = 'bar';
            btnBar.style.background = 'var(--blue)'; btnBar.style.color = '#fff';
            if (btnLine) { btnLine.style.background = 'transparent'; btnLine.style.color = 'var(--text2)'; }
            renderTargetTracker();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const modal = document.getElementById('target-tracker-modal');
            if (modal) modal.classList.remove('open');
            if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
        });
    }

    const importBtn = document.getElementById('tt-import-zerodha-btn');
    if (importBtn) {
        importBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const rawInp = document.getElementById('raw-csv-input');
            if (rawInp) rawInp.click();
        });
    }

    const manualBtn = document.getElementById('tt-manual-btn');
    if (manualBtn) {
        manualBtn.addEventListener('click', () => {
            _ttCurrentDate = null; // Reset to latest day when opened manually
            showTargetTrackerModal(null);
        });
    }

    // Consolidated Navigation Logic
    function handleNav(dir) {
        initTtCurrentDate();
        const allDates = getAvailableDates();
        if (allDates.length <= 1) return;

        let idx = allDates.indexOf(_ttCurrentDate);
        if (idx === -1) {
            const norm = (typeof normalizeDate === 'function' ? normalizeDate(_ttCurrentDate) : _ttCurrentDate);
            idx = allDates.indexOf(norm);
            if (idx === -1) idx = allDates.length - 1;
        }

        const nextIdx = Math.min(allDates.length - 1, Math.max(0, idx + dir));
        if (nextIdx === idx) return;

        _ttCurrentDate = allDates[nextIdx];
        renderTargetTracker();
    }

    const prevBtn = document.getElementById('tt-prev-day-btn');
    const nextBtn = document.getElementById('tt-next-day-btn');
    const dp = document.getElementById('tt-date-picker');

    if (prevBtn) {
        prevBtn.onclick = (e) => { e.stopPropagation(); handleNav(-1); };
    }
    if (nextBtn) {
        nextBtn.onclick = (e) => { e.stopPropagation(); handleNav(1); };
    }
    if (dp) {
        dp.onchange = (e) => {
            if (e.target.value) {
                _ttCurrentDate = e.target.value;
                renderTargetTracker();
            }
        };
    }

    const tableTtBtn = document.getElementById('table-tt-btn');
    if (tableTtBtn) {
        tableTtBtn.addEventListener('click', () => {
            _ttCurrentDate = null;
            showTargetTrackerModal(null);
        });
    }
 
    // Gallery Tray Target Button
    const galleryTargetBtn = document.getElementById('gv2-target-pill');
    if (galleryTargetBtn) {
        galleryTargetBtn.addEventListener('click', () => {
            // Sync date from gallery
            if (state.gallery && state.gallery.date) {
                _ttCurrentDate = state.gallery.date;
            }

            showTargetTrackerModal(null);

            // Auto switch to daily tab
            const dailyBtn = document.getElementById('tt-tab-daily');
            if (dailyBtn) dailyBtn.click();
        });
    }
});

```
