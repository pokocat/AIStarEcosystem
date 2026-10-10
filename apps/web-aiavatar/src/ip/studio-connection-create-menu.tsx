'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getBezierPath, Position } from '@xyflow/react';
import { FileText, ImagePlus, Video, X } from 'lucide-react';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';

export type PendingStudioConnection={sourceId:string;screen:{x:number;y:number};position:{x:number;y:number}};
export function StudioConnectionCreateMenu({pending,source,viewport,onCreate,onClose}:{pending:PendingStudioConnection;source:CanvasNodeData;
  viewport:{x:number;y:number;zoom:number};onCreate:(type:CanvasNodeType.Text|CanvasNodeType.Image|CanvasNodeType.Video)=>void;onClose:()=>void}) {
  const ref=useRef<HTMLElement>(null),[position,setPosition]=useState({left:0,top:0});
  useLayoutEffect(()=>{
    const menu=ref.current,stage=menu?.parentElement;if(!menu||!stage)return;
    const place=()=>{
      const rect=stage.getBoundingClientRect();
      setPosition({left:Math.max(76,Math.min(pending.screen.x-rect.left,rect.width-menu.offsetWidth-16)),
        top:Math.max(72,Math.min(pending.screen.y-rect.top,rect.height-menu.offsetHeight-68))});
    };
    place();const observer=new ResizeObserver(place);observer.observe(stage);observer.observe(menu);
    return()=>observer.disconnect();
  },[pending]);
  useEffect(()=>{
    ref.current?.querySelector<HTMLButtonElement>('[data-create-reference]')?.focus();
    const outside=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))onClose();};
    document.addEventListener('pointerdown',outside,true);return()=>document.removeEventListener('pointerdown',outside,true);
  },[onClose]);
  const [path]=getBezierPath({sourceX:(source.position.x+source.width)*viewport.zoom+viewport.x,
    sourceY:(source.position.y+source.height/2)*viewport.zoom+viewport.y,sourcePosition:Position.Right,
    targetX:position.left,targetY:position.top+24,targetPosition:Position.Left});
  return <>
    <svg className="studio-flow-pending-line" aria-hidden="true"><path d={path}/></svg>
    <section ref={ref} className="studio-flow-reference-menu" role="dialog" aria-label="引用该节点生成" style={position}
      onPointerDown={event=>event.stopPropagation()} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();onClose();}}}>
      <header><span>引用该节点生成</span><button aria-label="取消连线引用" onClick={onClose}><X size={16}/></button></header>
      {[{type:CanvasNodeType.Text,label:'文本',Icon:FileText},{type:CanvasNodeType.Image,label:'图片',Icon:ImagePlus},{type:CanvasNodeType.Video,label:'视频',Icon:Video}].map(({type,label,Icon})=>
        <button key={type} data-create-reference type="button" onClick={()=>onCreate(type as CanvasNodeType.Text|CanvasNodeType.Image|CanvasNodeType.Video)}><Icon size={20}/><span>{label}</span></button>)}
    </section>
  </>;
}
