"use client";

// 参考图 KPI cards：可选渐变背景（每张不同颜色），数值大 + delta meta。

import { Card } from "./Card";

interface Props {
  label: string;
  value: string;
  delta?: string;
  spark?: number[];
  tone?: "accent" | "info" | "success" | "warning" | "danger";
  /** 用渐变背景做炫色 KPI 卡（仿参考图右上角的彩色 KPI 集） */
  gradient?: "violet" | "peach" | "rose" | "teal" | "lime" | "amber" | "sunset" | "aurora";
}

const toneVar = {
  accent: "var(--accent)",
  info: "var(--info)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

export function KpiCard({ label, value, delta, spark, tone = "accent", gradient }: Props) {
  const onLight = gradient !== undefined;
  return (
    <Card
      style={{
        padding: "18px 20px",
        background: onLight ? `var(--gradient-${gradient})` : "var(--bg-1)",
        border: onLight ? "none" : "1px solid var(--line)",
        boxShadow: "var(--shadow-soft)",
        color: onLight ? "#ffffff" : "var(--fg-0)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {onLight && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at 80% 0%, rgba(255,255,255,0.25), transparent 60%)",
            pointerEvents: "none",
          }}
        />
      )}
      <div style={{ position: "relative" }}>
        <div
          className="eyebrow"
          style={{ color: onLight ? "rgba(255,255,255,0.85)" : "var(--fg-2)" }}
        >
          {label}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: 10,
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: "var(--tracking-tight)",
              fontFamily: "var(--font-display)",
              color: onLight ? "#ffffff" : "var(--fg-0)",
              lineHeight: 1,
            }}
          >
            {value}
          </div>
          {spark && <Sparkline data={spark} color={onLight ? "rgba(255,255,255,0.85)" : toneVar[tone]} />}
        </div>
        {delta && (
          <div
            style={{
              fontSize: 11.5,
              color: onLight ? "rgba(255,255,255,0.85)" : "var(--fg-2)",
              marginTop: 8,
              fontFamily: "var(--font-mono)",
              letterSpacing: 0.2,
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
