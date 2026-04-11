// ─────────────────────────────────────────────────────────────────────────────
// marketplace.ts — 与 specs/openapi.yaml 对齐，一切以 BACKEND_API_SPEC.md 为准
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums ────────────────────────────────────────────────────────────────────

export type LicenseType = "exclusive" | "nonExclusive";

export type ListingStatus = "pending" | "active" | "sold" | "removed";

// ── 2.14 MarketplaceArtist ───────────────────────────────────────────────────

/**
 * 市场艺人挂牌信息。
 * signingPrice / followersCount / songsCount 均为实际数值，
 * 展示格式化（如 "¥8,000"、"58.2K"）由组件层处理。
 */
export interface MarketplaceArtist {
  id: string;
  singerId: string;
  sellerId: string;
  name: string;
  avatarUrl: string;
  style: string;
  signingPrice: number;      // 签约价格（元），建议范围 5000–15000
  description: string | null;
  songsCount: number;
  followersCount: number;
  creatorUsername: string;
  licenseType: LicenseType;
  enableAutoReply: boolean;
  status: ListingStatus;
  views: number;
  inquiries: number;
  createdAt: string;
  updatedAt: string;
}

// ── 2.14 ArtistAnalytics ────────────────────────────────────────────────────

export interface RecentSong {
  id: string;
  title: string;
  plays: number;
  date: string;
  duration: string; // 格式："3:45"
}

export interface ArtistAnalytics {
  singerId: string;
  totalSongs: number;
  totalPlays: number;
  totalRevenue: number;
  avgPlayRate: number;      // 0–100
  activeDays: number;
  recentSongs: RecentSong[];
  fanGrowthData: number[];  // 7天粉丝增长趋势
  playTrendData: number[];  // 7天播放趋势
  updatedAt: string;
}

// ── 2.15 SigningContract ─────────────────────────────────────────────────────

export interface SigningContract {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  singerId: string;
  signingPrice: number;
  revenueSplitBuyer: number;  // 买家后续收益分成比例，默认 70
  revenueSplitSeller: number; // 卖家后续收益分成比例，默认 30
  termsAgreed: boolean;
  termsAgreedAt: string | null;
  paymentStatus: "pending" | "paid" | "refunded";
  contractStatus: "active" | "terminated";
  createdAt: string;
  activatedAt: string | null;
}

// ── 2.16 ArtistListingRequest ────────────────────────────────────────────────

export interface ArtistListingRequest {
  singerId: string;
  signingPrice: number;    // 建议范围 5000–15000
  description?: string;   // 最长 2000 字符
  licenseType: LicenseType;
  enableAutoReply: boolean;
}

// ── Sign request ─────────────────────────────────────────────────────────────

export interface ArtistSigningRequest {
  agreedToTerms: boolean;
}
