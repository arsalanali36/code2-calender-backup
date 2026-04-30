# CSS - Trade Table and Misc
Consolidated code context for AI assistants.


## File: `static/css/style-trade.css`
```css
/* ── TRADE REVIEW POPUP ──────────────────────── */
.tr-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 2200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tr-modal {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--radius);
  box-shadow: 0 12px 60px rgba(0, 0, 0, 0.8);
  width: min(860px, 96vw);
  height: 92vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tr-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface2);
  flex-shrink: 0;
  gap: 10px;
}

.tr-hdr-title {
  font-weight: 700;
  font-size: 0.92rem;
  color: var(--text);
}

.tr-close {
  background: none;
  border: none;
  color: var(--text2);
  cursor: pointer;
  font-size: 1rem;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.12s;
  line-height: 1;
}

.tr-close:hover {
  background: var(--bg3, var(--bg2));
  color: var(--text);
}

/* Tabs */
.tr-tabs {
  display: flex;
  gap: 2px;
  padding: 8px 12px 0;
  background: var(--surface2);
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  flex-shrink: 0;
}

.tr-tab {
  background: var(--bg);
  border: 1px solid var(--border2);
  border-bottom: none;
  color: var(--text2);
  padding: 5px 14px;
  border-radius: 6px 6px 0 0;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}

.tr-tab:hover {
  background: var(--bg2);
  color: var(--text);
}

.tr-tab-active {
  background: var(--surface);
  border-color: var(--blue);
  color: var(--blue);
  font-weight: 600;
}

/* Body */
.tr-body {
  flex: 1;
  overflow-y: scroll;
  padding: 10px 4px 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  scrollbar-width: auto;
  scrollbar-color: var(--text2) var(--bg2);
}

.tr-body::-webkit-scrollbar {
  width: 8px;
}

.tr-body::-webkit-scrollbar-thumb {
  background: var(--text2);
  border-radius: 4px;
  opacity: 0.5;
}

.tr-body::-webkit-scrollbar-track {
  background: var(--bg2);
  border-radius: 4px;
}

/* Block container */
.tr-block {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  flex-shrink: 0;
}

.tr-block-head {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--blue);
  padding: 6px 12px;
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tr-block-body {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}


/* Block 1 — Dashboard stats */
.tr-dash-row {
  display: flex;
  gap: 10px;
}

.tr-dash-box {
  flex: 1;
  background: var(--bg);
  border: 1px solid var(--border2);
  border-radius: var(--radius);
  padding: 10px 12px;
  text-align: center;
  min-height: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.tr-dash-lbl {
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text2);
  margin-bottom: 6px;
}

.tr-dash-val {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text);
  line-height: 1;
}

/* Block 2 — Setup fields */
.tr-field-row4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.tr-field-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--bg);
  border: 1px solid var(--border2);
  border-radius: var(--radius);
  padding: 7px 10px;
}

.tr-field-lbl {
  font-size: 0.62rem;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.tr-field-inp {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border2);
  color: var(--text);
  padding: 2px 4px;
  font-size: 0.9rem;
  font-weight: 600;
  outline: none;
  font-family: inherit;
  transition: border-color 0.12s;
  min-width: 0;
}

.tr-field-inp:focus {
  border-bottom-color: var(--blue);
}

/* Header date navigation */
.tr-hdr-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tr-date-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tr-date-arrow {
  background: none;
  border: 1px solid var(--border2);
  color: var(--text2);
  cursor: pointer;
  border-radius: 4px;
  padding: 1px 7px;
  font-size: 0.78rem;
  transition: all 0.12s;
  line-height: 1.4;
}

.tr-date-arrow:hover {
  background: var(--bg2);
  color: var(--text);
}

.tr-date-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text);
  min-width: 88px;
  text-align: center;
}

/* Block 3 tag controls */
.tr-tag-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.tr-tag-ctrl-btn {
  background: var(--bg);
  border: 1px solid var(--border2);
  color: var(--text2);
  cursor: pointer;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 0.68rem;
  font-weight: 600;
  transition: all 0.12s;
  white-space: nowrap;
  text-transform: none;
  letter-spacing: 0;
}

.tr-tag-ctrl-btn:hover {
  background: var(--bg2);
  color: var(--text);
}

.tr-tag-ctrl-del-on {
  background: rgba(248, 81, 73, 0.18);
  border-color: var(--red);
  color: var(--red);
}

.tr-tag-chip.del-mode {
  cursor: pointer;
  opacity: 0.75;
  color: var(--red);
  border-color: rgba(248, 81, 73, 0.4);
}

.tr-tag-chip.del-mode:hover {
  background: rgba(248, 81, 73, 0.2);
  border-color: var(--red);
  opacity: 1;
}

/* Block 3 — Tags: columnar layout */
.tr-tag-cols-wrap {
  position: relative;
}

.tr-tag-cols-wrap::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 28px;
  background: linear-gradient(to right, transparent, var(--surface2));
  pointer-events: none;
  border-radius: 0 var(--radius) var(--radius) 0;
}

.tr-tag-cols {
  display: flex;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  scrollbar-width: auto;
  scrollbar-color: var(--text2) var(--bg2);
  padding-right: 28px;
}

.tr-tag-cols::-webkit-scrollbar {
  height: 7px;
}

.tr-tag-cols::-webkit-scrollbar-thumb {
  background: var(--text2);
  border-radius: 4px;
}

.tr-tag-cols::-webkit-scrollbar-track {
  background: var(--bg2);
}

.tr-tag-col {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  min-width: 190px;
  max-width: 200px;
  /* Force to not expand horizontally */
  padding: 8px 10px;
  border-right: 1px solid var(--border);
  flex-shrink: 0;
}

.tr-tag-col:last-child {
  border-right: none;
}

.tr-tag-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap: 6px;
  width: 100%;
}

.tr-tag-flat-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px;
  max-height: 250px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  scrollbar-width: auto;
  scrollbar-color: var(--text2) var(--bg2);
}

.tr-tag-flat-wrap::-webkit-scrollbar {
  width: 8px;
}

.tr-tag-flat-wrap::-webkit-scrollbar-thumb {
  background: var(--text2);
  border-radius: 4px;
}

.tr-tag-flat-wrap::-webkit-scrollbar-track {
  background: var(--bg2);
}

.tr-tag-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  color: inherit;
  font-size: 0.62rem;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  margin-left: 6px;
  padding: 0 4px;
  line-height: 1;
}

.tr-tag-col-hdr {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--blue);
  padding-bottom: 5px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 2px;
  width: 100%;
  white-space: nowrap;
}

/* Block 3 — Tags (legacy tab classes kept for compat) */
.tr-grp-tabbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}

.tr-grp-tab {
  background: var(--bg);
  border: 1px solid var(--border2);
  color: var(--text2);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}

.tr-grp-tab:hover {
  background: var(--bg2);
  color: var(--text);
}

.tr-grp-tab-active {
  background: rgba(88, 166, 255, 0.18);
  border-color: var(--blue);
  color: var(--blue);
}

.tr-tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.tr-tag-chip {
  padding: 4px 13px;
  border-radius: 20px;
  border: 1px solid var(--border2);
  background: var(--bg2);
  color: var(--text2);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
}

.tr-tag-chip:hover {
  opacity: 0.75;
}

.tr-tag-chip.on {
  font-weight: 700;
}

/* Block 4 — Sliders */
.tr-sl-lbl {
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tr-sl-val {
  font-size: 0.85rem;
  font-weight: 700;
}

.tr-slider {
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}

.tr-slider::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--sl-color, var(--blue));
  border: 2px solid var(--surface);
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.4);
  cursor: pointer;
}

.tr-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--sl-color, var(--blue));
  border: 2px solid var(--surface);
  cursor: pointer;
  box-sizing: border-box;
}

/* ==================================
   LAYOUT: VERTICAL
   ================================== */
.tr-slider-list.layout-vertical {
  display: flex;
  flex-direction: row;
  overflow-x: auto;
  gap: 24px;
  padding: 10px 4px 16px 4px;
}

.tr-slider-list.layout-vertical .tr-slider-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 70px;
  flex-shrink: 0;
}

.tr-slider-list.layout-vertical .tr-sl-lbl {
  width: 100%;
  text-align: center;
}

.tr-slider-list.layout-vertical .tr-sl-wrap {
  display: flex;
  flex-direction: column;
  height: 120px;
  gap: 8px;
  align-items: center;
  justify-content: center;
}

.tr-slider-list.layout-vertical .tr-slider {
  width: 6px;
  height: 100%;
  appearance: slider-vertical;
  -webkit-appearance: slider-vertical;
  writing-mode: bt-lr;
  /* fallback */
  background: linear-gradient(to top, var(--red) 0%, var(--border2) 50%, var(--green) 100%);
}

.tr-slider-list.layout-vertical .tr-sl-val {
  width: 100%;
  text-align: center;
}

/* ==================================
   LAYOUT: HORIZONTAL
   ================================== */
.tr-slider-list.layout-horizontal {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 10px 4px 16px 4px;
}

.tr-slider-list.layout-horizontal .tr-slider-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
}

.tr-slider-list.layout-horizontal .tr-sl-lbl {
  width: 90px;
  flex-shrink: 0;
  text-align: left;
}

.tr-slider-list.layout-horizontal .tr-sl-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
}

.tr-slider-list.layout-horizontal .tr-slider {
  width: 100%;
  height: 6px;
  appearance: none;
  -webkit-appearance: none;
  background: linear-gradient(to right, var(--red) 0%, var(--border2) 50%, var(--green) 100%);
}

.tr-slider-list.layout-horizontal .tr-sl-val {
  width: 40px;
  flex-shrink: 0;
  text-align: right;
}

/* Hint text */
.tr-hint {
  color: var(--text2);
  font-size: 0.8rem;
  font-style: italic;
  margin: 0;
}

/* ── TRADE LOGGER ─────────────────────────────── */
.tl-modal {
  width: min(850px, 95vw);
}

.tl-body {
  padding: 14px;
}

.tl-block {
  margin-bottom: 12px;
}

.tl-block-body {
  padding: 12px;
}

.tl-dash-inp {
  width: 60px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  color: var(--text);
  border-radius: 4px;
  padding: 2px 4px;
  text-align: center;
}

.tl-grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.tl-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.tl-grid-1 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.tl-col-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--blue);
  border-bottom: 1px solid var(--border2);
  margin-bottom: 8px;
  padding-bottom: 4px;
}

.tl-fieldgroup {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 6px;
}

.tl-flex-row {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.tl-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.tl-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text2);
}

.tl-cb-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  color: var(--text);
}

.tl-select,
.tl-input {
  background: var(--surface2);
  border: 1px solid var(--border2);
  color: var(--text);
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 0.82rem;
  width: 100%;
}

.tl-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
}

.tl-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.tl-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--surface2);
  border: 1px solid var(--border2);
  transition: .2s;
  border-radius: 24px;
}

.tl-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 2px;
  bottom: 2px;
  background-color: var(--text2);
  transition: .2s;
  border-radius: 50%;
}

.tl-slider:after {
  content: attr(data-off);
  position: absolute;
  right: 6px;
  top: 4px;
  font-size: 0.65rem;
  font-weight: bold;
  color: var(--text2);
}

input:checked+.tl-slider {
  background-color: rgba(46, 160, 67, 0.2);
  border-color: var(--green);
}

input:checked+.tl-slider:before {
  transform: translateX(24px);
  background-color: var(--green);
}

input:checked+.tl-slider:after {
  content: attr(data-on);
  left: 6px;
  right: auto;
  color: var(--green);
}

.tl-tristate {
  display: inline-flex;
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 4px;
  overflow: hidden;
}

.tl-yn-btn {
  background: transparent;
  color: var(--text2);
  border: none;
  padding: 3px 12px;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  outline: none;
  transition: all 0.15s;
}

.tl-yn-btn:not(:last-child) {
  border-right: 1px solid var(--border2);
}

.tl-yn-btn.active-y {
  background: rgba(46, 160, 67, 0.2);
  color: var(--green);
}

.tl-yn-btn.active-n {
  background: rgba(248, 81, 73, 0.2);
  color: var(--red);
}

.tl-error {
  outline: 1px solid var(--red);
  background: rgba(248, 81, 73, 0.05);
  border-radius: 4px;
}

.tl-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.tl-input:focus,
.tl-select:focus,
.tl-dash-inp:focus {
  border-color: var(--blue);
  outline: none;
}

.tl-yn-btn:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: -2px;
  background: rgba(88, 166, 255, 0.1);
}

.tl-cb-label input:focus-visible {
  outline: 2px solid var(--blue);
}

/* LOGGER UI refresh (from LOGGER.zip visual mapping) */
.tl-modal {
  width: min(1360px, 98vw);
  border-radius: 16px;
  border: 1px solid #2f3f57;
  background: linear-gradient(180deg, #1f2c42 0%, #1a263a 100%);
  box-shadow: 0 26px 70px rgba(0, 0, 0, 0.7);
}

.tl-modal .tr-hdr {
  padding: 16px 22px 12px;
  background: rgba(18, 29, 45, 0.65);
  border-bottom: 1px solid #25354c;
}

.tl-modal .tr-hdr-title {
  font-size: 2rem;
  line-height: 1;
  font-weight: 800;
  letter-spacing: 0.01em;
  color: #f4f7fc;
}

.tl-modal .tr-date-nav {
  margin-top: 8px;
  gap: 12px;
}

.tl-modal .tr-date-label {
  min-width: 128px;
  color: #f4f7fc;
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1;
}

.tl-modal .tr-date-arrow {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid #2a3a51;
  color: #a8b5c6;
  font-size: 1.05rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tl-modal .tr-date-arrow:hover {
  background: #24354d;
  color: #e7edf6;
}

.tl-modal .tr-close {
  min-height: 32px;
  border-radius: 10px;
  border: 1px solid transparent;
  padding: 0 10px;
  color: #c7d0dc;
}

.tl-modal .tr-close:hover {
  background: #233248;
  color: #fff;
  border-color: #2f415a;
}

.tl-modal .tr-tabs {
  padding: 10px 20px 0;
  gap: 6px;
  background: rgba(18, 29, 45, 0.58);
  border-bottom: 1px solid #27384f;
}

.tl-modal .tr-tab {
  min-width: 62px;
  text-align: center;
  padding: 8px 14px;
  border-radius: 11px 11px 0 0;
  font-size: 1.18rem;
  font-weight: 700;
  border-color: #31445d;
  background: #0e1625;
}

.tl-modal .tr-tab:hover {
  background: #18273a;
}

.tl-modal .tr-tab-active {
  background: #0f1d30;
  border-color: #3ea8ff;
  color: #63b7ff;
  box-shadow: inset 0 -2px 0 #3ea8ff;
}

.tl-body {
  background: rgba(17, 25, 39, 0.52);
  padding: 16px;
  gap: 14px;
}

.tl-block {
  border: 1px solid #2c3e55;
  border-radius: 14px;
  background: linear-gradient(180deg, #1f2f46 0%, #1c2b41 100%);
}

.tl-block-body {
  padding: 14px;
  gap: 12px;
}

.tl-dash-inp {
  width: 86px;
  min-height: 32px;
  background: #22344b;
  border: 1px solid #2f455f;
  color: #c6d1df;
  border-radius: 8px;
  padding: 4px 8px;
  text-align: center;
  font-weight: 700;
}

.tl-modal .tr-dash-row {
  gap: 12px;
}

.tl-modal .tr-dash-box {
  min-height: 98px;
  border-radius: 14px;
  border: 1px solid #2f4159;
  background: linear-gradient(180deg, #091321 0%, #071120 100%);
}

.tl-modal .tr-dash-lbl {
  font-size: 0.84rem;
  letter-spacing: 0.08em;
  color: #8ea0b5;
}

.tl-modal .tr-dash-val {
  font-size: 2.25rem;
  font-weight: 800;
}

.tl-col-title {
  font-size: 0.84rem;
  font-weight: 800;
  color: #80bfff;
  border-bottom: 1px solid #314258;
  margin-bottom: 10px;
  padding-bottom: 6px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.tl-field {
  gap: 6px;
  margin-bottom: 10px;
}

.tl-label {
  font-size: 0.98rem;
  font-weight: 700;
  color: #8f9fb2;
}

.tl-cb-label {
  gap: 8px;
  font-size: 1.06rem;
  color: #dce4ee;
  cursor: pointer;
}

.tl-select,
.tl-input {
  background: #22344b;
  border: 1px solid #30445d;
  color: #e7edf6;
  padding: 9px 11px;
  border-radius: 10px;
  font-size: 1rem;
}

.tl-tristate {
  background: #0d1828;
  border: 1px solid #30445d;
  border-radius: 10px;
}

.tl-yn-btn {
  color: #92a1b3;
  min-width: 64px;
  padding: 7px 14px;
  font-size: 0.95rem;
  font-weight: 800;
}

.tl-yn-btn:not(:last-child) {
  border-right: 1px solid #2f425b;
}

.tl-yn-btn.active-y {
  background: rgba(34, 197, 94, 0.22);
  color: #3fe37d;
}

.tl-yn-btn.active-n {
  background: rgba(248, 81, 73, 0.2);
  color: #ff6961;
}

.tl-input:focus,
.tl-select:focus,
.tl-dash-inp:focus {
  border-color: #3ea8ff;
  outline: none;
  box-shadow: 0 0 0 2px rgba(62, 168, 255, 0.2);
}

.tl-yn-btn:focus-visible {
  outline: 2px solid #3ea8ff;
  outline-offset: -2px;
  background: rgba(88, 166, 255, 0.1);
}

.tl-cb-label input:focus-visible {
  outline: 2px solid #3ea8ff;
}

@media (max-width: 1200px) {
  .tl-modal .tr-hdr-title { font-size: 1.5rem; }
  .tl-modal .tr-date-label { font-size: 1.25rem; }
  .tl-modal .tr-tab { font-size: 1rem; min-width: 52px; }
  .tl-modal .tr-dash-val { font-size: 1.75rem; }
}

@media (max-width: 900px) {
  .tl-grid-3,
  .tl-grid-2 { grid-template-columns: 1fr; }

  .tl-modal .tr-dash-row { flex-wrap: wrap; }

  .tl-modal .tr-dash-box { min-width: calc(50% - 8px); }
}

/* LOGGER 1:1 tuning pass */
.tl-modal {
  width: min(1500px, 97vw);
}

.tl-modal .tr-hdr-title {
  font-size: 3.2rem;
  font-weight: 800;
}

.tl-modal .tr-date-label {
  font-size: 3rem;
  min-width: 178px;
}

.tl-modal .tr-close {
  font-size: 2rem;
}

.tl-modal .tr-tab {
  font-size: 2rem;
  min-width: 86px;
  padding: 10px 16px;
}

.tl-modal .tr-block-head {
  align-items: center;
  gap: 8px;
  font-size: 1.05rem;
  letter-spacing: 0.14em;
  padding: 12px 16px;
}

.tl-head-icon {
  color: #23b8ff;
  font-size: 0.95em;
  line-height: 1;
}

.tl-head-title {
  color: #f8fbff;
  font-weight: 800;
}

.tl-modal .tr-dash-lbl {
  font-size: 1.1rem;
  font-weight: 700;
}

.tl-modal .tr-dash-val {
  font-size: 2.4rem;
}

.tl-label {
  font-size: 1.45rem;
}

.tl-select,
.tl-input {
  font-size: 1.4rem;
  min-height: 58px;
}

.tl-tristate {
  min-height: 54px;
}

.tl-yn-btn {
  min-width: 66px;
  font-size: 1.4rem;
  padding: 7px 16px;
}

.tl-em-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.tl-em-row > .tl-block {
  margin-bottom: 0;
}

.tl-em-row .tl-grid-3 {
  grid-template-columns: 1fr;
  gap: 10px;
}

.tl-em-row .tl-grid-2 {
  grid-template-columns: 1fr;
  gap: 10px;
}

.tl-em-row .tl-col-title {
  font-size: 1.15rem;
}

@media (max-width: 1600px) {
  .tl-modal .tr-hdr-title { font-size: 2.3rem; }
  .tl-modal .tr-date-label { font-size: 2rem; min-width: 140px; }
  .tl-modal .tr-close { font-size: 1.25rem; }
  .tl-modal .tr-tab { font-size: 1.3rem; min-width: 64px; }
  .tl-label { font-size: 1.05rem; }
  .tl-select, .tl-input { font-size: 1rem; min-height: 42px; }
  .tl-tristate { min-height: 40px; }
  .tl-yn-btn { font-size: 0.98rem; min-width: 48px; }
}

@media (max-width: 1100px) {
  .tl-em-row {
    grid-template-columns: 1fr;
  }
}

/* Final tune: lucide-like compact sizing */
.tl-modal {
  font-family: Inter, "Segoe UI", Roboto, Arial, sans-serif;
}

.tl-modal .tr-hdr-title {
  font-size: clamp(1.15rem, 1.4vw, 1.75rem);
  font-weight: 800;
}

.tl-modal .tr-date-label {
  font-size: clamp(0.95rem, 1.2vw, 1.35rem);
  min-width: 116px;
}

.tl-modal .tr-close {
  font-size: 1rem;
}

.tl-modal .tr-tab {
  font-size: 1.05rem;
  min-width: 54px;
  padding: 8px 12px;
}

.tl-modal .tr-block-head {
  font-size: 0.72rem;
  padding: 10px 14px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.tl-head-icon.tl-head-icon-svg {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  opacity: 0.95;
}

.tl-head-icon.tl-head-icon-svg svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}

.tl-head-title {
  color: #f8fafc;
  font-size: 0.95em;
}

.tl-modal .tr-dash-lbl {
  font-size: 0.76rem;
}

.tl-modal .tr-dash-val {
  font-size: clamp(1.55rem, 1.8vw, 2rem);
}

.tl-label {
  font-size: 0.78rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.tl-select,
.tl-input {
  font-size: 0.86rem;
  min-height: 38px;
  padding: 7px 10px;
}

.tl-tristate {
  min-height: 34px;
}

.tl-yn-btn {
  min-width: 44px;
  font-size: 0.88rem;
  padding: 5px 10px;
}

.tl-em-row .tl-grid-3,
.tl-em-row .tl-grid-2 {
  gap: 8px;
}

.tl-col-title {
  font-size: 0.7rem;
  letter-spacing: 0.09em;
}

@media (max-width: 1280px) {
  .tl-modal .tr-tab {
    font-size: 0.95rem;
    min-width: 50px;
  }

  .tl-label {
    font-size: 0.74rem;
  }
}

/* Final micro polish after screenshot */
.tl-modal .tr-hdr { padding: 12px 18px 10px; }
.tl-modal .tr-tabs { padding: 8px 14px 0; gap: 5px; }
.tl-modal .tr-tab { min-width: 56px; padding: 6px 10px; border-radius: 10px 10px 0 0; font-size: 1rem; }
.tl-body { padding: 12px; gap: 12px; }
.tl-block { border-radius: 12px; background: linear-gradient(180deg, #1d2b41 0%, #1a273c 100%); }
.tl-block-body { padding: 10px 12px 12px; gap: 9px; }
.tl-modal .tr-dash-box { min-height: 86px; border-radius: 12px; }
.tl-field { gap: 5px; margin-bottom: 8px; }
.tl-label { font-size: 0.76rem; color: #93a4b9; letter-spacing: 0.05em; text-transform: uppercase; }
.tl-select, .tl-input { font-size: 0.84rem; min-height: 36px; padding: 6px 10px; border-radius: 8px; }
.tl-tristate { min-height: 32px; }
.tl-yn-btn { min-width: 42px; font-size: 0.84rem; padding: 4px 10px; }
.tl-yn-btn.active-y { color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.7); box-shadow: 0 0 18px rgba(34, 197, 94, 0.35); }
.tl-yn-btn.active-n { color: #fb7185; border: 1px solid rgba(251, 113, 133, 0.72); box-shadow: 0 0 18px rgba(251, 113, 133, 0.35); }
.tl-head-icon.tl-head-icon-svg { width: 16px; height: 16px; color: #7dd3fc; }
.tl-head-icon.tl-head-icon-svg svg { width: 16px; height: 16px; }

@media (max-width: 1280px) {
  .tl-modal .tr-hdr-title { font-size: 1.35rem; }
  .tl-modal .tr-date-label { font-size: 1.05rem; min-width: 112px; }
}

/* Psyco (Emotions) block */
.tl-psy-wrap {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.tl-psy-card {
  border: 1px solid #2d4159;
  border-radius: 12px;
  padding: 10px;
  background: rgba(7, 18, 34, 0.55);
}

.tl-psy-title {
  text-align: center;
  color: #f8fafc;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  margin: 2px 0 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #2c3f58;
}

.tl-psy-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.tl-psy-col {
  border: 1px solid #2a3d55;
  border-radius: 11px;
  padding: 10px;
}

.tl-psy-col-pos {
  background: linear-gradient(180deg, rgba(16,185,129,0.04), rgba(16,185,129,0.01));
}

.tl-psy-col-neg {
  background: linear-gradient(180deg, rgba(244,63,94,0.04), rgba(244,63,94,0.01));
}

.tl-psy-col-head {
  text-align: center;
  font-weight: 800;
  font-size: 0.9rem;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid #2a3d55;
}

.tl-psy-col-pos .tl-psy-col-head { color: #00f5c3; }
.tl-psy-col-neg .tl-psy-col-head { color: #ff5f87; }

@media (max-width: 1100px) {
  .tl-psy-wrap,
  .tl-psy-grid { grid-template-columns: 1fr; }
}

/* Compact zoom-out pass */
.tl-modal {
  font-size: 0.88rem;
}

.tl-modal .tr-hdr {
  padding: 10px 14px 8px;
}

.tl-modal .tr-hdr-title {
  font-size: clamp(1rem, 1.1vw, 1.35rem);
}

.tl-modal .tr-date-label {
  font-size: clamp(0.88rem, 1vw, 1.1rem);
  min-width: 96px;
}

.tl-modal .tr-tabs {
  padding: 6px 10px 0;
}

.tl-modal .tr-tab {
  min-width: 48px;
  padding: 5px 8px;
  font-size: 0.9rem;
}

.tl-body {
  padding: 10px;
  gap: 10px;
}

.tl-block-body {
  padding: 8px 10px 10px;
}

.tl-label {
  font-size: 0.7rem;
}

.tl-select,
.tl-input {
  min-height: 32px;
  font-size: 0.78rem;
  padding: 5px 8px;
}

.tl-tristate {
  min-height: 29px;
}

.tl-yn-btn {
  min-width: 36px;
  font-size: 0.78rem;
  padding: 3px 8px;
}

.tl-modal .tr-dash-lbl {
  font-size: 0.68rem;
}

.tl-modal .tr-dash-val {
  font-size: clamp(1.3rem, 1.4vw, 1.7rem);
}

.tl-psy-title {
  font-size: 0.85rem;
}

@media (max-width: 1280px) {
  .tl-modal {
    font-size: 0.84rem;
  }
}

/* User requested: popup shell shrink by ~25% for outer margins */
.tl-modal {
  width: min(1125px, 74vw) !important;
  height: 70vh !important;
  max-height: 70vh !important;
}

/* Dimension tweak: narrower width, taller height */
.tl-modal {
  width: min(980px, 66vw) !important;
  height: 78vh !important;
  max-height: 78vh !important;
}

/* User tweak: increase vertical height further */
.tl-modal {
  height: 84vh !important;
  max-height: 84vh !important;
}

```

