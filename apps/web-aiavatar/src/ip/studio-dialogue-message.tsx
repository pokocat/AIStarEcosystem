'use client';
// One message in the thread. Assistant text streams in by part; typed blocks render as
// work records, plans, confirmation cards, inline questions and adoption proposals, in the
// order they arrived (a reloaded message shows its text first, then its blocks). A plan and the
// card quoted for it in the same reply render as one card (docs/ip-studio-new-canvas-and-threads.md §4.2).
import { useState, type ReactNode } from 'react';
import { Button } from 'antd';
import { Check, CheckCheck, Clock, FilePlus2, GitBranch, LoaderCircle, LocateFixed } from 'lucide-react';
import { formatCredits } from '@ai-star-eco/api-client';
import type { StudioDialogueMessage, StudioMessageBlock, StudioPlan } from '@ai-star-eco/types/ip-studio-workflow';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { blockKey, type DialogueActivity, type DialogueAdoptionBlock, type DialogueApprovalBlock, type DialogueLayout, type DialoguePlanBlock, type DialogueQueueState } from '@/canvas-bridge/studio-dialogue-store';
import { proposalFieldValue } from '@/canvas-bridge/studio-plan-execution';
import { splitReplyActions } from '@/canvas-bridge/studio-reply-actions';
import { completionExecutionId } from '@/canvas-bridge/studio-skills';
import { StudioDialogueToolCard } from './studio-dialogue-tool';
import { StudioDialogueApprovalCard, type ApprovedCaps } from './studio-dialogue-approval';
import { StudioDialogueQuestion, StudioDialogueSuggestions } from './studio-dialogue-question';
import { StudioPlanCard } from './studio-assistant-plan';
import { StudioDialogueActivity } from './studio-dialogue-activity';
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';

const FIELD_LABEL = { content: '正文', prompt: '提示词', script: '剧本正文' } as const;

// Where a sent message stands is a small grey icon under the bubble, not a line of text (user feedback 2026-10-21:
// 「没必要这么显眼」). The words stay in one place, here: they are the icon's name for screen readers and the hover tip.
// A send that failed is not here: it needs the user, so it stays text with its retry (studio-dialogue-timeline.tsx).
const QUEUE_MARK = {
  sending: { Icon: LoaderCircle, label: '发送中' },
  accepted: { Icon: Check, label: '已收到' },
  queued: { Icon: Clock, label: '排队中，下一步应用' },
  applied: { Icon: CheckCheck, label: '已应用' },
} as const;

export function StudioDialogueQueueMark({ state }: { state: DialogueQueueState | 'sending' }) {
  const { Icon, label } = QUEUE_MARK[state];
  return <small className="studio-dialogue-queue is-mark" data-state={state} role="status" title={label}>
    <Icon size={13} role="img" aria-label={label} className={state === 'sending' ? 'studio-dialogue-action-spin' : undefined}/>
  </small>;
}

export type DialogueMessageHandlers = {
  onCompose: (text: string) => void;
  /** A question option or a follow-up suggestion: sent at once as the user's message; the draft stays. Absent = fill the composer. */
  onQuickReply?: (text: string) => void;
  /** A message is on its way (or the thread is not ready): chips wait instead of sending a second one. */
  quickReplyBusy?: boolean;
  onRevise: () => void;
  onApprove: (block: DialogueApprovalBlock, caps: { budgetCap: number; autoFixCap: number }, messageId: string) => Promise<unknown>;
  /** The card whose confirmation's answer was lost and is being sent again; `onRecheck` sends it now. */
  verifyingApprovalId?: string; onRecheck?: () => void;
  planReady: (block: DialogueApprovalBlock) => boolean;
  /** What a confirmed card actually authorized (never the proposal); see approvedCaps in the store. */
  approvedCaps?: (block: DialogueApprovalBlock) => ApprovedCaps | undefined;
  onAdopt: (block: DialogueAdoptionBlock) => Promise<void>;
  onBranch?: (messageId: string) => Promise<void>;
  /** 「放进画布」: the reply's text becomes a text node (or the one already holding it comes into view). */
  onPlaceText?: (message: StudioDialogueMessage) => Promise<void>;
  /** 「按技能：名称 v2」 for a plan planned with a skill version: a hover detail on the card title, never shown as text. */
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
    {changed && <p className="studio-dialogue-warning" role="status">你改过这段内容，这份修改稿不再适用</p>}
    {!node && <p className="studio-dialogue-note">原节点已从画布删除。</p>}
    {!readOnly && <Button className={adopted ? undefined : 'studio-assistant-primary'} loading={busy} disabled={adopted || changed || !node || block.status === 'rejected'}
      title="写回原节点" onClick={() => void adopt()}>{adopted ? '已采用' : '采用'}</Button>}
    {error && <p className="studio-assistant-error" role="alert"><span>{error}</span> <StudioErrorNotice error={error} autoReport={false} label="查看详情"/></p>}
  </section>;
}

