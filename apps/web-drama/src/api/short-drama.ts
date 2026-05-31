// ─────────────────────────────────────────────────────────────────────────────
// api/short-drama.ts — 短剧生成（v0.43 → v0.45 完整创作工作流）。
// 多阶段：题材灵感 → AI 多稿起草 → 分场景编辑（增删改/调序/逐镜重写/景别·运镜·配音）→
// 角色与演员绑定 → 剧集(多集) → 风格与变体生成 → 生成视频 → 视频库 → 归入项目 / 分发。
// 后端复用 celebrity 视频任务管线（异步 submit + 轮询）。
// ─────────────────────────────────────────────────────────────────────────────

import type { Drama } from "@ai-star-eco/types/film";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";

/** 景别。 */
export type ShotType = "wide" | "medium" | "close" | "extreme_close";
/** 运镜。 */
export type CameraMove = "static" | "push" | "pull" | "pan" | "handheld";

/** 一个场景（分镜）。shot=画面/分镜（怎么拍），dialogue=台词/旁白（念什么）。 */
export interface DramaScene {
  heading: string;
  summary: string;
  shot: string;
  dialogue: string;
  duration_sec: number;
  /** v0.45：景别 */
  shot_type?: ShotType;
  /** v0.45：运镜 */
  camera_move?: CameraMove;
  /** v0.45：本镜风格覆盖（可选） */
  style?: string;
  /** v0.45：是否为该镜台词配音（false = 仅作字幕，不配音） */
  gen_voice?: boolean;
  /** v0.45：本镜出场角色 id 列表 */
  character_ids?: string[];
}

/** 角色（可绑定虚拟演员 /cast）。 */
export interface DramaCharacter {
  id: string;
  name: string;
  /** 如 male_lead / female_lead / supporting */
  role?: string;
  /** 形象描述；绑定演员后可由演员形象自动带入 */
  appearance?: string;
  /** 绑定的虚拟演员（digital-ip）id */
  cast_id?: string;
  cast_name?: string;
  cast_avatar?: string;
}

/** 脚本级整体风格。 */
export interface DramaStyle {
  visual?: string;
  palette?: string;
  pace?: string;
}

/** 变体配置：一次生成多条不同风格的视频。 */
export interface DramaVariant {
  id: string;
  label: string;
  overrides?: {
    tone?: string;
    style?: DramaStyle;
  };
}

