// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AssetsObjects } from './assets-objects';

const api = vi.hoisted(() => ({ objects: vi.fn(), create: vi.fn(), remove: vi.fn(), confirm: vi.fn() }));
vi.mock('@/canvas-bridge/asset-library', () => ({
  libraryObjects: api.objects, createLibraryObject: api.create, deleteLibraryObject: api.remove,
  mainLibraryVersion: (a: any) => a.versions.find((v: any) => v.id === a.mainVersionId),
}));
vi.mock('@/canvas-bridge/image-storage', () => ({ refreshImageUrl: vi.fn() }));
vi.mock('./library-asset-editor', () => ({ LibraryAssetEditor: ({ assets }: any) => <p>编辑 {assets[0].name}</p> }));
vi.mock('./library-source-select', () => ({ LibrarySourceSelect: ({ value, onChange }: any) => <button onClick={() => onChange('DW-2')}>来源 {value}</button> }));
vi.mock('./studio-overlay', () => ({ studioOverlayContainer: () => document.body }));
vi.mock('./studio-errors', async () => {
  const { useCallback, useState } = await import('react');
  return {
    useStudioApp: () => ({ message: { success: vi.fn() }, modal: { confirm: api.confirm } }),
    useStudioErrorState: () => { const [e, set] = useState(''); return [e, useCallback((v: unknown) => set(v ? String((v as Error).message || v) : ''), [])]; },
    StudioErrorNotice: ({ error }: any) => <span role="alert">{String(error)}</span>,
  };
});
vi.mock('antd', () => ({
  Tooltip: ({ children }: any) => children,
  Button: ({ icon, loading, type, size, danger, ...p }: any) => <button {...p}>{icon}{p.children}</button>,
  Checkbox: ({ checked, onChange, className, ...p }: any) => <input type="checkbox" checked={checked} onChange={onChange} {...p}/>,
  Input: Object.assign(({ prefix, allowClear, autoFocus, ...p }: any) => <input {...p}/>, { TextArea: (p: any) => <textarea {...p}/> }),
  Modal: ({ open, children, onOk, okText, okButtonProps }: any) => open ? <div role="dialog">{children}<button disabled={okButtonProps?.disabled} onClick={onOk}>{okText}</button></div> : null,
}));

const scene = (id: string, name: string, origin?: string) => ({ id, name, kind: 'scene', description: '', prompt: '', mainVersionId: 'v', versions: [{ id: 'v', storageKey: 'k', url: 'https://x/k', prompt: '', createdAt: '' }], sources: origin ? [{ id: 's', title: '食神', projectId: 'DW-1', nodeId: 'a', evidence: '', description: '', origin }] : [], createdAt: '', updatedAt: '' });
const page = (items: any[]) => ({ items, total: items.length, page: 0, hasMore: false });
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); api.objects.mockResolvedValue(page([scene('o1', '祖宅', 'director')])); });

test('lists only this kind, narrowed to the source, and opens the editor', async () => {
  render(<AssetsObjects kind="scene" library="all" folders={[]} from="DW-1" onFromChange={vi.fn()}/>);
  await waitFor(() => expect(api.objects).toHaveBeenCalledWith(expect.objectContaining({ kind: 'scene', folder: 'all', projectId: 'DW-1' })));
  fireEvent.click(await screen.findByRole('button', { name: '查看 祖宅' }));
  expect(screen.getByText('编辑 祖宅')).toBeTruthy();
});

test('changing the source reports it upward', async () => {
  const onFromChange = vi.fn();
  render(<AssetsObjects kind="prop" library="all" folders={[]} from="" onFromChange={onFromChange}/>);
  fireEvent.click(await screen.findByRole('button', { name: /来源/ }));
  expect(onFromChange).toHaveBeenCalledWith('DW-2');
});

test('the AI library holds no objects and is not queried', () => {
  render(<AssetsObjects kind="scene" library="ai" folders={[]} from="" onFromChange={vi.fn()}/>);
  expect(api.objects).not.toHaveBeenCalled();
});

test('a new one is created in the current folder and opened for editing', async () => {
  api.create.mockResolvedValue(scene('o9', '钟楼'));
  render(<AssetsObjects kind="scene" library="f1" folders={[]} from="" onFromChange={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button', { name: /新建场景/ }));
  fireEvent.change(screen.getByLabelText('场景名称'), { target: { value: '钟楼' } });
  fireEvent.click(screen.getByRole('button', { name: '新建' }));
  await waitFor(() => expect(api.create).toHaveBeenCalledWith({ name: '钟楼', kind: 'scene', description: '', folderId: 'f1' }));
  expect(await screen.findByText('编辑 钟楼')).toBeTruthy();
});

test('scenes can be selected and deleted together, then the list reloads', async () => {
  api.objects.mockResolvedValue(page([scene('o1', '祖宅'), scene('o2', '码头'), scene('o3', '茶馆')]));
  api.remove.mockResolvedValue(undefined);
  api.confirm.mockImplementation((o: any) => void o.onOk());
  render(<AssetsObjects kind="scene" library="all" folders={[]} from="" onFromChange={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button', { name: '选择' }));
  expect(screen.queryByRole('button', { name: /新建场景/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '选择 祖宅' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '选择 茶馆' }));
  fireEvent.click(screen.getByRole('button', { name: '删除' }));
  expect(api.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: '删除选中的 2 个场景？' }));
  await waitFor(() => expect(api.remove.mock.calls.map(c => c[0])).toEqual(['o1', 'o3']));
  await waitFor(() => expect(api.objects).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('button', { name: '选择' })).toBeTruthy();
});
