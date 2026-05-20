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
  SubmitPublishJobInteractionInput,
} from "@ai-star-eco/types/publish-job";
import type { ID } from "@ai-star-eco/types/_shared";
import { apiFetch } from "../_client";

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
