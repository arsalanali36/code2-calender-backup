/**
 * @fileoverview gallery-stats.js
 * @description Computes and renders P&L stats bar shown below the main gallery image.
 * @exports renderGalleryStats
 * @reads state.gallery.date, state.trades, state.dayData
 * @calls getTradePnl, formatCurrency, getTradesForDate
 */

// gallery-stats.js — renderGalleryStats

function renderGalleryStats() {
    const display = document.getElementById('gallery-heads-display');
    if (!display) return;
    const heads = getActiveShowHeads();
    const allHeads = ['Total Trades', ...state.columns.filter(c => c !== 'Total Trades')];
    const cols = allHeads.filter(col => heads[col] && col.toLowerCase() !== 'date' && !isTagColumn(col));
    if (cols.length === 0) {
        display.style.display = 'none';
        return;
    }

    const activeUrl = (state.gallery.images || [])[state.gallery.currentIndex] || '';
    const ctx = getCurrentGalleryPreserveContext();
    let dateToUse = state.gallery.date || ctx.date;

    let trades = [];
    if (state.calendarMode === 'consolidated') {
        if (dateToUse) {
            trades = getTradesForDate(dateToUse);
        } else {
            const owner = getOwnerTradeForImageUrl(activeUrl);
            if (owner) trades = [owner];
        }
    } else {
        const owner = getOwnerTradeForImageUrl(activeUrl);
        if (owner) trades = [owner];
    }

    if (trades.length === 0) {
        display.style.display = 'none';
        return;
    }

    display.style.display = '';
    display.innerHTML = '';

    const isConsolidated = state.calendarMode === 'consolidated' && trades.length > 1;

    if (isConsolidated) {
        const title = document.createElement('span');
        title.style.fontWeight = 'bold';
        title.style.color = 'var(--text3)';
        title.style.marginRight = '4px';
        title.textContent = 'All:';
        display.appendChild(title);

        cols.forEach(col => {
            const lower = col.toLowerCase();
            if (lower === 'thumbnail' || lower === 'sell time' || lower === 'buy time') return;

            if (col === 'Total Trades') {
                const item = document.createElement('div');
                item.textContent = `Total Trades: ${trades.length}`;
                display.appendChild(item);
                return;
            }

            const vals = trades.map(t => t[col]).filter(v => v !== '' && v != null);
            if (!vals.length) return;
            const item = document.createElement('div');
            const nums = vals.map(v => parseFloat(v)).filter(v => !isNaN(v));
            if (nums.length === vals.length) {
                let outNum;
                if (lower === 'sell price' || lower === 'buy price') outNum = nums.reduce((a, b) => a + b, 0) / nums.length;
                else outNum = nums.reduce((a, b) => a + b, 0);
                const out = outNum % 1 === 0 ? outNum : outNum.toFixed(2);
                item.textContent = `${col}: ${out}`;
                if (lower.includes('profit') || lower === 'rs') item.style.color = outNum >= 0 ? 'var(--green)' : 'var(--red)';
            } else {
                const first = String(vals[0]);
                const same = vals.every(v => String(v) === first);
                item.textContent = same ? `${col}: ${first}` : `${col}: ${vals.length} entries`;
            }
            display.appendChild(item);
        });
    } else {
        trades.forEach((tr, i) => {
            if (trades.length > 1) {
                const title = document.createElement('span');
                title.style.fontWeight = 'bold';
                title.style.color = 'var(--text3)';
                title.style.marginRight = '4px';
                title.textContent = `T${i + 1}:`;
                display.appendChild(title);
            }

            cols.forEach(col => {
                if (col.toLowerCase() === 'thumbnail') return;
                let val;
                if (col === 'Total Trades') val = 1;
                else val = tr[col];
                if (val === '' || val == null) return;
                const item = document.createElement('div');
                const isProfit = col.toLowerCase().includes('profit') || col.toLowerCase() === 'rs';
                if (isProfit) {
                    const num = parseFloat(val);
                    if (!isNaN(num)) {
                        item.textContent = `${col}: ${num > 0 ? '+' : ''}${num}`;
                        item.style.color = num >= 0 ? 'var(--green)' : 'var(--red)';
                    } else { item.textContent = `${col}: ${val}`; }
                } else {
                    item.textContent = `${col}: ${val}`;
                }
                display.appendChild(item);
            });
        });
    }
}