## File: `static/css/style-trade-sidebar.css`
```css
/* style-trade-sidebar.css - Premium Side Panel for Trade Thumbnails */

.trade-sidebar-overlay {
    position: fixed;
    top: 0;
    right: 0;
    width: 0; /* Animated */
    height: 100%;
    background: rgba(13, 17, 23, 0.95);
    backdrop-filter: blur(12px);
    box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
    z-index: 10000;
    overflow: hidden;
    transition: width 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
    display: flex;
    flex-direction: column;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.trade-sidebar-overlay.open {
    width: 400px; /* Default width */
}

.trade-sidebar-header {
    padding: 16px;
    padding-top: calc(env(safe-area-inset-top, 0px) + 16px); /* Respects iPad status bar/battery */
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 15px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(22, 27, 34, 0.9);
    flex-shrink: 0;
    position: relative;
    z-index: 10;
}

.trade-sidebar-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: #fff;
    letter-spacing: 0.5px;
}

.trade-sidebar-close {
    background: rgba(248, 81, 73, 0.1);
    border: 1px solid rgba(248, 81, 73, 0.2);
    color: #f85149;
    font-size: 1.2rem;
    cursor: pointer;
    width: 48px;  /* Minimum touch target size recommended by Apple */
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
}

.trade-sidebar-close:hover {
    background: rgba(248, 81, 73, 0.25);
    color: #fff;
    transform: rotate(90deg) scale(1.1);
    border-color: rgba(248, 81, 73, 0.6);
}

.trade-sidebar-close:active {
    transform: scale(0.9);
}

/* On iPads/Touch, make it even more prominent */
.is-touch .trade-sidebar-close {
    width: 54px;
    height: 54px;
    font-size: 1.4rem;
    background: rgba(255, 255, 255, 0.08); /* White circle for better visibility near colorful battery icons */
    color: #fff;
    border-color: rgba(255, 255, 255, 0.2);
}

.trade-sidebar-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 15px;
}

/* RESIZER */
.trade-sidebar-resizer {
    position: absolute;
    top: 0;
    left: 0;
    width: 6px;
    height: 100%;
    cursor: ew-resize;
    z-index: 10001;
    transition: background 0.2s;
}

.trade-sidebar-resizer:hover {
    background: rgba(88, 166, 255, 0.3);
}

/* THUMBNAILS */
.trade-sidebar-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--thumb-size, 180px), 1fr));
    gap: 12px;
}

.ts-thumb-wrap {
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    background: #0d1117;
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: transform 0.2s, border-color 0.2s;
    cursor: pointer;
    aspect-ratio: 16/9;
}

.ts-thumb-wrap:hover {
    transform: scale(1.03);
    border-color: #58a6ff;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.4);
}

.ts-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

/* SIZE CONTROLS */
.ts-controls {
    padding: 10px 20px;
    background: rgba(22, 27, 34, 0.5);
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    gap: 15px;
}

.ts-size-slider {
    flex: 1;
    accent-color: #58a6ff;
    cursor: pointer;
}

.ts-size-label {
    font-size: 0.75rem;
    color: #8b949e;
    min-width: 60px;
    text-align: right;
}

/* TRADE INFO CARD */
.ts-info-card {
    background: rgba(88, 166, 255, 0.05);
    border: 1px solid rgba(88, 166, 255, 0.1);
    border-radius: 12px;
    padding: 15px;
    margin-bottom: 20px;
}

.ts-info-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
    font-size: 0.85rem;
}

.ts-info-label {
    color: #8b949e;
}

.ts-info-value {
    color: #f0f6fc;
    font-weight: 600;
}

.ts-pnl-win { color: #3fb950; }
.ts-pnl-loss { color: #f85149; }

@media (max-width: 600px) {
    .trade-sidebar-overlay.open {
        width: 100%;
    }
}

```

