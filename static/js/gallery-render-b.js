/**
 * @fileoverview gallery-render-b.js
 * @description Video blob cache and adjacent-video preloader for the gallery.
 *   Extracted from gallery-render.js to keep that file under 30 KB.
 * @exports _cacheVideo, _preloadAdjacentVideos, _videoBlobCache, _VIDEO_CACHE_MAX
 */

// ── Video blob cache ─────────────────────────────────────────────────────────
// Stores server URL → blob URL so each video is only downloaded once per session.
const _videoBlobCache = new Map();
const _VIDEO_CACHE_MAX = 8; // keep last N videos in memory

async function _cacheVideo(serverUrl) {
  if (_videoBlobCache.has(serverUrl)) return _videoBlobCache.get(serverUrl);
  try {
    const resp = await fetch(serverUrl);
    if (!resp.ok) return serverUrl;
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    // Evict oldest entry if over limit
    if (_videoBlobCache.size >= _VIDEO_CACHE_MAX) {
      const oldest = _videoBlobCache.keys().next().value;
      URL.revokeObjectURL(_videoBlobCache.get(oldest));
      _videoBlobCache.delete(oldest);
    }
    _videoBlobCache.set(serverUrl, blobUrl);
    return blobUrl;
  } catch { return serverUrl; }
}

function _preloadAdjacentVideos() {
  const { images, currentIndex } = state.gallery;
  if (!images) return;
  [-1, 1].forEach(d => {
    const url = images[currentIndex + d];
    if (url && typeof isVideoUrl === 'function' && isVideoUrl(url)) {
      const resolved = resolveImageUrl(url);
      if (!_videoBlobCache.has(resolved)) _cacheVideo(resolved);
    }
  });
}
