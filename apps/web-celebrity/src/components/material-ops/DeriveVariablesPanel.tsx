"use client";

// 派生变体 · 变量替换面板（VideoGenDialog 的 variant 模式 body）。
// 左：派生数量 + AI 提取变量 + 替换值管理；右：替换后脚本 ↔ AI 提示词 预览 + 编号翻页。

import * as React from "react";
import { Plus, Trash2, X, ChevronRight, Sparkles, FlaskConical, ArrowRight, Shuffle, ListPlus } from "lucide-react";
import { Slider } from "@ai-star-eco/ui/ui/slider";
import { Button } from "@/components/creator";
import { MATERIAL_PRODUCTS } from "@/mocks/material-ops";
import type { ScriptAsset, ScriptVariable, VariantSample } from "./types";
import { extractVariablesFromScript, sampleVariants, totalCombinations } from "./lib";
import { Eyebrow, Seg, hexA } from "./shared";

export function DeriveVariablesPanel({
  script,
  onClose,
  onSubmit,
  onSubmitAsync,
}: {
  script: ScriptAsset;
  onClose: () => void;
  onSubmit: (samples: VariantSample[]) => void;
  onSubmitAsync: (samples: VariantSample[]) => void;
}) {
  const [count, setCount] = React.useState(4);
  const [variables, setVariables] = React.useState<ScriptVariable[]>(() => extractVariablesFromScript(script));
  const [activeVar, setActiveVar] = React.useState(variables[0]?.id);
  const [previewIdx, setPreviewIdx] = React.useState(0);
  const [previewMode, setPreviewMode] = React.useState<"rendered" | "raw">("rendered");

  const samples = React.useMemo(() => sampleVariants(script, variables, count), [script, variables, count]);
  const combos = React.useMemo(() => totalCombinations(variables), [variables]);
  const active = variables.find((v) => v.id === activeVar);
  const safeIdx = Math.min(previewIdx, samples.length - 1);

  const addVariable = () => {
    const id = `custom_${variables.length + 1}`;
    const v: ScriptVariable = { id, name: `自定义${variables.length + 1}`, toneVar: "#7c5cff", appearances: [], values: ["新增的值"], suggestions: [] };
    setVariables([...variables, v]);
    setActiveVar(id);
  };
  const updateVar = (next: ScriptVariable) => setVariables(variables.map((v) => (v.id === next.id ? next : v)));
  const removeVar = (id: string) => {
    const rest = variables.filter((v) => v.id !== id);
    setVariables(rest);
    if (activeVar === id) setActiveVar(rest[0]?.id);
  };

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      {/* 左：变量管理 */}
      <div style={{ width: 440, borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* 派生数量 */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", background: `linear-gradient(135deg, ${hexA("#5b3fe0", "12")}, transparent 60%)` }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <Eyebrow>派生数量</Eyebrow>
              <div style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 2 }}>
                从可组合 <strong style={{ color: "var(--fg-0)" }}>{combos.toLocaleString()}</strong> 种里抽样
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 38, fontWeight: 700, color: "var(--accent-strong)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                {count}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--fg-2)" }}>条</span>
            </div>
          </div>
          <Slider value={[count]} onValueChange={(v) => setCount(v[0])} min={1} max={10} step={1} />
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", marginTop: 4 }}>
            <span>1</span><span>3</span><span>5</span><span>7</span><span>10</span>
          </div>
        </div>

        {/* 变量 tabs */}
        <div style={{ padding: "12px 20px 0", display: "flex", alignItems: "center", gap: 8 }}>
          <Eyebrow>AI 提取的变量 · {variables.length}</Eyebrow>
          <span style={{ flex: 1 }} />
          <button onClick={addVariable} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--extra-teal)", background: "transparent", border: 0, cursor: "pointer", padding: "0 0 8px" }}>
            <ListPlus size={11} /> 自定义变量
          </button>
        </div>
        <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--line)", display: "flex", flexWrap: "wrap", gap: 5 }}>
          {variables.map((v) => {
            const isA = activeVar === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setActiveVar(v.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: "var(--radius-md)",
                  background: isA ? hexA(v.toneVar, "1f") : "var(--bg-2)",
                  border: `1px solid ${isA ? v.toneVar : "var(--line-2)"}`,
                  color: isA ? v.toneVar : "var(--fg-1)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                }}
              >
                <span>{`{${v.name}}`}</span>
                <span style={{ fontSize: 10, padding: "0 5px", borderRadius: "var(--radius-pill)", background: hexA(v.toneVar, "33"), color: isA ? v.toneVar : "var(--fg-2)" }}>
                  {v.values.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* 变量编辑器 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {active && <VariableEditor variable={active} onUpdate={updateVar} onRemove={() => removeVar(active.id)} />}
        </div>
      </div>

      {/* 右：预览 */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "var(--bg-2)" }}>
          <div>
            <Eyebrow>预览 · 替换变量后的脚本</Eyebrow>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)", marginTop: 3 }}>
              当前显示 第 <strong style={{ color: "var(--fg-0)" }}>{safeIdx + 1}</strong> / {samples.length} 条
            </div>
          </div>
          <Seg
            value={previewMode}
            onChange={setPreviewMode}
            size="sm"
            options={[
              { value: "rendered", label: "替换后的脚本" },
              { value: "raw", label: "AI 提示词" },
            ]}
          />
        </div>

        {/* 编号翻页 */}
        <div style={{ padding: "10px 22px", borderBottom: "1px solid var(--line)", background: "var(--bg-2)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <NavArrow onClick={() => setPreviewIdx((safeIdx - 1 + samples.length) % samples.length)} flip />
            <NavArrow onClick={() => setPreviewIdx((safeIdx + 1) % samples.length)} />
          </div>
          <div style={{ display: "flex", gap: 4, flex: 1, flexWrap: "wrap", minWidth: 0 }}>
            {samples.map((s, i) => {
              const isA = safeIdx === i;
              return (
                <button
                  key={i}
                  onClick={() => setPreviewIdx(i)}
                  title={`#${String(i + 1).padStart(2, "0")} · ${s._label}`}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "var(--radius-sm)",
                    background: isA ? "var(--accent-strong)" : "var(--bg-1)",
                    border: `1px solid ${isA ? "var(--accent-strong)" : "var(--line-2)"}`,
                    color: isA ? "#fff" : "var(--fg-1)",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    fontVariantNumeric: "tabular-nums",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: "var(--radius-md)",
              background: hexA("#5b3fe0", "12"),
              border: `1px solid ${hexA("#5b3fe0", "44")}`,
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              maxWidth: 280,
              flexShrink: 0,
            }}
          >
            <span style={{ color: "var(--accent-strong)", fontWeight: 700, flexShrink: 0 }}>#{String(safeIdx + 1).padStart(2, "0")}</span>
            <span style={{ color: "var(--fg-0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{samples[safeIdx]?._label}</span>
          </div>
        </div>

        {/* 预览 body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 22 }}>
          {samples[safeIdx] && previewMode === "rendered" && <RenderedScriptPreview sample={samples[safeIdx]} variables={variables} />}
          {samples[safeIdx] && previewMode === "raw" && <RawPromptPreview script={script} sample={samples[safeIdx]} variables={variables} />}
        </div>

        {/* footer */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-2)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)" }}>
            <Sparkles size={11} color="var(--extra-teal)" style={{ verticalAlign: -2, marginRight: 4 }} />
            sora-zh-v3 · 单条约 90s · 共 {count} 条
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button variant="secondary" onClick={() => onSubmitAsync(samples)}>
              提交到后台
            </Button>
            <Button variant="accent" onClick={() => onSubmit(samples)}>
              <Shuffle size={13} /> 派生 {count} 条视频
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavArrow({ onClick, flip }: { onClick: () => void; flip?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        borderRadius: "var(--radius-sm)",
        background: "var(--bg-1)",
        border: "1px solid var(--line-2)",
        color: "var(--fg-1)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ChevronRight size={14} style={{ transform: flip ? "rotate(180deg)" : undefined }} />
    </button>
  );
}

function VariableEditor({ variable, onUpdate, onRemove }: { variable: ScriptVariable; onUpdate: (v: ScriptVariable) => void; onRemove: () => void }) {
  const [newValue, setNewValue] = React.useState("");
  const addValue = () => {
    const v = newValue.trim();
    if (!v || variable.values.includes(v)) return;
    onUpdate({ ...variable, values: [...variable.values, v] });
    setNewValue("");
  };
  const removeValue = (v: string) => onUpdate({ ...variable, values: variable.values.filter((x) => x !== v) });

  return (
    <div>
      {/* header */}
      <div style={{ padding: "12px 14px", borderRadius: "var(--radius-md)", background: hexA(variable.toneVar, "0d"), border: `1px solid ${hexA(variable.toneVar, "33")}`, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: variable.toneVar }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: variable.toneVar }}>{`{${variable.name}}`}</span>
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>出现 {variable.appearances.length} 次</span>
          <button onClick={onRemove} title="删除变量" style={{ background: "transparent", border: 0, color: "var(--fg-3)", cursor: "pointer", padding: 2, display: "inline-flex" }}>
            <Trash2 size={11} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {variable.appearances.map((ap, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11, color: "var(--fg-1)", lineHeight: 1.5 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", background: "var(--bg-3)", padding: "1px 5px", borderRadius: 3, flexShrink: 0 }}>镜{ap.shot + 1}</span>
              <span style={{ flex: 1 }}>
                …<span style={{ color: variable.toneVar, fontWeight: 500, background: hexA(variable.toneVar, "14"), padding: "0 3px", borderRadius: 3 }}>{ap.phrase}</span>…
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* values */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Eyebrow>替换值 · {variable.values.length}</Eyebrow>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>回车添加</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {variable.values.map((v, i) => (
          <div
            key={i}
            style={{
              padding: "7px 12px",
              borderRadius: "var(--radius-md)",
              background: i === 0 ? hexA(variable.toneVar, "14") : "var(--bg-2)",
              border: `1px solid ${i === 0 ? hexA(variable.toneVar, "55") : "var(--line)"}`,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", width: 16, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
            <span style={{ flex: 1, fontSize: 12.5, color: "var(--fg-0)" }}>{v}</span>
            {i === 0 && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, padding: "1px 5px", borderRadius: 3, background: hexA(variable.toneVar, "22"), color: variable.toneVar }}>原值</span>
            )}
            {variable.values.length > 1 && (
              <button onClick={() => removeValue(v)} style={{ background: "transparent", border: 0, color: "var(--fg-3)", cursor: "pointer", padding: 2, display: "inline-flex" }}>
                <X size={11} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* add */}
      <div style={{ display: "flex", gap: 6, padding: "6px 10px 6px 12px", borderRadius: "var(--radius-md)", background: "var(--bg-2)", border: "1px solid var(--line)" }}>
        <span style={{ color: variable.toneVar, fontFamily: "var(--font-mono)", fontSize: 12, alignSelf: "center" }}>+</span>
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addValue();
            }
          }}
          placeholder="例如 开了 10 年货车 …"
          style={{ flex: 1, background: "transparent", border: 0, color: "var(--fg-0)", fontSize: 12.5, outline: "none", fontFamily: "var(--font-sans)" }}
        />
        <button
          onClick={addValue}
          disabled={!newValue.trim()}
          style={{
            padding: "3px 11px",
            borderRadius: "var(--radius-sm)",
            background: newValue.trim() ? variable.toneVar : "var(--bg-3)",
            border: 0,
            color: newValue.trim() ? "#fff" : "var(--fg-3)",
            cursor: newValue.trim() ? "pointer" : "not-allowed",
            fontSize: 11,
          }}
        >
          添加
        </button>
      </div>

      {/* AI 推荐 */}
      <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: "var(--radius-md)", background: hexA("#22b59a", "0d"), border: `1px dashed ${hexA("#22b59a", "44")}` }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--extra-teal)", letterSpacing: "0.08em", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
          <FlaskConical size={10} /> AI 推荐补充值
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {variable.suggestions
            .filter((s) => !variable.values.includes(s))
            .slice(0, 5)
            .map((s) => (
              <button
                key={s}
                onClick={() => onUpdate({ ...variable, values: [...variable.values, s] })}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  padding: "3px 9px",
                  borderRadius: "var(--radius-pill)",
                  background: "var(--bg-1)",
                  border: "1px dashed var(--line-2)",
                  color: "var(--fg-1)",
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                <Plus size={9} /> {s}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

function RenderedScriptPreview({ sample, variables }: { sample: VariantSample; variables: ScriptVariable[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ padding: "10px 14px", borderRadius: "var(--radius-md)", background: "var(--bg-2)", border: "1px solid var(--line)" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.06em", marginBottom: 8 }}>本条变体使用的替换值</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {variables.map((v) => {
            const val = sample.subs[v.id];
            const isOriginal = val === v.values[0];
            return (
              <div key={v.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 9px", borderRadius: "var(--radius-md)", background: hexA(v.toneVar, "12"), border: `1px solid ${hexA(v.toneVar, "44")}` }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: v.toneVar }}>{`{${v.name}}`}</span>
                <ArrowRight size={9} color={v.toneVar} style={{ opacity: 0.6 }} />
                <span style={{ fontSize: 12, color: "var(--fg-0)" }}>{val}</span>
                {isOriginal && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)" }}>(原值)</span>}
              </div>
            );
          })}
        </div>
      </div>

      {sample.blocks.map((b, i) => (
        <div key={i} style={{ padding: "12px 16px", borderRadius: "var(--radius-md)", background: "var(--bg-1)", border: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ width: 22, height: 22, borderRadius: "var(--radius-sm)", background: hexA("#5b3fe0", "1f"), color: "var(--accent-strong)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              {i + 1}
            </span>
            <span style={{ fontSize: 12.5, color: "var(--fg-0)", fontWeight: 500 }}>{b.label}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>{b.dur}s</span>
          </div>
          <div style={{ fontSize: 13.5, color: "var(--fg-1)", lineHeight: 1.75 }}>{renderHighlights(b.text, variables)}</div>
        </div>
      ))}
    </div>
  );
}

function renderHighlights(rendered: string, variables: ScriptVariable[]): React.ReactNode {
  const tokens: { val: string; tone: string }[] = [];
  variables.forEach((v) => {
    const sorted = [...v.values].sort((a, b) => b.length - a.length);
    for (const val of sorted) {
      if (val && rendered.includes(val)) {
        tokens.push({ val, tone: v.toneVar });
        break;
      }
    }
  });
  tokens.sort((a, b) => b.val.length - a.val.length);
  let parts: ({ type: "t"; text: string } | { type: "h"; text: string; tone: string })[] = [{ type: "t", text: rendered }];
  tokens.forEach(({ val, tone }) => {
    const next: typeof parts = [];
    parts.forEach((p) => {
      if (p.type !== "t") {
        next.push(p);
        return;
      }
      const s = p.text.split(val);
      s.forEach((seg, i) => {
        if (seg) next.push({ type: "t", text: seg });
        if (i < s.length - 1) next.push({ type: "h", text: val, tone });
      });
    });
    parts = next;
  });
  return parts.map((p, i) =>
    p.type === "t" ? (
      <span key={i}>{p.text}</span>
    ) : (
      <span key={i} style={{ background: hexA(p.tone, "22"), color: p.tone, fontWeight: 500, padding: "1px 4px", borderRadius: 3 }}>
        {p.text}
      </span>
    ),
  );
}

function RawPromptPreview({ script, sample, variables }: { script: ScriptAsset; sample: VariantSample; variables: ScriptVariable[] }) {
  const product = script.product ?? MATERIAL_PRODUCTS.find((p) => p.id === script.product_id) ?? MATERIAL_PRODUCTS[0];
  const totalDur = sample.blocks.reduce((s, b) => s + (b.dur || 0), 0);
  const subStr = variables.map((v) => `  {${v.name}} = ${sample.subs[v.id]}`).join("\n");
  const shotStr = sample.blocks.map((b, i) => `  镜${i + 1} · ${b.label} · ${b.dur}s：${b.text}${b.shot ? `  ⟨${b.shot}⟩` : ""}`).join("\n");
  const priceYuan = product.priceCents ? `¥${(product.priceCents / 100).toFixed(0)}` : "—";
  const promptText = `生成一个 ${totalDur}s、比例 9:16 的短视频。
风格 电影感写实，分辨率 1080P，帧率 30fps。
主体 人物 + 产品：${product.name} · ${product.category}
场景：${(script.audience || ["通用"])[0]}
镜头 中景 + 特写穿插，运镜 推拉 + 跟随。
画面清晰稳定，无水印，高质量商用级别。

— 变量替换 —
${subStr}

— 镜头序列（共 ${sample.blocks.length} 镜 · ${totalDur}s）—
${shotStr}

— 商品信息 —
名称：${product.name}　价格：${priceYuan}　佣金：${product.commissionRate ?? "—"}%
卖点：${(product.sellingPointList || []).join(" / ")}`;

  return (
    <pre
      style={{
        margin: 0,
        padding: 18,
        fontFamily: "var(--font-mono)",
        fontSize: 12.5,
        lineHeight: 1.8,
        color: "var(--fg-1)",
        background: "var(--bg-2)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-md)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {renderPromptHighlights(promptText)}
    </pre>
  );
}

function renderPromptHighlights(text: string): React.ReactNode {
  const parts = text.split(/(— [^\n]+ —)/g);
  return parts.flatMap((p, i) => {
    if (/^— [^\n]+ —$/.test(p)) return [<span key={`h${i}`} style={{ color: "var(--danger)", fontWeight: 700 }}>{p}</span>];
    const sub = p.split(/(\{[^}]+\})/g);
    return sub.map((s, j) =>
      /^\{[^}]+\}$/.test(s) ? (
        <span key={`${i}-${j}`} style={{ color: "var(--accent-strong)", fontWeight: 700 }}>{s}</span>
      ) : (
        <span key={`${i}-${j}`}>{s}</span>
      ),
    );
  });
}
