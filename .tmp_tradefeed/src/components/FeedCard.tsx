import React, { useState } from 'react';
import { Trade } from '../types';
import { TagChip } from './TagChip';
import { TrendingUp, TrendingDown, Clock, MoreHorizontal, MessageSquare, Share2, Bookmark, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FeedCardProps {
  trade: Trade;
}

export const FeedCard: React.FC<FeedCardProps> = ({ trade }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const isProfit = trade.pnl >= 0;

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % trade.chartUrls.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + trade.chartUrls.length) % trade.chartUrls.length);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-zinc-200 rounded-xl overflow-hidden mb-8 shadow-sm"
    >
      {/* Header - Instagram Style */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isProfit ? 'bg-emerald-100' : 'bg-rose-100'}`}>
            {trade.type === 'Long' ? (
              <TrendingUp className={`w-4 h-4 ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`} />
            ) : (
              <TrendingDown className={`w-4 h-4 ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-zinc-900 leading-tight">{trade.instrument}</h3>
              <span className="text-zinc-400 text-xs">•</span>
              <span className="text-xs text-zinc-500 font-medium">{trade.date}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-zinc-400 mt-0.5 uppercase tracking-wider font-bold">
              <Clock className="w-3 h-3" />
              {trade.session} SESSION
            </div>
          </div>
        </div>
        <button className="text-zinc-400 hover:text-zinc-600 transition-colors">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Chart Image Carousel — only if images exist */}
      {trade.chartUrls.length > 0 && (
        <div className="relative aspect-square bg-zinc-100 group cursor-pointer overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.img
              key={currentImageIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              src={trade.chartUrls[currentImageIndex]}
              alt={`Trade Chart ${currentImageIndex + 1}`}
              className="w-full h-full object-cover"
            />
          </AnimatePresence>

          {/* Carousel Controls */}
          {trade.chartUrls.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm p-1.5 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="w-4 h-4 text-zinc-800" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm p-1.5 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="w-4 h-4 text-zinc-800" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                {trade.chartUrls.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentImageIndex ? 'bg-white w-3' : 'bg-white/50'}`}
                  />
                ))}
              </div>
            </>
          )}

          {/* P&L Badge */}
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-zinc-200 shadow-sm">
            <span className={`text-sm font-bold ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isProfit ? '+' : ''}{trade.currency}{Math.abs(trade.pnl).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* P&L Badge when no image */}
      {trade.chartUrls.length === 0 && (
        <div className="px-4 py-2">
          <span className={`text-base font-bold ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isProfit ? '+' : ''}{trade.currency}{Math.abs(trade.pnl).toLocaleString()}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="text-zinc-800 hover:text-indigo-600 transition-colors">
            <MessageSquare className="w-6 h-6" />
          </button>
          <button className="text-zinc-800 hover:text-indigo-600 transition-colors">
            <Share2 className="w-6 h-6" />
          </button>
        </div>
        <button className="text-zinc-800 hover:text-indigo-600 transition-colors">
          <Bookmark className="w-6 h-6" />
        </button>
      </div>

      {/* Content */}
      <div className="px-4 pb-4">
        {/* Stats Row */}
        <div className="flex gap-4 mb-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-400 font-bold uppercase">R-Mult</span>
            <span className={`text-xs font-mono font-bold ${trade.stats.rMultiple >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trade.stats.rMultiple}R
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-400 font-bold uppercase">R/R</span>
            <span className="text-xs font-mono font-bold text-zinc-800">{trade.stats.riskReward}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-400 font-bold uppercase">Size</span>
            <span className="text-xs font-mono font-bold text-zinc-800">{trade.stats.positionSize}</span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {trade.strategyTags.map(tag => (
            <TagChip key={tag} label={tag} type="strategy" />
          ))}
          {trade.emotionTags.map(tag => (
            <TagChip key={tag} label={tag} type="emotion" />
          ))}
          {trade.mistakeTags.map(tag => (
            <TagChip key={tag} label={tag} type="mistake" />
          ))}
        </div>

        {/* Note */}
        <p className="text-sm text-zinc-600 leading-relaxed">
          <span className="font-bold text-zinc-900 mr-2">Note:</span>
          {trade.note}
        </p>
      </div>
    </motion.div>
  );
};
