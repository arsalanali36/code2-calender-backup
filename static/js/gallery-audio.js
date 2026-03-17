/**
 * @fileoverview gallery-audio.js
 * @description Per-image audio: record (max 1 min), waveform display, scrub, play, delete, replace.
 *
 * KEY ISSUE HANDLED: MediaRecorder WebM files have duration=Infinity in <audio> elements.
 * We get the real duration from AudioContext.decodeAudioData and use it for all seeks.
 */

let _audioRecorder = null;
let _audioChunks = [];
let _audioTimerInterval = null;
let _audioTimerSec = 0;

let _audioEl = null;       // single <audio> element, reused across play/pause
let _audioElUrl = '';
let _playheadRaf = null;

const _waveformCache = new Map();  // url → { peaks: Float32Array, duration: number }

// ── Decode audio → peaks + real duration ──────────────────────────────────

async function _decodeAudio(url) {
  if (_waveformCache.has(url)) return _waveformCache.get(url);

  const resp = await fetch(url);
  const buf = await resp.arrayBuffer();
  const actx = new AudioContext();
  let decoded;
  try {
    decoded = await actx.decodeAudioData(buf);
  } catch (e) {
    await actx.close();
    return null;
  }
  await actx.close();

  const data = decoded.getChannelData(0);
  const numBars = 60; // fixed bar count
  const blockSize = Math.max(1, Math.floor(data.length / numBars));
  const peaks = new Float32Array(numBars);
  for (let i = 0; i < numBars; i++) {
    let max = 0;
    const start = i * blockSize;
    for (let j = 0; j < blockSize; j++) {
      const v = Math.abs(data[start + j] || 0);
      if (v > max) max = v;
    }
    peaks[i] = max;
  }

  const result = { peaks, duration: decoded.duration };
  _waveformCache.set(url, result);
  return result;
}

// ── Audio element — single instance, reused across play/pause ─────────────

function _ensureAudioEl(url) {
  if (_audioEl && _audioElUrl === url) return _audioEl;
  if (_audioEl) { _audioEl.pause(); _audioEl.src = ''; }
  _audioEl = new Audio(url);
  _audioEl.preload = 'auto';
  _audioElUrl = url;
  return _audioEl;
}

function _destroyAudioEl() {
  cancelAnimationFrame(_playheadRaf);
  if (_audioEl) { _audioEl.pause(); _audioEl.src = ''; _audioEl = null; }
  _audioElUrl = '';
}

// ── Canvas helpers ─────────────────────────────────────────────────────────

function _makeCanvas(cssW, cssH) {
  const dpr = window.devicePixelRatio || 1;
  const c = document.createElement('canvas');
  c.width = Math.round(cssW * dpr);
  c.height = Math.round(cssH * dpr);
  c.style.width = cssW + 'px';
  c.style.height = cssH + 'px';
  c.style.cursor = 'ew-resize';
  c.style.borderRadius = '4px';
  c.style.flexShrink = '0';
  return c;
}

function _drawWaveform(canvas, peaks, progress) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.width / dpr;
  const H = canvas.height / dpr;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!peaks || !peaks.length) return;

  ctx.save();
  ctx.scale(dpr, dpr);

  const n = peaks.length;
  const barW = W / n;
  const playedIdx = Math.floor(progress * n);

  for (let i = 0; i < n; i++) {
    const h = Math.max(2, peaks[i] * H * 0.88);
    const y = (H - h) / 2;
    ctx.fillStyle = i < playedIdx ? '#9580ff' : '#3b3b5c';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(i * barW + 0.5, y, Math.max(1, barW - 1.5), h, 1);
    } else {
      ctx.rect(i * barW + 0.5, y, Math.max(1, barW - 1.5), h);
    }
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
  const W = canvas.width / dpr;
  const H = canvas.height / dpr;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);
  const n = Math.floor(W / 4);
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
    if (!_audioEl || _audioEl.paused) return;
    const cur = _audioEl.currentTime;
    const dur = waveData.duration; // use decoded duration, not el.duration
    _drawWaveform(canvas, waveData.peaks, dur > 0 ? cur / dur : 0);
    const timeEl = document.getElementById('gv2-audio-time');
    if (timeEl) timeEl.textContent = `${_fmtTime(cur)} / ${_fmtTime(dur)}`;
    _playheadRaf = requestAnimationFrame(frame);
  }
  _playheadRaf = requestAnimationFrame(frame);
}

