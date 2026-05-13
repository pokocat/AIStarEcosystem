"use client";

// ─────────────────────────────────────────────────────────────────────────────
// RevenueSourcePie.tsx
// 收入来源占比。来源：FinanceApi.getRevenueSources()（每个 source 自带 color）。
// 直接复用 TypeDistributionPie，只需把 value 渲染为百分比。
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import type { RevenueSource } from "@ai-star-eco/types/finance";
import { formatPercent } from "@/lib/format";
import { TypeDistributionPie } from "./TypeDistributionPie";

interface Props {
  data: RevenueSource[];
}

export function RevenueSourcePie({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="w-full flex items-center justify-center text-sm text-gray-500 font-light" style={{ minHeight: 180 }}>
        暂无收入来源数据
      </div>
    );
  }
  const chartData = data.map(d => ({ name: d.name, value: d.value }));
  const colors = data.map(d => d.color);

  return (
    <TypeDistributionPie
      data={chartData}
      colors={colors}
      valueFormatter={(v) => formatPercent(v)}
      emptyHint="暂无收入来源数据"
    />
  );
}
