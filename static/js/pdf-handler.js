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
  let sortCol = 'timestamp'; // 'name', 'timestamp', 'size'
  let sortDir = -1; // 1 = asc, -1 = desc (desc default for date)

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
    }
    
    const galleryPdfBtn = document.getElementById('gv2-pdf-library-btn');
    if (galleryPdfBtn) {
       galleryPdfBtn.onclick = () => openListModal();
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

    // Bind Header Sorting
    const hName = document.querySelector('.pdf-head-name');
    const hDate = document.querySelector('.pdf-head-date');
    const hSize = document.querySelector('.pdf-head-size');
    if (hName) hName.onclick = () => toggleSort('name');
    if (hDate) hDate.onclick = () => toggleSort('timestamp');
    if (hSize) hSize.onclick = () => toggleSort('size');

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

  async function openPdfInGallery(pdf) {
    if (typeof showToast === 'function') showToast(`Opening ${pdf.name}...`, 'info');
    closeListModal();
    
    try {
      // If gallery isn't open, open it
      const gModal = document.getElementById('gallery-modal');
      if (gModal && !gModal.classList.contains('open')) {
          if (typeof openGallery === 'function') openGallery();
      }

      const response = await fetch(pdf.url);
      const arrayBuffer = await response.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const doc = await loadingTask.promise;
      
      pdfDoc = doc;
      currentFileName = pdf.name;
      currentFile = pdf;

      // Switch Gallery State
      state.gallery.mode = 'pdf';
      state.gallery.pdf = {
          doc: doc,
          name: pdf.name,
          url: pdf.url,
          id: pdf.filename || pdf.name
      };
      
      const numPages = doc.numPages;
      const virtualImages = [];
      for(let i=1; i<=numPages; i++) {
          virtualImages.push(`pdf://${state.gallery.pdf.id}/${i}`);
      }
      
      state.gallery.images = virtualImages;
      state.gallery.currentIndex = 0;
      
      if (typeof renderGallery === 'function') renderGallery();
      
    } catch (err) {
      console.error('[PdfHandler] Failed to open PDF in Gallery:', err);
      if (typeof showToast === 'function') showToast('Failed to load PDF', 'error');
    }
  }

  async function ensurePdfLoaded(pdfId) {
     if (pdfDoc && (currentFile?.filename === pdfId || currentFileName === pdfId)) return true;
     
     // Find the pdf in serverPdfs
     const pdf = serverPdfs.find(p => p.filename === pdfId || p.name === pdfId);
     if (!pdf) return false;
     
     try {
         const response = await fetch(pdf.url);
         const arrayBuffer = await response.arrayBuffer();
         const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
         pdfDoc = await loadingTask.promise;
         currentFile = pdf;
         currentFileName = pdf.name;
         return true;
     } catch(e) {
         console.error('[PdfHandler] ensurePdfLoaded failed', e);
         return false;
     }
  }

  async function renderPageToMainCanvas(pageNum, pdfId) {
    const canvas = document.getElementById('pdf-main-canvas');
    if (!canvas) return;
    
    if (!pdfDoc || (pdfId && currentFile?.filename !== pdfId)) {
        if (pdfId) await ensurePdfLoaded(pdfId);
    }
    
    if (!pdfDoc) return;
    
    try {
        const page = await pdfDoc.getPage(pageNum);
        const pixelRatio = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: 1.5 * pixelRatio }); // HD rendering
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        canvas.style.display = 'block';
    } catch (err) {
        console.error(`[PdfHandler] Error rendering main page ${pageNum}:`, err);
    }
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

    // Apply Sorting
    serverPdfs.sort((a, b) => {
      let valA = a[sortCol];
      let valB = b[sortCol];
      
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      
      if (valA < valB) return -1 * sortDir;
      if (valA > valB) return 1 * sortDir;
      return 0;
    });

    // Update Header Arrows
    updateHeaderArrows();

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
      const d = new Date(pdf.timestamp);
      const dateStr = d.toLocaleDateString() + ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const safeName = pdf.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeFilename = encodeURIComponent(pdf.filename);
      const pdfJson = JSON.stringify(pdf).replace(/"/g, '&quot;');
      
      return `
        <div class="pdf-item-row" onclick="PdfHandler.openPdfInGallery(${pdfJson})">
          <div class="pdf-item-icon" style="font-size: 1.2rem;">📄</div>
          <div class="pdf-item-name" title="${safeName}">${safeName}</div>
          <div class="pdf-item-date">${dateStr}</div>
          <div class="pdf-item-size">${sizeMB} MB</div>
          <div class="pdf-menu-container">
            <button class="pdf-menu-btn" onclick="event.stopPropagation(); PdfHandler.togglePdfMenu(this)">⋮</button>
            <div class="pdf-dropdown-menu">
              <a class="pdf-menu-item" href="${pdf.url}" target="_blank">
                <span>👁️</span> View
              </a>
              <a class="pdf-menu-item" href="${pdf.url}" download="${safeName}">
                <span>⬇️</span> Download
              </a>
              <div class="pdf-menu-item delete" onclick="PdfHandler.deletePdfFile('${safeFilename}', this)">
                <span>🗑️</span> Delete
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function toggleSort(col) {
    if (sortCol === col) {
      sortDir *= -1;
    } else {
      sortCol = col;
      sortDir = (col === 'timestamp' ? -1 : 1); // Default to desc for dates, asc for others
    }
    renderPdfList();
  }

  function updateHeaderArrows() {
    const heads = {
      name: document.querySelector('.pdf-head-name'),
      timestamp: document.querySelector('.pdf-head-date'),
      size: document.querySelector('.pdf-head-size')
    };
    
    Object.keys(heads).forEach(k => {
      if (!heads[k]) return;
      // Remove existing arrow if any
      const existing = heads[k].querySelector('.sort-arrow');
      if (existing) existing.remove();
      
      if (k === sortCol) {
        const arrow = document.createElement('span');
        arrow.className = 'sort-arrow';
        arrow.style.marginLeft = '8px';
        arrow.style.fontSize = '0.7rem';
        arrow.style.color = 'var(--blue, #58a6ff)';
        arrow.textContent = sortDir === 1 ? '▲' : '▼';
        heads[k].appendChild(arrow);
      }
    });
  }

  function togglePdfMenu(btn) {
    const menu = btn.nextElementSibling;
    const isVisible = menu.classList.contains('show');
    
    // Close all other menus first
    document.querySelectorAll('.pdf-dropdown-menu').forEach(m => m.classList.remove('show'));
    
    if (!isVisible) {
      menu.classList.add('show');
    }
  }

  // Global click listener to close dropdowns
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.pdf-menu-container')) {
      document.querySelectorAll('.pdf-dropdown-menu').forEach(m => m.classList.remove('show'));
    }
  });

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

  function renderPdfGalleryThumbs(container) {
    if (!container || !pdfDoc) return;
    const numPages = pdfDoc.numPages;
    const currentIndex = state.gallery.currentIndex;

    container.innerHTML = '';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    container.style.padding = '8px';

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const pageNum = parseInt(entry.target.dataset.page);
                renderThumbPage(pageNum, entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, { root: container, threshold: 0.1, rootMargin: '200px' });

    for (let i = 1; i <= numPages; i++) {
        const thumbWrap = document.createElement('div');
        thumbWrap.className = `gv2-thumb-item ${currentIndex === (i-1) ? 'active' : ''}`;
        thumbWrap.style.cssText = 'width:100%; aspect-ratio:3/4; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden; position:relative; cursor:pointer; flex-shrink:0; border:2px solid transparent;';
        if (currentIndex === (i-1)) thumbWrap.style.borderColor = 'var(--blue)';
        
        thumbWrap.dataset.page = i;
        
        const numLabel = document.createElement('div');
        numLabel.style.cssText = 'position:absolute; bottom:4px; right:4px; font-size:10px; background:rgba(0,0,0,0.6); color:#fff; padding:2px 5px; border-radius:3px; z-index:2;';
        numLabel.textContent = i;
        thumbWrap.appendChild(numLabel);

        thumbWrap.onclick = () => {
            state.gallery.currentIndex = i - 1;
            if (typeof renderGallery === 'function') renderGallery();
        };

        container.appendChild(thumbWrap);
        observer.observe(thumbWrap);
    }
  }

  async function renderThumbPage(pageNum, container) {
      if (!pdfDoc) return;
      try {
          const page = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale: 0.3 }); // Small scale for thumb
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.cssText = 'width:100%; height:100%; object-fit:cover;';
          const context = canvas.getContext('2d');
          
          await page.render({ canvasContext: context, viewport }).promise;
          container.appendChild(canvas);
      } catch (err) {
          console.error(`[PdfHandler] Thumb render error page ${pageNum}:`, err);
      }
  }

  const _public = {
    init,
    deletePdfFile,
    openListModal,
    closeListModal,
    togglePdfMenu,
    openPdfInGallery,
    renderPageToMainCanvas,
    renderPdfGalleryThumbs
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
