import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { StudioTemplateExecution } from '@ai-star-eco/types';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { applyStudioRun, selectStudioTake } from './studio-nodes';

export function projectTemplateResults(nodes:CanvasNodeData[],execution:StudioTemplateExecution):CanvasNodeData[] {
  return nodes.map(node=>{
    const step=execution.steps.find(s=>s.nodeId===node.id);if(!step?.run)return node;
    const assetRole=step.outputRole==='video'?undefined:step.outputRole==='custom'?'look':step.outputRole;
    const expectedStatus=step.run.status==='running'?'loading':step.run.status==='failed'?'error':'success';
    if(node.metadata?.studio?.runId===step.run.id&&node.metadata.status===expectedStatus&&
      (!step.storageKey||node.metadata.storageKey===step.storageKey)&&
      !!node.metadata.studio.upstreamChanged===(step.status==='stale')&&
      node.metadata.studio.libraryAssetRole===assetRole&&
      node.metadata.studio.templateAccepted===step.accepted&&
      JSON.stringify(node.metadata.studio.task)===JSON.stringify({status:step.run.status,stage:step.run.stage,pct:step.run.pct,errorCode:step.run.errorCode,queue:step.run.status==='running'?step.run.queue:null})&&
      JSON.stringify(node.metadata.studio.adoption)===JSON.stringify(step.adoption))return node;
    let changed=applyStudioRun(node,step.run);
    if(step.storageKey) {
      const index=step.operation==='video'||step.outputRole==='video'?step.run.output.videoCandidates?.findIndex(c=>c.storageKey===step.storageKey)??-1:step.run.output.candidates?.findIndex(c=>c.key===step.storageKey)??-1;
      if(index>=0)changed=selectStudioTake(changed,index===0?step.run.id:`${step.run.id}:${index}`);
    }
    changed.metadata={...changed.metadata,studio:{...changed.metadata?.studio!,upstreamChanged:step.status==='stale',adoption:step.adoption,libraryAssetRole:assetRole,templateAccepted:step.accepted}};
    return changed;
  });
}
export function emitTemplateResults(projectId:string,execution:StudioTemplateExecution) {
  window.dispatchEvent(new CustomEvent('studio-template-results',{detail:{projectId,execution}}));
}
/** Canvas owns its document. The server only supplies authoritative job results and acceptance. */
export function useTemplateProjection(projectId:string,setNodes:Dispatch<SetStateAction<CanvasNodeData[]>>) {
  useEffect(()=>{
    const listener=(event:Event)=>{
      const detail=(event as CustomEvent<{projectId:string;execution:StudioTemplateExecution}>).detail;
      if(detail.projectId===projectId)setNodes(nodes=>projectTemplateResults(nodes,detail.execution));
    };
    window.addEventListener('studio-template-results',listener);return()=>window.removeEventListener('studio-template-results',listener);
  },[projectId,setNodes]);
}
