import { Trade, TradeSession, TradeType, BlogPost } from '../types';

const isProd = typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname) && !window.location.hostname.startsWith('192.168');
const defaultUrl = isProd ? 'https://code2-calender.onrender.com' : 'http://localhost:5000';
const BASE_URL = import.meta.env.VITE_API_URL || defaultUrl;

// ── Auth token helpers ────────────────────────────────────────────────────────
export const getToken  = () => localStorage.getItem('tf_token');
export const setToken  = (t: string) => localStorage.setItem('tf_token', t);
export const clearToken = () => localStorage.removeItem('tf_token');

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token
    ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export async function apiLogin(email: string, password: string): Promise<{ token: string; email: string }> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('Invalid credentials');
  return res.json();
}

export async function checkAuth(): Promise<{ email: string; id: number } | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) { clearToken(); return null; }
    return res.json();
  } catch {
    return null;
  }
}

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

  // Images: prepend base URL for relative paths
  const rawImages = (raw['images'] as string[]) || [];
  const chartUrls = rawImages.map(img =>
    img.startsWith('http') ? img : `${BASE_URL}/${img.replace(/^\//, '')}`
  );

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
  const res = await fetch(`${BASE_URL}/api/trades`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  const trades: Record<string, unknown>[] = data.trades || [];
  const tagGroups: Record<string, string[]> = data.tagGroups || {};
  const { emotionSet, mistakeSet } = buildTagSets(tagGroups);
  return trades
    .filter(t => typeof t['Net P/L'] === 'number' || typeof t['Gross P/L'] === 'number')
    .map((t, i) => mapTrade(t, i, emotionSet, mistakeSet));
}

export async function fetchBlogPosts(): Promise<BlogPost[]> {
  const res = await fetch(`${BASE_URL}/api/blog-posts`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Blog API error: ${res.status}`);
  return res.json();
}
