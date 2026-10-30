import { nanoid } from "nanoid";
import type { IpProject, IpProjectDoc, IpProjectSummary, IpRun, StudioSceneInputs } from "@ai-star-eco/types";
import type { StudioReference, StudioRunRequest, StudioVideoSettings } from "@ai-star-eco/types/ip-studio-workflow";
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

/**
 * 编导写一版脚本（AI 视频页）：画布上一个普通文字节点，任务是普通的文字任务（textEdit 是上一版脚本，第一次为空）。
 * 素材连进来、上一版连到下一版，「在画布中继续」看得到每一版看了哪些图；请求先写进节点再提交，和出图同一套恢复规则。
 */
export function addScriptNode(doc: IpProjectDoc, input: {
  ask: string; revision: boolean; prompt: string; materialIds: string[]; imageIds: string[];
  duration: number; ratio: string; language: string; model?: string; maxCost?: number;
}): { doc: IpProjectDoc; request: StudioRunRequest; nodeId: string } {
  const nodes = doc.nodes as CanvasNodeData[];
  const previous = scriptNodes(doc).at(-1);
  const content = previous?.metadata?.content || "";
  const target = makeStudioNode("text");
  const request: StudioRunRequest = { clientRequestId: nanoid(), nodeId: target.id, operation: "text", prompt: input.prompt, textEdit: { content },
    contextNodeIds: input.imageIds, ...(input.imageIds.length ? { readVisuals: true } : {}),
    ...(input.model ? { model: input.model } : {}), ...(input.maxCost !== undefined ? { maxCost: input.maxCost } : {}) };
  const at = previous ? { x: previous.position.x, y: previous.position.y + previous.height + 80 } : { x: 520, y: 120 };
  const node: CanvasNodeData = { ...target, title: previous ? "视频脚本 · 修改" : "视频脚本", position: at, width: 480, height: 360,
    metadata: { ...target.metadata, content, status: "loading", studio: { ...target.metadata!.studio!, request,
      sceneDirector: { ask: input.ask, revision: input.revision, duration: input.duration, ratio: input.ratio, language: input.language, at: new Date().toISOString() } } } };
  const connections: CanvasConnection[] = [...(doc.connections as CanvasConnection[]),
    ...(previous ? [previous.id] : input.materialIds).map(from => ({ id: nanoid(), fromNodeId: from, toNodeId: node.id }))];
  return { doc: { ...doc, nodes: [...nodes, node], connections }, request, nodeId: node.id };
}

/** 编导写过的每一版，按先后。 */
export function scriptNodes(doc: IpProjectDoc): CanvasNodeData[] {
  return (doc.nodes as CanvasNodeData[]).filter(n => n.type === CanvasNodeType.Text && n.metadata?.studio?.sceneDirector)
    .sort((a, b) => a.metadata!.studio!.sceneDirector!.at.localeCompare(b.metadata!.studio!.sceneDirector!.at));
}

/** 按脚本出一条视频：视频节点挂在脚本右边，参考素材连进来；结果、恢复和确认原任务都是画布那一套。 */
export function addVideoRow(doc: IpProjectDoc, input: {
  title: string; prompt: string; scriptId?: string; refIds: string[]; video: StudioVideoSettings;
  durationSec: number; aspectRatio: string; model?: string; maxCost?: number;
}): { doc: IpProjectDoc; request: StudioRunRequest; nodeId: string } {
  const nodes = doc.nodes as CanvasNodeData[];
  const script = nodes.find(n => n.id === input.scriptId);
  const target = makeStudioNode("video");
  const request: StudioRunRequest = { clientRequestId: nanoid(), nodeId: target.id, operation: "video", prompt: input.prompt, references: [], video: input.video,
    aspectRatio: input.aspectRatio, durationSec: input.durationSec, count: 1, ...(input.model ? { model: input.model } : {}),
    ...(input.maxCost !== undefined ? { maxCost: input.maxCost } : {}) };
  const rows = videoRows(doc);
  const x = script ? script.position.x + script.width + 90 : 1100;
  const y = rows.length ? Math.max(...rows.map(r => r.position.y + r.height)) + 60 : script?.position.y ?? 120;
  const node: CanvasNodeData = { ...target, title: input.title, position: { x, y },
    metadata: { ...target.metadata, prompt: input.prompt, status: "loading", studio: { ...target.metadata!.studio!, request } } };
  const connections: CanvasConnection[] = [...(doc.connections as CanvasConnection[]),
    ...[...(script ? [script.id] : []), ...input.refIds].map(from => ({ id: nanoid(), fromNodeId: from, toNodeId: node.id }))];
  return { doc: { ...doc, nodes: [...nodes, node], connections }, request, nodeId: node.id };
}

