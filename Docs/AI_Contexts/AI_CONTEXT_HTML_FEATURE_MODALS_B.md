# HTML - Feature Modals B (strategy-lab)
Consolidated code context for AI assistants.


## File: `templates/modals-target-tracker-b.html`
```html
        <!-- Right Side: Actual Points Graph -->
        <div style="flex:1; display:flex; flex-direction:column; min-width:0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div
              style="font-size:0.9rem; font-weight:bold; color:var(--text); display:flex; align-items:center; gap:8px;">
              <span>📈</span> Actual Points Captured Today
            </div>
            <div style="display:flex; gap:12px; align-items:center;">
              <span style="font-size:0.75rem; color:var(--text2);">Total Pt:</span>
              <span id="tt-total-pts" style="font-size:1rem; font-weight:bold; color:var(--text);">0</span>
            </div>
          </div>
          <div
            style="background:var(--bg2); border:1px solid var(--border); border-radius:12px; padding:24px; flex:1; display:flex; flex-direction:column; box-shadow:0 4px 20px rgba(0,0,0,0.15); min-height:400px;">
            <div id="tt-actual-graph-wrap" style="flex:1; display:flex; flex-direction:column;">
              <div id="tt-actual-bars"
                style="flex:1; display:flex; flex-direction:column; gap:12px; overflow-y:auto; padding-right:8px;"
                class="scrollbar-custom">
                <!-- JS inserts bars here -->
                <div style="text-align:center; padding:40px; opacity:0.4; font-style:italic;">No trades captured for
                  this date yet...</div>
              </div>
            </div>
          </div>
        </div>

      </div> <!-- Closes tt-daily-view -->

      <!-- WEEKLY VIEW -->
      <div id="tt-weekly-view" style="display:none; flex-direction:column; gap:16px;">
        <div
          style="font-size:1.1rem; font-weight:bold; color:var(--text); display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
          <div style="display:flex; align-items:center; gap:16px;">
            <span>📅 Weekly Performance Breakdown</span>
            <div
              style="display:flex; background:var(--bg3); border:1px solid var(--border); border-radius:14px; overflow:hidden; padding:2px; height:24px;">
              <button id="tt-weekly-type-bar" class="active"
                style="border:none; background:var(--blue); color:#fff; border-radius:12px; padding:0 10px; cursor:pointer; font-size:0.65rem; font-weight:bold; transition:all 0.2s;">BAR</button>
              <button id="tt-weekly-type-bell"
                style="border:none; background:transparent; color:var(--text2); border-radius:12px; padding:0 10px; cursor:pointer; font-size:0.65rem; font-weight:bold; transition:all 0.2s;">BELL</button>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:16px;">
            <div
              style="display:flex; background:var(--bg3); border:1px solid var(--border); border-radius:14px; overflow:hidden; padding:2px; height:24px;">
              <button id="tt-weekly-agg-avg"
                style="border:none; background:transparent; color:var(--text2); border-radius:12px; padding:0 10px; cursor:pointer; font-size:0.65rem; font-weight:bold; transition:all 0.2s;">AVG</button>
              <button id="tt-weekly-agg-total" class="active"
                style="border:none; background:var(--blue); color:#fff; border-radius:12px; padding:0 10px; cursor:pointer; font-size:0.65rem; font-weight:bold; transition:all 0.2s;">TOTAL</button>
            </div>
            <span id="tt-weekly-month-label" style="font-size:0.9rem; color:var(--text2); font-weight:normal;">March
              2026</span>
          </div>
        </div>

        <div style="display:flex; gap:24px; align-items:stretch;">
          <div id="tt-weekly-list-wrap"
            style="flex:0 0 340px; background:var(--bg2); border:1px solid var(--border); border-radius:12px; padding:20px; box-shadow:0 4px 20px rgba(0,0,0,0.15); display:flex; flex-direction:column; gap:16px; overflow-y:auto; max-height:520px;"
            class="scrollbar-custom">
            <div id="tt-weekly-list" style="display:flex; flex-direction:column; gap:16px;">
              <div style="text-align:center; padding:40px; opacity:0.5;">Calculating weekly data...</div>
            </div>
          </div>
          <div
            style="flex:1; background:var(--bg2); border:1px solid var(--border); border-radius:12px; padding:20px; box-shadow:0 4px 20px rgba(0,0,0,0.15); display:flex; flex-direction:column;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
              <span
                style="font-size:0.85rem; color:var(--text2); font-weight:bold; letter-spacing:0.5px; text-transform:uppercase;">Metric
                Comparison</span>
              <div
                style="display:flex; background:var(--bg3); border:1px solid var(--border); border-radius:6px; overflow:hidden; padding:2px; height:34px;">
                <button class="tt-metric-btn active" data-metric="points"
                  style="border:none; background:var(--blue); color:#fff; border-radius:4px; padding:0 12px; cursor:pointer; font-size:0.75rem; font-weight:bold; transition:all 0.2s;">Points</button>
                <button class="tt-metric-btn" data-metric="avgPt"
                  style="border:none; background:transparent; color:var(--text2); border-radius:4px; padding:0 12px; cursor:pointer; font-size:0.75rem; font-weight:bold; transition:all 0.2s;">Avg
                  Pt</button>
                <button class="tt-metric-btn" data-metric="tradeCount"
                  style="border:none; background:transparent; color:var(--text2); border-radius:4px; padding:0 12px; cursor:pointer; font-size:0.75rem; font-weight:bold; transition:all 0.2s;">Trades</button>
                <button class="tt-metric-btn" data-metric="fees"
                  style="border:none; background:transparent; color:var(--text2); border-radius:4px; padding:0 12px; cursor:pointer; font-size:0.75rem; font-weight:bold; transition:all 0.2s;">Tax</button>
                <button class="tt-metric-btn" data-metric="avgDur"
                  style="border:none; background:transparent; color:var(--text2); border-radius:4px; padding:0 12px; cursor:pointer; font-size:0.75rem; font-weight:bold; transition:all 0.2s;">Avg
                  Dur</button>
              </div>
            </div>
            <div id="tt-weekly-comparison-chart"
              style="flex:1; width:100%; min-height:300px; position:relative; overflow:visible; margin-top:10px;">
              <!-- SVG Bar Chart -->
            </div>
          </div>
        </div>
      </div>

      <!-- MONTHLY VIEW -->
      <div id="tt-monthly-view" style="display:none; gap:20px; flex-direction:row; align-items:stretch;">

        <!-- Left Panel: Monthly Data -->
        <div
          style="flex:0 0 340px; display:flex; flex-direction:column; max-height: 550px; overflow-y: auto; padding-right: 8px;"
          class="scrollbar-custom">
          <div
            style="background:var(--bg2); border:1px solid var(--border); border-radius:8px; padding:16px; flex:none; display:flex; flex-direction:column;">
            <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.85rem;">
              <span style="color:var(--text2);">Trading Days Passed / Total:</span>
              <span id="tt-month-days-str" style="font-weight:bold; color:var(--text);">0 / 0</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.85rem;">
              <span style="color:var(--text2);">Expected Monthly Goal:</span>
              <span id="tt-month-overall-goal" style="font-weight:bold; color:var(--text);">₹ 0</span>
            </div>
            <div
              style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; border-top:1px dashed var(--border); padding-top:16px;">
              <div style="font-size:0.9rem; color:var(--text2);">Actual Monthly PL:</div>
              <div id="tt-month-actual" style="font-size:1.5rem; font-weight:bold; color:var(--green,#2ecc71);">₹ 0
              </div>
            </div>
            <div style="text-align:right; font-size:0.85rem; margin-top:8px;" id="tt-month-pacing">
              <!-- Pacing indicator -->
            </div>

            <!-- Monthly Slider -->
            <div style="margin-top:24px;">
              <div
                style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text2); margin-bottom:6px;">
                <span>Monthly Progress</span>
                <span id="tt-month-remaining-text">Remaining: ₹ 0</span>
              </div>
              <div
                style="width:100%; height:20px; background:var(--bg3); border-radius:10px; overflow:hidden; position:relative; border:1px solid rgba(255,255,255,0.1);">
                <div id="tt-month-progress-bar"
                  style="height:100%; width:0%; border-radius:10px; transition:width 0.4s ease, background 0.4s ease;">
                </div>
                <div id="tt-month-progress-text"
                  style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:bold; pointer-events:none; color:#fff; text-shadow:1px 1px 2px rgba(0,0,0,0.8);">
                  0%</div>
              </div>
            </div>

            <!-- AI Coach Section -->
            <div class="coach-card"
              style="margin-top:24px; padding:16px; background:linear-gradient(135deg, rgba(52,152,219,0.08), rgba(46,204,113,0.05)); border-radius:8px; border:1px solid rgba(52,152,219,0.2); position:relative; overflow:hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); transition:all 0.3s ease;">
              <div
                style="font-size:0.75rem; font-weight:bold; color:var(--text); text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
                <span style="font-size:1.1rem;">🧠</span> Smart Coach
              </div>
              <div id="tt-coach-message" style="font-size:0.85rem; color:var(--text); line-height:1.5;">
                Analyzing your performance...
              </div>

              <div id="tt-coach-metrics"
                style="margin-top:14px; display:flex; gap:10px; border-top:1px dashed rgba(255,255,255,0.1); padding-top:14px;">
                <div
                  style="flex:1; background:var(--bg3); padding:10px 6px; border-radius:6px; text-align:center; box-shadow:inset 0 2px 4px rgba(0,0,0,0.2);">
                  <div style="font-size:0.65rem; color:var(--text2); text-transform:uppercase; letter-spacing:0.5px;">
                    Req. Run Rate</div>
                  <div id="tt-coach-rr" style="font-size:0.95rem; font-weight:bold; color:var(--text); margin-top:4px;">
                    -</div>
                </div>
                <div
                  style="flex:1; background:var(--bg3); padding:10px 6px; border-radius:6px; text-align:center; box-shadow:inset 0 2px 4px rgba(0,0,0,0.2);">
                  <div style="font-size:0.65rem; color:var(--text2); text-transform:uppercase; letter-spacing:0.5px;">
                    Next Target</div>
                  <div id="tt-coach-milestone"
                    style="font-size:0.95rem; font-weight:bold; color:var(--blue); margin-top:4px;">-</div>
                </div>
              </div>
            </div>

            <!-- Performance Stats (Cricket Style) -->
            <div id="tt-perf-stats-box"
              style="margin-top:20px; padding:16px; background:var(--bg3); border-radius:12px; border:1px solid var(--border); box-shadow: 0 4px 12px rgba(0,0,0,0.2); cursor:pointer; transition: transform 0.2s;"
              title="Click to see Stability Score breakdown">
              <div
                style="font-size:0.75rem; font-weight:bold; color:var(--text2); text-transform:uppercase; letter-spacing:1px; margin-bottom:14px; display:flex; align-items:center; justify-content:space-between;">
                <span style="display:flex; align-items:center; gap:8px;"><span style="font-size:1.1rem;">📊</span>
                  Performance Strike Rate</span>
                <span style="font-size:0.9rem; opacity:0.6;">ⓘ</span>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <!-- Win Rate -->
                <div style="background:var(--bg2); padding:12px; border-radius:8px; text-align:center;">
                  <div style="font-size:0.65rem; color:var(--text2); text-transform:uppercase;">Win Rate</div>
                  <div id="tt-stat-winrate"
                    style="font-size:1.2rem; font-weight:bold; color:var(--green); margin-top:4px;">0%</div>
                  <div style="font-size:0.6rem; color:var(--text2); margin-top:4px;" id="tt-stat-winrate-desc">0 of 0
                    Days</div>
                </div>
                <!-- Avg Points -->
                <div style="background:var(--bg2); padding:12px; border-radius:8px; text-align:center;">
                  <div style="font-size:0.65rem; color:var(--text2); text-transform:uppercase;">Avg Pts Captured</div>
                  <div id="tt-stat-avgpts"
                    style="font-size:1.2rem; font-weight:bold; color:var(--blue); margin-top:4px;">
                    0</div>
                  <div style="font-size:0.6rem; color:var(--text2); margin-top:4px;">per trade</div>
                </div>
                <!-- Strike Rate Concept -->
                <div
                  style="background:var(--bg2); padding:12px; border-radius:8px; text-align:center; grid-column: span 2;">
                  <div
                    style="font-size:0.65rem; color:var(--text2); text-transform:uppercase; display:flex; justify-content:center; gap:4px;">
                    P/L Strike Rate <span style="font-size:0.6rem; opacity:0.6;">(Net vs Target)</span></div>
                  <div id="tt-stat-strikerate"
                    style="font-size:1.4rem; font-weight:bold; color:var(--text); margin-top:6px;">0.00</div>
                  <div style="font-size:0.65rem; color:var(--text2); margin-top:4px;" id="tt-stat-status-text">
                    Stability: -</div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Right Panel: Trajectory Graph -->
        <div style="flex:1; display:flex; flex-direction:column; min-width:0;">
          <div
            style="font-size:0.9rem; margin-bottom:12px; font-weight:bold; color:var(--text); display:flex; justify-content:space-between; align-items:center;">
            <span id="tt-chart-title">Expected vs Actual Cumulative</span>
            <div style="display:flex; gap:16px; align-items:center;">
              <div id="tt-chart-legend" style="font-size:0.75rem; font-weight:normal; display:flex; gap:12px;">
                <span style="display:flex; align-items:center; gap:6px;">
                  <div style="width:14px; height:3px; background:#e056fd;"></div> Expected
                </span>
                <span style="display:flex; align-items:center; gap:6px;">
                  <div style="width:14px; height:3px; background:#2ecc71;"></div> Actual
                </span>
              </div>
              <div
                style="display:flex; background:var(--bg3); border:1px solid var(--border); border-radius:6px; overflow:hidden; padding:2px; height:28px;">
                <button id="tt-view-line-btn"
                  style="padding:0 14px; background:var(--blue); color:#fff; border:none; border-radius:4px; font-size:0.8rem; font-weight:bold; cursor:pointer; transition:0.2s;">Line</button>
                <button id="tt-view-bar-btn"
                  style="padding:0 14px; background:transparent; color:var(--text2); border:none; border-radius:4px; font-size:0.8rem; font-weight:bold; cursor:pointer; transition:0.2s;">Bar</button>
              </div>
            </div>
          </div>
          <div
            style="background:var(--bg2); border:1px solid var(--border); border-radius:8px; padding:16px; flex:1; min-height:350px; position:relative; overflow:hidden;"
            class="scrollbar-custom">
            <div id="tt-monthly-chart" style="width:100%; height:100%; display:flex;">
              <!-- SVG or Bars will be injected via JS -->
            </div>
          </div>
        </div>

      </div>

    </div>
    <!-- Shared Tooltip for Charts/Weekly Bars -->
    <div id="tt-chart-tooltip"
      style="position:fixed; pointer-events:none; background:rgba(20,20,25,0.95); color:#fff; padding:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); font-size:0.8rem; z-index:10000; display:none; min-width:180px; box-shadow:0 8px 30px rgba(0,0,0,0.5); backdrop-filter:blur(10px);">
    </div>
  </div>
</div>
```

