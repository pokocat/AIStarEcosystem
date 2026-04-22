// ─────────────────────────────────────────────────────────────────────────────
// api/generation.ts — admin 侧生成任务审计接口。
// 用于后台查询全平台生成记录（按 userId / artistId / 时间范围筛选），
// 以及人工中止异常 job、回填扣费 / 退款。
// ─────────────────────────────────────────────────────────────────────────────

import type { GenerationJob } from "@/types/generation";
import { GENERATION_JOBS } from "@/mocks/generation";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

export async function listJobs(): Promise<GenerationJob[]> {
  if (USE_MOCK) return mockDelay(GENERATION_JOBS);
  return apiFetch<GenerationJob[]>("/admin/generation/jobs");
}

export async function getJob(id: string): Promise<GenerationJob> {
  if (USE_MOCK) {
    const job = GENERATION_JOBS.find((j) => j.id === id);
    if (!job) throw new Error(`generation job not found: ${id}`);
    return mockDelay(job);
  }
  return apiFetch<GenerationJob>(`/admin/generation/jobs/${encodeURIComponent(id)}`);
}

export interface AbortPayload {
  reason?: string;
}

/** 人工中止一个异常 / 卡死的 job，不退费（如需退费走 refund）。 */
export async function abortJob(id: string, payload?: AbortPayload): Promise<GenerationJob> {
  if (USE_MOCK) {
    const job = GENERATION_JOBS.find((j) => j.id === id);
    if (!job) throw new Error(`generation job not found: ${id}`);
    job.status = "aborted";
    job.completedAt = new Date().toISOString();
    return mockDelay(job);
  }
  return apiFetch<GenerationJob>(`/admin/generation/jobs/${encodeURIComponent(id)}/abort`, {
    method: "POST",
    body: payload ?? {},
  });
}

export interface RefundPayload {
  reason: string;
  /** 退回的 credits 数量；后台可按需全额或部分退 */
  credits?: number;
}

/** 申请 credits 退款。记入审计日志，触发钱包补账。 */
export async function refundJob(id: string, payload: RefundPayload): Promise<GenerationJob> {
  if (USE_MOCK) {
    const job = GENERATION_JOBS.find((j) => j.id === id);
    if (!job) throw new Error(`generation job not found: ${id}`);
    return mockDelay(job);
  }
  return apiFetch<GenerationJob>(`/admin/generation/jobs/${encodeURIComponent(id)}/refund`, {
    method: "POST",
    body: payload,
  });
}
