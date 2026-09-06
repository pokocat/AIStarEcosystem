"use client";

import type { NodeProps } from "@xyflow/react";
import type { IpFlowNode } from "@/lib/flow-types";
import { NodeEmpty, NodeShell } from "../node-shell";

const FIELDS: Array<{ key: "outfit" | "pose" | "expression" | "details" | "props"; label: string }> = [
  { key: "outfit", label: "服装" },
  { key: "pose", label: "姿势" },
  { key: "expression", label: "表情" },
  { key: "details", label: "细节" },
  { key: "props", label: "道具" },
];

export function LookNode({ data }: NodeProps<IpFlowNode>) {
  const node = data.node;
  if (node.type !== "look") return null;
  const look = node.data;
  const filled = FIELDS.filter((f) => (look[f.key] ?? "").trim());

  return (
    <NodeShell node={node} width={240}>
      <div className="asset-name text-[15px] truncate mb-1.5" style={{ color: "var(--ink)" }} title={look.title}>
        {look.title || "未命名造型"}
      </div>
      {filled.length ? (
        <div className="space-y-1">
          {filled.slice(0, 4).map((f) => (
            <div key={f.key} className="flex gap-1.5 min-w-0">
              <span className="field-label shrink-0 w-6 pt-[1px]">{f.label}</span>
              <span
                className="text-[10.5px] leading-snug flex-1 min-w-0 truncate"
                style={{ color: "var(--ink-2)" }}
                title={look[f.key]}
              >
                {look[f.key]}
              </span>
            </div>
          ))}
          {filled.length > 4 && (
            <div className="text-[10px] pl-[30px]" style={{ color: "var(--ink-4)" }}>
              还有 {filled.length - 4} 项
            </div>
          )}
        </div>
      ) : (
        <NodeEmpty>填上穿什么、什么姿势、什么表情，这个造型才画得准。</NodeEmpty>
      )}
    </NodeShell>
  );
}
