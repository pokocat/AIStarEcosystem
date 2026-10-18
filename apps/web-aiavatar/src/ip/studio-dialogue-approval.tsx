'use client';
// The action card that asks for an analysis or production authorization inside the timeline.
// All numbers are the server's quote. Editing the caps is only a draft; nothing is authorized
// until 「开始分析」/「开始制作」 is pressed. Approved, expired and replaced cards stay visible
// but can no longer be used. A confirmed card shows what was actually authorized (the server's
// approval snapshot, else that execution's budget), never the caps it first proposed.
import { useEffect, useState } from 'react';
import { Button } from 'antd';
import { ShieldCheck } from 'lucide-react';
import { formatCredits } from '@ai-star-eco/api-client';
import { formatDateTime } from '@/lib/datetime';
import type { DialogueApprovalBlock } from '@/canvas-bridge/studio-dialogue-store';
import { StudioErrorNotice, useStudioErrorState } from './studio-errors';

const STATUS_LABEL = { pending: '等你确认', approved: '已确认', expired: '已过期', superseded: '已被新方案替代' } as const;
export const approvalStatus = (block: DialogueApprovalBlock, now = Date.now()): DialogueApprovalBlock['status'] =>
  block.status === 'pending' && block.expiresAt && Date.parse(block.expiresAt) <= now ? 'expired' : block.status;

const whole = (value: string) => { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.round(n)) : NaN; };

export type ApprovedCaps = { budgetCap?: number; autoFixCap?: number; approvedAt?: string; planRevision?: number };

/** 「已确认 · 总上限 280 积分 · 重做上限 0 积分」; undefined when the authorized total is not known here. */
export function approvedSummary(stage: DialogueApprovalBlock['stage'], approved: ApprovedCaps | undefined) {
  if (approved?.budgetCap === undefined) return undefined;
  const fix = approved.autoFixCap ?? 0;
  return `已确认 · 总上限 ${formatCredits(approved.budgetCap)} 积分${stage === 'production' || fix > 0 ? ` · 重做上限 ${formatCredits(fix)} 积分` : ''}`;
}

export function StudioDialogueApprovalCard({ block, approved, shortfall, planReady, onStart, onRevise }: {
  block: DialogueApprovalBlock; approved?: ApprovedCaps; shortfall?: number; planReady: boolean;
  onStart: (caps: { budgetCap: number; autoFixCap: number }) => Promise<unknown>; onRevise: () => void;
}) {
  const [budgetCap, setBudgetCap] = useState(String(block.budgetCap)), [autoFixCap, setAutoFixCap] = useState(String(block.autoFixCap));
  const [busy, setBusy] = useState(false), [error, setError] = useStudioErrorState();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { setBudgetCap(String(block.budgetCap)); setAutoFixCap(String(block.autoFixCap)); }, [block.approvalId, block.budgetCap, block.autoFixCap]);
  useEffect(() => {
    if (block.status !== 'pending' || !block.expiresAt) return;
    const wait = Date.parse(block.expiresAt) - Date.now();
    if (!(wait > 0)) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(wait + 50, 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [block.status, block.expiresAt]);
  const status = approvalStatus(block, now);
  const actionable = status === 'pending';
  const cap = whole(budgetCap), fix = whole(autoFixCap);
  const invalid = Number.isNaN(cap) || Number.isNaN(fix) ? '请填写整数积分'
    : cap < block.quotedCost ? `总上限至少要 ${formatCredits(block.quotedCost)} 积分，才够当前报价`
      : fix > cap - block.quotedCost ? `重做额度最多 ${formatCredits(cap - block.quotedCost)} 积分（总上限减去报价）` : '';
  const analysis = block.stage === 'analysis';
  const label = analysis ? '开始分析' : '开始制作';
  const start = async () => {
    if (busy || invalid || !actionable) return;
    setBusy(true); setError('');
    try { await onStart({ budgetCap: cap, autoFixCap: fix }); }
    catch (e) { setError(e); }
    finally { setBusy(false); }
  };
  const confirmed = status === 'approved' ? approvedSummary(block.stage, approved) : undefined;
  const approvedWhen = status === 'approved' ? [approved?.approvedAt && `确认于 ${formatDateTime(approved.approvedAt)}`, approved?.planRevision && `第 ${approved.planRevision} 版方案`].filter(Boolean).join(' · ') : '';
  return <section className="studio-dialogue-approval" data-status={status} aria-label={analysis ? '确认分析' : '确认制作'}>
    <header><ShieldCheck size={16} aria-hidden="true"/><h4>{analysis ? '分析之前请确认' : '制作之前请确认'}</h4><span>{STATUS_LABEL[status]}</span></header>
    {!!block.scope.length && <ul className="studio-dialogue-approval-scope" aria-label="这次会做">{block.scope.map((item, i) => <li key={i}>{item}</li>)}</ul>}
    {actionable ? <p className="studio-dialogue-approval-quote">当前报价 {formatCredits(block.quotedCost)} 积分{block.autoFixCap > 0 ? `，重做额度最多 ${formatCredits(block.autoFixCap)} 积分` : ''}，总上限 {formatCredits(block.budgetCap)} 积分{block.dialogueReserve ? `（含一轮对话预留 ${formatCredits(block.dialogueReserve)} 积分）` : ''}。</p>
      : <p className="studio-dialogue-approval-quote">报价 {formatCredits(block.quotedCost)} 积分。</p>}
    {actionable && <div className="studio-dialogue-caps">
      <label><span>总上限（积分）</span><input type="number" inputMode="numeric" min={block.quotedCost} step={1} value={budgetCap} disabled={busy} onChange={e => setBudgetCap(e.target.value)}/></label>
      <label><span>其中重做额度</span><input type="number" inputMode="numeric" min={0} step={1} value={autoFixCap} disabled={busy} onChange={e => setAutoFixCap(e.target.value)}/></label>
    </div>}
    {actionable && <p className="studio-dialogue-note">改上限只是草稿，点「{label}」才生效。超出上限不会再提交新任务。</p>}
    {actionable && !!shortfall && shortfall > 0 && <p className="studio-dialogue-warning" role="status">本阶段预算还差 {formatCredits(shortfall)} 积分，确认新的上限后继续。</p>}
    {actionable && block.expiresAt && <p className="studio-dialogue-note">请在 {formatDateTime(block.expiresAt)} 前确认，过期后需要重新报价。</p>}
    {confirmed && <p className="studio-dialogue-note" role="status">{confirmed}</p>}
    {approvedWhen && <p className="studio-dialogue-note">{approvedWhen}</p>}
    {status === 'expired' && <p className="studio-dialogue-note">这张确认卡已过期，请让我重新报价。</p>}
    {status === 'superseded' && <p className="studio-dialogue-note">方案已经更新，请看下面最新的报价。</p>}
    {actionable && !planReady && <p className="studio-dialogue-warning">还没收到这次报价对应的方案，请稍等或刷新后再确认。</p>}
    {actionable && <div className="studio-dialogue-approval-actions">
      <Button className="studio-assistant-primary" type="primary" loading={busy} disabled={!!invalid || !planReady} title={analysis ? '确认后开始分析，按实际用量结算' : '确认后按方案开始制作，按实际用量结算'} onClick={() => void start()}>{label}</Button>
      <Button disabled={busy} onClick={onRevise}>先改改</Button>
    </div>}
    {actionable && invalid && <p className="studio-dialogue-warning" role="alert">{invalid}</p>}
    {error && <p className="studio-assistant-error" role="alert"><span>{error}</span> <StudioErrorNotice error={error} autoReport={false} label="查看详情"/></p>}
  </section>;
}
