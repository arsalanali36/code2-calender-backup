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
    drop.style.minWidth = '340px';
    let runTotal = 0;
    rows.forEach(({ t, pnl }, i) => {
        runTotal += pnl;
        const row = document.createElement('div');
        row.className = 'gv2-pnl-trade-row';
        row.style.cssText = 'display:grid; grid-template-columns:32px 1fr 60px 80px; gap:6px; align-items:center; padding:6px 12px; cursor:pointer;';
        row.addEventListener('mouseenter', () => row.style.background = 'rgba(255,255,255,0.06)');
        row.addEventListener('mouseleave', () => row.style.background = '');

        const rawInst = t.Instrument || t.instrument || t.Symbol || t.symbol || '';
        const m = rawInst.toUpperCase().match(/^([A-Z]+)(\d{2})([1-9OND])(\d{2})(\d+)(CE|PE)$/);
        const instText = m ? `${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]} ${m[6]}` : rawInst;
        let instColor = '#ffd700';
        if (rawInst.toUpperCase().endsWith('CE')) instColor = '#c084fc';
        else if (rawInst.toUpperCase().endsWith('PE')) instColor = 'var(--text3,#8b949e)';

        const lbl = document.createElement('span');
        lbl.style.cssText = 'font-weight:700; font-size:0.85rem;';
        lbl.textContent = `T${i + 1}`;

        const inst = document.createElement('span');
        inst.style.cssText = `font-size:0.75rem; color:${instColor}; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`;
        inst.textContent = instText || '—';

        const val = document.createElement('span');
        val.style.cssText = `text-align:right; font-weight:700; font-size:0.82rem; color:${pnl > 0 ? '#2ecc71' : pnl < 0 ? '#e74c3c' : 'var(--text2)'};`;
        val.textContent = '₹' + Math.abs(Math.round(pnl)).toLocaleString('en-IN');

        const cum = document.createElement('span');
        cum.style.cssText = `text-align:right; font-size:0.78rem; color:${runTotal >= 0 ? '#2ecc71' : '#e74c3c'}; padding-left:6px; border-left:1px solid rgba(255,255,255,0.1); opacity:0.85;`;
        cum.textContent = '₹' + Math.abs(Math.round(runTotal)).toLocaleString('en-IN');

        row.append(lbl, inst, val, cum);
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

// ── NEW: MTM / Day Equity Curve Panel Rendering ──────────────────────────
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
