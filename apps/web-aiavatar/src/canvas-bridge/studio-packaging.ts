import type { StudioCaptionMode, StudioCaptionResult, StudioPackaging, StudioWorkDraft } from "@ai-star-eco/types/ip-studio-workflow";
import { CanvasNodeType, type CanvasNodeData } from "@/canvas/types/canvas";
import { placeStudioNode } from "./flow-document";

export function studioWorkDraft(nodes:CanvasNodeData[],episodeNo?:number):StudioWorkDraft {
  const draft=nodes.find(n=>n.metadata?.studio?.workDraft&&n.metadata.studio.episodeNo===episodeNo)?.metadata?.studio?.workDraft;
  if(draft)return draft;
  // Existing projects resume the most recently authored assembly settings without mutating its request.
  const request=[...nodes].reverse().find(n=>n.metadata?.studio?.kind==='work'&&n.metadata.studio.episodeNo===episodeNo&&n.metadata.studio.request?.operation==='assemble')?.metadata?.studio?.request;
  const p=request?.packaging;
  return {aspectRatio:request?.aspectRatio||'9:16',packagingEnabled:!!(p?.brand||p?.title||p?.cta),
    brand:p?.brand||'',title:p?.title||'',cta:p?.cta||'',captionText:p?.captions?.map(c=>`${c.start}-${c.end}: ${c.text}`).join('\n')||'',voiceoverStorageKey:p?.voiceoverStorageKey,
    captionMode:p?.captions?.length?'manual':p?'auto':undefined,musicStorageKey:p?.musicStorageKey,quality:p?.quality};
}

/** 字幕默认自动生成；老画布填过字幕的继续用手写。recognition=false：语音识别不可用，自动字幕加不上，按不添加算（不让人以为会有字幕）。 */
export function studioCaptionMode(draft:StudioWorkDraft,recognition?:boolean):StudioCaptionMode {
  const mode=draft.captionMode??(draft.captionText.trim()?'manual':'auto');
  return mode==='auto'&&recognition===false?'off':mode;
}

/** 导出一次要提交的包装；什么都没选时不带。 */
export function studioPackagingOf(draft:StudioWorkDraft,recognition?:boolean):StudioPackaging|undefined {
  const mode=studioCaptionMode(draft,recognition);
  const packaging:StudioPackaging={
    ...(draft.packagingEnabled?{brand:draft.brand.trim(),title:draft.title.trim(),cta:draft.cta.trim()}:{}),
    ...(mode==='manual'?{captions:parseStudioCaptions(draft.captionText)}:{}),
    ...(mode==='auto'?{autoCaptions:true}:{}),
    ...(draft.voiceoverStorageKey?{voiceoverStorageKey:draft.voiceoverStorageKey}:{}),
    ...(draft.musicStorageKey?{musicStorageKey:draft.musicStorageKey}:{}),
    ...(draft.quality?{quality:draft.quality}:{}),
  };
  return Object.keys(packaging).length?packaging:undefined;
}

/** 导出结果里字幕的一句话说明。 */
export function studioCaptionNote(result?:Pick<StudioCaptionResult,'status'>&{count?:number},options?:{advanced?:boolean}):{text:string;warn:boolean}|undefined {
  if(!result)return undefined;
  const fill=options?.advanced?'需要字幕可以在高级编辑中添加':'需要字幕可以手动填写';
  const count=result.count?` ${result.count} 条`:'';
  switch(result.status) {
    case 'recognized':return {text:`已自动添加${count}字幕。`,warn:false};
    case 'estimated':return {text:`已添加${count}字幕。时间按镜头估算，个别句子可能略有偏差；不合适可以改为不添加字幕，重新导出。`,warn:false};
    case 'manual':return {text:`已添加${count}字幕。`,warn:false};
    case 'no_lines':return {text:'没有台词，未添加字幕。',warn:false};
    case 'no_speech':return {text:`没有识别到人声，未添加字幕。${fill}，再重新导出。`,warn:false};
    case 'unavailable':return {text:`语音识别暂不可用，这次未添加字幕。${fill}，再重新导出。`,warn:true};
    default:return undefined;
  }
}

export function updateStudioWorkDraft(nodes:CanvasNodeData[],changes:Partial<StudioWorkDraft>,id:string,episodeNo?:number):CanvasNodeData[] {
  const existing=nodes.find(n=>n.metadata?.studio?.workDraft&&n.metadata.studio.episodeNo===episodeNo);
  const draft={...studioWorkDraft(nodes,episodeNo),...changes};
  const content=[draft.title||'待填写作品标题',draft.brand,{auto:'自动字幕',manual:'手写字幕',off:'不加字幕'}[studioCaptionMode(draft)],draft.voiceoverStorageKey?'已选择配音':'保留片段原音轨',draft.musicStorageKey?'已选择背景音乐':''].filter(Boolean).join('\n');
  if(existing)return nodes.map(n=>n.id===existing.id?{...n,metadata:{...n.metadata,content,studio:{...n.metadata!.studio!,workDraft:draft}}}:n);
  const node:CanvasNodeData={id,type:CanvasNodeType.Text,title:episodeNo?`第 ${episodeNo} 集成片方案`:'成片方案',width:360,height:230,
    position:{x:100,y:100},metadata:{status:'idle',content,studio:{kind:'work',episodeNo,workDraft:draft}}};
  return [...nodes,placeStudioNode(node,nodes)];
}
/** Explicit user-authored timings; never presented as speech recognition. */
export function parseStudioCaptions(text:string):NonNullable<StudioPackaging["captions"]> {
  let last=0;
  const lines=text.split("\n").map(l=>l.trim()).filter(Boolean);
  if(lines.length>200)throw new Error("一次最多添加 200 条字幕");
  return lines.map((line,i)=>{
    const match=line.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*[:：]\s*(.+)$/);
    if(!match)throw new Error(`第 ${i+1} 条字幕需要填写开始和结束时间`);
    const start=Number(match[1]),end=Number(match[2]),value=match[3].trim();
    if(end<=start)throw new Error(`第 ${i+1} 条字幕的结束时间要晚于开始时间`);
    if(start<last)throw new Error(`第 ${i+1} 条字幕的开始时间不能早于上一条的结束时间`);
    if(end>600)throw new Error(`第 ${i+1} 条字幕超过了 10 分钟`);
    if(value.length>160)throw new Error(`第 ${i+1} 条字幕文字太长，最多 160 字`);
    last=end;return {start,end,text:value};
  });
}
