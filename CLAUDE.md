# Trading Journal — Project Context

## Stack
- **Backend**: Python / Flask (`app.py`)
- **Frontend**: Vanilla JS (split modules) + Jinja2 (`templates/index.html`)
- **Storage**: `trades.json` (flat file, no DB), images in `static/uploads/`
- **CSS**: `static/css/style.css`

## Running the app
```bash
cd "D:/KHAZANA/KHAZANA/PYTHON/CODE2- CALENDER"
python app.py
```
Opens at `http://localhost:5000`

---

## JS Module Structure (`static/js/`)
The original `app.js` (7712 lines) has been split into 13 focused modules loaded in this order:

| File | Lines | Responsibility |
|------|-------|---------------|
| `state.js` | ~182 | `state`, `annotState`, constants |
| `data.js` | ~602 | `init`, `loadTrades`, `saveTrades`, sync, trade normalization |
| `settings.js` | ~423 | Settings panel, shortcuts, column visibility, saved views |
| `dashboard.js` | ~398 | Dashboard stats, drag-drop stat order |
| `calendar.js` | ~585 | Calendar render, yearly view, obs modal |
| `table-render.js` | ~530 | `renderTable`, `renderTableBody`, frozen cols |
| `table-cols.js` | ~771 | Column add/rename/delete, tag picker, tag filter, context menu |
| `gallery-core.js` | ~601 | Open/render gallery, navigate, overlay loading |
| `gallery-tags.js` | ~342 | Tag cloud, tags tray (drag-to-resize) |
| `gallery-data.js` | ~590 | Image/overlay data helpers, marquee box storage |
| `annotate.js` | ~1284 | Annotation tools (brush/text/marquee), zoom/pan, save |
| `io.js` | ~388 | Upload modal, import (JSON/ZIP), export, backup |
| `events.js` | ~790 | `bindEvents()` + `init()` call at bottom |

All functions are in **global scope** (no ES modules) — each file can call functions from any other file.

---

## Key Globals
- `state` — main app state (trades, columns, gallery, tags, dayData, etc.)
- `annotState` — annotation mode state (tool, marquee boxes, drawing flags)
- `zoom` / `drag` — gallery zoom/pan state (defined in `annotate.js`)

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

## Backend Key Routes (`app.py`)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/trades` | GET/POST | Load/save all trades + dayData |
| `/api/upload` | POST | Upload image → `static/uploads/` |
| `/api/overlay` | POST | Save annotation overlay |
| `/api/backup` | GET | Download ZIP (trades.json + images) |
| `/api/import-json` | POST | Restore from JSON or ZIP |

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
