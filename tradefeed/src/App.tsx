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
import { PlusSquare, Grid3X3, ChevronLeft, ChevronRight } from 'lucide-react';
import { ImageImport } from './components/ImageImport';
import { Tagger } from './components/Tagger';
import { TradeLogger } from './components/TradeLogger';
import { fetchTrades } from './services/api';
import { FullscreenViewer } from './components/FullscreenViewer';

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

const GalleryView = ({ trades, openViewer }: { trades: Trade[], openViewer: (days: any[], dIdx: number, iIdx: number) => void }) => {
  const [selectedTag, setSelectedTag]       = useState<string | null>(null);
  const [galleryMode, setGalleryMode]       = useState<'tags' | 'day'>('tags');
  const [cols, setCols]                     = useState(3);
  const [isSelecting, setIsSelecting]       = useState(false);
  const [selectedUrls, setSelectedUrls]     = useState<Set<string>>(new Set());

  const galleryRef     = React.useRef<HTMLDivElement>(null);
  const pinchStartDist = React.useRef(0);
  const pinchStartCols = React.useRef(3);
  const colsRef        = React.useRef(3);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout>>();
  React.useEffect(() => { colsRef.current = cols; }, [cols]);

  React.useEffect(() => {
    const el = galleryRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      pinchStartDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartCols.current = colsRef.current;
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = pinchStartDist.current / dist;
      // min 1 col (single image), max 10 cols (small thumbnails)
      const newCols = Math.min(10, Math.max(1, Math.round(pinchStartCols.current * ratio)));
      setCols(newCols);
      colsRef.current = newCols;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
    };
  }, []);

  const handleLongPressStart = (url: string) => {
    longPressTimer.current = setTimeout(() => {
      setIsSelecting(true);
      setSelectedUrls(new Set([url]));
    }, 550);
  };
  const handleLongPressEnd = () => {
    clearTimeout(longPressTimer.current);
  };
  const toggleSelect = (url: string) => {
    setSelectedUrls(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  };
  const cancelSelection = () => { setIsSelecting(false); setSelectedUrls(new Set()); };
  const deleteSelected = async () => {
    const urls = [...selectedUrls];
    await Promise.all(urls.map(url =>
      fetch('/api/delete-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: url }) }).catch(() => {})
    ));
    cancelSelection();
    window.location.reload();
  };

  const allTags = Array.from(new Set([
    ...trades.flatMap(t => t.emotionTags),
    ...trades.flatMap(t => t.strategyTags),
    ...trades.flatMap(t => t.mistakeTags)
  ])).sort();

  const filteredTrades = trades.filter(t =>
    !selectedTag ||
    t.emotionTags.includes(selectedTag) ||
    t.strategyTags.includes(selectedTag) ||
    t.mistakeTags.includes(selectedTag)
  );

  const filteredImages = filteredTrades.flatMap(t => t.chartUrls.map(url => ({
    url, tradeId: t.id, tag: t.strategyTags[0] || t.emotionTags[0] || t.mistakeTags[0] || ''
  })));

  const groupedByDay = trades.reduce((acc, trade) => {
    const date = trade.date;
    if (!acc[date]) acc[date] = [];
    trade.chartUrls.forEach(url => {
      acc[date].push({ url, tradeId: trade.id, tag: trade.strategyTags[0] || trade.emotionTags[0] || '' });
    });
    return acc;
  }, {} as Record<string, { url: string, tradeId: string, tag: string }[]>);

  const sortedDates = Object.keys(groupedByDay).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const gridStyle = { display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '2px' };

  return (
    <div className="pb-24" ref={galleryRef}>
      {/* Multi-select delete bar */}
      {isSelecting && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-zinc-900/95 backdrop-blur-sm">
          <button onClick={cancelSelection} className="text-sm text-zinc-400 font-medium">Cancel</button>
          <span className="text-sm font-bold text-white">{selectedUrls.size} selected</span>
          <button onClick={deleteSelected} className="text-sm font-bold text-rose-400">Delete</button>
        </div>
      )}

      <div className={`px-4 flex items-center justify-between mb-3 ${isSelecting ? 'pt-16' : 'pt-6'}`}>
        <h1 className="text-2xl font-bold text-zinc-900">Gallery</h1>
        <button
          onClick={() => setGalleryMode(galleryMode === 'tags' ? 'day' : 'tags')}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          {galleryMode === 'tags' ? 'Day view' : 'Tags view'}
        </button>
      </div>

      {galleryMode === 'tags' ? (
        <>
          <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar px-4">
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                !selectedTag ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
              }`}
            >
              All Charts
            </button>
            {allTags.map(tag => (
              <button key={tag} onClick={() => setSelectedTag(tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  selectedTag === tag ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <div style={gridStyle}>
            {filteredImages.map((img, i) => {
              const sel = selectedUrls.has(img.url);
              return (
                <div
                  key={`${img.tradeId}-${i}`}
                  className={`aspect-square bg-zinc-100 overflow-hidden group cursor-pointer relative ${sel ? 'ring-2 ring-indigo-500 ring-inset' : ''}`}
                  onTouchStart={() => handleLongPressStart(img.url)}
                  onTouchEnd={handleLongPressEnd}
                  onMouseDown={() => handleLongPressStart(img.url)}
                  onMouseUp={handleLongPressEnd}
                  onClick={() => {
                    if (isSelecting) { toggleSelect(img.url); return; }
                    const dayImages = filteredImages.map(f => f.url);
                    openViewer([{ date: selectedTag || 'Filtered', images: dayImages }], 0, i);
                  }}
                >
                  <img src={img.url} alt="Gallery" className="w-full h-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" />
                  {sel && (
                    <div className="absolute inset-0 bg-indigo-500/30 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow">✓</div>
                    </div>
                  )}
                  {!isSelecting && img.tag && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 transition-colors">
                      <span className="text-[10px] font-black text-white uppercase tracking-widest drop-shadow-md transform -rotate-12 select-none pointer-events-none">
                        {img.tag}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {filteredImages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
              <Grid3X3 className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-sm">No charts found for this tag</p>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-8">
          {sortedDates.map(date => (
            <div key={date}>
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2 px-4">
                <div className="h-px flex-1 bg-zinc-100" />
                {new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                <div className="h-px flex-1 bg-zinc-100" />
              </h3>
              <div style={gridStyle}>
                {groupedByDay[date].map((img, i) => (
                  <div
                    key={`${img.tradeId}-${i}`}
                    className="aspect-square bg-zinc-100 overflow-hidden cursor-pointer"
                    onClick={() => {
                      const globalList: { date: string, images: string[], tradeNum?: number, pnl?: number, dayPnl?: number }[] = [];
                      let targetTradeIdx = 0, targetImgIdx = 0;
                      sortedDates.forEach(d => {
                        const tradesForDay = trades.filter(t => t.date === d);
                        const dPnl = tradesForDay.reduce((s, t) => s + t.pnl, 0);
                        tradesForDay.forEach((t, tIdx) => {
                          const currentTIdx = globalList.length;
                          globalList.push({ date: d, images: t.chartUrls, tradeNum: tIdx + 1, pnl: t.pnl, dayPnl: dPnl });
                          const foundImgIdx = t.chartUrls.indexOf(img.url);
                          if (d === date && foundImgIdx !== -1) {
                            targetTradeIdx = currentTIdx;
                            targetImgIdx = foundImgIdx;
                          }
                        });
                      });
                      openViewer(globalList, targetTradeIdx, targetImgIdx);
                    }}
                  >
                    <img src={img.url} alt="Gallery" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('feed');
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
      case 'gallery':   return <GalleryView trades={trades} openViewer={openViewer} />;
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
