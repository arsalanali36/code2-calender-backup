# CSS - Gallery Classic + Grid
Consolidated code context for AI assistants.


## File: `static/css/style-gallery-classic.css`
```css
/* ── GALLERY V2 ────────────────────────────────── */
.gv2-modal {
  flex-direction: column;
  background: #0a0a0b;
  align-items: stretch;
  justify-content: flex-start;
}

.gv2-modal.open {
  display: flex;
}

/* Global Tray */
.gv2-tray {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  min-height: 46px;
  flex-wrap: wrap;
}

.gv2-tray-left {
  display: flex;
  align-items: center;
  gap: 4px;
}

.gv2-tray-btns {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.gv2-tray-right {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.gv2-date-arrow {
  background: transparent;
  border: 1px solid var(--border2);
  color: var(--text2);
  border-radius: 4px;
  padding: 3px 7px;
  cursor: pointer;
  font-size: 1rem;
}

.gv2-date-arrow:hover {
  border-color: var(--blue);
  color: var(--blue);
}

.gv2-date-arrow:disabled {
  opacity: 0.3;
  cursor: default;
}

.gv2-date-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
  min-width: 90px;
  text-align: center;
}

.gv2-date-picker {
  background: var(--surface2);
  border: 1px solid var(--border2);
  color: var(--text);
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
}

.gv2-tray-btn {
  background: var(--surface2);
  border: 1px solid var(--border2);
  color: var(--text2);
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.78rem;
  transition: all 0.15s;
  white-space: nowrap;
}

.gv2-tray-btn:hover {
  border-color: var(--blue);
  color: var(--text);
}

.gv2-tray-btn.active,
.gv2-toggle-btn.active {
  background: rgba(88, 166, 255, 0.15);
  border-color: var(--blue);
  color: var(--blue);
}

.gv2-zoom-hint {
  font-size: 0.68rem;
  color: var(--text3);
  white-space: nowrap;
}

.gv2-close-btn {
  background: transparent;
  border: none;
  color: var(--text2);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.gv2-close-btn:hover {
  color: var(--red);
  background: rgba(248, 81, 73, 0.12);
}

/* Body layout */
.gv2-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.gv2-center {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  min-width: 0;
}

/* Annotation Bar (floating left) */
.gv2-annot-bar {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 300;
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 8px;
  padding: 6px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
  min-width: 38px;
}

.gv2-ab-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text2);
  border-radius: 5px;
  padding: 5px;
  cursor: pointer;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  min-height: 28px;
  transition: all 0.15s;
}

.gv2-ab-btn:hover {
  background: var(--surface2);
  color: var(--text);
}

.gv2-ab-btn.active {
  background: var(--surface2);
  color: var(--blue);
  border-color: var(--blue);
}

.gv2-ab-btn.gv2-stub {
  opacity: 0.45;
  cursor: not-allowed;
}

.gv2-ab-sep {
  width: 24px;
  height: 1px;
  background: var(--border2);
  margin: 2px 0;
}

.gv2-ab-color {
  width: 28px;
  height: 26px;
  border: 1px solid var(--border2);
  border-radius: 4px;
  cursor: pointer;
  padding: 1px;
}

.gv2-ab-range {
  width: 28px;
  accent-color: var(--blue);
  writing-mode: vertical-lr;
  direction: rtl;
  height: 60px;
}

.gv2-ab-size-lbl {
  font-size: 0.65rem;
  color: var(--text3);
}

.gv2-ab-save {
  color: var(--text2);
  font-size: 0.85rem;
}

.gv2-ab-merge {
  color: var(--blue);
  font-size: 0.85rem;
}

/* Main image area */
.gv2-img-area {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #000;
  cursor: default;
  overscroll-behavior: contain;
}

/* Zoom layer: img + annotation canvas unified zoom container */
#gallery-zoom-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: top left;
  pointer-events: none;
  /* children pe pointer events individually set hain */
}

#gallery-zoom-layer>.gallery-img {
  pointer-events: auto;
}

/* Shape tool group (Photoshop style) */
.annot-shape-group {
  position: relative;
}

.annot-shape-menu {
  display: none;
  position: absolute;
  left: calc(100% + 6px);
  top: 0;
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 6px;
  padding: 3px;
  z-index: 401;
  min-width: 96px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
}

.annot-shape-menu.open {
  display: block;
}

.annot-shape-opt {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: var(--text2);
  padding: 5px 10px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 0.85rem;
  white-space: nowrap;
}

.annot-shape-opt:hover {
  background: var(--surface2);
  color: var(--text);
}

.annot-shape-opt.active-shape {
  color: var(--blue);
}

.gv2-nav-btn {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 5;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.6rem;
  padding: 10px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.gv2-nav-btn.gv2-nav-right {
  left: auto;
  right: 8px;
}

.gv2-nav-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.gv2-nav-btn:disabled {
  opacity: 0.15;
  cursor: default;
}

.gv2-img-counter {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6);
  color: var(--text2);
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  pointer-events: none;
}

.gv2-img-tags {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
  max-width: 70%;
  pointer-events: none;
}

/* Text Bar (floating stub) */
.gv2-text-bar {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 6px;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  z-index: 300;
}

.gv2-marquee-bar {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 6px;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  z-index: 300;
}

.gv2-mq-input {
  width: 180px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  color: var(--text);
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 0.75rem;
}

.gv2-tb-size {
  width: 44px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  color: var(--text);
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 0.8rem;
}

.gv2-stub {
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: none;
}

/* Tag Cloud */
.gv2-tag-cloud {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 5px 12px;
  position: relative;
  background: var(--surface);
  border-top: 1px solid var(--border);
  min-height: 36px;
  flex-wrap: wrap;
}

.gv2-tag-cloud.filter-active {
  border-top: 2px solid var(--orange, #ff9800);
  background: color-mix(in srgb, var(--surface) 92%, var(--orange, #ff9800) 8%);
}
.gv2-tag-cloud.filter-active .gv2-tc-label {
  color: var(--orange, #ff9800);
  font-weight: bold;
}
#gallery-thumbs.filter-active {
  outline: 2px solid var(--orange, #ff9800);
  outline-offset: -2px;
}
.gv2-tc-label {
  font-size: 0.72rem;
  color: var(--text3);
  white-space: nowrap;
}

.gv2-tc-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
}

.gv2-tc-group {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text3);
  border: 1px dashed var(--border2);
  border-radius: 999px;
  padding: 2px 8px;
}

.gv2-tc-chip {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.72rem;
  cursor: pointer;
  border: 1px solid var(--border2);
  color: var(--text2);
  background: var(--surface2);
  transition: all 0.15s;
  user-select: none;
}

.gv2-tc-chip:hover {
  border-color: var(--blue);
  color: var(--text);
}

.gv2-tc-chip.selected {
  background: rgba(88, 166, 255, 0.18);
  border-color: var(--blue);
  color: var(--blue);
}

.gv2-tc-mode-btn {
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid var(--border2);
  background: var(--surface2);
  color: var(--text2);
  white-space: nowrap;
}

.gv2-tc-mode-btn:hover,
.gv2-tc-mode-btn.and-mode {
  border-color: var(--orange, #e3a22a);
  color: var(--orange, #e3a22a);
}

.gv2-tc-clear-btn {
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid var(--border2);
  background: transparent;
  color: var(--text3);
}

.gv2-tc-clear-btn:hover {
  color: var(--red);
  border-color: var(--red);
}

/* Thumbnail Tray */
.gv2-thumb-tray {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 6px 8px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  min-height: calc(var(--thumb-size, 54px) + 26px);
  position: relative;
  overflow: hidden;
}

.gv2-tray-resize-handle-horiz {
  position: absolute;
  left: 0;
  right: 0;
  top: -5px;
  height: 16px;
  cursor: ns-resize;
  z-index: 10;
  background: transparent;
  border-top: 2px solid transparent;
  transition: border-color 0.15s, background 0.15s;
}

.gv2-tray-resize-handle-horiz:hover,
.gv2-tray-resize-handle-horiz.dragging {
  border-top-color: var(--blue);
  background: rgba(88, 166, 255, 0.12);
}

.gv2-thumbs {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  align-items: center;
  padding: 24px 0 4px;
  touch-action: pan-x;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.gv2-thumb-wrap {
  position: relative;
  flex-shrink: 0;
  cursor: pointer;
}

.gv2-thumb-wrap.drag-over {
  outline: 2px dashed var(--blue);
  border-radius: 6px;
}

.gv2-thumb-wrap.dragging {
  opacity: 0.4;
}

.gv2-thumb {
  width: var(--thumb-size, 54px);
  height: var(--thumb-size, 54px);
  object-fit: cover;
  border-radius: 5px;
  border: 2px solid var(--border2);
  transition: border-color 0.15s;
  display: block;
}

.gv2-thumb.active {
  border-color: var(--blue);
}

.gv2-thumb:hover {
  border-color: var(--text2);
}

.gv2-thumb-del {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  background: rgba(248, 81, 73, 0.85);
  border: none;
  color: #fff;
  border-radius: 50%;
  font-size: 0.6rem;
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.gv2-thumb-wrap:hover .gv2-thumb-del {
  display: flex;
}

.gv2-thumb-video-icon {
  position: absolute;
  bottom: 2px;
  left: 2px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  border-radius: 3px;
  font-size: 0.55rem;
  padding: 1px 3px;
  pointer-events: none;
}

/* Context menu */
.gv2-ctx-menu {
  position: fixed;
  z-index: 9999;
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: var(--radius);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5);
  min-width: 170px;
  padding: 4px 0;
  user-select: none;
}

.gv2-ctx-item {
  padding: 7px 16px;
  font-size: 0.82rem;
  color: var(--text);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}

.gv2-ctx-item:hover {
  background: rgba(88, 166, 255, 0.14);
  color: var(--blue);
}

.gv2-ctx-header {
  padding: 4px 16px 2px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text2);
}

.gv2-ctx-sep {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

/* Tags Tray (right panel) */
.gv2-tags-tray {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-left: 1px solid var(--border);
  overflow: hidden;
  position: relative;
}

.gv2-tray-resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
  z-index: 10;
  background: transparent;
  border-left: 2px solid transparent;
  transition: border-color 0.15s, background 0.15s;
}

.gv2-tray-resize-handle:hover,
.gv2-tray-resize-handle.dragging {
  border-left-color: var(--blue);
  background: rgba(88, 166, 255, 0.12);
}

.gv2-tt-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.gv2-tt-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text);
}

.gv2-tt-add-grp {
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--border2);
  color: var(--blue);
}

.gv2-tt-add-grp:hover {
  background: rgba(88, 166, 255, 0.1);
}

.gv2-tt-del-tag {
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--border2);
  color: var(--text2);
}

.gv2-tt-del-tag:hover {
  border-color: var(--red);
  color: var(--red);
}

.gv2-tt-del-tag.active {
  background: rgba(248, 81, 73, 0.12);
  border-color: var(--red);
  color: var(--red);
}

.gv2-tt-sz-btn {
  font-size: 0.68rem;
  padding: 2px 5px;
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--border2);
  color: var(--text2);
  line-height: 1;
}

.gv2-tt-sz-btn:hover {
  background: rgba(88, 166, 255, 0.1);
  color: var(--blue);
  border-color: var(--blue);
}

.gv2-tt-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.gv2-tt-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gv2-tt-group.drop-hover,
.gv2-tt-unassigned.drop-hover {
  outline: 1px dashed var(--blue);
  outline-offset: 2px;
  border-radius: 8px;
}

.gv2-tt-grp-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.72rem;
  color: var(--text2);
  font-weight: 600;
  text-transform: uppercase;
  padding: 2px 4px;
  cursor: pointer;
}

.gv2-tt-grp-hdr:hover {
  color: var(--text);
}

.gv2-tt-grp-del {
  background: none;
  border: none;
  color: var(--text3);
  cursor: pointer;
  font-size: 0.7rem;
  opacity: 0;
  transition: opacity 0.15s;
}

.gv2-tt-grp-hdr:hover .gv2-tt-grp-del {
  opacity: 1;
}

.gv2-tt-grp-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 2px 4px;
}

.gv2-tt-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 10px;
  font-size: var(--tag-chip-size, 0.72rem);
  cursor: pointer;
  border: 1px solid var(--border2);
  color: var(--text2);
  background: transparent;
  transition: all 0.15s;
}

.gv2-tt-tag-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  color: var(--text);
  font-size: var(--tag-chip-count-size, 0.62rem);
  line-height: 1;
}

.gv2-tt-tag-chip[draggable="true"] {
  cursor: grab;
}

.gv2-tt-tag-chip.dragging {
  opacity: 0.55;
  cursor: grabbing;
}

.gv2-tt-tag-chip:hover {
  border-color: var(--blue);
  color: var(--text);
}

.gv2-tt-tag-chip.selected-on-image {
  color: #cfd4dc !important;
  border-color: rgba(150, 155, 165, 0.72) !important;
  background: rgba(140, 145, 155, 0.24) !important;
}

.gv2-tt-tag-chip.selected-on-trade {
  color: #3fb950 !important;
  border-color: rgba(63, 185, 80, 0.6) !important;
  background: rgba(63, 185, 80, 0.14) !important;
}

.gv2-tt-grp-ungrouped {
  font-size: 0.72rem;
  color: var(--text3);
  font-style: italic;
}

.gv2-tt-unassigned {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gv2-tt-unassigned-lbl {
  font-size: 0.7rem;
  color: var(--text3);
  padding: 2px 4px;
}

.gv2-tt-drop-hint {
  font-size: 0.7rem;
  color: var(--text3);
  padding: 3px 4px;
  font-style: italic;
}

.gv2-tag-grp-select {
  font-size: 0.65rem;
  padding: 1px 3px;
  border-radius: 3px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  color: var(--text3);
  cursor: pointer;
}



/* ── AUDIO BAR ─────────────────────────────────── */
.gv2-audio-bar {
  position: absolute;
  bottom: 44px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(10, 10, 11, 0.92);
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 5px 12px;
  z-index: 50;
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 16px rgba(0,0,0,0.6);
  white-space: nowrap;
}

.gv2-audio-label {
  font-size: 0.8rem;
  color: var(--text3);
  margin-right: 2px;
}

.gv2-audio-btn {
  font-size: 0.75rem;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid var(--border2);
  background: var(--surface2);
  color: var(--text);
  cursor: pointer;
  transition: background 0.15s;
  flex-shrink: 0;
}
.gv2-audio-btn:hover { background: var(--surface3, #2a2a35); }

.gv2-audio-play {
  width: 32px;
  padding: 4px 0;
  text-align: center;
  font-size: 0.8rem;
}

.gv2-audio-rec { border-color: #c0033a; color: #ff6688; }
.gv2-audio-rec:hover { background: rgba(220,0,80,0.15); }

.gv2-audio-stop { border-color: #c0033a; color: #ff4466; }
.gv2-audio-stop:hover { background: rgba(220,0,80,0.15); }

.gv2-audio-del { color: var(--text3); padding: 4px 7px; }
.gv2-audio-del:hover { color: #ff4444; border-color: #ff4444; }

.gv2-audio-dot {
  color: #ff2255;
  font-size: 0.9rem;
  animation: gv2-audio-blink 1s step-start infinite;
}
.gv2-audio-timer {
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  color: #ff6688;
  min-width: 34px;
}
.gv2-audio-time {
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  color: var(--text3);
  min-width: 68px;
  text-align: center;
}

/* Waveform canvas hover highlight */
#gv2-audio-wave {
  flex-shrink: 0;
  display: block;
}
#gv2-audio-wave:hover { opacity: 0.92; }

@keyframes gv2-audio-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}

/* Bar separator between audio & video sections */
.gv2-bar-sep {
  width: 1px;
  height: 20px;
  background: var(--border2, #333);
  margin: 0 4px;
  flex-shrink: 0;
}

/* Collapse toggle button */
.gv2-bar-collapse-btn {
  padding: 2px 7px;
  font-size: 0.65rem;
  color: var(--text3);
  border-color: transparent;
  background: transparent;
  margin-left: 2px;
}
.gv2-bar-collapse-btn:hover { color: var(--text); background: var(--surface3, #2a2a35); border-color: var(--border2); }

/* Audio indicator on thumbnails */
.gv2-thumb-audio-icon {
  position: absolute;
  bottom: 4px;
  left: 4px;
  font-size: 0.7rem;
  line-height: 1;
  pointer-events: none;
  z-index: 10;
  background: #f5c518;
  color: #000;
  border-radius: 3px;
  padding: 2px 4px;
  font-weight: 700;
  box-shadow: 0 1px 4px rgba(0,0,0,0.6);
}

/* ── VIDEO BAR ─────────────────────────────────── */
.gv2-video-bar {
  position: absolute;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(10, 10, 11, 0.92);
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 5px 12px;
  z-index: 50;
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 16px rgba(0,0,0,0.6);
  white-space: nowrap;
}

.gv2-video-label {
  font-size: 0.8rem;
  color: var(--text3);
  margin-right: 2px;
}

.gv2-video-btn {
  font-size: 0.75rem;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid var(--border2);
  background: var(--surface2);
  color: var(--text);
  cursor: pointer;
  transition: background 0.15s;
  flex-shrink: 0;
}
.gv2-video-btn:hover { background: var(--surface3, #2a2a35); }

.gv2-video-rec { border-color: #0066cc; color: #4da6ff; }
.gv2-video-rec:hover { background: rgba(0,100,220,0.15); }

.gv2-video-stop { border-color: #c0033a; color: #ff4466; }
.gv2-video-stop:hover { background: rgba(220,0,80,0.15); }

.gv2-video-del { color: var(--text3); padding: 4px 7px; }
.gv2-video-del:hover { color: #ff4444; border-color: #ff4444; }

.gv2-video-dot {
  color: #ff2255;
  font-size: 0.9rem;
  animation: gv2-audio-blink 1s step-start infinite;
}

.gv2-video-timer {
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  color: #ff6688;
  min-width: 80px;
}

/* Progress bar for recording */
.gv2-video-progress {
  width: 120px;
  height: 6px;
  background: #2a2a35;
  border-radius: 3px;
  overflow: hidden;
  flex-shrink: 0;
}
.gv2-video-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #c0033a, #ff4466);
  border-radius: 3px;
  transition: width 0.9s linear;
}

/* Inline video player */
.gv2-video-player {
  height: 120px;
  width: 214px;
  border-radius: 6px;
  background: #000;
  flex-shrink: 0;
  display: block;
}

/* Video indicator on thumbnails */
.gv2-thumb-video-icon {
  position: absolute;
  bottom: 4px;
  left: 22px;
  font-size: 0.75rem;
  line-height: 1;
  pointer-events: none;
  z-index: 10;
}

```

