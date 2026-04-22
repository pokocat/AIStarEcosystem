"use client";

import * as React from "react";
import { Mic2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Toolbar, FilterChip } from "@/components/shared/Toolbar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listConcerts } from "@/api/music";
import { CONCERT_STATUS } from "@/constants/status";
import type { Concert } from "@/types/music";

const STATUS_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "planning",  label: "筹备中" },
  { value: "selling",   label: "售票中" },
  { value: "completed", label: "已完成" },
];

export default function ConcertsPage() {
  const { data } = useAsyncList(() => listConcerts());
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const rows = data.filter((c) => {
    if (status !== "all" && c.status !== status) return false;
    if (q && !c.name.includes(q)) return false;
    return true;
  });

  const columns: Column<Concert>[] = [
    { key: "name", header: "演唱会", render: (c) => <span className="font-medium">{c.name}</span> },
    { key: "artist", header: "参演艺人", render: (c) => <span className="text-muted-foreground">{c.artistIds.join(" · ")}</span> },
    { key: "date", header: "开播时间", render: (c) => <span className="text-muted-foreground">{c.date?.slice(0, 16).replace("T", " ")}</span> },
    {
      key: "status", header: "状态",
      render: (c) => {
        const m = CONCERT_STATUS[c.status];
        return m ? <StatusBadge tone={mapTone(m.tone)} label={m.label} /> : null;
      },
    },
    { key: "stream", header: "直播链接", render: (c) => c.streamUrl ? <a href={c.streamUrl} className="text-primary hover:underline text-xs" target="_blank" rel="noreferrer">查看</a> : <span className="text-muted-foreground">—</span> },
  ];

  return (
    <>
      <PageHeader title="演唱会" description="线上直播活动 · 仅保留最简骨架（id / 艺人 / 日期 / 状态 / 链接）" />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <StatCard icon={Mic2} label="演唱会总数" value={data.length} tone="primary" />
        <StatCard label="售票中" value={data.filter((c) => c.status === "selling").length} tone="amber" />
        <StatCard label="已完成" value={data.filter((c) => c.status === "completed").length} tone="emerald" />
      </div>

      <Toolbar search={q} onSearchChange={setQ} searchPlaceholder="按名称搜索" className="mb-3">
        <FilterChip label="状态" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
      </Toolbar>

      <DataTable<Concert> columns={columns} rows={rows} rowKey={(c) => c.id} />
    </>
  );
}
