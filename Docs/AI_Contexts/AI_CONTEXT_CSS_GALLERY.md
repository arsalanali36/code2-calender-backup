# CSS - Gallery (a/b/c/d/split)
Consolidated code context for AI assistants.


## File: `static/css/style-gallery-a.css`
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

/* Global Close Source Tray Styling */
.close-global-nav-btn {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.close-global-nav-btn.no-img {
  opacity: 0.35 !important;
  background: transparent !important;
  border: 1.5px dashed rgba(255,255,255,0.4) !important;
  color: rgba(255,255,255,0.4) !important;
  cursor: default;
}
.close-global-nav-btn.no-img:hover {
  opacity: 0.6 !important;
  border-color: #fff !important;
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
  cursor: default;
  will-change: transform;
  image-rendering: -webkit-optimize-contrast;
  image-rendering: high-quality;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
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
  -webkit-overflow-scrolling: touch;
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

.selected-separator {
  box-shadow: 0 0 0 2px var(--blue) !important;
  color: var(--blue) !important;
  border-color: var(--blue) !important;
  background: rgba(88, 166, 255, 0.15);
  border-radius: 4px;
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
  -webkit-overflow-scrolling: touch;
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
  -webkit-overflow-scrolling: touch;
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



.gv2-touch-resizer {
  display: flex !important;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 32px; /* Slimmer */
  height: 200px;
  background: rgba(13, 17, 23, 0.4); /* Much more transparent */
  border: 1px solid rgba(88, 166, 255, 0.3);
  border-radius: 16px;
  z-index: 10005;
  touch-action: none;
  pointer-events: auto;
  align-items: center;
  justify-content: space-between;
  flex-direction: column;
  padding: 15px 0;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
  transition: opacity 0.3s, background 0.3s;
  opacity: 0.6; /* Semi-transparent when not in use */
}

.gv2-touch-resizer:active {
  background: rgba(13, 17, 23, 0.85);
  border-color: #58a6ff;
  opacity: 1;
}

.gv2-touch-resizer::before {
  content: '▴';
  font-size: 14px;
  color: #58a6ff;
  font-weight: 900;
}

.gv2-touch-resizer::after {
  content: '▾';
  font-size: 14px;
  color: #58a6ff;
  font-weight: 900;
}

.gv2-touch-resizer-handle {
  width: 32px;
  height: 32px;
  background: #58a6ff;
  border-radius: 50%;
  box-shadow: 0 0 20px rgba(88, 166, 255, 0.6);
  border: 3px solid #fff;
}

.gv2-touch-resizer-label {
  position: absolute;
  left: 55px;
  top: 50%;
  transform: translateY(-50%);
  background: var(--blue);
  color: #fff;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: bold;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
}

.gv2-touch-resizer:active .gv2-touch-resizer-label {
  opacity: 1;
}


@media (hover: hover) and (pointer: fine) {
  /* Only hide if it's REALLY a desktop (hover + fine pointer) 
     but NOT if it's also a touch device */
  body:not(.is-touch) .gv2-touch-resizer {
    display: none !important;
  }
}

/* Touch devices — wide touch target, inside panel at right/left edge */
.is-touch .gv2-tp-resize-handle,
.is-touch .gv2-lp-resize-handle,
.is-touch .gv2-trades-resize-handle,
.is-touch .gv2-tray-resize-handle,
.is-touch .trade-sidebar-resizer {
  display: flex !important;
  width: 44px !important;
  background: transparent !important;
  z-index: 10010 !important;
  pointer-events: auto !important;
  align-items: center !important;
  justify-content: center !important;
  touch-action: none !important;
}

/* Handle stays inside panel — no negative offset needed */
.is-touch .gv2-tp-resize-handle     { right: 0 !important; }
.is-touch .gv2-trades-resize-handle { right: 0 !important; }
.is-touch .gv2-lp-resize-handle     { right: 0 !important; }
.is-touch .gv2-tray-resize-handle   { left: 0 !important; }

/* iOS-style visible grab pill on touch */
.is-touch .gv2-tp-resize-handle::after,
.is-touch .gv2-lp-resize-handle::after,
.is-touch .gv2-trades-resize-handle::after,
.is-touch .gv2-tray-resize-handle::after {
    content: '';
    width: 5px !important;
    height: 48px !important;
    background: rgba(88, 166, 255, 0.7) !important;
    border-radius: 3px !important;
    opacity: 1 !important;
    transition: background 0.2s, width 0.2s !important;
    box-shadow: 0 0 8px rgba(88, 166, 255, 0.4) !important;
}

.is-touch .gv2-tp-resize-handle.dragging::after,
.is-touch .gv2-lp-resize-handle.dragging::after,
.is-touch .gv2-trades-resize-handle.dragging::after,
.is-touch .gv2-tray-resize-handle.dragging::after {
    background: #58a6ff !important;
    width: 7px !important;
    box-shadow: 0 0 16px rgba(88, 166, 255, 0.8) !important;
}

/* ── TAG PINS ──────────────────────────────────────────────────────────────── */

/* Dot marker — positioned inside #gallery-zoom-layer */
.tag-pin-dot {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: all;    /* always interactive — for drag-to-move */
  cursor: grab;
  z-index: 20;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
  user-select: none;
  -webkit-user-select: none;
}
.tag-pin-dot:hover {
  transform: translate(-50%, -50%) scale(1.35);
  z-index: 21;
}
.tag-pin-dot:hover .tag-pin-tooltip,
.tag-pin-dot:active .tag-pin-tooltip {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
/* While dragging */
.tag-pin-dot.tag-pin-dragging {
  cursor: grabbing !important;
  transform: translate(-50%, -50%) scale(1.5) !important;
  z-index: 30;
  transition: none;
  opacity: 0.9;
}

/* Tooltip */
.tag-pin-tooltip {
  position: absolute;
  bottom: calc(100% + 7px);
  left: 50%;
  transform: translateX(-50%) translateY(5px);
  background: rgba(12, 12, 18, 0.96);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  padding: 6px 10px;
  border-radius: 6px;
  white-space: normal;
  word-break: break-word;
  width: max-content;
  max-width: 240px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
  border: 1px solid;
  backdrop-filter: blur(6px);
  z-index: 1;
}
.tag-pin-tooltip.always-visible {
  opacity: 1 !important;
  transform: translateX(-50%) translateY(0) !important;
  pointer-events: auto !important;
}
.tag-pin-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: rgba(12, 12, 18, 0.96);
}
.tag-pin-tooltip ul,
.tag-pin-tooltip ol {
  margin: 4px 0 2px 16px;
  padding: 0;
  list-style-position: outside;
}
.tag-pin-tooltip ul { list-style-type: disc; }
.tag-pin-tooltip ol { list-style-type: decimal; }
.tag-pin-tooltip li { margin: 2px 0; padding-left: 2px; }
.tag-pin-tooltip strong { font-weight: 900; }
.tag-pin-tooltip em { font-style: italic; }
.tag-pin-tooltip u  { text-decoration: underline; }

/* Delete mode — pulsing + pointer cursor */
.tag-pin-delete-mode {
  cursor: pointer !important;
  animation: tagPinPulse 0.9s ease infinite;
}
.tag-pin-delete-mode:hover {
  transform: translate(-50%, -50%) scale(1.4);
  filter: brightness(1.3);
}
@keyframes tagPinPulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50%       { transform: translate(-50%, -50%) scale(1.22); }
}

/* Drop hover on main image */
#gallery-img.tag-pin-drop-hover {
  outline: 2px dashed rgba(255, 215, 0, 0.7);
  outline-offset: 3px;
  transition: outline 0.1s;
}

/* Thumbnail pin count badge */
.tag-pin-thumb-badge {
  position: absolute;
  bottom: 20px;
  right: 3px;
  background: #e74c3c;
  color: #fff;
  font-size: 0.6rem;
  font-weight: 800;
  min-width: 15px;
  height: 15px;
  border-radius: 8px;
  padding: 0 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 6;
  pointer-events: none;
  border: 1.5px solid rgba(0, 0, 0, 0.4);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}

/* iPad long-press pending tag highlight */
.tag-pin-pending {
  outline: 2px solid #ffd700 !important;
  outline-offset: 2px;
  animation: tagPinPendingGlow 0.85s ease infinite;
}
@keyframes tagPinPendingGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.5); }
  50%       { box-shadow: 0 0 0 7px rgba(255, 215, 0, 0); }
}

