"use client";

import { forwardRef, useEffect, useRef, useState, type ForwardedRef, type ReactNode } from "react";
import { notFound, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  PlayCircle,
  PauseCircle,
  Copy,
  Sparkles,
  ShieldCheck,
  Layers,
  Wand2,
  Fingerprint,
  Send,
  Bookmark,
} from "lucide-react";
import { BatchPublishDrawer } from "@/components/mixcut-zone/BatchPublishDrawer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/mixcut-zone/ui/card";
import { Button } from "@/components/mixcut-zone/ui/button";
import { Badge } from "@/components/mixcut-zone/ui/badge";
import { Separator } from "@/components/mixcut-zone/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/mixcut-zone/ui/tabs";
import { TemplatePreview } from "@/components/mixcut-zone/template-preview";
import { MixcutApi } from "@/api";
import { mockTemplates, mockStarClips } from "@/mocks/mixcut";
import type { RenderJob, RenderOutput } from "@/components/mixcut-zone/types";
import { PROFILE_LABELS, TRANSFORM_LABELS } from "@/constants/mixcut-ui";
import { cn, formatBytes, relativeTime, shortHash } from "@/components/mixcut-zone/lib/utils";
import { flatSlotsOf } from "@/components/mixcut-zone/lib/scene-helpers";

/** v0.50+: 播放/预览走 inline media URL；下载点击时向后端换 attachment URL。 */
function outputVideoSrc(o: RenderOutput): string {
  return normalizeMediaUrl(o.cdn_url || o.file_url);
}
function outputPoster(o: RenderOutput): string | undefined {
  return normalizeMediaUrl(o.cdn_thumbnail_url || o.thumbnail_url || undefined) || undefined;
}
function normalizeMediaUrl(url?: string): string {
  if (!url) return "";
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    url.startsWith("http://")
  ) {
    return "https://" + url.substring("http://".length);
  }
  return url;
}
function outputDownloadFilename(job: RenderJob, output: RenderOutput): string {
  const jobId = job.id.replace(/[^A-Za-z0-9._-]/g, "_");
  return `${job.template_name || "mixcut"}-${jobId}-v${output.variant_index + 1}.mp4`;
}

