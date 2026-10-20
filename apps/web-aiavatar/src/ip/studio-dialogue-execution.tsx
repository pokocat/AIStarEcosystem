'use client';
// The active analysis / production run: the strip under the assistant's header (stage, which step of how many,
// what has been spent against the approved cap, the controls) and the step list in the conversation.
// 「暂停」 keeps tasks already submitted running and stops new ones; 「停止」 also cancels tasks not yet started.
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

/** Which step the strip talks about: the one running, else the one waiting on the user or failed. */
function activeStep(steps: StudioPlanExecutionStep[]) {
  return steps.find(s => s.status === 'running' || s.status === 'submitted') || steps.find(s => s.status === 'needs_user' || s.status === 'failed');
}
const stageSteps = (execution: StudioPlanExecution) => execution.steps.filter(s => s.stage === execution.stage);

/**
 * 设计稿 Main 画板 · 助手头部下面的进度条：三行 ——
 * 「制作中 · 第 2 步，共 4 步」+ 已用积分 / 进度条 / 现在在做什么（真实排队位次）+ 暂停 停止。逐步的清单在对话里（StudioDialogueSteps）。
 */
export function StudioDialogueExecution({ execution, budget, checks, notice, onControl, queueOf }: {
  execution: StudioPlanExecution; budget?: Partial<StudioPlanExecutionBudget>; checks: StudioCheckResultData[]; notice?: string;
  onControl: (action: 'pause' | 'resume' | 'cancel') => Promise<void>;
  /** The real queue position of a step's task, when it is waiting for a slot (v0.221 queue tickets); never an estimate. */
  queueOf?: (step: StudioPlanExecutionStep) => number | undefined;
}) {
  const { modal } = useStudioApp();
  const [busy, setBusy] = useState<string>(), [error, setError] = useStudioErrorState();
  const steps = stageSteps(execution);
  const done = steps.filter(s => s.status === 'done' || s.status === 'skipped').length;
  const active = activeStep(steps);
  const progress = steps.length ? Math.round(done / steps.length * 100) : 0;
  const run = async (action: 'pause' | 'resume' | 'cancel') => {
    if (busy) return;
    setBusy(action); setError('');
    try { await onControl(action); } catch (e) { setError(e); } finally { setBusy(undefined); }
  };
  const cancel = () => modal.confirm({ title: '停止这次制作？', content: '还没开始的任务会取消；已经交给厂商的任务会照常完成并结算。', okText: '停止制作', cancelText: '再想想', okButtonProps: { danger: true }, onOk: () => run('cancel') });
  const live = execution.status === 'running', waiting = execution.status === 'paused' || execution.status === 'needs_user';
  // Waiting on the user (a failed step, a go-ahead, or a stop for a new instruction): the same 「继续」 the server already
  // supports (a failed step gets a new attempt; a next step over budget comes back as a raise card). An open shortfall
  // goes through its raise card, so no button then. Without a needs_user / failed step there used to be no button at all,
  // and a run stopped for steering that had used the last credits could not go on (Codex retest 2026-10-19, R3).
  const failed = steps.some(s => s.status === 'failed');
  const canContinue = execution.status === 'needs_user' && !budget?.shortfall;
  const stage = execution.stage === 'analysis' ? '分析' : '制作';
  const position = active ? steps.indexOf(active) + 1 : Math.min(done + 1, steps.length);
  const where = steps.length ? `第 ${position} 步，共 ${steps.length} 步` : '';
  const headline = live ? `${stage}中${where ? ` · ${where}` : ''}` : waiting ? `${STATUS[execution.status]}${where ? ` · ${where}` : ''}`
    : `${stage} · ${STATUS[execution.status]}${steps.length ? ` · 共 ${steps.length} 步` : ''}`;
  const queue = active && live ? queueOf?.(active) : undefined;
  const nowLine = live && active ? `${active.title}${queue ? `，排在队列第 ${queue} 位` : ` · ${STEP_STATUS[active.status]}`}`
    : waiting ? execution.needsUserReason || (execution.status === 'paused' ? '已暂停，已经提交的任务会做完' : '') : '';
  const controls = live || waiting;
  return <section className="studio-dialogue-execution" aria-label="制作进度" data-status={execution.status}>
    <div className="studio-dialogue-execution-head">
      <strong>{headline}</strong>
      {budget && budget.approvedCap !== undefined && <span className="studio-dialogue-execution-budget" title={[budget.inFlight ? `进行中的任务占用 ${formatCredits(budget.inFlight)} 积分` : '', (budget.dialogueSpent || budget.dialogueInFlight) ? dialogueShare(budget) : ''].filter(Boolean).join('；') || undefined}>
        已用 {formatCredits(budget.spent || 0)} / {formatCredits(budget.approvedCap)} 积分</span>}
    </div>
    <div className="studio-dialogue-execution-track" role="progressbar" aria-label="已完成的步骤" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}><span style={{ width: `${progress}%` }}/></div>
    {(nowLine || controls) && <div className="studio-dialogue-execution-now">
      <p className="studio-dialogue-note">{nowLine}</p>
      {controls && <div className="studio-dialogue-execution-actions">
        {live && <Button size="small" autoInsertSpace={false} loading={busy === 'pause'} disabled={!!busy} title="已经提交的任务会做完，之后不再提交新的" onClick={() => void run('pause')}>暂停</Button>}
        {execution.status === 'paused' && <Button size="small" autoInsertSpace={false} loading={busy === 'resume'} disabled={!!busy} onClick={() => void run('resume')}>继续制作</Button>}
        {canContinue && <Button size="small" autoInsertSpace={false} type="primary" loading={busy === 'resume'} disabled={!!busy} title={failed ? '重新提交没完成的那一步，按实际用量结算' : '确认后继续往下做'} onClick={() => void run('resume')}>{failed ? '重试这一步' : '继续制作'}</Button>}
        <Button size="small" autoInsertSpace={false} danger loading={busy === 'cancel'} disabled={!!busy} title="取消还没开始的任务，已交给厂商的会照常完成并结算" onClick={cancel}>停止</Button>
      </div>}
    </div>}
    {budget?.shortfall ? <p className="studio-dialogue-execution-budget"><b>还差 {formatCredits(budget.shortfall)} 积分</b></p> : null}
    {!!checks.length && <ul className="studio-dialogue-execution-checks" aria-label="检查结果">{checks.map(c => <li key={c.runId}>检查：{checkSummary(c)}</li>)}</ul>}
    {notice && <p className="studio-dialogue-warning" role="status">{notice}</p>}
    {error && <p className="studio-assistant-error" role="alert"><span>{error}</span> <StudioErrorNotice error={error} autoReport={false} label="查看详情"/></p>}
  </section>;
}

