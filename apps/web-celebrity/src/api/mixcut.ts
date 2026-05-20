// ─────────────────────────────────────────────────────────────────────────────
// api/mixcut.ts — 混剪专区：渲染任务的查询 / 创建 / 进度更新 + 引导态。
// 默认走 mock（localStorage write-through）；NEXT_PUBLIC_MIXCUT_USE_REAL=1 时
// 强制走 apps/server 的真后端（ffmpeg 渲染），不影响其他模块的 USE_MOCK 行为。
// ─────────────────────────────────────────────────────────────────────────────

import type { RenderJob, RenderOutput, MixcutAsset, MixcutAssetKind, Template } from "@/components/mixcut-zone/types";
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

/** 判断当前 mixcut 是否在纯 mock 模式（用于决定是否跑前端模拟器）。 */
export function isMockMode(): boolean {
  return USE_LOCAL;
}

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

/**
 * 仅 mock 模式：把模拟生成完成后的 outputs 一次性写回 job。
 * 真后端模式下 outputs 由 ffmpeg worker 写入 DB,由 GET /mixcut/jobs/{id} 自动返回,
 * 此函数 no-op。
 */
export function completeJobInMock(jobId: string, outputs: RenderOutput[]): void {
  if (!USE_LOCAL) return;
  const list = loadJobs();
  const idx = list.findIndex((j) => j.id === jobId);
  if (idx < 0) return;
  list[idx] = {
    ...list[idx],
    status: "success",
    progress: 100,
    outputs,
    completed_at: list[idx].completed_at ?? new Date().toISOString(),
  };
  saveJobs();
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
  /** v0.13+: 仅列预置素材（is_preset=true）。 */
  preset?: boolean;
  /** v0.13+: 预置分组过滤（sparkle / ribbon / emoji_burst 等）。 */
  presetGroup?: string;
}

/**
 * 列素材；默认返回当前用户上传的 + 全部预置素材。
 *  - filter.preset=true   → 仅返回预置池
 *  - filter.presetGroup   → 仅返回该分组的预置（隐含 preset=true 语义）
 *  - filter.kind=sticker  → 通常配合 preset=true 用，取扰动贴图池
 */
export async function listAssets(filter?: AssetFilter): Promise<MixcutAsset[]> {
  if (USE_LOCAL) {
    // 本地模式：没有上传能力，返回空列表（前端兜底用 mockAssets 等）
    return mockDelay([]);
  }
  const qs = new URLSearchParams();
  if (filter?.kind) qs.set("kind", filter.kind);
  if (filter?.preset === true) qs.set("preset", "true");
  if (filter?.presetGroup) qs.set("group", filter.presetGroup);
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiFetch<MixcutAsset[]>(`/mixcut/assets${suffix}`);
}

