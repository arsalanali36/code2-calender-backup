/**
 * @fileoverview visual-dashboard-stats.js
 * @description VD Stats cards drag/drop, stats menu, chart type & width controls.
 *              Split from visual-dashboard.js — load BEFORE visual-dashboard.js.
 * @exports getTradePnl, VD_STATS, getVdStatsState, saveVdStatsState, getVdStatsOrder,
 *          saveVdStatsOrder, applyVdStatVisibility, applyVdStatOrder, bindVdDragDrop,
 *          renderVdStatsMenu, updateVdChartType, getVdCardWidths, saveVdCardWidths,
 *          updateVdChartWidth, applyVdCardWidths
 * @reads localStorage (vd_stats_state, vd_stats_order, vd_card_widths)
 * @writes localStorage
 */

function getTradePnl(t) {
    if (t['Net P/L']) return parseFloat(t['Net P/L']);
    if (t['Gross P/L']) return parseFloat(t['Gross P/L']);
    if (t['Profit']) return parseFloat(t['Profit']);
    if (t['profit']) return parseFloat(t['profit']);
    if (t['Rs']) return parseFloat(t['Rs']);
    return 0;
}

// ──────────────────────────────────────────────
// DRAG, DROP, AND STATS MENU LOGIC
// ──────────────────────────────────────────────
const VD_STATS = [
    { key: 'cumulative', label: 'Cumulative Performance' },
    { key: 'mtm_thumbs', label: 'Daily MTM Curves' },
    { key: 'daily', label: 'Daily Net P/L' },
    { key: 'distribution', label: 'Strategy Distribution' },
    { key: 'profitability', label: 'Strategy Profitability' },
    { key: 'long_short', label: 'Long vs Short Performance' },
    { key: 'daily_qty', label: 'Daily Trade Count & Qty' },
    { key: 'pat_sum', label: 'PAT (SUM)' },
    { key: 'points_per_trade', label: 'Points - Per Trade' },
    { key: 'points_sum', label: 'Points - Sum' },
    { key: 'daily_fc', label: 'Daily FC' },
    { key: 'avg_buy_price', label: 'Avg Buy Price' }
];

// ── uiSettings helpers ─────────────────────────────────────────────────────
// Reads a key from state.uiSettings (server-persisted), falling back to
// localStorage for backwards-compat on first load, then migrates to server.
function _vdUiGet(key, def) {
    if (typeof state !== 'undefined' && state.uiSettings && state.uiSettings[key] !== undefined)
        return state.uiSettings[key];
    // One-time migration: pull old value from localStorage if present
    try {
        const raw = localStorage.getItem(key);
        if (raw !== null) return JSON.parse(raw);
    } catch (e) { }
    return def;
}

function _vdUiSet(key, val) {
    if (typeof state === 'undefined') return;
    if (!state.uiSettings) state.uiSettings = {};
    state.uiSettings[key] = val;
    // Remove migrated localStorage key so we don't read stale data again
    try { localStorage.removeItem(key); } catch (e) { }
    if (typeof saveTrades === 'function') saveTrades();
}
// ─────────────────────────────────────────────────────────────────────────────

function getVdStatsState() {
    const saved = _vdUiGet('vdStats', null);
    if (saved && typeof saved === 'object') return saved;
    const all = {};
    VD_STATS.forEach(s => { all[s.key] = true; });
    return all;
}

function saveVdStatsState(stateMap) {
    _vdUiSet('vdStats', stateMap);
}

function getVdStatsOrder() {
    const arr = _vdUiGet('vdStatsOrder', null);
    if (Array.isArray(arr) && arr.length) {
        const valid = arr.filter(k => VD_STATS.some(s => s.key === k));
        const missing = VD_STATS.map(s => s.key).filter(k => !valid.includes(k));
        return [...valid, ...missing];
    }
    return VD_STATS.map(s => s.key);
}

function saveVdStatsOrder(order) {
    _vdUiSet('vdStatsOrder', order);
}

function applyVdStatVisibility() {
    const map = getVdStatsState();
    document.querySelectorAll('.visual-dash-grid .dash-card[data-vd-stat]').forEach(card => {
        const key = card.getAttribute('data-vd-stat');
        card.style.display = map[key] === false ? 'none' : '';
    });
}

