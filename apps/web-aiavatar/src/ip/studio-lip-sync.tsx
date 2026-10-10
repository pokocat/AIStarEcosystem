"use client";
import { StudioFloatingPanel } from "./studio-floating-panel";
import { useEffect, useRef, useState } from "react";
import { Button, Select } from "antd";
import type { StudioLipSyncCatalog, StudioLipSyncQuote, StudioLipSyncRequest } from "@ai-star-eco/types/ip-studio-workflow";
import { CanvasNodeType, type CanvasNodeData } from "@/canvas/types/canvas";
import { quoteStudioLipSync, studioLipSyncCatalog } from "@/canvas-bridge/studio-api";
import { SignedVideo } from "@/canvas-bridge/signed-video";
import { SignedAudio } from "@/canvas-bridge/signed-audio";

type Props={open:boolean;onClose:()=>void;projectId:string;nodes:CanvasNodeData[];initialNodeId?:string;busy:boolean;
  onSubmit:(value:Omit<StudioLipSyncRequest,"clientRequestId"|"nodeId">,videoNodeId:string,audioNodeId:string)=>Promise<void>};
export function StudioLipSync({open,onClose,projectId,nodes,initialNodeId,busy,onSubmit}:Props) {
  const [catalog,setCatalog]=useState<StudioLipSyncCatalog>(),[error,setError]=useState(""),[loading,setLoading]=useState(false);
  const [model,setModel]=useState<string>(),[videoId,setVideoId]=useState<string>(),[audioId,setAudioId]=useState<string>();
  const [quote,setQuote]=useState<StudioLipSyncQuote>(),[quoting,setQuoting]=useState(false);
  const videos=nodes.filter(n=>n.type===CanvasNodeType.Video&&n.metadata?.storageKey&&n.metadata?.content&&n.metadata?.status!=="loading");
  const audios=nodes.filter(n=>n.type===CanvasNodeType.Audio&&n.metadata?.storageKey&&n.metadata?.content&&n.metadata?.mimeType==="audio/wav");
  const video=videos.find(n=>n.id===videoId),audio=audios.find(n=>n.id===audioId);
  const selected=catalog?.models.find(m=>m.endpointId===model)||catalog?.models.find(m=>m.isDefault)||catalog?.models[0];
  const reload=()=>{setLoading(true);setError("");void studioLipSyncCatalog().then(setCatalog).catch(e=>setError(e.message||"口型模型未加载")).finally(()=>setLoading(false));};
  const seeded=useRef<{id?:string;project:string}|undefined>(undefined);
  // Initialize on opening; focusing the newly created node must not change submitted inputs.
  useEffect(()=>{if(open){reload();if(seeded.current?.project===projectId&&seeded.current?.id===initialNodeId)return;seeded.current={id:initialNodeId,project:projectId};setVideoId(videos.find(n=>n.id===initialNodeId)?.id);setAudioId(audios.find(n=>n.id===initialNodeId)?.id);}},[open,initialNodeId,projectId]);
  useEffect(()=>{
    setQuote(undefined);setQuoting(false);if(!open||!selected||selected.creditCostPerSecond==null||!video?.metadata?.storageKey||!audio?.metadata?.storageKey)return;
    let cancelled=false;setQuoting(true);setError("");
    void quoteStudioLipSync(projectId,{model:selected.endpointId,videoStorageKey:video.metadata.storageKey,audioStorageKey:audio.metadata.storageKey})
      .then(q=>{if(!cancelled)setQuote(q);}).catch(e=>{if(!cancelled)setError(e.message||"素材检查与费用预估失败");}).finally(()=>{if(!cancelled)setQuoting(false);});
    return()=>{cancelled=true;};
  },[open,projectId,selected?.endpointId,selected?.creditCostPerSecond,video?.metadata?.storageKey,audio?.metadata?.storageKey]);
  return <StudioFloatingPanel title="人物口型同步" open={open} onClose={busy?undefined:onClose} width={520} anchorId={initialNodeId} footer={<div className="studio-lip-footer">
    <p className="studio-quote">{quote?`配音 ${quote.audioDurationSec.toFixed(2)} 秒 · ${quote.billableSeconds} 秒 × ${selected?.creditCostPerSecond} 积分`:'选择视频和配音后预估费用'}</p>
    <Button type="primary" loading={busy||quoting} disabled={loading||!!error||!quote||!video||!audio||!selected} onClick={()=>{if(quote&&video&&audio&&selected)void onSubmit({model:selected.endpointId,videoStorageKey:video.metadata!.storageKey!,audioStorageKey:audio.metadata!.storageKey!,maxCost:quote.cost},video.id,audio.id);}}>{quote?`生成口型视频 · ${quote.cost} 积分`:"先选择视频和配音"}</Button>
  </div>}>
    <div className="studio-director-form"><p>选择画布里的单人人物视频和配音，让人物按这条音频说话。结果另存为新片段，原视频仍可使用。</p>
      {error&&<p role="alert">{error}<Button onClick={reload}>重新加载</Button></p>}
      {!loading&&!error&&!catalog?.models.length&&<p role="status">尚未配置口型模型，请在后台绑定「Studio 口型同步」。</p>}
      <label>口型模型<Select aria-label="口型模型" loading={loading} value={selected?.endpointId} onChange={setModel} options={catalog?.models.map(m=>({value:m.endpointId,label:m.name}))}/></label>
      <label>人物视频<Select aria-label="口型人物视频" value={videoId} onChange={setVideoId} options={videos.map(n=>({value:n.id,label:n.title}))} placeholder="选择面部清晰的单人视频"/></label>
      {video&&<SignedVideo src={video.metadata!.content!} storageKey={video.metadata?.storageKey} controls style={{maxHeight:200,width:"100%"}}/>}
      <label>驱动配音<Select aria-label="口型驱动配音" value={audioId} onChange={setAudioId} options={audios.map(n=>({value:n.id,label:n.title}))} placeholder="先在画布生成 WAV 配音"/></label>
      {audio&&<SignedAudio src={audio.metadata!.content!} storageKey={audio.metadata?.storageKey} controls/>}
      <p>视频需有清晰、少遮挡的单人正脸，15–60fps。配音最长 {catalog?.maxAudioSeconds||60} 秒，且不能长于视频。卡通脸等特殊形象的效果需检查。</p>
    </div>
  </StudioFloatingPanel>;
}
