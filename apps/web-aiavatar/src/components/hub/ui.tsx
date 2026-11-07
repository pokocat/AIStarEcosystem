"use client";
// ============================================================
// 中枢新界面（P1）· JSX 基础组件
// 设计语言与 src/proto 同源：globals.css V4 令牌（白纸面 + 青 #12B3DE），
// 衬线资产名（--font-serif）+ 等宽登记号（--font-mono）。
// 与 proto/ui.tsx 的区别：JSX 写法、明确 props 类型、无手机壳/微信 chrome。
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, House, Image as ImageIcon, Plus, SquareDashedMousePointer, UserRound, Video, X } from "lucide-react";
import { dialogFocus } from "@/ip/dialog-focus";

type CSS = React.CSSProperties;

// ── 页面骨架 ─────────────────────────────────────────────────

/**
 * 内容列：窄屏铺满，桌面（≥1024）放宽成一整面。
 *
 * 宽度与内边距移到 `.hub-screen`（globals.css v0.190 段）—— 11 个现代路由全部
 * 经过这里，所以那一条 media query 就是整个资产平台桌面化的总开关，不必逐页改。
 * 老 SPA /studio 用的是另一层 `.app-root`（position:fixed + 480px 手机笼子），
 * 不受此影响，按既定双轨逐屏迁出。
 */
export function HubScreen({ children, tabBar, width = "wide", className = "" }: { children: React.ReactNode; tabBar?: boolean; width?: "wide" | "form"; className?: string }) {
  return (
    <div
      className={(width === "form" ? "hub-screen hub-screen--form" : "hub-screen") + (className ? " " + className : "")}
      style={{
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

// replace 而非 push：Tab 之间切换不进历史栈，返回键因此不会在 Tab 间来回走。二级页仍用 push。
/**
 * 手机底栏：场景创作（AI 视频 / AI 图片）放到底栏上，和电脑左栏同一批入口；项目、资产在「我的」里。
 * 样子照设计稿「AI 视频与图片页重设计」的两张手机稿（2026-11-02）：白底细线、细图标，「创作」是栏里的墨色小方块。
 */
const TABS = [
  { href: "/dashboard", label: "首页", icon: House, match: (p: string) => p === "/dashboard" },
  { href: "/video", label: "AI 视频", icon: Video, match: (p: string) => p.startsWith("/video") },
  { create: true as const, href: "/create", label: "创作" },
  { href: "/image", label: "AI 图片", icon: ImageIcon, match: (p: string) => p.startsWith("/image") },
  { href: "/me", label: "我的", icon: UserRound, match: (p: string) => p.startsWith("/me") || p.startsWith("/licenses") || p.startsWith("/projects") || p.startsWith("/assets") || p.startsWith("/director") },
];

/**
 * 「创作」先选做什么，再进去（2026-11-02 用户定）：原来直接进画布，而手机上最常用的是 AI 视频和 AI 图片，画布在手机上最难用。
 */
const CREATE_CHOICES = [
  { href: "/video", label: "AI 视频", sub: "选择场景，编导写好分镜后生成视频", icon: Video, match: (p: string) => p.startsWith("/video") },
  { href: "/image", label: "AI 图片", sub: "选择场景，填写要求后生成图片", icon: ImageIcon, match: (p: string) => p.startsWith("/image") },
  { href: "/create", label: "画布", sub: "素材和结果摆在一起，自由组合", icon: SquareDashedMousePointer, match: (p: string) => p === "/create" },
];

function CreateSheet({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [onClose]);
  // 挂到 body：底栏所在的页面层可能带 transform，fixed 会跟着走样。
  return createPortal(
    <div className="studio-create-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="studio-create-sheet" role="dialog" aria-modal="true" aria-labelledby="studio-create-title" ref={dialogFocus} tabIndex={-1}>
        <header className="studio-create-head">
          <h2 id="studio-create-title">想做点什么？</h2>
          <button type="button" aria-label="关闭" onClick={onClose}><X size={18} strokeWidth={1.6} aria-hidden /></button>
        </header>
        <ul className="studio-create-list">
          {CREATE_CHOICES.map((c) => (
            <li key={c.href}>
              <Link href={c.href} replace className="studio-create-choice" aria-current={c.match(pathname) ? "page" : undefined} onClick={onClose}>
                <span className="studio-create-icon" aria-hidden><c.icon size={20} strokeWidth={1.4} /></span>
                <span className="studio-create-copy"><strong>{c.label}</strong><small>{c.sub}</small></span>
                <ChevronRight size={16} strokeWidth={1.5} aria-hidden className="studio-create-arrow" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

export function HubTabBar() {
  const pathname = usePathname() || "/";
  const createOn = pathname.startsWith("/create") || pathname.startsWith("/studio");
  const [creating, setCreating] = useState(false);
  const close = useCallback(() => setCreating(false), []);
  return (
    <nav className="hub-tabbar studio-tabbar" aria-label="底部导航">
      {TABS.map((t) => {
        if ("create" in t) return <button key={t.href} type="button" className={"studio-tab is-create" + (createOn ? " is-on" : "")} aria-haspopup="dialog" aria-expanded={creating} onClick={() => setCreating(true)}>
          <span className="studio-tab-create" aria-hidden><Plus size={16} strokeWidth={1.8} /></span>
          <span className="lbl">{t.label}</span>
        </button>;
        const on = t.match(pathname);
        return <Link key={t.href} href={t.href} replace className="studio-tab" aria-current={on ? "page" : undefined}>
          <t.icon size={20} strokeWidth={on ? 1.6 : 1.4} aria-hidden />
          <span className="lbl">{t.label}</span>
        </Link>;
      })}
      {creating && <CreateSheet pathname={pathname} onClose={close} />}
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
      className="hub-card"
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
