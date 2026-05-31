"use client";

// 视频库（v0.45）：短剧成片网格 + 生成中态。归入项目 / 去分发由父组件在头部提供。
import * as React from "react";
import { Film, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/common";
import type { DramaEpisodeJob } from "@/api/short-drama";

export function VideoLibrary({ jobs }: { jobs: DramaEpisodeJob[] }) {
  if (jobs.length === 0) {
    return <EmptyState icon={<Film size={26} />} title="还没有成片" description="在「生成」一步提交后，短剧视频会出现在这里，可下载、归入项目或去分发。" />;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
      {jobs.map((job) => <EpisodeCard key={job.id} job={job} />)}
    </div>
  );
}

function EpisodeCard({ job }: { job: DramaEpisodeJob }) {
  const ready = job.status === "ready";
  const failed = job.status === "failed";
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--surface-1)" }}>
      <div style={{ aspectRatio: "9 / 16", background: "var(--video-letterbox)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        {ready && job.video_url ? (
          <video src={job.video_url} controls style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : failed ? (
          <div style={{ textAlign: "center", padding: 16, color: "var(--danger)", fontSize: 12, lineHeight: 1.6 }}>
            <Film size={22} style={{ marginBottom: 8, opacity: 0.7 }} />
            <div>{job.error_message || "生成失败，请重试"}</div>
          </div>
        ) : (
          <div style={{ textAlign: "center", color: "var(--fg-3)", fontSize: 12 }}>
            <Loader2 size={20} className="animate-spin" style={{ marginBottom: 8 }} />
            <div>{job.stage || "生成中"}{typeof job.progress_pct === "number" ? ` · ${job.progress_pct}%` : ""}</div>
          </div>
        )}
      </div>
      <div style={{ padding: "10px 12px" }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-0)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.name}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
          <span style={{ fontSize: 10.5, color: ready ? "var(--accent)" : failed ? "var(--danger)" : "var(--fg-3)" }}>
            {ready ? "已生成 · 可分发" : failed ? "生成失败" : job.stage || "处理中"}
          </span>
          {ready && job.video_url && (
            <a href={job.video_url} download style={{ fontSize: 10.5, color: "var(--fg-2)", textDecoration: "underline" }}>下载</a>
          )}
        </div>
      </div>
    </div>
  );
}
