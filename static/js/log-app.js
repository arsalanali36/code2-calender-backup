/* log-app.js — Trade Log+ page logic */

// ── State ─────────────────────────────────────────────────────────────────────
const logState = {
  rows:          [],
  schema:        typeof LOG_SCHEMA    !== 'undefined' ? LOG_SCHEMA    : [],
  autoCols:      typeof LOG_AUTO_COLS !== 'undefined' ? LOG_AUTO_COLS : [],
  visibleAuto:   ['seq', 'type', 'instrument', 'time', 'pt', 'rs'],
  visibleManual: [],
  filterActive:  false,
  filters:       {},
  saveTimer:     null,
};

function initVisibleManual() {
  logState.visibleManual = logState.schema.map(c => c.key);
}

// ── DOM helpers ───────────────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const esc = s  => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initVisibleManual();
  setDefaultDates();
  bindHeaderEvents();
  loadData();
});

function setDefaultDates() {
  const now  = new Date();
  const y    = now.getFullYear();
  const m    = String(now.getMonth() + 1).padStart(2, '0');
  const d    = String(now.getDate()).padStart(2, '0');
  $('log-start-date').value = `${y}-${m}-01`;
  $('log-end-date').value   = `${y}-${m}-${d}`;
}

function bindHeaderEvents() {
  $('log-load-btn').addEventListener('click', loadData);

  $('log-cols-btn').addEventListener('click', () => showModal('log-cols-modal'));
  $('log-filter-btn').addEventListener('click', toggleFilters);

  $('log-schema-btn').addEventListener('click', e => {
    e.stopPropagation();
    const menu = $('log-schema-menu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  });
  document.addEventListener('click', () => {
    $('log-schema-menu').style.display = 'none';
  });

  $('log-schema-edit-btn').addEventListener('click',     () => { hideSchemaMenu(); showModal('log-schema-modal'); });
  $('log-schema-download-btn').addEventListener('click', () => { hideSchemaMenu(); downloadSchema(); });
  $('log-schema-upload').addEventListener('change',      uploadSchema);
  $('log-export-btn').addEventListener('click',          () => { hideSchemaMenu(); exportCsv(); });

  // Modal close buttons
  document.querySelectorAll('.log-modal-x').forEach(btn => {
    btn.addEventListener('click', () => hideModal(btn.dataset.modal));
  });
  document.querySelectorAll('.log-modal').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) hideModal(el.id); });
  });

  // Column picker
  $('log-cols-all').addEventListener('click',   () => {
    document.querySelectorAll('#log-auto-checks input, #log-manual-checks input').forEach(cb => cb.checked = true);
  });
  $('log-cols-none').addEventListener('click',  () => {
    document.querySelectorAll('#log-auto-checks input, #log-manual-checks input').forEach(cb => cb.checked = false);
  });
  $('log-cols-apply').addEventListener('click', applyColVisibility);

  // Schema editor
  $('log-se-add').addEventListener('click',  addSchemaRow);
  $('log-se-save').addEventListener('click', saveSchema);

  // Keyboard: Escape closes topmost modal
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = document.querySelector('.log-modal[style*="flex"]');
    if (open) hideModal(open.id);
  });
}

function hideSchemaMenu() {
  $('log-schema-menu').style.display = 'none';
}

// ── Load data ─────────────────────────────────────────────────────────────────
async function loadData() {
  const start = $('log-start-date').value;
  const end   = $('log-end-date').value;
  showStatus('Loading…', 'info');
  try {
    const res  = await fetch(`/api/log/data?start=${start}&end=${end}`);
    const json = await res.json();
    logState.rows = json.rows || [];
    renderTable();
    const n = logState.rows.length;
    $('log-row-count').textContent = n ? `${n} trades` : '';
    showStatus(n ? `${n} loaded` : 'No trades', n ? 'ok' : 'info');
    setTimeout(() => showStatus('', ''), 2500);
  } catch (e) {
    showStatus('Load error', 'error');
  }
}

