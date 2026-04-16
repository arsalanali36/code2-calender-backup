# JS - Gallery Media (audio, video, chart)
Consolidated code context for AI assistants.


## File: `static/js/gallery-audio.js`
```js
/**
 * @fileoverview gallery-audio.js
 * @description Per-image audio: record (max 1 min), waveform, scrub, play, delete, replace.
 *
 * Playback uses Web Audio API (AudioBufferSourceNode) — NOT <audio> element.
 * Reason: MediaRecorder WebM files have duration=Infinity in <audio> elements,
 * and Chrome sometimes silently fails to play them. We already decode via
 * AudioContext for the waveform, so we reuse that buffer for playback too.
 */


// ── Recording state ────────────────────────────────────────────────────────
let _audioRecorder = null;
let _audioChunks   = [];
let _audioTimerInterval = null;
let _audioTimerSec = 0;

// ── Playback state (Web Audio API) ────────────────────────────────────────
let _actx        = null;   // shared AudioContext (created once, reused)
let _sourceNode  = null;   // current AudioBufferSourceNode
let _startTime   = 0;      // actx.currentTime when playback began
let _startOffset = 0;      // seconds into buffer at which we started
let _isPlaying   = false;
let _playheadRaf = null;

// ── Cache: url → { peaks, duration, buffer } ──────────────────────────────
const _waveformCache = new Map();

// ── AudioContext (lazy, shared) ────────────────────────────────────────────
function _getActx() {
  if (!_actx || _actx.state === 'closed') _actx = new AudioContext();
  if (_actx.state === 'suspended') _actx.resume();
  return _actx;
}

// ── Decode audio → peaks + duration + AudioBuffer ─────────────────────────
async function _decodeAudio(url) {
  if (_waveformCache.has(url)) return _waveformCache.get(url);

  const resp = await fetch(url);
  const buf  = await resp.arrayBuffer();
  const actx = _getActx();
  let decoded;
  try { decoded = await actx.decodeAudioData(buf); }
  catch (e) { console.warn('Audio decode failed:', e); return null; }

  const data      = decoded.getChannelData(0);
  const numBars   = 60;
  const blockSize = Math.max(1, Math.floor(data.length / numBars));
  const peaks     = new Float32Array(numBars);
  for (let i = 0; i < numBars; i++) {
    let max = 0;
    const start = i * blockSize;
    for (let j = 0; j < blockSize; j++) {
      const v = Math.abs(data[start + j] || 0);
      if (v > max) max = v;
    }
    peaks[i] = max;
  }

  const result = { peaks, duration: decoded.duration, buffer: decoded };
  _waveformCache.set(url, result);
  return result;
}

// ── Playback via AudioBufferSourceNode ────────────────────────────────────

function _playFromOffset(waveData, offset, canvas) {
  _stopSource();
  const actx = _getActx();

  const src = actx.createBufferSource();
  src.buffer = waveData.buffer;
  src.connect(actx.destination);
  src.start(0, Math.max(0, Math.min(offset, waveData.duration - 0.01)));

  _sourceNode  = src;
  _startTime   = actx.currentTime;
  _startOffset = offset;
  _isPlaying   = true;

  src.onended = () => {
    if (_sourceNode !== src) return; // stale — replaced by newer call
    _isPlaying  = false;
    _sourceNode = null;
    cancelAnimationFrame(_playheadRaf);
    renderAudioBar();
  };

  _startPlayheadLoop(canvas, waveData);
  _syncPlayBtn(true);
}

function _stopSource() {
  if (_sourceNode) {
    try { _sourceNode.stop(); } catch (_) {}
    _sourceNode = null;
  }
  _isPlaying = false;
  cancelAnimationFrame(_playheadRaf);
}

function _getCurrentPlaybackTime() {
  if (!_isPlaying || !_actx) return _startOffset;
  return _startOffset + (_actx.currentTime - _startTime);
}

// ── Canvas helpers ─────────────────────────────────────────────────────────

function _makeCanvas(cssW, cssH) {
  const dpr = window.devicePixelRatio || 1;
  const c   = document.createElement('canvas');
  c.width   = Math.round(cssW * dpr);
  c.height  = Math.round(cssH * dpr);
  c.style.width      = cssW + 'px';
  c.style.height     = cssH + 'px';
  c.style.cursor     = 'ew-resize';
  c.style.borderRadius = '4px';
  c.style.flexShrink = '0';
  return c;
}

function _drawWaveform(canvas, peaks, progress) {
  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.width / dpr;
  const H   = canvas.height / dpr;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!peaks || !peaks.length) return;

  ctx.save();
  ctx.scale(dpr, dpr);

  // Normalize so quiet recordings still show a proper waveform
  let maxPeak = 0.0001;
  for (let i = 0; i < peaks.length; i++) if (peaks[i] > maxPeak) maxPeak = peaks[i];

  const n          = peaks.length;
  const barW       = W / n;
  const playedIdx  = Math.floor(progress * n);

  for (let i = 0; i < n; i++) {
    const h = Math.max(3, (peaks[i] / maxPeak) * H * 0.88);
    const y = (H - h) / 2;
    ctx.fillStyle = i < playedIdx ? '#9580ff' : '#3b3b5c';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(i * barW + 0.5, y, Math.max(1, barW - 1.5), h, 1);
    else               ctx.rect(i * barW + 0.5, y, Math.max(1, barW - 1.5), h);
    ctx.fill();
  }

  // Playhead
  const px = Math.min(progress * W, W - 1);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(px - 1, 0, 2, H);
  ctx.restore();
}

function _drawRecordingWave(canvas, sec) {
  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.width / dpr;
  const H   = canvas.height / dpr;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);
  const n      = Math.floor(W / 4);
  const filled = Math.floor((sec / 60) * n);
  for (let i = 0; i < n; i++) {
    const h = i < filled
      ? Math.max(3, (Math.abs(Math.sin(i * 0.5 + sec)) * 0.5 + 0.2) * H * 0.85)
      : 3;
    ctx.fillStyle = i < filled ? '#ff4477' : '#3b3b5c';
    ctx.fillRect(i * 4 + 0.5, (H - h) / 2, 2.5, h);
  }
  ctx.restore();
}

function _fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  return `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;
}

