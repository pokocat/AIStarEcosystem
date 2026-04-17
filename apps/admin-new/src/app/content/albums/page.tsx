"use client";

import * as React from "react";
import { Disc3, CheckCircle2, XCircle, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionDialog } from "@/components/ActionDialog";
import { ALBUMS } from "@/mocks/music";
import { ALBUM_STATUS } from "@/constants/status";
import type { Album } from "@/types/music";
import { formatCurrencyCN, formatCountCN } from "@/lib/utils";

export default function AlbumsPage() {
  const [target, setTarget] = React.useState<Album | null>(null);
  const [action, setAction] = React.useState<"approve" | "schedule" | "reject" | null>(null);

  const counts = {
    planning: ALBUMS.filter((a) => a.status === "planning").length,
    recording: ALBUMS.filter((a) => a.status === "recording").length,
    released: ALBUMS.filter((a) => a.status === "released").length,
  };

  return (
    <div className="max-w-screen-2xl mx-auto">
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
          value={formatCountCN(ALBUMS.reduce((a, b) => a + b.sales, 0))}
          hint="全部专辑合计"
          icon={Disc3}
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {ALBUMS.map((a) => (
          <Card key={a.id}>
            <CardHeader className="flex-row gap-4 items-center">
              <div className="relative h-16 w-16 rounded-md overflow-hidden bg-surface-muted shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.cover} alt={a.name} className="h-full w-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="truncate">{a.name}</CardTitle>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {a.trackCount} 首 · ID {a.id}
                </div>
                <div className="mt-1.5">
                  <StatusBadge meta={ALBUM_STATUS[a.status]} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <dl className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div>
                  <dt className="text-xs text-muted-foreground">销量</dt>
                  <dd className="tabular-nums font-medium">{formatCountCN(a.sales)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">销售额</dt>
                  <dd className="tabular-nums font-medium">{formatCurrencyCN(a.revenue)}</dd>
                </div>
              </dl>
              <div className="flex items-center gap-1.5">
                {a.status !== "released" ? (
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
          description={`${target.trackCount} 首曲目 · 当前状态 ${ALBUM_STATUS[target.status]?.label ?? ""}`}
          tone={action === "reject" ? "danger" : action === "approve" ? "success" : "warning"}
          confirmLabel={action === "approve" ? "立即发行" : action === "schedule" ? "设定上架日期" : "驳回"}
          requireReason={action === "reject"}
        />
      )}
    </div>
  );
}
