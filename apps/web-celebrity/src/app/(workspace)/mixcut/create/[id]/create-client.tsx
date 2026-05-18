"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Wand2,
  Zap,
  Info,
  Crown,
  AlertTriangle,
  Plus,
  Minus,
  ChevronRight,
} from "lucide-react";
import { nanoid } from "nanoid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/mixcut-zone/ui/card";
import { Button } from "@/components/mixcut-zone/ui/button";
import { Badge } from "@/components/mixcut-zone/ui/badge";
import { Separator } from "@/components/mixcut-zone/ui/separator";
import { Slider } from "@/components/mixcut-zone/ui/slider";
import { TemplatePreview } from "@/components/mixcut-zone/template-preview";
import { SlotInput } from "@/components/mixcut-zone/slot-input";
import { mockTemplates } from "@/mocks/mixcut";
import { MixcutApi } from "@/api";
import type {
  SlotBinding,
  PerturbationProfile,
  RenderJob,
  PerturbationOverrides,
  SlotSnapshot,
  SlotPerturbationPolicy,
} from "@/components/mixcut-zone/types";
import { PROFILE_LABELS, PROFILE_DESCRIPTIONS } from "@/constants/mixcut-ui";
import { cn, formatNumber } from "@/components/mixcut-zone/lib/utils";
import { resolvePolicy } from "@/components/mixcut-zone/lib/perturbation-defaults";
import { flatSlotsOf, flatSlotsAbsolute, totalDuration } from "@/components/mixcut-zone/lib/scene-helpers";