/* Header pin control buttons — active state */
.tag-pin-btn-active {
  color: #ffd700 !important;
  border-color: rgba(255, 215, 0, 0.5) !important;
  background: rgba(255, 215, 0, 0.1) !important;
}

```

## File: `static/css/style-gallery-b.css`
```css
/* ── GALLERY V2 ────────────────────────────────── */
:root {
  --icon-blue: #3b82f6;
  --icon-green: #10b981;
  --icon-purple: #8b5cf6;
  --icon-orange: #f59e0b;
  --icon-cyan: #06b6d4;
  --icon-teal: #14b8a6;
  --icon-red: #ef4444;
  --icon-white: #e5e7eb;
  --icon-grey: #9ca3af;
}

.gv2-modal {
  flex-direction: column;
  background: #0a0a0b;
  align-items: stretch;
  justify-content: flex-start;
  /* position: fixed comes from .modal-overlay — do NOT add relative here */
}

.gv2-modal.open {
  display: flex;
}

/* 📄 PDF Export & Print Styles */
@media print {
  html, body { background: white !important; color: black !important; height: auto !important; overflow: visible !important; }
  /* Hide everything EXCEPT the print layer — use display:none to remove from print flow entirely */
  body > *:not(#gv2-pdf-print-layer) { display: none !important; }
  #gv2-pdf-print-layer { display: block !important; position: static !important; left: 0; top: 0; width: 100% !important; height: auto !important; overflow: visible !important; background: white !important; }

  /* Don't restrict width on positioned images inside PDF layer (needed for zoom/pan transforms) */
  #gv2-pdf-print-layer img[style*="position:absolute"] { max-width: none !important; }
  img { max-width: 100% !important; page-break-inside: avoid; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}

/* Hide the print helper layer on screen completely */
#gv2-pdf-print-layer {
    display: none;
    background: white;
}

#gv2-pdf-export-area {
  font-family: 'Inter', -apple-system, sans-serif;
  background: white;
  padding: 40px;
  color: #1a1a1a;
}



/* ── Ribbon bar — 5-column grid, fixed at top ── */
.gv2-tray {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1002;
  height: calc(46px + env(safe-area-inset-top, 0px));
  display: grid;
  grid-template-columns: auto 230px 1fr auto auto;
  align-items: center;
  background: rgba(10, 10, 11, 0.9);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  box-shadow: 0 1px 12px rgba(0,0,0,0.4);
  padding: 0 6px;
  padding-top: env(safe-area-inset-top, 0px);
  padding-left: max(6px, env(safe-area-inset-left, 6px));
  padding-right: max(6px, env(safe-area-inset-right, 6px));
  pointer-events: none;
  overflow: visible;
}

.gv2-tray > * {
  pointer-events: auto;
}

/* Col 1 — Hamburger, left-aligned, no centering */
.gv2-tc1 {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px 0 4px;
  justify-content: flex-start;
}

/* Col 2 — Date nav + counter, fixed width, single line, centered */
.gv2-tc2 {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 230px;
  overflow: visible;
}

.gv2-tc2-dot {
  color: var(--text3, #666);
  font-size: 1rem;
  line-height: 1;
  flex-shrink: 0;
}

/* Col 3 — Trade pills, stretches to fill remaining space, centered */
.gv2-tc3 {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  overflow: visible;
  min-width: 0;
}

/* Col 4 — Icon buttons, centered */
.gv2-tc4 {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 6px;
}

/* Col 5 — Settings + Close, right-aligned */
.gv2-tc5 {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  padding: 0 4px 0 6px;
}

/* ── Hamburger button ── */
.gv2-hamburger-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  color: #aaa;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.gv2-hamburger-btn:hover {
  background: rgba(255,255,255,0.1);
  border-color: rgba(255,255,255,0.2);
  color: #fff;
}
.gv2-hamburger-btn.active {
  background: rgba(88,166,255,0.12);
  border-color: rgba(88,166,255,0.4);
  color: #58a6ff;
}

/* ── Tray X Close button (extreme right of ribbon) ── */
.gv2-tray-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.1);
  color: #f87171;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, border-color 0.15s;
}
.gv2-tray-close-btn:hover {
  background: rgba(248, 113, 113, 0.25);
  border-color: rgba(248, 113, 113, 0.6);
  color: #fff;
}

/* ── Gallery Settings Modal ── */
.gv2-settings-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 1010;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(4px);
  align-items: center;
  justify-content: center;
}
.gv2-settings-overlay.open {
  display: flex;
}
.gv2-settings-panel {
  background: rgba(18, 18, 26, 0.97);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 16px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.85);
  padding: 24px;
  min-width: 300px;
  max-width: 420px;
  width: 90vw;
}
.gv2-settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.gv2-settings-title {
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.02em;
}
.gv2-settings-close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06);
  color: #aaa;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.gv2-settings-close:hover { background: rgba(255,255,255,0.14); color: #fff; }
.gv2-settings-section-label {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
  margin-bottom: 8px;
  margin-top: 16px;
}
.gv2-settings-section-label:first-of-type { margin-top: 0; }
.gv2-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.03);
  margin-bottom: 6px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  color: #ccc;
  font-size: 0.88rem;
  gap: 10px;
}
.gv2-settings-row:hover {
  background: rgba(255,255,255,0.07);
  border-color: rgba(255,255,255,0.15);
  color: #fff;
}
.gv2-settings-row.active {
  background: rgba(88, 166, 255, 0.12);
  border-color: rgba(88, 166, 255, 0.4);
  color: #58a6ff;
}
.gv2-settings-row-icon { font-size: 1rem; flex-shrink: 0; }
.gv2-settings-row-label { flex: 1; }
.gv2-settings-row-badge {
  font-size: 0.72rem;
  background: rgba(88,166,255,0.15);
  color: #58a6ff;
  border-radius: 6px;
  padding: 2px 7px;
  font-weight: 600;
}

