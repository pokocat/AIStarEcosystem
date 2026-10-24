"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, Loader2, X } from "lucide-react";
import type { DirectorAsset, DirectorMedia, DirectorMediaSlot, DirectorTask, DirectorWork } from "@ai-star-eco/types";
import type { EnterpriseBillingSelection } from "@ai-star-eco/types/enterprise";
import { normalizeStudioError } from "../studio-errors";

export const kindLabel: Record<DirectorAsset["kind"], string> = { character: "角色", scene: "场景", prop: "道具" };

export function newRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "").slice(0, 32) : `${Date.now()}${Math.random().toString(16).slice(2, 10)}`;
}

export function errorText(e: unknown) {
  return normalizeStudioError(e).message;
}

/** 企业积分开着时让用户选这次谁付款；没开就按个人账户，服务端照样校验。 */
export async function chooseDirectorBilling(operation: string, expectedCost: number): Promise<EnterpriseBillingSelection | undefined> {
  if (process.env.NEXT_PUBLIC_ENTERPRISE_ENABLED !== "1") return undefined;
  const { chooseStudioBilling } = await import("@/ip/studio-billing-dialog");
  return chooseStudioBilling({ operation, expectedCost });
}

/** 一个按钮一个忙碌态：防连点，失败把服务端的原话交给调用方显示。 */
export function useBusy() {
  const [busy, setBusy] = useState<string>();
  const lock = useRef(false);
  const run = useCallback(async <T,>(key: string, fn: () => Promise<T>, onError: (message: string) => void): Promise<T | undefined> => {
    if (lock.current) return undefined;
    lock.current = true; setBusy(key);
    try { return await fn(); }
    catch (e) { onError(errorText(e)); return undefined; }
    finally { lock.current = false; setBusy(undefined); }
  }, []);
  return { busy, run };
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

export function InlineError({ message, onClose }: { message?: string | null; onClose?: () => void }) {
  if (!message) return null;
  return <div className="ip-brand-error director-inline-error" role="alert"><span>{message}</span>{onClose && <button type="button" onClick={onClose}>关闭</button>}</div>;
}

/** 历史版本条：点一下用这一版；「按旧设置生成」的版本有标记，不会被自动用上。 */
export function VersionStrip({ slot, onAdopt, disabled, label, video }: { slot: DirectorMediaSlot; onAdopt: (id: string) => void; disabled?: boolean; label: string; video?: boolean }) {
  if (slot.candidates.length < 2 && !slot.candidates.some(m => m.stale)) return null;
  return <div className="director-versions" role="group" aria-label={`${label}的历史版本`}>
    {slot.candidates.map((m, i) => <button key={m.id} type="button" disabled={disabled} aria-pressed={m.id === slot.adoptedId}
      title={m.stale ? "生成期间设置有变动，此版本需更新" : m.source === "upload" ? "上传" : `第 ${i + 1} 版`}
      onClick={() => m.id !== slot.adoptedId && onAdopt(m.id)}>
      {m.url && !video ? <img src={m.url} alt=""/> : <span>{i + 1}</span>}
      {m.id === slot.adoptedId && <i><Check size={11}/></i>}
      {m.stale && <em>需更新</em>}
    </button>)}
  </div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return <label className="director-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

// ── 未保存的修改 ─────────────────────────────────────────────────────────────
// 编辑框的值放在组件外：切工作区、切集、关掉编辑再打开都还在，只有保存成功或点「撤销修改」才清掉。
// 刷新或关页面时由工作台提示「有未保存的修改」。

const drafts = new Map<string, unknown>();
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** 像 useState，但没保存的值不随组件卸载丢失；没改过时跟随服务端的值。返回 [值, 设值, 是否有未保存修改]。 */
export function useDraft<T>(key: string, server: T): [T, (value: T) => void, boolean] {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const has = drafts.has(key);
  const value = has ? drafts.get(key) as T : server;
  const set = (next: T) => { if (same(next, server)) drafts.delete(key); else drafts.set(key, next); rerender(); };
  return [value, set, has];
}

export function hasDrafts(prefix: string) {
  for (const k of drafts.keys()) if (k.startsWith(prefix)) return true;
  return false;
}

export function clearDrafts(prefix: string) {
  for (const k of [...drafts.keys()]) if (k.startsWith(prefix)) drafts.delete(k);
}

const FOCUSABLE = 'input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),select:not([disabled]),button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])';

/**
 * 弹窗 / 抽屉的焦点：挂上时把焦点移进来（先输入框、再按钮），Tab 在里面循环；卸下时还给打开前的元素。
 * React 19 的 ref 回调可以返回清理函数，模块级函数引用稳定，只挂一次。
 */
export function dialogFocus(el: HTMLElement | null) {
  if (!el) return;
  const previous = document.activeElement as HTMLElement | null;
  const items = () => [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(x => x.offsetParent !== null || x === document.activeElement);
  const first = el.querySelector<HTMLElement>("[autofocus], input:not([type=checkbox]):not([disabled]), textarea:not([disabled])") ?? items().find(x => !x.closest("header")) ?? items()[0];
  (first ?? el).focus({ preventScroll: true });
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const list = items();
    if (!list.length) return;
    const head = list[0], tail = list[list.length - 1];
    if (e.shiftKey && (document.activeElement === head || !el.contains(document.activeElement))) { e.preventDefault(); tail.focus(); }
    else if (!e.shiftKey && (document.activeElement === tail || !el.contains(document.activeElement))) { e.preventDefault(); head.focus(); }
  };
  el.addEventListener("keydown", onKey);
  return () => { el.removeEventListener("keydown", onKey); if (previous && document.contains(previous)) previous.focus({ preventScroll: true }); };
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
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") latest.current(); };
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
