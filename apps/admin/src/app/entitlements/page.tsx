"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, RefreshCw, SlidersHorizontal } from "lucide-react";
import { apiFetch, normalizePageResponse } from "@/lib/api";
import { formatCount, formatDate } from "@/lib/utils";
import { Entitlement, PageResponse } from "@/types";
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

function statusVariant(status: Entitlement["status"]) {
  switch (status) {
    case "active":
      return "success";
    case "expired":
      return "warning";
    case "revoked":
      return "destructive";
    default:
      return "secondary";
  }
}

function entitlementTypeLabel(type: Entitlement["entitlementType"]) {
  switch (type) {
    case "feature_access":
      return "功能访问";
    case "seat_limit":
      return "席位上限";
    case "quota_limit":
      return "额度限制";
    case "monthly_credit":
      return "月度积分";
    case "addon":
      return "增值能力";
    case "singer_slot":
      return "歌手席位";
    case "nft_mint_quota":
      return "NFT 铸造额度";
    case "distribution_tier":
      return "分发等级";
    default:
      return type;
  }
}

function statusLabel(status: Entitlement["status"]) {
  switch (status) {
    case "active":
      return "生效中";
    case "expired":
      return "已过期";
    case "revoked":
      return "已撤销";
    default:
      return status;
  }
}

function normalizeEntitlement(item: Partial<Entitlement>): Entitlement {
  return {
    id: item.id ?? "",
    tenantId: item.tenantId ?? "",
    productId: item.productId ?? "",
    planId: item.planId ?? null,
    entitlementType: (item.entitlementType ?? "feature_access") as Entitlement["entitlementType"],
    featureCode: item.featureCode ?? "unknown.feature",
    value: item.value ?? "0",
    validFrom: item.validFrom ?? "",
    validTo: item.validTo ?? null,
    status: (item.status ?? "active") as Entitlement["status"],
    createdAt: item.createdAt ?? "",
  };
}

export default function EntitlementsPage() {
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  async function fetchEntitlements(targetPage = 0) {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<unknown>(
        `/api/admin/entitlements?page=${targetPage}&size=20`
      );
      const normalized: PageResponse<Partial<Entitlement>> = normalizePageResponse(data, [
        "entitlements",
        "content",
        "items",
        "records",
      ]);
      setEntitlements(normalized.content.map(normalizeEntitlement));
      setTotalPages(normalized.totalPages);
      setPage(normalized.number);
    } catch {
      setEntitlements([]);
      setTotalPages(0);
      setPage(0);
      setError("加载权益配置失败，已回退为空列表。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEntitlements(0);
  }, []);

  const activeCount = entitlements.filter((item) => item.status === "active").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">权益配置</h2>
          <p className="text-sm text-muted-foreground">
            审核租户已授予的功能、额度和套餐衍生权益。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchEntitlements(page)}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新数据
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">当前页权益</CardTitle>
            <CardDescription>本页已加载的权益条目数量</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "..." : formatCount(entitlements.length)}
            </div>
            <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700">
              <BadgeCheck className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">生效中权益</CardTitle>
            <CardDescription>当前状态仍在生效中的授权数量</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "..." : formatCount(activeCount)}
            </div>
            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">分页状态</CardTitle>
            <CardDescription>适合按页巡视权益投放与失效情况</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "..." : `${page + 1}/${Math.max(totalPages, 1)}`}
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="warning">
          <AlertTitle>权益数据暂不可用</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-2xl border border-border/80 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
        {loading ? (
          <div className="flex flex-col gap-3 p-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>租户 ID</TableHead>
                <TableHead>产品 ID</TableHead>
                <TableHead>权益类型</TableHead>
                <TableHead>功能编码</TableHead>
                <TableHead>值</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>生效时间</TableHead>
                <TableHead>结束时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entitlements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    当前没有可展示的权益数据。
                  </TableCell>
                </TableRow>
              ) : (
                entitlements.map((item) => (
                  <TableRow key={item.id || `${item.tenantId}-${item.featureCode}`}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {item.tenantId || "未关联"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {item.productId || "未关联"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {entitlementTypeLabel(item.entitlementType)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-950">
                      {item.featureCode}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-semibold text-slate-950">
                      {item.value}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(item.validFrom)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(item.validTo)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEntitlements(page - 1)}
            disabled={page === 0 || loading}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {page + 1} / {totalPages} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEntitlements(page + 1)}
            disabled={page >= totalPages - 1 || loading}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}
