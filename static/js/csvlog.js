/**
 * @fileoverview csvlog.js
 * @description CSVLog modal — dynamic trade-checklist form driven by LOGGER.xlsx schema.
 *   - One tab per trade in the selected day (Trade 1, Trade 2, ...)
 *   - Within each trade: group tabs (Zone / Entry / Exit / PSy)
 *   - Fields: Switch (Y/N toggle), Input (text), Dropdown (select), Range (slider), - (section label)
 *   - Data saved to trade.csvlog = { zone:{...}, entry:{...}, exit:{...}, psy:{...} }
 *   - Schema uploaded via LOGGER.xlsx (any path on user's machine)
 * @exports openCsvLogModal, closeCsvLogModal
 */

/* ── Module state ─────────────────────────────────────────────────────────── */
let _clBackdrop   = null;
let _clTab        = 0;          // active trade tab index
let _clGroupTab   = {};         // { tradeIdx: activeGroupTabName }
let _clDayTrades  = [];         // [{ trade, rowIdx }]
let _clSchema     = null;       // cached schema from server
let _clImgIdx     = {};         // { tradeIdx: currentImageIndex }
let _clTagDelMode = false;
let _clTagChipSize = 0.78;
let _clColSplit   = 44;         // % width of form column
let _clDaySortField = null;     // 'pnl' | 'pts' | null — Day tab sort state
let _clAllSortField = null;     // 'pnl' | 'pts' | null — All tab sort state

/* ── Public: open ─────────────────────────────────────────────────────────── */
async function openCsvLogModal() {
  // Collect trades for the current visible date (same logic as trade-logger)
  const filtered = getFilteredTrades ? getFilteredTrades() : state.trades;
  if (!filtered.length) { showToast('No trades to log', 'error'); return; }

  // Pick the most-recent date visible
  const sorted = [...filtered].sort((a, b) => {
    const da = normalizeDate(a['trade_date'] || a['Date'] || a.date || '');
    const db = normalizeDate(b['trade_date'] || b['Date'] || b.date || '');
    return da < db ? 1 : da > db ? -1 : 0;
  });

  const lastTrade = sorted[0];
  const dateKey   = normalizeDate(lastTrade['trade_date'] || lastTrade['Date'] || lastTrade.date || '');

  _clDayTrades = state.trades
    .map((t, i) => ({ trade: t, rowIdx: i }))
    .filter(({ trade: t }) => {
      return normalizeDate(t['trade_date'] || t['Date'] || t.date || '') === dateKey;
    });

  if (!_clDayTrades.length) { showToast('No trades for this date', 'error'); return; }

  _clTab = -1;
  _clGroupTab = {};

  // Fetch schema (use cache if already loaded)
  if (!_clSchema) {
    const s = await csvlogService.getSchema();
    if (!s || s.error) {
      // No schema yet — show upload prompt
      _openWithNoSchema();
      return;
    }
    _clSchema = s;
  }

  _buildAndOpen(dateKey);
}

/* ── Open when no schema is uploaded yet ─────────────────────────────────── */
function _openWithNoSchema() {
  _clBackdrop = document.createElement('div');
  _clBackdrop.className = 'cl-backdrop';

  const panel = document.createElement('div');
  panel.className = 'cl-panel';
  panel.innerHTML = `
    <div class="cl-header">
      <span class="cl-title">&#128203; CSVLog</span>
      <button class="cl-close-btn" id="cl-close-btn">&#10005;</button>
    </div>
    <div class="cl-body" style="padding:32px; text-align:center; color:var(--text-muted);">
      <p style="margin-bottom:16px; font-size:1rem;">No schema loaded yet.<br>Upload your <strong>LOGGER.xlsx</strong> to get started.</p>
      <label class="btn btn-primary" style="cursor:pointer;">
        &#128196; Upload LOGGER.xlsx
        <input type="file" accept=".xlsx" id="cl-schema-upload-empty" style="display:none" />
      </label>
    </div>
  `;

  _clBackdrop.appendChild(panel);
  document.body.appendChild(_clBackdrop);

  panel.querySelector('#cl-close-btn').addEventListener('click', closeCsvLogModal);
  panel.querySelector('#cl-schema-upload-empty').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    showToast('Uploading schema...', 'info');
    try {
      const res = await csvlogService.uploadSchema(file);
      if (res.ok) {
        _clSchema = res.schema;
        closeCsvLogModal();
        showToast('Schema loaded! Opening CSVLog...', 'success');
        setTimeout(() => openCsvLogModal(), 300);
      }
    } catch (err) {
      showToast('Upload failed: ' + err.message, 'error');
    }
  });
}

