import { Trade, TradeSession, TradeType, BlogPost } from '../types';

// Empty string = relative URLs (works when served from Flask at /mobile/)
// Set VITE_API_URL in .env.local only if running tradefeed standalone
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

// Groups whose tags count as emotions
const EMOTION_GROUPS = ['emotions', 'emotion'];
// Groups whose tags count as mistakes
const MISTAKE_GROUPS = ['entry type', 'exit type', 'mistakes', 'mistake'];

function buildTagSets(tagGroups: Record<string, string[]>) {
  const emotionSet = new Set<string>();
  const mistakeSet = new Set<string>();
  for (const [grp, tags] of Object.entries(tagGroups)) {
    const key = grp.toLowerCase();
    if (EMOTION_GROUPS.some(g => key.includes(g))) tags.forEach(t => emotionSet.add(t));
    else if (MISTAKE_GROUPS.some(g => key.includes(g))) tags.forEach(t => mistakeSet.add(t));
  }
  return { emotionSet, mistakeSet };
}

// Map Flask trade fields → mobile Trade interface
function mapTrade(raw: Record<string, unknown>, index: number, emotionSet: Set<string>, mistakeSet: Set<string>): Trade {
  const instrument = (raw['Instrument'] as string) || '';
  const tradeType  = (raw['TradeType'] as string || '').toLowerCase();
  const rawPnl = raw['Net P/L'];
  const rawGross = raw['Gross P/L'];
  const pnl = typeof rawPnl === 'number' ? rawPnl : (typeof rawGross === 'number' ? rawGross : 0);
  const date       = (raw['trade_date'] as string) || (raw['date'] as string) || '';
  const note       = (raw['Note'] as string) || '';
  const qty        = (raw['Qty'] as number) || 0;

  const resolveUrl = (url: string) =>
    url.startsWith('http') ? url : `${BASE_URL}/${url.replace(/^\//, '')}`;

  // Images: prepend base URL for relative paths
  const rawImages = (raw['images'] as string[]) || [];
  const chartUrls = rawImages.map(resolveUrl);

  // Audios: resolve both key (img URL) and value (audio URL)
  const rawAudios = (raw['audios'] as Record<string, string>) || {};
  const audios: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawAudios)) audios[resolveUrl(k)] = resolveUrl(v);

  // Tags: categorise by tagGroups
  const allTags = (raw['Tags'] as string[]) || (raw['tags'] as string[]) || [];
  const emotionTags:  string[] = allTags.filter(t => emotionSet.has(t));
  const mistakeTags:  string[] = allTags.filter(t => mistakeSet.has(t));
  const strategyTags: string[] = allTags.filter(t => !emotionSet.has(t) && !mistakeSet.has(t));

  // Session from buy time
  const buyTime = (raw['Buy Time'] as string) || '';
  let session: TradeSession = 'Morning';
  if (buyTime) {
    const hour = parseInt(buyTime.split(':')[0], 10);
    if (hour >= 12 && hour < 15) session = 'Afternoon';
    else if (hour >= 15) session = 'Evening';
  }

  const type: TradeType = tradeType === 'buy' ? 'Long' : 'Short';

  return {
    id: (raw['id'] as string) || String(index),
    instrument,
    type,
    pnl,
    currency: '₹',
    date,
    session,
    chartUrls,
    audios,
    emotionTags,
    strategyTags,
    mistakeTags,
    note,
    stats: {
      rMultiple: 0,
      riskReward: '',
      positionSize: qty,
    },
  };
}

export async function fetchTrades(): Promise<Trade[]> {
  const res = await fetch(`${BASE_URL}/api/trades`, { credentials: 'include' });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  const data = await res.json();
  const trades: Record<string, unknown>[] = data.trades || [];
  const tagGroups: Record<string, string[]> = data.tagGroups || {};
  const dayData: Record<string, Record<string, unknown>> = data.dayData || {};
  const { emotionSet, mistakeSet } = buildTagSets(tagGroups);

  const tradeMapped = trades
    .filter(t => !!(t['trade_date'] || t['date']))
    .map((t, i) => {
      const mapped = mapTrade(t, i, emotionSet, mistakeSet);
      // Also include any dayData images for this date that aren't already in chartUrls
      const dayImgs = (dayData[mapped.date]?.images as string[]) || [];
      const extraUrls = dayImgs
        .map(img => img.startsWith('http') ? img : `${BASE_URL}/${img.replace(/^\//, '')}`)
        .filter(url => !mapped.chartUrls.includes(url));
      if (extraUrls.length > 0) return { ...mapped, chartUrls: [...mapped.chartUrls, ...extraUrls] };
      return mapped;
    });

  // Add dayData entries that have images but no matching trade
  const tradeDates = new Set(tradeMapped.map(t => t.date));
  const dayOnlyEntries: Trade[] = Object.entries(dayData)
    .filter(([date, day]) => !tradeDates.has(date) && Array.isArray((day as any).images) && (day as any).images.length > 0)
    .map(([date, day], i) => ({
      id: `day-${date}-${i}`,
      instrument: 'Day Note',
      type: 'Long' as const,
      pnl: 0,
      currency: '₹',
      date,
      session: 'Morning' as const,
      chartUrls: ((day as any).images as string[]).map((img: string) =>
        img.startsWith('http') ? img : `${BASE_URL}/${img.replace(/^\//, '')}`
      ),
      emotionTags: [],
      strategyTags: [],
      mistakeTags: [],
      note: (day as any).obs || '',
      stats: { rMultiple: 0, riskReward: '', positionSize: 0 },
    }));

  // Add close entries from dayData.closeImages — appear as the last tab (C) in each day's card
  const closeEntries: Trade[] = Object.entries(dayData)
    .filter(([, day]) => Array.isArray((day as any).closeImages) && (day as any).closeImages.length > 0)
    .map(([date, day]) => ({
      id: `close-${date}`,
      instrument: 'Close',
      type: 'Long' as const,
      pnl: 0,
      currency: '₹',
      date,
      session: 'Morning' as const,
      chartUrls: ((day as any).closeImages as string[]).map((img: string) =>
        img.startsWith('http') ? img : `${BASE_URL}/${img.replace(/^\//, '')}`
      ),
      isClose: true,
      emotionTags: [],
      strategyTags: [],
      mistakeTags: [],
      note: '',
      stats: { rMultiple: 0, riskReward: '', positionSize: 0 },
    }));

  return [...tradeMapped, ...dayOnlyEntries, ...closeEntries];
}

export async function fetchBlogPosts(): Promise<BlogPost[]> {
  const res = await fetch(`${BASE_URL}/api/blog-posts`);
  if (!res.ok) throw new Error(`Blog API error: ${res.status}`);
  return res.json();
}
