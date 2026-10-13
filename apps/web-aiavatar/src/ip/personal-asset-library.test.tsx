// @vitest-environment jsdom
import { mountStudioErrorNotifications } from './testing/studio-notification-harness';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { PersonalAssetLibrary } from './personal-asset-library';
const api = vi.hoisted(() => ({ folders: vi.fn(), objects: vi.fn(), materials: vi.fn(), write: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@ai-star-eco/api-client', () => ({ apiFetch: api.write }));
vi.mock('@/canvas-bridge/asset-library', () => ({ libraryFolders: api.folders, libraryObjects: api.objects, libraryMaterials: api.materials, mainLibraryVersion: (a: any) => a.versions.find((v: any) => v.id === a.mainVersionId), createLibraryFolder: api.write, renameLibraryFolder: api.write, deleteLibraryFolder: api.write, editLibraryMaterial: api.write, createLibraryObject: api.write, uploadLibraryMedia: api.write, addLibraryVersion: api.write, setCanvasLibraryFolder: api.write }));
vi.mock('./library-grid-motion', () => ({ LibraryGridMotion: ({ children }: any) => <div>{children}</div> }));
vi.mock('./library-asset-editor', () => ({ LibraryAssetEditor: ({ assets, onClose }: any) => <div><p>编辑 {assets.map((a: any) => a.name).join('、')}</p><button onClick={onClose}>返回</button></div> }));
vi.mock('@/canvas-bridge/signed-image', () => ({ SignedImage: (p: any) => <img src={p.src} alt={p.alt}/> }));
vi.mock('@/canvas-bridge/signed-audio', () => ({ SignedAudio: () => <audio controls/> }));
vi.mock('@/canvas-bridge/signed-video', () => ({ SignedVideo: () => <video controls/> }));
vi.mock('antd', () => ({
  App: { useApp: () => ({ message: { success: vi.fn() }, modal: { confirm: vi.fn() } }) },
  Button: ({ icon, loading, type, size, ...p }: any) => <button {...p}>{icon}{p.children}</button>,
  Input: Object.assign(({ prefix, allowClear, ...p }: any) => <input {...p}/>, { TextArea: (p: any) => <textarea {...p}/> }),
  Checkbox: ({ checked, onChange, ...p }: any) => <input type="checkbox" checked={checked} onChange={onChange} {...p}/>,
  Select: ({ options, onChange, value, classNames, labelRender, getPopupContainer, popupMatchSelectWidth, virtual, showSearch, notFoundContent, ...p }: any) => <select value={value} onChange={e => onChange(e.target.value)} {...p}>{options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>,
  Tabs: ({ items, activeKey, onChange }: any) => <><div role="tablist">{items.map((i: any) => <button key={i.key} role="tab" aria-selected={i.key === activeKey} onClick={() => onChange(i.key)}>{i.label}</button>)}</div><div role="tabpanel">{items.find((i: any) => i.key === activeKey)?.children}</div></>,
  Dropdown: ({ children }: any) => children,
  Modal: ({ open, title, children, onCancel }: any) => open ? <div role="dialog" aria-label={title}>{children}<button onClick={onCancel}>关闭预览</button></div> : null,
}));
const object = (id = 'a', name = '画家') => ({ id, name, kind: 'character', description: '一位执着的画家', prompt: '画家', folderId: 'f', versions: [], sources: [{ id: 's', title: '星夜' }], createdAt: '', updatedAt: '' });
const result = (items: any[], total = items.length, page = 0) => ({ items, total, page, hasMore: (page + 1) * 24 < total });
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); api.folders.mockResolvedValue([{ id: 'f', name: '星夜' }]); api.objects.mockResolvedValue(result([object()])); api.materials.mockResolvedValue(result([])); });

test('saved script assets lead with an honest no-image state and separate library totals', async () => {
  api.materials.mockResolvedValue(result([], 37));
  render(<PersonalAssetLibrary/>);
  expect(await screen.findByRole('article', { name: '剧本资产 画家' })).toBeDefined();
  expect(screen.getByRole('tab', { name: /剧本资产.*1/ }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByRole('tab', { name: /生成与上传.*37/ })).toBeDefined();
  expect(screen.getByText('设定已保存')).toBeDefined();
  expect(screen.getByRole('article', { name: '剧本资产 画家' }).textContent).toContain('待配图');
  expect(api.write).not.toHaveBeenCalled();
});

test('successful list loading does not clear a folder failure or mislabel a known folder id', async () => {
  api.folders.mockRejectedValue(new Error('暂不可用'));
  render(<PersonalAssetLibrary/>);
  await screen.findByRole('article', { name: '剧本资产 画家' });
  expect(screen.getByRole('alert').textContent).toContain('暂不可用');
  expect(screen.getByText('文件夹名称暂不可用')).toBeDefined();
  expect(screen.getByRole('button', { name: '重新读取文件夹' })).toBeDefined();
});

test('changing search clears selection and keeps batch actions scoped to visible results', async () => {
  api.objects.mockImplementation(async (q: any) => result(q?.query ? [object('b', '孩子')] : [object()]));
  render(<PersonalAssetLibrary/>);
  fireEvent.click(await screen.findByRole('checkbox', { name: '选择资产 画家' }));
  expect(screen.getByText('已选择 1 项')).toBeDefined();
  fireEvent.change(screen.getByRole('textbox', { name: '搜索个人资产' }), { target: { value: '孩子' } });
  await screen.findByRole('article', { name: '剧本资产 孩子' });
  expect(screen.queryByText('已选择 1 项')).toBeNull();
  expect((screen.getByRole('checkbox', { name: '选择资产 孩子' }) as HTMLInputElement).checked).toBe(false);
  expect(api.objects).toHaveBeenCalledWith(expect.objectContaining({ query: '孩子', page: 0 }));
});

test('older search requests cannot overwrite the latest visible results', async () => {
  let finishOld!: (r: any) => void;
  api.objects.mockImplementation((q: any) => q?.query === '旧' ? new Promise(resolve => { finishOld = resolve; }) : Promise.resolve(result(q?.query === '新' ? [object('new', '新资产')] : [object()])));
  render(<PersonalAssetLibrary/>);
  await screen.findByRole('article', { name: '剧本资产 画家' });
  fireEvent.change(screen.getByRole('textbox', { name: '搜索个人资产' }), { target: { value: '旧' } });
  await waitFor(() => expect(finishOld).toBeDefined());
  fireEvent.change(screen.getByRole('textbox', { name: '搜索个人资产' }), { target: { value: '新' } });
  await screen.findByRole('article', { name: '剧本资产 新资产' });
  finishOld(result([object('old', '旧资产')]));
  await waitFor(() => expect(screen.queryByRole('article', { name: '剧本资产 旧资产' })).toBeNull());
});

test('text previews retain the complete saved content and use no write API', async () => {
  const content = '原文'.repeat(800) + '完整结尾';
  api.materials.mockResolvedValue(result([{ id: 'text', title: '完整剧本', kind: 'text', data: { content }, tags: [] }]));
  render(<PersonalAssetLibrary/>);
  fireEvent.click(screen.getByRole('tab', { name: /生成与上传/ }));
  fireEvent.click(await screen.findByRole('button', { name: '预览素材 完整剧本' }));
  expect(screen.getByRole('dialog', { name: '完整剧本' }).querySelector('pre')?.textContent).toBe(content);
  expect(api.write).not.toHaveBeenCalled();
});

test('pagination requests the next server page while category totals stay global', async () => {
  api.objects.mockImplementation(async (q: any) => q?.page === 1 ? result([object('25', '第25项')], 25, 1) : result([object()], 25));
  render(<PersonalAssetLibrary/>);
  await screen.findByRole('article', { name: '剧本资产 画家' });
  fireEvent.click(screen.getByRole('button', { name: '下一页' }));
  expect(await screen.findByRole('article', { name: '剧本资产 第25项' })).toBeDefined();
  expect(screen.getByRole('tab', { name: /剧本资产.*25/ })).toBeDefined();
  expect(api.objects).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
});

beforeEach(() => { mountStudioErrorNotifications(); });
