"use client";
import { BookOpen, Clapperboard, FileText, Play, UserRound } from "lucide-react";
import type { CanvasNodeData } from "@/canvas/types/canvas";
import { dispatchStudioCommand } from "@/canvas-bridge/studio-nodes";
import { StudioScriptRichEditor } from './studio-script-rich-editor';
import { studioTaskLabel, studioTaskQueued } from '@/canvas-bridge/studio-task-status';

/** Only business summaries are inside scaled nodes; editors remain on the screen layer. */
export function StudioNodeContent({ node, readOnly=false }: { node: CanvasNodeData; readOnly?:boolean }) {
  const studio = node.metadata?.studio;
  if(studio?.kind==='recreation') {
    const task=studio.task,pending=node.metadata?.status==='loading',failed=node.metadata?.status==='error';
    const label=pending?studio.runId?studioTaskLabel(task).replace('生成','拆解'):node.metadata?.errorDetails?'提交结果待确认':'正在提交分析…':node.metadata?.status==='error'?'拆解失败':'全片创作拆解';
    if((studio.recreation?.report||studio.recreation?.document||studio.recreation?.study)&&!pending&&!failed)return <div className="studio-recreation-document"><StudioScriptRichEditor markdown={node.metadata?.content||''} readOnly toolbarHidden ariaLabel={studio.recreation?.mode==='segments'?node.title:'全片创作拆解'}/></div>;
    return <div className="studio-recreation-node"><div className="studio-recreation-node-heading"><FileText size={20}/><strong>{studio.recreation?.mode==='segments'?'视频拉片':'全片创作拆解'}</strong></div>
      {pending?<div className="studio-recreation-node-progress" role="status" aria-live="polite"><span>{label}</span>{task&&<progress aria-label="创作拆解进度" max={100} value={task.pct}/>}<small>{studio.recreation?.study?`已完成 ${studio.recreation.study.segments.filter(s=>s.status==='done').length} / ${studio.recreation.study.segments.length} 个片段，可继续编辑画布。`:'完成后在这里查看报告，可继续编辑画布。'}</small>{!studio.runId&&node.metadata?.errorDetails&&<button type="button" disabled={readOnly} onClick={()=>dispatchStudioCommand('tasks',node.id)}>查看原任务</button>}</div>:<><p role={failed?'alert':undefined}>{failed?node.metadata?.errorDetails||'拆解未完成，请查看原因后重试':studio.recreation?.report?.creativePremise||'从原片中提炼创意、视觉风格与叙事手法'}</p><button type="button" disabled={readOnly} onPointerDown={e=>e.stopPropagation()} onClick={()=>dispatchStudioCommand('recreation',node.id)}>{failed?'查看并重试':'查看拆解报告'}</button></>}
    </div>;
  }
  // Extraction receipts and text asset references do not turn ordinary text into a generated script.
  if(node.type==="text"&&!studio?.script&&!studio?.workDraft&&(!studio?.kind||studio.kind==="text"))return <div className="studio-flow-text">{node.metadata?.content||"双击编辑文字"}</div>;
  if(studio?.workDraft)return <div className="studio-node-summary"><Play size={24}/><strong>{studio.workDraft.title||node.title}</strong><p>{node.metadata?.content}</p>
    <button disabled={readOnly} type="button" onMouseDown={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} onClick={()=>dispatchStudioCommand('work',node.id)}>编辑成片方案</button></div>;
  if(studio?.kind==="assistant" || studio?.kind==="batch")return <div className="studio-node-summary"><Clapperboard size={24}/><strong>{node.title}</strong><p>{studio.conversation?.plan?.summary||`${studio.batch?.steps.length||0} 个制作步骤 · 最多 ${studio.batch?.approvedCost||0} 积分`}</p><button disabled={readOnly} type="button" onMouseDown={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} onClick={()=>dispatchStudioCommand(studio.kind,node.id)}>打开{studio.kind==="assistant"?"对话":"制作计划"}</button></div>;
  if (studio?.kind === "ip") return <div className="studio-node-summary">
    <UserRound size={22} /><strong>{node.title}</strong><p>{node.metadata?.content || "已定稿的 IP 形象"}</p>
    <span>形象版本 {studio.adoption?.version}</span>
    <button disabled={readOnly} type="button" onMouseDown={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} onClick={() => dispatchStudioCommand("script", node.id)}>创作剧本</button>
  </div>;
  const script = studio?.script;
  if (!script) return <div className="studio-node-summary"><FileText size={24} /><strong>{node.metadata?.status === "loading" ? studioTaskQueued(studio?.task)?"剧本排队中":"剧本生成中" : "剧本待创作"}</strong>
    {studio?.composerDraft?.prompt&&<p>{studio.composerDraft.prompt}</p>}
    <button disabled={readOnly} type="button" onMouseDown={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} onClick={() => dispatchStudioCommand("editor", node.id)}>编辑剧本</button>
    <button disabled={readOnly} type="button" onMouseDown={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} onClick={() => dispatchStudioCommand("script", node.id)}>AI 起草剧本</button></div>;
  return <div className="studio-script-summary">
    <aside aria-label="剧本内容"><BookOpen size={18} /><span>大纲</span><span>人物</span><span>场景</span><span>道具</span><span>正文</span></aside>
    <div><strong>{script.title}</strong><p>{script.outline}</p><small>{script.episodes.length} 集 · {script.characters?.length || 0} 位人物 · {script.shots?.length || 0} 个镜头建议</small>
      {studio?.scriptEditor?.pending&&<small>AI 改稿已受理 · 在编辑器确认原任务</small>}
      <div className="studio-node-actions"><button disabled={readOnly} type="button" onMouseDown={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} onClick={() => dispatchStudioCommand("editor", node.id)}><FileText size={14} />打开编辑器</button>
      <button disabled={readOnly} type="button" onMouseDown={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} onClick={() => dispatchStudioCommand("split", node.id)}><Clapperboard size={14} />生成分镜</button></div>
    </div>
  </div>;
}
