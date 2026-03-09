import { Trade } from '../types';

export const mockTrades: Trade[] = [
  {
    id: '1',
    instrument: 'NIFTY 24850 PUT',
    type: 'Short',
    pnl: 3932.50,
    currency: '₹',
    date: '2026-03-02',
    session: 'Morning',
    chartUrls: [
      'https://picsum.photos/seed/trade1_1/800/600',
      'https://picsum.photos/seed/trade1_2/800/600',
      'https://picsum.photos/seed/trade1_3/800/600'
    ],
    emotionTags: ['Discipline', 'Calm'],
    strategyTags: ['Breakout', 'Trend Following'],
    mistakeTags: [],
    note: 'Clean breakout from the opening range. Held until target 1 was hit. Good execution.',
    stats: {
      rMultiple: 2.5,
      riskReward: '1:2.5',
      positionSize: 150,
    },
  },
  {
    id: '1b',
    instrument: 'NIFTY 24900 CALL',
    type: 'Long',
    pnl: 1200.00,
    currency: '₹',
    date: '2026-03-02',
    session: 'Afternoon',
    chartUrls: [
      'https://picsum.photos/seed/trade1b_1/800/600'
    ],
    emotionTags: ['Confidence'],
    strategyTags: ['Scalp'],
    mistakeTags: [],
    note: 'Quick scalp on a 5m support bounce. Small position.',
    stats: {
      rMultiple: 0.8,
      riskReward: '1:1.5',
      positionSize: 50,
    },
  },
  {
    id: '2',
    instrument: 'BANKNIFTY 48200 CALL',
    type: 'Long',
    pnl: -2239.25,
    currency: '₹',
    date: '2026-03-06',
    session: 'Afternoon',
    chartUrls: [
      'https://picsum.photos/seed/trade2_1/800/600',
      'https://picsum.photos/seed/trade2_2/800/600'
    ],
    emotionTags: ['Panic', 'Revenge'],
    strategyTags: ['Pullback'],
    mistakeTags: ['Overtrading', 'Early Exit'],
    note: 'Entered too early on a weak pullback. Panicked when it dipped and exited before the bounce. Need to trust the stop loss.',
    stats: {
      rMultiple: -1.0,
      riskReward: '1:2',
      positionSize: 75,
    },
  },
  {
    id: '3',
    instrument: 'NIFTY 25100 CALL',
    type: 'Long',
    pnl: 4043.00,
    currency: '₹',
    date: '2026-03-04',
    session: 'Morning',
    chartUrls: [
      'https://picsum.photos/seed/trade3_1/800/600',
      'https://picsum.photos/seed/trade3_2/800/600',
      'https://picsum.photos/seed/trade3_3/800/600',
      'https://picsum.photos/seed/trade3_4/800/600'
    ],
    emotionTags: ['Confidence'],
    strategyTags: ['VCP Pattern'],
    mistakeTags: [],
    note: 'Perfect VCP breakout on the 5m chart. Volume confirmation was strong. Trailed stop loss effectively.',
    stats: {
      rMultiple: 3.2,
      riskReward: '1:3',
      positionSize: 200,
    },
  },
];
