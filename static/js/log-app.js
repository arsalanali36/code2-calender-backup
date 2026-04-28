/* log-app.js — Trade Log+ */

// ── State ────────────────────────────────────────────────────────────────────
const logState = {
  rows: [], schema: [], autoCols: [],
  visibleAuto:   ['seq', 'type', 'instrument', 'time', 'pt', 'rs'],
  visibleManual: [],
  colWidths:     {},
  filterActive:  false,
  filters:       {},
  saveTimer:     null,
};

const logSettings = {
  galleryMode:  'panel',   // 'newtab' | 'panel'
  showDayTotal: true,
  showDecimals: false,
};

function loadSettings() {
  try { Object.assign(logSettings, JSON.parse(localStorage.getItem('log_settings') || '{}')); } catch(e) {}
}
function saveSettings() {
  localStorage.setItem('log_settings', JSON.stringify(logSettings));
}
function initVisibleManual() {
  logState.visibleManual = logState.schema.map(c => c.key);
}

// ── DOM ───────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function shortInst(inst) {
  const m = String(inst).match(/(\d{4,6})(CE|PE)$/i);
  return m ? m[1] + m[2].toUpperCase() : inst;
}
function fmtNum(n, dec) {
  if (n === '' || n === null || n === undefined) return '';
  const v = Number(n);
  return isNaN(v) ? String(n) : (dec ? v.toFixed(2) : Math.round(v).toString());
}
function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'}); }
  catch(e){ return d; }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  logState.schema   = typeof LOG_SCHEMA    !== 'undefined' ? JSON.parse(JSON.stringify(LOG_SCHEMA))    : [];
  logState.autoCols = typeof LOG_AUTO_COLS !== 'undefined' ? JSON.parse(JSON.stringify(LOG_AUTO_COLS)) : [];
  loadSettings();
  initVisibleManual();
  setDefaultDates();
  bindAll();
  applySettingsUI();
  loadData();
});

function setDefaultDates() {
  const now = new Date();
  const y = now.getFullYear(), m = String(now.getMonth()+1).padStart(2,'0'), d = String(now.getDate()).padStart(2,'0');
  $('log-start-date').value = `${y}-${m}-01`;
  $('log-end-date').value   = `${y}-${m}-${d}`;
}

// ── Event binding ─────────────────────────────────────────────────────────────
function bindAll() {
  $('log-load-btn').addEventListener('click', loadData);
  $('log-cols-btn').addEventListener('click', () => showModal('log-cols-modal'));
  $('log-filter-btn').addEventListener('click', toggleFilters);

  // Schema dropdown
  $('log-schema-btn').addEventListener('click', e => { e.stopPropagation(); toggleMenu('log-schema-menu'); });
  $('log-schema-edit-btn').addEventListener('click',     () => { closeMenus(); showModal('log-schema-modal'); });
  $('log-schema-download-btn').addEventListener('click', () => { closeMenus(); downloadSchema(); });
  $('log-schema-upload').addEventListener('change',      uploadSchema);
  $('log-export-btn').addEventListener('click',          () => { closeMenus(); exportCsv(); });

  // Settings dropdown
  $('log-settings-btn').addEventListener('click', e => { e.stopPropagation(); toggleMenu('log-settings-menu'); });
  document.addEventListener('click', closeMenus);

  // Settings controls
  document.querySelectorAll('[data-gmode]').forEach(btn => {
    btn.addEventListener('click', () => {
      logSettings.galleryMode = btn.dataset.gmode;
      saveSettings(); applySettingsUI();
    });
  });
  $('log-set-daytotal').addEventListener('change', e => { logSettings.showDayTotal = e.target.checked; saveSettings(); renderTable(); });
  $('log-set-decimals').addEventListener('change', e => { logSettings.showDecimals = e.target.checked; saveSettings(); renderBody(); });

  // Modal close
  document.querySelectorAll('.log-modal-x').forEach(btn => btn.addEventListener('click', () => hideModal(btn.dataset.modal)));
  document.querySelectorAll('.log-modal').forEach(el => el.addEventListener('click', e => { if (e.target===el) hideModal(el.id); }));

  // Column picker
  $('log-cols-all').addEventListener('click',   () => document.querySelectorAll('.log-auto-cb,.log-manual-cb').forEach(cb => cb.checked=true));
  $('log-cols-none').addEventListener('click',  () => document.querySelectorAll('.log-auto-cb,.log-manual-cb').forEach(cb => cb.checked=false));
  $('log-cols-apply').addEventListener('click', applyColVis);

  // Schema editor
  $('log-se-add').addEventListener('click',  addSchemaRow);
  $('log-se-save').addEventListener('click', saveSchema);

  // Gallery panel
  $('log-gal-close').addEventListener('click', closeGallery);

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeMenus();
    const open = document.querySelector('.log-modal[style*="flex"]');
    if (open) hideModal(open.id);
    closeGallery();
  });
}

