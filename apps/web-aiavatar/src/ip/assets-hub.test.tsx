// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AssetsHub, hubTab } from './assets-hub';

const route = vi.hoisted(() => ({ query: new URLSearchParams(), push: vi.fn() }));
const dialog = vi.hoisted(() => ({ confirm: vi.fn(), success: vi.fn() }));
const api = vi.hoisted(() => ({ remove: vi.fn(), folders: vi.fn(), materials: vi.fn(), edit: vi.fn(), upload: vi.fn(), createFolder: vi.fn(), voices: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => route.query, useRouter: () => route }));
vi.mock('next/link', () => ({ default: ({ children, ...p }: any) => <a {...p}>{children}</a> }));
vi.mock('./studio-page', () => ({ StudioPage: ({ children }: any) => <main>{children}</main> }));
vi.mock('./assets-people', () => ({ AssetsPeople: ({ library }: any) => <p>人物 {library}</p> }));
vi.mock('./assets-objects', () => ({ AssetsObjects: ({ kind, from }: any) => <p>对象 {kind} {from}</p> }));
vi.mock('./library-source-select', () => ({ LibrarySourceSelect: ({ value, onChange }: any) => <button onClick={() => onChange('DW-2')}>选择作品 {value}</button> }));
vi.mock('./library-save-dialog', () => ({ LibrarySaveDialog: ({ image }: any) => image ? <p>存入 {image.storageKey} {image.projectId}</p> : null }));
vi.mock('./audio-recorder-dialog', () => ({ AudioRecorderDialog: ({ open, onSave, onClose }: any) => open ? <button onClick={async () => { await onSave(new File(['wav'], '旁白.wav', { type: 'audio/wav' })); onClose(); }}>保存测试录音</button> : null }));
vi.mock('./studio-errors', async () => {
  const { useCallback, useState } = await import('react');
  return {
    useStudioApp: () => ({ message: { success: dialog.success }, modal: { confirm: dialog.confirm } }),
    // 和真的一样，setter 要稳定，否则带它做依赖的副作用会一直重跑。
    useStudioErrorState: () => { const [e, set] = useState(''); return [e, useCallback((v: unknown) => set(v ? String((v as Error).message || v) : ''), [])]; },
    StudioErrorNotice: ({ error }: any) => <span role="alert">{String(error)}</span>,
  };
});
vi.mock('@/canvas-bridge/asset-library', () => ({
  libraryFolders: api.folders, libraryMaterials: api.materials, editLibraryMaterial: api.edit, uploadLibraryMedia: api.upload,
  createLibraryFolder: api.createFolder, renameLibraryFolder: vi.fn(), deleteLibraryFolder: vi.fn(),
}));
vi.mock('@/canvas-bridge/saved-assets', () => ({ saveAsset: vi.fn(), deleteSavedAsset: api.remove }));
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
  Dropdown: ({ children, menu }: any) => <span>{children}<span role="menu">{(menu?.items || []).flatMap((i: any) => i.children || [i]).filter((i: any) => i.key).map((i: any) =>
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
  api.edit.mockResolvedValue({}); api.remove.mockResolvedValue(undefined);
  // 确认框直接点「删除」。
  dialog.confirm.mockImplementation((o: any) => void o.onOk()); api.upload.mockResolvedValue({ key: 'k' }); api.voices.mockResolvedValue([]);
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

test('audio recordings use the audio import path and preserve the current library', async () => {
  route.query = new URLSearchParams('tab=audio&lib=f2');
  render(<AssetsHub/>);
  fireEvent.click(await screen.findByRole('button', { name: '录音' }));
  fireEvent.click(screen.getByRole('button', { name: '保存测试录音' }));
  await waitFor(() => expect(api.upload).toHaveBeenCalledWith(expect.objectContaining({ name: '旁白.wav', type: 'audio/wav' }), 'audio', 'f2'));
  await waitFor(() => expect(screen.queryByRole('button', { name: '保存测试录音' })).toBeNull());
});

test('scenes and props have their own tabs and keep the source filter', async () => {
  route.query = new URLSearchParams('tab=scene&from=DW-1');
  render(<AssetsHub/>);
  expect(await screen.findByText('对象 scene DW-1')).toBeTruthy();
  expect(hubTab('prop')).toBe('prop');
});

test('materials can be narrowed to one work, and clearing keeps other filters', async () => {
  route.query = new URLSearchParams('tab=image&from=DW-1');
  render(<AssetsHub/>);
  await waitFor(() => expect(api.materials).toHaveBeenCalledWith(expect.objectContaining({ kind: 'image', projectId: 'DW-1' })));
  fireEvent.click(await screen.findByRole('button', { name: /选择作品/ }));
  expect(route.push).toHaveBeenCalledWith(expect.stringContaining('from=DW-2'));
  expect(route.push.mock.calls.at(-1)?.[0]).toContain('tab=image');
});

test('an image can be saved as a character, scene or prop, and only a canvas counts as its source', async () => {
  api.materials.mockResolvedValue(page([
    { ...image('a', '门头'), metadata: { projectId: 'IPP-1', nodeId: 'n1' } },
    { ...image('b', '分镜'), metadata: { projectId: 'DW-1', nodeId: 'board:c1' } },
  ]));
  render(<AssetsHub/>);
  await screen.findByRole('button', { name: '打开 门头' });
  const menus = screen.getAllByRole('menuitem', { name: '存为角色、场景或道具' });
  fireEvent.click(menus[0]);
  expect(screen.getByText('存入 ipstudio_gen/u/a.png IPP-1')).toBeTruthy();
  fireEvent.click(menus[1]);
  expect(screen.getByText(/存入 ipstudio_gen\/u\/b\.png\s*$/)).toBeTruthy();
});


test('a single file is deleted from its card menu after confirming, then the list reloads', async () => {
  api.materials.mockResolvedValue(page([image('m1', '失败的测试图')]));
  render(<AssetsHub/>);
  const tile = (await screen.findByRole('button', { name: '打开 失败的测试图' })).closest('.assets-tile') as HTMLElement;
  fireEvent.click([...tile.querySelectorAll('[role="menuitem"]')].find(b => b.textContent === '删除')!);
  expect(dialog.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: '删除「失败的测试图」？' }));
  await waitFor(() => expect(api.remove).toHaveBeenCalledWith('m1'));
  await waitFor(() => expect(api.materials).toHaveBeenCalledTimes(2));
});

