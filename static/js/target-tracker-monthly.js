/**
 * @fileoverview target-tracker-monthly.js
 * @description Monthly tab rendering for Target Tracker.
 * Requires: target-tracker-data.js
 */

function renderTtMonthlySection() {
    const lotSize = parseInt(_targetConfig.lotSizeStr) || 65;
    const maxMult = parseInt(_targetConfig.maxMultStr) || 3;
    const maxPts = parseFloat(_targetConfig.maxPtsStr) || 30;
    const goal = lotSize * maxMult * maxPts;
    const maxLoss = lotSize * maxMult * maxPts;

    // Update Monthly Subsheet
    const mWrap = document.getElementById('tt-monthly-view');
    if (mWrap && _ttCurrentDate) {
        const parts = _ttCurrentDate.split('-');
        if (parts.length >= 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const perf = getMonthlyPerformance(y, m);

            const expWin = parseFloat(_targetConfig.expWinStr) || 15;
            const expLoss = parseFloat(_targetConfig.expLossStr) || 5;
            const totalExpDays = expWin + expLoss;
            let dailyExpectedGain = 0;
            if (totalExpDays > 0) {
               dailyExpectedGain = ((goal * expWin) - (maxLoss * expLoss)) / totalExpDays;
            } else {
               dailyExpectedGain = goal;
            }

            const expectedGoal = perf.passedTradingDays * dailyExpectedGain;
            const overallGoal = perf.totalTradingDays * dailyExpectedGain;

            const daysStrEl = document.getElementById('tt-month-days-str');
            if (daysStrEl) daysStrEl.textContent = `${perf.passedTradingDays} / ${perf.totalTradingDays}`;

            const overallGoalEl = document.getElementById('tt-month-overall-goal');
            if (overallGoalEl) overallGoalEl.textContent = `\u20B9 ${Math.round(overallGoal).toLocaleString('en-IN')}`;

            const actualEl = document.getElementById('tt-month-actual');
            if (actualEl) {
                actualEl.textContent = `\u20B9 ${Math.round(perf.monthlyPnl).toLocaleString('en-IN')}`;
                actualEl.style.color = perf.monthlyPnl >= expectedGoal ? 'var(--green,#2ecc71)' :
                                       (perf.monthlyPnl > 0 ? 'var(--blue,#3498DB)' : 'var(--red,#e74c3c)');
            }

            const pacingEl = document.getElementById('tt-month-pacing');
            if (pacingEl) {
                const diff = perf.monthlyPnl - expectedGoal;
                if (diff >= 0) {
                    pacingEl.innerHTML = `<span style="color:var(--green,#2ecc71);">Ahead of schedule by \u20B9 ${Math.round(diff).toLocaleString('en-IN')}</span>`;
                } else {
                    pacingEl.innerHTML = `<span style="color:var(--red,#e74c3c);">Behind schedule by \u20B9 ${Math.round(Math.abs(diff)).toLocaleString('en-IN')}</span>`;
                }
            }

            // MONTHLY SLIDER Updates
            const mBar = document.getElementById('tt-month-progress-bar');
            const mPctText = document.getElementById('tt-month-progress-text');
            const mRemText = document.getElementById('tt-month-remaining-text');

            if (mBar && mPctText && mRemText) {
                let mPct = 0;
                let bgGradient = 'linear-gradient(90deg, #3498DB, #2ecc71)';
                if (perf.monthlyPnl < 0) {
                   const maxMonthLoss = perf.totalTradingDays * maxLoss;
                   mPct = maxMonthLoss > 0 ? (Math.abs(perf.monthlyPnl) / maxMonthLoss) * 100 : 0;
                   if (mPct > 100) mPct = 100;
                   bgGradient = 'linear-gradient(90deg, #e74c3c, #c0392b)';
                   mRemText.textContent = `Loss: -\u20B9 ${Math.round(Math.abs(perf.monthlyPnl)).toLocaleString('en-IN')}`;
                   mRemText.style.color = 'var(--red,#e74c3c)';
                   mRemText.style.fontWeight = 'normal';
                   mPctText.textContent = `-${Math.floor(mPct)}%`;
                } else {
                   if (overallGoal > 0) mPct = (perf.monthlyPnl / overallGoal) * 100;
                   if (mPct > 100) mPct = 100;
                   const rem = overallGoal - perf.monthlyPnl;
                   if (rem > 0) {
                      mRemText.textContent = `Remaining: \u20B9 ${Math.round(rem).toLocaleString('en-IN')}`;
                      mRemText.style.color = 'var(--text2)';
                      mRemText.style.fontWeight = 'normal';
                   } else {
                      mRemText.textContent = `Overachieved by: +\u20B9 ${Math.round(Math.abs(rem)).toLocaleString('en-IN')}`;
                      mRemText.style.color = 'var(--green,#2ecc71)';
                      mRemText.style.fontWeight = 'bold';
                   }
                   mPctText.textContent = `${Math.floor(mPct)}%`;
                }
                mBar.style.width = `${Math.floor(mPct)}%`;
                mBar.style.background = bgGradient;
            }

            // AI Coach Logic
            const coachMsgEl = document.getElementById('tt-coach-message');
            const coachRrEl = document.getElementById('tt-coach-rr');
            const coachMilestoneEl = document.getElementById('tt-coach-milestone');
            const coachMetricsBox = document.getElementById('tt-coach-metrics');

            if (coachMsgEl && coachRrEl && coachMilestoneEl && coachMetricsBox) {
                const daysRemaining = Math.max(0, perf.totalTradingDays - perf.passedTradingDays);
                const targetRemaining = overallGoal - perf.monthlyPnl;

                let runRate = 0;
                if (daysRemaining > 0) {
                    runRate = targetRemaining / daysRemaining;
                } else {
                    runRate = targetRemaining;
                }

                // Calculate next milestone (quarters of overall goal)
                let nextMilestone = 0;
                if (perf.monthlyPnl < 0) {
                    nextMilestone = 0; // Breakeven
                } else {
                    const quarter = overallGoal / 4;
                    for (let i = 1; i <= 4; i++) {
                        if (perf.monthlyPnl < quarter * i) {
                            nextMilestone = quarter * i;
                            break;
                        }
                    }
                    if (perf.monthlyPnl >= overallGoal) nextMilestone = overallGoal; // Already hit
                }

                // Update UI Metrics
                if (targetRemaining <= 0) {
                   coachMetricsBox.style.display = 'none';
                } else {
                   coachMetricsBox.style.display = 'flex';
                   coachRrEl.innerHTML = `<span style="font-size:0.75rem; color:var(--text2);">\u20B9</span> ${Math.round(runRate).toLocaleString('en-IN')}<span style="font-size:0.7rem; color:var(--text2); font-weight:normal;">/d</span>`;

                   let milestoneStr = `\u20B9 ${Math.round(nextMilestone).toLocaleString('en-IN')}`;
                   if (nextMilestone === 0) milestoneStr = 'Breakeven';
                   coachMilestoneEl.innerHTML = milestoneStr;
                }

                // Coach Persona Messages
                let msg = '';
                const diff = perf.monthlyPnl - expectedGoal;

                if (targetRemaining <= 0) {
                    msg = `\uD83C\uDFAF <strong>Goal Achieved!</strong> Incredible discipline. You've hit your monthly target ahead of time. Focus on capital preservation now. Protect your profits.`;
                } else if (perf.monthlyPnl < 0) {
                    msg = `\uD83D\uDEE1\uFE0F <strong>Defense Mode.</strong> You're in a drawdown right now. Forget the big monthly goal. Just survive. Focus purely on taking 1 high-quality trade today to build confidence back up.`;
                } else if (diff >= 0) {
                    msg = `\uD83D\uDD25 <strong>Great Momentum!</strong> You're ahead of schedule! You only need <span style="color:var(--blue); font-weight:bold;">\u20B9${Math.round(runRate).toLocaleString('en-IN')}</span> per day for the remaining ${daysRemaining} days. Don't force anything, let the setups come to you.`;
                } else {
                    msg = `\uD83D\uDCCA <strong>Stay Focused.</strong> You're slightly behind pace, but still in the green. Break it down fearlessly: target <span style="color:var(--blue); font-weight:bold;">\u20B9${Math.round(runRate).toLocaleString('en-IN')}</span> per day. Stick to your A+ setups and avoid revenge trading.`;
                }

                // Set coach box styling dynamically
                const coachCard = coachMsgEl.closest('.coach-card');
                if (coachCard) {
                    if (targetRemaining <= 0) {
                        coachCard.style.background = 'linear-gradient(135deg, rgba(46,204,113,0.1), rgba(46,204,113,0.02))';
                        coachCard.style.borderColor = 'rgba(46,204,113,0.3)';
                    } else if (perf.monthlyPnl < 0) {
                        coachCard.style.background = 'linear-gradient(135deg, rgba(231,76,60,0.1), rgba(231,76,60,0.02))';
                        coachCard.style.borderColor = 'rgba(231,76,60,0.3)';
                    } else if (diff >= 0) {
                        coachCard.style.background = 'linear-gradient(135deg, rgba(52,152,219,0.1), rgba(46,204,113,0.05))';
                        coachCard.style.borderColor = 'rgba(52,152,219,0.3)';
                    } else {
                        coachCard.style.background = 'linear-gradient(135deg, rgba(243,156,18,0.1), rgba(243,156,18,0.02))';
                        coachCard.style.borderColor = 'rgba(243,156,18,0.3)';
                    }
                }

                coachMsgEl.innerHTML = msg;
            }

            // Calculation for Performance Stats (actual strike rate etc)
            const winRateEl = document.getElementById('tt-stat-winrate');
            const winRateDesc = document.getElementById('tt-stat-winrate-desc');
            const avgPtsEl = document.getElementById('tt-stat-avgpts');
            const strikeRateEl = document.getElementById('tt-stat-strikerate');
            const strikeRateStatus = document.getElementById('tt-stat-status-text');

            if (winRateEl) {
                let winDays = 0;
                let totalPts = 0;
                let totalTrades = 0;

                perf.dailyPls.forEach(dp => {
                    if (dp.passed) {
                        if (dp.dailyPnl > 0) winDays++;

                        // Get points for trades in this month
                        const dStr = dp.dateStr;
                        let tForDay = [];
                        if (typeof getTradesForDate === 'function') {
                            tForDay = getTradesForDate(dStr) || [];
                        }
                        tForDay.forEach(t => {
                            const ptStr = t['Pt'] || t['Points'] || t['pt'] || t['points'];
                            if (ptStr !== undefined) {
                                const pts = parseFloat(String(ptStr).replace(/,/g, ''));
                                if (!isNaN(pts)) {
                                    totalPts += pts;
                                    totalTrades++;
                                }
                            }
                        });
                    }
                });

                // Win Rate
                const wr = perf.passedTradingDays > 0 ? (winDays / perf.passedTradingDays) * 100 : 0;
                winRateEl.textContent = `${Math.round(wr)}%`;
                if (winRateDesc) winRateDesc.textContent = `${winDays} of ${perf.passedTradingDays} Trading Days`;

                // Avg Pts
                const avgP = totalTrades > 0 ? totalPts / totalTrades : 0;
                if (avgPtsEl) avgPtsEl.textContent = avgP.toFixed(1);

                // P/L Strike Rate (Pacing vs Goal)
                const strikeR = expectedGoal !== 0 ? (perf.monthlyPnl / expectedGoal) : 0;
                if (strikeRateEl) strikeRateEl.textContent = strikeR.toFixed(2);

                if (strikeRateStatus) {
                    if (strikeR >= 1.2) strikeRateStatus.innerHTML = '<span style="color:var(--green)">Stability: Superb (Over-performing)</span>';
                    else if (strikeR >= 0.8) strikeRateStatus.innerHTML = '<span style="color:var(--blue)">Stability: Steady (On Track)</span>';
                    else if (strikeR > 0) strikeRateStatus.innerHTML = '<span style="color:var(--orange,#f39c12)">Stability: Under Pace (Catch up)</span>';
                    else strikeRateStatus.innerHTML = '<span style="color:var(--red,#e74c3c)">Stability: Critical (Drawdown)</span>';
                }
            }

            // Also update Planning Win % in Numbers tab
            const winPctLbl = document.getElementById('tt-win-pct-label');
            const lossPctLbl = document.getElementById('tt-loss-pct-label');
            if (winPctLbl && lossPctLbl && perf.totalTradingDays > 0) {
                const expWin2 = parseFloat(_targetConfig.expWinStr) || 0;
                const expLoss2 = parseFloat(_targetConfig.expLossStr) || 0;
                const wpct = (expWin2 / perf.totalTradingDays) * 100;
                const lpct = (expLoss2 / perf.totalTradingDays) * 100;
                winPctLbl.textContent = `(${Math.round(wpct)}%)`;
                lossPctLbl.textContent = `(${Math.round(lpct)}%)`;
            }

            // Render Chart
            const chartEl = document.getElementById('tt-monthly-chart');
            const legendEl = document.getElementById('tt-chart-legend');
            const titleEl = document.getElementById('tt-chart-title');
            const tooltipEl = document.getElementById('tt-chart-tooltip');

            if (chartEl) {
                // Clear contents
                chartEl.innerHTML = '';
                if (tooltipEl) tooltipEl.style.display = 'none';

                if (_ttMonthlyChartType === 'line') {
                    if (titleEl) titleEl.textContent = 'Expected vs Actual Cumulative';
                    if (legendEl) legendEl.style.display = 'flex';

                    const w = Math.max(1, chartEl.clientWidth) || 300;
                    const h = Math.max(1, chartEl.clientHeight) || 180;

                    let expectedSeries = [0];
                    let actualSeries = [0];
                    let curExpected = 0;
                    let curActual = 0;

                    perf.dailyPls.forEach((dp) => {
                        curExpected += dailyExpectedGain;
                        expectedSeries.push(curExpected);
                        if (dp.passed) {
                            curActual += dp.dailyPnl;
                            actualSeries.push(curActual);
                        }
                    });

                    let maxVal = Math.max(...expectedSeries, ...actualSeries, overallGoal, 0);
                    let minVal = Math.min(...expectedSeries, ...actualSeries, 0);

                    let range = maxVal - minVal;
                    if (range === 0) range = 1;
                    maxVal += range * 0.1;
                    minVal -= range * 0.1;
                    range = maxVal - minVal;

                    const len = expectedSeries.length;
                    const getX = (i) => (i / (len - 1)) * w;
                    const getY = (val) => h - (((val - minVal) / range) * h);

                    let svgHtml = `<svg width="100%" height="100%" filter="drop-shadow(0 0 10px rgba(0,0,0,0.5))" style="overflow:visible; touch-action:none;">`;

                    // Zero line
                    svgHtml += `<line x1="0" y1="${getY(0)}" x2="${w}" y2="${getY(0)}" stroke="rgba(255,255,255,0.1)" stroke-width="1" stroke-dasharray="4,4"/>`;

                    // Paths
                    let expPath = `M 0,${getY(expectedSeries[0])}`;
                    for(let i=1; i<expectedSeries.length; i++) expPath += ` L ${getX(i)},${getY(expectedSeries[i])}`;
                    svgHtml += `<path d="${expPath}" fill="none" stroke="#e056fd" stroke-width="1.5" stroke-dasharray="5,3" style="opacity:0.6;" />`;

                    if (actualSeries.length > 1) {
                        let actPath = `M 0,${getY(actualSeries[0])}`;
                        for(let i=1; i<actualSeries.length; i++) actPath += ` L ${getX(i)},${getY(actualSeries[i])}`;
                        svgHtml += `<path d="${actPath}" fill="none" stroke="#2ecc71" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 8px rgba(46,204,113,0.3));" />`;
                    }

                    // Milestones (per user request: end of each week)
                    let currentWeek = 1;
                    perf.dailyPls.forEach((dp, idx) => {
                        const dt = new Date(dp.dateStr + "T00:00:00");
                        if (dt.getDay() === 5 || idx === perf.dailyPls.length - 1) { // Friday or last day of month
                            const expectedAtWeekEnd = (idx + 1) * dailyExpectedGain;
                            const my = getY(expectedAtWeekEnd);
                            if (my >= 0 && my <= h) {
                                svgHtml += `
                                    <line x1="0" y1="${my}" x2="${w}" y2="${my}" stroke="#f85149" stroke-width="1.5" stroke-dasharray="8,4" opacity="0.3" />
                                    <rect x="${w - 120}" y="${my - 18}" width="120" height="16" fill="rgba(20,20,25,0.7)" rx="4" />
                                    <text x="${w - 5}" y="${my - 6}" fill="#f85149" font-size="10" font-weight="bold" text-anchor="end" style="letter-spacing:0.5px;">Week ${currentWeek} End: \u20B9${Math.round(expectedAtWeekEnd).toLocaleString('en-IN')}</text>
                                `;
                            }
                            currentWeek++;
                        }
                    });

                    // Interaction Layer
                    svgHtml += `<line id="tt-crosshair" x1="0" y1="0" x2="0" y2="${h}" stroke="rgba(255,255,255,0.3)" stroke-width="1" style="display:none;" />`;
                    svgHtml += `<circle id="tt-hover-circle" r="6" fill="#fff" stroke="#2ecc71" stroke-width="2" style="display:none; filter:drop-shadow(0 0 5px rgba(255,255,255,0.8));" />`;

                    svgHtml += `</svg>`;
                    chartEl.innerHTML = svgHtml;

                    // INTERACTIVITY HANDLER
                    const crosshair = document.getElementById('tt-crosshair');
                    const hoverCircle = document.getElementById('tt-hover-circle');

                    chartEl.onmousemove = (e) => {
                       const rect = chartEl.getBoundingClientRect();
                       const mx = e.clientX - rect.left;

                       const idx = Math.min(len-1, Math.max(0, Math.round((mx / w) * (len - 1))));
                       const cx = getX(idx);
                       const cy = getY(actualSeries[idx] !== undefined ? actualSeries[idx] : 0);

                       if (crosshair) {
                          crosshair.setAttribute('x1', cx);
                          crosshair.setAttribute('x2', cx);
                          crosshair.style.display = 'block';
                       }

                       if (idx < actualSeries.length && hoverCircle) {
                           hoverCircle.setAttribute('cx', cx);
                           hoverCircle.setAttribute('cy', cy);
                           hoverCircle.style.display = 'block';
                       } else if (hoverCircle) {
                           hoverCircle.style.display = 'none';
                       }

                       if (tooltipEl) {
                          const dateStr = idx === 0 ? "Initial" : (perf.dailyPls[idx-1] ? perf.dailyPls[idx-1].dateStr : `Day ${idx}`);
                          const actualVal = actualSeries[idx] !== undefined ? actualSeries[idx] : null;
                          const expectedVal = expectedSeries[idx];
                          const diff = actualVal !== null ? (actualVal - expectedVal) : null;

                          let tipContent = `
                            <div style="font-weight:bold; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px; color:var(--blue);">${dateStr}</div>
                            <div style="display:flex; justify-content:space-between; gap:20px; margin-bottom:4px;">
                                <span style="opacity:0.7;">Expected:</span>
                                <span style="font-family:monospace; font-weight:bold;">\u20B9 ${Math.round(expectedVal).toLocaleString('en-IN')}</span>
                            </div>`;

                          if (actualVal !== null) {
                             tipContent += `
                                <div style="display:flex; justify-content:space-between; gap:20px; margin-bottom:4px;">
                                    <span style="opacity:0.7;">Actual:</span>
                                    <span style="font-family:monospace; font-weight:bold; color:var(--green);">\u20B9 ${Math.round(actualVal).toLocaleString('en-IN')}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; gap:20px; margin-top:8px; font-weight:bold;">
                                    <span style="opacity:0.7;">Variance:</span>
                                    <span style="font-family:monospace; color:${diff >= 0 ? 'var(--green)' : 'var(--red)'};">${diff >= 0 ? '+' : ''}\u20B9 ${Math.round(diff).toLocaleString('en-IN')}</span>
                                </div>
                             `;
                          } else {
                             tipContent += `<div style="font-style:italic; opacity:0.5; margin-top:8px;">Target Projection</div>`;
                          }

                          tooltipEl.innerHTML = tipContent;
                          tooltipEl.style.display = 'block';

                          const tooltipRect = tooltipEl.getBoundingClientRect();
                          let tx = cx + 20;
                          let ty = cy - 20;
                          if (tx + tooltipRect.width > rect.width) tx = cx - tooltipRect.width - 20;
                          if (ty + tooltipRect.height > rect.height) ty = rect.height - tooltipRect.height - 10;

                          tooltipEl.style.left = `${tx}px`;
                          tooltipEl.style.top = `${ty}px`;
                       }
                    };

                    chartEl.onmouseleave = () => {
                       if (crosshair) crosshair.style.display = 'none';
                       if (hoverCircle) hoverCircle.style.display = 'none';
                       if (tooltipEl) tooltipEl.style.display = 'none';
                    };

                } else {
                    // BAR CHART
                    if (titleEl) titleEl.textContent = 'Daily P/L Trajectory Graph';
                    if (legendEl) legendEl.style.display = 'none';

                    let maxAbs = 1;
                    perf.dailyPls.forEach(dp => {
                        if (Math.abs(dp.dailyPnl) > maxAbs) maxAbs = Math.abs(dp.dailyPnl);
                    });

                    let bHtml = '<div style="display:flex; align-items:flex-end; gap:6px; width:100%; height:100%; touch-action:none;">';
                    perf.dailyPls.forEach((dp, i) => {
                        const hPct = (Math.abs(dp.dailyPnl) / maxAbs) * 100;
                        const h = Math.max(2, hPct) + '%';
                        const color = dp.dailyPnl >= 0 ? 'var(--green,#2ecc71)' : 'var(--red,#e74c3c)';
                        const opacity = dp.passed ? '0.85' : '0.1';
                        const cursor = dp.passed ? 'pointer' : 'default';

                        bHtml += `
                        <div class="tt-bar" data-idx="${i}" style="flex:1; display:flex; flex-direction:column; align-items:center; opacity:${opacity}; min-width:14px; justify-content:flex-end; height:100%; transition:all 0.2s;">
                            <div style="width:100%; height:${h}; background:${color}; border-radius:3px 3px 0 0; cursor:${cursor}; filter:drop-shadow(0 0 5px rgba(0,0,0,0.1));"></div>
                            <div style="font-size:0.6rem; color:var(--text2); margin-top:4px; height:14px;">${String(dp.dayNum).padStart(2,'0')}</div>
                        </div>`;
                    });
                    bHtml += '</div>';
                    chartEl.innerHTML = bHtml;

                    // Bar tooltips handler (event delegation)
                    chartEl.onmousemove = (e) => {
                        const bar = e.target.closest('.tt-bar');
                        if (bar) {
                            const idx = parseInt(bar.dataset.idx);
                            const dp = perf.dailyPls[idx];
                            if (dp && tooltipEl) {
                                tooltipEl.innerHTML = `
                                    <div style="font-weight:bold; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px; color:var(--blue);">${dp.dateStr}</div>
                                    <div style="display:flex; justify-content:space-between; gap:20px; font-weight:bold;">
                                        <span style="opacity:0.7;">P/L:</span>
                                        <span style="font-family:monospace; color:${dp.dailyPnl >= 0 ? 'var(--green)' : 'var(--red)'};">\u20B9 ${Math.round(dp.dailyPnl).toLocaleString('en-IN')}</span>
                                    </div>
                                    <div style="font-size:0.7rem; opacity:0.5; margin-top:10px;">${dp.passed ? 'Verified Session' : 'Future Target'}</div>
                                `;
                                tooltipEl.style.display = 'block';

                                const rect = chartEl.getBoundingClientRect();
                                const br = bar.getBoundingClientRect();
                                let tx = (br.left - rect.left) + (br.width / 2);
                                let ty = (br.top - rect.top) - 10;

                                const tooltipRect = tooltipEl.getBoundingClientRect();
                                if (tx + tooltipRect.width/2 > rect.width) tx = rect.width - tooltipRect.width/2 - 10;
                                if (tx - tooltipRect.width/2 < 0) tx = tooltipRect.width/2 + 10;

                                tooltipEl.style.left = `${tx - tooltipRect.width/2}px`;
                                tooltipEl.style.top = `${ty - tooltipRect.height}px`;
                            }
                        } else if (tooltipEl) {
                            tooltipEl.style.display = 'none';
                        }
                    };
                    chartEl.onmouseleave = () => { if (tooltipEl) tooltipEl.style.display = 'none'; };
                }
            }
        }
    }
}
