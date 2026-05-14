"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/premium";

interface Props {
  title?: React.ReactNode;
  message?: React.ReactNode;
  onRetry?: () => void;
}

export function ErrorBlock({ title = "加载失败", message, onRetry }: Props) {
  return (
    <div
      style={{
        padding: "32px 28px",
        background: "rgba(255, 61, 138, 0.06)",
        border: "1px solid rgba(255, 61, 138, 0.28)",
        borderRadius: "var(--radius-md)",
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
        color: "var(--fg-0)",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "var(--radius-sm)",
          background: "rgba(255, 61, 138, 0.18)",
          color: "var(--danger)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <AlertTriangle size={20} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, fontFamily: "var(--font-display)" }}>
          {title}
        </div>
        {message && (
          <div style={{ fontSize: 12.5, color: "var(--fg-1)", lineHeight: 1.55 }}>{message}</div>
        )}
        {onRetry && (
          <div style={{ marginTop: 14 }}>
            <Button variant="secondary" size="sm" onClick={onRetry}>
              <RefreshCw size={12} />
              重试
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
