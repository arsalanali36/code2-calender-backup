# JS - Frontend Service Layer (static/js/services/)
Consolidated code context for AI assistants.


## File: `static/js/services/apiClient.js`
```js
/**
 * @fileoverview apiClient.js
 * @description Central HTTP fetch wrapper for all API calls.
 *   - All service files call apiClient instead of fetch() directly.
 *   - One place to add auth headers, base URL, or global error handling.
 */

const apiClient = (() => {
  const BASE = '';   // empty = same origin; change to 'https://...' if hosted elsewhere

  /**
   * GET request. Returns parsed JSON.
   * @param {string} path - e.g. '/api/trades'
   */
  async function get(path) {
    const res = await fetch(BASE + path);
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return res.json();
  }

  /**
   * POST JSON body. Returns parsed JSON.
   * @param {string} path
   * @param {object} body
   */
  async function post(path, body) {
    const res = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
    return res.json();
  }

  /**
   * POST multipart FormData (for file uploads). Returns parsed JSON.
   */
  async function upload(path, formData) {
    const res = await fetch(BASE + path, { method: 'POST', body: formData });
    if (!res.ok) {
        let errJson = null;
        try { errJson = await res.json(); } catch(e) {}
        if (errJson && errJson.error) throw new Error(errJson.error);
        throw new Error(`UPLOAD ${path} → ${res.status}`);
    }
    return res.json();
  }

  /**
   * POST and receive a binary Blob (for file downloads).
   * @param {string} path
   * @param {object} body
   * @returns {Promise<Blob>}
   */
  async function download(path, body) {
    const res = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`DOWNLOAD ${path} → ${res.status}`);
    return res.blob();
  }

  /**
   * GET and receive a binary Blob.
   * @param {string} path - may include query string
   * @returns {Promise<Blob>}
   */
  async function downloadGet(path) {
    const res = await fetch(BASE + path);
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return res.blob();
  }

  return { get, post, upload, download, downloadGet };
})();

```

## File: `static/js/services/tradeService.js`
```js
/**
 * @fileoverview tradeService.js
 * @description All /api/trades operations.
 *   Components/modules call these instead of fetch('/api/trades') directly.
 */

const tradeService = (() => {
  /**
   * Load the full journal payload from the server.
   * @returns {Promise<{trades: Array, columns: Array, dayData: object}>}
   */
  async function loadTrades() {
    return apiClient.get('/api/trades');
  }

  /**
   * Persist the full journal payload to the server.
   * @param {{trades: Array, columns: Array, dayData: object}} payload
   */
  async function saveTrades(payload) {
    return apiClient.post('/api/trades', payload);
  }

  return { loadTrades, saveTrades };
})();

```

## File: `static/js/services/imageService.js`
```js
/**
 * @fileoverview imageService.js
 * @description All image-related API operations:
 *   upload, delete (to server trash), fetch timestamps, copy to clipboard.
 */

const imageService = (() => {
  /**
   * Upload a single image File object to the server.
   * @param {File} file
   * @param {number} [quality] - Optional compression quality (0-1)
   * @returns {Promise<{url: string, filename: string, originalSize: number, compressedSize: number}>}
   */
  async function uploadImage(file, quality) {
    let fileToUpload = file;
    let originalSize = file.size;
    let compressedSize = file.size;

    if (quality && quality < 1 && file.type.startsWith('image/')) {
        try {
            fileToUpload = await compressImage(file, quality);
            compressedSize = fileToUpload.size;
            console.log(`[Compression] q=${quality}, ${originalSize} -> ${compressedSize} bytes`);
        } catch (e) {
            console.warn("Compression failed, uploading original:", e);
        }
    }
    const fd = new FormData();
    fd.append('image', fileToUpload);
    if (file.lastModified) fd.append('last_modified_ms', String(file.lastModified));
    if (file.name) fd.append('original_filename', file.name);
    const result = await apiClient.upload('/api/upload-image', fd);
    return { ...result, originalSize, compressedSize };
  }

  /**
   * Compress image using canvas
   * @param {File} file
   * @param {number} quality
   * @returns {Promise<File>}
   */
  async function compressImage(file, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error('Canvas blob failed'));
            const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
            const newFile = new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
            resolve(newFile);
          }, 'image/jpeg', quality);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Move an image to the server-side trash (soft delete).
   * @param {string} imageUrl - e.g. '/uploads/abc123.png'
   */
  async function deleteImage(imageUrl) {
    const filename = imageUrl.split('/').pop();
    return apiClient.post('/api/delete-image', { filename });
  }

  /**
   * Fetch formatted creation times for a list of image URLs.
   * @param {string[]} urls
   * @returns {Promise<Record<string, string>>}  url → 'HH:MM AM/PM'
   */
  async function getImageTimes(urls) {
    if (!urls || !urls.length) return {};
    return apiClient.post('/api/image-times', { urls });
  }

  /**
   * Copy an image to the OS clipboard (Windows only, server-side).
   * @param {string} imageUrl - e.g. '/uploads/abc123.png'
   */
  async function copyToClipboard(imageUrl) {
    const filename = imageUrl.split('/').pop();
    return apiClient.post('/api/copy-image-to-clipboard', { filename });
  }

  async function uploadAudio(blob) {
    const fd = new FormData();
    fd.append('audio', blob, 'recording.webm');
    return apiClient.upload('/api/upload-audio', fd);
  }

  async function deleteAudio(audioUrl) {
    return apiClient.post('/api/delete-audio', { url: audioUrl });
  }

  async function uploadVideo(blob) {
    const fd = new FormData();
    fd.append('video', blob, 'recording.webm');
    return apiClient.upload('/api/upload-video', fd);
  }

  async function deleteVideo(videoUrl) {
    return apiClient.post('/api/delete-video', { url: videoUrl });
  }

  async function uploadPdf(file) {
    const fd = new FormData();
    fd.append('pdf', file, file.name);
    return apiClient.upload('/api/upload-pdf', fd);
  }

  async function listPdfs() {
    return apiClient.get('/api/list-pdfs');
  }

  async function deletePdf(filename) {
    return apiClient.post('/api/delete-pdf', { filename });
  }

  async function updatePdfPages(filename, pages) {
    return apiClient.post('/api/update-pdf-pages', { filename, pages });
  }

  return { uploadImage, deleteImage, getImageTimes, copyToClipboard, uploadAudio, deleteAudio, uploadVideo, deleteVideo, uploadPdf, listPdfs, deletePdf, updatePdfPages };
})();

```

