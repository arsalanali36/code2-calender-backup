# JS - CsvLog Core (modal, day, fields)
Consolidated code context for AI assistants.


## File: `static/js/csvlog.js`
```js
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
const _CSVLOG_DRAFTS_KEY = 'tj_csvlog_modal_drafts_v1';

function _clTradeDraftKey(trade) {
  if (!trade || typeof trade !== 'object') return '';
  const date = normalizeDate(trade['trade_date'] || trade['Date'] || trade.date || '');
  const instrument = String(trade['Instrument'] || trade.instrument || '').trim();
  const buyTime = String(trade['Buy Time'] || trade.buy_time || '').trim();
  const sellTime = String(trade['Sell Time'] || trade.sell_time || '').trim();
  const placeholder = String(trade._placeholderLabel || '').trim();
  const tradeType = String(trade['TradeType'] || trade.tradetype || '').trim();
  return [date, instrument, buyTime, sellTime, tradeType, placeholder].join('|');
}

function _clReadDrafts() {
  try {
    return JSON.parse(localStorage.getItem(_CSVLOG_DRAFTS_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}

function _clWriteDrafts(drafts) {
  try {
    localStorage.setItem(_CSVLOG_DRAFTS_KEY, JSON.stringify(drafts || {}));
  } catch (e) { }
}

function _clPersistDraftTrade(trade) {
  const key = _clTradeDraftKey(trade);
  if (!key) return;
  const drafts = _clReadDrafts();
  drafts[key] = {
    csvlog: trade?.csvlog || {},
    Note: trade?.Note ?? '',
    note: trade?.note ?? '',
    Tags: Array.isArray(trade?.Tags) ? [...trade.Tags] : [],
    tags: Array.isArray(trade?.tags) ? [...trade.tags] : [],
    images: Array.isArray(trade?.images) ? [...trade.images] : [],
    savedAt: Date.now()
  };
  _clWriteDrafts(drafts);
}

function _clApplyDraftTrade(trade) {
  const key = _clTradeDraftKey(trade);
  if (!key) return;
  const draft = _clReadDrafts()[key];
  if (!draft || typeof draft !== 'object') return;
  trade.csvlog = (draft.csvlog && typeof draft.csvlog === 'object')
    ? JSON.parse(JSON.stringify(draft.csvlog))
    : (trade.csvlog || {});
  if (draft.Note !== undefined) trade.Note = draft.Note;
  if (draft.note !== undefined) trade.note = draft.note;
  if (Array.isArray(draft.Tags)) trade.Tags = [...draft.Tags];
  if (Array.isArray(draft.tags)) trade.tags = [...draft.tags];
  if (Array.isArray(draft.images)) trade.images = [...draft.images];
}

function _clPersistDraftCurrentTrade() {
  if (_clTab < 0 || !_clDayTrades[_clTab]?.trade) return;
  _clPersistDraftTrade(_clDayTrades[_clTab].trade);
}

function _clApplyDraftsToDayTrades() {
  _clDayTrades.forEach(({ trade }) => _clApplyDraftTrade(trade));
}

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
  _clApplyDraftsToDayTrades();

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
  _clBackdrop.addEventListener('click', async e => {
    if (e.target === _clBackdrop) await closeCsvLogModal();
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
            <a class="dropdown-item" href="/api/csvlog-download-template" download="LOGGER_template.xlsx">
              &#128274; Download Protected Template
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
  panel.querySelector('#cl-close-btn').addEventListener('click', async () => await closeCsvLogModal());
  panel.querySelector('#cl-save-btn').addEventListener('click', async () => await _saveCsvLog());
  panel.querySelector('#cl-reset-btn').addEventListener('click', async () => await _resetCsvLog());
  panel.querySelector('#cl-prev-day').addEventListener('click', async () => await _navigateDay(-1));
  panel.querySelector('#cl-next-day').addEventListener('click', async () => await _navigateDay(1));
  panel.querySelector('#cl-schema-upload').addEventListener('change', _handleSchemaReplace);
  setupDropdown('cl-schema-dd-btn', 'cl-schema-dd-menu');

  // Date display click → open hidden date picker
  const dateDisplay = panel.querySelector('#cl-date-display');
  const datePicker  = panel.querySelector('#cl-date-picker');
  dateDisplay.addEventListener('click', () => datePicker.showPicker ? datePicker.showPicker() : datePicker.click());
  datePicker.addEventListener('change', async () => await _navigateToDate(datePicker.value));

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

  let _realCount = 0;
  _clDayTrades.forEach(({ trade }, i) => {
    const isPlaceholder = !!trade._placeholder;
    const btn = document.createElement('button');
    btn.className = 'cl-trade-tab' + (i === _clTab ? ' active' : '') + (isPlaceholder ? ' cl-ph-tab' : '');

    if (isPlaceholder) {
      btn.textContent = trade._placeholderLabel || ('x' + (i + 1));
      btn.title = `Placeholder ${trade._placeholderLabel || ''} — right-click to merge with a real trade`;
      btn.addEventListener('contextmenu', e => _showPlaceholderContextMenu(e, _clDayTrades[i], btn));
    } else {
      _realCount++;
      btn.textContent = `T${_realCount}`;
      btn.title = `Trade ${_realCount}`;
      const _pnl = parseFloat(String(trade['Net P/L'] || trade['Gross P/L'] || trade['Rs'] || trade['rs'] || '').replace(/,/g, ''));
      if (!isNaN(_pnl) && _pnl < 0) btn.classList.add('cl-tab-loss');
    }

    btn.addEventListener('click', () => {
      _clTab = i;
      _renderTradeTabs();
      _renderContent();
    });
    btn.addEventListener('keydown', _tradeTabKey);
    bar.appendChild(btn);
  });

  // "+" button — always visible so any date (with or without placeholders) can get one
  const addBtn = document.createElement('button');
  addBtn.className = 'cl-trade-tab cl-ph-add-btn';
  addBtn.textContent = '+';
  addBtn.title = 'Add a placeholder observation entry for this date';
  addBtn.addEventListener('click', _addAnotherPlaceholder);
  bar.appendChild(addBtn);
}

/* ── Render group tabs (Zone / Entry / Exit / PSy) ───────────────────────── */
function _renderGroupTabs() {
  const bar = document.getElementById('cl-group-tabs');
  if (!bar) return;
  bar.innerHTML = '';
  // Day tab has no group sub-tabs
  if (_clTab === -1 || !_clSchema) return;

  const active = _clGroupTab[_clTab] || _clSchema.groups[0];
  const allTabs = ['Info', ..._clSchema.groups, 'Vitals', 'Tags'];
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
  _clApplyDraftTrade(trade);
  if (!trade.csvlog) trade.csvlog = {};

  const activeGrp = _clGroupTab[_clTab] || 'Info';

  if (activeGrp === 'Info')    { _renderInfoContent(body, trade); return; }
  if (activeGrp === 'Vitals')  { _renderVitalsContent(body, trade); return; }

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
async function _saveCsvLog() {
  await _clPersistNow();
  showToast('CSVLog saved', 'success');
}

/* ── Reset current trade's csvlog ────────────────────────────────────────── */
async function _resetCsvLog() {
  if (!confirm('Reset all CSVLog data for this trade?')) return;
  const { trade } = _clDayTrades[_clTab];
  trade.csvlog = {};
  await _clPersistNow();
  _renderContent();
  showToast('Reset done', 'info');
}

/* ── Day navigation ──────────────────────────────────────────────────────── */
async function _navigateDay(dir) {
  await _clPersistNow();
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

async function _navigateToDate(dateStr) {
  await _clPersistNow();
  if (!dateStr) return;
  const norm = normalizeDate(dateStr);
  const trades = state.trades
    .map((t, i) => ({ trade: t, rowIdx: i }))
    .filter(({ trade: t }) => normalizeDate(t['trade_date'] || t['Date'] || t.date || '') === norm);
  if (!trades.length) { _offerPlaceholder(norm); return; }
  _loadDateIntoModal(norm);
}

function _loadDateIntoModal(newDate) {
  _clDayTrades = state.trades
    .map((t, i) => ({ trade: t, rowIdx: i }))
    .filter(({ trade: t }) => normalizeDate(t['trade_date'] || t['Date'] || t.date || '') === newDate);
  _clApplyDraftsToDayTrades();

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
async function closeCsvLogModal() {
  await _clPersistNow();
  document.removeEventListener('keydown', _clEscKey);
  document.removeEventListener('paste', _clImgPasteHandler);
  if (_clBackdrop) { _clBackdrop.remove(); _clBackdrop = null; }
  _clDayTrades = [];
  _clImgIdx = {};
  _clTagDelMode = false;
  document.getElementById('cl-obs-popup')?.remove();
  document.body.querySelectorAll('.cl-bell-tip').forEach(el => el.remove());
}

async function _clEscKey(e) {
  if (e.key === 'Escape') {
    // If zoom overlay is open, let it handle ESC — don't close the logger
    if (document.getElementById('cl-zoom-overlay')) return;
    await closeCsvLogModal();
    return;
  }
  // Shift+< / Shift+> — navigate previous/next day
  if (e.key === '<') { e.preventDefault(); await _navigateDay(-1); return; }
  if (e.key === '>') { e.preventDefault(); await _navigateDay(1);  return; }

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
  const allTabs = ['Info', ..._clSchema.groups, 'Vitals', 'Tags'];
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

/* ── Debounced auto-save (called from field change handlers) ─────────────── */
let _clSaveTimer = null;
let _clPersistInFlight = null;
let _clPersistQueued = false;
function _clAutoSave() {
  _clReapplyConditionals();   // immediate UI update (freeze/unfreeze dependent fields)
  _clPersistDraftCurrentTrade();
  clearTimeout(_clSaveTimer);
  _clLiveRefreshCharts();
  _clSaveTimer = setTimeout(() => { _clPersistNow(); }, 0);
}

async function _clPersistNow() {
  _clPersistDraftCurrentTrade();
  clearTimeout(_clSaveTimer);
  _clSaveTimer = null;
  _clLiveRefreshCharts();
  if (_clPersistInFlight) {
    _clPersistQueued = true;
    return _clPersistInFlight;
  }
  window.__csvlogPersisting = true;
  _clPersistInFlight = (async () => {
    try {
      await saveTrades();
    } catch (e) {
    } finally {
      _clPersistInFlight = null;
      window.__csvlogPersisting = false;
    }
  })();
  await _clPersistInFlight;
  if (_clPersistQueued) {
    _clPersistQueued = false;
    return _clPersistNow();
  }
}

function _clLiveRefreshCharts() {
  if (typeof _clChartsRender === 'function' && document.querySelector('.clc-backdrop')) {
    try { _clChartsRender(); } catch (e) { }
  }
}

```

