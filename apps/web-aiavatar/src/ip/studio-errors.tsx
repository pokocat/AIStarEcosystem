"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { App, Button, ConfigProvider, Modal, notification } from 'antd';
import { Copy, Check } from 'lucide-react';
import copy from 'copy-to-clipboard';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import type { IpRun } from '@ai-star-eco/types/ip-studio';
import { publicModelErrorMessage } from '@ai-star-eco/api-client';

export type StudioError = { code: string; message: string; logId?: string; taskId?: string; clientMessageId?: string };
type ErrorInput = unknown;
const remembered = new Map<string, StudioError>();
const shown = new Map<string, string>();
let sink: ((error: StudioError) => void) | undefined;
const pending = new Map<string, StudioError>();
const keyOf = (e: StudioError) => e.taskId || e.logId || e.clientMessageId || `${e.code}:${e.message}`;

/**
 * Internal method / stage refusals (不锁方法 2026-10-23, docs/ip-studio-dialogue-intents.md): never shown as such, also
 * for work records saved before the server stopped sending them ('第 1 步的操作不在当前阶段允许的范围内' was seen live).
 */
const INTERNAL_CODES = new Set(['STUDIO_SKILL_OPERATION_NOT_ALLOWED', 'STUDIO_SKILL_LOCKED']);
const INTERNAL_TEXT = /当前阶段允许的范围|当前阶段不允许|制作结束前不能换方法|按另一种方法制作/;
export const PLAN_NOT_READY_TEXT = '这份方案还没准备好，我会按你要做的内容重新整理。';
/** What a user sees for an error: internal refusals become one plain sentence and a neutral code. */
export function userFacingError(code: string | undefined, message: string | undefined): { code?: string; message?: string } {
  if ((code && INTERNAL_CODES.has(code)) || (message && INTERNAL_TEXT.test(message))) return { code: code ? 'STUDIO_PLAN_NOT_READY' : undefined, message: PLAN_NOT_READY_TEXT };
  return { code, message: message === undefined ? undefined : publicModelErrorMessage(message, code) };
}

/** Read structured errors and the older server's message suffix without inventing a log ID. */
export function normalizeStudioError(input: ErrorInput, fallback = '操作未完成，请重试'): StudioError {
  if (typeof input === 'string' && remembered.has(input)) return remembered.get(input)!;
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const raw = typeof input === 'string' ? input : typeof value.errorMessage === 'string' ? value.errorMessage : typeof value.message === 'string' ? value.message : typeof value.content === 'string' ? value.content : fallback;
  const suffix = raw.match(/\s*[·。]?\s*追查号[：:\s]+([^\s，。]+)(?:\s*[—-]+.*)?$/);
  const details = value.details && typeof value.details === 'object' ? value.details as Record<string, unknown> : {};
  const logId = typeof value.logId === 'string' ? value.logId : typeof details.logId === 'string' ? details.logId : suffix && /^[A-HJ-NP-Z2-9]{12}$/.test(suffix[1]) ? suffix[1] : undefined;
  const visible = userFacingError(typeof value.errorCode === 'string' ? value.errorCode : typeof value.code === 'string' ? value.code : undefined,
    suffix ? raw.slice(0, suffix.index).trim() || fallback : raw);
  const result = {
    code: visible.code ?? (input instanceof TypeError && /fetch|network|load failed/i.test(raw) ? 'NETWORK_ERROR' : 'CLIENT_ERROR'),
    message: visible.message ?? fallback,
    logId,
    taskId: typeof value.taskId === 'string' ? value.taskId : typeof value.runId === 'string' ? value.runId : undefined,
    ...(typeof value.clientMessageId === 'string' ? { clientMessageId: value.clientMessageId } : {}),
  };
  remembered.set(result.message, result);
  if (remembered.size > 100) remembered.delete(remembered.keys().next().value!);
  return result;
}

