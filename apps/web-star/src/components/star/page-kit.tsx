"use client";

// page-kit — 工作台页面通用原语（浅色主题）。
// 统一卡片 / 筛选 chip / 实色操作按钮 / 状态 pill / 提示条 / 轻量弹层。
// 禁止浏览器原生 confirm/alert/prompt（仓库硬规则）——确认与输入一律走 <Modal>。

import * as React from "react";
import { motion } from "motion/react";
import { Loader2, X, type LucideIcon } from "lucide-react";

// ── 页头 ─────────────────────────────────────────────────────────────────────

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-x-3 gap-y-2 flex-wrap">
      <div className="min-w-0">
        <h2 className="text-lg font-black tracking-tight" style={{ color: "var(--ink-0)", fontFamily: "var(--font-display)" }}>{title}</h2>
        {sub && <p className="text-xs mt-1" style={{ color: "var(--ink-1)" }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

// ── 筛选 chip ────────────────────────────────────────────────────────────────

export function FilterChip({
  active, color, label, count, icon: Icon, onClick,
}: {
  active: boolean;
  color: string;
  label: string;
  count?: number;
  icon?: LucideIcon;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className="flex items-center gap-1.5 px-3 py-1.5 max-sm:min-h-[38px] rounded-full text-xs font-semibold transition-colors"
      style={active
        ? { background: `${color}14`, border: `1px solid ${color}55`, color }
        : { background: "var(--bg-1)", border: "1px solid var(--line)", color: "var(--ink-1)" }}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      <span>{label}</span>
      {typeof count === "number" && (
        <span
          className="px-1.5 min-w-[18px] rounded-full text-[10px] font-bold tabular text-center"
          style={active ? { background: `${color}22`, color } : { background: "var(--bg-2)", color: "var(--ink-2)" }}
        >
          {count}
        </span>
      )}
    </motion.button>
  );
}

// ── 操作按钮 ─────────────────────────────────────────────────────────────────

export function ActionButton({
  color, icon: Icon, children, onClick, disabled, busy,
}: {
  color: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 max-sm:min-h-[44px] max-sm:px-4 rounded-lg text-xs font-bold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 shadow-sm"
      style={{ background: color }}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : Icon ? <Icon className="w-3.5 h-3.5" /> : null}
      {children}
    </button>
  );
}

export function DangerGhostButton({ children, onClick, disabled, busy }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 max-sm:min-h-[44px] max-sm:px-4 rounded-lg text-xs font-bold transition hover:bg-red-50 active:scale-[0.98] disabled:opacity-50"
      style={{ color: "var(--danger)", border: "1px solid #dc262633", background: "#dc26260a" }}
    >
      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 max-sm:min-h-[44px] max-sm:px-4 rounded-lg text-xs font-bold transition hover:bg-[var(--bg-2)] disabled:opacity-50"
      style={{ color: "var(--ink-1)", border: "1px solid var(--line-strong)", background: "var(--bg-1)" }}
    >
      {children}
    </button>
  );
}

// ── 卡片操作条（提示行 + 按钮组） ────────────────────────────────────────────
// 桌面：提示与按钮同行；<sm：提示独占一行，按钮平分整行宽（拇指友好）。

export function CardActions({ hint, hintColor = "var(--star-gold-deep)", hintIcon: HintIcon, children }: {
  hint?: React.ReactNode;
  hintColor?: string;
  hintIcon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 pb-3 pt-2.5" style={{ borderTop: "1px solid var(--line)" }}>
      {hint && (
        <div className="sm:flex-1 min-w-0 text-[11px] flex items-center gap-1" style={{ color: hintColor }}>
          {HintIcon && <HintIcon className="w-3 h-3 shrink-0" />}
          <span className="min-w-0">{hint}</span>
        </div>
      )}
      <div className={`flex items-center gap-2 max-sm:[&>*]:flex-1 ${hint ? "" : "sm:ml-auto"}`}>{children}</div>
    </div>
  );
}

// ── 状态 pill ────────────────────────────────────────────────────────────────

