// ─────────────────────────────────────────────────────────────────────────────
// api/material-ops.ts — 素材运营（纯前端 + Mock）。
// 组件默认渲染直接 import mocks；这里负责「会变」的数据：用户脚本草稿、生成的视频、
// 后台异步渲染任务队列。USE_MOCK 路径用 localStorage 暂存（与 api/products.ts 同套路）。
// apiFetch 分支保留占位，便于将来接真后端。
// ─────────────────────────────────────────────────────────────────────────────

import {
  SCRIPT_ASSETS,
  VIDEO_ASSETS,
  VIRAL_HITS,
  getProduct,
} from "@/mocks/material-ops";
import type {
  AsyncRenderTask,
  MaterialVideo,
  ScriptAsset,
  ViralHit,
} from "@/components/material-ops/types";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

const SCRIPTS_KEY = "aistareco.web.material.scripts.v1"; // 用户草稿覆盖层
const VIDEOS_KEY = "aistareco.web.material.videos.v1"; // 用户生成的视频
const TASKS_KEY = "aistareco.web.material.tasks.v1"; // 后台渲染任务队列
const DELETED_VIDEOS_KEY = "aistareco.web.material.deleted-videos.v1";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage 满 / 隐私模式静默 */
  }
}

// ── 脚本 ─────────────────────────────────────────────────────────────────────
export interface ScriptFilter {
  kind?: ScriptAsset["kind"] | "all";
  tier?: ScriptAsset["tier"] | "all";
  category?: string | "all";
  q?: string;
}

function allScripts(): ScriptAsset[] {
  const drafts = readJSON<ScriptAsset[]>(SCRIPTS_KEY, []);
  const draftIds = new Set(drafts.map((d) => d.id));
  // 用户草稿覆盖同 id 的内置脚本
  return [...drafts, ...SCRIPT_ASSETS.filter((s) => !draftIds.has(s.id))];
}

export async function listScripts(filter?: ScriptFilter): Promise<ScriptAsset[]> {
  if (USE_MOCK) {
    let list = allScripts();
    if (filter?.kind && filter.kind !== "all") list = list.filter((s) => s.kind === filter.kind);
    if (filter?.tier && filter.tier !== "all") list = list.filter((s) => s.tier === filter.tier);
    if (filter?.category && filter.category !== "all") list = list.filter((s) => s.category === filter.category);
    if (filter?.q?.trim()) {
      const q = filter.q.trim();
      list = list.filter((s) => s.name.includes(q) || s.tags.some((t) => t.includes(q)));
    }
    return mockDelay(list);
  }
  return apiFetch<ScriptAsset[]>("/me/material/scripts");
}

export async function getScript(id: string): Promise<ScriptAsset | null> {
  if (USE_MOCK) {
    const found = allScripts().find((s) => s.id === id) ?? null;
    if (found && !found.product) found.product = getProduct(found.product_id);
    return mockDelay(found);
  }
  return apiFetch<ScriptAsset | null>(`/me/material/scripts/${id}`);
}

export async function saveScript(asset: ScriptAsset): Promise<ScriptAsset> {
  if (USE_MOCK) {
    const drafts = readJSON<ScriptAsset[]>(SCRIPTS_KEY, []);
    const idx = drafts.findIndex((d) => d.id === asset.id);
    const stored: ScriptAsset = { ...asset };
    delete stored.product; // product 不入库，按 product_id 还原
    if (idx >= 0) drafts[idx] = stored;
    else drafts.unshift(stored);
    writeJSON(SCRIPTS_KEY, drafts);
    return mockDelay(asset);
  }
  return apiFetch<ScriptAsset>("/me/material/scripts", { method: "POST", body: asset });
}

// ── 视频 ─────────────────────────────────────────────────────────────────────
function allVideos(): MaterialVideo[] {
  const userVideos = readJSON<MaterialVideo[]>(VIDEOS_KEY, []);
  const deleted = new Set(readJSON<string[]>(DELETED_VIDEOS_KEY, []));
  const tasks = readJSON<AsyncRenderTask[]>(TASKS_KEY, []);
  const taskVideos: MaterialVideo[] = tasks.map((t) => ({
    id: t.id,
    script_id: t.script_id,
    product_id: t.product_id,
    kind: t.kind,
    name: t.name,
    status: "rendering",
    parent_video_id: t.parent_video_id ?? null,
    duration_sec: 30,
    aspect_ratio: "9:16",
    variant_config: t.variant_config,
    metrics: null,
    cover_color: "#22b59a",
    thumb_emoji: "⏳",
    created_at: t.submitted_at,
    generated_at: null,
    render_cost_sec: null,
    model: "sora-zh-v3",
    progress_pct: t.progress_pct,
    eta_sec: t.eta_sec,
    stage: t.stage,
    isAsyncTask: true,
  }));
  const base = [...taskVideos, ...userVideos, ...VIDEO_ASSETS];
  return base.filter((v) => !deleted.has(v.id));
}

