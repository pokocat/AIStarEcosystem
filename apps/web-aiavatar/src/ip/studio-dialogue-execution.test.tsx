// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { StudioPlanExecution } from '@ai-star-eco/types/ip-studio-workflow';
import { StudioDialogueExecution } from './studio-dialogue-execution';

afterEach(cleanup);

// Shape of the production execution of 2026-10-18: the film study failed and the strip only offered 「停止」.
const failedAnalysis = {
  id: 'PEX-1', projectId: 'P1', skillKey: 'reference-video-recreation', skillVersion: 1, stage: 'analysis', planRunId: 'IPR-1', planRevision: 2,
  planFingerprint: 'fp', status: 'needs_user', budgets: [], startedAt: '2026-10-19T03:11:01Z', deadlineAt: '2026-10-19T04:41:01Z', updatedAt: '2026-10-19T03:11:08Z',
  needsUserReason: '「参考视频分段拉片分析」没有完成：AI 生成失败，请稍后重试。可以继续重试这一步，或结束本次制作。',
  steps: [
    { id: 'cut', title: '参考视频分段拉片分析', operation: 'recreation', stage: 'analysis', dependsOn: [], status: 'failed', runIds: ['IPR-2'], attempt: 1, quotedCost: 21 },
    { id: 'compile', title: '编排制作计划', operation: 'text', stage: 'analysis', dependsOn: ['cut'], status: 'pending', runIds: [], attempt: 1, quotedCost: 21 }],
} as StudioPlanExecution;

test('a failed step can be retried from the strip; the retry is the server-side 「继续」', async () => {
  const onControl = vi.fn(async () => {});
  render(<StudioDialogueExecution execution={failedAnalysis} budget={{ approvedCap: 63, spent: 0 }} checks={[]} onControl={onControl}/>);
  expect(screen.getByText(failedAnalysis.needsUserReason!)).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: '重试这一步' }));
  await waitFor(() => expect(onControl).toHaveBeenCalledWith('resume'));
});

test('a step waiting for a go-ahead offers 「继续制作」; a budget shortfall goes through the raise card instead', () => {
  const confirm = { ...failedAnalysis, steps: [{ ...failedAnalysis.steps[0], status: 'needs_user' as const }, failedAnalysis.steps[1]] };
  const { rerender } = render(<StudioDialogueExecution execution={confirm} budget={{ approvedCap: 63, spent: 0 }} checks={[]} onControl={vi.fn()}/>);
  expect(screen.getByRole('button', { name: '继续制作' })).toBeDefined();
  rerender(<StudioDialogueExecution execution={confirm} budget={{ approvedCap: 63, spent: 0, shortfall: 9 }} checks={[]} onControl={vi.fn()}/>);
  expect(screen.queryByRole('button', { name: '继续制作' })).toBeNull();
  expect(screen.getByRole('button', { name: /停\s*止/ })).toBeDefined();
});

// Codex retest 2026-10-19 (R3): stopped for a new instruction after the last credits went on steering, no step was
// needs_user or failed, so the strip offered nothing and the run could not go on.
test('a run stopped for a new instruction can be continued from the strip', async () => {
  const onControl = vi.fn(async () => {});
  const steered = { ...failedAnalysis, needsUserReason: '收到新指令，等待重新确认', steps: failedAnalysis.steps.map(s => ({ ...s, status: s.id === 'cut' ? 'done' as const : 'pending' as const })) };
  render(<StudioDialogueExecution execution={steered} budget={{ approvedCap: 61, spent: 13 }} checks={[]} onControl={onControl}/>);
  fireEvent.click(screen.getByRole('button', { name: '继续制作' }));
  await waitFor(() => expect(onControl).toHaveBeenCalledWith('resume'));
});

// Production 2026-10-23 (PEX-fc87e857…): plan-compile named 「三视图」, which the run did not carry; 「继续」 failed the same
// way twice. The strip names the object, focuses it on the canvas, and offers add-and-replan or replan-without.
test('a plan stopped on a material outside the run names it and offers add or re-plan without it', async () => {
  const onControl = vi.fn(async () => {});
  const dispatched: Array<{ type?: string; nodeId?: string }> = [];
  const listen = (e: Event) => dispatched.push((e as CustomEvent).detail);
  window.addEventListener('studio-command', listen);
  const stopped = { ...failedAnalysis, needsUserReason: '「编排制作计划」停下了：方案要用画布上的「三视图」，但这次制作没有带上它。可以把它加入这次制作重新编排，或者不用它重新编排。',
    steps: [{ ...failedAnalysis.steps[0], status: 'done' as const }, { ...failedAnalysis.steps[1], status: 'failed' as const,
      materials: [{ nodeId: 'n-sheet', title: '三视图', onCanvas: true }, { nodeId: 'n-gone', title: '', onCanvas: false }] }] };
  render(<StudioDialogueExecution execution={stopped} budget={{ approvedCap: 63, spent: 7 }} checks={[]} onControl={onControl}/>);
  expect(screen.queryByRole('button', { name: '重试这一步' })).toBeNull();
  expect(screen.getByText('已不在画布上')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: '在画布上看' }));
  expect(dispatched.some(d => d?.nodeId === 'n-sheet')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '加入这次制作，重新编排' }));
  await waitFor(() => expect(onControl).toHaveBeenCalledWith('resume', { addMaterialNodeIds: ['n-sheet'] }));
  fireEvent.click(screen.getByRole('button', { name: '不用它，重新编排' }));
  await waitFor(() => expect(onControl).toHaveBeenLastCalledWith('resume'));
  window.removeEventListener('studio-command', listen);
});
