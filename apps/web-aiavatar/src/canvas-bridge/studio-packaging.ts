import type { StudioPackaging, StudioWorkDraft } from "@ai-star-eco/types/ip-studio-workflow";
import { CanvasNodeType, type CanvasNodeData } from "@/canvas/types/canvas";
import { placeStudioNode } from "./flow-document";

export function studioWorkDraft(nodes:CanvasNodeData[],episodeNo?:number):StudioWorkDraft {
  const draft=nodes.find(n=>n.metadata?.studio?.workDraft&&n.metadata.studio.episodeNo===episodeNo)?.metadata?.studio?.workDraft;
  if(draft)return draft;
  // Existing projects resume the most recently authored assembly settings without mutating its request.
  const request=[...nodes].reverse().find(n=>n.metadata?.studio?.kind==='work'&&n.metadata.studio.episodeNo===episodeNo&&n.metadata.studio.request?.operation==='assemble')?.metadata?.studio?.request;
  const p=request?.packaging;
  return {aspectRatio:request?.aspectRatio||'9:16',packagingEnabled:!!(p?.brand||p?.title||p?.cta||p?.captions?.length),
    brand:p?.brand||'',title:p?.title||'',cta:p?.cta||'',captionText:p?.captions?.map(c=>`${c.start}-${c.end}: ${c.text}`).join('\n')||'',voiceoverStorageKey:p?.voiceoverStorageKey};
}

export function updateStudioWorkDraft(nodes:CanvasNodeData[],changes:Partial<StudioWorkDraft>,id:string,episodeNo?:number):CanvasNodeData[] {
  const existing=nodes.find(n=>n.metadata?.studio?.workDraft&&n.metadata.studio.episodeNo===episodeNo);
  const draft={...studioWorkDraft(nodes,episodeNo),...changes};
  const content=[draft.title||'待填写作品标题',draft.brand,draft.captionText?'已填写字幕':'',draft.voiceoverStorageKey?'已选择配音':'保留片段原音轨'].filter(Boolean).join('\n');
  if(existing)return nodes.map(n=>n.id===existing.id?{...n,metadata:{...n.metadata,content,studio:{...n.metadata!.studio!,workDraft:draft}}}:n);
  const node:CanvasNodeData={id,type:CanvasNodeType.Text,title:episodeNo?`第 ${episodeNo} 集成片方案`:'成片方案',width:360,height:230,
    position:{x:100,y:100},metadata:{status:'idle',content,studio:{kind:'work',episodeNo,workDraft:draft}}};
  return [...nodes,placeStudioNode(node,nodes)];
}
/** Explicit user-authored timings; never presented as speech recognition. */
export function parseStudioCaptions(text:string):NonNullable<StudioPackaging["captions"]> {
  let last=0;
  const lines=text.split("\n").map(l=>l.trim()).filter(Boolean);
  if(lines.length>24)throw new Error("一次最多添加 24 条字幕");
  return lines.map((line,i)=>{
    const match=line.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*[:：]\s*(.+)$/);
    if(!match)throw new Error(`第 ${i+1} 条字幕请使用“开始秒-结束秒: 文字”`);
    const start=Number(match[1]),end=Number(match[2]),value=match[3].trim();
    if(start<last||end<=start||end>600||value.length>160)throw new Error(`第 ${i+1} 条字幕时间或长度不正确`);
    last=end;return {start,end,text:value};
  });
}
