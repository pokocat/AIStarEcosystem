// 账号区接口：任务历史、存储用量、画布回收站、充值记录。
// 服务端：/api/v1/ip-studio/task-history、/storage、/projects/trash、/projects/{id}/restore；充值记录走 /api/me/wallet/recharge/orders。
// 演示模式给与服务端同形的示例数据，界面标「演示数据」，不冒充真实记录。

import type {
  RechargeOrder, StudioStorageUsage, StudioTaskHistoryItem, StudioTaskHistoryPage, StudioTaskStatus, StudioTaskType, StudioTrashedCanvas,
} from "@ai-star-eco/types";
import { apiFetch, buildQuery, mockDelay } from "./_client";

// 演示开关照抄 proto/api 的定义（未设置 NEXT_PUBLIC_USE_MOCK 时默认演示）：账号页其余部分走 proto/api，两边要一致。
// 不直接从 proto/api 引入：它在模块加载时就设置产品码，`@/ip/api` 的所有使用方都会被连带加载它。
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "0";
const jobApi = async () => (await import("@/proto/api")).JobApi;

export interface TaskHistoryQuery {
  status?: StudioTaskStatus;
  type?: StudioTaskType;
  /** 0 = 全部时间。 */
  days: number;
  page: number;
}

export async function taskHistory(query: TaskHistoryQuery): Promise<StudioTaskHistoryPage> {
  if (USE_MOCK) return mockDelay(mockHistory(query));
  const qs = buildQuery({ status: query.status, type: query.type, days: query.days, page: query.page });
  return apiFetch<StudioTaskHistoryPage>(`/v1/ip-studio/task-history${qs}`);
}

/** 画布上这几类生成可以在任务历史里直接取消；导演台、对话、写作各有自己的停止流程，回原处操作。 */
const CANCELLABLE_RUN_KINDS = new Set(["generate", "identity", "studio-image", "studio-video", "studio-audio", "studio-lip-sync"]);

export function canCancelTask(item: StudioTaskHistoryItem): boolean {
  if (item.status !== "running") return false;
  return item.source === "digital-human" || (item.source === "canvas" && CANCELLABLE_RUN_KINDS.has(item.kind ?? ""));
}

export function canRetryTask(item: StudioTaskHistoryItem): boolean {
  return item.status === "failed" && item.source === "digital-human";
}

/** 取消：画布任务走 /runs/{id}/cancel（已提交给模型的会明确拒绝），数字人任务走 /jobs/{id}/cancel。 */
export async function cancelTask(item: StudioTaskHistoryItem): Promise<void> {
  if (item.source === "digital-human") { await (await jobApi()).cancel(item.id); return; }
  if (USE_MOCK) return mockDelay(undefined);
  await apiFetch(`/v1/ip-studio/runs/${encodeURIComponent(item.id)}/cancel`, { method: "POST" });
}

/** 数字人任务失败后重新排队（原任务、原参数）。 */
export async function retryTask(item: StudioTaskHistoryItem): Promise<void> {
  await (await jobApi()).retry(item.id);
}

export async function storageUsage(): Promise<StudioStorageUsage> {
  if (USE_MOCK) return mockDelay(MOCK_STORAGE);
  return apiFetch<StudioStorageUsage>("/v1/ip-studio/storage");
}

export async function trashedCanvases(): Promise<StudioTrashedCanvas[]> {
  if (USE_MOCK) return mockDelay([]);
  return apiFetch<StudioTrashedCanvas[]>("/v1/ip-studio/projects/trash");
}

export async function restoreCanvas(id: string): Promise<void> {
  if (USE_MOCK) return mockDelay(undefined);
  await apiFetch(`/v1/ip-studio/projects/${encodeURIComponent(id)}/restore`, { method: "POST" });
}

/** 从回收站彻底删除画布：只删画布本身，生成记录和文件保留在资产库。 */
export async function purgeCanvas(id: string): Promise<void> {
  if (USE_MOCK) return mockDelay(undefined);
  await apiFetch(`/v1/ip-studio/projects/${encodeURIComponent(id)}/purge`, { method: "DELETE" });
}

/** 从回收站彻底删除导演台作品：只删作品本身，生成记录和文件保留在资产库。 */
export async function purgeWork(id: string): Promise<void> {
  if (USE_MOCK) return mockDelay(undefined);
  await apiFetch(`/v1/ip-studio/director/works/${encodeURIComponent(id)}/purge`, { method: "DELETE" });
}

export interface TrashPolicy { retentionDays: number; storageEnforced: boolean }

/** 回收站自动清理天数（0 = 不自动清理）与是否按存储上限拦截上传。 */
export async function trashPolicy(): Promise<TrashPolicy> {
  if (USE_MOCK) return mockDelay({ retentionDays: 0, storageEnforced: false });
  return apiFetch<TrashPolicy>("/v1/ip-studio/trash/policy");
}

/** 本人的充值订单，只留 IP Studio 发起的（服务端返回所有产品的订单）。 */
export async function rechargeOrders(): Promise<RechargeOrder[]> {
  if (USE_MOCK) return mockDelay([]);
  const all = await apiFetch<RechargeOrder[]>("/me/wallet/recharge/orders");
  return all.filter(order => !order.sourceApp || order.sourceApp === "aiavatar");
}