/* ── Build and open the full modal ───────────────────────────────────────── */
function _buildAndOpen(dateKey) {
  _clBackdrop = document.createElement('div');
  _clBackdrop.className = 'cl-backdrop';
  _clBackdrop.addEventListener('click', e => {
    if (e.target === _clBackdrop) closeCsvLogModal();
  });

  const panel = document.createElement('div');
  panel.className = 'cl-panel';
  panel.id = 'cl-panel';

  panel.innerHTML = `
    <div class="cl-header">
      <span class="cl-title">&#128203; CSVLog</span>
      <div class="cl-date-nav">
        <button class="cl-nav-btn" id="cl-prev-day" title="Previous day">&#8249;</button>
        <span class="cl-date-display" id="cl-date-display" title="Click to pick date">${dateKey}</span>
        <input type="date" id="cl-date-picker" class="cl-date-picker-input" value="${dateKey}" />
        <button class="cl-nav-btn" id="cl-next-day" title="Next day">&#8250;</button>
      </div>
      <div class="cl-header-actions">
        <div class="cl-schema-dd-wrap dropdown-wrapper" id="cl-schema-dd-wrap">
          <button class="cl-schema-dd-btn" id="cl-schema-dd-btn">&#128196; Schema &#9660;</button>
          <div class="cl-schema-dd-menu dropdown-menu" id="cl-schema-dd-menu">
            <label class="dropdown-item">
              &#128194; Upload New LOGGER.xlsx
              <input type="file" accept=".xlsx" id="cl-schema-upload" style="display:none" />
            </label>
            <a class="dropdown-item" href="/api/csvlog-download-schema" download="LOGGER_schema.xlsx">
              &#11015; Download Current Schema
            </a>
            <a class="dropdown-item" href="/api/csvlog-export" download="csvlog_export.xlsx">
              &#128202; Export All Trades (Excel)
            </a>
          </div>
        </div>
        <button class="cl-close-btn" id="cl-close-btn">&#10005;</button>
      </div>
    </div>
    <div class="cl-trade-tabs" id="cl-trade-tabs"></div>
    <div class="cl-group-tabs" id="cl-group-tabs"></div>
    <div class="cl-body" id="cl-body"></div>
    <div class="cl-footer">
      <button class="btn btn-outline" id="cl-reset-btn">&#8635; Reset</button>
      <button class="btn btn-primary" id="cl-save-btn">&#10003; Save</button>
    </div>
  `;

  _clBackdrop.appendChild(panel);
  document.body.appendChild(_clBackdrop);

  // Wire buttons
  panel.querySelector('#cl-close-btn').addEventListener('click', closeCsvLogModal);
  panel.querySelector('#cl-save-btn').addEventListener('click', _saveCsvLog);
  panel.querySelector('#cl-reset-btn').addEventListener('click', _resetCsvLog);
  panel.querySelector('#cl-prev-day').addEventListener('click', () => _navigateDay(-1));
  panel.querySelector('#cl-next-day').addEventListener('click', () => _navigateDay(1));
  panel.querySelector('#cl-schema-upload').addEventListener('change', _handleSchemaReplace);
  setupDropdown('cl-schema-dd-btn', 'cl-schema-dd-menu');

  // Date display click → open hidden date picker
  const dateDisplay = panel.querySelector('#cl-date-display');
  const datePicker  = panel.querySelector('#cl-date-picker');
  dateDisplay.addEventListener('click', () => datePicker.showPicker ? datePicker.showPicker() : datePicker.click());
  datePicker.addEventListener('change', () => _navigateToDate(datePicker.value));

  // Tab anywhere in #cl-body → switch group tab (wraps around, never reaches Reset/Save)
  panel.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const body = document.getElementById('cl-body');
    if (!body?.contains(document.activeElement)) return;   // not in fields area
    e.preventDefault();
    _clSwitchGroupTab(e.shiftKey ? -1 : +1);
  }, true);

  // ESC key + image paste
  document.addEventListener('keydown', _clEscKey);
  document.addEventListener('paste', _clImgPasteHandler);

  _renderTradeTabs();
  _renderContent();
  setTimeout(() => document.querySelector('#cl-trade-tabs .cl-trade-tab')?.focus(), 50);
}

