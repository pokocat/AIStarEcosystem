"use client";

import { useEffect, useState } from "react";
import { Coins, RefreshCw, WalletCards } from "lucide-react";
import { apiFetch, normalizeListResponse, normalizePageResponse } from "@/lib/api";
import { formatAmount, formatCount, formatDateTime } from "@/lib/utils";
import { LedgerEntry, PageResponse, Wallet } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Tab = "wallets" | "ledger";

function entryTypeVariant(type: LedgerEntry["entryType"]) {
  switch (type) {
    case "credit":
      return "success";
    case "debit":
      return "destructive";
    case "freeze":
      return "warning";
    case "unfreeze":
      return "info";
    case "expire":
      return "secondary";
    default:
      return "outline";
  }
}

function entryTypeLabel(type: LedgerEntry["entryType"]) {
  switch (type) {
    case "credit":
      return "入账";
    case "debit":
      return "扣减";
    case "freeze":
      return "冻结";
    case "unfreeze":
      return "解冻";
    case "expire":
      return "过期";
    default:
      return type;
  }
}

function normalizeWallet(item: Partial<Wallet>): Wallet {
  return {
    id: item.id ?? "",
    tenantId: item.tenantId ?? "未分配租户",
    totalBalance: Number(item.totalBalance ?? 0),
    giftBalance: Number(item.giftBalance ?? 0),
    rechargeBalance: Number(item.rechargeBalance ?? 0),
    planBalance: Number(item.planBalance ?? 0),
    createdAt: item.createdAt ?? "",
    updatedAt: item.updatedAt ?? "",
  };
}

function normalizeEntry(item: Partial<LedgerEntry>): LedgerEntry {
  return {
    id: item.id ?? "",
    walletId: item.walletId ?? "",
    tenantId: item.tenantId ?? "未分配租户",
    entryType: (item.entryType ?? "credit") as LedgerEntry["entryType"],
    amount: Number(item.amount ?? 0),
    balanceAfter: Number(item.balanceAfter ?? 0),
    description: item.description ?? "暂无说明",
    referenceId: item.referenceId ?? null,
    referenceType: item.referenceType ?? null,
    createdAt: item.createdAt ?? "",
  };
}

function Pager({
  page,
  totalPages,
  loading,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" onClick={onPrev} disabled={page === 0 || loading}>
        上一页
      </Button>
      <span className="text-sm text-muted-foreground">
        第 {page + 1} / {totalPages} 页
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={onNext}
        disabled={page >= totalPages - 1 || loading}
      >
        下一页
      </Button>
    </div>
  );
}

