"use client";

import { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variantStyle: Record<Variant, CSSProperties> = {
  primary: {
    background: "var(--gradient-gold)",
    color: "#1a1410",
    border: "1px solid var(--accent-strong)",
    fontWeight: 600,
  },
  secondary: {
    background: "rgba(255,255,255,0.04)",
    color: "var(--fg-0)",
    border: "1px solid var(--line-2)",
  },
  ghost: {
    background: "transparent",
    color: "var(--fg-1)",
    border: "1px solid transparent",
  },
  danger: {
    background: "transparent",
    color: "var(--danger)",
    border: "1px solid var(--danger)",
  },
};

const sizeStyle: Record<Size, CSSProperties> = {
  sm: { padding: "6px 14px", fontSize: 12 },
  md: { padding: "9px 18px", fontSize: 13 },
  lg: { padding: "12px 24px", fontSize: 14 },
};

export function Button({
  variant = "primary",
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
        fontWeight: variant === "primary" ? 600 : 500,
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        transition: "background 160ms ease, border-color 160ms ease, transform 160ms ease, opacity 160ms ease",
        whiteSpace: "nowrap",
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
