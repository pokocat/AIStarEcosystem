"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ChevronRight,
  KeyRound,
  Layers3,
  RefreshCw,
} from "lucide-react";
import { apiFetch, normalizePageResponse } from "@/lib/api";
import { formatCount, formatDate, formatDateTime } from "@/lib/utils";
import { LicenseBatch, LicenseKey, PageResponse } from "@/types";
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

type Tab = "batches" | "keys";

/* ─── helpers ─── */

function keyStatusVariant(status: LicenseKey["status"]) {
  switch (status) {
    case "activated": return "success";
    case "sold":      return "info";
    case "allocated": return "secondary";
    case "created":   return "outline";
    case "expired":   return "warning";
    case "revoked":   return "destructive";
    default:          return "outline";
  }
}

function licenseTypeVariant(type: LicenseBatch["licenseType"]) {
  switch (type) {
    case "plan_activation": return "default";
    case "credit_pack":     return "info";
    case "seat_expansion":  return "secondary";
    case "addon":           return "outline";
    default:                return "outline";
  }
}

function keyStatusLabel(status: LicenseKey["status"]) {
  const labels: Record<LicenseKey["status"], string> = {
    created: "已创建",
    allocated: "已分配",
    sold: "已售出",
    activated: "已激活",
    expired: "已过期",
    revoked: "已撤销",
  };
  return labels[status] ?? status;
}

function licenseTypeLabel(type: LicenseBatch["licenseType"]) {
  const labels: Record<LicenseBatch["licenseType"], string> = {
    plan_activation: "套餐激活",
    credit_pack: "积分包",
    seat_expansion: "席位扩展",
    addon: "增值包",
  };
  return labels[type] ?? type;
}

function settlementLabel(mode: LicenseBatch["settlementMode"]) {
  return mode === "prepaid" ? "预付费" : "激活结算";
}

function normalizeBatch(item: Partial<LicenseBatch>): LicenseBatch {
  return {
    id:               item.id ?? "",
    batchNo:          item.batchNo ?? "未命名批次",
    productId:        item.productId ?? "",
    planId:           item.planId ?? null,
    licenseType:      (item.licenseType ?? "addon") as LicenseBatch["licenseType"],
    durationDays:     item.durationDays ?? null,
    creditDelta:      Number(item.creditDelta ?? 0),
    settlementMode:   (item.settlementMode ?? "prepaid") as LicenseBatch["settlementMode"],
    totalCount:       Number(item.totalCount ?? 0),
    activatedCount:   Number(item.activatedCount ?? 0),
    channelPartnerId: item.channelPartnerId ?? null,
    validFrom:        item.validFrom ?? "",
    validTo:          item.validTo ?? null,
    createdAt:        item.createdAt ?? "",
  };
}