/** 这张草稿里按脚本出的视频，新的在前。 */
export function videoRows(doc: IpProjectDoc): CanvasNodeData[] {
  return (doc.nodes as CanvasNodeData[])
    .filter(n => n.type === CanvasNodeType.Video && n.metadata?.studio?.request?.operation === "video")
    .sort((a, b) => b.position.y - a.position.y);
}

/** 失败的那一行（出图、脚本、视频都一样）原地再来：同样的输入，新的请求编号；行还在原位置，失败记录不堆成一串。 */
export function resubmitRow(doc: IpProjectDoc, nodeId: string): { doc: IpProjectDoc; request: StudioRunRequest } | undefined {
  const node = (doc.nodes as CanvasNodeData[]).find(n => n.id === nodeId);
  const old = node?.metadata?.studio?.request;
  if (!node || !old) return undefined;
  // 文字任务按节点当前正文改：失败时正文没动，原来的 textEdit 仍然对得上。
  const request: StudioRunRequest = { ...old, clientRequestId: nanoid() };
  const next = patchNode(doc, nodeId, n => ({ ...n, metadata: { ...n.metadata, status: "loading", errorDetails: undefined, errorCode: undefined, errorLogId: undefined,
    studio: { ...n.metadata!.studio!, request, runId: undefined, task: undefined } } }));
  return { doc: next, request };
}

export type SceneInputKind = "image" | "character" | "voice" | "video";

/**
 * AI 视频页当前选中的素材（文件 key）。存过就用存的（清空的格子是 null）；老草稿没存过，按画布上的素材推断：
 * 写过脚本按最新一版看过的图，没写过（或那一版的模型不看图）按上传过的图；声音、参考视频取**最新**上传的那份（换过就是换后的）。
 */
export function sceneInputsOf(doc: IpProjectDoc): StudioSceneInputs {
  if (doc.sceneInputs) return doc.sceneInputs;
  const nodes = doc.nodes as CanvasNodeData[];
  const latest = scriptNodes(doc).at(-1);
  // 最近一版脚本看过的图（只有看图的模型才记）；没记就按上传过的图。
  const seen = (latest?.metadata?.studio?.request?.contextNodeIds ?? []).flatMap(id => nodes.filter(n => n.id === id));
  const used = seen.length ? seen : nodes.filter(n => n.type === CanvasNodeType.Image && n.metadata?.origin === "upload").sort((a, b) => a.position.y - b.position.y);
  const key = (n?: CanvasNodeData) => n?.metadata?.storageKey ?? null;
  const newest = (type: CanvasNodeType, title: string) => [...nodes].reverse().find(n => n.type === type && n.title === title);
  return {
    images: used.filter(n => n.title !== "出镜人物").flatMap(n => key(n) ? [key(n)!] : []),
    character: key(used.find(n => n.title === "出镜人物")),
    voice: key(newest(CanvasNodeType.Audio, "声音样本")),
    video: key(newest(CanvasNodeType.Video, "参考视频")),
  };
}

/** 放进 / 移除一格素材，记进草稿文档；画布上的素材节点不删（旧结果还引用它们）。 */
export function withSceneInput(doc: IpProjectDoc, kind: SceneInputKind, key: string, change: "add" | "remove", maxImages = 6): IpProjectDoc {
  const now = sceneInputsOf(doc);
  const next: StudioSceneInputs = { ...now, images: [...now.images] };
  if (kind === "image") next.images = change === "remove" ? now.images.filter(k => k !== key) : [...now.images.filter(k => k !== key), key].slice(0, maxImages);
  else next[kind] = change === "remove" ? (now[kind] === key ? null : now[kind]) : key;
  return { ...doc, sceneInputs: next };
}
