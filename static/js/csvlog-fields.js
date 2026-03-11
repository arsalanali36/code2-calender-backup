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
  inp.addEventListener('input', () => { saved[key] = inp.value; });
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
  sel.addEventListener('change', () => { saved[key] = sel.value; _open = false; });
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
  const wrap = document.createElement('div');
  wrap.className = 'cl-slider-wrap';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'cl-slider';
  slider.min = min; slider.max = max; slider.step = 1;
  slider.value = val !== '' ? Number(val) : min;
  slider.dataset.clCtrl = 'slider';

  const display = document.createElement('span');
  display.className = 'cl-slider-val';
  display.textContent = slider.value;

  slider.addEventListener('input', () => {
    display.textContent = slider.value;
    saved[key] = Number(slider.value);
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
    });
    wrap.appendChild(obsArea);

    // Commit button — parses text back into individual obs fields
    const commitBtn = document.createElement('button');
    commitBtn.className = 'btn btn-outline cl-obs-commit-btn';
    commitBtn.textContent = '↵ Commit to fields';
    commitBtn.title = 'Parse and write observations back to each field';
    commitBtn.addEventListener('click', () => {
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
        saveTagGroups(); saveTrades();
      } else {
        if (isOn) {
          trade['Tags'] = tradeTags.filter(t => t !== tag);
        } else {
          trade['Tags'] = [...tradeTags, tag];
        }
        trade['tags'] = [...trade['Tags']];
        saveTrades();
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
