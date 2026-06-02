"use client";

// 元数据小项 — 设计真源：screens-entry.jsx `Meta`。
// "黄金 3 秒 / 节奏 / 受众" 这一类标签 + 短文本对。
import * as React from "react";

interface MetaProps {
  label: React.ReactNode;
  v: React.ReactNode;
}

export function Meta({ label, v }: MetaProps) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        className="faint"
        style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em" }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{v}</div>
    </div>
  );
}
