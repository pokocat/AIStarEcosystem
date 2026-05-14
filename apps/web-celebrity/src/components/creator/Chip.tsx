"use client";

// 参考图 Persona tag + Table status chip：sans 字体、pill 圆角、浅色填充、彩色字。
// 8 类业务色 + 4 类状态色。

import { ReactNode } from "react";

type Tone =
  | "accent"           // 紫罗兰
  | "success"          // 青绿
  | "warning"          // 琥珀
  | "danger"           // 玫红
  | "info"             // 青绿（同 success）
  | "neutral"          // 灰
  | "romance"          // 粉
  | "slice"            // 琥珀
  | "comedy"           // 青
  | "drama"            // 紫
  | "filming"          // 琥珀
  | "rendering"        // 紫
  | "scripting"        // 桃
  | "editing"          // 青
  | "published"        // 绿
  | "draft"            // 灰
  | "archived";        // 灰

const toneVar: Record<Tone, string> = {
  accent: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
  neutral: "var(--fg-2)",
  romance: "var(--tag-romance)",
  slice: "var(--tag-slice)",
  comedy: "var(--tag-comedy)",
  drama: "var(--tag-drama)",
  filming: "var(--extra-amber)",
  rendering: "var(--accent)",
  scripting: "var(--extra-peach)",
  editing: "var(--extra-teal)",
  published: "var(--success)",
  draft: "var(--fg-3)",
  archived: "var(--fg-3)",
};

export function Chip({
  tone = "accent",
  children,
  size = "md",
}: {
  tone?: Tone;
  children: ReactNode;
  size?: "sm" | "md";
}) {
  const color = toneVar[tone];
  const pad = size === "sm" ? "2px 9px" : "3px 11px";
  const fs = size === "sm" ? 10.5 : 11.5;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: pad,
        borderRadius: "var(--radius-pill)",
        fontSize: fs,
        fontFamily: "var(--font-sans)",
        fontWeight: 500,
        letterSpacing: 0.1,
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
