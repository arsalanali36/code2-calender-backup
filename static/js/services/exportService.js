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

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
    const fname = filename || `trading_journal_images_${_timestamp()}.pdf`;

    if (typeof showToast === 'function') showToast('Generating PDF... Please wait.', 'info');

    try {
      for (let i = 0; i < metaList.length; i++) {
        const item = metaList[i];
        const url = (typeof item === 'string') ? item : (item.url || '');
        if (!url) continue;

        const urlForExport = (typeof resolveImageUrl === 'function') ? resolveImageUrl(url) : url;
        if (typeof isVideoUrl === 'function' && isVideoUrl(urlForExport)) continue;

        const imgData = await _getImageDataUrl(urlForExport);
        if (!imgData) continue;

        if (i > 0) doc.addPage('a4', 'l');

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
          tradeLabel = `Date: ${dDate}`;
        }

        // 2. Get Individual Image Tags
        if (typeof getImageTagsForGalleryItem === 'function') {
          const itags = getImageTagsForGalleryItem(item);
          if (Array.isArray(itags) && itags.length) {
            imageTagsStr = `Tags: ${itags.join(', ')}`;
          }
        }

        // 3. Header (at top)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(60, 60, 60);
        doc.text(tradeLabel, margin, 11);

        const currentLabelWidth = doc.getTextWidth(tradeLabel);

        // Add Clickable Source Link — opens gallery at exact image
        const itemDate = (typeof item === 'object' && item.date) ? item.date : '';
        const itemRawUrl = (typeof item === 'object' && item.url) ? item.url : url;
        const sourceUrl = itemDate
            ? `${window.location.origin}/?galleryDate=${encodeURIComponent(itemDate)}&galleryImg=${encodeURIComponent(itemRawUrl)}`
            : (urlForExport.startsWith('/') ? window.location.origin + urlForExport : urlForExport);
        
        doc.setFontSize(9);
        doc.setTextColor(0, 102, 204);
        doc.textWithLink('[View Source]', margin + currentLabelWidth + 5, 11, { url: sourceUrl });

        if (Array.isArray(globalFilterTags) && globalFilterTags.length) {
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            const globalTagsStr = `Tag Filter: ${globalFilterTags.join(', ')}`;
            doc.text(globalTagsStr, pageWidth - margin, 10, { align: 'right' });
        }

        // 4. Image (centered)
        const imgProps = doc.getImageProperties(imgData);
        const availableWidth = pageWidth - (margin * 2);
        const availableHeight = pageHeight - 38; 

        const ratio = imgProps.width / imgProps.height;
        let finalWidth = availableWidth;
        let finalHeight = finalWidth / ratio;

        if (finalHeight > availableHeight) {
          finalHeight = availableHeight;
          finalWidth = finalHeight * ratio;
        }

        const x = margin + (availableWidth - finalWidth) / 2;
        const y = 12 + (availableHeight - finalHeight) / 2;

        doc.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight);

        // 5. Footer Data (at bottom)
        const footerY = y + finalHeight + 8;
        if (statsLabel) {
          doc.setFontSize(13);
          if (isProfit) doc.setTextColor(46, 204, 113);
          else if (isLoss) doc.setTextColor(231, 76, 60);
          else doc.setTextColor(100, 100, 100);
          doc.text(statsLabel, pageWidth / 2, footerY, { align: 'center' });
        }
        
        if (imageTagsStr) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(120, 120, 120);
          doc.text(imageTagsStr, pageWidth / 2, footerY + 6, { align: 'center' });
        }
      }

      doc.save(fname);
      if (typeof showToast === 'function') showToast('PDF Exported!', 'success');
    } catch (err) {
      console.error("PDF Export failed:", err);
      if (typeof showToast === 'function') showToast('PDF Export failed.', 'error');
    }
  }

  function _getImageDataUrl(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = (e) => {
        console.warn("Failed to load image for PDF:", url, e);
        resolve(null);
      };
      img.src = url;
    });
  }

  return { exportExcel, exportStructuredCsv, exportLoggerExcel, downloadBackup, exportImagesToPdf };
})();
