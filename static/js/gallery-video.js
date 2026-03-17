/**
 * @fileoverview gallery-video.js
 * @description Per-image screen recording: record (max 1:30), preview, play, delete, replace.
 * Uses getDisplayMedia() for screen capture + MediaRecorder for WebM encoding.
 * Cap: 90 seconds. Stored in static/uploads/video/.
 */

// ── Recording state ────────────────────────────────────────────────────────
let _videoRecorder     = null;
let _videoChunks       = [];
let _videoTimerInterval = null;
let _videoTimerSec     = 0;
let _videoStream       = null;
let _videoMicStream    = null;
let _videoActx         = null;

const VIDEO_MAX_SEC = 90; // 1:30 cap

// ── Format mm:ss ───────────────────────────────────────────────────────────
function _fmtVideoTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── Stop & release all streams ─────────────────────────────────────────────
function _stopVideoStream() {
  if (_videoStream)    { _videoStream.getTracks().forEach(t => t.stop());    _videoStream    = null; }
  if (_videoMicStream) { _videoMicStream.getTracks().forEach(t => t.stop()); _videoMicStream = null; }
  if (_videoActx)      { _videoActx.close().catch(() => {}); _videoActx = null; }
}

// ── Progress bar draw (simple CSS width bar) ───────────────────────────────
function _updateVideoProgress(sec) {
  const bar = document.getElementById('gv2-video-progress-fill');
  if (bar) bar.style.width = Math.min(100, (sec / VIDEO_MAX_SEC) * 100) + '%';
  const el = document.getElementById('gv2-video-timer');
  if (el) el.textContent = _fmtVideoTime(sec) + ' / ' + _fmtVideoTime(VIDEO_MAX_SEC);
}

