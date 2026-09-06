"use client";

import type { NodeProps } from "@xyflow/react";
import type { IpFlowNode } from "@/lib/flow-types";
import { NodeChip, NodeEmpty, NodeShell } from "../node-shell";

export function StyleNode({ data }: NodeProps<IpFlowNode>) {
  const node = data.node;
  if (node.type !== "style") return null;
  const { name, custom, promptEn } = node.data;

  return (
    <NodeShell
      node={node}
      badge={custom ? <NodeChip tone="neutral" title="自定义风格描述">自定义</NodeChip> : undefined}
    >
      {name || promptEn ? (
        <div className="min-w-0">
          <div className="asset-name text-[15px] truncate" style={{ color: "var(--ink)" }} title={name}>
            {name || "自定义风格"}
          </div>
          <div className="mt-1 text-[10px] leading-relaxed line-clamp-2" style={{ color: "var(--ink-3)" }} title={promptEn}>
            {promptEn}
          </div>
        </div>
      ) : (
        <NodeEmpty>还没挑风格。选中后在右侧挑一套内置风格。</NodeEmpty>
      )}
    </NodeShell>
  );
}
