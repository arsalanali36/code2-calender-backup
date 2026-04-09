/**
 * @fileoverview gallery-image-manager.js
 * @description Renders a table view of Dates vs Selected Tags, showing image counts.
 */

function initImageManager() {
  const openBtn = document.getElementById('gv2-img-manager-btn');
  const closeBtn = document.getElementById('img-manager-close-x');
  const overlay = document.getElementById('img-manager-overlay');
  
  const colBtn = document.getElementById('im-col-toggle-btn');
  const colMenu = document.getElementById('im-col-menu');
  const thDate = document.getElementById('im-th-date');

  if (openBtn) {
    openBtn.onclick = () => {
      overlay.style.display = 'flex';
      renderImageManagerTable();
    };
  }

  if (closeBtn) {
    closeBtn.onclick = () => {
      overlay.style.display = 'none';
      if (colMenu) colMenu.style.display = 'none';
    };
  }

  if (colBtn && colMenu) {
    colBtn.onclick = (e) => {
      e.stopPropagation();
      const isOpen = colMenu.style.display === 'flex';
      colMenu.style.display = isOpen ? 'none' : 'flex';
      if (!isOpen) {
          renderColumnMenu();
          const sInput = colMenu.querySelector('.im-col-search');
          if (sInput) setTimeout(() => sInput.focus(), 50);
      }
    };

    colMenu.onclick = (e) => e.stopPropagation();

    document.addEventListener('click', () => {
        if (colMenu.style.display === 'flex') colMenu.style.display = 'none';
    });
  }

  if (thDate) {
    thDate.onclick = () => {
       state.gallery.managerSortDir = state.gallery.managerSortDir === 'desc' ? 'asc' : 'desc';
       const arrow = document.getElementById('im-sort-arrow');
       if (arrow) arrow.textContent = state.gallery.managerSortDir === 'desc' ? '↓' : '↑';
       renderImageManagerTable();
    };
  }



  // Close on ESC
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.style.display === 'flex') {
      overlay.style.display = 'none';
    }
  });
}

function getManagerAllTags() {
    const tags = new Set(state.allTags || []);
    // Ensure all tags mentioned in data are included
    state.trades.forEach(t => {
        (t.tags || []).forEach(tag => tags.add(tag));
        (t.images || []).forEach(url => {
            (t.imageTags?.[url] || []).forEach(tag => tags.add(tag));
            (t.marqueeBoxes?.[url] || []).forEach(box => (box.tags || []).forEach(tg => tags.add(tg)));
        });
    });
    Object.entries(state.dayData || {}).forEach(([d, day]) => {
        (Array.isArray(day.tags) ? day.tags : []).forEach(tag => tags.add(tag));
        [...(day.newsImages || []), ...(day.images || []), ...(day.closeImages || []), ...(day.closeGlobalImages || [])].forEach(url => {
            (Array.isArray(day.imageTags?.[url]) ? day.imageTags[url] : []).forEach(tag => tags.add(tag));
        });
    });
    return Array.from(tags).filter(t => t && t.trim()).sort((a, b) => a.localeCompare(b));
}

function renderColumnMenu(searchQuery = '') {
    const menu = document.getElementById('im-col-menu');
    if (!menu) return;
    
    let searchWrap = menu.querySelector('.im-col-search-wrap');
    if (!searchWrap) {
        // Clear all
        menu.innerHTML = '';

        searchWrap = document.createElement('div');
        searchWrap.className = 'im-col-search-wrap';
        const sInput = document.createElement('input');
        sInput.className = 'im-col-search';
        sInput.placeholder = 'Search tags...';
        sInput.type = 'text';
        sInput.oninput = (e) => { renderColumnList(e.target.value); };
        searchWrap.appendChild(sInput);
        menu.appendChild(searchWrap);

        const listWrap = document.createElement('div');
        listWrap.className = 'im-col-list panel-list';
        listWrap.id = 'im-col-list';
        menu.appendChild(listWrap);
    }

    renderColumnList(searchQuery);
}

