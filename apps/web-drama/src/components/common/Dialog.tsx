"use client";

// Premium 风的 Dialog 容器。直接在原生 dialog 模式上做，避免 next-themes 依赖。
// 提供 <Dialog open onOpenChange title> 接口，类似 shadcn 但更轻。

import * as React from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 480,
}: Props) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      onClick={() => onOpenChange(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "var(--overlay-scrim)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: width,
          maxHeight: "90vh",
          overflow: "auto",
          background: "var(--bg-1)",
          border: "1px solid var(--line-2)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          padding: "26px 28px",
          position: "relative",
          color: "var(--fg-0)",
          fontFamily: "var(--font-sans)",
        }}
      >
        <button
          onClick={() => onOpenChange(false)}
          aria-label="关闭"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 28,
            height: 28,
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--line)",
            background: "var(--surface-1)",
            color: "var(--fg-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <X size={14} />
        </button>
        <div style={{ marginBottom: 6 }}>
          <h2
            style={{
              fontSize: 19,
              fontWeight: 600,
              fontFamily: "var(--font-display)",
              letterSpacing: -0.2,
              margin: 0,
            }}
          >
            {title}
          </h2>
        </div>
        {description && (
          <div style={{ fontSize: 13, color: "var(--fg-2)", marginBottom: 16, lineHeight: 1.55 }}>
            {description}
          </div>
        )}
        <div style={{ marginTop: description ? 0 : 14 }}>{children}</div>
        {footer && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              marginTop: 22,
              paddingTop: 18,
              borderTop: "1px solid var(--line)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
