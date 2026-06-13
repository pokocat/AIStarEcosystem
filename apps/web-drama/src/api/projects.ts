// ─────────────────────────────────────────────────────────────────────────────
// api/projects.ts — 短剧项目工作台（v0.64+）。
// 六阶段工作台 ProjectData 文档的 CRUD + 大纲 AI 起草。
// 后端：/api/me/drama/projects/**（DramaProjectController），按 ownerUserId 隔离。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import {
  PROJECTS,
  getProjectData,
  type AssembledEpisode,
  type BoardScene,
  type BoardShot,
  type CharacterDef,
  type DramaProjectSummary,
  type EpisodeOutline,
  type ProjectData,
  type ScriptLine,
  type ScriptScene,
} from "@/mocks/drama-workshop";

/** 详情壳：列表卡片字段 + 整套工作台文档。 */
export interface ProjectDetail {
  meta: DramaProjectSummary;
  data: ProjectData;
}

export interface CreateProjectInput {
  title?: string;
  type: string;
  typeKey: string;
  mode: "guided" | "template";
  ratio?: string;
  episodes?: number;
  logline?: string;
  mainline?: string;
  coverFrom?: string;
  coverTo?: string;
}

export interface SaveProjectOptions {
  stage?: number;
  progress?: number;
}

/**
 * 用户全部短剧项目（多集短剧 + 单集作品/宣传片）。后端按 updatedAt 倒序返回全集；
 * 由各页按集数分流：短剧工坊只收多集（episodes > 1），短视频工坊只收单集（episodes === 1）。
 * （mock 同样返回全集，保持与真后端一致。）
 */
export async function listProjects(): Promise<DramaProjectSummary[]> {
  if (USE_MOCK) return mockDelay(PROJECTS);
  return apiFetch<DramaProjectSummary[]>("/me/drama/projects");
}

export async function getProject(id: string): Promise<ProjectDetail> {
  if (USE_MOCK) {
    const data = getProjectData(id);
    const meta = PROJECTS.find((p) => p.id === id);
    if (!data || !meta) throw new Error("项目不存在");
    return mockDelay({ meta, data });
  }
  return apiFetch<ProjectDetail>(`/me/drama/projects/${id}`);
}

export async function createProject(input: CreateProjectInput): Promise<ProjectDetail> {
  if (USE_MOCK) {
    const id = `dp_mock_${Date.now()}`;
    const meta: DramaProjectSummary = {
      id,
      title: input.title || "未命名短剧",
      type: input.type,
      typeKey: input.typeKey,
      ratio: input.ratio || "9:16",
      episodes: input.episodes ?? 1,
      progress: 0,
      stage: 1,
      cover: { from: input.coverFrom || "#f97316", to: input.coverTo || "#e11d48" },
      mode: input.mode,
      updated: "刚刚",
    };
    const data: ProjectData = {
      projectInfo: {
        title: meta.title,
        type: input.type,
        episodes: meta.episodes,
        duration: "每集 ~75 秒",
        ratio: meta.ratio,
        logline: input.logline || "",
        mainline: input.mainline || "",
      },
      topicCards: [],
      episodes: [],
      characters: [],
      script: { ep: 1, scenes: [] },
      storyboard: { ep: 1, scenes: [] },
      promptPack: { ep: 1, scene: "", shots: [] },
    };
    return mockDelay({ meta, data });
  }
  return apiFetch<ProjectDetail>("/me/drama/projects", { method: "POST", body: input });
}

/** 保存整套工作台文档（可选携带 stage / progress）。 */
export async function saveProject(
  id: string,
  data: ProjectData,
  opts?: SaveProjectOptions,
): Promise<ProjectDetail> {
  if (USE_MOCK) {
    const meta = PROJECTS.find((p) => p.id === id);
    return mockDelay({
      meta: {
        ...(meta ?? {
          id,
          title: data.projectInfo.title,
          type: data.projectInfo.type,
          typeKey: "custom",
          ratio: data.projectInfo.ratio,
          episodes: data.projectInfo.episodes,
          cover: { from: "#f97316", to: "#e11d48" },
          mode: "guided" as const,
          updated: "刚刚",
        }),
        stage: opts?.stage ?? meta?.stage ?? 1,
        progress: opts?.progress ?? meta?.progress ?? 0,
      },
      data,
    });
  }
  return apiFetch<ProjectDetail>(`/me/drama/projects/${id}`, {
    method: "PUT",
    body: { data, stage: opts?.stage, progress: opts?.progress },
  });
}

export async function deleteProject(id: string): Promise<void> {
  if (USE_MOCK) return mockDelay(undefined);
  await apiFetch<void>(`/me/drama/projects/${id}`, { method: "DELETE" });
}

// ── 剧集脚本 / 角色 AI ─────────────────────────────────────────────────────────

export interface EpscriptDraftResult {
  scenes: ScriptScene[];
  boardScenes: BoardScene[];
}

