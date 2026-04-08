import type { FinancialRecord, MintMetadata, Singer, Track } from '../../types/entities';

export interface ProducerDashboardData {
  singers: Singer[];
  tracks: Track[];
  finance: FinancialRecord[];
  mintDrafts: MintMetadata[];
  credits: number;
}

export interface FanDashboardData {
  featuredSingers: Singer[];
  trendingTracks: Track[];
  ownedBadges: MintMetadata[];
}

export interface CoachDashboardData {
  traineeSingers: Singer[];
  traineeTracks: Track[];
  kpi: {
    weeklyNewSongs: number;
    successRate: number;
    pendingReviews: number;
    ecosystemValue: number;
  };
}

export interface IAppService {
  getProducerData(userId: string): Promise<ProducerDashboardData>;
  getFanData(userId: string): Promise<FanDashboardData>;
  getCoachData(userId: string): Promise<CoachDashboardData>;
}
