"use client";

// 参考图 Sidebar：220px 白底；紫色"iP"方块品牌 mark；分组 WORKSPACE / PRODUCTION / INSIGHTS；
// active item：浅紫底 + 紫字 + 紫 icon + **左侧 3px 紫色 indicator bar**；
// hover item：sand 米色底 + 主文字色 + 平滑过渡 120ms；
// 可选 badge（红圆数字角标，例 Scenes [4]）。

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
  /** 二级菜单。父项 selected 时自动展开。 */
  children?: NavSubItem[];
}

export interface NavSubItem {
  label: string;
  href: string;
  selected?: boolean;
  badge?: number | string;
  badgeTone?: "danger" | "accent" | "neutral";
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

interface Props {
  brand: { initials: string; name: string; meta?: string; logoSrc?: string };
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
        {brand.logoSrc ? (
          <img
            src={brand.logoSrc}
            alt=""
            style={{ width: 28, height: 28, borderRadius: "var(--radius-md)", flex: "none" }}
          />
        ) : (
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
        )}
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
            {g.items.map((it, i) => (
              <React.Fragment key={i}>
                <SidebarLink item={it} />
                {it.children && it.children.length > 0 && (it.selected || it.children.some((c) => c.selected)) && (
                  <div style={{ marginLeft: 26, marginTop: 2, marginBottom: 4, borderLeft: "1px solid var(--line)", paddingLeft: 8 }}>
                    {it.children.map((sub, j) => (
                      <SidebarSubLink key={j} item={sub} />
                    ))}
                  </div>
                )}
              </React.Fragment>
            ))}
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

function SidebarLink({ item }: { item: NavItem }) {
  const [hover, setHover] = React.useState(false);
  const Icon = item.icon;
  const active = !!item.selected;

  // active = 紫色实心填充 + 白字 + 白 icon + 紫色光晕（确保紫底白字对比明确）
  // hover (非 active) = sand 米底 + fg-0 主文字色，平滑过渡

  return (
    <Link
      href={item.href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: "var(--radius-md)",
        background: active
          ? "var(--accent)"
          : hover
            ? "var(--bg-2)"
            : "transparent",
        color: active
          ? "#ffffff"
          : hover
            ? "var(--fg-0)"
            : "var(--fg-1)",
        fontSize: 13,
        marginBottom: 2,
        textDecoration: "none",
        fontWeight: active ? 600 : 500,
        boxShadow: active
          ? "0 2px 10px color-mix(in srgb, var(--accent) 35%, transparent)"
          : "none",
        transition:
          "background 140ms ease, color 140ms ease, box-shadow 140ms ease",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 14,
          color: active
            ? "#ffffff"
            : hover
              ? "var(--fg-1)"
              : "var(--fg-3)",
          flexShrink: 0,
          transition: "color 140ms ease",
        }}
      >
        <Icon size={14} strokeWidth={active ? 2.4 : 2} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
      {item.badge != null && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 18,
            height: 18,
            padding: "0 6px",
            background: active
              ? "rgba(255,255,255,0.22)"
              : BADGE_COLOR[item.badgeTone ?? "danger"],
            color: "#ffffff",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            borderRadius: "var(--radius-pill)",
            lineHeight: 1,
            boxShadow: active ? "none" : "0 1px 2px rgba(0,0,0,0.1)",
          }}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}

// 二级菜单:不带 icon、字号略小、active 用细紫色左 indicator + 紫字(不抢父项 fill 强度)
function SidebarSubLink({ item }: { item: NavSubItem }) {
  const [hover, setHover] = React.useState(false);
  const active = !!item.selected;
  return (
    <Link
      href={item.href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px 6px 12px",
        borderRadius: "var(--radius-md)",
        background: active
          ? "color-mix(in srgb, var(--accent) 12%, transparent)"
          : hover
            ? "var(--bg-2)"
            : "transparent",
        color: active ? "var(--accent-strong)" : hover ? "var(--fg-0)" : "var(--fg-2)",
        fontSize: 12.5,
        marginBottom: 1,
        textDecoration: "none",
        fontWeight: active ? 600 : 500,
        transition: "background 140ms ease, color 140ms ease",
      }}
    >
      {/* 左侧细紫色指示条 (只在 active 时显示) */}
      {active && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: -9,
            top: 6,
            bottom: 6,
            width: 2,
            background: "var(--accent)",
            borderRadius: 1,
          }}
        />
      )}
      <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
      {item.badge != null && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 16,
            height: 16,
            padding: "0 5px",
            background: BADGE_COLOR[item.badgeTone ?? "accent"],
            color: "#ffffff",
            fontSize: 9.5,
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            borderRadius: "var(--radius-pill)",
            lineHeight: 1,
          }}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}
