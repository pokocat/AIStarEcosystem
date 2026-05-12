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
  const detailHref = `/console/projects/${project.id}`;
  const generateHref = `/console/star/${project.starId}/generate`;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/8 bg-white/[0.025] p-5 transition hover:border-cyan-500/30 hover:bg-white/[0.04]">
      {/* Header: name + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Link
            href={detailHref}
            className="text-base font-semibold text-white/90 hover:text-cyan-200"
          >
            {project.name}
          </Link>
          <div className="mt-1.5 flex items-center gap-2">
            <img
              src={project.starAvatar}
              alt={project.starName}
              className="h-5 w-5 rounded-full border border-white/10 object-cover"
            />
            <span className="text-xs text-white/55">{project.starName}</span>
            <span className="text-[10px] text-white/25">·</span>
            <span className="text-[11px] text-white/40">
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
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3">
        <Stat label="视频" value={project.videoCount.toString()} accent="text-white/85" />
        <Stat label="播放" value={project.totalPlays} accent="text-cyan-300" />
        <Stat label="GMV" value={project.gmv} accent="text-pink-300" />
      </div>

      {/* Quota */}
      <div>
        <div className="flex items-center justify-between text-[11px] text-white/40">
          <span>授权额度</span>
          <span>
            {project.quota.used}/{project.quota.total}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
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
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={generateHref}
          className="inline-flex items-center gap-1 rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-500/20"
        >
          <Wand2 className="h-3 w-3" /> 生成视频
        </Link>
        <Link
          href={detailHref}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:border-white/30 hover:text-white"
        >
          详情 <ArrowRight className="h-3 w-3" />
        </Link>
        <Link
          href={`${detailHref}?action=distribute`}
          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:border-white/30 hover:text-white"
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
      <span className="text-[10px] text-white/35">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", accent)}>{value}</span>
    </div>
  );
}
