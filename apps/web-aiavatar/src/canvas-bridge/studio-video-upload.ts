import { nanoid } from 'nanoid';
import type { StudioMediaImportResult } from '@ai-star-eco/types';
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from '@/canvas/types/canvas';
import { studioGenerationPending } from './studio-nodes';
import { fitStudioVideoNode } from './studio-media-fit';

export const STUDIO_VIDEO_UPLOAD_ACCEPT = 'video/mp4,.mp4';

export function validateStudioVideoUpload(file: Pick<File, 'name' | 'size'>) {
  if (!/\.mp4$/i.test(file.name)) throw new Error('请选择 MP4 视频');
  if (!file.size) throw new Error('视频文件是空的，请重新选择');
  if (file.size > 128 * 1024 * 1024) throw new Error('视频超过 128 MB，请压缩后重试');
}

/** Replace the source in place so references and template slots keep their identity. */
export function replaceStudioVideo(nodes: CanvasNodeData[], connections: CanvasConnection[], nodeId: string,
  video: StudioMediaImportResult): CanvasNodeData[] {
  const node = nodes.find(n => n.id === nodeId);
  if (!node || node.type !== CanvasNodeType.Video) throw new Error('视频节点已移出画布，请重新选择');
  if (node.metadata?.status === 'loading' || studioGenerationPending(node)) throw new Error('当前节点正在生成，请等待任务完成后再替换视频');
  if (video.mediaType !== 'video' || !video.key || !video.url) throw new Error('视频上传未完成，请重试');
  const id = `upload-${nanoid()}`, dependents = new Set([nodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of connections) if (dependents.has(edge.fromNodeId) && !dependents.has(edge.toNodeId)) {
      dependents.add(edge.toNodeId); changed = true;
    }
  }
  // The server already measured the clip: the node takes its shape now instead of waiting for the video to load.
  const shaped = (n: CanvasNodeData) => video.width && video.height ? fitStudioVideoNode(n, video.width, video.height) : n;
  return nodes.map(n => n.id === nodeId ? shaped({ ...n, metadata: { ...n.metadata,
    content: video.url, storageKey: video.key, status: 'success', errorDetails: undefined, origin: 'upload',
    mimeType: video.mimeType, bytes: video.bytes, naturalWidth: video.width, naturalHeight: video.height,
    durationMs: video.durationSec ? Math.round(video.durationSec * 1000) : undefined,
    runId: undefined, videoTaskId: undefined, primaryVideoId: id,
    videos: [...(n.metadata?.videos || []), { id, status: 'success', content: video.url,
      storageKey: video.key, mimeType: video.mimeType, seconds: String(video.durationSec || '') }],
    studio: n.metadata?.studio ? { ...n.metadata.studio, runId: undefined, request: undefined,
      task: undefined, adoption: undefined, references: [], upstreamChanged: false } : undefined,
  } }) : dependents.has(n.id) && n.metadata?.studio ? { ...n, metadata: { ...n.metadata,
    studio: { ...n.metadata.studio, upstreamChanged: true } } } : n);
}
