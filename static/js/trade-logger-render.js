/**
 * @fileoverview trade-logger-render.js
 * @description Trade Logger — tab bar, content blocks, field builder, section renderer.
 *              Depends on trade-logger-core.js (loaded before this).
 */

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
            saveTrades();
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
    if (!trade.tradeLogger) trade.tradeLogger = {};
    const tl = trade.tradeLogger;
    const schemaChanged = _ensureTlSchema(tl);
    if (schemaChanged) saveTrades();

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

    const computedDur = _calcTradeDurationMinutes(trade);
    if (computedDur !== null) tl.dur = computedDur;

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
            if (s.lbl === 'Dur') {
                const durVal = tl[dashKey];
                inp.value = (durVal !== undefined && durVal !== '') ? durVal + ' min' : '—';
                inp.readOnly = true;
                inp.style.cursor = 'default';
                inp.style.opacity = '0.7';
                inp.tabIndex = -1;
            } else {
                inp.value = tl[dashKey] || '';
                inp.addEventListener('change', () => {
                    tl[dashKey] = inp.value;
                    inp.classList.remove('tl-error');
                    saveTrades();
                });
                inp.tabIndex = 0;
            }
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

    // Field builder
    const buildField = (lbl, type, opts, key) => {
        const wrap = document.createElement('div');
        wrap.className = 'tl-field';
        wrap.setAttribute('data-key', key);

        if (type === 'checkbox') {
            const lblEl = document.createElement('label');
            lblEl.className = 'tl-cb-label';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !!_getTlValue(tl, key);
            cb.tabIndex = 0;
            cb.addEventListener('change', () => { _setTlValue(tl, key, cb.checked); saveTrades(); });
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
            yBtn.className = 'tl-yn-btn y-btn' + (_getTlValue(tl, key) === 'Y' ? ' active-y' : '');
            yBtn.textContent = 'Y';
            yBtn.tabIndex = 0;

            const nBtn = document.createElement('button');
            nBtn.className = 'tl-yn-btn n-btn' + (_getTlValue(tl, key) === 'N' ? ' active-n' : '');
            nBtn.textContent = 'N';
            nBtn.tabIndex = 0;

            yBtn.addEventListener('click', () => {
                _setTlValue(tl, key, 'Y');
                yBtn.classList.add('active-y');
                nBtn.classList.remove('active-n');
                wrap.classList.remove('tl-error');
                saveTrades();
            });
            nBtn.addEventListener('click', () => {
                _setTlValue(tl, key, 'N');
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
            const cur = _getTlValue(tl, key);
            sel.innerHTML = `<option value=""></option>` + opts.map(o => `<option value="${o}" ${cur === o ? 'selected' : ''}>${o}</option>`).join('');
            sel.tabIndex = 0;
            sel.addEventListener('change', () => {
                _setTlValue(tl, key, sel.value);
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
            inp.value = _getTlValue(tl, key) || '';
            inp.tabIndex = 0;
            inp.addEventListener('input', () => {
                _setTlValue(tl, key, inp.value);
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

    const imgWrapper = document.createElement('div');
    imgWrapper.style.flex = '0 0 80%';
    imgWrapper.style.minHeight = '250px';
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
        heroImgPath = trade.images[0].path;
        if (!heroImgPath) heroImgPath = trade.images[0];
    }
    const dateKeyStr = normalizeDate(trade['trade_date'] || trade['Date'] || trade.date || '');

    if (heroImgPath) {
        const imgEl = document.createElement('img');
        imgEl.src = resolveImageUrl(heroImgPath);
        imgEl.style.width = '100%';
        imgEl.style.height = '100%';
        imgEl.style.objectFit = 'contain';
        imgEl.style.cursor = 'pointer';
        imgEl.title = 'Click to open in Gallery (new tab)';
        imgEl.addEventListener('click', () => {
            const u = new URL(window.location.href);
            u.searchParams.set('galleryDate', dateKeyStr || '');
            u.searchParams.set('galleryImg', heroImgPath || '');
            window.open(u.toString(), '_blank', 'noopener,noreferrer');
        });
        imgWrapper.appendChild(imgEl);
    } else {
        imgWrapper.innerHTML = '<span style="color:var(--text2); font-size:0.8rem;">No images for this trade</span>';
    }

    const b2grid = document.createElement('div');
    b2grid.className = 'tl-grid-1';
    b2grid.style.flex = '1';

    const b2c1 = document.createElement('div');
    b2c1.className = 'tl-col';
    b2c1.appendChild(buildField('Zone', 'yn', null, 'zone'));
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

    // 3-5. ENTRY / MANAGEMENT / EXIT
    const emoRow = document.createElement('div');
    emoRow.className = 'tl-em-row';

    const b3 = _trBlock('Entry');
    const b3grid = document.createElement('div');
    b3grid.className = 'tl-grid-1';
    const b3c1 = document.createElement('div'); b3c1.className = 'tl-col';
    b3c1.appendChild(buildField('Breakout Candle', 'dropdown', ['Same Clr', 'Different Clr'], 'breakout_c'));
    b3c1.appendChild(buildField('DEMA', 'yn', null, 'dema'));
    b3c1.appendChild(buildField('Algo signal', 'yn', null, 'en_algo'));
    b3c1.appendChild(buildField('SL under 10', 'yn', null, 'en_sl10'));
    b3c1.appendChild(buildField('Dist &gt; 20', 'yn', null, 'dist_gt_20'));
    b3grid.append(b3c1);
    b3.body.appendChild(b3grid);
    emoRow.appendChild(b3.el);

    const b4 = _trBlock('Management');
    const b4grid = document.createElement('div');
    b4grid.className = 'tl-grid-1';
    const b4c1 = document.createElement('div'); b4c1.className = 'tl-col';
    b4c1.appendChild(buildField('Nafs Pe Kabu', 'yn', null, 'ex_nafs'));
    b4c1.appendChild(buildField('SL moved', 'yn', null, 'sc_sl_moved'));
    b4c1.appendChild(buildField('Patience', 'yn', null, 'mgt_patience'));
    b4c1.appendChild(buildField('Confirmation', 'yn', null, 'mgt_conf'));
    b4grid.append(b4c1);
    b4.body.appendChild(b4grid);
    emoRow.appendChild(b4.el);

    const b5 = _trBlock('Exit');
    const b5grid = document.createElement('div');
    b5grid.className = 'tl-grid-1';
    const b5c1 = document.createElement('div'); b5c1.className = 'tl-col';
    b5c1.appendChild(buildField('Target move', 'yn', null, 'sc_targ_move'));
    b5c1.appendChild(buildField('&gt;10 pt', 'yn', null, 'sc_gt10'));
    b5c1.appendChild(buildField('Profit trail', 'yn', null, 'sc_ptrail'));
    b5c1.appendChild(buildField('SL', 'yn', null, 'ex_sl'));
    b5c1.appendChild(buildField('Target', 'yn', null, 'ex_targ'));
    b5c1.appendChild(buildField('Kill Switch', 'yn', null, 'ex_kill'));
    b5grid.append(b5c1);
    b5.body.appendChild(b5grid);
    emoRow.appendChild(b5.el);

    body.appendChild(emoRow);

    // 6. PSYCO (EMOTIONS)
    const b6 = _trBlock('Psyco (Emotions)');
    const psy = document.createElement('div');
    psy.className = 'tl-psy-wrap';

    const mkEmotionCard = (title, posItems, negItems) => {
        const card = document.createElement('div');
        card.className = 'tl-psy-card';

        const hdr = document.createElement('div');
        hdr.className = 'tl-psy-title';
        hdr.textContent = title;
        card.appendChild(hdr);

        const grid = document.createElement('div');
        grid.className = 'tl-psy-grid';

        const pos = document.createElement('div');
        pos.className = 'tl-psy-col tl-psy-col-pos';
        pos.innerHTML = '<div class="tl-psy-col-head">+</div>';
        posItems.forEach(([lbl, key]) => pos.appendChild(buildField(lbl, 'yn', null, key)));

        const neg = document.createElement('div');
        neg.className = 'tl-psy-col tl-psy-col-neg';
        neg.innerHTML = '<div class="tl-psy-col-head">-ve</div>';
        negItems.forEach(([lbl, key]) => neg.appendChild(buildField(lbl, 'yn', null, key)));

        grid.appendChild(pos);
        grid.appendChild(neg);
        card.appendChild(grid);
        return card;
    };

    psy.appendChild(mkEmotionCard(
        'Entry',
        [['Nafs Pe Kabu', 'en_nafs'], ['Patience', 'en_patience'], ['Confirmation', 'en_conf']],
        [['Impulsive', 'en_impulsive'], ['Desperate', 'en_desperate'], ['Distracted', 'en_distracted'], ['Panic', 'en_panic']]
    ));
    psy.appendChild(mkEmotionCard(
        'Exit',
        [['Nafs Pe Kabu', 'ex_nafs'], ['Patience', 'ex_patience'], ['Confirmation', 'ex_conf'], ['Swing Creation', 'ex_swing']],
        [['Impulsive', 'ex_impulsive'], ['Distracted', 'ex_distracted'], ['Panic', 'ex_panic'], ['Desperate', 'ex_desperate'], ['Sahi Nahi Lag Raha', 'ex_sahi']]
    ));

    b6.body.appendChild(psy);
    body.appendChild(b6.el);
}

function _trBlock(title) {
    const el = document.createElement('div');
    el.className = 'tr-block tl-block';
    const head = document.createElement('div');
    head.className = 'tr-block-head';
    const iconMap = {
        dashboard: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect></svg>',
        setup: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v3"></path><path d="M12 18v3"></path><path d="M3 12h3"></path><path d="M18 12h3"></path><path d="m5.64 5.64 2.12 2.12"></path><path d="m16.24 16.24 2.12 2.12"></path><path d="m18.36 5.64-2.12 2.12"></path><path d="m7.76 16.24-2.12 2.12"></path><circle cx="12" cy="12" r="3"></circle></svg>',
        entry: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle></svg>',
        management: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><polyline points="3 12 7 12 10 5 14 19 17 12 21 12"></polyline></svg>',
        exit: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>'
    };
    const key = String(title || '').toLowerCase();
    const icon = iconMap[key];
    if (icon) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'tl-head-icon tl-head-icon-svg';
        iconSpan.innerHTML = icon;
        head.appendChild(iconSpan);
    }

    const titleSpan = document.createElement('span');
    titleSpan.className = 'tl-head-title';
    titleSpan.textContent = String(title || '').toUpperCase();
    head.appendChild(titleSpan);
    const body = document.createElement('div');
    body.className = 'tr-block-body tl-block-body';
    el.appendChild(head);
    el.appendChild(body);
    return { el, head, body };
}
