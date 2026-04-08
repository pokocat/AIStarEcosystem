import type { DistributionPublishRequest } from "@/types/contracts/distribution";
import * as mockAdapter from "@/server/adapters/mock/distribution";
import * as springAdapter from "@/server/adapters/spring/distribution";
import { shouldUseMockData } from "@/server/services/shared";

export async function publishDistributionJob(request: DistributionPublishRequest) {
  return shouldUseMockData() ? mockAdapter.publishDistribution(request) : springAdapter.publishDistribution(request);
}
