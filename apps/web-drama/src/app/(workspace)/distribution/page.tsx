"use client";

export const dynamic = "force-dynamic";

// 多平台发布（v0.197 起归入侧栏「即将上线」）。
// 服务端目前是模拟推进：连接不绑定真实平台账号，发布记录由 @Scheduled 自动推到「已发布」，
// 外链是 v.example.com。所以页面顶部必须如实说明，不能让人以为视频真的发到了抖音 / 快手
// （AGENTS.md §8.0；docs/drama-ux-copy-pass.md §3.1）。
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ChevronRight, Plug, RefreshCw, Share2, X as XIcon } from "lucide-react";
import type { Platform } from "@ai-star-eco/types/distribution";
import type { PublishJob, PublishJobStatus } from "@ai-star-eco/types/publish-job";
import { formatDateTime } from "@ai-star-eco/api-client/format";
import { Button, Card, KpiCard } from "@/components/premium";
import {
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  SectionHeader,
  StatusBadge,
  ViewHeader,
} from "@/components/common";
import { dramaConfirm } from "@/components/drama-ui";
import { DistributionApi, ProjectsApi } from "@/api";
import { useAsync, invalidate } from "@/lib/drama-query";
import { PLATFORM_STATUS_LABEL, PUBLISH_JOB_STATUS_LABEL } from "@/constants/publish-job-ui";
import { ApiError } from "@ai-star-eco/api-client";

// 状态文案全站一份（@/constants/publish-job-ui），与「短剧 → 发布」页共用；
// badge 不直出 wire 枚举（如 "awaiting_user"，AGENTS.md §8「UI 文案：用户友好」）。

/** 不会再变的状态：不计入「发布中」、不再轮询、不显示取消键。 */
const TERMINAL: ReadonlySet<PublishJobStatus> = new Set(["live", "failed", "cancelled"]);