function toggleMenu(id) {
  const el = $(id), wasOpen = el.style.display === 'block';
  closeMenus(); if (!wasOpen) el.style.display = 'block';
}
function closeMenus() {
  ['log-schema-menu','log-settings-menu'].forEach(id => { const el=$(id); if(el) el.style.display='none'; });
}

function applySettingsUI() {
  document.querySelectorAll('[data-gmode]').forEach(btn =>
    btn.classList.toggle('log-set-on', btn.dataset.gmode === logSettings.galleryMode)
  );
  $('log-set-daytotal').checked = logSettings.showDayTotal;
  $('log-set-decimals').checked = logSettings.showDecimals;
}

// ── Load data ─────────────────────────────────────────────────────────────────
async function loadData() {
  const s = $('log-start-date').value, e = $('log-end-date').value;
  showStatus('Loading…','info');
  try {
    const res  = await fetch(`/api/log/data?start=${s}&end=${e}`);
    const json = await res.json();
    logState.rows = json.rows || [];
    renderTable();
    const n = logState.rows.length;
    $('log-row-count').textContent = n ? `${n} trades` : '';
    showStatus(n ? `Loaded ${n}` : 'No trades', n ? 'ok' : 'info');
    setTimeout(() => showStatus('',''), 2500);
  } catch(err) { showStatus('Load error','error'); }
}

// ── Table render ──────────────────────────────────────────────────────────────
function renderTable() {
  const table = $('log-table'), empty = $('log-empty');
  if (!logState.rows.length) {
    table.style.display = 'none'; empty.style.display = 'flex';
    empty.innerHTML = 'No trades found for this date range'; return;
  }
  table.style.display = 'table'; empty.style.display = 'none';
  renderHeader(); renderBody();
}

function visCols() {
  return {
    auto:   logState.autoCols.filter(c => logState.visibleAuto.includes(c.key)),
    manual: logState.schema.filter(c => logState.visibleManual.includes(c.key)),
  };
}

function thStyle(key, defW) {
  const w = logState.colWidths[key];
  return w ? `style="width:${w}px"` : `style="min-width:${defW}px"`;
}