// ── Playhead RAF loop ──────────────────────────────────────────────────────

function _startPlayheadLoop(canvas, waveData) {
  cancelAnimationFrame(_playheadRaf);
  function frame() {
    if (!_isPlaying) return;
    const cur  = _getCurrentPlaybackTime();
    const prog = waveData.duration > 0 ? Math.min(1, cur / waveData.duration) : 0;
    _drawWaveform(canvas, waveData.peaks, prog);
    const timeEl = document.getElementById('gv2-audio-time');
    if (timeEl) timeEl.textContent = `${_fmtTime(cur)} / ${_fmtTime(waveData.duration)}`;
    _playheadRaf = requestAnimationFrame(frame);
  }
  _playheadRaf = requestAnimationFrame(frame);
}

function _syncPlayBtn(playing) {
  const btn = document.querySelector('#gv2-audio-bar .gv2-audio-play');
  if (btn) btn.textContent = playing ? '⏸' : '▶';
}

// ── Scrub ─────────────────────────────────────────────────────────────────

function _bindScrub(canvas, waveData) {
  let dragging = false;

  const getFrac = (clientX) => {
    const rect = canvas.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const seek = (clientX) => {
    const frac   = getFrac(clientX);
    const offset = frac * waveData.duration;
    _drawWaveform(canvas, waveData.peaks, frac);
    const timeEl = document.getElementById('gv2-audio-time');
    if (timeEl) timeEl.textContent = `${_fmtTime(offset)} / ${_fmtTime(waveData.duration)}`;

    // If playing → restart from new position
    if (_isPlaying) _playFromOffset(waveData, offset, canvas);
  };

  const onDown = (clientX) => {
    dragging = true;
    // Always start playback from clicked position
    const frac   = getFrac(clientX);
    const offset = frac * waveData.duration;
    _drawWaveform(canvas, waveData.peaks, frac);
    _playFromOffset(waveData, offset, canvas);
  };

  canvas.addEventListener('mousedown', e => { onDown(e.clientX); e.preventDefault(); });
  canvas.addEventListener('mousemove', e => { if (dragging) seek(e.clientX); });
  document.addEventListener('mouseup',  () => { dragging = false; });

  canvas.addEventListener('touchstart', e => { onDown(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchmove',  e => { if (dragging) seek(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
  document.addEventListener('touchend', () => { dragging = false; });
}

// ── Main render ────────────────────────────────────────────────────────────

// ── Helper: video rec button (shown in every non-recording audio state) ────
function _appendVideoRecBtn(bar, imgUrl) {
  const hasVideo     = typeof getVideoForImage === 'function' && getVideoForImage(imgUrl, state.gallery.date || '');
  const vidRecording = typeof _videoRecorder !== 'undefined' && _videoRecorder && _videoRecorder.state === 'recording';
  if (hasVideo || vidRecording || typeof startVideoRecording !== 'function') return;
  const sep = document.createElement('span');
  sep.className = 'gv2-bar-sep';
  const vidBtn = document.createElement('button');
  vidBtn.className   = 'gv2-audio-btn gv2-video-rec';
  vidBtn.title       = 'Screen record (max 1:30)';
  vidBtn.textContent = '📹';
  vidBtn.onclick     = startVideoRecording;
  bar.appendChild(sep);
  bar.appendChild(vidBtn);
}


function renderAudioBar() {
  const bar = document.getElementById('gv2-audio-bar');
  if (!bar) return;

  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  if (!imgUrl) { bar.style.display = 'none'; return; }

  bar.style.display = 'flex';
  const audioUrl    = getAudioForImage(imgUrl, state.gallery.date || '');
  const isRecording = _audioRecorder && _audioRecorder.state === 'recording';

  bar.innerHTML = '';


  // ── Recording audio ──────────────────────────────────────────────────────
  if (isRecording) {
    const dot    = document.createElement('span');
    dot.className = 'gv2-audio-dot';
    dot.textContent = '●';

    const timerEl = document.createElement('span');
    timerEl.className = 'gv2-audio-timer';
    timerEl.id        = 'gv2-audio-timer';
    timerEl.textContent = '00:00';

    const canvas   = _makeCanvas(200, 38);
    canvas.id      = 'gv2-audio-wave';
    _drawRecordingWave(canvas, _audioTimerSec);

    const stopBtn = document.createElement('button');
    stopBtn.className   = 'gv2-audio-btn gv2-audio-stop';
    stopBtn.textContent = '⏹ Stop';
    stopBtn.onclick     = stopAudioRecording;

    bar.appendChild(dot);
    bar.appendChild(timerEl);
    bar.appendChild(canvas);
    bar.appendChild(stopBtn);

  // ── Has audio: playback ──────────────────────────────────────────────────
  } else if (audioUrl) {

    const playBtn = document.createElement('button');
    playBtn.className   = 'gv2-audio-btn gv2-audio-play';
    playBtn.textContent = _isPlaying ? '⏸' : '▶';
    playBtn.onclick = () => {
      if (_isPlaying) {
        const pausedAt = _getCurrentPlaybackTime();
        _stopSource();
        _startOffset = pausedAt;
        _syncPlayBtn(false);
        const wc = document.getElementById('gv2-audio-wave');
        if (wc && wc._waveData) {
          const prog = wc._waveData.duration > 0 ? pausedAt / wc._waveData.duration : 0;
          _drawWaveform(wc, wc._waveData.peaks, prog);
        }
      } else {
        const wc = document.getElementById('gv2-audio-wave');
        if (wc && wc._waveData) {
          const resumeFrom = Math.min(_startOffset, wc._waveData.duration - 0.01);
          _playFromOffset(wc._waveData, resumeFrom, wc);
        }
      }
    };

    const canvas   = _makeCanvas(240, 38);
    canvas.id      = 'gv2-audio-wave';

    const timeEl   = document.createElement('span');
    timeEl.className    = 'gv2-audio-time';
    timeEl.id           = 'gv2-audio-time';
    timeEl.textContent  = '–';

    const replaceBtn = document.createElement('button');
    replaceBtn.className   = 'gv2-audio-btn';
    replaceBtn.title       = 'Re-record audio';
    replaceBtn.textContent = '⏺';
    replaceBtn.onclick     = startAudioRecording;

    const delBtn = document.createElement('button');
    delBtn.className   = 'gv2-audio-btn gv2-audio-del';
    delBtn.title       = 'Delete audio';
    delBtn.textContent = '🗑';
    delBtn.onclick     = _deleteAudio;

    bar.appendChild(playBtn);
    bar.appendChild(canvas);
    bar.appendChild(timeEl);
    bar.appendChild(replaceBtn);
    bar.appendChild(delBtn);
    _appendVideoRecBtn(bar, imgUrl);   // ← video rec always visible

    _decodeAudio(audioUrl).then(waveData => {
      if (!waveData) return;
      canvas._waveData = waveData;
      const prog = _isPlaying
        ? Math.min(1, _getCurrentPlaybackTime() / waveData.duration)
        : Math.min(1, _startOffset / waveData.duration);
      _drawWaveform(canvas, waveData.peaks, prog);
      timeEl.textContent = `${_fmtTime(_isPlaying ? _getCurrentPlaybackTime() : _startOffset)} / ${_fmtTime(waveData.duration)}`;
      if (_isPlaying) _startPlayheadLoop(canvas, waveData);
      _bindScrub(canvas, waveData);
    }).catch(err => console.warn('Waveform decode failed:', err));

  // ── Empty: Handled by tray dropdown ── 
  } else {
    bar.style.display = 'none';
  }
}

// ── Recording ─────────────────────────────────────────────────────────────

async function startAudioRecording() {
  _stopSource();
  _startOffset = 0;
  if (_audioRecorder && _audioRecorder.state !== 'inactive') {
    _audioRecorder.stop();
    await new Promise(r => setTimeout(r, 200));
  }

  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (err) { alert('Microphone access denied: ' + err.message); return; }

  _audioChunks  = [];
  _audioRecorder = new MediaRecorder(stream);

  _audioRecorder.ondataavailable = e => { if (e.data.size > 0) _audioChunks.push(e.data); };

  _audioRecorder.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());
    clearInterval(_audioTimerInterval);
    _audioTimerSec = 0;

    const blob = new Blob(_audioChunks, { type: 'audio/webm' });
    _audioChunks = [];

    try {
      const result = await imageService.uploadAudio(blob);
      if (result && result.url) {
        const imgUrl   = (state.gallery.images || [])[state.gallery.currentIndex];
        const oldAudio = getAudioForImage(imgUrl, state.gallery.date || '');
        if (oldAudio) {
          _waveformCache.delete(oldAudio);
          imageService.deleteAudio(oldAudio).catch(() => {});
        }
        _startOffset = 0;
        setAudioForCurrentGalleryImage(result.url);
        await saveTrades();
      }
    } catch (err) {
      console.error('Audio upload failed', err);
      alert('Audio upload failed: ' + err.message);
    }
    renderAudioBar();
    if (typeof updateRecordingUISync === 'function') updateRecordingUISync();
  };

  _audioRecorder.start(100);
  _audioTimerSec = 0;

  _audioTimerInterval = setInterval(() => {
    _audioTimerSec++;
    const el = document.getElementById('gv2-audio-timer');
    if (el) {
      const m = Math.floor(_audioTimerSec / 60).toString().padStart(2, '0');
      const s = (_audioTimerSec % 60).toString().padStart(2, '0');
      el.textContent = `${m}:${s}`;
    }
    const wc = document.getElementById('gv2-audio-wave');
    if (wc) _drawRecordingWave(wc, _audioTimerSec);
    if (_audioTimerSec >= 60) stopAudioRecording();
  }, 1000);

  renderAudioBar();
  if (typeof updateRecordingUISync === 'function') updateRecordingUISync();
}

function stopAudioRecording() {
  if (_audioRecorder && _audioRecorder.state !== 'inactive') _audioRecorder.stop();
  clearInterval(_audioTimerInterval);
  if (typeof updateRecordingUISync === 'function') updateRecordingUISync();
}

// ── Delete ────────────────────────────────────────────────────────────────

async function _deleteAudio() {
  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  if (!imgUrl) return;
  const audioUrl = getAudioForImage(imgUrl, state.gallery.date || '');
  if (!audioUrl) return;
  _stopSource();
  _startOffset = 0;
  _waveformCache.delete(audioUrl);
  try { await imageService.deleteAudio(audioUrl); } catch (e) { console.error(e); }
  deleteAudioForCurrentGalleryImage();
  await saveTrades();
  renderAudioBar();
}

```

## File: `static/js/gallery-video.js`
```js
/**
 * @fileoverview gallery-video.js
 * @description Screen recording for gallery. On save, video is inserted as the
 * next item in the trade's images array — displayed inline like any image.
 * Cap: 90 seconds (1:30). Stored in static/uploads/video/.
 */

// ── Recording state ────────────────────────────────────────────────────────
let _videoRecorder      = null;
let _videoChunks        = [];
let _videoTimerInterval = null;
let _videoTimerSec      = 0;
let _videoStream        = null;
let _videoMicStream     = null;
let _videoActx          = null;

const VIDEO_MAX_SEC = 90;

// ── Helpers ────────────────────────────────────────────────────────────────
function _fmtVideoTime(sec) {
  return `${Math.floor(sec / 60).toString().padStart(2,'0')}:${(sec % 60).toString().padStart(2,'0')}`;
}

function _stopVideoStream() {
  if (_videoStream)    { _videoStream.getTracks().forEach(t => t.stop());    _videoStream    = null; }
  if (_videoMicStream) { _videoMicStream.getTracks().forEach(t => t.stop()); _videoMicStream = null; }
  if (_videoActx)      { _videoActx.close().catch(() => {}); _videoActx = null; }
}

function _updateVideoProgress(sec) {
  const fill = document.getElementById('gv2-video-progress-fill');
  if (fill) fill.style.width = Math.min(100, (sec / VIDEO_MAX_SEC) * 100) + '%';
  const el = document.getElementById('gv2-video-timer');
  if (el) el.textContent = _fmtVideoTime(sec) + ' / ' + _fmtVideoTime(VIDEO_MAX_SEC);
}

// ── renderVideoBar: only shown while recording ─────────────────────────────
// When a video exists it lives in the images array and is displayed by gallery-render.js
function renderVideoBar() {
  const bar = document.getElementById('gv2-video-bar');
  if (!bar) return;


  const isRecording = _videoRecorder && _videoRecorder.state === 'recording';
  if (!isRecording) { bar.style.display = 'none'; return; }

  bar.style.display = 'flex';
  bar.innerHTML = '';

  const dot = document.createElement('span');
  dot.className = 'gv2-video-dot';
  dot.textContent = '●';

  const timerEl = document.createElement('span');
  timerEl.className = 'gv2-video-timer';
  timerEl.id = 'gv2-video-timer';
  timerEl.textContent = _fmtVideoTime(_videoTimerSec) + ' / ' + _fmtVideoTime(VIDEO_MAX_SEC);

  const progressWrap = document.createElement('div');
  progressWrap.className = 'gv2-video-progress';
  const progressFill = document.createElement('div');
  progressFill.className = 'gv2-video-progress-fill';
  progressFill.id = 'gv2-video-progress-fill';
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
}

// ── Recording ──────────────────────────────────────────────────────────────
async function startVideoRecording() {
  if (_videoRecorder && _videoRecorder.state !== 'inactive') {
    _videoRecorder.stop();
    await new Promise(r => setTimeout(r, 200));
  }
  _stopVideoStream();

  let screenStream;
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15 } },
      audio: true
    });
  } catch (err) {
    if (err.name !== 'NotAllowedError') alert('Screen capture failed: ' + err.message);
    return;
  }

  let recordStream;
  try {
    _videoMicStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const actx = new AudioContext();
    _videoActx = actx;
    const dest = actx.createMediaStreamDestination();
    if (screenStream.getAudioTracks().length > 0)
      actx.createMediaStreamSource(screenStream).connect(dest);
    actx.createMediaStreamSource(_videoMicStream).connect(dest);
    recordStream = new MediaStream([...screenStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
  } catch (_) {
    recordStream = screenStream;
  }

  _videoStream   = screenStream;
  _videoChunks   = [];
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
        // Insert video URL right after the current image in the images array
        insertVideoAfterCurrentGalleryImage(result.url);
        await saveTrades();
      }
    } catch (err) {
      console.error('Video upload failed', err);
      alert('Video upload failed: ' + err.message);
    }
    renderVideoBar();
    if (typeof renderAudioBar === 'function') renderAudioBar();
    if (typeof renderGallery  === 'function') renderGallery();
    if (typeof updateRecordingUISync === 'function') updateRecordingUISync();
  };

  screenStream.getVideoTracks()[0].onended = () => stopVideoRecording();

  _videoRecorder.start(500);
  _videoTimerSec = 0;

  _videoTimerInterval = setInterval(() => {
    _videoTimerSec++;
    _updateVideoProgress(_videoTimerSec);
    if (_videoTimerSec >= VIDEO_MAX_SEC) stopVideoRecording();
  }, 1000);

  renderVideoBar();
  if (typeof updateRecordingUISync === 'function') updateRecordingUISync();
}

