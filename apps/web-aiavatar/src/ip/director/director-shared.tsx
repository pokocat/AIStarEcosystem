"use client";

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import type { ReactNode, TextareaHTMLAttributes } from "react";
import { Check, Loader2, Maximize2, Sparkles, X, ZoomIn, ZoomOut } from "lucide-react";
import { Image } from "antd";
import type { DirectorAsset, DirectorMedia, DirectorMediaSlot, DirectorTask, DirectorWork } from "@ai-star-eco/types";
import type { EnterpriseBillingSelection } from "@ai-star-eco/types/enterprise";
import { normalizeStudioError, type StudioFailure } from "../studio-errors";
import { publicModelErrorMessage } from "@ai-star-eco/api-client/public-model-error";
import { ApiError } from "@ai-star-eco/api-client";
import { goneWorkId, isStaleGone } from "../api/director";

export const kindLabel: Record<DirectorAsset["kind"], string> = { character: "角色", scene: "场景", prop: "道具" };

export function newRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "").slice(0, 32) : `${Date.now()}${Math.random().toString(16).slice(2, 10)}`;
}

/** 作品已删除（或本来就不存在）：服务端对本人已删除、他人和不存在的作品一律 404 DIRECTOR_WORK_NOT_FOUND。 */
export function isWorkGone(e: unknown) {
  return e instanceof ApiError && e.code === "DIRECTOR_WORK_NOT_FOUND";
}

const goneListeners = new Set<(workId: string) => void>();

/**
 * 工作台订阅「某部作品已删除」。通知带作品 id（由 API 层按请求的作品打标，见 scopeToWork），
 * 订阅方只认自己的 id；卸载时退订，所以已离开的作品迟到的 404 不会落到当前作品上。
 */
export function onWorkGone(listener: (workId: string) => void) {
  goneListeners.add(listener);
  return () => { goneListeners.delete(listener); };
}

/** 作品删除期间发出、恢复之后才回来的请求：没有生效，但作品在。 */
export const STALE_GONE_MESSAGE = "这次操作是在作品删除期间发出的，没有生效。作品现在已恢复，请重新操作。";

/** 导演台所有失败都经过这里拿文案，所以「作品已删除」也在这里通知。归属不明的 404 不通知，只显示文案。 */
export function errorText(e: unknown) {
  if (isStaleGone(e)) return STALE_GONE_MESSAGE;
  const workId = isWorkGone(e) ? goneWorkId(e) : null;
  if (workId) goneListeners.forEach(l => l(workId));
  return normalizeStudioError(e).message;
}

/** 企业积分开着时让用户选这次谁付款；没开就按个人账户，服务端照样校验。 */
export async function chooseDirectorBilling(operation: string, expectedCost?: number): Promise<EnterpriseBillingSelection | undefined> {
  if (process.env.NEXT_PUBLIC_ENTERPRISE_ENABLED !== "1") return undefined;
  const { chooseStudioBilling } = await import("@/ip/studio-billing-dialog");
  return chooseStudioBilling({ operation, expectedCost });
}

/** 一个按钮一个忙碌态：防连点，失败把服务端的原话（和原始错误，带错误码、详情）交给调用方显示。 */
export function useBusy() {
  const [busy, setBusy] = useState<string>();
  const lock = useRef(false);
  const run = useCallback(async <T,>(key: string, fn: () => Promise<T>, onError: (message: string, raw?: unknown) => void): Promise<T | undefined> => {
    if (lock.current) return undefined;
    lock.current = true; setBusy(key);
    try { return await fn(); }
    catch (e) {
      // 用户取消付款没有提交任务，正常回到页面，不显示「操作失败」。
      if (!(e instanceof ApiError && e.code === "STUDIO_BILLING_CANCELLED")) onError(errorText(e), e);
      return undefined;
    }
    finally { lock.current = false; setBusy(undefined); }
  }, []);
  return { busy, run };
}

/** 工作台的错误出口：传字符串或 { action, error, next, extra }，统一弹错误弹窗（studio-errors 的 openStudioFailure）。 */
export type DirectorFail = (failure: string | StudioFailure) => void;

/**
 * useBusy 的 onError：带上「哪个操作」交给工作台弹错误弹窗。
 * 已经打开的操作弹窗、编辑区里的失败不用它，照旧在那个位置就地显示。
 */
export function failed(fail: DirectorFail, action: string, next?: StudioFailure["next"], extra?: StudioFailure["extra"]) {
  return (message: string, raw?: unknown) => fail({ action, error: raw ?? message, next, extra });
}

