import type { StudioVideoSettings } from "@ai-star-eco/types/ip-studio-workflow";
import type { VideoStudioModel, VideoStudioMode, VideoStudioMediaType } from "@ai-star-eco/types/video-studio";
import { CanvasNodeType, type CanvasNodeData } from "@/canvas/types/canvas";
import { inferVideoRatio } from "@/canvas/lib/media-size";

export const studioVideoModeNames: Record<VideoStudioMode,string> = {
  t2v:"文生视频", i2v:"首帧", first_last_frame_video:"首尾帧", universal_reference_video:"全能参考",
};
export type StudioVideoAsset = {mediaType:VideoStudioMediaType;storageKey?:string};
export type StudioVideoDraft={mode:VideoStudioMode;tier:string;seed?:number;firstId?:string;lastId?:string};

/** Current node controls and connected references own a reopened editor, including edits made after a run. */
export function studioVideoNodeSelection(node:CanvasNodeData|undefined,nodes:CanvasNodeData[],referenceIds:string[]) {
  const metadata=node?.type===CanvasNodeType.Video?node.metadata:undefined,request=metadata?.studio?.request,saved=request?.video;
  const images=referenceIds.filter(id=>nodes.find(n=>n.id===id)?.type===CanvasNodeType.Image);
  const mode:VideoStudioMode=metadata?.videoMode==="reference"?"universal_reference_video":metadata?.videoMode==="frames"
    ?referenceIds.length===2?"first_last_frame_video":referenceIds.length===1?"i2v":"t2v"
    :saved?.mode||(!referenceIds.length?"t2v":images.length!==referenceIds.length?"universal_reference_video":images.length>1?"first_last_frame_video":"i2v");
  const ratio=metadata?.size?inferVideoRatio(metadata.size):"auto";
  return {
    draft:{mode,tier:metadata?.vquality?`${metadata.vquality.replace(/p$/,"")}p`:saved?.resolutionTier||"768p",seed:saved?.seed,firstId:images[0],lastId:images[1]} satisfies StudioVideoDraft,
    count:metadata?.videoCount?Number(metadata.videoCount):request?.count||1,
    seconds:metadata?.seconds?Number(metadata.seconds):request?.durationSec||node?.metadata?.studio?.shot?.durationSec||8,
    ratio:ratio!=="auto"?ratio:request?.aspectRatio||node?.metadata?.studio?.request?.aspectRatio||"9:16",
  };
}

/** The visible mode owns the submitted selection; frame slots have explicit order. */
export function studioVideoReferenceIds(draft:StudioVideoDraft,referenceIds:string[]):string[] {
  if(draft.mode==="t2v")return [];
  if(draft.mode==="universal_reference_video")return referenceIds;
  return [draft.firstId,...(draft.mode==="first_last_frame_video"?[draft.lastId]:[])].filter((id):id is string=>!!id);
}

/** Rebuild slots from the list edited in reference or legacy-model mode, never stale slots. */
export function studioVideoDraftFromReferences(draft:StudioVideoDraft,referenceIds:string[],imageIds:ReadonlySet<string>):StudioVideoDraft {
  const images=referenceIds.filter(id=>imageIds.has(id));
  const mode=draft.mode==="t2v"&&referenceIds.length
    ?referenceIds.some(id=>!imageIds.has(id))?"universal_reference_video":images.length>1?"first_last_frame_video":"i2v"
    :draft.mode;
  return {...draft,mode,firstId:images[0],lastId:images[1]};
}

/** Keep the shared list in step with frame edits, including swaps and library replacements. */
export function changeStudioVideoDraft(previous:StudioVideoDraft,next:StudioVideoDraft,referenceIds:string[],imageIds:ReadonlySet<string>):{draft:StudioVideoDraft;referenceIds:string[]} {
  let ids=referenceIds;
  if(previous.mode==="i2v"||previous.mode==="first_last_frame_video"||previous.firstId!==next.firstId||previous.lastId!==next.lastId) {
    const oldFrames=new Set([previous.firstId,previous.lastId].filter(Boolean));
    const frames=[next.firstId,next.lastId].filter((id):id is string=>!!id);
    ids=[...new Set([...frames,...ids.filter(id=>!oldFrames.has(id))])];
  }
  const enteringFrames=(next.mode==="i2v"||next.mode==="first_last_frame_video")&&next.mode!==previous.mode;
  return {draft:enteringFrames?studioVideoDraftFromReferences(next,ids,imageIds):next,referenceIds:ids};
}

