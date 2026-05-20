/**
 * @fileoverview exportService.js
 * @description All data-export and backup API operations.
 *   Each function fetches a Blob and triggers a browser download.
 */

const exportService = (() => {
  /** Trigger a file download in the browser from a Blob. */
  function _triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  function _timestamp() {
    return new Date().toISOString().slice(0, 19).replace(/[-:T]/g, (c) =>
      c === 'T' ? '_' : c
    );
  }

  /**
   * Export trades as Excel (.xlsx).
   * @param {{trades: Array, columns: Array}} payload
   */
  async function exportExcel(payload) {
    const blob = await apiClient.download('/api/export-excel', payload);
    _triggerDownload(blob, `trading_journal_${_timestamp()}.xlsx`);
  }

  /**
   * Export trades as structured CSV.
   * @param {{trades: Array, columns: Array}} payload
   */
  async function exportStructuredCsv(payload) {
    const blob = await apiClient.download('/api/export-structured-csv', payload);
    _triggerDownload(blob, 'structured_trades.csv');
  }

  /**
   * Export trades as trade-logger Excel (two sheets).
   * @param {{trades: Array}} payload
   */
  async function exportLoggerExcel(payload) {
    const blob = await apiClient.download('/api/export-logger-excel', payload);
    _triggerDownload(blob, `trade_logger_export_${_timestamp()}.xlsx`);
  }

  /**
   * Download a full backup ZIP (trades.json + images + Excel + observations HTML).
   * @param {string} [name] - optional custom filename prefix
   */
  async function downloadBackup(name = '') {
    const query = name ? `?name=${encodeURIComponent(name)}` : '';
    const blob = await apiClient.downloadGet(`/api/backup${query}`);
    _triggerDownload(blob, name ? `${name}.zip` : `trading_journal_${_timestamp()}.zip`);
  }

  /**
   * Export multiple images into a single PDF in landscape orientation with metadata.
   * @param {Array<{url:string, date:string, sourceRow:number}>} metaList - List of images with metadata.
   * @param {string} [filename] - Custom filename for the PDF.
   * @param {Array<string>} [globalFilterTags] - Tags currently active in the filter.
   */
  async function exportImagesToPdf(metaList, filename = '', globalFilterTags = []) {
    if (!metaList || !metaList.length) {
      if (typeof showToast === 'function') showToast('No images to export.', 'error');
      return;
    }

    if (!window.jspdf) {
      if (typeof showToast === 'function') showToast('PDF library not loaded. Refresh and try again.', 'error');
      return;
    }

    const fname = filename || `trading_journal_images_${_timestamp()}.pdf`;

    // ── Progress overlay ────────────────────────────────────────────────────
    const _overlay = document.createElement('div');
    _overlay.id = '_pdf-export-overlay';
    _overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:999999;display:flex;align-items:center;justify-content:center;';
    _overlay.innerHTML = `
      <div style="background:#1a1d27;border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:32px 40px;min-width:300px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.8);">
        <div id="_pdf-spinner" style="width:42px;height:42px;border:3px solid rgba(255,255,255,0.12);border-top-color:#58a6ff;border-radius:50%;animation:_pdf-spin 0.8s linear infinite;margin:0 auto 18px;"></div>
        <div style="color:#fff;font-size:1rem;font-weight:600;margin-bottom:8px;">Generating PDF</div>
        <div id="_pdf-progress" style="color:#8b949e;font-size:0.85rem;">Preparing...</div>
      </div>
      <style>@keyframes _pdf-spin{to{transform:rotate(360deg);}}</style>`;
    document.body.appendChild(_overlay);
    const _setProgress = (txt) => { const el = document.getElementById('_pdf-progress'); if (el) el.textContent = txt; };
    const _closeOverlay = () => { const el = document.getElementById('_pdf-export-overlay'); if (el) el.remove(); };
    // ───────────────────────────────────────────────────────────────────────

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
      let newsOnCurrentPage = 0; // 0=none, 1=left, 2=right
      const total = metaList.length;

      for (let i = 0; i < metaList.length; i++) {
        const item = metaList[i];
        const url = (typeof item === 'string') ? item : (item.url || '');
        if (!url) continue;

        _setProgress(`Image ${i + 1} of ${total}...`);
        const urlForExport = (typeof resolveImageUrl === 'function') ? resolveImageUrl(url) : url;
        if (typeof isVideoUrl === 'function' && isVideoUrl(urlForExport)) continue;

        // Peak ahead to see if it's News
        const itags = (typeof getImageTagsForGalleryItem === 'function') ? getImageTagsForGalleryItem(item) : [];
        const isNews = Array.isArray(itags) && itags.includes('News');

        const imgData = await _getImageDataUrl(urlForExport);
        if (!imgData) continue;

        // Manage pagination
        if (isNews) {
          if (newsOnCurrentPage === 0) {
            if (i > 0) doc.addPage('a4', 'l');
            newsOnCurrentPage = 1;
          } else if (newsOnCurrentPage === 1) {
            newsOnCurrentPage = 2;
          } else {
            doc.addPage('a4', 'l');
            newsOnCurrentPage = 1;
          }
        } else {
          if (i > 0) doc.addPage('a4', 'l');
          newsOnCurrentPage = 0;
        }

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 12;

        let tradeLabel = '';
        let statsLabel = '';
        let imageTagsStr = '';
        let isProfit = false;
        let isLoss = false;

        const dDate = item.date || '';
        const sRow = (item.sourceRow !== null && item.sourceRow !== undefined) ? item.sourceRow : null;
        
        // 1. Get Base Trade Data
        if (sRow !== null && state.trades[sRow]) {
          const t = state.trades[sRow];
          const trDate = dDate || normalizeDate(extractDateFromTrade(t));
          const allDayTrades = getTradesForDate(trDate);
          const tIdx = allDayTrades.indexOf(t);
          const tNum = tIdx >= 0 ? tIdx + 1 : sRow + 1;
          
          const _dt = new Date(trDate + 'T00:00:00');
          const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          const dateStr = `${months[_dt.getMonth()]} ${_dt.getDate()} ${days[_dt.getDay()]}`;

          tradeLabel = `Trade ${tNum} - ${dateStr}`;
          
          const pnl = parseFloat(t['Net P/L'] || t.net_pnl || 0) || 0;
          const pt = parseFloat(t['Pt'] || t.pt || 0) || 0;
          const qty = t.Qty || t.qty || t.QTY || '-';
          isProfit = pnl > 0;
          isLoss = pnl < 0;

          const bt = (t['Buy Time'] || t.buy_time || '').slice(0, 5);
          const st = (t['Sell Time'] || t.sell_time || '').slice(0, 5);
          const tt = String(t.TradeType || t.tradetype || '').toLowerCase();
          const isShort = tt.includes('sell') || tt.includes('short');
          
          let dur = '';
          if (bt && st) {
            try {
              const [h1, m1] = bt.split(':').map(Number);
              const [h2, m2] = st.split(':').map(Number);
              const d1 = new Date(2000, 0, 1, h1, m1);
              const d2 = new Date(2000, 0, 1, h2, m2);
              const diff = Math.abs(d2 - d1);
              const mins = Math.round(diff / 60000);
              dur = mins < 60 ? mins + 'm' : Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm';
            } catch(e) {}
          }

          const entryTime = isShort ? st : bt;
          const exitTime = isShort ? bt : st;
          statsLabel = `${pnl > 0 ? '+' : ''}₹${Math.round(pnl)}  |  ${pt > 0 ? '+' : ''}${Math.round(pt)} Pt  |  ${entryTime}-${exitTime}  |  ${dur || '-'}  |  ${qty} Qty`;
        } else if (dDate) {
          tradeLabel = isNews ? `News - ${dDate}` : `Day Summary - ${dDate}`;
          
          // Calculate cumulative totals for the day
          const dayTrades = typeof getTradesForDate === 'function' ? getTradesForDate(dDate) : [];
          if (!isNews && dayTrades.length > 0) {
            let totalPnl = 0;
            let totalPt = 0;
            let totalQty = 0;
            
            dayTrades.forEach(t => {
              totalPnl += parseFloat(t['Net P/L'] || t.net_pnl || 0) || 0;
              totalPt += parseFloat(t['Pt'] || t.pt || 0) || 0;
              totalQty += parseFloat(t.Qty || t.qty || t.QTY || 0) || 0;
            });
            
            isProfit = totalPnl > 0;
            isLoss = totalPnl < 0;
            statsLabel = `${totalPnl > 0 ? '+' : ''}₹${Math.round(totalPnl)}  |  ${totalPt > 0 ? '+' : ''}${Math.round(totalPt)} Pt  |  ${dayTrades.length} Trades  |  -  |  ${totalQty} Qty`;
          }
        }

        // 2. Individual Image Tags
        if (itags.length) imageTagsStr = `Tags: ${itags.join(', ')}`;

        // 3. Header (Top)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isNews ? 9 : 11);
        doc.setTextColor(60, 60, 60);
        
        let headerX = margin;
        if (newsOnCurrentPage === 2) headerX = (pageWidth / 2) + (margin / 2);
        
        doc.text(tradeLabel, headerX, 11);

        const currentLabelWidth = doc.getTextWidth(tradeLabel);

        // [View Source] link
        const itemDate = (typeof item === 'object' && item.date) ? item.date : '';
        const itemRawUrl = (typeof item === 'object' && item.url) ? item.url : url;
        const sourceUrl = itemDate
            ? `${window.location.origin}/?galleryDate=${encodeURIComponent(itemDate)}&galleryImg=${encodeURIComponent(itemRawUrl)}`
            : (urlForExport.startsWith('/') ? window.location.origin + urlForExport : urlForExport);
        
        doc.setFontSize(isNews ? 7 : 9);
        doc.setTextColor(0, 102, 204);
        doc.textWithLink('[View Source]', headerX + currentLabelWidth + 4, 11, { url: sourceUrl });

        if (!newsOnCurrentPage || newsOnCurrentPage === 2) {
            if (Array.isArray(globalFilterTags) && globalFilterTags.length) {
                doc.setFontSize(isNews ? 7 : 9);
                doc.setTextColor(100, 100, 100);
                const globalTagsStr = `Filter: ${globalFilterTags.join(', ')}`;
                doc.text(globalTagsStr, pageWidth - margin, 10, { align: 'right' });
            }
        }

        // 4. Image calculations
        const imgProps = doc.getImageProperties(imgData);
        let availableWidth = newsOnCurrentPage ? (pageWidth / 2) - (margin * 1.5) : pageWidth - (margin * 2);
        let availableHeight = isNews ? pageHeight - 28 : pageHeight - 38;

        const ratio = imgProps.width / imgProps.height;
        let finalWidth = availableWidth;
        let finalHeight = finalWidth / ratio;

        if (finalHeight > availableHeight) {
          finalHeight = availableHeight;
          finalWidth = finalHeight * ratio;
        }

        let imgX = (newsOnCurrentPage === 2) 
                   ? (pageWidth / 2) + (margin / 2) + (availableWidth - finalWidth) / 2
                   : margin + (availableWidth - finalWidth) / 2;
        let imgY = 14 + (availableHeight - finalHeight) / 2;

        doc.addImage(imgData, 'JPEG', imgX, imgY, finalWidth, finalHeight);

        // 5. Footer Data
        const footerY = imgY + finalHeight + 6;
        if (statsLabel) {
          doc.setFontSize(13);
          if (isProfit) doc.setTextColor(46, 204, 113);
          else if (isLoss) doc.setTextColor(231, 76, 60);
          else doc.setTextColor(100, 100, 100);
          doc.text(statsLabel, pageWidth / 2, footerY, { align: 'center' });
        }
        
        if (imageTagsStr) {
          doc.setFontSize(isNews ? 8 : 9);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(120, 120, 120);
          let tagX = newsOnCurrentPage ? (newsOnCurrentPage === 2 ? (pageWidth * 0.75) : (pageWidth * 0.25)) : (pageWidth / 2);
          doc.text(imageTagsStr, tagX, footerY + (isNews ? 4 : 6), { align: 'center' });
        }
      }

      _setProgress('Saving file...');
      doc.save(fname);
      _closeOverlay();
      if (typeof showToast === 'function') showToast('PDF Exported!', 'success');
    } catch (err) {
      _closeOverlay();
      console.error("PDF Export failed:", err);
      if (typeof showToast === 'function') showToast(`PDF Export failed: ${err.message || err}`, 'error');
    }
  }

  function _getImageDataUrl(url) {
    return new Promise((resolve) => {
      const tryLoad = (withCors) => {
        const img = new Image();
        if (withCors) img.crossOrigin = 'Anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          } catch (e) {
            if (withCors) {
              // canvas tainted — retry without crossOrigin
              tryLoad(false);
            } else {
              console.warn('Canvas export failed for:', url, e);
              resolve(null);
            }
          }
        };
        img.onerror = () => {
          if (withCors) { tryLoad(false); } else { resolve(null); }
        };
        img.src = url + (withCors ? '' : (url.includes('?') ? '&_nocors=1' : '?_nocors=1'));
      };
      tryLoad(true);
    });
  }

  return { exportExcel, exportStructuredCsv, exportLoggerExcel, downloadBackup, exportImagesToPdf };
})();
