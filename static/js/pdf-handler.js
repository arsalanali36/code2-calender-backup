/**
 * @fileoverview pdf-handler.js
 * @description Handles PDF file selection, page rendering via pdf.js, 
 *              and importing selected pages as images into the journal.
 *              Also maintains a list of imported PDFs.
 */

const PdfHandler = (() => {
  let pdfDoc = null;
  const pdfDocCache = new Map(); // pdfId -> doc
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
        await _handlePdfUploadWithProgress(file);
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

  async function openPdfInGallery(pdfOrId) {
    // Accept either a pdf object {filename, name, pages, url} or just a filename string
    let pdf = pdfOrId;
    if (typeof pdfOrId === 'string') {
      const list = await imageService.listPdfs() || [];
      pdf = list.find(p => p.filename === pdfOrId || p.name === pdfOrId);
      if (!pdf) { if (typeof showToast === 'function') showToast('PDF not found', 'error'); return; }
    }

    closeListModal();

    const pages = pdf.pages || [];
    if (pages.length === 0) {
      if (typeof showToast === 'function') showToast('PDF has no processed pages yet', 'error');
      return;
    }

    // Open gallery if not open
    const gModal = document.getElementById('gallery-modal');
    if (gModal && !gModal.classList.contains('open')) {
      if (typeof openGallery === 'function') openGallery();
    }

    currentFileName = pdf.name;
    currentFile     = pdf;

    state.gallery.mode         = 'pdf';
    state.gallery.date         = null;
    state.gallery.pdf          = { name: pdf.name, filename: pdf.filename, url: pdf.url, pages };
    state.gallery.images       = [...pages];
    state.gallery.currentIndex = 0;

    registerActivePdf({ id: pdf.filename, name: pdf.name, url: pdf.url, filename: pdf.filename });

    if (typeof renderGallery === 'function') renderGallery();
  }

  function registerActivePdf(pdf) {
    if (!pdf || !pdf.filename) return;
    if (!state.gallery.activePdfs) state.gallery.activePdfs = [];
    
    const exists = state.gallery.activePdfs.find(p => p.id === pdf.filename);
    if (!exists) {
      state.gallery.activePdfs.push({
        id: pdf.filename,
        name: pdf.name || pdf.filename,
        url: pdf.url
      });
      // Re-render gallery to show the new tab
      if (typeof renderGallery === 'function') renderGallery();
    }
  }

  function unregisterActivePdf(pdfId) {
    state.gallery.activePdfs = state.gallery.activePdfs.filter(p => p.id !== pdfId);
    if (typeof renderGallery === 'function') renderGallery();
  }

  async function getDocById(pdfId) {
    if (pdfDocCache.has(pdfId)) return pdfDocCache.get(pdfId);
    
    let pdfList = [];
    try {
      pdfList = await imageService.listPdfs() || [];
    } catch(e) { console.error(e); }

    const pdf = pdfList.find(p => p.filename === pdfId || p.name === pdfId);
    if (!pdf) return null;
    
    try {
        const response = await fetch(pdf.url);
        const arrayBuffer = await response.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        pdfDocCache.set(pdfId, doc);
        return doc;
    } catch(e) {
        console.error('[PdfHandler] getDocById failed', e);
        return null;
    }
  }

  async function ensurePdfLoaded(pdfId) {
     const doc = await getDocById(pdfId);
     if (doc) {
       pdfDoc = doc;
       const pdfList = await imageService.listPdfs() || [];
       currentFile = pdfList.find(p => p.filename === pdfId || p.name === pdfId); 
       currentFileName = currentFile?.name || pdfId;
       
       // Auto-register in workspace bar
       if (currentFile) registerActivePdf(currentFile);
       
       return true;
     }
     return false;
  }

  async function prefetchAdjacentPages(pageNum, doc, count = 2) {
      if (!doc) return;
      const total = doc.numPages;
      for (let i = 1; i <= count; i++) {
          const next = pageNum + i;
          const prev = pageNum - i;
          if (next <= total) doc.getPage(next).catch(() => {});
          if (prev >= 1) doc.getPage(prev).catch(() => {});
      }
  }

  async function renderPageToMainCanvas(pageNum, pdfId) {
    const canvas = document.getElementById('pdf-main-canvas');
    if (!canvas) return;
    
    const doc = await getDocById(pdfId);
    if (!doc) return;
    
    // Show spinner overlay if busy
    canvas.style.opacity = '0.7';

    try {
        const page = await doc.getPage(pageNum);
        const pixelRatio = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: 1.8 * pixelRatio }); // HD rendering
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        canvas.style.display = 'block';
        canvas.style.opacity = '1';

        // Background prefetches
        prefetchAdjacentPages(pageNum, doc);

        // Manually trigger pin sync
        if (typeof renderTagPins === 'function') renderTagPins();
        if (typeof loadOverlayForCurrentImage === 'function') loadOverlayForCurrentImage();

    } catch (err) {
        console.error(`[PdfHandler] Error rendering main page ${pageNum}:`, err);
        canvas.style.opacity = '1';
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
      
      const thumbHtml = pdf.pages && pdf.pages.length
        ? `<img src="${pdf.pages[0]}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;border:1px solid rgba(255,255,255,0.1);" loading="lazy">`
        : `<div style="font-size:1.2rem;">📄</div>`;
      return `
        <div class="pdf-item-row" onclick="PdfHandler.openPdfInGallery(${pdfJson})">
          <div class="pdf-item-icon">${thumbHtml}</div>
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

  // ── Progress bar helpers ──────────────────────────────────────────────────

  function _showProgressBar(visible) {
    const el = document.getElementById('pdf-upload-progress');
    if (el) el.style.display = visible ? 'block' : 'none';
  }

  function _setProgress(pct, label, sub) {
    const fill  = document.getElementById('pdf-progress-fill');
    const pctEl = document.getElementById('pdf-progress-pct');
    const lbl   = document.getElementById('pdf-progress-label');
    const subEl = document.getElementById('pdf-progress-sub');
    if (fill)  fill.style.width  = Math.min(100, pct) + '%';
    if (pctEl) pctEl.textContent = Math.min(100, Math.round(pct)) + '%';
    if (lbl && label)  lbl.textContent = label;
    if (subEl && sub !== undefined) subEl.textContent = sub;
  }

  // XHR upload → returns job_id, tracking upload bytes progress (0→15%)
  function _uploadPdfXhr(file, onUploadPct) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const fd  = new FormData();
      fd.append('pdf', file, file.name);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onUploadPct) onUploadPct(e.loaded / e.total);
      });
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.job_id) resolve(data.job_id);
            else reject(new Error(data.error || 'No job_id returned'));
          } catch (e) { reject(e); }
        } else {
          reject(new Error('HTTP ' + xhr.status));
        }
      });
      xhr.addEventListener('error', () => reject(new Error('Network error')));
      xhr.open('POST', '/api/upload-pdf');
      xhr.send(fd);
    });
  }

  async function _handlePdfUploadWithProgress(file) {
    _showProgressBar(true);
    _setProgress(0, 'Uploading file...', file.name);

    let jobId;
    try {
      jobId = await _uploadPdfXhr(file, (ratio) => {
        _setProgress(ratio * 15, 'Uploading file...', file.name);
      });
    } catch (err) {
      _showProgressBar(false);
      if (typeof showToast === 'function') showToast('Upload failed: ' + err.message, 'error');
      return;
    }

    _setProgress(15, 'Processing pages...', 'Starting...');

    // SSE for page processing progress
    const source = new EventSource('/api/pdf-job/' + jobId);

    source.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.status === 'done') {
          source.close();
          _setProgress(100, 'Done!', '');
          setTimeout(() => {
            _showProgressBar(false);
            renderPdfList();
            const pageCount = (data.record?.pages || []).length;
            if (typeof showToast === 'function')
              showToast(file.name + ' — ' + pageCount + ' pages ready', 'success');
          }, 700);

        } else if (data.status === 'error') {
          source.close();
          _showProgressBar(false);
          if (typeof showToast === 'function')
            showToast('Processing failed: ' + (data.error || 'unknown'), 'error');

        } else {
          // processing — current/total from backend
          const cur   = data.current || 0;
          const total = data.total   || 0;
          const pct   = total > 0 ? 15 + Math.round((cur / total) * 85) : 15;
          const sub   = total > 0 ? `Page ${cur} of ${total}` : 'Processing...';
          _setProgress(pct, 'Processing pages...', sub);
        }
      } catch (err) {
        console.error('[PdfHandler] SSE parse error', err);
      }
    };

    source.onerror = () => {
      source.close();
      _showProgressBar(false);
      if (typeof showToast === 'function')
        showToast('Connection lost during processing', 'error');
    };
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

    const pdfId = currentFile?.filename || currentFile?.name;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const pageNum = parseInt(entry.target.dataset.page);
                renderThumbPage(pageNum, entry.target, pdfId);
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

  async function renderThumbPage(pageNum, container, pdfId) {
      if (!pdfId) pdfId = currentFile?.filename || currentFile?.name;
      if (!pdfId) return;
      const doc = await getDocById(pdfId);
      if (!doc) return;
      try {
          const page = await doc.getPage(pageNum);
          const pixelRatio = window.devicePixelRatio || 1;
          const viewport = page.getViewport({ scale: 0.3 * pixelRatio }); // Small scale for thumb
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.cssText = 'width:100%; height:100%; object-fit:contain;';
          const context = canvas.getContext('2d');
          
          await page.render({ canvasContext: context, viewport }).promise;
          
          // Clear before append to avoid ghosting or double-render
          container.querySelectorAll('canvas').forEach(c => c.remove());
          container.appendChild(canvas);
          
          // Fade in effect
          canvas.style.opacity = '0';
          canvas.style.transition = 'opacity 0.3s ease';
          setTimeout(() => canvas.style.opacity = '1', 50);
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
    renderPdfGalleryThumbs,
    renderThumbPage,
    ensurePdfLoaded,
    prefetchAdjacentPages,
    registerActivePdf,
    unregisterActivePdf
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
