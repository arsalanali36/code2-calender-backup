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