// ── Seek + play from fraction ──────────────────────────────────────────────
// Uses decoded duration (reliable) instead of el.duration (often Infinity for WebM)

function _seekAndPlay(url, frac, canvas, waveData) {
  const targetTime = frac * waveData.duration;
  const el = _ensureAudioEl(url);

  const doIt = () => {
    el.currentTime = targetTime;
    if (el.paused) {
      el.play().catch(err => console.warn('Audio play failed:', err));
      _startPlayheadLoop(canvas, waveData);
      _syncPlayBtn(true);
    }
    // Update time display immediately
    const timeEl = document.getElementById('gv2-audio-time');
    if (timeEl) timeEl.textContent = `${_fmtTime(targetTime)} / ${_fmtTime(waveData.duration)}`;
    // Draw waveform at new position immediately
    _drawWaveform(canvas, waveData.peaks, frac);
  };

  // readyState 0 = HAVE_NOTHING, need to wait for metadata
  if (el.readyState === 0) {
    el.addEventListener('canplay', doIt, { once: true });
  } else {
    doIt();
  }
}

function _syncPlayBtn(playing) {
  const btn = document.querySelector('#gv2-audio-bar .gv2-audio-play');
  if (btn) btn.textContent = playing ? '⏸' : '▶';
}

// ── Bind scrub events on canvas ────────────────────────────────────────────

