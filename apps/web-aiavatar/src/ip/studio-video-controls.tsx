"use client";
import { Button, Checkbox, InputNumber, Select } from "antd";
import { ArrowLeftRight } from "lucide-react";
import type { Ref } from "react";
import type { VideoStudioModel } from "@ai-star-eco/types/video-studio";
import { CanvasNodeType, type CanvasNodeData } from "@/canvas/types/canvas";
import { SignedImage } from "@/canvas-bridge/signed-image";
import { studioVideoModeName,type StudioVideoDraft } from "@/canvas-bridge/studio-video";
import { studioVideoPromptReferences } from '@/canvas-bridge/studio-video-references';

export type { StudioVideoDraft } from "@/canvas-bridge/studio-video";
export function StudioVideoControls({model,draft,onChange,nodes,referenceIds,onReferences,onLibrary,libraryButtonRef}: {
  model:VideoStudioModel;draft:StudioVideoDraft;onChange:(next:StudioVideoDraft)=>void;nodes:CanvasNodeData[];
  referenceIds:string[];onReferences:(ids:string[])=>void;onLibrary:()=>void;libraryButtonRef?:Ref<HTMLButtonElement>;
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
    <label>视频模式<Select aria-label="视频模式" value={draft.mode} onChange={mode=>onChange({...draft,mode})}
      options={model.contract.modes.map(m=>({value:m.mode,label:studioVideoModeName(m)}))}/></label>
    {(spec?.needsFirstFrame||spec?.needsLastFrame)&&<div className="studio-video-frame-grid">
      {spec.needsFirstFrame&&frame("firstId","首帧图片")}{spec.needsLastFrame&&frame("lastId","尾帧图片")}
      {spec.needsLastFrame&&<Button icon={<ArrowLeftRight size={14}/>} disabled={!draft.firstId||!draft.lastId} onClick={()=>onChange({...draft,firstId:draft.lastId,lastId:draft.firstId})}>交换首尾帧</Button>}
    </div>}
    {spec?.references&&<><label>参考素材<Select mode="multiple" aria-label="视频参考素材" value={referenceOnlyIds} onChange={ids=>onReferences([...frameIds,...ids])}
      options={usable.filter(n=>!frameIds.includes(n.id)).map(n=>({value:n.id,label:`${{[CanvasNodeType.Image]:"图片",[CanvasNodeType.Video]:"视频",[CanvasNodeType.Audio]:"音频"}[n.type]} · ${n.title}`}))} placeholder="选择图片、视频或音频"/></label>
      <ol className="studio-video-reference-list">{studioVideoPromptReferences(nodes,referenceOnlyIds).map(ref=><li key={ref.nodeId}><span>{ref.label} · {ref.title}</span><Button type="text" aria-label={`移除${ref.title}`} onClick={()=>onReferences(referenceIds.filter(id=>id!==ref.nodeId))}>移除</Button></li>)}</ol>
      <p>在创作要求中输入 @ 选择参考用途。音频合计不超过 {spec.references.maxAudioTotalSec} 秒。</p></>}
    {(spec?.needsFirstFrame||spec?.needsLastFrame||Boolean(spec?.references?.image.maxCount))&&<Button ref={libraryButtonRef} onClick={onLibrary}>从 IP 人物库选择图片</Button>}
    <div className="studio-settings-grid"><label>清晰度<Select aria-label="视频清晰度" value={draft.tier}
      onChange={tier=>onChange({...draft,tier})} options={model.contract.tiers.map(t=>({value:t.tier,label:t.tier}))}/></label>
      <label>随机种子<InputNumber aria-label="视频随机种子" min={0} max={model.contract.seedMax} precision={0} value={draft.seed}
        placeholder="随机" onChange={seed=>onChange({...draft,seed:seed??undefined})}/></label></div>
    {/* 只有出片前会改写描述的模型（聚算 H3，厂商契约 optimizePrompt）才有这个选择；价格不变。 */}
    {model.supportsPromptOptimization&&<div className="studio-video-prompt-mode">
      <Checkbox checked={!!draft.keepPrompt} onChange={e=>onChange({...draft,keepPrompt:e.target.checked})}>按原文生成</Checkbox>
      <p>{draft.keepPrompt?"描述和台词原样交给模型，不再改写。画面细节要靠你自己写清楚。":"不勾选时，模型出片前会先改写一遍你的描述，台词偶尔会被删掉。"}</p>
    </div>}
  </>;
}
