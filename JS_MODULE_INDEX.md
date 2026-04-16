# JS Module Index

All 94 JS modules grouped by domain. Global scope — no ES modules.
Load order: defined in . Bundle:  (auto-generated).

## CORE

| File | Size | Key Functions |
|------|------|---------------|
| `state.js` | 10KB | state, annotState |
| `data.js` | 14KB | init, loadTrades, saveTrades, syncFromServerIfChanged, normalizeStructuredTradeRow |
| `data-utils.js` | 18KB | syncTagColumnRegistry, isProtectedSystemColumn, canDeleteColumn, splitDateTime, pickTradeField… |
| `io.js` | 19KB | openUploadModal, openDayUploadModal, renderUploadPreview, handleImageFiles,  |

## UI — Calendar / Dashboard / Settings

| File | Size | Key Functions |
|------|------|---------------|
| `calendar.js` | 22KB | renderCalendar, renderYearlyView, getTradesForDate, getTradeForDate,  |
| `calendar-obs.js` | 9KB | openObsModal, renderObsTradeNotes, saveObservation, navigateObsDate, bindObsToolbar |
| `dashboard.js` | 20KB | render, renderDashboard, updateCalendarModeButton, updateBrokerFilterButton,  |
| `settings.js` | 27KB | loadSettingsFromStorage, applySettingsToDOM, saveSettings, readSettingsFromPanel,  |

## TABLE

| File | Size | Key Functions |
|------|------|---------------|
| `table-render.js` | 26KB | renderTable, renderTableBody, renderTableBodyConsolidated,  |
| `table-cols.js` | 23KB | sortTrades, renderImagesCell, renderImageTagsCell, openNotePopup, closeNotePopup |
| `table-colops.js` | 12KB | renderTagFilterPanel, applyTagFilter, addColumn, renameColumn,  |

## GALLERY — Core

| File | Size | Key Functions |
|------|------|---------------|
| `gallery-core.js` | 15KB | _getTagsForImageUrl, getAllGalleryImagesAcrossDates, _getSubImagesForParent,  |
| `gallery-nav.js` | 13KB | loadOverlayForCurrentImage, navigateGallery, navigateGalleryDate,  |
| `gallery-render.js` | 11KB | renderGallery, renderPdfTabsBar |
| `gallery-open.js` | 8KB | openGalleryForDate, openGalleryDirect, openGalleryForDateWithTagFilter,  |
| `gallery-sync.js` | 2KB | syncGalleryToOthers |
| `gallery-data.js` | 23KB | getImagesForDate, fetchImageTimesForGallery, getOwnerTradeForGalleryImage,  |

## GALLERY — Render

| File | Size | Key Functions |
|------|------|---------------|
| `gallery-render-tray.js` | 29KB | _captureSplitPanel, renderCloseGlobalTray |
| `gallery-render-thumbs.js` | 29KB | renderGalleryThumbs |
| `gallery-render-thumbs-b.js` | 11KB | _renderPdfModeThumbs, _renderThumbsFooter |
| `gallery-grid.js` | 21KB |  |
| `gallery-render-b.js` | 2KB | _cacheVideo, _preloadAdjacentVideos, _videoBlobCache, _VIDEO_CACHE_MAX |

## GALLERY — Ops

| File | Size | Key Functions |
|------|------|---------------|
| `gallery-ops.js` | 27KB | showGalleryContextMenu, replaceGalleryImageUrl, groupAllGalleryImages,  |
| `gallery-ops-group.js` | 12KB | showGalleryGroupDeleteConfirm, toggleGalleryGroupExpand,  |
| `gallery-image-ops.js` | 23KB | getOwnerTradeForImageUrl, syncGalleryImageOrderToTrades,  |
| `gallery-image-ops-b.js` | 10KB | handleReorderGalleryImagesBatch, handleDropAsSubImage |
| `gallery-image-manager.js` | 29KB | initImageManager, getManagerAllTags, renderColumnMenu, buildManagerTagCountMap, renderColumnList… |

## GALLERY — Media

