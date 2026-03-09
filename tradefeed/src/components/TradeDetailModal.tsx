import React, { useState } from 'react';
import { Trade } from '../types';
import { X, ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TagChip } from './TagChip';

interface TradeDetailModalProps {
  trade: Trade;
  onClose: () => void;
}

export const TradeDetailModal: React.FC<TradeDetailModalProps> = ({ trade, onClose }) => {
  const [imgIndex, setImgIndex] = useState(0);
  const isProfit = trade.pnl >= 0;
  const allTags = [...trade.strategyTags, ...trade.emotionTags, ...trade.mistakeTags];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="bg-white w-full max-w-md rounded-t-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-zinc-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isProfit ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                {trade.type === 'Long'
                  ? <TrendingUp className={`w-3.5 h-3.5 ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`} />
                  : <TrendingDown className={`w-3.5 h-3.5 ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`} />
                }
              </div>
              <h2 className="text-sm font-bold text-zinc-900">{trade.instrument}</h2>
              <span className={`text-sm font-bold ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                {isProfit ? '+' : ''}₹{Math.abs(trade.pnl).toLocaleString()}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold ml-9 mt-0.5">
              {trade.session} SESSION • {trade.date}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 bg-zinc-100 rounded-full">
            <X className="w-4 h-4 text-zinc-600" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Image Carousel */}
          {trade.chartUrls.length > 0 && (
            <div className="relative aspect-square bg-zinc-100 overflow-hidden group">
              <AnimatePresence mode="wait">
                <motion.img
                  key={imgIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  src={trade.chartUrls[imgIndex]}
                  alt={`Chart ${imgIndex + 1}`}
                  className="w-full h-full object-cover"
                />
              </AnimatePresence>

              {trade.chartUrls.length > 1 && (
                <>
                  <button
                    onClick={() => setImgIndex(i => (i - 1 + trade.chartUrls.length) % trade.chartUrls.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 p-1.5 rounded-full shadow"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setImgIndex(i => (i + 1) % trade.chartUrls.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 p-1.5 rounded-full shadow"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
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
            </div>
          )}

          {/* Stats */}
          <div className="px-4 pt-3 flex gap-5">
            <div>
              <p className="text-[10px] text-zinc-400 uppercase font-bold">Size</p>
              <p className="text-sm font-mono font-bold text-zinc-800">{trade.stats.positionSize || '—'}</p>
            </div>
            {trade.stats.riskReward && (
              <div>
                <p className="text-[10px] text-zinc-400 uppercase font-bold">R/R</p>
                <p className="text-sm font-mono font-bold text-zinc-800">{trade.stats.riskReward}</p>
              </div>
            )}
            {trade.stats.rMultiple !== 0 && (
              <div>
                <p className="text-[10px] text-zinc-400 uppercase font-bold">R-Mult</p>
                <p className={`text-sm font-mono font-bold ${trade.stats.rMultiple >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {trade.stats.rMultiple}R
                </p>
              </div>
            )}
          </div>

          {/* Tags */}
          {allTags.length > 0 && (
            <div className="px-4 pt-3 flex flex-wrap gap-1.5">
              {trade.strategyTags.map(tag => <TagChip key={tag} label={tag} type="strategy" />)}
              {trade.emotionTags.map(tag => <TagChip key={tag} label={tag} type="emotion" />)}
              {trade.mistakeTags.map(tag => <TagChip key={tag} label={tag} type="mistake" />)}
            </div>
          )}

          {/* Note */}
          {trade.note && (
            <div className="px-4 pt-3 pb-6">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Observation</p>
              <p className="text-sm text-zinc-700 leading-relaxed">{trade.note}</p>
            </div>
          )}

          {(!trade.note && allTags.length === 0) && (
            <p className="px-4 py-6 text-sm text-zinc-400 italic">No notes or tags for this trade.</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
