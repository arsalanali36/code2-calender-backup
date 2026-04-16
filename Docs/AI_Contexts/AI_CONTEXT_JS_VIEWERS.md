# JS - Viewers (fullscreen, pdf-handler)
Consolidated code context for AI assistants.


## File: `static/js/fullscreen-viewer.js`
```js
const FullscreenViewer = {
    days: [], // Array of { date, images }
    currentDayIndex: 0,
    currentImageIndex: 0,
    isOpen: false,
    startX: 0,
    startY: 0,
    threshold: 50,

    init() {
        this.el = document.getElementById('fs-viewer');
        this.img = document.getElementById('fs-img');
        this.closeBtn = document.getElementById('fs-close-btn');
        this.header = this.el.querySelector('.fs-header');
        
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        this.uiVisible = false;
        this.isLocked = false;
        this.viewCache = {}; // Cache for {scale, panX, panY} per image
        this.pinchStartDist = 0;

        if (this.closeBtn) {
            this.closeBtn.onclick = (e) => { e.stopPropagation(); this.close(); };
        }

        // Desktop click → toggle header visibility (ignore clicks inside header / nav buttons)
        this.el.addEventListener('click', (e) => {
            if (!this.isOpen || this.isLocked) return;
            if (e.target.closest('.fs-header, .fs-side-btn, .fs-corner-btn, .fs-zoom-slider-container')) return;
            // close any open dropdowns
            ['fs-pnl-dropdown','fs-trade-dropdown'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('open');
            });
            this.uiVisible = !this.uiVisible;
            this.updateUI();
        });

        // P&L pill dropdown
        const fsPnlPill = document.getElementById('fs-pnl-pill');
        if (fsPnlPill) {
            fsPnlPill.addEventListener('click', (e) => {
                e.stopPropagation();
                const dd = document.getElementById('fs-pnl-dropdown');
                const td = document.getElementById('fs-trade-dropdown');
                if (dd) dd.classList.toggle('open');
                if (td) td.classList.remove('open');
            });
        }

        // Trade pill dropdown
        const fsTradePill = document.getElementById('fs-trade-pill');
        if (fsTradePill) {
            fsTradePill.addEventListener('click', (e) => {
                e.stopPropagation();
                const td = document.getElementById('fs-trade-dropdown');
                const dd = document.getElementById('fs-pnl-dropdown');
                if (td) td.classList.toggle('open');
                if (dd) dd.classList.remove('open');
            });
        }

        // Date wrap → open date picker
        const fsDateWrap = this.el.querySelector('.fs-date-wrap');
        if (fsDateWrap) {
            fsDateWrap.addEventListener('click', (e) => {
                e.stopPropagation();
                const picker = document.getElementById('fs-date-picker');
                if (picker) {
                    try { picker.showPicker(); } catch(_) { picker.click(); }
                }
            });
        }

        // Touch events
        this.el.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.el.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.el.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        
        // Lock Mode Navigation
        this.navPrev = document.getElementById('fs-lock-prev');
        this.navNext = document.getElementById('fs-lock-next');
        this.navUp = document.getElementById('fs-lock-up');
        this.navDown = document.getElementById('fs-lock-down');

        if (this.navPrev) this.navPrev.onclick = (e) => { e.stopPropagation(); this.prevImg(); };
        if (this.navNext) this.navNext.onclick = (e) => { e.stopPropagation(); this.nextImg(); };
        if (this.navUp) this.navUp.onclick = (e) => { e.stopPropagation(); this.prevDay(); };
        if (this.navDown) this.navDown.onclick = (e) => { e.stopPropagation(); this.nextDay(); };

        // Zoom Slider
        this.zoomSlider = document.getElementById('fs-zoom-slider');
        this.zoomSliderContainer = document.getElementById('fs-zoom-slider-container');
        this.zoomLabel = document.getElementById('fs-zoom-label');

        if (this.zoomSlider) {
            this.zoomSlider.oninput = (e) => {
                this.scale = parseFloat(e.target.value);
                if (this.zoomLabel) this.zoomLabel.textContent = Math.round(this.scale) + 'x';
                if (this.scale === 1) {
                    this.panX = 0;
                    this.panY = 0;
                }
                this.render();
            };
        }

        // Keyboard support
        window.addEventListener('keydown', (e) => {
            if (!this.isOpen) return;
            if (e.key === 'Escape') this.close();
            if (e.key === 'ArrowLeft') this.prevImg();
            if (e.key === 'ArrowRight') this.nextImg();
            if (e.key === 'ArrowUp') this.prevDay();
            if (e.key === 'ArrowDown') this.nextDay();
        });
    },

    open(daysData, startDayIdx = 0, startImgIdx = 0, startLocked = false) {
        if (!daysData || !daysData.length) return;
        this.days = daysData;
        this.currentDayIndex = startDayIdx;
        this.currentImageIndex = startImgIdx;
        this.isOpen = true;
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        this.uiVisible = true;
        this.isLocked = startLocked;
        
        this.el.classList.add('open');
        this.updateUI();

        // Restore state if available
        this.restoreViewState(this.currentDayIndex, this.currentImageIndex);
        
        this.render();
        
        document.body.style.overflow = 'hidden';
    },

    close() {
        this.isOpen = false;
        this.el.classList.remove('open');
        document.body.style.overflow = '';
    },

    render() {
        const day = this.days[this.currentDayIndex];
        const url = day.images[this.currentImageIndex];
        
        this.img.style.opacity = '0';
        this.img.style.transform = `scale(${this.scale}) translate(${this.panX}px, ${this.panY}px)`;
        
        setTimeout(() => {
            this.img.src = typeof resolveImageUrl === 'function' ? resolveImageUrl(url) : url;
            this.img.style.opacity = '1';
        }, 50);

        this.renderDots();
        this.renderHeaderInfo();
    },

    renderHeaderInfo() {
        const day = this.days[this.currentDayIndex];
        const current = this.currentImageIndex + 1;
        const total = day.images.length;
        const tradeLabel = day.tradeLabel || `T${this.currentDayIndex + 1}`;

        // infoEl.textContent = `${tradeLabel}  ·  ${current}/${total}`; // Old format; replacing with structured rows

        const instEl = document.getElementById('fs-header-instrument');
        const hDate  = document.getElementById('fs-h-date');
        const hQty   = document.getElementById('fs-h-qty');
        const hPt    = document.getElementById('fs-h-pt');
        const hPnl   = document.getElementById('fs-h-pnl');

        if (instEl) {
            let inst = day.instr || day.instrument || tradeLabel;
            let qty = '—', pt = '—', pnlStr = '—', tradeDate = day.date || '—';
            let ptVal = 0, pnlVal = 0;

            if (typeof getTradesForDate === 'function') {
                const trades = getTradesForDate(day.date);
                const tIdx = trades.findIndex(t => (t.images || []).includes(day.images[this.currentImageIndex]));
                if (tIdx >= 0) {
                    const t = trades[tIdx];
                    inst = (t.Instrument || t.instrument || tradeLabel).toUpperCase();
                    qty  = t.Qty || t.qty || '—';
                    ptVal = parseFloat(t.Pt || t.pt || 0);
                    pt = Math.abs(Math.round(ptVal)) + ' Pt';
                    if (typeof getTradePnl === 'function') {
                        pnlVal = getTradePnl(t) || 0;
                        pnlStr = (pnlVal >= 0 ? '+₹' : '-₹') + Math.abs(Math.round(pnlVal)).toLocaleString('en-IN');
                    }
                }
            }

            instEl.textContent = inst;
            if (hDate) hDate.textContent = `Date: ${tradeDate}`;
            if (hQty)  hQty.textContent  = `Qty: ${qty}`;
            if (hPt) {
                hPt.textContent = `Pt: ${pt}`;
                hPt.style.color = ptVal >= 0 ? 'var(--green,#2ecc71)' : 'var(--red,#e74c3c)';
            }
            if (hPnl) {
                hPnl.textContent = `P&L: ${pnlStr}`;
                hPnl.style.color = pnlVal > 0 ? 'var(--green,#2ecc71)' : pnlVal < 0 ? 'var(--red,#e74c3c)' : 'inherit';
            }
        }

        // Update date picker
        const dp = document.getElementById('fs-date-picker');
        if (dp && this.days.length) {
            dp.value = day.date;
            const sorted = [...this.days].sort((a,b) => a.date.localeCompare(b.date));
            dp.min = sorted[0].date;
            dp.max = sorted[sorted.length-1].date;
        }

        // P&L pill + dropdowns
        const pnlWrap = document.getElementById('fs-pnl-wrap');
        const pnlPill = document.getElementById('fs-pnl-pill');
        const tradeWrap = document.getElementById('fs-trade-wrap');
        const tradePill = document.getElementById('fs-trade-pill');
        const pnlDd = document.getElementById('fs-pnl-dropdown');
        const tradeDd = document.getElementById('fs-trade-dropdown');

        if (pnlWrap && pnlPill && day.date && typeof getTradesForDate === 'function') {
            const trades = getTradesForDate(day.date);
            if (trades.length && typeof getTradePnl === 'function') {
                const fmt = v => (v >= 0 ? '+₹' : '-₹') + Math.abs(Math.round(v)).toLocaleString('en-IN');
                let total = 0;
                trades.forEach(t => { total += getTradePnl(t) || 0; });
                pnlPill.textContent = fmt(total);
                pnlPill.className = 'gv2-pnl-pill' + (total > 0 ? ' positive' : total < 0 ? '' : ' neutral');
                pnlWrap.style.display = '';

                // P&L dropdown: one row per trade — clicking navigates to that trade
                if (pnlDd) {
                    pnlDd.innerHTML = '';
                    // find all dayIndices that share this date (one per trade)
                    const sameDateIndices = this.days.reduce((acc, d, idx) => {
                        if (d.date === day.date) acc.push(idx);
                        return acc;
                    }, []);
                    trades.forEach((t, i) => {
                        const p = getTradePnl(t) || 0;
                        const colr = p > 0 ? '#2ecc71' : p < 0 ? '#e74c3c' : 'inherit';
                        const isActive = sameDateIndices[i] === this.currentDayIndex;
                        const row = document.createElement('div');
                        row.className = 'gv2-pnl-trade-row';
                        row.style.background = isActive ? 'rgba(255,255,255,0.06)' : '';
                        row.innerHTML = `<span class="gv2-pnl-trade-label">T${i+1}</span><span class="gv2-pnl-trade-val" style="color:${colr}">${fmt(p)}</span>`;
                        row.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const targetIdx = sameDateIndices[i];
                            if (targetIdx !== undefined) {
                                this.saveCurrentViewState();
                                this.currentDayIndex = targetIdx;
                                this.currentImageIndex = 0;
                                this.restoreViewState(targetIdx, 0);
                            }
                            pnlDd.classList.remove('open');
                            this.render();
                        });
                        pnlDd.appendChild(row);
                    });
                }

                // Trade pill: current image's trade (no instrument — just T1 · amount)
                const ownerIdx = trades.findIndex(t => (t.images||[]).includes(day.images[this.currentImageIndex]));
                if (ownerIdx >= 0 && tradeWrap && tradePill) {
                    const t = trades[ownerIdx];
                    const p = getTradePnl(t) || 0;
                    const cls = p > 0 ? 'pos' : p < 0 ? 'neg' : '';
                    tradePill.innerHTML = `<span class="gv2-tp-label">T${ownerIdx+1}</span><span class="gv2-tp-sep"> · </span><span class="gv2-tp-val ${cls}">${fmt(p)}</span>`;
                    tradeWrap.style.display = '';

                    // Trade dropdown: images in this trade
                    if (tradeDd) {
                        tradeDd.innerHTML = '';
                        (t.images||[]).forEach((img, i) => {
                            const row = document.createElement('div');
                            row.className = 'gv2-pnl-trade-row';
                            row.innerHTML = `<span class="gv2-pnl-trade-label">Image ${i+1}</span><span class="gv2-pnl-trade-val" style="color:rgba(255,255,255,0.5)">${i === this.currentImageIndex ? '● now' : ''}</span>`;
                            row.addEventListener('click', (e) => { e.stopPropagation(); this.currentImageIndex = i; tradeDd.classList.remove('open'); this.render(); });
                            tradeDd.appendChild(row);
                        });
                    }
                } else if (tradeWrap) { tradeWrap.style.display = 'none'; }
            } else { pnlWrap.style.display = 'none'; if (tradeWrap) tradeWrap.style.display = 'none'; }
        }
    },

    updateUI() {
        if (!this.el) return;
        const header = this.el.querySelector('.fs-header');

        const opacity = (this.uiVisible || this.isLocked) ? '1' : '0';
        const pointerEvents = (this.uiVisible || this.isLocked) ? 'auto' : 'none';

        if (header) {
            header.style.opacity = opacity;
            header.style.pointerEvents = pointerEvents;
            header.style.transition = 'opacity 0.2s linear, transform 0.2s linear';
            header.style.transform = (this.uiVisible || this.isLocked) ? 'translateY(0)' : 'translateY(-20px)';

            // Toggle Lock Icon
            const lockBtn = header.querySelector('.fs-lock-btn');
            if (lockBtn) {
                lockBtn.innerHTML = this.isLocked ? '🔒' : '🔓';
                lockBtn.style.background = this.isLocked ? 'rgba(79, 70, 229, 0.8)' : 'transparent';
                lockBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.isLocked = !this.isLocked;
                    if (this.isLocked) {
                        this.el.requestFullscreen?.().catch(err => console.log(err));
                    } else if (document.fullscreenElement) {
                        document.exitFullscreen?.();
                    }
                    this.updateUI();
                };
            }
        }

        const dotsContainer = document.getElementById('fs-dots');
        if (dotsContainer) dotsContainer.style.opacity = this.isLocked ? '0' : '1';

        [this.navPrev, this.navNext, this.navUp, this.navDown].forEach(btn => {
            if (btn) btn.style.display = this.isLocked ? 'flex' : 'none';
        });

        if (this.zoomSliderContainer) {
            this.zoomSliderContainer.style.display = this.isLocked ? 'flex' : 'none';
            if (this.zoomSlider) this.zoomSlider.value = this.scale;
            if (this.zoomLabel) this.zoomLabel.textContent = this.scale.toFixed(1) + 'x';
        }
    },

    renderDots() {
        const dotsContainer = document.getElementById('fs-dots');
        if (!dotsContainer) return;
        const images = this.days[this.currentDayIndex].images;
        dotsContainer.innerHTML = '';
        images.forEach((_, i) => {
            const dot = document.createElement('div');
            dot.className = `fs-dot ${i === this.currentImageIndex ? 'active' : ''}`;
            dotsContainer.appendChild(dot);
        });
    },

    saveCurrentViewState() {
        const url = this.days[this.currentDayIndex].images[this.currentImageIndex];
        if (!window._gvCache) window._gvCache = {};
        window._gvCache[url] = {
            scale: this.scale,
            panX: this.panX,
            panY: this.panY
        };
    },

    restoreViewState(dIdx, iIdx) {
        const url = this.days[dIdx]?.images[iIdx];
        const cached = window._gvCache ? window._gvCache[url] : null;
        if (cached) {
            this.scale = cached.scale;
            this.panX = cached.panX;
            this.panY = cached.panY;
        } else {
            this.panX = 0;
            this.panY = 0;
            // keep current scale
        }
    },

    nextImg() {
        const day = this.days[this.currentDayIndex];
        if (this.currentImageIndex < day.images.length - 1) {
            this.saveCurrentViewState();
            this.currentImageIndex++;
            this.restoreViewState(this.currentDayIndex, this.currentImageIndex);
            this.render();
        } else {
            this.nextDay();
        }
    },

    prevImg() {
        if (this.currentImageIndex > 0) {
            this.saveCurrentViewState();
            this.currentImageIndex--;
            this.restoreViewState(this.currentDayIndex, this.currentImageIndex);
            this.render();
        } else {
            this.prevDay();
        }
    },

    nextDay() {
        // Jump to next date (skip other trades on the same date)
        const currentDate = this.days[this.currentDayIndex].date;
        let nextIdx = this.currentDayIndex + 1;
        while (nextIdx < this.days.length && this.days[nextIdx].date === currentDate) nextIdx++;
        if (nextIdx < this.days.length) {
            this.saveCurrentViewState();
            this.currentDayIndex = nextIdx;
            this.currentImageIndex = 0;
            this.restoreViewState(this.currentDayIndex, 0);
            this.render();
        }
    },

    prevDay() {
        // Jump to prev date (skip other trades on the same date)
        const currentDate = this.days[this.currentDayIndex].date;
        let prevIdx = this.currentDayIndex - 1;
        while (prevIdx >= 0 && this.days[prevIdx].date === currentDate) prevIdx--;
        if (prevIdx >= 0) {
            this.saveCurrentViewState();
            this.currentDayIndex = prevIdx;
            this.currentImageIndex = 0;
            this.restoreViewState(this.currentDayIndex, 0);
            this.render();
        }
    },

    jumpToDate(dateStr) {
        if (!dateStr) return;
        const foundIdx = this.days.findIndex(d => d.date === dateStr);
        if (foundIdx !== -1) {
            this.saveCurrentViewState();
            this.currentDayIndex = foundIdx;
            this.currentImageIndex = 0;
            this.restoreViewState(this.currentDayIndex, 0);
            this.render();
        }
    },

    resetZoom() {
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
    },

    panResetOnly() {
        this.panX = 0;
        this.panY = 0;
    },

    panResetOnly() {
        this.panX = 0;
        this.panY = 0;
    },

    handleTouchStart(e) {
        if (e.touches.length === 2) {
            this.pinchStartDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            ) || 1;
            this.pinchStartScale = this.scale;
            this.isPinching = true;
        } else {
            this.isPinching = false;
            this.startX = e.touches[0].clientX;
            this.startY = e.touches[0].clientY;
            this.lastPanX = this.panX;
            this.lastPanY = this.panY;
            this.isMoving = true;
        }
    },

    handleTouchMove(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const ratio = dist / (this.pinchStartDist || 1);
            this.scale = Math.min(5, Math.max(1, this.pinchStartScale * ratio));
            this.img.style.transition = 'none'; // Instant response
            this.img.style.transform = `scale(${this.scale}) translate(${this.panX}px, ${this.panY}px)`;
        } else if (!this.isPinching) {
            if (!this.isMoving) return;
            if (this.scale > 1) {
                const dx = e.touches[0].clientX - this.startX;
                const dy = e.touches[0].clientY - this.startY;
                
                const boundaryX = (this.scale - 1) * 100;
                const boundaryY = (this.scale - 1) * 150;

                this.panX = Math.max(-boundaryX, Math.min(boundaryX, this.lastPanX + dx / this.scale));
                this.panY = Math.max(-boundaryY, Math.min(boundaryY, this.lastPanY + dy / this.scale));
                
                this.img.style.transition = 'none'; // Instant response
                this.img.style.transform = `scale(${this.scale}) translate(${this.panX}px, ${this.panY}px)`;
            } else {
                e.preventDefault(); 
            }
        }
    },

    handleTouchEnd(e) {
        if (!this.isMoving) return;
        this.isMoving = false;

        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const diffX = endX - this.startX;
        const diffY = endY - this.startY;
        
        // Tap handling
        if (Math.abs(diffX) < 8 && Math.abs(diffY) < 8) {
            if (this.isLocked) return;
            const now = Date.now();
            if (this.lastTap && (now - this.lastTap < 300)) {
                // Double tap: toggle zoom
                if (this.scale > 1) {
                    this.resetZoom();
                } else {
                    this.scale = 3;
                }
                this.img.style.transform = `scale(${this.scale}) translate(${this.panX}px, ${this.panY}px)`;
                this.lastTap = 0;
            } else {
                // Single tap: toggle UI only
                this.uiVisible = !this.uiVisible;
                this.updateUI();
                this.lastTap = now;
            }
            return;
        }

        if (this.scale > 1) return; // Swiping blocked if zoomed

        const swipeThreshold = 50;
        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (Math.abs(diffX) > swipeThreshold) {
                if (diffX > 0) this.prevImg();
                else this.nextImg();
            }
        } else {
            if (Math.abs(diffY) > swipeThreshold) {
                if (diffY > 0) this.prevDay();
                else this.nextDay();
            }
        }
    }
};

// Initialize after DOM loads
document.addEventListener('DOMContentLoaded', () => {
    FullscreenViewer.init();
});

// Helper to open from calendar or gallery
function openFullscreenFromAppContext(targetImages, currentUrl, startLocked = false) {
    const allDates = Object.keys(state.dayData || {}).sort((a,b) => new Date(b) - new Date(a));
    const items = []; // flat list of { date, tradeLabel, images } — one entry per trade

    if (!allDates.length) {
        items.push({ date: 'Journal', tradeLabel: 'T1', images: targetImages });
    } else {
        allDates.forEach(d => {
            // Day-level setup images
            const dayImgs = state.dayData[d]?.images || [];
            if (dayImgs.length) items.push({ date: d, tradeLabel: 'Day', images: dayImgs });

            // Each trade as its own entry
            (getTradesForDate(d) || []).forEach((t, i) => {
                const imgs = t.images || [];
                if (imgs.length) items.push({ date: d, tradeLabel: `T${i + 1}`, images: imgs });
            });

            // EOD/close images
            const closeImgs = state.dayData[d]?.closeImages || [];
            if (closeImgs.length) items.push({ date: d, tradeLabel: 'EOD', images: closeImgs });
        });
    }

    if (!items.length) {
        FullscreenViewer.open([{ date: 'Journal', tradeLabel: 'T1', images: targetImages }], 0, targetImages.indexOf(currentUrl), startLocked);
        return;
    }

    let dayIdx = -1;
    let imgIdx = -1;

    for (let i = 0; i < items.length; i++) {
        const idx = items[i].images.indexOf(currentUrl);
        if (idx !== -1) {
            dayIdx = i;
            imgIdx = idx;
            break;
        }
    }

    if (dayIdx === -1) {
        FullscreenViewer.open([{ date: 'Journal', tradeLabel: 'T1', images: targetImages }], 0, targetImages.indexOf(currentUrl), startLocked);
    } else {
        FullscreenViewer.open(items, dayIdx, imgIdx, startLocked);
    }
}


```

