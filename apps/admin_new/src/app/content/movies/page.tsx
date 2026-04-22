"use client";

import * as React from "react";
import { Film } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Toolbar, FilterChip } from "@/components/shared/Toolbar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listMovies } from "@/api/film";
import { MOVIE_STATUS } from "@/constants/status";
import { formatCompactNumber, formatCredits } from "@/lib/format";
import type { Movie } from "@/types/film";

const ROLE_LABEL: Record<string, string> = { lead: "主演", supporting: "配角", cameo: "客串" };

const STATUS_OPTIONS = [
  { value: "all",              label: "全部" },
  { value: "pre-production",   label: "前期筹备" },
  { value: "filming",          label: "拍摄中" },
  { value: "post-production",  label: "后期制作" },
  { value: "released",         label: "已上映" },
];

export default function MoviesPage() {
  const { data } = useAsyncList(() => listMovies());
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const rows = data.filter((m) => {
    if (status !== "all" && m.status !== status) return false;
    if (q && !(m.title.includes(q) || m.genre.includes(q))) return false;
    return true;
  });

  const columns: Column<Movie>[] = [
    { key: "title", header: "电影",
      render: (m) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{m.title}</div>
          <div className="text-xs text-muted-foreground">{m.genre} · {ROLE_LABEL[m.role]}</div>
        </div>
      ),
    },
    { key: "status", header: "状态",
      render: (m) => {
        const s = MOVIE_STATUS[m.status];
        return s ? <StatusBadge tone={mapTone(s.tone)} label={s.label} /> : null;
      },
    },
    { key: "box", header: "票房",   align: "right", render: (m) => <span className="tabular-nums">{formatCompactNumber(m.boxOffice)}</span> },
    { key: "rev", header: "分成收益", align: "right", render: (m) => <span className="tabular-nums">{formatCredits(m.revenue)}</span> },
    { key: "rating", header: "评分", align: "right", render: (m) => m.rating > 0 ? m.rating.toFixed(1) : "—" },
  ];

  return (
    <>
      <PageHeader title="电影" description="电影角色与发行档案" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <StatCard icon={Film} label="电影总数" value={data.length} tone="primary" />
        <StatCard label="已上映"  value={data.filter((m) => m.status === "released").length} tone="emerald" />
        <StatCard label="累计票房" value={formatCompactNumber(data.reduce((s, m) => s + m.boxOffice, 0))} tone="violet" />
      </div>
      <Toolbar search={q} onSearchChange={setQ} searchPlaceholder="按标题 / 类型" className="mb-3">
        <FilterChip label="状态" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
      </Toolbar>
      <DataTable<Movie> columns={columns} rows={rows} rowKey={(m) => m.id} />
    </>
  );
}
