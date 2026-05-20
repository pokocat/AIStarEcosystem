// ─────────────────────────────────────────────────────────────────────────────
// social-account.ts — 用户绑定的第三方社交平台账号。
// 由 sau-service（Playwright 自动化）扫码登录后，把会话 storage_state 加密存到
// server DB（aep_social_accounts.storage_state_encrypted）。
// 前端永远不接触 storage_state 明文 —— SocialAccount DTO 不暴露该字段。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

/** v1 启用 4 平台：抖音 / 快手 / 视频号 / 小红书；其余 enum 占位但 service 抛 501。 */
export type SocialPlatform =
  | "douyin"
  | "kuaishou"
  | "xiaohongshu"
  | "shipinhao"
  | "bilibili"
  | "tiktok"
  | "youtube"
  | "baijiahao";

export type SocialAccountStatus = "active" | "expired" | "banned" | "pending";

export interface SocialAccount {
  id: ID;
  userId: ID;
  platform: SocialPlatform;
  /** 用户自取的账号别名，例如 "公司主号-抖音" */
  accountName: string;
  status: SocialAccountStatus;
  /** 扫码登录后从平台获取的昵称 */
  displayName?: string;
  /** 平台侧账号号 / handle，例如抖音号；抓不到时为空 */
  platformAccountId?: string;
  avatarUrl?: string;
  boundAt: ISODateTime;
  /** 上次成功 verify 的时间（cookie 仍有效） */
  lastVerifiedAt?: ISODateTime;
}

export interface SocialAccountBindInput {
  platform: SocialPlatform;
  accountName: string;
}

/** /me/social-accounts/bind-init 的返回：扫码登录的初始化结果。 */
export interface SocialAccountBindInit {
  /** 后端给本次绑定流程发的会话票；polling 用它做 key。 */
  sessionTicket: string;
  /** data:image/png;base64,...，前端直接 <img src={qrImageDataUrl}> */
  qrImageDataUrl?: string;
  /** 部分平台是 deeplink 而非图片（备用） */
  qrUrl?: string;
  expiresAt: ISODateTime;
}

/** /me/social-accounts/bind-poll 的返回：扫码状态。 */
export interface SocialAccountBindPollResult {
  status: "pending" | "success" | "expired";
  /** 仅 status==="success" 时返回，已是清洁版（不含 storage_state） */
  account?: SocialAccount;
}
