# JS - Trade Tools (review, sidebar, logger, tag-pins)
Consolidated code context for AI assistants.


## File: `static/js/trade-review.js`
```js
/**
 * @fileoverview trade-review.js
 * @description Trade Review popup — folder-style tabs (one per trade per day),
 *              4 blocks: Dashboard, Setup, Tags, Emotion Sliders.
 * @exports openTradeReview, closeTradeReview, openTradeReviewFromToolbar
 */

let _trBackdrop = null;
let _trTab = 0;
let _trTagGrpTab = 0;
let _trTagDelMode = false;
let _trTagChipSize = 0.78; // rem
let _trDayTrades = []; // [{trade, rowIdx}]

// ── Toolbar entry point ───────────────────────────────────────────────────────
function openTradeReviewFromToolbar() {
  const filtered = getFilteredTrades ? getFilteredTrades() : state.trades;
  if (!filtered.length) { showToast('No trades to review', 'error'); return; }
  const sorted = [...filtered].sort((a, b) => {
    const da = normalizeDate(a['trade_date'] || a['Date'] || a.date || '');
    const db = normalizeDate(b['trade_date'] || b['Date'] || b.date || '');
    return da < db ? 1 : da > db ? -1 : 0;
  });
  const rowIdx = state.trades.indexOf(sorted[0]);
  if (rowIdx >= 0) openTradeReview(rowIdx);
}

// ── Main open ────────────────────────────────────────────────────────────────
function openTradeReview(rowIdx) {
  closeTradeReview();

  const trade = state.trades[rowIdx];
  if (!trade) return;

  const dateKey = normalizeDate(trade['trade_date'] || trade['Date'] || trade.date || '');

  _trDayTrades = state.trades
    .map((t, i) => ({ trade: t, rowIdx: i }))
    .filter(({ trade: t }) =>
      normalizeDate(t['trade_date'] || t['Date'] || t.date || '') === dateKey
    );

  _trTab = Math.max(0, _trDayTrades.findIndex(x => x.rowIdx === rowIdx));
  _trTagGrpTab = 0;
  _trTagDelMode = false;
  window._trFlatMode = false; // Add this line to reset flat mode to off (so default is Grouped)

  // Backdrop — save on outside click
  _trBackdrop = document.createElement('div');
  _trBackdrop.className = 'tr-backdrop';
  _trBackdrop.addEventListener('click', e => {
    if (e.target === _trBackdrop) { saveTrades(); closeTradeReview(); }
  });

  const modal = document.createElement('div');
  modal.className = 'tr-modal';

  // ── Header with date navigation ───────────────────────────────────────────
  const hdr = document.createElement('div');
  hdr.className = 'tr-hdr';

  const hLeft = document.createElement('div');
  hLeft.className = 'tr-hdr-left';
  const title = document.createElement('span');
  title.className = 'tr-hdr-title';
  title.textContent = 'Trade Review';
  hLeft.appendChild(title);

  const dateNav = document.createElement('div');
  dateNav.className = 'tr-date-nav';
  dateNav.id = 'tr-date-nav';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'tr-date-arrow';
  prevBtn.textContent = '\u2039';
  prevBtn.title = 'Previous day';
  prevBtn.addEventListener('click', () => _trNavigateDate(-1));

  const dateLabel = document.createElement('span');
  dateLabel.className = 'tr-date-label';
  dateLabel.textContent = dateKey;

  const nextBtn = document.createElement('button');
  nextBtn.className = 'tr-date-arrow';
  nextBtn.textContent = '\u203a';
  nextBtn.title = 'Next day';
  nextBtn.addEventListener('click', () => _trNavigateDate(1));

  dateNav.appendChild(prevBtn);
  dateNav.appendChild(dateLabel);
  dateNav.appendChild(nextBtn);
  hLeft.appendChild(dateNav);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'tr-close';
  closeBtn.textContent = '\u2715';
  closeBtn.addEventListener('click', () => { saveTrades(); closeTradeReview(); });

  hdr.appendChild(hLeft);
  hdr.appendChild(closeBtn);
  modal.appendChild(hdr);

  // ── Trade tabs ────────────────────────────────────────────────────────────
  const tabBar = document.createElement('div');
  tabBar.className = 'tr-tabs';
  tabBar.id = 'tr-tabs';
  modal.appendChild(tabBar);

  // ── Content body ──────────────────────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'tr-body';
  body.id = 'tr-body';
  modal.appendChild(body);

  _trBackdrop.appendChild(modal);
  document.body.appendChild(_trBackdrop);

  _renderTrTabs();
  _renderTrContent();

  document.addEventListener('keydown', _trEscKey);
}

function _trEscKey(e) {
  if (e.key === 'Escape') { saveTrades(); closeTradeReview(); }
}

function closeTradeReview() {
  document.removeEventListener('keydown', _trEscKey);
  if (_trBackdrop) { _trBackdrop.remove(); _trBackdrop = null; }
  _trDayTrades = [];
  _trTagDelMode = false;
}

// ── Date navigation ───────────────────────────────────────────────────────────
function _trNavigateDate(dir) {
  const dates = [...new Set(
    state.trades.map(t => normalizeDate(t['trade_date'] || t['Date'] || t.date || ''))
  )].filter(Boolean).sort();

  const cur = _trDayTrades[0]
    ? normalizeDate(_trDayTrades[0].trade['trade_date'] || _trDayTrades[0].trade['Date'] || _trDayTrades[0].trade.date || '')
    : '';

  const idx = dates.indexOf(cur);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= dates.length) return;

  const newDate = dates[newIdx];
  const newTrade = state.trades.find(t =>
    normalizeDate(t['trade_date'] || t['Date'] || t.date || '') === newDate
  );
  if (!newTrade) return;
  openTradeReview(state.trades.indexOf(newTrade));
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function _renderTrTabs() {
  const bar = document.getElementById('tr-tabs');
  if (!bar) return;
  bar.innerHTML = '';

  const glCol = state.columns.find(c => /net\s*p\/l/i.test(c))
    || state.columns.find(c => /^rs$/i.test(c));

  _trDayTrades.forEach(({ trade }, i) => {
    const tab = document.createElement('button');
    const isActive = i === _trTab;
    tab.className = 'tr-tab' + (isActive ? ' tr-tab-active' : '');
    tab.textContent = 'T' + (i + 1);

    // Color by P/L
    const pl = glCol ? parseFloat(trade[glCol]) : NaN;
    if (!isNaN(pl) && !isActive) {
      tab.style.borderColor = pl >= 0 ? 'var(--green)' : 'var(--red)';
      tab.style.color = pl >= 0 ? 'var(--green)' : 'var(--red)';
    } else if (!isNaN(pl) && isActive) {
      // Active tab: show colored bottom indicator
      tab.dataset.pl = pl >= 0 ? 'pos' : 'neg';
    }

    tab.addEventListener('click', () => {
      _trTab = i;
      _trTagGrpTab = 0;
      _renderTrTabs();
      _renderTrContent();
    });
    bar.appendChild(tab);
  });
}

// ── Content ───────────────────────────────────────────────────────────────────
function _renderTrContent() {
  const body = document.getElementById('tr-body');
  if (!body) return;
  body.innerHTML = '';

  const { trade } = _trDayTrades[_trTab];
  if (!trade.tradeReview) {
    trade.tradeReview = { targ: '', sl: '', runnup: '', dd: '', tags: [], tagSliders: {} };
  }
  const rv = trade.tradeReview;

  // Sync tags from main column to tradeReview
  const mainTags = window.getTradeTagsForColumn ? getTradeTagsForColumn(trade, 'Tags') : (trade['Tags'] || trade.tags || []);
  if (!rv.tags) rv.tags = [];
  mainTags.forEach(t => {
    if (!rv.tags.includes(t)) rv.tags.push(t);
  });

  if (!rv.tagSliders) rv.tagSliders = {};

  const _fmt = val => {
    if (val === undefined || val === null || String(val).trim() === '') return '\u2014';
    const n = parseFloat(val);
    if (!isNaN(n)) return n % 1 === 0 ? String(n) : n.toFixed(2);
    return String(val);
  };

  // ── Block 1: Dashboard ───────────────────────────────────────────────────
  const b1 = _trBlock('Dashboard');
  const ptCol = state.columns.find(c => /^pt$/i.test(c));
  const glCol = state.columns.find(c => /net\s*p\/l/i.test(c))
    || state.columns.find(c => /^rs$/i.test(c));
  const lotCol = state.columns.find(c => /^qty$|^lot$/i.test(c))
    || state.columns.find(c => /quantity/i.test(c));

  const dashStats = [
    { lbl: 'PT', val: ptCol ? trade[ptCol] : null },
    { lbl: 'Gain / Loss', val: glCol ? trade[glCol] : null },
    { lbl: 'Lot / Qty', val: lotCol ? trade[lotCol] : null }
  ];

  const statsRow = document.createElement('div');
  statsRow.className = 'tr-dash-row';
  dashStats.forEach(({ lbl, val }) => {
    const box = document.createElement('div');
    box.className = 'tr-dash-box';
    const l = document.createElement('div');
    l.className = 'tr-dash-lbl';
    l.textContent = lbl;
    const v = document.createElement('div');
    v.className = 'tr-dash-val';
    v.textContent = _fmt(val);
    const n = parseFloat(val);
    if ((lbl === 'PT' || lbl === 'Gain / Loss') && !isNaN(n)) {
      v.style.color = n >= 0 ? 'var(--green)' : 'var(--red)';
    }
    box.appendChild(l);
    box.appendChild(v);
    statsRow.appendChild(box);
  });
  b1.body.appendChild(statsRow);
  body.appendChild(b1.el);

  // ── Block 2: Setup ───────────────────────────────────────────────────────
  const b2 = _trBlock('Setup');
  const setupFields = [
    { key: 'targ', lbl: 'Target' },
    { key: 'sl', lbl: 'SL' },
    { key: 'runnup', lbl: 'Run-up' },
    { key: 'dd', lbl: 'DD' }
  ];
  const fieldRow = document.createElement('div');
  fieldRow.className = 'tr-field-row4';
  setupFields.forEach(({ key, lbl }) => {
    const cell = document.createElement('div');
    cell.className = 'tr-field-cell';
    const label = document.createElement('label');
    label.className = 'tr-field-lbl';
    label.textContent = lbl;
    const inp = document.createElement('input');
    inp.className = 'tr-field-inp';
    inp.type = 'text';
    inp.value = rv[key] || '';
    inp.placeholder = '0';
    inp.addEventListener('change', () => { rv[key] = inp.value; saveTrades(); });
    cell.appendChild(label);
    cell.appendChild(inp);
    fieldRow.appendChild(cell);
  });
  b2.body.appendChild(fieldRow);
  body.appendChild(b2.el);

  // ── Block 3: Tags — folder tabs + controls ───────────────────────────────
  const b3 = _trBlock('Tags');

  // Controls row in head
  const b3Controls = document.createElement('div');
  b3Controls.className = 'tr-tag-controls';

  // A- / A+
  const aMinus = document.createElement('button');
  aMinus.className = 'tr-tag-ctrl-btn';
  aMinus.textContent = 'A\u207b';
  aMinus.title = 'Smaller chips';
  aMinus.addEventListener('click', () => {
    _trTagChipSize = Math.max(0.6, _trTagChipSize - 0.06);
    _renderTrContent();
  });
  const aPlus = document.createElement('button');
  aPlus.className = 'tr-tag-ctrl-btn';
  aPlus.textContent = 'A\u207a';
  aPlus.title = 'Larger chips';
  aPlus.addEventListener('click', () => {
    _trTagChipSize = Math.min(1.1, _trTagChipSize + 0.06);
    _renderTrContent();
  });

  // Helper for custom modal prompt
  const _showPromptDialog = (titleText, inputs, onSave) => {
    const dialog = document.createElement('div');
    dialog.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius);padding:15px;z-index:3000;box-shadow:0 10px 40px rgba(0,0,0,0.8);width:280px;';

    const title = document.createElement('h4');
    title.textContent = titleText;
    title.style.cssText = 'margin:0 0 12px 0;font-size:0.9rem;color:var(--text);';
    dialog.appendChild(title);

    const inputEls = {};
    inputs.forEach(inp => {
      if (inp.type === 'select') {
        const sel = document.createElement('select');
        sel.style.cssText = 'width:100%;margin-bottom:12px;padding:6px;background:var(--bg);border:1px solid var(--border2);color:var(--text);border-radius:4px;';
        inp.options.forEach(opt => {
          const o = document.createElement('option');
          o.value = opt.value; o.textContent = opt.label;
          sel.appendChild(o);
        });
        dialog.appendChild(sel);
        inputEls[inp.id] = sel;
      } else {
        const el = document.createElement('input');
        el.type = 'text';
        el.placeholder = inp.placeholder;
        el.style.cssText = 'width:100%;margin-bottom:12px;padding:6px;background:var(--bg);border:1px solid var(--border2);color:var(--text);border-radius:4px;';
        dialog.appendChild(el);
        inputEls[inp.id] = el;
      }
    });

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'tr-tag-ctrl-btn';
    cancelBtn.onclick = () => dialog.remove();

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.className = 'tr-tag-ctrl-btn';
    saveBtn.style.color = 'var(--blue)';
    saveBtn.onclick = () => {
      onSave(inputEls);
      dialog.remove();
    };

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    dialog.appendChild(btnRow);
    document.body.appendChild(dialog);
    if (inputs.length) inputEls[inputs[0].id].focus();
  };

  // + Group
  const addGrpBtn = document.createElement('button');
  addGrpBtn.className = 'tr-tag-ctrl-btn';
  addGrpBtn.textContent = '+ Group';
  addGrpBtn.title = 'Create new tag group';
  addGrpBtn.addEventListener('click', () => {
    _showPromptDialog('New Group', [{ id: 'name', type: 'text', placeholder: 'Group Name' }], (els) => {
      const n = els.name.value.trim();
      if (!n) return;
      if (!state.tagGroups[n]) {
        state.tagGroups[n] = [];
        saveTagGroups();
        _trTagGrpTab = Object.keys(state.tagGroups).length - 1;
        _renderTrContent();
      }
    });
  });

  // + Tag
  const addTagBtn = document.createElement('button');
  addTagBtn.className = 'tr-tag-ctrl-btn';
  addTagBtn.textContent = '+ Tag';
  addTagBtn.title = 'Create new tag in current group';
  addTagBtn.addEventListener('click', () => {
    const grpOtps = [{ value: '', label: '-- No Group (Other) --' }];
    Object.keys(state.tagGroups).filter(k => state.tagGroups[k]).forEach(g => grpOtps.push({ value: g, label: g }));

    _showPromptDialog('Add New Tag', [
      { id: 'tagName', type: 'text', placeholder: 'Tag name...' },
      { id: 'group', type: 'select', options: grpOtps }
    ], (els) => {
      const n = els.tagName.value.trim();
      if (!n) return;
      const g = els.group.value;
      const nLower = n.toLowerCase();

      // Case-insensitive check to avoid duplicate tag creation
      const existing = state.allTags.find(t => t.toLowerCase() === nLower);
      const tagToUse = existing || n;

      if (!existing) state.allTags.push(n);
      if (g) {
        if (!state.tagGroups[g]) state.tagGroups[g] = [];
        if (!state.tagGroups[g].includes(tagToUse)) state.tagGroups[g].push(tagToUse);
      }
      saveTagGroups();

      // Auto-select the newly created/added tag
      if (!rv.tags.includes(tagToUse)) {
        rv.tags.push(tagToUse);
        const trd = state.trades[_trDayTrades[_trTab].rowIdx];
        if (trd) {
          trd['Tags'] = [...rv.tags];
          trd['tags'] = [...rv.tags];
        }
        if (rv.tagSliders[tagToUse] === undefined) rv.tagSliders[tagToUse] = 0;
        saveTrades();
        if (typeof renderTable === 'function') renderTable();
      }
      _renderTrContent();
    });
  });

  // Del toggle
  const delBtn = document.createElement('button');
  delBtn.className = 'tr-tag-ctrl-btn' + (_trTagDelMode ? ' tr-tag-ctrl-del-on' : '');
  delBtn.textContent = 'Del';
  delBtn.title = _trTagDelMode ? 'Click tags to delete (active)' : 'Toggle delete mode';
  delBtn.addEventListener('click', () => {
    _trTagDelMode = !_trTagDelMode;
    _renderTrContent();
  });

  // Flat Mode Toggle
  const flatToggleBtn = document.createElement('button');
  flatToggleBtn.className = 'tr-tag-ctrl-btn';
  flatToggleBtn.textContent = window._trFlatMode ? 'Grouped' : 'Flat';
  flatToggleBtn.title = 'Toggle tag grouping';
  flatToggleBtn.addEventListener('click', () => {
    window._trFlatMode = !window._trFlatMode;
    _renderTrContent();
  });

  b3Controls.appendChild(aMinus);
  b3Controls.appendChild(aPlus);
  b3Controls.appendChild(addGrpBtn);
  b3Controls.appendChild(addTagBtn);
  b3Controls.appendChild(delBtn);
  b3Controls.appendChild(flatToggleBtn);
  b3.head.appendChild(b3Controls);

  // Build groups list
  const groupedTagSet = new Set(Object.values(state.tagGroups).flat());
  const ungroupedTags = state.allTags.filter(t => t && !groupedTagSet.has(t));
  const tagGroups3 = Object.entries(state.tagGroups)
    .filter(([, tags]) => tags && tags.length)
    .map(([name, tags]) => ({ name, tags: tags.filter(Boolean) }));
  if (ungroupedTags.length) tagGroups3.push({ name: 'Other', tags: ungroupedTags });

  const makeChip = tag => {
    const c = tagColor(tag);
    const isOn = rv.tags.includes(tag);
    const chip = document.createElement('button');
    chip.className = 'tr-tag-chip' + (isOn ? ' on' : '') + (_trTagDelMode ? ' del-mode' : '');
    chip.textContent = _trTagDelMode ? (tag + ' \u00d7') : tag;
    chip.style.fontSize = _trTagChipSize + 'rem';
    if (isOn && !_trTagDelMode) {
      chip.style.cssText += ';color:' + c + ';background:' + hexToRgba(c, 0.25) + ';border-color:' + hexToRgba(c, 0.7);
    }
    chip.addEventListener('click', () => {
      if (_trTagDelMode) {
        state.allTags = state.allTags.filter(t => t !== tag);
        Object.keys(state.tagGroups).forEach(g => {
          state.tagGroups[g] = (state.tagGroups[g] || []).filter(t => t !== tag);
        });
        rv.tags = rv.tags.filter(t => t !== tag);
        trade['Tags'] = [...rv.tags];
        trade['tags'] = [...rv.tags];
        delete rv.tagSliders[tag];
        saveTagGroups();
        saveTrades();
        _renderTrContent();
        if (typeof renderTable === 'function') renderTable();
      } else {
        if (rv.tags.includes(tag)) {
          rv.tags = rv.tags.filter(t => t !== tag);
          trade['Tags'] = [...rv.tags];
          trade['tags'] = [...rv.tags];
          delete rv.tagSliders[tag];
        } else {
          rv.tags.push(tag);
          trade['Tags'] = [...rv.tags];
          trade['tags'] = [...rv.tags];
          if (rv.tagSliders[tag] === undefined) rv.tagSliders[tag] = 0;
        }
        saveTrades();
        _renderTrContent();
        if (typeof renderTable === 'function') renderTable();
      }
    });
    return chip;
  };

  // Count occurrences of tags in all selected/filtered trades
  const tagCounts = {};
  (window.getFilteredTrades ? getFilteredTrades() : state.trades).forEach(t => {
    const rvTags = t.tradeReview?.tags || [];
    rvTags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  const makeChipWithCount = tag => {
    const chip = makeChip(tag);
    const c = tagCounts[tag] || 0;
    if (c > 0) {
      const span = document.createElement('span');
      span.className = 'tr-tag-count';
      span.textContent = c;
      chip.appendChild(span);
    }
    return chip;
  };

  if (!tagGroups3.length) {
    const hint = document.createElement('p');
    hint.className = 'tr-hint';
    hint.textContent = 'No tags yet. Use + Group / + Tag above.';
    b3.body.appendChild(hint);
  } else if (window._trFlatMode) {
    // Flat Layout (No Groups)
    const flatWrap = document.createElement('div');
    flatWrap.className = 'tr-tag-flat-wrap';

    const allUniqueTags = [...new Set(tagGroups3.flatMap(g => g.tags))].sort((a, b) => {
      const countA = tagCounts[a] || 0;
      const countB = tagCounts[b] || 0;
      if (countB !== countA) return countB - countA;
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });

    allUniqueTags.forEach(tag => {
      flatWrap.appendChild(makeChipWithCount(tag));
    });
    b3.body.appendChild(flatWrap);
  } else {
    // Columnar layout: one column per group, all visible side-by-side with scroll
    const colsOuter = document.createElement('div');
    colsOuter.className = 'tr-tag-cols-wrap';
    const colsWrap = document.createElement('div');
    colsWrap.className = 'tr-tag-cols';
    tagGroups3.forEach(({ name, tags }) => {
      const col = document.createElement('div');
      col.className = 'tr-tag-col';
      const colHdr = document.createElement('div');
      colHdr.className = 'tr-tag-col-hdr';
      colHdr.textContent = name;
      col.appendChild(colHdr);

      const tagGrid = document.createElement('div');
      tagGrid.className = 'tr-tag-grid';
      tags.forEach(tag => tagGrid.appendChild(makeChipWithCount(tag)));
      col.appendChild(tagGrid);

      colsWrap.appendChild(col);
    });
    colsOuter.appendChild(colsWrap);
    b3.body.appendChild(colsOuter);
  }
  body.appendChild(b3.el);

  // ── Block 4: Emotion Sliders ─────────────────────────────────────────────
  const b4 = _trBlock('Emotion Sliders');
  if (!window._trSliderLayout) window._trSliderLayout = 'vertical';

  const acts = document.createElement('div');
  acts.className = 'tr-acts-right';
  const togLayout = document.createElement('button');
  togLayout.type = 'button';
  togLayout.className = 'tr-btn-minor';
  togLayout.textContent = window._trSliderLayout === 'vertical' ? 'Horizontal Mode' : 'Vertical Mode';
  togLayout.addEventListener('click', (e) => {
    e.stopPropagation();
    window._trSliderLayout = window._trSliderLayout === 'vertical' ? 'horizontal' : 'vertical';
    _renderTrContent();
  });
  acts.appendChild(togLayout);
  b4.head.appendChild(acts);

  if (!rv.tags.length) {
    const hint = document.createElement('p');
    hint.className = 'tr-hint';
    hint.textContent = 'Select tags above to activate sliders.';
    b4.body.appendChild(hint);
  } else {
    const list = document.createElement('div');
    list.className = 'tr-slider-list layout-' + window._trSliderLayout;
    rv.tags.forEach(tag => {
      const c = tagColor(tag);
      const curVal = rv.tagSliders[tag] !== undefined ? rv.tagSliders[tag] : 0;
      const row = document.createElement('div');
      row.className = 'tr-slider-row';
      const lbl = document.createElement('span');
      lbl.className = 'tr-sl-lbl';
      lbl.textContent = tag;
      lbl.style.color = c;
      const wrap = document.createElement('div');
      wrap.className = 'tr-sl-wrap';
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'tr-slider';
      slider.min = -100; slider.max = 100; slider.step = 1; slider.value = curVal;
      slider.style.setProperty('--sl-color', c);
      const valSpan = document.createElement('span');
      valSpan.className = 'tr-sl-val';
      valSpan.textContent = curVal > 0 ? ('+' + curVal) : curVal;
      valSpan.style.color = curVal > 0 ? 'var(--green)' : curVal < 0 ? 'var(--red)' : 'var(--text2)';
      slider.addEventListener('input', () => {
        const v = parseInt(slider.value);
        rv.tagSliders[tag] = v;
        valSpan.textContent = v > 0 ? ('+' + v) : v;
        valSpan.style.color = v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--text2)';
      });
      slider.addEventListener('change', () => saveTrades());

      if (window._trSliderLayout === 'horizontal') {
        wrap.appendChild(slider);
        row.appendChild(lbl);
        row.appendChild(wrap);
        row.appendChild(valSpan);
      } else {
        wrap.appendChild(valSpan);
        wrap.appendChild(slider);
        row.appendChild(lbl);
        row.appendChild(wrap);
      }
      list.appendChild(row);
    });
    b4.body.appendChild(list);
  }
  body.appendChild(b4.el);
}

function _trBlock(title) {
  const el = document.createElement('div');
  el.className = 'tr-block';
  const head = document.createElement('div');
  head.className = 'tr-block-head';
  const titleSpan = document.createElement('span');
  titleSpan.textContent = title;
  head.appendChild(titleSpan);
  const body = document.createElement('div');
  body.className = 'tr-block-body';
  el.appendChild(head);
  el.appendChild(body);
  return { el, head, body };
}

```