/** A real client message ID is useful even when no server response (and therefore no logId) arrived. */
export function messageDeliveryError(input: unknown, clientMessageId: string): StudioError {
  const original = normalizeStudioError(input);
  return { ...original, code: original.code === 'CLIENT_ERROR' ? 'MESSAGE_DELIVERY_UNCONFIRMED' : original.code,
    message: `暂时无法确认消息是否送达，原消息已保留。点「重新发送」可继续核对。原因：${original.message}`, clientMessageId };
}

export function subscribeStudioErrors(handler: (error: StudioError) => void) {
  sink = handler;
  for (const error of pending.values()) handler(error);
  pending.clear();
  return () => { if (sink === handler) { sink = undefined; shown.clear(); } };
}

export function reportStudioError(input: ErrorInput, options: { once?: string; fallback?: string } = {}) {
  const error = normalizeStudioError(input, options.fallback);
  if (error.code === "IP_RUN_CANCELLED") return error;
  // 画布的保存冲突由顶栏的冲突弹窗负责（canvas-conflict-dialog.tsx）。冲突之后每一条经过
  // saveStudioDocument 的保存都会再抛一次它 —— 助手面板的自动保存、任务轮询回写、脚本编辑器……
  // 逐条弹通知就是用户说的「页面一直在报错」。这里只回传给调用方做内联状态，不弹。
  if (error.code === "IP_PROJECT_STALE") return error;
  if (options.once) {
    const fingerprint = studioErrorText(error);
    if (shown.get(options.once) === fingerprint) return error;
    shown.set(options.once, fingerprint);
    if (shown.size > 500) shown.delete(shown.keys().next().value!);
  }
  if (sink) sink(error); else pending.set(keyOf(error), error);
  return error;
}
export const studioRunError = (run: IpRun) => {
  const failed = run.output.videoCandidates?.find(candidate => candidate.status === 'failed');
  return { code: run.errorCode || failed?.errorCode || 'STUDIO_RUN_FAILED', message: run.errorMessage || failed?.errorMessage || (run.status === 'running' ? '任务出现异常，请查看任务状态' : '生成失败，请重试'), logId: run.logId || run.output.logId || failed?.logId, taskId: failed?.jobId || run.id };
};
export const studioNodeError = (node: CanvasNodeData) => ({ code: node.metadata?.studio?.task?.errorCode || node.metadata?.errorCode || 'STUDIO_RUN_FAILED', message: node.metadata?.studio?.task?.errorMessage || node.metadata?.errorDetails || '生成失败，请查看任务', logId: node.metadata?.studio?.task?.logId || node.metadata?.errorLogId, taskId: node.metadata?.studio?.runId || node.metadata?.runId });
export function reportStudioRunFailures(run: IpRun) {
  if (run.status === 'failed' || (run.status === 'running' && (run.errorCode || run.errorMessage))) reportStudioError(studioRunError(run), {once: `run:${run.id}`});
  if (run.status === 'done') for (const candidate of run.output.videoCandidates || []) {
    if (candidate.status === 'failed') reportStudioError({code: candidate.errorCode || 'STUDIO_VIDEO_FAILED', message: candidate.errorMessage || '本条视频生成失败，其他候选仍可采用', logId: candidate.logId, taskId: candidate.jobId}, {once: `video:${candidate.jobId}`});
  }
}
export function studioErrorMetadata(input: unknown) {
  const error = normalizeStudioError(input);
  return { errorDetails: error.message, errorCode: error.code, errorLogId: error.logId };
}
export function studioErrorText(error: StudioError) {
  return `错误码：${error.code}\n错误信息：${error.message}\nlogId：${error.logId || '未记录'}${error.taskId ? `\n任务 ID：${error.taskId}` : ''}${error.clientMessageId ? `\n消息编号：${error.clientMessageId}` : ''}`;
}

