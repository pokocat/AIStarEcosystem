// ─────────────────────────────────────────────────────────────────────────────
// mocks/canvas.ts —— USE_MOCK=1 时的画布假服务端（v0.198）。只被 api/canvas.ts 在 USE_MOCK 分支里调用。
//
// 与真服务端同形（AGENTS.md §8.0.1 ⑦，契约 packages/types/src/drama-canvas.ts）：
//   · 保存：baseDocVersion 对不上 409 DRAMA_CANVAS_STALE；落库前递归剥掉 url / lastFrameUrl；
//     docVersion = 规范化文档的指纹（真服务端是 sha256 前 16 位，这里用两路 FNV，够判「变没变」）。
//   · 读出：只给「本人的」key 派生 url —— mock 里 `mock/` 开头的 key 算本人的，派生成一张写着对象名的
//     确定性 SVG（右下角标「演示图」，§8.0 mock 产物必须显式标注）；视频 key → /videos/showreel-01.mp4。
//   · 生成：只读**已保存的**文档，请求的 docVersion 对不上 409；按 clientRequestId 幂等（回原记录）；
//     运行记录 queued → running → succeeded 用 1–3 秒（按时间推进，不按查询次数）；排队中的可以取消。
//     文字类返回形状正确的示例内容，并在 notes / 正文首行写明是演示内容。
//     提示词 / 片段文本里写了「测试失败」的，这次生成会失败（方便看失败的样子）。
// 数据在内存里，并尽量存进 sessionStorage（同一个标签页刷新后画布还在；存不下就只在内存里）。
// 预置两张画布：一张有内容的示例（各种状态都有），一张刚新建的空画布。
// ─────────────────────────────────────────────────────────────────────────────

import { ApiError, mockDelay } from "@ai-star-eco/api-client";
import { mockUrlForKey as uploadedUrlForKey } from "@/api/drama-assets";
import type { RenderModelsResponse } from "@/api/render";
import type {
  CanvasAsset,
  CanvasAssembleRunBody,
  CanvasCharacter,
  CanvasExtractRunBody,
  CanvasImageBatchBody,
  CanvasImageRatio,
  CanvasImageRunBody,
  CanvasImageTarget,
  CanvasOutlineEpisode,
  CanvasRunBase,
  CanvasScriptRunBody,
  CanvasStoryboardRunBody,
  CanvasVideoRunBody,
  CreateDramaCanvasBody,
  DramaCanvasDetail,
  DramaCanvasDoc,
  DramaCanvasRatio,
  DramaCanvasRun,
  DramaCanvasRunKind,
  DramaCanvasRunResult,
  DramaCanvasRunTarget,
  DramaCanvasStep,
  DramaCanvasSummary,
  ExtractedCanvasCharacter,
  ExtractedCanvasScene,
  SaveDramaCanvasBody,
  SaveDramaCanvasResult,
  SignCanvasAssetsBody,
  SignCanvasAssetsResult,
  SplitCanvasScriptBody,
  SplitCanvasScriptResult,
} from "@ai-star-eco/types/drama-canvas";

// ── 候选模型（与 GET /me/drama/render/models 同形；mock 下 render.ts 回空，画布计价读这一份）─────────

export const MOCK_CANVAS_RENDER_MODELS: RenderModelsResponse = {
  image: [
    { endpointId: "mock-image-std", name: "标准出图", isDefault: true, capability: { maxRefImages: 6 }, creditCost: 2, billingUnit: "per_call" },
    { endpointId: "mock-image-hd", name: "高清出图", isDefault: false, capability: { maxRefImages: 4 }, creditCost: 4, billingUnit: "per_call" },
  ],
  video: [
    {
      endpointId: "mock-video-i2v",
      name: "首帧生视频",
      isDefault: true,
      capability: { maxDurationSec: 10, maxRefImages: 1, supportsFirstLastFrame: true },
      creditCost: 6,
      billingUnit: "per_second",
    },
    {
      endpointId: "mock-video-t2v",
      name: "文字生视频（不看首帧）",
      isDefault: false,
      capability: { maxDurationSec: 15, maxRefImages: 0 },
      creditCost: 4,
      billingUnit: "per_second",
    },
  ],
};

/** 与 DRAMA_CONFIG_DEFAULTS 一致（mock 下 /me/drama/config 也回默认值）。 */
const PRICE = { setting: 2, outline: 6, episode: 4, extract: 4, storyboard: 4 } as const;
const MAX_REF_IMAGES = 6;
const MAX_DOC_BYTES = 4 * 1024 * 1024;

// ── 状态 ─────────────────────────────────────────────────────────────────────

interface CanvasRow {
  id: string;
  title: string;
  ratio: DramaCanvasRatio;
  /** 已剥掉 url 的文档（= 服务端 doc_json）。 */
  doc: DramaCanvasDoc;
  docVersion: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

interface AssetMeta {
  label: string;
  ratio: CanvasImageRatio;
}

interface RunRow {
  run: DramaCanvasRun;
  clientRequestId: string;
  /** 批量出图的第 0 项（占原始键）记着整批的运行 id（按原批次重放）。 */
  batchRunIds?: string[];
  /** 批量里第 1 项及以后（键是 `${原始键}:${序号}`）。 */
  batchMember?: boolean;
  /** 这之前 queued。 */
  queuedUntil: number;
  /** 这之后到终态。 */
  readyAt: number;
  /** 到点后给出的结果（提交时就按当时已保存的文档算好）。 */
  result?: DramaCanvasRunResult;
  fail?: { code: string; message: string };
}

interface MockState {
  canvases: CanvasRow[];
  runs: RunRow[];
  assets: Record<string, AssetMeta>;
}

const STORE_KEY = "drama-canvas-mock-v1";
let state: MockState | null = null;

function load(): MockState {
  if (state) return state;
  try {
    const raw = typeof window !== "undefined" ? window.sessionStorage.getItem(STORE_KEY) : null;
    const parsed = raw ? (JSON.parse(raw) as MockState) : null;
    if (parsed && Array.isArray(parsed.canvases) && Array.isArray(parsed.runs) && parsed.assets) state = parsed;
  } catch {
    state = null;
  }
  if (!state) state = seed();
  return state;
}

function persist(): void {
  if (!state || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    /* 存不下（隐私模式 / 超额）就只留在内存里 */
  }
}

/** 测试用：丢掉内存与 sessionStorage 里的 mock 数据，下次调用重新预置。 */
export function __resetMockCanvasForTest(): void {
  state = null;
  try {
    window.sessionStorage.removeItem(STORE_KEY);
  } catch {
    /* ignore */
  }
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const nowIso = () => new Date().toISOString();

function uid(len = 12): string {
  const s =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return s.slice(0, len);
}

function err(status: number, code: string, message: string, details?: unknown): ApiError {
  return new ApiError({ code, message, ...(details !== undefined ? { details } : {}) }, status);
}

// ── 文档：剥 url / 指纹 / 校验 / 签名 ────────────────────────────────────────

function stripUrls<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripUrls(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "url" || k === "lastFrameUrl") continue;
      out[k] = stripUrls(v);
    }
    return out as T;
  }
  return value;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * 画布版本 = 规范化文档 + NUL + 标题 的指纹（同服务端 DramaCanvasDocs.docVersionOf(canonicalJson, title)）：
 * 文档或标题任一变了版本就变 —— 否则 A 页面只改名、B 页面带旧版本保存会无冲突地把新标题盖掉。
 */
