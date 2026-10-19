import type { StudioRecreationReport } from '@ai-star-eco/types/ip-studio-workflow';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { CanvasNodeType } from '@/canvas/types/canvas';
import { makeStudioNode } from './studio-nodes';

export const recreationPrompt='请分析参考视频的全片创作：创意命题、视觉基因、反复出现的画面元素、复刻保留要点、创作骨架和核心手法。区分画面事实与创作解读，并提供可编辑的复刻创作建议词。';
export function recreationNode(source:CanvasNodeData):CanvasNodeData {
  const node=makeStudioNode('recreation',source);
  return {...node,width:720,height:1900,title:`${source.title} · 全片创作拆解`,metadata:{...node.metadata,studio:{kind:'recreation',
    recreation:{sourceNodeId:source.id,sourceStorageKey:source.metadata!.storageKey!,sourceTitle:source.title}}}};
}
export function recreationSource(node:CanvasNodeData|undefined,nodes:CanvasNodeData[]) {
  if(node?.type===CanvasNodeType.Video&&node.metadata?.storageKey)return node;
  const source=node?.metadata?.studio?.recreation;
  return source?nodes.find(n=>n.id===source.sourceNodeId&&n.metadata?.storageKey===source.sourceStorageKey):undefined;
}
export function recreationText(report:StudioRecreationReport) {
  return `参考片创作拆解：${report.creativePremise}\n\n复刻创作建议词：\n${report.recreationPrompt}\n\n建议保留：\n${report.retain.map(x=>'- '+x).join('\n')}\n\n请据此改编创作，可替换主体和场景。`;
}