## File: `static/js/trade-sidebar.js`
```js
/* trade-sidebar.js - Logic for Trade Thumbnails Side Panel */

(function() {
    const ts = {
        overlay: null,
        body: null,
        title: null,
        grid: null,
        resizer: null,
        isOpen: false,
        currentTrade: null,
        currentWidth: 400,
        thumbSize: 180
    };

    function _initRefs() {
        ts.overlay = document.getElementById('trade-sidebar-overlay');
        ts.body    = document.getElementById('trade-sidebar-body');
        ts.title   = document.getElementById('trade-sidebar-title');
        ts.grid    = document.getElementById('trade-sidebar-grid');
        ts.resizer = document.getElementById('trade-sidebar-resizer');
        ts.slider  = document.getElementById('ts-size-slider');
    }

    function initTradeSidebar() {
        // Create sidebar if it doesn't exist
        if (!document.getElementById('trade-sidebar-overlay')) {
            const html = `
                <div class="trade-sidebar-overlay" id="trade-sidebar-overlay">
                    <div class="trade-sidebar-resizer" id="trade-sidebar-resizer"></div>
                    <div class="trade-sidebar-header" id="trade-sidebar-header">
                        <div style="flex:1; min-width:0;">
                            <div class="trade-sidebar-title" id="trade-sidebar-title">Trade Thumbnails</div>
                            <div id="ts-header-details" style="display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:5px;font-size:0.78rem;color:#8b949e;line-height:1.4;"></div>
                        </div>
                        <button class="trade-sidebar-close" id="trade-sidebar-close">✕</button>
                    </div>
                    <div class="trade-sidebar-body" id="trade-sidebar-body">
                        <div class="trade-sidebar-grid" id="trade-sidebar-grid"></div>
                    </div>
                    <div class="ts-controls">
                        <span style="font-size:0.75rem; color:#8b949e;">Size:</span>
                        <input type="range" class="ts-size-slider" id="ts-size-slider" min="60" max="400" value="120">
                        <span class="ts-size-label" id="ts-size-label">180px</span>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
        }

        _initRefs();

        const closeBtn = document.getElementById('trade-sidebar-close');
        if (closeBtn) {
            closeBtn.onclick = () => toggleTradeSidebar(false);
        }

        // Resizing Sidebar (mouse + touch for iPad)
        if (ts.resizer) {
            let isResizing = false;

            const startResize = () => {
                isResizing = true;
                document.body.style.cursor = 'ew-resize';
            };
            const doResize = (clientX) => {
                if (!isResizing) return;
                const newWidth = window.innerWidth - clientX;
                const minW = Math.min(280, window.innerWidth * 0.4);
                const maxW = Math.max(window.innerWidth * 0.9, 600);
                if (newWidth >= minW && newWidth <= maxW) {
                    ts.currentWidth = newWidth;
                    ts.overlay.style.width = ts.currentWidth + 'px';
                    localStorage.setItem('tj_ts_width', ts.currentWidth);
                }
            };
            const endResize = () => {
                if (isResizing) { isResizing = false; document.body.style.cursor = ''; }
            };

            ts.resizer.addEventListener('mousedown', (e) => { startResize(); e.preventDefault(); });
            ts.resizer.addEventListener('touchstart', (e) => { startResize(); }, { passive: true });
            window.addEventListener('mousemove', (e) => doResize(e.clientX));
            window.addEventListener('touchmove', (e) => { if (isResizing) doResize(e.touches[0].clientX); }, { passive: true });
            window.addEventListener('mouseup', endResize);
            window.addEventListener('touchend', endResize);

            // Vertical Touch Resizer for iPad
            const _isTouch = (typeof IS_TOUCH_DEVICE !== 'undefined' && IS_TOUCH_DEVICE) || (navigator.maxTouchPoints > 0) || (window.innerWidth < 1100 && navigator.maxTouchPoints > 0);
            if (_isTouch) {
                document.documentElement.classList.add('is-touch');
                document.body.classList.add('is-touch');
                if (!ts.overlay.dataset.hasResizer) {
                    let vResizer = document.createElement('div');
                    vResizer.className = 'gv2-touch-resizer';
                    vResizer.style.left = '4px'; // Edge for right-side sidebar
                    vResizer.style.right = 'auto';
                    vResizer.innerHTML = '<div class="gv2-touch-resizer-handle"></div><div class="gv2-touch-resizer-label">Width: 0px</div>';
                    ts.overlay.appendChild(vResizer);
                    ts.overlay.dataset.hasResizer = 'true';

                    const label = vResizer.querySelector('.gv2-touch-resizer-label');
                    let _tResizing = false, _startY = 0, _startW_T = 0;

                    vResizer.addEventListener('touchstart', (e) => {
                        _tResizing = true;
                        _startY = e.touches[0].clientY;
                        _startW_T = ts.overlay.offsetWidth;
                        e.stopPropagation();
                    }, { passive: true });

                    window.addEventListener('touchmove', (e) => {
                        if (!_tResizing) return;
                        const dy = e.touches[0].clientY - _startY;
                        const newWidth = _startW_T - dy * 1.5; // Multiplier for better feel
                        const minW = 280, maxW = window.innerWidth * 0.9;
                        if (newWidth >= minW && newWidth <= maxW) {
                            ts.currentWidth = newWidth;
                            ts.overlay.style.width = ts.currentWidth + 'px';
                            if (label) label.textContent = `Width: ${Math.round(ts.currentWidth)}px`;
                            localStorage.setItem('tj_ts_width', ts.currentWidth);
                        }
                        if (e.cancelable) e.preventDefault();
                    }, { passive: false });

                    window.addEventListener('touchend', () => { _tResizing = false; });
                    vResizer.style.display = 'flex';
                }
            }
        }

        // Thumbnail Sizer
        if (ts.slider) {
            ts.slider.oninput = (e) => {
                ts.thumbSize = parseInt(e.target.value);
                _applyThumbSize();
            };
        }

        // Load saved state
        const savedWidth = localStorage.getItem('tj_ts_width');
        if (savedWidth) ts.currentWidth = parseInt(savedWidth);

        const savedThumbSz = localStorage.getItem('tj_ts_thumbSz');
        if (savedThumbSz) {
            ts.thumbSize = parseInt(savedThumbSz);
            if (ts.slider) { ts.slider.value = ts.thumbSize; ts.slider.min = '60'; }
        }
    }

    function _applyThumbSize() {
        if (!ts.grid) return;
        ts.grid.style.setProperty('--thumb-size', ts.thumbSize + 'px');
        
        // Force single column if images are expanded significantly
        if (ts.thumbSize > 220) {
            ts.grid.style.gridTemplateColumns = '1fr';
        } else {
            ts.grid.style.gridTemplateColumns = ''; // Resets to CSS auto-fill
        }

        const lbl = document.getElementById('ts-size-label');
        if (lbl) lbl.textContent = ts.thumbSize + 'px';
        localStorage.setItem('tj_ts_thumbSz', ts.thumbSize);
    }

    function openTradeSidebar(trade) {
        if (!trade) return;
        // If user has disabled auto-open via the ··· toggle, silently skip
        if (window._tradeSidebarDisabled) return;
        ts.currentTrade = trade;
        
        if (!ts.overlay) initTradeSidebar();
        
        // Populate Title + header details
        const isDay = !!trade._dayTrades;
        const date = trade.trade_date || trade.Date || '';
        const inst = isDay ? (date || 'Day') : (trade.Instrument || trade.instrument || 'Trade').toUpperCase();
        if (ts.title) ts.title.textContent = inst;

        const detailEl = document.getElementById('ts-header-details');
        if (detailEl) {
            const chip = (label, val, cls='') =>
                `<span style="background:rgba(255,255,255,0.06);border-radius:4px;padding:1px 6px;"><span style="color:#8b949e;">${label}: </span><span class="${cls}" style="color:#cdd9e5;font-weight:600;">${val}</span></span>`;

            if (isDay) {
                const dayTrades = trade._dayTrades;
                const totalPnl = dayTrades.reduce((s, t) => s + (typeof getTradePnl === 'function' ? (getTradePnl(t) || 0) : 0), 0);
                const pnlColor = totalPnl >= 0 ? '#3fb950' : '#f85149';
                const pnlStr = `<span style="color:${pnlColor};font-weight:700;">₹${Math.round(totalPnl).toLocaleString('en-IN')}</span>`;
                detailEl.innerHTML =
                    chip('Date', date) +
                    chip('Trades', dayTrades.length) +
                    `<span style="background:rgba(255,255,255,0.06);border-radius:4px;padding:1px 6px;"><span style="color:#8b949e;">P&L: </span>${pnlStr}</span>`;
            } else {
                const pnl = typeof getTradePnl === 'function' ? (getTradePnl(trade) || 0) : 0;
                const pnlColor = pnl >= 0 ? '#3fb950' : '#f85149';
                const pnlStr = `<span style="color:${pnlColor};font-weight:700;">₹${Math.round(pnl).toLocaleString('en-IN')}</span>`;
                const qty  = trade.Qty  || trade.quantity || '-';
                const pt   = trade.Pt   || trade.Points   || '-';
                const side = trade.Side || trade.Type     || trade.type || '';
                const enty = trade['Entry'] || trade['Buy Price']  || trade['Avg Buy'] || '';
                const exit = trade['Exit']  || trade['Sell Price'] || trade['Avg Sell']|| '';
                const lots = trade['Lots']  || trade['lots']       || '';
                let details = chip('Date', date);
                if (side) details += chip('Side', side);
                if (enty) details += chip('Entry', enty);
                if (exit) details += chip('Exit', exit);
                if (qty)  details += chip('Qty', qty);
                if (lots) details += chip('Lots', lots);
                if (pt && pt !== '-') details += chip('Pt', pt);
                details += `<span style="background:rgba(255,255,255,0.06);border-radius:4px;padding:1px 6px;"><span style="color:#8b949e;">P&L: </span>${pnlStr}</span>`;
                detailEl.innerHTML = details;
            }
        }

        // Populate Grid
        if (ts.grid) {
            ts.grid.innerHTML = '';
            const images = trade.images || [];
            if (images.length === 0) {
                ts.grid.innerHTML = '<div style="color:#8b949e; grid-column:1/-1; text-align:center; padding:40px;">No images found for this trade</div>';
            } else {
                images.forEach(url => {
                    const wrap = document.createElement('div');
                    wrap.className = 'ts-thumb-wrap';
                    
                    const img = document.createElement('img');
                    img.className = 'ts-thumb';
                    img.src = typeof resolveImageUrl === 'function' ? resolveImageUrl(url) : url;
                    img.loading = 'lazy';
                    
                    wrap.appendChild(img);

                    // --- Overlay Markers if this is a Close Global Image ---
                    const d = trade.trade_date || trade.Date || '';
                    if (d && state.dayData[d]) {
                        const dayData = state.dayData[d];
                        if (dayData.closeGlobalImages?.includes(url)) {
                            const posData = dayData.navPositions?.[url];
                            if (posData) {
                                Object.keys(posData).forEach(btnIdx => {
                                    const trList = typeof getTradesForDate === 'function' ? getTradesForDate(d) : [];
                                    const targetTr = trList[parseInt(btnIdx)];
                                    const pnl = targetTr ? parseFloat(targetTr['Net P/L'] || targetTr.net_pnl || 0) : 0;
                                    const color = pnl > 0 ? '#3fb950' : (pnl < 0 ? '#f85149' : '#58a6ff');

                                    const ov = document.createElement('div');
                                    ov.className = 'ts-marker-ovl';
                                    ov.textContent = parseInt(btnIdx) + 1;
                                    ov.style.position = 'absolute';
                                    ov.style.left = posData[btnIdx].left;
                                    ov.style.top = posData[btnIdx].top;
                                    ov.style.transform = 'translate(-50%, -50%)';
                                    ov.style.background = color;
                                    ov.style.color = '#fff';
                                    ov.style.borderRadius = '50%';
                                    ov.style.display = 'flex';
                                    ov.style.alignItems = 'center';
                                    ov.style.justifyContent = 'center';
                                    ov.style.fontSize = '8px';
                                    ov.style.fontWeight = 'bold';
                                    ov.style.width = '14px';
                                    ov.style.height = '14px';
                                    ov.style.border = '1px solid rgba(255,255,255,0.4)';
                                    ov.style.pointerEvents = 'none'; // So click goes to wrapper
                                    ov.style.zIndex = '5';
                                    wrap.appendChild(ov);
                                });
                            }
                        }
                    }
                    
                    wrap.onclick = () => {
                        if (typeof openGalleryForDate === 'function') {
                            const d = trade.trade_date || trade.Date || '';
                            openGalleryForDate(d, url);
                        }
                    };
                    
                    ts.grid.appendChild(wrap);
                });
            }
        }

        toggleTradeSidebar(true);
        _applyThumbSize();
    }

    function toggleTradeSidebar(show) {
        if (!ts.overlay) initTradeSidebar();
        ts.isOpen = show;
        ts.overlay.classList.toggle('open', show);
        if (show) {
            ts.overlay.style.width = ts.currentWidth + 'px';
        } else {
            ts.overlay.style.width = '0';
        }
    }

    // Export to window
    window.openTradeSidebar = openTradeSidebar;
    window.toggleTradeSidebar = toggleTradeSidebar;

    // Listen for Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && ts.isOpen) {
            toggleTradeSidebar(false);
        }
    });

})();

