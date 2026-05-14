"use client";

import * as React from "react";

interface Props {
  rows?: number;
  height?: number;
  label?: React.ReactNode;
}

export function LoadingBlock({ rows = 3, height = 64, label }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {label && (
        <div className="mono" style={{ fontSize: 11, color: "var(--fg-3)", letterSpacing: 0.4 }}>
          {label}
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="drama-skeleton"
          style={{ height, width: "100%", opacity: 1 - i * 0.08 }}
        />
      ))}
    </div>
  );
}
