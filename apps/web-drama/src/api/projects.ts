// ─────────────────────────────────────────────────────────────────────────────
// api/projects.ts — 短剧项目工作台（v0.64+）。
// 六阶段工作台 ProjectData 文档的 CRUD + 大纲 AI 起草。
// 后端：/api/me/drama/projects/**（DramaProjectController），按 ownerUserId 隔离。
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import {
  PROJECTS,
  getProjectData,
  type DramaProjectSummary,
  type EpisodeOutline,
  type ProjectData,
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

/** 多集短剧列表（单集作品在「短视频工坊」，此处只收多集）。 */
export async function listProjects(): Promise<DramaProjectSummary[]> {
  if (USE_MOCK) return mockDelay(PROJECTS.filter((p) => p.episodes > 1));
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
