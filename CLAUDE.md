# Trading Journal — Project Context

## Stack
- **Backend**: Python / Flask (`app.py` — thin orchestrator only)
- **Frontend**: Vanilla JS (split modules, global scope) + Jinja2 (`templates/index.html`)
- **Storage**: `trades.json` (flat file, no DB), images in `static/uploads/`
- **CSS**: `style-base.css` / `style-gallery-a.css` / `style-gallery-b.css` / `style-misc.css`

## Running the app
```bash
cd "D:/KHAZANA/KHAZANA/PYTHON/CODE2- CALENDER"
python app.py
```
Opens at `http://localhost:5000`

---

## Template Structure (`templates/`)
| File | Lines | Responsibility |
|------|-------|---------------|
| `index.html` | ~263 | Main layout, calendar, dashboard, trade table |
| `modals.html` | ~380 | All modal dialogs (settings, obs, upload, etc.) |
| `gallery.html` | ~213 | Gallery overlay, canvas, annotation toolbar |

Included via Jinja2 `{% include %}` in `index.html`.

---

## JS Module Structure (`static/js/`)
The original `app.js` (7712 lines) has been split into 17 focused modules loaded in this order:

| File | Lines | Responsibility |
|------|-------|---------------|
| `state.js` | ~182 | `state`, `annotState`, constants |
| `data.js` | ~602 | `init`, `loadTrades`, `saveTrades`, sync, trade normalization |
| `settings.js` | ~480 | Settings panel, shortcuts, column visibility, saved views |
| `dashboard.js` | ~398 | Dashboard stats, drag-drop stat order |
| `calendar.js` | ~585 | Calendar render, yearly view, obs modal |
| `table-render.js` | ~530 | `renderTable`, `renderTableBody`, frozen cols |
| `table-cols.js` | ~547 | Note popup, sort, col resize, tag picker, cell rendering |
| `table-colops.js` | ~225 | `renderTagFilterPanel`, `applyTagFilter`, `addColumn`, `renameColumn`, `deleteColumn` |
| `gallery-core.js` | ~590 | Open/render gallery, stats, scope/filter query helpers |
| `gallery-nav.js` | ~201 | `loadOverlayForCurrentImage`, `navigateGallery`, `navigateGalleryDate`, arrows |
| `gallery-tags.js` | ~533 | Tag cloud, tags tray (drag-to-resize) |
| `gallery-data.js` | ~328 | Image/overlay/marquee data get/set, pack/unpack, autoSave |
| `gallery-img-tags.js` | ~397 | `renderGalleryImageTags`, rename/delete image tags, tag modal |
| `annotate-tools.js` | ~619 | Tool toggles, marquee ops, `startAnnotation`, `stopAnnotation` |
| `annotate-canvas.js` | ~818 | `bindAnnotationCanvas`, zoom/pan (`zoom`, `drag`, `applyZoom`, `bindZoomPan`) |
| `io.js` | ~388 | Upload modal, import (JSON/ZIP), export, backup |
| `events.js` | ~918 | `bindEvents()` + `init()` call at bottom |

Old backups (not loaded): `app.js`, `annotate.js`.

All functions are in **global scope** (no ES modules) — each file can call functions from any other file.

---

## Key Globals
- `state` — main app state (trades, columns, gallery, tags, dayData, etc.)
- `annotState` — annotation mode state (tool, marquee boxes, drawing flags)
- `zoom` / `drag` — gallery zoom/pan state (defined in `annotate-canvas.js`)

## Key Patterns

### Saving data
```js
await saveTrades();           // saves state.trades + state.dayData to server
saveTagGroups();              // saves state.tagGroups to localStorage
```

### Image overlays
- `state._localOverlays[imgUrl]` — temporary data URL (before server upload)
- `trade.overlays[imgUrl]` — server URL (permanent)
- `loadOverlayForCurrentImage()` — draws overlay + marquee boxes on canvas

### Marquee boxes
```js
packMarqueeBoxes(boxes, w, h)    // pixels → ratios (for storage)
unpackMarqueeBoxes(stored, w, h) // ratios → pixels (for display)
```

### Tag groups
```js
state.tagGroups = { groupName: [tagName, ...] }
moveTagToGroup(tag, targetGroup)
renameTagEverywhere(oldTag, newTag)  // updates all trades/dayData/boxes
```

---

## Backend Architecture (STRICT — always follow this)

```
app.py              ← thin entry point only: app setup + blueprint registration
config.py           ← ALL config/env vars/paths live here (DATA_FILE, UPLOADS_DIR, etc.)
routes/             ← HTTP layer only: parse request → call service → return jsonify()
│   page_routes.py      GET /, GET /updates
│   trade_routes.py     GET/POST /api/trades
│   image_routes.py     upload, delete, clipboard, image-times, serve /uploads/
│   import_routes.py    import-excel, import-json, import-raw-csv, import-historical-csv, import-dhan-csv
│   export_routes.py    backup, export-excel, export-structured-csv, export-logger-excel
services/           ← business logic only (no Flask imports, no request/response)
│   trade_service.py
│   image_service.py
│   import_service.py
│   export_service.py
processors/         ← pure data transformation (CSV parsing, normalization, JSON load/save)
│   data_processors.py
```

### Rules — enforce on every new file:
- **Routes** must only: parse `request.*`, call one service function, return `jsonify()`
- **Services** must not import Flask or touch `request`/`response`
- **Config** values (`DATA_FILE`, `UPLOADS_DIR`, `BASE_DIR`, etc.) always come from `config.py` — never hardcode paths
- **New Python feature** → decide: is it a route (HTTP concern), service (business logic), or processor (data transform)?
- **JS frontend** components must never call `fetch()` directly — always go through `static/js/services/`

