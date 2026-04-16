# JS - Gallery Features (stats, split-view, ref-cards)
Consolidated code context for AI assistants.


## File: `static/js/gallery-stats.js`
```js
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
        const m = instNum.match(/^([A-Z]+)(\d{2})([1-9OND])(\d{2})(\d+)(CE|PE)$/);
        const instText = m ? `${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]} ${m[6]}` : instNum;

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
    const m = instNum.match(/^([A-Z]+)(\d{2})([1-9OND])(\d{2})(\d+)(CE|PE)$/);
    const instText = m ? `${m[5]} ${m[6]}` : instNum;

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

```

## File: `static/js/gallery-stats-b.js`
```js
/**
 * @fileoverview gallery-stats-b.js
 * @description Gallery tray state, counter, trade info display, and MTM equity curve panel.
 *   Extracted from gallery-stats.js to keep that file under 30 KB.
 * @exports renderGalleryTrayState, renderGalleryTradeInfoDisplay, renderGalleryTrayCounter,
 *          renderGalleryMtmPanel
 * @reads state.gallery.{date,images,currentIndex}, state.dayData, state.trades
 * @calls getTradesForDate, getTradePnl, fmtPnl, getOwnerTradeForImageUrl, renderGallery
 */

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

// ── MTM / Day Equity Curve Panel Rendering ──────────────────────────────
function renderGalleryMtmPanel(panel) {
    if (!panel) return;
    const trades = getTradesForDate(state.gallery.date || '');

    panel.innerHTML = `
        <div style="font-size:1.1rem; font-weight:bold; margin-bottom:20px; color:#fff; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:10px;">
                <span id="gv2-mtm-icon" style="font-size:1.4rem;">📈</span>
                <span>Day Equity Curve (MTM)</span>
            </div>
            <span id="gv2-mtm-total-val" style="font-size:1.5rem; font-weight:900;">...</span>
        </div>
        <div id="gv2-mtm-svg-wrap" style="width:100%; height:280px; position:relative; background:rgba(0,0,0,0.35); border-radius:12px; border:1px solid rgba(255,255,255,0.08); overflow:hidden; cursor:crosshair;">
            <div id="gv2-mtm-tooltip" style="position:absolute; pointer-events:none; background:rgba(30,35,45,0.95); border:1px solid rgba(255,255,255,0.3); padding:8px 12px; border-radius:8px; font-size:0.8rem; color:#fff; z-index:9999; display:none; white-space:nowrap; box-shadow:0 6px 20px rgba(0,0,0,0.6);"></div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#aaa; margin-top:15px; padding:0 8px; font-weight:500;">
            <div style="display:flex; flex-direction:column; gap:4px;">
                <span style="color:#666; font-size:0.75rem; text-transform:uppercase;">Entry</span>
                <span style="color:#fff;">Market Open</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-end;">
                <span style="color:#666; font-size:0.75rem; text-transform:uppercase;">Status</span>
                <span id="gv2-mtm-current-label" style="color:#fff;">${trades.length} Operations Completed</span>
            </div>
        </div>
    `;

    requestAnimationFrame(() => {
        const wrap = document.getElementById('gv2-mtm-svg-wrap');
        const tooltip = document.getElementById('gv2-mtm-tooltip');
        const totalEl = document.getElementById('gv2-mtm-total-val');
        const iconEl = document.getElementById('gv2-mtm-icon');
        if (!wrap) return;

        if (trades.length < 1) {
            wrap.innerHTML = '<div style="display:grid; place-items:center; height:100%; color:#555; font-size:1.1rem; letter-spacing:1px;">No data recorded yet</div>';
            if (totalEl) totalEl.textContent = '₹0.00';
            return;
        }

        const w = wrap.clientWidth || wrap.getBoundingClientRect().width || 560;
        const h = wrap.clientHeight || wrap.getBoundingClientRect().height || 280;

        let runTotal = 0;
        const trajData = [{ val: 0, index: 0, inst: 'Initial', trade: null }];
        trades.forEach((t, i) => {
            runTotal += (typeof getTradePnl === 'function' ? (getTradePnl(t) || 0) : 0);
            trajData.push({ val: runTotal, index: i + 1, inst: t.Instrument, trade: t });
        });

        const traj = trajData.map(d => d.val);
        const finalPnl = runTotal;
        const isGreen = finalPnl >= 0;
        const themeColor = isGreen ? '#3fb950' : '#ff3e3e';

        if (totalEl) {
            totalEl.style.color = themeColor;
            totalEl.textContent = (typeof fmtPnl === 'function') ? fmtPnl(finalPnl) : finalPnl.toFixed(2);
        }
        if (iconEl) iconEl.textContent = isGreen ? '💰' : '📉';

        const min = Math.min(...traj);
        const max = Math.max(...traj);
        const range = (max - min) || 1;
        const padY = 50;

        const pts = trajData.map((d, i) => {
            const x = (i / (trajData.length - 1)) * w;
            const y = h - padY - ((d.val - min) / range) * (h - padY * 2);
            return { x, y, ...d };
        });

        // Identify points of interest (peak, trough)
        const peak = pts.reduce((a, b) => a.val > b.val ? a : b);
        const trough = pts.reduce((a, b) => a.val < b.val ? a : b);

        const pathData = pts.map((p, i) => (i === 0 ? 'M' : 'L') + `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        const fillData = pathData + ` L${w},${h} L0,${h} Z`;
        const zeroY = h - padY - ((0 - min) / range) * (h - padY * 2);

        const svgHtml = `
            <svg width="${w}" height="${h}" id="gv2-mtm-svg" style="display:block; pointer-events:none;">
                <defs>
                    <linearGradient id="mtm-grad-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:${themeColor}; stop-opacity:0.25" />
                        <stop offset="100%" style="stop-color:${themeColor}; stop-opacity:0" />
                    </linearGradient>
                    <filter id="mtm-glow-f" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3.5" result="blur"/>
                        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                </defs>
                <line x1="0" y1="${zeroY}" x2="${w}" y2="${zeroY}" stroke="rgba(255,255,255,0.1)" stroke-width="1.2" stroke-dasharray="6 6" />

                <path d="${fillData}" fill="url(#mtm-grad-fill)" />
                <path d="${pathData}" stroke="${themeColor}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#mtm-glow-f)" />

                <!-- Axis Markers for Peak/Trough -->
                <text x="${peak.x}" y="${peak.y - 12}" fill="${themeColor}" font-size="10" text-anchor="middle" font-weight="900" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8))">PEAK: ${peak.val.toFixed(0)}</text>
                <text x="${trough.x}" y="${trough.y + 20}" fill="#ff3e3e" font-size="10" text-anchor="middle" font-weight="900" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8))">LOW: ${trough.val.toFixed(0)}</text>

                <g id="gv2-mtm-circles">
                    ${pts.map((p, i) => i > 0 ? `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#fff" stroke="${themeColor}" stroke-width="2" />` : '').join('')}
                </g>

                <line id="gv2-mtm-l-track" x1="0" y1="0" x2="0" y2="${h}" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" style="display:none" />
                <circle id="gv2-mtm-c-track" r="6" fill="#fff" stroke="${themeColor}" stroke-width="3" style="display:none; filter:url(#mtm-glow-f)" />
            </svg>
        `;
        // Critical Fix: Append without destroying existing nodes (like tooltip)
        wrap.insertAdjacentHTML('beforeend', svgHtml);

        const findClosest = (mx) => {
            let closest = pts[0];
            let minDist = Math.abs(mx - pts[0].x);
            for(let i=1; i < pts.length; i++){
                const d = Math.abs(mx - pts[i].x);
                if(d < minDist) { minDist = d; closest = pts[i]; }
            }
            return closest;
        };

        // Interaction
        wrap.onmousemove = (e) => {
            const rect = wrap.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const closest = findClosest(mx);

            const track = document.getElementById('gv2-mtm-l-track');
            const tdot = document.getElementById('gv2-mtm-c-track');
            if(track && tdot) {
                track.setAttribute('x1', closest.x);
                track.setAttribute('x2', closest.x);
                track.style.display = 'block';
                tdot.setAttribute('cx', closest.x);
                tdot.setAttribute('cy', closest.y);
                tdot.style.display = 'block';
            }

            if(tooltip) {
                tooltip.style.display = 'block';
                const tipW = 140;
                let tx = closest.x + 15;
                if (tx + tipW > w) tx = closest.x - tipW - 15;
                tooltip.style.left = tx + 'px';
                tooltip.style.top = Math.max(10, Math.min(h - 80, closest.y - 40)) + 'px';

                const valStr = (typeof fmtPnl === 'function') ? fmtPnl(closest.val) : closest.val.toFixed(2);
                tooltip.innerHTML = `
                    <div style="font-weight:900; border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom:6px; padding-bottom:4px; font-size:0.9rem;">
                        ${closest.index === 0 ? 'Start' : 'Trade T' + closest.index}
                    </div>
                    <div style="color:${closest.val >= 0 ? '#3fb950' : '#ff3e3e'}; font-size:1.2rem; font-weight:900; letter-spacing:0.5px;">
                        ${valStr}
                    </div>
                    <div style="font-size:0.6rem; color:#bbb; margin-top:4px; max-width:140px; overflow:hidden; text-overflow:ellipsis;">
                        ${closest.inst || ''}
                    </div>
                    <div style="font-size:0.55rem; color:var(--blue); margin-top:4px; text-transform:uppercase; letter-spacing:1px; font-weight:bold;">Click to view Trade</div>
                `;
            }
        };

        wrap.onclick = (e) => {
            const rect = wrap.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const closest = findClosest(mx);
            if (!closest) return;

            // 1. GRID VIEW NAVIGATION (Scroll to trade section)
            if (typeof isGridViewOpen === 'function' && isGridViewOpen()) {
                const body = document.getElementById('gv2-grid-body');
                if (!body) return;
                const targetId = closest.index === 0 ? 'grid-group-open' : 'grid-group-trade-' + (closest.index - 1);
                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    targetEl.style.transition = 'background 0.3s';
                    targetEl.style.background = 'rgba(88,166,255,0.1)';
                    setTimeout(() => targetEl.style.background = '', 800);
                }
                return;
            }

            // 2. STANDARD VIEW NAVIGATION (Jump to image)
            if (!closest.trade) return;
            const targetTrade = closest.trade;
            const galleryImages = state.gallery.images || [];

            // Find index of first image owned by this trade
            const idx = galleryImages.findIndex(url => {
                const owner = typeof getOwnerTradeForImageUrl === 'function' ? getOwnerTradeForImageUrl(url) : null;
                return owner === targetTrade;
            });

            if (idx !== -1) {
                state.gallery.currentIndex = idx;
                if (typeof renderGallery === 'function') renderGallery();
            }
        };

        wrap.onmouseleave = () => {
            document.getElementById('gv2-mtm-l-track')?.setAttribute('style', 'display:none');
            document.getElementById('gv2-mtm-c-track')?.setAttribute('style', 'display:none');
            if(tooltip) tooltip.style.display = 'none';
        };
    });
}

```