function buildManagerTagCountMap() {
    const countMap = new Map();
    try {
        const bump = (tag) => {
            const t = String(tag || '').trim();
            if (!t) return;
            countMap.set(t, (countMap.get(t) || 0) + 1);
        };
        (state.trades || []).forEach(tr => {
            (tr.images || []).forEach(url => {
                ((tr.imageTags || {})[url] || []).forEach(bump);
                ((tr.marqueeBoxes || {})[url] || []).forEach(b => (b.tags || []).forEach(bump));
            });
        });
        Object.values(state.dayData || {}).forEach(day => {
            [...(day.newsImages || []), ...(day.images || []), ...(day.closeImages || []), ...(day.closeGlobalImages || [])].forEach(url => {
                ((day.imageTags || {})[url] || []).forEach(bump);
                ((day.marqueeBoxes || {})[url] || []).forEach(b => (b.tags || []).forEach(bump));
            });
        });
    } catch(e) {
        console.warn('[ImageManager] buildManagerTagCountMap error:', e);
    }
    return countMap;
}

function renderColumnList(q = '') {
    const listWrap = document.getElementById('im-col-list');
    if (!listWrap) return;
    listWrap.innerHTML = '';

    const allTags = getManagerAllTags();
    const ql = q.toLowerCase();

    // Build image-based tag count map (same logic as gallery-tags-filter.js)
    const counts = buildManagerTagCountMap();
    const groups = state.tagGroups || {};
    const renderedTags = new Set();

    const renderTagItem = (tag) => {
        if (ql && !tag.toLowerCase().includes(ql)) return;
        if (renderedTags.has(tag)) return;
        renderedTags.add(tag);

        const lbl = document.createElement('label');
        lbl.className = 'head-checkbox';
        lbl.style.marginBottom = '6px';
        lbl.style.display = 'flex';
        lbl.style.alignItems = 'center';
        lbl.style.gap = '8px';
        lbl.style.padding = '8px';
        lbl.style.background = 'rgba(255,255,255,0.03)';
        lbl.style.borderRadius = '8px';

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = (state.gallery.managerTags || []).includes(tag);
        chk.onclick = (e) => {
            e.stopPropagation();
            let mTags = state.gallery.managerTags || [];
            if (chk.checked) {
                if (!mTags.includes(tag)) mTags.push(tag);
            } else {
                mTags = mTags.filter(t => t !== tag);
            }
            state.gallery.managerTags = mTags;
            saveTagGroups();
            renderImageManagerTable();
        };
        lbl.appendChild(chk);

        // Icon if exists
        const imgUrl = state.tagImages[tag];
        if (imgUrl) {
            const img = document.createElement('img');
            img.src = resolveImageUrl(imgUrl);
            img.style.cssText = 'height:30px; width:30px; object-fit:contain; border-radius:4px; background:#000; flex-shrink:0;';
            lbl.appendChild(img);
        }

        const nameSpan = document.createElement('span');
        nameSpan.textContent = tag;
        nameSpan.style.flex = 1;
        nameSpan.style.fontSize = '0.85rem';
        lbl.appendChild(nameSpan);

        if (counts.has(tag)) {
            const cSpan = document.createElement('span');
            cSpan.className = 'gv2-tt-tag-count';
            cSpan.textContent = counts.get(tag);
            lbl.appendChild(cSpan);
        }

        listWrap.appendChild(lbl);
    };

    // Frequent Tags
    const topTags = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(e => e[0])
        .slice(0, 8);
    
    if (topTags.length > 0) {
        const topFiltered = ql ? topTags.filter(t => t.toLowerCase().includes(ql)) : topTags;
        if (topFiltered.length) {
            const h = document.createElement('div');
            h.className = 'panel-manage-label';
            h.textContent = '★ FREQUENT TAGS';
            h.style.color = '#ffb347';
            listWrap.appendChild(h);
            topFiltered.forEach(renderTagItem);
        }
    }

    // Groups
    Object.keys(groups).forEach(gName => {
        const gTags = (groups[gName] || []).filter(t => allTags.includes(t));
        const gFiltered = ql ? gTags.filter(t => t.toLowerCase().includes(ql)) : gTags;
        if (gFiltered.length && gFiltered.some(t => !renderedTags.has(t))) {
            const h = document.createElement('div');
            h.className = 'panel-manage-label';
            h.textContent = gName;
            h.style.marginTop = '10px';
            listWrap.appendChild(h);
            gFiltered.forEach(renderTagItem);
        }
    });

    // Ungrouped
    const untagged = allTags.filter(t => !renderedTags.has(t));
    const uFiltered = ql ? untagged.filter(t => t.toLowerCase().includes(ql)) : untagged;
    if (uFiltered.length) {
        const h = document.createElement('div');
        h.className = 'panel-manage-label';
        h.textContent = 'Ungrouped';
        h.style.marginTop = '10px';
        listWrap.appendChild(h);
        uFiltered.forEach(renderTagItem);
    }

    if (renderedTags.size === 0) {
        listWrap.innerHTML = `<div style="padding:20px; text-align:center; color:#8b949e; font-size:0.8rem;">No tags found</div>`;
    }
}