### Backend Key Routes
| Route | Method | File | Purpose |
|-------|--------|------|---------|
| `/api/trades` | GET/POST | `trade_routes.py` | Load/save all trades + dayData |
| `/api/upload-image` | POST | `image_routes.py` | Upload image → `static/uploads/` |
| `/api/delete-image` | POST | `image_routes.py` | Move image to trash |
| `/api/backup` | GET | `export_routes.py` | Download ZIP (trades.json + images) |
| `/api/import-json` | POST | `import_routes.py` | Restore from JSON or ZIP |
| `/api/import-excel` | POST | `import_routes.py` | Import Excel file |
| `/api/import-raw-csv` | POST | `import_routes.py` | Import Zerodha raw fills CSV |
| `/api/import-historical-csv` | POST | `import_routes.py` | Import Zerodha historical CSV |
| `/api/import-dhan-csv` | POST | `import_routes.py` | Import Dhan CSV |
| `/api/export-excel` | POST | `export_routes.py` | Export simple Excel |
| `/api/export-structured-csv` | POST | `export_routes.py` | Export structured CSV |
| `/api/export-logger-excel` | POST | `export_routes.py` | Export logger Excel |

---

## CSS Variables (in `:root`)
```css
--table-font-size     /* controlled by settings select */
--table-row-height    /* controlled by settings +/- buttons */
--table-visible-rows  /* rows before scroll */
```

## localStorage Keys
| Key | Purpose |
|-----|---------|
| `tj_settings` | Calendar display settings |
| `tj_shortcuts` | Keyboard shortcuts |
| `tj_tagGroups` | Tag groups |
| `tj_tblFontSize` | Table font size |
| `tj_rowHeight` | Table row height |
| `tj_tagsTrayW` | Tags tray width |
| `tj_colWidths` | Column widths |

---

## Important Notes
- `app.js` in `static/js/` is the **old backup** — not loaded by the app anymore
- When fixing a bug, check which module file it belongs to before reading
- `annotState.active` gates annotation mode — always check this before modifying the canvas
- `canvas.width = w` clears canvas even if value is same — use `if (canvas.width !== w)` guard

---

## 📏 File Size Rules (STRICT — enforce proactively, no need to ask)

### JS files (`static/js/*.js`) — hard limit: **30 KB**
- If any `.js` file exceeds 30 KB, **immediately split it** into smaller focused modules before doing anything else.
- Split along logical function boundaries (e.g., render vs data vs events).
- After splitting: update `templates/index.html` script tags (load order matters — global scope!), update `generate_context.py`, regenerate context MDs.

### CSS files (`static/css/*.css`) — hard limit: **30 KB**
- If any `.css` file exceeds 30 KB, **immediately split it** at a natural section comment boundary (`/* ── SECTION ──`).
- After splitting: update `templates/index.html` link tags, update `generate_context.py`.

### HTML files (`templates/*.html`) — hard limit: **30 KB**
- If any `.html` file exceeds 30 KB, **split it** by moving sections into a new Jinja2 include file and replacing with `{% include 'new_file.html' %}`.
- After splitting: update `generate_context.py` file lists, regenerate context MDs.

### AI Context MD files (`AI_CONTEXT_*.md`) — hard limit: **30 KB**
- Run `python generate_context.py` to regenerate whenever source files change.
- If any output MD exceeds 30 KB, **split the file list** in `generate_context.py` into two smaller groups and regenerate.
- Delete old oversized MDs after splitting.

### How to check sizes
```bash
python -c "
import os
files = [f for f in os.listdir('.') if f.endswith('.md') and f.startswith('AI_CONTEXT')]
js  = [f for f in os.listdir('static/js') if f.endswith('.js')]
css = [f for f in os.listdir('static/css') if f.endswith('.css')]
html = [f for f in os.listdir('templates') if f.endswith('.html')]
for label, lst, base in [('MD', files, '.'), ('JS', js, 'static/js'), ('CSS', css, 'static/css'), ('HTML', html, 'templates')]:
    for f in sorted(lst):
        s = os.path.getsize(os.path.join(base, f))
        flag = ' ← SPLIT NEEDED' if s > 30720 else ''
        if flag: print(f'{label} {s/1024:.1f}KB{flag}  {f}')
print('Done — no output means all files are under 30KB')
"
```

---

## 📦 Library Policy
- **Prefer battle-tested libraries** over custom implementations when a good one exists.
- Before building something custom (drag, canvas, animation, annotation, date picker, etc.), check if a small focused library handles it better.
- Approved/preferred libs for this project:
  - **Fabric.js** — canvas annotation (replaces custom annotate-canvas + annotate-tools)
  - Vanilla JS for everything else (no React/Vue)

---

## ✏️ Annotation Feature Requirements
The annotation system must support (target: Fabric.js integration):

### Ink Tools
- Freehand pen (free draw)
- Highlighter (semi-transparent brush)
- Arrows (click-drag)
- Shapes: Rectangle, Circle

### Text Tools
- Click anywhere on image → text box appears → type
- Font size + color customizable
- Callout/background box behind text
- Text movable + editable after placing

### General
- **Edit mode**: All placed annotations selectable, movable, deletable
- **Undo/Redo**: Ctrl+Z / Ctrl+Y
- **Save format**: Must still integrate with existing `/api/overlay` route (PNG export from Fabric canvas)

---

## 🌅 Custom Commands / EOD Routine
If the user ever says **"Aap EOD dekh lijye"** or asks you to **"do the EOD routine"**, it means you must:
1. Immediately read the contents of `Docs/EOD_AI_PROMPT.md` (it lives in the `Docs/` folder, not root).
2. Execute the exact End of Day Optimization, Refactoring, Context updating, and Git Push routine documented inside that file.