const STEP_LINE: Record<StudioPlanExecutionStep['status'], string> = { pending: '等前面做完', submitted: '已提交', running: '生成中', needs_user: '等你确认', done: '', skipped: '已跳过', failed: '没有完成' };

/**
 * 设计稿 Main 画板 · 对话里的逐步清单：完成的打勾、在做的转圈，结果在画布上的给「在画布上看」。
 * 只写真实的东西：排队写真实位次，不写预计时间；没有逐步的实付积分，所以不写每步花了多少。
 */
export function StudioDialogueSteps({ execution, locate, queueOf }: {
  execution: StudioPlanExecution;
  /** The canvas node a step's result lives in, when the canvas has it; 「在画布上看」 selects and scrolls to it. */
  locate?: (step: StudioPlanExecutionStep) => string | undefined;
  queueOf?: (step: StudioPlanExecutionStep) => number | undefined;
}) {
  const steps = stageSteps(execution);
  if (!steps.length) return null;
  return <ol className="studio-dialogue-steps" aria-label="各步进度">{steps.map(step => {
    const nodeId = locate?.(step), queue = step.status === 'running' || step.status === 'submitted' ? queueOf?.(step) : undefined;
    const line = queue ? `排队第 ${queue} 位` : STEP_LINE[step.status];
    return <li key={step.id} data-status={step.status}>
      <span className="studio-dialogue-step-mark" aria-label={STEP_STATUS[step.status]}>{step.status === 'done' && <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7"/></svg>}</span>
      <span className="studio-dialogue-step-title" title={step.title}>{step.title}{line && <small> · {line}</small>}</span>
      {nodeId ? <button type="button" className="studio-dialogue-link" onClick={() => dispatchStudioCommand('focus', nodeId)}>在画布上看</button> : <span/>}
    </li>;
  })}</ol>;
}
