# 📖 Trading Journal - Update & Feature History (Changelog)
Here is a complete, date-wise breakdown of all the features, updates, and refactoring efforts recorded in your Git commit history.

## EOD Summary - April 09, 2026

### v3.x — Gallery Tray iPad Fixes + Close-Global-Tray UX Polish

**Close-Global-Tray — Position Persistence Fix:**
- `_tEndDrag`: now commits `translate3d` offset back into `left/top` via `getBoundingClientRect()` and resets transform to zero — tray no longer jumps back to old position after swipe/navigation
- `localStorage` always saves the true final pixel position

**Close-Global-Tray — Context-Aware Direction (iPad fix):**
- SNAP threshold increased `80 → 120px` for easier triggering
- Direction detection now uses both cursor position AND tray midpoint (`getBoundingClientRect`) — previously only cursor was checked which was unreliable on iPad touch
- Tray switches to `column` (vertical) near thumbnail panel left edge or right screen edge; stays `row` (horizontal) in center

**Gallery Tray — Trade Pill Restored:**
- `renderGalleryTradePill()`: removed dependency on missing `gv2-active-trade-bar` element that caused early return (pill was invisible)
- T-badge rendered as solid colored circle (green/red by P&L), e.g. `T3, ₹461, 4 Pt`

**P&L Dropdown Fixes:**
- Removed `pill.onclick` that caused double-toggle (was firing before and after the event listener)
- Dropdown moved to `document.body` to escape parent container clipping
- Active trade marked with blue dot indicator in dropdown rows
- 7-column grid layout for cleaner trade list alignment

**PWA / Fullscreen (iPad):**
- Added `apple-mobile-web-app-capable` meta tags for home screen fullscreen mode
- Added `⛶` fullscreen toggle button via `requestFullscreen()` API

## EOD Summary - April 01, 2026

### v3.0.3 — Target Tracker Weekly View + Module Split

**Weekly Performance Breakdown (Target Tracker):**
- New "Weekly Target" tab added to Target Tracker modal
- Weekly progress bars with actual vs target P&L per week, color-coded by pacing %
- Monthly total bar at bottom with full-month pacing %
- Hover tooltip on weekly rows: shows trades, avg duration, tax, avg pts
- Metric comparison chart (SVG bar chart) with toggles: Points / Avg Pt / Trades / Tax / Avg Duration
- Chart type toggles: BAR (week comparison) and BELL (trade distribution histogram)
- Aggregation mode toggles: TOTAL / AVG

**Target Tracker Enhancements:**
- `getMonthlyPerformance()` now collects per-day: tradeCount, points, fees, duration (via Buy/Sell Time)
- `getAvailableDates()` now also includes dayData dates and uses `extractDateFromTrade` helper
- Date counter + nav arrows (prev/next day) now disabled correctly at boundaries
- Monthly chart tooltip: shared `tt-chart-tooltip` element, hidden on chart type switch
- Monthly chart: improved SVG styling (drop-shadow filter, thinner expected line)
- Net total color in Numbers tab changed to neutral `var(--text2)`

**Module Split (30KB enforcement):**
- `target-tracker.js` (87KB) split into 5 focused modules:
  - `target-tracker-data.js` — state vars + pure data functions
  - `target-tracker-monthly.js` — `renderTtMonthlySection()` (monthly tab + chart)
  - `target-tracker-weekly.js` — `renderTtWeeklyView()` + bell curve + comparison chart + tooltip helpers
  - `target-tracker.js` — `renderTargetTracker()` core orchestrator (Numbers + Daily tabs)
  - `target-tracker-init.js` — `showTargetTrackerModal()` + DOMContentLoaded bindings
- `modals.html` (57.6KB) split into 3 Jinja2 includes:
  - `modals.html` — Settings + Observation + Stats Config
  - `modals-ohlc.html` — Add Column + OHLC Manager + Edit Column
  - `modals-target-tracker.html` — Target Tracker Modal (full)
- Also fixed: `diff` variable undefined in weekly tooltip (now correctly set to `actual - target`)

**Outstanding (needs future split):**
- `gallery-render.js` still 37.7KB (not touched today)
- `style-misc.css` still 30.2KB (not touched today)

