// @vitest-environment jsdom
import { render, fireEvent, screen, cleanup, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { ApiError } from '@ai-star-eco/api-client/client';
import { StudioNotifications, StudioErrorNotice, normalizeStudioError, studioErrorText, reportStudioError } from './studio-errors';
const api = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock('antd', () => ({ notification: { useNotification: () => [api, null] }, ConfigProvider: ({children}: any) => children, Button: ({icon, children, ...props}: any) => <button {...props}>{children}</button>, App: { useApp: () => ({message: {}}) } }));
beforeEach(() => api.error.mockReset());
afterEach(cleanup);
it('keeps structured code, safe message and the real lookup ID while supporting old server suffixes', () => {
  const error = normalizeStudioError(new ApiError({code: 'PROVIDER_REJECTED', message: '图片不可用 · 追查号 ABCDEF234567', logId: 'ABCDEF234567'}, 400));
  expect(error).toEqual({code: 'PROVIDER_REJECTED', message: '图片不可用', logId: 'ABCDEF234567', taskId: undefined});
  expect(normalizeStudioError('历史失败 · 追查号 IPR-old').logId).toBeUndefined();
  expect(studioErrorText(error)).toContain('logId：ABCDEF234567');
});
it('shows persistent top-right notifications, deduplicates rerenders and enriches restored failures', async () => {
  render(<StudioNotifications/>);
  const view = render(<StudioErrorNotice error={{code: 'UPSTREAM_400', message: '图片未生成', taskId: 'r'}} once="run:r"/>);
  await waitFor(() => expect(api.error).toHaveBeenCalledTimes(1));
  view.rerender(<StudioErrorNotice error={{code: 'UPSTREAM_400', message: '图片未生成', taskId: 'r'}} once="run:r"/>);
  expect(api.error).toHaveBeenCalledTimes(1);
  view.rerender(<StudioErrorNotice error={{code: 'UPSTREAM_400', message: '图片未生成', taskId: 'r', logId: 'ABCDEF234567'}} once="run:r"/>);
  await waitFor(() => expect(api.error).toHaveBeenCalledTimes(2));
  expect(api.error.mock.lastCall![0]).toMatchObject({placement: 'topRight', duration: 0, key: 'studio-error:r'});
  fireEvent.click(screen.getByRole('button', {name: '查看错误详情'}));
  expect(api.error).toHaveBeenCalledTimes(3);
});
it('copies all diagnostic fields through the visible notification action', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {value: {writeText}, configurable: true});
  render(<StudioNotifications/>);
  reportStudioError({code: 'UPSTREAM_400', message: '聚算图片接口暂时不可用（400）', logId: 'ABCDEF234567', taskId: 'r'});
  render(api.error.mock.lastCall![0].description);
  fireEvent.click(screen.getByRole('button', {name: '复制错误详情'}));
  await waitFor(() => expect(screen.getByRole('button', {name: '已复制'})).toBeTruthy());
  expect(writeText).toHaveBeenCalledWith('错误码：UPSTREAM_400\n错误信息：聚算图片接口暂时不可用（400）\nlogId：ABCDEF234567\n任务 ID：r');
});
