import React, { useState, useEffect } from 'react';
import { Trade } from '../types';
import { X, BarChart2, CheckSquare, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const fmt = (n: number) => Math.round(Math.abs(n)).toLocaleString('en-IN');

interface DashboardViewProps {
  trades: Trade[];
}

const AVAILABLE_CHARTS = [
  { id: 'equity',   label: 'Equity Curve' },
  { id: 'winrate',  label: 'Win Rate' },
  { id: 'pf',       label: 'Profit Factor' },
  { id: 'avgwin',   label: 'Avg Win / Avg Loss' },
  { id: 'dailypnl', label: 'Daily P&L Bar' },
  { id: 'session',  label: 'Session Breakdown' },
  { id: 'streak',   label: 'Win/Loss Streak' },
];

export const DashboardView: React.FC<DashboardViewProps> = ({ trades }) => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');
  const [showChartPicker, setShowChartPicker] = useState(false);
  const [enabledCharts, setEnabledCharts] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('tj_stats_charts');
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set(['equity', 'winrate', 'pf', 'avgwin']);
  });

  useEffect(() => {
    try { localStorage.setItem('tj_stats_charts', JSON.stringify([...enabledCharts])); } catch {}
  }, [enabledCharts]);

  const hasRange = fromDate && toDate;
  const clearRange = () => { setFromDate(''); setToDate(''); };

  const filtered = hasRange
    ? trades.filter(t => t.date && t.date >= fromDate && t.date <= toDate)
    : trades;

  const sorted = [...filtered].filter(t => t.date).sort((a, b) => a.date.localeCompare(b.date));

  // Equity curve
  const equity: number[] = [];
  let cum = 0;
  sorted.forEach(t => { cum += Number(t.pnl) || 0; equity.push(cum); });

  // Stats
  const wins   = filtered.filter(t => t.pnl > 0);
  const losses = filtered.filter(t => t.pnl < 0);
  const winRate      = filtered.length ? Math.round((wins.length / filtered.length) * 100) : 0;
  const grossWin     = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss    = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : '∞';
  const totalPnl     = filtered.reduce((s, t) => s + t.pnl, 0);
  const avgWin       = wins.length   ? Math.round(grossWin / wins.length)   : 0;
  const avgLoss      = losses.length ? Math.round(grossLoss / losses.length) : 0;

  // SVG equity curve
  const W = 300, H = 100, pad = 8;
  const minE = Math.min(0, ...equity);
  const maxE = Math.max(0, ...equity);
  const range = maxE - minE || 1;
  const toX   = (i: number) => pad + (i / Math.max(equity.length - 1, 1)) * (W - pad * 2);
  const toY   = (v: number) => H - pad - ((v - minE) / range) * (H - pad * 2);
  const zeroY = toY(0);
  const pts   = equity.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const areaPath = equity.length > 1
    ? `M${toX(0)},${zeroY} ` + equity.map((v, i) => `L${toX(i)},${toY(v)}`).join(' ') + ` L${toX(equity.length - 1)},${zeroY} Z`
    : '';

  // Daily P&L bar chart data
  const dayPnlMap: Record<string, number> = {};
  filtered.forEach(t => { if (t.date) dayPnlMap[t.date] = (dayPnlMap[t.date] || 0) + t.pnl; });
  const dayEntries = Object.entries(dayPnlMap).sort(([a], [b]) => a.localeCompare(b));
  const maxDayAbs  = Math.max(1, ...dayEntries.map(([, v]) => Math.abs(v)));

  // Session breakdown
  const sessionCount = { Morning: 0, Afternoon: 0, Evening: 0 };
  const sessionPnl   = { Morning: 0, Afternoon: 0, Evening: 0 };
  filtered.forEach(t => {
    if (t.session in sessionCount) {
      sessionCount[t.session]++;
      sessionPnl[t.session] += t.pnl;
    }
  });

  const toggleChart = (id: string) => {
    setEnabledCharts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="max-w-md mx-auto pt-6 px-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold text-zinc-900 mr-1">Stats</h1>

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

        <span className={`text-sm font-bold px-3 py-1 rounded-full border ${totalPnl >= 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
          {fmt(totalPnl)}
        </span>

        {/* Chart selector button */}
        <button
          onClick={() => setShowChartPicker(true)}
          className="ml-auto p-1.5 bg-zinc-100 rounded-lg text-zinc-600 hover:bg-zinc-200 transition-colors"
          title="Select charts"
        >
          <BarChart2 className="w-4 h-4" />
        </button>
      </div>

      {/* Charts */}
      <div className="space-y-4">
        {/* Equity Curve */}
        {enabledCharts.has('equity') && (
          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Equity Curve</span>
            {equity.length > 1 ? (
              <div className="mt-2" style={{ height: 80 }}>
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none">
                  <line x1={pad} y1={zeroY} x2={W - pad} y2={zeroY} stroke="#e4e4e7" strokeWidth="1" />
                  <path d={areaPath} fill={totalPnl >= 0 ? '#10b98120' : '#f43f5e20'} />
                  <polyline points={pts} fill="none" stroke={totalPnl >= 0 ? '#10b981' : '#f43f5e'} strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </div>
            ) : (
              <p className="text-xs text-zinc-400 mt-2 italic">Not enough data</p>
            )}
          </div>
        )}

        {/* Daily P&L bar chart */}
        {enabledCharts.has('dailypnl') && dayEntries.length > 0 && (
          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Daily P&L</span>
            <div className="mt-3 flex items-end gap-0.5" style={{ height: 60 }}>
              {dayEntries.slice(-30).map(([date, pnl]) => {
                const heightPct = (Math.abs(pnl) / maxDayAbs) * 100;
                return (
                  <div key={date} className="flex-1 flex flex-col items-center justify-end" style={{ height: '100%' }}>
                    <div
                      style={{ height: `${heightPct}%`, minHeight: 2 }}
                      className={`w-full rounded-sm ${pnl >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                      title={`${date}: ₹${pnl.toLocaleString()}`}
                    />
                  </div>
                );
              })}
            </div>
            <p className="text-[9px] text-zinc-300 mt-1 text-right">Last {Math.min(dayEntries.length, 30)} days</p>
          </div>
        )}

        {/* Win Rate + Profit Factor */}
        {(enabledCharts.has('winrate') || enabledCharts.has('pf')) && (
          <div className="grid grid-cols-2 gap-3">
            {enabledCharts.has('winrate') && (
              <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Win Rate</span>
                <p className="text-xl font-bold text-zinc-900">{winRate}%</p>
                <p className="text-[10px] text-zinc-400">{wins.length}W / {losses.length}L</p>
              </div>
            )}
            {enabledCharts.has('pf') && (
              <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Profit Factor</span>
                <p className="text-xl font-bold text-zinc-900">{profitFactor}</p>
                <p className="text-[10px] text-zinc-400">{filtered.length} trades</p>
              </div>
            )}
          </div>
        )}

        {/* Avg Win / Avg Loss */}
        {enabledCharts.has('avgwin') && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Avg Win</span>
              <p className="text-xl font-bold text-emerald-600">{fmt(avgWin)}</p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Avg Loss</span>
              <p className="text-xl font-bold text-rose-600">{fmt(avgLoss)}</p>
            </div>
          </div>
        )}

        {/* Session Breakdown */}
        {enabledCharts.has('session') && (
          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Session Breakdown</span>
            <div className="mt-3 space-y-2">
              {(['Morning', 'Afternoon', 'Evening'] as const).map(s => (
                <div key={s} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-600">{s}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-400">{sessionCount[s]} trades</span>
                    <span className={`text-xs font-bold ${sessionPnl[s] >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {fmt(sessionPnl[s])}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Win/Loss Streak */}
        {enabledCharts.has('streak') && sorted.length > 0 && (() => {
          let curStreak = 0, maxW = 0, maxL = 0, curType = '';
          sorted.forEach(t => {
            const type = t.pnl >= 0 ? 'W' : 'L';
            if (type === curType) curStreak++;
            else { curStreak = 1; curType = type; }
            if (type === 'W') maxW = Math.max(maxW, curStreak);
            else maxL = Math.max(maxL, curStreak);
          });
          return (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Best Win Streak</span>
                <p className="text-xl font-bold text-emerald-600">{maxW}</p>
              </div>
              <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Worst Loss Streak</span>
                <p className="text-xl font-bold text-rose-600">{maxL}</p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Chart picker modal */}
      <AnimatePresence>
        {showChartPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
            onClick={() => setShowChartPicker(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-w-md bg-white rounded-t-2xl p-5 pb-8"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-zinc-900">Choose Charts</h3>
                <button onClick={() => setShowChartPicker(false)} className="text-zinc-400 hover:text-zinc-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2">
                {AVAILABLE_CHARTS.map(chart => (
                  <button
                    key={chart.id}
                    onClick={() => toggleChart(chart.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-zinc-50 transition-colors text-left"
                  >
                    {enabledCharts.has(chart.id)
                      ? <CheckSquare className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                      : <Square className="w-5 h-5 text-zinc-300 flex-shrink-0" />
                    }
                    <span className={`text-sm font-medium ${enabledCharts.has(chart.id) ? 'text-zinc-900' : 'text-zinc-400'}`}>
                      {chart.label}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
