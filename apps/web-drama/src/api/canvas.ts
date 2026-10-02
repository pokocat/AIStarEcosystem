// ─────────────────────────────────────────────────────────────────────────────
// api/canvas.ts —— 画布（v0.198，设计真源 docs/drama-canvas-plan.md §4 · 契约 packages/types/src/drama-canvas.ts）。
// 后端：/api/me/drama/canvases/**，走 drama 开通，按 owner 隔离。
//
// 页面**不直接调这里**：文档读写走 canvas/core 的 useCanvasDoc，生成走 useCanvasRuns().submit()
// （先存再发、幂等键、轮询合并都在那儿）。这里只是一层薄薄的 HTTP。例外：「我的画布」列表、新建页、上传参考图。
//
// USE_MOCK=1 时走 mocks/canvas.ts 的内存假服务端，与真服务端同形（§8.0.1 ⑦）：保存校验 baseDocVersion（409）、
// 保存剥 url 读出派生 url、运行记录 queued → running → succeeded、按 clientRequestId 幂等、可取消。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK } from "./_client";
import { uploadAssetRef } from "./drama-assets";
import { mockCanvasServer as mock } from "@/mocks/canvas";
import type {
  CanvasAsset,
  CanvasAssembleRunBody,
  CanvasExtractRunBody,
  CanvasImageBatchBody,
  CanvasImageRunBody,
  CanvasScriptRunBody,
  CanvasStoryboardRunBody,
  CanvasVideoRunBody,
  CreateDramaCanvasBody,
  DramaCanvasDetail,
  DramaCanvasRun,
  DramaCanvasSummary,
  SaveDramaCanvasBody,
  SaveDramaCanvasResult,
  SignCanvasAssetsResult,
  SplitCanvasScriptBody,
  SplitCanvasScriptResult,
} from "@ai-star-eco/types/drama-canvas";

// ── 画布 ─────────────────────────────────────────────────────────────────────

/** 我的画布（按 updatedAt 倒序；封面已签名）。 */
async function list(): Promise<DramaCanvasSummary[]> {
  if (USE_MOCK) return mock.list();
  return apiFetch<DramaCanvasSummary[]>("/me/drama/canvases");
}

/** 新建（免费）。粘贴的剧本由服务端按集切开放进 script.episodes。 */
async function create(body: CreateDramaCanvasBody): Promise<DramaCanvasDetail> {
  if (USE_MOCK) return mock.create(body);
  return apiFetch<DramaCanvasDetail>("/me/drama/canvases", { method: "POST", body });
}

/** 详情：doc + docVersion；只给本人的 key 派生 url。找不到 → 404 DRAMA_CANVAS_NOT_FOUND。 */
async function get(id: string): Promise<DramaCanvasDetail> {
  if (USE_MOCK) return mock.get(id);
  return apiFetch<DramaCanvasDetail>(`/me/drama/canvases/${encodeURIComponent(id)}`);
}

/**
 * 保存整份文档。baseDocVersion 对不上 → ApiError（code DRAMA_CANVAS_STALE，status 409）；
 * 调用方停掉自动保存，**不要**重试（重试 = 覆盖别处的改动）。超过 4MB → 413 DRAMA_CANVAS_TOO_LARGE。
 */
async function save(id: string, body: SaveDramaCanvasBody): Promise<SaveDramaCanvasResult> {
  if (USE_MOCK) return mock.save(id, body);
  return apiFetch<SaveDramaCanvasResult>(`/me/drama/canvases/${encodeURIComponent(id)}`, { method: "PUT", body });
}

