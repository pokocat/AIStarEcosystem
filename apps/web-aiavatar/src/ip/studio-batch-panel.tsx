"use client";
import { StudioFloatingPanel } from "./studio-floating-panel";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { App, Button, Checkbox, Select } from "antd";
import { nanoid } from "nanoid";
import type { IpRun } from "@ai-star-eco/types";
import type { StudioBatch, StudioBatchStep, StudioCapabilities } from "@ai-star-eco/types/ip-studio-workflow";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from "@/canvas/types/canvas";
import { createStudioBatch, studioBatchRequest, studioBatchSnapshot } from "@/canvas-bridge/studio-batch";
import { applyStudioRun, makeStudioNode } from "@/canvas-bridge/studio-nodes";
import { studioTaskLabel } from '@/canvas-bridge/studio-task-status';
import { readRun, type IpModels } from "@/canvas-bridge/api";
import { submitStudioRun } from "@/canvas-bridge/studio-api";
import { saveStudioDocument } from "@/canvas-bridge/studio-save";
import { placeStudioNode } from "@/canvas-bridge/flow-document";

type Props={projectId:string;nodes:CanvasNodeData[];shots:CanvasNodeData[];setNodes:Dispatch<SetStateAction<CanvasNodeData[]>>;setConnections:Dispatch<SetStateAction<CanvasConnection[]>>;
  models:IpModels;capabilities?:StudioCapabilities;open:boolean;initialNodeId?:string;onClose:()=>void;ratio:string;episodeNo?:number};
