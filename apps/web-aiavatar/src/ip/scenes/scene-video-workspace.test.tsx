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
import { SceneVideoWorkspace, VideoTaskSettings, videoTaskPhases } from './scene-video-workspace';
const task = (id: string, kind: StudioVideoTask['kind'] = 'direct') => ({ id, kind, title: id, projectId: `IPP-${id}`, sceneId: 'drama-twist', createdAt: '2026-11-06T00:00:00Z',
  execution: { id, projectId: `IPP-${id}`, status: 'running', stage: 'production', steps: [{ id: 'v1', title: '第一段', operation: 'video', status: 'pending', stage: 'production', attempt: 1, runIds: [], dependsOn: [] }], budgets: [], updatedAt: '2026-11-06' },
  input: { nodes: [], sceneVideoState: { text: '保留这一版要求', duration: 40, ratio: '9:16', tier: '720p', options: {} } } }) as unknown as StudioVideoTask;
const props = { enabled: true, onSelect: vi.fn(), onReuse: vi.fn(), onDraft: vi.fn(), drafts: [], persist: vi.fn().mockResolvedValue(undefined), children: <p>尚未制作</p> };
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
  const reuse = vi.fn(); render(<VideoTaskSettings task={task('PEX-one')} onNew={vi.fn()} onReuse={reuse}/>);
  expect(screen.getByText('保留这一版要求')).toBeTruthy(); expect(screen.queryByRole('textbox')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '用这些设置改一版' })); expect(reuse).toHaveBeenCalledOnce();
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
  render(<SceneVideoWorkspace {...props}/>);
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
