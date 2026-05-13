"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { CelebrityProjectCard } from "./CelebrityProjectCard";
import { NewProjectDialog } from "./NewProjectDialog";
import { CelebrityZoneApi } from "@/api";
import type {
  CelebrityProject,
  CelebrityProjectStatus,
  CelebrityStar,
} from "@ai-star-eco/types/celebrity-zone";
import { cn } from "@ai-star-eco/ui/ui/utils";

interface Props {
  initialProjects: CelebrityProject[];
  stars: CelebrityStar[];
}

const STATUS_FILTERS: Array<"全部" | CelebrityProjectStatus> = [
  "全部",
  "进行中",
  "筹备中",
  "已完成",
];

/** P4 我的项目：状态 Tab + 2 列项目网格 + 新建按钮。 */
export function CelebrityMyProjects({ initialProjects, stars }: Props) {
  const [projects, setProjects] = React.useState<CelebrityProject[]>(initialProjects);
  const [status, setStatus] = React.useState<"全部" | CelebrityProjectStatus>("全部");
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const filtered = React.useMemo(() => {
    if (status === "全部") return projects;
    return projects.filter((p) => p.status === status);
  }, [projects, status]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100">
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "relative px-4 py-2 text-sm font-medium transition",
                status === s
                  ? "text-violet-300"
                  : "text-zinc-400 hover:text-zinc-700",
              )}
            >
              {s}
              {status === s && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t bg-gradient-to-r from-violet-400 to-violet-300" />
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-500 to-violet-500 px-4 py-2 text-sm font-semibold text-zinc-900 shadow-[0_0_20px_rgba(6,182,212,0.25)] transition hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]"
        >
          <Plus className="h-3.5 w-3.5" /> 新建项目
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyProjects status={status} onCreate={() => setDialogOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((p) => (
            <CelebrityProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}

      <NewProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        stars={stars}
        onCreated={(p) => setProjects((prev) => [p, ...prev])}
        onSubmit={(payload) => CelebrityZoneApi.createProject(payload)}
      />
    </div>
  );
}

function EmptyProjects({
  status,
  onCreate,
}: {
  status: string;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-violet-500/30 bg-gradient-to-br from-violet-500/15 to-violet-500/15">
        <Plus className="h-6 w-6 text-violet-300" />
      </div>
      <h3 className="text-base font-semibold text-zinc-700">
        {status === "全部" ? "还没有项目" : `暂无「${status}」状态的项目`}
      </h3>
      <p className="mt-1 max-w-md text-sm text-zinc-400">
        将多条带货视频归入同一个项目，便于统一分发、追踪 ROI、按周期归档。
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-500 to-violet-500 px-4 py-2 text-sm font-semibold text-zinc-900"
      >
        <Plus className="h-3.5 w-3.5" /> 立即创建
      </button>
    </div>
  );
}
