"use client";

interface Props {
  label: string;
  value: number; // 0..100
  tone?: "accent" | "success" | "warning" | "danger" | "info";
}

const toneVar = {
  accent: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
};

export function Meter({ label, value, tone = "accent" }: Props) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11.5,
          fontFamily: "var(--font-mono)",
          color: "var(--fg-2)",
          marginBottom: 5,
        }}
      >
        <span>{label}</span>
        <span style={{ color: "var(--fg-0)" }}>{value}%</span>
      </div>
      <div
        style={{
          height: 4,
          background: "var(--bg-2)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.min(100, Math.max(0, value))}%`,
            height: "100%",
            background: toneVar[tone],
            transition: "width 240ms ease",
          }}
        />
      </div>
    </div>
  );
}
