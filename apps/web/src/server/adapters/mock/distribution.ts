import type { DistributionPublishRequest } from "@/types/contracts/distribution";

export async function publishDistribution(request: DistributionPublishRequest) {
  return {
    success: true,
    publishJobId: `publish-${Date.now()}`,
    request
  };
}