## EOD Summary - March 25, 2026

### v3.0.2 — Tag Images, Gallery Sync, OHLC Manager UI, Stash Restore

**Tag Images Feature:**
- Tags can now have images assigned (uploaded or drawn pattern canvas)
- Tag chips in gallery show thumbnail of assigned image
- New routes: `/api/upload-tag-image`, `/api/delete-tag-image`
- `state.tagImages` added to state for image-URL mapping per tag

**Gallery Enhancements:**
- Recording tools toolbar relocated to tray with toggle button (localStorage persisted)
- Popout button: opens current image in new window via share-link URL params
- Trades panel: Gain/Loss filter dropdown added
- Filter mode: Ctrl+Click on thumbnail expands/collapses all images for that trade
- `gallery-sync.js`: cross-window gallery sync (multi-monitor support)

**OHLC Manager UI:**
- New modal: `/static/js/ohlc-manager.js` + `style-ohlc-manager.css`
- OHLC button added to profile menu
- Tradebook CSV import, instrument status table, sync log

**OHLC Backend:**
- `whatif_routes.py`: EXP_ cache fallback check for expired options in status/sync endpoints

**Stash Restore + Bug Fixes (2026-03-25):**
- Fixed: `events-gallery.js` crash — `gv2-tc-mode-btn` null addEventListener (added `?.`)
- Fixed: `gallery-image-tags` div was relocated to top-tags-band (overlapped thumbnails) → moved back inside `gv2-img-area`
- Fixed: `gallery-heads-display` had `display:none` removed to restore trade stats bar
- Setup: `auto_git_backup.ps1` + Windows Task Scheduler every 2 hours

## EOD Summary - March 24, 2026

### Gallery Filter Mode — Multi-Date Fix
- **Root fix**: `getOwnerTradeForImageUrl` was returning `null` for images from dates other than `state.gallery.date`, causing all cross-date images to land under OPEN separator
- **Fix**: In filter mode, use `sourceRow` from `_filteredMeta` directly instead of calling `getOwnerTradeForImageUrl`
- **Fix**: `applyGalleryImageScopeByTagFilter()` (no args) now auto-preserves current context instead of resetting to index 0
- **Fix**: Per-date separator rendering — OPEN/T1/T2/T3/CLOSE now rendered per date in filter mode
- **Fix**: Empty trade separators suppressed — only render separator if that trade has matching filter images
- **Feature**: Date label (e.g. "Mar 20 Fri") shown on trade separators in filter mode
- **Feature**: `Vid` button moved to sidebar below filter-tags button
- **Feature**: Admin API key endpoint `/api/admin/push-data` for live data sync without login
- **Split**: `gallery.html` → `gallery.html` + `gallery-modals.html` (30KB rule)
- **Split**: `style-gallery-b.css` → split into `b` + `d` (30KB rule)

## EOD Summary - March 23, 2026

### v3.0.0 — What-If Simulator + Dhan OHLC Integration

**What-If Simulator (new `/whatif` page):**
- Full trade simulation engine: given fixed Target/SL pts (and optional trailing trigger), replays each trade forward candle-by-candle from entry time with no hindsight bias.
- Supports 1/2/3/4/5 min timeframes via resample on 1-min OHLC cache.
- Direction auto-detected from TradeType (sell=SHORT, buy=LONG) or overridden per-run.
- Computes: actual PnL, planned PnL, missed PnL (opportunity cost), MFE, MAE, efficiency%, exit reason (target/sl/trail_sl/eod).
- Trail SL: move SL to break-even when price moves `trail_trigger_pts` in your favour.
- Exit order: SL checked before target within same candle (pessimistic/realistic).
- OHLC sanity check: warns if first candle open is >20% away from entry (wrong strike).
- Summary stats: total trades, actual/planned/missed PnL, avg efficiency, target/sl/trail_sl/eod exit counts, no-OHLC count.