/** 按本集剧情把整集重写为分场 + 分镜（未落库，前端合并后 saveProject）。 */
export async function epscriptAiDraft(
  id: string,
  input: { ep: number; plot: string; style?: string; cast?: string[] },
): Promise<EpscriptDraftResult> {
  if (USE_MOCK) {
    const sceneId = `sc_${input.ep}_1`;
    const scenes: ScriptScene[] = [
      {
        id: sceneId,
        place: "内景 · 公寓客厅 · 深夜",
        mood: "压抑悬疑",
        action: input.plot.slice(0, 40) || "主角发现对楼窗口的异样灯光。",
        lines: [{ who: "旁白", text: "搬进来的第一晚，她就觉得哪里不对。" }],
      },
    ];
    const boardScenes: BoardScene[] = [
      {
        id: sceneId,
        shots: [
          { id: `${sceneId}_s1`, no: 1, size: "中近景", move: "缓慢推近", dur: 4, engine: "avatar", desc: "主角拆箱，抬头瞥向窗外", cast: [], line: null },
          { id: `${sceneId}_s2`, no: 2, size: "特写", move: "固定", dur: 5, engine: "seedance", desc: "对楼窗口人影一闪而过", cast: [], line: null },
        ],
      },
    ];
    return mockDelay({ scenes, boardScenes }, 1300);
  }
  return apiFetch<EpscriptDraftResult>(`/me/drama/projects/${id}/epscript/ai-draft`, {
    method: "POST",
    body: { ep: input.ep, plot: input.plot, style: input.style, cast: input.cast },
  });
}

/** 把单场拆成镜头表（未落库）。 */
export async function splitSceneShots(
  id: string,
  input: { sceneId: string; place?: string; action: string; lines?: ScriptLine[]; style?: string },
): Promise<BoardShot[]> {
  if (USE_MOCK) {
    return mockDelay(
      [
        { id: `${input.sceneId}_s1`, no: 1, size: "中近景", move: "缓慢推近", dur: 4, engine: "avatar" as const, desc: input.action.slice(0, 30) || "主角入画", cast: [], line: null },
        { id: `${input.sceneId}_s2`, no: 2, size: "特写", move: "固定", dur: 4, engine: "seedance" as const, desc: "关键道具特写", cast: [], line: null },
      ],
      1100,
    );
  }
  const res = await apiFetch<{ shots: BoardShot[] }>(`/me/drama/projects/${id}/epscript/split-scene`, {
    method: "POST",
    body: input,
  });
  return res.shots ?? [];
}

/** 从大纲重抽角色阵容（未落库）。 */
export async function castAiDraft(id: string): Promise<CharacterDef[]> {
  if (USE_MOCK) {
    return mockDelay(
      [
        { id: "ch_1", name: "林夏", role: "key" as const, cast: "女 · 28 岁 · 广告公司 AE", desc: "敏感坚韧，弧线从自我怀疑到直面真相。", avatar: "a1", bound: false },
        { id: "ch_2", name: "沈一鸣", role: "key" as const, cast: "男 · 32 岁 · 刑警", desc: "冷静克制，因旧案与主角命运交错。", avatar: "a4", bound: false },
        { id: "ch_3", name: "陈姨", role: "extra" as const, cast: "女 · 55 岁 · 楼栋管理员", desc: "热心却藏着秘密。", avatar: "a2", bound: false },
      ],
      1200,
    );
  }
  const res = await apiFetch<{ characters: CharacterDef[] }>(`/me/drama/projects/${id}/cast/ai-draft`, {
    method: "POST",
  });
  return res.characters ?? [];
}

/** 成片合成（v0.66）：把某集已出片分镜按序拼成完整片（未落库，前端合并后 saveProject）。 */
export async function assembleEpisode(id: string, ep: number): Promise<AssembledEpisode> {
  if (USE_MOCK) {
    return mockDelay(
      { url: "/videos/showreel-01.mp4", durationSec: 36, shotCount: 6, at: new Date().toISOString() },
      1800,
    );
  }
  return apiFetch<AssembledEpisode>(`/me/drama/projects/${id}/assemble`, {
    method: "POST",
    body: { ep },
  });
}

/** 大纲 AI 起草：按 projectInfo 生成分集大纲（未落库，前端合并后再 saveProject）。 */
export async function outlineAiDraft(id: string, count?: number): Promise<EpisodeOutline[]> {
  if (USE_MOCK) {
    const beats = ["误会加深", "信任崩塌", "高光反击", "终极揭谜", "情绪释怀", "续作悬念"];
    return mockDelay(
      Array.from({ length: count ?? 6 }, (_, i) => ({
        no: i + 1,
        hook: `第 ${i + 1} 集的强钩子（本地联调样例）`,
        synopsis: "AI 按主线铺出的本集梗概占位文案。",
        beat: beats[i % beats.length],
      })),
      1200,
    );
  }
  const res = await apiFetch<{ episodes: EpisodeOutline[] }>(
    `/me/drama/projects/${id}/outline/ai-draft`,
    { method: "POST", body: { count } },
  );
  return res.episodes ?? [];
}
