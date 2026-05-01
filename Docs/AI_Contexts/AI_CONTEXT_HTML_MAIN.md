# HTML - Main Index + Modals
Consolidated code context for AI assistants.


## File: `templates/index.html`
```html
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Trading Journal" />
  <meta name="mobile-web-app-capable" content="yes" />
  <title>Trading Journal</title>
  <link rel="stylesheet" href="/static/css/style-base.css?v={{ cache_bust }}" />
  <!-- Gallery CSS: non-blocking load (media=print trick) — applies before gallery first opens -->
  <link rel="stylesheet" href="/static/css/style-gallery-a.css?v={{ cache_bust }}" media="print" onload="this.media='all'" />
  <link rel="stylesheet" href="/static/css/style-gallery-b.css?v={{ cache_bust }}" media="print" onload="this.media='all'" />
  <link rel="stylesheet" href="/static/css/style-gallery-split.css?v={{ cache_bust }}" media="print" onload="this.media='all'" />
  <link rel="stylesheet" href="/static/css/style-gallery-c.css?v={{ cache_bust }}" media="print" onload="this.media='all'" />
  <link rel="stylesheet" href="/static/css/style-gallery-d.css?v={{ cache_bust }}" media="print" onload="this.media='all'" />
  <link rel="stylesheet" href="/static/css/style-gallery-grid.css?v={{ cache_bust }}" media="print" onload="this.media='all'" />
  <noscript>
    <link rel="stylesheet" href="/static/css/style-gallery-a.css?v={{ cache_bust }}" />
    <link rel="stylesheet" href="/static/css/style-gallery-b.css?v={{ cache_bust }}" />
    <link rel="stylesheet" href="/static/css/style-gallery-split.css?v={{ cache_bust }}" />
    <link rel="stylesheet" href="/static/css/style-gallery-c.css?v={{ cache_bust }}" />
    <link rel="stylesheet" href="/static/css/style-gallery-d.css?v={{ cache_bust }}" />
    <link rel="stylesheet" href="/static/css/style-gallery-grid.css?v={{ cache_bust }}" />
  </noscript>
  <link rel="stylesheet" href="/static/css/style-misc.css?v={{ cache_bust }}" />
  <link rel="stylesheet" href="/static/css/style-misc-tags.css?v={{ cache_bust }}" />
  <link rel="stylesheet" href="/static/css/style-ohlc-manager.css?v={{ cache_bust }}" />
  <link rel="stylesheet" href="/static/css/style-csvlog.css?v={{ cache_bust }}" />
  <link rel="stylesheet" href="/static/css/style-csvlog-charts.css?v={{ cache_bust }}" />
  <link rel="stylesheet" href="/static/css/style-trade.css?v={{ cache_bust }}" />
  <link rel="stylesheet" href="/static/css/style-mobile.css?v={{ cache_bust }}" />
  <link rel="stylesheet" href="/static/css/style-fullscreen.css?v={{ cache_bust }}" />
  <link rel="stylesheet" href="/static/css/style-trade-sidebar.css?v={{ cache_bust }}" />
</head>

<body>

  <!-- ── Loading overlay — visible until first render() completes ── -->
  <div id="app-loading-overlay">
    <div class="alo-inner">
      <img src="/static/img/logo.png" class="alo-logo" alt="logo" />
      <div class="alo-spinner"></div>
      <span class="alo-text">Loading…</span>
    </div>
  </div>

  <!-- HEADER -->
  <header class="app-header">
    <div class="logo">
      <div class="logo-icon-wrap">
        <img src="/static/img/logo.png" class="logo-icon-img" alt="logo" />
      </div>
      <span class="logo-text">Trading Journal</span>
    </div>

    <div class="calendar-nav global-date-nav">
      <!-- Compact period picker: click to expand month/year selects -->
      <div class="nav-period-wrap" id="nav-period-wrap">
        <button class="nav-period-btn" id="nav-period-btn" title="Select month / year">Apr 2026 ▾</button>
        <div class="nav-period-panel" id="nav-period-panel">
          <select id="glob-month" class="select-box"></select>
          <select id="glob-year" class="select-box"></select>
          <!-- hidden view select kept for JS compatibility -->
          <select id="glob-view" style="display:none">
            <option value="month" selected>Month</option>
            <option value="year">Year</option>
          </select>
        </div>
      </div>

      <!-- Month / Year view toggle -->
      <button class="nav-view-toggle" id="nav-view-toggle" title="Toggle Month / Year view">Month</button>

      <!-- Date range toggle -->
      <button class="nav-range-toggle" id="nav-range-toggle" title="Date range filter">📅</button>
      <div class="nav-range-row" id="nav-range-row">
        <input type="date" id="glob-date-from" class="select-box date-range-input" title="From date" />
        <span class="date-range-sep">&#8212;</span>
        <input type="date" id="glob-date-to" class="select-box date-range-input" title="To date" />
        <button class="btn btn-outline date-range-clear" id="glob-date-clear" title="Clear date filter" style="display:none;">&#10005;</button>
      </div>
    </div>

    <div class="header-actions">
      <!-- Hidden: kept for JS compatibility -->
      <button id="calendar-mode-btn" style="display:none">Consolidated</button>
      <button id="broker-filter-btn-top" style="display:none">Broker: Both</button>
      <div id="broker-filter-menu-top" style="display:none">
        <button class="broker-filter-item" data-broker="both">Both</button>
        <button class="broker-filter-item" data-broker="zerodha">Zerodha</button>
        <button class="broker-filter-item" data-broker="dhan">Dhan</button>
      </div>

      <!-- Hidden: settings-btn kept for JS that references it -->
      <button id="settings-btn" style="display:none"></button>



      <!-- Hidden inputs kept for JS -->
      <button class="btn btn-outline" id="pdf-import-btn" title="Import PDF Pages as Images" style="display:none;">📄 PDF Import</button>
      <input type="file" id="pdf-import-input" accept=".pdf" style="display:none" />

      {% if current_user.is_authenticated %}
      <div class="profile-menu-wrapper" id="profile-menu-wrapper">
        <button class="profile-avatar-btn" id="profile-avatar-btn">
          <img src="/static/img/logo.png" class="profile-avatar-img" alt="avatar" />
        </button>
        <div class="profile-dropdown" id="profile-dropdown">
          <div class="profile-user-info">
            <img src="/static/img/logo.png" class="profile-user-avatar" alt="avatar" />
            <span class="profile-email">{{ current_user.email }}</span>
          </div>
          <div class="profile-divider"></div>

          <a href="/app-deck" class="profile-menu-item" style="text-decoration:none; color:inherit; background:linear-gradient(135deg,rgba(99,102,241,.15) 0%,rgba(168,85,247,.15) 100%);">✨ Features</a>
          <button class="profile-menu-item" id="tt-manual-btn">🎯 Tracker</button>
          <button class="profile-menu-item" id="strategy-lab-btn">🧪 Strategy Lab</button>
          <a href="/algo-lab" class="profile-menu-item" style="text-decoration:none; color:inherit; background:linear-gradient(135deg,rgba(16,185,129,.15) 0%,rgba(99,102,241,.15) 100%); font-weight:700;">⚡ Algo Lab</a>

          <div class="profile-divider"></div>

          <button class="profile-menu-item" id="pdf-list-btn">🗂️ PDF List</button>
          <button class="profile-menu-item" id="quick-stats-btn">⚡ Quick Stats</button>
          <div class="quote-random-wrap" id="quote-random-wrap">
            <button class="profile-menu-item quote-random-launch-btn" id="quote-random-launch-btn" title="Random quote popup" style="width:100%;">💬 Quote Pop</button>
            <div class="quote-random-panel" id="quote-random-panel">
              <label class="quote-random-toggle">
                <input type="checkbox" id="quote-random-enabled" />
                Auto popup
              </label>
              <div class="quote-random-min-row">
                <span>Min</span>
                <input type="number" id="quote-random-minutes" min="1" max="180" value="15" />
                <span>min</span>
              </div>
            </div>
          </div>

          <div class="profile-divider"></div>

          <button class="profile-menu-item" id="profile-settings-btn">⚙️ Settings</button>
          <button class="profile-menu-item" id="profile-backup-folder-btn">📁 Backup Folder</button>
          <button class="profile-menu-item" id="profile-quote-btn">💬 Quote</button>
          <a href="/updates" id="dev-log-btn" class="profile-menu-item" target="_blank" style="text-decoration:none; color:inherit;">📝 Dev Journal</a>
          <a href="/whatif" class="profile-menu-item" target="_blank" style="text-decoration:none; color:inherit;">📈 What If</a>
          <button class="profile-menu-item" id="fullscreen-btn">⛶ Fullscreen</button>
          <button class="profile-menu-item mobile-view-toggle-btn" id="mobile-view-toggle-btn">📱 Mobile View</button>
          <a href="/mobile/?view=gallery" id="mobile-gallery-btn" class="profile-menu-item" target="_blank" style="text-decoration:none; color:inherit;">📷 Gallery</a>
          <button class="profile-menu-item" id="profile-ohlc-btn">📊 OHLC</button>

          <!-- Broker inline dropdown -->
          <div class="profile-inline-group" id="profile-broker-group">
            <div class="profile-menu-item profile-inline-trigger" id="profile-broker-trigger">
              🏦 Broker
              <span class="pmi-badge" id="profile-broker-badge">Zerodha</span>
              <span class="pmi-arrow" id="profile-broker-arrow">&#9660;</span>
            </div>
            <div class="profile-inline-dropdown" id="profile-broker-dropdown">
              <button class="profile-sub-item broker-filter-item" data-broker="both">Both</button>
              <button class="profile-sub-item broker-filter-item" data-broker="zerodha">Zerodha</button>
              <button class="profile-sub-item broker-filter-item" data-broker="dhan">Dhan</button>
            </div>
          </div>

          <!-- View inline dropdown -->
          <div class="profile-inline-group" id="profile-view-group">
            <div class="profile-menu-item profile-inline-trigger" id="profile-view-trigger">
              👁️ View
              <span class="pmi-badge" id="profile-view-badge">Consolidated</span>
              <span class="pmi-arrow" id="profile-view-arrow">&#9660;</span>
            </div>
            <div class="profile-inline-dropdown" id="profile-view-dropdown">
              <button class="profile-sub-item profile-view-item" data-view="consolidated">Consolidated</button>
              <button class="profile-sub-item profile-view-item" data-view="individual">Individual</button>
            </div>
          </div>

          <div class="profile-divider"></div>
          <a href="{{ url_for('auth.logout') }}" class="profile-menu-item profile-signout">↩ Sign Out</a>
        </div>
      </div>
      {% endif %}
    </div>
  </header>

  <main class="app-main">

    <!-- â”€â”€ CALENDAR SECTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
    <section class="section calendar-section">
      <div class="section-header" style="justify-content: flex-end;">
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

    <!-- â”€â”€ DASHBOARD SUMMARY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
    <section class="section dashboard-section" style="display:none;"></section>

    <!-- â”€â”€ TRADE TABLE SECTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ -->
    <section class="section table-section">
      <div class="section-header">
        <h2 class="section-title">Trade Table</h2>
        <div class="table-header-actions">

          <button class="btn btn-outline" id="table-tt-btn" title="Open Target Tracker">🎯 Tracker</button>

          <a href="/log" target="_blank" class="btn btn-outline" id="log-plus-btn" title="Trade Log+ — spreadsheet view with manual annotations" style="text-decoration:none">📋 Log+</a>

          <button class="btn btn-outline" id="csvlog-toolbar-btn" title="CSVLog — checklist form for current date">&#128202; CSVLog</button>
          <button class="btn btn-outline" id="csvlog-charts-toolbar-btn" title="Logger charts from CSVLog data">&#128200; Logger Charts</button>
          <button class="btn btn-outline" id="trade-review-toolbar-btn" title="Trade Review for current date">&#128202; Review</button>
          <button class="btn btn-outline" id="trade-logger-toolbar-btn" title="Trade Logger for current date">&#128221; Logger</button>

          <!-- Options dropdown: Note / Columns / Views / Tags / Filter / +Add -->
          <div class="dropdown-wrapper" id="table-options-wrapper">
            <button class="btn btn-outline" id="table-options-btn">&#9881; Options &#9660;</button>
            <div class="dropdown-menu tbl-opts-panel" id="table-options-panel">
              <button class="dropdown-item" id="note-col-toggle-btn">&#128203; Note</button>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item" id="col-vis-btn">Columns &#8599;</button>
              <button class="dropdown-item" id="view-preset-btn">&#128204; Views &#8599;</button>
              <button class="dropdown-item" id="tag-filter-btn">&#127991; Tags &#8599;</button>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item" id="filter-toggle-btn">&#9906; Filter</button>
              <button class="dropdown-item" id="add-dropdown-btn">+ Add &#8599;</button>
            </div>
          </div>

          <!-- Sub-panels: fixed-position popups (outside dropdown) -->
          <div id="col-vis-wrapper" style="display:none"></div>
          <div class="dropdown-menu tbl-sub-popup col-vis-panel" id="col-vis-panel">
            <p class="panel-hint" style="margin:8px">Import Excel first</p>
          </div>
          <div id="view-preset-wrapper" style="display:none"></div>
          <div class="dropdown-menu tbl-sub-popup" id="view-preset-panel" style="min-width:200px;">
            <button class="dropdown-item" id="save-view-btn">&#128190; Save Current View</button>
            <div class="dropdown-divider"></div>
            <div id="saved-views-list"></div>
          </div>
          <div class="dropdown-menu tbl-sub-popup tag-filter-panel" id="tag-filter-panel">
            <p class="panel-hint" style="padding:10px 8px">No tags yet.<br>Add via Tags column.</p>
          </div>
          <div class="dropdown-menu tbl-sub-popup" id="add-dropdown-menu">
            <button class="dropdown-item" id="add-row-btn">+ Add Row</button>
            <button class="dropdown-item" id="add-tag-col-btn">+ Add Tag Column</button>
            <button class="dropdown-item" id="add-col-btn">+ Add Column</button>
            <button class="dropdown-item" id="edit-col-btn">&#9998; Edit Column</button>
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
              <button class="dropdown-item" id="export-logger-excel-btn">&#8681; Export Logger Excel</button>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item" id="backup-btn">&#128190; Backup (Data + Images)</button>
              <button class="dropdown-item" id="restore-btn">&#8635; Restore from Backup</button>
              <input type="file" id="json-input" accept=".json,.zip" style="display:none" />
              <div class="dropdown-divider" id="live-sync-divider" style="display:none;"></div>
              <button class="dropdown-item" id="pull-from-live-btn" style="display:none; color:var(--green);" title="Live ka data yahan (localhost) pe le aao">&#8659; Live → Localhost (Pull)</button>
              <button class="dropdown-item" id="push-to-live-btn" style="display:none; color:var(--orange, #f0a500);" title="Yahan (localhost) ka data live pe bhejo">&#8657; Localhost → Live (Push)</button>
              <button class="dropdown-item" id="auto-sync-toggle-btn" style="display:none; color:#aaa; font-size:0.85em;" onclick="toggleAutoSync()">⏸ Auto Sync: ON</button>
            </div>
          </div>

          <!-- Live sync status badge — localhost only, hidden on live -->
          <span id="live-sync-dot"
            title="Live sync idle"
            style="display:none; align-items:center; gap:5px; font-size:0.75em; color:#888; cursor:default; user-select:none; padding:0 6px;">
            <span id="live-sync-circle" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#555;flex-shrink:0;"></span>
            <span id="live-sync-label">Sync</span>
          </span>

        </div>
      </div>

      <!-- Active Tag Filter Banner -->
      <div id="active-tag-filter-banner"
        style="display:none; background: rgba(88, 166, 255, 0.15); border: 1px solid var(--blue); color: var(--blue); padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; align-items: center; justify-content: space-between;">
        <span style="font-size: 0.95rem;">
          <span style="opacity:0.8; margin-right:6px;">&#128269; Currently filtering by tag(s):</span>
          <strong id="active-tag-filter-text">None</strong>
        </span>
        <button id="clear-tag-filter-btn"
          style="background:transparent; border:1px solid rgba(88, 166, 255, 0.5); color:var(--blue); padding:4px 10px; border-radius:4px; cursor:pointer;"
          onmouseover="this.style.background='var(--blue)'; this.style.color='#fff';"
          onmouseout="this.style.background='transparent'; this.style.color='var(--blue)';">Clear Filter</button>
      </div>

      <div id="active-tag-filter-stats" style="display:none; text-align:center; font-size: 0.8rem; color: var(--blue); margin-top: -8px; margin-bottom: 12px; opacity: 0.8; font-weight:600;">
        Showing <span id="active-tag-filter-count">0</span> images across the view
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

    {% include "visual_dashboard.html" %}

  </main>

  {% include 'modals.html' %}
  {% include 'gallery.html' %}

  <div class="toast" id="toast"></div>
  <!-- Inline initial data — eliminates /api/trades round-trip on first load -->
  <script>window.__INITIAL_DATA__ = {{ initial_data_json | safe }};</script>
  <!-- Vendor libs (cached independently, always before app code) -->
  <script defer src="/static/js/vendor/jspdf.umd.min.js"></script>
  <script defer src="/static/js/vendor/fabric.min.js"></script>
  <script defer src="/static/js/vendor/apexcharts.min.js"></script>
  <script defer src="/static/js/vendor/lightweight-charts.standalone.production.js"></script>
  <script defer src="/static/js/vendor/pdf.min.js"></script>
  {% if use_bundle %}
  <!-- App bundle (88 modules in one request) -->
  <script defer src="/static/js/bundle.js?v={{ cache_bust }}"></script>
  {% else %}
  <!-- Dev mode: individual files (bundle.js not found — run python build.py) -->
  <script defer src="/static/js/services/apiClient.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/services/tradeService.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/services/imageService.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/services/importService.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/services/exportService.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/services/csvlogService.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/state.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/quotes.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/data.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/data-utils.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/settings.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/dashboard.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/calendar.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/calendar-obs.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-pnl-calendar.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/table-render.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/table-cols.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/table-colops.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/trade-review.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/trade-logger-core.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/trade-logger-render.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-open.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-rubberband.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-render-b.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-render-tray.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-render-thumbs.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-render-thumbs-b.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-ref-cards.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-split-view.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-render.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-grid.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-stats.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-stats-b.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-core.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-image-ops.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-image-ops-b.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-ops.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-ops-group.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-layer.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-nav.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-tags.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-tags-filter.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-data.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-image-manager.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-sync.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-img-tags.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-audio.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/gallery-video.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/annotate-zoom.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/annotate-marquee.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/annotate-tools.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/annotate-canvas.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/annotate-ctx-menu.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/annotate-lifecycle.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/annotate-fabric.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/io.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/csvlog.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/csvlog-img.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/csvlog-fields.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/csvlog-day.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/csvlog-vitals.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/csvlog-placeholder.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/csvlog-charts.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/csvlog-charts-b.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/ohlc-manager.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/tag-pins.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/events-keys.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/events-ui.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/events-gallery-b.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/events-gallery-c.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/events-gallery-d.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/events-gallery.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/events-settings.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/trade-sidebar.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/events.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/sync-live.js?v={{ cache_bust }}"></script>
  <script>
    (function(){
      var isLocal = location.hostname==='localhost'||location.hostname==='127.0.0.1';
      if(!isLocal) return;
      var dot=document.getElementById('live-sync-dot');
      if(dot) dot.style.display='flex';
      var tog=document.getElementById('auto-sync-toggle-btn');
      if(tog) tog.style.display='';
    })();
  </script>
  <script defer src="/static/js/gallery-chart.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/fullscreen-viewer.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/visual-dashboard-stats.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/visual-dashboard.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/visual-dashboard-init.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/visual-dashboard-mtm.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/target-tracker-data.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/target-tracker-monthly.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/target-tracker-weekly.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/target-tracker.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/target-tracker-init.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/pdf-handler.js?v={{ cache_bust }}"></script>
  <script defer src="/static/js/quick-stats.js?v={{ cache_bust }}"></script>
  {% endif %}
</body>

</html>

```

