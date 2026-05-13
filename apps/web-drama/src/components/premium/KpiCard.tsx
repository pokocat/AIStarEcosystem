"use client";

import { Card } from "./Card";

interface Props {
  label: string;
  value: string;
  delta?: string;
  spark?: number[];
  tone?: "accent" | "info" | "success" | "warning" | "danger" | "violet";
}

const toneVar = {
  accent: "var(--accent)",
  info: "var(--info)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  violet: "var(--extra-violet)",
};

export function KpiCard({ label, value, delta, spark, tone = "accent" }: Props) {
  const color = toneVar[tone];
  return (
    <Card glass style={{ padding: "18px 20px" }}>
      <div className="eyebrow">{label}</div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginTop: 12,
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: "var(--tracking-tight)",
            fontFamily: "var(--font-display)",
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        {spark && <Sparkline data={spark} color={color} />}
      </div>
      {delta && (
        <div
          style={{
            fontSize: 11,
            color,
            marginTop: 10,
            fontFamily: "var(--font-mono)",
            letterSpacing: 0.4,
          }}
        >
          {delta}
        </div>
      )}
    </Card>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <svg width="72" height="32" viewBox="0 0 72 32" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={`g-${color.replace(/[^a-z]/gi, "")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={data
          .map((v, j) => `${j * (72 / (data.length - 1))},${32 - (v / max) * 26 - 2}`)
          .join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