function stopVideoRecording() {
  if (_videoRecorder && _videoRecorder.state !== 'inactive') _videoRecorder.stop();
  clearInterval(_videoTimerInterval);
}

```

## File: `static/js/gallery-chart.js`
```js
/**
 * gallery-chart.js
 * Lightweight TradingView chart panel inside the gallery — opens when
 * clicking the chart icon on a trade card in the All-Trades panel.
 * Uses the same /api/whatif/ohlc-data endpoint as the What-If page.
 * All private identifiers are prefixed _gc_ to avoid conflicts.
 */

// ── State ────────────────────────────────────────────────────────
let _gc_chart      = null;
let _gc_series     = null;
let _gc_rawCandles = [];
let _gc_meta       = {};
let _gc_tf         = 1;
let _gc_lockCb     = null;

// ── Candle aggregation (identical to whatif-ui) ──────────────────
function _gc_aggregate(candles, tf) {
  if (tf <= 1) return candles;
  const buckets = {}, order = [];
  for (const c of candles) {
    const t = (c.time || (c.datetime || '').slice(11));
    const [hh, mm] = t.split(':').map(Number);
    const off  = hh * 60 + mm - (9 * 60 + 15);
    const bOff = Math.floor(off / tf) * tf;
    const bMin = 9 * 60 + 15 + bOff;
    const key  = `${String(Math.floor(bMin / 60)).padStart(2, '0')}:${String(bMin % 60).padStart(2, '0')}`;
    if (!buckets[key]) { buckets[key] = []; order.push(key); }
    buckets[key].push(c);
  }
  return order.map(key => {
    const sl = buckets[key];
    const dt = (sl[0].datetime || '').slice(0, 11);
    return {
      datetime: dt + key + ':00',
      time:     key + ':00',
      open:     sl[0].open,
      high:     Math.max(...sl.map(c => +c.high)),
      low:      Math.min(...sl.map(c => +c.low)),
      close:    sl[sl.length - 1].close,
      volume:   sl.reduce((s, c) => s + (+c.volume || 0), 0),
    };
  });
}

