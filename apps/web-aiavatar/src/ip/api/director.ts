// ─────────────────────────────────────────────────────────────────────────────
// api/director.ts — AI 导演台。服务端：/api/v1/ip-studio/director/**（DirectorController）。
// 演示模式（USE_MOCK=1）只给空作品列表，其余操作明确提示不可用，不在浏览器里假造生成结果。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  DirectorAudioUpload, DirectorEditOp, DirectorPipelineAction, DirectorPipelineEstimate, DirectorPipelineTarget, DirectorQuote, DirectorTaskType, DirectorWork, DirectorWorkSummary,
} from "@ai-star-eco/types";
import type { EnterpriseBillingSelection } from "@ai-star-eco/types/enterprise";
import { ApiError } from "@ai-star-eco/api-client";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

/**
 * 作品级请求失败成 404 DIRECTOR_WORK_NOT_FOUND 时记下是哪部作品。工作台只对自己那部作品的 404 换成「已删除」：
 * 切到别的作品后，上一部作品迟到的 404 不能把当前作品标成已删除、清掉它的草稿（2026-10-28 独立复核）。
 */
const goneWork = new WeakMap<object, string>();

export function scopeToWork<T>(id: string, request: Promise<T>): Promise<T> {
  return request.catch((e: unknown) => {
    if (e instanceof ApiError && e.code === "DIRECTOR_WORK_NOT_FOUND") goneWork.set(e, id);
    throw e;
  });
}

/** 这个错误是哪部作品的「已删除或不存在」；不是作品级 404 或无法归属时返回 null。 */
export function goneWorkId(e: unknown): string | null {
  return typeof e === "object" && e !== null ? goneWork.get(e) ?? null : null;
}

function demoUnavailable(): never {
  throw new ApiError({ code: "DIRECTOR_DEMO_UNAVAILABLE", message: "演示模式不支持 AI 导演台，请登录后使用。" }, 400);
}

export async function listWorks(): Promise<DirectorWorkSummary[]> {
  if (USE_MOCK) return mockDelay([]);
  return apiFetch<DirectorWorkSummary[]>("/v1/ip-studio/director/works");
}

export async function createWork(body: { title?: string; idea?: string; script?: string }): Promise<DirectorWork> {
  if (USE_MOCK) demoUnavailable();
  return apiFetch<DirectorWork>("/v1/ip-studio/director/works", { method: "POST", body: JSON.stringify(body) });
}

export async function getWork(id: string): Promise<DirectorWork> {
  if (USE_MOCK) demoUnavailable();
  return scopeToWork(id, apiFetch<DirectorWork>(`/v1/ip-studio/director/works/${encodeURIComponent(id)}`));
}

export async function patchWork(id: string, body: { title?: string; idea?: string; draft?: string; draftRev?: number;
  settings?: Partial<{ style: string; aspectRatio: string; textModel: string | null; videoModel: string | null }> }): Promise<DirectorWork> {
  if (USE_MOCK) demoUnavailable();
  return scopeToWork(id, apiFetch<DirectorWork>(`/v1/ip-studio/director/works/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }));
}

export async function deleteWork(id: string): Promise<void> {
  if (USE_MOCK) demoUnavailable();
  await scopeToWork(id, apiFetch<{ deleted: boolean }>(`/v1/ip-studio/director/works/${encodeURIComponent(id)}`, { method: "DELETE" }));
}

export async function edit(id: string, op: DirectorEditOp, targetId: string | null, rev: number | null, data?: object): Promise<DirectorWork> {
  if (USE_MOCK) demoUnavailable();
  return scopeToWork(id, apiFetch<DirectorWork>(`/v1/ip-studio/director/works/${encodeURIComponent(id)}/edits`, {
    method: "POST", body: JSON.stringify({ op, targetId, rev, data: data ?? {} }),
  }));
}

export async function runTask(id: string, body: { type: DirectorTaskType; targetId?: string | null; clientRequestId: string;
  options?: object; billing?: EnterpriseBillingSelection | null; maxCost?: number }): Promise<DirectorWork> {
  if (USE_MOCK) demoUnavailable();
  return scopeToWork(id, apiFetch<DirectorWork>(`/v1/ip-studio/director/works/${encodeURIComponent(id)}/tasks`, { method: "POST", body: JSON.stringify(body) }));
}

export async function pipeline(id: string, body: { action: DirectorPipelineAction; scope?: "episode" | "work";
  episodeId?: string | null; target?: DirectorPipelineTarget; budget?: number; billing?: EnterpriseBillingSelection | null; auto?: boolean }): Promise<DirectorWork> {
  if (USE_MOCK) demoUnavailable();
  return scopeToWork(id, apiFetch<DirectorWork>(`/v1/ip-studio/director/works/${encodeURIComponent(id)}/pipeline`, { method: "POST", body: JSON.stringify(body) }));
}

export async function estimatePipeline(id: string, body: { scope: "episode" | "work"; episodeId: string | null; target: DirectorPipelineTarget }): Promise<DirectorPipelineEstimate> {
  if (USE_MOCK) demoUnavailable();
  return scopeToWork(id, apiFetch<DirectorPipelineEstimate>(`/v1/ip-studio/director/works/${encodeURIComponent(id)}/pipeline/estimate`, { method: "POST", body: JSON.stringify(body) }));
}

export async function quote(id: string, targetIds: string[]): Promise<DirectorQuote> {
  if (USE_MOCK) demoUnavailable();
  return scopeToWork(id, apiFetch<DirectorQuote>(`/v1/ip-studio/director/works/${encodeURIComponent(id)}/quote`, { method: "POST", body: JSON.stringify({ type: "video", targetIds }) }));
}

/** 角色声音样本（mp3 / wav / m4a）。 */
export async function uploadAudio(id: string, file: File): Promise<DirectorAudioUpload> {
  if (USE_MOCK) demoUnavailable();
  const form = new FormData();
  form.append("file", file);
  return scopeToWork(id, apiFetch<DirectorAudioUpload>(`/v1/ip-studio/director/works/${encodeURIComponent(id)}/uploads`, { method: "POST", body: form }));
}