export function StudioBatchPanel({projectId,nodes,shots,setNodes,setConnections,models,capabilities,open,initialNodeId,onClose,ratio,episodeNo}:Props) {
  const {message}=App.useApp();const [selected,setSelected]=useState<string[]>([]),[kind,setKind]=useState<"frames"|"clips"|"work">("work"),[duration,setDuration]=useState(5),[plan,setPlan]=useState<StudioBatch>(),[busy,setBusy]=useState(false),[error,setError]=useState(""),[runMap,setRunMap]=useState<Record<string,IpRun>>({}),[activeId,setActiveId]=useState<string>();
  const [imageModel,setImageModel]=useState<string>(),[videoModel,setVideoModel]=useState<string>(),[batchRatio,setBatchRatio]=useState(ratio);
  const stop=useRef(false),live=useRef({nodes,projectId});live.current={nodes,projectId};const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;stop.current=true;};},[]);
  useEffect(()=>{stop.current=true;setBusy(false);setActiveId(undefined);setPlan(undefined);setRunMap({});initializedDraft.current=undefined;},[projectId]);
  const initializedDraft=useRef<{id?:string}|undefined>(undefined);
  useEffect(()=>{if(open){if(initializedDraft.current?.id===initialNodeId)return;initializedDraft.current={id:initialNodeId};setSelected(shots.map(n=>n.id));setPlan(undefined);setActiveId(initialNodeId);setError("");setBatchRatio(ratio);}},[open,initialNodeId]);
  const saved=nodes.filter(n=>n.metadata?.studio?.batch);
  const current=saved.find(n=>n.id===activeId),batch=current?.metadata?.studio?.batch||plan;
  const patch=(id:string,update:(node:CanvasNodeData)=>CanvasNodeData)=>setNodes(list=>list.map(n=>n.id===id?update(n):n));
  useEffect(()=>{if(!open||!current)return;let dead=false;for(const s of current.metadata!.studio!.batch!.steps)if(s.runId)void readRun(s.runId).then(r=>{if(!dead)setRunMap(map=>({...map,[s.id]:r}));}).catch(()=>{});return()=>{dead=true;};},[open,activeId]);
  const prepare=()=>{try{if(!capabilities)return;setPlan(createStudioBatch(shots.filter(s=>selected.includes(s.id)),kind,models,capabilities,batchRatio,duration,episodeNo,{imageModel,videoModel}));setActiveId(undefined);setError("");}catch(e){setError(e instanceof Error?e.message:"计划未准备完成");}};
  const execute=async(retryFailed=false)=>{
    if(!batch||busy)return;
    const project=projectId;let approval=current;
    const approved:StudioBatch=structuredClone(batch);
    if(!approval){approval=placeStudioNode({id:nanoid(),type:CanvasNodeType.Text,title:episodeNo?`第 ${episodeNo} 集制作计划`:"镜头制作计划",width:360,height:240,position:{x:100,y:60},metadata:{status:"idle",studio:{kind:"batch",batch:approved}}},live.current.nodes);setNodes(list=>[...list,approval!]);setActiveId(approval.id);}
    const approvalId=approval.id;setBusy(true);setError("");stop.current=false;
    const persist=async()=>{patch(approvalId,n=>({...n,metadata:{...n.metadata,studio:{...n.metadata!.studio!,batch:structuredClone(approved)}}}));await saveStudioDocument(project);};
    try {
      await persist();
      for(const step of approved.steps) {
        if(stop.current||!mounted.current||live.current.projectId!==project)break;
        const source=live.current.nodes.find(n=>n.id===step.sourceNodeId);
        if(!source||studioBatchSnapshot(source)!==step.sourceSnapshot)throw new Error("来源内容已改变，制作暂停。请重新确认计划。");
        let run=step.runId?await readRun(step.runId):undefined;
        if(run?.status==="done")continue;
        if(run?.status==="failed") {
          if(!retryFailed)throw new Error("有镜头生成失败。检查错误后，可只重试失败步骤。");
          step.request=undefined;step.runId=undefined;
        }
        if(!step.request)step.request=studioBatchRequest(step,approved,live.current.nodes);
        let target=live.current.nodes.find(n=>n.id===step.targetNodeId);
        if(!target) {
          target={...makeStudioNode(step.operation,source),id:step.targetNodeId,title:step.title};
          target.metadata={...target.metadata,studio:{...target.metadata!.studio!,parentNodeId:source.id,episodeNo:step.operation==="assemble"?approved.episodeNo:approved.episodeNo??source.metadata?.studio?.episodeNo,order:source.metadata?.studio?.order,references:step.request.references}};
          setNodes(list=>list.some(n=>n.id===target!.id)?list:[...list,placeStudioNode(target!,list)]);
          setConnections(list=>[...list,{id:nanoid(),fromNodeId:source.id,toNodeId:target!.id}]);
        }
        patch(target.id,n=>({...n,metadata:{...n.metadata,status:"loading",studio:{...n.metadata!.studio!,request:step.request,runId:step.runId}}}));
        await persist(); // the final request and identity reach the server before any paid submission
        if(stop.current||live.current.projectId!==project)break;
        run=run?.status==="running"?run:await submitStudioRun(project,step.request);
        step.runId=run.id;await persist();
        while(mounted.current&&live.current.projectId===project) {
          setRunMap(map=>({...map,[step.id]:run!}));patch(target.id,n=>applyStudioRun(n,run!));
          if(run.status!=="running")break;
          await new Promise(resolve=>setTimeout(resolve,1500));
          try{run=await readRun(run.id);}catch{await new Promise(resolve=>setTimeout(resolve,2000));}
        }
        if(!mounted.current||live.current.projectId!==project)return;
        await persist();
        if(run.status==="failed")throw new Error(run.errorMessage||"生成失败，后续步骤已暂停");
      }
    }catch(e){if(mounted.current&&live.current.projectId===project){const text=e instanceof Error?e.message:"制作暂停，请确认原任务";setError(text);message.error(text);}}
    finally{if(mounted.current&&live.current.projectId===project){setBusy(false);stop.current=true;}}
  };
  const allDone=!!batch?.steps.length&&batch.steps.every(s=>runMap[s.id]?.status==="done");
  const video=videoModel?models.video.find(m=>m.endpointId===videoModel):models.video.find(m=>m.isDefault)||models.video[0];
  const durations=capabilities?.mock?[8]:[5,6,8,10,12,15].filter(v=>(!video?.capability?.minDurationSec||v>=video.capability.minDurationSec)&&(!video?.capability?.maxDurationSec||v<=video.capability.maxDurationSec));
  useEffect(()=>{if(durations.length&&!durations.includes(duration))setDuration(durations[0]);},[video?.endpointId,capabilities?.mock]);
  return <StudioFloatingPanel title="连续制作" utility open={open} onClose={()=>{stop.current=true;onClose();}} footer={batch?<div className="studio-row-actions"><Button type="primary" loading={busy} disabled={allDone} onClick={()=>void execute()}>{allDone?"计划已完成":current?"继续已确认计划":"确认费用并开始"}</Button><Button disabled={!busy} onClick={()=>{stop.current=true;setError("已请求暂停，当前任务完成后停止后续提交。");}}>暂停后续制作</Button>
          {batch.steps.some(s=>runMap[s.id]?.status==="failed")&&<Button disabled={busy} onClick={()=>void execute(true)}>只重试失败步骤并继续</Button>}</div>:null} width={660}>
    <div className="studio-batch-panel"><p>确认所选镜头、模型与费用后按顺序执行。暂停会停止后续提交，已经受理的任务仍会完成。刷新后请从保存的计划继续。</p>
      <Select aria-label="已保存的制作计划" placeholder="新制作计划" allowClear value={activeId} disabled={busy} onChange={id=>{setActiveId(id);setPlan(undefined);setError("");}} options={saved.map(n=>({value:n.id,label:n.title}))}/>
      {!current&&<><Select aria-label="连续制作范围" value={kind} onChange={v=>{setKind(v);setPlan(undefined);}} options={[{value:"frames",label:"生成所选首帧"},{value:"clips",label:"补首帧并生成视频"},{value:"work",label:"补首帧、视频并合成"}]}/>
        {!capabilities?.mock&&<div className="studio-settings-grid"><label>图片模型<Select aria-label="连续制作图片模型" value={imageModel||models.image.find(m=>m.isDefault)?.endpointId||models.image[0]?.endpointId} onChange={v=>{setImageModel(v);setPlan(undefined);}} options={models.image.map(m=>({value:m.endpointId,label:m.name}))}/></label>{kind!=="frames"&&<label>视频模型<Select aria-label="连续制作视频模型" value={videoModel||video?.endpointId} onChange={v=>{setVideoModel(v);setPlan(undefined);}} options={models.video.map(m=>({value:m.endpointId,label:m.name}))}/></label>}</div>}
        <label>画幅<Select aria-label="连续制作画幅" value={batchRatio} onChange={v=>{setBatchRatio(v);setPlan(undefined);}} options={["9:16","16:9","1:1"].map(v=>({value:v,label:v}))}/></label>
        {kind!=="frames"&&<Select aria-label="连续制作片段时长" value={duration} onChange={v=>{setDuration(v);setPlan(undefined);}} options={durations.map(v=>({value:v,label:`每镜 ${v} 秒`}))}/>}
        <div className="studio-batch-shots">{shots.map(n=><Checkbox key={n.id} checked={selected.includes(n.id)} onChange={e=>{setSelected(ids=>e.target.checked?[...ids,n.id]:ids.filter(id=>id!==n.id));setPlan(undefined);}}>{n.title}</Checkbox>)}</div>
        <Button onClick={prepare} disabled={busy||!selected.length||!capabilities}>查看制作计划与费用</Button></>}
      {batch&&<><p className="studio-quote">共 {batch.steps.length} 步 · 最多 {batch.approvedCost} 积分 · {batch.aspectRatio}</p><p>图片模型：{models.image.find(m=>m.endpointId===batch.imageModel)?.name||"测试响应"}；视频模型：{models.video.find(m=>m.endpointId===batch.videoModel)?.name||"测试响应"}</p>
        <ol className="studio-batch-steps">{batch.steps.map(s=><li key={s.id}><strong>{s.title}</strong><span>{s.maxCost} 积分 · {runMap[s.id]?.status==="done"?"已完成":runMap[s.id]?.status==="failed"?"失败":runMap[s.id]?.status==="running"?studioTaskLabel(runMap[s.id]):s.request?"待确认原任务":"待执行"}</span></li>)}</ol>
</>}
      {error&&<p role="alert">{error}</p>}
    </div>
  </StudioFloatingPanel>;
}