export interface DramaScript {
  id: string;
  title: string;
  logline?: string;
  genre: string;
  theme?: string;
  duration_sec: number;
  aspect_ratio?: string;
  status: string; // draft | ready
  scenes: DramaScene[];
  /** v0.45 */
  characters?: DramaCharacter[];
  style?: DramaStyle;
  variants?: DramaVariant[];
  series_id?: string | null;
  episode_no?: number;
  drama_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** 短剧视频任务（沿用后端 MaterialVideo 形状）。 */
export interface DramaEpisodeJob {
  id: string;
  script_id: string;
  kind: string;
  name: string;
  status: string; // ready | rendering | failed
  video_url?: string | null;
  thumbnail_url?: string | null;
  progress_pct?: number;
  stage?: string;
  error_message?: string | null;
  duration_sec?: number;
  created_at?: string;
}

export interface AiDraftParams {
  theme: string;
  genre?: string;
  durationSec?: number;
  count?: number;
}

export interface GenerateEpisodesParams {
  scriptId: string;
  count?: number;
  name?: string;
  /** v0.45：变体生成（提供时按变体逐条生成，count 失效）。 */
  variants?: DramaVariant[];
}

export interface RewriteSceneParams {
  scriptId: string;
  sceneIndex: number;
  prompt?: string;
}

// ── mock 样本（USE_MOCK=1 时本地回放，无需 server） ───────────────────────────
const MOCK_SCRIPT: DramaScript = {
  id: "ds_mock_demo",
  title: "误会重逢",
  logline: "失忆的总裁在咖啡馆偶遇前妻，一杯拿铁勾起被尘封的回忆。",
  genre: "都市情感",
  theme: "失忆总裁咖啡馆偶遇前妻",
  duration_sec: 60,
  aspect_ratio: "9:16",
  status: "draft",
  characters: [
    { id: "ch_male", name: "陆烬", role: "male_lead", appearance: "三十岁出头，精英气质，深色西装" },
    { id: "ch_female", name: "苏念", role: "female_lead", appearance: "二十多岁，温柔知性，米色风衣" },
  ],
  style: { visual: "电影感", palette: "暖色", pace: "快节奏" },
  scenes: [
    { heading: "日 · 咖啡馆 · 内", summary: "总裁排队点单，与前妻擦肩。", shot: "中近景，手持轻微晃动，暖色调", dialogue: "（旁白）有些人一转身，就是一辈子。", duration_sec: 12, shot_type: "medium", camera_move: "handheld", gen_voice: true, character_ids: ["ch_male", "ch_female"] },
    { heading: "日 · 咖啡馆 · 卡座", summary: "前妻认出他，欲言又止。", shot: "正反打特写，浅景深", dialogue: "苏念：你……还喝三分糖吗？", duration_sec: 16, shot_type: "close", camera_move: "static", gen_voice: true, character_ids: ["ch_female"] },
    { heading: "日 · 咖啡馆 · 窗边", summary: "总裁记忆闪回，握紧杯子。", shot: "面部特写 + 回忆叠化", dialogue: "陆烬：（低声）我好像在哪见过你。", duration_sec: 16, shot_type: "extreme_close", camera_move: "push", gen_voice: true, character_ids: ["ch_male"] },
    { heading: "日 · 咖啡馆 · 门口", summary: "两人并肩走出，留下悬念。", shot: "背影中景，逆光缓推", dialogue: "（旁白）这一次，他不想再转身。", duration_sec: 16, shot_type: "wide", camera_move: "pull", gen_voice: true, character_ids: ["ch_male", "ch_female"] },
  ],
};

export async function listScripts(): Promise<DramaScript[]> {
  if (USE_MOCK) return mockDelay([]);
  return apiFetch<DramaScript[]>("/me/drama/scripts");
}

export async function getScript(id: string): Promise<DramaScript> {
  if (USE_MOCK) return mockDelay({ ...MOCK_SCRIPT, id });
  return apiFetch<DramaScript>(`/me/drama/scripts/${id}`);
}

export async function saveScript(script: DramaScript): Promise<DramaScript> {
  if (USE_MOCK) return mockDelay({ ...script, status: "ready" });
  return apiFetch<DramaScript>("/me/drama/scripts", { method: "POST", body: script });
}

export async function deleteScript(id: string): Promise<void> {
  if (USE_MOCK) return mockDelay(undefined);
  await apiFetch<void>(`/me/drama/scripts/${id}`, { method: "DELETE" });
}

export async function aiDraftScripts(params: AiDraftParams): Promise<DramaScript[]> {
  if (USE_MOCK) {
    const n = params.count ?? 1;
    return mockDelay(
      Array.from({ length: n }, (_, i) => ({
        ...MOCK_SCRIPT,
        id: `ds_mock_${Date.now()}_${i}`,
        title: (params.theme.slice(0, 6) || MOCK_SCRIPT.title) + (n > 1 ? ` ${i + 1}` : ""),
        theme: params.theme,
        genre: params.genre ?? MOCK_SCRIPT.genre,
        duration_sec: params.durationSec ?? MOCK_SCRIPT.duration_sec,
      })),
      900,
    );
  }
  return apiFetch<DramaScript[]>("/me/drama/scripts/ai-draft", {
    method: "POST",
    body: { theme: params.theme, genre: params.genre, duration_sec: params.durationSec, count: params.count },
  });
}

/** 单镜 AI 改写 → 返回改写后的 scene（未落库，前端合并）。 */
export async function rewriteScene(params: RewriteSceneParams): Promise<DramaScene> {
  if (USE_MOCK) {
    return mockDelay(
      { ...MOCK_SCRIPT.scenes[Math.min(params.sceneIndex, MOCK_SCRIPT.scenes.length - 1)], summary: "（已按要求改写）" + (params.prompt ?? "") },
      700,
    );
  }
  return apiFetch<DramaScene>("/me/drama/scenes/rewrite", {
    method: "POST",
    body: { script_id: params.scriptId, scene_index: params.sceneIndex, prompt: params.prompt },
  });
}

export async function generateEpisodes(params: GenerateEpisodesParams): Promise<DramaEpisodeJob[]> {
  if (USE_MOCK) {
    const items = params.variants && params.variants.length > 0
      ? params.variants.map((v) => v.label)
      : Array.from({ length: params.count ?? 1 }, (_, i) => (params.count && params.count > 1 ? `第 ${i + 1} 版` : ""));
    return mockDelay(
      items.map((label, i) => ({
        id: `mvj_mock_${Date.now()}_${i}`,
        script_id: params.scriptId,
        kind: "drama-episode",
        name: `${params.name ?? "短剧片段"}${label ? ` · ${label}` : ""}`,
        status: "ready",
        video_url: "/videos/showreel-01.mp4",
        progress_pct: 100,
        stage: "已完成",
        duration_sec: 60,
        created_at: new Date().toISOString(),
      })),
    );
  }
  return apiFetch<DramaEpisodeJob[]>("/me/drama/episodes/generate", {
    method: "POST",
    body: { script_id: params.scriptId, count: params.count, name: params.name, variants: params.variants },
  });
}

export async function listEpisodeJobs(scriptId?: string): Promise<DramaEpisodeJob[]> {
  if (USE_MOCK) return mockDelay([]);
  return apiFetch<DramaEpisodeJob[]>("/me/drama/episodes/jobs", {
    query: scriptId ? { script_id: scriptId } : undefined,
  });
}

export async function getEpisodeJob(id: string): Promise<DramaEpisodeJob> {
  if (USE_MOCK) return mockDelay({ id, script_id: "ds_mock", kind: "drama-episode", name: "短剧片段", status: "ready", video_url: "/videos/showreel-01.mp4", progress_pct: 100 });
  return apiFetch<DramaEpisodeJob>(`/me/drama/episodes/jobs/${id}`);
}

/** 一部多集短剧的所有集（按集号升序）。 */
export async function listSeriesEpisodes(seriesId: string): Promise<DramaScript[]> {
  if (USE_MOCK) return mockDelay([]);
  return apiFetch<DramaScript[]>(`/me/drama/series/${encodeURIComponent(seriesId)}/episodes`);
}

/** 成片归入项目流水线 → 返回创建/复用的 Drama 项目。 */
export async function publishToProject(scriptId: string): Promise<Drama> {
  if (USE_MOCK) {
    return mockDelay({
      id: `d-mock-${Date.now()}`, title: "短剧项目", genre: "都市", episodes: 1,
      role: "苏念", status: "post-production", views: 0, revenue: 0, rating: 0,
    } as Drama);
  }
  return apiFetch<Drama>(`/me/drama/scripts/${encodeURIComponent(scriptId)}/publish-to-project`, { method: "POST" });
}
