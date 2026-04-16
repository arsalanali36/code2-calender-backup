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

