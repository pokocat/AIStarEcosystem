// ─────────────────────────────────────────────────────────────────────────────
// api/mixcut.ts — 混剪专区：渲染任务的查询 / 创建 / 进度更新 + 引导态。
// 默认走 mock（localStorage write-through）；NEXT_PUBLIC_MIXCUT_USE_REAL=1 时
// 强制走 apps/server 的真后端（ffmpeg 渲染），不影响其他模块的 USE_MOCK 行为。
// ─────────────────────────────────────────────────────────────────────────────

import type { RenderJob, MixcutAsset, MixcutAssetKind } from "@/components/mixcut-zone/types";
import { mockJobs, mockActivationCode } from "@/mocks/mixcut";
import { apiFetch, API_BASE_URL, getAuthToken, USE_MOCK, mockDelay } from "./_client";

const JOBS_KEY = "aistareco.web.mixcut.jobs.v1";
const INTRO_KEY = "aistareco.web.mixcut.has-seen-intro.v1";

// 独立开关：仅对 mixcut 切换"真后端模式"，不影响 celebrity-zone / products 的 mock。
const REAL_BACKEND: boolean =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_MIXCUT_USE_REAL === "1";

const USE_LOCAL = USE_MOCK && !REAL_BACKEND;

let memoryJobs: RenderJob[] | null = null;

function loadJobs(): RenderJob[] {
  if (memoryJobs) return memoryJobs;
  if (typeof window === "undefined") {
    memoryJobs = [...mockJobs];
    return memoryJobs;
  }
  try {
    const raw = window.localStorage.getItem(JOBS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as RenderJob[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryJobs = parsed;
        return memoryJobs;
      }
    }
  } catch {
    /* 隐私模式 / parse 失败 → 回种 */
  }
  memoryJobs = [...mockJobs];
  saveJobs();
  return memoryJobs;
}

function saveJobs() {
  if (typeof window === "undefined" || !memoryJobs) return;
  try {
    window.localStorage.setItem(JOBS_KEY, JSON.stringify(memoryJobs));
  } catch {
    /* storage 满，静默失败 */
  }
}

// ── 公共 API ────────────────────────────────────────────────────────────────

export async function listJobs(): Promise<RenderJob[]> {
  if (USE_LOCAL) return mockDelay([...loadJobs()]);
  return apiFetch<RenderJob[]>("/mixcut/jobs");
}

export async function getJob(id: string): Promise<RenderJob | null> {
  if (USE_LOCAL) return mockDelay(loadJobs().find((j) => j.id === id) ?? null);
  return apiFetch<RenderJob | null>(`/mixcut/jobs/${id}`);
}

export async function createJob(job: RenderJob): Promise<RenderJob> {
  if (USE_LOCAL) {
    const list = loadJobs();
    list.unshift(job);
    saveJobs();
    return mockDelay(job);
  }
  return apiFetch<RenderJob>("/mixcut/jobs", { method: "POST", body: job });
}

export async function updateJobProgress(
  id: string,
  progress: number,
  status?: RenderJob["status"],
): Promise<void> {
  if (USE_LOCAL) {
    const list = loadJobs();
    const idx = list.findIndex((j) => j.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], progress, status: status ?? list[idx].status };
      saveJobs();
    }
    return mockDelay(undefined);
  }
  await apiFetch<void>(`/mixcut/jobs/${id}/progress`, {
    method: "PATCH",
    body: { progress, status },
  });
}

// ── 引导态（hasSeenIntro / setSeenIntro 同步读写 localStorage） ──────────────

export function hasSeenIntro(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return true;
  }
}

export function setSeenIntro() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INTRO_KEY, "1");
  } catch {
    /* 静默失败 */
  }
}

// ── 配额 / 激活码（mock 演示态；后续接 AccountApi.getMyQuota 之类） ──────────
export { mockActivationCode };

// ── 用户上传素材（v0.9 真后端） ─────────────────────────────────────────────

export interface AssetFilter {
  kind?: MixcutAssetKind;
  userId?: string;
}

/** 列素材；可按 kind 与 user_id 筛选。 */
export async function listAssets(filter?: AssetFilter): Promise<MixcutAsset[]> {
  if (USE_LOCAL) {
    // 本地模式：没有上传能力，返回空列表（前端兜底用 mockAssets 等）
    return mockDelay([]);
  }
  const qs = new URLSearchParams();
  if (filter?.kind) qs.set("kind", filter.kind);
  if (filter?.userId) qs.set("user_id", filter.userId);
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiFetch<MixcutAsset[]>(`/mixcut/assets${suffix}`);
}

/**
 * 上传素材（multipart）。
 *  - file：MultipartFile（必填）
 *  - kind：video / image / sticker / bgm（必填）
 *  - userId / name / tags：可选
 *
 * 不走 apiFetch（它默认 JSON Content-Type），直接 fetch + FormData。
 * 但仍要带 Bearer token，路径走 Next rewrites（/api/mixcut/assets → server 8080）。
 */
export async function uploadAsset(params: {
  file: File;
  kind: MixcutAssetKind;
  userId?: string;
  name?: string;
  tags?: string;
}): Promise<MixcutAsset> {
  if (USE_LOCAL) {
    throw new Error("本地 mock 模式不支持真上传；设 NEXT_PUBLIC_MIXCUT_USE_REAL=1 或 NEXT_PUBLIC_USE_MOCK=0");
  }
  const fd = new FormData();
  fd.append("file", params.file, params.file.name);
  fd.append("kind", params.kind);
  if (params.userId) fd.append("user_id", params.userId);
  if (params.name) fd.append("name", params.name);
  if (params.tags) fd.append("tags", params.tags);

  const token = getAuthToken();
  const res = await fetch(`${API_BASE_URL}/mixcut/assets`, {
    method: "POST",
    body: fd,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  const json = (await res.json()) as { success: boolean; data?: MixcutAsset; message?: string; error?: { message?: string } };
  if (!res.ok || !json.success || !json.data) {
    const msg = json.message || json.error?.message || `上传失败 (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return json.data;
}

export async function deleteAsset(id: string): Promise<boolean> {
  if (USE_LOCAL) return mockDelay(true);
  return apiFetch<boolean>(`/mixcut/assets/${id}`, { method: "DELETE" });
}
