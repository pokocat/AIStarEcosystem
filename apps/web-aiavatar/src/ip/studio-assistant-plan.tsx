'use client';
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';
import { useEffect, useRef, useState } from 'react';
import { Button, Input, Select } from 'antd';
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, FileText, Image, Video, Clapperboard } from 'lucide-react';
import type { DialoguePlanBlock } from '@/canvas-bridge/studio-dialogue-store';
import { gsap } from 'gsap';
import type { StudioPlan, StudioPlanStep } from '@ai-star-eco/types/ip-studio-workflow';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { assistantOutputReady, assistantStepReferences, assistantUnresolvedReferences, assistantWritableText, assistantEditableFields, assistantFieldValue, type AssistantReplacement, type AssistantEditField } from '@/canvas-bridge/studio-assistant-plan';

const labels={text:'文字',image:'图片',video:'视频',script:'剧本',storyboard:'分镜'};
const icons={text:FileText,image:Image,video:Video,script:Clapperboard,storyboard:Clapperboard};
export function StudioAssistantPlan({plan,nodes,contextIds,selectedIds,snapshots,locked,onEdit,onApply}: {
  plan:StudioPlan;nodes:CanvasNodeData[];contextIds:string[];selectedIds:string[];snapshots?:Record<string,Partial<Record<AssistantEditField,string>>>;locked:boolean;
  onEdit:(step:StudioPlanStep)=>void;
  onApply:(step:StudioPlanStep,target?:AssistantReplacement)=>Promise<void>;
}) {
  const [index,setIndex]=useState(()=>Math.max(0,plan.steps.findIndex(s=>!assistantOutputReady(nodes.find(n=>n.id===s.resultNodeId))))),[target,setTarget]=useState<AssistantReplacement>(),[saving,setSaving]=useState(false),[error,setError]=useStudioErrorState();
  const card=useRef<HTMLDivElement>(null),applying=useRef(false);
  const step=plan.steps[Math.min(index,Math.max(0,plan.steps.length-1))];
  const replacements=nodes.filter(n=>contextIds.includes(n.id)&&assistantEditableFields(n).length&&
    (step?.operation==='text'||n.type===step?.operation||step?.operation==='script'&&!!n.metadata?.studio?.script));
  const selected=replacements.filter(n=>selectedIds.includes(n.id));
  const requested=replacements.find(n=>n.id===step?.editTarget?.nodeId);
  const defaultTarget=requested||(selected.length===1?selected[0]:undefined);
  const fieldFor=(node:CanvasNodeData):AssistantEditField=>{
    const fields=assistantEditableFields(node);
    return node.id===step?.editTarget?.nodeId&&fields.includes(step.editTarget.field)?step.editTarget.field:
      step?.operation==='text'?fields[0]:'prompt';
  };
  const capture=(node:CanvasNodeData,field=fieldFor(node)):AssistantReplacement=>({id:node.id,field,
    content:snapshots?.[node.id]?.[field]??assistantFieldValue(node,field)});
  // A response never overwrites edits made since the paid turn began.
  useEffect(()=>{setTarget(defaultTarget?capture(defaultTarget):undefined);setError('');},[step?.id,defaultTarget?.id]);
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
  const targetNode=nodes.find(n=>n.id===target?.id);
  const targetField=target?.field||'content';
  const fieldLabels={content:'正文',prompt:'提示词',script:'剧本正文'};
  const appliedEdit=!!result&&!!step.editTarget;
  const apply=async()=>{
    if(applying.current)return;applying.current=true;setSaving(true);setError('');
    try{await onApply({...step,referenceNodeIds:refs.ids,unresolvedReferences:unresolved.length?unresolved:undefined},target);}catch(e){setError(e);}
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
      {!result&&!!replacements.length&&<Select aria-label={step.operation==='text'?'文字放置位置':'采用位置'} value={target?.id||'new'} disabled={locked||saving} options={[{value:'new',label:`新建${labels[step.operation]}节点`},...replacements.map(n=>({value:n.id,label:`写回「${n.title}」`}))]} onChange={id=>{const n=replacements.find(n=>n.id===id);setTarget(n?capture(n):undefined);}}/>}
      {targetNode&&!result&&assistantEditableFields(targetNode).length>1&&<Select aria-label="修改字段" value={targetField} disabled={locked||saving} options={assistantEditableFields(targetNode).map(field=>({value:field,label:fieldLabels[field]}))} onChange={field=>setTarget(capture(targetNode,field))}/>}
      {target&&!result&&<details className="studio-assistant-original"><summary>将替换该节点{fieldLabels[targetField]} · 查看原文</summary><p>{target.content||'当前节点为空'}</p></details>}
      <Button className="studio-assistant-primary" icon={result&&step.operation==='text'?<Check size={16}/>:<ArrowUpRight size={16}/>} loading={saving} disabled={locked||!!refs.waiting.length||step.operation==='text'&&!step.content?.trim()||!!result&&(appliedEdit||step.operation==='text')&&!error} onClick={()=>void apply()}>
        {error?'重试保存':appliedEdit?step.editTarget!.field==='content'?'已放入画布':`已更新${fieldLabels[step.editTarget!.field]}`:target?`替换节点${fieldLabels[targetField]}`:step.operation==='text'?result?'已放入画布':'放入画布':result?'打开节点继续创作':`创建${labels[step.operation]}节点`}
      </Button>
      {result&&step.operation!=='text'&&!appliedEdit&&<p className="studio-helper-note">{assistantOutputReady(result)?'画布节点已生成，可打开继续调整。':result.metadata?.status==='loading'?'节点正在生成，完成后可继续下一步。':result.metadata?.status==='error'?'节点生成未完成，请打开查看原因。':'节点已创建，等待确认参数并生成。'}</p>}
      <small className="studio-assistant-result-note">{target||appliedEdit?'采用后写回原节点，保留素材和连线，不启动生成、不另扣积分。':step.operation==='text'?'采用文字无需再次生成，不另扣积分。':'先创建节点并确认参数，生成时再扣积分。'}</small>
      {error&&<p className="studio-assistant-error"><StudioErrorNotice error={error}/></p>}
    </div>
  </section>;
}

// ── The plan of the threaded dialogue ─────────────────────────────────────────
// docs/ip-studio-new-canvas-and-threads.md §4.2: a plan says what will be made, nothing else: its summary, the approaches
// when there is a real choice (recommended first), and each step's title, type and the description that goes to the model.
// How the model weighed it (rationale, tradeoffs), per-step quotes, the budget, the revision and the skill are not shown.
// A plan quoted in the same reply is rendered inside its confirmation card (StudioPlanContent there); a plan on its own
// (revised, not quoted yet) is the same content without a price or buttons. Choosing another approach only sends a
// message: a new approach always needs a new quote from the server.
const operationLabels: Record<StudioPlanStep['operation'], string> = { text: '文字', script: '剧本', storyboard: '分镜', image: '图片', video: '视频', recreation: '拉片', check: '检查', assemble: '合成' };
export function studioPlanApproaches(plan: StudioPlan) {
  const list = plan.approaches || [];
  const chosen = plan.confirmedApproachId || plan.recommendedApproachId;
  return [...list].sort((a, b) => Number(b.id === chosen) - Number(a.id === chosen));
}
/** Three lines are enough to recognise a description; longer ones open on 「展开」 (no layout in tests, so by length). */
const longPrompt = (text: string) => text.length > 60 || text.split('\n').length > 3;
function StepPrompt({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = longPrompt(text);
  return <div className="studio-dialogue-plan-prompt">
    <p data-clamped={long && !open ? true : undefined}>{text}</p>
    {long && <button type="button" className="studio-dialogue-link" aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? '收起' : '展开'}</button>}
  </div>;
}
export function StudioPlanContent({ plan, onChooseApproach }: { plan: StudioPlan; onChooseApproach?: (title: string) => void }) {
  const approaches = studioPlanApproaches(plan);
  const line = (label: string, items: string[]) => items.length ? <p className="studio-dialogue-plan-list"><b>{label}</b><span>{items.join('；')}</span></p> : null;
  const [only] = plan.steps;
  return <>
    {!!plan.summary && <p className="studio-dialogue-plan-summary">{plan.summary}</p>}
    {approaches.length > 1 && <div className="studio-dialogue-approaches">{approaches.map(a => {
      const recommended = a.id === plan.recommendedApproachId, confirmed = a.id === plan.confirmedApproachId;
      return <article key={a.id} aria-label={`做法：${a.title}`} data-recommended={recommended || undefined}>
        <header><strong title={a.title}>{a.title}</strong>{confirmed ? <span>已选</span> : recommended ? <span>推荐</span> : null}</header>
        {!!a.summary && <p>{a.summary}</p>}
        {line('保留：', a.preserve)}{line('改变：', a.change)}
        {onChooseApproach && !confirmed && !recommended && <button type="button" className="studio-dialogue-link" onClick={() => onChooseApproach(a.title)}>改用这个做法</button>}
      </article>;
    })}</div>}
    {plan.steps.length === 1 ? <div className="studio-dialogue-plan-step">
      <header><strong title={only.title}>{only.title}</strong><small>{operationLabels[only.operation] || '其他'}</small></header>
      {!!only.prompt?.trim() && <StepPrompt text={only.prompt}/>}
    </div> : plan.steps.length > 1 ? <ol className="studio-dialogue-plan-steps">{plan.steps.map(s => <li key={s.id}>
      <header><strong title={s.title}>{s.title}</strong><small>{operationLabels[s.operation] || '其他'}</small></header>
      {!!s.prompt?.trim() && <details><summary>查看描述</summary><p>{s.prompt}</p></details>}
    </li>)}</ol> : null}
    {plan.notes?.filter(note => note.trim()).map((note, i) => <p key={i} className="studio-dialogue-note">{note}</p>)}
  </>;
}
/** `skillLabel` (「按技能：短视频复刻 v2」) is only a hover detail on the title; the panel's skill chip already says it. */
export function StudioPlanCard({ block, skillLabel, onChooseApproach }: { block: DialoguePlanBlock; skillLabel?: string; onChooseApproach?: (title: string) => void }) {
  return <section className="studio-dialogue-plan" aria-label="制作计划">
    <header><h4 title={skillLabel}>{block.plan.stage === 'analysis' ? '分析计划' : '制作计划'}</h4></header>
    <StudioPlanContent plan={block.plan} onChooseApproach={onChooseApproach}/>
  </section>;
}
