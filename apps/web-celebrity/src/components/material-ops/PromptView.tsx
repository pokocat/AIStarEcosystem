"use client";

// Prompt 预览 —— 字段对照（schema 1:1）/ 完整提示词 / 给 AI 的数据包（JSON）。
// 结构化字段 → 模板渲染，让工程同学一眼看出表单 → JSON sections → prompt 三层对应。

import * as React from "react";
import { Copy, Check } from "lucide-react";
import { Card, Button } from "@/components/creator";
import type { MaterialProduct, ScriptAsset, ScriptBlock } from "./types";
import { Eyebrow, Seg, hexA } from "./shared";

interface Section {
  id: string;
  label: string;
  tone: string;
  fields: Record<string, unknown>;
  template: string;
  compiled: string;
}

export function PromptView({ script, product }: { script: ScriptAsset; product: MaterialProduct }) {
  const blocks = script.blocks;
  const totalDur = blocks.reduce((s, b) => s + b.dur, 0);
  const sections = React.useMemo(() => buildSections(script, product, blocks, totalDur), [script, product, blocks, totalDur]);
  const compiled = React.useMemo(() => sections.map((s) => s.compiled).join("\n\n"), [sections]);
  const json = React.useMemo(() => buildJSON(sections, script, product), [sections, script, product]);
  const [tab, setTab] = React.useState<"mapping" | "compiled" | "api">("mapping");
  const [copied, setCopied] = React.useState(false);

  const copy = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-2)" }}>
        <div>
          <Eyebrow>视频提示词 · AI 拿到这些信息去生成</Eyebrow>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)", marginTop: 3 }}>每一项都可以在表单里改 · 保存后这里实时更新</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Seg value={tab} onChange={setTab} size="sm" options={[{ value: "mapping", label: "字段对照" }, { value: "compiled", label: "完整提示词" }, { value: "api", label: "给 AI 的数据包" }]} />
          <Button variant={copied ? "accent" : "secondary"} size="sm" onClick={() => copy(tab === "api" ? JSON.stringify(json, null, 2) : compiled)}>
            {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? "已复制" : "复制"}
          </Button>
        </div>
      </div>

      {tab === "mapping" && (
        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          {sections.map((s, i) => (
            <SchemaSection key={s.id} idx={i + 1} section={s} />
          ))}
        </div>
      )}
      {tab === "compiled" && (
        <pre style={preStyle}>{compiled}</pre>
      )}
      {tab === "api" && (
        <pre style={{ ...preStyle, fontSize: 12 }}>{JSON.stringify(json, null, 2)}</pre>
      )}
    </Card>
  );
}

const preStyle: React.CSSProperties = {
  margin: 0,
  padding: 24,
  fontFamily: "var(--font-mono)",
  fontSize: 13,
  lineHeight: 1.85,
  color: "var(--fg-1)",
  background: "var(--bg-2)",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  maxHeight: "70vh",
  overflowY: "auto",
};

