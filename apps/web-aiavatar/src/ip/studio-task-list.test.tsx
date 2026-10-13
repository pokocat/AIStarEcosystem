// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import type { IpRun } from '@ai-star-eco/types';
import { StudioTaskList } from './studio-task-list';
vi.mock('./studio-errors', () => ({ reportStudioError: vi.fn(), studioRunError: (r: IpRun) => r.errorMessage }));
afterEach(cleanup);
const run = (id: string, status: IpRun['status'], extra = {}): IpRun => ({ id, projectId: 'p', nodeId: 'n', kind: 'studio-video', status, stage: 'generating', pct: 30, cost: 200, createdAt: '2026-10-13T12:34:56Z', inputs: {}, output: {}, ...extra } as IpRun);
const makeProps = () => ({ runs: [run('active123', 'running'), run('failure456', 'failed', { cost: 0, errorMessage: '参考图上传失败', errorCode: 'VIDEO_REF_UPLOAD_FAILED' }), run('done789', 'done'), run('stopped000', 'failed', { errorCode: 'IP_RUN_CANCELLED' })], nodes: [{ id: 'n', title: '表情视频', type: 'video', position: { x: 0, y: 0 }, metadata: { studio: { runId: 'failure456' } } }] as never, unconfirmed: [], loading: false, busy: false, hasMore: false, refreshErrors: {}, titleFor: () => '表情视频 · 5 秒', onInput: vi.fn(), onLocate: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn(), onReload: vi.fn(), onMore: vi.fn() });
test('filters failed jobs separately from stopped tasks and never retries on render', () => {
  const props = makeProps(); render(<StudioTaskList {...props}/>);
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('30');
  expect(screen.getByText('参考图上传失败')).toBeDefined();
  expect(props.onRetry).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '失败1' }));
  expect(screen.queryByText('已停止')).toBeNull(); expect(screen.queryByRole('progressbar')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '重新生成' })); expect(props.onRetry).toHaveBeenCalledOnce();
});
test('queued jobs display queue order rather than an invented progress bar and expose original cancellation', () => {
  const props = { ...makeProps(), runs: [run('q', 'running', { pct: 0, queue: { position: 3, running: 1 } })] }; render(<StudioTaskList {...props}/>);
  expect(screen.getByText('排队第 3 位')).toBeDefined(); expect(screen.queryByRole('progressbar')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '停止排队' })); expect(props.onCancel).toHaveBeenCalledWith(props.runs[0]);
});
test('only the task currently bound to the canvas node offers its result; older jobs identify themselves', () => {
  const props = { ...makeProps(), runs: [run('old123', 'done'), run('new456', 'done')], nodes: [{ ...makeProps().nodes[0], metadata: { studio: { runId: 'new456' } } }] as never }; render(<StudioTaskList {...props}/>);
  const old = document.querySelector('[data-task-id="old123"]') as HTMLElement;
  expect(within(old).getByRole('button', { name: '定位节点' })).toBeDefined(); expect(within(old).queryByRole('button', { name: '查看结果' })).toBeNull();
  expect(screen.getByText('#old123')).toBeDefined(); expect(screen.getByText('#new456')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: '查看结果' })); expect(props.onLocate).toHaveBeenCalledWith(props.nodes[0]);
});
test('history conversations open the assistant and partial jobs show the specific failed candidate', () => {
  const props = { ...makeProps(), runs: [run('partial', 'done', { stage: '部分视频生成失败', output: { videoCandidates: [{ status: 'failed', errorMessage: '供应商任务失败' }] } })], nodes: [{ ...makeProps().nodes[0], metadata: { studio: { conversation: {}, runId: 'partial' } } }] as never }; render(<StudioTaskList {...props}/>);
  expect(screen.getByText('部分完成')).toBeDefined(); expect(screen.getByText('供应商任务失败')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: '打开对话' })); expect(props.onLocate).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: '进行中0' })); expect(screen.getByText('当前没有进行中的任务')).toBeDefined();
});

test('failed assistant tasks offer reopening the conversation without a misleading automatic regeneration action', () => {
  const props = { ...makeProps(), runs: [run('failure456', 'failed', { errorMessage: '方案不完整' })], nodes: [{ ...makeProps().nodes[0], metadata: { studio: { conversation: {}, runId: 'failure456' } } }] as never }; render(<StudioTaskList {...props}/>);
  expect(screen.queryByRole('button', { name: '重新生成' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '打开对话' })); expect(props.onLocate).toHaveBeenCalledOnce(); expect(props.onRetry).not.toHaveBeenCalled();
});