// ── Open chart modal ─────────────────────────────────────────────
async function openGalleryChart(symbol, date, entry, direction, entryTime, exitTime, actualExitPrice, actualExitTime) {
  if (typeof LightweightCharts === 'undefined') {
    alert('Chart library not loaded — refresh the page and try again.');
    return;
  }
  const modal = document.getElementById('gc-chart-modal');
  const title = document.getElementById('gc-chart-title');
  if (!modal || !title) return;

  title.textContent = `${symbol}  ·  ${date}  ·  Loading…`;
  modal.style.display = 'flex';

  // Stop click-through to gallery underneath
  modal.onclick = e => { if (e.target === modal) closeGalleryChart(); };

  _gc_tf = 1;
  document.querySelectorAll('.gc-tf-btn').forEach(b =>
    b.classList.toggle('gc-tf-active', +b.dataset.tf === 1));

  try {
    const r = await fetch(`/api/whatif/ohlc-data?symbol=${encodeURIComponent(symbol)}&date=${encodeURIComponent(date)}`);
    const d = await r.json();
    if (d.error) {
      title.textContent = `${symbol}  ·  ${date}  —  ${d.error}`;
      return;
    }
    _gc_rawCandles = d.candles;

    if (entry != null) {
      const isShort = (direction || '').toUpperCase() === 'SHORT';
      const sl  = parseFloat(document.getElementById('gc-sl-input').value)  || 15;
      const tgt = parseFloat(document.getElementById('gc-tgt-input').value) || 30;
      const slLevel  = isShort ? entry + sl  : entry - sl;
      const tgtLevel = isShort ? entry - tgt : entry + tgt;
      _gc_meta = { entry, slLevel, tgtLevel, entryTime: entryTime || '', exitTime: exitTime || '',
                   actualExitPrice: actualExitPrice || null, actualExitTime: actualExitTime || '',
                   direction: isShort ? 'SHORT' : 'LONG', symbol, date };
      title.textContent = `${symbol}  ·  ${date}  ·  Entry ${entry}  ·  ${isShort ? 'SHORT' : 'LONG'}  ·  SL ${sl}  ·  Tgt ${tgt}`;
      document.getElementById('gc-sim-bar').style.display = 'flex';
      document.getElementById('gc-sl-input').value  = sl;
      document.getElementById('gc-tgt-input').value = tgt;
    } else {
      _gc_meta = { symbol, date };
      title.textContent = `${symbol}  ·  ${date}`;
      document.getElementById('gc-sim-bar').style.display = 'none';
    }

    _gc_drawChart(_gc_aggregate(_gc_rawCandles, 1));
  } catch (e) {
    title.textContent = `${symbol}  ·  ${date}  —  Error: ${e.message}`;
  }
}