## File: `static/js/pdf-handler.js`
```js
/**
 * @fileoverview pdf-handler.js
 * @description Handles PDF file selection, page rendering via pdf.js, 
 *              and importing selected pages as images into the journal.
 *              Also maintains a list of imported PDFs.
 */

const PdfHandler = (() => {
  let pdfDoc = null;
  const pdfDocCache = new Map(); // pdfId -> doc
  let pageCanvases = [];
  let currentFileName = '';
  let currentFile = null;
  let sortCol = 'timestamp'; // 'name', 'timestamp', 'size'
  let sortDir = -1; // 1 = asc, -1 = desc (desc default for date)

  function init() {
    console.log('[PdfHandler] Initializing...');
    const importBtn = document.getElementById('pdf-import-btn');
    const listBtn = document.getElementById('pdf-list-btn');
    const importInput = document.getElementById('pdf-import-input');
    
    // Preview Modal Elements
    const viewerCloseBtn = document.getElementById('pdf-viewer-close');
    const viewerCancelBtn = document.getElementById('pdf-viewer-cancel');
    const viewerDoneBtn = document.getElementById('pdf-import-done-btn');
    const selectAllCheck = document.getElementById('pdf-select-all');

    // List Modal Elements
    const listCloseBtn = document.getElementById('pdf-list-close');

    if (importBtn && importInput) {
      importBtn.onclick = (e) => {
        e.preventDefault();
        importInput.click();
      };
      importInput.onchange = (e) => handleFileSelect(e);
    }

    if (listBtn) {
      listBtn.onclick = () => {
        console.log('[PdfHandler] List button clicked');
        openListModal();
      };
    }
    
    const galleryPdfBtn = document.getElementById('gv2-pdf-library-btn');
    if (galleryPdfBtn) {
       galleryPdfBtn.onclick = () => openListModal();
    }

    if (viewerCloseBtn) viewerCloseBtn.onclick = () => closeViewer();
    if (viewerCancelBtn) viewerCancelBtn.onclick = () => closeViewer();
    if (selectAllCheck) {
      selectAllCheck.onchange = (e) => {
        const selected = e.target.checked;
        document.querySelectorAll('.pdf-page-thumb').forEach(thumb => {
          if (selected) thumb.classList.add('selected');
          else thumb.classList.remove('selected');
        });
      };
    }

    if (viewerDoneBtn) viewerDoneBtn.onclick = () => importSelected();

    if (listCloseBtn) listCloseBtn.onclick = () => closeListModal();

    // Bind Header Sorting
    const hName = document.querySelector('.pdf-head-name');
    const hDate = document.querySelector('.pdf-head-date');
    const hSize = document.querySelector('.pdf-head-size');
    if (hName) hName.onclick = () => toggleSort('name');
    if (hDate) hDate.onclick = () => toggleSort('timestamp');
    if (hSize) hSize.onclick = () => toggleSort('size');

    // Direct PDF upload (store file only, no page preview)
    const listUploadBtn = document.getElementById('pdf-list-upload-btn');
    const listUploadInput = document.getElementById('pdf-list-upload-input');
    if (listUploadBtn && listUploadInput) {
      listUploadBtn.onclick = () => listUploadInput.click();
      listUploadInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type !== 'application/pdf') {
          if (typeof showToast === 'function') showToast('Please select a valid PDF file', 'error');
          return;
        }
        await _handlePdfUploadWithProgress(file);
        e.target.value = '';
      };
    }
    
    // Set worker source for pdf.js
    if (window.pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/static/js/vendor/pdf.worker.min.js';
    } else {
      console.warn('[PdfHandler] pdfjsLib not found in window');
    }
  }

  async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      if (typeof showToast === 'function') showToast('Please select a valid PDF file', 'error');
      return;
    }

    currentFileName = file.name;
    currentFile = file;

    try {
      if (typeof showToast === 'function') showToast('Processing PDF...', 'info');
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      pdfDoc = await loadingTask.promise;
      renderAllPages();
    } catch (err) {
      console.error('PDF Load Error:', err);
      if (typeof showToast === 'function') showToast('Failed to load PDF', 'error');
    }

    // Reset input
    e.target.value = '';
  }

  async function uploadPdfToServer(file) {
    try {
      return await imageService.uploadPdf(file);
    } catch (err) {
      console.error('[PdfHandler] Failed to upload PDF to server:', err);
      return null;
    }
  }

  async function renderAllPages() {
    const container = document.getElementById('pdf-viewer-body');
    const stats = document.getElementById('pdf-viewer-stats');
    if (!container) return;
    
    container.innerHTML = '<div style="grid-column: 1/-1; color: #8b949e; text-align: center; padding: 60px; font-size: 1.1rem; font-weight: 600;">Rendering pages... Please wait.</div>';
    
    const numPages = pdfDoc.numPages;
    if (stats) stats.textContent = `${numPages} Pages`;
    pageCanvases = [];
    
    container.innerHTML = '';
    
    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 1.2 });
        
        const thumbWrapper = document.createElement('div');
        thumbWrapper.className = 'pdf-page-thumb selected';
        thumbWrapper.dataset.pageNum = i;
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
        thumbWrapper.appendChild(canvas);
        
        const check = document.createElement('div');
        check.className = 'pdf-page-check';
        check.innerHTML = '&#10003;';
        thumbWrapper.appendChild(check);
        
        const numLabel = document.createElement('div');
        numLabel.className = 'pdf-page-num';
        numLabel.textContent = `Page ${i}`;
        thumbWrapper.appendChild(numLabel);
        
        thumbWrapper.onclick = () => {
          thumbWrapper.classList.toggle('selected');
          updateSelectAllState();
        };
        
        container.appendChild(thumbWrapper);
        pageCanvases.push({ pageNum: i, canvas });
      } catch (err) {
        console.error(`Error rendering page ${i}:`, err);
      }
    }
    
    const modal = document.getElementById('pdf-viewer-modal');
    if (modal) modal.style.display = 'flex';
  }

  function updateSelectAllState() {
    const all = document.querySelectorAll('.pdf-page-thumb');
    const selected = document.querySelectorAll('.pdf-page-thumb.selected');
    const selectAllCheck = document.getElementById('pdf-select-all');
    if (selectAllCheck) {
      selectAllCheck.checked = all.length === selected.length;
      selectAllCheck.indeterminate = selected.length > 0 && selected.length < all.length;
    }
  }

  function closeViewer() {
    const modal = document.getElementById('pdf-viewer-modal');
    if (modal) modal.style.display = 'none';
    pdfDoc = null;
    pageCanvases = [];
    currentFileName = '';
    currentFile = null;
  }

  async function openPdfInGallery(pdfOrId) {
    // Accept either a pdf object {filename, name, pages, url} or just a filename string
    let pdf = pdfOrId;
    if (typeof pdfOrId === 'string') {
      const list = await imageService.listPdfs() || [];
      pdf = list.find(p => p.filename === pdfOrId || p.name === pdfOrId);
      if (!pdf) { if (typeof showToast === 'function') showToast('PDF not found', 'error'); return; }
    }

    closeListModal();

    const pages = pdf.pages || [];
    if (pages.length === 0) {
      if (typeof showToast === 'function') showToast('PDF has no processed pages yet', 'error');
      return;
    }

    // Open gallery if not open
    const gModal = document.getElementById('gallery-modal');
    if (gModal && !gModal.classList.contains('open')) {
      if (typeof openGallery === 'function') openGallery();
    }

    currentFileName = pdf.name;
    currentFile     = pdf;

    state.gallery.mode         = 'pdf';
    state.gallery.date         = null;
    state.gallery.pdf          = { name: pdf.name, filename: pdf.filename, url: pdf.url, pages };
    state.gallery.images       = [...pages];
    state.gallery.currentIndex = 0;

    registerActivePdf({ id: pdf.filename, name: pdf.name, url: pdf.url, filename: pdf.filename });

    if (typeof renderGallery === 'function') renderGallery();
  }

  function registerActivePdf(pdf) {
    if (!pdf || !pdf.filename) return;
    if (!state.gallery.activePdfs) state.gallery.activePdfs = [];
    
    const exists = state.gallery.activePdfs.find(p => p.id === pdf.filename);
    if (!exists) {
      state.gallery.activePdfs.push({
        id: pdf.filename,
        name: pdf.name || pdf.filename,
        url: pdf.url
      });
      // Re-render gallery to show the new tab
      if (typeof renderGallery === 'function') renderGallery();
    }
  }

  function unregisterActivePdf(pdfId) {
    state.gallery.activePdfs = state.gallery.activePdfs.filter(p => p.id !== pdfId);
    if (typeof renderGallery === 'function') renderGallery();
  }

  async function getDocById(pdfId) {
    if (pdfDocCache.has(pdfId)) return pdfDocCache.get(pdfId);
    
    let pdfList = [];
    try {
      pdfList = await imageService.listPdfs() || [];
    } catch(e) { console.error(e); }

    const pdf = pdfList.find(p => p.filename === pdfId || p.name === pdfId);
    if (!pdf) return null;
    
    try {
        const response = await fetch(pdf.url);
        const arrayBuffer = await response.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        pdfDocCache.set(pdfId, doc);
        return doc;
    } catch(e) {
        console.error('[PdfHandler] getDocById failed', e);
        return null;
    }
  }

  async function ensurePdfLoaded(pdfId) {
     const doc = await getDocById(pdfId);
     if (doc) {
       pdfDoc = doc;
       const pdfList = await imageService.listPdfs() || [];
       currentFile = pdfList.find(p => p.filename === pdfId || p.name === pdfId); 
       currentFileName = currentFile?.name || pdfId;
       
       // Auto-register in workspace bar
       if (currentFile) registerActivePdf(currentFile);
       
       return true;
     }
     return false;
  }

  async function prefetchAdjacentPages(pageNum, doc, count = 2) {
      if (!doc) return;
      const total = doc.numPages;
      for (let i = 1; i <= count; i++) {
          const next = pageNum + i;
          const prev = pageNum - i;
          if (next <= total) doc.getPage(next).catch(() => {});
          if (prev >= 1) doc.getPage(prev).catch(() => {});
      }
  }

  async function renderPageToMainCanvas(pageNum, pdfId) {
    const canvas = document.getElementById('pdf-main-canvas');
    if (!canvas) return;
    
    const doc = await getDocById(pdfId);
    if (!doc) return;
    
    // Show spinner overlay if busy
    canvas.style.opacity = '0.7';

    try {
        const page = await doc.getPage(pageNum);
        const pixelRatio = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: 1.8 * pixelRatio }); // HD rendering
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        canvas.style.display = 'block';
        canvas.style.opacity = '1';

        // Background prefetches
        prefetchAdjacentPages(pageNum, doc);

        // Manually trigger pin sync
        if (typeof renderTagPins === 'function') renderTagPins();
        if (typeof loadOverlayForCurrentImage === 'function') loadOverlayForCurrentImage();

    } catch (err) {
        console.error(`[PdfHandler] Error rendering main page ${pageNum}:`, err);
        canvas.style.opacity = '1';
    }
  }

  async function importSelected() {
    const selectedThumbs = document.querySelectorAll('.pdf-page-thumb.selected');
    if (selectedThumbs.length === 0) {
      if (typeof showToast === 'function') showToast('No pages selected', 'info');
      return;
    }

    if (typeof showToast === 'function') showToast(`Importing ${selectedThumbs.length} pages...`, 'info');
    
    let dateToUse = state.gallery.date;
    if (!dateToUse && state.year !== undefined && state.month !== undefined) {
       const today = new Date();
       if (today.getFullYear() === state.year && today.getMonth() === state.month) {
          dateToUse = `${state.year}-${String(state.month + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
       } else {
          dateToUse = `${state.year}-${String(state.month + 1).padStart(2, '0')}-01`;
       }
    }
    if (!dateToUse) dateToUse = new Date().toISOString().split('T')[0];
    
    const uploadedUrls = [];
    
    for (const thumb of selectedThumbs) {
      const pageNum = parseInt(thumb.dataset.pageNum);
      const canvasObj = pageCanvases.find(c => c.pageNum === pageNum);
      if (!canvasObj) continue;
      
      const canvas = canvasObj.canvas;
      
      try {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        const file = new File([blob], `pdf_page_${pageNum}.jpg`, { type: 'image/jpeg' });
        
        if (typeof imageService !== 'undefined' && imageService.uploadImage) {
          const result = await imageService.uploadImage(file);
          if (result && result.url) {
            uploadedUrls.push(result.url);
          }
        }
      } catch (err) {
        console.error(`Failed to upload page ${pageNum}:`, err);
      }
    }

    if (uploadedUrls.length > 0) {
      if (!state.dayData[dateToUse]) state.dayData[dateToUse] = { images: [], newsImages: [], closeImages: [] };
      if (!state.dayData[dateToUse].images) state.dayData[dateToUse].images = [];

      state.dayData[dateToUse].images.push(...uploadedUrls);

      // Upload original PDF file to server for the PDF List
      if (currentFile) {
        await uploadPdfToServer(currentFile);
      }

      // Save to importedPdfs list
      if (!state.importedPdfs) state.importedPdfs = [];
      state.importedPdfs.unshift({
        name: currentFileName || 'Untitled PDF',
        date: dateToUse,
        images: uploadedUrls,
        timestamp: Date.now()
      });

      if (typeof saveTrades === 'function') {
        await saveTrades();
      } else if (typeof tradeService !== 'undefined' && tradeService.saveTrades) {
         await tradeService.saveTrades({ trades: state.trades, columns: state.columns, allTags: state.allTags, tagColumns: state.tagColumns, userColumns: state.userColumns, dayData: state.dayData, importedPdfs: state.importedPdfs, tagGroups: state.tagGroups });
      }
      
      if (typeof renderGallery === 'function' && document.getElementById('gallery-modal') && document.getElementById('gallery-modal').classList.contains('open')) {
        if (typeof getImagesForDate === 'function') {
          state.gallery.images = getImagesForDate(dateToUse);
        }
        renderGallery();
      }
      
      if (typeof renderTable === 'function') renderTable();
      if (typeof renderCalendar === 'function') renderCalendar();
      
      if (typeof showToast === 'function') showToast(`Successfully imported ${uploadedUrls.length} pages to ${dateToUse}`, 'success');
      closeViewer();
    } else {
      if (typeof showToast === 'function') showToast('Failed to import pages', 'error');
    }
  }

  // ── PDF List Modal Logic ──
  
  function openListModal() {
    const modal = document.getElementById('pdf-list-modal');
    if (modal) modal.style.display = 'flex';
    else { console.error('[PdfHandler] pdf-list-modal not found in DOM'); return; }
    renderPdfList();
  }

  function closeListModal() {
    const modal = document.getElementById('pdf-list-modal');
    if (modal) modal.style.display = 'none';
  }

  async function renderPdfList() {
    const listBody = document.getElementById('pdf-list-body');
    const listCount = document.getElementById('pdf-list-count');
    if (!listBody) return;

    listBody.innerHTML = '<div style="text-align:center; padding:60px; color:#8b949e;">Loading PDFs...</div>';

    let serverPdfs = [];
    try {
      serverPdfs = await imageService.listPdfs() || [];
    } catch (err) {
      console.error('[PdfHandler] Failed to fetch PDF list:', err);
    }

    if (listCount) listCount.textContent = `${serverPdfs.length} File${serverPdfs.length !== 1 ? 's' : ''}`;

    // Apply Sorting
    serverPdfs.sort((a, b) => {
      let valA = a[sortCol];
      let valB = b[sortCol];
      
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      
      if (valA < valB) return -1 * sortDir;
      if (valA > valB) return 1 * sortDir;
      return 0;
    });

    // Update Header Arrows
    updateHeaderArrows();

    if (serverPdfs.length === 0) {
      listBody.innerHTML = `
        <div class="pdf-empty-state">
          <div style="font-size: 3rem;">📄</div>
          <div style="font-size: 1.1rem; font-weight: 500;">No PDFs uploaded yet</div>
          <p style="color: #6e7681; font-size: 0.9rem; max-width: 300px; margin: 0 auto 15px;">Your imported PDF documents will appear here for easy access.</p>
          <button class="btn btn-primary" onclick="document.getElementById('pdf-list-modal').style.display='none'; document.getElementById('pdf-import-input').click();">Import Your First PDF</button>
        </div>
      `;
      return;
    }

    listBody.innerHTML = serverPdfs.map((pdf) => {
      const sizeMB = (pdf.size / 1024 / 1024).toFixed(2);
      const d = new Date(pdf.timestamp);
      const dateStr = d.toLocaleDateString() + ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const safeName = pdf.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeFilename = encodeURIComponent(pdf.filename);
      const pdfJson = JSON.stringify(pdf).replace(/"/g, '&quot;');
      
      const thumbHtml = pdf.pages && pdf.pages.length
        ? `<img src="${pdf.pages[0]}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;border:1px solid rgba(255,255,255,0.1);" loading="lazy">`
        : `<div style="font-size:1.2rem;">📄</div>`;
      return `
        <div class="pdf-item-row" onclick="PdfHandler.openPdfInGallery(${pdfJson})">
          <div class="pdf-item-icon">${thumbHtml}</div>
          <div class="pdf-item-name" title="${safeName}">${safeName}</div>
          <div class="pdf-item-date">${dateStr}</div>
          <div class="pdf-item-size">${sizeMB} MB</div>
          <div class="pdf-menu-container">
            <button class="pdf-menu-btn" onclick="event.stopPropagation(); PdfHandler.togglePdfMenu(this)">⋮</button>
            <div class="pdf-dropdown-menu">
              <a class="pdf-menu-item" href="${pdf.url}" target="_blank">
                <span>👁️</span> View
              </a>
              <a class="pdf-menu-item" href="${pdf.url}" download="${safeName}">
                <span>⬇️</span> Download
              </a>
              <div class="pdf-menu-item delete" onclick="PdfHandler.deletePdfFile('${safeFilename}', this)">
                <span>🗑️</span> Delete
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function toggleSort(col) {
    if (sortCol === col) {
      sortDir *= -1;
    } else {
      sortCol = col;
      sortDir = (col === 'timestamp' ? -1 : 1); // Default to desc for dates, asc for others
    }
    renderPdfList();
  }

  function updateHeaderArrows() {
    const heads = {
      name: document.querySelector('.pdf-head-name'),
      timestamp: document.querySelector('.pdf-head-date'),
      size: document.querySelector('.pdf-head-size')
    };
    
    Object.keys(heads).forEach(k => {
      if (!heads[k]) return;
      // Remove existing arrow if any
      const existing = heads[k].querySelector('.sort-arrow');
      if (existing) existing.remove();
      
      if (k === sortCol) {
        const arrow = document.createElement('span');
        arrow.className = 'sort-arrow';
        arrow.style.marginLeft = '8px';
        arrow.style.fontSize = '0.7rem';
        arrow.style.color = 'var(--blue, #58a6ff)';
        arrow.textContent = sortDir === 1 ? '▲' : '▼';
        heads[k].appendChild(arrow);
      }
    });
  }

  function togglePdfMenu(btn) {
    const menu = btn.nextElementSibling;
    const isVisible = menu.classList.contains('show');
    
    // Close all other menus first
    document.querySelectorAll('.pdf-dropdown-menu').forEach(m => m.classList.remove('show'));
    
    if (!isVisible) {
      menu.classList.add('show');
    }
  }

  // Global click listener to close dropdowns
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.pdf-menu-container')) {
      document.querySelectorAll('.pdf-dropdown-menu').forEach(m => m.classList.remove('show'));
    }
  });

  async function deletePdfFile(encodedFilename, btnEl) {
    if (!confirm('Delete this PDF file permanently?')) return;
    const filename = decodeURIComponent(encodedFilename);
    try {
      const res = await imageService.deletePdf(filename);
      if (res) {
        if (typeof showToast === 'function') showToast('PDF deleted', 'success');
        renderPdfList();
      } else {
        if (typeof showToast === 'function') showToast('Failed to delete PDF', 'error');
      }
    } catch (err) {
      console.error('[PdfHandler] Delete failed:', err);
      if (typeof showToast === 'function') showToast('Delete failed', 'error');
    }
  }

  // ── Progress bar helpers ──────────────────────────────────────────────────

  function _showProgressBar(visible) {
    const el = document.getElementById('pdf-upload-progress');
    if (el) el.style.display = visible ? 'block' : 'none';
  }

  function _setProgress(pct, label, sub, isError) {
    const fill  = document.getElementById('pdf-progress-fill');
    const pctEl = document.getElementById('pdf-progress-pct');
    const lbl   = document.getElementById('pdf-progress-label');
    const subEl = document.getElementById('pdf-progress-sub');
    if (fill) {
      fill.style.width      = Math.min(100, pct) + '%';
      fill.style.background = isError
        ? 'linear-gradient(90deg,#da3633,#f85149)'
        : 'linear-gradient(90deg,#238636,#2ea043)';
    }
    if (pctEl) pctEl.textContent = isError ? 'Error' : (Math.min(100, Math.round(pct)) + '%');
    if (lbl) lbl.style.color = isError ? '#f85149' : '#c9d1d9';
    if (lbl && label)  lbl.textContent = label;
    if (subEl && sub !== undefined) subEl.textContent = sub;
  }

  function _showProgressError(msg, detail) {
    _showProgressBar(true);
    _setProgress(100, msg, detail || '', true);
    setTimeout(() => _showProgressBar(false), 5000);
  }

  // XHR upload → returns job_id, tracking upload bytes progress (0→15%)
  function _uploadPdfXhr(file, onUploadPct) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const fd  = new FormData();
      fd.append('pdf', file, file.name);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onUploadPct) onUploadPct(e.loaded / e.total);
      });
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.job_id) resolve(data.job_id);
            else reject(new Error(data.error || 'No job_id returned'));
          } catch (e) { reject(e); }
        } else {
          reject(new Error('HTTP ' + xhr.status));
        }
      });
      xhr.addEventListener('error', () => reject(new Error('Network error')));
      xhr.open('POST', '/api/upload-pdf');
      xhr.send(fd);
    });
  }

  async function _handlePdfUploadWithProgress(file) {
    _showProgressBar(true);
    _setProgress(0, 'Uploading file...', file.name);

    let jobId;
    try {
      jobId = await _uploadPdfXhr(file, (ratio) => {
        _setProgress(ratio * 15, 'Uploading file...', file.name);
      });
    } catch (err) {
      _showProgressError('Upload failed', err.message);
      return;
    }

    _setProgress(15, 'Processing pages...', 'Starting...');

    // SSE for page processing progress
    const source = new EventSource('/api/pdf-job/' + jobId);

    source.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.status === 'done') {
          source.close();
          _setProgress(100, 'Done!', '');
          setTimeout(() => {
            _showProgressBar(false);
            renderPdfList();
            const pageCount = (data.record?.pages || []).length;
            if (typeof showToast === 'function')
              showToast(file.name + ' — ' + pageCount + ' pages ready', 'success');
          }, 700);

        } else if (data.status === 'error') {
          source.close();
          _showProgressError('Processing failed', data.error || 'unknown error');

        } else {
          // processing — current/total from backend
          const cur   = data.current || 0;
          const total = data.total   || 0;
          const pct   = total > 0 ? 15 + Math.round((cur / total) * 85) : 15;
          const sub   = total > 0 ? `Page ${cur} of ${total}` : 'Processing...';
          _setProgress(pct, 'Processing pages...', sub);
        }
      } catch (err) {
        console.error('[PdfHandler] SSE parse error', err);
      }
    };

    source.onerror = () => {
      source.close();
      _showProgressError('Connection lost', 'Processing may still continue — please refresh');
    };
  }

  function renderPdfGalleryThumbs(container) {
    if (!container || !pdfDoc) return;
    const numPages = pdfDoc.numPages;
    const currentIndex = state.gallery.currentIndex;

    container.innerHTML = '';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    container.style.padding = '8px';

    const pdfId = currentFile?.filename || currentFile?.name;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const pageNum = parseInt(entry.target.dataset.page);
                renderThumbPage(pageNum, entry.target, pdfId);
                observer.unobserve(entry.target);
            }
        });
    }, { root: container, threshold: 0.1, rootMargin: '200px' });

    for (let i = 1; i <= numPages; i++) {
        const thumbWrap = document.createElement('div');
        thumbWrap.className = `gv2-thumb-item ${currentIndex === (i-1) ? 'active' : ''}`;
        thumbWrap.style.cssText = 'width:100%; aspect-ratio:3/4; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden; position:relative; cursor:pointer; flex-shrink:0; border:2px solid transparent;';
        if (currentIndex === (i-1)) thumbWrap.style.borderColor = 'var(--blue)';
        
        thumbWrap.dataset.page = i;
        
        const numLabel = document.createElement('div');
        numLabel.style.cssText = 'position:absolute; bottom:4px; right:4px; font-size:10px; background:rgba(0,0,0,0.6); color:#fff; padding:2px 5px; border-radius:3px; z-index:2;';
        numLabel.textContent = i;
        thumbWrap.appendChild(numLabel);

        thumbWrap.onclick = () => {
            state.gallery.currentIndex = i - 1;
            if (typeof renderGallery === 'function') renderGallery();
        };

        container.appendChild(thumbWrap);
        observer.observe(thumbWrap);
    }
  }

  async function renderThumbPage(pageNum, container, pdfId) {
      if (!pdfId) pdfId = currentFile?.filename || currentFile?.name;
      if (!pdfId) return;
      const doc = await getDocById(pdfId);
      if (!doc) return;
      try {
          const page = await doc.getPage(pageNum);
          const pixelRatio = window.devicePixelRatio || 1;
          const viewport = page.getViewport({ scale: 0.3 * pixelRatio }); // Small scale for thumb
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.cssText = 'width:100%; height:100%; object-fit:contain;';
          const context = canvas.getContext('2d');
          
          await page.render({ canvasContext: context, viewport }).promise;
          
          // Clear before append to avoid ghosting or double-render
          container.querySelectorAll('canvas').forEach(c => c.remove());
          container.appendChild(canvas);
          
          // Fade in effect
          canvas.style.opacity = '0';
          canvas.style.transition = 'opacity 0.3s ease';
          setTimeout(() => canvas.style.opacity = '1', 50);
      } catch (err) {
          console.error(`[PdfHandler] Thumb render error page ${pageNum}:`, err);
      }
  }

  const _public = {
    init,
    deletePdfFile,
    openListModal,
    closeListModal,
    togglePdfMenu,
    openPdfInGallery,
    renderPageToMainCanvas,
    renderPdfGalleryThumbs,
    renderThumbPage,
    ensurePdfLoaded,
    prefetchAdjacentPages,
    registerActivePdf,
    unregisterActivePdf
  };

  // Assign to window for global access
  window.PdfHandler = _public;

  return _public;
})();

// Initialize 
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => PdfHandler.init());
} else {
  PdfHandler.init();
}

```

## File: `static/js/pdf-handler-b.js`
- Missing from workspace
