"use client";

import type { NodeProps } from "@xyflow/react";
import { USE_MOCK } from "@ai-star-eco/api-client";
import type { IpFlowNode } from "@/lib/flow-types";
import { MockBadge } from "@/components/common/mock-badge";
import { NodeEmpty, NodeShell } from "../node-shell";

export function SourceNode({ data }: NodeProps<IpFlowNode>) {
  const node = data.node;
  if (node.type !== "source") return null;
  const { imageUrl, fileName } = node.data;

  return (
    <NodeShell node={node} hasTarget={false}>
      {imageUrl ? (
        <div>
          <div className="relative rounded-lg overflow-hidden aspect-[3/4]" style={{ background: "var(--surface-3)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            {USE_MOCK && <div className="absolute top-1.5 left-1.5"><MockBadge /></div>}
          </div>
          <div className="mt-1.5 text-[10px] truncate" style={{ color: "var(--ink-3)" }} title={fileName}>
            {fileName || "已上传照片"}
          </div>
        </div>
      ) : (
        <NodeEmpty>还没放照片。选中这个节点，在右侧上传一张正脸清晰的照片。</NodeEmpty>
      )}
    </NodeShell>
  );
}