// ── P&L pill in tray (total + per-trade dropdown) ─────────────────────────
function renderGalleryPnlPill() {
    const wrap = document.getElementById('gv2-pnl-wrap');
    const pill = document.getElementById('gv2-pnl-pill');
    const drop = document.getElementById('gv2-pnl-dropdown');
    if (!wrap || !pill || !drop) return;

    const date = state.gallery.date;
    if (!date) { wrap.style.display = 'none'; return; }

    const trades = typeof getTradesForDate === 'function' ? getTradesForDate(date) : [];
    if (!trades.length) { wrap.style.display = 'none'; return; }

    let total = 0;
    const rows = trades.map(t => {
        const pnl = typeof getTradePnl === 'function' ? (getTradePnl(t) || 0) : 0;
        total += pnl;
        return { t, pnl };
    });

    wrap.style.display = '';

    const _fmt = v => '₹' + Math.abs(Math.round(v)).toLocaleString('en-IN');
    pill.textContent = _fmt(total);
    pill.className = 'gv2-pnl-pill' + (total > 0 ? ' positive' : total < 0 ? '' : ' neutral');
    drop.innerHTML = '';
    // Dropdown population for total pill disabled per user request
}

// ── Trade pill (current image's trade + its P/L) ──────────────────────────
function renderGalleryTradePill() {
    const wrap = document.getElementById('gv2-trade-pill-wrap');
    const pill = document.getElementById('gv2-trade-pill');
    const drop = document.getElementById('gv2-trade-dropdown');
    if (!wrap || !pill || !drop) return;

    const date = state.gallery.date;
    if (!date) { wrap.style.display = 'none'; return; }

    const trades = typeof getTradesForDate === 'function' ? getTradesForDate(date) : [];
    if (!trades.length) { wrap.style.display = 'none'; return; }

    const curUrl = (state.gallery.images || [])[state.gallery.currentIndex];
    const owner  = typeof getOwnerTradeForImageUrl === 'function' ? getOwnerTradeForImageUrl(curUrl) : null;
    const tIdx   = owner ? trades.indexOf(owner) : -1;
    if (!owner || tIdx < 0) { wrap.style.display = 'none'; return; }

    const pnl    = typeof getTradePnl === 'function' ? (getTradePnl(owner) || 0) : 0;
    const pt     = parseFloat(owner.Pt || 0) || 0;
    const fmtPnl = v => '₹' + Math.abs(Math.round(v)).toLocaleString('en-IN');
    const ptStr  = Math.abs(Math.round(pt)) + ' Pt';
    const cls    = pnl > 0 ? 'pos' : pnl < 0 ? 'neg' : '';
    const ptCls  = pt > 0 ? 'pos' : pt < 0 ? 'neg' : '';

    wrap.style.display = ''; 
    pill.innerHTML =
        `<span class="gv2-tp-label">T${tIdx + 1},</span>`
      + `<span class="gv2-tp-val ${cls}">${Math.round(pnl)},</span>`
      + `<span class="gv2-tp-val ${ptCls}">${ptStr}</span>`;

    // Dropdown: all trades for quick jump
    drop.innerHTML = '';
    drop.style.minWidth = '380px'; // Increased width to accommodate cumulative column

    let runningTotal = 0;
    trades.forEach((t, i) => {
        const p = typeof getTradePnl === 'function' ? (getTradePnl(t) || 0) : 0;
        runningTotal += p;
        const pt = parseFloat(t.Pt || 0) || 0;
        const lot = parseFloat(t.Qty || t.qty || t.QTY || 0) || 0;
        const buyTime = (t['Buy Time'] || t['buy_time'] || '').slice(0, 5);
        const sellTime = (t['Sell Time'] || t['sell_time'] || '').slice(0, 5);
        const type = String(t['TradeType'] || t['tradetype'] || t['Trade Type'] || '').toLowerCase();
        const isShort = type.includes('sell') || type.includes('short');
        const entryTime = isShort ? sellTime : buyTime;
        
        let dur = '';
        if (buyTime && sellTime) {
            try {
                const [h1, m1] = buyTime.split(':').map(Number);
                const [h2, m2] = sellTime.split(':').map(Number);
                const d1 = new Date(2000, 0, 1, h1, m1);
                const d2 = new Date(2000, 0, 1, h2, m2);
                let diff = Math.abs(d2 - d1);
                const mins = Math.round(diff / 60000);
                dur = mins < 60 ? mins + 'm' : Math.floor(mins / 60) + 'h' + (mins % 60 > 0 ? ' ' + (mins % 60) + 'm' : '');
            } catch(e) {}
        }

        const row = document.createElement('div');
        row.className = 'gv2-pnl-trade-row';
        if (i === tIdx) row.style.background = 'rgba(255,255,255,0.06)';
        
        // Structured Grid Layout: Index, Instrument, Time/Lot, Points, P&L, Cumulative
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '32px 130px 1fr 50px 75px 85px';
        row.style.gap = '8px';
        row.style.alignItems = 'center';
        row.style.padding = '8px 14px';

        const lbl = document.createElement('span');
        lbl.className = 'gv2-pnl-trade-label';
        lbl.style.fontWeight = '700';
        lbl.textContent = `T${i + 1}`;

        const rawInst = t.Instrument || t.instrument || t.Symbol || t.symbol || '';
        const instNum = rawInst.toUpperCase();
        
        // Strict Formatting: Prefix, YY(2), M(1), DD(2), Strike, Type
        const m = instNum.match(/^([A-Z]+)(\d{2})([1-9OND])(\d{2})(\d+)(CE|PE)$/);
        // Format: SYMBOL YY M DD STRIKE TYPE
        const instText = m ? `${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]} ${m[6]}` : instNum;

        let instColor = '#ffd700'; // Gold default
        if (instNum.endsWith('CE')) instColor = '#c084fc'; // Purple
        else if (instNum.endsWith('PE')) instColor = 'var(--text3, #8b949e)'; // Grey

        const inst = document.createElement('span');
        inst.className = 'gv2-pnl-trade-inst';
        inst.style.cssText = `font-size:0.72rem; color:${instColor}; font-weight:700; text-align:left; white-space:nowrap;`;
        inst.textContent = instText || '—';
        
        const info = document.createElement('span');
        info.style.cssText = 'font-size:0.75rem; color:var(--text3); opacity:0.9; white-space:nowrap; text-align:left; letter-spacing:0.2px;';
        info.innerHTML = `<span style="color:var(--text2)">${entryTime}</span>${dur ? ' <span style="font-size:1.1em; font-weight:700; color:#fff; margin:0 2px;">['+dur+']</span>' : ''} <span style="color:var(--text2); margin-left:4px;">${lot}</span>`;
        
        const ptWrap = document.createElement('span');
        ptWrap.className = 'gv2-pnl-trade-pt';
        ptWrap.textContent = Math.abs(Math.round(pt)) + ' Pt';
        ptWrap.style.textAlign = 'right';
        ptWrap.style.color = pt >= 0 ? 'var(--green,#2ecc71)' : 'var(--red,#e74c3c)';
        ptWrap.style.fontSize = '0.82em';
        ptWrap.style.fontWeight = '600';

        const val = document.createElement('span');
        val.className = 'gv2-pnl-trade-val';
        val.textContent = fmtPnl(p);
        val.style.textAlign = 'right';
        val.style.fontWeight = '700';
        val.style.color = p > 0 ? '#2ecc71' : p < 0 ? '#e74c3c' : 'var(--text2)';

        const cumVal = document.createElement('span');
        cumVal.className = 'gv2-pnl-trade-cum';
        cumVal.textContent = fmtPnl(runningTotal);
        cumVal.style.textAlign = 'right';
        cumVal.style.fontWeight = '600';
        cumVal.style.fontSize = '0.88em';
        cumVal.style.opacity = '0.85';
        cumVal.style.paddingLeft = '6px';
        cumVal.style.borderLeft = '1px solid rgba(255,255,255,0.1)';
        cumVal.style.color = runningTotal >= 0 ? '#2ecc71' : '#e74c3c';
        
        row.appendChild(lbl);
        row.appendChild(inst);
        row.appendChild(info);
        row.appendChild(ptWrap);
        row.appendChild(val);
        row.appendChild(cumVal);
        row.addEventListener('click', () => {
            drop.classList.remove('open');
            const firstImg = (t.images || [])[0];
            if (firstImg) {
                const idx = state.gallery.images.indexOf(firstImg);
                if (idx >= 0) { 
                    state.gallery.currentIndex = idx; 
                    state.gallery.selectedIndices = new Set([idx]);
                    state.gallery.selectedSeparator = i;
                    // Uncollapse if currently collapsed
                    if (state.gallery.collapsedSeparators) state.gallery.collapsedSeparators.delete('T' + i);
                    
                    // Force jump to thumbnails tab if it's currently on filter tab
                    const ulpPanel = document.getElementById('gv2-unified-left-panel');
                    if (ulpPanel && ulpPanel.classList.contains('open')) {
                        const activeTab = localStorage.getItem('tj_ulpActiveTab');
                        if (activeTab === 'filter' && typeof switchULPTab === 'function') {
                            switchULPTab('thumbs');
                        }
                    }

                    renderGallery(); 
                }
            }
        });

        drop.appendChild(row);
    });

    // --- NEW: Add Tag / Group options ---
    if (trades.length > 0) {
        const sep = document.createElement('div');
        sep.style.cssText = 'height:1px; background:rgba(255,255,255,0.1); margin:6px 0;';
        drop.appendChild(sep);

        const addTagRow = document.createElement('div');
        addTagRow.className = 'gv2-pnl-trade-row';
        addTagRow.style.color = 'var(--text,#58a6ff)';
        addTagRow.style.opacity = '0.9';
        addTagRow.innerHTML = '<span style="font-size:1.1em;margin-right:8px;font-weight:bold;color:var(--blue)">+</span><span>New Tag</span>';
        addTagRow.onclick = (e) => {
            e.stopPropagation();
            drop.classList.remove('open');
            if (typeof window.openCreateTagModal === 'function') {
                window.openCreateTagModal();
            }
        };
        drop.appendChild(addTagRow);

        const addGrpRow = document.createElement('div');
        addGrpRow.className = 'gv2-pnl-trade-row';
        addGrpRow.style.color = 'var(--text,#58a6ff)';
        addGrpRow.style.opacity = '0.9';
        addGrpRow.innerHTML = '<span style="font-size:1.1em;margin-right:8px;font-weight:bold;color:var(--blue)">+</span><span>New Group</span>';
        addGrpRow.onclick = (e) => {
            e.stopPropagation();
            drop.classList.remove('open');
            const name = prompt('New group name:');
            if (!name || !name.trim()) return;
            const g = name.trim();
            if (!state.tagGroups[g]) {
                state.tagGroups[g] = [];
                if (typeof saveTagGroups === 'function') saveTagGroups();
                if (typeof renderGalleryTagsTray === 'function') renderGalleryTagsTray();
                showToast(`Group "${g}" created`, 'success');
            } else {
                showToast('Group already exists', 'info');
            }
        };
        drop.appendChild(addGrpRow);
    }
}

