// ─────────────────────────────────────────────────────────────────────────────
// api/short-drama.ts — 短剧生成（v0.43+）。脚本化表达：AI 起草分场景脚本 → 保存 →
// 生成短剧视频（异步 submit + 轮询）。后端复用 celebrity 视频任务管线。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import type { AppliedRefs } from "./render";

/** 一个场景（分镜）。shot=画面/分镜（怎么拍），dialogue=台词/旁白（念什么）。 */
export interface DramaScene {
  heading: string;
  summary: string;
  shot: string;
  dialogue: string;
  /** v0.97：本镜节拍语义标签（如 痛点开场 / 反转 / 强 CTA 收尾），由 AI 按本镜实际作用生成。 */
  beat?: string;
  /** 音效 / 环境音（AI 可选生成，留空 = 无）。 */
  sfx?: string;
  /** 背景音乐建议（AI 可选生成，留空 = 无）。 */
  bgm?: string;
  /** 画面包装 / 特效氛围（AI 可选生成，留空 = 无）。 */
  fx?: string;
  duration_sec: number;
}

/** 主角设定（统领全片人物形象与性格）。 */
export interface ScriptCharacter {
  name: string;
  description: string;
}

/**
 * 整体短视频说明（meta）—— AI 先定调：标题 / 风格 / 主场景 / 主角。
 * 作为分镜与逐镜出片（首帧、视频）的统一参考，使生成更一致、更准确。
 */
export interface ScriptMeta {
  title: string;
  style: string[];
  scene: string;
  character: ScriptCharacter;
}

export interface ContinuityRef {
  cdnKey?: string;
  url?: string;
}

export interface ContinuityCharacter {
  id: string;
  name: string;
  /** 只供视觉模型使用，不含台词、口头禅或剧情指令。 */
  visualTraits: string;
  /** 只供表演/配音使用，不进入逐镜视觉前缀。 */
  performanceTraits: string;
  avatarId?: string;
  canonicalRef?: ContinuityRef;
}

export interface ContinuityScene {
  id: string;
  name: string;
  visualTraits: string;
  canonicalRef?: ContinuityRef;
}

export interface ContinuityShot {
  id: string;
  no: number;
  sceneId: string;
  durationSec: number;
  continuityMode: "anchor" | "chain";
  parentShotId?: string;
  castIds: string[];
  dialogue: { speaker: string; text: string };
  audio: { startSec: number; endSec: number; sfx: string; bgm: string; subtitle?: boolean };
}

export interface ContinuityDependency {
  shotId: string;
  batch: number;
  dependsOn?: string;
  requiredRefs: Array<"character" | "scene" | "previous_last_frame">;
}

export interface ShortContinuityManifest {
  version: string;
  promptVersion: string;
  renderSpec: {
    aspectRatio: "9:16";
    width: 720;
    height: 1280;
    fps: 30;
    visualTextPolicy: "no_text";
    subtitlePolicy: "platform_exact";
  };
  characters: ContinuityCharacter[];
  scenes: ContinuityScene[];
  shots: ContinuityShot[];
  dependencyPlan: ContinuityDependency[];
}

export interface DramaScript {
  id: string;
  title: string;
  logline?: string;
  genre: string;
  duration_sec: number;
  status: string; // draft | ready
  /** 整体短视频说明（后端 ai-draft 保证返回，老脚本可能没有）。 */
  meta?: ScriptMeta;
  /** 单次脚本调用后由服务端确定性派生，不额外消耗模型 token。 */
  continuity_manifest?: ShortContinuityManifest;
  scenes: DramaScene[];
  /** 后续推荐 action：AI 基于这一版脚本给的 2-4 条「继续修改」快捷指令（ai-draft 返回，可能为空）。 */
  suggestions?: string[];
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
  /** v0.97 P2：成片真实末帧（seedance return_last_frame）→ 下一镜首帧参考。 */
  last_frame_url?: string | null;
  /** C-1（一致性引擎）：首/末帧生效回报（参考 N/M 生效）。 */
  applied_refs?: AppliedRefs;
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
  /** 套模版上下文：爆款模版的分镜节拍 / 口播结构，作为 AI 生成参考一并喂给大模型。 */
  reference?: string;
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
  meta: {
    title: "误会重逢",
    style: ["都市情感", "高级感", "反转"],
    scene: "午后高档连锁咖啡馆，暖色调，落地窗洒入阳光，人来人往",
    character: {
      name: "顾衍（失忆总裁）",
      description: "三十出头，西装挺括、神色疏离，因车祸失忆；眼神里藏着说不清的熟悉与怅然",
    },
  },
  scenes: [
    { heading: "日 · 咖啡馆 · 内", summary: "总裁排队点单，与前妻擦肩。", shot: "中近景，手持轻微晃动，暖色调", dialogue: "（旁白）有些人一转身，就是一辈子。", duration_sec: 12 },
    { heading: "日 · 咖啡馆 · 卡座", summary: "前妻认出他，欲言又止。", shot: "正反打特写，浅景深", dialogue: "前妻：你……还喝三分糖吗？", duration_sec: 16 },
    { heading: "日 · 咖啡馆 · 窗边", summary: "总裁记忆闪回，握紧杯子。", shot: "面部特写 + 回忆叠化", dialogue: "总裁：（低声）我好像在哪见过你。", duration_sec: 16 },
    { heading: "日 · 咖啡馆 · 门口", summary: "两人并肩走出，留下悬念。", shot: "背影中景，逆光缓推", dialogue: "（旁白）这一次，他不想再转身。", duration_sec: 16 },
  ],
  suggestions: ["开头钩子再狠一点", "压到 30 秒内", "台词更口语", "结尾留更强悬念"],
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
      reference: params.reference,
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
