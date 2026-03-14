import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle, Send, Lock, Unlock, Calendar, MoreVertical, Share2, Copy, Flag, ChevronDown } from 'lucide-react';

interface DayData {
  date: string;
  images: string[];
  tradeNum?: number;
  pnl?: number;      // this trade's P/L
  dayPnl?: number;   // total day P/L
}

interface FullscreenViewerProps {
  days: DayData[];
  initialDayIndex: number;
  initialImageIndex: number;
  isOpen: boolean;
  onClose: () => void;
  initialLocked?: boolean;
}

export const FullscreenViewer: React.FC<FullscreenViewerProps> = ({ days, initialDayIndex, initialImageIndex, isOpen, onClose, initialLocked = false }) => {
  const [dayIdx, setDayIdx] = useState(initialDayIndex);
  const [imgIdx, setImgIdx] = useState(initialImageIndex);
  const [scale, setScale] = useState(1);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [uiVisible, setUiVisible] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const dateInputRef = React.useRef<HTMLInputElement>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const pinchStartScale = React.useRef(1);
  const pinchStartDist = React.useRef(0);

  // Sync with props when opened
  React.useEffect(() => {
    if (isOpen) {
      setDayIdx(initialDayIndex);
      setImgIdx(initialImageIndex);
      setPan({ x: 0, y: 0 });
      setUiVisible(false);
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
      // Don't intercept when typing in inputs
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
    if (dayIdx > 0) { saveCurrentState(); restoreState(dayIdx - 1, 0); setDayIdx(dayIdx - 1); setImgIdx(0); }
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
    const currentDate = days[dayIdx].date;
    let nextIdx = dayIdx + 1;
    while (nextIdx < days.length && days[nextIdx].date === currentDate) nextIdx++;
    if (nextIdx < days.length) { saveCurrentState(); restoreState(nextIdx, 0); setDayIdx(nextIdx); setImgIdx(0); }
  };
  const prevDay = () => {
    const currentDate = days[dayIdx].date;
    let prevIdx = dayIdx - 1;
    while (prevIdx >= 0 && days[prevIdx].date === currentDate) prevIdx--;
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
        onClick={() => { if (showMoreMenu) setShowMoreMenu(false); }}
      >
        {/* Header */}
        <motion.div
          animate={{ y: (uiVisible || isLocked) ? 0 : -20, opacity: (uiVisible || isLocked) ? 1 : 0 }}
          transition={{ duration: 0.2, ease: "linear" }}
          className="absolute top-0 left-0 right-0 z-[110] flex items-center justify-between px-4 pt-3 pb-4"
        >
          {/* Left: Day P/L */}
          <div className="min-w-[70px]">
            {dayPnl !== undefined && (
              <span className={`text-xs font-bold px-2 py-1 rounded-lg ${dayPnl >= 0 ? 'bg-emerald-500/80 text-white' : 'bg-rose-500/80 text-white'}`}>
                {dayPnl >= 0 ? '+' : ''}₹{Math.abs(dayPnl).toLocaleString()}
              </span>
            )}
          </div>

          {/* Center: Date picker */}
          <span className="relative text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 cursor-pointer hover:bg-white/10 active:scale-95 transition-all px-2.5 py-1.5 rounded-lg border border-white/10">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span>{formatDateLabel(currentDay.date)}</span>
            <span className="text-indigo-500">•</span>
            <span>T{(currentDay as any).tradeNum || (dayIdx + 1)}</span>
            <span className="text-indigo-500">•</span>
            <span>{imgIdx + 1}/{images.length}</span>
            {tradePnl !== undefined && (
              <>
                <span className="text-indigo-500">•</span>
                <span className={tradePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {tradePnl >= 0 ? '+' : ''}₹{Math.abs(tradePnl).toLocaleString()}
                </span>
              </>
            )}
            <input
              type="date"
              ref={dateInputRef}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
              onChange={(e) => { if (e.target.value) jumpToDate(e.target.value); }}
              onClick={(e) => e.stopPropagation()}
              value={currentDay.date}
              min={days.length > 0 ? days.reduce((a, b) => a.date < b.date ? a : b).date : undefined}
              max={days.length > 0 ? days.reduce((a, b) => a.date > b.date ? a : b).date : undefined}
            />
          </span>

          {/* Right: Lock button */}
          <button
            onClick={(e) => {
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
            }}
            className={`p-2 rounded-full transition-colors ${isLocked ? 'bg-indigo-600/80' : 'bg-transparent'}`}
          >
            {isLocked ? <Lock className="w-6 h-6 text-white" /> : <Unlock className="w-6 h-6 text-white/50" />}
          </button>
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
              setScale(scale > 1 ? 1 : 3);
              setPan({ x: 0, y: 0 });
              (window as any)._lastTap = 0;
            } else {
              if (!isLocked) setUiVisible(!uiVisible);
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

        {/* Locked mode navigation buttons */}
        <AnimatePresence>
          {isLocked && (
            <>
              <motion.button
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                onClick={(e) => { e.stopPropagation(); prevImg(); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-[52px] h-[52px] rounded-full bg-black/55 backdrop-blur-md border border-white/20 flex items-center justify-center active:scale-90 transition-transform shadow-xl z-[140]"
              >
                <span className="text-2xl text-white">←</span>
              </motion.button>
              <motion.button
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                onClick={(e) => { e.stopPropagation(); nextImg(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-[52px] h-[52px] rounded-full bg-black/55 backdrop-blur-md border border-white/20 flex items-center justify-center active:scale-90 transition-transform shadow-xl z-[140]"
              >
                <span className="text-2xl text-white">→</span>
              </motion.button>

              {/* Zoom slider — above day nav buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-3 z-[140] w-[55%] pointer-events-none"
              >
                <div className="flex-1 relative h-10 flex items-center justify-center pointer-events-auto" onClick={e => e.stopPropagation()}>
                  <input
                    type="range" min="1" max="5" step="0.01" value={scale}
                    onChange={(e) => { setScale(parseFloat(e.target.value)); if (parseFloat(e.target.value) === 1) setPan({ x: 0, y: 0 }); }}
                    className="w-full h-1.5 cursor-pointer accent-white appearance-none bg-white/25 rounded-full shadow-lg"
                  />
                </div>
                <span className="text-[10px] font-black text-white bg-black/50 px-2.5 py-1 rounded-full whitespace-nowrap">{scale.toFixed(1)}x</span>
              </motion.div>

              {/* Day nav buttons — at very bottom */}
              <motion.button
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                onClick={(e) => { e.stopPropagation(); prevDay(); }}
                className="absolute bottom-4 left-5 w-[52px] h-[52px] rounded-full bg-black/55 backdrop-blur-md border border-white/25 flex items-center justify-center active:scale-90 transition-transform shadow-xl z-[140]"
              >
                <span className="text-xl font-bold text-white">↑</span>
              </motion.button>
              <motion.button
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                onClick={(e) => { e.stopPropagation(); nextDay(); }}
                className="absolute bottom-4 right-5 w-[52px] h-[52px] rounded-full bg-black/55 backdrop-blur-md border border-white/25 flex items-center justify-center active:scale-90 transition-transform shadow-xl z-[140]"
              >
                <span className="text-xl font-bold text-white">↓</span>
              </motion.button>
            </>
          )}
        </AnimatePresence>

        {/* Sidebar Actions */}
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
          {/* 3-dots button */}
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
                  className="absolute right-full bottom-0 mr-2 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl w-44 z-30"
                  onClick={e => e.stopPropagation()}
                >
                  {[
                    { icon: <Copy className="w-4 h-4" />, label: 'Copy image URL' },
                    { icon: <Share2 className="w-4 h-4" />, label: 'Share link' },
                    { icon: <Flag className="w-4 h-4" />, label: 'Mark for review' },
                    { icon: <ChevronDown className="w-4 h-4" />, label: 'Save to album' },
                  ].map(item => (
                    <button
                      key={item.label}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors text-left"
                      onClick={() => setShowMoreMenu(false)}
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
                {tradePnl >= 0 ? '+' : ''}₹{Math.abs(tradePnl).toLocaleString()}
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
      </motion.div>
    </AnimatePresence>
  );
};
