"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { App, Button, ConfigProvider, Modal, notification } from 'antd';
import { Copy, Check } from 'lucide-react';
import copy from 'copy-to-clipboard';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import type { IpRun } from '@ai-star-eco/types/ip-studio';
// 子路径引入：错误整理是纯函数，不跟着包根走（测试常把包根整个 mock 掉，少了这个导出就会在报错时再抛一次，错误永远显示不出来）。
import { publicModelErrorMessage } from '@ai-star-eco/api-client/public-model-error';

export type StudioError = { code: string; message: string; logId?: string; taskId?: string; clientMessageId?: string };
type ErrorInput = unknown;
const remembered = new Map<string, StudioError>();
const shown = new Map<string, string>();
/** 报到统一出口的错误怎么呈现：用户刚点的操作没做成 → 错误弹窗；后台、加载、媒体失败 → 右上角提示；「查看错误详情」→ 详情弹窗。 */
export type StudioErrorMeta = { kind: 'action' | 'background' | 'details'; action?: string; next?: ReactNode };
let sink: ((error: StudioError, meta: StudioErrorMeta) => void) | undefined;
const pending = new Map<string, { error: StudioError; meta: StudioErrorMeta }>();
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

export function subscribeStudioErrors(handler: (error: StudioError, meta: StudioErrorMeta) => void) {
  sink = handler;
  installActivationTracking();
  for (const { error, meta } of pending.values()) handler(error, meta);
  pending.clear();
  return () => { if (sink === handler) { sink = undefined; shown.clear(); } };
}

// ── 用户刚做了什么 ─────────────────────────────────────────────────────────
// 2026-10-27 用户要求：主动操作失败、业务冲突、操作被挡下都要弹窗写明是哪个操作，不能只在右上角或页面远处提示。
// 全站约 300 处报错都经 reportStudioError；与其逐处传操作名，这里记下用户最近一次按下的按钮 / 菜单项 / 提交，
// 之后报上来的第一个错误就按「那个操作没做成」弹窗，标题用控件上的字。没有这样的操作（页面加载、轮询、自动保存、
// 换了页面、已经有一个错误算到它头上了）的错误不弹窗，照旧右上角提示，后台状态不会因轮询反复弹窗。
// 知道更准的操作名的地方直接传 action；后台失败传 background。
type Activation = { action: string; at: number; path: string };
let lastActivation: Activation | undefined;
let trackingInstalled = false;
/** 点完按钮后多久内报上来的错误算这个操作的（上传、生成要等服务端回来，留够时间）。 */
export const STUDIO_ACTION_WINDOW_MS = 60_000;
// 只算「做事」的控件。下拉选项、开关、勾选框是选择，不是操作；带 aria-expanded / aria-haspopup 的只是打开菜单或面板，真正的操作在里面。
const ACTIONABLE = 'button, [role="button"], [role="menuitem"], input[type="submit"], input[type="button"]';
const IGNORED = '.studio-error-link, .studio-failure-dialog, .studio-error-notification, .ant-modal-close, .ant-notification, [aria-expanded], [aria-haspopup]';
/** 这些字说明不了做的是什么（确认框的按钮），换成弹窗的标题。 */
const GENERIC = /^(确定|确认|好的?|是|继续|提交|OK|Ok|ok)$/;
const currentPath = () => (typeof window === 'undefined' ? '' : window.location.pathname);

/** antd 给两个汉字的按钮中间加空格（「删 除」），先去掉。 */
const tidy = (raw: string) => raw.replace(/\s+/g, ' ').trim().replace(/(?<=[\u4e00-\u9fa5]) (?=[\u4e00-\u9fa5])/g, '');
const clip = (text: string) => text.length > 24 ? `${text.slice(0, 24)}…` : text;

function dialogTitle(dialog: Element | null) {
  if (!dialog) return '';
  const labelled = dialog.getAttribute('aria-labelledby');
  const heading = (labelled && dialog.ownerDocument.getElementById(labelled.split(' ')[0])) || dialog.querySelector('.ant-modal-confirm-title, .ant-modal-title, h1, h2, h3, h4');
  return tidy(dialog.getAttribute('aria-label') || heading?.textContent || '').replace(/[？?。.!！：:]+$/, '');
}

function controlAction(control: Element, dialog: Element | null): string {
  const label = tidy(control.getAttribute('aria-label') || (control as HTMLElement).innerText || control.textContent || control.getAttribute('title') || (control as HTMLInputElement).value || '');
  // 「确定」「确认删除」「确认分配 100 积分」这类确认按钮，说做什么的是弹窗标题（「删除画布」「分配企业积分」）。
  if ((!label || GENERIC.test(label) || /^确认./.test(label)) && dialogTitle(dialog)) return clip(dialogTitle(dialog));
  return label ? `「${clip(label)}」` : '这次操作';
}

