// ─────────────────────────────────────────────────────────────────────────────
// mocks/coach.ts — 发行机构端样本数据。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CoachCategoryDistribution,
  CoachRevenuePoint,
  CopyrightItem,
  DistributionQueueItem,
  SignedArtist,
} from "@/types/coach";

export const SignedArtists: SignedArtist[] = [
  { id: "1", name: "Neon V",       type: "Singer", typeIcon: "🎤",  avatar: "https://images.unsplash.com/photo-1561533140-ac0ab494cdda?w=200&q=80", mcn: "CyberProducer_01", contractEnd: "2026-12-31", monthlyRevenue: "¥61,000",  totalRevenue: "¥520,000", fans: "162K", status: "active",      royaltyRate: 15, contentCount: 28 },
  { id: "2", name: "PRISM 7",      type: "Idol",   typeIcon: "💎",  avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&q=80", mcn: "StarMatrix",       contractEnd: "2027-06-30", monthlyRevenue: "¥128,000", totalRevenue: "¥890,000", fans: "310K", status: "active",      royaltyRate: 12, contentCount: 45 },
  { id: "3", name: "Blade Runner", type: "Actor",  typeIcon: "🎭",  avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80", mcn: "FilmForge",        contractEnd: "2025-09-15", monthlyRevenue: "¥85,000",  totalRevenue: "¥680,000", fans: "256K", status: "expiring",    royaltyRate: 18, contentCount: 12 },
  { id: "4", name: "Crystal Flow", type: "Dancer", typeIcon: "💃",  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80", mcn: "DanceWave",        contractEnd: "2026-03-01", monthlyRevenue: "¥42,000",  totalRevenue: "¥310,000", fans: "128K", status: "active",      royaltyRate: 14, contentCount: 35 },
  { id: "5", name: "MC Thunder",   type: "Host",   typeIcon: "🎙️", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80", mcn: "ShowTime",         contractEnd: "2025-06-30", monthlyRevenue: "¥35,000",  totalRevenue: "¥240,000", fans: "95K",  status: "negotiating", royaltyRate: 16, contentCount: 52 },
  { id: "6", name: "Luna Soft",    type: "Singer", typeIcon: "🎤",  avatar: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=200&q=80", mcn: "MoonBase",         contractEnd: "2026-08-15", monthlyRevenue: "¥28,000",  totalRevenue: "¥180,000", fans: "89K",  status: "active",      royaltyRate: 15, contentCount: 18 },
];

export const CoachRevenueData: CoachRevenuePoint[] = [
  { month: "1月", streaming: 180000, endorsement: 120000, nft: 80000,  live: 45000 },
  { month: "2月", streaming: 195000, endorsement: 95000,  nft: 110000, live: 60000 },
  { month: "3月", streaming: 220000, endorsement: 150000, nft: 95000,  live: 38000 },
  { month: "4月", streaming: 245000, endorsement: 180000, nft: 120000, live: 72000 },
  { month: "5月", streaming: 280000, endorsement: 160000, nft: 135000, live: 85000 },
  { month: "6月", streaming: 310000, endorsement: 200000, nft: 150000, live: 95000 },
];

export const DistributionQueue: DistributionQueueItem[] = [
  { id: "d1", title: "Neon Tears - Remix EP",      artist: "Neon V",       type: "Music", status: "reviewing",    platforms: 12, date: "2025-04-15" },
  { id: "d2", title: "PRISM 7 Summer MV",          artist: "PRISM 7",      type: "Video", status: "approved",     platforms: 8,  date: "2025-04-14" },
  { id: "d3", title: "Blade Runner Action Reel",   artist: "Blade Runner", type: "Video", status: "distributing", platforms: 6,  date: "2025-04-13" },
  { id: "d4", title: "Crystal Dance Tutorial",     artist: "Crystal Flow", type: "Video", status: "reviewing",    platforms: 5,  date: "2025-04-12" },
  { id: "d5", title: "Thunder Show S2E08",         artist: "MC Thunder",   type: "Live",  status: "approved",     platforms: 3,  date: "2025-04-10" },
];

export const CopyrightPending: CopyrightItem[] = [
  { id: "c1", title: "Ghost Signal EP", artist: "Neon V",       type: "Music",        submitted: "2025-04-10", status: "pending"  },
  { id: "c2", title: "Dance of Light",  artist: "Crystal Flow", type: "Choreography", submitted: "2025-04-08", status: "verified" },
  { id: "c3", title: "Thunder Script S3", artist: "MC Thunder", type: "Script",       submitted: "2025-04-05", status: "pending"  },
];

export const CategoryDist: CoachCategoryDistribution[] = [
  { name: "流媒体",   value: 40, color: "#06b6d4" },
  { name: "代言",     value: 25, color: "#a855f7" },
  { name: "数字藏品", value: 18, color: "#ec4899" },
  { name: "现场",     value: 12, color: "#f59e0b" },
  { name: "其他",     value: 5,  color: "#22c55e" },
];
