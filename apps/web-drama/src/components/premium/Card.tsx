"use client";

import { CSSProperties, HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** premium 主题的 glass 卡片（背景渐变 + backdrop-blur）；缺省为实色 bg-1。 */
  glass?: boolean;
  children: ReactNode;
}

export function Card({ glass, style, className, children, ...rest }: Props) {
  const baseStyle: CSSProperties = {
    background: glass ? undefined : "var(--bg-1)",
    border: glass ? undefined : "1px solid var(--line)",
    borderRadius: "var(--radius-lg)",
    ...style,
  };
  return (
    <div
      className={glass ? `glass ${className ?? ""}` : className}
      style={baseStyle}
      {...rest}
    >
      {children}
    </div>
  );
}
