"use client";

import { Card } from "./Card";

interface Props {
  label: string;
  value: string;
  delta?: string;
  spark?: number[];
  tone?: "accent" | "info" | "success" | "warning" | "danger" | "peach" | "lime";
}

const toneVar = {
  accent: "var(--accent)",
  info: "var(--info)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  peach: "var(--extra-peach)",
  lime: "var(--extra-lime)",
};

export function KpiCard({ label, value, delta, spark, tone = "accent" }: Props) {
  const color = toneVar[tone];
  return (
    <Card elevated style={{ padding: "20px 22px" }}>
      <div className="creator-eyebrow">{label}</div>
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
            color: "var(--fg-0)",
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
            fontSize: 12,
            color,
            marginTop: 10,
            fontFamily: "var(--font-mono)",
            letterSpacing: 0.3,
            fontWeight: 500,
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
    <svg width="80" height="32" viewBox="0 0 80 32" style={{ flexShrink: 0 }}>
      <polyline
        points={data
          .map((v, j) => `${j * (80 / (data.length - 1))},${32 - (v / max) * 26 - 2}`)
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
