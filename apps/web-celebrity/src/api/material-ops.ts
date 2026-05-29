// ─────────────────────────────────────────────────────────────────────────────
// api/material-ops.ts — 素材运营数据层。
//   · USE_MOCK=1：脚本/视频/爆款走本地 mock + localStorage（无后端也能跑）。
//   · USE_MOCK=0：走真后端 /api/material/*（Spring：MaterialOpsController），
//     与商品库（/api/products）以 product_id 集成。
// 后台异步渲染任务（提交到后台 → 进度条）始终是客户端 localStorage 模拟：没有真实
// 渲染 worker；任务「完成」时把成片落库（live → POST /material/videos/batch；mock →
// localStorage），素材库即可看到。
// ─────────────────────────────────────────────────────────────────────────────

import { SCRIPT_ASSETS, VIDEO_ASSETS, VIRAL_HITS, getProduct, toMaterialProduct } from "@/mocks/material-ops";
import type {
  AsyncRenderTask,
  MaterialProduct,
  MaterialVideo,
  ScriptAsset,
  ScriptVariable,
  VideoGenJobRequest,
  ViralHit,
} from "@/components/material-ops/types";
import { getProduct as fetchProductById } from "./products";
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
  const s = USE_MOCK
    ? (mockScripts().find((x) => x.id === id) ?? null)
    : await apiFetch<ScriptAsset | null>(`/material/scripts/${encodeURIComponent(id)}`);
  // 用 product_id 还原真实关联商品（不只 6 个素材运营 mock 商品，而是全量商品库）。
  if (s && !s.product) s.product = await resolveProductForScript(s);
  return USE_MOCK ? mockDelay(s) : s;
}

/**
 * 用 script.product_id 解析其关联商品 —— **始终返回一个 MaterialProduct，绝不返回错的商品**。
 * 解析顺序：
 *   1) script.product（已挂上的实体）
 *   2) 素材运营自带的 6 个富数据商品（MATERIAL_PRODUCTS）
 *   3) 全量商品库（live → GET /api/products/{id}；mock → SEED_PRODUCTS）→ toMaterialProduct
 *   4) 兜底占位（用 product_id 造一个最小商品；找不到 id 时返回「未关联商品」占位）
 *
 * 历史 bug：preview/editor 之前用 `MATERIAL_PRODUCTS.find(...) ?? MATERIAL_PRODUCTS[0]` 兜底，
 * 选了商品库里非这 6 个的商品时会落到 MATERIAL_PRODUCTS[0]（德绒高领打底衫）——显示成完全无关的商品。
 * 这里改为查全量商品库；查不到也只给中性占位，不再张冠李戴。
 */
export async function resolveProductForScript(script: ScriptAsset): Promise<MaterialProduct> {
  if (script.product) return script.product;
  const pid = script.product_id;
  return resolveProductById(pid);
}

/** 同 resolveProductForScript，但直接按 productId 解析（供详情/列表复用）。 */
export async function resolveProductById(productId?: string): Promise<MaterialProduct> {
  if (productId) {
    const rich = getProduct(productId);
    if (rich) return rich;
    try {
      const p = await fetchProductById(productId);
      if (p) return toMaterialProduct(p);
    } catch {
      /* 商品库拉取失败 → 走占位，不阻塞脚本预览 */
    }
  }
  return placeholderProduct(productId);
}