/* ── Tray back/close arrow (on dark gradient bg) ── */
.gv2-tray-back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.75);
  border-radius: 6px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}

.gv2-tray-back-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}


.gv2-tray-record-bars {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
}

.gv2-tray-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: transparent;
  border: 1px solid transparent;
  color: rgba(255, 255, 255, 0.7);
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.gv2-tray-icon-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.gv2-tray-icon-btn.active,
.gv2-thumb-toggle-btn.active {
  background: rgba(88, 166, 255, 0.25);
  border-color: var(--blue);
  color: var(--blue);
}

/* ── Tray visual separator ── */
.gv2-tray-sep {
  width: 1px;
  height: 20px;
  background: linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.15), transparent);
  margin: 0 4px;
  flex-shrink: 0;
}

/* ── Unifying all pills (Record, P&L, Trade, Filter) ── */
.gv2-tray-pill, .gv2-pnl-pill, .gv2-trade-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 32px;
  padding: 0 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 100px; /* Perfect pill shape */
  color: #c0c0c8;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  user-select: none;
  backdrop-filter: blur(4px);
}

.is-touch .gv2-tray-pill,
.is-touch .gv2-pnl-pill,
.is-touch .gv2-trade-pill {
  height: 28px;
  padding: 0 8px;
  font-size: 0.75rem;
  gap: 3px;
  flex-shrink: 1;
  min-width: 0;
}

/* Hide verbose info on tablets/mobile to prevent clipping */
.is-touch .gv2-tp-inst,
.is-touch .gv2-tp-info,
.is-touch .gv2-tp-total,
.is-touch .gv2-tray-sep {
  display: none !important;
}

@media screen and (max-width: 1200px) {
  .gv2-tp-inst, .gv2-tp-info, .gv2-tp-total {
    display: none !important;
  }
  .gv2-tray-sep {
    display: none !important;
  }
  .gv2-trade-pill {
      max-width: 180px;
  }
}

/* ── New grid ribbon (col3): restore full desktop trade pill on all screen sizes ── */
.gv2-tc3 .gv2-trade-pill {
  height: 32px !important;
  padding: 0 14px !important;
  font-size: 0.82rem !important;
  gap: 8px !important;
  max-width: none !important;
  flex-shrink: 1;
  min-width: 0;
}
.gv2-tc3 .gv2-tp-inst,
.gv2-tc3 .gv2-tp-info,
.gv2-tc3 .gv2-tp-total {
  display: inline !important;
}

.gv2-tray-pill:hover, .gv2-pnl-pill:hover, .gv2-trade-pill:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
  transform: translateY(-1px);
}

.gv2-tray-pill:active {
  transform: translateY(0);
}

/* Special state for Record pill when menu is open or recording is active */
.gv2-record-trigger.active {
  background: rgba(255, 71, 66, 0.12);
  border-color: rgba(255, 71, 66, 0.4);
  color: #ff4742;
  box-shadow: 0 0 15px rgba(255, 71, 66, 0.1);
}

/* Special state for Filter pill when highlighted */
.gv2-filter-trigger:hover {
  border-color: var(--blue);
  color: var(--blue);
}

/* Dropdown specific centering in tray */
.dropdown-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%) translateY(10px);
  background: rgba(18, 18, 24, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 15px 50px rgba(0, 0, 0, 0.9);
  padding: 8px;
  min-width: 160px;
  z-index: 1000;
  display: none;
  backdrop-filter: blur(20px);
  transition: all 0.2s;
}

.dropdown-menu.open {
  display: block;
  transform: translateX(-50%) translateY(0);
}

/* ── Date label: calendar icon via ::before ── */
.gv2-tray-pill, .gv2-pnl-pill, .gv2-trade-pill, .gv2-target-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 32px;
  padding: 0 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px; 
  color: #dbdbdf;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  user-select: none;
  backdrop-filter: blur(4px);
  box-shadow: none;
  font-family: inherit;
}

