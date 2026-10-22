'use client';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { StudioModelPicker, StudioSettingsPopover } from './studio-generation-controls';
import { Button, Input, Select } from 'antd';
import { Upload } from 'lucide-react';
import { nanoid } from 'nanoid';
import { ApiError } from '@ai-star-eco/api-client';
import type { IpRun } from '@ai-star-eco/types';
import type { StudioCapabilities, StudioRunRequest } from '@ai-star-eco/types/ip-studio-workflow';
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from '@/canvas/types/canvas';
import { useCanvasStore } from '@/canvas/stores/canvas/use-canvas-store';
import { applyStudioRun, studioGenerationPending } from '@/canvas-bridge/studio-nodes';
import { attachmentNode } from '@/canvas-bridge/studio-attachments';
import { importStudioMedia, submitStudioRun } from '@/canvas-bridge/studio-api';
import { readRun } from '@/canvas-bridge/api';
import { placeStudioNode } from '@/canvas-bridge/flow-document';
import { saveStudioDocument } from '@/canvas-bridge/studio-save';
import { recreationNode, recreationPrompt, recreationSource } from '@/canvas-bridge/studio-recreation';
import { SignedVideo } from '@/canvas-bridge/signed-video';
import { StudioFloatingPanel } from './studio-floating-panel';
import { StudioAiIcon } from './studio-ai-icon';
import { StudioErrorNotice, useStudioErrorState, useStudioApp } from './studio-errors';
import { StudioAnalysisDocument } from './studio-analysis-document';
import { studioTaskLabel } from '@/canvas-bridge/studio-task-status';

type Props={actions?:ReactNode;mode?:"segments";projectId:string;initialNodeId?:string;nodes:CanvasNodeData[];capabilities?:StudioCapabilities;
 setNodes:Dispatch<SetStateAction<CanvasNodeData[]>>;setConnections:Dispatch<SetStateAction<CanvasConnection[]>>;
 onClose:()=>void;onFocus:(id:string)=>void;onRun:(run:IpRun,nodeId:string)=>void};
