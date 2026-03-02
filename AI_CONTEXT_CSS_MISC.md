# CSS — Misc (upload / settings / tags / toast / scrollbar)
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `static\css\style-misc.css`
```css
/* ── UPLOAD MODAL ─────────────────────────────── */
.upload-modal-content {
  width: min(520px, 95vw);
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
.gv2-lp-close:hover { background: var(--hover); color: var(--text); }
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
  border-bottom: 1px solid rgba(255,255,255,0.04);
  user-select: none;
}
.gv2-layer-item:hover { background: var(--hover); }
.gv2-layer-item.active-layer { background: rgba(41,121,255,0.15); }
.gv2-layer-item.hidden-layer { opacity: 0.4; }
.gv2-layer-eye {
  background: none; border: none; cursor: pointer;
  color: var(--text2); font-size: 0.85rem; padding: 0 2px; flex-shrink: 0;
}
.gv2-layer-eye:hover { color: var(--text); }
.gv2-layer-thumb {
  width: var(--lp-thumb-w, 32px); height: calc(var(--lp-thumb-w, 32px) * 0.75); object-fit: cover;
  border-radius: 3px; border: 1px solid var(--border); flex-shrink: 0;
}
.gv2-layer-name {
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.gv2-layer-del {
  background: none; border: none; cursor: pointer;
  color: var(--text2); font-size: 0.8rem; padding: 0 2px; flex-shrink: 0; opacity: 0;
}
.gv2-layer-item:hover .gv2-layer-del { opacity: 1; }
.gv2-layer-del:hover { color: var(--red); }
.gv2-layer-drag-handle {
  cursor: grab; color: var(--text2); font-size: 0.7rem; padding: 0 2px; flex-shrink: 0;
}
.gv2-layer-subitem {
  padding-left: 18px;
  background: rgba(0,0,0,0.08);
  border-left: 2px solid var(--border2, #444);
}
.gv2-layer-subitem:hover { background: var(--hover); }
.gv2-layer-subitem .gv2-layer-thumb {
  width: calc(var(--lp-thumb-w, 32px) * 0.75); height: calc(var(--lp-thumb-w, 32px) * 0.75);
}

/* Drag-drop indicator lines */
.gv2-layer-item.drop-above { border-top: 2px solid var(--blue, #4a9eff); }
.gv2-layer-item.drop-below { border-bottom: 2px solid var(--blue, #4a9eff); }

/* Layer panel resize handle */
.gv2-layer-panel { position: relative; }
.gv2-lp-resize-handle {
  position: absolute; right: -3px; top: 0; bottom: 0; width: 6px;
  cursor: ew-resize; z-index: 10; background: transparent;
}
.gv2-lp-resize-handle:hover, .gv2-lp-resize-handle.dragging {
  background: rgba(74, 158, 255, 0.35);
}

/* Layer panel selection control buttons */
.gv2-lp-sel-btn {
  background: none; border: 1px solid var(--border, #444);
  color: var(--text2); border-radius: 3px; padding: 1px 5px;
  font-size: 0.8rem; cursor: pointer; line-height: 1;
}
.gv2-lp-sel-btn:hover { background: var(--hover); color: var(--text); }

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
  background: rgba(41,121,255,0.08);
  display: none;
  z-index: 10;
}

```