export function JobDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [job, setJob] = useState<RenderJob | null | undefined>(undefined); // undefined = loading
  const [selectedVariant, setSelectedVariant] = useState(0);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  /** v0.15+: 批量发布抽屉开关 */
  const [publishOpen, setPublishOpen] = useState(false);
  /** v0.50+: 正在创建实例中（从任务重跑入口） */
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [downloadingOutputId, setDownloadingOutputId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      MixcutApi.getJob(id).then((j) => {
        if (cancelled) return;
        setJob(j);
      });
    };
    tick();
    // 渲染中持续刷新；success 但 outputs 未同步完整时继续短轮询。
    const timer = setInterval(() => {
      const outputCount = job?.outputs?.length ?? 0;
      const outputsIncomplete =
        job?.status === "success" && !job.error_message && outputCount < Math.max(1, job.output_variants);
      if (
        job?.status === "running" ||
        job?.status === "queued" ||
        job?.status === "pending" ||
        outputsIncomplete
      ) {
        tick();
      }
    }, 800);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id, job?.status, job?.outputs?.length, job?.output_variants]);

  // 切换变体时,把当前 video 暂停并回到第 0 秒(下一帧渲染时换 src,但要保证状态干净)
  useEffect(() => {
    const v = previewVideoRef.current;
    if (!v) return;
    v.pause();
    setIsPlaying(false);
  }, [selectedVariant]);

  useEffect(() => {
    const outputCount = job?.outputs?.length ?? 0;
    if (outputCount > 0 && selectedVariant >= outputCount) {
      // 选中的变体超出已生成范围（例如用户在 skeleton 上点过，或之前显示的变体被重渲了），
      // 回退到最后一条已完成的（按 variant_index 排序）
      setSelectedVariant(outputCount - 1);
    }
  }, [job?.outputs?.length, selectedVariant]);

  if (job === undefined) {
    return (
      <div className="px-6 lg:px-8 py-12 max-w-[1600px] mx-auto text-center text-muted-foreground text-sm">
        加载中…
      </div>
    );
  }
  if (job === null) notFound();

  const outputs = job.outputs ?? [];
  const hasOutputs = outputs.length > 0;
  // 后端渲染 worker 是并发的（@Async + 多线程），outputs 可能不是按 variant_index 顺序入库。
  // 网格 / 占位 / 主预览全部按 variant_index 排序，让"第 N 条"语义稳定。
  const sortedOutputs = [...outputs].sort((a, b) => a.variant_index - b.variant_index);
  const totalExpected = Math.max(job.output_variants || 0, outputs.length);
  const pendingCount = Math.max(0, totalExpected - outputs.length);
  const renderFailed =
    job.status === "failed" ||
    (job.status === "success" && !hasOutputs && Boolean(job.error_message));
  const template = mockTemplates.find((t) => t.template_id === job.template_id);
  const isProcessing = !renderFailed && (job.status === "running" || job.status === "queued" || job.status === "pending");
  const completed = job.status === "success" && !renderFailed;

  async function handleDownload(currentJob: RenderJob, output: RenderOutput) {
    setDownloadingOutputId(output.id);
    setDownloadError(null);
    try {
      const href = normalizeMediaUrl(await MixcutApi.getOutputDownloadUrl(output.id));
      if (!href) throw new Error("下载地址不可用");
      const a = document.createElement("a");
      a.href = href;
      a.download = outputDownloadFilename(currentJob, output);
      a.target = "_blank";
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "下载失败");
    } finally {
      setDownloadingOutputId(null);
    }
  }

  async function handleContinueEdit() {
    const currentJob = job;
    if (!currentJob) return;
    setCreatingDraft(true);
    try {
      const draft = await MixcutApi.createDraftFromJob(currentJob.id);
      router.push(
        `/mixcut/create/${encodeURIComponent(currentJob.template_id)}?draft_id=${encodeURIComponent(draft.id)}`,
      );
    } catch (e) {
      console.error("创建实例失败:", e);
      setCreatingDraft(false);
    }
  }

  const outputsPending = completed && !hasOutputs;
  const stillRendering = isProcessing && pendingCount > 0;
  const displayStatus = renderFailed ? "failed" : job.status;

  return (
    <div className="mobile-editor-page px-4 md:px-6 lg:px-8 py-5 md:py-6 max-w-[1600px] mx-auto">
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/mixcut/jobs">
            <ArrowLeft className="size-4" /> 返回任务列表
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <StatusBadge status={displayStatus} />
            <Badge variant="muted" className="text-[10px]">{PROFILE_LABELS[job.perturbation_profile]}</Badge>
            <Badge variant="muted" className="text-[10px]">{job.output_variants} 条</Badge>
            {/* v0.30+: 任务血缘 —— 由「重跑」入口 fork 出来的任务，标出原任务来源 */}
            {job.forked_from_job_id && (
              <Link
                href={`/mixcut/jobs/${encodeURIComponent(job.forked_from_job_id)}`}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                title="点击查看原任务"
              >
                <RefreshCw className="size-2.5" />
                由 #{job.forked_from_job_id.slice(-6)} 再生成
              </Link>
            )}
            {/* v0.48+: 实例血缘 —— 由「实例 / 草稿」生成的任务，深链回去继续编辑该实例 */}
            {job.draft_id && (
              <Link
                href={`/mixcut/create/${encodeURIComponent(job.template_id)}?draft_id=${encodeURIComponent(job.draft_id)}`}
                className="inline-flex items-center gap-1 rounded-full border border-violet-400/40 bg-violet-500/[0.06] px-2 py-0.5 text-[10px] text-violet-700 hover:border-violet-500/60 transition-colors"
                title="点击回到该实例继续编辑"
              >
                <Bookmark className="size-2.5" />
                来自实例
              </Link>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{job.template_name}</h1>
          <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
            <span className="font-mono">{job.id}</span>
            <Button
              variant="ghost"
              size="icon"
              className="mobile-icon-target size-5"
              onClick={() => {
                void navigator.clipboard?.writeText(job.id);
              }}
              title="复制任务 ID"
            >
              <Copy className="size-3" />
            </Button>
            <span>·</span>
            <span>创建于 {relativeTime(job.created_at)}</span>
          </div>
        </div>
        <div className="mobile-editor-actions flex items-center gap-2">
          {completed && hasOutputs && (
            <>
              <Button variant="gradient" onClick={() => setPublishOpen(true)}>
                <Send className="size-4" /> 批量分发
              </Button>
              {/* v0.16: 引导用户认识统一出口 — 分发中心。 */}
              <Button variant="ghost" asChild>
                <Link href={`/distribution?from_job=${encodeURIComponent(job.id)}`}>
                  去分发中心 →
                </Link>
              </Button>
            </>
          )}
          {/*
            v0.50+: 重跑入口（改进）—— completed 与 failed 任务都显示。
            v0.30 原设计直接弹 dialog 选 variants/profile 后立即生成新任务。
            v0.50 改为跳转到 create 页面（带实例 ID），让用户可以查看/修改全部配置后再决定生成。
            这样重跑的行为与「从草稿编辑」一致：任务完成后可以回到编辑态继续调整。
          */}
          {(completed || renderFailed) && (
            <Button
              variant={renderFailed ? "gradient" : "outline"}
              disabled={creatingDraft}
              onClick={handleContinueEdit}
              title="跳转到编辑页面，可以查看/修改配置后再生成"
            >
              {creatingDraft ? (
                <Wand2 className="size-4 animate-pulse" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {creatingDraft ? "准备中…" : "继续编辑 / 再生成"}
            </Button>
          )}
          {renderFailed && (
            <Button
              variant="ghost"
              onClick={() => router.push(`/mixcut/create/${encodeURIComponent(job.template_id)}`)}
              title="基于模板默认值换一组素材，从头开始做"
            >
              换素材重做 →
            </Button>
          )}
        </div>
      </div>

      <div className="mobile-bottom-actionbar md:hidden">
        <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
          <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-muted-foreground">
            <StatusBadge status={displayStatus} />
            <span className="truncate">
              {completed && hasOutputs
                ? `${outputs.length}/${totalExpected} 条成片`
                : renderFailed
                  ? "生成未成功"
                  : isProcessing
                    ? `生成中 ${job.progress}%`
                    : "等待成片"}
            </span>
          </span>
          <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
            {relativeTime(job.created_at)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {completed && hasOutputs ? (
            <Button variant="gradient" className="h-11 px-2" onClick={() => setPublishOpen(true)}>
              <Send className="size-4" /> 批量分发
            </Button>
          ) : renderFailed ? (
            <Button
              variant="gradient"
              className="h-11 px-2"
              onClick={() => router.push(`/mixcut/create/${encodeURIComponent(job.template_id)}`)}
            >
              <RefreshCw className="size-4" /> 重做
            </Button>
          ) : (
            <Button variant="outline" className="h-11 px-2" asChild>
              <Link href="/mixcut/jobs">
                <ArrowLeft className="size-4" /> 任务列表
              </Link>
            </Button>
          )}
          {(completed || renderFailed) ? (
            <Button
              variant="outline"
              className="h-11 px-2"
              disabled={creatingDraft}
              onClick={handleContinueEdit}
              title="跳转到编辑页面，可以查看/修改配置后再生成"
            >
              {creatingDraft ? (
                <Wand2 className="size-4 animate-pulse" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {creatingDraft ? "准备中" : "继续编辑"}
            </Button>
          ) : (
            <Button variant="ghost" className="h-11 px-2" disabled>
              <Clock className="size-4" /> 自动刷新
            </Button>
          )}
        </div>
        {completed && hasOutputs && (
          <Link
            href={`/distribution?from_job=${encodeURIComponent(job.id)}`}
            className="mt-2 flex min-h-10 items-center justify-center rounded-md border border-border bg-card px-3 text-xs font-medium text-muted-foreground"
          >
            去分发中心 →
          </Link>
        )}
      </div>

      {isProcessing && (
        <Card className="mb-6 overflow-hidden">
          <div className="relative h-1 bg-secondary">
            <div
              className="absolute inset-y-0 left-0 bg-violet-500 transition-all"
              style={{ width: `${job.progress}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-white/30 animate-shimmer"
              style={{ width: "20%", transform: `translateX(${job.progress}%)` }}
            />
          </div>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-violet-500/10 grid place-items-center">
                <Wand2 className="size-5 text-violet-500 animate-pulse" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">
                  {job.status === "queued" ? "准备中，马上开始…" : "生成中…"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {progressStage(job.progress)} · 预计还需 {Math.max(1, Math.ceil((100 - job.progress) * 0.4))} 秒
                </div>
              </div>
              <div className="text-2xl font-mono font-semibold tabular-nums">{job.progress}%</div>
            </div>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STAGES.map((s, idx) => {
                const startProgress = idx * 25;
                const active = job.progress >= startProgress;
                const current = job.progress >= startProgress && job.progress < (idx + 1) * 25;
                return (
                  <div
                    key={s.label}
                    className={cn(
                      "rounded-md border p-2",
                      active ? "border-violet-500/40 bg-violet-500/5" : "border-border",
                      current && "ring-1 ring-violet-500/40"
                    )}
                  >
                    <div className="flex items-center gap-1 text-[10px] font-medium">
                      {active ? <CheckCircle2 className="size-3 text-emerald-500" /> : <div className="size-3 rounded-full border border-muted-foreground" />}
                      {s.label}
                    </div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">{s.desc}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {renderFailed && (
        <Card className="mb-6 border-red-500/30 bg-red-500/[0.03]">
          <CardContent className="p-5 flex items-start gap-3">
            <AlertCircle className="size-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-sm text-red-400">生成未成功</div>
              <div className="text-xs text-muted-foreground mt-1">{job.error_message}</div>
              <div className="text-xs text-muted-foreground mt-2">
                · 本次消耗的积分已自动退回到你的钱包
                <br />· 可以更换素材后再试，或联系客服
              </div>
            </div>
            <Button
              variant="gradient"
              size="sm"
              onClick={() => router.push(`/mixcut/create/${encodeURIComponent(job.template_id)}`)}
              title="用相同模板重新生成一批"
            >
              <RefreshCw className="size-3" /> 重新生成
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        <div>
          <Tabs defaultValue="outputs">
            <TabsList className="mobile-scroll-tabs h-auto">
              <TabsTrigger value="outputs" className="mobile-touch-target">
                <span className="inline-flex items-center gap-1.5">
                  成片
                  <span className="text-[10px] font-mono opacity-70">
                    {outputs.length}/{totalExpected}
                  </span>
                  {stillRendering && (
                    <span
                      className="relative inline-flex h-1.5 w-1.5"
                      aria-label="生成中"
                      title="还有视频正在生成中"
                    >
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-500" />
                    </span>
                  )}
                </span>
              </TabsTrigger>
              <TabsTrigger value="bindings" className="mobile-touch-target">素材明细</TabsTrigger>
              <TabsTrigger value="perturbations" className="mobile-touch-target">每条处理对比</TabsTrigger>
              <TabsTrigger value="phash" className="mobile-touch-target">差异分析</TabsTrigger>
              <TabsTrigger value="watermark" className="mobile-touch-target">水印保护</TabsTrigger>
            </TabsList>

            <TabsContent value="outputs">
              {hasOutputs ? (
                <div className="space-y-4">
                  {/* 增量进度摘要：仅在还在渲染中时显示，引导用户知道还会有新条目出现 */}
                  {stillRendering && (
                    <Card className="border-violet-500/20 bg-violet-500/[0.03]">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="size-8 rounded-full bg-violet-500/10 grid place-items-center shrink-0">
                          <Wand2 className="size-4 text-violet-500 animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">
                            已完成 {outputs.length} / {totalExpected} 条，还有 {pendingCount} 条正在生成…
                          </div>
                          <div className="mt-1.5 h-1 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full bg-violet-500 transition-all"
                              style={{ width: `${(outputs.length / totalExpected) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                          每条完成会立即显示
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardContent className="p-5">
                      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5">
                        <div>
                          {(() => {
                            const safeIdx = Math.min(selectedVariant, sortedOutputs.length - 1);
                            const o = sortedOutputs[safeIdx];
                            return (
                              <VariantVideoPreview
                                key={o.id}
                                ref={previewVideoRef}
                                src={outputVideoSrc(o)}
                                poster={outputPoster(o)}
                                isPlaying={isPlaying}
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                                onEnded={() => setIsPlaying(false)}
                                fallback={
                                  template ? (
                                    <TemplatePreview
                                      template={template}
                                      bindings={job.slot_bindings}
                                      showSlotChrome={false}
                                      variantSeed={o.variant_index}
                                    />
                                  ) : null
                                }
                              />
                            );
                          })()}
                        </div>
                        <div className="space-y-3">
                          {(() => {
                            const safeIdx = Math.min(selectedVariant, sortedOutputs.length - 1);
                            const o = sortedOutputs[safeIdx];
                            const variantLabel = o.variant_index + 1;
                            return (
                              <>
                                <div>
                                  <div className="text-xs text-muted-foreground">当前预览</div>
                                  <div className="text-lg font-semibold mt-0.5">第 {variantLabel} 条</div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <Stat label="与原片差异度" value={`${o.phash_distance_to_source} 分`} highlight={o.phash_distance_to_source >= 10} />
                                  <Stat label="文件大小" value={formatBytes(o.file_size)} />
                                  <Stat label="时长" value={`${o.duration} 秒`} />
                                  <Stat label="防伪水印" value={shortHash(o.watermark_token, 10)} mono />
                                </div>
                                <Separator />
                                <div>
                                  <div className="text-xs text-muted-foreground mb-2">这条做了哪些处理</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(o.applied_transforms).map(([k, v]) => {
                                      if (k === "slot_jitter" || k === "overlays_detail" || k === "segments_detail" || k === "overrides" || v == null || v === false) return null;
                                      const label = TRANSFORM_LABELS[k] ?? k;
                                      return (
                                        <Badge key={k} variant="muted" className="text-[10px]">
                                          {label}: {formatTransformValue(k, v)}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 pt-2">
                                  <Button
                                    variant="gradient"
                                    className="flex-1"
                                    disabled={downloadingOutputId === o.id}
                                    onClick={() => void handleDownload(job, o)}
                                  >
                                    <Download className="size-4" />
                                    {downloadingOutputId === o.id ? "下载中" : "下载这条"}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      const v = previewVideoRef.current;
                                      if (!v) return;
                                      if (v.paused) {
                                        void v.play();
                                      } else {
                                        v.pause();
                                      }
                                    }}
                                  >
                                    {isPlaying ? (
                                      <>
                                        <PauseCircle className="size-4" /> 暂停
                                      </>
                                    ) : (
                                      <>
                                        <PlayCircle className="size-4" /> 播放
                                      </>
                                    )}
                                  </Button>
                                </div>
                                {downloadError ? (
                                  <div className="text-xs text-destructive">{downloadError}</div>
                                ) : null}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 缩略图网格：已完成 + 待生成 skeleton 占位 */}
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {sortedOutputs.map((o, idx) => (
                      <div
                        key={o.id}
                        className={cn(
                          "group relative rounded-lg overflow-hidden transition-all aspect-[9/16] bg-secondary/60",
                          selectedVariant === idx
                            ? "ring-2 ring-violet-500 ring-offset-2 ring-offset-background"
                            : "hover:ring-2 hover:ring-white/30"
                        )}
                      >
                        <button
                          onClick={() => setSelectedVariant(idx)}
                          className="absolute inset-0 w-full h-full"
                          aria-label={`选择第 ${o.variant_index + 1} 条视频`}
                        >
                          <VariantThumbnail src={outputVideoSrc(o)} poster={outputPoster(o)} />
                          <div className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                            <PlayCircle className="size-7 text-white/90" />
                          </div>
                        </button>
                        {/* 下载按钮 - 右上角悬浮，点击区域足够大适合手机操作 */}
                        <a
                          href={outputVideoSrc(o)}
                          download={`${job.template_name || "mixcut"}-v${o.variant_index + 1}.mp4`}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute top-1.5 right-1.5 z-10 size-9 rounded-full bg-black/60 backdrop-blur-sm grid place-items-center text-white/90 hover:bg-black/80 hover:text-white active:scale-95 transition-all shadow-lg"
                          title={`下载第 ${o.variant_index + 1} 条`}
                          aria-label={`下载第 ${o.variant_index + 1} 条视频`}
                        >
                          <Download className="size-4" />
                        </a>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-2 flex items-center justify-between pointer-events-none">
                          <span className="text-[10px] text-white">第 {o.variant_index + 1} 条</span>
                          <Badge variant="success" className="text-[9px]">
                            变化 {o.phash_distance_to_source}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {pendingCount > 0 &&
                      Array.from({ length: pendingCount }).map((_, i) => (
                        <PendingVariantTile
                          key={`pending-${i}`}
                          label={`第 ${outputs.length + i + 1} 条`}
                        />
                      ))}
                  </div>
                </div>
              ) : (
                // 完全没有 outputs 时的过渡态：等待第一条出来
                <Card>
                  <CardContent className="p-8">
                    {outputsPending || isProcessing ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-lg bg-violet-500/10 grid place-items-center shrink-0">
                            <Wand2 className="size-5 text-violet-500 animate-pulse" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              {outputsPending ? "生成已完成，正在导出成片文件…" : "正在生成第一条，稍后自动出现"}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              共 {totalExpected} 条，每条完成会立即显示
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                          {Array.from({ length: Math.min(totalExpected, 10) }).map((_, i) => (
                            <PendingVariantTile key={`empty-${i}`} label={`第 ${i + 1} 条`} />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground text-sm">还没有成片</div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="bindings">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">每个位置填的什么</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(job.slot_bindings).map(([slotId, b]) => {
                    const slot = template ? flatSlotsOf(template).find((s) => s.slot_id === slotId) : undefined;
                    return (
                      <div key={slotId} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{slot?.label || slotId}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {b.source === "input" && `手填文字："${b.text}"`}
                            {b.source === "library" && `来自素材库：${(() => {
                              const s = mockStarClips.find((x) => x.id === b.asset_id);
                              return s ? s.star_name : "已选素材";
                            })()}`}
                            {b.source === "upload" && `自己上传：${uploadBindingLabel(b)}`}
                            {b.source === "fixed" && "系统自动填充"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="perturbations">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>每条视频应用的处理</span>
                    {stillRendering && (
                      <span className="text-[11px] font-normal text-muted-foreground inline-flex items-center gap-1.5">
                        <span className="relative inline-flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-500" />
                        </span>
                        生成中 {outputs.length}/{totalExpected}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {hasOutputs || stillRendering ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground">
                            <th className="text-left py-2 px-2 font-medium">版本</th>
                            <th className="text-left py-2 px-2 font-medium">裁剪</th>
                            <th className="text-left py-2 px-2 font-medium">左右翻转</th>
                            <th className="text-left py-2 px-2 font-medium">速度</th>
                            <th className="text-left py-2 px-2 font-medium">亮度</th>
                            <th className="text-left py-2 px-2 font-medium">色彩</th>
                            <th className="text-left py-2 px-2 font-medium">差异度</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedOutputs.map((o) => (
                            <tr key={o.id} className="border-b border-border/50">
                              <td className="py-2 px-2">第 {o.variant_index + 1} 条</td>
                              <td className="py-2 px-2">{o.applied_transforms.crop || "—"}</td>
                              <td className="py-2 px-2">{o.applied_transforms.mirror ? "已翻转" : "—"}</td>
                              <td className="py-2 px-2 font-mono">{o.applied_transforms.speed?.toFixed(2)}×</td>
                              <td className="py-2 px-2 font-mono">{formatBrightness(o.applied_transforms.brightness)}</td>
                              <td className="py-2 px-2 font-mono">{formatSaturation(o.applied_transforms.saturation)}</td>
                              <td className="py-2 px-2">
                                <Badge variant={o.phash_distance_to_source >= 10 ? "success" : "warning"} className="text-[10px]">
                                  {o.phash_distance_to_source} 分
                                </Badge>
                              </td>
                            </tr>
                          ))}
                          {/* 待生成行：5 列 dim placeholder，让用户预感整张表的尺寸 */}
                          {pendingCount > 0 &&
                            Array.from({ length: pendingCount }).map((_, i) => (
                              <tr
                                key={`pending-row-${i}`}
                                className="border-b border-border/50 text-muted-foreground/70"
                              >
                                <td className="py-2 px-2">第 {outputs.length + i + 1} 条</td>
                                <td className="py-2 px-2" colSpan={5}>
                                  <span className="inline-flex items-center gap-1.5">
                                    <Wand2 className="size-3 animate-pulse" />
                                    生成中
                                  </span>
                                </td>
                                <td className="py-2 px-2">
                                  <span className="inline-block h-3 w-10 rounded bg-secondary/70 animate-pulse" />
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground text-sm py-6">
                      {outputsPending ? "生成已完成，正在导出成片…" : "等待生成完成…"}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="phash">
              <PhashCompareCard job={job} />
            </TabsContent>

            <TabsContent value="watermark">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="size-4 text-emerald-500" />
                    版权水印
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    每条成片都嵌入三层水印，遇到盗用或维权时可作为归属证据。
                  </div>
                  <div className="space-y-2">
                    {[
                      { title: "视频文件标记", desc: "藏在视频文件的隐藏信息里，正常播放看不到", level: "肉眼不可见" },
                      { title: "画面角标", desc: "右下角的微小标识，几乎察觉不到", level: "肉眼几乎不可见" },
                      { title: "文件指纹", desc: "成片在后台留有记录，有纠纷可一键比对", level: "后台留底" },
                    ].map((l) => (
                      <div key={l.title} className="p-3 rounded-lg border border-border flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-emerald-500/10 grid place-items-center">
                          <ShieldCheck className="size-4 text-emerald-500" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{l.title}</div>
                          <div className="text-xs text-muted-foreground">{l.desc}</div>
                        </div>
                        <Badge variant="muted" className="text-[10px]">{l.level}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">任务信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row icon={Layers} label="使用模板">{job.template_name}</Row>
              <Row icon={Sparkles} label="差异化策略">{PROFILE_LABELS[job.perturbation_profile]}</Row>
              <Row icon={Wand2} label="生成条数">{job.output_variants} 条</Row>
              <Separator />
              <Row label="创建时间">{new Date(job.created_at).toLocaleString("zh-CN")}</Row>
              {job.completed_at && (
                <Row label="完成时间">{new Date(job.completed_at).toLocaleString("zh-CN")}</Row>
              )}
              {job.completed_at && (
                <Row label="耗时">
                  {Math.round((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000)} 秒
                </Row>
              )}
              <Separator />
              <Row label="本次消耗">{job.output_variants} 积分</Row>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* v0.15+: 批量发布抽屉 */}
      {job && (
        <BatchPublishDrawer
          job={job}
          open={publishOpen}
          onClose={() => setPublishOpen(false)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, highlight, mono }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return (
    <div className={cn("rounded-md bg-secondary/50 p-2.5", highlight && "bg-emerald-500/10")}>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-semibold mt-0.5", mono && "font-mono")}>{value}</div>
    </div>
  );
}

function Row({ icon: Icon, label, children }: { icon?: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon className="size-3.5 text-muted-foreground" />}
      <span className="text-xs text-muted-foreground flex-1">{label}</span>
      <span className="text-xs font-medium">{children}</span>
    </div>
  );
}

const STAGES = [
  { label: "读取模板", desc: "检查素材位置是否齐全" },
  { label: "拉取素材", desc: "下载明星片段、商品图等" },
  { label: "合成与处理", desc: "拼接并生成多条版本" },
  { label: "加水印 · 收尾", desc: "嵌入版权水印、生成预览图" },
];

function progressStage(p: number) {
  if (p < 25) return STAGES[0].label;
  if (p < 50) return STAGES[1].label;
  if (p < 75) return STAGES[2].label;
  return STAGES[3].label;
}

// ── 处理算子的数值人话化 ────────────────────────────────────────────────────

function formatTransformValue(key: string, value: unknown): string {
  if (typeof value === "boolean") return value ? "已开启" : "—";
  if (typeof value === "number") {
    if (key === "speed") return `${value.toFixed(2)}×`;
    if (key === "brightness") return formatBrightness(value);
    if (key === "saturation") return formatSaturation(value);
    return String(value);
  }
  if (typeof value === "string") return value;
  if (typeof value === "object") return "（详见对照表）";
  return String(value);
}

function formatBrightness(v?: number): string {
  if (v == null) return "—";
  if (Math.abs(v) < 0.001) return "原样";
  const sign = v > 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(1)}%`;
}

function formatSaturation(v?: number): string {
  if (v == null) return "—";
  if (Math.abs(v - 1) < 0.001) return "原样";
  const delta = (v - 1) * 100;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}%`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string; icon: any }> = {
    success: { variant: "success", label: "已完成", icon: CheckCircle2 },
    running: { variant: "default", label: "生成中", icon: Clock },
    queued: { variant: "muted", label: "等待中", icon: Clock },
    failed: { variant: "danger", label: "未成功", icon: AlertCircle },
    pending: { variant: "muted", label: "准备中", icon: Clock },
  };
  const info = map[status] || map.pending;
  const Icon = info.icon;
  return (
    <Badge variant={info.variant} className="gap-1">
      <Icon className="size-3" />
      {info.label}
    </Badge>
  );
}

// ── 真实视频预览 ─────────────────────────────────────────────────────────────
// 主预览(左侧 240 宽栏):带受控 ref 的 video,父组件控制播放/暂停。
// 若 src 加载失败(例如 mock 任务没有真 mp4),退回到父组件传入的 fallback。

interface VariantVideoPreviewProps {
  src?: string;
  poster?: string;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
  fallback: ReactNode;
}

const VariantVideoPreview = forwardRef(function VariantVideoPreview(
  { src, poster, onPlay, onPause, onEnded, fallback }: VariantVideoPreviewProps,
  ref: ForwardedRef<HTMLVideoElement>,
) {
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setErrored(false);
  }, [src]);

  if (!src || errored) {
    return (
      <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-secondary/60">
        {fallback}
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-secondary/60 ring-1 ring-border">
      <video
        ref={ref}
        src={src}
        poster={poster}
        preload="metadata"
        playsInline
        controls
        className="w-full h-full object-cover"
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
        onError={() => setErrored(true)}
      />
    </div>
  );
});

function uploadBindingLabel(binding: RenderJob["slot_bindings"][string]): string {
  const raw =
    ("file_url" in binding ? binding.file_url : undefined) ||
    ("asset_id" in binding ? binding.asset_id : undefined) ||
    "已上传素材";
  return raw.split("/").pop() || raw;
}

// ── phash 指纹对比卡 ──────────────────────────────────────────────────────────
// 把后端 aHash 64bit 指纹可视化成 8×8 比特格子:深 = 高于均值的画面区,浅 = 低于均值。
// 变体格子上,与原片不同的比特高亮成红色,直观证明扰动确实改了画面指纹。
// 变体多时取距离最低 / 中位 / 最高 3 条展示;少时全部展示。

function PhashCompareCard({ job }: { job: RenderJob }) {
  const outputs = job.outputs ?? [];
  const source = job.source_phash;

  if (outputs.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground text-sm">
          等视频生成完成后，这里会显示与原片的差异分析。
        </CardContent>
      </Card>
    );
  }
  if (!source || !isValidHash(source)) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground text-sm">
          这个任务不支持差异分析（该功能在较早的任务上暂不可用），再生成一批即可看到对比。
        </CardContent>
      </Card>
    );
  }

  // 选 3 条做对比:距离最低 / 中位 / 最高。少于 3 条全展示。
  const sorted = outputs
    .map((o, i) => ({ o, originalIndex: i }))
    .sort((a, b) => a.o.phash_distance_to_source - b.o.phash_distance_to_source);
  const picks: typeof sorted = (() => {
    if (sorted.length <= 3) return sorted;
    const mid = Math.floor(sorted.length / 2);
    return [sorted[0], sorted[mid], sorted[sorted.length - 1]];
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Fingerprint className="size-4 text-violet-500" />
          原片与成片的视觉对比
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          每个视频都有一个 8×8 = 64 格的画面亮度图。深格 = 比平均更亮的区域，浅格 = 比平均更暗。下面每条成片的
          <span className="text-red-500 font-medium"> 红色高亮 </span>
          表示与原片不同的格子，数量越多说明画面变化越大。
        </p>

        {/* 原片 */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="text-sm font-medium">原片画面图</div>
            <code className="text-[10px] font-mono text-muted-foreground select-all">{source}</code>
          </div>
          <PhashGrid bits={hexToBits(source)} />
        </div>

        {/* 选中的几条变体 */}
        <div className="space-y-3">
          <div className="text-xs font-medium text-muted-foreground">
            {outputs.length <= 3
              ? `全部 ${outputs.length} 条对比`
              : `展示变化最小 / 中等 / 最大三条（共 ${outputs.length} 条）`}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {picks.map(({ o, originalIndex }) => {
              const variantHex = isValidHash(o.phash_signature) ? o.phash_signature : null;
              const variantBits = variantHex ? hexToBits(variantHex) : null;
              const sourceBits = hexToBits(source);
              const distance = o.phash_distance_to_source;
              const tone = distanceTone(distance);
              return (
                <div
                  key={o.id}
                  className={cn(
                    "rounded-lg border p-3 space-y-2",
                    tone === "high"
                      ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                      : tone === "mid"
                        ? "border-amber-500/30 bg-amber-500/[0.04]"
                        : "border-red-500/30 bg-red-500/[0.04]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium">第 {originalIndex + 1} 条</div>
                    <Badge
                      variant={tone === "high" ? "success" : tone === "mid" ? "warning" : "danger"}
                      className="text-[10px]"
                    >
                      变化 {distance}/64
                    </Badge>
                  </div>
                  {variantBits ? (
                    <>
                      <PhashGrid bits={variantBits} diffWith={sourceBits} />
                      <DistanceBar distance={distance} />
                      <code className="block text-[10px] font-mono text-muted-foreground truncate select-all">
                        {variantHex}
                      </code>
                    </>
                  ) : (
                    <div className="aspect-square grid place-items-center text-[10px] text-muted-foreground">
                      无法显示对比
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 整批指纹距离分布 —— 直方图风格的小窄条 */}
        {outputs.length > 3 && (
          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium">{outputs.length} 条视频的差异分布</div>
              <div className="text-[10px] text-muted-foreground font-mono">
                最小 {Math.min(...outputs.map((o) => o.phash_distance_to_source))} ·
                {" "}平均 {Math.round(outputs.reduce((s, o) => s + o.phash_distance_to_source, 0) / outputs.length)} ·
                {" "}最大 {Math.max(...outputs.map((o) => o.phash_distance_to_source))}
              </div>
            </div>
            <div className="flex items-end gap-0.5 h-12">
              {outputs.map((o, i) => {
                const pct = Math.min(100, (o.phash_distance_to_source / 32) * 100);
                const tone = distanceTone(o.phash_distance_to_source);
                return (
                  <div
                    key={o.id}
                    title={`第 ${i + 1} 条 · 变化 ${o.phash_distance_to_source}/64`}
                    className={cn(
                      "flex-1 rounded-t transition-all",
                      tone === "high" ? "bg-emerald-500" : tone === "mid" ? "bg-amber-500" : "bg-red-500"
                    )}
                    style={{ height: `${Math.max(8, pct)}%` }}
                  />
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              变化值 ≥ {job && (job as any).quality_gate_min ? (job as any).quality_gate_min : 10}{" "}
              视为变化充分；低于此值系统会自动重新生成。
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PhashGrid({ bits, diffWith }: { bits: number[]; diffWith?: number[] }) {
  return (
    <div className="grid grid-cols-8 gap-[2px] aspect-square w-full max-w-[180px] mx-auto">
      {bits.map((b, i) => {
        const isDiff = diffWith ? diffWith[i] !== b : false;
        return (
          <div
            key={i}
            className={cn(
              "rounded-[1px] transition-colors",
              isDiff
                ? "bg-red-500 ring-1 ring-red-300"
                : b
                  ? "bg-foreground"
                  : "bg-foreground/15"
            )}
            title={isDiff ? "与原片不同的格子" : b ? "较亮区域" : "较暗区域"}
          />
        );
      })}
    </div>
  );
}

function DistanceBar({ distance }: { distance: number }) {
  // 64 bit 满格;实际可用区间 0..32 已是非常显著差异。条长按 /32 算,>32 充满。
  const pct = Math.min(100, (distance / 32) * 100);
  const tone = distanceTone(distance);
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            tone === "high" ? "bg-emerald-500" : tone === "mid" ? "bg-amber-500" : "bg-red-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[10px] text-muted-foreground">
        变化 {distance} / 64{" "}
        {tone === "high" && "· 变化充分"}
        {tone === "mid" && "· 变化中等"}
        {tone === "low" && "· 变化偏小"}
      </div>
    </div>
  );
}

function isValidHash(s?: string | null): s is string {
  return !!s && s.length === 16 && /^[0-9a-fA-F]+$/.test(s);
}

function hexToBits(hex: string): number[] {
  const bits: number[] = [];
  for (let i = 0; i < hex.length; i++) {
    const nibble = parseInt(hex[i], 16);
    for (let b = 3; b >= 0; b--) {
      bits.push((nibble >> b) & 1);
    }
  }
  return bits;
}

function distanceTone(d: number): "high" | "mid" | "low" {
  if (d >= 12) return "high";
  if (d >= 6) return "mid";
  return "low";
}

// 待生成变体的占位 tile。视觉与已完成 tile 同尺寸（aspect-[9/16]），但是 dim + pulse + 不可点击。
// 让用户能预感"还有 N 条"，看着进度条慢慢填满有期待感。
function PendingVariantTile({ label }: { label: string }) {
  return (
    <div
      className="relative rounded-lg overflow-hidden aspect-[9/16] bg-secondary/40 border border-dashed border-border/60 grid place-items-center"
      aria-label={`${label} 生成中`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.04] to-transparent animate-pulse" />
      <div className="relative flex flex-col items-center gap-1.5 text-muted-foreground">
        <Wand2 className="size-4 text-violet-500/70 animate-pulse" />
        <span className="text-[10px]">生成中</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-2">
        <span className="text-[10px] text-muted-foreground/80">{label}</span>
      </div>
    </div>
  );
}

// 缩略图卡优先用渲染器生成的 jpg；老任务没有 poster 时才退回 video metadata。
function VariantThumbnail({ src, poster }: { src?: string; poster?: string }) {
  const [posterErrored, setPosterErrored] = useState(false);
  const [videoErrored, setVideoErrored] = useState(false);

  useEffect(() => {
    setPosterErrored(false);
    setVideoErrored(false);
  }, [src, poster]);

  if (poster && !posterErrored) {
    return (
      <img
        src={poster}
        alt=""
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        onError={() => setPosterErrored(true)}
      />
    );
  }

  if (!src || videoErrored) {
    return (
      <div className="absolute inset-0 grid place-items-center text-muted-foreground text-xs">
        无预览
      </div>
    );
  }

  return (
    <video
      src={src}
      poster={poster}
      preload="metadata"
      muted
      playsInline
      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      onError={() => setVideoErrored(true)}
    />
  );
}
