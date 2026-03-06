import re, os

headers = {
'state.js': """/**
 * @fileoverview state.js
 * @description Defines the two global singletons used everywhere: state and annotState.
 * @exports state, annotState
 * @keyfields state.trades[], state.dayData{}, state.columns[], state.gallery{},
 *            state.tagGroups{}, state.dateRange{from,to}, state.uploadRow,
 *            state._localOverlays{}, state._galleryUploadCallback,
 *            state.gallery.selectedSeparator, state.gallery.showTime, state.gallery.imageTimes
 *            annotState.active, annotState.tool, annotState.imageUrl, annotState.dirty
 * @note MUST be the first script loaded. All other modules read/write these objects directly.
 */""",

'data.js': """/**
 * @fileoverview data.js
 * @description Bootstraps app, loads/saves trades to server, CSV/JSON normalization, sync.
 * @exports init, loadTrades, saveTrades, syncFromServerIfChanged, normalizeStructuredTradeRow,
 *          computeTradeCharges, mergeStructuredTrades, ensurePermanentColumns,
 *          syncTagColumnRegistry, isProtectedSystemColumn, canDeleteColumn,
 *          splitDateTime, pickTradeField, formatDate, normalizeDate, syncImageTagColumnValues
 * @reads state.trades, state.columns, state.dayData
 * @writes state.trades, state.columns, state.dayData, state.tagGroups
 * @calls render, fetch /api/trades (GET + POST)
 */""",

'settings.js': """/**
 * @fileoverview settings.js
 * @description Settings panel: column visibility, keyboard shortcuts, saved views, show-heads.
 * @exports loadSettingsFromStorage, applySettingsToDOM, saveSettings, readSettingsFromPanel,
 *          loadShortcutsFromStorage, shortcutMatches, eventToShortcut, populateShortcutPanel,
 *          getActiveShowHeads, initShowHeads, renderShowHeads, initTableShowCols,
 *          getSavedViews, loadColWidths, loadTagGroups, saveTagGroups
 * @reads state.columns, state.showHeadsConsolidated, state.showHeadsIndividual
 * @writes state.tableShowCols, state.tagGroups, state.colWidths, state.shortcuts
 * @storage tj_settings, tj_shortcuts, tj_tagGroups, tj_colWidths, tj_tblFontSize, tj_rowHeight
 */""",

'dashboard.js': """/**
 * @fileoverview dashboard.js
 * @description Top-level render() orchestrator + dashboard P&L stats, drag-drop stat ordering.
 * @exports render, renderDashboard, updateCalendarModeButton, updateBrokerFilterButton,
 *          getTradePnl, getTradesForMonth, formatCurrency, parseNumber, setDashValue,
 *          formatShortDate, getDashboardStatsOrder, saveDashboardStatsOrder,
 *          bindDashboardDragDrop, renderDashboardStatsMenu, applyDashboardStatVisibility
 * @reads state.trades, state.dateRange, state.calendarMode
 * @calls renderCalendar, renderTable, renderVisualDashboard
 */""",

'calendar.js': """/**
 * @fileoverview calendar.js
 * @description Monthly/yearly calendar grid, trade-to-date mapping, observation modal, date utils.
 * @exports renderCalendar, renderYearlyView, getTradesForDate, getTradeForDate,
 *          getOrCreateTrade, syncTradeDateField, syncAllTradeDates, formatDisplayDate,
 *          formatDate, normalizeDate, openObsModal, saveObservation, getMarketHoliday,
 *          extractDateFromTrade, updateRangeLabel, navigateObsDate, bindObsToolbar
 * @reads state.trades, state.dayData, state.year, state.month, state.dateRange
 * @writes state.trades (getOrCreateTrade), state.dayData (observation save)
 * @calls renderTable, saveTrades, openGalleryForDate
 */""",

'table-render.js': """/**
 * @fileoverview table-render.js
 * @description Renders the trade table (header + body), frozen columns, consolidated view.
 * @exports renderTable, renderTableBody, renderTableBodyConsolidated,
 *          getFilteredTrades, getFrozenCols, saveFrozenCols, applyFrozenColumns
 * @reads state.trades, state.columns, state.tableSort, state.filterValues,
 *        state.tableShowCols, state.dateRange, state.calendarMode
 * @calls renderTableBody, applyFrozenColumns, getActiveShowHeads, getFilteredTrades
 */""",

'table-cols.js': """/**
 * @fileoverview table-cols.js
 * @description Cell rendering, note popup, column sort, resize handles, tag picker, image cell.
 * @exports sortTrades, renderImagesCell, renderImageTagsCell, openNotePopup, closeNotePopup,
 *          bindColumnResizer, loadColWidths, tagColor, renameTagEverywhere,
 *          showCtxMenu, loadTagGroups, saveTagGroups, applyProfitColor, stripHtml
 * @reads state.trades, state.columns, state.tableSort, state.tagGroups, state.colWidths
 * @writes state.tableSort, state.tagGroups, state.colWidths
 * @calls saveTrades, renderTable, openGalleryForDate
 */""",

'table-colops.js': """/**
 * @fileoverview table-colops.js
 * @description Tag filter panel, add/rename/delete columns, edit column modal.
 * @exports renderTagFilterPanel, applyTagFilter, addColumn, renameColumn,
 *          deleteColumn, openEditColumnModal
 * @reads state.columns, state.trades, state.filterValues
 * @writes state.columns, state.trades (tag cells on rename/delete)
 * @calls saveTrades, renderTable
 */""",

'gallery-open.js': """/**
 * @fileoverview gallery-open.js
 * @description Opens gallery modal for a date or arbitrary image list; body scroll lock.
 * @exports openGalleryForDate, openGalleryDirect, openGalleryForDateWithTagFilter,
 *          lockBodyScroll, unlockBodyScroll
 * @reads state.trades, state.dayData
 * @writes state.gallery (images, date, currentIndex, sourceRow, tagFilter, selectedSeparator)
 * @calls renderGallery, lockBodyScroll
 */""",

'gallery-render.js': """/**
 * @fileoverview gallery-render.js
 * @description Renders gallery thumbnail strip: OPEN/Trade/CLOSE separators, drag-drop, time labels.
 * @exports renderGallery, _getGalleryThumbImages
 * @reads state.gallery.{images,currentIndex,date,tagFilter,showTime,imageTimes,selectedSeparator},
 *        state.dayData, state.trades, annotState.active
 * @calls loadOverlayForCurrentImage, applyGalleryImageScopeByTagFilter,
 *        renderGalleryStats, resetZoom, stopAnnotation
 */""",

'gallery-stats.js': """/**
 * @fileoverview gallery-stats.js
 * @description Computes and renders P&L stats bar shown below the main gallery image.
 * @exports renderGalleryStats
 * @reads state.gallery.date, state.trades, state.dayData
 * @calls getTradePnl, formatCurrency, getTradesForDate
 */""",

'gallery-core.js': """/**
 * @fileoverview gallery-core.js
 * @description Tag-scope helpers: resolve image tags, filter/scope gallery by tag selection.
 * @exports _getTagsForImageUrl, getAllGalleryImagesAcrossDates, _getSubImagesForParent,
 *          getFilteredGalleryImagesByTagSelection, applyGalleryImageScopeByTagFilter,
 *          getCurrentGalleryPreserveContext, findGalleryContextByImageUrl,
 *          getImageTagsForGalleryItem
 * @reads state.gallery, state.trades, state.dayData, state.tagGroups
 * @writes state.gallery.images, state.gallery.currentIndex (on scope change)
 * @calls renderGallery
 */""",

'gallery-image-ops.js': """/**
 * @fileoverview gallery-image-ops.js
 * @description Image reordering, cross-date move, deletion, sub-image drag-drop in gallery.
 * @exports getOwnerTradeForImageUrl, syncGalleryImageOrderToTrades,
 *          reorderGalleryImages, moveGalleryImageToDate, removeGalleryImageAt,
 *          handleReorderGalleryImagesBatch, handleDropAsSubImage
 * @reads state.trades, state.dayData, state.gallery
 * @writes state.trades[].images, state.dayData[].images, trade.subImages (move/delete/group)
 * @calls saveTrades, renderGallery, showToast
 */""",

'gallery-ops.js': """/**
 * @fileoverview gallery-ops.js
 * @description Gallery context menu (right-click), group/ungroup images, move to trade/dayData.
 * @exports showGalleryContextMenu, replaceGalleryImageUrl, groupAllGalleryImages,
 *          ungroupAllGalleryImages, moveGalleryTile, showGalleryGroupDeleteConfirm,
 *          toggleGalleryGroupExpand, moveSelectedToTrade, moveSelectedToDayData
 * @reads state.gallery, state.trades, state.dayData
 * @writes trade.subImages, dayData.subImages, state.gallery (context updates)
 * @calls saveTrades, renderGallery, showToast
 */""",

'gallery-layer.js': """/**
 * @fileoverview gallery-layer.js
 * @description Layer panel (sub-images list), keyboard shortcuts popover, video URL panel.
 * @exports renderLayerPanel, toggleLayerPanel, renderShortcutsPopover, renderGalleryVideoUrls
 * @reads state.gallery.{images,currentIndex,date,layerPanelOpen}, state.trades, state.dayData
 * @writes state.gallery.layerPanelOpen
 * @calls renderGallery, openGalleryDirect
 */""",

'gallery-nav.js': """/**
 * @fileoverview gallery-nav.js
 * @description Loads overlay+marquee for current image; navigate gallery by index or date.
 * @exports loadOverlayForCurrentImage, navigateGallery, navigateGalleryDate,
 *          updateGalleryDateArrows, getGalleryDateScopeForFilter
 * @reads state.gallery.{images,currentIndex,date,tagFilter}, state._localOverlays
 * @writes state.gallery.currentIndex, state.gallery.date (date navigation)
 * @calls renderGallery, getOverlayUrlForImage, getMarqueeBoxesForImage, renderMarqueeScene
 */""",

'gallery-tags.js': """/**
 * @fileoverview gallery-tags.js
 * @description Tag cloud (click-to-filter) and tags tray (drag-to-resize) for gallery.
 * @exports renderGalleryTagCloud, renderGalleryTagsTray
 * @reads state.gallery.{images,tagFilter,filterMode}, state.tagGroups, state.trades, state.dayData
 * @writes state.gallery.tagFilter, state.gallery.filterMode (on tag click)
 * @calls applyGalleryImageScopeByTagFilter, renderGallery, saveTagGroups
 */""",

'gallery-tags-filter.js': """/**
 * @fileoverview gallery-tags-filter.js
 * @description Renders the compact tag filter panel inside the gallery toolbar.
 * @exports renderGalleryTagFilterPanel
 * @reads state.gallery.tagFilter, state.gallery.images, state.tagGroups
 * @calls applyGalleryImageScopeByTagFilter, renderGallery
 */""",

'gallery-data.js': """/**
 * @fileoverview gallery-data.js
 * @description Low-level get/set for overlays, marquee boxes, sub-images; image times fetch.
 * @exports getImagesForDate, fetchImageTimesForGallery, getOwnerTradeForGalleryImage,
 *          getMarqueeTagsForImage, getCurrentGalleryImageTagInfo,
 *          getOverlayUrlForImage, setOverlayUrlForCurrentGalleryImage,
 *          setOverlayUrlForImage, getMarqueeBoxesForImage, setMarqueeBoxesForImage,
 *          packMarqueeBoxes, unpackMarqueeBoxes, removeOverlayForImage,
 *          canvasHasVisibleInk, autoSaveAnnotationSession
 * @reads state.trades, state.dayData, state.gallery, state._localOverlays
 * @writes state._localOverlays, trade.overlays, trade.marqueeBoxes, state.gallery.imageTimes
 * @calls saveTrades, renderGallery, fetch /api/image-times
 */""",

'gallery-img-tags.js': """/**
 * @fileoverview gallery-img-tags.js
 * @description Image-level tag rendering, global rename/delete across all data, tag manager modal.
 * @exports renderGalleryImageTags, getAllImageTagsGlobal, isPermanentImageTag,
 *          renameImageTagGlobal, deleteImageTagGlobal,
 *          openGalleryImageTagManager, closeGalleryImageTagManager,
 *          renderImageTagModal, addImageTagFromModal
 * @reads state.gallery, state.trades, state.dayData, state.tagGroups
 * @writes trade.imageTags, dayData.imageTags (rename/delete propagated everywhere)
 * @calls saveTrades, renderGallery, renameTagEverywhere
 */""",

'annotate-zoom.js': """/**
 * @fileoverview annotate-zoom.js
 * @description Declares fabricCanvas, zoom, drag globals; zoom/pan bindings; brush cursor.
 * @exports fabricCanvas (null until startAnnotation sets it), zoom{scale,x,y}, drag{active,...},
 *          resetZoom, applyZoom, bindZoomPan, ensureAnnotBrushCursor, updateAnnotBrushCursorVisual
 * @note MUST load BEFORE all other annotate-*.js — these globals are referenced by all annotate files.
 * @reads annotState.tool, annotState.active
 * @writes zoom.scale, zoom.x, zoom.y, fabricCanvas (assigned externally by startAnnotation)
 */""",

'annotate-marquee.js': """/**
 * @fileoverview annotate-marquee.js
 * @description Draws marquee selection boxes on overlay canvas; hit testing; tag assignment.
 * @exports drawMarqueeBox, hitTestMarquee, hitTestMarqueeResizeHandle, hitTestMarqueeDeleteHandle,
 *          getSelectedMarqueeIndexes, getSelectedMarqueeTagSet, isMarqueeSelectionActive,
 *          syncMarqueeBoxesShadow, toggleTagOnSelectedMarquees, setSingleMarqueeSelection,
 *          renderMarqueeScene, rebindCurrentImageOverlayToMarquee,
 *          refreshMarqueeTagSuggestions, addTagToSelectedMarqueeBox, refreshGalleryTagsTrayIfVisible
 * @reads annotState.marqueeBoxes, annotState.imageUrl, state.gallery, state.tagGroups
 * @writes annotState.marqueeBoxes (add/resize/move/delete), trade.marqueeBoxes via setMarqueeBoxesForImage
 * @calls renderGalleryTagCloud, renderGalleryTagsTray, saveTrades
 */""",

'annotate-tools.js': """/**
 * @fileoverview annotate-tools.js
 * @description Tool toggles (pen/highlighter/eraser/text/arrow/shape/marquee), cursor, size adjust.
 * @exports toggleAnnotation, toggleMarquee, setAnnotTool, adjustAnnotSize,
 *          updateAnnotToolIcons, commitActiveCanvasTextEditor,
 *          toggleMarqueeGroupSelect, updateMarqueeMultiSelectButton
 * @reads annotState.{tool,active,marqueeMode}, fabricCanvas
 * @writes annotState.tool, annotState.marqueeMode
 * @calls startAnnotation, stopAnnotation, _applyFabricToolMode, _setCursor
 */""",

'annotate-canvas.js': """/**
 * @fileoverview annotate-canvas.js
 * @description Fabric.js history (undo/redo), shape/text/arrow event bindings, raster baking.
 * @exports fabricUndo, fabricRedo, _bindFabricShapeEvents, _addArrowGroup, _createFabricIText,
 *          _bakeRasterToBackground, _ensureMarqueeOverlayCanvas, _destroyMarqueeOverlayCanvas,
 *          _renderMarqueeOnOverlayCanvas, _bindMarqueeCanvasEvents
 * @reads fabricCanvas, annotState.{tool,active}
 * @writes fabricCanvas objects (add/remove), annotState.dirty
 * @calls _pushFabricHistorySnapshot, updateAnnotBrushCursorVisual, _renderMarqueeOnOverlayCanvas
 */""",

'annotate-ctx-menu.js': """/**
 * @fileoverview annotate-ctx-menu.js
 * @description Right-click context menu for marquee boxes (rename tag, delete box, tag ops).
 * @exports _ensureMarqueeContextMenu, _showMarqueeContextMenu, _hideMarqueeContextMenu
 * @reads annotState.marqueeBoxes, state.tagGroups
 * @calls toggleTagOnSelectedMarquees, saveTrades, renderGallery
 */""",

'annotate-lifecycle.js': """/**
 * @fileoverview annotate-lifecycle.js
 * @description Start/stop annotation sessions; Fabric.js canvas init + teardown; auto-save raster.
 * @exports startAnnotation, stopAnnotation, _buildFabricSessionForAutoSave
 * @reads annotState.imageUrl, annotState.tool, state.gallery, state._localOverlays
 * @writes annotState.{active,tool,dirty,imageUrl}, fabricCanvas (init via new fabric.Canvas())
 * @calls bindAnnotationCanvas, bindZoomPan, renderGallery, autoSaveAnnotationSession
 */""",

'annotate-fabric.js': """/**
 * @fileoverview annotate-fabric.js
 * @description Export Fabric canvas to PNG overlay; merge annotation onto base image; canvas bind helper.
 * @exports saveAnnotOverlay, saveAnnotMerge, bindAnnotationCanvas
 * @reads fabricCanvas, annotState.imageUrl, state.gallery
 * @writes state._localOverlays, trade.overlays via setOverlayUrlForCurrentGalleryImage
 * @calls saveTrades, stopAnnotation, fetch /api/upload-image, fetch /api/overlay
 */""",

'io.js': """/**
 * @fileoverview io.js
 * @description Upload modal, image drag-drop on table rows, CSV/JSON import, export, backup, toast.
 * @exports openUploadModal, openDayUploadModal, renderUploadPreview, handleImageFiles,
 *          uploadImagesToRow, uploadImagesToDayData, bindRowImageDrop, bindTableRowDrag,
 *          importExcel, importRawCsv, importHistoricalCsv, importDhanCsv, importJson,
 *          backupJson, exportExcel, exportStructuredCsv,
 *          showToast, setupDropdown, closeAllDropdowns
 * @reads state.trades, state.dayData, state.uploadRow, state.pendingFiles, state._dayUploadKey
 * @writes state.pendingFiles, state.trades[].images, state.dayData[].images
 * @calls saveTrades, render, fetch /api/upload, /api/backup, /api/import-json
 */""",

'events-keys.js': """/**
 * @fileoverview events-keys.js
 * @description Global keyboard shortcut handler: ESC, Ctrl+Z/Y undo-redo, gallery nav keys.
 * @exports _bindKeyboardEvents
 * @reads annotState.active, state.gallery, shortcuts from settings
 * @calls fabricUndo, fabricRedo, navigateGallery, stopAnnotation, shortcutMatches, adjustAnnotSize
 */""",

'events-ui.js': """/**
 * @fileoverview events-ui.js
 * @description Calendar navigation inputs, month/year pickers, view toggle, broker filter buttons.
 * @exports _bindUIEvents
 * @reads state.year, state.month, state.calendarMode, state.dateRange
 * @writes state.year, state.month, state.calendarMode, state.dateRange
 * @calls render, renderCalendar
 */""",

'events-gallery.js': """/**
 * @fileoverview events-gallery.js
 * @description Gallery toolbar buttons: layer panel toggle, time display toggle, tags tray events.
 * @exports _bindGalleryEvents
 * @reads state.gallery.{showTime,layerPanelOpen}
 * @writes state.gallery.showTime, state.gallery.selectedSeparator
 * @calls toggleLayerPanel, fetchImageTimesForGallery, renderGallery
 */""",

'events-settings.js': """/**
 * @fileoverview events-settings.js
 * @description Settings modal events, upload-done handler routing via selectedSeparator, drag-drop zone.
 * @exports _bindSettingsEvents
 * @reads state.{uploadRow,_dayUploadKey,pendingFiles,_galleryUploadCallback},
 *        state.gallery.{selectedSeparator,date}
 * @writes state.trades[].images, state.dayData[].{images,closeImages} (via upload routing)
 * @calls saveTrades, render, applySettingsToDOM, showToast, getTradesForDate
 */""",

'events.js': """/**
 * @fileoverview events.js
 * @description Main event bootstrapper: calls all sub-binders + handles gallery paste-to-upload.
 * @exports bindEvents, syncSelects, showGalleryExitConfirm
 * @reads state.gallery.{date,selectedSeparator,images,currentIndex}, state.dayData, state.trades
 * @writes state.dayData[].{images,closeImages}, state.trades[].images (paste routing)
 * @calls _bindUIEvents, _bindGalleryEvents, _bindSettingsEvents, _bindKeyboardEvents,
 *        saveTrades, render, showToast, fetch /api/upload-image
 */""",

'visual-dashboard.js': """/**
 * @fileoverview visual-dashboard.js
 * @description ApexCharts visual dashboard: P&L charts, customizable stat cards, drag-drop, widths.
 * @exports initVisualDashboard, renderVisualDashboard, updateVdChartMode, updateVdChartType,
 *          updateVdChartWidth, bindVdEvents, bindVdDragDrop, renderVdStatsMenu,
 *          getVdStatsOrder, saveVdStatsOrder, getVdStatsState, saveVdStatsState,
 *          applyVdStatVisibility, applyVdStatOrder, syncVdSelects
 * @reads state.trades, state.dateRange
 * @calls ApexCharts (external lib), getTradePnl (local copy), formatCurrency
 * @storage vd_statsState, vd_statsOrder, vd_cardWidths
 */"""
}

base = 'static/js'
updated = []
skipped = []

for fname, new_header in headers.items():
    path = os.path.join(base, fname)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    pattern = r'/\*\*\s*\n(?:\s*\*.*\n)*\s*\*/'
    match = re.search(pattern, content)
    if match and '@fileoverview' in match.group():
        new_content = content[:match.start()] + new_header + content[match.end():]
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        updated.append(fname)
    else:
        skipped.append(fname)

print(f'Updated {len(updated)} files')
if skipped:
    print(f'Skipped: {skipped}')
