"use client";

// 参考图 Active drama series 卡片头部：多色渐变方块，无图情景下作 hero 视觉。
// 选 hash(seed) 决定渐变，保持同一 ID 颜色稳定。

import { CSSProperties, ReactNode } from "react";
import { gradientForSeed } from "./Avatar";

interface Props {
  seed: string;
  height?: number;
  radius?: string | number;
  children?: ReactNode;
  /** 顶部右角额外内容（状态 chip） */
  topRight?: ReactNode;
  /** 顶部左角额外内容 */
  topLeft?: ReactNode;
  /** 底部覆盖物（标题、副标） */
  bottom?: ReactNode;
  style?: CSSProperties;
}

export function GradientBlock({
  seed,
  height = 140,
  radius = "var(--radius-lg)",
  children,
  topLeft,
  topRight,
  bottom,
  style,
}: Props) {
  return (
    <div
      style={{
        position: "relative",
        height,
        borderRadius: radius,
        overflow: "hidden",
        background: gradientForSeed(seed),
        color: "#ffffff",
        ...style,
      }}
    >
      {/* 高光叠层 */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 30% 0%, rgba(255,255,255,0.22), transparent 60%)",
          pointerEvents: "none",
        }}
      />
      {topLeft && <div style={{ position: "absolute", top: 10, left: 12 }}>{topLeft}</div>}
      {topRight && <div style={{ position: "absolute", top: 10, right: 12 }}>{topRight}</div>}
      {children}
      {bottom && <div style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>{bottom}</div>}
    </div>
  );
}
