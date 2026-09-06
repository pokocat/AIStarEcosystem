// ─────────────────────────────────────────────────────────────────────────────
// api/ip-studio.ts — AI IP 工作台 API 调用层。
//
// USE_MOCK=1 → src/mocks/ip-studio.ts 内存实现（含本地运行模拟器，无网络）；
// USE_MOCK=0 → apiFetch → Next rewrites → Spring Boot /api/v1/ip-studio/**。
// 路径表见 docs/ip-studio-plan.md §4.2；与 specs/openapi.yaml 一致（契约脚本守门）。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  IpCreateProjectRequest, IpPricing, IpProject, IpProjectDoc, IpProjectSummary,
  IpPublishRequest, IpPublishResult, IpRun, IpStylePreset, IpTemplate, IpUpdateProjectRequest,
  IpUploadResult,
} from "@ai-star-eco/types";
import { apiFetch, USE_MOCK, mockDelay } from "./_client";
import {
  MOCK_PRICING, MOCK_STYLES, MOCK_TEMPLATES, mockCancelRun, mockNextId,
  mockPlaceholderImage, mockReadRun, mockStartRun, mockStore,
} from "@/mocks/ip-studio";

const nowIso = () => new Date().toISOString();

// ── 内置资源 ─────────────────────────────────────────────────────────────────

export async function listTemplates(): Promise<IpTemplate[]> {
  if (USE_MOCK) return mockDelay(MOCK_TEMPLATES);
  return apiFetch<IpTemplate[]>("/v1/ip-studio/templates");
}

export async function listStyles(): Promise<IpStylePreset[]> {
  if (USE_MOCK) return mockDelay(MOCK_STYLES);
  return apiFetch<IpStylePreset[]>("/v1/ip-studio/styles");
}

export async function getPricing(): Promise<IpPricing> {
  if (USE_MOCK) return mockDelay(MOCK_PRICING);
  return apiFetch<IpPricing>("/v1/ip-studio/pricing");
}

// ── 素材上传 ─────────────────────────────────────────────────────────────────

/** 照片 / 参考图上传（multipart）。只收 jpg / png ≤ 15MB（服务端同样把关）。 */
export async function uploadImage(file: File): Promise<IpUploadResult> {
  if (USE_MOCK) {
    return mockDelay({
      key: `ipstudio/source/mock/${mockNextId("IMG")}`,
      url: typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(file) : mockPlaceholderImage("上传示例", 5),
      fileName: file.name,
    });
  }
  const form = new FormData();
  form.append("file", file);
  return apiFetch<IpUploadResult>("/v1/ip-studio/uploads", { method: "POST", body: form });
}

// ── 项目 ─────────────────────────────────────────────────────────────────────

export async function listProjects(): Promise<IpProjectSummary[]> {
  if (USE_MOCK) {
    const items = [...mockStore().projects.values()]
      .map(({ doc: _doc, runs: _runs, runsById: _runsById, ...summary }) => summary)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return mockDelay(items);
  }
  return apiFetch<IpProjectSummary[]>("/v1/ip-studio/projects");
}

