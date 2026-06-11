"use client";

// 分成收益 — KPI 卡、GMV 趋势（Recharts AreaChart）、按月分成明细。

import * as React from "react";
import { Coins } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { StarRevenueSummary } from "@ai-star-eco/types";
import { StarWorkbenchApi } from "@/api";
import { formatWanYuan, formatYuan } from "@/lib/format";
import { EmptyState, InlineError, LoadingList, PageHeader } from "@/components/star/page-kit";

const GOLD = "#f59e0b";

export default function RevenuePage() {
  const [summary, setSummary] = React.useState<StarRevenueSummary | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    StarWorkbenchApi.getRevenue()
      .then(setSummary)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  if (!summary) {
    return (
      <div className="p-6 space-y-5 max-w-5xl">
        <PageHeader title="分成收益" sub="GMV 透明可追溯，按月结算" />
        <InlineError message={error} onDismiss={() => setError(null)} />
        {error ? <EmptyState icon={Coins} title="收益数据加载失败" /> : <LoadingList />}
      </div>
    );
  }

  const kpis = [
    { label: "累计 GMV", value: formatWanYuan(summary.totalGmvCents), color: "#ec4899" },
    { label: "本月 GMV", value: formatWanYuan(summary.monthGmvCents), color: "#0891b2" },
    { label: "待结算", value: formatWanYuan(summary.pendingAmountCents), color: GOLD },
    { label: "已结算", value: formatWanYuan(summary.paidAmountCents), color: "#16a34a" },
  ];

  const chartData = summary.months.map((m) => ({
    month: `${parseInt(m.month.slice(5), 10)}月`,
    gmv: Math.round(m.gmvCents / 100),
  }));

  const detailRows = [...summary.months].reverse().filter((m) => m.gmvCents > 0 || m.status === "processing");

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <PageHeader title="分成收益" sub="GMV 带货趋势与按月分成结算（T+1 月 15 日打款）" />

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="star-card px-4 py-3.5">
            <div className="text-[11px]" style={{ color: "var(--ink-1)" }}>{k.label}</div>
            <div className="text-xl font-black mt-1 tabular" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* GMV 趋势 */}
      <div className="star-card p-5">
        <h3 className="text-sm font-bold mb-4" style={{ color: "var(--ink-0)" }}>GMV 带货趋势</h3>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="starGmvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GOLD} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="month" tick={{ fill: "#a8a29e", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: "#a8a29e", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={56}
                tickFormatter={(v: number) => (v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v))}
              />
              <Tooltip
                formatter={(value) => [`¥${Number(value).toLocaleString("en-US")}`, "GMV"]}
                contentStyle={{
                  background: "var(--bg-1)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  fontSize: 12,
                  boxShadow: "var(--shadow-lift)",
                  color: "var(--ink-0)",
                }}
              />
              <Area type="monotone" dataKey="gmv" stroke={GOLD} fill="url(#starGmvGrad)" strokeWidth={2} dot={false} name="GMV" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 月度明细 */}
      <div className="space-y-2">
        {detailRows.map((item) => (
          <div key={item.id} className="star-card star-card-hover flex items-center justify-between p-4">
            <div>
              <div className="text-sm font-semibold tabular" style={{ color: "var(--ink-0)" }}>{item.month}</div>
              <div className="text-[11px] mt-0.5 tabular" style={{ color: "var(--ink-2)" }}>
                GMV {formatWanYuan(item.gmvCents)} × {item.sharePercent}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-base font-black tabular" style={{ color: "var(--star-gold-deep)" }}>{formatYuan(item.amountCents)}</div>
              <div className="text-[10px] mt-0.5 font-semibold" style={{ color: item.status === "paid" ? "var(--ok)" : "var(--info)" }}>
                {item.status === "paid" ? "已到账" : "结算中"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
