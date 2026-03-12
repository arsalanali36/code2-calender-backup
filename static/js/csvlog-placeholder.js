/**
 * @fileoverview csvlog-placeholder.js
 * @description Placeholder trade management for CSVLog modal.
 *   - Create placeholder entries (x1, x2, ...) for dates with no real trades
 *   - Auto-protects data: even half-filled entries are persisted
 *   - Right-click any placeholder tab → context menu to merge into a real trade
 *   All functions are global scope — called from csvlog.js / csvlog-fields.js.
 */

/* ── Offer placeholder creation (called when user picks a date with no trades) */
function _offerPlaceholder(dateKey) {
  // Small custom dialog instead of native confirm so we can style it
  const existing = document.getElementById('cl-ph-dialog');
  if (existing) existing.remove();

  const dlg = document.createElement('div');
  dlg.id = 'cl-ph-dialog';
  dlg.className = 'cl-ph-dialog';
  dlg.innerHTML = `
    <div class="cl-ph-dlg-box">
      <div class="cl-ph-dlg-title">&#128203; No trades for <b>${dateKey}</b></div>
      <div class="cl-ph-dlg-body">Create a placeholder entry to fill in observations now?<br>
        <span class="cl-ph-dlg-hint">You can merge it into a real trade later (right-click the tab).</span>
      </div>
      <div class="cl-ph-dlg-btns">
        <button class="btn btn-primary" id="cl-ph-dlg-yes">Yes — create x1</button>
        <button class="btn btn-outline" id="cl-ph-dlg-no">No</button>
      </div>
    </div>
  `;
  document.body.appendChild(dlg);

  dlg.querySelector('#cl-ph-dlg-yes').addEventListener('click', () => {
    dlg.remove();
    _createPlaceholderTrade(dateKey, 1);
  });
  dlg.querySelector('#cl-ph-dlg-no').addEventListener('click', () => dlg.remove());
}

/* ── Create a placeholder trade and open/reload the modal ─────────────────── */
async function _createPlaceholderTrade(dateKey, num) {
  const label = 'x' + num;
  const placeholder = {
    Date: dateKey,
    _placeholder: true,
    _placeholderLabel: label,
    csvlog: {}
  };
  state.trades.push(placeholder);
  await _clPersistNow();

  const panelOpen = !!document.getElementById('cl-panel');

  if (panelOpen) {
    _loadDateIntoModal(dateKey);
    // Switch to the new placeholder tab (last one)
    _clTab = _clDayTrades.length - 1;
    _renderTradeTabs();
    _renderContent();
  } else {
    // Modal not open — open it
    _clTab = 0;
    _clGroupTab = {};
    if (!_clSchema) {
      csvlogService.getSchema().then(s => {
        if (!s || s.error) { _openWithNoSchema(); return; }
        _clSchema = s;
        _buildAndOpen(dateKey);
      }).catch(() => _buildAndOpen(dateKey));
    } else {
      _buildAndOpen(dateKey);
    }
  }
}

/* ── Add another placeholder for the currently-open date ─────────────────── */
async function _addAnotherPlaceholder() {
  if (!_clDayTrades.length) return;
  const dateKey = normalizeDate(
    _clDayTrades[0].trade['trade_date'] || _clDayTrades[0].trade['Date'] || _clDayTrades[0].trade.date || ''
  );

  // Find the highest x-number already used for this date
  const allPh = state.trades.filter(t =>
    normalizeDate(t['trade_date'] || t['Date'] || t.date || '') === dateKey && t._placeholder
  );
  const maxNum = allPh.reduce((m, t) => {
    const n = parseInt((t._placeholderLabel || 'x0').replace('x', '')) || 0;
    return Math.max(m, n);
  }, 0);

  const label = 'x' + (maxNum + 1);
  const placeholder = {
    Date: dateKey,
    _placeholder: true,
    _placeholderLabel: label,
    csvlog: {}
  };
  state.trades.push(placeholder);
  await _clPersistNow();

  _loadDateIntoModal(dateKey);
  _clTab = _clDayTrades.length - 1;
  _renderTradeTabs();
  _renderContent();
}

