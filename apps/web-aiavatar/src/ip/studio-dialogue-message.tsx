'use client';
// One message in the thread. Assistant text streams in by part; typed blocks render as
// work records, plans, confirmation cards, inline questions and adoption proposals, in the
// order they arrived (a reloaded message shows its text first, then its blocks).
import { useState, type ReactNode } from 'react';
import { Button } from 'antd';
import { FilePlus2, GitBranch, LoaderCircle, LocateFixed } from 'lucide-react';
import { formatCredits } from '@ai-star-eco/api-client';
import type { StudioDialogueMessage, StudioMessageBlock, StudioPlan } from '@ai-star-eco/types/ip-studio-workflow';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { blockKey, type DialogueActivity, type DialogueAdoptionBlock, type DialogueApprovalBlock, type DialogueLayout, type DialogueToolBlock } from '@/canvas-bridge/studio-dialogue-store';
import { proposalFieldValue } from '@/canvas-bridge/studio-plan-execution';
import { splitReplyActions } from '@/canvas-bridge/studio-reply-actions';
import { StudioDialogueToolCard, toolTitle } from './studio-dialogue-tool';
import { StudioDialogueApprovalCard, type ApprovedCaps } from './studio-dialogue-approval';
import { StudioDialogueQuestion, StudioDialogueSuggestions } from './studio-dialogue-question';
import { StudioPlanCard } from './studio-assistant-plan';
import { StudioDialogueActivity } from './studio-dialogue-activity';
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';

const FIELD_LABEL = { content: '正文', prompt: '提示词', script: '剧本正文' } as const;

export type DialogueMessageHandlers = {
  onCompose: (text: string) => void;
  /** A question option or a follow-up suggestion: sent at once as the user's message; the draft stays. Absent = fill the composer. */
  onQuickReply?: (text: string) => void;
  /** A message is on its way (or the thread is not ready): chips wait instead of sending a second one. */
  quickReplyBusy?: boolean;
  onRevise: () => void;
  onApprove: (block: DialogueApprovalBlock, caps: { budgetCap: number; autoFixCap: number }, messageId: string) => Promise<unknown>;
  planReady: (block: DialogueApprovalBlock) => boolean;
  /** What a confirmed card actually authorized (never the proposal); see approvedCaps in the store. */
  approvedCaps?: (block: DialogueApprovalBlock) => ApprovedCaps | undefined;
  onAdopt: (block: DialogueAdoptionBlock) => Promise<void>;
  onBranch?: (messageId: string) => Promise<void>;
  /** 「放进画布」: the reply's text becomes a text node (or the one already holding it comes into view). */
  onPlaceText?: (message: StudioDialogueMessage) => Promise<void>;
  /** 「按技能：名称 v2」 for a plan planned with a skill version; undefined hides the badge. */
  skillLabel?: (plan: StudioPlan) => string | undefined;
  /** Extra actions under an execution's completion summary (operators: 「整理成技能草稿」); null when none. */
  completionActions?: (message: StudioDialogueMessage) => ReactNode;
};