## File: `templates/strategy-lab-modals.html`
```html
    <!-- Dhan Credentials Modal -->
    <div class="modal-overlay" id="dhan-auth-modal">
        <div class="modal-content" style="width: 400px;">
            <div class="modal-header">
                <div class="modal-title">Dhan API Credentials</div>
                <div class="close-modal" id="close-dhan-modal">&times;</div>
            </div>
            <div style="padding: 10px 0;">
                <p style="font-size: 0.8rem; color: #666; margin-bottom: 15px;">Credentials are saved for this session only.</p>
                <div style="margin-bottom:15px;">
                    <label class="setting-item">CLIENT ID</label>
                    <input type="text" id="dhan-client-id" class="nav-btn" style="width:100%;" placeholder="e.g. 1101xxxx">
                </div>
                <div style="margin-bottom:20px;">
                    <label class="setting-item">ACCESS TOKEN (JWT)</label>
                    <textarea id="dhan-access-token" class="nav-btn" style="width:100%; height:80px; font-size: 0.7rem;" placeholder="Paste your JWT token here..."></textarea>
                </div>
                <button class="lab-btn lab-btn-primary" id="save-dhan-btn">Save & Continue</button>
            </div>
        </div>
    </div>
    <div class="modal-overlay" id="history-modal">
        <div class="modal-content" style="width: 750px; max-height: 80vh; padding:0;">
            <div class="modal-header" style="padding:15px 20px; border-bottom: 1px solid #eee; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
                    <div class="modal-title">Downloaded Data History</div>
                    <div style="position: relative; flex: 1; max-width: 300px;">
                        <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 0.8rem;">🔍</span>
                        <input type="text" id="history-search-input" placeholder="Search instrument (e.g. 23750)..." 
                               style="width: 100%; padding: 6px 10px 6px 30px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.8rem; outline: none;">
                    </div>
                </div>
                <div class="close-modal" id="close-history-modal" style="position: static; margin-left: 10px;">&times;</div>
            </div>
            <div style="padding: 0 20px 20px 20px; overflow-y: auto; max-height: 60vh;">
                <table style="width:100%; border-collapse: collapse; margin-top:15px;">
                    <thead style="position: sticky; top: 0; background: white; z-index: 10;">
                        <tr>
                            <th style="text-align:left; padding:10px; border-bottom:2px solid #eee; color:#64748b; font-size:0.7rem;">DATE / TRADE DETAILS</th>
                            <th style="text-align:center; padding:10px; border-bottom:2px solid #eee; color:#64748b; font-size:0.7rem; width:80px;">DATA (M-F)</th>
                            <th style="text-align:center; padding:10px; border-bottom:2px solid #eee; color:#64748b; font-size:0.7rem; width:60px;">DUR</th>
                            <th style="text-align:center; padding:10px; border-bottom:2px solid #eee; color:#64748b; font-size:0.7rem; width:60px;">PT</th>
                            <th style="text-align:right; padding:10px; border-bottom:2px solid #eee; color:#64748b; font-size:0.7rem; width:100px;">AMT/PL</th>
                        </tr>
                    </thead>
                    <tbody id="history-table-body">
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    <div class="modal-overlay" id="trades-modal"><div class="modal-content" style="width: 500px; max-height: 80vh; overflow-y: auto;"><div class="modal-header"><div class="modal-title">Real Trades Found</div><div class="close-modal" id="close-trades-modal-btn">&times;</div></div><div id="trades-list-container"></div></div></div>
    
    <div class="modal-overlay" id="sync-modal">
        <div class="modal-content" style="width: 600px; max-height: 80vh; overflow-y: auto;">
            <div class="modal-header">
                <div class="modal-title">Sync Process</div>
                <div class="close-modal" id="close-sync-modal-btn">&times;</div>
            </div>
            <div style="padding:15px;">
                <p id="sync-modal-range-info" style="font-size:0.75rem; color:#64748b; margin-top:-10px; margin-bottom:15px;"></p>
                <p id="sync-modal-main-status" style="font-size:0.9rem; margin-bottom:15px; font-weight:700; color:#10b981;">Starting sync...</p>
                <div style="height:10px; background:#eee; border-radius:5px; overflow:hidden; margin-bottom:20px;">
                    <div id="sync-modal-progress-bar" style="height:100%; width:0%; background:#10b981; transition:width 0.3s;"></div>
                </div>
                <table style="width:100%; border-collapse: collapse; font-size:0.8rem;">
                    <thead>
                        <tr style="border-bottom:1px solid #eee; color:#64748b; font-size:0.75rem;">
                            <th style="padding:8px; text-align:left;">INSTRUMENT</th>
                            <th style="padding:8px; text-align:left;">DATE</th>
                            <th style="padding:8px; text-align:center;">HISTORY (M T W T F)</th>
                            <th style="padding:8px; text-align:right;">STATUS</th>
                        </tr>
                    </thead>
                    <tbody id="sync-modal-table-body"></tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Pivot Editor Modal -->
    <div class="modal-overlay" id="pivot-modal" style="background: rgba(0,0,0,0.85); display:none; z-index: 9999;">
        <div style="width: 600px; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid #ddd;">
            <div style="padding: 15px 20px; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 18px;">🛠️</span>
                    <h2 style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 700;">Manual Pivot Level Editor</h2>
                </div>
                <div id="close-pivot-modal" style="cursor:pointer; font-size:24px; color:#94a3b8;">&times;</div>
            </div>
            <div style="padding: 20px;">
                <div style="margin-bottom: 20px; display: flex; gap: 10px; align-items: center;">
                    <label style="font-weight: 600; font-size: 13px;">Date:</label>
                    <input type="date" id="pivot-edit-date" class="nav-btn" style="flex:1;">
                    <button onclick="loadPivotsForDate()" class="nav-btn" style="background: #e2e8f0;">Load</button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                        <div style="margin-bottom:8px;"><label style="font-size:11px; font-weight:700; color:#64748b;">NIFTY_PD_H</label><input type="number" id="inp-pdh" step="0.05" style="width:100%; padding:5px; border:1px solid #ddd; border-radius:4px;"></div>
                        <div style="margin-bottom:8px;"><label style="font-size:11px; font-weight:700; color:#64748b;">NIFTY_PD_C</label><input type="number" id="inp-pdc" step="0.05" style="width:100%; padding:5px; border:1px solid #ddd; border-radius:4px;"></div>
                        <div style="margin-bottom:8px;"><label style="font-size:11px; font-weight:700; color:#64748b;">NIFTY_PD_L</label><input type="number" id="inp-pdl" step="0.05" style="width:100%; padding:5px; border:1px solid #ddd; border-radius:4px;"></div>
                        <div style="margin-bottom:8px;"><label style="font-size:11px; font-weight:700; color:#64748b;">NIFTY_CP (PP)</label><input type="number" id="inp-pp" step="0.05" style="width:100%; padding:5px; border:1px solid #ddd; border-radius:4px;"></div>
                    </div>
                    <div>
                        <div style="display:flex; gap:5px; margin-bottom:5px;">
                            <div style="flex:1;"><label style="font-size:9px; font-weight:700; color:#ef4444;">R5</label><input type="number" id="inp-r5" step="0.05" style="width:100%; border:1px solid #ddd; border-radius:4px;"></div>
                            <div style="flex:1;"><label style="font-size:9px; font-weight:700; color:#10b981;">S5</label><input type="number" id="inp-s5" step="0.05" style="width:100%; border:1px solid #ddd; border-radius:4px;"></div>
                        </div>
                        <div style="display:flex; gap:5px; margin-bottom:5px;">
                            <div style="flex:1;"><label style="font-size:9px; font-weight:700; color:#ef4444;">R4</label><input type="number" id="inp-r4" step="0.05" style="width:100%; border:1px solid #ddd; border-radius:4px;"></div>
                            <div style="flex:1;"><label style="font-size:9px; font-weight:700; color:#10b981;">S4</label><input type="number" id="inp-s4" step="0.05" style="width:100%; border:1px solid #ddd; border-radius:4px;"></div>
                        </div>
                        <div style="display:flex; gap:5px; margin-bottom:5px;">
                            <div style="flex:1;"><label style="font-size:9px; font-weight:700; color:#ef4444;">R3</label><input type="number" id="inp-r3" step="0.05" style="width:100%; border:1px solid #ddd; border-radius:4px;"></div>
                            <div style="flex:1;"><label style="font-size:9px; font-weight:700; color:#10b981;">S3</label><input type="number" id="inp-s3" step="0.05" style="width:100%; border:1px solid #ddd; border-radius:4px;"></div>
                        </div>
                        <div style="display:flex; gap:5px; margin-bottom:5px;">
                            <div style="flex:1;"><label style="font-size:9px; font-weight:700; color:#ef4444;">R2</label><input type="number" id="inp-r2" step="0.05" style="width:100%; border:1px solid #ddd; border-radius:4px;"></div>
                            <div style="flex:1;"><label style="font-size:9px; font-weight:700; color:#10b981;">S2</label><input type="number" id="inp-s2" step="0.05" style="width:100%; border:1px solid #ddd; border-radius:4px;"></div>
                        </div>
                        <div style="display:flex; gap:5px; margin-bottom:5px;">
                            <div style="flex:1;"><label style="font-size:9px; font-weight:700; color:#ef4444;">R1</label><input type="number" id="inp-r1" step="0.05" style="width:100%; border:1px solid #ddd; border-radius:4px;"></div>
                            <div style="flex:1;"><label style="font-size:9px; font-weight:700; color:#10b981;">S1</label><input type="number" id="inp-s1" step="0.05" style="width:100%; border:1px solid #ddd; border-radius:4px;"></div>
                        </div>
                    </div>
                </div>
                <div style="margin-top: 15px; border-top: 1px dashed #ddd; padding-top: 15px;">
                    <label style="font-size:11px; font-weight:700; color:#6366f1;">BULK PASTE AREA (Paste your list here):</label>
                    <textarea id="pivot-bulk-paste" placeholder="NIFTY_PD_H = 24074.05&#10;NIFTY_PD_C = 24050.6..." style="width:100%; height:80px; font-size:11px; font-family:monospace; margin-top:5px; padding:8px; border:1px solid #ddd; border-radius:4px;"></textarea>
                    <button onclick="autoFillFromPaste()" class="nav-btn" style="width:100%; margin-top:5px; background:#f0fdf4; color:#16a34a; border-color:#bbf7d0;">⚡ AUTO-FILL FROM PASTE</button>
                </div>
            </div>
            <div style="padding: 15px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px;">
                <button onclick="document.getElementById('pivot-modal').style.display='none'" class="nav-btn" style="border:none; background:transparent;">Cancel</button>
                <button onclick="savePivots()" class="nav-btn" style="background:#6366f1; color:#fff; border:none; padding:8px 25px; font-weight:700;">SAVE LEVELS</button>
            </div>
        </div>
    </div>

```

