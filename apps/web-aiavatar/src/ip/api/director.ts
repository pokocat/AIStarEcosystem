// ─────────────────────────────────────────────────────────────────────────────
// api/director.ts — AI 导演台。服务端：/api/v1/ip-studio/director/**（DirectorController）。
// 演示模式（USE_MOCK=1）只给空作品列表，其余操作明确提示不可用，不在浏览器里假造生成结果。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  DirectorAudioUpload, DirectorEditOp, DirectorPipelineAction, DirectorPipelineEstimate, DirectorPipelineTarget, DirectorQuote, DirectorScriptImportResult, DirectorTaskType, DirectorTrashedWork, DirectorRestoreResult, DirectorWork, DirectorWorkSummary,
} from "@ai-star-eco/types";
import type { EnterpriseBillingSelection } from "@ai-star-eco/types/enterprise";
import { ApiError } from "@ai-star-eco/api-client";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

/**
 * 作品级请求失败成 404 DIRECTOR_WORK_NOT_FOUND 时记下是哪部作品、在哪一个「恢复代次」发出的。
 * 工作台只对自己那部作品、当前代次的 404 换成「已删除」：
 * - 切到别的作品后，上一部作品迟到的 404 不能把当前作品标成已删除、清掉它的草稿（2026-10-28 独立复核）；
 * - 作品删除期间发出的保存 / 生成请求，在作品恢复之后才以 404 回来，也不能把已恢复的作品打回已删除、清掉恢复后写的草稿
 *   （2026-10-29 独立复核）。代次在本页恢复成功、或任何响应带回一个没见过的 restoredAt 时前进；不比较客户端或服务端时钟。
 *   恢复之后发出的请求是新代次，它们的 404 照常算已删除。
 */
type GoneTag = { id: string; epoch: number };
const goneWork = new WeakMap<object, GoneTag>();
const epochs = new Map<string, number>();
const restoresSeen = new Map<string, Set<string>>();

function epochOf(id: string) { return epochs.get(id) ?? 0; }
function nextEpoch(id: string) { epochs.set(id, epochOf(id) + 1); }

/** 响应里带回作品的 restoredAt：第一次见到这个值，说明作品（在本页或别处）被恢复过一次，之前发出的请求都算旧代次。 */
function noteRestored(id: string, restoredAt: unknown) {
  if (typeof restoredAt !== "string" || !restoredAt) return;
  let seen = restoresSeen.get(id);
  if (!seen) restoresSeen.set(id, seen = new Set());
  if (seen.has(restoredAt)) return;
  seen.add(restoredAt);
  nextEpoch(id);
}

export function scopeToWork<T>(id: string, request: Promise<T>): Promise<T> {
  const epoch = epochOf(id); // 发出时的代次
  return request.then(result => {
    if (result && typeof result === "object" && "restoredAt" in result) noteRestored(id, (result as { restoredAt?: unknown }).restoredAt);
    return result;
  }, (e: unknown) => {
    if (e instanceof ApiError && e.code === "DIRECTOR_WORK_NOT_FOUND") goneWork.set(e, { id, epoch });
    throw e;
  });
}

/** 这个错误是哪部作品当前代次的「已删除或不存在」；不是作品级 404、无法归属、或是恢复之前发出的旧请求时返回 null。 */
export function goneWorkId(e: unknown): string | null {
  const tag = typeof e === "object" && e !== null ? goneWork.get(e) : undefined;
  return tag && tag.epoch === epochOf(tag.id) ? tag.id : null;
}

/** 作品恢复之前发出、恢复之后才回来的 404：请求没有生效，但作品现在在，不能当成已删除。 */
export function isStaleGone(e: unknown): boolean {
  const tag = typeof e === "object" && e !== null ? goneWork.get(e) : undefined;
  return !!tag && tag.epoch !== epochOf(tag.id);
}

function demoUnavailable(): never {
  throw new ApiError({ code: "DIRECTOR_DEMO_UNAVAILABLE", message: "演示模式不支持短剧导演台，请登录后使用。" }, 400);
}

export async function listWorks(): Promise<DirectorWorkSummary[]> {
  if (USE_MOCK) return mockDelay([]);
  return apiFetch<DirectorWorkSummary[]>("/v1/ip-studio/director/works");
}

export async function createWork(body: { title?: string; idea?: string; script?: string }): Promise<DirectorWork> {
  if (USE_MOCK) demoUnavailable();
  return apiFetch<DirectorWork>("/v1/ip-studio/director/works", { method: "POST", body: JSON.stringify(body) });
}

/** Free, stateless extraction. Importing a file does not create or change a work. */
export async function importScript(file: File, signal?: AbortSignal): Promise<DirectorScriptImportResult> {
  if (USE_MOCK) demoUnavailable();
  const form = new FormData();
  form.append("file", file);
  return apiFetch<DirectorScriptImportResult>("/v1/ip-studio/director/script-import", { method: "POST", body: form, signal });
}

export async function getWork(id: string): Promise<DirectorWork> {
  if (USE_MOCK) demoUnavailable();
  return scopeToWork(id, apiFetch<DirectorWork>(`/v1/ip-studio/director/works/${encodeURIComponent(id)}`));
}

export async function patchWork(id: string, body: { title?: string; idea?: string; draft?: string; draftRev?: number;
  settings?: Partial<{ style: string; aspectRatio: string; textModel: string | null; videoModel: string | null; imageModel: string | null }> }): Promise<DirectorWork> {
  if (USE_MOCK) demoUnavailable();
  return scopeToWork(id, apiFetch<DirectorWork>(`/v1/ip-studio/director/works/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }));
}

/** 回收站：本人已删除的作品，最近删除的在前。只读，不改作品。 */
export async function listTrash(): Promise<DirectorTrashedWork[]> {
  if (USE_MOCK) return mockDelay([]);
  return apiFetch<DirectorTrashedWork[]>("/v1/ip-studio/director/works/trash");
}

/** 从回收站恢复原作品；恢复后保持停止，不续跑、不扣费。 */
export async function restoreWork(id: string): Promise<DirectorRestoreResult> {
  if (USE_MOCK) demoUnavailable();
  const result = await scopeToWork(id, apiFetch<DirectorRestoreResult>(`/v1/ip-studio/director/works/${encodeURIComponent(id)}/restore`, { method: "POST" }));
  nextEpoch(id); // 本页恢复成功：删除期间发出、还没回来的请求都成了旧代次
  return result;
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

export async function stopTask(id: string, runId: string): Promise<DirectorWork> {
  if (USE_MOCK) demoUnavailable();
  return scopeToWork(id, apiFetch<DirectorWork>(`/v1/ip-studio/director/works/${encodeURIComponent(id)}/tasks/${encodeURIComponent(runId)}/stop`, { method: "POST" }));
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
