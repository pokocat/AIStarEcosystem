"use client";

// ─────────────────────────────────────────────────────────────────────────────
// /platform/auth-logs — 账号登录注册日志（v0.47）。
// 数据源：AuditLog（aep_audit_logs 表）筛选所有 action ∈ AuditService.Actions.AUTH_ALL。
// 字段：时间 / 动作 / 账号 / IP / 结果 / 错因 / 设备指纹（UA 截断）。
// 点行展开详情（含完整 UA + detail）。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import {
  ShieldCheck,
  Search,
  RefreshCcw,
  Copy as CopyIcon,
  CheckCircle2,
  XCircle,
  LogIn,
  UserPlus,
  KeyRound,
  Smartphone,
  Code as CodeIcon,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuditApi } from "@/api";
import type { AuditLog, AuditResult } from "@/types/audit";
import { AUTH_ACTION_LABEL, AUTH_ACTION_KEYS, APP_CODE_KEYS, appCodeLabel } from "@/types/audit";
import { formatDateTimeCN } from "@/lib/utils";

const ACTION_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  "admin.login": ShieldCheck,
  "admin.operator_login": ShieldCheck,
  "admin.change_password": KeyRound,
  "auth.sms.request_code": Smartphone,
  "auth.sms.login": Smartphone,
  "auth.sms.register": UserPlus,
  "auth.password.login": LogIn,
  "auth.dev_login": CodeIcon,
  "auth.license.activate": UserPlus,
};

function actionLabel(action: string): string {
  return AUTH_ACTION_LABEL[action] ?? action;
}

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return "—";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function maskPhone(phoneOrUsername: string | null | undefined): string {
  if (!phoneOrUsername) return "—";
  // 11 位纯数字视为手机号，中间脱敏
  if (/^1\d{10}$/.test(phoneOrUsername)) {
    return phoneOrUsername.slice(0, 3) + "****" + phoneOrUsername.slice(7);
  }
  return phoneOrUsername;
}

