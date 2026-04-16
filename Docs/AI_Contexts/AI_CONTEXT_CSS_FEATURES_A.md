# CSS - Feature Styles A (csvlog, strategy, fullscreen)
Consolidated code context for AI assistants.


## File: `static/css/style-csvlog.css`
```css
/* ── CSVLOG MODAL ─────────────────────────────── */

.cl-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.65);
  z-index: 1200;
  display: flex; align-items: center; justify-content: center;
}

.cl-panel {
  background: #161b27;
  border: 1px solid var(--border);
  border-radius: 10px;
  width: min(760px, 96vw);
  max-height: 90vh;
  display: flex; flex-direction: column;
  box-shadow: 0 12px 48px rgba(0,0,0,0.8);
  position: relative; z-index: 1201;
}

/* Header */
.cl-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px 10px;
  border-bottom: 1px solid var(--border);
  background: #161b27;
  border-radius: 10px 10px 0 0;
  flex-shrink: 0; gap: 12px;
}
.cl-title {
  font-size: 0.95rem; font-weight: 600; color: var(--text);
  flex-shrink: 0;
}
.cl-header-actions {
  display: flex; align-items: center; gap: 6px;
}

/* Date nav (prev < date > next) */
.cl-date-nav {
  display: flex; align-items: center; gap: 6px;
  flex: 1; justify-content: center;
}
.cl-date-display {
  font-size: 0.85rem; font-weight: 600; color: var(--blue);
  cursor: pointer; padding: 3px 10px;
  border: 1px solid transparent; border-radius: 4px;
  transition: border-color 0.15s, background 0.15s;
  white-space: nowrap;
}
.cl-date-display:hover { border-color: var(--blue); background: rgba(88,166,255,0.08); }
.cl-date-picker-input {
  position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0;
}
.cl-schema-upload-label {
  font-size: 0.72rem; color: var(--text-muted);
  border: 1px solid var(--border); border-radius: 4px;
  padding: 3px 8px; cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.cl-schema-upload-label:hover { background: var(--hover); color: var(--text); }
.cl-nav-btn {
  background: transparent; border: 1px solid var(--border);
  border-radius: 4px; color: var(--text2);
  width: 26px; height: 26px; font-size: 1rem;
  cursor: pointer; line-height: 1; display: flex; align-items: center; justify-content: center;
}
.cl-nav-btn:hover { background: var(--hover); color: var(--text); }
.cl-close-btn {
  background: transparent; border: none;
  color: var(--text-muted); font-size: 1.1rem; cursor: pointer;
  padding: 2px 6px; border-radius: 4px;
}
.cl-close-btn:hover { background: var(--hover); color: var(--red); }

/* Trade tabs (Trade 1, Trade 2, ...) */
.cl-trade-tabs {
  display: flex; gap: 4px; padding: 10px 16px 0;
  flex-wrap: nowrap; flex-shrink: 0;
  overflow-x: auto; scrollbar-width: none;
}
.cl-trade-tabs::-webkit-scrollbar { display: none; }
.cl-trade-tab {
  background: transparent; border: 1px solid var(--border);
  border-radius: 6px 6px 0 0; color: var(--text2);
  font-size: 0.78rem; padding: 5px 10px; cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap; flex-shrink: 0;
}
.cl-trade-tab:hover { background: var(--hover); color: var(--text); }
.cl-trade-tab.active {
  background: #1a2030; border-bottom-color: #1a2030;
  color: var(--text); font-weight: 600;
}
/* Loss trade tab — red bottom pip */
.cl-trade-tab.cl-tab-loss {
  position: relative;
}
.cl-trade-tab.cl-tab-loss::after {
  content: ''; position: absolute;
  bottom: 0; left: 20%; right: 20%; height: 2px;
  background: rgba(248,81,73,0.6); border-radius: 1px;
}
.cl-trade-tab.cl-tab-loss.active::after { background: var(--red); }

/* Group tabs (Zone / Entry / Exit / PSy) */
.cl-group-tabs {
  display: flex; gap: 0; padding: 0 16px;
  border-bottom: 1px solid var(--border); flex-shrink: 0;
  background: #1a2030;
}
.cl-group-tab {
  background: transparent; border: none; border-bottom: 2px solid transparent;
  color: var(--text2); font-size: 0.82rem; padding: 8px 18px;
  cursor: pointer; transition: color 0.15s, border-color 0.15s;
}
.cl-group-tab:hover { color: var(--text); }
.cl-group-tab.active { color: var(--blue); border-bottom-color: var(--blue); font-weight: 600; }

/* Body / form area */
.cl-body {
  flex: 1; overflow: hidden; padding: 0;
  display: flex; flex-direction: column;
  background: #161b27;
}

/* Section separator */
.cl-separator {
  font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--text-muted);
  padding: 6px 0 2px; margin-top: 4px;
  border-top: 1px solid var(--border);
}
.cl-separator:first-child { border-top: none; margin-top: 0; }

/* Field row */
.cl-field-wrap { display: flex; flex-direction: column; gap: 0; }
.cl-field-row {
  display: flex; align-items: center; gap: 8px;
  min-height: 30px; padding: 2px 0;
}
.cl-field-label {
  font-size: 0.8rem; color: var(--text2);
  min-width: 96px; max-width: 96px; flex-shrink: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* Switch (Y/N) — compact, matches Logger style */
.cl-switch-wrap { display: flex; gap: 3px; }
.cl-switch-btn {
  background: var(--bg); border: 1px solid var(--border);
  color: var(--text2); border-radius: 4px;
  padding: 3px 11px; font-size: 0.78rem; cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.cl-switch-btn:hover { background: var(--hover); color: var(--text); }
.cl-switch-btn.active { background: var(--blue); border-color: var(--blue); color: #fff; font-weight: 600; }

/* Input */
.cl-input {
  background: var(--bg); border: 1px solid var(--border);
  color: var(--text); border-radius: 4px;
  padding: 3px 8px; font-size: 0.8rem;
  width: 100px; outline: none;
}
.cl-input:focus { border-color: var(--blue); }

/* Dropdown */
.cl-select {
  background: var(--bg); border: 1px solid var(--border);
  color: var(--text); border-radius: 4px;
  padding: 3px 8px; font-size: 0.8rem;
  max-width: 140px; outline: none; cursor: pointer;
}
.cl-select:focus { border-color: var(--blue); }

/* Slider */
.cl-slider-wrap { display: flex; align-items: center; gap: 8px; flex: 1; }
.cl-slider { flex: 1; max-width: 160px; accent-color: var(--blue); cursor: pointer; }
.cl-slider-val { font-size: 0.82rem; font-weight: 700; color: var(--blue); min-width: 26px; text-align: right; }

/* Segmented — same compact style as Y/N */
.cl-segmented-wrap { display: flex; gap: 3px; flex-wrap: wrap; }
.cl-seg-btn {
  background: var(--bg); border: 1px solid var(--border);
  color: var(--text2); border-radius: 4px;
  padding: 3px 10px; font-size: 0.78rem; cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.cl-seg-btn:hover { background: var(--hover); color: var(--text); }
.cl-seg-btn.active { background: var(--blue); border-color: var(--blue); color: #fff; font-weight: 600; }

/* Obs button (left dot) */
.cl-obs-btn {
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--border); border: none;
  cursor: pointer; flex-shrink: 0; font-size: 0;
  transition: background 0.15s, transform 0.15s;
  padding: 0;
}
.cl-obs-btn:hover { background: var(--text-muted); transform: scale(1.3); }
.cl-obs-btn.has-obs { background: #d29922; }

/* Obs floating popup */
.cl-obs-popup {
  position: fixed; z-index: 1500;
  background: #1e2535; border: 1px solid var(--border);
  border-radius: 6px; box-shadow: 0 6px 24px rgba(0,0,0,0.6);
  padding: 8px;
  width: 260px;
}
.cl-obs-popup-ta {
  width: 100%; height: 90px;
  background: var(--bg); border: 1px solid var(--border);
  color: var(--text); border-radius: 4px;
  font-size: 0.8rem; padding: 6px 8px; resize: vertical;
  outline: none; display: block;
}
.cl-obs-popup-ta:focus { border-color: var(--blue); }

/* Footer */
.cl-footer {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 8px 16px; border-top: 1px solid var(--border);
  background: #161b27; border-radius: 0 0 10px 10px;
  flex-shrink: 0;
}

/* Two-column layout */
.cl-cols {
  display: flex; gap: 0; flex: 1; min-height: 0; height: 100%;
}
.cl-form-col {
  overflow-y: auto; flex-shrink: 0;
  padding: 10px 10px 10px 12px;
  display: flex; flex-direction: column; gap: 6px;
}
.cl-resizer {
  width: 5px; cursor: col-resize; flex-shrink: 0;
  background: var(--border);
  transition: background 0.15s;
}
.cl-resizer:hover, .cl-resizer:active { background: var(--blue); }
.cl-img-col {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: flex-start;
  padding: 10px 12px 10px 10px; overflow-y: auto; min-width: 0;
}

/* Image viewer */
.cl-img-viewer { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%; }
.cl-hero-img {
  width: 100%; max-height: 380px; object-fit: contain;
  border-radius: 6px; border: 1px solid var(--border);
  cursor: pointer; background: #0d1117;
  transition: opacity 0.15s;
}
.cl-hero-img:hover { opacity: 0.9; }
.cl-img-nav { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
.cl-img-counter { font-size: 0.78rem; color: var(--text-muted); flex: 1; text-align: center; }
.cl-img-empty { color: var(--text-muted); font-size: 0.82rem; text-align: center; padding: 40px 0; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.cl-img-upload-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 1rem;
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15);
  color: var(--text-muted); transition: background 0.15s, color 0.15s; flex-shrink: 0;
}
.cl-img-upload-btn:hover { background: rgba(255,255,255,0.15); color: #fff; }
.cl-img-col { transition: box-shadow 0.15s; }
.cl-img-drop-target { box-shadow: inset 0 0 0 2px var(--accent, #58a6ff); background: rgba(88,166,255,0.06); }
.cl-img-drop-target .cl-img-empty, .cl-img-drop-target .cl-img-viewer { opacity: 0.6; }

/* Info tab */
.cl-info-wrap { display: flex; flex-direction: column; gap: 8px; max-width: 520px; }
.cl-info-row {
  display: flex; gap: 16px; align-items: baseline;
  border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 6px;
}
.cl-info-label { font-size: 0.75rem; color: var(--text-muted); min-width: 90px; flex-shrink: 0; }
.cl-info-value { font-size: 0.88rem; color: var(--text); }
.cl-info-section-hdr {
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--text-muted); margin-top: 10px; padding-top: 10px;
  border-top: 1px solid var(--border);
}
.cl-info-obs-area {
  width: 100%; min-height: 70px; max-height: 160px;
  background: rgba(255,255,255,0.04); border: 1px solid var(--border);
  color: var(--text2); border-radius: 4px; font-size: 0.78rem;
  padding: 6px 8px; resize: vertical; outline: none;
  font-family: inherit; line-height: 1.5;
}
.cl-info-obs-editable { color: var(--text); background: var(--bg); cursor: text; }
.cl-info-obs-editable:focus { border-color: var(--blue); }
.cl-obs-commit-btn {
  align-self: flex-start; font-size: 0.76rem;
  padding: 3px 12px; margin-top: 4px;
}
.cl-info-note-area {
  width: 100%; min-height: 80px;
  background: var(--bg); border: 1px solid var(--border);
  color: var(--text); border-radius: 4px; font-size: 0.82rem;
  padding: 6px 8px; resize: vertical; outline: none;
  font-family: inherit; line-height: 1.5;
}
.cl-info-note-area:focus { border-color: var(--blue); }

/* Tags content */
.cl-tags-wrap { display: flex; flex-direction: column; gap: 10px; width: 100%; padding: 14px 20px; overflow-y: auto; }
.cl-tags-ctrl { display: flex; gap: 6px; flex-wrap: wrap; }
.cl-tag-group { display: flex; flex-direction: column; gap: 6px; }
.cl-tag-group-label {
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
  color: var(--text-muted); letter-spacing: 0.06em;
  border-bottom: 1px solid var(--border); padding-bottom: 3px;
}
.cl-tag-chips { display: flex; flex-wrap: wrap; gap: 6px; }

/* Schema dropdown button */
.cl-schema-dd-btn {
  background: transparent; border: 1px solid var(--border);
  color: var(--text2); border-radius: 4px;
  padding: 3px 10px; font-size: 0.78rem; cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}
.cl-schema-dd-btn:hover { background: var(--hover); color: var(--text); }
.cl-schema-dd-wrap .dropdown-menu { min-width: 200px; }

/* Image wrap + zoom button */
.cl-img-wrap { position: relative; width: 100%; }
.cl-zoom-btn {
  position: absolute; top: 6px; right: 6px;
  background: rgba(0,0,0,0.55); border: 1px solid rgba(255,255,255,0.25);
  color: #fff; border-radius: 4px; font-size: 1rem;
  width: 28px; height: 28px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.15s; padding: 0;
}
.cl-img-wrap:hover .cl-zoom-btn { opacity: 1; }

/* Fullscreen zoom overlay */
.cl-zoom-overlay {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(0,0,0,0.92);
  display: flex; align-items: center; justify-content: center;
  cursor: zoom-out;
}
.cl-zoom-img {
  max-width: 95vw; max-height: 92vh;
  object-fit: contain; border-radius: 4px;
  cursor: default; box-shadow: 0 8px 48px rgba(0,0,0,0.6);
}
.cl-zoom-close {
  position: fixed; top: 14px; right: 18px;
  background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25);
  color: #fff; font-size: 1rem; border-radius: 6px;
  padding: 5px 14px; cursor: pointer; z-index: 2001;
}
.cl-zoom-close:hover { background: rgba(255,255,255,0.22); }
.cl-zoom-arrow {
  position: fixed; top: 50%; transform: translateY(-50%);
  background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
  color: #fff; font-size: 2rem; border-radius: 8px;
  width: 44px; height: 64px; cursor: pointer; z-index: 2001;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.cl-zoom-arrow:hover { background: rgba(255,255,255,0.22); }
.cl-zoom-arrow-left  { left: 12px; }
.cl-zoom-arrow-right { right: 12px; }
.cl-zoom-counter {
  position: fixed; bottom: 14px; left: 50%; transform: translateX(-50%);
  color: rgba(255,255,255,0.6); font-size: 0.85rem; z-index: 2001;
  pointer-events: none;
}

/* ── Day summary tab ───────────────────────────────────────────────────────── */
.cl-day-tab { font-style: italic; }

.cl-day-stats {
  display: flex; gap: 12px; margin-bottom: 18px;
  flex-wrap: wrap;
}
.cl-day-stat {
  background: #1b2232; border: 1px solid var(--border);
  border-radius: 8px; padding: 12px 20px; flex: 1; min-width: 100px;
  text-align: center; outline: none; transition: border-color 0.15s;
}
.cl-day-stat[tabindex] { cursor: pointer; }
.cl-day-stat[tabindex]:hover { border-color: rgba(88,166,255,0.4); }
.cl-day-stat[tabindex]:focus { border-color: #58a6ff; box-shadow: 0 0 0 2px rgba(88,166,255,0.25); }
.cl-day-stat-sorted {
  border-color: rgba(88,166,255,0.6) !important;
  background: rgba(88,166,255,0.08);
}
.cl-day-stat-sorted .cl-day-stat-label::after { content: ' ↓'; opacity: 0.7; }
.cl-day-stat-label {
  font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;
  letter-spacing: 0.04em; margin-bottom: 6px;
}
.cl-day-stat-value {
  font-size: 1.2rem; font-weight: 700; color: var(--text);
}

/* Horizontal bell chart (All tab) */
.cl-bell-wrap {
  margin-bottom: 14px; position: relative;
}
.cl-bell-chart {
  display: flex; align-items: stretch;
  height: 210px; gap: 1px; padding: 0 2px;
  position: relative;
}
.cl-bell-chart::after {
  content: ''; position: absolute; left: 0; right: 0; top: 50%;
  border-top: 1px solid rgba(255,255,255,0.1); pointer-events: none;
}
.cl-bell-col {
  flex: 1; min-width: 4px; display: flex; flex-direction: column;
  cursor: pointer; transition: opacity 0.1s;
}


```

