// @vitest-environment jsdom
import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StudioTemplateUse } from './studio-template-use';
import { IpStudioApi } from './api';
vi.mock('antd', () => ({
  ConfigProvider: ({ children }: any) => children,
  Modal: ({ children, title, footer }: any) => <div role="dialog">{title}{children}{footer}</div>,
  Alert: ({ title }: any) => <p>{title}</p>, Spin: () => null,
  Button: ({ children, type, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('./api', () => ({ IpStudioApi: { createProject: vi.fn() } }));
const template = { id: 'template', versionId: 'v1', name: '商品视频', summary: '', lookCount: 0, estimatedCredits: 0, doc: { nodes: [], connections: [] } };
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(IpStudioApi.createProject).mockResolvedValue({ id: 'copy' } as any); });
test('versioned templates directly open an ordinary personal copy without inputs, model lookup or quote', async () => {
  const created = vi.fn(); render(<StudioTemplateUse template={template} onClose={() => {}} onCreated={created} />);
  await waitFor(() => expect(created).toHaveBeenCalledWith('copy'));
  expect(IpStudioApi.createProject).toHaveBeenCalledExactlyOnceWith({ templateId: 'template' });
  expect(screen.queryByRole('textbox')).toBeNull(); expect(screen.queryByRole('button', { name: '预览制作计划' })).toBeNull();
});
test('Strict Mode and parent rerenders cannot create duplicate copies', async () => {
  let resolve: (p: any) => void = () => {}; vi.mocked(IpStudioApi.createProject).mockReturnValue(new Promise(r => { resolve = r; }));
  const created = vi.fn(); const ui = () => <StrictMode><StudioTemplateUse template={template} onClose={() => {}} onCreated={created} /></StrictMode>;
  const view = render(ui()); view.rerender(ui()); resolve({ id: 'one-copy' });
  await waitFor(() => expect(created).toHaveBeenCalledOnce()); expect(IpStudioApi.createProject).toHaveBeenCalledOnce();
});
test('opening failure shows a retry and return path; retry still creates an ordinary copy', async () => {
  vi.mocked(IpStudioApi.createProject).mockRejectedValueOnce(new Error('模板已下线'));
  const created = vi.fn(), close = vi.fn(); render(<StudioTemplateUse template={template} onClose={close} onCreated={created} />);
  await screen.findByText('模板已下线'); expect(created).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '返回' })); expect(close).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  await waitFor(() => expect(created).toHaveBeenCalledWith('copy')); expect(IpStudioApi.createProject).toHaveBeenCalledTimes(2);
});