function SchemaSection({ idx, section }: { idx: number; section: Section }) {
  return (
    <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--line)", background: "var(--bg-2)" }}>
      <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--line)", background: hexA(section.tone, "0d") }}>
        <span style={{ width: 22, height: 22, borderRadius: "var(--radius-sm)", background: hexA(section.tone, "1f"), color: section.tone, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{idx}</span>
        <span style={{ fontSize: 13, color: "var(--fg-0)", fontWeight: 600 }}>{section.label}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>/{section.id}</span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{Object.keys(section.fields).length} 字段</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ padding: "10px 14px", borderRight: "1px solid var(--line)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.1em", marginBottom: 6 }}>表单里填的值</div>
          {Object.entries(section.fields).map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "baseline", gap: 6, padding: "3px 0", fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
              <span style={{ color: section.tone, minWidth: 90 }}>{k}</span>
              <span style={{ color: "var(--fg-3)", fontSize: 10 }}>:</span>
              <span style={{ color: "var(--fg-0)", wordBreak: "break-word", flex: 1 }}>{Array.isArray(v) ? `[${v.length}]` : typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: "10px 14px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.1em", marginBottom: 6 }}>填入提示词 → 实际会发送</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)", lineHeight: 1.6, marginBottom: 8, padding: "6px 8px", background: "var(--bg-1)", borderRadius: "var(--radius-sm)" }}>
            {renderTemplate(section.template, section.tone)}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--fg-0)", lineHeight: 1.7, padding: "6px 8px", background: hexA(section.tone, "0d"), borderRadius: "var(--radius-sm)", borderLeft: `2px solid ${section.tone}` }}>
            {section.compiled}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderTemplate(tmpl: string, tone: string): React.ReactNode {
  const parts = tmpl.split(/(\{\{[\w.]+\}\})/g);
  return parts.map((p, i) =>
    /^\{\{[\w.]+\}\}$/.test(p) ? (
      <span key={i} style={{ color: tone, background: hexA(tone, "14"), padding: "0 4px", borderRadius: 3 }}>{p}</span>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function fill(template: string, fields: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (fields[k] != null ? String(fields[k]) : `{${k}}`));
}

function buildSections(script: ScriptAsset, product: MaterialProduct, blocks: ScriptBlock[], totalDur: number): Section[] {
  const out: Omit<Section, "compiled">[] = [
    {
      id: "basic",
      label: "基础信息",
      tone: "#7c5cff",
      fields: { duration: `${totalDur}s`, ratio: "9:16", style: "电影感写实", resolution: "1080P", fps: "30fps" },
      template: "生成一个 {{duration}}、比例 {{ratio}} 的短视频；风格 {{style}}，分辨率 {{resolution}}，帧率 {{fps}}。",
    },
    {
      id: "subject",
      label: "画面主体",
      tone: "#ff5b8a",
      fields: { subject_type: "人物 + 产品", subject: `${product.name} · ${product.category}`, scene: (script.audience ?? ["通用场景"])[0], background_light: "自然光 + 暖色调" },
      template: "主体 {{subject_type}}：{{subject}}；场景 {{scene}}；背景光影 {{background_light}}。",
    },
    {
      id: "camera",
      label: "镜头语言",
      tone: "#f0a83a",
      fields: { shot_size: "中景 + 特写穿插", movement: "推拉 + 跟随", transition: "硬切", tone: "暖色", light: "自然光" },
      template: "镜头 {{shot_size}}；运镜 {{movement}}；转场 {{transition}}；色调 {{tone}}；光影 {{light}}。",
    },
    {
      id: "audio",
      label: "音频",
      tone: "#5b3fe0",
      fields: { bgm: script.hook_type === "情感" ? "温暖钢琴" : "轻快电子", voice: "女声 · 28 柔和", tts_speed: "正常", subtitle: "居中粗体白字描黑边" },
      template: "背景音乐 {{bgm}}；语音 {{voice}} · 语速 {{tts_speed}}；字幕 {{subtitle}}。",
    },
    {
      id: "advanced",
      label: "高级控制",
      tone: "#22b59a",
      fields: { consistency: "锁定人物长相", forbidden: "无水印 · 禁模糊 · 禁变形", quality: "商用级别 · 4K 母片下采样" },
      template: "画面一致性 {{consistency}}；禁止 {{forbidden}}；质量 {{quality}}。",
    },
  ];
  const sections: Section[] = out.map((s) => ({ ...s, compiled: fill(s.template, s.fields) }));
  // shots 单独拼
  const shotList = blocks.map((b, i) => `  镜${i + 1} · ${b.label} · ${b.dur}s：${b.text}${b.shot ? `  ⟨${b.shot}⟩` : ""}`).join("\n");
  sections.push({
    id: "shots",
    label: "镜头序列",
    tone: "#22b59a",
    fields: { shot_count: blocks.length, total_duration: `${totalDur}s`, shots: blocks.map((b, i) => ({ idx: i + 1, label: b.label, dur: b.dur })) },
    template: "共 {{shot_count}} 镜 · 总时长 {{total_duration}}。按以下顺序渲染：\n{{shots}}",
    compiled: `共 ${blocks.length} 镜 · 总时长 ${totalDur}s。按以下顺序渲染：\n${shotList}`,
  });
  return sections;
}

function buildJSON(sections: Section[], script: ScriptAsset, product: MaterialProduct) {
  const out: { model: string; script_id: string; product_id?: string; sections: Record<string, unknown> } = {
    model: "sora-zh-v3",
    script_id: script.id,
    product_id: product.id,
    sections: {},
  };
  sections.forEach((s) => {
    out.sections[s.id] = s.fields;
  });
  return out;
}
