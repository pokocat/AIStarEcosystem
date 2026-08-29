// ─────────────────────────────────────────────────────────────────────────────
// api/music-gen.ts — 真实音乐生成（v0.138）。
//
// 与旧的 api/generation.ts 不同：这里没有 mock 分支。音乐生成要真实调模型、真实扣费，
// 假装成功没有意义 —— 未配置模型时服务端返回 503 MUSIC_NOT_CONFIGURED，前端如实提示。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  MusicGenJob,
  CreateMusicGenRequest,
  MusicGenModelOption,
} from "@ai-star-eco/types/music";
import { apiFetch } from "./_client";

/** 下单生成。返回 queued 态任务，需轮询到终态。 */
export async function createJob(req: CreateMusicGenRequest): Promise<MusicGenJob> {
  return apiFetch<MusicGenJob>("/me/music/generate", { method: "POST", body: req });
}

export async function getJob(id: string): Promise<MusicGenJob> {
  return apiFetch<MusicGenJob>(`/me/music/jobs/${encodeURIComponent(id)}`);
}

export async function listJobs(): Promise<MusicGenJob[]> {
  return apiFetch<MusicGenJob[]>("/me/music/jobs");
}

/** 可选出曲模型。空数组 = 运营尚未配置，前端据此提示而不是显示假选项。 */
export async function listModels(): Promise<MusicGenModelOption[]> {
  return apiFetch<MusicGenModelOption[]>("/me/music/models");
}

const TERMINAL: MusicGenJob["status"][] = ["succeeded", "failed"];

export function isTerminal(job: MusicGenJob): boolean {
  return TERMINAL.includes(job.status);
}

/**
 * 轮询到终态。
 *
 * @param onTick 每次拿到新状态时回调，用于驱动进度条
 * @param signal 允许调用方取消轮询（组件卸载 / 用户离开）
 */
export async function pollUntilDone(
  id: string,
  onTick?: (job: MusicGenJob) => void,
  signal?: AbortSignal,
  intervalMs = 3000,
): Promise<MusicGenJob> {
  // 生成通常 30s–数分钟；上限对齐服务端 maxWaitSeconds(600s) 再留一点余量。
  const deadline = Date.now() + 11 * 60 * 1000;
  for (;;) {
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    const job = await getJob(id);
    onTick?.(job);
    if (isTerminal(job)) return job;
    if (Date.now() > deadline) return job;
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, intervalMs);
      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(t);
          reject(new DOMException("aborted", "AbortError"));
        },
        { once: true },
      );
    });
  }
}
