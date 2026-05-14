"use client";

// 参考图 Tabs / Board-Timeline-List 分段：pill 圆角，active 黑字 + 浅底，其余灰字透明。

import { ReactNode } from "react";

interface TabItem {
  id: string;
  label: ReactNode;
  count?: number;
}

interface Props {
  items: TabItem[];
  active: string;
  onSelect?: (id: string) => void;
  size?: "sm" | "md";
}

export function Tabs({ items, active, onSelect, size = "md" }: Props) {
  const pad = size === "sm" ? "5px 12px" : "7px 16px";
  const fs = size === "sm" ? 12 : 13;
  return (
    <div
      style={{
        display: "inline-flex",
        background: "var(--bg-2)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-pill)",
        padding: 3,
        gap: 2,
      }}
    >
      {items.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onSelect?.(t.id)}
            style={{
              padding: pad,
              fontSize: fs,
              fontFamily: "var(--font-sans)",
              fontWeight: isActive ? 600 : 500,
              borderRadius: "var(--radius-pill)",
              border: "none",
              background: isActive ? "var(--bg-1)" : "transparent",
              color: isActive ? "var(--fg-0)" : "var(--fg-2)",
              cursor: "pointer",
              transition: "background 120ms, color 120ms",
              boxShadow: isActive ? "var(--shadow-soft)" : "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {t.label}
            {t.count != null && (
              <span
                style={{
                  fontSize: 10.5,
                  fontFamily: "var(--font-mono)",
                  color: isActive ? "var(--fg-2)" : "var(--fg-3)",
                  padding: "1px 6px",
                  borderRadius: "var(--radius-pill)",
                  background: isActive ? "var(--bg-2)" : "transparent",
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
