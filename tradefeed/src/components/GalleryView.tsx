import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MoreVertical, SlidersHorizontal, CalendarDays, X, Trash2, Tag, Check, Grid3X3, Search, Maximize2, Minimize2, LayoutGrid, BookOpen, BarChart2, Calendar as CalIcon, Home } from 'lucide-react';
import type { Trade } from '../types';
import type { DayData } from './FullscreenViewerUtils';
import { PnlCalendarPicker } from './PnlCalendarPicker';
import { TagSheet } from './TagSheet';

interface GalleryViewProps {
  trades: Trade[];
  openViewer: (days: DayData[], dIdx: number, iIdx: number) => void;
  onNavigate?: (view: string) => void;
}

interface ContextMenu { x: number; y: number; url: string; dayIdx: number; imgIdx: number; }

function buildGlobalList(trades: Trade[]): DayData[] {
  const sorted = [...trades].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const dayMap = new Map<string, number>();
  const list: DayData[] = [];
  sorted.forEach(t => {
    if (!t.chartUrls.length) return;
    const dayPnl = sorted.filter(x => x.date === t.date).reduce((s, x) => s + x.pnl, 0);
    const pos = dayMap.get(t.date) ?? 0;
    dayMap.set(t.date, pos + 1);
    list.push({
      date: t.date,
      images: t.chartUrls,
      tradeNum: pos + 1,
      pnl: t.pnl,
      dayPnl,
      isClose: (t as any).isClose,
      audios: t.audios,
      videos: t.videos,
      instrument: t.instrument,
      tags: [...t.emotionTags, ...t.strategyTags, ...t.mistakeTags],
      note: t.note,
    });
  });
  return list;
}

function computePnlByDate(trades: Trade[]): Record<string, number> {
  const map: Record<string, number> = {};
  trades.forEach(t => { map[t.date] = (map[t.date] ?? 0) + t.pnl; });
  return map;
}

