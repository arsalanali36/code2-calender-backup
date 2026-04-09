/**
 * @fileoverview visual-dashboard-init.js
 * @description Dashboard initialization, event binding, and select sync helpers.
 *              Split from visual-dashboard.js — load AFTER visual-dashboard.js.
 * @exports initVisualDashboard, bindVdEvents, syncVdSelects, updateVdRangeLabel
 */

function initVisualDashboard() {
    bindVdEvents();
    renderVisualDashboard();
}

function bindVdEvents() {
    const ms = document.getElementById('vd-month-select');
    const ys = document.getElementById('vd-year-select');
    const vs = document.getElementById('vd-view-select');
    const prevBtn = document.getElementById('vd-prev-month');
    const nextBtn = document.getElementById('vd-next-month');
    const todayBtn = document.getElementById('vd-today-btn');

    if (ms) {
        ms.addEventListener('change', e => {
            vdState.month = parseInt(e.target.value, 10);
            renderVisualDashboard();
        });
    }
    if (ys) {
        ys.addEventListener('change', e => {
            vdState.year = parseInt(e.target.value, 10);
            renderVisualDashboard();
        });
    }
    if (vs) {
        vs.addEventListener('change', e => {
            vdState.view = e.target.value;
            renderVisualDashboard();
        });
    }
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (vdState.view === 'year') {
                vdState.year--;
            } else {
                if (vdState.month === 0) { vdState.month = 11; vdState.year--; }
                else { vdState.month--; }
            }
            syncVdSelects();
            renderVisualDashboard();
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (vdState.view === 'year') {
                vdState.year++;
            } else {
                if (vdState.month === 11) { vdState.month = 0; vdState.year++; }
                else { vdState.month++; }
            }
            syncVdSelects();
            renderVisualDashboard();
        });
    }
    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            const d = new Date();
            vdState.month = d.getMonth();
            vdState.year = d.getFullYear();
            vdState.view = 'month';
            syncVdSelects();
            renderVisualDashboard();
        });
    }
}

function syncVdSelects() {
    const ms = document.getElementById('vd-month-select');
    const ys = document.getElementById('vd-year-select');
    const vs = document.getElementById('vd-view-select');
    if (ms) ms.value = vdState.month;
    if (ys) ys.value = vdState.year;
    if (vs) vs.value = vdState.view;
}

function updateVdRangeLabel() {
    const label = document.getElementById('vd-range-label');
    if (!label) return;
    const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (vdState.view === 'year') {
        label.textContent = `From Jan ${vdState.year} to Dec ${vdState.year}`;
    } else {
        const mm = String(vdState.month + 1).padStart(2, '0');
        const lastDay = new Date(vdState.year, vdState.month + 1, 0).getDate();
        label.textContent = `${vdState.year}-${mm}-01 to ${vdState.year}-${mm}-${String(lastDay).padStart(2, '0')}`;
    }
}