## File: `static/js/csvlog-day.js`
```js
/**
 * @fileoverview csvlog-day.js
 * @description Day summary tab rendering for CSVLog modal.
 *   Split from csvlog-fields.js to stay under 30 KB file-size limit.
 *   All functions are global scope — called from csvlog.js.
 */

/* ── Bell-shape chart arrangement ────────────────────────────────────────── */
// Gains ascending (smallest at top → largest toward middle)
// then Losses ascending by value (most negative at middle → smallest loss at bottom)
// Result: bars shortest at top & bottom, longest in the middle — bell silhouette.
function _bellArrange(rows) {
  const gains  = rows.filter(r => r.pnlNum >= 0).sort((a, b) => a.pnlNum - b.pnlNum);
  const losses = rows.filter(r => r.pnlNum <  0).sort((a, b) => a.pnlNum - b.pnlNum);
  return [...gains, ...losses];
}

/* ── Lot size lookup (qty ÷ lotSize = lots) ──────────────────────────────── */
const _CL_LOT_SIZES = { NIFTY: 65, BANKNIFTY: 35, FINNIFTY: 65, MIDCPNIFTY: 75, SENSEX: 10, BANKEX: 15 };
function _clLots(instr, qty) {
  if (!qty) return null;
  const base = String(instr || '').toUpperCase().split(/\s|\d/)[0];
  const ls = _CL_LOT_SIZES[base];
  if (!ls) return null;
  return Math.round(qty / ls);
}

/* ── Horizontal bell chart (for All tab) ─────────────────────────────────── */
// Gains ascending left→center, losses ascending (most-negative) center→right
// → bars grow tall toward the middle, short at edges = horizontal bell silhouette
function _buildBellChart(rows) {
  const gains  = rows.filter(r => r.pnlNum !== null && r.pnlNum >= 0).sort((a, b) => a.pnlNum - b.pnlNum);
  const losses = rows.filter(r => r.pnlNum !== null && r.pnlNum <  0).sort((a, b) => a.pnlNum - b.pnlNum);
  const bellRows = [...gains, ...losses];
  if (!bellRows.length) return null;

  const maxAbs = Math.max(...bellRows.map(r => Math.abs(r.pnlNum)), 1);
  const HALF_H = 100; // px per half

  const wrap = document.createElement('div');
  wrap.className = 'cl-bell-wrap';

  const chart = document.createElement('div');
  chart.className = 'cl-bell-chart';
  wrap.appendChild(chart);

  // Shared tooltip — fixed position, appended to body
  document.body.querySelectorAll('.cl-bell-tip').forEach(el => el.remove());
  const tip = document.createElement('div');
  tip.className = 'cl-bell-tip';
  document.body.appendChild(tip);

  bellRows.forEach(r => {
    const pct    = Math.abs(r.pnlNum) / maxAbs;
    const barH   = Math.max(3, Math.round(pct * HALF_H));
    const isPos  = r.pnlNum >= 0;
    const color  = isPos ? 'var(--green)' : 'var(--red)';
    const colorBg = isPos ? 'rgba(63,185,80,0.4)' : 'rgba(248,81,73,0.4)';

    const col = document.createElement('div');
    col.className = 'cl-bell-col';

    const topH = document.createElement('div'); topH.className = 'cl-bell-top';
    const botH = document.createElement('div'); botH.className = 'cl-bell-bot';

    const bar = document.createElement('div');
    bar.className = 'cl-bell-bar ' + (isPos ? 'cl-bell-bar-pos' : 'cl-bell-bar-neg');
    bar.style.cssText = 'height:' + barH + 'px;background:' + colorBg + ';border-color:' + color;

    if (isPos) topH.appendChild(bar); else botH.appendChild(bar);
    col.appendChild(topH);
    col.appendChild(botH);
    chart.appendChild(col);

    // Hover tooltip
    const pnlStr = (r.pnlNum > 0 ? '+' : '') + Math.trunc(r.pnlNum);
    const lots   = _clLots(r.instr, r.qty);
    col.addEventListener('mouseenter', () => {
      const rect = col.getBoundingClientRect();
      tip.innerHTML =
        (r.date ? '<div class="cl-tip-date">' + r.date + '</div>' : '') +
        '<div class="cl-tip-instr">T' + (r.dayIdx || (r.idx + 1)) + (lots !== null ? ' &bull; ' + lots + ' lot' + (lots !== 1 ? 's' : '') : '') + '</div>' +
        '<div class="cl-tip-pnl" style="color:' + color + '">' + pnlStr + ' Rs</div>' +
        (r.ptsNum !== null ? '<div class="cl-tip-pts">Pts: ' + Math.trunc(r.ptsNum) + '</div>' : '');
      const TW = 148;
      let left = rect.left + rect.width / 2 - TW / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - TW - 8));
      let top = rect.top - 100;
      if (top < 8) top = rect.bottom + 8;
      tip.style.cssText = 'display:block;left:' + left + 'px;top:' + top + 'px;';
    });
    col.addEventListener('mouseleave', () => { tip.style.display = 'none'; });

    // Click → navigate to that date's Day view in the logger
    col.addEventListener('click', () => {
      tip.style.display = 'none';
      if (r.date) {
        _loadDateIntoModal(r.date);
      } else {
        _clTab = r.idx;
        _renderTradeTabs(); _renderGroupTabs(); _renderContent();
      }
    });
  });

  return wrap;
}

/* ── Day summary tab ─────────────────────────────────────────────────────── */
function _renderDayContent(body) {
  body.style.padding = '16px 20px';
  body.style.overflow = 'auto';
  body.style.display = 'block';   // override flex so children stack + scroll works

  // Restore actual date in header (may have been set to "Full Range" by All tab)
  const _curDate = _clDayTrades[0]
    ? (_clDayTrades[0].trade['trade_date'] || _clDayTrades[0].trade['Date'] || _clDayTrades[0].trade.date || '')
    : '';
  if (_curDate) { const _d = document.getElementById('cl-date-display'); if (_d) _d.textContent = _curDate; }

  const toSec = s => {
    if (!s) return null;
    const p = String(s).split(':');
    return parseInt(p[0]||0)*3600 + parseInt(p[1]||0)*60 + parseInt(p[2]||0);
  };
  const fmtDur = d => {
    if (!d && d !== 0) return '—';
    const h = Math.floor(d/3600), m = Math.floor((d%3600)/60), s = d%60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
    return `${s}s`;
  };
  // HH:MM only — strip seconds
  const fmtTime = t => {
    if (!t) return '—';
    const parts = String(t).split(':');
    return parts.length >= 2 ? parts[0].padStart(2,'0') + ':' + parts[1].padStart(2,'0') : t;
  };
  // Truncate to integer (no rounding — just drop decimals)
  const fmtNum = n => n === null ? '—' : String(Math.trunc(n));

  // Compute per-trade rows
  let totalPnl = 0, totalPts = 0, totalFee = 0, pnlCount = 0, ptsCount = 0;
  const allRows = _clDayTrades.map(({ trade }, i) => {
    const buyT  = trade['Buy Time']  || trade['buy_time']  || trade['BUY TIME']  || '';
    const sellT = trade['Sell Time'] || trade['sell_time'] || trade['SELL TIME'] || '';
    const s1 = toSec(buyT), s2 = toSec(sellT);
    const entryT = (s1 !== null && s2 !== null && s1 <= s2) ? buyT  : (s2 !== null && s1 !== null ? sellT : buyT || sellT);
    const exitT  = (s1 !== null && s2 !== null && s1 <= s2) ? sellT : (s2 !== null && s1 !== null ? buyT  : sellT || buyT);
    const durSec = (s1 !== null && s2 !== null) ? Math.abs(s2 - s1) : null;
    const pnlRaw = trade['Net P/L'] || trade['Gross P/L'] || trade['Rs'] || trade['rs'] || trade['RS'] || '';
    const pnlNum = parseFloat(String(pnlRaw).replace(/,/g, ''));
    const ptsRaw = trade['Pt'] || trade['pt'] || '';
    const ptsNum = parseFloat(String(ptsRaw).replace(/,/g, ''));
    const feeRaw = trade['Brokerage'] || trade['brokerage'] || trade['Broker'] || trade['broker'] || trade['BROKER'] || trade['Fee'] || trade['fee'] || '';
    const feeNum = parseFloat(String(feeRaw).replace(/,/g, ''));
    if (!isNaN(pnlNum)) { totalPnl += pnlNum; pnlCount++; }
    if (!isNaN(ptsNum)) { totalPts += ptsNum; ptsCount++; }
    if (!isNaN(feeNum)) totalFee += feeNum;
    const instr = trade['Instrument'] || trade['instrument'] || '';
    const qtyRaw = trade['Qty'] || trade['qty'] || trade['Quantity'] || trade['quantity'] || trade['QTY'] || '';
    const qtyNum = parseInt(String(qtyRaw).replace(/,/g, ''), 10);
    return {
      idx: i,
      instr,
      qty: isNaN(qtyNum) ? null : qtyNum,
      ttype:  trade['TradeType'] || trade['tradetype'] || '',
      entryT: entryT || '',
      exitT:  exitT  || '',
      durSec,
      pnlNum: isNaN(pnlNum) ? null : pnlNum,
      ptsNum: isNaN(ptsNum) ? null : ptsNum,
    };
  });

  // Filter out blank rows (no instrument and no time and no P/L)
  const rows = allRows.filter(r => r.instr || r.entryT || r.pnlNum !== null);

  // ── Apply sort to rows ─────────────────────────────────────────────────────
  let displayRows = [...rows];
  if (_clDaySortField === 'pnl') {
    displayRows.sort((a, b) => (b.pnlNum ?? -Infinity) - (a.pnlNum ?? -Infinity));
  } else if (_clDaySortField === 'pts') {
    displayRows.sort((a, b) => (b.ptsNum ?? -Infinity) - (a.ptsNum ?? -Infinity));
  }

  // ── Stats bar ──────────────────────────────────────────────────────────────
  const stats = document.createElement('div');
  stats.className = 'cl-day-stats';

  const sortableStatEls = [];

  const mkStat = (label, value, color, sortField) => {
    const el = document.createElement('div');
    el.className = 'cl-day-stat';
    if (sortField) {
      el.tabIndex = 0;
      el.dataset.sortField = sortField;
      if (_clDaySortField === sortField) el.classList.add('cl-day-stat-sorted');
      el.title = 'Space / click: sort by ' + label + ' (high to low)';
      sortableStatEls.push(el);
    }
    const lbl = document.createElement('div');
    lbl.className = 'cl-day-stat-label';
    lbl.textContent = label;
    const val = document.createElement('div');
    val.className = 'cl-day-stat-value';
    val.textContent = value;
    if (color) { val.style.color = color; }
    el.appendChild(lbl);
    el.appendChild(val);
    return el;
  };

  const pnlColor = pnlCount > 0 ? (totalPnl > 0 ? 'var(--green)' : totalPnl < 0 ? 'var(--red)' : '') : '';
  const ptsColor = ptsCount > 0 ? (totalPts > 0 ? 'var(--green)' : totalPts < 0 ? 'var(--red)' : '') : '';
  stats.appendChild(mkStat('Total P/L (Rs)', pnlCount > 0 ? fmtNum(totalPnl) : '—', pnlColor, 'pnl'));
  stats.appendChild(mkStat('Total Points',   ptsCount > 0 ? fmtNum(totalPts) : '—', ptsColor, 'pts'));
  stats.appendChild(mkStat('Trades',         rows.length.toString(), ''));
  if (totalFee > 0) stats.appendChild(mkStat('T. Fee', fmtNum(totalFee), 'var(--text-muted)'));
  body.appendChild(stats);

  // Stat card keyboard nav — wired after tableRowEls is built
  const _wireStatKeys = tableRowEls => {
    sortableStatEls.forEach((el, i) => {
      el.addEventListener('click', () => {
        const sf = el.dataset.sortField;
        _clDaySortField = _clDaySortField === sf ? null : sf;
        _renderContent();
        setTimeout(() => document.querySelector('#cl-body .cl-day-stat[data-sort-field="' + sf + '"]')?.focus(), 0);
      });
      el.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          sortableStatEls[(i + 1) % sortableStatEls.length].focus();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          sortableStatEls[(i - 1 + sortableStatEls.length) % sortableStatEls.length].focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          document.querySelector('#cl-trade-tabs .cl-day-tab')?.focus();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          tableRowEls[0]?.focus();
        } else if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          el.click();
        }
      });
    });
  };

  // ── P/L bar chart (bell shape: gains ascending → losses descending by magnitude) ──
  const chartRows = _bellArrange(displayRows.filter(r => r.pnlNum !== null));
  if (chartRows.length > 0) {
    const maxAbs = Math.max(...chartRows.map(r => Math.abs(r.pnlNum)), 1);
    const chart = document.createElement('div');
    chart.className = 'cl-day-chart';

    chartRows.forEach(r => {
      const pct = Math.round(Math.abs(r.pnlNum) / maxAbs * 100);
      const isPos = r.pnlNum >= 0;
      const color = isPos ? 'var(--green)' : 'var(--red)';
      const colorAlpha = isPos ? 'rgba(63,185,80,0.18)' : 'rgba(248,81,73,0.18)';

      const row = document.createElement('div');
      row.className = 'cl-day-chart-row';
      row.title = 'Trade ' + (r.idx + 1) + ' — click to open';
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        _clTab = r.idx;
        _renderTradeTabs();
        _renderGroupTabs();
        _renderContent();
      });

      row.innerHTML =
        '<span class="cl-day-chart-lbl">' + (r.idx + 1) + '</span>' +
        '<div class="cl-day-chart-track">' +
          '<div class="cl-day-chart-fill" style="width:' + pct + '%;background:' + colorAlpha + ';border-left:3px solid ' + color + '"></div>' +
        '</div>' +
        '<span class="cl-day-chart-val" style="color:' + color + '">' + fmtNum(r.pnlNum) + '</span>';
      chart.appendChild(row);
    });
    body.appendChild(chart);
  }

  // ── Summary table (sorted order) ───────────────────────────────────────────
  const tableWrap = document.createElement('div');
  tableWrap.className = 'cl-day-table-wrap';

  const table = document.createElement('table');
  table.className = 'cl-day-table';

  // Column headers — clicking P/L or Pts header also sorts
  const thead = document.createElement('thead');
  const mkTh = (txt, sf) => {
    const th = document.createElement('th');
    th.textContent = txt + (sf && _clDaySortField === sf ? ' \u2193' : '');
    if (sf) {
      th.style.cursor = 'pointer';
      th.title = 'Sort by ' + txt;
      th.addEventListener('click', () => {
        _clDaySortField = _clDaySortField === sf ? null : sf;
        _renderContent();
      });
    }
    return th;
  };
  const hr = document.createElement('tr');
  [['#'], ['Instrument'], ['Lots'], ['Entry'], ['Exit'], ['Dur'], ['P/L (Rs)', 'pnl'], ['Pts', 'pts']]
    .forEach(([t, sf]) => hr.appendChild(mkTh(t, sf)));
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const tableRowEls = [];
  displayRows.forEach((r, displayIdx) => {
    const tr = document.createElement('tr');
    tr.title = 'Go to Trade ' + (r.idx + 1);
    tr.style.cursor = 'pointer';
    tr.tabIndex = 0;
    const goToTrade = () => {
      _clTab = r.idx;
      _renderTradeTabs();
      _renderGroupTabs();
      _renderContent();
    };
    tr.addEventListener('click', goToTrade);
    tr.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToTrade(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); tableRowEls[displayIdx + 1]?.focus(); }
      else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (displayIdx === 0) sortableStatEls[0]?.focus();
        else tableRowEls[displayIdx - 1]?.focus();
      }
    });

    const rc = r.pnlNum !== null ? (r.pnlNum > 0 ? 'var(--green)' : r.pnlNum < 0 ? 'var(--red)' : '') : '';
    const pc = r.ptsNum !== null ? (r.ptsNum > 0 ? 'var(--green)' : r.ptsNum < 0 ? 'var(--red)' : '') : '';
    if (r.pnlNum !== null && r.pnlNum < 0) tr.classList.add('cl-day-row-loss');
    const lots = _clLots(r.instr, r.qty);

    tr.innerHTML =
      '<td>' + (r.idx + 1) + '</td>' +
      '<td>' + (r.instr || '—') + (r.ttype ? ' <span class="cl-day-ttype">' + r.ttype + '</span>' : '') + '</td>' +
      '<td style="color:var(--text-muted)">' + (lots !== null ? lots : '—') + '</td>' +
      '<td>' + fmtTime(r.entryT) + '</td>' +
      '<td>' + fmtTime(r.exitT) + '</td>' +
      '<td>' + (r.durSec !== null ? fmtDur(r.durSec) : '—') + '</td>' +
      '<td style="color:' + rc + ';font-weight:' + (rc ? '700' : '400') + '">' + (r.pnlNum !== null ? fmtNum(r.pnlNum) : '—') + '</td>' +
      '<td style="color:' + pc + '">' + (r.ptsNum !== null ? fmtNum(r.ptsNum) : '—') + '</td>';
    tableRowEls.push(tr);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  body.appendChild(tableWrap);

  // Wire stat card keyboard/click handlers (needs tableRowEls to be populated)
  _wireStatKeys(tableRowEls);
}

/* ── All trades summary tab ──────────────────────────────────────────────── */
function _renderAllContent(body) {
  body.style.padding = '16px 20px';
  body.style.overflow = 'auto';
  body.style.display = 'block';

  const toSec = s => {
    if (!s) return null;
    const p = String(s).split(':');
    return parseInt(p[0]||0)*3600 + parseInt(p[1]||0)*60 + parseInt(p[2]||0);
  };
  const fmtDur = d => {
    if (!d && d !== 0) return '—';
    const h = Math.floor(d/3600), m = Math.floor((d%3600)/60), s = d%60;
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return s > 0 ? m + 'm ' + s + 's' : m + 'm';
    return s + 's';
  };
  const fmtTime = t => {
    if (!t) return '—';
    const parts = String(t).split(':');
    return parts.length >= 2 ? parts[0].padStart(2,'0') + ':' + parts[1].padStart(2,'0') : t;
  };
  const fmtNum = n => n === null ? '—' : String(Math.trunc(n));
  const normDate = d => {
    if (!d) return '';
    const s = String(d).trim();
    const m = s.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/);
    return m ? m[1] + '-' + m[2] + '-' + m[3] : s;
  };

  // Show "Full Range" in date header when All tab is active
  const _dispEl = document.getElementById('cl-date-display');
  if (_dispEl) _dispEl.textContent = 'Full Range';

  // Build rows from all trades
  let totalPnl = 0, totalPts = 0, totalFee = 0, pnlCount = 0, ptsCount = 0;
  const _dateCounter = {};   // per-day running count → dayIdx
  const allRows = (state.trades || []).map((trade, i) => {
    const buyT  = trade['Buy Time']  || trade['buy_time']  || trade['BUY TIME']  || '';
    const sellT = trade['Sell Time'] || trade['sell_time'] || trade['SELL TIME'] || '';
    const s1 = toSec(buyT), s2 = toSec(sellT);
    const entryT = (s1 !== null && s2 !== null && s1 <= s2) ? buyT  : (s2 !== null && s1 !== null ? sellT : buyT || sellT);
    const exitT  = (s1 !== null && s2 !== null && s1 <= s2) ? sellT : (s2 !== null && s1 !== null ? buyT  : sellT || buyT);
    const durSec = (s1 !== null && s2 !== null) ? Math.abs(s2 - s1) : null;
    const pnlRaw = trade['Net P/L'] || trade['Gross P/L'] || trade['Rs'] || trade['rs'] || trade['RS'] || '';
    const pnlNum = parseFloat(String(pnlRaw).replace(/,/g, ''));
    const ptsRaw = trade['Pt'] || trade['pt'] || '';
    const ptsNum = parseFloat(String(ptsRaw).replace(/,/g, ''));
    const feeRaw = trade['Brokerage'] || trade['brokerage'] || trade['Broker'] || trade['broker'] || trade['BROKER'] || trade['Fee'] || trade['fee'] || '';
    const feeNum = parseFloat(String(feeRaw).replace(/,/g, ''));
    if (!isNaN(pnlNum)) { totalPnl += pnlNum; pnlCount++; }
    if (!isNaN(ptsNum)) { totalPts += ptsNum; ptsCount++; }
    if (!isNaN(feeNum)) totalFee += feeNum;
    const instr = trade['Instrument'] || trade['instrument'] || '';
    const date  = normDate(trade['trade_date'] || trade['Date'] || trade['date'] || '');
    const qtyRaw = trade['Qty'] || trade['qty'] || trade['Quantity'] || trade['quantity'] || trade['QTY'] || '';
    const qtyNum = parseInt(String(qtyRaw).replace(/,/g, ''), 10);
    _dateCounter[date] = (_dateCounter[date] || 0) + 1;
    const dayIdx = _dateCounter[date];   // 1-based trade number within that date
    return {
      idx: i,
      dayIdx,
      date,
      instr,
      qty: isNaN(qtyNum) ? null : qtyNum,
      ttype:  trade['TradeType'] || trade['tradetype'] || '',
      entryT: entryT || '',
      exitT:  exitT  || '',
      durSec,
      pnlNum: isNaN(pnlNum) ? null : pnlNum,
      ptsNum: isNaN(ptsNum) ? null : ptsNum,
    };
  }).filter(r => r.instr || r.entryT || r.pnlNum !== null);

  // Apply sort
  let displayRows = [...allRows];
  if (_clAllSortField === 'pnl') {
    displayRows.sort((a, b) => (b.pnlNum ?? -Infinity) - (a.pnlNum ?? -Infinity));
  } else if (_clAllSortField === 'pts') {
    displayRows.sort((a, b) => (b.ptsNum ?? -Infinity) - (a.ptsNum ?? -Infinity));
  }

  // ── Stats bar ──────────────────────────────────────────────────────────────
  const stats = document.createElement('div');
  stats.className = 'cl-day-stats';

  const sortableStatEls = [];
  const mkStat = (label, value, color, sortField) => {
    const el = document.createElement('div');
    el.className = 'cl-day-stat';
    if (sortField) {
      el.tabIndex = 0;
      el.dataset.sortField = sortField;
      if (_clAllSortField === sortField) el.classList.add('cl-day-stat-sorted');
      el.title = 'Space / click: sort by ' + label + ' (high to low)';
      sortableStatEls.push(el);
    }
    const lbl = document.createElement('div');
    lbl.className = 'cl-day-stat-label';
    lbl.textContent = label;
    const val = document.createElement('div');
    val.className = 'cl-day-stat-value';
    val.textContent = value;
    if (color) val.style.color = color;
    el.appendChild(lbl);
    el.appendChild(val);
    return el;
  };

  const pnlColor = pnlCount > 0 ? (totalPnl > 0 ? 'var(--green)' : totalPnl < 0 ? 'var(--red)' : '') : '';
  const ptsColor = ptsCount > 0 ? (totalPts > 0 ? 'var(--green)' : totalPts < 0 ? 'var(--red)' : '') : '';
  stats.appendChild(mkStat('Total P/L (Rs)', pnlCount > 0 ? fmtNum(totalPnl) : '—', pnlColor, 'pnl'));
  stats.appendChild(mkStat('Total Points',   ptsCount > 0 ? fmtNum(totalPts) : '—', ptsColor, 'pts'));
  stats.appendChild(mkStat('Trades',         allRows.length.toString(), ''));
  if (totalFee > 0) stats.appendChild(mkStat('T. Fee', fmtNum(totalFee), 'var(--text-muted)'));
  body.appendChild(stats);

  const _wireStatKeys = tableRowEls => {
    sortableStatEls.forEach((el, i) => {
      el.addEventListener('click', () => {
        const sf = el.dataset.sortField;
        _clAllSortField = _clAllSortField === sf ? null : sf;
        _renderContent();
        setTimeout(() => document.querySelector('#cl-body .cl-day-stat[data-sort-field="' + sf + '"]')?.focus(), 0);
      });
      el.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          sortableStatEls[(i + 1) % sortableStatEls.length].focus();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          sortableStatEls[(i - 1 + sortableStatEls.length) % sortableStatEls.length].focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          document.querySelector('#cl-trade-tabs .cl-all-tab')?.focus();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          tableRowEls[0]?.focus();
        } else if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          el.click();
        }
      });
    });
  };

  // ── Horizontal bell chart ──────────────────────────────────────────────────
  const bellChart = _buildBellChart(allRows);
  if (bellChart) body.appendChild(bellChart);

  // ── Summary table ──────────────────────────────────────────────────────────
  const tableWrap = document.createElement('div');
  tableWrap.className = 'cl-day-table-wrap';

  const table = document.createElement('table');
  table.className = 'cl-day-table';

  const thead = document.createElement('thead');
  const mkTh = (txt, sf) => {
    const th = document.createElement('th');
    th.textContent = txt + (sf && _clAllSortField === sf ? ' \u2193' : '');
    if (sf) {
      th.style.cursor = 'pointer';
      th.title = 'Sort by ' + txt;
      th.addEventListener('click', () => {
        _clAllSortField = _clAllSortField === sf ? null : sf;
        _renderContent();
      });
    }
    return th;
  };
  const hr = document.createElement('tr');
  [['#'], ['Date'], ['Instrument'], ['Lots'], ['Entry'], ['Exit'], ['Dur'], ['P/L (Rs)', 'pnl'], ['Pts', 'pts']]
    .forEach(([t, sf]) => hr.appendChild(mkTh(t, sf)));
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const tableRowEls = [];
  displayRows.forEach((r, displayIdx) => {
    const tr = document.createElement('tr');
    tr.title = 'Go to Trade ' + (r.idx + 1);
    tr.style.cursor = 'pointer';
    tr.tabIndex = 0;
    const goToTrade = () => {
      _clTab = r.idx;
      _renderTradeTabs();
      _renderGroupTabs();
      _renderContent();
    };
    tr.addEventListener('click', goToTrade);
    tr.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToTrade(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); tableRowEls[displayIdx + 1]?.focus(); }
      else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (displayIdx === 0) sortableStatEls[0]?.focus();
        else tableRowEls[displayIdx - 1]?.focus();
      }
    });

    const rc = r.pnlNum !== null ? (r.pnlNum > 0 ? 'var(--green)' : r.pnlNum < 0 ? 'var(--red)' : '') : '';
    const pc = r.ptsNum !== null ? (r.ptsNum > 0 ? 'var(--green)' : r.ptsNum < 0 ? 'var(--red)' : '') : '';
    if (r.pnlNum !== null && r.pnlNum < 0) tr.classList.add('cl-day-row-loss');
    const lots = _clLots(r.instr, r.qty);

    tr.innerHTML =
      '<td>' + (r.idx + 1) + '</td>' +
      '<td style="color:var(--text-muted);font-size:0.75rem">' + (r.date || '—') + '</td>' +
      '<td>' + (r.instr || '—') + (r.ttype ? ' <span class="cl-day-ttype">' + r.ttype + '</span>' : '') + '</td>' +
      '<td style="color:var(--text-muted)">' + (lots !== null ? lots : '—') + '</td>' +
      '<td>' + fmtTime(r.entryT) + '</td>' +
      '<td>' + fmtTime(r.exitT) + '</td>' +
      '<td>' + (r.durSec !== null ? fmtDur(r.durSec) : '—') + '</td>' +
      '<td style="color:' + rc + ';font-weight:' + (rc ? '700' : '400') + '">' + (r.pnlNum !== null ? fmtNum(r.pnlNum) : '—') + '</td>' +
      '<td style="color:' + pc + '">' + (r.ptsNum !== null ? fmtNum(r.ptsNum) : '—') + '</td>';
    tableRowEls.push(tr);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  body.appendChild(tableWrap);

  _wireStatKeys(tableRowEls);
}

```