// ── Main render ────────────────────────────────────────────────────────────
function renderVideoBar() {
  const bar = document.getElementById('gv2-video-bar');
  if (!bar) return;

  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  if (!imgUrl) { bar.style.display = 'none'; return; }

  // Respect collapse state (controlled by audio bar toggle)
  if (typeof _mediaBarCollapsed !== 'undefined' && _mediaBarCollapsed) {
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'flex';
  const videoUrl    = getVideoForImage(imgUrl, state.gallery.date || '');
  const isRecording = _videoRecorder && _videoRecorder.state === 'recording';

  bar.innerHTML = '';

  if (isRecording) {
    // ── Recording UI ──
    const dot = document.createElement('span');
    dot.className   = 'gv2-video-dot';
    dot.textContent = '●';

    const timerEl = document.createElement('span');
    timerEl.className   = 'gv2-video-timer';
    timerEl.id          = 'gv2-video-timer';
    timerEl.textContent = _fmtVideoTime(_videoTimerSec) + ' / ' + _fmtVideoTime(VIDEO_MAX_SEC);

    const progressWrap = document.createElement('div');
    progressWrap.className = 'gv2-video-progress';
    const progressFill = document.createElement('div');
    progressFill.className = 'gv2-video-progress-fill';
    progressFill.id        = 'gv2-video-progress-fill';
    progressFill.style.width = Math.min(100, (_videoTimerSec / VIDEO_MAX_SEC) * 100) + '%';
    progressWrap.appendChild(progressFill);

    const stopBtn = document.createElement('button');
    stopBtn.className   = 'gv2-video-btn gv2-video-stop';
    stopBtn.textContent = '⏹ Stop';
    stopBtn.onclick     = stopVideoRecording;

    bar.appendChild(dot);
    bar.appendChild(timerEl);
    bar.appendChild(progressWrap);
    bar.appendChild(stopBtn);

  } else if (videoUrl) {
    // ── Playback UI ──
    const vid = document.createElement('video');
    vid.className = 'gv2-video-player';
    vid.src       = videoUrl;
    vid.controls  = true;
    vid.preload   = 'metadata';
    vid.onplay    = () => { (vid.requestFullscreen || vid.webkitRequestFullscreen || (() => {})).call(vid); };

    const replaceBtn = document.createElement('button');
    replaceBtn.className   = 'gv2-video-btn';
    replaceBtn.title       = 'Re-record';
    replaceBtn.textContent = '⏺';
    replaceBtn.onclick     = startVideoRecording;

    const delBtn = document.createElement('button');
    delBtn.className   = 'gv2-video-btn gv2-video-del';
    delBtn.title       = 'Delete video';
    delBtn.textContent = '🗑';
    delBtn.onclick     = _deleteVideo;

    bar.appendChild(vid);
    bar.appendChild(replaceBtn);
    bar.appendChild(delBtn);

  } else {
    // Empty state — handled by audio bar (shows both buttons together)
    bar.style.display = 'none';
    return;
  }
}

// ── Recording ──────────────────────────────────────────────────────────────
async function startVideoRecording() {
  // Stop any active recording first
  if (_videoRecorder && _videoRecorder.state !== 'inactive') {
    _videoRecorder.stop();
    await new Promise(r => setTimeout(r, 200));
  }
  _stopVideoStream();

  let screenStream;
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15 } },
      audio: true  // system/tab audio (browser shows checkbox)
    });
  } catch (err) {
    if (err.name !== 'NotAllowedError') {
      alert('Screen capture failed: ' + err.message);
    }
    return; // user cancelled or denied
  }

  // Mix mic + system audio into a single audio track
  let recordStream;
  try {
    _videoMicStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    const actx = new AudioContext();
    _videoActx    = actx;
    const dest    = actx.createMediaStreamDestination();

    // System/screen audio (may be absent if user unchecked)
    if (screenStream.getAudioTracks().length > 0) {
      actx.createMediaStreamSource(screenStream).connect(dest);
    }
    // Mic audio
    actx.createMediaStreamSource(_videoMicStream).connect(dest);

    recordStream = new MediaStream([
      ...screenStream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ]);
  } catch (_) {
    // Mic denied or unavailable — fall back to video-only
    recordStream = screenStream;
  }

  _videoStream  = screenStream;
  _videoChunks  = [];
  _videoRecorder = new MediaRecorder(recordStream, { mimeType: 'video/webm' });

  _videoRecorder.ondataavailable = e => { if (e.data.size > 0) _videoChunks.push(e.data); };

  _videoRecorder.onstop = async () => {
    _stopVideoStream();
    clearInterval(_videoTimerInterval);
    _videoTimerSec = 0;

    const blob = new Blob(_videoChunks, { type: 'video/webm' });
    _videoChunks = [];

    try {
      const result = await imageService.uploadVideo(blob);
      if (result && result.url) {
        const imgUrl   = (state.gallery.images || [])[state.gallery.currentIndex];
        const oldVideo = getVideoForImage(imgUrl, state.gallery.date || '');
        if (oldVideo) {
          imageService.deleteVideo(oldVideo).catch(() => {});
        }
        setVideoForCurrentGalleryImage(result.url);
        await saveTrades();
      }
    } catch (err) {
      console.error('Video upload failed', err);
      alert('Video upload failed: ' + err.message);
    }
    renderVideoBar();
    if (typeof renderAudioBar === 'function') renderAudioBar();
    if (typeof renderGallery === 'function') renderGallery();
  };

  // Auto-stop when user closes browser share UI
  screenStream.getVideoTracks()[0].onended = () => stopVideoRecording();

  _videoRecorder.start(500);
  _videoTimerSec = 0;

  _videoTimerInterval = setInterval(() => {
    _videoTimerSec++;
    _updateVideoProgress(_videoTimerSec);
    if (_videoTimerSec >= VIDEO_MAX_SEC) stopVideoRecording();
  }, 1000);

  renderVideoBar();
}

function stopVideoRecording() {
  if (_videoRecorder && _videoRecorder.state !== 'inactive') _videoRecorder.stop();
  clearInterval(_videoTimerInterval);
}

// ── Delete ─────────────────────────────────────────────────────────────────
async function _deleteVideo() {
  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  if (!imgUrl) return;
  const videoUrl = getVideoForImage(imgUrl, state.gallery.date || '');
  if (!videoUrl) return;
  try { await imageService.deleteVideo(videoUrl); } catch (e) { console.error(e); }
  deleteVideoForCurrentGalleryImage();
  await saveTrades();
  renderVideoBar();
  if (typeof renderAudioBar === 'function') renderAudioBar();
  if (typeof renderGallery === 'function') renderGallery();
}
