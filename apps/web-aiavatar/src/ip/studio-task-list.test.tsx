// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import type { IpRun } from '@ai-star-eco/types';
import { StudioTaskList } from './studio-task-list';
import { reportStudioError } from './studio-errors';
vi.mock('./studio-errors', () => ({ reportStudioError: vi.fn(), studioRunError: (r: IpRun) => r.errorMessage }));
afterEach(cleanup);
const run = (id: string, status: IpRun['status'], extra = {}): IpRun => ({ id, projectId: 'p', nodeId: 'n', kind: 'studio-video', status, stage: 'generating', pct: 30, cost: 200, createdAt: '2026-10-13T12:34:56Z', inputs: {}, output: {}, ...extra } as IpRun);
const makeProps = () => ({ runs: [run('active123', 'running'), run('failure456', 'failed', { cost: 0, errorMessage: '参考图上传失败', errorCode: 'VIDEO_REF_UPLOAD_FAILED' }), run('done789', 'done'), run('stopped000', 'failed', { errorCode: 'IP_RUN_CANCELLED' })], nodes: [{ id: 'n', title: '表情视频', type: 'video', position: { x: 0, y: 0 }, metadata: { studio: { runId: 'failure456' } } }] as never, unconfirmed: [], loading: false, busy: false, hasMore: false, refreshErrors: {}, titleFor: () => '表情视频 · 5 秒', onInput: vi.fn(), onLocate: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn(), onReload: vi.fn(), onMore: vi.fn() });
test.each([['generate','STUDIO_IMAGE_SUBMISSION_UNKNOWN'],['studio-video','VIDEO_SUBMISSION_UNKNOWN'],['studio-audio','STUDIO_SPEECH_SUBMISSION_UNKNOWN'],['studio-lip-sync','STUDIO_LIP_SYNC_SUBMISSION_UNKNOWN']])('%s review retains frozen credits without impossible stop or regeneration',(kind,errorCode)=>{
  const props={...makeProps(),runs:[run('unknown','running',{kind,stage:'provider.submission_unknown',pct:5,cost:30,errorCode})]};
  render(<StudioTaskList {...props}/>);
  expect(screen.getByText('生成遇到问题')).toBeDefined();
  expect(screen.getByText('冻结 30 积分')).toBeDefined();
  expect(screen.getByRole('status').textContent).toContain('显示失败后可以重新生成');
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.queryByRole('button',{name:'停止'})).toBeNull();
  expect(screen.queryByRole('button',{name:'重新生成'})).toBeNull();
  expect(props.onCancel).not.toHaveBeenCalled();expect(props.onRetry).not.toHaveBeenCalled();
});
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

test.each(['VIDEO_RECONCILIATION_PENDING','STUDIO_SPEECH_RECOVERING','STUDIO_LIP_SYNC_RECOVERING'])('%s shows recovery without frozen percent or stop',errorCode=>{
  render(<StudioTaskList {...makeProps()} runs={[run('recover','running',{pct:5,errorCode})]}/>);
  expect(screen.getByText('模型端仍在处理')).toBeDefined();expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.queryByRole('button',{name:'停止'})).toBeNull();expect(screen.getByRole('status').textContent).toBe('模型端仍在处理，请稍后查看状态');

});

test.each(['VIDEO_SUBMISSION_UNKNOWN','VIDEO_RECONCILIATION_PENDING','UNEXPECTED_MODEL_ERROR'])('%s remains inspectable before terminal failure',errorCode=>{
  const props={...makeProps(),runs:[run('diagnostic','running',{errorCode,errorMessage:'生成服务 HTTP 503 · 追查号 ABCDEF234567'})]};
  render(<StudioTaskList {...props}/>);
  expect(screen.getByText(props.runs[0].errorMessage!)).toBeDefined();
  fireEvent.click(screen.getByRole('button',{name:'查看错误详情'}));
  expect(reportStudioError).toHaveBeenCalledWith(props.runs[0].errorMessage);
  expect(screen.queryByRole('button',{name:'重新生成'})).toBeNull();
});

test('refreshes the original running task once, reports completion, and never retries generation',async()=>{
  let finish!:()=>void;
  const onRefresh=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));
  const props={...makeProps(),runs:[run('original','running',{errorCode:'VIDEO_RECONCILIATION_PENDING'})],onRefresh};
  render(<StudioTaskList {...props}/>);
  fireEvent.click(screen.getByRole('button',{name:'刷新结果'}));
  fireEvent.click(screen.getByRole('button',{name:'正在刷新…'}));
  expect(onRefresh).toHaveBeenCalledExactlyOnceWith(props.runs[0]);
  finish();await screen.findByText('已读取最新状态，未重新生成或扣费。');
  expect(props.onRetry).not.toHaveBeenCalled();expect(props.onCancel).not.toHaveBeenCalled();
});

test('shows actual grant and ordinary spend with the released remainder',()=>{
 const props={...makeProps(),runs:[run('priced','done',{cost:16,output:{billingBreakdown:{spent:{scopedCredits:15,walletCredits:1},pending:{scopedCredits:0,walletCredits:0},released:{scopedCredits:0,walletCredits:8}}}})]};
 render(<StudioTaskList {...props}/>);
 expect(screen.getByText('已消耗 16 积分')).toBeDefined();
 const detail=screen.getByLabelText('费用明细');expect(detail.textContent).toContain('模型赠款 15 积分 + 普通积分 1 积分');
 expect(detail.textContent).toContain('已解除冻结：普通积分 8 积分');expect(detail.textContent).not.toContain('冻结中');
});
