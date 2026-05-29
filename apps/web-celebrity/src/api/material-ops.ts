// ─────────────────────────────────────────────────────────────────────────────
// api/material-ops.ts — 素材运营数据层。
//   · USE_MOCK=1：脚本/视频/爆款走本地 mock + localStorage（无后端也能跑）。
//   · USE_MOCK=0：走真后端 /api/material/*（Spring：MaterialOpsController），
//     与商品库（/api/products）以 product_id 集成。
// 后台异步渲染任务（提交到后台 → 进度条）始终是客户端 localStorage 模拟：没有真实
// 渲染 worker；任务「完成」时把成片落库（live → POST /material/videos/batch；mock →
// localStorage），素材库即可看到。
// ─────────────────────────────────────────────────────────────────────────────

import { SCRIPT_ASSETS, VIDEO_ASSETS, VIRAL_HITS, getProduct } from "@/mocks/material-ops";
import type {
  AsyncRenderTask,
  MaterialVideo,
  ScriptAsset,
  ScriptVariable,
  ViralHit,
} from "@/components/material-ops/types";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

const SCRIPTS_KEY = "aistareco.web.material.scripts.v1"; // mock：用户草稿覆盖层
const VIDEOS_KEY = "aistareco.web.material.videos.v1"; // mock：用户生成的视频
const TASKS_KEY = "aistareco.web.material.tasks.v1"; // 后台渲染任务队列（两模式共用）
const DELETED_VIDEOS_KEY = "aistareco.web.material.deleted-videos.v1"; // mock：软删

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
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

function scriptProductId(scriptId: string): string | undefined {
  return SCRIPT_ASSETS.find((s) => s.id === scriptId)?.product_id;
}

// ── 脚本 ─────────────────────────────────────────────────────────────────────
export interface ScriptFilter {
  kind?: ScriptAsset["kind"] | "all";
  tier?: ScriptAsset["tier"] | "all";
  category?: string | "all";
  q?: string;
}

function mockScripts(): ScriptAsset[] {
  const drafts = readJSON<ScriptAsset[]>(SCRIPTS_KEY, []);
  const ids = new Set(drafts.map((d) => d.id));
  return [...drafts, ...SCRIPT_ASSETS.filter((s) => !ids.has(s.id))];
}

export async function listScripts(filter?: ScriptFilter): Promise<ScriptAsset[]> {
  let list: ScriptAsset[];
  if (USE_MOCK) list = await mockDelay(mockScripts());
  else list = await apiFetch<ScriptAsset[]>("/material/scripts");
  if (filter?.kind && filter.kind !== "all") list = list.filter((s) => s.kind === filter.kind);
  if (filter?.tier && filter.tier !== "all") list = list.filter((s) => s.tier === filter.tier);
  if (filter?.category && filter.category !== "all") list = list.filter((s) => s.category === filter.category);
  if (filter?.q?.trim()) {
    const q = filter.q.trim();
    list = list.filter((s) => s.name.includes(q) || (s.tags ?? []).some((t) => t.includes(q)));
  }
  return list;
}

export async function getScript(id: string): Promise<ScriptAsset | null> {
  if (USE_MOCK) {
    const found = mockScripts().find((s) => s.id === id) ?? null;
    if (found && !found.product) found.product = getProduct(found.product_id);
    return mockDelay(found);
  }
  const s = await apiFetch<ScriptAsset | null>(`/material/scripts/${encodeURIComponent(id)}`);
  if (s && !s.product) s.product = getProduct(s.product_id);
  return s;
}

export async function saveScript(asset: ScriptAsset): Promise<ScriptAsset> {
  const stored: ScriptAsset = { ...asset };
  delete stored.product; // product 不入库，按 product_id 还原
  if (USE_MOCK) {
    const drafts = readJSON<ScriptAsset[]>(SCRIPTS_KEY, []);
    const idx = drafts.findIndex((d) => d.id === asset.id);
    if (idx >= 0) drafts[idx] = stored;
    else drafts.unshift(stored);
    writeJSON(SCRIPTS_KEY, drafts);
    return mockDelay(asset);
  }
  return apiFetch<ScriptAsset>("/material/scripts", { method: "POST", body: stored });
}

// ── 视频 ─────────────────────────────────────────────────────────────────────
function mockBaseVideos(): MaterialVideo[] {
  const userVideos = readJSON<MaterialVideo[]>(VIDEOS_KEY, []);
  const deleted = new Set(readJSON<string[]>(DELETED_VIDEOS_KEY, []));
  return [...userVideos, ...VIDEO_ASSETS].filter((v) => !deleted.has(v.id));
}

function taskCards(): MaterialVideo[] {
  return readJSON<AsyncRenderTask[]>(TASKS_KEY, []).map((t) => ({
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
    created_at: t.submitted_at,
    generated_at: null,
    render_cost_sec: null,
    model: "sora-zh-v3",
    progress_pct: t.progress_pct,
    eta_sec: t.eta_sec,
    stage: t.stage,
    isAsyncTask: true,
  }));
}