function fingerprint(doc: DramaCanvasDoc, title: string): string {
  const s = `${canonical(doc)}\u0000${title ?? ""}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
    h2 ^= h2 >>> 13;
  }
  return (h1.toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0")).slice(0, 16);
}

function validateDoc(doc: unknown): DramaCanvasDoc {
  const d = doc as Partial<DramaCanvasDoc> | null;
  const ok =
    !!d &&
    typeof d === "object" &&
    d.schema === 1 &&
    (d.source === "idea" || d.source === "paste") &&
    !!d.style &&
    !!d.script &&
    Array.isArray(d.script.episodes) &&
    Array.isArray(d.script.history) &&
    Array.isArray(d.characters) &&
    Array.isArray(d.scenes) &&
    Array.isArray(d.materials) &&
    Array.isArray(d.episodes) &&
    !!d.board &&
    typeof d.board.positions === "object" &&
    Array.isArray(d.board.edges) &&
    Array.isArray(d.board.collapsed) &&
    !!d.board.viewport;
  if (!ok) throw err(400, "DRAMA_CANVAS_INVALID_DOC", "画布内容格式不对，没保存上");
  const bytes = new TextEncoder().encode(JSON.stringify(d)).length;
  if (bytes > MAX_DOC_BYTES) throw err(413, "DRAMA_CANVAS_TOO_LARGE", "画布内容太多了（超过 4MB），删掉一些素材再保存");
  return d as DramaCanvasDoc;
}

const isOwnKey = (key: string | undefined): key is string => !!key && key.startsWith("mock/");

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c] ?? c);
}

const RATIO_SIZE: Record<CanvasImageRatio, [number, number]> = {
  "9:16": [360, 640],
  "16:9": [640, 360],
  "1:1": [480, 480],
  "4:3": [560, 420],
  "3:4": [420, 560],
};

/** 确定性的演示图：同一个 key 永远同一张（颜色由 key 定），上面写对象名，角上标「演示图」。 */
function demoImage(key: string, meta: AssetMeta | undefined): string {
  const [w, h] = RATIO_SIZE[meta?.ratio ?? "9:16"];
  const hue = hashHue(key);
  const label = meta?.label ?? key.split("/").pop()?.replace(/\.[a-z0-9]+$/i, "") ?? "图";
  const fs = Math.round(Math.min(w, h) / 11);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue},55%,72%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},50%,46%)"/>` +
    `</linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/>` +
    `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="${fs}" font-weight="700" fill="rgba(255,255,255,.95)">${escapeXml(label)}</text>` +
    `<text x="${w - 12}" y="${h - 14}" text-anchor="end" font-family="sans-serif" font-size="${Math.round(fs * 0.55)}" fill="rgba(255,255,255,.8)">演示图</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** 本人的 key → 地址；不是本人的 → undefined（= 服务端不签，前端显示占位）。 */
function signKey(key: string | undefined): string | undefined {
  if (!isOwnKey(key)) return undefined;
  const uploaded = uploadedUrlForKey(key);
  if (uploaded) return uploaded;
  if (/\.(mp4|mov|webm)$/i.test(key)) return "/videos/showreel-01.mp4";
  return demoImage(key, load().assets[key]);
}

/** 递归给有 key / lastFrameKey 的对象派生 url / lastFrameUrl。 */
function signTree<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => signTree(v)) as unknown as T;
  if (value && typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src)) out[k] = signTree(v);
    if (typeof src.key === "string") {
      const url = signKey(src.key);
      if (url) out.url = url;
    }
    if (typeof src.lastFrameKey === "string") {
      const url = signKey(src.lastFrameKey);
      if (url) out.lastFrameUrl = url;
    }
    return out as T;
  }
  return value;
}

/** 递归收集对象里的 key / lastFrameKey（签名换新时判断「这张画布里有没有这个 key」）。 */
function collectKeys(value: unknown, out: Set<string>): void {
  if (Array.isArray(value)) {
    for (const v of value) collectKeys(v, out);
    return;
  }
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.key === "string") out.add(o.key);
    if (typeof o.lastFrameKey === "string") out.add(o.lastFrameKey);
    for (const v of Object.values(o)) collectKeys(v, out);
  }
}

function registerAsset(key: string, label: string, ratio: CanvasImageRatio): void {
  load().assets[key] = { label, ratio };
}

// ── 摘要 / 详情 ──────────────────────────────────────────────────────────────

const pickedKeyOf = (set: { versions: { key: string }[]; pickedKey?: string } | undefined) =>
  set && set.versions.length ? (set.versions.find((v) => v.key === set.pickedKey) ?? set.versions[0]).key : undefined;

function stepOf(doc: DramaCanvasDoc): DramaCanvasStep {
  if (!doc.script.extractedAt) return "script";
  if (!doc.episodes.some((e) => e.segments.length > 0)) return "assets";
  return "episodes";
}

function coverKey(doc: DramaCanvasDoc): string | undefined {
  for (const c of doc.characters) {
    for (const l of c.looks) {
      const k = pickedKeyOf(l.images);
      if (isOwnKey(k)) return k;
    }
  }
  for (const s of doc.scenes) {
    const k = pickedKeyOf(s.images);
    if (isOwnKey(k)) return k;
  }
  return undefined;
}

function toSummary(row: CanvasRow): DramaCanvasSummary {
  const doc = row.doc;
  const segs = doc.episodes.flatMap((e) => e.segments);
  const cover = coverKey(doc);
  const coverUrl = signKey(cover);
  return {
    id: row.id,
    title: row.title,
    ratio: row.ratio,
    step: stepOf(doc),
    episodeCount: doc.script.episodes.length,
    characterCount: doc.characters.length,
    sceneCount: doc.scenes.length,
    segmentsDone: segs.filter((s) => !!pickedKeyOf(s.video)).length,
    segmentsTotal: segs.length,
    episodesAssembled: doc.episodes.filter((e) => !!e.assembled).length,
    ...(coverUrl ? { coverUrl } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDetail(row: CanvasRow): DramaCanvasDetail {
  return { ...toSummary(row), doc: signTree(clone(row.doc)), docVersion: row.docVersion };
}

function requireRow(id: string): CanvasRow {
  const row = load().canvases.find((c) => c.id === id && !c.deletedAt);
  if (!row) throw err(404, "DRAMA_CANVAS_NOT_FOUND", "找不到这张画布，可能已经删掉了");
  return row;
}

// ── 按集切剧本 ───────────────────────────────────────────────────────────────

const CN_DIGIT: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

function parseEpisodeNo(s: string): number {
  const half = s.replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10));
  if (/^\d+$/.test(half)) return Number(half);
  let total = 0;
  let cur = 0;
  for (const ch of s) {
    if (ch in CN_DIGIT) cur = CN_DIGIT[ch];
    else if (ch === "十") {
      total += (cur || 1) * 10;
      cur = 0;
    } else if (ch === "百") {
      total += (cur || 1) * 100;
      cur = 0;
    }
  }
  return total + cur;
}

const EPISODE_HEAD = /^[\s\u3000]*(?:#{1,6}[\s\u3000]*)?[【[（(〔]?[\s\u3000]*第[\s\u3000]*([0-9０-９]{1,4}|[零〇一二两三四五六七八九十百千]{1,8})[\s\u3000]*集[\s\u3000]*[】\]）)〕]?[\s\u3000]*[:：·•、\-—–|｜.．]?[\s\u3000]*(.*)$/;

/** 与服务端 DramaCanvasScriptSplitter 同一套规则和说法（集号按出现顺序重排、前言并进第 1 集、没标记整篇当第 1 集）。 */
function splitText(text: string): SplitCanvasScriptResult {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const found: { raw: number; title: string; body: string[] }[] = [];
  const preface: string[] = [];
  for (const line of lines) {
    const m = line.match(EPISODE_HEAD);
    if (m) {
      found.push({ raw: parseEpisodeNo(m[1]), title: m[2].trim(), body: [] });
      continue;
    }
    if (found.length) found[found.length - 1].body.push(line);
    else preface.push(line);
  }
  const notes: string[] = [];
  if (!found.length) {
    notes.push("没找到「第 X 集」标记，整篇当作第 1 集");
    return { episodes: [{ no: 1, title: "", text: text.trim() }], notes };
  }
  const pre = preface.join("\n").trim();
  const episodes = found.map((f, i) => {
    const body = f.body.join("\n").trim();
    return { no: i + 1, title: f.title, text: i === 0 && pre ? (body ? `${pre}\n\n${body}` : pre) : body };
  });
  notes.push(`按「第 X 集」切成了 ${episodes.length} 集`);
  if (pre) notes.push(`第 1 集之前的 ${Array.from(pre).length} 个字（剧名、人物介绍等）放在了第 1 集开头，不需要的话删掉`);
  const raws = found.map((f) => f.raw);
  if (raws.some((n, i) => n !== i + 1)) {
    notes.push(`原文的集号是 ${raws.map((n) => (n > 0 ? String(n) : "?")).join("、")}，已按出现顺序改成第 1 到第 ${episodes.length} 集`);
  }
  const empty = episodes.filter((e) => !e.text).map((e) => String(e.no));
  if (empty.length) notes.push(`第 ${empty.join("、")} 集只有标题、没有正文`);
  return { episodes, notes };
}

// ── 运行记录 ─────────────────────────────────────────────────────────────────

function advance(row: RunRow): void {
  const r = row.run;
  if (r.status === "succeeded" || r.status === "failed" || r.status === "canceled") return;
  const now = Date.now();
  if (now < row.queuedUntil) {
    r.status = "queued";
    return;
  }
  if (now < row.readyAt) {
    r.status = "running";
    return;
  }
  r.finishedAt = new Date(row.readyAt).toISOString();
  if (row.fail) {
    r.status = "failed";
    r.errorCode = row.fail.code;
    r.errorMessage = row.fail.message;
  } else {
    r.status = "succeeded";
    if (row.result) r.result = row.result;
  }
}

function publicRun(row: RunRow): DramaCanvasRun {
  advance(row);
  return signTree(clone(row.run));
}

function findByRequest(clientRequestId: string): RunRow | undefined {
  return load().runs.find((r) => r.clientRequestId === clientRequestId);
}

const REUSED = () => err(409, "DRAMA_CANVAS_REQUEST_ID_REUSED", "这个请求编号已经被别的生成用过了，刷新页面后再试。");

/** 同服务端 requireClientRequestId：8–64 个 [A-Za-z0-9_-]，不许「:」（批量子项键 `${键}:${序号}` 客户端造不出来）。 */
const CLIENT_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;
function requireKey(raw: string | undefined): string {
  const k = (raw ?? "").trim();
  if (!CLIENT_REQUEST_ID.test(k)) throw err(400, "DRAMA_CANVAS_REQUEST_ID_INVALID", "请求缺少有效的 clientRequestId，刷新页面后再试。");
  return k;
}

/**
 * 公共前置（同服务端 existingSingle）：画布存在、幂等（同键回原记录）、只认已保存的那一版。
 * 同一个键已经被别的画布 / 别的目标 / 批量出图用过 → 409 DRAMA_CANVAS_REQUEST_ID_REUSED。
 * 查重在比对文档版本**之前**：受理过的键不管带什么版本都回原记录（前端接回时靠这一点）。
 */
function preflight(canvasId: string, body: CanvasRunBase, expectedTarget: string): { row: CanvasRow; dup?: RunRow } {
  const row = requireRow(canvasId);
  requireKey(body?.clientRequestId);
  const dup = findByRequest(body.clientRequestId);
  if (dup) {
    if (dup.run.canvasId !== canvasId || dup.run.target !== expectedTarget || dup.batchRunIds || dup.batchMember) throw REUSED();
    return { row, dup };
  }
  if (body.docVersion !== row.docVersion) {
    throw err(409, "DRAMA_CANVAS_STALE", "画布有新的改动还没保存上，先保存再生成", { docVersion: row.docVersion });
  }
  return { row };
}

const imageTargetKey = (t: CanvasImageTarget): DramaCanvasRunTarget =>
  t.kind === "segment" ? `frame:${t.episodeNo}:${t.segmentId}` : `${t.kind}:${t.id}`;

const scriptTargetOf = (b: CanvasScriptRunBody): string =>
  b.stage === "episode" ? `script:episode:${b.episodeNo ?? 0}` : `script:${b.stage}`;

/** 批量出图的上限（同服务端）。 */
const MAX_BATCH_ITEMS = 20;
const MAX_BATCH_IMAGES = 40;

function addRun(
  canvasId: string,
  clientRequestId: string,
  kind: DramaCanvasRunKind,
  target: DramaCanvasRunTarget,
  cost: number,
  opts: { result?: DramaCanvasRunResult; fail?: { code: string; message: string }; refs?: DramaCanvasRun["refs"]; slow?: boolean } = {},
): RunRow {
  const created = Date.now();
  // 文字类 / 出图 1–2 秒，视频 2–3 秒
  const total = opts.slow ? 2000 + Math.random() * 1000 : 1000 + Math.random() * 1000;
  const row: RunRow = {
    run: {
      id: `dcr_${uid()}`,
      canvasId,
      kind,
      target,
      status: "queued",
      cost,
      ...(opts.refs ? { refs: opts.refs } : {}),
      createdAt: new Date(created).toISOString(),
    },
    clientRequestId,
    queuedUntil: created + (opts.slow ? 800 : 300),
    readyAt: created + total,
    ...(opts.result ? { result: opts.result } : {}),
    ...(opts.fail ? { fail: opts.fail } : {}),
  };
  load().runs.push(row);
  return row;
}

const DEMO_FAIL = { code: "MOCK_DEMO_FAILED", message: "演示：这次生成失败了（提示词里写了「测试失败」），没扣积分，改一下再试。" };
const wantsFail = (...texts: (string | undefined)[]) => texts.some((t) => !!t && t.includes("测试失败"));

// ── 示例内容生成（演示模式，不是 AI 写的）────────────────────────────────────

const DEMO_NAMES = ["林默", "许知夏", "老秦", "阿杰"];
const DEMO_PLACES = ["老街面馆", "出租屋", "江边步道"];

function demoSetting(idea: string): string {
  return [
    "（演示模式的示例内容，接上服务后由 AI 按你的想法写）",
    "题材：都市 · 温情",
    `主线：${idea.trim()}`,
    "人物小传：",
    "林默，二十八岁，嘴硬心软，习惯把事情憋在心里。",
    "许知夏，二十五岁，做事利落，看人很准。",
    "老秦，五十五岁，老街面馆的老板，什么都知道一点。",
  ].join("\n");
}

const OUTLINE_TITLES = ["意外的开始", "第一次交锋", "藏起来的东西", "误会", "转机", "摊牌", "回到原点", "新的约定", "旧账", "天亮以前"];

function demoOutline(n: number): CanvasOutlineEpisode[] {
  return Array.from({ length: n }, (_, i) => {
    const no = i + 1;
    const title = OUTLINE_TITLES[i % OUTLINE_TITLES.length];
    return {
      no,
      title,
      hook: `第 ${no} 集开头：${DEMO_NAMES[i % 2]}发现了一件对不上的事。`,
      summary: `${DEMO_NAMES[0]}和${DEMO_NAMES[1]}在${DEMO_PLACES[i % DEMO_PLACES.length]}碰面，${title}，结尾留下一个新问题。（演示内容）`,
    };
  });
}

function demoEpisodeText(no: number, names: string[]): string {
  const [a, b, c] = [names[0] ?? DEMO_NAMES[0], names[1] ?? DEMO_NAMES[1], names[2] ?? DEMO_NAMES[2]];
  const p1 = DEMO_PLACES[(no - 1) % DEMO_PLACES.length];
  const p2 = DEMO_PLACES[no % DEMO_PLACES.length];
  return [
    "（演示模式的示例内容）",
    `### 场${no}-1`,
    `夜 内 ${p1}`,
    `出场人物：${a}、${c}`,
    `【字幕：第 ${no} 集】`,
    `△ ${a}推门进来，${c}头也没抬，把一碗面推到他面前。`,
    `${c}：今天来晚了。`,
    `${a}（坐下）：路上耽搁了。`,
    `### 场${no}-2`,
    `日 外 ${p2}`,
    `出场人物：${a}、${b}`,
    `△ ${b}站在路边等他，手里拿着一个信封。`,
    `${b}：这个，是不是你的？`,
    `${a}（愣住）：你从哪儿拿到的？`,
  ].join("\n");
}

