# JS - Gallery Stats and Open
Consolidated code context for AI assistants.


## File: `static/js/gallery-stats.js`
```js
/**
 * @fileoverview gallery-stats.js
 * @description Computes and renders P&L stats bar shown below the main gallery image.
 * @exports renderGalleryStats
 * @reads state.gallery.date, state.trades, state.dayData
 * @calls getTradePnl, formatCurrency, getTradesForDate
 */

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

// ── P&L pill in tray (total + per-trade dropdown) ─────────────────────────
function renderGalleryPnlPill() {
    const wrap = document.getElementById('gv2-pnl-wrap');
    const pill = document.getElementById('gv2-pnl-pill');
    const drop = document.getElementById('gv2-pnl-dropdown');
    if (!wrap || !pill || !drop) return;

    const date = state.gallery.date;
    if (!date) { wrap.style.display = 'none'; return; }

    const trades = typeof getTradesForDate === 'function' ? getTradesForDate(date) : [];
    if (!trades.length) { wrap.style.display = 'none'; return; }

    let total = 0;
    const rows = trades.map(t => {
        const pnl = typeof getTradePnl === 'function' ? (getTradePnl(t) || 0) : 0;
        total += pnl;
        return { t, pnl };
    });

    wrap.style.display = '';

    const fmtPnl = v => (v >= 0 ? '+₹' : '-₹') + Math.abs(Math.round(v)).toLocaleString('en-IN');
    pill.textContent = fmtPnl(total);
    pill.className = 'gv2-pnl-pill' + (total > 0 ? ' positive' : total < 0 ? '' : ' neutral');

    // Rebuild dropdown rows (don't clear if open — flickers)
    drop.innerHTML = '';
    rows.forEach(({ t, pnl }, i) => {
        const row = document.createElement('div');
        row.className = 'gv2-pnl-trade-row';
        const lbl = document.createElement('span');
        lbl.className = 'gv2-pnl-trade-label';
        lbl.textContent = `T${i + 1}`;
        const val = document.createElement('span');
        val.className = 'gv2-pnl-trade-val';
        val.textContent = fmtPnl(pnl);
        val.style.color = pnl > 0 ? 'var(--green,#4caf50)' : pnl < 0 ? 'var(--red,#f44336)' : 'var(--text2)';
        row.appendChild(lbl);
        row.appendChild(val);
        row.addEventListener('click', () => {
            drop.classList.remove('open');
            const firstImg = (t.images || [])[0];
            if (firstImg) {
                const idx = state.gallery.images.indexOf(firstImg);
                if (idx >= 0) { state.gallery.currentIndex = idx; renderGallery(); }
            }
        });
        drop.appendChild(row);
    });
}

// ── Trade pill (current image's trade + its P/L) ──────────────────────────
function renderGalleryTradePill() {
    const wrap = document.getElementById('gv2-trade-pill-wrap');
    const pill = document.getElementById('gv2-trade-pill');
    const drop = document.getElementById('gv2-trade-dropdown');
    if (!wrap || !pill || !drop) return;

    const date = state.gallery.date;
    if (!date) { wrap.style.display = 'none'; return; }

    const trades = typeof getTradesForDate === 'function' ? getTradesForDate(date) : [];
    if (!trades.length) { wrap.style.display = 'none'; return; }

    const curUrl = (state.gallery.images || [])[state.gallery.currentIndex];
    const owner  = typeof getOwnerTradeForImageUrl === 'function' ? getOwnerTradeForImageUrl(curUrl) : null;
    const tIdx   = owner ? trades.indexOf(owner) : -1;
    if (!owner || tIdx < 0) { wrap.style.display = 'none'; return; }

    const pnl    = typeof getTradePnl === 'function' ? (getTradePnl(owner) || 0) : 0;
    const instr  = owner.Instrument || owner.Symbol || owner.instrument || '';
    const fmtPnl = v => (v >= 0 ? '+₹' : '-₹') + Math.abs(Math.round(v)).toLocaleString('en-IN');
    const cls    = pnl > 0 ? 'pos' : pnl < 0 ? 'neg' : '';

    wrap.style.display = '';
    pill.innerHTML =
        `<span class="gv2-tp-label">T${tIdx + 1}</span>`
      + `<span class="gv2-tp-sep">·</span>`
      + `<span class="gv2-tp-val ${cls}">${fmtPnl(pnl)}</span>`;

    // Dropdown: all trades for quick jump
    drop.innerHTML = '';
    trades.forEach((t, i) => {
        const p = typeof getTradePnl === 'function' ? (getTradePnl(t) || 0) : 0;
        const row = document.createElement('div');
        row.className = 'gv2-pnl-trade-row';
        if (i === tIdx) row.style.background = 'rgba(255,255,255,0.06)';
        const lbl = document.createElement('span');
        lbl.className = 'gv2-pnl-trade-label';
        lbl.textContent = `T${i + 1}`;
        const val = document.createElement('span');
        val.className = 'gv2-pnl-trade-val';
        val.textContent = fmtPnl(p);
        val.style.color = p > 0 ? '#2ecc71' : p < 0 ? '#e74c3c' : 'var(--text2)';
        row.appendChild(lbl); row.appendChild(val);
        row.addEventListener('click', () => {
            drop.classList.remove('open');
            const firstImg = (t.images || [])[0];
            if (firstImg) {
                const idx = state.gallery.images.indexOf(firstImg);
                if (idx >= 0) { state.gallery.currentIndex = idx; renderGallery(); }
            }
        });
        drop.appendChild(row);
    });
}

// ── Combined tray state update (called from renderGallery) ───────────────
function renderGalleryTrayState() {
    renderGalleryPnlPill();
    renderGalleryTradePill();
    renderGalleryTrayCounter();
}

// ── Image count badge in tray ─────────────────────────────────────────────
function renderGalleryTrayCounter() {
    const el = document.getElementById('gv2-tray-counter');
    if (!el) return;
    const images = state.gallery.images || [];
    if (!images.length) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.textContent = `${(state.gallery.currentIndex || 0) + 1} / ${images.length}`;
}

```

