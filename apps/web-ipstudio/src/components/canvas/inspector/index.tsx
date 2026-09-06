"use client";

// 右侧属性面板 —— 按选中节点类型分发；顶部是类型名 + 编号 + 删除。

import * as React from "react";
import { MousePointerClick, Trash2 } from "lucide-react";
import type { IpNode, IpPricing, IpRun, IpStylePreset } from "@ai-star-eco/types";
import { useCanvasStore } from "@/lib/canvas-store";
import { NODE_META } from "@/lib/node-meta";
import { GenerateInspector } from "./generate-inspector";
import { IdentityInspector } from "./identity-inspector";
import { LookInspector, PublishInspector, ReferenceInspector, SourceInspector, StyleInspector } from "./basic-inspectors";
import { Field, TextInput } from "./fields";

export interface InspectorProps {
  node: IpNode | null;
  run?: IpRun;
  running: boolean;
  styles: IpStylePreset[];
  pricing: IpPricing | null;
  uploadingNodeId: string | null;
  onRun: (nodeId: string) => void;
  onCancel: (nodeId: string) => void;
  onUpload: (nodeId: string, file: File) => void;
}

export function Inspector({
  node, run, running, styles, pricing, uploadingNodeId, onRun, onCancel, onUpload,
}: InspectorProps) {
  const removeNode = useCanvasStore((s) => s.removeNode);
  const setNodeLabel = useCanvasStore((s) => s.setNodeLabel);

  if (!node) {
    return (
      <aside
        className="w-[300px] shrink-0 flex flex-col items-center justify-center px-8 text-center"
        style={{ background: "var(--surface)", borderLeft: "1px solid var(--line)" }}
      >
        <MousePointerClick className="w-6 h-6 mb-3" style={{ color: "var(--ink-4)" }} />
        <p className="text-[13px] font-semibold mb-1" style={{ color: "var(--ink)" }}>选一个节点</p>
        <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
          点画布上的任意节点，这里会显示它的设置、这次生成用的提示词和花费。
        </p>
      </aside>
    );
  }

  const meta = NODE_META[node.type];
  const Icon = meta.icon;

  return (
    <aside
      className="w-[300px] shrink-0 flex flex-col overflow-y-auto scrollbar-thin"
      style={{ background: "var(--surface)", borderLeft: "1px solid var(--line)" }}
    >
      <div className="sticky top-0 z-10 px-3.5 py-3" style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)" }}>
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 shrink-0" style={{ color: "var(--ink-3)" }} />
          <span className="text-[13.5px] font-bold min-w-0 truncate" style={{ color: "var(--ink)" }}>{meta.label}</span>
          <button
            onClick={() => removeNode(node.id)}
            className="ml-auto shrink-0 p-1.5 rounded-lg transition hover:bg-[var(--err-soft)]"
            title="从画布上删除这个节点"
            aria-label="删除节点"
          >
            <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--ink-3)" }} />
          </button>
        </div>
        <div className="reg mt-1 truncate" title={`节点编号 ${node.id}`}>{node.id}</div>
      </div>

      <div className="px-3.5 py-3.5 space-y-3.5">
        <Field label="备注名（画布上显示）">
          <TextInput
            value={node.label ?? ""}
            placeholder={meta.label}
            onChange={(e) => setNodeLabel(node.id, e.target.value)}
          />
        </Field>

        {node.type === "source" && (
          <SourceInspector node={node} uploading={uploadingNodeId === node.id} onUpload={onUpload} />
        )}
        {node.type === "identity" && (
          <IdentityInspector node={node} run={run} running={running} pricing={pricing} onRun={onRun} onCancel={onCancel} />
        )}
        {node.type === "style" && <StyleInspector node={node} styles={styles} />}
        {node.type === "look" && <LookInspector node={node} />}
        {node.type === "generate" && (
          <GenerateInspector node={node} run={run} running={running} pricing={pricing} onRun={onRun} onCancel={onCancel} />
        )}
        {node.type === "reference" && (
          <ReferenceInspector node={node} uploading={uploadingNodeId === node.id} onUpload={onUpload} />
        )}
        {node.type === "publish" && <PublishInspector node={node} />}
      </div>
    </aside>
  );
}
