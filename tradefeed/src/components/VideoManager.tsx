/**
 * VideoManager — view + record + delete in one pill
 * Used in FullscreenViewer alongside AudioManager.
 *
 * States:
 *   idle (no video)  →  [ 📹 Record ] (if supported) or hidden
 *   recording        →  [ ● ] [ ████░░ progress ] [ 0:45 / 1:30 ] [ ⏹ ]
 *   saving           →  [ … Saving ]
 *   idle (has video) →  [ ▶ ] [ 📹 video ] [ ⏺ ] [ 🗑 ]
 *
 * Recording: tries getDisplayMedia (screen) first, falls back to camera.
 * Play: opens video fullscreen automatically.
 */
import React, { useEffect, useRef, useState } from 'react';

const BASE_URL = (import.meta as any).env?.VITE_API_URL ?? '';
const VIDEO_MAX_SEC = 90;

// ─── Capability check ─────────────────────────────────────────────────────────
function canScreenRecord(): boolean {
  return !!(navigator.mediaDevices && (navigator.mediaDevices as any).getDisplayMedia);
}
function canCameraRecord(): boolean {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// ─── Backend helpers ──────────────────────────────────────────────────────────
function toRawPath(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) { try { return new URL(url).pathname; } catch { return url; } }
  return url;
}
function norm(url: string): string { return toRawPath(url).replace(/^\//, ''); }

async function saveVideoToTrades(imageUrl: string, videoRawUrl: string): Promise<void> {
  const normImg = norm(imageUrl);
  const res = await fetch(`${BASE_URL}/api/trades`, { credentials: 'include' });
  if (!res.ok) throw new Error('fetch failed');
  const data = await res.json();

  // Insert video URL into images[] right after the associated image (new approach)
  let done = false;
  const insertAfter = (images: string[]) => {
    const idx = images.findIndex(u => norm(u) === normImg);
    if (idx < 0) return false;
    if (!images.includes(videoRawUrl)) images.splice(idx + 1, 0, videoRawUrl);
    return true;
  };
  for (const t of (data.trades || [])) {
    if (done) break;
    if (!Array.isArray(t.images)) t.images = [];
    done = insertAfter(t.images);
  }
  if (!done) {
    for (const dd of Object.values(data.dayData || {})) {
      if (Array.isArray((dd as any).images) && insertAfter((dd as any).images)) { done = true; break; }
      if (Array.isArray((dd as any).closeImages) && insertAfter((dd as any).closeImages)) { done = true; break; }
    }
  }
  await fetch(`${BASE_URL}/api/trades`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify(data),
  });
}

async function deleteVideoFromTrades(imageUrl: string): Promise<string | null> {
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
    if (t.videos && clearKey(t.videos)) break;
  }
  if (!deletedUrl) {
    for (const dd of Object.values(data.dayData || {})) {
      if ((dd as any).videos && clearKey((dd as any).videos)) break;
    }
  }
  await fetch(`${BASE_URL}/api/trades`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify(data),
  });
  return deletedUrl;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface VideoManagerProps {
  videoUrl?: string;
  imageUrl: string;
  onVideoChange?: (url: string | null) => void;
}

type Mode = 'idle' | 'recording' | 'saving';

