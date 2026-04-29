        function showToast(msg, type = 'success') {
            let t = document.getElementById('sl-toast');
            if (!t) {
                t = document.createElement('div');
                t.id = 'sl-toast';
                Object.assign(t.style, {
                    position:'fixed', bottom:'24px', right:'24px', zIndex:99999,
                    padding:'10px 18px', borderRadius:'8px', fontFamily:'Segoe UI,sans-serif',
                    fontSize:'14px', boxShadow:'0 4px 16px rgba(0,0,0,.4)',
                    transition:'opacity .3s', opacity:'0', pointerEvents:'none'
                });
                document.body.appendChild(t);
            }
            t.textContent = msg;
            t.style.background = type === 'success' ? '#a6e3a1' : '#f38ba8';
            t.style.color = '#1e1e2e';
            t.style.opacity = '1';
            clearTimeout(t._timer);
            t._timer = setTimeout(() => { t.style.opacity = '0'; }, 3500);
        }

        let chartMain, candleMain, ema10Main, ema20Main, markerMain;
        let pdhMain, pdlMain, pdcMain, ppMain, r1Main, s1Main, r2Main, s2Main, r3Main, s3Main, r4Main, s4Main, r5Main, s5Main;
        let chartOpt, candleOpt, ema10Opt, ema20Opt, markerOpt;
        let pdhOpt, pdlOpt, pdcOpt, ppOpt, r1Opt, s1Opt, r2Opt, s2Opt, r3Opt, s3Opt, r4Opt, s4Opt, r5Opt, s5Opt;
        let zonesMain = [], tradesMain = [], zonesOpt = [], tradesOpt = [];
        let zoneSeriesMain = [], tradeSeriesMain = [], zoneSeriesOpt = [], tradeSeriesOpt = [];
        let lastStrategyData = { realTrades: [] };
        let loadedRealTrades = [];
        let tradePills = { main: [], opt: [] };

        const lockStates = { main: false, opt: false };
        const lockRatios = { main: null, opt: null };
        // Stores { mid, halfSpan } for the manual price range per target
        const manualPriceRanges = { main: null, opt: null };

        // v4.2.0 has no priceScale.priceRange() — use coordinateToPrice on candle series
        function getVisiblePriceRange(target) {
            const candle = target === 'main' ? candleMain : candleOpt;
            const el = document.getElementById(`chart-${target}`);
            if (!candle || !el || el.clientHeight === 0) return null;
            const top    = candle.coordinateToPrice(0);
            const bottom = candle.coordinateToPrice(el.clientHeight);
            if (top == null || bottom == null) return null;
            return { from: Math.min(top, bottom), to: Math.max(top, bottom) };
        }

        // v4.2.0 has no priceScale.applyOptions({ priceRange }) — use autoscaleInfoProvider
        function applyPriceRange(target, from, to) {
            const candle = target === 'main' ? candleMain : candleOpt;
            if (!candle) return;
            manualPriceRanges[target] = { mid: (from + to) / 2, halfSpan: (to - from) / 2 };
            candle.applyOptions({
                autoscaleInfoProvider: () => {
                    const r = manualPriceRanges[target];
                    if (!r) return null;
                    return { priceRange: { minValue: r.mid - r.halfSpan, maxValue: r.mid + r.halfSpan } };
                }
            });
        }

        function clearPriceRange(target) {
            const candle = target === 'main' ? candleMain : candleOpt;
            const chart  = target === 'main' ? chartMain  : chartOpt;
            if (!candle || !chart) return;
            manualPriceRanges[target] = null;
            candle.applyOptions({ autoscaleInfoProvider: () => null });
            chart.priceScale('right').applyOptions({ autoScale: true });
        }

        function toggleLockRatio(target) {
            const chart = target === 'main' ? chartMain : chartOpt;
            const btn   = document.getElementById(`lock-btn-${target}`);
            lockStates[target] = !lockStates[target];

            if (lockStates[target]) {
                if (btn) { btn.classList.add('active'); btn.style.background = '#6366f1'; btn.style.color = '#fff'; }
                const pRange = getVisiblePriceRange(target);
                const tRange = chart.timeScale().getVisibleRange();
                if (pRange && tRange && tRange.to !== tRange.from) {
                    lockRatios[target] = (pRange.to - pRange.from) / (tRange.to - tRange.from);
                }
                chart.applyOptions({
                    handleScroll: { mouseWheel: false, pressedMouseMove: false },
                    handleScale:  { mouseWheel: true,  axisPressedMouseMove: false }
                });
            } else {
                if (btn) { btn.classList.remove('active'); btn.style.background = ''; btn.style.color = '#6366f1'; }
                chart.applyOptions({
                    handleScroll: { mouseWheel: true, pressedMouseMove: true },
                    handleScale:  { mouseWheel: true, axisPressedMouseMove: true }
                });
                clearPriceRange(target);
                lockRatios[target] = null;
            }
        }

        function zoomY(target, factor) {
            const chart = target === 'main' ? chartMain : chartOpt;
            if (!chart) return;
            const pRange = getVisiblePriceRange(target);
            if (!pRange) return;
            const mid        = (pRange.from + pRange.to) / 2;
            const newHalfSpan = ((pRange.to - pRange.from) / 2) * factor;
            applyPriceRange(target, mid - newHalfSpan, mid + newHalfSpan);
            if (lockStates[target]) {
                const tRange = chart.timeScale().getVisibleRange();
                if (tRange && tRange.to !== tRange.from)
                    lockRatios[target] = (newHalfSpan * 2) / (tRange.to - tRange.from);
            }
        }

        let _lockChanging = false;
        function handleTimeScaleChange(target) {
            if (!lockStates[target] || !lockRatios[target] || _lockChanging) return;
            const chart  = target === 'main' ? chartMain : chartOpt;
            const tRange = chart.timeScale().getVisibleRange();
            if (!tRange || tRange.to === tRange.from) return;
            const pRange = getVisiblePriceRange(target);
            if (!pRange) return;
            const targetHalfSpan = (tRange.to - tRange.from) * lockRatios[target] / 2;
            const mid = (pRange.from + pRange.to) / 2;
            _lockChanging = true;
            applyPriceRange(target, mid - targetHalfSpan, mid + targetHalfSpan);
            _lockChanging = false;
        }

        function syncTradePills(target) {
            // Simplified: User preferred single line markers for stability
        }

        function initChart() {
            const setup = (id) => {
                const c = LightweightCharts.createChart(document.getElementById(id), {
                    layout: { 
                        background: { color: '#ffffff' }, 
                        textColor: '#333',
                        fontFamily: "'Inter', sans-serif"
                    },
                    grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
                    timeScale: { timeVisible: true, secondsVisible: false },
                    rightPriceScale: { visible: true, borderColor: '#d0d7de',
                        scaleMargins: { top: 0.15, bottom: 0.15 } },
                    crosshair: { mode: LightweightCharts.CrosshairMode.Normal }
                });
                
                const candle = c.addCandlestickSeries({ upColor: '#26a69a', downColor: '#ef5350' });
                const e10 = c.addLineSeries({ color: '#2196F3', lineWidth: 1, title: 'EMA 10' });
                const e20 = c.addLineSeries({ color: '#F44336', lineWidth: 1, title: 'EMA 20' });
                const marker = c.addLineSeries({ color: 'transparent', lineWidth: 0, priceLineVisible: false, lastValueVisible: false });
                
                // Static Levels (Sandbox)
                // autoscaleInfoProvider: () => null  →  excluded from Y-axis range calc,
                // so R1-R5 / S1-S5 levels don't squish the candles. Lines still draw at
                // their correct price positions.
                const levelOpts = { autoscaleInfoProvider: () => null, lastValueVisible: false, priceLineVisible: false };
                const pdh = c.addLineSeries({ ...levelOpts, color: 'rgba(239, 83, 80, 0.6)', lineWidth: 2, lineStyle: 2, title: 'PDH' });
                const pdl = c.addLineSeries({ ...levelOpts, color: 'rgba(38, 166, 154, 0.6)', lineWidth: 2, lineStyle: 2, title: 'PDL' });
                const pdc = c.addLineSeries({ ...levelOpts, color: 'rgba(33, 150, 243, 0.6)', lineWidth: 1, lineStyle: 2, title: 'PDC' });
                const pp  = c.addLineSeries({ ...levelOpts, color: 'rgba(156, 39, 176, 0.5)', lineWidth: 1, lineStyle: 2, title: 'PP'  });
                const r1  = c.addLineSeries({ ...levelOpts, color: 'rgba(239, 83, 80, 0.4)',  lineWidth: 1, lineStyle: 2, title: 'R1'  });
                const s1  = c.addLineSeries({ ...levelOpts, color: 'rgba(38, 166, 154, 0.4)', lineWidth: 1, lineStyle: 2, title: 'S1'  });
                const r2  = c.addLineSeries({ ...levelOpts, color: 'rgba(239, 83, 80, 0.3)',  lineWidth: 1, lineStyle: 2, title: 'R2'  });
                const s2  = c.addLineSeries({ ...levelOpts, color: 'rgba(38, 166, 154, 0.3)', lineWidth: 1, lineStyle: 2, title: 'S2'  });
                const r3  = c.addLineSeries({ ...levelOpts, color: 'rgba(239, 83, 80, 0.2)',  lineWidth: 1, lineStyle: 2, title: 'R3'  });
                const s3  = c.addLineSeries({ ...levelOpts, color: 'rgba(38, 166, 154, 0.2)', lineWidth: 1, lineStyle: 2, title: 'S3'  });
                const r4  = c.addLineSeries({ ...levelOpts, color: 'rgba(239, 83, 80, 0.15)', lineWidth: 1, lineStyle: 2, title: 'R4'  });
                const s4  = c.addLineSeries({ ...levelOpts, color: 'rgba(38, 166, 154, 0.15)',lineWidth: 1, lineStyle: 2, title: 'S4'  });
                const r5  = c.addLineSeries({ ...levelOpts, color: 'rgba(239, 83, 80, 0.1)',  lineWidth: 1, lineStyle: 2, title: 'R5'  });
                const s5  = c.addLineSeries({ ...levelOpts, color: 'rgba(38, 166, 154, 0.1)', lineWidth: 1, lineStyle: 2, title: 'S5'  });

                new ResizeObserver(() => {
                    const box = document.getElementById(id);
                    if (box.clientWidth > 0) {
                        c.applyOptions({ width: box.clientWidth, height: box.clientHeight });
                    }
                }).observe(document.getElementById(id));
                
                return { c, candle, e10, e20, marker, pdh, pdl, pdc, pp, r1, s1, r2, s2, r3, s3, r4, s4, r5, s5 };
            };

            const m = setup('chart-main');
            chartMain = m.c; candleMain = m.candle; ema10Main = m.e10; ema20Main = m.e20; markerMain = m.marker;
            pdhMain = m.pdh; pdlMain = m.pdl; pdcMain = m.pdc; ppMain = m.pp; r1Main = m.r1; s1Main = m.s1; r2Main = m.r2; s2Main = m.s2; r3Main = m.r3; s3Main = m.s3;
            r4Main = m.r4; s4Main = m.s4; r5Main = m.r5; s5Main = m.s5;

            const o = setup('chart-opt');
            chartOpt = o.c; candleOpt = o.candle; ema10Opt = o.e10; ema20Opt = o.e20; markerOpt = o.marker;
            pdhOpt = o.pdh; pdlOpt = o.pdl; pdcOpt = o.pdc; ppOpt = o.pp; r1Opt = o.r1; s1Opt = o.s1; r2Opt = o.r2; s2Opt = o.s2; r3Opt = o.r3; s3Opt = o.s3;
            r4Opt = o.r4; s4Opt = o.s4; r5Opt = o.r5; s5Opt = o.s5;

            chartMain.timeScale().subscribeVisibleTimeRangeChange(() => {
                handleTimeScaleChange('main');
                syncTradePills('main');
            });
            chartOpt.timeScale().subscribeVisibleTimeRangeChange(() => {
                handleTimeScaleChange('opt');
                syncTradePills('opt');
            });
            initResizer();
            initAltClickFullscreen();
            initPriceScaleContextMenu();
        }

        // Alt + Left-click on either chart panel → toggle fullscreen (TradingView style)
        function initAltClickFullscreen() {
            let fsPanel = null; // which panel is expanded: null | 'main' | 'opt'

            ['container-main', 'container-opt'].forEach(id => {
                document.getElementById(id).addEventListener('click', (e) => {
                    if (!e.altKey) return;
                    e.preventDefault();

                    const wrapper  = document.querySelector('.chart-wrapper');
                    const mainBox  = document.getElementById('container-main');
                    const optBox   = document.getElementById('container-opt');
                    const resizer  = document.getElementById('chart-resizer');
                    const isMain   = (id === 'container-main');

                    if (fsPanel === id) {
                        // Already fullscreen → restore
                        fsPanel = null;
                        mainBox.style.flex = '';
                        mainBox.style.display = '';
                        if (optBox.dataset.wasVisible === '1') {
                            optBox.style.flex    = '';
                            optBox.style.display = 'block';
                            resizer.style.display = 'block';
                        }
                    } else {
                        // Enter fullscreen for this panel
                        fsPanel = id;
                        // Remember whether opt was visible
                        optBox.dataset.wasVisible = (optBox.style.display !== 'none') ? '1' : '0';

                        if (isMain) {
                            mainBox.style.flex = '1';
                            optBox.style.display = 'none';
                            resizer.style.display = 'none';
                        } else {
                            optBox.style.flex    = '1';
                            optBox.style.display = 'block';
                            mainBox.style.display = 'none';
                            resizer.style.display = 'none';
                        }
                    }

                    // Let ResizeObserver handle resize, but also force it manually
                    setTimeout(() => {
                        ['chart-main', 'chart-opt'].forEach(cid => {
                            const el = document.getElementById(cid);
                            const ch = cid === 'chart-main' ? chartMain : chartOpt;
                            if (ch && el.clientWidth > 0)
                                ch.applyOptions({ width: el.clientWidth, height: el.clientHeight });
                        });
                    }, 50);
                });
            });
        }

        // Right-click on Y-axis price scale → TradingView-style context menu
        function initPriceScaleContextMenu() {
            const PRICE_SCALE_WIDTH = 90; // px — Nifty 5-digit prices need ~90px

            function showPriceCtxMenu(e, target) {
                e.preventDefault();
                const existing = document.getElementById('price-scale-ctx-menu');
                if (existing) existing.remove();

                const chart = target === 'main' ? chartMain : chartOpt;
                if (!chart) return;

                const pScale = chart.priceScale('right');
                const pRange = getVisiblePriceRange(target);
                const tRange = chart.timeScale().getVisibleRange();
                const currentRatio = (pRange && tRange && tRange.to !== tRange.from)
                    ? ((pRange.to - pRange.from) / (tRange.to - tRange.from)).toFixed(4)
                    : null;
                const isLocked = lockStates[target];

                const menu = document.createElement('div');
                menu.id = 'price-scale-ctx-menu';
                menu.style.cssText = `
                    position:fixed; left:${e.clientX}px; top:${e.clientY}px;
                    background:#1e1e2e; border:1px solid rgba(255,255,255,0.12);
                    border-radius:8px; padding:6px 0; z-index:99999;
                    min-width:220px; box-shadow:0 8px 24px rgba(0,0,0,0.4);
                    font-size:0.82rem; font-family:'Inter',sans-serif; color:#e2e8f0;
                `;

                const mkItem = (label, sub, action, checked) => {
                    const row = document.createElement('div');
                    row.style.cssText = `display:flex; align-items:center; justify-content:space-between;
                        padding:7px 14px; cursor:pointer; gap:10px; border-radius:4px; margin:1px 4px;`;
                    row.onmouseenter = () => row.style.background = 'rgba(255,255,255,0.08)';
                    row.onmouseleave = () => row.style.background = 'transparent';
                    const left = document.createElement('span');
                    left.style.cssText = 'display:flex; align-items:center; gap:8px;';
                    if (checked !== undefined) {
                        const tick = document.createElement('span');
                        tick.textContent = checked ? '✓' : '';
                        tick.style.cssText = 'width:14px; color:#6366f1; font-weight:700;';
                        left.appendChild(tick);
                    } else {
                        const sp = document.createElement('span'); sp.style.width = '14px'; left.appendChild(sp);
                    }
                    const lbl = document.createElement('span'); lbl.textContent = label; left.appendChild(lbl);
                    row.appendChild(left);
                    if (sub) {
                        const hint = document.createElement('span');
                        hint.textContent = sub;
                        hint.style.cssText = 'color:#64748b; font-size:0.78rem; white-space:nowrap;';
                        row.appendChild(hint);
                    }
                    if (action) row.onclick = () => { action(); menu.remove(); };
                    return row;
                };

                const sep = () => {
                    const d = document.createElement('div');
                    d.style.cssText = 'height:1px; background:rgba(255,255,255,0.08); margin:4px 0;';
                    return d;
                };

                // Reset price scale
                menu.appendChild(mkItem('Reset price scale', 'Alt+R', () => {
                    clearPriceRange(target);
                    lockStates[target] = false;
                    lockRatios[target] = null;
                    const btn = document.getElementById(`lock-btn-${target}`);
                    if (btn) { btn.classList.remove('active'); btn.style.background=''; btn.style.color='#6366f1'; }
                }));

                menu.appendChild(sep());

                // Auto (fits data to screen)
                menu.appendChild(mkItem('Auto (fits data to screen)', '', () => {
                    clearPriceRange(target);
                    chart.timeScale().fitContent();
                }));

                // Lock price to bar ratio
                menu.appendChild(mkItem(
                    'Lock price to bar ratio',
                    currentRatio || '',
                    () => toggleLockRatio(target),
                    isLocked
                ));

                menu.appendChild(sep());

                // Zoom In / Zoom Out Y
                menu.appendChild(mkItem('Zoom in Y', '', () => zoomY(target, 0.8)));
                menu.appendChild(mkItem('Zoom out Y', '', () => zoomY(target, 1.25)));

                document.body.appendChild(menu);

                // Close on any click outside
                const close = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', close); } };
                setTimeout(() => document.addEventListener('mousedown', close), 10);
            }

            // Document-level capture — fires before ANY element (including LC canvas)
            // can call stopPropagation. We then check which chart the click landed on.
            document.addEventListener('contextmenu', (e) => {
                for (const [id, target] of [['container-main','main'],['container-opt','opt']]) {
                    const box = document.getElementById(id);
                    if (!box) continue;
                    const rect = box.getBoundingClientRect();
                    const inBox = e.clientX >= rect.left && e.clientX <= rect.right &&
                                  e.clientY >= rect.top  && e.clientY <= rect.bottom;
                    if (inBox && e.clientX >= rect.right - PRICE_SCALE_WIDTH) {
                        e.preventDefault();
                        e.stopPropagation();
                        showPriceCtxMenu(e, target);
                        return;
                    }
                }
            }, { capture: true });
        }

        function initResizer() {
            const resizer = document.getElementById('chart-resizer');
            const leftSide = document.getElementById('container-main');
            const rightSide = document.getElementById('container-opt');
            const wrapper = document.querySelector('.chart-wrapper');

            let startX = 0;
            let leftWidth = 0;
            let isDragging = false;

            function forceChartResize() {
                const mainB = document.getElementById('chart-main');
                const optB  = document.getElementById('chart-opt');
                if (chartMain) chartMain.applyOptions({ width: mainB.clientWidth,  height: mainB.clientHeight });
                if (chartOpt)  chartOpt.applyOptions({  width: optB.clientWidth,   height: optB.clientHeight });
            }

            const onMove = function (e) {
                if (!isDragging) return;
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const dx = clientX - startX;
                const wrapW = wrapper.getBoundingClientRect().width;
                const newLeftPct = Math.min(85, Math.max(15, ((leftWidth + dx) * 100) / wrapW));
                leftSide.style.flex  = `0 0 ${newLeftPct}%`;
                rightSide.style.flex = `0 0 ${100 - newLeftPct}%`;
                forceChartResize();
            };

            const onUp = function () {
                if (!isDragging) return;
                isDragging = false;
                resizer.classList.remove('dragging');
                document.body.style.cursor     = '';
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup',   onUp);
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('touchend',  onUp);
                const overlay = document.getElementById('resize-overlay');
                if (overlay) overlay.remove();
                setTimeout(forceChartResize, 30);
            };

            function startDrag(clientX) {
                isDragging = true;
                startX     = clientX;
                leftWidth  = leftSide.getBoundingClientRect().width;
                resizer.classList.add('dragging');
                document.body.style.cursor     = 'col-resize';
                document.body.style.userSelect = 'none';
                // Block chart canvas from receiving mouse/touch so LC doesn't pan
                const overlay = document.createElement('div');
                overlay.id = 'resize-overlay';
                overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;cursor:col-resize;';
                document.body.appendChild(overlay);
            }

            resizer.addEventListener('mousedown', (e) => {
                startDrag(e.clientX);
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup',   onUp);
            });

            // iPad / touch support
            resizer.addEventListener('touchstart', (e) => {
                startDrag(e.touches[0].clientX);
                document.addEventListener('touchmove', onMove, { passive: true });
                document.addEventListener('touchend',  onUp);
            }, { passive: true });
        }

        function clearSeries(list, chart) { list.forEach(s => chart.removeSeries(s)); return []; }

        function handleTimeScaleChange(source) {
            // Automatic sync disabled to prevent recursion and "2 bar" crashes.
            // Charts will only align during initial load or explicit "Jump".
            syncTradePills(source);
        }

        function checkDhanAuth() {
            const source = document.getElementById('source-select').value;
            const savedToken = sessionStorage.getItem('dhan_access_token');
            if (source === 'dhan_api' && !savedToken) {
                document.getElementById('dhan-auth-modal').style.display = 'flex';
            }
        }

        document.getElementById('source-select').onchange = checkDhanAuth;
        document.getElementById('close-dhan-modal').onclick = () => document.getElementById('dhan-auth-modal').style.display = 'none';
        document.getElementById('save-dhan-btn').onclick = async () => {
            const cid = document.getElementById('dhan-client-id').value.trim();
            const token = document.getElementById('dhan-access-token').value.trim();
            if (!cid || !token) { alert('Please provide both Client ID and Token'); return; }

            const btn = document.getElementById('save-dhan-btn');
            btn.textContent = 'Testing connection...';
            btn.disabled = true;

            // Test token validity before saving
            try {
                const res = await fetch('/api/strategy/test-dhan-token', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({dhan_cid: cid, dhan_token: token})
                });
                const data = await res.json();
                if (data.ok) {
                    sessionStorage.setItem('dhan_client_id', cid);
                    sessionStorage.setItem('dhan_access_token', token);
                    document.getElementById('dhan-auth-modal').style.display = 'none';
                    showToast('Token valid! Credentials saved.', 'success');
                    try {
                        await fetch('/api/strategy/trigger-sync', { method: 'POST' });
                        setTimeout(() => checkSyncStatus(), 1500);
                    } catch(e) {}
                    runStrategy();
                } else {
                    showToast('Token rejected by Dhan: ' + (data.error || 'DH-906 Invalid Token'), 'error');
                }
            } catch(e) {
                showToast('Connection test failed: ' + e.message, 'error');
            }
            btn.textContent = 'Save & Continue';
            btn.disabled = false;
        };

        // Load existing session creds into fields
        document.getElementById('dhan-client-id').value = sessionStorage.getItem('dhan_client_id') || '';
        document.getElementById('dhan-access-token').value = sessionStorage.getItem('dhan_access_token') || '';

        let currentMainTF = '3m';
        let currentOptTF = '3m';

        async function switchTF(target, tf) {
            if (target === 'main') currentMainTF = tf;
            else currentOptTF = tf;
            
            // Update UI buttons
            const group = document.getElementById(`tf-group-${target}`);
            const btns = group.querySelectorAll('.tf-btn');
            btns.forEach(b => {
                const clickAttr = b.getAttribute('onclick') || '';
                if (clickAttr.includes('switchTF')) {
                    const match = clickAttr.match(/'([^']+)'\s*,\s*'([^']+)'/);
                    if (match && match[2]) {
                        b.classList.toggle('active', match[2] === tf);
                    }
                }
            });
            
            // Trigger refresh for only this chart
            await runStrategy(target === 'opt', true);
        }

        async function runStrategy(isOpt = false, silent = false, noFit = false) {
            const loader = document.getElementById('loader');
            if (!silent) {
                loader.style.display = 'flex';
            }
            
            const targetSymbol = isOpt ? document.getElementById('symbol').value : 'Nifty 50 (^NSEI)';
            const targetChart = isOpt ? chartOpt : chartMain;
            const targetCandle = isOpt ? candleOpt : candleMain;
            const targetE10 = isOpt ? ema10Opt : ema10Main;
            const targetE20 = isOpt ? ema20Opt : ema20Main;
            const targetMarker = isOpt ? markerOpt : markerMain;
            
            try {
                const params = new URLSearchParams({
                    start_date: document.getElementById('start-date').value,
                    end_date: document.getElementById('end-date').value,
                    timeframe: isOpt ? currentOptTF : currentMainTF,
                    fresh_zone: document.getElementById('use-fresh-zone').checked,
                    fib_exit: document.getElementById('fib-exit').checked,
                    zone_exit: document.getElementById('zone-exit').checked,
                    atr_exit: document.getElementById('atr-exit').checked,
                    start_time: document.getElementById('start-time').value,
                    end_time: document.getElementById('end-time').value,
                    source: document.getElementById('source-select').value,
                    symbol: targetSymbol,
                    strategy: document.getElementById('strategy-select').value,
                    hawa_me_zone: document.getElementById('hawa-me-zone-toggle').checked,
                    dhan_cid: sessionStorage.getItem('dhan_client_id') || '',
                    dhan_token: sessionStorage.getItem('dhan_access_token') || ''
                });

                const res = await fetch(`/api/strategy/nifty-data?${params.toString()}`);
                const dataRaw = await res.json();
                if (dataRaw.error) { if (!silent) console.error(dataRaw.error); return false; }

                // CLEAR ONLY AFTER SUCCESSFUL FETCH to avoid "flashing" or hanging
                if (isOpt) {
                    zoneSeriesOpt = clearSeries(zoneSeriesOpt, chartOpt);
                    tradeSeriesOpt = clearSeries(tradeSeriesOpt, chartOpt);
                    tradePills.opt = [];
                } else {
                    zoneSeriesMain = clearSeries(zoneSeriesMain, chartMain);
                    tradeSeriesMain = clearSeries(tradeSeriesMain, chartMain);
                    tradePills.main = [];
                }

                targetMarker.setMarkers([]);
                const chartData = dataRaw.chart_data;
                const zones = dataRaw.zones;
                const realTrades = dataRaw.real_trades || [];
                loadedRealTrades = realTrades; // Fix: Populate global variable for modals
                const visibleData = chartData.filter(d => !d.is_gap);
                
                // CRITICAL: Store the raw chartData so we have access to .datetime strings for fitting
                lastStrategyData.visibleData = chartData; 
                lastStrategyData.realTrades = realTrades;
                if (!visibleData.length) return false;

                targetCandle.setData(visibleData.map(d => ({ 
                    time: d.time, 
                    open: d.open, 
                    high: d.high, 
                    low: d.low, 
                    close: d.close,
                    color: d.bar_color || undefined,
                    borderColor: d.bar_color || undefined,
                    wickColor: d.bar_color || undefined
                })));
                targetE10.setData(chartData.map(d => ({ time: d.time, value: d.ema10 === null ? null : d.ema10 })));
                targetE20.setData(chartData.map(d => ({ time: d.time, value: d.ema20 === null ? null : d.ema20 })));
                targetMarker.setData(visibleData.map(d => ({ time: d.time, value: d.close })));

                // Update Static Levels
                const strategy = document.getElementById('strategy-select').value;
                // ONLY show levels and strategy markers on MAIN chart, not OPTION chart
                const showLevels = (!isOpt) && (strategy === 'Arsalan Sandbox' || strategy === 'Arsalan Reversal' || strategy === 'Arsalan X2');
                
                const targetLvl = isOpt ? { pdh: pdhOpt, pdl: pdlOpt, pdc: pdcOpt, pp: ppOpt, r1: r1Opt, s1: s1Opt, r2: r2Opt, s2: s2Opt, r3: r3Opt, s3: s3Opt, r4: r4Opt, s4: s4Opt, r5: r5Opt, s5: s5Opt } 
                                       : { pdh: pdhMain, pdl: pdlMain, pdc: pdcMain, pp: ppMain, r1: r1Main, s1: s1Main, r2: r2Main, s2: s2Main, r3: r3Main, s3: s3Main, r4: r4Main, s4: s4Main, r5: r5Main, s5: s5Main };
                
                Object.keys(targetLvl).forEach(k => {
                    if (showLevels) {
                        const lvlData = chartData
                            .map(d => ({ time: d.time, value: d[k] }))
                            .filter(p => p.value !== undefined);
                        
                        // Only set data if there's at least one non-null price point
                        if (lvlData.some(p => p.value !== null)) {
                            targetLvl[k].setData(lvlData);
                        } else {
                            targetLvl[k].setData([]);
                        }
                    } else {
                        targetLvl[k].setData([]);
                    }
                });

                const zMarkers = [];
                const patternMarkers = [];

                if (!isOpt) {
                    visibleData.forEach(d => {
                        // Entry Signals
                        if (d.bull_trigger) {
                            patternMarkers.push({ time: d.time, position: 'belowBar', color: '#26a69a', shape: 'arrowUp', size: 2, text: 'ENTRY-L' });
                        }
                        if (d.bear_trigger) {
                            patternMarkers.push({ time: d.time, position: 'aboveBar', color: '#ffa726', shape: 'arrowDown', size: 2, text: 'ENTRY-S' });
                        }
                    });

                    zones.forEach(zone => {
                        const zoneTimes = chartData.map(d => d.time).filter(t => t >= zone.start_time && t <= zone.end_time);
                        if (zoneTimes.length < 2) return;
                        const color = zone.type === 'bull' ? 'rgba(38, 166, 154, 0.4)' : 'rgba(211, 47, 47, 0.4)';
                        const u = targetChart.addLineSeries({ color, lineWidth: 3, priceLineVisible: false, lastValueVisible: false });
                        const l = targetChart.addLineSeries({ color, lineWidth: 3, priceLineVisible: false, lastValueVisible: false });
                        u.setData(zoneTimes.map(t => ({ time: t, value: zone.high })));
                        l.setData(zoneTimes.map(t => ({ time: t, value: zone.low })));
                        
                        // Add Size Label at the end of the zone
                        u.setMarkers([{
                            time: zoneTimes[zoneTimes.length - 1],
                            position: 'inBar',
                            color: zone.type === 'bull' ? '#00695c' : '#c62828',
                            shape: 'circle',
                            size: 0,
                            text: Math.round(zone.high - zone.low).toString()
                        }]);
                        zoneSeriesMain.push(u, l);
                    });
                }

                const rtMarkers = [];
                const dailyCounts = {};

                realTrades.forEach((rt, idx) => {
                    const entryT = rt.entry_time;
                    const exitT = rt.exit_time;
                    
                    // Use actual trade prices for Opt chart, but Index prices for Main chart
                    const entryCandle = visibleData.find(d => d.time === entryT) || visibleData.filter(d => d.time <= entryT).pop();
                    const exitCandle = visibleData.find(d => d.time === exitT) || visibleData.filter(d => d.time <= exitT).pop();
                    
                    if (!entryCandle || !exitCandle) return;

                    const isCE = rt.instrument.toUpperCase().includes('CE') || rt.instrument.toUpperCase().includes('CALL');
                    
                    // DAILY RESET LOGIC: Count trades within the specific date
                    const tradeDate = new Date(entryT * 1000).toISOString().split('T')[0];
                    dailyCounts[tradeDate] = (dailyCounts[tradeDate] || 0) + 1;
                    const tradeNum = dailyCounts[tradeDate];
                    
                    let entryP, exitP;
                    // ALWAYS snap to candles for visual alignment, but keep ledger prices for labels
                    // (entryCandle and exitCandle are already defined from visibleData/chartData above)
                    
                    if (entryCandle && exitCandle) {
                        const isCE = rt.instrument.toUpperCase().includes('CE') || rt.instrument.toUpperCase().includes('CALL');
                        entryP = isCE ? entryCandle.high : entryCandle.low;
                        exitP = isCE ? exitCandle.high : exitCandle.low;
                    } else if (isOpt) {
                        entryP = rt.entry_price || 0;
                        exitP = rt.exit_price || 0;
                    }
                    
                    if (entryT && exitT && entryP && exitP) {
                        const tradeColor = rt.pl > 0 ? 'rgba(38, 166, 154, 0.8)' : 'rgba(239, 83, 80, 0.8)';
                        const duration = Math.round((exitT - entryT) / 60);
                        const isCE = rt.instrument.toUpperCase().includes('CE') || rt.instrument.toUpperCase().includes('CALL');

                        if (isOpt) {
                            // PREMIUM CHART: Lines + Labels
                            const tSeries = targetChart.addLineSeries({
                                color: tradeColor, lineWidth: 2, lineStyle: 0, 
                                priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false
                            });
                            
                            const tradeTrack = chartData.filter(d => d.time >= entryT && d.time <= exitT);
                            if (tradeTrack.length >= 1) {
                                if (tradeTrack.length === 1) {
                                    tSeries.setData([{ time: tradeTrack[0].time, value: entryP }, { time: tradeTrack[0].time + 60, value: exitP }]);
                                } else {
                                    const totalSteps = tradeTrack.length - 1 || 1;
                                    tSeries.setData(tradeTrack.map((d, index) => ({
                                        time: d.time,
                                        value: entryP + (exitP - entryP) * (index / totalSteps)
                                    })));
                                }
                                tradeSeriesOpt.push(tSeries);
                                
                                rtMarkers.push({
                                    time: entryT, position: 'inBar', 
                                    color: '#6366f1', shape: 'circle', size: 1,
                                    text: `t${tradeNum} IN @ ${Math.round(rt.entry_price || entryP)}`
                                });
                                rtMarkers.push({
                                    time: exitT, position: 'inBar', 
                                    color: rt.pl > 0 ? '#10b981' : '#ef4444', shape: 'circle', size: 1,
                                    text: `t${tradeNum} OUT @ ${Math.round(rt.exit_price || exitP)} (₹${Math.round(rt.pl)})`
                                });

                                // Add Pills for Option Chart
                                tradePills.opt.push({
                                    time: entryT, price: entryP, pl: 0, text: `t${tradeNum}<br>@${Math.round(rt.entry_price || entryP)}`, isCE, position: isCE ? 'above' : 'below'
                                });
                                tradePills.opt.push({
                                    time: exitT, price: exitP, pl: rt.pl, text: `t${tradeNum}<br>@${Math.round(rt.exit_price || exitP)}<br>₹${Math.round(rt.pl)}`, isCE, position: isCE ? 'above' : 'below'
                                });
                            }
                        } else {
                            // INDEX CHART
                             rtMarkers.push({
                                 time: entryT,
                                 position: isCE ? 'aboveBar' : 'belowBar',
                                 color: isCE ? '#f9a825' : '#9c27b0',
                                 shape: isCE ? 'arrowDown' : 'arrowUp',
                                 size: 2,
                                 text: `t${tradeNum} | ₹${Math.round(rt.pl)}`
                             });

                            tradePills.main.push({
                                time: exitT,
                                price: exitP,
                                pl: rt.pl,
                                text: `t${tradeNum}<br>₹${Math.round(rt.pl)}`,
                                isCE,
                                position: isCE ? 'above' : 'below'
                            });
                        }
                    }
                });

                setTimeout(() => { 
                    targetMarker.setMarkers([...zMarkers, ...rtMarkers, ...patternMarkers].sort((a,b) => a.time - b.time)); 
                    syncTradePills(isOpt ? 'opt' : 'main');
                }, 50);
                
                // FIXED: Preserve zoom/view if silent (switcher) update or noFit requested
                if (!silent && !noFit) {
                    targetChart.timeScale().fitContent();
                }
                
                return true;
            } catch (e) { console.error(e); return false; }
            finally { if (!silent) loader.style.display = 'none'; }
        }

