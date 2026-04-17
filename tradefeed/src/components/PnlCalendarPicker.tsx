import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface PnlCalendarPickerProps {
  pnlByDate: Record<string, number>;
  selectedDate: string | null;
  onSelect: (date: string | null) => void;
  onClose: () => void;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmt(n: number) { return Math.round(Math.abs(n)).toLocaleString('en-IN'); }

export const PnlCalendarPicker: React.FC<PnlCalendarPickerProps> = ({ pnlByDate, selectedDate, onSelect, onClose }) => {
  const today = new Date();
  const [year, setYear] = useState(() => {
    if (selectedDate) return parseInt(selectedDate.split('-')[0]);
    const dates = Object.keys(pnlByDate);
    if (dates.length) return parseInt(dates[dates.length - 1].split('-')[0]);
    return today.getFullYear();
  });
  const [month, setMonth] = useState(() => {
    if (selectedDate) return parseInt(selectedDate.split('-')[1]) - 1;
    const dates = Object.keys(pnlByDate);
    if (dates.length) return parseInt(dates[dates.length - 1].split('-')[1]) - 1;
    return today.getMonth();
  });

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const dateKey = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const monthTotal = Object.entries(pnlByDate)
    .filter(([k]) => k.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
    .reduce((s, [, v]) => s + v, 0);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex flex-col justify-end"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative bg-zinc-900 rounded-t-2xl border-t border-white/10 shadow-2xl pb-safe"
          onClick={e => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-white/20 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10">
              <X className="w-4 h-4 text-white/60" />
            </button>
            <div className="text-center">
              <p className="text-sm font-bold text-white">{MONTHS[month]} {year}</p>
              <p className={`text-[10px] font-bold ${monthTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {monthTotal >= 0 ? '+' : '-'}₹{fmt(monthTotal)}
              </p>
            </div>
            {selectedDate ? (
              <button onClick={() => onSelect(null)} className="text-[11px] text-indigo-400 font-bold px-2 py-1 rounded-lg hover:bg-white/10">Clear</button>
            ) : <div className="w-12" />}
          </div>

          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-2">
            <button onClick={prevMonth} className="p-2 rounded-full hover:bg-white/10 transition-colors">
              <ChevronLeft className="w-5 h-5 text-white/60" />
            </button>
            <span className="text-xs text-white/40 font-medium">{MONTHS[month]} {year}</span>
            <button onClick={nextMonth} className="p-2 rounded-full hover:bg-white/10 transition-colors">
              <ChevronRight className="w-5 h-5 text-white/60" />
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 px-3 pb-1">
            {DAYS.map(d => <div key={d} className="text-center text-[10px] font-bold text-white/30 py-1">{d}</div>)}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 px-3 pb-6 gap-y-1">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const key = dateKey(day);
              const pnl = pnlByDate[key];
              const hasTrade = pnl !== undefined;
              const isSelected = selectedDate === key;
              const isToday = key === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

              return (
                <button
                  key={key}
                  onClick={() => onSelect(isSelected ? null : key)}
                  className={`flex flex-col items-center justify-center rounded-xl py-1.5 transition-all ${isSelected ? 'ring-2 ring-white scale-105' : hasTrade ? 'active:scale-95' : 'opacity-40 cursor-default'}`}
                  style={hasTrade ? { background: pnl >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)' } : undefined}
                  disabled={!hasTrade}
                >
                  <span className={`text-xs font-bold ${isToday ? 'text-indigo-400' : 'text-white'}`}>{day}</span>
                  {hasTrade && (
                    <span className={`text-[8px] font-bold leading-none mt-0.5 ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pnl >= 0 ? '+' : '-'}{fmt(pnl)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