```

## File: `static/js/trade-logger-core.js`
```js
/**
 * @fileoverview trade-logger-core.js
 * @description Trade Logger — state, schema helpers, open/close/navigate/validate.
 *              Render functions live in trade-logger-render.js (loaded after this).
 */

let _tlBackdrop = null;
let _tlTab = 0;
let _tlDayTrades = [];

const TL_SCHEMA_VERSION = 2;

const TL_KEY_ALIASES = {
    en_sl10: ['en_sc10'],
    mgt_patience: ['en_patience'],
    mgt_conf: ['en_conf'],
    ex_nafs: ['en_nafs']
};

function parseTimeToMinutes(timeStr) {
    if (!timeStr) return null;
    const s = String(timeStr).trim();
    // Handles: "09:15", "09:15:30", "9:15 AM", "9:15 PM"
    const m = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const period = m[3] ? m[3].toUpperCase() : null;
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + min;
}

function _calcTradeDurationMinutes(trade) {
    if (!trade) return null;
    const directPairs = [
        [trade['Time'], trade['Ex Time']],
        [trade['Entry Time'], trade['Exit Time']],
        [trade['entry_time'], trade['exit_time']],
        [trade['entryTime'], trade['exitTime']]
    ];
    for (const [start, end] of directPairs) {
        const t1 = parseTimeToMinutes(start);
        const t2 = parseTimeToMinutes(end);
        if (t1 !== null && t2 !== null) return Math.abs(t2 - t1);
    }

    const buy = parseTimeToMinutes(trade['Buy Time'] || trade['buy_time'] || trade['buyTime']);
    const sell = parseTimeToMinutes(trade['Sell Time'] || trade['sell_time'] || trade['sellTime']);
    if (buy !== null && sell !== null) return Math.abs(sell - buy);

    return null;
}

