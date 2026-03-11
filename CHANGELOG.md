# 📖 Trading Journal - Update & Feature History (Changelog)
Here is a complete, date-wise breakdown of all the features, updates, and refactoring efforts recorded in your Git commit history.

## EOD Summary - March 10-11, 2026

### v2.7.0 — CSVLog: Schema-Driven Observation Modal

- **New: `routes/csvlog_routes.py`:** Blueprint with 4 routes — `GET /api/csvlog-schema`, `POST /api/csvlog-upload-schema`, `GET /api/csvlog-download-schema`, `GET /api/csvlog-export`. Registered in `app.py`.
- **New: `services/csvlog_service.py`:** `load_schema(path)` parses LOGGER.xlsx (Group/Head/Input/Type/Display columns), returns structured JSON with groups + fields. `export_csvlog_excel()` generates two-sheet workbook from trades + csvlog data.
- **New: `static/js/csvlog.js`:** Modal open/close, date navigation, Day overview tab (P/L cards + bar chart + trade table), per-trade group tabs (Zone/Entry/Exit/PSy), save/reset, schema upload prompt.
- **New: `static/js/csvlog-fields.js`:** Split from csvlog.js (30KB rule). Field constructors for Switch (Y/N toggle), Input (text), Dropdown (select), Range (slider), section separators. Obs popup, tag display.
- **New: `static/js/services/csvlogService.js`:** `getSchema()`, `uploadSchema()`, `exportCsvLog()` — no raw fetch() in modal code.
- **New: `static/css/style-csvlog.css`:** All CSVLog modal styles — Day tab, trade tabs, group tabs, field rows, switches, sliders, bar chart rows, info/tags panel.
- **`config.py`:** Added `CSVLOG_SCHEMA_FILE = data/csvlog_schema.xlsx`.
- **`data/csvlog_schema.xlsx`:** Initial schema with Zone/Entry/Exit/PSy groups and field definitions.
- **Ghost row fix:** CSVLog + Trade Logger now filter out day-header rows (empty instrument) from per-trade tab collection.
- **Dev blog:** Added March 10 entry documenting CSVLog evolution from Trade Logger → Trade Review → CSVLog, with BRD wireframe, challenge writeups, and screenshots.

---

## EOD Summary - March 07, 2026 (Session 2)

### v2.5.0 — Mobile Responsive
- **`static/css/style-mobile.css`:** New dedicated mobile stylesheet. Touch targets min 44×44px, iOS font-size fix, Trade Logger/Review full-screen (100vw×100vh), visual dashboard charts single-column, frozen table columns disabled on mobile.
- **Dropdown Bottom Sheets:** All `.dropdown-menu` elements become slide-up bottom sheets on mobile (`position:fixed`, `bottom:-105%→0`, `border-radius:16px 16px 0 0`, drag handle via `::before`, dim backdrop). Fixed `display:none` transition bug by keeping menus always `display:block` + `pointer-events:none` when hidden.
- **Calendar Abbreviations (`calendar.js`):** Added `_CAL_ABBR` map — Gross P&L→G, Net→N, Total Trades→T#, Charges→Ch, Win%→W%, etc. Cells now show short codes instead of full column names.
- **Chart Improvements (`visual-dashboard.js`):** Replaced all `toFixed(2)` with `Math.round()`. Added ApexCharts `responsive` breakpoint: single column, `tickAmount:5`, `height:200`, zeroed grid padding.
- **Date Range Clear Button Fix (`events-ui.js`):** Fixed ghost button bug — `style.display=''` was letting CSS `display:none` class win. Changed to explicit `'inline-flex'`.
- **Image Sync:** Restored 362 gitignored trade images to Render persistent disk via 76.6MB ZIP POST to `/api/import-json`.
- **Blog Sort Fix (`app.py`):** Sort now uses `(date, array_index)` descending so last-added post appears first within same-date group.
- **Blog Post:** Added v2.5.0 mobile responsive dev journal entry with 3 screenshots.

---

## EOD Summary - March 07, 2026 (Session 1)

### Features Added
- **EOD Automation Workflow:** Added a trigger-contract based EOD runbook in `Docs/EOD_AI_PROMPT.md` with mandatory execution order and final report format.
- **One-Command EOD Script:** Added `Scripts/EOD_OPTIMIZE.ps1` to run context validation, compact context generation, and shadow repo build in a single command.
- **Shadow Repo Builder:** Added `Scripts/build_shadow_repo.ps1` to generate `_shadow_repo` with high-signal project files and optional `data/trades.json` inclusion.
- **Cross-OS Setup Helpers:** Added `setup.sh`, `setup_windows.bat`, and `setup_windows.ps1` for faster environment setup across platforms.

### Refactor and Token Hygiene
- **`Scripts/generate_context.py` enhanced:** Added compact/full modes, changed-only generation from git status, dry-run support, configurable preview limits, and structured symbol extraction.
- **Compact context regenerated:** Refreshed `Docs/AI_Contexts/*_COMPACT.md`.
- **Shadow repo refreshed:** Rebuilt `_shadow_repo` using the new automation flow.

