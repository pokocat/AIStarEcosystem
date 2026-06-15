// ─────────────────────────────────────────────────────────────────────────────
// api/interactive-drama.ts — 互动短剧（剧情互动 / 互动剧，P1）。
//
// 业务：把「一部剧 = 线性 1→2→3 集」升级成「一部剧 = 剧集有向图」——某些集播完
// 插入「互动」（一个问题 + 几个选项），观众的选择决定下一集播哪条分支。
//
// 我们只做创作端：配置这张剧集图 + 生成每集视频 + 导出「互动配置 manifest」。
// 播放 / 渲染 / 分发由社媒平台（抖音 / TikTok）承接 —— manifest 是交给它们的规范产物。
//
// 数据模型（已确认）：整部剧集图内嵌在一个 DramaScript 行的 payloadJson 里，
// 判别位 mode="interactive_series"。P1 为 mock-first（USE_MOCK=1 本地内存回放，无 server）。
// live 路径（USE_MOCK=0）是 P2 规划契约，后端按这些路径 mirror。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK, mockDelay, clientError } from "./_client";
import type { DramaScene, DramaEpisodeJob } from "./short-drama";
import * as ProjectsApi from "./projects";
import * as store from "@/mocks/interactive-drama";
import { blankEpisode, buildSkeleton, draftSeriesFromTheme, genId, summarize, deriveStatus } from "@/lib/interactive-graph";

export type EpisodeGenStatus = "idle" | "generating" | "ready" | "failed";

/** 一个互动选项 → 指向下一集。 */
export interface EpisodeChoice {
  id: string;
  label: string; // "原谅他"
  next_episode_id: string; // → 跳到哪一集
}

/** 看完某集之后弹出的互动（剧集之间，不在单集内）。 */
export interface EpisodeInteraction {
  prompt: string; // "她该原谅他吗？"
  choices: EpisodeChoice[]; // 2-4 个
  countdown_sec?: number | null; // 可选限时（交给平台播放时用）
  default_choice_id?: string | null; // 超时默认选项
}

/** 一集 = 剧集图的一个节点（整集成片）。 */
export interface EpisodeNode {
  id: string;
  title: string; // "第10集 · 真相浮现"
  branch_label?: string; // 分支线标签："拆穿线" / "隐忍线"
  synopsis?: string; // 一句话本集剧情
  scenes?: DramaScene[]; // 可选：本集分镜（→ 生成提示词；缺省由 synopsis 合成）
  duration_sec?: number;

  // 生成态
  gen_status?: EpisodeGenStatus;
  video_job_id?: string | null;
  video_url?: string | null;

  // 流转（三选一语义）
  interaction?: EpisodeInteraction | null; // 有互动 → 看完弹选项决定下一集
  next_episode_id?: string | null; // 无互动的线性下一集
  is_ending?: boolean; // 结局集
  ending_label?: string; // "HE · 重圆" / "BE · 错过"
}

/** 一部互动剧 = 剧集图。 */
export interface InteractiveSeries {
  id: string;
  title: string;
  genre: string;
  logline?: string;
  status: string; // draft | ready
  start_episode_id: string;
  episodes: EpisodeNode[];
  created_at?: string;
  updated_at?: string;
}

/** 列表摘要（派生值，不落库）。 */
export interface InteractiveSeriesSummary {
  id: string;
  title: string;
  genre: string;
  status: string;
  episode_count: number;
  branch_count: number; // 互动决策点数
  ending_count: number;
  ready_count: number; // 已生成集数
  updated_at?: string;
}

export interface CreateSeriesInput {
  title: string;
  genre: string;
  logline?: string;
  skeleton?: "single" | "branch"; // 起始结构
}

/** 单集生成结果（mock / live 共用形状）。 */
export interface EpisodeGenResult {
  episode_id: string;
  gen_status: EpisodeGenStatus;
  video_job_id?: string | null;
  video_url?: string | null;
  duration_sec?: number;
}

// ── 导出 manifest（交给抖音 / TikTok 的规范格式 v1） ──────────────────────────

export interface ManifestChoice {
  label: string;
  next_episode: string;
}
export interface ManifestInteraction {
  prompt: string;
  choices: ManifestChoice[];
  countdown_sec?: number | null;
}
export interface ManifestEpisode {
  id: string;
  title: string;
  video_url?: string | null;
  duration_sec?: number;
  interaction?: ManifestInteraction | null;
  next_episode?: string | null;
  is_ending?: boolean;
  ending_label?: string;
}
export interface InteractiveManifest {
  schema: string;
  series_id: string;
  title: string;
  genre: string;
  start_episode: string;
  episodes: ManifestEpisode[];
  generated_at: string;
}

// ── API（USE_MOCK=1 走内存 store；=0 走后端，路径为 P2 规划契约） ─────────────

export async function listSeries(): Promise<InteractiveSeriesSummary[]> {
  if (USE_MOCK) return mockDelay(store.allSeries().map(summarize));
  return apiFetch<InteractiveSeriesSummary[]>("/me/drama/interactive/series");
}

export async function getSeries(id: string): Promise<InteractiveSeries> {
  if (USE_MOCK) {
    const s = store.getSeriesById(id);
    if (!s) throw clientError("互动剧不存在", 404, "interactive.not_found");
    return mockDelay(s);
  }
  return apiFetch<InteractiveSeries>(`/me/drama/interactive/series/${id}`);
}

