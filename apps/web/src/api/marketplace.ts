import type { ArtistSigningRequest, MarketplaceListing } from "@/types/contracts/marketplace";
import { fetcher } from "@/lib/http/fetcher";
import { resolveMarketplaceListings } from "@/mocks/marketplace/resolver";

const isMock = process.env.NEXT_PUBLIC_MOCK === "true";
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export async function getMarketplaceListings(): Promise<MarketplaceListing[]> {
  if (isMock) return resolveMarketplaceListings();
  return fetcher<MarketplaceListing[]>(`${apiBase}/api/marketplace/listings`);
}

export async function signArtist(request: ArtistSigningRequest): Promise<{ success: boolean; signedArtistId: string }> {
  if (isMock) return { success: true, signedArtistId: request.artistId };
  return fetcher<{ success: boolean; signedArtistId: string }>(`${apiBase}/api/marketplace/sign`, {
    method: "POST",
    body: JSON.stringify(request)
  });
}
