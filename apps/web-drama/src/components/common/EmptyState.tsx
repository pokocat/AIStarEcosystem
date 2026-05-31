"use client";

import * as React from "react";

interface Props {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div
      style={{
        padding: "48px 32px",
        textAlign: "center",
        background: "var(--surface-1)",
        border: "1px dashed var(--line-2)",
        borderRadius: "var(--radius-md)",
        color: "var(--fg-2)",
      }}
    >
      {icon && (
        <div style={{ marginBottom: 12, color: "var(--fg-3)", display: "flex", justifyContent: "center" }}>
          {icon}
        </div>
      )}
      <div
        style={{
          fontSize: 15,
          fontWeight: 500,
          color: "var(--fg-1)",
          fontFamily: "var(--font-display)",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {description && (
        <div style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.55, maxWidth: 360, margin: "0 auto" }}>
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: 18, display: "flex", justifyContent: "center", gap: 10 }}>{action}</div>}
    </div>
  );
}