// ── Table render ──────────────────────────────────────────────────────────────
function renderTable() {
  const table = $('log-table');
  const empty = $('log-empty');
  if (!logState.rows.length) {
    table.style.display = 'none';
    empty.style.display = 'flex';
    empty.innerHTML = 'No trades found for this date range';
    return;
  }
  table.style.display = 'table';
  empty.style.display = 'none';
  renderHeader();
  renderBody();
}

function getVisibleCols() {
  const auto   = logState.autoCols.filter(c => logState.visibleAuto.includes(c.key));
  const manual = logState.schema.filter(c => logState.visibleManual.includes(c.key));
  return { auto, manual };
}

function renderHeader() {
  const { auto, manual } = getVisibleCols();
  const thead     = $('log-thead-row');
  const filterRow = $('log-filter-row');
  let th = '', fh = '';

  // Date column (always visible, sticky)
  th += '<th class="log-th-date">Date</th>';
  fh += '<th><input class="log-filter-input" data-col="date" placeholder="filter…"></th>';

  auto.forEach(c => {
    th += `<th class="log-th-auto" data-col="${c.key}">${esc(c.label)}</th>`;
    fh += `<th><input class="log-filter-input" data-col="${c.key}" placeholder="…"></th>`;
  });

  // Gallery icon column
  th += '<th class="log-th-img">📷</th>';
  fh += '<th></th>';

  manual.forEach(c => {
    th += `<th class="log-th-man" data-col="${c.key}">${esc(c.label)}</th>`;
    fh += `<th><input class="log-filter-input" data-col="${c.key}" placeholder="…"></th>`;
  });

  thead.innerHTML     = th;
  filterRow.innerHTML = fh;

  filterRow.querySelectorAll('.log-filter-input').forEach(inp => {
    inp.value = logState.filters[inp.dataset.col] || '';
    inp.addEventListener('input', () => {
      const v = inp.value.trim().toLowerCase();
      if (v) logState.filters[inp.dataset.col] = v;
      else   delete logState.filters[inp.dataset.col];
      renderBody();
    });
  });

  if (logState.filterActive) filterRow.style.display = '';
}

function renderBody() {
  const { auto, manual } = getVisibleCols();
  const rows   = filteredRows();
  const tbody  = $('log-tbody');
  let html = '';
  let lastDate = '';

  rows.forEach(row => {
    const isNew = row.date !== lastDate;
    lastDate = row.date;
    const rowCls = isNew ? 'log-row log-row-sep' : 'log-row';

    html += `<tr class="${rowCls}" data-date="${esc(row.date)}" data-seq="${esc(row.seq)}">`;

    // Date cell (only label on first row of date group)
    const dateLabel = isNew ? fmtDate(row.date) : '';
    html += `<td class="log-td-date" title="${esc(row.date)}">${esc(dateLabel)}</td>`;

    // Auto cols
    auto.forEach(c => {
      const val = row[c.key] !== undefined ? row[c.key] : '';
      let cls = 'log-td-auto';
      let display = esc(val);
      if (c.key === 'type') {
        const tc = val === 'L' ? 'log-type-l' : val === 'S' ? 'log-type-s' : 'log-type-d';
        display = `<span class="${tc}">${esc(val)}</span>`;
      } else if (c.key === 'rs' || c.key === 'pt') {
        const pc = Number(val) >= 0 ? 'log-pos' : 'log-neg';
        display = `<span class="${pc}">${esc(val)}</span>`;
      }
      html += `<td class="${cls}">${display}</td>`;
    });

    // Gallery icon
    html += `<td class="log-td-img">` +
      `<a class="log-gallery-link" href="/" target="_blank" title="Open gallery for ${esc(row.date)}">📷</a>` +
      `</td>`;

    // Manual / annotation cols
    manual.forEach(col => {
      const val = row.annotations[col.key] !== undefined ? row.annotations[col.key] : '';
      html += `<td class="log-td-man">`;
      if (col.type === 'dropdown') {
        html += `<select class="log-cell-select" data-field="${esc(col.key)}" data-date="${esc(row.date)}" data-seq="${esc(row.seq)}">`;
        html += `<option value="">—</option>`;
        (col.options || []).forEach(opt => {
          html += `<option value="${esc(opt)}" ${val === opt ? 'selected' : ''}>${esc(opt)}</option>`;
        });
        html += `</select>`;
      } else if (col.type === 'switch') {
        html += `<input type="checkbox" class="log-cell-cb"` +
          ` data-field="${esc(col.key)}" data-date="${esc(row.date)}" data-seq="${esc(row.seq)}"` +
          ` ${val === 'Y' ? 'checked' : ''}>`;
      } else {
        html += `<input type="text" class="log-cell-input" value="${esc(val)}"` +
          ` data-field="${esc(col.key)}" data-date="${esc(row.date)}" data-seq="${esc(row.seq)}"` +
          ` placeholder="—">`;
      }
      html += `</td>`;
    });

    html += `</tr>`;
  });

  tbody.innerHTML = html;

  // Bind cell events
  tbody.querySelectorAll('.log-cell-select').forEach(el => el.addEventListener('change', onCellChange));
  tbody.querySelectorAll('.log-cell-input').forEach(el  => el.addEventListener('change',  onCellChange));
  tbody.querySelectorAll('.log-cell-cb').forEach(el     => el.addEventListener('change',  onCbChange));
}

