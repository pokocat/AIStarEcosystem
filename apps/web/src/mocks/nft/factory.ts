import type { NftCollectionsPayload } from "@/types/contracts/nft";
import { nftCollectionFixtures } from "@/mocks/nft/fixtures";

export function buildNftCollections(): NftCollectionsPayload {
  return {
    collections: nftCollectionFixtures
  };
}