export default function AuthLogsPage() {
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<AuditLog | null>(null);

  // 过滤条件
  const [query, setQuery] = React.useState("");
  const [actionFilter, setActionFilter] = React.useState<string>("");
  const [resultFilter, setResultFilter] = React.useState<AuditResult | "">("");
  const [usernameFilter, setUsernameFilter] = React.useState("");
  const [ipFilter, setIpFilter] = React.useState("");
  const [appCodeFilter, setAppCodeFilter] = React.useState<string>("");

  const fetchLogs = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await AuditApi.listAuthLogs({
        actions: actionFilter ? [actionFilter] : undefined,
        result: resultFilter || undefined,
        username: usernameFilter.trim() || undefined,
        ipAddress: ipFilter.trim() || undefined,
        appCode: appCodeFilter || undefined,
        size: 100,
      });
      setLogs(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载账号登录日志失败");
    } finally {
      setLoading(false);
    }
  }, [actionFilter, resultFilter, usernameFilter, ipFilter, appCodeFilter]);

  React.useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const filtered = React.useMemo(() => {
    return logs.filter((log) => {
      if (query) {
        const q = query.toLowerCase();
        const hay = [
          log.username,
          log.userId,
          log.action,
          log.appCode,
          appCodeLabel(log.appCode),
          log.errorCode,
          log.detail,
          log.ipAddress,
          log.userAgent,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, query]);

  const counts = React.useMemo(() => {
    const total = logs.length;
    const success = logs.filter((l) => l.result === "success").length;
    const failure = logs.filter((l) => l.result === "failure").length;
    const uniqueIps = new Set(logs.map((l) => l.ipAddress).filter(Boolean)).size;
    return { total, success, failure, uniqueIps };
  }, [logs]);

  return (
    <div className="admin-page">
      <PageHeader
        title="账号登录日志"
        description="管理员 / 运营 / 创作者用户的登录 + 注册 + 改密事件全量记录（含 IP / 设备 / 错因）。"
        breadcrumb={[{ label: "消息与日志" }, { label: "账号登录日志" }]}
        actions={
          <Button variant="outline" size="sm" onClick={() => void fetchLogs()} disabled={loading}>
            <RefreshCcw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            刷新
          </Button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard label="事件总数" value={counts.total} icon={ShieldCheck} tone="default" />
        <StatCard label="成功" value={counts.success} icon={CheckCircle2} tone="success" />
        <StatCard
          label="失败"
          value={counts.failure}
          icon={XCircle}
          tone={counts.failure ? "warning" : "default"}
        />
        <StatCard label="独立 IP" value={counts.uniqueIps} icon={Smartphone} tone="default" />
      </section>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜 账号 / IP / 错因 / detail"
                className="pl-8"
              />
            </div>

            <Select value={actionFilter || "_all"} onValueChange={(v) => setActionFilter(v === "_all" ? "" : v)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="全部动作" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">全部动作</SelectItem>
                {AUTH_ACTION_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {AUTH_ACTION_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={resultFilter || "_all"}
              onValueChange={(v) => setResultFilter(v === "_all" ? "" : (v as AuditResult))}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="全部结果" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">全部结果</SelectItem>
                <SelectItem value="success">成功</SelectItem>
                <SelectItem value="failure">失败</SelectItem>
              </SelectContent>
            </Select>

            <Select value={appCodeFilter || "_all"} onValueChange={(v) => setAppCodeFilter(v === "_all" ? "" : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="全部来源" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">全部来源</SelectItem>
                {APP_CODE_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {appCodeLabel(k)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={usernameFilter}
              onChange={(e) => setUsernameFilter(e.target.value)}
              placeholder="账号前缀 (回车提交)"
              onKeyDown={(e) => {
                if (e.key === "Enter") void fetchLogs();
              }}
              className="w-44"
            />
            <Input
              value={ipFilter}
              onChange={(e) => setIpFilter(e.target.value)}
              placeholder="IP 前缀 (回车提交)"
              onKeyDown={(e) => {
                if (e.key === "Enter") void fetchLogs();
              }}
              className="w-40 font-mono text-xs"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">时间</TableHead>
                <TableHead className="w-[160px]">动作</TableHead>
                <TableHead className="w-[140px]">来源应用</TableHead>
                <TableHead className="w-[160px]">账号</TableHead>
                <TableHead className="w-[140px]">IP</TableHead>
                <TableHead className="w-[80px]">结果</TableHead>
                <TableHead className="w-[200px]">错因</TableHead>
                <TableHead>详情</TableHead>
                <TableHead className="w-[200px]">设备</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    加载中…
                  </TableCell>
                </TableRow>
              )}
              {!loading && loadError && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-rose-600">
                    加载失败：{loadError}
                  </TableCell>
                </TableRow>
              )}
              {!loading && !loadError && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    暂无匹配的登录日志
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                !loadError &&
                filtered.map((log) => {
                  const Icon = ACTION_ICON[log.action] ?? ShieldCheck;
                  return (
                    <TableRow
                      key={log.id}
                      onClick={() => setSelected(log)}
                      className="cursor-pointer"
                    >
                      <TableCell className="text-xs tabular-nums">{formatDateTimeCN(log.createdAt)}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          {actionLabel(log.action)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.appCode ? (
                          <Badge tone="neutral">{appCodeLabel(log.appCode)}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{maskPhone(log.username)}</span>
                          {log.userId && (
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {log.userId.slice(0, 8)}…
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{log.ipAddress ?? "—"}</TableCell>
                      <TableCell>
                        <Badge tone={log.result === "success" ? "success" : "danger"}>
                          {log.result === "success" ? "成功" : "失败"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.errorCode ? (
                          <code className="rounded bg-rose-50 px-1.5 py-0.5 font-mono text-[11px] text-rose-700">
                            {log.errorCode}
                          </code>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {truncate(log.detail, 60)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {truncate(log.userAgent, 30)}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AuthLogDetailDialog log={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function AuthLogDetailDialog({ log, onClose }: { log: AuditLog | null; onClose: () => void }) {
  return (
    <Dialog open={log !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        {log && (
          <div className="space-y-4">
            <header className="flex items-start gap-3">
              <ShieldCheck
                className={
                  "mt-0.5 h-5 w-5 shrink-0 " +
                  (log.result === "success" ? "text-emerald-500" : "text-rose-500")
                }
              />
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold leading-tight">
                  {AUTH_ACTION_LABEL[log.action] ?? log.action}
                  <span className="ml-2 text-xs font-normal text-muted-foreground font-mono">
                    {log.action}
                  </span>
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {log.detail ?? "（无 detail）"}
                </p>
              </div>
            </header>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
              <Field label="发生时间">
                <span className="tabular-nums">{formatDateTimeCN(log.createdAt)}</span>
              </Field>
              <Field label="结果">
                <Badge tone={log.result === "success" ? "success" : "danger"}>
                  {log.result === "success" ? "成功" : "失败"}
                </Badge>
              </Field>
              <Field label="来源应用">
                {log.appCode ? (
                  <span className="flex items-center gap-1.5">
                    <Badge tone="neutral">{appCodeLabel(log.appCode)}</Badge>
                    <code className="font-mono text-[11px] text-muted-foreground">{log.appCode}</code>
                  </span>
                ) : (
                  <span className="text-muted-foreground">—（未带来源标记 / 老数据）</span>
                )}
              </Field>
              <Field label="账号 (登录输入)">
                <span className="font-medium">{maskPhone(log.username)}</span>
              </Field>
              <Field label="用户 ID">
                {log.userId ? (
                  <span className="flex items-center gap-1.5">
                    <code className="font-mono">{log.userId}</code>
                    <CopyButton text={log.userId} />
                  </span>
                ) : (
                  <span className="text-muted-foreground">未识别（失败 / 注册前）</span>
                )}
              </Field>
              <Field label="客户端 IP">
                {log.ipAddress ? (
                  <span className="flex items-center gap-1.5">
                    <code className="font-mono">{log.ipAddress}</code>
                    <CopyButton text={log.ipAddress} />
                  </span>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="业务错误码">
                {log.errorCode ? (
                  <code className="rounded bg-rose-50 px-1.5 py-0.5 font-mono text-[11px] text-rose-700">
                    {log.errorCode}
                  </code>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Field>
              <Field label="User-Agent" wide>
                <span className="break-all text-muted-foreground">{log.userAgent ?? "—"}</span>
              </Field>
              <Field label="详情" wide>
                <span className="block whitespace-pre-wrap break-all text-muted-foreground">
                  {log.detail ?? "（无）"}
                </span>
              </Field>
            </dl>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
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
          // 静默失败
        }
      }}
      className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
    >
      <CopyIcon className="h-3 w-3" />
      {copied ? "已复制" : label ?? "复制"}
    </button>
  );
}
