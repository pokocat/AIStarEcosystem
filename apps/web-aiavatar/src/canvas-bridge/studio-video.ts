import type { StudioVideoSettings } from "@ai-star-eco/types/ip-studio-workflow";
import type { VideoStudioModel, VideoStudioMode, VideoStudioMediaType, VideoStudioModeSpec } from "@ai-star-eco/types/video-studio";
import { CanvasNodeType, type CanvasNodeData } from "@/canvas/types/canvas";
import { inferVideoRatio } from "@/canvas/lib/media-size";

const legacyModeNames: Record<string,string> = {
  t2v:"文生视频", i2v:"图生视频", first_last_frame_video:"首尾帧", universal_reference_video:"全能参考",
};
export const studioVideoModeName = (mode:VideoStudioModeSpec):string => mode.mode==="i2v"&&mode.label==="首帧"?"图生视频":mode.label || legacyModeNames[mode.mode] || mode.mode;
/** Legacy frame/reference selections resolve through the current contract; an explicit mode stays exact. */
export function studioVideoModeForAssets(model:VideoStudioModel,selected:string|undefined,assets:StudioVideoAsset[]):VideoStudioModeSpec {
  const value=selected||"frames";
  const configured=model.contract.modes.find(mode=>mode.mode===value);
  if(configured)return configured;
  if(value!=="frames"&&value!=="reference") {
    throw new Error("所选视频模式已不在当前模型的开放范围，请重新选择");
  }
  const expectedFrames=value==="reference"?0:assets.length;
  const match=model.contract.modes.find(mode=>{
    if(value==="reference")return !!mode.references&&!mode.needsFirstFrame&&!mode.needsLastFrame;
    return !mode.references&&Number(mode.needsFirstFrame)+Number(mode.needsLastFrame)===expectedFrames
      &&assets.every(asset=>asset.mediaType==="image");
  });
  if(!match)throw new Error("当前模型没有与这些素材匹配的模式，请在参数设置中选择视频模式");
  return match;
}
export function studioVideoTierForConfig(model:VideoStudioModel,stored:string|undefined):string {
  const tier=model.contract.tiers.find(item=>item.tier===stored||item.tier===`${stored}p`);
  if(!tier)throw new Error("当前清晰度不在所选模型的开放范围，请在参数设置中重新选择");
  return tier.tier;
}
export const studioVideoTierInputValue = (tier:string):string => /^\d+p$/.test(tier)?tier.slice(0,-1):tier;
export function studioVideoCanvasForConfig(model:VideoStudioModel,tier:string,size:string|undefined) {
  const canvases=model.contract.tiers.find(item=>item.tier===tier)?.canvases||[];
  const exact=canvases.find(canvas=>size===canvas.aspectRatio||size===`${canvas.width}x${canvas.height}`);
  const canvas=exact||canvases.find(item=>item.aspectRatio===inferVideoRatio(size||"auto"));
  if(!canvas)throw new Error("当前画幅不在所选模型的开放范围，请在参数设置中重新选择");
  return canvas;
}
export type StudioVideoAsset = {mediaType:VideoStudioMediaType;storageKey?:string};
/** keepPrompt：智能优化开关的反向存储值，true 表示不让厂商改写描述（只对 supportsPromptOptimization 的模型生效）。 */
export type StudioVideoDraft={mode:VideoStudioMode;tier:string;seed?:number;firstId?:string;lastId?:string;keepPrompt?:boolean};

/**
 * 「按原文生成」 chosen on this node's last accepted request. Every way back to the node (reopening the panel,
 * retrying, generating again from the node) keeps it; a template preset never sets it.
 */
export const studioVideoKeepPrompt = (node:CanvasNodeData|undefined):boolean =>
  node?.type===CanvasNodeType.Video&&node.metadata?.studio?.request?.video?.optimizePrompt===false;

