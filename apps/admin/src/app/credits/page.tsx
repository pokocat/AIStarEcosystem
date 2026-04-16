"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ChevronRight,
  Coins,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import { apiFetch, normalizeListResponse, normalizePageResponse } from "@/lib/api";
import { formatAmount, formatCount, formatDateTime } from "@/lib/utils";
import { LedgerEntry, PageResponse, Wallet } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

/* ─── helpers ─── */

function entryTypeVariant(type: LedgerEntry["entryType"]) {
  switch (type) {
    case "credit":   return "success";
    case "debit":    return "destructive";
    case "freeze":   return "warning";
    case "unfreeze": return "info";
    case "expire":   return "secondary";
    default:         return "outline";
  }
}

function entryTypeLabel(type: LedgerEntry["entryType"]) {
  const labels: Record<LedgerEntry["entryType"], string> = {
    credit: "入账",
    debit: "扣减",
    freeze: "冻结",
    unfreeze: "解冻",
    expire: "过期",
  };
  return labels[type] ?? type;
}

function normalizeWallet(item: Partial<Wallet>): Wallet {
  return {
    id:             item.id ?? "",
    tenantId:       item.tenantId ?? "未分配租户",
    totalBalance:   Number(item.totalBalance ?? 0),
    giftBalance:    Number(item.giftBalance ?? 0),
    rechargeBalance:Number(item.rechargeBalance ?? 0),
    planBalance:    Number(item.planBalance ?? 0),
    createdAt:      item.createdAt ?? "",
    updatedAt:      item.updatedAt ?? "",
  };
}

function normalizeEntry(item: Partial<LedgerEntry>): LedgerEntry {
  return {
    id:            item.id ?? "",
    walletId:      item.walletId ?? "",
    tenantId:      item.tenantId ?? "未分配租户",
    userId:        item.userId ?? null,
    entryType:     (item.entryType ?? "credit") as LedgerEntry["entryType"],
    amount:        Number(item.amount ?? 0),
    balanceAfter:  Number(item.balanceAfter ?? 0),
    description:   item.description ?? "暂无说明",
    referenceId:   item.referenceId ?? null,
    referenceType: item.referenceType ?? null,
    createdAt:     item.createdAt ?? "",
  };
}

/* ─── InfoRow ─── */

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

/* ─── Wallet Detail Drawer ─── */