function applyVdStatOrder() {
    const grid = document.getElementById('vd-charts-grid');
    if (!grid) return;
    const order = getVdStatsOrder();
    const cards = Array.from(grid.querySelectorAll('.dash-card[data-vd-stat]'));
    const byKey = new Map(cards.map(c => [c.getAttribute('data-vd-stat'), c]));
    order.forEach(k => {
        const el = byKey.get(k);
        if (el) grid.appendChild(el);
    });
    bindVdDragDrop();
}

function bindVdDragDrop() {
    const grid = document.getElementById('vd-charts-grid');
    if (!grid) return;
    let dragSrc = null;
    let dropTarget = null;
    let dropPos = null;

    const clearIndicators = () => {
        grid.querySelectorAll('.drop-before, .drop-after').forEach(c => c.classList.remove('drop-before', 'drop-after'));
    };

    grid.querySelectorAll('.dash-card[data-vd-stat]').forEach(card => {
        const handle = card.querySelector('.vd-drag-handle');
        if (handle) {
            handle.addEventListener('mousedown', () => card.setAttribute('draggable', 'true'));
            handle.addEventListener('mouseup', () => card.setAttribute('draggable', 'false'));
            handle.addEventListener('mouseleave', () => card.setAttribute('draggable', 'false'));
        }

        card.addEventListener('dragstart', e => {
            if (card.getAttribute('draggable') !== 'true') {
                e.preventDefault();
                return;
            }
            dragSrc = card;
            setTimeout(() => card.classList.add('dragging'), 0);
            e.dataTransfer.effectAllowed = 'move';
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            card.setAttribute('draggable', 'false');
            clearIndicators();
            if (dragSrc && dropTarget && dropTarget !== dragSrc) {
                if (dropPos === 'before') grid.insertBefore(dragSrc, dropTarget);
                else grid.insertBefore(dragSrc, dropTarget.nextSibling);
                const newOrder = Array.from(grid.querySelectorAll('.dash-card[data-vd-stat]'))
                    .map(c => c.getAttribute('data-vd-stat'));
                saveVdStatsOrder(newOrder);
            }
            dragSrc = null; dropTarget = null; dropPos = null;
        });

        card.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (!dragSrc || card === dragSrc) return;
            clearIndicators();
            const rect = card.getBoundingClientRect();
            dropPos = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
            dropTarget = card;
            card.classList.add(dropPos === 'before' ? 'drop-before' : 'drop-after');
        });

        card.addEventListener('drop', e => { e.preventDefault(); });
    });
}

let tempVdStatsMap = null;
let tempVdStatsOrder = null;

