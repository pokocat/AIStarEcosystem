"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  PlayCircle,
  Copy,
  Sparkles,
  ShieldCheck,
  Cpu,
  Layers,
  Wand2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/mixcut-zone/ui/card";
import { Button } from "@/components/mixcut-zone/ui/button";
import { Badge } from "@/components/mixcut-zone/ui/badge";
import { Separator } from "@/components/mixcut-zone/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/mixcut-zone/ui/tabs";
import { TemplatePreview } from "@/components/mixcut-zone/template-preview";
import { MixcutApi } from "@/api";
import { mockTemplates, mockStarClips } from "@/mocks/mixcut";
import type { RenderJob } from "@/components/mixcut-zone/types";
import { PROFILE_LABELS } from "@/constants/mixcut-ui";
import { cn, formatBytes, relativeTime, shortHash } from "@/components/mixcut-zone/lib/utils";

export function JobDetailClient({ id }: { id: string }) {
  const [job, setJob] = useState<RenderJob | null | undefined>(undefined); // undefined = loading
  const [selectedVariant, setSelectedVariant] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      MixcutApi.getJob(id).then((j) => {
        if (cancelled) return;
        setJob(j);
      });
    };
    tick();
    // 渲染中持续刷新；完成后停止
    const timer = setInterval(() => {
      if (job?.status === "running" || job?.status === "queued" || job?.status === "pending") {
        tick();
      }
    }, 800);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id, job?.status]);

  if (job === undefined) {
    return (
      <div className="px-6 lg:px-8 py-12 max-w-[1600px] mx-auto text-center text-muted-foreground text-sm">
        加载中…
      </div>
    );
  }
  if (job === null) notFound();

  const template = mockTemplates.find((t) => t.template_id === job.template_id);
  const isProcessing = job.status === "running" || job.status === "queued" || job.status === "pending";
  const completed = job.status === "success";

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1600px] mx-auto">
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
            <StatusBadge status={job.status} />
            <Badge variant="muted" className="text-[10px]">{PROFILE_LABELS[job.perturbation_profile]}</Badge>
            <Badge variant="muted" className="text-[10px]">{job.output_variants} 变体</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{job.template_name}</h1>
          <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
            <span className="font-mono">{job.id}</span>
            <Button variant="ghost" size="icon" className="size-5">
              <Copy className="size-3" />
            </Button>
            <span>·</span>
            <span>创建于 {relativeTime(job.created_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {completed && (
            <>
              <Button variant="outline">
                <Download className="size-4" /> 全部下载 (ZIP)
              </Button>
              <Button variant="outline">
                <RefreshCw className="size-4" /> 用相同参数再来一次
              </Button>
            </>
          )}
          {job.status === "failed" && (
            <Button variant="gradient">
              <RefreshCw className="size-4" /> 重渲
            </Button>
          )}
          <Button variant="ghost" size="icon">
            <Trash2 className="size-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {isProcessing && (
        <Card className="mb-6 overflow-hidden">
          <div className="relative h-1 bg-secondary">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-500 to-fuchsia-500 transition-all"
              style={{ width: `${job.progress}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-white/30 animate-shimmer"
              style={{ width: "20%", transform: `translateX(${job.progress}%)` }}
            />
          </div>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-brand-500/10 grid place-items-center">
                <Wand2 className="size-5 text-brand-500 animate-pulse" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">
                  {job.status === "queued" ? "排队中,等待 worker 资源…" : "渲染中…"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {progressStage(job.progress)} · 预计还需 {Math.max(1, Math.ceil((100 - job.progress) * 0.4))} 秒
                </div>
              </div>
              <div className="text-2xl font-mono font-semibold tabular-nums">{job.progress}%</div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {STAGES.map((s, idx) => {
                const startProgress = idx * 25;
                const active = job.progress >= startProgress;
                const current = job.progress >= startProgress && job.progress < (idx + 1) * 25;
                return (
                  <div
                    key={s.label}
                    className={cn(
                      "rounded-md border p-2",
                      active ? "border-brand-500/40 bg-brand-500/5" : "border-border",
                      current && "ring-1 ring-brand-500/40"
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

      {job.status === "failed" && (
        <Card className="mb-6 border-red-500/30 bg-red-500/[0.03]">
          <CardContent className="p-5 flex items-start gap-3">
            <AlertCircle className="size-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-sm text-red-400">渲染失败</div>
              <div className="text-xs text-muted-foreground mt-1">{job.error_message}</div>
              <div className="text-xs text-muted-foreground mt-2">
                · 已退还本次配额 {job.output_variants} 个
                <br />· 您可以更换素材后重试,或联系客服
              </div>
            </div>
            <Button variant="gradient" size="sm">
              <RefreshCw className="size-3" /> 重渲
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        <div>
          <Tabs defaultValue="outputs">
            <TabsList>
              <TabsTrigger value="outputs">产出 ({job.outputs?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="bindings">槽位绑定</TabsTrigger>
              <TabsTrigger value="perturbations">扰动详情</TabsTrigger>
              <TabsTrigger value="watermark">水印追溯</TabsTrigger>
            </TabsList>

            <TabsContent value="outputs">
              {completed && job.outputs ? (
                <div className="space-y-4">
                  <Card>
                    <CardContent className="p-5">
                      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5">
                        <div>
                          {template && (
                            <TemplatePreview
                              template={template}
                              bindings={job.slot_bindings}
                              showSlotChrome={false}
                              variantSeed={selectedVariant}
                            />
                          )}
                        </div>
                        <div className="space-y-3">
                          <div>
                            <div className="text-xs text-muted-foreground">当前预览</div>
                            <div className="text-lg font-semibold mt-0.5">变体 #{selectedVariant + 1}</div>
                          </div>
                          {(() => {
                            const o = job.outputs![selectedVariant];
                            return (
                              <>
                                <div className="grid grid-cols-2 gap-2">
                                  <Stat label="pHash 距离" value={`${o.phash_distance_to_source}`} highlight={o.phash_distance_to_source >= 10} />
                                  <Stat label="文件大小" value={formatBytes(o.file_size)} />
                                  <Stat label="时长" value={`${o.duration}s`} />
                                  <Stat label="水印 token" value={shortHash(o.watermark_token, 10)} mono />
                                </div>
                                <Separator />
                                <div>
                                  <div className="text-xs text-muted-foreground mb-2">应用的扰动算子</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(o.applied_transforms).map(([k, v]) => {
                                      if (k === "slot_jitter" || v == null || v === false) return null;
                                      return (
                                        <Badge key={k} variant="muted" className="text-[10px] font-mono">
                                          {k}: {typeof v === "boolean" ? "yes" : typeof v === "object" ? "{…}" : String(v)}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 pt-2">
                                  <Button variant="gradient" className="flex-1">
                                    <Download className="size-4" /> 下载本变体
                                  </Button>
                                  <Button variant="outline">
                                    <PlayCircle className="size-4" /> 播放
                                  </Button>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {job.outputs.map((o, idx) => (
                      <button
                        key={o.id}
                        onClick={() => setSelectedVariant(idx)}
                        className={cn(
                          "group relative rounded-lg overflow-hidden transition-all",
                          selectedVariant === idx
                            ? "ring-2 ring-brand-500 ring-offset-2 ring-offset-background"
                            : "hover:ring-2 hover:ring-white/30"
                        )}
                      >
                        {template && (
                          <TemplatePreview template={template} bindings={job.slot_bindings} showSlotChrome={false} variantSeed={idx} />
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-2 flex items-center justify-between">
                          <span className="text-[10px] text-white font-mono">v{idx + 1}</span>
                          <Badge variant="success" className="text-[9px]">
                            pH {o.phash_distance_to_source}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <Card>
                  <CardContent className="p-12 text-center text-muted-foreground text-sm">
                    {isProcessing ? "渲染完成后,产出会自动出现在这里" : "暂无产出"}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="bindings">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">槽位绑定明细</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(job.slot_bindings).map(([slotId, b]) => {
                    const slot = template?.slots.find((s) => s.slot_id === slotId);
                    return (
                      <div key={slotId} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                        <Badge variant="muted" className="font-mono text-[10px] shrink-0">{slotId}</Badge>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{slot?.label || slotId}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {b.source === "input" && `文本: "${b.text}"`}
                            {b.source === "library" && `素材库: ${(() => {
                              const s = mockStarClips.find((x) => x.id === b.asset_id);
                              return s ? `${s.star_name} · ${shortHash(b.asset_id, 12)}` : b.asset_id;
                            })()}`}
                            {b.source === "upload" && `用户上传: ${b.file_url.split("/").pop()}`}
                            {b.source === "fixed" && "固定素材(系统)"}
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
                  <CardTitle className="text-base">扰动算子应用情况</CardTitle>
                </CardHeader>
                <CardContent>
                  {job.outputs ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground">
                            <th className="text-left py-2 px-2 font-medium">变体</th>
                            <th className="text-left py-2 px-2 font-medium">crop</th>
                            <th className="text-left py-2 px-2 font-medium">mirror</th>
                            <th className="text-left py-2 px-2 font-medium">speed</th>
                            <th className="text-left py-2 px-2 font-medium">brightness</th>
                            <th className="text-left py-2 px-2 font-medium">saturation</th>
                            <th className="text-left py-2 px-2 font-medium">pHash</th>
                          </tr>
                        </thead>
                        <tbody>
                          {job.outputs.map((o, i) => (
                            <tr key={o.id} className="border-b border-border/50">
                              <td className="py-2 px-2 font-mono">v{i + 1}</td>
                              <td className="py-2 px-2 font-mono">{o.applied_transforms.crop || "—"}</td>
                              <td className="py-2 px-2">{o.applied_transforms.mirror ? "✓" : "—"}</td>
                              <td className="py-2 px-2 font-mono">{o.applied_transforms.speed?.toFixed(2)}</td>
                              <td className="py-2 px-2 font-mono">{o.applied_transforms.brightness?.toFixed(3)}</td>
                              <td className="py-2 px-2 font-mono">{o.applied_transforms.saturation?.toFixed(3)}</td>
                              <td className="py-2 px-2">
                                <Badge variant={o.phash_distance_to_source >= 10 ? "success" : "warning"} className="text-[10px]">
                                  {o.phash_distance_to_source}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground text-sm py-6">等待渲染完成…</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="watermark">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="size-4 text-emerald-500" />
                    水印追溯
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    每条生成视频都嵌入了三层水印,用于版权追溯。
                  </div>
                  <div className="space-y-2">
                    {[
                      { title: "metadata 水印", desc: "嵌入在 mp4 metadata comment 字段", level: "公开可见" },
                      { title: "像素水印", desc: "右下角 token 缩写,2% 透明度", level: "肉眼几乎不可见" },
                      { title: "文件哈希", desc: "SHA-256 出现争议时比对", level: "服务端记录" },
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
              <CardTitle className="text-base">任务元信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row icon={Layers} label="模板">{job.template_name}</Row>
              <Row icon={Sparkles} label="扰动 profile">{PROFILE_LABELS[job.perturbation_profile]}</Row>
              <Row icon={Wand2} label="变体数">{job.output_variants}</Row>
              <Separator />
              <Row label="创建时间">{new Date(job.created_at).toLocaleString("zh-CN")}</Row>
              {job.completed_at && (
                <Row label="完成时间">{new Date(job.completed_at).toLocaleString("zh-CN")}</Row>
              )}
              {job.completed_at && (
                <Row label="处理耗时">
                  {Math.round((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000)}s
                </Row>
              )}
              <Separator />
              <Row icon={Cpu} label="渲染机器">worker-cn-sz-04</Row>
              <Row label="设备指纹">{shortHash("sha256:f4a2d1b8e9c73a5b", 12)}</Row>
              <Row label="配额消耗">{job.output_variants} 个</Row>
            </CardContent>
          </Card>
        </aside>
      </div>
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
  { label: "解析模板", desc: "解析 slot + 校验" },
  { label: "拉取素材", desc: "下载明星/商品" },
  { label: "扰动 + 合成", desc: "应用 N 个变体" },
  { label: "水印 + 上传", desc: "嵌入追溯水印" },
];

function progressStage(p: number) {
  if (p < 25) return STAGES[0].label;
  if (p < 50) return STAGES[1].label;
  if (p < 75) return STAGES[2].label;
  return STAGES[3].label;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string; icon: any }> = {
    success: { variant: "success", label: "已完成", icon: CheckCircle2 },
    running: { variant: "default", label: "渲染中", icon: Clock },
    queued: { variant: "muted", label: "排队中", icon: Clock },
    failed: { variant: "danger", label: "失败", icon: AlertCircle },
    pending: { variant: "muted", label: "待处理", icon: Clock },
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
