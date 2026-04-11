/**
 * @fileoverview gallery-pnl-calendar.js
 * @description Specialized P&L calendar for the gallery view.
 */

let pnlCalYear = new Date().getFullYear();
let pnlCalMonth = new Date().getMonth();

function openPnlCalendar() {
  const modal = document.getElementById('gv2-pnl-calendar-modal');
  if (!modal) return;

  // Initialize view to gallery's current date if available
  if (state.gallery && state.gallery.date) {
    const d = new Date(state.gallery.date + 'T00:00:00');
    if (!isNaN(d)) {
      pnlCalYear = d.getFullYear();
      pnlCalMonth = d.getMonth();
    }
  }

  // Helper functions for navigation
  const pnlCalPrev = () => {
    pnlCalMonth--;
    if (pnlCalMonth < 0) { pnlCalMonth = 11; pnlCalYear--; }
    renderPnlCalendar();
  };
  const pnlCalNext = () => {
    pnlCalMonth++;
    if (pnlCalMonth > 11) { pnlCalMonth = 0; pnlCalYear++; }
    renderPnlCalendar();
  };

  modal.style.display = 'flex';
  renderPnlCalendar();
  
  // Bind events once
  if (!window._pnlCalEventsBound) {
    document.getElementById('pnl-cal-prev').onclick = pnlCalPrev;
    document.getElementById('pnl-cal-next').onclick = pnlCalNext;
    document.getElementById('pnl-cal-close-x').onclick = closePnlCalendarModal;
    document.getElementById('pnl-cal-today-btn').onclick = () => {
      const now = new Date();
      pnlCalYear = now.getFullYear();
      pnlCalMonth = now.getMonth();
      renderPnlCalendar();
    };

    // Wheel navigation (Continuous scroll feel)
    let _wheelThrottled = false;
    modal.addEventListener('wheel', (e) => {
      if (_wheelThrottled) return;
      if (Math.abs(e.deltaY) < 40) return;
      
      _wheelThrottled = true;
      if (e.deltaY > 0) pnlCalNext();
      else pnlCalPrev();
      
      setTimeout(() => { _wheelThrottled = false; }, 400);
    }, { passive: true });

    // Touch swipe navigation (iPad support)
    let _tStartX = 0, _tStartY = 0;
    modal.addEventListener('touchstart', (e) => {
      _tStartX = e.touches[0].clientX;
      _tStartY = e.touches[0].clientY;
    }, { passive: true });

    modal.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - _tStartX;
      const dy = e.changedTouches[0].clientY - _tStartY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (absX > 60 && absY < 100) {
        // Horizontal swipe
        if (dx > 0) pnlCalPrev();
        else pnlCalNext();
      } else if (absY > 70 && absX < 100) {
        // Vertical swipe
        if (dy > 0) pnlCalPrev();
        else pnlCalNext();
      }
    }, { passive: true });

    // Close on overlay click
    modal.onclick = (e) => {
      if (e.target === modal) closePnlCalendarModal();
    };
    window._pnlCalEventsBound = true;
  }
}

function closePnlCalendarModal() {
  const modal = document.getElementById('gv2-pnl-calendar-modal');
  if (modal) modal.style.display = 'none';
}

function renderPnlCalendar() {
  const grid = document.getElementById('pnl-calendar-grid');
  const label = document.getElementById('pnl-cal-month-label');
  if (!grid || !label) return;

  const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", 
                      "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  label.textContent = `${monthNames[pnlCalMonth]} ${pnlCalYear}`;

  grid.innerHTML = '';

  const firstDay = new Date(pnlCalYear, pnlCalMonth, 1).getDay();
  const daysInMonth = new Date(pnlCalYear, pnlCalMonth + 1, 0).getDate();
  
  // Adjusted for Mon-Sun (Mon=1, Sun=0 in JS Date)
  // We want Mon=0, Tue=1 ... Sun=6
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  // Empty cells
  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement('div');
    empty.className = 'pnl-calendar-day empty';
    grid.appendChild(empty);
  }

  const todayStr = formatDate(new Date());
  
  // Pre-calculate P&L by date for efficiency
  const pnlMap = new Map();
  state.trades.forEach(t => {
      if (!tradeMatchesBrokerFilter(t)) return;
      const d = normalizeDate(extractDateFromTrade(t));
      if (!d) return;
      const p = parseFloat(t['Profit'] ?? t['profit'] ?? t['Net P/L'] ?? t['Gross P/L'] ?? t['Rs'] ?? 0);
      if (!isNaN(p)) {
          pnlMap.set(d, (pnlMap.get(d) || 0) + p);
      }
  });

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${pnlCalYear}-${String(pnlCalMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayPnl = pnlMap.get(dateStr);
    
    const cell = document.createElement('div');
    cell.className = 'pnl-calendar-day';
    if (dateStr === todayStr) cell.classList.add('today');
    
    if (dayPnl !== undefined && Math.abs(dayPnl) > 0.01) {
       cell.classList.add(dayPnl > 0 ? 'profit' : 'loss');
    }

    const num = document.createElement('div');
    num.className = 'pnl-cal-day-num';
    num.textContent = d;
    cell.appendChild(num);

    if (dayPnl !== undefined) {
      const val = document.createElement('div');
      val.className = 'pnl-cal-day-val';
      const fv = Math.round(dayPnl);
      val.textContent = (fv > 0 ? '+' : '') + fv.toLocaleString();
      cell.appendChild(val);
    }

    cell.onclick = () => {
       closePnlCalendarModal();
       if (typeof openGalleryForDateWithPicker === 'function') {
           openGalleryForDateWithPicker(dateStr);
       }
    };

    grid.appendChild(cell);
  }
}