function WalletDetailDrawer({
  wallet,
  open,
  onClose,
}: {
  wallet: Wallet | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!wallet) return null;

  const totalBalance = wallet.totalBalance;
  const giftPct = totalBalance > 0 ? (wallet.giftBalance / totalBalance) * 100 : 0;
  const rechargePct = totalBalance > 0 ? (wallet.rechargeBalance / totalBalance) * 100 : 0;
  const planPct = totalBalance > 0 ? (wallet.planBalance / totalBalance) * 100 : 0;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" size="md" className="flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <WalletCards className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="font-mono text-base truncate">钱包详情</SheetTitle>
              <SheetDescription className="truncate">租户 {wallet.tenantId}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <SheetBody className="flex flex-col gap-6">
          {/* 余额概览 */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              余额概览
            </p>
            <div className="rounded-xl border border-border bg-muted/30 p-4 flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">总余额</span>
                <span className="text-3xl font-bold text-slate-950">
                  {formatAmount(wallet.totalBalance)}
                </span>
              </div>
              {/* 分布条 */}
              {totalBalance > 0 && (
                <div className="flex h-2.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-sky-400 transition-all"
                    style={{ width: `${giftPct}%` }}
                    title={`赠送：${formatAmount(wallet.giftBalance)}`}
                  />
                  <div
                    className="bg-emerald-400 transition-all"
                    style={{ width: `${rechargePct}%` }}
                    title={`充值：${formatAmount(wallet.rechargeBalance)}`}
                  />
                  <div
                    className="bg-violet-400 transition-all"
                    style={{ width: `${planPct}%` }}
                    title={`套餐：${formatAmount(wallet.planBalance)}`}
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-sky-400" />
                  赠送 {Math.round(giftPct)}%
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  充值 {Math.round(rechargePct)}%
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-violet-400" />
                  套餐 {Math.round(planPct)}%
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* 余额明细 */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              余额明细
            </p>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                  <span className="text-sm text-muted-foreground">赠送余额</span>
                </div>
                <span className="font-mono font-semibold text-sm">{formatAmount(wallet.giftBalance)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="text-sm text-muted-foreground">充值余额</span>
                </div>
                <span className="font-mono font-semibold text-sm">{formatAmount(wallet.rechargeBalance)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-violet-400" />
                  <span className="text-sm text-muted-foreground">套餐余额</span>
                </div>
                <span className="font-mono font-semibold text-sm">{formatAmount(wallet.planBalance)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* 账户信息 */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              账户信息
            </p>
            <div className="grid grid-cols-1 gap-3">
              <InfoRow label="钱包 ID">
                <span className="font-mono text-xs break-all">{wallet.id || "—"}</span>
              </InfoRow>
              <InfoRow label="租户 ID">
                <span className="font-mono text-xs break-all">{wallet.tenantId}</span>
              </InfoRow>
              <InfoRow label="创建时间">{formatDateTime(wallet.createdAt)}</InfoRow>
              <InfoRow label="最后更新">{formatDateTime(wallet.updatedAt)}</InfoRow>
            </div>
          </div>
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ─── Ledger Entry Detail Drawer ─── */

function LedgerEntryDrawer({
  entry,
  open,
  onClose,
}: {
  entry: LedgerEntry | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!entry) return null;

  const isPositive = entry.entryType === "credit" || entry.entryType === "unfreeze";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" size="md" className="flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                isPositive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
              }`}
            >
              <Coins className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <SheetTitle>流水详情</SheetTitle>
              <SheetDescription>{formatDateTime(entry.createdAt)}</SheetDescription>
            </div>
          </div>
          <div className="pt-1">
            <Badge variant={entryTypeVariant(entry.entryType)}>
              {entryTypeLabel(entry.entryType)}
            </Badge>
          </div>
        </SheetHeader>

        <SheetBody className="flex flex-col gap-6">
          {/* 金额 */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
            <p className="text-xs font-medium text-muted-foreground mb-1">变动金额</p>
            <p
              className={`text-4xl font-bold ${
                isPositive ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {isPositive ? "+" : "-"}{formatAmount(entry.amount)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              变动后余额：<span className="font-mono font-medium text-slate-950">{formatAmount(entry.balanceAfter)}</span>
            </p>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              流水信息
            </p>
            <div className="grid grid-cols-1 gap-3">
              <InfoRow label="操作类型">
                <Badge variant={entryTypeVariant(entry.entryType)}>
                  {entryTypeLabel(entry.entryType)}
                </Badge>
              </InfoRow>
              <InfoRow label="说明">{entry.description}</InfoRow>
              <InfoRow label="租户 ID">
                <span className="font-mono text-xs break-all">{entry.tenantId}</span>
              </InfoRow>
              <InfoRow label="钱包 ID">
                <span className="font-mono text-xs break-all">{entry.walletId || "—"}</span>
              </InfoRow>
              {entry.referenceId && (
                <InfoRow label="关联 ID">
                  <span className="font-mono text-xs break-all">{entry.referenceId}</span>
                </InfoRow>
              )}
              {entry.referenceType && (
                <InfoRow label="关联类型">
                  <Badge variant="secondary">{entry.referenceType}</Badge>
                </InfoRow>
              )}
              <InfoRow label="记录时间">{formatDateTime(entry.createdAt)}</InfoRow>
            </div>
          </div>
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ─── Pager ─── */

function Pager({
  page, totalPages, loading, onPrev, onNext,
}: {
  page: number; totalPages: number; loading: boolean;
  onPrev: () => void; onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" onClick={onPrev} disabled={page === 0 || loading}>
        上一页
      </Button>
      <span className="text-sm text-muted-foreground">第 {page + 1} / {totalPages} 页</span>
      <Button variant="outline" size="sm" onClick={onNext} disabled={page >= totalPages - 1 || loading}>
        下一页
      </Button>
    </div>
  );
}

/* ─── Main Page ─── */

export default function CreditsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("wallets");

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletsLoading, setWalletsLoading] = useState(true);
  const [walletsError, setWalletsError] = useState<string | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [entryPage, setEntryPage] = useState(0);
  const [entryTotalPages, setEntryTotalPages] = useState(0);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null);

  async function fetchWallets() {
    setWalletsLoading(true);
    setWalletsError(null);
    try {
      const data = await apiFetch<unknown>("/api/admin/wallets");
      const normalized = normalizeListResponse<Partial<Wallet>>(data, [
        "wallets", "content", "items", "records",
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
      const data = await apiFetch<unknown>(`/api/admin/ledger-entries?page=${targetPage}&size=30`);
      const normalized: PageResponse<Partial<LedgerEntry>> = normalizePageResponse(data, [
        "entries", "ledgerEntries", "content", "items",
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

  useEffect(() => { fetchWallets(); }, []);

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (tab === "ledger" && entries.length === 0 && !entriesLoading) fetchEntries(0);
  }

  const totalBalance = wallets.reduce((s, w) => s + w.totalBalance, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">积分钱包</h2>
          <p className="text-sm text-muted-foreground">
            统一查看钱包余额结构、租户积分沉淀与账本流水明细。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => activeTab === "wallets" ? fetchWallets() : fetchEntries(entryPage)}
          disabled={activeTab === "wallets" ? walletsLoading : entriesLoading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${(activeTab === "wallets" ? walletsLoading : entriesLoading) ? "animate-spin" : ""}`} />
          刷新数据
        </Button>
      </div>

      {/* Stats */}
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
            <CardDescription>切换到流水页签后按分页方式加载</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {entriesLoading ? "..." : formatCount(entries.length)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
          {([
          { key: "wallets" as const, label: "钱包概览" },
          { key: "ledger" as const, label: "账本流水" },
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

      {/* Wallets Tab */}
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
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
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
                    <TableHead className="w-12 text-right">详情</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wallets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                        当前没有可展示的钱包数据。
                      </TableCell>
                    </TableRow>
                  ) : (
                    wallets.map((wallet) => (
                      <TableRow
                        key={wallet.id || wallet.tenantId}
                        className="group cursor-pointer"
                        onClick={() => setSelectedWallet(wallet)}
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground max-w-[140px] truncate">
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
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); setSelectedWallet(wallet); }}
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
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
        /* Ledger Tab */
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
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
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
                    <TableHead className="w-12 text-right">详情</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                        当前没有可展示的流水记录。
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry) => {
                      const isPositive = entry.entryType === "credit" || entry.entryType === "unfreeze";
                      return (
                        <TableRow
                          key={entry.id || `${entry.tenantId}-${entry.createdAt}`}
                          className="group cursor-pointer"
                          onClick={() => setSelectedEntry(entry)}
                        >
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDateTime(entry.createdAt)}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground max-w-[100px] truncate">
                            {entry.tenantId}
                          </TableCell>
                          <TableCell>
                            <Badge variant={entryTypeVariant(entry.entryType)}>
                              {entryTypeLabel(entry.entryType)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold">
                            <span className={isPositive ? "text-emerald-600" : "text-rose-600"}>
                              {isPositive ? "+" : "-"}{formatAmount(entry.amount)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground">
                            {formatAmount(entry.balanceAfter)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                            {entry.description}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); setSelectedEntry(entry); }}
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
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

      {/* Detail Drawers */}
      <WalletDetailDrawer
        wallet={selectedWallet}
        open={!!selectedWallet}
        onClose={() => setSelectedWallet(null)}
      />
      <LedgerEntryDrawer
        entry={selectedEntry}
        open={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  );
}
