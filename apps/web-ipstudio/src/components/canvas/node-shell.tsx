"use client";

// 档案卡外壳 —— 所有 7 种节点共用的框：图标 + 中文类型名 + 等宽编号 + 内容区。
// 视觉沿用 Atelier Ledger：白底细边、石板蓝柔影、衬线只给标题、青色只给「运行中」。

import * as React from "react";
import { Handle, Position } from "@xyflow/react";
import { Loader2 } from "lucide-react";
import type { IpNode } from "@ai-star-eco/types";
import { NODE_META, describeStage, portColor } from "@/lib/node-meta";

interface NodeShellProps {
  node: IpNode;
  /** 有入边端口（source / reference 是纯输入节点，没有入边） */
  hasTarget?: boolean;
  hasSource?: boolean;
  width?: number;
  running?: boolean;
  runStage?: string;
  runPct?: number;
  failed?: boolean;
  /** 右上角状态徽标（如「主形象」「已选定」） */
  badge?: React.ReactNode;
  children: React.ReactNode;
}

export function NodeShell({
  node, hasTarget = true, hasSource = true, width = 216,
  running = false, runStage, runPct, failed = false, badge, children,
}: NodeShellProps) {
  const meta = NODE_META[node.type];
  const Icon = meta.icon;
  const color = portColor(meta.flow);

  return (
    <div
      className="ip-node-frame relative rounded-[13px] transition-shadow"
      style={{
        width,
        background: "var(--surface)",
        border: `1px solid ${running ? "var(--primary)" : failed ? "var(--err)" : "var(--line-2)"}`,
        boxShadow: "var(--shadow-card)",
      }}
    >
      {hasTarget && (
        <Handle
          type="target"
          position={Position.Left}
          style={{ background: color, left: -5 }}
          isConnectableStart={false}
        />
      )}
      {hasSource && (
        <Handle
          type="source"
          position={Position.Right}
          style={{ background: color, right: -5 }}
          isConnectableEnd={false}
        />
      )}

      {/* 头部 */}
      <div
        className="flex items-center gap-2 px-3 py-2 min-w-0"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--ink-3)" }} />
        <span className="text-[11px] font-bold shrink-0" style={{ color: "var(--ink-2)" }}>{meta.label}</span>
        {badge}
        <span className="reg ml-auto truncate max-w-[5.5rem]" title={node.label || node.id}>
          {node.label || node.id}
        </span>
      </div>

      {/* 内容 */}
      <div className="px-3 py-2.5 min-w-0">{children}</div>

      {/* 运行中进度 */}
      {running && (
        <div className="px-3 pb-2.5">
          <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
            <Loader2 className="w-3 h-3 shrink-0 animate-spin" style={{ color: "var(--primary)" }} />
            <span className="text-[10px] font-semibold truncate" style={{ color: "var(--primary-700)" }}>
              {describeStage(runStage ?? "")}
            </span>
            <span className="text-[10px] tabular ml-auto shrink-0" style={{ color: "var(--ink-3)" }}>
              {Math.max(0, Math.min(100, runPct ?? 0))}%
            </span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-3)" }}>
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${Math.max(3, Math.min(100, runPct ?? 0))}%`, background: "var(--primary)" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** 小徽标（节点卡内用，克制配色） */
export function NodeChip({ tone = "neutral", children, title }: {
  tone?: "neutral" | "primary" | "ok" | "warn" | "err";
  children: React.ReactNode;
  title?: string;
}) {
  const map = {
    neutral: { bg: "var(--surface-3)", fg: "var(--ink-2)" },
    primary: { bg: "var(--primary-soft)", fg: "var(--primary-700)" },
    ok: { bg: "var(--ok-soft)", fg: "var(--ok)" },
    warn: { bg: "var(--warn-soft)", fg: "var(--warn)" },
    err: { bg: "var(--err-soft)", fg: "var(--err)" },
  } as const;
  const { bg, fg } = map[tone];
  return (
    <span
      className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold max-w-[6rem] truncate"
      style={{ background: bg, color: fg }}
      title={title}
    >
      {children}
    </span>
  );
}

/** 内容区的空态提示（统一口吻） */
export function NodeEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[10.5px] leading-relaxed rounded-lg px-2 py-1.5"
      style={{ background: "var(--surface-2)", color: "var(--ink-3)", border: "1px dashed var(--line-2)" }}
    >
      {children}
    </div>
  );
}
