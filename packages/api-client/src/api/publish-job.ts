// ─────────────────────────────────────────────────────────────────────────────
// api/publish-job.ts — 用户分发任务 API（network-only）。
// 对应后端 PublishJobController：/api/me/publish-jobs/*
//
// 与 apps/web-drama/src/api/distribution.ts 里的 legacy `/distribution/jobs/*`
// 并存：drama 还在用老路径，celebrity sau 流程走 /me/publish-jobs/*。
// 待 drama 接 sau 后，旧路径会被这套替换。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  PublishJob,
  CreatePublishJobInput,
  PublishBatchSummary,
  RescheduleBatchInput,
  ScheduleSpec,
  SubmitPublishJobInteractionInput,
} from "@ai-star-eco/types/publish-job";
import type { ID, PaginatedResponse } from "@ai-star-eco/types/_shared";
import { apiFetch, apiFetchPaginated } from "../_client";

export interface ListPublishJobsQuery {
  projectId?: ID;
  status?: string;
}

export async function listPublishJobs(q: ListPublishJobsQuery = {}): Promise<PublishJob[]> {
  return apiFetch<PublishJob[]>("/me/publish-jobs", {
    query: { projectId: q.projectId, status: q.status },
  });
}

export async function getPublishJob(id: ID): Promise<PublishJob> {
  return apiFetch<PublishJob>(`/me/publish-jobs/${encodeURIComponent(id)}`);
}

/** 批量创建（按 input.targets 数组的长度产生多个 PublishJob，状态均为 queued，不扣费） */
export async function createPublishJobs(input: CreatePublishJobInput): Promise<PublishJob[]> {
  return apiFetch<PublishJob[]>("/me/publish-jobs", {
    method: "POST",
    body: input,
  });
}

/** queued → uploading；此时扣费（失败不退） */
export async function startPublishJob(id: ID): Promise<PublishJob> {
  return apiFetch<PublishJob>(`/me/publish-jobs/${encodeURIComponent(id)}/start`, {
    method: "POST",
  });
}

export async function cancelPublishJob(id: ID): Promise<PublishJob> {
  return apiFetch<PublishJob>(`/me/publish-jobs/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
  });
}

export async function retryPublishJob(id: ID): Promise<PublishJob> {
  return apiFetch<PublishJob>(`/me/publish-jobs/${encodeURIComponent(id)}/retry`, {
    method: "POST",
  });
}

/**
 * 提交人机交互响应（短信验证码等）。
 * 仅在 task.status=awaiting_user 时有效；其它状态 server 返回 409。
 * 提交成功后 server 立即把响应转给 sau-service；前端继续轮询拿状态变化。
 */
export async function submitPublishJobInteraction(
  id: ID,
  input: SubmitPublishJobInteractionInput,
): Promise<PublishJob> {
  return apiFetch<PublishJob>(`/me/publish-jobs/${encodeURIComponent(id)}/interact`, {
    method: "POST",
    body: input,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// v0.22: 按 projectId 聚合的批次接口（分发中心「任务追踪」用）
// 服务端路由：/api/me/publish-jobs/batches/*
// ─────────────────────────────────────────────────────────────────────────────

export interface ListBatchesQuery {
  /** 0-indexed；缺省 0 */
  page?: number;
  /** 每页批次数；缺省 20，上限 100 */
  limit?: number;
}

/**
 * 列出当前用户的批次摘要（服务端分页 + 按最近活跃排序）。
 * 返回 PaginatedResponse 而不是 PublishBatchSummary[]，让前端拿到 total / hasNext。
 */
export async function listBatches(
  q: ListBatchesQuery = {},
): Promise<PaginatedResponse<PublishBatchSummary>> {
  return apiFetchPaginated<PublishBatchSummary>("/me/publish-jobs/batches", {
    query: { page: q.page, limit: q.limit },
  });
}

/** 单个批次摘要（轮询 Drawer 头部用得到，admin 调试方便）。 */
export async function getBatch(projectId: ID): Promise<PublishBatchSummary> {
  return apiFetch<PublishBatchSummary>(
    `/me/publish-jobs/batches/${encodeURIComponent(projectId)}`,
  );
}

/** 取消整批：所有非终止态行 → cancelled；返回受影响 job 的最新 DTO 列表。 */
export async function cancelBatch(projectId: ID): Promise<PublishJob[]> {
  return apiFetch<PublishJob[]>(
    `/me/publish-jobs/batches/${encodeURIComponent(projectId)}/cancel`,
    { method: "POST" },
  );
}

/** 重试整批失败：仅对 status=failed 的 job 生效；每条 retry 走 startJob 会扣费一次。 */
export async function retryFailedBatch(projectId: ID): Promise<PublishJob[]> {
  return apiFetch<PublishJob[]>(
    `/me/publish-jobs/batches/${encodeURIComponent(projectId)}/retry-failed`,
    { method: "POST" },
  );
}

/**
 * 重新调度未开始：仅对 status=queued 子集生效。
 * 已开始 / 终态行原样保留 —— 不重设 scheduledAt、不重置 progress。
 */
export async function rescheduleBatch(
  projectId: ID,
  schedule: ScheduleSpec,
): Promise<PublishJob[]> {
  const body: RescheduleBatchInput = { schedule };
  return apiFetch<PublishJob[]>(
    `/me/publish-jobs/batches/${encodeURIComponent(projectId)}/reschedule`,
    { method: "POST", body },
  );
}