export async function listVideos(productId?: string): Promise<MaterialVideo[]> {
  if (USE_MOCK) {
    let list = allVideos();
    if (productId) list = list.filter((v) => (v.product_id ?? scriptProductId(v.script_id)) === productId);
    return mockDelay(list);
  }
  const suffix = productId ? `?product_id=${encodeURIComponent(productId)}` : "";
  return apiFetch<MaterialVideo[]>(`/me/material/videos${suffix}`);
}

function scriptProductId(scriptId: string): string | undefined {
  return SCRIPT_ASSETS.find((s) => s.id === scriptId)?.product_id;
}

/** 直接落库一批已生成的视频（弹窗内完成时调用）。 */
export async function addVideos(videos: MaterialVideo[]): Promise<void> {
  if (USE_MOCK) {
    const userVideos = readJSON<MaterialVideo[]>(VIDEOS_KEY, []);
    writeJSON(VIDEOS_KEY, [...videos, ...userVideos]);
    return mockDelay(undefined);
  }
  await apiFetch<void>("/me/material/videos/batch", { method: "POST", body: { videos } });
}

export async function deleteVideo(id: string): Promise<void> {
  if (USE_MOCK) {
    const userVideos = readJSON<MaterialVideo[]>(VIDEOS_KEY, []);
    const next = userVideos.filter((v) => v.id !== id);
    if (next.length !== userVideos.length) writeJSON(VIDEOS_KEY, next);
    else {
      const deleted = readJSON<string[]>(DELETED_VIDEOS_KEY, []);
      if (!deleted.includes(id)) writeJSON(DELETED_VIDEOS_KEY, [...deleted, id]);
    }
    return mockDelay(undefined);
  }
  await apiFetch<void>(`/me/material/videos/${id}`, { method: "DELETE" });
}

// ── 后台渲染任务队列 ──────────────────────────────────────────────────────────
export async function enqueueRenderTasks(tasks: AsyncRenderTask[]): Promise<void> {
  if (USE_MOCK) {
    const cur = readJSON<AsyncRenderTask[]>(TASKS_KEY, []);
    writeJSON(TASKS_KEY, [...cur, ...tasks]);
    return mockDelay(undefined);
  }
  await apiFetch<void>("/me/material/render-tasks", { method: "POST", body: { tasks } });
}

/**
 * 推进后台任务进度（mock：每次调用 +~9%；满 100 转成 ready 视频落库）。
 * 商品素材库页定时调用以让渲染中卡片动起来。返回是否仍有进行中任务。
 */
export async function advanceRenderTasks(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const tasks = readJSON<AsyncRenderTask[]>(TASKS_KEY, []);
  if (tasks.length === 0) return false;
  const stillRunning: AsyncRenderTask[] = [];
  const finished: AsyncRenderTask[] = [];
  const STAGES = ["已入队", "镜头规划", "场景合成", "逐镜渲染", "配音口型", "合成出片"];
  for (const t of tasks) {
    const next = Math.min(100, (t.progress_pct || 0) + 8 + Math.floor(Math.random() * 8));
    const stageIdx = Math.min(STAGES.length - 1, Math.floor((next / 100) * STAGES.length));
    if (next >= 100) finished.push({ ...t, progress_pct: 100, stage: "合成出片" });
    else stillRunning.push({ ...t, progress_pct: next, stage: STAGES[stageIdx], status: "rendering" });
  }
  writeJSON(TASKS_KEY, stillRunning);
  if (finished.length > 0) {
    const userVideos = readJSON<MaterialVideo[]>(VIDEOS_KEY, []);
    const palette = ["#7c5cff", "#ff5b8a", "#22b59a", "#f0a83a", "#5b3fe0", "#ff8a5b"];
    const now = new Date().toISOString();
    const newVideos: MaterialVideo[] = finished.map((t, i) => ({
      id: t.id,
      script_id: t.script_id,
      product_id: t.product_id,
      kind: t.kind,
      name: t.name,
      status: "ready",
      parent_video_id: t.parent_video_id ?? null,
      duration_sec: 30,
      aspect_ratio: "9:16",
      variant_config: t.variant_config,
      metrics: null,
      cover_color: palette[i % palette.length],
      thumb_emoji: "🎬",
      created_at: t.submitted_at,
      generated_at: now,
      render_cost_sec: 90 + i * 8,
      model: "sora-zh-v3",
    }));
    writeJSON(VIDEOS_KEY, [...newVideos, ...userVideos]);
  }
  return stillRunning.length > 0;
}

export async function hasInflightTasks(): Promise<boolean> {
  return readJSON<AsyncRenderTask[]>(TASKS_KEY, []).length > 0;
}

// ── 爆款雷达 ─────────────────────────────────────────────────────────────────
export async function listViralHits(): Promise<ViralHit[]> {
  if (USE_MOCK) return mockDelay([...VIRAL_HITS]);
  return apiFetch<ViralHit[]>("/me/material/viral-hits");
}