function lookPrompt(name: string, age: string, clothes: string): string {
  return [
    `基本信息：${name}，${age}。`,
    "面部特征：五官清楚，神情自然。",
    `服饰装备：${clothes}。`,
    "配饰：无。",
    "姿态构图：全身正面站立，白底定妆。",
    "光影渲染：柔和影棚光，写实。",
  ].join("\n");
}

/** 从剧本的「出场人物：」和场景标题里拆角色、场景（演示：规则拆，不是 AI）。 */
function demoExtract(doc: DramaCanvasDoc): { characters: ExtractedCanvasCharacter[]; scenes: ExtractedCanvasScene[]; notes: string[] } {
  const charEps = new Map<string, Set<number>>();
  const sceneEps = new Map<string, Set<number>>();
  for (const ep of doc.script.episodes) {
    for (const line of ep.text.split(/\r?\n/)) {
      const who = line.match(/^\s*出场人物[:：]\s*(.+)$/);
      if (who) {
        for (const n of who[1].split(/[、，,\s]+/).map((x) => x.trim()).filter(Boolean)) {
          if (!charEps.has(n)) charEps.set(n, new Set());
          charEps.get(n)!.add(ep.no);
        }
        continue;
      }
      const where = line.match(/^\s*(日|夜|晨|清晨|黄昏|傍晚)\s+(内|外)\s+(.+)$/);
      if (where) {
        const n = where[3].trim();
        if (!sceneEps.has(n)) sceneEps.set(n, new Set());
        sceneEps.get(n)!.add(ep.no);
      }
    }
  }
  const allEps = doc.script.episodes.map((e) => e.no);
  const names = [...charEps.keys()].slice(0, 4);
  for (const n of DEMO_NAMES) if (names.length < 3 && !names.includes(n)) names.push(n);
  const characters: ExtractedCanvasCharacter[] = names.map((name, i) => {
    const eps = [...(charEps.get(name) ?? new Set(allEps))].sort((x, y) => x - y);
    const looks = [{ name: "基础造型", prompt: lookPrompt(name, i === 0 ? "二十八岁" : "二十五岁", "日常便装"), episodes: eps }];
    if (i === 0 && eps.length) looks.push({ name: "换装后", prompt: lookPrompt(name, "二十八岁", "深色西装外套"), episodes: [eps[eps.length - 1]] });
    return {
      name,
      role: i < 2 ? "lead" : i === names.length - 1 && names.length > 3 ? "extra" : "support",
      bio: `${name}，剧本里出现在第 ${eps.join("、")} 集。`,
      looks,
    };
  });
  const sceneNames = [...sceneEps.keys()].slice(0, 3);
  for (const n of DEMO_PLACES) if (sceneNames.length < 3 && !sceneNames.includes(n)) sceneNames.push(n);
  const scenes: ExtractedCanvasScene[] = sceneNames.map((name) => ({
    name,
    prompt: `${name}，环境干净，不出现人物；时间和光线按剧本写。`,
    episodes: [...(sceneEps.get(name) ?? new Set(allEps))].sort((x, y) => x - y),
  }));
  return { characters, scenes, notes: ["演示模式：按剧本里的「出场人物」和场景标题拆的，不是 AI 拆的。"] };
}

function lookLabelOf(c: CanvasCharacter, lookName: string): string {
  return !lookName.trim() || lookName === "基础造型" ? c.name : `${c.name}·${lookName}`;
}

const SHOT_PLANS = [
  [4, 3, 3],
  [5, 3],
  [3, 4, 3],
  [4, 4],
];
const SHOT_LINES = [
  (who: string, where: string) => `${where}。中景，平视。${who} 推门进来，四下看了一眼。`,
  (who: string) => `近景，${who} 停住脚步，像是想起了什么。`,
  (who: string) => `特写，${who} 的手在桌沿上轻轻敲了两下。`,
  (who: string, where: string) => `${where}。全景，${who} 站在窗边，外面下着雨。`,
];

function demoStoryboard(doc: DramaCanvasDoc, no: number, maxSec: number) {
  const looks = doc.characters
    .map((c) => {
      const l = c.looks.find((x) => x.episodes.includes(no)) ?? c.looks[0];
      return l ? `@[${lookLabelOf(c, l.name)}](look:${l.id})` : null;
    })
    .filter((x): x is string => !!x);
  const scenes = (doc.scenes.filter((s) => s.episodes.includes(no)).length ? doc.scenes.filter((s) => s.episodes.includes(no)) : doc.scenes).map(
    (s) => `@[${s.name}](scene:${s.id})`,
  );
  const count = no % 2 === 1 ? 3 : 4;
  const segments = Array.from({ length: count }, (_, i) => {
    let plan = SHOT_PLANS[(i + no) % SHOT_PLANS.length];
    const sum = plan.reduce((a, b) => a + b, 0);
    if (sum > maxSec) plan = plan.map((d) => Math.max(1, Math.floor((d * maxSec) / sum)));
    const who = looks[i % Math.max(1, looks.length)] ?? "一个人";
    const where = scenes[i % Math.max(1, scenes.length)] ?? "室内";
    const lines = plan.map((d, j) => `（${d} 秒）${SHOT_LINES[(i + j) % SHOT_LINES.length](who, where)}`);
    return { text: lines.join("\n"), durationSec: plan.reduce((a, b) => a + b, 0) };
  });
  return { episodeNo: no, segments, notes: ["演示模式：示例分镜脚本，不是 AI 写的。"] };
}

// ── 出图：目标、提示词、参考图 ───────────────────────────────────────────────

const REF_RE = /@\[([^\]\n]{1,40})\]\((look|scene|material):([A-Za-z0-9_-]{1,64})\)/g;