/** 模型原文的一条记录（不含全文）。服务端：ModelResultsController。 */
export interface ModelResultSummary { id: string; model: string; purpose: string; createdAt: string }
export interface ModelResultDetail { id: string; content: string; finishReason: string }

/** 原文列表：带 taskId 只看这个任务的（按调用先后），不带是全部原文（新的在前），每页 20 条。 */
export async function modelResults(query: { taskId?: string; page: number }): Promise<ModelResultSummary[]> {
  if (USE_MOCK) return mockDelay(query.page === 0 ? MOCK_RESULTS : []);
  const qs = buildQuery({ taskId: query.taskId, page: query.page });
  return apiFetch<ModelResultSummary[]>(`/me/model-results${qs}`);
}

export async function modelResult(id: string): Promise<ModelResultDetail> {
  if (USE_MOCK) return mockDelay({ id, content: MOCK_RESULT_TEXT, finishReason: "stop" });
  return apiFetch<ModelResultDetail>(`/me/model-results/${encodeURIComponent(id)}`);
}

const MOCK_RESULTS: ModelResultSummary[] = [{ id: "aiu-demo-1", model: "Claude Sonnet 5.5", purpose: "DRAMA_SCRIPT_DRAFT", createdAt: "2026-11-08T14:18:40Z" }];
const MOCK_RESULT_TEXT = "第2集　菜市场的第一笔生意\n\n第1镜（0–3 秒）：\n摄影：俯拍菜市场入口，缓慢推近\n台词：林小满说：「让一让，新鲜番茄来了！」";

const MOCK_STORAGE: StudioStorageUsage = {
  usedMb: 2118, quotaMb: 5120, baseQuotaMb: 5120, grantedMb: 0,
  categories: [
    { key: "image", label: "生成的图片", mb: 768 },
    { key: "video", label: "生成的视频", mb: 614 },
    { key: "digital-human", label: "数字人资产", mb: 358 },
    { key: "upload", label: "上传的素材", mb: 186 },
    { key: "audio", label: "声音", mb: 128 },
    { key: "license", label: "真人授权素材", mb: 64 },
  ],
};

function mockHistory(query: TaskHistoryQuery): StudioTaskHistoryPage {
  const items: StudioTaskHistoryPage["items"] = [
    { id: "IPR-demo-1", source: "canvas", sourceId: "P-demo", sourceTitle: "秋季上新", type: "video", kind: "studio-video", title: "生成视频",
      status: "running", pct: 64, queuePosition: null, createdAt: "2026-11-09T02:12:40Z", finishedAt: null,
      credits: { spent: 0, scopedSpent: 0, pending: 480, released: 0 }, payer: { type: "personal", name: null }, errorCode: null, errorMessage: null, href: "/projects/P-demo", hasModelResult: false },
    { id: "IPR-demo-2", source: "canvas", sourceId: "P-demo", sourceTitle: "秋季上新", type: "image", kind: "studio-image", title: "生成图片",
      status: "done", pct: 100, queuePosition: null, createdAt: "2026-11-09T01:41:03Z", finishedAt: "2026-11-09T01:42:10Z",
      credits: { spent: 32, scopedSpent: 0, pending: 0, released: 0 }, payer: { type: "personal", name: null }, errorCode: null, errorMessage: null, href: "/projects/P-demo", hasModelResult: false },
    { id: "IPR-demo-3", source: "director", sourceId: "W-demo", sourceTitle: "重生之我在菜市场", type: "text", kind: "studio-storyboard", title: "导演台 · 写分镜脚本",
      status: "done", pct: 100, queuePosition: null, createdAt: "2026-11-08T14:17:56Z", finishedAt: "2026-11-08T14:18:40Z",
      credits: { spent: 11, scopedSpent: 0, pending: 0, released: 0 }, payer: { type: "enterprise", name: "星河传媒" }, errorCode: null, errorMessage: null, href: "/director/W-demo", hasModelResult: true },
    { id: "DJ-demo-4", source: "digital-human", sourceId: "DH-demo", sourceTitle: "林小满", type: "digital-human", kind: "video", title: "衍生视频",
      status: "failed", pct: 0, queuePosition: null, createdAt: "2026-11-08T10:21:44Z", finishedAt: "2026-11-08T10:23:01Z",
      credits: { spent: 0, scopedSpent: 0, pending: 0, released: 0 }, payer: { type: "personal", name: null }, errorCode: null,
      errorMessage: "参考图分辨率太低，请换一张 1024×1024 以上的图片。", href: "/studio#/avatar/DH-demo", hasModelResult: false },
  ];
  const filtered = items.filter(item => (!query.status || item.status === query.status) && (!query.type || item.type === query.type));
  return { items: query.page === 0 ? filtered : [], page: query.page, hasMore: false,
    summary: { spent: 43, scopedSpent: 0, released: 0, count: items.length, running: 1, partial: false } };
}
