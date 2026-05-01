# HTML - Gallery Templates
Consolidated code context for AI assistants.


## File: `templates/gallery.html`
```html
<!-- ── IMAGE GALLERY V2 ──────────────────────────────────── -->
<div class="modal-overlay gv2-modal" id="gallery-modal">

  <!-- ① Grid Ribbon — 5 columns -->
  <div class="gv2-tray">

    <!-- Col 1: Hamburger — toggles left panel (not centered, left-aligned) -->
    <div class="gv2-tc1">
      <button class="gv2-hamburger-btn" id="gv2-hamburger-btn" title="Toggle Thumbnails / Filter Tags">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="16" height="16"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/></svg>
      </button>
      <!-- kept in DOM for JS compatibility -->
      <button class="gv2-tray-back-btn" id="gallery-close" style="display:none" title="Close (Esc)">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M10 3L5 8l5 5"/></svg>
      </button>
    </div>

    <!-- Col 2: Date pill + image counter — fixed width, single line, centered -->
    <div class="gv2-tc2">
      <div class="gv2-date-nav-pill">
        <button class="gv2-date-nav-btn" id="gallery-date-prev" title="Previous Date (&#8592;)">&#8249;</button>
        <div class="gv2-date-display" id="gv2-date-display-trigger">
          <span id="gallery-date"></span>
          <input type="hidden" id="gallery-date-picker" />
        </div>
        <button class="gv2-date-nav-btn" id="gallery-date-next" title="Next Date (&#8594;)">&#8250;</button>
      </div>
      <span class="gv2-tc2-dot">&#183;</span>
      <span class="gv2-tray-counter" id="gv2-tray-counter"></span>
    </div>

    <!-- Col 3: Trade Pills — flex-grow, centered (id kept for JS drag handle) -->
    <div class="gv2-tc3" id="gv2-tray-center">
      <!-- Day P&L pill (total) -->
      <div class="gv2-pnl-wrap" id="gv2-pnl-wrap" style="display:none;position:relative;">
        <button class="gv2-pnl-pill" id="gv2-pnl-pill">0</button>
        <div class="gv2-pnl-dropdown dropdown-menu" id="gv2-pnl-dropdown"></div>
      </div>
      <!-- Trade pill (current image's trade) -->
      <div class="gv2-trade-pill-wrap" id="gv2-trade-pill-wrap" style="display:none;position:relative;">
        <button class="gv2-trade-pill" id="gv2-trade-pill"></button>
        <div class="gv2-pnl-dropdown dropdown-menu" id="gv2-trade-dropdown"></div>
      </div>
      <!-- Grid Size Slider (shown only when Grid View is open) -->
      <div class="gv2-grid-size-ctrl gv2-grid-only" id="gv2-tray-size-ctrl" style="display:none">
        <span class="gv2-grid-sz-icon">SIZE</span>
        <input type="range" id="gv2-grid-size-slider-tray" min="80" max="1200" value="280" title="Adjust thumbnail size" />
      </div>
    </div>

    <!-- Col 4: Icon buttons — centered -->
    <div class="gv2-tc4">
      <div class="gv2-target-btn-wrap" id="gv2-target-btn-wrap" style="position:relative;">
        <button class="gv2-target-pill" id="gv2-target-pill" title="Open Target Tracker" style="background:rgba(255,255,255,0.05); border-color:rgba(255,255,255,0.1);">&#127919;</button>
      </div>
      <div class="gv2-target-btn-wrap" id="gv2-mtm-btn-wrap" style="position:relative;">
        <button class="gv2-target-pill" id="gv2-mtm-btn" title="Show Day Equity Curve" style="background:rgba(192,132,252,0.15); border-color:rgba(192,132,252,0.4); color:#c084fc;">&#128200;</button>
        <div id="gv2-mtm-panel" style="display:none; position:fixed; width:600px; height:400px; padding:20px; border-radius:12px; overflow:hidden; z-index:9999; background:rgba(15,15,20,0.97); border:1px solid rgba(255,255,255,0.12); box-shadow:0 20px 60px rgba(0,0,0,0.8); backdrop-filter:blur(20px);"></div>
      </div>
      <div class="gv2-target-btn-wrap" id="gv2-img-manager-btn-wrap" style="position:relative;">
        <button class="gv2-target-pill" id="gv2-img-manager-btn" title="Open Image Manager" style="background:rgba(59,130,246,0.15); border-color:rgba(59,130,246,0.4); color:#60a5fa;">📊</button>
      </div>
      <div class="gv2-target-btn-wrap" id="gv2-pdf-library-btn-wrap" style="position:relative;">
        <button class="gv2-target-pill" id="gv2-pdf-library-btn" title="Open PDF Library" style="background:rgba(192,132,252,0.15); border-color:rgba(192,132,252,0.4); color:#c084fc;">📄</button>
      </div>
      <!-- Tag Pin Options Dropdown -->
      <div class="gv2-target-btn-wrap" style="position:relative;">
        <button class="gv2-target-pill" id="tag-pin-options-btn" title="Pin Options" style="background:rgba(255,255,255,0.05); border-color:rgba(255,255,255,0.1); font-size:0.9rem;">📍</button>
        <div class="gv2-pnl-dropdown dropdown-menu" id="tag-pin-options-list" style="position:absolute; top:calc(100% + 8px); right:0; width:220px; padding:6px; background:rgba(30,35,48,0.98); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.12);">
          <div class="gv2-dp-item" id="tag-pin-vis-toggle" style="display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:6px; cursor:pointer; color:var(--text2);">
             <span id="pin-vis-indicator" style="width:8px;height:8px;border-radius:50%;background:#444;"></span>
             <span style="flex:1">Show Pins</span>
             <span style="font-size:0.8rem; opacity:0.5;">👁️</span>
          </div>
          <div class="gv2-dp-item" id="tag-pin-del-toggle" style="display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:6px; cursor:pointer; color:var(--text2);">
             <span id="pin-del-indicator" style="width:8px;height:8px;border-radius:50%;background:#444;"></span>
             <span style="flex:1">Delete Mode</span>
             <span style="font-size:0.8rem; opacity:0.5;">🗑️</span>
          </div>
          <div class="gv2-dp-item" id="tag-pin-notes-toggle" style="display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:6px; cursor:pointer; color:var(--text2);">
             <span id="pin-notes-indicator" style="width:8px;height:8px;border-radius:50%;background:#444;"></span>
             <span style="flex:1">Always Visible Notes</span>
             <span style="font-size:0.8rem; opacity:0.5;">📝</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Col 5: Settings + Close — right-aligned -->
    <div class="gv2-tc5">
      <button class="gv2-target-pill" id="gv2-other-btn" title="Gallery Settings" style="background:rgba(255,255,255,0.05); border-color:rgba(255,255,255,0.1); font-size:0.95rem;">&#9881;</button>
      <button class="gv2-grid-close-btn gv2-grid-only" id="gv2-grid-close-btn-tray" title="Close Grid View (G)" style="display:none;">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M12 4L4 12M4 4l8 8"/></svg>
      </button>
      <button class="gv2-tray-close-btn" id="gv2-exit-btn" title="Close Gallery (Esc)">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M12 4L4 12M4 4l8 8"/></svg>
      </button>
      <button class="gv2-profile-menu-btn" id="gv2-profile-btn" title="Menu">
        <img src="/static/img/logo.png" alt="menu" />
      </button>
    </div>

  </div>

  <!-- ② Body -->
  <div class="gv2-body">

    <!-- Active Document Workspace Bar (Bubble Bar) -->
    <div id="gv2-pdf-workspace-bar" class="gv2-pdf-workspace-bar" style="display:none;"></div>

    <!-- Annotation Bar (floating, absolute positioned) -->
    <div class="gv2-annot-bar" id="gv2-annot-bar" style="display:none">
      <button class="annot-tool active gv2-ab-btn" id="annot-pen" title="Pen (freehand)">&#9998;</button>
      <button class="annot-tool gv2-ab-btn" id="annot-highlight" title="Highlighter">&#9670;</button>
      <button class="annot-tool gv2-ab-btn" id="gv2-text-btn" title="Text tool">T</button>
      <button class="annot-tool gv2-ab-btn" id="annot-eraser" title="Eraser">&#9003;</button>
      <div class="annot-shape-group" id="annot-shape-group">
        <button class="annot-tool gv2-ab-btn" id="annot-shape" title="Shape (right-click: switch shape)" data-shape="rect">&#9645;</button>
        <div class="annot-shape-menu" id="annot-shape-menu">
          <button class="annot-shape-opt" data-tool="arrow">&#8599; Arrow</button>
          <button class="annot-shape-opt" data-tool="rect">&#9645; Rect</button>
          <button class="annot-shape-opt" data-tool="circle">&#11096; Circle</button>
        </div>
      </div>
      <button class="annot-tool gv2-ab-btn" id="annot-select" title="Select / Move">&#9654;</button>
      <div class="gv2-ab-sep"></div>
      <input type="color" id="annot-color" class="annot-color-input gv2-ab-color" value="#f85149" title="Color" />
      <input type="range" id="annot-size" min="1" max="30" value="3" class="annot-range gv2-ab-range" title="Size" />
      <span id="annot-size-label" class="annot-size-label gv2-ab-size-lbl">3</span>
      <div class="gv2-ab-sep"></div>
      <button class="annot-tool gv2-ab-btn" id="annot-undo" title="Undo (Ctrl+Z)">&#8617;</button>
      <button class="annot-tool gv2-ab-btn" id="annot-redo" title="Redo (Ctrl+Y)">&#8618;</button>
      <button class="annot-tool gv2-ab-btn" id="annot-clear" title="Clear all">&#10005;</button>
      <div class="gv2-ab-sep"></div>
      <button class="gv2-ab-btn gv2-ab-save" id="annot-save-overlay" title="Save as overlay">&#128190;</button>
      <button class="gv2-ab-btn gv2-ab-merge" id="annot-save-merge" title="Merge &amp; Save">&#8681;</button>
    </div>

    <!-- Layer Panel (flex child, shown/hidden) -->
    <div class="gv2-layer-panel" id="gv2-layer-panel" style="display:none">
      <div class="gv2-lp-header">
        <span>Layers</span>
        <div style="display:flex;gap:3px;align-items:center;">
          <button class="gv2-lp-sel-btn" id="gv2-lp-sel-all" title="Select All">&#9745;</button>
          <button class="gv2-lp-sel-btn" id="gv2-lp-sel-none" title="Deselect All">&#9746;</button>
          <button class="gv2-lp-sel-btn" id="gv2-lp-sel-inv" title="Invert Selection">&#8645;</button>
          <button class="gv2-lp-close" id="gv2-lp-close-btn" title="Close">&#10005;</button>
        </div>
      </div>
      <div class="gv2-lp-body" id="gv2-layer-list"></div>
      <div class="gv2-lp-resize-handle" id="gv2-lp-resize-handle" title="Drag to resize"></div>
    </div>

    <!-- Trades Panel -->
    <div class="gv2-layer-panel" id="gv2-trades-panel" style="display:none; width: 340px;">
      <div class="gv2-lp-header">
        <span>All Trades</span>
        <div style="display:flex;gap:3px;align-items:center;">
          <div class="gv2-sort-container" style="display:flex; gap:4px; align-items:center;">
            <select id="gv2-trades-filter-type" class="gv2-sort-select" title="Filter by PnL status">
              <option value="both">Both</option>
              <option value="gain">Gain</option>
              <option value="loss">Loss</option>
            </select>
            <select id="gv2-trades-sort-field" class="gv2-sort-select" title="Sort by">
              <option value="date">Date</option>
              <option value="pt">Pt</option>
              <option value="duration">Duration</option>
              <option value="pnl">Amount</option>
              <option value="lots">Lots</option>
            </select>
            <button class="gv2-lp-sel-btn" id="gv2-trades-sort-order-btn" title="Switch High/Low" style="padding: 2px 6px; font-size: 0.75rem; min-width: 44px;"></button>
          </div>
          <button class="gv2-lp-close" id="gv2-trades-close-btn" title="Close">&#10005;</button>
        </div>
      </div>
      <div class="gv2-lp-body" id="gv2-trades-list" style="overflow-y:auto; padding:8px; display:flex; flex-direction:column; gap:6px; flex:1; background: var(--surface);"></div>
      <div class="gv2-lp-resize-handle" id="gv2-trades-resize-handle" title="Drag to resize"></div>
    </div>

    <!-- Unified Left Panel Wrapper (for resize handle outside scrolling area) -->
    <div class="gv2-ulp-wrapper" style="position: relative; display: flex; flex-shrink: 0;">
      <!-- Unified Left Panel (Thumbnails + Filter Tags) -->
      <div class="gv2-unified-left-panel" id="gv2-unified-left-panel" style="display:none;">
        <div class="gv2-ulp-tabs">
          <button class="gv2-ulp-tab active" id="gv2-tab-thumbs" data-tab="thumbs">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>
            Thumbnails
          </button>
          <button class="gv2-ulp-tab" id="gv2-tab-filter" data-tab="filter">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="10" height="10"><path d="M2.5 3h11l-4.5 5.5v5l-2-2v-3L2.5 3z"/></svg>
            Filter Tags
          </button>

          <div style="flex:1"></div>
          <button class="gv2-ulp-close" id="gv2-ulp-close-btn" title="Close Panel">&#10005;</button>
        </div>

        <div class="gv2-ulp-content">
          <!-- Pane: Thumbnails -->
          <div class="gv2-ulp-pane active" id="gv2-pane-thumbs">
            <div class="gv2-ulp-pane-header">
              <button class="gv2-ulp-ctrl-btn" id="gv2-ulp-expand-all" title="Expand All Groups">Exp</button>
              <button class="gv2-ulp-ctrl-btn" id="gv2-ulp-collapse-all" title="Collapse All Groups">Col</button>
              <button class="gv2-ulp-ctrl-btn" id="gv2-ulp-add-sep" title="Add Custom Folder / Separator" onclick="addCustomSeparator()" style="margin-left:auto; background:var(--accent-gradient); color:#fff; padding:2px 8px; border:none;">+ Folders</button>
            </div>
            <div class="gv2-thumbs" id="gallery-thumbs"></div>
          </div>

          <!-- Pane: Filter Tags -->
          <div class="gv2-ulp-pane" id="gv2-pane-filter" style="display:none;">
            <div id="gallery-img-tag-filter-header" style="background:var(--bg2); border-bottom:1px solid var(--border);"></div>
            <div class="gv2-lp-body" id="gallery-img-tag-filter-panel" style="overflow-y:auto; padding:0; display:flex; flex-direction:column; flex:1; min-height:0;"></div>
          </div>
        </div>
      </div>
      
      <!-- Resize handle outside the panel container -->
      <div class="gv2-tp-resize-handle" id="gv2-ulp-resize-handle" title="Drag to resize"></div>
    </div>


    <!-- Center column: image + tag cloud -->
    <div class="gv2-center">

      <!-- Main image area -->
      <div class="gv2-img-area" id="gallery-img-wrapper">
        <button class="gv2-nav-btn" id="gallery-prev">&#10094;</button>

        <!-- ── Split View Container (shown when split mode ON) ── -->
        <div id="gv2-split-container" style="display:none;">

          <!-- Left panel -->
          <div class="gv2-split-panel" id="gv2-split-left">
            <div class="gv2-split-inner" id="gv2-split-left-inner">
              <img id="gv2-split-left-img" class="gv2-split-img" style="display:none;" draggable="false" alt="Left panel">
              <div class="gv2-split-empty" id="gv2-split-left-empty">
                <span class="gv2-split-empty-icon">📌</span>
                <span class="gv2-split-empty-txt">Click <b>📌</b> on right panel to pin image here</span>
              </div>
            </div>
            <div class="gv2-split-hud">
              <span class="gv2-split-lbl">INDEX / CONTEXT</span>
              <div class="gv2-split-hud-btns">
                <button class="gv2-split-hud-btn" id="gv2-split-left-reset" title="Reset zoom (double-click also works)">⊙</button>
              </div>
            </div>
            <!-- Left panel nav arrows -->
            <button class="gv2-split-nav gv2-split-nav-prev" id="gv2-split-left-nav-prev" title="Previous index image">&#10094;</button>
            <button class="gv2-split-nav gv2-split-nav-next" id="gv2-split-left-nav-next" title="Next index image">&#10095;</button>
          </div>

          <!-- Draggable divider -->
          <div class="gv2-split-divider" id="gv2-split-divider" title="Drag to resize panels"></div>

          <!-- Right panel -->
          <div class="gv2-split-panel" id="gv2-split-right">
            <div class="gv2-split-inner" id="gv2-split-right-inner">
              <img id="gv2-split-right-img" class="gv2-split-img" draggable="false" alt="Right panel">
            </div>
            <div class="gv2-split-hud">
              <span class="gv2-split-lbl">TRADE</span>
              <div class="gv2-split-hud-btns">
                <button class="gv2-split-hud-btn gv2-split-pin-btn" id="gv2-split-pin-btn" title="Pin this image to left panel">📌</button>
                <button class="gv2-split-hud-btn" id="gv2-split-right-reset" title="Reset zoom (double-click also works)">⊙</button>
              </div>
            </div>
            <!-- Right panel nav arrows (work independently) -->
            <button class="gv2-split-nav gv2-split-nav-prev" id="gv2-split-nav-prev" title="Previous image (←)">&#10094;</button>
            <button class="gv2-split-nav gv2-split-nav-next" id="gv2-split-nav-next" title="Next image (→)">&#10095;</button>
          </div>

        </div>
        <!-- ── End Split View Container ── -->

        <div id="gallery-zoom-layer">
          <img class="gallery-img" id="gallery-img" src="" alt="Trade image" draggable="false" />
          <video id="gallery-video" class="gallery-img" controls preload="metadata" style="display:none; width:100%; height:100%; object-fit:contain;" onloadedmetadata="this.currentTime=0.1"></video>
          <canvas id="pdf-main-canvas" class="gallery-img" style="display:none; background:#fff;"></canvas>
          <canvas id="annot-canvas" class="annot-canvas" style="display:none"></canvas>
        </div>
        <button class="gv2-nav-btn gv2-nav-right" id="gallery-next">&#10095;</button>
        <div class="gv2-img-counter" id="gallery-counter"></div>
        <div class="gv2-img-tags" id="gallery-image-tags"></div>

        <!-- Trade Info Overlay -->
        <div id="gallery-trade-info-display"
          style="position:absolute; top:12px; right:42px; z-index:40; background:rgba(30,35,48,0.85); border:1px solid var(--border); padding:6px 12px; border-radius:6px; color:var(--text); font-size:0.95rem; font-weight:bold; pointer-events:none; display:none; box-shadow:0 10px 40px rgba(0,0,0,0.5);">
        </div>

        <!-- Filter-Active Bar (Visual Clue) -->
        <div id="gallery-filter-active-bar"
          style="display:none; position:absolute; top:130px; left:50%; transform:translateX(-50%); z-index:1000; background:var(--orange, #ffd700); color:#000; padding:4px 16px; border-radius:30px; font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:1px; box-shadow:0 4px 20px rgba(0,0,0,0.6); pointer-events:none; align-items:center; gap:8px; border:2px solid #000;">
        </div>

        <!-- Filter-Active Count -->
        <div id="gallery-filter-count-bar"
          style="display:none; position:absolute; top:165px; left:50%; transform:translateX(-50%); z-index:1000; background:rgba(0,0,0,0.8); color:#fff; padding:4px 14px; border-radius:14px; font-size:0.75rem; font-weight:700; pointer-events:none; backdrop-filter:blur(6px); border:1px solid rgba(255,255,255,0.2); box-shadow:0 5px 15px rgba(0,0,0,0.6); white-space:nowrap;">
          Showing <span id="gallery-filter-count-text">0</span> Images
        </div>

        <!-- Text Bar -->
        <div class="gv2-text-bar" id="gv2-text-bar" style="display:none">
          <input type="color" id="gv2-tb-color" class="gv2-ab-color" value="#000000" title="Text Color" />
          <input type="number" id="gv2-tb-size" class="gv2-tb-size" value="24" min="8" max="144" title="Font size" />
          <select id="gv2-tb-font" class="gv2-ab-btn" title="Font family"
            style="width:80px;padding:0 4px;appearance:auto;background:var(--bg);border:1px solid var(--border);">
            <option value="Arial" selected>Arial</option>
            <option value="Courier New">Courier</option>
            <option value="Times New Roman">Times</option>
            <option value="Impact">Impact</option>
          </select>
          <button id="gv2-tb-bold" class="gv2-ab-btn" title="Bold"><b>B</b></button>
          <button id="gv2-tb-italic" class="gv2-ab-btn" title="Italic"><i>I</i></button>
          <button id="gv2-tb-list" class="gv2-ab-btn" style="font-size:0.75rem" title="Bullets / Numbering">&#9776;</button>
          <button id="gv2-tb-align" class="gv2-ab-btn" title="Alignment">&#8801;</button>
        </div>

        <!-- Marquee Bar -->
        <div class="gv2-marquee-bar" id="gv2-marquee-bar" style="display:none">
          <input type="text" id="gv2-mq-tag-input" class="gv2-mq-input" list="gv2-mq-tag-suggestions"
            placeholder="Tag for selected box..." />
          <datalist id="gv2-mq-tag-suggestions"></datalist>
          <button id="gv2-mq-add" class="gv2-ab-btn" title="Add tag to selected marquee">+ Tag</button>
          <button class="gv2-ab-btn annot-tool" id="annot-vselect" title="Group Select (V)">V</button>
          <button id="gv2-mq-rebind" class="gv2-ab-btn" title="Remove frozen legacy overlay and keep editable marquee">Rebind</button>
          <button id="gv2-mq-del" class="gv2-ab-btn" title="Close marquee tool">&#10005;</button>
        </div>

      </div>

      <!-- Heads Display (stats bar — below image) -->
      <div id="gallery-heads-display" class="gallery-heads-display"></div>

      <!-- Tag Cloud (bottom filter section — removed per user request) -->
      <div class="gv2-tag-cloud" id="gv2-tag-cloud" style="display:none"></div>

    </div><!-- /gv2-center -->

    {% include "gallery-sidebar.html" %}

  </div><!-- /gv2-body -->
</div><!-- /gallery-modal -->

<!-- 📁 Backup Progress Modal (requested by user for % slider) -->
<div id="backup-progress-modal" style="display:none; position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px); flex-direction:column; align-items:center; justify-content:center;">
    <div style="width:400px; padding:30px; background:#1e2330; border-radius:16px; border:1px solid rgba(255,255,255,0.12); box-shadow:0 30px 100px rgba(0,0,0,0.9); text-align:center;">
        <div style="font-size:1.5rem; margin-bottom:20px;">📦 System Backup</div>
        <div id="backup-progress-text" style="color:var(--text2); font-size:0.9rem; margin-bottom:12px;">Initializing secure bundle...</div>
        
        <div style="width:100%; height:8px; background:rgba(255,255,255,0.05); border-radius:10px; overflow:hidden; margin-bottom:10px;">
           <div id="backup-progress-fill" style="width:2%; height:100%; background:linear-gradient(90deg, #3b82f6, #4ade80); transition:width 0.3s ease;"></div>
        </div>
        
        <div id="backup-progress-percent" style="font-size:1.4rem; font-weight:800; color:#fff; display:block; margin-bottom:5px;">2%</div>
        <div style="color:var(--text2); font-size:0.75rem; opacity:0.6;">Aapka sara data mahfooz kiya ja raha hai... ✨</div>
    </div>
</div>

<!-- 📥 Restore Progress Modal -->
<div id="restore-progress-modal" style="display:none; position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px); flex-direction:column; align-items:center; justify-content:center;">
    <div style="width:400px; padding:30px; background:#1e2330; border-radius:16px; border:1px solid rgba(255,255,255,0.12); box-shadow:0 30px 100px rgba(0,0,0,0.9); text-align:center;">
        <div style="font-size:1.5rem; margin-bottom:20px;">📥 Restoring Backup</div>
        <div id="restore-progress-text" style="color:var(--text2); font-size:0.9rem; margin-bottom:12px;">Extracting archives...</div>
        
        <div style="width:100%; height:8px; background:rgba(255,255,255,0.05); border-radius:10px; overflow:hidden; margin-bottom:10px;">
           <div id="restore-progress-fill" style="width:2%; height:100%; background:linear-gradient(90deg, #fbbf24, #ef4444); transition:width 0.3s ease;"></div>
        </div>
        
        <div id="restore-progress-percent" style="font-size:1.4rem; font-weight:800; color:#fff; display:block; margin-bottom:5px;">2%</div>
        <div style="color:var(--text2); font-size:0.75rem; opacity:0.6;">Aapka sara data wapas laya ja raha hai... ✨</div>
    </div>
</div>

<!-- ── Gallery Settings Modal ──────────────────────────────────────── -->
<div class="gv2-settings-overlay" id="gv2-settings-overlay">
  <div class="gv2-settings-panel">
    <div class="gv2-settings-header">
      <span class="gv2-settings-title">⚙ Gallery Settings</span>
      <button class="gv2-settings-close" id="gv2-settings-close">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M12 4L4 12M4 4l8 8"/></svg>
      </button>
    </div>

    <!-- View Options -->
    <div class="gv2-settings-section-label">View</div>
    <div class="gv2-settings-row" id="gv2-refcards-toggle">
      <span class="gv2-settings-row-icon">📋</span>
      <span class="gv2-settings-row-label">Ref Cards</span>
      <span class="gv2-settings-row-badge" id="gv2-refcards-badge">ON</span>
    </div>
    <div class="gv2-settings-row" id="gv2-tradesidebar-toggle">
      <span class="gv2-settings-row-icon">🖼</span>
      <span class="gv2-settings-row-label">Trade Sidebar</span>
      <span class="gv2-settings-row-badge" id="gv2-tradesidebar-badge">OFF</span>
    </div>

    <!-- Appearance -->
    <div class="gv2-settings-section-label">Appearance</div>
    <div class="gv2-settings-row" style="cursor:default; display: flex; flex-direction: column; gap: 8px; padding: 12px 15px;">
      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
        <div style="display: flex; align-items: center;">
          <span class="gv2-settings-row-icon">Aa</span>
          <span class="gv2-settings-row-label">Pill Font Size</span>
        </div>
        <span id="gv2-pill-font-size-val" style="font-size: 0.8rem; font-weight: 800; color: var(--blue);">0.82rem</span>
      </div>
      <input type="range" id="gv2-pill-font-size" min="0.5" max="1.5" step="0.01" value="0.82" 
             style="width: 100%; cursor: pointer; accent-color: var(--blue);">
    </div>

    <!-- Export -->
    <div class="gv2-settings-section-label">Export</div>
    <div class="gv2-settings-row" id="gv2-export-current-pdf-btn">
      <span class="gv2-settings-row-icon">📄</span>
      <span class="gv2-settings-row-label">Export Current View</span>
    </div>
    <div class="gv2-settings-row" id="gv2-export-refpdf-btn">
      <span class="gv2-settings-row-icon">📄</span>
      <span class="gv2-settings-row-label">Export PDF Summary</span>
    </div>
    <div class="gv2-settings-row" id="gv2-full-backup-btn" style="background:rgba(34,197,94,0.15); border-color:rgba(34,197,94,0.4);">
      <span class="gv2-settings-row-icon">📦</span>
      <span class="gv2-settings-row-label" style="color:#4ade80; font-weight:700;">Full Backup (.ZIP)</span>
      <span style="font-size:0.65rem; color:#4ade80; opacity:0.8; margin-left:auto;">Data + Images</span>
    </div>
    <div class="gv2-settings-row" id="gv2-restore-backup-btn" style="background:rgba(245,158,11,0.15); border-color:rgba(245,158,11,0.4); margin-bottom:15px;">
      <span class="gv2-settings-row-icon">📤</span>
      <span class="gv2-settings-row-label" style="color:#fbbf24; font-weight:700;">Restore Backup (.ZIP / .JSON)</span>
    </div>

    <!-- Action Button -->
    <button class="btn btn-blue" id="gv2-settings-save-btn" style="width:100%; padding:10px; font-weight:700; margin-top:5px; border-radius:8px;">
      SAVE SETTINGS
    </button>
  </div>
</div>

{% include 'gallery-modals.html' %}
{% include 'gallery-modals-b.html' %}

```

