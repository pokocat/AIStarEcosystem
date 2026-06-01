"use client";

// 创作模式仪式感双选 — 设计真源:screens-entry.jsx `ModeCard`。
// 大尺寸卡 + 选中浮起 + 渐变光晕,有"仪式感"。
import * as React from "react";
import { ArrowRight, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ModeCardProps {
  active: boolean;
  onClick: () => void;
  from: string;
  to: string;
  Icon: LucideIcon;
  title: string;
  tagline: string;
  desc: string;
}

export function ModeCard({
  active,
  onClick,
  from,
  to,
  Icon,
  title,
  tagline,
  desc,
}: ModeCardProps) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="card col"
      style={{
        flex: 1,
        maxWidth: 380,
        padding: 26,
        textAlign: "left",
        gap: 14,
        position: "relative",
        overflow: "hidden",
        border: active ? "2px solid var(--accent)" : "2px solid transparent",
        boxShadow: active
          ? "var(--shadow-lg)"
          : hover
            ? "var(--shadow)"
            : "var(--shadow-sm)",
        transform: active ? "translateY(-2px)" : "none",
        transition: "transform .2s, box-shadow .2s, border-color .2s",
        cursor: "pointer",
      }}
    >
      {/* 渐变光晕 */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 140,
          height: 140,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${from}, ${to})`,
          opacity: active ? 0.16 : 0.08,
          transition: "opacity .2s",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          background: `linear-gradient(135deg, ${from}, ${to})`,
          display: "grid",
          placeItems: "center",
          color: "#fff",
          boxShadow: `0 8px 20px ${from}55`,
        }}
      >
        <Icon size={26} />
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: 19 }}>{title}</div>
        <div style={{ color: "var(--accent)", fontWeight: 700, fontSize: 13, marginTop: 2 }}>
          {tagline}
        </div>
      </div>
      <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
        {desc}
      </div>
      <div
        className="row gap-2"
        style={{
          marginTop: "auto",
          color: active ? "var(--accent)" : "var(--ink-3)",
          fontWeight: 700,
          fontSize: 13,
        }}
      >
        {active ? (
          <>
            <Check size={16} /> 已选这种
          </>
        ) : (
          <>
            选这种 <ArrowRight size={15} />
          </>
        )}
      </div>
    </button>
  );
}
