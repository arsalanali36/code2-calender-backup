# CSS — Base (reset / layout / dashboard / calendar / table)
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `static\css\style-base.css`
```css
/* ── RESET & BASE ─────────────────────────────── */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg: #0d1117;
  --surface: #161b22;
  --surface2: #1f2937;
  --border: #21262d;
  --border2: #30363d;
  --text: #e6edf3;
  --text2: #8b949e;
  --green: #3fb950;
  --red: #f85149;
  --blue: #58a6ff;
  --orange: #d29922;
  --purple: #bc8cff;
  --radius: 8px;
  --radius-lg: 14px;
  --shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
  /* Calendar — controlled by settings */
  --cal-day-size: 0.9rem;
  --cal-day-weight: 700;
  --cal-data-size: 0.75rem;
  --cal-data-weight: 400;
  --cal-cell-height: 100px;
  --table-row-height: 40px;
  --table-head-height: 78px;
  --table-foot-height: 42px;
  --table-visible-rows: 5;
  --table-font-size: 0.85rem;
  --date-group-a-bg: rgba(88, 166, 255, 0.03);
  --date-group-b-bg: rgba(255, 255, 255, 0.01);
  --date-group-sep: rgba(88, 166, 255, 0.28);
}

html {
  font-size: 14px;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

body.modal-open {
  overflow: hidden;
  overscroll-behavior: none;
  touch-action: none;
}

/* ── HEADER ───────────────────────────────────── */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.2rem;
  font-weight: 700;
}

.logo-icon {
  color: var(--green);
  font-size: 1.4rem;
}

.header-actions {
  display: flex;
  gap: 8px;
}

/* ── BUTTONS ──────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: var(--radius);
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.15s;
  white-space: nowrap;
}

.btn-primary {
  background: var(--blue);
  color: #fff;
}

.btn-primary:hover {
  background: #79b8ff;
}

.btn-outline {
  background: transparent;
  color: var(--text2);
  border: 1px solid var(--border2);
}

.btn-outline:hover {
  background: var(--surface2);
  color: var(--text);
  border-color: var(--blue);
}

/* ── DROPDOWNS ────────────────────────────────── */
.dropdown-wrapper {
  position: relative;
}

.dropdown-menu {
  display: none;
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  z-index: 500;
  min-width: 170px;
  overflow: hidden;
}

.dropdown-menu.open {
  display: block;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 14px;
  background: transparent;
  border: none;
  color: var(--text2);
  text-align: left;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.1s;
}

.dropdown-item:hover {
  background: var(--surface2);
  color: var(--text);
}

.dropdown-divider {
  height: 1px;
  background: var(--border);
  margin: 3px 0;
}

/* ── MAIN LAYOUT ──────────────────────────────── */
.app-main {
  flex: 1;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: visible;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  gap: 10px;
  flex-wrap: wrap;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
}

/* ── DASHBOARD SUMMARY ───────────────────────── */
.dashboard-section {
  overflow: hidden;
}

.dashboard-header {
  align-items: center;
}

.dashboard-title {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.dashboard-subtitle {
  color: var(--text2);
  font-size: 0.85rem;
}

.dashboard-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
  padding: 12px 16px 16px;
  background: linear-gradient(180deg, rgba(88, 166, 255, 0.06), rgba(13, 17, 23, 0));
}

.dash-card {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 12px 10px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
  cursor: grab;
  user-select: none;
  transition: opacity 0.15s, box-shadow 0.12s;
}

.dash-card.dragging {
  opacity: 0.3;
  cursor: grabbing;
}

/* vertical insertion-line indicators */
.dash-card.drop-before {
  box-shadow: -4px 0 0 0 var(--blue), 0 0 8px -2px rgba(88, 166, 255, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.02);
}

.dash-card.drop-after {
  box-shadow: 4px 0 0 0 var(--blue), 0 0 8px -2px rgba(88, 166, 255, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.02);
}

.dash-label {
  color: var(--text2);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.dash-value {
  margin-top: 6px;
  font-size: 1.05rem;
  font-weight: 700;
}

.dash-subvalue {
  margin-top: 2px;
  font-size: 0.72rem;
  color: var(--text2);
}

.dash-value.positive {
  color: var(--green);
}

.dash-value.negative {
  color: var(--red);
}

.dash-value-muted {
  color: var(--text);
}

@media (max-width: 520px) {
  .dashboard-title {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
}

/* ── CALENDAR NAV ─────────────────────────────── */
.calendar-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.calendar-nav #today-btn {
  padding: 5px 10px;
}

.nav-arrow {
  background: transparent;
  border: 1px solid var(--border2);
  color: var(--text2);
  width: 30px;
  height: 30px;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 1.3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.nav-arrow:hover {
  background: var(--surface2);
  color: var(--blue);
  border-color: var(--blue);
}

.select-box {
  background: var(--surface2);
  border: 1px solid var(--border2);
  color: var(--text);
  padding: 5px 10px;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 0.875rem;
  outline: none;
}

.select-box:focus {
  border-color: var(--blue);
}

/* ── SHOW HEADS ───────────────────────────────── */
.show-heads-wrapper {
  position: relative;
}

.show-heads-panel {
  display: none;
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--radius);
  padding: 10px;
  min-width: 200px;
  box-shadow: var(--shadow);
  z-index: 200;
}

.show-heads-panel.open {
  display: block;
}

.panel-hint {
  color: var(--text2);
  font-size: 0.8rem;
  text-align: center;
}

.head-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  cursor: pointer;
  color: var(--text2);
  font-size: 0.875rem;
  user-select: none;
}

.head-checkbox:hover {
  color: var(--text);
}

.head-checkbox.active-filter-item {
  background: var(--hover);
  outline: 1px solid var(--blue);
  border-radius: 4px;
}

.head-checkbox input[type="checkbox"] {
  accent-color: var(--blue);
  width: 15px;
  height: 15px;
  cursor: pointer;
}

.head-checkbox.drag-row {
  cursor: grab;
}

.head-checkbox.drag-row:active {
  cursor: grabbing;
}

.frozen-col {
  position: sticky;
  background: var(--bg) !important;
  z-index: 5;
}

.frozen-col .cell-input {
  background: var(--bg) !important;
}

.trade-table thead .frozen-col {
  background: var(--surface2) !important;
  z-index: 12;
}

.trade-table tfoot .frozen-col {
  background: var(--surface) !important;
  z-index: 10;
}

/* Override position:relative from .trade-table th for frozen header cells */
.trade-table th.frozen-col,
.trade-table th.row-drag-th {
  position: sticky !important;
}

.trade-table th.sortable-th.frozen-col {
  position: sticky !important;
}

/* Panel search + actions (shared by Show Heads & Columns panels) */
.panel-search-row {
  margin-bottom: 6px;
}

.panel-search {
  width: 100%;
  background: var(--surface2);
  border: 1px solid var(--border2);
  color: var(--text);
  padding: 5px 8px;
  border-radius: var(--radius);
  font-size: 0.78rem;
  outline: none;
}

.panel-search:focus {
  border-color: var(--blue);
}

.panel-act-row {
  display: flex;
  gap: 5px;
  margin-bottom: 7px;
}

.panel-act-btn {
  flex: 1;
  background: var(--surface2);
  border: 1px solid var(--border2);
  color: var(--text2);
  padding: 4px 0;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.72rem;
  transition: all 0.12s;
}

.panel-act-btn:hover {
  border-color: var(--blue);
  color: var(--blue);
}

.panel-list {
  max-height: 220px;
  overflow-y: auto;
}

/* ── CALENDAR GRID — TRANSPARENT ─────────────── */
.calendar-container {
  padding: 12px 16px 16px;
}

.range-label {
  color: var(--text2);
  font-size: 0.78rem;
  padding-left: 4px;
}

/* ── YEARLY VIEW ─────────────────────────────── */
.calendar-yearly {
  padding: 14px 16px 18px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.year-month {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px;
  background: var(--surface2);
}

.year-month-title {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: var(--text2);
  text-transform: uppercase;
  margin-bottom: 8px;
}

.year-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.year-cell {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.06);
}

.year-cell.pos {
  background: rgba(63, 185, 80, 0.8);
}

.year-cell.neg {
  background: rgba(248, 81, 73, 0.85);
}

.year-cell.zero {
  background: rgba(255, 255, 255, 0.08);
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0;
  margin-bottom: 0;
  border-bottom: 1px solid var(--border2);
}

.calendar-weekdays div {
  text-align: center;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text2);
  padding: 6px 0;
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.calendar-weekdays .weekend {
  color: var(--orange);
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.day-cell {
  background: transparent;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  min-height: var(--cal-cell-height);
  padding: 7px;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
  overflow: hidden;
}

.day-cell:hover {
  background: rgba(88, 166, 255, 0.04);
}

.day-cell.empty {
  background: transparent;
  cursor: default;
  pointer-events: none;
}

.day-cell.today {
  background: rgba(88, 166, 255, 0.06);
}

.day-cell.today .day-num {
  background: var(--blue);
  color: #fff;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.day-cell.has-profit {
  border-left: 2px solid var(--green);
}

.day-cell.has-loss {
  border-left: 2px solid var(--red);
}

.day-cell.weekend-day>.day-num {
  color: var(--orange);
}

/* ── Market Holidays ── */
.day-cell.market-holiday {
  background: rgba(255, 180, 40, 0.08);
  border-top: 2px solid rgba(255, 180, 40, 0.55);
}
.day-cell.market-holiday:hover {
  background: rgba(255, 180, 40, 0.14);
}
.day-cell.market-holiday .day-num {
  color: #f0a500;
}
/* Muhurat Trading — special evening session (amber-purple) */
.day-cell.muhurat-day {
  background: rgba(160, 100, 255, 0.08);
  border-top: 2px solid rgba(160, 100, 255, 0.55);
}
.day-cell.muhurat-day:hover {
  background: rgba(160, 100, 255, 0.14);
}
.day-cell.muhurat-day .day-num {
  color: #b07aff;
}
/* Holiday name label inside the tile */
.holiday-label {
  font-size: 9px;
  line-height: 1.2;
  color: #f0a500;
  opacity: 0.85;
  margin-bottom: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  letter-spacing: 0.02em;
}
.holiday-label.muhurat-label {
  color: #b07aff;
}
/* Year view holiday dots */
.year-cell.market-holiday {
  background: rgba(255, 180, 40, 0.22) !important;
  outline: 1px solid rgba(255, 180, 40, 0.45);
}
.year-cell.muhurat-day {
  background: rgba(160, 100, 255, 0.22) !important;
  outline: 1px solid rgba(160, 100, 255, 0.45);
}

/* Day number — positioning handled via data-pos class on grid */
.day-num {
  font-size: var(--cal-day-size);
  font-weight: var(--cal-day-weight);
  color: var(--text2);
  line-height: 20px;
  margin-bottom: 4px;
  display: inline-flex;
}

/* position variants */
.cal-pos-top-left .day-num {
  position: static;
}

.cal-pos-top-center .day-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cal-pos-top-right .day-num {
  position: absolute;
  top: 7px;
  right: 7px;
  margin: 0;
}

.cal-pos-bottom-left .day-num {
  position: absolute;
  bottom: 7px;
  left: 7px;
  margin: 0;
}

.cal-pos-bottom-right .day-num {
  position: absolute;
  bottom: 7px;
  right: 7px;
  margin: 0;
}

.day-data {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: 2px;
}

.day-data-item {
  font-size: var(--cal-data-size);
  font-weight: var(--cal-data-weight);
  color: var(--text2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.day-data-item.profit-pos {
  color: var(--green);
  font-weight: 600;
}

.day-data-item.profit-neg {
  color: var(--red);
  font-weight: 600;
}

.day-img-badge {
  position: absolute;
  bottom: 3px;
  right: 4px;
  font-size: 0.65rem;
  color: var(--purple);
  opacity: 0.8;
}

.day-thumb-image {
  position: absolute;
  right: 4px;
  bottom: 20px;
  width: 26px;
  height: 26px;
  border-radius: 4px;
  border: 1px solid var(--border2);
  object-fit: cover;
  box-shadow: 0 0 0 1px rgba(88, 166, 255, 0.25);
}

.day-tag-bubbles {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 3px;
}

.day-tag-bubble {
  border: 1px solid var(--border2);
  border-radius: 999px;
  padding: 1px 6px;
  background: transparent;
  font-size: 0.62rem;
  line-height: 1.3;
  cursor: pointer;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.day-tag-bubble:hover {
  filter: brightness(1.1);
}

.day-tag-bubble.active {
  box-shadow: 0 0 0 1px rgba(88, 166, 255, 0.5) inset;
  transform: translateY(-1px);
}

.day-note-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-top: 4px;
  border-radius: 50%;
  border: 1px solid rgba(88, 166, 255, 0.4);
  background: rgba(88, 166, 255, 0.12);
  color: var(--blue);
  font-size: 0.62rem;
  font-weight: 700;
}

/* Pencil observation button */
.day-pencil {
  position: absolute;
  bottom: 3px;
  left: 4px;
  background: transparent;
  border: none;
  color: var(--text2);
  cursor: pointer;
  font-size: 0.68rem;
  padding: 2px 3px;
  border-radius: 3px;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
  z-index: 2;
}

.day-cell:hover .day-pencil {
  opacity: 0.7;
}

.day-cell.has-obs .day-pencil {
  opacity: 0.8;
  color: var(--blue);
}

.day-obs-snippet {
  font-size: 0.65rem;
  color: var(--text2);
  opacity: 0.7;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
  font-style: italic;
}

/* ── TRADE TABLE ──────────────────────────────── */
.table-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.date-range-filter {
  display: flex;
  align-items: center;
  gap: 4px;
}

.date-range-input {
  font-size: 0.78rem;
  padding: 4px 6px;
  width: 130px;
  transition: border-color 0.15s;
}

.date-range-sep {
  color: var(--text2);
  font-size: 0.8rem;
}

.date-range-clear {
  padding: 4px 7px;
  font-size: 0.75rem;
  display: none;
}

.table-wrapper {
  overflow-x: auto;
  overflow-y: auto;
  max-height: calc(var(--table-head-height) + (var(--table-row-height) * var(--table-visible-rows)) + var(--table-foot-height));
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}

.trade-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--table-font-size, 0.85rem);
  table-layout: fixed;
}

.trade-table thead {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--surface2);
}

.trade-table th {
  padding: 9px 12px;
  text-align: left;
  color: var(--text2);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border2);
  white-space: nowrap;
  position: relative;
}

.trade-table th.sortable-th {
  position: relative;
  user-select: none;
  cursor: pointer;
  padding-right: 18px;
}

.trade-table th .sort-ind {
  margin-left: 6px;
  font-size: 0.65rem;
  color: var(--blue);
}

.col-del-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid var(--border2);
  background: rgba(248, 81, 73, 0.08);
  color: var(--red);
  font-size: 0.7rem;
  line-height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s, border-color 0.12s, background 0.12s;
}

.trade-table th:hover .col-del-btn {
  opacity: 1;
  pointer-events: auto;
}

.col-del-btn:hover {
  border-color: var(--red);
  background: rgba(248, 81, 73, 0.18);
}

.col-resizer {
  position: absolute;
  top: 0;
  right: 0;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 1;
}

.col-resizer::after {
  content: '';
  position: absolute;
  right: 2px;
  top: 20%;
  height: 60%;
  width: 2px;
  background: var(--border2);
  border-radius: 1px;
  transition: background 0.15s;
}

.col-resizer:hover::after,
.col-resizer:active::after {
  background: var(--blue);
}

.col-resizer:hover {
  background: rgba(88, 166, 255, 0.1);
}

.trade-table th.sortable-th {
  cursor: grab;
}

.trade-table th.sortable-th:active {
  cursor: grabbing;
}

.trade-table th.col-th-dragging {
  opacity: 0.35;
  background: var(--bg2);
}

.trade-table th.col-th-drag-over {
  border-left: 3px solid var(--blue);
  background: rgba(88, 166, 255, 0.12);
}

.trade-table td {
  padding: 7px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  vertical-align: middle;
  overflow: hidden;
}

.trade-table th {
  overflow: hidden;
}

.trade-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.02);
}

.trade-table tbody tr.row-drop-target {
  background: rgba(88, 166, 255, 0.12);
  outline: 1px dashed var(--blue);
}

.trade-table tbody tr.date-group-a td {
  background: var(--date-group-a-bg);
}

.trade-table tbody tr.date-group-b td {
  background: var(--date-group-b-bg);
}

.trade-table tbody tr.date-group-start td {
  border-top: 1px solid var(--date-group-sep);
}

.trade-table tfoot td {
  padding: 7px 12px;
  border-top: 1px solid var(--border2);
  background: var(--surface2);
  font-weight: 600;
  color: var(--text2);
  font-size: 0.8rem;
  position: sticky;
  bottom: 0;
  z-index: 9;
}

/* Filter row */
.filter-row {
  background: rgba(88, 166, 255, 0.04);
}

.filter-row.hidden {
  display: none;
}

.filter-row td {
  padding: 4px 8px;
}

.filter-input {
  background: var(--surface);
  border: 1px solid var(--border2);
  color: var(--text);
  padding: 3px 7px;
  border-radius: 4px;
  width: 100%;
  font-size: 0.78rem;
  outline: none;
}

.filter-input:focus {
  border-color: var(--blue);
}

.cell-input {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text);
  padding: 3px 6px;
  border-radius: 4px;
  width: 100%;
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.15s;
}

.cell-input:focus {
  border-color: var(--blue);
  background: var(--surface2);
}

.img-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

/* 3-column grid layout for image thumbnails */
.img-cell-grid {
  display: grid;
  grid-template-columns: repeat(3, 34px);
  gap: 3px;
}

.img-cell-grid .img-upload-btn,
.img-cell-grid .img-count-badge {
  grid-column: 1 / -1;
}

.img-thumb {
  width: 34px;
  height: 34px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--border2);
  cursor: pointer;
  transition: transform 0.15s;
}

.img-thumb:hover {
  transform: scale(1.1);
}

.img-thumb[draggable]:active {
  opacity: 0.5;
  cursor: grabbing;
}

.img-thumb-wrap {
  position: relative;
  display: inline-flex;
}

.img-thumb-del {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 50%;
  background: rgba(248, 81, 73, 0.95);
  color: #fff;
  font-size: 11px;
  line-height: 16px;
  text-align: center;
  cursor: pointer;
  padding: 0;
  opacity: 0;
  transition: opacity 0.12s;
}

.img-thumb-wrap:hover .img-thumb-del {
  opacity: 1;
}

.img-count-badge {
  background: var(--purple);
  color: #fff;
  border-radius: 10px;
  padding: 2px 7px;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
}

.img-upload-btn {
  background: transparent;
  border: 1px dashed var(--border2);
  color: var(--text2);
  border-radius: 4px;
  padding: 3px 9px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.15s;
}

.img-upload-btn:hover {
  border-color: var(--blue);
  color: var(--blue);
}

.table-empty {
  text-align: center;
  padding: 40px;
  color: var(--text2);
  font-size: 0.9rem;
}

.row-action-td {
  display: flex;
  align-items: center;
  gap: 2px;
}

/* Drag handle + delete — leftmost column */
.row-drag-th {
  width: 36px;
  min-width: 36px;
  max-width: 36px;
  padding: 0 !important;
  border: none !important;
}

.row-drag-td {
  width: 36px;
  min-width: 36px;
  max-width: 36px;
  padding: 0 2px !important;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
}

.row-drag-handle {
  display: inline-block;
  color: transparent;
  cursor: grab;
  font-size: 1rem;
  padding: 3px 2px;
  line-height: 1;
  user-select: none;
  transition: color 0.15s;
  flex-shrink: 0;
}

tr:hover .row-drag-handle {
  color: var(--text2);
}

.row-drag-handle:hover {
  color: var(--blue) !important;
}

.row-drag-handle:active {
  cursor: grabbing;
}

/* Mini delete button inside drag-td */
.del-row-mini {
  background: transparent;
  border: none;
  color: transparent;
  cursor: pointer;
  font-size: 0.65rem;
  padding: 2px 3px;
  border-radius: 3px;
  line-height: 1;
  transition: all 0.15s;
  flex-shrink: 0;
  user-select: none;
}

tr:hover .del-row-mini {
  color: var(--text2);
}

.del-row-mini:hover {
  color: var(--red) !important;
  background: rgba(248, 81, 73, 0.12);
}

.delete-row-btn {
  background: transparent;
  border: none;
  color: transparent;
  cursor: pointer;
  font-size: 0.95rem;
  padding: 2px 5px;
  border-radius: 4px;
  transition: all 0.15s;
}

tr:hover .delete-row-btn {
  color: var(--text2);
}

.delete-row-btn:hover {
  color: var(--red) !important;
  background: rgba(248, 81, 73, 0.1);
}

/* Row drag reorder */
tr.dragging {
  opacity: 0.35;
}

tr.row-drop-before {
  box-shadow: 0 -3px 0 0 var(--blue);
}

tr.row-drop-after {
  box-shadow: 0 3px 0 0 var(--blue);
}

/* Column visibility panel */
.col-vis-panel {
  padding: 10px;
  min-width: 220px;
  max-height: 360px;
  overflow: visible;
}

/* Add column input */
.col-name-input {
  width: 100%;
  background: var(--surface2);
  border: 1px solid var(--border2);
  color: var(--text);
  padding: 9px 12px;
  border-radius: var(--radius);
  font-size: 0.9rem;
  outline: none;
}

.col-name-input:focus {
  border-color: var(--blue);
}


```
