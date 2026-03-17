import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle, Send, Lock, Unlock, Calendar, MoreVertical, Share2, Copy, Flag, ChevronDown, Trash2, Star, Move, Download, Upload, ImagePlus } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';

const fmt = (n: number) => Math.round(Math.abs(n)).toLocaleString('en-IN');

interface DayData {
  date: string;
  images: string[];
  tradeNum?: number;
  pnl?: number;      // this trade's P/L
  dayPnl?: number;   // total day P/L
  isClose?: boolean;
  audios?: Record<string, string>; // resolved imgUrl → resolved audioUrl
}

interface FullscreenViewerProps {
  days: DayData[];
  initialDayIndex: number;
  initialImageIndex: number;
  isOpen: boolean;
  onClose: () => void;
  initialLocked?: boolean;
  onUpdateDays?: (newDays: DayData[]) => void;
}

function downloadViaProxy(imageUrl: string) {
  // Use Flask server-side proxy — no CORS issues, always downloads as file
  const BASE_URL = (import.meta as any).env?.VITE_API_URL ?? '';
  const proxyUrl = `${BASE_URL}/api/proxy-download?url=${encodeURIComponent(imageUrl)}`;
  const a = document.createElement('a');
  a.href = proxyUrl;
  a.download = imageUrl.split('?')[0].split('/').pop() || 'image.jpg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function copyImageToClipboard(imageUrl: string) {
  try {
    // Use proxy to bypass CORS
    const BASE_URL = (import.meta as any).env?.VITE_API_URL ?? '';
    const proxyUrl = `${BASE_URL}/api/proxy-download?url=${encodeURIComponent(imageUrl)}`;
    const res = await fetch(proxyUrl, { credentials: 'include' });
    if (!res.ok) throw new Error('proxy failed');
    const blob = await res.blob();
    const imgBlob = new Blob([blob], { type: 'image/png' });
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': imgBlob })]);
  } catch {
    // Fallback: copy URL text
    try { await navigator.clipboard.writeText(imageUrl); } catch (_) {}
  }
}

