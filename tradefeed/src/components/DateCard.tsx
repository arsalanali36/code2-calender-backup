import React, { useState } from 'react';
import { Trade } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { TradeDetailModal } from './TradeDetailModal';

interface DateCardProps {
  date: string;
  trades: Trade[];
}

function formatDateHeader(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

export const DateCard: React.FC<DateCardProps> = ({ date, trades }) => {
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  // Collect all images from the day's trades for background
  const allImages = trades.flatMap(t => t.chartUrls);
  const bgImage = allImages[0] || null;

  const dayPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const isProfit = dayPnl >= 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-zinc-200 rounded-2xl overflow-hidden mb-6 shadow-sm"
      >
        {/* Date Header */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <h3 className="text-base font-bold text-zinc-900">{formatDateHeader(date)}</h3>
          <span className={`text-sm font-bold ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isProfit ? '+' : ''}₹{Math.abs(dayPnl).toLocaleString()}
          </span>
        </div>

        {/* Image with trade chips overlaid */}
        <div className="relative">
          {bgImage ? (
            <div className="relative aspect-square bg-zinc-100 overflow-hidden">
              <img
                src={bgImage}
                alt="Trade chart"
                className="w-full h-full object-cover"
              />
              {/* Dark gradient at bottom for readability */}
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

              {/* Trade chips overlaid on image */}
              <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
                {trades.map(trade => (
                  <button
                    key={trade.id}
                    onClick={() => setSelectedTrade(trade)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold text-white border backdrop-blur-sm transition-all active:scale-95 ${
                      trade.pnl >= 0
                        ? 'bg-emerald-600/80 border-emerald-400/50'
                        : 'bg-rose-600/80 border-rose-400/50'
                    }`}
                  >
                    {trade.instrument}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* No image — just show trade list */
            <div className="px-3 pb-3 flex flex-wrap gap-1.5">
              {trades.map(trade => (
                <button
                  key={trade.id}
                  onClick={() => setSelectedTrade(trade)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
                    trade.pnl >= 0
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-100 text-rose-700 border border-rose-200'
                  }`}
                >
                  {trade.instrument}
                  <span className="ml-1.5 opacity-70">
                    {trade.pnl >= 0 ? '+' : ''}₹{Math.abs(trade.pnl).toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Trade Detail Modal */}
      <AnimatePresence>
        {selectedTrade && (
          <TradeDetailModal
            trade={selectedTrade}
            onClose={() => setSelectedTrade(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
};
