"use client";

// ─────────────────────────────────────────────────────────────────────────────
// StatusDistribution.tsx
// 艺人生命周期状态分布：trainee / debut / active / rest / retired。
// 非零切片 < 3 时降级为 pill 条（避免"两块饼"视觉单调）。
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import type { Artist, ArtistStatus } from "@ai-star-eco/types/artist";
import { STATUS_CONFIG } from "@/constants/artist-config";
import { TypeDistributionPie } from "./TypeDistributionPie";

const STATUS_ORDER: ArtistStatus[] = ["trainee", "debut", "active", "rest", "retired"];

/** 与 STATUS_CONFIG.dot 的 Tailwind class 对齐的十六进制色（recharts 不吃 Tailwind 类） */
const STATUS_COLORS: Record<ArtistStatus, string> = {
  trainee: "#9ca3af",
  debut:   "#60a5fa",
  active:  "#4ade80",
  rest:    "#fbbf24",
  retired: "#f87171",
};

interface Props {
  artists: Artist[];
}

export function StatusDistribution({ artists }: Props) {
  if (artists.length === 0) {
    return (
      <div className="w-full flex items-center justify-center text-sm text-gray-500 font-light" style={{ minHeight: 180 }}>
        暂无签约艺人
      </div>
    );
  }

  const counts: Record<ArtistStatus, number> = { trainee: 0, debut: 0, active: 0, rest: 0, retired: 0 };
  for (const a of artists) counts[a.status] = (counts[a.status] ?? 0) + 1;

  const dist = STATUS_ORDER
    .filter(s => counts[s] > 0)
    .map(s => ({ name: STATUS_CONFIG[s].label, value: counts[s], _status: s }));

  // 少于 3 个非零状态 → 降级为横向 pill 条，饼图形态不美观
  if (dist.length < 3) {
    return (
      <div className="flex flex-wrap gap-2 py-4 justify-center">
        {dist.map(d => (
          <span
            key={d.name}
            className="px-3 py-1.5 rounded-full text-xs bg-white/[0.05] text-gray-200 flex items-center gap-2"
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[d._status] }} />
            {d.name}
            <span className="text-gray-500">×{d.value}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <TypeDistributionPie
      data={dist.map(d => ({ name: d.name, value: d.value }))}
      colors={dist.map(d => STATUS_COLORS[d._status])}
      emptyHint="暂无状态数据"
    />
  );
}