// ── Close chart modal ────────────────────────────────────────────
function closeGalleryChart() {
  const modal = document.getElementById('gc-chart-modal');
  if (modal) modal.style.display = 'none';
  if (_gc_lockCb && _gc_chart) {
    try { _gc_chart.timeScale().unsubscribeVisibleLogicalRangeChange(_gc_lockCb); } catch (_) {}
    _gc_lockCb = null;
  }
  if (_gc_chart) { _gc_chart.remove(); _gc_chart = null; }
  _gc_series = null;
  _gc_rawCandles = [];
  _gc_meta = {};
  const chk = document.getElementById('gc-lock-chk');
  if (chk) chk.checked = false;
}

// ── Draw / redraw chart ──────────────────────────────────────────
function _gc_drawChart(candles) {
  const container = document.getElementById('gc-chart-container');
  if (!container) return;

  if (_gc_chart) { _gc_chart.remove(); _gc_chart = null; }

  const labels = [];
  const data = candles.map((c, i) => {
    labels[i] = (c.datetime || c.time || '').slice(11, 16);
    return { time: i, open: +c.open, high: +c.high, low: +c.low, close: +c.close };
  }).filter(c => !isNaN(c.open));

  _gc_chart = LightweightCharts.createChart(container, {
    width:  container.clientWidth,
    height: 440,
    layout: { background: { color: '#131722' }, textColor: '#d1d4dc' },
    grid:   { vertLines: { color: '#1e2130' }, horzLines: { color: '#1e2130' } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: '#2a2a3e' },
    timeScale: {
      borderColor: '#2a2a3e', timeVisible: true, secondsVisible: false,
      tickMarkFormatter: i => labels[i] || '',
    },
    localization: { timeFormatter: i => labels[i] || '' },
  });

  if (_gc_lockCb && _gc_chart) {
    try { _gc_chart.timeScale().unsubscribeVisibleLogicalRangeChange(_gc_lockCb); } catch (_) {}
    _gc_lockCb = null;
  }

  const series = _gc_chart.addCandlestickSeries({
    upColor: '#26a69a', downColor: '#ef5350',
    borderUpColor: '#26a69a', borderDownColor: '#ef5350',
    wickUpColor: '#26a69a', wickDownColor: '#ef5350',
  });
  series.setData(data);
  _gc_series = series;

  const { entry, slLevel, tgtLevel, entryTime, exitTime, actualExitPrice, actualExitTime } = _gc_meta;

  if (entry != null)      series.createPriceLine({ price: entry,            color: '#5599ff', lineWidth: 2, lineStyle: LightweightCharts.LineStyle.Solid,  axisLabelVisible: true, title: 'Entry' });
  if (slLevel != null)    series.createPriceLine({ price: slLevel,          color: '#ff5555', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: 'SL' });
  if (tgtLevel != null)   series.createPriceLine({ price: tgtLevel,         color: '#44dd88', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: 'Target' });
  if (actualExitPrice > 0) series.createPriceLine({ price: actualExitPrice, color: '#ffaa33', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Solid,  axisLabelVisible: true, title: 'Exit' });

  const markers = [];
  if (entryTime) {
    const idx = labels.indexOf(entryTime);
    if (idx >= 0) markers.push({ time: idx, position: 'belowBar', color: '#5599ff', shape: 'arrowUp',   text: 'Entry' });
  }
  if (actualExitTime) {
    const idx = labels.indexOf(actualExitTime);
    if (idx >= 0) markers.push({ time: idx, position: 'aboveBar', color: '#ffaa33', shape: 'arrowDown', text: 'Exit' });
  }
  if (markers.length) series.setMarkers(markers.sort((a, b) => a.time - b.time));

  // Auto-zoom around trade window
  const entryIdx = entryTime ? labels.indexOf(entryTime) : -1;
  const exitIdx  = exitTime  ? labels.indexOf(exitTime)  : -1;
  if (entryIdx >= 0) {
    const pad  = 30;
    const from = Math.max(0, entryIdx - pad);
    const to   = Math.min(data.length - 1, (exitIdx >= 0 ? exitIdx : entryIdx) + pad);
    _gc_chart.timeScale().setVisibleLogicalRange({ from, to });
  } else {
    _gc_chart.timeScale().fitContent();
  }

  const chk = document.getElementById('gc-lock-chk');
  if (chk && chk.checked) setTimeout(_gc_applyLockRatio, 50);
}

