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
