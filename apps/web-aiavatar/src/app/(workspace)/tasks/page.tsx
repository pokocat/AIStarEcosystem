"use client";
// ============================================================
// 任务中心 — 所有 AI 生成动作的异步任务：实时进度、重试、取消、批量操作。
// ============================================================
import * as React from "react";
import { useRouter } from "next/navigation";
import type { AiAvatarJob, AiAvatarJobStatus } from "@ai-star-eco/types/ai-avatar";
import { Btn, IconBtn, Progress } from "@/components/ui/primitives";
import { SourceBadge } from "@/components/common/source-badge";
import { Icons, type IconComponent } from "@/components/ui/icons";
import { useApi, usePolling } from "@/lib/hooks";
import { listJobs, cancelJob, retryJob } from "@/api/ai-avatar";
import { JOB_STATUS_META, CAPABILITY_LABEL, TONE } from "@/constants/aiavatar-ui";
import { Head } from "../templates/page";
import { toast } from "@/components/ui/toast";

type Filter = "all" | "running" | "done" | "failed";

function iconFor(cap: AiAvatarJob["capability"]): IconComponent {
  if (cap === "img23d") return Icons.cube;
  if (cap === "img2video") return Icons.film;
  return Icons.sparkle;
}
function eta(j: AiAvatarJob): string {
  if (j.status === "running") return "约 " + Math.max(5, Math.round((100 - j.progress) / 3)) + "s";
  if (j.status === "succeeded") return "已完成";
  if (j.status === "failed") return "生成失败";
  if (j.status === "cancelled") return "已取消";
  return "待执行";
}

export default function TasksPage() {
  const router = useRouter();
  const { data, reload } = useApi(() => listJobs(), []);
  const [f, setF] = React.useState<Filter>("all");
  const jobs = data ?? [];
  const hasRunning = jobs.some((j) => j.status === "running" || j.status === "queued");
  usePolling(reload, 900, hasRunning);

  const statusMatch = (j: AiAvatarJob, filter: Filter) =>
    filter === "all" || (filter === "running" ? j.status === "running" || j.status === "queued" : filter === "done" ? j.status === "succeeded" : j.status === "failed" || j.status === "cancelled");
  const filt = jobs.filter((j) => statusMatch(j, f));
  const counts = {
    all: jobs.length,
    running: jobs.filter((j) => j.status === "running" || j.status === "queued").length,
    done: jobs.filter((j) => j.status === "succeeded").length,
    failed: jobs.filter((j) => j.status === "failed" || j.status === "cancelled").length,
  };

  const cancelAll = async () => {
    await Promise.all(jobs.filter((j) => j.status === "running" || j.status === "queued").map((j) => cancelJob(j.id)));
    reload();
    toast("已取消全部进行中任务", { icon: "✕", tone: "var(--err)" });
  };
  const retryAll = async () => {
    await Promise.all(jobs.filter((j) => j.status === "failed").map((j) => retryJob(j.id)));
    reload();
    toast("已重试全部失败任务", { icon: "⚡" });
  };

  return (
    <div className="fade-up" style={{ padding: "28px 36px 60px", maxWidth: 1400, margin: "0 auto" }}>
      <Head kicker="ASYNC TASKS" title="任务中心" sub="所有 AI 生成动作（打样 / 精调 / 出图 / 3D / 视频）均为异步任务。"
        right={<div style={{ display: "flex", gap: 10 }}><Btn variant="line" icon={Icons.x} onClick={cancelAll}>批量取消</Btn><Btn variant="line" icon={Icons.retry} onClick={retryAll}>失败重试</Btn></div>} />
      <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
        {(["all", "running", "done", "failed"] as Filter[]).map((k) => {
          const labels: Record<Filter, string> = { all: "全部", running: "生成中", done: "已完成", failed: "已失败" };
          return (
            <button key={k} onClick={() => setF(k)} style={{ padding: "9px 16px", fontSize: 13, cursor: "pointer", borderRadius: "var(--r-md)", border: "1px solid " + (f === k ? "var(--accent-line)" : "var(--line)"), background: f === k ? "var(--accent-soft)" : "transparent", color: f === k ? "var(--accent-hi)" : "var(--ink-1)", display: "flex", gap: 8, alignItems: "center" }}>
              {labels[k]}<span className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>{counts[k]}</span>
            </button>
          );
        })}
      </div>
      <div style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
        {filt.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "var(--ink-2)", fontFamily: "var(--font-mono)", fontSize: 13 }}>暂无任务</div>}
        {filt.map((t) => {
          const meta = JOB_STATUS_META[t.status as AiAvatarJobStatus];
          const Icon = iconFor(t.capability);
          const tone = TONE[meta.tone];
          const running = t.status === "running" || t.status === "queued";
          return (
            <div key={t.id} style={{ display: "grid", gridTemplateColumns: "44px 1.5fr 0.9fr 1.4fr 0.9fr 120px", gap: 18, alignItems: "center", padding: "15px 20px", borderBottom: "1px solid var(--line)" }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--bg-3)", color: "var(--ink-1)", display: "grid", placeItems: "center" }}><Icon size={18} /></div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{t.title}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-2)", display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>{t.id} · {CAPABILITY_LABEL[t.capability]} <SourceBadge mode={t.providerMode} engine={t.engine} /></div>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: tone.c }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: tone.c, animation: running ? "pulse 1.6s infinite" : "none" }} />
                {meta.label}
              </span>
              <div>
                {running ? (
                  <div><Progress pct={t.progress} /><span className="mono" style={{ fontSize: 10.5, color: "var(--signal)" }}>{Math.round(t.progress)}%</span></div>
                ) : (
                  <span className="mono" style={{ fontSize: 11, color: t.status === "failed" ? "var(--err)" : "var(--ink-2)" }}>{t.status === "succeeded" ? "████ 100%" : "— —"}</span>
                )}
              </div>
              <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-1)" }}>{eta(t)}</span>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                {t.status === "failed" || t.status === "cancelled" ? (
                  <Btn size="sm" variant="signal" icon={Icons.retry} onClick={async () => { await retryJob(t.id); reload(); }}>重试</Btn>
                ) : running ? (
                  <IconBtn icon={Icons.x} size={32} title="取消" onClick={async () => { await cancelJob(t.id); reload(); toast("已取消任务", { icon: "✕", tone: "var(--err)" }); }} />
                ) : (
                  <IconBtn icon={Icons.eye} size={32} title="查看资产" onClick={() => t.avatarId && router.push(`/avatars/${t.avatarId}`)} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
