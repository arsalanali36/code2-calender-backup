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

  // ── Empty: both rec buttons ──────────────────────────────────────────────
  } else {
    const label = document.createElement('span');
    label.className   = 'gv2-audio-label';
    label.textContent = 'Record:';

    const recBtn = document.createElement('button');
    recBtn.className   = 'gv2-audio-btn gv2-audio-rec';
    recBtn.title       = 'Record audio (max 1 min)';
    recBtn.textContent = '⏺ Audio';
    recBtn.onclick     = startAudioRecording;

    bar.appendChild(label);
    bar.appendChild(recBtn);
    _appendVideoRecBtn(bar, imgUrl);   // ← video rec always visible
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
}

function stopAudioRecording() {
  if (_audioRecorder && _audioRecorder.state !== 'inactive') _audioRecorder.stop();
  clearInterval(_audioTimerInterval);
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
