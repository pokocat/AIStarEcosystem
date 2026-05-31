"use client";

// ComingSoon — 诚实的「即将上线」占位（不假装有功能）。
// 用于：创作流程里尚未落地的步骤（审核/合规）、素材资产页、剪辑微调等。
import * as React from "react";
import { Clock } from "lucide-react";

interface Props {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** 计划版本，如 "v0.8"。 */
  eta?: string;
  icon?: React.ReactNode;
  /** 紧凑模式：行内小卡（用于步骤内嵌）。 */
  compact?: boolean;
}

export function ComingSoon({ title, description, eta, icon, compact }: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: compact ? "row" : "column",
        alignItems: compact ? "center" : "center",
        textAlign: compact ? "left" : "center",
        gap: compact ? 14 : 12,
        padding: compact ? "16px 18px" : "44px 32px",
        background: "var(--surface-1)",
        border: "1px dashed var(--line-2)",
        borderRadius: "var(--radius-md)",
        color: "var(--fg-2)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: compact ? 36 : 48,
          height: compact ? 36 : 48,
          borderRadius: "var(--radius-md)",
          background: "var(--accent-soft)",
          color: "var(--accent)",
          flexShrink: 0,
        }}
      >
        {icon ?? <Clock size={compact ? 16 : 22} />}
      </div>
      <div style={{ flex: compact ? 1 : undefined }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: compact ? 13.5 : 15,
            fontWeight: 600,
            color: "var(--fg-1)",
            fontFamily: "var(--font-display)",
          }}
        >
          {title}
          <span
            className="eyebrow"
            style={{
              padding: "2px 7px",
              borderRadius: "var(--radius-pill)",
              background: "var(--accent-soft)",
              color: "var(--accent)",
              border: "1px solid color-mix(in srgb, var(--accent) 28%, transparent)",
            }}
          >
            即将上线{eta ? ` · ${eta}` : ""}
          </span>
        </div>
        {description && (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--fg-2)",
              lineHeight: 1.6,
              marginTop: 6,
              maxWidth: compact ? undefined : 420,
              marginInline: compact ? undefined : "auto",
            }}
          >
            {description}
          </div>
        )}
      </div>
    </div>
  );
}
