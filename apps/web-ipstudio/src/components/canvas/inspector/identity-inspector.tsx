"use client";

// identity 节点属性面板 —— 中文特征卡（可改）/ 英文身份提示词（可折叠）/
// 用照片重新抽取 / 锁定。

import * as React from "react";
import { AlertTriangle, Lock, LockOpen, Sparkles, Square, XCircle } from "lucide-react";
import type { IpNode, IpPricing, IpRun } from "@ai-star-eco/types";
import { useCanvasStore } from "@/lib/canvas-store";
import { missingInputsForRun } from "@/lib/graph";
import { describeRunError } from "@/lib/node-meta";
import { Collapsible, Field, GhostButton, PrimaryButton, TextAreaInput } from "./fields";

export function IdentityInspector({
  node, run, running, pricing, onRun, onCancel,
}: {
  node: IpNode & { type: "identity" };
  run?: IpRun;
  running: boolean;
  pricing: IpPricing | null;
  onRun: (nodeId: string) => void;
  onCancel: (nodeId: string) => void;
}) {
  const doc = useCanvasStore((s) => s.doc);
  const patchNodeData = useCanvasStore((s) => s.patchNodeData);
  const missing = missingInputsForRun(doc, node);
  const cost = pricing?.identityCredits ?? 0;
  const hasText = Boolean(node.data.text.trim());

  return (
    <div className="space-y-3.5">
      <div
        className="px-2.5 py-2 rounded-xl text-[10.5px] leading-relaxed"
        style={{ background: "var(--primary-tint)", color: "var(--ink-2)" }}
      >
        这段描述是「这个人长什么样」的唯一说法，之后每一张形象都会复用它 —— 改完记得锁定，
        免得后面不小心改动导致人变样。
      </div>

      <Field label="人物特征卡（中文，可改）">
        <TextAreaInput
          rows={9}
          value={node.data.text}
          placeholder={"核心气质：\n脸型：\n眼睛：\n发型：\n肤色：\n识别特征："}
          disabled={node.data.locked}
          onChange={(e) => patchNodeData(node.id, "identity", { text: e.target.value })}
        />
      </Field>

      <Collapsible title="送进模型的英文身份提示词">
        <TextAreaInput
          rows={5}
          value={node.data.promptEn}
          placeholder="a young person with …"
          disabled={node.data.locked}
          onChange={(e) => patchNodeData(node.id, "identity", { promptEn: e.target.value })}
          style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}
        />
      </Collapsible>

      <div className="flex gap-2">
        <div className="flex-1">
          {running ? (
            <GhostButton onClick={() => onCancel(node.id)} style={{ color: "var(--err)" }}>
              <Square className="w-3.5 h-3.5" /> 停止
            </GhostButton>
          ) : (
            <PrimaryButton onClick={() => onRun(node.id)} disabled={missing.length > 0 || node.data.locked}>
              <Sparkles className="w-3.5 h-3.5" />
              {hasText ? "用照片重新抽取" : "从照片抽取"}
              {cost > 0 && <span className="tabular opacity-90">· {cost} 积分</span>}
            </PrimaryButton>
          )}
        </div>
        <button
          onClick={() => patchNodeData(node.id, "identity", { locked: !node.data.locked })}
          className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition"
          style={node.data.locked
            ? { background: "var(--primary-soft)", border: "1px solid var(--primary)" }
            : { background: "var(--surface-2)", border: "1px solid var(--line-2)" }}
          title={node.data.locked ? "已锁定，点一下解锁再改" : "锁定这段描述"}
          aria-label={node.data.locked ? "解锁特征卡" : "锁定特征卡"}
          aria-pressed={node.data.locked}
        >
          {node.data.locked
            ? <Lock className="w-3.5 h-3.5" style={{ color: "var(--primary-700)" }} />
            : <LockOpen className="w-3.5 h-3.5" style={{ color: "var(--ink-3)" }} />}
        </button>
      </div>

      {node.data.locked && (
        <p className="text-[10.5px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
          已锁定：内容不可编辑、也不会被重新抽取覆盖。要改先点右边的锁。
        </p>
      )}

      {missing.length > 0 && !node.data.locked && (
        <div className="flex items-start gap-1.5 text-[11px] leading-relaxed" style={{ color: "var(--warn)" }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="min-w-0">还缺{missing.join("、")}。也可以不抽取，直接自己写这张卡。</span>
        </div>
      )}

      {run?.status === "failed" && (
        <div className="p-2.5 rounded-xl" style={{ background: "var(--err-soft)", border: "1px solid color-mix(in srgb, var(--err) 25%, transparent)" }}>
          <div className="flex items-start gap-1.5">
            <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--err)" }} />
            <span className="text-[11px] leading-relaxed min-w-0" style={{ color: "var(--err)" }} title={run.errorCode}>
              {describeRunError(run.errorCode, run.errorMessage)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
