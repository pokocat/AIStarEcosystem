// @vitest-environment jsdom
import { render, fireEvent, screen, cleanup, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { ApiError } from '@ai-star-eco/api-client/client';
import { StudioNotifications, StudioErrorNotice, normalizeStudioError, studioErrorText, reportStudioError, reportStudioRunFailures, studioRunError } from './studio-errors';
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
it('shows countdown notifications, deduplicates rerenders and enriches live failures', async () => {
  render(<StudioNotifications/>);
  const view = render(<StudioErrorNotice error={{code: 'UPSTREAM_400', message: '图片未生成', taskId: 'r'}} once="run:r"/>);
  await waitFor(() => expect(api.error).toHaveBeenCalledTimes(1));
  view.rerender(<StudioErrorNotice error={{code: 'UPSTREAM_400', message: '图片未生成', taskId: 'r'}} once="run:r"/>);
  expect(api.error).toHaveBeenCalledTimes(1);
  view.rerender(<StudioErrorNotice error={{code: 'UPSTREAM_400', message: '图片未生成', taskId: 'r', logId: 'ABCDEF234567'}} once="run:r"/>);
  await waitFor(() => expect(api.error).toHaveBeenCalledTimes(2));
  expect(api.error.mock.lastCall![0]).toMatchObject({placement: 'topRight', duration: 10, showProgress: true, pauseOnHover: true, key: 'studio-error:r'});
  fireEvent.click(screen.getByRole('button', {name: '查看错误详情'}));
  expect(api.error).toHaveBeenCalledTimes(3);
});
it('keeps restored task failures inspectable without replaying notifications after refresh', async () => {
  render(<StudioNotifications/>);
  const oldFailure = {code: 'INTERNAL_ERROR', message: '服务器处理请求失败，请稍后重试', taskId: 'old-run', logId: 'UP8XZNEU59WP'};
  render(<StudioErrorNotice error={oldFailure} once="run:old-run" autoReport={false}/>);
  expect(api.error).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: '查看错误详情'}));
  expect(api.error).toHaveBeenCalledTimes(1);
  expect(api.error.mock.lastCall![0].key).toBe('studio-error:old-run');
  reportStudioRunFailures({id: 'new-run', status: 'failed', errorCode: 'INTERNAL_ERROR', errorMessage: '新任务失败', output: {}} as any);
  await waitFor(() => expect(api.error).toHaveBeenCalledTimes(2));
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
it('does not toast canvas save conflicts: the conflict dialog owns them, and every save after a conflict would repeat it', async () => {
  render(<StudioNotifications/>);
  reportStudioError(Object.assign(new Error('这张画布在别处被改过了'), { code: 'IP_PROJECT_STALE' }));
  reportStudioError({ code: 'IP_PROJECT_STALE', message: '这张画布已经有一份更新的内容了' });
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(api.error).not.toHaveBeenCalled();
  // 内联状态仍拿得到原文
  expect(reportStudioError({ code: 'IP_PROJECT_STALE', message: '原文' }).message).toBe('原文');
});

it('reports any live task error before a terminal failure and preserves partial candidate diagnostics', () => {
  render(<StudioNotifications/>);
  for (const code of ['VIDEO_SUBMISSION_UNKNOWN','STUDIO_SPEECH_RECOVERING','UNEXPECTED_MODEL_ERROR']) {
    const run={id:code,status:'running',errorCode:code,errorMessage:'HTTP 503 · 追查号 ABCDEF234567',output:{}} as any;
    reportStudioRunFailures(run);reportStudioRunFailures(run);
  }
  expect(api.error).toHaveBeenCalledTimes(3);
  expect(normalizeStudioError(studioRunError({id:'batch',status:'done',output:{videoCandidates:[{jobId:'failed-one',status:'failed',errorCode:'UPSTREAM_400',errorMessage:'参考图不可用',logId:'ABCDEF234567'}]}} as any)))
    .toMatchObject({code:'UPSTREAM_400',message:'参考图不可用',taskId:'failed-one',logId:'ABCDEF234567'});
});