## File: `static/css/style-misc.css`
```css
/* ── Panel Tabs (Columns / Tags popups) ──────── */
.panel-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  margin-bottom: 2px;
  flex-shrink: 0;
}

.panel-tab {
  flex: 1;
  padding: 7px 6px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text2);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  transition: all 0.15s;
}

.panel-tab:hover { color: var(--text); }

.panel-tab.active {
  color: var(--blue);
  border-bottom-color: var(--blue);
}

.panel-tab-pane {
  overflow-y: auto;
  max-height: 55vh;
}

.panel-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 12px;
  padding: 6px 10px;
}

/* ── PROFILE AVATAR DROPDOWN ─────────────────── */
.profile-menu-wrapper { position: relative; }

.profile-avatar-btn {
  width: 36px; height: 36px;
  border-radius: 50%;
  border: 2px solid var(--border2);
  background: var(--surface);
  cursor: pointer; padding: 2px;
  overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  transition: border-color 0.15s;
}
.profile-avatar-btn:hover { border-color: var(--blue); }

.profile-avatar-img, .profile-user-avatar {
  width: 100%; height: 100%;
  object-fit: cover; border-radius: 50%;
}

.profile-dropdown {
  display: none;
  position: absolute; right: 0; top: calc(100% + 8px);
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--radius);
  min-width: 230px;
  box-shadow: var(--shadow);
  z-index: 500; overflow: visible;
}
.profile-dropdown.open { display: block; }

.profile-user-info {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px;
}
.profile-user-avatar { width: 34px; height: 34px; flex-shrink: 0; }
.profile-email { font-size: 0.82rem; color: var(--text1); word-break: break-all; }

.profile-divider { height: 1px; background: var(--border2); margin: 2px 0; }

.profile-menu-item {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 9px 14px;
  background: none; border: none;
  color: var(--text1); font-size: 0.88rem;
  cursor: pointer; text-align: left; text-decoration: none;
  box-sizing: border-box;
}
.profile-menu-item:hover { background: var(--surface2); }
.profile-has-sub { justify-content: space-between; }

.pmi-icon { opacity: 0.7; font-size: 0.85rem; }

.pmi-badge {
  margin-left: auto;
  color: var(--blue); font-size: 0.76rem;
  background: rgba(88,166,255,0.12);
  padding: 2px 8px; border-radius: 10px;
  border: none; cursor: default;
}

.pmi-arrow { color: var(--text2); font-size: 1rem; margin-left: 2px; }

.profile-signout { color: #f85149 !important; }
.profile-signout:hover { background: rgba(248,81,73,0.08) !important; }

/* ── PROFILE INLINE DROPDOWNS ────────────────── */
.profile-inline-group { width: 100%; }

.profile-inline-dropdown {
  display: none;
  background: var(--surface2);
  border-top: 1px solid var(--border2);
  border-bottom: 1px solid var(--border2);
  padding: 4px 0;
}
.profile-inline-group.open .profile-inline-dropdown { display: block; }
.profile-inline-group.open .pmi-arrow { transform: rotate(180deg); }

.pmi-arrow { transition: transform 0.15s; display: inline-block; }

.profile-sub-item {
  display: block; width: 100%;
  padding: 8px 28px;
  background: none; border: none;
  color: var(--text1); font-size: 0.85rem;
  cursor: pointer; text-align: left;
}
.profile-sub-item:hover { background: var(--surface); }
.profile-sub-item.active { color: var(--blue); font-weight: 600; }

.quote-random-wrap {
  position: relative;
}

.quote-random-launch-btn {
  padding: 7px 10px;
  min-width: 60px;
  font-size: 0.78rem;
}

.quote-random-panel {
  display: none;
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  width: 160px;
  padding: 10px;
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 12px;
  box-shadow: var(--shadow);
  z-index: 520;
}

.quote-random-panel.open {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Inside navbar dropdown: panel flows inline, no absolute pop-out */
.navbar-more-menu .quote-random-panel {
  position: static;
  width: auto;
  border-radius: 0;
  box-shadow: none;
  border: none;
  border-top: 1px solid var(--border);
  background: var(--surface2);
  padding: 10px 14px;
}
.navbar-more-menu .quote-random-wrap {
  position: static;
}

.quote-random-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  color: var(--text);
}

.quote-random-min-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: var(--text2);
}

.quote-random-min-row input {
  width: 52px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  color: var(--text);
  border-radius: 8px;
  padding: 6px 8px;
}

/* ── QUOTE MODAL ───────────────────────────────── */
.quote-modal-content {
  width: min(920px, 94vw);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
}

.quote-modal-header {
  align-items: flex-start;
}

.quote-header-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  margin-right: 10px;
}

.quote-tools-menu-wrap {
  position: relative;
}

.quote-tools-btn {
  min-width: 104px;
  height: 34px;
  border: 1px solid var(--border2);
  border-radius: 10px;
  background: var(--surface2);
  color: var(--text);
  font-size: 0.86rem;
  cursor: pointer;
  padding: 0 12px;
}

.quote-tools-btn:hover {
  border-color: var(--blue);
  color: var(--blue);
}

.quote-tools-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 180px;
  background: #1b2232;
  border: 1px solid var(--border2);
  border-radius: 12px;
  padding: 8px;
  display: none;
  flex-direction: column;
  gap: 6px;
  box-shadow: 0 14px 30px rgba(0,0,0,0.42);
  z-index: 20;
}

.quote-tools-menu.open {
  display: flex;
}

.quote-tools-menu-item {
  width: 100%;
  min-height: 36px;
  border: 1px solid var(--border2);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  text-align: left;
  padding: 8px 10px;
  cursor: pointer;
  font-size: 0.82rem;
}

.quote-tools-menu-item:hover {
  border-color: var(--blue);
  color: var(--blue);
}

.quote-tools-menu-item.primary {
  background: rgba(88, 166, 255, 0.92);
  border-color: rgba(88, 166, 255, 0.92);
  color: #fff;
}

.quote-tools-menu-item.primary:hover {
  color: #fff;
  filter: brightness(1.05);
}

.quote-modal-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.quote-modal-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
}

.quote-modal-counter {
  font-size: 0.78rem;
  color: var(--text2);
}

.quote-modal-body {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.quote-card {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 48px;
  gap: 12px;
  align-items: stretch;
}

.quote-card-main {
  position: relative;
  background: linear-gradient(180deg, rgba(88, 166, 255, 0.12), rgba(255, 255, 255, 0.03));
  border: 1px solid rgba(88, 166, 255, 0.24);
  border-radius: 18px;
  padding: 28px 24px 20px;
}

.quote-mark {
  position: absolute;
  font-size: 3rem;
  line-height: 1;
  color: rgba(88, 166, 255, 0.34);
  pointer-events: none;
}

.quote-mark-left {
  top: 10px;
  left: 14px;
}

.quote-mark-right {
  right: 18px;
  bottom: 76px;
}

.quote-text {
  padding: 12px 8px 20px;
  text-align: center;
  font-size: var(--quote-font-size, clamp(1.1rem, 2vw, 1.6rem));
  line-height: 1.7;
  color: var(--text);
  min-height: 132px;
  display: flex;
  align-items: center;
  justify-content: center;
}

#quote-rating-slider {
  width: 100%;
  accent-color: var(--blue);
  cursor: pointer;
}

.quote-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  flex-wrap: wrap;
}

.quote-scheduler-inline-btn {
  margin-right: auto;
}

.quote-scheduler-inline-btn.active {
  border-color: var(--green);
  color: var(--green);
  background: rgba(63, 185, 80, 0.12);
}

.quote-rating-inline {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 280px;
}

.quote-rating-inline-label {
  font-size: 0.82rem;
  color: var(--text2);
}

.quote-rating-inline #quote-rating-slider {
  flex: 1;
}

.quote-rating-inline #quote-rating-value {
  min-width: 52px;
  text-align: right;
  font-size: 0.82rem;
  color: var(--text2);
}

.quote-nav-btn {
  border: 1px solid var(--border2);
  border-radius: 16px;
  background: var(--surface2);
  color: var(--text);
  font-size: 1.35rem;
  cursor: pointer;
  transition: all 0.15s;
}

.quote-nav-btn:hover {
  border-color: var(--blue);
  color: var(--blue);
  background: rgba(88, 166, 255, 0.08);
}


/* ── STATS CONFIG MODAL ──────────────────────── */
.stats-config-content {
  width: min(560px, 95vw);
  display: flex; flex-direction: column;
  max-height: 85vh;
}
.stats-config-body {
  padding: 20px 24px 8px;
  display: flex; flex-direction: column; gap: 12px;
  flex: 1; overflow: hidden;
}
.stats-config-search-row .panel-search {
  width: 100%; box-sizing: border-box;
}
.stats-config-act-row {
  display: flex; gap: 8px;
}
.stats-config-list {
  overflow-y: auto; flex: 1;
  -webkit-overflow-scrolling: touch;
  max-height: 320px;
  padding-right: 4px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-content: start;
  gap: 0 16px;
}
.stats-config-list .head-checkbox {
  padding: 7px 4px;
  border-radius: 6px;
  cursor: default;
}
.stats-config-list .head-checkbox:hover { background: var(--surface2); }
.stats-drag-handle {
  margin-right: 10px; opacity: 0.5;
  cursor: grab; user-select: none; font-size: 0.8rem;
}
.modal-footer {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 24px;
  border-top: 1px solid var(--border2);
}
.decimals-toggle {
  display: flex; align-items: center; gap: 7px;
  font-size: 0.85rem; color: var(--text2);
  cursor: pointer; user-select: none; margin-right: auto;
}
.decimals-toggle input { cursor: pointer; accent-color: var(--blue); }

/* ── UPLOAD MODAL ─────────────────────────────── */
.upload-modal-content {
  width: min(520px, 95vw);
}

.upload-progress-container {
  padding: 15px 20px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  margin: 0 14px 14px;
  border: 1px solid var(--border2);
}

.upload-progress-header {
  margin-bottom: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

#upload-progress-text {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
  letter-spacing: 0.3px;
}

.upload-progress-bar-wrap {
  width: 100%;
  height: 14px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 20px;
  overflow: hidden;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.5);
}

.upload-progress-bar {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa);
  border-radius: 20px;
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.3);
  position: relative;
}

.upload-progress-bar::after {
  content: '';
  position: absolute;
  top: 0; left: 0; bottom: 0; right: 0;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.15) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  animation: progress-shimmer 2s infinite linear;
}

@keyframes progress-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.upload-drop-zone {
  margin: 14px;
  border: 2px dashed var(--border2);
  border-radius: var(--radius);
  padding: 28px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
  color: var(--text2);
}

.upload-drop-zone:hover,
.upload-drop-zone.drag-over {
  border-color: var(--blue);
  background: rgba(88, 166, 255, 0.05);
  color: var(--text);
}

.drop-icon {
  font-size: 2.5rem;
  margin-bottom: 8px;
}

.upload-label {
  color: var(--blue);
  cursor: pointer;
  text-decoration: underline;
}

.upload-paste-hint {
  font-size: 0.75rem;
  color: var(--text3);
  margin-top: 6px;
}

.upload-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 14px 10px;
  max-height: 200px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.preview-item {
  position: relative;
  width: 78px;
  height: 78px;
}

.preview-item img {
  width: 78px;
  height: 78px;
  object-fit: cover;
  border-radius: var(--radius);
  border: 1px solid var(--border2);
}

.preview-item .remove-preview {
  position: absolute;
  top: -6px;
  right: -6px;
  background: var(--red);
  border: none;
  color: #fff;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 0.65rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--border);
}

/* ── SETTINGS PANEL ───────────────────────────── */
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 900;
  pointer-events: none;
}

.settings-overlay.open {
  pointer-events: all;
}

.settings-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 310px;
  height: 100vh;
  background: var(--surface);
  border-left: 1px solid var(--border2);
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.28s cubic-bezier(.4, 0, .2, 1);
  z-index: 901;
}

.settings-resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 7px;
  cursor: ew-resize;
  z-index: 10;
  background: transparent;
  border-left: 2px solid transparent;
  transition: border-color 0.15s, background 0.15s;
}

.settings-resize-handle:hover,
.settings-resize-handle.dragging {
  border-left-color: var(--blue);
  background: rgba(88, 166, 255, 0.10);
}

.s-sz-btn {
  background: var(--bg2);
  border: 1px solid var(--border2);
  border-radius: 4px;
  color: var(--text);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 7px;
  cursor: pointer;
  line-height: 1.5;
  flex-shrink: 0;
}

.s-sz-btn:hover {
  background: var(--bg3);
  border-color: var(--blue);
  color: var(--blue);
}

.s-sz-val {
  font-size: 0.8rem;
  color: var(--text);
  min-width: 26px;
  text-align: center;
}

.settings-overlay.open .settings-panel {
  transform: translateX(0);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--surface2);
}

.settings-title {
  font-weight: 700;
  font-size: 1rem;
}

.settings-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-group {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.settings-group-title {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--blue);
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}

.settings-subgroup-title {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted, #888);
  margin-top: 8px;
  margin-bottom: 2px;
  padding-left: 2px;
}

.settings-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: var(--text2);
}

/* Section order drag list */
.section-order-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-order-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: var(--radius);
  background: var(--bg);
  border: 1px solid var(--border2);
  font-size: 0.85rem;
  cursor: grab;
  user-select: none;
  transition: box-shadow 0.12s, opacity 0.12s;
}

.section-order-item:active {
  cursor: grabbing;
}

.section-order-handle {
  font-size: 1rem;
  color: var(--text2);
}

.section-order-item.so-dragging {
  opacity: 0.35;
}

.section-order-item.so-drop-before {
  box-shadow: 0 -3px 0 0 var(--blue);
}

.section-order-item.so-drop-after {
  box-shadow: 0 3px 0 0 var(--blue);
}

/* ── Note column ──────────────────────────────── */
.note-cell {
  min-width: 80px;
  max-width: 220px;
  max-height: 64px;
  padding: 3px 6px;
  font-size: 0.8rem;
  color: var(--text);
  cursor: pointer;
  border-radius: var(--radius);
  overflow: hidden;
  line-height: 1.45;
  transition: background 0.12s;
}

.note-cell:hover {
  background: var(--surface2);
}

.note-cell b,
.note-cell strong {
  font-weight: 700;
}

.note-cell i,
.note-cell em {
  font-style: italic;
}

.note-cell u {
  text-decoration: underline;
}

.note-cell p,
.note-cell div {
  margin: 0;
}

.note-cell-ph {
  color: var(--text2);
  opacity: 0.55;
  font-size: 0.75rem;
}

.note-cell-merged {
  cursor: default;
  max-width: none;
  max-height: none;
  white-space: normal;
}

.note-cell-merged:hover {
  background: none;
}

/* Note popup backdrop */
.note-popup-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 2099;
}

/* Note popup (table cell click) — centered fixed overlay */
.note-popup {
  position: fixed;
  z-index: 2100;
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: var(--radius);
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.7);
  padding: 10px;
  width: 380px;
  max-width: calc(100vw - 32px);
}

.note-popup-toolbar,
.obs-trade-note-toolbar {
  display: flex;
  gap: 3px;
  margin-bottom: 4px;
}

.note-popup-tool {
  background: var(--surface);
  border: 1px solid var(--border2);
  color: var(--text);
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 0.78rem;
  cursor: pointer;
  transition: background 0.12s;
  line-height: 1.3;
}

.note-popup-tool:hover {
  background: var(--surface2);
  border-color: var(--blue);
}

.note-popup-editor,
.obs-trade-note-editor {
  min-height: 80px;
  max-height: 200px;
  overflow-y: auto;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border2);
  border-radius: var(--radius);
  padding: 6px 8px;
  font-size: 0.82rem;
  font-family: inherit;
  outline: none;
  line-height: 1.5;
  box-sizing: border-box;
  word-break: break-word;
}

.note-popup-editor:focus,
.obs-trade-note-editor:focus {
  border-color: var(--blue);
}

/* Day-level image upload button in consolidated view */
.day-img-upload-btn {
  font-size: 0.72rem;
  padding: 2px 6px;
  margin-left: 4px;
  opacity: 0.65;
  vertical-align: middle;
}

.day-img-upload-btn:hover {
  opacity: 1;
}

/* Day-level tag chips have a slight glow/border difference */
.tag-chip-day {
  outline: 1px dashed currentColor;
  outline-offset: 1px;
}

.settings-row label {
  flex: 1;
}

.settings-row .select-box {
  font-size: 0.78rem;
}

.shortcut-input {
  min-width: 120px;
  max-width: 180px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  color: var(--text);
  padding: 5px 8px;
  border-radius: var(--radius);
  font-size: 0.78rem;
  outline: none;
}

.shortcut-input:focus {
  border-color: var(--blue);
}

.settings-chk {
  accent-color: var(--blue);
  width: 15px;
  height: 15px;
  cursor: pointer;
}

.settings-hint {
  font-size: 0.68rem;
  color: var(--text2);
  font-style: italic;
}

.settings-preview {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--radius);
  padding: 12px;
  min-height: 70px;
}

.preview-day-num {
  font-size: var(--cal-day-size);
  font-weight: var(--cal-day-weight);
  color: var(--text2);
  margin-bottom: 4px;
}

.preview-data-item {
  font-size: var(--cal-data-size);
  font-weight: var(--cal-data-weight);
  color: var(--text2);
}

.s-apply-btn {
  width: 100%;
  justify-content: center;
}

/* ── VD Daily Drilldown ── */
.vd-dd-toggle {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: #8b949e;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.vd-dd-toggle:hover { background: rgba(88,166,255,0.15); color: #cdd9e5; }
.vd-dd-toggle.active { background: #58a6ff; color: #fff; border-color: #58a6ff; }

#vd-dd-table table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
#vd-dd-table th { color: #8b949e; text-align: left; padding: 4px 8px; border-bottom: 1px solid rgba(255,255,255,0.07); font-weight: 600; }
#vd-dd-table td { color: #cdd9e5; padding: 4px 8px; border-bottom: 1px solid rgba(255,255,255,0.04); }
#vd-dd-table tr:hover td { background: rgba(255,255,255,0.03); }
#vd-dd-table .pnl-win { color: #3fb950; font-weight: 700; }
#vd-dd-table .pnl-loss { color: #f85149; font-weight: 700; }


```

