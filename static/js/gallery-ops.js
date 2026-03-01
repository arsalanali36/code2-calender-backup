function getOwnerTradeForImageUrl(imageUrl) {
    if (!imageUrl) return null;
    if (state.gallery.sourceRow !== null && state.trades[state.gallery.sourceRow]?.images?.includes(imageUrl)) {
        return state.trades[state.gallery.sourceRow];
    }
    if (state.gallery.date) {
        const row = getTradesForDate(state.gallery.date).find(t => (t.images || []).includes(imageUrl));
        if (row) return row;
        return null;
    }
    return state.trades.find(t => (t.images || []).includes(imageUrl)) || null;
}

function syncGalleryImageOrderToTrades() {
    const ordered = state.gallery.images || [];
    if (state.gallery.sourceRow !== null && state.trades[state.gallery.sourceRow]) {
        const t = state.trades[state.gallery.sourceRow];
        const own = new Set(t.images || []);
        t.images = ordered.filter(u => own.has(u));
        return;
    }
    if (state.gallery.date) {
        const dk = state.gallery.date;
        if (state.dayData[dk]?.images) {
            const dayOwn = new Set(state.dayData[dk].images);
            state.dayData[dk].images = ordered.filter(u => dayOwn.has(u));
        }
        const dayTrades = getTradesForDate(dk);
        dayTrades.forEach(t => {
            const own = new Set(t.images || []);
            t.images = ordered.filter(u => own.has(u));
        });
        return;
    }
    const trade = getOwnerTradeForGalleryImage();
    if (trade) {
        const own = new Set(trade.images || []);
        trade.images = ordered.filter(u => own.has(u));
    }
}

async function reorderGalleryImages(fromIdx, toIdx) {
    const arr = state.gallery.images || [];
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= arr.length || toIdx >= arr.length) return;
    const currentUrl = arr[state.gallery.currentIndex];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    state.gallery.currentIndex = Math.max(0, arr.indexOf(currentUrl));
    syncGalleryImageOrderToTrades();
    await saveTrades();
    renderGallery();
    renderTable();
}

async function moveGalleryImageToDate(globalIdx, targetDate) {
    const arr = state.gallery.images || [];
    if (globalIdx < 0 || globalIdx >= arr.length) return;
    const imageUrl = arr[globalIdx];

    const ownerTrade = getOwnerTradeForImageUrl(imageUrl);
    if (ownerTrade) {
        ownerTrade.images = (ownerTrade.images || []).filter(u => u !== imageUrl);
    } else if (state.gallery.date && state.dayData[state.gallery.date]?.images) {
        state.dayData[state.gallery.date].images = state.dayData[state.gallery.date].images.filter(u => u !== imageUrl);
    }

    let targetTrade = getTradeForDate(targetDate);
    if (!targetTrade) {
        targetTrade = getOrCreateTrade(targetDate);
    }
    if (!targetTrade.images) targetTrade.images = [];
    targetTrade.images.push(imageUrl);

    arr.splice(globalIdx, 1);
    if (state.gallery.currentIndex >= arr.length) state.gallery.currentIndex = Math.max(0, arr.length - 1);

    if (!arr.length) {
        await saveTrades();
        renderTable();
        renderCalendar();
        document.getElementById('gallery-modal').classList.remove('open');
        unlockBodyScroll();
        showToast(`Image moved to ${targetDate}`, 'success');
        return;
    }
    syncGalleryImageOrderToTrades();
    await saveTrades();
    renderGallery();
    renderTable();
    renderCalendar();
    showToast(`Image moved to ${targetDate}`, 'success');
}