function _bindScrub(canvas, url, waveData) {
  let dragging = false;

  const getFrac = (clientX) => {
    const rect = canvas.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const onDown = (clientX) => {
    dragging = true;
    const frac = getFrac(clientX);
    // Immediate visual feedback
    _drawWaveform(canvas, waveData.peaks, frac);
    _seekAndPlay(url, frac, canvas, waveData);
  };

  const onMove = (clientX) => {
    if (!dragging) return;
    const frac = getFrac(clientX);
    _drawWaveform(canvas, waveData.peaks, frac);
    // Seek during drag (only if audio is playing/loaded)
    const el = _audioEl;
    if (el && el.readyState > 0) {
      el.currentTime = frac * waveData.duration;
      const timeEl = document.getElementById('gv2-audio-time');
      if (timeEl) timeEl.textContent = `${_fmtTime(frac * waveData.duration)} / ${_fmtTime(waveData.duration)}`;
    }
  };

  const onUp = () => { dragging = false; };

  canvas.addEventListener('mousedown', e => { onDown(e.clientX); e.preventDefault(); });
  canvas.addEventListener('mousemove', e => { onMove(e.clientX); });
  document.addEventListener('mouseup', onUp);

  canvas.addEventListener('touchstart', e => { onDown(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchmove', e => { onMove(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
  document.addEventListener('touchend', onUp);
}

// ── Render audio bar ───────────────────────────────────────────────────────

function renderAudioBar() {
  const bar = document.getElementById('gv2-audio-bar');
  if (!bar) return;

  const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
  if (!imgUrl) { bar.style.display = 'none'; return; }

  bar.style.display = 'flex';
  const audioUrl = getAudioForImage(imgUrl, state.gallery.date || '');
  const isRecording = _audioRecorder && _audioRecorder.state === 'recording';

  bar.innerHTML = '';

  if (isRecording) {
    // ── Recording state ──
    const dot = document.createElement('span');
    dot.className = 'gv2-audio-dot';
    dot.textContent = '●';

    const timerEl = document.createElement('span');
    timerEl.className = 'gv2-audio-timer';
    timerEl.id = 'gv2-audio-timer';
    timerEl.textContent = '00:00';

    const canvas = _makeCanvas(200, 38);
    canvas.id = 'gv2-audio-wave';
    _drawRecordingWave(canvas, _audioTimerSec);

    const stopBtn = document.createElement('button');
    stopBtn.className = 'gv2-audio-btn gv2-audio-stop';
    stopBtn.textContent = '⏹ Stop';
    stopBtn.onclick = stopAudioRecording;

    bar.appendChild(dot);
    bar.appendChild(timerEl);
    bar.appendChild(canvas);
    bar.appendChild(stopBtn);

  } else if (audioUrl) {
    // ── Playback state ──
    const isPlaying = _audioEl && _audioElUrl === audioUrl && !_audioEl.paused;

    const playBtn = document.createElement('button');
    playBtn.className = 'gv2-audio-btn gv2-audio-play';
    playBtn.textContent = isPlaying ? '⏸' : '▶';
    playBtn.onclick = () => {
      const el = _ensureAudioEl(audioUrl);
      if (el.paused) {
        el.play().catch(() => {});
        const wc = document.getElementById('gv2-audio-wave');
        if (wc && wc._waveData) _startPlayheadLoop(wc, wc._waveData);
        _syncPlayBtn(true);
      } else {
        el.pause();
        cancelAnimationFrame(_playheadRaf);
        _syncPlayBtn(false);
      }
    };

    const canvas = _makeCanvas(240, 38);
    canvas.id = 'gv2-audio-wave';

    const timeEl = document.createElement('span');
    timeEl.className = 'gv2-audio-time';
    timeEl.id = 'gv2-audio-time';
    timeEl.textContent = '–';

    const replaceBtn = document.createElement('button');
    replaceBtn.className = 'gv2-audio-btn';
    replaceBtn.title = 'Re-record';
    replaceBtn.textContent = '⏺';
    replaceBtn.onclick = startAudioRecording;

    const delBtn = document.createElement('button');
    delBtn.className = 'gv2-audio-btn gv2-audio-del';
    delBtn.title = 'Delete';
    delBtn.textContent = '🗑';
    delBtn.onclick = _deleteAudio;

    bar.appendChild(playBtn);
    bar.appendChild(canvas);
    bar.appendChild(timeEl);
    bar.appendChild(replaceBtn);
    bar.appendChild(delBtn);

    // Pre-load audio element immediately (so 'canplay' fires before first click)
    const el = _ensureAudioEl(audioUrl);
    el.onended = () => { cancelAnimationFrame(_playheadRaf); renderAudioBar(); };

    // Decode waveform, then wire up everything
    _decodeAudio(audioUrl).then(waveData => {
      if (!waveData) return;

      // Store on canvas so playBtn can access it
      canvas._waveData = waveData;

      // Draw initial state
      const cur = (el && isFinite(el.currentTime)) ? el.currentTime : 0;
      const prog = waveData.duration > 0 ? cur / waveData.duration : 0;
      _drawWaveform(canvas, waveData.peaks, prog);

      // Show duration
      timeEl.textContent = `${_fmtTime(cur)} / ${_fmtTime(waveData.duration)}`;

      // Resume playhead loop if still playing
      if (!el.paused) _startPlayheadLoop(canvas, waveData);

      // Bind scrub
      _bindScrub(canvas, audioUrl, waveData);
    }).catch(err => console.warn('Waveform decode failed:', err));

  } else {
    // ── No audio ──
    const label = document.createElement('span');
    label.className = 'gv2-audio-label';
    label.textContent = 'Audio:';

    const recBtn = document.createElement('button');
    recBtn.className = 'gv2-audio-btn gv2-audio-rec';
    recBtn.title = 'Record (max 1 min)';
    recBtn.textContent = '⏺ Record';
    recBtn.onclick = startAudioRecording;

    bar.appendChild(label);
    bar.appendChild(recBtn);
  }
}

// ── Recording ─────────────────────────────────────────────────────────────

async function startAudioRecording() {
  _destroyAudioEl();
  if (_audioRecorder && _audioRecorder.state !== 'inactive') {
    _audioRecorder.stop();
    await new Promise(r => setTimeout(r, 200));
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    alert('Microphone access denied: ' + err.message);
    return;
  }

  _audioChunks = [];
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
        const imgUrl = (state.gallery.images || [])[state.gallery.currentIndex];
        const oldAudio = getAudioForImage(imgUrl, state.gallery.date || '');
        if (oldAudio) {
          _waveformCache.delete(oldAudio);
          imageService.deleteAudio(oldAudio).catch(() => {});
        }
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
  _destroyAudioEl();
  _waveformCache.delete(audioUrl);
  try { await imageService.deleteAudio(audioUrl); } catch (e) { console.error(e); }
  deleteAudioForCurrentGalleryImage();
  await saveTrades();
  renderAudioBar();
}