/* ── Render trade tabs (Day | Trade 1, Trade 2, ...) ────────────────────── */
function _renderTradeTabs() {
  const bar = document.getElementById('cl-trade-tabs');
  if (!bar) return;
  bar.innerHTML = '';

  // Helper: keyboard nav on any trade tab
  function _tradeTabKey(e) {
    const curIdx = Array.from(document.querySelectorAll('#cl-trade-tabs .cl-trade-tab'))
                        .indexOf(e.currentTarget);

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      // Switch trade tab: directly set _clTab, re-render, re-focus (no .click() → avoids stale ref)
      e.preventDefault();
      const allTabs = document.querySelectorAll('#cl-trade-tabs .cl-trade-tab');
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const nextIdx = (curIdx + dir + allTabs.length) % allTabs.length;
      _clTab = nextIdx - 2;   // DOM index 0 = All = _clTab -2; 1 = Day = _clTab -1; 2 = T1 = _clTab 0; etc.
      _renderTradeTabs();
      _renderContent();
      document.querySelectorAll('#cl-trade-tabs .cl-trade-tab')[nextIdx]?.focus();

    } else if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Enter'
               || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      if (_clTab === -1 || _clTab === -2) {
        // All / Day tab: focus first sortable stat card
        document.querySelector('#cl-body .cl-day-stat[tabindex="0"]')?.focus();
      } else {
        // Trade tab: go into group tabs or first field
        (document.querySelector('#cl-group-tabs .cl-group-tab.active')
          || document.querySelector('#cl-group-tabs .cl-group-tab')
          || document.querySelector('#cl-body [data-cl-ctrl]')
          || document.querySelector('#cl-body button, #cl-body input, #cl-body select'))?.focus();
      }
    }
  }

  // All tab (index -2) — global summary across all dates
  const allBtn = document.createElement('button');
  allBtn.className = 'cl-trade-tab cl-all-tab' + (_clTab === -2 ? ' active' : '');
  allBtn.textContent = 'All';
  allBtn.title = 'All trades — global summary across all dates';
  allBtn.addEventListener('click', () => {
    _clTab = -2;
    _renderTradeTabs();
    _renderContent();
  });
  allBtn.addEventListener('keydown', _tradeTabKey);
  bar.appendChild(allBtn);

  // Day summary tab (index -1)
  const dayBtn = document.createElement('button');
  dayBtn.className = 'cl-trade-tab cl-day-tab' + (_clTab === -1 ? ' active' : '');
  dayBtn.textContent = 'Day';
  dayBtn.title = 'Day summary — P/L, points and all trades';
  dayBtn.addEventListener('click', () => {
    _clTab = -1;
    _renderTradeTabs();
    _renderContent();
  });
  dayBtn.addEventListener('keydown', _tradeTabKey);
  bar.appendChild(dayBtn);

  _clDayTrades.forEach(({ trade }, i) => {
    const btn = document.createElement('button');
    btn.className = 'cl-trade-tab' + (i === _clTab ? ' active' : '');
    btn.textContent = `T${i + 1}`;
    btn.title = `Trade ${i + 1}`;
    // Red indicator on loss trades
    const _pnl = parseFloat(String(trade['Net P/L'] || trade['Gross P/L'] || trade['Rs'] || trade['rs'] || '').replace(/,/g, ''));
    if (!isNaN(_pnl) && _pnl < 0) btn.classList.add('cl-tab-loss');
    btn.addEventListener('click', () => {
      _clTab = i;
      _renderTradeTabs();
      _renderContent();
    });
    btn.addEventListener('keydown', _tradeTabKey);
    bar.appendChild(btn);
  });
}

