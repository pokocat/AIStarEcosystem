import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';

/** All canvas entry points resolve business nodes before their generic media type. */
export function studioNodeCommand(node: CanvasNodeData, expanded = false): string | undefined {
  const studio = node.metadata?.studio;
  if (node.type === CanvasNodeType.Group) return;
  if (studio?.kind === 'assistant' || studio?.conversation) return 'assistant';
  if (studio?.kind === 'batch' || studio?.batch) return 'batch';
  if (studio?.kind === 'work' || studio?.workDraft) return 'work';
  if (studio?.script) return expanded ? 'editor' : 'script-preview';
  if (studio?.kind === 'script') return 'editor';
  if (node.type === CanvasNodeType.Text) return 'edit-text';
  if (node.type === CanvasNodeType.Image) return 'image';
  if (node.type === CanvasNodeType.Video) return 'video';
  if (node.type === CanvasNodeType.Audio) return 'speech';
}
