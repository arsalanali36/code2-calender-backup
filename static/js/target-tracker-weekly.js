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
