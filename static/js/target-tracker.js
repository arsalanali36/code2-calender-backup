/**
 * @fileoverview target-tracker.js
 * @description Core renderTargetTracker() orchestrator — Numbers tab + Daily tab + progress UI.
 * Delegates monthly rendering to renderTtMonthlySection() and weekly to renderTtWeeklyView().
 * Requires: target-tracker-data.js, target-tracker-monthly.js, target-tracker-weekly.js
 */

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
        if (mWinDaily) mWinDaily.textContent = `\u20B9 ${Math.round(goal).toLocaleString('en-IN')}`;
        if (mWinTot) mWinTot.textContent = `\u20B9 ${Math.round(wTot).toLocaleString('en-IN')}`;

        if (mLoseD) mLoseD.textContent = expLoss;
        if (mLotL) mLotL.textContent = lotSize;
        if (mMultL) mMultL.textContent = maxMult;
        if (mPtL) mPtL.textContent = Math.round(maxPts);

        const mLoseDaily = document.getElementById('tmath-lose-daily');
        if (mLoseDaily) mLoseDaily.textContent = `\u20B9 ${Math.round(maxLoss).toLocaleString('en-IN')}`;
        if (mLoseTot) mLoseTot.textContent = `\u20B9 ${Math.round(lTot).toLocaleString('en-IN')}`;

        if (mNet) {
             mNet.textContent = `\u20B9 ${Math.round(grossNet).toLocaleString('en-IN')}`;
             mNet.style.color = 'var(--text2)';
        }

        if (mEstTax) {
             mEstTax.textContent = `- \u20B9 ${Math.round(estTax).toLocaleString('en-IN')}`;
        }

        if (mNetIncome) {
             mNetIncome.textContent = `\u20B9 ${Math.round(netIncome).toLocaleString('en-IN')}`;
             mNetIncome.style.color = netIncome >= 0 ? 'var(--green)' : 'var(--red)';
        }

        // Monthly Performance for "Actual Current"
        if (_ttCurrentDate) {
            const parts = _ttCurrentDate.split('-');
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const perf = getMonthlyPerformance(y, m);

            if (mActualCurr) {
                mActualCurr.textContent = `\u20B9 ${Math.round(perf.monthlyPnl).toLocaleString('en-IN')}`;
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

    // Update Date Counter and Navigation Arrows (Match Gallery behavior)
    const allDates = getAvailableDates();
    const dateCounter = document.getElementById('tt-date-counter');
    const pBtn = document.getElementById('tt-prev-day-btn');
    const nBtn = document.getElementById('tt-next-day-btn');

    if (allDates.length > 0 && _ttCurrentDate) {
        const safeNormalize = (d) => (typeof normalizeDate === 'function' ? normalizeDate(d) : d);
        const normCur = safeNormalize(_ttCurrentDate);
        const curIdx = allDates.indexOf(normCur);

        if (dateCounter) {
            dateCounter.textContent = `${curIdx + 1} / ${allDates.length}`;
        }

        if (pBtn) {
            pBtn.disabled = (curIdx <= 0);
            pBtn.style.opacity = pBtn.disabled ? '0.2' : '0.6';
            pBtn.style.cursor = pBtn.disabled ? 'default' : 'pointer';
        }
        if (nBtn) {
            nBtn.disabled = (curIdx >= allDates.length - 1);
            nBtn.style.opacity = nBtn.disabled ? '0.2' : '0.6';
            nBtn.style.cursor = nBtn.disabled ? 'default' : 'pointer';
        }
    }

    if (goalLabel) goalLabel.textContent = `\u20B9 ${goal.toLocaleString('en-IN')}`;

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
        achievedEl.textContent = `\u20B9 ${Math.round(achieved).toLocaleString('en-IN')}`;
        achievedEl.style.color = isLoss ? 'var(--red,#e74c3c)' : 'var(--green,#2ecc71)';
    }

    const dailyTargetDisplay = document.getElementById('tt-daily-target-display');
    if (dailyTargetDisplay) {
        dailyTargetDisplay.textContent = `\u20B9 ${Math.round(goal).toLocaleString('en-IN')}`;
    }

    if (remainingEl) {
        if (remaining > 0) {
            remainingEl.textContent = `\u20B9 ${Math.round(remaining).toLocaleString('en-IN')}`;
            remainingEl.style.color = 'var(--red,#e74c3c)';
            if (remainingLabel) remainingLabel.textContent = 'Remaining Target:';
        } else {
            const overachieved = Math.abs(remaining);
            remainingEl.textContent = `+ \u20B9 ${Math.round(overachieved).toLocaleString('en-IN')}`;
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

                const tooltip = `Trade ${idx+1}\nPoints: ${roundedRawPts}\nQty: ${qty}\nP&L: \u20B9 ${roundedPl}`;

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

    // Delegate monthly and weekly tab rendering to their own modules
    renderTtMonthlySection();
    renderTtWeeklyView();
}
