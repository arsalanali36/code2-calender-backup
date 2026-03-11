import React from 'react';
import { DayFeedCard } from './DayFeedCard';
import { Filter, Search } from 'lucide-react';
import { Trade } from '../types';

interface FeedViewProps {
  trades: Trade[];
}

export const FeedView: React.FC<FeedViewProps> = ({ trades }) => {
  const grouped = trades.reduce((acc: Record<string, Trade[]>, t) => {
    const key = t.date || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

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
            <DayFeedCard key={date} trades={grouped[date]} />
          ))
      }
    </div>
  );
};
