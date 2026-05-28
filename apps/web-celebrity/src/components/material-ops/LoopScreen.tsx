"use client";

// 效果回流 —— KPI 卡 + 脚本表现表 + 智能体本周学到。

import * as React from "react";
import { Copy, ChevronRight, Music2, BookHeart, MessageCircle, Zap, Check } from "lucide-react";
import { Card, Button } from "@/components/creator";
import { PLATFORM_RULES } from "@/constants/material-ops-ui";
import { LOOP_ROWS } from "@/mocks/material-ops";
import type { PlatformId } from "./types";
import { Eyebrow, Tag, Seg, FilterChip, PageHeader, Spark, hexA } from "./shared";

const PLATFORM_ICONS: Record<PlatformId, React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>> = {
  douyin: Music2,
  xhs: BookHeart,
  wechat: MessageCircle,
  kuaishou: Zap,
};

const COLS = "1.7fr 0.6fr 0.6fr 0.6fr 0.7fr 0.7fr 0.7fr 0.5fr";

export function LoopScreen() {
  const [wnd, setWnd] = React.useState("7d");
  const [filter, setFilter] = React.useState("爆款");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1180 }}>
      <PageHeader
        eyebrow="效果回流"
        title="脚本 ↔ 视频效果 · 反馈给智能体"
        right={<Seg value={wnd} onChange={setWnd} options={["24h", "7d", "30d", "90d"].map((w) => ({ value: w, label: w }))} size="sm" />}
      />

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <BigKpi label="发布脚本" value="184" sub="本周" tone="var(--accent)" trend={[3, 5, 4, 6, 8, 7, 10]} />
        <BigKpi label="爆款命中" value="12" sub="6.5% 命中率" tone="var(--extra-teal)" trend={[1, 0, 2, 1, 3, 2, 4]} />
        <BigKpi label="去重通过" value="92%" sub="+8% vs 上周" tone="var(--extra-teal)" trend={[80, 82, 85, 84, 88, 90, 92]} />
        <BigKpi label="GMV 回流" value="¥482k" sub="+34% vs 上周" tone="var(--warning)" trend={[40, 55, 48, 70, 65, 80, 95]} />
      </div>

      {/* 表格 */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--line)" }}>
          <Eyebrow>本周脚本表现 · 前 6 名</Eyebrow>
          <div style={{ display: "flex", gap: 6 }}>
            {["全部", "爆款", "同质化告警", "低质"].map((f) => (
              <FilterChip key={f} active={filter === f} onClick={() => setFilter(f)}>
                {f}
              </FilterChip>
            ))}
          </div>
        </div>
        <div
          style={{
            padding: "8px 18px 6px",
            display: "grid",
            gridTemplateColumns: COLS,
            gap: 12,
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--fg-3)",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <span>脚本</span>
          <span>平台</span>
          <span>播放</span>
          <span>CTR</span>
          <span>GMV</span>
          <span>差异度</span>
          <span>状态</span>
          <span></span>
        </div>
        {LOOP_ROWS.map((r) => {
          const p = PLATFORM_RULES[r.plat as PlatformId];
          const Icon = PLATFORM_ICONS[r.plat as PlatformId];
          return (
            <div
              key={r.id}
              style={{
                padding: "12px 18px",
                display: "grid",
                gridTemplateColumns: COLS,
                gap: 12,
                alignItems: "center",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: "var(--fg-0)" }}>{r.title}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", marginTop: 2 }}>{r.id}</div>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--fg-1)" }}>
                <Icon size={12} color={p.color} /> {p.name}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-0)", fontVariantNumeric: "tabular-nums" }}>{r.plays}</div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  color: r.ctr > 7 ? "var(--extra-teal)" : r.ctr > 4 ? "var(--accent)" : "var(--warning)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {r.ctr}%
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-0)", fontVariantNumeric: "tabular-nums" }}>{r.gmv}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ flex: 1, height: 4, background: "var(--bg-3)", borderRadius: "var(--radius-pill)", position: "relative", overflow: "hidden" }}>
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${r.diff}%`,
                      borderRadius: "var(--radius-pill)",
                      background: r.diff > 70 ? "var(--extra-teal)" : r.diff > 50 ? "var(--accent)" : "var(--warning)",
                    }}
                  />
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>{r.diff}</span>
              </div>
              <div>
                <Tag color={r.toneVar}>{r.status}</Tag>
              </div>
              <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                <Button variant="icon" size="sm" title="复用" style={{ width: 28, height: 28, padding: 0 }}>
                  <Copy size={12} />
                </Button>
                <Button variant="icon" size="sm" title="详情" style={{ width: 28, height: 28, padding: 0 }}>
                  <ChevronRight size={12} />
                </Button>
              </div>
            </div>
          );
        })}
      </Card>

      {/* 学到 */}
      <Card style={{ padding: 18, background: `linear-gradient(135deg, ${hexA("#22b59a", "0d")} 0%, transparent 50%), var(--bg-1)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-md)",
              background: hexA("#22b59a", "1f"),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: 18,
            }}
          >
            🧪
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, color: "var(--fg-0)", fontWeight: 600 }}>智能体本周学到</span>
              <Tag color="var(--extra-teal)">4 条新规律</Tag>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--fg-1)", lineHeight: 1.8 }}>
              ① <strong style={{ color: "var(--extra-teal)" }}>蓝领情感故事</strong> 钩子在抖音 25-35 男性受众完播率提升 32% &nbsp; ② “
              <strong style={{ color: "var(--warning)" }}>反差</strong>” 类钩子在小红书命中率下降 12%，建议切到 “
              <strong style={{ color: "var(--accent)" }}>测评对比</strong>” &nbsp; ③{" "}
              <strong style={{ color: "var(--danger)" }}>低糖燕麦</strong> 类目同质化严重，差异度需从 65 提至 80 &nbsp; ④ 视频号{" "}
              <strong style={{ color: "var(--fg-0)" }}>父女视角</strong> 比夫妻视角 GMV 高 2.4 倍
            </div>
          </div>
          <Button variant="accent" size="md">
            <Check size={13} /> 确认应用
          </Button>
        </div>
      </Card>
    </div>
  );
}

function BigKpi({ label, value, sub, tone, trend }: { label: string; value: string; sub: string; tone: string; trend: number[] }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <Eyebrow>{label}</Eyebrow>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 28,
              fontWeight: 700,
              color: tone,
              fontVariantNumeric: "tabular-nums",
              marginTop: 6,
              letterSpacing: "-0.02em",
            }}
          >
            {value}
          </div>
          <div style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 2 }}>{sub}</div>
        </div>
        <div style={{ width: 80 }}>
          <Spark data={trend} color={tone === "var(--accent)" ? "#7c5cff" : tone === "var(--warning)" ? "#f0a83a" : "#22b59a"} filled height={36} />
        </div>
      </div>
    </Card>
  );
}