.gv2-tray-icon {
  width: 17px;
  height: 17px;
  stroke-width: 2.2;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.gv2-tray-pill:hover .gv2-tray-icon {
  opacity: 1;
}

/* Pulse animation for the recording dot */
.rec-dot-pulse {
  animation: gv2-record-pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes gv2-record-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

.gv2-pnl-pill.positive {
  color: #00e676;
  border-color: rgba(0, 230, 118, 0.3);
  background: rgba(0, 230, 118, 0.08);
}

.gv2-pnl-pill.negative {
  color: #ff5252;
  border-color: rgba(255, 82, 82, 0.3);
  background: rgba(255, 82, 82, 0.08);
}

.gv2-pnl-pill.neutral {
  border-color: rgba(255, 255, 255, 0.1);
  color: #888891;
}

.gv2-tray-pill:hover, .gv2-pnl-pill:hover, .gv2-trade-pill:hover, .gv2-target-pill:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.3);
  color: #fff;
  transform: translateY(-1.5px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

/* ── Unified Date Navigation Pill (Integrated structure) ── */
.gv2-date-nav-pill {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  overflow: hidden;
  height: 32px;
}

.is-touch .gv2-date-nav-pill {
  height: 28px;
  border-radius: 8px;
  flex-shrink: 0;
}

.gv2-date-nav-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  width: 28px;
  height: 100%;
  cursor: pointer;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.gv2-date-nav-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.gv2-date-nav-btn:disabled {
  opacity: 0.2;
  cursor: default;
}

.gv2-date-display {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
  cursor: pointer;
}

.is-touch .gv2-date-display {
  min-width: 60px;
  padding: 0 4px;
}

.gv2-date-display:hover {
  background: rgba(255, 255, 255, 0.05);
}

.gv2-date-display #gallery-date {
  font-size: 0.82rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.4px;
}

.gv2-date-picker-hidden {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  z-index: 5;
  width: 100%;
  height: 100%;
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
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.35);
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
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

.gv2-exit-btn {
  background: rgba(25, 25, 30, 0.85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  padding: 8px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  margin-right: 4px;
  margin-top: 4px;
}

.gv2-exit-btn:hover {
  background: rgba(219, 58, 60, 0.15);
  border-color: rgba(219, 58, 60, 0.4);
  color: #ff6b6b;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6);
}

.gv2-exit-btn:active {
  transform: translateY(1px);
}

/* Body layout — padding-top accounts for ribbon height */
.gv2-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
  min-height: 0;
  padding-top: calc(46px + env(safe-area-inset-top, 0px));
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
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
  display: none;
  /* counter now shown in top tray as "1/17" */
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
  z-index: 10;
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

/* Heads / Stats bar (below image — not overlapping chart) */
.gallery-heads-display {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 16px;
  padding: 5px 12px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  font-size: 0.8rem;
  color: var(--text2);
  flex-shrink: 0;
  min-height: 0;
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
  font-size: 0.75rem;
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

.dropdown-item {
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.75);
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 6px;
  font-size: 0.85rem;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dropdown-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.dropdown-item.active {
  background: rgba(88, 166, 255, 0.15);
  color: var(--blue);
  font-weight: 600;
}

.rec-icon {
  font-size: 0.7rem;
  color: #ff4742;
  text-shadow: 0 0 8px rgba(255, 71, 66, 0.4);
}

.gv2-record-trigger.active {
  background: rgba(255, 71, 66, 0.15);
  border-color: rgba(255, 71, 66, 0.3);
  color: #ff4742;
}

.gv2-record-dropdown {
  min-width: 140px;
}

.gv2-tray-icon {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.7);
}

.gv2-menu-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  opacity: 0.7;
}

.rec-dot-pulse {
  animation: rec-pulse 2s infinite ease-in-out;
}

@keyframes rec-pulse {
  0% { opacity: 1; r: 5; }
  50% { opacity: 0.6; r: 6.5; }
  100% { opacity: 1; r: 5; }
}

.gv2-record-trigger.active .gv2-tray-icon {
  color: #ff4742;
}

.gv2-record-trigger.active .rec-dot-pulse {
  animation-duration: 0.8s;
  box-shadow: 0 0 10px #ff4742;
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

/* ── Mobile: ribbon becomes horizontally scrollable ── */
@media (max-width: 600px) {
  .gv2-tray {
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
    padding: 0 4px;
    gap: 0;
  }
  .gv2-tray::-webkit-scrollbar { display: none; }

  /* Col 1 (hamburger) stays pinned left */
  .gv2-tc1 {
    position: sticky;
    left: 0;
    z-index: 3;
    background: #0a0a0b;
    padding: 0 4px 0 2px;
    flex-shrink: 0;
  }

  /* Col 5 (settings + close) stays pinned right */
  .gv2-tc5 {
    position: sticky;
    right: 0;
    z-index: 3;
    background: #0a0a0b;
    padding: 0 2px 0 4px;
    flex-shrink: 0;
  }

  /* Scrollable middle columns */
  .gv2-tc2 {
    flex-shrink: 0;
    width: auto;
    gap: 4px;
    padding: 0 6px;
  }

  .gv2-tc3 {
    flex-shrink: 0;
    padding: 0 6px;
  }

  .gv2-tc4 {
    flex-shrink: 0;
    padding: 0 6px;
  }
}

/* ── Unified Left Panel, Trade Ref Cards, Lightbox → style-gallery-d.css ── */


```

## File: `static/css/style-gallery-c.css`
```css
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

/* Play button in video bar */
.gv2-video-play {
  border-color: #0066cc;
  color: #4da6ff;
  font-size: 0.8rem;
  padding: 4px 12px;
}
.gv2-video-play:hover { background: rgba(0,100,220,0.18); }

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

/* ── TRAY PILLS (TradingView style) ──────────────── */

/* Day P&L pill */
.gv2-trade-pill .gv2-tp-label { color: var(--text2); font-weight: 500; }
.gv2-trade-pill .gv2-tp-sep { color: var(--text3); margin: 0 1px; }
.gv2-trade-pill .gv2-tp-val { font-weight: 700; }
.gv2-trade-pill .gv2-tp-val.pos { color: #2ecc71; }
.gv2-trade-pill .gv2-tp-val.neg { color: #e74c3c; }
.gv2-trade-pill::after { content: '▼'; font-size: 0.5em; opacity: 0.5; margin-left: 2px; }

.gv2-pnl-dropdown {
  display: none;
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: #1e2130;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 4px 0;
  min-width: 190px;
  z-index: 9999;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.75);
}
.gv2-pnl-dropdown.open { display: block; }

.gv2-pnl-trade-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  font-size: 0.92rem;
  cursor: pointer;
  transition: background 0.1s;
  gap: 10px;
}
.gv2-pnl-trade-row:hover { background: rgba(255,255,255,0.06); }
.gv2-pnl-trade-label { color: var(--text2); font-weight: 500; }
.gv2-pnl-trade-val {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* Tray image counter — plain text on dark overlay */
.gv2-tray-counter {
  font-size: 0.8rem;
  color: rgba(255,255,255,0.75);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  letter-spacing: 0.3px;
  padding: 0 2px;
  text-shadow: 0 1px 3px rgba(0,0,0,0.6);
}

/* ── More menu dropdown items ───────────────────── */
.gv2-di-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0.65;
}
.gv2-di-icon svg { width: 14px; height: 14px; display: block; }
.dropdown-item:hover .gv2-di-icon { opacity: 1; }

.gv2-di-danger { color: #e74c3c !important; }
.gv2-di-danger:hover {
  background: rgba(231, 76, 60, 0.1) !important;
  color: #e74c3c !important;
}
.gv2-di-danger .gv2-di-icon { opacity: 0.8; }

/* ── Gallery tools dropdown — TradingView style ─── */
#gallery-tools-panel {
  background: #1e2130;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.8);
  padding: 4px 0;
  min-width: 200px;
}
#gallery-tools-panel .dropdown-item {
  color: #c8ccd8;
  font-size: 0.83rem;
  padding: 8px 14px;
  gap: 10px;
  font-weight: 500;
}
#gallery-tools-panel .dropdown-item:hover {
  background: rgba(255,255,255,0.07);
  color: #fff;
}
#gallery-tools-panel .dropdown-divider {
  background: rgba(255,255,255,0.08);
  margin: 3px 0;
}

/* ── RELOCATED RECORDING TOOLS (Tray) ─────────── */
.gv2-tray-record-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gv2-record-toggle-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: var(--text2);
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.gv2-record-toggle-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  color: #fff;
}

.gv2-record-toggle-btn.active {
  background: rgba(248, 81, 73, 0.15);
  border-color: rgba(248, 81, 73, 0.4);
  color: #ff7b72;
}

.gv2-record-toggle-btn .rec-icon {
  color: #f85149;
  font-size: 0.9rem;
  animation: gv2-rec-blink 1.5s ease-in-out infinite;
}

@keyframes gv2-rec-blink {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.85); }
}

.gv2-tray-record-bars {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  z-index: 2200 !important;
}

/* Overrides for bars when inside tray-record-bars wrapper */
.gv2-tray-record-bars .gv2-audio-bar,
.gv2-tray-record-bars .gv2-video-bar {
  position: relative !important;
  bottom: auto !important;
  left: auto !important;
  transform: none !important;
  box-shadow: none !important;
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  backdrop-filter: none !important;
}