/** 资产被哪些片段用着（关联资产，或台词说话人），和服务端 asset.delete 的判断一致。 */
export type AssetRef = { clipId: string; episodeId: string; episodeNo: number; order: number; title: string; linked: boolean; lines: number };
export function assetRefs(work: DirectorWork, assetId: string): AssetRef[] {
  const out: AssetRef[] = [];
  for (const clip of work.clips) {
    const linked = clip.assetIds.includes(assetId);
    const lines = clip.shots.reduce((n, s) => n + s.dialogue.filter(l => l.speakerId === assetId).length, 0);
    if (!linked && !lines) continue;
    const ep = work.episodes.find(e => e.id === clip.episodeId);
    out.push({ clipId: clip.id, episodeId: clip.episodeId, episodeNo: ep?.no ?? 0, order: clip.order, title: clip.title, linked, lines });
  }
  return out.sort((a, b) => a.episodeNo - b.episodeNo || a.order - b.order);
}

export function adopted(slot: DirectorMediaSlot): DirectorMedia | undefined {
  return slot.candidates.find(m => m.id === slot.adoptedId);
}

export function runningTask(work: DirectorWork, target: string): DirectorTask | undefined {
  return work.tasks.find(t => t.target === target && t.status === "running");
}

/** 片段时长范围；上下限相同只写一个数。 */
export function secRange(min: number, max: number) {
  return min === max ? `${min} 秒` : `${min}–${max} 秒`;
}

export function costText(n: number, mock: boolean) {
  if (mock) return "测试模式，免费";
  return n > 0 ? `约 ${n.toLocaleString("zh-CN")} 积分` : "免费";
}

export function Spinner({ label }: { label: string }) {
  return <span className="director-running" role="status"><Loader2 size={14} className="ip-loading-icon"/>{label}</span>;
}