**Dhan API Integration (new `services/dhan_service.py` + `dhan_service_core.py`):**
- Credential storage: client_id + access_token saved to `data/dhan_config.json` (token masked in UI).
- Scrip master: download from Dhan CDN, fuzzy column-name search (handles API version differences).
- Symbol auto-mapper: parses NSE symbols in Zerodha monthly/weekly format, Dhan space format, and futures. Auto-saves high-confidence (≥70%) matches to `data/dhan_symbol_map.json`.
- Expired options via `/v2/charts/rollingoption`: fetches ATM±N OHLC without needing security_id. Entry time used to pick correct ATM strike.
- Historical + intraday OHLC endpoints, CSV cache in `data/ohlc_cache/`, with auto-fill for partial days.
- OHLC status endpoint: reports missing/partial/complete per (symbol, date).

**New backend files:**
- `routes/whatif_routes.py` — blueprint with 10 routes (config, scrip, symbol-map, auto-map, OHLC status/fetch/data/chart, simulation run)
- `services/dhan_service_core.py` — config, scrip, symbol-map, NSE parser (split from dhan_service for 30KB rule)
- `services/dhan_service.py` — expired options, auto-mapper, OHLC cache + fetch
- `services/whatif_service.py` — simulation engine (no Flask, pure data transform)
- `config.py` — added OHLC_CACHE_DIR, DHAN_CONFIG_FILE, DHAN_SYMBOL_MAP_FILE, DHAN_SCRIP_MASTER

**Gallery separator improvements:**
- Trade separator (`T1`, `T2`…) now shows P&L + Pt as styled `<span>` elements with color coding.
- OPEN/CLOSE separators use `<span class="gv2-sep-label">` for consistent styling.
- Clicking a separator now toggles `state.gallery.selectedSeparator` so upload button targets correct trade/OPEN/CLOSE.

**Gallery events improvements:**
- Ctrl+drag scroll rate-limited with `requestAnimationFrame`.
- Select/deselect logic improved for ctrl+drag in gallery.
- Fullscreen button in gallery modal: clicking toggles `requestFullscreen`/`exitFullscreen`.
- Thumb panel resize: max width increased from 160 to 800px.
- Panel width restored from localStorage on init.

**30KB rule splits (EOD):**
- `events-gallery.js` (33.6KB) → `events-gallery.js` + `events-gallery-b.js` (trades panel extracted).
- `gallery-render.js` (31.7KB) → `gallery-render-b.js` (video blob cache) + `gallery-render.js`.
- `services/dhan_service.py` (33.6KB) → `dhan_service_core.py` + `dhan_service.py`.

## EOD Summary - March 18, 2026

### v2.9.9 — Gallery SVG Icons, Colored Sidebar, Fullscreen Fixes, Video Cleanup

- **Gallery sidebar SVG icons:** Replaced emoji/unicode buttons (🏷️, ⊞, ✤, ⬆, 👁, 🏭, ⋮) with proper inline SVG icons — tag, grid, layers, upload, eye, filter, three-dot.
- **Per-icon colors with hover glow:** Each sidebar icon has its own CSS variable color (blue, cyan, green, purple, orange, teal, grey). Hover triggers subtle `text-shadow` glow matching the icon color.
- **Active state neutral:** `.gv2-sb-btn.active` changed from always-blue (`rgba(88,166,255,0.15)`) to neutral white tint — works with any icon color.
- **Dark glass dropdown polish:** `.dropdown-menu` now has frosted glass background (`backdrop-filter: blur(15px)`), dark border, large border-radius, subtle box-shadow. Each dropdown item (download, replace, add, copy, share, mark review, marquee, time, tag, obs, delete) gets its own icon color with glow-on-hover.
- **Arrow keys → FullscreenViewer:** When fullscreen viewer is open (`#fullscreen-viewer` display=flex), arrow keys (←→↑↓) now route to `FullscreenViewer.prevImg/nextImg/prevDay/nextDay` instead of gallery navigation.
- **F key → locked fullscreen:** `openFullscreenFromAppContext` now accepts `startLocked=true`. F key passes this — fullscreen opens directly in locked mode.
- **`startLocked` param in FullscreenViewer.open():** `open(daysData, startDayIdx, startImgIdx, startLocked)` — viewer initialises `isLocked` from param instead of always `false`.
- **Info bar simplified:** Removed date from the inline info text — now shows `T1 · 2/5` only (date is already in the tray).
- **Instrument name removed from dropdowns:** P&L dropdown rows and trade dropdown rows no longer show instrument name — cleaner.
- **Video/audio cleanup on delete:** `removeGalleryImageAt` now deletes associated `videos` and `audios` entries when an image is removed. Batch delete also cleans video/audio by URL or reverse-key lookup.
- **`isTradeItem` helper:** `getOwnerTradeForImageUrl` now checks `t.videos` object values in addition to `t.images` and `t.subImages` — video-linked images resolve correctly.
- **Gallery picker — inline open:** "New" gallery layout no longer opens in a new tab with URL params; calls `openGalleryForDate()` directly (same-page, no tab switch).
- **Left panel + settings tray resize — viewport-aware:** Max resize width is now `min(480, window.innerWidth * 0.45)` instead of hardcoded `400`/`480` — respects narrow screens.
- **gallery-image-ops.js split (30KB rule):** File was 30.5KB → split into `gallery-image-ops.js` (core: getOwner, syncOrder, reorder, move, undo, remove) + `gallery-image-ops-b.js` (batch: handleReorderBatch, handleDropAsSubImage). Both added to `index.html` load order.

