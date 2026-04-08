export type Lang = 'zh' | 'en';

export type RootView =
  | 'home'
  | 'portal'
  | 'fan'
  | 'producer_intro'
  | 'producer_app'
  | 'coach';

export type ProducerPage =
  | 'overview'
  | 'persona'
  | 'studio'
  | 'editor'
  | 'distribution'
  | 'nft_mint'
  | 'earnings'
  | 'community';

export interface MockSinger {
  id: string;
  name: string;
  style: string;
  status: string;
  avatar: string;
}

export interface ChartTrack {
  id: number;
  title: string;
  artist: string;
  votes: number;
  trend: 'up' | 'down' | 'same';
  cover: string;
}

export interface TransactionRecord {
  id: number;
  date: string;
  desc: string;
  amount: string;
  status: string;
}

export interface EarningPoint {
  name: string;
  song: number;
  badge: number;
}

export interface LyricLine {
  time: number;
  text: string;
}
