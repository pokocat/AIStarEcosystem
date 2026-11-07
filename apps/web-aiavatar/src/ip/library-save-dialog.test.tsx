// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { LibrarySaveDialog, suggestFromTitle } from './library-save-dialog';

const api = vi.hoisted(() => ({ save: vi.fn(), objects: vi.fn(), success: vi.fn() }));
vi.mock('@/canvas-bridge/asset-library', () => ({
  saveLibraryMedia: api.save, libraryObjects: api.objects,
  mainLibraryVersion: (a: any) => a.versions.find((v: any) => v.id === a.mainVersionId),
}));
vi.mock('./asset-thumb', () => ({ AssetThumb: ({ storageKey }: any) => <span data-testid="thumb">{storageKey}</span> }));
vi.mock('./studio-overlay', () => ({ studioOverlayContainer: () => document.body }));
vi.mock('./studio-errors', async () => {
  const { useCallback, useState } = await import('react');
  return {
    useStudioApp: () => ({ message: { success: api.success } }),
    useStudioErrorState: () => { const [e, set] = useState(''); return [e, useCallback((v: unknown) => set(v ? String((v as Error).message || v) : ''), [])]; },
    StudioErrorNotice: ({ error }: any) => <span role="alert">{String(error)}</span>,
  };
});
vi.mock('antd', () => ({
  Input: ({ prefix, allowClear, onPressEnter, autoFocus, ...p }: any) => <input {...p}/>,
  Skeleton: () => <p>加载中</p>,
  Radio: { Group: ({ options, onChange, value, optionType, ...p }: any) => <div role="radiogroup" {...p}>{options.map((o: any) => <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange({ target: { value: o.value } })}>{o.label}</button>)}</div> },
  Modal: ({ open, children, onOk, okText, okButtonProps }: any) => open ? <div role="dialog">{children}<button disabled={okButtonProps?.disabled} onClick={onOk}>{okText}</button></div> : null,
}));

const image = { storageKey: 'ipstudio_gen/u/a.png', title: '门头', projectId: 'IPP-1', nodeId: 'n1' };
const card = (id: string, name: string) => ({ id, name, kind: 'character', description: '', prompt: '', versions: [], sources: [{ id: 's', title: '食神', projectId: 'DW-1', nodeId: 'as1', evidence: '', description: '', origin: 'director' }], createdAt: '', updatedAt: '' });
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); api.save.mockResolvedValue(card('o1', '门头')); api.objects.mockResolvedValue({ items: [card('o2', '林远')], total: 1, page: 0, hasMore: false }); });
const save = () => screen.getByRole('button', { name: '保存' }) as HTMLButtonElement;

test('saves as a new card of the chosen kind and keeps which canvas it came from', async () => {
  const onSaved = vi.fn(), onClose = vi.fn();
  render(<LibrarySaveDialog image={image} onClose={onClose} onSaved={onSaved}/>);
  // 弹窗里要看得到正在存的是哪张图。
  expect(screen.getByTestId('thumb').textContent).toBe(image.storageKey);
  fireEvent.click(screen.getByRole('button', { name: '场景' }));
  fireEvent.click(save());
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ storageKey: image.storageKey, kind: 'scene', name: '门头', projectId: 'IPP-1', nodeId: 'n1' }));
  expect(api.save.mock.calls[0][0].objectId).toBeUndefined();
  expect(onClose).toHaveBeenCalled();
});

test('the title suggests the kind and name; default names and summaries are not offered', () => {
  expect(suggestFromTitle('祖宅 · 场景图 2')).toEqual({ kind: 'scene', name: '祖宅' });
  expect(suggestFromTitle('林远 · 角色图')).toEqual({ kind: 'character', name: '林远' });
  expect(suggestFromTitle('铜钥匙 · 道具图')).toEqual({ kind: 'prop', name: '铜钥匙' });
  expect(suggestFromTitle('门头海报')).toEqual({ kind: 'character', name: '门头海报' });
  for (const title of ['图片', '图片 · 2', '图片 · 裁剪', '视频片段', '一只橘猫坐在窗台上…', undefined]) expect(suggestFromTitle(title).name).toBe('');
  render(<LibrarySaveDialog image={{ ...image, title: '图片 · 2' }} onClose={vi.fn()}/>);
  expect(save().disabled).toBe(true);
});

test('adds to an existing card of the chosen kind', async () => {
  render(<LibrarySaveDialog image={image} onClose={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button', { name: /加到已有/ }));
  await waitFor(() => expect(api.objects).toHaveBeenCalledWith(expect.objectContaining({ kind: 'character' })));
  expect(save().disabled).toBe(true);
  fireEvent.click(await screen.findByRole('button', { name: /林远/ }));
  fireEvent.click(save());
  await waitFor(() => expect(api.save).toHaveBeenCalled());
  expect(api.save.mock.calls[0][0]).toMatchObject({ objectId: 'o2', storageKey: image.storageKey });
  expect(api.save.mock.calls[0][0].name).toBeUndefined();
});

test('a retry after a failure reuses the same request id, so it cannot create two cards', async () => {
  api.save.mockRejectedValueOnce(new Error('网络错误'));
  render(<LibrarySaveDialog image={image} onClose={vi.fn()}/>);
  fireEvent.click(save());
  expect(await screen.findByRole('alert')).toBeTruthy();
  fireEvent.click(save());
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(2));
  expect(api.save.mock.calls[1][0].clientRequestId).toBe(api.save.mock.calls[0][0].clientRequestId);
});