.gv2-tray-record-bars .gv2-audio-btn {
  padding: 3px 10px !important;
  font-size: 0.75rem !important;
  border-radius: 5px !important;
  border: 1px solid rgba(255,255,255,0.12) !important;
  background: rgba(255,255,255,0.06) !important;
  color: #cdd9e5 !important;
  cursor: pointer !important;
  transition: background 0.15s !important;
}

.gv2-tray-record-bars .gv2-audio-btn:hover {
  background: rgba(255,255,255,0.15) !important;
}

.gv2-tray-record-bars .gv2-audio-btn.gv2-video-rec {
  border-color: rgba(88,166,255,0.35) !important;
  color: #58a6ff !important;
}

.gv2-tray-record-bars .gv2-audio-btn.gv2-video-rec:hover {
  background: rgba(88,166,255,0.15) !important;
}

.gv2-tray-record-bars .gv2-audio-btn.gv2-audio-rec {
  border-color: rgba(248,81,73,0.35) !important;
  color: #ff7b72 !important;
}

.gv2-tray-record-bars .gv2-audio-btn.gv2-audio-rec:hover {
  background: rgba(248,81,73,0.12) !important;
}

.gv2-tray-record-bars .gv2-audio-wave {
  height: 28px !important;
}

.gv2-tray-record-bars .gv2-bar-sep {
  height: 14px !important;
  background: rgba(255, 255, 255, 0.15) !important;
}

/* ── TOP TAG BAND (Relocated) ────────────────── */
.gv2-center {
  display: flex !important;
  flex-direction: column !important;
  background: #000;
  overflow: hidden;
}

.top-tags-band {
  position: absolute !important;
  top: 10px;
  left: 20px;
  right: auto;
  width: auto;
  min-height: auto;
  max-width: 40%;
  display: flex !important;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 8px;
  padding: 6px 14px;
  background: rgba(15, 15, 20, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 30px;
  z-index: 100;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
}

/* Adjust filter active bar to not overlap if on left */


.top-tags-band .gallery-tag-empty {
  font-size: 0.72rem;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.8;
  margin-right: 4px;
}

.gv2-img-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── TRADE EXPANSION (Filter Mode) ──────────────── */
.gv2-thumb-wrap.expanded-trade {
  outline: 2px solid #f5c518;
  outline-offset: 1px;
  border-radius: 4px;
  box-shadow: 0 0 12px rgba(245, 197, 24, 0.3);
  z-index: 10;
}

.gv2-thumb-wrap.collapsed-trade-preview::after {
  content: 'TRADE';
  position: absolute;
  top: 4px;
  left: 4px;
  background: rgba(0, 0, 0, 0.7);
  color: #f5c518;
  font-size: 0.55rem;
  font-weight: 800;
  padding: 1px 4px;
  border-radius: 3px;
  border: 1px solid rgba(245, 197, 24, 0.5);
  pointer-events: none;
  opacity: 0.8;
}

.gv2-thumb-wrap.collapsed-trade-preview:hover {
  filter: brightness(1.1);
}

.gv2-thumb-wrap.collapsed-trade-preview:hover::after {
  content: 'CTRL+CLICK';
  opacity: 1;
}
 
/* Target pill logic moved to b.css */
.gv2-news-thumbnail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 5px;
  padding: 5px 6px;
  background: rgba(255, 165, 0, 0.03);
  border-left: 2px solid rgba(255, 165, 0, 0.2);
  margin: 5px 0;
}
.gv2-news-thumbnail-grid .gv2-thumb-wrap {
  width: 100% !important;
  margin: 0 !important;
}
.gv2-news-thumbnail-grid .gv2-thumb {
  width: 100% !important;
  height: auto !important;
  aspect-ratio: 9 / 20; /* Matching Inshorts screenshots */
}


/* ── Index / Premium toggle pill ── */
.gv2-imgtype-btn {
  background: transparent;
  border: none;
  color: var(--text3);
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 14px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}
.gv2-imgtype-btn:hover { background: var(--hover); color: var(--text1); }
.gv2-imgtype-btn.active { background: var(--accent, #58a6ff); color: #fff; font-weight: 600; }

```

## File: `static/css/style-gallery-d.css`
```css
/* â”€â”€ Right Sidebar Strip â”€â”€ */
.gv2-sidebar-strip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  background: var(--surface);
  border-left: 1px solid var(--border);
  flex-shrink: 0;
  width: 40px;
  position: relative;
}

.gv2-sb-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text2);
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.15s;
  flex-shrink: 0;
}

.gv2-sb-btn:hover {
  background: var(--surface2);
  border-color: var(--border2);
  color: var(--text);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.05);
}

/* Specific Sidebar Icon Colors with subtle glows on hover */
#gv2-fullscreen-btn {
  color: var(--icon-white);
}

#gv2-popout-btn {
  color: var(--icon-orange);
}

#gv2-popout-btn:hover {
  text-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
}

#gv2-tags-btn {
  color: var(--icon-blue);
}

#gv2-thumb-toggle-btn {
  color: var(--icon-cyan);
}

#gv2-layer-btn {
  color: var(--icon-purple);
}

#gallery-upload-btn {
  color: var(--icon-green);
}

#gallery-show-heads-btn {
  color: var(--icon-orange);
}

#gallery-img-tag-filter-btn {
  color: var(--icon-teal);
}

#gallery-tools-btn {
  color: var(--icon-grey);
}

#gv2-tags-btn:hover {
  text-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
}

#gv2-thumb-toggle-btn:hover {
  text-shadow: 0 0 8px rgba(6, 182, 212, 0.4);
}

#gv2-layer-btn:hover {
  text-shadow: 0 0 8px rgba(139, 92, 246, 0.4);
}

#gallery-upload-btn:hover {
  text-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
}

#gallery-show-heads-btn:hover {
  text-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
}

#gallery-img-tag-filter-btn:hover {
  text-shadow: 0 0 8px rgba(20, 184, 166, 0.4);
}

#gv2-record-toggle-btn {
  color: var(--icon-red);
}

#gv2-filter-type-trigger {
  color: var(--icon-white);
}

.gv2-sb-btn.active {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: inherit;
}

.gv2-sb-sep {
  width: 22px;
  height: 1px;
  background: var(--border2);
  margin: 3px 0;
  flex-shrink: 0;
}

.gv2-thumb-wrap {
  position: relative;
  flex-shrink: 0;
  cursor: pointer;
}

/* â”€â”€ Thin horizontal separators in thumb panel â”€â”€ */
.gv2-thumb-separator {
  width: 100% !important;
  height: auto !important;
  min-height: 38px !important;
  min-width: unset !important;
  margin: 6px 0 !important;
  padding: 10px 14px !important;
  align-self: flex-start !important;
  border-radius: 4px !important;
  border: none !important;
  color: #ffd700 !important;
  border-top: 2px solid #ffd700 !important;
  cursor: pointer;
  display: flex !important;
  flex-direction: column !important;
  box-sizing: border-box !important;
  background: rgba(255, 215, 0, 0.05) !important;
}

