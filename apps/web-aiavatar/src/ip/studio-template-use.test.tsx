// @vitest-environment jsdom
import { StrictMode } from 'react';
import { mountStudioErrorNotifications } from './testing/studio-notification-harness';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StudioTemplateUse } from './studio-template-use';
import { IpStudioApi } from './api';
import { readTemplateVersion } from '@/canvas-bridge/template-api';
vi.mock('next/dynamic', () => ({ default: () => ({ onInspectingChange }: any) => <div aria-label="只读模板画布"><button onClick={() => onInspectingChange?.(true)}>查看节点</button></div> }));
vi.mock('antd', () => ({
  Modal: ({ children, onCancel, width, keyboard }: any) => <div role="dialog" data-width={width} data-keyboard={String(keyboard)}><button onClick={onCancel}>关闭</button>{children}</div>,
  Alert: ({ title, action }: any) => <p>{title}{action}</p>, Spin: () => null,
  Button: ({ children, type, loading, icon, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('./api', () => ({ IpStudioApi: { createProject: vi.fn() } }));
vi.mock('@/canvas-bridge/template-api', () => ({ readTemplateVersion: vi.fn() }));
const doc = { nodes: [], connections: [], viewport: { x: 0, y: 0, k: 1 } };
const template = { id: 'template', versionId: 'v1', name: '商品视频', summary: '', lookCount: 0, estimatedCredits: 0, doc };
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks(); vi.mocked(IpStudioApi.createProject).mockResolvedValue({ id: 'copy' } as any);
  vi.mocked(readTemplateVersion).mockResolvedValue({ doc, recipe: { inputs: [], steps: [] } } as any);
});
test('open, rerender, close and reopen only read the template and never create a draft', async () => {
  const created = vi.fn(), close = vi.fn();
  const ui = () => <StrictMode><StudioTemplateUse template={template} onClose={close} onCreated={created}/></StrictMode>;
  const view = render(ui()); view.rerender(ui());
  await screen.findByLabelText('只读模板画布');
  fireEvent.click(screen.getByRole('button', { name: '关闭' })); expect(close).toHaveBeenCalledOnce();
  view.unmount(); render(ui()); await screen.findByLabelText('只读模板画布');
  expect(IpStudioApi.createProject).not.toHaveBeenCalled(); expect(created).not.toHaveBeenCalled();
  expect(screen.queryByRole('textbox')).toBeNull();
});
test('only saving creates a copy; rapid clicks and rerenders deliver exactly one copy', async () => {
  let resolve: (p: any) => void = () => {};
  vi.mocked(IpStudioApi.createProject).mockReturnValue(new Promise(r => { resolve = r; }));
  const created = vi.fn(), ui = () => <StrictMode><StudioTemplateUse template={template} onClose={() => {}} onCreated={created}/></StrictMode>;
  const view = render(ui()); await screen.findByLabelText('只读模板画布');
  const save = screen.getByRole('button', { name: '做同款' });
  fireEvent.click(save); fireEvent.click(save); view.rerender(ui());
  expect(IpStudioApi.createProject).toHaveBeenCalledExactlyOnceWith({ templateId: 'template' });
  resolve({ id: 'one-copy' }); await waitFor(() => expect(created).toHaveBeenCalledExactlyOnceWith('/projects/one-copy'));
});
test('copy failure stays in the preview and retries only when explicitly saved again', async () => {
  vi.mocked(IpStudioApi.createProject).mockRejectedValueOnce(new Error('模板已下线'));
  const created = vi.fn(); render(<StudioTemplateUse template={template} onClose={() => {}} onCreated={created}/>);
  await screen.findByLabelText('只读模板画布'); fireEvent.click(screen.getByRole('button', { name: '做同款' }));
  await screen.findByText('模板已下线'); expect(created).not.toHaveBeenCalled();
  expect(IpStudioApi.createProject).toHaveBeenCalledOnce();
  await waitFor(() => expect((screen.getByRole('button', { name: '做同款' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: '做同款' }));
  await waitFor(() => expect(created).toHaveBeenCalledWith('/projects/copy'));
});
test('failed preview cannot create a project; reload is a read request', async () => {
  vi.mocked(readTemplateVersion).mockRejectedValueOnce(new Error('读取失败'));
  render(<StudioTemplateUse template={template} onClose={() => {}} onCreated={() => {}}/>);
  await screen.findByText('读取失败'); expect((screen.getByRole('button', { name: '做同款' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(await screen.findByRole('button', { name: '重新加载' })); await screen.findByLabelText('只读模板画布');
  expect(IpStudioApi.createProject).not.toHaveBeenCalled();
});
test('legacy official templates also preview without creating a draft', async () => {
  render(<StudioTemplateUse template={{ ...template, versionId: undefined }} onClose={() => {}} onCreated={() => {}}/>);
  await screen.findByLabelText('只读模板画布'); expect(readTemplateVersion).not.toHaveBeenCalled(); expect(IpStudioApi.createProject).not.toHaveBeenCalled();
});

beforeEach(() => { mountStudioErrorNotifications(); });

const inspiration = { id: 'IPD-insp-cover', name: '小红书封面', summary: '撞色大标题', lookCount: 0, estimatedCredits: 0, coverUrl: 'https://cdn.test/cover.jpg', doc: {
  nodes: [
    { id: 'guide', type: 'text', title: '创作说明', position: { x: 0, y: 0 }, width: 300, height: 200, metadata: { content: '这套做法', prompt: '帮我生成这张图：撞色封面', studioStart: 'assistant', studioSkill: 'image-generation' } },
    { id: 'mine', type: 'image', title: '我的版本', position: { x: 400, y: 0 }, width: 300, height: 400, metadata: { prompt: '撞色封面' } },
    { id: 'sample', type: 'image', title: '示例效果', position: { x: 800, y: 0 }, width: 300, height: 400, metadata: { storageKey: 'ipstudio_demo/x/a.jpg', prompt: '撞色封面' } },
  ], connections: [], viewport: { x: 0, y: 0, k: 1 } } } as any;
test('an inspiration opens as a sized dialog with its result and no prompt, not the fullscreen canvas', async () => {
  render(<StudioTemplateUse template={inspiration} onClose={() => {}} onCreated={() => {}}/>);
  const shown = await screen.findByAltText('小红书封面 的示例效果');
  expect(shown.getAttribute('src')).toBe('https://cdn.test/cover.jpg');
  expect(screen.getByRole('dialog').getAttribute('data-width')).toBe('1000');
  expect(screen.queryByLabelText('只读模板画布')).toBeNull();
  expect(screen.getByLabelText('需要准备').textContent).toContain('不用准备素材');
  // The prompt belongs to the copied canvas, not to the preview: not on show and nothing to copy it with.
  expect(screen.getByRole('dialog').textContent).not.toContain('撞色封面');
  expect(screen.queryByRole('button', { name: '复制' })).toBeNull();
  await waitFor(() => expect(screen.getByRole('button', { name: '查看画布' })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: '查看画布' }));
  await screen.findByLabelText('只读模板画布');
  fireEvent.click(screen.getByRole('button', { name: '查看效果' }));
  await screen.findByAltText('小红书封面 的示例效果');
});
test('a video inspiration plays muted; a broken link falls back to the canvas', async () => {
  const { container } = render(<StudioTemplateUse template={{ ...inspiration, previewVideoUrl: 'https://cdn.test/a.mp4' }} onClose={() => {}} onCreated={() => {}}/>);
  const video = container.querySelector('video')!;
  expect(video.getAttribute('src')).toBe('https://cdn.test/a.mp4');
  expect(video.muted).toBe(true);
  fireEvent.error(video);
  await screen.findByLabelText('只读模板画布');
});
test('a copied inspiration opens the assistant; only 做同款 creates anything', async () => {
  vi.mocked(IpStudioApi.createProject).mockResolvedValue({ id: 'IPP-1', doc: inspiration.doc } as any);
  const created = vi.fn();
  render(<StudioTemplateUse template={inspiration} onClose={() => {}} onCreated={created}/>);
  await screen.findByAltText('小红书封面 的示例效果');
  expect(IpStudioApi.createProject).not.toHaveBeenCalled();
  await waitFor(() => expect((screen.getByRole('button', { name: '做同款' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: '做同款' }));
  await waitFor(() => expect(created).toHaveBeenCalledExactlyOnceWith('/projects/IPP-1?start=assistant'));
});

test('a workflow template lists its steps and what to prepare, and shows no prompt either', async () => {
  const workflow = { ...inspiration, coverUrl: undefined, doc: { nodes: [
    { id: 'a', type: 'image', title: '① 你的照片', position: { x: 0, y: 0 }, width: 100, height: 100, metadata: {} },
    { id: 'b', type: 'image', title: '② 招牌形象', position: { x: 0, y: 0 }, width: 100, height: 100, metadata: { prompt: '卖点与创作要求：' } },
  ], connections: [], viewport: { x: 0, y: 0, k: 1 } } };
  render(<StudioTemplateUse template={workflow} onClose={() => {}} onCreated={() => {}}/>);
  await screen.findByLabelText('只读模板画布');
  await waitFor(() => expect(screen.getByLabelText('创作步骤').textContent).toContain('② 招牌形象'));
  expect(screen.getByLabelText('需要准备').textContent).toContain('① 你的照片');
  expect(screen.getByRole('dialog').textContent).not.toContain('卖点与创作要求');
});
test('Esc belongs to the inner node panel while it is open; focus goes back to the card when the dialog closes', async () => {
  const card = document.createElement('button'); document.body.append(card); card.focus();
  const view = render(<StudioTemplateUse template={template} onClose={() => {}} onCreated={() => {}}/>);
  fireEvent.click(await screen.findByRole('button', { name: '查看节点' }));
  await waitFor(() => expect(screen.getByRole('dialog').getAttribute('data-keyboard')).toBe('false'));
  (document.activeElement as HTMLElement | null)?.blur();
  view.unmount();
  expect(document.activeElement).toBe(card);
  card.remove();
});
