"use client";

import { CSSProperties, HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** 突出主卡（带淡阴影 + 1px 边） */
  elevated?: boolean;
  /** 大圆角（默认 lg=16px；xl=24px 用于 hero / feature） */
  xl?: boolean;
  children: ReactNode;
}

export function Card({ elevated, xl, style, className, children, ...rest }: Props) {
  const baseStyle: CSSProperties = {
    background: "var(--bg-1)",
    border: "1px solid var(--line)",
    borderRadius: xl ? "var(--radius-xl)" : "var(--radius-lg)",
    boxShadow: elevated ? "var(--shadow-md)" : "var(--shadow-sm)",
    ...style,
  };
  return (
    <div className={className} style={baseStyle} {...rest}>
      {children}
    </div>
  );
}
