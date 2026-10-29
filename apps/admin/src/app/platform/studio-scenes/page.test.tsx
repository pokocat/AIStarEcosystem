// @vitest-environment jsdom
// 「Studio 场景模板」页对着内存里的契约 mock：改名保存、别人先存过时不覆盖、上传封面后带着 key 保存、下架。
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { FeedbackProviders } from '@/components/feedback';

const spy = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('@/api', async () => {
  const client = await vi.importActual<typeof import('@/api/_client')>('@/api/_client');
  const m = await vi.importActual<typeof import('@/mocks/studio-scenes')>('@/mocks/studio-scenes');
  const later = <T,>(fn: () => T) => new Promise<T>((resolve, reject) => setTimeout(() => { try { resolve(fn()); } catch (e) { reject(e); } }, 0));
  return {
    ApiError: client.ApiError,
    StudioScenesApi: {
      getStudioScenes: () => later(m.mockGetStudioScenes),
      saveStudioScenes: (c: never, v: number) => { spy.save(c, v); return later(() => m.mockSaveStudioScenes(c, v)); },
      resetStudioScenes: (v: number) => later(() => m.mockResetStudioScenes(v)),
      uploadStudioSceneMedia: (f: File) => later(() => m.mockUploadStudioSceneMedia(f)),
    },
  };
});
import StudioScenesPage from './page';
import { mockSaveStudioScenes, mockGetStudioScenes, resetMockStudioScenes } from '@/mocks/studio-scenes';

beforeEach(() => { resetMockStudioScenes(); spy.save.mockClear(); URL.createObjectURL ||= () => 'blob:x'; });
afterEach(cleanup);

async function open() {
  render(<FeedbackProviders><StudioScenesPage /></FeedbackProviders>);
  await screen.findByRole('textbox', { name: '名称' });
}
const saveButton = () => screen.getByRole('button', { name: /保存|没有改动/ }) as HTMLButtonElement;

test('改名、上传封面、下架后整份保存；保存带上读到的版本号，封面只存 key', async () => {
  await open();
  expect(saveButton().disabled).toBe(true);
  fireEvent.change(screen.getByRole('textbox', { name: '名称' }), { target: { value: '口播种草' } });
  await act(async () => { fireEvent.change(screen.getByLabelText('封面文件'), { target: { files: [new File(['x'], 'c.png', { type: 'image/png' })] } }); });
  await waitFor(() => expect(screen.getByRole('img', { name: '封面' })).toBeTruthy());
  fireEvent.click(screen.getByRole('switch', { name: '上架' }));
  expect(saveButton().disabled).toBe(false);
  await act(async () => { fireEvent.click(saveButton()); });
  await waitFor(() => expect(spy.save).toHaveBeenCalledTimes(1));
  const [catalog, version] = spy.save.mock.calls[0];
  expect(version).toBe(0);
  expect(catalog.video[0]).toMatchObject({ id: 'ecom-talking', title: '口播种草', enabled: false });
  expect(catalog.video[0].coverKey).toMatch(/^ipstudio_scene\/catalog\//);
  await screen.findByText('运营改过 · 第 1 版');
  expect(screen.getByText('下架')).toBeTruthy();
});

test('别人先存过：不覆盖，说清楚并给「刷新」', async () => {
  await open();
  // 页面读到的是第 0 版，这时别人先存了一版。
  mockSaveStudioScenes(mockGetStudioScenes().catalog, 0);
  fireEvent.change(screen.getByRole('textbox', { name: '名称' }), { target: { value: '改一下' } });
  await act(async () => { fireEvent.click(saveButton()); });
  expect((await screen.findByRole('alert')).textContent).toContain('刚被别人改过');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /刷新/ })); });
  await waitFor(() => expect((screen.getByRole('textbox', { name: '名称' }) as HTMLInputElement).value).toBe('口播带货'));
});

test('新增的场景先下架，编号可以改；存过的场景编号锁住', async () => {
  await open();
  expect((screen.getByRole('textbox', { name: '编号' }) as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /新增/ }));
  const id = screen.getByRole('textbox', { name: '编号' }) as HTMLInputElement;
  expect(id.disabled).toBe(false);
  expect(id.value).toBe('video-new-1');
  expect(screen.getAllByText('下架').length).toBeGreaterThan(0);
});
