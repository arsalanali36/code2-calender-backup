# Memory Logs - Update History
Consolidated code context for AI assistants.


## File: `Docs/Update_History.txt`
```txt
Trading Journal - Update & Feature History (Changelog)
======================================================
Here is a complete, date-wise breakdown of all the features, updates, and refactoring efforts recorded in your Git commit history.

TODAY'S END OF DAY SUMMARY (March 12, 2026):
- Quotes Modal: Added Daily Quotes popup with CSV import/export, random auto-popup session timer, font resize, rating slider, and compact quote display.
- CSVLog Charts: Added Logger Charts modal with Sliders, Options, and Y/N analytics from CSVLog schema data.
- Slider Analytics Upgrade: Added compact/detailed slider views, focused top tabs, per-date expand rows, totals column, per-trade amount rows, short date formatting, and resizable columns.
- Alternate Non-Slider Views: Added View 1 / View 2 layouts for Options and Y/N grouped summaries.
- Context + EOD Sync: Regenerated compact AI contexts, rebuilt shadow repo, and refreshed dev logs.

------------------------------------------------------

TODAY'S END OF DAY SUMMARY (March 07, 2026):
- EOD Runbook: Added trigger-contract workflow in `Docs/EOD_AI_PROMPT.md` for automatic end-of-day execution.
- One-Command EOD: Added `Scripts/EOD_OPTIMIZE.ps1` to run validation, compact context generation, and shadow-repo build.
- Shadow Repo Automation: Added `Scripts/build_shadow_repo.ps1` with optional `-IncludeData` support.
- Context Generator Upgrade: `Scripts/generate_context.py` now supports compact/full modes, changed-only, suffix output, and dry-run.
- Setup Helpers: Added `setup.sh`, `setup_windows.bat`, and `setup_windows.ps1`.

------------------------------------------------------

🌟 TODAY'S END OF DAY SUMMARY (March 05, 2026):
- Global Navigation: Implemented a central "Date Range" limit picker over the whole app.
- Visual Charts UI: Tiles now support Area, Bar, and Line interpretations on-the-fly via Select.
- Dashboard Drag/Drop: Metrics and charts can be physically reorganized on visual dashboard layouts.
- Dynamic Span: Charts can now stretch and shrink grid spans (1/3, 1/2, 2/3, Full Size).

------------------------------------------------------

--- 🚀 Version 2.2.0 ---
📅 Date: March 04, 2026
📋 Explorer Paste: `win32clipboard` integration allows copying actual image files to Windows via `Ctrl + V`.
🎯 Dynamic Dropzones: Gallery separators now show Trade Numbers and act as drag-and-drop zones for sorting.
⚙️ EOD Refactor: Moved `renderGalleryStats()` to a new `gallery-stats.js` module; updated AI Context maps.
🎯 Dynamic Dropzones: Gallery separators now show Trade Numbers and act as drag-and-drop zones for sorting.
⚙️ EOD Refactor: Moved `renderGalleryStats()` to a new `gallery-stats.js` module; updated AI Context maps.

--- 🧠 Version 2.1.0 ---
📅 Date: March 02, 2026
🗺️ AI Brain Reset: Split massive AI Context into 29 smaller `.md` files (all under 30KB).
🧩 CSS Modularity: Broke giant CSS files down into smaller, focused modules.

--- 🛠️ Version 2.0.0 ---
📅 Date: February 28, 2026
🧱 JS Refactor: Dismantled monolithic `app.js` into 13 unique Javascript modules.

--- 📱 Version 1.5.3 ---
📅 Date: February 28, 2026
📱 Mobile Polish: Fixed iPad swiping, thumbnail tapping, and background scrolling.

--- 🏷️ Version 1.5.2 ---
📅 Date: February 28, 2026
🔲 Tagging Enhancements: Improved marquee tag UX and synced image tags with table tags.

--- 📁 Version 1.5.1 ---
📅 Date: February 27, 2026
💾 Initialization: Backed up paths, local data directories, and system dependencies.

--- 🖍️ Version 1.5.0 ---
📅 Date: February 27, 2026
🎨 Advanced Visual Tools: Shipped pro drawing, annotation workflows, and deep tagging features.

--- 📈 Version 1.4.0 ---
📅 Date: February 26, 2026
📊 Dashboard Insight: Added broker charges, `fill_count`, and draggable dashboard cards.

--- 🗓️ Version 1.3.0 ---
📅 Date: February 26, 2026
🎮 Calendar Controls: Upgraded UX controls for calendar UI and added date styling.

--- 🔄 Version 1.2.0 ---
📅 Date: February 26, 2026
🌐 Server Sync: Automated syncing allows fast edits across multiple logged-in devices.

--- 📥 Version 1.1.0 ---
📅 Date: February 26, 2026
📑 Integration: Added multi-broker CSV imports and packaged shareable deploy config.

--- 🏁 Version 1.0.0 ---
📅 Date: February 26, 2026
🌱 Genesis: First backup of the core calendar, table interfaces, and gallery skeleton.

```