function _attemptCloseTradeLogger() {
    if (!validateAndSaveTl()) return;
    closeTradeLogger();
}

function _getTlValue(tl, key) {
    if (!tl || !key) return '';
    const direct = tl[key];
    if (direct !== undefined && direct !== null && String(direct).trim() !== '') return direct;
    const aliases = TL_KEY_ALIASES[key] || [];
    for (const a of aliases) {
        const v = tl[a];
        if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return '';
}

function _setTlValue(tl, key, value) {
    if (!tl || !key) return;
    tl[key] = value;
}

function _appendTlMigrationLog(tl, msg) {
    if (!tl || !msg) return;
    if (!Array.isArray(tl._migrationLog)) tl._migrationLog = [];
    const stamp = new Date().toISOString();
    tl._migrationLog.push(`${stamp} - ${msg}`);
    if (tl._migrationLog.length > 50) tl._migrationLog = tl._migrationLog.slice(-50);
}

function _normalizeTlKeys(tl) {
    if (!tl || typeof tl !== 'object') return;
    let changed = false;
    const fromVersion = Number(tl._schemaVersion || 1);
    Object.keys(TL_KEY_ALIASES).forEach(key => {
        if (tl[key] !== undefined && tl[key] !== null && String(tl[key]).trim() !== '') return;
        const aliases = TL_KEY_ALIASES[key];
        for (const a of aliases) {
            const v = tl[a];
            if (v !== undefined && v !== null && String(v).trim() !== '') {
                tl[key] = v;
                _appendTlMigrationLog(tl, `mapped "${a}" -> "${key}"`);
                changed = true;
                break;
            }
        }
    });
    if (fromVersion !== TL_SCHEMA_VERSION) {
        _appendTlMigrationLog(tl, `schema upgraded ${fromVersion} -> ${TL_SCHEMA_VERSION}`);
        changed = true;
    }
    tl._schemaVersion = TL_SCHEMA_VERSION;
    return changed;
}

function _ensureTlSchema(tl) {
    if (!tl || typeof tl !== 'object') return false;
    let changed = false;
    if (!Array.isArray(tl._migrationLog)) {
        tl._migrationLog = [];
        changed = true;
    }
    if (Number(tl._schemaVersion || 0) !== TL_SCHEMA_VERSION) changed = true;
    if (_normalizeTlKeys(tl)) changed = true;
    return changed;
}

function openTradeLoggerFromToolbar() {
    const filtered = getFilteredTrades ? getFilteredTrades() : state.trades;
    if (!filtered.length) { showToast('No trades to review', 'error'); return; }
    const sorted = [...filtered].sort((a, b) => {
        const da = normalizeDate(a['trade_date'] || a['Date'] || a.date || '');
        const db = normalizeDate(b['trade_date'] || b['Date'] || b.date || '');
        return da < db ? 1 : da > db ? -1 : 0;
    });
    const rowIdx = state.trades.indexOf(sorted[0]);
    if (rowIdx >= 0) openTradeLogger(rowIdx);
}

function openTradeLogger(rowIdx) {
    closeTradeLogger();

    const trade = state.trades[rowIdx];
    if (!trade) return;

    const dateKey = normalizeDate(trade['trade_date'] || trade['Date'] || trade.date || '');

    _tlDayTrades = state.trades
        .map((t, i) => ({ trade: t, rowIdx: i }))
        .filter(({ trade: t }) => {
            if (normalizeDate(t['trade_date'] || t['Date'] || t.date || '') !== dateKey) return false;
            if (
                (t['Time'] === '' || t['Time'] === undefined) &&
                (t['Ex Time'] === '' || t['Ex Time'] === undefined) &&
                (t['Buy Time'] === '' || t['Buy Time'] === undefined) &&
                (t['Sell Time'] === '' || t['Sell Time'] === undefined) &&
                (t['Gross P/L'] === '' || t['Gross P/L'] === undefined) &&
                (t['Net P/L'] === '' || t['Net P/L'] === undefined) &&
                (t['Rs'] === '' || t['Rs'] === undefined) &&
                (t['Qty'] === '' || t['Qty'] === undefined)
            ) {
                return false;
            }
            return true;
        });

    _tlTab = Math.max(0, _tlDayTrades.findIndex(x => x.rowIdx === rowIdx));

    _tlBackdrop = document.createElement('div');
    _tlBackdrop.className = 'tr-backdrop';
    _tlBackdrop.addEventListener('click', e => {
        if (e.target === _tlBackdrop) {
            _attemptCloseTradeLogger();
        }
    });

    const modal = document.createElement('div');
    modal.className = 'tr-modal tl-modal';

    const hdr = document.createElement('div');
    hdr.className = 'tr-hdr';

    const hLeft = document.createElement('div');
    hLeft.className = 'tr-hdr-left';
    const title = document.createElement('span');
    title.className = 'tr-hdr-title';
    title.textContent = 'Trade Logger';
    hLeft.appendChild(title);

    const dateNav = document.createElement('div');
    dateNav.className = 'tr-date-nav';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'tr-date-arrow';
    prevBtn.textContent = '\u2039';
    prevBtn.addEventListener('click', () => _tlNavigateDate(-1));

    const dateLabel = document.createElement('span');
    dateLabel.className = 'tr-date-label';
    dateLabel.textContent = dateKey;
    dateLabel.title = 'Click to pick a date';
    dateLabel.style.cursor = 'pointer';

    const datePicker = document.createElement('input');
    datePicker.type = 'date';
    datePicker.style.position = 'absolute';
    datePicker.style.opacity = '0';
    datePicker.style.width = '0';
    datePicker.style.height = '0';
    datePicker.style.pointerEvents = 'none';
    datePicker.value = dateKey;
    dateLabel.appendChild(datePicker);
    dateLabel.addEventListener('click', () => {
        datePicker.showPicker ? datePicker.showPicker() : datePicker.click();
    });
    datePicker.addEventListener('change', () => {
        const picked = datePicker.value;
        if (!picked) return;
        saveTrades();
        const matchTrade = state.trades.find(t =>
            normalizeDate(t['trade_date'] || t['Date'] || t.date || '') === picked
        );
        if (matchTrade) {
            openTradeLogger(state.trades.indexOf(matchTrade));
        } else {
            const dates = [...new Set(
                state.trades.map(t => normalizeDate(t['trade_date'] || t['Date'] || t.date || ''))
            )].filter(Boolean).sort();
            const nearest = dates.reduce((prev, curr) =>
                Math.abs(curr.localeCompare(picked)) < Math.abs(prev.localeCompare(picked)) ? curr : prev
            , dates[0]);
            const nearTrade = nearest && state.trades.find(t =>
                normalizeDate(t['trade_date'] || t['Date'] || t.date || '') === nearest
            );
            if (nearTrade) openTradeLogger(state.trades.indexOf(nearTrade));
            else showToast('No trades found for selected date', 'error');
        }
    });

    const nextBtn = document.createElement('button');
    nextBtn.className = 'tr-date-arrow';
    nextBtn.textContent = '\u203a';
    nextBtn.addEventListener('click', () => _tlNavigateDate(1));

    dateNav.appendChild(prevBtn);
    dateNav.appendChild(dateLabel);
    dateNav.appendChild(nextBtn);
    hLeft.appendChild(dateNav);

    const hdrGroup = document.createElement('div');
    hdrGroup.style.display = 'flex';
    hdrGroup.style.gap = '8px';

    const resetBtn = document.createElement('button');
    resetBtn.className = 'tr-close';
    resetBtn.style.fontSize = '0.8rem';
    resetBtn.style.padding = '0 8px';
    resetBtn.textContent = 'Reset';
    resetBtn.title = 'Clear all fields in this trade logger';
    resetBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all data for this trade logger?')) {
            trade.tradeLogger = {};
            saveTrades();
            _renderTlContent();
        }
    });

    const forceExitBtn = document.createElement('button');
    forceExitBtn.className = 'tr-close';
    forceExitBtn.style.fontSize = '0.8rem';
    forceExitBtn.style.padding = '0 8px';
    forceExitBtn.textContent = 'Force Exit';
    forceExitBtn.title = 'Close without validating fields';
    forceExitBtn.addEventListener('click', () => {
        saveTrades();
        closeTradeLogger();
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tr-close';
    closeBtn.textContent = '\u2715';
    closeBtn.title = 'Save and close (checks validation)';
    closeBtn.addEventListener('click', _attemptCloseTradeLogger);

    hdrGroup.appendChild(resetBtn);
    hdrGroup.appendChild(forceExitBtn);
    hdrGroup.appendChild(closeBtn);
    hdr.appendChild(hLeft);
    hdr.appendChild(hdrGroup);
    modal.appendChild(hdr);

    const tabBar = document.createElement('div');
    tabBar.className = 'tr-tabs';
    tabBar.id = 'tl-tabs';
    modal.appendChild(tabBar);

    const body = document.createElement('div');
    body.className = 'tr-body tl-body';
    body.id = 'tl-body';
    modal.appendChild(body);

    _tlBackdrop.appendChild(modal);
    document.body.appendChild(_tlBackdrop);

    _renderTlTabs();
    _renderTlContent();

    document.addEventListener('keydown', _tlEscKey);
}

function _tlEscKey(e) {
    if (e.key === 'Escape') {
        _attemptCloseTradeLogger();
    }
}

function closeTradeLogger() {
    document.removeEventListener('keydown', _tlEscKey);
    if (_tlBackdrop) { _tlBackdrop.remove(); _tlBackdrop = null; }
    _tlDayTrades = [];
}

function validateAndSaveTl() {
    saveTrades();

    const { trade } = _tlDayTrades[_tlTab];
    if (!trade || !trade.tradeLogger) return true;
    const tl = trade.tradeLogger;
    const schemaChanged = _ensureTlSchema(tl);
    if (schemaChanged) saveTrades();

    const reqKeys = [
        'score', 'tar', 'runn', 'sl', 'dd',
        'entry_type', 'zone', 'zone_size', 'bc_gt_20', 'placement', 'near', 'z_candle',
        'breakout_c', 'dema', 'en_algo', 'en_sl10', 'dist_gt_20',
        'ex_nafs', 'mgt_patience', 'mgt_conf', 'sc_sl_moved',
        'sc_targ_move', 'sc_gt10', 'sc_ptrail', 'ex_sl', 'ex_targ', 'ex_kill'
    ];

    const missing = reqKeys.filter(k => {
        const val = _getTlValue(tl, k);
        return val === undefined || val === null || String(val).trim() === '';
    });

    if (missing.length > 0) {
        showToast('Please fill all missing inputs, dropdowns and Y/N values before exiting.', 'error');
        document.querySelectorAll('.tl-field, .tl-dash-inp').forEach(el => el.classList.remove('tl-error'));
        missing.forEach(k => {
            const fieldEl = document.querySelector(`.tl-field[data-key="${k}"]`);
            if (fieldEl) {
                fieldEl.classList.add('tl-error');
            } else {
                const dashEl = document.querySelector(`.tl-dash-inp[data-key="${k}"]`);
                if (dashEl) dashEl.classList.add('tl-error');
            }
        });

        const firstError = document.querySelector('.tl-error');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const focusable = firstError.querySelector('input, select, button');
            if (focusable) focusable.focus();
            else if (firstError.tagName === 'INPUT') firstError.focus();
        }

        return false;
    }
    return true;
}