/* ── Right-click context menu on a placeholder tab ───────────────────────── */
function _showPlaceholderContextMenu(e, tradeEntry, tabBtn) {
  e.preventDefault();
  document.getElementById('cl-ph-menu')?.remove();

  const dateKey = normalizeDate(
    tradeEntry.trade['trade_date'] || tradeEntry.trade['Date'] || tradeEntry.trade.date || ''
  );
  const phLabel = tradeEntry.trade._placeholderLabel || 'x?';

  // Real trades = same date, not placeholder
  const realTrades = state.trades
    .map((t, i) => ({ trade: t, rowIdx: i }))
    .filter(({ trade: t }) =>
      normalizeDate(t['trade_date'] || t['Date'] || t.date || '') === dateKey && !t._placeholder
    );

  const menu = document.createElement('div');
  menu.id = 'cl-ph-menu';
  menu.className = 'cl-ph-ctx-menu';

  const hdr = document.createElement('div');
  hdr.className = 'cl-ph-ctx-header';
  hdr.textContent = `Merge "${phLabel}" with real trade:`;
  menu.appendChild(hdr);

  if (!realTrades.length) {
    const empty = document.createElement('div');
    empty.className = 'cl-ph-ctx-empty';
    empty.textContent = 'No real trades for this date yet';
    menu.appendChild(empty);
  } else {
    realTrades.forEach(({ trade, rowIdx }, ri) => {
      const instr   = trade['Instrument'] || trade['instrument'] || ('Trade ' + (ri + 1));
      const pnlRaw  = trade['Net P/L'] || trade['Gross P/L'] || trade['Rs'] || trade['rs'] || '';
      const pnlNum  = parseFloat(String(pnlRaw).replace(/,/g, ''));
      const pnlStr  = pnlRaw ? ` (${!isNaN(pnlNum) && pnlNum > 0 ? '+' : ''}${pnlRaw})` : '';
      const time    = trade['Buy Time'] || trade['buy_time'] || trade['Time'] || '';
      const timeStr = time ? ` @ ${time}` : '';

      const item = document.createElement('button');
      item.className = 'cl-ph-ctx-item';
      item.textContent = `${instr}${timeStr}${pnlStr}`;
      if (!isNaN(pnlNum) && pnlNum < 0) item.style.color = 'var(--red)';
      if (!isNaN(pnlNum) && pnlNum > 0) item.style.color = 'var(--green)';

      item.addEventListener('click', () => {
        menu.remove();
        _mergePlaceholderToReal(tradeEntry.rowIdx, rowIdx, phLabel, instr);
      });
      menu.appendChild(item);
    });
  }

  // Separator + delete option
  const sep = document.createElement('div');
  sep.className = 'cl-ph-ctx-sep';
  menu.appendChild(sep);

  const delItem = document.createElement('button');
  delItem.className = 'cl-ph-ctx-item cl-ph-ctx-delete';
  delItem.textContent = '✕ Delete this placeholder';
  delItem.addEventListener('click', () => {
    menu.remove();
    _deletePlaceholder(tradeEntry.rowIdx, phLabel, dateKey);
  });
  menu.appendChild(delItem);

  // Position below the tab
  const rect = tabBtn.getBoundingClientRect();
  menu.style.left = rect.left + 'px';
  menu.style.top  = (rect.bottom + 4) + 'px';
  document.body.appendChild(menu);

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function _closeCtx(ev) {
      if (!menu.contains(ev.target)) {
        menu.remove();
        document.removeEventListener('click', _closeCtx);
      }
    });
  }, 10);
}

/* ── Merge placeholder csvlog data into a real trade ────────────────────────*/
async function _mergePlaceholderToReal(phRowIdx, realRowIdx, phLabel, realLabel) {
  if (!confirm(`Move "${phLabel}" logger data into "${realLabel}"?\n\nThe placeholder will be deleted.`)) return;

  const phTrade   = state.trades[phRowIdx];
  const realTrade = state.trades[realRowIdx];
  if (!phTrade || !realTrade) { showToast('Trade not found', 'error'); return; }

  // Copy csvlog groups from placeholder → real trade (additive, don't overwrite existing)
  if (!realTrade.csvlog) realTrade.csvlog = {};
  for (const [grp, fields] of Object.entries(phTrade.csvlog || {})) {
    if (!realTrade.csvlog[grp]) realTrade.csvlog[grp] = {};
    // Only copy keys that aren't already filled in the real trade
    for (const [k, v] of Object.entries(fields)) {
      if (!realTrade.csvlog[grp][k]) realTrade.csvlog[grp][k] = v;
    }
  }

  // Delete placeholder
  state.trades.splice(phRowIdx, 1);
  await _clPersistNow();
  showToast(`"${phLabel}" merged into ${realLabel}`, 'success');

  // Reload the date (rowIdx may have shifted after splice)
  const dateKey = normalizeDate(realTrade['trade_date'] || realTrade['Date'] || realTrade.date || '');
  _loadDateIntoModal(dateKey);
  _clTab = -1;
  _renderTradeTabs();
  _renderContent();
}

/* ── Delete a placeholder ────────────────────────────────────────────────── */
async function _deletePlaceholder(rowIdx, label, dateKey) {
  if (!confirm(`Delete placeholder "${label}"?\n\nAll data entered in it will be lost.`)) return;

  state.trades.splice(rowIdx, 1);
  await _clPersistNow();
  showToast(`Placeholder "${label}" deleted`, 'info');

  // Check if any trades remain for this date
  const remaining = state.trades.filter(t =>
    normalizeDate(t['trade_date'] || t['Date'] || t.date || '') === dateKey
  );

  if (remaining.length) {
    _loadDateIntoModal(dateKey);
    _clTab = -1;
    _renderTradeTabs();
    _renderContent();
  } else {
    closeCsvLogModal();
  }
}