export async function listVideos(productId?: string): Promise<MaterialVideo[]> {
  let base: MaterialVideo[];
  if (USE_MOCK) {
    base = await mockDelay(mockBaseVideos());
  } else {
    const suffix = productId ? `?product_id=${encodeURIComponent(productId)}` : "";
    base = await apiFetch<MaterialVideo[]>(`/material/videos${suffix}`);
  }
  let all = [...taskCards(), ...base];
  if (productId) all = all.filter((v) => (v.product_id ?? scriptProductId(v.script_id)) === productId);
  return all;
}

/** 落库一批已生成视频（弹窗内完成 / 后台任务完成时调用）。 */
export async function addVideos(videos: MaterialVideo[]): Promise<void> {
  if (!videos.length) return;
  if (USE_MOCK) {
    const userVideos = readJSON<MaterialVideo[]>(VIDEOS_KEY, []);
    writeJSON(VIDEOS_KEY, [...videos, ...userVideos]);
    return mockDelay(undefined);
  }
  await apiFetch<void>("/material/videos/batch", { method: "POST", body: { videos } });
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
  await apiFetch<void>(`/material/videos/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ── 后台渲染任务队列（始终 localStorage 模拟） ───────────────────────────────
export async function enqueueRenderTasks(tasks: AsyncRenderTask[]): Promise<void> {
  const cur = readJSON<AsyncRenderTask[]>(TASKS_KEY, []);
  writeJSON(TASKS_KEY, [...cur, ...tasks]);
  return mockDelay(undefined, 60);
}

const STAGES = ["已入队", "镜头规划", "场景合成", "逐镜渲染", "配音口型", "合成出片"];
const PALETTE = ["#7c5cff", "#ff5b8a", "#22b59a", "#f0a83a", "#5b3fe0", "#ff8a5b"];

/** 推进任务进度（每次 +~9%）；完成的任务转成 ready 视频落库（live → 后端；mock → 本地）。 */
export async function advanceRenderTasks(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const tasks = readJSON<AsyncRenderTask[]>(TASKS_KEY, []);
  if (tasks.length === 0) return false;
  const running: AsyncRenderTask[] = [];
  const finished: AsyncRenderTask[] = [];
  for (const t of tasks) {
    const next = Math.min(100, (t.progress_pct || 0) + 8 + Math.floor(Math.random() * 8));
    if (next >= 100) finished.push({ ...t, progress_pct: 100, stage: "合成出片" });
    else {
      const stageIdx = Math.min(STAGES.length - 1, Math.floor((next / 100) * STAGES.length));
      running.push({ ...t, progress_pct: next, stage: STAGES[stageIdx], status: "rendering" });
    }
  }
  writeJSON(TASKS_KEY, running);
  if (finished.length > 0) {
    const now = new Date().toISOString();
    const videos: MaterialVideo[] = finished.map((t, i) => ({
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
      cover_color: PALETTE[i % PALETTE.length],
      created_at: t.submitted_at,
      generated_at: now,
      render_cost_sec: 90 + i * 8,
      model: "sora-zh-v3",
    }));
    await addVideos(videos);
  }
  return running.length > 0;
}

export async function hasInflightTasks(): Promise<boolean> {
  return readJSON<AsyncRenderTask[]>(TASKS_KEY, []).length > 0;
}

// ── AI 起稿 / 变量抽取（接真 LLM，见 server MaterialAiService） ────────────────
// USE_MOCK：返回空 → 调用方（DraftingHub / DeriveVariablesPanel）回退到本地占位池 / 正则，
// 与 live 模式下后端不可用时的降级路径一致。
export interface AiDraftParams {
  product_id?: string;
  product_name?: string;
  category?: string;
  selling_points?: string;
  tone: string;
  audience: string[];
  duration_sec: number;
  count: number;
}

/** AI 起稿候选（不落库）。失败 / mock → 返回 []，调用方用本地占位池兜底。 */
export async function aiDraftScripts(params: AiDraftParams): Promise<ScriptAsset[]> {
  if (USE_MOCK) return mockDelay([]);
  return apiFetch<ScriptAsset[]>("/material/scripts/ai-draft", { method: "POST", body: params });
}

/** 从脚本抽取可替换变量。失败 / mock → 返回 []，调用方用正则兜底。 */
export async function extractScriptVariables(scriptId: string): Promise<ScriptVariable[]> {
  if (USE_MOCK) return mockDelay([]);
  return apiFetch<ScriptVariable[]>(`/material/scripts/${encodeURIComponent(scriptId)}/variables`, {
    method: "POST",
  });
}

// ── 爆款雷达 ─────────────────────────────────────────────────────────────────
export async function listViralHits(): Promise<ViralHit[]> {
  if (USE_MOCK) return mockDelay([...VIRAL_HITS]);
  return apiFetch<ViralHit[]>("/material/viral-hits");
}
