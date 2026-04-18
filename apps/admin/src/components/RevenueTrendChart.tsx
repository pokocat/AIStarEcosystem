"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyRevenuePoint } from "@/types/finance";

interface Props {
  data: MonthlyRevenuePoint[];
}

export function RevenueTrendChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.52 0.18 264)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="oklch(0.52 0.18 264)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 264)" vertical={false} />
        <XAxis dataKey="month" stroke="oklch(0.52 0.02 264)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke="oklch(0.52 0.02 264)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => (v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v))}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid oklch(0.92 0.005 264)",
            fontSize: 12,
          }}
          formatter={(v: number) => [`¥${v.toLocaleString("zh-CN")}`, "收入"]}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="oklch(0.52 0.18 264)"
          strokeWidth={2}
          fill="url(#rev)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
