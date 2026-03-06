# JS — Trade Review popup (trade-review.js)
This file contains the consolidated code context for the project to be used with AI assistants like Claude or ChatGPT.


## File: `static\js\trade-review.js`
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