/** Mirrors the server's published pricing parameters; null means this combination is unavailable. */
export function studioVideoQuote(model:VideoStudioModel,video:StudioVideoSettings,seconds:number):number|null {
  const rate=model.pricing.perSecond[video.mode]?.[video.resolutionTier];
  if(rate==null)return null;
  const images=video.mode==="universal_reference_video"?(video.references||[]).filter(r=>r.mediaType==="image").length:0;
  const total=(rate+Math.max(0,images-model.pricing.freeRefImages)*model.pricing.extraRefImagePerSecond)*seconds;
  return Number.isSafeInteger(total)&&total>=0?total:null;
}

/** The order is explicit: first/last in frame mode, numbered per media type in reference mode. */
export function studioVideoSettings(mode:VideoStudioMode,tier:string,assets:StudioVideoAsset[],seed?:number):StudioVideoSettings {
  if(assets.some(a=>!a.storageKey))throw new Error("有一份参考素材尚未上传完成，请重新选择");
  if(mode==="t2v") {
    if(assets.length)throw new Error("文生视频不使用参考素材，请移除参考或切换模式");
    return {mode,resolutionTier:tier,seed};
  }
  if(mode==="universal_reference_video")return {mode,resolutionTier:tier,seed,references:assets.map(a=>({mediaType:a.mediaType,key:a.storageKey!}))};
  const count=mode==="first_last_frame_video"?2:1;
  if(assets.length!==count || assets.some(a=>a.mediaType!=="image"))throw new Error(mode==="first_last_frame_video"?"请选择一张首帧图和一张尾帧图":"请选择一张首帧图");
  return {mode,resolutionTier:tier,seed,firstFrameKey:assets[0].storageKey,...(count===2?{lastFrameKey:assets[1].storageKey}:{})};
}

export function studioVideoError(model:VideoStudioModel,video:StudioVideoSettings,prompt:string,ratio:string,seconds:number):string|undefined {
  const contract=model.contract,spec=contract.modes.find(m=>m.mode===video.mode);
  if(!spec)return "这个模型不支持所选视频模式，请重新选择";
  if(!contract.tiers.find(t=>t.tier===video.resolutionTier)?.canvases.some(c=>c.aspectRatio===ratio))return "请按所选模型重新选择清晰度和画幅";
  if(!Number.isInteger(seconds)||seconds<contract.minSeconds||seconds>contract.maxSeconds)return `视频时长需为 ${contract.minSeconds} 到 ${contract.maxSeconds} 秒`;
  if(Array.from(prompt).length>contract.promptMaxChars)return `这个模型最多接收 ${contract.promptMaxChars} 字，请缩短提示词`;
  if(video.seed!=null&&(!Number.isSafeInteger(video.seed)||video.seed<0||video.seed>contract.seedMax))return `随机种子需为 0 到 ${contract.seedMax} 的整数`;
  if(spec.needsFirstFrame&&!video.firstFrameKey)return "请选择首帧图片";
  if(spec.needsLastFrame&&!video.lastFrameKey)return "请选择尾帧图片";
  const rules=spec.references;
  if(rules) {
    const refs=video.references||[],counts={image:0,video:0,audio:0};
    for(const ref of refs)counts[ref.mediaType]++;
    if(new Set(refs.map(r=>r.key)).size!==refs.length)return "同一个参考素材只能选择一次";
    if(refs.length>rules.maxTotal)return `最多选择 ${rules.maxTotal} 份参考素材`;
    for(const type of ["image","video","audio"] as const)if(counts[type]>rules[type].maxCount)return `参考${{image:"图片",video:"视频",audio:"音频"}[type]}最多 ${rules[type].maxCount} 份`;
    if(counts.video>0&&counts.image>rules.maxImagesWithVideo)return `含视频时最多选择 ${rules.maxImagesWithVideo} 张图片`;
    if(counts.image+counts.video<rules.minVisual)return "至少选择一张图片或一段视频作为参考";
  }
  if(studioVideoQuote(model,video,seconds)==null)return "这个模式和清晰度尚未定价，暂不可生成";
}
