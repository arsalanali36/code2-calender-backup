import React, { useState } from 'react';
import { Trade } from '../types';
import { TagChip } from './TagChip';
import {
  TrendingUp, TrendingDown, Clock, MoreHorizontal,
  MessageSquare, Share2, Bookmark, ChevronLeft, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DayFeedCardProps {
  trades: Trade[];
  allTradeItems?: { date: string; images: string[]; tradeNum: number }[];
  openViewer: (days: any[], dIdx: number, iIdx: number) => void;
  onDateClick: () => void;
}

export const DayFeedCard: React.FC<DayFeedCardProps> = ({ trades, allTradeItems, openViewer, onDateClick }) => {
  const [tradeIndex, setTradeIndex] = useState(0);
  const [imgIndex, setImgIndex]     = useState(0);
  const touchStartX = React.useRef<number>(0);

  const trade    = trades[tradeIndex];
  const isProfit = trade.pnl >= 0;
  const hasImgs  = trade.chartUrls.length > 0;

  const switchTrade = (i: number) => {
    setTradeIndex(i);
    setImgIndex(0);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) < 40) return;
    if (diff > 0) {
      setImgIndex(i => (i + 1) % trade.chartUrls.length);
    } else {
      setImgIndex(i => (i - 1 + trade.chartUrls.length) % trade.chartUrls.length);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-zinc-200 rounded-2xl overflow-hidden mb-6 shadow-sm"
    >
      {/* Header */}
      <div className="px-3 py-2.5 flex items-center justify-between cursor-pointer active:bg-zinc-50" onClick={onDateClick}>
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isProfit ? 'bg-emerald-100' : 'bg-rose-100'}`}>
            {trade.type === 'Long'
              ? <TrendingUp className={`w-4 h-4 ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`} />
              : <TrendingDown className={`w-4 h-4 ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`} />
            }
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-zinc-400" />
              <span className="text-[10px] text-zinc-400 font-medium">{trade.date}</span>
              {trade.session && (
                <>
                  <span className="text-zinc-300">•</span>
                  <span className="text-[10px] text-zinc-400 font-medium">{trade.session}</span>
                </>
              )}
            </div>
            <h3 className="text-sm font-bold text-zinc-900 leading-tight">{trade.instrument}</h3>
          </div>
        </div>
        <button className="text-zinc-400 hover:text-zinc-600 p-1" onClick={(e) => { e.stopPropagation(); /* secondary menu logic here if any */ }}>
          <MoreHorizontal className="w-5 h-5" />
        </button>
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
                const itemsList = allTradeItems || trades.map((t, idx) => ({
                  date: t.date, images: t.chartUrls, tradeNum: idx + 1
                }));
                // Find which item in the full list contains this image
                let targetItemIdx = tradeIndex;
                let targetImgIdx = imgIndex;
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

              {/* Dot indicators — bottom center */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {trade.chartUrls.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIndex(i)}
                    className={`h-1.5 rounded-full transition-all ${i === imgIndex ? 'bg-white w-4' : 'bg-white/50 w-1.5'}`}
                  />
                ))}
              </div>
            </>
          )}

          {/* P&L badge — top left, white bg */}
          <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-sm font-bold shadow-sm bg-white/90 backdrop-blur-sm border border-zinc-100 ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isProfit ? '+' : ''}₹{Math.abs(trade.pnl).toLocaleString()}
          </div>

          {/* Image count badge — top right */}
          <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full">
            {imgIndex + 1}/{trade.chartUrls.length}
          </div>
        </div>
      ) : (
        <div className="px-4 py-2">
          <span className={`text-base font-bold ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isProfit ? '+' : ''}₹{Math.abs(trade.pnl).toLocaleString()}
          </span>
        </div>
      )}

      {/* Trade number switcher — plain numbers + bookmark */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <div className="flex gap-5">
          {trades.map((t, i) => (
            <button
              key={t.id}
              onClick={() => switchTrade(i)}
              className={`text-sm font-bold transition-colors ${
                i === tradeIndex
                  ? (t.pnl >= 0 ? 'text-emerald-600' : 'text-rose-500')
                  : 'text-zinc-800 hover:text-zinc-500'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <button className="text-zinc-700 hover:text-indigo-600 transition-colors">
          <Bookmark className="w-5 h-5" />
        </button>
      </div>

      {/* Actions */}
      <div className="px-4 py-2 flex items-center gap-4">
        <button className="text-zinc-700 hover:text-indigo-600 transition-colors">
          <MessageSquare className="w-5 h-5" />
        </button>
        <button className="text-zinc-700 hover:text-indigo-600 transition-colors">
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      {/* Stats + Tags + Note */}
      <div className="px-4 pb-4">
        {/* Stats */}
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

        {/* Tags */}
        {[...trade.strategyTags, ...trade.emotionTags, ...trade.mistakeTags].length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {trade.strategyTags.map(tag => <TagChip key={tag} label={tag} type="strategy" />)}
            {trade.emotionTags.map(tag => <TagChip key={tag} label={tag} type="emotion" />)}
            {trade.mistakeTags.map(tag => <TagChip key={tag} label={tag} type="mistake" />)}
          </div>
        )}

        {/* Note */}
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
