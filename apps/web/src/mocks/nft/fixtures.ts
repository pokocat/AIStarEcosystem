import type { NftCollectionSummary } from "@/types/contracts/nft";

export const nftCollectionFixtures: NftCollectionSummary[] = [
  {
    id: "nft-1",
    name: "Neon Genesis #102",
    coverUrl: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400",
    priceEth: "0.05",
    remaining: 12,
    rarity: "rare",
    trackId: "track-101"
  },
  {
    id: "nft-2",
    name: "Neon Genesis #202",
    coverUrl: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400",
    priceEth: "0.08",
    remaining: 8,
    rarity: "epic",
    trackId: "track-102"
  },
  {
    id: "nft-3",
    name: "Neon Genesis #302",
    coverUrl: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=400",
    priceEth: "0.15",
    remaining: 5,
    rarity: "legendary",
    trackId: "track-103"
  }
];