// ── Timeframe switch ─────────────────────────────────────────────
function setGalleryChartTf(tf) {
  _gc_tf = tf;
  document.querySelectorAll('.gc-tf-btn').forEach(b =>
    b.classList.toggle('gc-tf-active', +b.dataset.tf === tf));
  if (_gc_rawCandles.length) _gc_drawChart(_gc_aggregate(_gc_rawCandles, tf));
}

// ── Re-run sim from chart modal ──────────────────────────────────
function gc_reSimChart() {
  if (_gc_meta.entry == null || !_gc_rawCandles.length) return;
  const sl  = parseFloat(document.getElementById('gc-sl-input').value)  || 15;
  const tgt = parseFloat(document.getElementById('gc-tgt-input').value) || 30;
  const isShort = _gc_meta.direction === 'SHORT';
  _gc_meta.slLevel  = isShort ? _gc_meta.entry + sl  : _gc_meta.entry - sl;
  _gc_meta.tgtLevel = isShort ? _gc_meta.entry - tgt : _gc_meta.entry + tgt;
  document.getElementById('gc-chart-title').textContent =
    `${_gc_meta.symbol}  ·  ${_gc_meta.date}  ·  Entry ${_gc_meta.entry}  ·  ${_gc_meta.direction}  ·  SL ${sl}  ·  Tgt ${tgt}`;
  _gc_drawChart(_gc_aggregate(_gc_rawCandles, _gc_tf));
}

