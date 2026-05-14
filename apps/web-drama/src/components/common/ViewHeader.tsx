"use client";

import * as React from "react";

interface Props {
  eyebrow: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}

/**
 * 工作台页面头部：eyebrow + 巨大标题 + 元信息 + 右侧操作槽。
 * 标题里若需要 italic + serif + 金色渐变，由调用方包 <span class="text-gradient-gold"> 自行控制。
 */
export function ViewHeader({ eyebrow, title, meta, action }: Props) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 24,
        marginBottom: 4,
      }}
    >
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1
          style={{
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: "var(--tracking-tight)",
            fontFamily: "var(--font-display)",
            margin: "10px 0 8px",
            lineHeight: 1.05,
          }}
        >
          {title}
        </h1>
        {meta && <div style={{ fontSize: 13.5, color: "var(--fg-2)" }}>{meta}</div>}
      </div>
      {action && <div style={{ display: "flex", gap: 10 }}>{action}</div>}
    </div>
  );
}

interface SectionHeaderProps {
  eyebrow: string;
  title: React.ReactNode;
  right?: React.ReactNode;
}

export function SectionHeader({ eyebrow, title, right }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 18,
      }}
    >
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <div
          style={{
            fontSize: 17,
            fontWeight: 600,
            fontFamily: "var(--font-display)",
            marginTop: 6,
          }}
        >
          {title}
        </div>
      </div>
      {right}
    </div>
  );
}
