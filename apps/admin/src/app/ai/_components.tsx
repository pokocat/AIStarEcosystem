"use client";

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AiModelUsageDaily, AiModelUsageStat } from "@/api/ai-models";
import { cn } from "@/lib/utils";
import { formatTokens } from "./_shared";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "primary";

export function AiNotice({
  tone = "warning",
  children,
}: {
  tone?: "warning" | "danger" | "info";
  children: React.ReactNode;
}) {
  const toneClass = {
    warning: "border-warning/30 bg-warning/8 text-warning-foreground",
    danger: "border-destructive/25 bg-destructive/8 text-destructive",
    info: "border-info/30 bg-info/8 text-info",
  };
  return (
    <div className={cn("mb-4 rounded-lg border px-4 py-3 text-sm leading-6", toneClass[tone])}>
      {children}
    </div>
  );
}

export function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
      <Activity className="mx-auto mb-2 h-5 w-5 opacity-60" />
      {text}
    </div>
  );
}

export function ManagementLinkRow({
  href,
  icon: Icon,
  label,
  detail,
  metric,
  tone = "primary",
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  detail: string;
  metric: string;
  tone?: Tone;
}) {
  const toneClass: Record<Tone, string> = {
    neutral: "bg-muted text-muted-foreground",
    info: "bg-info/10 text-info",
    success: "bg-success/10 text-success",
    warning: "bg-warning/12 text-warning",
    danger: "bg-destructive/10 text-destructive",
    primary: "bg-primary/10 text-primary",
  };
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-5"
    >
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", toneClass[tone])}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <span className="hidden shrink-0 text-xs font-medium text-muted-foreground sm:block">{metric}</span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

export function HealthLine({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "success" | "warning" | "danger";
}) {
  const toneMap = {
    success: { badge: "success" as const, icon: CheckCircle2, iconClass: "text-success" },
    warning: { badge: "warning" as const, icon: AlertTriangle, iconClass: "text-warning" },
    danger: { badge: "danger" as const, icon: XCircle, iconClass: "text-destructive" },
  };
  const Icon = toneMap[tone].icon;
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-surface px-3 py-2.5">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", toneMap[tone].iconClass)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">{label}</div>
          <Badge tone={toneMap[tone].badge}>{value}</Badge>
        </div>
        <div className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</div>
      </div>
    </div>
  );
}

export function TrendBars({
  data,
  emptyText = "暂无趋势数据。",
}: {
  data: AiModelUsageDaily[];
  emptyText?: string;
}) {
  if (!data || data.length === 0) return <EmptyPanel text={emptyText} />;
  const max = Math.max(...data.map((d) => d.totalTokens), 1);
  const width = Math.max(640, data.length * 72);
  const height = 240;
  const pad = { left: 44, right: 24, top: 34, bottom: 42 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const points = data.map((d, index) => {
    const x = pad.left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
    const y = pad.top + plotHeight - (d.totalTokens / max) * plotHeight;
    return { x, y, d };
  });
  const path = smoothPath(points);
  const labelEvery = data.length <= 10 ? 1 : Math.ceil(data.length / 8);
  return (
    <div className="overflow-x-auto">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">按自然日聚合，Asia/Shanghai</div>
        <div className="text-xs tabular-nums text-muted-foreground">峰值 {formatTokens(max)} Token</div>
      </div>
      <svg
        className="block min-w-full text-muted-foreground"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Token 用量趋势曲线"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const y = pad.top + plotHeight - step * plotHeight;
          return (
            <g key={step}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="stroke-border" strokeDasharray={step === 0 ? undefined : "4 6"} />
              <text x={pad.left - 10} y={y + 4} textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
                {formatTokens(Math.round(max * step))}
              </text>
            </g>
          );
        })}
        <path d={path} fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, index) => {
          const showLabel = index === 0 || index === points.length - 1 || index % labelEvery === 0;
          return (
            <g key={p.d.date}>
              <circle cx={p.x} cy={p.y} r="3.5" className="fill-surface stroke-primary" strokeWidth="2" />
              {showLabel && (
                <>
                  <text x={p.x} y={Math.max(12, p.y - 10)} textAnchor="middle" className="fill-foreground text-[10px] font-medium tabular-nums">
                    {formatTokens(p.d.totalTokens)}
                  </text>
                  <text x={p.x} y={height - 14} textAnchor="middle" className="fill-muted-foreground text-[10px] tabular-nums">
                    {shortDate(p.d.date)}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    d += ` Q ${prev.x} ${prev.y}, ${midX} ${(prev.y + curr.y) / 2}`;
    d += ` T ${curr.x} ${curr.y}`;
  }
  return d;
}

function shortDate(value: string): string {
  const parts = value.split("-");
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : value;
}

export function BreakdownList({
  rows,
  total,
  labelFor,
  secondaryFor,
  limit = 6,
  emptyText = "暂无数据。",
}: {
  rows: AiModelUsageStat[];
  total: number;
  labelFor?: (row: AiModelUsageStat) => string;
  secondaryFor?: (row: AiModelUsageStat) => string | null | undefined;
  limit?: number;
  emptyText?: string;
}) {
  const visible = rows.slice(0, limit);
  if (visible.length === 0) return <EmptyPanel text={emptyText} />;
  return (
    <div className="space-y-3">
      {visible.map((row) => {
        const pct = total > 0 ? (row.totalTokens / total) * 100 : 0;
        const width = total > 0 ? Math.max(2, pct) : 0;
        const label = labelFor ? labelFor(row) : row.label;
        const secondary = secondaryFor ? secondaryFor(row) : null;
        return (
          <div key={row.key} className="rounded-md border border-border bg-surface px-3 py-2.5">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{label}</div>
                {secondary && <div className="mt-0.5 text-xs text-muted-foreground">{secondary}</div>}
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {formatTokens(row.totalTokens)} Token
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full rounded-full bg-primary/70" style={{ width: `${width}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>{formatTokens(row.calls)} 次调用</span>
              <span>{total > 0 ? `${pct.toFixed(1)}%` : "0%"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function UsageRankTable({
  rows,
  total,
  nameLabel,
  emptyText,
  labelFor,
  secondaryFor,
}: {
  rows: AiModelUsageStat[];
  total: number;
  nameLabel: string;
  emptyText: string;
  labelFor?: (row: AiModelUsageStat) => string;
  secondaryFor?: (row: AiModelUsageStat) => string | null | undefined;
}) {
  if (rows.length === 0) return <EmptyPanel text={emptyText} />;
  return (
    <Table className="min-w-[780px]">
      <TableHeader>
        <TableRow>
          <TableHead>{nameLabel}</TableHead>
          <TableHead className="text-right">调用</TableHead>
          <TableHead className="text-right">总 Token</TableHead>
          <TableHead className="text-right">输入 Token</TableHead>
          <TableHead className="text-right">输出 Token</TableHead>
          <TableHead className="text-right">占比</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const pct = total > 0 ? (row.totalTokens / total) * 100 : 0;
          const label = labelFor ? labelFor(row) : row.label;
          const secondary = secondaryFor ? secondaryFor(row) : row.key;
          return (
            <TableRow key={row.key}>
              <TableCell>
                <div className="font-medium">{label}</div>
                {secondary && <div className="font-mono text-[10px] text-muted-foreground">{secondary}</div>}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{formatTokens(row.calls)}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{formatTokens(row.totalTokens)}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{formatTokens(row.promptTokens)}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{formatTokens(row.completionTokens)}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{pct.toFixed(1)}%</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function InlineAction({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href}>
        {children}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </Button>
  );
}
