// ─────────────────────────────────────────────────────────────────────────────
// api/render.ts — 短剧分镜渲染（v0.65）。
// 首帧（图像生成，同步）+ 直出/动态视频（异步 submit + 轮询）。
// 后端：/api/me/drama/render/{frame,clip}（DramaRenderController）；
// 视频任务轮询复用 /api/me/drama/episodes/jobs/{id}。
// USE_MOCK=1 时本地回放（占位帧 + 立即完成的任务），与真后端完全隔离。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import type { DramaEpisodeJob } from "./short-drama";

export interface RenderedFrame {
  url: string;
  cdnKey: string;
}

// v0.72：出图/出片提示词模板在 server 端（admin「短剧专区·提示词设置」可改）。
// 前端不再拼 prompt 字符串，只传 kind（选模板）+ vars（填充占位符）。
export interface RenderFrameInput {
  /** shot=工作台分镜（drama.frame_image）/ short=短视频分镜（drama.short_frame_image）。默认 shot。 */
  kind?: "shot" | "short";
  /** 填充 server 端 prompt 模板的占位符：visual/size/move/lineClause/castClause/styleSuffix/metaPrefix… */
  vars: Record<string, string>;
  ratio?: string;
  count?: number;
  refImages?: string[];
}

export interface RenderClipInput {
  kind?: "shot" | "short";
  vars: Record<string, string>;
  name?: string;
  durationSec?: number;
  ratio?: string;
  projectId?: string;
  /** 已锁首帧 URL — 动态渲染会严格基于它 */
  frameUrl?: string;
}

/** 灰紫渐变 SVG 占位帧（USE_MOCK 本地回放用，无网络）。 */
function mockFrameDataUri(seed: number): string {
  const hues = [[24, 340], [210, 260], [160, 200], [280, 320]];
  const [h1, h2] = hues[seed % hues.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="320"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1},70%,62%)"/><stop offset="1" stop-color="hsl(${h2},70%,48%)"/></linearGradient></defs><rect width="180" height="320" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export async function renderFrame(input: RenderFrameInput): Promise<RenderedFrame[]> {
  if (USE_MOCK) {
    const n = input.count ?? 1;
    return mockDelay(
      Array.from({ length: n }, (_, i) => ({
        url: mockFrameDataUri(Date.now() + i),
        cdnKey: `mock/frames/${Date.now()}_${i}.svg`,
      })),
      1200,
    );
  }
  const res = await apiFetch<{ frames: RenderedFrame[]; cost: number }>("/me/drama/render/frame", {
    method: "POST",
    body: {
      kind: input.kind ?? "shot",
      vars: input.vars,
      ratio: input.ratio,
      count: input.count,
      ref_images: input.refImages,
    },
  });
  return res.frames ?? [];
}

export async function renderClip(input: RenderClipInput): Promise<DramaEpisodeJob> {
  if (USE_MOCK) {
    return mockDelay(
      {
        id: `mvj_mock_${Date.now()}`,
        script_id: input.projectId ?? "mock",
        kind: "drama-shot",
        name: input.name ?? "短剧分镜",
        status: "ready",
        video_url: "/videos/showreel-01.mp4",
        progress_pct: 100,
        stage: "已完成",
        duration_sec: input.durationSec ?? 5,
        created_at: new Date().toISOString(),
      },
      1500,
    );
  }
  return apiFetch<DramaEpisodeJob>("/me/drama/render/clip", {
    method: "POST",
    body: {
      kind: input.kind ?? "shot",
      vars: input.vars,
      name: input.name,
      duration_sec: input.durationSec,
      ratio: input.ratio,
      project_id: input.projectId,
      frame_url: input.frameUrl,
    },
  });
}

/** 轮询视频任务直到终态或超时。onTick 可用于刷新进度。 */
export async function pollClipJob(
  jobId: string,
  opts?: { intervalMs?: number; timeoutMs?: number; onTick?: (job: DramaEpisodeJob) => void },
): Promise<DramaEpisodeJob> {
  if (USE_MOCK) {
    return mockDelay({
      id: jobId, script_id: "mock", kind: "drama-shot", name: "短剧分镜",
      status: "ready", video_url: "/videos/showreel-01.mp4", progress_pct: 100,
    });
  }
  const interval = opts?.intervalMs ?? 2500;
  const deadline = Date.now() + (opts?.timeoutMs ?? 300_000);
  for (;;) {
    const job = await apiFetch<DramaEpisodeJob>(`/me/drama/episodes/jobs/${encodeURIComponent(jobId)}`);
    opts?.onTick?.(job);
    if (job.status === "ready" || job.status === "failed") return job;
    if (Date.now() > deadline) return { ...job, status: "failed", error_message: "轮询超时，请稍后在任务列表查看" };
    await new Promise((r) => setTimeout(r, interval));
  }
}
