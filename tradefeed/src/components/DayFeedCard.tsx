import React, { useState } from 'react';
import { Trade } from '../types';
import { TagChip } from './TagChip';
import {
  TrendingUp, TrendingDown, MoreHorizontal,
  Heart, MessageSquare, ChevronLeft, ChevronRight,
  Bookmark, Share2, Flag, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DayFeedCardProps {
  trades: Trade[];
  allTradeItems?: { date: string; images: string[]; tradeNum: number; pnl?: number; dayPnl?: number }[];
  openViewer: (days: any[], dIdx: number, iIdx: number, locked?: boolean) => void;
  onDateClick: () => void;
  consolidate?: boolean;
}

// Integer amount, no symbol, no sign — color conveys direction
const fmt = (n: number) => Math.round(Math.abs(n)).toLocaleString('en-IN');

// Derive a label for each trade position in the day
function getTradeLabel(index: number, total: number): string {
  if (total === 1) return 'T1';
  if (index === 0) return 'O';
  if (index === total - 1) return 'C';
  return `T${index}`;
}

const MORE_OPTIONS = [
  { icon: <Eye className="w-4 h-4" />,      label: 'View fullscreen' },
  { icon: <Bookmark className="w-4 h-4" />, label: 'Bookmark' },
  { icon: <Share2 className="w-4 h-4" />,   label: 'Share' },
  { icon: <Flag className="w-4 h-4" />,     label: 'Mark for review' },
];

export const DayFeedCard: React.FC<DayFeedCardProps> = ({ trades, allTradeItems, openViewer, onDateClick, consolidate }) => {
  const [tradeIndex, setTradeIndex] = useState(0);
  const [imgIndex, setImgIndex]     = useState(0);
  const [showMenu, setShowMenu]     = useState(false);
  const touchStartX = React.useRef<number>(0);

  const dateKey = trades[0]?.date || '';

  // Favorites persisted in localStorage
  const [isFav, setIsFav] = useState(() => {
    try {
      return !!JSON.parse(localStorage.getItem('tj_favs') || '{}')[dateKey];
    } catch { return false; }
  });
  const toggleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const favs = JSON.parse(localStorage.getItem('tj_favs') || '{}');
      const next = { ...favs, [dateKey]: !isFav };
      localStorage.setItem('tj_favs', JSON.stringify(next));
    } catch {}
    setIsFav(f => !f);
  };

  const trade    = trades[tradeIndex];
  const isProfit = trade.pnl >= 0;
  const hasImgs  = trade.chartUrls.length > 0;
  const dayTotal = trades.reduce((s, t) => s + t.pnl, 0);
  const dayIsProfit = dayTotal >= 0;

  const switchTrade = (i: number) => { setTradeIndex(i); setImgIndex(0); };

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd   = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) < 40) return;
    if (diff > 0) setImgIndex(i => (i + 1) % trade.chartUrls.length);
    else          setImgIndex(i => (i - 1 + trade.chartUrls.length) % trade.chartUrls.length);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-zinc-200 rounded-2xl overflow-hidden mb-6 shadow-sm"
    >
      {/* Header — date + pnl + 3-dot menu */}
      <div className="px-3 py-2.5 flex items-center justify-between cursor-pointer active:bg-zinc-50" onClick={onDateClick}>
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isProfit ? 'bg-emerald-100' : 'bg-rose-100'}`}>
            {trade.type === 'Long'
              ? <TrendingUp className={`w-3.5 h-3.5 ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`} />
              : <TrendingDown className={`w-3.5 h-3.5 ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`} />
            }
          </div>
          <span className="text-xs font-bold text-zinc-700">{trade.date}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
            {fmt(trade.pnl)}
          </span>
          {/* 3-dot menu */}
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              className="text-zinc-400 hover:text-zinc-600 p-1"
              onClick={() => setShowMenu(m => !m)}
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  className="absolute right-0 top-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg z-30 w-44 overflow-hidden"
                >
                  {MORE_OPTIONS.map(opt => (
                    <button
                      key={opt.label}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors text-left"
                      onClick={() => {
                        setShowMenu(false);
                        if (opt.label === 'View fullscreen') {
                          const dayPnlVal = dayTotal;
                          const itemsList = allTradeItems || trades.map((t, idx) => ({
                            date: t.date, images: t.chartUrls, tradeNum: idx + 1, pnl: t.pnl, dayPnl: dayPnlVal
                          }));
                          let targetIdx = 0;
                          for (let i = 0; i < itemsList.length; i++) {
                            if (itemsList[i].date === trade.date) { targetIdx = i; break; }
                          }
                          openViewer(itemsList, targetIdx, imgIndex);
                        }
                      }}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Image */}
      {hasImgs ? (
        <div
          className="relative aspect-square bg-zinc-100 overflow-hidden group"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={`${tradeIndex}-${imgIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              src={trade.chartUrls[imgIndex]}
              alt="chart"
              className="w-full h-full object-cover cursor-zoom-in"
              onClick={() => {
                const clickedUrl = trade.chartUrls[imgIndex];
                const dayPnlVal = dayTotal;
                const itemsList = allTradeItems || trades.map((t, idx) => ({
                  date: t.date, images: t.chartUrls, tradeNum: idx + 1, pnl: t.pnl, dayPnl: dayPnlVal
                }));
                let targetItemIdx = tradeIndex;
                let targetImgIdx  = imgIndex;
                for (let i = 0; i < itemsList.length; i++) {
                  const idx = itemsList[i].images.indexOf(clickedUrl);
                  if (idx !== -1) { targetItemIdx = i; targetImgIdx = idx; break; }
                }
                openViewer(itemsList, targetItemIdx, targetImgIdx, true);
              }}
            />
          </AnimatePresence>

          {/* Image nav arrows */}
          {trade.chartUrls.length > 1 && (
            <>
              <button
                onClick={() => setImgIndex(i => (i - 1 + trade.chartUrls.length) % trade.chartUrls.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 p-1.5 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setImgIndex(i => (i + 1) % trade.chartUrls.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 p-1.5 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {trade.chartUrls.map((_, i) => (
                  <button key={i} onClick={() => setImgIndex(i)}
                    className={`h-1.5 rounded-full transition-all ${i === imgIndex ? 'bg-white w-4' : 'bg-white/50 w-1.5'}`} />
                ))}
              </div>
            </>
          )}

          {/* Image count badge — with frosted bg for visibility on white images */}
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
            {imgIndex + 1}/{trade.chartUrls.length}
          </div>
        </div>
      ) : (
        <div className="px-4 py-2">
          <span className={`text-base font-bold ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
            {fmt(trade.pnl)}
          </span>
        </div>
      )}

      {/* Trade switcher (O / T1 / T2 / C) + bookmark — hidden in consolidate mode */}
      {!consolidate && <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <div className="flex gap-3 items-center">
          {trades.map((t, i) => {
            const label = getTradeLabel(i, trades.length);
            const active = i === tradeIndex;
            const tProfit = t.pnl >= 0;
            return (
              <button
                key={t.id}
                onClick={() => switchTrade(i)}
                className={`text-xs font-bold transition-colors px-1.5 py-0.5 rounded ${
                  active
                    ? (tProfit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500')
                    : 'text-zinc-400 hover:text-zinc-700'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <button className="text-zinc-400 hover:text-indigo-600 transition-colors">
          <Bookmark className="w-4 h-4" />
        </button>
      </div>}

      {/* Actions row: heart + comment + day total */}
      <div className="px-4 py-2 flex items-center gap-4">
        {/* Heart / favorite */}
        <button onClick={toggleFav} className="transition-transform active:scale-90">
          <Heart className={`w-5 h-5 transition-colors ${isFav ? 'text-rose-500 fill-rose-500' : 'text-zinc-400 hover:text-rose-400'}`} />
        </button>
        <button className="text-zinc-400 hover:text-indigo-600 transition-colors">
          <MessageSquare className="w-5 h-5" />
        </button>
        {/* Day total — shown when multiple trades, prominent pill */}
        {trades.length > 1 && (
          <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full ${
            dayIsProfit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
          }`}>
            {fmt(dayTotal)}
          </span>
        )}
      </div>

      {/* Stats + Tags + Note */}
      <div className="px-4 pb-4">
        <div className="flex gap-5 mb-2.5">
          {trade.stats.rMultiple !== 0 && (
            <div>
              <p className="text-[10px] text-zinc-400 uppercase font-bold">R-Mult</p>
              <p className={`text-xs font-mono font-bold ${trade.stats.rMultiple >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {trade.stats.rMultiple}R
              </p>
            </div>
          )}
          {trade.stats.riskReward && (
            <div>
              <p className="text-[10px] text-zinc-400 uppercase font-bold">R/R</p>
              <p className="text-xs font-mono font-bold text-zinc-800">{trade.stats.riskReward}</p>
            </div>
          )}
          {trade.stats.positionSize > 0 && (
            <div>
              <p className="text-[10px] text-zinc-400 uppercase font-bold">Size</p>
              <p className="text-xs font-mono font-bold text-zinc-800">{trade.stats.positionSize}</p>
            </div>
          )}
        </div>

        {[...trade.strategyTags, ...trade.emotionTags, ...trade.mistakeTags].length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {trade.strategyTags.map(tag => <TagChip key={tag} label={tag} type="strategy" />)}
            {trade.emotionTags.map(tag => <TagChip key={tag} label={tag} type="emotion" />)}
            {trade.mistakeTags.map(tag => <TagChip key={tag} label={tag} type="mistake" />)}
          </div>
        )}

        {trade.note && (
          <p className="text-sm text-zinc-600 leading-relaxed">
            <span className="font-bold text-zinc-900 mr-1">Note:</span>
            {trade.note}
          </p>
        )}
      </div>
    </motion.div>
  );
};
