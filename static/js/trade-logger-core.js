/**
 * @fileoverview trade-logger-core.js
 * @description Trade Logger — state, schema helpers, open/close/navigate/validate.
 *              Render functions live in trade-logger-render.js (loaded after this).
 */

let _tlBackdrop = null;
let _tlTab = 0;
let _tlDayTrades = [];

const TL_SCHEMA_VERSION = 2;

const TL_KEY_ALIASES = {
    en_sl10: ['en_sc10'],
    mgt_patience: ['en_patience'],
    mgt_conf: ['en_conf'],
    ex_nafs: ['en_nafs']
};

function parseTimeToMinutes(timeStr) {
    if (!timeStr) return null;
    const s = String(timeStr).trim();
    // Handles: "09:15", "09:15:30", "9:15 AM", "9:15 PM"
    const m = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const period = m[3] ? m[3].toUpperCase() : null;
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + min;
}

function _calcTradeDurationMinutes(trade) {
    if (!trade) return null;
    const directPairs = [
        [trade['Time'], trade['Ex Time']],
        [trade['Entry Time'], trade['Exit Time']],
        [trade['entry_time'], trade['exit_time']],
        [trade['entryTime'], trade['exitTime']]
    ];
    for (const [start, end] of directPairs) {
        const t1 = parseTimeToMinutes(start);
        const t2 = parseTimeToMinutes(end);
        if (t1 !== null && t2 !== null) return Math.abs(t2 - t1);
    }

    const buy = parseTimeToMinutes(trade['Buy Time'] || trade['buy_time'] || trade['buyTime']);
    const sell = parseTimeToMinutes(trade['Sell Time'] || trade['sell_time'] || trade['sellTime']);
    if (buy !== null && sell !== null) return Math.abs(sell - buy);

    return null;
}

function _attemptCloseTradeLogger() {
    if (!validateAndSaveTl()) return;
    closeTradeLogger();
}

