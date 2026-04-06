/**
 * @fileoverview pdf-handler.js
 * @description Handles PDF file selection, page rendering via pdf.js, 
 *              and importing selected pages as images into the journal.
 *              Also maintains a list of imported PDFs.
 */

const PdfHandler = (() => {
  let pdfDoc = null;
  let pageCanvases = [];
  let currentFileName = '';
  let currentFile = null;

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
    } else {
      console.warn('[PdfHandler] List button not found in DOM');
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
        if (typeof showToast === 'function') showToast('Uploading PDF...', 'info');
        const result = await uploadPdfToServer(file);
        if (result) {
          if (typeof showToast === 'function') showToast(`Uploaded: ${file.name}`, 'success');
          renderPdfList();
        } else {
          if (typeof showToast === 'function') showToast('Upload failed', 'error');
        }
        e.target.value = '';
      };
    }
    
    // Set worker source for pdf.js
    if (window.pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
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
      const dateStr = new Date(pdf.timestamp).toLocaleString();
      const safeName = pdf.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeFilename = encodeURIComponent(pdf.filename);
      return `
        <div class="pdf-item-row">
          <div class="pdf-item-icon">📄</div>
          <div class="pdf-item-info">
            <div class="pdf-item-name">${safeName}</div>
            <div class="pdf-item-meta">
              <span>💾 ${sizeMB} MB</span>
              <span>🕒 ${dateStr}</span>
            </div>
          </div>
          <div class="pdf-item-actions">
            <a class="pdf-action-btn view" href="${pdf.url}" target="_blank" title="Open PDF">👁️ View</a>
            <a class="pdf-action-btn view" href="${pdf.url}" download="${safeName}" title="Download PDF">⬇️ Download</a>
            <button class="pdf-action-btn delete" onclick="PdfHandler.deletePdfFile('${safeFilename}', this)" title="Delete PDF">🗑️ Delete</button>
          </div>
        </div>
      `;
    }).join('');
  }

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

  const _public = {
    init,
    deletePdfFile,
    openListModal,
    closeListModal
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
