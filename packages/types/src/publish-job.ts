// ─────────────────────────────────────────────────────────────────────────────
// publish-job.ts — 分发发布任务（drama 多平台 publish 流水）。
// 上推自 apps/web-drama/src/types/publish-job.ts；server *Dto 需 mirror 字段名。
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
  /** sau 集成后新增；老 drama mock 数据缺该字段，故 optional */
  userId?: ID;
  projectId: ID;
  /** sau 集成后新增；绑定的社交账号 */
  socialAccountId?: ID;
  /** 目标平台 id（Platform.id） */
  platformId: ID;
  platformName: string;
  status: PublishJobStatus;
  /** 0-100 */
  progress: number;
  /** sau 集成后新增；sau-service 拉取的源视频 URL */
  videoUrl?: string;
  title?: string;
  description?: string;
  tags?: string[];
  coverUrl?: string;
  /** 抖音商品挂载链接（蓝V / 橱窗带货）；仅 douyin 消费，非带货视频留空。 */
  productLink?: string;
  /** 抖音商品挂载文案（"立即购买"挂件商品名）。 */
  productTitle?: string;
  /** sau-service 返回的远端任务 id，用于 idempotent callback / 状态查询 */
  externalTaskId?: string;
  externalUrl?: string;
  errorMessage?: string;
  /** 本任务实际扣的积分；失败也不退（人工调账走 admin） */
  creditsSpent?: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  scheduledAt?: ISODateTime;
}

/**
 * 创建批量发布任务的入参（celebrity sau 流程）。
 * 同名 type 在 apps/web-drama/src/api/distribution.ts 里有 legacy 版本，
 * drama 后续接 sau 时将迁到这个共享版本。
 */
export interface CreatePublishJobInput {
  projectId: ID;
  /** sau-service 要拉取的源视频 URL（公开可访问） */
  videoUrl: string;
  title: string;
  description: string;
  tags: string[];
  coverUrl?: string;
  /**
   * 抖音商品挂载链接 — sau-service 透传给 DouYinVideo(productLink=...)；
   * 仅抖音 target 消费，其它平台静默忽略。留空 = 非带货视频。
   */
  productLink?: string;
  /** 抖音商品挂载文案 — DouYinVideo(productTitle=...)。 */
  productTitle?: string;
  /** 一次提交多个平台目标；每条产生独立的 PublishJob 行 */
  targets: Array<{
    platform: SocialPlatform;
    socialAccountId: ID;
    scheduledAt?: ISODateTime;
  }>;
}

/**
 * sau-service 回调 server 的载荷（/api/internal/sau/job-callback）。
 * 前端不直接消费；放在共享 types 里方便 server DTO 字段对齐 review。
 */
export interface PublishJobCallback {
  externalTaskId: string;
  status: PublishJobStatus;
  progress?: number;
  externalUrl?: string;
  errorCode?: string;
  errorMessage?: string;
}
