"use client";

import * as React from "react";
import type { NodeProps } from "@xyflow/react";
import { Crown, ImageOff } from "lucide-react";
import { USE_MOCK } from "@ai-star-eco/api-client";
import type { IpFlowNode } from "@/lib/flow-types";
import { useCanvasStore } from "@/lib/canvas-store";
import { describeRunError } from "@/lib/node-meta";
import { resolveSelectedCandidate } from "@/lib/selection";
import { MockBadge } from "@/components/common/mock-badge";
import { NodeChip, NodeEmpty, NodeShell } from "../node-shell";

const SIZE_LABEL: Record<string, string> = {
  "768x1024": "竖版 3:4",
  "1024x1024": "方版 1:1",
  "768x1365": "竖版 9:16",
};

export function GenerateNode({ data }: NodeProps<IpFlowNode>) {
  const node = data.node;
  const runsById = useCanvasStore((s) => s.runsById);
  if (node.type !== "generate") return null;

  const run = data.run;
  const failed = run?.status === "failed";
  const selected = resolveSelectedCandidate(node, runsById);
  const pending = run?.status === "done" ? run.output.candidates ?? [] : [];

  return (
    <NodeShell
      node={node}
      width={240}
      running={data.running}
      runStage={run?.stage}
      runPct={run?.pct}
      failed={failed}
      badge={node.data.isMaster ? (
        <NodeChip tone="primary" title="主形象：其余形象都以它为身份锚">
          <Crown className="w-2.5 h-2.5 mr-0.5" />主形象
        </NodeChip>
      ) : undefined}
    >
      {selected ? (
        <div>
          <div className="relative rounded-lg overflow-hidden aspect-[3/4]" style={{ background: "var(--surface-3)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.candidate.url} alt="" className="w-full h-full object-cover" />
            {USE_MOCK && <div className="absolute top-1.5 left-1.5"><MockBadge /></div>}
            <span
              className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold"
              style={{ background: "var(--ok-soft)", color: "var(--ok)" }}
            >
              已定稿
            </span>
          </div>
        </div>
      ) : pending.length > 0 ? (
        <div>
          <div className="grid grid-cols-4 gap-1">
            {pending.slice(0, 4).map((c, i) => (
              <div key={c.key} className="relative rounded-md overflow-hidden aspect-[3/4]" style={{ background: "var(--surface-3)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.url} alt="" className="w-full h-full object-cover" />
                <span className="absolute bottom-0 right-0 px-1 text-[8px] font-bold tabular" style={{ background: "rgba(255,255,255,0.85)", color: "var(--ink-2)" }}>
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 text-[10px] font-semibold" style={{ color: "var(--warn)" }}>
            {pending.length} 张候选待你选一张
          </div>
        </div>
      ) : failed ? (
        <div className="flex items-start gap-1.5">
          <ImageOff className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--err)" }} />
          <span className="text-[10.5px] leading-relaxed min-w-0" style={{ color: "var(--err)" }}>
            {describeRunError(run?.errorCode, run?.errorMessage)}
          </span>
        </div>
      ) : (
        <NodeEmpty>还没生成。接上特征卡、风格和形象卡后就能运行。</NodeEmpty>
      )}

      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        <NodeChip tone="neutral">出 {node.data.count} 张</NodeChip>
        <NodeChip tone="neutral" title={node.data.size}>
          {SIZE_LABEL[node.data.size] ?? node.data.size}
        </NodeChip>
      </div>
    </NodeShell>
  );
}
