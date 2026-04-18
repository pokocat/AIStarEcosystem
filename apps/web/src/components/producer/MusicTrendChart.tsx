"use client";

import * as React from "react";
import {
  Area, AreaChart, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { MusicTrendPoint } from "@/types/music";

interface Props {
  data: MusicTrendPoint[];
  /** 展示维度 */
  metric: "plays" | "revenue";
}

const METRIC_CONFIG: Record<Props["metric"], {
  label: string;
  stroke: string;
  fillId: string;
  formatTick: (v: number) => string;
  formatTooltip: (v: number) => string;
}> = {
  plays: {
    label: "播放量",
    stroke: "#f472b6", // pink-400
    fillId: "music-trend-plays",
    formatTick: (v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v),
    formatTooltip: (v) => `${v.toLocaleString("zh-CN")} 次`,
  },
  revenue: {
    label: "收入（积分）",
    stroke: "#34d399", // emerald-400
    fillId: "music-trend-revenue",
    formatTick: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v),
    formatTooltip: (v) => `${v.toLocaleString("zh-CN")} 积分`,
  },
};

export function MusicTrendChart({ data, metric }: Props) {
  const cfg = METRIC_CONFIG[metric];
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={cfg.fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cfg.stroke} stopOpacity={0.4} />
            <stop offset="100%" stopColor={cfg.stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="rgba(255,255,255,0.4)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => v.slice(5)}
          minTickGap={24}
        />
        <YAxis
          stroke="rgba(255,255,255,0.4)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={cfg.formatTick}
        />
        <Tooltip
          contentStyle={{
            background: "rgba(12,12,14,0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            fontSize: 12,
            color: "#fff",
          }}
          labelStyle={{ color: "rgba(255,255,255,0.6)" }}
          formatter={(v: number) => [cfg.formatTooltip(v), cfg.label]}
        />
        <Area
          type="monotone"
          dataKey={metric}
          stroke={cfg.stroke}
          strokeWidth={2}
          fill={`url(#${cfg.fillId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