/** 记一次用户操作（测试也用它模拟点击）。点在错误弹窗 / 提示自己身上的不算。 */
export function noteStudioActivation(target: EventTarget | null) {
  if (!(target instanceof Element)) return;
  // 选完文件才开始上传：把点「上传」那次操作的时间顺延，选文件选得久也不超出时间窗。
  if (target instanceof HTMLInputElement && target.type === 'file') { if (lastActivation) lastActivation.at = Date.now(); return; }
  const control = target.closest(ACTIONABLE);
  if (!control || control.closest(IGNORED) || (control as HTMLButtonElement).disabled) return;
  const dialog = control.closest('[role="dialog"]');
  lastActivation = { action: controlAction(control, dialog), at: Date.now(), path: currentPath() };
}

/** 把文件拖进来 / 粘贴进画布（不是输入框里）也是一次操作：上传失败要弹窗。 */
function noteTransfer(event: Event, action: string) {
  const target = event.target;
  if (target instanceof Element && target.closest('input, textarea, [contenteditable="true"], [contenteditable=""]')) return;
  const files = (event as DragEvent).dataTransfer?.files ?? (event as ClipboardEvent).clipboardData?.files;
  if (!files?.length) return;
  lastActivation = { action, at: Date.now(), path: currentPath() };
}

function installActivationTracking() {
  if (trackingInstalled || typeof document === 'undefined') return;
  trackingInstalled = true;
  document.addEventListener('click', event => noteStudioActivation(event.target), true);
  document.addEventListener('change', event => noteStudioActivation(event.target), true);
  document.addEventListener('drop', event => noteTransfer(event, '上传拖进来的文件'), true);
  document.addEventListener('paste', event => noteTransfer(event, '上传粘贴的文件'), true);
}

/** 忘掉刚才那次操作（测试之间用）。 */
export function forgetStudioActivation() { lastActivation = undefined; }

/** 取出刚才那次操作，算到这个错误头上（一次操作只算一个错误，换了页面不算）。 */
function takeActivation() {
  const recent = lastActivation;
  if (!recent || Date.now() - recent.at >= STUDIO_ACTION_WINDOW_MS || recent.path !== currentPath()) return undefined;
  lastActivation = undefined;
  return recent;
}

/**
 * 默认：用户刚做的操作没做成 → 错误弹窗；没有这样的操作 → 右上角提示。
 * options.action：这次是哪个操作（知道的地方直接给，比推断准）；next：下一步怎么做。
 * options.background：后台、媒体加载、自动保存、轮询这类失败，只走右上角提示。只给 once 也按后台处理（同一个只提示一次）；
 * once 同时给 infer（StudioErrorNotice 挂出来时）仍按刚才的操作判断。
 * options.details：「查看错误详情」按钮，打开详情弹窗。
 */
export function reportStudioError(input: ErrorInput, options: { once?: string; fallback?: string; action?: string; next?: ReactNode; background?: boolean; details?: boolean; infer?: boolean } = {}) {
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
  let meta: StudioErrorMeta;
  if (options.details) meta = { kind: 'details' };
  else if (options.action) { takeActivation(); meta = { kind: 'action', action: options.action, next: options.next }; }
  else if (options.background || (options.once && !options.infer)) meta = { kind: 'background' };
  else {
    const recent = takeActivation();
    meta = recent ? { kind: 'action', action: recent.action, next: options.next } : { kind: 'background' };
  }
  if (sink) sink(error, meta); else pending.set(keyOf(error), { error, meta });
  return error;
}
export const studioRunError = (run: IpRun) => {
  const failed = run.output.videoCandidates?.find(candidate => candidate.status === 'failed');
  return { code: run.errorCode || failed?.errorCode || 'STUDIO_RUN_FAILED', message: run.errorMessage || failed?.errorMessage || (run.status === 'running' ? '任务出现异常，请查看任务状态' : '生成失败，请重试'), logId: run.logId || run.output.logId || failed?.logId, taskId: failed?.jobId || run.id };
};
export const studioNodeError = (node: CanvasNodeData) => ({ code: node.metadata?.studio?.task?.errorCode || node.metadata?.errorCode || 'STUDIO_RUN_FAILED', message: node.metadata?.studio?.task?.errorMessage || node.metadata?.errorDetails || '生成失败，请查看任务', logId: node.metadata?.studio?.task?.logId || node.metadata?.errorLogId, taskId: node.metadata?.studio?.runId || node.metadata?.runId });
/** 生成任务（轮询得知）失败：后台状态，右上角提示一次，画布节点上有「查看错误详情」。 */
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
  /** 不按「X 没有完成」写标题时用（「查看错误详情」打开的详情弹窗）。 */
  title?: string;
  /** 冲突类错误：调用方已经把页面刷新到最新（导演台工作台这样做），下一步才能说「页面已经刷新到最新内容」。 */
  refreshed?: boolean;
  error: unknown;
  /** 下一步怎么做；不给就按错误码给一句通用的。 */
  next?: ReactNode;
  /** 原因下面的补充内容（只放真实数据，如引用它的片段和前往入口）；拿到 close 可以先关弹窗再跳转。 */
  extra?: ReactNode | ((close: () => void) => ReactNode);
};

