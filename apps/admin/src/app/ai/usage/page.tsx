"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  KeyRound,
  RefreshCcw,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AiModelsApi } from "@/api";
import type { AiModelEndpoint, AiModelUsageReport, AiModelUsageStat } from "@/api/ai-models";
import { formatDateTimeCN } from "@/lib/utils";
import {
  AiNotice,
  BreakdownList,
  EmptyPanel,
  InlineAction,
  TrendBars,
  UsageRankTable,
} from "../_components";
import {
  PURPOSE_LABEL,
  PURPOSE_PRODUCT_LABEL,
  PROVIDER_LABEL,
  USAGE_WINDOW_OPTIONS,
  formatRate,
  formatTokens,
  unwrapSettled,
} from "../_shared";

interface UsageData {
  endpoints: AiModelEndpoint[];
  usage: AiModelUsageReport | null;
}

const EMPTY_DATA: UsageData = {
  endpoints: [],
  usage: null,
};

export default function AiUsagePage() {
  const [days, setDays] = React.useState(30);
  const [data, setData] = React.useState<UsageData>(EMPTY_DATA);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [endpointsResult, usageResult] = await Promise.allSettled([
        AiModelsApi.list(),
        AiModelsApi.getUsage(days),
      ] as const);

      const nextWarnings: string[] = [];
      setData({
        endpoints: unwrapSettled(endpointsResult, [], "模型端点", nextWarnings),
        usage: unwrapSettled(usageResult, null, "用量统计", nextWarnings),
      });
      setWarnings(nextWarnings);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载 AI 用量失败");
    } finally {
      setLoading(false);
    }
  }, [days]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const totalAttempts = (data.usage?.totalCalls ?? 0) + (data.usage?.failedCalls ?? 0);
  const unassignedEndpoints = React.useMemo(() => data.endpoints.filter((endpoint) => !endpoint.ownerUserId), [data.endpoints]);
  const topEndpoints = React.useMemo(() => [...data.endpoints].sort((a, b) => b.totalTokens - a.totalTokens), [data.endpoints]);

  return (
    <div className="admin-page">
      <PageHeader
        title="Token 用量分析"
        description="按时间、子应用、用途、模型、端点、租户和用户查看 AI 调用归属。"
        breadcrumb={[{ label: "AI 中台", href: "/ai/overview" }, { label: "Token 用量分析" }]}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/platform/ai-models">
                <KeyRound className="h-3.5 w-3.5" />
                管理 LLM API
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!data.usage || data.usage.totalCalls === 0}
              onClick={() => data.usage && exportUsageCsv(data.usage)}
            >
              <Download className="h-3.5 w-3.5" />
              导出
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

      <AiNotice tone="info">
        当前数据来自后端 `ai_model_usage_record` 真聚合。新调用写入用户、租户和来源应用；历史记录或无登录上下文的调用会归入未归属或未标记来源。
      </AiNotice>

      {warnings.length > 0 && (
        <AiNotice tone="warning">
          {warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </AiNotice>
      )}

      {loadError && <AiNotice tone="danger">{loadError}</AiNotice>}

      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={`${days} 天 Token`} value={loading ? "…" : formatTokens(data.usage?.totalTokens)} icon={BarChart3} />
        <StatCard label="成功调用" value={loading ? "…" : formatTokens(data.usage?.totalCalls)} icon={CheckCircle2} />
        <StatCard
          label="失败率"
          value={loading ? "…" : formatRate(data.usage?.failedCalls ?? 0, totalAttempts)}
          icon={AlertTriangle}
          tone={(data.usage?.failedCalls ?? 0) > 0 ? "warning" : "success"}
          hint={`${formatTokens(data.usage?.failedCalls)} 次失败`}
        />
        <StatCard
          label="归属维度"
          value={loading ? "…" : `${data.usage?.byTenant?.length ?? 0} / ${data.usage?.byUser?.length ?? 0}`}
          icon={Users}
          hint="租户 / 用户"
        />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <Card>
          <CardHeader>
            <CardTitle>按天趋势</CardTitle>
            <CardDescription>对齐自然日查看 Token 峰值和调用波动。</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendBars data={data.usage?.byDay ?? []} emptyText="当前统计窗口暂无调用趋势。" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>能力状态</CardTitle>
              <CardDescription>统计维度和数据可解释性。</CardDescription>
            </div>
            <InlineAction href="/ai/overview">回运营台</InlineAction>
          </CardHeader>
          <CardContent className="space-y-3">
            <CapabilityRow label="Token 流水" detail="按成功调用汇总，总量、输入和输出可拆" />
            <CapabilityRow label="来源应用" detail="来自 appCode，覆盖 web 子应用、小程序和 admin" />
            <CapabilityRow label="租户 / 用户" detail="新记录按 userId、tenantId 聚合，历史空值保留未归属" />
            <CapabilityRow label="端点归属" detail={`${unassignedEndpoints.length} 个平台级端点未绑定计费用户`} warning={unassignedEndpoints.length > 0} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-4">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>来源与用途</CardTitle>
            <CardDescription>把“哪个子应用在用”和“用来做什么”分开看。</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="app">
              <TabsList>
                <TabsTrigger value="app">子应用</TabsTrigger>
                <TabsTrigger value="purpose">用途</TabsTrigger>
              </TabsList>
              <TabsContent value="app">
                <BreakdownList
                  rows={data.usage?.byAppCode ?? []}
                  total={data.usage?.totalTokens ?? 0}
                  emptyText="暂无来源应用用量。"
                />
              </TabsContent>
              <TabsContent value="purpose">
                <BreakdownList
                  rows={data.usage?.byPurpose ?? []}
                  total={data.usage?.totalTokens ?? 0}
                  labelFor={(row) => PURPOSE_LABEL[row.key as keyof typeof PURPOSE_LABEL] ?? row.label}
                  secondaryFor={(row) => PURPOSE_PRODUCT_LABEL[row.key as keyof typeof PURPOSE_PRODUCT_LABEL]}
                  emptyText="暂无用途用量。"
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>模型与端点</CardTitle>
            <CardDescription>用于判断上游服务商和固定模型的集中度。</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="model">
              <TabsList>
                <TabsTrigger value="model">模型</TabsTrigger>
                <TabsTrigger value="provider">端点</TabsTrigger>
              </TabsList>
              <TabsContent value="model">
                <BreakdownList rows={data.usage?.byModel ?? []} total={data.usage?.totalTokens ?? 0} emptyText="暂无模型用量。" />
              </TabsContent>
              <TabsContent value="provider">
                <BreakdownList rows={data.usage?.byProvider ?? []} total={data.usage?.totalTokens ?? 0} emptyText="暂无端点用量。" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>租户与用户排行</CardTitle>
          <CardDescription>运营排查成本集中点时，先看租户，再下钻到用户。</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tenant">
            <TabsList>
              <TabsTrigger value="tenant">租户</TabsTrigger>
              <TabsTrigger value="user">用户</TabsTrigger>
            </TabsList>
            <TabsContent value="tenant" className="overflow-x-auto">
              <UsageRankTable
                rows={data.usage?.byTenant ?? []}
                total={data.usage?.totalTokens ?? 0}
                nameLabel="租户"
                emptyText="暂无租户数据。"
              />
            </TabsContent>
            <TabsContent value="user" className="overflow-x-auto">
              <UsageRankTable
                rows={data.usage?.byUser ?? []}
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
            <CardTitle>高用量端点</CardTitle>
            <CardDescription>使用现有模型端点数据，显示 Key 状态、归属和最近使用。</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {topEndpoints.length === 0 ? (
              <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                <EmptyPanel text="尚未配置模型端点。" />
              </div>
            ) : (
              <Table className="min-w-[920px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>端点</TableHead>
                    <TableHead>模型</TableHead>
                    <TableHead>归属</TableHead>
                    <TableHead className="text-right">累计 Token</TableHead>
                    <TableHead>最近使用</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topEndpoints.slice(0, 10).map((endpoint) => (
                    <TableRow key={endpoint.id}>
                      <TableCell>
                        <div className="font-medium">{endpoint.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{endpoint.id}</div>
                      </TableCell>
                      <TableCell>
                        <div>{endpoint.model ?? "未设置模型"}</div>
                        <div className="text-xs text-muted-foreground">{PROVIDER_LABEL[endpoint.providerType]}</div>
                      </TableCell>
                      <TableCell>
                        {endpoint.ownerUserId ? (
                          <div className="font-mono text-xs">{endpoint.ownerUserId}</div>
                        ) : (
                          <Badge tone="warning">平台级</Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{formatTokens(endpoint.totalTokens)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTimeCN(endpoint.lastUsedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>平台级端点</CardTitle>
            <CardDescription>未绑定计费归属用户，只累计 Token，不扣用户钱包。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {unassignedEndpoints.length === 0 ? (
              <EmptyPanel text="没有平台级端点。" />
            ) : (
              unassignedEndpoints.slice(0, 8).map((endpoint) => (
                <div key={endpoint.id} className="rounded-md border border-border bg-surface px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{endpoint.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {PROVIDER_LABEL[endpoint.providerType]} · {endpoint.model ?? "未设置模型"}
                      </div>
                    </div>
                    <Badge tone={endpoint.enabled ? "success" : "neutral"}>{endpoint.enabled ? "启用" : "停用"}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {formatTokens(endpoint.totalTokens)} Token · 最近使用 {formatDateTimeCN(endpoint.lastUsedAt)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CapabilityRow({
  label,
  detail,
  warning = false,
}: {
  label: string;
  detail: string;
  warning?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-surface px-3 py-2.5">
      {warning ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">{label}</div>
          <Badge tone={warning ? "warning" : "success"}>{warning ? "需关注" : "已接入"}</Badge>
        </div>
        <div className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</div>
      </div>
    </div>
  );
}

function exportUsageCsv(usage: AiModelUsageReport) {
  const esc = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines: string[] = [];
  lines.push(`# AI Token 用量报表，近 ${usage.windowDays} 天，自 ${usage.since}`);
  lines.push("");
  lines.push("汇总,数值");
  lines.push(`成功调用,${usage.totalCalls}`);
  lines.push(`失败调用,${usage.failedCalls}`);
  lines.push(`总 Token,${usage.totalTokens}`);
  lines.push(`输入 Token,${usage.promptTokens}`);
  lines.push(`输出 Token,${usage.completionTokens}`);
  lines.push("");

  const section = (title: string, dim: string, rows: AiModelUsageStat[]) => {
    lines.push(`# ${title}`);
    lines.push(`${dim},调用,总 Token,输入 Token,输出 Token`);
    for (const row of rows) {
      lines.push([row.label, row.calls, row.totalTokens, row.promptTokens, row.completionTokens].map(esc).join(","));
    }
    lines.push("");
  };
  section("按子应用", "来源应用", usage.byAppCode);
  section("按用途", "用途", usage.byPurpose);
  section("按模型", "模型", usage.byModel);
  section("按端点", "端点", usage.byProvider);
  section("按租户", "租户", usage.byTenant);
  section("按用户", "用户", usage.byUser);

  lines.push("# 按天趋势");
  lines.push("日期,调用,总 Token,输入 Token,输出 Token");
  for (const day of usage.byDay) {
    lines.push([day.date, day.calls, day.totalTokens, day.promptTokens, day.completionTokens].map(esc).join(","));
  }

  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ai-usage-${usage.windowDays}d.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
