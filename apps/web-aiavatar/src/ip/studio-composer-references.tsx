"use client";
import { useEffect, useRef, useState } from "react";
import { Popover } from "antd";
import { Check, Film, ImagePlus, Music2, Plus, X } from "lucide-react";
import type { CanvasNodeData } from "@/canvas/types/canvas";
import { CanvasNodeType } from "@/canvas/types/canvas";
import type { VideoStudioModeSpec } from "@ai-star-eco/types/video-studio";
import type { StudioVideoDraft } from "@/canvas-bridge/studio-video";
import { SignedImage } from "@/canvas-bridge/signed-image";
import { studioVideoPromptReferences } from "@/canvas-bridge/studio-video-references";

function ReferenceVisual({node}:{node:CanvasNodeData}) {
  return node.type===CanvasNodeType.Image&&node.metadata?.content?<SignedImage src={node.metadata.content} storageKey={node.metadata.storageKey} alt=""/>:node.type===CanvasNodeType.Video?<Film size={22}/>:node.type===CanvasNodeType.Audio?<Music2 size={22}/>:<ImagePlus size={22}/>;
}
export function StudioReferencePicker({nodes,ids,onChange,accepts,picking,onCanvasPick,openRequest=0}:{nodes:CanvasNodeData[];ids:string[];onChange:(ids:string[])=>void;accepts:(ids:string[])=>boolean;picking:boolean;onCanvasPick:()=>void;openRequest?:number}) {
  const [open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
  const priorOpenRequest=useRef(openRequest);
  useEffect(()=>{if(openRequest!==priorOpenRequest.current){priorOpenRequest.current=openRequest;if(openRequest)setOpen(true);}},[openRequest]);
  const close=()=>{setOpen(false);trigger.current?.focus();};
  useEffect(()=>{if(!open)return;const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}};window.addEventListener('keydown',escape,true);return()=>window.removeEventListener('keydown',escape,true);},[open]);
  const usable=nodes.filter(n=>n.metadata?.storageKey&&[CanvasNodeType.Image,CanvasNodeType.Video,CanvasNodeType.Audio].includes(n.type as CanvasNodeType));
  return <Popover trigger="click" placement="topLeft" arrow={false} open={open} onOpenChange={visible=>setOpen(!picking&&visible)} destroyOnHidden afterOpenChange={visible=>{if(visible)(panel.current?.querySelector<HTMLButtonElement>('[role="checkbox"][aria-checked="true"]')||panel.current?.querySelector<HTMLButtonElement>('[role="checkbox"]:not(:disabled)')||panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus();}}
    getPopupContainer={trigger=>trigger.closest<HTMLElement>('.ip-surface')||document.body} classNames={{root:'studio-reference-overlay'}}
    content={<div ref={panel} className="studio-reference-picker" role="region" aria-label="选择参考素材">
      <header><strong>画布素材</strong><button type="button" aria-label="关闭素材选择" onClick={close}><X size={15}/></button></header>
      <div className="studio-reference-options">{usable.map(node=>{const selected=ids.includes(node.id),next=selected?ids.filter(id=>id!==node.id):[...ids,node.id];return <button type="button" role="checkbox" aria-checked={selected} disabled={!selected&&!accepts(next)} key={node.id} onClick={()=>onChange(next)}>
        <span className="studio-reference-option-image"><ReferenceVisual node={node}/></span><span>{node.title}</span>{selected&&<Check size={15}/>}</button>;})}
        {!usable.length&&<p>画布还没有素材，请先上传图片、视频或音频。</p>}</div>
      <button type="button" className="studio-canvas-reference-action" onClick={()=>{setOpen(false);onCanvasPick();}}>{picking?'完成参考选择':'在画布中选择'}</button>
    </div>}>
    <button ref={trigger} type="button" className="studio-reference-add" aria-label={picking?'完成参考选择':'参考'} aria-expanded={open} onClick={()=>{if(picking)onCanvasPick();}}><Plus size={15}/>{picking?'完成选择':'参考'}</button>
  </Popover>;
}
export function StudioReferenceStrip({nodes,ids,draft,spec,onRemove}:{nodes:CanvasNodeData[];ids:string[];draft:StudioVideoDraft;spec?:VideoStudioModeSpec;onRemove:(id:string)=>void}) {
  const references=studioVideoPromptReferences(nodes,ids);
  if(!ids.length)return null;
  return <div className="studio-reference-strip" aria-label="已选参考素材">{ids.map((id,index)=>{const node=nodes.find(n=>n.id===id);if(!node)return null;
    const label=spec?.needsFirstFrame&&draft.firstId===id?'首帧':spec?.needsLastFrame&&draft.lastId===id?'尾帧':references.find(ref=>ref.nodeId===id)?.label||'待补充';
    return <div className="studio-reference-tile" key={id} title={`${label} · ${node.title}`}>
      <ReferenceVisual node={node}/><span className="studio-reference-number">{index+1}</span><span className="studio-reference-role">{label}</span>
      <button type="button" aria-label={`移除参考 ${node.title}`} onClick={()=>onRemove(id)}><X size={12}/></button>
    </div>;
  })}</div>;
}