| File | Size | Key Functions |
|------|------|---------------|
| `gallery-audio.js` | 18KB | _getActx, _decodeAudio, _playFromOffset, _stopSource, _getCurrentPlaybackTime… |
| `gallery-video.js` | 6KB | _fmtVideoTime, _stopVideoStream, _updateVideoProgress, renderVideoBar, startVideoRecording… |
| `gallery-chart.js` | 20KB | _gc_aggregate, openGalleryChart, closeGalleryChart, _gc_drawChart, setGalleryChartTf… |
| `gallery-pnl-calendar.js` | 5KB | openPnlCalendar, closePnlCalendarModal, renderPnlCalendar |
| `gallery-layer.js` | 18KB | renderLayerPanel, toggleLayerPanel, renderShortcutsPopover, renderGalleryVideoUrls |
| `gallery-rubberband.js` | 5KB | bindGalleryRubberbandAndPan |

## GALLERY — Tags

| File | Size | Key Functions |
|------|------|---------------|
| `gallery-tags.js` | 37KB | renderGalleryTagCloud, renderGalleryTagsTray |
| `gallery-tags-b.js` | — | (missing) |
| `gallery-tags-filter.js` | 18KB | renderGalleryTagFilterPanel |
| `gallery-img-tags.js` | 22KB | renderGalleryImageTags, getAllImageTagsGlobal, isPermanentImageTag,  |

## GALLERY — Features

| File | Size | Key Functions |
|------|------|---------------|
| `gallery-stats.js` | 17KB | renderGalleryStats, renderGalleryPnlPill, renderGalleryTradePill |
| `gallery-stats-b.js` | 14KB | renderGalleryTrayState, renderGalleryTradeInfoDisplay, renderGalleryTrayCounter,  |
| `gallery-split-view.js` | 20KB | getSplitViewState, applySplitViewState, initSplitView, navigateSplitLeft, toggleSplitView… |
| `gallery-ref-cards.js` | 24KB | createRefCardElement, _buildRefHalf, _openRefCardLightbox, _refCardPickImage, _refCardToggleLock… |

## GALLERY — Classic (legacy /gallery-classic page)

| File | Size | Key Functions |
|------|------|---------------|
| `gallery-render-classic.js` | 29KB | renderGallery, _getGalleryThumbImages |
| `gallery-ops-classic.js` | 20KB | showGalleryContextMenu, replaceGalleryImageUrl, groupAllGalleryImages,  |
| `gallery-core-classic.js` | 8KB | _getTagsForImageUrl, getAllGalleryImagesAcrossDates, _getSubImagesForParent,  |
| `gallery-open-classic.js` | 3KB | openGalleryForDate, openGalleryDirect, openGalleryForDateWithTagFilter,  |
| `gallery-rubberband-classic.js` | 5KB | bindGalleryRubberbandAndPan |

## ANNOTATION (Fabric.js)

