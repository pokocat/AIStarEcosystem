import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from '@/canvas/types/canvas';
import { studioTaskLabel } from './studio-task-status';
import type { StudioShot } from '@ai-star-eco/types/ip-studio-workflow';
import { markStudioDescendants } from './studio-script';

/** LibTV's storyboard is a typed view of all canvas nodes, including empty drafts. */
export function studioStoryboardGroups(nodes: CanvasNodeData[]) {
  const types = [CanvasNodeType.Text, CanvasNodeType.Image, CanvasNodeType.Video, CanvasNodeType.Audio];
  const labels = ['文本', '图片', '视频', '音频'];
  const groups = types.map((type, index) => ({ type: String(type), label: labels[index], nodes: nodes.filter(n => n.type === type) }));
  const other = nodes.filter(n => !types.includes(n.type as CanvasNodeType));
  return [...groups.filter(g => g.type !== CanvasNodeType.Audio || g.nodes.length),
    ...(other.length ? [{ type: 'other', label: '其他节点', nodes: other }] : [])];
}

/** Relationships come from canvas edges; removing a link removes its storyboard projection. */
export function studioStoryboardLinks(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
  const incoming = new Set(connections.filter(c => c.toNodeId === nodeId).map(c => c.fromNodeId));
  const outgoing = new Set(connections.filter(c => c.fromNodeId === nodeId).map(c => c.toNodeId));
  return { incoming: nodes.filter(n => incoming.has(n.id)), outgoing: nodes.filter(n => outgoing.has(n.id)) };
}

export function studioStoryboardStatus(node: CanvasNodeData) {
  if (node.metadata?.status === 'loading') return studioTaskLabel(node.metadata.studio?.task, true);
  if (node.metadata?.status === 'error') return '生成失败';
  if (node.metadata?.storageKey || node.metadata?.content?.trim() || node.metadata?.studio?.script) return '已就绪';
  return '待创作';
}

/** Preserve existing shot fields and outputs while edits notify their linked descendants. */
export function updateStudioStoryboardShot(nodes: CanvasNodeData[], connections: CanvasConnection[], id: string, changes: Partial<StudioShot>) {
  const shot = nodes.find(n => n.id === id)?.metadata?.studio?.shot;
  if (!shot || Object.entries(changes).every(([key, value]) => shot[key as keyof StudioShot] === value)) return nodes;
  const downstream = new Set([id]);
  for (const parent of downstream) for (const edge of connections) if (edge.fromNodeId === parent) downstream.add(edge.toNodeId);
  return markStudioDescendants(nodes, id).map(n => n.id === id
    ? { ...n, metadata: { ...n.metadata, ...('description' in changes ? { prompt: changes.description } : {}),
      studio: { ...n.metadata!.studio!, shot: { ...shot, ...changes } } } }
    : downstream.has(n.id) ? { ...n, metadata: { ...n.metadata, studio: { kind: 'shot' as const, ...n.metadata?.studio, upstreamChanged: true } } } : n);
}