function _tlNavigateDate(dir) {
    saveTrades();
    const dates = [...new Set(
        state.trades.map(t => normalizeDate(t['trade_date'] || t['Date'] || t.date || ''))
    )].filter(Boolean).sort();

    const cur = _tlDayTrades[0]
        ? normalizeDate(_tlDayTrades[0].trade['trade_date'] || _tlDayTrades[0].trade['Date'] || _tlDayTrades[0].trade.date || '')
        : '';

    const idx = dates.indexOf(cur);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= dates.length) return;

    const newDate = dates[newIdx];
    const newTrade = state.trades.find(t =>
        normalizeDate(t['trade_date'] || t['Date'] || t.date || '') === newDate
    );
    if (!newTrade) return;
    openTradeLogger(state.trades.indexOf(newTrade));
}

```

## File: `static/js/trade-logger-render.js`
```js
/**
 * @fileoverview trade-logger-render.js
 * @description Trade Logger — tab bar, content blocks, field builder, section renderer.
 *              Depends on trade-logger-core.js (loaded before this).
 */

function _renderTlTabs() {
    const bar = document.getElementById('tl-tabs');
    if (!bar) return;
    bar.innerHTML = '';

    const glCol = state.columns.find(c => /net\s*p\/l/i.test(c)) || state.columns.find(c => /^rs$/i.test(c));

    _tlDayTrades.forEach(({ trade }, i) => {
        const tab = document.createElement('button');
        const isActive = i === _tlTab;
        tab.className = 'tr-tab' + (isActive ? ' tr-tab-active' : '');
        tab.textContent = 'T' + (i + 1);

        const pl = glCol ? parseFloat(trade[glCol]) : NaN;
        if (!isNaN(pl) && !isActive) {
            tab.style.borderColor = pl >= 0 ? 'var(--green)' : 'var(--red)';
            tab.style.color = pl >= 0 ? 'var(--green)' : 'var(--red)';
        } else if (!isNaN(pl) && isActive) {
            tab.dataset.pl = pl >= 0 ? 'pos' : 'neg';
        }

        tab.addEventListener('click', () => {
            saveTrades();
            _tlTab = i;
            _renderTlTabs();
            _renderTlContent();
        });
        bar.appendChild(tab);
    });
}

