"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownAZ,
  ArrowLeft,
  Archive,
  CheckCircle2,
  Download,
  Filter,
  Globe,
  Plus,
  Settings,
  XCircle,
} from "lucide-react";
import { CelebrityProjectVideoCard } from "./CelebrityProjectVideoCard";
import { DistributeDialog } from "@/components/distribution/DistributeDialog";
import { PROJECT_STATUS_BADGE, CTA_PRIMARY, CTA_SECONDARY } from "@/constants/celebrity-zone-ui";
import type {
  CelebrityProject,
  CelebrityProjectVideo,
  ProjectVideoStatus,
} from "@ai-star-eco/types/celebrity-zone";
import { cn } from "@ai-star-eco/ui/ui/utils";

interface Props {
  project: CelebrityProject;
  videos: CelebrityProjectVideo[];
}

const VIDEO_FILTERS: Array<"全部" | ProjectVideoStatus> = [
  "全部",
  "已发布",
  "待审核",
  "生成中",
  "已驳回",
];

/** P5 项目详情：72/28 分栏（左视频网格，右数据/渠道/额度/快捷操作）。 */
export function CelebrityProjectDetail({ project, videos }: Props) {
  const [statusFilter, setStatusFilter] = React.useState<"全部" | ProjectVideoStatus>(
    "全部",
  );
  const filtered = React.useMemo(() => {
    if (statusFilter === "全部") return videos;
    return videos.filter((v) => v.status === statusFilter);
  }, [videos, statusFilter]);
  const badge = PROJECT_STATUS_BADGE[project.status];
  const generateHref = `/star/${project.starId}/generate`;

  // 分发入口：CTA「批量分发」开 dialog；同时支持 ?action=distribute 直接打开
  // （CelebrityProjectCard / CelebrityGenerationWorkspace 那两条 deep link 用）。
  const router = useRouter();
  const searchParams = useSearchParams();
  const [distributeOpen, setDistributeOpen] = React.useState(false);
  React.useEffect(() => {
    if (searchParams.get("action") === "distribute") {
      setDistributeOpen(true);
    }
  }, [searchParams]);
  const closeDistribute = React.useCallback(() => {
    setDistributeOpen(false);
    // 清掉 ?action 避免刷新后又弹一次；保留其它 query
    if (searchParams.get("action") === "distribute") {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("action");
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : "?");
    }
  }, [router, searchParams]);
  const handleDistributed = React.useCallback(
    (_jobIds: string[]) => {
      // 创建完跳到 /distribution，让用户去 ▶ 启动（启动时才扣费）
      router.push("/distribution");
    },
    [router],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 pb-4">
        <Link href="/projects" className={CTA_SECONDARY}>
          <ArrowLeft className="h-3.5 w-3.5" /> 返回项目列表
        </Link>
        <h1 className="text-lg font-semibold text-zinc-800">{project.name}</h1>
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-[11px] font-medium",
            badge.className,
          )}
        >
          {project.status}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,18fr)_minmax(0,7fr)]">
        {/* 左：项目头 + 视频网格 */}
        <div className="flex flex-col gap-4">
          {/* Project header */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
            <img
              src={project.starAvatar}
              alt={project.starName}
              className="h-12 w-12 rounded-full border border-violet-500/30 object-cover"
            />
            <div className="flex-1">
              <div className="text-base font-semibold text-zinc-800">
                {project.starName} · {project.pricingTier}
              </div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {project.createdAt} 创建 · 共 {project.videoCount} 条视频
              </div>
            </div>
            <Link href={generateHref} className={CTA_PRIMARY}>
              <Plus className="h-3.5 w-3.5" /> 生成新视频
            </Link>
            <button
              type="button"
              onClick={() => setDistributeOpen(true)}
              className={CTA_SECONDARY}
            >
              <Globe className="h-3.5 w-3.5" /> 批量分发
            </button>
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm font-medium text-zinc-700">
              视频列表（{filtered.length}）
            </div>
            <div className="flex flex-wrap gap-1">
              {VIDEO_FILTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "rounded-md border px-3 py-1 text-[11px] transition",
                    statusFilter === s
                      ? "border-violet-400/40 bg-violet-500/10 text-violet-600"
                      : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-800",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
              >
                <Filter className="h-3 w-3" /> 筛选
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
              >
                <ArrowDownAZ className="h-3 w-3" /> 排序
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center text-sm text-zinc-500">
              没有符合筛选条件的视频
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((v) => (
                <CelebrityProjectVideoCard key={v.id} video={v} />
              ))}
            </div>
          )}
        </div>

        {/* 右：项目数据 + 渠道 + 额度 + 快捷操作 */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
            <div className="mb-3 text-sm font-medium text-zinc-700">项目数据</div>
            <ul className="flex flex-col gap-2 text-sm">
              <Row label="总播放" value={project.totalPlays} accent="text-violet-600" />
              <Row label="总互动" value={project.totalInteractions} accent="text-violet-600" />
              <Row
                label="转化订单"
                value={project.conversions.toString()}
                accent="text-emerald-600"
              />
              <Row label="预估 GMV" value={project.gmv} accent="text-pink-600" />
            </ul>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
            <div className="mb-3 text-sm font-medium text-zinc-700">分发渠道</div>
            <ul className="flex flex-col gap-2 text-xs">
              {project.channels.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2"
                >
                  <span className="font-medium text-zinc-700">{c.name}</span>
                  <div className="flex items-center gap-2">
                    {c.connected ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" /> 已接入
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <XCircle className="h-3 w-3" /> 待接入
                      </span>
                    )}
                    <span className="text-zinc-500">
                      {c.connected
                        ? c.publishedCount > 0
                          ? `${c.publishedCount} 条`
                          : "—"
                        : "—"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
            <div className="mb-2 text-sm font-medium text-zinc-700">授权额度</div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400"
                style={{
                  width: `${Math.min(
                    100,
                    project.quota.total > 0
                      ? (project.quota.used / project.quota.total) * 100
                      : 0,
                  )}%`,
                }}
              />
            </div>
            <div className="mt-1 text-[11px] text-zinc-500">
              本项目已用 {project.quota.used}/{project.quota.total} 条
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
            <div className="mb-3 text-sm font-medium text-zinc-700">快捷操作</div>
            <div className="flex flex-col gap-2 text-xs">
              <button className="inline-flex items-center gap-2 rounded-md border border-violet-400/40 bg-violet-500/10 px-3 py-2 text-violet-600 transition hover:border-violet-500 hover:bg-violet-500/20">
                <Download className="h-3.5 w-3.5" /> 导出数据报告
              </button>
              <button className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900">
                <Settings className="h-3.5 w-3.5" /> 项目设置
              </button>
              <button className="inline-flex items-center gap-2 rounded-md border border-pink-400/30 bg-pink-500/[0.06] px-3 py-2 text-pink-600 transition hover:border-pink-500 hover:bg-pink-500/15">
                <Archive className="h-3.5 w-3.5" /> 归档项目
              </button>
            </div>
          </div>
        </div>
      </div>

      <DistributeDialog
        open={distributeOpen}
        onClose={closeDistribute}
        project={project}
        videos={videos}
        onCreated={handleDistributed}
      />
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className={cn("font-semibold tabular-nums", accent)}>{value}</span>
    </li>
  );
}
