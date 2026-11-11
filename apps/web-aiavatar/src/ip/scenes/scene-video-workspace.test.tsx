// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { StudioVideoTask } from '@ai-star-eco/types/ip-studio-video-task';
const api = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), readRun: vi.fn(), readVideoJob: vi.fn(), signKeys: vi.fn(), resume: vi.fn(), deleteProject: vi.fn() }));
vi.mock('@/ip/api', () => ({ IpStudioApi: { deleteProject: api.deleteProject } }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/canvas-bridge/studio-video-tasks', async original => ({ ...await original<any>(), videoTasks: api.list, videoTask: api.get }));
vi.mock('@/canvas-bridge/api', () => ({ readRun: api.readRun, readVideoJob: api.readVideoJob, signKeys: api.signKeys, cancelRun: vi.fn() }));
vi.mock('@/canvas-bridge/studio-plan-execution', async original => ({ ...await original<any>(), resumeStudioPlanExecution: api.resume }));
vi.mock('@/canvas-bridge/signed-image', () => ({ SignedImage: ({ storageKey, alt }: any) => <span role="img" aria-label={alt} data-key={storageKey}/> }));
vi.mock('@/canvas-bridge/signed-video', () => ({ SignedVideo: ({ storageKey, ...p }: any) => <video {...p} data-key={storageKey}/> }));
import { useState } from 'react';
import { SceneVideoWorkspace, VideoHistoryToggle, VideoTaskSettings, videoTaskPhases } from './scene-video-workspace';
const task = (id: string, kind: StudioVideoTask['kind'] = 'direct') => ({ id, kind, title: id, projectId: `IPP-${id}`, sceneId: 'drama-twist', createdAt: '2026-11-06T00:00:00Z',
  execution: { id, projectId: `IPP-${id}`, status: 'running', stage: 'production', steps: [{ id: 'v1', title: '第一段', operation: 'video', status: 'pending', stage: 'production', attempt: 1, runIds: [], dependsOn: [] }], budgets: [], updatedAt: '2026-11-06' },
  input: { nodes: [], sceneVideoState: { text: '保留这一版要求', duration: 40, ratio: '9:16', tier: '720p', options: {} } } }) as unknown as StudioVideoTask;
const props = { enabled: true, onSelect: vi.fn(), onDraft: vi.fn(), drafts: [], railOpen: false, onRail: vi.fn(), persist: vi.fn().mockResolvedValue(undefined), children: <p>尚未制作</p> };
beforeEach(() => { sessionStorage.clear(); window.history.replaceState(null, '', '/video?scene=drama-twist'); api.list.mockResolvedValue({ items: [], page: 0, hasMore: false }); api.signKeys.mockResolvedValue({}); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
test.each(['direct', 'segmented', 'recreation'] as const)('%s uses the same durable recent-task entry', async kind => {
  const saved = task('PEX-one', kind); api.list.mockResolvedValue({ items: [saved], page: 0, hasMore: false });
  render(<SceneVideoWorkspace {...props}/>); fireEvent.click(await screen.findByRole('button', { name: /PEX-one/ })); expect(props.onSelect).toHaveBeenCalledWith(saved);
});
test('returning to the video page restores the selected task without submitting work', async () => {
  window.history.replaceState(null, '', '/video'); sessionStorage.setItem('studio:video:selected-task', 'PEX-old');
  const saved = task('PEX-old'); api.get.mockResolvedValue(saved); render(<SceneVideoWorkspace {...props}/>);
  await waitFor(() => expect(props.onSelect).toHaveBeenCalledWith(saved)); expect(api.get).toHaveBeenCalledWith('PEX-old');
});
test('a late response from a previously selected task cannot replace the new selection', async () => {
  let oldResolve!: (t: StudioVideoTask) => void; const old = new Promise<StudioVideoTask>(r => { oldResolve = r; });
  const newer = task('PEX-new'); api.get.mockImplementation(id => id === 'PEX-old' ? old : Promise.resolve(newer));
  const mounted = render(<SceneVideoWorkspace {...props} taskId="PEX-old"/>);
  mounted.rerender(<SceneVideoWorkspace {...props} taskId="PEX-new"/>);
  await waitFor(() => expect(props.onSelect).toHaveBeenCalledWith(newer));
  await act(async () => { oldResolve(task('PEX-old')); await old; });
  expect(props.onSelect).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'PEX-old' }));
});
test('historical inputs are read-only; 再次生成 puts them back and 裂变生成 makes new takes', () => {
  const more = vi.fn(), edit = vi.fn(), failed = take('PEX-one', '2026-11-06T00:00:00Z', 'a'); failed.execution!.status = 'needs_user';
  render(<VideoTaskSettings task={failed} head={null} onMore={more} onEdit={edit}/>);
  expect(screen.getByText('保留这一版要求')).toBeTruthy(); expect(screen.queryByRole('textbox')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '裂变生成' })); expect(more).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: '再次生成' })); expect(edit).toHaveBeenCalledOnce();
});
// 2026-11-10 用户：底部是两个按钮，「再次生成」原样回到编辑页，「裂变生成」开视频裂变（取代 11-09 合成一个入口）。
test.each(['running', 'done', 'needs_user', 'partial', 'paused', 'canceled'] as const)('%s keeps one 再次生成 and one 裂变生成 in the settings footer', async status => {
  const saved = take('PEX-edit', '2026-11-06T00:00:00Z', 'a'); saved.execution!.status = status;
  if (status === 'done') saved.run = { id: 'IPR-final', status: 'done', output: { storageKey: 'final.mp4' } } as StudioVideoTask['run'];
  api.get.mockResolvedValue(saved);
  const more = vi.fn(), edit = vi.fn();
  await act(async () => { render(<><VideoTaskSettings task={saved} head={null} onMore={more} onEdit={edit}/><SceneVideoWorkspace {...props} taskId={saved.id} selected={saved}/></>); });
  const settings = screen.getByRole('region', { name: '本次设置' });
  const button = within(settings).getByRole('button', { name: '裂变生成' });
  expect(button.closest('footer')?.parentElement).toBe(settings);
  if (status === 'done') await screen.findByRole('button', { name: '下载视频' });
  expect(screen.getAllByRole('button', { name: '裂变生成' })).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: '再次生成' })).toHaveLength(1);
  expect(screen.queryByRole('button', { name: '视频裂变' })).toBeNull();
  fireEvent.click(button); expect(more).toHaveBeenCalledOnce();
});
test('the settings panel hides empty rows and only offers what was saved', () => {
  // 只有设置、没有提交记录：能放回编辑页，裂变不了
  const noSpecs = task('PEX-one'); noSpecs.input = { nodes: [], sceneVideoState: { text: '要求', options: {} } } as never;
  const mounted = render(<VideoTaskSettings task={noSpecs} head={null} onMore={vi.fn()} onEdit={vi.fn()}/>);
  expect(screen.getByRole('button', { name: '再次生成' })).toBeTruthy(); expect(screen.queryByRole('button', { name: '裂变生成' })).toBeNull();
  noSpecs.input = undefined;
  mounted.rerender(<VideoTaskSettings task={noSpecs} head={null} onMore={vi.fn()} onEdit={vi.fn()}/>);
  expect(screen.queryByRole('button', { name: '再次生成' })).toBeNull(); expect(screen.queryByRole('button', { name: '裂变生成' })).toBeNull();
  expect(screen.queryByText('清晰度')).toBeNull(); expect(screen.queryByText(/— 秒/)).toBeNull();
});
test('completed steps stay complete while only the failed step retries', () => {
  const saved = task('PEX-one', 'segmented'); saved.execution!.steps.unshift({ ...saved.execution!.steps[0], id: 'script', operation: 'text', status: 'done' });
  saved.execution!.steps[1].attempt = 3;
  const phases = videoTaskPhases(saved); expect(phases.find(p => p.key === 'script')?.state).toBe('done'); expect(phases.find(p => p.key === 'videos')?.state).toBe('running');
});

