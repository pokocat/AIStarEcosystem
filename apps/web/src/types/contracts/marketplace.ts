export interface MarketplaceListing {
  id: string;
  artistId: string;
  name: string;
  style: string;
  avatarUrl: string;
  priceLabel: string;
  owner: string;
  songs: number;
  followersLabel: string;
  description: string;
  autoReplyEnabled?: boolean;
}

export interface ArtistSigningRequest {
  artistId: string;
  offerPriceLabel?: string;
}
