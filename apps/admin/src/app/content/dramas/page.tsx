"use client";

import * as React from "react";
import { Clapperboard, CheckCircle2, PlayCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionDialog } from "@/components/ActionDialog";
import { listDramas } from "@/api/film";
import { DRAMA_STATUS } from "@/constants/status";
import type { Drama } from "@/types/film";
import { formatCompactNumber, formatCredits } from "@/lib/format";

export default function DramasPage() {
  const [dramas, setDramas] = React.useState<Drama[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [target, setTarget] = React.useState<{ drama: Drama; action: "approve" | "reject" } | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listDramas();
        if (active) setDramas(data);
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const counts = {
    total: dramas.length,
    released: dramas.filter((d) => d.status === "released").length,
    postProd: dramas.filter((d) => d.status === "post-production").length,
    totalViews: dramas.reduce((s, d) => s + d.views, 0),
  };

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="短剧"
        description="虚拟演员主演的短剧项目与上线审核。"
        breadcrumb={[{ label: "AI 作品" }, { label: "短剧" }]}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="总剧目"      value={counts.total}                         icon={Clapperboard} />
        <StatCard label="已上线"      value={counts.released}                      icon={CheckCircle2} tone="success" />
        <StatCard label="后期待审"    value={counts.postProd}                      icon={PlayCircle}   tone={counts.postProd ? "warning" : "default"} />
        <StatCard label="累计播放量"  value={formatCompactNumber(counts.totalViews)} icon={PlayCircle} />
      </section>

      <Card>
        <CardHeader><CardTitle>剧目列表</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>剧目</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>集数</TableHead>
                <TableHead>出演</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">播放量</TableHead>
                <TableHead className="text-right">收益 · credits</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">加载中…</TableCell></TableRow>
              )}
              {!loading && loadError && (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-rose-600">加载失败：{loadError}</TableCell></TableRow>
              )}
              {!loading && !loadError && dramas.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">暂无剧目</TableCell></TableRow>
              )}
              {!loading && !loadError && dramas.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.genre}</TableCell>
                  <TableCell className="text-sm tabular-nums">{d.episodes} 集</TableCell>
                  <TableCell className="text-sm">{d.role}</TableCell>
                  <TableCell><StatusBadge meta={DRAMA_STATUS[d.status]} /></TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{formatCompactNumber(d.views)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{formatCredits(d.revenue)}</TableCell>
                  <TableCell className="text-right">
                    {d.status === "post-production" ? (
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="success" onClick={() => setTarget({ drama: d, action: "approve" })}>批准上线</Button>
                        <Button size="sm" variant="destructive" onClick={() => setTarget({ drama: d, action: "reject" })}>驳回</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost">查看</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {target && (
        <ActionDialog
          open={!!target}
          onOpenChange={(open) => !open && setTarget(null)}
          title={target.action === "approve" ? `批准上线：${target.drama.title}` : `驳回剧目：${target.drama.title}`}
          description={`${target.drama.genre} · ${target.drama.episodes} 集`}
          tone={target.action === "approve" ? "success" : "danger"}
          confirmLabel={target.action === "approve" ? "批准上线" : "驳回"}
          requireReason
        />
      )}
    </div>
  );
}
