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

        function toggleLockRatio(target) {
            const chart = target === 'main' ? chartMain : chartOpt;
            const container = document.getElementById(`chart-${target}`);
            const btn = document.getElementById(`lock-btn-${target}`);
            lockStates[target] = !lockStates[target];
            
            if (lockStates[target]) {
                btn.classList.add('active');
                btn.style.background = '#6366f1';
                btn.style.color = '#fff';
                
                const pScale = chart.priceScale('right');
                const pRange = pScale.priceRange();
                const tScale = chart.timeScale();
                const tRange = tScale.getVisibleRange();
                
                if (pRange && tRange) {
                    const priceSpan = pRange.to - pRange.from;
                    const timeSpan = tRange.to - tRange.from;
                    lockRatios[target] = priceSpan / timeSpan;
                }
                
                // Allow Scaling via Wheel (X), but disable dragging/axis-panning
                chart.applyOptions({
                    handleScroll: { mouseWheel: false, pressedMouseMove: false },
                    handleScale: { mouseWheel: true, axisPressedMouseMove: false }
                });
                pScale.applyOptions({ autoScale: false });
            } else {
                btn.classList.remove('active');
                btn.style.background = '';
                btn.style.color = '#6366f1';
                
                // Restore defaults
                chart.applyOptions({
                    handleScroll: { mouseWheel: true, pressedMouseMove: true },
                    handleScale: { mouseWheel: true, axisPressedMouseMove: true }
                });
                chart.priceScale('right').applyOptions({ autoScale: true });
                lockRatios[target] = null;
            }
        }

        function zoomY(target, factor) {
            const chart = target === 'main' ? chartMain : chartOpt;
            if (!chart) return;
            
            const pScale = chart.priceScale('right');
            const pRange = pScale.priceRange();
            if (!pRange || pRange.from === null || pRange.to === null) return;

            const currentFrom = pRange.from;
            const currentTo = pRange.to;
            const mid = (currentFrom + currentTo) / 2;
            const halfSpan = (currentTo - currentFrom) / 2;
            const newHalfSpan = halfSpan * factor;

            // Apply new range and disable autoScale
            pScale.applyOptions({
                autoScale: false,
                priceRange: {
                    from: mid - newHalfSpan,
                    to: mid + newHalfSpan
                }
            });
            
            // Recalculate ratio if currently locked or just turned on
            if (lockStates[target]) {
                const tRange = chart.timeScale().getVisibleRange();
                if (tRange) {
                    lockRatios[target] = (newHalfSpan * 2) / (tRange.to - tRange.from);
                }
            } else {
                // If not locked, the chart will still stay on manual scale until Reset is clicked
                console.log("Manual vertical zoom applied");
            }
        }

        function handleTimeScaleChange(target) {
            if (!lockStates[target] || !lockRatios[target]) return;
            const chart = target === 'main' ? chartMain : chartOpt;
            const tRange = chart.timeScale().getVisibleRange();
            if (!tRange) return;
            
            const timeSpan = tRange.to - tRange.from;
            const targetPriceSpan = timeSpan * lockRatios[target];
            const pScale = chart.priceScale('right');
            const pRange = pScale.priceRange();
            if (!pRange) return;
            
            const mid = (pRange.from + pRange.to) / 2;
            pScale.applyOptions({
                autoScale: false,
                priceRange: {
                    from: mid - (targetPriceSpan / 2),
                    to: mid + (targetPriceSpan / 2)
                }
            });
        }

        function syncTradePills(target) {
            try {
                const chart = target === 'main' ? chartMain : chartOpt;
                const overlay = document.getElementById(`overlay-${target}`);
                if (!chart || !overlay) return;

                overlay.innerHTML = '';
                const pills = tradePills[target];
                if (!pills || !pills.length) return;

                const timeScale = chart.timeScale();
                const priceScale = chart.priceScale('right');
                const visibleRange = timeScale.getVisibleRange();
                if (!visibleRange) return;

                pills.forEach(p => {
                    if (p.time < visibleRange.from - 600 || p.time > visibleRange.to + 600) return;
                    const x = timeScale.timeToCoordinate(p.time);
                    const y = priceScale.priceToCoordinate(p.price);
                    if (x === null || y === null) return;
                    if (x < 0 || x > overlay.clientWidth || y < 0 || y > overlay.clientHeight) return;

                    const div = document.createElement('div');
                    const winLossClass = p.pl > 0 ? 'pill-win' : (p.pl < 0 ? 'pill-loss' : 'pill-neutral');
                    const typeClass = p.isCE ? 'pill-ce' : 'pill-pe';
                    div.className = `trade-pill ${winLossClass} ${typeClass}`;
                    div.style.left = `${x}px`;
                    div.style.top = `${y + (p.position === 'above' ? -35 : 35)}px`;
                    div.innerHTML = p.text;
                    overlay.appendChild(div);
                });
            } catch (err) { console.warn("Pill Sync Err:", err); }
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
                    rightPriceScale: { visible: true, borderColor: '#d0d7de' },
                    crosshair: { mode: LightweightCharts.CrosshairMode.Normal }
                });
                
                const candle = c.addCandlestickSeries({ upColor: '#26a69a', downColor: '#ef5350' });
                const e10 = c.addLineSeries({ color: '#2196F3', lineWidth: 1, title: 'EMA 10' });
                const e20 = c.addLineSeries({ color: '#F44336', lineWidth: 1, title: 'EMA 20' });
                const marker = c.addLineSeries({ color: 'transparent', lineWidth: 0, priceLineVisible: false, lastValueVisible: false });
                
                // Static Levels (Sandbox)
                const pdh = c.addLineSeries({ color: 'rgba(239, 83, 80, 0.6)', lineWidth: 2, lineStyle: 2, title: 'PDH' });
                const pdl = c.addLineSeries({ color: 'rgba(38, 166, 154, 0.6)', lineWidth: 2, lineStyle: 2, title: 'PDL' });
                const pdc = c.addLineSeries({ color: 'rgba(33, 150, 243, 0.6)', lineWidth: 1, lineStyle: 2, title: 'PDC' });
                const pp = c.addLineSeries({ color: 'rgba(156, 39, 176, 0.5)', lineWidth: 1, lineStyle: 2, title: 'PP' });
                const r1 = c.addLineSeries({ color: 'rgba(239, 83, 80, 0.4)', lineWidth: 1, lineStyle: 2, title: 'R1' });
                const s1 = c.addLineSeries({ color: 'rgba(38, 166, 154, 0.4)', lineWidth: 1, lineStyle: 2, title: 'S1' });
                const r2 = c.addLineSeries({ color: 'rgba(239, 83, 80, 0.3)', lineWidth: 1, lineStyle: 2, title: 'R2' });
                const s2 = c.addLineSeries({ color: 'rgba(38, 166, 154, 0.3)', lineWidth: 1, lineStyle: 2, title: 'S2' });
                const r3 = c.addLineSeries({ color: 'rgba(239, 83, 80, 0.2)', lineWidth: 1, lineStyle: 2, title: 'R3' });
                const s3 = c.addLineSeries({ color: 'rgba(38, 166, 154, 0.2)', lineWidth: 1, lineStyle: 2, title: 'S3' });
                const r4 = c.addLineSeries({ color: 'rgba(239, 83, 80, 0.15)', lineWidth: 1, lineStyle: 2, title: 'R4' });
                const s4 = c.addLineSeries({ color: 'rgba(38, 166, 154, 0.15)', lineWidth: 1, lineStyle: 2, title: 'S4' });
                const r5 = c.addLineSeries({ color: 'rgba(239, 83, 80, 0.1)', lineWidth: 1, lineStyle: 2, title: 'R5' });
                const s5 = c.addLineSeries({ color: 'rgba(38, 166, 154, 0.1)', lineWidth: 1, lineStyle: 2, title: 'S5' });

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
        }

        function initResizer() {
            const resizer = document.getElementById('chart-resizer');
            const leftSide = document.getElementById('container-main');
            const rightSide = document.getElementById('container-opt');
            const wrapper = document.querySelector('.chart-wrapper');

            let x = 0;
            let leftWidth = 0;

            const mouseDownHandler = function (e) {
                x = e.clientX;
                leftWidth = leftSide.getBoundingClientRect().width;

                document.addEventListener('mousemove', mouseMoveHandler);
                document.addEventListener('mouseup', mouseUpHandler);
                resizer.classList.add('dragging');
                document.body.style.cursor = 'col-resize';
                // Add a temporary overlay to prevent chart interaction during drag
                const overlay = document.createElement('div');
                overlay.id = 'resize-overlay';
                overlay.style.position = 'fixed';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.right = '0';
                overlay.style.bottom = '0';
                overlay.style.zIndex = '5000';
                document.body.appendChild(overlay);
            };

            const mouseMoveHandler = function (e) {
                const dx = e.clientX - x;
                const newLeftWidth = ((leftWidth + dx) * 100) / wrapper.getBoundingClientRect().width;
                leftSide.style.flex = `0 0 ${newLeftWidth}%`;
                rightSide.style.flex = `1 1 0%`;
            };

            const mouseUpHandler = function () {
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
                resizer.classList.remove('dragging');
                document.body.style.cursor = 'default';
                const overlay = document.getElementById('resize-overlay');
                if (overlay) overlay.remove();

                // Force charts to resize after manual movement
                setTimeout(() => {
                    const mainB = document.getElementById('chart-main');
                    const optB = document.getElementById('chart-opt');
                    if (chartMain) chartMain.applyOptions({ width: mainB.clientWidth, height: mainB.clientHeight });
                    if (chartOpt) chartOpt.applyOptions({ width: optB.clientWidth, height: optB.clientHeight });
                }, 10);
            };

            resizer.addEventListener('mousedown', mouseDownHandler);
        }

        function clearSeries(list, chart) { list.forEach(s => chart.removeSeries(s)); return []; }

        function checkDhanAuth() {
            const source = document.getElementById('source-select').value;
            const savedToken = sessionStorage.getItem('dhan_access_token');
            if (source === 'dhan_api' && !savedToken) {
                document.getElementById('dhan-auth-modal').style.display = 'flex';
            }
        }

        document.getElementById('source-select').onchange = checkDhanAuth;
        document.getElementById('close-dhan-modal').onclick = () => document.getElementById('dhan-auth-modal').style.display = 'none';
        document.getElementById('save-dhan-btn').onclick = () => {
            const cid = document.getElementById('dhan-client-id').value;
            const token = document.getElementById('dhan-access-token').value;
            if (cid && token) {
                sessionStorage.setItem('dhan_client_id', cid);
                sessionStorage.setItem('dhan_access_token', token);
                document.getElementById('dhan-auth-modal').style.display = 'none';
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

        async function runStrategy(isOpt = false, silent = false) {
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
                lastStrategyData.realTrades = realTrades;
                loadedRealTrades = realTrades;

                const visibleData = chartData.filter(d => !d.is_gap);
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
                realTrades.forEach(rt => {
                    const entryT = rt.entry_time;
                    const exitT = rt.exit_time;
                    
                    // Use actual trade prices for Opt chart, but Index prices for Main chart
                    const entryCandle = visibleData.find(d => d.time === entryT) || visibleData.filter(d => d.time <= entryT).pop();
                    const exitCandle = visibleData.find(d => d.time === exitT) || visibleData.filter(d => d.time <= exitT).pop();
                    
                    if (!entryCandle || !exitCandle) return;

                    const isCE = rt.instrument.toUpperCase().includes('CE') || rt.instrument.toUpperCase().includes('CALL');
                    
                    let entryP, exitP;
                    if (isOpt) {
                        entryP = rt.entry_price || 0;
                        exitP = rt.exit_price || 0;
                    } else {
                        // Plot at Candle High/Low on Index Chart
                        entryP = isCE ? entryCandle.high : entryCandle.low;
                        exitP = isCE ? exitCandle.high : exitCandle.low;
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
                                    time: entryT, position: isCE ? 'aboveBar' : 'belowBar',
                                    color: '#6366f1', shape: 'circle', size: 0,
                                    text: `IN @ ${Math.round(entryP)}`
                                });
                                rtMarkers.push({
                                    time: exitT, position: isCE ? 'aboveBar' : 'belowBar',
                                    color: rt.pl > 0 ? '#10b981' : '#ef4444', shape: 'circle', size: 1,
                                    text: `OUT @ ${Math.round(exitP)} (₹${Math.round(rt.pl)})`
                                });

                                // Add Pills for Option Chart
                                tradePills.opt.push({
                                    time: entryT, price: entryP, pl: 0, text: 'IN', isCE, position: isCE ? 'above' : 'below'
                                });
                                tradePills.opt.push({
                                    time: exitT, price: exitP, pl: rt.pl, text: `OUT (${rt.pl > 0 ? '+' : ''}${Math.round(rt.pl)})`, isCE, position: isCE ? 'above' : 'below'
                                });
                            }
                        } else {
                            // INDEX CHART
                            let instClean = rt.instrument;
                            const instMatch = instClean.match(/(\d{4,6})\s*([CP]E)/);
                            if (instMatch) instClean = instMatch[1] + " " + instMatch[2];
                            else instClean = instClean.split(' ').pop();
                            
                            rtMarkers.push({
                                 time: entryT,
                                 position: isCE ? 'aboveBar' : 'belowBar',
                                 color: isCE ? '#f9a825' : '#9c27b0',
                                 shape: isCE ? 'arrowDown' : 'arrowUp',
                                 size: 2,
                                 text: `${instClean} | ₹${Math.round(rt.pl)}`
                             });

                            tradePills.main.push({
                                time: exitT,
                                price: exitP,
                                pl: rt.pl,
                                text: `${instClean} | ${duration}m | ₹${Math.round(rt.pl)}`,
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
                
                // FIXED: Preserve zoom/view if silent (switcher) update
                if (!silent) {
                    targetChart.timeScale().fitContent();
                }
                
                return true;
            } catch (e) { console.error(e); return false; }
            finally { if (!silent) loader.style.display = 'none'; }
        }

