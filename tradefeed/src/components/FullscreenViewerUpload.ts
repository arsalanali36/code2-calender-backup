import type { DayData } from './FullscreenViewerUtils';

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error';

const toRawUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http')) { try { return new URL(url).pathname; } catch { return url; } }
  return url;
};

export async function doUploadAndSave(params: {
  file: File;
  mode: 'replace' | 'addAfter';
  dayIdx: number;
  imgIdx: number;
  days: DayData[];
  isOpen: boolean;
  onUpdateDays?: (d: DayData[]) => void;
  onSetImgIdx: (n: number) => void;
  setStatus: (s: UploadStatus) => void;
}) {
  const { file, mode, dayIdx, imgIdx, days, isOpen, onUpdateDays, onSetImgIdx, setStatus } = params;
  if (!isOpen) return;
  const currentImg = days[dayIdx]?.images[imgIdx];
  if (!currentImg) return;
  setStatus('uploading');
  try {
    const BASE = (import.meta as any).env?.VITE_API_URL ?? '';
    const fd = new FormData();
    fd.append('image', file);
    fd.append('original_filename', file.name || 'image.png');
    const upRes = await fetch(`${BASE}/api/upload-image`, { method: 'POST', body: fd, credentials: 'include' });
    if (!upRes.ok) throw new Error('upload failed');
    const { url: newRelUrl } = await upRes.json();
    if (!newRelUrl) throw new Error('no url');

    const rawRes = await fetch(`${BASE}/api/trades`, { credentials: 'include' });
    if (!rawRes.ok) throw new Error('fetch failed');
    const rawData = await rawRes.json();

    const currentRaw = toRawUrl(currentImg);
    let done = false;
    const applyChange = (images: string[]) => {
      const i = images.findIndex(u => u === currentRaw || toRawUrl(u) === currentRaw);
      if (i < 0) return false;
      if (mode === 'replace') images.splice(i, 1, newRelUrl);
      else images.splice(i + 1, 0, newRelUrl);
      return true;
    };
    for (const t of (rawData.trades || [])) {
      if (done) break;
      if (Array.isArray(t.images)) done = applyChange(t.images);
    }
    if (!done) {
      for (const dd of Object.values(rawData.dayData || {})) {
        if (done) break;
        if (Array.isArray((dd as any).images)) done = applyChange((dd as any).images);
      }
    }

    await fetch(`${BASE}/api/trades`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(rawData) });

    const newAbsUrl = newRelUrl.startsWith('http') ? newRelUrl : `${BASE}/${newRelUrl.replace(/^\//, '')}`;
    const newDays = days.map((d, di) => {
      if (di !== dayIdx) return d;
      const imgs = [...d.images];
      if (mode === 'replace') imgs.splice(imgIdx, 1, newAbsUrl);
      else imgs.splice(imgIdx + 1, 0, newAbsUrl);
      return { ...d, images: imgs };
    });
    onUpdateDays?.(newDays);
    if (mode === 'addAfter') onSetImgIdx(imgIdx + 1);
    setStatus('done');
    setTimeout(() => setStatus('idle'), 2500);
  } catch { setStatus('error'); setTimeout(() => setStatus('idle'), 2500); }
}
