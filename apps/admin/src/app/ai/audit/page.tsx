"use client";

import * as React from "react";
import Link from "next/link";
import {
  BadgeDollarSign,
  Boxes,
  Bot,
  Database,
  Download,
  RefreshCcw,
  Search,
  UserRound,
  Workflow,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AiModelsApi } from "@/api";
import type {
  AiModelEndpoint,
  AiModelPurpose,
  AiModelUsageRecord,
  AiModelUsageReport,
  AiModelUsageStat,
} from "@/api/ai-models";
import { formatDateTimeCN } from "@/lib/utils";
import { AiNotice, BreakdownList, EmptyPanel, TrendBars } from "../_components";
import {
  PURPOSE_LABEL,
  PURPOSE_PRODUCT_LABEL,
  USAGE_WINDOW_OPTIONS,
  compactId,
  formatRate,
  formatTokens,
  sourceLabel,
  unwrapSettled,
} from "../_shared";

const ALL = "__all__";

type QualityGap = {
  label: string;
  state: "ready" | "partial" | "missing";
  detail: string;
};

const OBSERVABILITY_CAPABILITIES: QualityGap[] = [
  { label: "分维聚合", state: "ready", detail: "子应用、用户、租户、场景、模型、端点" },
  { label: "调用明细", state: "ready", detail: "时间、归属、端点、模型、Token、状态、耗时" },
  { label: "成本估算", state: "ready", detail: "按端点当前输入/输出单价计算成本" },
  { label: "数据导出", state: "ready", detail: "汇总与明细可导出 CSV，包含 trace 字段" },
  { label: "错误可见性", state: "ready", detail: "success、errorCode、errorMessage 已进入流水" },
  { label: "Trace 追踪", state: "partial", detail: "已接 requestId / upstreamId，缺 spanId 和业务对象 ID" },
  { label: "延迟观测", state: "partial", detail: "已接总耗时，缺首 token、队列耗时、重试次数" },
  { label: "成本快照", state: "partial", detail: "当前按现价估算，尚未在流水落历史单价" },
  { label: "Prompt 审计", state: "missing", detail: "缺 prompt 摘要、模板版本、变量快照" },
  { label: "质量闭环", state: "missing", detail: "缺反馈、重试率、命中率、人工标注" },
  { label: "预算治理", state: "missing", detail: "缺子应用配额、用户限额、告警和熔断" },
  { label: "异常检测", state: "missing", detail: "缺突增、失败率、成本异常的自动检测" },
];

function purposeLabel(row: AiModelUsageStat): string {
  return PURPOSE_LABEL[row.key as AiModelPurpose] ?? row.label ?? row.key;
}

function purposeSecondary(row: AiModelUsageStat): string {
  return PURPOSE_PRODUCT_LABEL[row.key as AiModelPurpose] ?? row.key;
}

function appLabel(row: AiModelUsageStat): string {
  return sourceLabel(row.key) || row.label || row.key;
}

function costLabel(micros: number | null | undefined): string {
  const value = (micros ?? 0) / 1_000_000;
  if (value <= 0) return "¥0";
  return `¥${value.toFixed(6).replace(/\.?0+$/, "")}`;
}