## File: `static/js/gallery-split-view.js`
```js
// gallery-split-view.js — TradingView-style split canvas for gallery
// Left panel: user pins any image (📌) → auto-saved to trade's ref card INDEX
// Right panel: always shows current gallery image (navigates normally)
// Both panels: independent zoom/pan (wheel + drag, double-click to reset)

const _splitState = {
  left:  { scale: 1, tx: 0, ty: 0, url: null, rawUrl: null },
  right: { scale: 1, tx: 0, ty: 0 }
};

function getSplitViewState() {
  return {
    left:  { ..._splitState.left, url: _splitState.left.rawUrl || _splitState.left.url },
    right: {
      ..._splitState.right,
      url: (state.gallery.images || [])[state.gallery.currentIndex] || null
    }
  };
}

/** Reconstructs a saved view (URLs + transforms) in both panels. */
function applySplitViewState(data) {
  if (!data) return;
  if (!state.gallery.splitView) toggleSplitView(); // Turn on split mode

  const _res = (u) => {
    if (!u) return '';
    if (u.startsWith('http') || u.startsWith('blob:') || u.startsWith('data:')) return u;
    
    // Self-Correction: Fix stripped paths
    let target = u;
    if (!u.includes('/') && u.includes('.')) {
        const images = state.gallery.images || [];
        const full = images.find(img => img === u || img.endsWith('/' + u));
        if (full) target = full;
        else console.warn('Trade Review: Old corrupted path detected for:', u, '. Please re-pin and save this view.');
    }

    let final = target;
    if (!final.startsWith('/uploads/') && !final.startsWith('/static/')) {
        final = typeof resolveImageUrl === 'function' ? resolveImageUrl(target) : target;
    }
    return final.replace(/\/+/g, '/').replace(':/', '://');
  };

  // 1. Left Panel (Stored as 'index' in Ref Card)
  const lData = (typeof data.index === 'object' && data.index !== null) ? data.index : (data.index ? { url: data.index } : null);
  if (lData && lData.url) {
    const finalUrl = _res(lData.url);
    _splitState.left.url = finalUrl;
    _splitState.left.rawUrl = lData.url;
    
    const lImg = document.getElementById('gv2-split-left-img');
    const lEmp = document.getElementById('gv2-split-left-empty');
    if (lImg) {
      // Define handlers BEFORE setting src
      lImg.onload = () => { 
        lImg.style.display = ''; 
        if (lEmp) lEmp.style.display = 'none'; 
        _fitPanel('left');
      };
      lImg.onerror = () => { 
        console.error('Split Left Load Fail:', finalUrl);
        lImg.style.display = 'none';
        if (lEmp) lEmp.style.display = '';
      };

      
      lImg.src = finalUrl;
      
      _splitState.left.scale = lData.scale || 1;
      _splitState.left.tx    = lData.tx || 0;
      _splitState.left.ty    = lData.ty || 0;
      _applyTransform('left');
    }
  }



  // 2. Right Panel (Stored as 'premium' in Ref Card)
  const rData = (typeof data.premium === 'object' && data.premium !== null) ? data.premium : (data.premium ? { url: data.premium } : null);
  if (rData && rData.url) {
    // Navigate main gallery to this image
    const images = state.gallery.images || [];
    const targetUrl = rData.url; 
    
    let idx = images.indexOf(targetUrl);
    if (idx === -1) {
        const cleaned = targetUrl.split('?')[0];
        idx = images.findIndex(u => u === targetUrl || u.includes(cleaned));
    }
    
    if (idx !== -1) {
      state.gallery.currentIndex = idx;
      if (typeof renderGallery === 'function') renderGallery();
      
      _splitState.right.scale = rData.scale || 1;
      _splitState.right.tx    = rData.tx || 0;
      _splitState.right.ty    = rData.ty || 0;
      setTimeout(() => _applyTransform('right'), 50);
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

function initSplitView() {
  const btn = document.getElementById('gv2-split-toggle-btn');
  if (btn) {
    btn.addEventListener('click', () => toggleSplitView());
  }

  // Split panel nav arrows (Right side — main gallery nav)
  const spPrev = document.getElementById('gv2-split-nav-prev');
  const spNext = document.getElementById('gv2-split-nav-next');
  if (spPrev) spPrev.addEventListener('click', e => { e.stopPropagation(); if (typeof navigateGallery === 'function') navigateGallery(-1); });
  if (spNext) spNext.addEventListener('click', e => { e.stopPropagation(); if (typeof navigateGallery === 'function') navigateGallery(1); });

  // Split panel nav arrows (Left side — independent reference nav)
  const splPrev = document.getElementById('gv2-split-left-nav-prev');
  const splNext = document.getElementById('gv2-split-left-nav-next');
  if (splPrev) splPrev.addEventListener('click', e => { e.stopPropagation(); navigateSplitLeft(-1); });
  if (splNext) splNext.addEventListener('click', e => { e.stopPropagation(); navigateSplitLeft(1); });

  // Delegated button clicks
  document.addEventListener('click', e => {
    if (!state.gallery.splitView) return;
    if (e.target.closest('#gv2-split-pin-btn')) {
      const rightImg = document.getElementById('gv2-split-right-img');
      if (rightImg && rightImg.src && !rightImg.src.endsWith('/')) {
        pinToLeft(rightImg.src, true); // true = save to ref card
      }
    }
    if (e.target.closest('#gv2-split-left-reset'))  _resetPanel('left');
    if (e.target.closest('#gv2-split-right-reset')) _resetPanel('right');
  });

  _bindPanelZoomPan('left');
  _bindPanelZoomPan('right');
  _bindDivider();
}

/** Navigates the pinned image in the left panel independently. */
function navigateSplitLeft(dir) {
    if (!state.gallery.splitView) return;
    const url = _splitState.left.rawUrl || _splitState.left.url;
    if (!url) {
        // If empty, start from first image
        const images = state.gallery.images || [];
        if (images.length) pinToLeft(images[0], true);
        return;
    }
    const images = state.gallery.images || [];
    let idx = images.indexOf(url);
    if (idx === -1) {
        const cleaned = url.split('?')[0];
        idx = images.findIndex(u => u === url || u.includes(cleaned));
    }
    if (idx === -1) return;
    let nextIdx = idx + dir;
    if (nextIdx < 0) nextIdx = 0;
    if (nextIdx >= images.length) nextIdx = images.length - 1;
    if (nextIdx === idx) return;
    
    pinToLeft(images[nextIdx], true);
}

function toggleSplitView() {
  state.gallery.splitView = !state.gallery.splitView;
  _applySplitMode();
}

/** Called from gallery-render.js whenever the main image changes.
 *  ONLY updates right panel — left panel is never touched during navigation. */
function updateSplitRight(url) {
  if (!state.gallery.splitView) return;
  const img = document.getElementById('gv2-split-right-img');
  if (!img) return;
  img.onload = () => _fitPanel('right');
  img.src = resolveImageUrl ? resolveImageUrl(url) : url;
}

/** Pin url to left panel. If save=true, also persist to dayData ref card. */
function pinToLeft(url, save = false) {
  if (!url) return;
  const resolved = typeof resolveImageUrl === 'function' ? resolveImageUrl(url) : url;
  _splitState.left.url = resolved;
  _splitState.left.rawUrl = url;

  const img   = document.getElementById('gv2-split-left-img');
  const empty = document.getElementById('gv2-split-left-empty');
  if (!img) return;
  img.src = resolved;
  img.style.display = '';
  if (empty) empty.style.display = 'none';
  _resetPanel('left');


  if (save) _saveLeftToRefCard(resolved);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _applySplitMode() {
  const on = !!state.gallery.splitView;
  const container = document.getElementById('gv2-split-container');
  const zoomLayer = document.getElementById('gallery-zoom-layer');
  const navPrev   = document.getElementById('gallery-prev');
  const navNext   = document.getElementById('gallery-next');
  const syncBtn = (b) => {
    if (!b) return;
    b.style.background  = on ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)';
    b.style.borderColor = on ? 'rgba(99,102,241,0.6)'  : 'rgba(255,255,255,0.1)';
    b.style.color       = on ? '#818cf8' : '';
    // Special handle for tray button if it has different brand color (purple/violet)
    if (b.classList.contains('split-toggle-btn') && b.closest('#close-global-tray')) {
      b.style.background  = on ? 'rgba(139, 92, 246, 0.25)' : 'rgba(139, 92, 246, 0.12)';
      b.style.borderColor = on ? 'rgba(139, 92, 246, 0.6)'  : 'rgba(139, 92, 246, 0.3)';
      b.style.color       = on ? '#a78bfa' : '#a78bfa';
    }
  };

  const btn = document.getElementById('gv2-split-toggle-btn');
  if (btn) syncBtn(btn);
  const trayBtn = document.querySelector('#close-global-tray .split-toggle-btn');
  if (trayBtn) syncBtn(trayBtn);

  if (container) container.style.display = on ? 'flex' : 'none';
  if (zoomLayer) zoomLayer.style.display = on ? 'none' : '';
  if (navPrev)   navPrev.style.display   = on ? 'none' : '';
  if (navNext)   navNext.style.display   = on ? 'none' : '';

  if (on) {
    // Populate right panel with current image
    const curUrl = (state.gallery.images || [])[state.gallery.currentIndex] || '';
    if (curUrl) {
      const rImg = document.getElementById('gv2-split-right-img');
      if (rImg) rImg.src = resolveImageUrl ? resolveImageUrl(curUrl) : curUrl;
    }
    // Left panel: only auto-load once when split opens (from saved ref card)
    if (!_splitState.left.url) _autoLoadRefCardLeft();

    // Ensure initial fit after container is shown/resized
    setTimeout(() => {
        _fitPanel('left');
        _fitPanel('right');
    }, 50);
  }
}

/** Auto-load ref card INDEX for current trade into left panel.
 *  Called ONCE when split view opens (if left panel is empty).
 *  Never called during navigation — left panel only changes via 📌 button. */
function _autoLoadRefCardLeft() {
  const date   = state.gallery.date;
  const curUrl = (state.gallery.images || [])[state.gallery.currentIndex] || '';
  if (!date || !curUrl) return;

  const ownerTrade = typeof getOwnerTradeForImageUrl === 'function' ? getOwnerTradeForImageUrl(curUrl) : null;
  if (!ownerTrade) return;

  const dayTrades = typeof getTradesForDate === 'function' ? getTradesForDate(date) : [];
  const idx = dayTrades.indexOf(ownerTrade);
  if (idx < 0) return;

  const refCard = state.dayData[date]?.tradeRefCards?.[idx];
  if (refCard?.index) pinToLeft(refCard.index, false);
}

/** Save the left panel URL to current trade's ref card INDEX. */
function _saveLeftToRefCard(url) {
  const date   = state.gallery.date;
  const curUrl = (state.gallery.images || [])[state.gallery.currentIndex] || '';
  if (!date || !curUrl) return;

  const ownerTrade = typeof getOwnerTradeForImageUrl === 'function' ? getOwnerTradeForImageUrl(curUrl) : null;
  if (!ownerTrade) return;

  const dayTrades = typeof getTradesForDate === 'function' ? getTradesForDate(date) : [];
  const idx = dayTrades.indexOf(ownerTrade);
  if (idx < 0) return;

  // Store the pathname (strip origin so it's portable)
  const storedUrl = _pathOnly(url);

  const dData = state.dayData[date] = state.dayData[date] || {};
  dData.tradeRefCards = dData.tradeRefCards || {};
  dData.tradeRefCards[idx] = dData.tradeRefCards[idx] || {};
  dData.tradeRefCards[idx].index = storedUrl;
  saveTrades();
  showToast('Saved to T' + (idx + 1) + ' ref card', 'success');
}

function _pathOnly(src) {
  try { return new URL(src).pathname; } catch { return src; }
}

/** 
 * Automatically fits the image to the panel at its highest resolution.
 * Replaces 'object-fit: contain' to avoid iPad pixelation.
 */
function _fitPanel(side) {
  const imgId = side === 'left' ? 'gv2-split-left-img' : 'gv2-split-right-img';
  const panelId = side === 'left' ? 'gv2-split-left' : 'gv2-split-right';
  const img = document.getElementById(imgId);
  const panel = document.getElementById(panelId);
  if (!img || !panel || !img.naturalWidth) return;
  
  const pw = panel.offsetWidth;
  const ph = panel.offsetHeight;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!pw || !ph || !iw || !ih) return;

  const scale = Math.min(pw / iw, ph / ih);
  const st = _splitState[side];
  st.scale = scale;
  // Center it initially
  st.tx = (pw - iw * scale) / 2;
  st.ty = (ph - ih * scale) / 2;
  _applyTransform(side);
}

function _resetPanel(side) {
  _fitPanel(side);
}

function _applyTransform(side) {
  const imgId = side === 'left' ? 'gv2-split-left-img' : 'gv2-split-right-img';
  const el = document.getElementById(imgId);
  if (!el) return;
  const { scale, tx, ty } = _splitState[side];
  // Apply transform with translate3d for GPU optimization
  el.style.transform = `translate3d(${tx}px,${ty}px,0) scale(${scale})`;
}

function _bindPanelZoomPan(side) {
  const panelId = side === 'left' ? 'gv2-split-left' : 'gv2-split-right';
  const panel   = document.getElementById(panelId);
  if (!panel) return;

  // Per-panel drag state (closure, not shared)
  let dragging = false, lastX = 0, lastY = 0;

  panel.addEventListener('wheel', e => {
    if (!state.gallery.splitView) return;
    e.preventDefault();
    const st     = _splitState[side];
    const rect   = panel.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const factor   = e.deltaY < 0 ? 1.12 : (1 / 1.12);
    const newScale = Math.max(0.2, Math.min(20, st.scale * factor));
    st.tx    = cx - (cx - st.tx) * (newScale / st.scale);
    st.ty    = cy - (cy - st.ty) * (newScale / st.scale);
    st.scale = newScale;
    _applyTransform(side);
  }, { passive: false });

  panel.addEventListener('mousedown', e => {
    if (!state.gallery.splitView) return;
    if (e.target.closest('button') || e.target.id === 'gv2-split-divider') return;
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    panel.style.cursor = 'grabbing';
    e.preventDefault();
  });

  const onMove = e => {
    if (!dragging || !state.gallery.splitView) return;
    const st = _splitState[side];
    st.tx += e.clientX - lastX;
    st.ty += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    _applyTransform(side);
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    panel.style.cursor = 'grab';
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);

  panel.addEventListener('mouseup', onUp);

  // ── Touch Zoom & Pan (iPad) ────────────────────────────────────────────────
  let tDist = 0, tMidX = 0, tMidY = 0;

  panel.addEventListener('touchstart', e => {
    if (!state.gallery.splitView || e.target.closest('button')) return;
    e.stopPropagation(); // Prevent parent wrapper from seeing this touch
    if (e.touches.length === 1) {
      dragging = true;
      lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      dragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      tDist = Math.sqrt(dx*dx + dy*dy);
      const rect = panel.getBoundingClientRect();
      tMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      tMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
    }
  }, { passive: false });

  panel.addEventListener('touchmove', e => {
    if (!state.gallery.splitView) return;
    e.stopPropagation(); // Prevent parent wrapper from seeing this move
    e.preventDefault();
    const st = _splitState[side];

    if (e.touches.length === 1 && dragging) {
      st.tx += e.touches[0].clientX - lastX;
      st.ty += e.touches[0].clientY - lastY;
      lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
      _applyTransform(side);
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newD = Math.sqrt(dx*dx + dy*dy);
      if (newD > 5 && tDist > 0) {
        const factor = newD / tDist;
        const nScale = Math.max(0.2, Math.min(20, st.scale * factor));
        st.tx = tMidX - (tMidX - st.tx) * (nScale / st.scale);
        st.ty = tMidY - (tMidY - st.ty) * (nScale / st.scale);
        st.scale = nScale;
        tDist = newD;
        _applyTransform(side);
      }
    }
  }, { passive: false });

  panel.addEventListener('touchend', e => { 
    if (state.gallery.splitView) e.stopPropagation();
    dragging = false; tDist = 0; 
  });
  panel.addEventListener('touchcancel', e => { 
    if (state.gallery.splitView) e.stopPropagation();
    dragging = false; tDist = 0; 
  });

  // ── Double Tap Reset (iPad) ────────────────────────────────────────────────
  let lastTap = 0;
  panel.addEventListener('touchstart', e => {
      if (e.touches.length > 1) return;
      const now = Date.now();
      if (now - lastTap < 300) {
          e.preventDefault();
          _resetPanel(side);
          lastTap = 0;
      } else {
          lastTap = now;
      }
  }, { passive: false });

  document.addEventListener('dblclick', e => {
    if (!state.gallery.splitView) return;
    const panel = document.getElementById(panelId);
    if (!panel || !panel.contains(e.target) || e.target.closest('button')) return;
    _resetPanel(side);
  });
}

function _bindDivider() {
  const container = document.getElementById('gv2-split-container');
  const divider   = document.getElementById('gv2-split-divider');
  const leftPanel = document.getElementById('gv2-split-left');

  if (!divider || !container || !leftPanel) return;

  let startX = 0;
  let startW = 0;

  const onMove = (clientX) => {
    const totalW = container.getBoundingClientRect().width;
    if (!totalW) return;
    const newW = startW + clientX - startX;
    const pct  = Math.max(15, Math.min(85, (newW / totalW) * 100));
    leftPanel.style.flex = `0 0 ${pct}%`;
  };

  // Mouse handlers
  const onMouseMove = (e) => onMove(e.clientX);
  const onMouseUp = () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  // Touch handlers
  const onTouchMove = (e) => {
    if (e.touches.length !== 1) return;
    onMove(e.touches[0].clientX);
    if (e.cancelable) e.preventDefault();
  };
  const onTouchEnd = () => {
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);
    document.body.style.userSelect = '';
  };

  // Start dragging (Mouse)
  divider.addEventListener('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();
    const lRect = leftPanel.getBoundingClientRect();
    startX = e.clientX;
    startW = lRect.width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  // Start dragging (Touch/iPad)
  divider.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    e.stopPropagation();
    const lRect = leftPanel.getBoundingClientRect();
    startX = e.touches[0].clientX;
    startW = lRect.width;
    document.body.style.userSelect = 'none';
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
  }, { passive: true });
}

document.addEventListener('DOMContentLoaded', initSplitView);

```