/** 冲突类错误：这句总排在下一步的最前面。调用方刷新过页面才说「已经刷新」，否则请用户刷新。 */
const isConflict = (code: string) => /_CONFLICT$|_STALE$|_EXPIRED$/.test(code);
const conflictNext = (refreshed: boolean) => refreshed ? '这项内容刚在别处改过，页面已经刷新到最新内容，不用再手动刷新。' : '这项内容刚在别处改过，刷新页面看一下最新内容。';

/** 按错误码给的通用下一步。调用方知道得更具体时自己写 next。 */
export function failureNext(code: string, refreshed = false): string {
  if (isConflict(code)) return `${conflictNext(refreshed)}需要的话重新修改后再试。`;
  if (code === 'STUDIO_PRICE_CHANGED') return '价格有变化，刷新页面后重新确认。';
  if (/_NOT_FOUND$/.test(code)) return '这项内容已经不在了，可能在别处删掉了。刷新页面看一下最新内容，不用再重试。';
  if (/_RUNNING$/.test(code)) return '等正在进行的那一项完成后再试。';
  if (code === 'NETWORK_ERROR') return '检查网络后刷新页面，看一下这次操作有没有生效，再决定要不要重试。';
  if (/CREDIT|BALANCE|INSUFFICIENT/.test(code)) return '积分不够，充值后再试。';
  return '可以稍后再试一次；反复出现的话，展开「错误详情」复制后发给我们。';
}

type ModalApi = Pick<typeof Modal, 'error'>;
const openFailures = new Set<string>();
/** 刚弹过错误弹窗的错误：同一个错误紧接着又从后台通道报上来时不再右上角提示一遍。 */
const recentDialogs = new Map<string, number>();
/** 正在判断要不要弹窗的错误（等原弹窗把它写出来）：这期间同一个错误从后台通道报上来，不先挂一条提示。 */
const deciding = new Set<string>();

/** 打开错误弹窗。同一个操作的同一个错误还开着时不再弹第二个（连点、轮询重复报错）。 */
export function openStudioFailure(modal: ModalApi, failure: StudioFailure) {
  const error = normalizeStudioError(failure.error);
  if (error.code === 'IP_RUN_CANCELLED') return error;
  // 同一个错误（不论从哪条路报上来）开着时不再弹第二个：页面内联提示与统一出口可能各报一次。
  const key = failure.title ? `details|${keyOf(error)}` : `${error.code}|${error.message}|${error.logId ?? ''}`;
  if (openFailures.has(key)) return error;
  openFailures.add(key);
  // 详情弹窗只是查看，不算「已经告诉用户了」。
  if (!failure.title) recentDialogs.set(keyOf(error), Date.now());
  let instance: { destroy: () => void } | undefined;
  const close = () => instance?.destroy();
  const extra = typeof failure.extra === 'function' ? failure.extra(close) : failure.extra;
  instance = modal.error({
    title: failure.title ?? `${failure.action}${/[0-9A-Za-z]$/.test(failure.action) ? ' ' : ''}没有完成`,
    content: <div className="studio-failure">
      <section><h4>原因</h4><p>{error.code === 'NETWORK_ERROR' ? '网络连接中断，没收到服务器的回应。' : error.message}</p></section>
      {extra}
      <section><h4>下一步</h4><div>{failure.next === undefined ? failureNext(error.code, failure.refreshed) : isConflict(error.code) ? <><p>{conflictNext(!!failure.refreshed)}</p>{failure.next}</> : failure.next}</div></section>
      <details className="studio-failure-details" open={!!failure.title}><summary>错误详情</summary><ErrorDetails error={error}/></details>
    </div>,
    // 高于画布浮层、抽屉和下拉（最高 1300），不被挡住。
    okText: '知道了', closable: true, mask: { closable: true }, width: 480, className: 'studio-failure-dialog', zIndex: 1400,
    afterClose: () => { openFailures.delete(key); },
  });
  return error;
}

