// ─────────────────────────────────────────────────────────────────────────────
// mocks/fan.ts — 粉丝端样本数据（艺人 / 热播歌曲 / NFT）。
// ─────────────────────────────────────────────────────────────────────────────

import type { FanArtist, TrackItem, NFTItem, FanProfile } from "@/types/fan";

export const TrendingArtists: FanArtist[] = [
  { id: "1", name: "Neon V",       type: "🎤", avatar: "https://images.unsplash.com/photo-1561533140-ac0ab494cdda?w=200&q=80",   fans: "162K", trending: true,  tags: ["Cyberpunk", "Electro"] },
  { id: "2", name: "Luna Soft",    type: "🎤", avatar: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=200&q=80", fans: "89K",  trending: true,  tags: ["Lo-Fi", "Pop"] },
  { id: "3", name: "Blade Runner", type: "🎭", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80", fans: "256K", trending: false, tags: ["Action", "Sci-Fi"] },
  { id: "4", name: "Crystal Flow", type: "💃", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80", fans: "128K", trending: true,  tags: ["Dance", "K-Pop"] },
  { id: "5", name: "MC Thunder",   type: "🎙️", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80", fans: "95K",  trending: false, tags: ["Variety", "Comedy"] },
  { id: "6", name: "PRISM 7",      type: "💎", avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&q=80", fans: "310K", trending: true,  tags: ["Idol", "All-Round"] },
];

export const HotTracks: TrackItem[] = [
  { id: "t1", title: "Neon Tears",          artist: "Neon V",       cover: "🎵",  plays: "1.2M", duration: "3:42", liked: true  },
  { id: "t2", title: "Digital Sunset",      artist: "Neon V",       cover: "🌅",  plays: "890K", duration: "4:15", liked: false },
  { id: "t3", title: "Moonlight Lo-Fi",     artist: "Luna Soft",    cover: "🌙",  plays: "650K", duration: "3:28", liked: true  },
  { id: "t4", title: "Crystal Dance Break", artist: "Crystal Flow", cover: "💎",  plays: "420K", duration: "2:58", liked: false },
  { id: "t5", title: "Cyber City Vibe",     artist: "Neon V",       cover: "🌃",  plays: "380K", duration: "3:55", liked: false },
  { id: "t6", title: "Starlight Protocol",  artist: "PRISM 7",      cover: "⭐",  plays: "560K", duration: "4:02", liked: true  },
  { id: "t7", title: "Ghost Signal",        artist: "Neon V",       cover: "👻",  plays: "320K", duration: "3:12", liked: false },
  { id: "t8", title: "Soft Rain",           artist: "Luna Soft",    cover: "🌧️", plays: "280K", duration: "3:45", liked: false },
];

export const NFTMarket: NFTItem[] = [
  { id: "n1", name: "Neon V Genesis Badge",  artist: "Neon V",       preview: "🏅", price: "0.05 ETH", rarity: "epic",      holders: 487  },
  { id: "n2", name: "PRISM 7 Fan Card S1",   artist: "PRISM 7",      preview: "💎", price: "0.02 ETH", rarity: "rare",      holders: 1200 },
  { id: "n3", name: "Cyber City Artwork",    artist: "Neon V",       preview: "🎨", price: "0.8 ETH",  rarity: "legendary", holders: 48   },
  { id: "n4", name: "Crystal Dance Moment",  artist: "Crystal Flow", preview: "💃", price: "0.12 ETH", rarity: "epic",      holders: 195  },
  { id: "n5", name: "Luna Lullaby Pass",     artist: "Luna Soft",    preview: "🌙", price: "0.03 ETH", rarity: "rare",      holders: 820  },
  { id: "n6", name: "Thunder Show Ticket",   artist: "MC Thunder",   preview: "⚡", price: "0.01 ETH", rarity: "common",    holders: 3500 },
];

export const DefaultFanProfile: FanProfile = {
  name: "CyberFan_01",
  level: 12,
  exp: 3400,
  maxExp: 5000,
  badges: 8,
  nfts: 5,
  following: 2,
  totalListens: "12.4K",
  joinDate: "2024-08-15",
};

export const DefaultLikedTrackIds: string[] = ["t1", "t3", "t6"];
export const DefaultFollowedArtistIds: string[] = ["1", "6"];
