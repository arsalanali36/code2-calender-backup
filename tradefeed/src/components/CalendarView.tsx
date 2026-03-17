import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Trade } from '../types';
import { ChevronLeft, ChevronRight, X, BarChart2, CheckSquare, Square,
         TrendingUp, Calendar, ArrowUp, ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CalendarViewProps {
  trades: Trade[];
  openViewer: (days: any[], dIdx: number, iIdx: number) => void;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const fmt = (n: number) => Math.round(Math.abs(n)).toLocaleString('en-IN');

const AVAILABLE_TILES = [
  { id: 'winrate',  label: 'Win Rate',     icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { id: 'days',     label: 'Trading Days', icon: <Calendar className="w-3.5 h-3.5" />   },
  { id: 'avgwin',   label: 'Avg Win',      icon: <ArrowUp className="w-3.5 h-3.5" />    },
  { id: 'avgloss',  label: 'Avg Loss',     icon: <ArrowDown className="w-3.5 h-3.5" />  },
];

function loadTiles(): Set<string> {
  try {
    const saved = localStorage.getItem('tj_cal_tiles');
    if (saved) return new Set(JSON.parse(saved));
  } catch {}
  return new Set(['winrate', 'days', 'avgwin', 'avgloss']);
}
function saveTiles(s: Set<string>) {
  try { localStorage.setItem('tj_cal_tiles', JSON.stringify([...s])); } catch {}
}

export const CalendarView: React.FC<CalendarViewProps> = ({ trades, openViewer }) => {
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [fromDate, setFromDate]   = useState<string>('');
  const [toDate, setToDate]       = useState<string>('');
  const [showTilePicker, setShowTilePicker] = useState(false);
  const [enabledTiles, setEnabledTiles]     = useState<Set<string>>(loadTiles);

  const toggleTile = (id: string) => {
    setEnabledTiles(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveTiles(next);
      return next;
    });
  };

  const hasRange = !!(fromDate && toDate);
  const clearRange = () => { setFromDate(''); setToDate(''); };

  // Build day → pnl map
  const dayPnl: Record<string, number> = {};
  trades.forEach(t => {
    if (!t.date) return;
    dayPnl[t.date] = (dayPnl[t.date] || 0) + t.pnl;
  });

  const padMonth   = String(viewMonth + 1).padStart(2, '0');
  const monthPrefix = `${viewYear}-${padMonth}`;

  const displayTrades = hasRange
    ? trades.filter(t => t.date && t.date >= fromDate && t.date <= toDate)
    : trades.filter(t => t.date && t.date.startsWith(monthPrefix));

  const monthTotal = Object.entries(dayPnl)
    .filter(([d]) => d.startsWith(monthPrefix))
    .reduce((sum, [, v]) => sum + v, 0);

  const dispWins    = displayTrades.filter(t => t.pnl > 0);
  const dispLosses  = displayTrades.filter(t => t.pnl < 0);
  const dispTotal   = displayTrades.reduce((s, t) => s + t.pnl, 0);
  const dispWinRate = displayTrades.length ? Math.round((dispWins.length / displayTrades.length) * 100) : 0;
  const avgWin  = dispWins.length   ? Math.round(dispWins.reduce((s, t) => s + t.pnl, 0) / dispWins.length)  : 0;
  const avgLoss = dispLosses.length ? Math.round(Math.abs(dispLosses.reduce((s, t) => s + t.pnl, 0)) / dispLosses.length) : 0;

  const dayPnlInScope: Record<string, number> = {};
  displayTrades.forEach(t => {
    if (!t.date) return;
    dayPnlInScope[t.date] = (dayPnlInScope[t.date] || 0) + t.pnl;
  });
  const greenDays = Object.values(dayPnlInScope).filter(v => v > 0).length;
  const redDays   = Object.values(dayPnlInScope).filter(v => v < 0).length;

  // Calendar layout
  const firstDaySun = new Date(viewYear, viewMonth, 1).getDay();
  const emptyStart  = (firstDaySun + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthName   = new Date(viewYear, viewMonth).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const todayStr    = today.toISOString().split('T')[0];

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  // Build allTradeItems for viewer
  const allTradeItems = (() => {
    const sorted = Object.keys(dayPnl).sort((a, b) => b.localeCompare(a));
    return sorted.flatMap(d => {
      const dTrades = trades.filter(t => t.date === d);
      const dPnl = dTrades.reduce((s, t) => s + t.pnl, 0);
      return dTrades.map((t, idx) => ({
        date: d, images: t.chartUrls, tradeNum: idx + 1, pnl: t.pnl, dayPnl: dPnl
      }));
    });
  })();

  // Click a date → open viewer directly for that date
  const handleDateClick = (dateStr: string) => {
    const startIdx = allTradeItems.findIndex(it => it.date === dateStr);
    if (startIdx !== -1) {
      openViewer(allTradeItems, startIdx, 0);
    }
  };

  const showTotal = hasRange ? dispTotal : monthTotal;
  const totalIsProfit = showTotal >= 0;

  return (
    <div className="max-w-md mx-auto pt-6 px-4 pb-32">
      {/* Header */}
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
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="opacity-0 absolute inset-0 cursor-pointer w-full h-full z-10" />
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border bg-zinc-50 text-zinc-500 border-zinc-200 cursor-pointer select-none">From</span>
            </div>
            <div className="relative">
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="opacity-0 absolute inset-0 cursor-pointer w-full h-full z-10" />
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border bg-zinc-50 text-zinc-500 border-zinc-200 cursor-pointer select-none">To</span>
            </div>
          </>
        )}

        <span className={`text-sm font-bold px-3 py-1 rounded-full border ${
          totalIsProfit ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
        }`}>
          {fmt(showTotal)}
        </span>

        {/* Tile picker button */}
        <button
          onClick={() => setShowTilePicker(true)}
          className="ml-auto p-1.5 bg-zinc-100 rounded-lg text-zinc-600 hover:bg-zinc-200 transition-colors"
          title="Show/hide stat tiles"
        >
          <BarChart2 className="w-4 h-4" />
        </button>
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

      {/* Day labels */}
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
          const isToday = dateStr === todayStr;
          const inRange = hasRange && dateStr >= fromDate && dateStr <= toDate;
          const hasTrades = pnl !== undefined;

          return (
            <button
              key={day}
              onClick={() => hasTrades ? handleDateClick(dateStr) : undefined}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[11px] font-bold transition-all
                ${hasTrades
                  ? pnl >= 0
                    ? 'bg-emerald-500 text-white active:scale-95'
                    : 'bg-rose-500 text-white active:scale-95'
                  : 'bg-zinc-50 text-zinc-400 border border-zinc-100'}
                ${isToday && !hasTrades ? 'border-indigo-400 border-2' : ''}
                ${inRange && !hasTrades ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : ''}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Stat tiles */}
      {(enabledTiles.size > 0) && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          {enabledTiles.has('winrate') && (
            <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-1.5 mb-0.5">
                <TrendingUp className="w-3.5 h-3.5 text-zinc-400" />
                <p className="text-[10px] text-zinc-400 uppercase font-bold">Win Rate</p>
              </div>
              <p className="text-xl font-bold text-zinc-900">{dispWinRate}%</p>
              <p className="text-[10px] text-zinc-400">{dispWins.length}W / {dispLosses.length}L</p>
            </div>
          )}
          {enabledTiles.has('days') && (
            <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                <p className="text-[10px] text-zinc-400 uppercase font-bold">Trading Days</p>
              </div>
              <p className="text-xl font-bold text-zinc-900">{greenDays + redDays}</p>
              <p className="text-[10px] text-zinc-400">
                <span className="text-emerald-600">{greenDays}↑</span>
                {' / '}
                <span className="text-rose-500">{redDays}↓</span>
              </p>
            </div>
          )}
          {enabledTiles.has('avgwin') && (
            <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-1.5 mb-0.5">
                <ArrowUp className="w-3.5 h-3.5 text-emerald-500" />
                <p className="text-[10px] text-zinc-400 uppercase font-bold">Avg Win</p>
              </div>
              <p className="text-lg font-bold text-emerald-600">{fmt(avgWin)}</p>
            </div>
          )}
          {enabledTiles.has('avgloss') && (
            <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-1.5 mb-0.5">
                <ArrowDown className="w-3.5 h-3.5 text-rose-500" />
                <p className="text-[10px] text-zinc-400 uppercase font-bold">Avg Loss</p>
              </div>
              <p className="text-lg font-bold text-rose-600">{fmt(avgLoss)}</p>
            </div>
          )}
        </div>
      )}

      {/* Tile picker modal */}
      {createPortal(
        <AnimatePresence>
          {showTilePicker && <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
            onClick={() => setShowTilePicker(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-w-md bg-white rounded-t-2xl p-5 pb-8 max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-zinc-900">Stat Tiles</h3>
                <button onClick={() => setShowTilePicker(false)} className="text-zinc-400 hover:text-zinc-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2">
                {AVAILABLE_TILES.map(tile => (
                  <button
                    key={tile.id}
                    onClick={() => toggleTile(tile.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-50 transition-colors text-left"
                  >
                    {enabledTiles.has(tile.id)
                      ? <CheckSquare className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                      : <Square className="w-5 h-5 text-zinc-300 flex-shrink-0" />
                    }
                    <span className={`text-sm font-medium ${enabledTiles.has(tile.id) ? 'text-zinc-900' : 'text-zinc-400'}`}>
                      {tile.label}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>}
        </AnimatePresence>
      , document.body)}
    </div>
  );
};
