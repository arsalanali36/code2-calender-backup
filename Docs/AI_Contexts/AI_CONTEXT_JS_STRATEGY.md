# JS - Strategy Lab
Consolidated code context for AI assistants.


## File: `static/js/strategy-lab-a.js`
```js
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
            const cid = document.getElementById('dhan-client-id').value;
            const token = document.getElementById('dhan-access-token').value;
            if (cid && token) {
                sessionStorage.setItem('dhan_client_id', cid);
                sessionStorage.setItem('dhan_access_token', token);
                document.getElementById('dhan-auth-modal').style.display = 'none';
                
                // Trigger background sync immediately
                try {
                    await fetch('/api/strategy/trigger-sync', { method: 'POST' });
                    // Give it a second and then check status
                    setTimeout(() => checkSyncStatus(), 1500);
                } catch(e) { console.error("Trigger fail", e); }

                runStrategy();
            } else {
                alert('Please provide both Client ID and Token');
            }
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
                const showLevels = (!isOpt) && (strategy === 'Arsalan Sandbox' || strategy === 'Arsalan Reversal');
                
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


```

## File: `static/js/strategy-lab-b.js`
```js
function jumpToTrade(t) {
            if (!chartMain || !t) return;
            document.getElementById('trades-modal').style.display = 'none';
            try {
                // Expanded window: 90 mins before, 90 mins after for better context
                const from = t - 5400; 
                const to = t + 5400;
                chartMain.timeScale().setVisibleRange({ from, to });
                if (chartOpt) chartOpt.timeScale().setVisibleRange({ from, to });
            } catch(e) { console.warn("Jump failed - chart not ready", e); }
        }

        async function loadInstrument(symbol, date) {
            const isIndex = symbol === 'Nifty 50 (^NSEI)';
            const optBox = document.getElementById('container-opt');
            const resizer = document.getElementById('chart-resizer');
            const dualBtn = document.getElementById('dual-view-btn');
            
            if (isIndex) {
                optBox.style.display = 'none';
                resizer.style.display = 'none';
                dualBtn.innerText = 'DUAL VIEW: OFF';
                document.getElementById('container-main').style.flex = '1';
                
                // Set 2-day lookback for EMA warmup
                const dt = new Date(date);
                dt.setDate(dt.getDate() - 2);
                const lookbackDate = dt.toISOString().split('T')[0];
                
                document.getElementById('symbol').value = symbol;
                document.getElementById('start-date').value = lookbackDate;
                document.getElementById('end-date').value = date;
                
                await runStrategy(false);
            } else {
                optBox.style.display = 'block';
                resizer.style.display = 'block';
                dualBtn.innerText = 'DUAL VIEW: ON';
                document.getElementById('opt-label').innerText = symbol;
                
                // Set 2-day lookback for EMA warmup
                const dt = new Date(date);
                dt.setDate(dt.getDate() - 2);
                const lookbackDate = dt.toISOString().split('T')[0];
                
                document.getElementById('symbol').value = symbol;
                document.getElementById('start-date').value = lookbackDate;
                document.getElementById('end-date').value = date;
                document.getElementById('nav-date-picker').value = date;
                
                // Force load BOTH charts with noFit to prevent zooming out
                await runStrategy(false, false, true);
                await runStrategy(true, false, true);
                
                // Force a resize calculation 
                setTimeout(() => {
                    const mainB = document.getElementById('chart-main');
                    const optB = document.getElementById('chart-opt');
                    if (chartMain) chartMain.applyOptions({ width: mainB.clientWidth, height: mainB.clientHeight });
                    if (chartOpt) chartOpt.applyOptions({ width: optB.clientWidth, height: optB.clientHeight });
                }, 100);
            }
            document.getElementById('history-modal').style.display = 'none';

            // Fixed Initial Zoom: Standard Market Hours (09:15 - 15:30)
            // Use UTC midnight ("T00:00:00Z") because Python's calendar.timegm() stores
            // candle timestamps treating IST wall-clock time as UTC. So chart "09:15" = UTC 09:15.
            // Local midnight (IST) would be 18:30 UTC the previous day, shifting the window by -5.5h.
            const tradeTs = Math.floor(new Date(date + "T00:00:00Z").getTime() / 1000);
            setTimeout(() => {
                const from = tradeTs + (9.25 * 3600);  // 09:15 AM  (9 + 15/60 = 9.25)
                const to   = tradeTs + (15.5  * 3600); // 03:30 PM  (15 + 30/60 = 15.5)
                const range = { from, to };
                if (chartMain) chartMain.timeScale().setVisibleRange(range);
                if (chartOpt) chartOpt.timeScale().setVisibleRange(range);
            }, 1000);
        }

        function toggleDualView(forceState = null) {
            const optBox = document.getElementById('container-opt');
            const resizer = document.getElementById('chart-resizer');
            const dualBtn = document.getElementById('dual-view-btn');
            
            const isHidden = optBox.style.display === 'none';
            const shouldShow = (forceState !== null) ? forceState : isHidden;
            
            if (shouldShow) {
                optBox.style.display = 'block';
                resizer.style.display = 'block';
                dualBtn.innerText = 'DUAL VIEW: ON';
                setTimeout(() => {
                    const mainB = document.getElementById('chart-main');
                    const optB = document.getElementById('chart-opt');
                    if (chartMain) chartMain.applyOptions({ width: mainB.clientWidth, height: mainB.clientHeight });
                    if (chartOpt) chartOpt.applyOptions({ width: optB.clientWidth, height: optB.clientHeight });
                    // Use noFit=true here to preserve any deep-link zoom
                    runStrategy(true, true, true); 
                }, 100);
            } else {
                optBox.style.display = 'none';
                resizer.style.display = 'none';
                if (document.getElementById('container-main')) document.getElementById('container-main').style.flex = '1';
                dualBtn.innerText = 'DUAL VIEW: OFF';
                setTimeout(() => {
                    const mainB = document.getElementById('chart-main');
                    if (chartMain) chartMain.applyOptions({ width: mainB.clientWidth, height: mainB.clientHeight });
                }, 100);
            }
        }

        function openTradesModal() {
            const container = document.getElementById('trades-list-container');
            document.getElementById('trades-modal').style.display = 'flex';
            container.innerHTML = loadedRealTrades.length ? loadedRealTrades.map(t => `
                <div style="padding:10px; border:1px solid #eee; border-radius:8px; display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div><div style="font-weight:600;">${t.instrument}</div><div style="font-size:0.8rem; color:#666;">Time: ${new Date(t.entry_time * 1000).toISOString().replace('T',' ').substring(0, 19)}</div></div>
                    <button class="nav-btn" onclick="jumpToTrade(${t.entry_time})">GOTO</button>
                </div>
            `).join('') : '<div style="text-align:center; padding:20px; color:#999;">No trades.</div>';
        }

        let cachedHistoryData = null;

        function formatSymbol(sym) {
            // NIFTY2641323600CE -> NIFTY | 26 | 4 | 13 | 23600 | CE
            // Try Weekly pattern
            const matchW = sym.match(/^(NIFTY)(\d{2})([1-9OND])(\d{2})(\d+)([CP]E)$/);
            if (matchW) {
                const [_, name, yy, mm, dd, strike, type] = matchW;
                // Convert O/N/D to 10/11/12 for display
                const mDisplay = mm === 'O' ? '10' : (mm === 'N' ? '11' : (mm === 'D' ? '12' : mm.padStart(2, '0')));
                return `${name} <span style="color:#cbd5e1; margin:0 4px;">|</span> ${yy} <span style="color:#cbd5e1; margin:0 4px;">|</span> ${mDisplay} <span style="color:#cbd5e1; margin:0 4px;">|</span> ${dd} <span style="color:#cbd5e1; margin:0 4px;">|</span> <span style="color:#0ea5e9;">${strike}</span> <span style="color:#cbd5e1; margin:0 4px;">|</span> ${type}`;
            }
            // Try Monthly pattern
            const matchM = sym.match(/^(NIFTY)(\d{2})([A-Z]{3})(\d+)([CP]E)$/);
            if (matchM) {
                const [_, name, yy, mon, strike, type] = matchM;
                return `${name} <span style="color:#cbd5e1; margin:0 4px;">|</span> ${yy} <span style="color:#cbd5e1; margin:0 4px;">|</span> ${mon} <span style="color:#cbd5e1; margin:0 4px;">|</span> <span style="color:#0ea5e9;">${strike}</span> <span style="color:#cbd5e1; margin:0 4px;">|</span> ${type}`;
            }
            return sym;
        }

        async function openHistoryModal() {
            const tbody = document.getElementById('history-table-body');
            const searchInput = document.getElementById('history-search-input');
            searchInput.value = ''; // Clear search on open
            
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#666;">Analyzing archive...</td></tr>';
            document.getElementById('history-modal').style.display = 'flex';
            
            try {
                const res = await fetch('/api/strategy/archive-dates');
                const data = await res.json();
                cachedHistoryData = data.dates || [];
                renderHistoryTable();
            } catch (e) {
                console.error(e);
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#ef5350;">Error loading history.</td></tr>';
            }
        }

        function renderHistoryTable() {
            const tbody = document.getElementById('history-table-body');
            const query = document.getElementById('history-search-input').value.toLowerCase();
            
            if (!cachedHistoryData || !cachedHistoryData.length) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#999;">No local data files found.</td></tr>';
                return;
            }

            let html = '';
            cachedHistoryData.forEach(d => {
                const filteredTrades = d.trades.filter(t => t.symbol.toLowerCase().includes(query));
                if (filteredTrades.length === 0 && query !== '') return; // Skip date if no trades match search

                const plColor = d.total_pl > 0 ? '#10b981' : (d.total_pl < 0 ? '#ef4444' : '#64748b');
                
                // Main Date Row
                html += `
                <tr style="background:#f1f5f9; border-top:2px solid #e2e8f0;">
                    <td style="padding:10px; font-weight:900; font-size:0.85rem; color:#1e293b; border-bottom:1px solid #cbd5e1;">
                        📅 ${d.date} <span style="font-weight:400; font-size:0.7rem; color:#64748b; margin-left:10px;">(${filteredTrades.length} Trades | ${d.resolution})</span>
                    </td>
                    <td colspan="3" style="border-bottom:1px solid #cbd5e1;"></td>
                    <td style="padding:10px; text-align:right; font-weight:900; font-size:0.95rem; color:${plColor}; border-bottom:1px solid #cbd5e1;">
                        ${d.total_pl !== 0 ? (d.total_pl > 0 ? '+' : '') + Math.round(d.total_pl).toLocaleString() : '₹ 0'}
                    </td>
                </tr>`;

                const instCounts = {};
                filteredTrades.forEach(t => instCounts[t.symbol] = (instCounts[t.symbol] || 0) + 1);
                const instColorMap = {};
                const getInstColor = (str) => {
                    if (instCounts[str] <= 1) return 'transparent';
                    if (instColorMap[str]) return instColorMap[str];
                    const colors = ['#f0fdf4', '#fdf2f8', '#fefce8', '#f0f9ff', '#f5f3ff', '#fff7ed', '#f0fdfa'];
                    let hash = 0;
                    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
                    return colors[Math.abs(hash) % colors.length];
                };

                html += filteredTrades.map(t => {
                    const tPlColor = t.pl > 0 ? '#059669' : (t.pl < 0 ? '#dc2626' : '#64748b');
                    const timeStr = (t.entry_time && t.exit_time) ? `<span style="color:#94a3b8; font-weight:400;"> [${t.entry_time.substring(0,5)}-${t.exit_time.substring(0,5)}]</span>` : '';
                    const bgGroup = getInstColor(t.symbol);
                    const isGrouped = instCounts[t.symbol] > 1;
                    const lots = t.qty > 0 ? Math.round(t.qty / 65) : 0;
                    const statusIcon = t.has_data ? '<span style="color:#10b981; font-size:0.8rem; margin-right:4px;">✅</span>' : '<span style="color:#ef4444; font-size:0.8rem; margin-right:4px;">❌</span>';
                    const weekDots = t.weekly_history ? t.weekly_history.map((hasData, i) => {
                        const dStr = t.weekly_dates[i];
                        return `<span style="width:7px; height:7px; background:${hasData ? '#10b981' : '#e2e8f0'}; border-radius:50%; display:inline-block; margin:0 1px;" title="${hasData ? 'Available' : 'Missing'}: ${dStr}"></span>`;
                    }).join('') : '';

                    return `
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:8px 10px 8px 30px; font-size:0.8rem; color:#334155; vertical-align:middle;">
                            <span style="color:#cbd5e1; margin-right:8px;">↳</span>
                            <span style="font-family:monospace; font-size:0.75rem; color:#64748b;">${timeStr}</span>
                            <span style="margin-left:5px; white-space:nowrap;">
                                ${statusIcon}
                                <span onclick="loadInstrument('${t.symbol}', '${d.date}')" style="cursor:pointer; color:#0e7490; font-weight:700; padding:4px 8px; border-radius:6px; background:${bgGroup}; border:${isGrouped ? '1px solid rgba(0,0,0,0.1)' : 'none'}; font-size: 0.85rem; letter-spacing: 0.5px;">
                                    ${formatSymbol(t.symbol)}
                                </span>
                                <span style="font-size:0.7rem; font-weight:800; color:#64748b; margin-left:3px;">(${lots}L)</span>
                                <span onclick="event.stopPropagation(); syncInstrumentWeek('${t.symbol}', '${d.date}')" style="cursor:pointer; margin-left:8px; font-size:0.7rem; color:#6366f1; background:#eef2ff; padding:2px 6px; border-radius:4px; border:1px solid #c7d2fe;">🔄 SYNC</span>
                            </span>
                        </td>
                        <td style="padding:6px; text-align:center; vertical-align:middle;"><div style="display:flex; justify-content:center; gap:2px;">${weekDots}</div></td>
                        <td style="padding:6px 10px; text-align:center; font-size:0.75rem; font-weight:600; color:#475569;">${t.duration || '--'}</td>
                        <td style="padding:6px 10px; text-align:center; font-size:0.75rem; font-weight:600; color:#475569;">${t.pt !== 0 ? (t.pt > 0 ? '+' : '') + t.pt.toFixed(1) : '0'}</td>
                        <td style="padding:6px 10px; text-align:right; font-weight:700; font-size:0.85rem; color:${tPlColor};">${t.pl !== 0 ? (t.pl > 0 ? '+' : '') + Math.round(t.pl).toLocaleString() : '0'}</td>
                    </tr>`;
                }).join('');
            });
            tbody.innerHTML = html || '<tr><td colspan="5" style="text-align:center; padding:20px; color:#999;">No matching instruments found.</td></tr>';
        }

        document.getElementById('close-history-modal').onclick = () => document.getElementById('history-modal').style.display = 'none';
        document.getElementById('open-history-btn').onclick = openHistoryModal;
        document.getElementById('history-search-input').oninput = renderHistoryTable;
        document.getElementById('close-trades-modal-btn').onclick = () => document.getElementById('trades-modal').style.display = 'none';
        document.getElementById('open-trades-modal-btn').onclick = openTradesModal;
        document.getElementById('run-btn').onclick = () => runStrategy();
        document.getElementById('prev-day-btn').onclick = () => { const d = new Date(document.getElementById('start-date').value); d.setDate(d.getDate()-1); document.getElementById('start-date').value = d.toISOString().split('T')[0]; runStrategy(); };
        document.getElementById('next-day-btn').onclick = () => { const d = new Date(document.getElementById('start-date').value); d.setDate(d.getDate()+1); document.getElementById('start-date').value = d.toISOString().split('T')[0]; runStrategy(); };
        document.getElementById('dual-view-btn').onclick = toggleDualView;
        document.getElementById('fit-btn').onclick = () => { 
            const selDate = document.getElementById('nav-date-picker').value; 
            if (selDate && lastStrategyData.visibleData) {
                const parts = selDate.split('-');
                const y = parseInt(parts[0]), m = parseInt(parts[1]), d = parseInt(parts[2]);
                
                // Get Local Day Start/End in Seconds
                const dayStart = Math.floor(new Date(y, m-1, d, 0, 0, 0).getTime() / 1000);
                const dayEnd = dayStart + 86400; // 24 hours later
                
                const dayData = lastStrategyData.visibleData.filter(item => {
                    return item.time >= dayStart && item.time <= dayEnd;
                });

                if (dayData.length > 0) {
                    const from = dayData[0].time;
                    const to = dayData[dayData.length - 1].time;
                    
                    // Zoom to the exact range
                    chartMain.timeScale().setVisibleRange({ from, to });
                    if (chartOpt) chartOpt.timeScale().setVisibleRange({ from, to });
                    
                    // Force a thicker candle view by adjusting bar spacing if it's too thin
                    const containerWidth = document.getElementById('chart-main').clientWidth;
                    const barCount = dayData.length;
                    if (barCount > 0) {
                        const spacing = (containerWidth / barCount) * 0.8;
                        chartMain.timeScale().applyOptions({ barSpacing: spacing });
                        if (chartOpt) chartOpt.timeScale().applyOptions({ barSpacing: spacing });
                    }
                } else {
                    alert("No data found in chart for: " + selDate);
                }
            }
        };
        document.getElementById('reset-btn').onclick = () => { 
            runStrategy(); // Re-runs and fits content
        };

        // KEYBOARD SHORTCUT: Alt + R for Smart Fit
        window.addEventListener('keydown', (e) => {
            // IGNORE if typing in an input or textarea
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
                return;
            }
            
            if (e.altKey && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                const btn = document.getElementById('fit-btn');
                if (btn) btn.click();
            }
            if (e.altKey && e.key.toLowerCase() === 'g') {
                e.preventDefault();
                const dp = document.getElementById('nav-date-picker');
                if (dp) { dp.focus(); dp.showPicker && dp.showPicker(); }
            }
        });
        document.getElementById('sidebar-toggle-btn').onclick = (e) => { 
            e.stopPropagation();
            const sb = document.getElementById('sidebar'); 
            sb.classList.toggle('collapsed'); 
            document.getElementById('sidebar-toggle-btn').innerText = sb.classList.contains('collapsed') ? '▶' : '◀'; 
        };

        // Close sidebar when clicking outside
        document.addEventListener('click', (e) => {
            const sb = document.getElementById('sidebar');
            const btn = document.getElementById('sidebar-toggle-btn');
            if (!sb.contains(e.target) && e.target !== btn && !sb.classList.contains('collapsed')) {
                sb.classList.add('collapsed');
                btn.innerText = '▶';
            }
        });

        // Prevent closing when clicking inside sidebar
        document.getElementById('sidebar').onclick = (e) => e.stopPropagation();

        window.resetChart = async function() {
            await fetchAndDrawStrategyData();
            if (chartMain) chartMain.timeScale().fitContent();
        }

        let equityChart = null;
        window.showEquityCurve = function() {
            const modal = document.getElementById('equity-curve-modal');
            modal.style.display = 'flex';
            
            const trades = lastStrategyData.realTrades || [];
            if (trades.length === 0) {
                alert("No real trades found for this range.");
                // modal.style.display = 'none';
                // return;
            }

            // Calculate Cumulative MTM
            const sortedTrades = [...trades].sort((a, b) => a.entry_time - b.entry_time);
            let runningPL = 0;
            const data = [];
            
            // Initial point
            if (sortedTrades.length > 0) {
                data.push({ time: sortedTrades[0].entry_time - 300, value: 0 });
            } else {
                data.push({ time: Math.floor(Date.now()/1000) - 3600, value: 0 });
            }

            sortedTrades.forEach(t => {
                runningPL += (t.pl || 0);
                data.push({ time: t.entry_time, value: runningPL });
            });

            const totalPL = Math.round(runningPL);
            const mtmDisplay = document.getElementById('mtm-total-display');
            mtmDisplay.innerText = (totalPL >= 0 ? '+' : '') + totalPL.toLocaleString();
            mtmDisplay.style.color = totalPL >= 0 ? '#10b981' : '#ef4444';
            document.getElementById('mtm-count-text').innerText = trades.length;

            // Initialize or update chart
            setTimeout(() => {
                const container = document.getElementById('equity-chart');
                if (!equityChart) {
                    equityChart = LightweightCharts.createChart(container, {
                        layout: { backgroundColor: 'transparent', textColor: '#666' },
                        grid: { vertLines: { color: '#222' }, horzLines: { color: '#222' } },
                        timeScale: { borderColor: '#333', timeVisible: true, secondsVisible: false },
                        priceScale: { borderColor: '#333' }
                    });
                    const lineSeries = equityChart.addLineSeries({
                        color: '#ef4444', 
                        lineWidth: 3,
                        lineType: 0,
                        lastValueVisible: false,
                        priceLineVisible: false
                    });
                    equityChart.lineSeries = lineSeries;
                    
                    const areaSeries = equityChart.addAreaSeries({
                        topColor: 'rgba(239, 68, 68, 0.4)',
                        bottomColor: 'rgba(239, 68, 68, 0)',
                        lineVisible: false,
                        lastValueVisible: false,
                        priceLineVisible: false
                    });
                    equityChart.areaSeries = areaSeries;
                }

                const color = totalPL >= 0 ? '#10b981' : '#ef4444';
                const areaTop = totalPL >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';
                
                equityChart.lineSeries.applyOptions({ color: color });
                equityChart.areaSeries.applyOptions({ topColor: areaTop });

                equityChart.lineSeries.setData(data);
                equityChart.areaSeries.setData(data);
                
                // Add Markers for Peak and Low
                const peak = Math.max(...data.map(d => d.value));
                const low = Math.min(...data.map(d => d.value));
                const peakPoint = data.find(d => d.value === peak);
                const lowPoint = data.find(d => d.value === low);

                const markers = [];
                if (peakPoint && data.length > 2) markers.push({ time: peakPoint.time, position: 'aboveBar', color: '#10b981', shape: 'arrowDown', text: 'PEAK: ' + Math.round(peak) });
                if (lowPoint && data.length > 2) markers.push({ time: lowPoint.time, position: 'belowBar', color: '#ef4444', shape: 'arrowUp', text: 'LOW: ' + Math.round(low) });
                equityChart.lineSeries.setMarkers(markers);

                // Add Click Handler to jump to trade on main chart
                equityChart.subscribeClick(param => {
                    if (param.time) {
                        const targetTrade = sortedTrades.find(t => t.entry_time === param.time);
                        if (targetTrade) {
                            window.jumpToTrade(targetTrade.entry_time);
                            modal.style.display = 'none';
                        }
                    }
                });

                equityChart.timeScale().fitContent();
            }, 100);
        }

        async function checkSyncStatus() {
            try {
                const res = await fetch('/api/strategy/sync-status');
                const status = await res.json();
                const banner = document.getElementById('sync-banner');
                if (!banner) return;

                if (status.pending_count > 0) {
                    banner.style.display = 'flex';
                    let text = `<b>AUTO-SYNC:</b> ${status.pending_count} instruments pending.`;
                    if (status.token_missing) {
                        text = `<b>⚠️ ACTION REQUIRED:</b> ${status.pending_count} syncs paused. <a href="/settings" style="color:white; text-decoration:underline;">Update Dhan Token</a>`;
                        banner.style.background = '#e11d48';
                    } else if (status.is_syncing) {
                        const current = status.current_task ? ` | Fetching: <span style="font-family:monospace; background:rgba(0,0,0,0.2); padding:2px 5px; border-radius:3px;">${status.current_task}</span>` : '';
                        text = `<b>🔄 SYNCING:</b> [${status.progress}]${current}`;
                        banner.style.background = '#0891b2';
                    } else {
                        banner.style.background = '#4f46e5';
                    }
                    banner.innerHTML = `<span>${text}</span> <button onclick="this.parentElement.style.display='none'" style="background:none; border:none; color:white; font-weight:bold; cursor:pointer; margin-left:15px;">✕</button>`;
                } else {
                    banner.style.display = 'none';
                }
            } catch (e) { console.error("Sync check failed", e); }
        }

        async function syncInstrumentWeek(sym, date) {
            const btn = event.target;
            const originalText = btn.innerText;
            btn.innerText = 'WAIT...';
            btn.style.opacity = '0.5';
            btn.disabled = true;

            try {
                const res = await fetch('/api/strategy/sync-single', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbol: sym, date: date })
                });
                const data = await res.json();
                if (data.status === 'success') {
                    btn.innerText = 'DONE!';
                    btn.style.background = '#10b981';
                    btn.style.color = 'white';
                    setTimeout(() => openHistoryModal(), 1000); // Reload table
                } else {
                    alert("Sync failed: " + (data.error || "Unknown error"));
                    btn.innerText = 'RETRY';
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }
            } catch (e) {
                alert("Error: " + e.message);
                btn.innerText = 'RETRY';
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        }

        // Initialize sync polling
        setInterval(checkSyncStatus, 60000); // Every 1 minute
        checkSyncStatus(); // Initial call


```

