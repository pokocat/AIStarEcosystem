"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Code as CodeIcon,
  History,
  KeyRound,
  LogIn,
  Search,
  ShieldCheck,
  Smartphone,
  UserPlus,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuditApi } from "@/api";
import type { AuditLog, AuditResult } from "@/types/audit";
import { AUTH_ACTION_LABEL } from "@/types/audit";
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

const RESOURCE_LABEL: Record<string, string> = {
  auth: "账号认证",
  admin: "管理员",
  operator: "运营账号",
  user: "用户",
  account: "账户",
  license: "激活码",
  celebrity: "明星带货",
  mixcut: "混剪模板",
  recharge: "充值",
  product: "商品",
};

function actionLabel(action: string): string {
  return AUTH_ACTION_LABEL[action] ?? action;
}

function resultTone(result: AuditResult): "success" | "danger" {
  return result === "success" ? "success" : "danger";
}

function resultLabel(result: AuditResult): string {
  return result === "success" ? "成功" : "失败";
}

function maskIdentifier(value: string | null | undefined): string {
  if (!value) return "未识别";
  if (/^1\d{10}$/.test(value)) return `${value.slice(0, 3)}****${value.slice(7)}`;
  return value;
}

function shortId(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}

function truncate(value: string | null | undefined, max: number): string {
  if (!value) return "—";
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function operatorPrimary(log: AuditLog): string {
  if (log.username) return maskIdentifier(log.username);
  if (log.userId) return `用户 ${shortId(log.userId)}`;
  return "未识别";
}

function objectPrimary(log: AuditLog): string {
  if (log.resourceType === "auth" || log.action.startsWith("auth.") || log.action.startsWith("admin.")) {
    return `账号：${maskIdentifier(log.username)}`;
  }

  const resource = log.resourceType ? (RESOURCE_LABEL[log.resourceType] ?? log.resourceType) : "业务对象";
  if (log.detail) return `${resource}：${truncate(log.detail, 72)}`;
  if (log.resourceId) return `${resource}：${log.resourceId}`;
  return resource;
}

function objectSecondary(log: AuditLog): string | null {
  const parts = [
    log.resourceType ? (RESOURCE_LABEL[log.resourceType] ?? log.resourceType) : null,
    log.resourceId ? `ID ${shortId(log.resourceId)}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export default function AuditPage() {
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [resultFilter, setResultFilter] = React.useState<AuditResult | "all">("all");

  const fetchLogs = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await AuditApi.listAuditLogs({
        result: resultFilter === "all" ? undefined : resultFilter,
        size: 200,
      });
      setLogs(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载审计日志失败");
    } finally {
      setLoading(false);
    }
  }, [resultFilter]);

  React.useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) => {
      const hay = [
        log.username,
        log.userId,
        log.action,
        actionLabel(log.action),
        objectPrimary(log),
        log.resourceType,
        log.resourceId,
        log.errorCode,
        log.ipAddress,
        log.detail,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [logs, query]);

  const counts = React.useMemo(() => {
    const success = logs.filter((l) => l.result === "success").length;
    const failure = logs.filter((l) => l.result === "failure").length;
    const operators = new Set(logs.map((l) => l.username ?? l.userId).filter(Boolean)).size;
    return { total: logs.length, success, failure, operators };
  }, [logs]);

  return (
    <div className="admin-page">
      <PageHeader
        title="审计日志"
        description="后端真实 AuditLog：记录谁、何时、从哪里、对哪个业务对象执行了什么动作。"
        breadcrumb={[{ label: "消息与日志" }, { label: "审计日志" }]}
        actions={
          <Button variant="outline" size="sm" onClick={() => void fetchLogs()} disabled={loading}>
            <Activity className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            刷新
          </Button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="记录总数" value={counts.total} icon={History} />
        <StatCard label="成功" value={counts.success} icon={CheckCircle2} tone="success" />
        <StatCard label="失败" value={counts.failure} icon={XCircle} tone={counts.failure ? "warning" : "default"} />
        <StatCard label="可识别操作员" value={counts.operators} icon={ShieldCheck} />
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle>操作流水</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-80">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索账号 / 业务对象 / IP / 错因 / 说明"
                  className="pl-8"
                />
              </div>
              {(["all", "success", "failure"] as const).map((result) => (
                <Button
                  key={result}
                  size="sm"
                  variant={resultFilter === result ? "default" : "ghost"}
                  onClick={() => setResultFilter(result)}
                >
                  {result === "all" ? "全部" : resultLabel(result)}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[170px]">时间</TableHead>
                <TableHead className="w-[180px]">动作</TableHead>
                <TableHead>对象</TableHead>
                <TableHead className="w-[200px]">操作员</TableHead>
                <TableHead className="w-[140px]">IP</TableHead>
                <TableHead className="w-[90px]">结果</TableHead>
                <TableHead>说明</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">加载中...</TableCell></TableRow>
              )}
              {!loading && loadError && (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-rose-600">加载失败：{loadError}</TableCell></TableRow>
              )}
              {!loading && !loadError && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">暂无匹配记录</TableCell>
                </TableRow>
              )}
              {!loading && !loadError && filtered.map((log) => {
                const Icon = ACTION_ICON[log.action] ?? AlertTriangle;
                const secondary = objectSecondary(log);
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs tabular-nums">{formatDateTimeCN(log.createdAt)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {actionLabel(log.action)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{objectPrimary(log)}</span>
                        {secondary && <span className="text-[11px] text-muted-foreground">{secondary}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{operatorPrimary(log)}</span>
                        {log.userId && <span className="text-[11px] font-mono text-muted-foreground">ID {shortId(log.userId)}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{log.ipAddress ?? "—"}</TableCell>
                    <TableCell><Badge tone={resultTone(log.result)}>{resultLabel(log.result)}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.errorCode ? `${log.errorCode} · ` : ""}{truncate(log.detail, 80)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
