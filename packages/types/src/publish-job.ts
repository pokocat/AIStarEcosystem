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
 *
 * v0.22 起 projectId 改为可选 —— 缺省时后端自动生成
 * "manual-batch-<userId>-<yyyyMMddHHmmss>"，让分发中心「任务追踪」按批次聚合。
 * 调用方明确传 projectId（如 mixcut 批量场景）继续按传入值落库。
 */
export interface CreatePublishJobInput {
  projectId?: ID;
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

// ─────────────────────────────────────────────────────────────────────────────
// v0.20: 调度策略 discriminator union（mixcut 批量发布 + v0.22 任务追踪 reschedule 共享）
// 后端 ScheduleSpec sealed interface 1:1 对齐（apps/server/.../dto/MixcutPublishBatchRequest.java）。
//   - immediate         立即派单（scheduledAt = now）
//   - single            全部条目派单同一时间起飞（兼容 v0.15 行为）
//   - daily_recurring   按时段 / 天数把 N 条铺开成错峰 scheduledAt
// 注意：wire key 是 snake_case（mixcut DTO 用 @JsonProperty 映射），与一般 camelCase
// 字段约定的例外 —— 后端契约真值在 MixcutPublishBatchRequest.ScheduleSpec。
// ─────────────────────────────────────────────────────────────────────────────
export type ScheduleSpec =
  | { strategy: "immediate" }
  | { strategy: "single"; at: string /* ISO 8601 UTC */ }
  | {
      strategy: "daily_recurring";
      /** "YYYY-MM-DD" 在 timezone 下的日历日 */
      start_date: string;
      /** ["09:00","12:00","18:00"]，HH:MM 24h；后端会排序去重 */
      time_slots: string[];
      /** IANA, 例 "Asia/Shanghai" */
      timezone: string;
      /** null = 直到 outputs 用完；非 null 时要 N <= max_days * time_slots.length */
      max_days?: number;
      /** [0, 30]；null/0 = 无抖动。每条 slot 加 [-N, +N] 分钟随机偏移 */
      jitter_minutes?: number;
    };

// ─────────────────────────────────────────────────────────────────────────────
// v0.22: 任务追踪「按 projectId 聚合」的 summary 卡片
// 服务端 GET /api/me/publish-jobs/batches 返回 PageEnvelope<PublishBatchSummary>
// ─────────────────────────────────────────────────────────────────────────────

/** projectId 前缀派生的来源标签，给前端选 icon / badge 用 */
export type PublishBatchSource = "mixcut" | "manual" | "other";

export interface PublishBatchSummary {
  projectId: string;
  source: PublishBatchSource;
  /** "<title> ×N"；title 取批次内首条 non-blank，缺则 "未命名" */
  displayTitle: string;
  totalJobs: number;
  /** 8 个 wire key → count；0 也保留方便前端对齐渲染 */
  statusCounts: Partial<Record<PublishJobStatus, number>>;
  /** (live + failed + cancelled) / total * 100，floor */
  progressPct: number;
  firstCreatedAt: ISODateTime;
  lastCreatedAt: ISODateTime;
  firstScheduledAt: ISODateTime | null;
  lastScheduledAt: ISODateTime | null;
  /** distinct platform wire 名，稳定顺序（首次出现序） */
  platforms: string[];
  /** queued / uploading / transcoding / publishing / awaiting_user 任一非零 */
  hasInflight: boolean;
}

/**
 * POST /api/me/publish-jobs/batches/{projectId}/reschedule 请求体。
 * 仅对 status=queued 的子集生效；其他状态原样保留。
 */
export interface RescheduleBatchInput {
  schedule: ScheduleSpec;
}
