'use client';
// Compact strip for the active analysis / production run: stage, how many items are done,
// what has been spent against the approved cap, and the controls. 「暂停后续」 keeps tasks
// already submitted running and stops new ones; 「停止」 also cancels tasks not yet started.
import { useState } from 'react';
import { Button } from 'antd';
import { formatCredits } from '@ai-star-eco/api-client';
import type { StudioCheckResultData, StudioPlanExecution, StudioPlanExecutionBudget, StudioPlanExecutionStep } from '@ai-star-eco/types/ip-studio-workflow';
import { dispatchStudioCommand } from '@/canvas-bridge/studio-nodes';
import { StudioErrorNotice, useStudioApp, useStudioErrorState } from './studio-errors';

const STATUS = { running: '进行中', paused: '已暂停', needs_user: '等你确认', done: '已完成', partial: '部分完成', failed: '没有完成', canceled: '已停止' } as const;
const STEP_STATUS: Record<StudioPlanExecutionStep['status'], string> = { pending: '等前面做完', submitted: '已提交', running: '进行中', needs_user: '等你确认', done: '已完成', skipped: '已跳过', failed: '没有完成' };

export function checkSummary(check: StudioCheckResultData) {
  const count = (status: string) => check.result.items.filter(i => i.status === status).length;
  const parts = [count('pass') && `通过 ${count('pass')} 项`, count('fail') && `没通过 ${count('fail')} 项`, count('unknown') && `无法判断 ${count('unknown')} 项`].filter(Boolean);
  return parts.length ? parts.join('，') : '没有检查项';
}

/** The dialogue's share of the stage budget; already counted in the line above, shown only as a breakdown. */
export function dialogueShare(budget: Partial<StudioPlanExecutionBudget>) {
  return `其中对话 ${formatCredits(budget.dialogueSpent || 0)} 积分${budget.dialogueInFlight ? `，对话进行中占用 ${formatCredits(budget.dialogueInFlight)} 积分` : ''}`;
}

export function StudioDialogueExecution({ execution, budget, checks, notice, onControl, locate }: {
  execution: StudioPlanExecution; budget?: Partial<StudioPlanExecutionBudget>; checks: StudioCheckResultData[]; notice?: string;
  onControl: (action: 'pause' | 'resume' | 'cancel') => Promise<void>;
  /** The canvas node a step's result lives in, when the canvas has it; 「在画布上看」 selects and scrolls to it. */
  locate?: (step: StudioPlanExecutionStep) => string | undefined;
}) {
  const { modal } = useStudioApp();
  const [busy, setBusy] = useState<string>(), [error, setError] = useStudioErrorState();
  const stageSteps = execution.steps.filter(s => s.stage === execution.stage);
  const done = stageSteps.filter(s => s.status === 'done' || s.status === 'skipped').length;
  const active = stageSteps.find(s => s.status === 'running' || s.status === 'submitted') || stageSteps.find(s => s.status === 'needs_user' || s.status === 'failed');
  const progress = stageSteps.length ? Math.round(done / stageSteps.length * 100) : 0;
  const run = async (action: 'pause' | 'resume' | 'cancel') => {
    if (busy) return;
    setBusy(action); setError('');
    try { await onControl(action); } catch (e) { setError(e); } finally { setBusy(undefined); }
  };
  const cancel = () => modal.confirm({ title: '停止这次制作？', content: '还没开始的任务会取消；已经交给厂商的任务会照常完成并结算。', okText: '停止制作', cancelText: '再想想', okButtonProps: { danger: true }, onOk: () => run('cancel') });
  const live = execution.status === 'running', waiting = execution.status === 'paused' || execution.status === 'needs_user';
  // Waiting on the user because a step failed or needs a go-ahead: the same 「继续」 the server already supports
  // (a failed step gets a new attempt). A budget shortfall goes through the raise card instead, so no button here.
  const failed = stageSteps.some(s => s.status === 'failed');
  const canContinue = execution.status === 'needs_user' && !budget?.shortfall && (failed || stageSteps.some(s => s.status === 'needs_user'));
  return <section className="studio-dialogue-execution" aria-label="制作进度" data-status={execution.status}>
    <div className="studio-dialogue-execution-head">
      <strong>{execution.stage === 'analysis' ? '分析' : '制作'} · {STATUS[execution.status]}</strong>
      <span>已完成 {done}/{stageSteps.length} 项</span>
    </div>
    <div className="studio-dialogue-execution-track" role="progressbar" aria-label="已完成的步骤" aria-valuemin={0} aria-valuemax={stageSteps.length} aria-valuenow={done}><span style={{ width: `${progress}%` }}/></div>
    {active && live && <p className="studio-dialogue-note">{active.title} · {STEP_STATUS[active.status]}</p>}
    {budget && budget.approvedCap !== undefined && <p className="studio-dialogue-execution-budget">
      已用 {formatCredits(budget.spent || 0)} / {formatCredits(budget.approvedCap)} 积分{budget.inFlight ? `，进行中的任务占用 ${formatCredits(budget.inFlight)} 积分` : ''}
      {budget.shortfall ? <b>，还差 {formatCredits(budget.shortfall)} 积分</b> : null}
    </p>}
    {budget && (!!budget.dialogueSpent || !!budget.dialogueInFlight) && <p className="studio-dialogue-note">{dialogueShare(budget)}</p>}
    {execution.needsUserReason && waiting && <p className="studio-dialogue-note">{execution.needsUserReason}</p>}
    {!!stageSteps.length && <details className="studio-dialogue-execution-steps">
      <summary>各步进度</summary>
      <ol>{stageSteps.map(step => { const nodeId = locate?.(step); return <li key={step.id} data-status={step.status}>
        <span title={step.title}>{step.title}</span><small>{STEP_STATUS[step.status]}</small>
        {nodeId && <button type="button" className="studio-dialogue-link" onClick={() => dispatchStudioCommand('focus', nodeId)}>在画布上看</button>}
      </li>; })}</ol>
    </details>}
    {!!checks.length && <ul className="studio-dialogue-execution-checks" aria-label="检查结果">{checks.map(c => <li key={c.runId}>检查：{checkSummary(c)}</li>)}</ul>}
    {notice && <p className="studio-dialogue-warning" role="status">{notice}</p>}
    {(live || waiting) && <div className="studio-dialogue-execution-actions">
      {live && <Button size="small" loading={busy === 'pause'} disabled={!!busy} title="已经提交的任务会做完，之后不再提交新的" onClick={() => void run('pause')}>暂停后续</Button>}
      {execution.status === 'paused' && <Button size="small" loading={busy === 'resume'} disabled={!!busy} onClick={() => void run('resume')}>继续制作</Button>}
      {canContinue && <Button size="small" type="primary" loading={busy === 'resume'} disabled={!!busy} title={failed ? '重新提交没完成的那一步，按实际用量结算' : '确认后继续往下做'} onClick={() => void run('resume')}>{failed ? '重试这一步' : '继续制作'}</Button>}
      <Button size="small" danger loading={busy === 'cancel'} disabled={!!busy} title="取消还没开始的任务，已交给厂商的会照常完成并结算" onClick={cancel}>停止</Button>
    </div>}
    {error && <p className="studio-assistant-error" role="alert"><span>{error}</span> <StudioErrorNotice error={error} autoReport={false} label="查看详情"/></p>}
  </section>;
}
