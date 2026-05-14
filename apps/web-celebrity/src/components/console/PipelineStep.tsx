"use client";

// 业务主线 5 步指引卡片 —— 单步组件，带 hover 微浮起 + 顶部 indicator bar 切换效果。
// 抽到独立 client component 让 console/page.tsx 能保持 Server Component（读 searchParams）。

import * as React from "react";
import Link from "next/link";

type Tone = "violet" | "peach" | "rose" | "teal" | "amber";

interface Props {
  n: number;
  title: string;
  desc: string;
  href: string;
  tone: Tone;
  active?: boolean;
  count?: number;
  countLabel?: string;
}

const COLOR_MAP: Record<Tone, string> = {
  violet: "var(--accent)",
  peach: "var(--extra-peach)",
  rose: "var(--extra-rose)",
  teal: "var(--extra-teal)",
  amber: "var(--extra-amber)",
};

export function PipelineStep({
  n,
  title,
  desc,
  href,
  tone,
  active,
  count,
  countLabel,
}: Props) {
  const [hover, setHover] = React.useState(false);
  const color = COLOR_MAP[tone];

  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          position: "relative",
          padding: "16px 16px 14px",
          borderRadius: "var(--radius-md)",
          background: active || hover ? "var(--bg-1)" : "var(--bg-2)",
          border: active
            ? `1px solid color-mix(in srgb, ${color} 50%, transparent)`
            : `1px solid var(--line)`,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: hover || active ? "var(--shadow-soft)" : "none",
          transform: hover ? "translateY(-1px)" : "translateY(0)",
          transition:
            "background 140ms ease, border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease",
        }}
      >
        {/* 顶部 indicator bar：active 全显，hover 半显 */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: color,
            opacity: active ? 1 : hover ? 0.5 : 0,
            transition: "opacity 140ms ease",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: color,
              color: "#ffffff",
              fontSize: 11.5,
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: `0 0 0 4px color-mix(in srgb, ${color} 16%, transparent)`,
            }}
          >
            {n}
          </span>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-0)" }}>
            {title}
          </div>
        </div>
        <div
          style={{ fontSize: 11.5, color: "var(--fg-2)", lineHeight: 1.5, flex: 1 }}
        >
          {desc}
        </div>
        {count != null && count > 0 && (
          <div
            className="mono"
            style={{
              marginTop: 10,
              fontSize: 10.5,
              color,
              letterSpacing: 0.3,
              fontWeight: 600,
            }}
          >
            {count} {countLabel ?? ""}
          </div>
        )}
      </div>
    </Link>
  );
}
