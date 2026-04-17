import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SlidersHorizontal, CalendarDays, X, Trash2, Tag, Check, Grid3X3, Search } from 'lucide-react';
import type { Trade } from '../types';
import type { DayData } from './FullscreenViewerUtils';
import { PnlCalendarPicker } from './PnlCalendarPicker';
import { TagSheet } from './TagSheet';

interface GalleryViewProps {
  trades: Trade[];
  openViewer: (days: DayData[], dIdx: number, iIdx: number) => void;
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

export const GalleryView: React.FC<GalleryViewProps> = ({ trades, openViewer }) => {
  const [cols, setCols] = useState(3);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [tagSheetFor, setTagSheetFor] = useState<{ url: string; dayIdx: number } | null>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [filterSearch, setFilterSearch] = useState('');
  const [galleryDays, setGalleryDays] = useState<DayData[]>(() => buildGlobalList(trades));

  const galleryRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const pinchStartDist = useRef(0);
  const pinchStartCols = useRef(3);
  const colsRef = useRef(3);
  const isPinching = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  useEffect(() => { colsRef.current = cols; }, [cols]);
  useEffect(() => { setGalleryDays(buildGlobalList(trades)); }, [trades]);

  const showHeader = useCallback(() => {
    setHeaderVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHeaderVisible(false), 3000);
  }, []);

  useEffect(() => {
    showHeader();
    return () => clearTimeout(hideTimer.current);
  }, [showHeader]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const y = el.scrollTop;
      if (y < lastScrollY.current - 10) showHeader();
      else if (y > lastScrollY.current + 10) { clearTimeout(hideTimer.current); setHeaderVisible(false); }
      lastScrollY.current = y;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [showHeader]);

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

  const allTags = Array.from(new Set([
    ...trades.flatMap(t => t.emotionTags),
    ...trades.flatMap(t => t.strategyTags),
    ...trades.flatMap(t => t.mistakeTags),
  ])).sort();

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

  return (
    <div className="fixed inset-0 bg-black flex flex-col" ref={galleryRef} style={{ contain: 'layout style' }}>
      {/* Overlay header — auto-hide */}
      <motion.div
        animate={{ y: headerVisible ? 0 : -64, opacity: headerVisible ? 1 : 0 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-safe pt-3 pb-3"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)' }}
        onClick={showHeader}
      >
        {/* Filter button */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowFilterSheet(true); showHeader(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/15 text-white text-xs font-bold"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {activeFilters > 0 ? `Filters (${activeFilters})` : 'Filter'}
          {activeFilters > 0 && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
        </button>

        {/* Col count indicator */}
        <span className="text-white/30 text-[10px] font-mono">{cols}col</span>

        {/* Date picker button */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowDatePicker(true); showHeader(); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl backdrop-blur-md border text-xs font-bold transition-all ${selectedDate ? 'bg-indigo-600/80 border-indigo-400/40 text-white' : 'bg-black/40 border-white/15 text-white'}`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          {selectedDate ? selectedDate.slice(5).replace('-', '/') : 'Date'}
        </button>
      </motion.div>

      {/* Multi-select bar */}
      {isSelecting && (
        <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-zinc-900/95 backdrop-blur-sm border-b border-white/10 pt-safe">
          <button onClick={cancelSelection} className="text-sm text-zinc-400 font-medium">Cancel</button>
          <span className="text-sm font-bold text-white">{selectedUrls.size} selected</span>
          <button onClick={deleteSelected} disabled={!selectedUrls.size} className="text-sm font-bold text-rose-400 disabled:opacity-30 flex items-center gap-1">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      )}

      {/* Tap to show header overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none" onClick={showHeader} style={{ pointerEvents: (!headerVisible && !isSelecting) ? 'auto' : 'none' }} />

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
            {filteredDays.flatMap((day, dIdx) =>
              day.images.map((url, iIdx) => {
                const isVid = /\.(webm|mp4|mov|avi)(\?|$)/i.test(url);
                const isSel = selectedUrls.has(url);
                return (
                  <div
                    key={`${dIdx}-${iIdx}`}
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
              })
            )}
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

      {/* Tag Filter Bottom Sheet */}
      <AnimatePresence>
        {showFilterSheet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex flex-col justify-end" onClick={() => setShowFilterSheet(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative bg-zinc-900 rounded-t-2xl border-t border-white/10 shadow-2xl max-h-[75vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0"><div className="w-10 h-1 bg-white/20 rounded-full" /></div>
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 flex-shrink-0">
                <h2 className="text-sm font-bold text-white">Filter by Tag</h2>
                <div className="flex items-center gap-2">
                  {selectedTags.length > 0 && <button onClick={() => setSelectedTags([])} className="text-[11px] text-indigo-400 font-bold">Clear</button>}
                  <button onClick={() => { setShowFilterSheet(false); setFilterSearch(''); }} className="p-1.5 rounded-full hover:bg-white/10"><X className="w-4 h-4 text-white/60" /></button>
                </div>
              </div>
              {/* Search */}
              <div className="px-4 py-2 flex-shrink-0">
                <div className="flex items-center gap-2 bg-white/8 rounded-xl px-3 py-2 border border-white/10">
                  <Search className="w-4 h-4 text-white/40 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Search tags…"
                    value={filterSearch}
                    onChange={e => setFilterSearch(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
                    autoFocus
                  />
                  {filterSearch && <button onClick={() => setFilterSearch('')}><X className="w-3.5 h-3.5 text-white/30" /></button>}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-2">
                <div className="flex flex-wrap gap-2 pt-2">
                  {allTags.filter(t => t.toLowerCase().includes(filterSearch.toLowerCase())).map(tag => {
                    const on = selectedTags.includes(tag);
                    return (
                      <button key={tag} onClick={() => setSelectedTags(prev => on ? prev.filter(t => t !== tag) : [...prev, tag])}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1 ${on ? 'bg-indigo-600 border-transparent text-white' : 'bg-white/8 border-white/15 text-white/70'}`}>
                        {on && <Check className="w-3 h-3" />}{tag}
                      </button>
                    );
                  })}
                  {allTags.length === 0 && <p className="text-white/30 text-xs py-4 text-center w-full">No tags in your trades yet</p>}
                  {allTags.length > 0 && allTags.filter(t => t.toLowerCase().includes(filterSearch.toLowerCase())).length === 0 && (
                    <p className="text-white/30 text-xs py-4 text-center w-full">No tags match "{filterSearch}"</p>
                  )}
                </div>
              </div>
              <div className="px-4 pb-6 pt-2 flex-shrink-0">
                <button onClick={() => { setShowFilterSheet(false); setFilterSearch(''); }} className="w-full py-3 rounded-2xl font-bold text-sm bg-indigo-600 text-white">
                  {selectedTags.length > 0 ? `Apply ${selectedTags.length} filter${selectedTags.length > 1 ? 's' : ''}` : 'Done'}
                </button>
              </div>
            </motion.div>
          </motion.div>
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
