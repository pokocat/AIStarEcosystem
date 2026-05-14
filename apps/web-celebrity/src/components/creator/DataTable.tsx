"use client";

import { ReactNode } from "react";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: string; // grid track value，例 "2fr" / "120px"
  render?: (row: T, index: number) => ReactNode;
  align?: "left" | "right";
  mono?: boolean;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  caption?: string;
  meta?: string;
  rightSlot?: ReactNode;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  caption,
  meta,
  rightSlot,
}: Props<T>) {
  const template = columns.map((c) => c.width ?? "1fr").join(" ");

  return (
    <div
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      {(caption || rightSlot) && (
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            {caption && (
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-0)" }}>{caption}</div>
            )}
            {meta && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--fg-2)",
                  fontFamily: "var(--font-mono)",
                  marginTop: 2,
                }}
              >
                {meta}
              </div>
            )}
          </div>
          {rightSlot}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: template,
          padding: "10px 18px",
          fontFamily: "var(--font-mono)",
          fontSize: 9.5,
          letterSpacing: 1.2,
          color: "var(--fg-2)",
          textTransform: "uppercase",
          background: "var(--bg-2)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        {columns.map((c) => (
          <div key={String(c.key)} style={{ textAlign: c.align ?? "left" }}>
            {c.header}
          </div>
        ))}
      </div>

      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: template,
            padding: "12px 18px",
            fontSize: 12.5,
            borderBottom: i < rows.length - 1 ? "1px solid var(--line)" : "none",
            alignItems: "center",
          }}
        >
          {columns.map((c) => (
            <div
              key={String(c.key)}
              style={{
                textAlign: c.align ?? "left",
                fontFamily: c.mono ? "var(--font-mono)" : "var(--font-sans)",
                color: "var(--fg-0)",
              }}
            >
              {c.render ? c.render(row, i) : (row as Record<string, ReactNode>)[String(c.key)]}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
