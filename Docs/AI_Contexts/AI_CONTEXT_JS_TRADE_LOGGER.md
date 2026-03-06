# JS — Trade Logger modal (trade-logger.js)
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `static\js\trade-logger.js`
```js
/**
 * @fileoverview trade-logger.js
 * @description Trade Logger popup based on the Review Popup logic. 
 *              Has folder-style tabs and Blocks.
 *              Uses Tri-state Y/N buttons. Values must be initialized to missing (NaN conceptually)
 *              and validation checks that they are filled on close.
 */

let _tlBackdrop = null;
let _tlTab = 0;
let _tlDayTrades = [];

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
            // Filter out empty/manual template rows from logger (rows with barely any info)
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
    // Remove backdrop auto-close capability as requested. User must click close/force close.
    /*
    _tlBackdrop.addEventListener('click', e => {
        if (e.target === _tlBackdrop) {
            if (!validateAndSaveTl()) return;
            closeTradeLogger();
        }
    });
    */

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
    closeBtn.addEventListener('click', () => {
        if (!validateAndSaveTl()) return;
        closeTradeLogger();
    });

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
        if (!validateAndSaveTl()) return;
        closeTradeLogger();
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

    const isEmpty = Object.keys(tl).length === 0 || Object.values(tl).every(v => v === '' || v === false || v === undefined);
    if (isEmpty) return true;

    const reqKeys = [
        'score', 'dur', 'tar', 'runn', 'sl', 'dd',
        'entry_type', 'zone', 'zone_size', 'bc_gt_20', 'placement', 'near', 'z_candle', 'breakout_c', 'dema', 'dist_gt_20',
        'en_algo', 'en_sl10', 'en_impulsive', 'en_desperate', 'en_distracted', 'en_nafs', 'en_patience', 'en_conf',
        'sc_sl_moved', 'sc_targ_move', 'sc_gt10', 'sc_ptrail',
        'ex_sl', 'ex_targ', 'ex_kill', 'ex_impulsive', 'ex_distracted', 'ex_desperate', 'ex_panic', 'ex_sahi', 'ex_nafs', 'ex_patience', 'ex_conf', 'ex_swing'
    ];

    const missing = reqKeys.filter(k => {
        const val = tl[k];
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

        // Auto-scroll to first error and focus it
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
    if (!validateAndSaveTl()) return;
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

function _renderTlTabs() {
    const bar = document.getElementById('tl-tabs');
    if (!bar) return;
    bar.innerHTML = '';

    const glCol = state.columns.find(c => /net\s*p\/l/i.test(c)) || state.columns.find(c => /^rs$/i.test(c));

    _tlDayTrades.forEach(({ trade }, i) => {
        const tab = document.createElement('button');
        const isActive = i === _tlTab;
        tab.className = 'tr-tab' + (isActive ? ' tr-tab-active' : '');
        tab.textContent = 'T' + (i + 1);

        const pl = glCol ? parseFloat(trade[glCol]) : NaN;
        if (!isNaN(pl) && !isActive) {
            tab.style.borderColor = pl >= 0 ? 'var(--green)' : 'var(--red)';
            tab.style.color = pl >= 0 ? 'var(--green)' : 'var(--red)';
        } else if (!isNaN(pl) && isActive) {
            tab.dataset.pl = pl >= 0 ? 'pos' : 'neg';
        }

        tab.addEventListener('click', () => {
            if (!validateAndSaveTl()) return;
            _tlTab = i;
            _renderTlTabs();
            _renderTlContent();
        });
        bar.appendChild(tab);
    });
}

function _renderTlContent() {
    const body = document.getElementById('tl-body');
    if (!body) return;
    body.innerHTML = '';

    const { trade } = _tlDayTrades[_tlTab];
    if (!trade.tradeLogger) {
        trade.tradeLogger = {}; // initialize empty logger obj
    }
    const tl = trade.tradeLogger;

    const _fmt = val => {
        if (val === undefined || val === null || String(val).trim() === '') return '\u2014';
        const n = parseFloat(val);
        if (!isNaN(n)) return n % 1 === 0 ? String(n) : n.toFixed(2);
        return String(val);
    };

    // 1. DASHBOARD
    const b1 = _trBlock('Dashboard');
    const ptCol = state.columns.find(c => /^pt$/i.test(c));
    const glCol = state.columns.find(c => /net\s*p\/l/i.test(c)) || state.columns.find(c => /^rs$/i.test(c));

    // Automatically calculate Dur if empty, by diffing Ex Time and Time if available
    if ((tl.dur === undefined || tl.dur === '') && trade['Time'] && trade['Ex Time']) {
        const t1 = parseTimeToMinutes(trade['Time']);
        const t2 = parseTimeToMinutes(trade['Ex Time']);
        if (t1 !== null && t2 !== null) {
            tl.dur = Math.max(0, t2 - t1);
            saveTrades();
        }
    }

    const dashRow1 = document.createElement('div');
    dashRow1.className = 'tr-dash-row';
    [
        { lbl: 'Pt', val: ptCol ? trade[ptCol] : null },
        { lbl: 'P/L', val: glCol ? trade[glCol] : null },
        { lbl: 'Score', val: tl.score },
        { lbl: 'Dur', val: tl.dur }
    ].forEach(s => {
        const box = document.createElement('div');
        box.className = 'tr-dash-box';
        box.innerHTML = `<div class="tr-dash-lbl">${s.lbl}</div>`;
        const v = document.createElement('div'); v.className = 'tr-dash-val';
        if (s.lbl === 'Score' || s.lbl === 'Dur') {
            const inp = document.createElement('input');
            inp.className = 'tl-dash-inp';
            const dashKey = s.lbl.toLowerCase();
            inp.setAttribute('data-key', dashKey);
            inp.value = tl[dashKey] || '';
            inp.addEventListener('change', () => {
                tl[dashKey] = inp.value;
                inp.classList.remove('tl-error');
                saveTrades();
            });
            inp.tabIndex = 0;
            v.appendChild(inp);
        } else {
            v.textContent = _fmt(s.val);
            const n = parseFloat(s.val);
            if (!isNaN(n)) v.style.color = n >= 0 ? 'var(--green)' : 'var(--red)';
        }
        box.appendChild(v);
        dashRow1.appendChild(box);
    });

    const dashRow2 = document.createElement('div');
    dashRow2.className = 'tr-dash-row';
    [
        { lbl: 'Tar', key: 'tar' }, { lbl: 'Runn', key: 'runn' },
        { lbl: 'SL', key: 'sl' }, { lbl: 'DD', key: 'dd' }
    ].forEach(s => {
        const box = document.createElement('div');
        box.className = 'tr-dash-box';
        box.innerHTML = `<div class="tr-dash-lbl">${s.lbl}</div>`;
        const v = document.createElement('div'); v.className = 'tr-dash-val';
        const inp = document.createElement('input');
        inp.className = 'tl-dash-inp';
        inp.setAttribute('data-key', s.key);
        inp.value = tl[s.key] || '';
        inp.addEventListener('change', () => {
            tl[s.key] = inp.value;
            inp.classList.remove('tl-error');
            saveTrades();
        });
        inp.tabIndex = 0;
        v.appendChild(inp);
        box.appendChild(v);
        dashRow2.appendChild(box);
    });

    b1.body.appendChild(dashRow1);
    b1.body.appendChild(dashRow2);
    body.appendChild(b1.el);

    // Helper builder for forms
    const buildField = (lbl, type, opts, key) => {
        const wrap = document.createElement('div');
        wrap.className = 'tl-field';
        wrap.setAttribute('data-key', key);

        if (type === 'checkbox') {
            const lblEl = document.createElement('label');
            lblEl.className = 'tl-cb-label';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !!tl[key];
            cb.tabIndex = 0;
            cb.addEventListener('change', () => { tl[key] = cb.checked; saveTrades(); });
            lblEl.appendChild(cb);
            lblEl.appendChild(document.createTextNode(' ' + lbl));
            wrap.appendChild(lblEl);
        } else if (type === 'yn') {
            const topLbl = document.createElement('div');
            topLbl.className = 'tl-label';
            topLbl.innerHTML = lbl;

            const grp = document.createElement('div');
            grp.className = 'tl-tristate';

            const yBtn = document.createElement('button');
            yBtn.className = 'tl-yn-btn y-btn' + (tl[key] === 'Y' ? ' active-y' : '');
            yBtn.textContent = 'Y';
            yBtn.tabIndex = 0;

            const nBtn = document.createElement('button');
            nBtn.className = 'tl-yn-btn n-btn' + (tl[key] === 'N' ? ' active-n' : '');
            nBtn.textContent = 'N';
            nBtn.tabIndex = 0;

            yBtn.addEventListener('click', () => {
                tl[key] = 'Y';
                yBtn.classList.add('active-y');
                nBtn.classList.remove('active-n');
                wrap.classList.remove('tl-error');
                saveTrades();
            });

            nBtn.addEventListener('click', () => {
                tl[key] = 'N';
                nBtn.classList.add('active-n');
                yBtn.classList.remove('active-y');
                wrap.classList.remove('tl-error');
                saveTrades();
            });

            grp.appendChild(yBtn);
            grp.appendChild(nBtn);
            wrap.appendChild(topLbl);
            wrap.appendChild(grp);
        } else if (type === 'dropdown') {
            const topLbl = document.createElement('div');
            topLbl.className = 'tl-label';
            topLbl.innerHTML = lbl;
            const sel = document.createElement('select');
            sel.className = 'tl-select';
            sel.innerHTML = `<option value=""></option>` + opts.map(o => `<option value="${o}" ${tl[key] === o ? 'selected' : ''}>${o}</option>`).join('');
            sel.tabIndex = 0;
            sel.addEventListener('change', () => {
                tl[key] = sel.value;
                wrap.classList.remove('tl-error');
                saveTrades();
            });
            wrap.appendChild(topLbl);
            wrap.appendChild(sel);
        } else if (type === 'input') {
            const topLbl = document.createElement('div');
            topLbl.className = 'tl-label';
            topLbl.innerHTML = lbl;
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.className = 'tl-input';
            inp.value = tl[key] || '';
            inp.tabIndex = 0;
            inp.addEventListener('input', () => {
                tl[key] = inp.value;
                wrap.classList.remove('tl-error');
                saveTrades();
            });
            wrap.appendChild(topLbl);
            wrap.appendChild(inp);
        }
        return wrap;
    };

    // 2. SETUP (Strategy)
    const b2 = _trBlock('Setup');
    const b2Row = document.createElement('div');
    b2Row.className = 'tl-flex-row';
    b2Row.style.gap = '20px';
    b2Row.style.borderBottom = '2px solid var(--red)';
    b2Row.style.paddingBottom = '12px';
    b2Row.style.marginBottom = '12px';

    const stratGrp = document.createElement('div');
    stratGrp.className = 'tl-fieldgroup tl-flex-row';
    stratGrp.innerHTML = '<div class="tl-label">Strategy</div>';
    stratGrp.appendChild(buildField('Reversal', 'checkbox', null, 'strat_rev'));
    stratGrp.appendChild(buildField('Cont', 'checkbox', null, 'strat_cont'));
    b2Row.appendChild(stratGrp);

    const entryTypeGrp = document.createElement('div');
    entryTypeGrp.className = 'tl-fieldgroup tl-flex-row';
    entryTypeGrp.appendChild(buildField('Entry Type', 'dropdown', ['Long', 'Short'], 'entry_type'));
    b2Row.appendChild(entryTypeGrp);

    b2.body.appendChild(b2Row);

    const b2ContentSplit = document.createElement('div');
    b2ContentSplit.style.display = 'flex';
    b2ContentSplit.style.gap = '20px';
    b2ContentSplit.style.alignItems = 'flex-start';

    // Image side (Right column in image sketch)
    const imgWrapper = document.createElement('div');
    imgWrapper.style.flex = '0 0 80%'; // Increased width for the image to 80%
    imgWrapper.style.minHeight = '250px'; // Increased minimum height

    imgWrapper.style.border = '1px dashed var(--border2)';
    imgWrapper.style.borderRadius = '8px';
    imgWrapper.style.display = 'flex';
    imgWrapper.style.alignItems = 'center';
    imgWrapper.style.justifyContent = 'center';
    imgWrapper.style.overflow = 'hidden';
    imgWrapper.style.background = 'var(--surface2)';

    let heroImgPath = null;
    if (trade.heroImage) {
        heroImgPath = trade.heroImage;
    } else if (trade.images && trade.images.length > 0) {
        heroImgPath = trade.images[0].path; // Handle case where trade.images objects have .path
        if (!heroImgPath) heroImgPath = trade.images[0]; // Handle raw string arrays
    }
    const dateKeyStr = normalizeDate(trade['trade_date'] || trade['Date'] || trade.date || '');

    if (heroImgPath) {
        const imgEl = document.createElement('img');
        imgEl.src = heroImgPath;
        imgEl.style.width = '100%';
        imgEl.style.height = '100%';
        imgEl.style.objectFit = 'contain';
        imgEl.style.cursor = 'pointer';
        imgEl.title = 'Click to open in Gallery';
        imgEl.addEventListener('click', () => {
            closeTradeLogger();
            if (typeof openGalleryForDate === 'function') {
                openGalleryForDate(dateKeyStr);
                if (state.gallery && state.gallery.images) {
                    const idx = state.gallery.images.indexOf(heroImgPath);
                    if (idx !== -1) {
                        state.gallery.currentIndex = idx;
                        renderGallery();
                    }
                }
            } else {
                window.open(heroImgPath, '_blank');
            }
        });
        imgWrapper.appendChild(imgEl);
    } else {
        imgWrapper.innerHTML = '<span style="color:var(--text2); font-size:0.8rem;">No images for this trade</span>';
    }

    const b2grid = document.createElement('div');
    b2grid.className = 'tl-grid-1'; // Changed to single column
    b2grid.style.flex = '1';

    const b2c1 = document.createElement('div');
    b2c1.className = 'tl-col';
    b2c1.appendChild(buildField('Zone', 'yn', null, 'zone'));

    // Create a row for Zone size and Zone Candle to save vertical space if needed, 
    // or keep them stacked as per new layout. We'll stack them to fit the narrow column.
    b2c1.appendChild(buildField('Zone size', 'input', null, 'zone_size'));
    b2c1.appendChild(buildField('Zone Candle', 'dropdown', ['Bullish Engulf', 'Bearish Engulf', 'Hammer', 'InvertedHammer', 'MorningStar', 'Shooting Star'], 'z_candle'));
    b2c1.appendChild(buildField('Break Candle &gt; 20pt', 'yn', null, 'bc_gt_20'));
    b2c1.appendChild(buildField('Placement', 'dropdown', ['Hawame', 'At Level', 'Near Level'], 'placement'));
    b2c1.appendChild(buildField('Near', 'dropdown', ['LL', 'HH'], 'near'));

    b2grid.appendChild(b2c1);

    b2ContentSplit.appendChild(b2grid);
    b2ContentSplit.appendChild(imgWrapper);

    b2.body.appendChild(b2ContentSplit);
    body.appendChild(b2.el);

    // 3. ENTRY
    const b3 = _trBlock('Entry');

    // b3 top grid removed (Breakout Candle, DEMA, Dist > 20)
    // Items moved to columns below.

    const b3grid = document.createElement('div');
    b3grid.className = 'tl-grid-3';

    const b3c1 = document.createElement('div'); b3c1.className = 'tl-col';
    b3c1.appendChild(buildField('Breakout Candle', 'dropdown', ['Same Clr', 'Different Clr'], 'breakout_c'));
    b3c1.appendChild(buildField('DEMA', 'yn', null, 'dema'));
    b3c1.appendChild(buildField('Algo signal', 'yn', null, 'en_algo'));
    b3c1.appendChild(buildField('SL under 10', 'yn', null, 'en_sl10'));
    b3c1.appendChild(buildField('Dist &gt; 20', 'yn', null, 'dist_gt_20'));

    const b3c2 = document.createElement('div'); b3c2.className = 'tl-col';
    b3c2.innerHTML += '<div class="tl-col-title" style="margin-bottom:8px;">- Emotions</div>';
    b3c2.appendChild(buildField('Impulsive', 'yn', null, 'en_impulsive'));
    b3c2.appendChild(buildField('Desperate', 'yn', null, 'en_desperate'));
    b3c2.appendChild(buildField('Distracted', 'yn', null, 'en_distracted'));

    const b3c3 = document.createElement('div'); b3c3.className = 'tl-col';
    b3c3.innerHTML += '<div class="tl-col-title" style="margin-bottom:8px;">+ Emotions</div>';
    b3c3.appendChild(buildField('Nafs Pe Kabu', 'yn', null, 'en_nafs'));
    b3c3.appendChild(buildField('Patience', 'yn', null, 'en_patience'));
    b3c3.appendChild(buildField('Confirmation', 'yn', null, 'en_conf'));

    b3grid.append(b3c1, b3c2, b3c3);
    b3.body.appendChild(b3grid);
    body.appendChild(b3.el);

    // 4. MANAGEMENT 
    const b4 = _trBlock('Management');
    const b4grid = document.createElement('div');
    b4grid.className = 'tl-grid-2';

    const b4c1 = document.createElement('div'); b4c1.className = 'tl-col';
    b4c1.appendChild(buildField('Nafs Pe Kabu', 'yn', null, 'ex_nafs')); // as per your sheet's naming under management
    b4c1.appendChild(buildField('Patience', 'yn', null, 'mgt_patience'));
    b4c1.appendChild(buildField('Confirmation', 'yn', null, 'mgt_conf'));

    const b4c2 = document.createElement('div'); b4c2.className = 'tl-col';
    b4c2.appendChild(buildField('SL moved', 'yn', null, 'sc_sl_moved'));

    b4grid.append(b4c1, b4c2);
    b4.body.appendChild(b4grid);
    body.appendChild(b4.el);

    // 5. EXIT
    const b5 = _trBlock('Exit');

    const b5grid = document.createElement('div');
    b5grid.className = 'tl-grid-3';

    const b5c1 = document.createElement('div'); b5c1.className = 'tl-col';
    b5c1.appendChild(buildField('Target move', 'yn', null, 'sc_targ_move'));
    b5c1.appendChild(buildField('&gt;10 pt', 'yn', null, 'sc_gt10'));
    b5c1.appendChild(buildField('Profit trail', 'yn', null, 'sc_ptrail'));
    b5c1.appendChild(buildField('SL', 'yn', null, 'ex_sl'));
    b5c1.appendChild(buildField('Target', 'yn', null, 'ex_targ'));
    b5c1.appendChild(buildField('Kill Switch', 'yn', null, 'ex_kill'));

    const b5c2 = document.createElement('div'); b5c2.className = 'tl-col';
    b5c2.innerHTML = '<div class="tl-col-title">- Emotions</div>';
    b5c2.appendChild(buildField('Impulsive', 'yn', null, 'ex_impulsive'));
    b5c2.appendChild(buildField('Distracted', 'yn', null, 'ex_distracted'));
    b5c2.appendChild(buildField('Desperate', 'yn', null, 'ex_desperate'));
    b5c2.appendChild(buildField('Panic', 'yn', null, 'ex_panic'));
    b5c2.appendChild(buildField('Sahi nahi lag raha', 'yn', null, 'ex_sahi'));

    const b5c3 = document.createElement('div'); b5c3.className = 'tl-col';
    b5c3.innerHTML = '<div class="tl-col-title">+ Emotions</div>';
    b5c3.appendChild(buildField('Nafs Pe Kabu', 'yn', null, 'ex_nafs')); // Nafs in exit
    b5c3.appendChild(buildField('Patience', 'yn', null, 'ex_patience'));
    b5c3.appendChild(buildField('Confirmation', 'yn', null, 'ex_conf'));
    b5c3.appendChild(buildField('Swing Creation', 'yn', null, 'ex_swing'));

    b5grid.append(b5c1, b5c2, b5c3);
    b5.body.appendChild(b5grid);
    body.appendChild(b5.el);
}

function _trBlock(title) {
    const el = document.createElement('div');
    el.className = 'tr-block tl-block';
    const head = document.createElement('div');
    head.className = 'tr-block-head';
    const titleSpan = document.createElement('span');
    titleSpan.textContent = title;
    head.appendChild(titleSpan);
    const body = document.createElement('div');
    body.className = 'tr-block-body tl-block-body';
    el.appendChild(head);
    el.appendChild(body);
    return { el, head, body };
}

```
