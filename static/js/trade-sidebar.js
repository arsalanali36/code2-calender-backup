/* trade-sidebar.js - Logic for Trade Thumbnails Side Panel */

(function() {
    const ts = {
        overlay: null,
        body: null,
        title: null,
        grid: null,
        resizer: null,
        isOpen: false,
        currentTrade: null,
        currentWidth: 450,
        thumbSize: 120
    };

    function _initRefs() {
        ts.overlay = document.getElementById('trade-sidebar-overlay');
        ts.body    = document.getElementById('trade-sidebar-body');
        ts.title   = document.getElementById('trade-sidebar-title');
        ts.grid    = document.getElementById('trade-sidebar-grid');
        ts.resizer = document.getElementById('trade-sidebar-resizer');
        ts.slider  = document.getElementById('ts-size-slider');
    }

    function initTradeSidebar() {
        // Create sidebar if it doesn't exist
        if (!document.getElementById('trade-sidebar-overlay')) {
            const html = `
                <div class="trade-sidebar-overlay" id="trade-sidebar-overlay">
                    <div class="trade-sidebar-resizer" id="trade-sidebar-resizer"></div>
                    <div class="trade-sidebar-header" id="trade-sidebar-header">
                        <div style="flex:1; min-width:0;">
                            <div class="trade-sidebar-title" id="trade-sidebar-title">Trade Thumbnails</div>
                            <div id="ts-header-details" style="display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:5px;font-size:0.78rem;color:#8b949e;line-height:1.4;"></div>
                        </div>
                        <button class="trade-sidebar-close" id="trade-sidebar-close">✕</button>
                    </div>
                    <div class="trade-sidebar-body" id="trade-sidebar-body">
                        <div class="trade-sidebar-grid" id="trade-sidebar-grid"></div>
                    </div>
                    <div class="ts-controls">
                        <span style="font-size:0.75rem; color:#8b949e;">Size:</span>
                        <input type="range" class="ts-size-slider" id="ts-size-slider" min="60" max="400" value="120">
                        <span class="ts-size-label" id="ts-size-label">180px</span>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
        }

        _initRefs();

        const closeBtn = document.getElementById('trade-sidebar-close');
        if (closeBtn) {
            closeBtn.onclick = () => toggleTradeSidebar(false);
        }

        // Resizing Sidebar (mouse + touch for iPad)
        if (ts.resizer) {
            let isResizing = false;

            const startResize = () => {
                isResizing = true;
                document.body.style.cursor = 'ew-resize';
            };
            const doResize = (clientX) => {
                if (!isResizing) return;
                const newWidth = window.innerWidth - clientX;
                const minW = Math.min(280, window.innerWidth * 0.4);
                const maxW = Math.max(window.innerWidth * 0.9, 600);
                if (newWidth >= minW && newWidth <= maxW) {
                    ts.currentWidth = newWidth;
                    ts.overlay.style.width = ts.currentWidth + 'px';
                    localStorage.setItem('tj_ts_width', ts.currentWidth);
                }
            };
            const endResize = () => {
                if (isResizing) { isResizing = false; document.body.style.cursor = ''; }
            };

            ts.resizer.addEventListener('mousedown', (e) => { startResize(); e.preventDefault(); });
            ts.resizer.addEventListener('touchstart', (e) => { startResize(); }, { passive: true });
            window.addEventListener('mousemove', (e) => doResize(e.clientX));
            window.addEventListener('touchmove', (e) => { if (isResizing) doResize(e.touches[0].clientX); }, { passive: true });
            window.addEventListener('mouseup', endResize);
            window.addEventListener('touchend', endResize);
        }

        // Thumbnail Sizer
        if (ts.slider) {
            ts.slider.oninput = (e) => {
                ts.thumbSize = parseInt(e.target.value);
                _applyThumbSize();
            };
        }

        // Load saved state
        const savedWidth = localStorage.getItem('tj_ts_width');
        if (savedWidth) ts.currentWidth = parseInt(savedWidth);

        const savedThumbSz = localStorage.getItem('tj_ts_thumbSz');
        if (savedThumbSz) {
            ts.thumbSize = parseInt(savedThumbSz);
            if (ts.slider) { ts.slider.value = ts.thumbSize; ts.slider.min = '60'; }
        }
    }

    function _applyThumbSize() {
        if (!ts.grid) return;
        ts.grid.style.setProperty('--thumb-size', ts.thumbSize + 'px');
        
        // Force single column if images are expanded significantly
        if (ts.thumbSize > 220) {
            ts.grid.style.gridTemplateColumns = '1fr';
        } else {
            ts.grid.style.gridTemplateColumns = ''; // Resets to CSS auto-fill
        }

        const lbl = document.getElementById('ts-size-label');
        if (lbl) lbl.textContent = ts.thumbSize + 'px';
        localStorage.setItem('tj_ts_thumbSz', ts.thumbSize);
    }

    function openTradeSidebar(trade) {
        if (!trade) return;
        ts.currentTrade = trade;
        
        if (!ts.overlay) initTradeSidebar();
        
        // Populate Title + header details
        const isDay = !!trade._dayTrades;
        const date = trade.trade_date || trade.Date || '';
        const inst = isDay ? (date || 'Day') : (trade.Instrument || trade.instrument || 'Trade').toUpperCase();
        if (ts.title) ts.title.textContent = inst;

        const detailEl = document.getElementById('ts-header-details');
        if (detailEl) {
            const chip = (label, val, cls='') =>
                `<span style="background:rgba(255,255,255,0.06);border-radius:4px;padding:1px 6px;"><span style="color:#8b949e;">${label}: </span><span class="${cls}" style="color:#cdd9e5;font-weight:600;">${val}</span></span>`;

            if (isDay) {
                const dayTrades = trade._dayTrades;
                const totalPnl = dayTrades.reduce((s, t) => s + (typeof getTradePnl === 'function' ? (getTradePnl(t) || 0) : 0), 0);
                const pnlColor = totalPnl >= 0 ? '#3fb950' : '#f85149';
                const pnlStr = `<span style="color:${pnlColor};font-weight:700;">₹${Math.round(totalPnl).toLocaleString('en-IN')}</span>`;
                detailEl.innerHTML =
                    chip('Date', date) +
                    chip('Trades', dayTrades.length) +
                    `<span style="background:rgba(255,255,255,0.06);border-radius:4px;padding:1px 6px;"><span style="color:#8b949e;">P&L: </span>${pnlStr}</span>`;
            } else {
                const pnl = typeof getTradePnl === 'function' ? (getTradePnl(trade) || 0) : 0;
                const pnlColor = pnl >= 0 ? '#3fb950' : '#f85149';
                const pnlStr = `<span style="color:${pnlColor};font-weight:700;">₹${Math.round(pnl).toLocaleString('en-IN')}</span>`;
                const qty  = trade.Qty  || trade.quantity || '-';
                const pt   = trade.Pt   || trade.Points   || '-';
                const side = trade.Side || trade.Type     || trade.type || '';
                const enty = trade['Entry'] || trade['Buy Price']  || trade['Avg Buy'] || '';
                const exit = trade['Exit']  || trade['Sell Price'] || trade['Avg Sell']|| '';
                const lots = trade['Lots']  || trade['lots']       || '';
                let details = chip('Date', date);
                if (side) details += chip('Side', side);
                if (enty) details += chip('Entry', enty);
                if (exit) details += chip('Exit', exit);
                if (qty)  details += chip('Qty', qty);
                if (lots) details += chip('Lots', lots);
                if (pt && pt !== '-') details += chip('Pt', pt);
                details += `<span style="background:rgba(255,255,255,0.06);border-radius:4px;padding:1px 6px;"><span style="color:#8b949e;">P&L: </span>${pnlStr}</span>`;
                detailEl.innerHTML = details;
            }
        }

        // Populate Grid
        if (ts.grid) {
            ts.grid.innerHTML = '';
            const images = trade.images || [];
            if (images.length === 0) {
                ts.grid.innerHTML = '<div style="color:#8b949e; grid-column:1/-1; text-align:center; padding:40px;">No images found for this trade</div>';
            } else {
                images.forEach(url => {
                    const wrap = document.createElement('div');
                    wrap.className = 'ts-thumb-wrap';
                    
                    const img = document.createElement('img');
                    img.className = 'ts-thumb';
                    img.src = typeof resolveImageUrl === 'function' ? resolveImageUrl(url) : url;
                    img.loading = 'lazy';
                    
                    wrap.appendChild(img);

                    // --- Overlay Markers if this is a Close Global Image ---
                    const d = trade.trade_date || trade.Date || '';
                    if (d && state.dayData[d]) {
                        const dayData = state.dayData[d];
                        if (dayData.closeGlobalImages?.includes(url)) {
                            const posData = dayData.navPositions?.[url];
                            if (posData) {
                                Object.keys(posData).forEach(btnIdx => {
                                    const trList = typeof getTradesForDate === 'function' ? getTradesForDate(d) : [];
                                    const targetTr = trList[parseInt(btnIdx)];
                                    const pnl = targetTr ? parseFloat(targetTr['Net P/L'] || targetTr.net_pnl || 0) : 0;
                                    const color = pnl > 0 ? '#3fb950' : (pnl < 0 ? '#f85149' : '#58a6ff');

                                    const ov = document.createElement('div');
                                    ov.className = 'ts-marker-ovl';
                                    ov.textContent = parseInt(btnIdx) + 1;
                                    ov.style.position = 'absolute';
                                    ov.style.left = posData[btnIdx].left;
                                    ov.style.top = posData[btnIdx].top;
                                    ov.style.transform = 'translate(-50%, -50%)';
                                    ov.style.background = color;
                                    ov.style.color = '#fff';
                                    ov.style.borderRadius = '50%';
                                    ov.style.display = 'flex';
                                    ov.style.alignItems = 'center';
                                    ov.style.justifyContent = 'center';
                                    ov.style.fontSize = '8px';
                                    ov.style.fontWeight = 'bold';
                                    ov.style.width = '14px';
                                    ov.style.height = '14px';
                                    ov.style.border = '1px solid rgba(255,255,255,0.4)';
                                    ov.style.pointerEvents = 'none'; // So click goes to wrapper
                                    ov.style.zIndex = '5';
                                    wrap.appendChild(ov);
                                });
                            }
                        }
                    }
                    
                    wrap.onclick = () => {
                        if (typeof openGalleryForDate === 'function') {
                            const d = trade.trade_date || trade.Date || '';
                            openGalleryForDate(d, url);
                        }
                    };
                    
                    ts.grid.appendChild(wrap);
                });
            }
        }

        toggleTradeSidebar(true);
        _applyThumbSize();
    }

    function toggleTradeSidebar(show) {
        if (!ts.overlay) initTradeSidebar();
        ts.isOpen = show;
        ts.overlay.classList.toggle('open', show);
        if (show) {
            ts.overlay.style.width = ts.currentWidth + 'px';
        } else {
            ts.overlay.style.width = '0';
        }
    }

    // Export to window
    window.openTradeSidebar = openTradeSidebar;
    window.toggleTradeSidebar = toggleTradeSidebar;

    // Listen for Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && ts.isOpen) {
            toggleTradeSidebar(false);
        }
    });

})();
