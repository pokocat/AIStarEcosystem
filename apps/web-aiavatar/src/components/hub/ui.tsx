"use client";
// ============================================================
// 中枢新界面（P1）· JSX 基础组件
// 设计语言与 src/proto 同源：globals.css V4 令牌（白纸面 + 青 #12B3DE），
// 衬线资产名（--font-serif）+ 等宽登记号（--font-mono）。
// 与 proto/ui.tsx 的区别：JSX 写法、明确 props 类型、无手机壳/微信 chrome。
// ============================================================
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type CSS = React.CSSProperties;

// ── 页面骨架 ─────────────────────────────────────────────────

/** 移动端内容列：窄屏铺满，桌面居中一列（同 .app-root 的宽度约定，但走文档流）。 */
export function HubScreen({ children, tabBar }: { children: React.ReactNode; tabBar?: boolean }) {
  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "100dvh",
        background: "var(--canvas)",
        display: "flex",
        flexDirection: "column",
        paddingBottom: tabBar ? "calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 12px)" : 24,
      }}
    >
      {children}
      {tabBar && <HubTabBar />}
    </div>
  );
}

export function NavBar({
  title,
  back,
  right,
  serifBrand,
}: {
  title?: string;
  back?: string;
  right?: React.ReactNode;
  serifBrand?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {back && (
          <Link href={back} aria-label="返回" style={iconBtnStyle}>
            <Chevron dir="left" />
          </Link>
        )}
        {title && (
          <span
            style={{
              fontFamily: serifBrand ? "var(--font-serif)" : "var(--font-disp)",
              fontSize: serifBrand ? 21 : 20,
              fontWeight: serifBrand ? 600 : 800,
              letterSpacing: serifBrand ? ".01em" : "-.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </span>
        )}
      </div>
      {right && <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

const iconBtnStyle: CSS = {
  width: 36,
  height: 36,
  borderRadius: 999,
  background: "var(--surface)",
  border: "1px solid var(--line)",
  display: "grid",
  placeItems: "center",
  color: "var(--ink-2)",
  cursor: "pointer",
  textDecoration: "none",
  flexShrink: 0,
};

// ── 底部 Tab ─────────────────────────────────────────────────

// 复用老版 5 tab 的视觉（.wx-tabbar / .wx-tab / .wx-fab，含中间凸起创建键）。
// 落点 = 2026-09-01 定案的完整 5 Tab；/studio 内嵌时隐藏其自带 tab 栏。
//
// replace 而非 push：Tab 之间切换不进历史栈，返回键因此不会在 Tab 间来回走
// （旧版从任一 Tab 返回都退回「我的」就是 push 造成的）。二级页仍用 push。
const TABS = [
  { href: "/", label: "首页", icon: HomeIcon, match: (p: string) => p === "/" },
  { href: "/discover", label: "发现", icon: CompassIcon, match: (p: string) => p.startsWith("/discover") || p.startsWith("/market") || p.startsWith("/stars") },
  { fab: true as const, href: "/create", label: "创作" },
  { href: "/assets", label: "资产", icon: LayersIcon, match: (p: string) => p.startsWith("/assets") },
  { href: "/me", label: "我的", icon: UserIcon, match: (p: string) => p.startsWith("/me") || p.startsWith("/licenses") },
];

export function HubTabBar() {
  const pathname = usePathname() || "/";
  const createOn = pathname.startsWith("/create") || pathname.startsWith("/studio");
  return (
    <nav className="wx-tabbar hub-tabbar">
      {TABS.map((t) =>
        "fab" in t ? (
          <div key="create" className="wx-fab-slot">
            <Link className={"wx-fab" + (createOn ? " on" : "")} href={t.href} replace aria-label="创作">
              <span className="fab-visual" aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="fab-art" src="/generated/create-entry/fab-create.jpg" alt="" draggable={false} loading="lazy" decoding="async" />
                <span className="fab-veil" />
              </span>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="fab-lbl">{t.label}</span>
            </Link>
          </div>
        ) : (
          <Link key={t.href} href={t.href} replace className={"wx-tab" + (t.match(pathname) ? " on" : "")}>
            {t.icon({ strong: t.match(pathname) })}
            <span className="lbl">{t.label}</span>
          </Link>
        ),
      )}
    </nav>
  );
}

// ── 卡片 / 徽章 / 分区 ────────────────────────────────────────

export function Card({
  children,
  pad = 14,
  radius = 17,
  style,
  onClick,
}: {
  children: React.ReactNode;
  pad?: number;
  radius?: number;
  style?: CSS;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: radius,
        padding: pad,
        boxShadow: "var(--sh-1)",
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export type BadgeTone = "ok" | "warn" | "err" | "info" | "primary" | "mute";

const BADGE_TONES: Record<BadgeTone, { bg: string; c: string }> = {
  ok: { bg: "var(--ok-s)", c: "var(--ok)" },
  warn: { bg: "var(--warn-s)", c: "var(--warn)" },
  err: { bg: "var(--err-s)", c: "var(--err)" },
  info: { bg: "var(--info-s)", c: "var(--info)" },
  primary: { bg: "var(--primary-soft)", c: "var(--primary-700)" },
  mute: { bg: "var(--surface-3)", c: "var(--ink-2)" },
};

export function Badge({
  tone = "mute",
  dot,
  children,
  style,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  children: React.ReactNode;
  style?: CSS;
}) {
  const m = BADGE_TONES[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 22,
        padding: "0 9px",
        background: m.bg,
        color: m.c,
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        ...style,
      }}
    >
      {dot && <span style={{ width: 5, height: 5, borderRadius: 99, background: m.c, flexShrink: 0 }} />}
      {children}
    </span>
  );
}

export function SectionHeader({
  title,
  hint,
  count,
  action,
}: {
  title: string;
  hint?: string;
  count?: number | string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "0 0 10px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 800, whiteSpace: "nowrap" }}>{title}</span>
        {count != null && (
          <span
            className="mono"
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "1px 7px",
              borderRadius: 999,
              background: "var(--surface-3)",
              color: "var(--ink-3)",
            }}
          >
            {count}
          </span>
        )}
        {hint && (
          <span style={{ fontSize: 11, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {hint}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}

export function LinkAction({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ fontSize: 12, fontWeight: 700, color: "var(--primary-700)", textDecoration: "none", flexShrink: 0 }}>
      {children}
    </Link>
  );
}

// ── 资产身份原语 ─────────────────────────────────────────────

/** 等宽登记号（DH-2044 · V3 这类）。变长内容截断显示，完整值放 title。 */
export function RegNo({ children, size = 10 }: { children: React.ReactNode; size?: number }) {
  const full = typeof children === "string" ? children : undefined;
  return (
    <span
      className="mono"
      title={full}
      style={{
        fontSize: size,
        color: "var(--ink-4)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        minWidth: 0,
        flexShrink: 1,
      }}
    >
      {children}
    </span>
  );
}

/** 资产肖像：有图用图，无图用色相渐变 + 衬线首字（与 proto Portrait 同语义的轻量版）。 */
export function AssetPortrait({
  name,
  imageUrl,
  hue = 200,
  width = 62,
  height = 78,
  radius = 13,
  fontSize = 26,
}: {
  name: string;
  imageUrl?: string | null;
  hue?: number;
  width?: number;
  height?: number;
  radius?: number;
  fontSize?: number;
}) {
  const initial = (name || "").trim().slice(0, 1) || "?";
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        overflow: "hidden",
        flexShrink: 0,
        background: `linear-gradient(160deg, hsl(${hue} 55% 82%), hsl(${hue} 48% 66%))`,
        display: "grid",
        placeItems: "center",
      }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <span style={{ fontFamily: "var(--font-serif)", fontSize, fontWeight: 600, color: "#fff" }}>{initial}</span>
      )}
    </div>
  );
}

// ── 列表行 / 状态 ────────────────────────────────────────────

export function ListRow({
  leading,
  title,
  sub,
  trailing,
  href,
  onClick,
  divider,
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  divider?: boolean;
}) {
  const body = (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "13px 14px",
        borderBottom: divider ? "1px solid var(--line)" : "none",
        cursor: href || onClick ? "pointer" : undefined,
        color: "inherit",
        textDecoration: "none",
      }}
    >
      {leading}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </div>
        {sub && (
          <div style={{ fontSize: 11.5, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sub}
          </div>
        )}
      </div>
      {trailing != null ? trailing : (href || onClick) && <Chevron />}
    </div>
  );
  if (href) {
    return (
      <Link href={href} style={{ color: "inherit", textDecoration: "none", display: "block" }}>
        {body}
      </Link>
    );
  }
  return body;
}

export function EmptyState({ text, actionHref, actionLabel }: { text: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div style={{ padding: "28px 16px", textAlign: "center", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
      <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{text}</span>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 34,
            padding: "0 16px",
            borderRadius: "var(--r-md)",
            background: "var(--primary-soft)",
            color: "var(--primary-700)",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function LoadingBlock({ label = "加载中" }: { label?: string }) {
  return (
    <div style={{ padding: "40px 16px", display: "flex", justifyContent: "center", alignItems: "center", gap: 10, color: "var(--ink-3)" }}>
      <span
        aria-hidden
        style={{
          width: 16,
          height: 16,
          borderRadius: 999,
          border: "2px solid var(--line-3)",
          borderTopColor: "var(--primary)",
          animation: "hub-spin .8s linear infinite",
        }}
      />
      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</span>
      <style>{`@keyframes hub-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── 图标（内联 SVG，1.8 描边，与 proto 图标风格一致）─────────────

function svgProps(strong?: boolean) {
  return {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: strong ? 2.1 : 1.85,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function HomeIcon({ strong }: { strong?: boolean }) {
  return (
    <svg {...svgProps(strong)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.6V20h13V9.6" />
    </svg>
  );
}

function CompassIcon({ strong }: { strong?: boolean }) {
  return (
    <svg {...svgProps(strong)}>
      <circle cx="12" cy="12" r="9" />
      <polygon points="15.6 8.4 13.4 13.4 8.4 15.6 10.6 10.6 15.6 8.4" />
    </svg>
  );
}

function LayersIcon({ strong }: { strong?: boolean }) {
  return (
    <svg {...svgProps(strong)}>
      <polygon points="12 2 22 8 12 14 2 8 12 2" />
      <polyline points="2 13 12 19 22 13" />
    </svg>
  );
}

function UserIcon({ strong }: { strong?: boolean }) {
  return (
    <svg {...svgProps(strong)}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function Chevron({ dir = "right" }: { dir?: "right" | "left" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ink-4)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...(dir === "left" ? { stroke: "currentColor" } : {}) }}
    >
      {dir === "right" ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
    </svg>
  );
}
