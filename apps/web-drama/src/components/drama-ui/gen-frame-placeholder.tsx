"use client";

// AI 出图「生成中」动效占位（v0.98）——替代素净的灰骨架：
// accent 渐变呼吸底 + 斜向流光扫过 + 竖向扫描线（AI 逐行绘制感）+ 中心脉冲发光魔杖 + 生成中点点。
import * as React from "react";
import { Wand2 } from "lucide-react";

export function GenFramePlaceholder({
  width = 62,
  height = 96,
  radius = 9,
  label,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  /** 高度够大时显示的文案（如「AI 生成中」）；小尺寸留空只显示图标动效。 */
  label?: string;
}) {
  const icon = typeof height === "number" ? Math.max(14, Math.min(26, height * 0.24)) : 20;
  const showLabel = !!label && typeof height === "number" && height >= 120;
  return (
    <div
      role="status"
      aria-label={label || "AI 生成中"}
      style={{
        position: "relative",
        width,
        height,
        borderRadius: radius,
        overflow: "hidden",
        background:
          "linear-gradient(135deg, var(--surface-2), color-mix(in oklch, var(--accent) 14%, var(--surface-2)))",
        boxShadow: "0 0 0 1px color-mix(in oklch, var(--accent) 22%, transparent)",
        animation: "genfpGlow 1.6s ease-in-out infinite",
      }}
    >
      <style>{`
        @keyframes genfpGlow { 0%,100%{box-shadow:0 0 0 1px color-mix(in oklch,var(--accent) 18%,transparent),0 0 6px -2px color-mix(in oklch,var(--accent) 30%,transparent)} 50%{box-shadow:0 0 0 1px color-mix(in oklch,var(--accent) 42%,transparent),0 0 16px -2px color-mix(in oklch,var(--accent) 55%,transparent)} }
        @keyframes genfpSweep { 0%{transform:translateX(-130%) skewX(-12deg)} 100%{transform:translateX(130%) skewX(-12deg)} }
        @keyframes genfpScan { 0%{top:-30%} 100%{top:115%} }
        @keyframes genfpPulse { 0%,100%{transform:scale(.82);opacity:.5} 50%{transform:scale(1.12);opacity:1} }
        @keyframes genfpDots { 0%{opacity:.2} 50%{opacity:1} 100%{opacity:.2} }
      `}</style>
      {/* 斜向流光扫过 */}
      <div style={{ position: "absolute", inset: "-20% -30%", background: "linear-gradient(115deg, transparent 38%, rgba(255,255,255,.6) 50%, transparent 62%)", animation: "genfpSweep 1.5s ease-in-out infinite" }} />
      {/* 竖向扫描线（AI 逐行绘制） */}
      <div style={{ position: "absolute", left: 0, right: 0, height: "26%", background: "linear-gradient(to bottom, transparent, color-mix(in oklch, var(--accent) 55%, transparent), transparent)", filter: "blur(1px)", animation: "genfpScan 1.9s linear infinite" }} />
      {/* 中心脉冲发光魔杖 + 文案 */}
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", gap: 6, gridAutoFlow: "row" }}>
        <Wand2 size={icon} style={{ color: "var(--accent)", filter: "drop-shadow(0 0 4px color-mix(in oklch, var(--accent) 70%, transparent))", animation: "genfpPulse 1.2s ease-in-out infinite" }} />
        {showLabel && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", letterSpacing: ".02em" }}>
            {label}
            <span style={{ animation: "genfpDots 1.2s infinite" }}>·</span>
            <span style={{ animation: "genfpDots 1.2s .2s infinite" }}>·</span>
            <span style={{ animation: "genfpDots 1.2s .4s infinite" }}>·</span>
          </span>
        )}
      </div>
    </div>
  );
}
