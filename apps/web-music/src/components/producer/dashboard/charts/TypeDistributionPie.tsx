"use client";

// ─────────────────────────────────────────────────────────────────────────────
// TypeDistributionPie.tsx
// 通用分布饼图（类型分布 / 状态分布 / 收入来源都能复用）。
//
// 相对于旧的内联实现修复了：
//  1. Tooltip 黑底 + 深色默认 item 色 → 悬浮文字不可见 —— 显式 itemStyle/labelStyle
//  2. 切片无 hover 反馈 —— activeShape 放大 4px
//  3. 切片 ≥ threshold 时 paddingAngle=3 会让光标穿过空隙丢 hover —— 自动降到 1
//  4. ResponsiveContainer 在窄屏塌缩 —— minHeight 兜底
//  5. 手搓 legend 溢出 —— 改为结构化的图例行（保留原先风格）
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from "recharts";

export interface PieDatum {
  name: string;
  value: number;
}

export const DEFAULT_PIE_COLORS = [
  "#06b6d4", "#a855f7", "#f59e0b", "#ec4899",
  "#22c55e", "#ef4444", "#6366f1", "#14b8a6",
];

interface Props {
  data: PieDatum[];
  colors?: string[];
  /** 空数据的占位文案 */
  emptyHint?: string;
  /** 切片 ≥ 此数自动把 paddingAngle 降到 1，避免光标滑出空隙丢 hover */
  denseSliceThreshold?: number;
  /** 主体高度（不含图例） */
  height?: number;
  /** 值格式化器（默认原始整数） */
  valueFormatter?: (v: number) => string;
}

function ActiveSliceShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 4}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
}

export function TypeDistributionPie({
  data,
  colors = DEFAULT_PIE_COLORS,
  emptyHint = "暂无数据",
  denseSliceThreshold = 5,
  height = 180,
  valueFormatter = (v) => String(v),
}: Props) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const hasData = data.length > 0 && data.some(d => d.value > 0);
  const paddingAngle = data.length >= denseSliceThreshold ? 1 : 3;

  if (!hasData) {
    return (
      <div
        className="w-full flex items-center justify-center text-sm text-gray-500 font-light"
        style={{ minHeight: height }}
      >
        {emptyHint}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div style={{ height, minHeight: Math.min(height, 160) }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={72}
              paddingAngle={paddingAngle}
              dataKey="value"
              nameKey="name"
              activeIndex={activeIndex}
              activeShape={ActiveSliceShape}
              onMouseEnter={(_, idx) => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(undefined)}
              isAnimationActive
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.02)" }}
              contentStyle={{
                background: "rgba(17,17,17,0.96)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 12,
                padding: "6px 10px",
              }}
              itemStyle={{ color: "#e5e7eb" }}
              labelStyle={{ color: "#94a3b8" }}
              formatter={(v: number, name: string) => [valueFormatter(v), name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
        {data.map((d, i) => (
          <span key={d.name} className="text-[10px] text-gray-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: colors[i % colors.length] }} />
            {d.name}
            <span className="text-gray-500">· {valueFormatter(d.value)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