interface ImagePlan {
  target: DramaCanvasRunTarget;
  label: string;
  ratio: CanvasImageRatio;
  prompt: string;
  refKeys: string[];
}

function pickedOfNode(doc: DramaCanvasDoc, id: string): string | undefined {
  for (const c of doc.characters) for (const l of c.looks) if (l.id === id) return pickedKeyOf(l.images);
  const s = doc.scenes.find((x) => x.id === id);
  if (s) return pickedKeyOf(s.images);
  const m = doc.materials.find((x) => x.id === id);
  if (m?.kind === "image") return pickedKeyOf(m.images);
  return undefined;
}

function planImage(doc: DramaCanvasDoc, ratio: DramaCanvasRatio, t: CanvasImageTarget, wanted?: CanvasImageRatio): ImagePlan {
  const upstream = (id: string) =>
    doc.board.edges
      .filter((e) => e.target === id)
      .map((e) => pickedOfNode(doc, e.source))
      .filter((k): k is string => !!k);
  if (t.kind === "look") {
    for (const c of doc.characters) {
      const l = c.looks.find((x) => x.id === t.id);
      if (l) {
        if (!l.prompt.trim()) throw err(400, "DRAMA_CANVAS_PROMPT_EMPTY", `先写「${lookLabelOf(c, l.name)}」的外貌描述再出图`);
        return { target: `look:${l.id}`, label: `${lookLabelOf(c, l.name)} · 定妆照`, ratio: wanted ?? "9:16", prompt: l.prompt, refKeys: upstream(l.id) };
      }
    }
  } else if (t.kind === "scene") {
    const s = doc.scenes.find((x) => x.id === t.id);
    if (s) {
      if (!s.prompt.trim()) throw err(400, "DRAMA_CANVAS_PROMPT_EMPTY", `先写「${s.name}」的场景描述再出图`);
      return { target: `scene:${s.id}`, label: `${s.name} · 场景图`, ratio: wanted ?? ratio, prompt: s.prompt, refKeys: upstream(s.id) };
    }
  } else if (t.kind === "material") {
    const m = doc.materials.find((x) => x.id === t.id);
    if (m && m.kind !== "image") throw err(400, "DRAMA_CANVAS_MATERIAL_NOT_IMAGE", `「${m.name}」是文字素材，不能出图`);
    if (m) {
      if (!m.prompt?.trim()) throw err(400, "DRAMA_CANVAS_PROMPT_EMPTY", `先写「${m.name}」要画什么再出图`);
      return { target: `material:${m.id}`, label: `${m.name}`, ratio: wanted ?? ratio, prompt: m.prompt, refKeys: upstream(m.id) };
    }
  } else {
    const ep = doc.episodes.find((e) => e.no === t.episodeNo);
    const idx = ep?.segments.findIndex((s) => s.id === t.segmentId) ?? -1;
    const seg = idx >= 0 ? ep!.segments[idx] : undefined;
    if (seg) {
      if (!seg.text.trim()) throw err(400, "DRAMA_CANVAS_PROMPT_EMPTY", "这个片段还没有分镜脚本，写好再出首帧");
      const refKeys: string[] = [];
      for (const m of seg.text.matchAll(new RegExp(REF_RE.source, "g"))) {
        const k = pickedOfNode(doc, m[3]);
        if (k && !refKeys.includes(k)) refKeys.push(k);
      }
      const n = String(idx + 1).padStart(2, "0");
      return { target: `frame:${t.episodeNo}:${seg.id}`, label: `第 ${t.episodeNo} 集 · 片段 ${n} 首帧`, ratio, prompt: seg.text, refKeys };
    }
    throw err(404, "DRAMA_CANVAS_SEGMENT_NOT_FOUND", "找不到这个片段，刷新后再试");
  }
  throw err(404, "DRAMA_CANVAS_TARGET_NOT_FOUND", "找不到要出图的那一项，刷新后再试");
}

function requireOwned(keys: string[]): void {
  const bad = keys.filter((k) => !isOwnKey(k));
  if (bad.length) throw err(400, "DRAMA_CANVAS_ASSET_NOT_OWNED", "有参考图不是你的素材，去掉那条连线或引用再生成", { keys: bad });
}

function imageModel(endpointId?: string) {
  const list = MOCK_CANVAS_RENDER_MODELS.image;
  if (!endpointId) return list.find((m) => m.isDefault) ?? list[0];
  const m = list.find((x) => x.endpointId === endpointId);
  if (!m) throw err(503, "ENDPOINT_NOT_ALLOWED", "这个出图模型现在用不了，换一个再试");
  return m;
}

function videoModel(endpointId?: string) {
  const list = MOCK_CANVAS_RENDER_MODELS.video;
  if (!endpointId) return list.find((m) => m.isDefault) ?? list[0];
  const m = list.find((x) => x.endpointId === endpointId);
  if (!m) throw err(503, "ENDPOINT_NOT_ALLOWED", "这个视频模型现在用不了，换一个再试");
  return m;
}

function imageRun(canvasId: string, row: CanvasRow, clientRequestId: string, target: CanvasImageTarget, count: number, ratio: CanvasImageRatio | undefined, endpointId?: string): RunRow {
  if (!Number.isInteger(count) || count < 1 || count > 4) throw err(400, "DRAMA_CANVAS_COUNT_INVALID", "一次出 1 到 4 张");
  const plan = planImage(row.doc, row.ratio, target, target.kind === "segment" ? undefined : ratio);
  requireOwned(plan.refKeys);
  const model = imageModel(endpointId);
  const requested = plan.refKeys.length;
  const cap = Math.min(MAX_REF_IMAGES, model.capability.maxRefImages ?? MAX_REF_IMAGES);
  const applied = Math.min(requested, cap);
  const notes = requested > applied ? [`参考图超过 ${cap} 张，后面的 ${requested - applied} 张没用上`] : [];
  const fail = wantsFail(plan.prompt) ? DEMO_FAIL : undefined;
  const rr = addRun(canvasId, clientRequestId, "image", plan.target, model.creditCost * count, { fail, refs: { requested, applied, notes } });
  if (!fail) {
    const images: CanvasAsset[] = Array.from({ length: count }, (_, i) => {
      const key = `mock/canvas/img-${uid(16)}.png`;
      registerAsset(key, count > 1 ? `${plan.label} ${i + 1}` : plan.label, plan.ratio);
      return { key, runId: rr.run.id };
    });
    rr.result = { images };
  }
  return rr;
}

// ── 服务端 ───────────────────────────────────────────────────────────────────

const DEFAULT_STYLE = { id: "none", name: "无风格", prompt: "" };