async function removeGalleryImageAt(idx) {
    const arr = state.gallery.images || [];
    if (idx < 0 || idx >= arr.length) return;
    const imageUrl = arr[idx];
    if (state._localOverlays?.[imageUrl]) delete state._localOverlays[imageUrl];
    const ownerTrade = getOwnerTradeForImageUrl(imageUrl);
    if (ownerTrade) {
        ownerTrade.images = (ownerTrade.images || []).filter(u => u !== imageUrl);
        if (ownerTrade.overlays && ownerTrade.overlays[imageUrl]) delete ownerTrade.overlays[imageUrl];
        if (ownerTrade.marqueeBoxes && ownerTrade.marqueeBoxes[imageUrl]) delete ownerTrade.marqueeBoxes[imageUrl];
        const store = ensureImageTagStore(ownerTrade);
        if (store[imageUrl]) delete store[imageUrl];
        cleanupImageTagStore(ownerTrade);
    } else if (state.gallery.date && state.dayData[state.gallery.date]?.images) {
        state.dayData[state.gallery.date].images = state.dayData[state.gallery.date].images.filter(u => u !== imageUrl);
        if (state.dayData[state.gallery.date]?.overlays?.[imageUrl]) {
            delete state.dayData[state.gallery.date].overlays[imageUrl];
        }
        if (state.dayData[state.gallery.date]?.marqueeBoxes?.[imageUrl]) {
            delete state.dayData[state.gallery.date].marqueeBoxes[imageUrl];
        }
    }
    arr.splice(idx, 1);
    if (state.gallery.currentIndex >= arr.length) state.gallery.currentIndex = Math.max(0, arr.length - 1);
    try {
        const filename = String(imageUrl || '').split('/').pop();
        await fetch('/api/delete-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
    } catch (e) { }
    if (!arr.length) {
        await saveTrades();
        renderTable();
        renderCalendar();
        document.getElementById('gallery-modal').classList.remove('open');
        unlockBodyScroll();
        showToast('Image removed', 'success');
        return;
    }
    syncGalleryImageOrderToTrades();
    await saveTrades();
    renderGallery();
    renderTable();
    renderCalendar();
    showToast('Image removed', 'success');
}

function renderGalleryVideoUrls() {
    const container = document.getElementById('gv2-video-url-list');
    const trayElem = document.getElementById('gv2-video-url-tray');
    if (!container || !trayElem) return;

    const ctx = getCurrentGalleryPreserveContext();
    const dateToUse = state.gallery.date || ctx.date;

    if (!dateToUse) {
        trayElem.style.display = 'none';
        return;
    }

    const dayTrades = getTradesForDate(dateToUse);
    if (!dayTrades || dayTrades.length === 0) {
        trayElem.style.display = 'none';
        return;
    }

    trayElem.style.display = 'block';
    container.innerHTML = '';

    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '8px';
    container.style.padding = '4px 0';
    container.style.marginBottom = '12px';

    dayTrades.forEach((trade, idx) => {
        const hasVideo = !!(trade[VIDEO_COLUMN] && trade[VIDEO_COLUMN].trim());

        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '4px';

        const circleBtn = document.createElement('div');
        circleBtn.style.width = '28px';
        circleBtn.style.height = '28px';
        circleBtn.style.borderRadius = '50%';
        circleBtn.style.display = 'flex';
        circleBtn.style.alignItems = 'center';
        circleBtn.style.justifyContent = 'center';
        circleBtn.style.fontSize = '12px';
        circleBtn.style.fontWeight = '600';
        circleBtn.style.cursor = 'pointer';
        circleBtn.style.transition = 'all 0.2s';
        circleBtn.textContent = String(idx + 1);

        if (hasVideo) {
            circleBtn.style.background = 'var(--blue)';
            circleBtn.style.color = '#fff';
            circleBtn.style.boxShadow = '0 0 6px rgba(41, 121, 255, 0.4)';
            circleBtn.title = `Trade ${idx + 1} Video\nClick to open link\nRight-click to edit URL`;
        } else {
            circleBtn.style.background = 'transparent';
            circleBtn.style.border = '1.5px dashed var(--text2)';
            circleBtn.style.color = 'var(--text2)';
            circleBtn.title = `Trade ${idx + 1}\nClick to add video URL`;
        }

        circleBtn.addEventListener('mouseenter', () => {
            if (!hasVideo) {
                circleBtn.style.border = '1.5px dashed var(--text)';
                circleBtn.style.color = 'var(--text)';
            } else {
                circleBtn.style.filter = 'brightness(1.1)';
            }
        });

        circleBtn.addEventListener('mouseleave', () => {
            if (!hasVideo) {
                circleBtn.style.border = '1.5px dashed var(--text2)';
                circleBtn.style.color = 'var(--text2)';
            } else {
                circleBtn.style.filter = '';
            }
        });

        circleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentUrl = trade[VIDEO_COLUMN] || '';
            if (hasVideo) {
                window.open(currentUrl, '_blank');
            } else {
                const inputUrl = prompt(`Enter Video URL for Trade ${idx + 1} (or paste and hit Enter):`, currentUrl);
                if (inputUrl !== null) {
                    trade[VIDEO_COLUMN] = inputUrl.trim();
                    saveTrades();
                    renderGalleryVideoUrls();
                    if (typeof renderTable === 'function') renderTable();
                }
            }
        });

        circleBtn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const currentUrl = trade[VIDEO_COLUMN] || '';
            const inputUrl = prompt(`Edit Video URL for Trade ${idx + 1}:`, currentUrl);
            if (inputUrl !== null) {
                trade[VIDEO_COLUMN] = inputUrl.trim();
                saveTrades();
                renderGalleryVideoUrls();
                if (typeof renderTable === 'function') renderTable();
            }
        });

        const netPLNum = parseFloat(trade['Net P/L']);
        const plLabel = document.createElement('div');
        plLabel.style.fontSize = '0.65rem';
        plLabel.style.fontWeight = '600';
        if (!isNaN(netPLNum)) {
            plLabel.textContent = Math.round(Math.abs(netPLNum));
            plLabel.style.color = netPLNum >= 0 ? 'var(--green)' : 'var(--red)';
        } else {
            plLabel.textContent = '0';
            plLabel.style.color = 'var(--text2)';
        }

        wrapper.appendChild(circleBtn);
        wrapper.appendChild(plLabel);

        container.appendChild(wrapper);
    });
}