## File: `templates/gallery-modals.html`
```html
<!-- ── IMAGE UPLOAD MODAL ───────────────────── -->
<div class="modal-overlay" id="upload-modal">
  <div class="modal-content upload-modal-content">
    <div class="modal-header">
      <span id="upload-modal-title">Upload Images</span>
      <button class="close-btn" id="upload-close">&#10005;</button>
    </div>
    <div class="upload-drop-zone" id="upload-drop-zone">
      <div class="drop-icon">&#128247;</div>
      <p>Drop images here or <span class="upload-label" id="upload-browse-label">browse</span></p>
      <p class="upload-paste-hint">&#128203; Ctrl+V to paste an image from clipboard</p>
      <input type="file" id="image-file-input" multiple accept="image/*" style="display:none" />
    </div>
    <div class="upload-preview" id="upload-preview"></div>
    <div id="upload-progress" class="upload-progress-container" style="display:none;">
      <div class="upload-progress-header">
        <span id="upload-progress-text">Uploading... 0 / 0 (0%)</span>
      </div>
      <div id="upload-progress-bar-wrap" class="upload-progress-bar-wrap">
        <div id="upload-progress-bar" class="upload-progress-bar"></div>
      </div>
    </div>
    <div class="upload-actions">
      <button class="btn btn-outline" id="upload-cancel-btn">Cancel</button>
      <button class="btn btn-primary" id="upload-done-btn">Done</button>
    </div>
  </div>
</div>

<!-- ── TAG PICKER MODAL ─────────────── -->
<div class="modal-overlay" id="tag-modal">
  <div class="modal-content tag-modal-content">
    <div class="modal-header">
      <span id="tag-modal-title">Tags</span>
      <button class="close-btn" id="tag-picker-close-x">&#10005;</button>
    </div>
    <input type="text" id="tag-picker-inp" class="tag-picker-inp" placeholder="Search or create tag..." />
    <div id="tag-picker-list" class="tag-picker-list"></div>
    <div class="tag-picker-footer">
      <button class="btn btn-outline" id="tag-picker-close-btn"
        style="width:100%;font-size:0.78rem;padding:5px">Done</button>
    </div>
  </div>
</div>

<!-- ── FILTER OPTIONS MODAL ─────────────── -->
<div class="modal-overlay" id="gv2-filter-opts-modal" style="z-index: 5000;">
  <div class="modal-content" style="max-width: 320px; width: 90%;">
    <div class="modal-header">
      <span>Filter Options</span>
      <button class="close-btn" onclick="document.getElementById('gv2-filter-opts-modal').style.display='none'">&#10005;</button>
    </div>
    <div id="gv2-filter-opts-modal-content" style="padding-bottom: 10px;"></div>
  </div>
</div>

<!-- Image Tag Manager Modal -->
<div class="modal-overlay" id="img-tag-modal">
  <div class="modal-content tag-modal-content">
    <div class="modal-header">
      <span>Image Tags</span>
      <button class="close-btn" id="img-tag-close-x">&#10005;</button>
    </div>
    <div style="padding:10px 12px;border-bottom:1px solid var(--border)">
      <div class="panel-manage-label" style="margin-bottom:6px">Current Image</div>
      <div id="img-tag-current-list" class="panel-list" style="max-height:180px"></div>
    </div>
    <div style="padding:10px 12px;border-bottom:1px solid var(--border)">
      <div class="panel-manage-label" style="margin-bottom:6px">Create Tag</div>
      <div style="display:flex;gap:6px">
        <input type="text" id="img-tag-new-name" class="tag-picker-inp" placeholder="New tag name..."
          style="border:1px solid var(--border2);border-radius:6px;padding:7px 9px" />
        <button class="btn btn-primary" id="img-tag-add-btn" style="padding:6px 10px">Add</button>
      </div>
    </div>
    <div style="padding:10px 12px">
      <div class="panel-manage-label" style="margin-bottom:6px">Manage Tags</div>
      <div id="img-tag-manage-list" class="panel-list" style="max-height:190px"></div>
    </div>
    <div class="tag-picker-footer">
      <button class="btn btn-outline" id="img-tag-close-btn"
        style="width:100%;font-size:0.78rem;padding:5px">Done</button>
    </div>
  </div>
</div>

<!-- ── FULLSCREEN VIEWER (INSTAGRAM REELS STYLE) ── -->
<div class="fs-viewer" id="fs-viewer">
  <!-- Header — trading tray style (auto-hide, tap to show) -->
  <div class="fs-header">
    <!-- Back / Close -->
    <button class="fs-back-btn" id="fs-close-btn" title="Close (Esc)">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M10 3L5 8l5 5"/></svg>
    </button>
    <!-- Day P&L pill -->
    <div id="fs-pnl-wrap" style="display:none; position:relative;">
      <button class="gv2-pnl-pill" id="fs-pnl-pill">0</button>
      <div class="gv2-pnl-dropdown" id="fs-pnl-dropdown"></div>
    </div>
    <!-- Trade pill -->
    <div id="fs-trade-wrap" style="display:none; position:relative;">
      <button class="gv2-trade-pill" id="fs-trade-pill"></button>
      <div class="gv2-pnl-dropdown" id="fs-trade-dropdown"></div>
    </div>
    <!-- Date (clickable = date picker) -->
    <div class="fs-date-wrap" style="position:relative; display:flex; flex-direction:column; align-items:flex-start; min-width:180px;">
      <div id="fs-header-instrument" style="font-size:1.15rem; font-weight:800; color:#fff; line-height:1.1; letter-spacing:0.5px; text-transform:uppercase;">NIFTY...</div>
      <div id="fs-header-details" style="font-size:0.75rem; color:rgba(255,255,255,0.6); display:flex; gap:10px; margin-top:3px; font-weight:500;">
         <span id="fs-h-date">Date: —</span>
         <span id="fs-h-qty">Qty: —</span>
         <span id="fs-h-pt">Pt: —</span>
         <span id="fs-h-pnl">P&L: —</span>
      </div>
      <input type="date" id="fs-date-picker" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;z-index:5;" onchange="FullscreenViewer.jumpToDate(this.value)" />
    </div>
    <!-- Spacer -->
    <div style="flex:1"></div>
    <!-- Lock / Focus mode -->
    <div class="fs-lock-btn" id="fs-lock-btn" title="Focus Mode (lock nav)">&#128275;</div>
  </div>

  <!-- Content -->
  <div class="fs-content" id="fs-content">
    <img src="" class="fs-main-img" id="fs-img" alt="Fullscreen content" draggable="false" />
    <div class="fs-dots" id="fs-dots"></div>
    <button class="fs-side-btn fs-side-left" id="fs-lock-prev">&#8592;</button>
    <button class="fs-side-btn fs-side-right" id="fs-lock-next">&#8594;</button>
    <button class="fs-corner-btn fs-corner-bl" id="fs-lock-up">&#8593;</button>
    <button class="fs-corner-btn fs-corner-br" id="fs-lock-down">&#8595;</button>

    <div class="fs-zoom-slider-container" id="fs-zoom-slider-container">
        <input type="range" min="1" max="5" step="0.01" value="1" class="fs-zoom-slider" id="fs-zoom-slider">
        <div class="fs-zoom-label" id="fs-zoom-label">1x</div>
    </div>
  </div>

</div>

<!-- ── Sync All OHLC Panel ──────────────────────────────────────── -->
<div id="gc-sync-panel" style="display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.82);align-items:center;justify-content:center;">
  <div style="background:#131722;border:1px solid #2a2a3e;border-radius:10px;padding:20px;width:min(640px,94vw);display:flex;flex-direction:column;gap:12px;max-height:90vh;">

    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span style="font-weight:700;color:#ccc;font-size:14px;">&#8659; Download All OHLC Charts</span>
      <button onclick="gcCloseSyncPanel()" style="background:none;border:none;color:#aaa;font-size:20px;cursor:pointer;line-height:1;">&#x2715;</button>
    </div>

    <!-- Dhan Credentials (collapsible) -->
    <details id="gc-creds-details" style="border:1px solid #2a2a3e;border-radius:6px;padding:0;">
      <summary style="cursor:pointer;padding:8px 12px;color:#aaa;font-size:0.82rem;user-select:none;list-style:none;display:flex;align-items:center;gap:6px;">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" width="13" height="13"><rect x="3" y="7" width="10" height="8" rx="1"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>
        <span id="gc-creds-summary-label">Dhan API Credentials</span>
      </summary>
      <div style="padding:10px 12px;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <div style="flex:1;min-width:160px;">
            <label style="font-size:0.75rem;color:#888;display:block;margin-bottom:3px;">Client ID</label>
            <input id="gc-dhan-client-id" type="text" placeholder="Your Dhan client ID"
              style="width:100%;background:#0d1017;border:1px solid #2a2a3e;color:#eee;padding:5px 8px;border-radius:4px;font-size:0.82rem;box-sizing:border-box;"/>
          </div>
          <div style="flex:2;min-width:200px;">
            <label style="font-size:0.75rem;color:#888;display:block;margin-bottom:3px;">Access Token</label>
            <input id="gc-dhan-token" type="password" placeholder="Paste access token"
              style="width:100%;background:#0d1017;border:1px solid #2a2a3e;color:#eee;padding:5px 8px;border-radius:4px;font-size:0.82rem;box-sizing:border-box;"/>
          </div>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <button onclick="gcSaveDhanConfig()"
            style="background:#1e4d91;border:1px solid #2962ff;color:#fff;padding:4px 14px;border-radius:4px;cursor:pointer;font-size:0.82rem;">
            Save Credentials
          </button>
          <span id="gc-creds-status" style="font-size:0.78rem;color:#aaa;"></span>
        </div>
      </div>
    </details>

    <!-- Tradebook CSV → one-shot OHLC download -->
    <div style="border:1px solid #2d6a4f;border-radius:6px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;background:rgba(27,67,50,0.18);">
      <div style="display:flex;align-items:center;gap:6px;">
        <svg viewBox="0 0 16 16" fill="none" stroke="#95d5b2" stroke-width="1.6" width="14" height="14"><path d="M8 2v8M5 7l3 3 3-3"/><rect x="2" y="11" width="12" height="3" rx="1"/></svg>
        <span style="color:#95d5b2;font-size:0.82rem;font-weight:600;">One-shot: Import Tradebook &amp; Download All Charts</span>
      </div>
      <p style="color:#888;font-size:0.75rem;margin:0;">
        Upload your Zerodha F&amp;O tradebook CSV — actual expiry dates are read directly, then all OHLC data is downloaded automatically.
      </p>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input id="gc-tradebook-file" type="file" accept=".csv"
          style="font-size:0.78rem;color:#ccc;background:#0d1017;border:1px solid #2a2a3e;border-radius:4px;padding:4px 8px;cursor:pointer;flex:1;min-width:0;"/>
        <button id="gc-tradebook-btn" onclick="gcImportAndSync()"
          style="background:#1b4332;border:1px solid #2d6a4f;color:#95d5b2;padding:5px 14px;border-radius:4px;cursor:pointer;font-size:0.82rem;font-weight:600;white-space:nowrap;">
          &#9654; Import &amp; Sync
        </button>
        <button id="gc-tradebook-stop-btn" onclick="gcStopTradebookSync()" style="display:none;
          background:#ef5350;border:none;color:#fff;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:0.82rem;font-weight:600;white-space:nowrap;">
          &#9632; Stop
        </button>
      </div>
      <span id="gc-tradebook-status" style="font-size:0.78rem;color:#aaa;"></span>
    </div>

    <p style="color:#888;font-size:0.82rem;margin:0;">
      Auto-maps all instruments, then downloads candle data for every trade day.
      Safe to run multiple times — already-cached data is skipped.
    </p>

    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <button id="gc-sync-btn" onclick="gcStartSync()"
        style="background:#2962ff;border:none;color:#fff;padding:6px 16px;border-radius:5px;cursor:pointer;font-size:13px;font-weight:600;">
        &#9654; Start Sync
      </button>
      <button id="gc-sync-stop-btn" onclick="gcStopSync()" style="display:none;
        background:#ef5350;border:none;color:#fff;padding:6px 14px;border-radius:5px;cursor:pointer;font-size:13px;font-weight:600;">
        &#9632; Stop
      </button>
      <span id="gc-sync-status" style="font-size:0.82rem;color:#aaa;flex:1;"></span>
    </div>

    <!-- Scrollable log -->
    <div id="gc-sync-log"
      style="background:#0d1017;border:1px solid #2a2a3e;border-radius:6px;padding:10px;
             height:320px;overflow-y:auto;font-family:monospace;font-size:0.78rem;color:#d1d4dc;
             display:flex;flex-direction:column;gap:1px;">
    </div>

  </div>
</div>

<!-- ── Gallery OHLC Chart Modal ─────────────────────────────────── -->
<div id="gc-chart-modal" style="display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.82);align-items:center;justify-content:center;">
  <div style="background:#131722;border:1px solid #2a2a3e;border-radius:10px;padding:16px;width:min(980px,96vw);max-height:96vh;overflow:hidden;display:flex;flex-direction:column;gap:0;">

    <!-- Row 1: title + Lock Y + TF buttons + close -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:10px;flex-shrink:0;">
      <span id="gc-chart-title" style="font-weight:600;color:#ccc;font-size:13px;font-family:monospace;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
      <label style="color:#888;font-size:11px;white-space:nowrap;cursor:pointer;flex-shrink:0;" title="Lock price-to-bar ratio">
        <input type="checkbox" id="gc-lock-chk" onchange="gc_setLockRatio(this.checked)" style="vertical-align:middle;cursor:pointer;"/>
        Lock Y
        <input id="gc-lock-val" type="number" value="6" step="0.5" min="0.1"
               style="width:44px;background:#1e2130;border:1px solid #2a2a3e;color:#fff;padding:1px 4px;border-radius:3px;font-size:11px;margin-left:2px;"
               onchange="if(document.getElementById('gc-lock-chk').checked) _gc_applyLockRatio()"/>
      </label>
      <div style="display:flex;gap:4px;flex-shrink:0;">
        <button onclick="setGalleryChartTf(1)"  class="gc-tf-btn gc-tf-active" data-tf="1">1m</button>
        <button onclick="setGalleryChartTf(3)"  class="gc-tf-btn" data-tf="3">3m</button>
        <button onclick="setGalleryChartTf(5)"  class="gc-tf-btn" data-tf="5">5m</button>
        <button onclick="setGalleryChartTf(15)" class="gc-tf-btn" data-tf="15">15m</button>
      </div>
      <button onclick="closeGalleryChart()" style="background:none;border:none;color:#aaa;font-size:20px;cursor:pointer;line-height:1;flex-shrink:0;">&#x2715;</button>
    </div>

    <!-- Row 2: SL / Target re-sim bar (shown only when entry price is known) -->
    <div id="gc-sim-bar" style="display:none;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;flex-shrink:0;">
      <span style="color:#888;font-size:12px;">Re-sim:</span>
      <label style="color:#aaa;font-size:12px;">SL <input id="gc-sl-input"  type="number" value="15" step="0.5" style="width:60px;background:#1e2130;border:1px solid #2a2a3e;color:#fff;padding:2px 5px;border-radius:3px;font-size:12px;"/> pts</label>
      <label style="color:#aaa;font-size:12px;">Target <input id="gc-tgt-input" type="number" value="30" step="0.5" style="width:60px;background:#1e2130;border:1px solid #2a2a3e;color:#fff;padding:2px 5px;border-radius:3px;font-size:12px;"/> pts</label>
      <button onclick="gc_reSimChart()" style="background:#1e2130;border:1px solid #2a2a3e;color:#aaa;padding:3px 10px;border-radius:4px;cursor:pointer;font-size:12px;">&#9654; Re-run</button>
    </div>

    <!-- Chart -->
    <div id="gc-chart-container" style="width:100%;flex:1;min-height:400px;"></div>
  </div>
</div>

</style>

<!-- Tag Creation Modal (Centrally defined UI) -->
<div class="gv2-modal-overlay" id="gv2-tag-create-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); align-items:center; justify-content:center; z-index:10001; backdrop-filter:blur(3px);">
  <div class="gv2-modal-content" style="width:340px; padding:20px; border-radius:16px; background:rgba(30,30,35,0.95); border:1px solid rgba(255,255,255,0.1); box-shadow:0 10px 40px rgba(0,0,0,0.8); backdrop-filter:blur(15px); color:#fff; font-family:inherit;">
    <h3 style="margin:0 0 16px; font-size:1.15rem; color:#fff; font-weight:700; letter-spacing:0.5px; text-align:center;">CREATE NEW TAG</h3>
    
    <div style="margin-bottom:14px;">
      <label style="display:block; font-size:0.75rem; color:#999; margin-bottom:5px; text-transform:uppercase; font-weight:700; letter-spacing:0.5px;">Tag Name</label>
      <input type="text" id="gv2-tag-modal-name" placeholder="Enter tag name..." style="width:100%; height:40px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#fff; padding:0 12px; border-radius:8px; font-size:0.95rem; outline:none; box-sizing:border-box; transition:border 0.2s;">
    </div>

    <div style="margin-bottom:14px;">
      <label style="display:block; font-size:0.75rem; color:#999; margin-bottom:5px; text-transform:uppercase; font-weight:700; letter-spacing:0.5px;">Select Group</label>
      <div style="position:relative;">
        <select id="gv2-tag-modal-group-sel" style="width:100%; height:40px; background:#1e1e23; border:1px solid rgba(255,255,255,0.12); color:#fff; padding:0 35px 0 12px; border-radius:8px; font-size:0.95rem; outline:none; box-sizing:border-box; cursor:pointer; -webkit-appearance:none; appearance:none;">
          <option value="" style="background:#1e1e23; color:#fff;">-- No Group / Ungrouped --</option>
        </select>
        <div style="position:absolute; right:12px; top:12px; pointer-events:none; border-left:5px solid transparent; border-right:5px solid transparent; border-top:6px solid #aaa;"></div>
      </div>
    </div>

    <div style="margin-bottom:22px;">
      <label style="display:block; font-size:0.75rem; color:#999; margin-bottom:5px; text-transform:uppercase; font-weight:700; letter-spacing:0.5px;">OR Type New Group</label>
      <input type="text" id="gv2-tag-modal-new-grp" placeholder="New group name..." style="width:100%; height:40px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#fff; padding:0 12px; border-radius:8px; font-size:0.95rem; outline:none; box-sizing:border-box;">
    </div>

    <div id="gv2-tag-draw-container" style="display:none; margin-bottom:20px; border:1px solid rgba(255,255,255,0.1); border-radius:12px; overflow:hidden; background:#000;">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.08);">
        <span style="font-size:0.7rem; color:#aaa; text-transform:uppercase; font-weight:700;">Draw Pattern</span>
        <button id="gv2-tag-draw-clear" style="background:none; border:none; color:#ff6b6b; font-size:0.7rem; cursor:pointer; font-weight:600;">Clear</button>
      </div>
      <canvas id="gv2-tag-draw-canvas" width="300" height="150" style="width:100%; height:120px; cursor:crosshair; touch-action:none;"></canvas>
    </div>

    <div style="margin-bottom:20px; text-align:center; display:flex; gap:8px; justify-content:center;">
       <button id="gv2-tag-draw-toggle" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#aaa; font-size:0.75rem; padding:6px 12px; border-radius:20px; cursor:pointer; transition:all 0.2s;">
         + Draw Pattern Tag
       </button>
       <button id="gv2-tag-upload-btn" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#aaa; font-size:0.75rem; padding:6px 12px; border-radius:20px; cursor:pointer; transition:all 0.2s;">
         + Upload Image Tag
       </button>
       <input type="file" id="gv2-tag-upload-input" accept="image/*" style="display:none;">
    </div>

    <div style="display:flex; gap:10px;">
      <button id="gv2-tag-modal-cancel" style="flex:1; height:42px; background:transparent; border:1px solid rgba(255,255,255,0.1); color:#ccc; border-radius:10px; cursor:pointer; font-weight:600; font-size:0.9rem; transition:all 0.2s;">Hatao</button>
      <button id="gv2-tag-modal-create" style="flex:1.8; height:42px; background:var(--blue, #2962ff); border:none; color:#fff; border-radius:10px; cursor:pointer; font-weight:700; font-size:0.9rem; transition:all 0.2s; box-shadow:0 4px 20px rgba(41,98,255,0.3);">Create Tag</button>
    </div>
  </div>
</div>
<style>
  .gv2-tt-del-tag.active {
    background: #f85149 !important;
    border-color: #f85149 !important;
    color: #fff !important;
    box-shadow: 0 0 12px rgba(248, 81, 73, 0.4);
  }
  .gv2-tt-tag-chip.delete-mode {
    border-color: rgba(248, 81, 73, 0.5) !important;
    animation: gv2-shake 0.3s ease-in-out infinite alternate;
  }
  @keyframes gv2-shake {
    from { transform: rotate(-1deg); }
    to { transform: rotate(1deg); }
  }
  #gallery-filter-active-bar {
    animation: gv2-pulse-orange 2s infinite alternate;
  }
  @keyframes gv2-pulse-orange {
    from { box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3); opacity: 0.9; }
    to { box-shadow: 0 4px 25px rgba(255, 215, 0, 0.6); opacity: 1; }
  }
  .head-checkbox {
    display: flex !important;
    align-items: center;
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.2s;
    font-size: 0.88rem;
    gap: 10px;
  }
  .head-checkbox:hover {
    background: rgba(255,255,255,0.05);
  }
  .head-checkbox input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--blue);
  }
  .gv2-ulp-pane .panel-list {
    max-height: none !important;
    flex: 1;
    overflow-y: auto;
  }
</style>

<!-- ── IMAGE MANAGER MODAL (Table of Dates vs Tags) ── -->

```

