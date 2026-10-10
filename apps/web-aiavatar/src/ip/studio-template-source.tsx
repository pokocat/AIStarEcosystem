'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Input, Modal, Select } from 'antd';
import { nanoid } from 'nanoid';
import { USE_MOCK } from '@ai-star-eco/api-client';
import { studioTaskLabel, studioTaskQueued, studioQueueNotice } from '@/canvas-bridge/studio-task-status';
import type { StudioTemplateInstance, StudioTemplateExecution, StudioTemplateExecutionStep, StudioTemplatePackage, StudioTemplateMetrics } from '@ai-star-eco/types';
import { readTemplateInstance, readTemplateExecution, executeTemplateStep, acceptTemplateStep, archiveTemplateStep, listTemplatePackages, createTemplatePackage, readTemplateMetrics } from '@/canvas-bridge/template-api';
import { SignedImage } from '@/canvas-bridge/signed-image';
import { SignedVideo } from '@/canvas-bridge/signed-video';
import { dispatchStudioCommand } from '@/canvas-bridge/studio-nodes';
import { readStudioProject, listStudioIpAssets } from '@/canvas-bridge/studio-api';
import { saveStudioDocument } from '@/canvas-bridge/studio-save';
import { emitTemplateResults } from '@/canvas-bridge/template-projection';

