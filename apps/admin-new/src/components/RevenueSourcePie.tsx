"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { RevenueSource } from "@/types/finance";

interface Props {
  data: RevenueSource[];
}

export function RevenueSourcePie({ data }: Props) {
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={2}>
            {data.map((s) => (
              <Cell key={s.name} fill={s.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: 8, border: "1px solid oklch(0.92 0.005 264)", fontSize: 12 }}
            formatter={(v: number, _n, ctx) => [`${v}%`, ctx?.payload?.name]}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="space-y-1.5 text-xs flex-1">
        {data.map((s) => (
          <li key={s.name} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              <span className="text-foreground">{s.name}</span>
            </span>
            <span className="tabular-nums text-muted-foreground">{s.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
