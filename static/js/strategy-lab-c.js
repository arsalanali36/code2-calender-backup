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
            
            // Check for deep-link parameters from Gallery
            const urlParams = new URLSearchParams(window.location.search);
            const sym = urlParams.get('symbol');
            const dt = urlParams.get('date');
            const jump = urlParams.get('jumpTime');

            if (sym && dt) {
                // If we have instrument details, load it (this handles runStrategy too)
                await loadInstrument(sym, dt);
                
                // If we also have a specific trade time, jump to it
                if (jump) {
                    setTimeout(() => {
                        if (typeof jumpToTrade === 'function') jumpToTrade(parseInt(jump));
                    }, 800); // Small delay to let charts settle
                }
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
