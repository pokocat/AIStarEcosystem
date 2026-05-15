// publish-job.ts — 分发发布任务（drama 端发起，server DTO 待落地）。

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
