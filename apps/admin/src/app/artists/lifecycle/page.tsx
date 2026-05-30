"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Flame, BadgeCheck, Pause, XCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatCompactNumber, formatCredits } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionDialog } from "@/components/ActionDialog";
import { listDigitalIps } from "@/api/digital-ips";
import { ARTIST_STATUS, ARTIST_QUALITY } from "@/constants/status";
import { ARTIST_TYPE_META, ARTIST_NEXT_STATUS } from "@/constants/artist-meta";
import type { Artist, ArtistStatus } from "@/types/artist";

const LIFECYCLE_COLUMNS: { status: ArtistStatus; label: string; tone: string }[] = [
  { status: "trainee", label: "练习生", tone: "bg-slate-50 border-slate-200" },
  { status: "debut", label: "出道新人", tone: "bg-sky-50/60 border-sky-200" },
  { status: "active", label: "活跃艺人", tone: "bg-emerald-50/60 border-emerald-200" },
  { status: "rest", label: "休整中", tone: "bg-amber-50/60 border-amber-200" },
  { status: "retired", label: "已退役", tone: "bg-rose-50/60 border-rose-200" },
];

export default function ArtistLifecyclePage() {
  const [artists, setArtists] = React.useState<Artist[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [target, setTarget] = React.useState<{ artist: Artist; to: string; label: string } | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listDigitalIps(0, 500);
        if (active) setArtists(data);
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const counts = LIFECYCLE_COLUMNS.reduce<Record<string, number>>((acc, col) => {
    acc[col.status] = artists.filter((a) => a.status === col.status).length;
    return acc;
  }, {});

  return (
    <div className="admin-page">
      <PageHeader
        title="艺人生命周期"
        description="练习生 → 出道 → 活跃 / 休整 / 退役 的状态流转"
        breadcrumb={[{ label: "艺人与经纪" }, { label: "生命周期" }]}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/artists/roster">查看全部档案 <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {LIFECYCLE_COLUMNS.map((c) => (
          <StatCard
            key={c.status}
            label={c.label}
            value={counts[c.status] ?? 0}
            icon={
              c.status === "trainee"
                ? Flame
                : c.status === "debut"
                ? Sparkles
                : c.status === "active"
                ? BadgeCheck
                : c.status === "rest"
                ? Pause
                : XCircle
            }
            tone={c.status === "trainee" ? "warning" : c.status === "retired" ? "danger" : "default"}
          />
        ))}
      </section>

      {loading && <div className="py-6 text-center text-sm text-muted-foreground">加载中…</div>}
      {!loading && loadError && <div className="py-6 text-center text-sm text-rose-600">加载失败：{loadError}</div>}

      {/* Kanban-style lifecycle board */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {LIFECYCLE_COLUMNS.map((col) => {
          const items = artists.filter((a) => a.status === col.status);
          return (
            <div key={col.status} className={"rounded-lg border p-3 " + col.tone}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold">{col.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
              </div>
              <div className="space-y-2.5">
                {items.map((a) => {
                  const typeMeta = ARTIST_TYPE_META[a.type];
                  const expPct = Math.round((a.exp / a.maxExp) * 100);
                  const next = ARTIST_NEXT_STATUS[a.status] ?? [];
                  return (
                    <div key={a.id} className="rounded-lg border border-border bg-surface p-3 card-shadow">
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={a.avatar} alt={a.name} />
                          <AvatarFallback>{a.name.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{a.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {typeMeta.icon} {typeMeta.label} · 等级 {a.level}
                          </div>
                        </div>
                        <StatusBadge meta={ARTIST_QUALITY[a.quality]} />
                      </div>

                      <div className="space-y-1 mb-2.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                          <span>经验 {a.exp}/{a.maxExp}</span>
                          <span>{expPct}%</span>
                        </div>
                        <Progress value={expPct} />
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs mb-2.5">
                        <div>
                          <div className="text-muted-foreground">粉丝</div>
                          <div className="tabular-nums font-medium">{formatCompactNumber(a.stats.fans)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">月收益</div>
                          <div className="tabular-nums font-medium">{formatCredits(a.stats.monthlyRevenue)}</div>
                        </div>
                      </div>

                      {next.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {next.map((n) => (
                            <Button
                              key={n.to}
                              size="sm"
                              variant={n.to === "retired" ? "destructive" : "outline"}
                              className="text-xs px-2 h-7"
                              onClick={() => setTarget({ artist: a, to: n.to, label: n.label })}
                            >
                              {n.label}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground italic">终态</div>
                      )}
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-6">暂无艺人</div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {target && (
        <ActionDialog
          open={!!target}
          onOpenChange={(open) => !open && setTarget(null)}
          title={target.label}
          description={`艺人：${target.artist.name} · 当前状态：${ARTIST_STATUS[target.artist.status]?.label ?? target.artist.status}`}
          tone={target.to === "retired" ? "danger" : target.to === "rest" ? "warning" : "primary"}
          confirmLabel="确认流转"
          requireReason
          reasonPlaceholder="请填写流转依据，将写入艺人档案与审计日志"
        />
      )}
    </div>
  );
}