test('several files can be selected and deleted together', async () => {
  api.materials.mockResolvedValue(page([image('m1', '图一'), image('m2', '图二'), image('m3', '图三')]));
  render(<AssetsHub/>);
  fireEvent.click(await screen.findByRole('button', { name: '批量选择' }));
  fireEvent.click(screen.getByRole('button', { name: '选择 图一' }));
  fireEvent.click(screen.getByRole('button', { name: '选择 图三' }));
  fireEvent.click(screen.getByRole('button', { name: '删除' }));
  expect(dialog.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: '删除选中的 2 个素材？' }));
  await waitFor(() => expect(api.remove.mock.calls.map(c => c[0])).toEqual(['m1', 'm3']));
  await waitFor(() => expect(screen.getByRole('button', { name: '批量选择' })).toBeTruthy());
});

test('a failed delete stops there, reports the error and keeps the selection mode open', async () => {
  api.materials.mockResolvedValue(page([image('m1', '图一'), image('m2', '图二')]));
  api.remove.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('网络异常'));
  render(<AssetsHub/>);
  fireEvent.click(await screen.findByRole('button', { name: '批量选择' }));
  fireEvent.click(screen.getByRole('button', { name: '选择 图一' }));
  fireEvent.click(screen.getByRole('button', { name: '选择 图二' }));
  fireEvent.click(screen.getByRole('button', { name: '删除' }));
  expect(await screen.findByText('网络异常')).toBeTruthy();
  expect(api.remove).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', { name: '完成' })).toBeTruthy();
});
