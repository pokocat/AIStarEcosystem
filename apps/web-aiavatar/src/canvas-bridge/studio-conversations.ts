import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { useCanvasStore } from '@/canvas/stores/canvas/use-canvas-store';
import type { CanvasConnection, CanvasNodeData } from '@/canvas/types/canvas';

const EMPTY:CanvasNodeData[]=[];
export const isStudioConversation=(n:CanvasNodeData)=>!!n.metadata?.studio?.conversation;
/** Migrate old conversation cards on load, retaining IDs, requests and output bindings. */
export function splitStudioConversations(nodes:CanvasNodeData[], history:CanvasNodeData[]=[], connections:CanvasConnection[]=[]) {
  const conversations=[...new Map([...nodes.filter(isStudioConversation),...history].map(n=>[n.id,n])).values()];
  const ids=new Set(conversations.map(n=>n.id));
  return {nodes:nodes.filter(n=>!ids.has(n.id)),assistantConversations:conversations,
    connections:connections.filter(c=>!ids.has(c.fromNodeId)&&!ids.has(c.toNodeId))};
}
export function useStudioConversations(projectId:string) {
  const conversations=useCanvasStore(s=>s.projects.find(p=>p.id===projectId)?.assistantConversations||EMPTY);
  const setConversations:Dispatch<SetStateAction<CanvasNodeData[]>>=useCallback(update=>{
    const project=useCanvasStore.getState().projects.find(p=>p.id===projectId);
    if(!project)return;
    const old=project.assistantConversations||EMPTY;
    const next=typeof update==='function'?update(old):update;
    if(next!==old)useCanvasStore.getState().updateProject(projectId,{assistantConversations:next});
  },[projectId]);
  return {conversations,setConversations};
}