export const FullscreenViewer: React.FC<FullscreenViewerProps> = ({ days, initialDayIndex, initialImageIndex, isOpen, onClose, initialLocked = false, onUpdateDays }) => {
  const [dayIdx, setDayIdx] = useState(initialDayIndex);
  const [imgIdx, setImgIdx] = useState(initialImageIndex);
  const [scale, setScale] = useState(1);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [uiVisible, setUiVisible] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showTradeDropdown, setShowTradeDropdown] = useState(false);
  const dateInputRef = React.useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle'|'uploading'|'done'|'error'>('idle');
  const [addStatus, setAddStatus] = useState<'idle'|'uploading'|'done'|'error'>('idle');
  // Ref that always points to the latest handleUploadReplace — used in paste listener
  const uploadReplaceRef = useRef<((file: File) => Promise<void>) | null>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const pinchStartScale = React.useRef(1);
  const pinchStartDist = React.useRef(0);

  // Favorites persisted in localStorage — keyed by current day date
  const currentDate = days[dayIdx]?.date || '';

  const dayItemIndices = React.useMemo(() => {
    const result: number[] = [];
    days.forEach((d, i) => { if (d.date === (days[dayIdx]?.date || '')) result.push(i); });
    return result;
  }, [days, dayIdx]);

  function getDayTradeLabel(pos: number, total: number, isClose?: boolean): string {
    if (isClose) return 'C';
    if (total === 1) return 'T1';
    if (pos === 0) return 'O';
    return `T${pos}`;
  }

  const [isFav, setIsFav] = useState(false);
  React.useEffect(() => {
    try {
      const favs = JSON.parse(localStorage.getItem('tj_favs') || '{}');
      setIsFav(!!favs[currentDate]);
    } catch { setIsFav(false); }
  }, [currentDate]);

  const toggleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const favs = JSON.parse(localStorage.getItem('tj_favs') || '{}');
      const next = { ...favs, [currentDate]: !isFav };
      localStorage.setItem('tj_favs', JSON.stringify(next));
    } catch {}
    setIsFav(f => !f);
  };

  // Convert absolute viewer URL → raw relative URL stored in trades.json
  const toRawUrl = (url: string): string => {
    if (!url) return '';
    if (url.startsWith('http')) {
      try { return new URL(url).pathname; } catch { return url; }
    }
    return url;
  };

  // Upload image + update trades backend + update local days state
  const doUploadAndSave = async (
    file: File,
    mode: 'replace' | 'addAfter',
    setStatus: (s: 'idle'|'uploading'|'done'|'error') => void
  ) => {
    if (!isOpen) return;
    const currentImg = days[dayIdx]?.images[imgIdx];
    if (!currentImg) return;
    setStatus('uploading');
    try {
      const BASE = (import.meta as any).env?.VITE_API_URL ?? '';
      // 1. Upload new file
      const fd = new FormData();
      fd.append('image', file);
      fd.append('original_filename', file.name || 'image.png');
      const upRes = await fetch(`${BASE}/api/upload-image`, { method: 'POST', body: fd, credentials: 'include' });
      if (!upRes.ok) throw new Error('upload failed');
      const { url: newRelUrl } = await upRes.json();
      if (!newRelUrl) throw new Error('no url');

      // 2. Fetch full raw trades payload
      const rawRes = await fetch(`${BASE}/api/trades`, { credentials: 'include' });
      if (!rawRes.ok) throw new Error('fetch failed');
      const rawData = await rawRes.json();

      // 3. Find and modify the owner trade / dayData
      const currentRaw = toRawUrl(currentImg);
      let done = false;
      const applyChange = (images: string[]) => {
        const i = images.findIndex(u => u === currentRaw || toRawUrl(u) === currentRaw);
        if (i < 0) return false;
        if (mode === 'replace') images.splice(i, 1, newRelUrl);
        else images.splice(i + 1, 0, newRelUrl);
        return true;
      };
      for (const t of (rawData.trades || [])) {
        if (done) break;
        if (Array.isArray(t.images)) done = applyChange(t.images);
      }
      if (!done) {
        for (const dd of Object.values(rawData.dayData || {})) {
          if (done) break;
          if (Array.isArray((dd as any).images)) done = applyChange((dd as any).images);
        }
      }

      // 4. Save back
      await fetch(`${BASE}/api/trades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(rawData),
      });

      // 5. Update local days state
      const newAbsUrl = newRelUrl.startsWith('http') ? newRelUrl : `${BASE}/${newRelUrl.replace(/^\//, '')}`;
      const newDays = days.map((d, di) => {
        if (di !== dayIdx) return d;
        const imgs = [...d.images];
        if (mode === 'replace') imgs.splice(imgIdx, 1, newAbsUrl);
        else imgs.splice(imgIdx + 1, 0, newAbsUrl);
        return { ...d, images: imgs };
      });
      onUpdateDays?.(newDays);
      if (mode === 'addAfter') setImgIdx(imgIdx + 1);

      setStatus('done');
      setTimeout(() => setStatus('idle'), 2500);
    } catch { setStatus('error'); setTimeout(() => setStatus('idle'), 2500); }
  };

  const handleUploadReplace = async (file: File) => doUploadAndSave(file, 'replace', setUploadStatus);
  const handleAddImageAfter = async (file: File) => doUploadAndSave(file, 'addAfter', setAddStatus);

  // Keep ref current so paste listener always has the latest version
  uploadReplaceRef.current = handleUploadReplace;
  const addAfterRef = useRef<((file: File) => Promise<void>) | null>(null);
  addAfterRef.current = handleAddImageAfter;

  // Lock/unlock handler (shared)
  const handleLockToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newLocked = !isLocked;
    setIsLocked(newLocked);
    if (newLocked) {
      const el = containerRef.current as any;
      const reqFS = el?.requestFullscreen || el?.webkitRequestFullscreen || el?.mozRequestFullScreen;
      if (reqFS) {
        reqFS.call(el).then(() => {
          try { (screen.orientation as any)?.lock?.('landscape'); } catch (_) {}
        }).catch(() => {
          try { (screen.orientation as any)?.lock?.('landscape'); } catch (_) {}
        });
      } else {
        try { (screen.orientation as any)?.lock?.('landscape'); } catch (_) {}
      }
    } else {
      try { (screen.orientation as any)?.unlock?.(); } catch (_) {}
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }
  };

  // Sync with props when opened
  React.useEffect(() => {
    if (isOpen) {
      setDayIdx(initialDayIndex);
      setImgIdx(initialImageIndex);
      setPan({ x: 0, y: 0 });
      setUiVisible(false);
      setShowNav(false);
      setShowComment(false);
      setShowMoreMenu(false);

      const initialImg = days[initialDayIndex]?.images[initialImageIndex];
      if (initialImg && (window as any)._gvCache && (window as any)._gvCache[initialImg]) {
        const cached = (window as any)._gvCache[initialImg];
        setScale(cached.scale);
        setPan(cached.pan);
      }

      if (initialLocked) {
        setIsLocked(true);
        const el = document.documentElement;
        const req = (el as any).requestFullscreen || (el as any).webkitRequestFullscreen;
        if (req) {
          req.call(el).then(() => {
            (screen.orientation as any).lock('landscape').catch(() => {});
          }).catch(() => {});
        }
      } else {
        setIsLocked(false);
      }
    }
  }, [isOpen, initialDayIndex, initialImageIndex, days]);

  // Keyboard navigation (desktop)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input, textarea')) return;
      switch (e.key) {
        case 'ArrowLeft':  e.preventDefault(); prevImg(); break;
        case 'ArrowRight': e.preventDefault(); nextImg(); break;
        case 'ArrowUp':    e.preventDefault(); prevDay(); break;
        case 'ArrowDown':  e.preventDefault(); nextDay(); break;
        case 'Escape':     e.preventDefault(); onClose(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, dayIdx, imgIdx, scale]);

  // Ctrl+V paste-to-replace — uses ref so always fresh, only re-registers when open state changes
  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept if user is typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file && addAfterRef.current) {
            addAfterRef.current(file);   // paste = add after current image
          }
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  const scaleRef = React.useRef(scale);
  React.useEffect(() => { scaleRef.current = scale; }, [scale]);

  // Pinch-to-zoom
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchStartDist.current = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        pinchStartScale.current = scaleRef.current;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const ratio = dist / (pinchStartDist.current || 1);
        const newScale = Math.min(5, Math.max(1, pinchStartScale.current * ratio));
        if (Math.abs(newScale - scaleRef.current) > 0.01) setScale(newScale);
      }
    };
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  if (!isOpen || !days.length) return null;

  const currentDay = days[dayIdx];
  const images = currentDay.images;

  const resetZoom = () => { setScale(1); setPan({ x: 0, y: 0 }); };

  const saveCurrentState = () => {
    const currentImg = images[imgIdx];
    if (!currentImg) return;
    if (!(window as any)._gvCache) (window as any)._gvCache = {};
    (window as any)._gvCache[currentImg] = { scale, pan };
  };

  const restoreState = (dIdx: number, iIdx: number) => {
    const nextImgUrl = days[dIdx]?.images[iIdx];
    const cached = (window as any)._gvCache ? (window as any)._gvCache[nextImgUrl] : null;
    if (cached) { setScale(cached.scale); setPan(cached.pan); }
    else setPan({ x: 0, y: 0 });
  };

  const nextItem = () => {
    if (dayIdx < days.length - 1) { saveCurrentState(); restoreState(dayIdx + 1, 0); setDayIdx(dayIdx + 1); setImgIdx(0); }
  };
  const prevItem = () => {
    if (dayIdx > 0) {
      saveCurrentState();
      const lastIdx = Math.max(0, (days[dayIdx - 1]?.images.length ?? 1) - 1);
      restoreState(dayIdx - 1, lastIdx); setDayIdx(dayIdx - 1); setImgIdx(lastIdx);
    }
  };
  const nextImg = () => {
    if (imgIdx < images.length - 1) { saveCurrentState(); setImgIdx(prev => { restoreState(dayIdx, prev + 1); return prev + 1; }); }
    else nextItem();
  };
  const prevImg = () => {
    if (imgIdx > 0) { saveCurrentState(); setImgIdx(prev => { restoreState(dayIdx, prev - 1); return prev - 1; }); }
    else prevItem();
  };
  const nextDay = () => {
    const currentDateVal = days[dayIdx].date;
    let nextIdx = dayIdx + 1;
    while (nextIdx < days.length && days[nextIdx].date === currentDateVal) nextIdx++;
    if (nextIdx < days.length) { saveCurrentState(); restoreState(nextIdx, 0); setDayIdx(nextIdx); setImgIdx(0); }
  };
  const prevDay = () => {
    const currentDateVal = days[dayIdx].date;
    let prevIdx = dayIdx - 1;
    while (prevIdx >= 0 && days[prevIdx].date === currentDateVal) prevIdx--;
    if (prevIdx >= 0) { saveCurrentState(); restoreState(prevIdx, 0); setDayIdx(prevIdx); setImgIdx(0); }
  };
  const jumpToDate = (selectedDate: string) => {
    const foundIdx = days.findIndex(d => d.date === selectedDate);
    if (foundIdx !== -1) { saveCurrentState(); restoreState(foundIdx, 0); setDayIdx(foundIdx); setImgIdx(0); }
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      return `${weekday} ${month} ${date.getDate()}`;
    } catch { return dateStr; }
  };

  const tradePnl = currentDay.pnl;
  const dayPnl = currentDay.dayPnl;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black flex flex-col font-sans text-white overflow-hidden touch-none"
        ref={containerRef}
        onClick={() => { if (showMoreMenu) setShowMoreMenu(false); if (showTradeDropdown) setShowTradeDropdown(false); }}
      >
        {/* Header */}
        <motion.div
          animate={{ y: (uiVisible || isLocked) ? 0 : -20, opacity: (uiVisible || isLocked) ? 1 : 0 }}
          transition={{ duration: 0.2, ease: "linear" }}
          className="absolute top-0 left-0 right-0 z-[110] flex items-center justify-between px-4 pt-3 pb-4"
        >
            {/* Left: spacer */}
          <div className="min-w-[60px]" />

          {/* Center: Day total · Trade badge · Date button */}
          <div className="flex items-center gap-1.5">
            {/* Day total */}
            {dayPnl !== undefined && dayPnl !== 0 && (
              <span className={`text-xs font-black px-2 py-1 rounded-lg backdrop-blur-md border shadow-md ${
                dayPnl >= 0 ? 'bg-emerald-500/80 border-emerald-400/30 text-white' : 'bg-rose-500/80 border-rose-400/30 text-white'
              }`}>
                {fmt(dayPnl)}
              </span>
            )}
            {/* Trade label + PnL badge — tap to open dropdown of all day trades */}
            {(() => {
              const pos = dayItemIndices.indexOf(dayIdx);
              const label = getDayTradeLabel(pos >= 0 ? pos : 0, dayItemIndices.length, currentDay.isClose);
              const pnlColor = tradePnl !== undefined ? (tradePnl >= 0 ? '#4ade80' : '#f87171') : 'white';
              const pnlTxt = tradePnl !== undefined ? ` · ${tradePnl >= 0 ? '+' : '-'}${fmt(tradePnl ?? 0)}` : '';
              return (
                <div className="relative">
                  <button
                    className="text-[11px] font-black px-2 py-1 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 shadow-md active:scale-95 transition-transform flex items-center gap-1"
                    style={{ color: pnlColor }}
                    onClick={(e) => { e.stopPropagation(); setShowTradeDropdown(d => !d); }}
                  >
                    {label}{pnlTxt}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                  <AnimatePresence>
                    {showTradeDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.95 }}
                        transition={{ duration: 0.12 }}
                        className="absolute top-full left-0 mt-1.5 bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl z-[200] overflow-hidden min-w-[140px]"
                        onClick={e => e.stopPropagation()}
                      >
                        {dayItemIndices.map((dIdx, pos) => {
                          const d = days[dIdx];
                          const lbl = getDayTradeLabel(pos, dayItemIndices.length, d.isClose);
                          const p = d.pnl;
                          const isActive = dIdx === dayIdx;
                          return (
                            <button
                              key={dIdx}
                              className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold transition-colors text-left ${isActive ? 'bg-white/15' : 'hover:bg-white/10'}`}
                              onClick={() => {
                                setShowTradeDropdown(false);
                                if (dIdx === dayIdx) return;
                                saveCurrentState(); restoreState(dIdx, 0); setDayIdx(dIdx); setImgIdx(0);
                              }}
                            >
                              <span className="text-white">{lbl}</span>
                              {p !== undefined && p !== 0 && (
                                <span style={{ color: p >= 0 ? '#4ade80' : '#f87171' }}>
                                  {p >= 0 ? '+' : '-'}{fmt(p)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })()}
            {/* Date button — click to open date picker */}
            <button
              className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all px-2.5 py-1.5 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 shadow-md"
              onClick={(e) => { e.stopPropagation(); dateInputRef.current?.showPicker?.(); }}
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>{formatDateLabel(currentDay.date)}</span>
              <span className="text-white/30">·</span>
              <span>{imgIdx + 1}/{images.length}</span>
            </button>
            <input
              type="date"
              ref={dateInputRef}
              className="absolute opacity-0 pointer-events-none w-0 h-0"
              onChange={(e) => { if (e.target.value) jumpToDate(e.target.value); }}
              value={currentDay.date}
              min={days.length > 0 ? days.reduce((a, b) => a.date < b.date ? a : b).date : undefined}
              max={days.length > 0 ? days.reduce((a, b) => a.date > b.date ? a : b).date : undefined}
            />
          </div>

          {/* Right: Lock button (header — visible in non-locked mode when header shown) */}
          {!isLocked && (
            <button
              onClick={handleLockToggle}
              className="p-2 rounded-full transition-colors bg-transparent"
            >
              <Unlock className="w-6 h-6 text-white/50" />
            </button>
          )}
          {isLocked && <div className="min-w-[44px]" />}
        </motion.div>

        {/* Main Image */}
        <motion.div
          className="flex-1 relative flex items-center justify-center p-2 touch-none"
          drag={scale === 1 ? true : false}
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.15}
          onDrag={(e, info) => { setDragX(info.offset.x); setDragY(info.offset.y); }}
          onDragEnd={(e, info) => {
            if (scale > 1) return;
            const tx = info.offset.x, ty = info.offset.y;
            if (Math.abs(tx) > Math.abs(ty)) {
              if (tx > 50) prevImg(); else if (tx < -50) nextImg();
            } else {
              if (ty > 60) prevDay(); else if (ty < -60) nextDay();
            }
            setDragX(0); setDragY(0);
          }}
          style={{ x: dragX, y: dragY }}
          onClick={(e) => {
            const now = Date.now();
            if ((window as any)._lastTap && (now - (window as any)._lastTap < 300)) {
              // Double tap → zoom toggle
              setScale(scale > 1 ? 1 : 3);
              setPan({ x: 0, y: 0 });
              (window as any)._lastTap = 0;
            } else {
              // Single tap → toggle UI
              if (!isLocked) setUiVisible(v => !v);
              (window as any)._lastTap = now;
            }
          }}
        >
          <motion.img
            ref={imgRef}
            src={images[imgIdx]}
            animate={{ scale, x: scale > 1 ? pan.x : 0, y: scale > 1 ? pan.y : 0 }}
            transition={{ duration: 0, ease: 'linear' }}
            drag={scale > 1}
            dragMomentum={false}
            onDrag={(e, info) => {
              if (scale > 1) {
                const bX = (scale - 1) * 150, bY = (scale - 1) * 250;
                setPan({
                  x: Math.max(-bX, Math.min(bX, pan.x + info.delta.x)),
                  y: Math.max(-bY, Math.min(bY, pan.y + info.delta.y))
                });
              }
            }}
            className="max-w-full max-h-[85vh] object-contain rounded-sm"
            draggable={false}
          />

          {/* Audio player — shown when current image has audio attached */}
          {currentDay.audios?.[images[imgIdx]] && (
            <div
              className="absolute bottom-12 left-4 right-4 z-20"
              onClick={e => e.stopPropagation()}
            >
              <AudioPlayer
                key={currentDay.audios[images[imgIdx]]}
                audioUrl={currentDay.audios[images[imgIdx]]}
              />
            </div>
          )}

          {/* Sub-image dot indicators */}
          <motion.div
            animate={{ opacity: isLocked ? 0 : 1 }}
            className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 px-4 pointer-events-none"
          >
            {images.map((_, i) => (
              <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === imgIdx ? 'w-6 bg-white' : 'w-2 bg-white/30'}`} />
            ))}
          </motion.div>
        </motion.div>

        {/* Nav controls — shown in locked mode OR when Nav button toggled */}
        <AnimatePresence>
          {(isLocked || showNav) && (
            <>
              {/* Right-side column — Lock, Heart, 3-dots (locked mode only) */}
              {isLocked && <motion.div
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="absolute right-3 top-4 flex flex-col items-center gap-3 z-[140]"
              >
                {/* Lock */}
                <button onClick={handleLockToggle}
                  className={`p-2 rounded-full transition-colors ${isLocked ? 'bg-indigo-600/80' : 'bg-transparent'}`}>
                  {isLocked ? <Lock className="w-6 h-6 text-white" /> : <Unlock className="w-6 h-6 text-white/50" />}
                </button>
                {/* Heart */}
                <button onClick={toggleFav} className="p-2 rounded-full bg-black/30 transition-transform active:scale-90">
                  <Heart className={`w-6 h-6 ${isFav ? 'text-rose-500 fill-rose-500' : 'text-white/60'}`} />
                </button>
                {/* 3-dots */}
                <div className="relative">
                  <button onClick={e => { e.stopPropagation(); setShowMoreMenu(m => !m); }}
                    className="p-2 rounded-full bg-black/30 transition-transform active:scale-90">
                    <MoreVertical className="w-6 h-6 text-white/60" />
                  </button>
                  {/* More menu popup */}
                  <AnimatePresence>
                    {showMoreMenu && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute right-full top-0 mr-2 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl w-44 z-30 max-h-[60vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                      >
                        {[
                          { icon: <Download className="w-4 h-4 text-sky-400" />, label: 'Download Image', action: 'download' },
                          { icon: <Upload className="w-4 h-4 text-emerald-400" />, label: uploadStatus === 'uploading' ? 'Uploading…' : uploadStatus === 'done' ? 'Replaced ✓' : uploadStatus === 'error' ? 'Replace failed' : 'Upload & Replace', action: 'upload' },
                          { icon: <ImagePlus className="w-4 h-4 text-violet-400" />, label: addStatus === 'uploading' ? 'Uploading…' : addStatus === 'done' ? 'Added ✓' : addStatus === 'error' ? 'Add failed' : 'Add Image After', action: 'add' },
                          { icon: <Copy className="w-4 h-4 text-sky-300" />, label: 'Copy Image', action: 'copy' },
                          { icon: <Share2 className="w-4 h-4" />, label: 'Share link', action: '' },
                          { icon: <Flag className="w-4 h-4" />, label: 'Mark for review', action: '' },
                          { icon: <Trash2 className="w-4 h-4 text-rose-400" />, label: 'Delete Image', danger: true, action: '' },
                        ].map(item => (
                          <button
                            key={item.label}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 transition-colors text-left ${(item as any).danger ? 'text-rose-400' : 'text-white'}`}
                            onClick={() => {
                              if (item.action === 'download') { downloadViaProxy(images[imgIdx]); setShowMoreMenu(false); }
                              else if (item.action === 'upload') { uploadInputRef.current?.click(); setShowMoreMenu(false); }
                              else if (item.action === 'add') { addInputRef.current?.click(); setShowMoreMenu(false); }
                              else if (item.action === 'copy') { copyImageToClipboard(images[imgIdx]); setShowMoreMenu(false); }
                              else setShowMoreMenu(false);
                            }}
                          >
                            {item.icon}
                            {item.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>}

              {/* Left side: vertical zoom slider */}
              <motion.div
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-[140] flex flex-col items-center gap-2"
                onClick={e => e.stopPropagation()}
              >
                <span className="text-[10px] font-black text-white/70 bg-black/40 px-1.5 py-0.5 rounded-full">{scale.toFixed(1)}x</span>
                <div style={{ position: 'relative', width: '28px', height: '150px' }}>
                  <input
                    type="range" min="1" max="5" step="0.01" value={scale}
                    onChange={e => { const v = parseFloat(e.target.value); setScale(v); if (v === 1) setPan({ x: 0, y: 0 }); }}
                    style={{
                      position: 'absolute',
                      width: '150px', height: '28px',
                      left: '-61px', top: '61px',
                      transform: 'rotate(-90deg)',
                      transformOrigin: 'center center',
                      cursor: 'pointer',
                      accentColor: 'white',
                      background: 'transparent',
                    }}
                    className="appearance-none"
                  />
                </div>
              </motion.div>

              {/* Bottom nav row: ↑ ← → ↓ */}
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-4 left-14 right-14 flex items-center justify-between gap-2 px-4 z-[140]"
              >
                <button onClick={e => { e.stopPropagation(); prevDay(); }}
                  className="w-11 h-11 rounded-full bg-black/55 backdrop-blur-md border border-white/25 flex items-center justify-center active:scale-90 transition-transform shadow-xl">
                  <span className="text-base font-bold text-white">↑</span>
                </button>
                <button onClick={e => { e.stopPropagation(); prevImg(); }}
                  className="w-11 h-11 rounded-full bg-black/55 backdrop-blur-md border border-white/20 flex items-center justify-center active:scale-90 transition-transform shadow-xl">
                  <span className="text-xl text-white">←</span>
                </button>
                <button onClick={e => { e.stopPropagation(); nextImg(); }}
                  className="w-11 h-11 rounded-full bg-black/55 backdrop-blur-md border border-white/20 flex items-center justify-center active:scale-90 transition-transform shadow-xl">
                  <span className="text-xl text-white">→</span>
                </button>
                <button onClick={e => { e.stopPropagation(); nextDay(); }}
                  className="w-11 h-11 rounded-full bg-black/55 backdrop-blur-md border border-white/25 flex items-center justify-center active:scale-90 transition-transform shadow-xl">
                  <span className="text-base font-bold text-white">↓</span>
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Sidebar Actions — shown when uiVisible and NOT locked */}
        <motion.div
          animate={{ x: (uiVisible && !isLocked) ? 0 : 20, opacity: (uiVisible && !isLocked) ? 1 : 0 }}
          transition={{ duration: 0.2, ease: "linear" }}
          className="absolute right-2 bottom-32 flex flex-col items-center gap-5 z-20"
        >
          <button className="flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <Heart className="w-7 h-7 text-rose-500 fill-rose-500 mb-0.5" />
            <span className="text-[10px] font-bold">Liked</span>
          </button>
          <button
            className="flex flex-col items-center"
            onClick={(e) => { e.stopPropagation(); setShowComment(c => !c); }}
          >
            <MessageCircle className="w-7 h-7 mb-0.5" />
            <span className="text-[10px] font-bold">Comment</span>
          </button>
          <button className="flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <Share2 className="w-7 h-7 mb-0.5" />
            <span className="text-[10px] font-bold">Share</span>
          </button>
          {/* Nav toggle button */}
          <button
            className={`flex flex-col items-center transition-colors ${showNav ? 'text-indigo-400' : ''}`}
            onClick={(e) => { e.stopPropagation(); setShowNav(n => !n); }}
          >
            <Move className="w-7 h-7 mb-0.5" />
            <span className="text-[10px] font-bold">Nav</span>
          </button>

          {/* 3-dots button (non-locked mode) */}
          <div className="relative">
            <button
              className="flex flex-col items-center"
              onClick={(e) => { e.stopPropagation(); setShowMoreMenu(m => !m); }}
            >
              <MoreVertical className="w-7 h-7 mb-0.5" />
              <span className="text-[10px] font-bold">More</span>
            </button>
            {/* More menu popup */}
            <AnimatePresence>
              {showMoreMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, x: 0 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute right-full top-0 mr-2 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl w-44 z-30 max-h-[60vh] overflow-y-auto"
                  onClick={e => e.stopPropagation()}
                >
                  {[
                    { icon: <Download className="w-4 h-4 text-sky-400" />, label: 'Download Image', action: 'download' },
                    { icon: <Upload className="w-4 h-4 text-emerald-400" />, label: uploadStatus === 'uploading' ? 'Uploading…' : uploadStatus === 'done' ? 'Replaced ✓' : uploadStatus === 'error' ? 'Replace failed' : 'Upload & Replace', action: 'upload' },
                    { icon: <ImagePlus className="w-4 h-4 text-violet-400" />, label: addStatus === 'uploading' ? 'Uploading…' : addStatus === 'done' ? 'Added ✓' : addStatus === 'error' ? 'Add failed' : 'Add Image After', action: 'add' },
                    { icon: <Copy className="w-4 h-4 text-sky-300" />, label: 'Copy Image', action: 'copy' },
                    { icon: <Share2 className="w-4 h-4" />, label: 'Share link', action: '' },
                    { icon: <Flag className="w-4 h-4" />, label: 'Mark for review', action: '' },
                    { icon: <Trash2 className="w-4 h-4 text-rose-400" />, label: 'Delete Image', danger: true, action: '' },
                  ].map(item => (
                    <button
                      key={item.label}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/10 transition-colors text-left ${(item as any).danger ? 'text-rose-400' : 'text-white'}`}
                      onClick={() => {
                        if (item.action === 'download') { downloadViaProxy(images[imgIdx]); setShowMoreMenu(false); }
                        else if (item.action === 'upload') { uploadInputRef.current?.click(); setShowMoreMenu(false); }
                        else if (item.action === 'add') { addInputRef.current?.click(); setShowMoreMenu(false); }
                        else if (item.action === 'copy') { copyImageToClipboard(images[imgIdx]); setShowMoreMenu(false); }
                        else setShowMoreMenu(false);
                      }}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Bottom Info — shown when uiVisible */}
        <motion.div
          animate={{ y: (uiVisible && !isLocked) ? 0 : 20, opacity: (uiVisible && !isLocked) ? 1 : 0 }}
          transition={{ duration: 0.2, ease: "linear" }}
          className="px-4 pb-5 pt-3 z-10"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs flex-shrink-0">TJ</div>
            <span className="font-bold text-sm">trading_journal</span>
            <span className="bg-white/10 px-2 py-0.5 rounded text-[9px] font-medium text-zinc-300">
              {imgIdx + 1} / {images.length}
            </span>
            {tradePnl !== undefined && (
              <span className={`ml-auto text-sm font-bold ${tradePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {fmt(tradePnl)}
              </span>
            )}
          </div>
          <p className="text-xs text-white/70 mb-3">
            Day {dayIdx + 1} • {currentDay.date} Journal Update
          </p>

          {/* Comment box — only when showComment */}
          <AnimatePresence>
            {showComment && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="bg-white/10 rounded-full px-4 py-2 flex items-center gap-3 border border-white/10"
              >
                <span className="text-lg">📈</span>
                <input
                  type="text"
                  placeholder="Add comment..."
                  className="bg-transparent border-none text-xs outline-none flex-1 text-white placeholder-white/40"
                  autoFocus
                  onClick={e => e.stopPropagation()}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      {/* Hidden upload inputs */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadReplace(f); e.target.value = ''; }}
      />
      <input
        ref={addInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleAddImageAfter(f); e.target.value = ''; }}
      />
      </motion.div>
    </AnimatePresence>
  );
};