function normalizeKey(item: Partial<LicenseKey>): LicenseKey {
  return {
    id:                item.id ?? "",
    batchId:           item.batchId ?? "",
    maskedCode:        item.maskedCode ?? "未生成",
    status:            (item.status ?? "created") as LicenseKey["status"],
    activatedByUserId: item.activatedByUserId ?? null,
    activatedTenantId: item.activatedTenantId ?? null,
    activatedAt:       item.activatedAt ?? null,
    expiresAt:         item.expiresAt ?? null,
    createdAt:         item.createdAt ?? "",
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

/* ─── Batch Detail Drawer ─── */

function BatchDetailDrawer({
  batch,
  open,
  onClose,
}: {
  batch: LicenseBatch | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!batch) return null;

  const activationRate =
    batch.totalCount > 0
      ? Math.round((batch.activatedCount / batch.totalCount) * 100)
      : 0;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" size="lg" className="flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <Layers3 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="font-mono truncate">{batch.batchNo}</SheetTitle>
              <SheetDescription>许可证批次详情</SheetDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant={licenseTypeVariant(batch.licenseType)}>
              {licenseTypeLabel(batch.licenseType)}
            </Badge>
            <Badge variant="outline">{settlementLabel(batch.settlementMode)}</Badge>
          </div>
        </SheetHeader>

        <SheetBody className="flex flex-col gap-6">
          {/* 激活进度 */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              激活进度
            </p>
            <div className="rounded-xl border border-border bg-muted/30 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">激活率</span>
                <span className="text-2xl font-bold text-slate-950">{activationRate}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${activationRate}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>已激活：{formatCount(batch.activatedCount)}</span>
                <span>总数：{formatCount(batch.totalCount)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* 批次信息 */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              批次信息
            </p>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="批次编号">
                <code className="text-xs font-mono">{batch.batchNo}</code>
              </InfoRow>
              <InfoRow label="许可证类型">
                <Badge variant={licenseTypeVariant(batch.licenseType)}>
                  {licenseTypeLabel(batch.licenseType)}
                </Badge>
              </InfoRow>
              <InfoRow label="结算方式">
                <Badge variant="outline">{settlementLabel(batch.settlementMode)}</Badge>
              </InfoRow>
              {batch.durationDays !== null && (
                <InfoRow label="有效期">
                  <span>{batch.durationDays} 天</span>
                </InfoRow>
              )}
              {batch.creditDelta !== 0 && (
                <InfoRow label="积分变动">
                  <span className={batch.creditDelta > 0 ? "text-emerald-600 font-semibold" : "text-rose-600"}>
                    {batch.creditDelta > 0 ? "+" : ""}{formatCount(batch.creditDelta)}
                  </span>
                </InfoRow>
              )}
            </div>
          </div>

          <Separator />

          {/* 关联 */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              关联信息
            </p>
            <div className="grid grid-cols-1 gap-3">
              <InfoRow label="产品 ID">
                <span className="font-mono text-xs break-all">{batch.productId || "未关联"}</span>
              </InfoRow>
              {batch.planId && (
                <InfoRow label="套餐 ID">
                  <span className="font-mono text-xs break-all">{batch.planId}</span>
                </InfoRow>
              )}
              {batch.channelPartnerId && (
                <InfoRow label="渠道合作方 ID">
                  <span className="font-mono text-xs break-all">{batch.channelPartnerId}</span>
                </InfoRow>
              )}
            </div>
          </div>

          <Separator />

          {/* 时间 */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              时间记录
            </p>
            <div className="grid grid-cols-1 gap-3">
              <InfoRow label="创建时间">{formatDateTime(batch.createdAt)}</InfoRow>
              <InfoRow label="生效日期">{formatDate(batch.validFrom)}</InfoRow>
              <InfoRow label="失效日期">
                {batch.validTo ? formatDate(batch.validTo) : (
                  <span className="text-muted-foreground">永久有效</span>
                )}
              </InfoRow>
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

/* ─── Key Detail Drawer ─── */

function KeyDetailDrawer({
  licenseKey,
  open,
  onClose,
}: {
  licenseKey: LicenseKey | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!licenseKey) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" size="md" className="flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <KeyRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="font-mono truncate">{licenseKey.maskedCode}</SheetTitle>
              <SheetDescription>许可证密钥详情</SheetDescription>
            </div>
          </div>
          <div className="pt-1">
            <Badge variant={keyStatusVariant(licenseKey.status)}>
              {keyStatusLabel(licenseKey.status)}
            </Badge>
          </div>
        </SheetHeader>

        <SheetBody className="flex flex-col gap-6">
          {/* 密钥信息 */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              密钥信息
            </p>
            <div className="grid grid-cols-1 gap-3">
              <InfoRow label="密钥（掩码）">
                <code className="font-mono text-sm bg-muted px-2 py-1 rounded">{licenseKey.maskedCode}</code>
              </InfoRow>
              <InfoRow label="批次 ID">
                <span className="font-mono text-xs break-all">{licenseKey.batchId || "未关联"}</span>
              </InfoRow>
              <InfoRow label="当前状态">
                <Badge variant={keyStatusVariant(licenseKey.status)}>
                  {keyStatusLabel(licenseKey.status)}
                </Badge>
              </InfoRow>
            </div>
          </div>

          {(licenseKey.activatedByUserId || licenseKey.activatedTenantId) && (
            <>
              <Separator />
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  激活信息
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {licenseKey.activatedByUserId && (
                    <InfoRow label="激活用户 ID">
                      <span className="font-mono text-xs break-all">{licenseKey.activatedByUserId}</span>
                    </InfoRow>
                  )}
                  {licenseKey.activatedTenantId && (
                    <InfoRow label="激活租户 ID">
                      <span className="font-mono text-xs break-all">{licenseKey.activatedTenantId}</span>
                    </InfoRow>
                  )}
                  <InfoRow label="激活时间">
                    {licenseKey.activatedAt ? formatDateTime(licenseKey.activatedAt) : (
                      <span className="text-muted-foreground">尚未激活</span>
                    )}
                  </InfoRow>
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              时间记录
            </p>
            <div className="grid grid-cols-1 gap-3">
              <InfoRow label="创建时间">{formatDateTime(licenseKey.createdAt)}</InfoRow>
              <InfoRow label="过期时间">
                {licenseKey.expiresAt ? formatDateTime(licenseKey.expiresAt) : (
                  <span className="text-muted-foreground">永不过期</span>
                )}
              </InfoRow>
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

export default function LicensesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("batches");

  const [batches, setBatches] = useState<LicenseBatch[]>([]);
  const [batchPage, setBatchPage] = useState(0);
  const [batchTotalPages, setBatchTotalPages] = useState(0);
  const [batchLoading, setBatchLoading] = useState(true);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<LicenseBatch | null>(null);

  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [keyPage, setKeyPage] = useState(0);
  const [keyTotalPages, setKeyTotalPages] = useState(0);
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<LicenseKey | null>(null);

  async function fetchBatches(targetPage = 0) {
    setBatchLoading(true);
    setBatchError(null);
    try {
      const data = await apiFetch<unknown>(`/api/admin/license-batches?page=${targetPage}&size=20`);
      const normalized: PageResponse<Partial<LicenseBatch>> = normalizePageResponse(data, [
        "batches", "licenseBatches", "content", "items",
      ]);
      setBatches(normalized.content.map(normalizeBatch));
      setBatchTotalPages(normalized.totalPages);
      setBatchPage(normalized.number);
    } catch {
      setBatches([]);
      setBatchTotalPages(0);
      setBatchPage(0);
      setBatchError("加载许可证批次失败，已回退为空列表。");
    } finally {
      setBatchLoading(false);
    }
  }

  async function fetchKeys(targetPage = 0) {
    setKeyLoading(true);
    setKeyError(null);
    try {
      const data = await apiFetch<unknown>(`/api/admin/license-keys?page=${targetPage}&size=20`);
      const normalized: PageResponse<Partial<LicenseKey>> = normalizePageResponse(data, [
        "keys", "licenseKeys", "content", "items",
      ]);
      setKeys(normalized.content.map(normalizeKey));
      setKeyTotalPages(normalized.totalPages);
      setKeyPage(normalized.number);
    } catch {
      setKeys([]);
      setKeyTotalPages(0);
      setKeyPage(0);
      setKeyError("加载许可证密钥失败，已回退为空列表。");
    } finally {
      setKeyLoading(false);
    }
  }

  useEffect(() => { fetchBatches(0); }, []);

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (tab === "keys" && keys.length === 0 && !keyLoading) fetchKeys(0);
  }

  const totalActivated = batches.reduce((s, b) => s + b.activatedCount, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">许可证管理</h2>
          <p className="text-sm text-muted-foreground">
            统一追踪卡密批次、单码状态、激活进度与发放节奏。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => activeTab === "batches" ? fetchBatches(batchPage) : fetchKeys(keyPage)}
          disabled={activeTab === "batches" ? batchLoading : keyLoading}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${(activeTab === "batches" ? batchLoading : keyLoading) ? "animate-spin" : ""}`}
          />
          刷新数据
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">批次数量</CardTitle>
            <CardDescription>当前页已加载的卡密批次记录数</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {batchLoading ? "..." : formatCount(batches.length)}
            </div>
            <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700">
              <Layers3 className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">密钥数量</CardTitle>
            <CardDescription>当前页已加载的单码记录数</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {keyLoading ? "..." : formatCount(keys.length)}
            </div>
            <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700">
              <KeyRound className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">已激活数</CardTitle>
            <CardDescription>本页批次内已完成激活的单码汇总</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {batchLoading ? "..." : formatCount(totalActivated)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
          {([
          { key: "batches" as const, label: "卡密批次" },
          { key: "keys" as const, label: "单码列表" },
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

      {/* Batches Tab */}
      {activeTab === "batches" ? (
        <div className="flex flex-col gap-4">
          {batchError && (
            <Alert variant="warning">
              <AlertTitle>批次数据暂不可用</AlertTitle>
              <AlertDescription>{batchError}</AlertDescription>
            </Alert>
          )}
          <div className="rounded-2xl border border-border/80 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
            {batchLoading ? (
              <div className="flex flex-col gap-3 p-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>批次编号</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>产品</TableHead>
                    <TableHead>结算方式</TableHead>
                    <TableHead className="text-right">发码量</TableHead>
                    <TableHead className="text-right">已激活</TableHead>
                    <TableHead>生效日期</TableHead>
                    <TableHead className="w-12 text-right">详情</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                        当前没有可展示的卡密批次。
                      </TableCell>
                    </TableRow>
                  ) : (
                    batches.map((batch) => (
                      <TableRow
                        key={batch.id || batch.batchNo}
                        className="group cursor-pointer"
                        onClick={() => setSelectedBatch(batch)}
                      >
                        <TableCell className="font-mono text-sm font-semibold text-slate-950">
                          {batch.batchNo}
                        </TableCell>
                        <TableCell>
                          <Badge variant={licenseTypeVariant(batch.licenseType)}>
                            {licenseTypeLabel(batch.licenseType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground max-w-[100px] truncate">
                          {batch.productId || "未关联"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{settlementLabel(batch.settlementMode)}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCount(batch.totalCount)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-emerald-700">
                          {formatCount(batch.activatedCount)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(batch.validFrom)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); setSelectedBatch(batch); }}
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
          <Pager
            page={batchPage}
            totalPages={batchTotalPages}
            loading={batchLoading}
            onPrev={() => fetchBatches(batchPage - 1)}
            onNext={() => fetchBatches(batchPage + 1)}
          />
        </div>
      ) : (
        /* Keys Tab */
        <div className="flex flex-col gap-4">
          {keyError && (
            <Alert variant="warning">
              <AlertTitle>密钥数据暂不可用</AlertTitle>
              <AlertDescription>{keyError}</AlertDescription>
            </Alert>
          )}
          <div className="rounded-2xl border border-border/80 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
            {keyLoading ? (
              <div className="flex flex-col gap-3 p-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                      <TableHead>密钥</TableHead>
                      <TableHead>所属批次</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>激活租户</TableHead>
                      <TableHead>激活时间</TableHead>
                    <TableHead>过期时间</TableHead>
                    <TableHead className="w-12 text-right">详情</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                        当前没有可展示的单码记录。
                      </TableCell>
                    </TableRow>
                  ) : (
                    keys.map((key) => (
                      <TableRow
                        key={key.id || key.maskedCode}
                        className="group cursor-pointer"
                        onClick={() => setSelectedKey(key)}
                      >
                        <TableCell className="font-mono text-sm font-semibold text-slate-950">
                          {key.maskedCode}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground max-w-[100px] truncate">
                          {key.batchId || "未关联"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={keyStatusVariant(key.status)}>
                            {keyStatusLabel(key.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground max-w-[100px] truncate">
                          {key.activatedTenantId ?? "未激活"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(key.activatedAt)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(key.expiresAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); setSelectedKey(key); }}
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
          <Pager
            page={keyPage}
            totalPages={keyTotalPages}
            loading={keyLoading}
            onPrev={() => fetchKeys(keyPage - 1)}
            onNext={() => fetchKeys(keyPage + 1)}
          />
        </div>
      )}

      {/* Detail Drawers */}
      <BatchDetailDrawer
        batch={selectedBatch}
        open={!!selectedBatch}
        onClose={() => setSelectedBatch(null)}
      />
      <KeyDetailDrawer
        licenseKey={selectedKey}
        open={!!selectedKey}
        onClose={() => setSelectedKey(null)}
      />
    </div>
  );
}
