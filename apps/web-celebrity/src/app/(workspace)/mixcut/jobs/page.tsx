"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Video,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  RefreshCw,
  Trash2,
  PlayCircle,
  Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/mixcut-zone/ui/card";
import { Button } from "@/components/mixcut-zone/ui/button";
import { Badge } from "@/components/mixcut-zone/ui/badge";
import { Input } from "@/components/mixcut-zone/ui/input";
import { Progress } from "@/components/mixcut-zone/ui/progress";
import { MixcutApi } from "@/api";
import type { JobStatus, RenderJob } from "@/components/mixcut-zone/types";
import { PROFILE_LABELS } from "@/constants/mixcut-ui";
import { cn, relativeTime } from "@/components/mixcut-zone/lib/utils";

const STATUS_FILTERS: { value: "all" | JobStatus; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "running", label: "渲染中" },
  { value: "queued", label: "排队中" },
  { value: "success", label: "已完成" },
  { value: "failed", label: "失败" },
];

export default function MixcutJobsPage() {
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [filter, setFilter] = useState<"all" | JobStatus>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    MixcutApi.listJobs().then(setJobs);
  }, []);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (filter !== "all" && j.status !== filter) return false;
      if (search && !j.template_name?.includes(search) && !j.id.includes(search)) return false;
      return true;
    });
  }, [jobs, filter, search]);

  const counts = {
    all: jobs.length,
    running: jobs.filter((j) => j.status === "running").length,
    queued: jobs.filter((j) => j.status === "queued").length,
    success: jobs.filter((j) => j.status === "success").length,
    failed: jobs.filter((j) => j.status === "failed").length,
  };

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">渲染任务</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理您的渲染历史 · 查看进度 · 下载产出 · 一键重渲
          </p>
        </div>
        <Button variant="gradient" asChild>
          <Link href="/mixcut/templates">+ 新建任务</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索任务 / 模板名…"
                className="pl-9"
              />
            </div>
            <Button variant="outline">
              <Filter className="size-4" />
              筛选
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value as any)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs transition-colors border flex items-center gap-1.5",
                  filter === f.value
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground"
                )}
              >
                {f.label}
                <span className="text-[10px] opacity-60">({counts[f.value as keyof typeof counts] ?? 0})</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-muted-foreground text-sm">
                {jobs.length === 0 ? "还没有任务,去创建第一个吧" : "没有匹配筛选的任务"}
              </div>
            </CardContent>
          </Card>
        ) : (
          filtered.map((j) => <JobRow key={j.id} job={j} />)
        )}
      </div>
    </div>
  );
}

function JobRow({ job }: { job: RenderJob }) {
  return (
    <Card className="overflow-hidden hover:border-foreground/30 transition-colors">
      <Link href={`/mixcut/jobs/${job.id}`} className="block">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-16 aspect-[9/16] rounded-md bg-gradient-to-br from-slate-700 to-slate-900 shrink-0 grid place-items-center relative overflow-hidden">
              <Video className="size-5 text-white/40" />
              {job.status === "success" && (
                <div className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                  <PlayCircle className="size-5 text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-medium truncate">{job.template_name}</div>
                <StatusBadge status={job.status} />
                <Badge variant="muted" className="text-[10px]">{PROFILE_LABELS[job.perturbation_profile]}</Badge>
              </div>

              <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <span className="font-mono">{job.id.slice(0, 12)}…</span>
                <span>·</span>
                <span>{job.output_variants} 个变体</span>
                <span>·</span>
                <span>{relativeTime(job.created_at)}</span>
                {job.completed_at && (
                  <>
                    <span>·</span>
                    <span>耗时 {Math.round((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000)}s</span>
                  </>
                )}
              </div>

              {(job.status === "running" || job.status === "queued") && (
                <div className="mt-2 flex items-center gap-2">
                  <Progress
                    value={job.progress}
                    className="h-1.5 flex-1"
                    indicatorClassName="bg-gradient-to-r from-brand-500 to-fuchsia-500"
                  />
                  <span className="text-xs font-mono text-muted-foreground w-10 text-right">{job.progress}%</span>
                </div>
              )}

              {job.status === "failed" && job.error_message && (
                <div className="mt-2 text-xs text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="size-3" />
                  {job.error_message}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {job.status === "success" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <Download className="size-3.5" />
                  <span className="hidden md:inline">下载</span>
                </Button>
              )}
              {(job.status === "failed" || job.status === "success") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <RefreshCw className="size-3.5" />
                  <span className="hidden md:inline">重渲</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <Trash2 className="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Link>
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