## File: `templates/modals.html`
```html
<!-- ── BACKUP FOLDER MODAL ───────────────── -->
<div class="modal-overlay" id="backup-folder-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:9999; align-items:center; justify-content:center;">
  <div style="background:#1e1e2e; border:1px solid #3b3b5c; border-radius:12px; padding:24px; width:460px; max-width:95vw; box-shadow:0 8px 32px rgba(0,0,0,.5);">
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
      <span style="font-size:1rem; font-weight:700; color:#e2e8f0;">📁 Image Backup Folder</span>
      <button id="backup-folder-close" style="background:none; border:none; color:#94a3b8; font-size:1.2rem; cursor:pointer;">✕</button>
    </div>

    <!-- Stats bar -->
    <div id="backup-stats-box" style="background:#0f0f1a; border:1px solid #3b3b5c; border-radius:8px; padding:12px 14px; margin-bottom:16px; font-size:.82rem;">
      <div style="display:flex; justify-content:space-between; color:#94a3b8; margin-bottom:8px;">
        <span>App images</span><span id="bk-total" style="color:#e2e8f0; font-weight:600;">—</span>
      </div>
      <div style="display:flex; justify-content:space-between; color:#94a3b8; margin-bottom:8px;">
        <span>Backed up</span><span id="bk-done" style="color:#4ade80; font-weight:600;">—</span>
      </div>
      <div style="display:flex; justify-content:space-between; color:#94a3b8; margin-bottom:10px;">
        <span>Missing</span><span id="bk-missing" style="color:#f87171; font-weight:600;">—</span>
      </div>
      <!-- Progress bar -->
      <div style="background:#1e1e3a; border-radius:4px; height:6px; overflow:hidden;">
        <div id="bk-progress-bar" style="height:100%; background:linear-gradient(90deg,#6366f1,#4ade80); width:0%; transition:width .4s;"></div>
      </div>
    </div>

    <p style="color:#94a3b8; font-size:.82rem; margin-bottom:12px; line-height:1.5;">
      Images backup hoti hain: <code style="color:#a5f3fc;">uploaded_imgs/YYYY-MM-DD/T1_file.jpg</code><br>
      Separator move karne ke baad auto-rename hota hai.
    </p>

    <label style="display:block; color:#94a3b8; font-size:.8rem; margin-bottom:6px;">Folder path (full path):</label>
    <input id="backup-folder-input" type="text" placeholder="e.g. G:\My Drive\TradeBackup"
      style="width:100%; box-sizing:border-box; background:#0f0f1a; border:1px solid #3b3b5c; border-radius:8px; padding:10px 12px; color:#e2e8f0; font-size:.9rem; outline:none;" />

    <div style="display:flex; gap:10px; margin-top:14px;">
      <button id="backup-folder-save" style="flex:1; background:#6366f1; border:none; border-radius:8px; padding:10px; color:#fff; font-size:.9rem; font-weight:600; cursor:pointer;">💾 Save</button>
      <button id="backup-sync-btn" style="flex:1; background:#0f4c75; border:1px solid #3b82f6; border-radius:8px; padding:10px; color:#93c5fd; font-size:.9rem; font-weight:600; cursor:pointer;">🔄 Sync All</button>
      <button id="backup-folder-clear" style="background:#3b3b5c; border:none; border-radius:8px; padding:10px 14px; color:#94a3b8; font-size:.85rem; cursor:pointer;">✕</button>
    </div>
    <div id="backup-folder-status" style="margin-top:10px; font-size:.8rem; min-height:18px;"></div>
  </div>
</div>

<!-- ── SETTINGS PANEL ───────────────────── -->
<div class="settings-overlay" id="settings-overlay">
  <div class="settings-panel">
    <div class="settings-resize-handle" id="settings-resize-handle"></div>
    <div class="settings-header">
      <span class="settings-title">&#9881; Settings</span>
      <button class="close-btn" id="settings-close">&#10005;</button>
    </div>
    <div class="settings-body">

      <div class="settings-group">
        <div class="settings-group-title">Calendar — Day Number</div>
        <div class="settings-row">
          <label>Size</label>
          <select class="select-box" id="s-day-size">
            <option value="H1">H1 — 1.4rem</option>
            <option value="H2">H2 — 1.1rem</option>
            <option value="H3" selected>H3 — 0.9rem</option>
            <option value="H4">H4 — 0.75rem</option>
            <option value="H5">H5 — 0.62rem</option>
          </select>
        </div>
        <div class="settings-row">
          <label>Bold</label>
          <input type="checkbox" id="s-day-bold" class="settings-chk" checked />
        </div>
        <div class="settings-row">
          <label>Position</label>
          <select class="select-box" id="s-day-pos">
            <option value="top-left" selected>Top Left</option>
            <option value="top-center">Top Center</option>
            <option value="top-right">Top Right</option>
            <option value="bottom-left">Bottom Left</option>
            <option value="bottom-right">Bottom Right</option>
          </select>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Calendar — Data Text</div>
        <div class="settings-row">
          <label>Size</label>
          <select class="select-box" id="s-data-size">
            <option value="H1">H1 — 1.4rem</option>
            <option value="H2">H2 — 1.1rem</option>
            <option value="H3">H3 — 0.9rem</option>
            <option value="H4" selected>H4 — 0.75rem</option>
            <option value="H5">H5 — 0.62rem</option>
          </select>
        </div>
        <div class="settings-row">
          <label>Bold Values</label>
          <input type="checkbox" id="s-data-bold" class="settings-chk" />
        </div>
        <div class="settings-row">
          <label>Show Labels</label>
          <input type="checkbox" id="s-show-labels" class="settings-chk" checked />
          <span class="settings-hint">e.g. "Profit: 200"</span>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Calendar — Cell</div>
        <div class="settings-row">
          <label>Cell Height</label>
          <select class="select-box" id="s-cell-height">
            <option value="compact">Compact — 70px</option>
            <option value="normal" selected>Normal — 100px</option>
            <option value="spacious">Spacious — 140px</option>
            <option value="roomy">Roomy — 180px</option>
          </select>
        </div>
        <div class="settings-row">
          <label>Sat/Sun Off</label>
          <input type="checkbox" id="s-sat-sun-off" class="settings-chk" checked />
          <span class="settings-hint">True = hide weekend columns in calendar</span>
        </div>
        <div class="settings-row">
          <label>Show Tags in Calendar</label>
          <input type="checkbox" id="s-show-cal-tags" class="settings-chk" />
          <span class="settings-hint">Off by default</span>
        </div>
        <div class="settings-row">
          <label>Show Trade Count</label>
          <input type="checkbox" id="s-show-trade-count" class="settings-chk" />
          <span class="settings-hint">Show total trades per day in calendar</span>
        </div>
        <div class="settings-row">
          <label>Show Trading Day #</label>
          <input type="checkbox" id="s-show-trading-day" class="settings-chk" />
          <span class="settings-hint">Show trading day of month (e.g. TD:1, TD:2)</span>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Table</div>
        <div class="settings-row">
          <label>Visible Rows</label>
          <select class="select-box" id="s-table-rows">
            <option value="5" selected>5 rows</option>
            <option value="8">8 rows</option>
            <option value="10">10 rows</option>
            <option value="12">12 rows</option>
            <option value="15">15 rows</option>
          </select>
        </div>
        <div class="settings-row">
          <label>Row Height</label>
          <button class="s-sz-btn" id="s-row-h-minus">&#9660;</button>
          <span class="s-sz-val" id="s-row-h-val">40</span><span style="font-size:0.75rem;color:var(--text2)">px</span>
          <button class="s-sz-btn" id="s-row-h-plus">&#9650;</button>
        </div>
        <div class="settings-row">
          <label>Table Text</label>
          <select class="select-box" id="s-tbl-font-size">
            <option value="0.72">XS — 0.72rem</option>
            <option value="0.78">S — 0.78rem</option>
            <option value="0.85" selected>M — 0.85rem</option>
            <option value="0.95">L — 0.95rem</option>
            <option value="1.05">XL — 1.05rem</option>
          </select>
        </div>
        <div class="settings-row">
          <label>Group A Color</label>
          <input type="color" id="s-group-a-color" class="settings-chk" value="#58a6ff" />
        </div>
        <div class="settings-row">
          <label>Group B Color</label>
          <input type="color" id="s-group-b-color" class="settings-chk" value="#ffffff" />
        </div>
        <div class="settings-row">
          <label>Separator Color</label>
          <input type="color" id="s-group-sep-color" class="settings-chk" value="#58a6ff" />
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Preview</div>
        <div class="settings-preview">
          <div class="preview-day-num" id="prev-day-num">25</div>
          <div class="preview-data-item">Profit: +1,200</div>
          <div class="preview-data-item">Trade: 3</div>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Gallery View Shortcuts</div>

        <div class="settings-subgroup-title">Navigation</div>
        <div class="settings-row">
          <label>Left / Right</label>
          <span class="settings-hint">Previous / next image</span>
        </div>
        <div class="settings-row">
          <label>Shift + Left/Right</label>
          <span class="settings-hint">Previous / next date</span>
        </div>
        <div class="settings-row">
          <label>&lt; / &gt;</label>
          <span class="settings-hint">Previous / next date (alt keys)</span>
        </div>
        <div class="settings-row">
          <label>Ctrl + Up / Down</label>
          <span class="settings-hint">Navigate between trade blocks</span>
        </div>

        <div class="settings-subgroup-title">View</div>
        <div class="settings-row">
          <label>Reset Zoom</label>
          <input type="text" id="sc-reset-zoom" class="shortcut-input" />
        </div>
        <div class="settings-row">
          <label>Toggle Left Panel</label>
          <input type="text" id="sc-left-panel" class="shortcut-input" />
        </div>
        <div class="settings-row">
          <label>Fullscreen Viewer</label>
          <input type="text" id="sc-fullscreen" class="shortcut-input" />
        </div>
        <div class="settings-row">
          <label>Toggle Show Heads</label>
          <input type="text" id="sc-show-heads" class="shortcut-input" />
        </div>
        <div class="settings-row">
          <label>Toggle Layers Panel</label>
          <input type="text" id="sc-layer-panel" class="shortcut-input" />
        </div>
        <div class="settings-row">
          <label>Date Picker</label>
          <input type="text" id="sc-date" class="shortcut-input" />
        </div>

        <div class="settings-subgroup-title">Images</div>
        <div class="settings-row">
          <label>Import Image</label>
          <input type="text" id="sc-image" class="shortcut-input" />
        </div>
        <div class="settings-row">
          <label>Delete Image</label>
          <input type="text" id="sc-delete-image" class="shortcut-input" />
        </div>
        <div class="settings-row">
          <label>Alt + T</label>
          <span class="settings-hint">Open Image Tag manager</span>
        </div>

        <div class="settings-subgroup-title">Grouping &amp; Selection</div>
        <div class="settings-row">
          <label>Alt + G</label>
          <span class="settings-hint">Group all images</span>
        </div>
        <div class="settings-row">
          <label>Shift + G</label>
          <span class="settings-hint">Ungroup all</span>
        </div>
        <div class="settings-row">
          <label>Ctrl + Left/Right</label>
          <span class="settings-hint">Expand / collapse group</span>
        </div>
        <div class="settings-row">
          <label>Shift + Alt + L/R</label>
          <span class="settings-hint">Select / deselect adjacent tile</span>
        </div>
        <div class="settings-row">
          <label>Ctrl + Shift + L/R</label>
          <span class="settings-hint">Move tile left / right</span>
        </div>
        <div class="settings-row">
          <label>ContextMenu key</label>
          <span class="settings-hint">Open context menu for current thumbnail</span>
        </div>

        <div class="settings-subgroup-title">Annotation Tools</div>
        <div class="settings-row">
          <label>Toggle Annotation</label>
          <input type="text" id="sc-annot-toggle" class="shortcut-input" />
        </div>
        <div class="settings-row">
          <label>Select Tool</label>
          <input type="text" id="sc-select-tool" class="shortcut-input" />
        </div>
        <div class="settings-row">
          <label>Pen</label>
          <input type="text" id="sc-pen" class="shortcut-input" />
        </div>
        <div class="settings-row">
          <label>Eraser</label>
          <input type="text" id="sc-eraser" class="shortcut-input" />
        </div>
        <div class="settings-row">
          <label>Text Tool</label>
          <input type="text" id="sc-text-tool" class="shortcut-input" />
        </div>
        <div class="settings-row">
          <label>Marquee Mode</label>
          <input type="text" id="sc-marquee" class="shortcut-input" />
        </div>
        <div class="settings-row">
          <label>[ / ]</label>
          <span class="settings-hint">Decrease / increase brush size</span>
        </div>
        <div class="settings-row">
          <label>Merge &amp; Save</label>
          <input type="text" id="sc-merge" class="shortcut-input" />
        </div>
        <div class="settings-row">
          <label>Overlay Save</label>
          <input type="text" id="sc-overlay" class="shortcut-input" />
        </div>

        <div class="settings-subgroup-title">Calendar Mode (also works in Gallery)</div>
        <div class="settings-row">
          <label>C</label>
          <span class="settings-hint">Switch to Consolidated mode</span>
        </div>
        <div class="settings-row">
          <label>Shift + C</label>
          <span class="settings-hint">Switch to Individual mode</span>
        </div>

        <div class="settings-row">
          <label>Esc</label>
          <span class="settings-hint">Close popup / stop annotation / exit gallery</span>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Global Shortcuts</div>
        <div class="settings-row">
          <label>F</label>
          <span class="settings-hint">Calendar full-screen (Esc to exit)</span>
        </div>
        <div class="settings-row">
          <label>Shift + F</label>
          <span class="settings-hint">Trade table full-screen (Esc to exit)</span>
        </div>
        <div class="settings-row">
          <label>N</label>
          <span class="settings-hint">Open observation for latest trade date</span>
        </div>
        <div class="settings-row">
          <label>I</label>
          <span class="settings-hint">Open image gallery for latest date with images</span>
        </div>
        <div class="settings-row">
          <label>C</label>
          <span class="settings-hint">Switch to Consolidated calendar mode</span>
        </div>
        <div class="settings-row">
          <label>Shift + C</label>
          <span class="settings-hint">Switch to Individual calendar mode</span>
        </div>
        <div class="settings-row">
          <label>Drag tag chip</label>
          <span class="settings-hint">Move tag to another row (same column)</span>
        </div>
        <div class="settings-row">
          <label>Ctrl + Drag tag chip</label>
          <span class="settings-hint">Copy tag to another row (same column)</span>
        </div>
        <div class="settings-row">
          <label>Drag image thumb</label>
          <span class="settings-hint">Move image to another row</span>
        </div>
        <div class="settings-row">
          <label>Ctrl + Drag image</label>
          <span class="settings-hint">Copy image to another row</span>
        </div>
        <div class="settings-row">
          <label>Esc</label>
          <span class="settings-hint">Close any open modal / popup</span>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Page Layout</div>
        <div class="settings-hint" style="padding:2px 0 8px">Drag to reorder sections on the page</div>
        <div id="section-order-list" class="section-order-list">
          <div class="section-order-item" data-section="calendar" draggable="true"><span
              class="section-order-handle">&#8942;&#8942;</span> Calendar</div>
          <div class="section-order-item" data-section="dashboard" draggable="true"><span
              class="section-order-handle">&#8942;&#8942;</span> Monthly Summary</div>
          <div class="section-order-item" data-section="visual-dashboard" draggable="true"><span
              class="section-order-handle">&#8942;&#8942;</span> Visual Dashboard</div>
          <div class="section-order-item" data-section="table" draggable="true"><span
              class="section-order-handle">&#8942;&#8942;</span> Trade Table</div>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Calendar — Show Heads Defaults</div>
        <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:6px">
          <label style="font-size:0.82rem;color:var(--text2)">Consolidated Mode</label>
          <div style="display:flex;gap:6px">
            <button class="btn btn-outline" id="s-heads-c-plonly" style="font-size:0.74rem;padding:3px 9px">P/L
              Only</button>
            <button class="btn btn-outline" id="s-heads-c-all" style="font-size:0.74rem;padding:3px 9px">Show
              All</button>
            <button class="btn btn-outline" id="s-heads-c-none" style="font-size:0.74rem;padding:3px 9px">Hide
              All</button>
          </div>
        </div>
        <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:6px;margin-top:8px">
          <label style="font-size:0.82rem;color:var(--text2)">Individual Mode</label>
          <div style="display:flex;gap:6px">
            <button class="btn btn-outline" id="s-heads-i-plonly" style="font-size:0.74rem;padding:3px 9px">P/L
              Only</button>
            <button class="btn btn-outline" id="s-heads-i-all" style="font-size:0.74rem;padding:3px 9px">Show
              All</button>
            <button class="btn btn-outline" id="s-heads-i-none" style="font-size:0.74rem;padding:3px 9px">Hide
              All</button>
          </div>
        </div>
      </div>

      <button class="btn btn-primary s-apply-btn" id="s-apply">Apply</button>
      <button class="btn btn-outline s-apply-btn" id="s-reset">Reset to Default</button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="quote-modal">
  <div class="modal-content quote-modal-content">
    <div class="modal-header quote-modal-header">
      <div class="quote-modal-title-wrap">
        <span class="quote-modal-title">Daily Quotes</span>
        <span class="quote-modal-counter" id="quote-modal-counter">1 / 1</span>
      </div>
      <div class="quote-header-tools">
        <div class="quote-tools-menu-wrap">
          <button class="quote-tools-btn" id="quote-tools-btn" title="Quote options">Options &#9662;</button>
          <div class="quote-tools-menu" id="quote-tools-menu">
            <button class="quote-tools-menu-item" id="quote-font-minus" type="button">A-</button>
            <button class="quote-tools-menu-item" id="quote-font-plus" type="button">A+</button>
            <button class="quote-tools-menu-item" id="quote-upload-btn" type="button">&#8679; Upload CSV</button>
            <button class="quote-tools-menu-item primary" id="quote-download-btn" type="button">&#8681; Download CSV</button>
          </div>
        </div>
      </div>
      <button class="close-btn" id="quote-modal-close">&#10005;</button>
    </div>

    <div class="quote-modal-body">
      <div class="quote-card">
        <button class="quote-nav-btn" id="quote-prev-btn" title="Previous quote">&#8592;</button>

        <div class="quote-card-main">
          <div class="quote-mark quote-mark-left">&#10077;</div>
          <div class="quote-text" id="quote-text">Loading quote...</div>
          <div class="quote-mark quote-mark-right">&#10078;</div>

          <div class="quote-actions">
            <button class="btn btn-outline quote-scheduler-inline-btn" id="quote-scheduler-inline-btn">Auto Popup</button>
            <div class="quote-rating-inline">
              <span class="quote-rating-inline-label">Rating</span>
              <input type="range" id="quote-rating-slider" min="1" max="10" step="1" value="5" />
              <span id="quote-rating-value">5 / 10</span>
            </div>
            <input type="file" id="quote-csv-input" accept=".csv,text/csv" style="display:none" />
          </div>
        </div>

        <button class="quote-nav-btn" id="quote-next-btn" title="Next quote">&#8594;</button>
      </div>
    </div>
  </div>
</div>

<!-- ── OBSERVATION MODAL ───────────────────── -->
<div class="modal-overlay" id="obs-modal">
  <div class="modal-content obs-modal-content">

    <!-- Header: date + nav -->
    <div class="modal-header obs-modal-header">
      <div class="obs-date-nav">
        <button class="gallery-date-arrow" id="obs-date-prev" title="Previous">&#8249;</button>
        <span class="obs-modal-date" id="obs-modal-date"></span>
        <button class="gallery-date-arrow" id="obs-date-next" title="Next">&#8250;</button>
        <input type="date" id="obs-date-picker" class="gallery-date-picker" title="Jump to date" />
        <label class="obs-nav-toggle" title="Navigate only dates that have data">
          <input type="checkbox" id="obs-data-only" checked /> Data only
        </label>
      </div>
      <button class="close-btn" id="obs-close">&#10005;</button>
    </div>

    <!-- Toolbar row 1: text formatting -->
    <div class="obs-toolbar">
      <button class="obs-tool" data-cmd="bold" title="Bold"><b>B</b></button>
      <button class="obs-tool" data-cmd="italic" title="Italic"><i>I</i></button>
      <button class="obs-tool" data-cmd="underline" title="Underline"><u>U</u></button>
      <div class="obs-tool-sep"></div>
      <button class="obs-tool" data-cmd="formatBlock" data-val="h1" title="H1">H1</button>
      <button class="obs-tool" data-cmd="formatBlock" data-val="h2" title="H2">H2</button>
      <button class="obs-tool" data-cmd="formatBlock" data-val="h3" title="H3">H3</button>
      <button class="obs-tool" data-cmd="formatBlock" data-val="h4" title="H4">H4</button>
      <button class="obs-tool" data-cmd="formatBlock" data-val="h5" title="H5">H5</button>
      <button class="obs-tool" data-cmd="formatBlock" data-val="p" title="Normal">¶</button>
      <div class="obs-tool-sep"></div>
      <input type="number" id="obs-custom-size" class="obs-size-input" min="6" max="96" placeholder="px"
        title="Custom font size" />
      <button class="obs-tool" id="obs-apply-size" title="Apply size">A↕</button>
      <div class="obs-tool-sep"></div>
      <button class="obs-tool" data-cmd="insertUnorderedList" title="Bullet list">&#8226; List</button>
      <button class="obs-tool" data-cmd="insertOrderedList" title="Numbered list">1. List</button>
      <div class="obs-tool-sep"></div>
      <button class="obs-tool obs-color" data-cmd="foreColor" data-val="#3fb950" title="Green"
        style="color:#3fb950">&#9679;</button>
      <button class="obs-tool obs-color" data-cmd="foreColor" data-val="#f85149" title="Red"
        style="color:#f85149">&#9679;</button>
      <button class="obs-tool obs-color" data-cmd="foreColor" data-val="#58a6ff" title="Blue"
        style="color:#58a6ff">&#9679;</button>
      <button class="obs-tool obs-color" data-cmd="foreColor" data-val="#d29922" title="Orange"
        style="color:#d29922">&#9679;</button>
      <button class="obs-tool obs-color" data-cmd="foreColor" data-val="#bc8cff" title="Purple"
        style="color:#bc8cff">&#9679;</button>
      <div class="obs-tool-sep"></div>
      <button class="obs-tool" id="obs-insert-img" title="Insert image">&#128247;</button>
      <input type="file" id="obs-img-input" accept="image/*" style="display:none" />
      <button class="obs-tool" id="obs-insert-link" title="Insert link">&#128279;</button>
      <div class="obs-tool-sep"></div>
      <button class="obs-tool" data-cmd="removeFormat" title="Clear formatting">&#10005; Clear</button>
    </div>

    <div class="obs-editor" id="obs-editor" contenteditable="true" spellcheck="false"></div>

    <!-- Per-trade notes (auto-populated from Note column) -->
    <div id="obs-trade-notes" class="obs-trade-notes-wrap"></div>

    <div class="obs-footer">
      <button class="btn btn-outline" id="obs-cancel">Cancel</button>
      <button class="btn btn-primary" id="obs-save">&#10003; Save</button>
    </div>
  </div>
</div>

<!-- ── SHOW HEADS MODAL ───────────────────── -->
<div class="modal-overlay" id="show-heads-modal">
  <div class="modal-content stats-config-content">
    <div class="modal-header">
      <span id="show-heads-modal-title">Show Heads</span>
      <button class="close-btn" id="show-heads-modal-close">&#10005;</button>
    </div>
    <div class="stats-config-body">
      <div class="stats-config-search-row">
        <input type="text" id="show-heads-modal-search" class="panel-search" placeholder="Search columns..." />
      </div>
      <div class="stats-config-act-row">
        <button class="panel-act-btn" id="show-heads-modal-all">All</button>
        <button class="panel-act-btn" id="show-heads-modal-none">None</button>
        <button class="panel-act-btn" id="show-heads-modal-pl">P/L Only</button>
      </div>
      <div id="show-heads-modal-list" class="stats-config-list"></div>
    </div>
    <div class="modal-footer">
      <label class="decimals-toggle">
        <input type="checkbox" id="show-heads-decimals-chk" />
        Show Decimals
      </label>
      <div style="flex:1"></div>
      <button class="btn btn-outline" id="show-heads-modal-cancel">Cancel</button>
      <button class="btn btn-primary" id="show-heads-modal-apply">Apply</button>
    </div>
  </div>
</div>

<!-- ── STATS CONFIG MODAL ─────────────────── -->
<div class="modal-overlay" id="stats-config-modal">
  <div class="modal-content stats-config-content">
    <div class="modal-header">
      <span>Stats Configuration</span>
      <button class="close-btn" id="stats-config-close">&#10005;</button>
    </div>
    <div class="stats-config-body">
      <div class="stats-config-search-row">
        <input type="text" id="stats-config-search" class="panel-search" placeholder="Search stats..." />
      </div>
      <div class="stats-config-act-row">
        <button class="panel-act-btn" id="stats-config-all">All</button>
        <button class="panel-act-btn" id="stats-config-none">None</button>
      </div>
      <div id="stats-config-list" class="stats-config-list"></div>
    </div>
    <div class="modal-footer">
      <label class="decimals-toggle">
        <input type="checkbox" id="stats-decimals-chk" />
        Show Decimals
      </label>
      <div style="flex:1"></div>
      <button class="btn btn-outline" id="stats-config-cancel">Cancel</button>
      <button class="btn btn-primary" id="stats-config-apply">Apply</button>
    </div>
  </div>
</div>

{% include 'modals-ohlc.html' %}
{% include 'modals-target-tracker.html' %}



```
