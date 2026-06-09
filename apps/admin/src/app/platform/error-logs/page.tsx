"use client";

// ─────────────────────────────────────────────────────────────────────────────
// /platform/error-logs — 错误日志（v0.30）。
// 仅 SUPER_ADMIN 可见（sidebar 已 role-gate）；URL 直访时服务端 403 兜底。
// 表格列：时间 / LogId / 主机 / 用户 / 接口 / 状态 / 错误简述；点行打开详情对话框
// 显示完整 stacktrace + sanitized requestParams + UA + 客户端 IP。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { AlertTriangle, Search, RefreshCcw, Copy as CopyIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ErrorLogApi } from "@/api";
import type { ErrorLog } from "@/types/error-log";
import { formatDateTimeCN } from "@/lib/utils";

function statusTone(status: number | null | undefined): "danger" | "warning" | "neutral" {
  if (status == null) return "neutral";
  if (status >= 500) return "danger";
  if (status >= 400) return "warning";
  return "neutral";
}

/** 长字符串截短 + 省略号；用于表格里的 message / endpoint 列。 */
function truncate(s: string | null | undefined, max: number): string {
  if (!s) return "—";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function userDisplay(log: ErrorLog): string {
  return log.username || log.userId || "—";
}

function shortUserId(id: string | null | undefined): string | null {
  if (!id) return null;
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export default function ErrorLogsPage() {
  const [logs, setLogs] = React.useState<ErrorLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<ErrorLog | null>(null);

  // 过滤条件（client-side 过滤 logId/message 自由搜索 + server-side 过滤接口子串、状态码、traceId）
  const [query, setQuery] = React.useState("");
  const [endpointFilter, setEndpointFilter] = React.useState("");
  const [traceIdFilter, setTraceIdFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"" | "4xx" | "5xx">("");

  const fetchLogs = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await ErrorLogApi.listErrorLogs({
        endpoint: endpointFilter.trim() || undefined,
        traceId: traceIdFilter.trim() || undefined,
        size: 50,
      });
      setLogs(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载错误日志失败");
    } finally {
      setLoading(false);
    }
  }, [endpointFilter, traceIdFilter]);

  React.useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const filtered = React.useMemo(() => {
    return logs.filter((log) => {
      if (statusFilter === "5xx" && !(log.httpStatus && log.httpStatus >= 500)) return false;
      if (statusFilter === "4xx" && !(log.httpStatus && log.httpStatus >= 400 && log.httpStatus < 500)) return false;
      if (query) {
        const q = query.toLowerCase();
        const hay = [
          log.logId,
          log.traceId,
          log.message,
          log.username,
          log.userId,
          log.errorType,
          log.errorCode,
          log.endpoint,
          log.hostname,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, statusFilter, query]);

  const counts = React.useMemo(() => {
    const total = logs.length;
    const fivexx = logs.filter((l) => (l.httpStatus ?? 0) >= 500).length;
    const fourxx = logs.filter((l) => (l.httpStatus ?? 0) >= 400 && (l.httpStatus ?? 0) < 500).length;
    return { total, fivexx, fourxx };
  }, [logs]);

  return (
    <div className="admin-page">
      <PageHeader
        title="错误日志"
        description="所有用户操作触发的后端异常（业务错误 + 系统错误）。用户报错时拿「追查号」即可秒查。"
        breadcrumb={[{ label: "消息与日志" }, { label: "错误日志" }]}
        actions={
          <Button variant="outline" size="sm" onClick={() => void fetchLogs()} disabled={loading}>
            <RefreshCcw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            刷新
          </Button>
        }
      />

      {/* 状态条 + 过滤栏融合一行，比 StatCard 三连占用屏更省 */}
      <section className="mb-4 flex flex-wrap items-center gap-3">
        <Badge tone="neutral">
          共 {counts.total} 条
        </Badge>
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "5xx" ? "" : "5xx")}
          className="contents"
        >
          <Badge tone={statusFilter === "5xx" ? "danger" : "neutral"} className="cursor-pointer">
            5xx {counts.fivexx}
          </Badge>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "4xx" ? "" : "4xx")}
          className="contents"
        >
          <Badge tone={statusFilter === "4xx" ? "warning" : "neutral"} className="cursor-pointer">
            4xx {counts.fourxx}
          </Badge>
        </button>
      </section>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜 追查号 / 消息 / 用户 / 异常类型"
                className="pl-8"
              />
            </div>
            <Input
              value={endpointFilter}
              onChange={(e) => setEndpointFilter(e.target.value)}
              placeholder="接口子串过滤 (回车提交)"
              onKeyDown={(e) => {
                if (e.key === "Enter") void fetchLogs();
              }}
              className="w-64"
            />
            <Input
              value={traceIdFilter}
              onChange={(e) => setTraceIdFilter(e.target.value)}
              placeholder="traceId 精确匹配 (回车)"
              onKeyDown={(e) => {
                if (e.key === "Enter") void fetchLogs();
              }}
              className="w-56 font-mono text-xs"
              title="拿到一条 traceId 后填这里：同一请求触发的所有错误一起列出来"
            />
            {traceIdFilter && (
              <button
                type="button"
                onClick={() => { setTraceIdFilter(""); void fetchLogs(); }}
                className="inline-flex h-8 items-center rounded-md border border-border bg-background px-2 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                title="清除 traceId 过滤"
              >
                清除 trace
              </button>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">时间</TableHead>
                <TableHead className="w-[140px]">追查号</TableHead>
                <TableHead className="w-[140px]">trace</TableHead>
                <TableHead className="w-[80px]">状态</TableHead>
                <TableHead className="w-[80px]">方法</TableHead>
                <TableHead>接口</TableHead>
                <TableHead className="w-[120px]">用户</TableHead>
                <TableHead className="w-[180px]">异常类型</TableHead>
                <TableHead>消息</TableHead>
                <TableHead className="w-[160px]">主机</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                    加载中…
                  </TableCell>
                </TableRow>
              )}
              {!loading && loadError && (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-rose-600">
                    加载失败：{loadError}
                  </TableCell>
                </TableRow>
              )}
              {!loading && !loadError && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                    暂无匹配的错误日志
                  </TableCell>
                </TableRow>
              )}
              {!loading && !loadError &&
                filtered.map((log) => (
                  <TableRow
                    key={log.id}
                    onClick={() => setSelected(log)}
                    className="cursor-pointer"
                  >
                    <TableCell className="text-xs tabular-nums">{formatDateTimeCN(log.occurredAt)}</TableCell>
                    <TableCell>
                      <code className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono tabular-nums">
                        {log.logId}
                      </code>
                    </TableCell>
                    <TableCell>
                      {log.traceId ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            // 点 trace 缩略号 = 一键过滤同 trace 全部行（无须打开详情再回头）
                            setTraceIdFilter(log.traceId!);
                            void fetchLogs();
                          }}
                          title={`点筛同 trace · ${log.traceId}`}
                          className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono tabular-nums text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                        >
                          {log.traceId.slice(0, 8)}…
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge tone={statusTone(log.httpStatus)} className="font-mono tabular-nums">
                        {log.httpStatus ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{log.httpMethod ?? "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{truncate(log.endpoint, 60)}</TableCell>
                    <TableCell className="text-xs">
                      {log.username || log.userId ? (
                        <span title={log.userId ?? undefined}>{userDisplay(log)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{log.errorType ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{truncate(log.message, 60)}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{truncate(log.hostname, 24)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ErrorLogDetailDialog
        log={selected}
        onClose={() => setSelected(null)}
        onSearchSameTrace={(traceId) => {
          setSelected(null);
          setTraceIdFilter(traceId);
          // fetchLogs 会在下一个 effect tick 因 traceIdFilter 改变而触发
        }}
      />
    </div>
  );
}

function ErrorLogDetailDialog({
  log,
  onClose,
  onSearchSameTrace,
}: {
  log: ErrorLog | null;
  onClose: () => void;
  onSearchSameTrace: (traceId: string) => void;
}) {
  return (
    <Dialog open={log !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        {log && (
          <div className="space-y-4">
            <header className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <code className="rounded bg-secondary px-2 py-0.5 text-xs font-mono">{log.logId}</code>
                  <CopyButton text={log.logId} />
                  <Badge tone={statusTone(log.httpStatus)} className="font-mono tabular-nums">
                    {log.httpStatus ?? "—"}
                  </Badge>
                </div>
                <h2 className="mt-2 text-base font-semibold leading-tight">
                  {log.errorType ?? "未知异常"}
                  {log.errorCode && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground font-mono">{log.errorCode}</span>
                  )}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{log.message ?? "（无错误消息）"}</p>
              </div>
            </header>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
              <Field label="发生时间">
                <span className="tabular-nums">{formatDateTimeCN(log.occurredAt)}</span>
              </Field>
              <Field label="发生机器">
                <code className="font-mono">{log.hostname ?? "—"}</code>
              </Field>
              <Field label="用户">
                {log.username || log.userId ? (
                  <span>
                    {log.username ?? "用户名未记录"}{" "}
                    {log.userId && <span className="text-muted-foreground">({shortUserId(log.userId)})</span>}
                  </span>
                ) : (
                  <span className="text-muted-foreground">未登录 / 未识别</span>
                )}
              </Field>
              <Field label="客户端 IP">
                <code className="font-mono">{log.clientIp ?? "—"}</code>
              </Field>
              <Field label="接口" wide>
                <code className="font-mono">
                  {log.httpMethod ?? "?"} {log.endpoint ?? "—"}
                </code>
              </Field>
              <Field label={
                <span className="inline-flex items-center gap-1">
                  trace ID
                  <span className="text-muted-foreground/70 normal-case tracking-normal">链路追踪标识，跨进程 grep 用</span>
                </span>
              } wide>
                {log.traceId ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono">{log.traceId}</code>
                    <CopyButton text={log.traceId} label="复制" />
                    <button
                      type="button"
                      onClick={() => onSearchSameTrace(log.traceId!)}
                      className="inline-flex items-center gap-1 rounded border border-violet-400/50 bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-700 hover:bg-violet-500/20 transition-colors"
                      title="筛选所有同一 traceId 的错误（用于看「同一次请求触发了几条错误」）"
                    >
                      <Search className="h-3 w-3" />
                      查同 trace 全部错误
                    </button>
                  </div>
                ) : (
                  <span className="text-muted-foreground">（无 · 旧记录或 trace filter 失效）</span>
                )}
              </Field>
              <Field label="User-Agent" wide>
                <span className="break-all text-muted-foreground">{log.userAgent ?? "—"}</span>
              </Field>
              <Field label="请求参数（已脱敏）" wide>
                <code className="block whitespace-pre-wrap break-all font-mono text-muted-foreground">
                  {log.requestParams ?? "（无）"}
                </code>
              </Field>
            </dl>

            <section>
              <div className="mb-1.5 flex items-center justify-between">
                <h3 className="text-sm font-semibold">堆栈</h3>
                {log.stacktrace && <CopyButton text={log.stacktrace} label="复制堆栈" />}
              </div>
              <pre className="max-h-80 overflow-auto rounded border bg-secondary/40 p-3 text-[11px] leading-relaxed font-mono">
                {log.stacktrace ?? "（无堆栈）"}
              </pre>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, wide, children }: { label: React.ReactNode; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "col-span-2" : "col-span-1"}>
      <dt className="mb-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // 浏览器禁了 clipboard API（http 或老内核）→ 静默失败
        }
      }}
      className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
    >
      <CopyIcon className="h-3 w-3" />
      {copied ? "已复制" : label ?? "复制"}
    </button>
  );
}
