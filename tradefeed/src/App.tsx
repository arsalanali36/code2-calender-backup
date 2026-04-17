/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { FeedView } from './components/FeedView';
import { BlogView } from './components/BlogView';
import { BottomNav } from './components/BottomNav';
import { CalendarView } from './components/CalendarView';
import { DashboardView } from './components/DashboardView';
import { ViewType, Trade } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { PlusSquare } from 'lucide-react'; // eslint-disable-line
import { ImageImport } from './components/ImageImport';
import { Tagger } from './components/Tagger';
import { TradeLogger } from './components/TradeLogger';
import { fetchTrades } from './services/api';
import { FullscreenViewer } from './components/FullscreenViewer';
import { GalleryView } from './components/GalleryView';

const TableView = ({ trades, onLogTrade }: { trades: Trade[], onLogTrade: () => void }) => (
  <div className="max-w-md mx-auto p-6 pb-24">
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-bold text-zinc-900">Trade History</h1>
      <button
        onClick={onLogTrade}
        className="p-2 bg-zinc-900 text-white rounded-full shadow-lg hover:bg-zinc-800 transition-all active:scale-95"
      >
        <PlusSquare className="w-5 h-5" />
      </button>
    </div>
    <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
      <table className="w-full text-left text-xs">
        <thead className="bg-zinc-50 border-b border-zinc-200">
          <tr>
            <th className="p-3 font-bold text-zinc-500 uppercase">Instrument</th>
            <th className="p-3 font-bold text-zinc-500 uppercase text-right">P&L</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {trades.map(trade => (
            <tr key={trade.id}>
              <td className="p-3">
                <p className="font-bold text-zinc-900">{trade.instrument}</p>
                <p className="text-[10px] text-zinc-400">{trade.date}</p>
              </td>
              <td className={`p-3 text-right font-bold ${trade.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {trade.pnl >= 0 ? '+' : ''}₹{Math.abs(trade.pnl).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('view') as ViewType) || 'feed';
  });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fullscreen Viewer State
  const [fsOpen, setFsOpen]             = useState(false);
  const [fsDayIndex, setFsDayIndex]     = useState(0);
  const [fsImageIndex, setFsImageIndex] = useState(0);
  const [fsDays, setFsDays]             = useState<any[]>([]);
  const [fsInitialLocked, setFsInitialLocked] = useState(false);

  const openViewer = (days: any[], dIdx: number, iIdx: number, locked = false) => {
    setFsDays(days);
    setFsDayIndex(dIdx);
    setFsImageIndex(iIdx);
    setFsInitialLocked(locked);
    setFsOpen(true);
    window.history.pushState({ view: 'fullscreen' }, '');
  };

  // Global Back Gesture + Backspace key
  useEffect(() => {
    const handlePopState = () => {
      if (fsOpen) { setFsOpen(false); return; }
      if (currentView !== 'feed') setCurrentView('feed');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [fsOpen, currentView]);

  useEffect(() => {
    if (currentView !== 'feed') window.history.pushState({ view: currentView }, '');
  }, [currentView]);

  // Global Backspace = browser back (like edge swipe)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace') return;
      const target = e.target as HTMLElement;
      if (target.matches('input, textarea, [contenteditable]')) return;
      e.preventDefault();
      window.history.back();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    fetchTrades()
      .then(data => { setTrades(data); setLoading(false); })
      .catch(err => { setFetchError(String(err)); setLoading(false); });
  }, []);

  // Creation Flow State
  const [creationImages, setCreationImages] = useState<string[]>([]);
  const [creationTags, setCreationTags]     = useState<{ emotion: string[], strategy: string[], mistake: string[] }>({ emotion: [], strategy: [], mistake: [] });

  const handleSaveTrade = (tradeData: Partial<Trade>) => {
    const newTrade: Trade = {
      id: Math.random().toString(36).substr(2, 9),
      instrument: tradeData.instrument || 'Unknown',
      pnl: tradeData.pnl || 0,
      type: tradeData.type || 'Long',
      session: tradeData.session || 'Morning',
      date: tradeData.date || new Date().toISOString().split('T')[0],
      chartUrls: tradeData.chartUrls || [],
      emotionTags: tradeData.emotionTags || [],
      strategyTags: tradeData.strategyTags || [],
      mistakeTags: tradeData.mistakeTags || [],
      note: tradeData.note || '',
      stats: tradeData.stats || { rMultiple: 0, riskReward: '1:1', positionSize: 0 },
      currency: '₹'
    };
    setTrades([newTrade, ...trades]);
    setCurrentView('feed');
    setCreationImages([]);
    setCreationTags({ emotion: [], strategy: [], mistake: [] });
  };

  const renderView = () => {
    switch (currentView) {
      case 'feed':      return <FeedView trades={trades} openViewer={openViewer} />;
      case 'calendar':  return <CalendarView trades={trades} openViewer={openViewer} />;
      case 'dashboard': return <DashboardView trades={trades} openViewer={openViewer} />;
      case 'table':     return <TableView trades={trades} onLogTrade={() => setCurrentView('import')} />;
      case 'gallery':   return <GalleryView trades={trades} openViewer={(days, dIdx, iIdx) => openViewer(days as any[], dIdx, iIdx)} />;
      case 'blog':      return <BlogView />;
      case 'import':
        return (
          <ImageImport
            onNext={(images) => { setCreationImages(images); setCurrentView('tagger'); }}
            onCancel={() => setCurrentView('feed')}
          />
        );
      case 'tagger':
        return (
          <Tagger
            images={creationImages}
            onNext={(tags) => { setCreationTags(tags); setCurrentView('logger'); }}
            onBack={() => setCurrentView('import')}
          />
        );
      case 'logger':
        return (
          <TradeLogger
            images={creationImages}
            tags={creationTags}
            onSave={handleSaveTrade}
            onBack={() => setCurrentView('tagger')}
          />
        );
      default: return <FeedView trades={trades} openViewer={openViewer} />;
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-zinc-400 text-sm">Loading trades…</div>
  );

  if (fetchError) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-rose-600 font-bold">Failed to load data</p>
      <p className="text-xs text-zinc-500 break-all">{fetchError}</p>
      <button onClick={() => window.location.reload()} className="mt-2 px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm">Retry</button>
      <a href="/" className="text-xs text-indigo-600 underline">Back to Desktop</a>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <main className="relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      <FullscreenViewer
        days={fsDays}
        initialDayIndex={fsDayIndex}
        initialImageIndex={fsImageIndex}
        isOpen={fsOpen}
        onClose={() => setFsOpen(false)}
        initialLocked={fsInitialLocked}
        onUpdateDays={setFsDays}
      />

      <BottomNav currentView={currentView} onViewChange={setCurrentView} />

      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full" />
      </div>
    </div>
  );
}