// ── Lock price-to-bar ratio ──────────────────────────────────────
function _gc_applyLockRatio() {
  if (!_gc_chart || !_gc_series || !_gc_rawCandles.length) return;
  const ratio = parseFloat(document.getElementById('gc-lock-val')?.value) || 6;
  const range = _gc_chart.timeScale().getVisibleLogicalRange();
  if (!range) return;
  const barCount  = Math.max(1, range.to - range.from);
  const priceSpan = ratio * barCount;
  const agg = _gc_aggregate(_gc_rawCandles, _gc_tf);
  const f   = Math.max(0, Math.round(range.from));
  const t   = Math.min(agg.length - 1, Math.round(range.to));
  const vis = agg.slice(f, t + 1);
  if (!vis.length) return;
  const hi  = Math.max(...vis.map(c => +c.high));
  const lo  = Math.min(...vis.map(c => +c.low));
  const mid = (hi + lo) / 2;
  _gc_series.applyOptions({
    autoscaleInfoProvider: () => ({
      priceRange: { minValue: mid - priceSpan / 2, maxValue: mid + priceSpan / 2 },
      margins: { above: 0.05, below: 0.05 },
    }),
  });
}

function gc_setLockRatio(locked) {
  if (!_gc_chart) return;
  if (locked) {
    _gc_applyLockRatio();
    _gc_lockCb = _gc_applyLockRatio;
    _gc_chart.timeScale().subscribeVisibleLogicalRangeChange(_gc_lockCb);
  } else {
    if (_gc_lockCb) {
      _gc_chart.timeScale().unsubscribeVisibleLogicalRangeChange(_gc_lockCb);
      _gc_lockCb = null;
    }
    if (_gc_series) _gc_series.applyOptions({ autoscaleInfoProvider: undefined });
    if (_gc_chart)  _gc_chart.priceScale('right').applyOptions({ autoScale: true });
  }
}

// ── Keyboard: Escape closes chart or sync panel ──────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const syncPanel = document.getElementById('gc-sync-panel');
    if (syncPanel && syncPanel.style.display !== 'none') {
      gcCloseSyncPanel();
      e.stopImmediatePropagation();
      return;
    }
    const modal = document.getElementById('gc-chart-modal');
    if (modal && modal.style.display !== 'none') {
      closeGalleryChart();
      e.stopImmediatePropagation();
    }
  }
}, true);

// ── Sync All OHLC ────────────────────────────────────────────────
let _gc_syncEventSource = null;

// ── Dhan credentials helpers ─────────────────────────────────────
async function gcLoadDhanConfig() {
  try {
    const r = await fetch('/api/whatif/config');
    const d = await r.json();
    const label  = document.getElementById('gc-creds-summary-label');
    const status = document.getElementById('gc-creds-status');
    if (d.configured) {
      document.getElementById('gc-dhan-client-id').value   = d.client_id || '';
      document.getElementById('gc-dhan-token').placeholder = d.access_token_masked || '••••';
      const h = d.hours_ago;
      const stale = h != null && h >= 20;
      const age   = h == null ? '' : (h < 1 ? ' (just now)' : ` (${h}h ago)`);
      if (label)  label.textContent = `Dhan API Credentials — ✓ saved${age}${stale ? ' ⚠ update soon' : ''}`;
      if (status) { status.textContent = stale ? '⚠ Token may be expired' : '✓ Credentials saved'; status.style.color = stale ? '#fbbf24' : '#4ade80'; }
    } else {
      if (label) label.textContent = 'Dhan API Credentials — not configured';
      // Auto-open so user sees the form
      const details = document.getElementById('gc-creds-details');
      if (details) details.open = true;
    }
  } catch (_) {}
}

async function gcSaveDhanConfig() {
  const client_id    = (document.getElementById('gc-dhan-client-id').value || '').trim();
  const access_token = (document.getElementById('gc-dhan-token').value     || '').trim();
  const status = document.getElementById('gc-creds-status');
  if (!client_id || !access_token) {
    status.textContent = 'Both fields required'; status.style.color = '#f87171'; return;
  }
  try {
    const r = await fetch('/api/whatif/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id, access_token }),
    });
    const d = await r.json();
    if (d.ok) {
      status.textContent = '✓ Saved'; status.style.color = '#4ade80';
      document.getElementById('gc-dhan-token').value = '';
      document.getElementById('gc-dhan-token').placeholder = access_token.slice(0,6) + '••••' + access_token.slice(-4);
      const label = document.getElementById('gc-creds-summary-label');
      if (label) label.textContent = 'Dhan API Credentials — ✓ saved (just now)';
      // Collapse after save
      setTimeout(() => { const det = document.getElementById('gc-creds-details'); if (det) det.open = false; }, 800);
    } else {
      status.textContent = d.error || 'Error saving'; status.style.color = '#f87171';
    }
  } catch (e) {
    status.textContent = 'Error: ' + e.message; status.style.color = '#f87171';
  }
}

function gcOpenSyncPanel() {
  const panel = document.getElementById('gc-sync-panel');
  if (!panel) return;
  panel.style.display = 'flex';
  document.getElementById('gc-sync-log').innerHTML = '';
  document.getElementById('gc-sync-status').textContent = '';
  document.getElementById('gc-sync-btn').style.display = 'inline-block';
  document.getElementById('gc-sync-stop-btn').style.display = 'none';
  gcLoadDhanConfig();   // auto-load/show credential status
}

function gcCloseSyncPanel() {
  if (_gc_syncEventSource) { _gc_syncEventSource.close(); _gc_syncEventSource = null; }
  if (_gc_tradebookES)    { _gc_tradebookES.close();     _gc_tradebookES = null; }
  const panel = document.getElementById('gc-sync-panel');
  if (panel) panel.style.display = 'none';
}

let _gc_tradebookES = null;

