/**
 * @fileoverview gallery-stats.js
 * @description Computes and renders gallery stats bar, P&L pill, and trade pill.
 *   Tray state, counter, and MTM panel split into gallery-stats-b.js.
 * @exports renderGalleryStats, renderGalleryPnlPill, renderGalleryTradePill
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
        else if (dateToUse) {
            // Fallback for day-level images (OPEN/CLOSE) in individual mode
            trades = getTradesForDate(dateToUse);
        }
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
    if (!date) {
        wrap.style.display = 'none';
        return;
    }

    const trades = typeof getTradesForDate === 'function' ? getTradesForDate(date) : [];
    if (!trades.length) {
        wrap.style.display = 'none';
        return;
    }

    wrap.style.display = 'flex';
    let totalPnl = 0;
    trades.forEach(t => {
        totalPnl += (typeof getTradePnl === 'function' ? (getTradePnl(t) || 0) : 0);
    });

    const fmtPnl = v => (v < 0 ? '-' : '') + '₹' + Math.abs(Math.round(v)).toLocaleString('en-IN');
    pill.textContent = fmtPnl(totalPnl);
    pill.style.color = totalPnl > 0 ? '#2ecc71' : totalPnl < 0 ? '#e74c3c' : 'var(--text2)';

    // Dropdown Logic (Relocated from trade pill)
    drop.innerHTML = '';
    drop.onclick = e => e.stopPropagation();
    drop.style.width = '750px'; // Wider for full instrument names
    drop.style.minWidth = '580px';
    drop.style.maxWidth = '98vw';
    drop.style.boxSizing = 'border-box';
    drop.style.overflowX = 'hidden';
    drop.style.padding = '8px 0';

    const curUrl = (state.gallery.images || [])[state.gallery.currentIndex];
    const activeTrade = typeof getOwnerTradeForImageUrl === 'function' ? getOwnerTradeForImageUrl(curUrl) : null;
    const activeIdx = activeTrade ? trades.indexOf(activeTrade) : -1;

    let runningTotal = 0;
    trades.forEach((t, i) => {
        let p = 0;
        try {
            p = (typeof getTradePnl === 'function' ? (getTradePnl(t) || 0) : 0);
            if (isNaN(p)) p = 0;
        } catch(err) { p = 0; }
        runningTotal += p;
        const pt = parseFloat(t.Pt || 0) || 0;
        const lot = parseFloat(t.Qty || t.qty || t.QTY || 0) || 0;
        const buyTime = (t['Buy Time'] || t['buy_time'] || '').slice(0, 5);
        const sellTime = (t['Sell Time'] || t['sell_time'] || '').slice(0, 5);
        const type = String(t['TradeType'] || t['tradetype'] || '').toLowerCase();
        const isShort = type.includes('sell') || type.includes('short');
        const entryTime = isShort ? sellTime : buyTime;

        let dur = '';
        if (buyTime && sellTime) {
            try {
                const [h1, m1] = buyTime.split(':').map(Number);
                const [h2, m2] = sellTime.split(':').map(Number);
                const d1 = new Date(2000, 0, 1, h1, m1);
                const d2 = new Date(2000, 0, 1, h2, m2);
                const mins = Math.round(Math.abs(d2 - d1) / 60000);
                dur = mins < 60 ? mins + 'm' : Math.floor(mins / 60) + 'h' + (mins % 60 > 0 ? ' ' + (mins % 60) + 'm' : '');
            } catch(e) {}
        }

        const isActive = (i === activeIdx);
        const row = document.createElement('div');
        row.className = 'gv2-pnl-trade-row';
        row.style.display = 'grid';
        // dot | T-label | Instrument | Time+Dur+Lots | Pts | Trade P/L | Running Total
        row.style.gridTemplateColumns = '12px 35px 1.5fr 110px 52px 92px 100px';
        row.style.gap = '10px';
        row.style.alignItems = 'center';
        row.style.padding = '8px 16px';
        row.style.cursor = 'pointer';
        row.style.borderRadius = '6px';
        row.style.transition = 'background 0.15s';
        row.addEventListener('mouseenter', () => row.style.background = 'rgba(255,255,255,0.07)');
        row.addEventListener('mouseleave', () => row.style.background = '');

        // Active indicator dot
        const dot = document.createElement('span');
        dot.style.cssText = `display:inline-block; width:8px; height:8px; border-radius:50%; background:${isActive ? '#3b82f6' : 'transparent'}; flex-shrink:0;`;

        const lbl = document.createElement('span');
        lbl.className = 'gv2-pnl-trade-label';
        lbl.style.cssText = `font-weight:${isActive ? '900' : '700'}; font-size:0.82rem; color:${isActive ? '#60a5fa' : 'var(--text3)'};`;
        lbl.textContent = `T${i + 1}`;

        const rawInst = t.Instrument || t.instrument || t.Symbol || t.symbol || '';
        const instNum = rawInst.toUpperCase();
        const instText = cleanInstrumentName(rawInst);

        let instColor = '#ffd700';
        if (instNum.endsWith('CE')) instColor = '#c084fc';
        else if (instNum.endsWith('PE')) instColor = '#8b949e';

        const inst = document.createElement('span');
        inst.className = 'gv2-pnl-trade-inst';
        inst.style.cssText = `font-size:0.73rem; color:${instColor}; font-weight:700; white-space:nowrap;`;
        inst.textContent = instText || '—';

        const info = document.createElement('span');
        info.style.cssText = 'font-size:0.73rem; color:var(--text3); white-space:nowrap; overflow:hidden;';
        info.innerHTML = `<span style="color:var(--text2)">${entryTime}</span>${dur ? ` <span style="font-weight:700; color:#fff;">[${dur}]</span>` : ''}${lot ? ` <span style="color:var(--text2);">${lot}</span>` : ''}`;

        const ptWrap = document.createElement('span');
        ptWrap.textContent = Math.abs(Math.round(pt)) + ' Pt';
        ptWrap.style.cssText = `text-align:right; color:${pt >= 0 ? '#2ecc71' : '#e74c3c'}; font-size:0.78rem; font-weight:600; white-space:nowrap;`;

        const val = document.createElement('span');
        val.textContent = fmtPnl(p);
        val.style.cssText = `text-align:right; font-weight:700; font-size:0.85rem; color:${p > 0 ? '#2ecc71' : (p < 0 ? '#e74c3c' : 'var(--text2)')}; white-space:nowrap;`;

        const cumVal = document.createElement('span');
        cumVal.textContent = fmtPnl(runningTotal);
        cumVal.style.cssText = `text-align:right; font-weight:600; font-size:0.82rem; border-left:1px solid rgba(255,255,255,0.12); padding-left:8px; color:${runningTotal >= 0 ? '#2ecc71' : '#e74c3c'}; white-space:nowrap;`;

        row.appendChild(dot); row.appendChild(lbl); row.appendChild(inst); row.appendChild(info); row.appendChild(ptWrap); row.appendChild(val); row.appendChild(cumVal);
        row.addEventListener('click', () => {
             const galleryImages = state.gallery.images || [];
             const firstVisibleImg = (t.images || []).find(url => galleryImages.includes(url));
             if (firstVisibleImg) {
                 const idx = galleryImages.indexOf(firstVisibleImg);
                 if (idx >= 0) {
                     // ENSURE TRADE IS EXPANDED in thumbnail panel
                     if (state.gallery.collapsedSeparators) {
                         state.gallery.collapsedSeparators.delete('T' + tIdx);
                     }
                     state.gallery.currentIndex = idx;
                     if (typeof renderGallery === 'function') renderGallery();
                 }
             } else if (state.gallery.tagFilter?.length) {
                 if (typeof showToast === 'function') showToast('No images of this trade match the current filter', 'info');
             }
             const drop = document.getElementById('gv2-pnl-dropdown');
             if (drop) drop.classList.remove('open');
        });
        drop.appendChild(row);
    });

}

// ── Trade pill (current image's trade + its P/L) ──────────────────────────
function renderGalleryTradePill() {
    const wrap = document.getElementById('gv2-trade-pill-wrap');
    const pill = document.getElementById('gv2-trade-pill');
    if (!wrap || !pill) return;

    const date = state.gallery.date;
    if (!date) { wrap.style.display = 'none'; return; }

    const trades = typeof getTradesForDate === 'function' ? getTradesForDate(date) : [];
    if (!trades.length) { wrap.style.display = 'none'; return; }

    const curUrl = (state.gallery.images || [])[state.gallery.currentIndex];
    let owner = typeof getOwnerTradeForImageUrl === 'function' ? getOwnerTradeForImageUrl(curUrl) : null;
    if (!owner && trades.length > 0) owner = trades[0];

    const tIdx = owner ? trades.indexOf(owner) : -1;
    if (!owner || tIdx < 0) { wrap.style.display = 'none'; return; }

    const pnl = typeof getTradePnl === 'function' ? (getTradePnl(owner) || 0) : 0;
    const pt  = parseFloat(owner.Pt || 0) || 0;
    const fmtPnl = v => (v < 0 ? '-' : '') + '₹' + Math.abs(Math.round(v)).toLocaleString('en-IN');
    const ptStr  = Math.abs(Math.round(pt)) + ' Pt';
    const cls    = pnl > 0 ? 'pos' : pnl < 0 ? 'neg' : '';
    const ptCls  = pt  > 0 ? 'pos' : pt  < 0 ? 'neg' : '';

    const rawInst = owner.Instrument || owner.instrument || owner.Symbol || owner.symbol || '';
    const instNum = rawInst.toUpperCase();
    const instText = cleanInstrumentName(rawInst);

    const buyTime = (owner['Buy Time'] || owner['buy_time'] || '').slice(0, 5);
    const sellTime = (owner['Sell Time'] || owner['sell_time'] || '').slice(0, 5);
    const type = String(owner['TradeType'] || owner['tradetype'] || '').toLowerCase();
    const isShort = type.includes('sell') || type.includes('short');
    const entryTime = isShort ? sellTime : buyTime;

    let dur = '';
    if (buyTime && sellTime) {
        try {
            const [h1, m1] = buyTime.split(':').map(Number);
            const [h2, m2] = sellTime.split(':').map(Number);
            const d1 = new Date(2000, 0, 1, h1, m1);
            const d2 = new Date(2000, 0, 1, h2, m2);
            const mins = Math.round(Math.abs(d2 - d1) / 60000);
            dur = mins < 60 ? mins + 'm' : Math.floor(mins / 60) + 'h' + (mins % 60 > 0 ? (mins % 60) + 'm' : '');
        } catch(e) {}
    }

    const lot = parseFloat(owner.Qty || owner.qty || owner.QTY || 0) || 0;
    let runningTotal = 0;
    for (let i = 0; i <= tIdx; i++) {
        runningTotal += (typeof getTradePnl === 'function' ? (getTradePnl(trades[i]) || 0) : 0);
    }

    pill.classList.add('active');
    const badgeBg  = pnl > 0 ? '#16a34a' : pnl < 0 ? '#dc2626' : '#3b82f6';
    wrap.style.display = 'flex';
    
    // Add prominent highlight matching the floating tray
    pill.style.boxShadow = `0 0 15px ${badgeBg}, inset 0 0 10px rgba(255,255,255,0.1)`;
    pill.style.borderColor = 'rgba(255,255,255,0.4)';
    pill.style.background = 'rgba(255,255,255,0.08)';
    pill.style.transform = 'scale(1.02)';
    pill.innerHTML =
        `<span style="display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;padding:0 5px;border-radius:12px;background:${badgeBg};font-weight:900;font-size:0.78rem;color:#fff;line-height:1;flex-shrink:0;letter-spacing:-0.3px;">T${tIdx + 1}</span>`
      + `<span class="gv2-tp-inst" style="margin-left:8px; font-weight:700; color:#fff; font-size:0.85rem; letter-spacing:0.2px;">${instText}</span>`
      + `<span class="gv2-tp-info" style="margin-left:8px; font-size:0.75rem; color:rgba(255,255,255,0.5); border-left:1px solid rgba(255,255,255,0.1); padding-left:8px;">`
         + `<span style="color:#fff">${entryTime}</span>`
         + `${dur ? ` <span style="color:#fff; font-weight:700;">[${dur}]</span>` : ''}`
         + `${lot ? ` <span style="color:var(--text3);">${lot}L</span>` : ''}`
      + `</span>`
      + `<span class="gv2-tp-val ${cls}" style="margin-left:12px; font-weight:700;">${fmtPnl(pnl)}</span>`
      + `<span class="gv2-tp-val ${ptCls}" style="margin-left:6px;">${ptStr}</span>`
      + `<span class="gv2-tp-total" style="margin-left:12px; font-size:0.78rem; font-weight:600; color:${runningTotal >= 0 ? '#2ecc71' : '#e74c3c'}; background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:10px;">`
         + `Total: ${fmtPnl(runningTotal)}`
      + `</span>`;
}

// renderGalleryTrayState, renderGalleryTradeInfoDisplay, renderGalleryTrayCounter, renderGalleryMtmPanel
// → moved to gallery-stats-b.js
