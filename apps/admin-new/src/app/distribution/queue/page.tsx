"use client";

import * as React from "react";
import { Send, Clock, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionDialog } from "@/components/ActionDialog";
import { DistributionQueue } from "@/mocks/coach";
import { CONTENT_ITEMS } from "@/mocks/distribution";
import { DISTRIBUTION_QUEUE_STATUS, CONTENT_DISTRIBUTION_STATUS } from "@/constants/status";
import type { DistributionQueueItem } from "@/types/coach";
import { formatDateCN } from "@/lib/utils";

export default function QueuePage() {
  const [target, setTarget] = React.useState<{ item: DistributionQueueItem; action: "approve" | "reject" } | null>(null);

  const counts = {
    reviewing: DistributionQueue.filter((q) => q.status === "reviewing").length,
    approved: DistributionQueue.filter((q) => q.status === "approved").length,
    distributing: DistributionQueue.filter((q) => q.status === "distributing").length,
  };

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="发行队列"
        description="内容分发请求的全生命周期：审核 → 通过 → 分发"
        breadcrumb={[{ label: "分发与变现" }, { label: "发行队列" }]}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="待审核" value={counts.reviewing} icon={Clock} tone="warning" />
        <StatCard label="已通过" value={counts.approved} icon={CheckCircle2} tone="success" />
        <StatCard label="分发中" value={counts.distributing} icon={Send} />
        <StatCard label="队列总数" value={DistributionQueue.length} icon={Send} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>队列明细</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="queue">
            <TabsList>
              <TabsTrigger value="queue">审核队列</TabsTrigger>
              <TabsTrigger value="content">分发内容状态</TabsTrigger>
            </TabsList>

            <TabsContent value="queue">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>内容</TableHead>
                    <TableHead>艺人</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>目标渠道</TableHead>
                    <TableHead>提交日</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DistributionQueue.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium">{q.title}</TableCell>
                      <TableCell className="text-sm">{q.artist}</TableCell>
                      <TableCell className="text-sm">
                        {q.type === "Music" ? "🎵 音乐" : q.type === "Video" ? "🎬 视频" : "📡 直播"}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">{q.platforms} 个</TableCell>
                      <TableCell className="text-sm">{formatDateCN(q.date)}</TableCell>
                      <TableCell><StatusBadge meta={DISTRIBUTION_QUEUE_STATUS[q.status]} /></TableCell>
                      <TableCell className="text-right">
                        {q.status === "reviewing" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button size="sm" variant="success" onClick={() => setTarget({ item: q, action: "approve" })}>
                              审核通过
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setTarget({ item: q, action: "reject" })}>
                              驳回
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost">查看</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="content">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>内容</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>已覆盖渠道</TableHead>
                    <TableHead>播放量</TableHead>
                    <TableHead>日期</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CONTENT_ITEMS.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.title}</TableCell>
                      <TableCell className="text-sm capitalize">{c.type}</TableCell>
                      <TableCell><StatusBadge meta={CONTENT_DISTRIBUTION_STATUS[c.status]} /></TableCell>
                      <TableCell className="text-sm tabular-nums">{c.platforms}</TableCell>
                      <TableCell className="text-sm tabular-nums">{c.totalViews}</TableCell>
                      <TableCell className="text-sm">{formatDateCN(c.date)}</TableCell>
                      <TableCell className="text-right">
                        {c.status === "draft" || c.status === "scheduled" ? (
                          <Button size="sm" variant="outline">审核并发布</Button>
                        ) : (
                          <Button size="sm" variant="ghost">明细</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {target && (
        <ActionDialog
          open={!!target}
          onOpenChange={(open) => !open && setTarget(null)}
          title={target.action === "approve" ? `审核通过：${target.item.title}` : `驳回：${target.item.title}`}
          description={`${target.item.artist} · 目标 ${target.item.platforms} 个渠道`}
          tone={target.action === "approve" ? "success" : "danger"}
          icon={target.action === "approve" ? CheckCircle2 : XCircle}
          confirmLabel={target.action === "approve" ? "通过并推送" : "驳回"}
          requireReason={target.action === "reject"}
        />
      )}
    </div>
  );
}
