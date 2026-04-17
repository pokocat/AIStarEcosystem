"use client";

import * as React from "react";
import { CheckCircle2, Settings2, Receipt, Plus, Pencil } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionDialog } from "@/components/ActionDialog";
import { SUBSCRIPTION_PLANS, BILLING_HISTORY } from "@/mocks/settings";
import type { SubscriptionPlan } from "@/types/settings";
import { formatDateCN } from "@/lib/utils";

function parseAmount(a: string): number {
  return Number(a.replace(/[^\d]/g, "")) || 0;
}

export default function PlansPage() {
  const [target, setTarget] = React.useState<{ plan: SubscriptionPlan; action: "edit" | "publish" | "offshelf" } | null>(null);

  const billingTotal = BILLING_HISTORY.reduce((s, b) => s + parseAmount(b.amount), 0);

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="订阅套餐"
        description="Free / Pro / Enterprise 的价格、权益与发布状态管理"
        breadcrumb={[{ label: "运营基础数据" }, { label: "订阅套餐" }]}
        actions={
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" /> 新建套餐
          </Button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="套餐总数" value={SUBSCRIPTION_PLANS.length} icon={Settings2} />
        <StatCard label="账单记录" value={BILLING_HISTORY.length} icon={Receipt} />
        <StatCard label="累计账单金额" value={`¥${billingTotal.toLocaleString("zh-CN")}`} icon={Receipt} tone="success" />
        <StatCard label="在售套餐" value={SUBSCRIPTION_PLANS.length} icon={CheckCircle2} tone="success" />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {SUBSCRIPTION_PLANS.map((p) => (
          <Card key={p.id} className={p.current ? "ring-2 ring-indigo-500" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>{p.name}</CardTitle>
                {p.current && <Badge tone="primary">主推</Badge>}
              </div>
              <div className="text-3xl font-semibold tabular-nums">{p.price}</div>
              <div className="text-xs text-muted-foreground">套餐代号 {p.code}</div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 mb-4">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setTarget({ plan: p, action: "edit" })}>
                  <Pencil className="h-3.5 w-3.5" /> 编辑
                </Button>
                <Button size="sm" variant={p.current ? "ghost" : "success"} onClick={() => setTarget({ plan: p, action: "publish" })}>
                  {p.current ? "取消主推" : "设为主推"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>最近账单</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>单号</TableHead>
                <TableHead>日期</TableHead>
                <TableHead>项目</TableHead>
                <TableHead className="text-right">金额</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {BILLING_HISTORY.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">#{b.id.toUpperCase()}</TableCell>
                  <TableCell className="text-sm">{formatDateCN(b.date)}</TableCell>
                  <TableCell className="font-medium">{b.desc}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{b.amount}</TableCell>
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
          title={target.action === "edit" ? `编辑套餐：${target.plan.name}` : `调整套餐：${target.plan.name}`}
          description={`${target.plan.price} · ${target.plan.features.length} 项权益`}
          tone="primary"
          confirmLabel="保存"
          requireReason
          reasonPlaceholder="变更说明（将写入审计日志）"
        />
      )}
    </div>
  );
}
