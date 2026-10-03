"use client";

export const dynamic = "force-dynamic";

// /projects/<id>/distribute —— 把一部短剧发到各平台。
// v0.197（docs/drama-ux-copy-pass.md §3.1 / §3.3）：
// - 发布到平台还没接通：服务端是模拟推进（连接不绑真账号，发布记录会自己变成「已发布」，外链是示例域名）。
//   页面顶部如实说明，外链不再显示。
// - 这页读的是旧 film 数据（FilmApi.getDrama）。在工作台里做的短剧没有这份数据 → 如实空态，
//   给「回到这部短剧 / 回我的短剧」，不再是「项目不存在 · 返回流水线」。
// - 平台卡与主栅格用 class + auto-fit（styles/pages/episode.css 的 .ep-dist-*），不靠全局折叠规则。
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Info, Send, X as XIcon } from "lucide-react";
import type { Drama } from "@ai-star-eco/types/film";
import type { Platform } from "@ai-star-eco/types/distribution";
import type { PublishJob } from "@ai-star-eco/types/publish-job";
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
// 发布状态文案全站一份（与 /distribution 同一张表），别在页面里再写本地表。
import { PLATFORM_STATUS_LABEL, PUBLISH_JOB_STATUS_LABEL } from "@/constants/publish-job-ui";

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
      if (arr.some((j) => j.status !== "live" && j.status !== "failed" && j.status !== "cancelled")) {
        jobsQ.refetch();
      }
    }, 1300);
    return () => clearInterval(t);
  }, [jobsQ]);

  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const backToProject = () => router.push(`/projects/${encodeURIComponent(projectId)}`);

  if (dramaQ.isLoading) return <LoadingBlock rows={3} height={120} />;
  // 404 = 这部短剧没有旧 film 数据（在工作台里做的都是这样），走下面的如实空态；其余才算加载失败。
  const notFound = dramaQ.error instanceof ApiError && dramaQ.error.status === 404;
  if (dramaQ.error && !notFound) return <ErrorBlock onRetry={dramaQ.refetch} />;
  if (!dramaQ.data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
        <EmptyState
          icon={<Send size={22} />}
          title="发布到平台还没上线"
          description="发到抖音、快手等平台的功能还在接。做好的成片可以先在这部短剧的「合成成片」里下载。"
          action={
            <>
              <Button variant="primary" size="md" onClick={backToProject}>
                回到这部短剧
              </Button>
              <Button variant="ghost" size="md" onClick={() => router.push("/projects")}>
                回我的短剧
              </Button>
            </>
          }
        />
      </div>
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
      toast.error("先选至少一个平台");
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
        toast.error(e instanceof ApiError ? `${p.name}：${e.message}` : `${p.name} 发布失败`);
      }
    }
    invalidate(`/distribution/jobs?p=${projectId}`);
    setPicked(new Set());
    setSubmitting(false);
    if (ok > 0) toast.success(`已提交到 ${ok} 个平台`);
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
      toast.success("已重新提交");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "重试失败");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
      {/* 旧 film 数据没有对应的工作台（/projects/<id> 打开是空的），回列表页 */}
      <button
        type="button"
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
        <ArrowLeft size={12} style={{ flexShrink: 0 }} /> 回我的短剧
      </button>

      <ViewHeader
        eyebrow="多平台发布"
        title={
          <>
            发布{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400, overflowWrap: "anywhere" }}
            >
              {drama.title}
            </span>
          </>
        }
        meta="选好平台，想定时就填个时间，一次发出去"
      />

      <div className="ep-dist-banner" role="note">
        <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>发布到平台还没接通：连接不会绑定你的平台账号，发布记录也不会真的发出去。</span>
      </div>

      <div className="ep-dist-main">
        <Card style={{ padding: "20px 22px", minWidth: 0 }}>
          <SectionHeader
            eyebrow="平台"
            title={`选择平台（已选 ${picked.size}）`}
            right={
              picked.size > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setPicked(new Set())}>
                  清空
                </Button>
              )
            }
          />
          {platformsQ.isLoading && <LoadingBlock rows={2} height={56} />}
          <div className="ep-dist-platforms">
            {platforms.map((p) => {
              const checked = picked.has(p.id);
              const already = publishedPlatformIds.has(p.id);
              const disabled = p.status !== "connected" || already;
              const statusText = already ? "已发布" : PLATFORM_STATUS_LABEL[p.status] ?? "未连接";
              const showFollowers = !!p.followers && p.followers !== "-" && p.followers !== "—";
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => !disabled && togglePlatform(p.id)}
                  disabled={disabled}
                  aria-pressed={checked}
                  title={p.status !== "connected" && !already ? "这个平台还没连接，先在「多平台发布」里连接" : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    minHeight: 56,
                    minWidth: 0,
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
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{p.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.name}>{p.name}</div>
                    <div style={{ fontSize: 10.5, color: "var(--fg-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {showFollowers ? `${p.followers} · ` : ""}{statusText}
                    </div>
                  </div>
                  {checked && <Chip tone="accent">已选</Chip>}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 18 }}>
            <Field
              label="定时发布（选填）"
              hint="不填就马上发；填了时间，会到点自动发。"
            >
              <TextInput
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </Field>
            <Button variant="primary" size="md" loading={submitting} onClick={submit}>
              <Send size={13} style={{ flexShrink: 0 }} />
              {picked.size > 0 ? `发布到 ${picked.size} 个平台` : "发布"}
            </Button>
          </div>
        </Card>

        {/* 发布记录 */}
        <Card style={{ padding: "20px 22px", minWidth: 0 }}>
          <SectionHeader eyebrow="记录" title={`发布记录（${jobs.length}）`} />
          {jobs.length === 0 && (
            <EmptyState title="还没有发布记录" description="选好平台点「发布」，进度会显示在这里。" />
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
              const label = PUBLISH_JOB_STATUS_LABEL[j.status] ?? "处理中";
              return (
                <div
                  key={j.id}
                  style={{
                    padding: "12px 14px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-md)",
                    minWidth: 0,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={j.platformName}>{j.platformName}</span>
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
                      alignItems: "center",
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
                      {j.status !== "live" && j.status !== "failed" && j.status !== "cancelled" && (
                        <Button variant="ghost" size="sm" onClick={() => cancelJob(j.id)} aria-label="取消发布" title="取消发布">
                          <XIcon size={11} />
                        </Button>
                      )}
                      {/* 外链（j.externalUrl）不显示：发布还是模拟的，链接指向示例域名，点开是假的。 */}
                    </div>
                  </div>
                  {j.errorMessage && (
                    <div style={{ marginTop: 6, fontSize: 11, color: "var(--danger)", overflowWrap: "anywhere" }}>
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
