"use client";

import { useEffect, useState } from "react";
import { KeyRound, Layers3, RefreshCw } from "lucide-react";
import { apiFetch, normalizePageResponse } from "@/lib/api";
import { formatCount, formatDate } from "@/lib/utils";
import { LicenseBatch, LicenseKey, PageResponse } from "@/types";
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

type Tab = "batches" | "keys";

function keyStatusVariant(status: LicenseKey["status"]) {
  switch (status) {
    case "activated":
      return "success";
    case "sold":
      return "info";
    case "allocated":
      return "secondary";
    case "created":
      return "outline";
    case "expired":
      return "warning";
    case "revoked":
      return "destructive";
    default:
      return "outline";
  }
}

function licenseTypeVariant(type: LicenseBatch["licenseType"]) {
  switch (type) {
    case "plan_activation":
      return "default";
    case "credit_pack":
      return "info";
    case "seat_expansion":
      return "secondary";
    case "addon":
      return "outline";
    default:
      return "outline";
  }
}

function keyStatusLabel(status: LicenseKey["status"]) {
  switch (status) {
    case "created":
      return "已创建";
    case "allocated":
      return "已分配";
    case "sold":
      return "已售出";
    case "activated":
      return "已激活";
    case "expired":
      return "已过期";
    case "revoked":
      return "已撤销";
    default:
      return status;
  }
}

function licenseTypeLabel(type: LicenseBatch["licenseType"]) {
  switch (type) {
    case "plan_activation":
      return "套餐激活";
    case "credit_pack":
      return "积分包";
    case "seat_expansion":
      return "席位扩展";
    case "addon":
      return "增值包";
    default:
      return type;
  }
}

function settlementLabel(mode: LicenseBatch["settlementMode"]) {
  switch (mode) {
    case "prepaid":
      return "预付费";
    case "on_activation":
      return "激活结算";
    default:
      return mode;
  }
}

function normalizeBatch(item: Partial<LicenseBatch>): LicenseBatch {
  return {
    id: item.id ?? "",
    batchNo: item.batchNo ?? "未命名批次",
    productId: item.productId ?? "",
    planId: item.planId ?? null,
    licenseType: (item.licenseType ?? "addon") as LicenseBatch["licenseType"],
    durationDays: item.durationDays ?? null,
    creditDelta: Number(item.creditDelta ?? 0),
    settlementMode: (item.settlementMode ?? "prepaid") as LicenseBatch["settlementMode"],
    totalCount: Number(item.totalCount ?? 0),
    activatedCount: Number(item.activatedCount ?? 0),
    channelPartnerId: item.channelPartnerId ?? null,
    validFrom: item.validFrom ?? "",
    validTo: item.validTo ?? null,
    createdAt: item.createdAt ?? "",
  };
}

function normalizeKey(item: Partial<LicenseKey>): LicenseKey {
  return {
    id: item.id ?? "",
    batchId: item.batchId ?? "",
    maskedCode: item.maskedCode ?? "未生成",
    status: (item.status ?? "created") as LicenseKey["status"],
    activatedByUserId: item.activatedByUserId ?? null,
    activatedTenantId: item.activatedTenantId ?? null,
    activatedAt: item.activatedAt ?? null,
    expiresAt: item.expiresAt ?? null,
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

export default function LicensesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("batches");
  const [batches, setBatches] = useState<LicenseBatch[]>([]);
  const [batchPage, setBatchPage] = useState(0);
  const [batchTotalPages, setBatchTotalPages] = useState(0);
  const [batchLoading, setBatchLoading] = useState(true);
  const [batchError, setBatchError] = useState<string | null>(null);

  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [keyPage, setKeyPage] = useState(0);
  const [keyTotalPages, setKeyTotalPages] = useState(0);
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  async function fetchBatches(targetPage = 0) {
    setBatchLoading(true);
    setBatchError(null);

    try {
      const data = await apiFetch<unknown>(
        `/api/admin/license-batches?page=${targetPage}&size=20`
      );
      const normalized: PageResponse<Partial<LicenseBatch>> = normalizePageResponse(data, [
        "batches",
        "licenseBatches",
        "content",
        "items",
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
        "keys",
        "licenseKeys",
        "content",
        "items",
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

  useEffect(() => {
    fetchBatches(0);
  }, []);

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (tab === "keys" && keys.length === 0 && !keyLoading) {
      fetchKeys(0);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">许可证管理</h2>
          <p className="text-sm text-muted-foreground">
            追踪许可证批次、密钥激活状态与发放节奏。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => (activeTab === "batches" ? fetchBatches(batchPage) : fetchKeys(keyPage))}
          disabled={activeTab === "batches" ? batchLoading : keyLoading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${(activeTab === "batches" ? batchLoading : keyLoading) ? "animate-spin" : ""}`} />
          刷新数据
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">批次数量</CardTitle>
            <CardDescription>当前页许可证批次记录数</CardDescription>
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
            <CardDescription>当前页许可证密钥记录数</CardDescription>
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
            <CardDescription>本页批次已激活许可证汇总</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {batchLoading
                ? "..."
                : formatCount(
                    batches.reduce((sum, batch) => sum + batch.activatedCount, 0)
                  )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 border-b border-border">
        {([
          { key: "batches" as const, label: "许可证批次" },
          { key: "keys" as const, label: "许可证密钥" },
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
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>批次编号</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>产品 ID</TableHead>
                    <TableHead>结算方式</TableHead>
                    <TableHead className="text-right">总数量</TableHead>
                    <TableHead className="text-right">已激活</TableHead>
                    <TableHead>生效日期</TableHead>
                    <TableHead>失效日期</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                        当前没有可展示的许可证批次。
                      </TableCell>
                    </TableRow>
                  ) : (
                    batches.map((batch) => (
                      <TableRow key={batch.id || batch.batchNo}>
                        <TableCell className="font-mono text-sm font-semibold text-slate-950">
                          {batch.batchNo}
                        </TableCell>
                        <TableCell>
                          <Badge variant={licenseTypeVariant(batch.licenseType)}>
                            {licenseTypeLabel(batch.licenseType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
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
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(batch.validTo)}
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
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>密钥</TableHead>
                    <TableHead>批次 ID</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>激活租户</TableHead>
                    <TableHead>激活时间</TableHead>
                    <TableHead>过期时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        当前没有可展示的许可证密钥。
                      </TableCell>
                    </TableRow>
                  ) : (
                    keys.map((key) => (
                      <TableRow key={key.id || key.maskedCode}>
                        <TableCell className="font-mono text-sm font-semibold text-slate-950">
                          {key.maskedCode}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {key.batchId || "未关联"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={keyStatusVariant(key.status)}>
                            {keyStatusLabel(key.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {key.activatedTenantId ?? "未激活"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(key.activatedAt)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(key.expiresAt)}
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
    </div>
  );
}
