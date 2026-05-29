"use client";

// 全局通用的「AI 交互中」视觉反馈（item 2）。
// 大模型调用是单次 HTTP（无流式进度），这里用「阶段文案轮播 + 流光进度条 + 计时」营造可感知的等待体验，
// 避免用户觉得「卡半天没反应」。stages 走定时推进，但停在最后一阶段不谎报完成（真响应回来由调用方切走）。

import * as React from "react";
import { Sparkles, Loader2 } from "lucide-react";

const DEFAULT_STAGES = [
  "正在理解商品与卖点…",
  "构思脚本结构与钩子…",
  "逐镜生成画面与口播…",
  "校验合规与可读性…",
  "整理输出…",
];

export function AiThinking({
  title = "AI 生成中",
  stages = DEFAULT_STAGES,
  hint = "大模型生成通常需要 10–30 秒，请稍候…",
  compact = false,
}: {
  title?: string;
  stages?: string[];
  hint?: string;
  compact?: boolean;
}) {
  const [stageIdx, setStageIdx] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    if (stageIdx >= stages.length - 1) return;
    const t = setTimeout(() => setStageIdx((i) => Math.min(i + 1, stages.length - 1)), 2200 + Math.random() * 900);
    return () => clearTimeout(t);
  }, [stageIdx, stages.length]);

  const stage = stages[Math.min(stageIdx, stages.length - 1)];

  if (compact) {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--fg-2)" }}>
        <Loader2 size={13} className="animate-spin" style={{ color: "var(--extra-teal)" }} />
        <span>{stage}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{elapsed}s</span>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ width: 420, maxWidth: "100%", textAlign: "center" }}>
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 18px",
            borderRadius: "var(--radius-lg)",
            background: `linear-gradient(135deg, ${"var(--accent)"}, var(--extra-teal))`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "var(--shadow-soft)",
          }}
          className="animate-pulse"
        >
          <Sparkles size={28} color="#fff" />
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--fg-0)", marginBottom: 6 }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--fg-1)", fontSize: 13, marginBottom: 16 }}>
          <Loader2 size={14} className="animate-spin" style={{ color: "var(--extra-teal)" }} />
          <span>{stage}</span>
        </div>
        {/* indeterminate 流光进度条 */}
        <div style={{ position: "relative", height: 6, borderRadius: 999, background: "var(--bg-2)", overflow: "hidden", border: "1px solid var(--line)" }}>
          <div
            className="ai-thinking-bar"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              width: "40%",
              borderRadius: 999,
              background: `linear-gradient(90deg, transparent, var(--accent), transparent)`,
            }}
          />
        </div>
        <div style={{ marginTop: 12, fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-3)" }}>
          {hint} · 已等待 {elapsed}s
        </div>
      </div>
      <style>{`
        @keyframes ai-thinking-slide { 0% { left: -40%; } 100% { left: 100%; } }
        .ai-thinking-bar { animation: ai-thinking-slide 1.3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
