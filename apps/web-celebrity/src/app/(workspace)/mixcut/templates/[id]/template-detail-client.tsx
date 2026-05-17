"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Layers,
  Clock,
  Tag,
  Flame,
  CheckCircle2,
  Lock,
  ChevronRight,
  Info,
} from "lucide-react";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/mixcut-zone/ui/card";
import { Button } from "@/components/mixcut-zone/ui/button";
import { Badge } from "@/components/mixcut-zone/ui/badge";
import { Separator } from "@/components/mixcut-zone/ui/separator";
import { TemplatePreview } from "@/components/mixcut-zone/template-preview";
import { mockTemplates } from "@/mocks/mixcut";
import { PROFILE_LABELS, PROFILE_DESCRIPTIONS, TIER_LABELS } from "@/constants/mixcut-ui";
import { cn, formatNumber } from "@/components/mixcut-zone/lib/utils";

export function TemplateDetailClient({ id }: { id: string }) {
  const template = mockTemplates.find((t) => t.template_id === id);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [previewVariant, setPreviewVariant] = useState<number | undefined>(undefined);

  if (!template) {
    notFound();
  }

  const slot = template.slots.find((s) => s.slot_id === selectedSlot);

  const editableSlots = template.slots.filter((s) => s.user_editable);
  const requiredSlots = editableSlots.filter((s) => s.required);

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/mixcut/templates">
            <ArrowLeft className="size-4" /> 返回模板库
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
        <div>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="muted" className="text-[10px]">{template.metadata.category}</Badge>
                <Badge variant="brand" className="text-[10px]">
                  <Lock className="size-2.5" /> {TIER_LABELS[template.metadata.required_tier]}
                </Badge>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">{template.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                v{template.version} · {template.canvas.width}×{template.canvas.height} · {template.canvas.duration}秒
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
            <div>
              <TemplatePreview
                template={template}
                selectedSlotId={selectedSlot}
                onSelectSlot={setSelectedSlot}
                variantSeed={previewVariant}
              />
              <div className="mt-3">
                <div className="text-xs text-muted-foreground mb-2">扰动效果预览(不同变体的 slot 位置抖动)</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setPreviewVariant(undefined)}
                    className={cn(
                      "px-2.5 py-1 rounded text-xs border transition-colors",
                      previewVariant == null
                        ? "bg-foreground text-background border-foreground"
                        : "bg-transparent border-border text-muted-foreground hover:border-foreground"
                    )}
                  >
                    原版
                  </button>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPreviewVariant(i)}
                      className={cn(
                        "px-2.5 py-1 rounded text-xs border transition-colors font-mono",
                        previewVariant === i
                          ? "bg-foreground text-background border-foreground"
                          : "bg-transparent border-border text-muted-foreground hover:border-foreground"
                      )}
                    >
                      变体 {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="size-4 text-brand-500" />
                    模板槽位 ({template.slots.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {template.slots.map((s) => {
                    const isSelected = selectedSlot === s.slot_id;
                    return (
                      <button
                        key={s.slot_id}
                        onClick={() => setSelectedSlot(isSelected ? null : s.slot_id)}
                        className={cn(
                          "w-full text-left p-3 rounded-lg border transition-colors",
                          isSelected
                            ? "border-brand-500/60 bg-brand-500/5"
                            : "border-border hover:bg-secondary/50"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant="muted" className="font-mono text-[10px] shrink-0">
                              {s.layer_type}
                            </Badge>
                            <span className="text-sm font-medium truncate">{s.label || s.slot_id}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {s.required && <Badge variant="danger" className="text-[10px]">必填</Badge>}
                            {!s.user_editable && <Badge variant="muted" className="text-[10px]">固定</Badge>}
                          </div>
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground font-mono flex items-center gap-3 flex-wrap">
                          <span>z={s.z_index}</span>
                          {s.rect && (
                            <span>
                              ({s.rect.x.toFixed(2)}, {s.rect.y.toFixed(2)}) · {(s.rect.w * 100).toFixed(0)}×{(s.rect.h * 100).toFixed(0)}%
                            </span>
                          )}
                          <span>[{s.time_range[0]}s-{s.time_range[1]}s]</span>
                          <span>{s.fill_strategy}</span>
                        </div>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>

              {slot && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Info className="size-4 text-brand-500" />
                      Slot Schema · <span className="font-mono text-sm">{slot.slot_id}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-[11px] font-mono bg-secondary/50 p-3 rounded-md overflow-x-auto scrollbar-thin max-h-80">
                      {JSON.stringify(slot, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">模板摘要</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Stat label="画布" value={`${template.canvas.width}×${template.canvas.height}`} />
                <Stat label="时长" value={`${template.canvas.duration}s @ ${template.canvas.fps}fps`} />
                <Stat label="槽位" value={`${template.slots.length} 个`} />
                <Stat label="必填" value={`${requiredSlots.length} 项`} />
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">扰动 profile</div>
                <div className="flex items-center gap-2">
                  <Badge variant="brand" className="capitalize">
                    {PROFILE_LABELS[template.perturbation_profile]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">默认 {template.output_variants_default} 变体</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {PROFILE_DESCRIPTIONS[template.perturbation_profile]}
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">质量门控</div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  pHash 距离 ≥ {template.quality_gate.min_phash_distance}
                  <span className="text-muted-foreground text-xs">(最多重试 {template.quality_gate.max_retries} 次)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">使用数据</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Flame className="size-3 text-orange-500" /> 日生产量</span>
                <span className="text-sm font-semibold">{formatNumber(template.metadata.daily_creation_count ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="size-3 text-emerald-500" /> 平台存活率</span>
                <span className="text-sm font-semibold">{template.metadata.hit_rate}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="size-3" /> 标签</span>
                <div className="flex gap-1">
                  {template.metadata.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-[10px] text-muted-foreground">#{tag}</span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Button variant="gradient" size="xl" className="w-full" asChild>
            <Link href={`/mixcut/create/${template.template_id}`}>
              <Sparkles className="size-4" />
              使用此模板创建
              <ChevronRight className="size-4" />
            </Link>
          </Button>
          <div className="text-[10px] text-center text-muted-foreground">
            创建后系统将自动嵌入追溯水印
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/50 p-3">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}
