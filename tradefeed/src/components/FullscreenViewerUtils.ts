export const fmt = (n: number) => Math.round(Math.abs(n)).toLocaleString('en-IN');

export function isVideoUrl(url: string): boolean {
  return /\.(webm|mp4|mov|avi)(\?|$)/i.test(url || '');
}

export function downloadViaProxy(imageUrl: string) {
  const BASE_URL = (import.meta as any).env?.VITE_API_URL ?? '';
  const proxyUrl = `${BASE_URL}/api/proxy-download?url=${encodeURIComponent(imageUrl)}`;
  const a = document.createElement('a');
  a.href = proxyUrl;
  a.download = imageUrl.split('?')[0].split('/').pop() || 'image.jpg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function copyImageToClipboard(imageUrl: string) {
  try {
    const BASE_URL = (import.meta as any).env?.VITE_API_URL ?? '';
    const proxyUrl = `${BASE_URL}/api/proxy-download?url=${encodeURIComponent(imageUrl)}`;
    const res = await fetch(proxyUrl, { credentials: 'include' });
    if (!res.ok) throw new Error('proxy failed');
    const blob = await res.blob();
    const imgBlob = new Blob([blob], { type: 'image/png' });
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': imgBlob })]);
  } catch {
    try { await navigator.clipboard.writeText(imageUrl); } catch (_) {}
  }
}

export interface DayData {
  date: string;
  images: string[];
  tradeNum?: number;
  pnl?: number;
  dayPnl?: number;
  isClose?: boolean;
  audios?: Record<string, string>;
  videos?: Record<string, string>;
  instrument?: string;
  tags?: string[];
  note?: string;
}

export interface FullscreenViewerProps {
  days: DayData[];
  initialDayIndex: number;
  initialImageIndex: number;
  isOpen: boolean;
  onClose: () => void;
  initialLocked?: boolean;
  onUpdateDays?: (newDays: DayData[]) => void;
}
