"use client";

// 参考图 Cards · Persona / Your cast 列表头像：多色渐变方块或圆形，无图片时显示初字。
// 用 seed 字符串哈希到 8 种渐变之一，保持同一 ID 颜色稳定。

import { CSSProperties } from "react";

const GRADIENTS = [
  "var(--gradient-violet)",
  "var(--gradient-peach)",
  "var(--gradient-rose)",
  "var(--gradient-teal)",
  "var(--gradient-lime)",
  "var(--gradient-amber)",
  "var(--gradient-sunset)",
  "var(--gradient-aurora)",
];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function gradientForSeed(seed: string): string {
  return GRADIENTS[hash(seed) % GRADIENTS.length];
}

interface Props {
  /** 用名 / id 决定渐变颜色 */
  seed: string;
  /** 显示在中央的字（默认取 seed[0]） */
  initial?: string;
  size?: number;
  shape?: "circle" | "square";
  style?: CSSProperties;
}

export function Avatar({ seed, initial, size = 32, shape = "circle", style }: Props) {
  const txt = (initial ?? seed[0] ?? "?").toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: shape === "circle" ? "50%" : "var(--radius-md)",
        background: gradientForSeed(seed),
        color: "#ffffff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-display)",
        fontWeight: 600,
        fontSize: Math.round(size * 0.42),
        letterSpacing: "var(--tracking-tight)",
        flexShrink: 0,
        ...style,
      }}
    >
      {txt}
    </div>
  );
}