---

---

## 🌟 EOD Summary — March 06, 2026

### Features Added
- **Trade Review Popup (`trade-review.js`):** New full-screen trade review modal accessible via "📊 Review" toolbar button. Includes date navigation (← →), tabbed layout, dashboard stat boxes, setup fields, tag columnar view with scrollable columns, and rating sliders (vertical/horizontal layout modes). Trade data auto-loads for the selected date.
- **Trade Logger Modal (`trade-logger.js`):** New "📝 Logger" toolbar button opens a structured trade-entry form with tristate Yes/No/NA buttons, toggle switches, 4-column setup grid, and live validation highlighting. Includes Excel template export (`Trade_Logger_Fields_Template.xlsx`).
- **Active Tag Filter Banner:** Blue banner now appears above the table when a tag filter is active, showing filtered tag names and a "Clear Filter" button. Automatically hides when no filter is set.
- **Tag Filter Chip — Exclusive Mode:** Tag chips in table now support exclusive (click-to-filter) mode in addition to existing toggle behavior.
- **Gallery Ops improvements:** Context menu and group ops refactored; `gallery-ops.js` and `gallery-image-ops.js` updated with 70–125 line additions covering multi-select, move-to-trade, and image replace flows.

### EOD Refactoring (file size enforcement)
- **`style-misc.css` → split:** Trade Review + Trade Logger CSS (~863 lines) extracted to new `style-trade.css` (15KB). `style-misc.css` now 21KB.
- **`gallery-ops.js` → split:** Group ops (delete confirm, expand/collapse, move-selected) extracted to `gallery-ops-group.js` (12.7KB). Main file now 21KB.
- **`visual-dashboard.js` → split:** Stats cards, drag/drop, chart-width controls extracted to `visual-dashboard-stats.js` (12.6KB). Main file now 24.2KB.
- **`generate_context.py` updated:** Tracks 5 new files across 4 new context MDs (`AI_CONTEXT_CSS_TRADE`, `AI_CONTEXT_JS_TRADE_REVIEW`, `AI_CONTEXT_JS_TRADE_LOGGER`, `AI_CONTEXT_JS_VISUAL_DASHBOARD_STATS`, `AI_CONTEXT_JS_GALLERY_OPS_GROUP`). All context MDs ≤ 28.8KB.
- **`index.html` updated:** Added `<link>` for `style-trade.css` and `<script>` tags for `gallery-ops-group.js`, `visual-dashboard-stats.js`.

---

## 🌟 Version 2.3.0 (Gallery UX: Separators, Close Images & Time Stamps)
**Date:** `March 05, 2026`
- **Separator Click-to-Select:** Clicking any gallery separator (OPEN, Trade 1/2/3, CLOSE) now highlights it in blue and sets it as the active upload target. Subsequent paste/upload operations send images directly into that separator's section.
- **Close Images Support:** Added `dayData.closeImages[]` — a dedicated slot for EOD close-of-day screenshots, rendered after all trades in the gallery with its own CLOSE separator.
- **Image Time Display:** New toggle button in gallery toolbar — when active, each thumbnail shows the file's capture time (via OS file `mtime`). Backend route `/api/image-times` added to `app.py` to serve timestamps.
- **Upload via Separator Context:** `events-settings.js` and `events.js` updated — upload modal now checks `state.gallery.selectedSeparator` before falling back to old upload logic, ensuring images land in the correct trade/day slot.
- **Project Folder Restructure:** Reorganized root-level files — AI Context MDs moved to `Docs/AI_Contexts/`, `generate_context.py` moved to `Scripts/`, EOD files moved to `Docs/`. No functionality changes.
- **JSDoc @fileoverview Headers:** Added `@fileoverview` and `@description` JSDoc blocks to all JS modules for better AI context parsing.
- **CSS: Selected Separator Style:** Added `.selected-separator` class — blue glow/border highlight for the clicked separator.

---

## 🚀 Version 2.2.1 (Dashboards & Filtering UI)
**Date:** `March 05, 2026`
- **Global Date Filtering:** Swapped out component-level date pickers for one unified, global Date Range filter integrated into the main application navigation header.
- **Visual Dashboard Upgrade:** Completely transformed the static chart metrics to interactive cards. Added dynamic selection dropdowns to toggle between Area, Bar, and Line interpretations on-the-fly.
- **Layout Elasticity:** Injected Width selectors allowing cards to dynamically span `1/3`, `1/2`, `2/3`, or `Full` grid sizes.
- **Customizable Sorting:** Applied Drag-and-Drop methodology to Visual Dashboard tiles—empowering full re-arrangement and custom stat-prioritization mappings alongside a visibility menu to hide/show metrics.


