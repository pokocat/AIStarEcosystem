"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  FileSearch,
  KeyRound,
  MessageSquareText,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AiModelsApi, AuditApi, TenantsApi, UsersApi } from "@/api";
import type { AiAppBinding, AiModelEndpoint, AiModelUsageReport, AiModelUsageStat } from "@/api/ai-models";
import type { AuditLog } from "@/types/audit";
import type { AepUser, Membership, Tenant } from "@/types/account";
import { formatDateTimeCN } from "@/lib/utils";
import {
  AiNotice,
  BreakdownList,
  EmptyPanel,
  HealthLine,
  ManagementLinkRow,
  TrendBars,
  UsageRankTable,
} from "../_components";
import {
  AI_APP_CODES,
  PURPOSE_LABEL,
  PURPOSE_PRODUCT_LABEL,
  PROVIDER_LABEL,
  USAGE_WINDOW_OPTIONS,
  compactId,
  formatRate,
  formatTokens,
  latestIso,
  sourceLabel,
  unwrapSettled,
} from "../_shared";

interface OverviewData {
  endpoints: AiModelEndpoint[];
  bindings: AiAppBinding[];
  usage: AiModelUsageReport | null;
  tenants: Tenant[];
  memberships: Membership[];
  users: AepUser[];
  auditLogs: AuditLog[];
  authLogs: AuditLog[];
}

const EMPTY_DATA: OverviewData = {
  endpoints: [],
  bindings: [],
  usage: null,
  tenants: [],
  memberships: [],
  users: [],
  auditLogs: [],
  authLogs: [],
};

function resultTone(failures: number): "default" | "warning" | "danger" | "success" {
  if (failures >= 10) return "danger";
  if (failures > 0) return "warning";
  return "success";
}

function endpointStatus(endpoint: AiModelEndpoint) {
  if (!endpoint.enabled) return { tone: "neutral" as const, label: "停用" };
  if (!endpoint.hasKey || endpoint.keyRevokedAt) return { tone: "warning" as const, label: "缺 Key" };
  return { tone: "success" as const, label: "可用" };
}

