import { nanoid } from "nanoid";
import type { StudioBatch, StudioBatchStep, StudioCapabilities, StudioRunRequest } from "@ai-star-eco/types/ip-studio-workflow";
import { type CanvasNodeData } from "@/canvas/types/canvas";
import type { IpModels } from "./api";
import { studioNodeReferences } from "./studio-script";

/** Only authored input participates; generated outputs must not invalidate their own approved plan. */
export function studioBatchSnapshot(node:CanvasNodeData):string {
  return JSON.stringify({shot:node.metadata?.studio?.shot,prompt:node.metadata?.prompt,references:node.metadata?.studio?.references});
}
export function createStudioBatch(shots:CanvasNodeData[],kind:"frames"|"clips"|"work",models:IpModels,cap:StudioCapabilities,ratio:string,duration:number,episodeNo?:number,selection?:{imageModel?:string;videoModel?:string}):StudioBatch {
  if(!shots.length||shots.length>12)throw new Error("请选择 1 到 12 个镜头");
  const image=selection?.imageModel?models.image.find(m=>m.endpointId===selection.imageModel):models.image.find(m=>m.isDefault)||models.image[0],video=selection?.videoModel?models.video.find(m=>m.endpointId===selection.videoModel):models.video.find(m=>m.isDefault)||models.video[0];
  if(!cap.mock&&((kind==="frames"||shots.some(n=>!n.metadata?.storageKey))&&!image || kind!=="frames"&&!video))throw new Error("生成模型尚未配置");
  const steps:StudioBatchStep[]=[];
  for(const shot of shots) {
    const base={sourceNodeId:shot.id,sourceSnapshot:studioBatchSnapshot(shot)};
    if(kind==="frames"||!shot.metadata?.storageKey)steps.push({...base,id:nanoid(),title:`${shot.title} · 首帧`,targetNodeId:shot.id,operation:"image",maxCost:cap.mock?0:cap.imageCost});
    if(kind!=="frames")steps.push({...base,sourceFrameKey:shot.metadata?.storageKey,id:nanoid(),title:`${shot.title} · 视频`,targetNodeId:nanoid(),operation:"video",maxCost:cap.mock?0:video.creditCost*(video.billingUnit==="per_second"?duration:1)});
  }
  if(kind==="work")steps.push({id:nanoid(),title:episodeNo?`第 ${episodeNo} 集成片`:"镜头成片",sourceNodeId:shots[0].id,sourceSnapshot:studioBatchSnapshot(shots[0]),targetNodeId:nanoid(),operation:"assemble",maxCost:0});
  return {steps,imageModel:image?.endpointId,videoModel:video?.endpointId,aspectRatio:ratio,durationSec:duration,approvedCost:steps.reduce((sum,s)=>sum+s.maxCost,0),episodeNo};
}
export function studioBatchRequest(step:StudioBatchStep,batch:StudioBatch,nodes:CanvasNodeData[]):StudioRunRequest {
  const source=nodes.find(n=>n.id===step.sourceNodeId);
  if(!source||studioBatchSnapshot(source)!==step.sourceSnapshot)throw new Error("来源内容已修改，请重新确认制作计划");
  let references=source.metadata?.studio?.references||[];
  if(step.operation==="video") {
    if(!source.metadata?.storageKey)throw new Error("首帧尚未完成，已暂停后续制作");
    if(step.sourceFrameKey&&source.metadata.storageKey!==step.sourceFrameKey)throw new Error("已确认的首帧已更换，请重新确认制作计划");
    references=studioNodeReferences(source,"frame");
  }
  if(step.operation==="assemble") {
    references=batch.steps.filter(s=>s.operation==="video").map(s=>nodes.find(n=>n.id===s.targetNodeId)).map(n=>{
      if(!n?.metadata?.storageKey)throw new Error("视频片段尚未完成，已暂停合成");
      return {...studioNodeReferences(n,"clip")[0],role:"clip" as const};
    });
  }
  return {clientRequestId:nanoid(),nodeId:step.targetNodeId,operation:step.operation,prompt:step.operation==="assemble"?"按确认的镜头顺序合成，保留片段音轨。":source.metadata?.studio?.shot?.description||source.metadata?.prompt||source.title,
    references,model:step.operation==="image"?batch.imageModel:step.operation==="video"?batch.videoModel:undefined,
    episodeNo:step.operation==="assemble"?batch.episodeNo:batch.episodeNo??source.metadata?.studio?.episodeNo,aspectRatio:batch.aspectRatio,durationSec:batch.durationSec,count:step.operation==="image"?1:undefined,maxCost:step.maxCost};
}
