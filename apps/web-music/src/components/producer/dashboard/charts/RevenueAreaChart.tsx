"use client";

// ─────────────────────────────────────────────────────────────────────────────
// RevenueAreaChart.tsx
// 月度收入面积图。来源：FinanceApi.getMonthlyRevenue()。
// 修复：tooltip 深色底上文字不可见、cursor 线、minHeight 兜底。
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { MonthlyRevenuePoint } from "@ai-star-eco/types/finance";
import { formatCompactNumber, formatCredits } from "@/lib/format";

interface Props {
  data: MonthlyRevenuePoint[];
  height?: number;
  emptyHint?: string;
}

export function RevenueAreaChart({ data, height = 280, emptyHint = "暂无收入数据" }: Props) {
  if (data.length === 0) {
    return (
      <div
        className="w-full flex items-center justify-center text-sm text-gray-500 font-light"
        style={{ minHeight: 200, height }}
      >
        {emptyHint}
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height} minHeight={200}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="areaRevGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="month" stroke="#555" fontSize={12} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
        <YAxis stroke="#555" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompactNumber(v)} />
        <Tooltip
          cursor={{ stroke: "rgba(6,182,212,0.35)", strokeWidth: 1 }}
          contentStyle={{
            background: "rgba(17,17,17,0.96)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            fontSize: 12,
            padding: "6px 10px",
          }}
          itemStyle={{ color: "#e5e7eb" }}
          labelStyle={{ color: "#94a3b8" }}
          formatter={(v: number) => [formatCredits(v), "收入"]}
        />
        <Area type="monotone" dataKey="revenue" stroke="#06b6d4" fill="url(#areaRevGrad)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