/** 从任务开始算的已用时间，每秒走一次；时间来自服务端任务的 createdAt，不编进度。 */
function useElapsed(since?: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  const start = since ? Date.parse(since) : NaN;
  if (!Number.isFinite(start)) return null;
  const sec = Math.max(0, Math.floor((now - start) / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/** AI 正在写：一块会动的卡片，说清在做什么、已经多久、关掉页面也不停。只写真实信息，没有假进度。 */
export function AiWorking({ title, detail, task, compact }: { title: string; detail?: string; task?: DirectorTask; compact?: boolean }) {
  const elapsed = useElapsed(task?.createdAt);
  return <div className={`director-ai-working ${compact ? "is-compact" : ""}`} role="status" aria-live="polite">
    <span className="director-ai-orb" aria-hidden><Sparkles size={compact ? 15 : 20}/></span>
    <div className="director-ai-copy">
      <b>{title}<i className="director-ai-dots" aria-hidden><span/><span/><span/></i></b>
      {detail && <p>{detail}</p>}
      <small>{elapsed ? `已用时 ${elapsed} · ` : ""}可以关闭页面，后台继续，完成后自动显示</small>
    </div>
    {!compact && <div className="director-ai-lines" aria-hidden><span/><span/><span/><span/></div>}
  </div>;
}

export function InlineError({ message, onClose }: { message?: string | null; onClose?: () => void }) {
  if (!message) return null;
  return <div className="ip-brand-error director-inline-error" role="alert"><span>{publicModelErrorMessage(message)}</span>{onClose && <button type="button" onClick={onClose}>关闭</button>}</div>;
}

/** 历史版本条：点一下用这一版；「按旧设置生成」的版本有标记，不会被自动用上。 */
export function VersionStrip({ slot, onAdopt, disabled, label, video }: { slot: DirectorMediaSlot; onAdopt: (id: string) => void; disabled?: boolean; label: string; video?: boolean }) {
  if (slot.candidates.length < 2 && !slot.candidates.some(m => m.stale)) return null;
  return <div className="director-versions" role="group" aria-label={`${label}的历史版本`}>
    {slot.candidates.map((m, i) => <button key={m.id} type="button" disabled={disabled} aria-pressed={m.id === slot.adoptedId}
      title={m.stale ? "生成期间设置有变动，此版本需更新" : m.source === "upload" ? "上传" : m.source === "library" ? "资产库" : m.baseOn ? `第 ${i + 1} 版 · 以第 ${slot.candidates.findIndex(x => x.id === m.baseOn) + 1} 版为参考修改` : `第 ${i + 1} 版`}
      onClick={() => m.id !== slot.adoptedId && onAdopt(m.id)}>
      {m.url && !video ? <img src={m.url} alt=""/> : <span>{i + 1}</span>}
      {m.id === slot.adoptedId && <i><Check size={11}/></i>}
      {m.stale && <em>需更新</em>}
    </button>)}
  </div>;
}

/**
 * 多行输入，随内容长高：浏览器支持 field-sizing 时交给 CSS，否则按 scrollHeight 算；超过 CSS 的上限出滚动条，右下角能拖高。
 * 用在本集摘要这类可能很长、又要整段读完再改的字段（2026-10-27 用户反馈：单行输入框看不到后面的内容）。
 */
export function GrowTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || (typeof CSS !== "undefined" && CSS.supports?.("field-sizing", "content"))) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [props.value]);
  return <textarea ref={ref} {...props}/>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return <label className="director-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

// ── 未保存的修改 ─────────────────────────────────────────────────────────────
// 编辑框的值放在组件外：切工作区、切集、关掉编辑再打开都还在，只有保存成功或点「撤销修改」才清掉。
// 刷新或关页面时由工作台提示「有未保存的修改」。

const drafts = new Map<string, unknown>();
// 字符串直接比：正文可能上百万字，每敲一个字都整段 JSON 序列化两遍会卡（2026-10-29 取消字数上限）。
const same = (a: unknown, b: unknown) => typeof a === "string" || typeof b === "string" ? a === b : JSON.stringify(a) === JSON.stringify(b);

/** 像 useState，但没保存的值不随组件卸载丢失；没改过时跟随服务端的值。返回 [值, 设值, 是否有未保存修改]。 */
export function useDraft<T>(key: string, server: T): [T, (value: T) => void, boolean] {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const has = drafts.has(key);
  const value = has ? drafts.get(key) as T : server;
  // 这一项正在保存时，用户的每次修改都留作草稿，哪怕改回了旧的已存内容（撤回）：
  // 保存回来后服务端会变成刚存进去的那份，只有草稿还等于那份才算「没再改」（见 saveDrafts）。
  const set = (next: T) => { if (same(next, server) && !saving.has(key)) drafts.delete(key); else drafts.set(key, next); rerender(); };
  return [value, set, has];
}

/** 读一个没保存的值（没有返回 undefined）：助手采用建议前先把这处没保存的修改存上，不丢、不被覆盖。 */
export function peekDraft<T>(key: string): T | undefined {
  return drafts.has(key) ? drafts.get(key) as T : undefined;
}

export function hasDrafts(prefix: string) {
  for (const k of drafts.keys()) if (k.startsWith(prefix)) return true;
  return false;
}

const saving = new Map<string, number>();

/**
 * 保存这些草稿：saved 是这次存进去的值（键 → 值）。保存期间用户的修改（补写、撤回成旧内容）都留作草稿；
 * 成功后只清掉值还等于刚存进去那份的草稿，其余仍算没保存。失败时草稿原样保留。
 * 2026-10-28 两轮 review：先是保存回来把补写的台词清掉，后是保存期间撤回成旧正文、回来又变成新正文。
 */
export async function saveDrafts<T>(saved: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
  const keys = Object.keys(saved);
  keys.forEach(k => saving.set(k, (saving.get(k) ?? 0) + 1));
  try {
    const result = await fn();
    for (const k of keys) if (drafts.has(k) && same(drafts.get(k), saved[k])) drafts.delete(k);
    return result;
  } finally {
    keys.forEach(k => { const n = (saving.get(k) ?? 1) - 1; if (n > 0) saving.set(k, n); else saving.delete(k); });
  }
}

export function clearDrafts(prefix: string) {
  for (const k of [...drafts.keys()]) if (k.startsWith(prefix)) drafts.delete(k);
}

// 弹窗焦点（导演台、场景页共用）挪到 ../dialog-focus.ts，这里转出，导演台各处的引用不用改。
import { dialogFocus } from "../dialog-focus";
export { dialogFocus };

/** 大图最多放大到「适应窗口」的 6 倍：资产图、分镜宫格约 2K，再大只是糊的像素。 */
export const PREVIEW_MAX_SCALE = 6;

/**
 * 点图放大。大图用 antd 的图片预览（画布那边也是它）：滚轮、触控板、双指都能缩放，放大后拖动看各处，
 * 松手时图会弹回窗口里，拖不丢；双击在放大和适应窗口之间切换，底部有缩小、放大和「适应窗口」，右上角关闭，点图外的暗处也关闭。
 * - Esc 在捕获阶段截下，只关大图，不连带关掉外面的抽屉或弹窗（它们也在 window 上听 Esc）。
 * - 触控板捏合是带 ctrlKey 的滚轮，React 的 onWheel 是被动监听拦不住，不在这里拦就会连整页一起缩放。
 * - 打开时把地址记下：页面轮询会换签名地址，大图不该因此重新加载。每次打开都从适应窗口开始。
 */
export function ZoomableImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(src);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); e.preventDefault(); setOpen(false); } };
    const onWheel = (e: WheelEvent) => { if (e.ctrlKey && e.target instanceof Element && e.target.closest(".director-image-preview")) e.preventDefault(); };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("wheel", onWheel, true); };
  }, [open]);
  return <>
    <button type="button" className={`director-zoom-trigger ${className ?? ""}`} onClick={() => { setShown(src); setOpen(true); }} aria-label={`放大查看${alt}`} title="点击放大">
      <img src={src} alt={alt}/><span className="director-zoom-hint" aria-hidden><Maximize2 size={14}/>放大</span>
    </button>
    <Image.PreviewGroup items={[{ src: shown, alt }]} classNames={{ popup: { root: "director-image-preview" } }}
      preview={{
        open, onOpenChange: next => setOpen(next), zIndex: 1100, minScale: 1, maxScale: PREVIEW_MAX_SCALE,
        closeIcon: <><X size={20} aria-hidden/><span className="director-visually-hidden">关闭大图</span></>,
        actionsRender: (_, { transform, actions }) => <PreviewTools transform={transform} actions={actions}/>,
      }}/>
  </>;
}

