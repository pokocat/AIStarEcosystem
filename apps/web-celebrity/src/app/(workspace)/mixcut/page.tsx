"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  TrendingUp,
  Video,
  Zap,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/mixcut-zone/ui/card";
import { Button } from "@/components/mixcut-zone/ui/button";
import { Badge } from "@/components/mixcut-zone/ui/badge";
import { Progress } from "@/components/mixcut-zone/ui/progress";
import { TemplatePreview } from "@/components/mixcut-zone/template-preview";
import { MixcutApi } from "@/api";
import { mockHotTemplates } from "@/mocks/mixcut";
import { TIER_LABELS } from "@/constants/mixcut-ui";
import { cn, formatNumber, relativeTime } from "@/components/mixcut-zone/lib/utils";
import type { RenderJob } from "@/components/mixcut-zone/types";

export default function MixcutHomePage() {
  const code = MixcutApi.mockActivationCode;
  const [jobs, setJobs] = useState<RenderJob[]>([]);

  useEffect(() => {
    MixcutApi.listJobs().then(setJobs);
  }, []);

  const quotaUsed = code.quota_used_this_period;
  const quotaTotal = code.monthly_quota;
  const quotaPercent = (quotaUsed / quotaTotal) * 100;

  const runningJobs = jobs.filter((j) => j.status === "running" || j.status === "queued");
  const successJobs = jobs.filter((j) => j.status === "success");

  const totalOutputs = successJobs.reduce((sum, j) => sum + j.output_variants, 0);
  const inProgressCount = runningJobs.length;

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
      {/* 欢迎条 */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-purple-950 to-brand-950 text-white p-6 lg:p-8">
        <div className="absolute inset-0 gradient-radial opacity-60" />
        <div className="absolute inset-0 grid-pattern opacity-10" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="brand" className="text-[10px]">{TIER_LABELS[code.tier]}</Badge>
              <span className="text-xs text-white/60">激活码 {code.code}</span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight text-balance">
              欢迎回来,今天打算量产多少条?
            </h1>
            <p className="mt-2 text-white/70 max-w-xl">
              选个模板,填进商品图,5 分钟出 10 个抗去重版本。已上线{" "}
              <span className="text-white font-medium">{mockHotTemplates.length * 22}+</span>{" "}
              个高转化模板。
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="gradient" size="lg" asChild>
                <Link href="/mixcut/templates">
                  <Sparkles className="size-4" /> 立即创建
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <Link href="/mixcut/templates">浏览模板库</Link>
              </Button>
            </div>
          </div>
          <div className="w-44 hidden lg:block">
            <TemplatePreview template={mockHotTemplates[0]} showSlotChrome={false} variantSeed={3} />
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="本月生产"
          value={formatNumber(totalOutputs)}
          unit="条"
          trend="+18.4%"
          trendUp
          icon={Video}
        />
        <KpiCard
          label="剩余配额"
          value={formatNumber(quotaTotal - quotaUsed)}
          unit={`/ ${formatNumber(quotaTotal)}`}
          progress={quotaPercent}
          icon={Zap}
          subText={`月底重置 · ${code.period_resets_at.slice(5, 10)}`}
        />
        <KpiCard
          label="进行中任务"
          value={String(inProgressCount)}
          unit="个"
          icon={Clock}
          subText={inProgressCount ? "预计 5 分钟内完成" : "暂无队列"}
        />
        <KpiCard
          label="平均 pHash 距离"
          value="11.8"
          unit="≥ 10 合格"
          trend="质量门控通过率 96%"
          icon={TrendingUp}
          trendUp
        />
      </div>

      {/* 最近任务 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>最近任务</CardTitle>
            <CardDescription>查看您最近创建的渲染任务</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/mixcut/jobs">
              全部 <ArrowUpRight className="size-3" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {jobs.slice(0, 5).map((j) => (
            <Link
              key={j.id}
              href={`/mixcut/jobs/${j.id}`}
              className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors group"
            >
              <div className="w-14 aspect-[9/16] rounded-md bg-gradient-to-br from-slate-700 to-slate-900 shrink-0 grid place-items-center">
                <Video className="size-4 text-white/40" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium text-sm truncate">{j.template_name}</div>
                  <StatusBadge status={j.status} />
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {j.output_variants} 个变体 · {j.perturbation_profile} · {relativeTime(j.created_at)}
                </div>
                {(j.status === "running" || j.status === "queued") && (
                  <Progress
                    value={j.progress}
                    className="mt-2 h-1"
                    indicatorClassName="bg-gradient-to-r from-brand-500 to-fuchsia-500"
                  />
                )}
              </div>
              <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-foreground shrink-0" />
            </Link>
          ))}
          {jobs.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              还没有任务,去
              <Link href="/mixcut/templates" className="text-foreground underline mx-1">
                模板库
              </Link>
              创建第一个吧
            </div>
          )}
        </CardContent>
      </Card>

      {/* 热门模板 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>热门模板</CardTitle>
            <CardDescription>本周生产量 Top 4</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/mixcut/templates">
              更多模板 <ArrowUpRight className="size-3" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {mockHotTemplates.map((t) => (
              <Link
                key={t.template_id}
                href={`/mixcut/templates/${t.template_id}`}
                className="group block"
              >
                <div className="relative">
                  <TemplatePreview template={t} showSlotChrome={false} />
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity grid place-items-end p-3">
                    <Button variant="gradient" size="sm" className="w-full">
                      使用模板
                    </Button>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-sm font-medium truncate">{t.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="muted" className="text-[10px]">{t.metadata.category}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      日产 {formatNumber(t.metadata.daily_creation_count ?? 0)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  unit,
  trend,
  trendUp,
  icon: Icon,
  progress,
  subText,
}: {
  label: string;
  value: string;
  unit?: string;
  trend?: string;
  trendUp?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  progress?: number;
  subText?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <div className="size-8 rounded-lg bg-secondary grid place-items-center">
            <Icon className="size-4 text-muted-foreground" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tracking-tight">{value}</span>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
        {progress != null && (
          <Progress
            value={progress}
            className="mt-3 h-1.5"
            indicatorClassName="bg-gradient-to-r from-brand-500 to-fuchsia-500"
          />
        )}
        {trend && (
          <div className={cn("mt-2 text-xs flex items-center gap-1", trendUp ? "text-emerald-500" : "text-muted-foreground")}>
            {trendUp && <TrendingUp className="size-3" />}
            {trend}
          </div>
        )}
        {subText && <div className="mt-2 text-xs text-muted-foreground">{subText}</div>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string; icon: any }> = {
    success: { variant: "success", label: "已完成", icon: CheckCircle2 },
    running: { variant: "default", label: "渲染中", icon: Clock },
    queued: { variant: "muted", label: "排队中", icon: Clock },
    failed: { variant: "danger", label: "失败", icon: AlertCircle },
    pending: { variant: "muted", label: "待处理", icon: Clock },
    partial: { variant: "warning", label: "部分完成", icon: AlertCircle },
  };
  const info = map[status] || map.pending;
  const Icon = info.icon;
  return (
    <Badge variant={info.variant} className="gap-1 text-[10px]">
      <Icon className="size-2.5" />
      {info.label}
    </Badge>
  );
}
