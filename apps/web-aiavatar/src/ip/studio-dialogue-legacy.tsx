'use client';
// 「之前的对话」: conversations from the old four-mode assistant, read-only history in the
// same panel. Their tasks, adoption bindings and share links are kept; nothing reruns.
import { Button } from 'antd';
import { formatCredits } from '@ai-star-eco/api-client';
import type { StudioDialogueMessage, StudioPlan } from '@ai-star-eco/types/ip-studio-workflow';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import type { AssistantReplacement } from '@/canvas-bridge/studio-assistant-plan';
import { StudioAssistantPlan } from './studio-assistant-plan';
import { StudioConversationShare } from './studio-conversation-share';
import { StudioErrorNotice, studioNodeError } from './studio-errors';
import { splitReplyActions } from '@/canvas-bridge/studio-reply-actions';

export type LegacyGroup = { id: string; node?: CanvasNodeData; messages: StudioDialogueMessage[] };

export function StudioDialogueLegacy({ group, projectId, nodes, selectedIds, recovering, onEditStep, onApplyStep, onRecover, onCompose }: {
  group: LegacyGroup; projectId: string; nodes: CanvasNodeData[]; selectedIds: string[]; recovering: boolean;
  onEditStep: (nodeId: string, step: StudioPlan['steps'][number]) => void;
  onApplyStep: (nodeId: string, step: StudioPlan['steps'][number], replacement?: AssistantReplacement) => Promise<void>;
  onRecover: (nodeId: string) => void; onCompose: (text: string) => void;
}) {
  const studio = group.node?.metadata?.studio, conversation = studio?.conversation;
  const pending = group.node?.metadata?.status === 'loading';
  const turns = conversation?.turns.length ? conversation.turns.map((t, i) => ({ key: String(i), role: t.role, text: t.content, credits: t.billing?.credits }))
    : group.messages.map(m => ({ key: m.id, role: m.role, text: m.text, credits: m.billing?.credits }));
  return <section className="studio-dialogue-legacy-group" aria-label={`之前的对话：${group.node?.title || '对话'}`} data-node-id={group.id}>
    <header><strong title={group.node?.title}>{group.node?.title || '之前的对话'}</strong>
      {group.node && <StudioConversationShare key={`${projectId}-${group.id}`} projectId={projectId} nodeId={group.id} disabled={pending || conversation?.turns.at(-1)?.role !== 'assistant'}/>}</header>
    <div className="studio-conversation">{turns.map(t => <div key={t.key} className={`studio-turn studio-turn-${t.role}`}>
      <small>{t.role === 'user' ? '你' : 'Studio'}</small><p>{t.role === 'user' ? t.text : splitReplyActions(t.text || '').prose}</p>{t.credits !== undefined && <small>已消耗 {formatCredits(t.credits)} 积分</small>}
    </div>)}</div>
    {conversation?.plan && !pending && group.node && <>
      <StudioAssistantPlan key={`${group.id}-${studio?.runId || 'draft'}`} plan={conversation.plan} nodes={nodes} contextIds={studio?.request?.contextNodeIds || []} selectedIds={selectedIds}
        snapshots={studio?.assistantEditSnapshots} locked={recovering} onEdit={step => onEditStep(group.id, step)} onApply={(step, replacement) => onApplyStep(group.id, step, replacement)}/>
      {!!conversation.plan.questions.length && <div className="studio-dialogue-chips" role="group" aria-label="当时没确定的问题">{conversation.plan.questions.map((q, i) =>
        <button key={i} type="button" title="填进输入框，可以改完再发" onClick={() => onCompose(q)}><span>{q}</span></button>)}</div>}
    </>}
    {pending && <div className="studio-assistant-pending" role="status"><p>{recovering ? '正在确认原来的任务' : '这段对话的任务还没确认结果'}</p>
      {!recovering && studio?.request && <Button onClick={() => onRecover(group.id)}>确认原对话任务</Button>}</div>}
    {group.node?.metadata?.status === 'error' && group.node.metadata.errorDetails && <p className="studio-assistant-error"><StudioErrorNotice error={studioNodeError(group.node)} autoReport={false}/></p>}
  </section>;
}
