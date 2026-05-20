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
  | "awaiting_user"
  | "failed"
  | "cancelled";

/**
 * 平台弹出的需要用户输入才能继续的人机交互（短信验证码 / 滑块验证码 / ...）。
 * sau-service watcher 检测到 page 上出现对应弹窗时通过 callback 推到 server，
 * 前端展示输入 UI；用户提交后 POST /me/publish-jobs/{id}/interact 转回 sau-service
 * 填入页面、点确认，上游 upload() 的发布按钮 retry 循环自然继续。
 */
export interface InteractionRequired {
  /** 交互类型；MVP 仅 sms，后续可加 captcha / slider 等 */
  kind: "sms";
  /** 给用户看的提示文案（中文，单语） */
  prompt: string;
  /** 已脱敏的手机号尾号，例如 "138****5678"；可能为 null（平台未暴露） */
  phoneMasked?: string;
  /** 下次允许重发短信的时间戳（ISO）；未到点前 UI 应灰掉「重新发送」按钮 */
  canResendAt?: ISODateTime;
  /** 进入 awaiting_user 状态的时间戳；前端用来算等待时长 + 超时倒计时 */
  createdAt: ISODateTime;
}

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
  /**
   * 当 status=awaiting_user 时存在；其他状态置 null。
   * status 离开 awaiting_user（用户已提交或超时）后由 server 清空。
   */
  interactionRequired?: InteractionRequired | null;
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
  /** 进入 / 离开 awaiting_user 时由 sau-service 透传；其它 status 必须留空 */
  interactionRequired?: InteractionRequired | null;
}

/**
 * 用户在前端提交的交互响应（短信验证码等）。
 * POST /api/me/publish-jobs/{id}/interact 入参。
 */
export interface SubmitPublishJobInteractionInput {
  /** 用户输入的内容 — sms 为 6 位数字字符串 */
  code: string;
}