function filteredRows() {
  const keys = Object.keys(logState.filters);
  if (!keys.length) return logState.rows;
  return logState.rows.filter(row => {
    return keys.every(col => {
      const fv = logState.filters[col];
      if (!fv) return true;
      let cv = '';
      if (col === 'date') cv = row.date;
      else if (row[col] !== undefined) cv = String(row[col]);
      else cv = row.annotations[col] || '';
      return cv.toLowerCase().includes(fv);
    });
  });
}

// ── Cell save ─────────────────────────────────────────────────────────────────
function onCellChange(e) {
  const el = e.target;
  scheduleAnnotationSave(el.dataset.date, el.dataset.seq, el.dataset.field, el.value);
}
function onCbChange(e) {
  const el = e.target;
  scheduleAnnotationSave(el.dataset.date, el.dataset.seq, el.dataset.field, el.checked ? 'Y' : 'N');
}

function scheduleAnnotationSave(date, seq, field, value) {
  // Update in-memory immediately so filter/re-render is consistent
  const row = logState.rows.find(r => r.date === date && r.seq === seq);
  if (row) row.annotations[field] = value;

  clearTimeout(logState.saveTimer);
  showStatus('Saving…', 'info');
  logState.saveTimer = setTimeout(() => doSave(date, seq, field, value), 700);
}

async function doSave(date, seq, field, value) {
  try {
    await fetch('/api/log/annotate', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({date, seq, field, value}),
    });
    showStatus('Saved ✓', 'ok');
    setTimeout(() => showStatus('', ''), 2000);
  } catch (e) {
    showStatus('Save error ✗', 'error');
  }
}

// ── Filters ───────────────────────────────────────────────────────────────────
function toggleFilters() {
  logState.filterActive = !logState.filterActive;
  $('log-filter-row').style.display = logState.filterActive ? '' : 'none';
  $('log-filter-btn').classList.toggle('log-btn-active', logState.filterActive);
}

// ── Column visibility ─────────────────────────────────────────────────────────
function showModal(id) {
  if (id === 'log-cols-modal')   renderColPicker();
  if (id === 'log-schema-modal') renderSchemaEditor();
  $(id).style.display = 'flex';
}
function hideModal(id) {
  $(id).style.display = 'none';
}

function renderColPicker() {
  $('log-auto-checks').innerHTML = logState.autoCols.map(c =>
    `<label class="log-check-label">
      <input type="checkbox" class="log-auto-cb" value="${esc(c.key)}" ${logState.visibleAuto.includes(c.key) ? 'checked' : ''}>
      ${esc(c.label)}
    </label>`
  ).join('');

  $('log-manual-checks').innerHTML = logState.schema.map(c =>
    `<label class="log-check-label">
      <input type="checkbox" class="log-manual-cb" value="${esc(c.key)}" ${logState.visibleManual.includes(c.key) ? 'checked' : ''}>
      ${esc(c.label)}
    </label>`
  ).join('');
}