.gv2-sep-label {
  font-size: 0.88rem;
  font-weight: 800;
  line-height: 1.3;
  white-space: nowrap;
  padding-bottom: 2px;
}

.gv2-sep-stats {
  font-size: 0.84rem;
  font-weight: 700;
  line-height: 1.3;
  opacity: 0.95;
  white-space: nowrap;
  letter-spacing: 0.3px;
}

.gv2-thumb-separator.selected-separator {
  border-top-color: var(--blue) !important;
  background: rgba(88, 166, 255, 0.08) !important;
  color: var(--blue) !important;
}

.gv2-thumb-separator:hover {
  background: rgba(255, 255, 255, 0.06) !important;
  color: var(--text2) !important;
}

.gv2-thumb-separator.drag-active {
  border-top-color: var(--blue) !important;
  background: rgba(88, 166, 255, 0.15) !important;
  color: #fff !important;
}

.gv2-thumb-wrap.drag-over {
  outline: 2px dashed var(--blue);
  border-radius: 6px;
}

.gv2-thumb-wrap.dragging {
  opacity: 0.4;
}

.gv2-thumb-wrap {
  width: 100%;
}

.gv2-thumb {
  width: 100%;
  aspect-ratio: 1 / 0.62;
  height: auto;
  object-fit: cover;
  border-radius: 4px;
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

.gv2-thumb-video {
  width: 100%;
  aspect-ratio: 1 / 0.62;
  height: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a2e;
  font-size: 1.2rem;
  cursor: pointer;
  border: 1px solid #7c3aed !important;
  border-radius: 4px;
}

.gv2-thumb-video-icon {
  pointer-events: none;
  z-index: 5;
  transition: transform 0.2s;
}

.gv2-thumb-video:hover .gv2-thumb-video-icon {
  transform: scale(1.2);
}

.gv2-thumb-video.active {
  border-color: var(--blue);
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
  z-index: 100;
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
  left: -5px;
  /* Increase hit area offset */
  top: 0;
  bottom: 0;
  width: 12px;
  /* Increased hit area */
  cursor: ew-resize;
  z-index: 100;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gv2-tray-resize-handle::after {
  content: '';
  width: 4px;
  height: 30px;
  background: var(--border2);
  border-radius: 2px;
  opacity: 0.5;
  transition: opacity 0.2s, background 0.2s;
}

.gv2-tray-resize-handle:hover::after,
.gv2-tray-resize-handle.dragging::after {
  background: var(--blue);
  opacity: 1;
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
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
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

/* â”€â”€ DROPWDOWN & ICON COLORS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.dropdown-menu {
  background: rgba(15, 15, 20, 0.95) !important;
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 12px !important;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8) !important;
  padding: 6px !important;
}

.dropdown-item {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  padding: 8px 12px !important;
  border-radius: 8px !important;
  font-size: 0.82rem !important;
  transition: all 0.2s !important;
  background: transparent !important;
  border: none !important;
  width: 100% !important;
  text-align: left !important;
  cursor: pointer !important;
}

.dropdown-item:hover {
  background: rgba(255, 255, 255, 0.08) !important;
  box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.02);
}

.gv2-di-icon svg {
  width: 16px;
  height: 16px;
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.5));
}

.dropdown-item:hover .gv2-di-icon svg {
  filter: drop-shadow(0 0 5px currentColor);
}

/* Individual Item Colors */
#gv2-download-btn {
  color: var(--icon-blue) !important;
}

#gv2-replace-btn {
  color: var(--icon-green) !important;
}

#gv2-add-after-btn {
  color: var(--icon-purple) !important;
}

#gv2-copy-img-btn {
  color: var(--icon-cyan) !important;
}

#gv2-share-link-btn {
  color: var(--icon-orange) !important;
}

#gv2-mark-review-btn {
  color: var(--icon-white) !important;
}

#gv2-marquee-btn {
  color: var(--icon-grey) !important;
}

#gv2-time-btn {
  color: var(--icon-white) !important;
}

#gallery-tag-btn {
  color: var(--icon-teal) !important;
}

#gv2-obs-btn {
  color: var(--icon-blue) !important;
}

#gv2-delete-img-btn {
  color: var(--icon-red) !important;
}

.dropdown-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 6px 0;
}

/* â”€â”€ ADDITIONAL RESIZE HANDLES â”€â”€ */
.gv2-lp-resize-handle,
.gv2-trades-resize-handle {
  position: absolute;
  right: -5px;
  top: 0;
  bottom: 0;
  width: 12px;
  cursor: ew-resize;
  z-index: 100;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gv2-lp-resize-handle::after,
.gv2-trades-resize-handle::after {
  content: '';
  width: 4px;
  height: 100px;
  background: var(--border2);
  border-radius: 2px;
  opacity: 0.5;
  transition: opacity 0.2s, background 0.2s;
}

.gv2-lp-resize-handle:hover::after,
.gv2-lp-resize-handle.dragging::after,
.gv2-trades-resize-handle:hover::after,
.gv2-trades-resize-handle.dragging::after {
  background: var(--blue);
  opacity: 1;
}

/* Custom styling for the sort select to fix visibility in dark mode */
.gv2-sort-select {
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") !important;
  background-repeat: no-repeat !important;
  background-position: right 5px center !important;
  padding: 3px 20px 3px 6px !important;
  font-size: 0.75rem !important;
  cursor: pointer !important;
  outline: none !important;
  color: #fff !important;
  background-color: var(--surface3, #1e2130) !important;
  border: 1px solid rgba(255,255,255,0.15) !important;
  border-radius: 4px;
  transition: border-color 0.2s;
}

.gv2-sort-select:hover {
  border-color: var(--blue) !important;
}
.gv2-sort-select option {
  background-color: #131722 !important; /* Fixed dark background */
  color: #eee !important;
}

#gv2-trades-sort-order-btn {
  background: rgba(88, 166, 255, 0.1) !important;
  color: var(--blue, #58a6ff) !important;
  border: 1px solid rgba(88, 166, 255, 0.3) !important;
  font-weight: 600;
}
#gv2-trades-sort-order-btn:hover {
  background: rgba(88, 166, 255, 0.2) !important;
  border-color: var(--blue) !important;
}

/* ── Unified Left Panel (Thumbnails + Filter) ── */
.gv2-unified-left-panel {
  width: 0;
  flex-shrink: 0;
  overflow: hidden;
  background: var(--surface);
  border-right: 1px solid var(--border);
  transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  display: flex !important;
  flex-direction: column;
  touch-action: pan-y;
}

.gv2-unified-left-panel.open {
  width: var(--ulp-panel-w, 400px);
}

.gv2-ulp-tabs {
  display: flex;
  background: rgba(20, 20, 25, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
  padding: 6px 6px 0;
  gap: 4px;
  flex-shrink: 0;
}

.gv2-ulp-tab {
  background: transparent;
  border: 1px solid transparent;
  border-bottom: none;
  color: var(--text3);
  padding: 4px 8px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  border-radius: 8px 8px 0 0;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  letter-spacing: 0.3px;
  opacity: 0.7;
}



.gv2-ulp-tab:hover {
  color: var(--text2);
  background: rgba(255, 255, 255, 0.08);
  opacity: 1;
}

.gv2-ulp-tab.active {
  color: var(--blue);
  background: var(--surface);
  border-color: var(--border);
  opacity: 1;
  position: relative;
  margin-bottom: -1px;
  z-index: 2;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.2);
}

.gv2-ulp-tab.active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--blue);
  border-radius: 8px 8px 0 0;
}


