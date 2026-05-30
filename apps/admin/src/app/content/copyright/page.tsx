"use client";

import * as React from "react";
import { ShieldCheck, ShieldAlert, FileCheck2, Upload } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionDialog } from "@/components/ActionDialog";
import { listPendingCopyright } from "@/api/coach";
import { COPYRIGHT_STATUS } from "@/constants/status";
import type { CopyrightItem } from "@/types/coach";
import { daysUntil, formatDateCN } from "@/lib/utils";

export default function CopyrightPage() {
  const [items, setItems] = React.useState<CopyrightItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [target, setTarget] = React.useState<CopyrightItem | null>(null);
  const [action, setAction] = React.useState<"verify" | "reject" | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listPendingCopyright();
        if (active) setItems(data);
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const pending = items.filter((c) => c.status === "pending");
  const verified = items.filter((c) => c.status === "verified");

  return (
    <div className="admin-page">
      <PageHeader
        title="版权核验"
        description="版权登记需人工核查资料与权属，才可进入发行队列"
        breadcrumb={[{ label: "内容审核" }, { label: "版权核验" }]}
        actions={
          <Button size="sm" variant="outline">
            <Upload className="h-3.5 w-3.5" /> 导入批量材料
          </Button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="待核验" value={pending.length} icon={ShieldAlert} tone={pending.length ? "danger" : "default"} />
        <StatCard label="已核验" value={verified.length} icon={ShieldCheck} tone="success" />
        <StatCard label="总登记" value={items.length} icon={FileCheck2} />
        <StatCard label="超 7 天未处理" value={pending.filter((p) => -daysUntil(p.submitted) > 7).length} hint="SLA 预警" icon={ShieldAlert} tone="warning" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>待处理版权登记</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>作品</TableHead>
                <TableHead>权属人</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>提交日</TableHead>
                <TableHead>等待时长</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">加载中…</TableCell></TableRow>
              )}
              {!loading && loadError && (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-rose-600">加载失败：{loadError}</TableCell></TableRow>
              )}
              {!loading && !loadError && items.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">暂无登记</TableCell></TableRow>
              )}
              {!loading && !loadError && items.map((c) => {
                const wait = -daysUntil(c.submitted);
                const slaWarn = wait > 7 && c.status === "pending";
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.title}</div>
                      <div className="text-xs text-muted-foreground">登记号 CR-{c.id.toUpperCase()}</div>
                    </TableCell>
                    <TableCell className="text-sm">{c.artist}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.type}</TableCell>
                    <TableCell className="text-sm">{formatDateCN(c.submitted)}</TableCell>
                    <TableCell className={"text-sm tabular-nums " + (slaWarn ? "text-rose-600 font-medium" : "text-muted-foreground")}>
                      {wait} 天
                    </TableCell>
                    <TableCell>
                      <StatusBadge meta={COPYRIGHT_STATUS[c.status]} />
                    </TableCell>
                    <TableCell className="text-right">
                      {c.status === "pending" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" variant="success" onClick={() => { setTarget(c); setAction("verify"); }}>
                            核验通过
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => { setTarget(c); setAction("reject"); }}>
                            驳回
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost">查看证书</Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {target && action && (
        <ActionDialog
          open={!!target}
          onOpenChange={(open) => { if (!open) { setTarget(null); setAction(null); } }}
          title={action === "verify" ? `核验通过：${target.title}` : `驳回版权登记：${target.title}`}
          description={`权属人 ${target.artist} · ${target.type} · 提交 ${target.submitted}`}
          tone={action === "verify" ? "success" : "danger"}
          confirmLabel={action === "verify" ? "标记已核验" : "驳回"}
          requireReason
          reasonPlaceholder={
            action === "verify" ? "核验依据（如 ISRC 号、授权书编号）" : "驳回原因（将通知提交方）"
          }
        />
      )}
    </div>
  );
}