export const GalleryView: React.FC<GalleryViewProps> = ({ trades, openViewer, onNavigate }) => {
  const [cols, setCols] = useState(3);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [tagSheetFor, setTagSheetFor] = useState<{ url: string; dayIdx: number } | null>(null);
  const [showTopMenu, setShowTopMenu] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [galleryDays, setGalleryDays] = useState<DayData[]>(() => buildGlobalList(trades));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [apiTags, setApiTags] = useState<string[]>([]);

  const galleryRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinchStartDist = useRef(0);
  const pinchStartCols = useRef(3);
  const colsRef = useRef(3);
  const isPinching = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  useEffect(() => { colsRef.current = cols; }, [cols]);
  useEffect(() => { setGalleryDays(buildGlobalList(trades)); }, [trades]);
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    const BASE = (import.meta as any).env?.VITE_API_URL ?? '';
    fetch(`${BASE}/api/trades`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const groups: Record<string, string[]> = data.tagGroups || {};
        setApiTags(Object.values(groups).flat());
      }).catch(() => {});
  }, []);

  const tagFrequency = useMemo(() => {
    const freq: Record<string, number> = {};
    trades.forEach(t => [...t.emotionTags, ...t.strategyTags, ...t.mistakeTags].forEach(tag => { freq[tag] = (freq[tag] ?? 0) + 1; }));
    return freq;
  }, [trades]);

  // Pinch-to-zoom: switch touch-action to 'none' on 2-finger start, restore on end
  // This avoids passive:false (which blocks native scroll)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      if (e.touches.length === 2) {
        isPinching.current = true;
        el.style.touchAction = 'none';
        pinchStartDist.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        pinchStartCols.current = colsRef.current;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (!isPinching.current || e.touches.length !== 2) return;
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const newCols = Math.min(10, Math.max(1, Math.round(pinchStartCols.current * (pinchStartDist.current / dist))));
      if (newCols !== colsRef.current) { setCols(newCols); colsRef.current = newCols; }
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2 && isPinching.current) {
        isPinching.current = false;
        el.style.touchAction = 'pan-y';
      }
      // Left-edge swipe → back to web app
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
      if (touchStartX.current < 40 && dx > 80 && dy < 60) window.location.href = '/';
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, []);

  const allTags = useMemo(() => {
    const tradeTags = trades.flatMap(t => [...t.emotionTags, ...t.strategyTags, ...t.mistakeTags]);
    return Array.from(new Set([...tradeTags, ...apiTags]))
      .sort((a, b) => (tagFrequency[b] ?? 0) - (tagFrequency[a] ?? 0));
  }, [trades, apiTags, tagFrequency]);
  const frequentTags = allTags.filter(t => (tagFrequency[t] ?? 0) >= 2).slice(0, 10);

  const pnlByDate = computePnlByDate(trades);

  const filteredDays = galleryDays.filter(d => {
    if (selectedDate && d.date !== selectedDate) return false;
    if (selectedTags.length > 0) {
      const dayTags = d.tags || [];
      if (!selectedTags.some(t => dayTags.includes(t))) return false;
    }
    return true;
  });

  const handleLongPressStart = (url: string, dayIdx: number, imgIdx: number, e: React.TouchEvent | React.MouseEvent) => {
    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const y = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    longPressTimer.current = setTimeout(() => {
      setContextMenu({ x, y, url, dayIdx, imgIdx });
    }, 550);
  };
  const handleLongPressEnd = () => clearTimeout(longPressTimer.current);

  const toggleSelectUrl = (url: string) => {
    setSelectedUrls(prev => { const n = new Set(prev); n.has(url) ? n.delete(url) : n.add(url); return n; });
  };
  const cancelSelection = () => { setIsSelecting(false); setSelectedUrls(new Set()); };

  const deleteSelected = async () => {
    const BASE = (import.meta as any).env?.VITE_API_URL ?? '';
    await Promise.all([...selectedUrls].map(url =>
      fetch(`${BASE}/api/delete-image`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ path: url }) }).catch(() => {})
    ));
    cancelSelection();
    window.location.reload();
  };

  const handleImageClick = (dayIdx: number, imgIdx: number) => {
    if (isSelecting) { toggleSelectUrl(filteredDays[dayIdx].images[imgIdx]); return; }
    openViewer(filteredDays, dayIdx, imgIdx);
  };

  const activeFilters = selectedTags.length + (selectedDate ? 1 : 0);

  const fmtDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return `${dt.toLocaleDateString('en-US', { weekday: 'short' })}, ${d} ${dt.toLocaleDateString('en-US', { month: 'short' })}`;
    } catch { return dateStr; }
  };

  type GridItem =
    | { type: 'header'; date: string; dayPnl: number }
    | { type: 'img'; url: string; dIdx: number; iIdx: number };

  const gridItems = useMemo<GridItem[]>(() => {
    const items: GridItem[] = [];
    let lastDate = '';
    filteredDays.forEach((day, dIdx) => {
      if (day.date !== lastDate) {
        const dp = filteredDays.filter(d => d.date === day.date).reduce((s, d) => s + (d.pnl ?? 0), 0);
        items.push({ type: 'header', date: day.date, dayPnl: dp });
        lastDate = day.date;
      }
      day.images.forEach((url, iIdx) => items.push({ type: 'img', url, dIdx, iIdx }));
    });
    return items;
  }, [filteredDays]);

  return (
    <div className="fixed inset-0 bg-black flex flex-col" ref={galleryRef}>
      {/* Top bar — always visible */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3 pb-2 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)' }}>

        {/* Active filter badges */}
        <div className="flex items-center gap-1 pointer-events-auto flex-1 min-w-0">
          {selectedDate && (
            <button onClick={() => setSelectedDate(null)} className="flex items-center gap-1 text-[10px] font-bold bg-indigo-600/80 border border-indigo-400/30 text-white px-2 py-0.5 rounded-full">
              {selectedDate.slice(5).replace('-', '/')} <X className="w-2.5 h-2.5" />
            </button>
          )}
          {selectedTags.map(t => (
            <button key={t} onClick={() => setSelectedTags(prev => prev.filter(x => x !== t))} className="flex items-center gap-1 text-[10px] font-bold bg-indigo-500/40 border border-indigo-400/30 text-indigo-200 px-2 py-0.5 rounded-full">
              {t} <X className="w-2.5 h-2.5" />
            </button>
          ))}
        </div>

        {/* Trade Pill — total P&L of visible trades */}
        {(() => {
          const total = filteredDays.reduce((s, d) => s + (d.pnl ?? 0), 0);
          const n = filteredDays.length;
          if (!n) return null;
          return (
            <div className="flex items-center gap-1.5 pointer-events-auto mx-2 flex-shrink-0">
              <span className={`text-[11px] font-black px-2 py-1 rounded-lg backdrop-blur-md border shadow-md ${total >= 0 ? 'bg-emerald-500/80 border-emerald-400/30 text-white' : 'bg-rose-500/80 border-rose-400/30 text-white'}`}>
                {total >= 0 ? '+' : ''}₹{Math.abs(total).toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] font-bold text-white/50">{n}T</span>
            </div>
          );
        })()}

        {/* 3-dot menu */}
        <div className="relative pointer-events-auto ml-auto">
          <button
            onClick={() => setShowTopMenu(m => !m)}
            className="relative p-2 rounded-full bg-black/50 backdrop-blur-md border border-white/15 active:scale-90 transition-transform"
          >
            <MoreVertical className="w-5 h-5 text-white" />
            {activeFilters > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-400 border border-black" />}
          </button>
          <AnimatePresence>
            {showTopMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowTopMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1 z-50 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden w-48"
                  onClick={e => e.stopPropagation()}
                >
                  <button onClick={() => { setShowFilterSheet(true); setShowTopMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors">
                    <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                    Filter by Tag
                    {selectedTags.length > 0 && <span className="ml-auto text-[10px] font-bold text-indigo-400">{selectedTags.length}</span>}
                  </button>
                  <button onClick={() => { setShowDatePicker(true); setShowTopMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors border-t border-white/10">
                    <CalendarDays className="w-4 h-4 text-sky-400" />
                    Pick Date
                    {selectedDate && <span className="ml-auto text-[10px] font-bold text-sky-400">{selectedDate.slice(5)}</span>}
                  </button>
                  {activeFilters > 0 && (
                    <button onClick={() => { setSelectedTags([]); setSelectedDate(null); setShowTopMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-rose-400 hover:bg-white/10 transition-colors border-t border-white/10">
                      <X className="w-4 h-4" /> Clear Filters
                    </button>
                  )}
                  <button onClick={() => {
                      if (isFullscreen) document.exitFullscreen?.().catch(()=>{});
                      else document.documentElement.requestFullscreen?.().catch(()=>{});
                      setShowTopMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors border-t border-white/10">
                    {isFullscreen ? <Minimize2 className="w-4 h-4 text-emerald-400" /> : <Maximize2 className="w-4 h-4 text-emerald-400" />}
                    {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
                  </button>
                  <div className="border-t border-white/10 px-4 py-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-1">Go to</p>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { label: 'Feed', icon: <Home className="w-3 h-3" />, view: 'feed' },
                        { label: 'Cal', icon: <CalIcon className="w-3 h-3" />, view: 'calendar' },
                        { label: 'Stats', icon: <BarChart2 className="w-3 h-3" />, view: 'dashboard' },
                        { label: 'Blog', icon: <BookOpen className="w-3 h-3" />, view: 'blog' },
                      ].map(({ label, icon, view }) => (
                        <button key={view} onClick={() => { onNavigate?.(view); setShowTopMenu(false); }}
                          className="flex items-center gap-1 text-[11px] font-semibold text-white/70 bg-white/10 px-2.5 py-1.5 rounded-lg hover:bg-white/20 transition-colors">
                          {icon} {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Multi-select bar */}
      {isSelecting && (
        <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-zinc-900/95 backdrop-blur-sm border-b border-white/10">
          <button onClick={cancelSelection} className="text-sm text-zinc-400 font-medium">Cancel</button>
          <span className="text-sm font-bold text-white">{selectedUrls.size} selected</span>
          <button onClick={deleteSelected} disabled={!selectedUrls.size} className="text-sm font-bold text-rose-400 disabled:opacity-30 flex items-center gap-1">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      )}

      {/* Gallery grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pt-12" style={{ touchAction: 'pan-y', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        {filteredDays.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-3 pb-24">
            <Grid3X3 className="w-12 h-12 opacity-20" />
            <p className="text-sm">No images match the filter</p>
            {activeFilters > 0 && (
              <button onClick={() => { setSelectedTags([]); setSelectedDate(null); }} className="text-xs text-indigo-400 underline">Clear filters</button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '2px' }}>
            {gridItems.map((item, idx) => {
              if (item.type === 'header') {
                const pos = item.dayPnl >= 0;
                return (
                  <div key={`h-${item.date}`} style={{ gridColumn: '1 / -1' }}
                    className="flex items-center justify-between px-3 py-2 bg-zinc-950/90 border-b border-white/5">
                    <span className="text-xs font-bold text-white/80">{fmtDate(item.date)}</span>
                    <span className={`text-xs font-black ${pos ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pos ? '+' : ''}₹{Math.abs(item.dayPnl).toLocaleString('en-IN')}
                    </span>
                  </div>
                );
              }
              const { url, dIdx, iIdx } = item;
              const isVid = /\.(webm|mp4|mov|avi)(\?|$)/i.test(url);
              const isSel = selectedUrls.has(url);
              return (
                <div
                  key={`${dIdx}-${iIdx}-${idx}`}
                  className={`aspect-square bg-zinc-900 overflow-hidden relative cursor-pointer ${isSel ? 'ring-2 ring-indigo-500 ring-inset' : ''}`}
                  onTouchStart={(e) => handleLongPressStart(url, dIdx, iIdx, e)}
                  onTouchMove={handleLongPressEnd}
                  onTouchEnd={handleLongPressEnd}
                  onMouseDown={(e) => handleLongPressStart(url, dIdx, iIdx, e)}
                  onMouseUp={handleLongPressEnd}
                  onClick={() => handleImageClick(dIdx, iIdx)}
                >
                  {isVid ? (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                      <span className="text-violet-400 text-2xl">▶</span>
                    </div>
                  ) : (
                    <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                  )}
                  {isSel && (
                    <div className="absolute inset-0 bg-indigo-500/30 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center shadow">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="h-24" />
      </div>

      {/* Long-press context menu */}
      <AnimatePresence>
        {contextMenu && (
          <>
            <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed z-[60] bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden w-48"
              style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: Math.min(contextMenu.y, window.innerHeight - 120) }}
              onClick={e => e.stopPropagation()}
            >
              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-white hover:bg-white/10 transition-colors"
                onClick={() => { setTagSheetFor({ url: contextMenu.url, dayIdx: contextMenu.dayIdx }); setContextMenu(null); }}
              >
                <Tag className="w-4 h-4 text-indigo-400" /> Assign Tags
              </button>
              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-white hover:bg-white/10 transition-colors border-t border-white/10"
                onClick={() => { setIsSelecting(true); setSelectedUrls(new Set([contextMenu.url])); setContextMenu(null); }}
              >
                <Check className="w-4 h-4 text-sky-400" /> Select
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Tag Filter — floating panel */}
      <AnimatePresence>
        {showFilterSheet && (
          <>
            <div className="fixed inset-0 z-[150]" onClick={() => { setShowFilterSheet(false); setFilterSearch(''); }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ duration: 0.15 }}
              className="fixed top-14 left-4 right-4 z-[160] bg-zinc-950 border border-white/15 rounded-2xl shadow-2xl flex flex-col"
              style={{ maxHeight: 'calc(100vh - 80px)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
                <div className="flex items-center gap-2 bg-white/8 rounded-xl px-3 py-1.5 border border-white/10 flex-1 mr-2">
                  <Search className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
                  <input type="text" placeholder="Search tags…" value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none" autoFocus />
                  {filterSearch && <button onClick={() => setFilterSearch('')}><X className="w-3 h-3 text-white/30" /></button>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {selectedTags.length > 0 && <button onClick={() => setSelectedTags([])} className="text-[11px] text-indigo-400 font-bold px-1">Clear</button>}
                  <button onClick={() => { setShowFilterSheet(false); setFilterSearch(''); }} className="p-1 rounded-full hover:bg-white/10">
                    <X className="w-4 h-4 text-white/50" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {!filterSearch && frequentTags.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Frequent</p>
                    <div className="flex flex-wrap gap-2">
                      {frequentTags.map(tag => {
                        const on = selectedTags.includes(tag);
                        return (
                          <button key={tag} onClick={() => setSelectedTags(prev => on ? prev.filter(t => t !== tag) : [...prev, tag])}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1 ${on ? 'bg-indigo-600 border-transparent text-white' : 'bg-white/12 border-white/20 text-white/80'}`}>
                            {on && <Check className="w-3 h-3" />}{tag}
                            <span className="text-[9px] opacity-50">{tagFrequency[tag]}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="border-t border-white/8 mt-3 mb-3" />
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">All Tags</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {allTags.filter(t => t.toLowerCase().includes(filterSearch.toLowerCase())).map(tag => {
                    const on = selectedTags.includes(tag);
                    const freq = tagFrequency[tag];
                    return (
                      <button key={tag} onClick={() => setSelectedTags(prev => on ? prev.filter(t => t !== tag) : [...prev, tag])}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1 ${on ? 'bg-indigo-600 border-transparent text-white' : 'bg-white/8 border-white/15 text-white/70'}`}>
                        {on && <Check className="w-3 h-3" />}{tag}
                        {freq > 1 && !filterSearch && <span className="text-[9px] opacity-40">{freq}</span>}
                      </button>
                    );
                  })}
                  {allTags.length === 0 && <p className="text-white/30 text-xs py-3 text-center w-full">No tags yet</p>}
                  {allTags.length > 0 && !allTags.some(t => t.toLowerCase().includes(filterSearch.toLowerCase())) && (
                    <p className="text-white/30 text-xs py-3 text-center w-full">No match for "{filterSearch}"</p>
                  )}
                </div>
              </div>
              {selectedTags.length > 0 && (
                <div className="px-4 pb-3 flex-shrink-0">
                  <button onClick={() => { setShowFilterSheet(false); setFilterSearch(''); }}
                    className="w-full py-2.5 rounded-xl font-bold text-sm bg-indigo-600 text-white">
                    Apply {selectedTags.length} filter{selectedTags.length > 1 ? 's' : ''}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* P&L Date Picker */}
      {showDatePicker && (
        <PnlCalendarPicker
          pnlByDate={pnlByDate}
          selectedDate={selectedDate}
          onSelect={(d) => { setSelectedDate(d); setShowDatePicker(false); }}
          onClose={() => setShowDatePicker(false)}
        />
      )}

      {/* Tag Sheet */}
      {tagSheetFor && (
        <TagSheet
          imageUrl={tagSheetFor.url}
          currentTags={filteredDays[tagSheetFor.dayIdx]?.tags || []}
          currentNote={filteredDays[tagSheetFor.dayIdx]?.note || ''}
          onSave={(newTags, newNote) => {
            setGalleryDays(prev => prev.map((d, i) => {
              if (i !== tagSheetFor.dayIdx) return d;
              return { ...d, tags: newTags, note: newNote };
            }));
            setTagSheetFor(null);
          }}
          onClose={() => setTagSheetFor(null)}
        />
      )}
    </div>
  );
};
