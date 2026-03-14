import React from 'react';
import { DayFeedCard } from './DayFeedCard';
import { Filter, Search } from 'lucide-react';
import { Trade } from '../types';

interface FeedViewProps {
  trades: Trade[];
  openViewer: (days: any[], dIdx: number, iIdx: number) => void;
}

export const FeedView: React.FC<FeedViewProps> = ({ trades, openViewer }) => {
  const grouped = trades.reduce((acc, t) => {
    const key = t.date || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, Trade[]>);

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // Full cross-date item list — one entry per trade, for fullscreen date navigation
  const allTradeItems = sortedDates.flatMap(d => {
    const dayPnl = grouped[d].reduce((s, t) => s + t.pnl, 0);
    return grouped[d].map((t, idx) => ({
      date: d,
      images: t.chartUrls,
      tradeNum: idx + 1,
      pnl: t.pnl,
      dayPnl
    }));
  });

  return (
    <div className="max-w-md mx-auto pb-24 pt-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Trade Feed</h1>
          <p className="text-xs text-zinc-500">Review your recent performance</p>
        </div>
        <div className="flex gap-2">
          <button className="p-2 bg-zinc-100 rounded-full text-zinc-600 hover:bg-zinc-200 transition-colors">
            <Search className="w-5 h-5" />
          </button>
          <button className="p-2 bg-zinc-100 rounded-full text-zinc-600 hover:bg-zinc-200 transition-colors">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {sortedDates.length === 0
        ? <p className="text-center text-zinc-400 text-sm mt-16">No trades yet.</p>
        : sortedDates.map(date => (
            <DayFeedCard
              key={date}
              trades={grouped[date]}
              allTradeItems={allTradeItems}
              openViewer={openViewer}
              onDateClick={() => {
                // Pass allTradeItems to allow jumping to ANY date from the viewer
                let targetIdx = 0;
                for(let i=0; i<allTradeItems.length; i++) {
                  if (allTradeItems[i].date === date) { targetIdx = i; break; }
                }
                openViewer(allTradeItems, targetIdx, 0);
              }}
            />
          ))
      }
    </div>
  );
};