function ErrorDetails({ error }: { error: StudioError }) {
  const [copied, setCopied] = useState(false), [copyFailed, setCopyFailed] = useState(false);
  const copyDetails = async () => {
    const text = studioErrorText(error);
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch { ok = await copy(text); }
    setCopied(ok); setCopyFailed(!ok);
  };
  return <div className="studio-error-details">
    <dl><dt>错误码</dt><dd>{error.code}</dd><dt>错误信息</dt><dd>{error.message}</dd>{(error.logId || !error.clientMessageId) && <><dt>logId</dt><dd>{error.logId || '未记录'}{!error.logId && <small>此错误未提供追查号</small>}</dd></>}{error.clientMessageId && <><dt>消息编号</dt><dd>{error.clientMessageId}</dd></>}{error.taskId && <><dt>任务 ID</dt><dd>{error.taskId}</dd></>}</dl>
    <Button icon={copied ? <Check size={15}/> : <Copy size={15}/>} onClick={() => void copyDetails()}>{copied ? '已复制' : '复制错误详情'}</Button>
    {copyFailed && <p role="status">复制未完成，请选中上方文字复制。</p>}
  </div>;
}

/**
 * 用户点了某个操作、它没做成（被业务规则挡下、冲突、前置条件不够、请求失败）：用弹窗说清楚，不只在页面远处挂一条横幅。
 * 2026-10-27 用户反馈「该资产仍被片段使用，请先取消关联 —— 只是页面上有个 banner，应该是个错误弹窗」；
 * 手机上资产详情是全屏抽屉，横幅被整个挡住，点了删除什么都看不到。
 * 已经打开的操作弹窗里的失败仍在弹窗里就地显示；后台任务的失败、页面上的持续状态照旧，不走这里。
 */
export type StudioFailure = {
  /** 哪个操作没做成，如「删除「林夏」」，标题写成「删除「林夏」没有完成」。 */
  action: string;
  error: unknown;
  /** 下一步怎么做；不给就按错误码给一句通用的。 */
  next?: ReactNode;
  /** 原因下面的补充内容（只放真实数据，如引用它的片段和前往入口）；拿到 close 可以先关弹窗再跳转。 */
  extra?: ReactNode | ((close: () => void) => ReactNode);
};

/** 冲突类错误：调用方会把页面刷新到最新（导演台工作台这样做），这句总排在下一步的最前面。 */
const isConflict = (code: string) => /_CONFLICT$|_STALE$|_EXPIRED$/.test(code);
const CONFLICT_NEXT = '这项内容刚在别处改过，页面已经刷新到最新内容，不用再手动刷新。';

/** 按错误码给的通用下一步。调用方知道得更具体时自己写 next。 */
export function failureNext(code: string): string {
  if (isConflict(code)) return `${CONFLICT_NEXT}看一下现在的内容，需要的话重新修改后再试。`;
  if (code === 'STUDIO_PRICE_CHANGED') return '价格有变化，刷新页面后重新确认。';
  if (/_RUNNING$/.test(code)) return '等正在进行的那一项完成后再试。';
  if (code === 'NETWORK_ERROR') return '检查网络后刷新页面，看一下这次操作有没有生效，再决定要不要重试。';
  if (/CREDIT|BALANCE|INSUFFICIENT/.test(code)) return '积分不够，充值后再试。';
  return '可以稍后再试一次；反复出现的话，展开「错误详情」复制后发给我们。';
}

type ModalApi = Pick<typeof Modal, 'error'>;
const openFailures = new Set<string>();