## File: `static/js/gallery-ref-cards.js`
```js
// gallery-ref-cards.js — Trade Reference Cards (dual-panel index/premium snapshots)
// Each trade separator gets a ref card: two image slots (Index | Premium)
// Data: state.dayData[date].tradeRefCards[tradeIdx] = { index, premium, indexLocked, premiumLocked }
// Click on loaded image → opens fullscreen lightbox viewer

/**
 * Build and return the ref card DOM element for a given trade separator.
 * Returns null if ref cards are hidden.
 */
function createRefCardElement(tradeIdx, tradeObj, date) {
  if (state.gallery.showRefCards === false) return null;

  const dData = state.dayData[date] = state.dayData[date] || {};
  dData.tradeRefCards = dData.tradeRefCards || {};
  const card = dData.tradeRefCards[tradeIdx] || {};

  const el = document.createElement('div');
  el.className = 'gv2-ref-card';
  el.dataset.tradeIdx = tradeIdx;
  el.dataset.date = date;

  el.appendChild(_buildRefHalf('index',   'INDEX',   card.index,   !!card.indexLocked,   tradeIdx, date));

  const divider = document.createElement('div');
  divider.className = 'gv2-ref-divider';
  el.appendChild(divider);

  el.appendChild(_buildRefHalf('premium', 'PREMIUM', card.premium, !!card.premiumLocked, tradeIdx, date));

  return el;
}

function _buildRefHalf(side, label, data, locked, tradeIdx, date) {
  const half = document.createElement('div');
  half.className = 'gv2-ref-half';
  half.style.overflow = 'hidden'; // Important for zoomed images

    const url = (typeof data === 'object' && data !== null) ? data.url : data;
    
    // Self-Correction: Fix stripped/broken Cloudinary paths
    let targetU = url;
    if (url && !url.includes('/') && url.includes('.')) {
        // Old-format: bare filename
        const images = state.gallery.images || [];
        const full = images.find(img => img.includes(url));
        if (full) targetU = full;
    } else if (url && url.startsWith('/') && !url.startsWith('/uploads/') && !url.startsWith('/static/')) {
        // Broken Cloudinary URL: stripped to pathname only
        const filename = url.split('/').pop();
        const images = state.gallery.images || [];
        const full = images.find(img => img.endsWith('/' + filename) || img.includes(filename));
        if (full) targetU = full;
    }

    if (url) {
      // ── Loaded image ──────────────────────────────────────────────────────
      const imgCont = document.createElement('div');
      imgCont.style.cssText = 'width:100%; height:100%; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center;';
      
      const img = document.createElement('img');
      img.className = 'gv2-ref-img';
      img.src = resolveImageUrl ? resolveImageUrl(targetU) : targetU;
      img.alt = label;

    
    // Apply transform if stored as object
    if (typeof data === 'object' && data !== null) {
        const { scale, tx, ty } = data;
        img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
        img.style.transformOrigin = 'center';
    }

    // Broken image state (404 etc.)
    img.onerror = () => {
      imgCont.style.display = 'none';
      half.classList.add('gv2-ref-broken');
      const brk = document.createElement('div');
      brk.className = 'gv2-ref-empty';
      brk.innerHTML = `<span class="gv2-ref-lbl" style="color:#f87171">${label}</span><span class="gv2-ref-add" style="color:#f87171;font-size:1rem;">⚠</span>`;
      half.insertBefore(brk, imgCont);
    };
    imgCont.appendChild(img);
    half.appendChild(imgCont);

    // ── Overlay (visible on hover) ────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.className = 'gv2-ref-overlay';

    const lbl = document.createElement('span');
    lbl.className = 'gv2-ref-lbl';
    lbl.textContent = label;
    overlay.appendChild(lbl);

    const actions = document.createElement('div');
    actions.className = 'gv2-ref-actions';

    // 🔍 View fullscreen (always available)
    const viewBtn = document.createElement('button');
    viewBtn.className = 'gv2-ref-view-btn';
    viewBtn.title = 'View fullscreen';
    viewBtn.textContent = '🔍';
    viewBtn.addEventListener('click', e => {
      e.stopPropagation();
      _openRefCardLightbox(resolveImageUrl ? resolveImageUrl(url) : url, label);
    });
    actions.appendChild(viewBtn);

    // 🔒 Lock toggle
    const lockBtn = document.createElement('button');
    lockBtn.className = 'gv2-ref-lock-btn' + (locked ? ' locked' : '');
    lockBtn.title = locked ? 'Unlock' : 'Lock image';
    lockBtn.textContent = locked ? '🔒' : '🔓';
    lockBtn.addEventListener('click', e => { e.stopPropagation(); _refCardToggleLock(tradeIdx, side, date); });
    actions.appendChild(lockBtn);

    if (!locked) {
      // 📷 Replace image
      const replBtn = document.createElement('button');
      replBtn.className = 'gv2-ref-repl-btn';
      replBtn.title = 'Replace image';
      replBtn.textContent = '📷';
      replBtn.addEventListener('click', e => { e.stopPropagation(); _refCardPickImage(tradeIdx, side, date); });
      actions.appendChild(replBtn);

      // ✕ Remove
      const clearBtn = document.createElement('button');
      clearBtn.className = 'gv2-ref-clear-btn';
      clearBtn.title = 'Remove image';
      clearBtn.textContent = '✕';
      clearBtn.addEventListener('click', e => { e.stopPropagation(); _refCardClearImage(tradeIdx, side, date); });
      actions.appendChild(clearBtn);
    }

    overlay.appendChild(actions);
    half.appendChild(overlay);

    // Click on image → fullscreen lightbox
    half.style.cursor = 'zoom-in';
    half.addEventListener('click', e => {
      if (e.target.closest('.gv2-ref-actions')) return;
      _openRefCardLightbox(resolveImageUrl ? resolveImageUrl(url) : url, label);
    });

  } else {
    // ── Empty slot — show upload prompt ──────────────────────────────────
    const empty = document.createElement('div');
    empty.className = 'gv2-ref-empty';
    empty.innerHTML = `<span class="gv2-ref-lbl">${label}</span><span class="gv2-ref-add">+</span>`;
    half.appendChild(empty);

    half.style.cursor = 'pointer';
    half.addEventListener('click', () => _refCardPickImage(tradeIdx, side, date));
  }

  return half;
}

// ── Fullscreen lightbox ───────────────────────────────────────────────────────

function _openRefCardLightbox(url, label) {
  // Remove existing lightbox if any
  const existing = document.getElementById('gv2-ref-lightbox');
  if (existing) existing.remove();

  const lb = document.createElement('div');
  lb.id = 'gv2-ref-lightbox';
  lb.innerHTML = `
    <div class="gv2-rlb-inner">
      <div class="gv2-rlb-header">
        <span class="gv2-rlb-label">${label}</span>
        <button class="gv2-rlb-close" id="gv2-rlb-close">✕</button>
      </div>
      <div class="gv2-rlb-body">
        <img src="${url}" alt="${label}" class="gv2-rlb-img" id="gv2-rlb-img">
      </div>
    </div>`;

  document.body.appendChild(lb);

  // Close handlers
  const close = () => lb.remove();
  document.getElementById('gv2-rlb-close').addEventListener('click', close);
  lb.addEventListener('click', e => { if (e.target === lb) close(); });

  const onKey = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
}

// ── Upload / data helpers ─────────────────────────────────────────────────────

async function _refCardPickImage(tradeIdx, side, date) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      showToast('Uploading ref image…', 'info');
      const result = await imageService.uploadImage(file);
      if (!result || !result.url) { showToast('Upload failed', 'error'); return; }
      const dData = state.dayData[date] = state.dayData[date] || {};
      dData.tradeRefCards = dData.tradeRefCards || {};
      dData.tradeRefCards[tradeIdx] = dData.tradeRefCards[tradeIdx] || {};
      if (side === 'index') dData.tradeRefCards[tradeIdx].index = result.url;
      else                  dData.tradeRefCards[tradeIdx].premium = result.url;
      await saveTrades();
      state.gallery._skipScrollIntoView = true;
      renderGallery();
      showToast('Ref image saved', 'success');
    } catch (err) {
      showToast('Upload error: ' + err.message, 'error');
    }
  };
  inp.click();
}

function _refCardToggleLock(tradeIdx, side, date) {
  const dData = state.dayData[date] = state.dayData[date] || {};
  dData.tradeRefCards = dData.tradeRefCards || {};
  dData.tradeRefCards[tradeIdx] = dData.tradeRefCards[tradeIdx] || {};
  const key = side === 'index' ? 'indexLocked' : 'premiumLocked';
  dData.tradeRefCards[tradeIdx][key] = !dData.tradeRefCards[tradeIdx][key];
  saveTrades();
  state.gallery._skipScrollIntoView = true;
  renderGallery();
}

function _refCardClearImage(tradeIdx, side, date) {
  const dData = state.dayData[date] = state.dayData[date] || {};
  dData.tradeRefCards = dData.tradeRefCards || {};
  dData.tradeRefCards[tradeIdx] = dData.tradeRefCards[tradeIdx] || {};
  if (side === 'index') dData.tradeRefCards[tradeIdx].index = null;
  else                  dData.tradeRefCards[tradeIdx].premium = null;
  saveTrades();
  state.gallery._skipScrollIntoView = true;
  renderGallery();
}

// ── Gallery Settings Modal ────────────────────────────────────────────────────

function initOtherDropdown() {
  const btn     = document.getElementById('gv2-other-btn');
  const overlay = document.getElementById('gv2-settings-overlay');
  const closeBtn = document.getElementById('gv2-settings-close');
  if (!btn || !overlay) return;

  if (btn.dataset.initialized) return;
  btn.dataset.initialized = 'true';

  const openModal = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (state.gallery.showRefCards === undefined) state.gallery.showRefCards = true;
    if (window._tradeSidebarDisabled === undefined) window._tradeSidebarDisabled = true;
    _syncRefCardsBtn();
    _syncTradeSidebarBtn();
    overlay.classList.add('open');
    btn.classList.add('active');
  };

  const closeModal = () => {
    overlay.classList.remove('open');
    btn.classList.remove('active');
  };

  btn.addEventListener('click', openModal);
  btn.addEventListener('touchstart', openModal, { passive: false });

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
    closeBtn.addEventListener('touchstart', closeModal, { passive: false });
  }

  // Close on overlay backdrop click
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });

  // Ref Cards toggle
  const rcToggle = document.getElementById('gv2-refcards-toggle');
  if (rcToggle) {
    const handleRc = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      state.gallery.showRefCards = !state.gallery.showRefCards;
      _syncRefCardsBtn();
      state.gallery._skipScrollIntoView = true;
      renderGallery();
    };
    rcToggle.addEventListener('click', handleRc);
    rcToggle.addEventListener('touchstart', handleRc, { passive: false });
  }

  // Trade Sidebar toggle
  const tsToggle = document.getElementById('gv2-tradesidebar-toggle');
  if (tsToggle) {
    const handleTs = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      window._tradeSidebarDisabled = !window._tradeSidebarDisabled;
      if (window._tradeSidebarDisabled && typeof toggleTradeSidebar === 'function') {
        toggleTradeSidebar(false);
      }
      _syncTradeSidebarBtn();
    };
    tsToggle.addEventListener('click', handleTs);
    tsToggle.addEventListener('touchstart', handleTs, { passive: false });
  }

  // Export Current View PDF
  const pdfBtn = document.getElementById('gv2-export-current-pdf-btn');
  if (pdfBtn) {
    const handlePdf = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      closeModal();
      if (typeof exportCurrentViewToPDF === 'function') exportCurrentViewToPDF();
    };
    pdfBtn.addEventListener('click', handlePdf);
    pdfBtn.addEventListener('touchstart', handlePdf, { passive: false });
  }

  // Export Ref Cards PDF Summary
  const allPdfBtn = document.getElementById('gv2-export-refpdf-btn');
  if (allPdfBtn) {
    const handleAllPdf = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      closeModal();
      if (typeof exportRefCardsToPDF === 'function') exportRefCardsToPDF();
    };
    allPdfBtn.addEventListener('click', handleAllPdf);
    allPdfBtn.addEventListener('touchstart', handleAllPdf, { passive: false });
  }
}

/**
 * 📄 PDF Export Logic for Ref Cards
 */
function renderRefCardsForPrint(container, date) {
  const dayData = state.dayData[date];
  const refCards = dayData?.tradeRefCards;
  if (!refCards || Object.keys(refCards).length === 0) return;

  const header = document.createElement('div');
  header.className = 'gv2-pdf-header';
  header.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #333; padding-bottom:10px; margin-bottom:20px;">
      <div>
        <h1 style="margin:0; font-size:1.8rem; color:#222;">TRADING JOURNAL</h1>
        <div style="color:#666; font-size:0.9rem; margin-top:4px;">Reference Summary Report</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:1.2rem; font-weight:700; color:#333;">${date}</div>
        <div style="font-size:0.8rem; color:#999; margin-top:2px;">Generated: ${new Date().toLocaleDateString()}</div>
      </div>
    </div>
  `;
  container.appendChild(header);

  const dayTrades = typeof getTradesForDate === 'function' ? getTradesForDate(date) : [];
  
  // Temp in-memory captures (data URLs) stored by "Store Current View" — cleared after print
  const tempCaptures = window._refCardCaptures?.[date] || {};

  // Iterate over stored cards rather than all trades to ensure we catch everything with a 'green dot'
  Object.keys(refCards).forEach(tradeIdxKey => {
    const tradeIdx = parseInt(tradeIdxKey);
    const tr = dayTrades[tradeIdx];
    if (!tr) return;

    const cardData = refCards[tradeIdxKey];
    if (!cardData) return;

    // Use temp data URL captures if available, else fall back to stored URL
    const cap = tempCaptures[tradeIdxKey] || {};
    const indexData  = cap.index   || cardData.index;
    const premiumData = cap.premium || cardData.premium;

    const hasIndex   = !!(indexData   && ((typeof indexData   === 'string') ? indexData   : indexData.url));
    const hasPremium = !!(premiumData && ((typeof premiumData === 'string') ? premiumData : premiumData.url));
    
    // Only show trades that actually have at least one image stored (green dot trades)
    if (!hasIndex && !hasPremium) return;

    const tradeRow = document.createElement('div');
    tradeRow.className = 'gv2-pdf-trade-row';
    tradeRow.style.cssText = 'margin-bottom:60px; break-inside:avoid; page-break-inside:avoid;';

    const pnl = typeof getTradePnl === 'function' ? (getTradePnl(tr) || 0) : 0;
    const pnlColor = pnl >= 0 ? '#10b981' : '#ef4444';
    const pnlStr = (pnl >= 0 ? '+' : '') + '₹' + Math.abs(Math.round(pnl)).toLocaleString('en-IN');

    const _renderImgHtml = (data, lbl, imgH = 260) => {
        if (!data) return '';
        
        let src = '';
        let style = 'width:100%; height:100%; object-fit:contain; display:block;';
        
        if (typeof data === 'string' && data.startsWith('data:')) {
            src = data;
        } else {
            const url = (typeof data === 'object' && data !== null) ? data.url : data;
            if (!url) return '';
            
            let targetU = url;
            // URL cleanup
            if (url && !url.includes('/') && url.includes('.')) {
                const images = state.gallery?.images || [];
                const full = images.find(img => img === url || img.endsWith('/' + url));
                if (full) targetU = full;
            }
            src = resolveImageUrl(targetU);
            
            if (typeof data === 'object' && data.scale && data.panelW) {
                const scaleRatio = imgH / (data.panelH || 400);
                const sx = (data.tx || 0) * scaleRatio;
                const sy = (data.ty || 0) * scaleRatio;
                style = `position:absolute; top:50%; left:50%; transform:translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px)) scale(${data.scale}); transform-origin:center; max-width:none; width:${data.panelW * scaleRatio}px;`;
            }
        }

        return `
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="font-size:0.75rem; font-weight:700; color:#666; text-transform:uppercase; letter-spacing:0.5px;">${lbl}</div>
            <div style="border:1px solid #ddd; border-radius:4px; overflow:hidden; background:#eee; height:${imgH}px; position:relative;">
               <img src="${src}" style="${style}" onerror="this.parentElement.style.background='#f3f4f6'; this.style.display='none';">
            </div>
          </div>
        `;
    };

    // Layout Logic
    let imageBlocks = '';
    if (hasIndex && hasPremium) {
        imageBlocks = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
            ${_renderImgHtml(indexData, 'Index / Context', 260)}
            ${_renderImgHtml(premiumData, 'Premium / Execution', 260)}
        </div>`;
    } else if (hasIndex) {
        imageBlocks = `<div>${_renderImgHtml(indexData, 'Index / Context', 450)}</div>`;
    } else {
        imageBlocks = `<div>${_renderImgHtml(premiumData, 'Premium / Execution', 450)}</div>`;
    }

    tradeRow.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px; background:#f8f9fa; padding:10px 15px; border-radius:8px; border-left:5px solid ${pnlColor}">
        <div style="background:#333; color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.9rem;">${tradeIdx + 1}</div>
        <div style="font-weight:700; font-size:1.1rem; color:#111; flex:1;">${(tr.Instrument || tr.instrument || 'Trade').toUpperCase()}</div>
        <div style="color:${pnlColor}; font-weight:800; font-size:1.1rem;">${pnlStr}</div>
      </div>
      ${imageBlocks}
    `;
    container.appendChild(tradeRow);
  });
}

