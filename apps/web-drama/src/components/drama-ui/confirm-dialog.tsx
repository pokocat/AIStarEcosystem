"use client";

// 平台自有确认弹窗 — 设计真源：components.jsx `ConfirmDialog`。
// 强制：禁止用浏览器原生 confirm/alert/prompt（AGENTS.md §8）。
import * as React from "react";
import { CircleHelp, Gem, TriangleAlert } from "lucide-react";
import { useModalA11y } from "@/lib/use-modal-a11y";

interface DramaConfirmDialogProps {
  open: boolean;
  title: React.ReactNode;
  body?: React.ReactNode;
  cost?: number;
  /** 默认：带 cost 时「确认生成」，否则「确定」 */
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
  confirmLabel,
  cancelLabel = "取消",
  tone = "default",
  onConfirm,
  onCancel,
}: DramaConfirmDialogProps) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const titleId = React.useId();
  // ESC=取消 / Tab 焦点圈定 / 打开时聚焦（首个可聚焦=取消按钮）/ 关闭还原焦点，统一走共享 hook。
  useModalA11y(panelRef, onCancel, open);
  if (!open) return null;
  const okLabel = confirmLabel ?? (cost != null ? "确认生成" : "确定");
  return (
    <div className="overlay" onClick={onCancel}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="card pop-in"
        style={{ width: 420, maxWidth: "100%", padding: "clamp(18px, 5vw, 24px)", boxShadow: "var(--shadow-lg)", outline: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row gap-3" style={{ marginBottom: 12, alignItems: "flex-start" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              background: tone === "danger" ? "#fee2e2" : cost != null ? "var(--accent-soft)" : "var(--surface-2)",
              display: "grid",
              placeItems: "center",
              flex: "none",
              color: tone === "danger" ? "#dc2626" : cost != null ? "var(--gem)" : "var(--ink-2)",
            }}
          >
            {/* 图标只表达「这是什么性质的确认」：危险 → 警示；花积分 → 钻石；其余 → 问号（不带钻石，免得让人以为要扣费） */}
            {tone === "danger" ? <TriangleAlert size={19} /> : cost != null ? <Gem size={19} /> : <CircleHelp size={19} />}
          </div>
          <div id={titleId} style={{ fontWeight: 700, fontSize: 16, minWidth: 0, alignSelf: "center" }}>{title}</div>
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
            <span style={{ fontWeight: 600, fontSize: 13 }}>这次会用掉</span>
            <span className="row gap-1" style={{ fontWeight: 700, color: "var(--accent-2)" }}>
              <Gem size={14} style={{ color: "var(--gem)" }} />
              <span className="num">{cost}</span> 积分
            </span>
          </div>
        )}
        <div className="row gap-3" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === "danger" ? "btn btn-primary" : "btn btn-grad"}
            style={tone === "danger" ? { background: "#dc2626", boxShadow: "0 8px 24px rgba(220,38,38,.28)" } : undefined}
            onClick={onConfirm}
          >
            {okLabel}
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

const listeners = new Set<() => void>();
let pending: PendingConfirm | null = null;
function setPending(p: PendingConfirm | null) {
  pending = p;
  for (const l of [...listeners]) l();
}
function subscribePending(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/**
 * 答复某一个确认。只在它还是当前那个时才清掉全局的 pending。
 * 弹窗上的按钮回调拿的是渲染时的那个确认（闭包）：新确认已经顶掉它、但界面还没重画的那一下里点了按钮，
 * 如果照样清空 pending，清掉的是**新**的那个 —— 它的 Promise 永远不结束，界面上也没有弹窗，
 * 等它的 CreditButton 就一直是「在途」。被顶掉的那个在顶掉时已按取消结束，这里再 resolve 是空操作。
 */
function answer(cur: PendingConfirm | null, ok: boolean) {
  if (!cur) return;
  if (pending === cur) setPending(null);
  cur.resolve(ok);
}

export function dramaConfirm(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    // 上一个还没答的确认被新的顶掉时，按「取消」结束它。之前它的 Promise 永远不结束，
    // 等它的调用方（如 CreditButton 的在途锁）就一直卡着。
    const prev = pending;
    setPending({ opts, resolve });
    prev?.resolve(false);
  });
}

/** 挂在 app/providers 里的全局承载组件（每个 app 一次即可）。 */
export function DramaConfirmHost() {
  // 用 useSyncExternalStore 读：之前是「首次渲染拿一次 + effect 里订阅」，两者之间进来的确认会错过通知，
  // 没有弹窗、Promise 也不结束。
  const p = React.useSyncExternalStore(subscribePending, () => pending, () => null);
  return (
    <DramaConfirmDialog
      open={!!p}
      title={p?.opts.title ?? ""}
      body={p?.opts.body}
      cost={p?.opts.cost}
      confirmLabel={p?.opts.confirmLabel}
      cancelLabel={p?.opts.cancelLabel}
      tone={p?.opts.tone}
      onConfirm={() => answer(p, true)}
      onCancel={() => answer(p, false)}
    />
  );
}
