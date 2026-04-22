"use client";

import * as React from "react";
import { PartyPopper, CalendarPlus } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Toolbar, FilterChip } from "@/components/shared/Toolbar";
import { Section } from "@/components/shared/Section";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listEvents, getFanGrowth, listFanTiers } from "@/api/community";
import { COMMUNITY_EVENT_STATUS, COMMUNITY_EVENT_TYPE } from "@/constants/status";
import { formatCompactNumber } from "@/lib/format";
import type { CommunityEvent } from "@/types/community";

const STATUS_OPTIONS = [
  { value: "all",      label: "全部" },
  { value: "live",     label: "进行中" },
  { value: "upcoming", label: "即将开始" },
  { value: "ended",    label: "已结束" },
];

export default function EventsPage() {
  const events = useAsyncList(() => listEvents());
  const growth = useAsyncList(() => getFanGrowth());
  const tiers = useAsyncList(() => listFanTiers());

  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const rows = events.data.filter((e) => {
    if (status !== "all" && e.status !== status) return false;
    if (q && !e.title.includes(q)) return false;
    return true;
  });

  const columns: Column<CommunityEvent>[] = [
    { key: "title", header: "活动", render: (e) => (
      <div className="min-w-0">
        <div className="font-medium truncate">{e.title}</div>
        <div className="text-xs text-muted-foreground">{COMMUNITY_EVENT_TYPE[e.type]}</div>
      </div>
    )},
    { key: "date", header: "日期", render: (e) => <span className="text-muted-foreground">{e.date}</span> },
    { key: "participants", header: "参与人数", align: "right", render: (e) => <span className="tabular-nums">{formatCompactNumber(e.participants)}</span> },
    { key: "status", header: "状态",
      render: (e) => {
        const s = COMMUNITY_EVENT_STATUS[e.status];
        return s ? <StatusBadge tone={mapTone(s.tone)} label={s.label} /> : null;
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="社群活动"
        description="粉丝投票 / 见面会 / 挑战赛 / 纪念活动"
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <CalendarPlus className="h-4 w-4" /> 新建活动
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon={PartyPopper} label="活动总数" value={events.data.length} tone="primary" />
        <StatCard label="进行中" value={events.data.filter((e) => e.status === "live").length} tone="emerald" />
        <StatCard label="即将开始" value={events.data.filter((e) => e.status === "upcoming").length} tone="amber" />
        <StatCard label="累计参与" value={formatCompactNumber(events.data.reduce((s, e) => s + e.participants, 0))} tone="violet" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Section className="lg:col-span-2" title="粉丝增长曲线">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growth.data} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="fanGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chart-4)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--color-chart-4)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <YAxis tickFormatter={(v) => formatCompactNumber(v as number)} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <Tooltip formatter={(v) => formatCompactNumber(v as number)} contentStyle={{ borderRadius: 8, borderColor: "var(--color-border)", fontSize: 12 }} />
                <Area type="monotone" dataKey="fans" stroke="var(--color-chart-4)" strokeWidth={2} fill="url(#fanGrad)" />
                <Area type="monotone" dataKey="active" stroke="var(--color-chart-2)" strokeWidth={2} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="粉丝层级">
          <div className="space-y-2">
            {tiers.data.map((t) => (
              <div key={t.name} className={`flex items-center gap-2 rounded-md px-3 py-2 ${t.bg}`}>
                <span className="text-lg">{t.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${t.color}`}>{t.name}</div>
                </div>
                <div className="tabular-nums font-semibold">{formatCompactNumber(t.count)}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Toolbar search={q} onSearchChange={setQ} searchPlaceholder="按活动标题搜索" className="mb-3">
        <FilterChip label="状态" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
      </Toolbar>
      <DataTable<CommunityEvent> columns={columns} rows={rows} rowKey={(e) => e.id} />
    </>
  );
}
