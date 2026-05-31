"use client";
// ============================================================
// SourceBadge — 实现来源角标（任务书 §6.4：mock 结果显示 MOCK，真实显示引擎名）。
// 让测试者一眼分辨某产物来自 InstantID / TripoSR / MOCK …
// ============================================================
import type { AiAvatarProviderMode } from "@ai-star-eco/types/ai-avatar";

export function SourceBadge({
  mode,
  engine,
  size = "sm",
}: {
  mode?: AiAvatarProviderMode | null;
  engine?: string | null;
  size?: "sm" | "md";
}) {
  const isMock = mode === "mock";
  // engine 里可能已带 "MOCK · xxx" 前缀，统一显示。
  const label = isMock ? "MOCK" : engine || (mode === "backend" ? "后端网关" : mode === "selfhost" ? "自部署" : "—");
  const tone = isMock
    ? { c: "var(--warn)", b: "rgba(245,165,36,0.4)", bg: "var(--accent-soft)" }
    : { c: "var(--ok)", b: "rgba(86,214,160,0.3)", bg: "var(--ok-soft)" };
  const fs = size === "sm" ? 9 : 10;
  return (
    <span
      title={engine || undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "var(--font-mono)",
        fontSize: fs,
        padding: size === "sm" ? "2px 6px" : "3px 8px",
        borderRadius: 4,
        color: tone.c,
        border: "1px solid " + tone.b,
        background: tone.bg,
        whiteSpace: "nowrap",
        letterSpacing: "0.04em",
      }}
    >
      {isMock && <span style={{ width: 4, height: 4, borderRadius: 999, background: "var(--warn)" }} />}
      {label}
    </span>
  );
}
