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
    const cols = state.columns.filter(col => heads[col] && col.toLowerCase() !== 'date' && !isTagColumn(col));
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

    display.style.display = 'flex';
    display.innerHTML = '';

    const isConsolidated = state.calendarMode === 'consolidated' && trades.length > 1;

    if (isConsolidated) {
        const title = document.createElement('div');
        title.style.fontWeight = 'bold';
        title.style.borderBottom = '1px solid rgba(255,255,255,0.2)';
        title.style.marginBottom = '2px';
        title.style.paddingBottom = '2px';
        title.textContent = 'Consolidated Stats';
        display.appendChild(title);

        cols.forEach(col => {
            const lower = col.toLowerCase();
            if (lower === 'thumbnail' || lower === 'sell time' || lower === 'buy time') return;
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
            const title = document.createElement('div');
            title.style.fontWeight = 'bold';
            title.style.borderBottom = '1px solid rgba(255,255,255,0.2)';
            title.style.marginBottom = '2px';
            title.style.paddingBottom = '2px';
            title.textContent = document.getElementById('gallery-date-picker')?.value === dateToUse && trades.length === 1 ? 'Trade Stats' : 'Individual Stats';
            display.appendChild(title);

            cols.forEach(col => {
                if (col.toLowerCase() === 'thumbnail') return;
                const val = tr[col];
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

    const fmtPnl = v => (v >= 0 ? '+₹' : '-₹') + Math.abs(Math.round(v)).toLocaleString('en-IN');
    pill.textContent = fmtPnl(total);
    pill.className = 'gv2-pnl-pill' + (total > 0 ? ' positive' : total < 0 ? '' : ' neutral');

    // Rebuild dropdown rows (don't clear if open — flickers)
    drop.innerHTML = '';
    rows.forEach(({ t, pnl }, i) => {
        const row = document.createElement('div');
        row.className = 'gv2-pnl-trade-row';
        const lbl = document.createElement('span');
        lbl.className = 'gv2-pnl-trade-label';
        lbl.textContent = `T${i + 1}`;
        const val = document.createElement('span');
        val.className = 'gv2-pnl-trade-val';
        val.textContent = fmtPnl(pnl);
        val.style.color = pnl > 0 ? 'var(--green,#4caf50)' : pnl < 0 ? 'var(--red,#f44336)' : 'var(--text2)';
        row.appendChild(lbl);
        row.appendChild(val);
        row.addEventListener('click', () => {
            drop.classList.remove('open');
            const firstImg = (t.images || [])[0];
            if (firstImg) {
                const idx = state.gallery.images.indexOf(firstImg);
                if (idx >= 0) { state.gallery.currentIndex = idx; renderGallery(); }
            }
        });
        drop.appendChild(row);
    });
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
    const instr  = owner.Instrument || owner.Symbol || owner.instrument || '';
    const fmtPnl = v => (v >= 0 ? '+₹' : '-₹') + Math.abs(Math.round(v)).toLocaleString('en-IN');
    const cls    = pnl > 0 ? 'pos' : pnl < 0 ? 'neg' : '';

    wrap.style.display = '';
    pill.innerHTML =
        `<span class="gv2-tp-label">T${tIdx + 1}</span>`
      + `<span class="gv2-tp-sep">·</span>`
      + `<span class="gv2-tp-val ${cls}">${fmtPnl(pnl)}</span>`;

    // Dropdown: all trades for quick jump
    drop.innerHTML = '';
    trades.forEach((t, i) => {
        const p = typeof getTradePnl === 'function' ? (getTradePnl(t) || 0) : 0;
        const row = document.createElement('div');
        row.className = 'gv2-pnl-trade-row';
        if (i === tIdx) row.style.background = 'rgba(255,255,255,0.06)';
        const lbl = document.createElement('span');
        lbl.className = 'gv2-pnl-trade-label';
        lbl.textContent = `T${i + 1}`;
        const val = document.createElement('span');
        val.className = 'gv2-pnl-trade-val';
        val.textContent = fmtPnl(p);
        val.style.color = p > 0 ? '#2ecc71' : p < 0 ? '#e74c3c' : 'var(--text2)';
        row.appendChild(lbl); row.appendChild(val);
        row.addEventListener('click', () => {
            drop.classList.remove('open');
            const firstImg = (t.images || [])[0];
            if (firstImg) {
                const idx = state.gallery.images.indexOf(firstImg);
                if (idx >= 0) { state.gallery.currentIndex = idx; renderGallery(); }
            }
        });
        drop.appendChild(row);
    });
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
    if (!display) return;
    
    const curUrl = (state.gallery.images || [])[state.gallery.currentIndex];
    const owner = typeof getOwnerTradeForImageUrl === 'function' ? getOwnerTradeForImageUrl(curUrl) : null;
    const dateToUse = state.gallery.date || (owner ? normalizeDate(extractDateFromTrade(owner)) : null);
    
    if (!owner || !dateToUse) {
        display.style.display = 'none';
        return;
    }

    const trades = typeof getTradesForDate === 'function' ? getTradesForDate(dateToUse) : [];
    const tIdx = trades.indexOf(owner);
    if (tIdx < 0) {
        display.style.display = 'none';
        return;
    }

    const pnl = parseFloat(owner['Net P/L']) || 0;
    const pt = parseFloat(owner['Pt']) || 0;
    
    const pnlStr = (pnl >= 0 ? '+' : '') + Math.round(pnl);
    const ptStr = (pt >= 0 ? '+' : '') + Math.round(pt);
    
    const pnlColor = pnl > 0 ? '#2ecc71' : (pnl < 0 ? '#e74c3c' : 'var(--text)');
    const ptColor = pt > 0 ? '#2ecc71' : (pt < 0 ? '#e74c3c' : 'var(--text2)');
    
    display.style.display = 'flex';
    display.innerHTML = `
        <span style="color:var(--text2);">T${tIdx + 1},</span>
        <span style="color:${pnlColor}; margin:0 4px;">${pnlStr},</span>
        <span style="color:${ptColor}; font-size:0.85em; opacity:0.9;">${ptStr} Pt</span>
    `;
}

// ── Image count badge in tray ─────────────────────────────────────────────
function renderGalleryTrayCounter() {
    const el = document.getElementById('gv2-tray-counter');
    if (!el) return;
    const images = state.gallery.images || [];
    if (!images.length) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.textContent = `${(state.gallery.currentIndex || 0) + 1} / ${images.length}`;
}
