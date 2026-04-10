export interface NftCollectionSummary {
  id: string;
  name: string;
  coverUrl: string;
  priceLabel: string;
  remaining: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  trackId?: string;
}

export interface NftMintRequest {
  trackId: string;
  collectionName: string;
  supply: number;
  priceEth: number;
  royaltyPct: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  enableAirdrop: boolean;
}

export interface NftCollectionsPayload {
  collections: NftCollectionSummary[];
}