.gv2-ulp-pane-header {
  display: flex;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.02);
  flex-shrink: 0;
}

.gv2-ulp-ctrl-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text3);
  cursor: pointer;
  padding: 3px 10px;
  font-size: 0.7rem;
  font-weight: 700;
  border-radius: 6px;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 3px;
  opacity: 0.85;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.gv2-ulp-ctrl-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
  opacity: 1;
}

.gv2-ulp-close {
  background: transparent;
  border: none;
  color: var(--text3);
  cursor: pointer;
  padding: 4px 8px;
  font-size: 0.8rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gv2-ulp-close:hover {
  color: var(--red);
}

.is-touch .gv2-ulp-close {
  width: 48px;
  height: 44px;
  font-size: 1.3rem;
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.gv2-ulp-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.gv2-ulp-pane {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  height: 100%;
}

.gv2-thumbs {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  overflow-x: clip;
  -webkit-overflow-scrolling: touch;
  align-items: center;
  padding: 12px;
  touch-action: pan-y;
  flex: 1;
  scrollbar-width: thin;
  scrollbar-color: var(--border2) transparent;
  overscroll-behavior: contain;
}


/* Right-edge resize handle — MOVED OUTSIDE to clear the scrollbar */
.gv2-tp-resize-handle {
  position: absolute;
  right: -12px; /* Position it outside the panel */
  top: 0;
  bottom: 0;
  width: 16px; /* Wider hit area */
  cursor: ew-resize;
  z-index: 2000; /* High z-index to stay above other elements */
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gv2-tp-resize-handle::after {
  content: '';
  width: 4px;
  height: 32px;
  background: var(--border2);
  border-radius: 2px;
  opacity: 0.5;
  transition: opacity 0.2s, background 0.2s;
}

.gv2-tp-resize-handle:hover::after,
.gv2-tp-resize-handle.dragging::after {
  background: var(--blue);
  opacity: 1;
}

.gv2-thumbs::-webkit-scrollbar {
  width: 8px;
}

.gv2-thumbs::-webkit-scrollbar-track {
  background: transparent;
}

.gv2-thumbs::-webkit-scrollbar-thumb {
  background: var(--border2);
  border-radius: 3px;
}

.gv2-thumbs::-webkit-scrollbar-thumb:hover {
  background: var(--text3);
}

/* â”€â”€ Trade Selection Highlighting â”€â”€ */
.gv2-trade-pill.active {
  border-color: rgba(59, 130, 246, 0.4) !important;
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.2) !important;
}

.gv2-thumb-wrap.trade-active {
  background: rgba(59, 130, 246, 0.08); /* Group background */
  border-radius: 8px;
  box-shadow: inset 0 0 10px rgba(59, 130, 246, 0.1);
}

.gv2-thumb-wrap.trade-active .gv2-thumb {
  border-color: rgba(59, 130, 246, 0.3) !important;
}

.gv2-thumb-wrap.trade-active .gv2-thumb.active {
  border-color: #3b82f6 !important;
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.5);
  transform: scale(1.03);
}

/* â”€â”€ Trade Ref Card (dual-panel index/premium snapshot) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.gv2-ref-card {
  display: flex;
  width: 100%;
  height: 76px;
  background: rgba(0,0,0,0.45);
  border-bottom: 1px solid rgba(255,215,0,0.12);
  overflow: hidden;
  flex-shrink: 0;
  box-sizing: border-box;
}

.gv2-ref-half {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  min-width: 0;
}
.gv2-ref-half:hover { background: rgba(255,255,255,0.04); }

.gv2-ref-divider {
  width: 1px;
  background: rgba(255,255,255,0.12);
  flex-shrink: 0;
}

.gv2-ref-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.gv2-ref-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 3px 5px;
  background: linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 55%);
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
}
.gv2-ref-half:hover .gv2-ref-overlay { opacity: 1; pointer-events: auto; }

.gv2-ref-lbl {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: rgba(255,255,255,0.75);
  text-transform: uppercase;
  pointer-events: none;
  user-select: none;
  line-height: 1.4;
}

.gv2-ref-actions {
  display: flex;
  gap: 2px;
}

.gv2-ref-lock-btn,
.gv2-ref-clear-btn {
  background: rgba(0,0,0,0.5);
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.7rem;
  padding: 1px 4px;
  line-height: 1.4;
  color: rgba(255,255,255,0.7);
  transition: opacity 0.1s, background 0.1s;
}
.gv2-ref-lock-btn:hover,
.gv2-ref-clear-btn:hover { background: rgba(255,255,255,0.15); color: #fff; }
.gv2-ref-lock-btn.locked { color: #ffd700; }

.gv2-ref-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 100%;
  height: 100%;
  user-select: none;
}
.gv2-ref-empty .gv2-ref-lbl { color: rgba(255,255,255,0.22); }
.gv2-ref-add {
  font-size: 1.3rem;
  line-height: 1;
  color: rgba(255,255,255,0.12);
  font-weight: 300;
  transition: color 0.15s;
}
.gv2-ref-half:hover .gv2-ref-empty .gv2-ref-add { color: rgba(255,255,255,0.5); }
.gv2-ref-half:hover .gv2-ref-empty .gv2-ref-lbl { color: rgba(255,255,255,0.55); }

/* â”€â”€ "Other" dropdown in gallery tray â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.gv2-other-dropdown {
  position: absolute;
  top: calc(100% + 7px);
  right: 0;
  background: rgba(18,18,26,0.97);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 9px;
  padding: 5px 0;
  min-width: 168px;
  z-index: 10000;
  box-shadow: 0 10px 36px rgba(0,0,0,0.75);
  backdrop-filter: blur(24px);
}

.gv2-other-opt {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  color: rgba(255,255,255,0.82);
  font-size: 0.82rem;
  padding: 8px 15px;
  cursor: pointer;
  transition: background 0.12s;
  white-space: nowrap;
}
.gv2-other-opt:hover { background: rgba(255,255,255,0.08); color: #fff; }
.gv2-other-opt:disabled { opacity: 0.32; cursor: not-allowed; }
.gv2-other-opt:disabled:hover { background: none; }

/* â”€â”€ Ref Card: view + replace buttons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.gv2-ref-view-btn,
.gv2-ref-repl-btn {
  background: rgba(0,0,0,0.5);
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.7rem;
  padding: 1px 4px;
  line-height: 1.4;
  color: rgba(255,255,255,0.7);
  transition: background 0.1s, color 0.1s;
}
.gv2-ref-view-btn:hover { background: rgba(59,130,246,0.5); color: #fff; }
.gv2-ref-repl-btn:hover { background: rgba(255,255,255,0.15); color: #fff; }

.gv2-ref-broken { cursor: pointer; }

/* â”€â”€ Ref Card Fullscreen Lightbox â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
#gv2-ref-lightbox {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0,0,0,0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: gv2-rlb-fadein 0.15s ease;
}
@keyframes gv2-rlb-fadein {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.gv2-rlb-inner {
  display: flex;
  flex-direction: column;
  max-width: 95vw;
  max-height: 95vh;
  background: rgba(15,15,20,0.98);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(0,0,0,0.9);
}

.gv2-rlb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}

.gv2-rlb-label {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: rgba(255,255,255,0.6);
  text-transform: uppercase;
}

.gv2-rlb-close {
  background: rgba(248,113,113,0.15);
  border: 1px solid rgba(248,113,113,0.3);
  border-radius: 5px;
  color: #f87171;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 3px 8px;
  line-height: 1.4;
  transition: background 0.12s;
}
.gv2-rlb-close:hover { background: rgba(248,113,113,0.35); }

.gv2-rlb-body {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  min-height: 0;
}

.gv2-rlb-img {
  max-width: 100%;
  max-height: calc(95vh - 60px);
  object-fit: contain;
  border-radius: 4px;
  display: block;
}

/* ── PDF Active Document Workspace Bar (Bubbles) ── */
.gv2-pdf-workspace-bar {
  position: absolute;
  top: 60px; /* Floating below the main tray */
  left: 50%;
  transform: translateX(-50%);
  z-index: 3000;
  display: flex;
  gap: 8px;
  padding: 8px 14px;
  background: rgba(15, 17, 26, 0.45);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 40px;
  max-width: 85%;
  overflow-x: auto;
  scrollbar-width: none;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  animation: gv2-bubble-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: auto; /* Ensure interaction works */
}

@keyframes gv2-bubble-slide-in {
  from { opacity: 0; transform: translate(-50%, -10px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

.gv2-pdf-workspace-bar::-webkit-scrollbar { display: none; }

.gv2-pdf-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

.gv2-pdf-chip:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.gv2-pdf-chip.active {
  background: rgba(139, 92, 246, 0.15);
  border-color: rgba(139, 92, 246, 0.6);
  color: #c084fc;
  box-shadow: 0 0 20px rgba(139, 92, 246, 0.2);
}

.gv2-pdf-chip-icon {
  font-size: 0.9rem;
  filter: drop-shadow(0 0 4px rgba(0,0,0,0.5));
}

.gv2-pdf-chip-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 4px;
  border-radius: 50%;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  transition: all 0.2s;
}

.gv2-pdf-chip-close:hover {
  background: rgba(248, 81, 73, 0.2);
  color: #f85149;
  transform: scale(1.1);
}


```

## File: `static/css/style-gallery-split.css`
```css
/* ── Gallery Split View — style-gallery-split.css ──────────────────────── */

/* Container: fills the same space as gallery-zoom-layer */
#gv2-split-container {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  z-index: 1;
}

/* Each panel */
.gv2-split-panel {
  position: relative;
  flex: 1;
  overflow: hidden;
  background: #0a0a0f;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  min-width: 0;
}
.gv2-split-panel:active { cursor: grabbing; }

/* Inner layer — receives CSS transform (zoom/pan).
   transform-origin: 0 0 so that tx/ty offsets in JS are predictable */
.gv2-split-inner {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  transform-origin: 0 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  /* Simplified: Positioning is now handled 100% by JS via _fitPanel */
}

/* The image inside each panel */
.gv2-split-img {
  display: block;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  image-rendering: -webkit-optimize-contrast;
  image-rendering: high-quality;
  transform-origin: 0 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  /* Removal of object-fit and max-width lets the scale property 
     directly handle the image's fidelity on iPad Safari */
}

/* Empty state (left panel before anything is pinned) */
.gv2-split-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: rgba(255,255,255,0.2);
  pointer-events: none;
  user-select: none;
  padding: 24px;
  text-align: center;
}
.gv2-split-empty-icon { font-size: 2rem; opacity: 0.4; }
.gv2-split-empty-txt  { font-size: 0.78rem; line-height: 1.5; max-width: 180px; }

/* Draggable divider */
.gv2-split-divider {
  width: 5px;
  flex-shrink: 0;
  background: rgba(255,255,255,0.08);
  cursor: col-resize;
  transition: background 0.15s;
  position: relative;
  z-index: 10;
  /* Support touch better with a wider invisible hit area */
  touch-action: none;
}
.gv2-split-divider::before {
  content: '';
  position: absolute;
  top: 0; bottom: 0;
  left: -15px; /* expand hit area 15px to the left */
  right: -15px; /* expand hit area 15px to the right */
  z-index: 1;
}
.gv2-split-divider:hover,
.gv2-split-divider:active { background: rgba(99,102,241,0.6); }
.gv2-split-divider::after {
  content: '';
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: 3px; height: 40px;
  border-radius: 2px;
  background: rgba(255,255,255,0.2);
  z-index: 2; /* make sure visual handle is above hit area if needed */
}

/* HUD overlay (label + buttons, shown bottom-left) */
.gv2-split-hud {
  position: absolute;
  bottom: 10px;
  left: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 20;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
}
.gv2-split-panel:hover .gv2-split-hud { opacity: 1; pointer-events: auto; }

.gv2-split-lbl {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  background: rgba(0,0,0,0.5);
  padding: 2px 6px;
  border-radius: 4px;
  backdrop-filter: blur(6px);
}

.gv2-split-hud-btns {
  display: flex;
  gap: 3px;
}

.gv2-split-hud-btn {
  background: rgba(0,0,0,0.55);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 5px;
  color: rgba(255,255,255,0.65);
  cursor: pointer;
  font-size: 0.78rem;
  padding: 3px 7px;
  line-height: 1.4;
  transition: background 0.12s, color 0.12s;
  backdrop-filter: blur(6px);
}
.gv2-split-hud-btn:hover { background: rgba(255,255,255,0.15); color: #fff; }
.gv2-split-pin-btn:hover { background: rgba(250,204,21,0.25); color: #fde68a; border-color: rgba(250,204,21,0.5); }

/* Split panel nav arrows (right panel only) */
.gv2-split-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0,0,0,0.45);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 50%;
  color: rgba(255,255,255,0.6);
  width: 34px; height: 34px;
  font-size: 1rem;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  z-index: 20;
  opacity: 0;
  transition: opacity 0.2s, background 0.12s;
  backdrop-filter: blur(6px);
}
.gv2-split-panel:hover .gv2-split-nav { opacity: 1; }
.gv2-split-nav:hover { background: rgba(255,255,255,0.15); color: #fff; }
.gv2-split-nav-prev { left: 8px; }
.gv2-split-nav-next { right: 8px; }

```
