import { Card } from "./Card";

interface Props {
  label: string;
  value: string;
  delta?: string;
  spark?: number[];
  tone?: "accent" | "info" | "success" | "warning" | "danger";
}

const toneVar = {
  accent: "var(--accent)",
  info: "var(--info)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

export function KpiCard({ label, value, delta, spark, tone = "accent" }: Props) {
  const color = toneVar[tone];
  return (
    <Card style={{ padding: "14px 16px" }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: 1.2,
          color: "var(--fg-2)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginTop: 8,
        }}
      >
        <div
          style={{
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: "var(--tracking-tight)",
            fontFamily: "var(--font-display)",
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
            color: "var(--fg-2)",
            marginTop: 6,
            fontFamily: "var(--font-mono)",
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
    <svg width="64" height="28" viewBox="0 0 64 28">
      <polyline
        points={data
          .map((v, j) => `${j * (64 / (data.length - 1))},${28 - (v / max) * 24}`)
          .join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
    </svg>
  );
}
