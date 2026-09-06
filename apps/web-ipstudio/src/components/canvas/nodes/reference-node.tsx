"use client";

import type { NodeProps } from "@xyflow/react";
import { USE_MOCK } from "@ai-star-eco/api-client";
import type { IpFlowNode } from "@/lib/flow-types";
import { MockBadge } from "@/components/common/mock-badge";
import { NodeEmpty, NodeShell } from "../node-shell";

export function ReferenceNode({ data }: NodeProps<IpFlowNode>) {
  const node = data.node;
  if (node.type !== "reference") return null;
  const { imageUrl, note } = node.data;

  return (
    <NodeShell node={node} hasTarget={false} width={200}>
      {imageUrl ? (
        <div>
          <div className="relative rounded-lg overflow-hidden aspect-square" style={{ background: "var(--surface-3)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            {USE_MOCK && <div className="absolute top-1.5 left-1.5"><MockBadge /></div>}
          </div>
          <div className="mt-1.5 text-[10.5px] leading-snug line-clamp-2" style={{ color: "var(--ink-2)" }} title={note}>
            {note || "没写用途说明"}
          </div>
        </div>
      ) : (
        <NodeEmpty>放一张局部参考图（例如帽子款式），并写清只参考哪一部分。</NodeEmpty>
      )}
    </NodeShell>
  );
}
