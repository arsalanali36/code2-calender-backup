# JS - CsvLog Charts + Media
Consolidated code context for AI assistants.


## File: `static/js/csvlog-charts.js`
```js
/**
 * @fileoverview Logger charts derived from CSVLog schema/data.
 * @exports openCsvLogChartsModal, closeCsvLogChartsModal
 */

let _clChartsBackdrop = null;
let _clChartsSchema = null;
let _clChartsView = 'sliders';
let _clChartsPopupState = null;
let _clChartsFieldPickerOpen = false;
let _clChartsSliderViewMode = 'detailed';
let _clChartsExpandedDates = new Set();
let _clChartsColWidths = {};
let _clChartsActiveSliderKey = '';
let _clChartsAltViewModes = { options: 'view1', yn: 'view1' };

const _CL_CHARTS_POPUP_COLS_KEY = 'tj_csvlog_chart_popup_cols';
const _CL_CHARTS_DEFAULT_POPUP_COLS = ['date', 'instrument', 'tradeType', 'pnl', 'points'];
const _CL_CHARTS_VISIBLE_FIELDS_KEY = 'tj_csvlog_charts_visible_fields';
const _CL_CHARTS_SLIDER_VIEW_KEY = 'tj_csvlog_slider_view_mode';
const _CL_CHARTS_SLIDER_WIDTHS_KEY = 'tj_csvlog_slider_col_widths';
const _CL_CHARTS_ALT_VIEWS_KEY = 'tj_csvlog_alt_view_modes';

async function openCsvLogChartsModal() {
  if (_clChartsBackdrop) closeCsvLogChartsModal();

  const schema = _clSchema || await csvlogService.getSchema();
  if (!schema || schema.error) {
    showToast('LOGGER schema load nahi hua', 'error');
    return;
  }
  _clChartsSchema = schema;

  const trades = _clChartsGetRows();
  if (!trades.length) {
    showToast('CSVLog data nahi mila charts ke liye', 'error');
    return;
  }

  _clChartsView = 'sliders';
  _clChartsPopupState = null;
  _clChartsExpandedDates = new Set();
  _clChartsSliderViewMode = _clChartsLoadSliderViewMode();
  _clChartsColWidths = _clChartsLoadColWidths();
  _clChartsAltViewModes = _clChartsLoadAltViewModes();

  _clChartsBackdrop = document.createElement('div');
  _clChartsBackdrop.className = 'clc-backdrop';
  _clChartsBackdrop.innerHTML = `
    <div class="clc-panel">
      <div class="clc-header">
        <div>
          <div class="clc-title">Logger Charts</div>
          <div class="clc-subtitle">CSV logger sliders, options, and Y/N data</div>
        </div>
        <button class="clc-close-btn" id="clc-close-btn">&#10005;</button>
      </div>
      <div class="clc-body">
        <div class="clc-sidebar">
          <button class="clc-side-btn active" data-clc-view="sliders">Sliders</button>
          <button class="clc-side-btn" data-clc-view="options">Options</button>
          <button class="clc-side-btn" data-clc-view="yn">Y / N</button>
        </div>
        <div class="clc-main">
          <div class="clc-toolbar">
            <div class="clc-toolbar-copy">
              <div class="clc-toolbar-title" id="clc-toolbar-title">Sliders by Date</div>
              <div class="clc-toolbar-meta" id="clc-toolbar-meta"></div>
            </div>
            <div class="clc-toolbar-right">
              <label class="clc-view-wrap" id="clc-view-wrap">
                <select id="clc-view-mode" class="clc-view-select">
                  <option value="compact">Compact</option>
                  <option value="detailed">Detailed</option>
                </select>
              </label>
              <button class="clc-toolbar-fields-btn" id="clc-toolbar-fields-btn">Show Fields</button>
            </div>
          </div>
          <div class="clc-toolbar-field-picker" id="clc-toolbar-field-picker"></div>
          <div class="clc-content" id="clc-content"></div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(_clChartsBackdrop);
  _clChartsBackdrop.addEventListener('click', e => {
    if (e.target === _clChartsBackdrop) closeCsvLogChartsModal();
  });
  _clChartsBackdrop.querySelector('#clc-close-btn').addEventListener('click', closeCsvLogChartsModal);
  _clChartsBackdrop.querySelector('#clc-toolbar-fields-btn').addEventListener('click', e => {
    e.stopPropagation();
    _clChartsFieldPickerOpen = !_clChartsFieldPickerOpen;
    _clChartsRenderToolbarFieldPicker();
  });
  _clChartsBackdrop.querySelector('#clc-view-mode').addEventListener('change', e => {
    if (_clChartsView === 'sliders') {
      _clChartsSliderViewMode = e.target.value === 'compact' ? 'compact' : 'detailed';
      localStorage.setItem(_CL_CHARTS_SLIDER_VIEW_KEY, _clChartsSliderViewMode);
    } else {
      _clChartsAltViewModes[_clChartsView] = e.target.value === 'view2' ? 'view2' : 'view1';
      localStorage.setItem(_CL_CHARTS_ALT_VIEWS_KEY, JSON.stringify(_clChartsAltViewModes));
    }
    _clChartsRender();
  });
  _clChartsBackdrop.querySelectorAll('.clc-side-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _clChartsView = btn.dataset.clcView;
      _clChartsFieldPickerOpen = false;
      _clChartsRender();
    });
  });
  _clChartsBackdrop.querySelector('#clc-toolbar-field-picker').addEventListener('click', e => e.stopPropagation());
  _clChartsBackdrop.querySelector('.clc-panel').addEventListener('click', () => {
    if (_clChartsFieldPickerOpen) {
      _clChartsFieldPickerOpen = false;
      _clChartsRenderToolbarFieldPicker();
    }
  });

  document.addEventListener('keydown', _clChartsEscKey);
  _clChartsRender();
}

function closeCsvLogChartsModal() {
  document.removeEventListener('keydown', _clChartsEscKey);
  if (_clChartsBackdrop) {
    _clChartsBackdrop.remove();
    _clChartsBackdrop = null;
  }
  _clChartsPopupState = null;
}

function _clChartsEscKey(e) {
  if (e.key !== 'Escape') return;
  if (_clChartsPopupState) {
    _clChartsPopupState = null;
    _clChartsRenderPopup();
    return;
  }
  if (_clChartsFieldPickerOpen) {
    _clChartsFieldPickerOpen = false;
    _clChartsRenderToolbarFieldPicker();
    return;
  }
  closeCsvLogChartsModal();
}

