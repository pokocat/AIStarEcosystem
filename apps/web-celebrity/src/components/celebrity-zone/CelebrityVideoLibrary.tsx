"use client";

import * as React from "react";
import { Film } from "lucide-react";
import { CelebrityProjectVideoCard } from "./CelebrityProjectVideoCard";
import type {
  CelebrityProject,
  CelebrityProjectVideo,
  CelebrityStar,
  ProjectVideoStatus,
} from "@ai-star-eco/types/celebrity-zone";
import { cn } from "@ai-star-eco/ui/ui/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ai-star-eco/ui/ui/select";

interface Props {
  videos: CelebrityProjectVideo[];
  stars: CelebrityStar[];
  projects: CelebrityProject[];
}

const STATUS_TABS: Array<"全部" | ProjectVideoStatus> = [
  "全部",
  "已发布",
  "待审核",
  "生成中",
  "已驳回",
];

type SortKey = "createdDesc" | "playsDesc";

/** 视频库 Tab：跨项目视频聚合 + 多维度筛选。 */
export function CelebrityVideoLibrary({ videos, stars, projects }: Props) {
  const [status, setStatus] = React.useState<"全部" | ProjectVideoStatus>("全部");
  const [starId, setStarId] = React.useState<"all" | string>("all");
  const [projectId, setProjectId] = React.useState<"all" | string>("all");
  const [sort, setSort] = React.useState<SortKey>("createdDesc");

  const filtered = React.useMemo(() => {
    let v = [...videos];
    if (status !== "全部") v = v.filter((x) => x.status === status);
    if (starId !== "all") v = v.filter((x) => x.starId === starId);
    if (projectId !== "all") v = v.filter((x) => x.projectId === projectId);
    if (sort === "playsDesc") {
      v.sort((a, b) => parsePlays(b.plays) - parsePlays(a.plays));
    } else {
      v.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    }
    return v;
  }, [videos, status, starId, projectId, sort]);

  const counters = React.useMemo(() => {
    const total = videos.length;
    const byStatus = STATUS_TABS.reduce(
      (acc, s) => {
        acc[s] = s === "全部" ? total : videos.filter((v) => v.status === s).length;
        return acc;
      },
      {} as Record<string, number>,
    );
    return byStatus;
  }, [videos]);

  return (
    <div className="flex flex-col gap-5">
      {/* Header summary */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-[var(--shadow-soft)]">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-500/10">
          <Film className="h-5 w-5 text-violet-600" />
        </div>
        <div className="flex-1">
          <div className="text-base font-semibold text-zinc-800">
            视频库 · {videos.length} 条
          </div>
          <div className="text-xs text-zinc-500">
            跨项目聚合所有 AI 生成视频，支持按状态 / 明星 / 项目 / 时间筛选与排序。
          </div>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1 border-b border-zinc-200">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={cn(
              "relative px-4 py-2 text-sm font-medium transition",
              status === s ? "text-violet-600" : "text-zinc-500 hover:text-zinc-800",
            )}
          >
            {s}
            <span className="ml-1 text-[10px] text-zinc-400">({counters[s] ?? 0})</span>
            {status === s && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t bg-gradient-to-r from-violet-500 to-violet-400" />
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect
          label="明星"
          value={starId}
          options={[
            { value: "all", label: "全部明星" },
            ...stars.map((s) => ({ value: s.id, label: s.name })),
          ]}
          onChange={setStarId}
        />
        <FilterSelect
          label="项目"
          value={projectId}
          options={[
            { value: "all", label: "全部项目" },
            ...projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
          onChange={setProjectId}
        />
        <FilterSelect
          label="排序"
          value={sort}
          options={[
            { value: "createdDesc", label: "最新创建" },
            { value: "playsDesc", label: "播放最高" },
          ]}
          onChange={(v) => setSort(v as SortKey)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center text-sm text-zinc-500">
          暂无符合筛选条件的视频
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {filtered.map((v) => (
            <CelebrityProjectVideoCard key={v.id} video={v} showProject />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600">
      <span className="text-zinc-500">{label}</span>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger className="h-6 border-0 bg-transparent px-1 text-xs text-zinc-800 shadow-none focus:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function parsePlays(plays?: string): number {
  if (!plays) return 0;
  const m = plays.match(/^(\d+(?:\.\d+)?)([KMB]?)$/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const mult: Record<string, number> = {
    "": 1,
    K: 1_000,
    M: 1_000_000,
    B: 1_000_000_000,
  };
  return n * (mult[m[2]] ?? 1);
}
