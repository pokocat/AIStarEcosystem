"use client";

import { HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** glass 形态（creator 主题下与默认相同；保留接口以便切到 premium 主题） */
  glass?: boolean;
  children: ReactNode;
}

export function Card({ glass, style, className, children, ...rest }: Props) {
  return (
    <div
      className={glass ? `glass ${className ?? ""}` : className}
      style={{
        background: glass ? undefined : "var(--bg-1)",
        border: glass ? undefined : "1px solid var(--line)",
        borderRadius: "var(--radius-lg)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
