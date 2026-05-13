"use client";

import { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variantStyle: Record<Variant, CSSProperties> = {
  primary: {
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
  outline: {
    background: "transparent",
    color: "var(--accent)",
    border: "1px solid var(--accent)",
  },
  danger: {
    background: "transparent",
    color: "var(--danger)",
    border: "1px solid var(--danger)",
  },
};

const sizeStyle: Record<Size, CSSProperties> = {
  sm: { padding: "7px 14px", fontSize: 12.5, borderRadius: "var(--radius-pill)" },
  md: { padding: "10px 20px", fontSize: 13.5, borderRadius: "var(--radius-pill)" },
  lg: { padding: "13px 28px", fontSize: 14.5, borderRadius: "var(--radius-pill)" },
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
        fontWeight: 600,
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