/* ── Render group tabs (Zone / Entry / Exit / PSy) ───────────────────────── */
function _renderGroupTabs() {
  const bar = document.getElementById('cl-group-tabs');
  if (!bar) return;
  bar.innerHTML = '';
  // Day tab has no group sub-tabs
  if (_clTab === -1 || !_clSchema) return;

  const active = _clGroupTab[_clTab] || _clSchema.groups[0];
  const allTabs = ['Info', ..._clSchema.groups, 'Tags'];
  const grpBtns = [];

  allTabs.forEach((grp, idx) => {
    const btn = document.createElement('button');
    btn.className = 'cl-group-tab' + (grp === active ? ' active' : '');
    btn.textContent = grp;
    btn.addEventListener('click', () => {
      _clGroupTab[_clTab] = grp;
      _renderContent();   // _renderContent calls _renderGroupTabs — no double call
    });
    btn.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        // Switch group tab: re-render content + re-focus (no stale ref from grpBtns array)
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const nextIdx = (idx + dir + allTabs.length) % allTabs.length;
        _clGroupTab[_clTab] = allTabs[nextIdx];
        _renderContent();
        document.querySelectorAll('#cl-group-tabs .cl-group-tab')[nextIdx]?.focus();

      } else if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Enter'
                 || (e.key === 'Tab' && !e.shiftKey)) {
        // Go into first field / first chip (Tags) of this group
        e.preventDefault();
        (document.querySelector('#cl-body [data-cl-ctrl]')
          || document.querySelector('#cl-body .tr-tag-chip')
          || document.querySelector('#cl-body button, #cl-body textarea, #cl-body input, #cl-body select'))?.focus();

      } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        // Go back to trade tabs
        e.preventDefault();
        (document.querySelector('#cl-trade-tabs .cl-trade-tab.active')
          || document.querySelector('#cl-trade-tabs .cl-trade-tab'))?.focus();
      }
    });
    grpBtns.push(btn);
    bar.appendChild(btn);
  });
}

/* ── Render content (router) ──────────────────────────────────────────────── */
function _renderContent() {
  _renderGroupTabs();

  const body = document.getElementById('cl-body');
  if (!body) return;
  body.innerHTML = '';

  // All / Day summary tabs
  if (_clTab === -2) { _renderAllContent(body); return; }
  if (_clTab === -1) { _renderDayContent(body); return; }

  if (!_clSchema) return;
  const { trade } = _clDayTrades[_clTab];
  if (!trade.csvlog) trade.csvlog = {};

  const activeGrp = _clGroupTab[_clTab] || 'Info';

  if (activeGrp === 'Info') { _renderInfoContent(body, trade); return; }

  // Two-column layout for all schema groups AND Tags
  body.style.padding = '0';
  body.style.overflow = 'hidden';

  const cols = document.createElement('div');
  cols.className = 'cl-cols';
  body.appendChild(cols);

  const formCol = document.createElement('div');
  formCol.className = 'cl-form-col';
  formCol.style.flex = `0 0 ${_clColSplit}%`;
  cols.appendChild(formCol);

  const resizer = document.createElement('div');
  resizer.className = 'cl-resizer';
  cols.appendChild(resizer);

  const imgCol = document.createElement('div');
  imgCol.className = 'cl-img-col';
  cols.appendChild(imgCol);

  _initColResize(resizer, formCol, cols);
  _renderImageViewer(imgCol, trade);

  if (activeGrp === 'Tags') {
    _renderTagsContent(formCol, trade);
  } else {
    _renderFormFields(formCol, trade, activeGrp);
  }
}

// Field constructors + form/info/tags renderers are in csvlog-fields.js

/* ── Save ─────────────────────────────────────────────────────────────────── */
function _saveCsvLog() {
  saveTrades();
  showToast('CSVLog saved', 'success');
}

/* ── Reset current trade's csvlog ────────────────────────────────────────── */
function _resetCsvLog() {
  if (!confirm('Reset all CSVLog data for this trade?')) return;
  const { trade } = _clDayTrades[_clTab];
  trade.csvlog = {};
  saveTrades();
  _renderContent();
  showToast('Reset done', 'info');
}

