"use client";

interface Props {
  label: string;
  value: number;
  tone?: "accent" | "success" | "warning" | "danger" | "info";
  hint?: string;
}

const toneVar = {
  accent: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
};

export function Meter({ label, value, tone = "accent", hint }: Props) {
  const color = toneVar[tone];
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 13, color: "var(--fg-1)", letterSpacing: -0.1 }}>{label}</div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--fg-0)",
            fontWeight: 500,
          }}
        >
          {value}%
        </div>
      </div>
      <div
        style={{
          height: 6,
          background: "rgba(255,255,255,0.05)",
          borderRadius: "var(--radius-pill)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.min(100, Math.max(0, value))}%`,
            height: "100%",
            background: color,
            boxShadow: `0 0 14px ${color}`,
            transition: "width 360ms ease",
          }}
        />
      </div>
      {hint && (
        <div
          style={{
            fontSize: 11,
            color: "var(--fg-3)",
            marginTop: 6,
            fontFamily: "var(--font-mono)",
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
