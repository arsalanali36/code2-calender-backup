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
