"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Globe, Wand2 } from "lucide-react";
import type { CelebrityProject } from "@ai-star-eco/types/celebrity-zone";
import { PROJECT_STATUS_BADGE } from "@/constants/celebrity-zone-ui";
import { cn } from "@ai-star-eco/ui/ui/utils";

interface Props {
  project: CelebrityProject;
}

export function CelebrityProjectCard({ project }: Props) {
  const badge = PROJECT_STATUS_BADGE[project.status];
  const detailHref = `/projects/${project.id}`;
  const generateHref = `/star/${project.starId}/generate`;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-violet-400/60 hover:shadow-[var(--shadow-lift)]">
      {/* Header: name + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Link
            href={detailHref}
            className="text-base font-semibold text-zinc-800 hover:text-violet-600"
          >
            {project.name}
          </Link>
          <div className="mt-1.5 flex items-center gap-2">
            <img
              src={project.starAvatar}
              alt={project.starName}
              className="h-5 w-5 rounded-full border border-zinc-200 object-cover"
            />
            <span className="text-xs text-zinc-600">{project.starName}</span>
            <span className="text-[10px] text-zinc-400">·</span>
            <span className="text-[11px] text-zinc-500">
              {project.pricingTier}
            </span>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium",
            badge.className,
          )}
        >
          {project.status}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
        <Stat label="视频" value={project.videoCount.toString()} accent="text-zinc-800" />
        <Stat label="播放" value={project.totalPlays} accent="text-violet-600" />
        <Stat label="GMV" value={project.gmv} accent="text-pink-600" />
      </div>

      {/* Quota */}
      <div>
        <div className="flex items-center justify-between text-[11px] text-zinc-500">
          <span>授权额度</span>
          <span>
            {project.quota.used}/{project.quota.total}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
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
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={generateHref}
          className="inline-flex items-center gap-1 rounded-md border border-violet-400/40 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-600 transition hover:border-violet-500 hover:bg-violet-500/20"
        >
          <Wand2 className="h-3 w-3" /> 生成视频
        </Link>
        <Link
          href={detailHref}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
        >
          详情 <ArrowRight className="h-3 w-3" />
        </Link>
        <Link
          href={`${detailHref}?action=distribute`}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
        >
          <Globe className="h-3 w-3" /> 分发
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-zinc-500">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", accent)}>{value}</span>
    </div>
  );
}
