"use client";

import * as React from "react";
import { Disc3, CheckCircle2, XCircle, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionDialog } from "@/components/ActionDialog";
import { listAlbums } from "@/api/music";
import { ALBUM_STATUS } from "@/constants/status";
import type { Album } from "@/types/music";
import { formatCurrencyCN, formatCountCN } from "@/lib/utils";

export default function AlbumsPage() {
  const [albums, setAlbums] = React.useState<Album[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [target, setTarget] = React.useState<Album | null>(null);
  const [action, setAction] = React.useState<"approve" | "schedule" | "reject" | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listAlbums();
        if (active) setAlbums(data);
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // 遗留字段 @deprecated（product_spec.md §10.4）；本页面 P1 迁 "歌单运营" 后重写。
  const counts = {
    planning: albums.filter((a) => a.status === "planning").length,
    recording: albums.filter((a) => a.status === "recording").length,
    released: albums.filter((a) => a.status === "released").length,
  };
  const albumStatus = (a: Album) => a.status ?? "released";

  return (
    <div className="admin-page">
      <PageHeader
        title="专辑审核"
        description="专辑发行排期、物料准备与上线审核"
        breadcrumb={[{ label: "内容审核" }, { label: "专辑审核" }]}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="筹备中" value={counts.planning} icon={CalendarClock} />
        <StatCard label="制作中" value={counts.recording} icon={Disc3} tone="warning" />
        <StatCard label="已发行" value={counts.released} icon={CheckCircle2} tone="success" />
        <StatCard
          label="累计销量"
          value={formatCountCN(albums.reduce((a, b) => a + (b.sales ?? 0), 0))}
          hint="全部专辑合计"
          icon={Disc3}
        />
      </section>

      {loading && <div className="py-8 text-center text-sm text-muted-foreground">加载中…</div>}
      {!loading && loadError && <div className="py-8 text-center text-sm text-rose-600">加载失败：{loadError}</div>}

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {!loading && !loadError && albums.length === 0 && (
          <div className="col-span-full py-8 text-center text-sm text-muted-foreground">暂无专辑</div>
        )}
        {albums.map((a) => (
          <Card key={a.id}>
            <CardHeader className="flex-row gap-4 items-center">
              <div className="relative h-16 w-16 rounded-md overflow-hidden bg-surface-muted shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.cover} alt={a.name} className="h-full w-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="truncate">{a.name}</CardTitle>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {a.trackCount ?? a.trackIds.length} 首 · ID {a.id}
                </div>
                <div className="mt-1.5">
                  <StatusBadge meta={ALBUM_STATUS[albumStatus(a)]} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <dl className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div>
                  <dt className="text-xs text-muted-foreground">销量</dt>
                  <dd className="tabular-nums font-medium">{formatCountCN(a.sales ?? 0)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">销售额</dt>
                  <dd className="tabular-nums font-medium">{formatCurrencyCN(a.revenue ?? 0)}</dd>
                </div>
              </dl>
              <div className="flex items-center gap-1.5">
                {albumStatus(a) !== "released" ? (
                  <>
                    <Button
                      size="sm"
                      variant="success"
                      className="flex-1"
                      onClick={() => {
                        setTarget(a);
                        setAction("approve");
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> 批准发行
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setTarget(a);
                        setAction("schedule");
                      }}
                    >
                      <CalendarClock className="h-3.5 w-3.5" /> 排期
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setTarget(a);
                        setAction("reject");
                      }}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" className="flex-1">
                    查看详情
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {target && action && (
        <ActionDialog
          open={!!target}
          onOpenChange={(open) => {
            if (!open) {
              setTarget(null);
              setAction(null);
            }
          }}
          title={
            action === "approve"
              ? `批准《${target.name}》发行`
              : action === "schedule"
              ? `排期《${target.name}》`
              : `驳回《${target.name}》`
          }
          description={`${target.trackCount ?? target.trackIds.length} 首曲目 · 当前状态 ${ALBUM_STATUS[albumStatus(target)]?.label ?? ""}`}
          tone={action === "reject" ? "danger" : action === "approve" ? "success" : "warning"}
          confirmLabel={action === "approve" ? "立即发行" : action === "schedule" ? "设定上架日期" : "驳回"}
          requireReason={action === "reject"}
        />
      )}
    </div>
  );
}
