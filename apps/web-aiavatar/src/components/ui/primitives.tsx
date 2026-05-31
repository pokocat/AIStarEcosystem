"use client";
// ============================================================
// 共享 UI 基元 — 从原型 app/ui.jsx 1:1 移植为类型化 TSX。
// 设计为内联样式 + CSS 变量（token 不改），与原型视觉完全一致。
// Portrait 在原型「hue 占位」基础上增加真实图片 src 支持（种子真人照片）。
// ============================================================
import * as React from "react";
import { Icons, type IconComponent } from "./icons";
import { TONE, type Tone, statusMeta } from "@/constants/aiavatar-ui";

type CSS = React.CSSProperties;

// ── 按钮 ────────────────────────────────────────────────────────────────────
type BtnVariant = "default" | "pri" | "ghost" | "line" | "signal" | "danger";
type BtnSize = "sm" | "md" | "lg";

export interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: IconComponent;
  iconR?: IconComponent;
  full?: boolean;
}

export function Btn({
  children,
  variant = "default",
  size = "md",
  icon: I,
  iconR: IR,
  full,
  style,
  disabled,
  ...rest
}: BtnProps) {
  const base: CSS = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontFamily: "var(--font-ui)",
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: "var(--r-md)",
    border: "1px solid var(--line-2)",
    background: "var(--bg-2)",
    color: "var(--ink-0)",
    transition: "all .15s",
    whiteSpace: "nowrap",
    width: full ? "100%" : "auto",
    opacity: disabled ? 0.4 : 1,
    pointerEvents: disabled ? "none" : "auto",
  };
  const sizes: Record<BtnSize, CSS> = {
    sm: { padding: "7px 12px", fontSize: 12.5 },
    md: { padding: "10px 16px", fontSize: 13.5 },
    lg: { padding: "13px 22px", fontSize: 15 },
  };
  const variants: Record<BtnVariant, CSS> = {
    default: {},
    pri: { background: "var(--accent)", color: "#1a1205", borderColor: "transparent", boxShadow: "var(--glow-accent)", fontWeight: 600 },
    ghost: { background: "transparent", borderColor: "transparent", color: "var(--ink-1)" },
    line: { background: "transparent" },
    signal: { background: "var(--signal-soft)", color: "var(--signal)", borderColor: "var(--signal-line)" },
    danger: { background: "var(--err-soft)", color: "var(--err)", borderColor: "rgba(240,107,107,0.3)" },
  };
  const sz = sizes[size];
  const iconSize = (sz.fontSize as number) + 3;
  return (
    <button
      {...rest}
      disabled={disabled}
      style={{ ...base, ...sz, ...variants[variant], ...style }}
      onMouseEnter={(e) => {
        if (disabled) return;
        if (variant === "default" || variant === "line") e.currentTarget.style.borderColor = "var(--line-3)";
        if (variant === "ghost") e.currentTarget.style.background = "var(--bg-2)";
        if (variant === "pri") e.currentTarget.style.filter = "brightness(1.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = (variants[variant].borderColor as string) || "var(--line-2)";
        if (variant === "ghost") e.currentTarget.style.background = "transparent";
        if (variant === "pri") e.currentTarget.style.filter = "none";
      }}
    >
      {I && <I size={iconSize} />}
      {children}
      {IR && <IR size={iconSize} />}
    </button>
  );
}

// ── 图标按钮 ──────────────────────────────────────────────────────────────────
export interface IconBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconComponent;
  size?: number;
  active?: boolean;
}
export function IconBtn({ icon: I, size = 36, active, style, ...rest }: IconBtnProps) {
  return (
    <button
      {...rest}
      style={{
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        borderRadius: "var(--r-md)",
        cursor: "pointer",
        transition: "all .15s",
        border: "1px solid " + (active ? "var(--accent-line)" : "var(--line-2)"),
        background: active ? "var(--accent-soft)" : "var(--bg-2)",
        color: active ? "var(--accent-hi)" : "var(--ink-1)",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = "var(--line-3)";
          e.currentTarget.style.color = "var(--ink-0)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = "var(--line-2)";
          e.currentTarget.style.color = "var(--ink-1)";
        }
      }}
    >
      <I size={Math.round(size * 0.46)} />
    </button>
  );
}

