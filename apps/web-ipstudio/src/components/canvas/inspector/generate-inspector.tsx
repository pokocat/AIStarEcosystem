"use client";

// generate 节点属性面板 —— 候选网格选图 / 设为主形象 / 张数与画幅 /
// 本次实际提示词（可折叠）/ 参考图生效情况 / 花费 / 失败重试。

import * as React from "react";
import { AlertTriangle, Check, Coins, Crown, Play, Square, XCircle } from "lucide-react";
import type { IpGenerateData, IpNode, IpPricing, IpRun } from "@ai-star-eco/types";
import { USE_MOCK } from "@ai-star-eco/api-client";
import { useCanvasStore } from "@/lib/canvas-store";
import { missingInputsForRun } from "@/lib/graph";
import { describeRefReason, describeRefRole, describeRunError } from "@/lib/node-meta";
import { resolveSelectedCandidate } from "@/lib/selection";
import { MockBadge } from "@/components/common/mock-badge";
import { Collapsible, Field, GhostButton, PrimaryButton } from "./fields";

const COUNTS: Array<IpGenerateData["count"]> = [1, 2, 4];
const SIZES: Array<{ value: IpGenerateData["size"]; label: string }> = [
  { value: "768x1024", label: "竖版 3:4" },
  { value: "1024x1024", label: "方版 1:1" },
  { value: "768x1365", label: "竖版 9:16" },
];