## 🚀 Version 2.2.0 (Latest Update)
**Date:** `March 04, 2026`
- **Windows File Explorer Paste:** Rewrote the entire clipboard backend utilizing the `win32clipboard` and `CF_HDROP` memory structures. The gallery's "Copy Image" context menu now successfully copies the *actual image file* directly to your computer's system clipboard, enabling seamless native `Ctrl + V` pasting directly into Windows Explorer directories. 
- **Dynamic Trade Separators (Dropzones):** Gallery thumbnail dock separators were entirely visually revamped. Rather than simple lines, they prominently display "Trade 1", "Trade 2", etc., automatically separating dates. 
- **Interactive Reorganization:** These separators now double as interactive drag-and-drop zones, effortlessly allowing you to drag images from one thumbnail block and drop them onto a separator to instantly migrate them to that specific trade block.
- **EOD Architecture Refactor:** Abstracted the heavily mathematical `renderGalleryStats()` method out of the 600-line `gallery-render.js` and into its own independent `gallery-stats.js` module. Regenerated the entire AI Context memory map.

---

## 🧠 Version 2.1.0 (Context Mapping Engine)
**Date:** `March 02, 2026`
- **AI Brain Restructure:** Totally revamped how the AI reads your codebase context. Split massive tracking files into 29 razor-focused `.md` context maps, strictly ensuring no generated file exceeds 30KB.
- **CSS Modularity:** Split up and distributed giant CSS files into a tighter modular architecture.

---

## 🛠️ Version 2.0.0 (The Great JS Refactor)
**Date:** `February 28, 2026`
- **Component Based JS:** The monolithic `app.js` file was finally deconstructed. Logic was split out into 13 uniquely dedicated JavaScript modules defining responsibilities strictly by domain (e.g., gallery, annotation, settings, table rendering, I/O state). This permanently solved the file scale and API rate-limiting issues.

---

## 📱 Version 1.5.3 (UX & Mobile Polish)
**Date:** `February 28, 2026`
- **iPad Compatibility:** Fixed major mobile touch interactions. Corrected the iPad swipe mechanics for navigating the gallery, solved thumbnail tap registration issues, and enforced proper body scroll-locking during active modal displays to prevent background shifting.

---

## 🏷️ Version 1.5.2 (Tagging Enhancements)
**Date:** `February 28, 2026`
- **Marquee Annotations UX:** Fleshed out the user experience for applying tag constraints via Marquee annotation selections. 
- **Tag Synchronization:** Fixed major synchronization gaps between image-level tags and globally accessible Table tags. 
- **Filter Fixes:** Repaired bugs relating to the gallery interacting with the tag filtering system.

---

## 📁 Version 1.5.1
**Date:** `February 27, 2026`
- **Data Initialization:** First commits backing up fundamental data architectures, user upload paths, local data directories, and other supporting app dependencies to the repo.

---

## 🖍️ Version 1.5.0 (Advanced Visual Tooling)
**Date:** `February 27, 2026`
- **Pro Annotations Engine:** Introduced an entire suite of robust advanced gallery annotation visual tools alongside deep tagging features and custom drawing workflows.

---

## 📈 Version 1.4.0 (Consolidated Metrics & Broker Intel)
**Date:** `February 26, 2026`
- **Deep Dashboard Additions:** Injected crucial metadata handling like broker-specific charges tracking and `fill_count` algorithms.
- **UI Flexibility:** Enabled the ability to physically drag the dashboard summary cards around to rearrange them.
- **Consolidated UI Insights:** Drastically improved visual metric rendering and layout inside the Consolidated View paradigm.

---

## 🗓️ Version 1.3.0 (Calendar Controls)
**Date:** `February 26, 2026`
- **Calendar UX:** Implemented brand new User Experience control interfaces for the primary Calendar UI and Trade tables.
- **Date Grouping Settings:** Created the ability to adjust date-group styling via settings configs.

---

## 🔄 Version 1.2.0 (Server Sync)
**Date:** `February 26, 2026`
- **Cross-Device Updates:** Established an automated server synchronization pipeline. Trading journaling edits/entries made via one device are instantly broadcasted/updated on other connected devices automatically.

---

## 📥 Version 1.1.0 (CSV Automation & Deploy)
**Date:** `February 26, 2026`
- **Data Imports:** Designed and implemented multi-broker/merged structural CSV automated importing pipelines to map broker logs cleanly into the UI.
- **Deploy Workflows:** Packaged the whole system configuration into a shareable deployment state.

---

## 🏁 Version 1.0.0 (Genesis Release)
**Date:** `February 26, 2026`
- **Initial Backup & Inception:** The foundational framework elements. The core calendar interface tied tightly with the core Trade tables alongside the earliest version of the interactive gallery and core tagging mechanics.
D a s h b o a r d   T o o l t i p   F i x e d ,   C o n s o l i d a t e   c o n t e x t   m e n u   i m p l e m e n t e d ,   p l a c e h o l d e r   p r o m p t   i m p l e m e n t e d  
 A d d e d   I n d i v i d u a l   /   C o n s o l i d a t e d   m o d e s   p e r   c h a r t ,   w i t h   d r o p - d o w n s   i n   c h a r t   h e a d e r s .  
 