/** 打开错误弹窗。同一个操作的同一个错误还开着时不再弹第二个（连点、轮询重复报错）。 */
export function openStudioFailure(modal: ModalApi, failure: StudioFailure) {
  const error = normalizeStudioError(failure.error);
  if (error.code === 'IP_RUN_CANCELLED') return error;
  const key = `${failure.action}|${error.code}|${error.message}`;
  if (openFailures.has(key)) return error;
  openFailures.add(key);
  let instance: { destroy: () => void } | undefined;
  const close = () => instance?.destroy();
  const extra = typeof failure.extra === 'function' ? failure.extra(close) : failure.extra;
  instance = modal.error({
    title: `${failure.action}${/[0-9A-Za-z]$/.test(failure.action) ? ' ' : ''}没有完成`,
    content: <div className="studio-failure">
      <section><h4>原因</h4><p>{error.code === 'NETWORK_ERROR' ? '网络连接中断，没收到服务器的回应。' : error.message}</p></section>
      {extra}
      <section><h4>下一步</h4><div>{failure.next === undefined ? failureNext(error.code) : isConflict(error.code) ? <><p>{CONFLICT_NEXT}</p>{failure.next}</> : failure.next}</div></section>
      <details className="studio-failure-details"><summary>错误详情</summary><ErrorDetails error={error}/></details>
    </div>,
    okText: '知道了', closable: true, mask: { closable: true }, width: 480, className: 'studio-failure-dialog',
    afterClose: () => { openFailures.delete(key); },
  });
  return error;
}

/** 组件里用：在 antd <App> 里走它的 modal（跟随主题），外面没有 <App> 时用静态 Modal。 */
export function useStudioFailure() {
  const { modal } = App.useApp();
  return useCallback((failure: StudioFailure) => openStudioFailure(typeof modal.error === 'function' ? modal : Modal, failure), [modal]);
}

/** One unscaled, global notification layer also serves errors outside an Ant Design App. */
export function StudioNotifications() {
  const [api, holder] = notification.useNotification({ placement: 'topRight', top: 64, stack: false });
  useEffect(() => {
    const show = (error: StudioError) => api.error({ key: `studio-error:${keyOf(error)}`, title: '操作未完成', description: <ErrorDetails key={studioErrorText(error)} error={error}/>, duration: 10, showProgress: true, pauseOnHover: true, placement: 'topRight', className: 'studio-error-notification', role: 'alert' });
    return subscribeStudioErrors(show);
  }, [api]);
  return <ConfigProvider theme={{ components: { Notification: { width: 'min(440px, calc(100vw - 48px))' } }, token: { colorPrimary: '#192229', borderRadius: 13, fontFamily: 'var(--ip-font-sans, sans-serif)' } }}>{holder}</ConfigProvider>;
}

/** Preserve success feedback; every action error goes to the shared notification layer. */
export function useStudioApp() {
  const app = App.useApp();
  return useMemo(() => ({ ...app, message: { ...app.message, error: (error: ErrorInput) => { reportStudioError(error); } } }), [app.message, app.modal, app.notification]);
}

/** Keep retry state locally while reporting the original exception, including its code and logId. */
export function useStudioErrorState(initial = ''): [string, (value: unknown | ((previous: string) => string)) => void] {
  const [error, setError] = useState(initial);
  const current = useRef(initial);
  const update = useCallback((value: unknown | ((previous: string) => string)) => {
    const next = typeof value === 'function' ? value(current.current) : value;
    current.current = next ? reportStudioError(next).message : '';
    setError(current.current);
  }, []);
  return [error, update];
}

/** Historical failures keep a details button; only live failures should open a notification on mount. */
export function StudioErrorNotice({ error, once, label = '查看错误详情', autoReport = true }: { error: ErrorInput; once?: string; label?: string; autoReport?: boolean }) {
  const normalized = normalizeStudioError(error);
  const identity = once || keyOf(normalized);
  useEffect(() => { if (error && autoReport) reportStudioError(error, { once: identity }); }, [autoReport, identity, error && normalized.code, error && normalized.message, error && normalized.logId]);
  if (!error) return null;
  if (normalized.code === "IP_RUN_CANCELLED") return <span role="status">已停止</span>;
  return <button type="button" className="studio-error-link nodrag nopan" onClick={event => { event.stopPropagation(); reportStudioError(error); }}>{label}</button>;
}