test.each(['direct', 'recreation'] as const)('%s recent task uses the native final video cover', async kind => {
  const saved = task('PEX-cover', kind); saved.execution!.status = 'done'; saved.execution!.steps[0].status = 'done'; saved.execution!.steps[0].runIds = ['IPR-final'];
  api.list.mockResolvedValue({ items: [saved], page: 0, hasMore: false });
  api.readRun.mockResolvedValue({ id: 'IPR-final', status: 'done', output: { videoCandidates: [{ status: 'done', jobId: 'mvj-final' }] } });
  api.readVideoJob.mockResolvedValue({ thumbnail_url: 'https://cdn.test/final-cover.jpg' });
  const mounted = render(<SceneVideoWorkspace {...props}/>);
  await waitFor(() => expect(mounted.container.querySelector('.video-history-thumb img')?.getAttribute('src')).toBe('https://cdn.test/final-cover.jpg'));
  expect(api.readVideoJob).toHaveBeenCalledWith('mvj-final');
});
test('task drawer takes focus, closes with Escape and restores its trigger', async () => {
  const Harness = () => { const [open, setOpen] = useState(false); return <SceneVideoWorkspace {...props} railOpen={open} onRail={setOpen}><VideoHistoryToggle onOpen={() => setOpen(true)}/></SceneVideoWorkspace>; };
  render(<Harness/>);
  const trigger = screen.getByRole('button', { name: '打开最近任务' }); trigger.focus(); fireEvent.click(trigger);
  const drawer = screen.getByRole('dialog', { name: '最近任务' }); expect(drawer.contains(document.activeElement)).toBe(true);
  fireEvent.keyDown(drawer, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: '最近任务' })).toBeNull(); expect(document.activeElement).toBe(trigger);
});
test('a default scene URL added during loading does not erase the remembered task', async () => {
  window.history.replaceState(null, '', '/video'); sessionStorage.setItem('studio:video:selected-task', 'PEX-return');
  let resolveList!: (page: unknown) => void; api.list.mockReturnValue(new Promise(resolve => { resolveList = resolve; }));
  const saved = task('PEX-return'); api.get.mockResolvedValue(saved);
  const mounted = render(<SceneVideoWorkspace {...props}/>);
  window.history.replaceState(null, '', '/video?scene=ecom-talking'); mounted.rerender(<SceneVideoWorkspace {...props} sceneId="ecom-talking"/>);
  await act(async () => { resolveList({ items: [], page: 0, hasMore: false }); });
  await waitFor(() => expect(props.onSelect).toHaveBeenCalledWith(saved));
});

