"use client";
import { Button, Checkbox, InputNumber, Select } from "antd";
import { StudioChoiceGroup } from "./studio-generation-controls";
import { ArrowLeftRight } from "lucide-react";
import { useId, type Ref } from "react";
import type { VideoStudioModel } from "@ai-star-eco/types/video-studio";
import { CanvasNodeType, type CanvasNodeData } from "@/canvas/types/canvas";
import { SignedImage } from "@/canvas-bridge/signed-image";
import { studioVideoModeName,type StudioVideoDraft } from "@/canvas-bridge/studio-video";
import { studioVideoPromptReferences } from '@/canvas-bridge/studio-video-references';

export type { StudioVideoDraft } from "@/canvas-bridge/studio-video";
export function StudioVideoControls({model,draft,onChange,nodes,referenceIds,onReferences,onLibrary,libraryButtonRef,section="all"}: {
  model:VideoStudioModel;draft:StudioVideoDraft;onChange:(next:StudioVideoDraft)=>void;nodes:CanvasNodeData[];
  referenceIds:string[];onReferences:(ids:string[])=>void;onLibrary:()=>void;libraryButtonRef?:Ref<HTMLButtonElement>;section?:"all"|"references"|"settings";
}) {
  const images=nodes.filter(n=>n.type===CanvasNodeType.Image&&n.metadata?.storageKey);
  const usable=nodes.filter(n=>[CanvasNodeType.Image,CanvasNodeType.Video,CanvasNodeType.Audio].some(type=>type===n.type)&&n.metadata?.storageKey);
  const spec=model.contract.modes.find(m=>m.mode===draft.mode);
  const frameIds=[spec?.needsFirstFrame?draft.firstId:undefined,spec?.needsLastFrame?draft.lastId:undefined].filter((id):id is string=>!!id);
  const referenceOnlyIds=referenceIds.filter(id=>!frameIds.includes(id));
  const frame=(field:"firstId"|"lastId",label:string)=><label>{label}<Select aria-label={label} allowClear value={draft[field]}
    onChange={value=>onChange({...draft,[field]:value})} options={images.map(n=>({value:n.id,label:n.title}))} placeholder={`选择画布中的${label}`}/>
    {(()=>{const n=images.find(n=>n.id===draft[field]);return n?<div className="studio-video-frame"><SignedImage src={n.metadata!.content!} storageKey={n.metadata!.storageKey} alt={label}/><span>{n.title}</span></div>:null;})()}</label>;
  return <>
    {section!=="references"&&<StudioChoiceGroup<typeof draft.mode> label="视频模式" value={draft.mode} onChange={mode=>onChange({...draft,mode})}
      options={model.contract.modes.map(m=>({value:m.mode,label:studioVideoModeName(m)}))}/>}
    {section!=="settings"&&<>
    {(spec?.needsFirstFrame||spec?.needsLastFrame)&&<div className="studio-video-frame-grid">
      {spec.needsFirstFrame&&frame("firstId","首帧图片")}{spec.needsLastFrame&&frame("lastId","尾帧图片")}
      {spec.needsLastFrame&&<Button icon={<ArrowLeftRight size={14}/>} disabled={!draft.firstId||!draft.lastId} onClick={()=>onChange({...draft,firstId:draft.lastId,lastId:draft.firstId})}>交换首尾帧</Button>}
    </div>}
    {spec?.references&&<><label>参考素材<Select mode="multiple" aria-label="视频参考素材" value={referenceOnlyIds} onChange={ids=>onReferences([...frameIds,...ids])}
      options={usable.filter(n=>!frameIds.includes(n.id)).map(n=>({value:n.id,label:`${{[CanvasNodeType.Image]:"图片",[CanvasNodeType.Video]:"视频",[CanvasNodeType.Audio]:"音频"}[n.type]} · ${n.title}`}))} placeholder="选择图片、视频或音频"/></label>
      <ol className="studio-video-reference-list">{studioVideoPromptReferences(nodes,referenceOnlyIds).map(ref=><li key={ref.nodeId}><span>{ref.label} · {ref.title}</span><Button type="text" aria-label={`移除${ref.title}`} onClick={()=>onReferences(referenceIds.filter(id=>id!==ref.nodeId))}>移除</Button></li>)}</ol>
      <p>在创作要求中输入 @ 选择参考用途。音频合计不超过 {spec.references.maxAudioTotalSec} 秒。</p></>}
    {(spec?.needsFirstFrame||spec?.needsLastFrame||Boolean(spec?.references?.image.maxCount))&&<Button ref={libraryButtonRef} onClick={onLibrary}>从 IP 人物库选择图片</Button>}
    </>}
    {section!=="references"&&<>
    <StudioChoiceGroup<string> label="清晰度" ariaLabel="视频清晰度" value={draft.tier} onChange={tier=>onChange({...draft,tier})} options={model.contract.tiers.map(t=>({value:t.tier,label:t.tier}))}/>
    {/* 只有出片前会改写描述的模型（聚算 H3，厂商契约 optimizePrompt）才有这个选择；价格不变。 */}
    {model.supportsPromptOptimization&&<div className="studio-video-prompt-mode">
      <Checkbox checked={!!draft.keepPrompt} onChange={e=>onChange({...draft,keepPrompt:e.target.checked})}>按原文生成</Checkbox>
      <p>{draft.keepPrompt?"描述和台词原样交给模型，不再改写。画面细节要靠你自己写清楚。":"不勾选时，模型出片前会先改写一遍你的描述，台词偶尔会被删掉。"}</p>
    </div>}
    {section==="all"&&<StudioVideoSeedControl seed={draft.seed} max={model.contract.seedMax} onChange={seed=>onChange({...draft,seed})}/>}
    </>}
  </>;
}

/** Seed is optional: never replace an existing fixed value until the author clears it. */
export function StudioVideoSeedControl({seed,max,onChange,count=1}:{seed?:number;max:number;onChange:(seed?:number)=>void;count?:number}) {
  const id=useId();
  return <details className="studio-video-advanced">
    <summary><span>高级设置</span><span>{seed==null?'每次随机':`固定种子 ${seed}`}</span></summary>
    <div className="studio-seed-control">
      <div className="studio-seed-heading"><label htmlFor={id}>随机种子</label><button type="button" disabled={seed==null} onClick={()=>onChange(undefined)}>恢复随机</button></div>
      <InputNumber id={id} aria-label="视频随机种子" aria-describedby={`${id}-hint`} min={0} max={max} precision={0} controls={false} value={seed??null}
        placeholder="留空，每次随机" onChange={value=>onChange(value??undefined)}/>
      <p id={`${id}-hint`}>留空让每次生成有所变化；固定数值有助于复现相近结果，效果也受提示词、素材和模型影响。</p>
      {count>1&&seed!=null&&<p>第一条使用此种子，后续结果依次递增；超过上限从 0 继续。</p>}
    </div>
  </details>;
}