export async function createProject(payload: IpCreateProjectRequest): Promise<IpProject> {
  if (USE_MOCK) {
    const template = payload.templateId ? MOCK_TEMPLATES.find((t) => t.id === payload.templateId) : undefined;
    const doc: IpProjectDoc = template
      ? (JSON.parse(JSON.stringify(template.doc)) as IpProjectDoc)
      : { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
    const project: IpProject = {
      id: mockNextId("IPP"),
      name: payload.name?.trim() || template?.name || "未命名 IP 项目",
      ...(payload.templateId ? { templateId: payload.templateId } : {}),
      status: "draft",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      doc,
      runs: {},
      runsById: {},
    };
    mockStore().projects.set(project.id, project);
    return mockDelay(project);
  }
  return apiFetch<IpProject>("/v1/ip-studio/projects", { method: "POST", body: payload });
}

export async function getProject(id: string): Promise<IpProject> {
  if (USE_MOCK) {
    const project = mockStore().projects.get(id);
    if (!project) throw new Error("这个项目不存在或已被删除");
    return mockDelay(project);
  }
  return apiFetch<IpProject>(`/v1/ip-studio/projects/${id}`);
}

export async function updateProject(id: string, payload: IpUpdateProjectRequest): Promise<IpProject> {
  if (USE_MOCK) {
    const project = mockStore().projects.get(id);
    if (!project) throw new Error("这个项目不存在或已被删除");
    if (payload.name !== undefined) project.name = payload.name;
    if (payload.doc !== undefined) project.doc = payload.doc;
    project.updatedAt = nowIso();
    return mockDelay(project);
  }
  return apiFetch<IpProject>(`/v1/ip-studio/projects/${id}`, { method: "PUT", body: payload });
}

export async function deleteProject(id: string): Promise<void> {
  if (USE_MOCK) {
    mockStore().projects.delete(id);
    return mockDelay(undefined);
  }
  await apiFetch<void>(`/v1/ip-studio/projects/${id}`, { method: "DELETE" });
}

// ── 运行 ─────────────────────────────────────────────────────────────────────

/** 运行 identity / generate 节点。运行前把最新文档一起送上，避免「先 PUT 再 POST」竟态。 */
export async function runNode(id: string, nodeId: string, doc?: IpProjectDoc): Promise<IpRun> {
  if (USE_MOCK) {
    const project = mockStore().projects.get(id);
    const effective = doc ?? project?.doc;
    if (!effective) throw new Error("这个项目不存在或已被删除");
    return mockDelay(mockStartRun(id, nodeId, effective), 220);
  }
  return apiFetch<IpRun>(`/v1/ip-studio/projects/${id}/nodes/${nodeId}/run`, {
    method: "POST",
    body: doc ? { doc } : {},
  });
}

export async function getRun(id: string): Promise<IpRun> {
  if (USE_MOCK) return mockDelay(mockReadRun(id), 60);
  return apiFetch<IpRun>(`/v1/ip-studio/runs/${id}`);
}

export async function cancelRun(id: string): Promise<IpRun> {
  if (USE_MOCK) return mockDelay(mockCancelRun(id), 60);
  return apiFetch<IpRun>(`/v1/ip-studio/runs/${id}/cancel`, { method: "POST" });
}

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * 轮询一次运行直到终态。1.5 秒一次、上限 10 分钟；超时抛错（不把 running 当成功）。
 * onTick 每次拿到新状态都会回调，供进度条与 stage 文案更新。
 */
export async function awaitRun(
  runId: string,
  onTick?: (run: IpRun) => void,
  opts?: { signal?: AbortSignal },
): Promise<IpRun> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    if (opts?.signal?.aborted) throw new Error("已停止等待这次生成");
    const run = await getRun(runId);
    onTick?.(run);
    if (run.status !== "running") return run;
    if (Date.now() > deadline) throw new Error("这次生成等待超过 10 分钟，请稍后回到项目查看结果");
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

// ── 发布 ─────────────────────────────────────────────────────────────────────

export async function publishProject(id: string, payload: IpPublishRequest): Promise<IpPublishResult> {
  if (USE_MOCK) {
    const project = mockStore().projects.get(id);
    if (!project) throw new Error("这个项目不存在或已被删除");
    if (project.status === "published") throw new Error("这个项目已经发布过了");
    const avatarId = `DH-${2100 + mockStore().projects.size}`;
    project.status = "published";
    project.publishedAvatarId = avatarId;
    project.updatedAt = nowIso();
    for (const n of project.doc.nodes) {
      if (n.type === "publish") {
        n.data.avatarName = payload.avatarName;
        n.data.avatarId = avatarId;
        n.data.publishedAt = nowIso();
      }
    }
    return mockDelay({
      avatarId,
      lookIds: payload.lookNodeIds.map((_, i) => `LK-${3200 + i}`),
    });
  }
  return apiFetch<IpPublishResult>(`/v1/ip-studio/projects/${id}/publish`, { method: "POST", body: payload });
}