## File: `static/css/style-gallery-grid.css`
```css
/* ── GRID VIEW (HORIZONTAL LAYOUT WITH SIDEBAR) ── */
.gv2-grid-view {
  position: absolute;
  inset: 0;
  z-index: 1000;
  background: var(--bg);
  flex-direction: row;
  animation: gridFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

@keyframes gridFadeIn {
  from { opacity: 0; transform: scale(1.02); }
  to { opacity: 1; transform: scale(1); }
}

/* ── SIDEBAR (INSTAGRAM STYLE) ── */
.gv2-grid-sidebar {
  width: 72px;
  background: #0d0d0f;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 20px 12px;
  padding-top: max(20px, env(safe-area-inset-top, 0px));
  padding-left: max(12px, env(safe-area-inset-left, 0px));
  transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 2000;
  flex-shrink: 0;
}

.gv2-grid-sidebar:hover {
  width: 200px;
}

.gv2-sidebar-logo {
  color: var(--blue);
  margin-bottom: 30px;
  padding-left: 10px;
}

.gv2-sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gv2-sidebar-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
  border-radius: 12px;
  color: var(--text2);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  overflow: hidden;
}

.gv2-sidebar-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  transform: translateX(4px);
}

.gv2-sidebar-item.no-hover {
  cursor: default;
}

.gv2-sidebar-item.no-hover:hover {
  background: transparent;
  transform: none;
}
.gv2-sidebar-item.active {
  color: var(--blue);
  font-weight: 700;
}

.gv2-si-icon {
  font-size: 1.2rem;
  width: 24px;
  text-align: center;
  flex-shrink: 0;
}

.gv2-si-label {
  font-size: 0.9rem;
  opacity: 0;
  transition: opacity 0.2s;
}
.gv2-grid-sidebar:hover .gv2-si-label {
  opacity: 1;
}

.gv2-sidebar-date-pill {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--text3);
  background: rgba(255,255,255,0.05);
  padding: 4px 10px;
  border-radius: 20px;
  width: 100%;
  text-align: center;
}

.gv2-sidebar-sep {
  height: 1px;
  background: var(--border);
  margin: 12px 10px;
  opacity: 0.5;
}

/* ── SIDEBAR RECORDING TOOLS INTEGRATION ── */
.gv2-grid-sidebar .gv2-tray-record-bars {
  display: flex !important;
  flex-direction: column !important;
  gap: 12px !important;
  margin-top: 10px !important;
  width: 100% !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  position: static !important;
}

.gv2-grid-sidebar .gv2-audio-bar,
.gv2-grid-sidebar .gv2-video-bar {
  position: relative !important;
  left: 0 !important;
  bottom: 0 !important;
  transform: none !important;
  width: 100% !important;
  background: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 12px !important;
  padding: 8px !important;
  flex-direction: column !important;
  align-items: center !important;
  transition: all 0.3s !important;
  overflow: hidden !important;
  min-height: 44px;
}

.gv2-grid-sidebar .gv2-bar-sep {
  width: 20px !important;
  height: 1px !important;
  margin: 4px 0 !important;
}

.gv2-grid-sidebar:not(:hover) .gv2-audio-bar,
.gv2-grid-sidebar:not(:hover) .gv2-video-bar {
  background: transparent !important;
  border-color: transparent !important;
  padding: 8px 0 !important;
}

/* Hide text/labels/waveforms when sidebar is collapsed */
.gv2-grid-sidebar:not(:hover) .gv2-audio-label,
.gv2-grid-sidebar:not(:hover) .gv2-audio-timer,
.gv2-grid-sidebar:not(:hover) .gv2-audio-time,
.gv2-grid-sidebar:not(:hover) .gv2-video-label,
.gv2-grid-sidebar:not(:hover) .gv2-video-timer,
.gv2-grid-sidebar:not(:hover) .gv2-audio-btn span,
.gv2-grid-sidebar:not(:hover) #gv2-audio-wave,
.gv2-grid-sidebar:not(:hover) .gv2-video-progress {
  display: none !important;
}

.gv2-grid-sidebar:not(:hover) .gv2-audio-btn,
.gv2-grid-sidebar:not(:hover) .gv2-video-btn {
  font-size: 1.1rem !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  width: 32px !important;
  height: 32px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.gv2-grid-sidebar .gv2-audio-btn:hover,
.gv2-grid-sidebar .gv2-video-btn:hover {
  background: rgba(255,255,255,0.1) !important;
  border-radius: 8px !important;
}

.gv2-grid-sidebar .gv2-audio-dot {
  font-size: 1.2rem !important;
  margin-bottom: 4px;
}

/* ── MAIN CONTENT ── */
.gv2-grid-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.gv2-grid-tray-simple {
  height: calc(60px + env(safe-area-inset-top, 0px));
  padding-top: env(safe-area-inset-top, 0px);
  padding-left: max(24px, env(safe-area-inset-left, 24px));
  padding-right: max(24px, env(safe-area-inset-right, 24px));
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
  background: #0d0d0f;
  position: relative;
}

.gv2-grid-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

/* ── TOP CENTER DATE NAV ── */
.gv2-grid-top-date-nav {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255,255,255,0.03);
  padding: 6px 14px;
  border-radius: 30px;
  border: 1px solid rgba(255,255,255,0.06);
}

.gv2-grid-top-date-nav .gv2-date-arrow {
  background: transparent;
  border: none;
  color: var(--text2);
  font-size: 1.4rem;
  cursor: pointer;
  padding: 0 8px;
  transition: color 0.2s;
  line-height: 1;
}
.gv2-grid-top-date-nav .gv2-date-arrow:hover {
  color: var(--blue);
}

.gv2-grid-main-title {
  font-size: 0.85rem;
  font-weight: 900;
  color: var(--blue);
  letter-spacing: 1.5px;
}

.gv2-grid-size-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  justify-content: flex-end;
}

/* Hide main tray in grid open if it overlaps */
.gv2-modal.grid-open .gv2-tray {
  display: none !important;
}

.gv2-modal.grid-open .gv2-tray-center {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  padding: 0;
  gap: 12px;
}

.gv2-modal.grid-open .gv2-grid-only {
  display: flex !important;
}

/* Hide main Exit button when Grid is open, use Grid Close instead */
.gv2-modal.grid-open .gv2-exit-btn {
  display: none !important;
}

.gv2-grid-title {
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--blue);
  letter-spacing: 0.8px;
  text-transform: uppercase;
  white-space: nowrap;
}

.gv2-grid-hdr {
  display: none; /* Use main tray instead */
}

/* ── Grid Close Button (Tray) ── */
.gv2-grid-close-btn {
  background: rgba(255, 255, 255, 0.08); /* Matches other tray icons */
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.7);
  border-radius: 8px;
  width: 32px;
  height: 32px;
  margin-right: 4px; /* Align with tray-center elements */
  margin-top: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.gv2-grid-close-btn:hover {
  background: rgba(248, 81, 73, 0.18);
  border-color: rgba(248, 81, 73, 0.4);
  color: #ff6b6b;
  transform: translateY(-1px);
}

/* ── Grid Body ── */
.gv2-grid-sz-icon {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--text3);
  text-transform: uppercase;
}

#gv2-grid-size-slider {
  width: 200px;
  accent-color: var(--blue);
  cursor: pointer;
}

.gv2-grid-close-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text2);
  width: 38px;
  height: 38px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.gv2-grid-close-btn:hover {
  background: rgba(248, 81, 73, 0.15);
  color: #ff6b6b;
  border-color: rgba(248, 81, 73, 0.3);
}

.gv2-grid-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  scroll-behavior: smooth;
}

/* ── Grid Groups ── */
.gv2-grid-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gv2-grid-group-hdr {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 7px 12px;
  border-bottom: 1px solid var(--border2);
  position: sticky;
  top: 0;
  z-index: 10;
  background: #0e1420;
  border-radius: 6px 6px 0 0;
  margin-bottom: -4px;
}

.gv2-grid-group-title {
  font-size: 1rem;
  font-weight: 700;
  color: #ffd700;
}

.gv2-grid-group-pnl {
  font-size: 0.85rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
}

/* ── Structured trade header ── */
.gv2-grid-group-hdr--trade {
  padding: 10px 16px !important;
  background: #111827 !important;
  border-bottom: 2px solid var(--border2);
  width: 100% !important;
  max-width: none !important;
}
.ggr-trade-row {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 20px;
  font-size: 1.1rem; /* Base size much larger */
}
.ggr-idx {
  font-size: 1.3rem; 
  font-weight: 900; 
  color: var(--text3); 
  min-width: 45px;
}
.ggr-inst {
  font-size: 1.15rem;
  font-weight: 800;
  min-width: 180px;
}
.ggr-stats-group, .ggr-pnl-group {
  display: flex;
  align-items: center;
  gap: 18px;
  padding-left: 18px;
  border-left: 1px solid rgba(255,255,255,0.15);
}
.ggr-stats-group {
  color: #fff;
  font-weight: 600;
}
.ggr-time { min-width: 60px; }
.ggr-dur  { color: var(--text3); font-weight: 700; min-width: 50px; }
.ggr-qty  { color: #fff; background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 4px; font-size: 0.95rem; }

.ggr-pnl-group span {
  font-weight: 800;
  min-width: 80px;
  text-align: right;
}
.ggr-pnl { font-size: 1.25rem; min-width: 100px !important; }

/* Active stuck header — even more prominent */
.gv2-grid-group-hdr.ggr-is-stuck {
  background: #0d1117 !important;
  border-bottom-color: var(--blue);
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}
.gv2-grid-group-hdr.ggr-is-stuck .ggr-trade-row {
  font-size: 1.25rem;
  transform: scale(1.02);
  transform-origin: left center;
}

/* Visual differentiation for no-image trades */
.gv2-grid-group--no-img {
  opacity: 0.7;
}
.gv2-grid-group--no-img .gv2-grid-group-hdr {
  background: #0d1117 !important; /* Darker background for empty trades */
  border-bottom-style: dashed;
}
.gv2-grid-group--no-img .ggr-inst {
  color: var(--text3) !important;
}

.gv2-grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--grid-img-size, 220px), 1fr));
  gap: 16px;
}

/* ── NOWRAP / HORIZONTAL FLOW MODE ── */
.gv2-grid-container--nowrap {
  display: flex !important;
  flex-wrap: nowrap !important;
  overflow-x: auto !important;
  overflow-y: visible !important; /* Changed from hidden to avoid clipping on iPad */
  min-height: fit-content !important;
  align-items: flex-start !important;
  gap: 15px !important;
  padding: 4px 4px 20px 4px !important; /* Increased padding-bottom for shadows/scaling */
  cursor: grab;
  scroll-behavior: smooth;
  user-select: none;
  -webkit-overflow-scrolling: touch;
}

.gv2-grid-container--nowrap.dragging {
  cursor: grabbing;
  scroll-behavior: auto;
}

.gv2-grid-container--nowrap::-webkit-scrollbar {
  height: 6px;
}
.gv2-grid-container--nowrap::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
}
.gv2-grid-container--nowrap::-webkit-scrollbar-thumb {
  background: rgba(88, 166, 255, 0.3);
  border-radius: 10px;
}
.gv2-grid-container--nowrap::-webkit-scrollbar-thumb:hover {
  background: var(--blue);
}

.gv2-grid-container--nowrap .gv2-grid-item {
  flex-shrink: 0;
  width: var(--grid-img-size, 220px);
}

/* ── Portrait Mode for News Section — scales with slider but capped at 280px max ── */
.gv2-grid-group--portrait .gv2-grid-container--nowrap .gv2-grid-item {
  width: min(var(--grid-img-size, 180px), 180px);
}
.gv2-grid-group--portrait .gv2-grid-container {
  grid-template-columns: repeat(auto-fill, min(var(--grid-img-size, 180px), 180px));
}
.gv2-grid-group--portrait .gv2-grid-item {
  aspect-ratio: 9 / 16;
}

.gv2-grid-item {
  position: relative;
  aspect-ratio: 16 / 9;
  height: auto; /* Forces aspect-ratio to determine height */
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  background: var(--surface2);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.gv2-grid-item:hover {
  transform: translateY(-4px) scale(1.02);
  border-color: var(--blue);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.6), 0 0 0 1px var(--blue);
}

.gv2-grid-item--selected {
  border-color: var(--blue);
  outline: 2px solid var(--blue);
  outline-offset: -1px;
}

.gv2-grid-item--selected::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(88, 166, 255, 0.18);
  pointer-events: none;
  z-index: 2;
}

.gv2-grid-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.3s;
}

.gv2-grid-item:hover .gv2-grid-img {
  filter: brightness(1.1);
}

.gv2-grid-item-meta {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px;
  background: linear-gradient(transparent, rgba(0,0,0,0.8));
  display: flex;
  justify-content: flex-end;
  opacity: 0;
  transition: opacity 0.2s;
}

.gv2-grid-item:hover .gv2-grid-item-meta {
  opacity: 1;
}

.gv2-grid-time {
  font-size: 0.7rem;
  color: #eee;
  background: rgba(0,0,0,0.5);
  padding: 2px 6px;
  border-radius: 4px;
}

.gv2-grid-item-del {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  background: rgba(248, 81, 73, 0.85);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  opacity: 0;
  transition: all 0.2s;
  pointer-events: auto;
}

.gv2-grid-item:hover .gv2-grid-item-del {
  opacity: 1;
}

.gv2-grid-item-del:hover {
  background: #f85149 !important;
  transform: scale(1.1);
  box-shadow: 0 0 10px rgba(248, 81, 73, 0.4);
}

.gv2-grid-empty {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0 16px 0;
  padding: 10px 18px;
  border: 1.5px dashed var(--border, #374151);
  border-radius: 8px;
  color: var(--text-muted, #6b7280);
  font-size: 0.82rem;
  transition: border-color 0.15s, color 0.15s;
}
.gv2-grid-empty:hover {
  border-color: var(--blue);
  color: var(--blue);
}
.gv2-grid-empty-icon {
  font-size: 1rem;
  line-height: 1;
}
.gv2-grid-empty-hint {
  opacity: 0.55;
  font-size: 0.75rem;
}

/* Scrollbar Style */
.gv2-grid-body::-webkit-scrollbar {
  width: 8px;
}
.gv2-grid-body::-webkit-scrollbar-track {
  background: transparent;
}
.gv2-grid-body::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 10px;
}
.gv2-grid-body::-webkit-scrollbar-thumb:hover {
  background: var(--border2);
}

/* ── Visual Dashboard Month Tabs ── */
.vd-month-tabs-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  padding: 4px 0;
  border-bottom: 1px solid var(--border2, #30363d);
}

.vd-month-tab {
  padding: 5px 12px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text3, #8b949e);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border2, #30363d);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.vd-month-tab:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text, #e6edf3);
  border-color: #444c56;
  transform: translateY(-1px);
}

.vd-month-tab.active {
  background: rgba(88, 166, 255, 0.15);
  color: var(--blue, #58a6ff);
  border-color: var(--blue, #58a6ff);
  box-shadow: 0 0 10px rgba(88, 166, 255, 0.15);
}

.vd-month-tab.no-data {
  opacity: 0.2;
  cursor: default;
  pointer-events: none;
  background: transparent;
  border-style: dashed;
}

.vd-month-tab.has-data {
  border-color: rgba(88, 166, 255, 0.3);
  color: var(--text2, #c9d1d9);
}

```
