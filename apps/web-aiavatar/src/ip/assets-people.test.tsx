// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AssetsPeople, NewPersonDialog } from './assets-people';

const api = vi.hoisted(() => ({ objects: vi.fn(), create: vi.fn(), version: vi.fn(), avatars: vi.fn(), licenses: vi.fn(), grants: vi.fn() }));
const picks = vi.hoisted(() => ({ next: [] as any[] }));
vi.mock('next/link', () => ({ default: ({ children, ...p }: any) => <a {...p}>{children}</a> }));
vi.mock('./studio-errors', async () => {
  const { useCallback, useState } = await import('react');
  return {
    useStudioApp: () => ({ message: { success: vi.fn() }, modal: { confirm: vi.fn() } }),
    // 和真的一样，setter 要稳定，否则带它做依赖的副作用会一直重跑。
    useStudioErrorState: () => { const [e, set] = useState(''); return [e, useCallback((v: unknown) => set(v ? String((v as Error).message || v) : ''), [])]; },
    StudioErrorNotice: ({ error }: any) => <span role="alert">{String(error)}</span>,
  };
});
vi.mock('@/canvas-bridge/asset-library', () => ({
  libraryObjects: api.objects, createLibraryObject: api.create, addLibraryVersion: api.version,
  mainLibraryVersion: (a: any) => a.versions.find((v: any) => v.id === a.mainVersionId),
}));
vi.mock('@/canvas-bridge/image-storage', () => ({ refreshImageUrl: vi.fn() }));
vi.mock('@/canvas-bridge/signed-image', () => ({ SignedImage: (p: any) => <img src={p.src} alt={p.alt}/> }));
vi.mock('@/components/hub/data', async () => {
  const { useEffect, useState } = await import('react');
  return {
    studioHref: (h: string) => `/studio${h}`,
    useHubData: (fn: () => Promise<unknown>, initial: unknown, _deps: unknown[], enabled: boolean) => {
      const [state, set] = useState({ data: initial, loading: enabled, error: null });
      useEffect(() => { if (enabled) void fn().then(data => set({ data, loading: false, error: null })); }, [enabled]);
      return state;
    },
  };
});
vi.mock('@/proto/api', () => ({ AvatarApi: { list: api.avatars }, LicenseApi: { list: api.licenses }, AssetApi: { starGrants: api.grants } }));
vi.mock('./library-asset-editor', () => ({ LibraryAssetEditor: ({ assets }: any) => <p>编辑 {assets[0].name}</p> }));
// 选择框换成一个按钮：点一下就把 picks.next 交回去。
vi.mock('./library-reference-picker', () => ({ LibraryReferencePicker: ({ title, onAssets, onClose }: any) => <button onClick={async () => { await onAssets([picks.next.shift()]); onClose(); }}>{title}·选好了</button> }));
vi.mock('antd', () => ({
  Button: ({ icon, loading, type, size, ...p }: any) => <button {...p}>{icon}{p.children}</button>,
  Input: ({ prefix, allowClear, ...p }: any) => <input {...p}/>,
  Checkbox: ({ checked, onChange, children }: any) => <input type="checkbox" aria-label="确认" checked={checked} onChange={onChange}/>,
  Dropdown: ({ children, menu }: any) => <span>{children}<span role="menu">{(menu?.items || []).map((i: any) => <button key={i.key} role="menuitem" onClick={() => menu.onClick({ key: i.key })}>{i.label}</button>)}</span></span>,
  Modal: ({ open, title, children }: any) => open ? <div role="dialog" aria-label={title}>{children}</div> : null,
}));

const photo = (key: string) => ({ id: key, kind: 'image', title: key, coverUrl: '', tags: [], createdAt: '', updatedAt: '', data: { dataUrl: `https://cdn.test/${key}`, storageKey: key, width: 1, height: 1, bytes: 1, mimeType: 'image/png' } });
const role = (id: string, name: string, extra: any = {}) => ({ id, kind: 'character', name, description: '', prompt: '', versions: [], sources: [], createdAt: '', updatedAt: '', ...extra });
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks(); picks.next = [];
  api.objects.mockResolvedValue({ items: [], total: 0, page: 0, hasMore: false });
  api.avatars.mockResolvedValue([]); api.licenses.mockResolvedValue([]); api.grants.mockResolvedValue([]);
});

test('用照片建 needs a name, a front photo and the consent, then saves the front as the main image', async () => {
  const onCreated = vi.fn();
  api.create.mockResolvedValue(role('o1', '唐唐'));
  api.version.mockImplementation(async (id: string, key: string) => role(id, '唐唐', { versions: [{ id: key }] }));
  render(<NewPersonDialog open folderId="f1" onClose={vi.fn()} onCreated={onCreated}/>);
  const create = screen.getByRole('button', { name: '创建人物' }) as HTMLButtonElement;
  expect(create.disabled).toBe(true); expect(screen.getByText('先写个名字')).toBeDefined();
  fireEvent.change(screen.getByLabelText('人物名字'), { target: { value: '唐唐' } });
  expect(screen.getByText('还差一张正脸')).toBeDefined();
  picks.next = [photo('front.png'), photo('left.png')];
  fireEvent.click(screen.getByRole('button', { name: '从资产库选正脸' }));
  fireEvent.click(await screen.findByRole('button', { name: '选正脸·选好了' }));
  fireEvent.click(await screen.findByRole('button', { name: '从资产库选左侧脸' }));
  fireEvent.click(await screen.findByRole('button', { name: '选左侧脸·选好了' }));
  await screen.findByRole('button', { name: '换一张左侧脸' });
  expect(create.disabled).toBe(true);
  fireEvent.click(screen.getByLabelText('确认'));
  expect(create.disabled).toBe(false);
  fireEvent.click(create);
  await waitFor(() => expect(onCreated).toHaveBeenCalled());
  expect(api.create).toHaveBeenCalledWith({ name: '唐唐', kind: 'character', description: '', folderId: 'f1' });
  expect(api.version.mock.calls).toEqual([['o1', 'front.png', true], ['o1', 'left.png', false]]);
});

