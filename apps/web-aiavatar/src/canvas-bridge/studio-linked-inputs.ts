import { CanvasNodeType, type CanvasNodeData, type CanvasConnection } from '@/canvas/types/canvas';
import { makeStudioNode } from './studio-nodes';
import { placeStudioNode } from './flow-document';
import { studioScriptPrompt } from './studio-script';
import { sceneVideoPrompt } from '@/ip/scenes/scene-script-layers';

/**
 * 选填的图片位还空着（灵感库的「我的商品图」）：连线留着，但不算参考、也不挡生成，放了图才算。
 * 必填的空位仍然由 studioLinkedInputError 拦下。
 */
const studioOptionalInputEmpty=(node:CanvasNodeData)=>node.type===CanvasNodeType.Image&&node.metadata?.studio?.templateInput?.required===false&&!(node.metadata?.storageKey||node.metadata?.studio?.adoption?.storageKey);

/** Resolve document edges at submission time, including the contents of a referenced group. */
export function studioLinkedNodes(targetId:string, nodes:CanvasNodeData[], connections:CanvasConnection[]) {
  const sources=connections.filter(c=>c.toNodeId===targetId).flatMap(c=>{
    const node=nodes.find(n=>n.id===c.fromNodeId);
    return !node?[]:node.type===CanvasNodeType.Group?nodes.filter(n=>n.metadata?.groupId===node.id):[node];
  });
  return [...new Map(sources.filter(n=>n.id!==targetId&&!studioOptionalInputEmpty(n)).map(n=>[n.id,n])).values()];
}

export function studioLinkedText(node:CanvasNodeData) {
  if(node.type!==CanvasNodeType.Text)return '';
  const studio=node.metadata?.studio;
  return studio?.scriptEditor?.draft ?? studio?.scriptMarkdown ?? (studio?.script?studioScriptPrompt(studio.script,'当前剧本'):node.metadata?.content||'');
}

const withoutSpace=(text:string)=>text.replace(/\s+/g,'');

/**
 * Text edges are actual prompt inputs, not just decorations. Accepted requests keep this snapshot.
 * Text the prompt already contains is not quoted again: a script filled into the prompt and also linked went out twice,
 * and every spoken line with it (2026-11-06). The server drops such blocks by the same rule (H3PromptRewrite#withoutRepeatedQuotes).
 * 出视频时（video）连进来的编导六段脚本只发和画面有关的部分，与 AI 视频页同一个函数（scene-script-layers.ts，2026-11-10）；
 * 认不出六段结构的文字原样引用。是否重复仍按原文判断。
 */
export function withStudioLinkedText(prompt:string, targetId:string|undefined, nodes:CanvasNodeData[], connections:CanvasConnection[], excludedId?:string, video=false) {
  if(!targetId)return prompt;
  const seen=[withoutSpace(prompt)];
  const blocks=studioLinkedNodes(targetId,nodes,connections).filter(n=>n.id!==excludedId).flatMap(n=>{
    const text=studioLinkedText(n).trim();
    if(!text||seen.some(known=>known.includes(withoutSpace(text))))return [];
    seen.push(withoutSpace(text));
    return [`【引用文本：${n.title}】\n${video?sceneVideoPrompt(text):text}`];
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
      return `请为「${label}」添加或生成图片`;
    if(node.type===CanvasNodeType.Text && input) {
      const text=studioLinkedText(node).trim();
      if(input.required&&!text)return `请填写「${label}」`;
      if(text&&input.options&&!input.options.includes(text))return `「${label}」请选择：${input.options.join('、')}`;
    }
  }
  return undefined;
}