/** 删除（服务端软删）。 */
async function remove(id: string): Promise<void> {
  if (USE_MOCK) return mock.remove(id);
  await apiFetch<void>(`/me/drama/canvases/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** 粘贴的剧本按集切开（免费、同步、规则切分不调模型；不改文档，结果由页面合进去再保存）。 */
async function splitScript(id: string, body: SplitCanvasScriptBody): Promise<SplitCanvasScriptResult> {
  if (USE_MOCK) return mock.splitScript(id, body);
  return apiFetch<SplitCanvasScriptResult>(`/me/drama/canvases/${encodeURIComponent(id)}/script/split`, { method: "POST", body });
}

/**
 * 签名地址换新：图 / 视频加载失败（签名 1 小时过期）时按 key 换新地址，不重新拉整份文档、不丢没存的改动。
 * 只给本人的 key 签；不是本人的、不存在的不出现在 urls 里（不报错）。一次最多 100 个 key。
 * 页面不直接调：用 `@/canvas/shell` 的 CanvasImage / CanvasVideo（批量、缓存、只重试一次都在那儿）。
 */
async function signAssets(id: string, keys: string[]): Promise<SignCanvasAssetsResult> {
  if (!keys.length) return { urls: {} };
  if (USE_MOCK) return mock.signAssets(id, { keys });
  return apiFetch<SignCanvasAssetsResult>(`/me/drama/canvases/${encodeURIComponent(id)}/assets/sign`, { method: "POST", body: { keys } });
}

// ── 生成（都返回运行记录；同 clientRequestId 重复请求回原记录）────────────────

async function runScript(id: string, body: CanvasScriptRunBody): Promise<DramaCanvasRun> {
  if (USE_MOCK) return mock.runScript(id, body);
  return apiFetch<DramaCanvasRun>(`/me/drama/canvases/${encodeURIComponent(id)}/runs/script`, { method: "POST", body });
}

async function runExtract(id: string, body: CanvasExtractRunBody): Promise<DramaCanvasRun> {
  if (USE_MOCK) return mock.runExtract(id, body);
  return apiFetch<DramaCanvasRun>(`/me/drama/canvases/${encodeURIComponent(id)}/runs/extract`, { method: "POST", body });
}

async function runImage(id: string, body: CanvasImageRunBody): Promise<DramaCanvasRun> {
  if (USE_MOCK) return mock.runImage(id, body);
  return apiFetch<DramaCanvasRun>(`/me/drama/canvases/${encodeURIComponent(id)}/runs/image`, { method: "POST", body });
}

/** 批量出图：一次报总价、一次冻结；每项一条运行记录。 */
async function runImageBatch(id: string, body: CanvasImageBatchBody): Promise<DramaCanvasRun[]> {
  if (USE_MOCK) return mock.runImageBatch(id, body);
  return apiFetch<DramaCanvasRun[]>(`/me/drama/canvases/${encodeURIComponent(id)}/runs/image-batch`, { method: "POST", body });
}

async function runStoryboard(id: string, body: CanvasStoryboardRunBody): Promise<DramaCanvasRun> {
  if (USE_MOCK) return mock.runStoryboard(id, body);
  return apiFetch<DramaCanvasRun>(`/me/drama/canvases/${encodeURIComponent(id)}/runs/storyboard`, { method: "POST", body });
}

async function runVideo(id: string, body: CanvasVideoRunBody): Promise<DramaCanvasRun> {
  if (USE_MOCK) return mock.runVideo(id, body);
  return apiFetch<DramaCanvasRun>(`/me/drama/canvases/${encodeURIComponent(id)}/runs/video`, { method: "POST", body });
}

async function runAssemble(id: string, body: CanvasAssembleRunBody): Promise<DramaCanvasRun> {
  if (USE_MOCK) return mock.runAssemble(id, body);
  return apiFetch<DramaCanvasRun>(`/me/drama/canvases/${encodeURIComponent(id)}/runs/assemble`, { method: "POST", body });
}

/** 批量查运行记录（刷新接回、轮询）。ids 为空直接回空数组。 */
async function getRuns(id: string, ids: string[]): Promise<DramaCanvasRun[]> {
  if (!ids.length) return [];
  if (USE_MOCK) return mock.getRuns(id, ids);
  return apiFetch<DramaCanvasRun[]>(`/me/drama/canvases/${encodeURIComponent(id)}/runs`, { query: { ids: ids.join(",") } });
}

/**
 * 按幂等键**只查不建**（GET runs/lookup?clientRequestId=）：受理过 → 运行记录（批量按原始键回整批），
 * 没受理过 → 空数组。没有副作用、不扣费。进页确认「当初到底受理了没有」只许用它，
 * 不许用原键重发 POST（没受理过的请求重发一次 = 一笔用户没点过的扣费）。
 */
async function lookupRuns(id: string, clientRequestId: string): Promise<DramaCanvasRun[]> {
  if (USE_MOCK) return mock.lookupRuns(id, clientRequestId);
  return apiFetch<DramaCanvasRun[]>(`/me/drama/canvases/${encodeURIComponent(id)}/runs/lookup`, { query: { clientRequestId } });
}

/** 取消排队中的；已经交给厂商的 → 409 DRAMA_CANVAS_RUN_NOT_CANCELABLE。 */
async function cancelRun(id: string, runId: string): Promise<DramaCanvasRun> {
  if (USE_MOCK) return mock.cancelRun(id, runId);
  return apiFetch<DramaCanvasRun>(
    `/me/drama/canvases/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}/cancel`,
    { method: "POST" },
  );
}

/**
 * 上传一张参考图 → { key, url }。复用短剧素材上传（POST /me/drama/assets/uploads，
 * 写 storage_asset 归属，之后才能当参考图用）。cat ∈ 人物 / 场景 / 道具 / 其他。
 */
async function uploadImage(file: File, cat: string = "其他"): Promise<CanvasAsset> {
  const ref = await uploadAssetRef(file, cat);
  return { key: ref.cdnKey, url: ref.url };
}

export const CanvasApi = {
  list,
  get,
  create,
  save,
  remove,
  splitScript,
  signAssets,
  runScript,
  runExtract,
  runImage,
  runImageBatch,
  runStoryboard,
  runVideo,
  runAssemble,
  getRuns,
  lookupRuns,
  cancelRun,
  uploadImage,
};
