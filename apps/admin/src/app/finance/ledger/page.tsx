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
import { RevenueTrendChart } from "@/components/RevenueTrendChart";
import { RevenueSourcePie } from "@/components/RevenueSourcePie";
import { listWallets, listLedgerEntries } from "@/api/wallet";
import { getMonthlyRevenue, getRevenueSources, listTransactions } from "@/api/finance";
import { TRANSACTION_STATUS, LEDGER_ENTRY_TYPE } from "@/constants/status";
import type { Transaction, MonthlyRevenuePoint, RevenueSource } from "@/types/finance";
import type { Wallet, LedgerEntry } from "@/types/wallet";
import { formatCredits, formatSignedCredits } from "@/lib/format";
import { formatDateTimeCN } from "@/lib/utils";

const TXN_TYPE_LABEL: Record<string, string> = {
  income: "业务收益",
  withdrawal: "提现",
  spend: "消费",
  recharge: "充值",
  license_grant: "秘钥入账",
};

/** 账号单元格：昵称 + 登录名 + 用户 ID，server 未回填（老数据）时退回 userId。 */
function AccountCell({
  userId,
  username,
  displayName,
}: {
  userId?: string;
  username?: string;
  displayName?: string;
}) {
  if (!username && !displayName) {
    return <span className="text-sm text-muted-foreground">{userId ?? "—"}</span>;
  }
  return (
    <div className="min-w-0">
      <div className="text-sm font-medium truncate">{displayName || username}</div>
      <div className="text-xs text-muted-foreground truncate">
        登录名 {username ?? "—"}
        {userId && <span className="opacity-70"> · {userId.slice(0, 8)}</span>}
      </div>
    </div>
  );
}

/** 导出 CSV（UTF-8 BOM，Excel 中文不乱码）。金额 / 余额导出原始整数，时间 ISO 到秒。 */
function exportLedgerCsv(ledger: LedgerEntry[]) {
  const header = ["单号", "账号登录名", "账号昵称", "用户ID", "类型", "说明", "金额(credits)", "余额(credits)", "时间"];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = ledger.map((e) =>
    [e.id, e.username ?? "", e.displayName ?? "", e.userId, e.type, e.description, e.amount, e.balanceAfter, e.createdAt]
      .map(escape)
      .join(",")
  );
  const csv = "﻿" + [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  a.href = url;
  a.download = `对账单-${ts}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LedgerPage() {
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  const [ledger, setLedger] = React.useState<LedgerEntry[]>([]);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [monthly, setMonthly] = React.useState<MonthlyRevenuePoint[]>([]);
  const [sources, setSources] = React.useState<RevenueSource[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [w, l, tx, mr, rs] = await Promise.all([
        listWallets(0, 200),
        listLedgerEntries(undefined, undefined, 0, 200),
        listTransactions(0, 200),
        getMonthlyRevenue(),
        getRevenueSources(),
      ]);
      setWallets(w);
      setLedger(l);
      setTransactions(tx);
      setMonthly(mr);
      setSources(rs);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const pending = transactions.filter((t) => t.status === "pending");
  const processing = transactions.filter((t) => t.status === "processing");
  const completed = transactions.filter((t) => t.status === "completed");

  const totalBalance = wallets.reduce((s, w) => s + w.totalBalance, 0);
  const totalPending = wallets.reduce((s, w) => s + w.pendingBalance, 0);
  // 真实资金口径：冻结（freeze）/ 解冻（unfreeze）只是桶间移动，不计入入账 / 出账
  const inflow = ledger.filter((e) => e.amount > 0 && e.type !== "unfreeze").reduce((s, e) => s + e.amount, 0);
  const outflow = -ledger.filter((e) => e.amount < 0 && e.type !== "freeze").reduce((s, e) => s + e.amount, 0);

  return (
    <div className="admin-page">
      <PageHeader
        title="结算中心"
        description="钱包 / 点数流水 / 业务交易。所有金额单位：积分（精确值），时间精确到秒。"
        breadcrumb={[{ label: "分发与变现" }, { label: "结算中心" }]}
        actions={
          <Button size="sm" variant="outline" onClick={() => exportLedgerCsv(ledger)} disabled={ledger.length === 0}>
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
        <StatCard label="入账 · 近 200 笔" value={formatCredits(inflow)} icon={Coins} tone="success" />
        <StatCard label="出账 · 近 200 笔" value={formatCredits(outflow)} icon={Coins} />
        <StatCard
          label="冻结中"
          value={formatCredits(totalPending)}
          hint={`${processing.length} 笔任务冻结处理中`}
          icon={Clock}
          tone={processing.length ? "warning" : "default"}
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
                      <TableCell>
                        <AccountCell userId={w.userId} username={w.username} displayName={w.displayName} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatCredits(w.totalBalance)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{formatCredits(w.licenseBalance)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{formatCredits(w.rechargeBalance)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{formatCredits(w.giftBalance)}</TableCell>
                      <TableCell className={"text-right tabular-nums text-sm " + (w.pendingBalance > 0 ? "text-amber-700" : "text-muted-foreground")}>
                        {w.pendingBalance > 0 ? formatCredits(w.pendingBalance) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDateTimeCN(w.updatedAt)}</TableCell>
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
              <CardDescription>按 LedgerEntry 事实表展示，正数=入账 / 负数=出账。余额为精确值，时间到秒。</CardDescription>
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
                      <TableCell className="text-xs text-muted-foreground tabular-nums">#{e.id.slice(0, 8).toUpperCase()}</TableCell>
                      <TableCell>
                        <AccountCell userId={e.userId} username={e.username} displayName={e.displayName} />
                      </TableCell>
                      <TableCell><StatusBadge meta={LEDGER_ENTRY_TYPE[e.type]} /></TableCell>
                      <TableCell className="text-sm">{e.description}</TableCell>
                      <TableCell className={"text-right tabular-nums font-medium " + (e.amount >= 0 ? "text-emerald-700" : "text-rose-700")}>
                        {formatSignedCredits(e.amount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{formatCredits(e.balanceAfter)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDateTimeCN(e.createdAt)}</TableCell>
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
              <CardDescription>
                基于 LedgerEntry 派生的只读业务视图。「处理中」= 任务积分冻结中（等待完成转扣 / 失败退回）；
                充值订单的人工核准在「财务 · 充值订单」页操作。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="actionable">
                <TabsList>
                  <TabsTrigger value="actionable">
                    处理中
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
                          <TableHead>时间</TableHead>
                          <TableHead className="text-right">金额 · credits</TableHead>
                          <TableHead>状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="text-xs text-muted-foreground tabular-nums">#{t.id.slice(0, 8).toUpperCase()}</TableCell>
                            <TableCell className="font-medium">{t.source}</TableCell>
                            <TableCell className="text-sm">{TXN_TYPE_LABEL[t.type] ?? t.type}</TableCell>
                            <TableCell>
                              <AccountCell userId={t.userId} username={t.username} displayName={t.displayName} />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {formatDateTimeCN(t.createdAt ?? t.date)}
                            </TableCell>
                            <TableCell className={"text-right tabular-nums font-medium " + (t.amount >= 0 ? "text-emerald-700" : "text-rose-700")}>
                              {formatSignedCredits(t.amount)}
                            </TableCell>
                            <TableCell><StatusBadge meta={TRANSACTION_STATUS[t.status]} /></TableCell>
                          </TableRow>
                        ))}
                        {rows.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">暂无交易</TableCell>
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
    </div>
  );
}
