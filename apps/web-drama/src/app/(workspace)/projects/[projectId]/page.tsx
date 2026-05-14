"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  PenTool,
  Plus,
  Share2,
  Users,
} from "lucide-react";
import type { Drama, DramaStatus } from "@ai-star-eco/types/film";
import type { Artist } from "@ai-star-eco/types/artist";
import type { PublishJob } from "@/types/publish-job";
import { Button, Card, Chip, KpiCard } from "@/components/premium";
import {
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  SectionHeader,
  StatusBadge,
  ViewHeader,
} from "@/components/common";
import { ArtistsApi, DistributionApi, FilmApi } from "@/api";
import { useAsync, invalidate } from "@/lib/drama-query";
import { ApiError } from "@ai-star-eco/api-client";

const STATUS_FLOW: DramaStatus[] = ["casting", "filming", "post-production", "released"];
const STATUS_LABEL: Record<DramaStatus, string> = {
  casting: "选角",
  filming: "拍摄",
  "post-production": "后期",
  released: "已上线",
};

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default function ProjectDetailPage({ params }: PageProps) {
  const { projectId } = React.use(params);
  const router = useRouter();

  const dramaQ = useAsync<Drama | null>(`/film/dramas/${projectId}`, () => FilmApi.getDrama(projectId));
  const jobsQ = useAsync<PublishJob[]>(`/distribution/jobs?p=${projectId}`, () =>
    DistributionApi.listPublishJobs(projectId),
  );
  const artistsQ = useAsync<Artist[]>("/me/artists", () => ArtistsApi.listArtists());

  // 轮询任务（每 1.4s 拉一次，直到全部 live/failed）
  React.useEffect(() => {
    const t = setInterval(() => {
      const arr = jobsQ.data ?? [];
      if (arr.some((j) => j.status !== "live" && j.status !== "failed")) {
        jobsQ.refetch();
      }
    }, 1400);
    return () => clearInterval(t);
  }, [jobsQ]);

  const [advanceTarget, setAdvanceTarget] = React.useState<DramaStatus | null>(null);
  const [advancing, setAdvancing] = React.useState(false);

  if (dramaQ.isLoading) return <LoadingBlock rows={3} height={120} />;
  if (dramaQ.error) return <ErrorBlock onRetry={dramaQ.refetch} />;
  if (!dramaQ.data)
    return (
      <EmptyState
        title="项目不存在"
        action={
          <Button variant="primary" size="md" onClick={() => router.push("/projects")}>
            返回项目流水线
          </Button>
        }
      />
    );

  const d = dramaQ.data;
  const curIdx = STATUS_FLOW.indexOf(d.status);
  const nextStatus = curIdx >= 0 && curIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[curIdx + 1]! : null;

  async function advance() {
    if (!advanceTarget) return;
    setAdvancing(true);
    try {
      await FilmApi.updateDramaStatus(d.id, advanceTarget);
      invalidate(`/film/dramas/${d.id}`);
      invalidate("/film/dramas");
      toast.success(`已推进到「${STATUS_LABEL[advanceTarget]}」`);
      setAdvanceTarget(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "操作失败");
    } finally {
      setAdvancing(false);
    }
  }

  // 取剧集主演（在 mock 的 d.role 里找演员名匹配）
  const allArtists = artistsQ.data ?? [];
  const castInProject = allArtists.filter((a) => d.role.includes(a.name));
  const jobs = jobsQ.data ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <button
        onClick={() => router.push("/projects")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          fontSize: 12,
          color: "var(--fg-2)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          alignSelf: "flex-start",
        }}
      >
        <ArrowLeft size={12} /> 返回项目流水线
      </button>

      <ViewHeader
        eyebrow={`project · ${d.genre}`}
        title={d.title}
        meta={`${d.episodes > 0 ? `${d.episodes} 集` : "集数未定"} · ${d.role}`}
        action={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => router.push(`/projects/${encodeURIComponent(d.id)}/distribute`)}
            >
              <Share2 size={14} />
              发布到平台
            </Button>
            {nextStatus && (
              <Button variant="primary" size="md" onClick={() => setAdvanceTarget(nextStatus)}>
                推进到 {STATUS_LABEL[nextStatus]}
                <ArrowRight size={14} />
              </Button>
            )}
          </>
        }
      />

      {/* 状态机进度条 */}
      <Card style={{ padding: "22px 26px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {STATUS_FLOW.map((s, i) => {
            const done = i < curIdx;
            const current = i === curIdx;
            return (
              <React.Fragment key={s}>
                <div
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    background: current
                      ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                      : done
                        ? "rgba(76,224,160,0.08)"
                        : "rgba(255,255,255,0.02)",
                    border: current
                      ? "1px solid color-mix(in srgb, var(--accent) 40%, transparent)"
                      : "1px solid var(--line-2)",
                    borderRadius: "var(--radius-md)",
                    color: current ? "var(--accent)" : done ? "var(--success)" : "var(--fg-2)",
                  }}
                >
                  <div className="mono" style={{ fontSize: 10, letterSpacing: 0.5 }}>
                    STEP {i + 1}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: "var(--font-display)",
                      marginTop: 4,
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    {done && <Check size={13} />}
                    {STATUS_LABEL[s]}
                  </div>
                </div>
                {i < STATUS_FLOW.length - 1 && (
                  <ArrowRight size={14} color={i < curIdx ? "var(--success)" : "var(--fg-3)"} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KpiCard
          label="播放量"
          value={d.views > 0 ? `${(d.views / 1_000_000).toFixed(1)}M` : "—"}
          tone="info"
        />
        <KpiCard
          label="累计营收"
          value={d.revenue > 0 ? `¥${(d.revenue / 10_000).toFixed(1)}万` : "—"}
          tone="accent"
        />
        <KpiCard label="评分" value={d.rating > 0 ? d.rating.toFixed(1) : "—"} tone="success" />
        <KpiCard
          label="分发任务"
          value={`${jobs.filter((j) => j.status === "live").length}/${jobs.length}`}
          tone="violet"
          delta="live / 全部"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Card style={{ padding: "24px 26px" }}>
          <SectionHeader
            eyebrow="cast"
            title={
              <>
                <Users size={13} style={{ marginRight: 6 }} /> 演员 / 角色
              </>
            }
          />
          {artistsQ.isLoading && <LoadingBlock rows={2} height={48} />}
          {castInProject.length === 0 && (
            <EmptyState
              title="未匹配到平台演员"
              description={`主演字段：${d.role}（暂无平台 IP 绑定）。`}
            />
          )}
          {castInProject.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {castInProject.map((a) => (
                <button
                  key={a.id}
                  onClick={() => router.push(`/cast/${encodeURIComponent(a.id)}`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "var(--fg-0)",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "var(--bg-3)",
                      border: "1px solid var(--line-2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {a.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{a.name}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-3)" }}>
                      {a.type} · {a.quality}
                    </div>
                  </div>
                  <Chip tone={a.status === "active" ? "success" : "info"}>{a.status}</Chip>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card style={{ padding: "24px 26px" }}>
          <SectionHeader
            eyebrow="distribution"
            title={
              <>
                <Share2 size={13} style={{ marginRight: 6 }} /> 分发任务
              </>
            }
            right={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/projects/${encodeURIComponent(d.id)}/distribute`)}
              >
                <Plus size={11} />
                新发布
              </Button>
            }
          />
          {jobsQ.isLoading && <LoadingBlock rows={2} height={48} />}
          {!jobsQ.isLoading && jobs.length === 0 && (
            <EmptyState
              title="还没有发布任务"
              description="项目进入「后期」或「上线」后，可以推送到多个平台。"
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push(`/projects/${encodeURIComponent(d.id)}/distribute`)}
                >
                  <Share2 size={11} />
                  开始发布
                </Button>
              }
            />
          )}
          {jobs.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {jobs.map((j) => (
                <PublishJobRow key={j.id} job={j} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={!!advanceTarget}
        onOpenChange={(o) => !o && setAdvanceTarget(null)}
        title={`推进到「${advanceTarget ? STATUS_LABEL[advanceTarget] : ""}」`}
        description={`当前状态为「${STATUS_LABEL[d.status]}」。状态推进会通知关联团队成员。`}
        confirmLabel="确认推进"
        onConfirm={advance}
      />
    </div>
  );
}

function PublishJobRow({ job }: { job: PublishJob }) {
  const tone =
    job.status === "live"
      ? "success"
      : job.status === "failed"
        ? "danger"
        : job.status === "publishing"
          ? "accent"
          : "info";
  const label =
    {
      queued: "排队中",
      uploading: "上传中",
      transcoding: "转码中",
      publishing: "发布中",
      live: "已上线",
      failed: "失败",
    }[job.status] ?? job.status;
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{job.platformName}</div>
        <StatusBadge tone={tone}>{label}</StatusBadge>
      </div>
      <div
        style={{
          height: 4,
          background: "rgba(255,255,255,0.06)",
          borderRadius: "var(--radius-pill)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${job.progress}%`,
            height: "100%",
            background: job.status === "failed" ? "var(--danger)" : "var(--gradient-gold)",
            transition: "width 400ms ease",
          }}
        />
      </div>
      <div
        className="mono"
        style={{
          fontSize: 10.5,
          color: "var(--fg-3)",
          marginTop: 6,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>{job.progress}%</span>
        {job.externalUrl && (
          <a href={job.externalUrl} target="_blank" rel="noopener" style={{ color: "var(--accent)" }}>
            打开 ↗
          </a>
        )}
      </div>
    </div>
  );
}