const failedTask = (reason: string, errorCode?: string, attempt = 1) => {
  const saved = task('PEX-bad', 'segmented'); saved.execution!.status = 'needs_user';
  Object.assign(saved.execution!.steps[0], { title: '写分镜脚本', operation: 'text', status: 'needs_user', reason, errorCode, attempt });
  return saved;
};
test('a failed step is named and the primary action has its own readable class', async () => {
  const saved = failedTask('视频生成失败：模拟 · 追查号 NX4URKWWGRCQ', undefined, 3);
  api.get.mockResolvedValue(saved);
  render(<SceneVideoWorkspace {...props} taskId="PEX-bad" selected={saved}/>);
  expect(await screen.findByRole('heading', { name: '分镜脚本没有完成' })).toBeTruthy();
  expect(screen.getByText(/已尝试 3 次，仍未完成。视频生成失败：模拟/)).toBeTruthy();
  expect(screen.queryByText(/NX4URKWWGRCQ/)).toBeNull();
  expect(screen.getByRole('button', { name: '查看错误详情' })).toBeTruthy();
  expect(screen.getByRole('link', { name: '在画布上查看' }).className).toContain('is-primary');
  expect(screen.queryByRole('button', { name: '重试这一步' })).toBeNull();
});
test('output the model could not produce usably offers regenerating in place', async () => {
  const saved = failedTask('这一步的结果无法读取，已完成的内容不受影响。', 'STUDIO_RAW_ONLY');
  api.get.mockResolvedValue(saved);
  render(<SceneVideoWorkspace {...props} taskId="PEX-bad" selected={saved}/>);
  expect(await screen.findByRole('button', { name: '重试这一步' })).toBeTruthy();
  expect(screen.queryByText(/模型原文/)).toBeNull();
});
test('a third portrait timeout offers only the affected video segment, preserving the first clip', async () => {
  const saved = task('PEX-portrait', 'segmented'); saved.execution!.status = 'needs_user';
  const first = saved.execution!.steps[0];
  Object.assign(first, { title: '第 1 段视频', status: 'done', runIds: ['IPR-first'] });
  saved.execution!.steps.push({ ...first, id: 'v2', title: '第 2 段视频', status: 'failed', errorCode: 'VIDEO_ASSET_REVIEW_TIMEOUT',
    reason: '人像核验等待超时，本次生成已取消。请完成核验后重新生成。 · 追查号 J3MED94VRWCS', attempt: 3, runIds: ['IPR-expired'], dependsOn: ['v1'] });
  api.get.mockResolvedValue(saved);
  api.readRun.mockImplementation(async id => id === 'IPR-first'
    ? { id, status: 'done', output: { storageKey: 'first.mp4' } }
    : { id, status: 'failed', output: {} });
  api.resume.mockResolvedValue({ ...saved.execution, status: 'running' });
  render(<SceneVideoWorkspace {...props} taskId={saved.id} selected={saved}/>);
  expect(await screen.findByLabelText('第 1 段视频')).toHaveProperty('tagName', 'VIDEO');
  expect(screen.getByText('等待人像素材审核超时。已完成的片段将保留。')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '从第 2 段继续生成' }));
  await waitFor(() => expect(api.resume).toHaveBeenCalledWith(saved.projectId, saved.id,
    expect.objectContaining({ expectedStatus: 'needs_user', retryStepId: 'v2', retryAttempt: 3 })));
});
test('a reference upload failure can retry the same step after three attempts', async () => {
  const saved = task('PEX-upload', 'segmented');
  saved.execution!.status = 'needs_user';
  Object.assign(saved.execution!.steps[0], { operation: 'video', status: 'failed', errorCode: 'VIDEO_REF_UPLOAD_FAILED',
    reason: '生成服务的存储空间满了', attempt: 3, runIds: ['IPR-upload'] });
  api.get.mockResolvedValue(saved);
  api.readRun.mockResolvedValue({ id: 'IPR-upload', status: 'failed', output: {} });
  api.resume.mockResolvedValue({ ...saved.execution, status: 'running' });
  render(<SceneVideoWorkspace {...props} taskId={saved.id} selected={saved}/>);
  fireEvent.click(await screen.findByRole('button', { name: '重试这一步' }));
  await waitFor(() => expect(api.resume).toHaveBeenCalledWith(saved.projectId, saved.id,
    expect.objectContaining({ expectedStatus: 'needs_user', retryStepId: saved.execution!.steps[0].id, retryAttempt: 3 })));
});

