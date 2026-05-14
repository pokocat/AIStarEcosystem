"use client";

// 参考图 KPI cards 实际是"淡彩底 + 深色数字"对比清晰，不是全饱和渐变 + 白字。
// gradient 传入时：背景用 12% alpha 的淡彩，数字用 fg-0 黑，delta 用对应深色 tone。

import { Card } from "./Card";

type Gradient =
  | "violet"
  | "peach"
  | "rose"
  | "teal"
  | "lime"
  | "amber"
  | "sunset"
  | "aurora";

const GRADIENT_TINT: Record<Gradient, { bg: string; accent: string; delta: string }> = {
  violet: {
    bg: "linear-gradient(135deg, rgba(124,92,255,0.16), rgba(124,92,255,0.06))",
    accent: "#7c5cff",
    delta: "#5b3fe0",
  },
  peach: {
    bg: "linear-gradient(135deg, rgba(255,138,91,0.18), rgba(255,138,91,0.06))",
    accent: "#ff8a5b",
    delta: "#c45c2e",
  },
  rose: {
    bg: "linear-gradient(135deg, rgba(255,91,138,0.16), rgba(255,91,138,0.05))",
    accent: "#ff5b8a",
    delta: "#c43768",
  },
  teal: {
    bg: "linear-gradient(135deg, rgba(34,181,154,0.16), rgba(34,181,154,0.05))",
    accent: "#22b59a",
    delta: "#188a76",
  },
  lime: {
    bg: "linear-gradient(135deg, rgba(196,227,74,0.30), rgba(196,227,74,0.08))",
    accent: "#88a818",
    delta: "#5b7510",
  },
  amber: {
    bg: "linear-gradient(135deg, rgba(240,168,58,0.18), rgba(240,168,58,0.05))",
    accent: "#f0a83a",
    delta: "#b87a18",
  },
  sunset: {
    bg: "linear-gradient(135deg, rgba(255,91,138,0.15), rgba(255,138,91,0.12), rgba(240,168,58,0.10))",
    accent: "#ff5b8a",
    delta: "#c43768",
  },
  aurora: {
    bg: "linear-gradient(135deg, rgba(124,92,255,0.16), rgba(255,91,138,0.12), rgba(34,181,154,0.10))",
    accent: "#7c5cff",
    delta: "#5b3fe0",
  },
};

interface Props {
  label: string;
  value: string;
  delta?: string;
  spark?: number[];
  tone?: "accent" | "info" | "success" | "warning" | "danger";
  gradient?: Gradient;
}

const toneVar = {
  accent: "var(--accent)",
  info: "var(--info)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

export function KpiCard({ label, value, delta, spark, tone = "accent", gradient }: Props) {
  const tint = gradient ? GRADIENT_TINT[gradient] : null;
  return (
    <Card
      style={{
        padding: "18px 20px",
        background: tint ? tint.bg : "var(--bg-1)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-soft)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 右上小色块 indicator（提升彩色 KPI 识别度） */}
      {tint && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 8,
            height: 8,
            borderRadius: 2,
            background: tint.accent,
            boxShadow: `0 0 0 3px color-mix(in srgb, ${tint.accent} 20%, transparent)`,
          }}
        />
      )}
      <div style={{ position: "relative" }}>
        <div className="eyebrow">{label}</div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: 12,
          }}
        >
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "var(--tracking-tight)",
              fontFamily: "var(--font-display)",
              color: "var(--fg-0)",
              lineHeight: 1,
            }}
          >
            {value}
          </div>
          {spark && <Sparkline data={spark} color={tint ? tint.accent : toneVar[tone]} />}
        </div>
        {delta && (
          <div
            style={{
              fontSize: 11.5,
              color: tint ? tint.delta : "var(--fg-2)",
              marginTop: 8,
              fontFamily: "var(--font-mono)",
              letterSpacing: 0.2,
              fontWeight: 500,
            }}
          >
            {delta}
          </div>
        )}
      </div>
    </Card>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <svg width="72" height="32" viewBox="0 0 72 32" style={{ flexShrink: 0 }}>
      <polyline
        points={data
          .map((v, j) => `${j * (72 / (data.length - 1))},${32 - (v / max) * 26 - 2}`)
          .join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
