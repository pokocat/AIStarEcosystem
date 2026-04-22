"use client";

import * as React from "react";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Toolbar, FilterChip } from "@/components/shared/Toolbar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listStudios } from "@/api/studios";
import { STUDIO_KIND, STUDIO_STATUS } from "@/constants/status";
import { formatCredits } from "@/lib/format";
import type { AdminStudio } from "@/types/studio";

const STATUS_OPTIONS = [
  { value: "all",       label: "全部" },
  { value: "active",    label: "正常" },
  { value: "suspended", label: "暂停" },
  { value: "deleted",   label: "注销" },
];

const KIND_OPTIONS = [
  { value: "all",              label: "全部" },
  { value: "personal_creator", label: "个人创作者" },
  { value: "music_studio",     label: "音乐工作室" },
  { value: "drama_studio",     label: "短剧工作室" },
  { value: "variety_studio",   label: "综艺工作室" },
  { value: "agency",           label: "经纪公司" },
  { value: "mcn",              label: "MCN" },
];

export default function StudiosPage() {
  const { data } = useAsyncList(() => listStudios(0, 200));
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [kind, setKind] = React.useState("all");

  const rows = data.filter((s) => {
    if (status !== "all" && s.status !== status) return false;
    if (kind !== "all" && s.kind !== kind) return false;
    if (q && !s.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const columns: Column<AdminStudio>[] = [
    {
      key: "name",
      header: "工作室 / 经纪公司",
      render: (s) => (
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-violet-soft text-violet flex items-center justify-center ring-1 ring-violet/15">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">{s.name}</div>
            <div className="text-xs text-muted-foreground truncate">@{s.ownerUsername} · {s.contactEmail ?? "—"}</div>
          </div>
        </div>
      ),
    },
    {
      key: "kind",
      header: "类型",
      render: (s) => {
        const m = STUDIO_KIND[s.kind];
        return m ? <StatusBadge tone={mapTone(m.tone)} label={m.label} dot={false} /> : null;
      },
    },
    {
      key: "status",
      header: "状态",
      render: (s) => {
        const m = STUDIO_STATUS[s.status];
        return m ? <StatusBadge tone={mapTone(m.tone)} label={m.label} /> : null;
      },
    },
    { key: "artists", header: "艺人数",    align: "right", render: (s) => s.artistCount },
    { key: "songs",   header: "歌曲",     align: "right", render: (s) => s.songCount },
    { key: "total",   header: "累计收益", align: "right", render: (s) => <span className="tabular-nums">{formatCredits(s.totalRevenueCredits)}</span> },
    { key: "month",   header: "月度收益", align: "right", render: (s) => <span className="tabular-nums">{formatCredits(s.monthlyRevenueCredits)}</span> },
  ];

  const totalRevenue = data.reduce((s, r) => s + r.totalRevenueCredits, 0);
  const monthRevenue = data.reduce((s, r) => s + r.monthlyRevenueCredits, 0);

  return (
    <>
      <PageHeader
        title="经纪公司"
        description="Studio 档案 · AepUser ↔ Studio 1:1。聚合指标由后端 AdminStudioDto 提供"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="工作室总数" value={data.length} tone="primary" />
        <StatCard label="正常运营"   value={data.filter((s) => s.status === "active").length} tone="emerald" />
        <StatCard label="累计收益"   value={formatCredits(totalRevenue)} tone="sky" hint="全平台 credits" />
        <StatCard label="月度收益"   value={formatCredits(monthRevenue)} tone="violet" />
      </div>

      <Toolbar search={q} onSearchChange={setQ} searchPlaceholder="按名称搜索" className="mb-3">
        <FilterChip label="状态" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        <FilterChip label="类型" value={kind} options={KIND_OPTIONS} onChange={setKind} />
        <span className="text-xs text-muted-foreground ml-auto">{rows.length} 条</span>
      </Toolbar>

      <DataTable<AdminStudio> columns={columns} rows={rows} rowKey={(s) => s.id} />
    </>
  );
}
