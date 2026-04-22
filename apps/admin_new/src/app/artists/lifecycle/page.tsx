"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listDigitalIps } from "@/api/digital-ips";
import { ARTIST_STATUS } from "@/constants/status";
import { ARTIST_TYPE_META, ARTIST_NEXT_STATUS } from "@/constants/artist-meta";
import type { Artist, ArtistStatus } from "@/types/artist";
import { cn } from "@/lib/utils";

const COLUMNS: { key: ArtistStatus; label: string; desc: string; accent: string }[] = [
  { key: "trainee", label: "练习生",   desc: "待出道评审",   accent: "bg-slate-100 text-slate-700" },
  { key: "debut",   label: "新人出道", desc: "上升期重点扶持", accent: "bg-info-soft text-info" },
  { key: "active",  label: "活跃艺人", desc: "稳定产出",     accent: "bg-success-soft text-success" },
  { key: "rest",    label: "休整中",   desc: "合约/调整中",   accent: "bg-warning-soft text-amber-700" },
  { key: "retired", label: "已退役",   desc: "历史档案",     accent: "bg-muted text-muted-foreground" },
];

export default function ArtistLifecyclePage() {
  const { data: artists, loading } = useAsyncList(() => listDigitalIps(0, 500));

  return (
    <>
      <PageHeader
        title="艺人生命周期"
        description="练习生 → 出道 → 活跃 → 休整 → 退役。拖拽或点击状态流转按钮进行审批。"
        actions={
          <Link
            href="/artists/roster"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
          >
            查看档案列表
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {COLUMNS.map((col) => {
          const rows = artists.filter((a) => a.status === col.key);
          return (
            <Section
              key={col.key}
              title={
                <div className="flex items-center justify-between gap-2">
                  <span>{col.label}</span>
                  <span className={cn("text-[11px] font-semibold rounded px-1.5 py-0.5", col.accent)}>{rows.length}</span>
                </div>
              }
              description={col.desc}
              padding={false}
              className="min-h-[320px]"
            >
              <div className="p-3 space-y-2 max-h-[560px] overflow-y-auto">
                {loading && (
                  <div className="text-xs text-muted-foreground">加载中…</div>
                )}
                {!loading && rows.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-6">暂无</div>
                )}
                {rows.map((a) => (
                  <LifecycleCard key={a.id} artist={a} />
                ))}
              </div>
            </Section>
          );
        })}
      </div>
    </>
  );
}

function LifecycleCard({ artist }: { artist: Artist }) {
  const typeMeta = ARTIST_TYPE_META[artist.type];
  const nextStates = ARTIST_NEXT_STATUS[artist.status] ?? [];

  return (
    <div className="rounded-lg border border-border bg-surface p-2.5 hover:card-elev-2 transition-shadow">
      <Link href={`/artists/roster/${artist.id}`} className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-full bg-muted overflow-hidden shrink-0 ring-1 ring-border">
          {artist.avatar && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={artist.avatar} alt={artist.name} className="h-full w-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{artist.name}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {typeMeta?.icon} {typeMeta?.label} · Lv.{artist.level}
          </div>
        </div>
      </Link>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>粉丝 {artist.stats.fans >= 1000 ? `${(artist.stats.fans/1000).toFixed(1)}K` : artist.stats.fans}</span>
        <span>人气 {artist.stats.popularity}</span>
      </div>
      {nextStates.length > 0 && (
        <div className="mt-2 space-y-1">
          {nextStates.map((n) => {
            const target = ARTIST_STATUS[n.to];
            return (
              <button
                key={n.to}
                className="w-full flex items-center justify-between gap-1 rounded-md border border-dashed border-border bg-card px-2 py-1 text-[11px] hover:border-primary hover:text-primary"
              >
                <span className="flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" /> {n.label}
                </span>
                {target && <StatusBadge tone={mapTone(target.tone)} label={target.label} dot={false} className="text-[10px] px-1.5 py-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