## File: `static/css/style-misc-tags.css`
```css
/* ── TAGS ─────────────────────────────────────── */
.tag-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  min-height: 28px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  background: rgba(88, 166, 255, 0.15);
  border: 1px solid rgba(88, 166, 255, 0.4);
  color: var(--tc, #58a6ff);
  padding: 2px 7px;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  transition: all 0.12s;
  /* background/border tinted by tag color via JS inline style override */
}

.tag-chip:hover {
  opacity: 0.7;
  text-decoration: line-through;
}

/* Drag state — chip being dragged */
.tag-chip[draggable]:active {
  opacity: 0.6;
}

/* Drop-zone highlight on target td */
td.tag-drop-hover {
  outline: 2px dashed var(--blue) !important;
  outline-offset: -2px;
  border-radius: 4px;
}

.tag-add-btn {
  background: transparent;
  border: 1px dashed var(--border2);
  color: var(--text2);
  border-radius: 20px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 0.7rem;
  transition: all 0.12s;
  white-space: nowrap;
}

.tag-add-btn:hover {
  border-color: var(--blue);
  color: var(--blue);
}

/* Calendar tag filter — dim non-matching cells */
.day-cell.tag-filtered-out {
  opacity: 0.22;
  pointer-events: none;
}

.day-cell.calendar-tag-dim {
  opacity: 0.28;
}

.day-cell.calendar-tag-match {
  box-shadow: inset 0 0 0 1px rgba(88, 166, 255, 0.45);
  background: rgba(88, 166, 255, 0.08);
}

/* Tag filter panel */
.tag-filter-panel {
  padding: 8px;
  min-width: 200px;
}

.panel-manage-label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text2);
  margin-bottom: 4px;
}

.tag-manage-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 2px;
  font-size: 0.82rem;
  color: var(--text2);
}

.tag-del-btn {
  background: transparent;
  border: none;
  color: var(--text2);
  cursor: pointer;
  font-size: 0.7rem;
  padding: 1px 4px;
  border-radius: 3px;
  transition: all 0.1s;
}

.tag-del-btn:hover {
  color: var(--red);
  background: rgba(248, 81, 73, 0.1);
}

.tag-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Tag Picker modal */
.tag-modal-content {
  width: min(360px, 94vw);
  overflow: hidden;
}

.tag-picker-inp {
  width: 100%;
  background: var(--surface2);
  border: none;
  border-bottom: 1px solid var(--border2);
  color: var(--text);
  padding: 8px 10px;
  font-size: 0.82rem;
  outline: none;
}

.tag-picker-list {
  max-height: min(52vh, 320px);
  overflow-y: auto;
  padding: 4px 0;
}

.tag-picker-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 10px;
  cursor: pointer;
  font-size: 0.82rem;
  color: var(--text2);
  user-select: none;
}

.tag-picker-item:hover {
  background: var(--surface2);
  color: var(--text);
}

.tag-picker-item input[type="checkbox"] {
  accent-color: var(--blue);
  cursor: pointer;
}

.tag-picker-create {
  padding: 6px 10px;
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--blue);
  border-top: 1px solid var(--border);
}

.tag-picker-create:hover {
  background: var(--surface2);
}

.tag-picker-footer {
  padding: 6px 8px;
  border-top: 1px solid var(--border);
}

/* ── TOAST ────────────────────────────────────── */
.toast {
  position: fixed;
  bottom: 22px;
  right: 22px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  color: var(--text);
  padding: 9px 16px;
  border-radius: var(--radius);
  font-size: 0.875rem;
  box-shadow: var(--shadow);
  z-index: 9999;
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.25s;
  pointer-events: none;
}

.toast.show {
  opacity: 1;
  transform: translateY(0);
}

.toast.success {
  border-left: 3px solid var(--green);
}

.toast.error {
  border-left: 3px solid var(--red);
}

.hidden {
  display: none !important;
}

/* ── SCROLLBAR ────────────────────────────────── */
::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border2);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text2);
}

/* ── FULLSCREEN MODES ─────────────────────────── */
/* F → calendar full-screen */
body.calendar-full .dashboard-section,
body.calendar-full .table-section {
  display: none !important;
}

body.calendar-full .calendar-section {
  position: fixed;
  inset: 0;
  z-index: 200;
  overflow-y: auto;
  background: var(--bg);
  padding: 12px;
}

/* Shift+F → table full-screen */
body.table-full .calendar-section,
body.table-full .dashboard-section {
  display: none !important;
}

body.table-full .table-section {
  position: fixed;
  inset: 0;
  z-index: 200;
  overflow: hidden;
  background: var(--bg);
  padding: 12px;
  display: flex;
  flex-direction: column;
}

body.table-full .table-section .section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

body.table-full .table-section .section-header {
  flex-shrink: 0;
}

body.table-full .table-section .table-header-actions {
  flex-shrink: 0;
}

body.table-full .table-wrapper {
  flex: 1;
  max-height: none !important;
  overflow: auto;
}

/* ── CONSOLIDATED TEXT CELL (wrapping) ─────────── */
.cons-text-cell {
  white-space: normal;
  word-break: break-word;
  font-size: 0.82rem;
  line-height: 1.4;
  padding: 2px 4px;
  color: var(--text);
}

/* ── VIDEO CELL ───────────────────────────────── */
.video-cell {
  display: flex;
  align-items: center;
  gap: 4px;
}

.video-url-inp {
  flex: 1;
  min-width: 80px;
  font-size: 0.78rem;
}

.video-link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(88, 166, 255, 0.15);
  color: var(--blue);
  font-size: 0.8rem;
  text-decoration: none;
  flex-shrink: 0;
  transition: background 0.15s;
}

.video-link-btn:hover {
  background: rgba(88, 166, 255, 0.3);
}

/* --- Gallery Multi-Select & Drag Sorting --- */
.selected-thumb {
  border: 3px solid #ff9800 !important;
  transform: scale(0.95);
  filter: brightness(1.2);
}

.drag-over-left {
  box-shadow: -4px 0 0 0 #ff9800 !important;
}

.drag-over-right {
  box-shadow: 4px 0 0 0 #ff9800 !important;
}

.gv2-thumb-wrap.drag-over {
  outline: 4px dashed #ff9800;
  outline-offset: -4px;
  border-radius: 4px;
  opacity: 0.8;
}

#gv2-context-menu div:hover {
  background: var(--bg);
}

/* --- Gallery Expanded Group Styling --- */
.grp-parent {
  position: relative;
  border: 2px solid var(--blue);
  border-right: none;
  border-radius: 6px 0 0 6px;
  margin-right: -4px;
  padding: 4px 0 4px 4px;
  background: rgba(88, 166, 255, 0.12);
  z-index: 1;
}

.grp-child {
  position: relative;
  border-top: 2px solid var(--blue);
  border-bottom: 2px solid var(--blue);
  border-radius: 0;
  margin-left: 0;
  margin-right: -4px;
  background: rgba(88, 166, 255, 0.12);
  padding: 4px 0 4px 4px;
  z-index: 1;
}

.grp-child-last {
  border-right: 2px solid var(--blue);
  border-radius: 0 6px 6px 0;
  margin-right: 0;
  padding-right: 4px;
}

/* ── LAYER PANEL ──────────────────────────────── */
.gv2-layer-panel {
  width: 200px;
  min-width: 140px;
  max-width: 400px;
  background: var(--surface2);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}

.gv2-lp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  font-size: 0.82rem;
  font-weight: 600;
  border-bottom: 1px solid var(--border);
  background: var(--bg2);
  color: var(--text);
}

.gv2-lp-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text2);
  font-size: 0.85rem;
  padding: 2px 4px;
  border-radius: 3px;
}

.gv2-lp-close:hover {
  background: var(--hover);
  color: var(--text);
}

.gv2-lp-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.gv2-layer-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  cursor: pointer;
  font-size: 0.78rem;
  color: var(--text);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  user-select: none;
}

.gv2-layer-item:hover {
  background: var(--hover);
}

.gv2-layer-item.active-layer {
  background: rgba(41, 121, 255, 0.15);
}

.gv2-layer-item.hidden-layer {
  opacity: 0.4;
}

.gv2-layer-eye {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text2);
  font-size: 0.85rem;
  padding: 0 2px;
  flex-shrink: 0;
}

.gv2-layer-eye:hover {
  color: var(--text);
}

.gv2-layer-thumb {
  width: var(--lp-thumb-w, 32px);
  height: calc(var(--lp-thumb-w, 32px) * 0.75);
  object-fit: cover;
  border-radius: 3px;
  border: 1px solid var(--border);
  flex-shrink: 0;
}

.gv2-layer-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gv2-layer-del {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text2);
  font-size: 0.8rem;
  padding: 0 2px;
  flex-shrink: 0;
  opacity: 0;
}

.gv2-layer-item:hover .gv2-layer-del {
  opacity: 1;
}

.gv2-layer-del:hover {
  color: var(--red);
}

.gv2-layer-drag-handle {
  cursor: grab;
  color: var(--text2);
  font-size: 0.7rem;
  padding: 0 2px;
  flex-shrink: 0;
}

.gv2-layer-subitem {
  padding-left: 18px;
  background: rgba(0, 0, 0, 0.08);
  border-left: 2px solid var(--border2, #444);
}

.gv2-layer-subitem:hover {
  background: var(--hover);
}

.gv2-layer-subitem .gv2-layer-thumb {
  width: calc(var(--lp-thumb-w, 32px) * 0.75);
  height: calc(var(--lp-thumb-w, 32px) * 0.75);
}

/* Drag-drop indicator lines */
.gv2-layer-item.drop-above {
  border-top: 2px solid var(--blue, #4a9eff);
}

.gv2-layer-item.drop-below {
  border-bottom: 2px solid var(--blue, #4a9eff);
}

/* Layer panel resize handle */
.gv2-layer-panel {
  position: relative;
}

.gv2-lp-resize-handle {
  position: absolute;
  right: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
  z-index: 10;
  background: transparent;
}

.gv2-lp-resize-handle:hover,
.gv2-lp-resize-handle.dragging {
  background: rgba(74, 158, 255, 0.35);
}

/* Layer panel selection control buttons */
.gv2-lp-sel-btn {
  background: none;
  border: 1px solid var(--border, #444);
  color: var(--text2);
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 0.8rem;
  cursor: pointer;
  line-height: 1;
}

.gv2-lp-sel-btn:hover {
  background: var(--hover);
  color: var(--text);
}

/* ── SHORTCUTS POPOVER ────────────────────────── */
#gv2-shortcuts-popover {
  columns: 2;
  column-gap: 12px;
}

#gv2-shortcuts-popover .sc-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 0;
  break-inside: avoid;
  white-space: nowrap;
}

#gv2-shortcuts-popover .sc-key {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 0.72rem;
  font-family: monospace;
  color: var(--text2);
  flex-shrink: 0;
}

#gv2-shortcuts-popover .sc-desc {
  color: var(--text2);
  font-size: 0.72rem;
  text-align: right;
}

/* Rubber-band selector */
.gv2-rubberband {
  pointer-events: none;
  position: absolute;
  border: 1.5px dashed var(--blue);
  background: rgba(41, 121, 255, 0.08);
  display: none;
  z-index: 10;
}


```