// ── Header ────────────────────────────────────────────────────────────────────
function renderHeader() {
  const { auto, manual } = visCols();
  let th = '', fh = '';

  th += `<th class="log-th-date" ${thStyle('date',110)} data-col="date">
    <div class="log-th-in">Date<span class="log-rh" data-col="date"></span></div></th>`;
  fh += '<th><input class="log-fi" data-col="date" placeholder="date…"></th>';

  auto.forEach(c => {
    const defW = {seq:45,type:38,instrument:90,tradetype:55,time:52,qty:45,pt:50,rs:60}[c.key] || 70;
    th += `<th class="log-th-auto" ${thStyle(c.key,defW)} data-col="${c.key}" draggable="true">
      <div class="log-th-in">${esc(c.label)}<span class="log-rh" data-col="${c.key}"></span></div></th>`;
    fh += `<th><input class="log-fi" data-col="${c.key}" placeholder="…"></th>`;
  });

  th += `<th class="log-th-img" style="min-width:32px">📷</th>`;
  fh += '<th></th>';

  manual.forEach(c => {
    th += `<th class="log-th-man" ${thStyle(c.key,80)} data-col="${c.key}" draggable="true">
      <div class="log-th-in">${esc(c.label)}<span class="log-rh" data-col="${c.key}"></span></div></th>`;
    fh += `<th><input class="log-fi" data-col="${c.key}" placeholder="…"></th>`;
  });

  $('log-thead-row').innerHTML = th;
  $('log-filter-row').innerHTML = fh;

  $('log-filter-row').querySelectorAll('.log-fi').forEach(inp => {
    inp.value = logState.filters[inp.dataset.col] || '';
    inp.addEventListener('input', () => {
      const v = inp.value.trim().toLowerCase();
      if (v) logState.filters[inp.dataset.col] = v; else delete logState.filters[inp.dataset.col];
      renderBody();
    });
  });
  if (logState.filterActive) $('log-filter-row').style.display = '';
  bindResizeHandles();
  bindColDrag();
}

// ── Body ──────────────────────────────────────────────────────────────────────
function renderBody() {
  const { auto, manual } = visCols();
  const rows = filteredRows();
  const dec  = logSettings.showDecimals;
  let html = '', lastDate = '', datePt = 0, dateRs = 0;

  function totalRow(date) {
    if (!logSettings.showDayTotal || !date) return '';
    let cells = `<td class="log-td-tot-date"><span class="log-tot-day">${esc(fmtDate(date))}</span></td>`;
    auto.forEach(c => {
      if (c.key === 'seq')  cells += `<td class="log-td-tot log-tot-lbl">Day Total</td>`;
      else if (c.key === 'pt') cells += `<td class="log-td-tot"><span class="${datePt>=0?'log-pos':'log-neg'}">${fmtNum(datePt,dec)}</span></td>`;
      else if (c.key === 'rs') cells += `<td class="log-td-tot"><span class="${dateRs>=0?'log-pos':'log-neg'}">${fmtNum(dateRs,dec)}</span></td>`;
      else cells += '<td class="log-td-tot"></td>';
    });
    cells += '<td class="log-td-tot"></td>';
    manual.forEach(() => { cells += '<td class="log-td-tot"></td>'; });
    return `<tr class="log-row-tot">${cells}</tr>`;
  }

  for (let i = 0; i < rows.length; i++) {
    const row   = rows[i];
    const isNew = row.date !== lastDate;
    if (isNew && lastDate) { html += totalRow(lastDate); datePt = 0; dateRs = 0; }
    lastDate = row.date;
    datePt  += Number(row.pt) || 0;
    dateRs  += Number(row.rs) || 0;

    html += `<tr class="log-row${isNew?' log-row-sep':''}" data-date="${esc(row.date)}" data-seq="${esc(row.seq)}">`;
    html += `<td class="log-td-date">${isNew ? esc(fmtDate(row.date)) : ''}</td>`;

    auto.forEach(c => {
      const val = row[c.key] !== undefined ? row[c.key] : '';
      let cell  = '';
      if (c.key === 'type') {
        const cls = val==='L'?'log-type-l':val==='S'?'log-type-s':'log-type-d';
        cell = `<span class="${cls}">${esc(val)}</span>`;
      } else if (c.key === 'instrument') {
        const isCE = String(val).toUpperCase().endsWith('CE');
        cell = `<span class="${isCE?'log-ce':'log-pe'}">${esc(shortInst(val))}</span>`;
      } else if (c.key === 'rs' || c.key === 'pt') {
        const cls = Number(val)>=0?'log-pos':'log-neg';
        cell = `<span class="${cls}">${fmtNum(val,dec)}</span>`;
      } else { cell = esc(val); }
      html += `<td class="log-td-auto">${cell}</td>`;
    });

    html += `<td class="log-td-img"><span class="log-gal-btn" data-date="${esc(row.date)}" title="Images: ${esc(fmtDate(row.date))}">📷</span></td>`;

    manual.forEach(col => {
      const val = row.annotations[col.key] !== undefined ? row.annotations[col.key] : '';
      html += `<td class="log-td-man">`;
      if (col.type === 'dropdown') {
        html += `<select class="log-cell-select" data-field="${esc(col.key)}" data-date="${esc(row.date)}" data-seq="${esc(row.seq)}">`;
        html += `<option value="">—</option>`;
        (col.options||[]).forEach(o => { html += `<option value="${esc(o)}" ${val===o?'selected':''}>${esc(o)}</option>`; });
        html += `</select>`;
      } else if (col.type === 'switch') {
        html += `<input type="checkbox" class="log-cell-cb" data-field="${esc(col.key)}" data-date="${esc(row.date)}" data-seq="${esc(row.seq)}" ${val==='Y'?'checked':''}>`;
      } else {
        html += `<input type="text" class="log-cell-input" value="${esc(val)}" data-field="${esc(col.key)}" data-date="${esc(row.date)}" data-seq="${esc(row.seq)}" placeholder="—">`;
      }
      html += `</td>`;
    });
    html += `</tr>`;
  }
  if (lastDate) html += totalRow(lastDate);

  $('log-tbody').innerHTML = html;
  $('log-tbody').querySelectorAll('.log-cell-select').forEach(el => el.addEventListener('change', onCell));
  $('log-tbody').querySelectorAll('.log-cell-input').forEach(el  => el.addEventListener('change', onCell));
  $('log-tbody').querySelectorAll('.log-cell-cb').forEach(el     => el.addEventListener('change', onCb));
  $('log-tbody').querySelectorAll('.log-gal-btn').forEach(el     => el.addEventListener('click',  () => openGallery(el.dataset.date)));
}