// 线上 PEX-9caea05b1848414ca167（2026-11-07）：分镜图生成服务没回结果、积分已退，原因写着「可以重新生成」，页面上却只有「在画布上查看」。
test('a failed step whose credits came back can be retried on the video page', async () => {
  const saved = task('PEX-board', 'segmented'); saved.execution!.status = 'needs_user';
  Object.assign(saved.execution!.steps[0], { title: '第 1 段分镜图', operation: 'image', status: 'failed', errorCode: 'STUDIO_IMAGE_SUBMISSION_UNKNOWN', attempt: 1,
    reason: '生成服务没有返回结果，这次生成失败。未完成部分的积分已退回，可以重新生成。', runIds: ['IPR-board'] });
  api.get.mockResolvedValue(saved); api.readRun.mockResolvedValue({ id: 'IPR-board', status: 'failed' });
  api.resume.mockResolvedValue({ ...saved.execution, status: 'running' });
  render(<SceneVideoWorkspace {...props} taskId="PEX-board" selected={saved}/>);
  expect(await screen.findByRole('heading', { name: '第 1 段分镜图没有完成' })).toBeTruthy();
  expect(screen.getByRole('link', { name: '在画布上查看' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '重试这一步' }));
  await waitFor(() => expect(api.resume).toHaveBeenCalledWith('IPP-PEX-board', 'PEX-board', expect.objectContaining({ expectedStatus: 'needs_user' })));
});
// 这几种点了也会停在同一处（服务端不接或接着停），页面不给按钮，让用户去画布处理。
test.each([
  ['the stage budget is short', (t: StudioVideoTask) => { t.execution!.budgets = [{ stage: 'production', approvedCap: 100, autoFixCap: 0, spent: 90, inFlight: 0, remaining: 10, shortfall: 20 }]; }],
  ['the step names materials outside this task', (t: StudioVideoTask) => { t.execution!.steps[0].materials = [{ nodeId: 'n1', title: '图1', onCanvas: true }]; }],
  ['the step already ran three times', (t: StudioVideoTask) => { t.execution!.steps[0].attempt = 3; }],
  ['the task timed out', (t: StudioVideoTask) => { t.execution!.status = 'partial'; }],
])('no retry when %s', async (_name, change) => {
  const saved = failedTask('失败', 'STUDIO_VIDEO_FAILED'); saved.execution!.steps[0].status = 'failed'; change(saved);
  api.get.mockResolvedValue(saved);
  render(<SceneVideoWorkspace {...props} taskId="PEX-bad" selected={saved}/>);
  expect((await screen.findAllByRole('link', { name: /在画布上查看/ })).length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: '重试这一步' })).toBeNull();
  expect(screen.queryByRole('button', { name: '继续生成' })).toBeNull();
});
test('a paused task continues from the video page', async () => {
  const saved = task('PEX-paused', 'segmented'); saved.execution!.status = 'paused';
  api.get.mockResolvedValue(saved); api.resume.mockResolvedValue({ ...saved.execution, status: 'running' });
  render(<SceneVideoWorkspace {...props} taskId="PEX-paused" selected={saved}/>);
  fireEvent.click(await screen.findByRole('button', { name: '继续生成' }));
  await waitFor(() => expect(api.resume).toHaveBeenCalledWith('IPP-PEX-paused', 'PEX-paused', expect.objectContaining({ expectedStatus: 'paused' })));
});
// 2026-11-07 用户：有分镜图就只摆图，视频那一步不占格子；状态、进度条和操作在图的上面。
test('previews stay short: images only, pending placeholders only while running, and the rest behind one toggle', async () => {
  const saved = task('PEX-long', 'segmented');
  const step = saved.execution!.steps[0];
  saved.execution!.steps = [
    ...Array.from({ length: 6 }, (_, i) => ({ ...step, id: `s${i}`, title: `第 ${i + 1} 张`, operation: 'image', status: i === 0 ? 'running' : 'pending' })),
    { ...step, id: 'v1', title: '第 1 段视频', operation: 'video', status: 'pending' },
  ] as never;
  api.get.mockResolvedValue(saved); api.readRun.mockResolvedValue({ status: 'running' });
  const mounted = render(<SceneVideoWorkspace {...props} taskId="PEX-long" selected={saved}/>);
  expect(mounted.container.querySelectorAll('.video-production-previews figure').length).toBe(4);
  expect(screen.queryByText('第 1 段视频')).toBeNull();
  // 状态、进度条和操作在上面，图在下面。
  const head = mounted.container.querySelector('.video-production-head')!, stage = mounted.container.querySelector('.video-production-stage')!;
  expect(head.querySelector('.video-production-tracker')).toBeTruthy();
  expect(head.querySelector('.video-production-actions button')?.textContent).toContain('停止生成');
  expect(head.compareDocumentPosition(stage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '查看全部（共 6 项）' }));
  expect(mounted.container.querySelectorAll('.video-production-previews figure').length).toBe(6);
  mounted.unmount();
  const stopped = failedTask('失败', undefined, 3); stopped.execution!.steps = [stopped.execution!.steps[0], { ...step, id: 'later', title: '后面的', operation: 'video', status: 'pending' }] as never;
  api.get.mockResolvedValue(stopped);
  const second = render(<SceneVideoWorkspace {...props} taskId="PEX-bad" selected={stopped}/>);
  expect(second.container.querySelectorAll('.video-production-previews figure').length).toBe(0);
});
test('a live queue position comes from the run record', async () => {
  const saved = task('PEX-q'); Object.assign(saved.execution!.steps[0], { status: 'running', runIds: ['IPR-q'] });
  api.get.mockResolvedValue(saved); api.readRun.mockResolvedValue({ id: 'IPR-q', status: 'running', queue: { position: 3, waiting: 5, running: 1, concurrencyLimit: 1 }, output: {} });
  render(<SceneVideoWorkspace {...props} taskId="PEX-q" selected={saved}/>);
  expect(await screen.findByRole('heading', { name: '排队中' })).toBeTruthy();
  expect(screen.getByText(/前面还有 2 个任务/)).toBeTruthy();
});
test('recent tasks use the site date format, and the drafts heading needs a draft under it', async () => {
  const saved = task('PEX-one'); api.list.mockResolvedValue({ items: [saved], page: 0, hasMore: false });
  render(<SceneVideoWorkspace {...props} drafts={[{ id: 'IPP-PEX-one', name: '已经有任务', updatedAt: '2026-11-06' }]}/>);
  const row = await screen.findByRole('button', { name: /PEX-one/ });
  expect(row.textContent).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  expect(screen.queryByRole('heading', { name: '草稿' })).toBeNull();
});

