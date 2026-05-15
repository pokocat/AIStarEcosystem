"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { CelebrityJobs, type PendingJobRecord } from "@/lib/celebrity-jobs";
import { ENGINE_META } from "@/constants/celebrity-zone-ui";
import { cn } from "@ai-star-eco/ui/ui/utils";

/** 顶栏右侧的进行中任务徽章：实时反映 localStorage 中的 running / completed 任务。 */
export function PendingJobsBadge() {
  const [tick, setTick] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // 订阅 jobs 变化
  React.useEffect(() => CelebrityJobs.subscribe(() => setTick((t) => t + 1)), []);

  // 进度推进：每秒重新渲染一次（让进度条 / running 状态持续走完）
  React.useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // 自动 mark complete：发现已超时但仍 running 的任务，标记完成（mock 模式）
  React.useEffect(() => {
    const running = CelebrityJobs.listRunning();
    for (const job of running) {
      const { percent } = CelebrityJobs.computeProgress(job);
      if (percent >= 100) {
        CelebrityJobs.markCompleted(job.jobId, {
          videoUrl:
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        });
      }
    }
  }, [tick]);

  // 点击外部关闭
  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const running = CelebrityJobs.listRunning();
  const completed = CelebrityJobs.listCompleted();
  const total = running.length + completed.length;
  if (total === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] transition",
          running.length > 0
            ? "border-violet-400/40 bg-violet-500/10 text-violet-600 hover:border-violet-500"
            : "border-emerald-400/40 bg-emerald-500/10 text-emerald-600 hover:border-emerald-500",
        )}
      >
        {running.length > 0 ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{running.length} 个生成中</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-3 w-3" />
            <span>{completed.length} 已完成 · 待查看</span>
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[360px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[var(--shadow-pop)]">
          <div className="border-b border-zinc-200 px-4 py-2 text-[11px] text-zinc-500">
            我的进行中任务
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {running.length === 0 && completed.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-zinc-500">
                暂无进行中任务
              </div>
            )}
            {running.map((job) => (
              <JobRow key={job.jobId} job={job} onClose={() => setOpen(false)} />
            ))}
            {completed.length > 0 && running.length > 0 && (
              <div className="border-t border-zinc-200 px-4 py-1.5 text-[10px] text-zinc-500">
                已完成 · 待查看
              </div>
            )}
            {completed.map((job) => (
              <JobRow key={job.jobId} job={job} onClose={() => setOpen(false)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function JobRow({ job, onClose }: { job: PendingJobRecord; onClose: () => void }) {
  const meta = ENGINE_META[job.engine];
  const { percent } = CelebrityJobs.computeProgress(job);
  const isCompleted = job.status === "completed";
  const href = `/star/${job.artistId}/generate?jobId=${encodeURIComponent(job.jobId)}`;
  return (
    <Link
      href={href}
      onClick={onClose}
      className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 last:border-b-0 transition hover:bg-zinc-50"
    >
      <img
        src={job.artistAvatar}
        alt={job.artistName}
        className="h-9 w-9 shrink-0 rounded-full border border-violet-400/30 object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="truncate font-medium text-zinc-800">{job.artistName}</span>
          <span className="text-zinc-400">·</span>
          <span className="truncate text-zinc-600">{job.product.name || "新商品"}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300",
                isCompleted
                  ? "bg-emerald-500"
                  : "bg-gradient-to-r from-violet-500 via-violet-400 to-violet-300",
              )}
              style={{ width: `${isCompleted ? 100 : percent}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-zinc-500 w-10 text-right">
            {isCompleted ? "✓" : `${percent}%`}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500">
          <Sparkles className="h-2.5 w-2.5" />
          <span>{meta.name} · {meta.level}</span>
          {isCompleted && <span className="text-emerald-600">· 已完成，点击查看</span>}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
    </Link>
  );
}
