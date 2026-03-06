/**
 * @fileoverview table-colops.js
 * @description Header context actions, hide/add column schemas logic.
 */

function renderTagFilterPanel() {
  const panel = document.getElementById('tag-filter-panel');
  normalizeAllTagsFromTrades();
  panel.innerHTML = '';
  const keys = getAllColumnTagKeys();
  if (!keys.length) {
    panel.innerHTML = '<p class="panel-hint" style="padding:10px 8px">No tags yet.<br>Add via tag columns.</p>';
    return;
  }

  const actRow = document.createElement('div'); actRow.className = 'panel-act-row';
  const btnAll = document.createElement('button'); btnAll.className = 'panel-act-btn'; btnAll.textContent = 'All';
  const btnNone = document.createElement('button'); btnNone.className = 'panel-act-btn'; btnNone.textContent = 'None';
  btnAll.addEventListener('click', () => { state.tagFilter = [...keys]; renderTagFilterPanel(); applyTagFilter(); });
  btnNone.addEventListener('click', () => { state.tagFilter = []; renderTagFilterPanel(); applyTagFilter(); });
  actRow.appendChild(btnAll); actRow.appendChild(btnNone); panel.appendChild(actRow);

  getTagColumns().forEach(col => {
    const tags = getUniqueTagsForColumn(col);
    if (!tags.length) return;

    const colLabel = document.createElement('div');
    colLabel.className = 'panel-manage-label';
    colLabel.style.marginTop = '6px';
    colLabel.textContent = col;
    panel.appendChild(colLabel);

    const list = document.createElement('div');
    list.className = 'panel-list';
    tags.forEach(tag => {
      const key = makeTagFilterKey(col, tag);
      const lbl = document.createElement('label'); lbl.className = 'head-checkbox';
      const dot = document.createElement('span'); dot.className = 'tag-dot'; dot.style.background = tagColor(tag);
      const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = state.tagFilter.includes(key);
      chk.addEventListener('change', () => {
        if (chk.checked) { if (!state.tagFilter.includes(key)) state.tagFilter.push(key); }
        else state.tagFilter = state.tagFilter.filter(t => t !== key);
        applyTagFilter();
      });
      lbl.appendChild(chk); lbl.appendChild(dot); lbl.appendChild(document.createTextNode(tag));
      list.appendChild(lbl);
    });
    panel.appendChild(list);
  });

  const sep = document.createElement('div'); sep.style.cssText = 'height:1px;background:var(--border);margin:8px 0';
  panel.appendChild(sep);
  const mLabel = document.createElement('div'); mLabel.className = 'panel-manage-label'; mLabel.textContent = 'Delete Tags (Column-wise)';
  panel.appendChild(mLabel);
  getTagColumns().forEach(col => {
    const tags = getUniqueTagsForColumn(col);
    tags.forEach(tag => {
      const key = makeTagFilterKey(col, tag);
      const row = document.createElement('div'); row.className = 'tag-manage-row';
      const dot = document.createElement('span'); dot.className = 'tag-dot'; dot.style.background = tagColor(tag);
      const name = document.createElement('span'); name.textContent = `${col}: ${tag}`; name.style.flex = '1';
      const del = document.createElement('button'); del.className = 'tag-del-btn'; del.textContent = 'x'; del.title = 'Delete in this column only';
      del.addEventListener('click', () => {
        state.tagFilter = state.tagFilter.filter(t => t !== key);
        state.trades.forEach(t => {
          if (Array.isArray(t[col])) t[col] = t[col].filter(x => x !== tag);
          if (col === 'Tags' && Array.isArray(t.tags)) t.tags = t.tags.filter(x => x !== tag);
        });
        saveTrades(); renderTable(); renderTagFilterPanel(); applyTagFilter();
      });
      row.appendChild(dot); row.appendChild(name); row.appendChild(del);
      panel.appendChild(row);
    });
  });
}

function applyTagFilter() {
  renderTable(); renderCalendar();
  const btn = document.getElementById('tag-filter-btn');
  btn.style.borderColor = state.tagFilter.length ? 'var(--blue)' : '';
  btn.style.color = state.tagFilter.length ? 'var(--blue)' : '';
}

function addColumn(colName) {
  if (!colName || !colName.trim()) { state.addTagColumnMode = false; return; }
  const name = colName.trim();
  if (PERMANENT_COLUMNS.map(x => x.toLowerCase()).includes(name.toLowerCase())) {
    state.addTagColumnMode = false;
    showToast('This is a permanent column', 'error');
    return;
  }
  if (state.columns.includes(name)) { state.addTagColumnMode = false; showToast('Column already exists', 'error'); return; }
  const asTagColumn = state.addTagColumnMode || isTagColumn(name);
  state.columns.push(name);
  if (!state.userColumns.includes(name)) state.userColumns.push(name);
  if (asTagColumn) {
    if (!state.tagColumns.includes(name)) state.tagColumns.push(name);
    state.trades.forEach(t => { if (!Array.isArray(t[name])) t[name] = []; });
    state.tableShowCols[name] = true;
    normalizeAllTagsFromTrades();
  } else {
    state.trades.forEach(t => { t[name] = ''; });
    state.tableShowCols[name] = true;
  }
  const defHead = !asTagColumn && isDefaultShowHeadCol(name);
  state.showHeadsConsolidated[name] = defHead;
  state.showHeadsIndividual[name] = defHead;
  saveShowHeads();
  state.addTagColumnMode = false;
  saveTrades(); render(); renderShowHeads();
  showToast(`Column "${name}" added!`, 'success');
}

