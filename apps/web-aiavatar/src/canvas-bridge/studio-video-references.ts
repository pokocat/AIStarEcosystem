import type { CanvasNodeData } from '@/canvas/types/canvas';
import type { CanvasResourceReference } from '@/canvas/lib/canvas/canvas-resource-references';

export function studioMissingVideoMention(prompt: string, bound: number): string | undefined {
  for (const match of prompt.matchAll(/[@＠]视频[^\S\r\n]*([1-9][0-9]*)/gu)) {
    if (Number(match[1]) > bound) return `@视频${match[1]}`;
  }
}

export function studioMissingVideoMessage(mention: string): string {
  return `提示词引用了 ${mention}，请添加对应的参考视频。`;
}

/** A scene's selected source takes priority over other clips. Legacy canvases can use a unique uploaded original. */
export function studioVideoMentionSource(
  prompt: string, bound: number, targetId: string | undefined, nodes: CanvasNodeData[], sceneVideoKey: string | null | undefined,
): CanvasNodeData | undefined {
  if (bound || studioMissingVideoMention(prompt, 0) !== '@视频1' || studioMissingVideoMention(prompt, 1)) return;
  const clips = nodes.filter(node => node.id !== targetId && node.type === 'video' && node.metadata?.storageKey);
  if (sceneVideoKey !== undefined) return clips.find(node => node.metadata?.storageKey === sceneVideoKey);
  const uploads = new Map(clips.filter(node => node.metadata?.origin === 'upload').map(node => [node.metadata!.storageKey, node]));
  if (uploads.size === 1) return uploads.values().next().value;
}

/** Number only the effective request inputs, in their submitted order, per media type. */
export function studioVideoPromptReferences(nodes:CanvasNodeData[], ids:string[]):CanvasResourceReference[] {
  const counts={image:0,video:0,audio:0};
  return ids.flatMap(id=>{
    const node=nodes.find(n=>n.id===id);
    if(!node||!(node.type in counts)||!node.metadata?.storageKey)return [];
    const kind=node.type as keyof typeof counts;
    return [{id:node.id,nodeId:node.id,kind,label:`@${{image:'图',video:'视频',audio:'音频'}[kind]}${++counts[kind]}`,
      title:node.title,previewUrl:kind==='image'?node.metadata.content:undefined,active:true}];
  });
}

/** A renumbered chip still names the same asset; removal must never bind it to the next asset. */
export function rebindStudioVideoMentions(prompt:string, before:CanvasResourceReference[], after:CanvasResourceReference[]) {
  const byLabel=new Map(before.map(r=>[r.label,r]));
  const byNode=new Map(after.map(r=>[r.nodeId,r.label]));
  return prompt.replace(/@(图|视频|音频)\d+(?!\d)/g,label=>{
    const reference=byLabel.get(label);
    return reference?(byNode.get(reference.nodeId)||`[已移除参考：${reference.title}]`):label;
  });
}
