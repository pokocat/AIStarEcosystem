"use client";

// 字段块 — 设计真源：screens-project.jsx `Field`。
import * as React from "react";

interface FieldProps {
  label: React.ReactNode;
  children: React.ReactNode;
}

export function Field({ label, children }: FieldProps) {
  return (
    <div>
      <div
        className="faint"
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          marginBottom: 5,
          letterSpacing: ".04em",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}
