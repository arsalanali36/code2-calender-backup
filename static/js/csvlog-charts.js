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

