// ─────────────────────────────────────────────────────────────────────────────
// api/render.ts — 短剧分镜渲染（v0.65）。
// 首帧（图像生成，可后台任务）+ 直出/动态视频（异步 submit + 轮询）。
// 后端：/api/me/drama/render/{frame,clip}（DramaRenderController）；
// 视频任务轮询复用 /api/me/drama/episodes/jobs/{id}。
// USE_MOCK=1 时本地回放（占位帧 + 立即完成的任务），与真后端完全隔离。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import type { DramaEpisodeJob } from "./short-drama";

export type { DramaEpisodeJob } from "./short-drama";

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
  /** 当前项目 ID；短视频制作页传草稿 ID，用于刷新恢复。 */
  projectId?: string;
  sceneId?: string;
  shotId?: string;
  episodeNo?: number;
  name?: string;
}

export interface RenderClipInput {
  kind?: "shot" | "short";
  vars: Record<string, string>;
  name?: string;
  durationSec?: number;
  ratio?: string;
  projectId?: string;
  sceneId?: string;
  shotId?: string;
  episodeNo?: number;
  target?: string;
  /** 已锁首帧 URL — 动态渲染会严格基于它 */
  frameUrl?: string;
}

export type RenderTaskStatus = "queued" | "running" | "rendering" | "ready" | "failed" | string;

export interface DramaFrameJob {
  id: string;
  task_type: "frame";
  kind: "shot" | "short" | string;
  name: string;
  status: RenderTaskStatus;
  internal_status?: string;
  progress_pct?: number;
  stage?: string;
  project_id?: string;
  scene_id?: string;
  shot_id?: string;
  episode_no?: number;
  frames?: RenderedFrame[];
  result?: { frames?: RenderedFrame[]; cost?: number };
  cost?: number;
  error_message?: string | null;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
}

export interface DramaRenderTask {
  id: string;
  task_type: "frame" | "video";
  kind?: string;
  name: string;
  status: RenderTaskStatus;
  progress_pct?: number;
  stage?: string;
  project_id?: string;
  scene_id?: string;
  shot_id?: string;
  episode_no?: number;
  frames?: RenderedFrame[];
  result?: { frames?: RenderedFrame[]; cost?: number };
  video_url?: string | null;
  thumbnail_url?: string | null;
  duration_sec?: number;
  error_message?: string | null;
  created_at?: string;
  completed_at?: string;
}

export interface RenderLaneSummary {
  queued: number;
  running: number;
  limit: number;
  mine_queued?: number;
  mine_running?: number;
}

export interface RenderTaskSummary {
  frame: RenderLaneSummary;
  video: RenderLaneSummary;
  total: Pick<RenderLaneSummary, "queued" | "running" | "limit">;
}

export interface RenderTaskSnapshot {
  summary: RenderTaskSummary;
  tasks: DramaRenderTask[];
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

const mockFrameJobs = new Map<string, DramaFrameJob & { readyAt?: number }>();

function mockReadyFrameJob(job: DramaFrameJob & { readyAt?: number }): DramaFrameJob {
  if (job.status === "ready" || job.status === "failed") return job;
  if ((job.readyAt ?? 0) > Date.now()) {
    return { ...job, status: "running", progress_pct: 42, stage: "生成中" };
  }
  const count = job.result?.frames?.length || 1;
  const frames = Array.from({ length: count }, (_, i) => ({
    url: mockFrameDataUri(Date.now() + i),
    cdnKey: `mock/frames/${job.id}_${i}.svg`,
  }));
  const ready: DramaFrameJob = {
    ...job,
    status: "ready",
    progress_pct: 100,
    stage: "已完成",
    frames,
    result: { frames, cost: 2 },
    completed_at: new Date().toISOString(),
  };
  mockFrameJobs.set(job.id, ready);
  return ready;
}

export async function submitFrameJob(input: RenderFrameInput): Promise<DramaFrameJob> {
  if (USE_MOCK) {
    const id = `dfj_mock_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const job: DramaFrameJob & { readyAt?: number } = {
      id,
      task_type: "frame",
      kind: input.kind ?? "shot",
      name: input.name ?? "首帧渲染",
      status: "queued",
      progress_pct: 0,
      stage: "排队中",
      project_id: input.projectId,
      scene_id: input.sceneId,
      shot_id: input.shotId,
      episode_no: input.episodeNo,
      result: { frames: Array.from({ length: input.count ?? 1 }, () => ({ url: "", cdnKey: "" })) },
      created_at: new Date().toISOString(),
      readyAt: Date.now() + 1200,
    };
    mockFrameJobs.set(id, job);
    return mockDelay(job, 120);
  }
  return apiFetch<DramaFrameJob>("/me/drama/render/frame-jobs", {
    method: "POST",
    body: {
      kind: input.kind ?? "shot",
      vars: input.vars,
      ratio: input.ratio,
      count: input.count,
      ref_images: input.refImages,
      project_id: input.projectId,
      scene_id: input.sceneId,
      shot_id: input.shotId,
      episode_no: input.episodeNo,
      name: input.name,
    },
  });
}

export async function getFrameJob(id: string): Promise<DramaFrameJob> {
  if (USE_MOCK) {
    const job = mockFrameJobs.get(id);
    if (!job) throw new Error("首帧任务不存在");
    return mockDelay(mockReadyFrameJob(job));
  }
  return apiFetch<DramaFrameJob>(`/me/drama/render/frame-jobs/${encodeURIComponent(id)}`);
}

export async function listFrameJobs(projectId?: string): Promise<DramaFrameJob[]> {
  if (USE_MOCK) {
    const rows = Array.from(mockFrameJobs.values()).map(mockReadyFrameJob);
    return mockDelay(projectId ? rows.filter((j) => j.project_id === projectId) : rows);
  }
  return apiFetch<DramaFrameJob[]>("/me/drama/render/frame-jobs", {
    query: projectId ? { project_id: projectId } : undefined,
  });
}

export async function pollFrameJob(
  jobId: string,
  opts?: { intervalMs?: number; timeoutMs?: number; onTick?: (job: DramaFrameJob) => void },
): Promise<DramaFrameJob> {
  const interval = opts?.intervalMs ?? 2500;
  const deadline = Date.now() + (opts?.timeoutMs ?? 240_000);
  for (;;) {
    const job = await getFrameJob(jobId);
    opts?.onTick?.(job);
    if (job.status === "ready" || job.status === "failed") return job;
    if (Date.now() > deadline) return { ...job, status: "failed", error_message: "轮询超时，请稍后在后台任务查看" };
    await new Promise((r) => setTimeout(r, interval));
  }
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
      scene_id: input.sceneId,
      shot_id: input.shotId,
      episode_no: input.episodeNo,
      target: input.target,
      frame_url: input.frameUrl,
    },
  });
}

export async function listRenderTasks(projectId?: string): Promise<RenderTaskSnapshot> {
  if (USE_MOCK) {
    const frames = (await listFrameJobs(projectId)) as DramaRenderTask[];
    return mockDelay({
      summary: {
        frame: { queued: 0, running: frames.filter((t) => t.status === "queued" || t.status === "running").length, limit: 2 },
        video: { queued: 0, running: 0, limit: 3 },
        total: { queued: 0, running: frames.filter((t) => t.status === "queued" || t.status === "running").length, limit: 5 },
      },
      tasks: frames,
    });
  }
  return apiFetch<RenderTaskSnapshot>("/me/drama/render/tasks", {
    query: projectId ? { project_id: projectId } : undefined,
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