export const VideoManager: React.FC<VideoManagerProps> = ({ videoUrl: initUrl, imageUrl, onVideoChange }) => {
  const [mode, setMode]           = useState<Mode>('idle');
  const [currentUrl, setCurrentUrl] = useState<string | undefined>(initUrl);
  const [recSecs, setRecSecs]     = useState(0);
  const [recError, setRecError]   = useState<string | null>(null);

  const mediaRecRef   = useRef<MediaRecorder | null>(null);
  const chunksRef     = useRef<Blob[]>([]);
  const streamRef     = useRef<MediaStream | null>(null);
  const micStreamRef  = useRef<MediaStream | null>(null);
  const actxRef       = useRef<AudioContext | null>(null);
  const recTimerRef   = useRef<ReturnType<typeof setInterval>>();
  const videoRef      = useRef<HTMLVideoElement>(null);

  // Sync prop when image changes
  useEffect(() => {
    stopRecordingCleanup();
    setCurrentUrl(initUrl);
    setMode('idle');
    setRecError(null);
    setRecSecs(0);
  }, [initUrl, imageUrl]);

  useEffect(() => () => stopRecordingCleanup(), []);

  function stopRecordingCleanup() {
    clearInterval(recTimerRef.current);
    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
      try { mediaRecRef.current.stop(); } catch (_) {}
    }
    mediaRecRef.current = null;
    chunksRef.current = [];
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    micStreamRef.current?.getTracks().forEach(t => t.stop()); micStreamRef.current = null;
    actxRef.current?.close().catch(() => {}); actxRef.current = null;
  }

  // ── Recording ──────────────────────────────────────────────────────────────
  async function startRecording(e: React.MouseEvent) {
    e.stopPropagation();
    setRecError(null);

    let screenStream: MediaStream | null = null;
    let recordStream: MediaStream;

    // Try screen capture first
    if (canScreenRecord()) {
      try {
        screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15 } },
          audio: true,
        });
      } catch (err: any) {
        if (err?.name === 'NotAllowedError') return; // user cancelled
      }
    }

    if (screenStream) {
      // Mix mic + system audio
      try {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const actx = new AudioContext();
        actxRef.current = actx;
        const dest = actx.createMediaStreamDestination();
        if (screenStream.getAudioTracks().length > 0)
          actx.createMediaStreamSource(screenStream).connect(dest);
        actx.createMediaStreamSource(micStreamRef.current).connect(dest);
        recordStream = new MediaStream([...screenStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      } catch {
        recordStream = screenStream;
      }
      streamRef.current = screenStream;
      // Auto-stop when user closes share UI
      screenStream.getVideoTracks()[0].onended = () => stopRecording();
    } else if (canCameraRecord()) {
      // Fallback: camera recording
      try {
        recordStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        streamRef.current = recordStream;
      } catch (err: any) {
        setRecError(err?.name === 'NotAllowedError' ? 'Camera permission denied' : 'Camera unavailable');
        return;
      }
    } else {
      setRecError('Screen/camera recording not supported');
      return;
    }

    chunksRef.current = [];
    const rec = new MediaRecorder(recordStream, { mimeType: 'video/webm' });
    mediaRecRef.current = rec;
    rec.ondataavailable = ev => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
    rec.onstop = () => handleRecordingDone();
    rec.start(500);
    setMode('recording');
    setRecSecs(0);

    recTimerRef.current = setInterval(() => {
      setRecSecs(s => {
        if (s + 1 >= VIDEO_MAX_SEC) { stopRecording(); return VIDEO_MAX_SEC; }
        return s + 1;
      });
    }, 1000);
  }

  function stopRecording(e?: React.MouseEvent) {
    e?.stopPropagation();
    clearInterval(recTimerRef.current);
    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
      mediaRecRef.current.stop();
    }
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    micStreamRef.current?.getTracks().forEach(t => t.stop()); micStreamRef.current = null;
    actxRef.current?.close().catch(() => {}); actxRef.current = null;
  }

  async function handleRecordingDone() {
    const chunks = [...chunksRef.current]; chunksRef.current = [];
    if (!chunks.length) { setMode('idle'); return; }
    setMode('saving');

    try {
      const blob = new Blob(chunks, { type: 'video/webm' });

      // Delete old video if replacing
      if (currentUrl) {
        await fetch(`${BASE_URL}/api/delete-video`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'include', body: JSON.stringify({ url: toRawPath(currentUrl) }),
        }).catch(() => {});
      }

      // Upload
      const fd = new FormData();
      fd.append('video', blob, 'recording.webm');
      const upRes = await fetch(`${BASE_URL}/api/upload-video`, { method: 'POST', body: fd, credentials: 'include' });
      if (!upRes.ok) throw new Error('upload failed');
      const { url: newRawUrl } = await upRes.json();

      await saveVideoToTrades(imageUrl, newRawUrl);

      const newAbsUrl = newRawUrl.startsWith('http') ? newRawUrl : `${BASE_URL}/${newRawUrl.replace(/^\//, '')}`;
      setCurrentUrl(newAbsUrl);
      onVideoChange?.(newAbsUrl);
    } catch { /* save failed silently */ }
    setMode('idle');
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await fetch(`${BASE_URL}/api/delete-video`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ url: toRawPath(currentUrl || '') }),
      });
      await deleteVideoFromTrades(imageUrl);
    } catch {}
    setCurrentUrl(undefined);
    onVideoChange?.(null);
    setMode('idle');
  }

  function handlePlay(e: React.MouseEvent) {
    e.stopPropagation();
    const vid = videoRef.current;
    if (!vid) return;
    vid.play().then(() => {
      const req = (vid as any).requestFullscreen || (vid as any).webkitRequestFullscreen;
      if (req) req.call(vid).catch(() => {});
    }).catch(() => {});
  }

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  const pill = 'flex items-center gap-2 bg-black/65 backdrop-blur-md rounded-full px-3 py-2 border border-white/10 shadow-xl';

  // Saving
  if (mode === 'saving') {
    return (
      <div className={`${pill} justify-center`} onClick={e => e.stopPropagation()}>
        <span className="text-xs text-white/60 font-medium">Saving video…</span>
      </div>
    );
  }

  // Recording
  if (mode === 'recording') {
    const progress = Math.min(1, recSecs / VIDEO_MAX_SEC);
    return (
      <div className={pill} onClick={e => e.stopPropagation()}>
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
        {/* Progress bar */}
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden" style={{ minWidth: '80px' }}>
          <div className="h-full bg-red-500 rounded-full transition-all duration-1000" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="text-[10px] font-mono text-red-300 flex-shrink-0 tabular-nums">
          {fmtTime(recSecs)}/{fmtTime(VIDEO_MAX_SEC)}
        </span>
        <button
          onClickCapture={stopRecording}
          className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform shadow-md"
        >
          <span className="w-2.5 h-2.5 bg-white rounded-sm block" />
        </button>
      </div>
    );
  }

  // Has video — player pill
  if (currentUrl) {
    return (
      <div className={pill} onClick={e => e.stopPropagation()}>
        {/* Hidden video element for fullscreen playback */}
        <video ref={videoRef} src={currentUrl} className="hidden" playsInline />

        {/* Play button */}
        <button
          onClickCapture={handlePlay}
          className="w-7 h-7 rounded-full bg-sky-600 flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform shadow-md"
        >
          <span className="text-white text-[10px] font-bold leading-none ml-px">▶</span>
        </button>

        <span className="text-xs text-white/70 flex-shrink-0">📹 Video</span>

        <div className="w-px h-4 bg-white/15 flex-shrink-0" />

        {/* Re-record */}
        <button
          onClickCapture={startRecording}
          className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform hover:bg-white/20"
          title="Re-record"
        >
          <span className="w-2 h-2 rounded-full bg-red-400 block" />
        </button>

        {/* Delete */}
        <button
          onClickCapture={handleDelete}
          className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform hover:bg-rose-500/60"
          title="Delete video"
        >
          <span className="text-[11px] leading-none text-white/70">🗑</span>
        </button>
      </div>
    );
  }

  // No video — show record button if supported
  const canRec = canScreenRecord() || canCameraRecord();
  if (!canRec) return null;

  return (
    <div className="flex flex-col gap-1" onClick={e => e.stopPropagation()}>
      <div className={pill}>
        <button
          onClickCapture={startRecording}
          className="flex items-center gap-2 text-white/70 hover:text-white active:scale-95 transition-all w-full justify-center py-0.5"
        >
          <span className="text-base leading-none">📹</span>
          <span className="text-xs font-medium">Record video note</span>
        </button>
      </div>
      {recError && (
        <div className="bg-red-900/70 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center">
          <span className="text-[10px] text-red-300 font-medium">{recError}</span>
        </div>
      )}
    </div>
  );
};
