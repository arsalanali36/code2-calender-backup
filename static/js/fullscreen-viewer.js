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
        this.caption = document.getElementById('fs-caption');
        this.likes = document.getElementById('fs-likes');
        this.header = this.el.querySelector('.fs-header');
        this.sidebar = this.el.querySelector('.fs-sidebar');
        this.bottom = this.el.querySelector('.fs-bottom');
        
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

    open(daysData, startDayIdx = 0, startImgIdx = 0) {
        if (!daysData || !daysData.length) return;
        this.days = daysData;
        this.currentDayIndex = startDayIdx;
        this.currentImageIndex = startImgIdx;
        this.isOpen = true;
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        this.uiVisible = false;
        this.isLocked = false;
        
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

        this.caption.innerHTML = `<span style="font-weight:900; color:#fff">${day.tradeLabel || 'Trade'}</span> • ${day.date}<br>Live Market Analysis`;
        
        if (this.likes) this.likes.textContent = Math.floor(Math.random() * 2000) + 500;
    },

    renderHeaderInfo() {
        const infoEl = document.getElementById('fs-header-info');
        if (!infoEl) return;
        
        const day = this.days[this.currentDayIndex];
        const dateParts = day.date.split('-');
        const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
        
        const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const dayNum = date.getDate();
        const dateStr = `${weekday} ${month} ${dayNum}`;
        
        const total = day.images.length;
        const current = this.currentImageIndex + 1;
        const tradeLabel = day.tradeLabel || `T${this.currentDayIndex + 1}`;

        const dot = `<span style="color:#6366f1; margin:0 2px">•</span>`;
        infoEl.innerHTML = `<span>${dateStr}</span> ${dot} <span>${tradeLabel}</span> ${dot} <span>${current}/${total}</span>`;

        // Update date picker constraints
        const dp = document.getElementById('fs-date-picker');
        if (dp && this.days.length) {
            dp.value = day.date;
            const sorted = [...this.days].sort((a,b) => a.date.localeCompare(b.date));
            dp.min = sorted[0].date;
            dp.max = sorted[sorted.length-1].date;
        }
    },

    updateUI() {
        if (!this.el) return;
        const header = this.el.querySelector('.fs-header');
        const sidebar = this.el.querySelector('.fs-sidebar');
        const bottom = this.el.querySelector('.fs-bottom');
        
        const opacity = (this.uiVisible || this.isLocked) ? '1' : '0';
        const contentOpacity = (this.uiVisible && !this.isLocked) ? '1' : '0';
        const pointerEvents = (this.uiVisible || this.isLocked) ? 'auto' : 'none';
        const contentPointerEvents = (this.uiVisible && !this.isLocked) ? 'auto' : 'none';
        
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
        if (sidebar) { 
            sidebar.style.opacity = contentOpacity; 
            sidebar.style.pointerEvents = contentPointerEvents; 
            sidebar.style.transition = 'opacity 0.2s linear, transform 0.2s linear'; 
            sidebar.style.transform = (this.uiVisible && !this.isLocked) ? 'translateX(0)' : 'translateX(20px)'; 
        }
        if (bottom) { 
            bottom.style.opacity = contentOpacity; 
            bottom.style.pointerEvents = contentPointerEvents; 
            bottom.style.transition = 'opacity 0.2s linear, transform 0.2s linear'; 
            bottom.style.transform = (this.uiVisible && !this.isLocked) ? 'translateY(0)' : 'translateY(20px)'; 
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
function openFullscreenFromAppContext(targetImages, currentUrl) {
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
        FullscreenViewer.open([{ date: 'Journal', tradeLabel: 'T1', images: targetImages }], 0, targetImages.indexOf(currentUrl));
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
        FullscreenViewer.open([{ date: 'Journal', tradeLabel: 'T1', images: targetImages }], 0, targetImages.indexOf(currentUrl));
    } else {
        FullscreenViewer.open(items, dayIdx, imgIdx);
    }
}

