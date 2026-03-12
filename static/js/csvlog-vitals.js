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
