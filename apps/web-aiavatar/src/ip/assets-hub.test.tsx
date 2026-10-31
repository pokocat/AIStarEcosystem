// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AssetsHub, hubTab } from './assets-hub';

const route = vi.hoisted(() => ({ query: new URLSearchParams(), push: vi.fn() }));
const api = vi.hoisted(() => ({ folders: vi.fn(), materials: vi.fn(), edit: vi.fn(), upload: vi.fn(), createFolder: vi.fn(), voices: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => route.query, useRouter: () => route }));
vi.mock('next/link', () => ({ default: ({ children, ...p }: any) => <a {...p}>{children}</a> }));
vi.mock('./studio-page', () => ({ StudioPage: ({ children }: any) => <main>{children}</main> }));
vi.mock('./assets-people', () => ({ AssetsPeople: ({ library }: any) => <p>人物 {library}</p> }));
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
  libraryFolders: api.folders, libraryMaterials: api.materials, editLibraryMaterial: api.edit, uploadLibraryMedia: api.upload,
  createLibraryFolder: api.createFolder, renameLibraryFolder: vi.fn(), deleteLibraryFolder: vi.fn(),
}));
vi.mock('@/canvas-bridge/saved-assets', () => ({ saveAsset: vi.fn() }));
vi.mock('@/canvas-bridge/image-storage', () => ({ refreshImageUrl: vi.fn() }));
vi.mock('@/canvas-bridge/signed-image', () => ({ SignedImage: (p: any) => <img src={p.src} alt={p.alt}/> }));
vi.mock('@/canvas-bridge/signed-video', () => ({ SignedVideo: () => <video/> }));
vi.mock('@/canvas-bridge/signed-audio', () => ({ SignedAudio: () => <audio/> }));
vi.mock('@/components/hub/data', () => ({ studioHref: (h: string) => `/studio${h}`, useHubData: (_: unknown, initial: unknown) => ({ data: initial, loading: false, error: null }) }));
vi.mock('@/proto/api', () => ({ VoiceApi: { mine: api.voices } }));
vi.mock('antd', () => ({
  App: Object.assign(({ children }: any) => <div>{children}</div>, { useApp: () => ({}) }),
  ConfigProvider: ({ children }: any) => children,
  Button: ({ icon, loading, type, size, danger, ...p }: any) => <button {...p}>{icon}{p.children}</button>,
  Input: ({ prefix, allowClear, onPressEnter, ...p }: any) => <input {...p}/>,
  Checkbox: ({ checked, onChange, ...p }: any) => <input type="checkbox" checked={checked} onChange={onChange} {...p}/>,
  Dropdown: ({ children, menu }: any) => <span>{children}<span role="menu">{(menu?.items || []).filter((i: any) => i.key).map((i: any) =>
    <button key={i.key} role="menuitem" disabled={i.disabled} onClick={e => menu.onClick({ key: i.key, domEvent: e })}>{i.label}</button>)}</span></span>,
  Modal: ({ open, title, children, onOk, okText }: any) => open ? <div role="dialog" aria-label={title}>{children}{onOk && <button onClick={onOk}>{okText}</button>}</div> : null,
}));

const image = (id: string, title: string, folderId?: string) => ({ id, kind: 'image', title, coverUrl: '', tags: [], source: 'AI 生成', createdAt: '', updatedAt: '',
  metadata: folderId ? { folderId } : {}, data: { dataUrl: `https://cdn.test/${id}.png`, storageKey: `ipstudio_gen/u/${id}.png`, width: 768, height: 1024, bytes: 1, mimeType: 'image/png' } });
const page = (items: any[]) => ({ items, total: items.length, page: 0, hasMore: false });
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks(); route.query = new URLSearchParams();
  api.folders.mockResolvedValue([{ id: 'f1', name: '保湿精华' }, { id: 'f2', name: '巷里火锅' }]);
  api.materials.mockResolvedValue(page([]));
  api.edit.mockResolvedValue({}); api.upload.mockResolvedValue({ key: 'k' }); api.voices.mockResolvedValue([]);
});

test('old asset links land on the new categories', () => {
  expect(hubTab('ips')).toBe('people'); expect(hubTab('authorized')).toBe('people'); expect(hubTab('objects')).toBe('people');
  expect(hubTab('materials')).toBe('all'); expect(hubTab('voices')).toBe('audio');
  expect(hubTab('video')).toBe('video'); expect(hubTab(null)).toBe('all'); expect(hubTab('nope')).toBe('all');
});

test('the AI 生成 library lists generated files that are in no library yet, and has no upload tile', async () => {
  route.query = new URLSearchParams('lib=ai&tab=image');
  render(<AssetsHub/>);
  await waitFor(() => expect(api.materials).toHaveBeenCalledWith(expect.objectContaining({ folder: 'unfiled', source: 'generated', kind: 'image', page: 0 })));
  expect(screen.getByRole('heading', { name: 'AI 生成' })).toBeDefined();
  expect(screen.queryByRole('button', { name: /^上传/ })).toBeNull();
  expect(screen.queryByRole('button', { name: '按来源筛选' })).toBeNull();
});

test('moving a file into a library changes only its folder and reloads the list', async () => {
  route.query = new URLSearchParams('lib=ai');
  api.materials.mockResolvedValue(page([image('m1', '精华放在洗手台上')]));
  render(<AssetsHub/>);
  const tile = (await screen.findByRole('button', { name: '打开 精华放在洗手台上' })).closest('.assets-tile') as HTMLElement;
  const menu = tile.querySelector('[role="menu"]') as HTMLElement;
  fireEvent.click([...menu.querySelectorAll('button')].find(b => b.textContent === '保湿精华')!);
  await waitFor(() => expect(api.edit).toHaveBeenCalledWith('m1', { folderId: 'f1' }));
  await waitFor(() => expect(api.materials).toHaveBeenCalledTimes(2));
});

test('uploads go into the library being viewed, and the source filter reaches the server', async () => {
  route.query = new URLSearchParams('lib=f2&tab=image');
  render(<AssetsHub/>);
  fireEvent.click(await screen.findByRole('button', { name: /^上传/ }));
  const file = new File(['x'], '门头.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('选择要上传的文件'), { target: { files: [file] } });
  await waitFor(() => expect(api.upload).toHaveBeenCalledWith(file, 'image', 'f2'));
  fireEvent.click(screen.getByRole('menuitem', { name: '我上传的' }));
  await waitFor(() => expect(api.materials).toHaveBeenLastCalledWith(expect.objectContaining({ folder: 'f2', kind: 'image', source: 'upload' })));
});

test('a library that no longer exists falls back to 全部 instead of an empty page', async () => {
  route.query = new URLSearchParams('lib=gone');
  render(<AssetsHub/>);
  await waitFor(() => expect(api.materials).toHaveBeenLastCalledWith(expect.objectContaining({ folder: 'all' })));
  expect(screen.getByRole('button', { name: '全部' }).getAttribute('aria-current')).toBe('true');
});

test('the 人物 tab hands the chosen library to the people view', async () => {
  route.query = new URLSearchParams('tab=people&lib=f1');
  render(<AssetsHub/>);
  expect(await screen.findByText('人物 f1')).toBeDefined();
  expect(api.materials).not.toHaveBeenCalled();
});
