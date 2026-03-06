# JS Architecture Map & AI Context

This file serves as a map of the `static/js/` directory for the Trading Journal Calendar application.
It caches all file responsibilities and major functions to avoid unnecessary repeated analysis of raw JS files by AI.

## Modular Groups

### 1. Annotation & Context Menus
Files dealing with the custom Fabric.js based annotation canvas overlay on top of images.
*   **`annotate-zoom.js`**: Core module state (`fabricCanvas`, `zoom`, `drag`). Zoom/pan and brush cursor.
    *   `_brushCursorMove`, `resetZoom`, `applyZoom`, `bindZoomPan`
*   **`annotate-canvas.js`**: Fabric history, shape events, and text events.
    *   `_initFabricHistory`, `fabricUndo`, `fabricRedo`, `_bindFabricShapeEvents`
*   **`annotate-fabric.js`**: Annotation overlay export and saving logic.
    *   `saveAnnotOverlay`, `saveAnnotMerge`, `bindAnnotationCanvas`
*   **`annotate-lifecycle.js`**: Controls annotation start/stop session flows.
    *   `startAnnotation`, `stopAnnotation`, `_buildFabricSessionForAutoSave`
*   **`annotate-marquee.js`**: Draws selection/marquee hitboxes over images before entering full canvas.
    *   `drawMarqueeBox`, `hitTestMarquee`, `getSelectedMarqueeTagSet`
*   **`annotate-ctx-menu.js`**: DOM context menus for Marquee operations.
    *   `_ensureMarqueeContextMenu`, `_showMarqueeContextMenu`
*   **`annotate-tools.js`**: Enables tools like text, pen, eraser, marquee.
    *   `toggleAnnotation`, `toggleMarquee`, `setAnnotTool`

### 2. Core Dashboard & Data State
*   **`data.js`**: Initializer `init()`, local storage loading, syncing server state. Handles tags & schemas.
    *   `init`, `loadTrades`, `saveTrades`, `syncFromServerIfChanged`
*   **`state.js`**: The central configuration global variable `state`.
    *   State tree containing filters, columns, gallery status, config.
*   **`dashboard.js`**: Top-level UI orchestration (`render`) and main summary stats logic.
    *   `render`, `renderDashboard`, `updateCalendarModeButton`
*   **`calendar.js`**: Monthly/yearly market calendar view. Renders grid, maps trades to dates, holiday mapping.
    *   `renderCalendar`, `getMarketHoliday`, `getTradesForDate`
*   **`visual-dashboard.js`**: Complex chart analytics and user customizable graph widgets state.
    *   `initVisualDashboard`, `renderVisualDashboard`, `updateVdChartMode`

### 3. Events Orchestration
*   **`events.js`**: Top level bootstrapper that calls all specific bind files + generic pasting (`bindEvents()`).
*   **`events-ui.js`**: Calendar navigation inputs, month/year pickers, view toggling.
*   **`events-keys.js`**: Global hotkeys (ESC, Ctrl+Z for undo, Navigation).
*   **`events-settings.js`**: Global sizing modifiers (fonts, UI resizing sliders).
*   **`events-gallery.js`**: Dropdowns and generic interactions for gallery specifically.

### 4. Gallery Logic (Modularized Viewers)
*   **`gallery-core.js`**: Helper methods defining filter scope.
    *   `_getTagsForImageUrl`, `applyGalleryImageScopeByTagFilter`
*   **`gallery-data.js`**: Retrieving sub-images, overlay URLs from state by date.
    *   `getImagesForDate`, `getTradeForDateByImage`
*   **`gallery-image-ops.js`**: Reordering, moving items across dates, deleting, dropping.
    *   `syncGalleryImageOrderToTrades`, `moveGalleryImageToDate`
*   **`gallery-img-tags.js`**: Overlay tags directly bound to specific images.
    *   `renderGalleryImageTags`, `renameImageTagGlobal`
*   **`gallery-layer.js`**: Right side panel controlling hidden flags and nested image sets.
    *   `renderLayerPanel`, `toggleLayerPanel`
*   **`gallery-nav.js`**: Navigation flows left/right, and loading image resources.
    *   `navigateGallery`, `loadOverlayForCurrentImage`
*   **`gallery-open.js`**: Initializing modal and scroll locks when Opening the gallery from table/calendar.
    *   `openGalleryForDate`, `openGalleryDirect`
*   **`gallery-ops.js`**: Global tile operations context menus (combining tiles, flattening).
    *   `showGalleryContextMenu`, `groupAllGalleryImages`
*   **`gallery-render.js`**: Thumbnail array drawing UI code and separation bars.
    *   `renderGallery`, `afterImageReady`
*   **`gallery-stats.js`**: Aggregated stats top bar for gallery mode.
*   **`gallery-tags.js`**: Tag Clouds UI & tag groups rendering logic.
*   **`gallery-tags-filter.js`**: Filtering the image visibility by combinations of tags.

### 5. Table Rendering & Settings
*   **`table-render.js`**: Draws main DOM `.trading-tbody`. Filters raw row data to visible data.
    *   `renderTableBodyConsolidated`, `getFilteredTrades`
*   **`table-cols.js`**: Sizing, drag/drop handles, popup notes, render tag cells inside table logic.
*   **`table-colops.js`**: Table headers specific column filters, adding/removing column definitions.
*   **`settings.js`**: Modal for application level defaults and shortcut assignment.
*   **`io.js`**: Uploads, CSV exports, Excel parsing, file upload DOM previews (`openUploadModal()`).

---
_Auto-generated AI Reference Mapping file. Modify components mapping when files are refactored._
