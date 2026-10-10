import type { CanvasNodeData } from '@/canvas/types/canvas';
import type { CanvasResourceReference } from '@/canvas/lib/canvas/canvas-resource-references';

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
