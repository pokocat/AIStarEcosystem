// ─────────────────────────────────────────────────────────────────────────────
// publish-job.ts — 跨用户发布任务（admin 审计视图）。
// Mirror of packages/types/src/publish-job.ts，附事件流 PublishJobEvent。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";
import type { SocialPlatform } from "./social-account";

export type PublishJobStatus =
  | "queued"
  | "uploading"
  | "transcoding"
  | "publishing"
  | "live"
  | "failed"
  | "cancelled";

export interface PublishJob {
  id: ID;
  userId?: ID;
  projectId: ID;
  socialAccountId?: ID;
  platformId: ID;
  platformName: string;
  status: PublishJobStatus;
  progress: number;
  videoUrl?: string;
  title?: string;
  description?: string;
  tags?: string[];
  coverUrl?: string;
  externalTaskId?: string;
  externalUrl?: string;
  errorMessage?: string;
  creditsSpent?: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  scheduledAt?: ISODateTime;
}

/** 任务事件流（不可变审计行）。kind: transition / progress / callback / error / system。 */
export interface PublishJobEvent {
  id: ID;
  jobId: ID;
  kind: string;
  fromStatus?: PublishJobStatus;
  toStatus?: PublishJobStatus;
  progress?: number;
  note?: string;
  at: ISODateTime;
}

/** 平台与状态的中文展示映射，UI 直接消费。 */
export const PUBLISH_PLATFORM_LABEL: Record<SocialPlatform, string> = {
  douyin: "抖音",
  kuaishou: "快手",
  xiaohongshu: "小红书",
  shipinhao: "视频号",
  bilibili: "B 站",
  tiktok: "TikTok",
  youtube: "YouTube",
  baijiahao: "百家号",
};
