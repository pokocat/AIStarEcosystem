"use client";

// 平台自有确认弹窗 — 设计真源：components.jsx `ConfirmDialog`。
// 强制：禁止用浏览器原生 confirm/alert/prompt（AGENTS.md §8）。
import * as React from "react";
import { Gem, Zap } from "lucide-react";

interface DramaConfirmDialogProps {
  open: boolean;
  title: React.ReactNode;
  body?: React.ReactNode;
  cost?: number;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger 模式按钮变红 */
  tone?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

export function DramaConfirmDialog({
  open,
  title,
  body,
  cost,
  confirmLabel = "确认生成",
  cancelLabel = "再想想",
  tone = "default",
  onConfirm,
  onCancel,
}: DramaConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="card pop-in"
        style={{ width: 420, maxWidth: "94vw", padding: 24, boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row gap-3" style={{ marginBottom: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              background: tone === "danger" ? "#fee2e2" : "var(--accent-soft)",
              display: "grid",
              placeItems: "center",
              flex: "none",
              color: tone === "danger" ? "#dc2626" : "var(--gem)",
            }}
          >
            {tone === "danger" ? <Zap size={19} /> : <Gem size={19} />}
          </div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
        </div>
        {body && (
          <div
            className="muted"
            style={{
              fontSize: 13.5,
              marginBottom: cost != null ? 14 : 20,
              lineHeight: 1.6,
            }}
          >
            {body}
          </div>
        )}
        {cost != null && (
          <div
            className="row"
            style={{
              justifyContent: "space-between",
              padding: "12px 14px",
              background: "var(--accent-soft)",
              borderRadius: 12,
              marginBottom: 20,
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 13 }}>本次预计消耗</span>
            <span className="row gap-1" style={{ fontWeight: 700, color: "var(--accent-2)" }}>
              <Gem size={14} style={{ color: "var(--gem)" }} />
              <span className="num">{cost}</span> 积分
            </span>
          </div>
        )}
        <div className="row gap-3" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === "danger" ? "btn btn-primary" : "btn btn-grad"}
            style={tone === "danger" ? { background: "#dc2626", boxShadow: "0 8px 24px rgba(220,38,38,.28)" } : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// 命令式封装：useConfirm() —— 与 web-celebrity 同模式
type ConfirmOpts = Omit<DramaConfirmDialogProps, "open" | "onConfirm" | "onCancel">;

interface PendingConfirm {
  opts: ConfirmOpts;
  resolve: (v: boolean) => void;
}

const listeners = new Set<(p: PendingConfirm | null) => void>();
let pending: PendingConfirm | null = null;
function setPending(p: PendingConfirm | null) {
  pending = p;
  for (const l of listeners) l(p);
}

export function dramaConfirm(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    setPending({ opts, resolve });
  });
}

/** 挂在 app/providers 里的全局承载组件（每个 app 一次即可）。 */
export function DramaConfirmHost() {
  const [p, setP] = React.useState<PendingConfirm | null>(pending);
  React.useEffect(() => {
    listeners.add(setP);
    return () => {
      listeners.delete(setP);
    };
  }, []);
  return (
    <DramaConfirmDialog
      open={!!p}
      title={p?.opts.title ?? ""}
      body={p?.opts.body}
      cost={p?.opts.cost}
      confirmLabel={p?.opts.confirmLabel}
      cancelLabel={p?.opts.cancelLabel}
      tone={p?.opts.tone}
      onConfirm={() => {
        const cur = p;
        setPending(null);
        cur?.resolve(true);
      }}
      onCancel={() => {
        const cur = p;
        setPending(null);
        cur?.resolve(false);
      }}
    />
  );
}
