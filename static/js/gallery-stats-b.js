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
