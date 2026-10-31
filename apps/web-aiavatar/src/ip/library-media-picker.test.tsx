// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { LibraryMediaPicker } from './library-media-picker';

const api = vi.hoisted(() => ({ folders: vi.fn(), canvasFolder: vi.fn(), materials: vi.fn(), objects: vi.fn(), upload: vi.fn() }));
vi.mock('./studio-errors', async () => {
  const { useCallback, useState } = await import('react');
  return {
    // 和真的一样，setter 要稳定，否则带它做依赖的副作用会一直重跑。
    useStudioErrorState: () => { const [e, set] = useState(''); return [e, useCallback((v: unknown) => set(v ? String((v as Error).message || v) : ''), [])]; },
    StudioErrorNotice: ({ error }: any) => <span role="alert">{String(error)}</span>,
  };
});
vi.mock('@/canvas-bridge/asset-library', () => ({
  libraryFolders: api.folders, canvasLibraryFolder: api.canvasFolder, libraryMaterials: api.materials, libraryObjects: api.objects, uploadLibraryMedia: api.upload,
  mainLibraryVersion: (a: any) => a.versions.find((v: any) => v.id === a.mainVersionId),
}));
vi.mock('@/canvas-bridge/image-storage', () => ({ refreshImageUrl: vi.fn() }));
vi.mock('@/canvas-bridge/signed-image', () => ({ SignedImage: (p: any) => <img src={p.src} alt={p.alt}/> }));
vi.mock('@/canvas-bridge/signed-video', () => ({ SignedVideo: () => <video/> }));
vi.mock('@/canvas-bridge/signed-audio', () => ({ SignedAudio: () => <audio/> }));
vi.mock('antd', () => ({
  Button: ({ icon, loading, type, size, ...p }: any) => <button {...p}>{icon}{p.children}</button>,
  Input: ({ prefix, allowClear, ...p }: any) => <input {...p}/>,
  Skeleton: () => <p>正在读取</p>,
  ConfigProvider: ({ children }: any) => children,
  Modal: ({ open, title, children }: any) => open ? <div role="dialog" aria-label={title}>{children}</div> : null,
}));

const image = (id: string, folderId?: string) => ({ id, kind: 'image', title: id, coverUrl: '', tags: [], source: '用户上传', createdAt: '', updatedAt: '',
  metadata: folderId ? { folderId } : {}, data: { dataUrl: `https://cdn.test/${id}`, storageKey: `k/${id}`, width: 1, height: 1, bytes: 1, mimeType: 'image/png' } });
const page = (items: any[]) => ({ items, total: items.length, page: 0, hasMore: false });
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks(); window.localStorage.clear();
  api.folders.mockResolvedValue([{ id: 'f1', name: '保湿精华' }, { id: 'f2', name: '巷里火锅' }]);
  api.canvasFolder.mockResolvedValue({ folderId: '' });
  api.materials.mockResolvedValue(page([]));
  api.objects.mockResolvedValue(page([]));
});

test('opens the library used last time, marks it, and remembers the one the user picked from', async () => {
  window.localStorage.setItem('aiavatar_library_last', 'f1');
  api.materials.mockResolvedValue(page([image('主图', 'f1')]));
  const onAssets = vi.fn().mockResolvedValue(undefined), onClose = vi.fn();
  render(<LibraryMediaPicker open mediaType="image" onClose={onClose} onAssets={onAssets}/>);
  await waitFor(() => expect(api.materials).toHaveBeenCalledWith(expect.objectContaining({ folder: 'f1', source: 'all', kind: 'image', page: 0 })));
  expect(screen.getByRole('button', { name: /保湿精华.*上次用的/ }).getAttribute('aria-current')).toBe('true');
  fireEvent.click(await screen.findByRole('button', { name: '选 主图' }));
  fireEvent.click(screen.getByRole('button', { name: /巷里火锅/ }));
  await waitFor(() => expect(api.materials).toHaveBeenLastCalledWith(expect.objectContaining({ folder: 'f2' })));
  fireEvent.click(screen.getByRole('button', { name: '用这个' }));
  await waitFor(() => expect(onAssets).toHaveBeenCalledWith([expect.objectContaining({ id: '主图' })]));
  expect(window.localStorage.getItem('aiavatar_library_last')).toBe('f2');
  expect(onClose).toHaveBeenCalled();
});

