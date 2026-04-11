import type { ArtistSigningRequest, MarketplaceArtist } from "@/types/contracts/marketplace";
import { fetcher } from "@/lib/http/fetcher";
import { resolveMarketplaceListings } from "@/mocks/marketplace/resolver";

const isMock = process.env.NEXT_PUBLIC_MOCK === "true";
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export async function getMarketplaceListings(): Promise<MarketplaceArtist[]> {
  if (isMock) return resolveMarketplaceListings();
  return fetcher<MarketplaceArtist[]>(`${apiBase}/api/marketplace/listings`);
}

export async function signArtist(listingId: string, request: ArtistSigningRequest): Promise<{ success: boolean }> {
  if (isMock) return { success: true };
  return fetcher<{ success: boolean }>(`${apiBase}/api/marketplace/listings/${listingId}/sign`, {
    method: "POST",
    body: JSON.stringify(request)
  });
}
