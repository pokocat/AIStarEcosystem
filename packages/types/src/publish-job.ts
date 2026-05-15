// ─────────────────────────────────────────────────────────────────────────────
// publish-job.ts — 分发发布任务（drama 多平台 publish 流水）。
// 上推自 apps/web-drama/src/types/publish-job.ts；server *Dto 需 mirror 字段名。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

export type PublishJobStatus =
  | "queued"
  | "uploading"
  | "transcoding"
  | "publishing"
  | "live"
  | "failed";

export interface PublishJob {
  id: ID;
  projectId: ID;
  /** 目标平台 id（Platform.id） */
  platformId: ID;
  platformName: string;
  status: PublishJobStatus;
  /** 0-100 */
  progress: number;
  externalUrl?: string;
  errorMessage?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  scheduledAt?: ISODateTime;
}
