# HTML - Feature Modals A (ohlc, target-tracker)
Consolidated code context for AI assistants.


## File: `templates/modals-ohlc.html`
```html
<!-- ── ADD COLUMN MODAL ────────────────────── -->
<div class="modal-overlay" id="add-col-modal">
  <div class="modal-content" style="width:360px">
    <div class="modal-header">
      <span>Add New Column</span>
      <button class="close-btn" id="add-col-close">&#10005;</button>
    </div>
    <div style="padding:16px">
      <input type="text" id="new-col-name" class="col-name-input" placeholder="Column name (e.g. Setup, Notes, RR)" />
    </div>
    <div class="upload-actions">
      <button class="btn btn-outline" id="add-col-cancel">Cancel</button>
      <button class="btn btn-primary" id="add-col-confirm">Add Column</button>
    </div>
  </div>
</div>

<!-- ── OHLC MANAGER MODAL ─────────────────────── -->
<div class="modal-overlay" id="ohlc-mgr-modal">
  <div class="modal-content" style="width:680px;max-width:95vw;max-height:90vh;display:flex;flex-direction:column;">
    <div class="modal-header">
      <span>&#128200; OHLC Data Manager</span>
      <button class="close-btn" id="ohlc-mgr-close">&#10005;</button>
    </div>

    <div style="flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:12px;">

      <!-- ── Dhan Credentials ── -->
      <div class="ohlc-mgr-section">
        <div class="ohlc-mgr-section-title">Dhan Credentials</div>
        <div id="ohlc-cred-status" class="ohlc-cred-status">
          <span style="opacity:0.4">Loading...</span>
        </div>
        <div id="ohlc-cred-form" class="ohlc-cred-form" style="display:none">
          <input type="text" id="ohlc-client-id" class="col-name-input" placeholder="Client ID" autocomplete="off" />
          <input type="password" id="ohlc-access-token" class="col-name-input" placeholder="Access Token" autocomplete="off" />
          <div style="display:flex;gap:8px;">
            <button class="btn btn-outline" id="ohlc-cred-cancel">Cancel</button>
            <button class="btn btn-primary" id="ohlc-cred-save">Save Credentials</button>
          </div>
        </div>
      </div>

      <!-- ── Tradebook CSV Upload ── -->
      <div class="ohlc-mgr-section">
        <div class="ohlc-mgr-section-title">
          Tradebook Import
          <span class="ohlc-mgr-hint">Upload Zerodha tradebook CSV for accurate expiry dates</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <input type="file" id="ohlc-tradebook-input" accept=".csv,text/csv" style="display:none" />
          <button class="btn btn-outline" id="ohlc-tradebook-btn">Choose File</button>
          <span id="ohlc-tradebook-fname" style="font-size:0.8rem;opacity:0.5;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">No file chosen</span>
          <button class="btn btn-primary" id="ohlc-tradebook-import" disabled>Import</button>
        </div>
      </div>

      <!-- ── Instruments Status Table ── -->
      <div class="ohlc-mgr-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px;flex-wrap:wrap;">
          <div class="ohlc-mgr-section-title" style="margin:0">Instruments</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-outline btn-sm" id="ohlc-scrip-dl-btn">Download Scrip Master</button>
            <button class="btn btn-outline btn-sm" id="ohlc-status-refresh-btn">Refresh</button>
          </div>
        </div>
        <div id="ohlc-instruments-wrap" style="overflow-x:auto;max-height:260px;overflow-y:auto;">
          <table class="ohlc-instruments-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th style="text-align:center">Dates</th>
                <th style="text-align:center">Mapped</th>
                <th style="text-align:center">OHLC</th>
                <th style="text-align:center">Status</th>
              </tr>
            </thead>
            <tbody id="ohlc-instruments-tbody">
              <tr><td colspan="5" style="text-align:center;opacity:0.4;padding:14px;">
                Click "Refresh" to load instruments
              </td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── Sync Log ── -->
      <div class="ohlc-mgr-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div class="ohlc-mgr-section-title" style="margin:0">Sync Log</div>
          <button class="btn btn-outline btn-sm" id="ohlc-log-clear-btn">Clear</button>
        </div>
        <div id="ohlc-sync-log" class="ohlc-sync-log"></div>
      </div>

    </div><!-- /scroll area -->

    <div class="modal-footer">
      <button class="btn btn-outline" id="ohlc-mgr-close-btn">Close</button>
      <button class="btn btn-primary" id="ohlc-sync-all-btn">&#9654; Sync All OHLC</button>
    </div>
  </div>
</div>

<!-- ── EDIT COLUMN MODAL ────────────────────── -->
<div class="modal-overlay" id="edit-col-modal">
  <div class="modal-content" style="width:380px">
    <div class="modal-header">
      <span>Edit Column Name</span>
      <button class="close-btn" id="edit-col-close">&#10005;</button>
    </div>
    <div style="padding:16px;display:flex;flex-direction:column;gap:10px">
      <select id="edit-col-select" class="select-box"></select>
      <input type="text" id="edit-col-name" class="col-name-input" placeholder="New column name" />
    </div>
    <div class="upload-actions">
      <button class="btn btn-outline" id="edit-col-delete">Delete Column</button>
      <button class="btn btn-outline" id="edit-col-cancel">Cancel</button>
      <button class="btn btn-primary" id="edit-col-confirm">Save Name</button>
    </div>
  </div>
</div>

```

