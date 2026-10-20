import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';

/** The user-upload area of storage (`ipstudio_source/<uid>/…`, possibly behind a deployment key prefix). */
const UPLOAD_KEY = /(^|\/)ipstudio_source\//;

/** AI made it, or is making it: a Studio run, plan execution or speech / lip-sync request produced this node. */
export function studioAiMade(node: CanvasNodeData): boolean {
  const studio = node.metadata?.studio;
  return !!studio && !!(studio.runId || studio.execution || studio.request || studio.speechRequest || studio.lipSyncRequest);
}

/**
 * 「你上传的」 only for media the user brought in from their own files. This used to be decided by elimination (has a
 * storage key, not AI, not a 资产库 reference), so a generated image, video or voice brought back from 素材库, a person
 * from the IP library and a crop of an AI image all read 「你上传的」 (local e2e 2026-10-19) — wrong exactly where the
 * origin matters, when picking clips for a final cut. Upload paths now mark the node; older nodes without a mark count
 * only when the file sits in the upload area and nothing else in Studio claims the node.
 */
export function studioUploadedByUser(node: CanvasNodeData): boolean {
  const meta = node.metadata;
  if (node.type === CanvasNodeType.Text || !meta?.storageKey || studioAiMade(node)) return false;
  if (meta.origin) return meta.origin === 'upload';
  return !meta.studio && UPLOAD_KEY.test(meta.storageKey);
}