test('a retry after a half-finished create adds the missing photos to the same person', async () => {
  api.create.mockResolvedValue(role('o1', '唐唐'));
  api.version.mockResolvedValueOnce(role('o1', '唐唐')).mockRejectedValueOnce(new Error('网络断了')).mockResolvedValue(role('o1', '唐唐'));
  const onCreated = vi.fn();
  render(<NewPersonDialog open onClose={vi.fn()} onCreated={onCreated}/>);
  fireEvent.change(screen.getByLabelText('人物名字'), { target: { value: '唐唐' } });
  picks.next = [photo('front.png'), photo('close.png')];
  fireEvent.click(screen.getByRole('button', { name: '从资产库选正脸' }));
  fireEvent.click(await screen.findByRole('button', { name: '选正脸·选好了' }));
  fireEvent.click(await screen.findByRole('button', { name: '从资产库选近景特写' }));
  fireEvent.click(await screen.findByRole('button', { name: '选近景特写·选好了' }));
  fireEvent.click(await screen.findByLabelText('确认'));
  fireEvent.click(screen.getByRole('button', { name: '创建人物' }));
  expect((await screen.findByRole('alert')).textContent).toContain('网络断了');
  fireEvent.click(screen.getByRole('button', { name: '创建人物' }));
  await waitFor(() => expect(onCreated).toHaveBeenCalled());
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(api.version.mock.calls.map(c => c[1])).toEqual(['front.png', 'close.png', 'close.png']);
});

test('人物 puts IPs, roles and stars together; only confirmed real people get the shield', async () => {
  api.avatars.mockResolvedValue([
    { id: 'DH-1', name: '唐唐', path: 'real', tagline: '服装店店主本人', status: 'finalized', imageUrl: 'https://cdn.test/t.png', voiceName: '自然女声' },
    { id: 'DH-2', name: '小紫', path: 'ai', tagline: '元气少女', status: 'finalized', imageUrl: 'https://cdn.test/z.png' },
    { id: 'DH-3', name: '老周', path: 'real', tagline: '没确认', status: 'draft', imageUrl: '' },
  ]);
  api.licenses.mockResolvedValue([{ id: 'L1', char: 'DH-1', status: 'active', verifyMethod: 'liveness' }, { id: 'L3', char: 'DH-3', status: 'active', verifyMethod: 'declared' }]);
  api.grants.mockResolvedValue([{ id: 'G1', starName: '安安', status: 'authorized', scenes: ['带货'], category: '美妆' }, { id: 'G2', starName: '没批', status: 'pending', scenes: [] }]);
  api.objects.mockResolvedValue({ items: [role('o1', '林夏', { sources: [{ title: '合租室友' }] })], total: 1, page: 0, hasMore: false });
  render(<AssetsPeople library="all" folders={[]}/>);
  const tang = await screen.findByRole('link', { name: '查看 唐唐' });
  expect(within(tang).getByRole('img', { name: '本人已刷脸确认' })).toBeDefined();
  expect(within(await screen.findByRole('link', { name: '查看 老周' })).queryByRole('img', { name: '本人已刷脸确认' })).toBeNull();
  expect(await screen.findByRole('link', { name: '查看 安安' })).toBeDefined();
  expect(screen.queryByText('没批')).toBeNull();
  expect(api.objects).toHaveBeenCalledWith(expect.objectContaining({ kind: 'character', folder: 'all' }));
  fireEvent.click(screen.getByRole('button', { name: '真人' }));
  expect(screen.queryByRole('link', { name: '查看 小紫' })).toBeNull();
  expect(screen.queryByRole('button', { name: '查看 林夏' })).toBeNull();
  expect(screen.getByRole('link', { name: '查看 唐唐' })).toBeDefined();
});

test('a library of your own shows only its roles; IPs and stars live in 全部', async () => {
  api.objects.mockResolvedValue({ items: [role('o1', '林夏')], total: 1, page: 0, hasMore: false });
  render(<AssetsPeople library="f1" folders={[{ id: 'f1', name: '合租室友' }]}/>);
  fireEvent.click(await screen.findByRole('button', { name: '查看 林夏' }));
  expect(screen.getByText('编辑 林夏')).toBeDefined();
  expect(api.objects).toHaveBeenCalledWith(expect.objectContaining({ kind: 'character', folder: 'f1' }));
  expect(api.avatars).not.toHaveBeenCalled(); expect(api.grants).not.toHaveBeenCalled();
});