function _clChartsRender() {
  if (!_clChartsBackdrop) return;
  _clChartsBackdrop.querySelectorAll('.clc-side-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.clcView === _clChartsView);
  });

  const titleMap = {
    sliders: 'Sliders by Date',
    options: 'Options Occurrence',
    yn: 'Y / N Occurrence'
  };
  const toolbarTitle = _clChartsBackdrop.querySelector('#clc-toolbar-title');
  const toolbarMeta = _clChartsBackdrop.querySelector('#clc-toolbar-meta');
  const viewWrap = _clChartsBackdrop.querySelector('#clc-view-wrap');
  const viewSelect = _clChartsBackdrop.querySelector('#clc-view-mode');
  if (toolbarTitle) toolbarTitle.textContent = titleMap[_clChartsView] || 'Logger Charts';
  if (viewWrap) viewWrap.style.display = 'inline-flex';
  if (viewSelect) {
    if (_clChartsView === 'sliders') {
      viewSelect.innerHTML = `
        <option value="compact">Compact</option>
        <option value="detailed">Detailed</option>
      `;
      viewSelect.value = _clChartsSliderViewMode;
    } else {
      viewSelect.innerHTML = `
        <option value="view1">View 1</option>
        <option value="view2">View 2</option>
      `;
      viewSelect.value = _clChartsAltViewModes[_clChartsView] === 'view2' ? 'view2' : 'view1';
    }
  }

  const rows = _clChartsGetRows();
  const catalog = _clChartsGetCatalog();
  if (toolbarMeta) {
    toolbarMeta.textContent = `${rows.length} trade entries • ${catalog.sliders.length} sliders • ${catalog.options.length} options • ${catalog.yn.length} y/n`;
  }

  if (toolbarMeta) toolbarMeta.textContent = '';
  const content = _clChartsBackdrop.querySelector('#clc-content');
  if (!content) return;
  content.innerHTML = '';
  _clChartsRenderToolbarFieldPicker();

  if (_clChartsView === 'sliders') _clChartsRenderSliders(content, rows, _clChartsGetVisibleChartFields(catalog.sliders, 'sliders'));
  else if (_clChartsView === 'options') _clChartsRenderOptions(content, rows, _clChartsGetVisibleChartFields(catalog.options, 'options'));
  else _clChartsRenderYn(content, rows, _clChartsGetVisibleChartFields(catalog.yn, 'yn'));

  _clChartsRenderPopup();
}

function _clChartsGetRows() {
  const filtered = typeof getFilteredTrades === 'function' ? getFilteredTrades() : state.trades;
  return state.trades
    .map((trade, rowIdx) => ({ trade, rowIdx }))
    .filter(entry => filtered.includes(entry.trade))
    .map(({ trade, rowIdx }) => ({
      trade,
      rowIdx,
      date: normalizeDate(trade['trade_date'] || trade['Date'] || trade.date || ''),
      pnl: getTradePnl(trade),
      points: parseNumber(trade['Pt'] || trade['pt']),
      instrument: trade['Instrument'] || trade.instrument || '-',
      tradeType: trade['TradeType'] || trade.tradetype || '-',
      broker: trade['Broker'] || trade.broker || '-',
      qty: parseNumber(trade['Qty'] || trade.qty),
      entry: trade['Buy Time'] || trade['Sell Time'] || '',
      exit: trade['Sell Time'] || trade['Buy Time'] || ''
    }))
    .filter(entry => entry.date && entry.trade.csvlog && Object.keys(entry.trade.csvlog || {}).length);
}

function _clChartsGetCatalog() {
  const schema = _clChartsSchema || { groups: [], fields: {} };
  const out = { sliders: [], options: [], yn: [] };

  (schema.groups || []).forEach(group => {
    const groupKey = _clChartsToKey(group);
    let sectionKey = '';
    (schema.fields[group] || []).forEach(field => {
      const type = String(field.type || '').trim();
      const head = String(field.head || '').trim();
      if (!head) return;
      if (type === '-') {
        sectionKey = _clChartsToKey(head);
        return;
      }
      const fieldKey = sectionKey ? `${sectionKey}_${_clChartsToKey(head)}` : _clChartsToKey(head);
      const descriptor = {
        group,
        groupKey,
        head,
        fieldKey,
        label: head,
        fullLabel: `${group} / ${head}`,
        type,
        options: Array.isArray(field.options) ? field.options : []
      };
      if (type === 'Switch') out.yn.push(descriptor);
      else if (type === 'Range' && _clChartsIsNumericRange(descriptor.options)) out.sliders.push(descriptor);
      else if (type === 'Dropdown' || type === 'Range') out.options.push(descriptor);
    });
  });

  return out;
}

function _clChartsRenderSliders(content, rows, fields) {
  if (!fields.length) {
    content.innerHTML = '<div class="clc-empty">Schema me numeric slider fields nahi mile.</div>';
    return;
  }

  const sliderGroups = _clChartsGroupSliderFields(fields);
  const sliderColumns = sliderGroups.flatMap(group => group.columns.map(col => ({
    ...col,
    groupTitle: group.title,
    toolbarTitle: `${group.title} / ${col.title}`
  })));
  if (!_clChartsActiveSliderKey || !sliderColumns.some(col => col.key === _clChartsActiveSliderKey)) {
    _clChartsActiveSliderKey = sliderColumns[0]?.key || '';
  }
  const activeCol = sliderColumns.find(col => col.key === _clChartsActiveSliderKey) || sliderColumns[0];
  if (!activeCol) {
    content.innerHTML = '<div class="clc-empty">Visible slider tabs nahi mile.</div>';
    return;
  }

  const toolbarTitle = _clChartsBackdrop?.querySelector('#clc-toolbar-title');
  if (toolbarTitle) toolbarTitle.textContent = activeCol.toolbarTitle;

  const byDate = new Map();
  rows.forEach(row => {
    if (!byDate.has(row.date)) byDate.set(row.date, []);
    byDate.get(row.date).push(row);
  });

  const wrap = document.createElement('div');
  wrap.className = 'clc-slider-groups';
  const tabs = document.createElement('div');
  tabs.className = 'clc-slider-tabs';
  tabs.innerHTML = sliderColumns.map(col => `
    <button class="clc-slider-tab ${col.key === activeCol.key ? 'active' : ''}" data-clc-slider-tab="${col.key}">
      <span class="clc-slider-tab-group">${col.groupTitle}</span>
      <span class="clc-slider-tab-title">${col.title}</span>
    </button>
  `).join('');
  wrap.appendChild(tabs);

  const card = document.createElement('div');
  card.className = 'clc-card clc-slider-card';

  const tableWrap = document.createElement('div');
  tableWrap.className = 'clc-grid-wrap clc-grid-wrap-slider';
  const table = document.createElement('table');
  table.className = 'clc-grid-table clc-slider-table clc-slider-focus-table';

  const colgroup = document.createElement('colgroup');
  [
    ['date', 170],
    ['total', 140],
    ['in', 220],
    ['out', 220]
  ].forEach(([name, fallback]) => {
    const colEl = document.createElement('col');
    const widthKey = `${activeCol.key}|${name}`;
    const width = parseInt(_clChartsColWidths[widthKey], 10);
    colEl.style.width = `${Number.isFinite(width) ? width : fallback}px`;
    colgroup.appendChild(colEl);
  });
  table.appendChild(colgroup);

  const thead = document.createElement('thead');
  const hr1 = document.createElement('tr');
  hr1.innerHTML = `
    <th>Date</th>
    <th data-clc-col="${activeCol.key}|total"><div class="clc-th-wrap"><span>Total</span><span class="clc-col-resizer" data-clc-resize="${activeCol.key}|total"></span></div></th>
    <th data-clc-col="${activeCol.key}|in"><div class="clc-th-wrap"><span>In</span><span class="clc-col-resizer" data-clc-resize="${activeCol.key}|in"></span></div></th>
    <th data-clc-col="${activeCol.key}|out"><div class="clc-th-wrap"><span>Out</span><span class="clc-col-resizer" data-clc-resize="${activeCol.key}|out"></span></div></th>
  `;
  thead.appendChild(hr1);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  Array.from(byDate.keys()).sort().forEach(date => {
    const tr = document.createElement('tr');
    const expanded = _clChartsExpandedDates.has(date);
    tr.innerHTML = `
      <td class="clc-date-cell">
        <button class="clc-expand-btn ${expanded ? 'open' : ''}" data-clc-date="${date}" aria-label="Expand date row">&#8250;</button>
        <span>${_clChartsFormatDateShort(date)}</span>
      </td>`;
    tr.appendChild(_clChartsBuildAmountTd(_clChartsSumRowAmounts(byDate.get(date))));
    if (activeCol.pair) {
      tr.appendChild(_clChartsBuildSliderTd(byDate.get(date), activeCol.inField, date, 'in'));
      tr.appendChild(_clChartsBuildSliderTd(byDate.get(date), activeCol.outField, date, 'out'));
    } else {
      tr.appendChild(_clChartsBuildSliderTd(byDate.get(date), activeCol.field, date, 'in'));
      const td = document.createElement('td');
      td.innerHTML = '<span class="clc-cell-empty">-</span>';
      tr.appendChild(td);
    }
    tbody.appendChild(tr);

    if (expanded) {
      byDate.get(date).forEach((row, idx) => {
        const detailTr = document.createElement('tr');
        detailTr.className = 'clc-detail-row';
        detailTr.innerHTML = `
          <td class="clc-date-cell clc-date-cell-sub">
            <span class="clc-detail-indent"></span>
            ${_clChartsDetailLabel(row, idx)}
          </td>`;
        detailTr.appendChild(_clChartsBuildAmountTd(parseNumber(row.pnl)));
        if (activeCol.pair) {
          detailTr.appendChild(_clChartsBuildSliderTd([row], activeCol.inField, date, 'in'));
          detailTr.appendChild(_clChartsBuildSliderTd([row], activeCol.outField, date, 'out'));
        } else {
          detailTr.appendChild(_clChartsBuildSliderTd([row], activeCol.field, date, 'in'));
          const td = document.createElement('td');
          td.innerHTML = '<span class="clc-cell-empty">-</span>';
          detailTr.appendChild(td);
        }
        tbody.appendChild(detailTr);
      });
    }
  });

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  card.appendChild(tableWrap);
  wrap.appendChild(card);

  content.appendChild(wrap);
  wrap.querySelectorAll('[data-clc-slider-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      _clChartsActiveSliderKey = btn.dataset.clcSliderTab || '';
      _clChartsRender();
    });
  });
  _clChartsBindColumnResizers(table);
  _clChartsBindExpandButtons(content);
}

