// ─────────────────────────────────────────────────────────────────────────────
// api/mixcut.ts — 混剪专区：渲染任务的查询 / 创建 / 进度更新 + 引导态。
// 默认走 mock（localStorage write-through）；NEXT_PUBLIC_MIXCUT_USE_REAL=1 时
// 强制走 apps/server 的真后端（ffmpeg 渲染），不影响其他模块的 USE_MOCK 行为。
// ─────────────────────────────────────────────────────────────────────────────

import type { RenderJob, MixcutAsset, MixcutAssetKind, Template } from "@/components/mixcut-zone/types";
import { mockJobs, mockActivationCode, mockTemplates } from "@/mocks/mixcut";
import { migrateLegacyTemplate } from "@/components/mixcut-zone/lib/scene-helpers";
import { apiFetch, API_BASE_URL, getAuthToken, USE_MOCK, mockDelay } from "./_client";

const JOBS_KEY = "aistareco.web.mixcut.jobs.v1";
const INTRO_KEY = "aistareco.web.mixcut.has-seen-intro.v1";
const TEMPLATES_KEY = "aistareco.web.mixcut.templates.v1";

// 独立开关：仅对 mixcut 切换"真后端模式"，不影响 celebrity-zone / products 的 mock。
const REAL_BACKEND: boolean =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_MIXCUT_USE_REAL === "1";

const USE_LOCAL = USE_MOCK && !REAL_BACKEND;

let memoryJobs: RenderJob[] | null = null;

export function isLocalJobMode(): boolean {
  return USE_LOCAL;
}

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

// ── 模板编辑 / 另存为(localStorage-backed) ──────────────────────────────────
//
// 数据层模型:
//   - 工厂模板:mockTemplates(只读,id 前缀 tpl_xxx)
//   - 用户保存:localStorage[TEMPLATES_KEY] = Record<template_id, Template>
//   - 列表语义:用户模板覆盖同 ID 工厂模板;不重复的用户模板追加显示
//   - 删除用户模板 ⇒ 同 ID 工厂模板恢复显示(若存在)
//
// 暂不走 server —— 模板编辑器是设计师工具,不必触及后端 templates 表。
// 真后端版本(v0.11+):新增 /api/mixcut/templates CRUD,统一从 server 读取。

let memoryTemplates: Record<string, Template> | null = null;

function loadUserTemplates(): Record<string, Template> {
  if (memoryTemplates) return memoryTemplates;
  if (typeof window === "undefined") {
    memoryTemplates = {};
    return memoryTemplates;
  }
  try {
    const raw = window.localStorage.getItem(TEMPLATES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, Template>;
      if (parsed && typeof parsed === "object") {
        // v0.11: localStorage 里可能有旧版 flat-slots 模板,过迁移一遍
        const upgraded: Record<string, Template> = {};
        for (const [k, v] of Object.entries(parsed)) {
          upgraded[k] = migrateLegacyTemplate(v as any);
        }
        memoryTemplates = upgraded;
        return memoryTemplates;
      }
    }
  } catch {
    /* 隐私模式 / parse 失败 */
  }
  memoryTemplates = {};
  return memoryTemplates;
}

function saveUserTemplates() {
  if (typeof window === "undefined" || !memoryTemplates) return;
  try {
    window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(memoryTemplates));
  } catch {
    /* storage 满 */
  }
}

/** 列出所有模板(用户 ∪ 工厂)。用户模板覆盖同 ID 工厂模板。 */
export async function listTemplates(): Promise<Template[]> {
  const user = loadUserTemplates();
  const merged: Template[] = [];
  const seen = new Set<string>();
  // 用户模板优先(包含 override 与纯新模板)
  for (const t of Object.values(user)) {
    merged.push(t);
    seen.add(t.template_id);
  }
  // 未被 override 的工厂模板
  for (const t of mockTemplates) {
    if (!seen.has(t.template_id)) merged.push(t);
  }
  return mockDelay(merged);
}

/** 取单个模板:用户模板优先,fallback 工厂。 */
export async function getTemplate(id: string): Promise<Template | null> {
  const user = loadUserTemplates();
  if (user[id]) return mockDelay(user[id]);
  const factory = mockTemplates.find((t) => t.template_id === id);
  return mockDelay(factory ?? null);
}

/** 同步版本:供 server-component 与 useState 初始化使用(不需要 await)。 */
export function getTemplateSync(id: string): Template | null {
  const user = loadUserTemplates();
  if (user[id]) return user[id];
  return mockTemplates.find((t) => t.template_id === id) ?? null;
}

/** 写入/覆盖一个用户模板。 */
export async function saveTemplate(t: Template): Promise<Template> {
  const store = loadUserTemplates();
  store[t.template_id] = t;
  saveUserTemplates();
  return mockDelay(t);
}

/** 删除用户模板(工厂模板会自动恢复显示)。 */
export async function deleteTemplate(id: string): Promise<boolean> {
  const store = loadUserTemplates();
  if (!store[id]) return mockDelay(false);
  delete store[id];
  saveUserTemplates();
  return mockDelay(true);
}

/** 判断 ID 是否存在用户保存版本(纯新模板或覆盖工厂模板的“我的版本”)。 */
export function hasUserTemplate(id: string): boolean {
  const store = loadUserTemplates();
  return !!store[id];
}

/** 判断 ID 是否对应一条工厂模板(即不可硬删除,只能 override)。 */
export function isFactoryTemplate(id: string): boolean {
  return mockTemplates.some((t) => t.template_id === id);
}