## File: `templates/gallery-modals-b.html`
```html
<div class="img-manager-overlay" id="img-manager-overlay">
  <div class="img-manager-card">
    <style>
      .img-manager-overlay {
        display: none; position: fixed; inset: 0; z-index: 11000;
        background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
        align-items: center; justify-content: center;
      }
      .img-manager-card {
        width: min(1180px, 98vw); height: 92vh;
        background: #0d1117; border: 1px solid #30363d; border-radius: 12px;
        display: flex; flex-direction: column; overflow: hidden;
        position: relative; box-shadow: 0 0 50px rgba(0,0,0,0.8);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      }
      .img-manager-hdr {
        padding: 14px 20px; border-bottom: 1px solid #30363d;
        display: flex; justify-content: space-between; align-items: center;
        background: #161b22;
      }
      .img-manager-title { font-weight: 700; color: #fff; font-size: 1.1rem; letter-spacing: 0.5px; }
      .img-manager-body { flex: 1; overflow: auto; padding: 0; position: relative; }
      
      .im-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.82rem; color: #c9d1d9; }
      .im-table th { 
        position: sticky; top: 0; background: #161b22; z-index: 20;
        padding: 12px 14px; font-weight: 600; text-align: left;
        border-bottom: 2px solid #30363d; white-space: nowrap;
        text-transform: uppercase; color: #8b949e; font-size: 0.72rem;
      }
      .im-header-content { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; }
      .im-header-text { flex: 1; text-align: center; overflow: hidden; text-overflow: ellipsis; }
      .im-header-dots-btn { 
        background: none; border: none; color: #8b949e; 
        cursor: pointer; padding: 2px 6px; border-radius: 4px;
        font-size: 1.1rem; line-height: 1; transition: all 0.2s;
        display: flex; align-items: center; justify-content: center;
      }
      .im-header-dots-btn:hover { background: #30363d; color: #fff; }
      
      .im-header-menu {
        display: none; position: fixed; background: #161b22; 
        border: 1px solid #30363d; border-radius: 8px; 
        z-index: 120000; box-shadow: 0 8px 24px rgba(0,0,0,0.6);
        min-width: 160px; padding: 6px 0;
      }
      .im-header-menu-item {
        padding: 8px 14px; cursor: pointer; font-size: 0.82rem;
        color: #c9d1d9; display: flex; align-items: center; gap: 10px;
        transition: background 0.1s;
      }
      .im-header-menu-item:hover { background: rgba(88, 166, 255, 0.1); color: #58a6ff; }
      .im-header-menu-item svg { width: 16px; height: 16px; }

      .im-table td { 
        padding: 10px 14px; border-bottom: 1px solid #21262d; 
        vertical-align: middle; transition: background 0.1s;
      }
      .im-table tr:hover td { background: rgba(88, 166, 255, 0.05); }
      .im-table th:first-child, .im-table td:first-child { 
        position: sticky; left: 0; background: #0d1117; z-index: 10; border-right: 1px solid #30363d;
      }
      .im-table th:first-child { z-index: 30; background: #161b22; }
      
      .im-date-cell { font-weight: 600; color: #58a6ff; white-space: nowrap; min-width: 140px; }
      .im-tag-cell { text-align: center; font-weight: 700; font-family: 'JetBrains Mono', monospace, 'Courier New'; }
      .im-count {
        display: inline-block; padding: 3px 10px; border-radius: 6px;
        background: rgba(88,166,255,0.12); color: #58a6ff; border: 1px solid rgba(88,166,255,0.1);
        min-width: 24px; text-align: center;
      }
      .im-count.missing { background: rgba(248,81,73,0.12); color: #f85149; border-color: rgba(248,81,73,0.1); opacity: 0.6; }
      .im-trade-cell { text-align: left; min-width: 250px; font-weight: 500; font-size: 0.75rem; color: #8b949e; }
      .im-trade-list { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; padding: 0; margin: 0; }
      .im-trade-item {
        background: #21262d; color: #8b949e; border: 1px solid #30363d;
        padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 700;
        display: flex; align-items: center; gap: 4px;
      }
      .im-trade-item.has-img {
        background: rgba(88, 166, 255, 0.05); color: #c9d1d9; border-color: #30363d;
      }
      .im-trade-item.no-img {
        background: rgba(139,148,158,0.07); color: #555d69; border: 1px dashed #30363d; opacity: 0.7;
      }
      .im-trade-item.pnl-win {
        background: rgba(63,185,80,0.12); color: #3fb950; border-color: rgba(63,185,80,0.4);
      }
      .im-trade-item.pnl-loss {
        background: rgba(248,81,73,0.12); color: #f85149; border-color: rgba(248,81,73,0.35);
      }
      .im-trade-item.no-img.pnl-win { color: #2a7a38; border-color: rgba(63,185,80,0.2); }
      .im-trade-item.no-img.pnl-loss { color: #8b3530; border-color: rgba(248,81,73,0.2); }
      .im-trade-img-count { opacity: 0.55; font-size: 0.65rem; }
      
      .im-sort-icon { cursor: pointer; margin-left: 6px; opacity: 0.5; transition: opacity 0.2s; }
      .im-sort-icon:hover, .im-sort-icon.active { opacity: 1; color: #58a6ff; }

      .im-col-dropdown { position: relative; }
      .im-col-btn { 
        background: #21262d; border: 1px solid #30363d; color: #c9d1d9; 
        padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.78rem;
        display: flex; align-items: center; gap: 8px;
      }
      .im-col-btn:hover { background: #30363d; }
      .im-col-menu {
        display: none; position: absolute; top: 110%; right: 0;
        background: #161b22; border: 1px solid #30363d; border-radius: 8px;
        min-width: 280px; z-index: 100000; box-shadow: 0 12px 32px rgba(0,0,0,0.7);
        padding: 0; max-height: 500px; height: auto; overflow: hidden;
        display: flex; flex-direction: column;
      }
      .im-col-search-wrap { padding: 12px; border-bottom: 1px solid #30363d; background: #0d1117; flex-shrink: 0; }
      .im-col-search { 
        width: 100%; background: #161b22; border: 2px solid #30363d; 
        border-radius: 6px; color: #fff; padding: 7px 12px; font-size: 0.82rem;
      }
      .im-col-search:focus { border-color: #58a6ff; outline: none; }
      .im-col-list { overflow-y: auto; flex: 1; padding: 4px 0 12px; min-height: 0; }
      .im-col-item {
        display: flex; align-items: center; gap: 10px; padding: 8px 14px;
        cursor: pointer; font-size: 0.85rem; transition: background 0.1s; user-select: none;
      }
      .im-col-item:hover { background: rgba(88, 166, 255, 0.1); }
      .im-col-item input[type="checkbox"] { pointer-events: none; width: 16px; height: 16px; accent-color: #58a6ff; }
      
      /* Webkit scrollbar for list */
      .im-col-list::-webkit-scrollbar { width: 8px; }
      .im-col-list::-webkit-scrollbar-track { background: transparent; }
      .im-col-list::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }
      .im-col-list::-webkit-scrollbar-thumb:hover { background: #484f58; }

      #img-manager-empty {
        position: absolute; inset: 0; display: flex; flex-direction: column; 
        align-items: center; justify-content: center; text-align: center; color: #8b949e;
        background: #0d1117; z-index: 50;
      }
    </style>
    
    <div class="img-manager-hdr">
      <div style="display:flex; align-items:center; gap:16px;">
        <span class="img-manager-title">📊 Image Management Dashboard</span>
        <div style="display:flex; flex-direction:column; gap:2px;">
           <span style="font-size:0.68rem; color:#8b949e;">Track tag coverage across trading days</span>
           <span style="font-size:0.62rem; color:var(--blue); opacity:0.8; font-weight:700;">Tip: Right-click tags in tray to add/remove columns</span>
        </div>
      </div>
      
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="im-col-dropdown" id="im-col-dropdown">
          <button class="im-col-btn" id="im-col-toggle-btn">Show Columns &#9660;</button>
          <div class="im-col-menu" id="im-col-menu">
            <!-- Dynamic items -->
          </div>
        </div>
        <button class="close-btn" id="img-manager-close-x" style="font-size:1.4rem;">&#10005;</button>
      </div>
    </div>
    
    <div class="img-manager-body" id="img-manager-body">
      <table class="im-table" id="im-table" style="display:none;">
        <thead>
          <tr id="im-table-head">
            <th id="im-th-date" style="cursor:pointer; user-select:none;">
              Date / Day <span id="im-sort-arrow" class="im-sort-icon active">↓</span>
            </th>
            <!-- Dynamic columns -->
            <th style="width:340px; text-align:left;">Daily Trades</th>
          </tr>
        </thead>
        <tbody id="im-table-body"></tbody>
      </table>
      
      <div id="img-manager-empty" style="display:none;">
        <div style="font-size:3.5rem; margin-bottom:16px; opacity:0.4;">📊</div>
        <p style="margin:0; font-size:1.15rem; font-weight:700; color:#fff;">No Columns Selected</p>
        <p style="margin:10px 0 0; font-size:0.88rem; max-width:340px; line-height:1.5;">
          Your manager is currently empty. Right-click any tag in the <strong>Tags tray</strong> and select <strong>"Show in manager"</strong> to track its daily occurrence.
        </p>
        <button class="btn btn-primary" style="margin-top:20px; padding:8px 24px;" onclick="document.getElementById('img-manager-overlay').style.display='none'; if(!state.gallery.layerPanelOpen) toggleGalleryTagsTray()">Go to Tags</button>
      </div>
    </div>

    <!-- Dropdown for Header Actions -->
    <div id="im-header-menu" class="im-header-menu"></div>
  </div>
</div>

<!-- ── PDF LIST MODAL ─────────────────── -->
<div class="modal-overlay" id="pdf-list-modal" style="display: none; position: fixed; inset: 0; z-index: 12000; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); align-items: center; justify-content: center;">
  <div class="modal-content" style="width: min(900px, 94vw); height: 80vh; background: #0d1117; border: 1px solid #30363d; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,0.9);">
    <div class="modal-header" style="background: #161b22; border-bottom: 1px solid #30363d; padding: 18px 25px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
      <div style="display: flex; align-items: center; gap: 15px;">
        <span style="font-size: 1.25rem; font-weight: 700; color: #fff;">🗂️ PDF Files</span>
        <span id="pdf-list-count" style="font-size: 0.82rem; color: #58a6ff; background: rgba(88, 166, 255, 0.12); padding: 4px 10px; border-radius: 6px; font-weight: 700;">0 Files</span>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <button id="pdf-list-upload-btn" style="background:#238636; color:#fff; border:none; border-radius:8px; padding:8px 16px; font-size:0.88rem; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:5px;">⬆️ Upload PDF</button>
        <input type="file" id="pdf-list-upload-input" accept=".pdf" style="display:none" />
        <button class="close-btn" id="pdf-list-close" style="font-size:1.5rem; color:#8b949e; background:transparent; border:none; cursor:pointer;">&#10005;</button>
      </div>
    </div>

    <!-- PDF Upload Progress Bar (hidden by default) -->
    <div id="pdf-upload-progress" style="display:none; padding:14px 25px 12px; border-bottom:1px solid #30363d; background:#0d1117;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:7px;">
        <span id="pdf-progress-label" style="font-size:0.83rem; color:#c9d1d9; font-weight:500;">Uploading...</span>
        <span id="pdf-progress-pct" style="font-size:0.83rem; color:#58a6ff; font-weight:700; font-family:monospace;">0%</span>
      </div>
      <div style="background:#21262d; border-radius:6px; height:7px; overflow:hidden;">
        <div id="pdf-progress-fill" style="height:100%; background:linear-gradient(90deg,#238636,#2ea043); border-radius:6px; width:0%; transition:width 0.25s ease;"></div>
      </div>
      <div id="pdf-progress-sub" style="font-size:0.73rem; color:#6e7681; margin-top:5px; font-family:monospace;"></div>
    </div>

    <!-- Explorer-style Column Headers -->
    <div class="pdf-list-columns-header">
      <div class="pdf-head-icon"></div>
      <div class="pdf-head-name">Name</div>
      <div class="pdf-head-date">Date modified</div>
      <div class="pdf-head-size">Size</div>
      <div class="pdf-head-menu"></div>
    </div>
    
    <div id="pdf-list-body" style="flex: 1; overflow-y: auto; padding: 15px 25px; background: #010409;">
      <!-- PDF list items will be injected here -->
    </div>
  </div>
</div>

<!-- ── PDF PREVIEW MODAL ─────────────────── -->
<div class="modal-overlay" id="pdf-viewer-modal" style="display: none; position: fixed; inset: 0; z-index: 12000; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); align-items: center; justify-content: center;">
  <div class="modal-content" style="width: min(1100px, 96vw); height: 92vh; background: #0d1117; border: 1px solid #30363d; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,0.9); border: 1px solid rgba(255,255,255,0.05);">
    <div class="modal-header" style="background: #161b22; border-bottom: 1px solid #30363d; padding: 16px 25px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
      <div style="display: flex; align-items: center; gap: 15px;">
        <span style="font-size: 1.25rem; font-weight: 700; color: #fff; letter-spacing: 0.5px;">📄 PDF Document Preview</span>
        <span id="pdf-viewer-stats" style="font-size: 0.82rem; color: #58a6ff; background: rgba(88, 166, 255, 0.12); padding: 4px 10px; border-radius: 6px; font-weight: 700; border: 1px solid rgba(88, 166, 255, 0.2);">0 Pages</span>
      </div>
      <button class="close-btn" id="pdf-viewer-close" style="font-size: 1.5rem; color: #8b949e; background: transparent; border: none; cursor: pointer; transition: color 0.2s;">&#10005;</button>
    </div>
    
    <div id="pdf-viewer-body" style="flex: 1; overflow-y: auto; padding: 35px; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 30px; background: #010409; align-content: start;">
      <!-- Page thumbnails will be injected here -->
    </div>

    <div class="modal-footer" style="background: #161b22; border-top: 1px solid #30363d; padding: 18px 30px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
      <div style="display: flex; align-items: center; gap: 20px;">
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: #c9d1d9; font-size: 0.92rem; user-select: none;">
          <input type="checkbox" id="pdf-select-all" checked style="width: 20px; height: 20px; accent-color: #238636; cursor: pointer;" />
          <span style="font-weight: 600;">Select All Pages</span>
        </label>
        <span style="color: #6e7681; font-size: 0.82rem; font-style: italic;">Tap any page to include/exclude from import</span>
      </div>
      <div style="display: flex; gap: 15px;">
        <button class="btn btn-outline" id="pdf-viewer-cancel" style="padding: 10px 20px; color: #c9d1d9; border-color: #30363d;">Cancel</button>
        <button class="btn btn-primary" id="pdf-import-done-btn" style="padding: 12px 32px; font-weight: 700; background: #238636; border: none; color: #fff; border-radius: 8px; box-shadow: 0 4px 20px rgba(35, 134, 54, 0.4); transition: all 0.2s; cursor: pointer;">Import Selected Pages</button>
      </div>
    </div>
  </div>
</div>

<style>
  #pdf-viewer-close:hover { color: #fff; }
  .pdf-page-thumb {
    position: relative;
    border: 3px solid transparent;
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
    background: #0d1117;
    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    aspect-ratio: 1 / 1.414;
  }
  .pdf-page-thumb:hover {
    transform: translateY(-8px) scale(1.02);
    border-color: rgba(88, 166, 255, 0.4);
    box-shadow: 0 20px 40px rgba(0,0,0,0.7);
  }
  .pdf-page-thumb.selected {
    border-color: #238636;
    box-shadow: 0 0 25px rgba(35, 134, 54, 0.3);
  }
  .pdf-page-thumb canvas {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    background: #fff;
  }
  .pdf-page-num {
    position: absolute;
    bottom: 12px;
    right: 12px;
    background: rgba(0,0,0,0.75);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 20px;
    pointer-events: none;
    border: 1px solid rgba(255,255,255,0.1);
  }
  .pdf-page-check {
    position: absolute;
    top: 12px;
    left: 12px;
    width: 28px;
    height: 28px;
    background: rgba(0,0,0,0.5);
    border: 2px solid rgba(255,255,255,0.3);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: transparent;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    font-weight: 900;
    font-size: 14px;
    z-index: 5;
  }
  .pdf-page-thumb.selected .pdf-page-check {
    background: #238636;
    border-color: #238636;
    color: #fff;
    transform: scale(1.1);
  }
  .pdf-page-thumb.selected::after {
    content: ""; position: absolute; inset: 0; background: rgba(35, 134, 54, 0.05); pointer-events: none;
  }
  /* ── PDF List Styles ── */
  .pdf-item-row, .pdf-list-columns-header {
    display: grid;
    grid-template-columns: 40px 1fr 200px 110px 40px;
    align-items: center;
    gap: 0;
  }
  .pdf-list-columns-header {
    background: #161b22;
    border-bottom: 2px solid #30363d;
    padding: 10px 25px;
    flex-shrink: 0;
  }
  .pdf-list-columns-header > div {
    font-size: 0.7rem;
    color: #8b949e;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    padding: 0 15px;
    cursor: pointer;
    user-select: none;
    transition: color 0.1s;
    display: flex;
    align-items: center;
  }
  .pdf-list-columns-header > div:hover {
    color: #fff;
  }
  .pdf-head-icon, .pdf-head-menu {
    cursor: default !important;
  }
  .pdf-head-icon:hover, .pdf-head-menu:hover {
    color: #8b949e !important;
  }
  .pdf-item-row {
    background: transparent;
    border-bottom: 1px solid rgba(48, 54, 61, 0.4);
    padding: 10px 25px;
    transition: background 0.1s;
  }
  .pdf-item-row:hover {
    background: rgba(255, 255, 255, 0.03);
    border-color: #58a6ff33;
  }
  .pdf-item-icon {
    font-size: 1.4rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .pdf-item-name {
    color: #f0f6fc;
    font-weight: 500;
    font-size: 0.88rem;
    padding: 0 15px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pdf-item-size, .pdf-item-date {
    color: #8b949e;
    font-size: 0.82rem;
    display: flex;
    align-items: center;
    padding: 0 15px;
    white-space: nowrap;
    opacity: 0.8;
  }
  /* ── 3-Dot Menu Styles ── */
  .pdf-menu-container {
    position: relative;
  }
  .pdf-menu-btn {
    background: transparent;
    border: none;
    color: #8b949e;
    font-size: 1.4rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    line-height: 1;
    transition: all 0.2s;
  }
  .pdf-menu-btn:hover {
    background: #30363d;
    color: #fff;
  }
  .pdf-dropdown-menu {
    display: none;
    position: absolute;
    top: 100%;
    right: 0;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    z-index: 100;
    min-width: 150px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    padding: 6px 0;
    margin-top: 5px;
  }
  .pdf-dropdown-menu.show {
    display: block;
  }
  .pdf-menu-item {
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    color: #c9d1d9;
    font-size: 0.88rem;
    text-decoration: none;
    cursor: pointer;
    transition: background 0.2s;
    border: none;
    background: transparent;
    width: 100%;
    text-align: left;
  }
  .pdf-menu-item:hover {
    background: #30363d;
    color: #fff;
  }
  .pdf-menu-item.delete {
    color: #f85149;
  }
  .pdf-menu-item.delete:hover {
    background: rgba(248, 81, 73, 0.1);
    color: #ff7b72;
  }
  .pdf-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #484f58;
    gap: 20px;
    text-align: center;
  }
</style>

<!-- ── P&L CALENDAR MODAL ─────────────────── -->
<div class="modal-overlay" id="gv2-pnl-calendar-modal" style="display:none; z-index:11000; background:rgba(0,0,0,0.85); backdrop-filter:blur(10px);">
  <div class="modal-content pnl-calendar-modal-content" style="width:min(900px, 94vw); max-height:94vh; background:#0d1117; border:1px solid #30363d; border-radius:20px; box-shadow:0 30px 90px rgba(0,0,0,0.9); overflow:hidden; display:flex; flex-direction:column;">
    <div class="modal-header" style="background:#161b22; border-bottom:1px solid #30363d; padding:18px 25px; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
      <div style="display:flex; align-items:center; gap:20px;">
        <span style="font-size:1.25rem; font-weight:800; color:#fff; letter-spacing:1px; text-transform:uppercase;">P&L Calendar</span>
        <div style="display:flex; align-items:center; background:rgba(255,255,255,0.05); padding:4px; border-radius:12px; border:1px solid rgba(255,255,255,0.08);">
          <button id="pnl-cal-prev" style="background:transparent; border:none; color:#fff; width:32px; height:32px; cursor:pointer; font-size:1.2rem; display:flex; align-items:center; justify-content:center; border-radius:8px;">&#8249;</button>
          <span id="pnl-cal-month-label" style="min-width:140px; text-align:center; font-weight:700; color:#58a6ff; font-size:1rem; text-transform:uppercase; letter-spacing:0.5px;">APRIL 2026</span>
          <button id="pnl-cal-next" style="background:transparent; border:none; color:#fff; width:32px; height:32px; cursor:pointer; font-size:1.2rem; display:flex; align-items:center; justify-content:center; border-radius:8px;">&#8250;</button>
        </div>
      </div>
      <button class="close-btn" id="pnl-cal-close-x" style="font-size:1.5rem; color:#8b949e; background:transparent; border:none; cursor:pointer;">&#10005;</button>
    </div>
    <div class="pnl-calendar-body" style="flex:1; padding:25px; overflow-y:auto; background:#010409;">
      <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:12px; margin-bottom:12px;">
        <div style="text-align:center; font-size:0.7rem; font-weight:800; color:#8b949e; text-transform:uppercase; letter-spacing:1px;">Mon</div>
        <div style="text-align:center; font-size:0.7rem; font-weight:800; color:#8b949e; text-transform:uppercase; letter-spacing:1px;">Tue</div>
        <div style="text-align:center; font-size:0.7rem; font-weight:800; color:#8b949e; text-transform:uppercase; letter-spacing:1px;">Wed</div>
        <div style="text-align:center; font-size:0.7rem; font-weight:800; color:#8b949e; text-transform:uppercase; letter-spacing:1px;">Thu</div>
        <div style="text-align:center; font-size:0.7rem; font-weight:800; color:#8b949e; text-transform:uppercase; letter-spacing:1px;">Fri</div>
        <div style="text-align:center; font-size:0.7rem; font-weight:800; color:#f85149; text-transform:uppercase; letter-spacing:1px;">Sat</div>
        <div style="text-align:center; font-size:0.7rem; font-weight:800; color:#f85149; text-transform:uppercase; letter-spacing:1px;">Sun</div>
      </div>
      <div id="pnl-calendar-grid" style="display:grid; grid-template-columns:repeat(7, 1fr); gap:12px; min-height:450px;"></div>
    </div>
    <div class="modal-footer" style="background:#161b22; border-top:1px solid #30363d; padding:15px 25px; display:flex; justify-content:space-between; align-items:center;">
      <div style="display:flex; gap:20px; font-size:0.82rem;">
        <div style="display:flex; align-items:center; gap:6px;"><span style="width:10px; height:10px; background:#238636; border-radius:2px;"></span> <span style="color:#c9d1d9;">Profit Day</span></div>
        <div style="display:flex; align-items:center; gap:6px;"><span style="width:10px; height:10px; background:#da3633; border-radius:2px;"></span> <span style="color:#c9d1d9;">Loss Day</span></div>
        <div style="display:flex; align-items:center; gap:6px;"><span style="width:10px; height:10px; background:rgba(255,255,255,0.05); border:1px solid #30363d; border-radius:2px;"></span> <span style="color:#8b949e;">No Trades</span></div>
      </div>
      <button class="btn btn-outline" id="pnl-cal-today-btn" style="padding:8px 18px; border-radius:8px; font-weight:600;">Go to Today</button>
    </div>
  </div>
</div>

<style>
  .pnl-cal-nav-btn:hover { background: rgba(255,255,255,0.1) !important; color: #58a6ff !important; }
  .pnl-calendar-day {
    aspect-ratio: 1;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 12px;
    padding: 10px;
    position: relative;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .pnl-calendar-day:hover {
    transform: translateY(-4px);
    background: rgba(255,255,255,0.05);
    border-color: rgba(255,255,255,0.15);
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    z-index: 5;
  }
  .pnl-calendar-day.empty { pointer-events: none; opacity: 0.1; border: none; background: transparent; }
  .pnl-calendar-day.today { border: 2px solid #58a6ff; background: rgba(88, 166, 255, 0.05); }
  .pnl-calendar-day.profit { background: rgba(35, 134, 54, 0.15); border-color: rgba(35, 134, 54, 0.4); }
  .pnl-calendar-day.loss { background: rgba(218, 54, 51, 0.15); border-color: rgba(218, 54, 51, 0.4); }
  
  .pnl-cal-day-num { font-size: 1.1rem; font-weight: 800; color: #8b949e; }
  .pnl-calendar-day.profit .pnl-cal-day-num { color: #3fb950; }
  .pnl-calendar-day.loss .pnl-cal-day-num { color: #f85149; }
  .pnl-calendar-day.today .pnl-cal-day-num { color: #58a6ff; }
  
  .pnl-cal-day-val {
    font-size: 0.72rem;
    font-weight: 700;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .profit .pnl-cal-day-val { color: #3fb950; }
  .loss .pnl-cal-day-val { color: #f85149; }

  .pnl-calendar-grid {
    animation: pnlFadeIn 0.3s ease-out;
  }
  @keyframes pnlFadeIn {
    from { opacity: 0; transform: scale(0.98); }
    to { opacity: 1; transform: scale(1); }
  }
</style>

```

