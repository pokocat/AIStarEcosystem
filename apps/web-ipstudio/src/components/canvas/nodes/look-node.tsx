"use client";

import type { NodeProps } from "@xyflow/react";
import type { IpFlowNode } from "@/lib/flow-types";
import { lookSummary } from "@/lib/graph";
import { NodeEmpty, NodeShell } from "../node-shell";

export function LookNode({ data }: NodeProps<IpFlowNode>) {
  const node = data.node;
  if (node.type !== "look") return null;
  const look = node.data;
  const summary = lookSummary(look);

  return (
    <NodeShell node={node} width={240}>
      <div className="asset-name text-[15px] truncate mb-1.5" style={{ color: "var(--ink)" }} title={look.title}>
        {look.title || "未命名造型"}
      </div>
      {summary ? (
        <div
          className="text-[11px] leading-[1.65] min-w-0"
          style={{
            color: "var(--ink-2)",
            display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 4,
            overflow: "hidden",
          }}
          title={summary}
        >
          {summary}
        </div>
      ) : (
        <NodeEmpty>一句话说清这个造型：穿什么、什么表情、在干嘛。</NodeEmpty>
      )}
    </NodeShell>
  );
}
