import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { DayFeedCard } from './DayFeedCard';
import { SlidersHorizontal, Menu, X, Monitor } from 'lucide-react';
import { Trade } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface FeedViewProps {
  trades: Trade[];
  openViewer: (days: any[], dIdx: number, iIdx: number, locked?: boolean) => void;
}

const BROKERS = ['All', 'Zerodha', 'Dhan', 'ICICI', 'Angel'];

export const FeedView: React.FC<FeedViewProps> = ({ trades, openViewer }) => {
  const [showFilter, setShowFilter] = useState(false);
  const [showMenu, setShowMenu]     = useState(false);

  // Filter state
  const [amtMin, setAmtMin] = useState(0);
  const [amtMax, setAmtMax] = useState(0); // 0 = not set (use computed max)
  const [filterTags, setFilterTags]     = useState<string[]>([]);
  const [filterLiked, setFilterLiked]   = useState(false);
  const [filterCommented, setFilterCommented] = useState(false);

  // Menu state
  const [selectedBroker, setSelectedBroker] = useState('All');
  const [consolidate, setConsolidate]       = useState(false);

  // Group trades by date
  const grouped = useMemo(() => trades.reduce((acc, t) => {
    const key = t.date || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, Trade[]>), [trades]);

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // All unique tags
  const allTags = useMemo(() => Array.from(new Set(
    trades.flatMap(t => [...t.strategyTags, ...t.emotionTags, ...t.mistakeTags])
  )).sort(), [trades]);

  const maxDayAmt = useMemo(() => {
    if (sortedDates.length === 0) return 10000;
    const vals = sortedDates.map(d => Math.abs(grouped[d].reduce((s, t) => s + t.pnl, 0)));
    const max = Math.max(...vals);
    return Math.ceil(max / 100) * 100;
  }, [sortedDates, grouped]);

  // Favorited dates from localStorage
  const favs = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('tj_favs') || '{}') as Record<string, boolean>; }
    catch { return {}; }
  }, []);

  // Apply filters
  const filteredDates = useMemo(() => {
    return sortedDates.filter(date => {
      const dayTrades = grouped[date];
      const dayTotal = dayTrades.reduce((s, t) => s + t.pnl, 0);

      const maxThresh = amtMax > 0 ? amtMax : maxDayAmt;
      if (amtMin > 0 && Math.abs(dayTotal) < amtMin) return false;
      if (amtMax > 0 && Math.abs(dayTotal) > maxThresh) return false;
      if (filterLiked && !favs[date]) return false;
      if (filterCommented && !dayTrades.some(t => t.note)) return false;
      if (filterTags.length > 0) {
        const dayTagSet = new Set(dayTrades.flatMap(t => [...t.strategyTags, ...t.emotionTags, ...t.mistakeTags]));
        if (!filterTags.every(tag => dayTagSet.has(tag))) return false;
      }
      return true;
    });
  }, [sortedDates, grouped, amtMin, amtMax, maxDayAmt, filterLiked, filterCommented, filterTags, favs]);

  // Build allTradeItems for fullscreen viewer across all dates
  const allTradeItems = useMemo(() => sortedDates.flatMap(d => {
    const dayPnl = grouped[d].reduce((s, t) => s + t.pnl, 0);
    return grouped[d].map((t, idx) => ({
      date: d, images: t.chartUrls, tradeNum: idx + 1, pnl: t.pnl, dayPnl
    }));
  }), [sortedDates, grouped]);

  const hasActiveFilter = amtMin > 0 || (amtMax > 0 && amtMax < maxDayAmt) || filterLiked || filterCommented || filterTags.length > 0;

  const toggleTag = (tag: string) => {
    setFilterTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const clearFilters = () => {
    setAmtMin(0); setAmtMax(0);
    setFilterLiked(false); setFilterCommented(false);
    setFilterTags([]);
  };

  return (
    <div className="max-w-md mx-auto pb-24 pt-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Trade Feed</h1>
          <p className="text-xs text-zinc-500">Review your recent performance</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilter(true)}
            className={`p-2 rounded-full transition-colors relative ${
              hasActiveFilter ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <SlidersHorizontal className="w-5 h-5" />
            {hasActiveFilter && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setShowMenu(true)}
            className="p-2 bg-zinc-100 rounded-full text-zinc-600 hover:bg-zinc-200 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Feed cards */}
      {filteredDates.length === 0
        ? <p className="text-center text-zinc-400 text-sm mt-16">{hasActiveFilter ? 'No trades match the filter.' : 'No trades yet.'}</p>
        : filteredDates.map(date => (
            <DayFeedCard
              key={date}
              trades={grouped[date]}
              allTradeItems={allTradeItems}
              openViewer={openViewer}
              consolidate={consolidate}
              onDateClick={() => {
                let targetIdx = 0;
                for (let i = 0; i < allTradeItems.length; i++) {
                  if (allTradeItems[i].date === date) { targetIdx = i; break; }
                }
                openViewer(allTradeItems, targetIdx, 0, true);
              }}
            />
          ))
      }

      {/* Filter bottom sheet */}
      {createPortal(
        <AnimatePresence>
          {showFilter && <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
            onClick={() => setShowFilter(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-w-md bg-white rounded-t-2xl px-5 pt-5 pb-10 max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-zinc-900">Filter</h3>
                <div className="flex gap-3">
                  {hasActiveFilter && (
                    <button onClick={clearFilters} className="text-xs text-rose-500 font-bold">Clear all</button>
                  )}
                  <button onClick={() => setShowFilter(false)}>
                    <X className="w-5 h-5 text-zinc-400" />
                  </button>
                </div>
              </div>

              {/* Amt range slider */}
              <div className="mb-6">
                <p className="text-xs font-bold text-zinc-500 uppercase mb-4">Day P&L Amount</p>
                <div className="px-1">
                  <div className="relative h-1.5 bg-zinc-200 rounded-full mb-5">
                    <div
                      className="absolute h-full bg-indigo-500 rounded-full"
                      style={{
                        left: `${(amtMin / maxDayAmt) * 100}%`,
                        right: `${100 - ((amtMax > 0 ? amtMax : maxDayAmt) / maxDayAmt) * 100}%`
                      }}
                    />
                  </div>
                  <div className="relative" style={{ height: 0 }}>
                    <input
                      type="range" min={0} max={maxDayAmt} step={Math.max(100, Math.floor(maxDayAmt / 100) * 10)}
                      value={amtMin}
                      onChange={e => {
                        const v = Number(e.target.value);
                        setAmtMin(Math.min(v, (amtMax > 0 ? amtMax : maxDayAmt) - 100));
                      }}
                      className="absolute w-full -top-2 h-4 appearance-none bg-transparent cursor-pointer range-thumb-indigo"
                      style={{ pointerEvents: 'auto', zIndex: amtMin > maxDayAmt * 0.7 ? 5 : 3 }}
                    />
                    <input
                      type="range" min={0} max={maxDayAmt} step={Math.max(100, Math.floor(maxDayAmt / 100) * 10)}
                      value={amtMax > 0 ? amtMax : maxDayAmt}
                      onChange={e => {
                        const v = Number(e.target.value);
                        setAmtMax(v >= maxDayAmt ? 0 : Math.max(v, amtMin + 100));
                      }}
                      className="absolute w-full -top-2 h-4 appearance-none bg-transparent cursor-pointer range-thumb-indigo"
                      style={{ pointerEvents: 'auto', zIndex: 4 }}
                    />
                  </div>
                </div>
                <div className="flex justify-between mt-6 px-1">
                  <span className="text-xs font-bold font-mono text-indigo-600">
                    {amtMin > 0 ? `₹${amtMin.toLocaleString('en-IN')}` : 'Any'}
                  </span>
                  <span className="text-xs font-bold font-mono text-indigo-600">
                    {amtMax > 0 && amtMax < maxDayAmt ? `₹${amtMax.toLocaleString('en-IN')}` : 'Max'}
                  </span>
                </div>
              </div>

              {/* Tags */}
              {allTags.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-bold text-zinc-500 uppercase mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {allTags.map(tag => (
                      <button key={tag} onClick={() => toggleTag(tag)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                          filterTags.includes(tag) ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-500'
                        }`}
                      >{tag}</button>
                    ))}
                  </div>
                </div>
              )}

              <style>{`
                .range-thumb-indigo::-webkit-slider-thumb {
                  -webkit-appearance: none; appearance: none;
                  width: 20px; height: 20px; border-radius: 50%;
                  background: #4f46e5; border: 2px solid white;
                  box-shadow: 0 1px 4px rgba(0,0,0,0.25); cursor: pointer;
                }
                .range-thumb-indigo::-moz-range-thumb {
                  width: 20px; height: 20px; border-radius: 50%;
                  background: #4f46e5; border: 2px solid white;
                  box-shadow: 0 1px 4px rgba(0,0,0,0.25); cursor: pointer;
                }
              `}</style>

              {/* Toggles */}
              <div className="space-y-3">
                <button
                  onClick={() => setFilterLiked(f => !f)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                    filterLiked ? 'border-rose-200 bg-rose-50' : 'border-zinc-200 bg-zinc-50'
                  }`}
                >
                  <span className="text-sm font-medium text-zinc-700">Liked only</span>
                  <div className={`w-10 h-5 rounded-full transition-colors ${filterLiked ? 'bg-rose-500' : 'bg-zinc-200'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-all ${filterLiked ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </button>
                <button
                  onClick={() => setFilterCommented(f => !f)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                    filterCommented ? 'border-indigo-200 bg-indigo-50' : 'border-zinc-200 bg-zinc-50'
                  }`}
                >
                  <span className="text-sm font-medium text-zinc-700">Has note/comment</span>
                  <div className={`w-10 h-5 rounded-full transition-colors ${filterCommented ? 'bg-indigo-500' : 'bg-zinc-200'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-all ${filterCommented ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>}
        </AnimatePresence>
      , document.body)}

      {/* 3-dash menu bottom sheet */}
      {createPortal(
        <AnimatePresence>
          {showMenu && <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
            onClick={() => setShowMenu(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-w-md bg-white rounded-t-2xl px-5 pt-5 pb-10"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-zinc-900">Options</h3>
                <button onClick={() => setShowMenu(false)}>
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              {/* Broker */}
              <div className="mb-5">
                <p className="text-xs font-bold text-zinc-500 uppercase mb-2">Broker</p>
                <div className="flex gap-2 flex-wrap">
                  {BROKERS.map(b => (
                    <button key={b} onClick={() => setSelectedBroker(b)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        selectedBroker === b ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500'
                      }`}
                    >{b}</button>
                  ))}
                </div>
              </div>

              {/* Consolidate toggle */}
              <button
                onClick={() => setConsolidate(c => !c)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border mb-5 transition-colors ${
                  consolidate ? 'border-indigo-200 bg-indigo-50' : 'border-zinc-200 bg-zinc-50'
                }`}
              >
                <div>
                  <p className="text-sm font-bold text-zinc-800">Consolidate trades</p>
                  <p className="text-[11px] text-zinc-400">Show all day trades as one card</p>
                </div>
                <div className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 ${consolidate ? 'bg-indigo-500' : 'bg-zinc-200'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-all ${consolidate ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </button>

              {/* Desktop switch */}
              <button
                onClick={() => { setShowMenu(false); window.location.href = '/'; }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 transition-colors"
              >
                <Monitor className="w-5 h-5 text-zinc-500" />
                <span className="text-sm font-medium text-zinc-700">Switch to Desktop</span>
              </button>
            </motion.div>
          </motion.div>}
        </AnimatePresence>
      , document.body)}
    </div>
  );
};
