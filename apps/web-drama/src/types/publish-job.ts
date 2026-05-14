// types/publish-job.ts — 分发发布任务（drama 本地，尚未上推 packages/types）。

import type { ID, ISODateTime } from "@ai-star-eco/types/_shared";

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
