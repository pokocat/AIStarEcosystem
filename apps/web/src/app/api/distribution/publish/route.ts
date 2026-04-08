import { jsonError, jsonOk } from "@/server/response";
import { publishDistributionJob } from "@/server/services/distribution-service";
import type { DistributionPublishRequest } from "@/types/contracts/distribution";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DistributionPublishRequest;
    const data = await publishDistributionJob(body);
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}