/* ── Day navigation ──────────────────────────────────────────────────────── */
function _navigateDay(dir) {
  // Only include dates that have at least one trade with real data
  const dates = [...new Set(
    state.trades
      .filter(t => (t['Instrument'] || t['instrument'] || '') || (t['Buy Time'] || t['buy_time'] || ''))
      .map(t => normalizeDate(t['trade_date'] || t['Date'] || t.date || ''))
  )].filter(Boolean).sort();

  const cur = _clDayTrades[0]
    ? normalizeDate(_clDayTrades[0].trade['trade_date'] || _clDayTrades[0].trade['Date'] || _clDayTrades[0].trade.date || '')
    : '';

  const idx    = dates.indexOf(cur);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= dates.length) return;

  _loadDateIntoModal(dates[newIdx]);
}

function _navigateToDate(dateStr) {
  if (!dateStr) return;
  const norm = normalizeDate(dateStr);
  const trades = state.trades
    .map((t, i) => ({ trade: t, rowIdx: i }))
    .filter(({ trade: t }) => normalizeDate(t['trade_date'] || t['Date'] || t.date || '') === norm);
  if (!trades.length) { showToast('No trades on this date', 'error'); return; }
  _loadDateIntoModal(norm);
}

function _loadDateIntoModal(newDate) {
  _clDayTrades = state.trades
    .map((t, i) => ({ trade: t, rowIdx: i }))
    .filter(({ trade: t }) => normalizeDate(t['trade_date'] || t['Date'] || t.date || '') === newDate);

  _clTab = -1;
  _clGroupTab = {};
  _clDaySortField = null;
  _clAllSortField = null;

  // Update date display + picker value
  const display = document.getElementById('cl-date-display');
  const picker  = document.getElementById('cl-date-picker');
  if (display) display.textContent = newDate;
  if (picker)  picker.value = newDate;

  _renderTradeTabs();
  _renderContent();
}

/* ── Schema replace ──────────────────────────────────────────────────────── */
async function _handleSchemaReplace(e) {
  const file = e.target.files[0];
  if (!file) return;
  showToast('Uploading new schema...', 'info');
  try {
    const res = await csvlogService.uploadSchema(file);
    if (res.ok) {
      _clSchema = res.schema;
      _clGroupTab = {};
      _renderContent();
      showToast('Schema updated!', 'success');
    }
  } catch (err) {
    showToast('Upload failed: ' + err.message, 'error');
  }
  e.target.value = '';
}

// _renderInfoContent, _showObsPopup, _renderTagsContent are in csvlog-fields.js

/* ── Column resizer ───────────────────────────────────────────────────────── */
function _initColResize(resizerEl, formColEl, colsEl) {
  let startX, startW;
  resizerEl.addEventListener('mousedown', e => {
    startX = e.clientX;
    startW = formColEl.getBoundingClientRect().width;
    document.addEventListener('mousemove', _onResizeMove);
    document.addEventListener('mouseup', _onResizeUp);
    e.preventDefault();
  });
  function _onResizeMove(e) {
    const dx  = e.clientX - startX;
    const tot = colsEl.getBoundingClientRect().width;
    const newW = Math.max(140, Math.min(tot - 160, startW + dx));
    _clColSplit = parseFloat((newW / tot * 100).toFixed(1));
    formColEl.style.flex = `0 0 ${_clColSplit}%`;
  }
  function _onResizeUp() {
    document.removeEventListener('mousemove', _onResizeMove);
    document.removeEventListener('mouseup', _onResizeUp);
  }
}

// _renderImageViewer and _openImgZoom are in csvlog-img.js

/* ── Close ────────────────────────────────────────────────────────────────── */
function closeCsvLogModal() {
  document.removeEventListener('keydown', _clEscKey);
  document.removeEventListener('paste', _clImgPasteHandler);
  if (_clBackdrop) { _clBackdrop.remove(); _clBackdrop = null; }
  _clDayTrades = [];
  _clImgIdx = {};
  _clTagDelMode = false;
  document.getElementById('cl-obs-popup')?.remove();
  document.body.querySelectorAll('.cl-bell-tip').forEach(el => el.remove());
}

