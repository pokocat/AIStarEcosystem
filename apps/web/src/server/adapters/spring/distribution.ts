import type { DistributionPublishRequest } from "@/types/contracts/distribution";
import { proxySpring } from "@/server/adapters/spring/shared";

export async function publishDistribution(request: DistributionPublishRequest) {
  return proxySpring<{ success: boolean; publishJobId: string }>("/api/distribution/publish", {
    method: "POST",
    body: JSON.stringify(request)
  });
}