export default function CreditsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("wallets");
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletsLoading, setWalletsLoading] = useState(true);
  const [walletsError, setWalletsError] = useState<string | null>(null);

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [entryPage, setEntryPage] = useState(0);
  const [entryTotalPages, setEntryTotalPages] = useState(0);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);

  async function fetchWallets() {
    setWalletsLoading(true);
    setWalletsError(null);

    try {
      const data = await apiFetch<unknown>("/api/admin/wallets");
      const normalized = normalizeListResponse<Partial<Wallet>>(data, [
        "wallets",
        "content",
        "items",
        "records",
      ]).map(normalizeWallet);
      setWallets(normalized);
    } catch {
      setWallets([]);
      setWalletsError("加载钱包数据失败，已回退为空列表。");
    } finally {
      setWalletsLoading(false);
    }
  }

  async function fetchEntries(targetPage = 0) {
    setEntriesLoading(true);
    setEntriesError(null);

    try {
      const data = await apiFetch<unknown>(
        `/api/admin/ledger-entries?page=${targetPage}&size=30`
      );
      const normalized: PageResponse<Partial<LedgerEntry>> = normalizePageResponse(data, [
        "entries",
        "ledgerEntries",
        "content",
        "items",
      ]);

      setEntries(normalized.content.map(normalizeEntry));
      setEntryTotalPages(normalized.totalPages);
      setEntryPage(normalized.number);
    } catch {
      setEntries([]);
      setEntryTotalPages(0);
      setEntryPage(0);
      setEntriesError("加载积分流水失败，已回退为空列表。");
    } finally {
      setEntriesLoading(false);
    }
  }

  useEffect(() => {
    fetchWallets();
  }, []);

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);

    if (tab === "ledger" && entries.length === 0 && !entriesLoading) {
      fetchEntries(0);
    }
  }

  const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.totalBalance, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">积分钱包</h2>
          <p className="text-sm text-muted-foreground">
            查看租户钱包余额、结构分布以及积分流水明细。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => (activeTab === "wallets" ? fetchWallets() : fetchEntries(entryPage))}
          disabled={activeTab === "wallets" ? walletsLoading : entriesLoading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${(activeTab === "wallets" ? walletsLoading : entriesLoading) ? "animate-spin" : ""}`} />
          刷新数据
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">钱包总数</CardTitle>
            <CardDescription>已归档到后台的租户钱包数量</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {walletsLoading ? "..." : formatCount(wallets.length)}
            </div>
            <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700">
              <WalletCards className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">总余额</CardTitle>
            <CardDescription>所有钱包的当前积分余额总和</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {walletsLoading ? "..." : formatAmount(totalBalance)}
            </div>
            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
              <Coins className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">流水记录</CardTitle>
            <CardDescription>进入“积分流水”标签后按分页加载</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {entriesLoading ? "..." : formatCount(entries.length)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 border-b border-border">
        {([
          { key: "wallets" as const, label: "钱包余额" },
          { key: "ledger" as const, label: "积分流水" },
        ]).map((tab) => (
          <Button
            key={tab.key}
            type="button"
            variant={activeTab === tab.key ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleTabChange(tab.key)}
            className="rounded-b-none"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "wallets" ? (
        <div className="flex flex-col gap-4">
          {walletsError && (
            <Alert variant="warning">
              <AlertTitle>钱包数据暂不可用</AlertTitle>
              <AlertDescription>{walletsError}</AlertDescription>
            </Alert>
          )}
          <div className="rounded-2xl border border-border/80 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
            {walletsLoading ? (
              <div className="flex flex-col gap-3 p-6">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>租户 ID</TableHead>
                    <TableHead className="text-right">总余额</TableHead>
                    <TableHead className="text-right">赠送余额</TableHead>
                    <TableHead className="text-right">充值余额</TableHead>
                    <TableHead className="text-right">套餐余额</TableHead>
                    <TableHead>更新时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wallets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        当前没有可展示的钱包数据。
                      </TableCell>
                    </TableRow>
                  ) : (
                    wallets.map((wallet) => (
                      <TableRow key={wallet.id || wallet.tenantId}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {wallet.tenantId}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold text-slate-950">
                          {formatAmount(wallet.totalBalance)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {formatAmount(wallet.giftBalance)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {formatAmount(wallet.rechargeBalance)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {formatAmount(wallet.planBalance)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(wallet.updatedAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {entriesError && (
            <Alert variant="warning">
              <AlertTitle>积分流水暂不可用</AlertTitle>
              <AlertDescription>{entriesError}</AlertDescription>
            </Alert>
          )}
          <div className="rounded-2xl border border-border/80 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
            {entriesLoading ? (
              <div className="flex flex-col gap-3 p-6">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>租户</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead className="text-right">变动金额</TableHead>
                    <TableHead className="text-right">变动后余额</TableHead>
                    <TableHead>说明</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        当前没有可展示的流水记录。
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry) => {
                      const isPositive =
                        entry.entryType === "credit" || entry.entryType === "unfreeze";

                      return (
                        <TableRow key={entry.id || `${entry.tenantId}-${entry.createdAt}`}>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDateTime(entry.createdAt)}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {entry.tenantId}
                          </TableCell>
                          <TableCell>
                            <Badge variant={entryTypeVariant(entry.entryType)}>
                              {entryTypeLabel(entry.entryType)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold">
                            <span className={isPositive ? "text-emerald-600" : "text-rose-600"}>
                              {isPositive ? "+" : "-"}
                              {formatAmount(entry.amount)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground">
                            {formatAmount(entry.balanceAfter)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {entry.description}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </div>
          <Pager
            page={entryPage}
            totalPages={entryTotalPages}
            loading={entriesLoading}
            onPrev={() => fetchEntries(entryPage - 1)}
            onNext={() => fetchEntries(entryPage + 1)}
          />
        </div>
      )}
    </div>
  );
}
