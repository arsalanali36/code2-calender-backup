# HTML — Layout (index.html / gallery.html)
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `templates\index.html`
```html
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Trading Journal</title>
  <link rel="stylesheet" href="/static/css/style-base.css" />
  <link rel="stylesheet" href="/static/css/style-gallery-a.css" />
  <link rel="stylesheet" href="/static/css/style-gallery-b.css" />
  <link rel="stylesheet" href="/static/css/style-misc.css" />
</head>

<body>

  <!-- HEADER -->
  <header class="app-header">
    <div class="logo">
      <span class="logo-icon">&#9650;</span>
      <span class="logo-text">Trading Journal</span>
    </div>
    <div class="header-actions">
      <div class="dropdown-wrapper">
        <button class="btn btn-outline" id="broker-filter-btn-top">Broker: Both &#9660;</button>
        <div class="dropdown-menu" id="broker-filter-menu-top">
          <button class="dropdown-item broker-filter-item" data-broker="both">Both</button>
          <button class="dropdown-item broker-filter-item" data-broker="zerodha">Zerodha</button>
          <button class="dropdown-item broker-filter-item" data-broker="dhan">Dhan</button>
        </div>
      </div>
      <button class="btn btn-outline" id="calendar-mode-btn">Consolidated</button>
      <button class="btn btn-outline" id="settings-btn" title="Settings">&#9881; Settings</button>
    </div>
  </header>

  <main class="app-main">

    <!-- ── CALENDAR SECTION ─────────────────── -->
    <section class="section calendar-section">
      <div class="section-header">
        <div class="calendar-nav">
          <button class="nav-arrow" id="prev-month">&#8249;</button>
          <select id="month-select" class="select-box"></select>
          <select id="view-select" class="select-box">
            <option value="month" selected>Month</option>
            <option value="year">Year</option>
          </select>
          <select id="year-select" class="select-box"></select>
          <button class="nav-arrow" id="next-month">&#8250;</button>
          <button class="btn btn-outline" id="today-btn">Today</button>
          <span class="range-label" id="month-range-label"></span>
        </div>
        <div class="show-heads-wrapper">
          <button class="btn btn-outline" id="show-heads-btn">Show Heads &#9660;</button>
          <div class="show-heads-panel" id="show-heads-panel">
            <p class="panel-hint">Import Excel to see columns</p>
          </div>
        </div>
      </div>

      <div class="calendar-container" id="calendar-month-view">
        <div class="calendar-weekdays">
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div class="weekend">Sat</div>
          <div class="weekend">Sun</div>
        </div>
        <div class="calendar-grid" id="calendar-grid"></div>
      </div>
      <div class="calendar-yearly hidden" id="calendar-year-view"></div>
    </section>

    <!-- ── DASHBOARD SUMMARY ─────────────────── -->
    <section class="section dashboard-section">
      <div class="section-header dashboard-header">
        <div class="dashboard-title">
          <div class="section-title">Monthly Summary</div>
          <div class="dashboard-subtitle" id="dashboard-subtitle">for -</div>
        </div>
        <div class="dashboard-actions">
          <div class="dropdown-wrapper">
            <button class="btn btn-outline" id="dashboard-stats-btn">Stats &#9660;</button>
            <div class="dropdown-menu" id="dashboard-stats-menu"></div>
          </div>
        </div>
      </div>
      <div class="dashboard-grid">
        <div class="dash-card" data-stat="overall">
          <div class="dash-label">Overall P&amp;L</div>
          <div class="dash-value" id="dash-overall">₹ 0.00</div>
        </div>
        <div class="dash-card" data-stat="net">
          <div class="dash-label">Net P&amp;L</div>
          <div class="dash-value" id="dash-net">₹ 0.00</div>
        </div>
        <div class="dash-card" data-stat="trades">
          <div class="dash-label">Total Trades</div>
          <div class="dash-value dash-value-muted" id="dash-trades">0</div>
        </div>
        <div class="dash-card" data-stat="charges">
          <div class="dash-label">Charges</div>
          <div class="dash-value dash-value-muted" id="dash-charges">₹ 0.00</div>
        </div>
        <div class="dash-card" data-stat="brokerage">
          <div class="dash-label">Brokerage</div>
          <div class="dash-value dash-value-muted" id="dash-brokerage">₹ 0.00</div>
        </div>
        <div class="dash-card" data-stat="totalfees">
          <div class="dash-label">Total Fees</div>
          <div class="dash-value dash-value-muted" id="dash-totalfees">₹ 0.00</div>
        </div>
        <div class="dash-card" data-stat="winrate">
          <div class="dash-label">Win %</div>
          <div class="dash-value dash-value-muted" id="dash-winrate">0%</div>
        </div>
        <div class="dash-card" data-stat="avg">
          <div class="dash-label">Avg / Trade</div>
          <div class="dash-value" id="dash-avg">₹ 0.00</div>
        </div>
        <div class="dash-card" data-stat="avgwin">
          <div class="dash-label">Avg Win</div>
          <div class="dash-value" id="dash-avgwin">₹ 0.00</div>
        </div>
        <div class="dash-card" data-stat="avgloss">
          <div class="dash-label">Avg Loss</div>
          <div class="dash-value" id="dash-avgloss">₹ 0.00</div>
        </div>
        <div class="dash-card" data-stat="best">
          <div class="dash-label">Best Day</div>
          <div class="dash-value" id="dash-best">₹ 0.00</div>
          <div class="dash-subvalue" id="dash-best-date">-</div>
        </div>
        <div class="dash-card" data-stat="worst">
          <div class="dash-label">Worst Day</div>
          <div class="dash-value" id="dash-worst">₹ 0.00</div>
          <div class="dash-subvalue" id="dash-worst-date">-</div>
        </div>
        <div class="dash-card" data-stat="dd">
          <div class="dash-label">Max Drawdown</div>
          <div class="dash-value" id="dash-dd">₹ 0.00</div>
        </div>
      </div>
    </section>

    <!-- ── TRADE TABLE SECTION ─────────────── -->
    <section class="section table-section">
      <div class="section-header">
        <h2 class="section-title">Trade Table</h2>
        <div class="table-header-actions">

          <!-- Date Range Filter -->
          <div class="date-range-filter">
            <input type="date" id="date-range-from" class="select-box date-range-input" title="From date" />
            <span class="date-range-sep">&#8212;</span>
            <input type="date" id="date-range-to" class="select-box date-range-input" title="To date" />
            <button class="btn btn-outline date-range-clear" id="date-range-clear"
              title="Clear date filter">&#10005;</button>
          </div>

          <!-- Note column quick toggle -->
          <button class="btn btn-outline" id="note-col-toggle-btn" title="Show/hide Note column">&#128203; Note</button>

          <!-- Column Visibility -->
          <div class="dropdown-wrapper" id="col-vis-wrapper">
            <button class="btn btn-outline" id="col-vis-btn">Columns &#9660;</button>
            <div class="dropdown-menu col-vis-panel" id="col-vis-panel">
              <p class="panel-hint" style="margin:8px">Import Excel first</p>
            </div>
          </div>

          <!-- Saved Views -->
          <div class="dropdown-wrapper" id="view-preset-wrapper">
            <button class="btn btn-outline" id="view-preset-btn">&#128204; Views &#9660;</button>
            <div class="dropdown-menu" id="view-preset-panel" style="min-width:200px;">
              <button class="dropdown-item" id="save-view-btn">&#128190; Save Current View</button>
              <div class="dropdown-divider"></div>
              <div id="saved-views-list"></div>
            </div>
          </div>

          <!-- Tag Filter -->
          <div class="dropdown-wrapper">
            <button class="btn btn-outline" id="tag-filter-btn">&#127991; Tags &#9660;</button>
            <div class="dropdown-menu tag-filter-panel" id="tag-filter-panel">
              <p class="panel-hint" style="padding:10px 8px">No tags yet.<br>Add via Tags column.</p>
            </div>
          </div>

          <!-- Filter toggle -->
          <button class="btn btn-outline" id="filter-toggle-btn">&#9906; Filter</button>

          <!-- Add dropdown -->
          <div class="dropdown-wrapper">
            <button class="btn btn-outline" id="add-dropdown-btn">+ Add &#9660;</button>
            <div class="dropdown-menu" id="add-dropdown-menu">
              <button class="dropdown-item" id="add-row-btn">+ Add Row</button>
              <button class="dropdown-item" id="add-tag-col-btn">+ Add Tag Column</button>
              <button class="dropdown-item" id="add-col-btn">+ Add Column</button>
              <button class="dropdown-item" id="edit-col-btn">&#9998; Edit Column</button>
            </div>
          </div>

          <!-- File dropdown -->
          <div class="dropdown-wrapper">
            <button class="btn btn-primary" id="file-dropdown-btn">&#128193; File &#9660;</button>
            <div class="dropdown-menu" id="file-dropdown-menu">
              <button class="dropdown-item" id="import-btn">&#8679; Import Excel</button>
              <input type="file" id="excel-input" accept=".xlsx,.xls" style="display:none" />
              <button class="dropdown-item" id="import-raw-csv-btn">&#8679; Zerodha Today CSV</button>
              <input type="file" id="raw-csv-input" accept=".csv,text/csv" style="display:none" />
              <button class="dropdown-item" id="import-historical-csv-btn">&#8679; Zerodha Historical CSV</button>
              <input type="file" id="historical-csv-input" accept=".csv,text/csv" style="display:none" />
              <button class="dropdown-item" id="import-dhan-csv-btn">&#8679; Dhan CSV</button>
              <input type="file" id="dhan-csv-input" accept=".csv,text/csv" style="display:none" />
              <button class="dropdown-item" id="export-btn">&#8681; Export Excel</button>
              <button class="dropdown-item" id="export-structured-csv-btn">&#8681; Export Structured CSV</button>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item" id="backup-btn">&#128190; Backup (Data + Images)</button>
              <button class="dropdown-item" id="restore-btn">&#8635; Restore from Backup</button>
              <input type="file" id="json-input" accept=".json,.zip" style="display:none" />
            </div>
          </div>

        </div>
      </div>

      <div class="table-wrapper">
        <table class="trade-table" id="trade-table">
          <colgroup id="table-colgroup"></colgroup>
          <thead>
            <tr id="table-head-row"></tr>
            <tr id="filter-row" class="filter-row hidden"></tr>
          </thead>
          <tbody id="table-body"></tbody>
          <tfoot>
            <tr id="table-foot-row"></tr>
          </tfoot>
        </table>
        <div class="table-empty" id="table-empty">Import an Excel file or add rows to get started</div>
      </div>
    </section>

  </main>

  {% include 'modals.html' %}
  {% include 'gallery.html' %}

  <div class="toast" id="toast"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js"></script>
  <script src="/static/js/state.js"></script>
  <script src="/static/js/data.js"></script>
  <script src="/static/js/settings.js"></script>
  <script src="/static/js/dashboard.js"></script>
  <script src="/static/js/calendar.js"></script>
  <script src="/static/js/table-render.js"></script>
  <script src="/static/js/table-cols.js"></script>
  <script src="/static/js/table-colops.js"></script>
  <script src="/static/js/gallery-open.js"></script>
  <script src="/static/js/gallery-render.js"></script>
  <script src="/static/js/gallery-stats.js"></script>
  <script src="/static/js/gallery-core.js"></script>
  <script src="/static/js/gallery-image-ops.js"></script>
  <script src="/static/js/gallery-ops.js"></script>
  <script src="/static/js/gallery-layer.js"></script>
  <script src="/static/js/gallery-nav.js"></script>
  <script src="/static/js/gallery-tags.js"></script>
  <script src="/static/js/gallery-tags-filter.js"></script>
  <script src="/static/js/gallery-data.js"></script>
  <script src="/static/js/gallery-img-tags.js"></script>
  <script src="/static/js/annotate-zoom.js"></script>
  <script src="/static/js/annotate-marquee.js"></script>
  <script src="/static/js/annotate-tools.js"></script>
  <script src="/static/js/annotate-canvas.js"></script>
  <script src="/static/js/annotate-ctx-menu.js"></script>
  <script src="/static/js/annotate-lifecycle.js"></script>
  <script src="/static/js/annotate-fabric.js"></script>
  <script src="/static/js/io.js"></script>
  <script src="/static/js/events-keys.js"></script>
  <script src="/static/js/events-ui.js"></script>
  <script src="/static/js/events-gallery.js"></script>
  <script src="/static/js/events-settings.js"></script>
  <script src="/static/js/events.js"></script>
</body>

</html>
```

