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

    // --- Compute live trading days first so expLoss can be auto-derived ---
    let liveTradingDays = 0;
    if (_ttCurrentDate) {
        const parts = _ttCurrentDate.split('-');
        const cy = parseInt(parts[0], 10);
        const cm = parseInt(parts[1], 10) - 1;
        const perf = getMonthlyPerformance(cy, cm);
        liveTradingDays = perf.totalTradingDays || 0;

        const liveDaysEl = document.getElementById('tt-live-trading-days');
        if (liveDaysEl) liveDaysEl.textContent = liveTradingDays;

        if (mActualCurr) {
            mActualCurr.textContent = `\u20B9 ${Math.round(perf.monthlyPnl).toLocaleString('en-IN')}`;
            mActualCurr.style.color = perf.monthlyPnl >= 0 ? 'var(--green)' : 'var(--red)';
        }
    }

    if (mWinD) {
        const expWin = parseFloat(_targetConfig.expWinStr) || 15;
        // expLoss = remaining days (total - win). Never goes below 0.
        const expLoss = Math.max(0, liveTradingDays - expWin);
        // Propagate so monthly/weekly modules pick it up automatically
        _targetConfig.expLossStr = expLoss.toString();

        // Update auto loss-days display
        const lossDisplay = document.getElementById('tt-exp-loss-display');
        if (lossDisplay) lossDisplay.textContent = expLoss;

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

        // --- Safety Scenario ---
        // ① Each loss day = 2× daily target loss (extra loss vs base)
        const safeDoubleLossExtra = expLoss * maxLoss; // extra 1× per loss day on top of base
        // ② 2 extra loss days at the 2× rate
        const safeExtraDaysLoss = 2 * (2 * maxLoss);
        // ③ +2 avg trades/day → extra tax
        const safeTotalTrades = (expWin + expLoss + 2) * (avgDailyTrades + 2) * 65;
        const baseTradesTax = totalTradesMo * 65; // already computed above
        const safeExtraTax = safeTotalTrades - baseTradesTax;

        const safeNet = netIncome - safeDoubleLossExtra - safeExtraDaysLoss - safeExtraTax;
        const fmtR = v => `- \u20B9 ${Math.round(v).toLocaleString('en-IN')}`;

        const el1 = document.getElementById('tsafe-double-loss');
        const el2 = document.getElementById('tsafe-extra-days');
        const el3 = document.getElementById('tsafe-extra-tax');
        const el4 = document.getElementById('tsafe-net');
        if (el1) el1.textContent = fmtR(safeDoubleLossExtra);
        if (el2) el2.textContent = fmtR(safeExtraDaysLoss);
        if (el3) el3.textContent = fmtR(safeExtraTax);
        if (el4) {
            el4.textContent = `\u20B9 ${Math.round(safeNet).toLocaleString('en-IN')}`;
            el4.style.color = safeNet >= 0 ? 'var(--green)' : 'var(--red)';
        }
    }

    renderMultTable();

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
            const ptsDisplay = Math.ceil(totalPtsNeeded);
            const tradesReq = (maxPts > 0) ? Math.ceil(totalPtsNeeded / maxPts) : 1;

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

        // Update Total Pt, Actual Tax, and Net PL from Trade Table values
        const totalPtsEl = document.getElementById('tt-total-pts');
        const todayTaxEl = document.getElementById('tt-today-tax');
        const achievedEl = document.getElementById('tt-achieved');

        let sumPts = 0;
        let sumActualTax = 0;
        let sumActualGross = 0;

        validTrades.forEach(item => {
            const t = item.trade;
            sumPts += item.rawPts;

            // Accurate Fee/Tax Calculation (Mirroring getMonthlyPerformance)
            const feeVal = parseFloat(String(t['Brokerage'] || t['Total Fees'] || t['Fee'] || t['Charges'] || 0).replace(/,/g, '')) || 0;
            const otherVal = parseFloat(String(t['Other Charges'] || 0).replace(/,/g, '')) || 0;
            sumActualTax += (feeVal + otherVal);

            // Gross P/L
            const gVal = t['Gross P/L'] || t['P/L'] || t['Rs'] || t['rs'] || t['P&L'] || 0;
            sumActualGross += (typeof gVal === 'string' ? parseFloat(gVal.replace(/,/g, '')) : parseFloat(gVal)) || 0;
        });

        const sumActualNet = sumActualGross - sumActualTax;

        if (totalPtsEl) {
            totalPtsEl.textContent = Math.round(sumPts);
            totalPtsEl.style.color = sumPts >= 0 ? 'var(--green)' : 'var(--red)';
        }

        const dailyTargetDisplay = document.getElementById('tt-daily-target-display');
        const goal = parseFloat(_targetConfig.goalStr) || 1;
        const lotSize = parseInt(_targetConfig.lotSizeStr) || 65;

        if (dailyTargetDisplay) {
            dailyTargetDisplay.textContent = `\u20B9 ${Math.round(goal).toLocaleString('en-IN')}`;
        }

        if (todayTaxEl) {
            todayTaxEl.textContent = `- \u20B9 ${Math.round(sumActualTax).toLocaleString('en-IN')}`;
        }

        // Override the 'achieved' display with actual Net P/L if trades exist
        if (achievedEl && validTrades.length > 0) {
            achievedEl.textContent = `\u20B9 ${Math.round(sumActualNet).toLocaleString('en-IN')}`;
            achievedEl.style.color = sumActualNet >= 0 ? 'var(--green,#2ecc71)' : 'var(--red,#e74c3c)';

            // Re-sync progress bar based on actual Net
            const isLoss = sumActualNet < 0;
            const maxLoss = parseFloat(_targetConfig.maxLossStr) || 1;
            let pct = isLoss ? (Math.abs(sumActualNet) / maxLoss) * 100 : (sumActualNet / goal) * 100;
            pct = Math.max(0, pct);
            const displayPct = Math.min(100, pct);
            const pctInt = Math.floor(pct);

            const progressBar = document.getElementById('tt-progress-bar');
            const progressText = document.getElementById('tt-progress-text');
            const progressPct = document.getElementById('tt-progress-pct');

            if (progressBar) {
                progressBar.style.width = `${displayPct}%`;
                progressBar.style.background = isLoss ? 'linear-gradient(90deg, #e74c3c, #c0392b)' : 'linear-gradient(90deg, #3498DB, #2ecc71)';
            }
            const displayPctStr = isLoss && pctInt > 0 ? `-${pctInt}%` : `${pctInt}%`;
            if (progressText) progressText.textContent = displayPctStr;
            if (progressPct) progressPct.textContent = `${displayPctStr} Achieved`;

            // Update remaining
            const remainingEl = document.getElementById('tt-remaining');
            const remainingLabel = document.getElementById('tt-remaining-label');
            const remainingVal = goal - sumActualNet;

            if (remainingEl) {
                if (remainingVal > 0) {
                    remainingEl.textContent = `\u20B9 ${Math.round(remainingVal).toLocaleString('en-IN')}`;
                    remainingEl.style.color = 'var(--red,#e74c3c)';
                    if (remainingLabel) remainingLabel.textContent = 'Remaining:';
                } else {
                    remainingEl.textContent = `+ \u20B9 ${Math.round(Math.abs(remainingVal)).toLocaleString('en-IN')}`;
                    remainingEl.style.color = 'var(--green,#2ecc71)';
                    if (remainingLabel) remainingLabel.textContent = 'Overachieved:';
                }
            }
        }

        if (validTrades.length > 0) {
            graphWrap.style.display = 'block';
            let barsHtml = '';
            validTrades.forEach((item, idx) => {
                const widthPct = maxAchievedPts > 0 ? (item.pts / maxAchievedPts) * 100 : 0;
                const w = Math.max(5, widthPct);
                const roundedRawPts = Math.round(item.rawPts);
                const color = roundedRawPts >= 0 ? 'var(--green,#2ecc71)' : 'var(--red,#e74c3c)';
                const qtyVal = item.trade['Qty'] || item.trade['Quantity'] || 0;
                const qty = (typeof qtyVal === 'string' ? parseInt(qtyVal.replace(/,/g, '')) : parseInt(qtyVal)) || 0;

                const currentLotSize = parseInt(_targetConfig.lotSizeStr) || 65;
                const mult = qty > 0 ? Math.round(qty / currentLotSize) : 0;
                const multStr = mult > 0 ? `${mult}x` : '—';
                const isSpecial = mult >= 3;
                const badgeStyle = isSpecial
                    ? 'color:#f39c12; background:rgba(243, 156, 18, 0.1); border:1px solid rgba(243, 156, 18, 0.3); font-weight:bold;'
                    : 'color:var(--text2); background:var(--bg3); border:1px solid var(--border);';

                let pl = item.trade['Net P/L'] || item.trade['P/L'] || 0;
                if (typeof pl === 'string') pl = parseFloat(pl.replace(/,/g, '')) || 0;
                const roundedPl = Math.round(pl);

                const tooltip = `Trade ${idx + 1}\nPoints: ${roundedRawPts}\nQty: ${qty}\nLot: ${multStr}\nP&L: \u20B9 ${roundedPl}`;

                barsHtml += `
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; width:100%;">
                        <div style="font-size:0.75rem; color:var(--text2); width:45px; text-align:right;">Trade ${idx + 1}</div>
                        <div style="flex:1; height:20px; background:var(--bg3); border-radius:4px; overflow:hidden; position:relative; border:1px solid rgba(255,255,255,0.05);">
                            <div title="${tooltip}" style="height:100%; width:${w}%; background:${color}; cursor:pointer; opacity:0.85;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.85'"></div>
                        </div>
                        <div style="display:flex; align-items:center; gap:6px; min-width:65px;">
                            <div style="font-size:0.8rem; color:var(--text); width:28px; font-weight:bold; text-align:right;">${roundedRawPts}</div>
                            <div style="font-size:0.7rem; padding:2px 6px; border-radius:4px; ${badgeStyle}">${multStr}</div>
                        </div>
                    </div>
                `;
            });
            barsContainer.innerHTML = barsHtml;
            barsContainer.style.cssText = 'display:flex; flex-direction:column; gap:4px; width:100%; max-height:450px; overflow-y:auto; overflow-x:hidden;';
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

function renderMultTable() {
    const tbody = document.getElementById('tt-mult-table-body');
    if (!tbody) return;

    const lotSize = parseInt(_targetConfig.lotSizeStr) || 65;
    const maxMult = parseInt(_targetConfig.maxMultStr) || 3;
    const maxPts = parseFloat(_targetConfig.maxPtsStr) || 30;
    const expWin = parseFloat(_targetConfig.expWinStr) || 15;
    const expLoss = parseFloat(_targetConfig.expLossStr) || 5;

    // Update column headers to reflect current TD+/TD- days
    const hPlus = document.getElementById('tt-mult-tdplus-header');
    const hMinus = document.getElementById('tt-mult-tdminus-header');
    if (hPlus) hPlus.textContent = `TD+ (${expWin}d)`;
    if (hMinus) hMinus.textContent = `TD- (${expLoss}d)`;

    const fmt = v => '₹ ' + Math.round(v).toLocaleString('en-IN');
    const avgDailyTrades = parseInt(_targetConfig.avgTradesStr) || 3;
    const totalTradingDays = expWin + expLoss;

    // Timeline: current month = maxMult, +1 mult every 2 months
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let baseYear = 2026, baseMonth = 0; // fallback
    if (_ttCurrentDate) {
        const p = _ttCurrentDate.split('-');
        baseYear = parseInt(p[0], 10);
        baseMonth = parseInt(p[1], 10) - 1; // 0-indexed
    }
    function multMonth(m) {
        const diff = m - maxMult; // months offset in 2-month steps
        const totalMonths = baseMonth + diff * 2;
        const yr = baseYear + Math.floor(totalMonths / 12);
        const mo = ((totalMonths % 12) + 12) % 12;
        return { label: `${MONTH_NAMES[mo]} ${yr}`, past: diff < 0, now: diff === 0 };
    }

    const displayMax = Math.max(maxMult, 10);
    let html = '';
    for (let m = 1; m <= displayMax; m++) {
        const pd = lotSize * m * maxPts;
        const tdPlus = pd * expWin;
        const tdMinus = pd * expLoss;
        const net = tdPlus - tdMinus;
        const isMax = m === maxMult;
        const rowBg = isMax ? 'background:rgba(52,152,219,0.1);' : (m % 2 === 0 ? 'background:rgba(255,255,255,0.02);' : '');
        const netCol = net >= 0 ? 'var(--green)' : 'var(--red)';
        const tm = multMonth(m);
        const monthCol = tm.past ? 'color:var(--text2); opacity:0.5;' : tm.now ? 'color:var(--blue); font-weight:bold;' : 'color:var(--text);';
        const monthLabel = tm.past ? `✓ ${tm.label}` : tm.now ? `▶ ${tm.label}` : tm.label;
        // Tax scales with multiplier (more lots = higher transaction charges)
        const tax = totalTradingDays * avgDailyTrades * 65 * m;
        const netAfterTax = net - tax;
        const netCol2 = netAfterTax >= 0 ? 'var(--green)' : 'var(--red)';
        html += `
          <tr style="${rowBg} border-bottom:1px solid var(--border);">
            <td style="padding:9px 12px; text-align:center; font-weight:bold; color:${isMax ? 'var(--blue)' : 'var(--text)'};">${m}${isMax ? ' ★' : ''}</td>
            <td style="padding:9px 12px; text-align:center; color:var(--text2);">${Math.round(maxPts)}</td>
            <td style="padding:9px 12px; text-align:center; font-weight:bold; color:var(--text);">${fmt(pd)}</td>
            <td style="padding:9px 12px; text-align:center; color:var(--green);">${fmt(tdPlus)}</td>
            <td style="padding:9px 12px; text-align:center; color:var(--red);">${fmt(tdMinus)}</td>
            <td style="padding:9px 12px; text-align:center; color:var(--red); font-size:0.82rem;">- ${fmt(tax)}</td>
            <td style="padding:9px 12px; text-align:center; font-weight:bold; color:${netCol2};">${fmt(netAfterTax)}</td>
            <td style="padding:9px 12px; text-align:center; font-size:0.8rem; ${monthCol}">${monthLabel}</td>
          </tr>`;
    }
    tbody.innerHTML = html;
}
