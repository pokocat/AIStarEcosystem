"use client";

import * as React from "react";
import { Send, CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { listPublishJobs, listPublishJobEvents } from "@/api/publish-job";
import { PUBLISH_JOB_STATUS } from "@/constants/status";
import type { PublishJob, PublishJobEvent, PublishJobStatus } from "@/types/publish-job";
import { formatDateCN } from "@/lib/utils";

const STATUS_TABS: { value: PublishJobStatus | "all"; label: string }[] = [
  { value: "all",            label: "全部" },
  { value: "queued",         label: "排队中" },
  { value: "uploading",      label: "上传中" },
  { value: "publishing",     label: "发布中" },
  { value: "awaiting_user",  label: "待验证码" },
  { value: "live",           label: "已上线" },
  { value: "failed",         label: "失败" },
  { value: "cancelled",      label: "已取消" },
];

export default function PublishJobsPage() {
  const [rows, setRows] = React.useState<PublishJob[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<PublishJobStatus | "all">("all");

  const [eventsFor, setEventsFor] = React.useState<PublishJob | null>(null);
  const [events, setEvents] = React.useState<PublishJobEvent[]>([]);
  const [eventsLoading, setEventsLoading] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listPublishJobs();
        if (active) setRows(data);
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    if (!eventsFor) { setEvents([]); return; }
    let active = true;
    setEventsLoading(true);
    listPublishJobEvents(eventsFor.id)
      .then((data) => { if (active) setEvents(data); })
      .catch(() => { if (active) setEvents([]); })
      .finally(() => { if (active) setEventsLoading(false); });
    return () => { active = false; };
  }, [eventsFor]);

  const counts = {
    inflight: rows.filter((r) => r.status === "queued" || r.status === "uploading" || r.status === "transcoding" || r.status === "publishing" || r.status === "awaiting_user").length,
    live:     rows.filter((r) => r.status === "live").length,
    failed:   rows.filter((r) => r.status === "failed").length,
  };
  const totalCredits = rows.reduce((acc, r) => acc + (r.creditsSpent ?? 0), 0);

  const list = rows.filter((r) => tab === "all" || r.status === tab);

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="发布任务"
        description="跨用户 sau-service 发布任务清单与事件流审计"
        breadcrumb={[{ label: "分发与变现" }, { label: "发布任务" }]}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="进行中" value={counts.inflight} icon={Loader2} />
        <StatCard label="已上线" value={counts.live}     icon={CheckCircle2} tone="success" />
        <StatCard label="失败"   value={counts.failed}   icon={XCircle}      tone="danger" />
        <StatCard label="累计扣费（积分）" value={totalCredits} icon={Send} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>任务清单</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as PublishJobStatus | "all")}>
            <TabsList>
              {STATUS_TABS.map((s) => (
                <TabsTrigger key={s.value} value={s.value}>{s.label}</TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={tab}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>任务 ID</TableHead>
                    <TableHead>项目</TableHead>
                    <TableHead>归属用户</TableHead>
                    <TableHead>平台</TableHead>
                    <TableHead>标题</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">进度</TableHead>
                    <TableHead className="text-right">扣费</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">加载中…</TableCell></TableRow>
                  )}
                  {!loading && loadError && (
                    <TableRow><TableCell colSpan={10} className="text-center py-10 text-rose-600">加载失败：{loadError}</TableCell></TableRow>
                  )}
                  {!loading && !loadError && list.length === 0 && (
                    <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">暂无任务</TableCell></TableRow>
                  )}
                  {!loading && !loadError && list.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs font-mono">{r.id}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{r.projectId}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{r.userId ?? "—"}</TableCell>
                      <TableCell className="text-sm">{r.platformName}</TableCell>
                      <TableCell className="text-sm max-w-[280px] truncate">
                        {r.externalUrl ? (
                          <a className="inline-flex items-center gap-1 text-sky-700 hover:underline" href={r.externalUrl} target="_blank" rel="noreferrer">
                            {r.title ?? "—"} <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (r.title ?? "—")}
                      </TableCell>
                      <TableCell><StatusBadge meta={PUBLISH_JOB_STATUS[r.status]} /></TableCell>
                      <TableCell className="text-sm tabular-nums text-right">{r.progress}%</TableCell>
                      <TableCell className="text-sm tabular-nums text-right">{r.creditsSpent ?? 0}</TableCell>
                      <TableCell className="text-sm">{formatDateCN(r.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setEventsFor(r)}>事件流</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!eventsFor} onOpenChange={(open) => !open && setEventsFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              事件流 — <span className="font-mono text-sm">{eventsFor?.id}</span>
            </DialogTitle>
          </DialogHeader>
          {eventsFor && (
            <div className="text-xs text-muted-foreground mb-3">
              {eventsFor.platformName} · {eventsFor.title ?? "(无标题)"}
              {eventsFor.errorMessage && (
                <div className="mt-1 rounded-md bg-rose-50 px-2 py-1 text-rose-700">错误：{eventsFor.errorMessage}</div>
              )}
            </div>
          )}
          <div className="max-h-[420px] overflow-auto">
            {eventsLoading && <div className="py-6 text-center text-sm text-muted-foreground">加载中…</div>}
            {!eventsLoading && events.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">暂无事件</div>
            )}
            {!eventsLoading && events.length > 0 && (
              <ol className="space-y-2 text-sm">
                {events.map((e) => (
                  <li key={e.id} className="rounded-md border bg-card px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs uppercase text-muted-foreground">{e.kind}</span>
                      <span className="text-xs text-muted-foreground">{formatDateCN(e.at)}</span>
                    </div>
                    <div className="mt-1">
                      {e.fromStatus && e.toStatus && (
                        <span>{PUBLISH_JOB_STATUS[e.fromStatus]?.label ?? e.fromStatus} → <strong>{PUBLISH_JOB_STATUS[e.toStatus]?.label ?? e.toStatus}</strong></span>
                      )}
                      {!e.fromStatus && e.toStatus && (
                        <span>初始 → <strong>{PUBLISH_JOB_STATUS[e.toStatus]?.label ?? e.toStatus}</strong></span>
                      )}
                      {e.progress != null && <span className="ml-2 tabular-nums text-muted-foreground">进度 {e.progress}%</span>}
                      {e.note && <div className="mt-1 text-xs text-muted-foreground">{e.note}</div>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
