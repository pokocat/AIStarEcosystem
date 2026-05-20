// ─────────────────────────────────────────────────────────────────────────────
// social-account.ts — 用户绑定的第三方社交平台账号（admin 跨用户视图）。
// Mirror of packages/types/src/social-account.ts；admin 不接触 storage_state 明文。
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
  /** 用户自取的账号别名 */
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
