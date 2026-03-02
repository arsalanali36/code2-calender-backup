# Frontend Context — CSS Gallery & Misc (gallery / annotation / settings / tags)
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `static\css\style-gallery.css`
```css
/* ── GALLERY MODAL ────────────────────────────── */
.modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 1000;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(6px);
}

.modal-overlay.open {
  display: flex;
  touch-action: none;
  overscroll-behavior: contain;
}

.modal-content {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  overflow: hidden;
  animation: modalIn 0.2s ease;
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(0.96);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 16px;
  border-bottom: 1px solid var(--border);
}

.gallery-modal-content {
  width: 96vw;
  max-width: 1400px;
  height: 92vh;
  display: flex;
  flex-direction: column;
  border-color: transparent;
  background: rgba(13, 17, 23, 0.95);
}

.gallery-modal-header {
  gap: 12px;
}

/* Gallery date navigation */
.gallery-date-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}

.gallery-date-arrow {
  background: transparent;
  border: 1px solid var(--border2);
  color: var(--text2);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.gallery-date-arrow:hover {
  border-color: var(--blue);
  color: var(--blue);
}

.gallery-date-arrow:disabled {
  opacity: 0.3;
  cursor: default;
}

.gallery-date-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gallery-date {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
}

.gallery-date-picker {
  background: var(--surface2);
  border: 1px solid var(--border2);
  color: var(--text);
  padding: 3px 8px;
  border-radius: var(--radius);
  font-size: 0.78rem;
  outline: none;
  cursor: pointer;
}

.gallery-date-picker:focus {
  border-color: var(--blue);
}

.gallery-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.zoom-hint {
  font-size: 0.68rem;
  color: var(--text2);
  font-style: italic;
  white-space: nowrap;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text2);
  cursor: pointer;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  transition: all 0.15s;
}

.close-btn:hover {
  background: var(--surface2);
  color: var(--red);
}

.gallery-main {
  display: flex;
  align-items: stretch;
  flex: 1;
  background: transparent;
  overflow: hidden;
}

.gallery-nav-btn {
  background: rgba(255, 255, 255, 0.06);
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 2.5rem;
  cursor: pointer;
  padding: 0 18px;
  transition: background 0.15s;
  flex-shrink: 0;
}

.gallery-nav-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}

.gallery-nav-btn:disabled {
  opacity: 0.2;
  cursor: default;
}

.gallery-img-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  user-select: none;
}

.gallery-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
  transform-origin: top left;
  transition: transform 0.05s linear;
  cursor: zoom-in;
  will-change: transform;
}

.gallery-img.zoomed {
  cursor: grab;
}

.gallery-img.dragging {
  cursor: grabbing;
  transition: none;
}

.gallery-footer {
  border-top: 1px solid var(--border);
  background: transparent;
}

.gallery-counter {
  text-align: center;
  padding: 5px;
  color: var(--text2);
  font-size: 0.78rem;
}

.gallery-image-tags {
  min-height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 0 12px 6px;
}

.gallery-tag-empty {
  color: var(--text2);
  font-size: 0.75rem;
}

.gallery-img-tag-chip {
  border: 1px solid var(--border2);
  background: transparent;
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 0.72rem;
  cursor: pointer;
}

.gallery-img-tag-chip:hover {
  filter: brightness(1.08);
}

.gallery-thumbnails {
  display: flex;
  gap: 5px;
  padding: 7px 14px 10px;
  overflow-x: auto;
  min-height: 60px;
}

.gallery-thumb-wrap {
  position: relative;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}

.gallery-thumb-wrap.drag-over {
  outline: 4px dashed var(--blue);
  outline-offset: -4px;
  border-radius: 6px;
}

.gallery-thumb {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 4px;
  border: 2px solid transparent;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 0.15s;
}

.gallery-thumb.active {
  border-color: var(--blue);
}

.gallery-thumb:hover {
  border-color: var(--text2);
}

.gallery-thumb-del {
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

.gallery-thumb-wrap:hover .gallery-thumb-del {
  opacity: 1;
}

/* ── ANNOTATION TOOLBAR ───────────────────────── */
.annot-toggle-btn {
  font-size: 0.78rem;
  padding: 5px 10px;
}

.annot-toggle-btn.active {
  background: var(--blue);
  color: #fff;
  border-color: var(--blue);
}

.annot-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 7px 12px;
  background: var(--surface2);
  border-bottom: 1px solid var(--border2);
  flex-wrap: wrap;
  flex-shrink: 0;
}

.annot-tool {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text2);
  padding: 4px 9px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.78rem;
  transition: all 0.1s;
  white-space: nowrap;
}

.annot-tool:hover {
  background: var(--border2);
  color: var(--text);
}

.annot-tool.active {
  background: var(--border2);
  color: var(--blue);
  border-color: var(--blue);
}

.annot-sep {
  width: 1px;
  height: 18px;
  background: var(--border2);
  margin: 0 3px;
  flex-shrink: 0;
}

.annot-color-input {
  width: 30px;
  height: 28px;
  border: 1px solid var(--border2);
  border-radius: 5px;
  cursor: pointer;
  background: transparent;
  padding: 1px;
}

.annot-range {
  width: 80px;
  accent-color: var(--blue);
  cursor: pointer;
}

.annot-size-label {
  font-size: 0.72rem;
  color: var(--text2);
  min-width: 28px;
  text-align: left;
}

.annot-save-btn {
  font-size: 0.78rem;
  padding: 5px 10px;
}

/* Canvas overlay on gallery image */
.annot-canvas {
  position: absolute;
  cursor: crosshair;
  touch-action: none;
  transform-origin: top left;
  transition: transform 0.05s linear;
  will-change: transform;
}

.annot-canvas.dragging {
  transition: none;
}

.annot-brush-cursor {
  position: absolute;
  border: 1.5px solid white;
  border-radius: 50%;
  pointer-events: none;
  transform: translate(-50%, -50%);
  z-index: 1200;
  display: none;
  mix-blend-mode: difference;
}

.annot-brush-cursor::before,
.annot-brush-cursor::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  background: white;
  transform: translate(-50%, -50%);
}

.annot-brush-cursor::before {
  width: 9px;
  height: 1px;
}

.annot-brush-cursor::after {
  width: 1px;
  height: 9px;
}

/* ── OBSERVATION MODAL ────────────────────────── */
.obs-modal-content {
  width: min(860px, 96vw);
  height: min(88vh, 780px);
  display: flex;
  flex-direction: column;
}

.obs-modal-header {
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.obs-date-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.obs-modal-date {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
}

.obs-nav-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--text2);
  cursor: pointer;
  user-select: none;
}

.obs-nav-toggle input {
  accent-color: var(--blue);
  cursor: pointer;
}

.obs-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--border);
  background: var(--surface2);
  flex-wrap: wrap;
  flex-shrink: 0;
}

.obs-tool {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text2);
  padding: 4px 7px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.78rem;
  transition: all 0.1s;
  white-space: nowrap;
  line-height: 1;
}

.obs-tool:hover {
  background: var(--border2);
  color: var(--text);
}

.obs-tool.active {
  background: var(--border2);
  color: var(--blue);
  border-color: var(--blue);
}

.obs-color {
  font-size: 0.95rem;
  padding: 3px 5px;
}

.obs-tool-sep {
  width: 1px;
  height: 16px;
  background: var(--border2);
  margin: 0 2px;
  flex-shrink: 0;
}

.obs-size-input {
  width: 46px;
  background: var(--surface);
  border: 1px solid var(--border2);
  color: var(--text);
  padding: 3px 5px;
  border-radius: 4px;
  font-size: 0.78rem;
  outline: none;
  text-align: center;
}

.obs-size-input:focus {
  border-color: var(--blue);
}

.obs-editor {
  padding: 16px 18px;
  flex: 1;
  overflow-y: auto;
  outline: none;
  color: var(--text);
  font-size: 0.9rem;
  line-height: 1.75;
}

.obs-editor:focus {
  outline: none;
}

.obs-editor h1 {
  font-size: 1.6rem;
  color: var(--text);
  margin: 8px 0 4px;
}

.obs-editor h2 {
  font-size: 1.3rem;
  color: var(--text);
  margin: 6px 0 4px;
}

.obs-editor h3 {
  font-size: 1.1rem;
  color: var(--text);
  margin: 5px 0 3px;
}

.obs-editor h4 {
  font-size: 0.95rem;
  color: var(--text);
  margin: 4px 0 3px;
}

.obs-editor h5 {
  font-size: 0.82rem;
  color: var(--text2);
  margin: 4px 0 2px;
}

.obs-editor ul,
.obs-editor ol {
  padding-left: 22px;
  margin: 4px 0;
}

.obs-editor li {
  margin-bottom: 3px;
}

.obs-editor p {
  margin-bottom: 3px;
}

.obs-editor a {
  color: var(--blue);
}

.obs-editor img {
  max-width: 100%;
  border-radius: 6px;
  margin: 6px 0;
  display: block;
}

/* Per-trade notes inside obs modal */
.obs-trade-notes-wrap {
  border-top: 1px solid var(--border2);
  padding: 10px 14px 10px 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
  max-height: 260px;
  overflow-y: auto;
}

.obs-trade-notes-hdr {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 2px;
}

.obs-trade-note-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  position: relative;
}

.obs-note-drag-handle {
  position: absolute;
  left: -18px;
  top: 4px;
  color: var(--text3);
  cursor: grab;
  font-size: 1rem;
  opacity: 0;
  transition: opacity 0.15s;
  user-select: none;
}

.obs-trade-note-item:hover .obs-note-drag-handle {
  opacity: 1;
}

.obs-trade-note-item.obs-note-dragging {
  opacity: 0.4;
}

.obs-trade-note-item.obs-note-drop-target {
  outline: 2px dashed var(--blue);
  outline-offset: 2px;
  border-radius: 4px;
}

.obs-trade-note-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--blue);
}

.obs-trade-note-ta {
  width: 100%;
  resize: vertical;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border2);
  border-radius: var(--radius);
  padding: 5px 8px;
  font-size: 0.82rem;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  min-height: 48px;
}

.obs-trade-note-ta:focus {
  border-color: var(--blue);
}

.obs-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

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
