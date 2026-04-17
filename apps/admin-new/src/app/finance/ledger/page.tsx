"use client";

import * as React from "react";
import { Wallet as WalletIcon, Clock, AlertTriangle, Download, Coins } from "lucide-react";
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
import { WALLETS, LEDGER_ENTRIES } from "@/mocks/wallet";
import { ACCOUNTS } from "@/mocks/accounts";
import { TRANSACTION_STATUS, LEDGER_ENTRY_TYPE } from "@/constants/status";
import type { Transaction } from "@/types/finance";
import { formatCredits, formatSignedCredits, formatCompactNumber } from "@/lib/format";
import { formatDateCN } from "@/lib/utils";

const TXN_TYPE_LABEL: Record<string, string> = {
  income: "业务收益",
  withdrawal: "提现",
  spend: "消费",
  recharge: "充值",
  license_grant: "License 入账",
};

export default function LedgerPage() {
  const [target, setTarget] = React.useState<{ txn: Transaction; action: "approve" | "reject" } | null>(null);

  const pending = TRANSACTIONS.filter((t) => t.status === "pending");
  const processing = TRANSACTIONS.filter((t) => t.status === "processing");
  const completed = TRANSACTIONS.filter((t) => t.status === "completed");

  const totalBalance = WALLETS.reduce((s, w) => s + w.totalBalance, 0);
  const totalPending = WALLETS.reduce((s, w) => s + w.pendingBalance, 0);
  const inflow = TRANSACTIONS.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const outflow = -TRANSACTIONS.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);

  const userNameOf = (id?: string) => ACCOUNTS.find((a) => a.id === id)?.displayName ?? id ?? "—";

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="结算中心"
        description="钱包 / 点数流水 / 业务交易复核。所有金额单位：credits（见 product_spec.md §1.3 / §1.4）。"
        breadcrumb={[{ label: "分发与变现" }, { label: "结算中心" }]}
        actions={
          <Button size="sm" variant="outline">
            <Download className="h-3.5 w-3.5" /> 导出对账单
          </Button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="钱包余额合计 · credits" value={formatCredits(totalBalance)} icon={WalletIcon} tone="success" />
        <StatCard label="本期入账 · credits"   value={formatCredits(inflow)}       icon={Coins}     tone="success" />
        <StatCard label="本期出账 · credits"   value={formatCredits(outflow)}      icon={Coins} />
        <StatCard
          label="冻结 / 处理中"
          value={formatCredits(totalPending)}
          hint={`${processing.length} 笔处理中 · ${pending.length} 笔待复核`}
          icon={Clock}
          tone={pending.length ? "warning" : "default"}
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>入账趋势 · 近 6 月</CardTitle>
            <CardDescription>单位：credits · 不含出账</CardDescription>
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

      <Tabs defaultValue="wallets" className="mb-6">
        <TabsList>
          <TabsTrigger value="wallets">钱包快照 ({WALLETS.length})</TabsTrigger>
          <TabsTrigger value="ledger">点数流水 ({LEDGER_ENTRIES.length})</TabsTrigger>
          <TabsTrigger value="transactions">
            业务交易
            {pending.length + processing.length > 0 && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-1.5 text-xs text-amber-800">
                {pending.length + processing.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wallets">
          <Card>
            <CardHeader><CardTitle>个人钱包</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>账号</TableHead>
                    <TableHead className="text-right">总余额</TableHead>
                    <TableHead className="text-right">License</TableHead>
                    <TableHead className="text-right">充值</TableHead>
                    <TableHead className="text-right">赠送</TableHead>
                    <TableHead className="text-right">冻结</TableHead>
                    <TableHead>更新时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {WALLETS.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">{userNameOf(w.userId)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatCredits(w.totalBalance)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{formatCredits(w.licenseBalance)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{formatCredits(w.rechargeBalance)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{formatCredits(w.giftBalance)}</TableCell>
                      <TableCell className={"text-right tabular-nums text-sm " + (w.pendingBalance > 0 ? "text-amber-700" : "text-muted-foreground")}>
                        {w.pendingBalance > 0 ? formatCredits(w.pendingBalance) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateCN(w.updatedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ledger">
          <Card>
            <CardHeader>
              <CardTitle>点数流水</CardTitle>
              <CardDescription>按 LedgerEntry 事实表展示，正数=入账 / 负数=出账。</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>单号</TableHead>
                    <TableHead>账号</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>说明</TableHead>
                    <TableHead className="text-right">金额 · credits</TableHead>
                    <TableHead className="text-right">余额</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {LEDGER_ENTRIES.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">#{e.id.toUpperCase()}</TableCell>
                      <TableCell className="text-sm">{userNameOf(e.userId)}</TableCell>
                      <TableCell><StatusBadge meta={LEDGER_ENTRY_TYPE[e.type]} /></TableCell>
                      <TableCell className="text-sm">{e.description}</TableCell>
                      <TableCell className={"text-right tabular-nums font-medium " + (e.amount >= 0 ? "text-emerald-700" : "text-rose-700")}>
                        {formatSignedCredits(e.amount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{formatCompactNumber(e.balanceAfter)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateCN(e.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>业务交易视图</CardTitle>
              <CardDescription>基于 LedgerEntry 派生的高层业务视图，用于对外结算与人工复核。</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="actionable">
                <TabsList>
                  <TabsTrigger value="actionable">
                    待处理
                    {pending.length + processing.length > 0 && (
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-1.5 text-xs text-amber-800">
                        {pending.length + processing.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="completed">已完成 ({completed.length})</TabsTrigger>
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
                          <TableHead>账号</TableHead>
                          <TableHead>日期</TableHead>
                          <TableHead className="text-right">金额 · credits</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="text-xs text-muted-foreground tabular-nums">#{t.id.toUpperCase()}</TableCell>
                            <TableCell className="font-medium">{t.source}</TableCell>
                            <TableCell className="text-sm">{TXN_TYPE_LABEL[t.type] ?? t.type}</TableCell>
                            <TableCell className="text-sm">{userNameOf(t.userId)}</TableCell>
                            <TableCell className="text-sm">{formatDateCN(t.date)}</TableCell>
                            <TableCell className={"text-right tabular-nums font-medium " + (t.amount >= 0 ? "text-emerald-700" : "text-rose-700")}>
                              {formatSignedCredits(t.amount)}
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
        </TabsContent>
      </Tabs>

      {pending.length === 0 && processing.length === 0 && (
        <Card className="bg-emerald-50/50 border-emerald-200">
          <CardContent className="py-3 text-sm text-emerald-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> 没有待人工复核的流水。
          </CardContent>
        </Card>
      )}

      {target && (
        <ActionDialog
          open={!!target}
          onOpenChange={(open) => !open && setTarget(null)}
          title={target.action === "approve" ? `复核通过：${target.txn.source}` : `驳回流水：${target.txn.source}`}
          description={`#${target.txn.id.toUpperCase()} · ${formatSignedCredits(target.txn.amount)} credits · ${formatDateCN(target.txn.date)}`}
          tone={target.action === "approve" ? "success" : "danger"}
          confirmLabel={target.action === "approve" ? "复核通过" : "驳回"}
          requireReason
        />
      )}
    </div>
  );
}
