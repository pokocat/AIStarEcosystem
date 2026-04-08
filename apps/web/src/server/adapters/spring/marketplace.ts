import type { ArtistSigningRequest, MarketplaceListing } from "@/types/contracts/marketplace";
import { proxySpring } from "@/server/adapters/spring/shared";

export async function getMarketplaceListings() {
  return proxySpring<MarketplaceListing[]>("/api/marketplace/listings");
}

export async function signArtist(request: ArtistSigningRequest) {
  return proxySpring<{ success: boolean; signedArtistId: string }>("/api/marketplace/sign", {
    method: "POST",
    body: JSON.stringify(request)
  });
}