// ── 状态药丸 ──────────────────────────────────────────────────────────────────
export function StatusPill({
  status,
  label,
  tone,
  pulse,
}: {
  status?: string;
  label?: string;
  tone?: Tone;
  pulse?: boolean;
}) {
  const m = status ? statusMeta(status) : { label: label ?? "", tone: tone ?? "mute" };
  const t = TONE[tone ?? m.tone];
  const animate = m.tone === "signal" || pulse;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        padding: "4px 9px",
        borderRadius: 999,
        color: t.c,
        border: "1px solid " + t.b,
        background: t.bg,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: t.c, color: t.c, animation: animate ? "pulse 1.6s infinite" : "none" }} />
      {label ?? m.label}
    </span>
  );
}

// ── 标签 ──────────────────────────────────────────────────────────────────────
export function Tag({ children, on }: { children: React.ReactNode; on?: boolean }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        padding: "3px 8px",
        borderRadius: 4,
        letterSpacing: "0.04em",
        border: "1px solid " + (on ? "var(--accent-line)" : "var(--line-2)"),
        color: on ? "var(--accent-hi)" : "var(--ink-1)",
        background: on ? "var(--accent-soft)" : "transparent",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

// ── 形象图（hue 着色占位 / 真实图片 · 角标 · 选中） ───────────────────────────────
export interface PortraitProps {
  hue?: number;
  /** 真实图片 URL（种子真人照片 / 生成产物）。给定时覆盖 hue 占位。 */
  src?: string | null;
  label?: React.ReactNode;
  sub?: React.ReactNode;
  ratio?: string;
  selected?: boolean;
  dim?: boolean;
  badge?: React.ReactNode;
  onClick?: () => void;
  style?: CSS;
  /** 真实图片的 object-fit（默认 cover）。 */
  fit?: "cover" | "contain";
}

export function Portrait({
  hue = 28,
  src,
  label = "形象图",
  sub,
  ratio = "3 / 4",
  selected,
  dim,
  badge,
  onClick,
  style,
  fit = "cover",
}: PortraitProps) {
  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        aspectRatio: ratio,
        borderRadius: "var(--r-md)",
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        transition: "all .18s",
        border: "1px solid " + (selected ? "var(--accent)" : "var(--line)"),
        boxShadow: selected ? "var(--glow-accent)" : "none",
        background: src
          ? "var(--bg-2)"
          : `linear-gradient(155deg, oklch(0.32 0.07 ${hue}) 0%, oklch(0.18 0.04 ${hue}) 55%, var(--bg-2) 100%)`,
        ...style,
      }}
    >
      {src ? (
        // 真实图片
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={typeof label === "string" ? label : "形象图"} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: fit, display: "block" }} />
      ) : (
        <>
          {/* 条纹 */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(-45deg, rgba(255,255,255,0.03) 0 10px, transparent 10px 20px)" }} />
          {/* 头肩暗示 */}
          <div style={{ position: "absolute", left: "50%", top: "32%", transform: "translateX(-50%)", width: "34%", aspectRatio: "1", borderRadius: 999, background: `oklch(0.42 0.06 ${hue} / 0.5)`, border: `1px solid oklch(0.6 0.08 ${hue} / 0.4)` }} />
          <div style={{ position: "absolute", left: "50%", bottom: "-6%", transform: "translateX(-50%)", width: "62%", aspectRatio: "1.6", borderRadius: "50% 50% 0 0", background: `oklch(0.4 0.05 ${hue} / 0.45)` }} />
        </>
      )}
      {dim && <div style={{ position: "absolute", inset: 0, background: "rgba(10,11,14,0.55)" }} />}
      {/* 角标 */}
      {(["tl", "tr", "bl", "br"] as const).map((c) => (
        <span
          key={c}
          style={{
            position: "absolute",
            width: 12,
            height: 12,
            [c[0] === "t" ? "top" : "bottom"]: 8,
            [c[1] === "l" ? "left" : "right"]: 8,
            borderTop: c[0] === "t" ? "1.5px solid var(--line-3)" : undefined,
            borderBottom: c[0] === "b" ? "1.5px solid var(--line-3)" : undefined,
            borderLeft: c[1] === "l" ? "1.5px solid var(--line-3)" : undefined,
            borderRight: c[1] === "r" ? "1.5px solid var(--line-3)" : undefined,
            opacity: 0.6,
          }}
        />
      ))}
      {/* 标签 */}
      {(label || sub) && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 10, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "rgba(255,255,255,0.62)", letterSpacing: "0.06em", textShadow: src ? "0 1px 6px rgba(0,0,0,0.7)" : undefined }}>
          {label}
          {sub && <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.42)", marginTop: 2 }}>{sub}</div>}
        </div>
      )}
      {/* 选中勾 */}
      {selected && (
        <div style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: 999, background: "var(--accent)", color: "#1a1205", display: "grid", placeItems: "center", boxShadow: "var(--shadow-2)" }}>
          <Icons.check size={13} stroke={2.6} />
        </div>
      )}
      {badge && <div style={{ position: "absolute", top: 8, left: 8 }}>{badge}</div>}
    </div>
  );
}

