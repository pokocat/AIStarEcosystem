// ─────────────────────────────────────────────────────────────────────────────
// api/publish-job.ts — Admin 发布任务 + 事件流读 API。
// 对应 AdminPublishJobController。仅读视图，不暴露 cancel/retry。
// ─────────────────────────────────────────────────────────────────────────────

import type { PublishJob, PublishJobEvent, PublishJobStatus } from "@/types/publish-job";
import { apiFetch, USE_MOCK, mockDelay, buildQuery } from "./_client";
import { PUBLISH_JOBS, PUBLISH_JOB_EVENTS } from "@/mocks/publish-job";

export async function listPublishJobs(status?: PublishJobStatus): Promise<PublishJob[]> {
  if (USE_MOCK) {
    const all = PUBLISH_JOBS;
    return mockDelay(status ? all.filter((j) => j.status === status) : all);
  }
  return apiFetch<PublishJob[]>(`/admin/publish-jobs${buildQuery({ status })}`);
}

export async function listPublishJobEvents(jobId: string): Promise<PublishJobEvent[]> {
  if (USE_MOCK) return mockDelay(PUBLISH_JOB_EVENTS[jobId] ?? []);
  return apiFetch<PublishJobEvent[]>(`/admin/publish-jobs/${encodeURIComponent(jobId)}/events`);
}
