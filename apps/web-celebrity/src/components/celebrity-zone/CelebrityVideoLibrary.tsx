"use client";

import * as React from "react";
import { Film, Eye } from "lucide-react";
import { CelebrityProjectVideoCard } from "./CelebrityProjectVideoCard";
import { CelebrityVideoPlayer } from "./CelebrityVideoPlayer";
import { ENGINE_META, VIDEO_STATUS_BADGE } from "@/constants/celebrity-zone-ui";
import { VIDEO_ASSET_GRID_CLASS, VIDEO_ASSET_TOOLBAR_CLASS } from "@/components/common/video-library-density";
import type {
  CelebrityProject,
  CelebrityProjectVideo,
  CelebrityStar,
  ProjectVideoStatus,
} from "@ai-star-eco/types/celebrity-zone";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { MobileFilterSheet } from "@/components/common/MobileFilterSheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@ai-star-eco/ui/ui/dialog";
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
  canDeleteVideos?: boolean;
  deletingId?: string | null;
  onDeleteVideo?: (video: CelebrityProjectVideo) => void;
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
export function CelebrityVideoLibrary({
  videos,
  stars,
  projects,
  canDeleteVideos = false,
  deletingId = null,
  onDeleteVideo,
}: Props) {
  const [status, setStatus] = React.useState<"全部" | ProjectVideoStatus>("全部");
  const [starId, setStarId] = React.useState<"all" | string>("all");
  const [projectId, setProjectId] = React.useState<"all" | string>("all");
  const [sort, setSort] = React.useState<SortKey>("createdDesc");
  const [selected, setSelected] = React.useState<CelebrityProjectVideo | null>(null);

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
  const activeFilterCount =
    (status !== "全部" ? 1 : 0) +
    (starId !== "all" ? 1 : 0) +
    (projectId !== "all" ? 1 : 0) +
    (sort !== "createdDesc" ? 1 : 0);

  return (
    <div className="flex flex-col gap-3">
      <div className={cn(VIDEO_ASSET_TOOLBAR_CLASS, "flex items-center gap-2 md:hidden")}>
        <div className="inline-flex min-w-0 flex-1 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-400/25 bg-violet-500/10">
            <Film className="h-4 w-4 text-violet-600" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-800">
              明星视频 · {filtered.length}/{videos.length}
            </div>
            <div className="truncate text-[11px] text-zinc-500">
              {status !== "全部" ? status : "全部状态"} · {sort === "playsDesc" ? "播放最高" : "最新创建"}
            </div>
          </div>
        </div>
        <MobileFilterSheet
          title="明星视频筛选"
          summary={`当前匹配 ${filtered.length} / ${videos.length} 条视频`}
          activeCount={activeFilterCount}
        >
          <div className="space-y-5">
            <section>
              <div className="mb-2 text-xs font-semibold text-zinc-500">状态</div>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_TABS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      "mobile-touch-target rounded-lg border px-3 text-sm transition",
                      status === s
                        ? "border-violet-400/40 bg-violet-500/10 text-violet-700"
                        : "border-zinc-200 bg-white text-zinc-600",
                    )}
                  >
                    {s} <span className="font-mono text-[11px] opacity-70">{counters[s] ?? 0}</span>
                  </button>
                ))}
              </div>
            </section>
            <section className="space-y-3">
              <div className="text-xs font-semibold text-zinc-500">范围</div>
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
            </section>
          </div>
        </MobileFilterSheet>
      </div>

      <div className={cn(VIDEO_ASSET_TOOLBAR_CLASS, "hidden flex-wrap items-center gap-2 md:flex")}>
        <div className="inline-flex shrink-0 items-center gap-2 pr-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-400/25 bg-violet-500/10">
            <Film className="h-4 w-4 text-violet-600" />
          </span>
          <span className="text-sm font-semibold text-zinc-800">明星视频 · {filtered.length}/{videos.length}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {STATUS_TABS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-medium transition",
                status === s
                  ? "border-violet-300 bg-violet-50 text-violet-700"
                  : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-800",
              )}
            >
              {s}
              <span className="ml-1 font-mono text-[10px] opacity-70">{counters[s] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
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
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center text-sm text-zinc-500">
          没有符合筛选条件的视频
        </div>
      ) : (
        <div className={VIDEO_ASSET_GRID_CLASS}>
          {filtered.map((v) => (
            <CelebrityProjectVideoCard
              key={v.id}
              video={v}
              showProject
              compact
              onOpen={setSelected}
              canDelete={canDeleteVideos}
              deleting={deletingId === v.id}
              onDelete={onDeleteVideo}
            />
          ))}
        </div>
      )}

      {/* 大图浏览 lightbox：点击卡片打开，大屏自动播放 + 元信息 */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-sm overflow-hidden border-zinc-800 bg-zinc-950 p-0">
          {selected && (
            <>
              <DialogHeader className="px-4 pb-2 pt-4">
                <DialogTitle className="line-clamp-1 text-sm font-medium text-white">
                  {selected.productName}
                </DialogTitle>
              </DialogHeader>
              <div className="px-4">
                <CelebrityVideoPlayer
                  src={selected.videoUrl}
                  poster={selected.thumb}
                  thumbnailMode={false}
                  aspect="9/16"
                  className="mx-auto w-[300px] max-w-full"
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[11px] text-zinc-400">
                <span>
                  {selected.projectName} · {selected.starName}
                </span>
                <span
                  className="rounded border px-1 text-[10px]"
                  style={{
                    borderColor: `${ENGINE_META[selected.engine].color}55`,
                    color: ENGINE_META[selected.engine].color,
                    background: `${ENGINE_META[selected.engine].color}14`,
                  }}
                >
                  {selected.engine}
                </span>
                <span
                  className={cn(
                    "rounded-md border px-1.5 py-0.5 text-[10px]",
                    VIDEO_STATUS_BADGE[selected.status].className,
                  )}
                >
                  {selected.status}
                </span>
                {selected.plays && (
                  <span className="inline-flex items-center gap-0.5">
                    <Eye className="h-3 w-3" /> {selected.plays}
                  </span>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
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
    <div className="mobile-touch-target inline-flex h-7 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 text-[11px] text-zinc-600">
      <span className="shrink-0 whitespace-nowrap text-zinc-500">{label}</span>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger className="h-6 min-w-24 border-0 bg-transparent px-1 text-[11px] text-zinc-800 shadow-none focus:ring-0">
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
