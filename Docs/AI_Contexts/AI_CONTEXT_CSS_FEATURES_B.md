# CSS - Feature Styles B (ohlc, mobile, whatif)
Consolidated code context for AI assistants.


## File: `static/css/style-ohlc-manager.css`
```css
/* ── OHLC Manager Modal ──────────────────────────────────── */

.ohlc-mgr-section {
  background: var(--surface-1, #161b22);
  border: 1px solid var(--border, #30363d);
  border-radius: 8px;
  padding: 14px 16px;
}

.ohlc-mgr-section-title {
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted, #8b949e);
  margin-bottom: 10px;
}

.ohlc-mgr-hint {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  font-size: 0.75rem;
  opacity: 0.6;
  margin-left: 8px;
}

/* Credentials */
.ohlc-cred-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  min-height: 28px;
}

.ohlc-cred-ok {
  color: var(--green, #3fb950);
  font-weight: 600;
}

.ohlc-cred-age {
  color: var(--text-muted, #8b949e);
  font-size: 0.78rem;
}

.ohlc-cred-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border, #30363d);
}

/* Instruments table */
.ohlc-instruments-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.ohlc-instruments-table th {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border, #30363d);
  color: var(--text-muted, #8b949e);
  font-weight: 600;
  font-size: 0.75rem;
  white-space: nowrap;
}

.ohlc-instruments-table td {
  padding: 5px 10px;
  border-bottom: 1px solid rgba(48, 54, 61, 0.4);
  vertical-align: middle;
}

.ohlc-instruments-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.03);
}

.ohlc-sym-cell {
  font-family: monospace;
  font-size: 0.8rem;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Status dots */
.ohlc-status-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 0.85rem;
  font-weight: 700;
}

.ohlc-status-ok      { background: rgba(63, 185, 80, 0.15); color: var(--green, #3fb950); }
.ohlc-status-partial { background: rgba(210, 153, 34, 0.15); color: #d29922; }
.ohlc-status-missing { background: rgba(248, 81, 73, 0.12); color: var(--red, #f85149); }
.ohlc-status-unmapped{ background: rgba(139, 148, 158, 0.12); color: var(--text-muted, #8b949e); }

/* Sync log */
.ohlc-sync-log {
  background: var(--bg, #0d1117);
  border: 1px solid var(--border, #30363d);
  border-radius: 6px;
  padding: 8px 10px;
  height: 160px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 0.78rem;
  line-height: 1.55;
}

.ohlc-log-line     { color: var(--text, #c9d1d9); }
.ohlc-log-err      { color: var(--red, #f85149); }

/* btn-sm helper (reuse what exists, add if missing) */
.btn-sm {
  padding: 4px 10px !important;
  font-size: 0.78rem !important;
}

```

