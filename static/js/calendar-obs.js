/**
 * @fileoverview calendar-obs.js
 * @description Observation modal: open, render per-trade notes, save, navigate, toolbar.
 *   Extracted from calendar.js to keep that file under 30 KB.
 * @exports openObsModal, renderObsTradeNotes, saveObservation, navigateObsDate, bindObsToolbar
 * @reads state.trades, state.dayData, state.obsDate, state.year, state.month
 * @calls getTradeForDate, getTradesForDate, getOrCreateTrade, formatDisplayDate, formatDate,
 *        renderCalendar, renderTable, saveTrades, showToast
 */

function openObsModal(dateStr) {
  state.obsDate = dateStr;
  document.getElementById('obs-modal-date').textContent = formatDisplayDate(dateStr);
  document.getElementById('obs-date-picker').value = dateStr;
  const trade = getTradeForDate(dateStr);
  document.getElementById('obs-editor').innerHTML = (trade && trade.observation) ? trade.observation : '';
  renderObsTradeNotes(dateStr);
  document.getElementById('obs-modal').classList.add('open');
  setTimeout(() => document.getElementById('obs-editor').focus(), 50);
}

function renderObsTradeNotes(dateStr) {
  const container = document.getElementById('obs-trade-notes');
  if (!container) return;
  container.innerHTML = '';

  const trades = getTradesForDate(dateStr);
  if (!trades.length) return;

  const instrCol = state.columns.find(c => /instrument|symbol|scrip|stock/i.test(c)) || state.columns[0];

  const hdr = document.createElement('div');
  hdr.className = 'obs-trade-notes-hdr';
  hdr.textContent = 'Per-Trade Notes';
  container.appendChild(hdr);

  let _noteItemDragFromHandle = false;

  trades.forEach((trade, i) => {
    const rowIdx = state.trades.indexOf(trade);
    const label = (instrCol && trade[instrCol]) ? trade[instrCol] : `Trade ${i + 1}`;

    const item = document.createElement('div');
    item.className = 'obs-trade-note-item';
    item.dataset.rowIdx = rowIdx;

    const handle = document.createElement('span');
    handle.className = 'obs-note-drag-handle';
    handle.textContent = '⠿';
    handle.title = 'Drag to move note to another trade';
    handle.addEventListener('mousedown', () => { _noteItemDragFromHandle = true; });

    const lbl = document.createElement('div');
    lbl.className = 'obs-trade-note-label';
    lbl.textContent = label;

    const tb = document.createElement('div'); tb.className = 'obs-trade-note-toolbar';
    [['B', 'bold'], ['I', 'italic'], ['U', 'underline']].forEach(([lbl2, cmd]) => {
      const btn = document.createElement('button'); btn.className = 'note-popup-tool';
      btn.innerHTML = `<${lbl2.toLowerCase()}>${lbl2}</${lbl2.toLowerCase()}>`;
      btn.addEventListener('mousedown', e => { e.preventDefault(); document.execCommand(cmd); });
      tb.appendChild(btn);
    });

    const editor = document.createElement('div');
    editor.className = 'obs-trade-note-editor';
    editor.contentEditable = 'true';
    editor.spellcheck = false;
    editor.dataset.rowIdx = rowIdx;
    const stored = (rowIdx >= 0 && state.trades[rowIdx]) ? (state.trades[rowIdx][NOTE_COLUMN] || '') : '';
    editor.innerHTML = stored || '<br>';

    editor.addEventListener('blur', () => {
      const ri = parseInt(editor.dataset.rowIdx, 10);
      if (!isNaN(ri) && state.trades[ri]) {
        const val = stripHtml(editor.innerHTML).trim() ? editor.innerHTML : '';
        state.trades[ri][NOTE_COLUMN] = val;
        saveTrades();
        document.querySelectorAll(`[data-note-row="${ri}"]`).forEach(el => _refreshNoteCellDisplay(el, val));
      }
    });

    lbl.style.cursor = 'pointer';
    lbl.title = 'Click to focus note';
    lbl.addEventListener('click', ev => { ev.preventDefault(); editor.focus(); });

    item.setAttribute('draggable', 'true');
    item.addEventListener('dragstart', e => {
      if (!_noteItemDragFromHandle) { e.preventDefault(); return; }
      _noteItemDragFromHandle = false;
      const srcHtml = stripHtml(editor.innerHTML).trim() ? editor.innerHTML : '';
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('tj-note', JSON.stringify({ rowIdx, html: srcHtml }));
      item.classList.add('obs-note-dragging');
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('obs-note-dragging');
      container.querySelectorAll('.obs-note-drop-target').forEach(el => el.classList.remove('obs-note-drop-target'));
    });
    item.addEventListener('dragover', e => {
      if (!e.dataTransfer.types.includes('tj-note')) return;
      e.preventDefault();
      container.querySelectorAll('.obs-note-drop-target').forEach(el => el.classList.remove('obs-note-drop-target'));
      item.classList.add('obs-note-drop-target');
    });
    item.addEventListener('dragleave', () => item.classList.remove('obs-note-drop-target'));
    item.addEventListener('drop', e => {
      e.preventDefault();
      item.classList.remove('obs-note-drop-target');
      const raw = e.dataTransfer.getData('tj-note');
      if (!raw) return;
      const { rowIdx: srcIdx, html: srcHtml } = JSON.parse(raw);
      const destIdx = parseInt(item.dataset.rowIdx, 10);
      if (srcIdx === destIdx || isNaN(destIdx)) return;
      state.trades[destIdx][NOTE_COLUMN] = srcHtml;
      state.trades[srcIdx][NOTE_COLUMN] = '';
      saveTrades();
      renderObsTradeNotes(state.obsDate);
    });

    item.appendChild(handle);
    item.appendChild(lbl);
    item.appendChild(tb);
    item.appendChild(editor);
    container.appendChild(item);
  });
}