export default function AiOverviewPage() {
  const [data, setData] = React.useState<OverviewData>(EMPTY_DATA);
  const [days, setDays] = React.useState(30);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [
        endpointsResult,
        bindingsResult,
        usageResult,
        tenantsResult,
        membershipsResult,
        usersResult,
        auditResult,
        authResult,
      ] = await Promise.allSettled([
        AiModelsApi.list(),
        AiModelsApi.listBindings(),
        AiModelsApi.getUsage(days),
        TenantsApi.listTenants(0, 200),
        TenantsApi.listMemberships(undefined, undefined, 0, 500),
        UsersApi.listUsers(0, 300),
        AuditApi.listAuditLogs({ size: 300 }),
        AuditApi.listAuthLogs({ size: 200 }),
      ] as const);

      const nextWarnings: string[] = [];
      setData({
        endpoints: unwrapSettled(endpointsResult, [], "模型端点", nextWarnings),
        bindings: unwrapSettled(bindingsResult, [], "AI 用途绑定", nextWarnings),
        usage: unwrapSettled(usageResult, null, "用量统计", nextWarnings),
        tenants: unwrapSettled(tenantsResult, [], "租户", nextWarnings),
        memberships: unwrapSettled(membershipsResult, [], "成员关系", nextWarnings),
        users: unwrapSettled(usersResult, [], "用户", nextWarnings),
        auditLogs: unwrapSettled(auditResult, [], "审计日志", nextWarnings),
        authLogs: unwrapSettled(authResult, [], "登录日志", nextWarnings),
      });
      setWarnings(nextWarnings);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载 AI 中台失败");
    } finally {
      setLoading(false);
    }
  }, [days]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const stats = React.useMemo(() => {
    const enabledEndpoints = data.endpoints.filter((endpoint) => endpoint.enabled).length;
    const activeKeys = data.endpoints.filter((endpoint) => endpoint.hasKey && !endpoint.keyRevokedAt).length;
    const missingKey = data.endpoints.filter((endpoint) => endpoint.enabled && (!endpoint.hasKey || endpoint.keyRevokedAt)).length;
    const brokenBindings = data.bindings.filter((binding) => !binding.endpointId || binding.endpointEnabled === false).length;
    const totalCalls = (data.usage?.totalCalls ?? 0) + (data.usage?.failedCalls ?? 0);
    const failedCalls = data.usage?.failedCalls ?? 0;
    const ownerCount = new Set(data.endpoints.map((endpoint) => endpoint.ownerUserId).filter(Boolean)).size;
    const activeUsers = data.users.filter((user) => user.status === "active").length;
    const activeTenants = data.tenants.filter((tenant) => tenant.status === "active").length;
    const auditFailures = [...data.auditLogs, ...data.authLogs].filter((log) => log.result === "failure").length;

    return {
      enabledEndpoints,
      activeKeys,
      missingKey,
      brokenBindings,
      totalCalls,
      failedCalls,
      failureRate: formatRate(failedCalls, totalCalls),
      ownerCount,
      activeUsers,
      activeTenants,
      auditFailures,
    };
  }, [data]);

  const topModels = React.useMemo(() => [...(data.usage?.byModel ?? [])].sort((a, b) => b.totalTokens - a.totalTokens), [data.usage]);
  const topPurposes = React.useMemo(() => [...(data.usage?.byPurpose ?? [])].sort((a, b) => b.totalTokens - a.totalTokens), [data.usage]);
  const endpointRows = React.useMemo(() => [...data.endpoints].sort((a, b) => b.totalTokens - a.totalTokens).slice(0, 7), [data.endpoints]);
  const usageByApp = React.useMemo(() => new Map((data.usage?.byAppCode ?? []).map((row) => [row.key, row] as const)), [data.usage]);

  const appRows = React.useMemo(() => {
    return AI_APP_CODES.map((code) => {
      const audits = data.auditLogs.filter((log) => log.appCode === code);
      const auth = data.authLogs.filter((log) => log.appCode === code);
      const failures = [...audits, ...auth].filter((log) => log.result === "failure").length;
      const usage = usageByApp.get(code);
      return {
        code,
        label: sourceLabel(code),
        audits,
        auth,
        failures,
        usage,
        lastAt: latestIso([...audits, ...auth].map((log) => log.createdAt)),
      };
    });
  }, [data.auditLogs, data.authLogs, usageByApp]);

  return (
    <div className="admin-page">
      <PageHeader
        title="AI 运营台"
        description="一屏查看 LLM API、Token、用途绑定、租户用户归属和子应用审计。"
        breadcrumb={[{ label: "AI 中台" }, { label: "AI 运营台" }]}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/platform/ai-models">
                <KeyRound className="h-3.5 w-3.5" />
                管理 LLM API
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
              <RefreshCcw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              刷新
            </Button>
          </>
        }
        meta={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">统计窗口</span>
            <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
              <SelectTrigger className="h-8 w-[132px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USAGE_WINDOW_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {warnings.length > 0 && (
        <AiNotice tone="warning">
          {warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </AiNotice>
      )}

      {loadError && <AiNotice tone="danger">{loadError}</AiNotice>}

      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label={`近 ${days} 天 Token`}
          value={loading ? "…" : formatTokens(data.usage?.totalTokens)}
          icon={BarChart3}
          hint={`${formatTokens(data.usage?.totalCalls)} 次成功调用`}
        />
        <StatCard
          label="API 请求"
          value={loading ? "…" : formatTokens(stats.totalCalls)}
          icon={stats.failedCalls > 0 ? XCircle : CheckCircle2}
          hint={`失败率 ${stats.failureRate}`}
          tone={resultTone(stats.failedCalls)}
        />
        <StatCard
          label="端点 / Key"
          value={loading ? "…" : `${stats.enabledEndpoints} / ${stats.activeKeys}`}
          icon={KeyRound}
          hint={stats.missingKey > 0 ? `${stats.missingKey} 个启用端点缺 Key` : "启用端点均有可用 Key"}
          tone={stats.missingKey > 0 ? "warning" : "success"}
        />
        <StatCard
          label="租户 / 用户"
          value={loading ? "…" : `${stats.activeTenants} / ${stats.activeUsers}`}
          icon={Users}
          hint={`${data.memberships.length} 条成员关系`}
        />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Token 用量趋势</CardTitle>
                <CardDescription>来自后端 `ai_model_usage_record` 的真实按天聚合。</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/ai/usage">
                  查看分析
                  <BarChart3 className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <TrendBars data={data.usage?.byDay ?? []} emptyText="暂无 AI 调用趋势。" />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>按模型占比</CardTitle>
                <CardDescription>观察模型成本和调用集中点。</CardDescription>
              </CardHeader>
              <CardContent>
                <BreakdownList rows={topModels} total={data.usage?.totalTokens ?? 0} emptyText="暂无模型用量。" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>按用途占比</CardTitle>
                <CardDescription>看 AI 能力集中在哪条业务链路。</CardDescription>
              </CardHeader>
              <CardContent>
                <BreakdownList
                  rows={topPurposes}
                  total={data.usage?.totalTokens ?? 0}
                  labelFor={(row) => PURPOSE_LABEL[row.key as keyof typeof PURPOSE_LABEL] ?? row.label}
                  secondaryFor={(row) => PURPOSE_PRODUCT_LABEL[row.key as keyof typeof PURPOSE_PRODUCT_LABEL]}
                  emptyText="暂无用途用量。"
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>管理入口</CardTitle>
              <CardDescription>保留原数据和路由，把高频入口收进 AI 专区。</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <nav className="divide-y divide-border">
                <ManagementLinkRow
                  href="/platform/ai-models"
                  icon={KeyRound}
                  label="LLM API 与 Token"
                  detail="端点、上游密钥、网关 Key、用途绑定"
                  metric={`${data.endpoints.length} 个端点`}
                />
                <ManagementLinkRow
                  href="/ai/usage"
                  icon={BarChart3}
                  label="租户 / 用户用量"
                  detail="按子应用、租户、用户、模型和用途分析"
                  metric={`${formatTokens(data.usage?.totalTokens)} Token`}
                  tone="info"
                />
                <ManagementLinkRow
                  href="/ai/audit"
                  icon={FileSearch}
                  label="子应用审计"
                  detail="操作流水、登录注册、失败码和来源应用"
                  metric={`${data.auditLogs.length + data.authLogs.length} 条`}
                  tone={stats.auditFailures > 0 ? "warning" : "success"}
                />
                <ManagementLinkRow
                  href="/platform/prompts"
                  icon={MessageSquareText}
                  label="Prompt 模板"
                  detail="平台级提示词、试运行、参数和启用状态"
                  metric="配置"
                  tone="neutral"
                />
                <ManagementLinkRow
                  href="/platform/agent-bots"
                  icon={Bot}
                  label="Agent 平台"
                  detail="Bot 场景、调用 token 和启停管理"
                  metric="接入"
                  tone="neutral"
                />
              </nav>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>配置健康</CardTitle>
              <CardDescription>影响所有子应用 AI 能力可用性的当前状态。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <HealthLine
                label="网关 Key"
                value={`${stats.activeKeys} / ${data.endpoints.length}`}
                tone={stats.missingKey > 0 ? "warning" : "success"}
                detail={stats.missingKey > 0 ? `${stats.missingKey} 个启用端点缺 Key 或已撤销` : "启用端点均可通过网关调用"}
              />
              <HealthLine
                label="用途绑定"
                value={`${data.bindings.length - stats.brokenBindings} / ${data.bindings.length}`}
                tone={stats.brokenBindings > 0 ? "warning" : "success"}
                detail={stats.brokenBindings > 0 ? `${stats.brokenBindings} 个用途未绑定或绑定停用端点` : "已声明用途均有可用端点"}
              />
              <HealthLine
                label="调用失败"
                value={formatTokens(stats.failedCalls)}
                tone={stats.failedCalls > 0 ? "danger" : "success"}
                detail={stats.failedCalls > 0 ? "优先检查端点连通性、上游额度和用途绑定" : "近 30 天没有网关失败调用"}
              />
              <HealthLine
                label="审计失败"
                value={formatTokens(stats.auditFailures)}
                tone={stats.auditFailures > 0 ? "warning" : "success"}
                detail={stats.auditFailures > 0 ? "查看子应用审计页定位来源应用与失败码" : "最近样本内没有失败审计或登录事件"}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-5">
        <CardHeader className="flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>租户与用户</CardTitle>
            <CardDescription>按真实 usage record 归属聚合。历史空值会落入未归属分组。</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/ai/usage">
              查看完整排行
              <BarChart3 className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tenant">
            <TabsList>
              <TabsTrigger value="tenant">租户</TabsTrigger>
              <TabsTrigger value="user">用户</TabsTrigger>
            </TabsList>
            <TabsContent value="tenant" className="overflow-x-auto">
              <UsageRankTable
                rows={(data.usage?.byTenant ?? []).slice(0, 8)}
                total={data.usage?.totalTokens ?? 0}
                nameLabel="租户"
                emptyText="暂无租户归属用量。"
              />
            </TabsContent>
            <TabsContent value="user" className="overflow-x-auto">
              <UsageRankTable
                rows={(data.usage?.byUser ?? []).slice(0, 8)}
                total={data.usage?.totalTokens ?? 0}
                nameLabel="用户"
                emptyText="暂无用户归属用量。"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="mt-5 space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>API Key 与端点</CardTitle>
            <CardDescription>沿用现有模型端点数据，突出 Key 状态、归属和最近用量。</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {endpointRows.length === 0 ? (
              <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                <EmptyPanel text="尚未配置模型端点。" />
              </div>
            ) : (
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>端点</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>模型</TableHead>
                    <TableHead className="text-right">Token</TableHead>
                    <TableHead className="text-right">调用</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">管理</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endpointRows.map((endpoint) => {
                    const status = endpointStatus(endpoint);
                    return (
                      <TableRow key={endpoint.id}>
                        <TableCell>
                          <div className="font-medium">{endpoint.name}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{endpoint.id}</div>
                        </TableCell>
                        <TableCell>
                          {endpoint.keyRevokedAt ? (
                            <Badge tone="danger">已撤销</Badge>
                          ) : endpoint.hasKey ? (
                            <div>
                              <div className="font-mono text-xs">{endpoint.keyMasked}</div>
                              <div className="text-xs text-muted-foreground">归属 {compactId(endpoint.ownerUserId)}</div>
                            </div>
                          ) : (
                            <Badge tone="warning">未生成</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>{endpoint.model ?? "未设置模型"}</div>
                          <div className="text-xs text-muted-foreground">{PROVIDER_LABEL[endpoint.providerType]}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">{formatTokens(endpoint.totalTokens)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">{formatTokens(endpoint.totalCalls)}</TableCell>
                        <TableCell>
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link href="/platform/ai-models">配置</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>子应用治理</CardTitle>
            <CardDescription>把来源应用的用量、审计和登录事件放在同一张表里看。</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>来源</TableHead>
                  <TableHead className="text-right">Token</TableHead>
                  <TableHead className="text-right">审计</TableHead>
                  <TableHead className="text-right">登录</TableHead>
                  <TableHead className="text-right">失败</TableHead>
                  <TableHead>最近事件</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appRows.map((row) => (
                  <TableRow key={row.code}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">{row.code}</Badge>
                        <span className="font-medium">{row.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{formatTokens(row.usage?.totalTokens)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{row.audits.length.toLocaleString("zh-CN")}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{row.auth.length.toLocaleString("zh-CN")}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      <Badge tone={row.failures > 0 ? "warning" : "success"}>{row.failures}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTimeCN(row.lastAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
