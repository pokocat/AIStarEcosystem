"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, RefreshCw, Users2 } from "lucide-react";
import { apiFetch, normalizePageResponse } from "@/lib/api";
import { formatCount, formatDate } from "@/lib/utils";
import { PageResponse, Tenant } from "@/types";
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

function statusVariant(status: Tenant["status"]) {
  switch (status) {
    case "active":
      return "success";
    case "suspended":
      return "warning";
    case "deleted":
      return "destructive";
    default:
      return "secondary";
  }
}

function typeVariant(type: Tenant["type"]) {
  switch (type) {
    case "organization":
      return "info";
    case "channel":
      return "secondary";
    default:
      return "outline";
  }
}

function typeLabel(type: Tenant["type"]) {
  switch (type) {
    case "organization":
      return "组织";
    case "channel":
      return "渠道";
    case "personal":
      return "个人";
    default:
      return type;
  }
}

function statusLabel(status: Tenant["status"]) {
  switch (status) {
    case "active":
      return "正常";
    case "suspended":
      return "已暂停";
    case "deleted":
      return "已删除";
    default:
      return status;
  }
}

function normalizeTenant(item: Partial<Tenant>): Tenant {
  return {
    id: item.id ?? "",
    name: item.name ?? "未命名租户",
    type: (item.type ?? "personal") as Tenant["type"],
    status: (item.status ?? "active") as Tenant["status"],
    ownerUserId: item.ownerUserId ?? "未绑定",
    createdAt: item.createdAt ?? "",
    updatedAt: item.updatedAt ?? "",
  };
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  async function fetchTenants(targetPage = 0) {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<unknown>(`/api/admin/tenants?page=${targetPage}&size=20`);
      const normalized: PageResponse<Partial<Tenant>> = normalizePageResponse(data, [
        "tenants",
        "content",
        "items",
        "records",
      ]);
      setTenants(normalized.content.map(normalizeTenant));
      setTotalPages(normalized.totalPages);
      setPage(normalized.number);
    } catch {
      setTenants([]);
      setTotalPages(0);
      setPage(0);
      setError("加载租户列表失败，已回退为空列表。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTenants(0);
  }, []);

  const organizationCount = tenants.filter((tenant) => tenant.type === "organization").length;
  const activeCount = tenants.filter((tenant) => tenant.status === "active").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">租户空间</h2>
          <p className="text-sm text-muted-foreground">
            管理组织、渠道与个人工作区的归属、状态和创建信息。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchTenants(page)} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新数据
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">当前页租户</CardTitle>
            <CardDescription>本页已加载的租户空间记录数</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "..." : formatCount(tenants.length)}
            </div>
            <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700">
              <Building2 className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">组织租户</CardTitle>
            <CardDescription>适用于企业或团队管理的租户类型</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "..." : formatCount(organizationCount)}
            </div>
            <div className="rounded-xl bg-violet-100 p-2.5 text-violet-700">
              <Users2 className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">正常租户</CardTitle>
            <CardDescription>状态为“正常”的租户空间数量</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "..." : formatCount(activeCount)}
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="warning">
          <AlertTitle>租户数据暂不可用</AlertTitle>
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
                <TableHead>租户名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>所有者 ID</TableHead>
                <TableHead>创建时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    当前没有可展示的租户数据。
                  </TableCell>
                </TableRow>
              ) : (
                tenants.map((tenant) => (
                  <TableRow key={tenant.id || tenant.name}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/tenants/${tenant.id}`}
                        className="text-slate-950 transition-colors hover:text-sky-700 hover:underline"
                      >
                        {tenant.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={typeVariant(tenant.type)}>{typeLabel(tenant.type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(tenant.status)}>{statusLabel(tenant.status)}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {tenant.ownerUserId}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(tenant.createdAt)}
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
            onClick={() => fetchTenants(page - 1)}
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
            onClick={() => fetchTenants(page + 1)}
            disabled={page >= totalPages - 1 || loading}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}