function _renderTlContent() {
    const body = document.getElementById('tl-body');
    if (!body) return;
    body.innerHTML = '';

    const { trade } = _tlDayTrades[_tlTab];
    if (!trade.tradeLogger) trade.tradeLogger = {};
    const tl = trade.tradeLogger;
    const schemaChanged = _ensureTlSchema(tl);
    if (schemaChanged) saveTrades();

    const _fmt = val => {
        if (val === undefined || val === null || String(val).trim() === '') return '\u2014';
        const n = parseFloat(val);
        if (!isNaN(n)) return n % 1 === 0 ? String(n) : n.toFixed(2);
        return String(val);
    };

    // 1. DASHBOARD
    const b1 = _trBlock('Dashboard');
    const ptCol = state.columns.find(c => /^pt$/i.test(c));
    const glCol = state.columns.find(c => /net\s*p\/l/i.test(c)) || state.columns.find(c => /^rs$/i.test(c));

    const computedDur = _calcTradeDurationMinutes(trade);
    if (computedDur !== null) tl.dur = computedDur;

    const dashRow1 = document.createElement('div');
    dashRow1.className = 'tr-dash-row';
    [
        { lbl: 'Pt', val: ptCol ? trade[ptCol] : null },
        { lbl: 'P/L', val: glCol ? trade[glCol] : null },
        { lbl: 'Score', val: tl.score },
        { lbl: 'Dur', val: tl.dur }
    ].forEach(s => {
        const box = document.createElement('div');
        box.className = 'tr-dash-box';
        box.innerHTML = `<div class="tr-dash-lbl">${s.lbl}</div>`;
        const v = document.createElement('div'); v.className = 'tr-dash-val';
        if (s.lbl === 'Score' || s.lbl === 'Dur') {
            const inp = document.createElement('input');
            inp.className = 'tl-dash-inp';
            const dashKey = s.lbl.toLowerCase();
            inp.setAttribute('data-key', dashKey);
            if (s.lbl === 'Dur') {
                const durVal = tl[dashKey];
                inp.value = (durVal !== undefined && durVal !== '') ? durVal + ' min' : '—';
                inp.readOnly = true;
                inp.style.cursor = 'default';
                inp.style.opacity = '0.7';
                inp.tabIndex = -1;
            } else {
                inp.value = tl[dashKey] || '';
                inp.addEventListener('change', () => {
                    tl[dashKey] = inp.value;
                    inp.classList.remove('tl-error');
                    saveTrades();
                });
                inp.tabIndex = 0;
            }
            v.appendChild(inp);
        } else {
            v.textContent = _fmt(s.val);
            const n = parseFloat(s.val);
            if (!isNaN(n)) v.style.color = n >= 0 ? 'var(--green)' : 'var(--red)';
        }
        box.appendChild(v);
        dashRow1.appendChild(box);
    });

    const dashRow2 = document.createElement('div');
    dashRow2.className = 'tr-dash-row';
    [
        { lbl: 'Tar', key: 'tar' }, { lbl: 'Runn', key: 'runn' },
        { lbl: 'SL', key: 'sl' }, { lbl: 'DD', key: 'dd' }
    ].forEach(s => {
        const box = document.createElement('div');
        box.className = 'tr-dash-box';
        box.innerHTML = `<div class="tr-dash-lbl">${s.lbl}</div>`;
        const v = document.createElement('div'); v.className = 'tr-dash-val';
        const inp = document.createElement('input');
        inp.className = 'tl-dash-inp';
        inp.setAttribute('data-key', s.key);
        inp.value = tl[s.key] || '';
        inp.addEventListener('change', () => {
            tl[s.key] = inp.value;
            inp.classList.remove('tl-error');
            saveTrades();
        });
        inp.tabIndex = 0;
        v.appendChild(inp);
        box.appendChild(v);
        dashRow2.appendChild(box);
    });

    b1.body.appendChild(dashRow1);
    b1.body.appendChild(dashRow2);
    body.appendChild(b1.el);

    // Field builder
    const buildField = (lbl, type, opts, key) => {
        const wrap = document.createElement('div');
        wrap.className = 'tl-field';
        wrap.setAttribute('data-key', key);

        if (type === 'checkbox') {
            const lblEl = document.createElement('label');
            lblEl.className = 'tl-cb-label';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !!_getTlValue(tl, key);
            cb.tabIndex = 0;
            cb.addEventListener('change', () => { _setTlValue(tl, key, cb.checked); saveTrades(); });
            lblEl.appendChild(cb);
            lblEl.appendChild(document.createTextNode(' ' + lbl));
            wrap.appendChild(lblEl);
        } else if (type === 'yn') {
            const topLbl = document.createElement('div');
            topLbl.className = 'tl-label';
            topLbl.innerHTML = lbl;

            const grp = document.createElement('div');
            grp.className = 'tl-tristate';

            const yBtn = document.createElement('button');
            yBtn.className = 'tl-yn-btn y-btn' + (_getTlValue(tl, key) === 'Y' ? ' active-y' : '');
            yBtn.textContent = 'Y';
            yBtn.tabIndex = 0;

            const nBtn = document.createElement('button');
            nBtn.className = 'tl-yn-btn n-btn' + (_getTlValue(tl, key) === 'N' ? ' active-n' : '');
            nBtn.textContent = 'N';
            nBtn.tabIndex = 0;

            yBtn.addEventListener('click', () => {
                _setTlValue(tl, key, 'Y');
                yBtn.classList.add('active-y');
                nBtn.classList.remove('active-n');
                wrap.classList.remove('tl-error');
                saveTrades();
            });
            nBtn.addEventListener('click', () => {
                _setTlValue(tl, key, 'N');
                nBtn.classList.add('active-n');
                yBtn.classList.remove('active-y');
                wrap.classList.remove('tl-error');
                saveTrades();
            });

            grp.appendChild(yBtn);
            grp.appendChild(nBtn);
            wrap.appendChild(topLbl);
            wrap.appendChild(grp);
        } else if (type === 'dropdown') {
            const topLbl = document.createElement('div');
            topLbl.className = 'tl-label';
            topLbl.innerHTML = lbl;
            const sel = document.createElement('select');
            sel.className = 'tl-select';
            const cur = _getTlValue(tl, key);
            sel.innerHTML = `<option value=""></option>` + opts.map(o => `<option value="${o}" ${cur === o ? 'selected' : ''}>${o}</option>`).join('');
            sel.tabIndex = 0;
            sel.addEventListener('change', () => {
                _setTlValue(tl, key, sel.value);
                wrap.classList.remove('tl-error');
                saveTrades();
            });
            wrap.appendChild(topLbl);
            wrap.appendChild(sel);
        } else if (type === 'input') {
            const topLbl = document.createElement('div');
            topLbl.className = 'tl-label';
            topLbl.innerHTML = lbl;
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.className = 'tl-input';
            inp.value = _getTlValue(tl, key) || '';
            inp.tabIndex = 0;
            inp.addEventListener('input', () => {
                _setTlValue(tl, key, inp.value);
                wrap.classList.remove('tl-error');
                saveTrades();
            });
            wrap.appendChild(topLbl);
            wrap.appendChild(inp);
        }
        return wrap;
    };

    // 2. SETUP (Strategy)
    const b2 = _trBlock('Setup');
    const b2Row = document.createElement('div');
    b2Row.className = 'tl-flex-row';
    b2Row.style.gap = '20px';
    b2Row.style.borderBottom = '2px solid var(--red)';
    b2Row.style.paddingBottom = '12px';
    b2Row.style.marginBottom = '12px';

    const stratGrp = document.createElement('div');
    stratGrp.className = 'tl-fieldgroup tl-flex-row';
    stratGrp.innerHTML = '<div class="tl-label">Strategy</div>';
    stratGrp.appendChild(buildField('Reversal', 'checkbox', null, 'strat_rev'));
    stratGrp.appendChild(buildField('Cont', 'checkbox', null, 'strat_cont'));
    b2Row.appendChild(stratGrp);

    const entryTypeGrp = document.createElement('div');
    entryTypeGrp.className = 'tl-fieldgroup tl-flex-row';
    entryTypeGrp.appendChild(buildField('Entry Type', 'dropdown', ['Long', 'Short'], 'entry_type'));
    b2Row.appendChild(entryTypeGrp);

    b2.body.appendChild(b2Row);

    const b2ContentSplit = document.createElement('div');
    b2ContentSplit.style.display = 'flex';
    b2ContentSplit.style.gap = '20px';
    b2ContentSplit.style.alignItems = 'flex-start';

    const imgWrapper = document.createElement('div');
    imgWrapper.style.flex = '0 0 80%';
    imgWrapper.style.minHeight = '250px';
    imgWrapper.style.border = '1px dashed var(--border2)';
    imgWrapper.style.borderRadius = '8px';
    imgWrapper.style.display = 'flex';
    imgWrapper.style.alignItems = 'center';
    imgWrapper.style.justifyContent = 'center';
    imgWrapper.style.overflow = 'hidden';
    imgWrapper.style.background = 'var(--surface2)';

    let heroImgPath = null;
    if (trade.heroImage) {
        heroImgPath = trade.heroImage;
    } else if (trade.images && trade.images.length > 0) {
        heroImgPath = trade.images[0].path;
        if (!heroImgPath) heroImgPath = trade.images[0];
    }
    const dateKeyStr = normalizeDate(trade['trade_date'] || trade['Date'] || trade.date || '');

    if (heroImgPath) {
        const imgEl = document.createElement('img');
        imgEl.src = resolveImageUrl(heroImgPath);
        imgEl.style.width = '100%';
        imgEl.style.height = '100%';
        imgEl.style.objectFit = 'contain';
        imgEl.style.cursor = 'pointer';
        imgEl.title = 'Click to open in Gallery (new tab)';
        imgEl.addEventListener('click', () => {
            const u = new URL(window.location.href);
            u.searchParams.set('galleryDate', dateKeyStr || '');
            u.searchParams.set('galleryImg', heroImgPath || '');
            window.open(u.toString(), '_blank', 'noopener,noreferrer');
        });
        imgWrapper.appendChild(imgEl);
    } else {
        imgWrapper.innerHTML = '<span style="color:var(--text2); font-size:0.8rem;">No images for this trade</span>';
    }

    const b2grid = document.createElement('div');
    b2grid.className = 'tl-grid-1';
    b2grid.style.flex = '1';

    const b2c1 = document.createElement('div');
    b2c1.className = 'tl-col';
    b2c1.appendChild(buildField('Zone', 'yn', null, 'zone'));
    b2c1.appendChild(buildField('Zone size', 'input', null, 'zone_size'));
    b2c1.appendChild(buildField('Zone Candle', 'dropdown', ['Bullish Engulf', 'Bearish Engulf', 'Hammer', 'InvertedHammer', 'MorningStar', 'Shooting Star'], 'z_candle'));
    b2c1.appendChild(buildField('Break Candle &gt; 20pt', 'yn', null, 'bc_gt_20'));
    b2c1.appendChild(buildField('Placement', 'dropdown', ['Hawame', 'At Level', 'Near Level'], 'placement'));
    b2c1.appendChild(buildField('Near', 'dropdown', ['LL', 'HH'], 'near'));

    b2grid.appendChild(b2c1);
    b2ContentSplit.appendChild(b2grid);
    b2ContentSplit.appendChild(imgWrapper);
    b2.body.appendChild(b2ContentSplit);
    body.appendChild(b2.el);

    // 3-5. ENTRY / MANAGEMENT / EXIT
    const emoRow = document.createElement('div');
    emoRow.className = 'tl-em-row';

    const b3 = _trBlock('Entry');
    const b3grid = document.createElement('div');
    b3grid.className = 'tl-grid-1';
    const b3c1 = document.createElement('div'); b3c1.className = 'tl-col';
    b3c1.appendChild(buildField('Breakout Candle', 'dropdown', ['Same Clr', 'Different Clr'], 'breakout_c'));
    b3c1.appendChild(buildField('DEMA', 'yn', null, 'dema'));
    b3c1.appendChild(buildField('Algo signal', 'yn', null, 'en_algo'));
    b3c1.appendChild(buildField('SL under 10', 'yn', null, 'en_sl10'));
    b3c1.appendChild(buildField('Dist &gt; 20', 'yn', null, 'dist_gt_20'));
    b3grid.append(b3c1);
    b3.body.appendChild(b3grid);
    emoRow.appendChild(b3.el);

    const b4 = _trBlock('Management');
    const b4grid = document.createElement('div');
    b4grid.className = 'tl-grid-1';
    const b4c1 = document.createElement('div'); b4c1.className = 'tl-col';
    b4c1.appendChild(buildField('Nafs Pe Kabu', 'yn', null, 'ex_nafs'));
    b4c1.appendChild(buildField('SL moved', 'yn', null, 'sc_sl_moved'));
    b4c1.appendChild(buildField('Patience', 'yn', null, 'mgt_patience'));
    b4c1.appendChild(buildField('Confirmation', 'yn', null, 'mgt_conf'));
    b4grid.append(b4c1);
    b4.body.appendChild(b4grid);
    emoRow.appendChild(b4.el);

    const b5 = _trBlock('Exit');
    const b5grid = document.createElement('div');
    b5grid.className = 'tl-grid-1';
    const b5c1 = document.createElement('div'); b5c1.className = 'tl-col';
    b5c1.appendChild(buildField('Target move', 'yn', null, 'sc_targ_move'));
    b5c1.appendChild(buildField('&gt;10 pt', 'yn', null, 'sc_gt10'));
    b5c1.appendChild(buildField('Profit trail', 'yn', null, 'sc_ptrail'));
    b5c1.appendChild(buildField('SL', 'yn', null, 'ex_sl'));
    b5c1.appendChild(buildField('Target', 'yn', null, 'ex_targ'));
    b5c1.appendChild(buildField('Kill Switch', 'yn', null, 'ex_kill'));
    b5grid.append(b5c1);
    b5.body.appendChild(b5grid);
    emoRow.appendChild(b5.el);

    body.appendChild(emoRow);

    // 6. PSYCO (EMOTIONS)
    const b6 = _trBlock('Psyco (Emotions)');
    const psy = document.createElement('div');
    psy.className = 'tl-psy-wrap';

    const mkEmotionCard = (title, posItems, negItems) => {
        const card = document.createElement('div');
        card.className = 'tl-psy-card';

        const hdr = document.createElement('div');
        hdr.className = 'tl-psy-title';
        hdr.textContent = title;
        card.appendChild(hdr);

        const grid = document.createElement('div');
        grid.className = 'tl-psy-grid';

        const pos = document.createElement('div');
        pos.className = 'tl-psy-col tl-psy-col-pos';
        pos.innerHTML = '<div class="tl-psy-col-head">+</div>';
        posItems.forEach(([lbl, key]) => pos.appendChild(buildField(lbl, 'yn', null, key)));

        const neg = document.createElement('div');
        neg.className = 'tl-psy-col tl-psy-col-neg';
        neg.innerHTML = '<div class="tl-psy-col-head">-ve</div>';
        negItems.forEach(([lbl, key]) => neg.appendChild(buildField(lbl, 'yn', null, key)));

        grid.appendChild(pos);
        grid.appendChild(neg);
        card.appendChild(grid);
        return card;
    };

    psy.appendChild(mkEmotionCard(
        'Entry',
        [['Nafs Pe Kabu', 'en_nafs'], ['Patience', 'en_patience'], ['Confirmation', 'en_conf']],
        [['Impulsive', 'en_impulsive'], ['Desperate', 'en_desperate'], ['Distracted', 'en_distracted'], ['Panic', 'en_panic']]
    ));
    psy.appendChild(mkEmotionCard(
        'Exit',
        [['Nafs Pe Kabu', 'ex_nafs'], ['Patience', 'ex_patience'], ['Confirmation', 'ex_conf'], ['Swing Creation', 'ex_swing']],
        [['Impulsive', 'ex_impulsive'], ['Distracted', 'ex_distracted'], ['Panic', 'ex_panic'], ['Desperate', 'ex_desperate'], ['Sahi Nahi Lag Raha', 'ex_sahi']]
    ));

    b6.body.appendChild(psy);
    body.appendChild(b6.el);
}

function _trBlock(title) {
    const el = document.createElement('div');
    el.className = 'tr-block tl-block';
    const head = document.createElement('div');
    head.className = 'tr-block-head';
    const iconMap = {
        dashboard: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect></svg>',
        setup: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v3"></path><path d="M12 18v3"></path><path d="M3 12h3"></path><path d="M18 12h3"></path><path d="m5.64 5.64 2.12 2.12"></path><path d="m16.24 16.24 2.12 2.12"></path><path d="m18.36 5.64-2.12 2.12"></path><path d="m7.76 16.24-2.12 2.12"></path><circle cx="12" cy="12" r="3"></circle></svg>',
        entry: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle></svg>',
        management: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><polyline points="3 12 7 12 10 5 14 19 17 12 21 12"></polyline></svg>',
        exit: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>'
    };
    const key = String(title || '').toLowerCase();
    const icon = iconMap[key];
    if (icon) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'tl-head-icon tl-head-icon-svg';
        iconSpan.innerHTML = icon;
        head.appendChild(iconSpan);
    }

    const titleSpan = document.createElement('span');
    titleSpan.className = 'tl-head-title';
    titleSpan.textContent = String(title || '').toUpperCase();
    head.appendChild(titleSpan);
    const body = document.createElement('div');
    body.className = 'tr-block-body tl-block-body';
    el.appendChild(head);
    el.appendChild(body);
    return { el, head, body };
}

```

## File: `static/js/tag-pins.js`
```js
/**
 * @fileoverview tag-pins.js
 * @description Tag Pin system — drop a tag chip onto the image to place a colored dot.
 *   Pins live inside #gallery-zoom-layer → they zoom/pan with the image automatically.
 *   Coordinates stored as % of zoom-layer's LOGICAL size (pre-transform).
 *   DOMMatrix inversion used so drop + drag work correctly at any zoom level.
 *
 *   Desktop: drag-drop tag chip → image | drag existing pin to move it
 *   iPad:    long-press chip (500ms) → tap image | drag pin to move
 *   Delete:  header 🗑 button → click/tap any pin
 */

// ── Color palette ─────────────────────────────────────────────────────────────