export const mockCanvasServer = {
  async list(): Promise<DramaCanvasSummary[]> {
    const rows = load()
      .canvases.filter((c) => !c.deletedAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return mockDelay(rows.map(toSummary), 160);
  },

  async get(id: string): Promise<DramaCanvasDetail> {
    await mockDelay(null, 220);
    return toDetail(requireRow(id));
  },

  async create(body: CreateDramaCanvasBody): Promise<DramaCanvasDetail> {
    await mockDelay(null, 260);
    if (body.ratio !== "9:16" && body.ratio !== "16:9") throw err(400, "DRAMA_CANVAS_RATIO_INVALID", "画幅只能选 9:16 或 16:9");
    const style = body.style && typeof body.style.id === "string" ? { id: body.style.id, name: body.style.name ?? "", prompt: body.style.prompt ?? "" } : DEFAULT_STYLE;
    let script: DramaCanvasDoc["script"];
    let splitNotes: string[] | undefined;
    let title = body.title?.trim() ?? "";
    if (body.source === "idea") {
      const idea = (body.idea ?? "").trim();
      if (!idea) throw err(400, "DRAMA_CANVAS_BODY_INVALID", "先写一句故事想法");
      if (Array.from(idea).length > 500) throw err(400, "DRAMA_CANVAS_BODY_INVALID", "故事想法最多 500 字");
      const targetEpisodes = Math.min(80, Math.max(1, Math.trunc(body.targetEpisodes ?? 10)));
      const episodeDurationSec = Math.min(180, Math.max(30, Math.trunc(body.episodeDurationSec ?? 60)));
      script = { idea, targetEpisodes, episodeDurationSec, episodes: [], history: [] };
      title ||= Array.from(idea).slice(0, 20).join("");
    } else if (body.source === "paste") {
      const text = (body.text ?? "").trim();
      if (!text) throw err(400, "DRAMA_CANVAS_BODY_INVALID", "先把剧本粘贴进来");
      if (Array.from(text).length > 100_000) throw err(400, "DRAMA_CANVAS_BODY_INVALID", "剧本最多 10 万字，分成几张画布来做");
      const split = splitText(text);
      script = { episodes: split.episodes, history: [] };
      splitNotes = split.notes;
      title ||= "未命名画布";
    } else {
      throw err(400, "DRAMA_CANVAS_BODY_INVALID", "请选择粘贴剧本还是让 AI 写");
    }
    const doc: DramaCanvasDoc = {
      schema: 1,
      source: body.source,
      style,
      script,
      characters: [],
      scenes: [],
      materials: [],
      board: { positions: {}, edges: [], collapsed: [], viewport: { x: 0, y: 0, zoom: 1 } },
      episodes: [],
    };
    const at = nowIso();
    const row: CanvasRow = {
      id: `dcv_${uid()}`,
      title: Array.from(title).slice(0, 64).join(""),
      ratio: body.ratio,
      doc,
      docVersion: "",
      createdAt: at,
      updatedAt: at,
    };
    row.docVersion = fingerprint(doc, row.title);
    load().canvases.push(row);
    persist();
    // 切集说明只在这次新建响应里有（GET 详情不带），同服务端
    return { ...toDetail(row), ...(splitNotes ? { splitNotes } : {}) };
  },

  async save(id: string, body: SaveDramaCanvasBody): Promise<SaveDramaCanvasResult> {
    await mockDelay(null, 180);
    const row = requireRow(id);
    if (!body.baseDocVersion || body.baseDocVersion !== row.docVersion) {
      throw err(409, "DRAMA_CANVAS_STALE", "这张画布在别的页面改过了，载入最新的再改", { docVersion: row.docVersion });
    }
    const doc = stripUrls(clone(validateDoc(body.doc)));
    row.doc = doc;
    const title = body.title?.trim();
    if (title) row.title = Array.from(title).slice(0, 64).join("");
    row.docVersion = fingerprint(doc, row.title);
    row.updatedAt = nowIso();
    persist();
    return { docVersion: row.docVersion, updatedAt: row.updatedAt };
  },

  async remove(id: string): Promise<void> {
    await mockDelay(null, 160);
    const row = requireRow(id);
    row.deletedAt = nowIso();
    persist();
  },

  async splitScript(id: string, body: SplitCanvasScriptBody): Promise<SplitCanvasScriptResult> {
    await mockDelay(null, 160);
    requireRow(id);
    const text = (body?.text ?? "").trim();
    if (!text) throw err(400, "DRAMA_CANVAS_BODY_INVALID", "先把剧本粘贴进来");
    if (Array.from(text).length > 100_000) throw err(400, "DRAMA_CANVAS_BODY_INVALID", "剧本最多 10 万字");
    return splitText(text);
  },

  /** 签名换新：只签这张画布里出现过的（已保存的文档 + 这张画布的运行结果）或上传过的 key；别的不出现在 urls 里。 */
  async signAssets(id: string, body: SignCanvasAssetsBody): Promise<SignCanvasAssetsResult> {
    await mockDelay(null, 120);
    const row = requireRow(id);
    const keys = Array.isArray(body?.keys) ? body.keys.filter((k): k is string => typeof k === "string") : [];
    if (keys.length > 100) throw err(400, "DRAMA_CANVAS_BODY_INVALID", "一次最多换 100 个地址");
    const known = new Set<string>();
    collectKeys(row.doc, known);
    for (const r of load().runs) {
      if (r.run.canvasId !== id) continue;
      collectKeys(r.run.result, known);
      collectKeys(r.result, known);
    }
    const urls: Record<string, string> = {};
    for (const k of keys) {
      if (!known.has(k) && !uploadedUrlForKey(k)) continue;
      const url = signKey(k);
      if (url) urls[k] = url;
    }
    return { urls };
  },

  async runScript(id: string, body: CanvasScriptRunBody): Promise<DramaCanvasRun> {
    await mockDelay(null, 200);
    const { row, dup } = preflight(id, body, scriptTargetOf(body));
    if (dup) return publicRun(dup);
    const s = row.doc.script;
    const instruction = body.instruction?.trim();
    if (instruction && Array.from(instruction).length > 200) throw err(400, "DRAMA_CANVAS_INSTRUCTION_TOO_LONG", "重写要求最多 200 字");
    let rr: RunRow;
    if (body.stage === "setting") {
      const idea = s.idea?.trim() || s.setting?.text?.trim();
      if (!idea) throw err(400, "DRAMA_CANVAS_IDEA_EMPTY", "先写一句故事想法");
      const fail = wantsFail(idea, instruction) ? DEMO_FAIL : undefined;
      rr = addRun(id, body.clientRequestId, "script", "script:setting", PRICE.setting, { fail, result: { setting: { text: demoSetting(s.idea ?? idea) } } });
    } else if (body.stage === "outline") {
      if (!s.setting?.text?.trim()) throw err(400, "DRAMA_CANVAS_SETTING_EMPTY", "先写好故事大纲再写分集剧情");
      const n = Math.min(80, Math.max(1, s.targetEpisodes ?? 10));
      const fail = wantsFail(s.setting.text, instruction) ? DEMO_FAIL : undefined;
      rr = addRun(id, body.clientRequestId, "script", "script:outline", PRICE.outline, { fail, result: { outline: { episodes: demoOutline(n) } } });
    } else if (body.stage === "episode") {
      const no = body.episodeNo;
      if (!no || !Number.isInteger(no) || no < 1) throw err(400, "DRAMA_CANVAS_EPISODE_REQUIRED", "要写哪一集？");
      const cur = s.episodes.find((e) => e.no === no);
      const planned = s.outline?.episodes.find((e) => e.no === no);
      if (!cur && !planned) throw err(404, "DRAMA_CANVAS_EPISODE_NOT_FOUND", `分集剧情里还没有第 ${no} 集`);
      if (cur?.locked) throw err(409, "DRAMA_CANVAS_EPISODE_LOCKED", `第 ${no} 集锁上了，先解锁再重写`);
      const names = row.doc.characters.map((c) => c.name);
      const fail = wantsFail(cur?.text, instruction) ? DEMO_FAIL : undefined;
      rr = addRun(id, body.clientRequestId, "script", `script:episode:${no}`, PRICE.episode, {
        fail,
        result: { episode: { no, title: planned?.title ?? cur?.title ?? `第 ${no} 集`, text: demoEpisodeText(no, names) } },
      });
    } else {
      throw err(400, "DRAMA_CANVAS_STAGE_INVALID", "不认识要写哪一段");
    }
    persist();
    return publicRun(rr);
  },

  async runExtract(id: string, body: CanvasExtractRunBody): Promise<DramaCanvasRun> {
    await mockDelay(null, 200);
    const { row, dup } = preflight(id, body, "extract");
    if (dup) return publicRun(dup);
    if (!row.doc.script.episodes.some((e) => e.text.trim())) throw err(400, "DRAMA_CANVAS_SCRIPT_EMPTY", "剧本还是空的，先写好剧本再拆");
    const fail = wantsFail(...row.doc.script.episodes.map((e) => e.text)) ? DEMO_FAIL : undefined;
    const rr = addRun(id, body.clientRequestId, "extract", "extract", PRICE.extract, { fail, result: { extract: demoExtract(row.doc) } });
    persist();
    return publicRun(rr);
  },

  async runImage(id: string, body: CanvasImageRunBody): Promise<DramaCanvasRun> {
    await mockDelay(null, 200);
    const { row, dup } = preflight(id, body, imageTargetKey(body.target));
    if (dup) return publicRun(dup);
    const rr = imageRun(id, row, body.clientRequestId, body.target, body.count, body.ratio, body.endpointId);
    persist();
    return publicRun(rr);
  },

  async runImageBatch(id: string, body: CanvasImageBatchBody): Promise<DramaCanvasRun[]> {
    await mockDelay(null, 240);
    const row = requireRow(id);
    requireKey(body?.clientRequestId);
    if (!Array.isArray(body.items) || !body.items.length) throw err(400, "DRAMA_CANVAS_BATCH_EMPTY", "先选要出图的造型或场景。");
    if (body.items.length > MAX_BATCH_ITEMS) {
      throw err(400, "DRAMA_CANVAS_BATCH_TOO_LARGE", `一次最多给 ${MAX_BATCH_ITEMS} 项出图，分几次来。`);
    }
    const images = body.items.reduce((n, it) => n + (Number.isInteger(it?.count) ? it.count : 1), 0);
    if (images > MAX_BATCH_IMAGES) {
      throw err(400, "DRAMA_CANVAS_BATCH_TOO_LARGE", `一次最多出 ${MAX_BATCH_IMAGES} 张图（这次选了 ${images} 张），分几次来。`);
    }
    // 同服务端 existingBatch：原始键上的那条必须是本画布这一批的第 0 项，按它记着的整批 id 原样返回
    const lead = findByRequest(body.clientRequestId);
    if (lead) {
      const ids = lead.batchRunIds;
      if (lead.run.canvasId !== id || lead.run.kind !== "image" || !ids?.length || ids[0] !== lead.run.id) throw REUSED();
      const all = load().runs;
      return ids.map((rid) => all.find((r) => r.run.id === rid)).filter((r): r is RunRow => !!r).map(publicRun);
    }
    if (body.docVersion !== row.docVersion) {
      throw err(409, "DRAMA_CANVAS_STALE", "画布有新的改动还没保存上，先保存再生成", { docVersion: row.docVersion });
    }
    // 先把每一项都校验一遍（preflight 在冻结之前），有一项不行整批不发
    for (const it of body.items) {
      const plan = planImage(row.doc, row.ratio, it.target, it.target.kind === "segment" ? undefined : it.ratio);
      requireOwned(plan.refKeys);
      if (!Number.isInteger(it.count) || it.count < 1 || it.count > 4) throw err(400, "DRAMA_CANVAS_COUNT_INVALID", "一次出 1 到 4 张");
    }
    imageModel(body.endpointId);
    // 第 0 项占原始键（和单条生成抢同一个键），其余 `${键}:${序号}`
    const rows = body.items.map((it, i) =>
      imageRun(id, row, i === 0 ? body.clientRequestId : `${body.clientRequestId}:${i}`, it.target, it.count, it.ratio, body.endpointId),
    );
    rows[0].batchRunIds = rows.map((r) => r.run.id);
    for (const r of rows.slice(1)) r.batchMember = true;
    persist();
    return rows.map(publicRun);
  },

  async runStoryboard(id: string, body: CanvasStoryboardRunBody): Promise<DramaCanvasRun> {
    await mockDelay(null, 200);
    const { row, dup } = preflight(id, body, `storyboard:${body.episodeNo}`);
    if (dup) return publicRun(dup);
    const ep = row.doc.script.episodes.find((e) => e.no === body.episodeNo);
    if (!ep || !ep.text.trim()) throw err(400, "DRAMA_CANVAS_SCRIPT_EMPTY", `第 ${body.episodeNo} 集还没有剧本，先去剧本页写好`);
    const maxSec = Math.min(30, Math.max(4, Math.trunc(body.maxSegmentSec ?? 10)));
    const fail = wantsFail(ep.text) ? DEMO_FAIL : undefined;
    const rr = addRun(id, body.clientRequestId, "storyboard", `storyboard:${body.episodeNo}`, PRICE.storyboard, {
      fail,
      result: { storyboard: demoStoryboard(row.doc, body.episodeNo, maxSec) },
    });
    persist();
    return publicRun(rr);
  },

  async runVideo(id: string, body: CanvasVideoRunBody): Promise<DramaCanvasRun> {
    await mockDelay(null, 240);
    const { row, dup } = preflight(id, body, `video:${body.episodeNo}:${body.segmentId}`);
    if (dup) return publicRun(dup);
    const ep = row.doc.episodes.find((e) => e.no === body.episodeNo);
    const idx = ep?.segments.findIndex((s) => s.id === body.segmentId) ?? -1;
    const seg = idx >= 0 ? ep!.segments[idx] : undefined;
    if (!seg) throw err(404, "DRAMA_CANVAS_SEGMENT_NOT_FOUND", "找不到这个片段，刷新后再试");
    if (!seg.text.trim()) throw err(400, "DRAMA_CANVAS_PROMPT_EMPTY", "这个片段还没有分镜脚本");
    const model = videoModel(body.endpointId);
    const dur = Math.trunc(seg.durationSec);
    if (dur <= 0) throw err(400, "DRAMA_CANVAS_SEGMENT_DURATION_INVALID", "片段里还没写镜头时长，每一行开头写「（4 秒）」这样的时长");
    const max = model.capability.maxDurationSec ?? 10;
    if (dur > max) throw err(400, "DRAMA_CANVAS_SEGMENT_TOO_LONG", `这个片段 ${dur} 秒，超过了这个视频模型单条最长 ${max} 秒`);
    const frameKey = body.useFirstFrame === false ? undefined : pickedKeyOf(seg.frame);
    if (frameKey) requireOwned([frameKey]);
    const sees = (model.capability.maxRefImages ?? 1) !== 0;
    const notes: string[] = [];
    if (!frameKey) notes.push("这个片段没用首帧，按文字生成的，角色长相可能对不上");
    else if (!sees) notes.push("这个模型不看首帧，角色长相可能对不上");
    const fail = wantsFail(seg.text) ? DEMO_FAIL : undefined;
    const rr = addRun(id, body.clientRequestId, "video", `video:${body.episodeNo}:${seg.id}`, model.creditCost * dur, {
      fail,
      slow: true,
      refs: { requested: frameKey ? 1 : 0, applied: frameKey && sees ? 1 : 0, notes },
    });
    if (!fail) {
      const key = `mock/canvas/vid-${uid(16)}.mp4`;
      const lastFrameKey = `mock/canvas/last-${uid(16)}.png`;
      registerAsset(lastFrameKey, `第 ${body.episodeNo} 集 · 片段 ${String(idx + 1).padStart(2, "0")} 最后一帧`, row.ratio);
      rr.result = { video: { key, lastFrameKey, durationSec: dur, runId: rr.run.id, createdAt: new Date(rr.readyAt).toISOString() } };
    }
    persist();
    return publicRun(rr);
  },

  async runAssemble(id: string, body: CanvasAssembleRunBody): Promise<DramaCanvasRun> {
    await mockDelay(null, 200);
    const { row, dup } = preflight(id, body, `assemble:${body.episodeNo}`);
    if (dup) return publicRun(dup);
    const ep = row.doc.episodes.find((e) => e.no === body.episodeNo);
    if (!ep || !ep.segments.length) throw err(400, "DRAMA_CANVAS_NOTHING_TO_ASSEMBLE", `第 ${body.episodeNo} 集还没有片段`);
    const picked = ep.segments.map((s) => (s.video.versions.find((v) => v.key === s.video.pickedKey) ?? s.video.versions[0]) ?? null);
    const missing = picked.filter((v) => !v).length;
    if (missing) throw err(400, "DRAMA_CANVAS_NOTHING_TO_ASSEMBLE", `还有 ${missing} 个片段没有视频，全部生成好再合成`);
    const rr = addRun(id, body.clientRequestId, "assemble", `assemble:${body.episodeNo}`, 0, { slow: true });
    const durationSec = picked.reduce((acc, v, i) => acc + (v!.durationSec ?? ep.segments[i].durationSec), 0);
    rr.result = {
      assembled: {
        key: `mock/canvas/ep${body.episodeNo}-${uid(12)}.mp4`,
        durationSec,
        at: new Date(rr.readyAt).toISOString(),
        videoKeys: picked.map((v) => v!.key),
        runId: rr.run.id,
      },
    };
    persist();
    return publicRun(rr);
  },

  async getRuns(id: string, ids: string[]): Promise<DramaCanvasRun[]> {
    await mockDelay(null, 120);
    requireRow(id);
    const want = new Set(ids);
    const rows = load().runs.filter((r) => r.run.canvasId === id && want.has(r.run.id));
    const out = rows.map(publicRun);
    persist();
    return out;
  },

  /** 按幂等键只查不建（同服务端 runs/lookup）：没受理 / 别的画布 → 空数组；批量的原始键 → 整批；键不合法（含「:」）→ 400；没有副作用。 */
  async lookupRuns(id: string, clientRequestId: string): Promise<DramaCanvasRun[]> {
    await mockDelay(null, 120);
    const key = requireKey(clientRequestId); // 含「:」的子键在这里就 400，同服务端（到不了查询分支）
    requireRow(id);
    const hit = findByRequest(key);
    if (!hit || hit.run.canvasId !== id) return [];
    const all = load().runs;
    const rows = hit.batchRunIds?.length
      ? hit.batchRunIds.map((rid) => all.find((r) => r.run.id === rid)).filter((r): r is RunRow => !!r)
      : [hit];
    const out = rows.map(publicRun);
    persist();
    return out;
  },

  async cancelRun(id: string, runId: string): Promise<DramaCanvasRun> {
    await mockDelay(null, 160);
    requireRow(id);
    const rr = load().runs.find((r) => r.run.canvasId === id && r.run.id === runId);
    if (!rr) throw err(404, "DRAMA_CANVAS_RUN_NOT_FOUND", "找不到这次生成");
    advance(rr);
    if (rr.run.status === "canceled") return publicRun(rr);
    if (rr.run.status !== "queued") {
      throw err(
        409,
        "DRAMA_CANVAS_RUN_NOT_CANCELABLE",
        rr.run.status === "running" ? "已经开始生成，停不下来" : "这次生成已经结束了，不用取消",
      );
    }
    rr.run.status = "canceled";
    rr.run.finishedAt = nowIso();
    persist();
    return publicRun(rr);
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// 预置数据
// ═════════════════════════════════════════════════════════════════════════════

const EXAMPLE_ID = "dcv_example_night_bus";
const EMPTY_ID = "dcv_example_new";

const EX_SETTING = [
  "题材：都市悬疑 · 温情",
  "主线：夜班公交司机周岳连续七个晚上在 23 路末班车上捡到同一个女孩落下的东西。第七晚，他捡到一张二十年前的 23 路车票，背面写着他父亲的工号。女孩沈念要找的不是失物，是二十年前那趟末班车上发生过的事。",
  "人物小传：",
  "周岳，四十岁，23 路末班车司机，话少，做事一板一眼。父亲也开过这条线，二十年前一次夜班后辞了职，从不提原因。",
  "沈念，二十六岁，插画师，安静、有礼貌，每晚十一点零五分在梧桐路站上车，总坐在司机后面第三排。",
  "老吴，六十岁，公交总站失物招领处的管理员，认识周岳的父亲，记性极好。",
].join("\n");

const EX_OUTLINE: CanvasOutlineEpisode[] = [
  {
    no: 1,
    title: "落下的东西",
    hook: "末班车第七晚，座位上多了一张二十年前的车票。",
    summary: "周岳连续几晚在第三排捡到沈念落下的伞、速写本、耳机，都交到失物招领处。第七晚捡到一张旧车票，老吴一眼认出背面的工号。",
  },
  {
    no: 2,
    title: "旧车票",
    hook: "车票背面的工号，是周岳父亲的。",
    summary: "周岳在终点站等到沈念，问她为什么一直落东西。沈念说二十年前的一个雨夜，她母亲在这趟车上临产，是司机没回站、直接把车开到了医院。",
  },
];

const EX_EP1 = [
  "### 场1-1",
  "夜 内 23路末班车车厢",
  "出场人物：周岳、沈念",
  "【字幕：23 路末班车，23:05，梧桐路站】",
  "△ 车门打开，沈念收伞上车，刷卡，走到第三排坐下。周岳从后视镜里看了她一眼。",
  "周岳：小心脚下，地板湿。",
  "沈念（点头）：谢谢师傅。",
  "△ 车开过三个路口，沈念一直望着窗外。",
  "### 场1-2",
  "夜 内 23路末班车车厢",
  "出场人物：周岳",
  "△ 终点站，乘客都下完了。周岳拿着手电走到第三排，座位上放着一把折好的伞。",
  "周岳（自言自语）：又落了。",
  "### 场1-3",
  "日 内 公交总站失物招领处",
  "出场人物：周岳、老吴",
  "△ 老吴把伞挂到墙上，旁边已经挂着一本速写本、一副耳机。",
  "老吴：第七样了。同一个座位？",
  "周岳：同一个座位。",
  "△ 周岳从口袋里掏出一张泛黄的车票，递过去。",
  "老吴（戴上老花镜，愣住）：这工号……是你爸的。",
].join("\n");

const EX_EP2 = [
  "### 场2-1",
  "夜 外 终点站站台",
  "出场人物：周岳、沈念",
  "【字幕：第二天晚上，雨】",
  "△ 周岳没有下班，撑着伞站在终点站站台。末班车进站，沈念最后一个下车。",
  "周岳：你落下的东西，都在失物招领处。",
  "沈念（停住）：我知道。",
  "周岳：那张车票呢？",
  "△ 沈念抬头看他，雨声很大。",
  "沈念：我在找二十年前开这趟车的司机。",
  "### 场2-2",
  "夜 内 23路末班车车厢",
  "出场人物：周岳、沈念",
  "【闪回】",
  "△ 二十年前的雨夜，车厢灯光昏黄，一个年轻女人捂着肚子蜷在第三排。",
  "沈念（vo）：我妈说，那天晚上司机没有回站，直接把车开到了医院。",
].join("\n");

function seed(): MockState {
  const s: MockState = { canvases: [], runs: [], assets: {} };
  const t0 = Date.now() - 2 * 24 * 3600 * 1000;
  const iso = (offsetMin: number) => new Date(t0 + offsetMin * 60_000).toISOString();

  const img = (key: string, label: string, ratio: CanvasImageRatio, runId: string): CanvasAsset => {
    s.assets[key] = { label, ratio };
    return { key, runId };
  };

  const seedRun = (
    id: string,
    kind: DramaCanvasRunKind,
    target: DramaCanvasRunTarget,
    at: number,
    extra: Partial<DramaCanvasRun> = {},
    timing?: { queuedUntil: number; readyAt: number; result?: DramaCanvasRunResult },
  ) => {
    const status = extra.status ?? "succeeded";
    s.runs.push({
      run: {
        id,
        canvasId: EXAMPLE_ID,
        kind,
        target,
        status,
        cost: extra.cost ?? 0,
        createdAt: iso(at),
        ...(status === "succeeded" || status === "failed" ? { finishedAt: iso(at + 1) } : {}),
        ...extra,
      },
      clientRequestId: `seed-${id}`,
      queuedUntil: timing?.queuedUntil ?? 0,
      readyAt: timing?.readyAt ?? 0,
      ...(timing?.result ? { result: timing.result } : {}),
    });
  };

  // 角色和造型
  const zyBase1 = img("mock/canvas/ex/zhouyue-base-1.png", "周岳 · 定妆照 1", "9:16", "dcr_ex_img_zy");
  const zyBase2 = img("mock/canvas/ex/zhouyue-base-2.png", "周岳 · 定妆照 2", "9:16", "dcr_ex_img_zy");
  const sn = img("mock/canvas/ex/shennian-base.png", "沈念 · 定妆照", "9:16", "dcr_ex_img_sn");
  const lw = img("mock/canvas/ex/laowu-base.png", "老吴 · 定妆照", "9:16", "dcr_ex_img_lw");
  const bus = img("mock/canvas/ex/scene-bus.png", "23 路末班车车厢", "9:16", "dcr_ex_img_bus");
  const lf = img("mock/canvas/ex/scene-lostfound.png", "公交总站失物招领处", "9:16", "dcr_ex_img_lf");
  const ticket: CanvasAsset = { key: "mock/canvas/ex/ticket.png" };
  s.assets[ticket.key] = { label: "旧车票（上传的参考图）", ratio: "4:3" };

  const f1 = img("mock/canvas/ex/ep1-seg1-frame.png", "第 1 集 · 片段 01 首帧", "9:16", "dcr_ex_f1");
  const f2 = img("mock/canvas/ex/ep1-seg2-frame.png", "第 1 集 · 片段 02 首帧", "9:16", "dcr_ex_f2");
  const f3 = img("mock/canvas/ex/ep1-seg3-frame.png", "第 1 集 · 片段 03 首帧", "9:16", "dcr_ex_f3");
  s.assets["mock/canvas/ex/ep1-seg1-last.png"] = { label: "第 1 集 · 片段 01 最后一帧", ratio: "9:16" };
  s.assets["mock/canvas/ex/ep1-seg2-last-a.png"] = { label: "第 1 集 · 片段 02 最后一帧", ratio: "9:16" };
  s.assets["mock/canvas/ex/ep1-seg2-last-b.png"] = { label: "第 1 集 · 片段 02 最后一帧", ratio: "9:16" };

  const v1 = { key: "mock/canvas/ex/ep1-seg1.mp4", lastFrameKey: "mock/canvas/ex/ep1-seg1-last.png", durationSec: 10, runId: "dcr_ex_v1", createdAt: iso(200) };
  const v2a = { key: "mock/canvas/ex/ep1-seg2-a.mp4", lastFrameKey: "mock/canvas/ex/ep1-seg2-last-a.png", durationSec: 8, runId: "dcr_ex_v2a", createdAt: iso(210) };
  const v2b = { key: "mock/canvas/ex/ep1-seg2-b.mp4", lastFrameKey: "mock/canvas/ex/ep1-seg2-last-b.png", durationSec: 8, runId: "dcr_ex_v2b", createdAt: iso(230) };

  const doc: DramaCanvasDoc = {
    schema: 1,
    source: "idea",
    style: { id: "film-real", name: "写实电影", prompt: "写实电影质感，自然光，35mm 镜头，轻微胶片颗粒" },
    script: {
      idea: "夜班公交司机发现，每晚在同一站上车的女孩，总会在座位上落下一样东西。",
      targetEpisodes: 2,
      episodeDurationSec: 60,
      setting: { text: EX_SETTING, approvedAt: iso(10), run: { runId: "dcr_ex_setting", status: "succeeded" } },
      outline: { episodes: EX_OUTLINE, approvedAt: iso(20), run: { runId: "dcr_ex_outline", status: "succeeded" } },
      episodes: [
        { no: 1, title: "落下的东西", text: EX_EP1, locked: true, run: { runId: "dcr_ex_ep1", status: "succeeded" } },
        { no: 2, title: "旧车票", text: EX_EP2, run: { runId: "dcr_ex_ep2", status: "succeeded" } },
      ],
      history: [
        {
          id: "hv_ex_2",
          at: iso(40),
          label: "重写第 2 集前",
          setting: EX_SETTING,
          outline: EX_OUTLINE,
          episodes: [
            { no: 1, title: "落下的东西", text: EX_EP1 },
            { no: 2, title: "旧车票", text: "### 场2-1\n夜 外 终点站站台\n出场人物：周岳、沈念\n△ 周岳在站台上等她。" },
          ],
        },
        { id: "hv_ex_1", at: iso(20), label: "通过分集剧情", setting: EX_SETTING, outline: EX_OUTLINE, episodes: [] },
      ],
      extractedAt: iso(60),
      extractRun: { runId: "dcr_ex_extract", status: "succeeded" },
    },
    characters: [
      {
        id: "ch_ex_zhouyue",
        name: "周岳",
        role: "lead",
        bio: "23 路末班车司机，话少，做事一板一眼。",
        looks: [
          {
            id: "lk_ex_zhouyue",
            name: "基础造型",
            prompt: [
              "基本信息：中国男性，四十岁，身高一米七八，偏瘦。",
              "面部特征：方脸，眉毛浓，眼角有细纹，胡茬刮得很干净。",
              "服饰装备：深蓝色公交制服外套，白衬衫，工牌别在左胸。",
              "配饰：黑色旧手表。",
              "姿态构图：全身正面站立，双手自然下垂，白底定妆。",
              "光影渲染：柔和影棚光，写实。",
            ].join("\n"),
            // key = 组名（与 constants/canvas-traits.ts 一致，canvas/assets/traits.ts normalizeTraits 原样认）
            traits: { 性别表达: ["男性"], 年龄: ["36–45"], "区域 / 文化背景": ["东亚"], 表情状态: ["平静正视"], 摄影方案: ["白底定妆"] },
            episodes: [1, 2],
            images: { versions: [zyBase2, zyBase1], pickedKey: zyBase2.key },
            run: { runId: "dcr_ex_img_zy", status: "succeeded" },
          },
          {
            id: "lk_ex_zhouyue_casual",
            name: "便装",
            prompt: [
              "基本信息：中国男性，四十岁，偏瘦。",
              "面部特征：同基础造型。",
              "服饰装备：灰色旧夹克，深色长裤，帆布鞋。",
              "配饰：一把黑色长柄伞。",
              "姿态构图：全身，撑伞站立。",
              "光影渲染：雨夜路灯，冷色调。",
            ].join("\n"),
            episodes: [2],
            images: { versions: [] },
            run: { runId: "dcr_ex_img_zy2", status: "failed" },
          },
        ],
      },
      {
        id: "ch_ex_shennian",
        name: "沈念",
        role: "lead",
        bio: "插画师，每晚十一点零五分在梧桐路站上车。",
        looks: [
          {
            id: "lk_ex_shennian",
            name: "基础造型",
            prompt: [
              "基本信息：中国女性，二十六岁，身形纤细。",
              "面部特征：鹅蛋脸，眼睛很亮，素颜。",
              "服饰装备：米色风衣，浅灰色针织衫。",
              "配饰：帆布包，一把透明伞。",
              "姿态构图：全身正面站立，白底定妆。",
              "光影渲染：柔和影棚光，写实。",
            ].join("\n"),
            episodes: [1, 2],
            images: { versions: [sn] },
            run: { runId: "dcr_ex_img_sn", status: "succeeded" },
          },
        ],
      },
      {
        id: "ch_ex_laowu",
        name: "老吴",
        role: "support",
        bio: "公交总站失物招领处的管理员，记性极好。",
        looks: [
          {
            id: "lk_ex_laowu",
            name: "基础造型",
            prompt: [
              "基本信息：中国男性，六十岁，微胖。",
              "面部特征：圆脸，头发花白，戴一副老花镜。",
              "服饰装备：藏青色工作马甲，格子衬衫。",
              "配饰：胸前口袋插着两支笔。",
              "姿态构图：全身正面站立，白底定妆。",
              "光影渲染：柔和影棚光，写实。",
            ].join("\n"),
            episodes: [1],
            images: { versions: [lw] },
            run: { runId: "dcr_ex_img_lw", status: "succeeded" },
          },
        ],
      },
    ],
    scenes: [
      {
        id: "sc_ex_bus",
        name: "23 路末班车车厢",
        prompt: "夜晚的城市公交车车厢，暖黄灯光，窗外是被雨水晕开的霓虹，蓝色塑料座椅，地板湿漉漉。",
        episodes: [1, 2],
        images: { versions: [bus] },
        run: { runId: "dcr_ex_img_bus", status: "succeeded" },
      },
      {
        id: "sc_ex_lostfound",
        name: "公交总站失物招领处",
        prompt: "狭小的值班室，墙上挂满失物：雨伞、背包、帽子；木桌上一盏台灯；白天，窗外是停满公交车的场站。",
        episodes: [1],
        images: { versions: [lf] },
        run: { runId: "dcr_ex_img_lf", status: "succeeded" },
      },
      {
        id: "sc_ex_terminal",
        name: "终点站站台",
        prompt: "雨夜的公交终点站，一盏路灯，站牌上写着 23 路，地面积水反光，没有人。",
        episodes: [2],
        images: { versions: [] },
      },
    ],
    materials: [
      { id: "mt_ex_ticket", name: "旧车票", kind: "image", images: { versions: [ticket] } },
      { id: "mt_ex_tone", name: "全剧色调", kind: "text", text: "冷蓝夜色为主，车厢里是暖黄的灯，雨一直下。" },
    ],
    board: {
      // 位置留空：画布第一次打开时自动排版（新拆出来的角色 / 场景也是这样）
      positions: {},
      edges: [
        { id: "ed_ex_1", source: "mt_ex_tone", target: "sc_ex_bus" },
        { id: "ed_ex_2", source: "mt_ex_tone", target: "sc_ex_terminal" },
        { id: "ed_ex_3", source: "mt_ex_ticket", target: "sc_ex_lostfound" },
      ],
      collapsed: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    episodes: [
      {
        no: 1,
        storyboardRun: { runId: "dcr_ex_sb1", status: "succeeded" },
        segments: [
          {
            id: "sg_ex1_01",
            text: [
              "（4 秒）夜，@[23 路末班车车厢](scene:sc_ex_bus)。中景，平视。车门打开，@[沈念](look:lk_ex_shennian) 收伞上车，刷卡。",
              "（3 秒）近景，@[周岳](look:lk_ex_zhouyue) 从后视镜里看了她一眼：“小心脚下，地板湿。”",
              "（3 秒）特写，@[沈念](look:lk_ex_shennian) 点头，走向第三排坐下。",
            ].join("\n"),
            durationSec: 10,
            frame: { versions: [f1] },
            frameRun: { runId: "dcr_ex_f1", status: "succeeded" },
            video: { versions: [v1] },
            videoRun: { runId: "dcr_ex_v1", status: "succeeded" },
          },
          {
            id: "sg_ex1_02",
            text: [
              "（5 秒）夜，@[23 路末班车车厢](scene:sc_ex_bus)。全景，乘客都下完了，@[周岳](look:lk_ex_zhouyue) 拿着手电走到第三排。",
              "（3 秒）特写，座位上放着一把折好的伞。",
            ].join("\n"),
            durationSec: 8,
            frame: { versions: [f2] },
            frameRun: { runId: "dcr_ex_f2", status: "succeeded" },
            video: { versions: [v2b, v2a], pickedKey: v2b.key },
            videoRun: { runId: "dcr_ex_v2b", status: "succeeded" },
          },
          {
            id: "sg_ex1_03",
            text: [
              "（4 秒）日，@[公交总站失物招领处](scene:sc_ex_lostfound)。中景，@[老吴](look:lk_ex_laowu) 把伞挂到墙上。",
              "（4 秒）近景，@[周岳](look:lk_ex_zhouyue) 递过一张泛黄的车票，@[老吴](look:lk_ex_laowu) 戴上老花镜，愣住。",
            ].join("\n"),
            durationSec: 8,
            frame: { versions: [f3] },
            frameRun: { runId: "dcr_ex_f3", status: "succeeded" },
            video: { versions: [] },
            videoRun: { runId: "dcr_ex_v3", status: "queued" },
          },
        ],
      },
    ],
  };

  // 运行记录（与文档里的引用对应，接回时 runFor 能拿到结果、失败原因和 refs.notes）
  seedRun("dcr_ex_setting", "script", "script:setting", 5, { cost: PRICE.setting, result: { setting: { text: EX_SETTING } } });
  seedRun("dcr_ex_outline", "script", "script:outline", 15, { cost: PRICE.outline, result: { outline: { episodes: EX_OUTLINE } } });
  seedRun("dcr_ex_ep1", "script", "script:episode:1", 25, { cost: PRICE.episode, result: { episode: { no: 1, title: "落下的东西", text: EX_EP1 } } });
  seedRun("dcr_ex_ep2", "script", "script:episode:2", 41, { cost: PRICE.episode, result: { episode: { no: 2, title: "旧车票", text: EX_EP2 } } });
  seedRun("dcr_ex_extract", "extract", "extract", 55, {
    cost: PRICE.extract,
    result: { extract: { characters: [], scenes: [], notes: ["按剧本拆出 3 个角色、3 个场景。"] } },
  });
  seedRun("dcr_ex_img_zy", "image", "look:lk_ex_zhouyue", 70, { cost: 4, result: { images: [zyBase1, zyBase2] }, refs: { requested: 0, applied: 0, notes: [] } });
  seedRun("dcr_ex_img_zy2", "image", "look:lk_ex_zhouyue_casual", 72, {
    status: "failed",
    cost: 2,
    errorCode: "IMAGE_CALL_FAILED",
    errorMessage: "出图服务这次没有回应，没扣积分，可以再试一次。",
  });
  seedRun("dcr_ex_img_sn", "image", "look:lk_ex_shennian", 74, { cost: 2, result: { images: [sn] }, refs: { requested: 0, applied: 0, notes: [] } });
  seedRun("dcr_ex_img_lw", "image", "look:lk_ex_laowu", 76, { cost: 2, result: { images: [lw] }, refs: { requested: 0, applied: 0, notes: [] } });
  seedRun("dcr_ex_img_bus", "image", "scene:sc_ex_bus", 78, { cost: 2, result: { images: [bus] }, refs: { requested: 0, applied: 0, notes: [] } });
  seedRun("dcr_ex_img_lf", "image", "scene:sc_ex_lostfound", 80, { cost: 2, result: { images: [lf] }, refs: { requested: 1, applied: 1, notes: [] } });
  seedRun("dcr_ex_sb1", "storyboard", "storyboard:1", 100, { cost: PRICE.storyboard });
  seedRun("dcr_ex_f1", "image", "frame:1:sg_ex1_01", 120, { cost: 2, result: { images: [f1] }, refs: { requested: 3, applied: 3, notes: [] } });
  seedRun("dcr_ex_f2", "image", "frame:1:sg_ex1_02", 122, { cost: 2, result: { images: [f2] }, refs: { requested: 2, applied: 2, notes: [] } });
  seedRun("dcr_ex_f3", "image", "frame:1:sg_ex1_03", 124, { cost: 2, result: { images: [f3] }, refs: { requested: 3, applied: 3, notes: [] } });
  seedRun("dcr_ex_v1", "video", "video:1:sg_ex1_01", 190, { cost: 60, result: { video: v1 }, refs: { requested: 1, applied: 1, notes: [] } });
  seedRun("dcr_ex_v2a", "video", "video:1:sg_ex1_02", 205, { cost: 48, result: { video: v2a }, refs: { requested: 1, applied: 1, notes: [] } });
  seedRun("dcr_ex_v2b", "video", "video:1:sg_ex1_02", 225, {
    cost: 32,
    result: { video: v2b },
    refs: { requested: 1, applied: 0, notes: ["这次用的是「文字生视频（不看首帧）」，角色长相可能对不上"] },
  });
  // 片段 03：视频在排队（打开页面后 5 分钟内都能取消；之后开始生成、半分钟后出结果）
  const openedAt = Date.now();
  const v3Key = "mock/canvas/ex/ep1-seg3.mp4";
  s.assets["mock/canvas/ex/ep1-seg3-last.png"] = { label: "第 1 集 · 片段 03 最后一帧", ratio: "9:16" };
  seedRun(
    "dcr_ex_v3",
    "video",
    "video:1:sg_ex1_03",
    (openedAt - t0) / 60_000 - 1,
    { status: "queued", cost: 48, refs: { requested: 1, applied: 1, notes: [] } },
    {
      queuedUntil: openedAt + 5 * 60_000,
      readyAt: openedAt + 5.5 * 60_000,
      result: {
        video: { key: v3Key, lastFrameKey: "mock/canvas/ex/ep1-seg3-last.png", durationSec: 8, runId: "dcr_ex_v3", createdAt: new Date(openedAt + 5.5 * 60_000).toISOString() },
      },
    },
  );

  s.canvases.push({
    id: EXAMPLE_ID,
    title: "示例：末班车",
    ratio: "9:16",
    doc,
    docVersion: fingerprint(doc, "示例：末班车"),
    createdAt: iso(0),
    updatedAt: iso(240),
  });

  const emptyDoc: DramaCanvasDoc = {
    schema: 1,
    source: "idea",
    style: { id: "none", name: "无风格", prompt: "" },
    script: {
      idea: "外卖骑手每晚都会接到同一个地址的第七单，门后始终没人应，只有一张写着「谢谢」的便签。",
      targetEpisodes: 6,
      episodeDurationSec: 60,
      episodes: [],
      history: [],
    },
    characters: [],
    scenes: [],
    materials: [],
    board: { positions: {}, edges: [], collapsed: [], viewport: { x: 0, y: 0, zoom: 1 } },
    episodes: [],
  };
  const created = new Date(Date.now() - 10 * 60_000).toISOString();
  s.canvases.push({
    id: EMPTY_ID,
    title: "外卖骑手的第七单",
    ratio: "9:16",
    doc: emptyDoc,
    docVersion: fingerprint(emptyDoc, "外卖骑手的第七单"),
    createdAt: created,
    updatedAt: created,
  });
  return s;
}