function applyColVisibility() {
  logState.visibleAuto   = [...document.querySelectorAll('.log-auto-cb:checked')].map(cb => cb.value);
  logState.visibleManual = [...document.querySelectorAll('.log-manual-cb:checked')].map(cb => cb.value);
  hideModal('log-cols-modal');
  renderTable();
}

// ── Schema editor ─────────────────────────────────────────────────────────────
function renderSchemaEditor() {
  $('log-se-tbody').innerHTML = logState.schema.map((c, i) => `
    <tr>
      <td><input class="log-se-input" data-i="${i}" data-f="key"   value="${esc(c.key)}"></td>
      <td><input class="log-se-input" data-i="${i}" data-f="label" value="${esc(c.label)}"></td>
      <td>
        <select class="log-se-select" data-i="${i}" data-f="type">
          ${['text','dropdown','switch','number'].map(t =>
            `<option ${c.type === t ? 'selected' : ''}>${t}</option>`
          ).join('')}
        </select>
      </td>
      <td><input class="log-se-input" data-i="${i}" data-f="options" value="${esc((c.options||[]).join('|'))}"></td>
      <td><input class="log-se-input" data-i="${i}" data-f="group"   value="${esc(c.group||'')}"></td>
      <td><button class="log-btn-del" data-i="${i}">✕</button></td>
    </tr>`
  ).join('');

  $('log-se-tbody').querySelectorAll('.log-btn-del').forEach(btn => {
    btn.addEventListener('click', () => {
      logState.schema.splice(Number(btn.dataset.i), 1);
      renderSchemaEditor();
    });
  });
}

function addSchemaRow() {
  logState.schema.push({key: '', label: '', type: 'text', options: [], group: ''});
  renderSchemaEditor();
}

function collectSchemaFromEditor() {
  const schema = logState.schema.map((_, i) => ({
    key:     document.querySelector(`[data-i="${i}"][data-f="key"]`)?.value.trim()   || '',
    label:   document.querySelector(`[data-i="${i}"][data-f="label"]`)?.value.trim() || '',
    type:    document.querySelector(`[data-i="${i}"][data-f="type"]`)?.value         || 'text',
    options: (document.querySelector(`[data-i="${i}"][data-f="options"]`)?.value || '')
               .split('|').map(s => s.trim()).filter(Boolean),
    group:   document.querySelector(`[data-i="${i}"][data-f="group"]`)?.value.trim() || '',
  }));
  return schema.filter(c => c.key);
}

async function saveSchema() {
  const schema = collectSchemaFromEditor();
  try {
    const res = await fetch('/api/log/schema', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(schema),
    });
    if (!res.ok) throw new Error();
    logState.schema = schema;
    initVisibleManual();
    hideModal('log-schema-modal');
    renderTable();
    showStatus('Schema saved ✓', 'ok');
    setTimeout(() => showStatus('', ''), 2000);
  } catch (e) {
    showStatus('Schema save error', 'error');
  }
}

// ── Schema upload / download ──────────────────────────────────────────────────
function downloadSchema() {
  window.location.href = '/api/log/schema/download';
}

async function uploadSchema() {
  const file = this.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  try {
    const res  = await fetch('/api/log/schema/upload', {method: 'POST', body: fd});
    const data = await res.json();
    if (data.ok) {
      logState.schema = data.schema;
      initVisibleManual();
      renderTable();
      showStatus('Schema uploaded ✓', 'ok');
    } else {
      showStatus('Upload failed', 'error');
    }
  } catch (e) {
    showStatus('Upload error', 'error');
  }
  this.value = '';
}

// ── Export ────────────────────────────────────────────────────────────────────
function exportCsv() {
  const start = $('log-start-date').value;
  const end   = $('log-end-date').value;
  window.location.href = `/api/log/export?start=${start}&end=${end}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '';
  try {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-IN', {weekday:'short', day:'numeric', month:'short'});
  } catch (e) { return d; }
}

function showStatus(msg, type) {
  const el = $('log-save-status');
  el.textContent  = msg;
  el.className    = `log-save-status ${type ? 'log-status-' + type : ''}`;
}
