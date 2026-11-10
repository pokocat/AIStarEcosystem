// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AssetsOfficial } from './assets-official';

const api = vi.hoisted(() => ({ ips: vi.fn() }));
vi.mock('@/canvas-bridge/studio-api', () => ({ listStudioIpAssets: api.ips }));
vi.mock('./asset-thumb', () => ({ AssetThumb: (p: any) => <img src={p.src} alt=""/> }));
vi.mock('./studio-errors', async () => {
  const { useCallback, useState } = await import('react');
  return {
    useStudioErrorState: () => { const [e, set] = useState(''); return [e, useCallback((v: unknown) => set(v ? String((v as Error).message || v) : ''), [])]; },
    StudioErrorNotice: ({ error }: any) => <span role="alert">{String(error)}</span>,
  };
});
vi.mock('antd', () => ({
  Button: ({ icon, loading, type, size, block, ...p }: any) => <button {...p}>{icon}{p.children}</button>,
  Input: ({ prefix, allowClear, ...p }: any) => <input {...p}/>,
  Dropdown: ({ children, menu }: any) => <span>{children}<span role="menu">{menu.items.map((i: any) => <button key={i.key} role="menuitem" onClick={() => menu.onClick({ key: i.key })}>{i.label}</button>)}</span></span>,
  Modal: ({ open, title, children, footer }: any) => open ? <div role="dialog" aria-label={title}>{children}{footer}</div> : null,
}));

const free = { avatarId: 'official:PA-01', version: 1, current: true, name: 'Annie 安妮', characterName: 'Annie 安妮', url: 'https://cdn/annie', storageKey: 'dap_plaza/a.jpg',
  assetRole: 'main', librarySource: 'official', access: 'free', category: 'pro', description: '商务发布会与产品讲解的全能数字主持', attributes: { 年龄: '28 岁' } };
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  api.ips.mockResolvedValue([free,
    { ...free, current: false, lookId: 'right', name: '右侧脸', assetRole: 'side', storageKey: 'dap_plaza/a-r.jpg', url: 'https://cdn/annie-r' },
    { ...free, avatarId: 'official:PA-x', name: '签约艺人', characterName: '签约艺人', access: 'license', category: 'life', storageKey: 'dap_plaza/x.jpg', description: '居家好物种草', attributes: {} },
    { avatarId: 'mine', version: 1, current: true, name: '我的人物', characterName: '我的人物', url: 'u', storageKey: 'ip/m' },
  ]);
});

test('lists only official avatars with 免费 / 需授权 and filters by category and keyword', async () => {
  render(<AssetsOfficial/>);
  const annie = await screen.findByRole('button', { name: '查看 Annie 安妮' });
  expect(annie.textContent).toContain('免费');
  expect(annie.textContent).toContain('商务专业');
  expect(screen.getByRole('button', { name: '查看 签约艺人' }).textContent).toContain('需授权');
  expect(screen.queryByRole('button', { name: /我的人物/ })).toBeNull();
  expect(screen.getByText('2 个形象')).toBeTruthy();
  fireEvent.click(screen.getByRole('menuitem', { name: '生活方式' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: '查看 Annie 安妮' })).toBeNull());
  fireEvent.click(screen.getByRole('menuitem', { name: '全部分类' }));
  fireEvent.change(screen.getByRole('textbox', { name: '搜索官方形象' }), { target: { value: '发布会' } });
  await waitFor(() => expect(screen.queryByRole('button', { name: '查看 签约艺人' })).toBeNull());
});

test('a free avatar shows its views without 申请授权; a licensed one offers 申请授权, which must say it is not open yet (no order, no charge)', async () => {
  render(<AssetsOfficial/>);
  fireEvent.click(await screen.findByRole('button', { name: '查看 Annie 安妮' }));
  expect(screen.getByRole('dialog', { name: 'Annie 安妮' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '查看右侧脸' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '申请授权' })).toBeNull();
  cleanup();
  render(<AssetsOfficial/>);
  fireEvent.click(await screen.findByRole('button', { name: '查看 签约艺人' }));
  fireEvent.click(screen.getByRole('button', { name: '申请授权' }));
  expect(screen.getByRole('dialog', { name: '申请授权' }).textContent).toContain('暂未开放');
});

test('a load failure is reported with a retry instead of an empty list', async () => {
  api.ips.mockRejectedValueOnce(new Error('网络错误'));
  render(<AssetsOfficial/>);
  expect((await screen.findByRole('alert')).textContent).toContain('网络错误');
  expect(screen.queryByText('暂无官方形象')).toBeNull();
  api.ips.mockResolvedValueOnce([free]);
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(await screen.findByRole('button', { name: '查看 Annie 安妮' })).toBeTruthy();
});
