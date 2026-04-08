import type { AnalyticsDashboardPayload } from "@/types/contracts/analytics";
import { buildDistributionConfiguration } from "@/mocks/distribution/factory";
import { buildMarketplaceListings } from "@/mocks/marketplace/factory";
import { coachTraineeFixtures, earningsFixtures, transactionFixtures } from "@/mocks/analytics/fixtures";

export function buildAnalyticsDashboard(): AnalyticsDashboardPayload {
  return {
    producerMetrics: {
      artistCount: 4,
      totalPlays: 4200000,
      marketSignings: 3,
      revenueCny: 45000,
      newSongs: 142,
      successRate: 85,
      pendingReviews: 12
    },
    coachMetrics: {
      artistCount: 4,
      totalPlays: 4200000,
      marketSignings: 3,
      revenueCny: 458290,
      newSongs: 142,
      successRate: 85,
      pendingReviews: 12
    },
    earningsSeries: earningsFixtures,
    transactions: transactionFixtures,
    marketListings: buildMarketplaceListings(),
    coachTrainees: coachTraineeFixtures,
    distribution: buildDistributionConfiguration()
  };
}