function renderVdStatsMenu() {
    const menu = document.getElementById('vd-stats-menu-container');
    if (!menu) return;
    menu.innerHTML = '';

    if (!tempVdStatsMap) tempVdStatsMap = getVdStatsState();
    if (!tempVdStatsOrder) tempVdStatsOrder = getVdStatsOrder();

    const map = tempVdStatsMap;

    const searchRow = document.createElement('div');
    searchRow.className = 'panel-search-row';
    searchRow.style.padding = '8px 10px 0';
    const searchInp = document.createElement('input');
    searchInp.className = 'panel-search';
    searchInp.placeholder = 'Search stats...';
    searchRow.appendChild(searchInp);
    menu.appendChild(searchRow);

    const actRow = document.createElement('div');
    actRow.className = 'panel-act-row';
    actRow.style.padding = '8px 10px 6px';
    const btnAll = document.createElement('button');
    btnAll.className = 'panel-act-btn';
    btnAll.textContent = 'All';
    const btnNone = document.createElement('button');
    btnNone.className = 'panel-act-btn';
    btnNone.textContent = 'None';
    btnAll.addEventListener('click', () => {
        VD_STATS.forEach(s => { map[s.key] = true; });
        renderVdStatsMenu();
    });
    btnNone.addEventListener('click', () => {
        VD_STATS.forEach(s => { map[s.key] = false; });
        renderVdStatsMenu();
    });
    actRow.appendChild(btnAll);
    actRow.appendChild(btnNone);
    menu.appendChild(actRow);

    const list = document.createElement('div');
    list.className = 'panel-list';
    list.style.padding = '0 10px 8px';
    menu.appendChild(list);

    const renderList = (q) => {
        list.innerHTML = '';
        const ql = (q || '').toLowerCase();
        const items = tempVdStatsOrder
            .map(k => VD_STATS.find(s => s.key === k))
            .filter(Boolean)
            .filter(s => !ql || s.label.toLowerCase().includes(ql));

        items.forEach(s => {
            const row = document.createElement('div');
            row.className = 'head-checkbox';
            row.setAttribute('draggable', 'true');
            row.dataset.stat = s.key;
            row.style.padding = '4px 0';
            row.style.cursor = 'grab';

            const handle = document.createElement('span');
            handle.textContent = '⋮⋮';
            handle.style.marginRight = '8px';
            handle.style.opacity = '0.6';
            handle.style.userSelect = 'none';

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = map[s.key] !== false;
            chk.addEventListener('change', () => {
                map[s.key] = chk.checked;
            });

            const label = document.createElement('span');
            label.textContent = s.label;

            row.appendChild(handle);
            row.appendChild(chk);
            row.appendChild(label);

            row.addEventListener('dragstart', e => {
                e.dataTransfer.setData('text/plain', s.key);
                row.style.opacity = '0.5';
            });
            row.addEventListener('dragend', () => { row.style.opacity = '1'; });
            row.addEventListener('dragover', e => { e.preventDefault(); row.style.borderTop = '1px dashed var(--border2)'; });
            row.addEventListener('dragleave', () => { row.style.borderTop = ''; });
            row.addEventListener('drop', e => {
                e.preventDefault();
                row.style.borderTop = '';
                const from = e.dataTransfer.getData('text/plain');
                const to = s.key;
                if (!from || from === to) return;
                const newOrder = tempVdStatsOrder.filter(k => k !== from);
                const toIdx = newOrder.indexOf(to);
                newOrder.splice(toIdx, 0, from);
                tempVdStatsOrder = newOrder;
                renderList(searchInp.value);
            });

            list.appendChild(row);
        });
    };

    renderList('');
    searchInp.addEventListener('input', () => renderList(searchInp.value));
}

// Run on load but with a tiny delay to ensure global state exists
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => {
        initVisualDashboard();
        renderVdStatsMenu(); // render dropdown content
    }, 200);

    const statBtn = document.getElementById('vd-stats-btn');
    const modal = document.getElementById('vd-stats-modal');
    const closeBtn = document.getElementById('vd-stats-close-btn');
    const applyBtn = document.getElementById('vd-stats-apply-btn');

    if (statBtn && modal) {
        statBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            tempVdStatsMap = getVdStatsState();
            tempVdStatsOrder = getVdStatsOrder();
            renderVdStatsMenu();
            modal.style.display = 'flex';
        });
    }

    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    if (applyBtn && modal) {
        applyBtn.addEventListener('click', () => {
            saveVdStatsState(tempVdStatsMap);
            saveVdStatsOrder(tempVdStatsOrder);
            applyVdStatVisibility();
            applyVdStatOrder();
            applyVdCardWidths();
            modal.style.display = 'none';
        });
    }

    // Close on click outside modal content
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
});


function updateVdChartType(chartKey, newType) {
    if (vdCharts[chartKey]) {
        vdCharts[chartKey].updateOptions({
            chart: { type: newType }
        });
    }
}
window.updateVdChartType = updateVdChartType;


function getVdCardWidths() {
    return _vdUiGet('vdCardWidths', {});
}

function saveVdCardWidths(w) {
    _vdUiSet('vdCardWidths', w);
}

function updateVdChartWidth(chartKey, cols) {
    const widths = getVdCardWidths();
    widths[chartKey] = cols;
    saveVdCardWidths(widths);
    applyVdCardWidths();
    // Re-render chart to fit new width
    setTimeout(() => { if (vdCharts[chartKey]) vdCharts[chartKey].render(); }, 300);
}
window.updateVdChartWidth = updateVdChartWidth;

function applyVdCardWidths(triggerResize) {
    const widths = getVdCardWidths();
    document.querySelectorAll('.visual-dash-grid .dash-card[data-vd-stat]').forEach(card => {
        const key = card.getAttribute('data-vd-stat');
        const cols = widths[key] || card.getAttribute('data-vd-default-width') || 6;
        card.style.gridColumn = `span ${cols}`;

        // update select
        const sel = card.querySelector('.vd-width-select');
        if (sel) sel.value = cols;
    });
    // After initial render, charts need a resize signal to fill their new container width
    if (triggerResize) {
        setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
    }
}