test('the canvas library wins over the remembered one; AI 生成 reads generated files outside any library', async () => {
  window.localStorage.setItem('aiavatar_library_last', 'f1');
  api.canvasFolder.mockResolvedValue({ folderId: 'f2' });
  render(<LibraryMediaPicker open projectId="p1" mediaType="video" onClose={vi.fn()} onAssets={vi.fn()}/>);
  await waitFor(() => expect(api.materials).toHaveBeenCalledWith(expect.objectContaining({ folder: 'f2', kind: 'video' })));
  expect(screen.queryByRole('tab', { name: '人物' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'AI 生成' }));
  await waitFor(() => expect(api.materials).toHaveBeenLastCalledWith(expect.objectContaining({ folder: 'unfiled', source: 'generated', kind: 'video' })));
});

test('the 人物 tab of an image slot lists roles that have a picture, with their object reference', async () => {
  api.objects.mockResolvedValue(page([
    { id: 'o1', kind: 'character', name: '林夏', description: '', prompt: '', mainVersionId: 'v1', versions: [{ id: 'v1', storageKey: 'k/lin', url: 'https://cdn.test/lin' }], sources: [], createdAt: '', updatedAt: '' },
    { id: 'o2', kind: 'character', name: '没图的', description: '', prompt: '', versions: [], sources: [], createdAt: '', updatedAt: '' },
  ]));
  const onAssets = vi.fn().mockResolvedValue(undefined);
  render(<LibraryMediaPicker open mediaType="image" onClose={vi.fn()} onAssets={onAssets}/>);
  fireEvent.click(await screen.findByRole('tab', { name: '人物' }));
  await waitFor(() => expect(api.objects).toHaveBeenCalledWith(expect.objectContaining({ kind: 'character', folder: 'all' })));
  fireEvent.click(await screen.findByRole('button', { name: '选 林夏' }));
  expect(screen.queryByRole('button', { name: '选 没图的' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '用这个' }));
  await waitFor(() => expect(onAssets.mock.calls[0][0][0].metadata.libraryReference).toMatchObject({ objectId: 'o1', versionId: 'v1' }));
});

test('an upload goes into the open library and comes back selected; 新建人物 asks for photos only', async () => {
  window.localStorage.setItem('aiavatar_library_last', 'f1');
  api.upload.mockResolvedValue({ key: 'k/新图' });
  api.materials.mockResolvedValueOnce(page([])).mockResolvedValue(page([image('新图', 'f1')]));
  render(<LibraryMediaPicker open mediaType="image" upload people={false} onClose={vi.fn()} onAssets={vi.fn()}/>);
  expect(screen.queryByRole('tab', { name: '人物' })).toBeNull();
  await waitFor(() => expect(api.materials).toHaveBeenCalledWith(expect.objectContaining({ folder: 'f1' })));
  expect(screen.getByRole('button', { name: /上传到这个库/ })).toBeDefined();
  const file = new File(['x'], '新图.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('选择要上传到资产库的文件'), { target: { files: [file] } });
  await waitFor(() => expect(api.upload).toHaveBeenCalledWith(file, 'image', 'f1'));
  await waitFor(() => expect(screen.getByRole('button', { name: '选 新图' }).getAttribute('aria-pressed')).toBe('true'));
  expect(screen.getByText('已选：新图')).toBeDefined();
});

test('an upload never pushes the selection past max', async () => {
  window.localStorage.setItem('aiavatar_library_last', 'f1');
  api.upload.mockResolvedValue({ key: 'k/新图' });
  api.materials.mockResolvedValueOnce(page([image('a', 'f1'), image('b', 'f1')])).mockResolvedValue(page([image('a', 'f1'), image('b', 'f1'), image('新图', 'f1')]));
  render(<LibraryMediaPicker open mediaType="image" upload max={2} onClose={vi.fn()} onAssets={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button', { name: '选 a' }));
  fireEvent.click(screen.getByRole('button', { name: '选 b' }));
  fireEvent.change(screen.getByLabelText('选择要上传到资产库的文件'), { target: { files: [new File(['x'], '新图.png', { type: 'image/png' })] } });
  await waitFor(() => expect(screen.getByRole('button', { name: '选 新图' })).toBeDefined());
  expect(screen.getByRole('button', { name: '选 新图' }).getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByText('已选 2 个')).toBeDefined();
});
