"use client";

// 视频封面占位 — 设计真源 v4 screens-home-v3.jsx `VideoCover`:
// 渐变 + 居中播放钮,提示这里是动态预览。
import * as React from "react";
import { Thumb } from "@/components/drama-ui";

interface VideoCoverProps {
  from: string;
  to: string;
  ratio?: string;
  label?: string;
  big?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function VideoCover({ from, to, ratio = "16/9", label, big, children, style }: VideoCoverProps) {
  return (
    <Thumb from={from} to={to} ratio={ratio} radius={0} style={{ width: "100%", ...style }}>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        <span
          style={{
            width: big ? 46 : 34,
            height: big ? 46 : 34,
            borderRadius: "50%",
            background: "rgba(255,255,255,.88)",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 4px 14px rgba(0,0,0,.22)",
          }}
        >
          <svg width={big ? 18 : 13} height={big ? 18 : 13} viewBox="0 0 14 14">
            <path d="M4 2.5v9l7.5-4.5z" fill="var(--accent)" />
          </svg>
        </span>
      </div>
      {label && (
        <span className="thumb-label" style={{ position: "absolute", left: 8, bottom: 8 }}>
          {label}
        </span>
      )}
      {children}
    </Thumb>
  );
}
