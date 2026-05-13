"use client";

import { ReactNode } from "react";

type Tone =
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "peach"
  | "lime"
  | "neutral";

const toneVar: Record<Tone, string> = {
  accent: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
  peach: "var(--extra-peach)",
  lime: "var(--extra-lime)",
  neutral: "var(--fg-2)",
};

export function Chip({
  tone = "accent",
  children,
  solid,
}: {
  tone?: Tone;
  children: ReactNode;
  /** 实心紫色按钮风（用于强 CTA chip） */
  solid?: boolean;
}) {
  const color = toneVar[tone];
  if (solid) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 12px",
          borderRadius: "var(--radius-pill)",
          fontSize: 11,
          fontFamily: "var(--font-sans)",
          fontWeight: 600,
          letterSpacing: 0.2,
          color: "#ffffff",
          background: color,
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 11px",
        borderRadius: "var(--radius-pill)",
        fontSize: 11,
        fontFamily: "var(--font-sans)",
        fontWeight: 500,
        letterSpacing: 0.2,
        color,
        border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
