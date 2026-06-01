"use client";

// 布局切换 — 设计真源:screens-board.jsx `LayoutToggle`。
// 竖向流 / 时间线(默认) / 网格 三选一。
import * as React from "react";
import { Grid, Layers, List } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type BoardLayout = "flow" | "timeline" | "grid";

interface LayoutToggleProps {
  layout: BoardLayout;
  onChange: (l: BoardLayout) => void;
}

const OPTS: { k: BoardLayout; Icon: LucideIcon; n: string }[] = [
  { k: "flow",     Icon: List,   n: "竖向流" },
  { k: "timeline", Icon: Layers, n: "时间线" },
  { k: "grid",     Icon: Grid,   n: "网格" },
];

export function LayoutToggle({ layout, onChange }: LayoutToggleProps) {
  return (
    <div
      className="row"
      style={{
        background: "var(--surface-2)",
        borderRadius: 11,
        padding: 3,
        gap: 2,
      }}
    >
      {OPTS.map((o) => {
        const on = layout === o.k;
        return (
          <button
            key={o.k}
            type="button"
            onClick={() => onChange(o.k)}
            className="row gap-2"
            style={{
              padding: "7px 12px",
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              background: on ? "var(--surface)" : "transparent",
              color: on ? "var(--accent)" : "var(--ink-3)",
              boxShadow: on ? "var(--shadow-sm)" : "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            <o.Icon size={14} /> {o.n}
          </button>
        );
      })}
    </div>
  );
}
