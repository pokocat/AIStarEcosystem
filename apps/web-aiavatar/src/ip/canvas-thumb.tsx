"use client";

// ============================================================
// 画布缩略图 —— 按节点的真实坐标画一张示意图。
//
// 为什么不是截图：模板**没有素材**（v0.192 起「存成模板」会把 storageKey 一起剥掉），
// 内置模板更是从来就没有图。要给卡片一张预览，唯一始终拿得到的信息就是
// **工作流本身的形状** —— 几个节点、怎么连、分几路。
//
// 这张图恰恰也是用户挑模板时真正想知道的：「这条链有多长、是不是我要的结构」，
// 比一张成品图更有用（成品图只能说明它能出图，说明不了流程）。
// ============================================================

import * as React from "react";
import type { IpProjectDoc } from "@ai-star-eco/types";

/** 节点类型 → 颜色。与画布里的节点配色同源，扫一眼能对上。 */
const TYPE_TINT: Record<string, string> = {
  image: "#7C8CC4",
  text: "#9AA6B8",
  video: "#C4907C",
};

export function CanvasThumb({
  doc, className, height = 96,
}: { doc?: IpProjectDoc | null; className?: string; height?: number }) {
  const nodes = Array.isArray(doc?.nodes) ? doc!.nodes : [];
  const conns = Array.isArray(doc?.connections) ? doc!.connections : [];

  if (nodes.length === 0) {
    return (
      <div
        className={className}
        style={{
          height, borderRadius: 9, background: "var(--surface-2)",
          display: "grid", placeItems: "center",
          fontSize: 11.5, color: "var(--ink-4)",
        }}
      >
        空白画布
      </div>
    );
  }

  // 归一到 viewBox：节点坐标是画布世界坐标，范围随项目差很多
  const xs = nodes.map((n) => n.position?.x ?? 0);
  const ys = nodes.map((n) => n.position?.y ?? 0);
  const ws = nodes.map((n, i) => xs[i] + (n.width || 200));
  const hs = nodes.map((n, i) => ys[i] + (n.height || 140));
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const maxX = Math.max(...ws), maxY = Math.max(...hs);
  const pad = 40;
  const vw = Math.max(1, maxX - minX) + pad * 2;
  const vh = Math.max(1, maxY - minY) + pad * 2;
  const at = (n: (typeof nodes)[number]) => ({
    x: (n.position?.x ?? 0) - minX + pad,
    y: (n.position?.y ?? 0) - minY + pad,
    w: n.width || 200,
    h: n.height || 140,
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <svg
      className={className}
      viewBox={`0 0 ${vw} ${vh}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ height, width: "100%", display: "block", borderRadius: 9, background: "var(--surface-2)" }}
      role="img"
      aria-label={`工作流示意：${nodes.length} 个节点`}
    >
      {conns.map((c) => {
        const a = byId.get(c.fromNodeId);
        const b = byId.get(c.toNodeId);
        if (!a || !b) return null;   // 连到已删节点的线：跳过，不画到画外
        const p = at(a), q = at(b);
        const x1 = p.x + p.w, y1 = p.y + p.h / 2;
        const x2 = q.x, y2 = q.y + q.h / 2;
        const mid = (x1 + x2) / 2;
        return (
          <path
            key={c.id ?? `${c.fromNodeId}-${c.toNodeId}`}
            d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
            fill="none"
            stroke="var(--line-3, #c9cfdd)"
            strokeWidth={Math.max(2, vw / 260)}
          />
        );
      })}
      {nodes.map((n) => {
        const r = at(n);
        return (
          <rect
            key={n.id}
            x={r.x} y={r.y} width={r.w} height={r.h}
            rx={Math.max(4, vw / 180)}
            fill={TYPE_TINT[String(n.type)] ?? "#B8BFCE"}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}
