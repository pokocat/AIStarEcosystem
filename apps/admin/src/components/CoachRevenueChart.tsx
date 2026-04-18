"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CoachRevenuePoint } from "@/types/coach";

interface Props {
  data: CoachRevenuePoint[];
}

const FIELDS: { key: keyof Omit<CoachRevenuePoint, "month">; label: string; color: string }[] = [
  { key: "streaming",   label: "流媒体",  color: "oklch(0.52 0.18 264)" },
  { key: "endorsement", label: "代言",    color: "oklch(0.65 0.22 320)" },
  { key: "nft",         label: "数字藏品", color: "oklch(0.7 0.17 75)" },
  { key: "live",        label: "现场",    color: "oklch(0.62 0.16 152)" },
];

export function CoachRevenueChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
          contentStyle={{ borderRadius: 8, border: "1px solid oklch(0.92 0.005 264)", fontSize: 12 }}
          formatter={(v: number) => `¥${v.toLocaleString("zh-CN")}`}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        {FIELDS.map((f) => (
          <Bar key={f.key} dataKey={f.key} stackId="rev" fill={f.color} name={f.label} radius={[0, 0, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
