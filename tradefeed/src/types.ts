export type TradeSession = 'Morning' | 'Afternoon' | 'Evening';
export type TradeType = 'Long' | 'Short';

export interface Trade {
  id: string;
  instrument: string;
  type: TradeType;
  pnl: number;
  currency: string;
  date: string;
  session: TradeSession;
  chartUrls: string[];
  audios?: Record<string, string>; // resolved imgUrl → resolved audioUrl
  videos?: Record<string, string>; // resolved imgUrl → resolved videoUrl
  emotionTags: string[];
  strategyTags: string[];
  mistakeTags: string[];
  note: string;
  isClose?: boolean;
  stats: {
    rMultiple: number;
    riskReward: string;
    positionSize: number;
  };
}

export type ViewType = 'feed' | 'calendar' | 'dashboard' | 'table' | 'gallery' | 'blog' | 'import' | 'tagger' | 'logger';

export interface BlogPost {
  id: string;
  short_title: string;
  date: string;
  display_date: string;
  display_day: string;
  version: string;
  emoji: string;
  title: string;
  tags: string[];
  summary: string;
  body: string;
}