## File: `static/js/gallery-open.js`
```js
/**
 * @fileoverview gallery-open.js
 * @description Opens gallery modal for a date or arbitrary image list; body scroll lock.
 * @exports openGalleryForDate, openGalleryDirect, openGalleryForDateWithTagFilter,
 *          lockBodyScroll, unlockBodyScroll
 * @reads state.trades, state.dayData
 * @writes state.gallery (images, date, currentIndex, sourceRow, tagFilter, selectedSeparator)
 * @calls renderGallery, lockBodyScroll
 */

// gallery-open.js — openGalleryForDate, openGalleryDirect, openGalleryForDateWithTagFilter, lock/unlockBodyScroll

function openGalleryForDate(dateStr) {
  const images = getImagesForDate(dateStr);
  if (!images.length) return;
  state.gallery.images = images; state.gallery.currentIndex = 0; state.gallery.tagFilter = [];
  state.gallery.date = dateStr; state.gallery.sourceRow = null;
  state.gallery._baseImages = [...images];
  state.gallery.selectedIndices = state.gallery.selectedIndices || new Set();
  state.gallery._baseDate = dateStr;
  state.gallery._baseSourceRow = null;
  lockBodyScroll();
  document.getElementById('gallery-modal').classList.add('open');
  renderGallery(); updateGalleryDateArrows();
  renderGalleryTagCloud(); renderGalleryTagsTray(); renderGalleryTagFilterPanel();
  const tray1 = document.getElementById('gv2-tags-tray');
  const btn1 = document.getElementById('gv2-tags-btn');
  if (tray1) tray1.style.display = 'flex';
  if (btn1) btn1.classList.add('active');
  if (state.gallery.showTime) fetchImageTimesForGallery();
}

function openGalleryDirect(images, startIndex, sourceRow = null) {
  state.gallery.images = images; state.gallery.currentIndex = startIndex; state.gallery.tagFilter = [];
  state.gallery.date = ''; state.gallery.sourceRow = sourceRow;
  state.gallery._baseImages = [...images];
  state.gallery.selectedIndices = state.gallery.selectedIndices || new Set();
  state.gallery._baseDate = '';
  state.gallery._baseSourceRow = sourceRow;
  lockBodyScroll();
  document.getElementById('gallery-modal').classList.add('open');
  renderGallery(); updateGalleryDateArrows();
  renderGalleryTagCloud(); renderGalleryTagsTray(); renderGalleryTagFilterPanel();
  const tray2 = document.getElementById('gv2-tags-tray');
  const btn2 = document.getElementById('gv2-tags-btn');
  if (tray2) tray2.style.display = 'flex';
  if (btn2) btn2.classList.add('active');
  if (state.gallery.showTime) fetchImageTimesForGallery();
}

// ── Gallery Layout Toggle (classic ↔ new) ──────────────────────────────────
const _VP_KEY = 'tj_galleryLayout'; // 'classic' | 'new'

function openGalleryForDateWithPicker(dateStr) {
  const pref = localStorage.getItem(_VP_KEY);
  if (pref === 'classic') { window.open(`/gallery-classic?galleryDate=${dateStr}`, '_blank'); return; }
  if (pref === 'new')     { openGalleryForDate(dateStr); return; }
  _showViewerPicker(dateStr);
}


function _showViewerPicker(dateStr) {
  document.getElementById('gv2-viewer-picker')?.remove();

  const el = document.createElement('div');
  el.id = 'gv2-viewer-picker';
  el.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99999',
    'display:flex', 'align-items:center', 'justify-content:center',
    'background:rgba(0,0,0,0.45)', 'backdrop-filter:blur(3px)'
  ].join(';');

  el.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border2);border-radius:10px;
                padding:20px 24px;min-width:260px;box-shadow:0 8px 32px rgba(0,0,0,0.7);
                display:flex;flex-direction:column;gap:12px;text-align:center;">
      <div style="font-size:0.8rem;color:var(--text2);letter-spacing:0.04em;">Open ${dateStr} with</div>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button id="gvp-old" style="flex:1;padding:10px 0;border-radius:7px;
          border:1px solid var(--border2);background:var(--surface2);
          color:var(--text);font-size:0.88rem;cursor:pointer;">
          🖥 Old Gallery
        </button>
        <button id="gvp-new" style="flex:1;padding:10px 0;border-radius:7px;
          border:none;background:var(--blue);
          color:#fff;font-size:0.88rem;cursor:pointer;font-weight:600;">
          ✨ New Gallery
        </button>
      </div>
      <label style="display:flex;align-items:center;justify-content:center;gap:6px;
                    font-size:0.72rem;color:var(--text3);cursor:pointer;">
        <input type="checkbox" id="gvp-remember" style="cursor:pointer;accent-color:var(--blue);" />
        Remember my choice
      </label>
    </div>`;

  document.body.appendChild(el);

  const choose = (mode) => {
    if (document.getElementById('gvp-remember')?.checked)
      localStorage.setItem(_VP_KEY, mode);
    el.remove();
    if (mode === 'classic') {
      window.open(`/gallery-classic?galleryDate=${dateStr}`, '_blank');
    } else {
      openGalleryForDate(dateStr);
    }
  };

  document.getElementById('gvp-old').addEventListener('click', () => choose('classic'));
  document.getElementById('gvp-new').addEventListener('click', () => choose('new'));
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
}

// Reset gallery layout preference (browser console: resetViewerPref())
function resetViewerPref() { localStorage.removeItem(_VP_KEY); }

function lockBodyScroll() {
  document.body.classList.add('modal-open');
}

function unlockBodyScroll() {
  if (document.querySelector('.modal-overlay.open')) return;
  document.body.classList.remove('modal-open');
}

function openGalleryForDateWithTagFilter(dateStr, tags = []) {
  const cleanTags = Array.from(new Set((tags || []).map(t => String(t || '').trim()).filter(Boolean)));
  openGalleryForDate(dateStr);
  state.gallery.tagFilter = cleanTags;
  const keep = {
    url: (state.gallery.images || [])[state.gallery.currentIndex] || '',
    date: normalizeDate(dateStr || ''),
    sourceRow: null
  };
  if (cleanTags.length) applyGalleryImageScopeByTagFilter(keep);
  renderGalleryTagCloud();
  renderGallery();
  updateGalleryDateArrows();
}

```