## File: `static/css/style-mobile.css`
```css
/* ── MOBILE & TOUCH RESPONSIVE ───────────────────
   Applies on top of all other stylesheets.
   Breakpoints:
     ≤ 900px  — tablet / small laptop
     ≤ 768px  — phone landscape / small tablet
     ≤ 480px  — phone portrait
   Touch targets: pointer:coarse rule bumps up hit areas
   ─────────────────────────────────────────────── */

/* ── TOUCH TARGET SIZES ───────────────────────── */
/* Only applied on actual touch devices */
@media (hover: none) and (pointer: coarse) {
  .btn {
    min-height: 44px;
    padding: 10px 16px;
  }

  .nav-arrow {
    width: 44px;
    height: 44px;
    font-size: 1.5rem;
  }

  .select-box {
    min-height: 44px;
    padding: 8px 12px;
    font-size: 1rem;
  }

  .dropdown-item {
    padding: 13px 16px;
    min-height: 44px;
    font-size: 0.95rem;
  }

  .head-checkbox {
    padding: 9px 0;
  }

  .head-checkbox input[type="checkbox"] {
    width: 20px;
    height: 20px;
  }

  .settings-chk {
    width: 20px;
    height: 20px;
  }

  /* Bigger tap area for calendar day pencil */
  .day-pencil {
    opacity: 0.6;
    padding: 6px 7px;
    font-size: 0.8rem;
  }

  /* Always show delete buttons (no hover on touch) */
  tr .del-row-mini,
  tr .delete-row-btn,
  tr .row-drag-handle {
    color: var(--text2);
    opacity: 0.7;
  }

  .img-thumb-wrap .img-thumb-del {
    opacity: 1;
  }

  .col-del-btn {
    opacity: 1;
    pointer-events: auto;
  }

  /* Tag chip bigger on touch */
  .tag-chip {
    padding: 5px 10px;
    font-size: 0.8rem;
  }

  .tag-add-btn {
    padding: 5px 12px;
    font-size: 0.8rem;
  }

  /* Day tag bubbles */
  .day-tag-bubble {
    padding: 3px 8px;
    font-size: 0.7rem;
  }

  /* Note popup tools */
  .note-popup-tool {
    padding: 6px 10px;
    min-height: 36px;
  }

  /* Shortcut inputs usable on touch */
  .shortcut-input {
    min-height: 44px;
    font-size: 1rem;
  }
}

@media (max-width: 768px) {
  /* HEADER DATE RANGE → SHOW ON MOBILE (scrollable) */
  /* Un-hide date inputs on mobile but put them in the scrollable nav row */
  #glob-date-from,
  #glob-date-to,
  .date-range-sep {
    display: inline-flex !important;
    flex-shrink: 0;
  }

  /* Divider still hidden (saves space) */
  .global-date-divider {
    display: none !important;
  }

  /* Date inputs narrower on mobile */
  .date-range-input {
    width: 100px;
    font-size: 0.75rem;
    padding: 4px 2px 4px 4px;
  }
}

/* ── Organized Grid Tablet/Mobile Specifics ── */
@media (max-width: 1100px) {
  .gv2-modal.grid-open .gv2-tray-center > *:not(#gv2-imgtype-dropdown-btn):not(.gv2-tray-sep-mobile) {
    display: none !important;
  }
  .gv2-modal.grid-open .gv2-tray-center {
    display: flex !important;
    min-width: unset !important;
    max-width: unset !important;
  }
}

.gv2-grid-only {
  display: none;
}
.gv2-modal.grid-open .gv2-grid-only {
  display: flex !important;
}

/* ── GALLERY TRAY MOBILE SWIPE ────────────────── */
@media (max-width: 768px) {
  /* Single scrollable row instead of wrapping */
  .gv2-tray {
    flex-wrap: nowrap !important;
    overflow-x: auto;
    overflow-y: visible;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    gap: 4px;
    padding: 6px 8px;
    overscroll-behavior: contain;
  }

  .gv2-tray::-webkit-scrollbar {
    display: none;
  }

  /* Left section: no shrink */
  .gv2-tray-left {
    flex-shrink: 0;
    gap: 4px;
  }

  /* Button group: no shrink, no wrap */
  .gv2-tray-btns {
    flex-wrap: nowrap;
    flex-shrink: 0;
    gap: 4px;
  }

  /* Right section: no shrink, no auto-margin */
  .gv2-tray-right {
    margin-left: 0;
    flex-shrink: 0;
    gap: 6px;
  }

  /* Hide zoom hint text (saves space) */
  .gv2-zoom-hint {
    display: none;
  }

  /* Gallery close button: bigger touch target */
  .gv2-close-btn {
    min-width: 44px;
    min-height: 44px;
    font-size: 1.2rem;
  }

  /* Gallery tray buttons: bigger touch target */
  .gv2-tray-btn {
    min-height: 36px;
    padding: 6px 10px;
    font-size: 0.8rem;
  }

  /* Date arrows bigger */
  .gv2-date-arrow {
    min-width: 36px;
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
}

/* ── TABLET / LANDSCAPE PHONE (≤ 900px) ──────── */
@media (max-width: 900px) {
  .app-main {
    padding: 14px 16px;
    gap: 14px;
  }

  .dashboard-grid {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;
  }
}

@media (max-width: 1100px) {
  /* Condensed Gallery V2 UI for iPad resolution */
  .gv2-unified-left-panel.open {
    width: 180px !important; 
  }

  /* Allow the center to maintain focus and prevent squashing */
  .gv2-center {
    min-width: 300px !important;
  }

  /* ── GALLERY TRAY — iPad compact grid ── */
  .gv2-tray {
    top: 0 !important;
    height: calc(46px + env(safe-area-inset-top, 0px)) !important;
    padding: 0 4px !important;
    padding-top: env(safe-area-inset-top, 0px) !important;
    padding-left: max(4px, env(safe-area-inset-left, 4px)) !important;
    padding-right: max(4px, env(safe-area-inset-right, 4px)) !important;
    grid-template-columns: auto 170px 1fr auto auto !important;
  }

  /* Col 2: narrower on tablet */
  .gv2-tc2 {
    width: 170px !important;
    gap: 3px !important;
    font-size: 0.85rem;
  }

  /* Col 4: tighten icon gaps */
  .gv2-tc4 {
    gap: 2px !important;
    padding: 0 3px !important;
  }

  /* Col 5: tighten */
  .gv2-tc5 {
    gap: 4px !important;
    padding: 0 2px 0 3px !important;
  }

  /* P&L pill only — trade pill stays desktop size */
  .gv2-pnl-pill {
    padding: 4px 10px !important;
    font-size: 0.82rem !important;
  }

  /* Col 4 icon buttons — smaller padding on tablet */
  .gv2-tc4 .gv2-target-pill {
    padding: 0 8px !important;
    height: 30px !important;
  }

  /* Hamburger compact */
  .gv2-hamburger-btn {
    width: 30px !important;
    height: 30px !important;
  }

  /* Date nav arrows — bigger touch targets on iPad */
  .gv2-date-nav-btn {
    width: 38px !important;
    min-width: 38px !important;
    font-size: 1.4rem !important;
  }

  /* Date pill height match */
  .gv2-date-nav-pill {
    height: 34px !important;
  }
}

/* ── SMALL TABLET / LARGE PHONE (≤ 768px) ─────── */
@media (max-width: 768px) {

  /* Header: wrap into two rows */
  .app-header {
    flex-wrap: wrap;
    padding: 8px 10px;
    gap: 6px;
    row-gap: 6px;
  }

  /* Logo stays on row 1 left */
  .logo {
    flex: 1;
    font-size: 1rem;
  }

  /* Actions stay on row 1 right */
  .header-actions {
    flex-shrink: 0;
    gap: 5px;
  }

  /* Calendar nav drops to row 2, full width */
  .global-date-nav {
    order: 10;
    flex-basis: 100%;
    width: 100%;
    padding-bottom: 2px;
  }

  /* date range inputs handled in the block above — divider stays hidden */
  .global-date-divider {
    display: none !important;
  }

  /* Dev log button */
  #dev-log-btn {
    padding: 7px 10px;
    font-size: 0.82rem;
  }

  /* Consolidated button — icon only */
  #calendar-mode-btn {
    font-size: 0;
    padding: 7px 10px;
  }
  #calendar-mode-btn::before {
    content: "\1F4CA";
    font-size: 0.95rem;
    line-height: 1;
  }

  /* Broker filter btn shorter */
  #broker-filter-btn-top {
    font-size: 0;
    padding: 7px 10px;
  }
  #broker-filter-btn-top::before {
    content: "\1F3E6";
    font-size: 0.95rem;
    line-height: 1;
  }

  /* Settings btn — icon only */
  #settings-btn {
    font-size: 0;
    padding: 7px 10px;
  }
  #settings-btn::before {
    content: "\2699\FE0F";
    font-size: 0.95rem;
    line-height: 1;
  }

  /* Smaller calendar */
  :root {
    --cal-cell-height: 72px;
    --cal-day-size: 0.8rem;
    --cal-data-size: 0.68rem;
  }

  .calendar-container {
    padding: 8px 10px 12px;
  }

  .app-main {
    padding: 10px;
    gap: 10px;
  }

  .section-header {
    padding: 10px 12px;
  }

  .dashboard-grid {
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    padding: 10px 12px 12px;
    gap: 8px;
  }

  /* Table header actions: horizontal scroll instead of wrap */
  .table-header-actions {
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: visible;
    padding-bottom: 4px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    gap: 5px;
  }

  .table-header-actions::-webkit-scrollbar {
    display: none;
  }

  /* Settings panel full width on mobile */
  .settings-panel {
    width: 100vw;
    max-width: 100vw;
  }

  /* Dropdown menus position fix on mobile */
  .dropdown-menu {
    right: auto;
    left: 0;
  }

  .quote-modal-body {
    padding: 14px;
  }

  .quote-card {
    grid-template-columns: 1fr;
  }

  .quote-nav-btn {
    min-height: 42px;
  }

  .quote-text {
    min-height: 110px;
    padding-top: 18px;
  }

  .quote-header-tools {
    margin-right: 0;
  }

  .quote-tools-menu {
    right: 0;
    left: auto;
    min-width: 160px;
  }

  .quote-modal-header {
    gap: 8px;
    flex-wrap: wrap;
  }

  .quote-scheduler-inline-btn {
    margin-right: 0;
  }

  .quote-rating-inline {
    min-width: 100%;
    order: 2;
  }

  /* But right-aligned ones (from right side of screen) stay right */
  #file-dropdown-menu,
  #add-dropdown-menu,
  #view-preset-panel,
  #tag-filter-panel,
  #col-vis-panel,
  #broker-filter-menu-top,
  #dashboard-stats-menu {
    right: 0;
    left: auto;
  }
}

/* ── PHONE PORTRAIT (≤ 480px) ─────────────────── */
@media (max-width: 480px) {

  /* Logo: hide text, keep icon */
  .logo-text {
    display: none;
  }

  /* Even smaller calendar cells */
  :root {
    --cal-cell-height: 58px;
    --cal-day-size: 0.72rem;
    --cal-data-size: 0.62rem;
  }

  .app-main {
    padding: 8px;
    gap: 8px;
  }

  .section-header {
    padding: 8px 10px;
    gap: 6px;
  }

  .calendar-weekdays div {
    font-size: 0.58rem;
    letter-spacing: 0;
  }

  .day-cell {
    padding: 4px 3px;
  }

  /* Dashboard: 2 columns fixed on phone */
  .dashboard-grid {
    grid-template-columns: repeat(2, 1fr);
    padding: 8px;
    gap: 6px;
  }

  .dash-card {
    padding: 10px 8px 8px;
  }

  .dash-value {
    font-size: 0.95rem;
  }

  .quote-modal-content {
    width: 96vw;
  }

  .quote-card-main {
    padding: 24px 14px 16px;
  }

  .quote-text {
    font-size: 1rem;
  }

  /* Table section header stacks */
  .table-section .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  /* Table header actions scrollable row */
  .table-header-actions {
    width: 100%;
  }

  /* Active tag filter banner — stack */
  #active-tag-filter-banner {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start !important;
  }

  /* Note popup full width */
  .note-popup {
    width: calc(100vw - 24px);
    left: 12px !important;
    right: 12px !important;
  }

  /* Yearly view: 2 columns */
  .calendar-yearly {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    padding: 10px;
  }

  /* Toast: full bottom bar */
  .toast {
    left: 12px;
    right: 12px;
    bottom: 16px;
    text-align: center;
  }

  /* Modals full width */
  .upload-modal-content {
    width: calc(100vw - 24px);
  }
}

/* ── TRADE LOGGER / REVIEW POPUP → FULL SCREEN ── */
@media (max-width: 768px) {
  /* Backdrop: no centering, just fill screen */
  .tr-backdrop {
    align-items: stretch;
    justify-content: stretch;
    padding: 0;
  }

  /* Both trade-review and trade-logger become full-screen */
  .tr-modal,
  .tl-modal {
    width: 100vw !important;
    max-width: 100vw !important;
    height: 100vh !important;
    max-height: 100vh !important;
    border-radius: 0 !important;
    border: none !important;
    margin: 0 !important;
    flex: 1;
  }

  /* Close button: big enough to tap */
  .tr-close,
  .tl-modal .tr-close {
    min-width: 44px !important;
    min-height: 44px !important;
    font-size: 1.4rem !important;
    padding: 0 12px !important;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Header fonts smaller on phone */
  .tl-modal .tr-hdr-title {
    font-size: 1.2rem !important;
  }

  .tl-modal .tr-date-label {
    font-size: 1.1rem !important;
    min-width: auto !important;
  }

  /* Tabs scroll horizontally */
  .tl-modal .tr-tabs,
  .tr-tabs {
    overflow-x: auto;
    flex-wrap: nowrap !important;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .tl-modal .tr-tabs::-webkit-scrollbar {
    display: none;
  }

  /* Logger grids: 2 columns on phone (was 3-4) */
  .tl-grid-4 {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 8px !important;
  }

  .tl-grid-3 {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 8px !important;
  }
}

@media (max-width: 480px) {
  /* Very small phones: single column */
  .tl-grid-4,
  .tl-grid-3 {
    grid-template-columns: 1fr !important;
  }
}

/* ── VISUAL DASHBOARD CHARTS → 2-COLUMN (iPad / tablet 769–1200px) ──── */
@media (min-width: 769px) and (max-width: 1200px) {
  /* Switch from 6-column to 2-column grid */
  #vd-charts-grid {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 14px !important;
  }

  /* Each card takes one column (half the grid = ~50% width) */
  #vd-charts-grid .dash-card {
    grid-column: span 1 !important;
  }

  /* Width selector irrelevant at this breakpoint */
  .vd-width-select {
    display: none !important;
  }

  /* Chart label row wraps to avoid overflow */
  .dash-label.vd-drag-handle {
    flex-wrap: wrap;
    gap: 4px;
  }
}

/* ── VISUAL DASHBOARD CHARTS → SINGLE COLUMN (mobile ≤768px) ──── */
@media (max-width: 768px) {
  /* Override inline grid-template-columns on the charts grid */
  #vd-charts-grid {
    grid-template-columns: 1fr !important;
    gap: 12px !important;
  }

  /* Each chart card spans full width regardless of data-vd default */
  #vd-charts-grid .dash-card {
    grid-column: 1 / -1 !important;
  }

  /* Hide the width selector on mobile (irrelevant) */
  .vd-width-select {
    display: none !important;
  }

  /* Chart label row wrap on mobile */
  .dash-label.vd-drag-handle {
    flex-wrap: wrap;
    gap: 4px;
  }

  /* Visual dashboard outer wrapper padding */
  .visual-dash-wrapper {
    padding: 10px !important;
  }
}

/* ── TABLE FROZEN COLUMNS → DISABLE ON MOBILE ──── */
/* On small screens, frozen (sticky) cols eat up too much
   visible width — let all columns scroll freely */
@media (max-width: 768px) {
  .frozen-col,
  .trade-table th.frozen-col,
  .trade-table th.row-drag-th,
  .trade-table th.sortable-th.frozen-col {
    position: relative !important;
    left: auto !important;
    z-index: auto !important;
  }

  /* tfoot sticky stays (shows totals) */
  .trade-table tfoot td {
    position: sticky;
    bottom: 0;
    z-index: 9;
  }

  /* thead stays sticky top */
  .trade-table thead {
    position: sticky;
    top: 0;
    z-index: 10;
  }
}

/* ── DROPDOWN → BOTTOM SHEET ON MOBILE ───────── */
/* Fixes overflow-clipping issue AND improves usability */
@media (max-width: 768px) {
  /* All dropdown menus become bottom sheets */
  .dropdown-menu {
    display: block !important;   /* always block — transition requires non-none */
    position: fixed !important;
    bottom: -105% !important;    /* hidden below viewport until .open */
    left: 0 !important;
    right: 0 !important;
    top: auto !important;
    width: 100% !important;
    min-width: unset !important;
    max-height: 65vh !important;
    overflow-y: auto !important;
    border-radius: 16px 16px 0 0 !important;
    border: none !important;
    border-top: 1px solid var(--border2) !important;
    z-index: 8000 !important;
    transition: bottom 0.28s cubic-bezier(.4, 0, .2, 1) !important;
    padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));
    box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.6) !important;
    pointer-events: none;        /* can't click while hidden */
  }

  .dropdown-menu.open {
    bottom: 0 !important;
    pointer-events: auto !important;
  }

  /* Bigger items in bottom sheet */
  .dropdown-item {
    padding: 14px 20px !important;
    font-size: 0.95rem !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .dropdown-divider {
    height: 6px;
    background: var(--bg);
    margin: 0;
  }

  /* Bottom sheet drag handle indicator */
  .dropdown-menu::before {
    content: '';
    display: block;
    width: 40px;
    height: 4px;
    background: var(--border2);
    border-radius: 2px;
    margin: 10px auto 12px;
  }

  /* Column visibility panel in bottom sheet */
  .col-vis-panel {
    max-height: 60vh !important;
    overflow-y: auto !important;
    padding: 0 16px 16px !important;
  }

  /* Tag filter panel in bottom sheet */
  .tag-filter-panel {
    padding: 0 16px 16px !important;
  }

  /* View preset panel */
  #view-preset-panel {
    min-width: unset !important;
    padding: 0 8px 8px !important;
  }

  /* Show heads panel — also bottom sheet */
  .show-heads-panel {
    position: fixed !important;
    bottom: -105%;
    left: 0 !important;
    right: 0 !important;
    top: auto !important;
    width: 100% !important;
    max-height: 65vh;
    overflow-y: auto;
    border-radius: 16px 16px 0 0;
    border-top: 1px solid var(--border2);
    z-index: 8000;
    transition: bottom 0.28s cubic-bezier(.4, 0, .2, 1);
    padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));
    box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.6);
  }

  .show-heads-panel.open {
    bottom: 0;
    display: block;
  }

  .show-heads-panel::before {
    content: '';
    display: block;
    width: 40px;
    height: 4px;
    background: var(--border2);
    border-radius: 2px;
    margin: 10px auto 12px;
  }
}

/* ── PREVENT TEXT ZOOM ON INPUT FOCUS (iOS) ────── */
@media (max-width: 768px) {
  input,
  select,
  textarea {
    font-size: max(16px, 0.875rem);
  }

  .cell-input,
  .filter-input,
  .col-name-input,
  .tag-picker-inp,
  .panel-search,
  .note-popup-editor,
  .obs-trade-note-editor {
    font-size: 16px;
  }
}

/* ──────── IMAGE TYPE DROPDOWN (Pill to Dropdown change) ──────── */
.gv2-imgtype-dropdown-btn {
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 4px 14px;
  color: var(--text);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  height: 32px;
  min-width: 80px;
  justify-content: space-between;
}
.gv2-imgtype-dropdown-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--text3);
}
.gv2-imgtype-menu {
  min-width: 160px;
  background: rgba(15, 15, 20, 0.98);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.6);
  z-index: 1000;
}
.gv2-imgtype-menu .dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.85rem;
  color: var(--text2);
  width: 100%;
}
.gv2-imgtype-menu .dropdown-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}
.gv2-imgtype-menu .dropdown-item.active {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  font-weight: 700;
}
.gv2-imgtype-menu .gv2-di-icon {
  font-size: 1.1rem;
}

@media (max-width: 768px) {
  .gv2-imgtype-dropdown-btn {
    padding: 3px 10px;
    font-size: 0.78rem;
    height: 28px;
  }
}

/* ──────── GRID MENU SECTION STYLES ──────── */
.gv2-grid-menu-section {
  padding: 8px 12px;
}
.gv2-grid-menu-label {
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text3);
  letter-spacing: 1px;
  margin-bottom: 6px;
  opacity: 0.7;
}
.gv2-tray-mobile-controls {
  display: block;
}

.gv2-tray-mobile-controls {
  display: block;
}

/* ──────── RESTORED PILL STYLES FOR NORMAL TRAY ──────── */
.gv2-imgtype-pills {
  display: flex !important;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 3px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  gap: 2px;
}
.gv2-imgtype-pills .gv2-imgtype-btn {
  border: none !important;
  background: transparent !important;
  padding: 6px 16px !important;
  font-size: 0.8rem !important;
  border-radius: 9px !important;
  color: var(--text3) !important;
  cursor: pointer;
  height: auto !important;
  line-height: normal !important;
}
.gv2-imgtype-pills .gv2-imgtype-btn.active {
  background: var(--blue) !important;
  color: #fff !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

```

