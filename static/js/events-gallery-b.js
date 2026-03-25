/**
 * @fileoverview events-gallery-b.js
 * @description Gallery Trades Panel: toggle, sort, list render, trade navigation.
 *   Extracted from events-gallery.js to keep that file under 30 KB.
 * @exports _bindGalleryTradesPanelEvents
 * @reads state.trades, state.gallery.{date,sourceRow,images}
 * @calls openGalleryForDate, renderGallery, normalizeDate, extractDateFromTrade, getTradesForDate
 */

// events-gallery-b.js — Trades panel toggle, sort, and list render

let _tradesSortField = 'date';
let _tradesSortOrder = 'desc'; // 'desc' = high/recent, 'asc' = low/oldest
let _tradesFilterType = 'both'; // 'both', 'gain', 'loss'

function _bindGalleryTradesPanelEvents() {
  const tpBtn    = document.getElementById('gv2-trades-panel-btn');
  const tpPanel  = document.getElementById('gv2-trades-panel');
  const tpClose  = document.getElementById('gv2-trades-close-btn');
  const tpFieldSelect = document.getElementById('gv2-trades-sort-field');
  const tpFilterSelect = document.getElementById('gv2-trades-filter-type');
  const tpOrderBtn = document.getElementById('gv2-trades-sort-order-btn');
  const tpList   = document.getElementById('gv2-trades-list');

  const _renderTradesList = () => {
    if (!tpList || !state.trades) return;
    tpList.innerHTML = '';
    
    // Collect all trades that have at least one image
    let allPnlTrades = state.trades.filter(t => t && t.images && t.images.length > 0 && normalizeDate(extractDateFromTrade(t)));

    // Apply Filter (Both/Gain/Loss)
    if (_tradesFilterType !== 'both') {
      allPnlTrades = allPnlTrades.filter(t => {
        const pnl = parseFloat(t['Net P/L'] || t.net_pnl || 0) || 0;
        return (_tradesFilterType === 'gain') ? (pnl > 0) : (pnl < 0);
      });
    }

    allPnlTrades.sort((a, b) => {
      let valA, valB;
      
      if (_tradesSortField === 'pnl') {
        valA = parseFloat(a['Net P/L'] || a.net_pnl || 0) || 0;
        valB = parseFloat(b['Net P/L'] || b.net_pnl || 0) || 0;
      } else if (_tradesSortField === 'pt') {
        valA = parseFloat(a['Pt'] || a.pt || 0) || 0;
        valB = parseFloat(b['Pt'] || b.pt || 0) || 0;
      } else if (_tradesSortField === 'lots') {
        valA = parseFloat(a.Qty || a.qty || a.QTY || 0) || 0;
        valB = parseFloat(b.Qty || b.qty || b.QTY || 0) || 0;
      } else if (_tradesSortField === 'duration') {
        const getMins = (tr) => {
          const bt = (tr['Buy Time'] || '').slice(0, 5);
          const st = (tr['Sell Time'] || '').slice(0, 5);
          if (!bt || !st) return 0;
          try {
            const [h1, m1] = bt.split(':').map(Number);
            const [h2, m2] = st.split(':').map(Number);
            const d1 = new Date(2000, 0, 1, h1, m1);
            const d2 = new Date(2000, 0, 1, h2, m2);
            return Math.abs(d2 - d1) / 60000;
          } catch(e) { return 0; }
        };
        valA = getMins(a);
        valB = getMins(b);
      } else {
        // date
        valA = normalizeDate(extractDateFromTrade(a));
        valB = normalizeDate(extractDateFromTrade(b));
      }

      if (_tradesSortOrder === 'desc') {
        if (typeof valA === 'string') return valB.localeCompare(valA);
        return valB - valA;
      } else {
        if (typeof valA === 'string') return valA.localeCompare(valB);
        return valA - valB;
      }
    });

    if (allPnlTrades.length === 0) {
      tpList.innerHTML = '<div style="color:var(--text3);text-align:center;padding:20px;">No trades with images found.</div>';
      return;
    }

    allPnlTrades.forEach(t => {
      const pnl = parseFloat(t['Net P/L'] || t.net_pnl || 0) || 0;
      const pt = parseFloat(t['Pt'] || t.pt || 0) || 0;
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

      // Derive chart params from raw trade data
      const instrument = t['Instrument'] || t['instrument'] || '';
      const buyPrice  = parseFloat(t['Buy Price (Avg)']  || t['Buy Price']  || '') || null;
      const sellPrice = parseFloat(t['Sell Price (Avg)'] || t['Sell Price'] || '') || null;
      const buyTime   = (t['Buy Time']  || '').slice(0, 5);
      const sellTime  = (t['Sell Time'] || '').slice(0, 5);
      const tradeType = String(t['tradetype'] || t['Trade Type'] || '').toLowerCase();
      const isShort   = /sell|short/.test(tradeType);
      const entry     = isShort ? sellPrice : buyPrice;
      const exitPrice = isShort ? buyPrice  : sellPrice;
      const entryTime = isShort ? sellTime  : buyTime;
      const exitTime2 = isShort ? buyTime   : sellTime;

      const chartBtnHtml = instrument ? `
        <button class="gc-trade-chart-btn" title="Open OHLC chart"
          style="margin-top:4px;background:#1e2130;border:1px solid #2a2a3e;color:#5599ff;padding:2px 7px;border-radius:4px;cursor:pointer;font-size:0.72rem;align-self:flex-start;">
          &#128202; Chart
        </button>` : '';

      const dur = (() => {
        if (!buyTime || !sellTime) return '';
        try {
          const [h1, m1] = buyTime.split(':').map(Number);
          const [h2, m2] = sellTime.split(':').map(Number);
          const d1 = new Date(2000, 0, 1, h1, m1);
          const d2 = new Date(2000, 0, 1, h2, m2);
          const diff = Math.abs(d2 - d1);
          const mins = Math.round(diff / 60000);
          return mins < 60 ? mins + 'm' : Math.floor(mins / 60) + 'h' + (mins % 60 > 0 ? ' ' + (mins % 60) + 'm' : '');
        } catch(e) { return ''; }
      })();
      const lot = parseFloat(t.Qty || t.qty || t.QTY || 0) || 0;

      item.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:2px; flex:1; min-width:0;">
          <span style="font-size:0.85rem; font-weight:600; color:${isViewingThisTrade ? 'var(--orange,#ff9800)' : 'var(--text)'};">${dateString}</span>
          <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
            <span style="font-size:0.75rem; color:var(--text3); white-space:nowrap;"><strong style="color:var(--text2);">${tLabel}</strong> &bull; ${t.images.length} img</span>
            <span style="font-size:0.75rem; color:var(--text3); opacity:0.9; white-space:nowrap;">&bull; ${entryTime}${dur ? ' <span style="font-size:1.15em; font-weight:700; color:#fff; margin:0 2px;">['+dur+']</span>' : ''} <span style="color:var(--text2); margin-left:4px;">${lot}</span></span>
          </div>
          ${chartBtnHtml}
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:2px; flex-shrink:0;">
          <div style="font-weight:700; font-size:0.9rem; color:${color};">
            ${pnl >= 0 ? '+' : ''}${Math.round(pnl)}
          </div>
          <div style="font-size:0.75rem; font-weight:600; color:${ptColor};">
            Pt: ${pt >= 0 ? '+' : ''}${Math.round(pt)}
          </div>
        </div>
      `;

      // Chart button — attach via addEventListener so stopPropagation is guaranteed
      if (instrument) {
        const chartBtn = item.querySelector('.gc-trade-chart-btn');
        if (chartBtn) {
          chartBtn.addEventListener('click', e => {
            e.stopPropagation();
            openGalleryChart(instrument, d, entry, isShort ? 'SHORT' : 'LONG', entryTime, exitTime2, exitPrice, exitTime2);
          });
        }
      }

      item.onclick = e => {
        if (e.target.closest('.gc-trade-chart-btn')) return; // chart btn handles itself
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

  if (tpFieldSelect) {
    tpFieldSelect.value = _tradesSortField;
    tpFieldSelect.addEventListener('change', (e) => {
      _tradesSortField = e.target.value;
      _renderTradesList();
    });
  }

  if (tpFilterSelect) {
    tpFilterSelect.value = _tradesFilterType;
    tpFilterSelect.addEventListener('change', (e) => {
      _tradesFilterType = e.target.value;
      _renderTradesList();
    });
  }

  if (tpOrderBtn) {
    tpOrderBtn.textContent = _tradesSortOrder === 'desc' ? 'High' : 'Low';
    tpOrderBtn.addEventListener('click', () => {
      _tradesSortOrder = (_tradesSortOrder === 'desc') ? 'asc' : 'desc';
      tpOrderBtn.textContent = _tradesSortOrder === 'desc' ? 'High' : 'Low';
      _renderTradesList();
    });
  }
}