// 2026-11-09 用户：同一个作品（同一份草稿）里的视频要在同一页看到；最近任务里同组只占一行。
const take = (id: string, createdAt: string, clientRequestId: string, text = '同一份脚本') => {
  const t = task(id); t.projectId = 'IPP-same'; t.createdAt = createdAt;
  t.request = { clientRequestId, kind: 'direct', sceneId: 'drama-twist', title: '同一条', budgetCap: 900, input: { nodes: [] },
    configuration: { clientRequestId, sceneId: 'drama-twist', text, duration: 15, ratio: '9:16', materials: [], budgetCap: 900 } };
  return t;
};
test('videos of one draft sit side by side in the result area and share one row in recent tasks', async () => {
  const first = take('PEX-first', '2026-11-09T01:00:00Z', 'a');
  // AI 改写的那条脚本不同，仍在同一批，并标出怎么来的。
  const second = take('PEX-second', '2026-11-09T02:00:00Z', 'b', '改写过的脚本');
  second.input = { nodes: [], take: { of: 'PEX-first', mode: 'rewrite', changes: [{ name: '场景', from: '厨房', to: '阳台' }] } };
  const other = task('PEX-other');
  api.list.mockResolvedValue({ items: [second, first, other], page: 0, hasMore: false }); api.get.mockResolvedValue(first);
  render(<SceneVideoWorkspace {...props} taskId="PEX-first" selected={first}/>);
  const strip = await screen.findByRole('region', { name: '本批视频' });
  await waitFor(() => expect(within(strip).getAllByRole('button')).toHaveLength(2));
  expect(within(strip).getByRole('button', { name: /第 1 条/ }).getAttribute('aria-current')).toBe('true');
  const rewritten = within(strip).getByRole('button', { name: /第 2 条/ });
  expect(rewritten.textContent).toContain('AI 改写');
  expect(rewritten.getAttribute('title')).toContain('场景：阳台');
  fireEvent.click(rewritten);
  expect(props.onSelect).toHaveBeenCalledWith(second);
  const rows = document.querySelectorAll('.video-history-item');
  expect(rows).toHaveLength(2);
  expect([...rows].some(row => row.textContent?.includes('共 2 条'))).toBe(true);
});
// 2026-11-09 用户：最近任务可以按批次或按时间排。
test('recent tasks can be listed by batch or one by one by time, and the choice is remembered', async () => {
  localStorage.clear();
  const first = take('PEX-first', '2026-11-09T01:00:00Z', 'a');
  const second = take('PEX-second', '2026-11-09T02:00:00Z', 'b', '改写过的脚本');
  second.input = { nodes: [], take: { of: 'PEX-first', mode: 'rewrite' } };
  const other = task('PEX-other');
  api.list.mockResolvedValue({ items: [second, first, other], page: 0, hasMore: false });
  render(<SceneVideoWorkspace {...props}/>);
  await waitFor(() => expect(document.querySelectorAll('.video-history-item')).toHaveLength(2));
  expect(screen.getByRole('button', { name: '按批次' }).getAttribute('aria-pressed')).toBe('true');
  expect(document.querySelector('.video-history-item.is-batch .video-history-count')?.textContent).toBe('2');
  fireEvent.click(screen.getByRole('button', { name: '按时间' }));
  const rows = [...document.querySelectorAll('.video-history-item')];
  expect(rows).toHaveLength(3);
  expect(rows[0].textContent).toContain('AI 改写');
  expect(document.querySelector('.video-history-count')).toBeNull();
  expect(localStorage.getItem('studio:video:task-grouping')).toBe('time');
  cleanup();
  render(<SceneVideoWorkspace {...props}/>);
  await waitFor(() => expect(screen.getByRole('button', { name: '按时间' }).getAttribute('aria-pressed')).toBe('true'));
  localStorage.clear();
});
test('a single task shows no strip, and the settings name the model and open 裂变生成', async () => {
  const one = take('PEX-only', '2026-11-09T01:00:00Z', 'a');
  const more = vi.fn();
  render(<VideoTaskSettings task={one} head={<header>口播带货</header>} modelName="Seedance 2.0" onMore={more}/>);
  expect(screen.getByText('口播带货')).toBeTruthy();
  expect(screen.getByText('模型').nextElementSibling?.textContent).toBe('Seedance 2.0');
  fireEvent.click(screen.getByRole('button', { name: '裂变生成' }));
  expect(more).toHaveBeenCalledOnce();
  expect(screen.queryByRole('region', { name: '本批视频' })).toBeNull();
});

