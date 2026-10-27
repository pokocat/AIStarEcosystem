// @vitest-environment jsdom
import { render, fireEvent, screen, cleanup, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { ApiError } from '@ai-star-eco/api-client/client';
import { StudioNotifications, StudioErrorNotice, messageDeliveryError, normalizeStudioError, studioErrorText, reportStudioError, reportStudioRunFailures, studioRunError, forgetStudioActivation } from './studio-errors';
const api = vi.hoisted(() => ({ error: vi.fn() }));
// 错误弹窗：记下每次打开的配置；destroy 时照 antd 调 afterClose（释放「同一个错误不弹第二个」）。
const modal = vi.hoisted(() => {
  const open: Array<{ afterClose?: () => void }> = [];
  return { open, error: vi.fn((config: { afterClose?: () => void }) => { open.push(config); return { destroy: () => config.afterClose?.() }; }) };
});
vi.mock('antd', () => ({ notification: { useNotification: () => [api, null] }, Modal: Object.assign(() => null, { useModal: () => [modal, null], error: modal.error }), ConfigProvider: ({children}: any) => children, Button: ({icon, children, ...props}: any) => <button {...props}>{children}</button>, App: { useApp: () => ({message: {}}) } }));
beforeEach(() => { api.error.mockReset(); modal.error.mockClear(); forgetStudioActivation(); });
afterEach(() => { cleanup(); for (const config of modal.open.splice(0)) config.afterClose?.(); });
const titles = () => modal.error.mock.calls.map(([config]) => (config as { title: string }).title);
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
  // 「查看错误详情」打开详情弹窗，不再挂一条提示，也不算一次失败的操作
  fireEvent.click(screen.getByRole('button', {name: '查看错误详情'}));
  expect(api.error).toHaveBeenCalledTimes(2);
  expect(titles()).toEqual(['错误详情']);
});
it('keeps restored task failures inspectable without replaying notifications after refresh', async () => {
  render(<StudioNotifications/>);
  const oldFailure = {code: 'INTERNAL_ERROR', message: '服务器处理请求失败，请稍后重试', taskId: 'old-run', logId: 'UP8XZNEU59WP'};
  render(<StudioErrorNotice error={oldFailure} once="run:old-run" autoReport={false}/>);
  expect(api.error).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: '查看错误详情'}));
  expect(titles()).toEqual(['错误详情']);
  expect(api.error).not.toHaveBeenCalled();
  // 轮询得知的任务失败是后台状态：右上角提示，刚才点了按钮也不弹窗
  fireEvent.click(document.body.appendChild(Object.assign(document.createElement('button'), {textContent: '生成'})));
  reportStudioRunFailures({id: 'new-run', status: 'failed', errorCode: 'INTERNAL_ERROR', errorMessage: '新任务失败', output: {}} as any);
  await waitFor(() => expect(api.error).toHaveBeenCalledTimes(1));
  expect(titles()).toEqual(['错误详情']);
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

it('delivery errors preserve genuine diagnostics and expose a real message ID when no server log exists', () => {
  const network=messageDeliveryError(new TypeError('Failed to fetch'),'message-123');
  expect(network).toMatchObject({code:'NETWORK_ERROR',clientMessageId:'message-123'});
  expect(network.logId).toBeUndefined();
  render(<StudioNotifications/>);reportStudioError(network);render(api.error.mock.lastCall![0].description);
  expect(screen.getByText('消息编号')).toBeTruthy();expect(screen.getByText('message-123')).toBeTruthy();
  expect(screen.queryByText('此错误未提供追查号')).toBeNull();
  expect(studioErrorText(network)).toContain('消息编号：message-123');
  expect(messageDeliveryError(new ApiError({code:'INTERNAL_ERROR',message:'失败',logId:'ABCDEF234567'},500),'message-456'))
    .toMatchObject({code:'INTERNAL_ERROR',logId:'ABCDEF234567',clientMessageId:'message-456'});
});

// ── 2026-10-27：用户刚做的操作没做成 → 错误弹窗；后台失败 → 右上角提示 ─────────
const button = (text: string, attrs: Record<string, string> = {}, parent: HTMLElement = document.body) => {
  const el = document.createElement('button');
  el.textContent = text;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  parent.appendChild(el);
  return el;
};

it('an error right after the user clicks an action opens a dialog named after that action, not a notification', async () => {
  render(<StudioNotifications/>);
  fireEvent.click(button('删除画布'));
  reportStudioError({code: 'IP_PROJECT_IN_USE', message: '画布还在生成中，不能删除'});
  await waitFor(() => expect(titles()).toEqual(['「删除画布」没有完成']));
  expect(api.error).not.toHaveBeenCalled();
  const content = render(modal.error.mock.lastCall![0].content as any);
  expect(content.getAllByText('画布还在生成中，不能删除').length).toBeGreaterThan(0);
  expect(content.getByText('下一步')).toBeTruthy();
  expect(content.getByText('错误详情')).toBeTruthy();
});

