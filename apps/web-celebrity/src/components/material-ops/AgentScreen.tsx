"use client";

// 智能体训练 —— 违禁词词典 / 平台规则 / 训练语料 / 差异度规则。

import * as React from "react";
import { Plus, TriangleAlert, ClipboardPaste, Music2, BookHeart, MessageCircle, Zap } from "lucide-react";
import { Card, Button } from "@/components/creator";
import { Slider } from "@ai-star-eco/ui/ui/slider";
import { Switch } from "@ai-star-eco/ui/ui/switch";
import { BANNED_WORDS, BANNED_TIER_META, PLATFORM_RULES } from "@/constants/material-ops-ui";
import type { PlatformId } from "./types";
import { Eyebrow, Tag, PageHeader, hexA, AgentLearningsCard } from "./shared";

const PLATFORM_ICONS: Record<PlatformId, React.ComponentType<{ size?: number; color?: string }>> = {
  douyin: Music2,
  xhs: BookHeart,
  wechat: MessageCircle,
  kuaishou: Zap,
};

export function AgentScreen() {
  const [minDiff, setMinDiff] = React.useState(70);
  const [hookRepeat, setHookRepeat] = React.useState(3);
  const [antiAi, setAntiAi] = React.useState(true);
  const [crossStyle, setCrossStyle] = React.useState(true);
  const [autoIsolate, setAutoIsolate] = React.useState(true);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1180 }}>
      <PageHeader
        eyebrow="智能体训练"
        title="把运营经验喂给智能体"
        right={<Tag color="var(--extra-teal)">训练中 · 第 84 轮</Tag>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* 违禁词词典 */}
        <Card style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Eyebrow>违禁词词典</Eyebrow>
            <Button variant="ghost" size="sm">
              <Plus size={12} /> 新增
            </Button>
          </div>
          <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {BANNED_WORDS.map((w) => {
              const meta = BANNED_TIER_META[w.tier];
              return (
                <span
                  key={w.word}
                  style={{
                    padding: "5px 11px",
                    borderRadius: "var(--radius-pill)",
                    background: hexA(meta.toneVar, "14"),
                    color: meta.toneVar,
                    border: `1px solid ${hexA(meta.toneVar, "44")}`,
                    fontSize: 12,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {w.word}
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.75 }}>{meta.label}</span>
                </span>
              );
            })}
          </div>
          <div
            style={{
              marginTop: 16,
              padding: "10px 12px",
              borderRadius: "var(--radius-md)",
              background: hexA("#ff5b8a", "0d"),
              border: `1px solid ${hexA("#ff5b8a", "33")}`,
              fontSize: 11.5,
              color: "var(--fg-1)",
              lineHeight: 1.6,
            }}
          >
            <TriangleAlert size={12} color="var(--danger)" style={{ verticalAlign: -2, marginRight: 6 }} />
            <strong style={{ color: "var(--danger)" }}>HARD</strong> 强阻断 ·{" "}
            <strong style={{ color: "var(--warning)" }}>MED</strong> 医疗效果禁止 ·{" "}
            <strong style={{ color: "var(--fg-0)" }}>SOFT</strong> 候选提示替换
          </div>
        </Card>

        {/* 平台分发规则 */}
        <Card style={{ padding: 18 }}>
          <Eyebrow>平台分发规则</Eyebrow>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {(Object.keys(PLATFORM_RULES) as PlatformId[]).map((id) => {
              const r = PLATFORM_RULES[id];
              const Icon = PLATFORM_ICONS[id];
              return (
                <div
                  key={id}
                  style={{ padding: "12px 14px", borderRadius: "var(--radius-md)", background: "var(--bg-2)", border: "1px solid var(--line)" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Icon size={14} color={r.color} />
                    <span style={{ fontSize: 13, color: "var(--fg-0)", fontWeight: 600 }}>{r.name}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)", marginLeft: "auto" }}>
                      {r.duration_sweet} · 钩 {r.hook_window}s
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--fg-1)", lineHeight: 1.6 }}>{r.notes}</div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 训练语料 */}
        <Card style={{ padding: 18 }}>
          <Eyebrow>训练语料</Eyebrow>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <CorpusRow label="爆款脚本" value={1284} delta="+38 / 本周" tone="var(--accent)" pct={78} />
            <CorpusRow label="拆解钩子" value={426} delta="+12 / 本周" tone="var(--danger)" pct={62} />
            <CorpusRow label="历史变体" value={3120} delta="+148 / 本周" tone="var(--extra-teal)" pct={92} />
            <CorpusRow label="效果回流" value={684} delta="+24 / 本周" tone="var(--extra-teal)" pct={45} />
          </div>
          <Button variant="secondary" size="md" style={{ width: "100%", marginTop: 16 }}>
            <ClipboardPaste size={13} /> 批量导入 · 历史脚本
          </Button>
        </Card>

        {/* 差异度规则 */}
        <Card style={{ padding: 18 }}>
          <Eyebrow>差异度规则</Eyebrow>
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12.5, color: "var(--fg-1)" }}>同账号矩阵 · 最小差异</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>{minDiff}%</span>
            </div>
            <Slider value={[minDiff]} onValueChange={(v) => setMinDiff(v[0])} min={0} max={100} step={1} style={{ marginTop: 12 }} />
          </div>
          <div style={{ marginTop: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12.5, color: "var(--fg-1)" }}>同平台 · 钩子重复阈值</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--warning)" }}>{hookRepeat} 次</span>
            </div>
            <Slider value={[hookRepeat]} onValueChange={(v) => setHookRepeat(v[0])} min={1} max={10} step={1} style={{ marginTop: 12 }} />
          </div>
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <ToggleRow label="启用反 AI 检测重写" checked={antiAi} onChange={setAntiAi} />
            <ToggleRow label="跨平台风格自动迁移" checked={crossStyle} onChange={setCrossStyle} />
            <ToggleRow label="违规自动隔离不发布" checked={autoIsolate} onChange={setAutoIsolate} />
          </div>
        </Card>
      </div>

      <AgentLearningsCard />
    </div>
  );
}

function CorpusRow({ label, value, delta, tone, pct }: { label: string; value: number; delta: string; tone: string; pct: number }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, color: "var(--fg-1)" }}>{label}</span>
        <span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--fg-0)", fontVariantNumeric: "tabular-nums" }}>
            {value.toLocaleString()}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: tone, marginLeft: 6 }}>{delta}</span>
        </span>
      </div>
      <div style={{ height: 4, background: "var(--bg-3)", borderRadius: "var(--radius-pill)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, borderRadius: "var(--radius-pill)", background: tone }} />
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 12.5, color: "var(--fg-1)" }}>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
