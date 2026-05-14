"use client";

// 参考图 Buttons 区：dark（黑实心）/ accent（紫实心）/ secondary（白底+边）/ ghost（透明+灰字）
// 圆角全部 pill；中等留白；mono 反而较少用，主要用 sans。

import { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

type Variant = "dark" | "accent" | "secondary" | "ghost" | "icon" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variantStyle: Record<Variant, CSSProperties> = {
  dark: {
    background: "var(--ink)",
    color: "#ffffff",
    border: "1px solid var(--ink)",
  },
  accent: {
    background: "var(--accent)",
    color: "#ffffff",
    border: "1px solid var(--accent-strong)",
  },
  secondary: {
    background: "var(--bg-1)",
    color: "var(--fg-0)",
    border: "1px solid var(--line-2)",
  },
  ghost: {
    background: "transparent",
    color: "var(--fg-1)",
    border: "1px solid transparent",
  },
  icon: {
    background: "var(--bg-1)",
    color: "var(--fg-1)",
    border: "1px solid var(--line)",
  },
  danger: {
    background: "transparent",
    color: "var(--danger)",
    border: "1px solid var(--danger)",
  },
};

const sizeStyle: Record<Size, CSSProperties> = {
  sm: { padding: "6px 14px", fontSize: 12.5, height: 30 },
  md: { padding: "9px 18px", fontSize: 13.5, height: 36 },
  lg: { padding: "11px 22px", fontSize: 14.5, height: 42 },
};

export function Button({
  variant = "dark",
  size = "md",
  style,
  children,
  ...rest
}: Props) {
  return (
    <button
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontFamily: "var(--font-sans)",
        fontWeight: 500,
        borderRadius: "var(--radius-pill)",
        cursor: "pointer",
        transition: "background 120ms ease, border-color 120ms ease, opacity 120ms ease",
        whiteSpace: "nowrap",
        boxSizing: "border-box",
        ...variantStyle[variant],
        ...sizeStyle[size],
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