function renameColumn(oldName, newName) {
  const from = String(oldName || '').trim();
  const to = String(newName || '').trim();
  if (!from || !to) return;
  if (from === to) return;
  if (!state.columns.includes(from)) { showToast('Column not found', 'error'); return; }
  if (state.columns.includes(to)) { showToast('Target column already exists', 'error'); return; }
  const wasTagColumn = isTagColumn(from);

  const idx = state.columns.indexOf(from);
  state.columns[idx] = to;
  if (wasTagColumn) {
    state.tagColumns = state.tagColumns.filter(c => c !== from);
    if (!state.tagColumns.includes(to)) state.tagColumns.push(to);
  }
  if (state.userColumns.includes(from)) {
    state.userColumns = state.userColumns.filter(c => c !== from);
    if (!state.userColumns.includes(to)) state.userColumns.push(to);
  }

  state.trades.forEach(t => {
    const oldVal = t[from];
    if (wasTagColumn) {
      t[to] = Array.isArray(oldVal) ? [...oldVal] : (oldVal ? [String(oldVal)] : []);
    } else {
      t[to] = Array.isArray(oldVal) ? oldVal.join(', ') : oldVal;
    }
    delete t[from];
    if (to === 'Tags') t.tags = Array.isArray(t[to]) ? [...t[to]] : [];
  });

  if (from in state.showHeadsConsolidated) { state.showHeadsConsolidated[to] = state.showHeadsConsolidated[from]; delete state.showHeadsConsolidated[from]; }
  if (from in state.showHeadsIndividual) { state.showHeadsIndividual[to] = state.showHeadsIndividual[from]; delete state.showHeadsIndividual[from]; }
  saveShowHeads();
  if (from in state.tableShowCols) {
    state.tableShowCols[to] = state.tableShowCols[from];
    delete state.tableShowCols[from];
  }
  if (from in state.filterValues) {
    state.filterValues[to] = state.filterValues[from];
    delete state.filterValues[from];
  }
  if (from in state.colWidths) {
    state.colWidths[to] = state.colWidths[from];
    delete state.colWidths[from];
  }
  if (state.tableSort.col === from) state.tableSort.col = to;

  saveTrades();
  render();
  renderShowHeads();
  renderColVisPanel();
  showToast(`Renamed "${from}" to "${to}"`, 'success');
}

function deleteColumn(colName) {
  const name = String(colName || '').trim();
  if (!name) return;
  if (!state.columns.includes(name)) { showToast('Column not found', 'error'); return; }
  if (!canDeleteColumn(name)) {
    showToast('System/import column cannot be deleted', 'error');
    return;
  }

  state.columns = state.columns.filter(c => c !== name);
  state.userColumns = state.userColumns.filter(c => c !== name);
  state.tagColumns = state.tagColumns.filter(c => c !== name);
  state.tagFilter = state.tagFilter.filter(k => parseTagFilterKey(k).col !== name);

  state.trades.forEach(t => {
    delete t[name];
    if (name === 'Tags') delete t.tags;
  });

  delete state.showHeadsConsolidated[name]; delete state.showHeadsIndividual[name]; saveShowHeads();
  delete state.tableShowCols[name];
  delete state.filterValues[name];
  delete state.colWidths[name];
  if (state.tableSort.col === name) state.tableSort.col = null;

  saveTrades();
  render();
  renderShowHeads();
  renderColVisPanel();
  renderTagFilterPanel();
  showToast(`Column "${name}" deleted`, 'success');
}

function openEditColumnModal(defaultCol = '') {
  const sel = document.getElementById('edit-col-select');
  const inp = document.getElementById('edit-col-name');
  const delBtn = document.getElementById('edit-col-delete');
  sel.innerHTML = '';

  if (!state.columns.length) {
    showToast('No editable columns yet', '');
    return;
  }

  state.columns.forEach(c => {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = c;
    if (defaultCol && c === defaultCol) o.selected = true;
    sel.appendChild(o);
  });

  const selected = defaultCol && state.columns.includes(defaultCol) ? defaultCol : state.columns[0];
  sel.value = selected;
  inp.value = selected;
  const canDelete = canDeleteColumn(selected);
  delBtn.disabled = !canDelete;
  delBtn.title = canDelete ? 'Delete this column' : 'System/import column cannot be deleted';
  document.getElementById('edit-col-modal').classList.add('open');
  setTimeout(() => inp.focus(), 20);
}

