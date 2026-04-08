import { jsonError, jsonOk } from "@/server/response";
import { signMarketplaceArtist } from "@/server/services/marketplace-service";
import type { ArtistSigningRequest } from "@/types/contracts/marketplace";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ArtistSigningRequest;
    const data = await signMarketplaceArtist(body);
    return jsonOk(data);
  } catch (error) {
    return jsonError(error);
  }
}
