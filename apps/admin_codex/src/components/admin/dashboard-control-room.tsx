"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  Command,
  Radar,
  ScanEye,
  ShieldAlert,
  Waves,
} from "lucide-react";

import { DashboardCharts } from "@/components/admin/dashboard-charts";
import { MetricCard } from "@/components/admin/metric-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  auditLogs,
  dashboardMetrics,
  licenseBatches,
  riskRecords,
} from "@/lib/admin-data";
import type { AuditRecord, RiskRecord, TimeRange } from "@/types/admin";

const rangeSummary: Record<
  TimeRange,
  {
    label: string;
    tone: string;
    focus: string;
    signal: string;
  }
> = {
  today: {
    label: "今日值班",
    tone: "bg-[linear-gradient(135deg,rgba(6,182,212,0.16),rgba(14,165,233,0.04))]",
    focus: "适合盯住实时告警、悬挂预扣和批次激活速度。",
    signal: "近 6 小时音乐生成高峰稳定，但风险告警仍有积压。",
  },
  week: {
    label: "周度运营",
    tone: "bg-[linear-gradient(135deg,rgba(59,130,246,0.14),rgba(56,189,248,0.05))]",
    focus: "适合比较渠道拉新、套餐升级与租户消耗的周内结构变化。",
    signal: "微信登录仍是新增主力，MCN 机构贡献高活跃。",
  },
  month: {
    label: "月度复盘",
    tone: "bg-[linear-gradient(135deg,rgba(8,145,178,0.18),rgba(34,197,94,0.06))]",
    focus: "适合看 enterprise 占比、权益使用效率与结算退款率。",
    signal: "Enterprise 套餐消耗占比继续抬升，卡密渠道转化稳定。",
  },
};

