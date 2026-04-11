// ─────────────────────────────────────────────────────────────────────────────
// distribution.ts — 与 specs/openapi.yaml 对齐，一切以 BACKEND_API_SPEC.md 为准
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums ────────────────────────────────────────────────────────────────────

/**
 * domestic=国内AI专属通道（腾讯音乐/网易云）
 * global=全球流媒体（DistroKid/TuneCore）
 * shortVideo=短视频矩阵（抖音/TikTok）
 */
export type DistributionChannelId = "domestic" | "global" | "shortVideo";

export type PlatformAccountKey =
  | "distrokid"
  | "tencentMusic"
  | "neteaseMusic"
  | "spotifyArtists"
  | "douyinCreator"
  | "tiktokBusiness";

export type DistributionJobStatus =
  | "pending"
  | "processing"
  | "partial"
  | "completed"
  | "failed";

// ── 2.17 DistributionChannel ─────────────────────────────────────────────────

/**
 * 发行渠道配置（来自后端 /api/distribution/channels）。
 * iconKey / iconBg 等纯 UI 渲染字段不属于 API contract，
 * 请在组件层通过本地映射处理。
 */
export interface DistributionChannel {
  id: DistributionChannelId;
  name: string;
  nameEn: string;
  description: string;
  requiredAccounts: PlatformAccountKey[];
  benefits: string[];
  benefitsEn: string[];
  platformCount: number;
  isActive: boolean;
}

// ── 2.18 PlatformAccount ─────────────────────────────────────────────────────

/**
 * 用户绑定的第三方平台账号状态。
 * Token 等敏感字段仅在后端存储，接口不返回。
 */
export interface PlatformAccount {
  id: string;
  userId: string;
  platformKey: PlatformAccountKey;
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  updatedAt: string;
}

// ── 2.19 DistributionJob ─────────────────────────────────────────────────────

export interface PlatformResult {
  platformKey: PlatformAccountKey;
  channelId: DistributionChannelId;
  status: "success" | "failed" | "pending";
  trackUrl: string | null;
  errorMessage: string | null;
}

export interface DistributionJob {
  id: string;
  producerId: string;
  trackId: string;
  singerId: string | null;
  selectedChannels: DistributionChannelId[];
  releaseDate: string | null;  // ISO date，null=立即发行
  releaseTime: string | null;  // "HH:mm"
  enablePreSave: boolean;
  preSaveStartDays: number;    // 默认 15
  status: DistributionJobStatus;
  platformResults: PlatformResult[];
  submittedAt: string;
  completedAt: string | null;
}

// ── Request ───────────────────────────────────────────────────────────────────

export interface DistributionPublishRequest {
  trackId: string;
  channelIds: DistributionChannelId[];
  releaseDate?: string;
  releaseTime?: string;
  preSaveEnabled?: boolean;
}

// ── Workspace payload ────────────────────────────────────────────────────────

export interface DistributionConfiguration {
  channels: DistributionChannel[];
  accountBindings: PlatformAccount[];
}
