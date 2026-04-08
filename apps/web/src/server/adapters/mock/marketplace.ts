import type { ArtistSigningRequest } from "@/types/contracts/marketplace";
import { resolveMarketplaceListings } from "@/mocks/marketplace/resolver";

export async function getMarketplaceListings() {
  return resolveMarketplaceListings();
}

export async function signArtist(request: ArtistSigningRequest) {
  return {
    success: true,
    signedArtistId: request.artistId
  };
}
