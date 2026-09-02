"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plug, RefreshCw, Share2, X as XIcon } from "lucide-react";
import type { Platform, PlatformStatus } from "@ai-star-eco/types/distribution";
import type { PublishJob, PublishJobStatus } from "@ai-star-eco/types/publish-job";
import { Button, Card, Chip, KpiCard } from "@/components/premium";
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  SectionHeader,
  StatusBadge,
  ViewHeader,
} from "@/components/common";
import { DistributionApi, ProjectsApi } from "@/api";
import { useAsync, invalidate } from "@/lib/drama-query";
import { ApiError } from "@ai-star-eco/api-client";

// 状态 badge 只能展示用户友好的中文标签，禁止把 wire 层原始枚举值（如 "awaiting_user"）
// 直接渲染给终端用户（AGENTS.md §8「UI 文案：用户友好」）。
const PLATFORM_STATUS_LABEL: Record<PlatformStatus, string> = {
  connected: "已连接",
  pending: "待确认",
  disconnected: "已断开",
};

const JOB_STATUS_LABEL: Record<PublishJobStatus, string> = {
  queued: "等待中",
  uploading: "上传中",
  transcoding: "处理中",
  publishing: "发布中",
  awaiting_user: "需要验证",
  live: "已发布",
  failed: "未成功",
  cancelled: "已取消",
};

export default function DistributionOverviewPage() {
  const router = useRouter();
  const platformsQ = useAsync<Platform[]>("/distribution/platforms", () =>
    DistributionApi.listPlatforms(),
  );
  const jobsQ = useAsync<PublishJob[]>("/distribution/jobs", () =>
    DistributionApi.listPublishJobs(undefined),
  );
  // 项目 id → 标题映射：任务行展示项目标题而非内部 id（原始 id 放 hover）。
  const projectsQ = useAsync("/me/drama/projects", () => ProjectsApi.listProjects());
  const projectTitleById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projectsQ.data ?? []) m.set(p.id, p.title);
    return m;
  }, [projectsQ.data]);

  React.useEffect(() => {
    const t = setInterval(() => {
      if ((jobsQ.data ?? []).some((j) => j.status !== "live" && j.status !== "failed")) {
        jobsQ.refetch();
      }
    }, 1500);
    return () => clearInterval(t);
  }, [jobsQ]);

  const platforms = platformsQ.data ?? [];
  const jobs = jobsQ.data ?? [];

  const live = jobs.filter((j) => j.status === "live").length;
  const inflight = jobs.filter(
    (j) => j.status !== "live" && j.status !== "failed",
  ).length;
  const failed = jobs.filter((j) => j.status === "failed").length;
  const connectedCount = platforms.filter((p) => p.status === "connected").length;

  async function toggleConnection(p: Platform) {
    try {
      if (p.status === "connected") {
        await DistributionApi.disconnectPlatform(p.id);
        toast.success(`${p.name} 已断开`);
      } else {
        await DistributionApi.connectPlatform(p.id);
        toast.success(`${p.name} 已接入`);
      }
      invalidate("/distribution/platforms");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "操作失败");
    }
  }

  async function cancel(id: string) {
    try {
      await DistributionApi.cancelPublishJob(id);
      invalidate("/distribution/jobs");
      toast.success("已取消");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "取消失败");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="多平台分发"
        title={
          <>
            多平台{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              分发
            </span>
          </>
        }
        meta={`${connectedCount}/${platforms.length} 平台在线 · ${live} 已上线`}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        <KpiCard label="任务 · 在跑" value={String(inflight)} tone="info" />
        <KpiCard label="任务 · 已上线" value={String(live)} tone="success" />
        <KpiCard label="任务 · 失败" value={String(failed)} tone="danger" />
        <KpiCard label="接入平台" value={`${connectedCount} / ${platforms.length}`} tone="accent" />
      </div>

      <Card style={{ padding: "22px 24px" }}>
        <SectionHeader
          eyebrow="平台"
          title="平台接入"
          right={
            <Button variant="ghost" size="sm" onClick={() => platformsQ.refetch()}>
              <RefreshCw size={11} />
              刷新
            </Button>
          }
        />
        {platformsQ.isLoading && <LoadingBlock rows={3} height={56} />}
        {!!platformsQ.error && <ErrorBlock onRetry={platformsQ.refetch} />}
        {!platformsQ.isLoading && !platformsQ.error && platforms.length === 0 && (
          <EmptyState
            icon={<Plug size={24} />}
            title="还没有接入任何平台"
            description="接入抖音、快手等平台后，成片就能直接发过去。"
          />
        )}
        {!platformsQ.isLoading && platforms.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            {platforms.map((p) => {
              const tone =
                p.status === "connected"
                  ? "success"
                  : p.status === "pending"
                    ? "accent"
                    : p.status === "disconnected"
                      ? "neutral"
                      : "info";
              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <span style={{ fontSize: 20 }}>{p.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      title={p.name}
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {p.name}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--fg-3)" }}>
                      {p.followers} · 同步 {p.lastSync}
                    </div>
                  </div>
                  <StatusBadge tone={tone}>{PLATFORM_STATUS_LABEL[p.status]}</StatusBadge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleConnection(p)}
                    aria-label={p.status === "connected" ? `断开 ${p.name}` : `连接 ${p.name}`}
                    title={p.status === "connected" ? `断开 ${p.name}` : `连接 ${p.name}`}
                  >
                    <Plug size={11} />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card style={{ padding: "22px 24px" }}>
        <SectionHeader
          eyebrow="近期任务"
          title="最近任务"
          right={
            <Button variant="ghost" size="sm" onClick={() => jobsQ.refetch()}>
              <RefreshCw size={11} />
              刷新
            </Button>
          }
        />
        {jobsQ.isLoading && <LoadingBlock rows={3} height={48} />}
        {!jobsQ.isLoading && jobs.length === 0 && (
          <EmptyState
            icon={<Share2 size={24} />}
            title="还没有分发任务"
            description="到项目详情页选择「发布到平台」。"
          />
        )}
        {jobs.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {jobs.map((j) => {
              const tone =
                j.status === "live"
                  ? "success"
                  : j.status === "failed"
                    ? "danger"
                    : j.status === "publishing"
                      ? "accent"
                      : "info";
              return (
                <div
                  key={j.id}
                  onClick={() => router.push(`/projects/${encodeURIComponent(j.projectId)}/distribute`)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 2fr auto auto",
                    gap: 12,
                    alignItems: "center",
                    padding: "12px 14px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{j.platformName}</div>
                  <div
                    style={{ fontSize: 12, color: "var(--fg-2)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={projectTitleById.get(j.projectId) ?? j.projectId}
                  >
                    {projectTitleById.get(j.projectId) ?? "短剧项目"}
                  </div>
                  <div style={{ height: 4, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: "var(--radius-pill)", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${j.progress}%`,
                        height: "100%",
                        background: j.status === "failed" ? "var(--danger)" : "var(--gradient-gold)",
                        transition: "width 400ms ease",
                      }}
                    />
                  </div>
                  <StatusBadge tone={tone}>{JOB_STATUS_LABEL[j.status]}</StatusBadge>
                  <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                    {j.status !== "live" && j.status !== "failed" && (
                      <Button variant="ghost" size="sm" onClick={() => cancel(j.id)} aria-label="取消任务" title="取消任务">
                        <XIcon size={11} />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
