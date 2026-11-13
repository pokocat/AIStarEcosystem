// AI 视频页的长视频（docs/studio-segmented-video.md）：价格、提交，以及把一次执行整理成界面上的几个阶段。
// 段数和价格只由服务端算（SegmentedPlan / SegmentedVideoService），这里不另写一遍。
import type { StudioPlanExecution, StudioPlanExecutionStep, StudioSegmentedVideoPrice, StudioSegmentedVideoRequest } from "@ai-star-eco/types/ip-studio-workflow";
import { USE_MOCK, apiFetch } from "@/ip/api/_client";
import { mockSegmentedPrice, mockSegmentedStart } from "@/ip/mocks/studio-dialogue";
import { withStudioBilling } from "./studio-billing";
import type { IpProject } from "@ai-star-eco/types";
import type { StudioSceneSegmentedRecord } from "@ai-star-eco/types/ip-studio-workflow";

/** 恢复出的记录只负责读原任务，不能拿缺失的原始请求重新提交。 */
export type SegmentedRecord = Omit<StudioSceneSegmentedRecord, "request"> & { request?: StudioSegmentedVideoRequest; ratio?: string };

/**
 * 旧版画布保存会漏掉 sceneSegmented。已受理的脚本任务仍携带 executionId 和 segmented，
 * 用这份服务端记录找回入口；不猜请求、不发起生成，也不修改原来的任务或费用。
 */
export function segmentedRecords(project?: Pick<IpProject, "name" | "doc" | "runs" | "runsById">): SegmentedRecord[] {
  if (!project) return [];
  const records: SegmentedRecord[] = [...project.doc.sceneSegmented ?? []];
  const known = new Set(records.flatMap(record => record.executionId ? [record.executionId] : []));
  for (const run of Object.values({ ...project.runs, ...project.runsById })) {
    const inputs = run.inputs as { executionId?: unknown; segmented?: { kind?: unknown; scene?: { duration?: unknown; ratio?: unknown } } };
    const id = inputs?.executionId, info = inputs?.segmented;
    if (typeof id !== "string" || !/^PEX-[A-Za-z0-9_-]+$/.test(id) || info?.kind !== "script" || known.has(id)) continue;
    known.add(id);
    const duration = info.scene?.duration;
    records.push({ executionId: id, clientRequestId: id, at: run.createdAt,
      title: `${project.name || "视频制作"}${typeof duration === "number" ? ` · ${duration} 秒` : ""}`,
      ...(typeof info.scene?.ratio === "string" ? { ratio: info.scene.ratio } : {}) });
  }
  return records.sort((a, b) => b.at.localeCompare(a.at));
}

export type SegmentedPriceQuery = { model?: string; tier?: string; duration: number; ratio: string; images: number; character: boolean; voice: boolean; optimize: boolean; payer?: "personal" | "enterprise"; enterpriseId?: string };

export async function segmentedVideoPrice(query: SegmentedPriceQuery, signal?: AbortSignal): Promise<StudioSegmentedVideoPrice> {
  if (USE_MOCK) return mockSegmentedPrice(query);
  return apiFetch<StudioSegmentedVideoPrice>("/v1/ip-studio/studio/segmented-video-price", { query, signal });
}

/** 服务端逐段报价后的折扣展示；分镜图仍按标准价预估，赠款在实际执行时抵扣。 */
export function describeSegmentedPrice(personal: StudioSegmentedVideoPrice, enterprise?: StudioSegmentedVideoPrice) {
  const payable = (p: StudioSegmentedVideoPrice) => p.discountedVideoCost ?? p.videoCost;
  const video = Math.min(payable(personal), enterprise ? payable(enterprise) : Infinity);
  const from = !!enterprise && payable(personal) !== payable(enterprise);
  const saving = personal.videoCost - video;
  const n = (v: number) => v.toLocaleString("zh-CN");
  const discount = saving > 0 ? `${personal.videoDiscountName || enterprise?.videoDiscountName || "视频优惠"}，视频费省 ${n(saving)} 积分` : undefined;
  /** 个人和企业账户价不同时（按钮上写「起」），两种各多少，放悬停提示。 */
  const accounts = from ? `个人账户视频费 ${n(payable(personal))} 积分，企业账户视频费 ${n(payable(enterprise!))} 积分` : undefined;
  return { standard: personal.videoCost + personal.boardCost, shown: video + personal.boardCost, video, from, discount, accounts };
}

export async function startSegmentedVideo(projectId: string, request: StudioSegmentedVideoRequest, estimate?: number): Promise<StudioPlanExecution> {
  if (USE_MOCK) return mockSegmentedStart(projectId, request);
  const body = request.billing ? request : await withStudioBilling(projectId, request, { expectedCost: estimate, costCap: request.budgetCap, checkBalancePerStep: true });
  return apiFetch<StudioPlanExecution>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/segmented-videos`, { method: "POST", body });
}

export type SegmentedPhase = { key: "script" | "review" | "boards" | "videos" | "film"; label: string; done: number; total: number; state: "waiting" | "running" | "done" | "failed" };

const PHASES: { key: SegmentedPhase["key"]; label: string; match: (id: string) => boolean }[] = [
  { key: "script", label: "写分镜脚本", match: id => id === "script" },
  { key: "review", label: "审核脚本", match: id => id === "review" },
  // 分镜图和它的检查算一个阶段：对用户来说就是「分镜图好了没」。
  { key: "boards", label: "分镜图", match: id => /^[bc]\d+x?$/.test(id) },
  { key: "videos", label: "各段视频", match: id => /^v\d+$/.test(id) },
  { key: "film", label: "导出成片", match: id => id === "film" },
];

/** 一次执行整理成几个阶段。不显示百分比和预计时间（没有依据，AGENTS.md v0.221）。用不上而跳过的步骤不算进总数。 */
export function segmentedPhases(execution: StudioPlanExecution): SegmentedPhase[] {
  // 跳过有两种：流程判断用不上（带原因，比如这段一张分镜图放得下），和用户停止后没做的。后者不能显示成做完了。
  const notNeeded = (s: StudioPlanExecutionStep) => s.status === "skipped" && !!s.reason && execution.status !== "canceled";
  const out: SegmentedPhase[] = [];
  for (const phase of PHASES) {
    const all = execution.steps.filter(s => phase.match(s.id));
    if (!all.length) continue;
    const counted = phase.key === "boards" ? all.filter(s => s.operation === "image") : all;
    const live = counted.filter(s => !notNeeded(s));
    const done = live.filter(s => s.status === "done").length;
    const failed = all.some(s => s.status === "failed" || s.status === "needs_user");
    const running = all.some(s => s.status === "running" || s.status === "submitted");
    // 审不成跳过了：这一阶段算过去了，不显示成失败。
    const finished = all.every(s => s.status === "done" || notNeeded(s));
    out.push({ key: phase.key, label: phase.label, done, total: live.length || counted.length, state: finished ? "done" : failed ? "failed" : running ? "running" : "waiting" });
  }
  return out;
}

/** 这次执行最后出来的那一步：合成，没有合成的就是唯一那段视频。 */
export const segmentedResultStep = (execution: StudioPlanExecution) =>
  execution.steps.find(s => s.id === "film") ?? execution.steps.find(s => s.operation === "video");

export const segmentedActive = (execution?: StudioPlanExecution) =>
  !!execution && (execution.status === "running" || execution.status === "paused" || execution.status === "needs_user");
