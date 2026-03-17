/**
 * AudioManager — playback + record + delete in one pill
 * Used in FullscreenViewer: always shown so user can add/replace/delete audio notes.
 *
 * States:
 *   idle (no audio)  →  [ 🎤  Record audio note ]
 *   recording        →  [ ● ] [ ~animated bars~ ] [ 0:05 ] [ ⏹ ]
 *   saving           →  [ … Saving ]
 *   idle (has audio) →  [ ▶/⏸ ] [ waveform ] [ time ] [ ⏺ ] [ 🗑 ]
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';

const BASE_URL = (import.meta as any).env?.VITE_API_URL ?? '';

// ─── URL helpers ─────────────────────────────────────────────────────────────
function toRawPath(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) {
    try { return new URL(url).pathname; } catch { return url; }
  }
  return url;
}
function norm(url: string): string {
  return toRawPath(url).replace(/^\//, '');
}

// ─── Backend helpers ──────────────────────────────────────────────────────────
async function saveAudioToTrades(imageUrl: string, audioRawUrl: string): Promise<void> {
  const normImg = norm(imageUrl);
  const res = await fetch(`${BASE_URL}/api/trades`, { credentials: 'include' });
  if (!res.ok) throw new Error('fetch failed');
  const data = await res.json();

  let done = false;
  const setKey = (store: Record<string, string>, imgs: string[]) => {
    const matched = imgs.find(u => norm(u) === normImg);
    if (!matched) return false;
    store[matched] = audioRawUrl;
    return true;
  };
  for (const t of (data.trades || [])) {
    if (done) break;
    t.audios = t.audios || {};
    done = setKey(t.audios, t.images || []);
  }
  if (!done) {
    for (const dd of Object.values(data.dayData || {})) {
      dd.audios = (dd as any).audios || {};
      if (setKey((dd as any).audios, (dd as any).images || [])) { done = true; break; }
      if (setKey((dd as any).audios, (dd as any).closeImages || [])) { done = true; break; }
    }
  }
  await fetch(`${BASE_URL}/api/trades`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify(data),
  });
}

async function deleteAudioFromTrades(imageUrl: string): Promise<string | null> {
  const normImg = norm(imageUrl);
  const res = await fetch(`${BASE_URL}/api/trades`, { credentials: 'include' });
  if (!res.ok) throw new Error('fetch failed');
  const data = await res.json();
  let deletedUrl: string | null = null;

  const clearKey = (store: Record<string, string>) => {
    for (const k of Object.keys(store)) {
      if (norm(k) === normImg) { deletedUrl = store[k]; delete store[k]; return true; }
    }
    return false;
  };
  for (const t of (data.trades || [])) {
    if (t.audios && clearKey(t.audios)) break;
  }
  if (!deletedUrl) {
    for (const dd of Object.values(data.dayData || {})) {
      if ((dd as any).audios && clearKey((dd as any).audios)) break;
    }
  }
  await fetch(`${BASE_URL}/api/trades`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify(data),
  });
  return deletedUrl;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface AudioManagerProps {
  audioUrl?: string;   // resolved URL of existing audio (undefined = none)
  imageUrl: string;    // resolved URL of the current image (for trade lookup)
  onAudioChange?: (url: string | null) => void;
}

type Mode = 'idle' | 'recording' | 'saving';

export const AudioManager: React.FC<AudioManagerProps> = ({ audioUrl: initUrl, imageUrl, onAudioChange }) => {
  const [mode, setMode] = useState<Mode>('idle');
  const [currentUrl, setCurrentUrl] = useState<string | undefined>(initUrl);

  // ── playback state ──────────────────────────────────────────────────────────
  const pbCanvasRef = useRef<HTMLCanvasElement>(null);
  const actxRef     = useRef<AudioContext | null>(null);
  const bufferRef   = useRef<AudioBuffer | null>(null);
  const sourceRef   = useRef<AudioBufferSourceNode | null>(null);
  const peaksRef    = useRef<number[]>([]);
  const startTimeRef   = useRef(0);
  const startOffsetRef = useRef(0);
  const pbRafRef    = useRef<number>(0);
  const isPlayRef   = useRef(false);
  const [pbLoaded, setPbLoaded]   = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pbCurrent, setPbCurrent] = useState(0);
  const [pbDuration, setPbDuration] = useState(0);

  // ── recording state ─────────────────────────────────────────────────────────
  const recCanvasRef = useRef<HTMLCanvasElement>(null);
  const recRafRef    = useRef<number>(0);
  const mediaRecRef  = useRef<MediaRecorder | null>(null);
  const chunksRef    = useRef<Blob[]>([]);
  const [recSecs, setRecSecs] = useState(0);
  const recTimerRef  = useRef<ReturnType<typeof setInterval>>();

  // ── Sync prop → state when image changes ───────────────────────────────────
  useEffect(() => {
    stopPb();
    stopRecState();
    setCurrentUrl(initUrl);
    setMode('idle');
    setPbLoaded(false);
    setPbCurrent(0);
    setPbDuration(0);
    bufferRef.current = null;
    peaksRef.current = [];
  }, [initUrl, imageUrl]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopPb();
      actxRef.current?.close();
      stopRecState();
    };
  }, []);

  // ── Load audio when URL set ─────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUrl) return;
    let cancelled = false;
    setPbLoaded(false); setPbCurrent(0); setPbDuration(0);
    bufferRef.current = null; peaksRef.current = [];
    stopPb();

    (async () => {
      try {
        const res = await fetch(currentUrl, { credentials: 'include' });
        if (!res.ok || cancelled) return;
        const ab = await res.arrayBuffer();
        if (cancelled) return;
        const actx = getActx();
        const decoded = await actx.decodeAudioData(ab);
        if (cancelled) return;
        bufferRef.current = decoded;
        const raw = decoded.getChannelData(0);
        const N = 60, step = Math.floor(raw.length / N);
        const rp: number[] = [];
        for (let i = 0; i < N; i++) {
          let m = 0; for (let j = 0; j < step; j++) m = Math.max(m, Math.abs(raw[i * step + j] || 0));
          rp.push(m);
        }
        const maxP = Math.max(...rp, 0.001);
        peaksRef.current = rp.map(p => p / maxP);
        setPbDuration(decoded.duration);
        setPbLoaded(true);
        requestAnimationFrame(() => drawPb(0));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [currentUrl]);

  // Redraw after load
  useEffect(() => { if (pbLoaded) requestAnimationFrame(() => drawPb(pbCurrent / (pbDuration || 1))); }, [pbLoaded]);

  // ── Web Audio helpers ───────────────────────────────────────────────────────
  function getActx() {
    if (!actxRef.current || actxRef.current.state === 'closed')
      actxRef.current = new AudioContext();
    return actxRef.current;
  }

  function stopPb() {
    cancelAnimationFrame(pbRafRef.current);
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch (_) {}
      sourceRef.current.disconnect(); sourceRef.current = null;
    }
    isPlayRef.current = false;
  }

  function getPbTime() {
    const actx = actxRef.current;
    if (!actx || !isPlayRef.current) return startOffsetRef.current;
    return startOffsetRef.current + (actx.currentTime - startTimeRef.current);
  }

  const drawPb = useCallback((progress: number) => {
    const canvas = pbCanvasRef.current; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
    if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.save(); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
    const peaks = peaksRef.current; if (!peaks.length) { ctx.restore(); return; }
    const N = peaks.length;
    const bw = Math.max(1, (w - (N - 1)) / N);
    for (let i = 0; i < N; i++) {
      const frac = i / N;
      const bh = Math.max(2, peaks[i] * h * 0.85);
      const x = i * (bw + 1), y = (h - bh) / 2;
      const r = Math.min(bw / 2, 2);
      ctx.fillStyle = frac < progress ? '#a78bfa' : '#3f3f46';
      ctx.beginPath();
      if ((ctx as any).roundRect) (ctx as any).roundRect(x, y, bw, bh, r); else ctx.rect(x, y, bw, bh);
      ctx.fill();
    }
    if (progress > 0.005 && progress < 0.998) {
      const px = progress * w;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(px, 2); ctx.lineTo(px, h - 2); ctx.stroke();
    }
    ctx.restore();
  }, []);

  function pbRafLoop() {
    const t = getPbTime(), d = bufferRef.current?.duration || 1;
    const prog = Math.min(1, t / d);
    drawPb(prog); setPbCurrent(Math.min(t, d));
    if (prog < 1) pbRafRef.current = requestAnimationFrame(pbRafLoop);
    else { stopPb(); setIsPlaying(false); setPbCurrent(d); startOffsetRef.current = 0; drawPb(0); setPbCurrent(0); }
  }

  function playFrom(offset: number) {
    if (!bufferRef.current) return;
    stopPb();
    const actx = getActx(); if (actx.state === 'suspended') actx.resume();
    const src = actx.createBufferSource(); src.buffer = bufferRef.current;
    src.connect(actx.destination);
    startOffsetRef.current = Math.max(0, Math.min(offset, bufferRef.current.duration - 0.01));
    startTimeRef.current = actx.currentTime;
    src.start(0, startOffsetRef.current); sourceRef.current = src;
    isPlayRef.current = true; setIsPlaying(true);
    src.onended = () => {
      if (sourceRef.current === src) {
        cancelAnimationFrame(pbRafRef.current);
        isPlayRef.current = false; setIsPlaying(false);
        startOffsetRef.current = 0; drawPb(0); setPbCurrent(0);
      }
    };
    pbRafRef.current = requestAnimationFrame(pbRafLoop);
  }

  function handlePlayPause(e: React.MouseEvent) {
    e.stopPropagation();
    if (!pbLoaded || !bufferRef.current) return;
    if (isPlaying) {
      const t = getPbTime(); stopPb(); setIsPlaying(false); startOffsetRef.current = t;
    } else { playFrom(startOffsetRef.current); }
  }

  function handleScrub(e: React.MouseEvent<HTMLCanvasElement>) {
    e.stopPropagation();
    if (!pbLoaded || !bufferRef.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    playFrom(frac * bufferRef.current.duration);
  }

  function handleTouchScrub(e: React.TouchEvent<HTMLCanvasElement>) {
    e.stopPropagation();
    if (!pbLoaded || !bufferRef.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0] || e.changedTouches[0]; if (!touch) return;
    const frac = Math.max(0, Math.min(1, (touch.clientX - r.left) / r.width));
    playFrom(frac * bufferRef.current.duration);
  }

  // ── Recording animation ─────────────────────────────────────────────────────
  function drawRecAnim(sec: number) {
    const canvas = recCanvasRef.current; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
    if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.save(); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
    const N = 40, bw = Math.max(1, (w - (N - 1) * 1) / N);
    for (let i = 0; i < N; i++) {
      const t = sec + i * 0.3;
      const amp = (Math.sin(t * 2.5) * 0.4 + Math.sin(t * 1.3 + i) * 0.3 + 0.3 + Math.random() * 0.1);
      const bh = Math.max(2, amp * h * 0.8);
      const x = i * (bw + 1), y = (h - bh) / 2;
      ctx.fillStyle = `rgba(239, 68, 68, ${0.6 + amp * 0.4})`;
      ctx.beginPath();
      if ((ctx as any).roundRect) (ctx as any).roundRect(x, y, bw, bh, Math.min(bw / 2, 2));
      else ctx.rect(x, y, bw, bh);
      ctx.fill();
    }
    ctx.restore();
  }

  let recAnimSec = useRef(0);
  function startRecAnim() {
    const loop = () => {
      recAnimSec.current += 0.05;
      drawRecAnim(recAnimSec.current);
      recRafRef.current = requestAnimationFrame(loop);
    };
    recRafRef.current = requestAnimationFrame(loop);
  }

  function stopRecState() {
    cancelAnimationFrame(recRafRef.current);
    clearInterval(recTimerRef.current);
    setRecSecs(0);
    recAnimSec.current = 0;
    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
      try { mediaRecRef.current.stop(); } catch (_) {}
    }
    mediaRecRef.current = null;
    chunksRef.current = [];
  }

  // ── Recording actions ───────────────────────────────────────────────────────
  async function startRecording(e: React.MouseEvent) {
    e.stopPropagation();
    stopPb();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mediaRecRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = ev => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        handleRecordingDone();
      };
      rec.start(100);
      setMode('recording');
      setRecSecs(0);
      recTimerRef.current = setInterval(() => {
        setRecSecs(s => {
          if (s >= 59) { stopRecording(); return 60; }
          return s + 1;
        });
      }, 1000);
      startRecAnim();
    } catch { /* mic denied */ }
  }

  function stopRecording(e?: React.MouseEvent) {
    e?.stopPropagation();
    clearInterval(recTimerRef.current);
    cancelAnimationFrame(recRafRef.current);
    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
      mediaRecRef.current.stop();
    }
  }

  async function handleRecordingDone() {
    const chunks = [...chunksRef.current];
    chunksRef.current = [];
    if (!chunks.length) { setMode('idle'); return; }

    setMode('saving');
    try {
      const blob = new Blob(chunks, { type: 'audio/webm' });

      // If replacing old audio, delete it first
      if (currentUrl) {
        const rawOld = toRawPath(currentUrl);
        await fetch(`${BASE_URL}/api/delete-audio`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'include', body: JSON.stringify({ url: rawOld }),
        }).catch(() => {});
      }

      // Upload new recording
      const fd = new FormData();
      fd.append('audio', blob, 'recording.webm');
      const upRes = await fetch(`${BASE_URL}/api/upload-audio`, { method: 'POST', body: fd, credentials: 'include' });
      if (!upRes.ok) throw new Error('upload failed');
      const { url: newRawUrl } = await upRes.json();

      // Save association in trades.json
      await saveAudioToTrades(imageUrl, newRawUrl);

      // Resolve to absolute URL
      const newAbsUrl = newRawUrl.startsWith('http') ? newRawUrl : `${BASE_URL}/${newRawUrl.replace(/^\//, '')}`;
      setCurrentUrl(newAbsUrl);
      onAudioChange?.(newAbsUrl);
    } catch { /* save failed */ }
    setMode('idle');
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    stopPb();
    try {
      const rawUrl = toRawPath(currentUrl || '');
      await fetch(`${BASE_URL}/api/delete-audio`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ url: rawUrl }),
      });
      await deleteAudioFromTrades(imageUrl);
    } catch {}
    setCurrentUrl(undefined);
    onAudioChange?.(null);
    setMode('idle');
  }

  // ── Formatters ──────────────────────────────────────────────────────────────
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  // ── Render ──────────────────────────────────────────────────────────────────
  const pill = 'flex items-center gap-2 bg-black/65 backdrop-blur-md rounded-full px-3 py-2 border border-white/10 shadow-xl';

  // Saving
  if (mode === 'saving') {
    return (
      <div className={`${pill} justify-center`} onClick={e => e.stopPropagation()}>
        <span className="text-xs text-white/60 font-medium">Saving…</span>
      </div>
    );
  }

  // Recording
  if (mode === 'recording') {
    return (
      <div className={pill} onClick={e => e.stopPropagation()}>
        {/* Blink dot */}
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
        {/* Animated wave */}
        <canvas ref={recCanvasRef} className="flex-1" style={{ height: '30px', minWidth: '80px' }} />
        {/* Timer */}
        <span className="text-[10px] font-mono text-red-300 flex-shrink-0 tabular-nums">{fmtTime(recSecs)}</span>
        {/* Stop button */}
        <button
          onClickCapture={stopRecording}
          className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform shadow-md"
        >
          <span className="w-2.5 h-2.5 bg-white rounded-sm block" />
        </button>
      </div>
    );
  }

  // No audio — show record CTA
  if (!currentUrl) {
    return (
      <div className={pill} onClick={e => e.stopPropagation()}>
        <button
          onClickCapture={startRecording}
          className="flex items-center gap-2 text-white/70 hover:text-white active:scale-95 transition-all w-full justify-center py-0.5"
        >
          <span className="text-base leading-none">🎤</span>
          <span className="text-xs font-medium">Record audio note</span>
        </button>
      </div>
    );
  }

  // Has audio — player + re-record + delete
  return (
    <div className={pill} onClick={e => e.stopPropagation()}>
      {/* Play/Pause */}
      <button
        onClickCapture={handlePlayPause}
        disabled={!pbLoaded}
        className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:scale-90 transition-transform shadow-md"
      >
        {isPlaying
          ? <span className="text-white text-[9px] font-bold leading-none">⏸</span>
          : <span className="text-white text-[10px] font-bold leading-none ml-px">▶</span>
        }
      </button>

      {/* Waveform canvas */}
      <canvas
        ref={pbCanvasRef}
        className="flex-1 cursor-pointer"
        style={{ height: '30px', minWidth: '60px' }}
        onClick={handleScrub}
        onTouchEnd={handleTouchScrub}
      />

      {/* Time */}
      <span className="text-[10px] font-mono text-white/70 flex-shrink-0 tabular-nums">
        {pbLoaded ? `${fmtTime(pbCurrent)}/${fmtTime(pbDuration)}` : '…'}
      </span>

      {/* Divider */}
      <div className="w-px h-4 bg-white/15 flex-shrink-0" />

      {/* Re-record */}
      <button
        onClickCapture={startRecording}
        className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform hover:bg-white/20"
        title="Record new"
      >
        <span className="w-2 h-2 rounded-full bg-red-400 block" />
      </button>

      {/* Delete */}
      <button
        onClickCapture={handleDelete}
        className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform hover:bg-rose-500/60"
        title="Delete audio"
      >
        <span className="text-[11px] leading-none text-white/70">🗑</span>
      </button>
    </div>
  );
};
