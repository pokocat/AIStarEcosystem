'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Input, Select } from 'antd';
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, FileText, Image, Video, Clapperboard } from 'lucide-react';
import { gsap } from 'gsap';
import type { StudioPlan, StudioPlanStep } from '@ai-star-eco/types/ip-studio-workflow';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { assistantOutputReady, assistantStepReferences, assistantUnresolvedReferences, assistantWritableText } from '@/canvas-bridge/studio-assistant-plan';

const labels={text:'文字',image:'图片',video:'视频',script:'剧本',storyboard:'分镜'};
const icons={text:FileText,image:Image,video:Video,script:Clapperboard,storyboard:Clapperboard};
export function StudioAssistantPlan({plan,nodes,contextIds,locked,onEdit,onApply}: {
  plan:StudioPlan;nodes:CanvasNodeData[];contextIds:string[];locked:boolean;
  onEdit:(step:StudioPlanStep)=>void;
  onApply:(step:StudioPlanStep,target?:{id:string;content:string})=>Promise<void>;
}) {
  const [index,setIndex]=useState(()=>Math.max(0,plan.steps.findIndex(s=>!assistantOutputReady(nodes.find(n=>n.id===s.resultNodeId))))),[target,setTarget]=useState<{id:string;content:string}>(),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const card=useRef<HTMLDivElement>(null),applying=useRef(false);
  const step=plan.steps[Math.min(index,Math.max(0,plan.steps.length-1))];
  useEffect(()=>{setTarget(undefined);setError('');},[step?.id]);
  useEffect(()=>{
    if(!card.current)return;
    const body=card.current.closest<HTMLElement>('.studio-floating-body');
    const frame=body?requestAnimationFrame(()=>{
      if(body&&card.current)body.scrollTop+=card.current.getBoundingClientRect().top-body.getBoundingClientRect().top-118;
    }):undefined;
    if(!window.matchMedia)return()=>frame!==undefined&&cancelAnimationFrame(frame);
    const media=gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)',()=>{
      gsap.fromTo(card.current,{y:10,opacity:.35},{y:0,opacity:1,duration:.24,clearProps:'transform,opacity'});
    });
    return()=>{frame!==undefined&&cancelAnimationFrame(frame);media.revert();};
  },[step?.id]);
  if(!step)return null;
  const Icon=icons[step.operation];
  const refs=assistantStepReferences(step,plan,nodes);
  const unresolved=assistantUnresolvedReferences(step,plan);
  const result=nodes.find(n=>n.id===step.resultNodeId);
  const replacements=nodes.filter(n=>contextIds.includes(n.id)&&assistantWritableText(n));
  const apply=async()=>{
    if(applying.current)return;applying.current=true;setSaving(true);setError('');
    try{await onApply({...step,referenceNodeIds:refs.ids,unresolvedReferences:unresolved.length?unresolved:undefined},target);}catch(e){setError(e instanceof Error?e.message:'未能保存，请重试');}
    finally{applying.current=false;setSaving(false);}
  };
  return <section className="studio-assistant-results" aria-label="创作结果">
    <div className="studio-assistant-result-nav"><span>{plan.steps.length>1?'创作步骤':'为你准备好了'}</span><div>
      {plan.steps.length>1&&<><button type="button" aria-label="上一个步骤" disabled={index===0||saving} onClick={()=>setIndex(i=>i-1)}><ChevronLeft size={16}/></button><span>{index+1} / {plan.steps.length}</span><button type="button" aria-label="下一个步骤" disabled={index>=plan.steps.length-1||saving} onClick={()=>setIndex(i=>i+1)}><ChevronRight size={16}/></button></>}
    </div></div>
    {plan.steps.length>1&&<div className="studio-assistant-step-strip" aria-label="选择创作步骤">{plan.steps.map((s,i)=><button key={s.id} type="button" disabled={saving} aria-pressed={i===index} onClick={()=>setIndex(i)}>{assistantOutputReady(nodes.find(n=>n.id===s.resultNodeId))&&<Check size={13}/>}<span>{s.title}</span></button>)}</div>}
    <div ref={card} className="studio-assistant-result-card">
      <header><Icon size={19}/><h3>{step.title}</h3><span>{labels[step.operation]}</span></header>
      {step.operation==='text'?<Input.TextArea aria-label={`结果 ${step.title}`} value={step.content||''} disabled={locked||saving||!!result} autoSize={{minRows:4,maxRows:8}} maxLength={16000} onChange={e=>onEdit({...step,content:e.target.value})}/>:
        <><p className="studio-assistant-result-intent">{step.prompt}</p><details><summary>编辑生成描述</summary><Input.TextArea aria-label={`方案 ${step.title}`} value={step.prompt} disabled={locked||saving||!!result} autoSize={{minRows:3,maxRows:8}} maxLength={16000} onChange={e=>onEdit({...step,prompt:e.target.value})}/></details></>}
      {!!refs.ids.length&&<p className="studio-assistant-result-references">参考：{refs.ids.map(id=>nodes.find(n=>n.id===id)?.title).join('、')}</p>}
      {!!refs.waiting.length&&<p role="status" className="studio-helper-note">先完成「{refs.waiting.join('」、「')}」，再继续这一步。</p>}
      {!!unresolved.length&&<p role="status" className="studio-helper-note">这一步需要补选参考素材，打开后请选择实际节点。</p>}
      {step.operation==='text'&&!result&&!!replacements.length&&<Select aria-label="文字放置位置" value={target?.id||'new'} disabled={locked||saving} options={[{value:'new',label:'新建文字节点'},...replacements.map(n=>({value:n.id,label:`写入「${n.title}」`}))]} onChange={id=>{const n=replacements.find(n=>n.id===id);setTarget(n?{id:n.id,content:n.metadata?.content||''}:undefined);}}/>}
      {target&&!result&&<details className="studio-assistant-original"><summary>将替换该节点正文 · 查看原文</summary><p>{target.content||'当前节点为空'}</p></details>}
      <Button className="studio-assistant-primary" icon={result&&step.operation==='text'?<Check size={16}/>:<ArrowUpRight size={16}/>} loading={saving} disabled={locked||!!refs.waiting.length||step.operation==='text'&&(!step.content?.trim()||!!result&&!error)} onClick={()=>void apply()}>
        {error?'重试保存':step.operation==='text'?result?'已放入画布':target?'替换节点正文':'放入画布':result?'打开节点继续创作':`创建${labels[step.operation]}节点`}
      </Button>
      {result&&step.operation!=='text'&&<p className="studio-helper-note">{assistantOutputReady(result)?'画布节点已生成，可打开继续调整。':result.metadata?.status==='loading'?'节点正在生成，完成后可继续下一步。':result.metadata?.status==='error'?'节点生成未完成，请打开查看原因。':'节点已创建，等待确认参数并生成。'}</p>}
      <small className="studio-assistant-result-note">{step.operation==='text'?'采用文字无需再次生成，不另扣积分。':'先创建节点并确认参数，生成时再扣积分。'}</small>
      {error&&<p role="alert" className="studio-assistant-error">{error}</p>}
    </div>
  </section>;
}