## File: `static/css/style-csvlog-charts.css`
```css
/* ── CSVLOG CHARTS ───────────────────────────── */
.clc-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1250;
  background: rgba(0,0,0,0.72);
  display: flex;
  align-items: center;
  justify-content: center;
}

.clc-panel {
  width: min(1180px, 96vw);
  height: min(820px, 92vh);
  background: #161b27;
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.7);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.clc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}

.clc-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
}

.clc-subtitle {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-top: 3px;
}

.clc-close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.1rem;
  cursor: pointer;
  border-radius: 6px;
  padding: 4px 8px;
}

.clc-close-btn:hover {
  color: var(--red);
  background: rgba(255,255,255,0.06);
}

.clc-body {
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
}

.clc-sidebar {
  border-right: 1px solid var(--border);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgba(255,255,255,0.02);
}

.clc-side-btn {
  border: 1px solid var(--border);
  background: #1b2232;
  color: var(--text2);
  border-radius: 10px;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
  font-size: 0.84rem;
}

.clc-side-btn.active,
.clc-side-btn:hover {
  border-color: var(--blue);
  color: var(--text);
  background: rgba(88,166,255,0.12);
}

.clc-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.clc-toolbar {
  padding: 10px 16px 8px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.clc-toolbar-copy {
  min-width: 0;
}

.clc-toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.clc-view-wrap {
  display: inline-flex;
  align-items: center;
  gap: 0;
}

.clc-view-select {
  border: 1px solid var(--border);
  background: #1b2232;
  color: var(--text);
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
}

.clc-toolbar-title {
  font-size: 0.96rem;
  font-weight: 700;
  color: var(--text);
}

.clc-toolbar-meta {
  display: none;
  font-size: 0.76rem;
  color: var(--text-muted);
}

.clc-toolbar-fields-btn {
  border: 1px solid var(--border);
  background: #1b2232;
  color: var(--text2);
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  white-space: nowrap;
}

.clc-toolbar-field-picker {
  display: none;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  background: rgba(255,255,255,0.02);
  flex-wrap: wrap;
  gap: 10px 16px;
}

.clc-toolbar-field-picker.open {
  display: flex;
}

.clc-toolbar-field-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: var(--text2);
}

.clc-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.clc-empty {
  padding: 24px;
  border: 1px dashed var(--border);
  border-radius: 12px;
  color: var(--text-muted);
  text-align: center;
}

.clc-grid-wrap {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: auto;
  background: rgba(255,255,255,0.02);
}

.clc-grid-wrap-slider {
  max-height: min(62vh, 680px);
  overflow: auto;
  scrollbar-gutter: stable both-edges;
}

.clc-grid-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 680px;
}

.clc-grid-table th,
.clc-grid-table td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  text-align: center;
}

.clc-grid-table th {
  position: sticky;
  top: 0;
  background: #131927;
  color: var(--text2);
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.clc-date-cell {
  text-align: left !important;
  color: var(--text);
  font-weight: 600;
  white-space: nowrap;
  width: 130px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.clc-date-cell-sub {
  font-size: 0.78rem;
  color: var(--text2);
  font-weight: 500;
}

.clc-detail-indent {
  width: 18px;
}

.clc-expand-btn {
  width: 18px;
  height: 18px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  background: #1b2232;
  color: var(--text2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: transform 0.15s, color 0.15s, border-color 0.15s;
}

.clc-expand-btn.open {
  transform: rotate(90deg);
  color: var(--text);
  border-color: rgba(88,166,255,0.4);
}

.clc-cell-empty {
  color: var(--text-muted);
}

.clc-slider-chip {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #1b2232;
  color: var(--text);
  min-width: 62px;
  padding: 8px 10px;
  cursor: pointer;
  display: inline-flex;
  flex-direction: column;
  gap: 3px;
  align-items: center;
}

.clc-slider-chip span {
  font-size: 0.68rem;
  color: var(--text-muted);
}

.clc-slider-chip.pos {
  border-color: rgba(63,185,80,0.35);
  background: rgba(63,185,80,0.12);
}

.clc-slider-chip.neg {
  border-color: rgba(248,81,73,0.35);
  background: rgba(248,81,73,0.12);
}

.clc-slider-groups {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.clc-slider-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.clc-slider-tab {
  min-width: 118px;
  border: 1px solid var(--border);
  background: #171f2e;
  color: var(--text2);
  border-radius: 12px;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 3px;
  white-space: nowrap;
}

.clc-slider-tab.active {
  border-color: rgba(88,166,255,0.55);
  background: rgba(88,166,255,0.12);
  color: var(--text);
}

.clc-slider-tab-group {
  font-size: 0.67rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.clc-slider-tab-title {
  font-size: 0.84rem;
  font-weight: 700;
}

.clc-slider-table th[rowspan="2"] {
  vertical-align: middle;
}

.clc-slider-card {
  padding-top: 10px;
}

.clc-slider-bar-btn {
  width: 100%;
  min-width: 110px;
  border: 1px solid var(--border);
  background: #1b2232;
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.clc-slider-bar-track {
  position: relative;
  flex: 1;
  height: 20px;
  border-radius: 7px;
  background: rgba(255,255,255,0.08);
  overflow: hidden;
  display: flex;
  align-items: center;
}

.clc-slider-bar-fill {
  display: block;
  position: absolute;
  inset: 0 auto 0 0;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(88,166,255,0.38), rgba(88,166,255,0.92));
}

.clc-slider-bar-track-val {
  display: block;
  position: relative;
  z-index: 1;
  width: 100%;
  text-align: center;
  font-size: 0.82rem;
  line-height: 20px;
  color: var(--text);
  font-weight: 700;
}

.clc-slider-bar-btn.out .clc-slider-bar-fill {
  background: linear-gradient(90deg, rgba(255,166,88,0.38), rgba(255,166,88,0.92));
}

.clc-slider-bar-val {
  display: none;
}

.clc-slider-pair-cell {
  min-width: 150px;
}

.clc-slider-pair-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.clc-slider-mini-row {
  width: 100%;
  border: 1px solid var(--border);
  background: #1b2232;
  border-radius: 8px;
  padding: 6px 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.clc-slider-bar-btn.compact,
.clc-slider-mini-row.compact {
  padding: 5px 8px;
  gap: 6px;
}

.clc-slider-mini-row.compact .clc-slider-mini-io {
  display: none;
}

.clc-slider-bar-btn.compact .clc-slider-bar-val,
.clc-slider-mini-row.compact .clc-slider-bar-val {
  display: none;
}

.clc-slider-bar-btn.compact .clc-slider-bar-track,
.clc-slider-mini-row.compact .clc-slider-bar-track {
  height: 18px;
}

.clc-slider-bar-btn.compact .clc-slider-bar-track-val,
.clc-slider-mini-row.compact .clc-slider-bar-track-val {
  display: block;
  line-height: 18px;
}

.clc-slider-mini-row.out .clc-slider-bar-fill {
  background: linear-gradient(90deg, rgba(255,166,88,0.38), rgba(255,166,88,0.92));
}

.clc-slider-mini-row.empty {
  cursor: default;
  opacity: 0.5;
}

.clc-slider-mini-io {
  min-width: 14px;
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--text2);
}

.clc-th-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 22px;
}

.clc-col-resizer {
  position: absolute;
  top: -10px;
  right: -12px;
  bottom: -10px;
  width: 12px;
  cursor: col-resize;
}

.clc-col-resizer::after {
  content: '';
  position: absolute;
  top: 25%;
  bottom: 25%;
  right: 5px;
  width: 2px;
  border-radius: 999px;
  background: rgba(255,255,255,0.12);
}

.clc-detail-row td {
  background: rgba(255,255,255,0.02);
}

.clc-total-cell {
  text-align: center;
  white-space: nowrap;
}

.clc-total-amt {
  display: inline-block;
  min-width: 54px;
  padding: 6px 10px;
  border-radius: 8px;
  font-weight: 700;
  background: rgba(255,255,255,0.06);
}

.clc-total-amt.pos {
  color: #3fb950;
}

.clc-total-amt.neg {
  color: #f85149;
}

.clc-total-amt.neutral {
  color: var(--text2);
}

.clc-detail-trade-id {
  color: var(--text);
  font-weight: 700;
}

.clc-detail-sep {
  color: var(--text-muted);
  margin: 0 3px;
}

.clc-detail-pnl {
  font-weight: 700;
}

.clc-detail-pnl.pos {
  color: #3fb950;
}

.clc-detail-pnl.neg {
  color: #f85149;
}

.clc-detail-pnl.neutral {
  color: var(--text2);
}

.clc-blocks {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 14px;
}

.clc-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255,255,255,0.02);
  padding: 14px;
}

.clc-card-hdr {
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 12px;
}

.clc-occ-row {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.clc-occ-label {
  font-size: 0.78rem;
  color: var(--text2);
}

.clc-occ-bars {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.clc-occ-bar {
  border: 1px solid transparent;
  border-radius: 8px;
  min-height: 36px;
  cursor: pointer;
  font-weight: 700;
}

.clc-occ-bar.neg {
  color: #ffb4af;
  background: rgba(248,81,73,0.16);
  border-color: rgba(248,81,73,0.25);
}

.clc-occ-bar.pos {
  color: #b8f3c6;
  background: rgba(63,185,80,0.16);
  border-color: rgba(63,185,80,0.25);
}

.clc-occ-bar:disabled {
  cursor: default;
  opacity: 0.4;
}

.clc-occ-matrix {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.clc-occ-matrix-head,
.clc-occ-matrix-row {
  display: grid;
  grid-template-columns: minmax(130px, 1.2fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}

.clc-occ-matrix-head {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.clc-occ-matrix-label,
.clc-occ-option-label {
  font-size: 0.8rem;
  color: var(--text);
}

.clc-occ-mini-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.clc-occ-mini {
  min-height: 34px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-weight: 700;
  cursor: pointer;
}

.clc-occ-mini.neg {
  color: #ffb4af;
  background: rgba(248,81,73,0.16);
  border-color: rgba(248,81,73,0.24);
}

.clc-occ-mini.pos {
  color: #b8f3c6;
  background: rgba(63,185,80,0.16);
  border-color: rgba(63,185,80,0.24);
}

.clc-occ-mini:disabled {
  opacity: 0.45;
  cursor: default;
}

.clc-occ-option-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.clc-occ-option-row {
  display: grid;
  grid-template-columns: minmax(150px, 0.9fr) minmax(0, 1.8fr);
  gap: 12px;
  align-items: start;
}

.clc-occ-option-values {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.clc-occ-option-chip {
  min-width: 180px;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  padding: 10px;
  background: rgba(255,255,255,0.02);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.clc-occ-option-chip-label {
  font-size: 0.76rem;
  color: var(--text2);
}

.clc-popup-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1260;
  background: rgba(0,0,0,0.48);
  display: flex;
  align-items: center;
  justify-content: center;
}

.clc-popup {
  width: min(860px, 92vw);
  max-height: 80vh;
  overflow: hidden;
  background: #121826;
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 18px 50px rgba(0,0,0,0.65);
  display: flex;
  flex-direction: column;
}

.clc-popup-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}

.clc-popup-title {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text);
}

.clc-popup-sub {
  margin-top: 3px;
  font-size: 0.74rem;
  color: var(--text-muted);
}

.clc-popup-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.clc-popup-fields-btn {
  border: 1px solid var(--border);
  background: #1b2232;
  color: var(--text2);
  border-radius: 8px;
  padding: 7px 10px;
  cursor: pointer;
}

.clc-popup-field-picker {
  display: none;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  background: rgba(255,255,255,0.02);
  gap: 10px;
  flex-wrap: wrap;
}

.clc-popup-field-picker.open {
  display: flex;
}

.clc-popup-field-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text2);
  font-size: 0.78rem;
}

.clc-popup-table-wrap {
  overflow: auto;
  padding: 14px 16px 18px;
}

.clc-popup-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 640px;
  table-layout: fixed;
}

.clc-popup-table th,
.clc-popup-table td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  text-align: left;
  font-size: 0.8rem;
  vertical-align: top;
  white-space: normal;
  word-break: break-word;
}

.clc-popup-table th {
  position: sticky;
  top: 0;
  background: #121826;
  color: var(--text2);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

@media (max-width: 900px) {
  .clc-body {
    grid-template-columns: 1fr;
  }

  .clc-sidebar {
    border-right: none;
    border-bottom: 1px solid var(--border);
    flex-direction: row;
    overflow: auto;
  }

  .clc-side-btn {
    white-space: nowrap;
  }

  .clc-occ-row {
    grid-template-columns: 1fr;
  }
}
.cl-bell-col:hover { opacity: 0.75; }
.cl-bell-top {
  flex: 1; display: flex; align-items: flex-end;
}
.cl-bell-bot {
  flex: 1; display: flex; align-items: flex-start;
}
.cl-bell-bar {
  width: 100%; border-radius: 2px;
}
.cl-bell-bar-pos { border-top: 2px solid; border-radius: 2px 2px 0 0; }
.cl-bell-bar-neg { border-bottom: 2px solid; border-radius: 0 0 2px 2px; }
.cl-bell-tip {
  position: fixed; z-index: 9999;
  background: #1b2232; border: 1px solid var(--border);
  border-radius: 7px; padding: 7px 11px;
  font-size: 0.8rem; color: var(--text);
  pointer-events: none; min-width: 148px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}
.cl-tip-date  { color: var(--text-muted); font-size: 0.72rem; margin-bottom: 2px; }
.cl-tip-instr { font-weight: 600; margin-bottom: 3px; }
.cl-tip-pnl   { font-size: 1rem; font-weight: 700; }
.cl-tip-pts   { color: var(--text-muted); font-size: 0.75rem; margin-top: 2px; }

/* P/L bar chart */
.cl-day-chart {
  margin-bottom: 14px; display: flex; flex-direction: column; gap: 5px;
}
.cl-day-chart-row {
  display: flex; align-items: center; gap: 8px;
  border-radius: 4px; padding: 2px 4px;
  transition: background 0.12s;
}
.cl-day-chart-row:hover { background: rgba(255,255,255,0.04); }
.cl-day-chart-lbl {
  width: 18px; text-align: right; font-size: 0.72rem;
  color: var(--text-muted); flex-shrink: 0;
}
.cl-day-chart-track {
  flex: 1; height: 18px; background: rgba(255,255,255,0.04);
  border-radius: 3px; overflow: hidden;
}
.cl-day-chart-fill {
  height: 100%; border-radius: 3px;
  transition: width 0.3s ease;
}
.cl-day-chart-val {
  width: 72px; text-align: right; font-size: 0.78rem;
  font-weight: 600; flex-shrink: 0;
}

.cl-day-table-wrap {
  overflow-x: auto; border-radius: 8px;
  border: 1px solid var(--border);
}
.cl-day-table {
  width: 100%; border-collapse: collapse; font-size: 0.82rem;
}
.cl-day-table th {
  background: #1b2232; color: var(--text-muted); font-weight: 600;
  padding: 8px 10px; text-align: left; white-space: nowrap;
  border-bottom: 1px solid var(--border);
}
.cl-day-table td {
  padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.05);
  color: var(--text); white-space: nowrap;
}
.cl-day-table tbody tr:last-child td { border-bottom: none; }
.cl-day-table tbody tr:hover td { background: rgba(88,166,255,0.06); }
.cl-day-table tbody tr:focus { outline: none; }
.cl-day-table tbody tr:focus td { background: rgba(88,166,255,0.1); }
.cl-day-row-loss td { border-bottom: 1px solid rgba(248,81,73,0.35) !important; }
.cl-day-ttype {
  font-size: 0.7rem; color: var(--text-muted); margin-left: 4px;
  opacity: 0.75;
}

/* ── Conditional-frozen field ─────────────────────────────────────────────── */
.cl-field-frozen {
  opacity: 0.3;
  pointer-events: none;
  filter: grayscale(0.6);
  position: relative;
}
.cl-field-frozen::after {
  content: '🔒';
  position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
  font-size: 0.65rem; opacity: 0.7;
}

/* ── Bidirectional slider ─────────────────────────────────────────────────── */
.cl-bislider-wrap {
  display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0;
}
.cl-bislider-container {
  flex: 1; position: relative; height: 14px; display: flex; align-items: center;
}
.cl-bislider-track {
  position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); height: 4px;
  background: var(--border); border-radius: 2px;
}
.cl-bislider-track::before {
  content: ''; position: absolute; left: 50%; top: -3px;
  width: 2px; height: 10px; background: var(--text-muted); transform: translateX(-50%);
}
.cl-bislider-fill {
  position: absolute; top: 0; height: 100%;
  border-radius: 2px; pointer-events: none;
  transition: width 0.08s, left 0.08s, right 0.08s;
  background: var(--accent);
}
.cl-bislider {
  position: absolute; inset: 0; width: 100%; height: 100%;
  -webkit-appearance: none; appearance: none;
  background: transparent; cursor: pointer; margin: 0; outline: none; z-index: 2;
}
.cl-bislider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--accent); border: 2px solid var(--bg-secondary, #111);
  cursor: pointer; position: relative; z-index: 1;
}
.cl-bislider::-moz-range-thumb {
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--accent); border: 2px solid var(--bg-secondary, #111); cursor: pointer;
}
.cl-bislider-val {
  min-width: 32px; text-align: right;
  font-size: 0.85rem; font-weight: 600; color: var(--text-muted); flex-shrink: 0;
}

/* ── Body Vitals tab ──────────────────────────────────────────────────────── */
.cl-vitals-wrap { max-width: 560px; }
.cl-vitals-hdr {
  display: flex; align-items: baseline; gap: 12px; margin-bottom: 8px;
}
.cl-vitals-title { font-size: 1rem; font-weight: 700; color: var(--text); }
.cl-vitals-hint  { font-size: 0.75rem; color: var(--text-muted); }
.cl-vitals-axis {
  font-size: 0.7rem; color: var(--text-muted);
  padding: 0 0 6px 0;
  border-bottom: 1px solid var(--border); margin-bottom: 6px;
}
.cl-vitals-axis-container {
  display: flex; justify-content: space-between; flex: 1;
}
.cl-vitals-row {
  display: flex; align-items: center; gap: 14px;
  padding: 11px 0; border-bottom: 1px solid rgba(255,255,255,0.04);
}
.cl-vitals-row:last-child { border-bottom: none; }
.cl-vitals-label {
  font-size: 0.84rem; color: var(--text-muted); width: 180px; flex-shrink: 0;
}

/* ── Placeholder tabs ─────────────────────────────────────────────────────── */
.cl-ph-tab {
  border-style: dashed !important;
  border-color: var(--text-muted) !important;
  color: var(--text-muted) !important;
  font-style: italic;
}
.cl-ph-tab.active {
  background: rgba(88,166,255,0.08) !important;
  color: var(--accent) !important;
  border-color: var(--accent) !important;
  border-style: dashed !important;
}
.cl-ph-add-btn {
  opacity: 0.7;
  min-width: 28px !important;
  padding: 0 6px !important;
  font-size: 1.1rem !important;
  font-weight: 700;
  border-style: dashed !important;
}
.cl-ph-add-btn:hover { opacity: 1; color: var(--accent); border-color: var(--accent); }

/* ── Placeholder offer dialog ─────────────────────────────────────────────── */
.cl-ph-dialog {
  position: fixed; inset: 0; z-index: 10002;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.45);
}
.cl-ph-dlg-box {
  background: var(--bg-secondary, #1c1c1e);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 24px 28px;
  min-width: 320px;
  max-width: 420px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.cl-ph-dlg-title {
  font-size: 1rem; font-weight: 600; margin-bottom: 10px; color: var(--text);
}
.cl-ph-dlg-body {
  font-size: 0.88rem; color: var(--text-muted); margin-bottom: 18px; line-height: 1.5;
}
.cl-ph-dlg-hint {
  display: block; margin-top: 6px; font-size: 0.78rem; opacity: 0.7;
}
.cl-ph-dlg-btns { display: flex; gap: 10px; }

/* ── Placeholder right-click context menu ─────────────────────────────────── */
.cl-ph-ctx-menu {
  position: fixed; z-index: 10003;
  background: var(--bg-secondary, #1c1c1e);
  border: 1px solid var(--border);
  border-radius: 8px;
  min-width: 220px;
  max-width: 320px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.5);
  overflow: hidden;
}
.cl-ph-ctx-header {
  padding: 8px 12px 6px;
  font-size: 0.76rem;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.cl-ph-ctx-empty {
  padding: 10px 12px;
  font-size: 0.84rem;
  color: var(--text-muted);
  font-style: italic;
}
.cl-ph-ctx-item {
  display: block; width: 100%;
  padding: 8px 12px;
  text-align: left;
  background: none; border: none; cursor: pointer;
  font-size: 0.88rem; color: var(--text);
  border-radius: 0;
}
.cl-ph-ctx-item:hover { background: rgba(88,166,255,0.1); }
.cl-ph-ctx-sep {
  height: 1px; background: var(--border); margin: 2px 0;
}
.cl-ph-ctx-delete { color: var(--red) !important; }
.cl-ph-ctx-delete:hover { background: rgba(248,81,73,0.1) !important; }

/* Mobile: stack image above form */
@media (max-width: 620px) {
  .cl-cols { flex-direction: column; overflow-y: auto; }
  .cl-img-col { order: -1; padding: 10px 12px 0; max-height: 280px; overflow: visible; }
  .cl-img-viewer { max-height: 280px; }
  .cl-hero-img { max-height: 220px; }
  .cl-form-col { flex: unset !important; width: 100% !important; border-right: none; border-top: 1px solid var(--border); }
  .cl-resizer { display: none; }
  .cl-panel { max-height: 100vh; height: 100dvh; border-radius: 0; }
}

```

