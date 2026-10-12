"use client";
import { useState } from 'react';
import { Input } from 'antd';
import type { CanvasNodeData } from '@/canvas/types/canvas';
export function StudioAssetMentionInput({value,onChange,onLibraryRequest,onCanvasReference,nodes,placeholder}: {value:string;onChange:(v:string)=>void;onLibraryRequest:(query:string)=>void;onCanvasReference:(id:string)=>void;nodes:CanvasNodeData[];placeholder:string}) {
  const [mention,setMention]=useState<{query:string;start:number;end:number}>();
  const matches=mention?nodes.filter(n=>n.title.includes(mention.query)&&n.metadata?.storageKey).slice(0,5):[];
  return <div><Input.TextArea aria-label="创作要求" placeholder={placeholder} value={value} autoSize={{minRows:3,maxRows:7}} maxLength={16000} onChange={e=>{onChange(e.target.value);const before=e.target.value.slice(0,e.target.selectionStart),m=/@([^\s@]*)$/.exec(before);setMention(m?{query:m[1],start:m.index,end:before.length}:undefined);}} onKeyDown={e=>{if(e.key==='Escape')setMention(undefined);}}/>{mention&&<div className="studio-assistant-mentions" aria-label="可引用资产">{matches.map(n=><button key={n.id} type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>{onCanvasReference(n.id);onChange(value.slice(0,mention.start)+'@'+n.title+value.slice(mention.end));setMention(undefined);}}>{n.title} · 当前画布</button>)}<button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>{onLibraryRequest(mention.query);setMention(undefined);}}>从个人资产库选择</button></div>}</div>;
}
