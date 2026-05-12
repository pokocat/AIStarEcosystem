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
            ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200 hover:border-cyan-300"
            : "border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:border-emerald-300",
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
        <div className="absolute right-0 top-full z-50 mt-2 w-[360px] overflow-hidden rounded-xl border border-white/10 bg-[#0d0d18] shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
          <div className="border-b border-white/5 px-4 py-2 text-[11px] text-white/45">
            我的进行中任务
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {running.length === 0 && completed.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-white/35">
                暂无进行中任务
              </div>
            )}
            {running.map((job) => (
              <JobRow key={job.jobId} job={job} onClose={() => setOpen(false)} />
            ))}
            {completed.length > 0 && running.length > 0 && (
              <div className="border-t border-white/5 px-4 py-1.5 text-[10px] text-white/35">
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
  const href = `/producer/celebrity-zone/star/${job.artistId}/generate?jobId=${encodeURIComponent(job.jobId)}`;
  return (
    <Link
      href={href}
      onClick={onClose}
      className="flex items-center gap-3 border-b border-white/5 px-4 py-3 last:border-b-0 transition hover:bg-white/[0.03]"
    >
      <img
        src={job.artistAvatar}
        alt={job.artistName}
        className="h-9 w-9 shrink-0 rounded-full border border-cyan-400/30 object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="truncate font-medium text-white/85">{job.artistName}</span>
          <span className="text-white/35">·</span>
          <span className="truncate text-white/55">{job.product.name || "新商品"}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300",
                isCompleted
                  ? "bg-emerald-400"
                  : "bg-gradient-to-r from-cyan-400 via-cyan-300 to-purple-500",
              )}
              style={{ width: `${isCompleted ? 100 : percent}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-white/45 w-10 text-right">
            {isCompleted ? "✓" : `${percent}%`}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1 text-[10px] text-white/35">
          <Sparkles className="h-2.5 w-2.5" />
          <span>{meta.name} · {meta.level}</span>
          {isCompleted && <span className="text-emerald-300">· 已完成，点击查看</span>}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
    </Link>
  );
}
