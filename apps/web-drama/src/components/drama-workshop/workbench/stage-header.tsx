"use client";

// 阶段顶部标题区 — 设计真源:components.jsx `StageHeader`。
import * as React from "react";

interface StageHeaderProps {
  no: number;
  scope: "项目" | "剧集";
  title: React.ReactNode;
  desc?: React.ReactNode;
  right?: React.ReactNode;
}

export function StageHeader({ no, scope, title, desc, right }: StageHeaderProps) {
  return (
    <div className="row" style={{ marginBottom: 20, gap: 14, alignItems: "flex-start" }}>
      <div>
        <div className="row gap-2" style={{ marginBottom: 5 }}>
          <span className="tag tag-gray num">阶段 {no}</span>
          <span
            className="tag"
            style={{
              background: scope === "项目" ? "var(--accent-soft)" : "var(--accent-2-soft)",
              color: scope === "项目" ? "var(--accent)" : "var(--accent-2)",
            }}
          >
            {scope === "项目" ? "跨集共享" : "当前剧集"}
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
      <div className="grow" />
      {right}
    </div>
  );
}