const TAG_PIN_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#ff6b9d', '#00d2ff', '#ffd700'
];

function getTagPinColor(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = ((h << 5) - h + tag.charCodeAt(i)) >>> 0;
  return TAG_PIN_COLORS[h % TAG_PIN_COLORS.length];
}

// ── Coordinate helper — screen → zoom-layer logical % ──────────────────────────
// gallery-zoom-layer has transform-origin: top left.
// So: screen_point = wrapper_origin + T * logical_point
// Therefore: logical_point = T_inv * (screen_point - wrapper_origin)

function _screenToLogical(sx, sy) {
  const zl = document.getElementById('gallery-zoom-layer');
  if (!zl) return null;

  // wrapper is zoom-layer's parent; it has no transform of its own
  const wrapper = zl.parentElement;
  if (!wrapper) return null;
  const wRect = wrapper.getBoundingClientRect();

  // Point in zoom-layer's parent coordinate space
  const relX = sx - wRect.left;
  const relY = sy - wRect.top;

  const transformStr = window.getComputedStyle(zl).transform;
  let lx = relX, ly = relY;

  if (transformStr && transformStr !== 'none') {
    try {
      const inv = new DOMMatrix(transformStr).inverse();
      const pt  = inv.transformPoint(new DOMPoint(relX, relY));
      lx = pt.x;
      ly = pt.y;
    } catch (_) { /* no transform or unsupported */ }
  }

  const w = zl.offsetWidth  || 1;
  const h = zl.offsetHeight || 1;
  return {
    x: Math.max(1, Math.min(99, (lx / w) * 100)),
    y: Math.max(1, Math.min(99, (ly / h) * 100))
  };
}

// ── Data access ───────────────────────────────────────────────────────────────

function getTagPinsForUrl(imgUrl, dateHint) {
  if (!imgUrl) return [];
  const trade = typeof getOwnerTradeForImageUrl === 'function'
    ? getOwnerTradeForImageUrl(imgUrl) : null;
  if (trade) return (trade.tagPins || {})[imgUrl] || [];
  const d = dateHint || (state.gallery && state.gallery.date) || '';
  if (d && state.dayData && state.dayData[d])
    return (state.dayData[d].tagPins || {})[imgUrl] || [];
  return [];
}

function setTagPinsForUrl(imgUrl, pins, dateHint) {
  if (!imgUrl) return;
  const trade = typeof getOwnerTradeForImageUrl === 'function'
    ? getOwnerTradeForImageUrl(imgUrl) : null;
  if (trade) {
    if (!trade.tagPins) trade.tagPins = {};
    if (pins.length === 0) delete trade.tagPins[imgUrl];
    else trade.tagPins[imgUrl] = pins;
    return;
  }
  const d = dateHint || (state.gallery && state.gallery.date) || '';
  if (!d) return;
  if (!state.dayData[d]) state.dayData[d] = {};
  if (!state.dayData[d].tagPins) state.dayData[d].tagPins = {};
  if (pins.length === 0) delete state.dayData[d].tagPins[imgUrl];
  else state.dayData[d].tagPins[imgUrl] = pins;
}

function _currentPinImgUrl() {
  return ((state.gallery && state.gallery.images) || [])[state.gallery.currentIndex] || '';
}

// ── Mutations ─────────────────────────────────────────────────────────────────

function _updateThumbBadge(imgUrl) {
  if (!imgUrl) return;
  const idx = (state.gallery && state.gallery.images) ? state.gallery.images.indexOf(imgUrl) : -1;
  if (idx < 0) return;
  const wrap = document.querySelector('#gallery-thumbs [data-global-idx="' + idx + '"]');
  if (!wrap) return;
  wrap.querySelectorAll('.tag-pin-thumb-badge').forEach(el => el.remove());
  const count = getTagPinsForUrl(imgUrl).length;
  if (count > 0) {
    const badge = document.createElement('div');
    badge.className = 'tag-pin-thumb-badge';
    badge.textContent = count;
    badge.title = count + ' tag pin' + (count > 1 ? 's' : '');
    wrap.appendChild(badge);
  }
}

function addTagPin(tag, xPct, yPct) {
  const imgUrl = _currentPinImgUrl();
  if (!imgUrl) return;
  const pins = [...getTagPinsForUrl(imgUrl)];
  pins.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    tag,
    x: Math.round(xPct * 10) / 10,
    y: Math.round(yPct * 10) / 10,
    color: getTagPinColor(tag)
  });
  setTagPinsForUrl(imgUrl, pins);

  // Also assign the tag to the image (like chip-click does) if not already assigned
  if (typeof getCurrentGalleryImageTagInfo === 'function') {
    const info = getCurrentGalleryImageTagInfo();
    if (info && !info.imageTags.includes(tag)) {
      const next = [...info.imageTags, tag];
      if (info.ownerType === 'trade' && info.trade && typeof setImageTagsForUrl === 'function')
        setImageTagsForUrl(info.trade, imgUrl, next);
      else if (info.ownerType === 'day' && info.dateKey && typeof setDayImageTagsForUrl === 'function')
        setDayImageTagsForUrl(info.dateKey, imgUrl, next);
      else if (info.ownerType === 'pdf' && typeof setPdfPageTags === 'function')
        setPdfPageTags(info.pdfId, info.pageNo, next);
      if (typeof normalizeAllTagsFromTrades === 'function') normalizeAllTagsFromTrades();
      if (typeof renderGalleryImageTags    === 'function') renderGalleryImageTags();
      if (typeof renderGalleryTagCloud     === 'function') renderGalleryTagCloud();
      if (typeof renderGalleryTagsTray     === 'function') renderGalleryTagsTray();
      if (typeof renderGalleryTagFilterPanel === 'function') renderGalleryTagFilterPanel();
    }
  }

  renderTagPins();
  _updateThumbBadge(imgUrl);
  if (typeof saveTrades === 'function') saveTrades();
  if (typeof showToast === 'function') showToast('📍 ' + tag, 'success');
}

function removeTagPin(pinId) {
  const imgUrl = _currentPinImgUrl();
  if (!imgUrl) return;
  const pins = getTagPinsForUrl(imgUrl).filter(p => p.id !== pinId);
  setTagPinsForUrl(imgUrl, pins);
  renderTagPins();
  _updateThumbBadge(imgUrl);
  if (typeof saveTrades === 'function') saveTrades();
}

function _movePinInData(pinId, newX, newY) {
  const imgUrl = _currentPinImgUrl();
  if (!imgUrl) return;
  const pins = getTagPinsForUrl(imgUrl);
  const pin  = pins.find(p => p.id === pinId);
  if (!pin) return;
  pin.x = Math.round(newX * 10) / 10;
  pin.y = Math.round(newY * 10) / 10;
  setTagPinsForUrl(imgUrl, pins);
  if (typeof saveTrades === 'function') saveTrades();
}

// ── Render ─────────────────────────────────────────────────────────────────────

function renderTagPins() {
  const zoomLayer = document.getElementById('gallery-zoom-layer');
  if (!zoomLayer) return;
  zoomLayer.querySelectorAll('.tag-pin-dot').forEach(el => el.remove());

  if (!state.gallery || !state.gallery._tagPinsVisible) return;

  const imgUrl = _currentPinImgUrl();
  if (!imgUrl) return;
  const pins = getTagPinsForUrl(imgUrl);
  if (!pins.length) return;

  const deleteMode = !!state.gallery._tagPinDeleteMode;

  pins.forEach(pin => {
    const dot = document.createElement('div');
    dot.className = 'tag-pin-dot' + (deleteMode ? ' tag-pin-delete-mode' : '');
    dot.style.left       = pin.x + '%';
    dot.style.top        = pin.y + '%';
    dot.style.background = pin.color;
    dot.style.boxShadow  = '0 0 0 2px #fff, 0 0 0 3px ' + pin.color + ', 0 4px 14px rgba(0,0,0,0.55)';
    dot.dataset.pinId    = pin.id;

    const tt = document.createElement('span');
    tt.className      = 'tag-pin-tooltip';
    tt.style.borderColor = pin.color;
    if (pin.note) {
      const tagLine = document.createElement('div');
      tagLine.style.cssText = 'font-weight:700; margin-bottom:4px;';
      tagLine.textContent = pin.tag;
      const noteLine = document.createElement('div');
      noteLine.style.cssText = 'color:rgba(255,220,100,0.9); font-size:0.78rem; max-width:200px; line-height:1.4;';
      noteLine.innerHTML = pin.note; // stored as HTML
      tt.appendChild(tagLine);
      tt.appendChild(noteLine);
    } else {
      tt.textContent = pin.tag;
    }
    dot.appendChild(tt);

    if (deleteMode) {
      // Click → remove pin
      dot.addEventListener('click', e => {
        e.stopPropagation();
        removeTagPin(pin.id);
      });
    } else {
      // Right-click → note editor
      dot.addEventListener('contextmenu', e => {
        e.preventDefault();
        e.stopPropagation();
        _openPinNoteEditor(pin, dot);
      });
      // Drag → move pin (mouse + touch)
      _bindPinDrag(dot, pin);
    }

    zoomLayer.appendChild(dot);
  });
}

// ── Drag-to-move ──────────────────────────────────────────────────────────────

function _bindPinDrag(dot, pin) {
  let dragging  = false;
  let hasMoved  = false;

  const _clientXY = (e) => {
    if (e.touches     && e.touches.length)        return [e.touches[0].clientX,        e.touches[0].clientY];
    if (e.changedTouches && e.changedTouches.length) return [e.changedTouches[0].clientX, e.changedTouches[0].clientY];
    return [e.clientX, e.clientY];
  };

  const onStart = (e) => {
    if (e.button !== undefined && e.button !== 0) return; // left-click only
    e.stopPropagation();
    e.preventDefault();
    dragging = true;
    hasMoved = false;
    dot.classList.add('tag-pin-dragging');
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend',  onEnd);
  };

  const onMove = (e) => {
    if (!dragging) return;
    if (e.cancelable) e.preventDefault();
    hasMoved = true;
    const [cx, cy] = _clientXY(e);
    const coords = _screenToLogical(cx, cy);
    if (!coords) return;
    dot.style.left = coords.x + '%';
    dot.style.top  = coords.y + '%';
  };

  const onEnd = (e) => {
    if (!dragging) return;
    dragging = false;
    dot.classList.remove('tag-pin-dragging');
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup',   onEnd);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend',  onEnd);

    if (!hasMoved) return; // just a click, not a drag

    const [cx, cy] = _clientXY(e);
    const coords = _screenToLogical(cx, cy);
    if (coords) _movePinInData(pin.id, coords.x, coords.y);
  };

  dot.addEventListener('mousedown',  onStart);
  dot.addEventListener('touchstart', onStart, { passive: false });
}

// ── Drop zone (new tag chip → image) ─────────────────────────────────────────

function initTagPinDropZone() {
  const wrapper = document.getElementById('gallery-img-wrapper');
  if (!wrapper || wrapper._tagPinDropBound) return;
  wrapper._tagPinDropBound = true;

  const _getImg = () => document.getElementById('gallery-img');

  wrapper.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('text/plain')) return;
    e.preventDefault();
    _getImg()?.classList.add('tag-pin-drop-hover');
  });

  wrapper.addEventListener('dragleave', e => {
    if (!wrapper.contains(e.relatedTarget))
      _getImg()?.classList.remove('tag-pin-drop-hover');
  });

  wrapper.addEventListener('drop', e => {
    _getImg()?.classList.remove('tag-pin-drop-hover');
    const tag = e.dataTransfer.getData('text/plain');
    if (!tag || !tag.trim()) return;
    e.preventDefault();
    e.stopPropagation();
    const coords = _screenToLogical(e.clientX, e.clientY);
    if (coords) addTagPin(tag.trim(), coords.x, coords.y);
  });

  // Touch/iPad: click image when _pendingPinTag is set
  wrapper.addEventListener('click', e => {
    const pending = state.gallery && state.gallery._pendingPinTag;
    if (!pending) return;
    if (e.target.closest('.tag-pin-dot')) return;
    // Validate click is within the image element bounds
    const img = _getImg();
    if (!img) return;
    const r = img.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right ||
        e.clientY < r.top  || e.clientY > r.bottom) return;
    const coords = _screenToLogical(e.clientX, e.clientY);
    if (coords) addTagPin(pending, coords.x, coords.y);
    _clearPendingPinTag();
  });

  _initTagChipLongPress();
}