export function DashboardControlRoom() {
  const [range, setRange] = useState<TimeRange>("today");
  const [selectedRisk, setSelectedRisk] = useState<RiskRecord | null>(null);
  const [expandedAudit, setExpandedAudit] = useState<string | null>(auditLogs[0]?.id ?? null);

  const metrics = useMemo(() => dashboardMetrics[range], [range]);
  const summary = rangeSummary[range];
  const riskCount = riskRecords.filter((item) => item.status === "pending").length;
  const failedActions = auditLogs.filter((item) => item.result === "failed").length;

  return (
    <div className="flex flex-col gap-6">
      <section
        className={`relative overflow-hidden rounded-[30px] border border-white/70 p-6 shadow-[0_24px_64px_rgba(15,23,42,0.08)] ${summary.tone} animate-surface-in`}
      >
        <div className="absolute inset-y-0 right-0 hidden w-[42%] bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.18),transparent_60%)] lg:block" />
        <div className="relative z-10 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-900/70">
                  {summary.label}
                </p>
                <h2 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                  平台处于可控区间，但需要优先盯住高风险登录与库存回收。
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">{summary.focus}</p>
              </div>
              <ToggleGroup
                className="rounded-2xl border border-white/80 bg-white/75 p-1 shadow-sm"
                onValueChange={(value) => {
                  if (value) {
                    setRange(value as TimeRange);
                  }
                }}
                type="single"
                value={range}
                variant="outline"
              >
                <ToggleGroupItem value="today">今日</ToggleGroupItem>
                <ToggleGroupItem value="week">本周</ToggleGroupItem>
                <ToggleGroupItem value="month">本月</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric, index) => (
                <MetricCard
                  key={`${range}-${metric.title}`}
                  className="animate-surface-in"
                  description={metric.description}
                  delta={metric.delta}
                  style={{ animationDelay: `${index * 70}ms` }}
                  title={metric.title}
                  value={metric.value}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[26px] border border-white/80 bg-white/88 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)] animate-surface-in">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-800">运行信号</p>
                  <Radar className="size-4 text-cyan-700" />
                </div>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{summary.signal}</p>
              </div>
              <div className="rounded-[26px] border border-white/80 bg-slate-950 p-5 text-slate-50 shadow-[0_18px_40px_rgba(15,23,42,0.10)] animate-surface-in">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">值班优先级</p>
                  <Command className="size-4 text-cyan-300" />
                </div>
                <div className="mt-4 grid gap-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">待处理风控</span>
                    <span className="font-mono text-lg">{riskCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">失败写操作</span>
                    <span className="font-mono text-lg">{failedActions}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">可回收库存批次</span>
                    <span className="font-mono text-lg">
                      {licenseBatches.filter((batch) => batch.remainingRate < 30).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link href="/admin/risk">
                  <ShieldAlert data-icon="inline-start" />
                  处理风控事件
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/audit">
                  <ArrowRight data-icon="inline-end" />
                  审阅最新审计
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <DashboardCharts range={range} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <Card className="border-white/70 bg-white/84 shadow-[0_18px_40px_rgba(15,23,42,0.05)] backdrop-blur animate-surface-in">
          <CardHeader className="gap-2">
            <CardTitle>事件优先级面板</CardTitle>
            <CardDescription>点击行即可查看处置建议和上下文，不用离开当前工作面。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Alert variant="warning">
              <CircleAlert className="size-4" />
              <AlertTitle>高风险异地登录仍待人工确认</AlertTitle>
              <AlertDescription>建议先核验设备指纹，再决定是否强制下线或封禁账号。</AlertDescription>
            </Alert>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>相关用户</TableHead>
                  <TableHead>事件</TableHead>
                  <TableHead>等级</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {riskRecords.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer transition-colors hover:bg-accent/60"
                    onClick={() => setSelectedRisk(item)}
                  >
                    <TableCell className="font-medium">{item.user}</TableCell>
                    <TableCell>{item.type}</TableCell>
                    <TableCell>
                      <StatusBadge kind="risk-level" value={item.level} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="risk-status" value={item.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="border-white/70 bg-white/84 shadow-[0_18px_40px_rgba(15,23,42,0.05)] backdrop-blur animate-surface-in">
            <CardHeader className="gap-2">
              <CardTitle>批次健康度</CardTitle>
              <CardDescription>把剩余库存率和批次状态直接拉到首页，方便值班快速判断是否要回收或补发。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {licenseBatches.map((batch) => (
                <div key={batch.id} className="rounded-2xl border border-border/70 bg-secondary/35 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{batch.id}</p>
                      <p className="text-sm text-muted-foreground">{batch.channel}</p>
                    </div>
                    <StatusBadge kind="license-status" value={batch.status} />
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">剩余库存率</span>
                    <span className="font-mono">{batch.remainingRate}%</span>
                  </div>
                  <Progress className="mt-2 h-2" value={batch.remainingRate} />
                  <p className="mt-3 text-xs text-muted-foreground">进度：{batch.progress}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-white/84 shadow-[0_18px_40px_rgba(15,23,42,0.05)] backdrop-blur animate-surface-in">
            <CardHeader className="gap-2">
              <CardTitle>最近写操作</CardTitle>
              <CardDescription>支持就地展开 detail，而不是把所有说明一次性堆满。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {auditLogs.map((log) => {
                const isOpen = expandedAudit === log.id;

                return (
                  <Collapsible
                    key={log.id}
                    onOpenChange={(open) => setExpandedAudit(open ? log.id : null)}
                    open={isOpen}
                  >
                    <div className="rounded-2xl border border-border/70 bg-secondary/35 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{log.action}</p>
                            <StatusBadge kind="result" value={log.result} />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{log.createdAt}</p>
                        </div>
                        <CollapsibleTrigger asChild>
                          <Button size="sm" variant="outline">
                            <ScanEye data-icon="inline-start" />
                            {isOpen ? "收起" : "展开"}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent className="mt-4">
                        <div className="rounded-2xl border border-dashed border-border bg-white/70 p-4 text-sm leading-7 text-muted-foreground">
                          {log.detail}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog onOpenChange={(open) => !open && setSelectedRisk(null)} open={!!selectedRisk}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedRisk?.type ?? "风控事件"}</DialogTitle>
            <DialogDescription>
              相关用户 {selectedRisk?.user ?? "—"} · 触发时间 {selectedRisk?.triggeredAt ?? "—"}
            </DialogDescription>
          </DialogHeader>
          {selectedRisk ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge kind="risk-level" value={selectedRisk.level} />
                <StatusBadge kind="risk-status" value={selectedRisk.status} />
              </div>
              <div className="rounded-2xl border bg-secondary/40 p-4 text-sm leading-7 text-muted-foreground">
                {selectedRisk.suggestion}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button variant="outline">
                  <Waves data-icon="inline-start" />
                  强制下线所有设备
                </Button>
                <Button>
                  <ShieldAlert data-icon="inline-start" />
                  标记为已处理
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