function renderImageManagerTable() {
  const table = document.getElementById('im-table');
  const headRow = document.getElementById('im-table-head');
  const tbody = document.getElementById('im-table-body');
  const emptyState = document.getElementById('img-manager-empty');
  
  if (!table || !headRow || !tbody || !emptyState) return;

  const mTags = state.gallery.managerTags || [];
  
  if (mTags.length === 0) {
    table.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  table.style.display = 'table';
  emptyState.style.display = 'none';

  // 1. Setup Header
  // Keep the first static th (Date) and last static th (Trades)
  const dateTh = headRow.firstElementChild;
  const tradesTh = headRow.lastElementChild;
  
  // Clear dynamic middle columns
  headRow.innerHTML = '';
  headRow.appendChild(dateTh);

  mTags.forEach(tag => {
    const th = document.createElement('th');
    th.style.textAlign = 'center';
    th.style.padding = '8px 10px';
    
    const content = document.createElement('div');
    content.className = 'im-header-content';
    
    const text = document.createElement('span');
    text.className = 'im-header-text';
    text.textContent = tag;
    
    const dotsBtn = document.createElement('button');
    dotsBtn.className = 'im-header-dots-btn';
    dotsBtn.innerHTML = '⋮';
    dotsBtn.onclick = (e) => {
      e.stopPropagation();
      openHeaderMenu(e, tag);
    };
    
    content.appendChild(text);
    content.appendChild(dotsBtn);
    th.appendChild(content);
    headRow.appendChild(th);
  });
  headRow.appendChild(tradesTh);

  // 2. Collect Data
  const dateMap = new Map(); // dateKey -> { images: [], tradesInfo: [] }

  // Sorting dates logic
  const sortDir = state.gallery.managerSortDir || 'desc';

  // Helper to add image to entry
  const addImgs = (entry, tradeObj, urls, isDayLevel) => {
      urls.forEach(url => {
          const tags = isDayLevel ? getDayImageTagsForUrl(entry.dateKey, url) : getImageTagsForUrl(tradeObj, url);
          entry.images.push({ url, tags });
      });
  };

  // From Trades
  state.trades.forEach((tr, trIdx) => {
    const d = normalizeDate(extractDateFromTrade(tr));
    if (!d) return;
    if (!dateMap.has(d)) dateMap.set(d, { dateKey: d, images: [], tradesInfo: [] });
    const entry = dateMap.get(d);
    
    const tradeImgs = tr.images || [];
    const tLabel = `T${tradeImgs.length > 0 ? (entry.tradesInfo.length + 1) : ''}`; // Just a label helper
    
    // We want to track images per trade for the breakdown
    entry.tradesInfo.push({
        id: `T${entry.tradesInfo.length + 1}`,
        imgCount: tradeImgs.length,
        originalTrade: tr
    });

    addImgs(entry, tr, tradeImgs, false);
  });

  // From DayData
  Object.entries(state.dayData || {}).forEach(([d, day]) => {
    if (!dateMap.has(d)) dateMap.set(d, { dateKey: d, images: [], tradesInfo: [] });
    const entry = dateMap.get(d);
    
    // Virtual items for News, Open, Close status in breakdown
    entry._dayStatus = {
        news: day.newsImages?.length || 0,
        open: day.images?.length || 0,
        close: day.closeImages?.length || 0
    };

    addImgs(entry, null, day.newsImages || [], true);
    addImgs(entry, null, day.images || [], true);
    addImgs(entry, null, day.closeImages || [], true);
  });

  // Sort dates
  const sortedDates = Array.from(dateMap.keys()).sort((a, b) => {
      return sortDir === 'desc' ? b.localeCompare(a) : a.localeCompare(b);
  });

  // 3. Render Rows
  tbody.innerHTML = '';
  sortedDates.forEach(dateKey => {
    const entry = dateMap.get(dateKey);
    const tr = document.createElement('tr');

    // Date Cell
    const tdDate = document.createElement('td');
    tdDate.className = 'im-date-cell';
    const dObj = new Date(dateKey);
    const dayName = dObj.toLocaleDateString('en-US', { weekday: 'short' });
    const formatted = dObj.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    tdDate.textContent = `${formatted} (${dayName})`;
    tdDate.onclick = () => {
        if (typeof openGalleryForDateWithPicker === 'function') {
            openGalleryForDateWithPicker(dateKey);
            document.getElementById('img-manager-overlay').style.display = 'none';
        }
    };
    tdDate.style.cursor = 'pointer';
    tr.appendChild(tdDate);

    // Tag Cells
    mTags.forEach(tagName => {
      const td = document.createElement('td');
      td.className = 'im-tag-cell';
      
      let count = 0;
      entry.images.forEach(img => {
        if ((img.tags || []).includes(tagName)) count++;
      });

      const span = document.createElement('span');
      span.className = 'im-count' + (count === 0 ? ' missing' : '');
      span.textContent = count > 0 ? String(count) : '0';
      
      if (count > 0) {
          td.style.cursor = 'pointer';
          td.onclick = () => {
              if (typeof openGalleryForDateWithTagFilter === 'function') {
                  openGalleryForDateWithTagFilter(dateKey, [tagName]);
                  document.getElementById('img-manager-overlay').style.display = 'none';
              }
          };
      } else {
          td.style.cursor = 'pointer';
          td.title = `Click to upload image and tag with "${tagName}"`;
          td.onclick = () => uploadImageForManager(dateKey, tagName, null);
      }

      td.appendChild(span);
      tr.appendChild(td);
    });

    // Trades Cell (Breakdown)
    const tdTrades = document.createElement('td');
    tdTrades.className = 'im-trade-cell';
    
    if (entry.tradesInfo.length > 0 || entry._dayStatus) {
        const list = document.createElement('div');
        list.className = 'im-trade-list';

        // 1. News
        if (entry._dayStatus) {
            const newsItem = document.createElement('div');
            newsItem.className = 'im-trade-item' + (entry._dayStatus.news > 0 ? ' has-img' : ' no-img');
            newsItem.innerHTML = `<span>News</span>${entry._dayStatus.news > 0 ? `<span class="im-trade-img-count">(${entry._dayStatus.news})</span>` : ''}`;
            newsItem.style.cursor = 'pointer';
            newsItem.style.color = '#ffa500';
            newsItem.onclick = () => {
                if (typeof openGalleryForDateWithTagFilter === 'function') {
                    openGalleryForDateWithTagFilter(dateKey, ['News']);
                    document.getElementById('img-manager-overlay').style.display = 'none';
                }
            };
            list.appendChild(newsItem);

            const openItem = document.createElement('div');
            openItem.className = 'im-trade-item' + (entry._dayStatus.open > 0 ? ' has-img' : ' no-img');
            openItem.innerHTML = `<span>Open</span>${entry._dayStatus.open > 0 ? `<span class="im-trade-img-count">(${entry._dayStatus.open})</span>` : ''}`;
            openItem.style.cursor = 'pointer';
            openItem.onclick = () => {
                if (typeof openGalleryForDate === 'function') {
                    openGalleryForDate(dateKey);
                    document.getElementById('img-manager-overlay').style.display = 'none';
                }
            };
            list.appendChild(openItem);
        }

        entry.tradesInfo.forEach(tInfo => {
            const item = document.createElement('div');
            item.className = 'im-trade-item';

            // Determine P/L color
            const pnl = parseFloat(tInfo.originalTrade?.['Net P/L'] ?? tInfo.originalTrade?.['Rs'] ?? 0);
            if (pnl > 0) item.classList.add('pnl-win');
            else if (pnl < 0) item.classList.add('pnl-loss');

            if (tInfo.imgCount > 0) {
                item.classList.add('has-img');
                item.innerHTML = `<span>${tInfo.id}</span><span class="im-trade-img-count">(${tInfo.imgCount})</span>`;
                item.style.cursor = 'pointer';
                item.onclick = () => {
                    const idx = state.trades.indexOf(tInfo.originalTrade);
                    if (idx >= 0 && typeof openGalleryDirect === 'function') {
                        openGalleryDirect(tInfo.originalTrade.images, 0, idx);
                        document.getElementById('img-manager-overlay').style.display = 'none';
                    }
                };
            } else {
                item.classList.add('no-img');
                item.textContent = tInfo.id;
                item.style.cursor = 'pointer';
                item.title = `Click to upload missing image for ${tInfo.id}`;
                item.onclick = () => uploadImageForManager(dateKey, null, tInfo.originalTrade);
            }
            list.appendChild(item);
        });

        if (entry._dayStatus) {
            const closeItem = document.createElement('div');
            closeItem.className = 'im-trade-item' + (entry._dayStatus.close > 0 ? ' has-img' : ' no-img');
            closeItem.innerHTML = `<span>Close</span>${entry._dayStatus.close > 0 ? `<span class="im-trade-img-count">(${entry._dayStatus.close})</span>` : ''}`;
            closeItem.style.cursor = 'pointer';
            closeItem.onclick = () => {
                if (typeof openGalleryForDate === 'function') {
                    openGalleryForDate(dateKey); // Will show close images too
                    document.getElementById('img-manager-overlay').style.display = 'none';
                }
            };
            list.appendChild(closeItem);
        }
        tdTrades.appendChild(list);
    } else {
        tdTrades.textContent = '-';
        tdTrades.style.opacity = '0.3';
    }
    tr.appendChild(tdTrades);

    tbody.appendChild(tr);
  });
}

// Help helpers if not defined globally
if (typeof normalizeDate !== 'function') {
    window.normalizeDate = (d) => {
        if (!d) return '';
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return '';
        return dt.toISOString().split('T')[0];
    };
}


function openHeaderMenu(event, tagName) {
    const menu = document.getElementById('im-header-menu');
    if (!menu) return;

    const rect = event.target.getBoundingClientRect();
    menu.style.top = (rect.bottom + 5) + 'px';
    
    // Position menu and ensure it doesn't go off-screen
    const menuWidth = 160; 
    let left = rect.left + (rect.width / 2) - (menuWidth / 2);
    if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 10;
    if (left < 0) left = 10;
    menu.style.left = left + 'px';

    menu.innerHTML = `
        <div class="im-header-menu-item" onclick="exportColumnToPdf('${tagName}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Export to PDF
        </div>
        <div class="im-header-menu-item" onclick="removeManagerColumn('${tagName}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Close
        </div>
    `;

    menu.style.display = 'block';

    const closeListener = () => {
        hideHeaderMenu();
        document.removeEventListener('click', closeListener);
    };
    setTimeout(() => document.addEventListener('click', closeListener), 10);
}

function hideHeaderMenu() {
    const menu = document.getElementById('im-header-menu');
    if (menu) menu.style.display = 'none';
}

function removeManagerColumn(tagName) {
    hideHeaderMenu();
    state.gallery.managerTags = (state.gallery.managerTags || []).filter(t => t !== tagName);
    saveTagGroups();
    renderImageManagerTable();
}

async function exportColumnToPdf(tagName) {
    hideHeaderMenu();
    if (typeof showToast === 'function') showToast(`Exporting images for "${tagName}"...`, 'info');

    // 1. Collect meta for images containing this tag across dates currently in view
    const metaToExport = [];
    const managerTags = state.gallery.managerTags || [];
    
    // We need the sorting and dates logic used in renderImageManagerTable
    // It's already in that function's scope but for simplicity we re-search
    const dateMap = new Map();
    state.trades.forEach((tr, trIdx) => {
        const d = normalizeDate(extractDateFromTrade(tr));
        if (!d) return;
        if (!dateMap.has(d)) dateMap.set(d, { dateKey: d, images: [] });
        const entry = dateMap.get(d);
        (tr.images || []).forEach(url => {
            const tags = getImageTagsForUrl(tr, url);
            if (tags.includes(tagName)) {
                metaToExport.push({ url, date: d, sourceRow: trIdx });
            }
        });
    });

    Object.entries(state.dayData || {}).forEach(([d, day]) => {
        [...(day.newsImages || []), ...(day.images || []), ...(day.closeImages || []), ...(day.closeGlobalImages || [])].forEach(url => {
            const tags = getDayImageTagsForUrl(d, url);
            if (tags.includes(tagName)) {
                metaToExport.push({ url, date: d, sourceRow: null });
            }
        });
    });

    if (metaToExport.length === 0) {
        if (typeof showToast === 'function') showToast(`No images found with tag "${tagName}" in current view.`, 'warning');
        return;
    }

    if (typeof exportService === 'undefined' || typeof exportService.exportImagesToPdf !== 'function') {
        if (typeof showToast === 'function') showToast('Export service not available.', 'error');
        return;
    }

    const filename = `dashboard_export_${tagName.replace(/[^a-z0-9]/gi, '_')}.pdf`;
    await exportService.exportImagesToPdf(metaToExport, filename, [tagName]);
    
    if (typeof showToast === 'function') showToast(`Export complete: ${filename}`, 'success');
}

document.addEventListener('DOMContentLoaded', initImageManager);

/**
 * Click-to-upload helper for missing images in Manager
 * @param {string} dateKey 
 * @param {string|null} tagName 
 * @param {object|null} tradeObj 
 */
async function uploadImageForManager(dateKey, tagName, tradeObj = null) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
    inp.onchange = async () => {
        const files = Array.from(inp.files);
        if (!files.length) return;
        if (typeof showToast === 'function') showToast(`Uploading ${files.length} image(s)...`, 'info');
        
        let added = 0;
        for (const file of files) {
            try {
                const res = await imageService.uploadImage(file);
                if (res.url) {
                    const url = res.url;
                    // Add to data
                    if (tradeObj) {
                        if (!tradeObj.images) tradeObj.images = [];
                        tradeObj.images.push(url);
                    } else {
                        if (!state.dayData[dateKey]) state.dayData[dateKey] = {};
                        if (!state.dayData[dateKey].images) state.dayData[dateKey].images = [];
                        state.dayData[dateKey].images.push(url);
                    }
                    
                    // Assign tag if provided
                    if (tagName) {
                        if (tradeObj) {
                            if (typeof setImageTagsForUrl === 'function') setImageTagsForUrl(tradeObj, url, [tagName]);
                        } else {
                            if (typeof setDayImageTagsForUrl === 'function') setDayImageTagsForUrl(dateKey, url, [tagName]);
                        }
                    }
                    added++;
                }
            } catch (e) { console.error('Upload failed', e); }
        }
        
        if (added) {
            if (typeof normalizeAllTagsFromTrades === 'function') normalizeAllTagsFromTrades();
            if (typeof saveTrades === 'function') await saveTrades();
            if (typeof showToast === 'function') showToast(`Added ${added} image(s)`, 'success');
            
            // Re-render everything
            renderImageManagerTable();
            if (typeof renderTable === 'function') renderTable();
            if (typeof renderCalendar === 'function') renderCalendar();
            
            // Refresh gallery if it's open (it might be open behind the manager)
            const galModal = document.getElementById('gallery-modal');
            if (galModal && galModal.classList.contains('open') && typeof renderGallery === 'function') {
                renderGallery();
            }
        }
    };
    inp.click();
}