## EOD Summary - March 17, 2026

### v2.9.8 — F-Key Fullscreen Viewer: Trading Tray Redesign

- **Dark overlay bug fixed:** Canvas shown before async overlay loaded caused stale/black content. Fix: `canvas.style.display = 'none'` by default, shown only after `clearRect` + draw inside load callback.
- **Fullscreen viewer (F key) — complete UI redesign:** Replaced Instagram-style header (title, profile images, likes, comments, follow button, caption, comment input) with a trading tray identical to the mobile app. New layout: `←` back | P&L pill | Trade pill | 📅 date | [spacer] | 🔓 lock. All centred, back and lock buttons pinned to edges.
- **Tray always visible on open:** `uiVisible` now starts as `true`. Click anywhere on image to toggle tray hide/show. Clicking header/buttons excluded from toggle.
- **P&L pill → dropdown:** Clicking total P&L pill opens a dropdown with one row per trade (T1, T2…). Clicking any row navigates to that trade's first image. Active trade highlighted.
- **Trade pill — instrument removed:** Shows `T1 · ±₹X,XXX` only — no instrument name cluttering the tray.
- **Trade pill → dropdown:** Shows individual images in the current trade; clicking navigates directly to that image.
- **Date label → calendar picker:** Clicking the date label calls `showPicker()` on the hidden date input. Selecting a date jumps the viewer.
- **CSS split: style-gallery-c.css:** `style-gallery-b.css` exceeded 30 KB; split at `/* AUDIO BAR */` section. New file `style-gallery-c.css` added and linked in `index.html`.
- **Gallery tray — floating overlay:** `.gv2-tray` changed to `position: absolute` with frosted-glass background (`rgba(0,0,0,0.55)` + `backdrop-filter: blur(6px)`). Tray floats over image; `.gv2-body` uses full height.
- **Tray layout — mobile parity:** Back arrow, thumbnails toggle, P&L pill, trade pill, date arrows, date label, counter — all in `.gv2-tray-left`. Counter format: `N / Total`.

### v2.9.7 — Mobile Bug Blitz + Stats→Viewer Navigation + Feed Slider

