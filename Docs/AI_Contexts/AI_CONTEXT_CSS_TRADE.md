# CSS - Trade
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
