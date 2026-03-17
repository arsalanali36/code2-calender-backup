import React, { useEffect, useRef, useState, useCallback } from 'react';

interface AudioPlayerProps {
  audioUrl: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const actxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const peaksRef = useRef<number[]>([]);
  const startTimeRef = useRef(0);
  const startOffsetRef = useRef(0);
  const rafRef = useRef<number>(0);
  const isPlayingRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  function getActx(): AudioContext {
    if (!actxRef.current || actxRef.current.state === 'closed') {
      actxRef.current = new AudioContext();
    }
    return actxRef.current;
  }

  function stopSource() {
    cancelAnimationFrame(rafRef.current);
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch (_) {}
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    isPlayingRef.current = false;
  }

  function getCurrentPlaybackTime(): number {
    const actx = actxRef.current;
    if (!actx || !isPlayingRef.current) return startOffsetRef.current;
    return startOffsetRef.current + (actx.currentTime - startTimeRef.current);
  }

  const drawWaveform = useCallback((progress: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
    if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const peaks = peaksRef.current;
    if (!peaks.length) { ctx.restore(); return; }

    const NUM = peaks.length;
    const barW = Math.max(1, (w - (NUM - 1) * 1) / NUM);
    for (let i = 0; i < NUM; i++) {
      const frac = i / NUM;
      const barH = Math.max(2, peaks[i] * (h * 0.85));
      const x = i * (barW + 1);
      const y = (h - barH) / 2;
      const radius = Math.min(barW / 2, 2);
      ctx.fillStyle = frac < progress ? '#a78bfa' : '#3f3f46';
      ctx.beginPath();
      if ((ctx as any).roundRect) (ctx as any).roundRect(x, y, barW, barH, radius);
      else ctx.rect(x, y, barW, barH);
      ctx.fill();
    }
    // Playhead
    if (progress > 0.005 && progress < 0.998) {
      const px = progress * w;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, 2);
      ctx.lineTo(px, h - 2);
      ctx.stroke();
    }
    ctx.restore();
  }, []);

  // Load + decode audio when URL changes
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setError(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    stopSource();
    bufferRef.current = null;
    peaksRef.current = [];

    async function load() {
      try {
        const res = await fetch(audioUrl, { credentials: 'include' });
        if (!res.ok) throw new Error('fetch failed');
        const arrayBuf = await res.arrayBuffer();
        const actx = getActx();
        const decoded = await actx.decodeAudioData(arrayBuf);
        if (cancelled) return;
        bufferRef.current = decoded;

        const data = decoded.getChannelData(0);
        const NUM = 60;
        const step = Math.floor(data.length / NUM);
        const rawPeaks: number[] = [];
        for (let i = 0; i < NUM; i++) {
          let max = 0;
          for (let j = 0; j < step; j++) max = Math.max(max, Math.abs(data[i * step + j] || 0));
          rawPeaks.push(max);
        }
        const maxPeak = Math.max(...rawPeaks, 0.001);
        peaksRef.current = rawPeaks.map(p => p / maxPeak);

        setDuration(decoded.duration);
        setLoaded(true);
        // Draw initial waveform after a frame (canvas needs to be laid out)
        requestAnimationFrame(() => drawWaveform(0));
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [audioUrl]);

  // Redraw waveform when canvas resizes (loaded state change triggers layout)
  useEffect(() => {
    if (loaded) requestAnimationFrame(() => drawWaveform(currentTime / (duration || 1)));
  }, [loaded]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSource();
      actxRef.current?.close();
    };
  }, []);

  function startRaf() {
    const loop = () => {
      const t = getCurrentPlaybackTime();
      const d = bufferRef.current?.duration || 1;
      const progress = Math.min(1, t / d);
      drawWaveform(progress);
      setCurrentTime(Math.min(t, d));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        stopSource();
        setIsPlaying(false);
        setCurrentTime(d);
        startOffsetRef.current = 0;
        drawWaveform(0);
        setCurrentTime(0);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  }

  function playFrom(offset: number) {
    if (!bufferRef.current) return;
    stopSource();
    const actx = getActx();
    if (actx.state === 'suspended') actx.resume();
    const src = actx.createBufferSource();
    src.buffer = bufferRef.current;
    src.connect(actx.destination);
    startOffsetRef.current = Math.max(0, Math.min(offset, bufferRef.current.duration - 0.01));
    startTimeRef.current = actx.currentTime;
    src.start(0, startOffsetRef.current);
    sourceRef.current = src;
    isPlayingRef.current = true;
    setIsPlaying(true);
    src.onended = () => {
      if (sourceRef.current === src) {
        cancelAnimationFrame(rafRef.current);
        isPlayingRef.current = false;
        setIsPlaying(false);
        startOffsetRef.current = 0;
        drawWaveform(0);
        setCurrentTime(0);
      }
    };
    startRaf();
  }

  function handlePlayPause(e: React.MouseEvent) {
    e.stopPropagation();
    if (!loaded || !bufferRef.current) return;
    if (isPlaying) {
      const t = getCurrentPlaybackTime();
      stopSource();
      setIsPlaying(false);
      startOffsetRef.current = t;
    } else {
      playFrom(startOffsetRef.current);
    }
  }

  function handleScrub(e: React.MouseEvent<HTMLCanvasElement>) {
    e.stopPropagation();
    if (!loaded || !bufferRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    playFrom(frac * bufferRef.current.duration);
  }

  function handleTouchScrub(e: React.TouchEvent<HTMLCanvasElement>) {
    e.stopPropagation();
    if (!loaded || !bufferRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0] || e.changedTouches[0];
    if (!touch) return;
    const frac = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    playFrom(frac * bufferRef.current.duration);
  }

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (error) return null;

  return (
    <div
      className="flex items-center gap-2 bg-black/65 backdrop-blur-md rounded-full px-3 py-2 border border-white/10 shadow-xl"
      onClick={e => e.stopPropagation()}
    >
      {/* Play/Pause */}
      <button
        onClickCapture={handlePlayPause}
        disabled={!loaded}
        className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:scale-90 transition-transform shadow-md"
      >
        {isPlaying
          ? <span className="text-white text-[9px] font-bold leading-none">⏸</span>
          : <span className="text-white text-[10px] font-bold leading-none ml-px">▶</span>
        }
      </button>

      {/* Waveform canvas */}
      <canvas
        ref={canvasRef}
        className="flex-1 cursor-pointer"
        style={{ height: '30px', minWidth: '80px' }}
        onClick={handleScrub}
        onTouchEnd={handleTouchScrub}
      />

      {/* Time */}
      <span className="text-[10px] font-mono text-white/70 flex-shrink-0 tabular-nums">
        {loaded ? `${fmtTime(currentTime)}/${fmtTime(duration)}` : '…'}
      </span>
    </div>
  );
};
