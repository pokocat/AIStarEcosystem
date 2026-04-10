import type { DistributionConfiguration } from "@/types/contracts/distribution";
import type { MarketplaceListing } from "@/types/contracts/marketplace";

export interface DashboardMetrics {
  artistCount: number;
  totalPlays: number;
  marketSignings: number;
  revenueCny: number;
  newSongs: number;
  successRate: number;
  pendingReviews: number;
}

export interface TransactionRecord {
  id: string;
  date: string;
  description: string;
  amountLabel: string;
  status: "Completed" | "Processing";
}

export interface EarningPoint {
  name: string;
  song: number;
  badge: number;
}

export interface CoachTrainee {
  id: string;
  name: string;
  status: "On Track" | "Warning" | "Star";
  progress: number;
  revenue: number;
  lastActive: string;
  avatarUrl: string;
  latestSubmissionTitle: string;
}

export interface AnalyticsDashboardPayload {
  producerMetrics: DashboardMetrics;
  coachMetrics: DashboardMetrics;
  earningsSeries: EarningPoint[];
  transactions: TransactionRecord[];
  marketListings: MarketplaceListing[];
  coachTrainees: CoachTrainee[];
  distribution: DistributionConfiguration;
}
