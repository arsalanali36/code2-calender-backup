import React, { useState } from 'react';
import { Trade } from '../types';
import { DayFeedCard } from './DayFeedCard';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface CalendarViewProps {
  trades: Trade[];
  openViewer: (days: any[], dIdx: number, iIdx: number) => void;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const CalendarView: React.FC<CalendarViewProps> = ({ trades, openViewer }) => {
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate]     = useState<string>('');

  const hasRange = fromDate && toDate;
  const clearRange = () => { setFromDate(''); setToDate(''); };

  // Build day → pnl map from real trades
  const dayPnl: Record<string, number> = {};
  trades.forEach(t => {
    if (!t.date) return;
    dayPnl[t.date] = (dayPnl[t.date] || 0) + t.pnl;
  });

  // Trades to display stats for (range-filtered or whole month)
  const padMonth = String(viewMonth + 1).padStart(2, '0');
  const monthPrefix = `${viewYear}-${padMonth}`;

  const displayTrades = hasRange
    ? trades.filter(t => t.date && t.date >= fromDate && t.date <= toDate)
    : trades.filter(t => t.date && t.date.startsWith(monthPrefix));

  // Month total P/L (always monthly for the badge)
  const monthTotal = Object.entries(dayPnl)
    .filter(([d]) => d.startsWith(monthPrefix))
    .reduce((sum, [, v]) => sum + v, 0);

  // Stats for current display scope
  const dispWins   = displayTrades.filter(t => t.pnl > 0);
  const dispLosses = displayTrades.filter(t => t.pnl < 0);
  const dispTotal  = displayTrades.reduce((s, t) => s + t.pnl, 0);
  const dispWinRate = displayTrades.length ? Math.round((dispWins.length / displayTrades.length) * 100) : 0;
  const avgWin  = dispWins.length  ? Math.round(dispWins.reduce((s, t) => s + t.pnl, 0) / dispWins.length)  : 0;
  const avgLoss = dispLosses.length ? Math.round(Math.abs(dispLosses.reduce((s, t) => s + t.pnl, 0)) / dispLosses.length) : 0;

  // Day-level green/red counts
  const dayPnlInScope: Record<string, number> = {};
  displayTrades.forEach(t => {
    if (!t.date) return;
    dayPnlInScope[t.date] = (dayPnlInScope[t.date] || 0) + t.pnl;
  });
  const greenDays = Object.values(dayPnlInScope).filter(v => v > 0).length;
  const redDays   = Object.values(dayPnlInScope).filter(v => v < 0).length;

  // Calendar layout — Monday-first
  const firstDaySun = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const emptyStart  = (firstDaySun + 6) % 7; // Mon=0 offset
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const monthName = new Date(viewYear, viewMonth).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const todayStr  = today.toISOString().split('T')[0];

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedDate(null);
  };

  // Build trade list for selected date (for DayFeedCard + fullscreen viewer)
  const selectedTrades = selectedDate ? trades.filter(t => t.date === selectedDate) : [];
  const selectedDayPnl = selectedDate ? (dayPnl[selectedDate] ?? 0) : 0;

  const allTradeItems = (() => {
    const sorted = Object.keys(dayPnl).sort((a, b) => b.localeCompare(a));
    return sorted.flatMap(d => {
      const dTrades = trades.filter(t => t.date === d);
      const dPnl = dTrades.reduce((s, t) => s + t.pnl, 0);
      return dTrades.map((t, idx) => ({
        date: d,
        images: t.chartUrls,
        tradeNum: idx + 1,
        pnl: t.pnl,
        dayPnl: dPnl
      }));
    });
  })();

  return (
    <div className="max-w-md mx-auto pt-6 px-4 pb-24">
      {/* Header: Cal | [From] [To] [×] | P/L badge */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <h1 className="text-2xl font-bold text-zinc-900 mr-1">Cal</h1>

        {hasRange ? (
          <>
            <span className="text-[10px] text-zinc-500 bg-zinc-100 px-2 py-1 rounded-lg">
              {fromDate} → {toDate}
            </span>
            <button onClick={clearRange} className="text-zinc-400 hover:text-zinc-700 p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            <div className="relative">
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="opacity-0 absolute inset-0 cursor-pointer w-full h-full z-10"
              />
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border bg-zinc-50 text-zinc-500 border-zinc-200 cursor-pointer select-none">
                From
              </span>
            </div>
            <div className="relative">
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="opacity-0 absolute inset-0 cursor-pointer w-full h-full z-10"
              />
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border bg-zinc-50 text-zinc-500 border-zinc-200 cursor-pointer select-none">
                To
              </span>
            </div>
          </>
        )}

        <span className={`ml-auto text-sm font-bold px-3 py-1 rounded-full border ${
          (hasRange ? dispTotal : monthTotal) >= 0
            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
            : 'bg-rose-50 text-rose-600 border-rose-100'
        }`}>
          {(hasRange ? dispTotal : monthTotal) >= 0 ? '+' : ''}₹{Math.abs(hasRange ? dispTotal : monthTotal).toLocaleString()}
        </span>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold text-zinc-700">{monthName}</span>
        <button onClick={nextMonth} className="p-1.5 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day labels — Mon first */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-zinc-400">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 mb-5">
        {Array.from({ length: emptyStart }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day     = i + 1;
          const dateStr = `${viewYear}-${padMonth}-${String(day).padStart(2, '0')}`;
          const pnl     = dayPnl[dateStr];
          const isToday    = dateStr === todayStr;
          const isSelected = selectedDate === dateStr;
          const inRange    = hasRange && dateStr >= fromDate && dateStr <= toDate;

          return (
            <button
              key={day}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[11px] font-bold transition-all
                ${pnl !== undefined
                  ? pnl >= 0
                    ? 'bg-emerald-500 text-white'
                    : 'bg-rose-500 text-white'
                  : 'bg-zinc-50 text-zinc-400 border border-zinc-100'}
                ${isToday && pnl === undefined ? 'border-indigo-400 border-2' : ''}
                ${isSelected ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}
                ${inRange && pnl === undefined ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : ''}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow-sm">
          <p className="text-[10px] text-zinc-400 uppercase font-bold mb-0.5">Win Rate</p>
          <p className="text-xl font-bold text-zinc-900">{dispWinRate}%</p>
          <p className="text-[10px] text-zinc-400">{dispWins.length}W / {dispLosses.length}L</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow-sm">
          <p className="text-[10px] text-zinc-400 uppercase font-bold mb-0.5">Trading Days</p>
          <p className="text-xl font-bold text-zinc-900">{greenDays + redDays}</p>
          <p className="text-[10px] text-zinc-400">
            <span className="text-emerald-600">{greenDays}↑</span>
            {' / '}
            <span className="text-rose-500">{redDays}↓</span>
          </p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow-sm">
          <p className="text-[10px] text-zinc-400 uppercase font-bold mb-0.5">Avg Win</p>
          <p className="text-lg font-bold text-emerald-600">+₹{avgWin.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow-sm">
          <p className="text-[10px] text-zinc-400 uppercase font-bold mb-0.5">Avg Loss</p>
          <p className="text-lg font-bold text-rose-600">-₹{avgLoss.toLocaleString()}</p>
        </div>
      </div>

      {/* Selected day trade card */}
      {selectedDate && selectedTrades.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' — '}
            <span className={selectedDayPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
              {selectedDayPnl >= 0 ? '+' : ''}₹{Math.abs(selectedDayPnl).toLocaleString()}
            </span>
          </p>
          <DayFeedCard
            trades={selectedTrades}
            allTradeItems={allTradeItems}
            openViewer={openViewer}
            onDateClick={() => {
              const startIdx = allTradeItems.findIndex(it => it.date === selectedDate);
              if (startIdx !== -1) openViewer(allTradeItems, startIdx, 0);
            }}
          />
        </div>
      )}

      {selectedDate && selectedTrades.length === 0 && (
        <p className="text-center text-zinc-400 text-sm py-4">No trades on this day.</p>
      )}
    </div>
  );
};