function PreviewTools({ transform, actions }: { transform: { scale: number; x: number; y: number }; actions: { onZoomIn: () => void; onZoomOut: () => void; onReset: () => void } }) {
  const fitted = transform.scale === 1 && transform.x === 0 && transform.y === 0;
  return <div className="director-preview-tools" role="toolbar" aria-label="缩放">
    <button type="button" aria-label="缩小" title="缩小" disabled={transform.scale <= 1} onClick={actions.onZoomOut}><ZoomOut size={18}/></button>
    <span className="director-preview-scale" aria-label="当前缩放">{Math.round(transform.scale * 100)}%</span>
    <button type="button" aria-label="放大" title="放大" disabled={transform.scale >= PREVIEW_MAX_SCALE} onClick={actions.onZoomIn}><ZoomIn size={18}/></button>
    <button type="button" className="is-text" title="回到整张图" disabled={fitted} onClick={actions.onReset}>适应窗口</button>
  </div>;
}

/** 右侧抽屉：就地查看详情，不离开当前页；点遮罩或 Esc 关闭。 */
export function DirectorSheet({ onClose, label, children }: { onClose: () => void; label: string; children: ReactNode }) {
  useEscape(onClose);
  return <div className="director-sheet-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="director-sheet" role="dialog" aria-modal="true" aria-label={label} ref={dialogFocus} tabIndex={-1}>
      <button type="button" className="director-sheet-close" aria-label="关闭" onClick={onClose}><X size={18}/></button>
      {children}
    </div>
  </div>;
}

/** 弹窗开着时按 Esc 关闭，不要求焦点在弹窗里。 */
export function useEscape(onClose: () => void, enabled = true) {
  const latest = useRef(onClose);
  latest.current = onClose;
  useEffect(() => {
    if (!enabled) return;
    // 叠在上面的 antd 弹窗（资产库选择器、二次确认）自己处理 Esc，这里不跟着把底下的抽屉也关掉。
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !(e.target instanceof Element && e.target.closest(".ant-modal-wrap"))) latest.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

/** 采用的版本是按旧设置生成的：说清哪里变了，给重新生成的入口；旧版本留在历史里，不自动重跑。 */
export function OutdatedNote({ slot, what, onRegenerate, disabled }: { slot: DirectorMediaSlot; what: string; onRegenerate?: () => void; disabled?: boolean }) {
  if (slot.adoptedCheck === "outdated") return <div className="director-outdated" role="status">
    <span>这{what}需更新：{(slot.staleReasons ?? []).join("、") || "设置已变更"}。重新生成后，原版本保留在历史中。</span>
    {onRegenerate && <button type="button" disabled={disabled} onClick={onRegenerate}>重新生成</button>}
  </div>;
  if (slot.adoptedCheck === "unknown") return <div className="director-outdated is-unknown" role="status"><span>这{what}缺少生成记录，无法核对是否与当前设置一致。</span></div>;
  return null;
}