function latencyLabel(ms: number | null | undefined): string {
  const value = ms ?? 0;
  if (value <= 0) return "未记录";
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)} s`;
}

function rowCost(records: AiModelUsageRecord[]): number {
  return records.reduce((sum, row) => sum + (row.estimatedCostMicros ?? 0), 0);
}

function filterStats(rows: AiModelUsageStat[], query: string): AiModelUsageStat[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => [row.key, row.label].join(" ").toLowerCase().includes(q));
}

export default function AiAuditPage() {
  const [usage, setUsage] = React.useState<AiModelUsageReport | null>(null);
  const [records, setRecords] = React.useState<AiModelUsageRecord[]>([]);
  const [endpoints, setEndpoints] = React.useState<AiModelEndpoint[]>([]);
  const [days, setDays] = React.useState(30);
  const [query, setQuery] = React.useState("");
  const [appCode, setAppCode] = React.useState<string>(ALL);
  const [purpose, setPurpose] = React.useState<string>(ALL);
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [usageResult, recordsResult, endpointResult] = await Promise.allSettled([
        AiModelsApi.getUsage(days),
        AiModelsApi.getUsageRecords({
          days,
          size: 400,
          q: query.trim() || undefined,
          appCode: appCode === ALL ? undefined : appCode,
          purpose: purpose === ALL ? undefined : (purpose as AiModelPurpose),
          userId: selectedUserId ?? undefined,
        }),
        AiModelsApi.list(),
      ] as const);
      const nextWarnings: string[] = [];
      if (usageResult.status === "fulfilled") {
        setUsage(usageResult.value);
      } else {
        nextWarnings.push(`用量聚合加载失败：${usageResult.reason instanceof Error ? usageResult.reason.message : "未知错误"}`);
        setUsage(null);
      }
      setRecords(unwrapSettled(recordsResult, [], "调用明细", nextWarnings));
      setEndpoints(unwrapSettled(endpointResult, [], "模型端点", nextWarnings));
      setWarnings(nextWarnings);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载 LLM 审计数据失败");
    } finally {
      setLoading(false);
    }
  }, [appCode, days, purpose, query, selectedUserId]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const appRows = React.useMemo(() => filterStats(usage?.byAppCode ?? [], query), [query, usage]);
  const userRows = React.useMemo(() => filterStats(usage?.byUser ?? [], query), [query, usage]);
  const selectedUser = React.useMemo(
    () => (selectedUserId ? userRows.find((row) => row.key === selectedUserId) : null),
    [selectedUserId, userRows],
  );
  const pricedEndpoints = React.useMemo(
    () => endpoints.filter((endpoint) => endpoint.promptTokenPriceMicros > 0 || endpoint.completionTokenPriceMicros > 0),
    [endpoints],
  );
  const loadedCost = React.useMemo(() => rowCost(records), [records]);
  const failedInRecords = React.useMemo(() => records.filter((record) => !record.success).length, [records]);
  const averageLatency = React.useMemo(() => {
    const values = records
      .map((record) => record.latencyMs)
      .filter((value): value is number => typeof value === "number" && value > 0);
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [records]);

  return (
    <div className="admin-page space-y-5">
      <PageHeader
        title="LLM 审计与用量"
        description="按子应用、用户、场景和调用流水审计模型使用。"
        breadcrumb={[{ label: "AI 中台", href: "/ai/overview" }, { label: "LLM 审计" }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/platform/ai-models">模型配置</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => usage && exportAuditCsv(usage, records)} disabled={!usage || usage.totalCalls === 0}>
              <Download className="h-3.5 w-3.5" />
              导出
            </Button>
            <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
              <RefreshCcw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              刷新
            </Button>
          </div>
        }
        meta={
          <div className="grid w-full grid-cols-1 gap-2 md:grid-cols-[132px_150px_180px_minmax(220px,1fr)]">
            <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
              <SelectTrigger className="h-9">
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
            <Select value={appCode} onValueChange={setAppCode}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="子应用" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部子应用</SelectItem>
                {(usage?.byAppCode ?? []).map((row) => (
                  <SelectItem key={row.key} value={row.key}>
                    {appLabel(row)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={purpose} onValueChange={setPurpose}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="场景" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部场景</SelectItem>
                {(usage?.byPurpose ?? []).map((row) => (
                  <SelectItem key={row.key} value={row.key}>
                    {purposeLabel(row)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-8"
                placeholder="搜索用户 / 模型 / 端点 / 追踪号 / 错误码"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
        }
      />

      {warnings.length > 0 && (
        <AiNotice>
          {warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </AiNotice>
      )}
      {loadError && <AiNotice tone="danger">{loadError}</AiNotice>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="总 Token" value={loading || !usage ? "…" : formatTokens(usage.totalTokens)} icon={Database} />
        <StatCard label="调用次数" value={loading || !usage ? "…" : formatTokens(usage.totalCalls)} icon={Bot} />
        <StatCard label="子应用" value={loading || !usage ? "…" : usage.byAppCode.length} icon={Boxes} />
        <StatCard label="用户" value={loading || !usage ? "…" : usage.byUser.length} icon={UserRound} />
        <StatCard
          label="平均耗时"
          value={loading ? "…" : latencyLabel(averageLatency)}
          icon={Workflow}
          hint="按已记录明细计算"
          tone={failedInRecords > 0 ? "warning" : "default"}
        />
        <StatCard
          label="明细估算成本"
          value={loading ? "…" : costLabel(loadedCost)}
          icon={BadgeDollarSign}
          hint={`${records.length} 条已载入`}
          tone={failedInRecords > 0 ? "warning" : "default"}
        />
      </section>

      <div className="space-y-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>用量趋势</CardTitle>
            <CardDescription>按自然日聚合成功调用，点位标签显示 Token。</CardDescription>
          </CardHeader>
          <CardContent>
            {usage ? <TrendBars data={usage.byDay} emptyText="当前窗口暂无调用趋势。" /> : <EmptyPanel text="暂无趋势数据。" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>观测能力矩阵</CardTitle>
            <CardDescription>按真实模型调用平台应具备的能力对齐当前数据结构。</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {OBSERVABILITY_CAPABILITIES.map((gap) => (
              <div key={gap.label} className="flex items-start justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{gap.label}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{gap.detail}</div>
                </div>
                <Badge tone={gap.state === "ready" ? "success" : gap.state === "partial" ? "warning" : "neutral"} className="shrink-0 font-normal">
                  {gap.state === "ready" ? "已接入" : gap.state === "partial" ? "需补字段" : "待建设"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>分子应用聚合</CardTitle>
            <CardDescription>点击行后筛选调用明细。</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <AggregationTable
              rows={appRows}
              total={usage?.totalTokens ?? 0}
              nameLabel="子应用"
              labelFor={appLabel}
              secondaryFor={(row) => row.key}
              emptyText="暂无子应用用量。"
              activeKey={appCode === ALL ? null : appCode}
              onSelect={(row) => setAppCode(row.key)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>分用户聚合</CardTitle>
                <CardDescription>点击用户后查看该用户明细。</CardDescription>
              </div>
              {selectedUserId && (
                <Button variant="outline" size="sm" onClick={() => setSelectedUserId(null)}>
                  清除用户
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <AggregationTable
              rows={userRows}
              total={usage?.totalTokens ?? 0}
              nameLabel="用户"
              labelFor={(row) => row.label}
              secondaryFor={(row) => (row.key === "unassigned" ? "未归属" : compactId(row.key))}
              emptyText="暂无用户用量。"
              activeKey={selectedUserId}
              onSelect={(row) => setSelectedUserId(row.key === "unassigned" ? null : row.key)}
            />
          </CardContent>
        </Card>
      </div>

      {selectedUser && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{selectedUser.label} 的用量明细</CardTitle>
            <CardDescription>
              {formatTokens(selectedUser.totalTokens)} Token，{formatTokens(selectedUser.calls)} 次调用，占全量 {formatRate(selectedUser.totalTokens, usage?.totalTokens ?? 0)}。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UsageRecordsTable records={records} emptyText="该用户在当前筛选下暂无明细。" />
          </CardContent>
        </Card>
      )}

      <div className="space-y-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>调用明细</CardTitle>
            <CardDescription>最近 {records.length} 条，按创建时间倒序。</CardDescription>
          </CardHeader>
          <CardContent>
            <UsageRecordsTable records={records} emptyText="当前筛选下暂无调用明细。" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>场景与模型</CardTitle>
            <CardDescription>业务场景和端点用量分布。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <BreakdownList
              rows={usage?.byPurpose ?? []}
              total={usage?.totalTokens ?? 0}
              labelFor={purposeLabel}
              secondaryFor={purposeSecondary}
              emptyText="暂无场景用量。"
            />
            <BreakdownList rows={usage?.byModel ?? []} total={usage?.totalTokens ?? 0} emptyText="暂无模型用量。" />
            <div className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">已配置计价端点</span>
                <span className="font-medium tabular-nums">{pricedEndpoints.length} / {endpoints.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AggregationTable({
  rows,
  total,
  nameLabel,
  labelFor,
  secondaryFor,
  emptyText,
  activeKey,
  onSelect,
}: {
  rows: AiModelUsageStat[];
  total: number;
  nameLabel: string;
  labelFor: (row: AiModelUsageStat) => string;
  secondaryFor: (row: AiModelUsageStat) => string;
  emptyText: string;
  activeKey?: string | null;
  onSelect?: (row: AiModelUsageStat) => void;
}) {
  if (rows.length === 0) return <EmptyPanel text={emptyText} />;
  return (
    <Table className="min-w-[860px]">
      <TableHeader>
        <TableRow>
          <TableHead>{nameLabel}</TableHead>
          <TableHead>标识</TableHead>
          <TableHead className="text-right">调用</TableHead>
          <TableHead className="text-right">总 Token</TableHead>
          <TableHead className="text-right">输入</TableHead>
          <TableHead className="text-right">输出</TableHead>
          <TableHead className="text-right">占比</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const active = activeKey === row.key;
          return (
            <TableRow
              key={row.key}
              className={onSelect ? "cursor-pointer" : undefined}
              data-state={active ? "selected" : undefined}
              onClick={() => onSelect?.(row)}
            >
              <TableCell>
                <span className="font-medium">{labelFor(row)}</span>
              </TableCell>
              <TableCell className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">{secondaryFor(row)}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{formatTokens(row.calls)}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{formatTokens(row.totalTokens)}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{formatTokens(row.promptTokens)}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{formatTokens(row.completionTokens)}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{formatRate(row.totalTokens, total)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function UsageRecordsTable({ records, emptyText }: { records: AiModelUsageRecord[]; emptyText: string }) {
  if (records.length === 0) return <EmptyPanel text={emptyText} />;
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[1960px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[148px]">时间</TableHead>
            <TableHead>追踪号</TableHead>
            <TableHead>子应用</TableHead>
            <TableHead>应用码</TableHead>
            <TableHead>用户</TableHead>
            <TableHead>租户</TableHead>
            <TableHead>场景</TableHead>
            <TableHead>用途码</TableHead>
            <TableHead>端点</TableHead>
            <TableHead>模型</TableHead>
            <TableHead className="text-right">输入 Token</TableHead>
            <TableHead className="text-right">输出 Token</TableHead>
            <TableHead className="text-right">总 Token</TableHead>
            <TableHead className="text-right">成本</TableHead>
            <TableHead className="text-right">耗时</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>错误码</TableHead>
            <TableHead>上游 ID</TableHead>
            <TableHead>错误摘要</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id}>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTimeCN(record.createdAt)}</TableCell>
              <TableCell className="max-w-[180px] truncate font-mono text-[11px] text-muted-foreground" title={record.requestId ?? record.id}>
                {record.requestId ?? record.id}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm font-medium">{record.appLabel}</TableCell>
              <TableCell className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">{record.appCode}</TableCell>
              <TableCell className="whitespace-nowrap text-sm">{record.userLabel}</TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{record.tenantLabel}</TableCell>
              <TableCell className="whitespace-nowrap text-sm">{record.purposeLabel}</TableCell>
              <TableCell className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">{record.purpose ?? "GENERAL"}</TableCell>
              <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground" title={record.providerName ?? record.providerId ?? undefined}>
                {record.providerName ?? record.providerId ?? "未记录端点"}
              </TableCell>
              <TableCell className="max-w-[220px] truncate text-sm font-medium" title={record.model ?? undefined}>
                {record.model ?? "未记录模型"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{formatTokens(record.promptTokens)}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{formatTokens(record.completionTokens)}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{formatTokens(record.totalTokens)}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{costLabel(record.estimatedCostMicros)}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{latencyLabel(record.latencyMs)}</TableCell>
              <TableCell>
                <Badge tone={record.success ? "success" : "danger"} className="font-normal">
                  {record.success ? "成功" : "失败"}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">{record.errorCode ?? "无"}</TableCell>
              <TableCell className="max-w-[180px] truncate font-mono text-[11px] text-muted-foreground" title={record.upstreamId ?? undefined}>
                {record.upstreamId ?? "未返回"}
              </TableCell>
              <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground" title={record.errorMessage ?? undefined}>
                {record.errorMessage ?? "无"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function exportAuditCsv(usage: AiModelUsageReport, records: AiModelUsageRecord[]) {
  const esc = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines: string[] = [];
  lines.push(`# LLM 审计报表，近 ${usage.windowDays} 天，自 ${usage.since}`);
  lines.push("");
  lines.push("汇总,数值");
  lines.push(`成功调用,${usage.totalCalls}`);
  lines.push(`失败调用,${usage.failedCalls}`);
  lines.push(`总 Token,${usage.totalTokens}`);
  lines.push(`输入 Token,${usage.promptTokens}`);
  lines.push(`输出 Token,${usage.completionTokens}`);
  lines.push("");

  const section = (title: string, dim: string, rows: AiModelUsageStat[], labelFor: (row: AiModelUsageStat) => string) => {
    lines.push(`# ${title}`);
    lines.push(`${dim},键,调用,总 Token,输入 Token,输出 Token`);
    for (const row of rows) {
      lines.push([labelFor(row), row.key, row.calls, row.totalTokens, row.promptTokens, row.completionTokens].map(esc).join(","));
    }
    lines.push("");
  };

  section("按子应用", "子应用", usage.byAppCode, appLabel);
  section("按用户", "用户", usage.byUser, (row) => row.label);
  section("按场景", "场景", usage.byPurpose, purposeLabel);
  section("按租户", "租户", usage.byTenant, (row) => row.label);

  lines.push("# 调用明细");
  lines.push("时间,追踪号,上游 ID,子应用,应用码,用户,租户,场景,用途码,端点,模型,输入 Token,输出 Token,总 Token,估算成本,耗时,状态,错误码,错误摘要");
  for (const record of records) {
    lines.push(
      [
        record.createdAt,
        record.requestId ?? record.id,
        record.upstreamId ?? "",
        record.appLabel,
        record.appCode,
        record.userLabel,
        record.tenantLabel,
        record.purposeLabel,
        record.purpose ?? "",
        record.providerName ?? "",
        record.model ?? "",
        record.promptTokens,
        record.completionTokens,
        record.totalTokens,
        costLabel(record.estimatedCostMicros),
        record.latencyMs ?? "",
        record.success ? "成功" : "失败",
        record.errorCode ?? "",
        record.errorMessage ?? "",
      ]
        .map(esc)
        .join(","),
    );
  }

  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `llm-audit-${usage.windowDays}d.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
