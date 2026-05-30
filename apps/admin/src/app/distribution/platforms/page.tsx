"use client";

import * as React from "react";
import { Radio, PlugZap, Unplug, Signal } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionDialog } from "@/components/ActionDialog";
import { listPlatforms } from "@/api/distribution";
import { PLATFORM_STATUS } from "@/constants/status";
import type { Platform, PlatformCategory } from "@/types/distribution";

const CATEGORIES: { value: PlatformCategory | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "music", label: "音乐" },
  { value: "video", label: "视频" },
  { value: "social", label: "社交" },
  { value: "live", label: "直播" },
];

export default function PlatformsPage() {
  const [platforms, setPlatforms] = React.useState<Platform[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [cat, setCat] = React.useState<PlatformCategory | "all">("all");
  const [target, setTarget] = React.useState<{ platform: Platform; action: "approve" | "reject" | "reconnect" | "disconnect" } | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listPlatforms();
        if (active) setPlatforms(data);
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const list = platforms.filter((p) => cat === "all" || p.category === cat);

  const byStatus = {
    connected: platforms.filter((p) => p.status === "connected").length,
    pending: platforms.filter((p) => p.status === "pending").length,
    disconnected: platforms.filter((p) => p.status === "disconnected").length,
  };

  return (
    <div className="admin-page">
      <PageHeader
        title="分发渠道"
        description="第三方平台接入审核、同步监控与断开处理"
        breadcrumb={[{ label: "分发与变现" }, { label: "分发渠道" }]}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="渠道总数" value={platforms.length} icon={Radio} />
        <StatCard label="已接入" value={byStatus.connected} icon={Signal} tone="success" />
        <StatCard label="接入审核中" value={byStatus.pending} icon={PlugZap} tone="warning" />
        <StatCard label="已断开" value={byStatus.disconnected} icon={Unplug} tone="danger" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>渠道分类</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={cat} onValueChange={(v) => setCat(v as PlatformCategory | "all")}>
            <TabsList>
              {CATEGORIES.map((c) => (
                <TabsTrigger key={c.value} value={c.value}>
                  {c.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={cat}>
              {loading && <div className="py-8 text-center text-sm text-muted-foreground">加载中…</div>}
              {!loading && loadError && <div className="py-8 text-center text-sm text-rose-600">加载失败：{loadError}</div>}
              {!loading && !loadError && list.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">暂无渠道</div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-border bg-card p-4 card-shadow"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-muted text-xl">
                        {p.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground capitalize">{p.category}</div>
                      </div>
                      <StatusBadge meta={PLATFORM_STATUS[p.status]} />
                    </div>

                    <dl className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div>
                        <dt className="text-muted-foreground">关注/订阅</dt>
                        <dd className="tabular-nums font-medium">{p.followers}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">上次同步</dt>
                        <dd className="font-medium">{p.lastSync}</dd>
                      </div>
                    </dl>

                    <div className="flex items-center gap-1.5">
                      {p.status === "pending" && (
                        <>
                          <Button size="sm" variant="success" className="flex-1" onClick={() => setTarget({ platform: p, action: "approve" })}>
                            批准接入
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setTarget({ platform: p, action: "reject" })}>
                            驳回
                          </Button>
                        </>
                      )}
                      {p.status === "disconnected" && (
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => setTarget({ platform: p, action: "reconnect" })}>
                          重新连接
                        </Button>
                      )}
                      {p.status === "connected" && (
                        <>
                          <Button size="sm" variant="outline" className="flex-1">立即同步</Button>
                          <Button size="sm" variant="ghost" onClick={() => setTarget({ platform: p, action: "disconnect" })}>
                            断开
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {target && (
        <ActionDialog
          open={!!target}
          onOpenChange={(open) => !open && setTarget(null)}
          title={
            target.action === "approve"
              ? `批准 ${target.platform.name} 接入`
              : target.action === "reject"
              ? `驳回 ${target.platform.name} 接入`
              : target.action === "reconnect"
              ? `重新连接 ${target.platform.name}`
              : `断开 ${target.platform.name}`
          }
          description={`渠道类型：${target.platform.category}`}
          tone={target.action === "approve" ? "success" : target.action === "reject" || target.action === "disconnect" ? "danger" : "primary"}
          confirmLabel={
            target.action === "approve"
              ? "批准"
              : target.action === "reject"
              ? "驳回"
              : target.action === "disconnect"
              ? "断开"
              : "重新连接"
          }
          requireReason={target.action !== "approve"}
        />
      )}
    </div>
  );
}
