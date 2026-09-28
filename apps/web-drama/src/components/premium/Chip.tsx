"use client";

import { ReactNode } from "react";

type Tone = "accent" | "success" | "warning" | "danger" | "info" | "violet" | "neutral";

const toneVar: Record<Tone, string> = {
  accent: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
  violet: "var(--extra-violet)",
  neutral: "var(--fg-2)",
};

export function Chip({
  tone = "accent",
  solid = false,
  children,
}: {
  tone?: Tone;
  /** 压在图片 / 视频上时用：深色实底 + 白字，否则半透明色字在深色画面上看不清 */
  solid?: boolean;
  children: ReactNode;
}) {
  const color = toneVar[tone];
  if (solid) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 10px",
          borderRadius: "var(--radius-pill)",
          fontSize: 11.5,
          fontWeight: 600,
          fontFamily: "var(--font)",
          color: "#fff",
          background: "rgba(0,0,0,.55)",
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 55%, transparent)`,
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
        padding: "3px 10px",
        borderRadius: "var(--radius-pill)",
        fontSize: 10.5,
        fontFamily: "var(--font-mono)",
        letterSpacing: 0.6,
        color,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
