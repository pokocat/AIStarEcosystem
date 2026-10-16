import { nanoid } from 'nanoid';
import type { StudioMediaImportResult } from '@ai-star-eco/types';
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from '@/canvas/types/canvas';
import { studioGenerationPending } from './studio-nodes';
import { markStudioDescendants } from './studio-script';

export const STUDIO_IMAGE_UPLOAD_ACCEPT = '.jpg,.jpeg,.png';

export { validateStudioImageUpload } from './studio-image-file';

/** Fill the existing slot so template bindings, its layout and reference edges retain their identity. */
export function replaceStudioImage(nodes: CanvasNodeData[], connections: CanvasConnection[], nodeId: string,
  image: StudioMediaImportResult): CanvasNodeData[] {
  const node = nodes.find(n => n.id === nodeId);
  if (!node || node.type !== CanvasNodeType.Image) throw new Error('图片节点已移出画布，请重新选择');
  if (studioGenerationPending(node)) throw new Error('当前节点正在生成，请等待任务完成后再替换图片');
  if (image.mediaType !== 'image' || !image.key || !image.url) throw new Error('图片上传未完成，请重试');
  const imageId = `upload-${nanoid()}`;
  const marked = markStudioDescendants(nodes, nodeId);
  const dependentIds = new Set([nodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of connections) {
      if (dependentIds.has(edge.fromNodeId) && !dependentIds.has(edge.toNodeId)) {
        dependentIds.add(edge.toNodeId); changed = true;
      }
    }
  }
  return marked.map(n => n.id === nodeId ? { ...n, metadata: { ...n.metadata,
    content: image.url, storageKey: image.key, status: 'success', errorDetails: undefined,
    mimeType: image.mimeType, bytes: image.bytes, naturalWidth: image.width, naturalHeight: image.height,
    primaryImageId: imageId, runId: undefined,
    images: [...(n.metadata?.images || []), { id: imageId, content: image.url, storageKey: image.key,
      status: 'success', mimeType: image.mimeType, bytes: image.bytes,
      naturalWidth: image.width || 0, naturalHeight: image.height || 0 }],
    studio: n.metadata?.studio ? { ...n.metadata.studio, runId: undefined, request: undefined,
      task: undefined, adoption: undefined, references: [], upstreamChanged: false } : undefined,
  } } : dependentIds.has(n.id) && n.metadata?.studio ? { ...n, metadata: { ...n.metadata,
    studio: { ...n.metadata.studio, upstreamChanged: true } } } : n);
}