function _clEscKey(e) {
  if (e.key === 'Escape') {
    // If zoom overlay is open, let it handle ESC — don't close the logger
    if (document.getElementById('cl-zoom-overlay')) return;
    closeCsvLogModal();
    return;
  }
  // Shift+< / Shift+> — navigate previous/next day
  if (e.key === '<') { e.preventDefault(); _navigateDay(-1); return; }
  if (e.key === '>') { e.preventDefault(); _navigateDay(1);  return; }

  const tag = (e.target || {}).tagName || '';
  const inTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);

  // 'i' key (not in text input) — open trade images fullscreen
  if ((e.key === 'i' || e.key === 'I') && !inTyping && _clTab >= 0) {
    const entry = _clDayTrades[_clTab];
    if (entry && entry.trade.images && entry.trade.images.length) {
      e.preventDefault();
      e.stopPropagation();   // prevent global gallery 'i' handler firing behind this modal
      _openImgZoom(entry.trade.images, 0);
      return;
    }
  }

  // Backspace (not in text input) — go back to All tab
  if (e.key === 'Backspace' && !inTyping && _clTab !== -2) {
    e.preventDefault();
    document.body.querySelectorAll('.cl-bell-tip').forEach(el => el.remove());
    _clTab = -2;
    _renderTradeTabs();
    _renderContent();
    return;
  }

  // Prevent page scroll behind the modal (arrow/page keys not inside inputs)
  if (!inTyping && ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' '].includes(e.key)) {
    e.preventDefault();
  }
}

/* ── Field keyboard navigation helpers (used by csvlog-fields.js) ─────────── */
function _clGetFieldControls() {
  const body = document.getElementById('cl-body');
  return body ? Array.from(body.querySelectorAll('[data-cl-ctrl]')) : [];
}

function _clNavigate(dir, fromEl) {
  const ctrls = _clGetFieldControls();
  if (!ctrls.length) { if (dir < 0) _clFocusGroupTab(); return; }
  let idx = ctrls.indexOf(fromEl);
  if (idx === -1) {
    const wrap = fromEl.closest?.('.cl-field-wrap');
    if (wrap) idx = ctrls.indexOf(wrap.querySelector('[data-cl-ctrl]'));
  }
  const next = idx + dir;
  if (next < 0) { _clFocusGroupTab(); return; }
  if (next < ctrls.length) ctrls[next].focus();
}

function _clFocusGroupTab() {
  (document.querySelector('#cl-group-tabs .cl-group-tab.active')
    || document.querySelector('#cl-group-tabs .cl-group-tab'))?.focus();
}

function _clFocusObs(fromEl) {
  fromEl.closest?.('.cl-field-wrap')?.querySelector('.cl-obs-btn')?.focus();
}

function _clFocusControl(fromEl) {
  fromEl.closest?.('.cl-field-wrap')?.querySelector('[data-cl-ctrl]')?.focus();
}

// Tab → next group tab; Shift+Tab → prev group tab (wraps: Tags→Info, Info→Tags)
function _clSwitchGroupTab(dir) {
  if (_clTab < 0 || !_clSchema) return;
  const allTabs = ['Info', ..._clSchema.groups, 'Tags'];
  const cur = _clGroupTab[_clTab] || _clSchema.groups[0];
  const idx = allTabs.indexOf(cur === undefined ? '' : cur);
  const next = (idx + dir + allTabs.length) % allTabs.length;
  if (next === idx) return;
  _clGroupTab[_clTab] = allTabs[next];
  _renderContent();
  setTimeout(() => {
    const ctrls = _clGetFieldControls();
    if (!ctrls.length) {
      // Tags or Info: focus first chip or active group tab
      (document.querySelector('#cl-body .tr-tag-chip')
        || document.querySelector('#cl-group-tabs .cl-group-tab.active')
        || document.querySelector('#cl-group-tabs .cl-group-tab'))?.focus();
      return;
    }
    ctrls[0].focus();   // always land on first field (Tab and Shift+Tab both start from top)
  }, 0);
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function _toKey(head) {
  // Convert "Head Name" → "head_name" for storage key
  return head.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
