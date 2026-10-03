// ─────────────────────────────────────────────────────────────────────────────
// shorts/make/job-peek.ts — 按任务号查一次后台任务（首帧 / 视频），给对账和「查看进度」用。
//
// 判定「这条任务没了」只认服务端的真实回法（§8.0.1 ⑦：照服务端写，不照前端以为的写）：
//   · 不存在 / 不属于你的任务，服务端回 `ApiResponse.of(null)`，而 application.yml 配了
//     `default-property-inclusion: non_null` —— 响应体是 `{"success":true}`，**没有 data 字段**，
//     apiFetch 解出来的是 `undefined`，不是 `null`。此前只认 `null`，真实环境下永远判成「查不准」，
//     pendingJob 永远留着，这一镜再也不给生成按钮（只能删镜）。
//   · 服务端从不对缺失任务回 404。404 只可能来自网关 / 路由没配上，那时不知道任务在不在，
//     按「查不准」处理、保留任务号 —— 当成「没了」放开重新生成，就是第二笔扣费。
// ─────────────────────────────────────────────────────────────────────────────
import {
  getClipJob,
  getFrameJob,
  POLL_TIMEOUT_MESSAGE,
  type DramaEpisodeJob,
  type DramaFrameJob,
} from "@/api/render";
import { USE_MOCK } from "@/api/_client";
import type { PendingJob } from "./shot-run";

/**
 * 轮询是否因超时返回（任务其实仍在后台跑，不能当失败丢弃）。
 * 与 POLL_TIMEOUT_MESSAGE 做**全等**比较 —— 上游真实失败文案里恰好含「超时」时不会被误判为超时。
 */
export function isPollTimeout(job: { status?: string; error_message?: string | null }): boolean {
  return job.status === "failed" && job.error_message === POLL_TIMEOUT_MESSAGE;
}

export type PeekResult =
  | { state: "terminal"; job: DramaFrameJob | DramaEpisodeJob }
  | { state: "running" }
  | { state: "missing" }
  | { state: "unknown" };

/** 查一次用的两个取数函数（默认就是 api/render 的；单测可以换）。 */
export interface PeekDeps {
  getFrame: (id: string) => Promise<DramaFrameJob | null | undefined>;
  getClip: (id: string) => Promise<DramaEpisodeJob | null | undefined>;
  mock: boolean;
}

const DEFAULT_DEPS: PeekDeps = { getFrame: getFrameJob, getClip: getClipJob, mock: USE_MOCK };

/**
 * 按任务号直接查一次（不等）：任务快照只含最近几十条，不在快照里不等于任务没了。
 * 只有服务端明确说「没有这条任务」（成功响应、没有 data）才算 missing —— 这时清掉 pendingJob、允许重新生成；
 * 网络或服务端出错算 unknown，pendingJob 原样保留：宁可让用户多等一会儿，也不能重复提交、重复扣费。
 */
export async function peekJob(pj: PendingJob, deps: PeekDeps = DEFAULT_DEPS): Promise<PeekResult> {
  let job: DramaFrameJob | DramaEpisodeJob | null | undefined;
  try {
    job = pj.kind === "frame" ? await deps.getFrame(pj.jobId) : await deps.getClip(pj.jobId);
  } catch {
    // mock 的任务只活在内存里：刷新后查不到（getFrameJob 抛「找不到」）就是没了。
    return deps.mock ? { state: "missing" } : { state: "unknown" };
  }
  // null（显式）和 undefined（non_null 序列化省掉 data）都是「服务端说没有」。
  if (job == null) return { state: "missing" };
  if (job.status === "ready" || job.status === "failed") return { state: "terminal", job };
  return { state: "running" };
}