export function CreateClient({ id }: { id: string }) {
  const router = useRouter();
  const code = MixcutApi.mockActivationCode;
  // SSR 没有 localStorage,只能看工厂模板;client hydration 后异步补一次,把用户编辑覆盖回来
  const [template, setTemplate] = useState(
    () => mockTemplates.find((t) => t.template_id === id) ?? null
  );
  const [resolved, setResolved] = useState(false);

  // 所有 hook 必须在 early-return 之前(Rules of Hooks)
  const [bindings, setBindings] = useState<Record<string, SlotBinding>>(() => {
    if (!template) return {};
    const initial: Record<string, SlotBinding> = {};
    flatSlotsOf(template).forEach((s) => {
      if (s.fill_strategy === "user_input" && s.default_value) {
        initial[s.slot_id] = { source: "input", text: s.default_value };
      } else if (s.fill_strategy === "fixed") {
        initial[s.slot_id] = { source: "fixed" };
      }
    });
    return initial;
  });
  const [focusedSlot, setFocusedSlot] = useState<string | null>(null);
  const [profile, setProfile] = useState<PerturbationProfile>(
    () => template?.perturbation_profile ?? "moderate"
  );
  const [variants, setVariants] = useState(() => template?.output_variants_default ?? 5);
  const [previewVariant, setPreviewVariant] = useState<number | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [overrides, setOverrides] = useState<Required<PerturbationOverrides>>({
    allow_mirror: true,
    allow_speed: true,
    allow_brightness: true,
    allow_saturation: true,
  });
  const [slotPolicies, setSlotPolicies] = useState<Record<string, Partial<SlotPerturbationPolicy>>>({});
  const initFromTemplateRef = useRef(false);

  useEffect(() => {
    const local = MixcutApi.getTemplateSync(id);
    if (local) setTemplate(local);
    setResolved(true);
  }, [id]);

  // 当 template 首次变为非空(localStorage 覆盖加载到)时,把 bindings / profile / variants
  // 重新用模板里的默认值 seed 一次。只跑一次,之后用户改了的就不再覆盖。
  useEffect(() => {
    if (!template || initFromTemplateRef.current) return;
    initFromTemplateRef.current = true;
    const initial: Record<string, SlotBinding> = {};
    flatSlotsOf(template).forEach((s) => {
      if (s.fill_strategy === "user_input" && s.default_value) {
        initial[s.slot_id] = { source: "input", text: s.default_value };
      } else if (s.fill_strategy === "fixed") {
        initial[s.slot_id] = { source: "fixed" };
      }
    });
    setBindings(initial);
    setProfile(template.perturbation_profile);
    setVariants(template.output_variants_default);
  }, [template]);

  if (resolved && !template) notFound();
  if (!template) {
    return (
      <div className="px-6 lg:px-8 py-12 max-w-[1600px] mx-auto text-center text-muted-foreground text-sm">
        加载中…
      </div>
    );
  }

  const handlePolicyChange = (slotId: string, next: Partial<SlotPerturbationPolicy>) => {
    setSlotPolicies((prev) => {
      const out = { ...prev };
      if (Object.keys(next).length === 0) delete out[slotId];
      else out[slotId] = next;
      return out;
    });
  };

  const allSlots = flatSlotsOf(template);
  const editableSlots = allSlots.filter((s) => s.user_editable);
  const requiredSlots = editableSlots.filter((s) => s.required);
  const filledRequired = requiredSlots.filter((s) => {
    const b = bindings[s.slot_id];
    return b && ((b.source === "input" && b.text.trim()) || b.source === "library" || b.source === "upload");
  });
  const allRequiredFilled = filledRequired.length === requiredSlots.length;

  const handleSlotChange = (slotId: string, b: SlotBinding | undefined) => {
    setBindings((prev) => {
      const next = { ...prev };
      if (b) next[slotId] = b;
      else delete next[slotId];
      return next;
    });
  };

  const quotaRemaining = code.monthly_quota - code.quota_used_this_period;
  const overQuota = variants > quotaRemaining;

  const handleSubmit = async () => {
    if (!allRequiredFilled || overQuota) return;
    setSubmitting(true);
    const jobId = `job_${nanoid(8)}`;

    // 模板快照:flat 化 scenes,time_range 转为绝对秒数,后端按 flat list 渲染
    const slotsSnapshot: SlotSnapshot[] = flatSlotsAbsolute(template).map((s) => {
      const userOverride = slotPolicies[s.slot_id];
      // layer_type 默认 ∪ 模板覆盖 ∪ 用户覆盖(最高优先级)
      const merged: Partial<SlotPerturbationPolicy> = {
        ...(s.perturbation_policy ?? {}),
        ...(userOverride ?? {}),
      };
      return {
        slot_id: s.slot_id,
        layer_type: s.layer_type,
        rect: s.rect,
        z_index: s.z_index,
        perturbation_policy: resolvePolicy(s.layer_type, merged),
      };
    });

    const job: RenderJob = {
      id: jobId,
      user_id: "u1",
      template_id: template.template_id,
      template_name: template.name,
      template_thumbnail: template.metadata.thumbnail_url,
      slot_bindings: bindings,
      perturbation_profile: profile,
      output_variants: variants,
      status: "queued",
      progress: 0,
      created_at: new Date().toISOString(),
      canvas_snapshot: {
        width: template.canvas.width,
        height: template.canvas.height,
        fps: template.canvas.fps,
      },
      slots_snapshot: slotsSnapshot,
      perturbation_overrides: overrides,
    };
    await MixcutApi.createJob(job);

    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);

    if (MixcutApi.isLocalJobMode()) {
      // 仅本地 mock 模式模拟渲染进度。真后端模式由 server worker 写入进度和 outputs。
      let p = 0;
      const stepName = (pct: number): RenderJob["status"] =>
        pct < 25 ? "running" : pct < 100 ? "running" : "success";
      const timer = setInterval(() => {
        p = Math.min(100, p + Math.floor(Math.random() * 12 + 6));
        MixcutApi.updateJobProgress(jobId, p, stepName(p));
        if (p >= 100) clearInterval(timer);
      }, 700);
    }

    router.push(`/mixcut/jobs/${jobId}`);
  };

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1600px] mx-auto">
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/mixcut/templates/${template.template_id}`}>
            <ArrowLeft className="size-4" /> 返回模板详情
          </Link>
        </Button>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Link href="/mixcut/templates" className="hover:text-foreground">模板库</Link>
          <ChevronRight className="size-3" />
          <Link href={`/mixcut/templates/${template.template_id}`} className="hover:text-foreground">{template.name}</Link>
          <ChevronRight className="size-3" />
          <span className="text-foreground">创建任务</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_360px] gap-6">
        <div className="lg:sticky lg:top-20 self-start space-y-3">
          <TemplatePreview
            template={template}
            bindings={bindings}
            selectedSlotId={focusedSlot}
            onSelectSlot={setFocusedSlot}
            variantSeed={previewVariant}
          />
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="text-xs text-muted-foreground">变体预览(模拟扰动效果)</div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setPreviewVariant(undefined)}
                  className={cn(
                    "px-2 py-1 rounded text-[11px] border transition-colors",
                    previewVariant == null
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent border-border text-muted-foreground hover:border-foreground"
                  )}
                >
                  原版
                </button>
                {Array.from({ length: Math.min(variants, 8) }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPreviewVariant(i)}
                    className={cn(
                      "px-2 py-1 rounded text-[11px] border font-mono transition-colors",
                      previewVariant === i
                        ? "bg-foreground text-background border-foreground"
                        : "bg-transparent border-border text-muted-foreground hover:border-foreground"
                    )}
                  >
                    v{i + 1}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground leading-relaxed pt-1">
                每个变体应用不同的 slot 位置/尺寸抖动 + 色彩/速度扰动,
                <br />
                确保汉明距离 ≥ {template.quality_gate.min_phash_distance} 才入库。
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 min-w-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">填入素材</h1>
              <p className="text-xs text-muted-foreground mt-1">
                必填 {requiredSlots.length} 项 · 已填 <span className="text-emerald-500">{filledRequired.length}</span>
                {requiredSlots.length > 0 && ` / ${requiredSlots.length}`}
              </p>
            </div>
            <Badge variant="muted" className="text-[10px]">{editableSlots.length} 个可编辑位</Badge>
          </div>

          {editableSlots.map((s) => (
            <div key={s.slot_id} id={`slot-${s.slot_id}`}>
              <SlotInput
                slot={s}
                binding={bindings[s.slot_id]}
                onChange={(b) => handleSlotChange(s.slot_id, b)}
                focused={focusedSlot === s.slot_id}
                onFocus={() => setFocusedSlot(s.slot_id)}
                policyOverride={slotPolicies[s.slot_id]}
                onPolicyChange={(next) => handlePolicyChange(s.slot_id, next)}
                globalOverrides={overrides}
              />
            </div>
          ))}

          {allSlots.some((s) => !s.user_editable) && (
            <Card className="bg-secondary/30 border-dashed">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <Info className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-xs text-muted-foreground">
                    本模板还有 {allSlots.filter((s) => !s.user_editable).length} 处固定内容(如品牌条),系统会自动填,你不用管。
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="lg:sticky lg:top-20 self-start space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wand2 className="size-4 text-brand-500" />
                批量生成参数
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">差异化强度</label>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["light", "moderate", "aggressive"] as PerturbationProfile[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setProfile(p)}
                      className={cn(
                        "px-2 py-2 rounded-md text-xs border transition-colors",
                        profile === p
                          ? "bg-foreground text-background border-foreground"
                          : "bg-transparent border-border text-muted-foreground hover:border-foreground"
                      )}
                    >
                      <div className="font-medium">{PROFILE_LABELS[p]}</div>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
                  {PROFILE_DESCRIPTIONS[profile]}
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">画面处理方式</label>
                  <span className="text-[10px] text-muted-foreground">
                    {Object.values(overrides).filter(Boolean).length}/4 启用
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    { key: "allow_mirror", label: "左右翻转", hint: "整段画面镜像翻转,提升差异度" },
                    { key: "allow_speed", label: "微调速度", hint: "随机加速/减速 ±20%,听感几乎察觉不到" },
                    { key: "allow_brightness", label: "亮度微调", hint: "轻微变亮/变暗,视觉无感" },
                    { key: "allow_saturation", label: "色彩微调", hint: "颜色饱和度小幅起伏" },
                  ] as const).map((it) => {
                    const on = overrides[it.key];
                    return (
                      <button
                        key={it.key}
                        onClick={() => setOverrides((p) => ({ ...p, [it.key]: !p[it.key] }))}
                        title={it.hint}
                        className={cn(
                          "px-2.5 py-1.5 rounded-md text-xs border transition-colors text-left",
                          on
                            ? "bg-foreground text-background border-foreground"
                            : "bg-transparent border-border text-muted-foreground hover:border-foreground"
                        )}
                      >
                        <div className="font-medium flex items-center justify-between">
                          <span>{it.label}</span>
                          <span className="text-[10px]">{on ? "✓" : "—"}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  关闭后这一批不会做对应处理。文字与贴图按模板规则始终保持正向,不会被翻转。
                </p>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">一次生成几条</label>
                  <span className="text-sm font-mono font-semibold">{variants} 条</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => setVariants((v) => Math.max(1, v - 1))}
                  >
                    <Minus className="size-3" />
                  </Button>
                  <Slider
                    min={1}
                    max={20}
                    step={1}
                    value={[variants]}
                    onValueChange={(v) => setVariants(v[0])}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => setVariants((v) => Math.min(20, v + 1))}
                  >
                    <Plus className="size-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[3, 5, 10, 20].map((v) => (
                    <button
                      key={v}
                      onClick={() => setVariants(v)}
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] border transition-colors",
                        variants === v
                          ? "bg-foreground text-background border-foreground"
                          : "bg-transparent border-border text-muted-foreground hover:border-foreground"
                      )}
                    >
                      {v} 条
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">本次消耗额度</span>
                  <span className="font-mono font-medium">{variants} 条</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">本月剩余</span>
                  <span className={cn("font-mono", overQuota ? "text-red-500" : "text-foreground")}>
                    {formatNumber(quotaRemaining)} 条
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">预计出片时间</span>
                  <span className="font-mono">约 {Math.ceil((variants * 25) / 60)} 分钟</span>
                </div>
              </div>

              {overQuota && (
                <div className="rounded-md bg-red-500/10 border border-red-500/30 p-3 flex items-start gap-2">
                  <AlertTriangle className="size-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-400">
                    本月剩余额度不够,请减少生成数量或升级套餐。
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <Zap className="size-4 text-amber-500" />
                <span className="font-medium">渲染加速</span>
                <Badge variant="brand" className="text-[10px] ml-auto"><Crown className="size-2.5" /> Pro</Badge>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                专业版享受优先队列,渲染等待时间缩短至少 60%。
              </p>
            </CardContent>
          </Card>

          <Button
            variant="gradient"
            size="xl"
            className="w-full"
            disabled={!allRequiredFilled || overQuota || submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                提交中…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                开始生成 · {variants} 条
              </>
            )}
          </Button>

          {!allRequiredFilled && (
            <div className="text-xs text-amber-500 text-center">
              还有 {requiredSlots.length - filledRequired.length} 个必填槽位待填充
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
