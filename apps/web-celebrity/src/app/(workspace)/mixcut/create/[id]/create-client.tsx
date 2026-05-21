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
  Film,
} from "lucide-react";
import { nanoid } from "nanoid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/mixcut-zone/ui/card";
import { Button } from "@/components/mixcut-zone/ui/button";
import { Badge } from "@/components/mixcut-zone/ui/badge";
import { Separator } from "@/components/mixcut-zone/ui/separator";
import { Slider } from "@/components/mixcut-zone/ui/slider";
import { RadioGroup, RadioGroupItem } from "@ai-star-eco/ui/ui/radio-group";
import { Checkbox } from "@ai-star-eco/ui/ui/checkbox";
import { TemplatePreview } from "@/components/mixcut-zone/template-preview";
import { SlotInput } from "@/components/mixcut-zone/slot-input";
import { StickerPoolPicker } from "@/components/mixcut-zone/sticker-pool-picker";
import { mockTemplates } from "@/mocks/mixcut";
import { MixcutApi } from "@/api";
import type {
  SlotBinding,
  PerturbationProfile,
  RenderJob,
  RenderOutput,
  PerturbationOverrides,
  SlotSnapshot,
  SlotPerturbationPolicy,
  StickerPoolBinding,
} from "@/components/mixcut-zone/types";
import { PROFILE_LABELS, PROFILE_DESCRIPTIONS } from "@/constants/mixcut-ui";
import { cn, formatNumber } from "@/components/mixcut-zone/lib/utils";
import { resolvePolicy } from "@/components/mixcut-zone/lib/perturbation-defaults";
import { flatSlotsOf, flatSlotsAbsolute, totalDuration } from "@/components/mixcut-zone/lib/scene-helpers";
import { useConfirm } from "@/components/common/confirm-dialog";

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
    allow_position_jitter: true,
    allow_scale_jitter: true,
  });
  const [slotPolicies, setSlotPolicies] = useState<Record<string, Partial<SlotPerturbationPolicy>>>({});
  /** v0.13+: 全局扰动贴图池绑定（写到 sticker_pool["_global"]）。MVP 不做 slot 级 UI。 */
  const [stickerPool, setStickerPool] = useState<StickerPoolBinding | undefined>(undefined);
  const initFromTemplateRef = useRef(false);
  const { confirm, ConfirmHost } = useConfirm();

  useEffect(() => {
    MixcutApi.getTemplate(id).then((t) => {
      if (t) setTemplate(t);
      setResolved(true);
    });
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
  const isBound = (slotId: string) => {
    const b = bindings[slotId];
    return b && ((b.source === "input" && b.text.trim()) || b.source === "library" || b.source === "upload");
  };
  const filledRequired = requiredSlots.filter((s) => isBound(s.slot_id));
  const allRequiredFilled = filledRequired.length === requiredSlots.length;

  // v0.23: 没绑视频会触发后端 demo-fallback（用 showreel-*.mp4 兜底），用户会以为
  // "没用我的视频"。在提交前明确给一次确认，模板里所有 layer_type=video 的 user_editable
  // 槽位（不管 required 标）只要为空就提醒。
  const unboundVideoSlots = allSlots.filter(
    (s) => s.layer_type === "video" && s.user_editable && !isBound(s.slot_id),
  );

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

    // v0.23: 视频位空 → 后端会用 demo 兜底；给一次明确确认避免"为啥用的不是我的视频"。
    if (unboundVideoSlots.length > 0) {
      const names = unboundVideoSlots.map((s) => s.label || s.slot_id).join("、");
      const ok = await confirm({
        title: `还有 ${unboundVideoSlots.length} 个视频位未上传`,
        description: (
          <>
            <p>未上传素材的视频位：<b>{names}</b>。</p>
            <p className="mt-1 text-rose-600">
              继续生成会用演示视频替代这些位置，最终成片不是你自己的视频。
            </p>
          </>
        ),
        confirmText: "仍然生成",
        cancelText: "回去补上传",
      });
      if (!ok) return;
    }

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
        fit: s.fit ?? "cover",
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
      sticker_pool: stickerPool ? { _global: stickerPool } : undefined,
    };
    await MixcutApi.createJob(job);

    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);

    // mock 模式才跑前端模拟器；REAL_BACKEND 下进度由真后端 ffmpeg worker 写库，
    // 详情页轮询拿到真实状态。若两边同时跑，前端 PATCH 会覆盖真后端进度，
    // 导致「卡在 90%」+ 真后端已 failed 但前端仍显示 running。
    if (MixcutApi.isMockMode()) {
      let p = 0;
      const timer = setInterval(() => {
        p = Math.min(100, p + Math.floor(Math.random() * 12 + 6));
        if (p < 100) {
          MixcutApi.updateJobProgress(jobId, p, "running");
        } else {
          clearInterval(timer);
          const outputs: RenderOutput[] = Array.from({ length: variants }).map((_, i) => ({
            id: `out_${jobId}_${i}`,
            job_id: jobId,
            variant_index: i,
            file_url: "",
            thumbnail_url: "",
            file_size: 1_400_000 + i * 87_000,
            duration: template.canvas.duration,
            phash_signature: `mock_${i}`,
            phash_distance_to_source: 10 + Math.floor(Math.random() * 8),
            applied_transforms: {
              mirror: i % 2 === 1,
              speed: 1 + ((i % 3) - 1) * 0.05,
              brightness: ((i % 3) - 1) * 0.04,
              saturation: 1 + ((i % 3) - 1) * 0.06,
              variant: i + 1,
            },
            watermark_token: `wm_${jobId}_${i}`,
            created_at: new Date().toISOString(),
          }));
          MixcutApi.completeJobInMock(jobId, outputs);
        }
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
            frameStyle="blueprint"
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

          {/*
            v0.22+: 多场景模板按 scene 分组渲染。
            旧实现 `editableSlots.map(...)` 把所有场景的 slot 平铺成一个列表，用户无法分辨
            "第 1 段标题" vs "第 2 段标题"（尤其当 slot.label 相同时），是致命的 UX bug。
            修复：遍历 template.scenes，每个 scene 出一个 header（label / 时长 / 偏移 / 编号），
            scene 内才铺它自己的 editable slots。
            React key 用 `${scene.id}::${slot_id}` 避免 slot_id 在场景间撞 key 时 React 复用错节点。
          */}
          {(() => {
            let offset = 0;
            const blocks: React.ReactNode[] = [];
            const multiScene = template.scenes.length > 1;
            template.scenes.forEach((scene, sceneIdx) => {
              const sceneEditable = scene.slots.filter((s) => s.user_editable);
              const sceneFixedCount = scene.slots.length - sceneEditable.length;
              const startOffset = offset;
              offset += scene.duration;
              if (sceneEditable.length === 0 && sceneFixedCount === 0) return;
              blocks.push(
                <div key={scene.id} className="space-y-3">
                  {multiScene && (
                    <div className="flex items-center gap-2 pt-2 first:pt-0">
                      <div className="size-7 rounded-md bg-violet-500/10 text-violet-500 grid place-items-center shrink-0">
                        <Film className="size-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold tracking-tight truncate">
                          第 {sceneIdx + 1} 段 · {scene.label}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {startOffset.toFixed(0)}s ~ {offset.toFixed(0)}s · 时长 {scene.duration}s
                          {sceneEditable.length > 0 && ` · ${sceneEditable.length} 个素材位`}
                          {sceneFixedCount > 0 && ` · ${sceneFixedCount} 处固定内容`}
                        </div>
                      </div>
                    </div>
                  )}
                  {sceneEditable.map((s) => (
                    <div key={`${scene.id}::${s.slot_id}`} id={`slot-${s.slot_id}`}>
                      <SlotInput
                        slot={s}
                        binding={bindings[s.slot_id]}
                        onChange={(b) => handleSlotChange(s.slot_id, b)}
                        focused={focusedSlot === s.slot_id}
                        onFocus={() => setFocusedSlot(s.slot_id)}
                        policyOverride={slotPolicies[s.slot_id]}
                        onPolicyChange={(next) => handlePolicyChange(s.slot_id, next)}
                        globalOverrides={overrides}
                        canvasWidth={template.canvas.width}
                        canvasHeight={template.canvas.height}
                      />
                    </div>
                  ))}
                  {sceneEditable.length === 0 && multiScene && sceneFixedCount > 0 && (
                    <div className="text-xs text-muted-foreground bg-secondary/30 rounded-md px-3 py-2 border border-dashed border-border">
                      本段全部为固定内容（如品牌条），系统自动填，你不用管。
                    </div>
                  )}
                </div>
              );
            });
            return blocks;
          })()}

          {/* slot_id 在多场景间唯一性自检：撞 id 会导致 bindings 共用同一 key，
              用户填 A 段标题就把 B 段标题也覆盖掉。模板编辑器用 nanoid 生成新 slot_id，
              但老模板 / 复制场景 / 手编 JSON 可能出现重复，这里给个显式 warning。 */}
          {(() => {
            const ids = allSlots.map((s) => s.slot_id);
            const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
            if (dups.length === 0) return null;
            const unique = Array.from(new Set(dups));
            return (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="p-3 flex items-start gap-2">
                  <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-700 leading-relaxed">
                    检测到 {unique.length} 个 slot_id 在多个场景里重复（{unique.slice(0, 3).join(" / ")}
                    {unique.length > 3 ? ` 等` : ""}），同名 slot 的素材会互相覆盖。
                    请回到模板编辑页改成唯一 id。
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {template.scenes.length === 1 && allSlots.some((s) => !s.user_editable) && (
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

          {/* v0.13+: 扰动贴图池 —— 全局绑定，渲染时叠在所有 overlay 上 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="size-4 text-violet-500" />
                扰动贴图池
                <span className="text-[10px] font-normal text-muted-foreground ml-1">
                  · 每变体随机抽样叠加 GIF，增强视觉差异
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StickerPoolPicker
                value={stickerPool}
                onChange={setStickerPool}
                label="选择贴图"
              />
            </CardContent>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-20 self-start space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wand2 className="size-4 text-violet-500" />
                批量生成参数
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">差异化强度</label>
                </div>
                <RadioGroup
                  value={profile}
                  onValueChange={(v) => setProfile(v as PerturbationProfile)}
                  className="grid grid-cols-3 gap-1.5"
                >
                  {(["light", "moderate", "aggressive"] as PerturbationProfile[]).map((p) => (
                    <label
                      key={p}
                      className={cn(
                        "flex items-center justify-center px-3 py-2 rounded-md border text-xs cursor-pointer transition-colors select-none",
                        "border-border text-muted-foreground hover:border-foreground/40",
                        "has-[[data-state=checked]]:bg-foreground has-[[data-state=checked]]:text-background has-[[data-state=checked]]:border-foreground has-[[data-state=checked]]:font-medium",
                        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
                      )}
                    >
                      <RadioGroupItem value={p} className="sr-only" />
                      {PROFILE_LABELS[p]}
                    </label>
                  ))}
                </RadioGroup>
                <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
                  {PROFILE_DESCRIPTIONS[profile]}
                </p>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">画面处理方式</label>
                  <span className="text-[10px] text-muted-foreground">
                    {Object.values(overrides).filter(Boolean).length}/6 启用
                  </span>
                </div>

                {/* —— 整段画面（对全片生效）—— */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    整段画面 · 对全片生效
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      { key: "allow_mirror", label: "左右翻转", hint: "整段画面镜像翻转,提升差异度" },
                      { key: "allow_speed", label: "微调速度", hint: "随机加速/减速 ±20%,听感几乎察觉不到" },
                      { key: "allow_brightness", label: "亮度微调", hint: "轻微变亮/变暗,视觉无感" },
                      { key: "allow_saturation", label: "色彩微调", hint: "颜色饱和度小幅起伏" },
                    ] as const).map((it) => (
                      <label
                        key={it.key}
                        title={it.hint}
                        className={cn(
                          "flex items-center justify-between gap-2 px-2.5 py-2 rounded-md border cursor-pointer select-none transition-colors",
                          "border-border bg-background/40 text-foreground hover:border-foreground/30",
                          "has-[[data-state=checked]]:border-foreground/40 has-[[data-state=checked]]:bg-secondary/40",
                        )}
                      >
                        <span className="text-xs font-medium">{it.label}</span>
                        <Checkbox
                          checked={overrides[it.key]}
                          onCheckedChange={(v) =>
                            setOverrides((p) => ({ ...p, [it.key]: v === true }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* —— 逐素材抖动（叠加每个槽位的准入策略）—— */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    逐素材抖动 · 每个素材独立微动
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      { key: "allow_position_jitter", label: "位置抖动", hint: "每个素材在画面里位置小幅漂移" },
                      { key: "allow_scale_jitter", label: "缩放抖动", hint: "每个素材尺寸 ±5% 起伏" },
                    ] as const).map((it) => (
                      <label
                        key={it.key}
                        title={it.hint}
                        className={cn(
                          "flex items-center justify-between gap-2 px-2.5 py-2 rounded-md border cursor-pointer select-none transition-colors",
                          "border-border bg-background/40 text-foreground hover:border-foreground/30",
                          "has-[[data-state=checked]]:border-foreground/40 has-[[data-state=checked]]:bg-secondary/40",
                        )}
                      >
                        <span className="text-xs font-medium">{it.label}</span>
                        <Checkbox
                          checked={overrides[it.key]}
                          onCheckedChange={(v) =>
                            setOverrides((p) => ({ ...p, [it.key]: v === true }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  关闭后这一批不会做对应处理。文字 / 贴图 / 商品图按模板规则保留正向与原尺寸,不会被翻转或抖动。
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
                <RadioGroup
                  value={String(variants)}
                  onValueChange={(v) => setVariants(Number(v))}
                  className="grid grid-cols-4 gap-1.5"
                >
                  {[3, 5, 10, 20].map((v) => (
                    <label
                      key={v}
                      className={cn(
                        "flex items-center justify-center px-2 py-1.5 rounded-md border text-xs cursor-pointer transition-colors select-none",
                        "border-border text-muted-foreground hover:border-foreground/40",
                        "has-[[data-state=checked]]:bg-foreground has-[[data-state=checked]]:text-background has-[[data-state=checked]]:border-foreground has-[[data-state=checked]]:font-medium",
                        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
                      )}
                    >
                      <RadioGroupItem value={String(v)} className="sr-only" />
                      {v} 条
                    </label>
                  ))}
                </RadioGroup>
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
      <ConfirmHost />
    </div>
  );
}
