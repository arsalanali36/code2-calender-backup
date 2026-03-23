/**
 * @fileoverview events-gallery-b.js
 * @description Gallery Trades Panel: toggle, sort, list render, trade navigation.
 *   Extracted from events-gallery.js to keep that file under 30 KB.
 * @exports _bindGalleryTradesPanelEvents
 * @reads state.trades, state.gallery.{date,sourceRow,images}
 * @calls openGalleryForDate, renderGallery, normalizeDate, extractDateFromTrade, getTradesForDate
 */

// events-gallery-b.js — Trades panel toggle, sort, and list render

let _tradesSortMode = 'loss_desc';

function _bindGalleryTradesPanelEvents() {
  const tpBtn    = document.getElementById('gv2-trades-panel-btn');
  const tpPanel  = document.getElementById('gv2-trades-panel');
  const tpClose  = document.getElementById('gv2-trades-close-btn');
  const tpSortBtn = document.getElementById('gv2-trades-sort-btn');
  const tpList   = document.getElementById('gv2-trades-list');

  const _renderTradesList = () => {
    if (!tpList || !state.trades) return;
    tpList.innerHTML = '';
    // Collect all trades that have at least one image
    let allPnlTrades = state.trades.filter(t => t && t.images && t.images.length > 0 && typeof t['Net P/L'] !== 'undefined' && normalizeDate(extractDateFromTrade(t)));

    allPnlTrades.sort((a, b) => {
      if (_tradesSortMode === 'loss_desc') {
        const valA = parseFloat(a['Net P/L']) || 0;
        const valB = parseFloat(b['Net P/L']) || 0;
        return valA - valB; // most negative first (max loss)
      } else if (_tradesSortMode === 'profit_desc') {
        const valA = parseFloat(a['Net P/L']) || 0;
        const valB = parseFloat(b['Net P/L']) || 0;
        return valB - valA; // most positive first
      } else if (_tradesSortMode === 'pt_loss') {
        const valA = parseFloat(a['Pt']) || 0;
        const valB = parseFloat(b['Pt']) || 0;
        return valA - valB;
      } else if (_tradesSortMode === 'pt_profit') {
        const valA = parseFloat(a['Pt']) || 0;
        const valB = parseFloat(b['Pt']) || 0;
        return valB - valA;
      } else {
        // date desc
        const da = normalizeDate(extractDateFromTrade(a));
        const db = normalizeDate(extractDateFromTrade(b));
        return db.localeCompare(da);
      }
    });

    if (allPnlTrades.length === 0) {
      tpList.innerHTML = '<div style="color:var(--text3);text-align:center;padding:20px;">No trades with images found.</div>';
      return;
    }

    allPnlTrades.forEach(t => {
      const pnl = parseFloat(t['Net P/L']) || 0;
      const pt = parseFloat(t['Pt']) || 0;
      const color = pnl > 0 ? 'var(--green)' : (pnl < 0 ? 'var(--red)' : 'var(--text)');
      const ptColor = pt > 0 ? 'var(--green)' : (pt < 0 ? 'var(--red)' : 'var(--text2)');
      const d = normalizeDate(extractDateFromTrade(t));
      const dayTrades = typeof getTradesForDate === 'function' ? getTradesForDate(d) : [];
      let tLabel = 'T?';
      if (dayTrades.length > 0) {
        const idx = dayTrades.findIndex(tr => tr === t || (tr.images && tr.images[0] === t.images[0]));
        if (idx !== -1) tLabel = `T${idx + 1}`;
      }

      let dateString = d;
      try {
        const dObj = new Date(d);
        if (!isNaN(dObj.getTime())) {
          dateString = dObj.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
        }
      } catch (e) {}

      const isViewingThisDate = (state.gallery.date === d);
      const isViewingThisTrade = isViewingThisDate && (state.gallery.sourceRow !== null && (state.trades[state.gallery.sourceRow] === t || (state.trades[state.gallery.sourceRow]?.images && state.trades[state.gallery.sourceRow]?.images[0] === t.images[0])));

      const item = document.createElement('div');
      item.className = 'gv2-trades-item' + (isViewingThisTrade ? ' active-trade' : '');
      item.style.cssText = `
        display:flex; align-items:center; justify-content:space-between;
        padding:8px 10px; background:${isViewingThisTrade ? 'rgba(255,152,0,0.08)' : 'var(--surface2)'};
        border:1px solid ${isViewingThisTrade ? 'var(--orange,#ff9800)' : 'var(--border)'};
        border-radius:6px; cursor:pointer; user-select:none; transition:all 0.2s;
        ${isViewingThisTrade ? 'box-shadow:0 0 12px rgba(255,152,0,0.15);' : ''}
      `;
      item.onmouseenter = () => { if (!isViewingThisTrade) item.style.background = 'var(--surface3)'; };
      item.onmouseleave = () => { if (!isViewingThisTrade) item.style.background = isViewingThisTrade ? 'rgba(255,152,0,0.08)' : 'var(--surface2)'; };

      item.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:2px;">
          <span style="font-size:0.85rem; font-weight:600; color:${isViewingThisTrade ? 'var(--orange,#ff9800)' : 'var(--text)'};">${dateString}</span>
          <span style="font-size:0.75rem; color:var(--text3);"><strong style="color:var(--text2);">${tLabel}</strong> &bull; ${t.images.length} img</span>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:2px;">
          <div style="font-weight:700; font-size:0.9rem; color:${color};">
            ${pnl >= 0 ? '+' : ''}${Math.round(pnl)}
          </div>
          <div style="font-size:0.75rem; font-weight:600; color:${ptColor};">
            Pt: ${pt >= 0 ? '+' : ''}${Math.round(pt)}
          </div>
        </div>
      `;
      item.onclick = () => {
        if (typeof openGalleryForDate === 'function') {
          openGalleryForDate(d);
          const firstImg = t.images[0];
          setTimeout(() => {
            if (state.gallery.images && state.gallery.images.includes(firstImg)) {
              const globalIdx = state.gallery.images.indexOf(firstImg);
              state.gallery.currentIndex = globalIdx;
              state.gallery.selectedIndices = new Set([globalIdx]);
              const globalTradeIdx = state.trades.indexOf(t);
              if (globalTradeIdx !== -1) state.gallery.sourceRow = globalTradeIdx;
              renderGallery();
              _renderTradesList(); // update highlight
            }
          }, 150);
        }
      };
      tpList.appendChild(item);
    });
  };
  window.refreshGalleryTradesList = _renderTradesList;

  if (tpBtn && tpPanel) {
    tpBtn.addEventListener('click', () => {
      const isOpen = tpPanel.style.display !== 'none';
      tpPanel.style.display = isOpen ? 'none' : 'flex';
      tpBtn.classList.toggle('active', !isOpen);
      if (!isOpen) _renderTradesList();
    });
  }

  if (tpClose && tpPanel) {
    tpClose.addEventListener('click', () => {
      tpPanel.style.display = 'none';
      tpBtn?.classList.remove('active');
    });
  }

  if (tpSortBtn) {
    tpSortBtn.innerHTML = 'Sort: Loss &#9660;';
    tpSortBtn.addEventListener('click', () => {
      if (_tradesSortMode === 'loss_desc') {
        _tradesSortMode = 'profit_desc';
        tpSortBtn.innerHTML = 'Sort: Profit &#9660;';
      } else if (_tradesSortMode === 'profit_desc') {
        _tradesSortMode = 'pt_loss';
        tpSortBtn.innerHTML = 'Sort: Pt Loss &#9660;';
      } else if (_tradesSortMode === 'pt_loss') {
        _tradesSortMode = 'pt_profit';
        tpSortBtn.innerHTML = 'Sort: Pt Profit &#9660;';
      } else if (_tradesSortMode === 'pt_profit') {
        _tradesSortMode = 'date_desc';
        tpSortBtn.innerHTML = 'Sort: Date &#9660;';
      } else {
        _tradesSortMode = 'loss_desc';
        tpSortBtn.innerHTML = 'Sort: Loss &#9660;';
      }
      _renderTradesList();
    });
  }
}