// 2026-11-10 用户：不想要的删不掉。删一条任务删的是它所在的草稿（进回收站），同一份草稿里的视频一起删；还在生成就不能删。
test('deleting a finished task removes its draft and tells the page which draft went', async () => {
  const done = task('PEX-done'); done.execution!.status = 'needs_user';
  api.list.mockResolvedValue({ items: [done], page: 0, hasMore: false });
  // 服务端删掉以后，任务列表里就没有这份草稿的任务了
  api.deleteProject.mockImplementation(async () => { api.list.mockResolvedValue({ items: [], page: 0, hasMore: false }); });
  const onDeleted = vi.fn();
  render(<SceneVideoWorkspace {...props} onDeleted={onDeleted}/>);
  await screen.findByRole('button', { name: /PEX-done/ });
  fireEvent.click(screen.getAllByRole('button', { name: '删除' })[0]);
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: '删除' }));
  await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(['IPP-PEX-done']));
  expect(api.deleteProject).toHaveBeenCalledWith('IPP-PEX-done');
  await waitFor(() => expect(screen.queryByRole('button', { name: /PEX-done/ })).toBeNull());
});
test('a draft with a video still generating cannot be deleted from the rail', async () => {
  api.list.mockResolvedValue({ items: [task('PEX-live')], page: 0, hasMore: false });
  render(<SceneVideoWorkspace {...props}/>);
  await screen.findByRole('button', { name: /PEX-live/ });
  fireEvent.click(screen.getAllByRole('button', { name: '删除' })[0]);
  const dialog = await screen.findByRole('dialog');
  expect((within(dialog).getByRole('button', { name: '删除' }) as HTMLButtonElement).disabled).toBe(true);
  expect(api.deleteProject).not.toHaveBeenCalled();
});

