/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { FeedView } from './components/FeedView';
import { BlogView } from './components/BlogView';
import { BottomNav } from './components/BottomNav';
import { LoginScreen } from './components/LoginScreen';
import { ViewType, Trade } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { PlusSquare, Grid3X3, ChevronLeft, ChevronRight } from 'lucide-react';
import { ImageImport } from './components/ImageImport';
import { Tagger } from './components/Tagger';
import { TradeLogger } from './components/TradeLogger';
import { fetchTrades, checkAuth, clearToken } from './services/api';

const CalendarView = ({ trades }: { trades: Trade[] }) => {
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Build day → pnl map from real trades
  const dayPnl: Record<string, number> = {};
  trades.forEach(t => {
    if (!t.date) return;
    dayPnl[t.date] = (dayPnl[t.date] || 0) + t.pnl;
  });

  const monthName = new Date(viewYear, viewMonth).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const firstDay  = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedDate(null);
  };

  // Month total
  const monthTotal = Object.entries(dayPnl)
    .filter(([d]) => d.startsWith(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`))
    .reduce((sum, [, v]) => sum + v, 0);

  const selectedTrades = selectedDate ? trades.filter(t => t.date === selectedDate) : [];
  const selectedPnl    = selectedTrades.reduce((s, t) => s + t.pnl, 0);

  return (
    <div className="max-w-md mx-auto pt-6 px-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-zinc-900">Cal</h1>
        <span className={`text-sm font-bold px-3 py-1 rounded-full border ${monthTotal >= 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
          {monthTotal >= 0 ? '+' : ''}₹{Math.abs(monthTotal).toLocaleString()}
        </span>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold text-zinc-700">{monthName}</span>
        <button onClick={nextMonth} className="p-1.5 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-zinc-400">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 mb-6">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day   = i + 1;
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const pnl   = dayPnl[dateStr];
          const isToday = dateStr === today.toISOString().split('T')[0];
          const isSelected = selectedDate === dateStr;

          return (
            <button
              key={day}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[11px] font-bold transition-all
                ${pnl !== undefined
                  ? pnl >= 0
                    ? 'bg-emerald-500 text-white'
                    : 'bg-rose-500 text-white'
                  : 'bg-zinc-50 text-zinc-400 border border-zinc-100'}
                ${isToday && pnl === undefined ? 'border-indigo-400 border-2' : ''}
                ${isSelected ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDate && selectedTrades.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{selectedDate}</span>
            <span className={`text-sm font-bold ${selectedPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {selectedPnl >= 0 ? '+' : ''}₹{Math.abs(selectedPnl).toLocaleString()}
            </span>
          </div>
          <div className="space-y-2">
            {selectedTrades.map(t => (
              <div key={t.id} className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-800">{t.instrument}</span>
                <span className={`text-xs font-bold ${t.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {t.pnl >= 0 ? '+' : ''}₹{Math.abs(t.pnl).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const DashboardView = ({ trades }: { trades: Trade[] }) => {
  const sorted = [...trades].filter(t => t.date).sort((a, b) => a.date.localeCompare(b.date));

  // Equity curve — cumulative P&L per trade
  const equity: number[] = [];
  let cum = 0;
  sorted.forEach(t => { cum += Number(t.pnl) || 0; equity.push(cum); });

  // Stats
  const wins   = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);
  const winRate     = trades.length ? Math.round((wins.length / trades.length) * 100) : 0;
  const grossWin    = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss   = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : '∞';
  const totalPnl    = trades.reduce((s, t) => s + t.pnl, 0);
  const avgWin      = wins.length ? Math.round(grossWin / wins.length) : 0;
  const avgLoss     = losses.length ? Math.round(grossLoss / losses.length) : 0;

  // SVG equity curve
  const W = 300, H = 100, pad = 8;
  const minE = Math.min(0, ...equity);
  const maxE = Math.max(0, ...equity);
  const range = maxE - minE || 1;
  const toX = (i: number) => pad + (i / Math.max(equity.length - 1, 1)) * (W - pad * 2);
  const toY = (v: number) => H - pad - ((v - minE) / range) * (H - pad * 2);
  const zeroY = toY(0);

  const pts = equity.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const areaPath = equity.length > 1
    ? `M${toX(0)},${zeroY} ` + equity.map((v, i) => `L${toX(i)},${toY(v)}`).join(' ') + ` L${toX(equity.length - 1)},${zeroY} Z`
    : '';

  return (
    <div className="max-w-md mx-auto pt-6 px-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Stats</h1>
        <span className={`text-sm font-bold px-3 py-1 rounded-full border ${totalPnl >= 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
          {totalPnl >= 0 ? '+' : ''}₹{Math.abs(totalPnl).toLocaleString()}
        </span>
      </div>

      {/* Equity Curve */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm mb-4">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Equity Curve</span>
        {equity.length > 1 ? (
          <div className="mt-2" style={{ height: 80 }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none">
            {/* Zero line */}
            <line x1={pad} y1={zeroY} x2={W - pad} y2={zeroY} stroke="#e4e4e7" strokeWidth="1" />
            {/* Fill area */}
            <path d={areaPath} fill={totalPnl >= 0 ? '#10b98120' : '#f43f5e20'} />
            {/* Line */}
            <polyline points={pts} fill="none" stroke={totalPnl >= 0 ? '#10b981' : '#f43f5e'} strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          </div>
        ) : (
          <p className="text-xs text-zinc-400 mt-2 italic">Not enough data</p>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] font-bold text-zinc-400 uppercase">Win Rate</span>
          <p className="text-xl font-bold text-zinc-900">{winRate}%</p>
          <p className="text-[10px] text-zinc-400">{wins.length}W / {losses.length}L</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] font-bold text-zinc-400 uppercase">Profit Factor</span>
          <p className="text-xl font-bold text-zinc-900">{profitFactor}</p>
          <p className="text-[10px] text-zinc-400">{trades.length} trades</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] font-bold text-zinc-400 uppercase">Avg Win</span>
          <p className="text-xl font-bold text-emerald-600">+₹{avgWin.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] font-bold text-zinc-400 uppercase">Avg Loss</span>
          <p className="text-xl font-bold text-rose-600">-₹{avgLoss.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};

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

const GalleryView = ({ trades }: { trades: Trade[] }) => {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [galleryMode, setGalleryMode] = useState<'tags' | 'day'>('tags');
  const [cols, setCols] = useState(3);
  const galleryRef = React.useRef<HTMLDivElement>(null);
  const pinchStartDist = React.useRef(0);
  const pinchStartCols = React.useRef(3);
  const colsRef = React.useRef(3);
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
      const newCols = Math.min(5, Math.max(2, Math.round(pinchStartCols.current * ratio)));
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
  
  // Extract all unique tags
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

  const filteredImages = filteredTrades
    .flatMap(t => t.chartUrls.map(url => ({ 
      url, 
      tradeId: t.id, 
      tag: t.strategyTags[0] || t.emotionTags[0] || t.mistakeTags[0] || '' 
    })));

  // Group by day logic
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
      <div className="px-4 pt-6 flex items-center justify-between mb-3">
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
          {/* Tag Filter Bar */}
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
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  selectedTag === tag ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          <div style={gridStyle}>
            {filteredImages.map((img, i) => (
              <div key={`${img.tradeId}-${i}`} className="aspect-square bg-zinc-100 overflow-hidden group cursor-pointer relative">
                <img 
                  src={img.url} 
                  alt="Gallery" 
                  className="w-full h-full object-cover transition-transform group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                {img.tag && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 transition-colors">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest drop-shadow-md transform -rotate-12 select-none pointer-events-none">
                      {img.tag}
                    </span>
                  </div>
                )}
              </div>
            ))}
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
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-zinc-100" />
                {new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                <div className="h-px flex-1 bg-zinc-100" />
              </h3>
              <div style={gridStyle}>
                {groupedByDay[date].map((img, i) => (
                  <div key={`${img.tradeId}-${i}`} className="aspect-square bg-zinc-100 overflow-hidden cursor-pointer">
                    <img
                      src={img.url}
                      alt="Gallery"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
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
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [creationImages, setCreationImages] = useState<string[]>([]);
  const [creationTags, setCreationTags] = useState<{ emotion: string[], strategy: string[], mistake: string[] }>({ emotion: [], strategy: [], mistake: [] });
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Check stored token on mount
  useEffect(() => {
    checkAuth().then(user => {
      if (user) setAuthEmail(user.email);
      setAuthChecked(true);
    });
  }, []);

  // Load trades once authenticated
  useEffect(() => {
    if (!authEmail) return;
    fetchTrades()
      .then(data => { setTrades(data); setFetchError(null); })
      .catch(err => setFetchError(String(err)));
  }, [authEmail]);

  if (!authChecked) {
    return <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
    </div>;
  }

  if (!authEmail) {
    return <LoginScreen onLogin={email => setAuthEmail(email)} />;
  }

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
    // Reset flow
    setCreationImages([]);
    setCreationTags({ emotion: [], strategy: [], mistake: [] });
  };

  const renderView = () => {
    switch (currentView) {
      case 'feed':
        return <FeedView trades={trades} />;
      case 'calendar':
        return <CalendarView trades={trades} />;
      case 'dashboard':
        return <DashboardView trades={trades} />;
      case 'table':
        return <TableView trades={trades} onLogTrade={() => setCurrentView('import')} />;
      case 'gallery':
        return <GalleryView trades={trades} />;
      case 'blog':
        return <BlogView />;
      case 'import':
        return (
          <ImageImport 
            onNext={(images) => {
              setCreationImages(images);
              setCurrentView('tagger');
            }}
            onCancel={() => setCurrentView('feed')}
          />
        );
      case 'tagger':
        return (
          <Tagger 
            images={creationImages}
            onNext={(tags) => {
              setCreationTags(tags);
              setCurrentView('logger');
            }}
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
      default:
        return <FeedView trades={trades} />;
    }
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {fetchError && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-rose-50 border-b border-rose-200 px-4 py-2 text-xs text-rose-700 font-mono break-all">
          ⚠ {fetchError}
        </div>
      )}
      {/* Main Content Area */}
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

      {/* Persistent Bottom Navigation */}
      <BottomNav currentView={currentView} onViewChange={setCurrentView} />

      {/* Decorative Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full" />
      </div>
    </div>
  );
}