function placeholderProduct(productId?: string): MaterialProduct {
  return {
    id: productId ?? "unknown",
    name: productId ? "未找到商品" : "未关联商品",
    category: "其他",
    link: "",
    images: [],
    sellingPoints: "",
    sellingPointList: [],
    usageCount: 0,
    source: "manual",
    accentColor: "#7a6f5d",
    audience: [],
    suggestedAngles: [],
    createdAt: "",
    updatedAt: "",
  } as MaterialProduct;
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

function taskToCard(t: AsyncRenderTask): MaterialVideo {
  return {
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
  };
}

function taskCards(): MaterialVideo[] {
  return readJSON<AsyncRenderTask[]>(TASKS_KEY, []).map(taskToCard);
}

export async function listVideos(productId?: string): Promise<MaterialVideo[]> {
  if (USE_MOCK) {
    const base = await mockDelay(mockBaseVideos());
    let all = [...taskCards(), ...base];
    if (productId) all = all.filter((v) => (v.product_id ?? scriptProductId(v.script_id)) === productId);
    return all;
  }
  // live：成片视频（/material/videos）+ 真实生成任务（/material/videos/jobs，含 rendering/failed/ready）。
  const suffix = productId ? `?product_id=${encodeURIComponent(productId)}` : "";
  const [base, jobs] = await Promise.all([
    apiFetch<MaterialVideo[]>(`/material/videos${suffix}`),
    listVideoJobs({ productId }).catch(() => [] as MaterialVideo[]),
  ]);
  // 任务在前（最新生成的优先展示）；按 id 去重。
  const seen = new Set<string>();
  let all = [...jobs, ...base].filter((v) => (seen.has(v.id) ? false : (seen.add(v.id), true)));
  if (productId) all = all.filter((v) => (v.product_id ?? scriptProductId(v.script_id)) === productId);
  return all;
}

// ── 带货视频生成任务（真实视频大模型 · 异步 submit + 轮询） ────────────────────
// USE_MOCK：沿用 localStorage 渲染任务模拟（enqueue + advanceRenderTasks 推进）。
// live：POST /material/videos/generate 提交 → GET /material/videos/jobs[/{id}] 轮询。
// 未配置视频大模型时 live 会抛 ApiError（VIDEO_NOT_CONFIGURED），由调用方展示明确错误。

/** 提交一批视频生成任务，返回创建出的任务卡（status=rendering）。 */
export async function submitVideoJobs(requests: VideoGenJobRequest[]): Promise<MaterialVideo[]> {
  if (!requests.length) return [];
  if (USE_MOCK) {
    const startedAt = Date.now();
    const tasks: AsyncRenderTask[] = requests.map((r, i) => ({
      id: `task-${startedAt}-${i}`,
      script_id: r.script_id,
      product_id: r.product_id,
      parent_video_id: r.parent_video_id ?? null,
      kind: r.kind,
      name: r.name,
      status: "pending" as const,
      submitted_at: new Date(startedAt + i * 100).toISOString(),
      eta_sec: 90,
      progress_pct: 0,
      stage: "已入队",
      variant_config: r.variant_config,
    }));
    await enqueueRenderTasks(tasks);
    return tasks.map((t) => taskToCard(t));
  }
  return apiFetch<MaterialVideo[]>("/material/videos/generate", { method: "POST", body: { items: requests } });
}

/** 单个生成任务的最新状态（前端轮询）。 */
export async function getVideoJob(id: string): Promise<MaterialVideo | null> {
  if (USE_MOCK) {
    return mockDelay([...taskCards(), ...mockBaseVideos()].find((v) => v.id === id) ?? null);
  }
  return apiFetch<MaterialVideo | null>(`/material/videos/jobs/${encodeURIComponent(id)}`);
}

/** 列出当前用户的生成任务（可按脚本 / 商品过滤）。 */
export async function listVideoJobs(filter?: { scriptId?: string; productId?: string }): Promise<MaterialVideo[]> {
  if (USE_MOCK) {
    let cards = taskCards();
    if (filter?.scriptId) cards = cards.filter((c) => c.script_id === filter.scriptId);
    if (filter?.productId) cards = cards.filter((c) => (c.product_id ?? scriptProductId(c.script_id)) === filter.productId);
    return mockDelay(cards);
  }
  const qs = new URLSearchParams();
  if (filter?.scriptId) qs.set("script_id", filter.scriptId);
  if (filter?.productId) qs.set("product_id", filter.productId);
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiFetch<MaterialVideo[]>(`/material/videos/jobs${suffix}`);
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
// USE_MOCK：返回空 [] → 调用方（DraftingHub / DeriveVariablesPanel）用本地占位池 / 正则。
// live：成功返回结果；失败抛 ApiError（不静默兜底）—— 后端带明确 code/message（token 未配 /
// prompt 未配 / 模型异常），由调用方 catch 后展示，便于定位配置问题。
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
