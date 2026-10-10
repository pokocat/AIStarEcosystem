import { nanoid } from 'nanoid';
import type { Node, NodeChange, Edge, EdgeChange } from '@xyflow/react';
import { CanvasNodeType, type CanvasNodeData, type CanvasConnection } from '@/canvas/types/canvas';
import { studioGenerationPending } from './studio-nodes';

export type StudioFlowNode = Node<{ document: CanvasNodeData; readOnly?: boolean; onInspect?: (node:CanvasNodeData)=>void }, 'studio'>;
export function flowNodes(nodes: CanvasNodeData[], selected: Set<string>): StudioFlowNode[] {
  return nodes.map(document => ({ id: document.id, type: 'studio', position: document.position,
    width: document.width, height: document.height, style: { width: document.width, height: document.height },
    dragHandle: '.studio-flow-drag', zIndex: document.type === CanvasNodeType.Group ? -1 : 0,
    selected: selected.has(document.id), data: { document } }));
}
/** React Flow is an interaction projection; saved documents keep the existing wire shape. */
export function changeFlowNodes(nodes: CanvasNodeData[], changes: NodeChange<StudioFlowNode>[]): CanvasNodeData[] {
  let next = nodes;
  for (const change of changes) {
    if (change.type === 'position' && change.position) {
      const source = next.find(n => n.id === change.id);
      const dx = change.position.x - (source?.position.x || 0), dy = change.position.y - (source?.position.y || 0);
      // Documents use absolute positions. A group drag moves members once, even in a multi-selection.
      const directlyMoved = new Set(changes.filter(c => c.type === 'position').map(c => c.id));
      next = next.map(n => n.id === change.id ? { ...n, position: change.position! }
        : source?.type === CanvasNodeType.Group && n.metadata?.groupId === source.id && !directlyMoved.has(n.id)
          ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n);
    }
    if (change.type === 'dimensions' && change.dimensions && change.setAttributes) next = next.map(n => n.id === change.id ? { ...n, width: change.dimensions!.width, height: change.dimensions!.height } : n);
    if (change.type === 'remove') next = next.filter(n => n.id !== change.id || studioGenerationPending(n));
  }
  return next;
}
export const flowEdges = (connections: CanvasConnection[]): Edge[] => connections.map(c => ({ id: c.id, source: c.fromNodeId, target: c.toNodeId, type: 'default' }));
/** Automatic additions keep the preferred row and move past occupied cards; manual drags stay free. */
export function placeStudioNode(node:CanvasNodeData,existing:CanvasNodeData[],gap=48):CanvasNodeData {
  let x=node.position.x;
  for(let i=0;i<=existing.length;i++) {
    const occupied=existing.filter(n=>n.id!==node.id && x<n.position.x+n.width+gap && x+node.width+gap>n.position.x
      && node.position.y<n.position.y+n.height+gap && node.position.y+node.height+gap>n.position.y);
    if(!occupied.length)return x===node.position.x?node:{...node,position:{...node.position,x}};
    x=Math.max(...occupied.map(n=>n.position.x+n.width+gap));
  }
  return {...node,position:{...node.position,x}};
}
export function changeFlowEdges(connections: CanvasConnection[], changes: EdgeChange[]): CanvasConnection[] {
  const removed = new Set(changes.filter(c => c.type === 'remove').map(c => c.id));
  return removed.size ? connections.filter(c => !removed.has(c.id)) : connections;
}
/** A copy is a new draft: it must never claim or resume the source's accepted task. */
export function copyFlowSelection(nodes: CanvasNodeData[], connections: CanvasConnection[], ids: Set<string>, destinationIds=new Set(nodes.map(n=>n.id))) {
  const groups = new Set(nodes.filter(n => ids.has(n.id) && n.type === CanvasNodeType.Group).map(n => n.id));
  const idMap = new Map(nodes.filter(n => (ids.has(n.id) || groups.has(n.metadata?.groupId || '')) && !studioGenerationPending(n)).map(n => [n.id, nanoid()]));
  const copied = nodes.filter(n => idMap.has(n.id)).map(n => {
    const clone = structuredClone(n); clone.id = idMap.get(n.id)!;
    clone.position = { x: n.position.x + 48, y: n.position.y + 48 };
    if (clone.metadata) {
      delete clone.metadata.runId; delete clone.metadata.videoTaskId;
      delete clone.metadata.templateStepId;
      clone.metadata.groupId = idMap.get(n.metadata?.groupId || '');
      if (clone.metadata.studio) {
        if(clone.metadata.studio.composerDraft) {
          const draft=clone.metadata.studio.composerDraft;
          draft.referenceNodeIds=draft.referenceNodeIds.map(id=>idMap.get(id)||id);
          if(draft.scriptSourceNodeId)draft.scriptSourceNodeId=idMap.get(draft.scriptSourceNodeId)||draft.scriptSourceNodeId;
          if(draft.connectedReferenceNodeIds)draft.connectedReferenceNodeIds=draft.connectedReferenceNodeIds.map(id=>idMap.get(id)||id);
          if(draft.video.firstId)draft.video.firstId=idMap.get(draft.video.firstId)||draft.video.firstId;
          if(draft.video.lastId)draft.video.lastId=idMap.get(draft.video.lastId)||draft.video.lastId;
        }
        if(clone.metadata.studio.scriptSourceNodeId)clone.metadata.studio.scriptSourceNodeId=idMap.get(clone.metadata.studio.scriptSourceNodeId)||clone.metadata.studio.scriptSourceNodeId;
        delete clone.metadata.studio.runId; delete clone.metadata.studio.request;
        delete clone.metadata.studio.speechRequest; delete clone.metadata.studio.lipSyncRequest;
        if(clone.metadata.studio.scriptEditor) {
          delete clone.metadata.studio.scriptEditor.pending;
          delete clone.metadata.studio.scriptEditor.proposal;
          delete clone.metadata.studio.scriptEditor.error;
        }
        delete clone.metadata.studio.batch; delete clone.metadata.studioStart;
        delete clone.metadata.studio.templateAccepted;
        clone.metadata.studio.parentNodeId = idMap.get(clone.metadata.studio.parentNodeId || '');
      }
    }
    return clone;
  });
  // Preserve a copied node's upstream references when those nodes exist in the destination canvas.
  return { nodes: copied, connections: connections.filter(c => idMap.has(c.toNodeId) && (idMap.has(c.fromNodeId)||destinationIds.has(c.fromNodeId)))
    .map(c => ({ id: nanoid(), fromNodeId: idMap.get(c.fromNodeId)||c.fromNodeId, toNodeId: idMap.get(c.toNodeId)! })) };
}

/** Arrange top-level items without breaking group membership or touching accepted inputs/media. */
export function arrangeFlowNodes(nodes: CanvasNodeData[], ids?: Set<string>): CanvasNodeData[] {
  const items = nodes.filter(n => !n.metadata?.groupId && (!ids || ids.has(n.id)));
  if (!items.length) return nodes;
  const columns = Math.min(3, Math.ceil(Math.sqrt(items.length))), moves = new Map<string, { x: number; y: number }>();
  let x = Math.min(...items.map(n => n.position.x)), y = Math.min(...items.map(n => n.position.y));
  const left = x; let rowHeight = 0;
  items.forEach((n, index) => {
    moves.set(n.id, { x, y }); rowHeight = Math.max(rowHeight, n.height);
    x += n.width + 80;
    if ((index + 1) % columns === 0) { x = left; y += rowHeight + 80; rowHeight = 0; }
  });
  return nodes.map(n => {
    const own = moves.get(n.id); if (own) return { ...n, position: own };
    const parent = nodes.find(p => p.id === n.metadata?.groupId), target = parent && moves.get(parent.id);
    return parent && target ? { ...n, position: { x: n.position.x + target.x - parent.position.x, y: n.position.y + target.y - parent.position.y } } : n;
  });
}
