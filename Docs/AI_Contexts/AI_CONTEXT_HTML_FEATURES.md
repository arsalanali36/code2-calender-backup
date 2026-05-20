# HTML - Feature Pages
Consolidated code context for AI assistants.


## File: `templates/whatif.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>What If — Trading Journal</title>
  <link rel="stylesheet" href="/static/css/style-base.css?v={{ cache_bust }}"/>
  <link rel="stylesheet" href="/static/css/style-whatif.css?v={{ cache_bust }}"/>
</head>
<body>
<div class="wi-wrap">

  <!-- Header -->
  <div class="wi-header">
    <button class="wi-back" onclick="window.location='/'">&#8592; Back</button>
    <h1>&#128200; What If Analysis</h1>
    <span class="hint" style="margin-left:auto">Simulate fixed SL/Target rules on your real trades</span>
  </div>

  <!-- ── 1. Dhan API Config ────────────────────────────────── -->
  <div class="wi-card" id="card-config">
    <div class="wi-card-head" onclick="toggleCard('card-config')">
      <span class="wi-card-title">&#9881; Dhan API Credentials</span>
      <span class="wi-card-arrow">&#9660;</span>
    </div>
    <div class="wi-card-body">
      <div class="wi-row">
        <div class="wi-field">
          <label>Client ID</label>
          <input id="dhan-client-id" type="text" placeholder="Your Dhan client ID"/>
        </div>
        <div class="wi-field">
          <label>Access Token</label>
          <input id="dhan-token" type="password" placeholder="Paste access token"/>
        </div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;">
        <button class="btn-wi btn-primary" onclick="saveDhanConfig()">Save Credentials</button>
        <span id="cfg-status" class="hint"></span>
      </div>
      <p class="hint" style="margin-top:10px">
        Credentials are stored locally on the server (data/dhan_config.json) and never sent anywhere else.
        Get your access token from <strong>Dhan → API → Access Token</strong>.
      </p>
    </div>
  </div>

  <!-- ── 2. Instrument Mapper ──────────────────────────────── -->
  <div class="wi-card open" id="card-mapper">
    <div class="wi-card-head" onclick="toggleCard('card-mapper')">
      <span class="wi-card-title">&#128279; Instrument Mapper <span id="mapper-count" class="badge badge-gray" style="margin-left:4px">0 mapped</span></span>
      <span class="wi-card-arrow">&#9660;</span>
    </div>
    <div class="wi-card-body">
      <p class="hint" style="margin-bottom:14px;">
        Filter by date range, then click <strong>Auto Map</strong> to find Security IDs for
        instruments traded in that period. High-confidence matches are saved instantly.
        Use <strong>Fix</strong> for uncertain ones.
      </p>

      <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px;">
        <div class="wi-field" style="max-width:150px;">
          <label>From Date</label>
          <input id="map-date-from" type="date"/>
        </div>
        <div class="wi-field" style="max-width:150px;">
          <label>To Date</label>
          <input id="map-date-to" type="date"/>
        </div>
        <button class="btn-wi btn-primary" onclick="autoMapAll()" id="btn-auto-map">
          &#9889; Auto Map
        </button>
        <button class="btn-wi btn-outline" onclick="clearMapDates()" title="Clear date filter — map all trades">
          &#10005; Clear filter
        </button>
        <span id="auto-map-status" class="hint"></span>
      </div>

      <!-- Auto-map results (shown after running) -->
      <div id="auto-map-results"></div>

      <hr class="divider"/>

      <!-- Saved mappings (always visible) -->
      <div id="saved-mappings-wrap"></div>
    </div>
  </div>

  <!-- ── 3. Strategy Controls ──────────────────────────────── -->
  <div class="wi-card open" id="card-strategy">
    <div class="wi-card-head" onclick="toggleCard('card-strategy')">
      <span class="wi-card-title">&#9881; Strategy & Filters</span>
      <span class="wi-card-arrow">&#9660;</span>
    </div>
    <div class="wi-card-body">
      <div class="wi-row">
        <div class="wi-field">
          <label>Date From</label>
          <input id="date-from" type="date"/>
        </div>
        <div class="wi-field">
          <label>Date To</label>
          <input id="date-to" type="date"/>
        </div>
        <div class="wi-field" style="max-width:140px;">
          <label>Target (pts)</label>
          <input id="target-pts" type="number" value="30" min="1" step="0.5"/>
        </div>
        <div class="wi-field" style="max-width:140px;">
          <label>SL (pts)</label>
          <input id="sl-pts" type="number" value="15" min="0.5" step="0.5"/>
        </div>
        <div class="wi-field" style="max-width:160px;">
          <label>Trail to BE trigger (pts) <span class="hint" style="display:inline">(0 = off)</span></label>
          <input id="trail-pts" type="number" value="0" min="0" step="0.5"/>
        </div>
        <div class="wi-field" style="max-width:130px;">
          <label>Candle timeframe</label>
          <select id="timeframe">
            <option value="1">1 min</option>
            <option value="2">2 min</option>
            <option value="3">3 min</option>
            <option value="4">4 min</option>
            <option value="5">5 min</option>
          </select>
        </div>
        <div class="wi-field" style="max-width:130px;">
          <label>Direction override</label>
          <select id="direction-override">
            <option value="">Auto (from trade)</option>
            <option value="short">Force SHORT</option>
            <option value="long">Force LONG</option>
          </select>
        </div>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:4px;">
        <button class="btn-wi btn-outline" onclick="checkOhlcStatus()">
          &#128270; Check OHLC Status
        </button>
        <button class="btn-wi btn-outline" onclick="fetchAllOhlc()" id="btn-fetch-ohlc">
          &#8659; Fetch / Complete OHLC
        </button>
        <button class="btn-wi btn-primary" onclick="runSimulation()" id="btn-run">
          &#9654; Run Simulation
        </button>
        <span id="run-status" class="hint"></span>
      </div>
    </div>
  </div>

  <!-- ── 3b. Quick Chart Lookup ───────────────────────────── -->
  <div class="wi-card open" id="card-quick-chart">
    <div class="wi-card-head" onclick="toggleCard('card-quick-chart')">
      <span class="wi-card-title">&#128269; Quick Chart Lookup</span>
      <span class="wi-card-arrow">&#9660;</span>
    </div>
    <div class="wi-card-body">
      <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
        <div class="wi-field" style="flex:1;min-width:200px;max-width:380px;">
          <label>Symbol</label>
          <input id="qc-symbol" type="text" placeholder="e.g. NIFTY2632423650CE"
                 style="font-family:monospace;text-transform:uppercase;"
                 oninput="this.value=this.value.toUpperCase()"
                 onkeydown="if(event.key==='Enter')quickChartOpen()"/>
        </div>
        <div class="wi-field" style="max-width:160px;">
          <label>Date</label>
          <input id="qc-date" type="date" onkeydown="if(event.key==='Enter')quickChartOpen()"/>
        </div>
        <button class="btn-wi btn-primary" onclick="quickChartOpen()" id="btn-qc-open">
          &#9654; Open Chart
        </button>
        <span id="qc-status" class="hint"></span>
      </div>
    </div>
  </div>

  <!-- ── 4. OHLC Status ────────────────────────────────────── -->
  <div id="ohlc-status-section" class="hidden">
    <div class="wi-card open" id="card-ohlc">
      <div class="wi-card-head" onclick="toggleCard('card-ohlc')">
        <span class="wi-card-title">&#128190; OHLC Cache Status</span>
        <span class="wi-card-arrow">&#9660;</span>
      </div>
      <div class="wi-card-body">
        <div id="ohlc-status-grid" class="ohlc-grid"></div>
      </div>
    </div>
  </div>

  <!-- ── 5. Summary Cards ──────────────────────────────────── -->
  <div id="summary-section" class="hidden">
    <div class="wi-cards" id="wi-summary-cards"></div>
  </div>

  <!-- ── 6. Results Table ──────────────────────────────────── -->
  <div id="results-section" class="hidden">
    <div class="wi-card open" id="card-results">
      <div class="wi-card-head" onclick="toggleCard('card-results')">
        <span class="wi-card-title">&#128202; Trade Results</span>
        <span class="wi-card-arrow">&#9660;</span>
      </div>
      <div class="wi-card-body" style="padding:0;">
        <div class="wi-table-wrap">
          <table class="wi-table" id="wi-results-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>T#</th>
                <th>Time</th>
                <th>Exit&nbsp;Time</th>
                <th>Instrument</th>
                <th>Dir</th>
                <th>Entry</th>
                <th>Exit</th>
                <th>Actual&nbsp;pts</th>
                <th>Actual&nbsp;₹</th>
                <th>Planned&nbsp;pts</th>
                <th>Planned&nbsp;₹</th>
                <th>Missed&nbsp;pts</th>
                <th>MFE</th>
                <th>MAE</th>
                <th>Eff&nbsp;%</th>
                <th>Exit</th>
                <th>Trail</th>
              </tr>
            </thead>
            <tbody id="wi-results-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

