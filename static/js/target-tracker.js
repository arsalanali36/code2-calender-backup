/**
 * @fileoverview target-tracker.js
 * @description Dashboard popup showing target tracking scenarios based on imported 'today' data.
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

function getAvailableDates() {
    if (!window.state || !window.state.trades) return [];
    const dates = new Set();
    const safeNormalize = (d) => (typeof normalizeDate === 'function' ? normalizeDate(d) : d);
    window.state.trades.forEach(t => {
        const dStr = t.date || t.trade_date;
        if (dStr) dates.add(safeNormalize(dStr));
    });
    // Add today even if no trades yet
    const todayStr = typeof getLocalIsoDate === 'function' ? getLocalIsoDate() : new Date().toISOString().slice(0, 10);
    dates.add(todayStr);
    return Array.from(dates).sort();
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
        trades.forEach(t => {
            let plKeyName = 'P/L';
            if (typeof PL_COLUMN !== 'undefined') plKeyName = PL_COLUMN;
            let val = t[plKeyName] || t['P/L'] || t['Gross P/L'] || t['Net P/L'] || t['Net P&L'] || t['net_pl'] || t['P&L'];
            if (typeof val === 'string') val = val.replace(/,/g, '');
            dailyPnl += parseFloat(val) || 0;
        });
        
        pl += dailyPnl;
        dailyPls.push({ dateStr: dStr, dayNum: d, dailyPnl: dailyPnl, passed: isPassed });
    }

    return { monthlyPnl: pl, totalTradingDays: tradingDaysFound, passedTradingDays: passedTradingDays, dailyPls: dailyPls };
}

function renderTargetTracker() {
    const lotSize = parseInt(_targetConfig.lotSizeStr) || 65;
    const maxMult = parseInt(_targetConfig.maxMultStr) || 3;
    const maxPts = parseFloat(_targetConfig.maxPtsStr) || 30;

    // Component-driven Goal & Loss Calculation
    const goal = lotSize * maxMult * maxPts;
    const maxLoss = lotSize * maxMult * maxPts;
    
    // Sync config state for potential saves
    _targetConfig.goalStr = Math.round(goal).toString();
    _targetConfig.maxLossStr = Math.round(maxLoss).toString();

    const achieved = getTodayNetPl();
    const remaining = goal - achieved;

    // Update Math Reality
    const mWinD = document.getElementById('tmath-win-d');
    const mLot = document.getElementById('tmath-lot');
    const mMult = document.getElementById('tmath-mult');
    const mPt = document.getElementById('tmath-pt');
    const mWinTot = document.getElementById('tmath-win-tot');
    
    const mLoseD = document.getElementById('tmath-lose-d');
    const mLotL = document.getElementById('tmath-lot-l');
    const mMultL = document.getElementById('tmath-mult-l');
    const mPtL = document.getElementById('tmath-pt-l');
    const mLoseTot = document.getElementById('tmath-lose-tot');
    
    const mNet = document.getElementById('tmath-net');
    const mEstTax = document.getElementById('tmath-est-tax');
    const mNetIncome = document.getElementById('tmath-net-income');
    const mActualCurr = document.getElementById('tmath-actual-avg');

    if (mWinD) {
        const expWin = parseFloat(_targetConfig.expWinStr) || 15;
        const expLoss = parseFloat(_targetConfig.expLossStr) || 5;
        
        const wTot = expWin * goal;
        const lTot = expLoss * maxLoss;
        const grossNet = wTot - lTot;

        // Update Hidden Inputs
        const goalInp = document.getElementById('tt-goal-inp');
        const lossInp = document.getElementById('tt-max-loss-inp');
        if (goalInp) goalInp.value = Math.round(goal);
        if (lossInp) lossInp.value = Math.round(maxLoss);

        // TAX CALCULATION
        const avgDailyTrades = parseInt(_targetConfig.avgTradesStr) || 3;
        const totalTradesMo = (expWin + expLoss) * avgDailyTrades;
        const estTax = totalTradesMo * 65; 
        const netIncome = grossNet - estTax;

        mWinD.textContent = expWin;
        if (mLot) mLot.textContent = lotSize;
        if (mMult) mMult.textContent = maxMult;
        if (mPt) mPt.textContent = Math.round(maxPts);
        
        const mWinDaily = document.getElementById('tmath-win-daily');
        if (mWinDaily) mWinDaily.textContent = `₹ ${Math.round(goal).toLocaleString('en-IN')}`;
        if (mWinTot) mWinTot.textContent = `₹ ${Math.round(wTot).toLocaleString('en-IN')}`;
        
        if (mLoseD) mLoseD.textContent = expLoss;
        if (mLotL) mLotL.textContent = lotSize;
        if (mMultL) mMultL.textContent = maxMult; 
        if (mPtL) mPtL.textContent = Math.round(maxPts);
        
        const mLoseDaily = document.getElementById('tmath-lose-daily');
        if (mLoseDaily) mLoseDaily.textContent = `₹ ${Math.round(maxLoss).toLocaleString('en-IN')}`;
        if (mLoseTot) mLoseTot.textContent = `₹ ${Math.round(lTot).toLocaleString('en-IN')}`;
        
        if (mNet) {
             mNet.textContent = `₹ ${Math.round(grossNet).toLocaleString('en-IN')}`;
             mNet.style.color = grossNet >= 0 ? 'var(--blue)' : 'var(--red, #e74c3c)';
        }

        if (mEstTax) {
             mEstTax.textContent = `- ₹ ${Math.round(estTax).toLocaleString('en-IN')}`;
        }
        
        if (mNetIncome) {
             mNetIncome.textContent = `₹ ${Math.round(netIncome).toLocaleString('en-IN')}`;
             mNetIncome.style.color = netIncome >= 0 ? 'var(--green)' : 'var(--red)';
        }

        // Monthly Performance for "Actual Current"
        if (_ttCurrentDate) {
            const parts = _ttCurrentDate.split('-');
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const perf = getMonthlyPerformance(y, m);
            
            if (mActualCurr) {
                // To get actual NET, we should subtract the actual month's charges if available
                // But simplified for tracker:
                mActualCurr.textContent = `₹ ${Math.round(perf.monthlyPnl).toLocaleString('en-IN')}`;
                mActualCurr.style.color = perf.monthlyPnl >= 0 ? 'var(--green)' : 'var(--red)';
            }
            
            // Set auto-calculated trading days display
            const liveDaysEl = document.getElementById('tt-live-trading-days');
            if (liveDaysEl) {
                liveDaysEl.textContent = perf.totalTradingDays;
            }
        }
    }

    const achievedEl = document.getElementById('tt-achieved');
    const remainingEl = document.getElementById('tt-remaining');
    const scenariosBody = document.getElementById('tt-scenarios-body');
    const scenariosWrap = document.getElementById('tt-scenarios-wrap');

    // Progress Bar Elements
    const progressBar = document.getElementById('tt-progress-bar');
    const progressPct = document.getElementById('tt-progress-pct');
    const goalLabel = document.getElementById('tt-goal-label');

    const remainingLabel = document.getElementById('tt-remaining-label');
    const datePicker = document.getElementById('tt-date-picker');
    
    initTtCurrentDate();
    if (datePicker) datePicker.value = _ttCurrentDate;

    if (goalLabel) goalLabel.textContent = `₹ ${goal.toLocaleString('en-IN')}`;

    let pct = 0;
    const isLoss = achieved < 0;
    
    if (isLoss) {
        if (maxLoss > 0) {
            pct = (Math.abs(achieved) / maxLoss) * 100;
        }
    } else {
        if (goal > 0) {
            pct = (achieved / goal) * 100;
        }
    }
    
    // Limits
    if (pct < 0) pct = 0;
    const displayPct = Math.min(100, Math.max(0, pct));
    const pctInt = Math.floor(pct);
    
    const warningWrap = document.getElementById('tt-loss-warning');
    const warningPct = document.getElementById('tt-loss-pct');
    
    if (achieved <= -Math.abs(maxLoss) && maxLoss > 0) {
        if (warningWrap) warningWrap.style.display = 'block';
        let lp = 0;
        if (maxLoss > 0) lp = (Math.abs(achieved) / maxLoss) * 100;
        if (warningPct) warningPct.textContent = Math.round(lp);
    } else {
        if (warningWrap) warningWrap.style.display = 'none';
    }
    
    if (progressBar) {
        progressBar.style.width = `${displayPct}%`;
        progressBar.style.background = isLoss ? 'linear-gradient(90deg, #e74c3c, #c0392b)' : 'linear-gradient(90deg, #3498DB, #2ecc71)';
    }
    
    const progressText = document.getElementById('tt-progress-text');
    const displayPctStr = isLoss && pctInt > 0 ? `-${pctInt}%` : `${pctInt}%`;
    if (progressPct) progressPct.textContent = displayPctStr;
    if (progressText) progressText.textContent = displayPctStr;

    if (achievedEl) {
        achievedEl.textContent = `₹ ${Math.round(achieved).toLocaleString('en-IN')}`;
        achievedEl.style.color = isLoss ? 'var(--red,#e74c3c)' : 'var(--green,#2ecc71)';
    }
    
    const dailyTargetDisplay = document.getElementById('tt-daily-target-display');
    if (dailyTargetDisplay) {
        dailyTargetDisplay.textContent = `₹ ${Math.round(goal).toLocaleString('en-IN')}`;
    }
    
    if (remainingEl) {
        if (remaining > 0) {
            remainingEl.textContent = `₹ ${Math.round(remaining).toLocaleString('en-IN')}`;
            remainingEl.style.color = 'var(--red,#e74c3c)';
            if (remainingLabel) remainingLabel.textContent = 'Remaining Target:';
        } else {
            const overachieved = Math.abs(remaining);
            remainingEl.textContent = `+ ₹ ${Math.round(overachieved).toLocaleString('en-IN')}`;
            remainingEl.style.color = 'var(--green,#2ecc71)';
            if (remainingLabel) remainingLabel.textContent = 'Overachieved by:';
        }
    }
    
    const graphWrap = document.getElementById('tt-actual-graph-wrap');
    if (remaining <= 0) {
        if (scenariosWrap) scenariosWrap.style.display = 'none';
    } else {
        if (scenariosWrap) scenariosWrap.style.display = 'block';

        let html = '';
        const multLimit = Math.max(1, maxMult);
        for (let mult = 1; mult <= multLimit; mult++) {
            const totalQty = lotSize * mult;
            const totalPtsNeeded = remaining / totalQty;
            
            let tradesReq = 1;
            let ptsPerTrade = totalPtsNeeded;
            
            if (totalPtsNeeded > maxPts && maxPts > 0) {
                tradesReq = Math.ceil(totalPtsNeeded / maxPts);
                ptsPerTrade = totalPtsNeeded / tradesReq;
            }
            const ptsDisplay = Math.ceil(ptsPerTrade);
            
            html += `
                <tr>
                    <td style="text-align:center; padding:8px; border:1px solid var(--border)">${mult}x</td>
                    <td style="text-align:center; padding:8px; border:1px solid var(--border)">${totalQty}</td>
                    <td style="text-align:center; font-weight:bold; color:var(--blue); padding:8px; border:1px solid var(--border)">${ptsDisplay} pts</td>
                    <td style="text-align:center; padding:8px; border:1px solid var(--border)">${tradesReq} Trade${tradesReq > 1 ? 's' : ''}</td>
                </tr>
            `;
        }
        if (scenariosBody) scenariosBody.innerHTML = html;
    }

    // Render Actual Points Chart
    const barsContainer = document.getElementById('tt-actual-bars');
    const todayTrades = getTodayTrades();
    if (graphWrap && barsContainer && todayTrades && todayTrades.length > 0) {
        let maxAchievedPts = 0;
        const validTrades = [];
        
        todayTrades.forEach(t => {
            const ptStr = t['Pt'] || t['Points'] || t['pt'] || t['points'];
            if (ptStr !== undefined && ptStr !== null && ptStr !== '') {
                const pts = parseFloat(String(ptStr).replace(/,/g, ''));
                if (!isNaN(pts)) {
                    validTrades.push({ trade: t, pts: Math.abs(pts), rawPts: pts });
                    if (Math.abs(pts) > maxAchievedPts) maxAchievedPts = Math.abs(pts);
                }
            }
        });
        
        if (validTrades.length > 0) {
            graphWrap.style.display = 'block';
            let barsHtml = '';
            validTrades.forEach((item, idx) => {
                const widthPct = maxAchievedPts > 0 ? (item.pts / maxAchievedPts) * 100 : 0;
                const w = Math.max(5, widthPct);
                const roundedRawPts = Math.round(item.rawPts);
                const color = roundedRawPts >= 0 ? 'var(--green,#2ecc71)' : 'var(--red,#e74c3c)';
                const qty = item.trade['Qty'] || item.trade['Quantity'] || '-';
                
                let pl = item.trade['Net P/L'] || item.trade['P/L'] || 0;
                if (typeof pl === 'string') pl = parseFloat(pl.replace(/,/g, '')) || 0;
                const roundedPl = Math.round(pl);
                
                const tooltip = `Trade ${idx+1}\nPoints: ${roundedRawPts}\nQty: ${qty}\nP&L: ₹ ${roundedPl}`;
                
                barsHtml += `
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; width:100%;">
                        <div style="font-size:0.75rem; color:var(--text2); width:45px; text-align:right;">Trade ${idx+1}</div>
                        <div style="flex:1; height:20px; background:var(--bg3); border-radius:4px; overflow:hidden; position:relative; border:1px solid rgba(255,255,255,0.05);">
                            <div title="${tooltip}" style="height:100%; width:${w}%; background:${color}; cursor:pointer; opacity:0.85;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.85'"></div>
                        </div>
                        <div style="font-size:0.8rem; color:var(--text); width:30px; font-weight:bold;">${roundedRawPts}</div>
                    </div>
                `;
            });
            barsContainer.innerHTML = barsHtml;
            barsContainer.style.cssText = 'display:flex; flex-direction:column; gap:4px; width:100%; max-height:160px; overflow-y:auto; overflow-x:hidden;';
        } else {
            graphWrap.style.display = 'none';
        }
    } else if (graphWrap) {
        graphWrap.style.display = 'none';
    }

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
            if (overallGoalEl) overallGoalEl.textContent = `₹ ${Math.round(overallGoal).toLocaleString('en-IN')}`;
            
            const actualEl = document.getElementById('tt-month-actual');
            if (actualEl) {
                actualEl.textContent = `₹ ${Math.round(perf.monthlyPnl).toLocaleString('en-IN')}`;
                actualEl.style.color = perf.monthlyPnl >= expectedGoal ? 'var(--green,#2ecc71)' : 
                                       (perf.monthlyPnl > 0 ? 'var(--blue,#3498DB)' : 'var(--red,#e74c3c)');
            }
            
            const pacingEl = document.getElementById('tt-month-pacing');
            if (pacingEl) {
                const diff = perf.monthlyPnl - expectedGoal;
                if (diff >= 0) {
                    pacingEl.innerHTML = `<span style="color:var(--green,#2ecc71);">Ahead of schedule by ₹ ${Math.round(diff).toLocaleString('en-IN')}</span>`;
                } else {
                    pacingEl.innerHTML = `<span style="color:var(--red,#e74c3c);">Behind schedule by ₹ ${Math.round(Math.abs(diff)).toLocaleString('en-IN')}</span>`;
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
                   mRemText.textContent = `Loss: -₹ ${Math.round(Math.abs(perf.monthlyPnl)).toLocaleString('en-IN')}`;
                   mRemText.style.color = 'var(--red,#e74c3c)';
                   mRemText.style.fontWeight = 'normal';
                   mPctText.textContent = `-${Math.floor(mPct)}%`;
                } else {
                   if (overallGoal > 0) mPct = (perf.monthlyPnl / overallGoal) * 100;
                   if (mPct > 100) mPct = 100;
                   const rem = overallGoal - perf.monthlyPnl;
                   if (rem > 0) {
                      mRemText.textContent = `Remaining: ₹ ${Math.round(rem).toLocaleString('en-IN')}`;
                      mRemText.style.color = 'var(--text2)';
                      mRemText.style.fontWeight = 'normal';
                   } else {
                      mRemText.textContent = `Overachieved by: +₹ ${Math.round(Math.abs(rem)).toLocaleString('en-IN')}`;
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
                   coachRrEl.innerHTML = `<span style="font-size:0.75rem; color:var(--text2);">₹</span> ${Math.round(runRate).toLocaleString('en-IN')}<span style="font-size:0.7rem; color:var(--text2); font-weight:normal;">/d</span>`;
                   
                   let milestoneStr = `₹ ${Math.round(nextMilestone).toLocaleString('en-IN')}`;
                   if (nextMilestone === 0) milestoneStr = 'Breakeven';
                   coachMilestoneEl.innerHTML = milestoneStr;
                }

                // Coach Persona Messages
                let msg = '';
                const diff = perf.monthlyPnl - expectedGoal;

                if (targetRemaining <= 0) {
                    msg = `🎯 <strong>Goal Achieved!</strong> Incredible discipline. You've hit your monthly target ahead of time. Focus on capital preservation now. Protect your profits.`;
                } else if (perf.monthlyPnl < 0) {
                    msg = `🛡️ <strong>Defense Mode.</strong> You're in a drawdown right now. Forget the big monthly goal. Just survive. Focus purely on taking 1 high-quality trade today to build confidence back up.`;
                } else if (diff >= 0) {
                    msg = `🔥 <strong>Great Momentum!</strong> You're ahead of schedule! You only need <span style="color:var(--blue); font-weight:bold;">₹${Math.round(runRate).toLocaleString('en-IN')}</span> per day for the remaining ${daysRemaining} days. Don't force anything, let the setups come to you.`;
                } else {
                    msg = `📊 <strong>Stay Focused.</strong> You're slightly behind pace, but still in the green. Break it down fearlessly: target <span style="color:var(--blue); font-weight:bold;">₹${Math.round(runRate).toLocaleString('en-IN')}</span> per day. Stick to your A+ setups and avoid revenge trading.`;
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
                // How much of the EXPECTED goal for the passed days have we actually hit?
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
                const expWin = parseFloat(_targetConfig.expWinStr) || 0;
                const expLoss = parseFloat(_targetConfig.expLossStr) || 0;
                const wpct = (expWin / perf.totalTradingDays) * 100;
                const lpct = (expLoss / perf.totalTradingDays) * 100;
                winPctLbl.textContent = `(${Math.round(wpct)}%)`;
                lossPctLbl.textContent = `(${Math.round(lpct)}%)`;
            }

            // Render Chart
            const chartEl = document.getElementById('tt-monthly-chart');
            const legendEl = document.getElementById('tt-chart-legend');
            const titleEl = document.getElementById('tt-chart-title');
            
            if (chartEl) {
                // Clear contents
                chartEl.innerHTML = '';
                
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
                    if (range === 0) range = 1; // Prevent div zero
                    maxVal += range * 0.1;
                    minVal -= range * 0.1;
                    range = maxVal - minVal;
                    
                    let svgHtml = `<svg width="100%" height="100%" style="overflow:visible;">`;
                    
                    const len = expectedSeries.length;
                    const getX = (i) => (i / (len - 1)) * w;
                    const getY = (val) => h - (((val - minVal) / range) * h);
                    
                    // Zero line
                    svgHtml += `<line x1="0" y1="${getY(0)}" x2="${w}" y2="${getY(0)}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="4,4"/>`;
                    
                    // Expected Path
                    let expPath = `M 0,${getY(expectedSeries[0])}`;
                    for(let i=1; i<expectedSeries.length; i++) {
                        expPath += ` L ${getX(i)},${getY(expectedSeries[i])}`;
                    }
                    svgHtml += `<path d="${expPath}" fill="none" stroke="#e056fd" stroke-width="2" stroke-dasharray="4,2" />`;
                    
                    // Actual Path
                    if (actualSeries.length > 1) {
                        let actPath = `M 0,${getY(actualSeries[0])}`;
                        for(let i=1; i<actualSeries.length; i++) {
                            actPath += ` L ${getX(i)},${getY(actualSeries[i])}`;
                        }
                        svgHtml += `<path d="${actPath}" fill="none" stroke="#2ecc71" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`;
                        
                        for(let i=0; i<actualSeries.length; i++) {
                            const cx = getX(i);
                            const cy = getY(actualSeries[i]);
                            const isLast = i === actualSeries.length - 1;
                            const r = isLast ? 4 : 2.5;
                            const fillColor = actualSeries[i] >= expectedSeries[i] ? '#2ecc71' : '#e74c3c';
                            
                            const tipText = `Day ${i}\\nExpected: ₹ ${Math.round(expectedSeries[i]).toLocaleString('en-IN')}\\nActual: ₹ ${Math.round(actualSeries[i]).toLocaleString('en-IN')}`;
                            svgHtml += `<g style="cursor:crosshair;">
                                <title>${tipText}</title>
                                <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fillColor}" stroke="var(--bg2)" stroke-width="1"/>
                                <circle cx="${cx}" cy="${cy}" r="14" fill="transparent"/>
                            </g>`;
                        }
                    }
                    
                    svgHtml += `</svg>`;
                    chartEl.innerHTML = svgHtml;

                } else {
                    // BAR CHART
                    if (titleEl) titleEl.textContent = 'Daily P/L Trajectory Graph';
                    if (legendEl) legendEl.style.display = 'none';
                    
                    let maxAbs = 1;
                    perf.dailyPls.forEach(dp => {
                        if (Math.abs(dp.dailyPnl) > maxAbs) maxAbs = Math.abs(dp.dailyPnl);
                    });
                    
                    let bHtml = '<div style="display:flex; align-items:flex-end; gap:6px; width:100%; height:100%;">';
                    perf.dailyPls.forEach(dp => {
                        const hPct = (Math.abs(dp.dailyPnl) / maxAbs) * 100;
                        const h = Math.max(2, hPct) + '%';
                        const color = dp.dailyPnl >= 0 ? 'var(--green,#2ecc71)' : 'var(--red,#e74c3c)';
                        const opacity = dp.passed ? '0.85' : '0.1';
                        const cursor = dp.passed ? 'pointer' : 'default';
                        
                        const tooltip = `${dp.dateStr}\\nP&L: ₹ ${Math.round(dp.dailyPnl).toLocaleString('en-IN')}`;
                        
                        bHtml += `
                        <div style="flex:1; display:flex; flex-direction:column; align-items:center; opacity:${opacity}; min-width:14px; justify-content:flex-end; height:100%;">
                            <div title="${tooltip}" style="width:100%; height:${h}; background:${color}; border-radius:3px 3px 0 0; cursor:${cursor}; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'"></div>
                            <div style="font-size:0.6rem; color:var(--text2); margin-top:4px; height:14px;">${String(dp.dayNum).padStart(2,'0')}</div>
                        </div>`;
                    });
                    bHtml += '</div>';
                    chartEl.innerHTML = bHtml;
                }
            }
        }
    }
}

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
    const expLossInp = document.getElementById('tt-exp-loss-inp');
    
    if (goalInp) goalInp.value = _targetConfig.goalStr;
    if (lotInp) lotInp.value = _targetConfig.lotSizeStr;
    if (multInp) multInp.value = _targetConfig.maxMultStr;
    if (ptsInp) ptsInp.value = _targetConfig.maxPtsStr;
    if (lossInp) lossInp.value = _targetConfig.maxLossStr;
    if (expWinInp) expWinInp.value = _targetConfig.expWinStr;
    if (expLossInp) expLossInp.value = _targetConfig.expLossStr;
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
    const expLossInp = document.getElementById('tt-exp-loss-inp');
    
    function switchTab(tab) {
        const numBtn = document.getElementById('tt-tab-numbers');
        const dailyBtn = document.getElementById('tt-tab-daily');
        const monthlyBtn = document.getElementById('tt-tab-monthly');
        const numView = document.getElementById('tt-numbers-view');
        const dailyView = document.getElementById('tt-daily-view');
        const monthlyView = document.getElementById('tt-monthly-view');
        const ttModalContent = document.getElementById('tt-modal-content');
        
        if (numBtn) { numBtn.style.borderBottomColor = 'transparent'; numBtn.style.color = 'var(--text2)'; }
        if (dailyBtn) { dailyBtn.style.borderBottomColor = 'transparent'; dailyBtn.style.color = 'var(--text2)'; }
        if (monthlyBtn) { monthlyBtn.style.borderBottomColor = 'transparent'; monthlyBtn.style.color = 'var(--text2)'; }
        
        if (numView) numView.style.display = 'none';
        if (dailyView) dailyView.style.display = 'none';
        if (monthlyView) monthlyView.style.display = 'none';
        
        if (tab === 'numbers') {
            if (ttModalContent) ttModalContent.style.maxWidth = '900px';
            if (numBtn) { numBtn.style.borderBottomColor = 'var(--blue)'; numBtn.style.color = 'var(--text)'; }
            if (numView) numView.style.display = 'flex';
        } else if (tab === 'daily') {
            if (ttModalContent) ttModalContent.style.maxWidth = '450px';
            if (dailyBtn) { dailyBtn.style.borderBottomColor = 'var(--blue)'; dailyBtn.style.color = 'var(--text)'; }
            if (dailyView) dailyView.style.display = 'block';
        } else {
            if (ttModalContent) ttModalContent.style.maxWidth = '900px';
            if (monthlyBtn) { monthlyBtn.style.borderBottomColor = 'var(--blue)'; monthlyBtn.style.color = 'var(--text)'; }
            if (monthlyView) monthlyView.style.display = 'flex';
            // Retrigger render to draw SVG with accurate expanded width
            setTimeout(renderTargetTracker, 10);
        }
    }
    
    const nBtn = document.getElementById('tt-tab-numbers');
    const dBtn = document.getElementById('tt-tab-daily');
    const mBtn = document.getElementById('tt-tab-monthly');
    if (nBtn) nBtn.addEventListener('click', () => switchTab('numbers'));
    if (dBtn) dBtn.addEventListener('click', () => switchTab('daily'));
    if (mBtn) mBtn.addEventListener('click', () => switchTab('monthly'));

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
    if (expLossInp) {
        expLossInp.addEventListener('input', (e) => {
            _targetConfig.expLossStr = e.target.value;
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
            localStorage.setItem('tt_exploss', _targetConfig.expLossStr);
            localStorage.setItem('tt_avgtrades', _targetConfig.avgTradesStr);
            
            const oldHtml = saveBtn.innerHTML;
            saveBtn.innerHTML = '<span>✅</span> Saved Successfully!';
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
                        `• 1.00+: Superb (Over-performing)\n` +
                        `• 0.80 - 1.00: Steady (On Track)\n` +
                        `• 0.00 - 0.80: Under Pace (Catch up)\n` +
                        `• Negative: Critical (Drawdown)\n\n` +
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
        });
    }

    const manualBtn = document.getElementById('tt-manual-btn');
    if (manualBtn) {
        manualBtn.addEventListener('click', () => {
            _ttCurrentDate = null; // Reset to latest day when opened manually
            showTargetTrackerModal(null);
        });
    }

    // Date Navigation Bindings
    const prevBtn = document.getElementById('tt-prev-day-btn');
    const nextBtn = document.getElementById('tt-next-day-btn');
    const dp = document.getElementById('tt-date-picker');

    function handleNav(dir) {
        initTtCurrentDate();
        const dates = getAvailableDates();
        if (dates.length === 0) return;
        
        let idx = dates.indexOf(_ttCurrentDate);
        if (idx === -1) idx = dates.length - 1;
        
        idx += dir;
        if (idx < 0) idx = 0;
        if (idx >= dates.length) idx = dates.length - 1;
        
        _ttCurrentDate = dates[idx];
        renderTargetTracker();
    }

    if (prevBtn) prevBtn.addEventListener('click', () => handleNav(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => handleNav(1));
    
    if (dp) {
        dp.addEventListener('change', (e) => {
            if (e.target.value) {
                _ttCurrentDate = e.target.value;
                renderTargetTracker();
            }
        });
    }

    const tableTtBtn = document.getElementById('table-tt-btn');
    if (tableTtBtn) {
        tableTtBtn.addEventListener('click', () => {
             _ttCurrentDate = null;
             showTargetTrackerModal(null);
        });
    }
});