## File: `templates/modals-target-tracker.html`
```html
<!-- ── TARGET TRACKER MODAL ────────────────────── -->
<style>
  .tt-trade-row { transition: background 0.1s; border-radius: 4px; padding: 2px 4px; }
  .tt-trade-row:hover { background: rgba(255,255,255,0.04); }
</style>
<div class="modal-overlay" id="target-tracker-modal" style="z-index: 2000;">
  <div class="modal-content" id="tt-modal-content" style="width:100%; max-width:450px;">
    <div class="modal-header">
      <div style="display:flex; align-items:center; gap:12px;">
        <span style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:1.2rem;">🎯</span> Target Tracker
        </span>
        <div
          style="display:flex; align-items:center; gap:4px; background:var(--bg3); border-radius:12px; padding:2px; border:1px solid var(--border);">
          <button class="btn btn-outline" id="tt-prev-day-btn"
            style="padding:2px 8px; font-size:0.8rem; border:none; background:transparent;">&#8592;</button>
          <input type="date" id="tt-date-picker"
            style="font-size:0.75rem; color:var(--text); background:transparent; border:none; outline:none; text-align:center; cursor:pointer; font-family:inherit;" />
          <button class="btn btn-outline" id="tt-next-day-btn"
            style="padding:2px 8px; font-size:0.8rem; border:none; background:transparent;">&#8594;</button>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="btn btn-outline" id="tt-import-zerodha-btn"
          style="font-size:0.7rem; padding:4px 10px; height:28px; display:flex; align-items:center; gap:5px; border-radius:6px; color:var(--blue); border-color:var(--blue);">
          <span style="font-size:0.9rem;">&#8679;</span> Import Today
        </button>
        <button class="close-btn" id="tt-close-btn" style="margin-left:4px;">&#10005;</button>
      </div>
    </div>

    <!-- FIXED TABS AREA -->
    <div style="padding: 0 16px; background: var(--bg1); position: sticky; top: 0; z-index: 10;">
      <div style="display:flex; border-bottom:1px solid var(--border); gap:8px;">
        <button id="tt-tab-numbers"
          style="flex:1; padding:10px; background:transparent; border:none; border-bottom:3px solid var(--blue); color:var(--text); cursor:pointer; font-weight:bold; font-size:0.9rem; transition:all 0.2s ease;">Numbers</button>
        <button id="tt-tab-daily"
          style="flex:1; padding:10px; background:transparent; border:none; border-bottom:3px solid transparent; color:var(--text2); cursor:pointer; font-weight:bold; font-size:0.9rem; transition:all 0.2s ease;">Daily
          Target</button>
        <button id="tt-tab-weekly"
          style="flex:1; padding:10px; background:transparent; border:none; border-bottom:3px solid transparent; color:var(--text2); cursor:pointer; font-weight:bold; font-size:0.9rem; transition:all 0.2s ease;">Weekly
          Target</button>
        <button id="tt-tab-monthly"
          style="flex:1; padding:10px; background:transparent; border:none; border-bottom:3px solid transparent; color:var(--text2); cursor:pointer; font-weight:bold; font-size:0.9rem; transition:all 0.2s ease;">Monthly
          Target</button>
      </div>
    </div>

    <!-- SCROLLABLE CONTENT AREA -->
    <div style="padding: 16px; max-height: calc(85vh - 120px); overflow-y:auto; overflow-x:hidden;"
      class="scrollbar-custom">

      <!-- NUMBERS VIEW -->
      <div id="tt-numbers-view" style="display:flex; flex-direction:column; gap:20px;">
        <div style="display:flex; gap:24px; align-items:flex-start;">
          <!-- Left Part: Inputs -->
          <div style="flex: 0 0 320px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom: 20px;">
              <!-- Hidden inputs for legacy background save compatibility -->
              <input type="hidden" id="tt-goal-inp" value="5000" />
              <input type="hidden" id="tt-max-loss-inp" value="6000" />

              <!-- Row 1 -->
              <div>
                <label style="font-size:0.8rem; color:var(--text2); display:block; margin-bottom:4px;">Max Points
                  Capable</label>
                <input type="number" id="tt-max-pts-inp" class="col-name-input" value="30" />
              </div>
              <div>
                <label style="font-size:0.8rem; color:var(--text2); display:block; margin-bottom:4px;">Max Lot
                  Mult</label>
                <input type="number" id="tt-max-mult-inp" class="col-name-input" value="3" />
              </div>

              <!-- Row 2 -->
              <div>
                <label style="font-size:0.8rem; color:var(--text2); display:block; margin-bottom:4px;">Lot
                  Size</label>
                <input type="number" id="tt-lot-inp" class="col-name-input" value="65" />
              </div>
              <div>
                <label style="font-size:0.8rem; color:var(--text2); display:block; margin-bottom:4px;">Avg. Daily
                  Trades</label>
                <input type="number" id="tt-avg-trades-inp" class="col-name-input" value="3" />
              </div>

              <!-- Row 3 -->
              <div>
                <label style="font-size:0.8rem; color:var(--text2); display:block; margin-bottom:4px;">Win Days <span
                    id="tt-win-pct-label" style="font-size:0.7rem; color:var(--green); opacity:0.8;">(0%)</span></label>
                <input type="number" id="tt-exp-win-inp" class="col-name-input" value="15" />
              </div>
              <div>
                <label style="font-size:0.8rem; color:var(--text2); display:block; margin-bottom:4px;">Loss Days <span
                    style="font-size:0.65rem; color:var(--text2); opacity:0.7;">(auto)</span></label>
                <div id="tt-exp-loss-display"
                  style="padding:10px; background:var(--bg3); border:1px solid var(--border); border-radius:8px; font-size:1rem; font-weight:bold; color:var(--red); min-height:40px; display:flex; align-items:center; justify-content:center; box-sizing:border-box;">
                  0</div>
              </div>

              <!-- Row 4 -->
              <div style="grid-column: span 2;">
                <label style="font-size:0.8rem; color:var(--text2); display:block; margin-bottom:4px;">Live Trading
                  Days</label>
                <div id="tt-live-trading-days"
                  style="padding:10px; background:var(--bg3); border:1px solid var(--border); border-radius:8px; font-size:1rem; font-weight:bold; color:var(--blue); min-height:40px; display:flex; align-items:center; justify-content:center; box-sizing:border-box;">
                  0</div>
              </div>
            </div>

            <button id="tt-save-btn"
              style="width:100%; padding:12px; background:var(--green); color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-size:0.95rem; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.2s;">
              <span>💾</span> Save Tracker Settings
            </button>
          </div>

          <!-- Right Part: Reality Check Table -->
          <div style="flex: 1;">
            <div
              style="font-size:1.1rem; font-weight:bold; margin-bottom:16px; color:var(--text); display:flex; align-items:center; gap:8px;">
              <span>📊</span> Monthly Math Reality Check
            </div>
            <div
              style="background:var(--bg2); border:1px solid var(--border); border-radius:12px; padding:20px; box-shadow:0 4px 20px rgba(0,0,0,0.2); overflow-x:auto;">
              <table
                style="width:100%; border-collapse:collapse; font-size:1rem; font-family: 'Outfit', 'Inter', sans-serif;">
                <thead>
                  <tr
                    style="color:var(--text2); font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid var(--border);">
                    <th style="padding-bottom:12px; text-align:left;">Row</th>
                    <th style="padding-bottom:12px; text-align:center;">Days</th>
                    <th style="padding-bottom:12px; text-align:center;">Lot</th>
                    <th style="padding-bottom:12px; text-align:center;">Mult</th>
                    <th style="padding-bottom:12px; text-align:center;">Pt</th>
                    <th style="padding-bottom:12px; text-align:center;">Daily</th>
                    <th style="padding-bottom:12px; text-align:right;">Outcome</th>
                  </tr>
                </thead>
                <tbody style="font-family:monospace; font-size:1.1rem;">
                  <tr style="color:var(--green,#2ecc71);">
                    <td style="padding:16px 0; text-align:left; font-weight:bold;">+ve</td>
                    <td id="tmath-win-d" style="padding:16px 0; text-align:center;">14</td>
                    <td id="tmath-lot" style="padding:16px 0; text-align:center;">65</td>
                    <td id="tmath-mult" style="padding:16px 0; text-align:center;">3</td>
                    <td id="tmath-pt" style="padding:16px 0; text-align:center;">30</td>
                    <td id="tmath-win-daily" style="padding:16px 0; text-align:center; color:var(--text2);">₹ 5,850
                    </td>
                    <td id="tmath-win-tot" style="padding:16px 0; text-align:right; font-weight:bold;">₹ 81,900</td>
                  </tr>
                  <tr style="color:var(--red,#e74c3c);">
                    <td style="padding:16px 0; text-align:left; font-weight:bold;">-ve</td>
                    <td id="tmath-lose-d" style="padding:16px 0; text-align:center;">5</td>
                    <td id="tmath-lot-l" style="padding:16px 0; text-align:center;">65</td>
                    <td id="tmath-mult-l" style="padding:16px 0; text-align:center;">3</td>
                    <td id="tmath-pt-l" style="padding:16px 0; text-align:center;">30</td>
                    <td id="tmath-lose-daily" style="padding:16px 0; text-align:center; color:var(--text2);">₹ 6,000
                    </td>
                    <td id="tmath-lose-tot" style="padding:16px 0; text-align:right; font-weight:bold;">₹ 30,000</td>
                  </tr>
                </tbody>
                <tfoot style="border-top:2px solid var(--border);">
                  <tr style="color:var(--text);">
                    <td colspan="6" style="padding:16px 0 6px; text-align:left; font-weight:bold; font-size:1rem;">
                      Monthly Est. Target (Gross):</td>
                    <td id="tmath-net"
                      style="padding:16px 0 6px; text-align:right; font-weight:bold; font-size:1rem; color:var(--blue);">
                      ₹ 0</td>
                  </tr>
                  <tr style="color:var(--red,#e74c3c);">
                    <td colspan="6" style="padding:4px 0; text-align:left; font-size:0.95rem;">Est. Taxes & Charges
                      (Tax):</td>
                    <td id="tmath-est-tax"
                      style="padding:4px 0; text-align:right; font-weight:bold; font-size:0.95rem;">-
                      ₹ 0</td>
                  </tr>
                  <tr style="color:var(--green,#2ecc71); border-top:1px solid rgba(255,255,255,0.1);">
                    <td colspan="6" style="padding:12px 0; text-align:left; font-weight:bold; font-size:1.3rem;">Net
                      Monthly Income (Net):</td>
                    <td id="tmath-net-income"
                      style="padding:12px 0; text-align:right; font-weight:bold; font-size:1.3rem;">₹ 0</td>
                  </tr>
                  <tr style="color:var(--text2); font-style:italic;">
                    <td colspan="5"
                      style="padding:10px 0; text-align:left; font-size:0.9rem; border-top:1px dashed var(--border);">
                      Actual Current (Net):</td>
                    <td id="tmath-actual-avg"
                      style="padding:10px 0; text-align:right; font-weight:bold; font-size:1rem; color:var(--text);">₹
                      0
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- Safety Parameters -->
            <div
              style="margin-top:16px; background:rgba(231,76,60,0.06); border:1px solid rgba(231,76,60,0.25); border-radius:10px; padding:14px 16px;">
              <div
                style="font-size:0.7rem; font-weight:bold; color:rgba(231,76,60,0.8); text-transform:uppercase; letter-spacing:0.8px; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
                <span>🛡️</span> Safety Scenario (Worst-Case)
              </div>
              <div style="display:flex; flex-direction:column; gap:6px; font-size:0.82rem;">
                <div
                  style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px dashed rgba(231,76,60,0.2);">
                  <span style="color:var(--text2);">① 1 loss day = 2× daily target loss</span>
                  <span id="tsafe-double-loss" style="font-weight:bold; color:var(--red);">- ₹ 0</span>
                </div>
                <div
                  style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px dashed rgba(231,76,60,0.2);">
                  <span style="color:var(--text2);">② +2 extra loss days</span>
                  <span id="tsafe-extra-days" style="font-weight:bold; color:var(--red);">- ₹ 0</span>
                </div>
                <div
                  style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px dashed rgba(231,76,60,0.2);">
                  <span style="color:var(--text2);">③ +2 avg trades/day (higher tax)</span>
                  <span id="tsafe-extra-tax" style="font-weight:bold; color:var(--red);">- ₹ 0</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0 2px;">
                  <span style="font-weight:bold; color:var(--text); font-size:0.9rem;">Safety Net Monthly
                    Income:</span>
                  <span id="tsafe-net" style="font-weight:bold; font-size:1rem; color:var(--red);">₹ 0</span>
                </div>
              </div>
            </div>
          </div>
        </div><!-- end inner row -->

        <!-- Multiplier Target Table -->
        <div>
          <div
            style="font-size:0.85rem; font-weight:bold; color:var(--text2); text-transform:uppercase; letter-spacing:0.8px; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
            <span>📈</span> Multiplier Target Table
          </div>
          <div style="background:var(--bg2); border:1px solid var(--border); border-radius:10px; overflow:hidden;">
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
              <thead>
                <tr
                  style="background:var(--bg3); color:var(--text2); font-size:0.72rem; text-transform:uppercase; letter-spacing:0.7px;">
                  <th style="padding:10px 12px; text-align:center; border-bottom:1px solid var(--border);">Mult</th>
                  <th style="padding:10px 12px; text-align:center; border-bottom:1px solid var(--border);">Pt</th>
                  <th style="padding:10px 12px; text-align:center; border-bottom:1px solid var(--border);">P/D</th>
                  <th id="tt-mult-tdplus-header"
                    style="padding:10px 12px; text-align:center; border-bottom:1px solid var(--border); color:var(--green);">
                    TD+ (15d)</th>
                  <th id="tt-mult-tdminus-header"
                    style="padding:10px 12px; text-align:center; border-bottom:1px solid var(--border); color:var(--red);">
                    TD- (5d)</th>
                  <th
                    style="padding:10px 12px; text-align:center; border-bottom:1px solid var(--border); color:var(--red);">
                    Tax</th>
                  <th style="padding:10px 12px; text-align:center; border-bottom:1px solid var(--border);">Month Net
                  </th>
                  <th
                    style="padding:10px 12px; text-align:center; border-bottom:1px solid var(--border); color:var(--blue);">
                    Target Month</th>
                </tr>
              </thead>
              <tbody id="tt-mult-table-body">
                <!-- rendered by JS -->
              </tbody>
            </table>
          </div>
        </div>

      </div><!-- end tt-numbers-view -->

      <!-- DAILY VIEW -->
      <div id="tt-daily-view" style="display:none; gap:24px; align-items:stretch;">

        <!-- Left Side: Progress & Scenarios -->
        <div style="flex:0 0 340px; display:flex; flex-direction:column; gap:20px;">
          <!-- Current Status & Progress Visualizer -->
          <div>
            <div
              style="font-size:0.9rem; font-weight:bold; margin-bottom:12px; color:var(--text); display:flex; align-items:center; gap:8px;">
              <span>📊</span> Progress Visualizer
            </div>
            <div
              style="background:var(--bg2); border:1px solid var(--border); border-radius:12px; padding:20px; box-shadow:0 4px 15px rgba(0,0,0,0.1);">

              <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px;">
                <div style="font-size:0.8rem; color:var(--text2); display:flex; flex-direction:column; gap:4px;">
                  <span>Today's Current P/L:</span>
                  <span id="tt-achieved" style="font-weight:bold; font-size:1.4rem; color:var(--text);">₹ 0</span>
                  <div style="font-size:0.7rem; color:var(--text2); display:flex; align-items:center; gap:4px; margin-top:2px; opacity:0.8;">
                    GROSS: <span id="tt-gross-amt" style="font-weight:bold; color:var(--text2);">₹ 0</span>
                  </div>
                </div>
                <div
                  style="font-size:0.8rem; color:var(--text2); text-align:right; display:flex; flex-direction:column; gap:4px;">
                  <span>Total Target:</span>
                  <span id="tt-daily-target-display" style="font-weight:bold; font-size:1.2rem; color:var(--blue);">₹
                    0</span>
                </div>
              </div>

              <div id="tt-loss-warning"
                style="display:none; background:rgba(231,76,60,0.1); border:1px solid rgba(231,76,60,0.3); border-radius:8px; padding:12px; margin-bottom:16px; text-align:center; color:#ff6b6b; font-size:0.85rem; font-weight:bold;">
                ⚠️ Max Loss Breached! Lost <span id="tt-loss-pct">0</span>%
              </div>

              <!-- Pill Progress Bar -->
              <div
                style="width:100%; height:28px; background:var(--bg3); border-radius:14px; overflow:hidden; position:relative; margin-bottom:14px; border:1px solid rgba(255,255,255,0.05); box-shadow:inset 0 2px 4px rgba(0,0,0,0.3);">
                <div id="tt-progress-bar"
                  style="height:100%; width:0%; border-radius:14px; transition:width 0.6s cubic-bezier(0.4, 0, 0.2, 1), background 0.4s ease;">
                </div>
                <div id="tt-progress-text"
                  style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:bold; pointer-events:none; color:#fff; text-shadow:1px 1px 3px rgba(0,0,0,0.8);">
                  0%</div>
              </div>

              <div
                style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text2); font-weight:500;">
                <span id="tt-progress-pct" style="opacity:0.8;">0% Achieved</span>
                <span><span id="tt-remaining-label">Remaining:</span> <span id="tt-remaining"
                    style="color:var(--red,#e74c3c); font-weight:bold;">₹ 0.00</span></span>
              </div>

              <!-- Total Tax row -->
              <div
                style="margin-top:12px; padding-top:10px; border-top:1px dashed var(--border); display:flex; justify-content:space-between; align-items:center; font-size:0.8rem;">
                <span style="color:var(--text2);">Today's Actual Tax & Charges</span>
                <span id="tt-today-tax" style="font-weight:bold; color:var(--red);">- ₹ 0</span>
              </div>
            </div>
          </div>

          <!-- Scenarios Table -->
          <div id="tt-scenarios-wrap">
            <div
              style="font-size:0.9rem; margin-bottom:12px; font-weight:bold; color:var(--text); display:flex; align-items:center; gap:8px;">
              <span>🎯</span> Target Action Scenarios <span
                style="font-size:0.7rem; color:var(--text2); font-weight:normal; opacity:0.6;">(to capture
                remaining)</span>
            </div>
            <div
              style="background:var(--bg2); border:1px solid var(--border); border-radius:12px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.1);">
              <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                <thead>
                  <tr
                    style="background:var(--bg3); color:var(--text2); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.5px;">
                    <th style="padding:10px 8px; border-bottom:1px solid var(--border); font-weight:bold;">Lot Mult
                    </th>
                    <th style="padding:10px 8px; border-bottom:1px solid var(--border); font-weight:bold;">Tot Qty
                    </th>
                    <th style="padding:10px 8px; border-bottom:1px solid var(--border); font-weight:bold;">Points rqrd
                    </th>
                    <th style="padding:10px 8px; border-bottom:1px solid var(--border); font-weight:bold;">Trades Req
                    </th>
                  </tr>
                </thead>
                <tbody id="tt-scenarios-body">
                  <!-- Rendered by JS -->
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {% include "modals-target-tracker-b.html" %}

```
