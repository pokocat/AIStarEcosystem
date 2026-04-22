"use client";

import * as React from "react";
import { Clapperboard } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Toolbar, FilterChip } from "@/components/shared/Toolbar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listDramas } from "@/api/film";
import { DRAMA_STATUS } from "@/constants/status";
import { formatCompactNumber, formatCredits } from "@/lib/format";
import type { Drama } from "@/types/film";

const STATUS_OPTIONS = [
  { value: "all",              label: "全部" },
  { value: "casting",          label: "选角中" },
  { value: "filming",          label: "拍摄中" },
  { value: "post-production",  label: "后期制作" },
  { value: "released",         label: "已上线" },
];

export default function DramasPage() {
  const { data } = useAsyncList(() => listDramas());
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const rows = data.filter((d) => {
    if (status !== "all" && d.status !== status) return false;
    if (q && !(d.title.includes(q) || d.genre.includes(q))) return false;
    return true;
  });

  const columns: Column<Drama>[] = [
    { key: "title", header: "作品",
      render: (d) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{d.title}</div>
          <div className="text-xs text-muted-foreground">{d.genre} · {d.role} · {d.episodes} 集</div>
        </div>
      ),
    },
    {
      key: "status", header: "状态",
      render: (d) => {
        const m = DRAMA_STATUS[d.status];
        return m ? <StatusBadge tone={mapTone(m.tone)} label={m.label} /> : null;
      },
    },
    { key: "views",   header: "播放量", align: "right", render: (d) => <span className="tabular-nums">{formatCompactNumber(d.views)}</span> },
    { key: "revenue", header: "收益",  align: "right", render: (d) => <span className="tabular-nums">{formatCredits(d.revenue)}</span> },
    { key: "rating",  header: "评分",  align: "right", render: (d) => d.rating > 0 ? d.rating.toFixed(1) : "—" },
    { key: "date",    header: "上线时间", render: (d) => <span className="text-muted-foreground">{d.releaseDate?.slice(0, 10) ?? "—"}</span> },
  ];

  return (
    <>
      <PageHeader title="短剧" description="虚拟演员短剧项目库" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon={Clapperboard} label="短剧总数" value={data.length} tone="primary" />
        <StatCard label="已上线"  value={data.filter((d) => d.status === "released").length} tone="emerald" />
        <StatCard label="拍摄中"  value={data.filter((d) => d.status === "filming").length} tone="amber" />
        <StatCard label="累计收益" value={formatCredits(data.reduce((s, d) => s + d.revenue, 0))} tone="violet" />
      </div>
      <Toolbar search={q} onSearchChange={setQ} searchPlaceholder="按标题 / 类型搜索" className="mb-3">
        <FilterChip label="状态" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
      </Toolbar>
      <DataTable<Drama> columns={columns} rows={rows} rowKey={(d) => d.id} />
    </>
  );
}