## File: `static/css/style-strategy-lab.css`
```css
        body { margin: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .lab-container { display: flex; height: 100vh; overflow: hidden; background: #f6f8fa; }
        .lab-sidebar { position: absolute; top: 0; left: 0; bottom: 0; width: 300px; background: white; border-right: 1px solid #d0d7de; padding: 20px; overflow-y: auto; z-index: 10000; transition: transform 0.3s ease; box-shadow: 2px 0 10px rgba(0,0,0,0.1); }
        .lab-sidebar.collapsed { transform: translateX(-100%); padding: 20px; }
        .sidebar-toggle-btn { position: absolute; left: 300px; top: 50%; transform: translateY(-50%); background: white; border: 1px solid #d0d7de; border-left: none; width: 22px; height: 60px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10002; border-radius: 0 8px 8px 0; transition: left 0.3s ease; font-size: 0.75rem; color: #0969da; font-weight: bold; }
        .lab-sidebar.collapsed + .sidebar-toggle-btn { left: 0; }
        .lab-main { flex: 1; position: relative; background: #ffffff; display: flex; flex-direction: column; }
        .loading-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255,255,255,0.8); display: none; align-items: center; justify-content: center; z-index: 1000; font-weight: 600; color: #0969da; }
        .nav-controls { display: flex; align-items: center; gap: 12px; padding:10px; border-bottom:1px solid #d0d7de; background:#f6f8fa; }
        .nav-btn { padding: 6px 15px; border: 1px solid #d0d7de; background: white; border-radius: 6px; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; transition: all 0.2s;}
        .nav-btn:hover { background: #f6f8fa; border-color: #0969da; color: #0969da; }
        .chart-wrapper { flex: 1; position: relative; display: flex; gap: 0; overflow: hidden; background: #fff; }
        .chart-container-box { position: relative; height: 100%; min-width: 0; }
        #container-main { flex: 1; }
        #container-opt { flex: 1; border-left: 1px solid #d0d7de; }
        .resizer { width: 6px; background: #cbd5e1; cursor: col-resize; z-index: 10001; transition: background 0.2s; position: relative; border-left: 1px solid #94a3b8; border-right: 1px solid #94a3b8; }
        .resizer:hover, .resizer.dragging { background: #0969da; border-color: #0969da; }
        .resizer::after { content: ''; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 2px; height: 30px; background: rgba(0,0,0,0.2); border-radius: 2px; }
        #chart-main, #chart-opt { height: 100%; width: 100%; }
        .chart-label { position: absolute; top: 10px; left: 10px; z-index: 10; background: rgba(255,255,255,0.9); padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; border: 1px solid #d0d7de; display: flex; align-items: center; gap: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .tf-btn-group { display: flex; gap: 2px; background: #f1f5f9; padding: 2px; border-radius: 4px; }
        .tf-btn { padding: 2px 6px; border: none; background: transparent; font-size: 0.65rem; cursor: pointer; border-radius: 3px; font-weight: 700; color: #64748b; }
        .tf-btn.active { background: white; color: #0969da; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
        .tf-btn:hover:not(.active) { background: #e2e8f0; }
        .setting-item { display: block; margin-bottom: 12px; font-size: 0.85rem; color: #1f2328; font-weight: 600; }
        .lab-btn { width: 100%; padding: 10px; border-radius: 6px; border: none; font-weight: 600; cursor: pointer; }
        .lab-btn-primary { background: #0969da; color: white; }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: none; align-items: center; justify-content: center; z-index: 2000; }
        .modal-content { background: #ffffff; padding: 25px; border-radius: 12px; width: 450px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .modal-title { font-size: 1.1rem; font-weight: 600; }
        .close-modal { cursor: pointer; font-size: 1.5rem; color: #666; }
        .toggle-group { margin-bottom: 15px; padding: 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
        .toggle-item { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 0.8rem; cursor: pointer; }
        
        /* Premium Pill Labels */
        .trade-label-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1000;
            overflow: hidden;
        }
        .trade-pill {
            position: absolute;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 800;
            color: white;
            transform: translate(-50%, -50%);
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: 'Inter', sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            line-height: 1.2;
            min-width: 40px;
            border: 1px solid rgba(255,255,255,0.2);
            z-index: 1001;
        }
        .pill-win { background: #059669; }
        .pill-loss { background: #dc2626; }
        .pill-neutral { background: #475569; }
        .pill-ce { border-bottom: 3px solid #f59e0b; }
        .pill-pe { border-bottom: 3px solid #8b5cf6; }

```

