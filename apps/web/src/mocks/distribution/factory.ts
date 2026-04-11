import type { DistributionConfiguration } from "@/types/contracts/distribution";
import { distributionAccountFixtures, distributionChannelFixtures } from "@/mocks/distribution/fixtures";

export function buildDistributionConfiguration(): DistributionConfiguration {
  return {
    channels: distributionChannelFixtures,
    accountBindings: distributionAccountFixtures
  };
}
