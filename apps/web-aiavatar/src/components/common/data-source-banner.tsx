"use client";
// ============================================================
// DataSourceBanner — 常驻数据源指示（任务书 §6.4：mock / 真实后端 前端可见）。
// 右下角静态药丸，pointer-events:none —— 纯指示，绝不拦截任何 UI 点击。
// 详细说明 / 能力来源见侧栏「能力健康」页。
// ============================================================
import { dataSourceMode } from "@/api/ai-avatar";

export function DataSourceBanner() {
  const mock = dataSourceMode() === "mock";
  return (
    <div
      title={mock ? "DEV MOCK：本地 mock store（离线整跑）。详见「能力健康」页。" : "LIVE：Spring Boot 后端 /api/me/aiavatar/*。"}
      style={{
        position: "fixed",
        right: 16,
        bottom: 14,
        zIndex: 5,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "5px 11px",
        borderRadius: 999,
        border: "1px solid " + (mock ? "rgba(245,165,36,0.4)" : "rgba(86,214,160,0.3)"),
        background: mock ? "var(--accent-soft)" : "var(--ok-soft)",
        color: mock ? "var(--warn)" : "var(--ok)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        boxShadow: "var(--shadow-1)",
        opacity: 0.92,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor", animation: "pulse 1.8s infinite" }} />
      {mock ? "DEV MOCK" : "LIVE 后端"}
    </div>
  );
}