export function GenerateInspector({
  node, run, running, pricing, onRun, onCancel,
}: {
  node: IpNode & { type: "generate" };
  run?: IpRun;
  running: boolean;
  pricing: IpPricing | null;
  onRun: (nodeId: string) => void;
  onCancel: (nodeId: string) => void;
}) {
  const doc = useCanvasStore((s) => s.doc);
  const runsById = useCanvasStore((s) => s.runsById);
  const patchNodeData = useCanvasStore((s) => s.patchNodeData);
  const setMaster = useCanvasStore((s) => s.setMaster);

  const candidates = run?.output.candidates ?? [];
  const selected = resolveSelectedCandidate(node, runsById);
  const selectedFromThisRun = selected && run && selected.runId === run.id;
  const missing = missingInputsForRun(doc, node);
  const unitPrice = pricing?.imageCredits ?? 0;
  const estimate = unitPrice * node.data.count;

  const pick = (index: number) => {
    if (!run) return;
    patchNodeData(node.id, "generate", { selectedRunId: run.id, selectedIndex: index });
  };

  return (
    <div className="space-y-3.5">
      {/* 主形象 */}
      <button
        onClick={() => setMaster(node.data.isMaster ? "" : node.id)}
        className="w-full flex items-center gap-2 px-2.5 py-2.5 rounded-xl text-left transition"
        style={node.data.isMaster
          ? { background: "var(--primary-soft)", border: "1px solid var(--primary)" }
          : { background: "var(--surface-2)", border: "1px solid var(--line-2)" }}
        aria-pressed={node.data.isMaster}
      >
        <Crown className="w-4 h-4 shrink-0" style={{ color: node.data.isMaster ? "var(--primary-700)" : "var(--ink-3)" }} />
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-bold" style={{ color: "var(--ink)" }}>
            {node.data.isMaster ? "这是主形象" : "设为主形象"}
          </span>
          <span className="block text-[10px] leading-snug" style={{ color: "var(--ink-3)" }}>
            主形象定稿图会作为其余形象的第一参考，全项目只能有一个。
          </span>
        </span>
        {node.data.isMaster && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--primary-700)" }} />}
      </button>

      {/* 候选网格 */}
      {candidates.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="field-label">候选（点一下定稿）</span>
            {USE_MOCK && <MockBadge />}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {candidates.map((c, i) => {
              const isPicked = Boolean(selectedFromThisRun && selected?.index === i);
              return (
                <button
                  key={c.key}
                  onClick={() => pick(i)}
                  className="relative rounded-lg overflow-hidden transition"
                  style={{
                    aspectRatio: "3/4",
                    border: `2px solid ${isPicked ? "var(--primary)" : "transparent"}`,
                    background: "var(--surface-3)",
                    boxShadow: isPicked ? "var(--shadow-ring)" : "none",
                  }}
                  aria-pressed={isPicked}
                  aria-label={`选第 ${i + 1} 张`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.url} alt="" className="w-full h-full object-cover" />
                  <span
                    className="absolute top-1 left-1 w-4 h-4 rounded-md text-[9px] font-bold flex items-center justify-center tabular"
                    style={{ background: "rgba(255,255,255,0.9)", color: "var(--ink-2)" }}
                  >
                    {i + 1}
                  </span>
                  {isPicked && (
                    <span
                      className="absolute bottom-1 right-1 w-4.5 h-4.5 rounded-full flex items-center justify-center"
                      style={{ background: "var(--primary)", width: 18, height: 18 }}
                    >
                      <Check className="w-3 h-3" style={{ color: "var(--on-primary)" }} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 定稿来自较早一次生成 */}
      {selected && !selectedFromThisRun && (
        <div className="flex items-center gap-2 p-2 rounded-xl" style={{ background: "var(--surface-2)", border: "1px solid var(--line-2)" }}>
          <div className="w-9 h-12 rounded-md overflow-hidden shrink-0" style={{ background: "var(--surface-3)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.candidate.url} alt="" className="w-full h-full object-cover" />
          </div>
          <span className="text-[10.5px] leading-snug min-w-0" style={{ color: "var(--ink-2)" }}>
            当前定稿来自较早的一次生成。在上面的候选里重新点一张即可替换。
          </span>
        </div>
      )}

      {/* 张数与画幅 */}
      <Field label="一次出几张">
        <div className="flex gap-1.5">
          {COUNTS.map((c) => (
            <button
              key={c}
              onClick={() => patchNodeData(node.id, "generate", { count: c })}
              className="flex-1 h-9 rounded-lg text-[12px] font-bold transition"
              style={node.data.count === c
                ? { background: "var(--primary-soft)", color: "var(--primary-700)", border: "1px solid var(--primary)" }
                : { background: "var(--surface-2)", color: "var(--ink-2)", border: "1px solid var(--line-2)" }}
              aria-pressed={node.data.count === c}
            >
              {c} 张
            </button>
          ))}
        </div>
      </Field>

      <Field label="画幅">
        <div className="flex gap-1.5">
          {SIZES.map((s) => (
            <button
              key={s.value}
              onClick={() => patchNodeData(node.id, "generate", { size: s.value })}
              className="flex-1 h-9 rounded-lg text-[11px] font-bold transition min-w-0 truncate px-1"
              style={node.data.size === s.value
                ? { background: "var(--primary-soft)", color: "var(--primary-700)", border: "1px solid var(--primary)" }
                : { background: "var(--surface-2)", color: "var(--ink-2)", border: "1px solid var(--line-2)" }}
              aria-pressed={node.data.size === s.value}
              title={s.label}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Field>

      {/* 运行 / 取消 */}
      {running ? (
        <GhostButton onClick={() => onCancel(node.id)} style={{ color: "var(--err)" }}>
          <Square className="w-3.5 h-3.5" /> 停止这次生成
        </GhostButton>
      ) : (
        <PrimaryButton onClick={() => onRun(node.id)} disabled={missing.length > 0}>
          <Play className="w-3.5 h-3.5" />
          {candidates.length > 0 ? "重新生成" : "开始生成"}
          {estimate > 0 && <span className="tabular opacity-90">· {estimate} 积分</span>}
        </PrimaryButton>
      )}

      {missing.length > 0 && (
        <div className="flex items-start gap-1.5 text-[11px] leading-relaxed" style={{ color: "var(--warn)" }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="min-w-0">还缺{missing.join("、")}，接上以后才能生成。</span>
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

      {/* 本次实际提示词 */}
      {run?.inputs.prompt && (
        <Collapsible title="本次实际提示词">
          <p
            className="text-[10.5px] leading-relaxed font-mono break-words whitespace-pre-wrap"
            style={{ color: "var(--ink-2)" }}
          >
            {run.inputs.prompt}
          </p>
        </Collapsible>
      )}

      {/* 参考图生效情况 */}
      {run?.inputs.refs && run.inputs.refs.length > 0 && (
        <div>
          <span className="field-label block mb-1.5">参考图生效情况</span>
          <ul className="space-y-1">
            {run.inputs.refs.map((r, i) => (
              <li key={`${r.role}-${i}`} className="flex items-start gap-1.5 min-w-0">
                {r.applied ? (
                  <Check className="w-3 h-3 shrink-0 mt-[3px]" style={{ color: "var(--ok)" }} />
                ) : (
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-[3px]" style={{ color: "var(--warn)" }} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="text-[11px] font-semibold" style={{ color: "var(--ink-2)" }}>
                    {describeRefRole(r.role)}
                  </span>
                  {!r.applied && (
                    <span className="block text-[10px] leading-snug" style={{ color: "var(--warn)" }}>
                      {describeRefReason(r.reason)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 花费 */}
      {run && (run.cost > 0 || run.status === "done") && (
        <div
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px]"
          style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
        >
          <Coins className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--ink-3)" }} />
          <span className="min-w-0">
            {run.status === "running"
              ? <>本次已冻结 <b className="tabular">{run.cost}</b> 积分，未出图的部分会退回</>
              : <>本次实际花费 <b className="tabular">{run.cost}</b> 积分</>}
          </span>
        </div>
      )}
    </div>
  );
}
