"use client";

import * as React from "react";
import Link from "next/link";
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
import { PROJECT_STATUS_BADGE } from "@/constants/celebrity-zone-ui";
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
  const generateHref = `/producer/celebrity-zone/star/${project.starId}/generate`;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/5 pb-4">
        <Link
          href="/producer/celebrity-zone?tab=projects"
          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-white/55 transition hover:border-white/30 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 返回项目列表
        </Link>
        <h1 className="text-lg font-semibold text-white/90">{project.name}</h1>
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
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
            <img
              src={project.starAvatar}
              alt={project.starName}
              className="h-12 w-12 rounded-full border border-cyan-500/30 object-cover"
            />
            <div className="flex-1">
              <div className="text-base font-semibold text-white/90">
                {project.starName} · {project.pricingTier}
              </div>
              <div className="mt-0.5 text-xs text-white/40">
                {project.createdAt} 创建 · 共 {project.videoCount} 条视频
              </div>
            </div>
            <Link
              href={generateHref}
              className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(6,182,212,0.25)] transition hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]"
            >
              <Plus className="h-3.5 w-3.5" /> 生成新视频
            </Link>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-500/20"
            >
              <Globe className="h-3.5 w-3.5" /> 批量分发
            </button>
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm font-medium text-white/70">
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
                      ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                      : "border-white/10 text-white/45 hover:border-white/20 hover:text-white/75",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-white/55 hover:border-white/30 hover:text-white"
              >
                <Filter className="h-3 w-3" /> 筛选
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-white/55 hover:border-white/30 hover:text-white"
              >
                <ArrowDownAZ className="h-3 w-3" /> 排序
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-6 py-16 text-center text-sm text-white/40">
              暂无符合筛选条件的视频
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
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <div className="mb-3 text-sm font-medium text-white/70">项目数据</div>
            <ul className="flex flex-col gap-2 text-sm">
              <Row label="总播放" value={project.totalPlays} accent="text-cyan-300" />
              <Row label="总互动" value={project.totalInteractions} accent="text-purple-300" />
              <Row
                label="转化订单"
                value={project.conversions.toString()}
                accent="text-emerald-300"
              />
              <Row label="预估 GMV" value={project.gmv} accent="text-pink-300" />
            </ul>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <div className="mb-3 text-sm font-medium text-white/70">分发渠道</div>
            <ul className="flex flex-col gap-2 text-xs">
              {project.channels.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2"
                >
                  <span className="font-medium text-white/75">{c.name}</span>
                  <div className="flex items-center gap-2">
                    {c.connected ? (
                      <span className="inline-flex items-center gap-1 text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> 已接入
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-300">
                        <XCircle className="h-3 w-3" /> 待接入
                      </span>
                    )}
                    <span className="text-white/40">
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

          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <div className="mb-2 text-sm font-medium text-white/70">授权额度</div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.04]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500"
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
            <div className="mt-1 text-[11px] text-white/40">
              本项目已用 {project.quota.used}/{project.quota.total} 条
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <div className="mb-3 text-sm font-medium text-white/70">快捷操作</div>
            <div className="flex flex-col gap-2 text-xs">
              <button className="inline-flex items-center gap-2 rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-cyan-200 hover:border-cyan-300 hover:bg-cyan-500/20">
                <Download className="h-3.5 w-3.5" /> 导出数据报告
              </button>
              <button className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-white/55 hover:border-white/30 hover:text-white">
                <Settings className="h-3.5 w-3.5" /> 项目设置
              </button>
              <button className="inline-flex items-center gap-2 rounded-md border border-rose-400/30 bg-rose-500/[0.06] px-3 py-2 text-rose-200/70 hover:border-rose-300 hover:bg-rose-500/15">
                <Archive className="h-3.5 w-3.5" /> 归档项目
              </button>
            </div>
          </div>
        </div>
      </div>
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
      <span className="text-white/45">{label}</span>
      <span className={cn("font-semibold tabular-nums", accent)}>{value}</span>
    </li>
  );
}