// ── Long-press on tag chips (iPad) ────────────────────────────────────────────

function _initTagChipLongPress() {
  const body = document.getElementById('gv2-tags-tray-body');
  if (!body || body._tagPinLongPressBound) return;
  body._tagPinLongPressBound = true;

  let _lpt = null;
  body.addEventListener('touchstart', e => {
    const chip = e.target.closest('.gv2-tt-tag-chip');
    if (!chip) return;
    const lbl = chip.querySelector('span');
    const tag = lbl ? lbl.textContent.trim() : '';
    if (!tag) return;
    _lpt = setTimeout(() => { _lpt = null; _togglePendingPinTag(tag); }, 480);
  }, { passive: true });
  body.addEventListener('touchend',  () => { clearTimeout(_lpt); _lpt = null; });
  body.addEventListener('touchmove', () => { clearTimeout(_lpt); _lpt = null; });
}

function _togglePendingPinTag(tag) {
  if (state.gallery._pendingPinTag === tag) {
    _clearPendingPinTag();
  } else {
    state.gallery._pendingPinTag = tag;
    document.querySelectorAll('.gv2-tt-tag-chip').forEach(c => {
      const lbl = c.querySelector('span');
      c.classList.toggle('tag-pin-pending', !!(lbl && lbl.textContent.trim() === tag));
    });
    _updatePinHeaderBtns();
    if (typeof showToast === 'function') showToast('📍 ' + tag + ' — tap image to place pin', 'info');
  }
}

function _clearPendingPinTag() {
  if (!state.gallery) return;
  state.gallery._pendingPinTag = null;
  document.querySelectorAll('.tag-pin-pending').forEach(c => c.classList.remove('tag-pin-pending'));
  _updatePinHeaderBtns();
}

// ── Header buttons ────────────────────────────────────────────────────────────

function initTagPinHeaderButtons() {
  if (!state.gallery) return;
  if (state.gallery._tagPinsVisible   === undefined) state.gallery._tagPinsVisible   = true;
  if (state.gallery._tagPinDeleteMode === undefined) state.gallery._tagPinDeleteMode = false;

  const visBtn = document.getElementById('tag-pin-vis-btn');
  const delBtn = document.getElementById('tag-pin-del-btn');

  if (visBtn && !visBtn._bound) {
    visBtn._bound = true;
    visBtn.addEventListener('click', () => {
      state.gallery._tagPinsVisible = !state.gallery._tagPinsVisible;
      if (!state.gallery._tagPinsVisible) state.gallery._tagPinDeleteMode = false;
      _updatePinHeaderBtns();
      renderTagPins();
    });
  }

  if (delBtn && !delBtn._bound) {
    delBtn._bound = true;
    delBtn.addEventListener('click', () => {
      if (!state.gallery._tagPinsVisible) return;
      state.gallery._tagPinDeleteMode = !state.gallery._tagPinDeleteMode;
      _updatePinHeaderBtns();
      renderTagPins();
    });
  }

  _updatePinHeaderBtns();
}

// ── Pin note editor ───────────────────────────────────────────────────────────

function _openPinNoteEditor(pin, anchorEl) {
  const existing = document.getElementById('pin-note-popover');
  if (existing) existing.remove();

  const pop = document.createElement('div');
  pop.id = 'pin-note-popover';
  pop.style.cssText = 'position:fixed; z-index:9999; background:#1e2130; border:1px solid ' + pin.color + '; border-radius:8px; padding:10px; box-shadow:0 4px 24px rgba(0,0,0,0.7); width:300px;';

  // Title row
  const title = document.createElement('div');
  title.style.cssText = 'font-size:0.75rem; font-weight:700; margin-bottom:7px; display:flex; align-items:center; gap:6px;';
  const colorDot = document.createElement('span');
  colorDot.style.cssText = 'display:inline-block; width:10px; height:10px; border-radius:50%; flex-shrink:0; background:' + pin.color + ';';
  title.appendChild(colorDot);
  title.appendChild(document.createTextNode(pin.tag));
  pop.appendChild(title);

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'display:flex; gap:4px; margin-bottom:5px; flex-wrap:wrap;';
  const toolBtnStyle = 'background:#111420; color:#ccc; border:1px solid rgba(255,255,255,0.15); border-radius:4px; width:30px; height:28px; cursor:pointer; font-size:0.85rem; display:flex; align-items:center; justify-content:center; font-family:serif;';
  const tools = [
    { label: 'B',  title: 'Bold',      cmd: 'bold',        style: 'font-weight:900;' },
    { label: 'I',  title: 'Italic',    cmd: 'italic',      style: 'font-style:italic;' },
    { label: 'U',  title: 'Underline', cmd: 'underline',   style: 'text-decoration:underline;' },
    { label: '≡',  title: 'Bullets',   cmd: 'insertUnorderedList', style: '' },
    { label: '1.', title: 'Numbered',  cmd: 'insertOrderedList',   style: 'font-size:0.7rem; font-weight:700; font-family:monospace;' },
  ];
  tools.forEach(t => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = t.title;
    btn.innerHTML = `<span style="${t.style}">${t.label}</span>`;
    btn.style.cssText = toolBtnStyle;
    btn.addEventListener('mousedown', ev => {
      ev.preventDefault(); // don't blur editor
      document.execCommand(t.cmd, false, null);
      editor.focus();
    });
    toolbar.appendChild(btn);
  });

  // Divider
  const div1 = document.createElement('span');
  div1.style.cssText = 'width:1px; height:28px; background:rgba(255,255,255,0.1); margin:0 2px;';
  toolbar.appendChild(div1);

  // Font size buttons
  ['-', '+'].forEach(sym => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = sym === '+' ? 'Increase font size' : 'Decrease font size';
    btn.textContent = sym;
    btn.style.cssText = toolBtnStyle + 'font-weight:700; font-size:1rem;';
    btn.addEventListener('mousedown', ev => {
      ev.preventDefault();
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (range.collapsed) return;
      const span = document.createElement('span');
      const cur = parseFloat(window.getComputedStyle(editor).fontSize) || 13;
      span.style.fontSize = (cur + (sym === '+' ? 2 : -2)) + 'px';
      range.surroundContents(span);
      editor.focus();
    });
    toolbar.appendChild(btn);
  });

  pop.appendChild(toolbar);

  // Contenteditable editor
  const editor = document.createElement('div');
  editor.contentEditable = 'true';
  editor.style.cssText = 'min-height:100px; max-height:220px; overflow-y:auto; background:#111420; color:#e0e0e0; border:1px solid rgba(255,255,255,0.15); border-radius:5px; padding:9px 11px; font-size:1rem; outline:none; line-height:1.6; word-break:break-word;';
  editor.innerHTML = pin.note || '';
  if (!pin.note) editor.setAttribute('data-placeholder', 'Note likhein...');
  editor.addEventListener('keydown', ev => {
    // Stop all keys from bubbling to gallery handlers
    ev.stopPropagation();
    if (ev.key === 'Escape') { ev.preventDefault(); pop.remove(); }
  });
  editor.addEventListener('keyup',    ev => ev.stopPropagation());
  editor.addEventListener('keypress', ev => ev.stopPropagation());
  // Placeholder style via CSS injection (once)
  if (!document.getElementById('pin-editor-css')) {
    const s = document.createElement('style');
    s.id = 'pin-editor-css';
    s.textContent = '[contenteditable][data-placeholder]:empty::before{content:attr(data-placeholder);color:rgba(255,255,255,0.25);pointer-events:none;} #pin-note-popover ul,#pin-note-popover ol{margin:4px 0 4px 18px;padding:0;} #pin-note-popover li{margin:2px 0;}';
    document.head.appendChild(s);
  }
  pop.appendChild(editor);

  // Action buttons
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex; gap:6px; margin-top:8px; justify-content:flex-end;';

  const makeBtn = (text, css) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = text; b.style.cssText = css;
    return b;
  };
  const saveBtn   = makeBtn('Save',   'background:' + pin.color + '; color:#111; border:none; border-radius:5px; padding:5px 16px; cursor:pointer; font-weight:700; font-size:0.8rem;');
  const clearBtn  = makeBtn('Clear',  'background:transparent; color:rgba(255,100,100,0.8); border:1px solid rgba(255,100,100,0.4); border-radius:5px; padding:5px 10px; cursor:pointer; font-size:0.8rem;');
  const cancelBtn = makeBtn('Cancel', 'background:transparent; color:#aaa; border:1px solid rgba(255,255,255,0.15); border-radius:5px; padding:5px 10px; cursor:pointer; font-size:0.8rem;');

  const doSave = (html) => {
    const imgUrl = _currentPinImgUrl();
    if (!imgUrl) return;
    const pins = getTagPinsForUrl(imgUrl);
    const p = pins.find(p => p.id === pin.id);
    if (p) {
      const clean = html.replace(/<br\s*\/?>\s*$/i, '').trim();
      if (clean) p.note = clean; else delete p.note;
      setTagPinsForUrl(imgUrl, pins);
      if (typeof saveTrades === 'function') saveTrades();
      renderTagPins();
    }
    pop.remove();
  };

  const deleteBtn = makeBtn('🗑 Pin hatao', 'background:transparent; color:rgba(255,80,80,0.85); border:1px solid rgba(255,80,80,0.35); border-radius:5px; padding:5px 10px; cursor:pointer; font-size:0.78rem; margin-right:auto;');
  deleteBtn.addEventListener('click', () => {
    pop.remove();
    removeTagPin(pin.id);
    const imgUrl = _currentPinImgUrl();
    if (imgUrl) _updateThumbBadge(imgUrl);
  });

  saveBtn.addEventListener('click',   () => doSave(editor.innerHTML));
  clearBtn.addEventListener('click',  () => doSave(''));
  cancelBtn.addEventListener('click', () => pop.remove());

  btnRow.appendChild(deleteBtn);
  btnRow.appendChild(clearBtn);
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
  pop.appendChild(btnRow);
  document.body.appendChild(pop);

  // Position near the dot
  const rect = anchorEl.getBoundingClientRect();
  const pw = 300, ph = 220;
  let top  = rect.bottom + 8;
  let left = rect.left - pw / 2 + rect.width / 2;
  if (top  + ph > window.innerHeight) top  = rect.top - ph - 8;
  if (left + pw > window.innerWidth)  left = window.innerWidth - pw - 10;
  if (left < 6) left = 6;
  pop.style.top  = top  + 'px';
  pop.style.left = left + 'px';

  // Focus at end of content
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  setTimeout(() => {
    const onOut = ev => { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('mousedown', onOut); } };
    document.addEventListener('mousedown', onOut);
  }, 50);
}

function _updatePinHeaderBtns() {
  if (!state.gallery) return;
  const v = state.gallery._tagPinsVisible;
  const d = state.gallery._tagPinDeleteMode;

  const visBtn = document.getElementById('tag-pin-vis-btn');
  const delBtn = document.getElementById('tag-pin-del-btn');

  if (visBtn) {
    visBtn.classList.toggle('tag-pin-btn-active', !!v);
    visBtn.title         = v ? 'Hide tag pins' : 'Show tag pins';
    visBtn.style.opacity = v ? '' : '0.45';
  }
  if (delBtn) {
    delBtn.classList.toggle('tag-pin-btn-active', !!d);
    delBtn.title             = d ? 'Exit delete mode' : 'Delete pins (click/tap to remove)';
    delBtn.style.color       = d ? '#e74c3c' : '';
    delBtn.style.borderColor = d ? 'rgba(231,76,60,0.6)' : '';
    delBtn.style.background  = d ? 'rgba(231,76,60,0.12)' : '';
    delBtn.style.opacity     = v ? '' : '0.45';
  }
}

```
