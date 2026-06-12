"use client";

// AI 协作壳 — 设计真源：components.jsx `AICollab`。
// 统一范式：输入/上文 → AI 起草（积分预估）→ 可编辑结构化结果 → 局部重写 / 整体重生成 → ✓锁定进下一步。
import * as React from "react";
import { Check, Lock, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { CreditButton } from "./credit";
import { GenError } from "./gen-state";

export interface AICollabProps {
  title: string;
  hint?: string;
  cost?: number;
  generating?: boolean;
  done?: boolean;
  error?: boolean;
  errorReason?: string;
  locked?: boolean;
  /** 锁定按钮文案；默认"锁定本阶段,进入下一步" */
  lockLabel?: string;
  /** "AI 起草"按钮文案；默认"AI 起草" */
  generateLabel?: string;
  onGenerate?: () => void;
  onRetry?: () => void;
  onLock?: () => void;
  children?: React.ReactNode;
}

export function AICollab({
  title,
  hint,
  cost,
  generating,
  done,
  error,
  errorReason,
  locked,
  lockLabel = "锁定本阶段,进入下一步",
  generateLabel = "AI 起草",
  onGenerate,
  onRetry,
  onLock,
  children,
}: AICollabProps) {
  const showStartActions = !done && !generating && !error;
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {/* 头部 */}
      <div
        className="row"
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--line-soft)",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: "linear-gradient(135deg,var(--accent),var(--accent-2))",
            display: "grid",
            placeItems: "center",
            flex: "none",
            color: "#fff",
          }}
        >
          <Sparkles size={17} fill="currentColor" strokeWidth={0} />
        </div>
        <div className="grow">
          <div style={{ fontWeight: 700 }}>{title}</div>
          {hint && <div className="faint" style={{ fontSize: 12 }}>{hint}</div>}
        </div>
        {showStartActions && onGenerate &&
          (cost != null ? (
            <CreditButton cost={cost} onConfirm={onGenerate} confirmTitle={title} className="btn btn-grad btn-sm">
              <Wand2 size={15} /> {generateLabel}
            </CreditButton>
          ) : (
            <button type="button" className="btn btn-grad btn-sm" onClick={onGenerate}>
              <Wand2 size={15} /> {generateLabel}
            </button>
          ))}
      </div>

      {/* 内容 */}
      <div style={{ padding: 18 }}>
        {error ? <GenError reason={errorReason} onRetry={onRetry} /> : children}
      </div>

      {/* 操作区 */}
      {done && !locked && (
        <div
          className="row"
          style={{
            padding: "14px 18px",
            borderTop: "1px solid var(--line-soft)",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          {onGenerate &&
            (cost != null ? (
              <CreditButton cost={cost} onConfirm={onGenerate} confirmTitle={title} className="btn btn-line btn-sm">
                <RefreshCw size={15} /> 整体重新生成
              </CreditButton>
            ) : (
              <button type="button" className="btn btn-line btn-sm" onClick={onGenerate}>
                <RefreshCw size={15} /> 整体重新生成
              </button>
            ))}
          {onLock && (
            <button type="button" className="btn btn-primary" onClick={onLock}>
              <Check size={16} /> {lockLabel}
            </button>
          )}
        </div>
      )}
      {locked && (
        <div
          className="row"
          style={{
            padding: "12px 18px",
            borderTop: "1px solid var(--line-soft)",
            gap: 8,
            color: "var(--accent)",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          <Lock size={15} /> 本阶段已锁定 · 可随时回改
        </div>
      )}
    </div>
  );
}

/**
 * 局部重写气泡（保留 / 修改 / 颠覆 / 新增）。
 * 设计真源：用户任务文案"局部重写带【保留】【修改】【颠覆】【新增】标签"。
 */
export type RewriteTag = "keep" | "modify" | "subvert" | "add";

export const REWRITE_LABEL: Record<RewriteTag, string> = {
  keep: "保留",
  modify: "修改",
  subvert: "颠覆",
  add: "新增",
};

export const REWRITE_TONE: Record<RewriteTag, { bg: string; fg: string }> = {
  keep:    { bg: "var(--surface-2)",  fg: "var(--ink-2)" },
  modify:  { bg: "var(--accent-soft)", fg: "var(--accent)" },
  subvert: { bg: "var(--accent-2-soft)", fg: "var(--accent-2)" },
  add:     { bg: "#dcfce7", fg: "#15803d" },
};

interface RewriteTagPillProps {
  tag: RewriteTag;
  onClick?: () => void;
  active?: boolean;
}

export function RewriteTagPill({ tag, onClick, active }: RewriteTagPillProps) {
  const tone = REWRITE_TONE[tag];
  return (
    <button
      type="button"
      onClick={onClick}
      className="chip"
      style={{
        background: active ? tone.fg : tone.bg,
        color: active ? "#fff" : tone.fg,
        height: 24,
        padding: "0 10px",
        fontSize: 11.5,
      }}
    >
      【{REWRITE_LABEL[tag]}】
    </button>
  );
}
