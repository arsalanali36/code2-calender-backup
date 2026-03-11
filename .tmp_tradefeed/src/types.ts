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
  chartUrls: string[]; // Changed from chartUrl to chartUrls
  emotionTags: string[];
  strategyTags: string[];
  mistakeTags: string[];
  note: string;
  stats: {
    rMultiple: number;
    riskReward: string;
    positionSize: number;
  };
}

export type ViewType = 'feed' | 'calendar' | 'dashboard' | 'table' | 'gallery' | 'import' | 'tagger' | 'logger';
