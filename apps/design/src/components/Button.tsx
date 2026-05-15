import { ButtonHTMLAttributes, ReactNode, CSSProperties } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "icon";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variantStyle: Record<Variant, CSSProperties> = {
  primary: {
    background: "var(--accent)",
    color: "#fff",
    border: "1px solid var(--accent-strong)",
  },
  secondary: {
    background: "var(--bg-2)",
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
  icon: {
    background: "var(--bg-2)",
    color: "var(--fg-1)",
    border: "1px solid var(--line-2)",
  },
};

const sizeStyle: Record<Size, CSSProperties> = {
  sm: { padding: "6px 12px", fontSize: 12 },
  md: { padding: "8px 14px", fontSize: 13 },
  lg: { padding: "10px 18px", fontSize: 14 },
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
        fontFamily: "var(--font-sans)",
        fontWeight: 500,
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        transition: "background 120ms ease, border-color 120ms ease",
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