## File: `static/js/strategy-lab-c.js`
```js
        async function syncAllData(silent = false) {
            const btn = document.getElementById('sync-all-btn');
            const modal = document.getElementById('sync-modal');
            const table = document.getElementById('sync-modal-table-body');
            const progressBar = document.getElementById('sync-modal-progress-bar');
            const mainStatus = document.getElementById('sync-modal-main-status');
            
            if (!silent) {
                modal.style.display = 'flex';
                table.innerHTML = '';
                progressBar.style.width = '0%';
                mainStatus.innerText = 'Initializing sync list...';
            }
            
            try {
                const sDate = document.getElementById('start-date').value || '';
                const eDate = document.getElementById('end-date').value || '';
                
                document.getElementById('sync-modal-range-info').innerText = `Range: ${sDate || 'All'} to ${eDate || 'Today'}`;
                mainStatus.innerText = 'Fetching tasks for selected range...';
                
                const listResp = await fetch(`/api/strategy/sync-tasks?start_date=${sDate}&end_date=${eDate}&_=${Date.now()}`);
                const tasks = await listResp.json();
                
                if (tasks.length === 0) {
                    if (!silent) {
                        mainStatus.innerText = 'No instruments found for this range.';
                        alert('No new instruments found to sync in this date range.');
                    }
                    return;
                }
                
                mainStatus.innerText = `Syncing ${tasks.length} instruments...`;
                let completed = 0;
                let errorDetails = "";
                const cid = sessionStorage.getItem('dhan_client_id') || '';
                const token = sessionStorage.getItem('dhan_access_token') || '';

                for (const task of tasks) {
                    const taskId = (task.symbol + "_" + task.date).replace(/[^a-zA-Z0-9]/g, "_");
                    const row = document.createElement('tr');
                    row.style.borderBottom = '1px solid #f8f9fa';
                    row.innerHTML = `
                        <td style="padding:6px; font-weight:600;">${task.symbol}</td>
                        <td style="padding:6px;">${task.date}</td>
                        <td style="padding:6px; text-align:center;">
                            <div style="display:flex; gap:3px; justify-content:center;">
                                ${['M','T','W','T','F'].map((d,i) => `<span id="dot-${taskId}-${i}" style="width:6px; height:6px; background:#ddd; border-radius:30%; display:inline-block;" title="${d}"></span>`).join('')}
                            </div>
                        </td>
                        <td id="status-${taskId}" style="padding:6px; text-align:right; color:#0969da; font-weight:700; width:100px;">Pending...</td>
                    `;
                    table.appendChild(row);
                    
                    const statusCell = row.querySelector(`#status-${taskId}`);
                    statusCell.innerText = 'Syncing...';

                    try {
                        const res = await fetch('/api/strategy/sync-single', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                ...task,
                                dhan_cid: cid,
                                dhan_token: token
                            })
                        });
                        const resData = await res.json();
                        if (resData.day_results) {
                            resData.day_results.forEach(day => {
                                const dot = document.getElementById(`dot-${taskId}-${day.weekday}`);
                                if (dot) {
                                    dot.style.background = (day.status === 'OK' || day.status === 'SKIP') ? '#10b981' : '#ef4444';
                                    dot.style.opacity = '1';
                                    dot.title = `${day.date}: ${day.status}`;
                                } else {
                                    console.log("Missing dot:", `dot-${taskId}-${day.weekday}`);
                                }
                            });
                        }
                        if (resData.errors > 0) {
                            statusCell.innerText = `Partial (${resData.synced} OK)`;
                            statusCell.style.color = '#f59e0b';
                            errorDetails += `${task.symbol} (${resData.errors} err). `;
                        } else if (resData.synced === 0 && !resData.error) {
                            statusCell.innerText = 'Already Synced/No Data';
                            statusCell.style.color = '#64748b';
                        } else {
                            statusCell.innerText = 'Completed';
                            statusCell.style.color = '#10b981';
                        }
                    } catch (e) { 
                        statusCell.innerText = 'Failed';
                        statusCell.style.color = '#ef4444';
                        errorDetails += `${task.symbol} failed. `;
                    }
                    
                    completed++;
                    const pct = Math.round((completed / tasks.length) * 100);
                    progressBar.style.width = pct + '%';
                }
                
                if (!silent) {
                    mainStatus.innerText = 'Sync Completed!';
                    if (errorDetails) {
                        alert('Sync Completed with some issues. See table for details.');
                    } else {
                        alert('Sync successful! Now run your strategy on these dates.');
                    }
                }
            } catch (e) { 
                console.error('Sync failed', e); 
                if (!silent) alert('Sync error: ' + e.message);
            }
        }

        document.getElementById('sync-all-btn').onclick = () => syncAllData();
        document.getElementById('relogin-btn').onclick = () => {
            document.getElementById('dhan-auth-modal').style.display = 'flex';
        };

        document.getElementById('close-sync-modal-btn').onclick = () => document.getElementById('sync-modal').style.display = 'none';
        window.addEventListener('DOMContentLoaded', async () => {
            initChart();
            
            const urlParams = new URLSearchParams(window.location.search);
            const sym = urlParams.get('symbol');
            const dt  = urlParams.get('date');
            const jump = urlParams.get('jumpTime');

            if (sym && dt) {
                // Introduce a small delay to ensure initChart and DOM settle
                setTimeout(async () => {
                    if (typeof toggleDualView === 'function') toggleDualView(true);
                    await loadInstrument(sym, dt);
                    // Full-day range (09:15–15:30) is applied inside loadInstrument.
                    // jumpToTrade is intentionally NOT called here so the chart opens
                    // in full-day view rather than a narrow zoom around the entry candle.
                }, 200);
            } else {
                // Normal load
                runStrategy(false);
            }

            // Auto-sync in background on load
            syncAllData(true);
        });


        window.openPivotModal = function() {
            document.getElementById('pivot-modal').style.display = 'flex';
            document.getElementById('pivot-edit-date').value = document.getElementById('start-date').value;
            loadPivotsForDate();
        };

        window.loadPivotsForDate = async function() {
            const date = document.getElementById('pivot-edit-date').value;
            if (!date) return;
            const res = await fetch(`/api/strategy/pivot-levels?date=${date}`);
            const levels = await res.json();
            
            const fields = ['pdh','pdc','pdl','pp','r1','r2','r3','r4','r5','s1','s2','s3','s4','s5'];
            fields.forEach(f => {
                const el = document.getElementById(`inp-${f}`);
                if (el) el.value = levels[f] || '';
            });
        };

        window.savePivots = async function() {
            const date = document.getElementById('pivot-edit-date').value;
            if (!date) { alert("Please select a date"); return; }
            
            const fields = ['pdh','pdc','pdl','pp','r1','r2','r3','r4','r5','s1','s2','s3','s4','s5'];
            const levels = {};
            fields.forEach(f => {
                const val = document.getElementById(`inp-${f}`).value;
                levels[f] = val ? parseFloat(val) : null;
            });
            
            const res = await fetch('/api/strategy/pivot-levels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date, levels })
            });
            
            if (res.ok) {
                alert("Pivot levels saved successfully!");
                document.getElementById('pivot-modal').style.display = 'none';
                runStrategy(); 
            } else {
                alert("Failed to save levels.");
            }
        };

        window.autoFillFromPaste = function() {
            const text = document.getElementById('pivot-bulk-paste').value;
            if (!text) return;
            
            const mapping = {
                'pdh': /NIFTY_PD_H\s*=\s*([\d.]+)/,
                'pdc': /NIFTY_PD_C\s*=\s*([\d.]+)/,
                'pdl': /NIFTY_PD_L\s*=\s*([\d.]+)/,
                'pp': /NIFTY_CP\s*=\s*([\d.]+)/,
                'r5': /NIFTY_R5\s*=\s*([\d.]+)/,
                'r4': /NIFTY_R4\s*=\s*([\d.]+)/,
                'r3': /NIFTY_R3\s*=\s*([\d.]+)/,
                'r2': /NIFTY_R2\s*=\s*([\d.]+)/,
                'r1': /NIFTY_R1\s*=\s*([\d.]+)/,
                's1': /NIFTY_S1\s*=\s*([\d.]+)/,
                's2': /NIFTY_S2\s*=\s*([\d.]+)/,
                's3': /NIFTY_S3\s*=\s*([\d.]+)/,
                's4': /NIFTY_S4\s*=\s*([\d.]+)/,
                's5': /NIFTY_S5\s*=\s*([\d.]+)/
            };
            
            Object.keys(mapping).forEach(key => {
                const match = text.match(mapping[key]);
                if (match && match[1]) {
                    document.getElementById(`inp-${key}`).value = match[1];
                }
            });
            alert("Auto-Fill complete! Check the boxes above before saving.");
        };

        async function syncInstrumentWeek(sym, date) {
            const cid = sessionStorage.getItem('dhan_client_id');
            const token = sessionStorage.getItem('dhan_access_token');
            if (!cid || !token) {
                alert("Please login with Dhan Credentials first.");
                return;
            }

            const btn = event.currentTarget;
            const originalText = btn.innerHTML;
            btn.innerHTML = '⌛ SYNCING...';
            btn.style.opacity = '0.6';
            btn.style.pointerEvents = 'none';

            try {
                const res = await fetch('/api/strategy/sync-single', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbol: sym, date: date, dhan_cid: cid, dhan_token: token })
                });
                const data = await res.json();
                if (data.status === 'success') {
                    // Success! Refresh the modal to show green dots
                    await openHistoryModal(); 
                    alert(`Sync Complete for ${sym}! ${data.synced} days updated.`);
                } else {
                    alert(`Sync Error: ${data.error || 'Unknown error'}`);
                    btn.innerHTML = originalText;
                    btn.style.opacity = '1';
                    btn.style.pointerEvents = 'auto';
                }
            } catch (e) {
                alert("Sync request failed.");
                btn.innerHTML = originalText;
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            }
        }

        async function syncInstrumentWeek(sym, date) {
            const cid = sessionStorage.getItem('dhan_client_id');
            const token = sessionStorage.getItem('dhan_access_token');
            if (!cid || !token) {
                alert("Please login with Dhan Credentials first.");
                return;
            }

            const btn = event.currentTarget;
            const originalText = btn.innerHTML;
            btn.innerHTML = '⌛ SYNCING...';
            btn.style.opacity = '0.6';
            btn.style.pointerEvents = 'none';

            try {
                const res = await fetch('/api/strategy/sync-single', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbol: sym, date: date, dhan_cid: cid, dhan_token: token })
                });
                const data = await res.json();
                if (data.status === 'success') {
                    // Success! Refresh the modal to show green dots
                    await openHistoryModal(); 
                    alert(`Sync Complete for ${sym}! ${data.synced} days updated.`);
                } else {
                    alert(`Sync Error: ${data.error || 'Unknown error'}`);
                    btn.innerHTML = originalText;
                    btn.style.opacity = '1';
                    btn.style.pointerEvents = 'auto';
                }
            } catch (e) {
                alert("Sync request failed.");
                btn.innerHTML = originalText;
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            }
        }

        async function syncSpecificDay(sym, date) {
            const cid = sessionStorage.getItem('dhan_client_id');
            const token = sessionStorage.getItem('dhan_access_token');
            if (!cid || !token) {
                alert("Please login with Dhan Credentials first (Settings -> Re-Login).");
                return;
            }

            // Visual feedback - temporary change color of clicked dot would be nice but we'll just show status
            const originalColor = '#e2e8f0';
            const btn = event.target;
            if (btn) btn.style.background = '#f59e0b'; // Amber for processing

            try {
                const res = await fetch('/api/strategy/sync-single', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbol: sym, date: date, dhan_cid: cid, dhan_token: token })
                });
                const data = await res.json();
                if (data.status === 'success' && data.synced > 0) {
                    if (btn) btn.style.background = '#10b981';
                    alert(`Successfully synced ${sym} for ${date}`);
                } else if (data.status === 'success' && data.synced === 0) {
                    if (btn) btn.style.background = '#64748b';
                    alert(`No data found for ${sym} on ${date} (Market might be closed).`);
                } else {
                    if (btn) btn.style.background = '#ef4444';
                    alert(`Sync Error: ${data.error || 'Unknown error'}`);
                }
            } catch (e) {
                if (btn) btn.style.background = '#ef4444';
                alert("Sync request failed.");
            }
        }

        document.getElementById('close-pivot-modal').onclick = () => document.getElementById('pivot-modal').style.display = 'none';

```
