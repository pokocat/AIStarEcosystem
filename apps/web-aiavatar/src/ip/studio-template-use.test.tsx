// @vitest-environment jsdom
import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StudioTemplateUse } from './studio-template-use';
import { IpStudioApi } from './api';
import { readTemplateVersion } from '@/canvas-bridge/template-api';
vi.mock('next/dynamic', () => ({ default: () => () => <div aria-label="只读模板画布"/> }));
vi.mock('antd', () => ({
  ConfigProvider: ({ children }: any) => children,
  Modal: ({ children }: any) => <div role="dialog">{children}</div>,
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
  fireEvent.click(screen.getByRole('button', { name: '返回' })); expect(close).toHaveBeenCalledOnce();
  view.unmount(); render(ui()); await screen.findByLabelText('只读模板画布');
  expect(IpStudioApi.createProject).not.toHaveBeenCalled(); expect(created).not.toHaveBeenCalled();
  expect(screen.queryByRole('textbox')).toBeNull();
});
test('only saving creates a copy; rapid clicks and rerenders deliver exactly one copy', async () => {
  let resolve: (p: any) => void = () => {};
  vi.mocked(IpStudioApi.createProject).mockReturnValue(new Promise(r => { resolve = r; }));
  const created = vi.fn(), ui = () => <StrictMode><StudioTemplateUse template={template} onClose={() => {}} onCreated={created}/></StrictMode>;
  const view = render(ui()); await screen.findByLabelText('只读模板画布');
  const save = screen.getByRole('button', { name: '存为个人副本' });
  fireEvent.click(save); fireEvent.click(save); view.rerender(ui());
  expect(IpStudioApi.createProject).toHaveBeenCalledExactlyOnceWith({ templateId: 'template' });
  resolve({ id: 'one-copy' }); await waitFor(() => expect(created).toHaveBeenCalledExactlyOnceWith('one-copy'));
});
test('copy failure stays in the preview and retries only when explicitly saved again', async () => {
  vi.mocked(IpStudioApi.createProject).mockRejectedValueOnce(new Error('模板已下线'));
  const created = vi.fn(); render(<StudioTemplateUse template={template} onClose={() => {}} onCreated={created}/>);
  await screen.findByLabelText('只读模板画布'); fireEvent.click(screen.getByRole('button', { name: '存为个人副本' }));
  await screen.findByText('模板已下线'); expect(created).not.toHaveBeenCalled();
  expect(IpStudioApi.createProject).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: '存为个人副本' }));
  await waitFor(() => expect(created).toHaveBeenCalledWith('copy'));
});
test('failed preview cannot create a project; reload is a read request', async () => {
  vi.mocked(readTemplateVersion).mockRejectedValueOnce(new Error('读取失败'));
  render(<StudioTemplateUse template={template} onClose={() => {}} onCreated={() => {}}/>);
  await screen.findByText('读取失败'); expect((screen.getByRole('button', { name: '存为个人副本' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '重新加载' })); await screen.findByLabelText('只读模板画布');
  expect(IpStudioApi.createProject).not.toHaveBeenCalled();
});
test('legacy official templates also preview without creating a draft', async () => {
  render(<StudioTemplateUse template={{ ...template, versionId: undefined }} onClose={() => {}} onCreated={() => {}}/>);
  await screen.findByLabelText('只读模板画布'); expect(readTemplateVersion).not.toHaveBeenCalled(); expect(IpStudioApi.createProject).not.toHaveBeenCalled();
});