- **Critical z-index bug fixed (all 5 overlays):** Bottom sheets (filter, menu, chart picker, day detail, tile picker) were trapped behind BottomNav. Root cause: framer-motion `transform` on the page-transition `<motion.div>` creates a permanent stacking context — any `position: fixed` inside is relative to that context (z=10), so BottomNav (z=50 at root) always wins. Fix: all overlays now use `createPortal(<AnimatePresence>...</AnimatePresence>, document.body)` — renders directly into body, bypasses stacking context entirely.
- **Feed P&L filter — dual range slider:** Replaced two number input boxes with a styled dual-range slider. Two overlapping `<input type="range">` with CSS thumb pointer-events and an indigo fill track. Max derived from actual data (`maxDayAmt`). Compact, touch-friendly.
- **Stats W/L combined tile:** Merged separate "Win Rate" tile into a single W/L tile showing wins / losses with win rate % below. Cleaner at a glance.
- **Stats day detail — swipe + nav arrows:** Day detail sheet is now swipeable left/right (`drag="x"`) to jump between trading days. Added ‹ › arrows in the header. Trade list reformatted: `T# | Lot | P&L | Running Total` grid (no instrument name, running cumulative total per row).
- **Stats trade row → viewer:** Tapping any trade row in the day detail sheet opens the fullscreen image viewer at that exact trade. Swipe back returns to day detail. `openViewer` prop wired from `App.tsx` → `DashboardView`.
- **Blog: date instead of version in dropdown/badge:** Dropdown and entry badge now show `display_date` (e.g. "March 9") instead of version string. `page_routes.py` formats as `strftime('%B') + day` (no leading zero, no year).
- **Fullscreen viewer header redesign:** Day total pill (green/red) shown LEFT of date badge. O/T1/C trade labels in header are clickable to switch trades; hidden if pnl=0. Non-locked nav: dedicated "Nav" button in sidebar toggles ↑←→↓ arrows + zoom slider without entering locked mode.

## EOD Summary - March 14, 2026

### v2.9.4 — Mobile Fullscreen UX: Gestures, Per-Trade Count, Landscape Lock

- **Per-trade image count:** `FeedView.tsx` now builds `allTradeItems` flat list (one entry per trade, cross-date). Passed to each `DayFeedCard`. Image onClick now finds clicked URL in `allTradeItems` — fullscreen opens at exact trade+image. Old behaviour clubbed all trades of a day into T1 showing 1/24; now T1: 1/12, T2: 1/7, T3: 1/5.
- **Next at trade boundary:** At last image of T1, pressing next goes to T2 of same date. Added `nextItem`/`prevItem` functions that traverse adjacent `dayIdx` regardless of date.
- **Up/down = date jump:** `nextDay`/`prevDay` skip same-date items and jump to a different calendar date.
- **Navigation layout rebuilt:** Left/right arrows on screen sides (image navigation), up/down circles at bottom corners (date navigation). Removed centre-clustered old layout.
- **Buttons fixed to screen:** Moved all 4 nav buttons + zoom slider outside the draggable `motion.div` into the `fixed inset-0` parent — buttons no longer move when image is dragged/panned.
- **Orientation lock:** Lock button → `requestFullscreen().then(() => orientation.lock('landscape'))`. Unlock → `orientation.unlock()` + `exitFullscreen()`. Portrait/landscape toggle works correctly.
- **Image click opens locked landscape:** `openViewer` accepts optional 4th param `locked=true`. `DayFeedCard` passes `true` from image click. `FullscreenViewer` triggers fullscreen+landscape on open when `initialLocked=true`.
- **Date picker on header:** Tapping date in fullscreen header opens native `<input type="date">` picker; selecting a date jumps viewer to that date.
- **Removed "Trade View" title:** Header is cleaner — only date + trade/image badge remain.
- **Flask fullscreen viewer:** Also updated `static/js/fullscreen-viewer.js` and `static/css/style-fullscreen.css` for same navigation layout (desktop app parity).
- **Dev blog post added:** `v2.9.4: Mobile Fullscreen UX — Gestures, Per-Trade Count, Landscape Lock`.

## EOD Summary - March 13, 2026

### v2.9.3 — Mobile View + Strategy Session

- **Mobile view embedded in Flask:** Tradefeed React app now served at `/mobile/` route directly from Flask — no separate deployment needed. Same `/api/trades` backend, same data.
- **Header 📱 button:** Clicking navigates to `/mobile/`. Bottom nav in mobile has Desktop button back to `/`.
- **CORS fix:** `tradefeed/.env` had `VITE_API_URL=http://192.168.29.200:5000` hardcoded — caused CORS block when credentials mode is `include`. Fixed to empty (relative URLs).
- **dayData images in gallery:** Mobile gallery now also shows images attached to day notes (not just trade images).
- **tradefeed/dist committed to git:** Render.com Python service has no npm — pre-built dist ships with code. `tradefeed/.gitignore` updated to track dist.
- **Standalone tradefeed service removed:** render.yaml cleaned up — only `code2-calender` Flask service remains.
- **Strategy decisions documented:** AI model task division, scaling plan (Supabase free → paid at 100 users), pricing (Rs 499/month), CAC/LTV analysis — all saved to memory and dev blog.
- **Dev blog post added:** `v2.9.3: Mobile + Desktop Strategy, Ek App Do Duniya`.