function filteredRows() {
  const keys = Object.keys(logState.filters);
  if (!keys.length) return logState.rows;
  return logState.rows.filter(row =>
    keys.every(col => {
      const fv = logState.filters[col]; if (!fv) return true;
      const cv = col==='date' ? row.date : row[col]!==undefined ? String(row[col]) : (row.annotations[col]||'');
      return cv.toLowerCase().includes(fv);
    })
  );
}

// ── Cell save ─────────────────────────────────────────────────────────────────
function onCell(e) { const el=e.target; qSave(el.dataset.date,el.dataset.seq,el.dataset.field,el.value); }
function onCb(e)   { const el=e.target; qSave(el.dataset.date,el.dataset.seq,el.dataset.field,el.checked?'Y':'N'); }

function qSave(date, seq, field, value) {
  const row = logState.rows.find(r => r.date===date && r.seq===seq);
  if (row) row.annotations[field] = value;
  clearTimeout(logState.saveTimer);
  showStatus('Saving…','info');
  logState.saveTimer = setTimeout(async () => {
    try {
      await fetch('/api/log/annotate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date,seq,field,value})});
      showStatus('Saved ✓','ok'); setTimeout(()=>showStatus('',''),2000);
    } catch(e) { showStatus('Save error ✗','error'); }
  }, 700);
}

// ── Filters ───────────────────────────────────────────────────────────────────
function toggleFilters() {
  logState.filterActive = !logState.filterActive;
  $('log-filter-row').style.display = logState.filterActive ? '' : 'none';
  $('log-filter-btn').classList.toggle('log-btn-active', logState.filterActive);
}

// ── Gallery panel ─────────────────────────────────────────────────────────────
function openGallery(date) {
  if (logSettings.galleryMode === 'newtab') { window.open('/', '_blank'); return; }
  $('log-gal-title').textContent = fmtDate(date);
  $('log-gal-imgs').innerHTML = '<div class="log-gal-msg">Loading…</div>';
  $('log-gal-panel').classList.add('log-gal-open');
  fetch(`/api/log/gallery?date=${date}`)
    .then(r => r.json())
    .then(data => {
      const imgs = data.images || [];
      if (!imgs.length) { $('log-gal-imgs').innerHTML = '<div class="log-gal-msg">No images</div>'; return; }
      $('log-gal-imgs').innerHTML = imgs.map(src =>
        `<div class="log-gal-thumb"><img src="${esc(src)}" loading="lazy" onclick="window.open('${esc(src)}','_blank')"></div>`
      ).join('');
    })
    .catch(() => { $('log-gal-imgs').innerHTML = '<div class="log-gal-msg">Error</div>'; });
}
function closeGallery() { $('log-gal-panel').classList.remove('log-gal-open'); }

// ── Column resize ─────────────────────────────────────────────────────────────
function bindResizeHandles() {
  $('log-thead-row').querySelectorAll('.log-rh').forEach(h => {
    h.addEventListener('mousedown', e => {
      e.stopPropagation(); e.preventDefault();
      const col = h.dataset.col, th = h.closest('th');
      const x0 = e.clientX, w0 = th.offsetWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      const move = ev => { const nw = Math.max(40, w0+(ev.clientX-x0)); logState.colWidths[col]=nw; th.style.width=nw+'px'; };
      const up   = ()  => { document.removeEventListener('mousemove',move); document.removeEventListener('mouseup',up); document.body.style.cursor=''; document.body.style.userSelect=''; };
      document.addEventListener('mousemove',move);
      document.addEventListener('mouseup',up);
    });
  });
}

// ── Column reorder ────────────────────────────────────────────────────────────
let _dragCol=null, _dragAuto=false;
function bindColDrag() {
  $('log-thead-row').querySelectorAll('th[draggable]').forEach(th => {
    th.addEventListener('dragstart', function(e) {
      _dragCol=this.dataset.col; _dragAuto=logState.visibleAuto.includes(_dragCol);
      this.classList.add('log-th-drag'); e.dataTransfer.effectAllowed='move';
    });
    th.addEventListener('dragover', e => { e.preventDefault(); th.classList.add('log-th-over'); });
    th.addEventListener('dragleave', () => th.classList.remove('log-th-over'));
    th.addEventListener('drop', e => {
      e.preventDefault(); th.classList.remove('log-th-over');
      const tgt = th.dataset.col, tgtAuto = logState.visibleAuto.includes(tgt);
      if (!_dragCol || _dragCol===tgt) return;
      if (_dragAuto && tgtAuto) reorder(logState.visibleAuto, _dragCol, tgt);
      else if (!_dragAuto && !tgtAuto) reorder(logState.visibleManual, _dragCol, tgt);
      renderTable();
    });
    th.addEventListener('dragend', () => {
      $('log-thead-row').querySelectorAll('th').forEach(t => t.classList.remove('log-th-drag','log-th-over'));
      _dragCol=null;
    });
  });
}
function reorder(arr, from, to) {
  const fi=arr.indexOf(from), ti=arr.indexOf(to);
  if (fi<0||ti<0) return; arr.splice(fi,1); arr.splice(ti,0,from);
}

// ── Modals ────────────────────────────────────────────────────────────────────
function showModal(id) {
  if (id==='log-cols-modal')   renderColPicker();
  if (id==='log-schema-modal') renderSchemaEditor();
  $(id).style.display='flex';
}
function hideModal(id) { $(id).style.display='none'; }

// ── Column picker ─────────────────────────────────────────────────────────────
function renderColPicker() {
  $('log-auto-checks').innerHTML = logState.autoCols.map(c =>
    `<label class="log-check-label"><input type="checkbox" class="log-auto-cb" value="${esc(c.key)}" ${logState.visibleAuto.includes(c.key)?'checked':''}> ${esc(c.label)}</label>`
  ).join('');
  $('log-manual-checks').innerHTML = logState.schema.map(c =>
    `<label class="log-check-label"><input type="checkbox" class="log-manual-cb" value="${esc(c.key)}" ${logState.visibleManual.includes(c.key)?'checked':''}> ${esc(c.label)}</label>`
  ).join('');
}
function applyColVis() {
  logState.visibleAuto   = [...document.querySelectorAll('.log-auto-cb:checked')].map(cb => cb.value);
  logState.visibleManual = [...document.querySelectorAll('.log-manual-cb:checked')].map(cb => cb.value);
  hideModal('log-cols-modal'); renderTable();
}

// ── Schema editor ─────────────────────────────────────────────────────────────
function renderSchemaEditor() {
  $('log-se-tbody').innerHTML = logState.schema.map((c,i) => `
    <tr>
      <td><input class="log-se-input" data-i="${i}" data-f="key"     value="${esc(c.key)}"></td>
      <td><input class="log-se-input" data-i="${i}" data-f="label"   value="${esc(c.label)}"></td>
      <td><select class="log-se-select" data-i="${i}" data-f="type">
        ${['text','dropdown','switch','number'].map(t=>`<option ${c.type===t?'selected':''}>${t}</option>`).join('')}
      </select></td>
      <td><input class="log-se-input" data-i="${i}" data-f="options" value="${esc((c.options||[]).join('|'))}"></td>
      <td><input class="log-se-input" data-i="${i}" data-f="group"   value="${esc(c.group||'')}"></td>
      <td><button class="log-btn-del" data-i="${i}">✕</button></td>
    </tr>`).join('');
  $('log-se-tbody').querySelectorAll('.log-btn-del').forEach(btn =>
    btn.addEventListener('click', () => { logState.schema.splice(Number(btn.dataset.i),1); renderSchemaEditor(); })
  );
}
function addSchemaRow() { logState.schema.push({key:'',label:'',type:'text',options:[],group:''}); renderSchemaEditor(); }

async function saveSchema() {
  const schema = logState.schema.map((_,i) => ({
    key:     (document.querySelector(`[data-i="${i}"][data-f="key"]`)?.value||'').trim(),
    label:   (document.querySelector(`[data-i="${i}"][data-f="label"]`)?.value||'').trim(),
    type:    document.querySelector(`[data-i="${i}"][data-f="type"]`)?.value||'text',
    options: (document.querySelector(`[data-i="${i}"][data-f="options"]`)?.value||'').split('|').map(s=>s.trim()).filter(Boolean),
    group:   (document.querySelector(`[data-i="${i}"][data-f="group"]`)?.value||'').trim(),
  })).filter(c=>c.key);
  try {
    const res = await fetch('/api/log/schema',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(schema)});
    if (!res.ok) throw new Error();
    logState.schema=schema; initVisibleManual(); hideModal('log-schema-modal'); renderTable();
    showStatus('Schema saved ✓','ok'); setTimeout(()=>showStatus('',''),2000);
  } catch(e) { showStatus('Schema save error','error'); }
}
function downloadSchema() { window.location.href='/api/log/schema/download'; }
async function uploadSchema() {
  const file=this.files[0]; if(!file) return;
  const fd=new FormData(); fd.append('file',file);
  try {
    const res=await fetch('/api/log/schema/upload',{method:'POST',body:fd});
    const data=await res.json();
    if (data.ok) { logState.schema=data.schema; initVisibleManual(); renderTable(); showStatus('Schema uploaded ✓','ok'); }
    else showStatus('Upload failed','error');
  } catch(e) { showStatus('Upload error','error'); }
  this.value='';
}
function exportCsv() {
  const s=$('log-start-date').value, e=$('log-end-date').value;
  window.location.href=`/api/log/export?start=${s}&end=${e}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showStatus(msg,type) {
  const el=$('log-save-status');
  el.textContent=msg; el.className=`log-save-status ${type?'log-status-'+type:''}`;
}