async function exportRefCardsToPDF() {
  const date = state.gallery.date;
  if (!date) { if (typeof showToast === 'function') showToast('Pehle date select karein', 'error'); return; }

  const printLayer = document.createElement('div');
  printLayer.id = 'gv2-pdf-print-layer';
  renderRefCardsForPrint(printLayer, date);
  document.body.appendChild(printLayer);

  if (typeof showToast === 'function') showToast('Preparing PDF Report...', 'info');

  // Wait for all images in print layer to load before printing
  const imgs = Array.from(printLayer.querySelectorAll('img'));
  if (imgs.length > 0) {
    await Promise.all(imgs.map(img => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve; // don't block if one fails
      });
    }));
  }

  // Small buffer for layout
  await new Promise(r => setTimeout(r, 200));

  window.print();
  const cleanup = () => {
      if (document.body.contains(printLayer)) document.body.removeChild(printLayer);
      // Clear temp captures — data URLs no longer needed after print
      if (window._refCardCaptures) delete window._refCardCaptures[date];
      window.removeEventListener('focus', cleanup);
  };
  window.addEventListener('focus', cleanup);
}

/**
 * 📄 Export only the CURRENT visible gallery view to PDF
 */
async function exportCurrentViewToPDF() {
  const date = state.gallery.date;
  if (!date) return;
  
  if (typeof showToast === 'function') showToast('Capturing current view...', 'info');

  let leftCap = null, rightCap = null;
  if (state.gallery.splitView && typeof _captureSplitPanel === 'function') {
      [leftCap, rightCap] = await Promise.all([
          _captureSplitPanel('gv2-split-left',  'gv2-split-left-img'),
          _captureSplitPanel('gv2-split-right', 'gv2-split-right-img')
      ]);
  } else if (typeof _captureSplitPanel === 'function') {
      // Single view: capture just the main image area
      leftCap = await _captureSplitPanel('gallery-zoom-layer', 'gallery-img');
  }

  const printLayer = document.createElement('div');
  printLayer.id = 'gv2-pdf-print-layer';
  
  const header = document.createElement('div');
  header.className = 'gv2-pdf-header';
  header.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #333; padding-bottom:10px; margin-bottom:20px;">
      <div>
        <h1 style="margin:0; font-size:1.8rem; color:#222;">GALLERY SNAPSHOT</h1>
        <div style="color:#666; font-size:0.9rem; margin-top:4px;">Current Custom View</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:1.2rem; font-weight:700; color:#333;">${date}</div>
        <div style="font-size:0.8rem; color:#999; margin-top:2px;">Generated: ${new Date().toLocaleDateString()}</div>
      </div>
    </div>
  `;
  printLayer.appendChild(header);

  const row = document.createElement('div');
  row.style.cssText = 'margin-bottom:20px;';
  
  if (leftCap && rightCap) {
      row.innerHTML = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
        <div style="border:1px solid #ddd; background:#111; height:400px;"><img src="${leftCap}" style="width:100%; height:100%; object-fit:contain;"></div>
        <div style="border:1px solid #ddd; background:#111; height:400px;"><img src="${rightCap}" style="width:100%; height:100%; object-fit:contain;"></div>
      </div>`;
  } else if (leftCap) {
      row.innerHTML = `<div style="border:1px solid #ddd; background:#111; height:600px;"><img src="${leftCap}" style="width:100%; height:100%; object-fit:contain;"></div>`;
  } else {
      // Fallback: Just the current image
      const curImg = (state.gallery.images || [])[state.gallery.currentIndex];
      if (curImg) {
          row.innerHTML = `<div style="border:1px solid #ddd; background:#eee; height:600px;"><img src="${resolveImageUrl(curImg)}" style="width:100%; height:100%; object-fit:contain;"></div>`;
      }
  }
  printLayer.appendChild(row);
  document.body.appendChild(printLayer);

  // Buffer for image content
  await new Promise(r => setTimeout(r, 1000));
  window.print();
  setTimeout(() => printLayer.remove(), 2000);
}

document.addEventListener('DOMContentLoaded', initOtherDropdown);

function _syncRefCardsBtn() {
  const row   = document.getElementById('gv2-refcards-toggle');
  const badge = document.getElementById('gv2-refcards-badge');
  if (!row || !badge) return;
  const on = state.gallery.showRefCards !== false;
  badge.textContent = on ? 'ON' : 'OFF';
  row.classList.toggle('active', on);
}

function _syncTradeSidebarBtn() {
  const row   = document.getElementById('gv2-tradesidebar-toggle');
  const badge = document.getElementById('gv2-tradesidebar-badge');
  if (!row || !badge) return;
  const enabled = !window._tradeSidebarDisabled;
  badge.textContent = enabled ? 'ON' : 'OFF';
  row.classList.toggle('active', enabled);
}


```
