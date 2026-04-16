"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { apiFetch, normalizePageResponse } from "@/lib/api";
import { formatCount, formatDateTime } from "@/lib/utils";
import { AuditLog, PageResponse } from "@/types";
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

function normalizeLog(item: Partial<AuditLog>): AuditLog {
  return {
    id:           item.id ?? "",
    userId:       item.userId ?? null,
    tenantId:     item.tenantId ?? null,
    action:       item.action ?? "unknown.action",
    resourceType: item.resourceType ?? "unknown_resource",
    resourceId:   item.resourceId ?? null,
    ipAddress:    item.ipAddress ?? null,
    userAgent:    item.userAgent ?? null,
    result:       (item.result ?? "success") as AuditLog["result"],
    detail:       item.detail ?? null,
    createdAt:    item.createdAt ?? "",
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

/* ─── Audit Log Detail Drawer ─── */

function AuditDetailDrawer({
  log,
  open,
  onClose,
}: {
  log: AuditLog | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!log) return null;

  const isSuccess = log.result === "success";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" size="lg" className="flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                isSuccess ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
              }`}
            >
              {isSuccess ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <ShieldAlert className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <SheetTitle className="font-mono text-base truncate">{log.action}</SheetTitle>
              <SheetDescription>{formatDateTime(log.createdAt)}</SheetDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant={isSuccess ? "success" : "destructive"}>
              {isSuccess ? "成功" : "失败"}
            </Badge>
            <Badge variant="secondary">{log.resourceType}</Badge>
          </div>
        </SheetHeader>

        <SheetBody className="flex flex-col gap-6">
          {/* 操作信息 */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              操作信息
            </p>
            <div className="grid grid-cols-1 gap-3">
              <InfoRow label="动作标识">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{log.action}</code>
              </InfoRow>
              <InfoRow label="资源类型">
                <Badge variant="secondary">{log.resourceType}</Badge>
              </InfoRow>
              {log.resourceId && (
                <InfoRow label="资源 ID">
                  <span className="font-mono text-xs break-all">{log.resourceId}</span>
                </InfoRow>
              )}
            </div>
          </div>

          <Separator />

          {/* 主体信息 */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              主体信息
            </p>
            <div className="grid grid-cols-1 gap-3">
              <InfoRow label="用户 ID">
                <span className="font-mono text-xs">{log.userId ?? "匿名 / 系统"}</span>
              </InfoRow>
              {log.tenantId && (
                <InfoRow label="租户 ID">
                  <span className="font-mono text-xs">{log.tenantId}</span>
                </InfoRow>
              )}
              <InfoRow label="来源 IP">
                <span className="font-mono text-xs">{log.ipAddress ?? "未记录"}</span>
              </InfoRow>
            </div>
          </div>

          {log.userAgent && (
            <>
              <Separator />
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  客户端信息
                </p>
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <p className="text-xs font-mono text-muted-foreground leading-5 break-all">
                    {log.userAgent}
                  </p>
                </div>
              </div>
            </>
          )}

          {log.detail && (
            <>
              <Separator />
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  操作详情
                </p>
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground leading-6 break-all">{log.detail}</p>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* 时间 */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              时间
            </p>
            <InfoRow label="发生时间">{formatDateTime(log.createdAt)}</InfoRow>
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

/* ─── Main Page ─── */

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  async function fetchLogs(targetPage = 0) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<unknown>(`/api/admin/audit-logs?page=${targetPage}&size=30`);
      const normalized: PageResponse<Partial<AuditLog>> = normalizePageResponse(data, [
        "logs", "auditLogs", "content", "items",
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

  useEffect(() => { fetchLogs(0); }, []);

  const failureCount = logs.filter((l) => l.result === "failure").length;
  const successCount = logs.filter((l) => l.result === "success").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">审计日志</h2>
          <p className="text-sm text-muted-foreground">
            统一查看平台操作记录、安全结果与资源访问轨迹。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchLogs(page)} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新数据
        </Button>
      </div>

      {/* Stats */}
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
            <CardTitle className="text-base">成功事件</CardTitle>
            <CardDescription>操作结果为成功的记录数</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "..." : formatCount(successCount)}
            </div>
            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
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
      </div>

      {error && (
        <Alert variant="warning">
          <AlertTitle>审计数据暂不可用</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-border/80 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
        {loading ? (
          <div className="flex flex-col gap-3 p-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
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
                <TableHead>结果</TableHead>
                <TableHead>IP 地址</TableHead>
                <TableHead className="w-12 text-right">详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    当前没有可展示的审计日志。
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow
                    key={log.id || `${log.action}-${log.createdAt}`}
                    className="group cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground max-w-[120px] truncate">
                      {log.userId ?? "匿名"}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-slate-950 max-w-[160px] truncate">
                      {log.action}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{log.resourceType}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.result === "success" ? "success" : "destructive"}>
                        {log.result === "success" ? "成功" : "失败"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.ipAddress ?? "未知"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchLogs(page - 1)} disabled={page === 0 || loading}>
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">第 {page + 1} / {totalPages} 页</span>
          <Button variant="outline" size="sm" onClick={() => fetchLogs(page + 1)} disabled={page >= totalPages - 1 || loading}>
            下一页
          </Button>
        </div>
      )}

      {/* Detail Drawer */}
      <AuditDetailDrawer
        log={selectedLog}
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
}