## File: `static/js/services/importService.js`
```js
/**
 * @fileoverview importService.js
 * @description All data-import API operations: Excel, CSV variants, JSON/ZIP restore.
 *   Returns normalized {trades, columns} payloads.
 */

const importService = (() => {
  function _formDataFromFile(file, fieldName = 'file') {
    const fd = new FormData();
    fd.append(fieldName, file);
    return fd;
  }

  /**
   * Import trades from an Excel (.xlsx) file.
   * @param {File} file
   * @returns {Promise<{trades: Array, columns: Array}>}
   */
  async function importExcel(file) {
    return apiClient.upload('/api/import-excel', _formDataFromFile(file));
  }

  /**
   * Import trades from a Zerodha raw-fills CSV (today's trades).
   * @param {File} file
   * @returns {Promise<{trades: Array, columns: Array}>}
   */
  async function importRawCsv(file) {
    return apiClient.upload('/api/import-raw-csv', _formDataFromFile(file));
  }

  /**
   * Import trades from a Zerodha historical CSV.
   * @param {File} file
   * @returns {Promise<{trades: Array, columns: Array}>}
   */
  async function importHistoricalCsv(file) {
    return apiClient.upload('/api/import-historical-csv', _formDataFromFile(file));
  }

  /**
   * Import trades from a Dhan CSV.
   * @param {File} file
   * @returns {Promise<{trades: Array, columns: Array}>}
   */
  async function importDhanCsv(file) {
    return apiClient.upload('/api/import-dhan-csv', _formDataFromFile(file));
  }

  /**
   * Restore journal from a JSON or ZIP backup.
   * @param {File} file
   * @returns {Promise<{success: boolean, trades: Array, columns: Array}>}
   */
  async function importJsonOrZip(file) {
    return apiClient.upload('/api/import-json', _formDataFromFile(file));
  }

  return {
    importExcel,
    importRawCsv,
    importHistoricalCsv,
    importDhanCsv,
    importJsonOrZip,
  };
})();

```

## File: `static/js/services/exportService.js`
```js
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
      let newsOnCurrentPage = 0; // 0=none, 1=left, 2=right

      for (let i = 0; i < metaList.length; i++) {
        const item = metaList[i];
        const url = (typeof item === 'string') ? item : (item.url || '');
        if (!url) continue;

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

```

## File: `static/js/services/csvlogService.js`
```js
/**
 * @fileoverview csvlogService.js
 * @description API calls for CSVLog schema — fetch and upload.
 */

const csvlogService = (() => {

  /**
   * Fetch the current parsed schema from the server.
   * @returns {Promise<{groups: string[], fields: Object}|null>}
   */
  async function getSchema() {
    try {
      return await apiClient.get('/api/csvlog-schema');
    } catch (e) {
      return null;
    }
  }

  /**
   * Upload a new LOGGER.xlsx file to replace the schema.
   * @param {File} file
   * @returns {Promise<{ok: boolean, schema: Object}>}
   */
  async function uploadSchema(file) {
    const fd = new FormData();
    fd.append('file', file);
    return apiClient.upload('/api/csvlog-upload-schema', fd);
  }

  return { getSchema, uploadSchema };
})();

```