async function gcImportAndSync() {
  const fileInput = document.getElementById('gc-tradebook-file');
  const statusEl  = document.getElementById('gc-tradebook-status');
  const btn       = document.getElementById('gc-tradebook-btn');
  const stopBtn   = document.getElementById('gc-tradebook-stop-btn');
  const log       = document.getElementById('gc-sync-log');

  if (!fileInput || !fileInput.files.length) {
    if (statusEl) statusEl.textContent = 'Please select a CSV file first.';
    return;
  }

  // Step 1: Upload & parse tradebook
  if (statusEl) { statusEl.textContent = 'Parsing tradebook CSV…'; statusEl.style.color = '#aaa'; }
  if (btn) btn.disabled = true;

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  let parsed;
  try {
    const r = await fetch('/api/whatif/import-tradebook', { method: 'POST', body: formData });
    parsed = await r.json();
  } catch (e) {
    if (statusEl) { statusEl.textContent = `Upload error: ${e.message}`; statusEl.style.color = '#ef9a9a'; }
    if (btn) btn.disabled = false;
    return;
  }

  if (!parsed.ok) {
    if (statusEl) { statusEl.textContent = parsed.error || 'Import failed.'; statusEl.style.color = '#ef9a9a'; }
    if (btn) btn.disabled = false;
    return;
  }

  if (statusEl) {
    statusEl.textContent = `Parsed ${parsed.imported} symbols, ${parsed.pairs} trade days — starting download…`;
    statusEl.style.color = '#81c784';
  }
  if (stopBtn) stopBtn.style.display = 'inline-block';

  // Step 2: Stream OHLC downloads — log into the existing sync log panel
  if (log) log.innerHTML = '';
  if (_gc_tradebookES) { _gc_tradebookES.close(); _gc_tradebookES = null; }

  _gc_tradebookES = new EventSource('/api/whatif/sync-tradebook-ohlc');

  function _tbLog(msg, ok) {
    if (!log) return;
    const line = document.createElement('div');
    line.style.cssText = `color:${ok === false ? '#ef9a9a' : (msg.includes('✓') ? '#81c784' : '#d1d4dc')};padding:1px 0;`;
    line.textContent = msg;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  _gc_tradebookES.onmessage = e => {
    try {
      const d = JSON.parse(e.data);
      _tbLog(d.msg, d.ok);
      if (d.done) {
        _gc_tradebookES.close(); _gc_tradebookES = null;
        if (stopBtn) stopBtn.style.display = 'none';
        if (btn) btn.disabled = false;
        if (statusEl) { statusEl.textContent = 'Sync complete!'; statusEl.style.color = '#81c784'; }
      }
    } catch (_) {}
  };

  _gc_tradebookES.onerror = () => {
    _gc_tradebookES.close(); _gc_tradebookES = null;
    if (stopBtn) stopBtn.style.display = 'none';
    if (btn) btn.disabled = false;
    _tbLog('Connection lost — sync may have finished.', false);
  };
}

function gcStopTradebookSync() {
  if (_gc_tradebookES) { _gc_tradebookES.close(); _gc_tradebookES = null; }
  const stopBtn = document.getElementById('gc-tradebook-stop-btn');
  const btn     = document.getElementById('gc-tradebook-btn');
  if (stopBtn) stopBtn.style.display = 'none';
  if (btn) btn.disabled = false;
  const statusEl = document.getElementById('gc-tradebook-status');
  if (statusEl) statusEl.textContent = 'Stopped.';
}

function gcStartSync() {
  const log    = document.getElementById('gc-sync-log');
  const status = document.getElementById('gc-sync-status');
  const startBtn = document.getElementById('gc-sync-btn');
  const stopBtn  = document.getElementById('gc-sync-stop-btn');

  if (_gc_syncEventSource) { _gc_syncEventSource.close(); _gc_syncEventSource = null; }
  log.innerHTML = '';
  status.textContent = 'Connecting…';
  status.style.color = '#aaa';
  startBtn.style.display = 'none';
  stopBtn.style.display  = 'inline-block';

  _gc_syncEventSource = new EventSource('/api/whatif/sync-all-ohlc');

  _gc_syncEventSource.onmessage = e => {
    let d;
    try { d = JSON.parse(e.data); } catch (_) { return; }

    const line = document.createElement('div');
    line.style.cssText = `font-size:0.8rem; padding:1px 0; color:${d.ok === false ? '#f87171' : '#d1d4dc'};`;
    line.textContent = d.msg;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;

    if (d.done) {
      status.textContent = d.msg;
      status.style.color = d.ok === false ? '#f87171' : '#4ade80';
      _gc_syncEventSource.close();
      _gc_syncEventSource = null;
      startBtn.style.display = 'inline-block';
      startBtn.textContent   = '↺ Run Again';
      stopBtn.style.display  = 'none';
    }
  };

  _gc_syncEventSource.onerror = () => {
    status.textContent = 'Connection error — server may have closed the stream.';
    status.style.color = '#fbbf24';
    _gc_syncEventSource.close();
    _gc_syncEventSource = null;
    startBtn.style.display = 'inline-block';
    stopBtn.style.display  = 'none';
  };
}

function gcStopSync() {
  if (_gc_syncEventSource) { _gc_syncEventSource.close(); _gc_syncEventSource = null; }
  const status   = document.getElementById('gc-sync-status');
  const startBtn = document.getElementById('gc-sync-btn');
  const stopBtn  = document.getElementById('gc-sync-stop-btn');
  status.textContent = 'Stopped by user.';
  status.style.color = '#fbbf24';
  startBtn.style.display = 'inline-block';
  startBtn.textContent   = '▶ Start Sync';
  stopBtn.style.display  = 'none';
}

```
