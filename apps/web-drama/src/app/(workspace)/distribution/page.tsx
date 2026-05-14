"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plug, RefreshCw, Share2, X as XIcon } from "lucide-react";
import type { Platform } from "@ai-star-eco/types/distribution";
import type { PublishJob } from "@/types/publish-job";
import { Button, Card, Chip, KpiCard } from "@/components/premium";
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  SectionHeader,
  StatusBadge,
  ViewHeader,
} from "@/components/common";
import { DistributionApi } from "@/api";
import { useAsync, invalidate } from "@/lib/drama-query";
import { ApiError } from "@ai-star-eco/api-client";

export default function DistributionOverviewPage() {
  const router = useRouter();
  const platformsQ = useAsync<Platform[]>("/distribution/platforms", () =>
    DistributionApi.listPlatforms(),
  );
  const jobsQ = useAsync<PublishJob[]>("/distribution/jobs", () =>
    DistributionApi.listPublishJobs(undefined),
  );

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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
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
        {!platformsQ.isLoading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
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
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <span style={{ fontSize: 20 }}>{p.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--fg-3)" }}>
                      {p.followers} · 同步 {p.lastSync}
                    </div>
                  </div>
                  <StatusBadge tone={tone}>{p.status}</StatusBadge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleConnection(p)}
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
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{j.platformName}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--fg-2)" }}>
                    项目 {j.projectId}
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: "var(--radius-pill)", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${j.progress}%`,
                        height: "100%",
                        background: j.status === "failed" ? "var(--danger)" : "var(--gradient-gold)",
                        transition: "width 400ms ease",
                      }}
                    />
                  </div>
                  <StatusBadge tone={tone}>{j.status}</StatusBadge>
                  <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                    {j.status !== "live" && j.status !== "failed" && (
                      <Button variant="ghost" size="sm" onClick={() => cancel(j.id)}>
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
