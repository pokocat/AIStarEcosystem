"use client";

import type { NodeProps } from "@xyflow/react";
import { Lock } from "lucide-react";
import type { IpFlowNode } from "@/lib/flow-types";
import { describeRunError } from "@/lib/node-meta";
import { NodeChip, NodeEmpty, NodeShell } from "../node-shell";

export function IdentityNode({ data }: NodeProps<IpFlowNode>) {
  const node = data.node;
  if (node.type !== "identity") return null;
  const { text, locked } = node.data;
  const run = data.run;
  const failed = run?.status === "failed";
  const lines = text.split("\n").filter(Boolean).slice(0, 3);

  return (
    <NodeShell
      node={node}
      width={230}
      running={data.running}
      runStage={run?.stage}
      runPct={run?.pct}
      failed={failed}
      badge={locked ? (
        <NodeChip tone="primary" title="已锁定：之后每次生成都用这段描述">
          <Lock className="w-2.5 h-2.5 mr-0.5" />已锁定
        </NodeChip>
      ) : undefined}
    >
      {text ? (
        <div className="space-y-0.5">
          {lines.map((line, i) => (
            <div key={i} className="text-[10.5px] leading-relaxed truncate" style={{ color: "var(--ink-2)" }} title={line}>
              {line}
            </div>
          ))}
          {text.split("\n").filter(Boolean).length > 3 && (
            <div className="text-[10px]" style={{ color: "var(--ink-4)" }}>…</div>
          )}
        </div>
      ) : failed ? (
        <div className="text-[10.5px] leading-relaxed" style={{ color: "var(--err)" }}>
          {describeRunError(run?.errorCode, run?.errorMessage)}
        </div>
      ) : (
        <NodeEmpty>还没有特征卡。接上照片后点「从照片抽取」，也可以自己写。</NodeEmpty>
      )}
    </NodeShell>
  );
}