| File | Size | Key Functions |
|------|------|---------------|
| `annotate-canvas.js` | 24KB | fabricUndo, fabricRedo, _bindFabricShapeEvents, _addArrowGroup, _createFabricIText |
| `annotate-zoom.js` | 12KB | fabricCanvas (null until startAnnotation sets it), zoom{scale, x, y}, drag{active |
| `annotate-fabric.js` | 15KB | saveAnnotOverlay, saveAnnotMerge, bindAnnotationCanvas |
| `annotate-marquee.js` | 11KB | drawMarqueeBox, hitTestMarquee, hitTestMarqueeResizeHandle, hitTestMarqueeDeleteHandle,  |
| `annotate-tools.js` | 13KB | toggleAnnotation, toggleMarquee, setAnnotTool, adjustAnnotSize,  |
| `annotate-ctx-menu.js` | 7KB | _ensureMarqueeContextMenu, _showMarqueeContextMenu, _hideMarqueeContextMenu |
| `annotate-lifecycle.js` | 13KB | startAnnotation, stopAnnotation, _buildFabricSessionForAutoSave |

## EVENTS

| File | Size | Key Functions |
|------|------|---------------|
| `events.js` | 10KB | bindEvents, syncSelects, showGalleryExitConfirm |
| `events-keys.js` | 21KB | _bindKeyboardEvents |
| `events-ui.js` | 18KB | _bindUIEvents |
| `events-settings.js` | 18KB | _bindSettingsEvents |
| `events-gallery.js` | 25KB | _bindGalleryEvents |
| `events-gallery-b.js` | 11KB | _bindGalleryTradesPanelEvents |
| `events-gallery-c.js` | 11KB | _bindGalleryDropdownEvents |
| `events-gallery-d.js` | 9KB | setupPanelResizer, _bindGalleryPanelResizers, _bindGalleryULPState, _bindGalleryCtrlDrag |

## FEATURE — CsvLog

| File | Size | Key Functions |
|------|------|---------------|
| `csvlog.js` | 30KB | openCsvLogModal, closeCsvLogModal |
| `csvlog-day.js` | 27KB | _bellArrange, _clLots, _buildBellChart, _renderDayContent, _renderAllContent |
| `csvlog-fields.js` | 22KB | _renderFormFields, _makeSwitch, _makeInput, _makeDropdown, _makeRange… |
| `csvlog-charts.js` | 20KB | openCsvLogChartsModal, closeCsvLogChartsModal |
| `csvlog-charts-b.js` | 17KB | _clChartsGetValueList, _clChartsBuildOccurrenceMatrixCell, _clChartsOpenPopup, _clChartsRenderToolbarFieldPicker, _clChartsRenderPopup… |
| `csvlog-vitals.js` | 6KB | _makeBiSlider, _biUpdateBadge, _biUpdateFill, _renderVitalsContent, _clApplyConditionals… |
| `csvlog-img.js` | 12KB | _clUploadToTrade, _clBindImgDrop, _clImgPasteHandler, _renderImageViewer, _clBindImgDrop… |
| `csvlog-placeholder.js` | 9KB | _offerPlaceholder, _createPlaceholderTrade, _addAnotherPlaceholder, _showPlaceholderContextMenu, _mergePlaceholderToReal… |

## FEATURE — Strategy Lab

| File | Size | Key Functions |
|------|------|---------------|
| `strategy-lab-a.js` | 29KB |  |
| `strategy-lab-b.js` | 27KB |  |
| `strategy-lab-c.js` | 15KB |  |

## FEATURE — Target Tracker

| File | Size | Key Functions |
|------|------|---------------|
| `target-tracker.js` | 26KB | renderTargetTracker, renderMultTable |
| `target-tracker-monthly.js` | 26KB | renderTtMonthlySection |
| `target-tracker-weekly.js` | 22KB | renderTtWeeklyView, renderTtWeeklyBellCurve, renderTtWeeklyComparisonChart |
| `target-tracker-data.js` | 8KB | getAvailableDates, initTtCurrentDate, formatDisplayDate, getTodayTrades, getTodayNetPl… |
| `target-tracker-init.js` | 14KB | showTargetTrackerModal |

## FEATURE — Trade Tools

| File | Size | Key Functions |
|------|------|---------------|
| `trade-review.js` | 25KB | openTradeReview, closeTradeReview, openTradeReviewFromToolbar |
| `trade-sidebar.js` | 15KB |  |
| `trade-logger-core.js` | 13KB | parseTimeToMinutes, _calcTradeDurationMinutes, _attemptCloseTradeLogger, _getTlValue, _setTlValue… |
| `trade-logger-render.js` | 18KB | _renderTlTabs, _renderTlContent, _trBlock |
| `tag-pins.js` | 25KB | getTagPinColor, _screenToLogical, getTagPinsForUrl, setTagPinsForUrl, _currentPinImgUrl… |

## FEATURE — Visual Dashboard

| File | Size | Key Functions |
|------|------|---------------|
| `visual-dashboard.js` | 30KB | initVisualDashboard, renderVisualDashboard, updateVdChartMode, updateVdChartType,  |
| `visual-dashboard-init.js` | 3KB | initVisualDashboard, bindVdEvents, syncVdSelects, updateVdRangeLabel |
| `visual-dashboard-mtm.js` | 21KB | setVdMtmSummaryType, renderVdMtmThumbs, renderVdMiniMtmChart,  |
| `visual-dashboard-stats.js` | 14KB | getTradePnl, VD_STATS, getVdStatsState, saveVdStatsState, getVdStatsOrder |

## FEATURE — Misc

| File | Size | Key Functions |
|------|------|---------------|
| `quick-stats.js` | 29KB |  |
| `quotes.js` | 17KB | openQuoteModal, closeQuoteModal, navigateQuote |
| `ohlc-manager.js` | 13KB |  |
| `fullscreen-viewer.js` | 24KB | openFullscreenFromAppContext |
| `pdf-handler.js` | 30KB |  |
| `pdf-handler-b.js` | — | (missing) |

## FEATURE — What-If

| File | Size | Key Functions |
|------|------|---------------|
| `whatif-ui.js` | 14KB | toggleCard, loadDhanConfig, saveDhanConfig, clearMapDates, autoMapAll… |
| `whatif-ui-b.js` | 24KB | _strategyDateParams, checkOhlcStatus, renderOhlcStatus, fetchAllOhlc, runSimulation… |
