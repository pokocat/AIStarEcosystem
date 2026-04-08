import { jsonError, jsonOk } from "@/server/response";
import { listMarketplaceListings } from "@/server/services/marketplace-service";

export async function GET() {
  try {
    const data = await listMarketplaceListings();
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}
