"use client";
import { BookOpen, Clapperboard, FileText, Play, UserRound } from "lucide-react";
import type { CanvasNodeData } from "@/canvas/types/canvas";
import { dispatchStudioCommand } from "@/canvas-bridge/studio-nodes";
import { studioTaskQueued } from '@/canvas-bridge/studio-task-status';

/** Only business summaries are inside scaled nodes; editors remain on the screen layer. */
export function StudioNodeContent({ node, readOnly=false }: { node: CanvasNodeData; readOnly?:boolean }) {
  const studio = node.metadata?.studio;
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
    {node.metadata?.status === "error" && <p role="alert">{node.metadata.errorDetails}</p>}
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
