"use client";

import * as React from "react";
import { Disc3 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Toolbar } from "@/components/shared/Toolbar";
import { StatCard } from "@/components/shared/StatCard";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listAlbums } from "@/api/music";
import type { Album } from "@/types/music";

export default function AlbumsPage() {
  const { data } = useAsyncList(() => listAlbums());
  const [q, setQ] = React.useState("");
  const rows = data.filter((a) => !q || a.name.includes(q));

  const columns: Column<Album>[] = [
    {
      key: "album",
      header: "专辑 / 歌单",
      render: (a) => (
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-md bg-muted overflow-hidden shrink-0 ring-1 ring-border">
            {a.cover && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={a.cover} alt={a.name} className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">{a.name}</div>
            <div className="text-xs text-muted-foreground">艺人 {a.artistId}</div>
          </div>
        </div>
      ),
    },
    { key: "tracks", header: "曲目数", align: "right", render: (a) => a.trackIds?.length ?? a.trackCount ?? 0 },
    { key: "created", header: "创建时间", render: (a) => <span className="text-muted-foreground">{a.createdAt?.slice(0, 10) ?? "—"}</span> },
  ];

  return (
    <>
      <PageHeader
        title="专辑 / 歌单"
        description="AI 歌手合集 · product_spec.md §10.4：数字音乐无实体专辑，无销售生命周期"
      />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <StatCard icon={Disc3} label="专辑数" value={data.length} tone="primary" />
        <StatCard label="总曲目" value={data.reduce((s, a) => s + (a.trackIds?.length ?? 0), 0)} tone="violet" />
        <StatCard label="本月新增" value={data.filter((a) => (a.createdAt ?? "").startsWith(new Date().toISOString().slice(0, 7))).length} tone="emerald" />
      </div>
      <Toolbar search={q} onSearchChange={setQ} searchPlaceholder="按专辑名搜索" className="mb-3" />
      <DataTable<Album> columns={columns} rows={rows} rowKey={(a) => a.id} />
    </>
  );
}
