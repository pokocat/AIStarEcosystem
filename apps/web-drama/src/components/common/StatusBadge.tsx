"use client";

import * as React from "react";

export type StatusTone =
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "violet"
  | "neutral";

const TONE: Record<StatusTone, { bg: string; fg: string; border: string }> = {
  accent: { bg: "rgba(212,175,106,0.14)", fg: "var(--accent)", border: "rgba(212,175,106,0.32)" },
  success: { bg: "rgba(76,224,160,0.14)", fg: "var(--success)", border: "rgba(76,224,160,0.32)" },
  warning: { bg: "rgba(212,175,106,0.10)", fg: "var(--warning)", border: "rgba(212,175,106,0.26)" },
  danger: { bg: "rgba(255,61,138,0.14)", fg: "var(--danger)", border: "rgba(255,61,138,0.34)" },
  info: { bg: "rgba(61,224,255,0.14)", fg: "var(--info)", border: "rgba(61,224,255,0.32)" },
  violet: { bg: "rgba(164,76,255,0.16)", fg: "var(--extra-violet)", border: "rgba(164,76,255,0.32)" },
  neutral: { bg: "rgba(255,255,255,0.04)", fg: "var(--fg-1)", border: "var(--line-2)" },
};

interface Props {
  tone?: StatusTone;
  dot?: boolean;
  children: React.ReactNode;
}

export function StatusBadge({ tone = "neutral", dot = true, children }: Props) {
  const t = TONE[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: "var(--radius-pill)",
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.border}`,
        fontSize: 11,
        fontWeight: 500,
        fontFamily: "var(--font-sans)",
        letterSpacing: 0.2,
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: t.fg,
            opacity: 0.85,
          }}
        />
      )}
      {children}
    </span>
  );
}