## File: `static/css/style-fullscreen.css`
```css
/* ── FULLSCREEN IMAGE VIEWER (INSTAGRAM REELS STYLE) ── */

.fs-viewer {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: #000;
    z-index: 10000;
    display: none;
    flex-direction: column;
    color: #fff;
    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    overflow: hidden;
    user-select: none;
    touch-action: none; /* Blocks browser's swipe-to-go-back */
}

.fs-viewer.open {
    display: flex;
}

/* ── HEADER (trading tray style) ── */
.fs-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    min-height: 72px;
    height: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 10px 54px;   /* reserve 54px on each side for back + lock buttons */
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 100;
    border-bottom: 1px solid rgba(255,255,255,0.1);
}

.fs-back-btn {
    position: absolute;
    left: 8px;
    background: none;
    border: none;
    color: rgba(255,255,255,0.8);
    cursor: pointer;
    padding: 6px 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    flex-shrink: 0;
    transition: background 0.15s;
}
.fs-back-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }

/* Date area (calendar icon + label + hidden date picker) */
.fs-date-wrap {
    display: flex;
    align-items: center;
    cursor: pointer;
    border-radius: 6px;
    padding: 3px 8px;
    transition: background 0.15s;
}
.fs-date-wrap:hover { background: rgba(255,255,255,0.1); }
.fs-date-wrap::before {
    content: '';
    display: inline-block;
    width: 13px;
    height: 13px;
    margin-right: 5px;
    flex-shrink: 0;
    opacity: 0.6;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='2' y='3' width='12' height='12' rx='1.5'/%3E%3Cpath d='M5 1v3M11 1v3M2 7h12'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-size: contain;
}

.fs-date-label {
    font-size: 0.82rem;
    font-weight: 600;
    color: rgba(255,255,255,0.9);
    white-space: nowrap;
    letter-spacing: 0.3px;
    font-variant-numeric: tabular-nums;
}

/* New structured header styles */
.fs-header #fs-header-instrument {
    font-size: 1.75rem !important; /* Made significantly larger */
    font-weight: 900;
    color: #fff;
    line-height: 1.1;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}
.fs-header #fs-header-details {
    gap: 15px !important;
    margin-top: 6px !important;
}
.fs-header #fs-header-details span {
    font-size: 1.05rem !important; /* Made significantly larger */
    color: rgba(255,255,255,0.8);
    font-weight: 600;
    background: rgba(255,255,255,0.08); /* Added chip-like feel */
    padding: 3px 10px;
    border-radius: 6px;
    letter-spacing: 0.3px;
}

/* Lock / focus mode button */
.fs-lock-btn {
    position: absolute;
    right: 8px;
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.7);
    cursor: pointer;
    font-size: 1rem;
    padding: 4px 8px;
    border-radius: 6px;
    transition: background 0.15s;
    flex-shrink: 0;
    user-select: none;
}
.fs-lock-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }

/* ── MAIN CONTENT (Slider) ── */
.fs-content {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
}

.fs-main-img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
}

.fs-dots {
    position: absolute;
    bottom: 20px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    gap: 6px;
    z-index: 100;
    pointer-events: none;
}

.fs-dot {
    height: 3px;
    width: 8px;
    background: rgba(255,255,255,0.3);
    border-radius: 2px;
    transition: all 0.2s;
}

.fs-dot.active {
    width: 20px;
    background: #fff;
}

/* Lock Mode Side Buttons (left/right = navigate images within trade) */
.fs-side-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    display: none; /* Shown via JS */
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.2);
    color: #fff;
    font-size: 1.6rem;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    pointer-events: auto;
    z-index: 10001;
    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    transition: transform 0.1s;
}
.fs-side-btn:active { transform: translateY(-50%) scale(0.88); }
.fs-side-left  { left: 12px; }
.fs-side-right { right: 12px; }

/* Lock Mode Corner Buttons (up/down = navigate dates) */
.fs-corner-btn {
    position: absolute;
    display: none; /* Shown via JS */
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.25);
    color: #fff;
    font-size: 1.6rem;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    pointer-events: auto;
    z-index: 10001;
    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    transition: transform 0.1s;
}
.fs-corner-btn:active { transform: scale(0.88); }
.fs-corner-bl { bottom: 20px; left: 20px; }
.fs-corner-br { bottom: 20px; right: 20px; }

/* Zoom Slider 스타일 */
.fs-zoom-slider-container {
    position: absolute;
    left: 20px;
    top: 50%;
    transform: translateY(-50%);
    width: 6px;
    height: 250px;
    display: none; /* Show via JS */
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 10001;
}

.fs-zoom-slider {
    -webkit-appearance: slider-vertical;
    appearance: slider-vertical;
    width: 4px;
    height: 220px;
    background: rgba(255,255,255,0.3) !important;
    border-radius: 4px;
    cursor: pointer;
    box-shadow: 0 0 10px rgba(0,0,0,0.5);
}

.fs-zoom-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    background: #ffffff;
    border-radius: 50%;
    box-shadow: 0 0 10px rgba(0,0,0,0.8);
}

.fs-zoom-label {
    margin-top: 15px;
    font-size: 10px;
    font-weight: 900;
    color: #fff;
    text-transform: uppercase;
    letter-spacing: 1px;
    background: rgba(0,0,0,0.5);
    padding: 2px 6px;
    border-radius: 10px;
    text-shadow: 0 1px 2px rgba(0,0,0,1);
}


/* ── SIDEBAR (Right) ── */
.fs-sidebar {
    position: absolute;
    right: 8px;
    bottom: 120px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    z-index: 10;
}

.fs-action-btn {
    background: none;
    border: none;
    color: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    cursor: pointer;
}

.fs-action-icon {
    font-size: 28px;
    transition: transform 0.1s;
}

.fs-action-btn:active .fs-action-icon {
    transform: scale(0.8);
}

.fs-action-label {
    font-size: 12px;
    font-weight: 500;
}

/* ── BOTTOM INFO ── */
.fs-bottom {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 16px;
    background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
    z-index: 10;
}

.fs-user-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
}

.fs-user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.2);
}

.fs-username {
    font-weight: 600;
    font-size: 14px;
}

.fs-follow-btn {
    border: 1px solid rgba(255,255,255,0.4);
    background: none;
    color: #fff;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
}

.fs-caption {
    font-size: 14px;
    line-height: 1.4;
    margin-bottom: 12px;
    max-width: 80%;
}

.fs-comment-input-row {
    display: flex;
    align-items: center;
    background: rgba(255,255,255,0.1);
    border-radius: 20px;
    padding: 8px 16px;
    gap: 10px;
}

.fs-comment-input {
    flex: 1;
    background: none;
    border: none;
    color: #fff;
    font-size: 13px;
    outline: none;
}

.fs-comment-input::placeholder {
    color: rgba(255,255,255,0.5);
}

.fs-emoji-btn {
    font-size: 18px;
    cursor: pointer;
}

```
