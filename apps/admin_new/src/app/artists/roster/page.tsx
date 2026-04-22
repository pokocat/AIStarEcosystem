"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, Filter } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Toolbar, FilterChip } from "@/components/shared/Toolbar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listDigitalIps } from "@/api/digital-ips";
import { ARTIST_STATUS, ARTIST_QUALITY } from "@/constants/status";
import { ARTIST_TYPE_META } from "@/constants/artist-meta";
import { formatCompactNumber, formatCredits } from "@/lib/format";
import type { Artist } from "@/types/artist";

const STATUS_OPTIONS = [
  { value: "all",     label: "全部状态" },
  { value: "trainee", label: "练习生" },
  { value: "debut",   label: "新人出道" },
  { value: "active",  label: "活跃艺人" },
  { value: "rest",    label: "休整中" },
  { value: "retired", label: "已退役" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "全部类型" },
  ...Object.entries(ARTIST_TYPE_META).map(([v, m]) => ({ value: v, label: m.label })),
];

export default function ArtistRosterPage() {
  const { data: all, loading } = useAsyncList(() => listDigitalIps(0, 500));
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [type, setType] = React.useState("all");

  const rows = all.filter((a) => {
    if (status !== "all" && a.status !== status) return false;
    if (type !== "all" && a.type !== type) return false;
    if (q && !a.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const columns: Column<Artist>[] = [
    {
      key: "name",
      header: "艺人",
      render: (a) => (
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-full bg-muted overflow-hidden shrink-0 ring-1 ring-border">
            {a.avatar && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={a.avatar} alt={a.name} className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <Link href={`/artists/roster/${a.id}`} className="font-medium hover:text-primary truncate block">
              {a.name}
            </Link>
            <div className="text-xs text-muted-foreground truncate">
              {ARTIST_TYPE_META[a.type]?.icon} {ARTIST_TYPE_META[a.type]?.label} · Lv.{a.level}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "状态",
      render: (a) => {
        const s = ARTIST_STATUS[a.status];
        return s ? <StatusBadge tone={mapTone(s.tone)} label={s.label} /> : null;
      },
    },
    {
      key: "quality",
      header: "品质",
      render: (a) => {
        const q = ARTIST_QUALITY[a.quality];
        return q ? <StatusBadge tone={mapTone(q.tone)} label={q.label} dot={false} /> : null;
      },
    },
    { key: "studio", header: "所属公司", render: (a) => <span className="text-muted-foreground">{a.studioName ?? a.studioId}</span> },
    { key: "fans",    header: "粉丝",       align: "right", render: (a) => formatCompactNumber(a.stats.fans) },
    { key: "songs",   header: "歌曲",       align: "right", render: (a) => a.stats.songs },
    { key: "revenue", header: "累计收益",    align: "right", render: (a) => <span className="tabular-nums">{formatCredits(a.stats.revenue)}</span> },
    { key: "popularity", header: "人气",    align: "right", render: (a) => <span className="tabular-nums">{a.stats.popularity}</span> },
  ];

  return (
    <>
      <PageHeader
        title="艺人档案"
        description="全站虚拟 IP 档案 · 包含生命周期状态、商业价值与所属工作室"
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Sparkles className="h-4 w-4" /> 创建艺人
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="全站艺人" value={all.length} tone="primary" />
        <StatCard label="活跃艺人" value={all.filter((a) => a.status === "active").length} tone="emerald" />
        <StatCard label="练习生/新人" value={all.filter((a) => a.status === "trainee" || a.status === "debut").length} tone="violet" />
        <StatCard label="合计粉丝" value={formatCompactNumber(all.reduce((s, a) => s + a.stats.fans, 0))} tone="sky" />
      </div>

      <Toolbar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="按艺人名搜索"
        className="mb-3"
      >
        <FilterChip label="状态" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        <FilterChip label="类型" value={type} options={TYPE_OPTIONS} onChange={setType} />
        <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5" /> 共 {rows.length} 位艺人
        </span>
      </Toolbar>

      <DataTable<Artist>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={(r) => { window.location.href = `/artists/roster/${r.id}`; }}
        emptyTitle={loading ? "加载中…" : "暂无符合条件的艺人"}
      />
    </>
  );
}
