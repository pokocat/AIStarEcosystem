// ─────────────────────────────────────────────────────────────────────────────
// api/short-drama.ts — 短剧生成（v0.43+）。脚本化表达：AI 起草分场景脚本 → 保存 →
// 生成短剧视频（异步 submit + 轮询）。后端复用 celebrity 视频任务管线。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK, mockDelay } from "./_client";

/** 一个场景（分镜）。shot=画面/分镜（怎么拍），dialogue=台词/旁白（念什么）。 */
export interface DramaScene {
  heading: string;
  summary: string;
  shot: string;
  dialogue: string;
  duration_sec: number;
}

export interface DramaScript {
  id: string;
  title: string;
  logline?: string;
  genre: string;
  duration_sec: number;
  status: string; // draft | ready
  scenes: DramaScene[];
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
}

// ── mock 样本（USE_MOCK=1 时本地回放，无需 server） ───────────────────────────
const MOCK_SCRIPT: DramaScript = {
  id: "ds_mock_demo",
  title: "误会重逢",
  logline: "失忆的总裁在咖啡馆偶遇前妻，一杯拿铁勾起被尘封的回忆。",
  genre: "都市情感",
  duration_sec: 60,
  status: "draft",
  scenes: [
    { heading: "日 · 咖啡馆 · 内", summary: "总裁排队点单，与前妻擦肩。", shot: "中近景，手持轻微晃动，暖色调", dialogue: "（旁白）有些人一转身，就是一辈子。", duration_sec: 12 },
    { heading: "日 · 咖啡馆 · 卡座", summary: "前妻认出他，欲言又止。", shot: "正反打特写，浅景深", dialogue: "前妻：你……还喝三分糖吗？", duration_sec: 16 },
    { heading: "日 · 咖啡馆 · 窗边", summary: "总裁记忆闪回，握紧杯子。", shot: "面部特写 + 回忆叠化", dialogue: "总裁：（低声）我好像在哪见过你。", duration_sec: 16 },
    { heading: "日 · 咖啡馆 · 门口", summary: "两人并肩走出，留下悬念。", shot: "背影中景，逆光缓推", dialogue: "（旁白）这一次，他不想再转身。", duration_sec: 16 },
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
    return mockDelay([{ ...MOCK_SCRIPT, id: `ds_mock_${Date.now()}`, title: params.theme.slice(0, 6) || MOCK_SCRIPT.title }], 900);
  }
  return apiFetch<DramaScript[]>("/me/drama/scripts/ai-draft", {
    method: "POST",
    body: {
      theme: params.theme,
      genre: params.genre,
      duration_sec: params.durationSec,
      count: params.count,
    },
  });
}

export async function generateEpisodes(params: GenerateEpisodesParams): Promise<DramaEpisodeJob[]> {
  if (USE_MOCK) {
    const n = params.count ?? 1;
    return mockDelay(
      Array.from({ length: n }, (_, i) => ({
        id: `mvj_mock_${Date.now()}_${i}`,
        script_id: params.scriptId,
        kind: "drama-episode",
        name: `${params.name ?? "短剧片段"}${n > 1 ? ` · 第 ${i + 1} 版` : ""}`,
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
    body: { script_id: params.scriptId, count: params.count, name: params.name },
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
