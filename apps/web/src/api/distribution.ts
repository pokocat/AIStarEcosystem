import type { DistributionPublishRequest } from "@/types/contracts/distribution";
import { fetcher } from "@/lib/http/fetcher";

const isMock = process.env.NEXT_PUBLIC_MOCK === "true";
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export async function publishDistribution(request: DistributionPublishRequest): Promise<{ success: boolean; publishJobId: string }> {
  if (isMock) return { success: true, publishJobId: `publish-${Date.now()}` };
  return fetcher<{ success: boolean; publishJobId: string }>(`${apiBase}/api/distribution/publish`, {
    method: "POST",
    body: JSON.stringify(request)
  });
}