test('completed media stays downloadable while its AI quality findings remain visible', async () => {
  const saved = task('PEX-quality', 'recreation'); saved.execution!.status = 'done';
  const base = saved.execution!.steps[0];
  saved.execution!.steps = [{ ...base, status: 'done', runIds: ['IPR-final'] }, { ...base, id: 'review', operation: 'check', status: 'done', runIds: ['IPR-review'] }];
  api.get.mockResolvedValue(saved);
  api.readRun.mockImplementation(async id => id === 'IPR-final' ? { id, status: 'done', output: { storageKey: 'final.mp4' } }
    : { id, status: 'done', output: { check: { status: 'fail', items: [{ id: 'clothing', status: 'fail', reason: '衣服颜色偏浅', suggestion: '调整为宝蓝色' }] } } });
  render(<SceneVideoWorkspace {...props} taskId="PEX-quality" selected={saved}/>);
  expect(await screen.findByRole('heading', { name: '视频已完成' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '下载视频' })).toBeTruthy();
  expect(await screen.findByText('AI 检查建议（1 项）')).toBeTruthy();
  expect(screen.getByText('衣服颜色偏浅')).toBeTruthy();
  const phases = videoTaskPhases(saved);
  expect(phases.some(p => p.key === 'boards')).toBe(false);
  expect(phases.find(p => p.key === 'review')?.state).toBe('done');
});