/** Current node controls and connected references own a reopened editor, including edits made after a run. */
export function studioVideoNodeSelection(node:CanvasNodeData|undefined,nodes:CanvasNodeData[],referenceIds:string[]) {
  const metadata=node?.type===CanvasNodeType.Video?node.metadata:undefined,request=metadata?.studio?.request,saved=request?.video??metadata?.studio?.videoPreset;
  const images=referenceIds.filter(id=>nodes.find(n=>n.id===id)?.type===CanvasNodeType.Image);
  const mode:VideoStudioMode=metadata?.videoMode&&!(["reference","frames"].includes(metadata.videoMode))?metadata.videoMode
    :metadata?.videoMode==="reference"?"universal_reference_video":metadata?.videoMode==="frames"
    ?referenceIds.length===2?"first_last_frame_video":referenceIds.length===1?"i2v":"t2v"
    :saved?.mode||(!referenceIds.length?"t2v":images.length!==referenceIds.length?"universal_reference_video":images.length>1?"first_last_frame_video":"i2v");
  const ratio=metadata?.size?inferVideoRatio(metadata.size):"auto";
  const customMode=metadata?.videoMode&&!(["reference","frames"].includes(metadata.videoMode));
  const requestedRatio=customMode&&request?.aspectRatio?request.aspectRatio
    :customMode&&metadata?.size&&/^[1-9][0-9]*:[1-9][0-9]*$/.test(metadata.size)?metadata.size
    :ratio!=="auto"?ratio:request?.aspectRatio||node?.metadata?.studio?.request?.aspectRatio||"9:16";
  // A source image may be 3:4, but legacy video endpoints only offer the three
  // ratios in the video picker. Keep native-video geometry on its own nodes.
  const videoRatio=metadata?.videoMode||saved?.mode||["9:16","16:9","1:1"].includes(requestedRatio)
    ?requestedRatio:"9:16";
  return {
    draft:{mode,tier:saved?.resolutionTier||(metadata?.vquality?(customMode?metadata.vquality:`${metadata.vquality.replace(/p$/,"")}p`):"768p"),seed:saved?.seed,firstId:images[0],lastId:images[1],
      ...(studioVideoKeepPrompt(node)?{keepPrompt:true}:{})} satisfies StudioVideoDraft,
    count:metadata?.videoCount?Number(metadata.videoCount):request?.count||1,
    seconds:metadata?.seconds?Number(metadata.seconds):request?.durationSec||node?.metadata?.studio?.shot?.durationSec||8,
    ratio:videoRatio,
  };
}

/** The visible mode owns the submitted selection; frame slots have explicit order. */
export function studioVideoReferenceIds(draft:StudioVideoDraft,referenceIds:string[],spec?:VideoStudioModeSpec):string[] {
  if(spec) {
    const frames=[spec.needsFirstFrame?draft.firstId:undefined,spec.needsLastFrame?draft.lastId:undefined].filter((id):id is string=>!!id);
    return [...new Set([...frames,...(spec.references?referenceIds.filter(id=>!frames.includes(id)):[])])];
  }
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
  const hasReferences=!!model.contract.modes.find(mode=>mode.mode===video.mode)?.references;
  const images=hasReferences?(video.references||[]).filter(r=>r.mediaType==="image").length:0;
  const total=(rate+Math.max(0,images-model.pricing.freeRefImages)*model.pricing.extraRefImagePerSecond)*seconds;
  return Number.isSafeInteger(total)&&total>=0?total:null;
}

/**
 * The order is explicit: first/last in frame mode, numbered per media type in reference mode.
 * keepPrompt only applies to models that rewrite the description before encoding; others ignore the choice.
 */
export function studioVideoSettings(mode:VideoStudioMode,tier:string,assets:StudioVideoAsset[],seed?:number,spec?:VideoStudioModeSpec,keepPrompt?:boolean):StudioVideoSettings {
  const settings=studioVideoInputs(mode,tier,assets,seed,spec);
  return keepPrompt?{...settings,optimizePrompt:false}:settings;
}
function studioVideoInputs(mode:VideoStudioMode,tier:string,assets:StudioVideoAsset[],seed?:number,spec?:VideoStudioModeSpec):StudioVideoSettings {
  if(assets.some(a=>!a.storageKey))throw new Error("有一份参考素材尚未上传完成，请重新选择");
  if(spec) {
    if(spec.mode!==mode)throw new Error("这个模型不支持所选视频模式，请重新选择");
    const remaining=[...assets];
    const frame=(label:string)=>{
      const index=remaining.findIndex(asset=>asset.mediaType==="image");
      if(index<0)throw new Error(`请选择一张${label}`);
      const [asset]=remaining.splice(index,1);
      return asset.storageKey!;
    };
    const firstFrameKey=spec.needsFirstFrame?frame("首帧图"):undefined;
    const lastFrameKey=spec.needsLastFrame?frame("尾帧图"):undefined;
    if(remaining.length&&!spec.references)throw new Error("当前模式不使用参考素材，请移除多余素材");
    return {mode,resolutionTier:tier,seed,
      ...(firstFrameKey?{firstFrameKey}:{}),...(lastFrameKey?{lastFrameKey}:{}),
      ...(spec.references?{references:remaining.map(a=>({mediaType:a.mediaType,key:a.storageKey!}))}:{})};
  }
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
  if(!prompt.trim()&&spec.promptRequired!==false)return "请先写提示词";
  if(Array.from(prompt).length>contract.promptMaxChars)return `这个模型最多接收 ${contract.promptMaxChars} 字，请缩短提示词`;
  if(video.seed!=null&&(!Number.isSafeInteger(video.seed)||video.seed<0||video.seed>contract.seedMax))return `随机种子需为 0 到 ${contract.seedMax} 的整数`;
  if(spec.needsFirstFrame&&!video.firstFrameKey)return "请选择首帧图片";
  if(spec.needsLastFrame&&!video.lastFrameKey)return "请选择尾帧图片";
  if(!spec.needsFirstFrame&&video.firstFrameKey)return "当前模式不使用首帧图片";
  if(!spec.needsLastFrame&&video.lastFrameKey)return "当前模式不使用尾帧图片";
  const rules=spec.references;
  if(!rules&&video.references?.length)return "当前模式不使用参考素材";
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