/** 便捷：列出预置扰动贴图池（kind=sticker, is_preset=true），按 group 分组返回。 */
export async function listPresetStickers(group?: string): Promise<MixcutAsset[]> {
  if (USE_LOCAL) return mockDelay([]);
  return listAssets({ kind: "sticker", preset: true, presetGroup: group });
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

// ── 模板编辑 / 另存为 ───────────────────────────────────────────────────────
//
// 数据层模型:
//   - 工厂模板:mockTemplates(写死前端) ∪ server seed(MixcutTemplateSeeder 落 mixcut_template
//     表;当前 seed 为空,前端 mocks 是 fallback 真值源)
//   - 用户保存:server mixcut_template 表中 ownerScope=<userId> 的行;
//     REAL_BACKEND 关闭时回落到 localStorage(隐私模式 / 离线开发体验)
//   - 列表语义:用户模板覆盖同 templateId 工厂模板;不重复的追加显示
//   - 删除用户模板 ⇒ 同 templateId 工厂模板恢复显示(若存在)
//
// USE_LOCAL(USE_MOCK && !REAL_BACKEND):localStorage 兜底,与原版行为完全一致
// REAL_BACKEND: 走 /api/mixcut/templates CRUD,mocks 作为 fallback 补齐 server 未 seed 的工厂模板

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

/**
 * 合并 server 返回与 mock fallback:按 template_id 去重,server 优先。
 * 用于 REAL_BACKEND 模式下补齐尚未 seed 到 server 的 factory 模板。
 */
function mergeWithMockFallback(serverList: Template[]): Template[] {
  const merged: Template[] = [];
  const seen = new Set<string>();
  for (const t of serverList) {
    merged.push(t);
    seen.add(t.template_id);
  }
  for (const t of mockTemplates) {
    if (!seen.has(t.template_id)) merged.push(t);
  }
  return merged;
}

/** 列出所有模板。USE_LOCAL: localStorage ∪ mocks。REAL_BACKEND: server ∪ mock fallback。 */
export async function listTemplates(): Promise<Template[]> {
  if (USE_LOCAL) {
    const user = loadUserTemplates();
    const merged: Template[] = [];
    const seen = new Set<string>();
    for (const t of Object.values(user)) {
      merged.push(t);
      seen.add(t.template_id);
    }
    for (const t of mockTemplates) {
      if (!seen.has(t.template_id)) merged.push(t);
    }
    return mockDelay(merged);
  }
  const serverList = await apiFetch<Template[]>("/mixcut/templates");
  return mergeWithMockFallback(Array.isArray(serverList) ? serverList : []);
}

/** 取单个模板:USE_LOCAL → localStorage > mock; REAL_BACKEND → server > mock fallback。 */
export async function getTemplate(id: string): Promise<Template | null> {
  if (USE_LOCAL) {
    const user = loadUserTemplates();
    if (user[id]) return mockDelay(user[id]);
    const factory = mockTemplates.find((t) => t.template_id === id);
    return mockDelay(factory ?? null);
  }
  try {
    const server = await apiFetch<Template | null>(`/mixcut/templates/${id}`);
    if (server) return migrateLegacyTemplate(server);
  } catch {
    /* server 404 / 网络故障 → 走 mock fallback */
  }
  return mockTemplates.find((t) => t.template_id === id) ?? null;
}

/** 同步版本:供 useState 初始化与 server component 使用(不需要 await)。仅查 mocks,不查 localStorage。 */
export function getTemplateSync(id: string): Template | null {
  const user = loadUserTemplates();
  if (user[id]) return user[id];
  return mockTemplates.find((t) => t.template_id === id) ?? null;
}

/** 写入/覆盖一个用户模板。 */
export async function saveTemplate(t: Template): Promise<Template> {
  if (USE_LOCAL) {
    const store = loadUserTemplates();
    store[t.template_id] = t;
    saveUserTemplates();
    return mockDelay(t);
  }
  return apiFetch<Template>(`/mixcut/templates/${t.template_id}`, {
    method: "PUT",
    body: t,
  });
}

/** 删除用户模板(工厂模板会自动恢复显示)。 */
export async function deleteTemplate(id: string): Promise<boolean> {
  if (USE_LOCAL) {
    const store = loadUserTemplates();
    if (!store[id]) return mockDelay(false);
    delete store[id];
    saveUserTemplates();
    return mockDelay(true);
  }
  return apiFetch<boolean>(`/mixcut/templates/${id}`, { method: "DELETE" });
}

/**
 * 判断 ID 是否存在用户保存版本。USE_LOCAL 模式精确;REAL_BACKEND 模式
 * 仅基于 localStorage 启发(server 端 is_factory 字段在 DTO 里,但本函数同步签名,
 * 调用方若需要权威结果应 await getTemplate 后看 is_factory)。
 */
export function hasUserTemplate(id: string): boolean {
  const store = loadUserTemplates();
  return !!store[id];
}

/** 判断 ID 是否对应一条工厂模板(即不可硬删除,只能 override)。 */
export function isFactoryTemplate(id: string): boolean {
  return mockTemplates.some((t) => t.template_id === id);
}

// ── v0.15+ 发布桥接 ─────────────────────────────────────────────────────────

/** 单个混剪变体的发布载荷（含 CDN URL）。 */
export interface MixcutPublishOutput {
  output_id: string;
  cdn_url: string;
  thumbnail_url?: string;
}

/** 单个发布目标（平台 + 账号 + 可选定时）。 */
export interface MixcutPublishTarget {
  platform: string;
  social_account_id: string;
  /** ISO 8601 字符串；省略 = 立即提交（仍走 QUEUED → 调度器/手动 start） */
  scheduled_at?: string;
}

/** publish-batch 请求。outputs × targets 笛卡尔积 = 实际派单数。 */
export interface MixcutPublishBatchRequest {
  source_mixcut_job_id?: string;
  outputs: MixcutPublishOutput[];
  title: string;
  description?: string;
  tags?: string[];
  cover_url?: string;
  targets: MixcutPublishTarget[];
  project_id?: string;
}

/** publish-batch 响应：部分成功语义。 */
export interface MixcutPublishBatchResult {
  success_jobs: unknown[];
  failed_items: { output_id?: string; reason: string; detail?: string }[];
  total_requested: number;
}

/**
 * 调 /api/me/mixcut/publish-batch 一次性派 outputs × targets 条 PublishJob。
 *
 * 注意：所有 outputs[].cdn_url 必须非空，否则后端会把该 output 计入 failedItems
 * （MISSING_CDN_URL）。前端在显示「批量发布」按钮前应过滤无 cdn_url 的变体。
 */
export async function publishBatch(req: MixcutPublishBatchRequest): Promise<MixcutPublishBatchResult> {
  if (USE_LOCAL) {
    throw new Error("本地 mock 模式不支持真发布；设 NEXT_PUBLIC_USE_MOCK=0 或 NEXT_PUBLIC_MIXCUT_USE_REAL=1");
  }
  return apiFetch<MixcutPublishBatchResult>("/me/mixcut/publish-batch", {
    method: "POST",
    body: req,
  });
}

// ── v0.16+ picgen 文字转图 ──────────────────────────────────────────────────

/** picgen 预览请求体。width/height 按 slot.rect × canvas 折算实际像素后传给后端。 */
export interface PicgenPreviewRequest {
  title: string;
  subtitle?: string;
  tag?: string;
  width: number;
  height: number;
  /** 可选；省略时后端按 seed 随机抽。 */
  template?: string;
  scheme?: string;
  font?: string;
  /** 可选确定性 seed；预览页可以不传（后端会生成随机一张）。 */
  seed?: number;
}

export interface PicgenPreviewResult {
  preview_url: string;
}

/**
 * 调 POST /api/mixcut/picgen/preview 生成一张 PNG 并返回访问 URL。
 * 后端会反代到独立的 pic-gen 服务（默认 http://localhost:5173）。
 * 预览图非确定性：模板/配色/字体如果留空，每次点击都会换一组。
 */
export async function picgenPreview(req: PicgenPreviewRequest): Promise<PicgenPreviewResult> {
  if (USE_LOCAL) {
    throw new Error("本地 mock 模式不支持 picgen；设 NEXT_PUBLIC_USE_MOCK=0 或 NEXT_PUBLIC_MIXCUT_USE_REAL=1");
  }
  return apiFetch<PicgenPreviewResult>("/mixcut/picgen/preview", {
    method: "POST",
    body: req,
  });
}
