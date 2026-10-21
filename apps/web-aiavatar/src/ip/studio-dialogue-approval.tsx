'use client';
// The confirmation card in the timeline (docs/ip-studio-new-canvas-and-threads.md §4.2). It answers three things: what will be
// made, what it costs, which button to press. A plan quoted in the same reply rides on the card, so there is one card and not
// two; a card on its own (a budget raise, an older reply) lists its scope instead. The server still proposes the caps, still
// lets the card expire after 24 hours and still accepts a typed 「可以」 (StudioNaturalApprovals); the card does not explain
// any of that. Only a budget shortfall asks for a number. A confirmed card collapses to one line.
import { useEffect, useId, useState } from 'react';
import { Button } from 'antd';
import { formatCredits } from '@ai-star-eco/api-client';
import { formatDateTime } from '@/lib/datetime';
import type { DialogueApprovalBlock, DialoguePlanBlock } from '@/canvas-bridge/studio-dialogue-store';
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';
import { StudioPlanContent } from './studio-assistant-plan';

const TAG: Partial<Record<DialogueApprovalBlock['status'], string>> = { expired: '已过期', superseded: '已更新' };
export const approvalStatus = (block: DialogueApprovalBlock, now = Date.now()): DialogueApprovalBlock['status'] =>
  block.status === 'pending' && block.expiresAt && Date.parse(block.expiresAt) <= now ? 'expired' : block.status;

const whole = (value: string) => { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.round(n)) : NaN; };

export type ApprovedCaps = { budgetCap?: number; autoFixCap?: number; approvedAt?: string; planRevision?: number };

export function StudioDialogueApprovalCard({ block, plan, approved, shortfall, planReady, skillLabel, onStart, onRevise, onRequote, onChooseApproach }: {
  block: DialogueApprovalBlock;
  /** The plan this card was quoted for, when it came in the same reply: it is shown on the card instead of the scope. */
  plan?: DialoguePlanBlock;
  approved?: ApprovedCaps; shortfall?: number; planReady: boolean;
  /** Hover detail on the title (「按技能：…」); never shown as text. */
  skillLabel?: string;
  /** Always the server's proposal, except the new cap typed on a shortfall card. */
  onStart: (caps: { budgetCap: number; autoFixCap: number }) => Promise<unknown>; onRevise: () => void;
  /** 「重新报价」 on an expired card: sent as the user's message. */
  onRequote?: () => void;
  onChooseApproach?: (title: string) => void;
}) {
  // A raise card already proposes the cap it needs: the approved cap plus the shortfall (StudioPlanExecutor.raiseCard).
  const [cap, setCap] = useState(String(block.budgetCap)), capId = useId();
  useEffect(() => { setCap(String(block.budgetCap)); }, [block.approvalId, block.budgetCap]);
  const [busy, setBusy] = useState(false), [error, setError] = useStudioErrorState();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (block.status !== 'pending' || !block.expiresAt) return;
    const wait = Date.parse(block.expiresAt) - Date.now();
    if (!(wait > 0)) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(wait + 50, 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [block.status, block.expiresAt]);
  const status = approvalStatus(block, now);
  const actionable = status === 'pending';
  const analysis = block.stage === 'analysis';
  const title = analysis ? '确认分析' : '确认制作';
  const raise = !!shortfall && shortfall > 0;
  const newCap = whole(cap);
  const invalid = !raise ? '' : Number.isNaN(newCap) ? '请填写整数积分' : newCap < block.budgetCap ? `新的上限至少要 ${formatCredits(block.budgetCap)} 积分` : '';
  const start = async () => {
    if (busy || invalid || !actionable || !planReady) return;
    setBusy(true); setError('');
    try { await onStart({ budgetCap: raise ? newCap : block.budgetCap, autoFixCap: block.autoFixCap }); }
    catch (e) { setError(e); }
    finally { setBusy(false); }
  };
  const content = plan ? <StudioPlanContent plan={plan.plan} onChooseApproach={actionable ? onChooseApproach : undefined}/>
    : !!block.scope.length && <ul className="studio-dialogue-approval-scope" aria-label="这次会做">{block.scope.map((item, i) => <li key={i}>{item}</li>)}</ul>;
  const confirmedAt = approved?.approvedAt || block.approvedAt;
  if (status === 'approved') return <section className="studio-dialogue-approval" data-status={status} aria-label={title}>
    <details className="studio-dialogue-approval-done">
      <summary>已确认 · {formatCredits(block.quotedCost)} 积分</summary>
      {content}
      {confirmedAt && <p className="studio-dialogue-note">确认于 {formatDateTime(confirmedAt)}</p>}
    </details>
  </section>;
  return <section className="studio-dialogue-approval" data-status={status} aria-label={title}>
    <header><h4 title={skillLabel}>{title}</h4>{TAG[status] && <span>{TAG[status]}</span>}</header>
    {status === 'superseded' ? <p className="studio-dialogue-note">已有新的报价，见下方</p> : content}
    {status === 'expired' && <p className="studio-dialogue-note">报价已过期{onRequote && <button type="button" className="studio-dialogue-link" onClick={onRequote}>重新报价</button>}</p>}
    {actionable && <>
      {raise ? <div className="studio-dialogue-raise">
        <p className="studio-dialogue-warning" role="status">积分超出上限，还差 {formatCredits(shortfall ?? 0)} 积分</p>
        <div className="studio-dialogue-raise-field"><label htmlFor={capId}>新的上限</label>
          <input id={capId} type="number" inputMode="numeric" min={block.budgetCap} step={1} value={cap} disabled={busy} onChange={e => setCap(e.target.value)}/><span>积分</span></div>
      </div> : <p className="studio-dialogue-approval-price"><strong>{formatCredits(block.quotedCost)}</strong><span>积分</span></p>}
      {!planReady && <p className="studio-dialogue-note" role="status">方案还没到，稍等一下</p>}
      <div className="studio-dialogue-approval-actions">
        <Button className="studio-assistant-primary" type="primary" loading={busy} disabled={!!invalid || !planReady} onClick={() => void start()}>{raise ? '提高上限并继续' : analysis ? '开始分析' : '开始制作'}</Button>
        {!raise && <Button className="studio-dialogue-secondary" disabled={busy} onClick={onRevise}>先改改</Button>}
      </div>
      {invalid && <p className="studio-dialogue-warning" role="alert">{invalid}</p>}
    </>}
    {error && <p className="studio-assistant-error" role="alert"><span>{error}</span> <StudioErrorNotice error={error} autoReport={false} label="查看详情"/></p>}
  </section>;
}