it('a generic confirm button takes the dialog title; antd spacing inside two-character labels is removed', () => {
  render(<StudioNotifications/>);
  const dialog = Object.assign(document.createElement('div'), {}); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-label', '删除这个画布？');
  document.body.appendChild(dialog);
  fireEvent.click(button('确 定', {}, dialog));
  dialog.remove(); // 确认框点完就关了
  reportStudioError({code: 'NETWORK_ERROR', message: 'Failed to fetch'});
  fireEvent.click(button('删 除'));
  reportStudioError({code: 'X_FAILED', message: '另一个失败'});
  return waitFor(() => expect(titles().sort()).toEqual(['「删除」没有完成', '删除这个画布没有完成'].sort()));
});

it('one click accounts for one error; later errors, background reports and other pages go to notifications', async () => {
  render(<StudioNotifications/>);
  fireEvent.click(button('保存'));
  reportStudioError({code: 'A', message: '第一个'});
  reportStudioError({code: 'B', message: '第二个'});
  await waitFor(() => expect(titles()).toEqual(['「保存」没有完成']));
  expect(api.error).toHaveBeenCalledTimes(1);
  fireEvent.click(button('上传'));
  reportStudioError({code: 'C', message: '自动保存失败'}, {background: true});
  reportStudioError({code: 'D', message: '图片未能加载'}, {once: 'media:x'});
  expect(api.error).toHaveBeenCalledTimes(3);
  // 后台失败不占用这次点击：接下来的上传失败仍算「上传」的
  reportStudioError({code: 'U', message: '文件太大'});
  // 菜单 / 面板开关（aria-expanded）不算操作；换了页面不算
  fireEvent.click(button('⋯', {'aria-expanded': 'false'}));
  reportStudioError({code: 'E', message: '读取失败'});
  fireEvent.click(button('打开'));
  window.history.pushState({}, '', '/projects/other');
  reportStudioError({code: 'F', message: '这个项目打不开'});
  await waitFor(() => expect(titles()).toEqual(['「保存」没有完成', '「上传」没有完成']));
  expect(api.error).toHaveBeenCalledTimes(5);
  window.history.pushState({}, '', '/');
});

it('an explicit action name wins, and the same error is not shown twice while its dialog is open', async () => {
  render(<StudioNotifications/>);
  reportStudioError({code: 'G', message: '同一个'}, {action: '复制画布链接'});
  reportStudioError({code: 'G', message: '同一个'}, {action: '复制画布链接'});
  reportStudioError({code: 'G', message: '同一个'});
  await waitFor(() => expect(titles()).toEqual(['复制画布链接没有完成']));
  await new Promise(resolve => setTimeout(resolve, 200));
  expect(titles()).toEqual(['复制画布链接没有完成']);
  expect(api.error).not.toHaveBeenCalled();
});

it('an error the open dialog already shows stays in that dialog: no second dialog and no notification', async () => {
  render(<StudioNotifications/>);
  const dialog = document.createElement('div'); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-label', '新建文件夹');
  document.body.appendChild(dialog);
  fireEvent.click(button('创建', {}, dialog));
  reportStudioError({code: 'FOLDER_EXISTS', message: '已经有同名文件夹'});
  dialog.appendChild(Object.assign(document.createElement('p'), {textContent: '已经有同名文件夹'}));
  render(<StudioErrorNotice error={{code: 'FOLDER_EXISTS', message: '已经有同名文件夹'}}/>);
  await new Promise(resolve => setTimeout(resolve, 200));
  expect(modal.error).not.toHaveBeenCalled();
  expect(api.error).not.toHaveBeenCalled();
  // 弹窗里没写出来的错误照样弹出来
  fireEvent.click(button('创建', {}, dialog));
  reportStudioError({code: 'NETWORK_ERROR', message: '网络断了'});
  await waitFor(() => expect(titles()).toEqual(['「创建」没有完成']));
  dialog.remove();
});

it('a dialog opened by the click shows its own load failure: no error dialog on top of it, closed dialogs do not count', async () => {
  render(<StudioNotifications/>);
  fireEvent.click(button('生成'));
  const quote = document.createElement('div'); quote.setAttribute('role', 'dialog'); document.body.appendChild(quote);
  reportStudioError({code: 'STUDIO_QUOTE_FAILED', message: '报价服务暂时不可用'});
  quote.appendChild(Object.assign(document.createElement('p'), {textContent: '无法取得报价：报价服务暂时不可用'}));
  await new Promise(resolve => setTimeout(resolve, 200));
  expect(modal.error).not.toHaveBeenCalled();
  // 关掉（display:none 留在 DOM 里）的弹窗里的旧错误不算就地显示
  quote.style.display = 'none';
  fireEvent.click(button('生成'));
  reportStudioError({code: 'STUDIO_QUOTE_FAILED', message: '报价服务暂时不可用'});
  await waitFor(() => expect(titles()).toEqual(['「生成」没有完成']));
  quote.remove();
});

it('a live StudioErrorNotice right after an action is that action\'s dialog; validation notices stay notifications', async () => {
  render(<StudioNotifications/>);
  fireEvent.click(button('存为个人副本'));
  render(<StudioErrorNotice error={{code: 'TEMPLATE_GONE', message: '模板已下架'}}/>);
  await waitFor(() => expect(titles()).toEqual(['「存为个人副本」没有完成']));
  fireEvent.click(button('添加参考'));
  render(<StudioErrorNotice error="提示词最多 2000 字，请缩短内容。" background/>);
  await waitFor(() => expect(api.error).toHaveBeenCalledTimes(1));
  expect(titles()).toEqual(['「存为个人副本」没有完成']);
});
