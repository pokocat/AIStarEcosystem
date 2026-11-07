// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AssetsObjects } from './assets-objects';

const api = vi.hoisted(() => ({ objects: vi.fn(), create: vi.fn() }));
vi.mock('@/canvas-bridge/asset-library', () => ({
  libraryObjects: api.objects, createLibraryObject: api.create,
  mainLibraryVersion: (a: any) => a.versions.find((v: any) => v.id === a.mainVersionId),
}));
vi.mock('@/canvas-bridge/image-storage', () => ({ refreshImageUrl: vi.fn() }));
vi.mock('./library-asset-editor', () => ({ LibraryAssetEditor: ({ assets }: any) => <p>编辑 {assets[0].name}</p> }));
vi.mock('./library-source-select', () => ({ LibrarySourceSelect: ({ value, onChange }: any) => <button onClick={() => onChange('DW-2')}>来源 {value}</button> }));
vi.mock('./studio-overlay', () => ({ studioOverlayContainer: () => document.body }));
vi.mock('./studio-errors', async () => {
  const { useCallback, useState } = await import('react');
  return {
    useStudioErrorState: () => { const [e, set] = useState(''); return [e, useCallback((v: unknown) => set(v ? String((v as Error).message || v) : ''), [])]; },
    StudioErrorNotice: ({ error }: any) => <span role="alert">{String(error)}</span>,
  };
});
vi.mock('antd', () => ({
  Button: ({ icon, loading, type, size, ...p }: any) => <button {...p}>{icon}{p.children}</button>,
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
