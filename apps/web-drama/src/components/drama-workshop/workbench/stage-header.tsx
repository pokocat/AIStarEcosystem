"use client";

// 阶段顶部标题区 — 设计真源:components.jsx `StageHeader`。
// v0.197：去掉「阶段 N」标签 —— 合成成片页写「阶段 5」、页签却是「2 合成成片」，两个编号对不上。
import * as React from "react";

interface StageHeaderProps {
  /** @deprecated v0.197 起不再显示阶段序号，保留参数只为不改调用方。 */
  no?: number;
  scope: "项目" | "剧集";
  title: React.ReactNode;
  desc?: React.ReactNode;
  right?: React.ReactNode;
}

export function StageHeader({ scope, title, desc, right }: StageHeaderProps) {
  return (
    <div className="row wb-stage-header" style={{ marginBottom: 20, gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ minWidth: 0, flex: "1 1 260px" }}>
        <div className="row gap-2" style={{ marginBottom: 5 }}>
          <span
            className="tag"
            style={{
              background: scope === "项目" ? "var(--accent-soft)" : "var(--accent-2-soft)",
              color: scope === "项目" ? "var(--accent)" : "var(--accent-2)",
            }}
          >
            {scope === "项目" ? "所有集通用" : "这一集"}
          </span>
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 23,
            fontWeight: 800,
            letterSpacing: "-.01em",
          }}
        >
          {title}
        </h1>
        {desc && (
          <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>
            {desc}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}
