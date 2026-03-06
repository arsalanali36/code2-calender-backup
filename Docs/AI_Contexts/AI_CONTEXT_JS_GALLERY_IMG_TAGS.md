# JS — Gallery Image Tags
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `static\js\gallery-img-tags.js`
```js
/**
 * @fileoverview gallery-img-tags.js
 * @description Applying standard image tags directly onto individual items.
 */

function renderGalleryImageTags() {
  const box = document.getElementById('gallery-image-tags');
  if (!box) return;
  box.innerHTML = '';

  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  const info = getCurrentGalleryImageTagInfo();
  const tags = info.imageTags || [];
  const marqueeTags = info.marqueeTags || [];

  if (!tags.length && !marqueeTags.length) {
    const hint = document.createElement('span');
    hint.className = 'gallery-tag-empty';
    hint.textContent = 'No image/marquee tags';
    box.appendChild(hint);
    return;
  }

  if (tags.length) {
    const imgLbl = document.createElement('span');
    imgLbl.className = 'gallery-tag-empty';
    imgLbl.textContent = 'Image:';
    box.appendChild(imgLbl);
    tags.forEach(tag => {
      const isRed = tags.length > 5;
      const c = isRed ? '#ff6b6b' : tagColor(tag);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'gallery-img-tag-chip';
      chip.textContent = `${tag} x`;
      chip.style.color = c;
      chip.style.borderColor = hexToRgba(c, 0.45);
      chip.style.background = isRed ? 'rgba(255, 107, 107, 0.16)' : hexToRgba(c, 0.16);
      chip.title = 'Remove tag from this image';
      chip.addEventListener('click', async () => {
        window._lastDeletedImageTag = { tag, imgUrl, ownerType: info.ownerType, trade: info.trade, dateKey: info.dateKey, origTags: [...tags] };
        const next = tags.filter(t => t !== tag);
        if (info.ownerType === 'trade' && info.trade) setImageTagsForUrl(info.trade, imgUrl, next);
        else if (info.ownerType === 'day' && info.dateKey) setDayImageTagsForUrl(info.dateKey, imgUrl, next);
        await saveTrades();
        renderGalleryImageTags();
        renderTable();
        renderCalendar();
      });
      box.appendChild(chip);
    });
  }

  if (marqueeTags.length) {
    if (tags.length) box.appendChild(document.createTextNode(' '));
    const mqLbl = document.createElement('span');
    mqLbl.className = 'gallery-tag-empty';
    mqLbl.textContent = 'Marquee:';
    box.appendChild(mqLbl);
    marqueeTags.forEach(tag => {
      const c = tagColor(tag);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'gallery-img-tag-chip';
      chip.textContent = `${tag} x`;
      chip.style.color = c;
      chip.style.borderColor = hexToRgba(c, 0.45);
      chip.style.background = hexToRgba(c, 0.12);
      chip.style.opacity = '0.9';
      chip.title = 'Remove this tag from all marquee boxes on this image';
      chip.addEventListener('click', async () => {
        let modified = false;
        if (info.ownerType === 'trade' && info.trade && info.trade.marqueeBoxes && info.trade.marqueeBoxes[imgUrl]) {
          info.trade.marqueeBoxes[imgUrl].forEach(b => {
            if (b.tags && b.tags.includes(tag)) {
              b.tags = b.tags.filter(t => t !== tag);
              modified = true;
            }
          });
        } else if (info.ownerType === 'day' && info.dateKey && state.dayData[info.dateKey]?.marqueeBoxes?.[imgUrl]) {
          state.dayData[info.dateKey].marqueeBoxes[imgUrl].forEach(b => {
            if (b.tags && b.tags.includes(tag)) {
              b.tags = b.tags.filter(t => t !== tag);
              modified = true;
            }
          });
        }

        if (modified) {
          if (typeof syncMarqueeBoxesShadow === 'function') syncMarqueeBoxesShadow();
          await saveTrades();
          renderGalleryImageTags();
          renderTable();
          renderCalendar();
          if (typeof renderGalleryTagsTray === 'function') renderGalleryTagsTray();
          if (typeof _renderMarqueeOnOverlayCanvas === 'function') _renderMarqueeOnOverlayCanvas();
        }
      });
      box.appendChild(chip);
    });
  }
}

function getAllImageTagsGlobal() {
  const set = new Set();
  state.trades.forEach(t => getAllImageTagsForTrade(t).forEach(tag => set.add(tag)));
  Object.keys(state.dayData || {}).forEach(d => getAllImageTagsForDay(d).forEach(tag => set.add(tag)));
  IMAGE_PERMANENT_TAGS.forEach(t => set.add(t));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function isPermanentImageTag(tag) {
  const s = String(tag || '').trim().toLowerCase();
  return IMAGE_PERMANENT_TAGS.some(t => t.toLowerCase() === s);
}

function renameImageTagGlobal(oldTag, newTag) {
  const oTagLow = String(oldTag).toLowerCase();
  state.trades.forEach(t => {
    const store = ensureImageTagStore(t);
    Object.keys(store).forEach(url => {
      const arr = Array.isArray(store[url]) ? store[url] : [];
      const next = arr.map(x => (String(x).toLowerCase() === oTagLow ? newTag : x));
      store[url] = Array.from(new Set(next.filter(Boolean)));
      if (!store[url].length) delete store[url];
    });
    t[IMAGE_TAG_COLUMN] = getAllImageTagsForTrade(t).join(', ');

    state.tagColumns.forEach(c => {
      if (typeof t[c] === 'string') {
        let arr = t[c].split(',').map(x => x.trim()).filter(Boolean);
        if (arr.some(x => x.toLowerCase() === oTagLow)) {
          t[c] = arr.map(x => x.toLowerCase() === oTagLow ? newTag : x).join(',');
        }
      } else if (Array.isArray(t[c])) {
        t[c] = t[c].map(x => String(x).toLowerCase() === oTagLow ? newTag : x);
      }
    });

  });
  Object.keys(state.dayData || {}).forEach(d => {
    const store = ensureDayImageTagStore(d);
    Object.keys(store).forEach(url => {
      const arr = Array.isArray(store[url]) ? store[url] : [];
      const next = arr.map(x => (String(x).toLowerCase() === oTagLow ? newTag : x));
      store[url] = Array.from(new Set(next.filter(Boolean)));
      if (!store[url].length) delete store[url];
    });

    const day = state.dayData[d];
    if (day && day.tags) {
      Object.keys(day.tags).forEach(c => {
        if (typeof day.tags[c] === 'string') {
          let arr = day.tags[c].split(',').map(x => x.trim()).filter(Boolean);
          if (arr.some(x => x.toLowerCase() === oTagLow)) {
            day.tags[c] = arr.map(x => x.toLowerCase() === oTagLow ? newTag : x).join(',');
          }
        } else if (Array.isArray(day.tags[c])) {
          day.tags[c] = day.tags[c].map(x => String(x).toLowerCase() === oTagLow ? newTag : x);
        }
      });
    }

  });
}

function deleteImageTagGlobal(tagToDelete) {
  const tLow = String(tagToDelete).toLowerCase();
  window._lastDeletedGlobalTag = {
    tag: tagToDelete,
    trades: JSON.parse(JSON.stringify(state.trades)),
    dayData: JSON.parse(JSON.stringify(state.dayData || {})),
    allTags: [...state.allTags],
    tagGroups: JSON.parse(JSON.stringify(state.tagGroups || {}))
  };
  state.trades.forEach(t => {
    const store = ensureImageTagStore(t);
    Object.keys(store).forEach(url => {
      const arr = Array.isArray(store[url]) ? store[url] : [];
      const next = arr.filter(x => String(x).toLowerCase() !== tLow);
      if (next.length) store[url] = next;
      else delete store[url];
    });
    if (t.marqueeBoxes) {
      Object.keys(t.marqueeBoxes).forEach(url => {
        t.marqueeBoxes[url].forEach(box => {
          if (box.tags && box.tags.some(x => String(x).toLowerCase() === tLow)) {
            box.tags = box.tags.filter(x => String(x).toLowerCase() !== tLow);
          }
        });
      });
    }

    state.tagColumns.forEach(c => {
      if (typeof t[c] === 'string') {
        const arr = t[c].split(',').map(x => x.trim()).filter(Boolean);
        if (arr.some(x => String(x).toLowerCase() === tLow)) {
          t[c] = arr.filter(x => String(x).toLowerCase() !== tLow).join(',');
        }
      } else if (Array.isArray(t[c])) {
        t[c] = t[c].filter(x => String(x).toLowerCase() !== tLow);
      }
    });

    t[IMAGE_TAG_COLUMN] = getAllImageTagsForTrade(t).join(', ');
  });
  Object.keys(state.dayData || {}).forEach(d => {
    const store = ensureDayImageTagStore(d);
    Object.keys(store).forEach(url => {
      const arr = Array.isArray(store[url]) ? store[url] : [];
      const next = arr.filter(x => String(x).toLowerCase() !== tLow);
      if (next.length) store[url] = next;
      else delete store[url];
    });
    if (day && day.marqueeBoxes) {
      Object.keys(day.marqueeBoxes).forEach(url => {
        day.marqueeBoxes[url].forEach(box => {
          if (box.tags && box.tags.some(x => String(x).toLowerCase() === tLow)) {
            box.tags = box.tags.filter(x => String(x).toLowerCase() !== tLow);
          }
        });
      });
    }

    const day = state.dayData[d];
    if (day && day.tags) {
      Object.keys(day.tags).forEach(c => {
        if (typeof day.tags[c] === 'string') {
          const arr = day.tags[c].split(',').map(x => x.trim()).filter(Boolean);
          if (arr.some(x => String(x).toLowerCase() === tLow)) {
            day.tags[c] = arr.filter(x => String(x).toLowerCase() !== tLow).join(',');
          }
        } else if (Array.isArray(day.tags[c])) {
          day.tags[c] = day.tags[c].filter(x => String(x).toLowerCase() !== tLow);
        }
      });
    }
  });

  state.allTags = (state.allTags || []).filter(x => String(x).toLowerCase() !== tLow);
  if (state.tagGroups) {
    Object.keys(state.tagGroups).forEach(g => {
      state.tagGroups[g] = (state.tagGroups[g] || []).filter(x => String(x).toLowerCase() !== tLow);
    });
  }
}

function openGalleryImageTagManager() {
  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  const info = getCurrentGalleryImageTagInfo();
  if (!imgUrl || (info.ownerType === 'trade' && !info.trade) || (info.ownerType === 'day' && !info.dateKey && !info.trade)) {
    showToast('Open an image first', 'error');
    return;
  }
  renderImageTagModal();
  document.getElementById('img-tag-modal').classList.add('open');
}

function closeGalleryImageTagManager() {
  const modal = document.getElementById('img-tag-modal');
  if (modal) modal.classList.remove('open');
}

function renderImageTagModal() {
  const currentWrap = document.getElementById('img-tag-current-list');
  const manageWrap = document.getElementById('img-tag-manage-list');
  if (!currentWrap || !manageWrap) return;
  currentWrap.innerHTML = '';
  manageWrap.innerHTML = '';

  const info = getCurrentGalleryImageTagInfo();
  const trade = info.trade;
  const imgUrl = info.imgUrl;
  const all = getAllImageTagsGlobal();
  const assigned = info.imageTags || [];

  all.forEach(tag => {
    const row = document.createElement('label');
    row.className = 'head-checkbox';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = assigned.includes(tag);
    const dot = document.createElement('span');
    dot.className = 'tag-dot';
    dot.style.background = tagColor(tag);
    const txt = document.createTextNode(tag);
    chk.addEventListener('change', async () => {
      const next = chk.checked ? [...assigned, tag] : assigned.filter(t => t !== tag);
      if (info.ownerType === 'trade' && trade) setImageTagsForUrl(trade, imgUrl, next);
      else if (info.ownerType === 'day' && info.dateKey) setDayImageTagsForUrl(info.dateKey, imgUrl, next);
      normalizeAllTagsFromTrades();
      await saveTrades();
      renderGalleryImageTags();
      renderTagFilterPanel();
      renderTable();
      renderCalendar();
      renderImageTagModal();
    });
    row.appendChild(chk);
    row.appendChild(dot);
    row.appendChild(txt);
    currentWrap.appendChild(row);
  });

  if (!all.length) {
    const hint = document.createElement('p');
    hint.className = 'panel-hint';
    hint.textContent = 'No tags yet';
    currentWrap.appendChild(hint);
  }



  all.forEach(tag => {
    const row = document.createElement('div');
    row.className = 'tag-manage-row';
    const dot = document.createElement('span');
    dot.className = 'tag-dot';
    dot.style.background = tagColor(tag);
    const name = document.createElement('span');
    name.textContent = tag;
    name.style.flex = '1';

    const renameBtn = document.createElement('button');
    renameBtn.className = 'tag-del-btn';
    renameBtn.textContent = 'edit';
    renameBtn.disabled = isPermanentImageTag(tag);
    renameBtn.title = isPermanentImageTag(tag) ? 'Permanent tag' : 'Rename tag';
    renameBtn.addEventListener('click', async () => {
      const next = String(prompt('New tag name:', tag) || '').trim();
      if (!next || next === tag) return;
      renameImageTagGlobal(tag, next);
      normalizeAllTagsFromTrades();
      await saveTrades();
      renderGalleryImageTags();
      renderTagFilterPanel();
      renderTable();
      renderCalendar();
      renderImageTagModal();
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'tag-del-btn';
    delBtn.textContent = 'x';
    delBtn.disabled = isPermanentImageTag(tag);
    delBtn.title = isPermanentImageTag(tag) ? 'Permanent tag' : 'Delete tag globally';
    delBtn.addEventListener('click', async () => {
      deleteImageTagGlobal(tag);
      normalizeAllTagsFromTrades();
      await saveTrades();
      renderGalleryImageTags();
      renderTagFilterPanel();
      renderTable();
      renderCalendar();
      renderImageTagModal();
    });

    row.appendChild(dot);
    row.appendChild(name);
    row.appendChild(renameBtn);
    row.appendChild(delBtn);
    manageWrap.appendChild(row);
  });
}

async function addImageTagFromModal() {
  const inp = document.getElementById('img-tag-new-name');
  const tag = String(inp?.value || '').trim();
  if (!tag) return;
  const info = getCurrentGalleryImageTagInfo();
  const trade = info.trade;
  const imgUrl = info.imgUrl;
  if (!imgUrl) return;
  const existing = Array.isArray(info.imageTags) ? [...info.imageTags] : [];
  if (!existing.includes(tag)) existing.push(tag);
  if (info.ownerType === 'trade' && trade) setImageTagsForUrl(trade, imgUrl, existing);
  else if (info.ownerType === 'day' && info.dateKey) setDayImageTagsForUrl(info.dateKey, imgUrl, existing);
  else return;
  if (!state.allTags.includes(tag)) state.allTags.push(tag);
  normalizeAllTagsFromTrades();
  await saveTrades();
  renderGalleryImageTags();
  renderTagFilterPanel();
  renderTable();
  renderCalendar();
  inp.value = '';
  renderImageTagModal();
}

document.addEventListener('keydown', e => {
  const isTyping = document.activeElement &&
    (document.activeElement.tagName === 'INPUT' ||
      document.activeElement.tagName === 'TEXTAREA' ||
      document.activeElement.isContentEditable);

  // Global Ctrl+Z to undo deleted image tags
  if (!isTyping && (e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
    if (!annotState.active) {
      if (window._lastDeletedImageTag) {
        e.preventDefault();
        const p = window._lastDeletedImageTag;
        if (p.ownerType === 'trade' && p.trade) setImageTagsForUrl(p.trade, p.imgUrl, p.origTags);
        else if (p.ownerType === 'day' && p.dateKey) setDayImageTagsForUrl(p.dateKey, p.imgUrl, p.origTags);
        if (!state.allTags.includes(p.tag)) state.allTags.push(p.tag);
        normalizeAllTagsFromTrades();
        window._lastDeletedImageTag = null;
        saveTrades().then(() => {
          if (typeof renderGalleryImageTags === 'function') renderGalleryImageTags();
          if (typeof renderTagFilterPanel === 'function') renderTagFilterPanel();
          if (typeof renderGalleryTagsTray === 'function') renderGalleryTagsTray();
          renderTable();
          renderCalendar();
          showToast(`Tag '${p.tag}' restored on image`, 'success');
        });
        return;
      } else if (window._lastDeletedGlobalTag) {
        e.preventDefault();
        const g = window._lastDeletedGlobalTag;
        state.trades = g.trades;
        state.dayData = g.dayData;
        state.allTags = g.allTags;
        state.tagGroups = g.tagGroups;
        window._lastDeletedGlobalTag = null;
        saveTrades().then(() => {
          if (typeof renderGalleryImageTags === 'function') renderGalleryImageTags();
          if (typeof renderTagFilterPanel === 'function') renderTagFilterPanel();
          if (typeof renderGalleryTagsTray === 'function') renderGalleryTagsTray();
          if (typeof renderImageTagModal === 'function') {
            const modal = document.getElementById('img-tag-modal');
            if (modal && modal.classList.contains('open')) renderImageTagModal();
          }
          renderTable();
          renderCalendar();
          showToast(`Global tag '${g.tag}' restored`, 'success');
        });
        return;
      }
    }
  }
});


```