function _clChartsRenderOptions(content, rows, fields) {
  if (_clChartsAltViewModes.options === 'view2') {
    _clChartsRenderOccurrenceMatrix(content, rows, fields, false);
    return;
  }
  _clChartsRenderOccurrenceBlocks(content, rows, fields, false);
}

function _clChartsRenderYn(content, rows, fields) {
  if (_clChartsAltViewModes.yn === 'view2') {
    _clChartsRenderOccurrenceMatrix(content, rows, fields, true);
    return;
  }
  _clChartsRenderOccurrenceBlocks(content, rows, fields, true);
}

function _clChartsRenderOccurrenceBlocks(content, rows, fields, ynMode) {
  if (!fields.length) {
    content.innerHTML = `<div class="clc-empty">Schema me ${ynMode ? 'Y/N' : 'option'} fields nahi mile.</div>`;
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'clc-blocks';

  fields.forEach(field => {
    const values = ynMode ? ['Y', 'N'] : _clChartsGetValueList(rows, field);
    const card = document.createElement('div');
    card.className = 'clc-card';
    const hdr = document.createElement('div');
    hdr.className = 'clc-card-hdr';
    hdr.textContent = field.fullLabel;
    card.appendChild(hdr);

    values.forEach(value => {
      const posRows = rows.filter(row => _clChartsGetFieldValue(row.trade, field) === value && (row.pnl || 0) >= 0);
      const negRows = rows.filter(row => _clChartsGetFieldValue(row.trade, field) === value && (row.pnl || 0) < 0);
      const rowEl = document.createElement('div');
      rowEl.className = 'clc-occ-row';
      rowEl.innerHTML = `
        <div class="clc-occ-label">${value}</div>
        <div class="clc-occ-bars">
          <button class="clc-occ-bar neg" ${negRows.length ? '' : 'disabled'}><span>${negRows.length}</span></button>
          <button class="clc-occ-bar pos" ${posRows.length ? '' : 'disabled'}><span>${posRows.length}</span></button>
        </div>
      `;
      const [negBtn, posBtn] = rowEl.querySelectorAll('.clc-occ-bar');
      if (negRows.length) negBtn.addEventListener('click', () => _clChartsOpenPopup(`${field.fullLabel} • ${value} • Negative`, negRows, field));
      if (posRows.length) posBtn.addEventListener('click', () => _clChartsOpenPopup(`${field.fullLabel} • ${value} • Positive`, posRows, field));
      card.appendChild(rowEl);
    });

    wrap.appendChild(card);
  });

  content.appendChild(wrap);
}

function _clChartsRenderOccurrenceMatrix(content, rows, fields, ynMode) {
  if (!fields.length) {
    content.innerHTML = `<div class="clc-empty">Schema me ${ynMode ? 'Y/N' : 'option'} fields nahi mile.</div>`;
    return;
  }

  const grouped = new Map();
  fields.forEach(field => {
    if (!grouped.has(field.group)) grouped.set(field.group, []);
    grouped.get(field.group).push(field);
  });

  const wrap = document.createElement('div');
  wrap.className = 'clc-blocks';

  Array.from(grouped.entries()).forEach(([groupTitle, groupFields]) => {
    const card = document.createElement('div');
    card.className = 'clc-card';
    card.innerHTML = `<div class="clc-card-hdr">${groupTitle}</div>`;

    if (ynMode) {
      const table = document.createElement('div');
      table.className = 'clc-occ-matrix';
      table.innerHTML = `
        <div class="clc-occ-matrix-head">
          <div>Field</div>
          <div>Y</div>
          <div>N</div>
        </div>
      `;

      groupFields.forEach(field => {
        const rowEl = document.createElement('div');
        rowEl.className = 'clc-occ-matrix-row';
        rowEl.innerHTML = `<div class="clc-occ-matrix-label">${field.label}</div>`;
        ['Y', 'N'].forEach(value => {
          const cell = _clChartsBuildOccurrenceMatrixCell(rows, field, value);
          rowEl.appendChild(cell);
        });
        table.appendChild(rowEl);
      });

      card.appendChild(table);
    } else {
      const list = document.createElement('div');
      list.className = 'clc-occ-option-list';
      groupFields.forEach(field => {
        const rowEl = document.createElement('div');
        rowEl.className = 'clc-occ-option-row';
        rowEl.innerHTML = `<div class="clc-occ-option-label">${field.label}</div>`;

        const valuesWrap = document.createElement('div');
        valuesWrap.className = 'clc-occ-option-values';
        _clChartsGetValueList(rows, field).forEach(value => {
          const chip = document.createElement('div');
          chip.className = 'clc-occ-option-chip';
          chip.innerHTML = `<span class="clc-occ-option-chip-label">${value}</span>`;
          chip.appendChild(_clChartsBuildOccurrenceMatrixCell(rows, field, value));
          valuesWrap.appendChild(chip);
        });
        rowEl.appendChild(valuesWrap);
        list.appendChild(rowEl);
      });
      card.appendChild(list);
    }

    wrap.appendChild(card);
  });

  content.appendChild(wrap);
}


```

## File: `static/js/csvlog-charts-b.js`
```js
function _clChartsGetValueList(rows, field) {
  const set = new Set((field.options || []).map(v => String(v).trim()).filter(Boolean));
  rows.forEach(row => {
    const value = _clChartsGetFieldValue(row.trade, field);
    if (value !== '' && value !== null && value !== undefined) set.add(String(value).trim());
  });
  return Array.from(set);
}

function _clChartsBuildOccurrenceMatrixCell(rows, field, value) {
  const posRows = rows.filter(row => _clChartsGetFieldValue(row.trade, field) === value && (row.pnl || 0) >= 0);
  const negRows = rows.filter(row => _clChartsGetFieldValue(row.trade, field) === value && (row.pnl || 0) < 0);
  const cell = document.createElement('div');
  cell.className = 'clc-occ-mini-split';
  cell.innerHTML = `
    <button class="clc-occ-mini neg" ${negRows.length ? '' : 'disabled'}>${negRows.length}</button>
    <button class="clc-occ-mini pos" ${posRows.length ? '' : 'disabled'}>${posRows.length}</button>
  `;
  const [negBtn, posBtn] = cell.querySelectorAll('.clc-occ-mini');
  if (negRows.length) negBtn.addEventListener('click', () => _clChartsOpenPopup(`${field.fullLabel} • ${value} • Negative`, negRows, field));
  if (posRows.length) posBtn.addEventListener('click', () => _clChartsOpenPopup(`${field.fullLabel} • ${value} • Positive`, posRows, field));
  return cell;
}

function _clChartsOpenPopup(title, rows, field) {
  _clChartsPopupState = { title, rows, field, chooserOpen: false };
  _clChartsRenderPopup();
}

function _clChartsRenderToolbarFieldPicker() {
  if (!_clChartsBackdrop) return;
  const picker = _clChartsBackdrop.querySelector('#clc-toolbar-field-picker');
  const btn = _clChartsBackdrop.querySelector('#clc-toolbar-fields-btn');
  if (!picker || !btn) return;

  const catalog = _clChartsGetCatalog();
  const currentFields = _clChartsView === 'sliders' ? catalog.sliders : _clChartsView === 'options' ? catalog.options : catalog.yn;
  const visible = new Set(_clChartsGetVisibleChartFields(currentFields, _clChartsView).map(f => `${f.groupKey}|${f.fieldKey}`));

  btn.textContent = _clChartsFieldPickerOpen ? 'Hide Fields' : 'Show Fields';
  picker.classList.toggle('open', _clChartsFieldPickerOpen);
  picker.innerHTML = '';
  if (!_clChartsFieldPickerOpen) return;

  currentFields.forEach(field => {
    const key = `${field.groupKey}|${field.fieldKey}`;
    const item = document.createElement('label');
    item.className = 'clc-toolbar-field-item';
    item.innerHTML = `<input type="checkbox" ${visible.has(key) ? 'checked' : ''}/> <span>${field.fullLabel}</span>`;
    item.querySelector('input').addEventListener('change', e => {
      const current = new Set(_clChartsGetVisibleFieldKeys(_clChartsView, currentFields));
      if (e.target.checked) current.add(key);
      else if (current.size > 1) current.delete(key);
      _clChartsSetVisibleFieldKeys(_clChartsView, Array.from(current));
      _clChartsRender();
    });
    picker.appendChild(item);
  });
}

function _clChartsRenderPopup() {
  if (!_clChartsBackdrop) return;
  _clChartsBackdrop.querySelectorAll('.clc-popup-backdrop').forEach(el => el.remove());
  if (!_clChartsPopupState) return;

  const popupCols = _clChartsGetPopupVisibleCols();
  const popup = document.createElement('div');
  popup.className = 'clc-popup-backdrop';
  popup.innerHTML = `
    <div class="clc-popup">
      <div class="clc-popup-hdr">
        <div>
          <div class="clc-popup-title">${_clChartsPopupState.title}</div>
          <div class="clc-popup-sub">${_clChartsPopupState.rows.length} rows</div>
        </div>
        <div class="clc-popup-actions">
          <button class="clc-popup-fields-btn" id="clc-popup-fields-btn">Show Fields</button>
          <button class="clc-close-btn" id="clc-popup-close-btn">&#10005;</button>
        </div>
      </div>
      <div class="clc-popup-field-picker ${_clChartsPopupState.chooserOpen ? 'open' : ''}" id="clc-popup-field-picker"></div>
      <div class="clc-popup-table-wrap">
        <table class="clc-popup-table">
          <thead><tr>${popupCols.map(key => `<th>${_clChartsPopupColumnMap()[key].label}</th>`).join('')}</tr></thead>
          <tbody>
            ${_clChartsPopupState.rows.map(row => `<tr>${popupCols.map(key => `<td>${_clChartsPopupEscape(_clChartsPopupColumnMap()[key].get(row, _clChartsPopupState.field))}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  _clChartsBackdrop.appendChild(popup);
  popup.addEventListener('click', e => {
    if (e.target === popup) {
      _clChartsPopupState = null;
      _clChartsRenderPopup();
    }
  });
  popup.querySelector('#clc-popup-close-btn').addEventListener('click', () => {
    _clChartsPopupState = null;
    _clChartsRenderPopup();
  });
  popup.querySelector('#clc-popup-fields-btn').addEventListener('click', () => {
    _clChartsPopupState.chooserOpen = !_clChartsPopupState.chooserOpen;
    _clChartsRenderPopup();
  });

  const picker = popup.querySelector('#clc-popup-field-picker');
  Object.entries(_clChartsPopupColumnMap()).filter(([key]) => key !== 'selectedValue').forEach(([key, meta]) => {
    const item = document.createElement('label');
    item.className = 'clc-popup-field-item';
    item.innerHTML = `<input type="checkbox" ${popupCols.includes(key) ? 'checked' : ''} /> <span>${meta.label}</span>`;
    item.querySelector('input').addEventListener('change', e => {
      const current = new Set(_clChartsGetPopupVisibleCols());
      if (e.target.checked) current.add(key);
      else if (current.size > 1) current.delete(key);
      _clChartsSetPopupVisibleCols(Array.from(current));
      _clChartsRenderPopup();
    });
    picker.appendChild(item);
  });
}

function _clChartsPopupColumnMap() {
  return {
    date: { label: 'Date', get: row => row.date },
    instrument: { label: 'Instrument', get: row => row.instrument },
    tradeType: { label: 'Trade Type', get: row => row.tradeType },
    broker: { label: 'Broker', get: row => row.broker },
    qty: { label: 'Qty', get: row => row.qty ?? '-' },
    pnl: { label: 'P/L (Rs)', get: row => row.pnl ?? '-' },
    points: { label: 'Points', get: row => row.points ?? '-' },
    selectedValue: { label: 'Selected Field', get: (row, field) => _clChartsGetFieldValue(row.trade, field) || '-' }
  };
}

function _clChartsGetPopupVisibleCols() {
  try {
    const parsed = JSON.parse(localStorage.getItem(_CL_CHARTS_POPUP_COLS_KEY) || 'null');
    if (Array.isArray(parsed) && parsed.length) {
      const filtered = parsed.filter(key => _clChartsPopupColumnMap()[key] && key !== 'selectedValue');
      if (filtered.length) return filtered;
    }
  } catch (e) { }
  return [..._CL_CHARTS_DEFAULT_POPUP_COLS];
}

function _clChartsSetPopupVisibleCols(cols) {
  localStorage.setItem(_CL_CHARTS_POPUP_COLS_KEY, JSON.stringify(cols));
}

function _clChartsGetVisibleChartFields(fields, viewKey) {
  const visibleKeys = new Set(_clChartsGetVisibleFieldKeys(viewKey, fields));
  return fields.filter(field => visibleKeys.has(`${field.groupKey}|${field.fieldKey}`));
}

function _clChartsGetVisibleFieldKeys(viewKey, fields) {
  try {
    const parsed = JSON.parse(localStorage.getItem(_CL_CHARTS_VISIBLE_FIELDS_KEY) || '{}');
    const list = Array.isArray(parsed[viewKey]) ? parsed[viewKey] : null;
    if (list && list.length) return list;
  } catch (e) { }
  return fields.map(field => `${field.groupKey}|${field.fieldKey}`);
}

function _clChartsSetVisibleFieldKeys(viewKey, keys) {
  let parsed = {};
  try {
    parsed = JSON.parse(localStorage.getItem(_CL_CHARTS_VISIBLE_FIELDS_KEY) || '{}') || {};
  } catch (e) { parsed = {}; }
  parsed[viewKey] = keys;
  localStorage.setItem(_CL_CHARTS_VISIBLE_FIELDS_KEY, JSON.stringify(parsed));
}

function _clChartsGetFieldValue(trade, field) {
  const groupData = trade.csvlog?.[field.groupKey] || {};
  return groupData[field.fieldKey] ?? '';
}

function _clChartsGroupSliderFields(fields) {
  const map = new Map();
  fields.forEach(field => {
    const parts = String(field.fieldKey || '').split('_');
    const suffix = parts[parts.length - 1];
    const isPair = ['in', 'out', 'entry', 'exit'].includes(suffix);
    const baseKey = isPair ? parts.slice(0, -1).join('_') : field.fieldKey;
    const title = _clChartsTitleize(baseKey.replace(/^.*?_/, '') || field.label);
    if (!map.has(baseKey)) map.set(baseKey, { key: baseKey, title, inField: null, outField: null, field: null });
    const item = map.get(baseKey);
    if (suffix === 'in' || suffix === 'entry') item.inField = field;
    else if (suffix === 'out' || suffix === 'exit') item.outField = field;
    else item.field = field;
  });

  const grouped = new Map();
  Array.from(map.values()).forEach(item => {
    const owner = item.inField || item.outField || item.field;
    const groupTitle = owner.group;
    if (!grouped.has(groupTitle)) grouped.set(groupTitle, []);
    grouped.get(groupTitle).push(
      item.inField || item.outField
        ? { key: item.key, title: item.title, pair: true, inField: item.inField, outField: item.outField }
        : { key: item.key, title: item.title, pair: false, field: item.field }
    );
  });

  return Array.from(grouped.entries()).map(([title, columns]) => ({ title, columns }));
}

function _clChartsBuildSliderTd(dateRows, field, date, tone) {
  const td = document.createElement('td');
  if (!field) {
    td.innerHTML = '<span class="clc-cell-empty">-</span>';
    return td;
  }
  const matchedRows = dateRows.filter(row => parseNumber(_clChartsGetFieldValue(row.trade, field)) !== null);
  if (!matchedRows.length) {
    td.innerHTML = '<span class="clc-cell-empty">-</span>';
    return td;
  }
  const values = matchedRows.map(row => parseNumber(_clChartsGetFieldValue(row.trade, field))).filter(v => v !== null);
  const min = parseFloat(field.options?.[0] ?? 0);
  const max = parseFloat(field.options?.[1] ?? 100);
  const span = Math.max(1, max - min);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const fillPct = Math.max(0, Math.min(100, ((avg - min) / span) * 100));
  const displayValue = String(Math.round(avg));
  td.innerHTML = `
    <button class="clc-slider-bar-btn ${tone} ${_clChartsSliderViewMode}">
      <span class="clc-slider-bar-track">
        <span class="clc-slider-bar-fill" style="width:${fillPct}%"></span>
        <span class="clc-slider-bar-track-val">${displayValue}</span>
      </span>
      <span class="clc-slider-bar-val">${displayValue}</span>
    </button>
  `;
  td.querySelector('button').addEventListener('click', () => {
    _clChartsOpenPopup(`${field.fullLabel} • ${date}`, matchedRows, field);
  });
  return td;
}

function _clChartsBuildPairedSliderTd(dateRows, col, date) {
  const td = document.createElement('td');
  const inRows = col.inField
    ? dateRows.filter(row => parseNumber(_clChartsGetFieldValue(row.trade, col.inField)) !== null)
    : [];
  const outRows = col.outField
    ? dateRows.filter(row => parseNumber(_clChartsGetFieldValue(row.trade, col.outField)) !== null)
    : [];

  const hasIn = !!inRows.length;
  const hasOut = !!outRows.length;
  if (!hasIn && !hasOut) {
    td.innerHTML = '<span class="clc-cell-empty">-</span>';
    return td;
  }

  td.className = 'clc-slider-pair-cell';
  td.innerHTML = `
    <div class="clc-slider-pair-stack">
      <button class="clc-slider-mini-row in ${_clChartsSliderViewMode} ${hasIn ? '' : 'empty'}" ${hasIn ? '' : 'disabled'}>
        <span class="clc-slider-mini-io">I</span>
        <span class="clc-slider-bar-track"><span class="clc-slider-bar-fill"></span><span class="clc-slider-bar-track-val">-</span></span>
        <span class="clc-slider-bar-val">-</span>
      </button>
      <button class="clc-slider-mini-row out ${_clChartsSliderViewMode} ${hasOut ? '' : 'empty'}" ${hasOut ? '' : 'disabled'}>
        <span class="clc-slider-mini-io">O</span>
        <span class="clc-slider-bar-track"><span class="clc-slider-bar-fill"></span><span class="clc-slider-bar-track-val">-</span></span>
        <span class="clc-slider-bar-val">-</span>
      </button>
    </div>
  `;

  const setRowUi = (selector, rows, field) => {
    const btn = td.querySelector(selector);
    if (!btn || !field || !rows.length) return;
    const values = rows.map(row => parseNumber(_clChartsGetFieldValue(row.trade, field))).filter(v => v !== null);
    const min = parseFloat(field.options?.[0] ?? 0);
    const max = parseFloat(field.options?.[1] ?? 100);
    const span = Math.max(1, max - min);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const fillPct = Math.max(0, Math.min(100, ((avg - min) / span) * 100));
    const displayValue = String(Math.round(avg));
    btn.querySelector('.clc-slider-bar-fill').style.width = `${fillPct}%`;
    btn.querySelector('.clc-slider-bar-val').textContent = displayValue;
    btn.querySelector('.clc-slider-bar-track-val').textContent = displayValue;
    btn.addEventListener('click', () => {
      _clChartsOpenPopup(`${field.fullLabel} • ${date}`, rows, field);
    });
  };

  setRowUi('.clc-slider-mini-row.in', inRows, col.inField);
  setRowUi('.clc-slider-mini-row.out', outRows, col.outField);
  return td;
}

function _clChartsBuildAmountTd(amount) {
  const td = document.createElement('td');
  td.className = 'clc-total-cell';
  const num = parseNumber(amount);
  if (num === null) {
    td.innerHTML = '<span class="clc-cell-empty">-</span>';
    return td;
  }
  const tone = num > 0 ? 'pos' : num < 0 ? 'neg' : 'neutral';
  td.innerHTML = `<span class="clc-total-amt ${tone}">${Math.round(Math.abs(num))}</span>`;
  return td;
}

function _clChartsSumRowAmounts(rows) {
  return rows.reduce((sum, row) => {
    const value = parseNumber(row.pnl);
    return sum + (value === null ? 0 : Math.abs(value));
  }, 0);
}

function _clChartsBindExpandButtons(root) {
  root.querySelectorAll('.clc-expand-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const date = btn.dataset.clcDate;
      if (!date) return;
      if (_clChartsExpandedDates.has(date)) _clChartsExpandedDates.delete(date);
      else _clChartsExpandedDates.add(date);
      _clChartsRender();
    });
  });
}

function _clChartsBindColumnResizers(table) {
  const cols = Array.from(table.querySelectorAll('colgroup col'));
  table.querySelectorAll('.clc-col-resizer').forEach(handle => {
    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      const key = handle.dataset.clcResize;
      const th = handle.closest('th');
      if (!th || !key) return;
      const ths = Array.from(th.parentElement.children);
      const colIndex = ths.indexOf(th);
      const startX = e.clientX;
      const startWidth = cols[colIndex]?.getBoundingClientRect().width || th.getBoundingClientRect().width;

      const onMove = moveEvt => {
        const width = Math.max(120, Math.round(startWidth + (moveEvt.clientX - startX)));
        if (cols[colIndex]) cols[colIndex].style.width = `${width}px`;
        _clChartsColWidths[key] = width;
      };
      const onUp = () => {
        localStorage.setItem(_CL_CHARTS_SLIDER_WIDTHS_KEY, JSON.stringify(_clChartsColWidths));
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  });
}

function _clChartsDetailLabel(row, idx) {
  const base = row.tradeType && row.tradeType !== '-' ? row.tradeType : `Trade ${idx + 1}`;
  const instrument = row.instrument && row.instrument !== '-' ? row.instrument : '';
  return instrument ? `${base} • ${instrument}` : base;
}

function _clChartsDetailLabel(row, idx) {
  return `
    <span class="clc-detail-trade-id">T${idx + 1}</span>
  `;
}

function _clChartsFormatDateShort(dateStr) {
  if (!dateStr) return '-';
  const dt = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return dateStr;
  return dt.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

function _clChartsLoadSliderViewMode() {
  return localStorage.getItem(_CL_CHARTS_SLIDER_VIEW_KEY) === 'compact' ? 'compact' : 'detailed';
}

function _clChartsLoadColWidths() {
  try {
    const parsed = JSON.parse(localStorage.getItem(_CL_CHARTS_SLIDER_WIDTHS_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function _clChartsLoadAltViewModes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(_CL_CHARTS_ALT_VIEWS_KEY) || '{}');
    return {
      options: parsed.options === 'view2' ? 'view2' : 'view1',
      yn: parsed.yn === 'view2' ? 'view2' : 'view1'
    };
  } catch (e) {
    return { options: 'view1', yn: 'view1' };
  }
}

function _clChartsTitleize(text) {
  return String(text || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function _clChartsToKey(text) {
  return String(text || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function _clChartsIsNumericRange(options) {
  return Array.isArray(options) && options.length === 2 && options.every(v => !isNaN(v));
}

function _clChartsPopupEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

```

## File: `static/js/csvlog-vitals.js`
```js
/**
 * @fileoverview csvlog-vitals.js
 * @description Body Vitals tab + bidirectional slider + conditional field-freeze rules.
 *   All functions global scope - called from csvlog.js / csvlog-fields.js.
 *
 * Body Vitals stored at: trade.csvlog.body_vitals = { alertness, neend, potty, sabar }
 *
 * Conditional freeze rules (hardcoded, keyed by group name):
 *   Zone  : zone_created = 'N' -> freeze size, candle
 *   Entry : at contains 'pehle' -> freeze breakout_candle
 */

/* ========================================================================
   BIDIRECTIONAL SLIDER
   Range with negative min -> visual bar grows left(-) or right(+) from 0
======================================================================== */
function _makeBiSlider(key, val, min, max, saved) {
  const cur = (val !== '' && val !== undefined && val !== null) ? Number(val) : 0;

  const wrap = document.createElement('div');
  wrap.className = 'cl-bislider-wrap';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'cl-bislider';
  slider.min = min;
  slider.max = max;
  slider.step = 1;
  slider.value = cur;
  slider.dataset.clCtrl = 'bislider';

  const badge = document.createElement('span');
  badge.className = 'cl-bislider-val';
  _biUpdateBadge(badge, cur);

  const track = document.createElement('div');
  track.className = 'cl-bislider-track';
  const fill = document.createElement('div');
  fill.className = 'cl-bislider-fill';
  track.appendChild(fill);
  _biUpdateFill(fill, cur, min, max);

  slider.addEventListener('input', () => {
    const v = Number(slider.value);
    saved[key] = v;
    _biUpdateBadge(badge, v);
    _biUpdateFill(fill, v, min, max);
    _clAutoSave();
  });

  slider.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      _clNavigate(+1, slider);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      _clNavigate(-1, slider);
    }
  });

  const container = document.createElement('div');
  container.className = 'cl-bislider-container';
  container.appendChild(track);
  container.appendChild(slider);

  wrap.appendChild(container);
  wrap.appendChild(badge);
  return wrap;
}

function _biUpdateBadge(badge, v) {
  badge.textContent = String(v);
  badge.style.color = 'var(--blue)';
  badge.style.fontWeight = '700';
}

function _biUpdateFill(fill, v, min, max) {
  if (v === 0) {
    fill.style.cssText = 'width:0;left:50%;';
    return;
  }

  const zeroPct = ((0 - min) / (max - min)) * 100;
  if (v > 0) {
    const widthPct = (v / max) * (100 - zeroPct);
    fill.style.cssText = `left:${zeroPct}%;width:${widthPct}%;background:var(--blue);`;
  } else {
    const widthPct = (Math.abs(v) / Math.abs(min)) * zeroPct;
    fill.style.cssText = `left:${zeroPct - widthPct}%;width:${widthPct}%;background:var(--blue);`;
  }
}

/* ========================================================================
   BODY VITALS TAB
   Hardcoded tab - stored in trade.csvlog.body_vitals
======================================================================== */
const _VITALS_FIELDS = [
  { key: 'alertness', label: 'Alertness', min: -5, max: 5 },
  { key: 'neend', label: 'Neend (Sleep Quality)', min: -5, max: 5 },
  { key: 'potty', label: 'Potty', min: -5, max: 5 },
  { key: 'sabar', label: 'Sabar vs Impulsive', min: -5, max: 5 }
];

function _renderVitalsContent(body, trade) {
  body.style.padding = '20px 24px';
  body.style.overflow = 'auto';

  if (!trade.csvlog) trade.csvlog = {};
  if (!trade.csvlog.body_vitals) trade.csvlog.body_vitals = {};
  const saved = trade.csvlog.body_vitals;

  const wrap = document.createElement('div');
  wrap.className = 'cl-vitals-wrap';

  const hdr = document.createElement('div');
  hdr.className = 'cl-vitals-hdr';
  hdr.innerHTML = `
    <span class="cl-vitals-title">&#129498; Body Vitals</span>
    <span class="cl-vitals-hint">Scale: -5 (low) -> 0 -> 5 (high)</span>
  `;
  wrap.appendChild(hdr);

  const axisRow = document.createElement('div');
  axisRow.className = 'cl-vitals-row cl-vitals-axis';
  axisRow.innerHTML = `
    <div class="cl-vitals-label"></div>
    <div class="cl-vitals-axis-container">
      <span>-5</span><span>0</span><span>5</span>
    </div>
    <div style="min-width: 32px"></div>
  `;
  wrap.appendChild(axisRow);

  _VITALS_FIELDS.forEach(({ key, label, min, max }) => {
    const row = document.createElement('div');
    row.className = 'cl-vitals-row';
    row.dataset.clFieldKey = key;

    const lbl = document.createElement('div');
    lbl.className = 'cl-vitals-label';
    lbl.textContent = label;

    const curVal = saved[key] !== undefined ? saved[key] : 0;
    const slider = _makeBiSlider(key, curVal, min, max, saved);

    row.appendChild(lbl);
    row.appendChild(slider);
    wrap.appendChild(row);
  });

  body.appendChild(wrap);
}

/* ========================================================================
   CONDITIONAL FIELD FREEZE RULES
   Called after rendering each group to disable dependent fields.
======================================================================== */
const _CL_COND_RULES = {
  zone: [
    { watchKey: 'formed', value: 'N', freeze: ['size', 'candle'] }
  ],
  entry: [
    { watchKey: 'at', match: 'pehle', freeze: ['breakout_candle', 'breakoutcandle'] }
  ]
};

function _clApplyConditionals(groupKey, saved) {
  const rules = _CL_COND_RULES[groupKey] || [];
  rules.forEach(rule => {
    const val = String(saved[rule.watchKey] || '');
    const triggered = rule.value
      ? val === rule.value
      : val.toLowerCase().includes(rule.match.toLowerCase());
    _clFreezeFields(rule.freeze, triggered);
  });
}

function _clReapplyConditionals() {
  if (_clTab < 0 || !_clSchema) return;
  const { trade } = _clDayTrades[_clTab];
  const activeGrp = (_clGroupTab[_clTab] || _clSchema.groups[0]).toLowerCase();
  _clApplyConditionals(activeGrp, trade.csvlog?.[activeGrp] || {});
}

function _clFreezeFields(keySuffixes, freeze) {
  const body = document.getElementById('cl-body');
  if (!body) return;
  body.querySelectorAll('[data-cl-field-key]').forEach(wrap => {
    const wk = wrap.dataset.clFieldKey || '';
    if (keySuffixes.some(k => wk === k || wk.endsWith('_' + k))) {
      wrap.classList.toggle('cl-field-frozen', freeze);
    }
  });
}

```

## File: `static/js/csvlog-img.js`
```js
/**
 * @fileoverview csvlog-img.js
 * @description Image viewer, fullscreen zoom, drag-drop and clipboard paste for CSVLog modal.
 *   Split from csvlog.js to stay under 30 KB file-size limit.
 *   All functions are global scope — called from csvlog.js.
 */

/* ── Shared upload-to-trade helper ───────────────────────────────────────── */
// Used by viewer buttons, drag-drop and paste
async function _clUploadToTrade(files, trade, container) {
  const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (!arr.length) return;
  showToast('Uploading...', 'info');
  let added = 0;
  for (const file of arr) {
    try {
      const data = await imageService.uploadImage(file);
      if (data.url) { if (!trade.images) trade.images = []; trade.images.push(data.url); added++; }
    } catch (e) { showToast('Upload failed', 'error'); }
  }
  if (added) {
    _clImgIdx[_clTab] = trade.images.length - 1;
    await _clPersistNow();
    _renderImageViewer(container, trade);
    showToast(added + ' image' + (added > 1 ? 's' : '') + ' added', 'success');
  }
}

/* ── Drag-drop binding (called once per container) ───────────────────────── */
function _clBindImgDrop(container) {
  if (container._clDragBound) return;
  container._clDragBound = true;

  container.addEventListener('dragover', e => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    container.classList.add('cl-img-drop-target');
  });
  container.addEventListener('dragleave', e => {
    // Only remove if leaving the container itself (not a child)
    if (!container.contains(e.relatedTarget)) container.classList.remove('cl-img-drop-target');
  });
  container.addEventListener('drop', async e => {
    container.classList.remove('cl-img-drop-target');
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    e.preventDefault();
    if (_clTab < 0) return;
    const entry = _clDayTrades[_clTab];
    if (!entry) return;
    await _clUploadToTrade(files, entry.trade, container);
  });
}

/* ── Clipboard paste handler (registered on document while modal is open) ── */
async function _clImgPasteHandler(e) {
  if (!_clBackdrop || _clTab < 0) return;
  const t = e.target;
  if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName || '')) return;
  const items = e.clipboardData?.items;
  if (!items) return;
  const imgFiles = Array.from(items)
    .filter(it => it.type.startsWith('image/'))
    .map(it => it.getAsFile())
    .filter(Boolean);
  if (!imgFiles.length) return;
  e.preventDefault();
  const entry = _clDayTrades[_clTab];
  if (!entry) return;
  const container = document.querySelector('#cl-body .cl-img-col');
  if (!container) return;
  await _clUploadToTrade(imgFiles, entry.trade, container);
}

/* ── Image viewer (right column) ─────────────────────────────────────────── */
function _renderImageViewer(container, trade) {
  const images = trade.images || [];
  container.innerHTML = '';

  // Bind drag-drop once per container instance
  _clBindImgDrop(container);

  // Upload button (reused in both empty + nav states)
  const _mkUploadBtn = () => {
    const label = document.createElement('label');
    label.className = 'cl-img-upload-btn';
    label.title = 'Upload image(s)';
    label.innerHTML = '&#128247;';
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.style.display = 'none';
    inp.addEventListener('change', e => {
      if (e.target.files.length) _clUploadToTrade(e.target.files, trade, container);
      inp.value = '';
    });
    label.appendChild(inp);
    return label;
  };

  if (!images.length) {
    const empty = document.createElement('div');
    empty.className = 'cl-img-empty';
    empty.innerHTML = '<div>No images</div><div style="font-size:0.75rem;color:var(--text-muted)">Drop, paste, or</div>';
    empty.appendChild(_mkUploadBtn());
    container.appendChild(empty);
    return;
  }

  if (_clImgIdx[_clTab] === undefined) _clImgIdx[_clTab] = 0;
  const idx = Math.max(0, Math.min(_clImgIdx[_clTab], images.length - 1));
  _clImgIdx[_clTab] = idx;

  const src = images[idx];

  const viewer = document.createElement('div');
}

/* ── Drag-drop binding (called once per container) ───────────────────────── */
function _clBindImgDrop(container) {
  if (container._clDragBound) return;
  container._clDragBound = true;

  container.addEventListener('dragover', e => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    container.classList.add('cl-img-drop-target');
  });
  container.addEventListener('dragleave', e => {
    // Only remove if leaving the container itself (not a child)
    if (!container.contains(e.relatedTarget)) container.classList.remove('cl-img-drop-target');
  });
  container.addEventListener('drop', async e => {
    container.classList.remove('cl-img-drop-target');
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    e.preventDefault();
    if (_clTab < 0) return;
    const entry = _clDayTrades[_clTab];
    if (!entry) return;
    await _clUploadToTrade(files, entry.trade, container);
  });
}

/* ── Clipboard paste handler (registered on document while modal is open) ── */
async function _clImgPasteHandler(e) {
  if (!_clBackdrop || _clTab < 0) return;
  const t = e.target;
  if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName || '')) return;
  const items = e.clipboardData?.items;
  if (!items) return;
  const imgFiles = Array.from(items)
    .filter(it => it.type.startsWith('image/'))
    .map(it => it.getAsFile())
    .filter(Boolean);
  if (!imgFiles.length) return;
  e.preventDefault();
  const entry = _clDayTrades[_clTab];
  if (!entry) return;
  const container = document.querySelector('#cl-body .cl-img-col');
  if (!container) return;
  await _clUploadToTrade(imgFiles, entry.trade, container);
}

/* ── Image viewer (right column) ─────────────────────────────────────────── */
function _renderImageViewer(container, trade) {
  const images = trade.images || [];
  container.innerHTML = '';

  // Bind drag-drop once per container instance
  _clBindImgDrop(container);

  // Upload button (reused in both empty + nav states)
  const _mkUploadBtn = () => {
    const label = document.createElement('label');
    label.className = 'cl-img-upload-btn';
    label.title = 'Upload image(s)';
    label.innerHTML = '&#128247;';
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.style.display = 'none';
    inp.addEventListener('change', e => {
      if (e.target.files.length) _clUploadToTrade(e.target.files, trade, container);
      inp.value = '';
    });
    label.appendChild(inp);
    return label;
  };

  if (!images.length) {
    const empty = document.createElement('div');
    empty.className = 'cl-img-empty';
    empty.innerHTML = '<div>No images</div><div style="font-size:0.75rem;color:var(--text-muted)">Drop, paste, or</div>';
    empty.appendChild(_mkUploadBtn());
    container.appendChild(empty);
    return;
  }

  if (_clImgIdx[_clTab] === undefined) _clImgIdx[_clTab] = 0;
  const idx = Math.max(0, Math.min(_clImgIdx[_clTab], images.length - 1));
  _clImgIdx[_clTab] = idx;

  const src = images[idx];

  const viewer = document.createElement('div');
  viewer.className = 'cl-img-viewer';

  // Main image with zoom button overlay
  const imgWrap = document.createElement('div');
  imgWrap.className = 'cl-img-wrap';

  const img = document.createElement('img');
  img.className = 'cl-hero-img';
  img.src = resolveImageUrl(src);
  img.alt = 'Trade image';
  img.style.cursor = 'zoom-in';
  img.addEventListener('click', () => _openImgZoom(images, idx));

  const zoomBtn = document.createElement('button');
  zoomBtn.className = 'cl-zoom-btn';
  zoomBtn.title = 'Zoom image';
  zoomBtn.textContent = '\u2295';
  zoomBtn.addEventListener('click', e => { e.stopPropagation(); _openImgZoom(images, idx); });

  imgWrap.appendChild(img);
  imgWrap.appendChild(zoomBtn);
  viewer.appendChild(imgWrap);

  // Navigation row (always shown — has upload button)
  const nav = document.createElement('div');
  nav.className = 'cl-img-nav';

  const prev = document.createElement('button');
  prev.className = 'cl-nav-btn';
  prev.textContent = '\u2039';
  prev.disabled = idx === 0;
  prev.style.visibility = images.length > 1 ? '' : 'hidden';
  prev.addEventListener('click', () => {
    _clImgIdx[_clTab] = Math.max(0, idx - 1);
    _renderImageViewer(container, trade);
  });

  const counter = document.createElement('span');
  counter.className = 'cl-img-counter';
  counter.textContent = images.length > 1 ? (idx + 1) + ' / ' + images.length : '';

  const next = document.createElement('button');
  next.className = 'cl-nav-btn';
  next.textContent = '\u203a';
  next.disabled = idx >= images.length - 1;
  next.style.visibility = images.length > 1 ? '' : 'hidden';
  next.addEventListener('click', () => {
    _clImgIdx[_clTab] = Math.min(images.length - 1, idx + 1);
    _renderImageViewer(container, trade);
  });

  nav.appendChild(prev);
  nav.appendChild(counter);
  nav.appendChild(next);
  nav.appendChild(_mkUploadBtn());
  viewer.appendChild(nav);

  container.appendChild(viewer);
}

/* ── Image zoom overlay (fullscreen with left/right nav) ─────────────────── */
function _openImgZoom(images, startIdx) {
  document.getElementById('cl-zoom-overlay')?.remove();

  // Accept single src string for convenience
  if (typeof images === 'string') { images = [images]; startIdx = 0; }
  let cur = Math.max(0, Math.min(startIdx || 0, images.length - 1));

  const overlay = document.createElement('div');
  overlay.id = 'cl-zoom-overlay';
  overlay.className = 'cl-zoom-overlay';

  const img = document.createElement('img');
  img.className = 'cl-zoom-img';
  img.src = resolveImageUrl(images[cur]);
  img.addEventListener('click', e => e.stopPropagation());

  // Close button (top-right)
  const closeBtn = document.createElement('button');
  closeBtn.className = 'cl-zoom-close';
  closeBtn.textContent = '\u2715';
  closeBtn.addEventListener('click', () => overlay.remove());

  // Left / right arrows
  const prevBtn = document.createElement('button');
  prevBtn.className = 'cl-zoom-arrow cl-zoom-arrow-left';
  prevBtn.innerHTML = '&#8249;';
  prevBtn.addEventListener('click', e => { e.stopPropagation(); cur = Math.max(0, cur - 1); img.src = resolveImageUrl(images[cur]); _updateZoomState(); });

  const nextBtn = document.createElement('button');
  nextBtn.className = 'cl-zoom-arrow cl-zoom-arrow-right';
  nextBtn.innerHTML = '&#8250;';
  nextBtn.addEventListener('click', e => { e.stopPropagation(); cur = Math.min(images.length - 1, cur + 1); img.src = resolveImageUrl(images[cur]); _updateZoomState(); });

  const counter = document.createElement('div');
  counter.className = 'cl-zoom-counter';

  function _updateZoomState() {
    counter.textContent = images.length > 1 ? (cur + 1) + ' / ' + images.length : '';
    prevBtn.style.display = (images.length > 1 && cur > 0) ? 'flex' : 'none';
    nextBtn.style.display = (images.length > 1 && cur < images.length - 1) ? 'flex' : 'none';
  }
  _updateZoomState();

  overlay.appendChild(prevBtn);
  overlay.appendChild(img);
  overlay.appendChild(nextBtn);
  overlay.appendChild(closeBtn);
  overlay.appendChild(counter);
  overlay.addEventListener('click', () => overlay.remove());

  // Keyboard: ESC, arrow keys
  const onKey = e => {
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); }
    if (e.key === 'ArrowLeft'  && cur > 0) { cur--; img.src = resolveImageUrl(images[cur]); _updateZoomState(); }
    if (e.key === 'ArrowRight' && cur < images.length - 1) { cur++; img.src = resolveImageUrl(images[cur]); _updateZoomState(); }
  };
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('remove', () => document.removeEventListener('keydown', onKey));

  document.body.appendChild(overlay);
}

```

## File: `static/js/csvlog-placeholder.js`
```js
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

```