/** Tools that put or change nodes on the canvas; a reply that used them has nothing left to place. */
const CANVAS_TOOLS = new Set(['create_nodes', 'update_nodes', 'propose_text']);
const touchesCanvas = (block: StudioMessageBlock) => block.type === 'tool_call' && (CANVAS_TOOLS.has(block.toolName) || !!block.result?.nodeIds?.length);

/** The plan a card in the same reply was quoted for (same fingerprint): it is shown on that card, not as a card of its own. */
function quotedPlan(message: StudioDialogueMessage, approval: DialogueApprovalBlock): DialoguePlanBlock | undefined {
  return message.blocks.find((b): b is DialoguePlanBlock => b.type === 'plan' && b.fingerprint === approval.planFingerprint);
}

function renderBlock(block: StudioMessageBlock, message: StudioDialogueMessage, props: MessageProps): ReactNode {
  const { handlers, nodes, readOnly, shortfalls } = props;
  const say = handlers.onQuickReply ?? handlers.onCompose;
  const chooseApproach = readOnly ? undefined : (title: string) => say(`改用「${title}」这个做法，重新报价`);
  switch (block.type) {
    case 'tool_call': return <StudioDialogueToolCard key={blockKey(block)} block={block} turnEnded={message.status === 'failed' ? 'failed' : message.status === 'interrupted' ? 'interrupted' : undefined}/>;
    case 'plan':
      // Its card renders it (an earlier, read-only conversation keeps them apart: there is no card to act on).
      if (!readOnly && message.blocks.some(b => b.type === 'approval' && b.planFingerprint === block.fingerprint)) return null;
      return <StudioPlanCard key={blockKey(block)} block={block} skillLabel={handlers.skillLabel?.(block.plan)} onChooseApproach={chooseApproach}/>;
    case 'approval': {
      if (readOnly) return <p key={blockKey(block)} className="studio-dialogue-note">{block.status === 'approved' ? `已确认 · ${formatCredits(block.quotedCost)} 积分` : '没有确认'}</p>;
      const plan = quotedPlan(message, block);
      return <StudioDialogueApprovalCard key={`${blockKey(block)}:${block.status}`} block={block} plan={plan} skillLabel={plan && handlers.skillLabel?.(plan.plan)}
        approved={handlers.approvedCaps?.(block)} shortfall={shortfalls[block.approvalId] ?? block.shortfall} planReady={handlers.planReady(block)}
        verifying={!!handlers.verifyingApprovalId && handlers.verifyingApprovalId === block.approvalId} onRecheck={handlers.onRecheck}
        onStart={caps => handlers.onApprove(block, caps, message.id)} onRevise={handlers.onRevise} onRequote={() => say('重新报价')} onChooseApproach={chooseApproach}/>;
    }
    case 'question': return <StudioDialogueQuestion key={blockKey(block)} block={block} answered={props.answered} busy={handlers.quickReplyBusy}
      onAnswer={readOnly ? undefined : handlers.onQuickReply ?? handlers.onCompose}/>;
    case 'adoption': return <AdoptionProposal key={blockKey(block)} block={block} nodes={nodes} readOnly={readOnly} onAdopt={handlers.onAdopt}/>;
  }
}

