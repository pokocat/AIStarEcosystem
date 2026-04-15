"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCw, ShieldAlert } from "lucide-react";
import { apiFetch, normalizePageResponse } from "@/lib/api";
import { formatCount, formatDateTime } from "@/lib/utils";
import { AuditLog, PageResponse } from "@/types";
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

function normalizeLog(item: Partial<AuditLog>): AuditLog {
  return {
    id: item.id ?? "",
    userId: item.userId ?? null,
    tenantId: item.tenantId ?? null,
    action: item.action ?? "unknown.action",
    resourceType: item.resourceType ?? "unknown_resource",
    resourceId: item.resourceId ?? null,
    ipAddress: item.ipAddress ?? null,
    userAgent: item.userAgent ?? null,
    result: (item.result ?? "success") as AuditLog["result"],
    detail: item.detail ?? null,
    createdAt: item.createdAt ?? "",
  };
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  async function fetchLogs(targetPage = 0) {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<unknown>(`/api/admin/audit-logs?page=${targetPage}&size=30`);
      const normalized: PageResponse<Partial<AuditLog>> = normalizePageResponse(data, [
        "logs",
        "auditLogs",
        "content",
        "items",
      ]);
      setLogs(normalized.content.map(normalizeLog));
      setTotalPages(normalized.totalPages);
      setPage(normalized.number);
    } catch {
      setLogs([]);
      setTotalPages(0);
      setPage(0);
      setError("加载审计日志失败，已回退为空列表。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs(0);
  }, []);

  const failureCount = logs.filter((log) => log.result === "failure").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">审计日志</h2>
          <p className="text-sm text-muted-foreground">
            查看平台操作记录、安全事件与资源访问结果。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchLogs(page)} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新数据
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">当前页日志</CardTitle>
            <CardDescription>本页已加载的审计记录条数</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "..." : formatCount(logs.length)}
            </div>
            <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700">
              <Activity className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">失败事件</CardTitle>
            <CardDescription>结果为失败的操作数量</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "..." : formatCount(failureCount)}
            </div>
            <div className="rounded-xl bg-rose-100 p-2.5 text-rose-700">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">分页状态</CardTitle>
            <CardDescription>便于继续翻阅后续操作记录</CardDescription>
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
          <AlertTitle>审计数据暂不可用</AlertTitle>
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
                <TableHead>时间</TableHead>
                <TableHead>用户 ID</TableHead>
                <TableHead>动作</TableHead>
                <TableHead>资源类型</TableHead>
                <TableHead>资源 ID</TableHead>
                <TableHead>结果</TableHead>
                <TableHead>IP 地址</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    当前没有可展示的审计日志。
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id || `${log.action}-${log.createdAt}`}>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.userId ?? "匿名"}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-slate-950">
                      {log.action}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{log.resourceType}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.resourceId ?? "无"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.result === "success" ? "success" : "destructive"}>
                        {log.result === "success" ? "成功" : "失败"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.ipAddress ?? "未知"}
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
            onClick={() => fetchLogs(page - 1)}
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
            onClick={() => fetchLogs(page + 1)}
            disabled={page >= totalPages - 1 || loading}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}