export function Pill({ color, icon: Icon, children, strong }: { color: string; icon?: LucideIcon; children: React.ReactNode; strong?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: `${color}${strong ? "1f" : "14"}`, color, border: `1px solid ${color}33` }}
    >
      {Icon && <Icon className="w-2.5 h-2.5" />}
      {children}
    </span>
  );
}

// ── 提示条 ───────────────────────────────────────────────────────────────────

export function NoteBox({ color = "#d97706", icon: Icon, children }: { color?: string; icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-2 text-xs rounded-xl px-3 py-2.5 leading-relaxed"
      style={{ background: `${color}0d`, border: `1px solid ${color}2e`, color }}
    >
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0 mt-px" />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ── 空态 ─────────────────────────────────────────────────────────────────────

export function EmptyState({ icon: Icon, title, sub }: { icon: LucideIcon; title: string; sub?: string }) {
  return (
    <div className="star-card flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--bg-2)" }}>
        <Icon className="w-6 h-6" style={{ color: "var(--ink-2)" }} />
      </div>
      <div className="mt-3 text-sm font-bold" style={{ color: "var(--ink-0)" }}>{title}</div>
      {sub && <div className="mt-1 text-xs max-w-sm leading-relaxed" style={{ color: "var(--ink-2)" }}>{sub}</div>}
    </div>
  );
}

// ── 加载骨架 ─────────────────────────────────────────────────────────────────

export function LoadingList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="star-card h-[88px] animate-pulse" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }} />
      ))}
    </div>
  );
}

// ── 轻量弹层（输入采集 / 二次确认） ──────────────────────────────────────────
// 进场用 tw-animate CSS（与 shadcn Dialog 同源）；关闭走条件卸载，即时可靠
// （motion AnimatePresence 退出动画在 React 19 下偶发卡死，已弃用）。

export function Modal({
  open, title, onClose, children, footer, width = 480,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      style={{ background: "rgba(28,25,23,0.4)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* <sm 底部抽屉：全宽 + 仅上圆角 + 安全区；≥sm 居中卡片 */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-sm:max-w-none rounded-t-2xl sm:rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 sm:slide-in-from-bottom-2 duration-200"
        style={{ maxWidth: width, background: "var(--bg-1)", border: "1px solid var(--line)", boxShadow: "var(--shadow-lift)" }}
      >
        <div className="flex items-center justify-between pl-5 pr-3 py-3.5 sm:py-4" style={{ borderBottom: "1px solid var(--line)" }}>
          <h3 className="text-sm font-bold min-w-0 truncate" style={{ color: "var(--ink-0)" }}>{title}</h3>
          <button onClick={onClose} className="p-2 -my-1 rounded-lg transition hover:bg-[var(--bg-2)] shrink-0" aria-label="关闭">
            <X className="w-4 h-4" style={{ color: "var(--ink-2)" }} />
          </button>
        </div>
        <div className="px-5 py-4 max-h-[70dvh] sm:max-h-[65vh] overflow-y-auto scrollbar-thin overscroll-contain">{children}</div>
        {footer && (
          <div
            className="flex flex-wrap items-center justify-end gap-2 px-4 sm:px-5 py-3 sm:py-3.5 max-sm:[&>button]:flex-1"
            style={{ borderTop: "1px solid var(--line)", background: "var(--bg-0)", paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            {footer}
          </div>
        )}
        {!footer && <div style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />}
      </div>
    </div>
  );
}

// ── 错误条（页面内联，替代 alert） ───────────────────────────────────────────

export function InlineError({ message, onDismiss }: { message: string | null; onDismiss?: () => void }) {
  if (!message) return null;
  return (
    <div className="flex items-center justify-between gap-2 text-xs rounded-xl px-3 py-2.5" style={{ background: "var(--brand-soft)", color: "var(--brand-deep)", border: "1px solid #dc262626" }}>
      <span className="min-w-0">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="关闭" className="shrink-0 opacity-70 hover:opacity-100">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