## File: `templates\gallery.html`
```html
<!-- ── IMAGE GALLERY V2 ──────────────────────────────────── -->
<div class="modal-overlay gv2-modal" id="gallery-modal">

  <!-- ① Global Button Tray (top, fixed) -->
  <div class="gv2-tray">
    <div class="gv2-tray-left">
      <button class="gv2-date-arrow" id="gallery-date-prev" title="Previous date">&#8249;</button>
      <span class="gv2-date-label" id="gallery-date"></span>
      <input type="date" id="gallery-date-picker" class="gv2-date-picker" title="Jump to date (D)" />
      <button class="gv2-date-arrow" id="gallery-date-next" title="Next date">&#8250;</button>
    </div>
    <div class="gv2-tray-btns">
      <button class="gv2-tray-btn gv2-toggle-btn" id="gv2-annotate-btn" title="Annotation bar (A)">&#9998;
        Annotate</button>
      <button class="gv2-tray-btn gv2-toggle-btn" id="gv2-marquee-btn" title="Marquee mode (M)">&#9633;
        Marquee</button>
      <button class="gv2-tray-btn gv2-toggle-btn" id="gv2-tags-btn" title="Tags tray">&#127991; Tags</button>
      <button class="gv2-tray-btn gv2-toggle-btn" id="gv2-layer-btn" title="Layers panel (L)">&#10064; Layers</button>
    </div>
    <div class="gv2-tray-right">
      <!-- Gallery Tools Dropdown -->
      <div class="dropdown-wrapper">
        <button class="btn btn-outline" id="gallery-tools-btn"
          style="height: 26px; padding: 0 8px; font-size: 0.8rem; margin-right: 12px; border: 1px solid var(--border);">Tools
          &#9660;</button>
        <div class="dropdown-menu" id="gallery-tools-panel"
          style="right: 0px; left: auto; min-width: 150px; overflow-y: auto; background: var(--bg2);">
          <button class="dropdown-item" id="gallery-upload-btn"
            style="text-align: left; padding: 8px 12px; width: 100%;">&#11014; Upload</button>
          <button class="dropdown-item" id="gallery-tag-btn" title="Manage tags for this image"
            style="text-align: left; padding: 8px 12px; width: 100%;">&#127991; Img Tag</button>
          <button class="dropdown-item" id="gv2-obs-btn" title="Open observation for this date"
            style="text-align: left; padding: 8px 12px; width: 100%;">&#128211; Obs</button>
        </div>
      </div>
      <!-- Gallery Show Heads Dropdown -->
      <div class="dropdown-wrapper">
        <button class="btn btn-outline" id="gallery-show-heads-btn"
          style="height: 26px; padding: 0 8px; font-size: 0.8rem; margin-right: 12px; border: 1px solid var(--border);">Show
          Heads &#9660;</button>
        <div class="dropdown-menu show-heads-panel" id="gallery-show-heads-panel"
          style="right: 0px; left: auto; min-width: 220px; max-height: 400px; overflow-y: auto;">
        </div>
      </div>
      <!-- Gallery Tag Filter Dropdown -->
      <div class="dropdown-wrapper">
        <button class="btn btn-outline" id="gallery-img-tag-filter-btn" title="Filter Tags (F)"
          style="background:var(--bg2); height: 26px; padding: 0 8px; font-size: 0.8rem; margin-right: 12px; border: 1px solid var(--border);">&#127991;
          Filter Tags (F) &#9660;</button>
        <div class="dropdown-menu tag-filter-panel" id="gallery-img-tag-filter-panel"
          style="right: 0px; left: auto; max-width: 280px; max-height: 400px; overflow-y: auto;">
          <p class="panel-hint" style="padding:10px 8px">No tags available.</p>
        </div>
      </div>

      <span class="gv2-zoom-hint">Scroll:zoom &middot; Drag:pan &middot; R:reset</span>
      <button class="gv2-close-btn" id="gallery-close">&#10005;</button>
    </div>
  </div>

  <!-- ② Body -->
  <div class="gv2-body">

    <!-- Annotation Bar (floating left, toggled by A / gv2-annotate-btn) -->
    <div class="gv2-annot-bar" id="gv2-annot-bar" style="display:none">
      <button class="annot-tool active gv2-ab-btn" id="annot-pen" title="Pen (freehand)">&#9998;</button>
      <button class="annot-tool gv2-ab-btn" id="annot-highlight" title="Highlighter">&#9670;</button>
      <button class="annot-tool gv2-ab-btn" id="gv2-text-btn" title="Text tool">T</button>
      <button class="annot-tool gv2-ab-btn" id="annot-eraser" title="Eraser">&#9003;</button>
      <!-- Shape tool group (right-click = shape picker) -->
      <div class="annot-shape-group" id="annot-shape-group">
        <button class="annot-tool gv2-ab-btn" id="annot-shape" title="Shape (right-click: switch shape)"
          data-shape="rect">&#9645;</button>
        <div class="annot-shape-menu" id="annot-shape-menu">
          <button class="annot-shape-opt" data-tool="arrow">&#8599; Arrow</button>
          <button class="annot-shape-opt" data-tool="rect">&#9645; Rect</button>
          <button class="annot-shape-opt" data-tool="circle">&#11096; Circle</button>
        </div>
      </div>
      <button class="annot-tool gv2-ab-btn" id="annot-select" title="Select / Move">&#9654;</button>
      <div class="gv2-ab-sep"></div>
      <input type="color" id="annot-color" class="annot-color-input gv2-ab-color" value="#f85149" title="Color" />
      <input type="range" id="annot-size" min="1" max="30" value="3" class="annot-range gv2-ab-range" title="Size" />
      <span id="annot-size-label" class="annot-size-label gv2-ab-size-lbl">3</span>
      <div class="gv2-ab-sep"></div>
      <button class="annot-tool gv2-ab-btn" id="annot-undo" title="Undo (Ctrl+Z)">&#8617;</button>
      <button class="annot-tool gv2-ab-btn" id="annot-redo" title="Redo (Ctrl+Y)">&#8618;</button>
      <button class="annot-tool gv2-ab-btn" id="annot-clear" title="Clear all">&#10005;</button>
      <div class="gv2-ab-sep"></div>
      <button class="gv2-ab-btn gv2-ab-save" id="annot-save-overlay" title="Save as overlay">&#128190;</button>
      <button class="gv2-ab-btn gv2-ab-merge" id="annot-save-merge" title="Merge &amp; Save">&#8681;</button>
    </div>

    <!-- Layer Panel (Photoshop-style, left side) -->
    <div class="gv2-layer-panel" id="gv2-layer-panel" style="display:none">
      <div class="gv2-lp-header">
        <span>Layers</span>
        <div style="display:flex;gap:3px;align-items:center;">
          <button class="gv2-lp-sel-btn" id="gv2-lp-sel-all" title="Select All">&#9745;</button>
          <button class="gv2-lp-sel-btn" id="gv2-lp-sel-none" title="Deselect All">&#9746;</button>
          <button class="gv2-lp-sel-btn" id="gv2-lp-sel-inv" title="Invert Selection">&#8645;</button>
          <button class="gv2-lp-close" id="gv2-lp-close-btn" title="Close">&#10005;</button>
        </div>
      </div>
      <div class="gv2-lp-body" id="gv2-layer-list"></div>
      <div class="gv2-lp-resize-handle" id="gv2-lp-resize-handle" title="Drag to resize"></div>
    </div>

    <!-- Center column: image + tag cloud + thumbnails -->
    <div class="gv2-center">

      <!-- Main image area -->
      <div class="gv2-img-area" id="gallery-img-wrapper">
        <button class="gv2-nav-btn" id="gallery-prev">&#10094;</button>
        <!-- Zoom layer: img + annotation canvas ek saath zoom hote hain -->
        <div id="gallery-zoom-layer">
          <img class="gallery-img" id="gallery-img" src="" alt="Trade image" draggable="false" />
          <canvas id="annot-canvas" class="annot-canvas" style="display:none"></canvas>
        </div>
        <button class="gv2-nav-btn gv2-nav-right" id="gallery-next">&#10095;</button>
        <div class="gv2-img-counter" id="gallery-counter"></div>
        <div class="gv2-img-tags" id="gallery-image-tags"></div>

        <!-- Heads Display -->
        <div id="gallery-heads-display" class="gallery-heads-display"
          style="position: absolute; top: 12px; left: 12px; z-index: 40; background: rgba(30, 35, 48, 0.85); border: 1px solid var(--border); padding: 8px 12px; border-radius: 6px; color: var(--text); font-size: 0.85rem; pointer-events: none; display: none; flex-direction: column; gap: 4px; display: none; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
        </div>

        <!-- Text Bar -->
        <div class="gv2-text-bar" id="gv2-text-bar" style="display:none">
          <input type="color" id="gv2-tb-color" class="gv2-ab-color" value="#000000" title="Text Color" />
          <input type="number" id="gv2-tb-size" class="gv2-tb-size" value="24" min="8" max="144" title="Font size" />
          <select id="gv2-tb-font" class="gv2-ab-btn" title="Font family"
            style="width: 80px; padding: 0 4px; appearance: auto; background: var(--bg); border: 1px solid var(--border);">
            <option value="Arial" selected>Arial</option>
            <option value="Courier New">Courier</option>
            <option value="Times New Roman">Times</option>
            <option value="Impact">Impact</option>
          </select>
          <button id="gv2-tb-bold" class="gv2-ab-btn" title="Bold"><b>B</b></button>
          <button id="gv2-tb-italic" class="gv2-ab-btn" title="Italic"><i>I</i></button>
          <button id="gv2-tb-list" class="gv2-ab-btn" style="font-size:0.75rem"
            title="Bullets / Numbering">&#9776;</button>
          <button id="gv2-tb-align" class="gv2-ab-btn" title="Alignment">&#8801;</button>
        </div>
        <div class="gv2-marquee-bar" id="gv2-marquee-bar" style="display:none">
          <input type="text" id="gv2-mq-tag-input" class="gv2-mq-input" list="gv2-mq-tag-suggestions"
            placeholder="Tag for selected box..." />
          <datalist id="gv2-mq-tag-suggestions"></datalist>
          <button id="gv2-mq-add" class="gv2-ab-btn" title="Add tag to selected marquee">+ Tag</button>
          <button class="gv2-ab-btn annot-tool" id="annot-vselect" title="Group Select (V)">V</button>
          <button id="gv2-mq-rebind" class="gv2-ab-btn"
            title="Remove frozen legacy overlay and keep editable marquee">Rebind</button>
          <button id="gv2-mq-del" class="gv2-ab-btn" title="Close marquee tool">&#10005;</button>
        </div>
      </div>

      <!-- Tag Cloud (always visible) -->
      <div class="gv2-tag-cloud" id="gv2-tag-cloud">
        <span class="gv2-tc-label">Filter:</span>
        <div class="gv2-tc-chips" id="gv2-tag-cloud-chips"></div>
        <button class="gv2-tc-mode-btn" id="gv2-tc-mode-btn" title="Toggle AND / OR">OR</button>
        <button class="gv2-tc-mode-btn active" id="gv2-grp-filter-btn" title="Filter mode: Grp = entire group if any image matches, Img = only matching image" style="margin-left:4px">Grp</button>
        <button class="gv2-tc-clear-btn" id="gv2-tc-clear-btn" title="Clear filter" style="display:none">&#10005;
          Clear</button>
        <!-- Shortcuts reference button -->
        <button class="gv2-tc-mode-btn" id="gv2-shortcuts-btn" title="Keyboard shortcuts" style="margin-left:4px;font-size:0.8rem;padding:2px 7px;">&#9000;</button>
        <div id="gv2-shortcuts-popover" style="display:none;position:absolute;bottom:calc(100% + 6px);left:0;right:0;max-width:520px;margin:0 auto;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);z-index:9999;padding:10px 14px;font-size:0.78rem;"></div>
      </div>

      <!-- Thumbnail Tray -->
      <div class="gv2-thumb-tray">
        <div class="gv2-tray-resize-handle-horiz" id="gv2-tray-resize-handle-horiz"></div>
        <div class="gv2-thumbs" id="gallery-thumbs"></div>
      </div>

    </div><!-- /gv2-center -->

    <!-- Tags Tray (right panel, toggled by T) -->
    <div class="gv2-tags-tray" id="gv2-tags-tray" style="display:none">
      <div class="gv2-tray-resize-handle" id="gv2-tray-resize-handle"></div>

      <!-- Video URLs Tray -->
      <div class="gv2-video-url-tray" id="gv2-video-url-tray"
        style="padding: 10px; border-bottom: 1px solid var(--border); display:none;">
        <div style="font-size: 0.85rem; font-weight: 600; margin-bottom: 8px; color: var(--text);">Video URLs</div>
        <div id="gv2-video-url-list"
          style="display: flex; flex-wrap: wrap; gap: 8px; padding: 4px 0; margin-bottom: 12px;"></div>
      </div>

      <div class="gv2-tt-hdr">
        <span class="gv2-tt-title">Tags</span>
        <div style="display:flex;gap:4px;align-items:center;">
          <button class="gv2-tt-sz-btn" id="gv2-tag-sz-minus" title="Tag size kam karo">A-</button>
          <button class="gv2-tt-sz-btn" id="gv2-tag-sz-plus" title="Tag size badhao">A+</button>
          <button class="gv2-tt-add-grp" id="gv2-add-grp-btn">+ Group</button>
          <button class="gv2-tt-del-tag" id="gv2-del-tag-btn" title="Delete mode">Del</button>
        </div>
      </div>
      <div class="gv2-tt-body" id="gv2-tags-tray-body"></div>
    </div>

  </div><!-- /gv2-body -->
</div><!-- /gallery-modal -->

<!-- ── IMAGE UPLOAD MODAL ───────────────────── -->
<div class="modal-overlay" id="upload-modal">
  <div class="modal-content upload-modal-content">
    <div class="modal-header">
      <span id="upload-modal-title">Upload Images</span>
      <button class="close-btn" id="upload-close">&#10005;</button>
    </div>
    <div class="upload-drop-zone" id="upload-drop-zone">
      <div class="drop-icon">&#128247;</div>
      <p>Drop images here or <span class="upload-label" id="upload-browse-label">browse</span></p>
      <p class="upload-paste-hint">&#128203; Ctrl+V to paste an image from clipboard</p>
      <input type="file" id="image-file-input" multiple accept="image/*" style="display:none" />
    </div>
    <div class="upload-preview" id="upload-preview"></div>
    <div class="upload-actions">
      <button class="btn btn-outline" id="upload-cancel-btn">Cancel</button>
      <button class="btn btn-primary" id="upload-done-btn">Done</button>
    </div>
  </div>
</div>

<!-- ── TAG PICKER MODAL ─────────────── -->
<div class="modal-overlay" id="tag-modal">
  <div class="modal-content tag-modal-content">
    <div class="modal-header">
      <span id="tag-modal-title">Tags</span>
      <button class="close-btn" id="tag-picker-close-x">&#10005;</button>
    </div>
    <input type="text" id="tag-picker-inp" class="tag-picker-inp" placeholder="Search or create tag..." />
    <div id="tag-picker-list" class="tag-picker-list"></div>
    <div class="tag-picker-footer">
      <button class="btn btn-outline" id="tag-picker-close-btn"
        style="width:100%;font-size:0.78rem;padding:5px">Done</button>
    </div>
  </div>
</div>

<!-- Image Tag Manager Modal -->
<div class="modal-overlay" id="img-tag-modal">
  <div class="modal-content tag-modal-content">
    <div class="modal-header">
      <span>Image Tags</span>
      <button class="close-btn" id="img-tag-close-x">&#10005;</button>
    </div>
    <div style="padding:10px 12px; border-bottom:1px solid var(--border)">
      <div class="panel-manage-label" style="margin-bottom:6px">Current Image</div>
      <div id="img-tag-current-list" class="panel-list" style="max-height:180px"></div>
    </div>
    <div style="padding:10px 12px; border-bottom:1px solid var(--border)">
      <div class="panel-manage-label" style="margin-bottom:6px">Create Tag</div>
      <div style="display:flex; gap:6px">
        <input type="text" id="img-tag-new-name" class="tag-picker-inp" placeholder="New tag name..."
          style="border:1px solid var(--border2); border-radius:6px; padding:7px 9px" />
        <button class="btn btn-primary" id="img-tag-add-btn" style="padding:6px 10px">Add</button>
      </div>
    </div>
    <div style="padding:10px 12px">
      <div class="panel-manage-label" style="margin-bottom:6px">Manage Tags</div>
      <div id="img-tag-manage-list" class="panel-list" style="max-height:190px"></div>
    </div>
    <div class="tag-picker-footer">
      <button class="btn btn-outline" id="img-tag-close-btn"
        style="width:100%;font-size:0.78rem;padding:5px">Done</button>
    </div>
  </div>
</div>
```
