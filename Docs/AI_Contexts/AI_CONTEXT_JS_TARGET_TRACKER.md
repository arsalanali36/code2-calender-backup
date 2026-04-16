# JS - Target Tracker (main + monthly)
Consolidated code context for AI assistants.


## File: `static/js/target-tracker.js`
```js
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

    // Reset fields first
    const grossAmtEl = document.getElementById('tt-gross-amt');
    if (grossAmtEl) {
        grossAmtEl.textContent = `\u20B9 0`;
        grossAmtEl.style.color = 'var(--text2)';
    }

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

        if (grossAmtEl) {
            grossAmtEl.textContent = `\u20B9 ${Math.round(sumActualGross).toLocaleString('en-IN')}`;
            grossAmtEl.style.color = sumActualGross >= 0 ? 'var(--green)' : 'var(--red)';
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

                const rawInst = item.trade['Instrument'] || '—';
                const instUpper = rawInst.toUpperCase();
                
                // Strict Formatting: Prefix, YY(2), M(1), DD(2), Strike, Type
                const im = instUpper.match(/^([A-Z]+)(\d{2})([1-9OND])(\d{2})(\d+)(CE|PE)$/);
                // Format: SYMBOL YY M DD STRIKE TYPE
                const instStr = im ? `${im[1]} ${im[2]} ${im[3]} ${im[4]} ${im[5]} ${im[6]}` : instUpper;

                let instColor = '#ffd700'; // Default gold
                if (instUpper.endsWith('CE')) instColor = '#c084fc'; // Purple
                else if (instUpper.endsWith('PE')) instColor = 'var(--text3, #8b949e)'; // Grey

                barsHtml += (() => {
                    const trade = item.trade;
                    const hasImages = trade.images && trade.images.length > 0;
                    const firstImg = hasImages ? trade.images[0] : '';
                    const clickAttr = hasImages
                        ? `onclick="document.getElementById('target-tracker-modal').classList.remove('open'); openGalleryForDate('${_ttCurrentDate}', decodeURIComponent('${encodeURIComponent(firstImg)}')); return false;"`
                        : `onclick="if(typeof showToast==='function') showToast('No images for this trade', 'info'); return false;"`;

                    return `
                        <a href="javascript:void(0)" ${clickAttr} style="display:flex; align-items:center; gap:8px; margin-bottom:8px; width:100%; cursor:pointer; text-decoration:none; color:inherit;" class="tt-trade-row">
                            <div style="font-size:0.75rem; color:var(--text2); width:25px; text-align:left; font-weight:bold;">T${idx + 1}</div>
                            <div style="font-size:0.65rem; color:${instColor}; width:135px; text-align:left; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${instStr}">${instStr}</div>
                            <div style="flex:1; height:20px; background:var(--bg3); border-radius:4px; overflow:hidden; position:relative; border:1px solid rgba(255,255,255,0.05);">
                                <div title="${tooltip}" style="height:100%; width:${w}%; background:${color}; opacity:0.85;"></div>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px; min-width:65px;">
                                <div style="font-size:0.8rem; color:var(--text); width:28px; font-weight:bold; text-align:right;">${roundedRawPts}</div>
                                <div style="font-size:0.7rem; padding:2px 6px; border-radius:4px; ${badgeStyle}">${multStr}</div>
                            </div>
                        </a>
                    `;
                })();
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

```

## File: `static/js/target-tracker-monthly.js`
```js
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

```
