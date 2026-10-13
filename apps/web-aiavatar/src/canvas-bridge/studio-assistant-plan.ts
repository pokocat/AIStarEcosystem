import type { StudioPlan, StudioPlanStep } from '@ai-star-eco/types/ip-studio-workflow';
import { scriptToMarkdown, markdownToScript, scriptMarkdownError } from './studio-script-markdown';
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

export type AssistantEditField='content'|'prompt'|'script';
export type AssistantReplacement={id:string;content:string;field?:AssistantEditField};
export function assistantEditableFields(node:CanvasNodeData):AssistantEditField[] {
  if(node.metadata?.status==='loading'||node.metadata?.studio?.conversation||node.metadata?.studio?.kind==='batch'||node.metadata?.studio?.scriptEditor?.pending||node.type===CanvasNodeType.Group||node.type===CanvasNodeType.Config)return [];
  return [...(assistantWritableText(node)?['content' as const]:node.metadata?.studio?.script?['script' as const]:[]),'prompt'];
}
export function assistantFieldValue(node:CanvasNodeData,field:AssistantEditField):string {
  return field==='script'?(node.metadata?.studio?.scriptEditor?.draft??scriptToMarkdown(node.metadata!.studio!.script!)):
    field==='prompt'?(node.metadata?.studio?.composerDraft?.prompt??node.metadata?.prompt??node.metadata?.studio?.shot?.description??''):(node.metadata?.content||'');
}
export function assistantReplacementNode(node:CanvasNodeData,field:AssistantEditField,value:string):CanvasNodeData {
  if(!assistantEditableFields(node).includes(field))throw new Error('目标节点正在生成或不可编辑，请稍后重新选择');
  const metadata={...node.metadata};
  if(field==='content')metadata.content=value;
  else if(field==='script') {
    const error=scriptMarkdownError(value);if(error)throw new Error(error);
    const studio=metadata.studio!;
    metadata.studio={...studio,scriptMarkdown:value,script:markdownToScript(value,studio.script),scriptEditor:{...studio.scriptEditor,turns:studio.scriptEditor?.turns||[],draft:value,proposal:undefined,error:undefined}};
  } else {
    metadata.prompt=value;
    if(metadata.studio)metadata.studio={...metadata.studio,
      ...(metadata.studio.composerDraft?{composerDraft:{...metadata.studio.composerDraft,prompt:value}}:{}),
      ...(metadata.studio.shot?{shot:{...metadata.studio.shot,description:value}}:{}),
      ...(node.type===CanvasNodeType.Audio&&metadata.studio.speechDraft?{speechDraft:{...metadata.studio.speechDraft,text:value}}:{})};
  }
  return {...node,metadata};
}