## File: `static/css/style-whatif.css`
```css

    /* ── Layout ─────────────────────────────────────────────── */
    .wi-wrap   { max-width: 1200px; margin: 0 auto; padding: 24px 16px 60px; }
    .wi-header { display:flex; align-items:center; gap:12px; margin-bottom:24px; }
    .wi-header h1 { font-size:1.4rem; font-weight:700; }
    .wi-back   { background:none; border:1px solid var(--border2); color:var(--text2);
                 padding:6px 12px; border-radius:var(--radius); cursor:pointer; font-size:.85rem; }
    .wi-back:hover { color:var(--text); border-color:var(--blue); }

    /* ── Accordion / Card ───────────────────────────────────── */
    .wi-card { background:var(--surface); border:1px solid var(--border);
               border-radius:var(--radius-lg); margin-bottom:16px; overflow:hidden; }
    .wi-card-head { display:flex; align-items:center; justify-content:space-between;
                    padding:14px 18px; cursor:pointer; user-select:none; }
    .wi-card-head:hover { background:var(--surface2); }
    .wi-card-title { font-weight:600; font-size:.95rem; display:flex; align-items:center; gap:8px; }
    .wi-card-arrow { color:var(--text2); transition:transform .2s; font-size:.8rem; }
    .wi-card.open .wi-card-arrow { transform:rotate(180deg); }
    .wi-card-body { display:none; padding:18px; border-top:1px solid var(--border); }
    .wi-card.open .wi-card-body { display:block; }

    /* ── Form rows ──────────────────────────────────────────── */
    .wi-row   { display:flex; flex-wrap:wrap; gap:12px; margin-bottom:14px; }
    .wi-field { display:flex; flex-direction:column; gap:5px; flex:1; min-width:160px; }
    .wi-field label { font-size:.78rem; color:var(--text2); }
    .wi-field input, .wi-field select {
      background:var(--surface2); border:1px solid var(--border2);
      color:var(--text); padding:7px 10px; border-radius:var(--radius);
      font-size:.85rem; outline:none; width:100%;
    }
    .wi-field input:focus, .wi-field select:focus { border-color:var(--blue); }
    .wi-field input[type=password] { letter-spacing:.1em; }

    /* ── Buttons ────────────────────────────────────────────── */
    .btn-wi { padding:8px 18px; border-radius:var(--radius); border:none;
              cursor:pointer; font-size:.85rem; font-weight:600; }
    .btn-primary  { background:var(--blue);   color:#000; }
    .btn-primary:hover  { opacity:.85; }
    .btn-success  { background:var(--green);  color:#000; }
    .btn-success:hover  { opacity:.85; }
    .btn-outline  { background:none; border:1px solid var(--border2); color:var(--text); }
    .btn-outline:hover  { border-color:var(--blue); color:var(--blue); }
    .btn-danger   { background:var(--red);    color:#fff; }
    .btn-danger:hover   { opacity:.85; }
    .btn-sm { padding:5px 11px; font-size:.78rem; }

    /* ── Status badge ───────────────────────────────────────── */
    .badge { display:inline-block; padding:2px 8px; border-radius:20px;
             font-size:.72rem; font-weight:600; }
    .badge-green  { background:rgba(63,185,80,.15);  color:var(--green); }
    .badge-orange { background:rgba(210,153,34,.15); color:var(--orange); }
    .badge-red    { background:rgba(248,81,73,.15);  color:var(--red); }
    .badge-gray   { background:rgba(139,148,158,.1); color:var(--text2); }

    /* ── Scrip search ───────────────────────────────────────── */
    .scrip-search-wrap { position:relative; }
    .scrip-results { position:absolute; top:100%; left:0; right:0; z-index:100;
                     background:var(--surface); border:1px solid var(--border2);
                     border-radius:var(--radius); max-height:260px; overflow-y:auto;
                     box-shadow:var(--shadow); }
    .scrip-item { padding:8px 12px; cursor:pointer; font-size:.82rem; border-bottom:1px solid var(--border); }
    .scrip-item:hover { background:var(--surface2); }
    .scrip-item span { display:block; }
    .scrip-item .s-sym { font-weight:600; color:var(--text); }
    .scrip-item .s-meta { color:var(--text2); font-size:.75rem; }

    /* ── Instrument mapper table ────────────────────────────── */
    .map-table { width:100%; border-collapse:collapse; font-size:.82rem; }
    .map-table th { padding:8px 10px; text-align:left; color:var(--text2);
                    border-bottom:1px solid var(--border); font-weight:500; }
    .map-table td { padding:7px 10px; border-bottom:1px solid var(--border); }
    .map-table tr:last-child td { border-bottom:none; }

    /* ── Summary cards ──────────────────────────────────────── */
    .wi-cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
                gap:12px; margin-bottom:20px; }
    .wi-stat { background:var(--surface); border:1px solid var(--border);
               border-radius:var(--radius-lg); padding:16px; }
    .wi-stat .s-label { font-size:.72rem; color:var(--text2); margin-bottom:4px; text-transform:uppercase; letter-spacing:.04em; }
    .wi-stat .s-val   { font-size:1.4rem; font-weight:700; }
    .wi-stat .s-val.pos { color:var(--green); }
    .wi-stat .s-val.neg { color:var(--red); }
    .wi-stat .s-val.neu { color:var(--blue); }

    /* ── Results table ──────────────────────────────────────── */
    .wi-table-wrap { overflow-x:auto; }
    .wi-table { width:100%; border-collapse:collapse; font-size:.82rem; white-space:nowrap; }
    .wi-table th { padding:9px 10px; text-align:right; color:var(--text2);
                   border-bottom:2px solid var(--border2); font-weight:500; position:sticky; top:0;
                   background:var(--surface); }
    .wi-table th:first-child, .wi-table th:nth-child(2),
    .wi-table th:nth-child(3) { text-align:left; }
    .wi-table td { padding:8px 10px; border-bottom:1px solid var(--border); text-align:right; }
    .wi-table td:first-child, .wi-table td:nth-child(2),
    .wi-table td:nth-child(3) { text-align:left; }
    .wi-table tr:hover td { background:var(--surface2); }
    .wi-table .pos { color:var(--green); }
    .wi-table .neg { color:var(--red); }
    .wi-table .dim { color:var(--text2); }
    .exit-badge { display:inline-block; padding:2px 7px; border-radius:10px; font-size:.72rem; font-weight:600; }
    .exit-target { background:rgba(63,185,80,.15);  color:var(--green); }
    .exit-sl     { background:rgba(248,81,73,.15);  color:var(--red); }
    .exit-trail  { background:rgba(210,153,34,.15); color:var(--orange); }
    .exit-eod    { background:rgba(139,148,158,.1); color:var(--text2); }
    .exit-miss   { background:rgba(188,140,255,.15);color:var(--purple); }

    /* ── Misc ───────────────────────────────────────────────── */
    .hint   { font-size:.78rem; color:var(--text2); margin-top:6px; }
    .divider{ border:none; border-top:1px solid var(--border); margin:14px 0; }
    .hidden { display:none !important; }
    #wi-error { color:var(--red); font-size:.83rem; margin-top:8px; }
    .spin { display:inline-block; animation:spin .8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .ohlc-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:8px; }
    .ohlc-item { background:var(--surface2); border:1px solid var(--border);
                 border-radius:var(--radius); padding:10px 12px; font-size:.8rem; }
    .ohlc-item .oi-sym { font-weight:600; margin-bottom:2px; }
    .ohlc-item .oi-meta { color:var(--text2); font-size:.74rem; }
  
.wi-inst-link {
  cursor: pointer;
  color: var(--accent);
  text-decoration: underline dotted;
  transition: color .15s;
}
.wi-inst-link:hover { color: #fff; }

```
