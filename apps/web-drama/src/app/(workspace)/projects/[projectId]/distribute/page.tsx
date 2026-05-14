"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Send, X as XIcon } from "lucide-react";
import type { Drama } from "@ai-star-eco/types/film";
import type { Platform } from "@ai-star-eco/types/distribution";
import type { PublishJob } from "@/types/publish-job";
import { Button, Card, Chip } from "@/components/premium";
import {
  EmptyState,
  ErrorBlock,
  Field,
  LoadingBlock,
  SectionHeader,
  StatusBadge,
  TextInput,
  ViewHeader,
} from "@/components/common";
import { DistributionApi, FilmApi } from "@/api";
import { useAsync, invalidate } from "@/lib/drama-query";
import { ApiError } from "@ai-star-eco/api-client";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default function DistributePage({ params }: PageProps) {
  const { projectId } = React.use(params);
  const router = useRouter();

  const dramaQ = useAsync<Drama | null>(`/film/dramas/${projectId}`, () => FilmApi.getDrama(projectId));
  const platformsQ = useAsync<Platform[]>("/distribution/platforms", () =>
    DistributionApi.listPlatforms(),
  );
  const jobsQ = useAsync<PublishJob[]>(`/distribution/jobs?p=${projectId}`, () =>
    DistributionApi.listPublishJobs(projectId),
  );

  // 轮询
  React.useEffect(() => {
    const t = setInterval(() => {
      const arr = jobsQ.data ?? [];
      if (arr.some((j) => j.status !== "live" && j.status !== "failed")) {
        jobsQ.refetch();
      }
    }, 1300);
    return () => clearInterval(t);
  }, [jobsQ]);

  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  if (dramaQ.isLoading) return <LoadingBlock rows={3} height={120} />;
  if (dramaQ.error) return <ErrorBlock onRetry={dramaQ.refetch} />;
  if (!dramaQ.data) {
    return (
      <EmptyState
        title="项目不存在"
        action={
          <Button variant="primary" size="md" onClick={() => router.push("/projects")}>
            返回流水线
          </Button>
        }
      />
    );
  }

  const drama = dramaQ.data;
  const platforms = (platformsQ.data ?? []).filter((p) => p.category === "video" || p.category === "social");
  const jobs = jobsQ.data ?? [];

  // 已发布过的平台 id（避免重复）
  const publishedPlatformIds = new Set(
    jobs.filter((j) => j.status === "live" || j.status === "publishing").map((j) => j.platformId),
  );

  function togglePlatform(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (picked.size === 0) {
      toast.error("请至少选择一个平台");
      return;
    }
    setSubmitting(true);
    let ok = 0;
    for (const pid of picked) {
      const p = platforms.find((x) => x.id === pid);
      if (!p) continue;
      try {
        await DistributionApi.createPublishJob({
          projectId: drama.id,
          platformId: p.id,
          platformName: p.name,
          scheduledAt: scheduledAt || undefined,
        });
        ok++;
      } catch (e) {
        toast.error(e instanceof ApiError ? `${p.name}: ${e.message}` : `${p.name} 发布失败`);
      }
    }
    invalidate(`/distribution/jobs?p=${projectId}`);
    setPicked(new Set());
    setSubmitting(false);
    if (ok > 0) toast.success(`已创建 ${ok} 个发布任务`);
  }

  async function cancelJob(id: string) {
    try {
      await DistributionApi.cancelPublishJob(id);
      invalidate(`/distribution/jobs?p=${projectId}`);
      toast.success("已取消");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "取消失败");
    }
  }

  async function retryJob(id: string) {
    try {
      await DistributionApi.retryPublishJob(id);
      invalidate(`/distribution/jobs?p=${projectId}`);
      toast.success("已重启");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "重启失败");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <button
        onClick={() => router.push(`/projects/${encodeURIComponent(drama.id)}`)}
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
        <ArrowLeft size={12} /> 返回项目详情
      </button>

      <ViewHeader
        eyebrow="distribute"
        title={
          <>
            发布{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              {drama.title}
            </span>
          </>
        }
        meta="勾选平台 · 选填排期 · 一次性下发"
      />

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Card style={{ padding: "22px 24px" }}>
          <SectionHeader
            eyebrow="platforms"
            title={`选择平台（已选 ${picked.size}）`}
            right={
              picked.size > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setPicked(new Set())}>
                  清除
                </Button>
              )
            }
          />
          {platformsQ.isLoading && <LoadingBlock rows={2} height={56} />}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {platforms.map((p) => {
              const checked = picked.has(p.id);
              const already = publishedPlatformIds.has(p.id);
              const disabled = p.status !== "connected" || already;
              return (
                <button
                  key={p.id}
                  onClick={() => !disabled && togglePlatform(p.id)}
                  disabled={disabled}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    borderRadius: "var(--radius-md)",
                    border: checked
                      ? "1px solid color-mix(in srgb, var(--accent) 40%, transparent)"
                      : "1px solid var(--line-2)",
                    background: checked
                      ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                      : "rgba(255,255,255,0.02)",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.5 : 1,
                    color: "var(--fg-0)",
                    fontFamily: "var(--font-sans)",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 22 }}>{p.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--fg-3)" }}>
                      {p.followers} · {already ? "已发布" : p.status}
                    </div>
                  </div>
                  {checked && <Chip tone="accent">已选</Chip>}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 18 }}>
            <Field
              label="排期（可选）"
              hint="留空则立即下发；填写 ISO 时间将进入排队（mock 仍立即触发）。"
            >
              <TextInput
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </Field>
            <Button variant="primary" size="md" loading={submitting} onClick={submit}>
              <Send size={13} />
              提交发布 ({picked.size})
            </Button>
          </div>
        </Card>

        {/* 任务列表 */}
        <Card style={{ padding: "22px 24px" }}>
          <SectionHeader eyebrow="recent jobs" title={`任务（${jobs.length}）`} />
          {jobs.length === 0 && (
            <EmptyState title="还没有发布任务" description="左侧选择平台后提交。" />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {jobs.map((j) => {
              const tone =
                j.status === "live"
                  ? "success"
                  : j.status === "failed"
                    ? "danger"
                    : j.status === "publishing"
                      ? "accent"
                      : "info";
              const label =
                {
                  queued: "排队",
                  uploading: "上传",
                  transcoding: "转码",
                  publishing: "发布",
                  live: "已上线",
                  failed: "失败",
                }[j.status] ?? j.status;
              return (
                <div
                  key={j.id}
                  style={{
                    padding: "12px 14px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500 }}>{j.platformName}</span>
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
                        width: `${j.progress}%`,
                        height: "100%",
                        background: j.status === "failed" ? "var(--danger)" : "var(--gradient-gold)",
                        transition: "width 400ms ease",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 8,
                      gap: 6,
                    }}
                  >
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--fg-3)" }}>
                      {j.progress}%
                    </span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {j.status === "failed" && (
                        <Button variant="ghost" size="sm" onClick={() => retryJob(j.id)}>
                          重试
                        </Button>
                      )}
                      {j.status !== "live" && j.status !== "failed" && (
                        <Button variant="ghost" size="sm" onClick={() => cancelJob(j.id)}>
                          <XIcon size={11} />
                        </Button>
                      )}
                      {j.externalUrl && (
                        <a
                          href={j.externalUrl}
                          target="_blank"
                          rel="noopener"
                          style={{
                            fontSize: 11,
                            color: "var(--accent)",
                            fontFamily: "var(--font-mono)",
                            textDecoration: "none",
                          }}
                        >
                          打开 ↗
                        </a>
                      )}
                    </div>
                  </div>
                  {j.errorMessage && (
                    <div style={{ marginTop: 6, fontSize: 11, color: "var(--danger)" }}>
                      {j.errorMessage}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
