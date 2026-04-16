"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { conversionFunnel, creditTrend } from "@/lib/admin-data";
import type { TimeRange } from "@/types/admin";

const trendConfig = {
  consume: { label: "消耗", color: "var(--chart-1)" },
  recharge: { label: "充入", color: "var(--chart-2)" },
  refund: { label: "退回", color: "var(--chart-3)" },
} satisfies ChartConfig;

const funnelConfig = {
  value: { label: "人数", color: "var(--chart-2)" },
} satisfies ChartConfig;

const rangeText: Record<TimeRange, string> = {
  today: "今日视角",
  week: "本周视角",
  month: "本月视角",
};

export function DashboardCharts({ range }: { range: TimeRange }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
      <Card className="border-white/70 bg-white/82 shadow-[0_18px_40px_rgba(15,23,42,0.05)] backdrop-blur">
        <CardHeader className="gap-2">
          <CardTitle>积分充消趋势</CardTitle>
          <CardDescription>{rangeText[range]}，聚焦最近 7 天平台层面的充入、消耗与退款走势。</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer className="h-[300px] w-full" config={trendConfig}>
            <LineChart data={creditTrend} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis axisLine={false} dataKey="day" tickLine={false} tickMargin={8} />
              <YAxis axisLine={false} tickLine={false} width={56} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Line dataKey="consume" dot={false} stroke="var(--color-consume)" strokeWidth={2.5} type="monotone" />
              <Line dataKey="recharge" dot={false} stroke="var(--color-recharge)" strokeWidth={2.5} type="monotone" />
              <Line dataKey="refund" dot={false} stroke="var(--color-refund)" strokeWidth={2.5} type="monotone" />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-white/70 bg-white/82 shadow-[0_18px_40px_rgba(15,23,42,0.05)] backdrop-blur">
        <CardHeader className="gap-2">
          <CardTitle>升级转化漏斗</CardTitle>
          <CardDescription>{rangeText[range]}，按注册、激活、升级 Pro、升级 Enterprise 依次观察。</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer className="h-[300px] w-full" config={funnelConfig}>
            <BarChart data={conversionFunnel} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid horizontal={false} />
              <XAxis axisLine={false} dataKey="value" tickLine={false} type="number" />
              <YAxis axisLine={false} dataKey="stage" tickLine={false} type="category" width={84} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={8} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
