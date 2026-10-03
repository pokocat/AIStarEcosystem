"use client";

// 剧本页的几个小件：按钮上的价格、「正在写…」那一行、失败原因、禁用原因、可折叠的一节。
import * as React from "react";
import { ChevronDown, Gem, Loader2, Square } from "lucide-react";
import type { RunView } from "./run-view";

/** 按钮上的价格（钻石 + 数字）。价格还没读到时写「—」。 */
export function Cost({ value }: { value: number | null }) {
  return (
    <span className="cvs-cost" aria-label={value == null ? "价格读取中" : `${value} 积分`}>
      <Gem size={12} />
      <span className="num">{value == null ? "—" : value}</span>
    </span>
  );
}

/** 「正在写…」+ 排队中可以停。 */
export function RunLine({
  view,
  label,
  onCancel,
  disabled,
}: {
  view: RunView;
  label: string;
  onCancel: (runId: string) => void;
  disabled?: boolean;
}) {
  if (!view.pending) return null;
  return (
    <div className="cvs-run" role="status" aria-live="polite">
      <Loader2 size={14} className="cv-spin" />
      <span className="cvs-run-text">{view.queued ? `${label}（排队中）` : label}</span>
      {view.queued && view.runId && (
        <button
          type="button"
          className="btn btn-line btn-sm cvs-run-stop"
          disabled={disabled}
          onClick={() => onCancel(view.runId!)}
          title="还在排队，停下来不扣积分"
        >
          <Square size={11} /> 停止
        </button>
      )}
    </div>
  );
}

/** 失败 / 已停止的一行说明。 */
export function RunResult({ view }: { view: RunView }) {
  if (view.failed) return <div className="cvs-err" role="alert">{view.errorMessage}</div>;
  if (view.canceled) return <div className="cvs-reason">已经停下来了，没扣积分。</div>;
  return null;
}

/** 禁用按钮旁边就地写原因（手机上没有 hover，别只放 title）。 */
export function Reason({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <div className="cvs-reason">{children}</div>;
}

export type SectionId = "idea" | "setting" | "outline" | "episodes";

export function Section({
  id,
  title,
  meta,
  actions,
  open,
  onToggle,
  disabled,
  children,
}: {
  id: SectionId;
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const bodyId = `cvs-sec-${id}`;
  return (
    <section className={`cvs-sec${disabled ? " is-disabled" : ""}`} data-section={id} aria-disabled={disabled || undefined}>
      <div className="cvs-sec-head">
        <button type="button" className="cvs-sec-toggle" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
          <ChevronDown size={16} className={open ? "cvs-chev" : "cvs-chev is-closed"} />
          <span className="cvs-sec-title">{title}</span>
        </button>
        {meta && <span className="cvs-sec-meta">{meta}</span>}
        {actions && open && <div className="cvs-sec-actions">{actions}</div>}
      </div>
      {open && (
        <div className="cvs-sec-body" id={bodyId}>
          {children}
        </div>
      )}
    </section>
  );
}