export default function DistributionOverviewPage() {
  const router = useRouter();
  const platformsQ = useAsync<Platform[]>("/distribution/platforms", () =>
    DistributionApi.listPlatforms(),
  );
  const jobsQ = useAsync<PublishJob[]>("/distribution/jobs", () =>
    DistributionApi.listPublishJobs(undefined),
  );
  // 短剧 id → 标题：记录行显示剧名而不是内部 id（id 放 hover）。
  const projectsQ = useAsync("/me/drama/projects", () => ProjectsApi.listProjects());
  const projectTitleById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projectsQ.data ?? []) m.set(p.id, p.title);
    return m;
  }, [projectsQ.data]);

  const jobs = jobsQ.data ?? [];
  const hasInflight = jobs.some((j) => !TERMINAL.has(j.status));
  const refetchJobs = React.useRef(jobsQ.refetch);
  refetchJobs.current = jobsQ.refetch;
  React.useEffect(() => {
    if (!hasInflight) return;
    const t = setInterval(() => refetchJobs.current(), 1500);
    return () => clearInterval(t);
  }, [hasInflight]);

  const platforms = platformsQ.data ?? [];
  const live = jobs.filter((j) => j.status === "live").length;
  const inflight = jobs.filter((j) => !TERMINAL.has(j.status)).length;
  const failed = jobs.filter((j) => j.status === "failed").length;
  const connectedCount = platforms.filter((p) => p.status === "connected").length;

  async function toggleConnection(p: Platform) {
    const connected = p.status === "connected";
    if (connected) {
      const ok = await dramaConfirm({
        title: `断开${p.name}？`,
        body: `断开后就发不到${p.name}了。已经发出去的记录不受影响，之后可以再连上。`,
        confirmLabel: "断开",
        tone: "danger",
      });
      if (!ok) return;
    }
    try {
      if (connected) {
        await DistributionApi.disconnectPlatform(p.id);
        toast.success(`已断开${p.name}`);
      } else {
        await DistributionApi.connectPlatform(p.id);
        toast.success(`已连接${p.name}`);
      }
      invalidate("/distribution/platforms");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : connected ? "断开失败，请重试" : "连接失败，请重试");
    }
  }

  async function cancel(id: string) {
    try {
      await DistributionApi.cancelPublishJob(id);
      invalidate("/distribution/jobs");
      toast.success("已取消这次发布");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "取消失败，请刷新后重试");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="即将上线"
        title={
          <>
            多平台{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              发布
            </span>
          </>
        }
        meta="把合成好的成片发到抖音、快手等平台"
      />

      <div className="acct-banner" role="note">
        <AlertTriangle size={16} />
        <div>
          <b>发布到平台还没接通：</b>连接不会绑定你的平台账号，发布记录也不会真的发出去。下面的状态只是演示流程，别据此判断视频有没有上线。
        </div>
      </div>

      <div className="acct-kpis">
        <KpiCard label="发布中" value={String(inflight)} tone="info" />
        <KpiCard label="已发布" value={String(live)} tone="success" />
        <KpiCard label="发布失败" value={String(failed)} tone="danger" />
        <KpiCard label="已连接平台" value={`${connectedCount} / ${platforms.length}`} tone="accent" />
      </div>

      <Card style={{ padding: "22px 24px" }}>
        <SectionHeader
          eyebrow="平台"
          title="连接发布平台"
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
            title="还没有可以连接的平台"
            description="发布到平台接通之后，抖音、快手等平台会出现在这里。"
          />
        )}
        {!platformsQ.isLoading && platforms.length > 0 && (
          <div className="acct-plat-grid">
            {platforms.map((p) => {
              const tone =
                p.status === "connected"
                  ? "success"
                  : p.status === "pending"
                    ? "accent"
                    : "neutral";
              const connected = p.status === "connected";
              return (
                <div key={p.id} className="acct-plat-card">
                  <span className="acct-plat-icon" aria-hidden>{p.icon}</span>
                  <div className="acct-plat-main">
                    <div className="acct-plat-name" title={p.name}>{p.name}</div>
                    <div>
                      <StatusBadge tone={tone}>{PLATFORM_STATUS_LABEL[p.status]}</StatusBadge>
                    </div>
                  </div>
                  <Button
                    variant={connected ? "ghost" : "secondary"}
                    size="sm"
                    className="acct-plat-btn"
                    onClick={() => toggleConnection(p)}
                    title={connected ? `断开${p.name}` : `连接${p.name}`}
                  >
                    {connected ? "断开" : "连接"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card style={{ padding: "22px 24px" }}>
        <SectionHeader
          eyebrow="每发一次平台记一条"
          title="发布记录"
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
            title="还没有发布记录"
            description="发布到平台还没接通。接通之后，短剧合成好成片就能从这里发出去。"
          />
        )}
        {jobs.length > 0 && (
          <div className="acct-job-list">
            {jobs.map((j) => {
              const tone =
                j.status === "live"
                  ? "success"
                  : j.status === "failed"
                    ? "danger"
                    : j.status === "cancelled"
                      ? "neutral"
                      : j.status === "publishing"
                        ? "accent"
                        : "info";
              const title = projectTitleById.get(j.projectId);
              const open = () => router.push(`/projects/${encodeURIComponent(j.projectId)}/distribute`);
              return (
                <div
                  key={j.id}
                  role="link"
                  tabIndex={0}
                  className="acct-job-row"
                  onClick={open}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") open();
                  }}
                >
                  <div className="acct-job-platform" title={j.platformName}>{j.platformName}</div>
                  <div className="acct-job-title">
                    <span style={{ fontSize: 12.5, color: "var(--ink)" }} title={title ?? j.projectId}>
                      {title ?? "找不到这部短剧"}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
                      {j.scheduledAt ? `定时 ${formatDateTime(j.scheduledAt)}` : `提交于 ${formatDateTime(j.createdAt)}`}
                    </span>
                    {j.status === "failed" && j.errorMessage && (
                      <span style={{ fontSize: 11, color: "var(--danger)" }} title={j.errorMessage}>
                        {j.errorMessage}
                      </span>
                    )}
                  </div>
                  <div className="acct-job-bar">
                    <div
                      style={{
                        width: `${j.progress}%`,
                        height: "100%",
                        background: j.status === "failed" ? "var(--danger)" : "var(--gradient-gold)",
                        transition: "width 400ms ease",
                      }}
                    />
                  </div>
                  <div className="acct-job-status">
                    <StatusBadge tone={tone}>{PUBLISH_JOB_STATUS_LABEL[j.status]}</StatusBadge>
                  </div>
                  <div className="acct-job-cancel" onClick={(e) => e.stopPropagation()}>
                    {!TERMINAL.has(j.status) ? (
                      <Button variant="ghost" size="sm" onClick={() => cancel(j.id)} aria-label="取消发布" title="取消发布">
                        <XIcon size={12} />
                      </Button>
                    ) : (
                      <ChevronRight size={15} style={{ color: "var(--ink-3)" }} aria-hidden />
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