// ── Combined tray state update (called from renderGallery) ───────────────
function renderGalleryTrayState() {
    renderGalleryPnlPill();
    renderGalleryTradePill();
    renderGalleryTrayCounter();
    renderGalleryTradeInfoDisplay();

    // Update 'All Trades' highlight if panel is open
    const tradesPanel = document.getElementById('gv2-trades-panel');
    if (tradesPanel && tradesPanel.style.display !== 'none' && typeof window.refreshGalleryTradesList === 'function') {
        window.refreshGalleryTradesList();
    }
}

// ── Overlay over the image showing: T1, P&L, Pt ───────────────────────────
function renderGalleryTradeInfoDisplay() {
    const display = document.getElementById('gallery-trade-info-display');
    if (display) display.style.display = 'none';
}

// ── Image count badge in tray ─────────────────────────────────────────────
function renderGalleryTrayCounter() {
    const el = document.getElementById('gv2-tray-counter');
    if (!el) return;
    const images = state.gallery.images || [];
    if (!images.length) { el.style.display = 'none'; return; }
    
    const curIdx = state.gallery.currentIndex || 0;
    const curUrl = images[curIdx];
    const owner = typeof getOwnerTradeForImageUrl === 'function' ? getOwnerTradeForImageUrl(curUrl) : null;
    
    let displayStr = `${curIdx + 1} / ${images.length}`;
    
    if (owner && owner.images) {
        const relIdx = owner.images.indexOf(curUrl);
        if (relIdx !== -1) {
            displayStr = `${relIdx + 1} / ${owner.images.length}`;
        }
    } else if (state.gallery.date) {
        // Check if it's in a day category like OPEN or CLOSE
        const dayData = state.dayData[state.gallery.date];
        if (dayData && dayData.images) {
            const relIdx = dayData.images.indexOf(curUrl);
            if (relIdx !== -1) {
                displayStr = `${relIdx + 1} / ${dayData.images.length}`;
            }
        }
    }

    el.style.display = '';
    el.textContent = displayStr;
}