## File: `templates/gallery-sidebar.html`
```html
    <!-- Right Sidebar Strip -->
    <div class="gv2-sidebar-strip" id="gv2-sidebar-strip">
      <button class="gv2-sb-btn gv2-sidebar-toggle" id="gv2-sidebar-toggle-btn" title="Toggle sidebar" onclick="toggleGv2Sidebar()">
        <svg id="gv2-sidebar-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M10 4l-4 4 4 4"/></svg>
      </button>
      <div class="gv2-sb-sep gv2-sidebar-collapsible"></div>
      <button class="gv2-sb-btn gv2-sidebar-collapsible" id="gv2-fullscreen-btn" title="Fullscreen">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg>
      </button>
      <button class="gv2-sb-btn" id="gv2-popout-btn" title="Popout (New Window)">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
          <path d="M9 1L15 1V7M15 1L8 8M5 1H2V14H15V11"/>
        </svg>
      </button>
      <div class="gv2-sb-sep"></div>
      <button class="gv2-sb-btn gv2-toggle-btn" id="gv2-tags-btn" title="Tags (T)">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M7.5 1.5L2 7l4.5 4.5 5.5-5.5V1.5h-4.5z"/><circle cx="9.5" cy="3.5" r="1" fill="currentColor" stroke="none"/></svg>
      </button>
      <button class="gv2-sb-btn gv2-thumb-toggle-btn" id="gv2-thumb-toggle-btn" title="Thumbnails (G)">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>
      </button>
      <button class="gv2-sb-btn" id="gv2-grid-btn" title="Grid View (All Images)">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
          <rect x="1" y="1" width="3.2" height="3.2" rx="0.5"/><rect x="6.4" y="1" width="3.2" height="3.2" rx="0.5"/><rect x="11.8" y="1" width="3.2" height="3.2" rx="0.5"/>
          <rect x="1" y="6.4" width="3.2" height="3.2" rx="0.5"/><rect x="6.4" y="6.4" width="3.2" height="3.2" rx="0.5"/><rect x="11.8" y="6.4" width="3.2" height="3.2" rx="0.5"/>
          <rect x="1" y="11.8" width="3.2" height="3.2" rx="0.5"/><rect x="6.4" y="11.8" width="3.2" height="3.2" rx="0.5"/><rect x="11.8" y="11.8" width="3.2" height="3.2" rx="0.5"/>
        </svg>
      </button>
      <button class="gv2-sb-btn gv2-toggle-btn" id="gv2-layer-btn" title="Layers (L)">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M2 11l6 3 6-3M2 7l6 3 6-3M8 2L2 5l6 3 6-3-6-3z"/></svg>
      </button>
      <button class="gv2-sb-btn gv2-toggle-btn" id="gv2-trades-panel-btn" title="All Trades (Sorted)">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><line x1="3" y1="4" x2="13" y2="4"/><line x1="3" y1="8" x2="13" y2="8"/><line x1="3" y1="12" x2="13" y2="12"/></svg>
      </button>
      <!-- Sync All OHLC charts -->
      <button class="gv2-sb-btn" id="gc-sync-open-btn" onclick="gcOpenSyncPanel()" title="Download All OHLC Charts">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
          <polyline points="1 4 1 1 15 1 15 4"/><line x1="8" y1="1" x2="8" y2="11"/>
          <polyline points="5 8 8 11 11 8"/>
          <line x1="1" y1="15" x2="15" y2="15"/>
        </svg>
      </button>
      <button class="gv2-sb-btn" id="gallery-upload-btn" title="Upload">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M8 12V2m0 0l-3 3m3-3l3 3M2 14h12"/></svg>
      </button>
      <!-- Show Heads dropdown -->
      <div class="dropdown-wrapper">
        <button class="gv2-sb-btn" id="gallery-show-heads-btn" title="Show Heads">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M1 8s3-5.5 7-5.5 7 5.5 7 5.5-3 5.5-7 5.5-7-5.5-7-5.5z"/><circle cx="8" cy="8" r="2.5"/></svg>
        </button>
        <div class="dropdown-menu show-heads-panel" id="gallery-show-heads-panel"
          style="right:0;left:auto;min-width:220px;max-height:400px;overflow-y:auto;z-index:9999;"></div>
      </div>
      <button class="gv2-sb-btn gv2-toggle-btn" id="gallery-img-tag-filter-btn" title="Filter Tags (F)">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M2.5 3h11l-4.5 5.5v5l-2-2v-3L2.5 3z"/></svg>
      </button>
      <button class="gv2-sb-btn gv2-toggle-btn" id="gv2-video-url-btn" title="Video URLs" style="display:none; font-size:0.65rem; font-weight:600;">Vid</button>
      <!-- Recording Dropdown -->
      <div class="gv2-tray-record-container dropdown-wrap">
        <button id="gv2-record-toggle-btn" class="gv2-sb-btn gv2-record-trigger" title="Record Tools">
          <svg class="gv2-tray-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:18px;height:18px;">
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" opacity="0.4"/>
            <circle class="rec-dot-pulse" cx="12" cy="12" r="5" fill="#ff4742"/>
          </svg>
          <span id="gv2-record-label" style="display:none">Record</span>
        </button>
        <div class="dropdown-menu gv2-record-dropdown" id="gv2-record-menu" style="right: 42px; left: auto; transform: none; min-width: 150px;">
           <button class="dropdown-item" id="gv2-menu-rec-video">
             <svg class="gv2-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/></svg>
             Screen Record
           </button>
           <button class="dropdown-item" id="gv2-menu-rec-audio">
             <svg class="gv2-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
             Audio Record
           </button>
        </div>
      </div>

      <!-- Recording Progress Bars (Visible only during recording) -->
      <div id="gv2-tray-record-bars" class="gv2-tray-record-bars" style="display:none; position: absolute; right: 45px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.8); padding: 4px 12px; border-radius: 20px; border: 1px solid var(--border); z-index: 1000; height: 32px; white-space: nowrap;">
          <div class="gv2-audio-bar" id="gv2-audio-bar"></div>
          <div class="gv2-video-bar" id="gv2-video-bar"></div>
      </div>

      <!-- Image Type Filter Dropdown -->
      <div class="gv2-filter-dropdown-wrap dropdown-wrap">
        <button class="gv2-sb-btn gv2-filter-trigger" id="gv2-filter-type-trigger" title="Filter Image Type (Both/Index/Premium)">
          <svg class="gv2-tray-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          <span id="gv2-filter-current-label" style="display:none">Both</span>
        </button>
        <div class="dropdown-menu" id="gv2-filter-type-menu" style="right: 42px; left: auto; transform: none; min-width: 120px;">
          <div class="dropdown-item" onclick="setGalleryImgTypeFilter('both')">Both</div>
          <div class="dropdown-item" onclick="setGalleryImgTypeFilter('index')">Index</div>
          <div class="dropdown-item" onclick="setGalleryImgTypeFilter('premium')">Premium</div>
        </div>
      </div>

      <div class="gv2-sb-sep"></div>
      <!-- More dropdown -->
      <div class="dropdown-wrapper">
        <button class="gv2-sb-btn" id="gallery-tools-btn" title="More options">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="8" cy="3" r="1.2" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="8" cy="13" r="1.2" fill="currentColor" stroke="none"/></svg>
        </button>
        <div class="dropdown-menu" id="gallery-tools-panel"
          style="right:0;left:auto;min-width:210px;z-index:9999;">
          <!-- Image actions -->
          <button class="dropdown-item" id="gv2-download-btn">
            <span class="gv2-di-icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v8m0 0l-3-3m3 3l3-3M2 13h12"/></svg></span>Download Image
          </button>
          <button class="dropdown-item" id="gv2-replace-btn">
            <span class="gv2-di-icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 14V6m0 0l-3 3m3-3l3 3M2 3h12"/></svg></span>Upload &amp; Replace
          </button>
          <button class="dropdown-item" id="gv2-add-after-btn">
            <span class="gv2-di-icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v10M3 8h10"/></svg></span>Add Image After
          </button>
          <button class="dropdown-item" id="gv2-copy-img-btn">
            <span class="gv2-di-icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="8" height="9" rx="1.5"/><path d="M11 5V4a1.5 1.5 0 00-1.5-1.5H3.5A1.5 1.5 0 002 4v7A1.5 1.5 0 003.5 12.5H5"/></svg></span>Copy Image
          </button>
          <button class="dropdown-item" id="gv2-share-link-btn">
            <span class="gv2-di-icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2h4v4m0-4L6 10"/><path d="M7 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1V9"/></svg></span>Share Link
          </button>
          <button class="dropdown-item" id="gv2-mark-review-btn">
            <span class="gv2-di-icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2h10l-2 4 2 4H3V2z"/><line x1="3" y1="14" x2="3" y2="2"/></svg></span>Mark for Review
          </button>
          <div class="dropdown-divider"></div>
          <!-- Tools -->
          <button class="dropdown-item gv2-toggle-btn" id="gv2-marquee-btn">
            <span class="gv2-di-icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 2"><rect x="2" y="2" width="12" height="12" rx="1"/></svg></span>Marquee
          </button>
          <button class="dropdown-item gv2-toggle-btn" id="gv2-time-btn">
            <span class="gv2-di-icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5l2.5 1.5"/></svg></span>Time
          </button>
          <button class="dropdown-item" id="gallery-tag-btn">
            <span class="gv2-di-icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 2h6l6 6-6 6-6-6V2z"/><circle cx="5.5" cy="5.5" r="1" fill="currentColor" stroke="none"/></svg></span>Img Tag
          </button>
          <button class="dropdown-item" id="gv2-obs-btn">
            <span class="gv2-di-icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12M2 8h8M2 12h5"/></svg></span>Obs
          </button>
          <button class="dropdown-item gv2-stub" id="gv2-annotate-btn" style="opacity:0.4;cursor:not-allowed;" title="Coming soon">
            <span class="gv2-di-icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2l3 3-8 8H3v-3L11 2z"/></svg></span>Annotate <span style="font-size:0.75em;opacity:0.6">(soon)</span>
          </button>
          <div class="dropdown-divider"></div>
          <!-- Danger -->
          <button class="dropdown-item gv2-di-danger" id="gv2-delete-img-btn">
            <span class="gv2-di-icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h10M6 4V2h4v2M5 4l.5 9h5L11 4"/><line x1="6.5" y1="7" x2="6.5" y2="11"/><line x1="9.5" y1="7" x2="9.5" y2="11"/></svg></span>Delete Image
          </button>
        </div>
      </div>
    </div>

    <!-- Tags Tray (right panel, toggled by T / Tags button) -->
    <div class="gv2-tags-tray" id="gv2-tags-tray" style="display:none">
      <div class="gv2-tray-resize-handle" id="gv2-tray-resize-handle"></div>

      <div class="gv2-tt-hdr">
        <span class="gv2-tt-title">Tags</span>
        <div style="display:flex;gap:4px;align-items:center;">
          <button class="gv2-tt-sz-btn" id="gv2-tag-sz-minus" title="Tag size kam karo">A-</button>
          <button class="gv2-tt-sz-btn" id="gv2-tag-sz-plus" title="Tag size badhao">A+</button>
          <button class="gv2-tt-sz-btn" id="gv2-tag-view-btn" title="Toggle Grouped / Flat view">Grp</button>
          <button class="gv2-tt-add-grp" id="gv2-add-tag-btn">+ Tag</button>
          <button class="gv2-tt-add-grp" id="gv2-add-grp-btn" title="Add new group">+ Group</button>
          <button class="gv2-tt-del-tag" id="gv2-del-tag-btn" title="Delete mode">Del</button>
        </div>
      </div>

      <!-- Video URLs Tray (collapsed by default, toggled by Vid button) -->
      <div class="gv2-video-url-tray" id="gv2-video-url-tray"
        style="padding:8px 10px;border-bottom:1px solid var(--border);display:none;">
        <div id="gv2-video-url-list"
          style="display:flex;flex-wrap:wrap;gap:8px;padding:4px 0;"></div>
      </div>
      <div id="gv2-tags-tray-fixed"></div>
      <div class="gv2-tt-body" id="gv2-tags-tray-body"></div>
    </div>
    <!-- ── GRID VIEW (FULL PAGE OVERLAY) ── -->
    <div class="gv2-grid-view" id="gv2-grid-view" style="display:none">
      
      <!-- LEFT SIDEBAR (Instagram Style) -->
      <div class="gv2-grid-sidebar">
        <div class="gv2-sidebar-top">
          <div class="gv2-sidebar-logo" title="Organized Grid">
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M4 4h4v4H4V4zm6 0h4v4h-4V4zm6 0h4v4h-4V4zM4 10h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zM4 16h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z"/></svg>
          </div>

          <div class="gv2-sidebar-nav">
            <!-- Labels for Filters -->
            <div class="gv2-sidebar-item" id="gv2-sidebar-filter-both" onclick="setGalleryImgTypeFilter('both')" title="Show All Images">
              <span class="gv2-si-icon">🌐</span>
              <span class="gv2-si-label">All Types</span>
            </div>
            <div class="gv2-sidebar-item" id="gv2-sidebar-filter-index" onclick="setGalleryImgTypeFilter('index')" title="Index Images Only">
              <span class="gv2-si-icon">📖</span>
              <span class="gv2-si-label">Index</span>
            </div>
            <div class="gv2-sidebar-item" id="gv2-sidebar-filter-premium" onclick="setGalleryImgTypeFilter('premium')" title="Premium Images Only">
              <span class="gv2-si-icon">⭐</span>
              <span class="gv2-si-label">Premium</span>
            </div>

            <div class="gv2-sidebar-sep"></div>

            <!-- Rec & Wrap Tools -->
            <div class="gv2-sidebar-item" id="gv2-sidebar-record" onclick="document.getElementById('gv2-record-toggle-btn').click()" title="Recording Tools">
              <span class="gv2-si-icon">⏺</span>
              <span class="gv2-si-label">Record</span>
            </div>
            <div class="gv2-sidebar-item" onclick="toggleGridWrap(event)" title="Toggle Wrapping">
              <span class="gv2-si-icon">🏁</span>
              <span class="gv2-si-label">Wrap Grid</span>
            </div>
          </div>
        </div>

        <div class="gv2-sidebar-bottom">
           <div class="gv2-sidebar-item" onclick="toggleGridView(false)" title="Exit Grid View">
              <span class="gv2-si-icon">✖</span>
              <span class="gv2-si-label">Exit</span>
           </div>
        </div>
      </div>

      <!-- MAIN CONTENT -->
      <div class="gv2-grid-main">
        <div class="gv2-grid-tray-simple">
           <div class="gv2-grid-info">
              <span id="gv2-grid-main-counter" style="color:var(--text3); font-size:12px; font-weight:700; background:rgba(255,255,255,0.05); padding:3px 8px; border-radius:6px;"></span>
           </div>

           <!-- TOP CENTER DATE NAV (Relocated from Sidebar) -->
           <div class="gv2-grid-top-date-nav">
              <button class="gv2-date-arrow" onclick="gridMenuNavigateDate(-1)">&#8249;</button>
              <div class="gv2-sidebar-date-pill" id="gv2-sidebar-date-pill" style="min-width:110px; cursor:default;">Date</div>
              <button class="gv2-date-arrow" onclick="gridMenuNavigateDate(1)">&#8250;</button>
           </div>

           <div class="gv2-grid-size-wrap">
              <span class="gv2-grid-sz-icon">SIZE</span>
              <input type="range" id="gv2-grid-size-slider-main" min="80" max="1200" step="10" value="280" />
           </div>

           <!-- Action buttons (same as main tray) -->
           <div style="display:flex; align-items:center; gap:4px; margin-left:8px;">
             <button class="gv2-target-pill" onclick="document.getElementById('gv2-target-pill').click()" title="Open Target Tracker">🎯</button>
             <button class="gv2-target-pill" id="gv2-grid-mtm-btn" onclick="if(document.getElementById('gv2-mtm-panel').style.display!=='none'){document.getElementById('gv2-mtm-panel').style.display='none';}else if(typeof window._openGalleryMtmPanel==='function'){window._openGalleryMtmPanel(this);}" title="Show Day Equity Curve" style="background:var(--pink, #ff00ff); border-color:#ff00ff;">📈</button>
             <button class="gv2-target-pill" onclick="document.getElementById('gv2-img-manager-btn').click()" title="Open Image Manager" style="background:var(--blue); border-color:var(--blue);">📊</button>
           </div>
        </div>
        <div class="gv2-grid-body" id="gv2-grid-body"></div>
      </div>

    </div>

```
