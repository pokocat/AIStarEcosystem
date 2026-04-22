"use client";

import * as React from "react";
import Link from "next/link";
import { Music2, PlayCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Toolbar, FilterChip } from "@/components/shared/Toolbar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listSongs } from "@/api/music";
import { SONG_STATUS } from "@/constants/status";
import { formatCompactNumber, formatCredits, formatDuration } from "@/lib/format";
import type { Song } from "@/types/music";

const STATUS_OPTIONS = [
  { value: "all",       label: "全部状态" },
  { value: "recording", label: "录制中" },
  { value: "mixing",    label: "混音中" },
  { value: "released",  label: "已发行" },
];

export default function SongsPage() {
  const { data } = useAsyncList(() => listSongs());
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("all");

  const rows = data.filter((s) => {
    if (status !== "all" && s.status !== status) return false;
    if (q && !(s.title.includes(q) || s.artistName?.includes(q))) return false;
    return true;
  });

  const columns: Column<Song>[] = [
    {
      key: "song",
      header: "歌曲",
      render: (s) => (
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-md bg-muted overflow-hidden shrink-0 ring-1 ring-border relative group">
            {s.coverUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={s.coverUrl} alt={s.title} className="h-full w-full object-cover" />
            )}
            <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <PlayCircle className="h-5 w-5" />
            </span>
          </div>
          <div className="min-w-0">
            <Link href={`/content/songs/${s.id}`} className="font-medium hover:text-primary truncate block">
              {s.title}
            </Link>
            <div className="text-xs text-muted-foreground truncate">
              {s.artistName ?? s.artistId} · {s.genre}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "状态",
      render: (s) => {
        const m = SONG_STATUS[s.status];
        return m ? <StatusBadge tone={mapTone(m.tone)} label={m.label} /> : null;
      },
    },
    { key: "model",    header: "模型 / 深度", render: (s) => <span className="text-xs text-muted-foreground">{s.modelVersion ?? "—"} · {s.thinkDepth ?? "—"}</span> },
    { key: "duration", header: "时长",       align: "right", render: (s) => formatDuration(s.duration) },
    { key: "plays",    header: "播放量",     align: "right", render: (s) => <span className="tabular-nums">{formatCompactNumber(s.plays)}</span> },
    { key: "revenue",  header: "收益",       align: "right", render: (s) => <span className="tabular-nums">{formatCredits(s.revenue)}</span> },
    { key: "credits",  header: "生成扣费",    align: "right", render: (s) => <span className="tabular-nums text-muted-foreground">{s.creditsSpent ?? "—"}</span> },
    { key: "rating",   header: "评分",       align: "right", render: (s) => s.rating > 0 ? s.rating.toFixed(1) : "—" },
  ];

  const totalPlays = data.reduce((s, x) => s + x.plays, 0);
  const totalRev = data.reduce((s, x) => s + x.revenue, 0);
  const released = data.filter((s) => s.status === "released").length;

  return (
    <>
      <PageHeader
        title="歌曲管理"
        description="全站歌曲库 · 点击行查看详情、人工复核或下架"
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon={Music2} label="歌曲总数" value={data.length} tone="primary" />
        <StatCard label="已发行" value={released} tone="emerald" />
        <StatCard label="累计播放" value={formatCompactNumber(totalPlays)} tone="sky" />
        <StatCard label="累计收益" value={formatCredits(totalRev)} tone="violet" />
      </div>

      <Toolbar search={q} onSearchChange={setQ} searchPlaceholder="按歌名或艺人搜索" className="mb-3">
        <FilterChip label="状态" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        <span className="text-xs text-muted-foreground ml-auto">{rows.length} 首</span>
      </Toolbar>

      <DataTable<Song>
        columns={columns}
        rows={rows}
        rowKey={(s) => s.id}
        onRowClick={(s) => { window.location.href = `/content/songs/${s.id}`; }}
      />
    </>
  );
}
