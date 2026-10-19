import { validateStudioImageUpload } from './studio-image-file';
import { nanoid } from 'nanoid';
import type { IpSavedAsset, StudioMediaImportResult } from '@ai-star-eco/types';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import { readAssistantStory, assistantContextNodes } from './studio-assistant-context';

export const ATTACHMENT_ACCEPT = '.txt,.md,.markdown,.pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4,.mp3,.wav,.m4a';
export type InsertAssetPayload = ({ kind: 'text'; content: string; title: string } |
  { kind: 'image'; dataUrl: string; title: string; storageKey?: string } |
  { kind: 'video'; url: string; title: string; storageKey?: string; width?: number; height?: number } |
  { kind: 'audio'; url: string; title: string; storageKey?: string; mimeType?: string }) & { libraryReference?:import('@ai-star-eco/types/ip-studio-workflow').StudioNodeMetadata['libraryReference'] };

/** Shared projection for canvas assets and assistant attachments. */
export function savedAssetPayload(asset: IpSavedAsset): InsertAssetPayload {
  const libraryReference=asset.metadata?.libraryReference as InsertAssetPayload['libraryReference'];
  if (asset.kind === 'text') return { kind: 'text', content: asset.data.content, title: asset.title,libraryReference };
  if (asset.kind === 'image') return { kind: 'image', dataUrl: asset.data.dataUrl, storageKey: asset.data.storageKey, title: asset.title,libraryReference };
  if (asset.kind === 'video') return { kind: 'video', url: asset.data.url, storageKey: asset.data.storageKey, title: asset.title, width: asset.data.width, height: asset.data.height,libraryReference };
  return { kind: 'audio', url: asset.data.url, storageKey: asset.data.storageKey, title: asset.title, mimeType: asset.data.mimeType,libraryReference };
}

export function attachmentNode(payload: InsertAssetPayload, nodes: CanvasNodeData[]): CanvasNodeData {
  const media = payload.kind !== 'text';
  const existing = assistantContextNodes(nodes).find(n => n.type === payload.kind && (!payload.libraryReference||n.metadata?.studio?.libraryReference?.objectId===payload.libraryReference.objectId&&n.metadata?.studio?.libraryReference?.versionId===payload.libraryReference.versionId) && (payload.kind === 'text' ? n.metadata?.content === payload.content :
    !!payload.storageKey && n.metadata?.storageKey === payload.storageKey));
  if (existing) return existing;
  const type = { text: CanvasNodeType.Text, image: CanvasNodeType.Image, video: CanvasNodeType.Video, audio: CanvasNodeType.Audio }[payload.kind];
  const width = payload.kind === 'text' ? 480 : 360, height = payload.kind === 'audio' ? 150 : payload.kind === 'text' ? 300 : 270;
  return { id: nanoid(), type, title: payload.title, width, height,
    position: { x: Math.max(20, ...nodes.map(n => n.position.x + n.width)) + 80, y: 120 },
    metadata: { content: payload.kind === 'text' ? payload.content : payload.kind === 'image' ? payload.dataUrl : payload.url,
      storageKey: media ? payload.storageKey : undefined, status: media ? 'success' : 'idle',
      ...(payload.libraryReference?{studio:{kind:media?'ip':'text',libraryReference:payload.libraryReference}}:{}),
      ...(payload.kind === 'audio' ? { mimeType: payload.mimeType } : {}),
      ...(payload.kind === 'video' ? { naturalWidth: payload.width, naturalHeight: payload.height } : {}) } };
}

export async function readAssistantAttachment(file: File, nodes: CanvasNodeData[],
  story: (file: File) => Promise<{ text: string }>, media: (file: File, type: StudioMediaImportResult['mediaType']) => Promise<StudioMediaImportResult>) {
  if (/\.(txt|md|markdown|pdf|doc|docx)$/i.test(file.name)) return readAssistantStory(file, nodes, story);
  const type = /\.(jpg|jpeg|png)$/i.test(file.name) ? 'image' : /\.mp4$/i.test(file.name) ? 'video' : /\.(mp3|wav|m4a)$/i.test(file.name) ? 'audio' : undefined;
  if (!type) throw new Error('不支持这个文件格式，请选择图片、MP4、音频或故事文件');
  if (type === 'image') validateStudioImageUpload(file);
  else if (file.size > (type === 'video' ? 128 : 25) * 1024 * 1024) throw new Error('视频最多 128 MB，音频最多 25 MB，请压缩后重试');
  const result = await media(file, type);
  const node = attachmentNode(type === 'image' ? { kind: 'image', dataUrl: result.url, storageKey: result.key, title: result.fileName } :
    { kind: type, url: result.url, storageKey: result.key, title: result.fileName, width: result.width, height: result.height, mimeType: result.mimeType }, nodes);
  return { ...node, metadata: { ...node.metadata, mimeType: result.mimeType, bytes: result.bytes,
    naturalWidth: result.width, naturalHeight: result.height, durationMs: result.durationSec ? Math.round(result.durationSec * 1000) : undefined } };
}