## File: `static/js/csvlog-fields.js`
```js
/**
 * @fileoverview csvlog-fields.js
 * @description Field constructors, form renderer, obs popup, info/tags content for CSVLog modal.
 *   Split from csvlog.js to stay under 30 KB file-size limit.
 *   All functions are global scope — called from csvlog.js.
 */

/* ── Render form fields (left column) ────────────────────────────────────── */
function _renderFormFields(container, trade, activeGrp) {
  const groupKey = activeGrp.toLowerCase();
  if (!trade.csvlog[groupKey]) trade.csvlog[groupKey] = {};
  const saved = trade.csvlog[groupKey];

  const fields = _clSchema.fields[activeGrp] || [];
  let _currentSection = '';

  fields.forEach(field => {
    const { head, type, options } = field;

    if (type === '-') {
      _currentSection = _toKey(head);
      const sep = document.createElement('div');
      sep.className = 'cl-separator';
      sep.textContent = head;
      container.appendChild(sep);
      return;
    }

    const fieldKey = _currentSection ? `${_currentSection}_${_toKey(head)}` : _toKey(head);
    const obsKey   = fieldKey + '_obs';
    const curVal   = saved[fieldKey] !== undefined ? saved[fieldKey] : '';
    const obsVal   = saved[obsKey] || '';

    const wrap = document.createElement('div');
    wrap.className = 'cl-field-wrap';
    wrap.dataset.clFieldKey = fieldKey;   // used by conditional freeze

    const row = document.createElement('div');
    row.className = 'cl-field-row';

    const label = document.createElement('label');
    label.className = 'cl-field-label';
    // Relabel In/Out to Entry/Exit (used in PSy sub-sections)
    const displayHead = head === 'In' ? 'Entry' : head === 'Out' ? 'Exit' : head;
    label.textContent = displayHead;

    let control;
    if (type === 'Switch')        control = _makeSwitch(fieldKey, curVal, saved);
    else if (type === 'Input')    control = _makeInput(fieldKey, curVal, saved);
    else if (type === 'Dropdown') control = _makeDropdown(fieldKey, curVal, options || [], saved);
    else if (type === 'Range')    control = _makeRange(fieldKey, curVal, options || [], saved);
    else                          control = _makeInput(fieldKey, curVal, saved);

    // Obs button — opens floating popup
    const obsBtn = document.createElement('button');
    obsBtn.className = 'cl-obs-btn' + (obsVal ? ' has-obs' : '');
    obsBtn.title = obsVal ? 'Edit observation' : 'Add observation';
    obsBtn.textContent = '●';
    obsBtn.addEventListener('click', e => {
      e.stopPropagation();
      _showObsPopup(obsBtn, obsKey, saved);
    });
    obsBtn.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); _clFocusControl(obsBtn); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); _clNavigate(+1, obsBtn); }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); _clNavigate(-1, obsBtn); }
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); obsBtn.click(); }
    });

    row.appendChild(obsBtn);   // LEFT
    row.appendChild(label);
    row.appendChild(control);
    wrap.appendChild(row);
    container.appendChild(wrap);
  });

  // Apply conditional freeze rules on initial render
  _clApplyConditionals(groupKey, saved);
}

/* ── Field constructors ───────────────────────────────────────────────────── */
function _makeSwitch(key, val, saved) {
  const wrap = document.createElement('div');
  wrap.className = 'cl-switch-wrap';

  const opts = ['Y', 'N'];
  const btns = [];
  opts.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'cl-switch-btn' + (val === opt ? ' active' : '');
    btn.textContent = opt;
    if (idx === 0) btn.dataset.clCtrl = 'switch';   // primary focusable for field nav
    const activate = () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      saved[key] = opt;
      _clAutoSave();
    };
    btn.addEventListener('click', activate);
    btn.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') {
        e.preventDefault(); e.stopPropagation();
        const next = btns[(idx + 1) % btns.length];
        next.click(); next.focus();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault(); e.stopPropagation();
        if (idx === 0) { _clFocusObs(btn); }           // from Y → jump to obs
        else { btns[idx - 1].click(); btns[idx - 1].focus(); }
      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault(); _clNavigate(+1, btn);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); _clNavigate(-1, btn);
      }
    });
    btns.push(btn);
    wrap.appendChild(btn);
  });
  return wrap;
}

function _makeInput(key, val, saved) {
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'cl-input';
  inp.value = val;
  inp.dataset.clCtrl = 'input';
  inp.addEventListener('input', () => { saved[key] = inp.value; _clAutoSave(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); _clNavigate(+1, inp); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); _clNavigate(-1, inp); }
  });
  return inp;
}

function _makeDropdown(key, val, options, saved) {
  const sel = document.createElement('select');
  sel.className = 'cl-select';
  sel.dataset.clCtrl = 'dropdown';
  const blank = document.createElement('option');
  blank.value = ''; blank.textContent = '— select —';
  sel.appendChild(blank);
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt; o.textContent = opt;
    if (opt === val) o.selected = true;
    sel.appendChild(o);
  });
  let _open = false;
  sel.addEventListener('change', () => { saved[key] = sel.value; _open = false; _clAutoSave(); });
  sel.addEventListener('blur',   () => { _open = false; });
  sel.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') {
      if (_open) { _open = false; return; }         // confirm in open list — let native close
      if (e.key === ' ') { _open = true; return; }  // Space: open the list
      // Enter when closed → move to next field (confirm current value)
      e.preventDefault(); _clNavigate(+1, sel); return;
    }
    if (e.key === 'Escape') { _open = false; return; }
    if (_open) return;                              // inside open list → native handles arrows
    if (e.key === 'ArrowDown') { e.preventDefault(); _clNavigate(+1, sel); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); _clNavigate(-1, sel); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); _clFocusObs(sel); }
  });
  return sel;
}

function _makeRange(key, val, options, saved) {
  // If options are 2 numbers → slider
  if (options.length === 2 && !isNaN(options[0]) && !isNaN(options[1])) {
    return _makeSlider(key, val, Number(options[0]), Number(options[1]), saved);
  }
  // Otherwise → segmented buttons (like "Target / 0 / SL")
  return _makeSegmented(key, val, options, saved);
}

function _makeSlider(key, val, min, max, saved) {
  // Bidirectional slider when range spans negative and positive
  if (min < 0 && max > 0) return _makeBiSlider(key, val, min, max, saved);
  const wrap = document.createElement('div');
  wrap.className = 'cl-slider-wrap';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'cl-slider';
  slider.min = min; slider.max = max; slider.step = 1;
  slider.value = val !== '' ? Number(val) : 0;
  slider.dataset.clCtrl = 'slider';

  const display = document.createElement('span');
  display.className = 'cl-slider-val';
  display.textContent = slider.value;

  slider.addEventListener('input', () => {
    display.textContent = slider.value;
    saved[key] = Number(slider.value);
    _clAutoSave();
  });
  // Down/Up navigate to next/prev field; Left/Right keep native slider increment
  slider.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); _clNavigate(+1, slider); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); _clNavigate(-1, slider); }
  });

  wrap.appendChild(slider);
  wrap.appendChild(display);
  return wrap;
}

function _makeSegmented(key, val, options, saved) {
  const wrap = document.createElement('div');
  wrap.className = 'cl-segmented-wrap';

  const btns = [];
  options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'cl-seg-btn' + (val === opt ? ' active' : '');
    btn.textContent = opt;
    if (idx === 0) btn.dataset.clCtrl = 'seg';   // primary focusable for field nav
    const activate = () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      saved[key] = opt;
      _clAutoSave();
    };
    btn.addEventListener('click', activate);
    btn.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') {
        e.preventDefault(); e.stopPropagation();
        const next = btns[(idx + 1) % btns.length];
        next.click(); next.focus();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault(); e.stopPropagation();
        if (idx === 0) { _clFocusObs(btn); }           // from first → jump to obs
        else { btns[idx - 1].click(); btns[idx - 1].focus(); }
      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault(); _clNavigate(+1, btn);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); _clNavigate(-1, btn);
      }
    });
    btns.push(btn);
    wrap.appendChild(btn);
  });
  return wrap;
}

/* ── Info tab ─────────────────────────────────────────────────────────────── */
function _renderInfoContent(body, trade) {
  body.style.padding = '16px 20px';
  body.style.overflow = 'auto';
  const wrap = document.createElement('div');
  wrap.className = 'cl-info-wrap';

  // Convert "HH:MM:SS" or "HH:MM" to total seconds
  const toSec = s => {
    if (!s) return null;
    const p = String(s).split(':');
    return parseInt(p[0]||0)*3600 + parseInt(p[1]||0)*60 + parseInt(p[2]||0);
  };

  // Duration as abs diff with seconds precision
  function _calcDuration(t1, t2) {
    const s1 = toSec(t1), s2 = toSec(t2);
    if (s1 === null || s2 === null) return null;
    const d = Math.abs(s2 - s1);
    if (!d) return null;
    const h = Math.floor(d/3600), m = Math.floor((d%3600)/60), s = d%60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
    return `${s}s`;
  }

  const buyT  = trade['Buy Time']  || trade['buy_time']  || trade['BUY TIME']  || '';
  const sellT = trade['Sell Time'] || trade['sell_time'] || trade['SELL TIME'] || '';
  // Entry = earlier execution, Exit = later (handles both long and short)
  const s1 = toSec(buyT), s2 = toSec(sellT);
  const entryTime = (s1 !== null && s2 !== null && s1 <= s2) ? buyT : (s2 !== null && s1 !== null ? sellT : buyT || sellT);
  const exitTime  = (s1 !== null && s2 !== null && s1 <= s2) ? sellT : (s2 !== null && s1 !== null ? buyT  : sellT || buyT);
  const dur = _calcDuration(entryTime, exitTime);

  // P/L with color
  const pnlRaw = trade['Net P/L'] || trade['Gross P/L'] || trade['Rs'] || trade['rs'] || trade['RS'] || '';
  const pnlNum = parseFloat(String(pnlRaw).replace(/,/g, ''));
  const pnlColor = !isNaN(pnlNum) ? (pnlNum > 0 ? 'var(--green)' : pnlNum < 0 ? 'var(--red)' : '') : '';

  const pairs = [
    ['Instrument', trade['Instrument'] || trade['instrument'] || trade['INSTRUMENT'] || '—'],
    ['Trade Type', trade['TradeType']  || trade['tradetype']  || trade['TRADETYPE']  || '—'],
    ['Qty',        trade['Qty']        || trade['qty']        || trade['QTY']        || '—'],
    ['Entry',      entryTime || '—'],
    ['Exit',       exitTime  || '—'],
    ['Duration',   dur       || '—'],
    ['P/L (Rs)',   pnlRaw    || '—', pnlColor],
    ['Points',     trade['Pt'] || trade['pt'] || '—'],
  ];

  pairs.forEach(([lbl, val, color]) => {
    const row = document.createElement('div');
    row.className = 'cl-info-row';
    const lblEl = document.createElement('span');
    lblEl.className = 'cl-info-label';
    lblEl.textContent = lbl;
    const valEl = document.createElement('span');
    valEl.className = 'cl-info-value';
    valEl.textContent = val;
    if (color) { valEl.style.color = color; valEl.style.fontWeight = '700'; }
    row.appendChild(lblEl);
    row.appendChild(valEl);
    wrap.appendChild(row);
  });

  // ── Compiled observations from all csvlog groups ───────────────────────────
  const csvlog = trade.csvlog || {};
  const obsLines = [];
  for (const [group, fields] of Object.entries(csvlog)) {
    if (!fields || typeof fields !== 'object') continue;
    for (const [key, val] of Object.entries(fields)) {
      if (key.endsWith('_obs') && val && String(val).trim()) {
        const fieldName = key.replace(/_obs$/, '').replace(/_/g, ' ');
        obsLines.push(`[${group.charAt(0).toUpperCase() + group.slice(1)}] ${fieldName}: ${val}`);
      }
    }
  }

  if (obsLines.length || (csvlog._meta || {}).obs_text !== undefined) {
    const obsHdr = document.createElement('div');
    obsHdr.className = 'cl-info-section-hdr';
    obsHdr.textContent = 'Observations';
    wrap.appendChild(obsHdr);

    const obsArea = document.createElement('textarea');
    obsArea.className = 'cl-info-obs-area cl-info-obs-editable';
    obsArea.value = (csvlog._meta || {}).obs_text !== undefined
      ? csvlog._meta.obs_text
      : obsLines.join('\n');
    obsArea.placeholder = 'Observations… (format: [Group] field name: text)';
    obsArea.addEventListener('input', () => {
      if (!trade.csvlog._meta) trade.csvlog._meta = {};
      trade.csvlog._meta.obs_text = obsArea.value;
      _clAutoSave();
    });
    wrap.appendChild(obsArea);

    // Commit button — parses text back into individual obs fields
    const commitBtn = document.createElement('button');
    commitBtn.className = 'btn btn-outline cl-obs-commit-btn';
    commitBtn.textContent = '↵ Commit to fields';
    commitBtn.title = 'Parse and write observations back to each field';
    commitBtn.addEventListener('click', async () => {
      const lines = obsArea.value.split('\n');
      const entries = [];
      let cur = null;
      for (const line of lines) {
        // Match: [Group] field name: value
        const m = line.match(/^\[(\w+)\]\s+(.+?):\s*(.*)$/);
        if (m) {
          if (cur) entries.push(cur);
          cur = { group: m[1].toLowerCase(), fieldKey: m[2].trim().replace(/ /g, '_'), value: m[3] };
        } else if (cur) {
          cur.value += '\n' + line;  // continuation line
        }
      }
      if (cur) entries.push(cur);

      let updated = 0;
      for (const { group, fieldKey, value } of entries) {
        if (!trade.csvlog[group]) trade.csvlog[group] = {};
        trade.csvlog[group][fieldKey + '_obs'] = value.trim();
        updated++;
      }

      // Keep meta in sync
      if (!trade.csvlog._meta) trade.csvlog._meta = {};
      trade.csvlog._meta.obs_text = obsArea.value;
      await _clPersistNow();

      showToast(`Committed ${updated} observation${updated !== 1 ? 's' : ''} — click Save to persist`, 'success');
    });
    wrap.appendChild(commitBtn);
  }

  // ── Note (editable, syncs to trade['Note']) ────────────────────────────────
  const noteHdr = document.createElement('div');
  noteHdr.className = 'cl-info-section-hdr';
  noteHdr.textContent = 'Note';
  wrap.appendChild(noteHdr);

  const noteArea = document.createElement('textarea');
  noteArea.className = 'cl-info-note-area';
  noteArea.value = trade['Note'] || trade['note'] || '';
  noteArea.placeholder = 'Trade note…';
  noteArea.addEventListener('input', () => {
    trade['Note'] = noteArea.value;
    trade['note'] = noteArea.value;
    _clAutoSave();
  });
  wrap.appendChild(noteArea);

  body.appendChild(wrap);
}

/* ── Obs popup ────────────────────────────────────────────────────────────── */
function _showObsPopup(btn, obsKey, saved) {
  const existing = document.getElementById('cl-obs-popup');
  if (existing) {
    const isToggle = existing.dataset.key === obsKey;
    existing.remove();
    if (isToggle) return;
  }

  const popup = document.createElement('div');
  popup.id = 'cl-obs-popup';
  popup.className = 'cl-obs-popup';
  popup.dataset.key = obsKey;

  const rect = btn.getBoundingClientRect();
  popup.style.top  = (rect.bottom + 6) + 'px';
  popup.style.left = Math.max(8, rect.left - 4) + 'px';

  const ta = document.createElement('textarea');
  ta.className = 'cl-obs-popup-ta';
  ta.value = saved[obsKey] || '';
  ta.placeholder = 'Observation…';
  ta.addEventListener('input', () => {
    saved[obsKey] = ta.value;
    btn.classList.toggle('has-obs', !!ta.value);
    _clAutoSave();
  });
  // ESC: close popup, return focus to obs button (not the whole modal)
  ta.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      popup.remove();
      btn.focus();
    }
  });
  popup.appendChild(ta);
  document.body.appendChild(popup);
  ta.focus();

  setTimeout(() => {
    document.addEventListener('click', function _closeObs(e) {
      if (!popup.contains(e.target) && e.target !== btn) {
        popup.remove();
        document.removeEventListener('click', _closeObs);
      }
    });
  }, 10);
}

// _renderDayContent is in csvlog-day.js

/* ── Tags content ─────────────────────────────────────────────────────────── */
function _renderTagsContent(container, trade) {
  const tradeTags = trade['Tags'] || trade['tags'] || [];

  const wrap = document.createElement('div');
  wrap.className = 'cl-tags-wrap';

  // Controls bar
  const ctrl = document.createElement('div');
  ctrl.className = 'cl-tags-ctrl';

  const mkBtn = (txt, title) => {
    const b = document.createElement('button');
    b.className = 'tr-tag-ctrl-btn';
    b.textContent = txt; b.title = title;
    return b;
  };

  const aMinus = mkBtn('A⁻', 'Smaller chips');
  aMinus.addEventListener('click', () => { _clTagChipSize = Math.max(0.6, _clTagChipSize - 0.06); _renderContent(); });
  const aPlus = mkBtn('A⁺', 'Larger chips');
  aPlus.addEventListener('click', () => { _clTagChipSize = Math.min(1.1, _clTagChipSize + 0.06); _renderContent(); });
  const delBtn = mkBtn('Del', 'Toggle delete mode');
  if (_clTagDelMode) delBtn.style.color = 'var(--red)';
  delBtn.addEventListener('click', () => { _clTagDelMode = !_clTagDelMode; _renderContent(); });

  ctrl.appendChild(aMinus); ctrl.appendChild(aPlus); ctrl.appendChild(delBtn);
  wrap.appendChild(ctrl);

  // Build group + ungrouped lists
  const groupedSet = new Set(Object.values(state.tagGroups || {}).flat());
  const ungrouped  = (state.allTags || []).filter(t => t && !groupedSet.has(t));
  const groups = Object.entries(state.tagGroups || {})
    .filter(([, tags]) => tags && tags.length)
    .map(([name, tags]) => ({ name, tags: tags.filter(Boolean) }));
  if (ungrouped.length) groups.push({ name: 'Other', tags: ungrouped });

  const makeChip = tag => {
    const c   = typeof tagColor === 'function' ? tagColor(tag) : '#58a6ff';
    const isOn = tradeTags.includes(tag);
    const chip = document.createElement('button');
    chip.className = 'tr-tag-chip' + (isOn ? ' on' : '') + (_clTagDelMode ? ' del-mode' : '');
    chip.style.fontSize = _clTagChipSize + 'rem';
    chip.textContent = _clTagDelMode ? (tag + ' ×') : tag;
    if (isOn && !_clTagDelMode && typeof hexToRgba === 'function') {
      chip.style.cssText += `;color:${c};background:${hexToRgba(c, 0.25)};border-color:${hexToRgba(c, 0.7)}`;
    }
    chip.addEventListener('click', () => {
      if (_clTagDelMode) {
        state.allTags = (state.allTags || []).filter(t => t !== tag);
        Object.keys(state.tagGroups || {}).forEach(g => {
          state.tagGroups[g] = (state.tagGroups[g] || []).filter(t => t !== tag);
        });
        trade['Tags'] = tradeTags.filter(t => t !== tag);
        trade['tags'] = [...trade['Tags']];
        saveTagGroups();
        _clAutoSave();
      } else {
        if (isOn) {
          trade['Tags'] = tradeTags.filter(t => t !== tag);
        } else {
          trade['Tags'] = [...tradeTags, tag];
        }
        trade['tags'] = [...trade['Tags']];
        _clAutoSave();
        if (typeof renderTable === 'function') renderTable();
      }
      _renderContent();
    });
    return chip;
  };

  groups.forEach(({ name, tags }) => {
    const sec = document.createElement('div');
    sec.className = 'cl-tag-group';
    const lbl = document.createElement('div');
    lbl.className = 'cl-tag-group-label';
    lbl.textContent = name;
    sec.appendChild(lbl);
    const chips = document.createElement('div');
    chips.className = 'cl-tag-chips';
    tags.forEach(t => chips.appendChild(makeChip(t)));
    sec.appendChild(chips);
    wrap.appendChild(sec);
  });

  container.appendChild(wrap);

  // Arrow key navigation within chips; Space = native click (toggle)
  const allChips = Array.from(container.querySelectorAll('.tr-tag-chip'));
  if (allChips.length) {
    allChips[0].dataset.clCtrl = 'tag';   // primary focus target for ↓ from group tab
    allChips.forEach((chip, i) => {
      chip.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault(); allChips[(i + 1) % allChips.length].focus();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault(); allChips[(i - 1 + allChips.length) % allChips.length].focus();
        }
        // Tab/Shift+Tab: panel capture handles group switching
        // Space: browser fires click natively → toggles chip
      });
    });
  }
}

```
