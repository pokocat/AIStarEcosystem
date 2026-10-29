import { nanoid } from "nanoid";
import type { IpProject, IpProjectDoc, IpProjectSummary, IpRun } from "@ai-star-eco/types";
import type { StudioReference, StudioRunRequest } from "@ai-star-eco/types/ip-studio-workflow";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from "@/canvas/types/canvas";
import { applyStudioRunToDocument, makeStudioNode } from "@/canvas-bridge/studio-nodes";
import { IpStudioApi } from "../api";

/**
 * 场景页的「草稿」就是一张普通画布：参考图、出图节点和结果都按画布的格式写进文档，
 * 所以随时可以「在画布中继续」，任务恢复、确认原任务也和画布同一套。
 */

export type SceneUpload = { key: string; url: string; name: string };

/** 这一页（图片 / 视频）建过的草稿：按项目上记的场景编号认，改了名字也还在「最近」里。 */
export async function listSceneDrafts(sceneIds: ReadonlySet<string>): Promise<IpProjectSummary[]> {
  return (await IpStudioApi.listProjects())
    .filter(p => !!p.sceneId && sceneIds.has(p.sceneId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export const createSceneDraft = (name: string, sceneId: string) => IpStudioApi.createProject({ name, sceneId });

/** 整存整取：带上读到的版本，别处改过就让服务端拒绝，不覆盖。 */
export const saveDraftDoc = (project: IpProject, doc: IpProjectDoc) =>
  IpStudioApi.updateProject(project.id, { doc, baseDocVersion: project.docVersion });

const rowBottom = (nodes: CanvasNodeData[]) => nodes.length ? Math.max(...nodes.map(n => n.position.y + n.height)) + 80 : 120;

/** 参考图节点：同一个文件只放一次，下次出图复用同一个节点。 */
function referenceNode(nodes: CanvasNodeData[], upload: SceneUpload, title: string, position: { x: number; y: number }): CanvasNodeData {
  const existing = nodes.find(n => n.type === CanvasNodeType.Image && n.metadata?.storageKey === upload.key);
  if (existing) return existing;
  return { id: nanoid(), type: CanvasNodeType.Image, title, width: 280, height: 320, position,
    metadata: { content: upload.url, storageKey: upload.key, status: "success", origin: "upload" } };
}

/**
 * 在草稿里加一行：左边参考图，右边出图节点，连线就是「这张图参考了谁」。
 * 返回新文档和提交用的请求；请求先写进节点再提交，网断了也能按原请求确认。
 */
export function addImageRow(doc: IpProjectDoc, input: {
  title: string; prompt: string; refs: { upload: SceneUpload; label: string }[];
  ratio: string; count: number; size?: string; model?: string; maxCost?: number;
}): { doc: IpProjectDoc; request: StudioRunRequest; nodeId: string } {
  const nodes = doc.nodes as CanvasNodeData[];
  const y = rowBottom(nodes);
  const refNodes = input.refs.map((r, i) => referenceNode(nodes, r.upload, r.label, { x: 100, y: y + i * 340 }));
  const target = makeStudioNode("image");
  const references: StudioReference[] = input.refs.map(r => ({ storageKey: r.upload.key, role: "character" }));
  const request: StudioRunRequest = { clientRequestId: nanoid(), nodeId: target.id, operation: "image", prompt: input.prompt, references,
    aspectRatio: input.ratio, count: input.count, ...(input.size ? { size: input.size } : {}), ...(input.model ? { model: input.model } : {}),
    ...(input.maxCost !== undefined ? { maxCost: input.maxCost } : {}) };
  const node: CanvasNodeData = { ...target, title: input.title, position: { x: refNodes.length ? 460 : 100, y },
    metadata: { ...target.metadata, prompt: input.prompt, status: "loading", studio: { ...target.metadata!.studio!, request, references } } };
  const fresh = refNodes.filter(r => !nodes.includes(r));
  const connections: CanvasConnection[] = [...(doc.connections as CanvasConnection[]),
    ...refNodes.map(r => ({ id: nanoid(), fromNodeId: r.id, toNodeId: node.id }))];
  // 结果节点排在新参考图前面：画布自动封面取第一张有图的节点，草稿封面就是出的图而不是上传的照片。
  return { doc: { ...doc, nodes: [...nodes, node, ...fresh], connections }, request, nodeId: node.id };
}

export function applyRun(doc: IpProjectDoc, nodeId: string, run: IpRun): IpProjectDoc {
  return { ...doc, nodes: applyStudioRunToDocument(doc.nodes as CanvasNodeData[], doc.connections as CanvasConnection[], nodeId, run) };
}

export function patchNode(doc: IpProjectDoc, nodeId: string, patch: (node: CanvasNodeData) => CanvasNodeData | undefined): IpProjectDoc {
  const nodes = (doc.nodes as CanvasNodeData[]).flatMap(n => { if (n.id !== nodeId) return [n]; const next = patch(n); return next ? [next] : []; });
  return { ...doc, nodes, connections: (doc.connections as CanvasConnection[]).filter(c => nodes.some(n => n.id === c.toNodeId) && nodes.some(n => n.id === c.fromNodeId)) };
}

/** 这张草稿里由场景页发起的出图，新的在前。 */
export function imageRows(doc: IpProjectDoc): CanvasNodeData[] {
  return (doc.nodes as CanvasNodeData[])
    .filter(n => n.type === CanvasNodeType.Image && n.metadata?.studio?.request?.operation === "image")
    .sort((a, b) => b.position.y - a.position.y);
}

/** 服务端明确拒绝（没受理）才算失败；其余情况保留原请求，等用户「确认原任务」。 */
export function submissionRejected(error: unknown, posted: boolean): boolean {
  if (!posted) return true;
  const e = error as { status?: unknown; code?: unknown };
  return typeof e?.status === "number" && e.status >= 400 && e.status < 500 && e.status !== 408
    || ["AI_NOT_CONFIGURED", "PROMPT_NOT_CONFIGURED", "ENDPOINT_NOT_ALLOWED"].includes(String(e?.code));
}

/** 那一次用的参考图（按请求里的顺序），从草稿里的参考图节点找回地址；找不到的位置留空。 */
export function rowUploads(doc: IpProjectDoc, row: CanvasNodeData): (SceneUpload | undefined)[] {
  const nodes = doc.nodes as CanvasNodeData[];
  return (row.metadata?.studio?.request?.references ?? []).map(ref => {
    const node = nodes.find(n => n.metadata?.storageKey === ref.storageKey && n.id !== row.id);
    const url = node?.metadata?.content;
    return url ? { key: ref.storageKey, url, name: node!.title || "参考图" } : undefined;
  });
}

/** 失败的那一行原地再来：同样的输入，新的请求编号；行还在原位置，失败记录不堆成一串。 */
export function resubmitImageRow(doc: IpProjectDoc, nodeId: string): { doc: IpProjectDoc; request: StudioRunRequest } | undefined {
  const node = (doc.nodes as CanvasNodeData[]).find(n => n.id === nodeId);
  const old = node?.metadata?.studio?.request;
  if (!node || !old) return undefined;
  const request: StudioRunRequest = { ...old, clientRequestId: nanoid() };
  const next = patchNode(doc, nodeId, n => ({ ...n, metadata: { ...n.metadata, status: "loading", errorDetails: undefined, errorCode: undefined, errorLogId: undefined,
    studio: { ...n.metadata!.studio!, request, runId: undefined, task: undefined } } }));
  return { doc: next, request };
}