// ── 进度条 ────────────────────────────────────────────────────────────────────
export function Progress({ pct = 0, tone = "signal", height = 4 }: { pct?: number; tone?: Tone; height?: number }) {
  const t = TONE[tone];
  return (
    <div style={{ height, borderRadius: 999, background: "var(--bg-3)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: Math.max(0, Math.min(100, pct)) + "%", borderRadius: 999, background: t.c, transition: "width .4s", boxShadow: "0 0 8px " + t.c }} />
    </div>
  );
}

// ── 分段控件 ──────────────────────────────────────────────────────────────────
export interface SegOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: IconComponent;
}
export function Seg<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "6px 10px" : "8px 14px";
  const fs = size === "sm" ? 12 : 13;
  return (
    <div style={{ display: "inline-flex", padding: 3, gap: 2, background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}>
      {options.map((o) => {
        const active = o.value === value;
        const Ic = o.icon;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: pad,
              fontSize: fs,
              fontFamily: "var(--font-ui)",
              fontWeight: 500,
              cursor: "pointer",
              borderRadius: 7,
              border: "none",
              transition: "all .15s",
              whiteSpace: "nowrap",
              background: active ? "var(--bg-3)" : "transparent",
              color: active ? "var(--ink-0)" : "var(--ink-2)",
              boxShadow: active ? "var(--shadow-1)" : "none",
            }}
          >
            {Ic && <Ic size={fs + 2} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── 面板 ──────────────────────────────────────────────────────────────────────
export function Panel({
  title,
  right,
  children,
  pad = 20,
  style,
}: {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  pad?: number;
  style?: CSS;
}) {
  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden", ...style }}>
      {title && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.02em" }}>{title}</div>
          {right}
        </div>
      )}
      <div style={{ padding: pad }}>{children}</div>
    </div>
  );
}

// ── 作者头像 ──────────────────────────────────────────────────────────────────
export function Avatar({ name, size = 24, hue = 200 }: { name?: string; size?: number; hue?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 999, display: "grid", placeItems: "center", background: `oklch(0.4 0.08 ${hue})`, color: "#fff", fontSize: size * 0.42, fontWeight: 600, flexShrink: 0 }}>
      {(name || "?")[0]}
    </span>
  );
}

// ── 区块小标题 ────────────────────────────────────────────────────────────────
export function Eyebrow({ children, no }: { children: React.ReactNode; no?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      {no && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)" }}>{no}</span>}
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-2)" }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
    </div>
  );
}

// ── 文本输入样式（screens 复用） ───────────────────────────────────────────────
export const inputStyle: CSS = {
  width: "100%",
  padding: "11px 13px",
  background: "var(--bg-1)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-md)",
  color: "var(--ink-0)",
  fontSize: 13.5,
  fontFamily: "var(--font-ui)",
  outline: "none",
};

export { TONE };
