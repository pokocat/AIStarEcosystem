"use client";

// 任务中心（配套工具）：异步生成任务实时进度 + 重试 + 取消 + 批量操作。
import * as React from "react";
import Link from "next/link";
import { Ban, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import type { AiAvatarJob, AiAvatarJobStatus } from "@ai-star-eco/types/ai-avatar";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { AiAvatarApi } from "@/api";
import { JobStatusPill } from "@/components/common/status-pill";
import { SourceBadge } from "@/components/common/source-badge";
import { useJobList } from "@/lib/use-job-poll";
import { useConfirm } from "@/components/common/confirm-dialog";
import { relativeTime } from "@/lib/format";

const FILTERS: { key: AiAvatarJobStatus | "all"; label: string }[] = [
  { key: "all", label: "全部" }, { key: "running", label: "生成中" }, { key: "queued", label: "排队" },
  { key: "succeeded", label: "已完成" }, { key: "failed", label: "失败" }, { key: "cancelled", label: "已取消" },
];

export default function JobsPage() {
  const { jobs, refresh } = useJobList(1500);
  const confirm = useConfirm();
  const [filter, setFilter] = React.useState<AiAvatarJobStatus | "all">("all");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const filtered = jobs.filter((j) => filter === "all" || j.status === filter);
  const active = jobs.filter((j) => j.status === "running" || j.status === "queued");
  const failed = jobs.filter((j) => j.status === "failed");

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const retry = async (id: string) => { await AiAvatarApi.retryJob(id); refresh(); };
  const cancel = async (id: string) => { await AiAvatarApi.cancelJob(id); refresh(); };

  const batchRetry = async () => {
    const ids = [...selected].filter((id) => jobs.find((j) => j.id === id)?.status === "failed");
    if (ids.length === 0) return;
    const ok = await confirm({ title: "批量重试", description: `重试 ${ids.length} 个失败任务？` });
    if (!ok) return;
    for (const id of ids) await AiAvatarApi.retryJob(id);
    setSelected(new Set()); refresh();
  };
  const batchCancel = async () => {
    const ids = [...selected].filter((id) => { const s = jobs.find((j) => j.id === id)?.status; return s === "running" || s === "queued"; });
    if (ids.length === 0) return;
    const ok = await confirm({ title: "批量取消", description: `取消 ${ids.length} 个进行中任务？`, tone: "danger" });
    if (!ok) return;
    for (const id of ids) await AiAvatarApi.cancelJob(id);
    setSelected(new Set()); refresh();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">任务中心</h1>
          <p className="mt-0.5 text-sm text-[var(--fg-2)]"><span className="num">{active.length}</span> 进行中 · <span className="num">{failed.length}</span> 失败 · 共 <span className="num">{jobs.length}</span></p>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--fg-3)]">已选 <span className="num">{selected.size}</span></span>
            <button onClick={batchRetry} className="btn btn-ghost btn-sm"><RefreshCw className="h-3.5 w-3.5" /> 重试失败</button>
            <button onClick={batchCancel} className="btn btn-danger btn-sm"><Ban className="h-3.5 w-3.5" /> 取消进行中</button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className="chip" data-on={filter === f.key}>{f.label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--bg-1)] py-16 text-center text-sm text-[var(--fg-3)]">暂无任务</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((j) => (
            <JobRow key={j.id} job={j} selected={selected.has(j.id)} onToggle={() => toggle(j.id)} onRetry={() => retry(j.id)} onCancel={() => cancel(j.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobRow({ job, selected, onToggle, onRetry, onCancel }: {
  job: AiAvatarJob; selected: boolean; onToggle: () => void; onRetry: () => void; onCancel: () => void;
}) {
  const isActive = job.status === "running" || job.status === "queued";
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border bg-[var(--bg-1)] p-3 transition", selected ? "border-[var(--brand-line)] bg-[var(--brand-soft)]" : "border-[var(--line)]")}>
      <input type="checkbox" checked={selected} onChange={onToggle} className="h-4 w-4 rounded" style={{ accentColor: "var(--brand)" }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[var(--fg-0)]">{job.title ?? job.capabilityLabel}</span>
          <SourceBadge engine={job.engine} mode={job.providerMode} />
          <JobStatusPill status={job.status} />
          {job.attempts > 1 && <span className="text-[11px] text-[var(--fg-3)]">第 <span className="num">{job.attempts}</span> 次尝试</span>}
        </div>
        {isActive ? (
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-3)]">
              <div className="h-full rounded-full transition-all" style={{ width: `${job.progress}%`, background: "var(--info)" }} />
            </div>
            <div className="meta mt-1"><span className="num">{job.progress}%</span></div>
          </div>
        ) : (
          <div className="meta mt-1 flex items-center gap-2">
            {job.status === "succeeded" && <span className="flex items-center gap-1 text-[var(--success)]"><CheckCircle2 className="h-3 w-3" /> 完成</span>}
            {job.status === "failed" && <span className="flex items-center gap-1 text-[var(--danger)]"><XCircle className="h-3 w-3" /> {job.errorMessage || "失败"}</span>}
            <span>{relativeTime(job.completedAt ?? job.createdAt)}</span>
            {job.avatarId && <Link href={`/avatar/${job.avatarId}`} className="text-[var(--brand-strong)] hover:underline">查看 AiAvatar →</Link>}
          </div>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        {job.status === "failed" && (
          <button onClick={onRetry} className="btn btn-ghost btn-sm"><RefreshCw className="h-3.5 w-3.5" /> 重试</button>
        )}
        {isActive && (
          <button onClick={onCancel} title="取消" className="btn btn-danger btn-sm"><Ban className="h-3.5 w-3.5" /></button>
        )}
      </div>
    </div>
  );
}
