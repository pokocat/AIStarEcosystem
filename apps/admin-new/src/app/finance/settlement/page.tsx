"use client";

import * as React from "react";
import { Wallet, Clock, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionDialog } from "@/components/ActionDialog";
import { RevenueTrendChart } from "@/components/RevenueTrendChart";
import { RevenueSourcePie } from "@/components/RevenueSourcePie";
import { TRANSACTIONS, REVENUE_MONTHLY, REVENUE_SOURCES } from "@/mocks/finance";
import { TRANSACTION_STATUS } from "@/constants/status";
import type { Transaction } from "@/types/finance";
import { formatDateCN } from "@/lib/utils";

function parseAmount(a: string): number {
  return Number(a.replace(/[^\d-]/g, "")) || 0;
}

export default function SettlementPage() {
  const [target, setTarget] = React.useState<{ txn: Transaction; action: "approve" | "reject" } | null>(null);

  const pending = TRANSACTIONS.filter((t) => t.status === "pending");
  const processing = TRANSACTIONS.filter((t) => t.status === "processing");
  const completed = TRANSACTIONS.filter((t) => t.status === "completed");

  const inflow = TRANSACTIONS.filter((t) => t.type === "income").reduce((a, b) => a + parseAmount(b.amount), 0);
  const outflow = -TRANSACTIONS.filter((t) => t.type === "withdrawal").reduce((a, b) => a + parseAmount(b.amount), 0);
  const pendingAmount = [...pending, ...processing].reduce((a, b) => a + parseAmount(b.amount), 0);

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="结算中心"
        description="待复核 / 处理中流水、收益趋势与渠道来源"
        breadcrumb={[{ label: "分发与变现" }, { label: "结算中心" }]}
        actions={
          <Button size="sm" variant="outline">
            <Download className="h-3.5 w-3.5" /> 导出对账单
          </Button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="本期入账" value={`¥${inflow.toLocaleString("zh-CN")}`} icon={Wallet} tone="success" />
        <StatCard label="本期提现" value={`¥${outflow.toLocaleString("zh-CN")}`} icon={Wallet} />
        <StatCard
          label="处理中金额"
          value={`¥${pendingAmount.toLocaleString("zh-CN")}`}
          hint={`${processing.length} 笔处理中 · ${pending.length} 笔待复核`}
          icon={Clock}
          tone="warning"
        />
        <StatCard
          label="待人工复核"
          value={pending.length}
          icon={AlertTriangle}
          tone={pending.length ? "danger" : "default"}
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>入账趋势 · 近 6 月</CardTitle>
            <CardDescription>单位：元 · 不含提现</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueTrendChart data={REVENUE_MONTHLY} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>收入来源构成</CardTitle>
            <CardDescription>按品类聚合</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueSourcePie data={REVENUE_SOURCES} />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>流水管理</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="actionable">
            <TabsList>
              <TabsTrigger value="actionable">
                待处理 ({pending.length + processing.length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                已完成 ({completed.length})
              </TabsTrigger>
              <TabsTrigger value="all">全部</TabsTrigger>
            </TabsList>

            {([
              ["actionable", [...pending, ...processing]],
              ["completed", completed],
              ["all", TRANSACTIONS],
            ] as const).map(([key, rows]) => (
              <TabsContent key={key} value={key}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>单号</TableHead>
                      <TableHead>来源</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>日期</TableHead>
                      <TableHead className="text-right">金额</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">#{t.id.toUpperCase()}</TableCell>
                        <TableCell className="font-medium">{t.source}</TableCell>
                        <TableCell className="text-sm">
                          {t.type === "income" ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" /> 收入
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-700">提现</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{formatDateCN(t.date)}</TableCell>
                        <TableCell className={"text-right tabular-nums font-medium " + (t.type === "income" ? "text-emerald-700" : "text-slate-700")}>
                          {t.amount}
                        </TableCell>
                        <TableCell><StatusBadge meta={TRANSACTION_STATUS[t.status]} /></TableCell>
                        <TableCell className="text-right">
                          {(t.status === "pending" || t.status === "processing") ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button size="sm" variant="success" onClick={() => setTarget({ txn: t, action: "approve" })}>
                                复核通过
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => setTarget({ txn: t, action: "reject" })}>
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
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {target && (
        <ActionDialog
          open={!!target}
          onOpenChange={(open) => !open && setTarget(null)}
          title={target.action === "approve" ? `复核通过：${target.txn.source}` : `驳回流水：${target.txn.source}`}
          description={`#${target.txn.id.toUpperCase()} · ${target.txn.amount} · ${target.txn.date}`}
          tone={target.action === "approve" ? "success" : "danger"}
          confirmLabel={target.action === "approve" ? "复核通过" : "驳回"}
          requireReason
        />
      )}
    </div>
  );
}
