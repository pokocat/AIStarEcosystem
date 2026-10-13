import type { StudioPlan, StudioPlanStep } from '@ai-star-eco/types/ip-studio-workflow';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';

export function assistantOutputReady(node:CanvasNodeData|undefined) {
  return !!node&&node.metadata?.status!=='loading'&&node.metadata?.status!=='error'&&
    (node.type===CanvasNodeType.Text?!!node.metadata?.content?.trim()||!!node.metadata?.studio?.script:!!node.metadata?.storageKey);
}

export function assistantStepReferences(step:StudioPlanStep, plan:StudioPlan, nodes:CanvasNodeData[]) {
  const waiting:string[]=[];
  const ids=step.referenceNodeIds.filter(id=>{
    if(nodes.some(n=>n.id===id))return true;
    waiting.push('已删除的参考节点');return false;
  });
  for(const id of step.dependsOn||[]) {
    const previous=plan.steps.find(s=>s.id===id);
    const node=nodes.find(n=>n.id===previous?.resultNodeId);
    if(node&&assistantOutputReady(node))ids.push(node.id);else waiting.push(previous?.title||'前置内容');
  }
  return {ids:[...new Set(ids)],waiting};
}

/** Only ordinary editable text is a replacement target; structured scripts retain their editor. */
export function assistantWritableText(node:CanvasNodeData) {
  return node.type===CanvasNodeType.Text&&node.metadata?.status!=='loading'&&
    !node.metadata?.studio?.conversation&&!node.metadata?.studio?.script&&
    (!node.metadata?.studio?.kind||node.metadata.studio.kind==='text');
}

/** Older model plans sometimes repeat an explicit dependency in their missing-reference list. */
export function assistantUnresolvedReferences(step:StudioPlanStep,plan:StudioPlan) {
  const previous=new Set(plan.steps.slice(0,plan.steps.findIndex(s=>s.id===step.id)).map(s=>s.id));
  return (step.unresolvedReferences||[]).filter(id=>!previous.has(id)||!step.dependsOn?.includes(id));
}
