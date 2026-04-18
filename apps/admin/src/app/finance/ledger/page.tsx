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
import { listWallets, listLedgerEntries } from "@/api/wallet";
import { getMonthlyRevenue, getRevenueSources, listTransactions } from "@/api/finance";
import { listUsers } from "@/api/users";
import { TRANSACTION_STATUS, LEDGER_ENTRY_TYPE } from "@/constants/status";
import type { Transaction, MonthlyRevenuePoint, RevenueSource } from "@/types/finance";
import type { Wallet, LedgerEntry } from "@/types/wallet";
import type { AepUser } from "@/types/account";
import { formatCredits, formatSignedCredits, formatCompactNumber } from "@/lib/format";
import { formatDateCN } from "@/lib/utils";

const TXN_TYPE_LABEL: Record<string, string> = {
  income: "业务收益",
  withdrawal: "提现",
  spend: "消费",
  recharge: "充值",
  license_grant: "秘钥入账",
};

export default function LedgerPage() {
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  const [ledger, setLedger] = React.useState<LedgerEntry[]>([]);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [monthly, setMonthly] = React.useState<MonthlyRevenuePoint[]>([]);
  const [sources, setSources] = React.useState<RevenueSource[]>([]);
  const [users, setUsers] = React.useState<AepUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [target, setTarget] = React.useState<{ txn: Transaction; action: "approve" | "reject" } | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [w, l, tx, mr, rs, u] = await Promise.all([
        listWallets(0, 200),
        listLedgerEntries(undefined, undefined, 0, 200),
        listTransactions(0, 200),
        getMonthlyRevenue(),
        getRevenueSources(),
        listUsers(0, 500),
      ]);
      setWallets(w);
      setLedger(l);
      setTransactions(tx);
      setMonthly(mr);
      setSources(rs);
      setUsers(u);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const userById = React.useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const userNameOf = (id?: string) => (id ? userById.get(id)?.displayName : undefined) ?? id ?? "—";

  const pending = transactions.filter((t) => t.status === "pending");
  const processing = transactions.filter((t) => t.status === "processing");
  const completed = transactions.filter((t) => t.status === "completed");

  const totalBalance = wallets.reduce((s, w) => s + w.totalBalance, 0);
  const totalPending = wallets.reduce((s, w) => s + w.pendingBalance, 0);
  const inflow = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const outflow = -transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="结算中心"
        description="钱包 / 点数流水 / 业务交易复核。所有金额单位：积分。"
        breadcrumb={[{ label: "分发与变现" }, { label: "结算中心" }]}
        actions={
          <Button size="sm" variant="outline">
            <Download className="h-3.5 w-3.5" /> 导出对账单
          </Button>
        }
      />

      {loadError && (
        <Card className="mb-6 border-rose-200 bg-rose-50/60">
          <CardContent className="py-3 text-sm text-rose-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> 加载失败：{loadError}
          </CardContent>
        </Card>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="钱包余额合计" value={formatCredits(totalBalance)} icon={WalletIcon} tone="success" />
        <StatCard label="本期入账"     value={formatCredits(inflow)}       icon={Coins}     tone="success" />
        <StatCard label="本期出账"     value={formatCredits(outflow)}      icon={Coins} />
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
            <CardDescription>单位：积分 · 不含出账</CardDescription>
          </CardHeader>
          <CardContent>
            {monthly.length > 0 ? (
              <RevenueTrendChart data={monthly} />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">暂无数据</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>收入来源构成</CardTitle>
            <CardDescription>按品类聚合</CardDescription>
          </CardHeader>
          <CardContent>
            {sources.length > 0 ? (
              <RevenueSourcePie data={sources} />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">暂无数据</div>
            )}
          </CardContent>
        </Card>
      </section>

      <Tabs defaultValue="wallets" className="mb-6">
        <TabsList>
          <TabsTrigger value="wallets">钱包快照 ({wallets.length})</TabsTrigger>
          <TabsTrigger value="ledger">点数流水 ({ledger.length})</TabsTrigger>
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
                    <TableHead className="text-right">秘钥</TableHead>
                    <TableHead className="text-right">充值</TableHead>
                    <TableHead className="text-right">赠送</TableHead>
                    <TableHead className="text-right">冻结</TableHead>
                    <TableHead>更新时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">加载中…</TableCell>
                    </TableRow>
                  )}
                  {!loading && wallets.map((w) => (
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
                  {!loading && wallets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">暂无钱包</TableCell>
                    </TableRow>
                  )}
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
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">加载中…</TableCell>
                    </TableRow>
                  )}
                  {!loading && ledger.map((e) => (
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
                  {!loading && ledger.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">暂无流水</TableCell>
                    </TableRow>
                  )}
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
                  ["all", transactions],
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
                        {rows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">暂无交易</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {!loading && pending.length === 0 && processing.length === 0 && (
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
