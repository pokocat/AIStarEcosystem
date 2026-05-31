"use client";

import * as React from "react";
import { Coins, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button, Card, Chip } from "@/components/premium";
import { Field, TextInput, Select, SectionHeader, EmptyState } from "@/components/common";
import type { DramaVariant } from "@/api/short-drama";
import type { DramaDraftController } from "../useDramaDraft";

export function StepGenerate({ ctrl, onGenerated }: { ctrl: DramaDraftController; onGenerated?: () => void }) {
  const s = ctrl.activeScript;
  if (!s) {
    return (
      <Card style={{ padding: "22px 24px" }}>
        <EmptyState icon={<Sparkles size={26} />} title="还没有脚本" description="先在前面的步骤生成或新建脚本。" />
      </Card>
    );
  }

  async function generate() {
    await ctrl.handleGenerate();
    onGenerated?.();
  }

  return (
    <Card style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionHeader eyebrow="风格" title="整体风格" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Field label="视觉"><TextInput value={s.style?.visual ?? ""} onChange={(e) => ctrl.update({ style: { ...s.style, visual: e.target.value } })} placeholder="电影感 / 纪实" /></Field>
        <Field label="色调"><TextInput value={s.style?.palette ?? ""} onChange={(e) => ctrl.update({ style: { ...s.style, palette: e.target.value } })} placeholder="暖色 / 冷色" /></Field>
        <Field label="节奏"><TextInput value={s.style?.pace ?? ""} onChange={(e) => ctrl.update({ style: { ...s.style, pace: e.target.value } })} placeholder="快节奏 / 舒缓" /></Field>
      </div>

      <VariantEditor variants={ctrl.variants} onChange={ctrl.setVariants} genCount={ctrl.genCount} onGenCount={ctrl.setGenCount} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, paddingTop: 14, borderTop: "1px solid var(--line)", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--fg-2)" }}>
          <Coins size={15} style={{ color: "var(--accent)" }} />
          预计消耗 <b style={{ color: "var(--fg-0)" }}>{ctrl.creditEstimate}</b> 积分 · {ctrl.variants.length > 0 ? `${ctrl.variants.length} 个变体` : `${ctrl.genCount} 条`}
        </div>
        <Button variant="primary" size="lg" loading={ctrl.generating} onClick={generate} disabled={ctrl.generating}>
          <Sparkles size={14} /> {ctrl.generating ? "提交中…" : "生成短剧视频"}
        </Button>
      </div>
    </Card>
  );
}

function VariantEditor({
  variants,
  onChange,
  genCount,
  onGenCount,
}: {
  variants: DramaVariant[];
  onChange: (v: DramaVariant[]) => void;
  genCount: number;
  onGenCount: (n: number) => void;
}) {
  function addVariant() {
    onChange([...variants, { id: `v_${Date.now()}`, label: `风格 ${variants.length + 1}`, overrides: { tone: "", style: {} } }]);
  }
  function patch(i: number, p: Partial<DramaVariant>) {
    onChange(variants.map((v, idx) => (idx === i ? { ...v, ...p } : v)));
  }
  return (
    <div>
      <SectionHeader eyebrow="变体" title="风格变体（可选）" right={<Chip>{variants.length > 0 ? `${variants.length} 个变体` : "未启用"}</Chip>} />
      {variants.length === 0 ? (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginTop: 8 }}>
          <Field label="生成条数（同一脚本）">
            <Select value={String(genCount)} onChange={(e) => onGenCount(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} 条</option>)}
            </Select>
          </Field>
          <Button variant="ghost" size="md" onClick={addVariant} style={{ marginBottom: 14 }}><Plus size={13} /> 改用多风格变体</Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {variants.map((v, i) => (
            <div key={v.id} style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: "10px 12px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
              <Field label="变体名"><TextInput value={v.label} onChange={(e) => patch(i, { label: e.target.value })} /></Field>
              <Field label="基调"><TextInput value={v.overrides?.tone ?? ""} onChange={(e) => patch(i, { overrides: { ...v.overrides, tone: e.target.value } })} placeholder="甜宠 / 虐恋" /></Field>
              <Field label="色调"><TextInput value={v.overrides?.style?.palette ?? ""} onChange={(e) => patch(i, { overrides: { ...v.overrides, style: { ...v.overrides?.style, palette: e.target.value } } })} placeholder="暖色 / 冷色" /></Field>
              <button type="button" title="删除变体" onClick={() => onChange(variants.filter((_, idx) => idx !== i))} style={{ width: 30, height: 30, borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", background: "var(--surface-1)", color: "var(--danger)", cursor: "pointer" }}><Trash2 size={13} /></button>
            </div>
          ))}
          <Button variant="ghost" size="md" onClick={addVariant}><Plus size={13} /> 再加一个变体</Button>
        </div>
      )}
    </div>
  );
}
