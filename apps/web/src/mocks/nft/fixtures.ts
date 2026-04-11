export const nftCollectionFixtures = [
  {
    id: "nft-1",
    name: "Neon Genesis #102",
    coverUrl: "https://images.unsplash.com/photo-1600000001000?w=400",
    priceLabel: "¥ 19.9",
    remaining: 12,
    rarity: "rare" as const,
    trackId: "track-101"
  },
  {
    id: "nft-2",
    name: "Neon Genesis #202",
    coverUrl: "https://images.unsplash.com/photo-1600000002000?w=400",
    priceLabel: "¥ 29.9",
    remaining: 8,
    rarity: "epic" as const,
    trackId: "track-102"
  },
  {
    id: "nft-3",
    name: "Neon Genesis #302",
    coverUrl: "https://images.unsplash.com/photo-1600000003000?w=400",
    priceLabel: "¥ 39.9",
    remaining: 5,
    rarity: "legendary" as const,
    trackId: "track-103"
  }
];
