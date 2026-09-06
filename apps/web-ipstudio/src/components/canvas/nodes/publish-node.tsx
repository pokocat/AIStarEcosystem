"use client";

import type { NodeProps } from "@xyflow/react";
import { CheckCircle2 } from "lucide-react";
import type { IpFlowNode } from "@/lib/flow-types";
import { NodeChip, NodeEmpty, NodeShell } from "../node-shell";

export function PublishNode({ data }: NodeProps<IpFlowNode>) {
  const node = data.node;
  if (node.type !== "publish") return null;
  const { avatarName, avatarId } = node.data;

  return (
    <NodeShell
      node={node}
      hasSource={false}
      badge={avatarId ? <NodeChip tone="ok" title={`资产编号 ${avatarId}`}>已发布</NodeChip> : undefined}
    >
      {avatarId ? (
        <div className="min-w-0">
          <div className="asset-name text-[15px] truncate" style={{ color: "var(--ink)" }} title={avatarName}>
            {avatarName || "已发布资产"}
          </div>
          <div className="mt-1 flex items-center gap-1.5 min-w-0">
            <CheckCircle2 className="w-3 h-3 shrink-0" style={{ color: "var(--ok)" }} />
            <span className="reg truncate">{avatarId}</span>
          </div>
        </div>
      ) : (
        <NodeEmpty>形象都定稿后，用上方的「发布」把它们登记成数字资产。</NodeEmpty>
      )}
    </NodeShell>
  );
}
