import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle, Send, Lock, Unlock, Calendar, MoreVertical, ChevronDown, Move, Tag } from 'lucide-react';
import { MoreMenu } from './FullscreenMoreMenu';
import { TagSheet } from './TagSheet';
import { fmt, isVideoUrl, downloadViaProxy, copyImageToClipboard } from './FullscreenViewerUtils';
import { doUploadAndSave } from './FullscreenViewerUpload';
export type { DayData, FullscreenViewerProps } from './FullscreenViewerUtils';
import type { DayData, FullscreenViewerProps } from './FullscreenViewerUtils';

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
  const [showTagSheet, setShowTagSheet] = useState(false);
  const dateInputRef = React.useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle'|'uploading'|'done'|'error'>('idle');
  const [addStatus, setAddStatus] = useState<'idle'|'uploading'|'done'|'error'>('idle');
  const uploadReplaceRef = useRef<((file: File) => Promise<void>) | null>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const pinchStartScale = React.useRef(1);
  const pinchStartDist = React.useRef(0);

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
      localStorage.setItem('tj_favs', JSON.stringify({ ...favs, [currentDate]: !isFav }));
    } catch {}
    setIsFav(f => !f);
  };

  const handleUploadReplace = (file: File) => doUploadAndSave({ file, mode: 'replace', dayIdx, imgIdx, days, isOpen, onUpdateDays, onSetImgIdx: setImgIdx, setStatus: setUploadStatus });
  const handleAddImageAfter = (file: File) => doUploadAndSave({ file, mode: 'addAfter', dayIdx, imgIdx, days, isOpen, onUpdateDays, onSetImgIdx: setImgIdx, setStatus: setAddStatus });
  uploadReplaceRef.current = handleUploadReplace;
  const addAfterRef = useRef<((file: File) => Promise<void>) | null>(null);
  addAfterRef.current = handleAddImageAfter;

  const handleLockToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newLocked = !isLocked;
    setIsLocked(newLocked);
    if (newLocked) {
      const el = containerRef.current as any;
      const reqFS = el?.requestFullscreen || el?.webkitRequestFullscreen || el?.mozRequestFullScreen;
      if (reqFS) { reqFS.call(el).then(() => { try { (screen.orientation as any)?.lock?.('landscape'); } catch (_) {} }).catch(() => { try { (screen.orientation as any)?.lock?.('landscape'); } catch (_) {} }); }
      else { try { (screen.orientation as any)?.lock?.('landscape'); } catch (_) {} }
    } else {
      try { (screen.orientation as any)?.unlock?.(); } catch (_) {}
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      setDayIdx(initialDayIndex);
      setImgIdx(initialImageIndex);
      setPan({ x: 0, y: 0 });
      setUiVisible(false);
      setShowNav(false);
      setShowComment(false);
      setShowMoreMenu(false);
      setShowTagSheet(false);

      const initialImg = days[initialDayIndex]?.images[initialImageIndex];
      if (initialImg && (window as any)._gvCache?.[initialImg]) {
        const cached = (window as any)._gvCache[initialImg];
        setScale(cached.scale);
        setPan(cached.pan);
      }

      if (initialLocked) {
        setIsLocked(true);
        const el = document.documentElement;
        const req = (el as any).requestFullscreen || (el as any).webkitRequestFullscreen;
        if (req) { req.call(el).then(() => { (screen.orientation as any).lock('landscape').catch(() => {}); }).catch(() => {}); }
      } else { setIsLocked(false); }
    }
  }, [isOpen, initialDayIndex, initialImageIndex, days]);

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

  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = (e: ClipboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file && addAfterRef.current) addAfterRef.current(file);
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  const scaleRef = React.useRef(scale);
  React.useEffect(() => { scaleRef.current = scale; }, [scale]);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchStartDist.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        pinchStartScale.current = scaleRef.current;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        const newScale = Math.min(5, Math.max(1, pinchStartScale.current * (dist / (pinchStartDist.current || 1))));
        if (Math.abs(newScale - scaleRef.current) > 0.01) setScale(newScale);
      }
    };
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => { el.removeEventListener('touchstart', onTouchStart); el.removeEventListener('touchmove', onTouchMove); };
  }, []);

  if (!isOpen || !days.length) return null;

  const currentDay = days[dayIdx];
  const images = currentDay.images;
  const currentIsVideo = isVideoUrl(images[imgIdx] || '');

  const resetZoom = () => { setScale(1); setPan({ x: 0, y: 0 }); };
  const saveCurrentState = () => {
    const currentImg = images[imgIdx];
    if (!currentImg) return;
    if (!(window as any)._gvCache) (window as any)._gvCache = {};
    (window as any)._gvCache[currentImg] = { scale, pan };
  };
  const restoreState = (dIdx: number, iIdx: number) => {
    const nextImgUrl = days[dIdx]?.images[iIdx];
    const cached = (window as any)._gvCache?.[nextImgUrl];
    if (cached) { setScale(cached.scale); setPan(cached.pan); }
    else setPan({ x: 0, y: 0 });
  };

  const nextItem = () => { if (dayIdx < days.length - 1) { saveCurrentState(); restoreState(dayIdx + 1, 0); setDayIdx(dayIdx + 1); setImgIdx(0); } };
  const prevItem = () => { if (dayIdx > 0) { saveCurrentState(); const lastIdx = Math.max(0, (days[dayIdx - 1]?.images.length ?? 1) - 1); restoreState(dayIdx - 1, lastIdx); setDayIdx(dayIdx - 1); setImgIdx(lastIdx); } };
  const nextImg = () => { if (imgIdx < images.length - 1) { saveCurrentState(); setImgIdx(prev => { restoreState(dayIdx, prev + 1); return prev + 1; }); } else nextItem(); };
  const prevImg = () => { if (imgIdx > 0) { saveCurrentState(); setImgIdx(prev => { restoreState(dayIdx, prev - 1); return prev - 1; }); } else prevItem(); };
  const nextDay = () => { const cur = days[dayIdx].date; let i = dayIdx + 1; while (i < days.length && days[i].date === cur) i++; if (i < days.length) { saveCurrentState(); restoreState(i, 0); setDayIdx(i); setImgIdx(0); } };
  const prevDay = () => { const cur = days[dayIdx].date; let i = dayIdx - 1; while (i >= 0 && days[i].date === cur) i--; if (i >= 0) { saveCurrentState(); restoreState(i, 0); setDayIdx(i); setImgIdx(0); } };
  const jumpToDate = (selectedDate: string) => { const foundIdx = days.findIndex(d => d.date === selectedDate); if (foundIdx !== -1) { saveCurrentState(); restoreState(foundIdx, 0); setDayIdx(foundIdx); setImgIdx(0); } };

  const formatDateLabel = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return `${date.toLocaleDateString('en-US', { weekday: 'short' })} ${date.toLocaleDateString('en-US', { month: 'short' })} ${date.getDate()}`;
    } catch { return dateStr; }
  };

  const tradePnl = currentDay.pnl;
  const dayPnl = currentDay.dayPnl;

  const moreMenuActions = {
    onDownload: () => { downloadViaProxy(images[imgIdx]); },
    onUpload:   () => { uploadInputRef.current?.click(); },
    onAddAfter: () => { addInputRef.current?.click(); },
    onCopy:     () => { copyImageToClipboard(images[imgIdx]); },
    onClose:    () => setShowMoreMenu(false),
  };

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
        {/* Trade Pill — always visible, auto-updates as you swipe */}
        {(() => {
          const pos = dayItemIndices.indexOf(dayIdx);
          const label = getDayTradeLabel(pos >= 0 ? pos : 0, dayItemIndices.length, currentDay.isClose);
          const pnlColor = tradePnl !== undefined ? (tradePnl >= 0 ? '#4ade80' : '#f87171') : 'white';
          const pnlTxt = tradePnl !== undefined ? ` · ${tradePnl >= 0 ? '+' : '-'}${fmt(tradePnl ?? 0)}` : '';
          return (
            <div className="absolute top-3 left-0 right-0 z-[110] flex items-center justify-center pointer-events-none">
              <div className="relative pointer-events-auto flex items-center gap-1.5">
                {dayPnl !== undefined && dayPnl !== 0 && (
                  <span className={`text-xs font-black px-2 py-1 rounded-lg backdrop-blur-md border shadow-md ${dayPnl >= 0 ? 'bg-emerald-500/80 border-emerald-400/30 text-white' : 'bg-rose-500/80 border-rose-400/30 text-white'}`}>
                    {fmt(dayPnl)}
                  </span>
                )}
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
                        return (
                          <button
                            key={dIdx}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold transition-colors text-left ${dIdx === dayIdx ? 'bg-white/15' : 'hover:bg-white/10'}`}
                            onClick={() => { setShowTradeDropdown(false); if (dIdx === dayIdx) return; saveCurrentState(); restoreState(dIdx, 0); setDayIdx(dIdx); setImgIdx(0); }}
                          >
                            <span className="text-white">{lbl}</span>
                            {p !== undefined && p !== 0 && <span style={{ color: p >= 0 ? '#4ade80' : '#f87171' }}>{p >= 0 ? '+' : '-'}{fmt(p)}</span>}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })()}

        {/* Header (date + lock) — tap to show/hide */}
        <motion.div
          animate={{ y: (uiVisible || isLocked) ? 0 : -20, opacity: (uiVisible || isLocked) ? 1 : 0 }}
          transition={{ duration: 0.2, ease: 'linear' }}
          className="absolute top-0 left-0 right-0 z-[109] flex items-center justify-between px-4 pt-3 pb-4"
        >
          <div className="min-w-[60px]" />
          <div className="flex items-center gap-1.5">
            <button
              className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all px-2.5 py-1.5 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 shadow-md"
              onClick={(e) => { e.stopPropagation(); dateInputRef.current?.showPicker?.(); }}
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>{formatDateLabel(currentDay.date)}</span>
              <span className="text-white/30">·</span>
              <span>{imgIdx + 1}/{images.length}</span>
            </button>
            <input type="date" ref={dateInputRef} className="absolute opacity-0 pointer-events-none w-0 h-0" onChange={(e) => { if (e.target.value) jumpToDate(e.target.value); }} value={currentDay.date}
              min={days.length > 0 ? days.reduce((a, b) => a.date < b.date ? a : b).date : undefined}
              max={days.length > 0 ? days.reduce((a, b) => a.date > b.date ? a : b).date : undefined}
            />
          </div>
          {!isLocked && (
            <button onClick={handleLockToggle} className="p-2 rounded-full transition-colors bg-transparent">
              <Unlock className="w-6 h-6 text-white/50" />
            </button>
          )}
          {isLocked && <div className="min-w-[44px]" />}
        </motion.div>

        {/* Main Image */}
        <motion.div
          className="flex-1 relative flex items-center justify-center p-2 touch-none"
          drag={scale === 1 && !currentIsVideo ? true : false}
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.15}
          onDrag={(_, info) => { setDragX(info.offset.x); setDragY(info.offset.y); }}
          onDragEnd={(_, info) => {
            if (scale > 1) return;
            const tx = info.offset.x, ty = info.offset.y;
            if (Math.abs(tx) > Math.abs(ty)) { if (tx > 50) prevImg(); else if (tx < -50) nextImg(); }
            else { if (ty > 60) prevDay(); else if (ty < -60) nextDay(); }
            setDragX(0); setDragY(0);
          }}
          style={{ x: dragX, y: dragY }}
          onClick={(e) => {
            const now = Date.now();
            if ((window as any)._lastTap && (now - (window as any)._lastTap < 300)) {
              setScale(scale > 1 ? 1 : 3); setPan({ x: 0, y: 0 }); (window as any)._lastTap = 0;
            } else {
              if (!isLocked) setUiVisible(v => !v); (window as any)._lastTap = now;
            }
          }}
        >
          {currentIsVideo ? (
            <video key={images[imgIdx]} src={images[imgIdx]} controls playsInline preload="metadata"
              className="w-full rounded-sm bg-black" style={{ maxHeight: '78vh', objectFit: 'contain' }}
              onLoadedMetadata={e => { (e.target as HTMLVideoElement).currentTime = 0.1; }}
              onClick={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} />
          ) : (
            <motion.img ref={imgRef} src={images[imgIdx]}
              animate={{ scale, x: scale > 1 ? pan.x : 0, y: scale > 1 ? pan.y : 0 }}
              transition={{ duration: 0, ease: 'linear' }}
              drag={scale > 1} dragMomentum={false}
              onDrag={(_, info) => { if (scale > 1) { const bX = (scale - 1) * 150, bY = (scale - 1) * 250; setPan({ x: Math.max(-bX, Math.min(bX, pan.x + info.delta.x)), y: Math.max(-bY, Math.min(bY, pan.y + info.delta.y)) }); } }}
              className="max-w-full max-h-[85vh] object-contain rounded-sm" draggable={false}
            />
          )}


          <motion.div animate={{ opacity: isLocked ? 0 : 1 }} className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 px-4 pointer-events-none">
            {images.map((url, i) => (
              isVideoUrl(url)
                ? <div key={i} className={`h-2 w-2 rounded-full transition-all duration-300 flex items-center justify-center text-[8px] ${i === imgIdx ? 'bg-violet-400' : 'bg-violet-400/30'}`}>▶</div>
                : <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === imgIdx ? 'w-6 bg-white' : 'w-2 bg-white/30'}`} />
            ))}
          </motion.div>
        </motion.div>

        {/* Nav controls — locked mode OR nav toggled */}
        <AnimatePresence>
          {(isLocked || showNav) && (
            <>
              {isLocked && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  className="absolute right-3 top-4 flex flex-col items-center gap-3 z-[140]"
                >
                  <button onClick={handleLockToggle} className={`p-2 rounded-full transition-colors ${isLocked ? 'bg-indigo-600/80' : 'bg-transparent'}`}>
                    {isLocked ? <Lock className="w-6 h-6 text-white" /> : <Unlock className="w-6 h-6 text-white/50" />}
                  </button>
                  <button onClick={toggleFav} className="p-2 rounded-full bg-black/30 transition-transform active:scale-90">
                    <Heart className={`w-6 h-6 ${isFav ? 'text-rose-500 fill-rose-500' : 'text-white/60'}`} />
                  </button>
                  <div className="relative">
                    <button onClick={e => { e.stopPropagation(); setShowMoreMenu(m => !m); }} className="p-2 rounded-full bg-black/30 transition-transform active:scale-90">
                      <MoreVertical className="w-6 h-6 text-white/60" />
                    </button>
                    <MoreMenu show={showMoreMenu} uploadStatus={uploadStatus} addStatus={addStatus} className="right-full top-0 mr-2" {...moreMenuActions} />
                  </div>
                </motion.div>
              )}

              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-[140] flex flex-col items-center gap-2"
                onClick={e => e.stopPropagation()}
              >
                <span className="text-[10px] font-black text-white/70 bg-black/40 px-1.5 py-0.5 rounded-full">{scale.toFixed(1)}x</span>
                <div style={{ position: 'relative', width: '28px', height: '150px' }}>
                  <input type="range" min="1" max="5" step="0.01" value={scale}
                    onChange={e => { const v = parseFloat(e.target.value); setScale(v); if (v === 1) setPan({ x: 0, y: 0 }); }}
                    style={{ position: 'absolute', width: '150px', height: '28px', left: '-61px', top: '61px', transform: 'rotate(-90deg)', transformOrigin: 'center center', cursor: 'pointer', accentColor: 'white', background: 'transparent' }}
                    className="appearance-none"
                  />
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-4 left-14 right-14 flex items-center justify-between gap-2 px-4 z-[140]"
              >
                {[{ fn: prevDay, label: '↑' }, { fn: prevImg, label: '←' }, { fn: nextImg, label: '→' }, { fn: nextDay, label: '↓' }].map(({ fn, label }) => (
                  <button key={label} onClick={e => { e.stopPropagation(); fn(); }} className="w-11 h-11 rounded-full bg-black/55 backdrop-blur-md border border-white/25 flex items-center justify-center active:scale-90 transition-transform shadow-xl">
                    <span className="text-xl text-white">{label}</span>
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Sidebar Actions — unlocked + uiVisible */}
        <motion.div
          animate={{ x: (uiVisible && !isLocked) ? 0 : 20, opacity: (uiVisible && !isLocked) ? 1 : 0 }}
          transition={{ duration: 0.2, ease: 'linear' }}
          className="absolute right-2 bottom-32 flex flex-col items-center gap-5 z-20"
        >
          <button className="flex flex-col items-center" onClick={toggleFav}>
            <Heart className={`w-7 h-7 mb-0.5 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
            <span className="text-[10px] font-bold">Like</span>
          </button>
          <button className="flex flex-col items-center" onClick={(e) => { e.stopPropagation(); setShowComment(c => !c); }}>
            <MessageCircle className="w-7 h-7 mb-0.5" />
            <span className="text-[10px] font-bold">Note</span>
          </button>
          <button className="flex flex-col items-center" onClick={(e) => { e.stopPropagation(); setShowTagSheet(true); }}>
            <Tag className="w-7 h-7 mb-0.5 text-indigo-400" />
            <span className="text-[10px] font-bold text-indigo-300">Tags</span>
          </button>
          <button className={`flex flex-col items-center transition-colors ${showNav ? 'text-indigo-400' : ''}`} onClick={(e) => { e.stopPropagation(); setShowNav(n => !n); }}>
            <Move className="w-7 h-7 mb-0.5" />
            <span className="text-[10px] font-bold">Nav</span>
          </button>
          <div className="relative">
            <button className="flex flex-col items-center" onClick={(e) => { e.stopPropagation(); setShowMoreMenu(m => !m); }}>
              <MoreVertical className="w-7 h-7 mb-0.5" />
              <span className="text-[10px] font-bold">More</span>
            </button>
            <MoreMenu show={showMoreMenu} uploadStatus={uploadStatus} addStatus={addStatus} className="right-full top-0 mr-2" {...moreMenuActions} />
          </div>
        </motion.div>

        {/* Bottom Info — note/pin + comment box */}
        <motion.div
          animate={{ y: (uiVisible && !isLocked) ? 0 : 20, opacity: (uiVisible && !isLocked) ? 1 : 0 }}
          transition={{ duration: 0.2, ease: 'linear' }}
          className="px-4 pb-5 pt-3 z-10"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs flex-shrink-0">TJ</div>
            <span className="font-bold text-sm">trading_journal</span>
            <span className="bg-white/10 px-2 py-0.5 rounded text-[9px] font-medium text-zinc-300">{imgIdx + 1} / {images.length}</span>
            {tradePnl !== undefined && <span className={`ml-auto text-sm font-bold ${tradePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(tradePnl)}</span>}
          </div>
          {currentDay.instrument && <p className="text-xs font-bold text-indigo-300 mb-1">{currentDay.instrument}</p>}
          {currentDay.note && <p className="text-xs text-white/60 mb-2 line-clamp-2">📌 {currentDay.note}</p>}
          {currentDay.tags && currentDay.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {currentDay.tags.slice(0, 5).map(t => <span key={t} className="text-[9px] bg-indigo-500/30 border border-indigo-400/30 px-1.5 py-0.5 rounded-full text-indigo-300">{t}</span>)}
            </div>
          )}
          <AnimatePresence>
            {showComment && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                className="bg-white/10 rounded-full px-4 py-2 flex items-center gap-3 border border-white/10"
              >
                <span className="text-lg">📈</span>
                <input type="text" placeholder="Add note..." className="bg-transparent border-none text-xs outline-none flex-1 text-white placeholder-white/40" autoFocus onClick={e => e.stopPropagation()} />
                <Send className="w-4 h-4 text-white/40" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <input ref={uploadInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadReplace(f); e.target.value = ''; }} />
        <input ref={addInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleAddImageAfter(f); e.target.value = ''; }} />

        {/* Tag Sheet */}
        {showTagSheet && (
          <TagSheet
            imageUrl={images[imgIdx] || ''}
            currentTags={currentDay.tags || []}
            currentNote={currentDay.note || ''}
            onSave={(newTags, newNote) => {
              const newDays = days.map((d, di) => di === dayIdx ? { ...d, tags: newTags, note: newNote } : d);
              onUpdateDays?.(newDays);
              setShowTagSheet(false);
            }}
            onClose={() => setShowTagSheet(false)}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};
