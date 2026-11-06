// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { StudioVideoTask } from '@ai-star-eco/types/ip-studio-video-task';
const api = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), readRun: vi.fn(), readVideoJob: vi.fn(), signKeys: vi.fn() }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/canvas-bridge/studio-video-tasks', async original => ({ ...await original<any>(), videoTasks: api.list, videoTask: api.get }));
vi.mock('@/canvas-bridge/api', () => ({ readRun: api.readRun, readVideoJob: api.readVideoJob, signKeys: api.signKeys, cancelRun: vi.fn() }));
vi.mock('@/canvas-bridge/signed-image', () => ({ SignedImage: ({ storageKey, ...p }: any) => <img {...p} data-key={storageKey}/> }));
vi.mock('@/canvas-bridge/signed-video', () => ({ SignedVideo: ({ storageKey, ...p }: any) => <video {...p} data-key={storageKey}/> }));
import { useState } from 'react';
import { SceneVideoWorkspace, VideoHistoryToggle, VideoTaskSettings, videoTaskPhases } from './scene-video-workspace';
const task = (id: string, kind: StudioVideoTask['kind'] = 'direct') => ({ id, kind, title: id, projectId: `IPP-${id}`, sceneId: 'drama-twist', createdAt: '2026-11-06T00:00:00Z',
  execution: { id, projectId: `IPP-${id}`, status: 'running', stage: 'production', steps: [{ id: 'v1', title: '第一段', operation: 'video', status: 'pending', stage: 'production', attempt: 1, runIds: [], dependsOn: [] }], budgets: [], updatedAt: '2026-11-06' },
  input: { nodes: [], sceneVideoState: { text: '保留这一版要求', duration: 40, ratio: '9:16', tier: '720p', options: {} } } }) as unknown as StudioVideoTask;
const props = { enabled: true, onSelect: vi.fn(), onReuse: vi.fn(), onDraft: vi.fn(), drafts: [], railOpen: false, onRail: vi.fn(), persist: vi.fn().mockResolvedValue(undefined), children: <p>尚未制作</p> };
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
test('historical inputs are read-only and explicitly reused through a new draft', () => {
  const reuse = vi.fn(), failed = task('PEX-one'); failed.execution!.status = 'needs_user';
  render(<VideoTaskSettings task={failed} onNew={vi.fn()} onReuse={reuse}/>);
  expect(screen.getByText('保留这一版要求')).toBeTruthy(); expect(screen.queryByRole('textbox')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '重新编辑' })); expect(reuse).toHaveBeenCalledOnce();
});
test('the settings panel leaves reuse to the result while a task runs or has finished, and hides empty rows', () => {
  const noSpecs = task('PEX-one'); noSpecs.input = { nodes: [], sceneVideoState: { text: '要求', options: {} } } as never;
  render(<VideoTaskSettings task={noSpecs} onNew={vi.fn()} onReuse={vi.fn()}/>);
  expect(screen.queryByRole('button', { name: '重新编辑' })).toBeNull(); expect(screen.queryByText('清晰度')).toBeNull(); expect(screen.queryByText(/— 秒/)).toBeNull();
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
  expect(screen.getByRole('link', { name: '在画布中查看' }).className).toContain('is-primary');
  expect(screen.queryByRole('button', { name: '重试这一步' })).toBeNull();
});
test('output the model could not produce usably offers regenerating in place', async () => {
  const saved = failedTask('这一步的结果无法读取，已完成的内容不受影响。', 'STUDIO_RAW_ONLY');
  api.get.mockResolvedValue(saved);
  render(<SceneVideoWorkspace {...props} taskId="PEX-bad" selected={saved}/>);
  expect(await screen.findByRole('button', { name: '重试这一步' })).toBeTruthy();
  expect(screen.queryByText(/模型原文/)).toBeNull();
});
test('previews stay short: pending placeholders only while running, and the rest behind one toggle', async () => {
  const saved = task('PEX-long', 'segmented');
  const step = saved.execution!.steps[0];
  saved.execution!.steps = Array.from({ length: 6 }, (_, i) => ({ ...step, id: `s${i}`, title: `第 ${i + 1} 项`, operation: i % 2 ? 'video' : 'image', status: i === 0 ? 'running' : 'pending' })) as never;
  api.get.mockResolvedValue(saved); api.readRun.mockResolvedValue({ status: 'running' });
  const mounted = render(<SceneVideoWorkspace {...props} taskId="PEX-long" selected={saved}/>);
  expect(mounted.container.querySelectorAll('.video-production-previews figure').length).toBe(4);
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
