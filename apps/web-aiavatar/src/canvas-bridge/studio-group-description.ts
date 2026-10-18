import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';

// Reserve a fixed three-line preview above members; editing never moves their media or edges.
export const GROUP_DESCRIPTION_SPACE = 88;
export function describeStudioGroup(nodes: CanvasNodeData[], id: string, description: string): CanvasNodeData[] {
  const value = description.trim();
  return nodes.map(node => {
    if (node.id !== id || node.type !== CanvasNodeType.Group || (node.metadata?.groupDescription || '') === value) return node;
    const extra = (value ? GROUP_DESCRIPTION_SPACE : 0) - (node.metadata?.groupDescription ? GROUP_DESCRIPTION_SPACE : 0);
    return { ...node, position: { ...node.position, y: node.position.y - extra }, height: node.height + extra,
      metadata: { ...node.metadata, groupDescription: value || undefined } };
  });
}