function _getTlValue(tl, key) {
    if (!tl || !key) return '';
    const direct = tl[key];
    if (direct !== undefined && direct !== null && String(direct).trim() !== '') return direct;
    const aliases = TL_KEY_ALIASES[key] || [];
    for (const a of aliases) {
        const v = tl[a];
        if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return '';
}

function _setTlValue(tl, key, value) {
    if (!tl || !key) return;
    tl[key] = value;
}

function _appendTlMigrationLog(tl, msg) {
    if (!tl || !msg) return;
    if (!Array.isArray(tl._migrationLog)) tl._migrationLog = [];
    const stamp = new Date().toISOString();
    tl._migrationLog.push(`${stamp} - ${msg}`);
    if (tl._migrationLog.length > 50) tl._migrationLog = tl._migrationLog.slice(-50);
}

function _normalizeTlKeys(tl) {
    if (!tl || typeof tl !== 'object') return;
    let changed = false;
    const fromVersion = Number(tl._schemaVersion || 1);
    Object.keys(TL_KEY_ALIASES).forEach(key => {
        if (tl[key] !== undefined && tl[key] !== null && String(tl[key]).trim() !== '') return;
        const aliases = TL_KEY_ALIASES[key];
        for (const a of aliases) {
            const v = tl[a];
            if (v !== undefined && v !== null && String(v).trim() !== '') {
                tl[key] = v;
                _appendTlMigrationLog(tl, `mapped "${a}" -> "${key}"`);
                changed = true;
                break;
            }
        }
    });
    if (fromVersion !== TL_SCHEMA_VERSION) {
        _appendTlMigrationLog(tl, `schema upgraded ${fromVersion} -> ${TL_SCHEMA_VERSION}`);
        changed = true;
    }
    tl._schemaVersion = TL_SCHEMA_VERSION;
    return changed;
}

function _ensureTlSchema(tl) {
    if (!tl || typeof tl !== 'object') return false;
    let changed = false;
    if (!Array.isArray(tl._migrationLog)) {
        tl._migrationLog = [];
        changed = true;
    }
    if (Number(tl._schemaVersion || 0) !== TL_SCHEMA_VERSION) changed = true;
    if (_normalizeTlKeys(tl)) changed = true;
    return changed;
}

function openTradeLoggerFromToolbar() {
    const filtered = getFilteredTrades ? getFilteredTrades() : state.trades;
    if (!filtered.length) { showToast('No trades to review', 'error'); return; }
    const sorted = [...filtered].sort((a, b) => {
        const da = normalizeDate(a['trade_date'] || a['Date'] || a.date || '');
        const db = normalizeDate(b['trade_date'] || b['Date'] || b.date || '');
        return da < db ? 1 : da > db ? -1 : 0;
    });
    const rowIdx = state.trades.indexOf(sorted[0]);
    if (rowIdx >= 0) openTradeLogger(rowIdx);
}

function openTradeLogger(rowIdx) {
    closeTradeLogger();

    const trade = state.trades[rowIdx];
    if (!trade) return;

    const dateKey = normalizeDate(trade['trade_date'] || trade['Date'] || trade.date || '');

    _tlDayTrades = state.trades
        .map((t, i) => ({ trade: t, rowIdx: i }))
        .filter(({ trade: t }) => {
            if (normalizeDate(t['trade_date'] || t['Date'] || t.date || '') !== dateKey) return false;
            if (
                (t['Time'] === '' || t['Time'] === undefined) &&
                (t['Ex Time'] === '' || t['Ex Time'] === undefined) &&
                (t['Buy Time'] === '' || t['Buy Time'] === undefined) &&
                (t['Sell Time'] === '' || t['Sell Time'] === undefined) &&
                (t['Gross P/L'] === '' || t['Gross P/L'] === undefined) &&
                (t['Net P/L'] === '' || t['Net P/L'] === undefined) &&
                (t['Rs'] === '' || t['Rs'] === undefined) &&
                (t['Qty'] === '' || t['Qty'] === undefined)
            ) {
                return false;
            }
            return true;
        });

    _tlTab = Math.max(0, _tlDayTrades.findIndex(x => x.rowIdx === rowIdx));

    _tlBackdrop = document.createElement('div');
    _tlBackdrop.className = 'tr-backdrop';
    _tlBackdrop.addEventListener('click', e => {
        if (e.target === _tlBackdrop) {
            _attemptCloseTradeLogger();
        }
    });

    const modal = document.createElement('div');
    modal.className = 'tr-modal tl-modal';

    const hdr = document.createElement('div');
    hdr.className = 'tr-hdr';

    const hLeft = document.createElement('div');
    hLeft.className = 'tr-hdr-left';
    const title = document.createElement('span');
    title.className = 'tr-hdr-title';
    title.textContent = 'Trade Logger';
    hLeft.appendChild(title);

    const dateNav = document.createElement('div');
    dateNav.className = 'tr-date-nav';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'tr-date-arrow';
    prevBtn.textContent = '\u2039';
    prevBtn.addEventListener('click', () => _tlNavigateDate(-1));

    const dateLabel = document.createElement('span');
    dateLabel.className = 'tr-date-label';
    dateLabel.textContent = dateKey;
    dateLabel.title = 'Click to pick a date';
    dateLabel.style.cursor = 'pointer';

    const datePicker = document.createElement('input');
    datePicker.type = 'date';
    datePicker.style.position = 'absolute';
    datePicker.style.opacity = '0';
    datePicker.style.width = '0';
    datePicker.style.height = '0';
    datePicker.style.pointerEvents = 'none';
    datePicker.value = dateKey;
    dateLabel.appendChild(datePicker);
    dateLabel.addEventListener('click', () => {
        datePicker.showPicker ? datePicker.showPicker() : datePicker.click();
    });
    datePicker.addEventListener('change', () => {
        const picked = datePicker.value;
        if (!picked) return;
        saveTrades();
        const matchTrade = state.trades.find(t =>
            normalizeDate(t['trade_date'] || t['Date'] || t.date || '') === picked
        );
        if (matchTrade) {
            openTradeLogger(state.trades.indexOf(matchTrade));
        } else {
            const dates = [...new Set(
                state.trades.map(t => normalizeDate(t['trade_date'] || t['Date'] || t.date || ''))
            )].filter(Boolean).sort();
            const nearest = dates.reduce((prev, curr) =>
                Math.abs(curr.localeCompare(picked)) < Math.abs(prev.localeCompare(picked)) ? curr : prev
            , dates[0]);
            const nearTrade = nearest && state.trades.find(t =>
                normalizeDate(t['trade_date'] || t['Date'] || t.date || '') === nearest
            );
            if (nearTrade) openTradeLogger(state.trades.indexOf(nearTrade));
            else showToast('No trades found for selected date', 'error');
        }
    });

    const nextBtn = document.createElement('button');
    nextBtn.className = 'tr-date-arrow';
    nextBtn.textContent = '\u203a';
    nextBtn.addEventListener('click', () => _tlNavigateDate(1));

    dateNav.appendChild(prevBtn);
    dateNav.appendChild(dateLabel);
    dateNav.appendChild(nextBtn);
    hLeft.appendChild(dateNav);

    const hdrGroup = document.createElement('div');
    hdrGroup.style.display = 'flex';
    hdrGroup.style.gap = '8px';

    const resetBtn = document.createElement('button');
    resetBtn.className = 'tr-close';
    resetBtn.style.fontSize = '0.8rem';
    resetBtn.style.padding = '0 8px';
    resetBtn.textContent = 'Reset';
    resetBtn.title = 'Clear all fields in this trade logger';
    resetBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all data for this trade logger?')) {
            trade.tradeLogger = {};
            saveTrades();
            _renderTlContent();
        }
    });

    const forceExitBtn = document.createElement('button');
    forceExitBtn.className = 'tr-close';
    forceExitBtn.style.fontSize = '0.8rem';
    forceExitBtn.style.padding = '0 8px';
    forceExitBtn.textContent = 'Force Exit';
    forceExitBtn.title = 'Close without validating fields';
    forceExitBtn.addEventListener('click', () => {
        saveTrades();
        closeTradeLogger();
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tr-close';
    closeBtn.textContent = '\u2715';
    closeBtn.title = 'Save and close (checks validation)';
    closeBtn.addEventListener('click', _attemptCloseTradeLogger);

    hdrGroup.appendChild(resetBtn);
    hdrGroup.appendChild(forceExitBtn);
    hdrGroup.appendChild(closeBtn);
    hdr.appendChild(hLeft);
    hdr.appendChild(hdrGroup);
    modal.appendChild(hdr);

    const tabBar = document.createElement('div');
    tabBar.className = 'tr-tabs';
    tabBar.id = 'tl-tabs';
    modal.appendChild(tabBar);

    const body = document.createElement('div');
    body.className = 'tr-body tl-body';
    body.id = 'tl-body';
    modal.appendChild(body);

    _tlBackdrop.appendChild(modal);
    document.body.appendChild(_tlBackdrop);

    _renderTlTabs();
    _renderTlContent();

    document.addEventListener('keydown', _tlEscKey);
}

function _tlEscKey(e) {
    if (e.key === 'Escape') {
        _attemptCloseTradeLogger();
    }
}

function closeTradeLogger() {
    document.removeEventListener('keydown', _tlEscKey);
    if (_tlBackdrop) { _tlBackdrop.remove(); _tlBackdrop = null; }
    _tlDayTrades = [];
}

function validateAndSaveTl() {
    saveTrades();

    const { trade } = _tlDayTrades[_tlTab];
    if (!trade || !trade.tradeLogger) return true;
    const tl = trade.tradeLogger;
    const schemaChanged = _ensureTlSchema(tl);
    if (schemaChanged) saveTrades();

    const reqKeys = [
        'score', 'tar', 'runn', 'sl', 'dd',
        'entry_type', 'zone', 'zone_size', 'bc_gt_20', 'placement', 'near', 'z_candle',
        'breakout_c', 'dema', 'en_algo', 'en_sl10', 'dist_gt_20',
        'ex_nafs', 'mgt_patience', 'mgt_conf', 'sc_sl_moved',
        'sc_targ_move', 'sc_gt10', 'sc_ptrail', 'ex_sl', 'ex_targ', 'ex_kill'
    ];

    const missing = reqKeys.filter(k => {
        const val = _getTlValue(tl, k);
        return val === undefined || val === null || String(val).trim() === '';
    });

    if (missing.length > 0) {
        showToast('Please fill all missing inputs, dropdowns and Y/N values before exiting.', 'error');
        document.querySelectorAll('.tl-field, .tl-dash-inp').forEach(el => el.classList.remove('tl-error'));
        missing.forEach(k => {
            const fieldEl = document.querySelector(`.tl-field[data-key="${k}"]`);
            if (fieldEl) {
                fieldEl.classList.add('tl-error');
            } else {
                const dashEl = document.querySelector(`.tl-dash-inp[data-key="${k}"]`);
                if (dashEl) dashEl.classList.add('tl-error');
            }
        });

        const firstError = document.querySelector('.tl-error');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const focusable = firstError.querySelector('input, select, button');
            if (focusable) focusable.focus();
            else if (firstError.tagName === 'INPUT') firstError.focus();
        }

        return false;
    }
    return true;
}

function _tlNavigateDate(dir) {
    saveTrades();
    const dates = [...new Set(
        state.trades.map(t => normalizeDate(t['trade_date'] || t['Date'] || t.date || ''))
    )].filter(Boolean).sort();

    const cur = _tlDayTrades[0]
        ? normalizeDate(_tlDayTrades[0].trade['trade_date'] || _tlDayTrades[0].trade['Date'] || _tlDayTrades[0].trade.date || '')
        : '';

    const idx = dates.indexOf(cur);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= dates.length) return;

    const newDate = dates[newIdx];
    const newTrade = state.trades.find(t =>
        normalizeDate(t['trade_date'] || t['Date'] || t.date || '') === newDate
    );
    if (!newTrade) return;
    openTradeLogger(state.trades.indexOf(newTrade));
}
