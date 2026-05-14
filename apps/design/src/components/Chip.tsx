import { ReactNode } from "react";

type Tone = "accent" | "success" | "warning" | "danger" | "info" | "neutral";

const toneVar: Record<Tone, string> = {
  accent: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
  neutral: "var(--fg-2)",
};

export function Chip({
  tone = "accent",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  const color = toneVar[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        borderRadius: "var(--radius-sm)",
        fontSize: 10.5,
        fontFamily: "var(--font-mono)",
        letterSpacing: 0.5,
        color,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}