</div><!-- /wi-wrap -->

<!-- OHLC Chart Modal -->
<div id="ohlc-chart-modal" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.75);align-items:center;justify-content:center;">
  <div style="background:#131722;border:1px solid #2a2a3e;border-radius:10px;padding:16px;width:min(960px,96vw);">
    <!-- Row 1: title + TF + close -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:10px;">
      <span id="ohlc-chart-title" style="font-weight:600;color:#ccc;font-size:13px;font-family:monospace;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
        <label style="color:#888;font-size:11px;white-space:nowrap;cursor:pointer;" title="Lock price-to-bar ratio">
          <input type="checkbox" id="lock-ratio-chk" onchange="setLockRatio(this.checked)" style="vertical-align:middle;cursor:pointer;"/>
          Lock Y
          <input id="lock-ratio-val" type="number" value="6" step="0.5" min="0.1"
                 style="width:44px;background:#1e2130;border:1px solid #2a2a3e;color:#fff;padding:1px 4px;border-radius:3px;font-size:11px;margin-left:2px;"
                 onchange="if(document.getElementById('lock-ratio-chk').checked) applyLockRatio()"/>
        </label>
      </div>
      <div id="ohlc-tf-btns" style="display:flex;gap:4px;flex-shrink:0;">
        <button onclick="setChartTf(1)"  class="tf-btn" data-tf="1">1m</button>
        <button onclick="setChartTf(3)"  class="tf-btn" data-tf="3">3m</button>
        <button onclick="setChartTf(5)"  class="tf-btn" data-tf="5">5m</button>
        <button onclick="setChartTf(15)" class="tf-btn" data-tf="15">15m</button>
      </div>
      <button onclick="closeOhlcChart()" style="background:none;border:none;color:#aaa;font-size:20px;cursor:pointer;line-height:1;flex-shrink:0;">&#x2715;</button>
    </div>
    <!-- Row 2: SL / Target inputs (hidden for quick lookup) -->
    <div id="ohlc-sim-bar" style="display:none;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;">
      <span style="color:#888;font-size:12px;">Re-sim:</span>
      <label style="color:#aaa;font-size:12px;">SL <input id="chart-sl"  type="number" step="0.5" style="width:60px;background:#1e2130;border:1px solid #2a2a3e;color:#fff;padding:2px 5px;border-radius:3px;font-size:12px;"/> pts</label>
      <label style="color:#aaa;font-size:12px;">Target <input id="chart-tgt" type="number" step="0.5" style="width:60px;background:#1e2130;border:1px solid #2a2a3e;color:#fff;padding:2px 5px;border-radius:3px;font-size:12px;"/> pts</label>
      <button class="btn-wi btn-outline" style="padding:3px 10px;font-size:12px;" onclick="reSimChart()">&#9654; Re-run</button>
      <span style="color:#888;font-size:11px;margin-left:4px;">← → keys = prev/next trade</span>
    </div>
    <style>
      .tf-btn{background:#1e2130;border:1px solid #2a2a3e;color:#aaa;padding:3px 9px;border-radius:4px;cursor:pointer;font-size:12px;}
      .tf-btn:hover{background:#2a2a3e;color:#fff;}
      .tf-btn.tf-active{background:#2962ff;border-color:#2962ff;color:#fff;}
    </style>
    <div id="ohlc-chart-container" style="width:100%;height:440px;"></div>
  </div>
</div>

<script src="https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js"></script>
<script src="/static/js/whatif-ui.js?v={{ cache_bust }}"></script>
<script src="/static/js/whatif-ui-b.js?v={{ cache_bust }}"></script>
</body>
</html>

```

## File: `templates/visual_dashboard.html`
```html
    <!-- ── VISUAL DASHBOARD ─────────────────── -->
    <section class="section visual-dashboard-section" style="margin-top: 20px;">
      <div class="section-header dashboard-header" style="flex-wrap: wrap; gap: 15px; border-bottom: 1px solid var(--border2, #30363d); padding-bottom: 0;">
        <div class="dashboard-tabs" style="display: flex; align-items: flex-end; gap: 5px;">
          <div class="main-dash-tab active" data-tab="visual" style="padding: 12px 20px; font-size: 1.15rem; font-weight: 700; cursor: pointer; background: var(--surface, #161b22); border: 1px solid var(--border2, #30363d); border-bottom: none; border-radius: 8px 8px 0 0; color: #fff; position: relative; bottom: -1px; z-index: 2;">Performance Analytics (Visual Dashboard)</div>
          <div class="main-dash-tab" data-tab="quick" style="padding: 12px 20px; font-size: 1.15rem; font-weight: 700; cursor: pointer; background: transparent; border: 1px solid transparent; border-bottom: 1px solid var(--border2, #30363d); border-radius: 8px 8px 0 0; color: #8b949e; position: relative; bottom: 0; z-index: 1;">Summary &amp; Quick Stats 📈</div>
          <!-- archived: New ✨ premium_bento tab -->
          <div class="dashboard-subtitle" style="margin: 0 0 12px 10px;">Sample Data</div>
        </div>

        <div class="dashboard-actions" style="margin-bottom: 12px; display: flex; align-items: center;">
          <div id="quick-stats-filters" style="display: none; background:#0d1117; border:1px solid #444; border-radius:12px; padding:3px; margin-right:12px; box-shadow:0 0 20px rgba(0,0,0,0.5);">
            <button class="qs-filter-btn active" data-filter="both" style="background:#58a6ff; border:none; color:#fff; padding:6px 16px; font-size:0.75rem; font-weight:800; cursor:pointer; border-radius:10px; transition:all 0.2s; letter-spacing:0.5px;">BOTH</button>
            <button class="qs-filter-btn" data-filter="gain" style="background:transparent; border:none; color:#8b949e; padding:6px 16px; font-size:0.75rem; font-weight:800; cursor:pointer; border-radius:10px; transition:all 0.2s; letter-spacing:0.5px;">GAIN</button>
            <button class="qs-filter-btn" data-filter="loss" style="background:transparent; border:none; color:#8b949e; padding:6px 16px; font-size:0.75rem; font-weight:800; cursor:pointer; border-radius:10px; transition:all 0.2s; letter-spacing:0.5px;">LOSS</button>
          </div>
          <button class="btn btn-outline" id="vd-stats-btn">Stats &#9881;</button>
        </div>
      </div>

      <div class="visual-dash-wrapper" style="padding: 20px; min-height: 500px;">

        <!-- Charts Grid -->
        <div class="visual-dash-grid" id="vd-charts-grid"
          style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 20px;">

          <!-- Advanced MTM Analytics -->
          <div class="col-span-12" id="adv-mtm-wrapper" style="grid-column: span 6;">
            <div class="adv-mtm-container">
              <div class="adv-mtm-main">
                <div id="adv-mtm-controls-container"></div>
                <div id="adv-mtm-chart-area"></div>
              </div>
              <div class="adv-mtm-heads-panel" id="adv-mtm-heads-panel">
                <!-- Populated by JS -->
              </div>
            </div>
          </div>

          <!-- Daily MTM Curves (Thumbnails) -->
          <div class="dash-card" data-vd-stat="mtm_thumbs" data-vd-default-width="6" style="padding: 15px; min-height: 200px;">
            <div class="dash-label vd-drag-handle"
              style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
              <span style="opacity: 0.5; margin-right: 8px;">⋮⋮</span>
              <span>Daily MTM Curves</span>
              <select class="select-box" style="margin-left:auto; padding: 2px 5px; font-size:12px;"
                onchange="setVdMtmSummaryType(this.value)">
                <option value="curve" selected>Curve</option>
                <option value="bar">Bar</option>
              </select>
              <select class="select-box" style="margin-left:5px; padding: 2px 5px; font-size:12px;"
                onchange="updateVdMtmValueType(this.value)">
                <option value="net">Net</option>
                <option value="gross">Gross</option>
                <option value="pt">Pt</option>
              </select>
              <select class="select-box vd-width-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartWidth('mtm_thumbs', this.value)">
                <option value="2">1/3 Width</option>
                <option value="3">1/2 Width</option>
                <option value="4">2/3 Width</option>
                <option value="6" selected>Full Width</option>
              </select>
            </div>
            <div id="vd-mtm-thumbs-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; max-height: 400px; overflow-y: auto; padding: 5px;">
              <!-- Thumbnails will be injected here -->
            </div>
          </div>

          <!-- Cumulative Area Chart -->
          <div class="dash-card" data-vd-stat="cumulative" data-vd-default-width="6" style="padding: 15px;">
            <div class="dash-label vd-drag-handle"
              style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
              <span style="opacity: 0.5; margin-right: 8px;">⋮⋮</span>
              <span>Cumulative
                Performance</span>

              <select class="select-box" style="margin-left:auto; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartType('cumulative', this.value)">
                <option value="line">Line</option>
                <option value="area">Area</option>
                <option value="bar">Bar</option>

              </select>
            <select class="select-box vd-mode-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;" onchange="updateVdChartMode('cumulative', this.value)">
              <option value="consolidated">Consolidated</option>
              <option value="individual">Individual</option>
            </select>
              <select class="select-box vd-width-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartWidth('cumulative', this.value)">
                <option value="2">1/3 Width</option>
                <option value="3">1/2 Width</option>
                <option value="4">2/3 Width</option>
                <option value="6">Full Width</option>
              </select>
            </div>
            <div id="chart-cumulative" style="min-height: 300px; "></div>
          </div>

          <!-- Daily Net P/L -->
          <div class="dash-card" data-vd-stat="daily" data-vd-default-width="6" style="padding: 15px;   ">
            <div class="dash-label vd-drag-handle"
              style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
              <span style="opacity: 0.5; margin-right: 8px;">⋮⋮</span>
              <span>Daily Net P/L</span>

              <select class="select-box" style="margin-left:auto; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartType('daily', this.value)">
                <option value="line">Line</option>
                <option value="area">Area</option>
                <option value="bar">Bar</option>

              </select>
            <select class="select-box vd-mode-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;" onchange="updateVdChartMode('daily', this.value)">
              <option value="consolidated">Consolidated</option>
              <option value="individual">Individual</option>
            </select>
              <select class="select-box vd-width-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartWidth('daily', this.value)">
                <option value="2">1/3 Width</option>
                <option value="3">1/2 Width</option>
                <option value="4">2/3 Width</option>
                <option value="6">Full Width</option>
              </select>
            </div>
            <div id="chart-daily-pl" style="min-height: 250px; "></div>
            <!-- Drilldown Panel (shown on bar click) -->
            <div id="vd-daily-drilldown" style="display:none; margin-top:12px; border-top:1px solid rgba(255,255,255,0.08); padding-top:12px;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; flex-wrap:wrap; gap:6px;">
                <span id="vd-dd-date-label" style="font-size:0.85rem; font-weight:700; color:#cdd9e5;"></span>
                <div style="display:flex; gap:6px; align-items:center;">
                  <button id="vd-dd-rs-btn" class="vd-dd-toggle active" onclick="setVdDrilldownMode('rs')">₹ RS</button>
                  <button id="vd-dd-pt-btn" class="vd-dd-toggle" onclick="setVdDrilldownMode('pt')">PT</button>
                  <button onclick="document.getElementById('vd-daily-drilldown').style.display='none'" style="background:none;border:none;color:#8b949e;font-size:1rem;cursor:pointer;padding:2px 6px;">✕</button>
                </div>
              </div>
              <div style="display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap;">
                <div id="vd-dd-pie" style="flex:0 0 220px; min-width:180px;"></div>
                <div id="vd-dd-table" style="flex:1; min-width:200px; overflow-x:auto;"></div>
              </div>
            </div>
          </div>

          <!-- Strategy Distribution -->
          <div class="dash-card" data-vd-stat="distribution" data-vd-default-width="3" style="padding: 15px;  ">
            <div class="dash-label vd-drag-handle"
              style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
              <span style="opacity: 0.5; margin-right: 8px;">⋮⋮</span>
              <span>Strategy
                Distribution</span>

              <select class="select-box" style="margin-left:auto; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartType('dist', this.value)">
                <option value="line">Line</option>
                <option value="area">Area</option>
                <option value="bar">Bar</option>

              </select>
            <select class="select-box vd-mode-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;" onchange="updateVdChartMode('distribution', this.value)">
              <option value="consolidated">Consolidated</option>
              <option value="individual">Individual</option>
            </select>
              <select class="select-box vd-width-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartWidth('distribution', this.value)">
                <option value="2">1/3 Width</option>
                <option value="3">1/2 Width</option>
                <option value="4">2/3 Width</option>
                <option value="6">Full Width</option>
              </select>
            </div>
            <div id="chart-strategy-dist" style="min-height: 280px;  ">
            </div>
          </div>

          <!-- Strategy Profitability -->
          <div class="dash-card" data-vd-stat="profitability" data-vd-default-width="3" style="padding: 15px;  ">
            <div class="dash-label vd-drag-handle"
              style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
              <span style="opacity: 0.5; margin-right: 8px;">⋮⋮</span>
              <span>Strategy
                Profitability</span>

              <select class="select-box" style="margin-left:auto; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartType('profit', this.value)">
                <option value="line">Line</option>
                <option value="area">Area</option>
                <option value="bar">Bar</option>

              </select>
            <select class="select-box vd-mode-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;" onchange="updateVdChartMode('profitability', this.value)">
              <option value="consolidated">Consolidated</option>
              <option value="individual">Individual</option>
            </select>
              <select class="select-box vd-width-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartWidth('profitability', this.value)">
                <option value="2">1/3 Width</option>
                <option value="3">1/2 Width</option>
                <option value="4">2/3 Width</option>
                <option value="6">Full Width</option>
              </select>
            </div>
            <div id="chart-strategy-profit" style="min-height: 280px; "></div>
          </div>

          <!-- Long vs Short -->
          <div class="dash-card" data-vd-stat="long_short" data-vd-default-width="6"
            style="padding: 15px;  max-width: 500px; margin: 0 auto; width: 100%;  ">
            <div class="dash-label vd-drag-handle"
              style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
              <span style="opacity: 0.5; margin-right: 8px;">⋮⋮</span>
              <span>Long vs Short
                Performance</span>

              <select class="select-box" style="margin-left:auto; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartType('longShort', this.value)">
                <option value="line">Line</option>
                <option value="area">Area</option>
                <option value="bar">Bar</option>

              </select>
            <select class="select-box vd-mode-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;" onchange="updateVdChartMode('long_short', this.value)">
              <option value="consolidated">Consolidated</option>
              <option value="individual">Individual</option>
            </select>
              <select class="select-box vd-width-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartWidth('long_short', this.value)">
                <option value="2">1/3 Width</option>
                <option value="3">1/2 Width</option>
                <option value="4">2/3 Width</option>
                <option value="6">Full Width</option>
              </select>
            </div>
            <div id="chart-long-short" style="min-height: 250px;  ">
            </div>
          </div>

          <!-- Daily Trade Count & Qty -->
          <div class="dash-card" data-vd-stat="daily_qty" data-vd-default-width="6" style="padding: 15px;   ">
            <div class="dash-label vd-drag-handle"
              style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
              <span style="opacity: 0.5; margin-right: 8px;">⋮⋮</span>
              <span>Daily Trade
                Count & Qty</span>

              <select class="select-box" style="margin-left:auto; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartType('dailyQty', this.value)">
                <option value="line">Line</option>
                <option value="area">Area</option>
                <option value="bar">Bar</option>

              </select>
            <select class="select-box vd-mode-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;" onchange="updateVdChartMode('daily_qty', this.value)">
              <option value="consolidated">Consolidated</option>
              <option value="individual">Individual</option>
            </select>
              <select class="select-box vd-width-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartWidth('daily_qty', this.value)">
                <option value="2">1/3 Width</option>
                <option value="3">1/2 Width</option>
                <option value="4">2/3 Width</option>
                <option value="6">Full Width</option>
              </select>
            </div>
            <div id="chart-daily-qty" style="min-height: 250px; "></div>
          </div>

          <!-- PAT (SUM) -->
          <div class="dash-card" data-vd-stat="pat_sum" data-vd-default-width="6" style="padding: 15px;   ">
            <div class="dash-label vd-drag-handle"
              style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
              <span style="opacity: 0.5; margin-right: 8px;">⋮⋮</span>
              <span>PAT (SUM)</span>

              <select class="select-box" style="margin-left:auto; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartType('patSum', this.value)">
                <option value="line">Line</option>
                <option value="area">Area</option>
                <option value="bar">Bar</option>

              </select>
            <select class="select-box vd-mode-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;" onchange="updateVdChartMode('pat_sum', this.value)">
              <option value="consolidated">Consolidated</option>
              <option value="individual">Individual</option>
            </select>
              <select class="select-box vd-width-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartWidth('pat_sum', this.value)">
                <option value="2">1/3 Width</option>
                <option value="3">1/2 Width</option>
                <option value="4">2/3 Width</option>
                <option value="6">Full Width</option>
              </select>
            </div>
            <div id="chart-pat-sum" style="min-height: 250px; "></div>
          </div>

          <!-- Points Per Trade -->
          <div class="dash-card" data-vd-stat="points_per_trade" data-vd-default-width="6" style="padding: 15px;   ">
            <div class="dash-label vd-drag-handle"
              style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
              <span style="opacity: 0.5; margin-right: 8px;">⋮⋮</span>
              <span>Points - Per
                Trade</span>

              <select class="select-box" style="margin-left:auto; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartType('pointsPerTrade', this.value)">
                <option value="line">Line</option>
                <option value="area">Area</option>
                <option value="bar" selected>Bar</option>

              </select>
            <select class="select-box vd-mode-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;" onchange="updateVdChartMode('points_per_trade', this.value)">
              <option value="consolidated">Consolidated</option>
              <option value="individual">Individual</option>
            </select>
              <select class="select-box vd-width-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartWidth('points_per_trade', this.value)">
                <option value="2">1/3 Width</option>
                <option value="3">1/2 Width</option>
                <option value="4">2/3 Width</option>
                <option value="6">Full Width</option>
              </select>
            </div>
            <div id="chart-points-per-trade" style="min-height: 250px; "></div>
          </div>

          <!-- Points Sum -->
          <div class="dash-card" data-vd-stat="points_sum" data-vd-default-width="6" style="padding: 15px;   ">
            <div class="dash-label vd-drag-handle"
              style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
              <span style="opacity: 0.5; margin-right: 8px;">⋮⋮</span>
              <span>Points - Sum</span>

              <select class="select-box" style="margin-left:auto; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartType('pointsSum', this.value)">
                <option value="line">Line</option>
                <option value="area">Area</option>
                <option value="bar">Bar</option>

              </select>
            <select class="select-box vd-mode-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;" onchange="updateVdChartMode('points_sum', this.value)">
              <option value="consolidated">Consolidated</option>
              <option value="individual">Individual</option>
            </select>
              <select class="select-box vd-width-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartWidth('points_sum', this.value)">
                <option value="2">1/3 Width</option>
                <option value="3">1/2 Width</option>
                <option value="4">2/3 Width</option>
                <option value="6">Full Width</option>
              </select>
            </div>
            <div id="chart-points-sum" style="min-height: 250px; "></div>
          </div>

          <!-- Daily FC -->
          <div class="dash-card" data-vd-stat="daily_fc" data-vd-default-width="6" style="padding: 15px;  ">
            <div class="dash-label vd-drag-handle"
              style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
              <span style="opacity: 0.5; margin-right: 8px;">⋮⋮</span>
              <span>Daily FC</span>

              <select class="select-box" style="margin-left:auto; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartType('dailyFc', this.value)">
                <option value="line">Line</option>
                <option value="area">Area</option>
                <option value="bar">Bar</option>

              </select>
            <select class="select-box vd-mode-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;" onchange="updateVdChartMode('daily_fc', this.value)">
              <option value="consolidated">Consolidated</option>
              <option value="individual">Individual</option>
            </select>
              <select class="select-box vd-width-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartWidth('daily_fc', this.value)">
                <option value="2">1/3 Width</option>
                <option value="3">1/2 Width</option>
                <option value="4">2/3 Width</option>
                <option value="6">Full Width</option>
              </select>
            </div>
            <div id="chart-daily-fc" style="min-height: 250px; "></div>
          </div>

          <!-- Avg Buy Price -->
          <div class="dash-card" data-vd-stat="avg_buy_price" data-vd-default-width="6" style="padding: 15px;  ">
            <div class="dash-label vd-drag-handle"
              style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
              <span style="opacity: 0.5; margin-right: 8px;">⋮⋮</span>
              <span>Avg Buy Price</span>

              <select class="select-box" style="margin-left:auto; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartType('avgBuyPrice', this.value)">
                <option value="line">Line</option>
                <option value="area">Area</option>
                <option value="bar">Bar</option>

              </select>
            <select class="select-box vd-mode-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;" onchange="updateVdChartMode('avg_buy_price', this.value)">
              <option value="consolidated">Consolidated</option>
              <option value="individual">Individual</option>
            </select>
              <select class="select-box vd-width-select" style="margin-left:5px; padding: 2px 5px; font-size:12px;"
                onchange="updateVdChartWidth('avg_buy_price', this.value)">
                <option value="2">1/3 Width</option>
                <option value="3">1/2 Width</option>
                <option value="4">2/3 Width</option>
                <option value="6">Full Width</option>
              </select>
            </div>
            <div id="chart-avg-buy-price" style="min-height: 250px; "></div>
          </div>

        </div>

        {% include "visual-dashboard-b.html" %}

```

## File: `templates/visual-dashboard-b.html`
```html
        <!-- Summary & Quick Stats Content -->
        <div id="quick-stats-tab-content" style="display: none;">
          
          <!-- OVERALL MONTHLY SUMMARY BLOCK -->
          <div style="background:#161b22; border:1px solid #30363d; border-radius:14px; padding:20px; box-shadow:inset 0 0 20px rgba(0,0,0,0.2); margin-bottom:24px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid #30363d; padding-bottom:10px;">
              <span style="font-size:1.1rem; color:#fff; font-weight:700;">Overall Summary <span id="qs-monthly-subtitle" style="font-size:0.85rem; font-weight:normal; color:#8b949e; margin-left:10px;"></span></span>
              <button class="btn btn-outline" id="dashboard-stats-btn" style="padding:4px 10px; font-size:0.8rem; border-color:#30363d;">Stats &#9881;</button>
            </div>
            <!-- Month filter tabs (rendered by JS) -->
            <div id="qs-month-tabs" style="margin-bottom:14px;"></div>
            <div class="dashboard-grid">
        <div class="dash-card" data-stat="overall">
          <div class="dash-label vd-drag-handle"
            style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
            <span style="opacity: 0.5; margin-right: 8px;">::</span>
            <span>Overall P&amp;L</span>

          </div>
          <div class="dash-value" id="dash-overall">₹ 0.00</div>
        </div>
        <div class="dash-card" data-stat="net">
          <div class="dash-label vd-drag-handle"
            style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
            <span style="opacity: 0.5; margin-right: 8px;">::</span>
            <span>Net P&amp;L</span>

          </div>
          <div class="dash-value" id="dash-net">₹ 0.00</div>
        </div>
        <div class="dash-card" data-stat="trades">
          <div class="dash-label vd-drag-handle"
            style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
            <span style="opacity: 0.5; margin-right: 8px;">::</span>
            <span>Total Trades</span>

          </div>
          <div class="dash-value dash-value-muted" id="dash-trades">0</div>
        </div>
        <div class="dash-card" data-stat="charges">
          <div class="dash-label vd-drag-handle"
            style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
            <span style="opacity: 0.5; margin-right: 8px;">::</span>
            <span>Charges</span>

          </div>
          <div class="dash-value dash-value-muted" id="dash-charges">₹ 0.00</div>
        </div>
        <div class="dash-card" data-stat="brokerage">
          <div class="dash-label vd-drag-handle"
            style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
            <span style="opacity: 0.5; margin-right: 8px;">::</span>
            <span>Brokerage</span>

          </div>
          <div class="dash-value dash-value-muted" id="dash-brokerage">₹ 0.00</div>
        </div>
        <div class="dash-card" data-stat="totalfees">
          <div class="dash-label vd-drag-handle"
            style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
            <span style="opacity: 0.5; margin-right: 8px;">::</span>
            <span>Total Fees</span>

          </div>
          <div class="dash-value dash-value-muted" id="dash-totalfees">₹ 0.00</div>
        </div>
        <div class="dash-card" data-stat="winrate">
          <div class="dash-label vd-drag-handle"
            style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
            <span style="opacity: 0.5; margin-right: 8px;">::</span>
            <span>Win %</span>

          </div>
          <div class="dash-value dash-value-muted" id="dash-winrate">0%</div>
        </div>
        <div class="dash-card" data-stat="avg">
          <div class="dash-label vd-drag-handle"
            style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
            <span style="opacity: 0.5; margin-right: 8px;">::</span>
            <span>Avg / Trade</span>

          </div>
          <div class="dash-value" id="dash-avg">₹ 0.00</div>
        </div>
        <div class="dash-card" data-stat="avgwin">
          <div class="dash-label vd-drag-handle"
            style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
            <span style="opacity: 0.5; margin-right: 8px;">::</span>
            <span>Avg Win</span>

          </div>
          <div class="dash-value" id="dash-avgwin">₹ 0.00</div>
        </div>
        <div class="dash-card" data-stat="avgloss">
          <div class="dash-label vd-drag-handle"
            style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
            <span style="opacity: 0.5; margin-right: 8px;">::</span>
            <span>Avg Loss</span>

          </div>
          <div class="dash-value" id="dash-avgloss">₹ 0.00</div>
        </div>
        <div class="dash-card" data-stat="best">
          <div class="dash-label vd-drag-handle"
            style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
            <span style="opacity: 0.5; margin-right: 8px;">::</span>
            <span>Best Day</span>

          </div>
          <div class="dash-value" id="dash-best">₹ 0.00</div>
          <div class="dash-subvalue" id="dash-best-date">-</div>
        </div>
        <div class="dash-card" data-stat="worst">
          <div class="dash-label vd-drag-handle"
            style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
            <span style="opacity: 0.5; margin-right: 8px;">::</span>
            <span>Worst Day</span>

          </div>
          <div class="dash-value" id="dash-worst">₹ 0.00</div>
          <div class="dash-subvalue" id="dash-worst-date">-</div>
        </div>
        <div class="dash-card" data-stat="dd">
          <div class="dash-label vd-drag-handle"
            style="margin-bottom: 10px; font-size: 14px; cursor: grab; display: flex; align-items: center;">
            <span style="opacity: 0.5; margin-right: 8px;">::</span>
            <span>Max Drawdown</span>

          </div>
          <div class="dash-value" id="dash-dd">₹ 0.00</div>
        </div>
      </div>
          </div>

          <!-- DAILY QUICK STATS BLOCK -->
          <div style="margin-bottom:15px; border-bottom:1px solid #30363d; padding-bottom:10px;">
            <span style="font-size:1.1rem; color:#fff; font-weight:700;">Daily Breakdown & Drilldown</span>
          </div>

          <div id="qs-stats-groups" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; padding-bottom: 24px;">
            <!-- Populated via JS -->
          </div>

          <div style="display:grid; grid-template-columns:1.6fr 1fr; gap:16px; padding-bottom: 24px;">
            <div id="qs-drilldown-wrap" style="background:#161b22; border:1px solid #30363d; border-radius:14px; padding:18px; min-height:500px; display:flex; flex-direction:column; box-shadow:inset 0 0 20px rgba(0,0,0,0.2);">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
                <div style="font-size:0.75rem; color:#8b949e; font-weight:700; text-transform:uppercase; letter-spacing:1px;">
                  <span id="qs-drilldown-title">Analysis — Select a chart slice to drill down</span>
                </div>
                <button id="qs-drilldown-close" style="visibility:hidden; background:#30363d; border:none; color:#fff; cursor:pointer; font-size:0.8rem; padding:4px 8px; border-radius:6px; transition:background 0.2s;" title="Reset">Reset ↺</button>
              </div>
              <div id="qs-drilldown-chart" style="flex:1; min-height:420px;"></div>
            </div>

            <div style="background:#161b22; border:1px solid #30363d; border-radius:14px; overflow:hidden; display:flex; flex-direction:column; box-shadow:inset 0 0 20px rgba(0,0,0,0.2);">
              <div id="qs-pies-tabs" style="display:flex; border-bottom:1px solid #30363d; background:#1c2128;">
                <button data-tab="winloss" class="qs-tab active" style="flex:1; background:#161b22; border:none; padding:14px 4px; font-size:0.7rem; color:#fff; font-weight:800; cursor:pointer; border-bottom:3px solid #58a6ff; text-transform:uppercase; letter-spacing:0.5px;">Win/Loss</button>
                <button data-tab="tpd" class="qs-tab" style="flex:1; background:transparent; border:none; padding:14px 4px; font-size:0.7rem; color:#8b949e; font-weight:800; cursor:pointer; border-bottom:3px solid transparent; text-transform:uppercase; letter-spacing:0.5px;">Volume</button>
                <button data-tab="points" class="qs-tab" style="flex:1; background:transparent; border:none; padding:14px 4px; font-size:0.7rem; color:#8b949e; font-weight:800; cursor:pointer; border-bottom:3px solid transparent; text-transform:uppercase; letter-spacing:0.5px;">Points</button>
                <button data-tab="duration" class="qs-tab" style="flex:1; background:transparent; border:none; padding:14px 4px; font-size:0.7rem; color:#8b949e; font-weight:800; cursor:pointer; border-bottom:3px solid transparent; text-transform:uppercase; letter-spacing:0.5px;">Time</button>
              </div>
              <div style="flex:1; padding:24px; display:flex; align-items:center; justify-content:center; background:radial-gradient(circle at center, #1c2128 0%, #161b22 100%); overflow:hidden;">
                <!-- Shrink Donut container -->
                <div id="qs-pie-container" style="width:100%; max-width:320px; height:320px; margin:0 auto; position:relative;">
                  <div id="qs-chart-winloss" class="qs-tab-content active" style="width:100%; height:100%; opacity:1; transition:opacity 0.2s;"></div>
                  <div id="qs-chart-tpd" class="qs-tab-content" style="width:100%; height:100%; opacity:0; position:absolute; top:0; left:0; pointer-events:none; transition:opacity 0.2s;"></div>
                  <div id="qs-chart-points" class="qs-tab-content" style="width:100%; height:100%; opacity:0; position:absolute; top:0; left:0; pointer-events:none; transition:opacity 0.2s;"></div>
                  <div id="qs-chart-duration" class="qs-tab-content" style="width:100%; height:100%; opacity:0; position:absolute; top:0; left:0; pointer-events:none; transition:opacity 0.2s;"></div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div style="background:#161b22; border:1px solid #30363d; border-radius:12px; overflow:hidden;">
              <div style="padding:12px 16px; border-bottom:1px solid #30363d; font-size:0.7rem; color:#8b949e; font-weight:700; text-transform:uppercase; letter-spacing:1px; display:flex; justify-content:space-between; align-items:center;">
                <span>Notable Trading Days</span>
                <span style="font-size:10px; color:#555;">Max 30 rows</span>
              </div>
              <div id="qs-notable-table" style="max-height:300px; overflow-y:auto;"></div>
            </div>
          </div>
        </div>

      <!-- NEW PREMIUM BENTO LAYOUT (MOCKUP) -->
      <div id="premium-bento-tab-content" style="display: none;">
        <style>
          .bento-ui { font-family: 'Inter', system-ui, sans-serif; }
          .bento-grid { display: grid; gap: 14px; grid-template-columns: repeat(12, 1fr); margin-bottom: 16px; }
          .b-card { background: linear-gradient(150deg, rgba(31, 41, 55, 0.4), rgba(13, 17, 23, 0.8)); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 14px; box-shadow: 0 4px 20px -5px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03); padding: 14px; display: flex; flex-direction: column; position: relative; overflow: hidden; transition: transform 0.2s, border-color 0.2s; }
          .b-card:hover { transform: translateY(-2px); border-color: rgba(188, 140, 255, 0.3); }
          
          .b-card::before { content:''; position:absolute; top:0; left:0; width:100%; height:2px; background: linear-gradient(90deg, transparent, rgba(88,166,255,0.5), transparent); opacity:0; transition: opacity 0.3s; }
          .b-card:hover::before { opacity:1; }

          .b-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; color: #8b949e; margin-bottom: 6px; font-weight: 700; display:flex; align-items:center; gap:6px; z-index:2; position:relative; }
          .b-value { font-size: 1.3rem; font-weight: 800; color: #fff; letter-spacing: -0.5px; z-index:2; position:relative; }
          .b-subValue { font-size: 0.75rem; color: #8b949e; margin-top: 4px; font-weight: 500; z-index:2; position:relative; }

          .kpi-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 16px; }
          .mini-kpi { background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.04); padding: 10px; border-radius: 10px; display:flex; flex-direction:column; position:relative; transition: all 0.2s; }
          .mini-kpi:hover { background: rgba(88,166,255,0.05); border-color: rgba(88,166,255,0.2); transform: translateY(-1px); }
          
          /* Specialized Card Spans */
          .col-span-12 { grid-column: span 12; }
          .col-span-8 { grid-column: span 8; }
          .col-span-6 { grid-column: span 6; }
          .col-span-4 { grid-column: span 4; }
          .col-span-3 { grid-column: span 3; }
          
          /* Tiny Stats Grid inside a card */
          .mini-stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: auto; }
          .mini-stat { background: rgba(0,0,0,0.2); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.02); }
          .mini-stat-label { font-size: 0.65rem; color: #8b949e; text-transform: uppercase; margin-bottom: 4px; }
          .mini-stat-val { font-size: 1.1rem; font-weight: 700; color: #e6edf3; }
          
          .text-green { color: #3fb950; text-shadow: 0 0 10px rgba(63, 185, 80, 0.3); }
          .text-red { color: #f85149; text-shadow: 0 0 10px rgba(248, 81, 73, 0.3); }
          .text-neon { color: #bc8cff; text-shadow: 0 0 10px rgba(188, 140, 255, 0.3); }

          /* Dummy Line chart drawing */
          /* Dummy Line chart drawing */
          .bento-chart-placeholder { flex:1; width:calc(100% + 28px); min-height: 80px; background: repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(255,255,255,0.02) 20px); position:relative; margin: 10px -14px -14px -14px; z-index:1; border-radius: 0 0 14px 14px; overflow:hidden;}
          .fake-line { width: 100%; height: 100%; position: absolute; bottom: 0; left: 0; background-image: url("data:image/svg+xml,%3Csvg preserveAspectRatio='none' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0,80 Q10,50 20,70 T40,40 T60,60 T80,20 T100,30' fill='none' stroke='%233fb950' stroke-width='3' vector-effect='non-scaling-stroke' stroke-linecap='round' style='filter:drop-shadow(0px 8px 6px rgba(63,185,80,0.5))'/%3E%3C/svg%3E"); background-size: 100% 100%; }
          .fake-line.red { background-image: url("data:image/svg+xml,%3Csvg preserveAspectRatio='none' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0,20 Q10,40 20,30 T40,60 T60,50 T80,80 T100,90' fill='none' stroke='%23f85149' stroke-width='3' vector-effect='non-scaling-stroke' stroke-linecap='round' style='filter:drop-shadow(0px 8px 6px rgba(248,81,73,0.5))'/%3E%3C/svg%3E"); }
          .fake-line.cum { background-image: url("data:image/svg+xml,%3Csvg preserveAspectRatio='none' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0,90 L5,85 L10,88 L15,75 L20,70 L25,75 L30,60 L35,65 L40,50 L45,40 L50,45 L55,30 L60,35 L65,20 L70,25 L75,10 L80,15 L85,5 L90,10 L95,0 L100,2' fill='none' stroke='%233fb950' stroke-width='2' vector-effect='non-scaling-stroke' stroke-linecap='round' style='filter:drop-shadow(0px 8px 6px rgba(63,185,80,0.5))'/%3E%3C/svg%3E"); }
          
        </style>

        <div class="bento-ui">
          
          <!-- Top KPI Layer -->
          <div class="kpi-grid">
            <div class="mini-kpi"><div class="b-label"><span style="color:#58a6ff">●</span> Overall P&L</div><div class="b-value text-green">₹ 46,374</div></div>
            <div class="mini-kpi"><div class="b-label"><span style="color:#bc8cff">●</span> Net P&L</div><div class="b-value text-green">₹ 28,759</div></div>
            <div class="mini-kpi"><div class="b-label"><span style="color:#8b949e">●</span> Total Trades</div><div class="b-value">176</div></div>
            <div class="mini-kpi"><div class="b-label"><span style="color:#f0a45b">●</span> Win Rate</div><div class="b-value">52.4%</div></div>
            <div class="mini-kpi"><div class="b-label"><span style="color:#3fb950">●</span> Avg Win</div><div class="b-value text-green">₹ 1,790</div></div>
            <div class="mini-kpi"><div class="b-label"><span style="color:#f85149">●</span> Avg Loss</div><div class="b-value text-red">-₹ 1,578</div></div>
            <div class="mini-kpi"><div class="b-label">Total Fees</div><div class="b-value">₹ 17,615</div></div>
            <div class="mini-kpi"><div class="b-label">Charges</div><div class="b-value">₹ 10,135</div></div>
            <div class="mini-kpi"><div class="b-label">Brokerage</div><div class="b-value">₹ 7,480</div></div>
            <div class="mini-kpi"><div class="b-label">Avg / Trade</div><div class="b-value">₹ 163</div></div>
            <div class="mini-kpi col-span-2"><div class="b-label"><span style="color:#f85149">●</span> Max Drawdown</div><div class="b-value text-red">-₹ 27,803</div></div>
          </div>

          <!-- Middle Layer -->
          <div class="bento-grid">
             <div class="b-card col-span-8" style="min-height: 250px;">
               <div class="b-label"><span style="color:#3fb950">●</span> Cumulative Performance</div>
               <div class="bento-chart-placeholder">
                 <div class="fake-line cum"></div>
               </div>
             </div>
             
             <div class="b-card col-span-4" style="background: rgba(13,17,23,0.6);">
               <div class="b-label"><span style="color:#58a6ff">●</span> Notable Trading Days</div>
               
               <div style="display:flex; flex-direction:column; gap:12px; margin-top:14px;">
                 <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.05);">
                   <div><div style="color:#fff; font-weight:600; font-size:0.85rem;">Mar 10, Fri</div><div style="color:#8b949e; font-size:0.7rem;">Best Day Streak</div></div>
                   <div class="text-green" style="font-weight:700; font-size:0.85rem;">+ ₹ 5,745</div>
                 </div>
                 <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.05);">
                   <div><div style="color:#fff; font-weight:600; font-size:0.85rem;">Mar 18, Wed</div><div style="color:#8b949e; font-size:0.7rem;">Worst Overtrading</div></div>
                   <div class="text-red" style="font-weight:700; font-size:0.85rem;">- ₹ 11,448</div>
                 </div>
                 <div style="display:flex; justify-content:space-between; align-items:center;">
                   <div><div style="color:#fff; font-weight:600; font-size:0.85rem;">Apr 01, Sat</div><div style="color:#8b949e; font-size:0.7rem;">High Volume</div></div>
                   <div class="text-green" style="font-weight:700; font-size:0.85rem;">+ ₹ 5,039</div>
                 </div>
                 
                 <button style="margin-top:auto; background:rgba(88,166,255,0.1); border:1px solid rgba(88,166,255,0.3); color:#58a6ff; padding:12px; border-radius:12px; cursor:pointer; font-weight:600;">View All Outliers →</button>
               </div>
             </div>
          </div>

          <!-- Bottom Grid: Mini Trends -->
          <div class="bento-grid" style="grid-template-columns: repeat(4, 1fr);">
             <div class="b-card">
               <div class="b-label">Points Per Trade</div>
               <div class="b-value text-green">14.5 avg</div>
               <div class="bento-chart-placeholder" style="min-height: 80px;"><div class="fake-line"></div></div>
             </div>
             <div class="b-card">
               <div class="b-label">Trade Count</div>
               <div class="b-value">4.8 / day</div>
               <div class="bento-chart-placeholder" style="min-height: 80px;"><div class="fake-line red"></div></div>
             </div>
             <div class="b-card">
               <div class="b-label">Charges Paid</div>
               <div class="b-value">₹ 10,135</div>
               <div class="bento-chart-placeholder" style="min-height: 80px;"><div class="fake-line red"></div></div>
             </div>
             <div class="b-card">
               <div class="b-label">Avg Buy Price</div>
               <div class="b-value text-neon">210.4</div>
               <div class="bento-chart-placeholder" style="min-height: 80px;"><div class="fake-line"></div></div>
             </div>
          </div>

        </div>
      </div>
      </div>
    </section>

    <!-- VD Stats Modal Popup -->
    <div id="vd-stats-modal" class="modal-overlay" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 10000; align-items: center; justify-content: center; backdrop-filter: blur(2px);">
      <div class="modal-content" style="background: var(--surface, #161b22); padding: 25px; border-radius: 12px; width: 450px; max-width: 90vw; max-height: 85vh; display: flex; flex-direction: column; border: 1px solid var(--border2, #30363d); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <h3 style="margin-top: 0; margin-bottom: 20px; font-size: 18px; border-bottom: 1px solid var(--border2, #30363d); padding-bottom: 15px; color: var(--text, #e6edf3);">Stats Configuration</h3>
        <div id="vd-stats-menu-container" style="overflow-y: auto; flex: 1; margin-bottom: 20px; padding-right: 10px;">
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid var(--border2, #30363d); padding-top: 15px;">
          <button class="btn btn-outline" id="vd-stats-close-btn" style="padding: 8px 16px;">Cancel</button>
          <button class="btn btn-primary" id="vd-stats-apply-btn" style="padding: 8px 24px;">Apply</button>
        </div>
      </div>
    </div>

```

## File: `templates/strategy_lab.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Strategy Lab | Trading Journal</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/static/css/style-strategy-lab.css">
</head>
<body>
    <div id="sync-banner" style="display:none; position:fixed; top:50px; left:290px; padding:0 15px; height:32px; background:#4f46e5; color:white; font-size:11px; font-weight:500; align-items:center; justify-content:center; z-index:9999; border-radius:30px; border:1px solid rgba(255,255,255,0.2); backdrop-filter:blur(5px); box-shadow:0 4px 15px rgba(0,0,0,0.3); transition:all 0.3s ease;"></div>
    <div class="lab-container">
        <main class="lab-main">
            <div class="loading-overlay" id="loader">Running Strategy...</div>
            <div class="nav-controls">
                <button class="nav-btn" id="prev-day-btn">◀</button>
                <button id="fit-btn" title="Fit View" style="padding:4px 8px; border:1px solid #e2e8f0; border-radius:4px; background:#f8fafc; cursor:pointer;">⛶</button>
                <button id="reset-btn" title="Reset Chart" style="padding:4px 8px; border:1px solid #e2e8f0; border-radius:4px; background:#f8fafc; cursor:pointer;">↺</button>
                <input type="date" id="nav-date-picker" style="height:32px; padding:0 8px; border:1px solid #d0d7de; border-radius:6px; font-size:0.85rem; font-family:inherit; color:#1e293b; background:white;">
                <button class="nav-btn" id="next-day-btn">▶</button>
                <button class="nav-btn" id="dual-view-btn" style="margin-left:10px; border-color:#8b5cf6; color:#8b5cf6; font-weight:700;">DUAL VIEW: OFF</button>
                <div style="margin-left:auto; display:flex; gap:10px;">
                    <button class="nav-btn" id="open-history-btn" style="border-color:#0969da; color:#0969da;">DATA HISTORY</button>
                    <button class="nav-btn" id="sync-all-btn" style="border-color:#10b981; color:#10b981; font-weight:700;" title="Sync All Instruments from Trades">SYNC DATA</button>
                    <button class="nav-btn" id="relogin-btn" style="border-color:#ef4444; color:#ef4444; font-size:10px; padding:2px 4px;">RE-LOGIN</button>
                    <button class="nav-btn" id="open-trades-modal-btn" style="border-color:#f9a825; color:#f9a825; font-weight:600;">REAL TRADES</button>
                    <button class="nav-btn" onclick="showEquityCurve()" style="border-color:#ec4899; color:#ec4899; font-weight:700;" title="Day Equity Curve (MTM)">📈 MTM</button>
                    <button class="nav-btn" onclick="openPivotModal()" style="border-color:#6366f1; color:#6366f1; font-weight:600;" title="Manual Pivot Editor">🛠️ PIVOTS</button>
                    <button class="nav-btn" id="batch-export-btn">Batch Export</button>
                    <a href="/" class="nav-btn" style="text-decoration:none;">Home</a>
                </div>
            </div>
            <div class="chart-wrapper">
                <div class="chart-container-box" id="container-main">
                    <div class="chart-label">
                        <span style="color:#475569;">NIFTY 50 (INDEX)</span>
                        <div class="tf-btn-group" id="tf-group-main">
                            <button class="tf-btn" onclick="switchTF('main', '1m')">1</button>
                            <button class="tf-btn active" onclick="switchTF('main', '3m')">3</button>
                            <button class="tf-btn" onclick="switchTF('main', '5m')">5</button>
                            <div style="width:1px; height:12px; background:#cbd5e1; margin:0 4px;"></div>
                            <button class="tf-btn" onclick="event.stopPropagation(); zoomY('main', 0.8)" title="Stretch Vertically (Zoom In)" style="font-size:12px; padding:0 8px;">+</button>
                            <button class="tf-btn" onclick="event.stopPropagation(); zoomY('main', 1.2)" title="Squeeze Vertically (Zoom Out)" style="font-size:12px; padding:0 8px;">-</button>
                            <button class="tf-btn" id="lock-btn-main" onclick="toggleLockRatio('main')" title="Lock Price to Bar Ratio" style="margin-left:5px; border-color:#6366f1; color:#6366f1;">🔒</button>
                        </div>
                    </div>
                    <div id="chart-main"></div>
                    <div id="overlay-main" class="trade-label-overlay"></div>
                </div>
                <div class="resizer" id="chart-resizer" style="display: none;"></div>
                <div class="chart-container-box" id="container-opt" style="display: none;">
                    <div class="chart-label">
                        <span id="opt-label" style="color:#475569;">OPTION CHART</span>
                        <div class="tf-btn-group" id="tf-group-opt">
                            <button class="tf-btn" onclick="switchTF('opt', '1m')">1</button>
                            <button class="tf-btn active" onclick="switchTF('opt', '3m')">3</button>
                            <button class="tf-btn" onclick="switchTF('opt', '5m')">5</button>
                            <div style="width:1px; height:12px; background:#cbd5e1; margin:0 4px;"></div>
                            <button class="tf-btn" onclick="event.stopPropagation(); zoomY('opt', 0.8)" title="Stretch Vertically (Zoom In)" style="font-size:12px; padding:0 8px;">+</button>
                            <button class="tf-btn" onclick="event.stopPropagation(); zoomY('opt', 1.2)" title="Squeeze Vertically (Zoom Out)" style="font-size:12px; padding:0 8px;">-</button>
                            <button class="tf-btn" id="lock-btn-opt" onclick="toggleLockRatio('opt')" title="Lock Price to Bar Ratio" style="margin-left:5px; border-color:#6366f1; color:#6366f1;">🔒</button>
                        </div>
                    </div>
                    <div id="chart-opt"></div>
                    <div id="overlay-opt" class="trade-label-overlay"></div>
                </div>
            </div>
        </main>
        {% include 'strategy-lab-sidebar.html' %}
    </div>
    {% include 'strategy-lab-modals.html' %}
    <script src="/static/js/vendor/lightweight-charts.standalone.production.js"></script>
    <script src="/static/js/strategy-lab-a.js"></script>
    <script src="/static/js/strategy-lab-b.js"></script>
    <script src="/static/js/strategy-lab-c.js"></script>
</body>
</html>
```
