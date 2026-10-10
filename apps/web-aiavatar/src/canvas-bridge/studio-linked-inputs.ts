import { CanvasNodeType, type CanvasNodeData, type CanvasConnection } from '@/canvas/types/canvas';
import { makeStudioNode } from './studio-nodes';
import { placeStudioNode } from './flow-document';
import { studioScriptPrompt } from './studio-script';

/** Resolve document edges at submission time, including the contents of a referenced group. */
export function studioLinkedNodes(targetId:string, nodes:CanvasNodeData[], connections:CanvasConnection[]) {
  const sources=connections.filter(c=>c.toNodeId===targetId).flatMap(c=>{
    const node=nodes.find(n=>n.id===c.fromNodeId);
    return !node?[]:node.type===CanvasNodeType.Group?nodes.filter(n=>n.metadata?.groupId===node.id):[node];
  });
  return [...new Map(sources.filter(n=>n.id!==targetId).map(n=>[n.id,n])).values()];
}

export function studioLinkedText(node:CanvasNodeData) {
  if(node.type!==CanvasNodeType.Text)return '';
  const studio=node.metadata?.studio;
  return studio?.scriptEditor?.draft ?? studio?.scriptMarkdown ?? (studio?.script?studioScriptPrompt(studio.script,'当前剧本'):node.metadata?.content||'');
}

/** Text edges are actual prompt inputs, not just decorations. Accepted requests keep this snapshot. */
export function withStudioLinkedText(prompt:string, targetId:string|undefined, nodes:CanvasNodeData[], connections:CanvasConnection[], excludedId?:string) {
  if(!targetId)return prompt;
  const blocks=studioLinkedNodes(targetId,nodes,connections).filter(n=>n.id!==excludedId).flatMap(n=>{
    const text=studioLinkedText(n).trim();return text?[`【引用文本：${n.title}】\n${text}`]:[];
  });
  return blocks.length?`${prompt.trim()}\n\n${blocks.join('\n\n')}`:prompt;
}

export function createStudioLinkedNode(sourceId:string, type:CanvasNodeType.Image|CanvasNodeType.Video|CanvasNodeType.Text,
  position:{x:number;y:number}, nodes:CanvasNodeData[]) {
  const source=nodes.find(n=>n.id===sourceId);if(!source)return undefined;
  const operation=type===CanvasNodeType.Text?'script':type===CanvasNodeType.Video?'video':'image';
  const node=makeStudioNode(operation,source);node.title=type===CanvasNodeType.Text?'文本':type===CanvasNodeType.Video?'视频':'图片';
  node.position=position;
  return {node:placeStudioNode(node,nodes),operation};
}

/** A connected empty reference must not silently turn image-to-image/video into an unrelated generation. */
export function studioLinkedInputError(targetId:string|undefined, nodes:CanvasNodeData[], connections:CanvasConnection[]) {
  if(!targetId)return undefined;
  for(const node of studioLinkedNodes(targetId,nodes,connections)) {
    const input=node.metadata?.studio?.templateInput, label=input?.label||node.title;
    if(node.type===CanvasNodeType.Image && !(node.metadata?.storageKey||node.metadata?.studio?.adoption?.storageKey))
      return `请先为「${label}」添加或生成图片`;
    if(node.type===CanvasNodeType.Text && input) {
      const text=studioLinkedText(node).trim();
      if(input.required&&!text)return `请先填写「${label}」`;
      if(text&&input.options&&!input.options.includes(text))return `「${label}」请选择：${input.options.join('、')}`;
    }
  }
  return undefined;
}
