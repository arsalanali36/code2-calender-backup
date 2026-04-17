import { Trade, TradeSession, TradeType, BlogPost } from '../types';

// Empty string = relative URLs (works when served from Flask at /mobile/)
// Set VITE_API_URL in .env.local only if running tradefeed standalone
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

// Module-level URL resolver — keep at top so fetchTrades can use it too
export const resolveUrl = (url: string): string =>
  url.startsWith('http') ? url : `${BASE_URL}/${url.replace(/^\//, '')}`;

// Resolve all keys+values of a media map { imgUrl → mediaUrl }
function resolveAudios(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) out[resolveUrl(k)] = resolveUrl(v);
  return out;
}
const resolveVideos = resolveAudios; // same logic

// Inject old-style videos dict (imgUrl → videoUrl) into chartUrls array, after their associated image
function injectOldVideos(urls: string[], videosDict: Record<string, string>): string[] {
  const out = [...urls];
  Object.entries(videosDict).forEach(([imgUrl, videoUrl]) => {
    if (!videoUrl) return;
    const rVideo = resolveUrl(videoUrl);
    if (out.includes(rVideo)) return; // already present (new-style)
    const rImg = resolveUrl(imgUrl);
    const idx = out.indexOf(rImg);
    if (idx >= 0) out.splice(idx + 1, 0, rVideo);
    else out.push(rVideo);
  });
  return out;
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

  // Images: prepend base URL for relative paths; inject old-style videos from trade.videos dict
  const rawImages = (raw['images'] as string[]) || [];
  const rawVideosDict = (raw['videos'] as Record<string, string>) || {};
  const chartUrls = injectOldVideos(rawImages.map(resolveUrl), resolveVideos(rawVideosDict));

  // Audios + Videos: resolve both key (img URL) and value (media URL)
  const audios  = resolveAudios((raw['audios']  as Record<string, string>) || {});
  const videos  = resolveVideos((raw['videos']  as Record<string, string>) || {});

  // Desktop parity: Scan ALL fields for arrays and treat them as tags
  const dynamicTags = new Set<string>();
  Object.entries(raw).forEach(([key, val]) => {
    // Skip internal fields and known non-tag fields
    if (['images', 'chartUrls', 'imageTags', 'marqueeBoxes', 'audios', 'videos', 'id', 'Note'].includes(key)) return;
    if (Array.isArray(val)) {
      val.forEach(v => { if (typeof v === 'string' && v.trim()) dynamicTags.add(v.trim()); });
    } else if (key.toLowerCase() === 'tags' && typeof val === 'string') {
      val.split(',').forEach(v => { if (v.trim()) dynamicTags.add(v.trim()); });
    }
  });
  const allTags = Array.from(dynamicTags);

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
    videos,
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

function getFilename(url: string): string {
  if (!url) return '';
  const parts = url.split('/');
  const last = parts[parts.length - 1] || '';
  return last.split('?')[0];
}

export async function fetchTrades(): Promise<{ trades: Trade[], tagGroups: Record<string, string[]>, tagFrequency: Record<string, number> }> {
  const res = await fetch(`${BASE_URL}/api/trades`, { credentials: 'include' });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  const data = await res.json();
  const trades: Record<string, unknown>[] = data.trades || [];
  const tagGroups: Record<string, string[]> = data.tagGroups || {};
  const dayData: Record<string, Record<string, unknown>> = data.dayData || {};
  const { emotionSet, mistakeSet } = buildTagSets(tagGroups);

  const globalFreq: Record<string, number> = {};

  const tradeMapped = trades
    .filter(t => !!(t['trade_date'] || t['date']))
    .map((t, i) => {
      const mapped = mapTrade(t, i, emotionSet, mistakeSet);
      
      // Count initial trade-level tags
      [...mapped.emotionTags, ...mapped.strategyTags, ...mapped.mistakeTags].forEach(tg => {
        globalFreq[tg] = (globalFreq[tg] ?? 0) + 1;
      });

      const dateKey = mapped.date;
      const day = dayData[dateKey] || {};

      const imageTagsMap = (day.imageTags as Record<string, string[]>) || {};
      const marqueeBoxes = (day.marqueeBoxes as Record<string, { tags: string[] }[]>) || {};
      const internalImageTags = (t.imageTags as Record<string, string[]>) || {};
      
      const extraTagsSet = new Set<string>();
      const resolvedImageTags: Record<string, string[]> = {};
      
      // Auto-tag instrument name as a base tag
      const inst = (t.Instrument || t.instrument || '').toUpperCase();
      if (inst.includes('BANKNIFTY') || inst.includes('BNF')) extraTagsSet.add('BNF');
      else if (inst.includes('NIFTY')) extraTagsSet.add('NIFTY');

      mapped.chartUrls.forEach(url => {
        const fname = getFilename(url);
        if (!fname) return;

        const imgTagsSet = new Set<string>();

        // 1. Image-level tags from day metadata
        for (const [key, tags] of Object.entries(imageTagsMap)) {
          if (getFilename(key) === fname) tags.forEach(tg => { 
            extraTagsSet.add(tg); 
            imgTagsSet.add(tg);
          });
        }
        // 2. Image-level tags stored INTERNAL to the trade
        for (const [key, tags] of Object.entries(internalImageTags)) {
          if (getFilename(key) === fname) tags.forEach(tg => { 
            extraTagsSet.add(tg); 
            imgTagsSet.add(tg);
          });
        }
        // 3. Marquee tags
        for (const [key, boxes] of Object.entries(marqueeBoxes)) {
          if (getFilename(key) === fname) boxes.forEach(box => box.tags?.forEach(tg => { 
            extraTagsSet.add(tg); 
            imgTagsSet.add(tg);
          }));
        }

        if (imgTagsSet.size > 0) {
          resolvedImageTags[url] = Array.from(imgTagsSet);
        }
      });

      const emotionExtra  = Array.from(extraTagsSet).filter(tg => emotionSet.has(tg) && !mapped.emotionTags.includes(tg));
      const mistakeExtra  = Array.from(extraTagsSet).filter(tg => mistakeSet.has(tg) && !mapped.mistakeTags.includes(tg));
      const strategyExtra = Array.from(extraTagsSet).filter(tg => !emotionSet.has(tg) && !mistakeSet.has(tg) && !mapped.strategyTags.includes(tg));

      const finalMapped: Trade = {
        ...mapped,
        emotionTags:  [...mapped.emotionTags, ...emotionExtra],
        mistakeTags:  [...mapped.mistakeTags, ...mistakeExtra],
        strategyTags: [...mapped.strategyTags, ...strategyExtra],
        imageTags: resolvedImageTags
      };

      // Count ALL tags globally for the filter sheet - COUNT PER IMAGE (Desktop Parity)
      const allTradeTags = [...finalMapped.emotionTags, ...finalMapped.mistakeTags, ...finalMapped.strategyTags];
      
      finalMapped.chartUrls.forEach(url => {
        // Collect tags for this specific image
        const imgTags = new Set(allTradeTags);
        (finalMapped.imageTags[url] || []).forEach(tg => imgTags.add(tg));
        
        imgTags.forEach(tg => {
          if (!tg) return;
          const norm = tg.trim();
          if (norm) globalFreq[norm] = (globalFreq[norm] ?? 0) + 1;
        });
      });

      const dayImgs = (day.images as string[]) || [];
      const extraUrls = dayImgs
        .map(resolveUrl)
        .filter(url => !finalMapped.chartUrls.includes(url));

      if (extraUrls.length > 0) {
        const dayAudios  = resolveAudios((day.audios  as Record<string, string>) || {});
        const dayVideos  = resolveVideos((day.videos  as Record<string, string>) || {});
        return {
          ...finalMapped,
          chartUrls: [...finalMapped.chartUrls, ...extraUrls],
          audios: { ...finalMapped.audios, ...dayAudios },
          videos: { ...finalMapped.videos, ...dayVideos },
        };
      }
      return finalMapped;
    });

  // Handle entries from dayData that have no trade
  const tradeDates = new Set(tradeMapped.map(t => t.date));
  const dayOnlyEntries: Trade[] = Object.entries(dayData)
    .filter(([date, day]) => {
      const hasChart = ((day as any).images || []).length > 0;
      const hasNews = ((day as any).newsImages || []).length > 0;
      const hasClose = ((day as any).closeGlobalImages || []).length > 0;
      return !tradeDates.has(date) && (hasChart || hasNews || hasClose);
    })
    .map(([date, day], i) => {
      const charts = ((day as any).images || []).map(resolveUrl);
      const news = ((day as any).newsImages || []).map(resolveUrl);
      const closeG = ((day as any).closeGlobalImages || []).map(resolveUrl);
      const allDayUrls = Array.from(new Set([...charts, ...news, ...closeG]));
      
      const imageTagsMap = ((day as any).imageTags as Record<string, string[]>) || {};
      const marqueeBoxes = ((day as any).marqueeBoxes as Record<string, any[]>) || {};
      const resImgTags: Record<string, string[]> = {};
      const allDayTags = new Set<string>();

      allDayUrls.forEach(url => {
        const f = getFilename(url);
        const s = new Set<string>();
        // Check imageTags
        for (const [k, tgs] of Object.entries(imageTagsMap)) {
          if (getFilename(k) === f) tgs.forEach(tg => { s.add(tg); allDayTags.add(tg); });
        }
        // Check marqueeBoxes
        for (const [k, bxs] of Object.entries(marqueeBoxes)) {
          if (getFilename(k) === f) bxs.forEach(b => b.tags?.forEach(tg => { s.add(tg); allDayTags.add(tg); }));
        }
        // Special: Auto-tag News
        if (news.includes(url)) { s.add('news'); allDayTags.add('news'); }

        if (s.size > 0) resImgTags[url] = Array.from(s);
      });

      return {
        id: `day-${date}-${i}`,
        instrument: 'Day Note',
        type: 'Long' as const,
        pnl: 0,
        currency: '₹',
        date,
        session: 'Morning' as const,
        chartUrls: allDayUrls,
        audios: resolveAudios((day as any).audios || {}),
        videos: resolveVideos((day as any).videos || {}),
        emotionTags: Array.from(allDayTags).filter(tg => emotionSet.has(tg)),
        strategyTags: Array.from(allDayTags).filter(tg => !emotionSet.has(tg) && !mistakeSet.has(tg)),
        mistakeTags: Array.from(allDayTags).filter(tg => mistakeSet.has(tg)),
        imageTags: resImgTags,
        note: (day as any).obs || (day as any).Note || '',
        stats: { rMultiple: 0, riskReward: '', positionSize: 0 },
      };
    });

  const closeEntries: Trade[] = Object.entries(dayData)
    .filter(([, day]) => Array.isArray((day as any).closeImages) && (day as any).closeImages.length > 0)
    .map(([date, day]) => {
      const urls = ((day as any).closeImages as string[]).map(resolveUrl);
      const resImgTags: Record<string, string[]> = {};
      const imageTagsMap = ((day as any).imageTags as Record<string, string[]>) || {};
      
      urls.forEach(url => {
        const f = getFilename(url);
        const s = new Set<string>();
        for (const [k, tgs] of Object.entries(imageTagsMap)) {
          if (getFilename(k) === f) tgs.forEach(tg => { s.add(tg); });
        }
        if (s.size > 0) resImgTags[url] = Array.from(s);
      });

      return {
        id: `close-${date}`,
        instrument: 'Close',
        type: 'Long' as const,
        pnl: 0,
        currency: '₹',
        date,
        session: 'Morning' as const,
        chartUrls: urls,
        audios: resolveAudios((day as any).audios || {}),
        videos: resolveVideos((day as any).videos || {}),
        isClose: true,
        emotionTags: [],
        strategyTags: [],
        mistakeTags: [],
        imageTags: resImgTags,
        note: '',
        stats: { rMultiple: 0, riskReward: '', positionSize: 0 },
      };
    });

  const mappedTrades: Trade[] = [...tradeMapped, ...dayOnlyEntries, ...closeEntries];

  // Global frequency count and data enrichment: 
  // We need to ensure that the tags we count also exist in t.imageTags[url] 
  // so that the frontend filter matches the pill count.
  const finalFreq: Record<string, number> = {};
  
  mappedTrades.forEach(t => {
    const tradeHasNote = (t.note || '').trim().length > 0;
    const baseTradeTags = Array.from(new Set([...t.emotionTags, ...t.mistakeTags, ...t.strategyTags].map(tg => tg.trim()).filter(Boolean)));
    
    t.chartUrls.forEach(url => {
      if (!t.imageTags) t.imageTags = {};
      const imgTagsSet = new Set<string>(t.imageTags[url] || []);
      
      // 1. Inject Trade-level tags into images (Gallery scope logic)
      baseTradeTags.forEach(tg => imgTagsSet.add(tg));
      
      // 2. Inject Virtual: 📝 has notes
      if (tradeHasNote) imgTagsSet.add('📝 has notes');

      // Update the trade's imageTags so frontend filter finds them
      const finalImgTags = Array.from(imgTagsSet);
      t.imageTags[url] = finalImgTags;

      // Increment global counts
      finalImgTags.forEach(tg => {
        const norm = tg.trim();
        if (!norm) return;
        finalFreq[norm] = (finalFreq[norm] ?? 0) + 1;
      });
    });
  });

  return { 
    trades: mappedTrades, 
    tagGroups: data.tagGroups || {}, 
    tagFrequency: finalFreq 
  };
}

export async function fetchBlogPosts(): Promise<BlogPost[]> {
  const res = await fetch(`${BASE_URL}/api/blog-posts`);
  if (!res.ok) throw new Error(`Blog API error: ${res.status}`);
  return res.json();
}
