import type { ArtistSigningRequest } from "@/types/contracts/marketplace";
import * as mockAdapter from "@/server/adapters/mock/marketplace";
import * as springAdapter from "@/server/adapters/spring/marketplace";
import { shouldUseMockData } from "@/server/services/shared";

export async function listMarketplaceListings() {
  return shouldUseMockData() ? mockAdapter.getMarketplaceListings() : springAdapter.getMarketplaceListings();
}

export async function signMarketplaceArtist(request: ArtistSigningRequest) {
  return shouldUseMockData() ? mockAdapter.signArtist(request) : springAdapter.signArtist(request);
}
