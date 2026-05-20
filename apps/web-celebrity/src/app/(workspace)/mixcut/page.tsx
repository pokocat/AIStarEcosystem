"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Sparkles,
  Video,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/mixcut-zone/ui/card";
import { Button } from "@/components/mixcut-zone/ui/button";
import { Badge } from "@/components/mixcut-zone/ui/badge";
import { Progress } from "@/components/mixcut-zone/ui/progress";
import { TemplatePreview } from "@/components/mixcut-zone/template-preview";
import { MixcutApi } from "@/api";
import { mockHotTemplates } from "@/mocks/mixcut";
import { PROFILE_LABELS } from "@/constants/mixcut-ui";
import { cn, formatNumber, relativeTime } from "@/components/mixcut-zone/lib/utils";
import { firstScenePreviewTemplate } from "@/components/mixcut-zone/lib/scene-helpers";
import type { RenderJob } from "@/components/mixcut-zone/types";

export default function MixcutHomePage() {
  const code = MixcutApi.mockActivationCode;
  const [jobs, setJobs] = useState<RenderJob[]>([]);

  useEffect(() => {
    MixcutApi.listJobs().then(setJobs);
  }, []);

  const usedPercent = (code.quota_used_this_period / code.monthly_quota) * 100;
  const recentJobs = jobs.slice(0, 4);

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
      {/* 与 /mixcut/jobs、/mixcut/templates 对齐的 slim 头 */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">混剪工作台</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            选模板 · 填素材 · 一次生成多条差异化短视频
          </p>
        </div>
        <div className="flex items-center gap-3">
          <QuotaIndicator
            used={code.quota_used_this_period}
            total={code.monthly_quota}
            percent={usedPercent}
          />
          <Button variant="gradient" asChild>
            <Link href="/mixcut/templates">
              <Sparkles className="size-4" /> 去模板库
            </Link>
          </Button>
        </div>
      </div>

      {/* 继续上次进度 —— 最近任务 */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <div>
              <div className="text-sm font-medium">继续上次进度</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {recentJobs.length > 0 ? `最近 ${recentJobs.length} 个生成任务` : "暂无生成任务"}
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/mixcut/jobs">
                查看全部 <ArrowUpRight className="size-3" />
              </Link>
            </Button>
          </div>
          <div className="divide-y divide-border border-t border-border">
            {recentJobs.map((j) => (
              <Link
                key={j.id}
                href={`/mixcut/jobs/${j.id}`}
                className="flex items-center gap-4 px-5 py-3 hover:bg-secondary/50 transition-colors"
              >
                <div className="w-10 aspect-[9/16] rounded-md bg-gradient-to-br from-slate-700 to-slate-900 shrink-0 grid place-items-center">
                  <Video className="size-3.5 text-white/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium text-sm truncate">{j.template_name}</div>
                    <StatusBadge status={j.status} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {j.output_variants} 条 · {PROFILE_LABELS[j.perturbation_profile]} · {relativeTime(j.created_at)}
                  </div>
                  {(j.status === "running" || j.status === "queued") && (
                    <Progress
                      value={j.progress}
                      className="mt-2 h-1"
                      indicatorClassName="bg-violet-500"
                    />
                  )}
                </div>
                <ArrowUpRight className="size-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
            {recentJobs.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                还没有任务,去
                <Link href="/mixcut/templates" className="text-foreground underline mx-1">
                  模板库
                </Link>
                开始第一个吧
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 热门模板 */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">热门模板</div>
              <div className="text-xs text-muted-foreground mt-0.5">本周生产量 Top 4</div>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/mixcut/templates">
                更多模板 <ArrowUpRight className="size-3" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {mockHotTemplates.map((t) => (
              <Link
                key={t.template_id}
                href={`/mixcut/templates/${t.template_id}`}
                className="group block"
              >
                <TemplatePreview template={firstScenePreviewTemplate(t)} mode="blueprint" />
                <div className="mt-2.5">
                  <div className="text-sm font-medium truncate group-hover:underline underline-offset-2">
                    {t.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="muted" className="text-[10px]">
                      {t.metadata.category}
                    </Badge>
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

function QuotaIndicator({
  used,
  total,
  percent,
}: {
  used: number;
  total: number;
  percent: number;
}) {
  const tone = percent >= 90 ? "bg-red-500" : percent >= 70 ? "bg-amber-500" : "bg-violet-500";
  return (
    <div className="flex flex-col gap-1 min-w-[160px] px-3 py-1.5 rounded-md border border-border bg-card">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">本月配额</span>
        <span className="text-[11px] font-mono">
          {formatNumber(used)} / {formatNumber(total)}
        </span>
      </div>
      <div className="h-1 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn("h-full transition-all", tone)}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string; icon: any }> = {
    success: { variant: "success", label: "已完成", icon: CheckCircle2 },
    running: { variant: "default", label: "生成中", icon: Clock },
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