function saveObservation(andClose = true) {
  const html = document.getElementById('obs-editor').innerHTML;
  const trade = getOrCreateTrade(state.obsDate);
  trade.observation = html;
  document.querySelectorAll('#obs-trade-notes .obs-trade-note-editor').forEach(ed => {
    const ri = parseInt(ed.dataset.rowIdx, 10);
    if (!isNaN(ri) && state.trades[ri]) {
      state.trades[ri][NOTE_COLUMN] = stripHtml(ed.innerHTML).trim() ? ed.innerHTML : '';
    }
  });
  saveTrades();
  renderCalendar();
  renderTable();
  if (andClose) {
    document.getElementById('obs-modal').classList.remove('open');
    showToast('Observation saved!', 'success');
  }
}

function navigateObsDate(dir) {
  saveObservation(false);

  const dataOnly = document.getElementById('obs-data-only').checked;
  let dates;
  if (dataOnly) {
    dates = state.trades.filter(t => t.date).map(t => t.date).sort();
  } else {
    const dim = new Date(state.year, state.month + 1, 0).getDate();
    dates = Array.from({ length: dim }, (_, i) => formatDate(new Date(state.year, state.month, i + 1)));
  }

  let idx = dates.indexOf(state.obsDate);
  if (idx === -1) idx = dir > 0 ? -1 : dates.length;
  const next = idx + dir;
  if (next < 0 || next >= dates.length) return;
  openObsModal(dates[next]);
}

function bindObsToolbar() {
  document.querySelectorAll('.obs-tool[data-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      document.getElementById('obs-editor').focus();
      document.execCommand(btn.dataset.cmd, false, btn.dataset.val || null);
    });
  });

  document.getElementById('obs-apply-size').addEventListener('mousedown', e => {
    e.preventDefault();
    const size = document.getElementById('obs-custom-size').value;
    if (!size) return;
    const editor = document.getElementById('obs-editor');
    editor.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const span = document.createElement('span');
      span.style.fontSize = size + 'px';
      const zws = document.createTextNode('\u200B'); // zero-width space as placeholder
      span.appendChild(zws);
      range.insertNode(span);
      const nr = document.createRange();
      nr.setStart(zws, 1); nr.collapse(true);
      sel.removeAllRanges(); sel.addRange(nr);
    } else {
      const range = sel.getRangeAt(0);
      const span = document.createElement('span');
      span.style.fontSize = size + 'px';
      try { range.surroundContents(span); }
      catch (ex) { document.execCommand('insertHTML', false, `<span style="font-size:${size}px">${range.toString()}</span>`); }
    }
  });

  document.getElementById('obs-insert-img').addEventListener('click', () => {
    document.getElementById('obs-img-input').click();
  });
  document.getElementById('obs-img-input').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      document.getElementById('obs-editor').focus();
      document.execCommand('insertHTML', false,
        `<img src="${ev.target.result}" style="max-width:100%;border-radius:6px;margin:6px 0" />`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  document.getElementById('obs-insert-link').addEventListener('click', () => {
    const url = prompt('Enter URL (e.g. https://example.com):');
    if (!url) return;
    document.getElementById('obs-editor').focus();
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      document.execCommand('createLink', false, url);
    } else {
      document.execCommand('insertHTML', false, `<a href="${url}" target="_blank">${url}</a>`);
    }
  });

  document.getElementById('obs-editor').addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault(); e.stopPropagation();
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
    }
  });
}