export function StudioRecreation({actions,mode,projectId,initialNodeId,nodes,capabilities,setNodes,setConnections,onClose,onFocus,onRun}:Props) {
 const chosen=nodes.find(n=>n.id===initialNodeId);
 const segments=mode==='segments'||chosen?.metadata?.studio?.recreation?.mode==='segments';
 const selectedInitial=segments&&chosen?.metadata?.studio?.recreation?.report?recreationSource(chosen,nodes):chosen;
 // Returning through a video resumes its in-flight report, including an unknown submission response.
 const initial=selectedInitial?.type===CanvasNodeType.Video
   ?nodes.find(n=>studioGenerationPending(n)&&(n.metadata?.studio?.recreation?.mode==='segments')===segments&&n.metadata?.studio?.recreation?.sourceNodeId===selectedInitial.id&&n.metadata.studio.recreation.sourceStorageKey===selectedInitial.metadata?.storageKey)||selectedInitial:selectedInitial;
 const sourceBound=selectedInitial?.type===CanvasNodeType.Video||selectedInitial?.metadata?.studio?.kind==='recreation';
 const savedRequest=initial?.metadata?.studio?.request?.operation==='recreation'?initial.metadata.studio.request:undefined;
 const [targetId,setTargetId]=useState(initial?.metadata?.studio?.kind==='recreation'?initial.id:undefined);
 const [sourceId,setSourceId]=useState(recreationSource(initial,nodes)?.id);
 const [focus,setFocus]=useState(savedRequest?.prompt===recreationPrompt?'':savedRequest?.prompt||''),[model,setModel]=useState<string|undefined>(savedRequest?.model);
 const [busy,setBusy]=useState(false),[importing,setImporting]=useState(false),[error,setError]=useStudioErrorState();
 const guard=useRef(false),alive=useRef(true),upload=useRef<HTMLInputElement>(null);
 const imported=useRef<string|undefined>(undefined);
 const {message}=useStudioApp();
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const target=nodes.find(n=>n.id===targetId),report=target?.metadata?.studio?.recreation?.report,document=target?.metadata?.studio?.recreation?.document||!!target?.metadata?.studio?.recreation?.study&&target.metadata.status==='success';
 const source=nodes.find(n=>n.id===sourceId&&n.type===CanvasNodeType.Video&&n.metadata?.storageKey&&(!target?.metadata?.studio?.recreation||n.metadata.storageKey===target.metadata.studio.recreation.sourceStorageKey));
 const options=capabilities?.textModels||[];
 const fixed=capabilities?.textModelMode==='fixed';
 const selected=(fixed?options.find(m=>m.isDefault)||options[0]:options.find(m=>m.endpointId===model)||options.find(m=>m.isDefault&&m.supportsVision)||options.find(m=>m.supportsVision));
 const pending=studioGenerationPending(target),known=!!target?.metadata?.studio?.runId;
 const sourceUnavailable=!!target&&!source&&!report;
 const allowed=capabilities&&!capabilities.mock&&selected?.supportsVision&&selected.tokenPricing;
 const patch=(id:string,fn:(node:CanvasNodeData)=>CanvasNodeData)=>setNodes(list=>list.map(n=>n.id===id?fn(n):n));
 const currentNodes=()=>useCanvasStore.getState().projects.find(p=>p.id===projectId)?.nodes||nodes;
 const save=async()=>{await saveStudioDocument(projectId);};
 const importVideo=async(file:File)=>{
   if(guard.current)return;guard.current=true;setImporting(true);setError('');
   try {
     const media=await importStudioMedia(projectId,file,'video');
     if(!alive.current)return;
     const picked=attachmentNode({kind:'video',url:media.url,storageKey:media.key,width:media.width,height:media.height,title:file.name.replace(/\.[^.]+$/,'')},currentNodes());
     const node:CanvasNodeData={...picked,metadata:{...picked.metadata,origin:picked.metadata?.origin??'upload'}};
     imported.current=node.id;setNodes(list=>list.some(n=>n.id===node.id)?list:[...list,placeStudioNode(node,list)]);setSourceId(node.id);
     await save();imported.current=undefined;onFocus(node.id);
   }catch(e){if(alive.current)setError(e);}finally{guard.current=false;if(alive.current)setImporting(false);}
 };
 const submit=async(confirm=false)=>{
   if(guard.current||!confirm&&(!source||!allowed))return;
   guard.current=true;setBusy(true);setError('');let posted=false,received=false;
   let node=target;
   try {
     let request:StudioRunRequest;
     if(confirm) {
       if(!node?.metadata?.studio?.request)throw new Error('原任务信息缺失，请重新打开报告');
       request=node.metadata.studio.request;
     } else {
       // Failed reports retry explicitly on the same report node; completed reports are immutable history.
       node=target&&!report?target:recreationNode(source!);
       if(segments)node={...node,title:`${source!.title} · 视频拉片`,height:320,metadata:{...node.metadata,studio:{...node.metadata!.studio!,recreation:{...node.metadata!.studio!.recreation!,mode:'segments',resumeRunId:target?.metadata?.studio?.runId||target?.metadata?.studio?.recreation?.resumeRunId}}}};
       request={clientRequestId:nanoid(),nodeId:node.id,operation:'recreation',prompt:focus.trim()||recreationPrompt,...(segments?{mode:'segments' as const}:{}),
         contextNodeIds:[source!.id],model:selected!.endpointId,maxCost:selected!.tokenPricing!.maxCost};
       node={...node,metadata:{...node.metadata,status:'loading',errorDetails:undefined,studio:{...node.metadata!.studio!,runId:undefined,task:undefined,request}}};
       setTargetId(node.id);setNodes(list=>list.some(n=>n.id===node!.id)?list.map(n=>n.id===node!.id?node!:n):[...list,placeStudioNode(node!,list)]);
       setConnections(list=>list.some(c=>c.fromNodeId===source!.id&&c.toNodeId===node!.id)?list:[...list,{id:nanoid(),fromNodeId:source!.id,toNodeId:node!.id}]);
     }
     await save();posted=true;
     onFocus(node.id);onClose();
     const run=confirm&&node.metadata?.studio?.runId?await readRun(node.metadata.studio.runId):await submitStudioRun(projectId,request);
     received=true;
     patch(node.id,n=>applyStudioRun(n,run));onRun(run,node.id);
     await save();
   }catch(e){
     if(alive.current)setError(e);else message.error(e);
     if(node&&!received) {
       const rejected=!posted&&!confirm || (!confirm||!known)&&e instanceof ApiError&&((e.status??0)>=400&&(e.status??0)<500&&e.status!==408||['AI_NOT_CONFIGURED','PROMPT_NOT_CONFIGURED','AI_TOKEN_PRICE_NOT_CONFIGURED','ENDPOINT_NOT_ALLOWED','STUDIO_HYPIT_UNAVAILABLE'].includes(e.code));
       if(!confirm||rejected)patch(node.id,n=>({...n,metadata:{...n.metadata,status:rejected?'error':'loading',errorDetails:rejected?(e instanceof Error?e.message:'分析失败'):'任务未确认，请确认原任务'}}));
     }
   }finally{guard.current=false;if(alive.current)setBusy(false);}
 };
 if((report||document)&&target)return <StudioAnalysisDocument actions={actions} title={target.metadata?.studio?.recreation?.mode==='segments'?target.title:undefined} value={target.metadata?.content||''} onChange={content=>patch(target.id,n=>({...n,metadata:{...n.metadata,content}}))} onSave={save} onClose={onClose}/>;
 return <StudioFloatingPanel open title={segments?"视频拉片":"解析视频"} anchorId={targetId||sourceId} width={420} onClose={onClose} closable={!busy&&!importing} className="studio-recreation is-setup"
   footer={<>
     <div className="studio-generation-toolbar"><StudioModelPicker label="复刻分析模型" value={selected?.endpointId} disabled={busy||pending||fixed||options.filter(m=>fixed||m.supportsVision).length<=1} onChange={setModel} options={options.filter(m=>fixed||m.supportsVision).map(m=>({value:m.endpointId,label:m.name,disabled:!m.supportsVision}))}/>
       <StudioSettingsPopover label="分析参数" summary={focus.trim()?'已添加分析重点':'分析重点'} disabled={busy||pending}><div className="studio-director-form studio-parameter-form"><label>分析重点（选填）<Input.TextArea aria-label="复刻分析重点" value={focus} disabled={busy||pending} onChange={e=>setFocus(e.target.value)} maxLength={2000} autoSize={{minRows:2,maxRows:3}} placeholder="例如：重点分析氛围、动作推进和结尾反转"/></label>     {!allowed&&<p role="status">{capabilities?.mock?'解析需要真实视频分析，请关闭测试响应。':'尚无可用的视频画面分析模型，请检查模型能力及积分售价配置。'}</p>}
     <p className="studio-recreation-boundary">支持 60 秒、128 MB 内的 MP4。优先读取明显画面变化前后的画面，并在较长片段中补帧；时间点为近似定位。有音轨时自动提取原声，不转写字幕。</p></div></StudioSettingsPopover></div>
     <span>{pending?studioTaskLabel(target?.metadata?.studio?.task):'按实际用量消耗积分'}</span>
     {pending?<Button loading={busy} onClick={()=>void submit(true)}>{known?'刷新任务':'确认原任务'}</Button>:<Button type="primary" icon={<StudioAiIcon/>} disabled={!source||!allowed||importing||!!imported.current} loading={busy} onClick={()=>void submit()} title="AI 分析，会消耗积分">{target?.metadata?.status==='error'?segments?'继续拉片':'重新解析':segments?'开始拉片':'开始解析'}</Button>}
   </>}>
   {actions}
   {error&&<StudioErrorNotice error={error}/>}
   {target?.metadata?.status==='error'&&target.metadata.errorDetails&&<p role="alert">{target.metadata.errorDetails}</p>}
   <>
     <p className="studio-recreation-intro">{segments?'将视频分段，每段生成视频和镜头拆解，原声另存为音频节点。':'生成全片创作拆解和参考画面，原声另存为音频节点。'}</p>
     {sourceBound?<div className="studio-recreation-source" aria-label="当前参考视频"><span>参考视频</span><strong>{source?.title||target?.metadata?.studio?.recreation?.sourceTitle||'原参考视频不可用'}</strong></div>:<label>参考视频<Select aria-label="复刻参考视频" disabled={busy||pending||importing||!!targetId} value={sourceId} placeholder="选择画布中的视频" onChange={setSourceId} options={nodes.filter(n=>n.type===CanvasNodeType.Video&&n.metadata?.storageKey).map(n=>({value:n.id,label:n.title}))}/></label>}
     {!sourceBound&&!targetId&&<><input ref={upload} type="file" accept="video/mp4,.mp4" hidden onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void importVideo(file);}}/><Button disabled={busy||pending} loading={importing} icon={<Upload size={15}/>} onClick={()=>upload.current?.click()}>上传参考视频</Button></>}
     {imported.current&&<Button onClick={()=>void save().then(()=>{imported.current=undefined;setError('');}).catch(setError)}>重试保存视频</Button>}
     {source&&<details className="studio-recreation-source-preview"><summary>预览原片</summary><div className="studio-recreation-preview"><SignedVideo src={source.metadata?.content} storageKey={source.metadata?.storageKey} controls preload="none"/></div></details>}
     {sourceUnavailable&&<p role="alert">原参考视频已删除或替换。请从新的视频重新进入解析。</p>}

   </>
 </StudioFloatingPanel>;
}
