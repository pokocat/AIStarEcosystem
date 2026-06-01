"use client";

// 新建流程顶部步骤指示 — 设计真源:screens-entry.jsx `StepDot`。
import * as React from "react";
import { Check } from "lucide-react";

interface StepDotProps {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
}

export function StepDot({ n, label, active, done }: StepDotProps) {
  return (
    <div
      className="row gap-2"
      style={{
        color: active ? "var(--accent)" : done ? "var(--ink)" : "var(--ink-3)",
        fontWeight: active ? 700 : 600,
        fontSize: 13.5,
      }}
    >
      <span
        className="num"
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          fontSize: 12,
          background: active
            ? "var(--accent)"
            : done
              ? "var(--accent-soft)"
              : "var(--surface-2)",
          color: active ? "#fff" : done ? "var(--accent)" : "var(--ink-3)",
        }}
      >
        {done ? <Check size={13} /> : n}
      </span>
      {label}
    </div>
  );
}