### v2.9.2 — Cloudinary Live Images: Full Debug & Structural Fix

- **Root cause found:** Per-user data file system (`trades_1.json` for user ID 1) was never migrated to Cloudinary — migration script only processed `trades.json`. All 204 local `/uploads/` paths in `trades_1.json` replaced with Cloudinary CDN URLs using existing `cloudinary_migration_map.json`.
- **JS fix:** 12 locally-modified JS files (including fixed `resolveImageUrl` in `state.js`) were uncommitted — old server version caused `/uploads//uploads/UUID.png` double-prefix 404s. All files committed and deployed.
- **`migrate_images_to_cloudinary.py`:** Now auto-discovers and processes ALL `data/trades*.json` files (including per-user `trades_N.json`). No user will be missed on future migrations.
- **`/api/debug-data`:** Now uses `get_user_data_file()` — shows actual file for the logged-in user, plus Cloudinary vs local image counts. Previously was reading the wrong file entirely.
- **`_bootstrap_persistent_storage()`:** `FORCE_DATA_REFRESH=1` now also copies all per-user `trades_N.json` files to the persistent disk, not just `trades.json`.
- **Scripts hygiene:** Fixed hardcoded local Windows paths in `Scripts/clean_dead_images.py` and `Scripts/fix_image_arrays.py` to use `BASE_DIR`-relative paths. Added `.gitignore` entries for backup files and temp root scripts.
- **Dev blog:** Added post `v2.9.2: The 4-Hour Image Debug War` documenting all three walls and structural fixes.

## EOD Summary - March 12, 2026

### v2.9.0 â€” Quotes + CSVLog Charts Workspace

- **New: `static/js/quotes.js`:** Added Daily Quotes modal with left/right quote carousel, font size controls, rating slider, CSV import/export, per-session random popup timer, and quote formatting after commas.
- **New: Quote UI wiring:** Added Quote and Quote Pop entry points in `templates/index.html`, modal markup in `templates/modals.html`, and modal state bindings in `static/js/events-ui.js`, `static/js/events-keys.js`, `static/js/data.js`.
- **Quote styling pass:** Updated `static/css/style-misc.css` and `static/css/style-mobile.css` for compact quote chips, popup controls, mobile-safe layout, and smaller header controls.
- **New: `static/js/csvlog-charts.js`:** Added Logger Charts modal for CSVLog data with Sliders, Options, and Y/N analytics views.
- **Logger Charts sliders:** Added compact/detailed modes, top tabs for focused slider fields, expand-per-date rows, date totals column, per-trade totals, date formatting (`Mar 12`), and resizable table columns.
- **Logger Charts options/YN:** Added `View 1 / View 2` alternate grouped layouts while keeping positive/negative click-through popup filtering.
- **New helper modules:** Added `static/js/csvlog-vitals.js` and `static/js/csvlog-placeholder.js` for CSVLog modularization and future expansion stubs.
- **Template/script integration:** Registered new CSVLog/Quotes scripts in `templates/index.html` and surfaced the Logger Charts toolbar action from `static/js/events-ui.js`.
- **EOD hygiene:** Regenerated compact AI contexts, rebuilt `_shadow_repo`, and refreshed changelog/dev memory.

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
D a s h b o a r d   T o o l t i p   F i x e d ,   C o n s o l i d a t e   c o n t e x t   m e n u   i m p l e m e n t e d ,   p l a c e h o l d e r   p r o m p t   i m p l e m e n t e d 
 
 A d d e d   I n d i v i d u a l   /   C o n s o l i d a t e d   m o d e s   p e r   c h a r t ,   w i t h   d r o p - d o w n s   i n   c h a r t   h e a d e r s . 
 
 