function AdoptionProposal({ block, nodes, readOnly, onAdopt }: { block: DialogueAdoptionBlock; nodes: CanvasNodeData[]; readOnly?: boolean; onAdopt: (block: DialogueAdoptionBlock) => Promise<void> }) {
  const [busy, setBusy] = useState(false), [error, setError] = useStudioErrorState();
  const node = nodes.find(n => n.id === block.nodeId);
  const current = node ? proposalFieldValue(node, block.field) : undefined;
  const adopted = block.status === 'adopted' || current === block.content;
  const changed = !adopted && current !== undefined && current !== block.snapshot;
  const adopt = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try { await onAdopt(block); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return <section className="studio-dialogue-adoption" aria-label="修改建议">
    <p>建议修改「{node?.title || '已删除的节点'}」的{FIELD_LABEL[block.field]}</p>
    <details><summary>查看修改稿</summary><p className="studio-dialogue-adoption-text">{block.content}</p></details>
    {changed && <p className="studio-dialogue-warning" role="status">这段内容在回复之后被你改过，为了不覆盖你的改动，这份修改稿不能直接采用。可以让我按最新内容重写。</p>}
    {!node && <p className="studio-dialogue-note">原节点已从画布删除。</p>}
    {!readOnly && <Button className={adopted ? undefined : 'studio-assistant-primary'} loading={busy} disabled={adopted || changed || !node || block.status === 'rejected'}
      title="写回原节点，不启动生成，不另扣积分" onClick={() => void adopt()}>{adopted ? '已采用' : '采用'}</Button>}
    {error && <p className="studio-assistant-error" role="alert"><span>{error}</span> <StudioErrorNotice error={error} autoReport={false} label="查看详情"/></p>}
  </section>;
}

function renderBlock(block: StudioMessageBlock, message: StudioDialogueMessage, props: MessageProps): ReactNode {
  const { handlers, nodes, readOnly, shortfalls } = props;
  switch (block.type) {
    case 'tool_call': return <StudioDialogueToolCard key={blockKey(block)} block={block} turnEnded={message.status === 'failed' ? 'failed' : message.status === 'interrupted' ? 'interrupted' : undefined}/>;
    case 'plan': return <StudioPlanCard key={blockKey(block)} block={block} skillLabel={handlers.skillLabel?.(block.plan)} onChooseApproach={readOnly ? undefined : title => (handlers.onQuickReply ?? handlers.onCompose)(`改用「${title}」这个做法，重新报价`)}/>;
    case 'approval': return readOnly
      ? <p key={blockKey(block)} className="studio-dialogue-note">确认卡（{block.status === 'approved' ? '已确认' : '没有确认'}）</p>
      : <StudioDialogueApprovalCard key={`${blockKey(block)}:${block.status}`} block={block} approved={handlers.approvedCaps?.(block)} shortfall={shortfalls[block.approvalId] ?? block.shortfall} planReady={handlers.planReady(block)}
        onStart={caps => handlers.onApprove(block, caps, message.id)} onRevise={handlers.onRevise}/>;
    case 'question': return <StudioDialogueQuestion key={blockKey(block)} block={block} answered={props.answered} busy={handlers.quickReplyBusy}
      onAnswer={readOnly ? undefined : handlers.onQuickReply ?? handlers.onCompose}/>;
    case 'adoption': return <AdoptionProposal key={blockKey(block)} block={block} nodes={nodes} readOnly={readOnly} onAdopt={handlers.onAdopt}/>;
  }
}

/** Reply prose, with raw action blocks from older replies folded into a closed record instead of read as text. */
function replyText(key: string, text: string): ReactNode[] {
  const { prose, actions } = splitReplyActions(text);
  return [
    ...(prose ? [<p key={key} className="studio-dialogue-text">{prose}</p>] : []),
    ...(actions ? [<details key={`${key}-actions`} className="studio-dialogue-raw-actions"><summary>这一轮的操作原文</summary><pre>{actions}</pre></details>] : []),
  ];
}

/** Text parts and blocks in arrival order; consecutive text parts read as one paragraph. */
function messageBody(message: StudioDialogueMessage, props: MessageProps): ReactNode[] {
  const { layout } = props;
  const out: ReactNode[] = [];
  const blocks = new Map(message.blocks.map(b => [`b:${blockKey(b)}`, b]));
  if (!layout) {
    if (message.text) out.push(...replyText("text", message.text));
    for (const b of message.blocks) out.push(renderBlock(b, message, props));
    return out;
  }
  let text = '', index = 0;
  const flush = () => { if (text) out.push(...replyText(`text-${index++}`, text)); text = ''; };
  const seen = new Set<string>();
  for (const key of layout.order) {
    if (key.startsWith('t:')) { text += layout.parts[key.slice(2)] || ''; continue; }
    const block = blocks.get(key);
    if (!block) continue;
    flush(); seen.add(key); out.push(renderBlock(block, message, props));
  }
  flush();
  for (const [key, block] of blocks) if (!seen.has(key)) out.push(renderBlock(block, message, props));
  return out;
}

type MessageProps = {
  message: StudioDialogueMessage; layout?: DialogueLayout; nodes: CanvasNodeData[]; readOnly?: boolean;
  queueLabel?: string; suggestions?: string[]; shortfalls: Record<string, number>; handlers: DialogueMessageHandlers;
  /** The running plan's step list, shown under the latest reply. */
  progress?: ReactNode;
  /** What the assistant is doing in this message right now (thinking, writing, running a tool); absent once the turn ends. */
  activity?: DialogueActivity;
  /** The newest reply: its actions stay visible; older ones show theirs on hover or keyboard focus (desktop). */
  latest?: boolean;
  /** The user has said something after this message, so its questions are closed. */
  answered?: boolean;
};

export function StudioDialogueMessageView(props: MessageProps) {
  const { message, nodes, readOnly, queueLabel, suggestions, handlers, activity, latest } = props;
  const [branching, setBranching] = useState(false), [placing, setPlacing] = useState(false), [error, setError] = useStudioErrorState();
  const user = message.role === 'user';
  const refs = [...(message.pinnedNodeIds || []), ...(message.attachmentNodeIds || [])];
  const tools = message.blocks.filter((b): b is DialogueToolBlock => b.type === 'tool_call' && !!b.creditsActual);
  const finished = ['done', 'failed', 'interrupted', 'applied', 'queued'].includes(message.status);
  const branch = async () => {
    if (!handlers.onBranch || branching) return;
    setBranching(true); setError('');
    try { await handlers.onBranch(message.id); } catch (e) { setError(e); } finally { setBranching(false); }
  };
  // A reply worth keeping as text (a draft, a description, copy): the start card promises it lands on the canvas, and the
  // model does not always call create_nodes (production 2026-10-19: a paid character description stayed in the chat).
  // A reply that asks something, proposes a plan or a change is not a draft to keep: its cards are what it is for.
  const prose = user ? '' : splitReplyActions(message.text || '').prose.trim();
  const placeable = !user && !readOnly && !!handlers.onPlaceText && message.role === 'assistant' && message.status === 'done' && prose.length >= 40
    && message.blocks.every(b => b.type === 'tool_call');
  // Already on the canvas (placed before, or written there by hand): the action shows it instead of placing it again.
  const placed = placeable && nodes.some(n => n.type === 'text' && n.metadata?.content === prose);
  const place = async () => {
    if (!handlers.onPlaceText || placing) return;
    setPlacing(true); setError('');
    try { await handlers.onPlaceText(message); } catch (e) { setError(e); } finally { setPlacing(false); }
  };
  const body = user ? [] : messageBody(message, props);
  return <article className={`studio-dialogue-message is-${message.role}${latest ? ' is-latest' : ''}${activity?.phase === 'writing' ? ' is-writing' : ''}`} data-status={message.status} aria-label={user ? '你的消息' : message.role === 'assistant' ? 'Studio 的回复' : '系统消息'}>
    <small className="studio-dialogue-author">{user ? '你' : message.role === 'assistant' ? 'Studio' : '提示'}</small>
    {user ? <p className="studio-dialogue-text">{message.text}</p> : body}
    {user && !!refs.length && <p className="studio-dialogue-refs">{refs.map(id => <span key={id} title={nodes.find(n => n.id === id)?.title}>{nodes.find(n => n.id === id)?.title || '已删除的画布对象'}</span>)}</p>}
    {user && queueLabel && <small className="studio-dialogue-queue" role="status">{queueLabel}</small>}
    {/* A running tool already says so on its own line (spinner, 「进行中」); the extra row is for thinking and writing. */}
    {!user && activity && activity.phase !== 'tool' && <StudioDialogueActivity activity={activity}/>}
    {!user && message.status === 'interrupted' && <small className="studio-dialogue-note">这一轮已停止</small>}
    {!user && message.status === 'failed' && <small className="studio-dialogue-warning">这一轮没有完成，可以换个说法再发一次</small>}
    {/* 设计稿 Main 画板：回复正文 → 逐步清单 → 建议；积分是最后一行小灰字，「放进画布」「从这里重新开始」是同一行右边的小图标。 */}
    {!user && props.progress}
    {!!suggestions?.length && !readOnly && <StudioDialogueSuggestions items={suggestions} busy={handlers.quickReplyBusy} onUse={handlers.onQuickReply ?? handlers.onCompose}/>}
    {!user && !readOnly && handlers.completionActions?.(message)}
    {((!user && (message.billing || message.settling)) || (!readOnly && handlers.onBranch && finished) || placeable) && <div className="studio-dialogue-meta">
      {!user && (message.billing || message.settling) && <footer className="studio-dialogue-footer">
        <span>{message.settling ? '本轮积分待结算' : `本轮回复 ${formatCredits(message.billing!.credits)} 积分`}</span>
        {!!tools.length && <details><summary>另有 {tools.length} 项工作记录，共 {formatCredits(tools.reduce((sum, t) => sum + (t.creditsActual || 0), 0))} 积分</summary>
          <ul>{tools.map(t => <li key={t.toolCallId}><span>{toolTitle(t)}</span><span>{formatCredits(t.creditsActual || 0)} 积分</span></li>)}</ul></details>}
      </footer>}
      {/* Small icon actions, as in common chat apps: the newest reply keeps them in view, older ones show them on hover
          or keyboard focus (desktop; phones always show them). Each has a name for screen readers and a tooltip. */}
      {((!readOnly && handlers.onBranch && finished) || placeable) && <div className="studio-dialogue-message-actions" role="group" aria-label="这条消息的操作">
        {placeable && <button type="button" className={`studio-dialogue-action${latest && !placed ? ' has-label' : ''}`} disabled={placing} aria-busy={placing || undefined}
          aria-label={placed ? '在画布上查看' : '放进画布'}
          title={placed ? '画布上已有这段文字，点一下定位过去' : '把这段回复建成画布上的文字节点，之后在画布上改，不另扣积分'} onClick={() => void place()}>
          {placing ? <LoaderCircle size={14} className="studio-dialogue-action-spin" aria-hidden="true"/> : placed ? <LocateFixed size={14} aria-hidden="true"/> : <FilePlus2 size={14} aria-hidden="true"/>}
          {latest && !placed && <span>{placing ? '正在放进画布' : '放进画布'}</span>}</button>}
        {!readOnly && handlers.onBranch && finished && <button type="button" className="studio-dialogue-action" disabled={branching} aria-busy={branching || undefined}
          aria-label="从这里重新开始" title="从这里重新开始：从这条消息另开一条对话，原来的对话保持不变" onClick={() => void branch()}>
          {branching ? <LoaderCircle size={14} className="studio-dialogue-action-spin" aria-hidden="true"/> : <GitBranch size={14} aria-hidden="true"/>}</button>}
      </div>}
    </div>}
    {error && <p className="studio-assistant-error" role="alert"><span>{error}</span> <StudioErrorNotice error={error} autoReport={false} label="查看详情"/></p>}
  </article>;
}
