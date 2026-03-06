# CSS — Gallery B (GV2 thumbnails / tags / toolbar)
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `static\css\style-gallery-b.css`
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
  top: 0;
  height: 6px;
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


```
