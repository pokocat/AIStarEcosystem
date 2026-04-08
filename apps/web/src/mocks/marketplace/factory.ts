import type { MarketplaceListing } from "@/types/contracts/marketplace";
import { marketplaceListingFixtures } from "@/mocks/marketplace/fixtures";

export function buildMarketplaceListings(): MarketplaceListing[] {
  return marketplaceListingFixtures;
}