const isVideo=(s:StudioTemplateExecutionStep)=>s.operation==='video'||s.outputRole==='video';
const canExecute=(s:StudioTemplateExecutionStep)=>['ready','failed','done','stale'].includes(s.status)||s.status==='waiting_adoption'&&s.run?.status==='done';
const statusText={ready:'可以生成',waiting_dependency:'等待前序步骤',waiting_adoption:'等待采用确认',running:'正在生成',failed:'生成失败',done:'已完成',stale:'来源已改变'};
export function StudioTemplateSource({projectId}:{projectId:string}) {
  const [source,setSource]=useState<StudioTemplateInstance>(),[open,setOpen]=useState(false),[execution,setExecution]=useState<StudioTemplateExecution>();
  const [focusedStep,setFocusedStep]=useState<string>();
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState<{step:StudioTemplateExecutionStep;clientRequestId:string;cost:number;prompt:string;submitted?:boolean}>();
  const [archive,setArchive]=useState<StudioTemplateExecutionStep>(),[people,setPeople]=useState<{value:string;label:string;ipId?:string}[]>([]),[person,setPerson]=useState<string>(),[name,setName]=useState('');
  const [packages,setPackages]=useState<StudioTemplatePackage[]>([]),[packageOpen,setPackageOpen]=useState(false),[packageTitle,setPackageTitle]=useState(''),[description,setDescription]=useState(''),[packageSteps,setPackageSteps]=useState<string[]>([]);
  const [metrics,setMetrics]=useState<StudioTemplateMetrics>();
  const apply=useCallback((state:StudioTemplateExecution)=>{setExecution(state);emitTemplateResults(projectId,state);},[projectId]);
  const versionId=source?.source.id;
  const hasRunning=execution?.steps.some(s=>s.run?.status==='running')??false;
  const refreshMetrics=useCallback(async()=>{if(versionId)setMetrics(await readTemplateMetrics(versionId).catch(()=>undefined));},[versionId]);
  const refresh=useCallback(async()=>{const state=await readTemplateExecution(projectId);apply(state);setPackages(await listTemplatePackages(projectId));await refreshMetrics();return state;},[projectId,apply,refreshMetrics]);
  useEffect(()=>{const listener=(event:Event)=>{const detail=(event as CustomEvent<{projectId:string;stepId:string}>).detail;if(detail.projectId===projectId){setFocusedStep(detail.stepId);setOpen(true);}};window.addEventListener('studio-template-step',listener);return()=>window.removeEventListener('studio-template-step',listener);},[projectId]);
  useEffect(()=>{if(USE_MOCK)return;let active=true;readStudioProject(projectId).then(p=>p.templateVersionId?readTemplateInstance(projectId):undefined).then(s=>{if(active)setSource(s);}).catch(()=>undefined);return()=>{active=false;};},[projectId]);
  // The canvas must recover results without requiring the user to open the plan.
  // Keep accepted jobs visible and progressing while that panel is closed.
  useEffect(()=>{if(!source)return;let active=true;const load=async()=>{try {const s=await readTemplateExecution(projectId);if(active){apply(s);await refreshMetrics();}}catch(e){if(active)setError(e instanceof Error?e.message:'读取失败');}};void load();const timer=hasRunning?setInterval(()=>void load(),4000):undefined;return()=>{active=false;if(timer)clearInterval(timer);};},[source,open,projectId,apply,refreshMetrics,hasRunning]);
  useEffect(()=>{if(!open)return;let active=true;listTemplatePackages(projectId).then(p=>{if(active)setPackages(p);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[open,projectId]);
  const act=async(action:()=>Promise<StudioTemplateExecution>)=>{setBusy(true);setError('');try{apply(await action());await saveStudioDocument(projectId);await refreshMetrics();return true;}catch(e){setError(e instanceof Error?e.message:'操作失败');return false;}finally{setBusy(false);}};
  const prepare=async(step:StudioTemplateExecutionStep)=>{
    setBusy(true);setError('');try {await saveStudioDocument(projectId);const state=await refresh();const current=state.steps.find(s=>s.id===step.id);if(!current||current.cost===undefined)throw new Error('当前模型或价格不可用，请检查平台配置');if(!canExecute(current))throw new Error('请先完成前序步骤或采用主形象');const prompt=current.run?.inputs.studioRequest?.prompt??(current.run?.inputs as {prompt?:string}|undefined)?.prompt??source?.project.doc.nodes.find(n=>n.id===current.nodeId)?.metadata?.prompt??'';setPending({step:current,clientRequestId:nanoid(),cost:current.cost,prompt});}catch(e){setError(e instanceof Error?e.message:'报价失败');}finally{setBusy(false);}
  };
  const submit=async()=>{
    if(!pending)return;setPending({...pending,submitted:true});setBusy(true);setError('');try {await executeTemplateStep(projectId,pending.step.id,{clientRequestId:pending.clientRequestId,maxCost:pending.cost,replaceRunId:pending.step.run?.id,prompt:pending.prompt});setPending(undefined);await refresh();await saveStudioDocument(projectId);}catch(e){setError(e instanceof Error?e.message:'提交结果尚未确认，请用同一请求恢复');}finally{setBusy(false);}
  };
  const openArchive=async(step:StudioTemplateExecutionStep)=>{
    setError('');try{const ips=await listStudioIpAssets();const options=ips.filter(p=>p.current).map(p=>({value:p.avatarId,label:p.characterName||p.name,ipId:p.ipId||undefined}));setPeople(options);setPerson(undefined);setName(step.title);setArchive(step);}catch(e){setError(e instanceof Error?e.message:'读取人物失败');}
  };
  if(!source)return null;
  return <><button type="button" className="h-8 px-3 rounded-full text-[12px] whitespace-nowrap" style={{background:'var(--surface-2)',color:'var(--ink-2)'}} onClick={()=>setOpen(true)}>模板 v{source.source.version} · 制作计划</button>
    <Modal open={open} onCancel={()=>setOpen(false)} footer={<><Button onClick={()=>void refresh().catch(e=>setError(e.message))}>刷新任务</Button><Button disabled={!execution?.steps.some(s=>!isVideo(s)&&s.accepted&&s.status==='done')} onClick={()=>{setPackageTitle(source.project.name);setPackageSteps(execution?.steps.filter(s=>!isVideo(s)&&s.accepted&&s.status==='done').map(s=>s.id)??[]);setPackageOpen(true);}}>排版并下载资产包</Button></>} width={860} styles={{body:{maxHeight:'70dvh',overflowY:'auto'}}} title={`${source.source.name} · v${source.source.version}`}>
      <div className="studio-template-form"><p>画布锁定此版本。按步骤生成，每次确认费用；需要采用确认的上游结果未采用前，下游不会执行。刷新会找回原任务。</p><strong>创建时计划 · {source.plan.imageCount} 张图片{source.plan.videoCount?` · ${source.plan.videoCount} 条视频`:''} · {source.plan.totalCost} 积分。实际费用逐步确认。</strong>
        {metrics&&<p>我套用这个版本：{metrics.instances} 个画布，{metrics.completedInstances} 个已完成；已消费 {metrics.spentCredits} 积分，冻结 {metrics.pendingCredits}；采用 {metrics.acceptedSteps} 个结果，首轮采用 {metrics.firstPassAcceptedSteps} 个，失败任务 {metrics.failedRuns} 个。</p>}
        {execution?.complete&&<Alert type="success" title="本轮制作步骤已完成，可归档图片、整理成片或继续创作。"/>}
        {execution?.steps.map(s=><section key={s.id} className="studio-template-section" aria-current={focusedStep===s.id?'step':undefined} aria-label={`${s.title}步骤`}>
          <strong>{s.title} · {s.run?.status==='running'?studioTaskLabel(s.run,true):statusText[s.status]}</strong>
          {studioTaskQueued(s.run)&&<p>{studioQueueNotice(s.run?.queue)}</p>}
          {s.outputRole==='sheet'&&<p>这是一张人物设定图，可整张作为角色参考。拍摄新画面时指定所需视角；图生视频先生成单独的镜头画面。</p>}
          {s.url&&(isVideo(s)?<SignedVideo src={s.url} storageKey={s.storageKey} controls preload="metadata" aria-label={`${s.title}结果`} style={{width:'100%',maxHeight:280}}/>:<SignedImage src={s.url} storageKey={s.storageKey} alt={`${s.title}结果`} style={{width:120,height:150,objectFit:'contain',borderRadius:8}}/>)}
          {s.run?.errorMessage&&<p>{s.run.errorMessage}</p>}
          {s.status==='stale'&&<p>原产物保留；只重做此步骤，不会自动重跑其他步骤。</p>}
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <Button disabled={busy||s.cost===undefined||!canExecute(s)} onClick={()=>void prepare(s)}>{s.run?'只重做此步骤':'生成此步骤'}{s.cost!==undefined?` · ${s.cost} 积分`:''}</Button>
            {s.storageKey&&s.run?.status==='done'&&s.status!=='stale'&&<><a href={s.url} target="_blank" rel="noreferrer">{isVideo(s)?'下载视频':'查看原图'}</a><Button disabled={busy} onClick={()=>void act(()=>acceptTemplateStep(projectId,s.id,{runId:s.run!.id,storageKey:s.storageKey!,accepted:!s.accepted}))}>{s.accepted?'撤回采用确认':isVideo(s)?'采用此视频':'采用此图片'}</Button>{isVideo(s)?<Button disabled={busy||!s.accepted||s.status!=='done'} onClick={()=>{setOpen(false);dispatchStudioCommand('work',s.nodeId);}}>整理成片</Button>:<Button disabled={busy} onClick={()=>void openArchive(s)}>归档到 IP</Button>}</>}
          </div>
        </section>)}
        {error&&<Alert type="error" title={error} showIcon/>}
        {packages.map(p=><section key={p.id} className="studio-template-section"><strong>{p.title} · {p.imageCount}/{p.requiredCount} 张 · {p.complete?'完整输出':'部分输出'}</strong><SignedImage storageKey={p.boardKey} src={p.boardUrl} alt={`${p.title}展示板`} style={{width:'100%',maxHeight:400,objectFit:'contain'}}/><a href={p.boardUrl} target="_blank" rel="noreferrer">查看展示板</a><a href={p.bundleUrl} target="_blank" rel="noreferrer" download>下载原图与来源清单 ZIP</a></section>)}
      </div>
    </Modal>
    <Modal open={packageOpen} title="生成人物资产展示板" onCancel={()=>{if(!busy)setPackageOpen(false);}} footer={<Button type="primary" loading={busy} disabled={!packageTitle.trim()||!packageSteps.length} onClick={()=>{setBusy(true);setError('');void createTemplatePackage(projectId,{title:packageTitle.trim(),description,stepIds:packageSteps}).then(async p=>{setPackages(old=>[...old.filter(x=>x.id!==p.id),p]);setPackageOpen(false);}).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>免费排版并打包</Button>}>
      <p>使用已采用的图片。中文由排版服务绘制；保留每张原图及来源清单。未包含全部输出时明确标为部分资产包。</p>
      <Input aria-label="展示板标题" value={packageTitle} maxLength={80} onChange={e=>setPackageTitle(e.target.value)}/><Input.TextArea aria-label="人物设定说明" value={description} maxLength={300} onChange={e=>setDescription(e.target.value)} rows={3}/>
      <Select aria-label="资产包输出" mode="multiple" value={packageSteps} options={execution?.steps.filter(s=>!isVideo(s)&&s.accepted&&s.status==='done').map(s=>({value:s.id,label:s.title}))} onChange={setPackageSteps} style={{width:'100%'}}/>{error&&<Alert type="error" title={error}/>}
    </Modal>
    <Modal open={!!pending} title={pending?.step.run?'确认只重做此步骤':'确认生成'} onCancel={()=>{if(!busy)setPending(undefined);}} mask={{closable:!busy}} keyboard={!busy} closable={!busy} footer={<Button type="primary" disabled={!pending?.prompt.trim()} loading={busy} onClick={()=>void submit()}>确认 {pending?.cost} 积分并提交</Button>}>
      <p>{pending?.step.title} · {pending&&isVideo(pending.step)?'1 条视频':'1 张图片'} · {pending?.cost} 积分。{pending?.step.run?'保留原产物；依赖它的结果会显示来源已改变。':'其他步骤仍需分别确认。'}</p>{error&&<Alert type="error" title={error}/>}
      <p>{pending?.submitted?'已提交的指令保持不变，再次点击会恢复原请求。':'可调整本次创作指令，模板原版本不变。引用仍按配方锁定。'}</p><Input.TextArea aria-label={pending&&isVideo(pending.step)?"本次视频指令":"本次图片指令"} value={pending?.prompt??''} disabled={busy||pending?.submitted} maxLength={16000} rows={5} onChange={e=>setPending(p=>p?{...p,prompt:e.target.value,clientRequestId:nanoid()}:p)}/>
    </Modal>
    <Modal open={!!archive} title="归档到 IP" onCancel={()=>{if(!busy)setArchive(undefined);}} footer={<Button type="primary" loading={busy} disabled={!name.trim()||archive?.outputRole!=='main'&&!person} onClick={()=>{if(!archive?.run||!archive.storageKey)return;const target=people.find(p=>p.value===person);void act(()=>archiveTemplateStep(projectId,archive.id,{nodeId:archive.nodeId,storageKey:archive.storageKey!,name:name.trim(),avatarId:person,ipId:target?.ipId,intent:archive.outputRole==='main'?'main':'look',description:archive.title,assetRole:archive.outputRole==='video'?undefined:archive.outputRole==='custom'?'look':archive.outputRole})).then(ok=>{if(ok)setArchive(current=>current?.id===archive.id?undefined:current);});}}>免费归档</Button>}>
      <p>{archive?.outputRole==='main'?'可新建 IP 或明确更新所选人物主形象。':'归档为指定人物的造型/视角，保留其主形象。'}</p>
      <Select aria-label="归档人物" allowClear placeholder="选择人物" value={person} options={people} onChange={setPerson} style={{width:'100%'}}/>
      <Input aria-label="资产名称" value={name} onChange={e=>setName(e.target.value)} maxLength={128}/>{error&&<Alert type="error" title={error}/>}
    </Modal>
  </>;
}
