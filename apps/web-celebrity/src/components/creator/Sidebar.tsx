"use client";

// 参考图 Sidebar：220px 白底；紫色"iP"方块品牌 mark；分组 WORKSPACE / DRAMA / SYSTEM；
// active item bg-3 浅米底 + accent 字 + accent dot 前缀；可选 badge（红点 / 数字）。

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  selected?: boolean;
  /** 右侧 badge：数字或文字 */
  badge?: number | string;
  /** badge 颜色（默认 danger 红） */
  badgeTone?: "danger" | "accent" | "neutral";
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

interface Props {
  brand: { initials: string; name: string; meta?: string };
  groups: NavGroup[];
  footer?: React.ReactNode;
}

const BADGE_COLOR = {
  danger: "var(--danger)",
  accent: "var(--accent)",
  neutral: "var(--fg-3)",
};

export function Sidebar({ brand, groups, footer }: Props) {
  return (
    <aside
      style={{
        background: "var(--bg-1)",
        borderRight: "1px solid var(--line)",
        padding: "18px 0",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        style={{
          padding: "0 18px 18px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            background: "var(--accent)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            fontSize: 12.5,
            color: "#fff",
          }}
        >
          {brand.initials}
        </div>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-0)" }}>
            {brand.name}
          </div>
          {brand.meta && (
            <div
              style={{
                fontSize: 10,
                color: "var(--fg-2)",
                fontFamily: "var(--font-mono)",
                letterSpacing: 0.4,
              }}
            >
              {brand.meta}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "12px 10px", flex: 1, overflowY: "auto" }}>
        {groups.map((g, gi) => (
          <div key={gi}>
            <div
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--fg-3)",
                letterSpacing: 1.5,
                padding: gi === 0 ? "8px 8px 6px" : "16px 8px 6px",
                textTransform: "uppercase",
              }}
            >
              {g.title}
            </div>
            {g.items.map((it, i) => {
              const Icon = it.icon;
              return (
                <Link
                  key={i}
                  href={it.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 10px",
                    borderRadius: "var(--radius-md)",
                    background: it.selected ? "var(--accent-soft)" : "transparent",
                    color: it.selected ? "var(--accent-strong)" : "var(--fg-1)",
                    fontSize: 13,
                    marginBottom: 1,
                    textDecoration: "none",
                    fontWeight: it.selected ? 600 : 500,
                    transition: "background 120ms",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 14,
                      color: it.selected ? "var(--accent)" : "var(--fg-3)",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={14} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>{it.label}</span>
                  {it.badge != null && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 18,
                        height: 18,
                        padding: "0 6px",
                        background: BADGE_COLOR[it.badgeTone ?? "danger"],
                        color: "#ffffff",
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        borderRadius: "var(--radius-pill)",
                        lineHeight: 1,
                      }}
                    >
                      {it.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {footer && (
        <div
          style={{
            padding: "12px 14px",
            borderTop: "1px solid var(--line)",
          }}
        >
          {footer}
        </div>
      )}
    </aside>
  );
}
