// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { LibraryMediaPicker } from './library-media-picker';

const api = vi.hoisted(() => ({ folders: vi.fn(), canvasFolder: vi.fn(), materials: vi.fn(), objects: vi.fn(), upload: vi.fn(), ips: vi.fn() }));
vi.mock('@/canvas-bridge/studio-api', () => ({ listStudioIpAssets: api.ips }));
vi.mock('./audio-recorder-dialog', () => ({ AudioRecorderDialog: ({ open, onSave, onClose }: any) => open ? <button onClick={async () => { await onSave(new File(['wav'], '旁白.wav', { type: 'audio/wav' })); onClose(); }}>保存测试录音</button> : null }));
vi.mock('./studio-errors', async () => {
  const { useCallback, useState } = await import('react');
  return {
    normalizeStudioError: (error: Error) => ({ code: 'CLIENT_ERROR', message: error.message }),
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
vi.mock('@/canvas-bridge/signed-video', () => ({ SignedVideo: ({ storageKey, ...props }: any) => <video {...props}/> }));
vi.mock('@/canvas-bridge/signed-audio', () => ({ SignedAudio: () => <audio/> }));
vi.mock('antd', () => ({
  Button: ({ icon, loading, type, size, ...p }: any) => <button {...p}>{icon}{p.children}</button>,
  Input: ({ prefix, allowClear, ...p }: any) => <input {...p}/>,
  Skeleton: () => <p>正在读取</p>,
  Select: ({ options, value, onChange, getPopupContainer, popupMatchSelectWidth, ...p }: any) => <select {...p} value={value} onChange={e => onChange(e.target.value)}>{options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>,
  ConfigProvider: ({ children }: any) => children,
  Modal: ({ open, title, children, onCancel }: any) => open ? <div role="dialog" aria-label={title}><button type="button" onClick={onCancel}>关闭 {title}</button>{children}</div> : null,
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
  api.ips.mockResolvedValue([]);
});

test('opens the library used last time, marks it, and remembers the one the user picked from', async () => {
  window.localStorage.setItem('aiavatar_library_last', 'f1');
  api.materials.mockResolvedValue(page([image('主图', 'f1')]));
  const onAssets = vi.fn().mockResolvedValue(undefined), onClose = vi.fn();
  render(<LibraryMediaPicker open mediaType="image" onClose={onClose} onAssets={onAssets}/>);
  await waitFor(() => expect(api.materials).toHaveBeenCalledWith(expect.objectContaining({ folder: 'f1', source: 'all', kind: 'image', page: 0 })));
  expect(screen.getByRole('button', { name: /保湿精华.*上次使用/ }).getAttribute('aria-current')).toBe('true');
  fireEvent.click(await screen.findByRole('button', { name: '选择 主图' }));
  fireEvent.click(screen.getByRole('button', { name: /巷里火锅/ }));
  await waitFor(() => expect(api.materials).toHaveBeenLastCalledWith(expect.objectContaining({ folder: 'f2' })));
  fireEvent.click(screen.getByRole('button', { name: '使用' }));
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

test('video upload occupies the first grid cell and preview keeps the current selection', async () => {
  const video = { ...image('参考片.mp4'), kind: 'video', data: { url: '/reference.mp4', storageKey: 'k/reference.mp4' } };
  api.materials.mockResolvedValue(page([video]));
  const onAssets = vi.fn().mockResolvedValue(undefined);
  render(<LibraryMediaPicker open upload mediaType="video" title="选择参考视频" onClose={vi.fn()} onAssets={onAssets}/>);
  const select = await screen.findByRole('button', { name: '选择 参考片.mp4' });
  const firstCell = screen.getAllByRole('listitem')[0];
  expect(within(firstCell).getByRole('button', { name: '上传视频' })).toBeTruthy();
  const expand = screen.getByRole('button', { name: '放大预览 参考片.mp4' });
  fireEvent.click(expand);
  const preview = screen.getByRole('dialog', { name: '参考片.mp4' });
  const player = within(preview).getByLabelText('参考片.mp4') as HTMLVideoElement;
  expect(player.getAttribute('src')).toBe('/reference.mp4');
  expect(player.controls).toBe(true);
  expect(select.getAttribute('aria-pressed')).toBe('false');
  expect(onAssets).not.toHaveBeenCalled();
  fireEvent.click(within(preview).getByRole('button', { name: '关闭 参考片.mp4' }));
  fireEvent.click(select);
  fireEvent.click(expand);
  expect(select.getAttribute('aria-pressed')).toBe('true');
});

test('image preview shows the full image and leaves the asset unselected', async () => {
  api.materials.mockResolvedValue(page([image('主图')]));
  render(<LibraryMediaPicker open upload mediaType="image" onClose={vi.fn()} onAssets={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button', { name: '放大预览 主图' }));
  const preview = screen.getByRole('dialog', { name: '主图' });
  expect(within(preview).getByRole('img', { name: '主图' }).getAttribute('src')).toBe('https://cdn.test/主图');
  expect(screen.getByRole('button', { name: '选择 主图' }).getAttribute('aria-pressed')).toBe('false');
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
  fireEvent.click(await screen.findByRole('button', { name: '选择 林夏' }));
  expect(screen.queryByRole('button', { name: '选择 没图的' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '使用' }));
  await waitFor(() => expect(onAssets.mock.calls[0][0][0].metadata.libraryReference).toMatchObject({ objectId: 'o1', versionId: 'v1' }));
});

test('existing IP main, history and three-view images are independently selectable and searchable; official ones are not mixed into 人物', async () => {
  const main = { avatarId: 'avatar-1', version: 2, current: true, name: '潮玩个人IP', characterName: '潮玩个人IP', url: 'https://cdn/main', storageKey: 'ip/main', assetRole: 'main' };
  api.ips.mockResolvedValue([main,
    { ...main, current: false, version: 1, assetRole: 'history', storageKey: 'ip/old', url: 'https://cdn/old' },
    { ...main, current: false, lookId: 'look-3v', name: '人物三视图', assetRole: 'three-view', storageKey: 'ip/three', url: 'https://cdn/three' },
    { ...main, avatarId: 'official:1', librarySource: 'official', name: '官方人物' },
  ]);
  const onAssets = vi.fn().mockResolvedValue(undefined);
  render(<LibraryMediaPicker open mediaType="image" onClose={vi.fn()} onAssets={onAssets}/>);
  fireEvent.click(await screen.findByRole('tab', { name: '人物' }));
  expect(await screen.findByRole('button', { name: '选择 潮玩个人IP · 主形象' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '选择 潮玩个人IP · 历史版本 v1' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /选择 官方人物/ })).toBeNull();
  fireEvent.change(screen.getByRole('textbox', { name: '搜索资产' }), { target: { value: '三视图' } });
  fireEvent.click(await screen.findByRole('button', { name: '选择 潮玩个人IP · 人物三视图' }));
  expect(screen.queryByRole('button', { name: '选择 潮玩个人IP · 主形象' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '使用' }));
  await waitFor(() => expect(onAssets).toHaveBeenCalledWith([expect.objectContaining({
    data: expect.objectContaining({ storageKey: 'ip/three', dataUrl: 'https://cdn/three' }),
    metadata: expect.objectContaining({ ipReference: expect.objectContaining({ avatarId: 'avatar-1', lookId: 'look-3v', version: 2 }) }),
  })]));
});

test('a role offers every image version and using the secondary view retains its exact version', async () => {
  api.objects.mockResolvedValue(page([{ id: 'o1', kind: 'character', name: '林夏', description: '', prompt: '', mainVersionId: 'front', sources: [], createdAt: '', updatedAt: '',
    versions: [{ id: 'front', storageKey: 'role/front', url: 'https://cdn/front' }, { id: 'side', storageKey: 'role/side', url: 'https://cdn/side' }] }]));
  const onAssets = vi.fn().mockResolvedValue(undefined);
  render(<LibraryMediaPicker open mediaType="image" max={2} onClose={vi.fn()} onAssets={onAssets}/>);
  fireEvent.click(await screen.findByRole('tab', { name: '人物' }));
  fireEvent.click(await screen.findByRole('button', { name: '选择 林夏 · 图片 1（主图）' }));
  fireEvent.click(screen.getByRole('button', { name: '选择 林夏 · 图片 2' }));
  fireEvent.click(screen.getByRole('button', { name: '使用' }));
  await waitFor(() => expect(onAssets).toHaveBeenCalled());
  expect(onAssets.mock.calls[0][0].map((a: any) => a.data.storageKey)).toEqual(['role/front', 'role/side']);
  expect(onAssets.mock.calls[0][0][1].metadata.libraryReference.versionId).toBe('side');
});

test('the generated-file library guides to all people, while a named folder keeps its own boundary', async () => {
  render(<LibraryMediaPicker open mediaType="image" onClose={vi.fn()} onAssets={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('tab', { name: '人物' }));
  await waitFor(() => expect(api.ips).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'AI 生成', exact: true }));
  fireEvent.click(await screen.findByRole('button', { name: '查看全部人物' }));
  await waitFor(() => expect(api.ips).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole('button', { name: '巷里火锅', exact: true }));
  await waitFor(() => expect(api.objects).toHaveBeenLastCalledWith(expect.objectContaining({ folder: 'f2' })));
  expect(api.ips).toHaveBeenCalledTimes(2);
});

test('an IP load failure reports an error rather than claiming that the user has no people', async () => {
  api.ips.mockRejectedValue(new Error('IP 加载失败'));
  render(<LibraryMediaPicker open mediaType="image" onClose={vi.fn()} onAssets={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('tab', { name: '人物' }));
  expect((await screen.findByRole('alert')).textContent).toBe('IP 加载失败');
  expect(screen.queryByText('暂无带图的人物。')).toBeNull();
  api.ips.mockResolvedValue([]);
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
});

test('an upload goes into the open library and comes back selected; 新建人物 asks for photos only', async () => {
  window.localStorage.setItem('aiavatar_library_last', 'f1');
  api.upload.mockResolvedValue({ key: 'k/新图' });
  api.materials.mockResolvedValueOnce(page([])).mockResolvedValue(page([image('新图', 'f1')]));
  render(<LibraryMediaPicker open mediaType="image" upload people={false} onClose={vi.fn()} onAssets={vi.fn()}/>);
  expect(screen.queryByRole('tab', { name: '人物' })).toBeNull();
  await waitFor(() => expect(api.materials).toHaveBeenCalledWith(expect.objectContaining({ folder: 'f1' })));
  expect(screen.getByRole('button', { name: /上传到此资产库/ })).toBeDefined();
  const file = new File(['x'], '新图.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('选择要上传到资产库的文件'), { target: { files: [file] } });
  await waitFor(() => expect(api.upload).toHaveBeenCalledWith(file, 'image', 'f1'));
  await waitFor(() => expect(screen.getByRole('button', { name: '选择 新图' }).getAttribute('aria-pressed')).toBe('true'));
  expect(screen.getByText('已选：新图')).toBeDefined();
});

test('an upload never pushes the selection past max', async () => {
  window.localStorage.setItem('aiavatar_library_last', 'f1');
  api.upload.mockResolvedValue({ key: 'k/新图' });
  api.materials.mockResolvedValueOnce(page([image('a', 'f1'), image('b', 'f1')])).mockResolvedValue(page([image('a', 'f1'), image('b', 'f1'), image('新图', 'f1')]));
  render(<LibraryMediaPicker open mediaType="image" upload max={2} onClose={vi.fn()} onAssets={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button', { name: '选择 a' }));
  fireEvent.click(screen.getByRole('button', { name: '选择 b' }));
  fireEvent.change(screen.getByLabelText('选择要上传到资产库的文件'), { target: { files: [new File(['x'], '新图.png', { type: 'image/png' })] } });
  await waitFor(() => expect(screen.getByRole('button', { name: '选择 新图' })).toBeDefined());
  expect(screen.getByRole('button', { name: '选择 新图' }).getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByText('已选 2/2')).toBeDefined();
});

test('uploads every file even after a failure and uses the successful files up to the remaining limit', async () => {
  window.localStorage.setItem('aiavatar_library_last', 'f1');
  const files = ['一', '损坏', '二', '三'].map(name => new File(['x'], `${name}.png`, { type: 'image/png' }));
  const stored = [image('已有', 'f1')];
  api.materials.mockImplementation(async () => page([...stored]));
  api.upload.mockImplementation(async (file: File) => {
    const name = file.name.replace('.png', '');
    if (name === '损坏') throw new Error('图片格式无效');
    const asset = image(name, 'f1');
    stored.unshift(asset);
    return { key: asset.data.storageKey };
  });
  const onAssets = vi.fn();
  render(<LibraryMediaPicker open mediaType="image" upload max={3} onClose={vi.fn()} onAssets={onAssets}/>);
  fireEvent.click(await screen.findByRole('button', { name: '选择 已有' }));
  const input = screen.getByLabelText<HTMLInputElement>('选择要上传到资产库的文件');
  expect(input.multiple).toBe(true);
  fireEvent.change(input, { target: { files } });
  await screen.findByText('已选 3/3');
  expect(api.upload.mock.calls).toEqual(files.map(file => [file, 'image', 'f1']));
  expect(screen.getByRole('alert').textContent).toContain('「损坏.png」图片格式无效');
  expect(screen.getByRole('button', { name: '选择 三' }).getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(screen.getByRole('button', { name: '使用' }));
  expect(onAssets.mock.calls[0][0].map((asset: { id: string }) => asset.id)).toEqual(['已有', '一', '二']);
});

test('recording in an audio slot is stored in the current library and selected for use', async () => {
  window.localStorage.setItem('aiavatar_library_last', 'f2');
  const audio = { ...image('旁白', 'f2'), kind: 'audio', data: { storageKey: 'k/旁白', url: '', durationSec: 4, mimeType: 'audio/wav', bytes: 128044 } };
  api.upload.mockResolvedValue({ key: 'k/旁白' });
  api.materials.mockResolvedValueOnce(page([])).mockResolvedValue(page([audio]));
  render(<LibraryMediaPicker open mediaType="audio" upload onClose={vi.fn()} onAssets={vi.fn()}/>);
  await waitFor(() => expect(api.materials).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: '录音' }));
  fireEvent.click(screen.getByRole('button', { name: '保存测试录音' }));
  await waitFor(() => expect(api.upload).toHaveBeenCalledWith(expect.objectContaining({ name: '旁白.wav' }), 'audio', 'f2'));
  await waitFor(() => expect(screen.getByRole('button', { name: '选择 旁白' }).getAttribute('aria-pressed')).toBe('true'));
  expect(screen.getByText('已选：旁白')).toBeDefined();
});

test('the existing file-upload button remains available while library data is loading', async () => {
  api.folders.mockImplementation(() => new Promise(() => {}));
  render(<LibraryMediaPicker open mediaType="audio" upload onClose={vi.fn()} onAssets={vi.fn()}/>);
  expect((screen.getByRole('button', { name: '上传', exact: true }) as HTMLButtonElement).disabled).toBe(false);
  expect((screen.getByRole('button', { name: '录音', exact: true }) as HTMLButtonElement).disabled).toBe(true);
});

test('官方形象 selects one main image per person and keeps licensed people locked', async () => {
  const free = { avatarId: 'official:PA-01', version: 1, current: true, name: 'Annie 安妮', characterName: 'Annie 安妮', url: 'https://cdn/annie', storageKey: 'dap_plaza/annie.jpg',
    assetRole: 'main', librarySource: 'official', access: 'free', category: 'pro', description: '商务主持' };
  api.ips.mockResolvedValue([
    { ...free, current: false, lookId: 'right', name: '右侧脸', assetRole: 'side', storageKey: 'dap_plaza/annie-r.jpg', url: 'https://cdn/annie-r' },
    free,
    { ...free, avatarId: 'official:PA-02', name: '博文', characterName: '博文', storageKey: 'dap_plaza/bowen.jpg', url: 'https://cdn/bowen' },
    { ...free, avatarId: 'official:PA-x', name: '签约艺人', characterName: '签约艺人', access: 'license', category: 'life', storageKey: 'dap_plaza/x.jpg', url: 'https://cdn/x' },
    { avatarId: 'mine-1', version: 1, current: true, name: '我的人物', characterName: '我的人物', url: 'https://cdn/m', storageKey: 'ip/m', assetRole: 'main' },
  ]);
  const onAssets = vi.fn().mockResolvedValue(undefined);
  render(<LibraryMediaPicker open mediaType="image" max={3} onClose={vi.fn()} onAssets={onAssets}/>);
  fireEvent.click(await screen.findByRole('tab', { name: '官方形象' }));
  const locked = await screen.findByRole('button', { name: '选择 签约艺人' });
  expect((locked as HTMLButtonElement).disabled).toBe(true);
  expect(locked.textContent).toContain('需授权，暂不能使用');
  expect(screen.queryByRole('button', { name: /我的人物/ })).toBeNull();
  expect(screen.getAllByRole('button', { name: /选择 Annie 安妮/ })).toHaveLength(1);
  expect(screen.queryByRole('navigation', { name: '资产库' })).toBeNull();
  fireEvent.change(screen.getByRole('combobox', { name: '按分类筛选官方形象' }), { target: { value: 'pro' } });
  fireEvent.click(await screen.findByRole('button', { name: '选择 Annie 安妮', exact: true }));
  expect(screen.queryByRole('button', { name: /签约艺人/ })).toBeNull();
  expect(screen.getByText('已选 1/3')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '选择 博文' }));
  expect(screen.getByText('已选 2/3')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '使用' }));
  await waitFor(() => expect(onAssets).toHaveBeenCalledWith([
    expect.objectContaining({ data: expect.objectContaining({ storageKey: 'dap_plaza/annie.jpg' }) }),
    expect.objectContaining({ data: expect.objectContaining({ storageKey: 'dap_plaza/bowen.jpg' }) }),
  ]));
});
