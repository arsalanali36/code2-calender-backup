// gallery-stats.js — renderGalleryStats

function renderGalleryStats() {
    const display = document.getElementById('gallery-heads-display');
    if (!display) return;
    const heads = getActiveShowHeads();
    const cols = state.columns.filter(col => heads[col] && col.toLowerCase() !== 'date' && !isTagColumn(col));
    if (cols.length === 0) {
        display.style.display = 'none';
        return;
    }

    const activeUrl = (state.gallery.images || [])[state.gallery.currentIndex] || '';
    const ctx = getCurrentGalleryPreserveContext();
    let dateToUse = state.gallery.date || ctx.date;

    let trades = [];
    if (state.calendarMode === 'consolidated') {
        if (dateToUse) {
            trades = getTradesForDate(dateToUse);
        } else {
            const owner = getOwnerTradeForImageUrl(activeUrl);
            if (owner) trades = [owner];
        }
    } else {
        const owner = getOwnerTradeForImageUrl(activeUrl);
        if (owner) trades = [owner];
    }

    if (trades.length === 0) {
        display.style.display = 'none';
        return;
    }

    display.style.display = 'flex';
    display.innerHTML = '';

    const isConsolidated = state.calendarMode === 'consolidated' && trades.length > 1;

    if (isConsolidated) {
        const title = document.createElement('div');
        title.style.fontWeight = 'bold';
        title.style.borderBottom = '1px solid rgba(255,255,255,0.2)';
        title.style.marginBottom = '2px';
        title.style.paddingBottom = '2px';
        title.textContent = 'Consolidated Stats';
        display.appendChild(title);

        cols.forEach(col => {
            const lower = col.toLowerCase();
            if (lower === 'thumbnail' || lower === 'sell time' || lower === 'buy time') return;
            const vals = trades.map(t => t[col]).filter(v => v !== '' && v != null);
            if (!vals.length) return;
            const item = document.createElement('div');
            const nums = vals.map(v => parseFloat(v)).filter(v => !isNaN(v));
            if (nums.length === vals.length) {
                let outNum;
                if (lower === 'sell price' || lower === 'buy price') outNum = nums.reduce((a, b) => a + b, 0) / nums.length;
                else outNum = nums.reduce((a, b) => a + b, 0);
                const out = outNum % 1 === 0 ? outNum : outNum.toFixed(2);
                item.textContent = `${col}: ${out}`;
                if (lower.includes('profit') || lower === 'rs') item.style.color = outNum >= 0 ? 'var(--green)' : 'var(--red)';
            } else {
                const first = String(vals[0]);
                const same = vals.every(v => String(v) === first);
                item.textContent = same ? `${col}: ${first}` : `${col}: ${vals.length} entries`;
            }
            display.appendChild(item);
        });
    } else {
        trades.forEach((tr, i) => {
            const title = document.createElement('div');
            title.style.fontWeight = 'bold';
            title.style.borderBottom = '1px solid rgba(255,255,255,0.2)';
            title.style.marginBottom = '2px';
            title.style.paddingBottom = '2px';
            title.textContent = document.getElementById('gallery-date-picker')?.value === dateToUse && trades.length === 1 ? 'Trade Stats' : 'Individual Stats';
            display.appendChild(title);

            cols.forEach(col => {
                if (col.toLowerCase() === 'thumbnail') return;
                const val = tr[col];
                if (val === '' || val == null) return;
                const item = document.createElement('div');
                const isProfit = col.toLowerCase().includes('profit') || col.toLowerCase() === 'rs';
                if (isProfit) {
                    const num = parseFloat(val);
                    if (!isNaN(num)) {
                        item.textContent = `${col}: ${num > 0 ? '+' : ''}${num}`;
                        item.style.color = num >= 0 ? 'var(--green)' : 'var(--red)';
                    } else { item.textContent = `${col}: ${val}`; }
                } else {
                    item.textContent = `${col}: ${val}`;
                }
                display.appendChild(item);
            });
        });
    }
}