/** 组件里用：在 antd <App> 里走它的 modal（跟随主题），外面没有 <App> 时用静态 Modal。 */
export function useStudioFailure() {
  const { modal } = App.useApp();
  return useCallback((failure: StudioFailure) => {
    // 这次点击的错误已经由调用方弹出来了，之后别的错误不再算到它头上。
    forgetStudioActivation();
    return openStudioFailure(typeof modal.error === 'function' ? modal : Modal, failure);
  }, [modal]);
}

/** 打开着的弹窗 / 浮层里已经把这条错误写出来了（就地显示）。关着但还留在 DOM 里的（display:none）不算。 */
function shownInOpenDialog(message: string) {
  const visible = (el: Element) => { for (let node: Element | null = el; node; node = node.parentElement) { if ((node as HTMLElement).hidden || getComputedStyle(node).display === 'none') return false; } return true; };
  return Array.from(document.querySelectorAll('[role="dialog"]')).some(el => !el.closest('.studio-failure-dialog') && !!el.textContent?.includes(message) && visible(el));
}

/**
 * 全站唯一的错误出口（挂在根布局，外面不需要 antd <App>）：用户操作没做成 → 错误弹窗；后台 / 加载 / 媒体失败 → 右上角提示。
 * 打开着的弹窗已经把这条错误就地写出来了（在弹窗里点的操作、或点了打开弹窗后弹窗里读取失败），就不再叠一个弹窗。
 */
export function StudioNotifications() {
  const [api, holder] = notification.useNotification({ placement: 'topRight', top: 64, stack: false });
  const [modal, modalHolder] = Modal.useModal();
  useEffect(() => {
    const show = (error: StudioError, meta: StudioErrorMeta) => {
      if (meta.kind === 'details') { openStudioFailure(modal, { action: '', title: '错误详情', error }); return; }
      if (meta.kind === 'action') {
        // 等页面把错误写出来（setState 之后的那次渲染）再判断：弹窗里已经写了就只在那里显示，没写再弹。
        const key = keyOf(error);
        deciding.add(key);
        window.setTimeout(() => {
          deciding.delete(key);
          if (shownInOpenDialog(error.message)) recentDialogs.set(key, Date.now());
          else openStudioFailure(modal, { action: meta.action || '这次操作', error, next: meta.next });
        }, 120);
        return;
      }
      const dialogAt = recentDialogs.get(keyOf(error));
      if (deciding.has(keyOf(error)) || (dialogAt && Date.now() - dialogAt < 10_000)) return;
      api.error({ key: `studio-error:${keyOf(error)}`, title: '操作未完成', description: <ErrorDetails key={studioErrorText(error)} error={error}/>, duration: 10, showProgress: true, pauseOnHover: true, placement: 'topRight', className: 'studio-error-notification', role: 'alert' });
    };
    return subscribeStudioErrors(show);
  }, [api, modal]);
  return <ConfigProvider theme={{ components: { Notification: { width: 'min(440px, calc(100vw - 48px))' } }, token: { colorPrimary: '#192229', borderRadius: 13, fontFamily: 'var(--ip-font-sans, sans-serif)' } }}>{holder}{modalHolder}</ConfigProvider>;
}

/** Preserve success feedback; every action error goes to the shared error exit (a dialog for the action the user just took). */
export function useStudioApp() {
  const app = App.useApp();
  return useMemo(() => ({ ...app, message: { ...app.message, error: (error: ErrorInput, action?: string) => { reportStudioError(error, { action }); } } }), [app.message, app.modal, app.notification]);
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

/**
 * Historical failures keep a details button (autoReport={false}); live failures report once on mount:
 * right after the user's action that becomes the error dialog, otherwise a notification.
 * background：输入校验、配置缺失这类持续状态，不管刚才点了什么都只右上角提示。
 */
export function StudioErrorNotice({ error, once, label = '查看错误详情', autoReport = true, background = false }: { error: ErrorInput; once?: string; label?: string; autoReport?: boolean; background?: boolean }) {
  const normalized = normalizeStudioError(error);
  const identity = once || keyOf(normalized);
  useEffect(() => { if (error && autoReport) reportStudioError(error, { once: identity, infer: !background, background }); }, [autoReport, background, identity, error && normalized.code, error && normalized.message, error && normalized.logId]);
  // 用户点「查看错误详情」：打开详情弹窗（原因、下一步、错误码与 logId），不当成又一次操作失败。
  if (!error) return null;
  if (normalized.code === "IP_RUN_CANCELLED") return <span role="status">已停止</span>;
  return <button type="button" className="studio-error-link nodrag nopan" onClick={event => { event.stopPropagation(); reportStudioError(error, { details: true }); }}>{label}</button>;
}