/** Reply prose, with raw action blocks from older replies folded into a closed record instead of read as text. */
function replyText(key: string, text: string): ReactNode[] {
  const split = splitReplyActions(text), actions = split.actions;
  // A text part after a tool record starts with the paragraph break between model calls; under pre-wrap that is a blank gap.
  const prose = split.prose.trim();
  return [
    ...(prose ? [<p key={key} className="studio-dialogue-text">{prose}</p>] : []),
    ...(actions ? [<details key={`${key}-actions`} className="studio-dialogue-raw-actions"><summary>这一轮没有执行的操作原文</summary><pre>{actions}</pre></details>] : []),
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
  queueState?: DialogueQueueState; suggestions?: string[]; shortfalls: Record<string, number>; handlers: DialogueMessageHandlers;
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
  const { message, nodes, readOnly, queueState, suggestions, handlers, activity, latest } = props;
  const [branching, setBranching] = useState(false), [placing, setPlacing] = useState(false), [error, setError] = useStudioErrorState();
  const user = message.role === 'user';
  const refs = [...(message.pinnedNodeIds || []), ...(message.attachmentNodeIds || [])];
  // One number per reply: the reply and its work records together (§4.3).
  const credits = (message.billing?.credits || 0) + message.blocks.reduce((sum, b) => sum + (b.type === 'tool_call' ? b.creditsActual || 0 : 0), 0);
  // A free reply (the demo) says nothing about credits, and neither does the summary closing an execution: its text
  // already says 「花了 N 积分」 (StudioExecutionSummary), a second number under it only repeats it.
  const summary = !user && !!completionExecutionId(message);
  const costShown = !summary && (!!message.settling || (!!message.billing && credits > 0));
  const finished = ['done', 'failed', 'interrupted', 'applied', 'queued'].includes(message.status);
  const branch = async () => {
    if (!handlers.onBranch || branching) return;
    setBranching(true); setError('');
    try { await handlers.onBranch(message.id); } catch (e) { setError(e); } finally { setBranching(false); }
  };
  // A reply worth keeping as text (a draft, a description, copy): the start card promises it lands on the canvas, and the
  // model does not always call create_nodes (production 2026-10-19: a paid character description stayed in the chat).
  // Not offered where it would only copy talk onto the canvas: a reply that asks something, proposes a plan or a change
  // (its cards are what it is for), the summary closing an execution (its results are already there), or a reply whose
  // tools already put or changed nodes on the canvas (user feedback 2026-10-20).
  const prose = user ? '' : splitReplyActions(message.text || '').prose.trim();
  const placeable = !user && !readOnly && !!handlers.onPlaceText && message.role === 'assistant' && message.status === 'done' && prose.length >= 80
    && !summary && message.blocks.every(b => b.type === 'tool_call' && !touchesCanvas(b));
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
    {user && queueState && <StudioDialogueQueueMark state={queueState}/>}
    {/* A running tool already says so on its own line (spinner, 「进行中」); the extra row is for thinking and writing. */}
    {!user && activity && activity.phase !== 'tool' && <StudioDialogueActivity activity={activity}/>}
    {!user && message.status === 'interrupted' && <small className="studio-dialogue-note">已停止</small>}
    {!user && message.status === 'failed' && <small className="studio-dialogue-warning">没有完成，换个说法再试试</small>}
    {/* 设计稿 Main 画板：回复正文 → 逐步清单 → 建议；积分是最后一行小灰字，「放进画布」「从这里重新开始」是同一行右边的小图标。 */}
    {!user && props.progress}
    {!!suggestions?.length && !readOnly && <StudioDialogueSuggestions items={suggestions} busy={handlers.quickReplyBusy} onUse={handlers.onQuickReply ?? handlers.onCompose}/>}
    {!user && !readOnly && handlers.completionActions?.(message)}
    {((!user && costShown) || (!readOnly && handlers.onBranch && finished) || placeable) && <div className="studio-dialogue-meta">
      {!user && costShown && <footer className="studio-dialogue-footer">
        <span>{message.settling ? '积分结算中' : `${formatCredits(credits)} 积分`}</span>
      </footer>}
      {/* Small icon actions, as in common chat apps: the newest reply keeps them in view, older ones show them on hover
          or keyboard focus (desktop; phones always show them). Each has a name for screen readers and a tooltip. */}
      {((!readOnly && handlers.onBranch && finished) || placeable) && <div className="studio-dialogue-message-actions" role="group" aria-label="这条消息的操作">
        {placeable && <button type="button" className={`studio-dialogue-action${latest && !placed ? ' has-label' : ''}`} disabled={placing} aria-busy={placing || undefined}
          aria-label={placed ? '在画布上查看' : '放进画布'}
          title={placed ? '画布上已有这段文字' : '把这段回复放进画布，成为一个文字节点'} onClick={() => void place()}>
          {placing ? <LoaderCircle size={14} className="studio-dialogue-action-spin" aria-hidden="true"/> : placed ? <LocateFixed size={14} aria-hidden="true"/> : <FilePlus2 size={14} aria-hidden="true"/>}
          {latest && !placed && <span>{placing ? '正在放进画布' : '放进画布'}</span>}</button>}
        {!readOnly && handlers.onBranch && finished && <button type="button" className="studio-dialogue-action" disabled={branching} aria-busy={branching || undefined}
          aria-label="从这里重新开始" title="从这条消息另开一段对话，原来的对话保留" onClick={() => void branch()}>
          {branching ? <LoaderCircle size={14} className="studio-dialogue-action-spin" aria-hidden="true"/> : <GitBranch size={14} aria-hidden="true"/>}</button>}
      </div>}
    </div>}
    {error && <p className="studio-assistant-error" role="alert"><span>{error}</span> <StudioErrorNotice error={error} autoReport={false} label="查看详情"/></p>}
  </article>;
}
