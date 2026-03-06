# HTML — Modals
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `templates\modals.html`
```html
<!-- ── SETTINGS PANEL ───────────────────── -->
<div class="settings-overlay" id="settings-overlay">
  <div class="settings-panel">
    <div class="settings-resize-handle" id="settings-resize-handle"></div>
    <div class="settings-header">
      <span class="settings-title">&#9881; Settings</span>
      <button class="close-btn" id="settings-close">&#10005;</button>
    </div>
    <div class="settings-body">

      <div class="settings-group">
        <div class="settings-group-title">Calendar — Day Number</div>
        <div class="settings-row">
          <label>Size</label>
          <select class="select-box" id="s-day-size">
            <option value="H1">H1 — 1.4rem</option>
            <option value="H2">H2 — 1.1rem</option>
            <option value="H3" selected>H3 — 0.9rem</option>
            <option value="H4">H4 — 0.75rem</option>
            <option value="H5">H5 — 0.62rem</option>
          </select>
        </div>
        <div class="settings-row">
          <label>Bold</label>
          <input type="checkbox" id="s-day-bold" class="settings-chk" checked />
        </div>
        <div class="settings-row">
          <label>Position</label>
          <select class="select-box" id="s-day-pos">
            <option value="top-left" selected>Top Left</option>
            <option value="top-center">Top Center</option>
            <option value="top-right">Top Right</option>
            <option value="bottom-left">Bottom Left</option>
            <option value="bottom-right">Bottom Right</option>
          </select>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Calendar — Data Text</div>
        <div class="settings-row">
          <label>Size</label>
          <select class="select-box" id="s-data-size">
            <option value="H1">H1 — 1.4rem</option>
            <option value="H2">H2 — 1.1rem</option>
            <option value="H3">H3 — 0.9rem</option>
            <option value="H4" selected>H4 — 0.75rem</option>
            <option value="H5">H5 — 0.62rem</option>
          </select>
        </div>
        <div class="settings-row">
          <label>Bold Values</label>
          <input type="checkbox" id="s-data-bold" class="settings-chk" />
        </div>
        <div class="settings-row">
          <label>Show Labels</label>
          <input type="checkbox" id="s-show-labels" class="settings-chk" checked />
          <span class="settings-hint">e.g. "Profit: 200"</span>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Calendar — Cell</div>
        <div class="settings-row">
          <label>Cell Height</label>
          <select class="select-box" id="s-cell-height">
            <option value="compact">Compact — 70px</option>
            <option value="normal" selected>Normal — 100px</option>
            <option value="spacious">Spacious — 140px</option>
            <option value="roomy">Roomy — 180px</option>
          </select>
        </div>
        <div class="settings-row">
          <label>Sat/Sun Off</label>
          <input type="checkbox" id="s-sat-sun-off" class="settings-chk" checked />
          <span class="settings-hint">True = hide weekend columns in calendar</span>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Table</div>
        <div class="settings-row">
          <label>Visible Rows</label>
          <select class="select-box" id="s-table-rows">
            <option value="5" selected>5 rows</option>
            <option value="8">8 rows</option>
            <option value="10">10 rows</option>
            <option value="12">12 rows</option>
            <option value="15">15 rows</option>
          </select>
        </div>
        <div class="settings-row">
          <label>Row Height</label>
          <button class="s-sz-btn" id="s-row-h-minus">&#9660;</button>
          <span class="s-sz-val" id="s-row-h-val">40</span><span style="font-size:0.75rem;color:var(--text2)">px</span>
          <button class="s-sz-btn" id="s-row-h-plus">&#9650;</button>
        </div>
        <div class="settings-row">
          <label>Table Text</label>
          <select class="select-box" id="s-tbl-font-size">
            <option value="0.72">XS — 0.72rem</option>
            <option value="0.78">S — 0.78rem</option>
            <option value="0.85" selected>M — 0.85rem</option>
            <option value="0.95">L — 0.95rem</option>
            <option value="1.05">XL — 1.05rem</option>
          </select>
        </div>
        <div class="settings-row">
          <label>Group A Color</label>
          <input type="color" id="s-group-a-color" class="settings-chk" value="#58a6ff" />
        </div>
        <div class="settings-row">
          <label>Group B Color</label>
          <input type="color" id="s-group-b-color" class="settings-chk" value="#ffffff" />
        </div>
        <div class="settings-row">
          <label>Separator Color</label>
          <input type="color" id="s-group-sep-color" class="settings-chk" value="#58a6ff" />
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Preview</div>
        <div class="settings-preview">
          <div class="preview-day-num" id="prev-day-num">25</div>
          <div class="preview-data-item">Profit: +1,200</div>
          <div class="preview-data-item">Trade: 3</div>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Preview Shortcuts</div>
        <div class="settings-row">
          <label>Pen</label>
          <input type="text" id="sc-pen" class="shortcut-input" />
        </div>
        <div class="settings-row">
          <label>Image Import</label>
          <input type="text" id="sc-image" class="shortcut-input" />
        </div>
        <div class="settings-row">
          <label>Eraser</label>
          <input type="text" id="sc-eraser" class="shortcut-input" />
        </div>
        <div class="settings-row">
          <label>Date Picker</label>
          <input type="text" id="sc-date" class="shortcut-input" />
        </div>
        <div class="settings-row">
          <label>Merge &amp; Save</label>
          <input type="text" id="sc-merge" class="shortcut-input" />
        </div>
        <div class="settings-row">
          <label>Overlay Save</label>
          <input type="text" id="sc-overlay" class="shortcut-input" />
        </div>
        <div class="settings-row">
          <label>Shift + Left/Right</label>
          <span class="settings-hint">Date backward/forward</span>
        </div>
        <div class="settings-row">
          <label>Alt + T</label>
          <span class="settings-hint">Open Image Tag menu</span>
        </div>
        <div class="settings-row">
          <label>Left/Right</label>
          <span class="settings-hint">Previous/next image</span>
        </div>
        <div class="settings-row">
          <label>A</label>
          <span class="settings-hint">Toggle annotation mode</span>
        </div>
        <div class="settings-row">
          <label>R</label>
          <span class="settings-hint">Reset image zoom</span>
        </div>
        <div class="settings-row">
          <label>Esc</label>
          <span class="settings-hint">Close active popup/modal</span>
        </div>
        <!-- New gallery shortcuts -->
        <div class="settings-row">
          <label>Ctrl + L/R</label>
          <span class="settings-hint">Group expand / collapse</span>
        </div>
        <div class="settings-row">
          <label>Alt + G</label>
          <span class="settings-hint">Group all images</span>
        </div>
        <div class="settings-row">
          <label>Shift + G</label>
          <span class="settings-hint">Ungroup all</span>
        </div>
        <div class="settings-row">
          <label>Shift + Alt + L/R</label>
          <span class="settings-hint">Select / deselect tile</span>
        </div>
        <div class="settings-row">
          <label>Ctrl + Shift + L/R</label>
          <span class="settings-hint">Move tile</span>
        </div>
        <div class="settings-row">
          <label>L</label>
          <span class="settings-hint">Toggle Layers panel</span>
        </div>
        <div class="settings-row">
          <label>ContextMenu key</label>
          <span class="settings-hint">Open context menu for current thumbnail</span>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Global Shortcuts</div>
        <div class="settings-row">
          <label>F</label>
          <span class="settings-hint">Calendar full-screen (Esc to exit)</span>
        </div>
        <div class="settings-row">
          <label>Shift + F</label>
          <span class="settings-hint">Trade table full-screen (Esc to exit)</span>
        </div>
        <div class="settings-row">
          <label>N</label>
          <span class="settings-hint">Open observation for latest trade date</span>
        </div>
        <div class="settings-row">
          <label>I</label>
          <span class="settings-hint">Open image gallery for latest date with images</span>
        </div>
        <div class="settings-row">
          <label>C</label>
          <span class="settings-hint">Switch to Consolidated calendar mode</span>
        </div>
        <div class="settings-row">
          <label>Shift + C</label>
          <span class="settings-hint">Switch to Individual calendar mode</span>
        </div>
        <div class="settings-row">
          <label>Drag tag chip</label>
          <span class="settings-hint">Move tag to another row (same column)</span>
        </div>
        <div class="settings-row">
          <label>Ctrl + Drag tag chip</label>
          <span class="settings-hint">Copy tag to another row (same column)</span>
        </div>
        <div class="settings-row">
          <label>Drag image thumb</label>
          <span class="settings-hint">Move image to another row</span>
        </div>
        <div class="settings-row">
          <label>Ctrl + Drag image</label>
          <span class="settings-hint">Copy image to another row</span>
        </div>
        <div class="settings-row">
          <label>Esc</label>
          <span class="settings-hint">Close any open modal / popup</span>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Page Layout</div>
        <div class="settings-hint" style="padding:2px 0 8px">Drag to reorder sections on the page</div>
        <div id="section-order-list" class="section-order-list">
          <div class="section-order-item" data-section="calendar" draggable="true"><span
              class="section-order-handle">&#8942;&#8942;</span> Calendar</div>
          <div class="section-order-item" data-section="dashboard" draggable="true"><span
              class="section-order-handle">&#8942;&#8942;</span> Monthly Summary</div>
          <div class="section-order-item" data-section="visual-dashboard" draggable="true"><span
              class="section-order-handle">&#8942;&#8942;</span> Visual Dashboard</div>
          <div class="section-order-item" data-section="table" draggable="true"><span
              class="section-order-handle">&#8942;&#8942;</span> Trade Table</div>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-title">Calendar — Show Heads Defaults</div>
        <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:6px">
          <label style="font-size:0.82rem;color:var(--text2)">Consolidated Mode</label>
          <div style="display:flex;gap:6px">
            <button class="btn btn-outline" id="s-heads-c-plonly" style="font-size:0.74rem;padding:3px 9px">P/L
              Only</button>
            <button class="btn btn-outline" id="s-heads-c-all" style="font-size:0.74rem;padding:3px 9px">Show
              All</button>
            <button class="btn btn-outline" id="s-heads-c-none" style="font-size:0.74rem;padding:3px 9px">Hide
              All</button>
          </div>
        </div>
        <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:6px;margin-top:8px">
          <label style="font-size:0.82rem;color:var(--text2)">Individual Mode</label>
          <div style="display:flex;gap:6px">
            <button class="btn btn-outline" id="s-heads-i-plonly" style="font-size:0.74rem;padding:3px 9px">P/L
              Only</button>
            <button class="btn btn-outline" id="s-heads-i-all" style="font-size:0.74rem;padding:3px 9px">Show
              All</button>
            <button class="btn btn-outline" id="s-heads-i-none" style="font-size:0.74rem;padding:3px 9px">Hide
              All</button>
          </div>
        </div>
      </div>

      <button class="btn btn-primary s-apply-btn" id="s-apply">Apply</button>
      <button class="btn btn-outline s-apply-btn" id="s-reset">Reset to Default</button>
    </div>
  </div>
</div>

<!-- ── OBSERVATION MODAL ───────────────────── -->
<div class="modal-overlay" id="obs-modal">
  <div class="modal-content obs-modal-content">

    <!-- Header: date + nav -->
    <div class="modal-header obs-modal-header">
      <div class="obs-date-nav">
        <button class="gallery-date-arrow" id="obs-date-prev" title="Previous">&#8249;</button>
        <span class="obs-modal-date" id="obs-modal-date"></span>
        <button class="gallery-date-arrow" id="obs-date-next" title="Next">&#8250;</button>
        <input type="date" id="obs-date-picker" class="gallery-date-picker" title="Jump to date" />
        <label class="obs-nav-toggle" title="Navigate only dates that have data">
          <input type="checkbox" id="obs-data-only" checked /> Data only
        </label>
      </div>
      <button class="close-btn" id="obs-close">&#10005;</button>
    </div>

    <!-- Toolbar row 1: text formatting -->
    <div class="obs-toolbar">
      <button class="obs-tool" data-cmd="bold" title="Bold"><b>B</b></button>
      <button class="obs-tool" data-cmd="italic" title="Italic"><i>I</i></button>
      <button class="obs-tool" data-cmd="underline" title="Underline"><u>U</u></button>
      <div class="obs-tool-sep"></div>
      <button class="obs-tool" data-cmd="formatBlock" data-val="h1" title="H1">H1</button>
      <button class="obs-tool" data-cmd="formatBlock" data-val="h2" title="H2">H2</button>
      <button class="obs-tool" data-cmd="formatBlock" data-val="h3" title="H3">H3</button>
      <button class="obs-tool" data-cmd="formatBlock" data-val="h4" title="H4">H4</button>
      <button class="obs-tool" data-cmd="formatBlock" data-val="h5" title="H5">H5</button>
      <button class="obs-tool" data-cmd="formatBlock" data-val="p" title="Normal">¶</button>
      <div class="obs-tool-sep"></div>
      <input type="number" id="obs-custom-size" class="obs-size-input" min="6" max="96" placeholder="px"
        title="Custom font size" />
      <button class="obs-tool" id="obs-apply-size" title="Apply size">A↕</button>
      <div class="obs-tool-sep"></div>
      <button class="obs-tool" data-cmd="insertUnorderedList" title="Bullet list">&#8226; List</button>
      <button class="obs-tool" data-cmd="insertOrderedList" title="Numbered list">1. List</button>
      <div class="obs-tool-sep"></div>
      <button class="obs-tool obs-color" data-cmd="foreColor" data-val="#3fb950" title="Green"
        style="color:#3fb950">&#9679;</button>
      <button class="obs-tool obs-color" data-cmd="foreColor" data-val="#f85149" title="Red"
        style="color:#f85149">&#9679;</button>
      <button class="obs-tool obs-color" data-cmd="foreColor" data-val="#58a6ff" title="Blue"
        style="color:#58a6ff">&#9679;</button>
      <button class="obs-tool obs-color" data-cmd="foreColor" data-val="#d29922" title="Orange"
        style="color:#d29922">&#9679;</button>
      <button class="obs-tool obs-color" data-cmd="foreColor" data-val="#bc8cff" title="Purple"
        style="color:#bc8cff">&#9679;</button>
      <div class="obs-tool-sep"></div>
      <button class="obs-tool" id="obs-insert-img" title="Insert image">&#128247;</button>
      <input type="file" id="obs-img-input" accept="image/*" style="display:none" />
      <button class="obs-tool" id="obs-insert-link" title="Insert link">&#128279;</button>
      <div class="obs-tool-sep"></div>
      <button class="obs-tool" data-cmd="removeFormat" title="Clear formatting">&#10005; Clear</button>
    </div>

    <div class="obs-editor" id="obs-editor" contenteditable="true" spellcheck="false"></div>

    <!-- Per-trade notes (auto-populated from Note column) -->
    <div id="obs-trade-notes" class="obs-trade-notes-wrap"></div>

    <div class="obs-footer">
      <button class="btn btn-outline" id="obs-cancel">Cancel</button>
      <button class="btn btn-primary" id="obs-save">&#10003; Save</button>
    </div>
  </div>
</div>

<!-- ── ADD COLUMN MODAL ────────────────────── -->
<div class="modal-overlay" id="add-col-modal">
  <div class="modal-content" style="width:360px">
    <div class="modal-header">
      <span>Add New Column</span>
      <button class="close-btn" id="add-col-close">&#10005;</button>
    </div>
    <div style="padding:16px">
      <input type="text" id="new-col-name" class="col-name-input" placeholder="Column name (e.g. Setup, Notes, RR)" />
    </div>
    <div class="upload-actions">
      <button class="btn btn-outline" id="add-col-cancel">Cancel</button>
      <button class="btn btn-primary" id="add-col-confirm">Add Column</button>
    </div>
  </div>
</div>

<!-- ── EDIT COLUMN MODAL ────────────────────── -->
<div class="modal-overlay" id="edit-col-modal">
  <div class="modal-content" style="width:380px">
    <div class="modal-header">
      <span>Edit Column Name</span>
      <button class="close-btn" id="edit-col-close">&#10005;</button>
    </div>
    <div style="padding:16px;display:flex;flex-direction:column;gap:10px">
      <select id="edit-col-select" class="select-box"></select>
      <input type="text" id="edit-col-name" class="col-name-input" placeholder="New column name" />
    </div>
    <div class="upload-actions">
      <button class="btn btn-outline" id="edit-col-delete">Delete Column</button>
      <button class="btn btn-outline" id="edit-col-cancel">Cancel</button>
      <button class="btn btn-primary" id="edit-col-confirm">Save Name</button>
    </div>
  </div>
</div>
```
