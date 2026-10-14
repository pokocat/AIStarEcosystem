"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, ConfigProvider, notification } from 'antd';
import { Copy, Check } from 'lucide-react';
import copy from 'copy-to-clipboard';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import type { IpRun } from '@ai-star-eco/types/ip-studio';

export type StudioError = { code: string; message: string; logId?: string; taskId?: string };
type ErrorInput = unknown;
const remembered = new Map<string, StudioError>();
const shown = new Map<string, string>();
let sink: ((error: StudioError) => void) | undefined;
const pending = new Map<string, StudioError>();
const keyOf = (e: StudioError) => e.taskId || e.logId || `${e.code}:${e.message}`;

/** Read structured errors and the older server's message suffix without inventing a log ID. */
export function normalizeStudioError(input: ErrorInput, fallback = '操作未完成，请重试'): StudioError {
  if (typeof input === 'string' && remembered.has(input)) return remembered.get(input)!;
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const raw = typeof input === 'string' ? input : typeof value.errorMessage === 'string' ? value.errorMessage : typeof value.message === 'string' ? value.message : typeof value.content === 'string' ? value.content : fallback;
  const suffix = raw.match(/\s*[·。]?\s*追查号[：:\s]+([^\s，。]+)(?:\s*[—-]+.*)?$/);
  const details = value.details && typeof value.details === 'object' ? value.details as Record<string, unknown> : {};
  const logId = typeof value.logId === 'string' ? value.logId : typeof details.logId === 'string' ? details.logId : suffix && /^[A-HJ-NP-Z2-9]{12}$/.test(suffix[1]) ? suffix[1] : undefined;
  const result = {
    code: typeof value.errorCode === 'string' ? value.errorCode : typeof value.code === 'string' ? value.code : input instanceof TypeError && /fetch|network|load failed/i.test(raw) ? 'NETWORK_ERROR' : 'CLIENT_ERROR',
    message: suffix ? raw.slice(0, suffix.index).trim() || fallback : raw,
    logId,
    taskId: typeof value.taskId === 'string' ? value.taskId : typeof value.runId === 'string' ? value.runId : undefined,
  };
  remembered.set(result.message, result);
  if (remembered.size > 100) remembered.delete(remembered.keys().next().value!);
  return result;
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
  if (options.once) {
    const fingerprint = studioErrorText(error);
    if (shown.get(options.once) === fingerprint) return error;
    shown.set(options.once, fingerprint);
    if (shown.size > 500) shown.delete(shown.keys().next().value!);
  }
  if (sink) sink(error); else pending.set(keyOf(error), error);
  return error;
}
export const studioRunError = (run: IpRun) => ({ code: run.errorCode || 'STUDIO_RUN_FAILED', message: run.errorMessage || '生成失败，请重试', logId: run.logId || run.output.logId, taskId: run.id });
export const studioNodeError = (node: CanvasNodeData) => ({ code: node.metadata?.studio?.task?.errorCode || node.metadata?.errorCode || 'STUDIO_RUN_FAILED', message: node.metadata?.studio?.task?.errorMessage || node.metadata?.errorDetails || '生成失败，请查看任务', logId: node.metadata?.studio?.task?.logId || node.metadata?.errorLogId, taskId: node.metadata?.studio?.runId || node.metadata?.runId });
export function reportStudioRunFailures(run: IpRun) {
  if (run.status === 'failed') reportStudioError(studioRunError(run), {once: `run:${run.id}`});
  if (run.status === 'done') for (const candidate of run.output.videoCandidates || []) {
    if (candidate.status === 'failed') reportStudioError({code: candidate.errorCode || 'STUDIO_VIDEO_FAILED', message: candidate.errorMessage || '本条视频生成失败，其他候选仍可采用', logId: candidate.logId, taskId: candidate.jobId}, {once: `video:${candidate.jobId}`});
  }
}
export function studioErrorMetadata(input: unknown) {
  const error = normalizeStudioError(input);
  return { errorDetails: error.message, errorCode: error.code, errorLogId: error.logId };
}
export function studioErrorText(error: StudioError) {
  return `错误码：${error.code}\n错误信息：${error.message}\nlogId：${error.logId || '未记录'}${error.taskId ? `\n任务 ID：${error.taskId}` : ''}`;
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
    <dl><dt>错误码</dt><dd>{error.code}</dd><dt>错误信息</dt><dd>{error.message}</dd><dt>logId</dt><dd>{error.logId || '未记录'}{!error.logId && <small>此错误未提供追查号</small>}</dd>{error.taskId && <><dt>任务 ID</dt><dd>{error.taskId}</dd></>}</dl>
    <Button icon={copied ? <Check size={15}/> : <Copy size={15}/>} onClick={() => void copyDetails()}>{copied ? '已复制' : '复制错误详情'}</Button>
    {copyFailed && <p role="status">复制未完成，请选中上方文字复制。</p>}
  </div>;
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