## File: `templates/strategy-lab-sidebar.html`
```html
        <div class="lab-sidebar" id="sidebar">
            <h3 style="margin:0 0 20px 0; font-size: 1.1rem; border-bottom:1px solid #eee; padding-bottom:10px;">Configuration</h3>
            <div style="margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <label class="setting-item" style="margin:0;">SYMBOL</label>
                    <span style="font-size:0.7rem; color:#0969da; cursor:pointer; font-weight:600;" onclick="loadInstrument('Nifty 50 (^NSEI)', document.getElementById('start-date').value)">RESET TO INDEX</span>
                </div>
                <input type="text" id="symbol" class="nav-btn" style="width:100%;" value="Nifty 50 (^NSEI)" readonly>
            </div>
            <div style="margin-bottom:20px;">
                <label class="setting-item">DATA SOURCE</label>
                <select id="source-select" class="nav-btn" style="width:100%;">
                    <option value="dhan_local" selected>Dhan Local (CSV)</option>
                    <option value="dhan_api">Dhan API (Live)</option>
                </select>
            </div>
            <div style="margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <label class="setting-item" style="margin:0;">STRATEGY</label>
                </div>
                <select id="strategy-select" class="nav-btn" style="width:100%;">
                    <option value="Arsalan Continuation">Arsalan Continuation</option>
                    <option value="Arsalan Sandbox">Arsalan Sandbox</option>
                    <option value="Arsalan X2" selected>Arsalan X2</option>
                    <option value="Arsalan Reversal">Arsalan Reversal</option>
                </select>
                <div class="toggle-group" style="margin-top:10px;">
                    <div style="font-size:0.7rem; color:#64748b; font-weight:700; margin-bottom:8px; text-transform:uppercase;">Strategy Logic (Pine)</div>
                    <label class="toggle-item"><input type="checkbox" id="use-fresh-zone" checked> Use Fresh Zone Only</label>
                    <label class="toggle-item"><input type="checkbox" id="fib-exit" checked> SL Below Fib</label>
                    <label class="toggle-item"><input type="checkbox" id="zone-exit" checked> Zone Exit</label>
                    <label class="toggle-item"><input type="checkbox" id="atr-exit" checked> Atr Exit</label>
                </div>
            </div>
            <div style="margin-bottom:20px;"><label class="setting-item">TIMEFRAME</label><select id="timeframe-select" class="nav-btn" style="width:100%;"><option value="1m">1m</option><option value="3m" selected>3m</option><option value="5m">5m</option><option value="15m">15m</option></select></div>
            <div style="margin-bottom:20px;"><label class="setting-item">DATE RANGE</label><div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;"><input type="date" id="start-date" class="nav-btn" value="2026-04-01"><input type="date" id="end-date" class="nav-btn" value="2026-04-30"></div></div>
            <div style="margin-bottom:30px;"><label class="setting-item">MARKET TIME</label><div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;"><input type="time" id="start-time" class="nav-btn" value="09:15"><input type="time" id="end-time" class="nav-btn" value="15:30"></div></div>
            <div style="margin-bottom:20px;">
                <label class="setting-item">REVERSAL SETTINGS</label>
                <div style="display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" id="hawa-me-zone-toggle" style="width:20px; height:20px; cursor:pointer;">
                    <span style="font-size:0.8rem; color:#64748b; font-weight:600;">Hawa me Zone (Floating)</span>
                </div>
            </div>
            <button class="lab-btn lab-btn-primary" id="run-btn">Run Strategy</button>
        </div>
        <div class="sidebar-toggle-btn" id="sidebar-toggle-btn">◀</div>

```
