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
        thumbSize: 180
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
                    <div class="trade-sidebar-header">
                        <span class="trade-sidebar-title" id="trade-sidebar-title">Trade Thumbnails</span>
                        <button class="trade-sidebar-close" id="trade-sidebar-close">✕</button>
                    </div>
                    <div class="trade-sidebar-body" id="trade-sidebar-body">
                        <div id="ts-info-container"></div>
                        <div class="trade-sidebar-grid" id="trade-sidebar-grid"></div>
                    </div>
                    <div class="ts-controls">
                        <span style="font-size:0.75rem; color:#8b949e;">Size:</span>
                        <input type="range" class="ts-size-slider" id="ts-size-slider" min="80" max="400" value="180">
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

        // Resizing Sidebar
        if (ts.resizer) {
            let isResizing = false;
            ts.resizer.onmousedown = (e) => {
                isResizing = true;
                document.body.style.cursor = 'ew-resize';
                e.preventDefault();
            };
            window.onmousemove = (e) => {
                if (!isResizing) return;
                const newWidth = window.innerWidth - e.clientX;
                if (newWidth > 300 && newWidth < window.innerWidth * 0.8) {
                    ts.currentWidth = newWidth;
                    ts.overlay.style.width = ts.currentWidth + 'px';
                    localStorage.setItem('tj_ts_width', ts.currentWidth);
                }
            };
            window.onmouseup = () => {
                if (isResizing) {
                    isResizing = false;
                    document.body.style.cursor = '';
                }
            };
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
            if (ts.slider) ts.slider.value = ts.thumbSize;
        }
    }

    function _applyThumbSize() {
        if (!ts.grid) return;
        ts.grid.style.setProperty('--thumb-size', ts.thumbSize + 'px');
        const lbl = document.getElementById('ts-size-label');
        if (lbl) lbl.textContent = ts.thumbSize + 'px';
        localStorage.setItem('tj_ts_thumbSz', ts.thumbSize);
    }

    function openTradeSidebar(trade) {
        if (!trade) return;
        ts.currentTrade = trade;
        
        if (!ts.overlay) initTradeSidebar();
        
        // Populate Title
        const inst = (trade.Instrument || trade.instrument || 'Trade').toUpperCase();
        ts.title.textContent = inst + ' Thumbnails';

        // Populate Info Card
        const infoCont = document.getElementById('ts-info-container');
        if (infoCont) {
            const pnl = typeof getTradePnl === 'function' ? getTradePnl(trade) : 0;
            const pnlClass = pnl >= 0 ? 'ts-pnl-win' : 'ts-pnl-loss';
            const date = trade.trade_date || trade.Date || '';
            const qty = trade.Qty || trade.quantity || '-';
            const pt = trade.Pt || trade.Points || '-';

            infoCont.innerHTML = `
                <div class="ts-info-card">
                    <div class="ts-info-row">
                        <span class="ts-info-label">Date</span>
                        <span class="ts-info-value">${date}</span>
                    </div>
                    <div class="ts-info-row">
                        <span class="ts-info-label">Qty / Pt</span>
                        <span class="ts-info-value">${qty} / ${pt} pt</span>
                    </div>
                    <div class="ts-info-row">
                        <span class="ts-info-label">P&L</span>
                        <span class="ts-info-value ${pnlClass}">₹${Math.round(pnl).toLocaleString('en-IN')}</span>
                    </div>
                </div>
            `;
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