export async function createSeries(input: CreateSeriesInput): Promise<InteractiveSeries> {
  if (USE_MOCK) return mockDelay(store.putSeries(buildSkeleton(input)), 500);
  return apiFetch<InteractiveSeries>("/me/drama/interactive/series", { method: "POST", body: input });
}

export interface AiDraftSeriesParams {
  theme: string;
  genre?: string;
  branch_points?: number; // 期望互动点数 1-2
  endings?: number; // 期望结局数 2-4
}

/** AI 起草一整部互动剧（剧集分支图）。mock 走本地生成器；live 走后端 LLM。 */
export async function aiDraftSeries(params: AiDraftSeriesParams): Promise<InteractiveSeries> {
  const theme = (params.theme || "").trim();
  if (!theme) throw clientError("请先填写故事主题 / 一句话灵感", 400, "interactive.theme_required");
  if (USE_MOCK) {
    const s = draftSeriesFromTheme({
      theme,
      genre: params.genre,
      branchPoints: params.branch_points,
      endings: params.endings,
    });
    return mockDelay(store.putSeries(s), 1300);
  }
  return apiFetch<InteractiveSeries>("/me/drama/interactive/ai-draft", { method: "POST", body: { ...params, theme } });
}

export async function saveSeries(series: InteractiveSeries): Promise<InteractiveSeries> {
  const next: InteractiveSeries = {
    ...series,
    status: deriveStatus(series),
    updated_at: new Date().toISOString(),
  };
  if (USE_MOCK) return mockDelay(store.putSeries(next), 300);
  return apiFetch<InteractiveSeries>("/me/drama/interactive/series", { method: "POST", body: next });
}

export async function deleteSeries(id: string): Promise<void> {
  if (USE_MOCK) {
    store.removeSeries(id);
    return mockDelay(undefined);
  }
  await apiFetch<void>(`/me/drama/interactive/series/${id}`, { method: "DELETE" });
}

/**
 * 把一个普通短剧项目（DramaProject 六阶段）转换成互动剧：按分集大纲铺成一条线性链，
 * 末集设为结局；之后在互动剧编辑器（流程引擎 / 分支画布）里接分支。客户端组合
 * （getProject → 建图 → saveSeries），mock 与 live 都通；后端无需新端点。
 */
export async function convertProjectToInteractive(projectId: string): Promise<InteractiveSeries> {
  const detail = await ProjectsApi.getProject(projectId);
  const info = detail.data.projectInfo;
  const outline = detail.data.episodes ?? [];
  const now = new Date().toISOString();
  const nodes: EpisodeNode[] = outline.length
    ? outline.map((o) => blankEpisode(`第 ${o.no} 集`, o.synopsis || o.beat || o.hook || ""))
    : [blankEpisode("第 1 集", info.logline || info.mainline || "故事开场。")];
  for (let i = 0; i < nodes.length; i++) {
    if (i < nodes.length - 1) {
      nodes[i].next_episode_id = nodes[i + 1].id;
    } else {
      nodes[i].is_ending = true;
      nodes[i].ending_label = "结局";
    }
  }
  const series: InteractiveSeries = {
    id: genId("dis"),
    title: `${info.title || detail.meta.title} · 互动版`,
    genre: info.type || detail.meta.type || "都市",
    logline: info.logline || info.mainline || "",
    status: "draft",
    start_episode_id: nodes[0].id,
    episodes: nodes,
    created_at: now,
    updated_at: now,
  };
  return saveSeries(series);
}

/**
 * 生成单集视频。mock 直接回放 showreel 占位；live 按 node 走视频任务管线
 * （后端复用 MaterialVideoJobService，kind="drama-episode"，回写 node.video_job_id）。
 */
export async function generateEpisode(seriesId: string, episodeId: string): Promise<EpisodeGenResult> {
  if (USE_MOCK) {
    return mockDelay(
      {
        episode_id: episodeId,
        gen_status: "ready",
        video_job_id: "mvj_" + Math.random().toString(36).slice(2, 10),
        video_url: store.pickShowreel(),
        duration_sec: 60,
      },
      700,
    );
  }
  // live：提交一条视频任务（后端复用 MaterialVideoJobService，kind="drama-interactive-node"，
  // 回写 node.video_job_id），然后轮询既有 /episodes/jobs/{id} 到终态，把异步封装在 api 层 ——
  // 调用方（编辑器生成循环）无需感知 mock / live 的差异。
  const submitted = await apiFetch<DramaEpisodeJob>(
    `/me/drama/interactive/series/${seriesId}/episodes/${episodeId}/generate`,
    { method: "POST" },
  );
  const jobId = submitted.id;
  let job = submitted;
  for (let i = 0; i < 120 && job.status === "rendering"; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    job = await apiFetch<DramaEpisodeJob>(`/me/drama/episodes/jobs/${jobId}`);
  }
  return {
    episode_id: episodeId,
    gen_status: job.status === "ready" ? "ready" : job.status === "failed" ? "failed" : "generating",
    video_job_id: jobId,
    video_url: job.video_url ?? null,
    duration_sec: job.duration_sec,
  };
}
