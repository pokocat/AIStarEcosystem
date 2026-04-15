"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, KeyRound, Layers3, Zap } from "lucide-react";
import { apiFetch, normalizePageResponse } from "@/lib/api";
import { formatCount, formatDate, formatDateTime } from "@/lib/utils";
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

function licenseTypeLabel(type: LicenseBatch["licenseType"]) {
  switch (type) {
    case "plan_activation":
      return "套餐激活";
    case "credit_pack":
      return "积分包";
    case "seat_expansion":
      return "席位扩容";
    case "addon":
      return "增值包";
    default:
      return type;
  }
}

function settlementLabel(mode: LicenseBatch["settlementMode"]) {
  switch (mode) {
    case "prepaid":
      return "预付结算";
    case "on_activation":
      return "激活结算";
    default:
      return mode;
  }
}

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

export default function LicenseBatchDetailPage() {
  const params = useParams<{ batchId: string }>();
  const batchId = Array.isArray(params.batchId) ? params.batchId[0] : params.batchId;

  const [batch, setBatch] = useState<LicenseBatch | null>(null);
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!batchId) return;

    async function fetchDetail() {
      setLoading(true);
      setError(null);

      try {
        const [batchData, keyData] = await Promise.all([
          apiFetch<unknown>(`/api/admin/license-batches/${batchId}`),
          apiFetch<unknown>(`/api/admin/license-keys?batchId=${batchId}&page=0&size=100`),
        ]);

        const normalizedKeys: PageResponse<Partial<LicenseKey>> = normalizePageResponse(keyData, [
          "keys",
          "licenseKeys",
          "content",
          "items",
        ]);

        setBatch(normalizeBatch(batchData as Partial<LicenseBatch>));
        setKeys(normalizedKeys.content.map(normalizeKey));
      } catch {
        setBatch(null);
        setKeys([]);
        setError("加载许可证批次详情失败，请稍后刷新重试。");
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [batchId]);

  const activationRate = useMemo(() => {
    if (!batch || batch.totalCount <= 0) return 0;
    return Math.round((batch.activatedCount / batch.totalCount) * 100);
  }, [batch]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-44" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="flex flex-col gap-4">
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href="/licenses">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回许可证列表
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertTitle>许可证详情暂不可用</AlertTitle>
          <AlertDescription>{error ?? "未找到该许可证批次。"} </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href="/licenses">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回许可证列表
          </Link>
        </Button>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{batch.batchNo}</h2>
            <Badge variant={licenseTypeVariant(batch.licenseType)}>
              {licenseTypeLabel(batch.licenseType)}
            </Badge>
            <Badge variant="outline">{settlementLabel(batch.settlementMode)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            批次 ID：<span className="font-mono">{batch.id}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">总发码量</CardTitle>
            <CardDescription>该批次生成或导入的秘钥总数量</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {formatCount(batch.totalCount)}
            </div>
            <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700">
              <Layers3 className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">已激活数</CardTitle>
            <CardDescription>已被最终用户核销并生效的秘钥数量</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {formatCount(batch.activatedCount)}
            </div>
            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
              <Zap className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">激活率</CardTitle>
            <CardDescription>用于判断渠道库存消化与批次效率</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {activationRate}%
            </div>
            <div className="rounded-xl bg-violet-100 p-2.5 text-violet-700">
              <KeyRound className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-border/80 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
          <CardHeader>
            <CardTitle className="text-lg">批次定义</CardTitle>
            <CardDescription>套餐、积分和有效期等核心配置快照</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">产品 ID</p>
              <p className="font-mono text-sm text-slate-950">{batch.productId || "未关联"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">套餐 ID</p>
              <p className="font-mono text-sm text-slate-950">{batch.planId ?? "未配置"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">积分增量</p>
              <p className="text-sm text-slate-950">{formatCount(batch.creditDelta)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">时长天数</p>
              <p className="text-sm text-slate-950">{batch.durationDays ?? "未配置"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">渠道归属</p>
              <p className="font-mono text-sm text-slate-950">
                {batch.channelPartnerId ?? "平台直营"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">创建时间</p>
              <p className="text-sm text-slate-950">{formatDateTime(batch.createdAt)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
          <CardHeader>
            <CardTitle className="text-lg">有效期窗口</CardTitle>
            <CardDescription>便于运营核对码库存是否已过期或即将失效</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">生效时间</p>
              <p className="text-sm text-slate-950">{formatDateTime(batch.validFrom)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">失效时间</p>
              <p className="text-sm text-slate-950">{formatDateTime(batch.validTo)}</p>
            </div>
            <Alert variant="info">
              <AlertTitle>当前页已串联批次与单码</AlertTitle>
              <AlertDescription>
                后续如果接外部 CRM 或渠道系统，这一页可以继续承接同步状态、结算方式与回传记录。
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
        <CardHeader>
          <CardTitle className="text-lg">单码清单</CardTitle>
          <CardDescription>用于观察批次内单个秘钥的激活与失效情况</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>密钥</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>激活用户</TableHead>
                <TableHead>激活租户</TableHead>
                <TableHead>激活时间</TableHead>
                <TableHead>过期时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    该批次下还没有可展示的单码记录。
                  </TableCell>
                </TableRow>
              ) : (
                keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-mono text-sm font-semibold text-slate-950">
                      {key.maskedCode}
                    </TableCell>
                    <TableCell>
                      <Badge variant={keyStatusVariant(key.status)}>{keyStatusLabel(key.status)}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {key.activatedByUserId ?? "未激活"}
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
        </CardContent>
      </Card>
    </div>
  );
}
